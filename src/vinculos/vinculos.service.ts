import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, Repository } from 'typeorm';
import { Usuario } from '../users/entities/usuario.entity';
import { Actividad } from '../actividades/entities/actividad.entity';
import { TipoUsuario } from '../common/enums/tipo-usuario.enum';
import { EstadoVinculo } from '../common/enums/estado-vinculo.enum';
import { RolProfesionalVinculo } from '../common/enums/rol-profesional-vinculo.enum';
import { VinculoAccessService } from '../common/services/vinculo-access.service';
import type { CallerInfo } from '../auth/decorators/current-user.decorator';
import { Vinculo } from './entities/vinculo.entity';
import { TutorPcd } from './entities/tutor-pcd.entity';
import { CreateVinculoDto } from './dto/create-vinculo.dto';
import { CreateTutorPcdDto } from './dto/create-tutor-pcd.dto';
import { UpdateParentescoDto } from './dto/update-parentesco.dto';
import { UpdateStatusVinculoDto } from './dto/update-status-vinculo.dto';

const VINCULO_RELATIONS = {
  pcd: { usuario: true },
  profesional: { usuario: true },
} as const;
const TUTOR_PCD_RELATIONS = {
  tutor: { usuario: true },
  pcd: { usuario: true },
} as const;

@Injectable()
export class VinculosService {
  constructor(
    @InjectRepository(Usuario)
    private readonly usuarioRepo: Repository<Usuario>,
    @InjectRepository(Vinculo)
    private readonly vinculoRepo: Repository<Vinculo>,
    @InjectRepository(TutorPcd)
    private readonly tutorPcdRepo: Repository<TutorPcd>,
    @InjectRepository(Actividad)
    private readonly actividadRepo: Repository<Actividad>,
    private readonly vinculoAccess: VinculoAccessService,
  ) {}

  // ---- Vinculo (Profesional-PCD) ----

  /**
   * El Administrador asigna cualquier vínculo. El médico de cabecera activo de
   * un PCD solo puede asignarle especialistas (no otro cabecera). Un PCD tiene
   * un solo cabecera activo.
   */
  async createVinculo(dto: CreateVinculoDto, caller: CallerInfo) {
    if (!caller.esAdministrador) {
      await this.assertEsCabeceraDe(caller, dto.pcdId);
      if (dto.rolProfesional !== RolProfesionalVinculo.ESPECIALISTA) {
        throw new ForbiddenException(
          'El médico de cabecera solo puede asignar especialistas',
        );
      }
    }
    await this.validarUsuarioEsPcd(dto.pcdId);
    await this.validarUsuarioEsProfesional(dto.profesionalId);
    if (dto.rolProfesional === RolProfesionalVinculo.CABECERA) {
      await this.assertSinOtroCabecera(dto.pcdId);
    }

    const existe = await this.vinculoRepo.findOne({
      where: { pcdId: dto.pcdId, profesionalId: dto.profesionalId },
    });
    if (existe) {
      throw new ConflictException(
        'Ya existe un vínculo entre este profesional y este PCD',
      );
    }

    const vinculo = await this.vinculoRepo.save(
      this.vinculoRepo.create({
        pcdId: dto.pcdId,
        profesionalId: dto.profesionalId,
        rolProfesional: dto.rolProfesional,
      }),
    );
    return this.findOneVinculo(vinculo.pcdId, vinculo.profesionalId);
  }

  async findAllVinculos(
    pcdId?: number,
    profesionalId?: number,
    estado?: EstadoVinculo,
  ) {
    return this.vinculoRepo.find({
      where: {
        ...(pcdId !== undefined && { pcdId }),
        ...(profesionalId !== undefined && { profesionalId }),
        ...(estado !== undefined && { estado }),
      },
      relations: VINCULO_RELATIONS,
    });
  }

  async findOneVinculo(pcdId: number, profesionalId: number) {
    const vinculo = await this.vinculoRepo.findOne({
      where: { pcdId, profesionalId },
      relations: VINCULO_RELATIONS,
    });
    if (!vinculo) {
      throw new NotFoundException(
        `Vínculo entre PCD ${pcdId} y profesional ${profesionalId} no encontrado`,
      );
    }
    return vinculo;
  }

  /**
   * Lo que ve cada uno: el Administrador, todo; el Profesional, sus vínculos y,
   * si es el cabecera activo del PCD que consulta, los de todo el equipo.
   */
  async findAllParaUsuario(
    caller: CallerInfo,
    pcdId?: number,
    profesionalId?: number,
    estado?: EstadoVinculo,
  ) {
    if (caller.esAdministrador) {
      return this.findAllVinculos(pcdId, profesionalId, estado);
    }
    if (
      pcdId !== undefined &&
      (await this.vinculoAccess.esCabeceraActivo(caller.id, pcdId))
    ) {
      return this.findAllVinculos(pcdId, profesionalId, estado);
    }
    return this.findAllVinculos(pcdId, caller.id, estado);
  }

  async updateStatusVinculo(
    pcdId: number,
    profesionalId: number,
    dto: UpdateStatusVinculoDto,
    caller: CallerInfo,
  ) {
    const vinculo = await this.findOneVinculo(pcdId, profesionalId);
    await this.assertPuedeGestionar(caller, vinculo);
    if (
      dto.estado === EstadoVinculo.ACTIVO &&
      vinculo.rolProfesional === RolProfesionalVinculo.CABECERA
    ) {
      await this.assertSinOtroCabecera(pcdId, profesionalId);
    }
    await this.vinculoRepo.update(
      { pcdId, profesionalId },
      { estado: dto.estado },
    );
    return this.findOneVinculo(pcdId, profesionalId);
  }

  async removeVinculo(
    pcdId: number,
    profesionalId: number,
    caller: CallerInfo,
  ) {
    const vinculo = await this.findOneVinculo(pcdId, profesionalId);
    await this.assertPuedeGestionar(caller, vinculo);
    await this.validarVinculoSinActividades(pcdId, profesionalId);
    await this.vinculoRepo.delete({ pcdId, profesionalId });
    return {
      message: `Vínculo entre PCD ${pcdId} y profesional ${profesionalId} eliminado correctamente`,
    };
  }

  // ---- TutorPcd (Tutor-PCD) ----

  async createTutorPcd(dto: CreateTutorPcdDto) {
    await this.validarUsuarioEsTutor(dto.tutorId);
    await this.validarUsuarioEsPcd(dto.pcdId);

    const existe = await this.tutorPcdRepo.findOne({
      where: { tutorId: dto.tutorId, pcdId: dto.pcdId },
    });
    if (existe) {
      throw new ConflictException(
        'Ya existe un vínculo entre este tutor y este PCD',
      );
    }

    const tutorPcd = await this.tutorPcdRepo.save(
      this.tutorPcdRepo.create({
        tutorId: dto.tutorId,
        pcdId: dto.pcdId,
        parentesco: dto.parentesco.trim(),
      }),
    );
    return this.findOneTutorPcdOrFail(tutorPcd.tutorId, tutorPcd.pcdId);
  }

  async findAllTutorPcd(
    tutorId?: number,
    pcdId?: number,
    estado?: EstadoVinculo,
  ) {
    return this.tutorPcdRepo.find({
      where: {
        ...(tutorId !== undefined && { tutorId }),
        ...(pcdId !== undefined && { pcdId }),
        ...(estado !== undefined && { estado }),
      },
      relations: TUTOR_PCD_RELATIONS,
    });
  }

  async updateStatusTutorPcd(
    tutorId: number,
    pcdId: number,
    dto: UpdateStatusVinculoDto,
  ) {
    await this.findOneTutorPcdOrFail(tutorId, pcdId);
    await this.tutorPcdRepo.update({ tutorId, pcdId }, { estado: dto.estado });
    return this.findOneTutorPcdOrFail(tutorId, pcdId);
  }

  async updateParentescoTutorPcd(
    tutorId: number,
    pcdId: number,
    dto: UpdateParentescoDto,
  ) {
    await this.findOneTutorPcdOrFail(tutorId, pcdId);
    await this.tutorPcdRepo.update(
      { tutorId, pcdId },
      { parentesco: dto.parentesco.trim() },
    );
    return this.findOneTutorPcdOrFail(tutorId, pcdId);
  }

  async removeTutorPcd(tutorId: number, pcdId: number) {
    await this.findOneTutorPcdOrFail(tutorId, pcdId);
    // Corrección respecto de BackendV1/V2: se aplica la misma validación de "sin actividades dependientes"
    // que ya existía solo para Vinculo, ahora también para TutorPcd.
    await this.validarTutorPcdSinActividades(tutorId, pcdId);
    await this.tutorPcdRepo.delete({ tutorId, pcdId });
    return {
      message: `Vínculo entre tutor ${tutorId} y PCD ${pcdId} eliminado correctamente`,
    };
  }

  async validarVinculoProfesionalPcd(profesionalId: number, pcdId: number) {
    const vinculo = await this.vinculoRepo.findOne({
      where: { pcdId, profesionalId },
    });
    if (!vinculo || vinculo.estado !== EstadoVinculo.ACTIVO) {
      throw new ForbiddenException('No tenés un vínculo activo con este PCD');
    }
  }

  // ---- privados ----

  private async assertEsCabeceraDe(caller: CallerInfo, pcdId: number) {
    const esCabecera = await this.vinculoAccess.esCabeceraActivo(
      caller.id,
      pcdId,
    );
    if (!esCabecera) {
      throw new ForbiddenException(
        'Solo el administrador o el médico de cabecera del PCD pueden gestionar su equipo',
      );
    }
  }

  /** El cabecera solo gestiona a los especialistas de sus pacientes. */
  private async assertPuedeGestionar(caller: CallerInfo, vinculo: Vinculo) {
    if (caller.esAdministrador) return;
    await this.assertEsCabeceraDe(caller, vinculo.pcdId);
    if (vinculo.rolProfesional === RolProfesionalVinculo.CABECERA) {
      throw new ForbiddenException(
        'Solo el administrador puede modificar al médico de cabecera',
      );
    }
  }

  private async assertSinOtroCabecera(
    pcdId: number,
    exceptoProfesionalId?: number,
  ) {
    const hay = await this.vinculoRepo.exists({
      where: {
        pcdId,
        rolProfesional: RolProfesionalVinculo.CABECERA,
        estado: EstadoVinculo.ACTIVO,
        ...(exceptoProfesionalId !== undefined && {
          profesionalId: Not(exceptoProfesionalId),
        }),
      },
    });
    if (hay) {
      throw new ConflictException(
        'El PCD ya tiene un médico de cabecera activo',
      );
    }
  }

  private async findOneTutorPcdOrFail(tutorId: number, pcdId: number) {
    const vinculo = await this.tutorPcdRepo.findOne({
      where: { tutorId, pcdId },
      relations: TUTOR_PCD_RELATIONS,
    });
    if (!vinculo) {
      throw new NotFoundException(
        `Vínculo entre tutor ${tutorId} y PCD ${pcdId} no encontrado`,
      );
    }
    return vinculo;
  }

  private async validarUsuarioEsPcd(id: number) {
    const usuario = await this.usuarioRepo.findOne({ where: { id } });
    if (!usuario || usuario.tipoUsuario !== TipoUsuario.PCD) {
      throw new BadRequestException(
        `El usuario ${id} no existe o no es de tipo PCD`,
      );
    }
  }

  private async validarUsuarioEsProfesional(id: number) {
    const usuario = await this.usuarioRepo.findOne({ where: { id } });
    if (!usuario || usuario.tipoUsuario !== TipoUsuario.PROFESIONAL) {
      throw new BadRequestException(
        `El usuario ${id} no existe o no es de tipo PROFESIONAL`,
      );
    }
  }

  private async validarUsuarioEsTutor(id: number) {
    const usuario = await this.usuarioRepo.findOne({ where: { id } });
    if (!usuario || usuario.tipoUsuario !== TipoUsuario.TUTOR) {
      throw new BadRequestException(
        `El usuario ${id} no existe o no es de tipo TUTOR`,
      );
    }
  }

  // RN-010 de BackendV1/V2: no se puede eliminar el vínculo si el profesional
  // tiene actividades creadas para ese PCD.
  private async validarVinculoSinActividades(
    pcdId: number,
    profesionalId: number,
  ): Promise<void> {
    const count = await this.actividadRepo.count({
      where: { pcdId, creadoPorUserId: profesionalId },
    });
    if (count > 0) {
      throw new ConflictException(
        'No se puede eliminar el vínculo porque el profesional tiene actividades creadas para este PCD',
      );
    }
  }

  // Validación simétrica agregada en BackendV3 (no existía en BackendV1/V2):
  // mismo criterio que arriba, pero para actividades creadas por el Tutor.
  private async validarTutorPcdSinActividades(
    tutorId: number,
    pcdId: number,
  ): Promise<void> {
    const count = await this.actividadRepo.count({
      where: { pcdId, creadoPorUserId: tutorId },
    });
    if (count > 0) {
      throw new ConflictException(
        'No se puede eliminar el vínculo porque el tutor tiene actividades creadas para este PCD',
      );
    }
  }
}

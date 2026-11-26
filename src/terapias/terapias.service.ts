import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Like, Not, Repository } from 'typeorm';
import type { CallerInfo } from '../auth/decorators/current-user.decorator';
import { ActividadTerapia } from '../actividades/entities/actividad-terapia.entity';
import { Especialidad } from '../especialidades/entities/especialidad.entity';
import { Profesional } from '../users/entities/profesional.entity';
import { Terapia } from './entities/terapia.entity';
import { CreateTerapiaDto } from './dto/create-terapia.dto';
import { UpdateTerapiaDto } from './dto/update-terapia.dto';

@Injectable()
export class TerapiasService {
  constructor(
    @InjectRepository(Terapia)
    private readonly terapiaRepo: Repository<Terapia>,
    @InjectRepository(ActividadTerapia)
    private readonly actividadTerapiaRepo: Repository<ActividadTerapia>,
    @InjectRepository(Profesional)
    private readonly profesionalRepo: Repository<Profesional>,
    @InjectRepository(Especialidad)
    private readonly especialidadRepo: Repository<Especialidad>,
  ) {}

  async create(dto: CreateTerapiaDto, caller: CallerInfo) {
    const tipo = dto.tipo.trim();
    await this.assertTipoLibre(tipo);
    const especialidadId =
      dto.especialidadId ?? (await this.especialidadDe(caller)) ?? null;
    await this.assertEspecialidadExiste(especialidadId);
    await this.assertPuedeGestionar(caller, especialidadId);
    const { id } = await this.terapiaRepo.save(
      this.terapiaRepo.create({ ...dto, tipo, especialidadId }),
    );
    return this.findOne(id);
  }

  findAll(tipo?: string) {
    return this.terapiaRepo.find({
      where: tipo ? { tipo: Like(`%${tipo}%`) } : undefined,
      order: { tipo: 'ASC' },
    });
  }

  async findOne(id: number) {
    const terapia = await this.terapiaRepo.findOne({ where: { id } });
    if (!terapia) {
      throw new NotFoundException(`Terapia con id ${id} no encontrada`);
    }
    return terapia;
  }

  async update(id: number, dto: UpdateTerapiaDto, caller: CallerInfo) {
    const actual = await this.findOne(id);
    await this.assertPuedeGestionar(caller, actual.especialidadId);
    if (dto.especialidadId !== undefined) {
      await this.assertEspecialidadExiste(dto.especialidadId);
      await this.assertPuedeGestionar(caller, dto.especialidadId);
    }
    const tipo = dto.tipo?.trim();
    if (tipo !== undefined) await this.assertTipoLibre(tipo, id);
    await this.terapiaRepo.update(id, {
      ...dto,
      ...(tipo !== undefined && { tipo }),
    });
    return this.findOne(id);
  }

  async remove(id: number, caller: CallerInfo) {
    const terapia = await this.findOne(id);
    await this.assertPuedeGestionar(caller, terapia.especialidadId);
    const enUso = await this.actividadTerapiaRepo.count({
      where: { terapiaId: id },
    });
    if (enUso > 0) {
      throw new ConflictException(
        `No se puede eliminar "${terapia.tipo}": está asignada a ${enUso} actividad(es). Cambiá la terapia de esas actividades primero.`,
      );
    }
    await this.terapiaRepo.delete(id);
    return { message: `Terapia ${id} eliminada correctamente` };
  }

  /** El tipo de terapia es único en el catálogo (sin distinguir mayúsculas ni acentos, por la intercalación de MySQL). */
  private async assertTipoLibre(tipo: string, exceptoId?: number) {
    const existe = await this.terapiaRepo.findOne({
      where: { tipo, ...(exceptoId && { id: Not(exceptoId) }) },
    });
    if (existe) {
      throw new ConflictException(`Ya existe una terapia "${existe.tipo}"`);
    }
  }

  /** Especialidad del Profesional que llama (null si no es Profesional). */
  private async especialidadDe(caller: CallerInfo): Promise<number | null> {
    const profesional = await this.profesionalRepo.findOne({
      where: { userId: caller.id },
    });
    return profesional?.especialidadId ?? null;
  }

  private async assertEspecialidadExiste(especialidadId: number | null) {
    if (especialidadId === null) return;
    const existe = await this.especialidadRepo.exists({
      where: { id: especialidadId },
    });
    if (!existe) {
      throw new BadRequestException(
        `La especialidad ${especialidadId} no existe`,
      );
    }
  }

  /**
   * El Administrador gestiona cualquier terapia. Un Profesional solo las de su
   * especialidad; las que no tienen especialidad, solo el Administrador.
   */
  private async assertPuedeGestionar(
    caller: CallerInfo,
    especialidadId: number | null | undefined,
  ) {
    if (caller.esAdministrador) return;
    const propia = await this.especialidadDe(caller);
    if (
      propia === null ||
      especialidadId == null ||
      propia !== especialidadId
    ) {
      throw new ForbiddenException(
        'Solo podés gestionar terapias de tu especialidad',
      );
    }
  }
}

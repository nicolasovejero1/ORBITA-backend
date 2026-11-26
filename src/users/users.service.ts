import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Not, Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { VinculoAccessService } from '../common/services/vinculo-access.service';
import { TipoUsuario } from '../common/enums/tipo-usuario.enum';
import { TutorPcd } from '../vinculos/entities/tutor-pcd.entity';
import { Actividad } from '../actividades/entities/actividad.entity';
import { SesionesService } from '../auth/sesiones.service';
import { CallerInfo } from '../auth/decorators/current-user.decorator';
import { Usuario } from './entities/usuario.entity';
import { Profesional } from './entities/profesional.entity';
import { Tutor } from './entities/tutor.entity';
import { Pcd } from './entities/pcd.entity';
import { Especialidad } from '../especialidades/entities/especialidad.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdateStatusDto, UpdateUserDto } from './dto/update-user.dto';
import { ChangePasswordDto, ResetPasswordDto } from './dto/change-password.dto';

const PERFIL_RELATIONS = { profesional: true, tutor: true, pcd: true } as const;

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(Usuario)
    private readonly usuarioRepo: Repository<Usuario>,
    @InjectRepository(TutorPcd)
    private readonly tutorPcdRepo: Repository<TutorPcd>,
    @InjectRepository(Actividad)
    private readonly actividadRepo: Repository<Actividad>,
    private readonly dataSource: DataSource,
    private readonly vinculoAccess: VinculoAccessService,
    private readonly sesionesService: SesionesService,
  ) {}

  async create(dto: CreateUserDto) {
    const existe = await this.usuarioRepo.findOne({
      where: [{ email: dto.email }, { dni: dto.dni }],
    });
    if (existe) {
      throw new ConflictException('Ya existe un usuario con ese email o DNI');
    }

    this.validarEsAdministrador(dto);

    const hashedPassword = await bcrypt.hash(dto.password, 10);

    return this.dataSource.transaction(async (manager) => {
      const usuario = await manager.save(
        manager.create(Usuario, {
          nombre: dto.nombre,
          apellido: dto.apellido,
          dni: dto.dni,
          email: dto.email,
          password: hashedPassword,
          fechaNacimiento: dto.fechaNacimiento,
          telefono: dto.telefono,
          direccion: dto.direccion,
          tipoUsuario: dto.tipoUsuario,
          esAdministrador:
            dto.tipoUsuario === TipoUsuario.PROFESIONAL
              ? (dto.esAdministrador ?? false)
              : false,
        }),
      );

      if (dto.tipoUsuario === TipoUsuario.PROFESIONAL) {
        await this.assertEspecialidadExiste(manager, dto.especialidadId!);
        await manager.save(
          manager.create(Profesional, {
            userId: usuario.id,
            matricula: dto.matricula!,
            especialidadId: dto.especialidadId!,
            establecimiento: dto.establecimiento,
            descripcionFunciones: dto.descripcionFunciones,
          }),
        );
      }

      if (dto.tipoUsuario === TipoUsuario.TUTOR) {
        await manager.save(manager.create(Tutor, { userId: usuario.id }));
      }

      if (dto.tipoUsuario === TipoUsuario.PCD) {
        await manager.save(
          manager.create(Pcd, {
            userId: usuario.id,
            tipoDiscapacidad: dto.tipoDiscapacidad,
            grado: dto.grado,
            diagnostico: dto.diagnostico,
          }),
        );
      }

      return manager.findOne(Usuario, {
        where: { id: usuario.id },
        relations: PERFIL_RELATIONS,
      });
    });
  }

  private async assertEspecialidadExiste(
    manager: EntityManager,
    especialidadId: number,
  ) {
    const existe = await manager.exists(Especialidad, {
      where: { id: especialidadId },
    });
    if (!existe) {
      throw new BadRequestException(
        `La especialidad ${especialidadId} no existe`,
      );
    }
  }

  async findAll(tipoUsuario?: TipoUsuario) {
    return this.usuarioRepo.find({
      where: tipoUsuario ? { tipoUsuario } : undefined,
      relations: PERFIL_RELATIONS,
    });
  }

  async findOne(id: number, caller: CallerInfo) {
    const usuario = await this.findUsuarioOrFail(id);

    if (!caller.esAdministrador) {
      await this.vinculoAccess.assertVinculoActivo(
        caller.id,
        caller.tipoUsuario,
        id,
      );
    }

    return usuario;
  }

  private async findUsuarioOrFail(id: number) {
    const usuario = await this.usuarioRepo.findOne({
      where: { id },
      relations: PERFIL_RELATIONS,
    });
    if (!usuario) {
      throw new NotFoundException(`Usuario con id ${id} no encontrado`);
    }
    return usuario;
  }

  async update(id: number, dto: UpdateUserDto) {
    const usuario = await this.findUsuarioOrFail(id);

    return this.dataSource.transaction(async (manager) => {
      await manager.update(Usuario, id, {
        ...(dto.nombre !== undefined && { nombre: dto.nombre }),
        ...(dto.apellido !== undefined && { apellido: dto.apellido }),
        ...(dto.dni !== undefined && { dni: dto.dni }),
        ...(dto.email !== undefined && { email: dto.email }),
        ...(dto.telefono !== undefined && { telefono: dto.telefono }),
        ...(dto.direccion !== undefined && { direccion: dto.direccion }),
        ...(dto.fechaNacimiento !== undefined && {
          fechaNacimiento: dto.fechaNacimiento,
        }),
        ...(usuario.tipoUsuario === TipoUsuario.PROFESIONAL &&
          dto.esAdministrador !== undefined && {
            esAdministrador: dto.esAdministrador,
          }),
      });

      if (usuario.tipoUsuario === TipoUsuario.PROFESIONAL) {
        if (dto.especialidadId !== undefined) {
          await this.assertEspecialidadExiste(manager, dto.especialidadId);
        }
        await manager.update(
          Profesional,
          { userId: id },
          {
            ...(dto.matricula !== undefined && { matricula: dto.matricula }),
            ...(dto.especialidadId !== undefined && {
              especialidadId: dto.especialidadId,
            }),
            ...(dto.establecimiento !== undefined && {
              establecimiento: dto.establecimiento,
            }),
            ...(dto.descripcionFunciones !== undefined && {
              descripcionFunciones: dto.descripcionFunciones,
            }),
          },
        );
      }

      if (usuario.tipoUsuario === TipoUsuario.PCD) {
        await manager.update(
          Pcd,
          { userId: id },
          {
            ...(dto.tipoDiscapacidad !== undefined && {
              tipoDiscapacidad: dto.tipoDiscapacidad,
            }),
            ...(dto.grado !== undefined && { grado: dto.grado }),
            ...(dto.diagnostico !== undefined && {
              diagnostico: dto.diagnostico,
            }),
          },
        );
      }

      return manager.findOne(Usuario, {
        where: { id },
        relations: PERFIL_RELATIONS,
      });
    });
  }

  async updateStatus(id: number, dto: UpdateStatusDto) {
    await this.findUsuarioOrFail(id);
    await this.usuarioRepo.update(id, { estado: dto.estado });

    // Mejora respecto de BackendV1/V2: al desactivar la cuenta, se cortan
    // también las sesiones activas (antes solo se bloqueaba el próximo login,
    // pero un refresh token ya emitido seguía siendo válido).
    await this.sesionesService.revocarTodas(id);

    return this.usuarioRepo.findOne({
      where: { id },
      select: { id: true, email: true, estado: true },
    });
  }

  async remove(id: number) {
    const usuario = await this.findUsuarioOrFail(id);

    if (usuario.tipoUsuario === TipoUsuario.PROFESIONAL) {
      await this.assertProfesionalSinActividades(id);
    }
    if (usuario.tipoUsuario === TipoUsuario.PCD) {
      await this.assertPcdSinActividades(id);
    }
    if (usuario.tipoUsuario === TipoUsuario.TUTOR) {
      const count = await this.tutorPcdRepo.count({ where: { tutorId: id } });
      if (count > 0) {
        throw new ConflictException(
          'No se puede eliminar el tutor porque tiene PCDs vinculados',
        );
      }
    }

    await this.usuarioRepo.delete(id);
    return { message: `Usuario ${id} eliminado correctamente` };
  }

  // RN-043 de BackendV1/V2: no se puede eliminar un Profesional con actividades creadas.
  private async assertProfesionalSinActividades(id: number): Promise<void> {
    const count = await this.actividadRepo.count({
      where: { creadoPorUserId: id },
    });
    if (count > 0) {
      throw new ConflictException(
        'No se puede eliminar el profesional porque tiene actividades creadas',
      );
    }
  }

  // RN-043 de BackendV1/V2: no se puede eliminar un PCD con actividades asignadas.
  private async assertPcdSinActividades(id: number): Promise<void> {
    const count = await this.actividadRepo.count({ where: { pcdId: id } });
    if (count > 0) {
      throw new ConflictException(
        'No se puede eliminar el PCD porque tiene actividades asignadas',
      );
    }
  }

  async findMe(caller: CallerInfo) {
    const usuario = await this.usuarioRepo.findOne({
      where: { id: caller.id },
    });
    if (!usuario) throw new NotFoundException('Usuario no encontrado');
    return this.toPerfil(usuario);
  }

  async updateMe(dto: UpdateProfileDto, caller: CallerInfo) {
    if (dto.email) {
      const existe = await this.usuarioRepo.findOne({
        where: { email: dto.email, id: Not(caller.id) },
      });
      if (existe) {
        throw new ConflictException('Ese email ya está en uso');
      }
    }
    await this.usuarioRepo.update(caller.id, dto);
    return this.findMe(caller);
  }

  /** Autogestión: exige conocer la contraseña actual. Revoca todas las sesiones al cambiarla. */
  async changeOwnPassword(caller: CallerInfo, dto: ChangePasswordDto) {
    // `password` tiene `select: false` en la entidad; hay que pedirlo explícitamente.
    const usuario = await this.usuarioRepo
      .createQueryBuilder('usuario')
      .addSelect('usuario.password')
      .where('usuario.id = :id', { id: caller.id })
      .getOne();
    if (!usuario) throw new NotFoundException('Usuario no encontrado');

    const passwordValida = await bcrypt.compare(
      dto.currentPassword,
      usuario.password,
    );
    if (!passwordValida) {
      throw new UnauthorizedException('La contraseña actual no es correcta');
    }

    await this.setPassword(usuario.id, dto.newPassword);
    return { message: 'Contraseña actualizada correctamente' };
  }

  /** Reseteo por Admin: no requiere conocer la contraseña anterior. */
  async resetPassword(id: number, dto: ResetPasswordDto) {
    await this.findUsuarioOrFail(id);
    await this.setPassword(id, dto.newPassword);
    return { message: 'Contraseña restablecida correctamente' };
  }

  private async setPassword(userId: number, newPassword: string) {
    const hashed = await bcrypt.hash(newPassword, 10);
    await this.usuarioRepo.update(userId, { password: hashed });
    // Cambiar la contraseña invalida cualquier sesión abierta con la credencial anterior.
    await this.sesionesService.revocarTodas(userId);
  }

  private toPerfil(usuario: Usuario) {
    return {
      id: usuario.id,
      dni: usuario.dni,
      nombre: usuario.nombre,
      apellido: usuario.apellido,
      fechaNacimiento: usuario.fechaNacimiento,
      telefono: usuario.telefono,
      email: usuario.email,
      direccion: usuario.direccion,
      tipoUsuario: usuario.tipoUsuario,
      esAdministrador: usuario.esAdministrador,
      estado: usuario.estado,
    };
  }

  private validarEsAdministrador(dto: CreateUserDto) {
    if (dto.esAdministrador && dto.tipoUsuario !== TipoUsuario.PROFESIONAL) {
      throw new BadRequestException(
        'Solo los usuarios de tipo PROFESIONAL pueden ser administradores',
      );
    }
  }
}

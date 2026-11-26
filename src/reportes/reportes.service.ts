import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { mkdir, writeFile } from 'fs/promises';
import { basename, join } from 'path';
import { VinculoAccessService } from '../common/services/vinculo-access.service';
import { TipoUsuario } from '../common/enums/tipo-usuario.enum';
import { EstadoReporte } from '../common/enums/estado-reporte.enum';
import { TipoReporte } from '../common/enums/tipo-reporte.enum';
import { TipoAdjunto } from '../common/enums/tipo-adjunto.enum';
import type { CallerInfo } from '../auth/decorators/current-user.decorator';
import { Actividad } from '../actividades/entities/actividad.entity';
import { ActividadInstancia } from '../actividades/entities/actividad-instancia.entity';
import { Profesional } from '../users/entities/profesional.entity';
import { TutorPcd } from '../vinculos/entities/tutor-pcd.entity';
import { EstadoVinculo } from '../common/enums/estado-vinculo.enum';
import { RolProfesionalVinculo } from '../common/enums/rol-profesional-vinculo.enum';
import { ReporteProgreso } from './entities/reporte-progreso.entity';
import { ReporteAdjunto } from './entities/reporte-adjunto.entity';
import { ReporteColaborador } from './entities/reporte-colaborador.entity';
import { CreateReporteDto } from './dto/create-reporte.dto';
import { UpdateReporteDto } from './dto/update-reporte.dto';
import { ChangeEstadoReporteDto } from './dto/change-estado-reporte.dto';
import { CreateAdjuntoDto } from './dto/create-adjunto.dto';
import { CreateColaboradorDto } from './dto/create-colaborador.dto';
import { AdjuntoUrlService } from './adjunto-url.service';

const PREFIJO_UPLOADS = '/uploads/reportes/';

const REPORTE_RELATIONS = {
  profesional: { usuario: true },
  actividad: true,
  instancia: true,
  adjuntos: true,
  colaboradores: { profesional: { usuario: true } },
} as const;

@Injectable()
export class ReportesService {
  constructor(
    @InjectRepository(ReporteProgreso)
    private readonly reporteRepo: Repository<ReporteProgreso>,
    @InjectRepository(ReporteAdjunto)
    private readonly adjuntoRepo: Repository<ReporteAdjunto>,
    @InjectRepository(ReporteColaborador)
    private readonly colaboradorRepo: Repository<ReporteColaborador>,
    @InjectRepository(Actividad)
    private readonly actividadRepo: Repository<Actividad>,
    @InjectRepository(ActividadInstancia)
    private readonly instanciaRepo: Repository<ActividadInstancia>,
    @InjectRepository(Profesional)
    private readonly profesionalRepo: Repository<Profesional>,
    private readonly vinculoAccess: VinculoAccessService,
    private readonly adjuntoUrl: AdjuntoUrlService,
  ) {}

  async create(dto: CreateReporteDto, caller: CallerInfo) {
    const actividad = await this.actividadRepo.findOne({
      where: { id: dto.actividadId },
    });
    if (!actividad) {
      throw new NotFoundException(`Actividad ${dto.actividadId} no encontrada`);
    }

    await this.vinculoAccess.assertVinculoActivo(
      caller.id,
      TipoUsuario.PROFESIONAL,
      actividad.pcdId,
    );

    if (dto.instanciaId && dto.tipo !== TipoReporte.DE_ACTIVIDAD) {
      throw new BadRequestException(
        'Solo los reportes de actividad pueden referirse a una sesión puntual',
      );
    }
    if (dto.instanciaId) {
      const instancia = await this.instanciaRepo.findOne({
        where: { id: dto.instanciaId },
      });
      if (!instancia || instancia.actividadId !== dto.actividadId) {
        throw new BadRequestException(
          'La instancia no pertenece a la actividad indicada',
        );
      }
    }

    const reporte = await this.reporteRepo.save(
      this.reporteRepo.create({
        profesionalId: caller.id,
        actividadId: dto.actividadId,
        instanciaId: dto.instanciaId ?? null,
        titulo: dto.titulo,
        descripcionDetallada: dto.descripcionDetallada,
        tipo: dto.tipo,
      }),
    );
    return this.findByIdOrFail(reporte.id);
  }

  async findAll(
    caller: CallerInfo,
    actividadId?: number,
    pcdId?: number,
    estado?: EstadoReporte,
  ) {
    const qb = this.reporteRepo
      .createQueryBuilder('reporte')
      .leftJoinAndSelect('reporte.profesional', 'profesional')
      .leftJoinAndSelect('profesional.usuario', 'profesionalUsuario')
      .leftJoinAndSelect('reporte.actividad', 'actividad')
      .leftJoinAndSelect('reporte.instancia', 'instancia')
      .leftJoinAndSelect('reporte.adjuntos', 'adjuntos')
      .leftJoinAndSelect('reporte.colaboradores', 'colaboradores')
      .leftJoinAndSelect('colaboradores.profesional', 'colabProfesional')
      .leftJoinAndSelect('colabProfesional.usuario', 'colabUsuario')
      .orderBy('reporte.createdAt', 'DESC');

    if (actividadId)
      qb.andWhere('reporte.actividadId = :actividadId', { actividadId });
    if (estado) qb.andWhere('reporte.estado = :estado', { estado });

    if (caller.esAdministrador) {
      if (pcdId) qb.andWhere('actividad.pcdId = :pcdId', { pcdId });
    } else if (caller.tipoUsuario === TipoUsuario.PROFESIONAL) {
      // Los propios, aquellos en los que colabora y todos los de los PCD de
      // los que es médico de cabecera.
      qb.andWhere(
        `(reporte.profesionalId = :callerId
          OR EXISTS (SELECT 1 FROM reporte_colaboradores rc WHERE rc.reporteId = reporte.id AND rc.profesionalId = :callerId)
          OR EXISTS (
            SELECT 1 FROM vinculos v
            WHERE v.pcdId = actividad.pcdId AND v.profesionalId = :callerId
              AND v.rolProfesional = :cabecera AND v.estado = :activoVinculo
          ))`,
        {
          callerId: caller.id,
          cabecera: RolProfesionalVinculo.CABECERA,
          activoVinculo: EstadoVinculo.ACTIVO,
        },
      );
      if (pcdId) qb.andWhere('actividad.pcdId = :pcdId', { pcdId });
    } else if (caller.tipoUsuario === TipoUsuario.TUTOR) {
      qb.andWhere('reporte.estado = :finalizado', {
        finalizado: EstadoReporte.FINALIZADO,
      });
      qb.andWhere('reporte.visibilidadTutor = true');
      qb.innerJoin(
        TutorPcd,
        'tp',
        'tp.pcdId = actividad.pcdId AND tp.tutorId = :tutorId AND tp.estado = :activo',
        { tutorId: caller.id, activo: EstadoVinculo.ACTIVO },
      );
      if (pcdId) qb.andWhere('actividad.pcdId = :pcdId', { pcdId });
    } else {
      // PCD: igual que el tutor, solo los FINALIZADOS y visibles de sus propias actividades.
      qb.andWhere('reporte.estado = :finalizado', {
        finalizado: EstadoReporte.FINALIZADO,
      });
      qb.andWhere('reporte.visibilidadTutor = true');
      qb.andWhere('actividad.pcdId = :callerId', { callerId: caller.id });
    }

    return qb.getMany();
  }

  async findColaboraciones(caller: CallerInfo) {
    return this.reporteRepo
      .createQueryBuilder('reporte')
      .leftJoinAndSelect('reporte.profesional', 'profesional')
      .leftJoinAndSelect('profesional.usuario', 'profesionalUsuario')
      .leftJoinAndSelect('reporte.actividad', 'actividad')
      .leftJoinAndSelect('reporte.instancia', 'instancia')
      .leftJoinAndSelect('reporte.adjuntos', 'adjuntos')
      .leftJoinAndSelect('reporte.colaboradores', 'colaboradores')
      .leftJoinAndSelect('colaboradores.profesional', 'colabProfesional')
      .leftJoinAndSelect('colabProfesional.usuario', 'colabUsuario')
      .innerJoin(
        ReporteColaborador,
        'miColaboracion',
        'miColaboracion.reporteId = reporte.id AND miColaboracion.profesionalId = :callerId',
        { callerId: caller.id },
      )
      .orderBy('reporte.createdAt', 'DESC')
      .getMany();
  }

  async findOne(id: number, caller: CallerInfo) {
    const reporte = await this.findByIdOrFail(id);
    await this.verificarAcceso(reporte, caller);
    return reporte;
  }

  async update(id: number, dto: UpdateReporteDto, caller: CallerInfo) {
    const reporte = await this.findOne(id, caller);

    if (reporte.profesionalId !== caller.id) {
      throw new ForbiddenException(
        'Solo el creador del reporte puede modificarlo',
      );
    }
    if (reporte.estado === EstadoReporte.FINALIZADO) {
      throw new ConflictException('Un reporte finalizado no puede modificarse');
    }

    await this.reporteRepo.update(id, dto);
    return this.findByIdOrFail(id);
  }

  async changeEstado(
    id: number,
    dto: ChangeEstadoReporteDto,
    caller: CallerInfo,
  ) {
    const reporte = await this.findOne(id, caller);

    if (reporte.profesionalId !== caller.id) {
      throw new ForbiddenException(
        'Solo el creador del reporte puede cambiar su estado',
      );
    }
    if (reporte.estado === EstadoReporte.FINALIZADO) {
      throw new ConflictException('Un reporte finalizado no puede modificarse');
    }
    if (
      dto.visibilidadTutor === true &&
      dto.estado !== EstadoReporte.FINALIZADO
    ) {
      throw new BadRequestException(
        'La visibilidad para tutores solo puede activarse al finalizar el reporte',
      );
    }

    await this.reporteRepo.update(id, {
      estado: dto.estado,
      ...(dto.estado === EstadoReporte.FINALIZADO &&
        dto.visibilidadTutor !== undefined && {
          visibilidadTutor: dto.visibilidadTutor,
        }),
    });
    return this.findByIdOrFail(id);
  }

  async remove(id: number, caller: CallerInfo) {
    const reporte = await this.findOne(id, caller);

    if (reporte.profesionalId !== caller.id) {
      throw new ForbiddenException(
        'Solo el creador del reporte puede eliminarlo',
      );
    }
    if (reporte.estado === EstadoReporte.FINALIZADO) {
      throw new ConflictException('Un reporte finalizado no puede eliminarse');
    }

    await this.reporteRepo.delete(id);
    return { message: `Reporte ${id} eliminado correctamente` };
  }

  async addAdjunto(
    reporteId: number,
    dto: CreateAdjuntoDto,
    caller: CallerInfo,
  ) {
    const reporte = await this.findOne(reporteId, caller);

    if (reporte.profesionalId !== caller.id) {
      throw new ForbiddenException('Solo el creador puede agregar adjuntos');
    }
    if (reporte.estado === EstadoReporte.FINALIZADO) {
      throw new ConflictException(
        'No se pueden agregar adjuntos a un reporte finalizado',
      );
    }

    return this.adjuntoRepo.save(
      this.adjuntoRepo.create({
        reporteId,
        tipoArchivo: TipoAdjunto.URL,
        filePath: dto.filePath,
      }),
    );
  }

  async removeAdjunto(
    reporteId: number,
    adjuntoId: number,
    caller: CallerInfo,
  ) {
    const reporte = await this.findOne(reporteId, caller);

    if (reporte.profesionalId !== caller.id) {
      throw new ForbiddenException('Solo el creador puede eliminar adjuntos');
    }
    // Corrección respecto de BackendV1/V2: esta validación faltaba acá, pese a que addAdjunto sí la tiene —
    // un reporte finalizado debe ser inmutable también para sus adjuntos.
    if (reporte.estado === EstadoReporte.FINALIZADO) {
      throw new ConflictException(
        'No se pueden eliminar adjuntos de un reporte finalizado',
      );
    }

    const adjunto = await this.adjuntoRepo.findOne({
      where: { id: adjuntoId },
    });
    if (!adjunto || adjunto.reporteId !== reporteId) {
      throw new NotFoundException(
        `Adjunto ${adjuntoId} no encontrado en el reporte ${reporteId}`,
      );
    }

    await this.adjuntoRepo.delete(adjuntoId);
    return { message: `Adjunto ${adjuntoId} eliminado correctamente` };
  }

  async agregarArchivoAdjunto(
    reporteId: number,
    file: Express.Multer.File | undefined,
    caller: CallerInfo,
  ) {
    if (!file) {
      throw new BadRequestException('No se recibió ningún archivo');
    }
    const reporte = await this.findOne(reporteId, caller);

    if (reporte.profesionalId !== caller.id) {
      throw new ForbiddenException('Solo el creador puede agregar adjuntos');
    }
    if (reporte.estado === EstadoReporte.FINALIZADO) {
      throw new ConflictException(
        'No se pueden agregar adjuntos a un reporte finalizado',
      );
    }

    const tipoArchivo = this.detectarTipo(file.mimetype);
    const ext = this.extensionDe(file, tipoArchivo);
    const dir = join(process.cwd(), 'uploads', 'reportes');
    await mkdir(dir, { recursive: true });
    const filename = `${Date.now()}-${randomUUID()}${ext}`;
    await writeFile(join(dir, filename), file.buffer);

    return this.adjuntoRepo.save(
      this.adjuntoRepo.create({
        reporteId,
        tipoArchivo,
        filePath: `/uploads/reportes/${filename}`,
      }),
    );
  }

  /**
   * Los archivos subidos ya no se sirven como estáticos: se piden con un
   * enlace firmado que dura 60 s y solo se entrega a quien puede ver el reporte.
   * Un adjunto de tipo enlace externo se devuelve tal cual.
   */
  async urlAdjunto(reporteId: number, adjuntoId: number, caller: CallerInfo) {
    await this.findOne(reporteId, caller);
    const adjunto = await this.adjuntoRepo.findOne({
      where: { id: adjuntoId },
    });
    if (!adjunto || adjunto.reporteId !== reporteId) {
      throw new NotFoundException(
        `Adjunto ${adjuntoId} no encontrado en el reporte ${reporteId}`,
      );
    }
    if (!adjunto.filePath.startsWith(PREFIJO_UPLOADS)) {
      return { url: adjunto.filePath, externo: true, expiraEnSegundos: null };
    }
    const token = this.adjuntoUrl.firmar(reporteId, adjuntoId);
    return {
      url: `/reportes/adjuntos/archivo?token=${token}`,
      externo: false,
      expiraEnSegundos: AdjuntoUrlService.TTL_SEGUNDOS,
    };
  }

  /** Resuelve el archivo local de un enlace firmado (endpoint público). */
  async archivoAdjunto(token: string | undefined) {
    if (!token) {
      throw new UnauthorizedException('Falta el enlace firmado del archivo');
    }
    const { rep, adj } = await this.adjuntoUrl.verificar(token);
    const adjunto = await this.adjuntoRepo.findOne({ where: { id: adj } });
    if (
      !adjunto ||
      adjunto.reporteId !== rep ||
      !adjunto.filePath.startsWith(PREFIJO_UPLOADS)
    ) {
      throw new NotFoundException('Archivo no encontrado');
    }
    const nombre = basename(adjunto.filePath);
    return {
      ruta: join(process.cwd(), 'uploads', 'reportes', nombre),
      nombre,
    };
  }

  async addColaborador(
    reporteId: number,
    dto: CreateColaboradorDto,
    caller: CallerInfo,
  ) {
    const reporte = await this.findOne(reporteId, caller);

    if (reporte.profesionalId !== caller.id) {
      throw new ForbiddenException(
        'Solo el creador puede agregar colaboradores',
      );
    }
    if (dto.profesionalId === caller.id) {
      throw new BadRequestException(
        'El creador del reporte no puede agregarse como colaborador',
      );
    }

    const profesional = await this.profesionalRepo.findOne({
      where: { userId: dto.profesionalId },
    });
    if (!profesional) {
      throw new NotFoundException(
        `Profesional ${dto.profesionalId} no encontrado`,
      );
    }

    const existe = await this.colaboradorRepo.findOne({
      where: { profesionalId: dto.profesionalId, reporteId },
    });
    if (existe) {
      throw new ConflictException(
        'El profesional ya es colaborador de este reporte',
      );
    }

    const colaborador = await this.colaboradorRepo.save(
      this.colaboradorRepo.create({
        profesionalId: dto.profesionalId,
        reporteId,
      }),
    );
    return this.colaboradorRepo.findOne({
      where: {
        profesionalId: colaborador.profesionalId,
        reporteId: colaborador.reporteId,
      },
      relations: { profesional: { usuario: true } },
    });
  }

  async findColaboradores(reporteId: number, caller: CallerInfo) {
    const reporte = await this.findOne(reporteId, caller);

    if (reporte.profesionalId !== caller.id && !caller.esAdministrador) {
      throw new ForbiddenException(
        'Solo el creador o el administrador puede ver los colaboradores',
      );
    }

    return this.colaboradorRepo.find({
      where: { reporteId },
      relations: { profesional: { usuario: true } },
    });
  }

  async removeColaborador(
    reporteId: number,
    profesionalId: number,
    caller: CallerInfo,
  ) {
    const reporte = await this.findOne(reporteId, caller);

    if (reporte.profesionalId !== caller.id) {
      throw new ForbiddenException(
        'Solo el creador puede revocar colaboradores',
      );
    }

    const colaborador = await this.colaboradorRepo.findOne({
      where: { profesionalId, reporteId },
    });
    if (!colaborador) {
      throw new NotFoundException(
        `El profesional ${profesionalId} no es colaborador de este reporte`,
      );
    }

    await this.colaboradorRepo.delete({ profesionalId, reporteId });
    return { message: `Colaborador ${profesionalId} removido correctamente` };
  }

  private async findByIdOrFail(id: number) {
    const reporte = await this.reporteRepo.findOne({
      where: { id },
      relations: REPORTE_RELATIONS,
    });
    if (!reporte) throw new NotFoundException(`Reporte ${id} no encontrado`);
    return reporte;
  }

  private async verificarAcceso(
    reporte: ReporteProgreso,
    caller: CallerInfo,
  ): Promise<void> {
    if (caller.esAdministrador) return;

    if (caller.tipoUsuario === TipoUsuario.PROFESIONAL) {
      const esCreador = reporte.profesionalId === caller.id;
      const esColaborador = reporte.colaboradores.some(
        (c) => c.profesionalId === caller.id,
      );
      if (esCreador || esColaborador) return;
      // El médico de cabecera lee todos los reportes de sus pacientes.
      if (
        await this.vinculoAccess.esCabeceraActivo(
          caller.id,
          reporte.actividad.pcdId,
        )
      ) {
        return;
      }
      throw new ForbiddenException('No tenés acceso a este reporte');
    }

    if (caller.tipoUsuario === TipoUsuario.TUTOR) {
      if (
        reporte.estado !== EstadoReporte.FINALIZADO ||
        !reporte.visibilidadTutor
      ) {
        throw new ForbiddenException('Este reporte no es visible para tutores');
      }
      const actividad = await this.actividadRepo.findOne({
        where: { id: reporte.actividadId },
      });
      await this.vinculoAccess.assertVinculoActivo(
        caller.id,
        TipoUsuario.TUTOR,
        actividad!.pcdId,
      );
      return;
    }

    if (caller.tipoUsuario === TipoUsuario.PCD) {
      const actividad = await this.actividadRepo.findOne({
        where: { id: reporte.actividadId },
      });
      if (actividad?.pcdId !== caller.id) {
        throw new ForbiddenException('No tenés acceso a este reporte');
      }
      if (
        reporte.estado !== EstadoReporte.FINALIZADO ||
        !reporte.visibilidadTutor
      ) {
        throw new ForbiddenException('Este reporte todavía no está disponible');
      }
    }
  }

  private detectarTipo(mimetype: string): TipoAdjunto {
    if (mimetype === 'application/pdf') return TipoAdjunto.PDF;
    if (mimetype?.startsWith('image/')) return TipoAdjunto.IMAGEN;
    throw new BadRequestException('Solo se permiten imágenes o PDF');
  }

  private extensionDe(file: Express.Multer.File, tipo: TipoAdjunto): string {
    if (tipo === TipoAdjunto.PDF) return '.pdf';
    const mimes: Record<string, string> = {
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/webp': '.webp',
      'image/gif': '.gif',
    };
    const ext = mimes[file.mimetype];
    if (ext) return ext;
    const fromName = file.originalname?.split('.').pop();
    return fromName ? `.${fromName}` : '.jpg';
  }
}

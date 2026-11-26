import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import { VinculoAccessService } from '../common/services/vinculo-access.service';
import {
  formatLocalDate,
  generarInstancias,
  parseLocalDate,
  parseTime,
} from '../common/utils/date.utils';
import { TipoUsuario } from '../common/enums/tipo-usuario.enum';
import { TipoActividad } from '../common/enums/tipo-actividad.enum';
import { EstadoActividad } from '../common/enums/estado-actividad.enum';
import { OrdenActividad } from '../common/enums/orden-actividad.enum';
import { FrecuenciaActividad } from '../common/enums/frecuencia-actividad.enum';
import { EstadoInstancia } from '../common/enums/estado-instancia.enum';
import { EstadoVinculo } from '../common/enums/estado-vinculo.enum';
import { RolProfesionalVinculo } from '../common/enums/rol-profesional-vinculo.enum';
import type { CallerInfo } from '../auth/decorators/current-user.decorator';
import { TutorPcd } from '../vinculos/entities/tutor-pcd.entity';
import { Medicamento } from '../medicamentos/entities/medicamento.entity';
import { Terapia } from '../terapias/entities/terapia.entity';
import { Profesional } from '../users/entities/profesional.entity';
import { ReporteProgreso } from '../reportes/entities/reporte-progreso.entity';
import { Actividad } from './entities/actividad.entity';
import { ActividadInstancia } from './entities/actividad-instancia.entity';
import { ActividadMedicamento } from './entities/actividad-medicamento.entity';
import { ActividadTerapia } from './entities/actividad-terapia.entity';
import { CreateActividadDto } from './dto/create-actividad.dto';
import {
  UpdateActividadDto,
  UpdateEstadoActividadDto,
} from './dto/update-actividad.dto';
import { CancelarInstanciaDto } from './dto/cancelar-instancia.dto';

const MAX_MESES = 6;

const ACTIVIDAD_RELATIONS = {
  creadoPor: true,
  pcd: { usuario: true },
  medicamentos: { medicamento: true },
  terapia: { terapia: true },
  instancias: true,
} as const;

@Injectable()
export class ActividadesService {
  constructor(
    @InjectRepository(Actividad)
    private readonly actividadRepo: Repository<Actividad>,
    @InjectRepository(ActividadInstancia)
    private readonly instanciaRepo: Repository<ActividadInstancia>,
    @InjectRepository(Medicamento)
    private readonly medicamentoRepo: Repository<Medicamento>,
    @InjectRepository(Terapia)
    private readonly terapiaRepo: Repository<Terapia>,
    @InjectRepository(Profesional)
    private readonly profesionalRepo: Repository<Profesional>,
    private readonly dataSource: DataSource,
    private readonly vinculoAccess: VinculoAccessService,
  ) {}

  async create(dto: CreateActividadDto, caller: CallerInfo) {
    const fechaInicio = parseLocalDate(dto.fechaInicio);
    const fechaFin = parseLocalDate(dto.fechaFin);

    this.validarFechas(fechaInicio, fechaFin);

    if (
      caller.tipoUsuario === TipoUsuario.TUTOR &&
      dto.tipoActividad === TipoActividad.TERAPIA
    ) {
      throw new ForbiddenException(
        'Los tutores no pueden crear actividades de tipo TERAPIA',
      );
    }

    // Nota: BackendV1/V2 exigían además que el Profesional fuera CABECERA del
    // vínculo. Se eliminó esa restricción (decisión #1 del plan): alcanza con
    // cualquier vínculo ACTIVO, igual criterio que usa Reportes.
    await this.vinculoAccess.assertVinculoActivo(
      caller.id,
      caller.tipoUsuario,
      dto.pcdId,
    );

    if (dto.tipoActividad === TipoActividad.MEDICAMENTO) {
      if (!dto.medicamentos || dto.medicamentos.length === 0) {
        throw new BadRequestException(
          'Las actividades de tipo MEDICAMENTO requieren al menos un medicamento',
        );
      }
      await this.validarMedicamentos(
        dto.medicamentos.map((m) => m.medicamentoId),
      );
    }

    if (dto.tipoActividad === TipoActividad.TERAPIA) {
      const terapia = await this.validarTerapia(dto.terapiaId!);
      await this.assertPuedeUsarTerapia(caller, dto.pcdId, terapia);
    }

    if (dto.frecuencia === FrecuenciaActividad.DIAS_ESPECIFICOS) {
      if (!dto.diasSemana || dto.diasSemana.length === 0) {
        throw new BadRequestException(
          'La frecuencia DIAS_ESPECIFICOS requiere al menos un día en diasSemana',
        );
      }
    }

    const instancias = generarInstancias(
      fechaInicio,
      fechaFin,
      dto.frecuencia,
      dto.diasSemana,
    );

    const actividadId = await this.dataSource.transaction(async (manager) => {
      const actividad = await manager.save(
        manager.create(Actividad, {
          titulo: dto.titulo,
          descripcion: dto.descripcion,
          fechaInicio: formatLocalDate(fechaInicio),
          fechaFin: formatLocalDate(fechaFin),
          horarioInicio: dto.horarioInicio
            ? this.formatTime(parseTime(dto.horarioInicio))
            : null,
          horarioFin: dto.horarioFin
            ? this.formatTime(parseTime(dto.horarioFin))
            : null,
          observaciones: dto.observaciones,
          tipoActividad: dto.tipoActividad,
          frecuencia: dto.frecuencia,
          diasSemana: dto.diasSemana ?? null,
          recordarAntesMinutos: dto.recordarAntesMinutos ?? null,
          creadoPorUserId: caller.id,
          pcdId: dto.pcdId,
        }),
      );

      await manager.save(
        instancias.map((fecha) =>
          manager.create(ActividadInstancia, {
            actividadId: actividad.id,
            fechaProgramada: formatLocalDate(fecha),
          }),
        ),
      );

      if (dto.tipoActividad === TipoActividad.MEDICAMENTO && dto.medicamentos) {
        await manager.save(
          dto.medicamentos.map((m) =>
            manager.create(ActividadMedicamento, {
              actividadId: actividad.id,
              medicamentoId: m.medicamentoId,
              dosis: m.dosis,
              frecuencia: m.frecuencia,
              duracionTratamiento: m.duracionTratamiento,
              indicacion: m.indicacion,
              medicoPrescriptor: m.medicoPrescriptor,
            }),
          ),
        );
      }

      if (dto.tipoActividad === TipoActividad.TERAPIA && dto.terapiaId) {
        await manager.save(
          manager.create(ActividadTerapia, {
            actividadId: actividad.id,
            terapiaId: dto.terapiaId,
          }),
        );
      }

      return actividad.id;
    });

    return this.actividadRepo.findOne({
      where: { id: actividadId },
      relations: ACTIVIDAD_RELATIONS,
    });
  }

  async findAll(
    caller: CallerInfo,
    pcdId?: number,
    estado?: EstadoActividad,
    orden: OrdenActividad = OrdenActividad.CREACION,
  ) {
    const qb = this.actividadRepo
      .createQueryBuilder('actividad')
      .leftJoinAndSelect('actividad.creadoPor', 'creadoPor')
      .leftJoinAndSelect('actividad.pcd', 'pcd')
      .leftJoinAndSelect('pcd.usuario', 'pcdUsuario')
      .leftJoinAndSelect('actividad.medicamentos', 'am')
      .leftJoinAndSelect('am.medicamento', 'medicamento')
      .leftJoinAndSelect('actividad.terapia', 'at')
      .leftJoinAndSelect('at.terapia', 'terapia')
      .leftJoinAndSelect('actividad.instancias', 'instancias')
      .orderBy('actividad.createdAt', 'DESC');

    if (caller.esAdministrador) {
      if (pcdId) qb.andWhere('actividad.pcdId = :pcdId', { pcdId });
    } else if (caller.tipoUsuario === TipoUsuario.PROFESIONAL) {
      // Las propias, y todas las de los PCD de los que es médico de cabecera.
      qb.andWhere(
        `(actividad.creadoPorUserId = :callerId OR EXISTS (
          SELECT 1 FROM vinculos v
          WHERE v.pcdId = actividad.pcdId AND v.profesionalId = :callerId
            AND v.rolProfesional = :cabecera AND v.estado = :activo
        ))`,
        {
          callerId: caller.id,
          cabecera: RolProfesionalVinculo.CABECERA,
          activo: EstadoVinculo.ACTIVO,
        },
      );
      if (pcdId) qb.andWhere('actividad.pcdId = :pcdId', { pcdId });
    } else if (caller.tipoUsuario === TipoUsuario.TUTOR) {
      qb.innerJoin(
        TutorPcd,
        'tp',
        'tp.pcdId = actividad.pcdId AND tp.tutorId = :tutorId AND tp.estado = :activo',
        { tutorId: caller.id, activo: EstadoVinculo.ACTIVO },
      );
      if (pcdId) qb.andWhere('actividad.pcdId = :pcdId', { pcdId });
    } else {
      // PCD: solo las propias.
      qb.andWhere('actividad.pcdId = :callerId', { callerId: caller.id });
    }

    if (estado) qb.andWhere('actividad.estado = :estado', { estado });

    const actividades = await qb.getMany();
    if (orden === OrdenActividad.HORARIO) {
      // MySQL pone los NULL primero en ASC; las sin horario van al final.
      const horario = (a: Actividad) => a.horarioInicio ?? '99:99:99';
      actividades.sort(
        (a, b) =>
          horario(a).localeCompare(horario(b)) ||
          String(a.fechaInicio).localeCompare(String(b.fechaInicio)),
      );
    }
    return actividades;
  }

  async findOne(id: number, caller: CallerInfo) {
    const actividad = await this.actividadRepo.findOne({
      where: { id },
      relations: ACTIVIDAD_RELATIONS,
    });
    if (!actividad) {
      throw new NotFoundException(`Actividad con id ${id} no encontrada`);
    }
    await this.verificarAcceso(actividad, caller);
    return actividad;
  }

  async update(id: number, dto: UpdateActividadDto, caller: CallerInfo) {
    const actividad = await this.findOne(id, caller);

    if (actividad.creadoPorUserId !== caller.id) {
      throw new ForbiddenException(
        'Solo el creador de la actividad puede modificarla',
      );
    }

    if (
      dto.terapiaId !== undefined &&
      actividad.tipoActividad !== TipoActividad.TERAPIA
    ) {
      throw new BadRequestException(
        'Solo se puede modificar la terapia en actividades de tipo TERAPIA',
      );
    }
    if (
      dto.medicamentos !== undefined &&
      actividad.tipoActividad !== TipoActividad.MEDICAMENTO
    ) {
      throw new BadRequestException(
        'Solo se puede modificar medicamentos en actividades de tipo MEDICAMENTO',
      );
    }

    const nuevaFechaInicio = dto.fechaInicio
      ? parseLocalDate(dto.fechaInicio)
      : null;
    const nuevaFechaFin = dto.fechaFin ? parseLocalDate(dto.fechaFin) : null;

    if (nuevaFechaInicio || nuevaFechaFin) {
      const fi = nuevaFechaInicio ?? parseLocalDate(actividad.fechaInicio);
      const ff = nuevaFechaFin ?? parseLocalDate(actividad.fechaFin);
      this.validarFechas(fi, ff);
    }

    // Solo cuenta como cambio si la fecha es distinta de la guardada: el
    // formulario de edición manda siempre las dos fechas.
    const cambiaFechas =
      (nuevaFechaInicio !== null &&
        formatLocalDate(nuevaFechaInicio) !==
          formatLocalDate(parseLocalDate(actividad.fechaInicio))) ||
      (nuevaFechaFin !== null &&
        formatLocalDate(nuevaFechaFin) !==
          formatLocalDate(parseLocalDate(actividad.fechaFin)));
    const cambiaFrecuencia =
      dto.frecuencia !== undefined &&
      (dto.frecuencia !== actividad.frecuencia ||
        JSON.stringify(dto.diasSemana) !==
          JSON.stringify(actividad.diasSemana));

    if (dto.terapiaId !== undefined) {
      const terapia = await this.validarTerapia(dto.terapiaId);
      await this.assertPuedeUsarTerapia(caller, actividad.pcdId, terapia);
    }
    if (dto.medicamentos !== undefined) {
      await this.validarMedicamentos(
        dto.medicamentos.map((m) => m.medicamentoId),
      );
    }

    await this.dataSource.transaction(async (manager) => {
      if (cambiaFechas || cambiaFrecuencia) {
        await this.regenerarSesiones(
          manager,
          id,
          nuevaFechaInicio ?? parseLocalDate(actividad.fechaInicio),
          nuevaFechaFin ?? parseLocalDate(actividad.fechaFin),
          dto.frecuencia ?? actividad.frecuencia,
          dto.diasSemana ?? actividad.diasSemana ?? undefined,
        );
      }

      if (dto.terapiaId !== undefined) {
        await manager.delete(ActividadTerapia, { actividadId: id });
        await manager.save(
          manager.create(ActividadTerapia, {
            actividadId: id,
            terapiaId: dto.terapiaId,
          }),
        );
      }

      if (dto.medicamentos !== undefined) {
        await manager.delete(ActividadMedicamento, { actividadId: id });
        if (dto.medicamentos.length > 0) {
          await manager.save(
            dto.medicamentos.map((m) =>
              manager.create(ActividadMedicamento, {
                actividadId: id,
                medicamentoId: m.medicamentoId,
                dosis: m.dosis,
                frecuencia: m.frecuencia,
                duracionTratamiento: m.duracionTratamiento,
                indicacion: m.indicacion,
                medicoPrescriptor: m.medicoPrescriptor,
              }),
            ),
          );
        }
      }

      await manager.update(Actividad, id, {
        ...(dto.titulo !== undefined && { titulo: dto.titulo }),
        ...(dto.descripcion !== undefined && { descripcion: dto.descripcion }),
        ...(nuevaFechaInicio && {
          fechaInicio: formatLocalDate(nuevaFechaInicio),
        }),
        ...(nuevaFechaFin && { fechaFin: formatLocalDate(nuevaFechaFin) }),
        ...(dto.horarioInicio !== undefined && {
          horarioInicio: this.formatTime(parseTime(dto.horarioInicio)),
        }),
        ...(dto.horarioFin !== undefined && {
          horarioFin: this.formatTime(parseTime(dto.horarioFin)),
        }),
        ...(dto.observaciones !== undefined && {
          observaciones: dto.observaciones,
        }),
        ...(dto.frecuencia !== undefined && { frecuencia: dto.frecuencia }),
        ...(dto.diasSemana !== undefined && { diasSemana: dto.diasSemana }),
        ...(dto.recordarAntesMinutos !== undefined && {
          recordarAntesMinutos: dto.recordarAntesMinutos,
        }),
      });
    });

    return this.actividadRepo.findOne({
      where: { id },
      relations: ACTIVIDAD_RELATIONS,
    });
  }

  async updateEstado(
    id: number,
    dto: UpdateEstadoActividadDto,
    caller: CallerInfo,
  ) {
    const actividad = await this.findOne(id, caller);

    if (actividad.creadoPorUserId !== caller.id) {
      throw new ForbiddenException(
        'Solo el creador de la actividad puede cambiar su estado',
      );
    }

    if (dto.estado === EstadoActividad.COMPLETADA) {
      const pendientes = await this.instanciaRepo.count({
        where: { actividadId: id, estado: EstadoInstancia.PENDIENTE },
      });
      if (pendientes > 0) {
        throw new BadRequestException(
          `La actividad tiene ${pendientes} instancia(s) pendiente(s). Confirmá todas antes de completarla`,
        );
      }
    }

    await this.actividadRepo.update(id, { estado: dto.estado });
    return this.actividadRepo.findOne({
      where: { id },
      relations: ACTIVIDAD_RELATIONS,
    });
  }

  async remove(id: number, caller: CallerInfo) {
    const actividad = await this.findOne(id, caller);

    if (actividad.creadoPorUserId !== caller.id) {
      throw new ForbiddenException(
        'Solo el creador de la actividad puede eliminarla',
      );
    }

    await this.actividadRepo.delete(id);
    return { message: `Actividad ${id} eliminada correctamente` };
  }

  async findInstancias(actividadId: number, caller: CallerInfo) {
    await this.findOne(actividadId, caller);
    return this.instanciaRepo.find({
      where: { actividadId },
      order: { fechaProgramada: 'ASC' },
      relations: { confirmedBy: true, canceledBy: true },
    });
  }

  async confirmarInstancia(
    actividadId: number,
    instanciaId: number,
    caller: CallerInfo,
  ) {
    const actividad = await this.findOne(actividadId, caller);

    // El cabecera lee las actividades de sus pacientes, pero no las confirma.
    if (
      caller.tipoUsuario === TipoUsuario.PROFESIONAL &&
      !caller.esAdministrador &&
      actividad.creadoPorUserId !== caller.id
    ) {
      throw new ForbiddenException(
        'Solo el creador de la actividad puede confirmar sus sesiones',
      );
    }

    if (
      caller.tipoUsuario === TipoUsuario.TUTOR &&
      actividad.tipoActividad === TipoActividad.TERAPIA
    ) {
      throw new ForbiddenException(
        'Los tutores no pueden confirmar actividades de tipo TERAPIA',
      );
    }

    const instancia = await this.findInstanciaOrFail(actividadId, instanciaId);
    if (instancia.estado === EstadoInstancia.REALIZADA) {
      throw new BadRequestException('La instancia ya fue confirmada');
    }
    if (instancia.estado === EstadoInstancia.CANCELADA) {
      throw new BadRequestException(
        'No se puede confirmar una instancia cancelada',
      );
    }

    await this.instanciaRepo.update(instanciaId, {
      estado: EstadoInstancia.REALIZADA,
      confirmedAt: new Date(),
      confirmedByUserId: caller.id,
    });
    return this.instanciaRepo.findOne({ where: { id: instanciaId } });
  }

  /**
   * Nuevo en BackendV3 (decisión #4 del plan): BackendV1/V2 nunca implementaron
   * ninguna transición hacia EstadoInstancia.CANCELADA pese a reservar el valor
   * en el enum. Solo el creador de la actividad puede cancelar —
   * mismo criterio de autorización que update/remove/updateEstado.
   */
  async cancelarInstancia(
    actividadId: number,
    instanciaId: number,
    dto: CancelarInstanciaDto,
    caller: CallerInfo,
  ) {
    const actividad = await this.findOne(actividadId, caller);

    if (actividad.creadoPorUserId !== caller.id) {
      throw new ForbiddenException(
        'Solo el creador de la actividad puede cancelar una instancia',
      );
    }

    const instancia = await this.findInstanciaOrFail(actividadId, instanciaId);
    if (instancia.estado !== EstadoInstancia.PENDIENTE) {
      throw new BadRequestException(
        'Solo se puede cancelar una instancia que esté PENDIENTE',
      );
    }

    await this.instanciaRepo.update(instanciaId, {
      estado: EstadoInstancia.CANCELADA,
      canceledAt: new Date(),
      canceledByUserId: caller.id,
      motivoCancelacion: dto.motivo ?? null,
    });
    return this.instanciaRepo.findOne({ where: { id: instanciaId } });
  }

  /**
   * Ajusta las sesiones al nuevo calendario sin tocar las ya resueltas:
   * - Las REALIZADAS y CANCELADAS quedan como están.
   * - Las PENDIENTES que siguen en el calendario se conservan (también las de
   *   días que ya pasaron y nadie confirmó), con su id, así no se pierden los
   *   reportes que las referencian.
   * - Las PENDIENTES que quedan fuera se borran.
   * - Se crean las fechas del calendario nuevo que todavía no tienen sesión.
   * Antes se borraban todas las PENDIENTES y se regeneraban solo desde hoy,
   * así que las pendientes de días pasados desaparecían al editar.
   */
  private async regenerarSesiones(
    manager: EntityManager,
    actividadId: number,
    fechaInicio: Date,
    fechaFin: Date,
    frecuencia: FrecuenciaActividad,
    diasSemana?: string[],
  ) {
    const esperadas = new Set(
      generarInstancias(fechaInicio, fechaFin, frecuencia, diasSemana).map(
        formatLocalDate,
      ),
    );
    const actuales = await manager.find(ActividadInstancia, {
      where: { actividadId },
    });
    const fechaDe = (i: ActividadInstancia) =>
      String(i.fechaProgramada).slice(0, 10);

    const sobran = actuales.filter(
      (i) =>
        i.estado === EstadoInstancia.PENDIENTE && !esperadas.has(fechaDe(i)),
    );
    if (sobran.length > 0) {
      const ids = sobran.map((i) => i.id);
      const conReporte = await manager.count(ReporteProgreso, {
        where: { instanciaId: In(ids) },
      });
      if (conReporte > 0) {
        throw new ConflictException(
          'Hay sesiones pendientes con reportes cargados que quedarían fuera del nuevo calendario. Eliminá o reasigná esos reportes antes de cambiar las fechas o la frecuencia',
        );
      }
      await manager.delete(ActividadInstancia, { id: In(ids) });
    }

    const ocupadas = new Set(actuales.map(fechaDe));
    const nuevas = [...esperadas].filter((f) => !ocupadas.has(f));
    if (nuevas.length > 0) {
      await manager.save(
        nuevas.map((fecha) =>
          manager.create(ActividadInstancia, {
            actividadId,
            fechaProgramada: fecha,
          }),
        ),
      );
    }
  }

  private async findInstanciaOrFail(actividadId: number, instanciaId: number) {
    const instancia = await this.instanciaRepo.findOne({
      where: { id: instanciaId },
    });
    if (!instancia || instancia.actividadId !== actividadId) {
      throw new NotFoundException(
        `Instancia ${instanciaId} no encontrada en la actividad ${actividadId}`,
      );
    }
    return instancia;
  }

  private validarFechas(fechaInicio: Date, fechaFin: Date) {
    if (fechaFin <= fechaInicio) {
      throw new BadRequestException(
        'La fecha de fin debe ser posterior a la fecha de inicio',
      );
    }
    const maxFin = new Date(fechaInicio);
    maxFin.setMonth(maxFin.getMonth() + MAX_MESES);
    if (fechaFin > maxFin) {
      throw new BadRequestException(
        `La fecha de fin no puede superar los ${MAX_MESES} meses desde el inicio`,
      );
    }
  }

  private async validarMedicamentos(ids: number[]) {
    const encontrados = await this.medicamentoRepo.find({
      where: { id: In(ids) },
      select: { id: true },
    });
    if (encontrados.length !== ids.length) {
      throw new BadRequestException(
        'Uno o más medicamentos no existen en el catálogo',
      );
    }
  }

  private async validarTerapia(id: number) {
    const terapia = await this.terapiaRepo.findOne({ where: { id } });
    if (!terapia) {
      throw new BadRequestException(
        `La terapia con id ${id} no existe en el catálogo`,
      );
    }
    return terapia;
  }

  /**
   * El médico de cabecera del PCD programa cualquier terapia; un especialista,
   * solo las de su especialidad (las terapias sin especialidad quedan para el
   * cabecera). El Administrador no tiene restricción.
   */
  private async assertPuedeUsarTerapia(
    caller: CallerInfo,
    pcdId: number,
    terapia: Terapia,
  ) {
    if (caller.esAdministrador) return;
    if (await this.vinculoAccess.esCabeceraActivo(caller.id, pcdId)) return;
    const profesional = await this.profesionalRepo.findOne({
      where: { userId: caller.id },
    });
    if (
      !profesional ||
      terapia.especialidadId == null ||
      terapia.especialidadId !== profesional.especialidadId
    ) {
      throw new ForbiddenException(
        'Solo podés programar terapias de tu especialidad; las demás las programa el médico de cabecera',
      );
    }
  }

  /**
   * Corrección respecto de BackendV1/V2:
   * el Tutor ya NO tiene acceso automático a cualquier actividad por ID — se
   * revalida el vínculo activo en vivo, igual que ya hacía ReportesService.
   */
  private async verificarAcceso(
    actividad: { creadoPorUserId: number; pcdId: number },
    caller: CallerInfo,
  ) {
    if (caller.esAdministrador) return;
    if (caller.tipoUsuario === TipoUsuario.PROFESIONAL) {
      if (actividad.creadoPorUserId === caller.id) return;
      // El médico de cabecera ve todas las actividades de sus pacientes.
      if (
        await this.vinculoAccess.esCabeceraActivo(caller.id, actividad.pcdId)
      ) {
        return;
      }
    }
    if (
      caller.tipoUsuario === TipoUsuario.PCD &&
      actividad.pcdId === caller.id
    ) {
      return;
    }
    if (caller.tipoUsuario === TipoUsuario.TUTOR) {
      await this.vinculoAccess.assertVinculoActivo(
        caller.id,
        TipoUsuario.TUTOR,
        actividad.pcdId,
      );
      return;
    }
    throw new ForbiddenException('No tenés acceso a esta actividad');
  }

  private formatTime(date: Date): string {
    const hh = String(date.getHours()).padStart(2, '0');
    const mm = String(date.getMinutes()).padStart(2, '0');
    return `${hh}:${mm}:00`;
  }
}

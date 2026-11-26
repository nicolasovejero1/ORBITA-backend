import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  IsNull,
  LessThanOrEqual,
  MoreThanOrEqual,
  Not,
  Repository,
} from 'typeorm';
import { ActividadInstancia } from '../actividades/entities/actividad-instancia.entity';
import { Notificacion } from './entities/notificacion.entity';
import { EstadoInstancia } from '../common/enums/estado-instancia.enum';
import { EstadoVinculo } from '../common/enums/estado-vinculo.enum';
import { EstadoNotificacion } from '../common/enums/estado-notificacion.enum';
import { TipoNotificacion } from '../common/enums/tipo-notificacion.enum';
import { formatLocalDate, parseLocalDate } from '../common/utils/date.utils';
import { PushService } from './push.service';

const TIPO_RECORDATORIO = TipoNotificacion.RECORDATORIO;
const TIPO_ALERTA = TipoNotificacion.ALERTA;

/** Cuánto tiempo se reintenta el push de una notificación que quedó PENDIENTE. */
const VENTANA_REINTENTO_MS = 60 * 60_000;

const RECORDATORIO_RELATIONS = {
  actividad: {
    creadoPor: true,
    pcd: {
      usuario: true,
      tutorPcds: { tutor: { usuario: true } },
      vinculos: { profesional: { usuario: true } },
    },
  },
} as const;

const VENCIDA_RELATIONS = {
  actividad: {
    pcd: {
      usuario: true,
      tutorPcds: { tutor: { usuario: true } },
    },
  },
} as const;

@Injectable()
export class RecordatoriosService {
  private readonly logger = new Logger(RecordatoriosService.name);

  constructor(
    @InjectRepository(ActividadInstancia)
    private readonly instanciaRepo: Repository<ActividadInstancia>,
    @InjectRepository(Notificacion)
    private readonly notificacionRepo: Repository<Notificacion>,
    private readonly push: PushService,
  ) {}

  /** Cron: cada minuto evalúa las instancias pendientes de hoy y dispara recordatorios. */
  @Cron(CronExpression.EVERY_MINUTE)
  async generarPorCron(): Promise<void> {
    try {
      const creadas = await this.ejecutar();
      if (creadas > 0) {
        this.logger.log(
          `Se generaron ${creadas} notificaciones de recordatorio`,
        );
      }
    } catch (error) {
      this.logger.error('Error al generar recordatorios', error as Error);
    }
  }

  /** Cron: alerta "crítica" cuando una instancia pendiente ya pasó su horario. */
  @Cron(CronExpression.EVERY_MINUTE)
  async revisarPorCron(): Promise<void> {
    try {
      const creadas = await this.ejecutarVencidas();
      if (creadas > 0) {
        this.logger.log(
          `Se generaron ${creadas} alertas de actividad no realizada`,
        );
      }
    } catch (error) {
      this.logger.error(
        'Error al generar alertas de actividad vencida',
        error as Error,
      );
    }
  }

  /** Cron: reintenta el push de las notificaciones que quedaron PENDIENTE. */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async reintentarPorCron(): Promise<void> {
    try {
      const enviadas = await this.reintentarPendientes();
      if (enviadas > 0) {
        this.logger.log(`Se reenviaron ${enviadas} notificaciones pendientes`);
      }
    } catch (error) {
      this.logger.error('Error al reintentar notificaciones', error as Error);
    }
  }

  /**
   * Reintenta el push de las notificaciones PENDIENTE de la última hora (por
   * ejemplo, porque el usuario todavía no tenía token o Expo falló). Pasada la
   * hora ya no tiene sentido avisar y quedan PENDIENTE como registro.
   */
  async reintentarPendientes(): Promise<number> {
    const pendientes = await this.notificacionRepo.find({
      where: {
        estado: EstadoNotificacion.PENDIENTE,
        createdAt: MoreThanOrEqual(new Date(Date.now() - VENTANA_REINTENTO_MS)),
      },
      order: { createdAt: 'ASC' },
      take: 200,
    });
    return this.push.enviarNotificaciones(pendientes);
  }

  /** Genera alerta si una instancia siguió PENDIENTE después de su horario. */
  async ejecutarVencidas(): Promise<number> {
    const hoy = formatLocalDate(new Date());

    const instancias = await this.instanciaRepo.find({
      where: {
        estado: EstadoInstancia.PENDIENTE,
        fechaProgramada: LessThanOrEqual(hoy),
      },
      take: 100,
      relations: VENCIDA_RELATIONS,
    });

    const ahora = new Date();
    let creadas = 0;

    for (const instancia of instancias) {
      const vencida = this.calcularDisparo(instancia, 0);
      if (ahora < vencida) continue;

      const yaAlertada = await this.notificacionRepo.findOne({
        where: { instanciaId: instancia.id, tipo: TIPO_ALERTA },
        select: { id: true },
      });
      if (yaAlertada) continue;

      const destinatarios = this.destinatariosVencida(instancia);
      if (destinatarios.length === 0) continue;

      const mensaje = `Actividad no realizada: «${instancia.actividad.titulo}» (${this.formatFecha(instancia.fechaProgramada)}).`;

      const guardadas = await this.notificacionRepo.save(
        destinatarios.map((usuarioId) =>
          this.notificacionRepo.create({
            usuarioId,
            tipo: TIPO_ALERTA,
            mensaje,
            estado: EstadoNotificacion.PENDIENTE,
            actividadId: instancia.actividad.id,
            instanciaId: instancia.id,
          }),
        ),
      );
      await this.push.enviarNotificaciones(guardadas);
      creadas += destinatarios.length;
    }

    return creadas;
  }

  /**
   * Genera notificaciones tipo RECORDATORIO (PENDIENTE hasta que Expo acepta el push) para las instancias
   * pendientes de hoy cuya actividad tiene configurado recordarAntesMinutos.
   * Devuelve la cantidad de notificaciones creadas. Reusable desde un endpoint.
   */
  async ejecutar(): Promise<number> {
    const hoy = formatLocalDate(new Date());

    const instancias = await this.instanciaRepo.find({
      where: {
        estado: EstadoInstancia.PENDIENTE,
        fechaProgramada: hoy,
        actividad: { recordarAntesMinutos: Not(IsNull()) },
      },
      relations: RECORDATORIO_RELATIONS,
    });

    const ahora = new Date();
    let creadas = 0;

    for (const instancia of instancias) {
      const lead = instancia.actividad.recordarAntesMinutos ?? 0;
      const disparo = this.calcularDisparo(instancia, lead);

      if (ahora < disparo) continue;

      const yaEnviada = await this.notificacionRepo.findOne({
        where: { instanciaId: instancia.id, tipo: TIPO_RECORDATORIO },
        select: { id: true },
      });
      if (yaEnviada) continue;

      const destinatarios = this.listarDestinatarios(instancia);
      if (destinatarios.length === 0) continue;

      const hora = this.formatearHora(instancia.actividad.horarioInicio);
      const nombrePcd = `${instancia.actividad.pcd.usuario.nombre} ${instancia.actividad.pcd.usuario.apellido}`;
      const mensaje = `Recordatorio: «${instancia.actividad.titulo}»${
        hora ? ` a las ${hora}` : ''
      } (${nombrePcd}).`;

      const guardadas = await this.notificacionRepo.save(
        destinatarios.map((usuarioId) =>
          this.notificacionRepo.create({
            usuarioId,
            tipo: TIPO_RECORDATORIO,
            mensaje,
            estado: EstadoNotificacion.PENDIENTE,
            actividadId: instancia.actividad.id,
            instanciaId: instancia.id,
          }),
        ),
      );
      await this.push.enviarNotificaciones(guardadas);
      creadas += destinatarios.length;
    }

    return creadas;
  }

  private calcularDisparo(
    instancia: {
      fechaProgramada: string;
      actividad: { horarioInicio?: string | null };
    },
    leadMinutos: number,
  ): Date {
    // fechaProgramada llega como 'YYYY-MM-DD' (columna `date` de TypeORM+mysql2,
    // no un `Date`) — parseLocalDate evita el corrimiento de huso horario que
    // tendría `new Date('YYYY-MM-DD')` (que interpreta la fecha como UTC).
    const disparo = parseLocalDate(instancia.fechaProgramada);
    const hora = instancia.actividad.horarioInicio;
    if (hora) {
      const [hh, mm] = hora.split(':').map(Number);
      disparo.setHours(hh, mm, 0, 0);
    }
    disparo.setTime(disparo.getTime() - leadMinutos * 60_000);
    return disparo;
  }

  private listarDestinatarios(instancia: {
    actividad: {
      pcd: {
        usuario: { id: number };
        tutorPcds: {
          estado: EstadoVinculo;
          tutor: { usuario: { id: number } };
        }[];
        vinculos: {
          estado: EstadoVinculo;
          profesional: { usuario: { id: number } };
        }[];
      };
    };
  }): number[] {
    const ids = new Set<number>();
    const { pcd } = instancia.actividad;
    ids.add(pcd.usuario.id);
    for (const t of pcd.tutorPcds) {
      if (t.estado === EstadoVinculo.ACTIVO) ids.add(t.tutor.usuario.id);
    }
    for (const v of pcd.vinculos) {
      if (v.estado === EstadoVinculo.ACTIVO) ids.add(v.profesional.usuario.id);
    }
    return Array.from(ids).filter((id) => Number.isInteger(id));
  }

  private formatearHora(hora?: string | null): string | null {
    if (!hora) return null;
    const [hh, mm] = hora.split(':');
    return `${hh}:${mm}`;
  }

  private destinatariosVencida(instancia: {
    actividad: {
      pcd: {
        usuario: { id: number };
        tutorPcds: {
          estado: EstadoVinculo;
          tutor: { usuario: { id: number } };
        }[];
      };
    };
  }): number[] {
    const ids = new Set<number>();
    const { pcd } = instancia.actividad;
    ids.add(pcd.usuario.id);
    for (const t of pcd.tutorPcds) {
      if (t.estado === EstadoVinculo.ACTIVO) ids.add(t.tutor.usuario.id);
    }
    return Array.from(ids).filter((id) => Number.isInteger(id));
  }

  private formatFecha(fecha: string): string {
    return parseLocalDate(fecha).toLocaleDateString('es-Ar', {
      day: 'numeric',
      month: 'short',
    });
  }
}

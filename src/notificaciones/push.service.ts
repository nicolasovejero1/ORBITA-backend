import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Expo, ExpoPushMessage, ExpoPushToken } from 'expo-server-sdk';
import { In, Not, IsNull, Repository } from 'typeorm';
import { Usuario } from '../users/entities/usuario.entity';
import { EstadoNotificacion } from '../common/enums/estado-notificacion.enum';
import { TipoNotificacion } from '../common/enums/tipo-notificacion.enum';
import { Notificacion } from './entities/notificacion.entity';

export function tituloPush(tipo: TipoNotificacion): string {
  if (tipo === TipoNotificacion.RECORDATORIO) return 'Recordatorio';
  if (tipo === TipoNotificacion.ALERTA) return 'Alerta';
  return 'Notificación';
}

interface DestinatarioPush {
  usuarioId: number;
  /** Si viene, `enviar` lo devuelve cuando Expo aceptó el push. */
  notificacionId?: number;
  titulo: string;
  mensaje: string;
  data?: Record<string, unknown>;
}

@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);
  private readonly expo = new Expo();

  constructor(
    @InjectRepository(Usuario)
    private readonly usuarioRepo: Repository<Usuario>,
    @InjectRepository(Notificacion)
    private readonly notificacionRepo: Repository<Notificacion>,
  ) {}

  /**
   * Manda el push de cada notificación y marca ENVIADA las que Expo aceptó.
   * Las que no (sin token, token inválido o error de Expo) quedan PENDIENTE y
   * las reintenta `RecordatoriosService.reintentarPendientes`.
   * Devuelve cuántas quedaron ENVIADA. No lanza si Expo falla.
   */
  async enviarNotificaciones(notificaciones: Notificacion[]): Promise<number> {
    if (notificaciones.length === 0) return 0;
    const aceptadas = await this.enviar(
      notificaciones.map((n) => ({
        usuarioId: n.usuarioId,
        notificacionId: n.id,
        titulo: tituloPush(n.tipo),
        mensaje: n.mensaje,
      })),
    );
    if (aceptadas.length > 0) {
      await this.notificacionRepo.update(
        { id: In(aceptadas), estado: EstadoNotificacion.PENDIENTE },
        { estado: EstadoNotificacion.ENVIADA },
      );
    }
    return aceptadas.length;
  }

  /**
   * Envía un push a cada destinatario que tenga un token registrado. No lanza
   * si Expo falla. Devuelve los `notificacionId` cuyo push Expo aceptó.
   */
  async enviar(destinatarios: DestinatarioPush[]): Promise<number[]> {
    if (destinatarios.length === 0) return [];

    const usuarios = await this.usuarioRepo.find({
      where: {
        id: In(destinatarios.map((d) => d.usuarioId)),
        pushToken: Not(IsNull()),
      },
      select: { id: true, pushToken: true },
    });
    const tokenPorUsuario = new Map(
      usuarios.map((u) => [u.id, u.pushToken as string]),
    );

    const mensajes: ExpoPushMessage[] = [];
    const destinoDeMensaje: DestinatarioPush[] = [];
    for (const dest of destinatarios) {
      const token = tokenPorUsuario.get(dest.usuarioId);
      if (!token || !Expo.isExpoPushToken(token)) continue;
      mensajes.push({
        to: token,
        sound: 'default',
        title: dest.titulo,
        body: dest.mensaje,
        data: dest.data ?? {},
      });
      destinoDeMensaje.push(dest);
    }
    if (mensajes.length === 0) return [];

    const aceptadas: number[] = [];
    let desde = 0;
    const chunks = this.expo.chunkPushNotifications(mensajes);
    for (const chunk of chunks) {
      try {
        const tickets = await this.expo.sendPushNotificationsAsync(chunk);
        await this.limpiarTokensInvalidos(chunk, tickets);
        tickets.forEach((ticket, i) => {
          const id = destinoDeMensaje[desde + i]?.notificacionId;
          if (ticket.status === 'ok' && id !== undefined) aceptadas.push(id);
        });
      } catch (error) {
        this.logger.error('Error enviando push notifications', error as Error);
      }
      desde += chunk.length;
    }
    return aceptadas;
  }

  private async limpiarTokensInvalidos(
    chunk: ExpoPushMessage[],
    tickets: Awaited<ReturnType<Expo['sendPushNotificationsAsync']>>,
  ) {
    for (let i = 0; i < tickets.length; i++) {
      const ticket = tickets[i];
      if (ticket.status !== 'error') continue;
      if (ticket.details?.error !== 'DeviceNotRegistered') continue;
      const token = chunk[i].to as ExpoPushToken;
      await this.usuarioRepo.update({ pushToken: token }, { pushToken: null });
    }
  }
}

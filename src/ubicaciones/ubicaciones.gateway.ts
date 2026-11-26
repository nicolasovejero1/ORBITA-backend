import { Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Subscription } from 'rxjs';
import type { Namespace, Socket } from 'socket.io';
import { Repository } from 'typeorm';
import type { CallerInfo } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/strategies/jwt.strategy';
import { EstadoUsuario } from '../common/enums/estado-usuario.enum';
import { TipoUsuario } from '../common/enums/tipo-usuario.enum';
import { parseCorsOrigins } from '../common/utils/cors.utils';
import { Usuario } from '../users/entities/usuario.entity';
import { Ubicacion } from './entities/ubicacion.entity';
import { UbicacionesEvents } from './ubicaciones.events';
import { UbicacionesService } from './ubicaciones.service';

interface DatosSocket {
  usuario?: CallerInfo;
  /** Corta la conexión cuando vence el token con el que se conectó. */
  vencimiento?: NodeJS.Timeout;
}

type SocketUbicaciones = Socket;

const datos = (client: SocketUbicaciones) => client.data as DatosSocket;

const sala = (pcdId: number) => `pcd:${pcdId}`;

/**
 * Ubicación en vivo. El PCD sigue enviando su posición por HTTP
 * (`POST /ubicaciones`, que funciona con la app en segundo plano); este canal
 * solo reparte cada posición nueva a quienes la están mirando.
 *
 * - Se conecta con el token de acceso en `auth.token`; si no es válido, el
 *   cliente recibe `connect_error` con el mensaje `no-autorizado`. Cuando ese
 *   token vence se corta la conexión (`io server disconnect`) y el cliente
 *   renueva y se vuelve a conectar.
 * - `suscribir { pcdId }` aplica la misma regla que `GET /ubicaciones/pcd/:id/ultima`.
 * - Cuando el PCD revoca un acceso, el usuario sale de la sala al instante.
 */
@WebSocketGateway({
  namespace: '/ubicaciones',
  cors: { origin: parseCorsOrigins(process.env.CORS_ORIGINS) },
})
export class UbicacionesGateway
  implements
    OnGatewayInit,
    OnGatewayConnection,
    OnGatewayDisconnect,
    OnModuleDestroy
{
  private readonly logger = new Logger(UbicacionesGateway.name);
  private readonly suscripciones: Subscription[] = [];

  @WebSocketServer()
  private server: Namespace;

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    @InjectRepository(Usuario)
    private readonly usuarioRepo: Repository<Usuario>,
    private readonly ubicaciones: UbicacionesService,
    private readonly events: UbicacionesEvents,
  ) {}

  afterInit(server: Namespace) {
    // Se autentica antes de dar por establecida la conexión: así, cuando el
    // cliente recibe `connect`, el usuario ya está identificado.
    server.use((socket, next) => {
      this.autenticar(socket).then(
        () => next(),
        () => next(new Error('no-autorizado')),
      );
    });
    this.suscripciones.push(
      this.events.nueva$.subscribe((u) => this.repartir(u)),
      this.events.revocada$.subscribe((r) => void this.expulsar(r)),
    );
  }

  onModuleDestroy() {
    this.suscripciones.forEach((s) => s.unsubscribe());
  }

  handleConnection() {}

  handleDisconnect(client: SocketUbicaciones) {
    clearTimeout(datos(client).vencimiento);
  }

  private async autenticar(client: SocketUbicaciones) {
    const token = this.tokenDe(client);
    if (!token) throw new Error('falta el token');
    const payload = await this.jwt.verifyAsync<JwtPayload & { exp: number }>(
      token,
      { secret: this.config.get<string>('JWT_SECRET') },
    );
    const usuario = await this.usuarioRepo.findOne({
      where: { id: payload.sub },
    });
    if (!usuario || usuario.estado === EstadoUsuario.INACTIVO) {
      throw new Error('usuario no autorizado');
    }
    datos(client).usuario = {
      id: usuario.id,
      email: usuario.email,
      tipoUsuario: usuario.tipoUsuario,
      esAdministrador:
        usuario.tipoUsuario === TipoUsuario.ADMINISTRADOR ||
        usuario.esAdministrador,
    };
    const msRestantes = payload.exp * 1000 - Date.now();
    datos(client).vencimiento = setTimeout(
      () => client.disconnect(true),
      Math.max(msRestantes, 0),
    );
  }

  @SubscribeMessage('suscribir')
  async suscribir(
    @ConnectedSocket() client: SocketUbicaciones,
    @MessageBody() body: { pcdId?: unknown },
  ): Promise<{ ok: boolean; error?: string }> {
    const usuario = datos(client).usuario;
    const pcdId = Number(body?.pcdId);
    if (!usuario) return { ok: false, error: 'no-autorizado' };
    if (!Number.isInteger(pcdId) || pcdId < 1) {
      return { ok: false, error: 'pcdId-invalido' };
    }
    try {
      await this.ubicaciones.verificarAccesoLectura(pcdId, usuario);
    } catch {
      return { ok: false, error: 'sin-acceso' };
    }
    await client.join(sala(pcdId));
    return { ok: true };
  }

  @SubscribeMessage('desuscribir')
  async desuscribir(
    @ConnectedSocket() client: SocketUbicaciones,
    @MessageBody() body: { pcdId?: unknown },
  ): Promise<{ ok: boolean }> {
    const pcdId = Number(body?.pcdId);
    if (Number.isInteger(pcdId)) await client.leave(sala(pcdId));
    return { ok: true };
  }

  private repartir(u: Ubicacion) {
    this.server?.to(sala(u.pcdId)).emit('ubicacion:nueva', {
      id: u.id,
      pcdId: u.pcdId,
      latitud: u.latitud,
      longitud: u.longitud,
      precision: u.precision ?? null,
      fechaHora: u.fechaHora,
    });
  }

  /** Saca de la sala a los sockets del usuario al que se le revocó el acceso. */
  private async expulsar({
    usuarioId,
    pcdId,
  }: {
    usuarioId: number;
    pcdId: number;
  }) {
    try {
      const sockets = await this.server.in(sala(pcdId)).fetchSockets();
      for (const s of sockets) {
        if ((s.data as DatosSocket).usuario?.id !== usuarioId) continue;
        s.leave(sala(pcdId));
        s.emit('acceso:revocado', { pcdId });
      }
    } catch (error) {
      this.logger.error(
        'No se pudo quitar al usuario de la sala',
        error as Error,
      );
    }
  }

  private tokenDe(client: SocketUbicaciones): string | undefined {
    const auth = client.handshake.auth as { token?: unknown } | undefined;
    if (typeof auth?.token === 'string') return auth.token;
    const header = client.handshake.headers.authorization;
    return header?.startsWith('Bearer ') ? header.slice(7) : undefined;
  }
}

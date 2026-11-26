/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-call -- res.body y app.getHttpServer() de supertest no están tipados */
import { INestApplication } from '@nestjs/common';
import type { AddressInfo } from 'net';
import request from 'supertest';
import { io, Socket } from 'socket.io-client';
import { createTestApp } from './utils/create-test-app';
import {
  authHeader,
  crearTutorPcd,
  crearUsuario,
  login,
} from './utils/fixtures';
import { TipoUsuario } from '../src/common/enums/tipo-usuario.enum';

/** Ubicación en vivo (socket.io, namespace /ubicaciones). */
describe('Ubicaciones en vivo (e2e)', () => {
  let app: INestApplication;
  let url: string;
  let pcdToken: string;
  let pcdId: number;
  let tutorToken: string;
  let tutorId: number;
  let ajenoToken: string;
  let adminToken: string;
  const sockets: Socket[] = [];

  const conectar = (token?: string): Socket => {
    const socket = io(`${url}/ubicaciones`, {
      auth: token ? { token } : {},
      transports: ['websocket'],
      forceNew: true,
      reconnection: false,
    });
    sockets.push(socket);
    return socket;
  };
  const conectado = (socket: Socket) =>
    new Promise<void>((resolve, reject) => {
      socket.once('connect', () => resolve());
      socket.once('connect_error', reject);
    });
  const evento = <T>(socket: Socket, nombre: string, ms = 2000) =>
    new Promise<T>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error(`no llegó "${nombre}"`)),
        ms,
      );
      socket.once(nombre, (dato: T) => {
        clearTimeout(timer);
        resolve(dato);
      });
    });
  const suscribir = (socket: Socket, id: number) =>
    socket.emitWithAck('suscribir', { pcdId: id }) as Promise<{
      ok: boolean;
      error?: string;
    }>;
  const registrar = (lat: number) =>
    request(app.getHttpServer())
      .post('/ubicaciones')
      .set(...authHeader(pcdToken))
      .send({ latitud: lat, longitud: -58.38, precision: 10 });
  const compartir = (usuarioId: number) =>
    request(app.getHttpServer())
      .post('/ubicaciones/compartidos')
      .set(...authHeader(pcdToken))
      .send({ usuarioId });

  beforeAll(async () => {
    app = await createTestApp();
    await app.listen(0);
    url = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`;

    const pcd = await crearUsuario(app, {
      email: 'socket.pcd@e2e.com',
      tipoUsuario: TipoUsuario.PCD,
    });
    pcdId = pcd.id;
    pcdToken = await login(app, pcd.email);

    const tutor = await crearUsuario(app, {
      email: 'socket.tutor@e2e.com',
      tipoUsuario: TipoUsuario.TUTOR,
    });
    tutorId = tutor.id;
    await crearTutorPcd(app, tutor.id, pcdId);
    tutorToken = await login(app, tutor.email);

    const ajeno = await crearUsuario(app, {
      email: 'socket.ajeno@e2e.com',
      tipoUsuario: TipoUsuario.TUTOR,
    });
    ajenoToken = await login(app, ajeno.email);

    const admin = await crearUsuario(app, {
      email: 'socket.admin@e2e.com',
      tipoUsuario: TipoUsuario.ADMINISTRADOR,
      esAdministrador: true,
    });
    adminToken = await login(app, admin.email);

    expect((await compartir(tutorId)).status).toBe(201);
  });

  afterAll(async () => {
    sockets.forEach((s) => s.close());
    await app.close();
  });

  it('rechaza la conexión sin token o con un token inválido', async () => {
    for (const token of [undefined, 'cualquiera']) {
      const socket = conectar(token);
      await expect(conectado(socket)).rejects.toThrow('no-autorizado');
      expect(socket.connected).toBe(false);
    }
  });

  it('un tutor con acceso compartido recibe cada ubicación nueva al instante', async () => {
    const tutor = conectar(tutorToken);
    await conectado(tutor);
    expect(await suscribir(tutor, pcdId)).toEqual({ ok: true });

    const llega = evento<{ pcdId: number; latitud: string }>(
      tutor,
      'ubicacion:nueva',
    );
    expect((await registrar(-34.6)).status).toBe(201);

    const nueva = await llega;
    expect(nueva.pcdId).toBe(pcdId);
    expect(Number(nueva.latitud)).toBeCloseTo(-34.6);
  });

  it('sin acceso compartido no se puede suscribir (ni el Administrador)', async () => {
    for (const token of [ajenoToken, adminToken]) {
      const socket = conectar(token);
      await conectado(socket);
      expect(await suscribir(socket, pcdId)).toEqual({
        ok: false,
        error: 'sin-acceso',
      });
    }
  });

  it('rechaza un pcdId inválido', async () => {
    const socket = conectar(tutorToken);
    await conectado(socket);
    expect(await suscribir(socket, -3)).toEqual({
      ok: false,
      error: 'pcdId-invalido',
    });
  });

  it('el PCD se suscribe a su propia sala', async () => {
    const socket = conectar(pcdToken);
    await conectado(socket);
    expect(await suscribir(socket, pcdId)).toEqual({ ok: true });
  });

  it('quien no se suscribió, o se desuscribió, no recibe nada', async () => {
    const sinSuscribir = conectar(tutorToken);
    await conectado(sinSuscribir);
    const recibidas: unknown[] = [];
    sinSuscribir.on('ubicacion:nueva', (u) => recibidas.push(u));

    const desuscripto = conectar(tutorToken);
    await conectado(desuscripto);
    await suscribir(desuscripto, pcdId);
    await desuscripto.emitWithAck('desuscribir', { pcdId });
    desuscripto.on('ubicacion:nueva', (u) => recibidas.push(u));

    await registrar(-34.7);
    await new Promise((r) => setTimeout(r, 300));
    expect(recibidas).toHaveLength(0);
  });

  it('al revocar el acceso, el tutor deja de recibir ubicaciones', async () => {
    const otro = await crearUsuario(app, {
      email: 'socket.otro.tutor@e2e.com',
      tipoUsuario: TipoUsuario.TUTOR,
    });
    await crearTutorPcd(app, otro.id, pcdId);
    const otroToken = await login(app, otro.email);
    expect((await compartir(otro.id)).status).toBe(201);

    const socket = conectar(otroToken);
    await conectado(socket);
    expect(await suscribir(socket, pcdId)).toEqual({ ok: true });
    const recibidas: unknown[] = [];
    socket.on('ubicacion:nueva', (u) => recibidas.push(u));

    const aviso = evento<{ pcdId: number }>(socket, 'acceso:revocado');
    const res = await request(app.getHttpServer())
      .delete(`/ubicaciones/compartidos/${otro.id}`)
      .set(...authHeader(pcdToken));
    expect(res.status).toBe(200);
    expect((await aviso).pcdId).toBe(pcdId);

    await registrar(-34.8);
    await new Promise((r) => setTimeout(r, 300));
    expect(recibidas).toHaveLength(0);
  });
});

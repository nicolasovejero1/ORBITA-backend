/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument -- res.body y app.getHttpServer() de supertest no están tipados */
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './utils/create-test-app';
import { authHeader, crearUsuario, login } from './utils/fixtures';
import { TipoUsuario } from '../src/common/enums/tipo-usuario.enum';

describe('Notificaciones (e2e)', () => {
  let app: INestApplication;
  let adminToken: string;
  let pcdToken: string;
  let otroPcdToken: string;
  let notificacionId: number;
  let pcdUserId: number;

  beforeAll(async () => {
    app = await createTestApp();

    const admin = await crearUsuario(app, {
      email: 'notif.admin@e2e.com',
      tipoUsuario: TipoUsuario.ADMINISTRADOR,
      esAdministrador: true,
    });
    adminToken = await login(app, admin.email);

    const pcd = await crearUsuario(app, {
      email: 'notif.pcd@e2e.com',
      tipoUsuario: TipoUsuario.PCD,
    });
    pcdUserId = pcd.id;
    pcdToken = await login(app, pcd.email);

    const otroPcd = await crearUsuario(app, {
      email: 'notif.otro.pcd@e2e.com',
      tipoUsuario: TipoUsuario.PCD,
    });
    otroPcdToken = await login(app, otroPcd.email);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /notificaciones (Admin)', () => {
    it('flujo feliz', async () => {
      const res = await request(app.getHttpServer())
        .post('/notificaciones')
        .set(...authHeader(adminToken))
        .send({
          usuarioId: pcdUserId,
          tipo: 'ACTIVIDAD',
          mensaje: 'Tenés una actividad pendiente para hoy',
        });
      expect(res.status).toBe(201);
      // El PCD no tiene token de push: nadie aceptó el envío, así que sigue PENDIENTE.
      expect(res.body.estado).toBe('PENDIENTE');
      notificacionId = res.body.id;
    });

    it('400: el tipo debe ser uno de la lista', async () => {
      const res = await request(app.getHttpServer())
        .post('/notificaciones')
        .set(...authHeader(adminToken))
        .send({ usuarioId: pcdUserId, tipo: 'OTRO', mensaje: 'Hola' });
      expect(res.status).toBe(400);
    });

    it('400: falta el campo mensaje', async () => {
      const res = await request(app.getHttpServer())
        .post('/notificaciones')
        .set(...authHeader(adminToken))
        .send({ usuarioId: pcdUserId, tipo: 'ACTIVIDAD' });
      expect(res.status).toBe(400);
    });

    it('401: sin token', async () => {
      const res = await request(app.getHttpServer())
        .post('/notificaciones')
        .send({});
      expect(res.status).toBe(401);
    });

    it('403: un PCD no puede crear notificaciones para otros', async () => {
      const res = await request(app.getHttpServer())
        .post('/notificaciones')
        .set(...authHeader(pcdToken))
        .send({ usuarioId: pcdUserId, tipo: 'ACTIVIDAD', mensaje: 'x' });
      expect(res.status).toBe(403);
    });
  });

  describe('GET /notificaciones', () => {
    it('flujo feliz: el destinatario ve su notificación', async () => {
      const res = await request(app.getHttpServer())
        .get('/notificaciones')
        .set(...authHeader(pcdToken));
      expect(res.status).toBe(200);
      expect(res.body.items.length).toBeGreaterThan(0);
      expect(res.body).toHaveProperty('hasMore');
    });
  });

  describe('GET /notificaciones/:id', () => {
    it('flujo feliz', async () => {
      const res = await request(app.getHttpServer())
        .get(`/notificaciones/${notificacionId}`)
        .set(...authHeader(pcdToken));
      expect(res.status).toBe(200);
    });

    it('404: otro usuario no puede ver una notificación ajena (no se filtra por owner, se oculta como inexistente)', async () => {
      const res = await request(app.getHttpServer())
        .get(`/notificaciones/${notificacionId}`)
        .set(...authHeader(otroPcdToken));
      expect(res.status).toBe(404);
    });

    it('404: id inexistente', async () => {
      const res = await request(app.getHttpServer())
        .get('/notificaciones/999999')
        .set(...authHeader(pcdToken));
      expect(res.status).toBe(404);
    });
  });

  describe('PATCH /notificaciones/:id/leer', () => {
    it('flujo feliz', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/notificaciones/${notificacionId}/leer`)
        .set(...authHeader(pcdToken));
      expect(res.status).toBe(200);
      expect(res.body.estado).toBe('LEIDA');
    });
  });

  describe('POST /notificaciones/recordatorios (Admin)', () => {
    it('flujo feliz: dispara el cron manualmente', async () => {
      const res = await request(app.getHttpServer())
        .post('/notificaciones/recordatorios')
        .set(...authHeader(adminToken));
      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('creadas');
    });

    it('403: un PCD no puede disparar recordatorios', async () => {
      const res = await request(app.getHttpServer())
        .post('/notificaciones/recordatorios')
        .set(...authHeader(pcdToken));
      expect(res.status).toBe(403);
    });
  });

  describe('DELETE /notificaciones/:id', () => {
    it('flujo feliz', async () => {
      const res = await request(app.getHttpServer())
        .delete(`/notificaciones/${notificacionId}`)
        .set(...authHeader(pcdToken));
      expect(res.status).toBe(200);
    });

    it('404: ya eliminada', async () => {
      const res = await request(app.getHttpServer())
        .delete(`/notificaciones/${notificacionId}`)
        .set(...authHeader(pcdToken));
      expect(res.status).toBe(404);
    });
  });
});

/* eslint-disable @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access -- res.body y app.getHttpServer() de supertest no están tipados */
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './utils/create-test-app';
import {
  authHeader,
  crearTutorPcd,
  crearUsuario,
  login,
} from './utils/fixtures';
import { TipoUsuario } from '../src/common/enums/tipo-usuario.enum';

describe('Ubicaciones (e2e)', () => {
  let app: INestApplication;
  let adminToken: string;
  let pcdToken: string;
  let pcdId: number;
  let tutorConVinculoToken: string;
  let tutorConVinculoId: number;
  let tutorSinVinculoId: number;
  let tutorExVinculoToken: string;
  let tutorExVinculoId: number;

  beforeAll(async () => {
    app = await createTestApp();

    const admin = await crearUsuario(app, {
      email: 'ubic.admin@e2e.com',
      tipoUsuario: TipoUsuario.ADMINISTRADOR,
      esAdministrador: true,
    });
    adminToken = await login(app, admin.email);

    const pcd = await crearUsuario(app, {
      email: 'ubic.pcd@e2e.com',
      tipoUsuario: TipoUsuario.PCD,
    });
    pcdId = pcd.id;
    pcdToken = await login(app, pcd.email);

    const tutorConVinculo = await crearUsuario(app, {
      email: 'ubic.tutor.convinculo@e2e.com',
      tipoUsuario: TipoUsuario.TUTOR,
    });
    tutorConVinculoId = tutorConVinculo.id;
    await crearTutorPcd(app, tutorConVinculo.id, pcdId);
    tutorConVinculoToken = await login(app, tutorConVinculo.email);

    const tutorSinVinculo = await crearUsuario(app, {
      email: 'ubic.tutor.sinvinculo@e2e.com',
      tipoUsuario: TipoUsuario.TUTOR,
    });
    tutorSinVinculoId = tutorSinVinculo.id;

    const tutorExVinculo = await crearUsuario(app, {
      email: 'ubic.tutor.exvinculo@e2e.com',
      tipoUsuario: TipoUsuario.TUTOR,
    });
    tutorExVinculoId = tutorExVinculo.id;
    await crearTutorPcd(app, tutorExVinculo.id, pcdId);
    tutorExVinculoToken = await login(app, tutorExVinculo.email);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /ubicaciones (PCD)', () => {
    it('flujo feliz', async () => {
      const res = await request(app.getHttpServer())
        .post('/ubicaciones')
        .set(...authHeader(pcdToken))
        .send({ latitud: -34.603722, longitud: -58.381592, precision: 10 });
      expect(res.status).toBe(201);
    });

    it('400: latitud fuera de rango', async () => {
      const res = await request(app.getHttpServer())
        .post('/ubicaciones')
        .set(...authHeader(pcdToken))
        .send({ latitud: 999, longitud: -58.381592 });
      expect(res.status).toBe(400);
    });

    it('401: sin token', async () => {
      const res = await request(app.getHttpServer())
        .post('/ubicaciones')
        .send({});
      expect(res.status).toBe(401);
    });

    it('403: un Tutor no puede registrar ubicación (solo el PCD registra la propia)', async () => {
      const res = await request(app.getHttpServer())
        .post('/ubicaciones')
        .set(...authHeader(tutorConVinculoToken))
        .send({ latitud: -34.6, longitud: -58.4 });
      expect(res.status).toBe(403);
    });
  });

  describe('GET /ubicaciones/pcd/:pcdId/ultima — Opción A: opt-in vía compartición', () => {
    it('403: Tutor con vínculo ACTIVO pero SIN compartición no tiene acceso', async () => {
      const res = await request(app.getHttpServer())
        .get(`/ubicaciones/pcd/${pcdId}/ultima`)
        .set(...authHeader(tutorConVinculoToken));
      expect(res.status).toBe(403);
    });

    it('403: no se puede compartir con un Tutor sin vínculo activo', async () => {
      const res = await request(app.getHttpServer())
        .post('/ubicaciones/compartidos')
        .set(...authHeader(pcdToken))
        .send({ usuarioId: tutorSinVinculoId });
      expect(res.status).toBe(403);
    });

    it('flujo feliz: tras compartir, el Tutor accede a la última ubicación', async () => {
      const compartir = await request(app.getHttpServer())
        .post('/ubicaciones/compartidos')
        .set(...authHeader(pcdToken))
        .send({ usuarioId: tutorConVinculoId });
      expect(compartir.status).toBe(201);

      const res = await request(app.getHttpServer())
        .get(`/ubicaciones/pcd/${pcdId}/ultima`)
        .set(...authHeader(tutorConVinculoToken));
      expect(res.status).toBe(200);
    });

    it('404: el PCD todavía no registró ubicación (otro PCD sin historial)', async () => {
      const otroPcd = await crearUsuario(app, {
        email: 'ubic.otro.pcd@e2e.com',
        tipoUsuario: TipoUsuario.PCD,
      });
      const otroPcdToken = await login(app, otroPcd.email);
      const res = await request(app.getHttpServer())
        .get(`/ubicaciones/pcd/${otroPcd.id}/ultima`)
        .set(...authHeader(otroPcdToken));
      expect(res.status).toBe(404);
    });

    it('403: el Administrador no lee la ubicación de un PCD (ni la última ni el historial)', async () => {
      const ultima = await request(app.getHttpServer())
        .get(`/ubicaciones/pcd/${pcdId}/ultima`)
        .set(...authHeader(adminToken));
      expect(ultima.status).toBe(403);

      const historial = await request(app.getHttpServer())
        .get(`/ubicaciones/pcd/${pcdId}/historial`)
        .set(...authHeader(adminToken));
      expect(historial.status).toBe(403);
    });
  });

  describe('Vínculo desactivado después de compartir', () => {
    it('la compartición se mantiene hasta que el PCD la revoque', async () => {
      // Si el vínculo se desactiva después de compartir, el usuario sigue
      // pudiendo leer la ubicación.
      await request(app.getHttpServer())
        .post('/ubicaciones/compartidos')
        .set(...authHeader(pcdToken))
        .send({ usuarioId: tutorExVinculoId })
        .expect(201);
      await request(app.getHttpServer())
        .patch(`/tutor-pcd/${tutorExVinculoId}/${pcdId}/status`)
        .set(...authHeader(adminToken))
        .send({ estado: 'INACTIVO' })
        .expect(200);

      const lectura = await request(app.getHttpServer())
        .get(`/ubicaciones/pcd/${pcdId}/ultima`)
        .set(...authHeader(tutorExVinculoToken));
      expect(lectura.status).toBe(200);
    });
  });

  describe('DELETE /ubicaciones/compartidos/:usuarioId', () => {
    it('flujo feliz: el PCD revoca el acceso compartido', async () => {
      const res = await request(app.getHttpServer())
        .delete(`/ubicaciones/compartidos/${tutorConVinculoId}`)
        .set(...authHeader(pcdToken));
      expect(res.status).toBe(200);
    });

    it('404: ya no existe el acceso compartido', async () => {
      const res = await request(app.getHttpServer())
        .delete(`/ubicaciones/compartidos/${tutorConVinculoId}`)
        .set(...authHeader(pcdToken));
      expect(res.status).toBe(404);
    });
  });
  describe('GET /ubicaciones/pcd/:pcdId/historial (rango y paginación)', () => {
    const historial = (query = '') =>
      request(app.getHttpServer())
        .get(`/ubicaciones/pcd/${pcdId}/historial${query}`)
        .set(...authHeader(tutorConVinculoToken));
    let ids: number[];

    beforeAll(async () => {
      // Los tests de arriba pueden haber revocado el acceso.
      await request(app.getHttpServer())
        .post('/ubicaciones/compartidos')
        .set(...authHeader(pcdToken))
        .send({ usuarioId: tutorConVinculoId });
      for (const latitud of [-34.1, -34.2, -34.3]) {
        await request(app.getHttpServer())
          .post('/ubicaciones')
          .set(...authHeader(pcdToken))
          .send({ latitud, longitud: -58.38 });
      }
      const todas = await historial();
      ids = todas.body.map((u: { id: number }) => u.id);
    });

    it('trae de la más nueva a la más vieja', () => {
      expect(ids.length).toBeGreaterThanOrEqual(3);
      expect([...ids].sort((a, b) => b - a)).toEqual(ids);
    });

    it('limite y antes paginan sin repetir ni saltear', async () => {
      const primera = await historial('?limite=2');
      expect(primera.status).toBe(200);
      expect(primera.body.map((u: { id: number }) => u.id)).toEqual(
        ids.slice(0, 2),
      );
      const segunda = await historial(`?limite=2&antes=${ids[1]}`);
      expect(segunda.body.map((u: { id: number }) => u.id)).toEqual(
        ids.slice(2, 4),
      );
    });

    it('desde y hasta acotan el rango', async () => {
      const futuro = await historial('?desde=2999-01-01T00:00:00Z');
      expect(futuro.status).toBe(200);
      expect(futuro.body).toHaveLength(0);

      const hastaElPasado = await historial('?hasta=2000-01-01T00:00:00Z');
      expect(hastaElPasado.body).toHaveLength(0);

      const hoy = await historial(
        `?desde=${new Date(Date.now() - 3_600_000).toISOString()}&hasta=${new Date(Date.now() + 3_600_000).toISOString()}`,
      );
      expect(hoy.body.length).toBeGreaterThanOrEqual(3);
    });

    it('400: parámetros inválidos o rango al revés', async () => {
      for (const query of [
        '?limite=0',
        '?limite=501',
        '?desde=ayer',
        '?antes=0',
        '?desde=2026-11-03T00:00:00Z&hasta=2026-11-02T00:00:00Z',
      ]) {
        const res = await historial(query);
        expect([query, res.status]).toEqual([query, 400]);
      }
    });
  });
});

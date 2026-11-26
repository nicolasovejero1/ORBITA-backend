/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument -- res.body y app.getHttpServer() de supertest no están tipados */
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './utils/create-test-app';
import { authHeader, crearUsuario, login } from './utils/fixtures';
import { TipoUsuario } from '../src/common/enums/tipo-usuario.enum';
import { RolProfesionalVinculo } from '../src/common/enums/rol-profesional-vinculo.enum';

describe('Vínculos (e2e)', () => {
  let app: INestApplication;
  let adminToken: string;
  let pcdId: number;
  let profesionalId: number;
  let tutorId: number;

  beforeAll(async () => {
    app = await createTestApp();

    const admin = await crearUsuario(app, {
      email: 'vinculos.admin@e2e.com',
      tipoUsuario: TipoUsuario.ADMINISTRADOR,
      esAdministrador: true,
    });
    adminToken = await login(app, admin.email);

    const pcd = await crearUsuario(app, {
      email: 'vinculos.pcd@e2e.com',
      tipoUsuario: TipoUsuario.PCD,
    });
    pcdId = pcd.id;

    const profesional = await crearUsuario(app, {
      email: 'vinculos.prof@e2e.com',
      tipoUsuario: TipoUsuario.PROFESIONAL,
    });
    profesionalId = profesional.id;

    const tutor = await crearUsuario(app, {
      email: 'vinculos.tutor@e2e.com',
      tipoUsuario: TipoUsuario.TUTOR,
    });
    tutorId = tutor.id;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /vinculos (Profesional-PCD)', () => {
    it('flujo feliz: Admin crea el vínculo', async () => {
      const res = await request(app.getHttpServer())
        .post('/vinculos')
        .set(...authHeader(adminToken))
        .send({
          pcdId,
          profesionalId,
          rolProfesional: RolProfesionalVinculo.CABECERA,
        });
      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({ pcdId, profesionalId });
    });

    it('400: pcdId inválido (no numérico)', async () => {
      const res = await request(app.getHttpServer())
        .post('/vinculos')
        .set(...authHeader(adminToken))
        .send({
          pcdId: 'no-es-numero',
          profesionalId,
          rolProfesional: RolProfesionalVinculo.CABECERA,
        });
      expect(res.status).toBe(400);
    });

    it('401: sin token', async () => {
      const res = await request(app.getHttpServer()).post('/vinculos').send({});
      expect(res.status).toBe(401);
    });

    it('403: un Profesional no puede crear vínculos', async () => {
      const profToken = await login(app, 'vinculos.prof@e2e.com');
      const res = await request(app.getHttpServer())
        .post('/vinculos')
        .set(...authHeader(profToken))
        .send({
          pcdId,
          profesionalId,
          rolProfesional: RolProfesionalVinculo.CABECERA,
        });
      expect(res.status).toBe(403);
    });

    it('409: vínculo duplicado para el mismo par (pcdId, profesionalId)', async () => {
      const res = await request(app.getHttpServer())
        .post('/vinculos')
        .set(...authHeader(adminToken))
        .send({
          pcdId,
          profesionalId,
          rolProfesional: RolProfesionalVinculo.CABECERA,
        });
      expect(res.status).toBe(409);
    });
  });

  describe('GET /vinculos/:pcdId/:profesionalId', () => {
    it('404: par inexistente', async () => {
      const res = await request(app.getHttpServer())
        .get('/vinculos/999999/999999')
        .set(...authHeader(adminToken));
      expect(res.status).toBe(404);
    });
  });

  describe('POST /tutor-pcd', () => {
    it('flujo feliz: Admin crea el vínculo tutor-PCD', async () => {
      const res = await request(app.getHttpServer())
        .post('/tutor-pcd')
        .set(...authHeader(adminToken))
        .send({ tutorId, pcdId, parentesco: 'Madre' });
      expect(res.status).toBe(201);
      expect(res.body.parentesco).toBe('Madre');
    });

    it('400: falta el parentesco', async () => {
      const res = await request(app.getHttpServer())
        .post('/tutor-pcd')
        .set(...authHeader(adminToken))
        .send({ tutorId, pcdId });
      expect(res.status).toBe(400);
    });

    it('Admin corrige el parentesco del vínculo', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/tutor-pcd/${tutorId}/${pcdId}/parentesco`)
        .set(...authHeader(adminToken))
        .send({ parentesco: 'Tía' });
      expect(res.status).toBe(200);
      expect(res.body.parentesco).toBe('Tía');
    });

    it('409: vínculo tutor-PCD duplicado', async () => {
      const res = await request(app.getHttpServer())
        .post('/tutor-pcd')
        .set(...authHeader(adminToken))
        .send({ tutorId, pcdId, parentesco: 'Madre' });
      expect(res.status).toBe(409);
    });
  });

  describe('PATCH /tutor-pcd/:tutorId/:pcdId/status', () => {
    it('flujo feliz: Admin cambia el estado a INACTIVO', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/tutor-pcd/${tutorId}/${pcdId}/status`)
        .set(...authHeader(adminToken))
        .send({ estado: 'INACTIVO' });
      expect(res.status).toBe(200);
      expect(res.body.estado).toBe('INACTIVO');
    });

    it('400: estado inválido (no está en el enum)', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/tutor-pcd/${tutorId}/${pcdId}/status`)
        .set(...authHeader(adminToken))
        .send({ estado: 'NO_EXISTE' });
      expect(res.status).toBe(400);
    });
  });

  describe('DELETE /vinculos/:pcdId/:profesionalId', () => {
    it('flujo feliz: elimina el vínculo sin actividades dependientes', async () => {
      const res = await request(app.getHttpServer())
        .delete(`/vinculos/${pcdId}/${profesionalId}`)
        .set(...authHeader(adminToken));
      expect(res.status).toBe(200);
    });

    it('404: vínculo ya eliminado', async () => {
      const res = await request(app.getHttpServer())
        .delete(`/vinculos/${pcdId}/${profesionalId}`)
        .set(...authHeader(adminToken));
      expect(res.status).toBe(404);
    });
  });
});

/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument -- res.body y app.getHttpServer() de supertest no están tipados */
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './utils/create-test-app';
import { authHeader, crearUsuario, login } from './utils/fixtures';
import { TipoUsuario } from '../src/common/enums/tipo-usuario.enum';

describe('Catálogos: Medicamentos y Terapias (e2e)', () => {
  let app: INestApplication;
  let adminToken: string;
  let pcdToken: string;

  beforeAll(async () => {
    app = await createTestApp();

    const admin = await crearUsuario(app, {
      email: 'catalogos.admin@e2e.com',
      tipoUsuario: TipoUsuario.ADMINISTRADOR,
      esAdministrador: true,
    });
    adminToken = await login(app, admin.email);

    const pcd = await crearUsuario(app, {
      email: 'catalogos.pcd@e2e.com',
      tipoUsuario: TipoUsuario.PCD,
    });
    pcdToken = await login(app, pcd.email);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Medicamentos', () => {
    let medicamentoId: number;

    it('flujo feliz: Admin crea un medicamento', async () => {
      const res = await request(app.getHttpServer())
        .post('/medicamentos')
        .set(...authHeader(adminToken))
        .send({ nombre: 'Ibuprofeno E2E', presentacion: 'Comprimidos 400mg' });
      expect(res.status).toBe(201);
      medicamentoId = res.body.id;
    });

    it('409: ya existe un medicamento con ese nombre (sin distinguir mayúsculas)', async () => {
      const res = await request(app.getHttpServer())
        .post('/medicamentos')
        .set(...authHeader(adminToken))
        .send({ nombre: 'ibuprofeno e2e' });
      expect(res.status).toBe(409);
    });

    it('flujo feliz: un PCD puede listar medicamentos (lectura abierta a todos los roles)', async () => {
      const res = await request(app.getHttpServer())
        .get('/medicamentos')
        .set(...authHeader(pcdToken));
      expect(res.status).toBe(200);
    });

    it('400: falta el campo requerido "nombre"', async () => {
      const res = await request(app.getHttpServer())
        .post('/medicamentos')
        .set(...authHeader(adminToken))
        .send({ presentacion: 'Sin nombre' });
      expect(res.status).toBe(400);
    });

    it('401: sin token', async () => {
      const res = await request(app.getHttpServer())
        .post('/medicamentos')
        .send({ nombre: 'X' });
      expect(res.status).toBe(401);
    });

    it('403: un PCD no puede crear medicamentos', async () => {
      const res = await request(app.getHttpServer())
        .post('/medicamentos')
        .set(...authHeader(pcdToken))
        .send({ nombre: 'X' });
      expect(res.status).toBe(403);
    });

    it('flujo feliz: modifica y luego elimina el medicamento', async () => {
      const update = await request(app.getHttpServer())
        .put(`/medicamentos/${medicamentoId}`)
        .set(...authHeader(adminToken))
        .send({ tipo: 'Antiinflamatorio' });
      expect(update.status).toBe(200);
      expect(update.body.tipo).toBe('Antiinflamatorio');

      const del = await request(app.getHttpServer())
        .delete(`/medicamentos/${medicamentoId}`)
        .set(...authHeader(adminToken));
      expect(del.status).toBe(200);
    });

    it('404: medicamento inexistente', async () => {
      const res = await request(app.getHttpServer())
        .get('/medicamentos/999999')
        .set(...authHeader(adminToken));
      expect(res.status).toBe(404);
    });
  });

  describe('Terapias', () => {
    let terapiaId: number;

    it('flujo feliz: Admin crea una terapia', async () => {
      const res = await request(app.getHttpServer())
        .post('/terapias')
        .set(...authHeader(adminToken))
        .send({
          tipo: 'Kinesiología E2E',
          descripcion: 'Rehabilitación motriz',
        });
      expect(res.status).toBe(201);
      terapiaId = res.body.id;
    });

    it('400: falta el campo requerido "descripcion"', async () => {
      const res = await request(app.getHttpServer())
        .post('/terapias')
        .set(...authHeader(adminToken))
        .send({ tipo: 'Sin descripción' });
      expect(res.status).toBe(400);
    });

    it('403: un PCD no puede crear terapias', async () => {
      const res = await request(app.getHttpServer())
        .post('/terapias')
        .set(...authHeader(pcdToken))
        .send({ tipo: 'X', descripcion: 'Y' });
      expect(res.status).toBe(403);
    });

    it('flujo feliz: un PCD SÍ puede listar terapias (catálogo abierto a todos los roles)', async () => {
      const res = await request(app.getHttpServer())
        .get('/terapias')
        .set(...authHeader(pcdToken));
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('404: terapia inexistente', async () => {
      const res = await request(app.getHttpServer())
        .get('/terapias/999999')
        .set(...authHeader(adminToken));
      expect(res.status).toBe(404);
    });

    it('flujo feliz: Admin elimina la terapia', async () => {
      const res = await request(app.getHttpServer())
        .delete(`/terapias/${terapiaId}`)
        .set(...authHeader(adminToken));
      expect(res.status).toBe(200);
    });
  });
});

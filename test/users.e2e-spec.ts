/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument -- res.body y app.getHttpServer() de supertest no están tipados */
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './utils/create-test-app';
import {
  authHeader,
  crearUsuario,
  login,
  PASSWORD_DEFAULT,
} from './utils/fixtures';
import { TipoUsuario } from '../src/common/enums/tipo-usuario.enum';

describe('Usuarios (e2e)', () => {
  let app: INestApplication;
  let adminToken: string;
  let pcdToken: string;
  let pcdId: number;

  beforeAll(async () => {
    app = await createTestApp();

    const admin = await crearUsuario(app, {
      email: 'users.admin@e2e.com',
      tipoUsuario: TipoUsuario.ADMINISTRADOR,
      esAdministrador: true,
    });
    adminToken = await login(app, admin.email);

    const pcd = await crearUsuario(app, {
      email: 'users.pcd@e2e.com',
      tipoUsuario: TipoUsuario.PCD,
    });
    pcdId = pcd.id;
    pcdToken = await login(app, pcd.email);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /usuarios (Admin)', () => {
    it('flujo feliz: Admin crea un usuario nuevo', async () => {
      const res = await request(app.getHttpServer())
        .post('/usuarios')
        .set(...authHeader(adminToken))
        .send({
          nombre: 'Nuevo',
          apellido: 'Usuario',
          dni: '99999999',
          email: 'nuevo.usuario@e2e.com',
          password: 'password123',
          fechaNacimiento: '1995-01-01',
          tipoUsuario: TipoUsuario.TUTOR,
        });
      expect(res.status).toBe(201);
      expect(res.body).not.toHaveProperty('password');
    });

    it('400: falta un campo requerido', async () => {
      const res = await request(app.getHttpServer())
        .post('/usuarios')
        .set(...authHeader(adminToken))
        .send({ nombre: 'Incompleto' });
      expect(res.status).toBe(400);
    });

    it('401: sin token', async () => {
      const res = await request(app.getHttpServer()).post('/usuarios').send({});
      expect(res.status).toBe(401);
    });

    it('403: un PCD no puede crear usuarios', async () => {
      const res = await request(app.getHttpServer())
        .post('/usuarios')
        .set(...authHeader(pcdToken))
        .send({
          nombre: 'X',
          apellido: 'Y',
          dni: '11111111',
          email: 'otro@e2e.com',
          password: 'password123',
          fechaNacimiento: '1995-01-01',
          tipoUsuario: TipoUsuario.PCD,
        });
      expect(res.status).toBe(403);
    });

    it('409: email duplicado', async () => {
      const res = await request(app.getHttpServer())
        .post('/usuarios')
        .set(...authHeader(adminToken))
        .send({
          nombre: 'Dup',
          apellido: 'Licado',
          dni: '22222222',
          email: 'users.pcd@e2e.com',
          password: 'password123',
          fechaNacimiento: '1995-01-01',
          tipoUsuario: TipoUsuario.PCD,
        });
      expect(res.status).toBe(409);
    });
  });

  describe('GET /usuarios/me', () => {
    it('flujo feliz: devuelve el perfil propio sin password', async () => {
      const res = await request(app.getHttpServer())
        .get('/usuarios/me')
        .set(...authHeader(pcdToken));
      expect(res.status).toBe(200);
      expect(res.body.email).toBe('users.pcd@e2e.com');
      expect(res.body).not.toHaveProperty('password');
    });

    it('401: sin token', async () => {
      const res = await request(app.getHttpServer()).get('/usuarios/me');
      expect(res.status).toBe(401);
    });
  });

  describe('GET /usuarios/:id', () => {
    it('404: id inexistente (Admin)', async () => {
      const res = await request(app.getHttpServer())
        .get('/usuarios/999999')
        .set(...authHeader(adminToken));
      expect(res.status).toBe(404);
    });

    it('403: Profesional sin vínculo activo no puede ver el PCD', async () => {
      const prof = await crearUsuario(app, {
        email: 'users.prof.sinvinculo@e2e.com',
        tipoUsuario: TipoUsuario.PROFESIONAL,
      });
      const profToken = await login(app, prof.email);

      const res = await request(app.getHttpServer())
        .get(`/usuarios/${pcdId}`)
        .set(...authHeader(profToken));
      expect(res.status).toBe(403);
    });
  });

  describe('PATCH /usuarios/me/password', () => {
    it('flujo feliz: cambia la contraseña propia', async () => {
      const usuario = await crearUsuario(app, {
        email: 'users.cambiopass@e2e.com',
        tipoUsuario: TipoUsuario.PCD,
      });
      const token = await login(app, usuario.email);

      const res = await request(app.getHttpServer())
        .patch('/usuarios/me/password')
        .set(...authHeader(token))
        .send({
          currentPassword: PASSWORD_DEFAULT,
          newPassword: 'nuevaPass456',
        });
      expect(res.status).toBe(200);

      const nuevoLogin = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: usuario.email, password: 'nuevaPass456' });
      expect(nuevoLogin.status).toBe(200);
    });

    it('401: contraseña actual incorrecta', async () => {
      const res = await request(app.getHttpServer())
        .patch('/usuarios/me/password')
        .set(...authHeader(pcdToken))
        .send({ currentPassword: 'incorrecta', newPassword: 'nuevaPass456' });
      expect(res.status).toBe(401);
    });
  });

  describe('DELETE /usuarios/:id', () => {
    it('flujo feliz: Admin elimina un usuario', async () => {
      const usuario = await crearUsuario(app, {
        email: 'users.borrar@e2e.com',
        tipoUsuario: TipoUsuario.PCD,
      });
      const res = await request(app.getHttpServer())
        .delete(`/usuarios/${usuario.id}`)
        .set(...authHeader(adminToken));
      expect(res.status).toBe(200);
    });

    it('404: id inexistente', async () => {
      const res = await request(app.getHttpServer())
        .delete('/usuarios/999999')
        .set(...authHeader(adminToken));
      expect(res.status).toBe(404);
    });
  });
});

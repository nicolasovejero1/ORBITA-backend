/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument -- res.body y app.getHttpServer() de supertest no están tipados */
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './utils/create-test-app';
import { crearUsuario, PASSWORD_DEFAULT } from './utils/fixtures';
import { TipoUsuario } from '../src/common/enums/tipo-usuario.enum';

describe('Auth (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
    await crearUsuario(app, {
      email: 'auth.pcd@e2e.com',
      tipoUsuario: TipoUsuario.PCD,
    });
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /auth/login', () => {
    it('flujo feliz: credenciales válidas devuelve access_token + refresh_token', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'auth.pcd@e2e.com', password: PASSWORD_DEFAULT });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('access_token');
      expect(res.body).toHaveProperty('refresh_token');
      expect(res.body.usuario).toMatchObject({ email: 'auth.pcd@e2e.com' });
      expect(res.body.usuario).not.toHaveProperty('password');
    });

    it('400: body inválido (email mal formado)', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'no-es-un-email', password: PASSWORD_DEFAULT });
      expect(res.status).toBe(400);
    });

    it('401: password incorrecta', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'auth.pcd@e2e.com', password: 'otraPassword123' });
      expect(res.status).toBe(401);
    });

    it('401: email inexistente', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'no-existe@e2e.com', password: PASSWORD_DEFAULT });
      expect(res.status).toBe(401);
    });
  });

  describe('POST /auth/refresh', () => {
    it('flujo feliz: rota el refresh_token y emite un access_token nuevo', async () => {
      const loginRes = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'auth.pcd@e2e.com', password: PASSWORD_DEFAULT });
      const refreshToken = loginRes.body.refresh_token as string;

      const res = await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('access_token');
      // El refresh token es de un solo uso (rotación): el nuevo NUNCA es
      // igual al usado, aunque el access_token pueda coincidir si login y
      // refresh caen en el mismo segundo (mismo iat/exp de JWT).
      expect(res.body.refresh_token).not.toBe(refreshToken);
    });

    it('401: refresh_token ya usado (rotación de un solo uso)', async () => {
      const loginRes = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'auth.pcd@e2e.com', password: PASSWORD_DEFAULT });
      const refreshToken = loginRes.body.refresh_token as string;

      await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken })
        .expect(200);

      const res = await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken });
      expect(res.status).toBe(401);
    });

    it('400: refresh_token con formato inválido (muy corto)', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken: 'corto' });
      expect(res.status).toBe(400);
    });
  });

  describe('POST /auth/logout y /auth/logout-all', () => {
    it('flujo feliz: logout revoca el refresh_token (un siguiente refresh da 401)', async () => {
      const loginRes = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'auth.pcd@e2e.com', password: PASSWORD_DEFAULT });
      const refreshToken = loginRes.body.refresh_token as string;

      await request(app.getHttpServer())
        .post('/auth/logout')
        .send({ refreshToken })
        .expect(204);

      const res = await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken });
      expect(res.status).toBe(401);
    });

    it('401: logout-all sin token de autenticación', async () => {
      const res = await request(app.getHttpServer()).post('/auth/logout-all');
      expect(res.status).toBe(401);
    });

    it('flujo feliz: logout-all revoca todas las sesiones del usuario', async () => {
      const loginRes = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'auth.pcd@e2e.com', password: PASSWORD_DEFAULT });
      const { access_token: accessToken, refresh_token: refreshToken } =
        loginRes.body as { access_token: string; refresh_token: string };

      await request(app.getHttpServer())
        .post('/auth/logout-all')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(204);

      const res = await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken });
      expect(res.status).toBe(401);
    });
  });
});

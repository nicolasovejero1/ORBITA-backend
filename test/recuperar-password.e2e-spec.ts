/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call -- res.body, app.getHttpServer() de supertest y mock.calls no están tipados */
import { INestApplication } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import { DataSource, Repository } from 'typeorm';
import { EstadoUsuario } from '../src/common/enums/estado-usuario.enum';
import { TipoUsuario } from '../src/common/enums/tipo-usuario.enum';
import { MailService } from '../src/mail/mail.service';
import { PasswordResetService } from '../src/auth/password-reset.service';
import { Usuario } from '../src/users/entities/usuario.entity';
import { createTestApp } from './utils/create-test-app';
import { crearUsuario, PASSWORD_DEFAULT } from './utils/fixtures';

describe('Recuperar contraseña con OTP (e2e)', () => {
  let app: INestApplication;
  const enviarCodigo = jest.fn().mockResolvedValue(undefined);

  const http = () => request(app.getHttpServer());
  const pedir = (email: string) =>
    http().post('/auth/forgot-password').send({ email });
  const verificar = (email: string, codigo: string) =>
    http().post('/auth/verify-otp').send({ email, codigo });
  /** El código que "viajó por mail" en el último envío. */
  const ultimoCodigo = () =>
    enviarCodigo.mock.calls[enviarCodigo.mock.calls.length - 1][2] as string;
  /** Pide un código salteando la espera de un minuto: corre hacia atrás lo ya emitido. */
  const pedirSinEspera = async (email: string) => {
    const repo = app.get(getRepositoryToken(Usuario));
    const u = await repo.findOneByOrFail({ email });
    await app
      .get(DataSource)
      .query(
        'UPDATE password_reset_otp SET createdAt = DATE_SUB(createdAt, INTERVAL 2 MINUTE) WHERE usuarioId = ?',
        [u.id],
      );
    enviarCodigo.mockClear();
    await pedir(email);
    return ultimoCodigo();
  };
  const codigoMalo = (bueno: string) =>
    bueno === '000000' ? '111111' : '000000';

  beforeAll(async () => {
    app = await createTestApp([
      {
        provide: MailService,
        useValue: { enviarCodigoRecuperacion: enviarCodigo },
      },
    ]);
    for (const n of ['flujo', 'intentos', 'reenvio', 'inactivo']) {
      await crearUsuario(app, {
        email: `otp.${n}@e2e.com`,
        tipoUsuario: TipoUsuario.PCD,
      });
    }
  });

  beforeEach(() => enviarCodigo.mockClear());

  afterAll(async () => {
    await app.close();
  });

  describe('POST /auth/forgot-password', () => {
    it('manda el código al email registrado y responde el mensaje genérico', async () => {
      const res = await pedir('otp.flujo@e2e.com');

      expect(res.status).toBe(200);
      expect(res.body.message).toBe(PasswordResetService.MENSAJE_SOLICITUD);
      expect(enviarCodigo).toHaveBeenCalledTimes(1);
      expect(enviarCodigo.mock.calls[0][0]).toBe('otp.flujo@e2e.com');
      expect(ultimoCodigo()).toMatch(/^\d{6}$/);
    });

    it('un email que no existe da la MISMA respuesta y no manda nada', async () => {
      const res = await pedir('nadie@e2e.com');

      expect(res.status).toBe(200);
      expect(res.body.message).toBe(PasswordResetService.MENSAJE_SOLICITUD);
      expect(enviarCodigo).not.toHaveBeenCalled();
    });

    it('un usuario inactivo da la misma respuesta y no manda nada', async () => {
      const repo: Repository<Usuario> = app.get(getRepositoryToken(Usuario));
      await repo.update(
        { email: 'otp.inactivo@e2e.com' },
        { estado: EstadoUsuario.INACTIVO },
      );

      const res = await pedir('otp.inactivo@e2e.com');

      expect(res.status).toBe(200);
      expect(res.body.message).toBe(PasswordResetService.MENSAJE_SOLICITUD);
      expect(enviarCodigo).not.toHaveBeenCalled();
    });

    it('no reenvía antes de un minuto', async () => {
      await pedir('otp.reenvio@e2e.com');
      await pedir('otp.reenvio@e2e.com');

      expect(enviarCodigo).toHaveBeenCalledTimes(1);
    });

    it('400: email mal formado', async () => {
      expect((await pedir('no-es-un-email')).status).toBe(400);
    });
  });

  describe('POST /auth/verify-otp', () => {
    it('400: el código no tiene 6 dígitos', async () => {
      expect((await verificar('otp.flujo@e2e.com', '123')).status).toBe(400);
      expect((await verificar('otp.flujo@e2e.com', 'abcdef')).status).toBe(400);
    });

    it('un código incorrecto y un email desconocido dan el mismo 400', async () => {
      await pedir('otp.intentos@e2e.com');
      const malo = codigoMalo(ultimoCodigo());

      const a = await verificar('otp.intentos@e2e.com', malo);
      const b = await verificar('nadie@e2e.com', '123456');

      expect(a.status).toBe(400);
      expect(b.status).toBe(400);
      expect(a.body.message).toBe(b.body.message);
    });

    it('tras 5 intentos fallidos el código deja de servir, aunque sea el correcto', async () => {
      const user = 'otp.intentos@e2e.com';
      const bueno = await pedirSinEspera(user);

      for (let i = 0; i < 5; i++) {
        expect((await verificar(user, codigoMalo(bueno))).status).toBe(400);
      }
      expect((await verificar(user, bueno)).status).toBe(400);
    });
  });

  describe('flujo completo', () => {
    it('pedir código, verificarlo y cambiar la contraseña: la vieja deja de servir y las sesiones se cierran', async () => {
      const email = 'otp.flujo@e2e.com';
      const sesion = await http()
        .post('/auth/login')
        .send({ email, password: PASSWORD_DEFAULT });
      expect(sesion.status).toBe(200);

      // 1) Se pide el código.
      const codigo = await pedirSinEspera(email);

      // 2) Código correcto: devuelve el token de reseteo.
      const ver = await verificar(email, codigo);
      expect(ver.status).toBe(200);
      const { resetToken } = ver.body;
      expect(typeof resetToken).toBe('string');

      // 3) Contraseña demasiado corta: 400 y el token sigue sirviendo.
      const corta = await http()
        .post('/auth/reset-password')
        .send({ resetToken, newPassword: '123' });
      expect(corta.status).toBe(400);

      // 4) Contraseña nueva.
      const reset = await http()
        .post('/auth/reset-password')
        .send({ resetToken, newPassword: 'NuevaClave456!' });
      expect(reset.status).toBe(200);

      // 5) La nueva entra, la vieja no.
      const conNueva = await http()
        .post('/auth/login')
        .send({ email, password: 'NuevaClave456!' });
      expect(conNueva.status).toBe(200);
      const conVieja = await http()
        .post('/auth/login')
        .send({ email, password: PASSWORD_DEFAULT });
      expect(conVieja.status).toBe(401);

      // 6) La sesión anterior se cerró.
      const refresh = await http()
        .post('/auth/refresh')
        .send({ refreshToken: sesion.body.refresh_token });
      expect(refresh.status).toBe(401);

      // 7) El token no se puede usar dos veces, y el código tampoco.
      const otraVez = await http()
        .post('/auth/reset-password')
        .send({ resetToken, newPassword: 'OtraClave789!' });
      expect(otraVez.status).toBe(400);
      expect((await verificar(email, codigo)).status).toBe(400);
    });

    it('400: un token inventado', async () => {
      const res = await http()
        .post('/auth/reset-password')
        .send({ resetToken: 'no.es.un.token', newPassword: 'NuevaClave456!' });
      expect(res.status).toBe(400);
    });

    it('un token de acceso común no sirve para restablecer', async () => {
      const login = await http()
        .post('/auth/login')
        .send({ email: 'otp.reenvio@e2e.com', password: PASSWORD_DEFAULT });
      const res = await http().post('/auth/reset-password').send({
        resetToken: login.body.access_token,
        newPassword: 'NuevaClave456!',
      });
      expect(res.status).toBe(400);
    });
  });
});

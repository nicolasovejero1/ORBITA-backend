/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment -- jest.fn().mock.calls y los dobles de repositorio no están tipados */
import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { EstadoUsuario } from '../common/enums/estado-usuario.enum';
import { MailService } from '../mail/mail.service';
import { Usuario } from '../users/entities/usuario.entity';
import { PasswordResetOtp } from './entities/password-reset-otp.entity';
import { PasswordResetService } from './password-reset.service';
import { SesionesService } from './sesiones.service';

jest.mock('bcrypt');

describe('PasswordResetService', () => {
  let service: PasswordResetService;

  const usuario = {
    id: 7,
    email: 'ana@test.com',
    nombre: 'Ana',
    estado: EstadoUsuario.ACTIVO,
  } as Usuario;

  const usuarioRepo = { findOne: jest.fn(), update: jest.fn() };
  const execute = jest.fn();
  const qb = {
    update: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    execute,
  };
  const otpRepo = {
    findOne: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    save: jest.fn((x: unknown) => Promise.resolve(x)),
    create: jest.fn((x: unknown) => x),
    createQueryBuilder: jest.fn(() => qb),
  };
  const mail = {
    enviarCodigoRecuperacion: jest.fn().mockResolvedValue(undefined),
  };
  const sesiones = { revocarTodas: jest.fn().mockResolvedValue(undefined) };
  const config = {
    get: (k: string) => (k === 'JWT_SECRET' ? 'secreto' : undefined),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    otpRepo.save.mockImplementation((x: unknown) => Promise.resolve(x));
    mail.enviarCodigoRecuperacion.mockResolvedValue(undefined);
    execute.mockResolvedValue({ affected: 1 });
    otpRepo.update.mockResolvedValue({ affected: 1 });
    usuarioRepo.findOne.mockResolvedValue(usuario);
    otpRepo.findOne.mockResolvedValue(null);
    (bcrypt.hash as jest.Mock).mockResolvedValue('hash-nuevo');

    const moduleRef = await Test.createTestingModule({
      providers: [
        PasswordResetService,
        JwtService,
        { provide: getRepositoryToken(Usuario), useValue: usuarioRepo },
        { provide: getRepositoryToken(PasswordResetOtp), useValue: otpRepo },
        { provide: ConfigService, useValue: config },
        { provide: MailService, useValue: mail },
        { provide: SesionesService, useValue: sesiones },
      ],
    }).compile();
    service = moduleRef.get(PasswordResetService);
  });

  /** Pide un código y devuelve el código en claro (el que viajó por mail) y la fila guardada. */
  async function pedirCodigo() {
    await service.solicitar('ana@test.com');
    const codigo = mail.enviarCodigoRecuperacion.mock.calls[0][2] as string;
    const guardado = otpRepo.save.mock.calls[0][0] as PasswordResetOtp;
    return { codigo, guardado };
  }

  const vigente = (guardado: PasswordResetOtp, extra = {}) => ({
    ...guardado,
    id: 99,
    expiresAt: new Date(Date.now() + 60_000),
    ...extra,
  });

  describe('solicitar', () => {
    it('manda un código de 6 dígitos y guarda solo su hash', async () => {
      const { codigo, guardado } = await pedirCodigo();

      expect(codigo).toMatch(/^\d{6}$/);
      expect(guardado.codigoHash).toMatch(/^[0-9a-f]{64}$/);
      expect(JSON.stringify(guardado)).not.toContain(codigo);
      expect(guardado.expiresAt.getTime() - guardado.createdAt.getTime()).toBe(
        10 * 60_000,
      );
      expect(mail.enviarCodigoRecuperacion).toHaveBeenCalledWith(
        'ana@test.com',
        'Ana',
        codigo,
        10,
      );
    });

    it('invalida los códigos anteriores sin usar', async () => {
      await service.solicitar('ana@test.com');
      expect(otpRepo.update).toHaveBeenCalledWith(
        expect.objectContaining({ usuarioId: 7 }),
        expect.objectContaining({ usadoAt: expect.any(Date) }),
      );
    });

    it('responde lo mismo y no manda nada si el email no existe', async () => {
      usuarioRepo.findOne.mockResolvedValue(null);
      const res = await service.solicitar('nadie@test.com');
      expect(res.message).toBe(PasswordResetService.MENSAJE_SOLICITUD);
      expect(otpRepo.save).not.toHaveBeenCalled();
      expect(mail.enviarCodigoRecuperacion).not.toHaveBeenCalled();
    });

    it('responde lo mismo y no manda nada si el usuario está inactivo', async () => {
      usuarioRepo.findOne.mockResolvedValue({
        ...usuario,
        estado: EstadoUsuario.INACTIVO,
      });
      const res = await service.solicitar('ana@test.com');
      expect(res.message).toBe(PasswordResetService.MENSAJE_SOLICITUD);
      expect(mail.enviarCodigoRecuperacion).not.toHaveBeenCalled();
    });

    it('no manda otro código antes de que pase un minuto del anterior', async () => {
      otpRepo.findOne.mockResolvedValue({ createdAt: new Date() });
      const res = await service.solicitar('ana@test.com');
      expect(res.message).toBe(PasswordResetService.MENSAJE_SOLICITUD);
      expect(otpRepo.save).not.toHaveBeenCalled();
      expect(mail.enviarCodigoRecuperacion).not.toHaveBeenCalled();
    });

    it('si el correo falla, igual responde bien (no delata nada)', async () => {
      mail.enviarCodigoRecuperacion.mockRejectedValue(new Error('timeout'));
      await expect(service.solicitar('ana@test.com')).resolves.toEqual({
        message: PasswordResetService.MENSAJE_SOLICITUD,
      });
    });
  });

  describe('verificar', () => {
    it('con el código correcto devuelve un token de reseteo', async () => {
      const { codigo, guardado } = await pedirCodigo();
      otpRepo.findOne.mockResolvedValue(vigente(guardado));

      const { resetToken } = await service.verificar('ana@test.com', codigo);
      expect(resetToken.split('.')).toHaveLength(3);
    });

    it('un código incorrecto da 400 y gasta un intento', async () => {
      const { codigo, guardado } = await pedirCodigo();
      otpRepo.findOne.mockResolvedValue(vigente(guardado));
      const otro = codigo === '000000' ? '111111' : '000000';

      await expect(service.verificar('ana@test.com', otro)).rejects.toThrow(
        BadRequestException,
      );
      expect(execute).toHaveBeenCalledTimes(1);
    });

    it('el último intento fallido deja el código inutilizado', async () => {
      const { guardado } = await pedirCodigo();
      otpRepo.findOne.mockResolvedValue(vigente(guardado, { intentos: 4 }));

      await expect(service.verificar('ana@test.com', '123456')).rejects.toThrow(
        BadRequestException,
      );
      expect(otpRepo.update).toHaveBeenLastCalledWith(
        { id: 99 },
        { usadoAt: expect.any(Date) },
      );
    });

    it('con los intentos agotados rechaza aunque el código sea el correcto', async () => {
      const { codigo, guardado } = await pedirCodigo();
      otpRepo.findOne.mockResolvedValue(vigente(guardado, { intentos: 5 }));
      execute.mockResolvedValue({ affected: 0 });

      await expect(service.verificar('ana@test.com', codigo)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('un código vencido da 400', async () => {
      const { codigo, guardado } = await pedirCodigo();
      otpRepo.findOne.mockResolvedValue(
        vigente(guardado, { expiresAt: new Date(Date.now() - 1000) }),
      );
      await expect(service.verificar('ana@test.com', codigo)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('sin un código pedido o con un email desconocido da el mismo 400', async () => {
      await expect(service.verificar('ana@test.com', '123456')).rejects.toThrow(
        'El código es incorrecto o venció',
      );
      usuarioRepo.findOne.mockResolvedValue(null);
      await expect(
        service.verificar('nadie@test.com', '123456'),
      ).rejects.toThrow('El código es incorrecto o venció');
    });
  });

  describe('restablecer', () => {
    async function tokenValido() {
      const { codigo, guardado } = await pedirCodigo();
      otpRepo.findOne.mockResolvedValue(vigente(guardado));
      const { resetToken } = await service.verificar('ana@test.com', codigo);
      jest.clearAllMocks();
      otpRepo.update.mockResolvedValue({ affected: 1 });
      usuarioRepo.findOne.mockResolvedValue(usuario);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hash-nuevo');
      return resetToken;
    }

    it('guarda la contraseña nueva, consume el código y cierra todas las sesiones', async () => {
      const token = await tokenValido();

      const res = await service.restablecer(token, 'nueva123');

      expect(res.message).toContain('Contraseña restablecida');
      expect(otpRepo.update).toHaveBeenCalledWith(
        { id: 99, usuarioId: 7, usadoAt: expect.anything() as unknown },
        { usadoAt: expect.any(Date) },
      );
      expect(usuarioRepo.update).toHaveBeenCalledWith(7, {
        password: 'hash-nuevo',
      });
      expect(sesiones.revocarTodas).toHaveBeenCalledWith(7);
    });

    it('un token inventado da 400', async () => {
      await expect(service.restablecer('basura', 'nueva123')).rejects.toThrow(
        BadRequestException,
      );
      expect(usuarioRepo.update).not.toHaveBeenCalled();
    });

    it('el token sirve una sola vez', async () => {
      const token = await tokenValido();
      otpRepo.update.mockResolvedValue({ affected: 0 });

      await expect(service.restablecer(token, 'nueva123')).rejects.toThrow(
        BadRequestException,
      );
      expect(usuarioRef()).not.toHaveBeenCalled();
    });

    it('un usuario desactivado en el medio no puede cambiarla', async () => {
      const token = await tokenValido();
      usuarioRepo.findOne.mockResolvedValue({
        ...usuario,
        estado: EstadoUsuario.INACTIVO,
      });

      await expect(service.restablecer(token, 'nueva123')).rejects.toThrow(
        BadRequestException,
      );
      expect(usuarioRef()).not.toHaveBeenCalled();
    });
  });

  it('limpiarVencidos borra los códigos de más de un día', async () => {
    await service.limpiarVencidos();
    expect(otpRepo.delete).toHaveBeenCalledTimes(1);
  });

  function usuarioRef() {
    return usuarioRepo.update;
  }
});

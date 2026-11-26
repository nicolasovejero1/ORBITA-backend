import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { SesionesService } from './sesiones.service';
import { Usuario } from '../users/entities/usuario.entity';
import { EstadoUsuario } from '../common/enums/estado-usuario.enum';
import { TipoUsuario } from '../common/enums/tipo-usuario.enum';

jest.mock('bcrypt');

describe('AuthService', () => {
  let service: AuthService;
  const qbMock = {
    addSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    getOne: jest.fn(),
  };
  const usuarioRepo = {
    findOne: jest.fn(),
    createQueryBuilder: jest.fn(() => qbMock),
  };
  const jwtService = { sign: jest.fn().mockReturnValue('signed.jwt.token') };
  const sesionesService = {
    crear: jest.fn().mockResolvedValue({ token: 'refresh-token-plano' }),
    rotar: jest.fn(),
    revocar: jest.fn(),
    revocarTodas: jest.fn(),
  };

  const usuarioBase: Usuario = {
    id: 1,
    dni: '12345678',
    nombre: 'Juan',
    apellido: 'Pérez',
    fechaNacimiento: '1990-01-01',
    telefono: null,
    email: 'juan@test.com',
    direccion: null,
    password: 'hash-guardado',
    tipoUsuario: TipoUsuario.PROFESIONAL,
    esAdministrador: false,
    estado: EstadoUsuario.ACTIVO,
    pushToken: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: getRepositoryToken(Usuario), useValue: usuarioRepo },
        { provide: JwtService, useValue: jwtService },
        { provide: SesionesService, useValue: sesionesService },
      ],
    }).compile();

    service = moduleRef.get(AuthService);
  });

  describe('login', () => {
    it('RN-001: rechaza si el usuario no existe', async () => {
      qbMock.getOne.mockResolvedValue(null);
      await expect(
        service.login({ email: 'x@x.com', password: '123456' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('RN-002: rechaza si el usuario está INACTIVO', async () => {
      qbMock.getOne.mockResolvedValue({
        ...usuarioBase,
        estado: EstadoUsuario.INACTIVO,
      });
      await expect(
        service.login({ email: usuarioBase.email, password: '123456' }),
      ).rejects.toThrow('Usuario inactivo');
    });

    it('RN-003: rechaza si el password no coincide', async () => {
      qbMock.getOne.mockResolvedValue(usuarioBase);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);
      await expect(
        service.login({ email: usuarioBase.email, password: 'incorrecta' }),
      ).rejects.toThrow('Credenciales inválidas');
    });

    it('login exitoso: firma el JWT y crea una sesión (refresh token)', async () => {
      qbMock.getOne.mockResolvedValue(usuarioBase);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const resultado = await service.login({
        email: usuarioBase.email,
        password: '123456',
      });

      expect(resultado.access_token).toBe('signed.jwt.token');
      expect(resultado.refresh_token).toBe('refresh-token-plano');
      expect(resultado.usuario.email).toBe(usuarioBase.email);
      expect(sesionesService.crear).toHaveBeenCalledWith(
        usuarioBase.id,
        undefined,
      );
    });

    it('calcula esAdministrador=true si tipoUsuario es ADMINISTRADOR, aunque el flag sea false', async () => {
      qbMock.getOne.mockResolvedValue({
        ...usuarioBase,
        tipoUsuario: TipoUsuario.ADMINISTRADOR,
        esAdministrador: false,
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const resultado = await service.login({
        email: usuarioBase.email,
        password: '123456',
      });

      expect(resultado.usuario.esAdministrador).toBe(true);
    });
  });

  describe('refresh', () => {
    it('corta el acceso si la cuenta fue desactivada después de emitido el refresh token', async () => {
      sesionesService.rotar.mockResolvedValue({
        token: 'nuevo-refresh',
        usuarioId: usuarioBase.id,
      });
      usuarioRepo.findOne.mockResolvedValue({
        ...usuarioBase,
        estado: EstadoUsuario.INACTIVO,
      });

      await expect(service.refresh('token-viejo')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('rota el refresh token y devuelve un access_token nuevo', async () => {
      sesionesService.rotar.mockResolvedValue({
        token: 'nuevo-refresh',
        usuarioId: usuarioBase.id,
      });
      usuarioRepo.findOne.mockResolvedValue(usuarioBase);

      const resultado = await service.refresh('token-viejo');

      expect(resultado.refresh_token).toBe('nuevo-refresh');
      expect(sesionesService.rotar).toHaveBeenCalledWith(
        'token-viejo',
        undefined,
      );
    });
  });

  it('logout delega la revocación puntual en SesionesService', async () => {
    await service.logout('token-a-revocar');
    expect(sesionesService.revocar).toHaveBeenCalledWith('token-a-revocar');
  });

  it('logoutAll revoca todas las sesiones del usuario', async () => {
    await service.logoutAll(usuarioBase.id);
    expect(sesionesService.revocarTodas).toHaveBeenCalledWith(usuarioBase.id);
  });
});

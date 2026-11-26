/* eslint-disable @typescript-eslint/no-unsafe-assignment -- jest.fn() sin tipar en los mocks de repositorio */
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { UsersService } from './users.service';

jest.mock('bcrypt');
import { Usuario } from './entities/usuario.entity';
import { Profesional } from './entities/profesional.entity';
import { Pcd } from './entities/pcd.entity';
import { TutorPcd } from '../vinculos/entities/tutor-pcd.entity';
import { Actividad } from '../actividades/entities/actividad.entity';
import { VinculoAccessService } from '../common/services/vinculo-access.service';
import { SesionesService } from '../auth/sesiones.service';
import { TipoUsuario } from '../common/enums/tipo-usuario.enum';
import { EstadoUsuario } from '../common/enums/estado-usuario.enum';

describe('UsersService', () => {
  let service: UsersService;

  const qbMock = {
    addSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    getOne: jest.fn(),
  };
  const usuarioRepo = {
    findOne: jest.fn(),
    find: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    createQueryBuilder: jest.fn(() => qbMock),
  };
  const tutorPcdRepo = { count: jest.fn() };
  const actividadRepo = { count: jest.fn() };
  const vinculoAccess = { assertVinculoActivo: jest.fn() };
  const sesionesService = { revocarTodas: jest.fn() };

  // Fake EntityManager: create() devuelve el objeto tal cual, save() le agrega un id si falta.
  const managerStub = {
    create: jest.fn((_entity: unknown, data: Record<string, unknown>) => data),
    save: jest.fn((data: Record<string, unknown>) =>
      Promise.resolve({ id: data.id ?? 1, ...data }),
    ),
    update: jest.fn(),
    findOne: jest.fn(),
    exists: jest.fn().mockResolvedValue(true),
  };
  const dataSource = {
    transaction: jest.fn((cb: (m: typeof managerStub) => unknown) =>
      cb(managerStub),
    ),
  };

  const dtoBase = {
    nombre: 'Juan',
    apellido: 'Pérez',
    dni: '12345678',
    email: 'juan@test.com',
    password: 'password123',
    fechaNacimiento: '1990-01-01',
    tipoUsuario: TipoUsuario.PCD,
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-value');
    const moduleRef = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: getRepositoryToken(Usuario), useValue: usuarioRepo },
        { provide: getRepositoryToken(TutorPcd), useValue: tutorPcdRepo },
        { provide: getRepositoryToken(Actividad), useValue: actividadRepo },
        { provide: DataSource, useValue: dataSource },
        { provide: VinculoAccessService, useValue: vinculoAccess },
        { provide: SesionesService, useValue: sesionesService },
      ],
    }).compile();
    service = moduleRef.get(UsersService);
  });

  describe('create (RN-004, RN-005)', () => {
    it('rechaza si ya existe un usuario con el mismo email o dni', async () => {
      usuarioRepo.findOne.mockResolvedValue({ id: 99 });
      await expect(service.create(dtoBase)).rejects.toThrow(ConflictException);
    });

    it('rechaza esAdministrador=true si tipoUsuario no es PROFESIONAL', async () => {
      usuarioRepo.findOne.mockResolvedValue(null);
      await expect(
        service.create({ ...dtoBase, esAdministrador: true }),
      ).rejects.toThrow(BadRequestException);
    });

    it('crea el Usuario y su perfil relacionado en una transacción', async () => {
      usuarioRepo.findOne.mockResolvedValue(null);
      managerStub.findOne.mockResolvedValue({ id: 1, ...dtoBase });

      await service.create(dtoBase);

      expect(dataSource.transaction).toHaveBeenCalled();
      // Se creó el Usuario y, por ser PCD, también el perfil Pcd.
      expect(managerStub.save).toHaveBeenCalledTimes(2);
    });

    it('crea el perfil Profesional cuando tipoUsuario es PROFESIONAL', async () => {
      usuarioRepo.findOne.mockResolvedValue(null);
      managerStub.findOne.mockResolvedValue({ id: 1 });

      await service.create({
        ...dtoBase,
        tipoUsuario: TipoUsuario.PROFESIONAL,
        matricula: 'MP-1',
        especialidadId: 1,
      });

      expect(managerStub.save).toHaveBeenCalledTimes(2);
    });

    it('crea el perfil Tutor cuando tipoUsuario es TUTOR', async () => {
      usuarioRepo.findOne.mockResolvedValue(null);
      managerStub.findOne.mockResolvedValue({ id: 1 });

      await service.create({
        ...dtoBase,
        tipoUsuario: TipoUsuario.TUTOR,
      });

      expect(managerStub.save).toHaveBeenCalledTimes(2);
    });
  });

  describe('findAll', () => {
    it('sin filtro: consulta sin where', async () => {
      usuarioRepo.find.mockResolvedValue([]);
      await service.findAll();
      expect(usuarioRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({ where: undefined }),
      );
    });

    it('con filtro de tipo: usa where tipoUsuario', async () => {
      usuarioRepo.find.mockResolvedValue([]);
      await service.findAll(TipoUsuario.PROFESIONAL);
      expect(usuarioRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tipoUsuario: TipoUsuario.PROFESIONAL },
        }),
      );
    });
  });

  describe('update', () => {
    it('lanza 404 si el usuario no existe', async () => {
      usuarioRepo.findOne.mockResolvedValue(null);
      await expect(service.update(999, { nombre: 'x' })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('PROFESIONAL: actualiza también la tabla Profesional', async () => {
      usuarioRepo.findOne.mockResolvedValue({
        id: 1,
        tipoUsuario: TipoUsuario.PROFESIONAL,
      });
      managerStub.findOne.mockResolvedValue({ id: 1 });
      await service.update(1, { especialidadId: 3 });
      expect(managerStub.update).toHaveBeenCalledWith(
        Profesional,
        { userId: 1 },
        { especialidadId: 3 },
      );
    });

    it('PROFESIONAL: rechaza una especialidad que no existe', async () => {
      usuarioRepo.findOne.mockResolvedValue({
        id: 1,
        tipoUsuario: TipoUsuario.PROFESIONAL,
      });
      managerStub.exists.mockResolvedValueOnce(false);
      await expect(service.update(1, { especialidadId: 99 })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('PCD: actualiza también la tabla Pcd', async () => {
      usuarioRepo.findOne.mockResolvedValue({
        id: 3,
        tipoUsuario: TipoUsuario.PCD,
      });
      managerStub.findOne.mockResolvedValue({ id: 3 });
      await service.update(3, { grado: 'Severo' });
      expect(managerStub.update).toHaveBeenCalledWith(
        Pcd,
        { userId: 3 },
        { grado: 'Severo' },
      );
    });
  });

  describe('findMe / updateMe', () => {
    const caller = {
      id: 7,
      email: 'x',
      tipoUsuario: TipoUsuario.PCD,
      esAdministrador: false,
    };

    it('findMe: lanza 404 si el usuario no existe', async () => {
      usuarioRepo.findOne.mockResolvedValue(null);
      await expect(service.findMe(caller)).rejects.toThrow(NotFoundException);
    });

    it('findMe: devuelve el perfil sin password', async () => {
      usuarioRepo.findOne.mockResolvedValue({
        id: 7,
        email: 'x',
        password: 'hash',
        nombre: 'X',
      });
      const result = await service.findMe(caller);
      expect(result).not.toHaveProperty('password');
    });

    it('updateMe: rechaza si el nuevo email ya está en uso por otro usuario', async () => {
      usuarioRepo.findOne.mockResolvedValueOnce({ id: 99 });
      await expect(
        service.updateMe({ email: 'ocupado@test.com' }, caller),
      ).rejects.toThrow(ConflictException);
    });

    it('updateMe: flujo feliz sin cambiar el email (no chequea unicidad)', async () => {
      usuarioRepo.findOne.mockResolvedValue({ id: 7, nombre: 'Nuevo nombre' });
      await service.updateMe({ nombre: 'Nuevo nombre' }, caller);
      expect(usuarioRepo.update).toHaveBeenCalledWith(7, {
        nombre: 'Nuevo nombre',
      });
    });

    it('updateMe: flujo feliz cambiando el email a uno libre', async () => {
      usuarioRepo.findOne
        .mockResolvedValueOnce(null) // chequeo de email libre
        .mockResolvedValueOnce({ id: 7, email: 'nuevo@test.com' }); // findMe posterior
      await service.updateMe({ email: 'nuevo@test.com' }, caller);
      expect(usuarioRepo.update).toHaveBeenCalledWith(7, {
        email: 'nuevo@test.com',
      });
    });
  });

  describe('findOne (RN-007)', () => {
    it('Admin puede ver cualquier usuario sin chequear vínculo', async () => {
      usuarioRepo.findOne.mockResolvedValue({ id: 5 });
      await service.findOne(5, {
        id: 1,
        email: 'a',
        tipoUsuario: TipoUsuario.ADMINISTRADOR,
        esAdministrador: true,
      });
      expect(vinculoAccess.assertVinculoActivo).not.toHaveBeenCalled();
    });

    it('Profesional sin vínculo activo recibe 403 (propagado desde VinculoAccessService)', async () => {
      usuarioRepo.findOne.mockResolvedValue({ id: 5 });
      vinculoAccess.assertVinculoActivo.mockRejectedValue(
        new Error('sin vínculo'),
      );
      await expect(
        service.findOne(5, {
          id: 2,
          email: 'p',
          tipoUsuario: TipoUsuario.PROFESIONAL,
          esAdministrador: false,
        }),
      ).rejects.toThrow('sin vínculo');
    });

    it('lanza 404 si el usuario no existe', async () => {
      usuarioRepo.findOne.mockResolvedValue(null);
      await expect(
        service.findOne(999, {
          id: 1,
          email: 'a',
          tipoUsuario: TipoUsuario.ADMINISTRADOR,
          esAdministrador: true,
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove (RN-043)', () => {
    it('rechaza eliminar un Profesional con actividades creadas', async () => {
      usuarioRepo.findOne.mockResolvedValue({
        id: 5,
        tipoUsuario: TipoUsuario.PROFESIONAL,
      });
      actividadRepo.count.mockResolvedValue(3);
      await expect(service.remove(5)).rejects.toThrow(ConflictException);
    });

    it('rechaza eliminar un PCD con actividades asignadas', async () => {
      usuarioRepo.findOne.mockResolvedValue({
        id: 6,
        tipoUsuario: TipoUsuario.PCD,
      });
      actividadRepo.count.mockResolvedValue(1);
      await expect(service.remove(6)).rejects.toThrow(ConflictException);
    });

    it('rechaza eliminar un Tutor con PCDs vinculados', async () => {
      usuarioRepo.findOne.mockResolvedValue({
        id: 3,
        tipoUsuario: TipoUsuario.TUTOR,
      });
      tutorPcdRepo.count.mockResolvedValue(2);
      await expect(service.remove(3)).rejects.toThrow(ConflictException);
    });

    it('permite eliminar un Tutor sin vínculos', async () => {
      usuarioRepo.findOne.mockResolvedValue({
        id: 3,
        tipoUsuario: TipoUsuario.TUTOR,
      });
      tutorPcdRepo.count.mockResolvedValue(0);
      await expect(service.remove(3)).resolves.toEqual(
        expect.objectContaining({ message: expect.any(String) }),
      );
      expect(usuarioRepo.delete).toHaveBeenCalledWith(3);
    });
  });

  describe('updateStatus', () => {
    it('al desactivar la cuenta, revoca todas las sesiones activas', async () => {
      usuarioRepo.findOne.mockResolvedValue({ id: 4 });
      await service.updateStatus(4, { estado: EstadoUsuario.INACTIVO });
      expect(sesionesService.revocarTodas).toHaveBeenCalledWith(4);
    });
  });

  describe('changeOwnPassword', () => {
    const caller = {
      id: 7,
      email: 'x',
      tipoUsuario: TipoUsuario.PCD,
      esAdministrador: false,
    };

    it('rechaza si la contraseña actual no coincide', async () => {
      qbMock.getOne.mockResolvedValue({ id: 7, password: 'hash-real' });
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);
      await expect(
        service.changeOwnPassword(caller, {
          currentPassword: 'mala',
          newPassword: 'nueva123',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('cambia la contraseña y revoca todas las sesiones', async () => {
      qbMock.getOne.mockResolvedValue({ id: 7, password: 'hash-real' });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      await service.changeOwnPassword(caller, {
        currentPassword: 'buena',
        newPassword: 'nueva123',
      });

      expect(usuarioRepo.update).toHaveBeenCalledWith(
        7,
        expect.objectContaining({ password: expect.any(String) }),
      );
      expect(sesionesService.revocarTodas).toHaveBeenCalledWith(7);
    });
  });

  describe('resetPassword (Admin)', () => {
    it('no requiere la contraseña anterior y también revoca sesiones', async () => {
      usuarioRepo.findOne.mockResolvedValue({ id: 8 });
      await service.resetPassword(8, { newPassword: 'otraNueva123' });
      expect(usuarioRepo.update).toHaveBeenCalledWith(
        8,
        expect.objectContaining({ password: expect.any(String) }),
      );
      expect(sesionesService.revocarTodas).toHaveBeenCalledWith(8);
    });
  });
});

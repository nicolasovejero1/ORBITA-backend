import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { VinculosService } from './vinculos.service';
import { Usuario } from '../users/entities/usuario.entity';
import { Actividad } from '../actividades/entities/actividad.entity';
import { Vinculo } from './entities/vinculo.entity';
import { TutorPcd } from './entities/tutor-pcd.entity';
import { TipoUsuario } from '../common/enums/tipo-usuario.enum';
import { EstadoVinculo } from '../common/enums/estado-vinculo.enum';
import { RolProfesionalVinculo } from '../common/enums/rol-profesional-vinculo.enum';
import { VinculoAccessService } from '../common/services/vinculo-access.service';
import type { CallerInfo } from '../auth/decorators/current-user.decorator';

describe('VinculosService', () => {
  let service: VinculosService;

  const usuarioRepo = { findOne: jest.fn() };
  const vinculoRepo = {
    exists: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
    save: jest.fn(),
    create: jest.fn((d: unknown) => d),
    update: jest.fn(),
    delete: jest.fn(),
  };
  const tutorPcdRepo = {
    findOne: jest.fn(),
    find: jest.fn(),
    save: jest.fn(),
    create: jest.fn((d: unknown) => d),
    update: jest.fn(),
    delete: jest.fn(),
  };
  const actividadRepo = { count: jest.fn() };
  const vinculoAccess = { esCabeceraActivo: jest.fn() };

  const admin: CallerInfo = {
    id: 1,
    email: 'admin',
    tipoUsuario: TipoUsuario.ADMINISTRADOR,
    esAdministrador: true,
  };
  const cabecera: CallerInfo = {
    id: 10,
    email: 'cabecera',
    tipoUsuario: TipoUsuario.PROFESIONAL,
    esAdministrador: false,
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    vinculoRepo.exists.mockResolvedValue(false);
    vinculoAccess.esCabeceraActivo.mockResolvedValue(false);
    const moduleRef = await Test.createTestingModule({
      providers: [
        VinculosService,
        { provide: getRepositoryToken(Usuario), useValue: usuarioRepo },
        { provide: getRepositoryToken(Vinculo), useValue: vinculoRepo },
        { provide: getRepositoryToken(TutorPcd), useValue: tutorPcdRepo },
        { provide: getRepositoryToken(Actividad), useValue: actividadRepo },
        { provide: VinculoAccessService, useValue: vinculoAccess },
      ],
    }).compile();
    service = moduleRef.get(VinculosService);
  });

  describe('createVinculo (RN-008, RN-009)', () => {
    it('rechaza si pcdId no corresponde a un usuario tipo PCD', async () => {
      usuarioRepo.findOne.mockResolvedValue({ tipoUsuario: TipoUsuario.TUTOR });
      await expect(
        service.createVinculo(
          {
            pcdId: 1,
            profesionalId: 2,
            rolProfesional: RolProfesionalVinculo.CABECERA,
          },
          admin,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('rechaza un vínculo duplicado para el mismo par (pcdId, profesionalId)', async () => {
      usuarioRepo.findOne
        .mockResolvedValueOnce({ tipoUsuario: TipoUsuario.PCD })
        .mockResolvedValueOnce({ tipoUsuario: TipoUsuario.PROFESIONAL });
      vinculoRepo.findOne.mockResolvedValue({ pcdId: 1, profesionalId: 2 });

      await expect(
        service.createVinculo(
          {
            pcdId: 1,
            profesionalId: 2,
            rolProfesional: RolProfesionalVinculo.CABECERA,
          },
          admin,
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('crea el vínculo con estado ACTIVO por defecto (a cargo de la entidad)', async () => {
      usuarioRepo.findOne
        .mockResolvedValueOnce({ tipoUsuario: TipoUsuario.PCD })
        .mockResolvedValueOnce({ tipoUsuario: TipoUsuario.PROFESIONAL });
      vinculoRepo.findOne
        .mockResolvedValueOnce(null) // chequeo de duplicado
        .mockResolvedValueOnce({ pcdId: 1, profesionalId: 2 }); // findOneVinculo posterior
      vinculoRepo.save.mockResolvedValue({ pcdId: 1, profesionalId: 2 });

      await service.createVinculo(
        {
          pcdId: 1,
          profesionalId: 2,
          rolProfesional: RolProfesionalVinculo.CABECERA,
        },
        admin,
      );

      expect(vinculoRepo.save).toHaveBeenCalled();
    });
  });

  describe('médico de cabecera (asigna y gestiona su equipo)', () => {
    const dtoEspecialista = {
      pcdId: 1,
      profesionalId: 2,
      rolProfesional: RolProfesionalVinculo.ESPECIALISTA,
    };

    it('el cabecera del PCD asigna un especialista', async () => {
      vinculoAccess.esCabeceraActivo.mockResolvedValue(true);
      usuarioRepo.findOne
        .mockResolvedValueOnce({ tipoUsuario: TipoUsuario.PCD })
        .mockResolvedValueOnce({ tipoUsuario: TipoUsuario.PROFESIONAL });
      vinculoRepo.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ pcdId: 1, profesionalId: 2 });
      vinculoRepo.save.mockResolvedValue({ pcdId: 1, profesionalId: 2 });

      await service.createVinculo(dtoEspecialista, cabecera);

      expect(vinculoAccess.esCabeceraActivo).toHaveBeenCalledWith(10, 1);
      expect(vinculoRepo.save).toHaveBeenCalled();
    });

    it('un profesional que no es cabecera de ese PCD no asigna a nadie', async () => {
      await expect(
        service.createVinculo(dtoEspecialista, cabecera),
      ).rejects.toThrow(ForbiddenException);
      expect(vinculoRepo.save).not.toHaveBeenCalled();
    });

    it('el cabecera no puede asignar a otro cabecera', async () => {
      vinculoAccess.esCabeceraActivo.mockResolvedValue(true);
      await expect(
        service.createVinculo(
          {
            ...dtoEspecialista,
            rolProfesional: RolProfesionalVinculo.CABECERA,
          },
          cabecera,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('el Administrador no puede asignar un segundo cabecera activo', async () => {
      usuarioRepo.findOne
        .mockResolvedValueOnce({ tipoUsuario: TipoUsuario.PCD })
        .mockResolvedValueOnce({ tipoUsuario: TipoUsuario.PROFESIONAL });
      vinculoRepo.exists.mockResolvedValue(true);
      await expect(
        service.createVinculo(
          {
            ...dtoEspecialista,
            rolProfesional: RolProfesionalVinculo.CABECERA,
          },
          admin,
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('el cabecera desactiva a un especialista de su PCD', async () => {
      vinculoAccess.esCabeceraActivo.mockResolvedValue(true);
      vinculoRepo.findOne.mockResolvedValue({
        pcdId: 1,
        profesionalId: 2,
        rolProfesional: RolProfesionalVinculo.ESPECIALISTA,
      });
      await service.updateStatusVinculo(
        1,
        2,
        { estado: EstadoVinculo.INACTIVO },
        cabecera,
      );
      expect(vinculoRepo.update).toHaveBeenCalled();
    });

    it('el cabecera no puede modificar ni quitar a un cabecera', async () => {
      vinculoAccess.esCabeceraActivo.mockResolvedValue(true);
      vinculoRepo.findOne.mockResolvedValue({
        pcdId: 1,
        profesionalId: 2,
        rolProfesional: RolProfesionalVinculo.CABECERA,
      });
      await expect(
        service.updateStatusVinculo(
          1,
          2,
          { estado: EstadoVinculo.INACTIVO },
          cabecera,
        ),
      ).rejects.toThrow(ForbiddenException);
      await expect(service.removeVinculo(1, 2, cabecera)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('un cabecera de otro PCD no gestiona este equipo', async () => {
      vinculoRepo.findOne.mockResolvedValue({
        pcdId: 1,
        profesionalId: 2,
        rolProfesional: RolProfesionalVinculo.ESPECIALISTA,
      });
      await expect(service.removeVinculo(1, 2, cabecera)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('reactivar un cabecera no deja dos cabecera activos', async () => {
      vinculoRepo.findOne.mockResolvedValue({
        pcdId: 1,
        profesionalId: 2,
        rolProfesional: RolProfesionalVinculo.CABECERA,
      });
      vinculoRepo.exists.mockResolvedValue(true);
      await expect(
        service.updateStatusVinculo(
          1,
          2,
          { estado: EstadoVinculo.ACTIVO },
          admin,
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('listado: el cabecera ve todo el equipo de su PCD; el resto solo lo suyo', async () => {
      vinculoRepo.find.mockResolvedValue([]);
      vinculoAccess.esCabeceraActivo.mockResolvedValue(true);
      await service.findAllParaUsuario(cabecera, 1);
      expect(vinculoRepo.find).toHaveBeenLastCalledWith(
        expect.objectContaining({ where: { pcdId: 1 } }),
      );

      vinculoAccess.esCabeceraActivo.mockResolvedValue(false);
      await service.findAllParaUsuario(cabecera, 1, 99);
      expect(vinculoRepo.find).toHaveBeenLastCalledWith(
        expect.objectContaining({ where: { pcdId: 1, profesionalId: 10 } }),
      );

      await service.findAllParaUsuario(admin, undefined, 99);
      expect(vinculoRepo.find).toHaveBeenLastCalledWith(
        expect.objectContaining({ where: { profesionalId: 99 } }),
      );
    });
  });

  describe('removeVinculo (RN-010)', () => {
    it('lanza 404 si el vínculo no existe', async () => {
      vinculoRepo.findOne.mockResolvedValue(null);
      await expect(service.removeVinculo(1, 2, admin)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('rechaza eliminar si el profesional tiene actividades creadas para ese PCD', async () => {
      vinculoRepo.findOne.mockResolvedValue({ pcdId: 1, profesionalId: 2 });
      actividadRepo.count.mockResolvedValue(1);
      await expect(service.removeVinculo(1, 2, admin)).rejects.toThrow(
        ConflictException,
      );
    });

    it('elimina el vínculo si existe y no tiene actividades dependientes', async () => {
      vinculoRepo.findOne.mockResolvedValue({ pcdId: 1, profesionalId: 2 });
      actividadRepo.count.mockResolvedValue(0);
      await service.removeVinculo(1, 2, admin);
      expect(vinculoRepo.delete).toHaveBeenCalledWith({
        pcdId: 1,
        profesionalId: 2,
      });
    });
  });

  describe('removeTutorPcd (validación simétrica agregada en BackendV3)', () => {
    it('lanza 404 si el vínculo tutor-pcd no existe', async () => {
      tutorPcdRepo.findOne.mockResolvedValue(null);
      await expect(service.removeTutorPcd(1, 2)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('rechaza eliminar si el tutor tiene actividades creadas para ese PCD', async () => {
      tutorPcdRepo.findOne.mockResolvedValue({ tutorId: 1, pcdId: 2 });
      actividadRepo.count.mockResolvedValue(2);
      await expect(service.removeTutorPcd(1, 2)).rejects.toThrow(
        ConflictException,
      );
    });

    it('elimina el vínculo tutor-pcd si existe y no tiene actividades dependientes', async () => {
      tutorPcdRepo.findOne.mockResolvedValue({ tutorId: 1, pcdId: 2 });
      actividadRepo.count.mockResolvedValue(0);
      await service.removeTutorPcd(1, 2);
      expect(tutorPcdRepo.delete).toHaveBeenCalledWith({
        tutorId: 1,
        pcdId: 2,
      });
    });
  });

  describe('findOneVinculo / findAllVinculos', () => {
    it('findOneVinculo devuelve el vínculo si existe', async () => {
      vinculoRepo.findOne.mockResolvedValue({ pcdId: 1, profesionalId: 2 });
      await expect(service.findOneVinculo(1, 2)).resolves.toEqual({
        pcdId: 1,
        profesionalId: 2,
      });
    });

    it('findAllVinculos arma el where solo con los filtros definidos', async () => {
      vinculoRepo.find.mockResolvedValue([]);
      await service.findAllVinculos(1, undefined, EstadoVinculo.ACTIVO);
      expect(vinculoRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { pcdId: 1, estado: EstadoVinculo.ACTIVO },
        }),
      );
    });
  });

  describe('updateStatusVinculo', () => {
    it('lanza 404 si el vínculo no existe', async () => {
      vinculoRepo.findOne.mockResolvedValue(null);
      await expect(
        service.updateStatusVinculo(
          1,
          2,
          { estado: EstadoVinculo.INACTIVO },
          admin,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('flujo feliz: actualiza el estado y devuelve el vínculo actualizado', async () => {
      vinculoRepo.findOne
        .mockResolvedValueOnce({ pcdId: 1, profesionalId: 2 })
        .mockResolvedValueOnce({
          pcdId: 1,
          profesionalId: 2,
          estado: EstadoVinculo.INACTIVO,
        });
      const result = await service.updateStatusVinculo(
        1,
        2,
        { estado: EstadoVinculo.INACTIVO },
        admin,
      );
      expect(vinculoRepo.update).toHaveBeenCalledWith(
        { pcdId: 1, profesionalId: 2 },
        { estado: EstadoVinculo.INACTIVO },
      );
      expect(result.estado).toBe(EstadoVinculo.INACTIVO);
    });
  });

  describe('createTutorPcd', () => {
    it('rechaza si el usuario tutorId no es de tipo TUTOR', async () => {
      usuarioRepo.findOne.mockResolvedValue({ tipoUsuario: TipoUsuario.PCD });
      await expect(
        service.createTutorPcd({ tutorId: 1, pcdId: 2, parentesco: 'Madre' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rechaza un vínculo tutor-PCD duplicado', async () => {
      usuarioRepo.findOne
        .mockResolvedValueOnce({ tipoUsuario: TipoUsuario.TUTOR })
        .mockResolvedValueOnce({ tipoUsuario: TipoUsuario.PCD });
      tutorPcdRepo.findOne.mockResolvedValue({ tutorId: 1, pcdId: 2 });
      await expect(
        service.createTutorPcd({ tutorId: 1, pcdId: 2, parentesco: 'Madre' }),
      ).rejects.toThrow(ConflictException);
    });

    it('flujo feliz: crea el vínculo tutor-PCD', async () => {
      usuarioRepo.findOne
        .mockResolvedValueOnce({ tipoUsuario: TipoUsuario.TUTOR })
        .mockResolvedValueOnce({ tipoUsuario: TipoUsuario.PCD });
      tutorPcdRepo.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ tutorId: 1, pcdId: 2 });
      tutorPcdRepo.save.mockResolvedValue({ tutorId: 1, pcdId: 2 });

      await service.createTutorPcd({
        tutorId: 1,
        pcdId: 2,
        parentesco: ' Madre ',
      });
      expect(tutorPcdRepo.create).toHaveBeenCalledWith({
        tutorId: 1,
        pcdId: 2,
        parentesco: 'Madre',
      });
      expect(tutorPcdRepo.save).toHaveBeenCalled();
    });
  });

  describe('findAllTutorPcd / updateStatusTutorPcd', () => {
    it('findAllTutorPcd arma el where solo con los filtros definidos', async () => {
      tutorPcdRepo.find.mockResolvedValue([]);
      await service.findAllTutorPcd(undefined, 2, undefined);
      expect(tutorPcdRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({ where: { pcdId: 2 } }),
      );
    });

    it('updateStatusTutorPcd: lanza 404 si no existe', async () => {
      tutorPcdRepo.findOne.mockResolvedValue(null);
      await expect(
        service.updateStatusTutorPcd(1, 2, { estado: EstadoVinculo.INACTIVO }),
      ).rejects.toThrow(NotFoundException);
    });

    it('updateStatusTutorPcd: flujo feliz', async () => {
      tutorPcdRepo.findOne
        .mockResolvedValueOnce({ tutorId: 1, pcdId: 2 })
        .mockResolvedValueOnce({
          tutorId: 1,
          pcdId: 2,
          estado: EstadoVinculo.INACTIVO,
        });
      const result = await service.updateStatusTutorPcd(1, 2, {
        estado: EstadoVinculo.INACTIVO,
      });
      expect(result.estado).toBe(EstadoVinculo.INACTIVO);
    });
  });

  describe('validarVinculoProfesionalPcd (RN-011)', () => {
    it('rechaza si no hay vínculo o no está ACTIVO', async () => {
      vinculoRepo.findOne.mockResolvedValue({
        estado: EstadoVinculo.INACTIVO,
      });
      await expect(service.validarVinculoProfesionalPcd(1, 2)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('permite el acceso si el vínculo está ACTIVO', async () => {
      vinculoRepo.findOne.mockResolvedValue({ estado: EstadoVinculo.ACTIVO });
      await expect(
        service.validarVinculoProfesionalPcd(1, 2),
      ).resolves.toBeUndefined();
    });
  });
});

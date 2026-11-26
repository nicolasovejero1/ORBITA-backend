import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ForbiddenException } from '@nestjs/common';
import { VinculoAccessService } from './vinculo-access.service';
import { Vinculo } from '../../vinculos/entities/vinculo.entity';
import { TutorPcd } from '../../vinculos/entities/tutor-pcd.entity';
import { TipoUsuario } from '../enums/tipo-usuario.enum';
import { EstadoVinculo } from '../enums/estado-vinculo.enum';

describe('VinculoAccessService', () => {
  let service: VinculoAccessService;
  const vinculoRepo = { findOne: jest.fn() };
  const tutorPcdRepo = { findOne: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        VinculoAccessService,
        { provide: getRepositoryToken(Vinculo), useValue: vinculoRepo },
        { provide: getRepositoryToken(TutorPcd), useValue: tutorPcdRepo },
      ],
    }).compile();
    service = moduleRef.get(VinculoAccessService);
  });

  describe('Profesional', () => {
    it('permite el acceso si el vínculo existe y está ACTIVO', async () => {
      vinculoRepo.findOne.mockResolvedValue({ estado: EstadoVinculo.ACTIVO });
      await expect(
        service.assertVinculoActivo(1, TipoUsuario.PROFESIONAL, 2),
      ).resolves.toBeUndefined();
    });

    it('rechaza si el vínculo no existe', async () => {
      vinculoRepo.findOne.mockResolvedValue(null);
      await expect(
        service.assertVinculoActivo(1, TipoUsuario.PROFESIONAL, 2),
      ).rejects.toThrow(ForbiddenException);
    });

    it('rechaza si el vínculo existe pero está INACTIVO', async () => {
      vinculoRepo.findOne.mockResolvedValue({
        estado: EstadoVinculo.INACTIVO,
      });
      await expect(
        service.assertVinculoActivo(1, TipoUsuario.PROFESIONAL, 2),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('Tutor', () => {
    it('permite el acceso si el vínculo tutor-pcd existe y está ACTIVO', async () => {
      tutorPcdRepo.findOne.mockResolvedValue({ estado: EstadoVinculo.ACTIVO });
      await expect(
        service.assertVinculoActivo(1, TipoUsuario.TUTOR, 2),
      ).resolves.toBeUndefined();
    });

    it('rechaza si no existe vínculo tutor-pcd', async () => {
      tutorPcdRepo.findOne.mockResolvedValue(null);
      await expect(
        service.assertVinculoActivo(1, TipoUsuario.TUTOR, 2),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  it('para ADMINISTRADOR o PCD no consulta ningún repositorio (no aplica la regla)', async () => {
    await service.assertVinculoActivo(1, TipoUsuario.ADMINISTRADOR, 2);
    await service.assertVinculoActivo(1, TipoUsuario.PCD, 2);
    expect(vinculoRepo.findOne).not.toHaveBeenCalled();
    expect(tutorPcdRepo.findOne).not.toHaveBeenCalled();
  });

  describe('tieneVinculoActivo', () => {
    it('devuelve true/false en vez de lanzar', async () => {
      vinculoRepo.findOne.mockResolvedValue(null);
      await expect(
        service.tieneVinculoActivo(1, TipoUsuario.PROFESIONAL, 2),
      ).resolves.toBe(false);

      vinculoRepo.findOne.mockResolvedValue({ estado: EstadoVinculo.ACTIVO });
      await expect(
        service.tieneVinculoActivo(1, TipoUsuario.PROFESIONAL, 2),
      ).resolves.toBe(true);
    });
  });
});

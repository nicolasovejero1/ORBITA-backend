import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { UbicacionesService } from './ubicaciones.service';
import { UbicacionesEvents } from './ubicaciones.events';
import { Ubicacion } from './entities/ubicacion.entity';
import { UbicacionCompartida } from './entities/ubicacion-compartida.entity';
import { Usuario } from '../users/entities/usuario.entity';
import { VinculoAccessService } from '../common/services/vinculo-access.service';
import { TipoUsuario } from '../common/enums/tipo-usuario.enum';
import type { CallerInfo } from '../auth/decorators/current-user.decorator';

function caller(overrides: Partial<CallerInfo> = {}): CallerInfo {
  return {
    id: 2,
    email: 'x@x.com',
    tipoUsuario: TipoUsuario.TUTOR,
    esAdministrador: false,
    ...overrides,
  };
}

describe('UbicacionesService', () => {
  let service: UbicacionesService;
  let events: UbicacionesEvents;
  const ubicacionRepo = {
    create: jest.fn((d: unknown) => d),
    save: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
  };
  const compartidaRepo = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn((d: unknown) => d),
    save: jest.fn(),
    delete: jest.fn(),
  };
  const usuarioRepo = { findOne: jest.fn() };
  const vinculoAccessService = { assertVinculoActivo: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        UbicacionesService,
        { provide: getRepositoryToken(Ubicacion), useValue: ubicacionRepo },
        {
          provide: getRepositoryToken(UbicacionCompartida),
          useValue: compartidaRepo,
        },
        { provide: getRepositoryToken(Usuario), useValue: usuarioRepo },
        { provide: VinculoAccessService, useValue: vinculoAccessService },
        UbicacionesEvents,
      ],
    }).compile();
    service = moduleRef.get(UbicacionesService);
    events = moduleRef.get(UbicacionesEvents);
  });

  describe('registrar y avisos por socket', () => {
    it('guarda la ubicación y la publica para el gateway', async () => {
      const guardada = { id: 7, pcdId: 4, latitud: '-34.6', longitud: '-58.4' };
      ubicacionRepo.save.mockResolvedValue(guardada);
      const recibidas: unknown[] = [];
      events.nueva$.subscribe((u) => recibidas.push(u));

      const res = await service.registrar(4, {
        latitud: -34.6,
        longitud: -58.4,
      });

      expect(res).toBe(guardada);
      expect(recibidas).toEqual([guardada]);
    });

    it('al revocar un acceso lo publica para sacar al usuario de la sala', async () => {
      compartidaRepo.findOne.mockResolvedValue({ usuarioId: 2, pcdId: 4 });
      const revocadas: unknown[] = [];
      events.revocada$.subscribe((r) => revocadas.push(r));

      await service.revocar(4, 2);

      expect(revocadas).toEqual([{ usuarioId: 2, pcdId: 4 }]);
    });
  });

  describe('historial', () => {
    const tutorConAcceso = () => {
      compartidaRepo.findOne.mockResolvedValue({ usuarioId: 2, pcdId: 4 });
      ubicacionRepo.find.mockResolvedValue([]);
    };
    const opciones = () =>
      (ubicacionRepo.find.mock.calls as unknown[][])[0][0] as {
        where: Record<string, unknown>;
        order: Record<string, string>;
        take: number;
      };

    it('sin parámetros: las últimas 100, de la más nueva a la más vieja', async () => {
      tutorConAcceso();
      await service.historial(4, caller());
      expect(opciones().where).toEqual({ pcdId: 4 });
      expect(opciones().take).toBe(100);
      expect(opciones().order).toEqual({ fechaHora: 'DESC', id: 'DESC' });
    });

    it('con desde, hasta, límite y cursor arma el filtro', async () => {
      tutorConAcceso();
      await service.historial(4, caller(), {
        desde: '2026-11-02T00:00:00-03:00',
        hasta: '2026-11-02T23:59:59-03:00',
        limite: 50,
        antes: 900,
      });
      const { where, take } = opciones();
      expect(take).toBe(50);
      expect(where.fechaHora).toBeDefined();
      expect(where.id).toBeDefined();
    });

    it('rechaza un rango al revés (400)', async () => {
      tutorConAcceso();
      await expect(
        service.historial(4, caller(), {
          desde: '2026-11-03T00:00:00Z',
          hasta: '2026-11-02T00:00:00Z',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('sin acceso compartido, 403 (no consulta nada)', async () => {
      compartidaRepo.findOne.mockResolvedValue(null);
      await expect(service.historial(4, caller())).rejects.toThrow(
        ForbiddenException,
      );
      expect(ubicacionRepo.find).not.toHaveBeenCalled();
    });
  });

  describe('verificarAccesoLectura (Opción A: opt-in vía UbicacionCompartida)', () => {
    it('el permiso de administrador no da acceso sin ubicación compartida', async () => {
      compartidaRepo.findOne.mockResolvedValue(null);
      await expect(
        service.findUltima(
          4,
          caller({
            tipoUsuario: TipoUsuario.PROFESIONAL,
            esAdministrador: true,
          }),
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('el propio PCD tiene acceso a su ubicación', async () => {
      ubicacionRepo.findOne.mockResolvedValue({ id: 1 });
      await expect(
        service.findUltima(4, caller({ id: 4, tipoUsuario: TipoUsuario.PCD })),
      ).resolves.toBeDefined();
    });

    it('un PCD no tiene acceso a la ubicación de otro PCD', async () => {
      await expect(
        service.findUltima(4, caller({ id: 5, tipoUsuario: TipoUsuario.PCD })),
      ).rejects.toThrow(ForbiddenException);
    });

    it('Tutor/Profesional sin UbicacionCompartida no tiene acceso', async () => {
      compartidaRepo.findOne.mockResolvedValue(null);
      await expect(service.findUltima(4, caller())).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('Tutor/Profesional con UbicacionCompartida sí tiene acceso (sin exigir vínculo)', async () => {
      compartidaRepo.findOne.mockResolvedValue({ usuarioId: 2, pcdId: 4 });
      ubicacionRepo.findOne.mockResolvedValue({ id: 1 });
      await expect(service.findUltima(4, caller())).resolves.toBeDefined();
      expect(vinculoAccessService.assertVinculoActivo).not.toHaveBeenCalled();
    });
  });

  describe('compartir', () => {
    it('rechaza compartir con uno mismo', async () => {
      await expect(service.compartir(4, { usuarioId: 4 })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('rechaza si el usuario destino no existe', async () => {
      usuarioRepo.findOne.mockResolvedValue(null);
      await expect(service.compartir(4, { usuarioId: 2 })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('rechaza compartir con otro PCD', async () => {
      usuarioRepo.findOne.mockResolvedValue({ tipoUsuario: TipoUsuario.PCD });
      await expect(service.compartir(4, { usuarioId: 2 })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('rechaza compartir con un Administrador', async () => {
      usuarioRepo.findOne.mockResolvedValue({
        id: 2,
        tipoUsuario: TipoUsuario.ADMINISTRADOR,
      });
      await expect(service.compartir(4, { usuarioId: 2 })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('rechaza si el tutor/profesional no tiene vínculo activo con el PCD', async () => {
      usuarioRepo.findOne.mockResolvedValue({
        id: 2,
        tipoUsuario: TipoUsuario.TUTOR,
      });
      vinculoAccessService.assertVinculoActivo.mockRejectedValueOnce(
        new ForbiddenException(),
      );
      await expect(service.compartir(4, { usuarioId: 2 })).rejects.toThrow(
        ForbiddenException,
      );
      expect(compartidaRepo.save).not.toHaveBeenCalled();
    });

    it('crea la compartición si no existía', async () => {
      usuarioRepo.findOne.mockResolvedValue({
        id: 2,
        tipoUsuario: TipoUsuario.TUTOR,
      });
      compartidaRepo.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ usuarioId: 2, pcdId: 4 });

      await service.compartir(4, { usuarioId: 2 });
      expect(vinculoAccessService.assertVinculoActivo).toHaveBeenCalledWith(
        2,
        TipoUsuario.TUTOR,
        4,
      );
      expect(compartidaRepo.save).toHaveBeenCalled();
    });
  });

  describe('revocar', () => {
    it('lanza 404 si no existe la compartición', async () => {
      compartidaRepo.findOne.mockResolvedValue(null);
      await expect(service.revocar(4, 2)).rejects.toThrow(NotFoundException);
    });

    it('elimina la compartición si existe', async () => {
      compartidaRepo.findOne.mockResolvedValue({ usuarioId: 2, pcdId: 4 });
      await service.revocar(4, 2);
      expect(compartidaRepo.delete).toHaveBeenCalledWith({
        usuarioId: 2,
        pcdId: 4,
      });
    });
  });
});

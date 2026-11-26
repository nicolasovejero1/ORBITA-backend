import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { TerapiasService } from './terapias.service';
import { Terapia } from './entities/terapia.entity';
import { ActividadTerapia } from '../actividades/entities/actividad-terapia.entity';
import { Profesional } from '../users/entities/profesional.entity';
import { Especialidad } from '../especialidades/entities/especialidad.entity';
import { TipoUsuario } from '../common/enums/tipo-usuario.enum';
import type { CallerInfo } from '../auth/decorators/current-user.decorator';

describe('TerapiasService', () => {
  let service: TerapiasService;
  const repo = {
    save: jest.fn(),
    create: jest.fn((d: unknown) => d),
    find: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };
  const usoRepo = { count: jest.fn() };
  const profesionalRepo = { findOne: jest.fn() };
  const especialidadRepo = { exists: jest.fn() };

  const admin: CallerInfo = {
    id: 1,
    email: 'admin',
    tipoUsuario: TipoUsuario.ADMINISTRADOR,
    esAdministrador: true,
  };
  // Profesional de Kinesiología (especialidad 5).
  const kine: CallerInfo = {
    id: 10,
    email: 'kine',
    tipoUsuario: TipoUsuario.PROFESIONAL,
    esAdministrador: false,
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    profesionalRepo.findOne.mockResolvedValue({
      userId: 10,
      especialidadId: 5,
    });
    especialidadRepo.exists.mockResolvedValue(true);
    const moduleRef = await Test.createTestingModule({
      providers: [
        TerapiasService,
        { provide: getRepositoryToken(Terapia), useValue: repo },
        { provide: getRepositoryToken(ActividadTerapia), useValue: usoRepo },
        {
          provide: getRepositoryToken(Profesional),
          useValue: profesionalRepo,
        },
        {
          provide: getRepositoryToken(Especialidad),
          useValue: especialidadRepo,
        },
      ],
    }).compile();
    service = moduleRef.get(TerapiasService);
  });

  describe('create', () => {
    it('el Administrador guarda la terapia con la especialidad indicada', async () => {
      repo.findOne
        .mockResolvedValueOnce(null) // tipo libre
        .mockResolvedValueOnce({ id: 1, tipo: 'Kinesiología' }); // findOne final
      repo.save.mockResolvedValue({ id: 1 });
      const result = await service.create(
        {
          tipo: 'Kinesiología',
          descripcion: 'Rehabilitación motriz',
          especialidadId: 5,
        },
        admin,
      );
      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ tipo: 'Kinesiología', especialidadId: 5 }),
      );
      expect(result).toEqual({ id: 1, tipo: 'Kinesiología' });
    });

    it('un Profesional sin especialidad indicada usa la suya', async () => {
      repo.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 2 });
      repo.save.mockResolvedValue({ id: 2 });
      await service.create({ tipo: 'Elongación', descripcion: 'x' }, kine);
      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ especialidadId: 5 }),
      );
    });

    it('un Profesional no crea terapias de otra especialidad (403)', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(
        service.create(
          { tipo: 'Habla', descripcion: 'x', especialidadId: 6 },
          kine,
        ),
      ).rejects.toThrow(ForbiddenException);
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('rechaza una especialidad que no existe (400)', async () => {
      repo.findOne.mockResolvedValue(null);
      especialidadRepo.exists.mockResolvedValue(false);
      await expect(
        service.create(
          { tipo: 'X', descripcion: 'x', especialidadId: 99 },
          admin,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('rechaza un tipo que ya existe (409)', async () => {
      repo.findOne.mockResolvedValue({ id: 2, tipo: 'Kinesiología' });
      await expect(
        service.create({ tipo: 'kinesiologia', descripcion: 'x' }, admin),
      ).rejects.toThrow(ConflictException);
      expect(repo.save).not.toHaveBeenCalled();
    });
  });

  it('findOne lanza 404 si no existe', async () => {
    repo.findOne.mockResolvedValue(null);
    await expect(service.findOne(99)).rejects.toThrow(NotFoundException);
  });

  it('findOne devuelve la terapia si existe', async () => {
    repo.findOne.mockResolvedValue({ id: 1, tipo: 'Kinesiología' });
    await expect(service.findOne(1)).resolves.toEqual({
      id: 1,
      tipo: 'Kinesiología',
    });
  });

  describe('findAll', () => {
    it('sin filtro: consulta sin where', async () => {
      repo.find.mockResolvedValue([]);
      await service.findAll();
      expect(repo.find).toHaveBeenCalledWith(
        expect.objectContaining({ where: undefined }),
      );
    });

    it('con filtro de tipo: usa Like', async () => {
      repo.find.mockResolvedValue([{ id: 1, tipo: 'Kinesiología' }]);
      const result = await service.findAll('Kinesio');
      expect(result).toHaveLength(1);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access -- jest.fn() sin tipar
      const options = repo.find.mock.calls[0][0] as { where: unknown };
      expect(options.where).toBeDefined();
    });
  });

  describe('update', () => {
    it('lanza 404 si no existe', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(
        service.update(99, { descripcion: 'x' }, admin),
      ).rejects.toThrow(NotFoundException);
      expect(repo.update).not.toHaveBeenCalled();
    });

    it('flujo feliz: actualiza y devuelve la terapia actualizada', async () => {
      repo.findOne
        .mockResolvedValueOnce({ id: 1, tipo: 'Kinesiología' })
        .mockResolvedValueOnce({
          id: 1,
          tipo: 'Kinesiología',
          descripcion: 'x',
        });
      const result = await service.update(1, { descripcion: 'x' }, admin);
      expect(repo.update).toHaveBeenCalledWith(1, { descripcion: 'x' });
      expect(result).toEqual({ id: 1, tipo: 'Kinesiología', descripcion: 'x' });
    });

    it('un Profesional edita las de su especialidad', async () => {
      repo.findOne
        .mockResolvedValueOnce({ id: 1, especialidadId: 5 })
        .mockResolvedValueOnce({ id: 1, especialidadId: 5 });
      await service.update(1, { descripcion: 'x' }, kine);
      expect(repo.update).toHaveBeenCalled();
    });

    it('un Profesional no edita las de otra especialidad ni las que no tienen (403)', async () => {
      repo.findOne.mockResolvedValue({ id: 1, especialidadId: 6 });
      await expect(
        service.update(1, { descripcion: 'x' }, kine),
      ).rejects.toThrow(ForbiddenException);

      repo.findOne.mockResolvedValue({ id: 2, especialidadId: null });
      await expect(
        service.update(2, { descripcion: 'x' }, kine),
      ).rejects.toThrow(ForbiddenException);
      expect(repo.update).not.toHaveBeenCalled();
    });

    it('un Profesional no la pasa a otra especialidad (403)', async () => {
      repo.findOne.mockResolvedValue({ id: 1, especialidadId: 5 });
      await expect(
        service.update(1, { especialidadId: 6 }, kine),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('remove', () => {
    it('lanza 404 si no existe antes de intentar borrar', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.remove(99, admin)).rejects.toThrow(
        NotFoundException,
      );
      expect(repo.delete).not.toHaveBeenCalled();
    });

    it('rechaza una terapia asignada a actividades (409)', async () => {
      repo.findOne.mockResolvedValue({ id: 1, tipo: 'Kinesiología' });
      usoRepo.count.mockResolvedValue(3);
      await expect(service.remove(1, admin)).rejects.toThrow(ConflictException);
      expect(repo.delete).not.toHaveBeenCalled();
    });

    it('un Profesional no borra las de otra especialidad (403)', async () => {
      repo.findOne.mockResolvedValue({ id: 1, especialidadId: 6 });
      await expect(service.remove(1, kine)).rejects.toThrow(ForbiddenException);
      expect(repo.delete).not.toHaveBeenCalled();
    });

    it('flujo feliz: elimina y devuelve un mensaje de confirmación', async () => {
      repo.findOne.mockResolvedValue({ id: 1, tipo: 'Kinesiología' });
      usoRepo.count.mockResolvedValue(0);
      const result = await service.remove(1, admin);
      expect(repo.delete).toHaveBeenCalledWith(1);
      expect(result).toEqual({ message: 'Terapia 1 eliminada correctamente' });
    });
  });
});

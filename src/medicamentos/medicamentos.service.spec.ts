import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { MedicamentosService } from './medicamentos.service';
import { Medicamento } from './entities/medicamento.entity';
import { ActividadMedicamento } from '../actividades/entities/actividad-medicamento.entity';

describe('MedicamentosService', () => {
  let service: MedicamentosService;
  const repo = {
    save: jest.fn(),
    create: jest.fn((d: unknown) => d),
    find: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };
  const usoRepo = { count: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        MedicamentosService,
        { provide: getRepositoryToken(Medicamento), useValue: repo },
        {
          provide: getRepositoryToken(ActividadMedicamento),
          useValue: usoRepo,
        },
      ],
    }).compile();
    service = moduleRef.get(MedicamentosService);
  });

  it('create guarda el medicamento con el nombre sin espacios de más', async () => {
    repo.findOne.mockResolvedValue(null);
    repo.save.mockResolvedValue({ id: 1, nombre: 'Ibuprofeno' });
    const result = await service.create({ nombre: '  Ibuprofeno ' });
    expect(repo.save).toHaveBeenCalledWith({ nombre: 'Ibuprofeno' });
    expect(result).toEqual({ id: 1, nombre: 'Ibuprofeno' });
  });

  it('create rechaza un nombre que ya existe (409)', async () => {
    repo.findOne.mockResolvedValue({ id: 5, nombre: 'Ibuprofeno' });
    await expect(service.create({ nombre: 'ibuprofeno' })).rejects.toThrow(
      ConflictException,
    );
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('findOne lanza 404 si no existe', async () => {
    repo.findOne.mockResolvedValue(null);
    await expect(service.findOne(99)).rejects.toThrow(NotFoundException);
  });

  it('update verifica existencia y que el nombre nuevo esté libre', async () => {
    repo.findOne
      .mockResolvedValueOnce({ id: 1, nombre: 'Ibuprofeno' }) // existe
      .mockResolvedValueOnce(null) // nombre libre
      .mockResolvedValueOnce({ id: 1, nombre: 'Ibuprofeno 600mg' });
    await service.update(1, { nombre: 'Ibuprofeno 600mg' });
    expect(repo.update).toHaveBeenCalledWith(1, { nombre: 'Ibuprofeno 600mg' });
  });

  it('update rechaza el nombre de otro medicamento (409)', async () => {
    repo.findOne
      .mockResolvedValueOnce({ id: 1, nombre: 'Ibuprofeno' })
      .mockResolvedValueOnce({ id: 2, nombre: 'Paracetamol' });
    await expect(service.update(1, { nombre: 'Paracetamol' })).rejects.toThrow(
      ConflictException,
    );
    expect(repo.update).not.toHaveBeenCalled();
  });

  it('remove lanza 404 si no existe antes de intentar borrar', async () => {
    repo.findOne.mockResolvedValue(null);
    await expect(service.remove(99)).rejects.toThrow(NotFoundException);
    expect(repo.delete).not.toHaveBeenCalled();
  });

  it('remove rechaza un medicamento asignado a actividades (409)', async () => {
    repo.findOne.mockResolvedValue({ id: 1, nombre: 'Ibuprofeno' });
    usoRepo.count.mockResolvedValue(2);
    await expect(service.remove(1)).rejects.toThrow(ConflictException);
    expect(repo.delete).not.toHaveBeenCalled();
  });

  it('remove borra un medicamento sin uso', async () => {
    repo.findOne.mockResolvedValue({ id: 1, nombre: 'Ibuprofeno' });
    usoRepo.count.mockResolvedValue(0);
    await service.remove(1);
    expect(repo.delete).toHaveBeenCalledWith(1);
  });
});

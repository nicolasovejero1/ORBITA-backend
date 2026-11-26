/* eslint-disable @typescript-eslint/no-unsafe-assignment -- jest.fn() sin tipar en los mocks de repositorio */
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { UnauthorizedException } from '@nestjs/common';
import { createHash } from 'crypto';
import { SesionesService } from './sesiones.service';
import { Sesion } from './entities/sesion.entity';

describe('SesionesService', () => {
  let service: SesionesService;
  const sesionRepo = {
    create: jest.fn((data: Partial<Sesion>) => data),
    save: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
  };

  const sha256 = (v: string) => createHash('sha256').update(v).digest('hex');

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        SesionesService,
        { provide: getRepositoryToken(Sesion), useValue: sesionRepo },
      ],
    }).compile();
    service = moduleRef.get(SesionesService);
  });

  it('crea una sesión guardando solo el hash del token, nunca el token en texto plano', async () => {
    sesionRepo.save.mockImplementation((s) => Promise.resolve({ id: 1, ...s }));

    const { token, sesion } = await service.crear(5);

    expect(token).toHaveLength(64); // base64url de 48 bytes
    expect(sesion.tokenHash).toBe(sha256(token));
    expect(sesion.usuarioId).toBe(5);
  });

  it('validar rechaza un token inexistente o ya revocado', async () => {
    sesionRepo.findOne.mockResolvedValue(null);
    await expect(service.validar('token-cualquiera')).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('validar rechaza un token expirado', async () => {
    sesionRepo.findOne.mockResolvedValue({
      id: 1,
      usuarioId: 5,
      expiresAt: new Date(Date.now() - 1000),
      revokedAt: null,
    });
    await expect(service.validar('token-vencido')).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('rotar revoca la sesión usada y emite una nueva para el mismo usuario', async () => {
    sesionRepo.findOne.mockResolvedValue({
      id: 10,
      usuarioId: 7,
      expiresAt: new Date(Date.now() + 100_000),
      revokedAt: null,
    });
    sesionRepo.save.mockImplementation((s) =>
      Promise.resolve({ id: 20, ...s }),
    );

    const resultado = await service.rotar('token-actual');

    expect(sesionRepo.update).toHaveBeenCalledWith(
      { id: 10 },
      expect.objectContaining({ revokedAt: expect.any(Date) }),
    );
    expect(resultado.usuarioId).toBe(7);
    expect(resultado.token).not.toBe('token-actual');
  });

  it('revocar es idempotente: no lanza si el token no existe (no filtra información)', async () => {
    sesionRepo.update.mockResolvedValue({ affected: 0 });
    await expect(service.revocar('token-inexistente')).resolves.not.toThrow();
  });

  it('revocarTodas marca revokedAt en todas las sesiones activas del usuario', async () => {
    await service.revocarTodas(9);
    expect(sesionRepo.update).toHaveBeenCalledWith(
      { usuarioId: 9, revokedAt: expect.anything() },
      expect.objectContaining({ revokedAt: expect.any(Date) }),
    );
  });
});

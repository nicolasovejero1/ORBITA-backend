/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access -- jest.fn() sin tipar en los mocks de repositorio */
// expo-server-sdk es ESM puro; PushService lo importa a nivel de módulo, así que
// cualquier spec que importe (aunque sea como tipo) algo que arrastre push.service.ts
// necesita este stub para no reventar contra el runtime CJS de Jest.
jest.mock('expo-server-sdk', () => ({ Expo: class {} }));

import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { NotificacionesService } from './notificaciones.service';
import { Notificacion } from './entities/notificacion.entity';
import { Usuario } from '../users/entities/usuario.entity';
import { PushService } from './push.service';
import { TipoNotificacion } from '../common/enums/tipo-notificacion.enum';
import { TipoUsuario } from '../common/enums/tipo-usuario.enum';
import { EstadoNotificacion } from '../common/enums/estado-notificacion.enum';
import type { CallerInfo } from '../auth/decorators/current-user.decorator';

describe('NotificacionesService', () => {
  let service: NotificacionesService;
  const notificacionRepo = {
    find: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn(),
    create: jest.fn((d: unknown) => d),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  };
  const usuarioRepo = { update: jest.fn() };
  const push = { enviarNotificaciones: jest.fn() };

  const caller: CallerInfo = {
    id: 4,
    email: 'pcd',
    tipoUsuario: TipoUsuario.PCD,
    esAdministrador: false,
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        NotificacionesService,
        {
          provide: getRepositoryToken(Notificacion),
          useValue: notificacionRepo,
        },
        { provide: getRepositoryToken(Usuario), useValue: usuarioRepo },
        { provide: PushService, useValue: push },
      ],
    }).compile();
    service = moduleRef.get(NotificacionesService);
  });

  it('create guarda la notificación y dispara el push', async () => {
    const guardada = { id: 1, usuarioId: 4, tipo: 'RECORDATORIO' };
    notificacionRepo.save.mockResolvedValue(guardada);
    notificacionRepo.findOne.mockResolvedValue({ id: 1 });

    await service.create({
      usuarioId: 4,
      tipo: TipoNotificacion.RECORDATORIO,
      mensaje: 'Hola',
    });

    // Se guarda sin estado (nace PENDIENTE) y PushService la pasa a ENVIADA.
    expect(notificacionRepo.create).toHaveBeenCalledWith(
      expect.not.objectContaining({ estado: expect.anything() }),
    );
    expect(push.enviarNotificaciones).toHaveBeenCalledWith([guardada]);
  });

  it('registrarPushToken actualiza el token del usuario', async () => {
    await service.registrarPushToken(4, 'ExponentPushToken[x]');
    expect(usuarioRepo.update).toHaveBeenCalledWith(4, {
      pushToken: 'ExponentPushToken[x]',
    });
  });

  it('eliminarPushToken limpia el token del usuario', async () => {
    await service.eliminarPushToken(4);
    expect(usuarioRepo.update).toHaveBeenCalledWith(4, { pushToken: null });
  });

  describe('findAll — paginación', () => {
    it('limita "take" a 50 como máximo', async () => {
      notificacionRepo.find.mockResolvedValue([]);
      await service.findAll(caller, 'TODAS', 0, 999);
      const options = notificacionRepo.find.mock.calls[0][0];
      expect(options.take).toBeLessThanOrEqual(51); // limit(50) + 1
    });

    it('hasMore=true si vinieron más resultados que el límite pedido', async () => {
      notificacionRepo.find.mockResolvedValue(
        Array.from({ length: 3 }, (_, i) => ({ id: i })),
      );
      const result = await service.findAll(caller, 'TODAS', 0, 2);
      expect(result.items).toHaveLength(2);
      expect(result.hasMore).toBe(true);
    });
  });

  it('countNoLeidas cuenta las notificaciones distintas de LEIDA', async () => {
    notificacionRepo.count.mockResolvedValue(5);
    const result = await service.countNoLeidas(caller);
    expect(result).toEqual({ total: 5 });
  });

  it('findOne lanza 404 si no existe o no es del caller', async () => {
    notificacionRepo.findOne.mockResolvedValue(null);
    await expect(service.findOne(99, caller)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('marcarLeida actualiza estado y leidaAt', async () => {
    notificacionRepo.findOne
      .mockResolvedValueOnce({ id: 1 }) // findOne interno (chequeo de existencia)
      .mockResolvedValueOnce({ id: 1, estado: EstadoNotificacion.LEIDA });

    await service.marcarLeida(1, caller);

    expect(notificacionRepo.update).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ estado: EstadoNotificacion.LEIDA }),
    );
  });

  it('marcarTodasLeidas devuelve la cantidad afectada', async () => {
    notificacionRepo.update.mockResolvedValue({ affected: 7 });
    const result = await service.marcarTodasLeidas(caller);
    expect(result).toEqual({ count: 7 });
  });

  it('remove verifica pertenencia antes de eliminar', async () => {
    notificacionRepo.findOne.mockResolvedValue({ id: 1 });
    await service.remove(1, caller);
    expect(notificacionRepo.delete).toHaveBeenCalledWith(1);
  });
});

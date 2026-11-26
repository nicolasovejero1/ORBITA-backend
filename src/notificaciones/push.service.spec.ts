const sendPushNotificationsAsync = jest.fn();
const chunkPushNotifications = jest.fn((msgs: unknown[]) => [msgs]);
const isExpoPushToken = jest.fn(
  (token: string) => typeof token === 'string' && token.startsWith('Expo'),
);

jest.mock('expo-server-sdk', () => ({
  Expo: class {
    static isExpoPushToken = isExpoPushToken;
    chunkPushNotifications = chunkPushNotifications;
    sendPushNotificationsAsync = sendPushNotificationsAsync;
  },
}));

import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { PushService } from './push.service';
import { Usuario } from '../users/entities/usuario.entity';
import { Notificacion } from './entities/notificacion.entity';
import { TipoNotificacion } from '../common/enums/tipo-notificacion.enum';

describe('PushService', () => {
  let service: PushService;
  const usuarioRepo = { find: jest.fn(), update: jest.fn() };
  const notificacionRepo = { update: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        PushService,
        { provide: getRepositoryToken(Usuario), useValue: usuarioRepo },
        {
          provide: getRepositoryToken(Notificacion),
          useValue: notificacionRepo,
        },
      ],
    }).compile();
    service = moduleRef.get(PushService);
  });

  it('no hace nada si no hay destinatarios', async () => {
    await service.enviar([]);
    expect(usuarioRepo.find).not.toHaveBeenCalled();
  });

  it('ignora destinatarios sin token o con token inválido', async () => {
    usuarioRepo.find.mockResolvedValue([{ id: 1, pushToken: 'no-es-expo' }]);
    await service.enviar([{ usuarioId: 1, titulo: 't', mensaje: 'm' }]);
    expect(sendPushNotificationsAsync).not.toHaveBeenCalled();
  });

  it('envía solo a los destinatarios con un ExponentPushToken válido', async () => {
    usuarioRepo.find.mockResolvedValue([
      { id: 1, pushToken: 'ExponentPushToken[abc]' },
    ]);
    sendPushNotificationsAsync.mockResolvedValue([{ status: 'ok' }]);

    await service.enviar([
      { usuarioId: 1, titulo: 'Hola', mensaje: 'Mensaje' },
      { usuarioId: 2, titulo: 'Hola', mensaje: 'Mensaje' }, // sin token registrado
    ]);

    expect(sendPushNotificationsAsync).toHaveBeenCalledWith([
      expect.objectContaining({ to: 'ExponentPushToken[abc]' }),
    ]);
  });

  it('limpia el pushToken cuando Expo devuelve DeviceNotRegistered', async () => {
    usuarioRepo.find.mockResolvedValue([
      { id: 1, pushToken: 'ExponentPushToken[abc]' },
    ]);
    sendPushNotificationsAsync.mockResolvedValue([
      { status: 'error', details: { error: 'DeviceNotRegistered' } },
    ]);

    await service.enviar([{ usuarioId: 1, titulo: 't', mensaje: 'm' }]);

    expect(usuarioRepo.update).toHaveBeenCalledWith(
      { pushToken: 'ExponentPushToken[abc]' },
      { pushToken: null },
    );
  });

  it('no rompe si Expo lanza un error al enviar', async () => {
    usuarioRepo.find.mockResolvedValue([
      { id: 1, pushToken: 'ExponentPushToken[abc]' },
    ]);
    sendPushNotificationsAsync.mockRejectedValue(new Error('network down'));

    await expect(
      service.enviar([{ usuarioId: 1, titulo: 't', mensaje: 'm' }]),
    ).resolves.not.toThrow();
  });

  describe('enviar: qué notificaciones aceptó Expo', () => {
    it('devuelve el notificacionId solo de los push con ticket ok', async () => {
      usuarioRepo.find.mockResolvedValue([
        { id: 1, pushToken: 'ExponentPushToken[a]' },
        { id: 2, pushToken: 'ExponentPushToken[b]' },
      ]);
      sendPushNotificationsAsync.mockResolvedValue([
        { status: 'ok' },
        { status: 'error', details: { error: 'MessageRateExceeded' } },
      ]);

      const aceptadas = await service.enviar([
        { usuarioId: 1, notificacionId: 10, titulo: 't', mensaje: 'm' },
        { usuarioId: 2, notificacionId: 20, titulo: 't', mensaje: 'm' },
      ]);

      expect(aceptadas).toEqual([10]);
    });

    it('no devuelve nada si Expo falla o el usuario no tiene token', async () => {
      usuarioRepo.find.mockResolvedValue([]);
      await expect(
        service.enviar([
          { usuarioId: 1, notificacionId: 10, titulo: 't', mensaje: 'm' },
        ]),
      ).resolves.toEqual([]);

      usuarioRepo.find.mockResolvedValue([
        { id: 1, pushToken: 'ExponentPushToken[a]' },
      ]);
      sendPushNotificationsAsync.mockRejectedValue(new Error('caído'));
      await expect(
        service.enviar([
          { usuarioId: 1, notificacionId: 10, titulo: 't', mensaje: 'm' },
        ]),
      ).resolves.toEqual([]);
    });
  });

  describe('enviarNotificaciones (estado real)', () => {
    const notif = (id: number, usuarioId: number) =>
      ({
        id,
        usuarioId,
        tipo: TipoNotificacion.ALERTA,
        mensaje: 'Hola',
      }) as Notificacion;

    it('pasa a ENVIADA solo las que Expo aceptó; el resto queda PENDIENTE', async () => {
      usuarioRepo.find.mockResolvedValue([
        { id: 1, pushToken: 'ExponentPushToken[a]' },
      ]);
      sendPushNotificationsAsync.mockResolvedValue([{ status: 'ok' }]);

      // La del usuario 2 no tiene token registrado.
      const enviadas = await service.enviarNotificaciones([
        notif(10, 1),
        notif(20, 2),
      ]);

      expect(enviadas).toBe(1);
      expect(notificacionRepo.update).toHaveBeenCalledTimes(1);
      const [criterio, cambios] = notificacionRepo.update.mock.calls[0] as [
        { id: { value: number[] }; estado: string },
        { estado: string },
      ];
      expect(criterio.id.value).toEqual([10]);
      expect(criterio.estado).toBe('PENDIENTE');
      expect(cambios).toEqual({ estado: 'ENVIADA' });
    });

    it('con el push caído no cambia nada', async () => {
      usuarioRepo.find.mockResolvedValue([
        { id: 1, pushToken: 'ExponentPushToken[a]' },
      ]);
      sendPushNotificationsAsync.mockRejectedValue(new Error('caído'));
      await expect(service.enviarNotificaciones([notif(10, 1)])).resolves.toBe(
        0,
      );
      expect(notificacionRepo.update).not.toHaveBeenCalled();
    });

    it('usa el título según el tipo', async () => {
      usuarioRepo.find.mockResolvedValue([
        { id: 1, pushToken: 'ExponentPushToken[a]' },
      ]);
      sendPushNotificationsAsync.mockResolvedValue([{ status: 'ok' }]);
      await service.enviarNotificaciones([notif(10, 1)]);
      expect(sendPushNotificationsAsync).toHaveBeenCalledWith([
        expect.objectContaining({ title: 'Alerta', body: 'Hola' }),
      ]);
    });
  });
});

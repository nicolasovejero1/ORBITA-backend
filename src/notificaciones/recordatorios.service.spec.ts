jest.mock('@nestjs/schedule', () => ({
  Cron: () => () => {},
  CronExpression: { EVERY_MINUTE: '0 * * * * *' },
}));
// expo-server-sdk es ESM puro; PushService lo importa a nivel de módulo, así que
// cualquier spec que importe (aunque sea como tipo) algo que arrastre push.service.ts
// necesita este stub para no reventar contra el runtime CJS de Jest.
jest.mock('expo-server-sdk', () => ({ Expo: class {} }));

/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access -- jest.fn() sin tipar en los mocks de repositorio */
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { RecordatoriosService } from './recordatorios.service';
import { ActividadInstancia } from '../actividades/entities/actividad-instancia.entity';
import { Notificacion } from './entities/notificacion.entity';
import { PushService } from './push.service';
import { EstadoInstancia } from '../common/enums/estado-instancia.enum';
import { EstadoVinculo } from '../common/enums/estado-vinculo.enum';
import { formatLocalDate } from '../common/utils/date.utils';

// fechaProgramada llega de la DB como string 'YYYY-MM-DD' (columna `date` de
// TypeORM+mysql2), no como `Date` — los fixtures reflejan esa forma real.
function instanciaParaHoy(id: number) {
  return {
    id,
    fechaProgramada: formatLocalDate(new Date()),
    actividad: {
      id: 10,
      titulo: 'Medicación',
      horarioInicio: '00:00:00',
      recordarAntesMinutos: 0,
      creadoPor: { id: 3 },
      pcd: {
        usuario: { id: 4, nombre: 'Tomás', apellido: 'Fernández' },
        tutorPcds: [
          {
            estado: EstadoVinculo.ACTIVO,
            tutor: { usuario: { id: 2, nombre: 'María', apellido: 'López' } },
          },
        ],
        vinculos: [
          {
            estado: EstadoVinculo.ACTIVO,
            profesional: {
              usuario: { id: 3, nombre: 'Carlos', apellido: 'Martínez' },
            },
          },
        ],
      },
    },
  };
}

describe('RecordatoriosService', () => {
  let service: RecordatoriosService;
  const instanciaRepo = { find: jest.fn() };
  const notificacionRepo = {
    find: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn(),
    create: jest.fn((d: unknown) => d),
  };
  const push = { enviarNotificaciones: jest.fn().mockResolvedValue(0) };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        RecordatoriosService,
        {
          provide: getRepositoryToken(ActividadInstancia),
          useValue: instanciaRepo,
        },
        {
          provide: getRepositoryToken(Notificacion),
          useValue: notificacionRepo,
        },
        { provide: PushService, useValue: push },
      ],
    }).compile();
    service = moduleRef.get(RecordatoriosService);
  });

  describe('ejecutar (recordatorios)', () => {
    it('genera recordatorios para PCD + tutores ACTIVOS + profesionales ACTIVOS', async () => {
      instanciaRepo.find.mockResolvedValue([instanciaParaHoy(1)]);
      notificacionRepo.findOne.mockResolvedValue(null);

      const creadas = await service.ejecutar();

      expect(creadas).toBe(3);
      expect(notificacionRepo.save).toHaveBeenCalledTimes(1);
      const data = notificacionRepo.save.mock.calls[0][0] as Array<{
        usuarioId: number;
        tipo: string;
        estado: string;
      }>;
      expect(data).toHaveLength(3);
      expect(data.map((n) => n.usuarioId).sort()).toEqual([2, 3, 4]);
      // Nace PENDIENTE: PushService la pasa a ENVIADA solo si Expo acepta el push.
      expect(
        data.every(
          (n) => n.tipo === 'RECORDATORIO' && n.estado === 'PENDIENTE',
        ),
      ).toBe(true);
      expect(push.enviarNotificaciones).toHaveBeenCalledTimes(1);
    });

    it('no duplica el recordatorio si ya fue enviado para la instancia', async () => {
      instanciaRepo.find.mockResolvedValue([instanciaParaHoy(1)]);
      notificacionRepo.findOne.mockResolvedValue({ id: 99 });

      const creadas = await service.ejecutar();

      expect(creadas).toBe(0);
      expect(notificacionRepo.save).not.toHaveBeenCalled();
      expect(push.enviarNotificaciones).not.toHaveBeenCalled();
    });

    it('ignora tutores/profesionales con vínculo INACTIVO', async () => {
      const instancia = instanciaParaHoy(1);
      instancia.actividad.pcd.tutorPcds[0].estado = EstadoVinculo.INACTIVO;
      instancia.actividad.pcd.vinculos[0].estado = EstadoVinculo.INACTIVO;
      instanciaRepo.find.mockResolvedValue([instancia]);
      notificacionRepo.findOne.mockResolvedValue(null);

      await service.ejecutar();

      const data = notificacionRepo.save.mock.calls[0][0] as Array<{
        usuarioId: number;
      }>;
      // Solo el PCD (id 4): tutor y profesional quedaron INACTIVOS.
      expect(data.map((n) => n.usuarioId)).toEqual([4]);
    });

    it('solo consulta instancias PENDIENTE con recordatorio configurado', async () => {
      instanciaRepo.find.mockResolvedValue([]);
      await service.ejecutar();

      const options = instanciaRepo.find.mock.calls[0][0];
      expect(options.where.estado).toBe(EstadoInstancia.PENDIENTE);
      expect(typeof options.where.fechaProgramada).toBe('string');
    });
  });

  describe('reintentarPendientes', () => {
    it('reintenta el push de las PENDIENTE de la última hora', async () => {
      const pendientes = [{ id: 1 }, { id: 2 }];
      notificacionRepo.find.mockResolvedValue(pendientes);
      push.enviarNotificaciones.mockResolvedValue(1);

      const enviadas = await service.reintentarPendientes();

      expect(enviadas).toBe(1);
      const opciones = notificacionRepo.find.mock.calls[0][0] as {
        where: { estado: string; createdAt: unknown };
      };
      expect(opciones.where.estado).toBe('PENDIENTE');
      expect(opciones.where.createdAt).toBeDefined();
      expect(push.enviarNotificaciones).toHaveBeenCalledWith(pendientes);
    });

    it('si no hay pendientes, no manda nada', async () => {
      notificacionRepo.find.mockResolvedValue([]);
      push.enviarNotificaciones.mockResolvedValue(0);
      await expect(service.reintentarPendientes()).resolves.toBe(0);
    });
  });

  describe('ejecutarVencidas (alertas)', () => {
    it('genera alerta cuando la instancia ya pasó su horario y sigue PENDIENTE', async () => {
      const ayer = new Date();
      ayer.setDate(ayer.getDate() - 1);
      instanciaRepo.find.mockResolvedValue([
        { ...instanciaParaHoy(1), fechaProgramada: formatLocalDate(ayer) },
      ]);
      notificacionRepo.findOne.mockResolvedValue(null);

      const creadas = await service.ejecutarVencidas();

      expect(creadas).toBeGreaterThan(0);
      expect(push.enviarNotificaciones).toHaveBeenCalled();
    });

    it('no duplica la alerta si ya existe una para la instancia', async () => {
      const ayer = new Date();
      ayer.setDate(ayer.getDate() - 1);
      instanciaRepo.find.mockResolvedValue([
        { ...instanciaParaHoy(1), fechaProgramada: formatLocalDate(ayer) },
      ]);
      notificacionRepo.findOne.mockResolvedValue({ id: 5 });

      const creadas = await service.ejecutarVencidas();

      expect(creadas).toBe(0);
      expect(notificacionRepo.save).not.toHaveBeenCalled();
    });
  });
});

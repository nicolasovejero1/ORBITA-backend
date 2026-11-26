import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { Ubicacion } from './entities/ubicacion.entity';
import { UbicacionesRetencionService } from './ubicaciones-retencion.service';

describe('UbicacionesRetencionService', () => {
  const query = jest.fn();
  const repo = { query } as unknown as Repository<Ubicacion>;
  const config = (dias?: number) =>
    ({
      get: jest.fn((_clave: string, defecto: number) => dias ?? defecto),
    }) as unknown as ConfigService;
  const ahora = new Date('2026-11-30T12:00:00Z');

  beforeEach(() => jest.clearAllMocks());

  it('borra lo anterior a 30 días por defecto', async () => {
    query.mockResolvedValue({ affectedRows: 12 });
    const service = new UbicacionesRetencionService(repo, config());

    await expect(service.limpiar(ahora)).resolves.toBe(12);

    const [sql, params] = query.mock.calls[0] as [string, [Date, number]];
    expect(sql).toContain('DELETE FROM `ubicaciones`');
    expect(params[0].toISOString()).toBe('2026-10-31T12:00:00.000Z');
  });

  it('respeta UBICACIONES_RETENCION_DIAS', async () => {
    query.mockResolvedValue({ affectedRows: 0 });
    const service = new UbicacionesRetencionService(repo, config(7));
    await service.limpiar(ahora);
    const [, params] = query.mock.calls[0] as [string, [Date, number]];
    expect(params[0].toISOString()).toBe('2026-11-23T12:00:00.000Z');
  });

  it('sigue por lotes mientras el lote venga lleno', async () => {
    query
      .mockResolvedValueOnce({ affectedRows: 5000 })
      .mockResolvedValueOnce({ affectedRows: 5000 })
      .mockResolvedValueOnce({ affectedRows: 40 });
    const service = new UbicacionesRetencionService(repo, config());

    await expect(service.limpiar(ahora)).resolves.toBe(10040);
    expect(query).toHaveBeenCalledTimes(3);
  });
});

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Ubicacion } from './entities/ubicacion.entity';

const LOTE = 5000;

/**
 * Borra las ubicaciones viejas: con un envío por minuto son hasta 1 440 filas
 * por día y por PCD. Se conservan UBICACIONES_RETENCION_DIAS días (30 por
 * defecto).
 */
@Injectable()
export class UbicacionesRetencionService {
  private readonly logger = new Logger(UbicacionesRetencionService.name);

  constructor(
    @InjectRepository(Ubicacion)
    private readonly ubicacionRepo: Repository<Ubicacion>,
    private readonly config: ConfigService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async limpiarPorCron(): Promise<void> {
    try {
      const borradas = await this.limpiar();
      if (borradas > 0) {
        this.logger.log(`Se borraron ${borradas} ubicaciones viejas`);
      }
    } catch (error) {
      this.logger.error('Error al borrar ubicaciones viejas', error as Error);
    }
  }

  /** Devuelve cuántas ubicaciones borró. Va por lotes para no trabar la tabla. */
  async limpiar(ahora = new Date()): Promise<number> {
    const dias = this.config.get<number>('UBICACIONES_RETENCION_DIAS', 30);
    const limite = new Date(ahora.getTime() - dias * 24 * 60 * 60_000);
    let total = 0;
    for (;;) {
      // DELETE ... LIMIT: TypeORM no lo expone en su DeleteQueryBuilder, y
      // `query()` devuelve `any`.
      /* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
      const res = await this.ubicacionRepo.query(
        'DELETE FROM `ubicaciones` WHERE `fechaHora` < ? LIMIT ?',
        [limite, LOTE],
      );
      const borradas = res.affectedRows ?? 0;
      /* eslint-enable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
      total += borradas;
      if (borradas < LOTE) return total;
    }
  }
}

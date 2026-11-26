import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CommonModule } from '../common/common.module';
import { MedicamentosModule } from '../medicamentos/medicamentos.module';
import { TerapiasModule } from '../terapias/terapias.module';
import { Actividad } from './entities/actividad.entity';
import { ActividadInstancia } from './entities/actividad-instancia.entity';
import { ActividadMedicamento } from './entities/actividad-medicamento.entity';
import { ActividadTerapia } from './entities/actividad-terapia.entity';
import { ActividadesService } from './actividades.service';
import { ActividadesController } from './actividades.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Actividad,
      ActividadInstancia,
      ActividadMedicamento,
      ActividadTerapia,
    ]),
    CommonModule,
    MedicamentosModule,
    TerapiasModule,
  ],
  controllers: [ActividadesController],
  providers: [ActividadesService],
  exports: [TypeOrmModule],
})
export class ActividadesModule {}

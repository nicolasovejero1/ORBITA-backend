import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ActividadMedicamento } from '../actividades/entities/actividad-medicamento.entity';
import { Medicamento } from './entities/medicamento.entity';
import { MedicamentosService } from './medicamentos.service';
import { MedicamentosController } from './medicamentos.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Medicamento, ActividadMedicamento])],
  controllers: [MedicamentosController],
  providers: [MedicamentosService],
  exports: [TypeOrmModule],
})
export class MedicamentosModule {}

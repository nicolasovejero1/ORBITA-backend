import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ActividadTerapia } from '../actividades/entities/actividad-terapia.entity';
import { Especialidad } from '../especialidades/entities/especialidad.entity';
import { Profesional } from '../users/entities/profesional.entity';
import { Terapia } from './entities/terapia.entity';
import { TerapiasService } from './terapias.service';
import { TerapiasController } from './terapias.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Terapia,
      ActividadTerapia,
      Profesional,
      Especialidad,
    ]),
  ],
  controllers: [TerapiasController],
  providers: [TerapiasService],
  exports: [TypeOrmModule],
})
export class TerapiasModule {}

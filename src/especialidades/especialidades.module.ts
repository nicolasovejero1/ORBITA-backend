import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Profesional } from '../users/entities/profesional.entity';
import { Terapia } from '../terapias/entities/terapia.entity';
import { Especialidad } from './entities/especialidad.entity';
import { EspecialidadesService } from './especialidades.service';
import { EspecialidadesController } from './especialidades.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Especialidad, Profesional, Terapia])],
  controllers: [EspecialidadesController],
  providers: [EspecialidadesService],
  exports: [TypeOrmModule],
})
export class EspecialidadesModule {}

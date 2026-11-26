import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { CommonModule } from '../common/common.module';
import { Actividad } from '../actividades/entities/actividad.entity';
import { ActividadInstancia } from '../actividades/entities/actividad-instancia.entity';
import { Profesional } from '../users/entities/profesional.entity';
import { TutorPcd } from '../vinculos/entities/tutor-pcd.entity';
import { ReporteProgreso } from './entities/reporte-progreso.entity';
import { ReporteAdjunto } from './entities/reporte-adjunto.entity';
import { ReporteColaborador } from './entities/reporte-colaborador.entity';
import { AdjuntoUrlService } from './adjunto-url.service';
import { ReportesService } from './reportes.service';
import { ReportesController } from './reportes.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ReporteProgreso,
      ReporteAdjunto,
      ReporteColaborador,
      Actividad,
      ActividadInstancia,
      Profesional,
      TutorPcd,
    ]),
    CommonModule,
    AuthModule,
  ],
  controllers: [ReportesController],
  providers: [ReportesService, AdjuntoUrlService],
})
export class ReportesModule {}

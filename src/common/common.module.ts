import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Vinculo } from '../vinculos/entities/vinculo.entity';
import { TutorPcd } from '../vinculos/entities/tutor-pcd.entity';
import { VinculoAccessService } from './services/vinculo-access.service';

/**
 * Módulo transversal: agrupa servicios/utilidades reutilizados por varios
 * módulos de dominio (Usuarios, Vínculos, y más adelante Actividades/Reportes).
 */
@Module({
  imports: [TypeOrmModule.forFeature([Vinculo, TutorPcd])],
  providers: [VinculoAccessService],
  exports: [VinculoAccessService],
})
export class CommonModule {}

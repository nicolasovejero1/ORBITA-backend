import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CommonModule } from '../common/common.module';
import { Usuario } from '../users/entities/usuario.entity';
import { Actividad } from '../actividades/entities/actividad.entity';
import { Vinculo } from './entities/vinculo.entity';
import { TutorPcd } from './entities/tutor-pcd.entity';
import { VinculosService } from './vinculos.service';
import { VinculosController } from './vinculos.controller';
import { TutorPcdController } from './tutor-pcd.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Usuario, Vinculo, TutorPcd, Actividad]),
    CommonModule,
  ],
  controllers: [VinculosController, TutorPcdController],
  providers: [VinculosService],
})
export class VinculosModule {}

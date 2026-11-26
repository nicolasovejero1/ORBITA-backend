import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Ubicacion } from './entities/ubicacion.entity';
import { UbicacionCompartida } from './entities/ubicacion-compartida.entity';
import { Usuario } from '../users/entities/usuario.entity';
import { AuthModule } from '../auth/auth.module';
import { CommonModule } from '../common/common.module';
import { UbicacionesController } from './ubicaciones.controller';
import { UbicacionesEvents } from './ubicaciones.events';
import { UbicacionesGateway } from './ubicaciones.gateway';
import { UbicacionesRetencionService } from './ubicaciones-retencion.service';
import { UbicacionesService } from './ubicaciones.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Ubicacion, UbicacionCompartida, Usuario]),
    CommonModule,
    AuthModule,
  ],
  controllers: [UbicacionesController],
  providers: [
    UbicacionesService,
    UbicacionesEvents,
    UbicacionesGateway,
    UbicacionesRetencionService,
  ],
})
export class UbicacionesModule {}

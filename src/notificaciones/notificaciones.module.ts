import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Usuario } from '../users/entities/usuario.entity';
import { ActividadInstancia } from '../actividades/entities/actividad-instancia.entity';
import { Notificacion } from './entities/notificacion.entity';
import { NotificacionesService } from './notificaciones.service';
import { NotificacionesController } from './notificaciones.controller';
import { RecordatoriosService } from './recordatorios.service';
import { PushService } from './push.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Notificacion, Usuario, ActividadInstancia]),
  ],
  controllers: [NotificacionesController],
  providers: [NotificacionesService, RecordatoriosService, PushService],
  exports: [PushService],
})
export class NotificacionesModule {}

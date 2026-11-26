import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CommonModule } from '../common/common.module';
import { AuthModule } from '../auth/auth.module';
import { Usuario } from './entities/usuario.entity';
import { Profesional } from './entities/profesional.entity';
import { Tutor } from './entities/tutor.entity';
import { Pcd } from './entities/pcd.entity';
import { TutorPcd } from '../vinculos/entities/tutor-pcd.entity';
import { Actividad } from '../actividades/entities/actividad.entity';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Usuario,
      Profesional,
      Tutor,
      Pcd,
      TutorPcd,
      Actividad,
    ]),
    CommonModule,
    AuthModule,
  ],
  controllers: [UsersController],
  providers: [UsersService],
})
export class UsersModule {}

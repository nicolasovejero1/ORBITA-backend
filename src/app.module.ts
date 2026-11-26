import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CommonModule } from './common/common.module';
import { parseDbSsl } from './common/utils/db-ssl.utils';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { RolesGuard } from './auth/guards/roles.guard';
import { UsersModule } from './users/users.module';
import { VinculosModule } from './vinculos/vinculos.module';
import { MedicamentosModule } from './medicamentos/medicamentos.module';
import { EspecialidadesModule } from './especialidades/especialidades.module';
import { TerapiasModule } from './terapias/terapias.module';
import { ActividadesModule } from './actividades/actividades.module';
import { ReportesModule } from './reportes/reportes.module';
import { NotificacionesModule } from './notificaciones/notificaciones.module';
import { UbicacionesModule } from './ubicaciones/ubicaciones.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => [
        {
          ttl: config.get<number>('THROTTLE_TTL_MS', 60_000),
          limit: config.get<number>('THROTTLE_LIMIT', 60),
        },
      ],
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'mysql',
        host: config.get<string>('DB_HOST', 'localhost'),
        port: config.get<number>('DB_PORT', 3306),
        username: config.get<string>('DB_USERNAME', 'root'),
        password: config.get<string>('DB_PASSWORD', ''),
        database: config.get<string>('DB_DATABASE', 'bd_backend_v3'),
        charset: config.get<string>('DB_CHARSET', 'utf8mb4'),
        ssl: parseDbSsl(config.get<string>('DB_SSL_CA')),
        autoLoadEntities: true,
        // El esquema se versiona con migraciones (src/migrations), nunca con sync automático.
        synchronize: false,
      }),
    }),
    CommonModule,
    AuthModule,
    UsersModule,
    VinculosModule,
    MedicamentosModule,
    EspecialidadesModule,
    TerapiasModule,
    ActividadesModule,
    ReportesModule,
    NotificacionesModule,
    UbicacionesModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Orden importa: el rate limit corre primero, sobre pedidos autenticados o no.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}

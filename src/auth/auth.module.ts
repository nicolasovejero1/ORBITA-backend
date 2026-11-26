import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Usuario } from '../users/entities/usuario.entity';
import { MailModule } from '../mail/mail.module';
import { PasswordResetOtp } from './entities/password-reset-otp.entity';
import { Sesion } from './entities/sesion.entity';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { PasswordResetService } from './password-reset.service';
import { SesionesService } from './sesiones.service';
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
  imports: [
    TypeOrmModule.forFeature([Usuario, Sesion, PasswordResetOtp]),
    PassportModule,
    MailModule,
    // registerAsync (no register): `JwtModule.register` lee `process.env` en el
    // momento en que se IMPORTA este archivo, que ocurre antes de que
    // ConfigModule.forRoot() cargue el .env en process.env — el secret llegaba
    // undefined y el login fallaba con 500 ("secretOrPrivateKey must have a
    // value"). Con registerAsync + ConfigService, la lectura se pospone hasta
    // que Nest arma el árbol de DI, cuando el .env ya está cargado.
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: config.get<string>(
            'JWT_ACCESS_EXPIRES_IN',
            '15m',
          ) as never,
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, SesionesService, PasswordResetService, JwtStrategy],
  // Se exporta SesionesService para que UsersModule pueda revocar sesiones al
  // desactivar una cuenta o cambiar su contraseña (ver users.service.ts).
  exports: [JwtModule, SesionesService],
})
export class AuthModule {}

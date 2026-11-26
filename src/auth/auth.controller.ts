import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { AuthService } from './auth.service';
import {
  ForgotPasswordDto,
  ResetPasswordWithTokenDto,
  VerifyOtpDto,
} from './dto/password-reset.dto';
import { PasswordResetService } from './password-reset.service';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { Public } from './decorators/public.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import type { CallerInfo } from './decorators/current-user.decorator';

/**
 * Los tres pasos de la recuperación de contraseña son públicos (la persona no
 * puede iniciar sesión), así que llevan un límite de pedidos por IP más
 * estricto que el global. Configurable para los e2e.
 */
const LIMITE_RECUPERACION = {
  default: {
    ttl: 60_000,
    limit: Number(process.env.PASSWORD_RESET_THROTTLE_LIMIT ?? 5),
  },
};

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly passwordResetService: PasswordResetService,
  ) {}

  @Public()
  // TODO(Paso 11): agregar @Throttle({ default: { ttl: 60_000, limit: 5 } })
  // una vez instalado @nestjs/throttler globalmente.
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Iniciar sesión (emite access_token + refresh_token)',
  })
  login(@Body() dto: LoginDto, @Req() req: Request) {
    return this.authService.login(dto, req.headers['user-agent']);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Renovar sesión: intercambia un refresh_token vigente por un par nuevo (rotación)',
  })
  refresh(@Body() dto: RefreshTokenDto, @Req() req: Request) {
    return this.authService.refresh(
      dto.refreshToken,
      req.headers['user-agent'],
    );
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Cerrar la sesión asociada a este refresh_token puntual',
  })
  async logout(@Body() dto: RefreshTokenDto): Promise<void> {
    await this.authService.logout(dto.refreshToken);
  }

  @Public()
  @Throttle(LIMITE_RECUPERACION)
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Recuperar contraseña (1/3): envía un código de 6 dígitos al email. Responde siempre lo mismo, exista o no el email',
  })
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.passwordResetService.solicitar(dto.email);
  }

  @Public()
  @Throttle(LIMITE_RECUPERACION)
  @Post('verify-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Recuperar contraseña (2/3): canjea el código por un token de reseteo de 10 minutos (5 intentos por código)',
  })
  verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.passwordResetService.verificar(dto.email, dto.codigo);
  }

  @Public()
  @Throttle(LIMITE_RECUPERACION)
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Recuperar contraseña (3/3): fija la contraseña nueva con el token de reseteo y cierra todas las sesiones',
  })
  resetPassword(@Body() dto: ResetPasswordWithTokenDto) {
    return this.passwordResetService.restablecer(
      dto.resetToken,
      dto.newPassword,
    );
  }

  @ApiBearerAuth()
  @Post('logout-all')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary:
      'Cerrar todas las sesiones activas del usuario autenticado (todos los dispositivos)',
  })
  async logoutAll(@CurrentUser() caller: CallerInfo): Promise<void> {
    await this.authService.logoutAll(caller.id);
  }
}

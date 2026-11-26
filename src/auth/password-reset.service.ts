import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { createHmac, randomInt, timingSafeEqual } from 'crypto';
import { IsNull, LessThan, Repository } from 'typeorm';
import { EstadoUsuario } from '../common/enums/estado-usuario.enum';
import { MailService } from '../mail/mail.service';
import { Usuario } from '../users/entities/usuario.entity';
import { PasswordResetOtp } from './entities/password-reset-otp.entity';
import { SesionesService } from './sesiones.service';

interface ResetTokenPayload {
  /** Id del OTP verificado. */
  otp: number;
  /** Id del usuario. */
  uid: number;
  prp: 'password-reset';
}

/**
 * Recuperación de contraseña con un código de 6 dígitos enviado por email (CU59).
 *
 * Tres pasos públicos: `solicitar` (manda el código), `verificar` (lo canjea por
 * un token de reseteo de corta vida) y `restablecer` (usa el token). Nada de lo
 * que responde permite saber si un email está registrado: pedir el código con un
 * email desconocido o inactivo da la misma respuesta que con uno válido, y un
 * código malo, vencido o agotado da siempre el mismo error.
 */
@Injectable()
export class PasswordResetService {
  static readonly CODIGO_DIGITOS = 6;
  static readonly VIGENCIA_MIN = 10;
  static readonly MAX_INTENTOS = 5;
  static readonly REENVIO_SEG = 60;
  static readonly TOKEN_TTL_SEG = 10 * 60;

  static readonly MENSAJE_SOLICITUD =
    'Si el email está registrado, te enviamos un código. Revisá tu correo (y la carpeta de spam).';
  private static readonly ERROR_CODIGO = 'El código es incorrecto o venció';
  private static readonly ERROR_TOKEN =
    'El permiso para cambiar la contraseña venció. Pedí un código nuevo.';

  private readonly logger = new Logger(PasswordResetService.name);

  constructor(
    @InjectRepository(Usuario)
    private readonly usuarioRepo: Repository<Usuario>,
    @InjectRepository(PasswordResetOtp)
    private readonly otpRepo: Repository<PasswordResetOtp>,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly mail: MailService,
    private readonly sesionesService: SesionesService,
  ) {}

  async solicitar(email: string): Promise<{ message: string }> {
    const respuesta = { message: PasswordResetService.MENSAJE_SOLICITUD };

    const usuario = await this.buscarActivo(email);
    if (!usuario) return respuesta;

    // Reenvío: como mucho un código por minuto y usuario. Es la defensa real
    // contra adivinar el código (5 intentos por código, 1 código por minuto).
    const ultimo = await this.otpRepo.findOne({
      where: { usuarioId: usuario.id },
      order: { createdAt: 'DESC' },
    });
    if (
      ultimo &&
      Date.now() - ultimo.createdAt.getTime() <
        PasswordResetService.REENVIO_SEG * 1000
    ) {
      return respuesta;
    }

    // El código nuevo reemplaza a los anteriores.
    await this.otpRepo.update(
      { usuarioId: usuario.id, usadoAt: IsNull() },
      { usadoAt: new Date() },
    );

    const codigo = String(
      randomInt(0, 10 ** PasswordResetService.CODIGO_DIGITOS),
    ).padStart(PasswordResetService.CODIGO_DIGITOS, '0');
    const ahora = Date.now();
    await this.otpRepo.save(
      this.otpRepo.create({
        usuarioId: usuario.id,
        codigoHash: this.hashCodigo(usuario.id, codigo),
        intentos: 0,
        createdAt: new Date(ahora),
        expiresAt: new Date(ahora + PasswordResetService.VIGENCIA_MIN * 60_000),
      }),
    );

    // Sin esperar el envío: si el SMTP tarda o falla, la respuesta no cambia
    // (y no delata que el usuario existe). El error queda en el log.
    void this.mail
      .enviarCodigoRecuperacion(
        usuario.email,
        usuario.nombre,
        codigo,
        PasswordResetService.VIGENCIA_MIN,
      )
      .catch((err: unknown) => {
        this.logger.error(
          `No se pudo enviar el código de recuperación: ${err instanceof Error ? err.message : String(err)}`,
        );
      });

    return respuesta;
  }

  async verificar(
    email: string,
    codigo: string,
  ): Promise<{ resetToken: string }> {
    const error = () =>
      new BadRequestException(PasswordResetService.ERROR_CODIGO);

    const usuario = await this.buscarActivo(email);
    if (!usuario) throw error();

    const otp = await this.otpRepo.findOne({
      where: { usuarioId: usuario.id, usadoAt: IsNull() },
      order: { createdAt: 'DESC' },
    });
    if (!otp || otp.expiresAt.getTime() < Date.now()) throw error();

    // Se gasta el intento antes de comparar y en un solo UPDATE, para que varios
    // pedidos en paralelo no puedan superar el máximo.
    const gastado = await this.otpRepo
      .createQueryBuilder()
      .update(PasswordResetOtp)
      .set({ intentos: () => 'intentos + 1' })
      .where('id = :id AND usadoAt IS NULL AND intentos < :max', {
        id: otp.id,
        max: PasswordResetService.MAX_INTENTOS,
      })
      .execute();
    if (!gastado.affected) throw error();

    if (!this.coincide(otp.codigoHash, usuario.id, codigo)) {
      if (otp.intentos + 1 >= PasswordResetService.MAX_INTENTOS) {
        await this.otpRepo.update({ id: otp.id }, { usadoAt: new Date() });
      }
      throw error();
    }

    const payload: ResetTokenPayload = {
      otp: otp.id,
      uid: usuario.id,
      prp: 'password-reset',
    };
    // Sin `sub`: este token nunca sirve como token de acceso.
    const resetToken = this.jwt.sign(payload, {
      secret: this.secretToken(),
      expiresIn: PasswordResetService.TOKEN_TTL_SEG,
    });
    return { resetToken };
  }

  async restablecer(
    resetToken: string,
    newPassword: string,
  ): Promise<{ message: string }> {
    const error = () =>
      new BadRequestException(PasswordResetService.ERROR_TOKEN);

    let payload: ResetTokenPayload;
    try {
      payload = await this.jwt.verifyAsync<ResetTokenPayload>(resetToken, {
        secret: this.secretToken(),
      });
    } catch {
      throw error();
    }
    if (payload.prp !== 'password-reset') throw error();

    // El token se puede usar una sola vez: canjearlo consume el código.
    const consumido = await this.otpRepo.update(
      { id: payload.otp, usuarioId: payload.uid, usadoAt: IsNull() },
      { usadoAt: new Date() },
    );
    if (!consumido.affected) throw error();

    const usuario = await this.usuarioRepo.findOne({
      where: { id: payload.uid },
    });
    if (!usuario || usuario.estado === EstadoUsuario.INACTIVO) throw error();

    await this.usuarioRepo.update(usuario.id, {
      password: await bcrypt.hash(newPassword, 10),
    });
    // Igual que cambiar la contraseña estando logueado: se cierran todas las sesiones.
    await this.sesionesService.revocarTodas(usuario.id);
    return { message: 'Contraseña restablecida. Ya podés iniciar sesión.' };
  }

  /** Borra los códigos de más de un día: ya no sirven y no hay por qué guardarlos. */
  @Cron(CronExpression.EVERY_DAY_AT_4AM)
  async limpiarVencidos(): Promise<void> {
    const hace1Dia = new Date(Date.now() - 24 * 60 * 60 * 1000);
    await this.otpRepo.delete({ createdAt: LessThan(hace1Dia) });
  }

  private async buscarActivo(email: string): Promise<Usuario | null> {
    const usuario = await this.usuarioRepo.findOne({
      where: { email: email.trim() },
    });
    if (!usuario || usuario.estado === EstadoUsuario.INACTIVO) return null;
    return usuario;
  }

  private hashCodigo(usuarioId: number, codigo: string): string {
    return createHmac('sha256', `${this.secretBase()}:otp`)
      .update(`${usuarioId}:${codigo}`)
      .digest('hex');
  }

  private coincide(
    hashGuardado: string,
    usuarioId: number,
    codigo: string,
  ): boolean {
    const a = Buffer.from(hashGuardado, 'hex');
    const b = Buffer.from(this.hashCodigo(usuarioId, codigo), 'hex');
    return a.length === b.length && timingSafeEqual(a, b);
  }

  private secretBase(): string {
    return this.config.get<string>('JWT_SECRET') ?? '';
  }

  private secretToken(): string {
    return `${this.secretBase()}:password-reset`;
  }
}

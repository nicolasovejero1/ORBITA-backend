import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomBytes, createHash } from 'crypto';
import { IsNull, Repository } from 'typeorm';
import { Sesion } from './entities/sesion.entity';

/**
 * Gestión de sesiones (refresh tokens) — funcionalidad ausente tanto en
 * BackendV1 como en BackendV2. Provee:
 *   - Emisión de un refresh token opaco por sesión/login.
 *   - Rotación en cada refresh (se revoca el usado, se emite uno nuevo).
 *   - Revocación puntual (logout) y masiva (logout-all / al desactivar cuenta
 *     o cambiar contraseña, ver UsersService).
 *
 * El token en sí nunca se persiste: solo su hash SHA-256 (ver Sesion entity).
 */
@Injectable()
export class SesionesService {
  constructor(
    @InjectRepository(Sesion)
    private readonly sesionRepo: Repository<Sesion>,
  ) {}

  async crear(
    usuarioId: number,
    userAgent?: string,
  ): Promise<{ token: string; sesion: Sesion }> {
    const token = this.generarTokenOpaco();
    const sesion = await this.sesionRepo.save(
      this.sesionRepo.create({
        usuarioId,
        tokenHash: this.hash(token),
        userAgent,
        expiresAt: this.calcularExpiracion(),
      }),
    );
    return { token, sesion };
  }

  /** Valida un refresh token presentado; lanza 401 si no existe, expiró o fue revocado. */
  async validar(token: string): Promise<Sesion> {
    const sesion = await this.sesionRepo.findOne({
      where: { tokenHash: this.hash(token), revokedAt: IsNull() },
    });
    if (!sesion || sesion.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException('Refresh token inválido o expirado');
    }
    return sesion;
  }

  /** Rotación: revoca el token usado y emite uno nuevo para el mismo usuario. */
  async rotar(
    token: string,
    userAgent?: string,
  ): Promise<{ token: string; sesion: Sesion; usuarioId: number }> {
    const sesionActual = await this.validar(token);
    await this.revocarPorId(sesionActual.id);
    const { token: nuevoToken, sesion } = await this.crear(
      sesionActual.usuarioId,
      userAgent,
    );
    return { token: nuevoToken, sesion, usuarioId: sesionActual.usuarioId };
  }

  /** Logout puntual. Idempotente: no falla si el token ya no existe/está revocado (no filtra información). */
  async revocar(token: string): Promise<void> {
    await this.sesionRepo.update(
      { tokenHash: this.hash(token), revokedAt: IsNull() },
      { revokedAt: new Date() },
    );
  }

  /** Logout de todos los dispositivos. También se usa al desactivar la cuenta o cambiar la contraseña. */
  async revocarTodas(usuarioId: number): Promise<void> {
    await this.sesionRepo.update(
      { usuarioId, revokedAt: IsNull() },
      { revokedAt: new Date() },
    );
  }

  private async revocarPorId(id: number): Promise<void> {
    await this.sesionRepo.update({ id }, { revokedAt: new Date() });
  }

  private generarTokenOpaco(): string {
    return randomBytes(48).toString('base64url');
  }

  private hash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private calcularExpiracion(): Date {
    const ms = this.parseDuracionMs(
      process.env.JWT_REFRESH_EXPIRES_IN ?? '30d',
    );
    return new Date(Date.now() + ms);
  }

  /** Parser mínimo de duraciones tipo "30d", "12h", "45m", "30s" (sin dependencias externas). */
  private parseDuracionMs(valor: string): number {
    const match = /^(\d+)\s*(d|h|m|s)$/.exec(valor.trim());
    if (!match) return 30 * 24 * 60 * 60 * 1000; // default: 30 días
    const cantidad = Number(match[1]);
    const unidadMs: Record<string, number> = {
      s: 1000,
      m: 60_000,
      h: 3_600_000,
      d: 86_400_000,
    };
    return cantidad * unidadMs[match[2]];
  }
}

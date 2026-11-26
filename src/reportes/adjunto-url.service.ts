import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';

interface AdjuntoTokenPayload {
  rep: number;
  adj: number;
}

/**
 * Enlaces firmados de corta vida para descargar los archivos de los reportes.
 * Se firman con una clave derivada de JWT_SECRET (no la misma), y el payload
 * no lleva `sub`: así un token de adjunto nunca sirve como token de acceso.
 */
@Injectable()
export class AdjuntoUrlService {
  static readonly TTL_SEGUNDOS = 60;

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  firmar(reporteId: number, adjuntoId: number): string {
    const payload: AdjuntoTokenPayload = { rep: reporteId, adj: adjuntoId };
    return this.jwt.sign(payload, {
      secret: this.secret(),
      expiresIn: AdjuntoUrlService.TTL_SEGUNDOS,
    });
  }

  async verificar(token: string): Promise<AdjuntoTokenPayload> {
    try {
      const payload = await this.jwt.verifyAsync<AdjuntoTokenPayload>(token, {
        secret: this.secret(),
      });
      if (!Number.isInteger(payload.rep) || !Number.isInteger(payload.adj)) {
        throw new Error('payload inválido');
      }
      return payload;
    } catch {
      throw new UnauthorizedException(
        'El enlace del archivo venció o no es válido',
      );
    }
  }

  private secret(): string {
    return `${this.config.get<string>('JWT_SECRET')}:adjunto`;
  }
}

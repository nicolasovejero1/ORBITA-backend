import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { InjectRepository } from '@nestjs/typeorm';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Repository } from 'typeorm';
import { Usuario } from '../../users/entities/usuario.entity';
import { EstadoUsuario } from '../../common/enums/estado-usuario.enum';
import { TipoUsuario } from '../../common/enums/tipo-usuario.enum';

export interface JwtPayload {
  sub: number;
  email: string;
  tipoUsuario: TipoUsuario;
  esAdministrador: boolean;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    @InjectRepository(Usuario)
    private readonly usuarioRepo: Repository<Usuario>,
    configService: ConfigService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET')!,
    });
  }

  // Revalida contra la base en cada request (no confía ciegamente en el payload
  // firmado): si el usuario fue desactivado después de emitido el token, el
  // próximo request ya lo rechaza — igual que en BackendV1/V2.
  async validate(payload: JwtPayload) {
    const usuario = await this.usuarioRepo.findOne({
      where: { id: payload.sub },
    });

    if (!usuario || usuario.estado === EstadoUsuario.INACTIVO) {
      throw new UnauthorizedException('Usuario no autorizado');
    }

    return {
      id: usuario.id,
      email: usuario.email,
      tipoUsuario: usuario.tipoUsuario,
      esAdministrador:
        usuario.tipoUsuario === TipoUsuario.ADMINISTRADOR ||
        usuario.esAdministrador,
    };
  }
}

import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { Usuario } from '../users/entities/usuario.entity';
import { EstadoUsuario } from '../common/enums/estado-usuario.enum';
import { TipoUsuario } from '../common/enums/tipo-usuario.enum';
import { LoginDto } from './dto/login.dto';
import { SesionesService } from './sesiones.service';
import { JwtPayload } from './strategies/jwt.strategy';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(Usuario)
    private readonly usuarioRepo: Repository<Usuario>,
    private readonly jwtService: JwtService,
    private readonly sesionesService: SesionesService,
  ) {}

  async login(dto: LoginDto, userAgent?: string) {
    // `password` tiene `select: false` en la entidad; hay que pedirlo explícitamente.
    const usuario = await this.usuarioRepo
      .createQueryBuilder('usuario')
      .addSelect('usuario.password')
      .where('usuario.email = :email', { email: dto.email })
      .getOne();

    if (!usuario) {
      throw new UnauthorizedException('Credenciales inválidas');
    }
    if (usuario.estado === EstadoUsuario.INACTIVO) {
      throw new UnauthorizedException('Usuario inactivo');
    }

    const passwordValida = await bcrypt.compare(dto.password, usuario.password);
    if (!passwordValida) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const { token: refreshToken } = await this.sesionesService.crear(
      usuario.id,
      userAgent,
    );

    return this.buildRespuesta(usuario, refreshToken);
  }

  async refresh(refreshToken: string, userAgent?: string) {
    const { token: nuevoRefreshToken, usuarioId } =
      await this.sesionesService.rotar(refreshToken, userAgent);

    const usuario = await this.usuarioRepo.findOne({
      where: { id: usuarioId },
    });
    if (!usuario || usuario.estado === EstadoUsuario.INACTIVO) {
      // Si la cuenta fue desactivada entre la emisión del refresh token y su uso,
      // se corta acá igual que lo haría JwtStrategy con el access token.
      throw new UnauthorizedException('Usuario no autorizado');
    }

    return this.buildRespuesta(usuario, nuevoRefreshToken);
  }

  async logout(refreshToken: string): Promise<void> {
    await this.sesionesService.revocar(refreshToken);
  }

  async logoutAll(usuarioId: number): Promise<void> {
    await this.sesionesService.revocarTodas(usuarioId);
  }

  private buildRespuesta(usuario: Usuario, refreshToken: string) {
    const esAdministrador =
      usuario.tipoUsuario === TipoUsuario.ADMINISTRADOR ||
      usuario.esAdministrador;

    const payload: JwtPayload = {
      sub: usuario.id,
      email: usuario.email,
      tipoUsuario: usuario.tipoUsuario,
      esAdministrador,
    };

    return {
      access_token: this.jwtService.sign(payload),
      refresh_token: refreshToken,
      usuario: {
        id: usuario.id,
        email: usuario.email,
        nombre: usuario.nombre,
        apellido: usuario.apellido,
        tipoUsuario: usuario.tipoUsuario,
        esAdministrador,
      },
    };
  }
}

import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { TipoUsuario } from '../../common/enums/tipo-usuario.enum';
import type { CallerInfo } from '../decorators/current-user.decorator';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<TipoUsuario[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const { user } = context
      .switchToHttp()
      .getRequest<Request & { user?: CallerInfo }>();

    // Nota: el rol ADMINISTRADOR en @Roles(...) chequea el flag `esAdministrador`
    // del usuario autenticado, no literalmente `tipoUsuario === 'ADMINISTRADOR'`
    // (permite que un Profesional con esAdministrador=true pase este chequeo).
    // Comportamiento idéntico al de BackendV1/V2.
    const tieneAcceso = requiredRoles.some((role) => {
      if (role === TipoUsuario.ADMINISTRADOR) {
        return user?.esAdministrador === true;
      }
      return user?.tipoUsuario === role;
    });

    if (!tieneAcceso) {
      throw new ForbiddenException(
        'No tenés permisos para acceder a este recurso',
      );
    }

    return true;
  }
}

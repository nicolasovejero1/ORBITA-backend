import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import { TipoUsuario } from '../../common/enums/tipo-usuario.enum';

export interface CallerInfo {
  id: number;
  email: string;
  tipoUsuario: TipoUsuario;
  esAdministrador: boolean;
}

interface RequestWithUser extends Request {
  user: CallerInfo;
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): CallerInfo => {
    const request = ctx.switchToHttp().getRequest<RequestWithUser>();
    return request.user;
  },
);

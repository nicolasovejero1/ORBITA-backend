import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';
import { TipoUsuario } from '../../common/enums/tipo-usuario.enum';

function buildContext(user: unknown): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
}

describe('RolesGuard', () => {
  const reflector = { getAllAndOverride: jest.fn() } as unknown as Reflector;
  const guard = new RolesGuard(reflector);

  it('permite el acceso si el endpoint no declara @Roles', () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue(undefined);
    expect(guard.canActivate(buildContext({}))).toBe(true);
  });

  it('permite el acceso si tipoUsuario coincide con un rol requerido', () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue([
      TipoUsuario.TUTOR,
    ]);
    const ctx = buildContext({ tipoUsuario: TipoUsuario.TUTOR });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('rechaza si tipoUsuario no coincide con ningún rol requerido', () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue([
      TipoUsuario.TUTOR,
    ]);
    const ctx = buildContext({ tipoUsuario: TipoUsuario.PCD });
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('@Roles(ADMINISTRADOR) chequea el flag esAdministrador, no tipoUsuario literal', () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue([
      TipoUsuario.ADMINISTRADOR,
    ]);
    // Profesional con esAdministrador=true debe pasar el chequeo de ADMINISTRADOR.
    const ctx = buildContext({
      tipoUsuario: TipoUsuario.PROFESIONAL,
      esAdministrador: true,
    });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('un ADMINISTRADOR "puro" sin esAdministrador=true no pasa @Roles(ADMINISTRADOR)', () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue([
      TipoUsuario.ADMINISTRADOR,
    ]);
    const ctx = buildContext({
      tipoUsuario: TipoUsuario.ADMINISTRADOR,
      esAdministrador: false,
    });
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });
});

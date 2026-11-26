import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AdjuntoUrlService } from './adjunto-url.service';

describe('AdjuntoUrlService', () => {
  const config = {
    get: jest.fn().mockReturnValue('secreto-de-prueba'),
  } as unknown as ConfigService;
  const jwt = new JwtService({ secret: 'secreto-de-prueba' });
  const service = new AdjuntoUrlService(jwt, config);

  it('firma y verifica un enlace', async () => {
    const token = service.firmar(3, 9);
    await expect(service.verificar(token)).resolves.toMatchObject({
      rep: 3,
      adj: 9,
    });
  });

  it('el token no sirve como token de acceso (no lleva sub y usa otra clave)', async () => {
    const token = service.firmar(3, 9);
    const payload = jwt.decode<Record<string, unknown>>(token);
    expect(payload.sub).toBeUndefined();
    await expect(
      jwt.verifyAsync(token, { secret: 'secreto-de-prueba' }),
    ).rejects.toBeDefined();
  });

  it('rechaza un token de acceso común', async () => {
    const acceso = jwt.sign({ sub: 3, rep: 3, adj: 9 });
    await expect(service.verificar(acceso)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('rechaza un token vencido', async () => {
    const vencido = jwt.sign(
      { rep: 3, adj: 9 },
      { secret: 'secreto-de-prueba:adjunto', expiresIn: -10 },
    );
    await expect(service.verificar(vencido)).rejects.toThrow(
      UnauthorizedException,
    );
  });
});

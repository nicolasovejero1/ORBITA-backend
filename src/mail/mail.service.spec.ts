/* eslint-disable @typescript-eslint/no-unsafe-member-access -- jest.fn().mock.calls no está tipado */
import { ConfigService } from '@nestjs/config';
import { MailService } from './mail.service';

const sendMail = jest.fn().mockResolvedValue({});
const createTransport = jest.fn(() => ({ sendMail }));
jest.mock('nodemailer', () => ({
  createTransport: (...args: unknown[]) =>
    (createTransport as (...a: unknown[]) => unknown)(...args),
}));

function servicio(env: Record<string, string | undefined>) {
  const config = {
    get: (k: string, def?: string) => env[k] ?? def,
  } as unknown as ConfigService;
  return new MailService(config);
}

describe('MailService', () => {
  beforeEach(() => jest.clearAllMocks());

  it('sin MAIL_USER y MAIL_PASS no está configurado y no envía', async () => {
    const s = servicio({});
    expect(s.configurado).toBe(false);
    await expect(
      s.enviarCodigoRecuperacion('a@b.com', 'Ana', '123456', 10),
    ).rejects.toThrow('SMTP sin configurar');
    expect(sendMail).not.toHaveBeenCalled();
  });

  it('usa Gmail en el puerto 587 con STARTTLS y quita los espacios de la contraseña de aplicación', async () => {
    const s = servicio({
      MAIL_USER: 'yo@gmail.com',
      MAIL_PASS: 'abcd efgh ijkl mnop',
    });
    await s.enviarCodigoRecuperacion('ana@test.com', 'Ana', '482913', 10);

    expect(createTransport).toHaveBeenCalledWith(
      expect.objectContaining({
        host: 'smtp.gmail.com',
        port: 587,
        secure: false,
        auth: { user: 'yo@gmail.com', pass: 'abcdefghijklmnop' },
      }),
    );
  });

  it('el puerto 465 usa TLS directo', async () => {
    const s = servicio({ MAIL_USER: 'u', MAIL_PASS: 'p', MAIL_PORT: '465' });
    await s.enviarCodigoRecuperacion('ana@test.com', 'Ana', '482913', 10);
    expect(createTransport).toHaveBeenCalledWith(
      expect.objectContaining({ port: 465, secure: true }),
    );
  });

  it('el correo lleva el código, la vigencia y el destinatario', async () => {
    const s = servicio({ MAIL_USER: 'yo@gmail.com', MAIL_PASS: 'x' });
    await s.enviarCodigoRecuperacion('ana@test.com', 'Ana', '482913', 10);

    const enviado = sendMail.mock.calls[0][0] as {
      to: string;
      from: string;
      subject: string;
      text: string;
      html: string;
    };
    expect(enviado.to).toBe('ana@test.com');
    expect(enviado.from).toBe('"PCD App" <yo@gmail.com>');
    expect(enviado.subject).toContain('482913');
    expect(enviado.text).toContain('10 minutos');
    expect(enviado.html).toContain('482913');
  });

  it('escapa el nombre en el HTML', async () => {
    const s = servicio({ MAIL_USER: 'u', MAIL_PASS: 'p' });
    await s.enviarCodigoRecuperacion(
      'a@b.com',
      '<script>x</script>',
      '123456',
      10,
    );
    const { html } = sendMail.mock.calls[0][0] as { html: string };
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('reutiliza la conexión entre envíos', async () => {
    const s = servicio({ MAIL_USER: 'u', MAIL_PASS: 'p' });
    await s.enviarCodigoRecuperacion('a@b.com', 'Ana', '111111', 10);
    await s.enviarCodigoRecuperacion('a@b.com', 'Ana', '222222', 10);
    expect(createTransport).toHaveBeenCalledTimes(1);
  });
});

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, Transporter } from 'nodemailer';

/**
 * Envío de correos por SMTP (nodemailer). Pensado para Gmail con una
 * "contraseña de aplicación" (MAIL_USER + MAIL_PASS), pero sirve cualquier
 * servidor SMTP cambiando MAIL_HOST y MAIL_PORT.
 *
 * Ojo con Render gratuito: bloquea el tráfico saliente a los puertos 25, 465 y
 * 587, así que ahí el envío por Gmail da timeout. Funciona en local y en un
 * plan pago.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: Transporter | null = null;

  constructor(private readonly config: ConfigService) {}

  /** Hay usuario y contraseña SMTP cargados. */
  get configurado(): boolean {
    return !!this.config.get<string>('MAIL_USER') && !!this.password();
  }

  async enviarCodigoRecuperacion(
    destino: string,
    nombre: string,
    codigo: string,
    minutosVigencia: number,
  ): Promise<void> {
    const asunto = `Tu código para restablecer la contraseña: ${codigo}`;
    const texto = [
      `Hola ${nombre},`,
      '',
      `Tu código para restablecer la contraseña es: ${codigo}`,
      `Vence en ${minutosVigencia} minutos y se puede usar una sola vez.`,
      '',
      'Si no lo pediste vos, ignorá este mensaje: tu contraseña no cambia.',
    ].join('\n');
    const html = `
      <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;color:#1B284A">
        <h2 style="color:#4C3A8E">Restablecer contraseña</h2>
        <p>Hola ${this.escapar(nombre)},</p>
        <p>Tu código para restablecer la contraseña es:</p>
        <p style="font-size:32px;font-weight:700;letter-spacing:8px;background:#F3EEFF;
                  border-radius:12px;padding:16px;text-align:center;color:#4C3A8E">${codigo}</p>
        <p>Vence en ${minutosVigencia} minutos y se puede usar una sola vez.</p>
        <p style="color:#5B6785;font-size:13px">Si no lo pediste vos, ignorá este mensaje:
           tu contraseña no cambia.</p>
      </div>`;
    await this.enviar(destino, asunto, texto, html);
  }

  private async enviar(
    destino: string,
    asunto: string,
    texto: string,
    html: string,
  ): Promise<void> {
    if (!this.configurado) {
      throw new Error(
        'SMTP sin configurar: faltan MAIL_USER y MAIL_PASS en el entorno',
      );
    }
    const usuario = this.config.get<string>('MAIL_USER');
    const nombreRemitente = this.config.get<string>(
      'MAIL_FROM_NAME',
      'PCD App',
    );
    const direccion = this.config.get<string>('MAIL_FROM') || usuario;
    await this.transport().sendMail({
      from: `"${nombreRemitente}" <${direccion}>`,
      to: destino,
      subject: asunto,
      text: texto,
      html,
    });
    this.logger.log(`Correo enviado a ${this.enmascarar(destino)}`);
  }

  private transport(): Transporter {
    if (this.transporter) return this.transporter;
    const port = Number(this.config.get<string>('MAIL_PORT', '587'));
    this.transporter = createTransport({
      host: this.config.get<string>('MAIL_HOST', 'smtp.gmail.com'),
      port,
      // 465 es TLS directo; 587 empieza en texto plano y sube a TLS (STARTTLS).
      secure: port === 465,
      auth: {
        user: this.config.get<string>('MAIL_USER'),
        pass: this.password(),
      },
      // Sin esto, un puerto bloqueado deja la conexión colgada mucho tiempo.
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 15_000,
    });
    return this.transporter;
  }

  /** Google muestra la contraseña de aplicación en grupos con espacios; no son parte de la clave. */
  private password(): string {
    return (this.config.get<string>('MAIL_PASS') ?? '').replace(/\s+/g, '');
  }

  private escapar(texto: string): string {
    return texto.replace(
      /[&<>"']/g,
      (c) =>
        ({
          '&': '&amp;',
          '<': '&lt;',
          '>': '&gt;',
          '"': '&quot;',
          "'": '&#39;',
        })[c] ?? c,
    );
  }

  /** "ju***@gmail.com": el log no guarda direcciones completas. */
  private enmascarar(email: string): string {
    const [local, dominio] = email.split('@');
    return `${local.slice(0, 2)}***@${dominio ?? ''}`;
  }
}

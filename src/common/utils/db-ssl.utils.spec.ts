import { parseDbSsl } from './db-ssl.utils';

describe('parseDbSsl', () => {
  it('sin DB_SSL_CA definido, la conexión va sin SSL', () => {
    expect(parseDbSsl(undefined)).toBeUndefined();
  });

  it('un valor vacío o solo espacios equivale a no definirlo', () => {
    expect(parseDbSsl('   ')).toBeUndefined();
  });

  it('con un PEM multilínea, lo usa tal cual y verifica el certificado', () => {
    const pem = '-----BEGIN CERTIFICATE-----\nABC\n-----END CERTIFICATE-----';
    expect(parseDbSsl(pem)).toEqual({ ca: pem, rejectUnauthorized: true });
  });

  it('convierte los \\n escapados en saltos de línea reales', () => {
    expect(
      parseDbSsl(
        '-----BEGIN CERTIFICATE-----\\nABC\\n-----END CERTIFICATE-----',
      ),
    ).toEqual({
      ca: '-----BEGIN CERTIFICATE-----\nABC\n-----END CERTIFICATE-----',
      rejectUnauthorized: true,
    });
  });
});

/**
 * Opciones SSL para la conexión a MySQL a partir de DB_SSL_CA (el certificado
 * CA en PEM, p.ej. el `ca.pem` que entrega Aiven). Sin definir, la conexión va
 * sin SSL — el caso de MySQL local o en el mismo VPS.
 *
 * Acepta el PEM con saltos de línea reales o escapados como `\n`, porque
 * algunos paneles de variables de entorno no permiten valores multilínea.
 * Compartida entre `app.module.ts` (runtime) y `data-source.ts` (CLI de
 * migraciones), que arman su conexión por separado.
 */
export function parseDbSsl(
  ca: string | undefined,
): { ca: string; rejectUnauthorized: true } | undefined {
  const pem = ca?.trim();
  if (!pem) return undefined;
  return { ca: pem.replace(/\\n/g, '\n'), rejectUnauthorized: true };
}

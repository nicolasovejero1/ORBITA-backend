const DEV_DEFAULT_ORIGINS =
  'http://localhost:8081,http://localhost:19006,http://localhost:3010';

/**
 * Whitelist de CORS configurable por entorno (CORS_ORIGINS, separada por
 * comas). Antes de Paso 11 estaba hardcodeada en main.ts; extraída a función
 * pura para poder testearla sin levantar la app completa.
 */
export function parseCorsOrigins(raw: string | undefined): string[] {
  return (raw ?? DEV_DEFAULT_ORIGINS)
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

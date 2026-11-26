/**
 * Ciclo de vida del reporte: nace EN_CURSO y el creador lo pasa a FINALIZADO.
 * Antes existía también INICIADO, pero no tenía ninguna regla propia (se
 * comportaba igual que EN_CURSO) y se quitó.
 */
export enum EstadoReporte {
  EN_CURSO = 'EN_CURSO',
  FINALIZADO = 'FINALIZADO',
}

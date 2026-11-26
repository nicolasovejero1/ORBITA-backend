export enum EstadoInstancia {
  PENDIENTE = 'PENDIENTE',
  REALIZADA = 'REALIZADA',
  /**
   * A diferencia de BackendV1/V2 (donde este valor existía en el enum pero
   * ningún endpoint lo asignaba nunca), acá sí se implementa una transición
   * real: PATCH /actividades/:actividadId/instancias/:instanciaId/cancelar.
   */
  CANCELADA = 'CANCELADA',
}

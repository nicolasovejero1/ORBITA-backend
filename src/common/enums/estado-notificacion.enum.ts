/**
 * Ciclo de vida: nace PENDIENTE; pasa a ENVIADA cuando Expo acepta el push;
 * LEIDA cuando el usuario la abre. Si el push falla (o el usuario todavía no
 * tiene token) queda PENDIENTE y se reintenta durante una hora.
 */
export enum EstadoNotificacion {
  PENDIENTE = 'PENDIENTE',
  ENVIADA = 'ENVIADA',
  LEIDA = 'LEIDA',
}

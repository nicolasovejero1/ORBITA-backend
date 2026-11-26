import { FrecuenciaActividad } from '../enums/frecuencia-actividad.enum';

export const DIAS_SEMANA_MAP: Record<string, number> = {
  DOMINGO: 0,
  LUNES: 1,
  MARTES: 2,
  MIERCOLES: 3,
  JUEVES: 4,
  VIERNES: 5,
  SABADO: 6,
};

export function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('T')[0].split('-').map(Number);
  return new Date(y, m - 1, d);
}

/**
 * Formatea un `Date` a 'YYYY-MM-DD' usando sus componentes LOCALES (no UTC).
 * Necesario para escribir en columnas TypeORM `type: 'date'`: usar
 * `date.toISOString()` sería incorrecto acá porque convierte a UTC y puede
 * correr la fecha un día para atrás/adelante según el huso horario.
 */
export function formatLocalDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function parseTime(hhmm: string): Date {
  const [hours, minutes] = hhmm.split(':').map(Number);
  return new Date(1970, 0, 1, hours, minutes, 0);
}

export function generarInstancias(
  fechaInicio: Date,
  fechaFin: Date,
  frecuencia: FrecuenciaActividad,
  diasSemana?: string[],
): Date[] {
  const instancias: Date[] = [];
  const cursor = new Date(fechaInicio);

  while (cursor <= fechaFin) {
    if (frecuencia === FrecuenciaActividad.DIARIA) {
      instancias.push(new Date(cursor));
      cursor.setDate(cursor.getDate() + 1);
    } else if (frecuencia === FrecuenciaActividad.SEMANAL) {
      instancias.push(new Date(cursor));
      cursor.setDate(cursor.getDate() + 7);
    } else if (frecuencia === FrecuenciaActividad.MENSUAL) {
      instancias.push(new Date(cursor));
      cursor.setMonth(cursor.getMonth() + 1);
    } else if (
      frecuencia === FrecuenciaActividad.DIAS_ESPECIFICOS &&
      diasSemana
    ) {
      const diasNums = diasSemana.map((d) => DIAS_SEMANA_MAP[d.toUpperCase()]);
      if (diasNums.includes(cursor.getDay())) {
        instancias.push(new Date(cursor));
      }
      cursor.setDate(cursor.getDate() + 1);
    }
  }

  return instancias;
}

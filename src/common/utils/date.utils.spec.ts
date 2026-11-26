import {
  formatLocalDate,
  generarInstancias,
  parseLocalDate,
  parseTime,
} from './date.utils';
import { FrecuenciaActividad } from '../enums/frecuencia-actividad.enum';

describe('date.utils', () => {
  describe('parseLocalDate', () => {
    it('parsea una fecha ISO sin desfase de zona horaria', () => {
      const fecha = parseLocalDate('2025-06-01');
      expect(fecha.getFullYear()).toBe(2025);
      expect(fecha.getMonth()).toBe(5); // junio = índice 5
      expect(fecha.getDate()).toBe(1);
    });
  });

  describe('formatLocalDate', () => {
    it('formatea usando los componentes LOCALES, no UTC (ida y vuelta con parseLocalDate)', () => {
      const original = '2025-06-01';
      expect(formatLocalDate(parseLocalDate(original))).toBe(original);
    });

    it('rellena con ceros mes y día de un solo dígito', () => {
      const fecha = new Date(2025, 0, 5); // 5 de enero
      expect(formatLocalDate(fecha)).toBe('2025-01-05');
    });
  });

  describe('parseTime', () => {
    it('parsea HH:mm a un Date con esa hora/minuto', () => {
      const t = parseTime('09:30');
      expect(t.getHours()).toBe(9);
      expect(t.getMinutes()).toBe(30);
    });
  });

  describe('generarInstancias', () => {
    it('DIARIA: una instancia por cada día del rango (inclusive)', () => {
      const instancias = generarInstancias(
        parseLocalDate('2025-06-01'),
        parseLocalDate('2025-06-05'),
        FrecuenciaActividad.DIARIA,
      );
      expect(instancias).toHaveLength(5);
    });

    it('SEMANAL: una instancia cada 7 días desde el inicio', () => {
      const instancias = generarInstancias(
        parseLocalDate('2025-06-01'),
        parseLocalDate('2025-06-30'),
        FrecuenciaActividad.SEMANAL,
      );
      // 1, 8, 15, 22, 29 de junio
      expect(instancias).toHaveLength(5);
    });

    it('MENSUAL: una instancia el mismo día de cada mes', () => {
      const instancias = generarInstancias(
        parseLocalDate('2025-01-15'),
        parseLocalDate('2025-06-15'),
        FrecuenciaActividad.MENSUAL,
      );
      // 15 ene, feb, mar, abr, may, jun
      expect(instancias).toHaveLength(6);
    });

    it('DIAS_ESPECIFICOS: solo genera instancias en los días de semana indicados', () => {
      const instancias = generarInstancias(
        parseLocalDate('2025-06-01'), // domingo
        parseLocalDate('2025-06-14'), // sábado
        FrecuenciaActividad.DIAS_ESPECIFICOS,
        ['LUNES', 'VIERNES'],
      );
      // En ese rango de 2 semanas: 2 lunes (2 y 9) + 2 viernes (6 y 13) = 4
      expect(instancias).toHaveLength(4);
      instancias.forEach((fecha) => {
        expect([1, 5]).toContain(fecha.getDay());
      });
    });

    it('DIAS_ESPECIFICOS con diasSemana vacío no genera ninguna instancia', () => {
      // Nota: pasar `undefined` en vez de un array (aunque sea vacío) deja a
      // generarInstancias sin ninguna rama que avance el cursor y cuelga en
      // un loop infinito — la validación de "diasSemana requerido" vive en
      // ActividadesService.create/DTO, ANTES de llegar a esta función pura,
      // así que ese caso nunca ocurre a través de la API pública.
      const instancias = generarInstancias(
        parseLocalDate('2025-06-01'),
        parseLocalDate('2025-06-14'),
        FrecuenciaActividad.DIAS_ESPECIFICOS,
        [],
      );
      expect(instancias).toHaveLength(0);
    });
  });
});

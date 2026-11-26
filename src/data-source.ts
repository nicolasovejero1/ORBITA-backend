import 'dotenv/config';
import { join } from 'path';
import { DataSource } from 'typeorm';
import { parseDbSsl } from './common/utils/db-ssl.utils';
import { Especialidad } from './especialidades/entities/especialidad.entity';
import { Usuario } from './users/entities/usuario.entity';
import { Profesional } from './users/entities/profesional.entity';
import { Tutor } from './users/entities/tutor.entity';
import { Pcd } from './users/entities/pcd.entity';
import { Vinculo } from './vinculos/entities/vinculo.entity';
import { TutorPcd } from './vinculos/entities/tutor-pcd.entity';
import { Sesion } from './auth/entities/sesion.entity';
import { PasswordResetOtp } from './auth/entities/password-reset-otp.entity';
import { Medicamento } from './medicamentos/entities/medicamento.entity';
import { Terapia } from './terapias/entities/terapia.entity';
import { Actividad } from './actividades/entities/actividad.entity';
import { ActividadInstancia } from './actividades/entities/actividad-instancia.entity';
import { ActividadMedicamento } from './actividades/entities/actividad-medicamento.entity';
import { ActividadTerapia } from './actividades/entities/actividad-terapia.entity';
import { ReporteProgreso } from './reportes/entities/reporte-progreso.entity';
import { ReporteAdjunto } from './reportes/entities/reporte-adjunto.entity';
import { ReporteColaborador } from './reportes/entities/reporte-colaborador.entity';
import { Notificacion } from './notificaciones/entities/notificacion.entity';
import { Ubicacion } from './ubicaciones/entities/ubicacion.entity';
import { UbicacionCompartida } from './ubicaciones/entities/ubicacion-compartida.entity';

/**
 * DataSource usado SOLO por el CLI de TypeORM (`pnpm run migration:generate/run/revert`),
 * fuera del contexto de Nest — por eso lee `process.env` directo con `dotenv`, en vez de
 * `ConfigService` (que requiere que la app de Nest esté bootstrapeada).
 *
 * La lista de entidades se mantiene explícita (no `autoLoadEntities`, que es una opción
 * exclusiva del `TypeOrmModule` de Nest) y se va ampliando a medida que se agregan módulos
 * (Actividades, Reportes, Notificaciones, Ubicaciones en los pasos 7-10 del plan).
 */
export default new DataSource({
  type: 'mysql',
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 3306),
  username: process.env.DB_USERNAME ?? 'root',
  password: process.env.DB_PASSWORD ?? '',
  database: process.env.DB_DATABASE ?? 'bd_backend_v3',
  charset: process.env.DB_CHARSET ?? 'utf8mb4',
  ssl: parseDbSsl(process.env.DB_SSL_CA),
  entities: [
    Especialidad,
    Usuario,
    Profesional,
    Tutor,
    Pcd,
    Vinculo,
    TutorPcd,
    Sesion,
    PasswordResetOtp,
    Medicamento,
    Terapia,
    Actividad,
    ActividadInstancia,
    ActividadMedicamento,
    ActividadTerapia,
    ReporteProgreso,
    ReporteAdjunto,
    ReporteColaborador,
    Notificacion,
    Ubicacion,
    UbicacionCompartida,
  ],
  // Relativo a este archivo para que funcione tanto con ts-node (src/, .ts) como
  // compilado (dist/, .js) — en producción el CLI corre sobre dist/data-source.js
  // sin ts-node. La extensión se elige explícita para no levantar los .d.ts de dist/.
  migrations: [
    join(
      __dirname,
      'migrations',
      `*.${__filename.endsWith('.ts') ? 'ts' : 'js'}`,
    ),
  ],
  synchronize: false,
});

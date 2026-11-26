import { config } from 'dotenv';
import { join } from 'path';

/**
 * Se ejecuta antes de cada test file de e2e (Jest `setupFiles`), ANTES de que
 * se importe AppModule — así ConfigModule.forRoot() (que también hace su
 * propia carga de `.env` internamente) ya encuentra las variables de
 * bd_app_test en process.env y no las de bd_app.
 */
config({ path: join(__dirname, '..', '.env.test'), quiet: true });

import { config } from 'dotenv';
import { join } from 'path';

/**
 * Carga .env.test ANTES de importar data-source.ts — data-source.ts hace
 * `import 'dotenv/config'` (carga .env por default) pero dotenv nunca
 * sobreescribe una variable ya presente en process.env, así que seteándolas
 * acá primero, data-source.ts termina apuntando a bd_app_test.
 */
config({ path: join(__dirname, '..', '.env.test'), quiet: true });

import dataSource from '../src/data-source';

async function main() {
  await dataSource.initialize();
  const pending = await dataSource.showMigrations();
  if (pending) {
    await dataSource.runMigrations();
  }

  // Arranca cada corrida de test:e2e desde una base limpia (los specs no
  // necesitan namespacing de datos entre sí ni entre corridas sucesivas).
  await dataSource.query('SET FOREIGN_KEY_CHECKS = 0');
  const tablas: { TABLE_NAME: string }[] = await dataSource.query(
    `SELECT TABLE_NAME FROM information_schema.tables WHERE table_schema = DATABASE() AND TABLE_NAME != 'migrations'`,
  );
  for (const { TABLE_NAME } of tablas) {
    await dataSource.query(`TRUNCATE TABLE \`${TABLE_NAME}\``);
  }
  await dataSource.query('SET FOREIGN_KEY_CHECKS = 1');

  await dataSource.destroy();
  console.log(
    `✔ bd_app_test lista (migraciones aplicadas, ${tablas.length} tablas limpiadas)`,
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});

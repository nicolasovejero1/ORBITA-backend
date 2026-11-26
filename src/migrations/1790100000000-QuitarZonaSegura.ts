import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Quita la zona segura (geofencing) del PCD: se sacó la funcionalidad de la
 * app y del backend (C23). Las zonas configuradas se pierden; `down` vuelve a
 * crear las columnas vacías.
 */
export class QuitarZonaSegura1790100000000 implements MigrationInterface {
  name = 'QuitarZonaSegura1790100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`pcds\` DROP COLUMN \`zonaRadioMetros\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`pcds\` DROP COLUMN \`zonaLongitud\``,
    );
    await queryRunner.query(`ALTER TABLE \`pcds\` DROP COLUMN \`zonaLatitud\``);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`pcds\` ADD \`zonaLatitud\` decimal(10,8) NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`pcds\` ADD \`zonaLongitud\` decimal(11,8) NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`pcds\` ADD \`zonaRadioMetros\` int NULL`,
    );
  }
}

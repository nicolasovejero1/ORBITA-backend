import { MigrationInterface, QueryRunner } from 'typeorm';

const ESPECIALIDADES_BASE = [
  'Kinesiología',
  'Fonoaudiología',
  'Psicología',
  'Terapia Ocupacional',
  'Psicopedagogía',
  'Nutrición',
  'Medicina General',
  'Pediatría',
  'Neurología',
  'Psiquiatría',
  'Fisiatría',
  'Trabajo Social',
  'Enfermería',
  'Odontología',
  'Oftalmología',
  'Otorrinolaringología',
];

/**
 * Catálogo de especialidades. `profesionales.especialidad` (texto libre) pasa
 * a `especialidadId` y `terapias` recibe `especialidadId` (opcional).
 * - Se cargan las 16 especialidades que tenía la app, más cualquier texto
 *   distinto que ya hubiera en `profesionales`.
 * - Las terapias existentes se asocian por nombre cuando su `tipo` coincide
 *   con una especialidad; el resto queda sin especialidad.
 * `down` vuelve al texto libre (se pierde la especialidad de las terapias).
 */
export class Especialidades1790200000000 implements MigrationInterface {
  name = 'Especialidades1790200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE \`especialidades\` (
        \`id\` int NOT NULL AUTO_INCREMENT,
        \`nombre\` varchar(100) NOT NULL,
        UNIQUE INDEX \`IDX_especialidades_nombre\` (\`nombre\`),
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB`,
    );

    for (const nombre of ESPECIALIDADES_BASE) {
      await queryRunner.query(
        `INSERT INTO \`especialidades\` (\`nombre\`) VALUES (?)`,
        [nombre],
      );
    }
    await queryRunner.query(
      `INSERT IGNORE INTO \`especialidades\` (\`nombre\`)
       SELECT DISTINCT TRIM(\`especialidad\`) FROM \`profesionales\`
       WHERE TRIM(\`especialidad\`) <> ''`,
    );

    await queryRunner.query(
      `ALTER TABLE \`profesionales\` ADD \`especialidadId\` int NULL`,
    );
    await queryRunner.query(
      `UPDATE \`profesionales\` p
       JOIN \`especialidades\` e ON e.\`nombre\` = TRIM(p.\`especialidad\`)
       SET p.\`especialidadId\` = e.\`id\``,
    );
    // Un profesional con la especialidad vacía queda en "Medicina General".
    await queryRunner.query(
      `UPDATE \`profesionales\` SET \`especialidadId\` = (
         SELECT \`id\` FROM \`especialidades\` WHERE \`nombre\` = 'Medicina General'
       ) WHERE \`especialidadId\` IS NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`profesionales\` MODIFY \`especialidadId\` int NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`profesionales\` ADD CONSTRAINT \`FK_profesionales_especialidad\`
       FOREIGN KEY (\`especialidadId\`) REFERENCES \`especialidades\`(\`id\`)
       ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`profesionales\` DROP COLUMN \`especialidad\``,
    );

    await queryRunner.query(
      `ALTER TABLE \`terapias\` ADD \`especialidadId\` int NULL`,
    );
    await queryRunner.query(
      `UPDATE \`terapias\` t
       JOIN \`especialidades\` e ON e.\`nombre\` = TRIM(t.\`tipo\`)
       SET t.\`especialidadId\` = e.\`id\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`terapias\` ADD CONSTRAINT \`FK_terapias_especialidad\`
       FOREIGN KEY (\`especialidadId\`) REFERENCES \`especialidades\`(\`id\`)
       ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`terapias\` DROP FOREIGN KEY \`FK_terapias_especialidad\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`terapias\` DROP COLUMN \`especialidadId\``,
    );

    await queryRunner.query(
      `ALTER TABLE \`profesionales\` ADD \`especialidad\` varchar(30) NOT NULL DEFAULT ''`,
    );
    await queryRunner.query(
      `UPDATE \`profesionales\` p
       JOIN \`especialidades\` e ON e.\`id\` = p.\`especialidadId\`
       SET p.\`especialidad\` = LEFT(e.\`nombre\`, 30)`,
    );
    await queryRunner.query(
      `ALTER TABLE \`profesionales\` ALTER \`especialidad\` DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE \`profesionales\` DROP FOREIGN KEY \`FK_profesionales_especialidad\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`profesionales\` DROP COLUMN \`especialidadId\``,
    );

    await queryRunner.query(`DROP TABLE \`especialidades\``);
  }
}

import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * El parentesco es de cada vínculo tutor-PCD, no del tutor (un tutor puede ser
 * madre de uno y tía de otro). Se agrega a `tutor_pcd`, se copia el valor que
 * tenía el tutor a todos sus vínculos y se quita de `tutores`.
 * `down` deja el parentesco de su vínculo más antiguo en cada tutor.
 */
export class ParentescoEnVinculo1790600000000 implements MigrationInterface {
  name = 'ParentescoEnVinculo1790600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`tutor_pcd\` ADD \`parentesco\` varchar(30) NOT NULL DEFAULT ''`,
    );
    await queryRunner.query(
      `UPDATE \`tutor_pcd\` tp JOIN \`tutores\` t ON t.\`userId\` = tp.\`tutorId\`
       SET tp.\`parentesco\` = t.\`parentesco\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`tutor_pcd\` ALTER \`parentesco\` DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE \`tutores\` DROP COLUMN \`parentesco\``,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`tutores\` ADD \`parentesco\` varchar(30) NOT NULL DEFAULT ''`,
    );
    await queryRunner.query(
      `UPDATE \`tutores\` t SET t.\`parentesco\` = COALESCE((
         SELECT tp.\`parentesco\` FROM \`tutor_pcd\` tp
         WHERE tp.\`tutorId\` = t.\`userId\`
         ORDER BY tp.\`fechaAsignacion\` ASC LIMIT 1), '')`,
    );
    await queryRunner.query(
      `ALTER TABLE \`tutores\` ALTER \`parentesco\` DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE \`tutor_pcd\` DROP COLUMN \`parentesco\``,
    );
  }
}

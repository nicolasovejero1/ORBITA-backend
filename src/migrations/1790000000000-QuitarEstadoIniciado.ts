import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Quita el estado INICIADO de los reportes: no tenía reglas propias y se
 * comportaba igual que EN_CURSO. Los reportes que estaban INICIADO pasan a
 * EN_CURSO, que queda como estado inicial.
 */
export class QuitarEstadoIniciado1790000000000 implements MigrationInterface {
  name = 'QuitarEstadoIniciado1790000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE \`reportes_progreso\` SET \`estado\` = 'EN_CURSO' WHERE \`estado\` = 'INICIADO'`,
    );
    await queryRunner.query(
      `ALTER TABLE \`reportes_progreso\` MODIFY \`estado\` enum ('EN_CURSO', 'FINALIZADO') NOT NULL DEFAULT 'EN_CURSO'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // No se puede saber qué reportes estaban INICIADO: quedan EN_CURSO.
    await queryRunner.query(
      `ALTER TABLE \`reportes_progreso\` MODIFY \`estado\` enum ('INICIADO', 'EN_CURSO', 'FINALIZADO') NOT NULL DEFAULT 'INICIADO'`,
    );
  }
}

import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * `notificaciones.tipo` pasa de texto libre a un enum. Los valores que no
 * estén en la lista (no debería haber) se pasan a ACTIVIDAD para no perderlos.
 * `down` vuelve a texto.
 */
export class TipoNotificacion1790300000000 implements MigrationInterface {
  name = 'TipoNotificacion1790300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE \`notificaciones\` SET \`tipo\` = 'ACTIVIDAD'
       WHERE \`tipo\` NOT IN ('RECORDATORIO', 'ALERTA', 'ACTIVIDAD', 'REPORTE')`,
    );
    await queryRunner.query(
      `ALTER TABLE \`notificaciones\` MODIFY \`tipo\`
       enum ('RECORDATORIO', 'ALERTA', 'ACTIVIDAD', 'REPORTE') NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`notificaciones\` MODIFY \`tipo\` varchar(50) NOT NULL`,
    );
  }
}

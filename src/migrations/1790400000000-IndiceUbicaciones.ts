import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Índice (pcdId, fechaHora) para el historial por rango y la última ubicación
 * (el envío cada minuto hace crecer mucho la tabla).
 */
export class IndiceUbicaciones1790400000000 implements MigrationInterface {
  name = 'IndiceUbicaciones1790400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE INDEX \`IDX_ubicaciones_pcd_fecha\` ON \`ubicaciones\` (\`pcdId\`, \`fechaHora\`)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // La clave foránea a `pcds` se apoya en este índice (empieza por pcdId):
    // antes de quitarlo hay que dejarle uno propio.
    await queryRunner.query(
      `CREATE INDEX \`IDX_ubicaciones_pcdId\` ON \`ubicaciones\` (\`pcdId\`)`,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_ubicaciones_pcd_fecha\` ON \`ubicaciones\``,
    );
  }
}

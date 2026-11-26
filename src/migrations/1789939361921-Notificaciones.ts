import { MigrationInterface, QueryRunner } from 'typeorm';

export class Notificaciones1789939361921 implements MigrationInterface {
  name = 'Notificaciones1789939361921';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE \`notificaciones\` (\`id\` int NOT NULL AUTO_INCREMENT, \`usuarioId\` int NOT NULL, \`tipo\` varchar(50) NOT NULL, \`mensaje\` text NOT NULL, \`estado\` enum ('PENDIENTE', 'ENVIADA', 'LEIDA') NOT NULL DEFAULT 'PENDIENTE', \`leidaAt\` datetime NULL, \`actividadId\` int NULL, \`instanciaId\` int NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `ALTER TABLE \`notificaciones\` ADD CONSTRAINT \`FK_125b6cc2388b61c1b00c633c673\` FOREIGN KEY (\`usuarioId\`) REFERENCES \`usuarios\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`notificaciones\` ADD CONSTRAINT \`FK_e91ea890371e06f32eb2162c127\` FOREIGN KEY (\`actividadId\`) REFERENCES \`actividades\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`notificaciones\` ADD CONSTRAINT \`FK_413666286f7eb2df90c8ec8ed35\` FOREIGN KEY (\`instanciaId\`) REFERENCES \`actividad_instancias\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`notificaciones\` DROP FOREIGN KEY \`FK_413666286f7eb2df90c8ec8ed35\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`notificaciones\` DROP FOREIGN KEY \`FK_e91ea890371e06f32eb2162c127\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`notificaciones\` DROP FOREIGN KEY \`FK_125b6cc2388b61c1b00c633c673\``,
    );
    await queryRunner.query(`DROP TABLE \`notificaciones\``);
  }
}

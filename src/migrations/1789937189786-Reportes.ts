import { MigrationInterface, QueryRunner } from 'typeorm';

export class Reportes1789937189786 implements MigrationInterface {
  name = 'Reportes1789937189786';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE \`reporte_adjuntos\` (\`id\` int NOT NULL AUTO_INCREMENT, \`reporteId\` int NOT NULL, \`tipoArchivo\` enum ('PDF', 'IMAGEN', 'URL') NOT NULL, \`filePath\` varchar(500) NOT NULL, PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `CREATE TABLE \`reporte_colaboradores\` (\`profesionalId\` int NOT NULL, \`reporteId\` int NOT NULL, \`fechaAcceso\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), PRIMARY KEY (\`profesionalId\`, \`reporteId\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `CREATE TABLE \`reportes_progreso\` (\`id\` int NOT NULL AUTO_INCREMENT, \`profesionalId\` int NOT NULL, \`actividadId\` int NOT NULL, \`instanciaId\` int NULL, \`titulo\` varchar(100) NOT NULL, \`descripcionDetallada\` text NULL, \`tipo\` enum ('DE_ACTIVIDAD', 'MENSUAL', 'FINAL') NOT NULL, \`estado\` enum ('INICIADO', 'EN_CURSO', 'FINALIZADO') NOT NULL DEFAULT 'INICIADO', \`visibilidadTutor\` tinyint NOT NULL DEFAULT 0, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), UNIQUE INDEX \`IDX_5823914fc1ab02f35c7e981c10\` (\`profesionalId\`, \`instanciaId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `ALTER TABLE \`reporte_adjuntos\` ADD CONSTRAINT \`FK_6b5fa261454caa933bf4e560915\` FOREIGN KEY (\`reporteId\`) REFERENCES \`reportes_progreso\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`reporte_colaboradores\` ADD CONSTRAINT \`FK_cfddf33e74d4fed2b4dad84be3a\` FOREIGN KEY (\`profesionalId\`) REFERENCES \`profesionales\`(\`userId\`) ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`reporte_colaboradores\` ADD CONSTRAINT \`FK_089c79127bf860a3c48c3ee3cf4\` FOREIGN KEY (\`reporteId\`) REFERENCES \`reportes_progreso\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`reportes_progreso\` ADD CONSTRAINT \`FK_dce72fe2d60360a0dccc8abe7f4\` FOREIGN KEY (\`profesionalId\`) REFERENCES \`profesionales\`(\`userId\`) ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`reportes_progreso\` ADD CONSTRAINT \`FK_d59bf7705dfc378f62fee646eef\` FOREIGN KEY (\`actividadId\`) REFERENCES \`actividades\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`reportes_progreso\` ADD CONSTRAINT \`FK_840c2fb5fd830a679817b68867b\` FOREIGN KEY (\`instanciaId\`) REFERENCES \`actividad_instancias\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`reportes_progreso\` DROP FOREIGN KEY \`FK_840c2fb5fd830a679817b68867b\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`reportes_progreso\` DROP FOREIGN KEY \`FK_d59bf7705dfc378f62fee646eef\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`reportes_progreso\` DROP FOREIGN KEY \`FK_dce72fe2d60360a0dccc8abe7f4\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`reporte_colaboradores\` DROP FOREIGN KEY \`FK_089c79127bf860a3c48c3ee3cf4\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`reporte_colaboradores\` DROP FOREIGN KEY \`FK_cfddf33e74d4fed2b4dad84be3a\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`reporte_adjuntos\` DROP FOREIGN KEY \`FK_6b5fa261454caa933bf4e560915\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_5823914fc1ab02f35c7e981c10\` ON \`reportes_progreso\``,
    );
    await queryRunner.query(`DROP TABLE \`reportes_progreso\``);
    await queryRunner.query(`DROP TABLE \`reporte_colaboradores\``);
    await queryRunner.query(`DROP TABLE \`reporte_adjuntos\``);
  }
}

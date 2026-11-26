import { MigrationInterface, QueryRunner } from 'typeorm';

export class CatalogosYActividades1789690995047 implements MigrationInterface {
  name = 'CatalogosYActividades1789690995047';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE \`medicamentos\` (\`id\` int NOT NULL AUTO_INCREMENT, \`nombre\` varchar(255) NOT NULL, \`presentacion\` varchar(255) NULL, \`tipo\` varchar(100) NULL, \`descripcion\` text NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `CREATE TABLE \`terapias\` (\`id\` int NOT NULL AUTO_INCREMENT, \`tipo\` varchar(50) NOT NULL, \`descripcion\` varchar(255) NOT NULL, PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `CREATE TABLE \`actividad_instancias\` (\`id\` int NOT NULL AUTO_INCREMENT, \`actividadId\` int NOT NULL, \`fechaProgramada\` date NOT NULL, \`estado\` enum ('PENDIENTE', 'REALIZADA', 'CANCELADA') NOT NULL DEFAULT 'PENDIENTE', \`confirmedAt\` datetime NULL, \`confirmedByUserId\` int NULL, \`canceledAt\` datetime NULL, \`canceledByUserId\` int NULL, \`motivoCancelacion\` varchar(255) NULL, PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `CREATE TABLE \`actividad_medicamentos\` (\`actividadId\` int NOT NULL, \`medicamentoId\` int NOT NULL, \`dosis\` varchar(100) NULL, \`frecuencia\` varchar(100) NULL, \`duracionTratamiento\` varchar(100) NULL, \`indicacion\` text NULL, \`medicoPrescriptor\` varchar(100) NULL, PRIMARY KEY (\`actividadId\`, \`medicamentoId\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `CREATE TABLE \`actividad_terapias\` (\`actividadId\` int NOT NULL, \`terapiaId\` int NOT NULL, PRIMARY KEY (\`actividadId\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `CREATE TABLE \`actividades\` (\`id\` int NOT NULL AUTO_INCREMENT, \`titulo\` varchar(100) NOT NULL, \`descripcion\` text NOT NULL, \`fechaInicio\` date NOT NULL, \`fechaFin\` date NOT NULL, \`horarioInicio\` time NULL, \`horarioFin\` time NULL, \`observaciones\` text NULL, \`estado\` enum ('PENDIENTE', 'COMPLETADA') NOT NULL DEFAULT 'PENDIENTE', \`tipoActividad\` enum ('EJERCICIO', 'MEDICAMENTO', 'TERAPIA', 'PERSONALIZADA') NOT NULL, \`frecuencia\` enum ('DIARIA', 'SEMANAL', 'DIAS_ESPECIFICOS', 'MENSUAL') NOT NULL, \`diasSemana\` json NULL, \`recordarAntesMinutos\` int NULL, \`creadoPorUserId\` int NOT NULL, \`pcdId\` int NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `ALTER TABLE \`actividad_instancias\` ADD CONSTRAINT \`FK_ddee2fb52d1b3679010a7532b40\` FOREIGN KEY (\`actividadId\`) REFERENCES \`actividades\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`actividad_instancias\` ADD CONSTRAINT \`FK_2ea5424d51a136338eb132080f6\` FOREIGN KEY (\`confirmedByUserId\`) REFERENCES \`usuarios\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`actividad_instancias\` ADD CONSTRAINT \`FK_b3d608d60e106c5fb634227e176\` FOREIGN KEY (\`canceledByUserId\`) REFERENCES \`usuarios\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`actividad_medicamentos\` ADD CONSTRAINT \`FK_4af641ed3a78d3821d1ae66bc0c\` FOREIGN KEY (\`actividadId\`) REFERENCES \`actividades\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`actividad_medicamentos\` ADD CONSTRAINT \`FK_4a05f15eddff08d60b743668605\` FOREIGN KEY (\`medicamentoId\`) REFERENCES \`medicamentos\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`actividad_terapias\` ADD CONSTRAINT \`FK_262fa0ba142c9a034af520c5397\` FOREIGN KEY (\`actividadId\`) REFERENCES \`actividades\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`actividad_terapias\` ADD CONSTRAINT \`FK_0b667109b6e01f8bdda34d4a2c4\` FOREIGN KEY (\`terapiaId\`) REFERENCES \`terapias\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`actividades\` ADD CONSTRAINT \`FK_bef5f3e64feff58b7faa3ba2bc7\` FOREIGN KEY (\`creadoPorUserId\`) REFERENCES \`usuarios\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`actividades\` ADD CONSTRAINT \`FK_eccf0ee2ce8e6e36c9b1fc75958\` FOREIGN KEY (\`pcdId\`) REFERENCES \`pcds\`(\`userId\`) ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`actividades\` DROP FOREIGN KEY \`FK_eccf0ee2ce8e6e36c9b1fc75958\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`actividades\` DROP FOREIGN KEY \`FK_bef5f3e64feff58b7faa3ba2bc7\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`actividad_terapias\` DROP FOREIGN KEY \`FK_0b667109b6e01f8bdda34d4a2c4\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`actividad_terapias\` DROP FOREIGN KEY \`FK_262fa0ba142c9a034af520c5397\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`actividad_medicamentos\` DROP FOREIGN KEY \`FK_4a05f15eddff08d60b743668605\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`actividad_medicamentos\` DROP FOREIGN KEY \`FK_4af641ed3a78d3821d1ae66bc0c\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`actividad_instancias\` DROP FOREIGN KEY \`FK_b3d608d60e106c5fb634227e176\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`actividad_instancias\` DROP FOREIGN KEY \`FK_2ea5424d51a136338eb132080f6\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`actividad_instancias\` DROP FOREIGN KEY \`FK_ddee2fb52d1b3679010a7532b40\``,
    );
    await queryRunner.query(`DROP TABLE \`actividades\``);
    await queryRunner.query(`DROP TABLE \`actividad_terapias\``);
    await queryRunner.query(`DROP TABLE \`actividad_medicamentos\``);
    await queryRunner.query(`DROP TABLE \`actividad_instancias\``);
    await queryRunner.query(`DROP TABLE \`terapias\``);
    await queryRunner.query(`DROP TABLE \`medicamentos\``);
  }
}

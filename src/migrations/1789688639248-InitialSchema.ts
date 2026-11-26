import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1789688639248 implements MigrationInterface {
  name = 'InitialSchema1789688639248';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE \`profesionales\` (\`userId\` int NOT NULL, \`matricula\` varchar(30) NOT NULL, \`especialidad\` varchar(30) NOT NULL, \`establecimiento\` varchar(100) NULL, \`descripcionFunciones\` text NULL, UNIQUE INDEX \`IDX_44b4d72ab03679b3ac88c16f34\` (\`matricula\`), PRIMARY KEY (\`userId\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `CREATE TABLE \`tutores\` (\`userId\` int NOT NULL, \`parentesco\` varchar(30) NOT NULL, PRIMARY KEY (\`userId\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `CREATE TABLE \`pcds\` (\`userId\` int NOT NULL, \`tipoDiscapacidad\` varchar(255) NULL, \`grado\` varchar(10) NULL, \`diagnostico\` text NULL, PRIMARY KEY (\`userId\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `CREATE TABLE \`usuarios\` (\`id\` int NOT NULL AUTO_INCREMENT, \`dni\` varchar(15) NOT NULL, \`nombre\` varchar(100) NOT NULL, \`apellido\` varchar(100) NOT NULL, \`fechaNacimiento\` date NOT NULL, \`telefono\` varchar(20) NULL, \`email\` varchar(255) NOT NULL, \`direccion\` varchar(255) NULL, \`password\` varchar(255) NOT NULL, \`tipoUsuario\` enum ('ADMINISTRADOR', 'PROFESIONAL', 'TUTOR', 'PCD') NOT NULL, \`esAdministrador\` tinyint NOT NULL DEFAULT 0, \`estado\` enum ('ACTIVO', 'INACTIVO') NOT NULL DEFAULT 'ACTIVO', \`pushToken\` varchar(255) NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), UNIQUE INDEX \`IDX_3fd196cb306bed4b2a2e7c3415\` (\`dni\`), UNIQUE INDEX \`IDX_446adfc18b35418aac32ae0b7b\` (\`email\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `CREATE TABLE \`vinculos\` (\`pcdId\` int NOT NULL, \`profesionalId\` int NOT NULL, \`rolProfesional\` enum ('CABECERA', 'ESPECIALISTA') NOT NULL, \`estado\` enum ('ACTIVO', 'INACTIVO') NOT NULL DEFAULT 'ACTIVO', \`fechaAsignacion\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), PRIMARY KEY (\`pcdId\`, \`profesionalId\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `CREATE TABLE \`tutor_pcd\` (\`tutorId\` int NOT NULL, \`pcdId\` int NOT NULL, \`estado\` enum ('ACTIVO', 'INACTIVO') NOT NULL DEFAULT 'ACTIVO', \`fechaAsignacion\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), PRIMARY KEY (\`tutorId\`, \`pcdId\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `CREATE TABLE \`sesiones\` (\`id\` int NOT NULL AUTO_INCREMENT, \`usuarioId\` int NOT NULL, \`tokenHash\` char(64) NOT NULL, \`userAgent\` varchar(255) NULL, \`expiresAt\` datetime NOT NULL, \`revokedAt\` datetime NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), UNIQUE INDEX \`IDX_a5529fd93e2fea9ce42184a183\` (\`tokenHash\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `ALTER TABLE \`profesionales\` ADD CONSTRAINT \`FK_12425b241c72ad7f616daee7bdd\` FOREIGN KEY (\`userId\`) REFERENCES \`usuarios\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`tutores\` ADD CONSTRAINT \`FK_2c84d25f8b34288d4f52fdcfe94\` FOREIGN KEY (\`userId\`) REFERENCES \`usuarios\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`pcds\` ADD CONSTRAINT \`FK_7f0412cf4554eab204a9bd3cd81\` FOREIGN KEY (\`userId\`) REFERENCES \`usuarios\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`vinculos\` ADD CONSTRAINT \`FK_b8e833ec9b1ab33fdd877caf34a\` FOREIGN KEY (\`pcdId\`) REFERENCES \`pcds\`(\`userId\`) ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`vinculos\` ADD CONSTRAINT \`FK_75cb757560a692b190995afd45b\` FOREIGN KEY (\`profesionalId\`) REFERENCES \`profesionales\`(\`userId\`) ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`tutor_pcd\` ADD CONSTRAINT \`FK_29c2340773a1fcb8380dbb145db\` FOREIGN KEY (\`tutorId\`) REFERENCES \`tutores\`(\`userId\`) ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`tutor_pcd\` ADD CONSTRAINT \`FK_2fcad10df3ed759a88cb7e4b9cc\` FOREIGN KEY (\`pcdId\`) REFERENCES \`pcds\`(\`userId\`) ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`sesiones\` ADD CONSTRAINT \`FK_1e2e12e2ffd791298d701f2ae55\` FOREIGN KEY (\`usuarioId\`) REFERENCES \`usuarios\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`sesiones\` DROP FOREIGN KEY \`FK_1e2e12e2ffd791298d701f2ae55\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`tutor_pcd\` DROP FOREIGN KEY \`FK_2fcad10df3ed759a88cb7e4b9cc\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`tutor_pcd\` DROP FOREIGN KEY \`FK_29c2340773a1fcb8380dbb145db\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`vinculos\` DROP FOREIGN KEY \`FK_75cb757560a692b190995afd45b\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`vinculos\` DROP FOREIGN KEY \`FK_b8e833ec9b1ab33fdd877caf34a\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`pcds\` DROP FOREIGN KEY \`FK_7f0412cf4554eab204a9bd3cd81\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`tutores\` DROP FOREIGN KEY \`FK_2c84d25f8b34288d4f52fdcfe94\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`profesionales\` DROP FOREIGN KEY \`FK_12425b241c72ad7f616daee7bdd\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_a5529fd93e2fea9ce42184a183\` ON \`sesiones\``,
    );
    await queryRunner.query(`DROP TABLE \`sesiones\``);
    await queryRunner.query(`DROP TABLE \`tutor_pcd\``);
    await queryRunner.query(`DROP TABLE \`vinculos\``);
    await queryRunner.query(
      `DROP INDEX \`IDX_446adfc18b35418aac32ae0b7b\` ON \`usuarios\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_3fd196cb306bed4b2a2e7c3415\` ON \`usuarios\``,
    );
    await queryRunner.query(`DROP TABLE \`usuarios\``);
    await queryRunner.query(`DROP TABLE \`pcds\``);
    await queryRunner.query(`DROP TABLE \`tutores\``);
    await queryRunner.query(
      `DROP INDEX \`IDX_44b4d72ab03679b3ac88c16f34\` ON \`profesionales\``,
    );
    await queryRunner.query(`DROP TABLE \`profesionales\``);
  }
}

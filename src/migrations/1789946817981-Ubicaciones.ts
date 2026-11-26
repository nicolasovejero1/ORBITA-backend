import { MigrationInterface, QueryRunner } from 'typeorm';

export class Ubicaciones1789946817981 implements MigrationInterface {
  name = 'Ubicaciones1789946817981';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE \`ubicaciones\` (\`id\` int NOT NULL AUTO_INCREMENT, \`pcdId\` int NOT NULL, \`latitud\` decimal(10,8) NOT NULL, \`longitud\` decimal(11,8) NOT NULL, \`precision\` decimal(4,1) NULL, \`fechaHora\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `CREATE TABLE \`ubicaciones_compartidas\` (\`usuarioId\` int NOT NULL, \`pcdId\` int NOT NULL, \`fechaDesde\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), PRIMARY KEY (\`usuarioId\`, \`pcdId\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `ALTER TABLE \`pcds\` ADD \`zonaLatitud\` decimal(10,8) NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`pcds\` ADD \`zonaLongitud\` decimal(11,8) NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`pcds\` ADD \`zonaRadioMetros\` int NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`notificaciones\` ADD \`pcdId\` int NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`notificaciones\` ADD CONSTRAINT \`FK_c170ca204c9037a03ad431e102d\` FOREIGN KEY (\`pcdId\`) REFERENCES \`pcds\`(\`userId\`) ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`ubicaciones\` ADD CONSTRAINT \`FK_e2860522bb66519f64239c5b1d4\` FOREIGN KEY (\`pcdId\`) REFERENCES \`pcds\`(\`userId\`) ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`ubicaciones_compartidas\` ADD CONSTRAINT \`FK_fc22282710e192b689adf2cc473\` FOREIGN KEY (\`usuarioId\`) REFERENCES \`usuarios\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`ubicaciones_compartidas\` ADD CONSTRAINT \`FK_ec8b8050b7c6edbc0ecd2b438ba\` FOREIGN KEY (\`pcdId\`) REFERENCES \`pcds\`(\`userId\`) ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`ubicaciones_compartidas\` DROP FOREIGN KEY \`FK_ec8b8050b7c6edbc0ecd2b438ba\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`ubicaciones_compartidas\` DROP FOREIGN KEY \`FK_fc22282710e192b689adf2cc473\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`ubicaciones\` DROP FOREIGN KEY \`FK_e2860522bb66519f64239c5b1d4\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`notificaciones\` DROP FOREIGN KEY \`FK_c170ca204c9037a03ad431e102d\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`notificaciones\` DROP COLUMN \`pcdId\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`pcds\` DROP COLUMN \`zonaRadioMetros\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`pcds\` DROP COLUMN \`zonaLongitud\``,
    );
    await queryRunner.query(`ALTER TABLE \`pcds\` DROP COLUMN \`zonaLatitud\``);
    await queryRunner.query(`DROP TABLE \`ubicaciones_compartidas\``);
    await queryRunner.query(`DROP TABLE \`ubicaciones\``);
  }
}

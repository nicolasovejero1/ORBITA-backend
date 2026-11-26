import { MigrationInterface, QueryRunner } from 'typeorm';

/** Códigos OTP para restablecer la contraseña (CU59). */
export class PasswordResetOtp1790500000000 implements MigrationInterface {
  name = 'PasswordResetOtp1790500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE \`password_reset_otp\` (\`id\` int NOT NULL AUTO_INCREMENT, \`usuarioId\` int NOT NULL, \`codigoHash\` char(64) NOT NULL, \`intentos\` int NOT NULL DEFAULT 0, \`createdAt\` datetime NOT NULL, \`expiresAt\` datetime NOT NULL, \`usadoAt\` datetime NULL, INDEX \`IDX_password_reset_otp_usuario_fecha\` (\`usuarioId\`, \`createdAt\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `ALTER TABLE \`password_reset_otp\` ADD CONSTRAINT \`FK_password_reset_otp_usuario\` FOREIGN KEY (\`usuarioId\`) REFERENCES \`usuarios\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`password_reset_otp\` DROP FOREIGN KEY \`FK_password_reset_otp_usuario\``,
    );
    await queryRunner.query(`DROP TABLE \`password_reset_otp\``);
  }
}

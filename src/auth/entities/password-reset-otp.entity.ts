import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Usuario } from '../../users/entities/usuario.entity';

/**
 * Código de un solo uso (OTP) para restablecer la contraseña (CU59). El código
 * de 6 dígitos nunca se guarda: solo su HMAC-SHA256, con una clave derivada de
 * JWT_SECRET y el id del usuario. Las fechas las pone el servidor de Node (no un
 * DEFAULT de MySQL) para compararlas sin depender de la zona horaria de la base.
 */
@Entity('password_reset_otp')
@Index('IDX_password_reset_otp_usuario_fecha', ['usuarioId', 'createdAt'])
export class PasswordResetOtp {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  usuarioId: number;

  @ManyToOne(() => Usuario, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'usuarioId' })
  usuario: Usuario;

  @Column({ type: 'char', length: 64 })
  codigoHash: string;

  /** Intentos de verificación gastados. */
  @Column({ type: 'int', default: 0 })
  intentos: number;

  @Column({ type: 'datetime' })
  createdAt: Date;

  @Column({ type: 'datetime' })
  expiresAt: Date;

  /** Se llena al usarlo, al reemplazarlo por uno nuevo o al agotar los intentos. */
  @Column({ type: 'datetime', nullable: true })
  usadoAt?: Date | null;
}

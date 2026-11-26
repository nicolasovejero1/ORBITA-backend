import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Usuario } from '../../users/entities/usuario.entity';

/**
 * Sesión asociada a un refresh token emitido en el login. No existía en
 * BackendV1 ni BackendV2 (ninguna de las dos tenía logout real ni revocación
 * de tokens antes de su expiración natural).
 *
 * El refresh token en sí NUNCA se persiste en texto plano: se guarda el hash
 * SHA-256 (hexadecimal) del token opaco entregado al cliente. No se usa bcrypt
 * acá porque el token ya es aleatorio de alta entropía (no una contraseña elegida
 * por un humano), así que no hace falta un hash lento — y un hash determinístico
 * permite buscar la sesión directamente por igualdad (`WHERE tokenHash = ?`).
 */
@Entity('sesiones')
export class Sesion {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  usuarioId: number;

  @ManyToOne(() => Usuario, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'usuarioId' })
  usuario: Usuario;

  @Index({ unique: true })
  @Column({ type: 'char', length: 64 })
  tokenHash: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  userAgent?: string | null;

  @Column({ type: 'datetime' })
  expiresAt: Date;

  @Column({ type: 'datetime', nullable: true })
  revokedAt?: Date | null;

  @CreateDateColumn()
  createdAt: Date;
}

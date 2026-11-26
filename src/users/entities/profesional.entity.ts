import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToOne,
  PrimaryColumn,
} from 'typeorm';
import { Especialidad } from '../../especialidades/entities/especialidad.entity';
import { Usuario } from './usuario.entity';

/**
 * Perfil de Profesional. `userId` es a la vez PK y FK a `Usuario` (relación 1:1
 * con clave compartida, igual que `Profesional.userId @id` en el schema.prisma original).
 */
@Entity('profesionales')
export class Profesional {
  @PrimaryColumn()
  userId: number;

  @OneToOne(() => Usuario, (usuario) => usuario.profesional, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'userId' })
  usuario: Usuario;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 30 })
  matricula: string;

  @Column()
  especialidadId: number;

  @ManyToOne(() => Especialidad, { eager: true })
  @JoinColumn({ name: 'especialidadId' })
  especialidad: Especialidad;

  @Column({ type: 'varchar', length: 100, nullable: true })
  establecimiento?: string | null;

  @Column({ type: 'text', nullable: true })
  descripcionFunciones?: string | null;
}

import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { TipoUsuario } from '../../common/enums/tipo-usuario.enum';
import { EstadoUsuario } from '../../common/enums/estado-usuario.enum';
import { Profesional } from './profesional.entity';
import { Tutor } from './tutor.entity';
import { Pcd } from './pcd.entity';

/** Equivalente TypeORM de `model Usuario` en el schema.prisma original. */
@Entity('usuarios')
export class Usuario {
  @PrimaryGeneratedColumn()
  id: number;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 15 })
  dni: string;

  @Column({ type: 'varchar', length: 100 })
  nombre: string;

  @Column({ type: 'varchar', length: 100 })
  apellido: string;

  @Column({ type: 'date' })
  fechaNacimiento: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  telefono?: string | null;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 255 })
  email: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  direccion?: string | null;

  /**
   * Hash bcrypt, nunca el password en texto plano. `select: false`: TypeORM
   * lo excluye de cualquier `find`/`findOne` normal (y de las respuestas de
   * la API que devuelven la entidad tal cual) — hay que pedirlo
   * explícitamente con `.addSelect('usuario.password')` o `select: { password: true, ... }`
   * en los pocos lugares que sí lo necesitan (login, cambio de contraseña).
   */
  @Column({ type: 'varchar', length: 255, select: false })
  password: string;

  @Column({ type: 'enum', enum: TipoUsuario })
  tipoUsuario: TipoUsuario;

  @Column({ type: 'boolean', default: false })
  esAdministrador: boolean;

  @Column({ type: 'enum', enum: EstadoUsuario, default: EstadoUsuario.ACTIVO })
  estado: EstadoUsuario;

  @Column({ type: 'varchar', length: 255, nullable: true })
  pushToken?: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToOne(() => Profesional, (profesional) => profesional.usuario)
  profesional?: Profesional;

  @OneToOne(() => Tutor, (tutor) => tutor.usuario)
  tutor?: Tutor;

  @OneToOne(() => Pcd, (pcd) => pcd.usuario)
  pcd?: Pcd;
}

import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Especialidad } from '../../especialidades/entities/especialidad.entity';

@Entity('terapias')
export class Terapia {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 50 })
  tipo: string;

  @Column({ type: 'varchar', length: 255 })
  descripcion: string;

  /**
   * Especialidad a la que pertenece la terapia. Un especialista solo puede
   * programar (y editar en el catálogo) las de su especialidad; las que no
   * tienen especialidad las usan solo el cabecera y el Administrador.
   */
  @Column({ type: 'int', nullable: true })
  especialidadId?: number | null;

  @ManyToOne(() => Especialidad, { nullable: true, eager: true })
  @JoinColumn({ name: 'especialidadId' })
  especialidad?: Especialidad | null;
}

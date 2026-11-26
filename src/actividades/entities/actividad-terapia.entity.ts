import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToOne,
  PrimaryColumn,
} from 'typeorm';
import { Terapia } from '../../terapias/entities/terapia.entity';
import { Actividad } from './actividad.entity';

@Entity('actividad_terapias')
export class ActividadTerapia {
  @PrimaryColumn()
  actividadId: number;

  @OneToOne(() => Actividad, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'actividadId' })
  actividad: Actividad;

  @Column()
  terapiaId: number;

  @ManyToOne(() => Terapia)
  @JoinColumn({ name: 'terapiaId' })
  terapia: Terapia;
}

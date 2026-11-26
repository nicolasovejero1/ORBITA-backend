import {
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { Profesional } from '../../users/entities/profesional.entity';
import { ReporteProgreso } from './reporte-progreso.entity';

@Entity('reporte_colaboradores')
export class ReporteColaborador {
  @PrimaryColumn()
  profesionalId: number;

  @PrimaryColumn()
  reporteId: number;

  @ManyToOne(() => Profesional)
  @JoinColumn({ name: 'profesionalId' })
  profesional: Profesional;

  @ManyToOne(() => ReporteProgreso, (reporte) => reporte.colaboradores, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'reporteId' })
  reporte: ReporteProgreso;

  @CreateDateColumn()
  fechaAcceso: Date;
}

import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { TipoAdjunto } from '../../common/enums/tipo-adjunto.enum';
import { ReporteProgreso } from './reporte-progreso.entity';

@Entity('reporte_adjuntos')
export class ReporteAdjunto {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  reporteId: number;

  @ManyToOne(() => ReporteProgreso, (reporte) => reporte.adjuntos, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'reporteId' })
  reporte: ReporteProgreso;

  @Column({ type: 'enum', enum: TipoAdjunto })
  tipoArchivo: TipoAdjunto;

  @Column({ type: 'varchar', length: 500 })
  filePath: string;
}

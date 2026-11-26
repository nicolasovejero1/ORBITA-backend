import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { Medicamento } from '../../medicamentos/entities/medicamento.entity';
import { Actividad } from './actividad.entity';

@Entity('actividad_medicamentos')
export class ActividadMedicamento {
  @PrimaryColumn()
  actividadId: number;

  @PrimaryColumn()
  medicamentoId: number;

  @ManyToOne(() => Actividad, (actividad) => actividad.medicamentos, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'actividadId' })
  actividad: Actividad;

  @ManyToOne(() => Medicamento)
  @JoinColumn({ name: 'medicamentoId' })
  medicamento: Medicamento;

  @Column({ type: 'varchar', length: 100, nullable: true })
  dosis?: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  frecuencia?: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  duracionTratamiento?: string | null;

  @Column({ type: 'text', nullable: true })
  indicacion?: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  medicoPrescriptor?: string | null;
}

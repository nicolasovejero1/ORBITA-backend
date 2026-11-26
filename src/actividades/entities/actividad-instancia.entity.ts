import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Usuario } from '../../users/entities/usuario.entity';
import { EstadoInstancia } from '../../common/enums/estado-instancia.enum';
import { Actividad } from './actividad.entity';

@Entity('actividad_instancias')
export class ActividadInstancia {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  actividadId: number;

  @ManyToOne(() => Actividad, (actividad) => actividad.instancias, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'actividadId' })
  actividad: Actividad;

  // String 'YYYY-MM-DD', no Date — ver nota en actividad.entity.ts.
  @Column({ type: 'date' })
  fechaProgramada: string;

  @Column({
    type: 'enum',
    enum: EstadoInstancia,
    default: EstadoInstancia.PENDIENTE,
  })
  estado: EstadoInstancia;

  @Column({ type: 'datetime', nullable: true })
  confirmedAt?: Date | null;

  @Column({ nullable: true })
  confirmedByUserId?: number | null;

  @ManyToOne(() => Usuario)
  @JoinColumn({ name: 'confirmedByUserId' })
  confirmedBy?: Usuario | null;

  /**
   * Campos nuevos en BackendV3: la transición a CANCELADA nunca se implementó
   * en V1/V2 pese a existir el valor en el enum.
   * Se agrega trazabilidad simétrica a confirmedAt/confirmedByUserId.
   */
  @Column({ type: 'datetime', nullable: true })
  canceledAt?: Date | null;

  @Column({ nullable: true })
  canceledByUserId?: number | null;

  @ManyToOne(() => Usuario)
  @JoinColumn({ name: 'canceledByUserId' })
  canceledBy?: Usuario | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  motivoCancelacion?: string | null;
}

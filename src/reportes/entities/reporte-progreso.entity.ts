import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Profesional } from '../../users/entities/profesional.entity';
import { Actividad } from '../../actividades/entities/actividad.entity';
import { ActividadInstancia } from '../../actividades/entities/actividad-instancia.entity';
import { EstadoReporte } from '../../common/enums/estado-reporte.enum';
import { TipoReporte } from '../../common/enums/tipo-reporte.enum';
import { ReporteAdjunto } from './reporte-adjunto.entity';
import { ReporteColaborador } from './reporte-colaborador.entity';

/**
 * `@@unique([profesionalId, instanciaId])` del schema.prisma original: permite
 * múltiples reportes generales (instanciaId NULL) del mismo profesional sobre
 * la misma actividad, pero un único reporte por sesión puntual por profesional
 * (MySQL no considera duplicados los NULL en índices únicos).
 */
@Entity('reportes_progreso')
@Index(['profesionalId', 'instanciaId'], { unique: true })
export class ReporteProgreso {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  profesionalId: number;

  @ManyToOne(() => Profesional)
  @JoinColumn({ name: 'profesionalId' })
  profesional: Profesional;

  @Column()
  actividadId: number;

  @ManyToOne(() => Actividad)
  @JoinColumn({ name: 'actividadId' })
  actividad: Actividad;

  @Column({ nullable: true })
  instanciaId?: number | null;

  @ManyToOne(() => ActividadInstancia)
  @JoinColumn({ name: 'instanciaId' })
  instancia?: ActividadInstancia | null;

  @Column({ type: 'varchar', length: 100 })
  titulo: string;

  @Column({ type: 'text', nullable: true })
  descripcionDetallada?: string | null;

  @Column({ type: 'enum', enum: TipoReporte })
  tipo: TipoReporte;

  @Column({
    type: 'enum',
    enum: EstadoReporte,
    default: EstadoReporte.EN_CURSO,
  })
  estado: EstadoReporte;

  @Column({ type: 'boolean', default: false })
  visibilidadTutor: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => ReporteAdjunto, (adjunto) => adjunto.reporte)
  adjuntos: ReporteAdjunto[];

  @OneToMany(() => ReporteColaborador, (colaborador) => colaborador.reporte)
  colaboradores: ReporteColaborador[];
}

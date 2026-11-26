import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Usuario } from '../../users/entities/usuario.entity';
import { Pcd } from '../../users/entities/pcd.entity';
import { TipoActividad } from '../../common/enums/tipo-actividad.enum';
import { EstadoActividad } from '../../common/enums/estado-actividad.enum';
import { FrecuenciaActividad } from '../../common/enums/frecuencia-actividad.enum';
import { ActividadInstancia } from './actividad-instancia.entity';
import { ActividadMedicamento } from './actividad-medicamento.entity';
import { ActividadTerapia } from './actividad-terapia.entity';

@Entity('actividades')
export class Actividad {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 100 })
  titulo: string;

  @Column({ type: 'text' })
  descripcion: string;

  // Nota: TypeORM+mysql2 devuelve las columnas `date` como string 'YYYY-MM-DD',
  // no como `Date` (a diferencia de `datetime`/`timestamp`). Tratarlo como
  // `Date` acá causó un bug real (`fecha.getFullYear is not a function` en
  // RecordatoriosService).
  @Column({ type: 'date' })
  fechaInicio: string;

  @Column({ type: 'date' })
  fechaFin: string;

  @Column({ type: 'time', nullable: true })
  horarioInicio?: string | null;

  @Column({ type: 'time', nullable: true })
  horarioFin?: string | null;

  @Column({ type: 'text', nullable: true })
  observaciones?: string | null;

  @Column({
    type: 'enum',
    enum: EstadoActividad,
    default: EstadoActividad.PENDIENTE,
  })
  estado: EstadoActividad;

  @Column({ type: 'enum', enum: TipoActividad })
  tipoActividad: TipoActividad;

  @Column({ type: 'enum', enum: FrecuenciaActividad })
  frecuencia: FrecuenciaActividad;

  @Column({ type: 'json', nullable: true })
  diasSemana?: string[] | null;

  @Column({ type: 'int', nullable: true })
  recordarAntesMinutos?: number | null;

  @Column()
  creadoPorUserId: number;

  @ManyToOne(() => Usuario)
  @JoinColumn({ name: 'creadoPorUserId' })
  creadoPor: Usuario;

  @Column()
  pcdId: number;

  @ManyToOne(() => Pcd)
  @JoinColumn({ name: 'pcdId' })
  pcd: Pcd;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => ActividadInstancia, (instancia) => instancia.actividad)
  instancias: ActividadInstancia[];

  @OneToMany(() => ActividadMedicamento, (am) => am.actividad)
  medicamentos: ActividadMedicamento[];

  @OneToOne(() => ActividadTerapia, (at) => at.actividad)
  terapia?: ActividadTerapia | null;
}

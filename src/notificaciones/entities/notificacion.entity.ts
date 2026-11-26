import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Usuario } from '../../users/entities/usuario.entity';
import { Pcd } from '../../users/entities/pcd.entity';
import { Actividad } from '../../actividades/entities/actividad.entity';
import { ActividadInstancia } from '../../actividades/entities/actividad-instancia.entity';
import { EstadoNotificacion } from '../../common/enums/estado-notificacion.enum';
import { TipoNotificacion } from '../../common/enums/tipo-notificacion.enum';

@Entity('notificaciones')
export class Notificacion {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  usuarioId: number;

  @ManyToOne(() => Usuario, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'usuarioId' })
  usuario: Usuario;

  @Column({ type: 'enum', enum: TipoNotificacion })
  tipo: TipoNotificacion;

  @Column({ type: 'text' })
  mensaje: string;

  @Column({
    type: 'enum',
    enum: EstadoNotificacion,
    default: EstadoNotificacion.PENDIENTE,
  })
  estado: EstadoNotificacion;

  @Column({ type: 'datetime', nullable: true })
  leidaAt?: Date | null;

  @Column({ nullable: true })
  actividadId?: number | null;

  @ManyToOne(() => Actividad, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'actividadId' })
  actividad?: Actividad | null;

  @Column({ nullable: true })
  instanciaId?: number | null;

  @ManyToOne(() => ActividadInstancia, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'instanciaId' })
  instancia?: ActividadInstancia | null;

  /**
   * PCD referenciado (Paso 10). Lo usaban las alertas de zona segura, que se
   * quitaron (C23); queda para notificaciones que refieran a un PCD.
   */
  @Column({ nullable: true })
  pcdId?: number | null;

  @ManyToOne(() => Pcd, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'pcdId' })
  pcd?: Pcd | null;

  @CreateDateColumn()
  createdAt: Date;
}

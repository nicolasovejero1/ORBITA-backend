import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { Pcd } from '../../users/entities/pcd.entity';
import { Tutor } from '../../users/entities/tutor.entity';
import { EstadoVinculo } from '../../common/enums/estado-vinculo.enum';

/** PK compuesta (tutorId, pcdId), igual que `@@id([tutorId, pcdId])` en Prisma. */
@Entity('tutor_pcd')
export class TutorPcd {
  @PrimaryColumn()
  tutorId: number;

  @PrimaryColumn()
  pcdId: number;

  @ManyToOne(() => Tutor)
  @JoinColumn({ name: 'tutorId' })
  tutor: Tutor;

  @ManyToOne(() => Pcd)
  @JoinColumn({ name: 'pcdId' })
  pcd: Pcd;

  /** Relación de este tutor con este PCD (Madre, Padre, Tía...). Es del vínculo, no del tutor. */
  @Column({ type: 'varchar', length: 30 })
  parentesco: string;

  @Column({ type: 'enum', enum: EstadoVinculo, default: EstadoVinculo.ACTIVO })
  estado: EstadoVinculo;

  @CreateDateColumn()
  fechaAsignacion: Date;
}

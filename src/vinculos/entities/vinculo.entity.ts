import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { Pcd } from '../../users/entities/pcd.entity';
import { Profesional } from '../../users/entities/profesional.entity';
import { EstadoVinculo } from '../../common/enums/estado-vinculo.enum';
import { RolProfesionalVinculo } from '../../common/enums/rol-profesional-vinculo.enum';

/** PK compuesta (pcdId, profesionalId), igual que `@@id([pcdId, profesionalId])` en Prisma. */
@Entity('vinculos')
export class Vinculo {
  @PrimaryColumn()
  pcdId: number;

  @PrimaryColumn()
  profesionalId: number;

  @ManyToOne(() => Pcd)
  @JoinColumn({ name: 'pcdId' })
  pcd: Pcd;

  @ManyToOne(() => Profesional)
  @JoinColumn({ name: 'profesionalId' })
  profesional: Profesional;

  @Column({ type: 'enum', enum: RolProfesionalVinculo })
  rolProfesional: RolProfesionalVinculo;

  @Column({ type: 'enum', enum: EstadoVinculo, default: EstadoVinculo.ACTIVO })
  estado: EstadoVinculo;

  @CreateDateColumn()
  fechaAsignacion: Date;
}

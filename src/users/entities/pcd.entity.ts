import {
  Column,
  Entity,
  JoinColumn,
  OneToMany,
  OneToOne,
  PrimaryColumn,
} from 'typeorm';
import { Usuario } from './usuario.entity';
import { Vinculo } from '../../vinculos/entities/vinculo.entity';
import { TutorPcd } from '../../vinculos/entities/tutor-pcd.entity';

@Entity('pcds')
export class Pcd {
  @PrimaryColumn()
  userId: number;

  @OneToOne(() => Usuario, (usuario) => usuario.pcd, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  usuario: Usuario;

  @Column({ type: 'varchar', length: 255, nullable: true })
  tipoDiscapacidad?: string | null;

  @Column({ type: 'varchar', length: 10, nullable: true })
  grado?: string | null;

  @Column({ type: 'text', nullable: true })
  diagnostico?: string | null;

  @OneToMany(() => Vinculo, (vinculo) => vinculo.pcd)
  vinculos: Vinculo[];

  @OneToMany(() => TutorPcd, (tutorPcd) => tutorPcd.pcd)
  tutorPcds: TutorPcd[];
}

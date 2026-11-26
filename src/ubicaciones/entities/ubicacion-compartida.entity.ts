import {
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { Usuario } from '../../users/entities/usuario.entity';
import { Pcd } from '../../users/entities/pcd.entity';

/** PK compuesta (usuarioId, pcdId), igual que `@@id([usuarioId, pcdId])` en Prisma. */
@Entity('ubicaciones_compartidas')
export class UbicacionCompartida {
  @PrimaryColumn()
  usuarioId: number;

  @PrimaryColumn()
  pcdId: number;

  @ManyToOne(() => Usuario, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'usuarioId' })
  usuario: Usuario;

  @ManyToOne(() => Pcd, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'pcdId' })
  pcd: Pcd;

  @CreateDateColumn()
  fechaDesde: Date;
}

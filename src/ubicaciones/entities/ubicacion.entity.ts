import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Pcd } from '../../users/entities/pcd.entity';

/**
 * Latitud/longitud/precisión tipadas `string`: columnas `decimal`, TypeORM+mysql2
 * las devuelve como string para no perder precisión (igual que Prisma con su
 * tipo `Decimal`); se convierten con `Number(...)` donde hace falta.
 */
@Entity('ubicaciones')
@Index('IDX_ubicaciones_pcd_fecha', ['pcdId', 'fechaHora'])
export class Ubicacion {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  pcdId: number;

  @ManyToOne(() => Pcd, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'pcdId' })
  pcd: Pcd;

  @Column({ type: 'decimal', precision: 10, scale: 8 })
  latitud: string;

  @Column({ type: 'decimal', precision: 11, scale: 8 })
  longitud: string;

  @Column({ type: 'decimal', precision: 4, scale: 1, nullable: true })
  precision?: string | null;

  @CreateDateColumn()
  fechaHora: Date;
}

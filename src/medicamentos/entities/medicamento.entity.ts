import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('medicamentos')
export class Medicamento {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 255 })
  nombre: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  presentacion?: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  tipo?: string | null;

  @Column({ type: 'text', nullable: true })
  descripcion?: string | null;

  @CreateDateColumn()
  createdAt: Date;
}

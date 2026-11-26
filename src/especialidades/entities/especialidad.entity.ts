import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/**
 * Catálogo de especialidades. Cada Profesional tiene una y cada Terapia
 * pertenece a una: un especialista solo programa terapias de su especialidad.
 */
@Entity('especialidades')
export class Especialidad {
  @PrimaryGeneratedColumn()
  id: number;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 100 })
  nombre: string;
}

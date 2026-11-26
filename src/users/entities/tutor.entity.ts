import { Entity, JoinColumn, OneToOne, PrimaryColumn } from 'typeorm';
import { Usuario } from './usuario.entity';

@Entity('tutores')
export class Tutor {
  @PrimaryColumn()
  userId: number;

  @OneToOne(() => Usuario, (usuario) => usuario.tutor, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  usuario: Usuario;
}

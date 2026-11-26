import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TipoUsuario } from '../enums/tipo-usuario.enum';
import { EstadoVinculo } from '../enums/estado-vinculo.enum';
import { RolProfesionalVinculo } from '../enums/rol-profesional-vinculo.enum';
import { Vinculo } from '../../vinculos/entities/vinculo.entity';
import { TutorPcd } from '../../vinculos/entities/tutor-pcd.entity';

/**
 * Chequeos de vínculo activo (Profesional-PCD o Tutor-PCD) usados como control
 * de acceso en Usuarios, Actividades y Reportes.
 */
@Injectable()
export class VinculoAccessService {
  constructor(
    @InjectRepository(Vinculo)
    private readonly vinculoRepo: Repository<Vinculo>,
    @InjectRepository(TutorPcd)
    private readonly tutorPcdRepo: Repository<TutorPcd>,
  ) {}

  async assertVinculoActivo(
    userId: number,
    tipoUsuario: TipoUsuario,
    pcdId: number,
  ): Promise<void> {
    if (tipoUsuario === TipoUsuario.PROFESIONAL) {
      const vinculo = await this.vinculoRepo.findOne({
        where: { pcdId, profesionalId: userId },
      });
      if (!vinculo || vinculo.estado !== EstadoVinculo.ACTIVO) {
        throw new ForbiddenException(
          'El profesional no tiene un vínculo activo con este PCD',
        );
      }
    }

    if (tipoUsuario === TipoUsuario.TUTOR) {
      const vinculo = await this.tutorPcdRepo.findOne({
        where: { tutorId: userId, pcdId },
      });
      if (!vinculo || vinculo.estado !== EstadoVinculo.ACTIVO) {
        throw new ForbiddenException(
          'El tutor no tiene un vínculo activo con este PCD',
        );
      }
    }
  }

  /** El Profesional es el médico de cabecera ACTIVO de ese PCD. */
  esCabeceraActivo(userId: number, pcdId: number): Promise<boolean> {
    return this.vinculoRepo.exists({
      where: {
        pcdId,
        profesionalId: userId,
        rolProfesional: RolProfesionalVinculo.CABECERA,
        estado: EstadoVinculo.ACTIVO,
      },
    });
  }

  /** true/false sin lanzar — útil cuando el chequeo es sobre un rol que puede no tener vínculo (p. ej. Admin). */
  async tieneVinculoActivo(
    userId: number,
    tipoUsuario: TipoUsuario,
    pcdId: number,
  ): Promise<boolean> {
    try {
      await this.assertVinculoActivo(userId, tipoUsuario, pcdId);
      return true;
    } catch {
      return false;
    }
  }
}

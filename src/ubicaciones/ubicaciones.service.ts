import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, LessThan, Repository } from 'typeorm';
import { Between, LessThanOrEqual, MoreThanOrEqual } from 'typeorm';
import { Ubicacion } from './entities/ubicacion.entity';
import { UbicacionCompartida } from './entities/ubicacion-compartida.entity';
import { Usuario } from '../users/entities/usuario.entity';
import { CreateUbicacionDto } from './dto/create-ubicacion.dto';
import { ShareUbicacionDto } from './dto/share-ubicacion.dto';
import {
  HISTORIAL_LIMITE_DEFECTO,
  HistorialQueryDto,
} from './dto/historial-query.dto';
import { UbicacionesEvents } from './ubicaciones.events';
import { TipoUsuario } from '../common/enums/tipo-usuario.enum';
import { VinculoAccessService } from '../common/services/vinculo-access.service';
import type { CallerInfo } from '../auth/decorators/current-user.decorator';

@Injectable()
export class UbicacionesService {
  constructor(
    @InjectRepository(Ubicacion)
    private readonly ubicacionRepo: Repository<Ubicacion>,
    @InjectRepository(UbicacionCompartida)
    private readonly compartidaRepo: Repository<UbicacionCompartida>,
    @InjectRepository(Usuario)
    private readonly usuarioRepo: Repository<Usuario>,
    private readonly vinculoAccessService: VinculoAccessService,
    private readonly events: UbicacionesEvents,
  ) {}

  async registrar(pcdId: number, dto: CreateUbicacionDto) {
    const ubicacion = this.ubicacionRepo.create({
      pcdId,
      latitud: String(dto.latitud),
      longitud: String(dto.longitud),
      precision:
        dto.precision !== undefined ? String(dto.precision) : undefined,
    });
    const guardada = await this.ubicacionRepo.save(ubicacion);
    // Se reparte por socket a quienes la están mirando (ver UbicacionesGateway).
    this.events.nueva$.next(guardada);
    return guardada;
  }

  async findUltima(pcdId: number, caller: CallerInfo) {
    await this.verificarAccesoLectura(pcdId, caller);

    const ubicacion = await this.ubicacionRepo.findOne({
      where: { pcdId },
      order: { fechaHora: 'DESC' },
    });
    if (!ubicacion) {
      throw new NotFoundException('El PCD todavía no registró su ubicación');
    }
    return ubicacion;
  }

  /**
   * Las ubicaciones del PCD, de la más nueva a la más vieja. Se puede acotar
   * con `desde`/`hasta` y paginar con `antes` (el id de la última recibida).
   */
  async historial(
    pcdId: number,
    caller: CallerInfo,
    query: HistorialQueryDto = {},
  ) {
    await this.verificarAccesoLectura(pcdId, caller);

    const desde = query.desde ? new Date(query.desde) : undefined;
    const hasta = query.hasta ? new Date(query.hasta) : undefined;
    if (desde && hasta && desde > hasta) {
      throw new BadRequestException('"desde" no puede ser posterior a "hasta"');
    }

    const where: FindOptionsWhere<Ubicacion> = { pcdId };
    if (desde && hasta) where.fechaHora = Between(desde, hasta);
    else if (desde) where.fechaHora = MoreThanOrEqual(desde);
    else if (hasta) where.fechaHora = LessThanOrEqual(hasta);
    if (query.antes) where.id = LessThan(query.antes);

    return this.ubicacionRepo.find({
      where,
      order: { fechaHora: 'DESC', id: 'DESC' },
      take: query.limite ?? HISTORIAL_LIMITE_DEFECTO,
    });
  }

  findCompartidos(pcdId: number) {
    return this.compartidaRepo.find({
      where: { pcdId },
      relations: { usuario: true },
      order: { fechaDesde: 'DESC' },
    });
  }

  async compartir(pcdId: number, dto: ShareUbicacionDto) {
    if (dto.usuarioId === pcdId) {
      throw new BadRequestException(
        'No podés compartir tu ubicación con vos mismo',
      );
    }

    const usuario = await this.usuarioRepo.findOne({
      where: { id: dto.usuarioId },
    });
    if (!usuario) {
      throw new NotFoundException(`Usuario ${dto.usuarioId} no encontrado`);
    }
    if (
      usuario.tipoUsuario !== TipoUsuario.TUTOR &&
      usuario.tipoUsuario !== TipoUsuario.PROFESIONAL
    ) {
      throw new BadRequestException(
        'Solo se puede compartir la ubicación con tutores o profesionales',
      );
    }
    // Solo se comparte con quien tiene vínculo activo con el PCD. Si el vínculo
    // se desactiva después, la compartición se mantiene hasta que el PCD la
    // revoque.
    await this.vinculoAccessService.assertVinculoActivo(
      usuario.id,
      usuario.tipoUsuario,
      pcdId,
    );

    const existente = await this.compartidaRepo.findOne({
      where: { usuarioId: dto.usuarioId, pcdId },
      relations: { usuario: true },
    });
    if (existente) {
      return existente;
    }

    const compartida = this.compartidaRepo.create({
      usuarioId: dto.usuarioId,
      pcdId,
    });
    await this.compartidaRepo.save(compartida);
    return this.compartidaRepo.findOne({
      where: { usuarioId: dto.usuarioId, pcdId },
      relations: { usuario: true },
    });
  }

  async revocar(pcdId: number, usuarioId: number) {
    const existe = await this.compartidaRepo.findOne({
      where: { usuarioId, pcdId },
    });
    if (!existe) {
      throw new NotFoundException(
        'No existe acceso compartido con ese usuario',
      );
    }

    await this.compartidaRepo.delete({ usuarioId, pcdId });
    // Si tiene la pantalla abierta, deja de recibir ubicaciones al instante.
    this.events.revocada$.next({ usuarioId, pcdId });
    return { message: 'Acceso revocado correctamente' };
  }

  async verificarAccesoLectura(
    pcdId: number,
    caller: CallerInfo,
  ): Promise<void> {
    // Ni siquiera el permiso de administrador da acceso: la ubicación es
    // opt-in del PCD.
    if (caller.tipoUsuario === TipoUsuario.PCD) {
      if (caller.id !== pcdId) {
        throw new ForbiddenException(
          'No tenés acceso a la ubicación de este PCD',
        );
      }
      return;
    }

    const compartida = await this.compartidaRepo.findOne({
      where: { usuarioId: caller.id, pcdId },
    });
    if (!compartida) {
      throw new ForbiddenException(
        'No tenés acceso compartido a la ubicación de este PCD',
      );
    }
  }
}

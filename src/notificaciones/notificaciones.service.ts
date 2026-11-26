import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, Repository } from 'typeorm';
import { Usuario } from '../users/entities/usuario.entity';
import { EstadoNotificacion } from '../common/enums/estado-notificacion.enum';
import type { CallerInfo } from '../auth/decorators/current-user.decorator';
import { Notificacion } from './entities/notificacion.entity';
import { CreateNotificacionDto } from './dto/create-notificacion.dto';
import { PushService } from './push.service';

export type FiltroNotificacion =
  'TODAS' | 'NO_LEIDA' | 'LEIDA' | EstadoNotificacion;

@Injectable()
export class NotificacionesService {
  constructor(
    @InjectRepository(Notificacion)
    private readonly notificacionRepo: Repository<Notificacion>,
    @InjectRepository(Usuario)
    private readonly usuarioRepo: Repository<Usuario>,
    private readonly push: PushService,
  ) {}

  async create(dto: CreateNotificacionDto) {
    const notificacion = await this.notificacionRepo.save(
      this.notificacionRepo.create({
        usuarioId: dto.usuarioId,
        tipo: dto.tipo,
        mensaje: dto.mensaje,
        actividadId: dto.actividadId ?? null,
      }),
    );
    await this.push.enviarNotificaciones([notificacion]);
    return this.notificacionRepo.findOne({
      where: { id: notificacion.id },
      relations: { actividad: true },
    });
  }

  async registrarPushToken(usuarioId: number, token: string) {
    await this.usuarioRepo.update(usuarioId, { pushToken: token });
    return { message: 'Token de push registrado correctamente' };
  }

  async eliminarPushToken(usuarioId: number) {
    await this.usuarioRepo.update(usuarioId, { pushToken: null });
    return { message: 'Token de push eliminado correctamente' };
  }

  async findAll(
    caller: CallerInfo,
    filtro?: FiltroNotificacion,
    skip?: number,
    take?: number,
  ) {
    const limit = Math.min(Math.max(take ?? 30, 1), 50);
    const offset = Math.max(skip ?? 0, 0);

    const items = await this.notificacionRepo.find({
      where: {
        usuarioId: caller.id,
        ...this.buildEstadoFilter(filtro),
      },
      relations: { actividad: true },
      order: { createdAt: 'DESC' },
      skip: offset,
      take: limit + 1,
    });
    const hasMore = items.length > limit;
    return { items: items.slice(0, limit), hasMore };
  }

  async countNoLeidas(caller: CallerInfo) {
    const total = await this.notificacionRepo.count({
      where: {
        usuarioId: caller.id,
        estado: Not(EstadoNotificacion.LEIDA),
      },
    });
    return { total };
  }

  async findOne(id: number, caller: CallerInfo) {
    const notificacion = await this.notificacionRepo.findOne({
      where: { id, usuarioId: caller.id },
      relations: { actividad: true },
    });
    if (!notificacion) {
      throw new NotFoundException(`Notificación ${id} no encontrada`);
    }
    return notificacion;
  }

  async marcarLeida(id: number, caller: CallerInfo) {
    await this.findOne(id, caller);
    await this.notificacionRepo.update(id, {
      estado: EstadoNotificacion.LEIDA,
      leidaAt: new Date(),
    });
    return this.notificacionRepo.findOne({
      where: { id },
      relations: { actividad: true },
    });
  }

  async marcarTodasLeidas(caller: CallerInfo) {
    const res = await this.notificacionRepo.update(
      { usuarioId: caller.id, estado: Not(EstadoNotificacion.LEIDA) },
      { estado: EstadoNotificacion.LEIDA, leidaAt: new Date() },
    );
    return { count: res.affected ?? 0 };
  }

  async remove(id: number, caller: CallerInfo) {
    await this.findOne(id, caller);
    await this.notificacionRepo.delete(id);
    return { message: `Notificación ${id} eliminada correctamente` };
  }

  private buildEstadoFilter(filtro?: FiltroNotificacion) {
    if (!filtro || filtro === 'TODAS') return {};
    if (filtro === 'NO_LEIDA') {
      return { estado: Not(EstadoNotificacion.LEIDA) };
    }
    if (filtro === 'LEIDA') {
      return { estado: EstadoNotificacion.LEIDA };
    }
    if ((Object.values(EstadoNotificacion) as string[]).includes(filtro)) {
      return { estado: filtro as EstadoNotificacion };
    }
    return {};
  }
}

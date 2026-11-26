import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, Repository } from 'typeorm';
import { Profesional } from '../users/entities/profesional.entity';
import { Terapia } from '../terapias/entities/terapia.entity';
import { Especialidad } from './entities/especialidad.entity';
import {
  CreateEspecialidadDto,
  UpdateEspecialidadDto,
} from './dto/create-especialidad.dto';

@Injectable()
export class EspecialidadesService {
  constructor(
    @InjectRepository(Especialidad)
    private readonly especialidadRepo: Repository<Especialidad>,
    @InjectRepository(Profesional)
    private readonly profesionalRepo: Repository<Profesional>,
    @InjectRepository(Terapia)
    private readonly terapiaRepo: Repository<Terapia>,
  ) {}

  findAll() {
    return this.especialidadRepo.find({ order: { nombre: 'ASC' } });
  }

  async findOne(id: number) {
    const especialidad = await this.especialidadRepo.findOne({ where: { id } });
    if (!especialidad) {
      throw new NotFoundException(`Especialidad con id ${id} no encontrada`);
    }
    return especialidad;
  }

  async create(dto: CreateEspecialidadDto) {
    const nombre = dto.nombre.trim();
    await this.assertNombreLibre(nombre);
    return this.especialidadRepo.save(this.especialidadRepo.create({ nombre }));
  }

  async update(id: number, dto: UpdateEspecialidadDto) {
    await this.findOne(id);
    const nombre = dto.nombre?.trim();
    if (nombre !== undefined) {
      await this.assertNombreLibre(nombre, id);
      await this.especialidadRepo.update(id, { nombre });
    }
    return this.findOne(id);
  }

  async remove(id: number) {
    const especialidad = await this.findOne(id);
    const [profesionales, terapias] = await Promise.all([
      this.profesionalRepo.count({ where: { especialidadId: id } }),
      this.terapiaRepo.count({ where: { especialidadId: id } }),
    ]);
    if (profesionales > 0 || terapias > 0) {
      throw new ConflictException(
        `No se puede eliminar "${especialidad.nombre}": la usan ${profesionales} profesional(es) y ${terapias} terapia(s)`,
      );
    }
    await this.especialidadRepo.delete(id);
    return { message: `Especialidad ${id} eliminada correctamente` };
  }

  /** El nombre es único (sin distinguir mayúsculas ni acentos, por la intercalación de MySQL). */
  private async assertNombreLibre(nombre: string, exceptoId?: number) {
    const existe = await this.especialidadRepo.findOne({
      where: { nombre, ...(exceptoId && { id: Not(exceptoId) }) },
    });
    if (existe) {
      throw new ConflictException(
        `Ya existe la especialidad "${existe.nombre}"`,
      );
    }
  }
}

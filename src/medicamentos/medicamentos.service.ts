import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Like, Not, Repository } from 'typeorm';
import { ActividadMedicamento } from '../actividades/entities/actividad-medicamento.entity';
import { Medicamento } from './entities/medicamento.entity';
import { CreateMedicamentoDto } from './dto/create-medicamento.dto';
import { UpdateMedicamentoDto } from './dto/update-medicamento.dto';

@Injectable()
export class MedicamentosService {
  constructor(
    @InjectRepository(Medicamento)
    private readonly medicamentoRepo: Repository<Medicamento>,
    @InjectRepository(ActividadMedicamento)
    private readonly actividadMedicamentoRepo: Repository<ActividadMedicamento>,
  ) {}

  async create(dto: CreateMedicamentoDto) {
    const nombre = dto.nombre.trim();
    await this.assertNombreLibre(nombre);
    return this.medicamentoRepo.save(
      this.medicamentoRepo.create({ ...dto, nombre }),
    );
  }

  findAll(nombre?: string) {
    return this.medicamentoRepo.find({
      where: nombre ? { nombre: Like(`%${nombre}%`) } : undefined,
      order: { nombre: 'ASC' },
    });
  }

  async findOne(id: number) {
    const medicamento = await this.medicamentoRepo.findOne({ where: { id } });
    if (!medicamento) {
      throw new NotFoundException(`Medicamento con id ${id} no encontrado`);
    }
    return medicamento;
  }

  async update(id: number, dto: UpdateMedicamentoDto) {
    await this.findOne(id);
    const nombre = dto.nombre?.trim();
    if (nombre !== undefined) await this.assertNombreLibre(nombre, id);
    await this.medicamentoRepo.update(id, {
      ...dto,
      ...(nombre !== undefined && { nombre }),
    });
    return this.findOne(id);
  }

  async remove(id: number) {
    const medicamento = await this.findOne(id);
    const enUso = await this.actividadMedicamentoRepo.count({
      where: { medicamentoId: id },
    });
    if (enUso > 0) {
      throw new ConflictException(
        `No se puede eliminar "${medicamento.nombre}": está asignado a ${enUso} actividad(es). Quitalo de esas actividades primero.`,
      );
    }
    await this.medicamentoRepo.delete(id);
    return { message: `Medicamento ${id} eliminado correctamente` };
  }

  /**
   * El nombre del medicamento es único en el catálogo. La comparación la hace
   * MySQL con la intercalación de la columna (utf8mb4_0900_ai_ci), así que
   * "Ibuprofeno" e "ibuprofeno" cuentan como el mismo.
   */
  private async assertNombreLibre(nombre: string, exceptoId?: number) {
    const existe = await this.medicamentoRepo.findOne({
      where: { nombre, ...(exceptoId && { id: Not(exceptoId) }) },
    });
    if (existe) {
      throw new ConflictException(
        `Ya existe un medicamento llamado "${existe.nombre}"`,
      );
    }
  }
}

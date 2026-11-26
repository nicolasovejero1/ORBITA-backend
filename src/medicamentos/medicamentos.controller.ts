import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { TipoUsuario } from '../common/enums/tipo-usuario.enum';
import { Roles } from '../auth/decorators/roles.decorator';
import { CreateMedicamentoDto } from './dto/create-medicamento.dto';
import { UpdateMedicamentoDto } from './dto/update-medicamento.dto';
import { MedicamentosService } from './medicamentos.service';

@ApiTags('Medicamentos')
@ApiBearerAuth()
@Controller('medicamentos')
export class MedicamentosController {
  constructor(private readonly medicamentosService: MedicamentosService) {}

  @Post()
  @Roles(TipoUsuario.ADMINISTRADOR, TipoUsuario.PROFESIONAL)
  @ApiOperation({
    summary:
      'Crear medicamento en el catálogo (Admin/Profesional). El nombre es único: 409 si ya existe',
  })
  create(@Body() dto: CreateMedicamentoDto) {
    return this.medicamentosService.create(dto);
  }

  @Get()
  @Roles(
    TipoUsuario.ADMINISTRADOR,
    TipoUsuario.PROFESIONAL,
    TipoUsuario.TUTOR,
    TipoUsuario.PCD,
  )
  @ApiOperation({
    summary:
      'Listar medicamentos (todos los roles: el Tutor también crea actividades de tipo MEDICAMENTO)',
  })
  @ApiQuery({ name: 'nombre', required: false })
  findAll(@Query('nombre') nombre?: string) {
    return this.medicamentosService.findAll(nombre);
  }

  @Get(':id')
  @Roles(
    TipoUsuario.ADMINISTRADOR,
    TipoUsuario.PROFESIONAL,
    TipoUsuario.TUTOR,
    TipoUsuario.PCD,
  )
  @ApiOperation({ summary: 'Ver medicamento por ID (todos los roles)' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.medicamentosService.findOne(id);
  }

  @Put(':id')
  @Roles(TipoUsuario.ADMINISTRADOR, TipoUsuario.PROFESIONAL)
  @ApiOperation({ summary: 'Modificar medicamento (Admin/Profesional)' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateMedicamentoDto,
  ) {
    return this.medicamentosService.update(id, dto);
  }

  @Delete(':id')
  @Roles(TipoUsuario.ADMINISTRADOR, TipoUsuario.PROFESIONAL)
  @ApiOperation({
    summary:
      'Eliminar medicamento del catálogo (Admin/Profesional). 409 si está asignado a alguna actividad',
  })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.medicamentosService.remove(id);
  }
}

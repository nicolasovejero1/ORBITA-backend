import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator';
import { TipoUsuario } from '../common/enums/tipo-usuario.enum';
import { EspecialidadesService } from './especialidades.service';
import {
  CreateEspecialidadDto,
  UpdateEspecialidadDto,
} from './dto/create-especialidad.dto';

@ApiTags('Especialidades')
@ApiBearerAuth()
@Controller('especialidades')
export class EspecialidadesController {
  constructor(private readonly especialidadesService: EspecialidadesService) {}

  @Get()
  @Roles(
    TipoUsuario.ADMINISTRADOR,
    TipoUsuario.PROFESIONAL,
    TipoUsuario.TUTOR,
    TipoUsuario.PCD,
  )
  @ApiOperation({ summary: 'Listar especialidades (todos los roles)' })
  findAll() {
    return this.especialidadesService.findAll();
  }

  @Post()
  @Roles(TipoUsuario.ADMINISTRADOR)
  @ApiOperation({ summary: 'Crear especialidad (Admin). 409 si ya existe' })
  create(@Body() dto: CreateEspecialidadDto) {
    return this.especialidadesService.create(dto);
  }

  @Put(':id')
  @Roles(TipoUsuario.ADMINISTRADOR)
  @ApiOperation({ summary: 'Modificar especialidad (Admin)' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateEspecialidadDto,
  ) {
    return this.especialidadesService.update(id, dto);
  }

  @Delete(':id')
  @Roles(TipoUsuario.ADMINISTRADOR)
  @ApiOperation({
    summary:
      'Eliminar especialidad (Admin). 409 si la usa algún profesional o terapia',
  })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.especialidadesService.remove(id);
  }
}

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
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { CallerInfo } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { CreateTerapiaDto } from './dto/create-terapia.dto';
import { UpdateTerapiaDto } from './dto/update-terapia.dto';
import { TerapiasService } from './terapias.service';

@ApiTags('Terapias')
@ApiBearerAuth()
@Controller('terapias')
export class TerapiasController {
  constructor(private readonly terapiasService: TerapiasService) {}

  @Post()
  @Roles(TipoUsuario.ADMINISTRADOR, TipoUsuario.PROFESIONAL)
  @ApiOperation({
    summary:
      'Crear terapia en el catálogo (Admin/Profesional). El tipo es único: 409 si ya existe. El Profesional solo de su especialidad (403)',
  })
  create(@Body() dto: CreateTerapiaDto, @CurrentUser() caller: CallerInfo) {
    return this.terapiasService.create(dto, caller);
  }

  @Get()
  @Roles(
    TipoUsuario.ADMINISTRADOR,
    TipoUsuario.PROFESIONAL,
    TipoUsuario.TUTOR,
    TipoUsuario.PCD,
  )
  @ApiOperation({ summary: 'Listar terapias (todos los roles)' })
  @ApiQuery({ name: 'tipo', required: false })
  findAll(@Query('tipo') tipo?: string) {
    return this.terapiasService.findAll(tipo);
  }

  @Get(':id')
  @Roles(
    TipoUsuario.ADMINISTRADOR,
    TipoUsuario.PROFESIONAL,
    TipoUsuario.TUTOR,
    TipoUsuario.PCD,
  )
  @ApiOperation({ summary: 'Ver terapia por ID (todos los roles)' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.terapiasService.findOne(id);
  }

  @Put(':id')
  @Roles(TipoUsuario.ADMINISTRADOR, TipoUsuario.PROFESIONAL)
  @ApiOperation({ summary: 'Modificar terapia (Admin/Profesional)' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTerapiaDto,
    @CurrentUser() caller: CallerInfo,
  ) {
    return this.terapiasService.update(id, dto, caller);
  }

  @Delete(':id')
  @Roles(TipoUsuario.ADMINISTRADOR, TipoUsuario.PROFESIONAL)
  @ApiOperation({
    summary:
      'Eliminar terapia del catálogo (Admin/Profesional). 409 si está asignada a alguna actividad',
  })
  remove(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() caller: CallerInfo,
  ) {
    return this.terapiasService.remove(id, caller);
  }
}

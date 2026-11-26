import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseEnumPipe,
  ParseIntPipe,
  Patch,
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
import { EstadoActividad } from '../common/enums/estado-actividad.enum';
import { OrdenActividad } from '../common/enums/orden-actividad.enum';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { CallerInfo } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { ActividadesService } from './actividades.service';
import { CreateActividadDto } from './dto/create-actividad.dto';
import {
  UpdateActividadDto,
  UpdateEstadoActividadDto,
} from './dto/update-actividad.dto';
import { CancelarInstanciaDto } from './dto/cancelar-instancia.dto';

@ApiTags('Actividades')
@ApiBearerAuth()
@Controller('actividades')
export class ActividadesController {
  constructor(private readonly actividadesService: ActividadesService) {}

  @Post()
  @Roles(TipoUsuario.PROFESIONAL, TipoUsuario.TUTOR)
  @ApiOperation({
    summary: 'Crear actividad (Profesional/Tutor con vínculo activo)',
  })
  create(@Body() dto: CreateActividadDto, @CurrentUser() caller: CallerInfo) {
    return this.actividadesService.create(dto, caller);
  }

  @Get()
  @Roles(
    TipoUsuario.ADMINISTRADOR,
    TipoUsuario.PROFESIONAL,
    TipoUsuario.TUTOR,
    TipoUsuario.PCD,
  )
  @ApiOperation({ summary: 'Listar actividades (filtrado automático por rol)' })
  @ApiQuery({ name: 'pcdId', required: false, type: Number })
  @ApiQuery({ name: 'estado', required: false, enum: EstadoActividad })
  @ApiQuery({
    name: 'orden',
    required: false,
    enum: OrdenActividad,
    description:
      '`creacion` (por defecto): las más nuevas primero. `horario`: por horario de inicio (las sin horario al final) y, a igual horario, por fecha de inicio.',
  })
  findAll(
    @CurrentUser() caller: CallerInfo,
    @Query('pcdId', new ParseIntPipe({ optional: true })) pcdId?: number,
    @Query('estado', new ParseEnumPipe(EstadoActividad, { optional: true }))
    estado?: EstadoActividad,
    @Query('orden', new ParseEnumPipe(OrdenActividad, { optional: true }))
    orden?: OrdenActividad,
  ) {
    return this.actividadesService.findAll(caller, pcdId, estado, orden);
  }

  @Get(':id')
  @Roles(
    TipoUsuario.ADMINISTRADOR,
    TipoUsuario.PROFESIONAL,
    TipoUsuario.TUTOR,
    TipoUsuario.PCD,
  )
  @ApiOperation({ summary: 'Ver actividad por ID' })
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() caller: CallerInfo,
  ) {
    return this.actividadesService.findOne(id, caller);
  }

  @Put(':id')
  @Roles(TipoUsuario.PROFESIONAL, TipoUsuario.TUTOR)
  @ApiOperation({
    summary: 'Modificar actividad (solo el creador)',
  })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateActividadDto,
    @CurrentUser() caller: CallerInfo,
  ) {
    return this.actividadesService.update(id, dto, caller);
  }

  @Patch(':id/estado')
  @Roles(TipoUsuario.PROFESIONAL, TipoUsuario.TUTOR)
  @ApiOperation({
    summary: 'Cambiar estado de la actividad (solo el creador)',
  })
  updateEstado(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateEstadoActividadDto,
    @CurrentUser() caller: CallerInfo,
  ) {
    return this.actividadesService.updateEstado(id, dto, caller);
  }

  @Delete(':id')
  @Roles(TipoUsuario.PROFESIONAL, TipoUsuario.TUTOR)
  @ApiOperation({
    summary: 'Eliminar actividad (solo el creador)',
  })
  remove(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() caller: CallerInfo,
  ) {
    return this.actividadesService.remove(id, caller);
  }

  @Get(':id/instancias')
  @Roles(
    TipoUsuario.ADMINISTRADOR,
    TipoUsuario.PROFESIONAL,
    TipoUsuario.TUTOR,
    TipoUsuario.PCD,
  )
  @ApiOperation({ summary: 'Listar instancias de una actividad' })
  findInstancias(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() caller: CallerInfo,
  ) {
    return this.actividadesService.findInstancias(id, caller);
  }

  @Patch(':actividadId/instancias/:instanciaId/confirmar')
  @Roles(TipoUsuario.PROFESIONAL, TipoUsuario.TUTOR)
  @ApiOperation({
    summary: 'Confirmar instancia como realizada (Profesional/Tutor)',
  })
  confirmarInstancia(
    @Param('actividadId', ParseIntPipe) actividadId: number,
    @Param('instanciaId', ParseIntPipe) instanciaId: number,
    @CurrentUser() caller: CallerInfo,
  ) {
    return this.actividadesService.confirmarInstancia(
      actividadId,
      instanciaId,
      caller,
    );
  }

  @Patch(':actividadId/instancias/:instanciaId/cancelar')
  @Roles(TipoUsuario.PROFESIONAL, TipoUsuario.TUTOR)
  @ApiOperation({
    summary:
      'Cancelar una instancia pendiente (nuevo en BackendV3, solo el creador)',
  })
  cancelarInstancia(
    @Param('actividadId', ParseIntPipe) actividadId: number,
    @Param('instanciaId', ParseIntPipe) instanciaId: number,
    @Body() dto: CancelarInstanciaDto,
    @CurrentUser() caller: CallerInfo,
  ) {
    return this.actividadesService.cancelarInstancia(
      actividadId,
      instanciaId,
      dto,
      caller,
    );
  }
}

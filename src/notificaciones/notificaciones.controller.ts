import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
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
import { CreateNotificacionDto } from './dto/create-notificacion.dto';
import { RegisterPushTokenDto } from './dto/register-push-token.dto';
import { NotificacionesService } from './notificaciones.service';
import { RecordatoriosService } from './recordatorios.service';
import type { FiltroNotificacion } from './notificaciones.service';

@ApiTags('Notificaciones')
@ApiBearerAuth()
@Roles(
  TipoUsuario.ADMINISTRADOR,
  TipoUsuario.PROFESIONAL,
  TipoUsuario.TUTOR,
  TipoUsuario.PCD,
)
@Controller('notificaciones')
export class NotificacionesController {
  constructor(
    private readonly notificacionesService: NotificacionesService,
    private readonly recordatoriosService: RecordatoriosService,
  ) {}

  @Post('recordatorios')
  @Roles(TipoUsuario.ADMINISTRADOR)
  @ApiOperation({
    summary:
      'Disparar manualmente la generación de recordatorios automáticos (Admin)',
  })
  async generarRecordatorios() {
    const creadas = await this.recordatoriosService.ejecutar();
    return { creadas };
  }

  @Post('alertas-vencidas')
  @Roles(TipoUsuario.ADMINISTRADOR)
  @ApiOperation({
    summary:
      'Disparar manualmente la generación de alertas de actividad no realizada (Admin)',
  })
  async generarAlertasVencidas() {
    const creadas = await this.recordatoriosService.ejecutarVencidas();
    return { creadas };
  }

  @Post()
  @Roles(TipoUsuario.ADMINISTRADOR)
  @ApiOperation({ summary: 'Crear una notificación para un usuario (Admin)' })
  create(@Body() dto: CreateNotificacionDto) {
    return this.notificacionesService.create(dto);
  }

  @Get()
  @ApiOperation({
    summary: 'Listar notificaciones propias, paginado (con filtro opcional)',
  })
  @ApiQuery({
    name: 'estado',
    required: false,
    enum: ['TODAS', 'NO_LEIDA', 'LEIDA'],
  })
  @ApiQuery({ name: 'skip', required: false, type: Number })
  @ApiQuery({
    name: 'take',
    required: false,
    type: Number,
    description: 'Máximo 50',
  })
  findAll(
    @CurrentUser() caller: CallerInfo,
    @Query('estado') estado?: FiltroNotificacion,
    @Query('skip', new ParseIntPipe({ optional: true })) skip?: number,
    @Query('take', new ParseIntPipe({ optional: true })) take?: number,
  ) {
    return this.notificacionesService.findAll(caller, estado, skip, take);
  }

  @Get('no-leidas')
  @ApiOperation({ summary: 'Cantidad de notificaciones sin leer' })
  countNoLeidas(@CurrentUser() caller: CallerInfo) {
    return this.notificacionesService.countNoLeidas(caller);
  }

  @Post('push-token')
  @ApiOperation({
    summary:
      'Registrar/actualizar el token de push (Expo) del dispositivo propio',
  })
  registrarPushToken(
    @Body() dto: RegisterPushTokenDto,
    @CurrentUser() caller: CallerInfo,
  ) {
    return this.notificacionesService.registrarPushToken(caller.id, dto.token);
  }

  @Delete('push-token')
  @ApiOperation({
    summary:
      'Eliminar el token de push propio (al cerrar sesión, para no seguir notificando este dispositivo)',
  })
  eliminarPushToken(@CurrentUser() caller: CallerInfo) {
    return this.notificacionesService.eliminarPushToken(caller.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Ver una notificación propia por ID' })
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() caller: CallerInfo,
  ) {
    return this.notificacionesService.findOne(id, caller);
  }

  @Patch('leer-todas')
  @ApiOperation({
    summary: 'Marcar todas las notificaciones propias como leídas',
  })
  marcarTodasLeidas(@CurrentUser() caller: CallerInfo) {
    return this.notificacionesService.marcarTodasLeidas(caller);
  }

  @Patch(':id/leer')
  @ApiOperation({ summary: 'Marcar una notificación como leída' })
  marcarLeida(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() caller: CallerInfo,
  ) {
    return this.notificacionesService.marcarLeida(id, caller);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar una notificación propia' })
  remove(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() caller: CallerInfo,
  ) {
    return this.notificacionesService.remove(id, caller);
  }
}

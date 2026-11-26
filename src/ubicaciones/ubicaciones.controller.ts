import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { TipoUsuario } from '../common/enums/tipo-usuario.enum';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { CallerInfo } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { CreateUbicacionDto } from './dto/create-ubicacion.dto';
import { HistorialQueryDto } from './dto/historial-query.dto';
import { ShareUbicacionDto } from './dto/share-ubicacion.dto';
import { UbicacionesService } from './ubicaciones.service';

@ApiTags('Ubicaciones')
@ApiBearerAuth()
@Controller('ubicaciones')
export class UbicacionesController {
  constructor(private readonly ubicacionesService: UbicacionesService) {}

  @Post()
  @Roles(TipoUsuario.PCD)
  @ApiOperation({ summary: 'Registrar la ubicación actual (PCD)' })
  registrar(
    @Body() dto: CreateUbicacionDto,
    @CurrentUser() caller: CallerInfo,
  ) {
    return this.ubicacionesService.registrar(caller.id, dto);
  }

  @Get('compartidos')
  @Roles(TipoUsuario.PCD)
  @ApiOperation({
    summary: 'Listar usuarios con acceso compartido a mi ubicación (PCD)',
  })
  findCompartidos(@CurrentUser() caller: CallerInfo) {
    return this.ubicacionesService.findCompartidos(caller.id);
  }

  @Post('compartidos')
  @Roles(TipoUsuario.PCD)
  @ApiOperation({ summary: 'Compartir mi ubicación con un usuario (PCD)' })
  compartir(@Body() dto: ShareUbicacionDto, @CurrentUser() caller: CallerInfo) {
    return this.ubicacionesService.compartir(caller.id, dto);
  }

  @Delete('compartidos/:usuarioId')
  @Roles(TipoUsuario.PCD)
  @ApiOperation({ summary: 'Revocar el acceso compartido de un usuario (PCD)' })
  revocar(
    @Param('usuarioId', ParseIntPipe) usuarioId: number,
    @CurrentUser() caller: CallerInfo,
  ) {
    return this.ubicacionesService.revocar(caller.id, usuarioId);
  }

  @Get('pcd/:pcdId/ultima')
  @Roles(TipoUsuario.PROFESIONAL, TipoUsuario.TUTOR, TipoUsuario.PCD)
  @ApiOperation({ summary: 'Ver la última ubicación registrada de un PCD' })
  findUltima(
    @Param('pcdId', ParseIntPipe) pcdId: number,
    @CurrentUser() caller: CallerInfo,
  ) {
    return this.ubicacionesService.findUltima(pcdId, caller);
  }

  @Get('pcd/:pcdId/historial')
  @Roles(TipoUsuario.PROFESIONAL, TipoUsuario.TUTOR, TipoUsuario.PCD)
  @ApiOperation({
    summary: 'Historial de ubicaciones de un PCD (autorizado)',
    description:
      'De la más nueva a la más vieja. Acotar con `desde` y `hasta`; paginar con `limite` y `antes` (id de la última recibida).',
  })
  historial(
    @Param('pcdId', ParseIntPipe) pcdId: number,
    @Query() query: HistorialQueryDto,
    @CurrentUser() caller: CallerInfo,
  ) {
    return this.ubicacionesService.historial(pcdId, caller, query);
  }
}

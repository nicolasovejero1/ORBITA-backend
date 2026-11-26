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
import { EstadoVinculo } from '../common/enums/estado-vinculo.enum';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { CallerInfo } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { CreateVinculoDto } from './dto/create-vinculo.dto';
import { UpdateStatusVinculoDto } from './dto/update-status-vinculo.dto';
import { VinculosService } from './vinculos.service';

@ApiTags('Vínculos Profesional-PCD')
@ApiBearerAuth()
@Roles(TipoUsuario.ADMINISTRADOR)
@Controller('vinculos')
export class VinculosController {
  constructor(private readonly vinculosService: VinculosService) {}

  @Post()
  @Roles(TipoUsuario.ADMINISTRADOR, TipoUsuario.PROFESIONAL)
  @ApiOperation({
    summary:
      'Crear vínculo profesional-PCD (Admin; el médico de cabecera del PCD solo puede asignar especialistas)',
  })
  create(@Body() dto: CreateVinculoDto, @CurrentUser() caller: CallerInfo) {
    return this.vinculosService.createVinculo(dto, caller);
  }

  @Get()
  @Roles(TipoUsuario.ADMINISTRADOR, TipoUsuario.PROFESIONAL, TipoUsuario.PCD)
  @ApiOperation({
    summary:
      'Listar vínculos profesional-PCD (Admin ve todos; Profesional y PCD solo los suyos; el cabecera ve el equipo completo de su PCD con ?pcdId=)',
  })
  @ApiQuery({ name: 'pcdId', required: false, type: Number })
  @ApiQuery({ name: 'profesionalId', required: false, type: Number })
  @ApiQuery({ name: 'estado', required: false, enum: EstadoVinculo })
  findAll(
    @CurrentUser() caller: CallerInfo,
    @Query('pcdId', new ParseIntPipe({ optional: true })) pcdId?: number,
    @Query('profesionalId', new ParseIntPipe({ optional: true }))
    profesionalId?: number,
    @Query('estado') estado?: EstadoVinculo,
  ) {
    if (caller.tipoUsuario === TipoUsuario.PCD) {
      return this.vinculosService.findAllVinculos(
        caller.id,
        profesionalId,
        estado,
      );
    }
    return this.vinculosService.findAllParaUsuario(
      caller,
      pcdId,
      profesionalId,
      estado,
    );
  }

  @Get(':pcdId/:profesionalId')
  @ApiOperation({ summary: 'Ver vínculo profesional-PCD (Admin)' })
  findOne(
    @Param('pcdId', ParseIntPipe) pcdId: number,
    @Param('profesionalId', ParseIntPipe) profesionalId: number,
  ) {
    return this.vinculosService.findOneVinculo(pcdId, profesionalId);
  }

  @Patch(':pcdId/:profesionalId/status')
  @Roles(TipoUsuario.ADMINISTRADOR, TipoUsuario.PROFESIONAL)
  @ApiOperation({
    summary:
      'Cambiar estado del vínculo profesional-PCD (Admin; el cabecera, solo el de sus especialistas)',
  })
  updateStatus(
    @Param('pcdId', ParseIntPipe) pcdId: number,
    @Param('profesionalId', ParseIntPipe) profesionalId: number,
    @Body() dto: UpdateStatusVinculoDto,
    @CurrentUser() caller: CallerInfo,
  ) {
    return this.vinculosService.updateStatusVinculo(
      pcdId,
      profesionalId,
      dto,
      caller,
    );
  }

  @Delete(':pcdId/:profesionalId')
  @Roles(TipoUsuario.ADMINISTRADOR, TipoUsuario.PROFESIONAL)
  @ApiOperation({
    summary:
      'Eliminar vínculo profesional-PCD (Admin; el cabecera, solo el de sus especialistas)',
  })
  remove(
    @Param('pcdId', ParseIntPipe) pcdId: number,
    @Param('profesionalId', ParseIntPipe) profesionalId: number,
    @CurrentUser() caller: CallerInfo,
  ) {
    return this.vinculosService.removeVinculo(pcdId, profesionalId, caller);
  }
}

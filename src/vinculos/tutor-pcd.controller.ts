import {
  BadRequestException,
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
import { CreateTutorPcdDto } from './dto/create-tutor-pcd.dto';
import { UpdateParentescoDto } from './dto/update-parentesco.dto';
import { UpdateStatusVinculoDto } from './dto/update-status-vinculo.dto';
import { VinculosService } from './vinculos.service';

@ApiTags('Vínculos Tutor-PCD')
@ApiBearerAuth()
@Roles(TipoUsuario.ADMINISTRADOR)
@Controller('tutor-pcd')
export class TutorPcdController {
  constructor(private readonly vinculosService: VinculosService) {}

  @Post()
  @ApiOperation({ summary: 'Crear vínculo tutor-PCD (Admin)' })
  create(@Body() dto: CreateTutorPcdDto) {
    return this.vinculosService.createTutorPcd(dto);
  }

  @Get()
  @Roles(
    TipoUsuario.ADMINISTRADOR,
    TipoUsuario.TUTOR,
    TipoUsuario.PROFESIONAL,
    TipoUsuario.PCD,
  )
  @ApiOperation({
    summary:
      'Listar vínculos tutor-PCD (Admin: todos; Tutor y PCD: solo los suyos; Profesional: tutores de un PCD vinculado)',
  })
  @ApiQuery({ name: 'tutorId', required: false, type: Number })
  @ApiQuery({ name: 'pcdId', required: false, type: Number })
  @ApiQuery({ name: 'estado', required: false, enum: EstadoVinculo })
  async findAll(
    @CurrentUser() caller: CallerInfo,
    @Query('tutorId', new ParseIntPipe({ optional: true })) tutorId?: number,
    @Query('pcdId', new ParseIntPipe({ optional: true })) pcdId?: number,
    @Query('estado') estado?: EstadoVinculo,
  ) {
    if (caller.tipoUsuario === TipoUsuario.PCD) {
      return this.vinculosService.findAllTutorPcd(tutorId, caller.id, estado);
    }
    if (caller.tipoUsuario === TipoUsuario.PROFESIONAL) {
      if (!pcdId) {
        throw new BadRequestException(
          'El profesional debe especificar un pcdId para consultar los tutores',
        );
      }
      await this.vinculosService.validarVinculoProfesionalPcd(caller.id, pcdId);
      return this.vinculosService.findAllTutorPcd(undefined, pcdId, estado);
    }

    const callerTutorId = caller.esAdministrador ? undefined : caller.id;
    return this.vinculosService.findAllTutorPcd(
      tutorId ?? callerTutorId,
      pcdId,
      estado,
    );
  }

  @Patch(':tutorId/:pcdId/status')
  @ApiOperation({ summary: 'Cambiar estado del vínculo tutor-PCD (Admin)' })
  updateStatus(
    @Param('tutorId', ParseIntPipe) tutorId: number,
    @Param('pcdId', ParseIntPipe) pcdId: number,
    @Body() dto: UpdateStatusVinculoDto,
  ) {
    return this.vinculosService.updateStatusTutorPcd(tutorId, pcdId, dto);
  }

  @Patch(':tutorId/:pcdId/parentesco')
  @ApiOperation({
    summary: 'Corregir el parentesco del vínculo tutor-PCD (Admin)',
  })
  updateParentesco(
    @Param('tutorId', ParseIntPipe) tutorId: number,
    @Param('pcdId', ParseIntPipe) pcdId: number,
    @Body() dto: UpdateParentescoDto,
  ) {
    return this.vinculosService.updateParentescoTutorPcd(tutorId, pcdId, dto);
  }

  @Delete(':tutorId/:pcdId')
  @ApiOperation({ summary: 'Eliminar vínculo tutor-PCD (Admin)' })
  remove(
    @Param('tutorId', ParseIntPipe) tutorId: number,
    @Param('pcdId', ParseIntPipe) pcdId: number,
  ) {
    return this.vinculosService.removeTutorPcd(tutorId, pcdId);
  }
}

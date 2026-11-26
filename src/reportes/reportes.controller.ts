import {
  Body,
  Controller,
  Delete,
  Get,
  HttpStatus,
  NotFoundException,
  Param,
  ParseFilePipeBuilder,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Res,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { createReadStream, existsSync } from 'fs';
import { extname } from 'path';
import type { Response } from 'express';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { TipoUsuario } from '../common/enums/tipo-usuario.enum';
import { EstadoReporte } from '../common/enums/estado-reporte.enum';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { CallerInfo } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { ChangeEstadoReporteDto } from './dto/change-estado-reporte.dto';
import { CreateAdjuntoDto } from './dto/create-adjunto.dto';
import { CreateColaboradorDto } from './dto/create-colaborador.dto';
import { CreateReporteDto } from './dto/create-reporte.dto';
import { UpdateReporteDto } from './dto/update-reporte.dto';
import { ReportesService } from './reportes.service';

/**
 * Límite y tipos permitidos para adjuntos subidos como archivo real. Se lee
 * de `process.env` directo (no `ConfigService`) porque `FileInterceptor` se
 * configura como argumento de decorador, evaluado al cargar el módulo —
 * mismo criterio que `PORT` en main.ts, antes de que Nest bootstree.
 */
const MAX_ADJUNTO_MB = Number(process.env.UPLOAD_MAX_FILE_SIZE_MB ?? 5);
const MAX_ADJUNTO_BYTES = MAX_ADJUNTO_MB * 1024 * 1024;
const TIPOS_ADJUNTO_PERMITIDOS =
  /^(image\/(jpeg|png|webp|gif)|application\/pdf)$/;

const CONTENT_TYPE_POR_EXTENSION: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
};

@ApiTags('Reportes')
@ApiBearerAuth()
@Controller('reportes')
export class ReportesController {
  constructor(private readonly reportesService: ReportesService) {}

  @Post()
  @Roles(TipoUsuario.PROFESIONAL)
  @ApiOperation({ summary: 'Crear reporte de progreso (Profesional)' })
  create(@Body() dto: CreateReporteDto, @CurrentUser() caller: CallerInfo) {
    return this.reportesService.create(dto, caller);
  }

  @Get()
  @Roles(
    TipoUsuario.ADMINISTRADOR,
    TipoUsuario.PROFESIONAL,
    TipoUsuario.TUTOR,
    TipoUsuario.PCD,
  )
  @ApiOperation({ summary: 'Listar reportes (filtrado por rol)' })
  @ApiQuery({ name: 'actividadId', required: false, type: Number })
  @ApiQuery({ name: 'pcdId', required: false, type: Number })
  @ApiQuery({ name: 'estado', required: false, enum: EstadoReporte })
  findAll(
    @CurrentUser() caller: CallerInfo,
    @Query('actividadId', new ParseIntPipe({ optional: true }))
    actividadId?: number,
    @Query('pcdId', new ParseIntPipe({ optional: true })) pcdId?: number,
    @Query('estado') estado?: EstadoReporte,
  ) {
    return this.reportesService.findAll(caller, actividadId, pcdId, estado);
  }

  @Get('colaboraciones')
  @Roles(TipoUsuario.PROFESIONAL)
  @ApiOperation({
    summary: 'Listar reportes donde el profesional es colaborador',
  })
  findColaboraciones(@CurrentUser() caller: CallerInfo) {
    return this.reportesService.findColaboraciones(caller);
  }

  @Get(':id')
  @Roles(
    TipoUsuario.ADMINISTRADOR,
    TipoUsuario.PROFESIONAL,
    TipoUsuario.TUTOR,
    TipoUsuario.PCD,
  )
  @ApiOperation({ summary: 'Ver reporte por ID' })
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() caller: CallerInfo,
  ) {
    return this.reportesService.findOne(id, caller);
  }

  @Patch(':id')
  @Roles(TipoUsuario.PROFESIONAL)
  @ApiOperation({
    summary:
      'Modificar contenido del reporte (solo el creador, no si está FINALIZADO)',
  })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateReporteDto,
    @CurrentUser() caller: CallerInfo,
  ) {
    return this.reportesService.update(id, dto, caller);
  }

  @Patch(':id/estado')
  @Roles(TipoUsuario.PROFESIONAL)
  @ApiOperation({
    summary:
      'Finalizar el reporte (EN_CURSO → FINALIZADO). Al finalizar se puede activar la visibilidad para tutores y el PCD. (solo el creador)',
  })
  changeEstado(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ChangeEstadoReporteDto,
    @CurrentUser() caller: CallerInfo,
  ) {
    return this.reportesService.changeEstado(id, dto, caller);
  }

  @Delete(':id')
  @Roles(TipoUsuario.PROFESIONAL)
  @ApiOperation({
    summary: 'Eliminar reporte (solo el creador, no si está FINALIZADO)',
  })
  remove(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() caller: CallerInfo,
  ) {
    return this.reportesService.remove(id, caller);
  }

  @Get('adjuntos/archivo')
  @Public()
  @ApiOperation({
    summary: 'Descargar un archivo adjunto con un enlace firmado',
    description:
      'Público: la autorización está en el `token` firmado que entrega `GET /reportes/:id/adjuntos/:adjuntoId/url` (dura 60 segundos).',
  })
  @ApiQuery({ name: 'token', required: true, type: String })
  async archivoAdjunto(
    @Query('token') token: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { ruta, nombre } = await this.reportesService.archivoAdjunto(token);
    if (!existsSync(ruta)) {
      throw new NotFoundException('Archivo no encontrado');
    }
    res.set({
      'Content-Type':
        CONTENT_TYPE_POR_EXTENSION[extname(nombre).toLowerCase()] ??
        'application/octet-stream',
      'Content-Disposition': `inline; filename="${nombre}"`,
    });
    return new StreamableFile(createReadStream(ruta));
  }

  @Get(':id/adjuntos/:adjuntoId/url')
  @Roles(
    TipoUsuario.ADMINISTRADOR,
    TipoUsuario.PROFESIONAL,
    TipoUsuario.TUTOR,
    TipoUsuario.PCD,
  )
  @ApiOperation({
    summary: 'Obtener un enlace firmado (60 s) para abrir un adjunto',
    description:
      'Solo lo recibe quien puede ver el reporte. Para adjuntos de tipo enlace externo devuelve la dirección tal cual.',
  })
  urlAdjunto(
    @Param('id', ParseIntPipe) id: number,
    @Param('adjuntoId', ParseIntPipe) adjuntoId: number,
    @CurrentUser() caller: CallerInfo,
  ) {
    return this.reportesService.urlAdjunto(id, adjuntoId, caller);
  }

  @Post(':id/adjuntos')
  @Roles(TipoUsuario.PROFESIONAL)
  @ApiOperation({
    summary: 'Registrar un adjunto por ruta/URL ya conocida (creador)',
    description:
      'Primera de las dos vías para agregar adjuntos: acá NO se sube ningún archivo, solo se registra una referencia (`filePath`, típicamente una URL ya alojada en otro lado). Para subir el archivo en sí, usar `POST /reportes/:id/adjuntos/upload`.',
  })
  addAdjunto(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateAdjuntoDto,
    @CurrentUser() caller: CallerInfo,
  ) {
    return this.reportesService.addAdjunto(id, dto, caller);
  }

  @Delete(':id/adjuntos/:adjuntoId')
  @Roles(TipoUsuario.PROFESIONAL)
  @ApiOperation({ summary: 'Eliminar adjunto del reporte (creador)' })
  removeAdjunto(
    @Param('id', ParseIntPipe) id: number,
    @Param('adjuntoId', ParseIntPipe) adjuntoId: number,
    @CurrentUser() caller: CallerInfo,
  ) {
    return this.reportesService.removeAdjunto(id, adjuntoId, caller);
  }

  @Post(':id/adjuntos/upload')
  @Roles(TipoUsuario.PROFESIONAL)
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary:
      'Subir un archivo real (imagen o PDF) como adjunto del reporte (creador)',
    description: `Segunda vía para agregar adjuntos: sube el binario en sí (campo \`file\` de un multipart/form-data), a diferencia de \`POST /reportes/:id/adjuntos\` que solo registra una referencia externa. Valida tipo (imagen jpeg/png/webp/gif o PDF, por contenido real del archivo, no solo por el mimetype declarado) y tamaño máximo (${MAX_ADJUNTO_MB} MB, configurable con \`UPLOAD_MAX_FILE_SIZE_MB\`).`,
  })
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MAX_ADJUNTO_BYTES } }),
  )
  uploadAdjunto(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile(
      new ParseFilePipeBuilder()
        .addFileTypeValidator({ fileType: TIPOS_ADJUNTO_PERMITIDOS })
        .addMaxSizeValidator({ maxSize: MAX_ADJUNTO_BYTES })
        .build({ errorHttpStatusCode: HttpStatus.BAD_REQUEST }),
    )
    file: Express.Multer.File,
    @CurrentUser() caller: CallerInfo,
  ) {
    return this.reportesService.agregarArchivoAdjunto(id, file, caller);
  }

  @Post(':id/colaboradores')
  @Roles(TipoUsuario.PROFESIONAL)
  @ApiOperation({ summary: 'Agregar colaborador al reporte (creador)' })
  addColaborador(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateColaboradorDto,
    @CurrentUser() caller: CallerInfo,
  ) {
    return this.reportesService.addColaborador(id, dto, caller);
  }

  @Get(':id/colaboradores')
  @Roles(TipoUsuario.ADMINISTRADOR, TipoUsuario.PROFESIONAL)
  @ApiOperation({
    summary: 'Listar colaboradores del reporte (creador o Admin)',
  })
  findColaboradores(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() caller: CallerInfo,
  ) {
    return this.reportesService.findColaboradores(id, caller);
  }

  @Delete(':id/colaboradores/:profesionalId')
  @Roles(TipoUsuario.PROFESIONAL)
  @ApiOperation({ summary: 'Revocar acceso de colaborador (creador)' })
  removeColaborador(
    @Param('id', ParseIntPipe) id: number,
    @Param('profesionalId', ParseIntPipe) profesionalId: number,
    @CurrentUser() caller: CallerInfo,
  ) {
    return this.reportesService.removeColaborador(id, profesionalId, caller);
  }
}

import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import {
  IsEntityId,
  IsOptionalText,
  IsRequiredName,
} from '../../common/decorators/validation.decorators';
import { EstadoActividad } from '../../common/enums/estado-actividad.enum';
import { FrecuenciaActividad } from '../../common/enums/frecuencia-actividad.enum';
import { AsignarMedicamentoDto } from './create-actividad.dto';

export class UpdateActividadDto {
  @ApiPropertyOptional({ example: 'Nuevo título' })
  @IsOptional()
  @IsRequiredName(2, 100)
  titulo?: string;

  @ApiPropertyOptional({ example: 'Nueva descripción' })
  @IsOptional()
  @IsRequiredName(2)
  descripcion?: string;

  @ApiPropertyOptional({ example: '2025-06-01' })
  @IsOptional()
  @IsDateString()
  fechaInicio?: string;

  @ApiPropertyOptional({ example: '2025-09-01' })
  @IsOptional()
  @IsDateString()
  fechaFin?: string;

  @ApiPropertyOptional({ example: '09:00' })
  @IsOptional()
  @Matches(/^\d{2}:\d{2}$/, {
    message: 'horarioInicio debe tener formato HH:mm',
  })
  horarioInicio?: string;

  @ApiPropertyOptional({ example: '10:00' })
  @IsOptional()
  @Matches(/^\d{2}:\d{2}$/, { message: 'horarioFin debe tener formato HH:mm' })
  horarioFin?: string;

  @ApiPropertyOptional({ example: 'Nuevas observaciones' })
  @IsOptionalText()
  observaciones?: string;

  @ApiPropertyOptional({ enum: FrecuenciaActividad })
  @IsOptional()
  @IsEnum(FrecuenciaActividad)
  frecuencia?: FrecuenciaActividad;

  @ApiPropertyOptional({
    example: 15,
    description:
      'Minutos antes del horario para el recordatorio automático. Omitir para no cambiar, null para desactivar.',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  recordarAntesMinutos?: number;

  @ApiPropertyOptional({ example: ['LUNES', 'MIERCOLES', 'VIERNES'] })
  @ValidateIf(
    (o: UpdateActividadDto) =>
      o.frecuencia === FrecuenciaActividad.DIAS_ESPECIFICOS,
  )
  @IsArray()
  @IsString({ each: true })
  diasSemana?: string[];

  @ApiPropertyOptional({
    example: 2,
    description: 'Solo para actividades de tipo TERAPIA',
  })
  @IsOptional()
  @IsEntityId()
  terapiaId?: number;

  @ApiPropertyOptional({
    type: [AsignarMedicamentoDto],
    description:
      'Solo para actividades de tipo MEDICAMENTO. Reemplaza todos los medicamentos existentes.',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AsignarMedicamentoDto)
  medicamentos?: AsignarMedicamentoDto[];
}

export class UpdateEstadoActividadDto {
  @ApiPropertyOptional({ enum: EstadoActividad })
  @IsEnum(EstadoActividad)
  estado: EstadoActividad;
}

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
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
} from 'class-validator';
import {
  IsEntityId,
  IsOptionalText,
  IsRequiredName,
} from '../../common/decorators/validation.decorators';
import { TipoActividad } from '../../common/enums/tipo-actividad.enum';
import { FrecuenciaActividad } from '../../common/enums/frecuencia-actividad.enum';

export class AsignarMedicamentoDto {
  @ApiProperty({ example: 1 })
  @IsEntityId()
  medicamentoId: number;

  @ApiPropertyOptional({ example: '400mg' })
  @IsOptionalText(100)
  dosis?: string;

  @ApiPropertyOptional({ example: 'Cada 8 horas' })
  @IsOptionalText(100)
  frecuencia?: string;

  @ApiPropertyOptional({ example: '10 días' })
  @IsOptionalText(100)
  duracionTratamiento?: string;

  @ApiPropertyOptional({ example: 'Tomar con alimentos' })
  @IsOptionalText()
  indicacion?: string;

  @ApiPropertyOptional({ example: 'Dr. García' })
  @IsOptionalText(100)
  medicoPrescriptor?: string;
}

export class CreateActividadDto {
  @ApiProperty({ example: 'Ejercicios de rehabilitación' })
  @IsRequiredName(2, 100)
  titulo: string;

  @ApiProperty({ example: 'Serie de ejercicios para mejorar la movilidad' })
  @IsRequiredName(2)
  descripcion: string;

  @ApiProperty({ example: '2025-06-01' })
  @IsDateString()
  fechaInicio: string;

  @ApiProperty({ example: '2025-08-01' })
  @IsDateString()
  fechaFin: string;

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

  @ApiPropertyOptional({ example: 'Observaciones adicionales' })
  @IsOptionalText()
  observaciones?: string;

  @ApiProperty({ enum: TipoActividad })
  @IsEnum(TipoActividad)
  tipoActividad: TipoActividad;

  @ApiProperty({ enum: FrecuenciaActividad })
  @IsEnum(FrecuenciaActividad)
  frecuencia: FrecuenciaActividad;

  @ApiPropertyOptional({
    example: 15,
    description:
      'Minutos antes del horario para enviar un recordatorio automático. Omitir o null para desactivar.',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  recordarAntesMinutos?: number;

  @ApiPropertyOptional({
    example: ['LUNES', 'MIERCOLES', 'VIERNES'],
    description: 'Requerido cuando frecuencia es DIAS_ESPECIFICOS',
  })
  @ValidateIf(
    (o: CreateActividadDto) =>
      o.frecuencia === FrecuenciaActividad.DIAS_ESPECIFICOS,
  )
  @IsArray()
  @IsString({ each: true })
  diasSemana?: string[];

  @ApiProperty({
    example: 1,
    description: 'ID del PCD al que se asigna la actividad',
  })
  @IsEntityId()
  pcdId: number;

  @ApiPropertyOptional({
    type: [AsignarMedicamentoDto],
    description: 'Requerido cuando tipoActividad es MEDICAMENTO',
  })
  @ValidateIf(
    (o: CreateActividadDto) => o.tipoActividad === TipoActividad.MEDICAMENTO,
  )
  @IsArray()
  medicamentos?: AsignarMedicamentoDto[];

  @ApiPropertyOptional({
    example: 1,
    description:
      'ID de la terapia del catálogo. Requerido cuando tipoActividad es TERAPIA',
  })
  @ValidateIf(
    (o: CreateActividadDto) => o.tipoActividad === TipoActividad.TERAPIA,
  )
  @IsEntityId()
  terapiaId?: number;
}

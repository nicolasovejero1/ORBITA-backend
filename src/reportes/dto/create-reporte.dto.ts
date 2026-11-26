import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import {
  IsEntityId,
  IsOptionalText,
  IsRequiredName,
} from '../../common/decorators/validation.decorators';
import { TipoReporte } from '../../common/enums/tipo-reporte.enum';

export class CreateReporteDto {
  @ApiProperty({ example: 'Reporte sesión 1' })
  @IsRequiredName(2, 100)
  titulo: string;

  @ApiPropertyOptional({
    example: 'El paciente mostró mejora en la movilidad.',
  })
  @IsOptionalText()
  descripcionDetallada?: string;

  @ApiProperty({ enum: TipoReporte })
  @IsEnum(TipoReporte)
  tipo: TipoReporte;

  @ApiProperty({
    example: 1,
    description: 'ID de la actividad a la que pertenece el reporte',
  })
  @IsEntityId()
  actividadId: number;

  @ApiPropertyOptional({
    example: 3,
    description:
      'ID de la instancia (sesión específica), solo para tipo DE_ACTIVIDAD. Omitir para reporte general.',
  })
  @IsOptional()
  @IsEntityId()
  instanciaId?: number;
}

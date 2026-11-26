import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional } from 'class-validator';
import {
  IsOptionalText,
  IsRequiredName,
} from '../../common/decorators/validation.decorators';

export class UpdateReporteDto {
  @ApiPropertyOptional({ example: 'Nuevo título' })
  @IsOptional()
  @IsRequiredName(2, 100)
  titulo?: string;

  @ApiPropertyOptional({ example: 'Descripción actualizada.' })
  @IsOptionalText()
  descripcionDetallada?: string;
}

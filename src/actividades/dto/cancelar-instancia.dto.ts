import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptionalText } from '../../common/decorators/validation.decorators';

/** Datos opcionales al cancelar una sesión (instancia) de una actividad. */
export class CancelarInstanciaDto {
  @ApiPropertyOptional({ example: 'El paciente no pudo asistir' })
  @IsOptionalText(255)
  motivo?: string;
}

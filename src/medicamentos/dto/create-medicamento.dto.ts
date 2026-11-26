import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptionalText,
  IsRequiredName,
} from '../../common/decorators/validation.decorators';

export class CreateMedicamentoDto {
  @ApiProperty({ example: 'Ibuprofeno' })
  @IsRequiredName(2, 255)
  nombre: string;

  @ApiPropertyOptional({ example: 'Comprimidos 400mg' })
  @IsOptionalText(255)
  presentacion?: string;

  @ApiPropertyOptional({ example: 'Antiinflamatorio' })
  @IsOptionalText(100)
  tipo?: string;

  @ApiPropertyOptional({ example: 'Antiinflamatorio no esteroideo (AINE)' })
  @IsOptionalText()
  descripcion?: string;
}

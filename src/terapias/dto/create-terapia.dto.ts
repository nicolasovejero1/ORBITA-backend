import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, Min } from 'class-validator';
import { IsRequiredName } from '../../common/decorators/validation.decorators';

export class CreateTerapiaDto {
  @ApiProperty({ example: 'Kinesiología' })
  @IsRequiredName(2, 50)
  tipo: string;

  @ApiProperty({ example: 'Rehabilitación motriz mediante ejercicios guiados' })
  @IsRequiredName(2, 255)
  descripcion: string;

  @ApiPropertyOptional({
    example: 1,
    description:
      'Id de la especialidad (GET /especialidades). Un Profesional que no es Administrador solo puede usar la suya; si no la manda, se usa la suya',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  especialidadId?: number;
}

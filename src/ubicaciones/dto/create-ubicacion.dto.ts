import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, Max, Min } from 'class-validator';

export class CreateUbicacionDto {
  @ApiProperty({ example: -34.603722, description: 'Latitud (-90 a 90)' })
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitud: number;

  @ApiProperty({ example: -58.381592, description: 'Longitud (-180 a 180)' })
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitud: number;

  @ApiPropertyOptional({
    example: 12.5,
    description: 'Precisión del GPS en metros',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  precision?: number;
}

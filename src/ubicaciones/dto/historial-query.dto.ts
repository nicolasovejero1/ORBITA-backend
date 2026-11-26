import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDateString, IsInt, IsOptional, Max, Min } from 'class-validator';

export const HISTORIAL_LIMITE_DEFECTO = 100;
export const HISTORIAL_LIMITE_MAXIMO = 500;

export class HistorialQueryDto {
  @ApiPropertyOptional({
    example: '2026-11-02T00:00:00-03:00',
    description: 'Desde esta fecha y hora (inclusive)',
  })
  @IsOptional()
  @IsDateString()
  desde?: string;

  @ApiPropertyOptional({
    example: '2026-11-02T23:59:59-03:00',
    description: 'Hasta esta fecha y hora (inclusive)',
  })
  @IsOptional()
  @IsDateString()
  hasta?: string;

  @ApiPropertyOptional({
    example: 100,
    description: `Cantidad máxima de ubicaciones (por defecto ${HISTORIAL_LIMITE_DEFECTO}, máximo ${HISTORIAL_LIMITE_MAXIMO})`,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(HISTORIAL_LIMITE_MAXIMO)
  limite?: number;

  @ApiPropertyOptional({
    example: 4521,
    description:
      'Para pedir la página siguiente: el `id` de la última ubicación recibida (se devuelven las anteriores)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  antes?: number;
}

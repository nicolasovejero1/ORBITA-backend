import { applyDecorators } from '@nestjs/common';
import {
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

/**
 * Valida un id de entidad relacionada (entero positivo).
 * Equivale a @IsInt() @IsPositive().
 */
export function IsEntityId() {
  return applyDecorators(IsInt(), IsPositive());
}

/**
 * Valida un nombre/título/tipo requerido (string con longitud mínima y,
 * si se indica, máxima: el largo de la columna, para responder 400 en vez
 * del error de MySQL).
 * Equivale a @IsString() @MinLength(min) [@MaxLength(max)].
 */
export function IsRequiredName(min = 2, max?: number) {
  return applyDecorators(
    IsString(),
    MinLength(min),
    ...(max ? [MaxLength(max)] : []),
  );
}

/**
 * Valida un campo de texto opcional (con largo máximo si se indica).
 * Equivale a @IsOptional() @IsString() [@MaxLength(max)].
 */
export function IsOptionalText(max?: number) {
  return applyDecorators(
    IsOptional(),
    IsString(),
    ...(max ? [MaxLength(max)] : []),
  );
}

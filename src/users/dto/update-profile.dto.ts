import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class UpdateProfileDto {
  @ApiPropertyOptional({ example: 'Laura' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  nombre?: string;

  @ApiPropertyOptional({ example: 'Gómez' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  apellido?: string;

  @ApiPropertyOptional({ example: 'laura@gmail.com' })
  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  email?: string;

  @ApiPropertyOptional({ example: '1144556677' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  @Matches(/^[0-9+()\s-]*$/, {
    message:
      'El teléfono solo puede tener números, espacios, +, - y paréntesis',
  })
  telefono?: string;

  @ApiPropertyOptional({ example: 'Av. Siempre Viva 123' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  direccion?: string;
}

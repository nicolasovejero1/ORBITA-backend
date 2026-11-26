import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import {
  IsOptionalText,
  IsRequiredName,
} from '../../common/decorators/validation.decorators';
import { TipoUsuario } from '../../common/enums/tipo-usuario.enum';

export class CreateUserDto {
  @ApiProperty({ example: 'Juan' })
  @IsRequiredName(2, 100)
  nombre: string;

  @ApiProperty({ example: 'Pérez' })
  @IsRequiredName(2, 100)
  apellido: string;

  @ApiProperty({ example: '12345678' })
  @Matches(/^\d{7,8}$/, {
    message: 'El DNI debe tener 7 u 8 dígitos, sin puntos',
  })
  dni: string;

  @ApiProperty({ example: 'juan@email.com' })
  @IsEmail()
  @MaxLength(255)
  email: string;

  @ApiProperty({ example: 'password123', minLength: 6 })
  @IsString()
  @MinLength(6)
  password: string;

  @ApiProperty({ example: '1990-05-15' })
  @IsDateString()
  fechaNacimiento: string;

  @ApiPropertyOptional({ example: '1155667788' })
  @IsOptionalText(20)
  @Matches(/^[0-9+()\s-]*$/, {
    message:
      'El teléfono solo puede tener números, espacios, +, - y paréntesis',
  })
  telefono?: string;

  @ApiPropertyOptional({ example: 'Av. Corrientes 1234' })
  @IsOptionalText(255)
  direccion?: string;

  @ApiProperty({ enum: TipoUsuario })
  @IsEnum(TipoUsuario)
  tipoUsuario: TipoUsuario;

  @ApiPropertyOptional({
    example: false,
    description: 'Solo válido para tipoUsuario PROFESIONAL',
  })
  @ValidateIf((o: CreateUserDto) => o.tipoUsuario === TipoUsuario.PROFESIONAL)
  @IsBoolean()
  @IsOptional()
  esAdministrador?: boolean;

  @ApiPropertyOptional({ example: 'MP-12345' })
  @ValidateIf((o: CreateUserDto) => o.tipoUsuario === TipoUsuario.PROFESIONAL)
  @IsRequiredName(1, 30)
  matricula?: string;

  @ApiPropertyOptional({
    example: 1,
    description:
      'Id de la especialidad (GET /especialidades). Obligatorio para tipoUsuario PROFESIONAL',
  })
  @ValidateIf((o: CreateUserDto) => o.tipoUsuario === TipoUsuario.PROFESIONAL)
  @IsInt()
  @Min(1)
  especialidadId?: number;

  @ApiPropertyOptional({ example: 'Hospital Central' })
  @IsOptionalText(100)
  establecimiento?: string;

  @ApiPropertyOptional({ example: 'Especialista en rehabilitación motriz' })
  @IsOptionalText()
  descripcionFunciones?: string;

  @ApiPropertyOptional({ example: 'Motriz' })
  @IsOptionalText(255)
  tipoDiscapacidad?: string;

  @ApiPropertyOptional({ example: 'Moderado' })
  @IsOptionalText(10)
  grado?: string;

  @ApiPropertyOptional({ example: 'Parálisis cerebral leve' })
  @IsOptionalText()
  diagnostico?: string;
}

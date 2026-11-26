import { ApiPropertyOptional, OmitType, PartialType } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { EstadoUsuario } from '../../common/enums/estado-usuario.enum';
import { CreateUserDto } from './create-user.dto';

export class UpdateUserDto extends PartialType(
  OmitType(CreateUserDto, ['tipoUsuario', 'password'] as const),
) {}

export class UpdateStatusDto {
  @ApiPropertyOptional({ enum: EstadoUsuario })
  @IsOptional()
  @IsEnum(EstadoUsuario)
  estado: EstadoUsuario;
}

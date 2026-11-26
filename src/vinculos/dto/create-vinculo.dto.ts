import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { IsEntityId } from '../../common/decorators/validation.decorators';
import { RolProfesionalVinculo } from '../../common/enums/rol-profesional-vinculo.enum';

export class CreateVinculoDto {
  @ApiProperty({ example: 1 })
  @IsEntityId()
  pcdId: number;

  @ApiProperty({ example: 2 })
  @IsEntityId()
  profesionalId: number;

  @ApiProperty({ enum: RolProfesionalVinculo })
  @IsEnum(RolProfesionalVinculo)
  rolProfesional: RolProfesionalVinculo;
}

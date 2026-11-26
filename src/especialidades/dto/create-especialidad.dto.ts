import { ApiProperty, PartialType } from '@nestjs/swagger';
import { IsRequiredName } from '../../common/decorators/validation.decorators';

export class CreateEspecialidadDto {
  @ApiProperty({ example: 'Kinesiología' })
  @IsRequiredName(2, 100)
  nombre: string;
}

export class UpdateEspecialidadDto extends PartialType(CreateEspecialidadDto) {}

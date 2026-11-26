import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { EstadoVinculo } from '../../common/enums/estado-vinculo.enum';

export class UpdateStatusVinculoDto {
  @ApiProperty({ enum: EstadoVinculo })
  @IsEnum(EstadoVinculo)
  estado: EstadoVinculo;
}

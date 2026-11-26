import { ApiProperty } from '@nestjs/swagger';
import { IsEntityId } from '../../common/decorators/validation.decorators';

export class ShareUbicacionDto {
  @ApiProperty({
    example: 5,
    description:
      'ID del usuario (tutor o profesional) con quien compartir la ubicación',
  })
  @IsEntityId()
  usuarioId: number;
}

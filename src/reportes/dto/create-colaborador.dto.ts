import { ApiProperty } from '@nestjs/swagger';
import { IsEntityId } from '../../common/decorators/validation.decorators';

export class CreateColaboradorDto {
  @ApiProperty({
    example: 2,
    description: 'ID del profesional que tendrá acceso de lectura al reporte',
  })
  @IsEntityId()
  profesionalId: number;
}

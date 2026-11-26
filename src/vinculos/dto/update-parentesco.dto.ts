import { ApiProperty } from '@nestjs/swagger';
import { IsRequiredName } from '../../common/decorators/validation.decorators';

export class UpdateParentescoDto {
  @ApiProperty({ example: 'Madre' })
  @IsRequiredName(2, 30)
  parentesco: string;
}

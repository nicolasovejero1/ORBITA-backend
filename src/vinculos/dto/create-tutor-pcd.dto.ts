import { ApiProperty } from '@nestjs/swagger';
import {
  IsEntityId,
  IsRequiredName,
} from '../../common/decorators/validation.decorators';

export class CreateTutorPcdDto {
  @ApiProperty({ example: 3 })
  @IsEntityId()
  tutorId: number;

  @ApiProperty({ example: 1 })
  @IsEntityId()
  pcdId: number;

  @ApiProperty({
    example: 'Madre',
    description: 'Relación del tutor con este PCD',
  })
  @IsRequiredName(2, 30)
  parentesco: string;
}

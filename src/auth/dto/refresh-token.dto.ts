import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class RefreshTokenDto {
  @ApiProperty({ description: 'Refresh token opaco entregado en el login' })
  @IsString()
  @MinLength(20)
  refreshToken: string;
}

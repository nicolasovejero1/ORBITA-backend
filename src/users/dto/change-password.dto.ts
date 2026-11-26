import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

/** Autogestión: `PATCH /usuarios/me/password`. Exige la contraseña actual. */
export class ChangePasswordDto {
  @ApiProperty({ example: 'password123' })
  @IsString()
  currentPassword: string;

  @ApiProperty({ example: 'nuevaPassword456', minLength: 6 })
  @IsString()
  @MinLength(6)
  newPassword: string;
}

/** Reseteo por Admin: `PATCH /usuarios/:id/password`. No requiere la contraseña anterior. */
export class ResetPasswordDto {
  @ApiProperty({ example: 'nuevaPassword456', minLength: 6 })
  @IsString()
  @MinLength(6)
  newPassword: string;
}

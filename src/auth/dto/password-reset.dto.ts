import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, Length, Matches, MinLength } from 'class-validator';

export class ForgotPasswordDto {
  @ApiProperty({ example: 'juan@pcd.com' })
  @IsEmail()
  email: string;
}

export class VerifyOtpDto {
  @ApiProperty({ example: 'juan@pcd.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: '482913', description: 'Código de 6 dígitos' })
  @IsString()
  @Length(6, 6)
  @Matches(/^\d{6}$/, { message: 'El código tiene 6 dígitos' })
  codigo: string;
}

export class ResetPasswordWithTokenDto {
  @ApiProperty({ description: 'Token devuelto por POST /auth/verify-otp' })
  @IsString()
  resetToken: string;

  @ApiProperty({ example: 'nuevaPassword456', minLength: 6 })
  @IsString()
  @MinLength(6)
  newPassword: string;
}

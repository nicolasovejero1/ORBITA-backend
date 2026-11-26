import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsOptional, IsPositive } from 'class-validator';
import {
  IsEntityId,
  IsRequiredName,
} from '../../common/decorators/validation.decorators';
import { TipoNotificacion } from '../../common/enums/tipo-notificacion.enum';

export class CreateNotificacionDto {
  @ApiProperty({ example: 4, description: 'Usuario destinatario' })
  @IsEntityId()
  usuarioId: number;

  @ApiProperty({
    enum: TipoNotificacion,
    example: TipoNotificacion.ACTIVIDAD,
    description: 'Identifica el tipo de notificación',
  })
  @IsEnum(TipoNotificacion)
  tipo: TipoNotificacion;

  @ApiProperty({ example: 'Tenés una actividad pendiente para hoy' })
  @IsRequiredName(2)
  mensaje: string;

  @ApiPropertyOptional({
    example: 1,
    description: 'Actividad relacionada (opcional)',
  })
  @IsOptional()
  @IsInt()
  @IsPositive()
  actividadId?: number;
}

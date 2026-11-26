import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsOptional } from 'class-validator';
import { EstadoReporte } from '../../common/enums/estado-reporte.enum';

export class ChangeEstadoReporteDto {
  @ApiProperty({
    enum: [EstadoReporte.FINALIZADO],
    description:
      'Único cambio posible: FINALIZADO (el reporte nace EN_CURSO y no se puede reabrir)',
  })
  @IsIn([EstadoReporte.FINALIZADO], {
    message: 'El único cambio de estado posible es FINALIZADO',
  })
  estado: EstadoReporte;

  @ApiPropertyOptional({
    example: true,
    description:
      'Visible para tutores y para el PCD. Se define al finalizar el reporte.',
  })
  @IsOptional()
  @IsBoolean()
  visibilidadTutor?: boolean;
}

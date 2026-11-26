import { ApiProperty } from '@nestjs/swagger';
import { IsUrl, MaxLength } from 'class-validator';

/**
 * Adjunto de tipo enlace externo. Los archivos (imagen o PDF) se suben por
 * `POST /reportes/:id/adjuntos/archivo`; este endpoint solo registra enlaces
 * http(s), así que el tipo siempre es URL.
 */
export class CreateAdjuntoDto {
  @ApiProperty({ example: 'https://ejemplo.com/informe.pdf' })
  @IsUrl(
    { protocols: ['http', 'https'], require_protocol: true },
    { message: 'filePath debe ser un enlace http o https' },
  )
  @MaxLength(500)
  filePath: string;
}

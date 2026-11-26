import { Injectable } from '@nestjs/common';
import { Subject } from 'rxjs';
import { Ubicacion } from './entities/ubicacion.entity';

/**
 * Canal interno entre `UbicacionesService` y `UbicacionesGateway`: el servicio
 * avisa qué pasó y el gateway lo reparte por socket. Así no se dependen entre
 * sí (evita una referencia circular).
 */
@Injectable()
export class UbicacionesEvents {
  /** El PCD registró una ubicación nueva. */
  readonly nueva$ = new Subject<Ubicacion>();
  /** El PCD le sacó el acceso a un usuario. */
  readonly revocada$ = new Subject<{ usuarioId: number; pcdId: number }>();
}

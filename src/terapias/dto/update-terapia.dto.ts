import { PartialType } from '@nestjs/swagger';
import { CreateTerapiaDto } from './create-terapia.dto';

export class UpdateTerapiaDto extends PartialType(CreateTerapiaDto) {}

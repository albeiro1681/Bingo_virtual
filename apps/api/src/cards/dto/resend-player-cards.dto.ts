import {
  ArrayMaxSize,
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Matches,
  Min,
} from 'class-validator';
import { CARD_CATALOG_SIZE } from '../card-generator';

export class ResendPlayerCardsDto {
  @IsUUID('4', { message: 'El identificador del envío no es válido' })
  requestId!: string;

  @IsOptional()
  @IsString()
  @Matches(/^\+[1-9]\d{7,14}$/, {
    message: 'El destinatario debe usar el formato internacional E.164',
  })
  phone?: string;

  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(CARD_CATALOG_SIZE)
  @ArrayUnique()
  @IsInt({ each: true })
  @Min(1, { each: true })
  @Max(CARD_CATALOG_SIZE, { each: true })
  cardNumbers!: number[];
}

import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsInt,
  Max,
  Min,
} from 'class-validator';
import { CARD_CATALOG_SIZE } from '../card-generator';

export class UpdatePlayerCardsDto {
  @IsArray()
  @ArrayMaxSize(CARD_CATALOG_SIZE)
  @ArrayUnique()
  @IsInt({ each: true })
  @Min(1, { each: true })
  @Max(CARD_CATALOG_SIZE, { each: true })
  cardNumbers!: number[];
}

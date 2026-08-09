import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsInt,
  IsString,
  Max,
  Min,
  MinLength,
} from 'class-validator';
import { CARD_CATALOG_SIZE } from '../card-generator';

export class GenerateCardsDto {
  @IsString()
  @MinLength(1)
  userId!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(CARD_CATALOG_SIZE)
  @ArrayUnique()
  @IsInt({ each: true })
  @Min(1, { each: true })
  @Max(CARD_CATALOG_SIZE, { each: true })
  cardNumbers!: number[];
}

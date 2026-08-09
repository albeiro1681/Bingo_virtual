import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsInt,
  Max,
  Min,
  IsBoolean,
  IsOptional,
  IsString,
  Length,
  Matches,
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

  @IsOptional() @IsString() @Length(2, 100) name?: string;
  @IsOptional() @IsString() @Matches(/^\+[1-9]\d{7,14}$/) phone?: string;
  @IsOptional() @IsBoolean() active?: boolean;
  @IsOptional() @IsBoolean() sendWhatsApp?: boolean;
}

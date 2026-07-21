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

export class GenerateCardsDto {
  @IsString()
  @MinLength(1)
  userId!: string;

  @IsString()
  @MinLength(1)
  gameId!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(120)
  @ArrayUnique()
  @IsInt({ each: true })
  @Min(1, { each: true })
  @Max(120, { each: true })
  cardNumbers!: number[];
}

import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
} from 'class-validator';

export enum GameWinMode {
  FULL_CARD = 'FULL_CARD',
  FIGURE = 'FIGURE',
}

export class CreateGameDto {
  @IsString()
  @Length(2, 120)
  name!: string;

  @IsInt()
  @Min(1)
  @Max(Number.MAX_SAFE_INTEGER)
  prizeAmount!: number;

  @IsOptional()
  @IsEnum(GameWinMode)
  winMode: GameWinMode = GameWinMode.FULL_CARD;

  @IsOptional()
  @IsString()
  patternId?: string;
}

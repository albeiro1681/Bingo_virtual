import { IsEnum, IsOptional, IsString, Length } from 'class-validator';

export enum GameWinMode {
  FULL_CARD = 'FULL_CARD',
  FIGURE = 'FIGURE',
}

export class CreateGameDto {
  @IsString()
  @Length(2, 120)
  name!: string;

  @IsOptional()
  @IsEnum(GameWinMode)
  winMode: GameWinMode = GameWinMode.FULL_CARD;

  @IsOptional()
  @IsString()
  patternId?: string;
}

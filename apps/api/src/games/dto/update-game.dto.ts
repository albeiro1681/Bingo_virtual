import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
} from 'class-validator';
import { GameWinMode } from './create-game.dto';

export class UpdateGameDto {
  @IsOptional()
  @IsString()
  @Length(2, 120)
  name?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(Number.MAX_SAFE_INTEGER)
  prizeAmount?: number;

  @IsOptional()
  @IsEnum(GameWinMode)
  winMode?: GameWinMode;

  @IsOptional()
  @IsString()
  patternId?: string;
}

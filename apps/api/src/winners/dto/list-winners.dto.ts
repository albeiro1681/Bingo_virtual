import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export enum WinnerSort {
  DATE_DESC = 'DATE_DESC',
  DATE_ASC = 'DATE_ASC',
  PRIZE_DESC = 'PRIZE_DESC',
  PRIZE_ASC = 'PRIZE_ASC',
}

export class ListWinnersDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  gameId?: string;

  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @IsOptional()
  @IsEnum(WinnerSort)
  sort: WinnerSort = WinnerSort.DATE_DESC;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize = 10;
}

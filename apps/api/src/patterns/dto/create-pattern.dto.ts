import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsString,
  Length,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class PatternCellDto {
  @IsInt()
  @Min(0)
  @Max(4)
  row!: number;

  @IsInt()
  @Min(0)
  @Max(4)
  column!: number;
}

export class CreatePatternDto {
  @IsString()
  @Length(2, 80)
  name!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(25)
  @ValidateNested({ each: true })
  @Type(() => PatternCellDto)
  cells!: PatternCellDto[];
}

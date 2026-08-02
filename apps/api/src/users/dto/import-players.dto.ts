import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class ImportPlayerRowDto {
  @IsInt()
  @Min(2)
  line!: number;

  @IsString()
  @MaxLength(100)
  name!: string;

  @IsString()
  @MaxLength(40)
  phone!: string;

  @IsArray()
  @ArrayMaxSize(130)
  @IsInt({ each: true })
  cardNumbers!: number[];
}

export class ImportPlayersDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => ImportPlayerRowDto)
  rows!: ImportPlayerRowDto[];
}

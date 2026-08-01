import {
  IsBoolean,
  IsOptional,
  IsString,
  Length,
  Matches,
} from 'class-validator';

export class UpdatePlayerDto {
  @IsOptional() @IsString() @Length(2, 100) name?: string;
  @IsOptional() @IsString() @Matches(/^\+[1-9]\d{7,14}$/) phone?: string;
  @IsOptional() @IsBoolean() active?: boolean;
}

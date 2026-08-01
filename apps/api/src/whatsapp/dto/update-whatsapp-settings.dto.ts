import { IsOptional, IsString, Length, Matches } from 'class-validator';

export class UpdateWhatsAppSettingsDto {
  @IsOptional() @IsString() @Length(20, 1000) accessToken?: string;
  @IsOptional() @IsString() @Length(1, 100) phoneNumberId?: string;
  @IsOptional() @IsString() @Length(1, 100) businessAccountId?: string;
  @IsOptional() @IsString() @Matches(/^v\d+\.\d+$/) graphApiVersion?: string;
  @IsOptional() @IsString() @Length(2, 10) templateLanguage?: string;
  @IsOptional() @IsString() @Length(1, 200) playerAccessTemplate?: string;
  @IsOptional() @IsString() @Length(1, 200) cardAssignmentTemplate?: string;
  @IsOptional() @IsString() @Length(1, 200) winnerPlayerTemplate?: string;
  @IsOptional() @IsString() @Length(1, 200) winnerFundTemplate?: string;
  @IsOptional() @IsString() fundContacts?: string;
  @IsOptional() @IsString() publicAppUrl?: string;
}

import { IsBoolean, IsOptional, IsString, Length } from 'class-validator';

export class UpdateLiveStreamSettingsDto {
  @IsOptional()
  @IsString()
  @Length(0, 500)
  youtubeUrl?: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}

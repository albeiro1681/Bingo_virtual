import { IsString, Length, Matches } from 'class-validator';

export class AdminLoginDto {
  @IsString()
  @Length(3, 50)
  @Matches(/^[a-zA-Z0-9._-]+$/)
  username!: string;

  @IsString()
  @Length(10, 200)
  password!: string;
}

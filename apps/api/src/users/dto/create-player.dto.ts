import { IsString, Length, Matches } from 'class-validator';

export class CreatePlayerDto {
  @IsString()
  @Length(2, 100)
  name!: string;

  @IsString()
  @Matches(/^\+[1-9]\d{7,14}$/, {
    message:
      'phone must use international E.164 format, for example +573001234567',
  })
  phone!: string;
}

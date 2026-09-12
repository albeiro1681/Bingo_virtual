import { IsOptional, IsString, IsUUID, Matches } from 'class-validator';

export class SendPlayerAccessLinkDto {
  @IsUUID('4', { message: 'El identificador del envío no es válido' })
  requestId!: string;

  @IsOptional()
  @IsString()
  @Matches(/^\+[1-9]\d{7,14}$/, {
    message: 'El destinatario debe usar el formato internacional E.164',
  })
  phone?: string;
}

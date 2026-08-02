import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { AdminTokenGuard } from '../auth/admin-token.guard';
import { UpdateWhatsAppSettingsDto } from './dto/update-whatsapp-settings.dto';
import { WhatsAppService } from './whatsapp.service';

@Controller('api/admin/whatsapp')
@UseGuards(AdminTokenGuard)
export class WhatsAppController {
  constructor(private readonly whatsapp: WhatsAppService) {}
  @Get('settings') settings() {
    return this.whatsapp.getPublicSettings();
  }
  @Put('settings') update(@Body() dto: UpdateWhatsAppSettingsDto) {
    return this.whatsapp.updateSettings(dto);
  }
  @Get('test') test() {
    return this.whatsapp.testConnection();
  }
  @Post('deliveries/:id/retry') retry(@Param('id') id: string) {
    return this.whatsapp.retryDelivery(id);
  }
}

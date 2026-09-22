import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { AdminTokenGuard } from '../auth/admin-token.guard';
import { UpdateLiveStreamSettingsDto } from './dto/update-live-stream-settings.dto';
import { LiveStreamService } from './live-stream.service';

@Controller('api/admin/live-stream')
@UseGuards(AdminTokenGuard)
export class LiveStreamController {
  constructor(private readonly liveStream: LiveStreamService) {}

  @Get()
  settings() {
    return this.liveStream.getSettings();
  }

  @Put()
  update(@Body() dto: UpdateLiveStreamSettingsDto) {
    return this.liveStream.updateSettings(dto);
  }
}

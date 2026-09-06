import { Controller, Get } from '@nestjs/common';
import { AppService, type HealthStatus } from './app.service';

@Controller('api')
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get('health')
  getHealth(): Promise<HealthStatus> {
    return this.appService.getHealth();
  }
}

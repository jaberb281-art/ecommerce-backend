import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {

  @Get()
  health() {
    return { status: 'ok', service: 'ecommerce-backend' };
  }

}
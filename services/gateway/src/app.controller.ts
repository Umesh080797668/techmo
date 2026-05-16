import { Controller, Get, Redirect } from '@nestjs/common';
import { Public } from './auth/public.decorator';

@Controller()
export class AppController {
  /** Redirect root to the admin UI */
  @Public()
  @Get()
  @Redirect('http://localhost:4001', 302)
  root() {}

  /** Simple health check */
  @Public()
  @Get('health')
  health() {
    return { status: 'ok', service: 'TechMo API Gateway' };
  }
}

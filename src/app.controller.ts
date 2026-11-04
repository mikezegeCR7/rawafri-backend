import { Controller, Get } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { Public } from './common/decorators/public.decorator';
import { BypassMaintenance } from './common/decorators/bypass-maintenance.decorator';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Public()
  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  // GET /api/v1/health — uptime pings (keeps the free Render instance awake).
  // Deliberately touches nothing else: no auth, no maintenance check and no
  // database query, so pinging it doesn't keep the Neon database awake too.
  // Not rate-limited, so a monitor pinging every few minutes is never refused.
  @Public()
  @BypassMaintenance()
  // Named explicitly: a bare @SkipThrottle() only skips a throttler called
  // "default", and ours are "burst" and "sustained" (common/throttle.ts).
  @SkipThrottle({ burst: true, sustained: true })
  @Get('health')
  health(): { status: 'ok' } {
    return { status: 'ok' };
  }
}

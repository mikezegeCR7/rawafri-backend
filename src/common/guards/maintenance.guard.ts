import {
  ExecutionContext,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { SettingsService } from '../../settings/settings.service';
import { IS_MAINTENANCE_EXEMPT_KEY } from '../decorators/bypass-maintenance.decorator';
import type { JwtPayload } from '../../auth/types/jwt-payload.type';

@Injectable()
export class MaintenanceGuard {
  constructor(
    private readonly reflector: Reflector,
    private readonly settingsService: SettingsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isExempt = this.reflector.getAllAndOverride<boolean>(
      IS_MAINTENANCE_EXEMPT_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (isExempt) {
      return true;
    }

    const maintenanceMode = await this.settingsService.isMaintenanceMode();

    if (!maintenanceMode) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user as JwtPayload | undefined;

    if (user?.role === Role.ADMIN) {
      return true;
    }

    throw new ServiceUnavailableException(
      'RawAfri is currently down for maintenance. Please check back shortly.',
    );
  }
}
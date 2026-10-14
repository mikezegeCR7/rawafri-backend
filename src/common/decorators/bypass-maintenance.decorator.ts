import { SetMetadata } from '@nestjs/common';

export const IS_MAINTENANCE_EXEMPT_KEY = 'isMaintenanceExempt';
export const BypassMaintenance = () =>
  SetMetadata(IS_MAINTENANCE_EXEMPT_KEY, true);
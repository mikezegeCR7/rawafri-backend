import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  // Singleton row — self-initializes on first read so no seed step is needed.
  async getSettings() {
    const existing = await this.prisma.platformSettings.findFirst();
    if (existing) {
      return existing;
    }
    return this.prisma.platformSettings.create({ data: {} });
  }

  async isMaintenanceMode(): Promise<boolean> {
    const settings = await this.getSettings();
    return settings.maintenanceMode;
  }

  async updateSettings(maintenanceMode: boolean) {
    const settings = await this.getSettings();
    return this.prisma.platformSettings.update({
      where: { id: settings.id },
      data: { maintenanceMode },
    });
  }
}
import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { SettingsService } from './settings.service';
import { SettingsResponseDto, UpdateSettingsDto } from './dto';
import { BypassMaintenance } from '../common/decorators/bypass-maintenance.decorator';

@ApiTags('settings')
@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  // GET /api/v1/settings — Public
  // The marketplace needs to check this even when logged out, to show a
  // maintenance banner/block before a customer ever tries to log in.
    @Get()
  @Public()
  @BypassMaintenance()
  @ApiOkResponse({ type: SettingsResponseDto })
  getSettings(): Promise<SettingsResponseDto> {
    return this.settingsService.getSettings();
  }

  // PATCH /api/v1/settings — Admin only
  @Patch()
  @Roles(Role.ADMIN)
  @UseGuards(RolesGuard)
  @ApiOkResponse({ type: SettingsResponseDto })
  updateSettings(@Body() dto: UpdateSettingsDto): Promise<SettingsResponseDto> {
    return this.settingsService.updateSettings(dto.maintenanceMode);
  }
}
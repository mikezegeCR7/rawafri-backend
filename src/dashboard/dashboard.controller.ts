import {
  Controller,
  Get,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import { Request } from 'express';

import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { CustomerDashboardDto } from './dto/customer-dashboard.dto';
import { AdminDashboardDto } from './dto/admin-dashboard.dto';

@ApiTags('Dashboard')
@ApiBearerAuth()
@Controller('dashboard')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DashboardController {
  constructor(
    private readonly dashboardService: DashboardService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get customer dashboard' })
  @ApiResponse({
    status: 200,
    type: CustomerDashboardDto,
  })
  async getCustomerDashboard(
    @Req() req: Request & { user: { sub: string } },
  ) {
    return this.dashboardService.getCustomerDashboard(
      req.user.sub,
    );
  }

  @Get('admin')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Get admin dashboard' })
  @ApiResponse({
    status: 200,
    type: AdminDashboardDto,
  })
  async getAdminDashboard() {
    return this.dashboardService.getAdminDashboard();
  }
}
import { Controller, Get, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';

import { ReportsService } from './reports.service';
import { SalesReportDto } from './dto/sales-report.dto';
import { OrdersReportDto } from './dto/orders-report.dto';
import { ProductsReportDto } from './dto/products-report.dto';
import { CustomersReportDto } from './dto/customers-report.dto';
import { PaymentsReportDto } from './dto/payments-report.dto';

import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@ApiTags('Reports')
@ApiBearerAuth()
@Controller('reports')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class ReportsController {
  constructor(
    private readonly reportsService: ReportsService,
  ) {}

  @Get('sales')
  @ApiOperation({ summary: 'Sales report' })
  @ApiResponse({ status: 200, type: SalesReportDto })
  getSalesReport() {
    return this.reportsService.getSalesReport();
  }

  @Get('orders')
  @ApiOperation({ summary: 'Orders report' })
  @ApiResponse({ status: 200, type: OrdersReportDto })
  getOrdersReport() {
    return this.reportsService.getOrdersReport();
  }

  @Get('products')
  @ApiOperation({ summary: 'Products report' })
  @ApiResponse({ status: 200, type: ProductsReportDto })
  getProductsReport() {
    return this.reportsService.getProductsReport();
  }

  @Get('customers')
  @ApiOperation({ summary: 'Customers report' })
  @ApiResponse({ status: 200, type: CustomersReportDto })
  getCustomersReport() {
    return this.reportsService.getCustomersReport();
  }

  @Get('payments')
  @ApiOperation({ summary: 'Payments report' })
  @ApiResponse({ status: 200, type: PaymentsReportDto })
  getPaymentsReport() {
    return this.reportsService.getPaymentsReport();
  }
}
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import type { JwtPayload } from '../auth/types/jwt-payload.type';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { VerifyDeliveryOtpDto } from './dto/verify-delivery-otp.dto';

@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  // POST /api/v1/orders — Customer only
  @Post()
  @Roles(Role.CUSTOMER)
  @UseGuards(RolesGuard)
  @HttpCode(HttpStatus.CREATED)
  create(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateOrderDto,
  ) {
    return this.ordersService.create(user.sub, dto);
  }

  // GET /api/v1/orders — Customer: own orders only
  @Get()
  @Roles(Role.CUSTOMER)
  @UseGuards(RolesGuard)
  findMyOrders(@CurrentUser() user: JwtPayload) {
    return this.ordersService.findMyOrders(user.sub);
  }

  // GET /api/v1/orders/:id — Customer: own order only
  @Get(':id')
  @Roles(Role.CUSTOMER)
  @UseGuards(RolesGuard)
  findMyOrder(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.ordersService.findMyOrder(user.sub, id);
  }

  // POST /api/v1/orders/:id/confirm-delivery — Customer only
  @Post(':id/confirm-delivery')
  @Roles(Role.CUSTOMER)
  @UseGuards(RolesGuard)
  @HttpCode(HttpStatus.OK)
  confirmDelivery(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.ordersService.confirmDelivery(id, user.sub);
  }

  // POST /api/v1/orders/:id/send-delivery-otp — Customer only
  @Post(':id/send-delivery-otp')
  @Roles(Role.CUSTOMER)
  @UseGuards(RolesGuard)
  @HttpCode(HttpStatus.OK)
  sendDeliveryOtp(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.ordersService.sendDeliveryOtp(id, user.sub);
  }

  // POST /api/v1/orders/:id/confirm-delivery-otp — Customer only
  @Post(':id/confirm-delivery-otp')
  @Roles(Role.CUSTOMER)
  @UseGuards(RolesGuard)
  @HttpCode(HttpStatus.OK)
  confirmDeliveryWithOtp(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: VerifyDeliveryOtpDto,
  ) {
    return this.ordersService.confirmDeliveryWithOtp(id, user.sub, dto.otp);
  }
}

@Controller('admin/orders')
@Roles(Role.ADMIN)
@UseGuards(RolesGuard)
export class AdminOrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  // GET /api/v1/admin/orders — Admin: all orders
  @Get()
  findAll() {
    return this.ordersService.findAllAdmin();
  }

  // GET /api/v1/admin/orders/:id — Admin: any order
  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.ordersService.findOneAdmin(id);
  }

  // PATCH /api/v1/admin/orders/:id/status — Admin: update status
  @Patch(':id/status')
  @HttpCode(HttpStatus.OK)
  updateStatus(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateOrderStatusDto,
  ) {
    return this.ordersService.updateStatus(id, user.sub, dto);
  }
}
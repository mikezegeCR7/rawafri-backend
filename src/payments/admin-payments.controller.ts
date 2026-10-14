import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Role } from '@prisma/client';
import type { JwtPayload } from '../auth/types/jwt-payload.type';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import {
  imageFileFilter,
  paymentStorage,
} from '../common/upload/multer.config';
import { RejectPaymentDto } from './dto';
import { PaymentsService } from './payments.service';

@Controller('payments/admin')
@Roles(Role.ADMIN)
@UseGuards(RolesGuard)
export class AdminPaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  // GET /api/v1/payments/admin
  @Get()
  findAll() {
    return this.paymentsService.findAll();
  }

  // GET /api/v1/payments/admin/:id
  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.paymentsService.findOne(id);
  }

 
  // PATCH /api/v1/payments/admin/:id/verify
  @Patch(':id/verify')
  @HttpCode(HttpStatus.OK)
  verify(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.paymentsService.verify(id, user.sub);
  }

  // PATCH /api/v1/payments/admin/:id/reject
  @Patch(':id/reject')
  @HttpCode(HttpStatus.OK)
  reject(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectPaymentDto,
  ) {
    return this.paymentsService.reject(id, user.sub, dto);
  }
}
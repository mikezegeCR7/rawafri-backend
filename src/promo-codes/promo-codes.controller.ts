import {
  Body,
  Controller,
  Delete,
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
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { LimitPerMinute } from '../common/throttle';
import { PromoCodesService } from './promoCodes.service';
import { CreatePromoCodeDto, UpdatePromoCodeDto, ValidatePromoCodeDto } from './dto';

@Controller('promo-codes')
export class PromoCodesController {
  constructor(private readonly promoCodesService: PromoCodesService) {}

  // POST /api/v1/promo-codes — Admin only
  @Post()
  @Roles(Role.ADMIN)
  @UseGuards(RolesGuard)
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreatePromoCodeDto) {
    return this.promoCodesService.create(dto);
  }

  // GET /api/v1/promo-codes/admin — Admin only
  @Get('admin')
  @Roles(Role.ADMIN)
  @UseGuards(RolesGuard)
  findAllAdmin() {
    return this.promoCodesService.findAllAdmin();
  }

  // GET /api/v1/promo-codes/active — Public
  @Get('active')
  @Public()
  findAllActive() {
    return this.promoCodesService.findAllActive();
  }

  // POST /api/v1/promo-codes/validate — Authenticated customers
  @LimitPerMinute(10)
  @Post('validate')
  @HttpCode(HttpStatus.OK)
  validate(@Body() dto: ValidatePromoCodeDto) {
    return this.promoCodesService.validate(dto);
  }

  // PATCH /api/v1/promo-codes/:id — Admin only
  @Patch(':id')
  @Roles(Role.ADMIN)
  @UseGuards(RolesGuard)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePromoCodeDto,
  ) {
    return this.promoCodesService.update(id, dto);
  }

  // DELETE /api/v1/promo-codes/:id — Admin only
  @Delete(':id')
  @Roles(Role.ADMIN)
  @UseGuards(RolesGuard)
  @HttpCode(HttpStatus.OK)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.promoCodesService.remove(id);
  }
}
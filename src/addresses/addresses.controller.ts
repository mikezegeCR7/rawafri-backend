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
} from '@nestjs/common';
import { Address } from '@prisma/client';
import type { JwtPayload } from '../auth/types/jwt-payload.type';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AddressesService } from './addresses.service';
import { CreateAddressDto, UpdateAddressDto } from './dtos';

@Controller('addresses')
export class AddressesController {
  constructor(private readonly addressesService: AddressesService) {}

  // POST /api/v1/addresses
  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateAddressDto,
  ): Promise<Address> {
    return this.addressesService.create(user.sub, dto);
  }

  // GET /api/v1/addresses
  @Get()
  findAll(@CurrentUser() user: JwtPayload): Promise<Address[]> {
    return this.addressesService.findAll(user.sub);
  }

  // GET /api/v1/addresses/:id
  @Get(':id')
  findOne(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<Address> {
    return this.addressesService.findOne(user.sub, id);
  }

  // PATCH /api/v1/addresses/:id
  @Patch(':id')
  update(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAddressDto,
  ): Promise<Address> {
    return this.addressesService.update(user.sub, id, dto);
  }

  // DELETE /api/v1/addresses/:id
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  remove(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ message: string }> {
    return this.addressesService.remove(user.sub, id);
  }

  // PATCH /api/v1/addresses/:id/set-default
  @Patch(':id/set-default')
  setDefault(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<Address> {
    return this.addressesService.setDefault(user.sub, id);
  }
}
import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/types/jwt-payload.type';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UpdateProfileDto, UserQueryDto } from './dto';
import { SafeUserResponseDto } from './dto/safe-user-response.dto';
import { UsersService } from './users.service';

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // GET /api/v1/users/me — protected by global JwtAuthGuard
  @Get('me')
  @ApiOkResponse({ type: SafeUserResponseDto })
  getMe(@CurrentUser() user: JwtPayload): Promise<SafeUserResponseDto> {
    return this.usersService.findById(user.sub);
  }

  // PATCH /api/v1/users/me — protected by global JwtAuthGuard
  @Patch('me')
  @ApiOkResponse({ type: SafeUserResponseDto })
  updateMe(
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateProfileDto,
  ): Promise<SafeUserResponseDto> {
    return this.usersService.updateProfile(user.sub, dto);
  }

  // GET /api/v1/users — admin: list all customers
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Get()
  listCustomers(@Query() query: UserQueryDto) {
    return this.usersService.findAllCustomers(query);
  }

  // GET /api/v1/users/:id — admin: get single customer detail
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Get(':id')
  getCustomer(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.getCustomerDetail(id);
  }

  // PATCH /api/v1/users/:id/toggle-status — admin: activate/deactivate customer
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Patch(':id/toggle-status')
  toggleCustomerStatus(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.toggleCustomerStatus(id);
  }

    // PATCH /api/v1/users/:id/promote — admin: promote a customer to admin
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Patch(':id/promote')
  promoteToAdmin(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.promoteToAdmin(id);
  }

  // PATCH /api/v1/users/:id/demote — admin: demote an admin back to customer
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Patch(':id/demote')
  demoteToCustomer(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.usersService.demoteToCustomer(id, user.sub);
  }

  // GET /api/v1/users/admins/list — admin: list all current admins
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Get('admins/list')
  listAdmins() {
    return this.usersService.listAdmins();
  }
}
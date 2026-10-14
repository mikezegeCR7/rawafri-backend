import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  ParseUUIDPipe,
} from '@nestjs/common';
import type { JwtPayload } from '../auth/types/jwt-payload.type';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
export class NotificationsController {
  constructor(
    private readonly notificationsService: NotificationsService,
  ) {}

  @Get()
  findAll(@CurrentUser() user: JwtPayload) {
    return this.notificationsService.findAll(user.sub);
  }

  @Get('unread-count')
  findUnreadCount(@CurrentUser() user: JwtPayload) {
    return this.notificationsService.findUnreadCount(user.sub);
  }

  @Patch(':id/read')
  @HttpCode(HttpStatus.OK)
  markAsRead(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.notificationsService.markAsRead(
      user.sub,
      id,
    );
  }

  @Patch('read-all')
  @HttpCode(HttpStatus.OK)
  markAllAsRead(
    @CurrentUser() user: JwtPayload,
  ) {
    return this.notificationsService.markAllAsRead(
      user.sub,
    );
  }
}
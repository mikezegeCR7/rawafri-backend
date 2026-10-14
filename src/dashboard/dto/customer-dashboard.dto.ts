import { ApiProperty } from '@nestjs/swagger';

class RecentOrderDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  orderNumber: string;

  @ApiProperty()
  status: string;

  @ApiProperty()
  totalAmount: number;

  @ApiProperty()
  createdAt: Date;
}

class RecentNotificationDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  title: string;

  @ApiProperty()
  message: string;

  @ApiProperty()
  isRead: boolean;

  @ApiProperty()
  createdAt: Date;
}

export class CustomerDashboardDto {
  @ApiProperty()
  totalOrders: number;

  @ApiProperty()
  pendingOrders: number;

  @ApiProperty()
  completedOrders: number;

  @ApiProperty()
  cancelledOrders: number;

  @ApiProperty()
  unreadNotifications: number;

  @ApiProperty()
  cartItems: number;

  @ApiProperty({ type: [RecentOrderDto] })
  recentOrders: RecentOrderDto[];

  @ApiProperty({ type: [RecentNotificationDto] })
  recentNotifications: RecentNotificationDto[];
}
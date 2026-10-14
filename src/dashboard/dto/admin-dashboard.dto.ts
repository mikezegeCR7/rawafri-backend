import { ApiProperty } from '@nestjs/swagger';

class RecentOrderDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  orderNumber: string;

  @ApiProperty()
  customerName: string;

  @ApiProperty()
  status: string;

  @ApiProperty()
  totalAmount: number;

  @ApiProperty()
  createdAt: Date;
}

class RecentPaymentDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  orderNumber: string;

  @ApiProperty()
  customerName: string;

  @ApiProperty()
  amount: number;

  @ApiProperty()
  status: string;

  @ApiProperty()
  createdAt: Date;
}

export class AdminDashboardDto {
  @ApiProperty()
  totalCustomers: number;

  @ApiProperty()
  totalProducts: number;

  @ApiProperty()
  totalOrders: number;

  @ApiProperty()
  pendingPayments: number;

  @ApiProperty()
  verifiedPayments: number;

  @ApiProperty()
  lowStockProducts: number;

  @ApiProperty()
  totalRevenue: number;

  @ApiProperty({ type: [RecentOrderDto] })
  recentOrders: RecentOrderDto[];

  @ApiProperty({ type: [RecentPaymentDto] })
  recentPayments: RecentPaymentDto[];
}
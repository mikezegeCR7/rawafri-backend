import { ApiProperty } from '@nestjs/swagger';

export class SalesReportDto {
  @ApiProperty()
  totalRevenue: number;

  @ApiProperty()
  totalOrders: number;

  @ApiProperty()
  verifiedPayments: number;

  @ApiProperty()
  pendingPayments: number;

  @ApiProperty()
  rejectedPayments: number;

  @ApiProperty()
  averageOrderValue: number;
}
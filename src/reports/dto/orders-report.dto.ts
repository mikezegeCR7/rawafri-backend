import { ApiProperty } from '@nestjs/swagger';

export class OrdersReportDto {
  @ApiProperty()
  totalOrders: number;

  @ApiProperty()
  receivedOrders: number;

  @ApiProperty()
  awaitingPayment: number;

  @ApiProperty()
  paymentConfirmed: number;

  @ApiProperty()
  preparingOrders: number;

  @ApiProperty()
  outForDelivery: number;

  @ApiProperty()
  awaitingCustomerConfirmation: number;

  @ApiProperty()
  deliveredOrders: number;

  @ApiProperty()
  cancelledOrders: number;
}
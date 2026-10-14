import { ApiProperty } from '@nestjs/swagger';

export class CustomersReportDto {
  @ApiProperty()
  totalCustomers: number;

  @ApiProperty()
  activeCustomers: number;

  @ApiProperty()
  inactiveCustomers: number;
}
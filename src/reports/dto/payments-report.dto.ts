import { ApiProperty } from '@nestjs/swagger';

export class PaymentsReportDto {
  @ApiProperty()
  totalPayments: number;

  @ApiProperty()
  pendingPayments: number;

  @ApiProperty()
  verifiedPayments: number;

  @ApiProperty()
  rejectedPayments: number;

  @ApiProperty()
  totalVerifiedAmount: number;
}
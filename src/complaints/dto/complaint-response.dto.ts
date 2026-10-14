import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ComplaintStatus } from '@prisma/client';

export class ComplaintOrderDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  orderNumber: string;
}

export class ComplaintCustomerDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  firstName: string;

  @ApiProperty()
  lastName: string;

  @ApiProperty()
  email: string;
}

export class ComplaintResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'uuid' })
  customerId: string;

  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
  })
  orderId: string | null;

  @ApiProperty()
  subject: string;

  @ApiProperty()
  message: string;

  @ApiProperty({
    enum: ComplaintStatus,
  })
  status: ComplaintStatus;

  @ApiPropertyOptional({
    nullable: true,
  })
  adminResponse: string | null;

  @ApiPropertyOptional({
    nullable: true,
    format: 'date-time',
  })
  resolvedAt: Date | null;

  @ApiProperty({
    format: 'date-time',
  })
  createdAt: Date;

  @ApiProperty({
    format: 'date-time',
  })
  updatedAt: Date;

  @ApiPropertyOptional({
    type: ComplaintOrderDto,
    nullable: true,
  })
  order?: ComplaintOrderDto | null;

  @ApiPropertyOptional({
    type: ComplaintCustomerDto,
    nullable: true,
  })
  customer?: ComplaintCustomerDto | null;
}
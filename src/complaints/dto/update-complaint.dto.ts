import {
  ApiPropertyOptional,
} from '@nestjs/swagger';
import {
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

import { ComplaintStatus } from '@prisma/client';

export class UpdateComplaintDto {
  @ApiPropertyOptional({
    enum: ComplaintStatus,
    description: 'Updated status of the complaint',
  })
  @IsOptional()
  @IsEnum(ComplaintStatus)
  status?: ComplaintStatus;

  @ApiPropertyOptional({
    description: 'Response from the admin to the customer',
    maxLength: 3000,
    example: 'Your complaint has been reviewed and resolved.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(3000)
  adminResponse?: string;
}
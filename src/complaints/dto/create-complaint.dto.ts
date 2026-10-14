import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreateComplaintDto {
  @ApiPropertyOptional({
    description: 'ID of the order associated with the complaint',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID()
  orderId?: string;

  @ApiProperty({
    description: 'Subject of the complaint',
    maxLength: 150,
    example: 'Missing item in my order',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  subject: string;

  @ApiProperty({
    description: 'Details of the complaint',
    maxLength: 3000,
    example: 'One of the items I ordered was missing from my delivery.',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(3000)
  message: string;
}
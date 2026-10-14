import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { NotificationType } from '@prisma/client';

export class CreateNotificationDto {
  @IsUUID()
  userId: string;

  @IsEnum(NotificationType)
  type: NotificationType;

  @IsOptional()
  @IsUUID()
  orderId?: string;

  @IsString()
  @MaxLength(120)
  title: string;

  @IsString()
  @MaxLength(500)
  message: string;
}
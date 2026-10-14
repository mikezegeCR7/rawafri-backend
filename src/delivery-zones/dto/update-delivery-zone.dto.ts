import { PartialType } from '@nestjs/mapped-types';
import { CreateDeliveryZoneDto } from './create-delivery-zone.dto';
import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateDeliveryZoneDto extends PartialType(
  CreateDeliveryZoneDto,
) {
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
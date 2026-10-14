import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { DeliveryZonesController } from './delivery-zones.controller';
import { DeliveryZonesService } from './deliveryZones.service';

@Module({
  imports: [PrismaModule],
  controllers: [DeliveryZonesController],
  providers: [DeliveryZonesService],
  exports: [DeliveryZonesService],
})
export class DeliveryZonesModule {}
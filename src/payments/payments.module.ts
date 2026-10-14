import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { PrismaModule } from '../prisma/prisma.module';
import { AdminPaymentsController } from './admin-payments.controller';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';

@Module({
  imports: [
    PrismaModule,
    NotificationsModule,
  ],
  controllers: [
  AdminPaymentsController,
  PaymentsController,
],
  providers: [PaymentsService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
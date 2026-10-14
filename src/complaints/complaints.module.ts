import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ComplaintsController } from './complaints.controller';
import { AdminComplaintsController } from './admin-complaints.controller';
import { ComplaintsService } from './complaints.service';

@Module({
  imports: [
    PrismaModule,
    NotificationsModule,
  ],
  controllers: [
    ComplaintsController,
    AdminComplaintsController,
  ],
  providers: [ComplaintsService],
})
export class ComplaintsModule {}
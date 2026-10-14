import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { AddressesModule } from './addresses/addresses.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { CategoriesModule } from './categories/categories.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { DeliveryZonesModule } from './delivery-zones/delivery-zones.module';
import { InventoryModule } from './inventory/inventory.module';
import { OrdersModule } from './orders/orders.module';
import { PaymentsModule } from './payments/payments.module';
import { ProductsModule } from './products/products.module';
import { PromoCodesModule } from './promo-codes/promo-codes.module';
import { PrismaModule } from './prisma/prisma.module';
import { UsersModule } from './users/users.module';
import { NotificationsModule } from './notifications/notifications.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { ReportsModule } from './reports/reports.module';
import { MailModule } from './mail/mail.module';
import { BankAccountsModule } from './bank-accounts/bank-accounts.module';
import { ComplaintsModule } from './complaints/complaints.module';
import { StorageModule } from './common/storage/storage.module';
import { WishlistModule } from './wishlist/wishlist.module';
import { SettingsModule } from './settings/settings.module';
import { MaintenanceGuard } from './common/guards/maintenance.guard';
import { THROTTLERS } from './common/throttle';

@Module({
  imports: [
    ThrottlerModule.forRoot(THROTTLERS),
    PrismaModule,
    StorageModule,
    AuthModule,
    UsersModule,
    AddressesModule,
    DeliveryZonesModule,
    PromoCodesModule,
    CategoriesModule,
    ProductsModule,
    InventoryModule,
    OrdersModule,
    PaymentsModule,
    NotificationsModule,
    DashboardModule,
    ReportsModule,
    MailModule,
    BankAccountsModule,
    ComplaintsModule,
    WishlistModule,
    SettingsModule,
  ],
  controllers: [AppController],
    providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: MaintenanceGuard,
    },
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
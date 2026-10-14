import { Injectable } from '@nestjs/common';
import { OrderStatus, PaymentStatus, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SalesReportDto } from './dto/sales-report.dto';
import { OrdersReportDto } from './dto/orders-report.dto';
import { ProductsReportDto } from './dto/products-report.dto';
import { CustomersReportDto } from './dto/customers-report.dto';
import { PaymentsReportDto } from './dto/payments-report.dto';
@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}
  async getSalesReport(): Promise<SalesReportDto> {
    const [
      totalOrders,
      verifiedPayments,
      pendingPayments,
      rejectedPayments,
      revenue,
    ] = await Promise.all([
      this.prisma.order.count(),
      this.prisma.payment.count({
        where: {
          status: PaymentStatus.VERIFIED,
        },
      }),
      this.prisma.payment.count({
        where: {
          status: PaymentStatus.PENDING,
        },
      }),
      this.prisma.payment.count({
        where: {
          status: PaymentStatus.REJECTED,
        },
      }),
      this.prisma.payment.aggregate({
        where: {
          status: PaymentStatus.VERIFIED,
        },
        _sum: {
          amount: true,
        },
      }),
    ]);
    const totalRevenue = Number(revenue._sum.amount ?? 0);
    return {
      totalRevenue,
      totalOrders,
      verifiedPayments,
      pendingPayments,
      rejectedPayments,
      averageOrderValue:
        totalOrders > 0
          ? Number(
              (totalRevenue / totalOrders).toFixed(2),
            )
          : 0,
    };
  }

  async getOrdersReport(): Promise<OrdersReportDto> {
    const [
      totalOrders,
      receivedOrders,
      awaitingPayment,
      paymentConfirmed,
      preparingOrders,
      outForDelivery,
      awaitingCustomerConfirmation,
      deliveredOrders,
      cancelledOrders,
    ] = await Promise.all([
      this.prisma.order.count(),
      this.prisma.order.count({
        where: {
          status: OrderStatus.ORDER_RECEIVED,
        },
      }),
      this.prisma.order.count({
        where: {
          status: OrderStatus.AWAITING_PAYMENT,
        },
      }),
      this.prisma.order.count({
        where: {
          status: OrderStatus.PAYMENT_CONFIRMED,
        },
      }),
      this.prisma.order.count({
        where: {
          status: OrderStatus.PREPARING_ORDER,
        },
      }),
      this.prisma.order.count({
        where: {
          status: OrderStatus.OUT_FOR_DELIVERY,
        },
      }),
      this.prisma.order.count({
        where: {
          status: OrderStatus.AWAITING_CUSTOMER_CONFIRMATION,
        },
      }),
      this.prisma.order.count({
        where: {
          status: OrderStatus.DELIVERED,
        },
      }),
      this.prisma.order.count({
        where: {
          status: OrderStatus.CANCELLED,
        },
      }),
    ]);
    return {
      totalOrders,
      receivedOrders,
      awaitingPayment,
      paymentConfirmed,
      preparingOrders,
      outForDelivery,
      awaitingCustomerConfirmation,
      deliveredOrders,
      cancelledOrders,
    };
  }

  async getProductsReport(): Promise<ProductsReportDto> {
    const [
      totalProducts,
      activeProducts,
      lowStockProducts,
      outOfStockProducts,
    ] = await Promise.all([
      this.prisma.product.count({
        where: {
          isActive: true,
        },
      }),
      this.prisma.product.count({
        where: {
          isActive: true,
        },
      }),
      this.prisma.inventory.findMany({
        select: {
          stockQuantity: true,
          lowStockThreshold: true,
        },
      }),
      this.prisma.inventory.count({
        where: {
          stockQuantity: 0,
        },
      }),
    ]);

    const lowStockCount = lowStockProducts.filter(
      (item) => item.stockQuantity <= item.lowStockThreshold,
    ).length;

    return {
      totalProducts,
      activeProducts,
      lowStockProducts: lowStockCount,
      outOfStockProducts,
    };
  }

  async getCustomersReport(): Promise<CustomersReportDto> {
    const [totalCustomers, activeCustomers, inactiveCustomers] =
      await Promise.all([
        this.prisma.user.count({
          where: {
            role: Role.CUSTOMER,
          },
        }),
        this.prisma.user.count({
          where: {
            role: Role.CUSTOMER,
            isActive: true,
          },
        }),
        this.prisma.user.count({
          where: {
            role: Role.CUSTOMER,
            isActive: false,
          },
        }),
      ]);
    return {
      totalCustomers,
      activeCustomers,
      inactiveCustomers,
    };
  }

  async getPaymentsReport(): Promise<PaymentsReportDto> {
    const [
      totalPayments,
      pendingPayments,
      verifiedPayments,
      rejectedPayments,
      revenue,
    ] = await Promise.all([
      this.prisma.payment.count(),
      this.prisma.payment.count({
        where: {
          status: PaymentStatus.PENDING,
        },
      }),
      this.prisma.payment.count({
        where: {
          status: PaymentStatus.VERIFIED,
        },
      }),
      this.prisma.payment.count({
        where: {
          status: PaymentStatus.REJECTED,
        },
      }),
      this.prisma.payment.aggregate({
        where: {
          status: PaymentStatus.VERIFIED,
        },
        _sum: {
          amount: true,
        },
      }),
    ]);
    return {
      totalPayments,
      pendingPayments,
      verifiedPayments,
      rejectedPayments,
      totalVerifiedAmount: Number(
        revenue._sum.amount ?? 0,
      ),
    };
  }
}
import { Injectable } from '@nestjs/common';
import {
  OrderStatus,
  PaymentStatus,
  Role,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CustomerDashboardDto } from './dto/customer-dashboard.dto';
import { AdminDashboardDto } from './dto/admin-dashboard.dto';
@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}
  async getCustomerDashboard(
    userId: string,
  ): Promise<CustomerDashboardDto> {
    const [
      totalOrders,
      pendingOrders,
      completedOrders,
      cancelledOrders,
      unreadNotifications,
      recentOrders,
      recentNotifications,
    ] = await Promise.all([
      this.prisma.order.count({
        where: { customerId: userId },
      }),
      this.prisma.order.count({
        where: {
          customerId: userId,
          status: {
            in: [
              OrderStatus.ORDER_RECEIVED,
              OrderStatus.AWAITING_PAYMENT,
              OrderStatus.PAYMENT_CONFIRMED,
              OrderStatus.PREPARING_ORDER,
              OrderStatus.OUT_FOR_DELIVERY,
              OrderStatus.AWAITING_CUSTOMER_CONFIRMATION,
            ],
          },
        },
      }),
      this.prisma.order.count({
        where: {
          customerId: userId,
          status: OrderStatus.DELIVERED,
        },
      }),
      this.prisma.order.count({
        where: {
          customerId: userId,
          status: OrderStatus.CANCELLED,
        },
      }),
      this.prisma.notification.count({
        where: {
          userId,
          isRead: false,
        },
      }),
      this.prisma.order.findMany({
        where: {
          customerId: userId,
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: 5,
        select: {
          id: true,
          orderNumber: true,
          status: true,
          totalAmount: true,
          createdAt: true,
        },
      }),
      this.prisma.notification.findMany({
        where: {
          userId,
        },
        orderBy: [
          {
            isRead: 'asc',
          },
          {
            createdAt: 'desc',
          },
        ],
        take: 5,
        select: {
          id: true,
          title: true,
          message: true,
          isRead: true,
          createdAt: true,
        },
      }),
    ]);
    return {
      totalOrders,
      pendingOrders,
      completedOrders,
      cancelledOrders,
      unreadNotifications,
      // TODO: Replace with actual cart count when Cart module is implemented.
      cartItems: 0,
      recentOrders: recentOrders.map((order) => ({
        id: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        totalAmount: Number(order.totalAmount),
        createdAt: order.createdAt,
      })),
      recentNotifications,
    };
  }

  async getAdminDashboard(): Promise<AdminDashboardDto> {
    const [
      totalCustomers,
      totalProducts,
      totalOrders,
      pendingPayments,
      verifiedPayments,
      lowStockProducts,
      revenue,
      recentOrders,
      recentPayments,
    ] = await Promise.all([
      this.prisma.user.count({
        where: {
          role: Role.CUSTOMER,
          isActive: true,
        },
      }),
      this.prisma.product.count({
        where: {
          isActive: true,
        },
      }),
      this.prisma.order.count(),
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
      this.prisma.inventory.findMany({
        select: {
          stockQuantity: true,
          lowStockThreshold: true,
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
      this.prisma.order.findMany({
        take: 5,
        orderBy: {
          createdAt: 'desc',
        },
        select: {
          id: true,
          orderNumber: true,
          status: true,
          totalAmount: true,
          createdAt: true,
          customer: {
            select: {
              firstName: true,
              lastName: true,
            },
          },
        },
      }),
      this.prisma.payment.findMany({
        take: 5,
        orderBy: {
          createdAt: 'desc',
        },
        select: {
          id: true,
          amount: true,
          status: true,
          createdAt: true,
          order: {
            select: {
              orderNumber: true,
              customer: {
                select: {
                  firstName: true,
                  lastName: true,
                },
              },
            },
          },
        },
      }),
    ]);

    const lowStockCount = lowStockProducts.filter(
      (item) => item.stockQuantity <= item.lowStockThreshold,
    ).length;

    return {
      totalCustomers,
      totalProducts,
      totalOrders,
      pendingPayments,
      verifiedPayments,
      lowStockProducts: lowStockCount,
      totalRevenue: Number(revenue._sum.amount ?? 0),
      recentOrders: recentOrders.map((order) => ({
        id: order.id,
        orderNumber: order.orderNumber,
        customerName: `${order.customer.firstName ?? ''} ${order.customer.lastName ?? ''}`.trim(),
        status: order.status,
        totalAmount: Number(order.totalAmount),
        createdAt: order.createdAt,
      })),
      recentPayments: recentPayments.map((payment) => ({
        id: payment.id,
        orderNumber: payment.order.orderNumber,
        customerName: `${payment.order.customer.firstName ?? ''} ${payment.order.customer.lastName ?? ''}`.trim(),
        amount: Number(payment.amount),
        status: payment.status,
        createdAt: payment.createdAt,
      })),
    };
  }
}
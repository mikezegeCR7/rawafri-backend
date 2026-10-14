import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { randomInt } from 'crypto';
import { Decimal } from '@prisma/client/runtime/library';
import {
  Order,
  OrderItem,
  OrderStatus,
  OrderStatusHistory,
  OtpPurpose,
  Payment,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { NotificationsService } from '../notifications/notifications.service';
import { BCRYPT_ROUNDS } from '../users/constants/users.constants';
import { CreateOrderDto, OrderItemDto } from './dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';

export interface CreatedOrder {
  order: Order;
  orderItems: OrderItem[];
  payment: Payment;
  statusHistory: OrderStatusHistory;
}

type ResolvedItem = {
  productId: string;
  quantity: number;
  unitPrice: Decimal;
  lineTotal: Decimal;
};

const TERMINAL_STATUSES: OrderStatus[] = [
  OrderStatus.DELIVERED,
  OrderStatus.CANCELLED,
];

const ALLOWED_STATUS_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  ORDER_RECEIVED: [OrderStatus.AWAITING_PAYMENT, OrderStatus.CANCELLED],
  AWAITING_PAYMENT: [OrderStatus.PAYMENT_CONFIRMED, OrderStatus.CANCELLED],
  PAYMENT_CONFIRMED: [OrderStatus.PREPARING_ORDER, OrderStatus.CANCELLED],
  PREPARING_ORDER: [OrderStatus.OUT_FOR_DELIVERY, OrderStatus.CANCELLED],
  OUT_FOR_DELIVERY: [OrderStatus.AWAITING_CUSTOMER_CONFIRMATION, OrderStatus.CANCELLED],
  AWAITING_CUSTOMER_CONFIRMATION: [OrderStatus.DELIVERED],
  DELIVERED: [],
  CANCELLED: [],
};

@Injectable()
export class OrdersService {
    constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async create(customerId: string, dto: CreateOrderDto): Promise<CreatedOrder> {
    const address = await this.prisma.address.findUnique({
      where: { id: dto.addressId },
    });

    if (!address || !address.isActive) {
      throw new NotFoundException(`Address ${dto.addressId} not found`);
    }

    if (address.userId !== customerId) {
      throw new ForbiddenException('You do not have access to this address');
    }

    const deliveryZone = await this.prisma.deliveryZone.findUnique({
      where: { id: dto.deliveryZoneId },
    });

    if (!deliveryZone || !deliveryZone.isActive) {
      throw new NotFoundException(`Delivery zone ${dto.deliveryZoneId} not found`);
    }

    const resolvedItems = await this.resolveItems(dto.items);

    let promoCodeId: string | null = null;
    let discountPercent = new Decimal(0);

    if (dto.promoCode) {
      const promo = await this.prisma.promoCode.findUnique({
        where: { code: dto.promoCode },
      });

      if (!promo) {
        throw new NotFoundException(`Promo code "${dto.promoCode}" not found`);
      }
      if (!promo.isActive) {
        throw new BadRequestException(`Promo code "${dto.promoCode}" is no longer active`);
      }
      if (promo.expiresAt < new Date()) {
        throw new BadRequestException(`Promo code "${dto.promoCode}" has expired`);
      }
      if (promo.usedCount >= promo.maxUses) {
        throw new BadRequestException(`Promo code "${dto.promoCode}" has reached its usage limit`);
      }

      promoCodeId = promo.id;
      discountPercent = promo.discountPercent;
    }

    const subtotal = resolvedItems.reduce(
      (sum, item) => sum.add(item.lineTotal),
      new Decimal(0),
    );

    const deliveryFee = new Decimal(deliveryZone.fee);
    const discountAmount = subtotal.mul(discountPercent).div(100).toDecimalPlaces(2);
    const totalAmount = subtotal.add(deliveryFee).sub(discountAmount).toDecimalPlaces(2);

    const orderNumber = await this.generateOrderNumber();

    const result = await this.prisma.$transaction(async (tx) => {
      const order = await tx.order.create({
        data: {
          orderNumber,
          customerId,
          addressId: dto.addressId,
          deliveryZoneId: dto.deliveryZoneId,
          promoCodeId,
          subtotal,
          deliveryFee,
          discountAmount,
          totalAmount,
          status: 'ORDER_RECEIVED',
          deliveryContactName: address.contactName,
          deliveryPhone: address.phone,
          deliveryAddress: address.line1,
          deliveryCity: address.city,
          deliveryState: address.state,
          deliveryNotes: address.landmark ?? null,
        },
      });

      const orderItems = await Promise.all(
        resolvedItems.map(async (item) => {
          const orderItem = await tx.orderItem.create({
            data: {
              orderId: order.id,
              productId: item.productId,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              lineTotal: item.lineTotal,
            },
          });
          await tx.inventory.update({
            where: {
              productId: item.productId,
            },
            data: {
              stockQuantity: {
                decrement: item.quantity,
              },
            },
          });
          return orderItem;
        }),
      );

      const statusHistory = await tx.orderStatusHistory.create({
        data: {
          orderId: order.id,
          status: 'ORDER_RECEIVED',
          changedById: customerId,
          note: 'Order placed by customer',
        },
      });

      const payment = await tx.payment.create({
        data: {
          orderId: order.id,
          status: 'PENDING',
          amount: totalAmount,
        },
      });

      if (promoCodeId) {
        await tx.promoCode.update({
          where: {
            id: promoCodeId,
          },
          data: {
            usedCount: {
              increment: 1,
            },
          },
        });
      }

            return { order, orderItems, payment, statusHistory };
    });

    try {
      await this.notificationsService.notifyAllAdmins(
        'ORDER_STATUS',
        'New Order Received',
        `Order ${result.order.orderNumber} was just placed — ₦${Number(result.order.totalAmount).toLocaleString('en-NG')}.`,
        result.order.id,
      );
    } catch (error) {
      console.error('Failed to notify admins of new order', error);
    }

    return result;
  }

  async findMyOrders(customerId: string): Promise<Order[]> {
    return this.prisma.order.findMany({
      where: { customerId },
      include: {
        items: { include: { product: true } },
        payment: true,
        statusHistory: { orderBy: { createdAt: 'asc' } },
        address: true,
        deliveryZone: true,
        promoCode: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findMyOrder(customerId: string, orderId: string): Promise<Order> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: { include: { product: true } },
        payment: true,
        statusHistory: { orderBy: { createdAt: 'asc' } },
        address: true,
        deliveryZone: true,
        promoCode: true,
      },
    });

    if (!order) {
      throw new NotFoundException(`Order ${orderId} not found`);
    }

    if (order.customerId !== customerId) {
      throw new ForbiddenException('You do not have access to this order');
    }

    return order;
  }

  // ─── Customer: Confirm Delivery ─────────────────────────────────────────────
  async confirmDelivery(
    orderId: string,
    customerId: string,
  ): Promise<Order> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      throw new NotFoundException(`Order ${orderId} not found`);
    }

    if (order.customerId !== customerId) {
      throw new ForbiddenException(
        'You do not have permission to confirm this delivery',
      );
    }

    if (order.status !== OrderStatus.AWAITING_CUSTOMER_CONFIRMATION) {
      throw new BadRequestException(
        'This order is not awaiting customer confirmation',
      );
    }

    return this.finalizeDeliveryConfirmation(
      orderId,
      customerId,
      'Customer confirmed delivery',
    );
  }

  private readonly deliveryOtpTtlMs = 10 * 60 * 1000;

  private generateOtp(): string {
    return randomInt(100000, 1000000).toString();
  }

  /**
   * Generates and emails a 6-digit code the customer must enter to confirm
   * delivery. Reuses the OtpToken model (identifier = orderId here, rather
   * than an email address, since this purpose is scoped to a single order).
   */
  async sendDeliveryOtp(
    orderId: string,
    customerId: string,
  ): Promise<{ message: string }> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        customer: { select: { email: true } },
      },
    });

    if (!order) {
      throw new NotFoundException(`Order ${orderId} not found`);
    }

    if (order.customerId !== customerId) {
      throw new ForbiddenException(
        'You do not have permission to confirm this delivery',
      );
    }

    if (order.status !== OrderStatus.AWAITING_CUSTOMER_CONFIRMATION) {
      throw new BadRequestException(
        'This order is not awaiting customer confirmation',
      );
    }

    const otp = this.generateOtp();
    const codeHash = await bcrypt.hash(otp, BCRYPT_ROUNDS);

    // Expire any previous unused delivery OTPs for this order.
    await this.prisma.otpToken.updateMany({
      where: {
        identifier: orderId,
        purpose: OtpPurpose.DELIVERY_CONFIRMATION,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      data: { expiresAt: new Date() },
    });

    await this.prisma.otpToken.create({
      data: {
        identifier: orderId,
        purpose: OtpPurpose.DELIVERY_CONFIRMATION,
        codeHash,
        expiresAt: new Date(Date.now() + this.deliveryOtpTtlMs),
      },
    });

    await this.mailService.sendMail(
      order.customer.email,
      'RawAfri Delivery Confirmation Code',
      `
        <h2>Confirm Your Delivery</h2>
        <p>Your delivery confirmation code is:</p>
        <h1>${otp}</h1>
        <p>Enter this code in the app to confirm you've received your order.</p>
        <p>This code expires in 10 minutes.</p>
      `,
    );

    return { message: 'A confirmation code has been sent to your email.' };
  }

  async confirmDeliveryWithOtp(
    orderId: string,
    customerId: string,
    otp: string,
  ): Promise<Order> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      throw new NotFoundException(`Order ${orderId} not found`);
    }

    if (order.customerId !== customerId) {
      throw new ForbiddenException(
        'You do not have permission to confirm this delivery',
      );
    }

    if (order.status !== OrderStatus.AWAITING_CUSTOMER_CONFIRMATION) {
      throw new BadRequestException(
        'This order is not awaiting customer confirmation',
      );
    }

    const otpToken = await this.prisma.otpToken.findFirst({
      where: {
        identifier: orderId,
        purpose: OtpPurpose.DELIVERY_CONFIRMATION,
        usedAt: null,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!otpToken) {
      throw new BadRequestException('Invalid or expired code');
    }
    if (otpToken.expiresAt < new Date()) {
      throw new BadRequestException('This code has expired');
    }

    const isValid = await bcrypt.compare(otp, otpToken.codeHash);
    if (!isValid) {
      throw new BadRequestException('Invalid or expired code');
    }

    await this.prisma.otpToken.update({
      where: { id: otpToken.id },
      data: { usedAt: new Date() },
    });

    return this.finalizeDeliveryConfirmation(
      orderId,
      customerId,
      'Customer confirmed delivery via OTP',
    );
  }

  /** Shared by both confirmDelivery and confirmDeliveryWithOtp — the actual
   * status transition + history entry, once ownership/status have already
   * been validated by the caller. */
  private async finalizeDeliveryConfirmation(
    orderId: string,
    customerId: string,
    note: string,
  ): Promise<Order> {
    const updatedOrder = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.order.update({
        where: { id: orderId },
        data: {
          status: OrderStatus.DELIVERED,
        },
        include: {
          customer: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              phone: true,
              role: true,
              isActive: true,
              createdAt: true,
              updatedAt: true,
            },
          },
          items: {
            include: {
              product: true,
            },
          },
          payment: true,
          statusHistory: {
            orderBy: {
              createdAt: 'asc',
            },
          },
          address: true,
          deliveryZone: true,
          promoCode: true,
        },
      });

      await tx.orderStatusHistory.create({
        data: {
          orderId,
          status: OrderStatus.DELIVERED,
          changedById: customerId,
          note,
        },
      });

      return updated;
    });

    return updatedOrder;
  }

  async findAllAdmin(): Promise<Order[]> {
    return this.prisma.order.findMany({
      include: {
        customer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            role: true,
            isActive: true,
            createdAt: true,
            updatedAt: true,
          },
        },
        items: { include: { product: true } },
        payment: true,
        statusHistory: { orderBy: { createdAt: 'asc' } },
        address: true,
        deliveryZone: true,
        promoCode: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOneAdmin(orderId: string): Promise<Order> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        customer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            role: true,
            isActive: true,
            createdAt: true,
            updatedAt: true,
          },
        },
        items: { include: { product: true } },
        payment: true,
        statusHistory: { orderBy: { createdAt: 'asc' } },
        address: true,
        deliveryZone: true,
        promoCode: true,
      },
    });

    if (!order) {
      throw new NotFoundException(`Order ${orderId} not found`);
    }

    return order;
  }

  async updateStatus(
    orderId: string,
    adminId: string,
    dto: UpdateOrderStatusDto,
  ): Promise<Order> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      throw new NotFoundException(`Order ${orderId} not found`);
    }

    if (TERMINAL_STATUSES.includes(order.status)) {
      throw new BadRequestException(
        `Order ${orderId} is already ${order.status} and cannot be updated`,
      );
    }

    const allowedStatuses = ALLOWED_STATUS_TRANSITIONS[order.status];

    if (!allowedStatuses.includes(dto.status)) {
      throw new BadRequestException(
        `Cannot change order from ${order.status} to ${dto.status}`,
      );
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const updatedOrder = await tx.order.update({
        where: { id: orderId },
        data: { status: dto.status },
        include: {
          customer: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              phone: true,
              role: true,
              isActive: true,
              createdAt: true,
              updatedAt: true,
            },
          },
          items: { include: { product: true } },
          payment: true,
          statusHistory: { orderBy: { createdAt: 'asc' } },
          address: true,
          deliveryZone: true,
          promoCode: true,
        },
      });

      await tx.orderStatusHistory.create({
        data: {
          orderId,
          status: dto.status,
          changedById: adminId,
          note: dto.note ?? null,
        },
      });

      return updatedOrder;
    });

    return updated;
  }

  private async resolveItems(items: OrderItemDto[]): Promise<ResolvedItem[]> {
    const resolved = await Promise.all(
      items.map(async (item) => {
        const product = await this.prisma.product.findUnique({
          where: { id: item.productId },
          include: { inventory: true },
        });

        if (!product || !product.isActive) {
          throw new NotFoundException(`Product ${item.productId} not found or inactive`);
        }

        if (!product.inventory) {
          throw new BadRequestException(`Product "${product.name}" has no inventory record`);
        }

        if (product.inventory.stockQuantity < item.quantity) {
          throw new BadRequestException(
            `Insufficient stock for "${product.name}". Available: ${product.inventory.stockQuantity}, Requested: ${item.quantity}`,
          );
        }

        if (item.quantity < product.minOrderQuantity) {
          throw new BadRequestException(
            `Minimum order quantity for "${product.name}" is ${product.minOrderQuantity}`,
          );
        }

        const unitPrice = product.price;
        const lineTotal = unitPrice.mul(item.quantity).toDecimalPlaces(2);

        return {
          productId: item.productId,
          quantity: item.quantity,
          unitPrice,
          lineTotal,
        };
      }),
    );

    return resolved;
  }

  private async generateOrderNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const count = await this.prisma.order.count();
    const sequence = String(count + 1).padStart(6, '0');
    return `RAW-${year}-${sequence}`;
  }
}
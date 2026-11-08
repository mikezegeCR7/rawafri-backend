import {
  BadRequestException,
  ConflictException,
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
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { NotificationsService } from '../notifications/notifications.service';
import { BCRYPT_ROUNDS } from '../users/constants/users.constants';
import { verifyOtpAttempt } from '../common/otp-attempts';
import { CreateOrderDto, OrderItemDto } from './dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import {
  adminNewOrderEmail,
  deliveryCodeEmail,
  orderPlacedEmail,
  orderStatusEmail,
  type EmailOrder,
} from '../mail/templates';

export interface CreatedOrder {
  order: Order;
  orderItems: OrderItem[];
  payment: Payment;
  statusHistory: OrderStatusHistory;
}

type ResolvedItem = {
  productId: string;
  unitId: string;
  productName: string;
  unitName: string;
  note: string | null;
  /** "Rice (Mudu)", for error messages. */
  label: string;
  quantity: number;
  unitPrice: Decimal;
  lineTotal: Decimal;
};

/** Combines lines for the same unit so checks see the full quantity.
 * The same product in different units (1 Bag + 3 Mudu) stays as separate lines. */
function mergeDuplicateItems(items: OrderItemDto[]): OrderItemDto[] {
  const byUnit = new Map<string, OrderItemDto>();
  for (const item of items) {
    const existing = byUnit.get(item.unitId);
    if (existing) {
      existing.quantity += item.quantity;
      if (item.note) existing.note = existing.note ? `${existing.note} / ${item.note}`.slice(0, 300) : item.note;
    } else {
      byUnit.set(item.unitId, { unitId: item.unitId, quantity: item.quantity, note: item.note });
    }
  }
  return [...byUnit.values()];
}

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

/** In-app titles for each status a customer can be told about. */
const ORDER_STATUS_TITLES: Record<OrderStatus, string> = {
  ORDER_RECEIVED: 'Order received',
  AWAITING_PAYMENT: 'Waiting for your payment',
  PAYMENT_CONFIRMED: 'Payment confirmed',
  PREPARING_ORDER: 'Preparing your order',
  OUT_FOR_DELIVERY: 'Out for delivery',
  AWAITING_CUSTOMER_CONFIRMATION: 'Arrived — please confirm delivery',
  DELIVERED: 'Order delivered',
  CANCELLED: 'Order cancelled',
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

    // The same product listed twice is one line with the combined quantity, so
    // stock and minimum-order checks see the real total.
    const resolvedItems = await this.resolveItems(mergeDuplicateItems(dto.items));

    let promoCodeId: string | null = null;
    let promoMaxUses = 0;
    let discountPercent = new Decimal(0);

    if (dto.promoCode) {
      const promo = await this.prisma.promoCode.findUnique({
        where: { code: dto.promoCode.trim().toUpperCase() },
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
      promoMaxUses = promo.maxUses;
      discountPercent = promo.discountPercent;
    }

    const subtotal = resolvedItems.reduce(
      (sum, item) => sum.add(item.lineTotal),
      new Decimal(0),
    );

    const deliveryFee = new Decimal(deliveryZone.fee);
    const discountAmount = subtotal.mul(discountPercent).div(100).toDecimalPlaces(2);
    const totalAmount = subtotal.add(deliveryFee).sub(discountAmount).toDecimalPlaces(2);

    // Order numbers come from a count, so two orders placed at the same moment
    // can collide on the unique orderNumber; retry with a fresh number.
    let result!: CreatedOrder;
    for (let attempt = 1; ; attempt++) {
      const orderNumber = await this.generateOrderNumber();
      try {
        result = await this.createOrderRecords(customerId, dto, address, orderNumber, {
          resolvedItems,
          subtotal,
          deliveryFee,
          discountAmount,
          totalAmount,
          promoCodeId,
          promoMaxUses,
        });
        break;
      } catch (error) {
        const orderNumberTaken =
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002' &&
          String(error.meta?.target ?? '').includes('orderNumber');
        if (!orderNumberTaken || attempt >= 3) throw error;
      }
    }

    await this.notifyOrderPlaced(customerId, result.order, resolvedItems);

    return result;
  }

  /** Writes the order, items, stock, payment and promo use in one transaction.
   * Stock and promo limits are enforced by conditional updates inside the
   * transaction, so two simultaneous orders can't both take the last unit
   * or the last promo use. */
  private async createOrderRecords(
    customerId: string,
    dto: CreateOrderDto,
    address: { contactName: string; phone: string; line1: string; city: string; state: string; landmark: string | null },
    orderNumber: string,
    totals: {
      resolvedItems: ResolvedItem[];
      subtotal: Decimal;
      deliveryFee: Decimal;
      discountAmount: Decimal;
      totalAmount: Decimal;
      promoCodeId: string | null;
      promoMaxUses: number;
    },
  ): Promise<CreatedOrder> {
    const { resolvedItems, subtotal, deliveryFee, discountAmount, totalAmount, promoCodeId, promoMaxUses } = totals;

    return this.prisma.$transaction(async (tx) => {
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

      const orderItems: OrderItem[] = [];
      for (const item of resolvedItems) {
        // Take this unit's stock only if enough is still there at this moment.
        const taken = await tx.productUnit.updateMany({
          where: { id: item.unitId, isActive: true, stockQuantity: { gte: item.quantity } },
          data: { stockQuantity: { decrement: item.quantity } },
        });
        if (taken.count === 0) {
          throw new BadRequestException(
            `"${item.label}" no longer has enough stock for this order. Please adjust the quantity.`,
          );
        }
        orderItems.push(
          await tx.orderItem.create({
            data: {
              orderId: order.id,
              productId: item.productId,
              unitId: item.unitId,
              unitName: item.unitName,
              note: item.note,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              lineTotal: item.lineTotal,
            },
          }),
        );
      }

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
        // Use the promo only while it still has uses left at this moment.
        const used = await tx.promoCode.updateMany({
          where: { id: promoCodeId, usedCount: { lt: promoMaxUses } },
          data: { usedCount: { increment: 1 } },
        });
        if (used.count === 0) {
          throw new BadRequestException(`Promo code "${dto.promoCode}" has reached its usage limit`);
        }
      }

      return { order, orderItems, payment, statusHistory };
    });
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

    await this.mailService.send(
      order.customer.email,
      deliveryCodeEmail(order.orderNumber, otp),
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

    await verifyOtpAttempt(this.prisma, otpToken, otp);

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
      // Only once: a double tap (or a second device) can't record it twice.
      const moved = await tx.order.updateMany({
        where: { id: orderId, status: OrderStatus.AWAITING_CUSTOMER_CONFIRMATION },
        data: { status: OrderStatus.DELIVERED },
      });
      if (moved.count === 0) {
        throw new BadRequestException('This delivery has already been confirmed.');
      }

      const updated = await tx.order.findUniqueOrThrow({
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

    await this.notificationsService.notifyCustomer({
      user: updatedOrder.customer,
      type: 'ORDER_STATUS',
      orderId,
      title: 'Order delivered',
      message: `Order ${updatedOrder.orderNumber} is complete. Thank you for shopping with RawAfri!`,
      email: orderStatusEmail(updatedOrder.customer.firstName, updatedOrder, OrderStatus.DELIVERED),
    });
    try {
      await this.notificationsService.notifyAllAdmins(
        'ORDER_STATUS',
        'Order Delivered',
        `${updatedOrder.customer.firstName} ${updatedOrder.customer.lastName} confirmed delivery of order ${updatedOrder.orderNumber}.`,
        orderId,
      );
    } catch (error) {
      console.error('Failed to notify admins of delivered order', error);
    }

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
      // Only move the order if it is still in the status we validated against —
      // two admins acting at once can't both apply (e.g. restock twice).
      const moved = await tx.order.updateMany({
        where: { id: orderId, status: order.status },
        data: { status: dto.status },
      });
      if (moved.count === 0) {
        throw new ConflictException(
          'This order was just updated by someone else. Refresh and try again.',
        );
      }

      // Cancelling returns the items to stock and gives back the promo use.
      if (dto.status === OrderStatus.CANCELLED) {
        const items = await tx.orderItem.findMany({ where: { orderId } });
        for (const item of items) {
          await tx.productUnit.update({
            where: { id: item.unitId },
            data: { stockQuantity: { increment: item.quantity } },
          });
        }
        if (order.promoCodeId) {
          await tx.promoCode.updateMany({
            where: { id: order.promoCodeId, usedCount: { gt: 0 } },
            data: { usedCount: { decrement: 1 } },
          });
        }
      }

      const updatedOrder = await tx.order.findUniqueOrThrow({
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

    const title = ORDER_STATUS_TITLES[dto.status];
    await this.notificationsService.notifyCustomer({
      user: updated.customer,
      type: 'ORDER_STATUS',
      orderId,
      title,
      message: `Order ${updated.orderNumber}: ${title.toLowerCase()}.${dto.note ? ` ${dto.note}` : ''}`,
      email: orderStatusEmail(updated.customer.firstName, updated, dto.status, dto.note),
    });

    return updated;
  }

  /** Emails the customer their order and how to pay, and alerts the admins. */
  private async notifyOrderPlaced(
    customerId: string,
    order: Order,
    items: ResolvedItem[],
  ): Promise<void> {
    try {
      const [customer, bankAccounts] = await Promise.all([
        this.prisma.user.findUniqueOrThrow({
          where: { id: customerId },
          select: { id: true, email: true, firstName: true, lastName: true },
        }),
        this.prisma.bankAccount.findMany({
          where: { isActive: true },
          orderBy: { createdAt: 'asc' },
          select: { bankName: true, accountName: true, accountNumber: true },
        }),
      ]);

      const emailOrder: EmailOrder = {
        ...order,
        items: items.map((i) => ({
          productName: i.productName,
          unitName: i.unitName,
          quantity: i.quantity,
          lineTotal: i.lineTotal,
          note: i.note,
        })),
      };
      const total = `₦${Number(order.totalAmount).toLocaleString('en-NG')}`;

      await this.notificationsService.notifyCustomer({
        user: customer,
        type: 'ORDER_STATUS',
        orderId: order.id,
        title: 'Order placed',
        message: `We've received order ${order.orderNumber}. Transfer ${total} and upload your receipt to get it moving.`,
        email: orderPlacedEmail(customer.firstName, emailOrder, bankAccounts),
      });

      const customerName = `${customer.firstName} ${customer.lastName}`;
      await this.notificationsService.notifyAllAdmins(
        'ORDER_STATUS',
        'New Order Received',
        `Order ${order.orderNumber} was just placed — ${total}.`,
        order.id,
        adminNewOrderEmail(emailOrder, customerName),
      );
    } catch (error) {
      console.error('Failed to send new-order notifications', error);
    }
  }

  private async resolveItems(items: OrderItemDto[]): Promise<ResolvedItem[]> {
    const resolved = await Promise.all(
      items.map(async (item) => {
        const unit = await this.prisma.productUnit.findUnique({
          where: { id: item.unitId },
          include: { product: { include: { category: true } } },
        });

        if (!unit || !unit.isActive || !unit.product.isActive || !unit.product.category.isActive) {
          throw new NotFoundException('One of the items in your basket is no longer available. Please remove it and try again.');
        }

        const label = `${unit.product.name} (${unit.name})`;

        if (unit.stockQuantity < item.quantity) {
          throw new BadRequestException(
            unit.stockQuantity === 0
              ? `"${label}" is out of stock.`
              : `Only ${unit.stockQuantity} of "${label}" left in stock.`,
          );
        }

        if (item.quantity < unit.minOrderQuantity) {
          throw new BadRequestException(
            `Minimum order for "${label}" is ${unit.minOrderQuantity}.`,
          );
        }

        const unitPrice = unit.price;
        const lineTotal = unitPrice.mul(item.quantity).toDecimalPlaces(2);

        return {
          productId: unit.productId,
          unitId: unit.id,
          productName: unit.product.name,
          unitName: unit.name,
          note: item.note ?? null,
          label,
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
import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { OrderStatus, PaymentStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { RejectPaymentDto } from './dto';
import { R2StorageService } from '../common/storage/r2-storage.service';

const SAFE_CUSTOMER_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  phone: true,
};

const PAYMENT_INCLUDE = {
  order: {
    include: {
      customer: {
        select: SAFE_CUSTOMER_SELECT,
      },
    },
  },
  verifiedBy: {
    select: SAFE_CUSTOMER_SELECT,
  },
  rejectedBy: {
    select: SAFE_CUSTOMER_SELECT,
  },
} as const;

const PAYMENT_DETAILS_INCLUDE = {
  order: {
    include: {
      customer: {
        select: SAFE_CUSTOMER_SELECT,
      },
      statusHistory: {
        orderBy: { createdAt: 'asc' as const },
      },
    },
  },
  verifiedBy: {
    select: SAFE_CUSTOMER_SELECT,
  },
  rejectedBy: {
    select: SAFE_CUSTOMER_SELECT,
  },
} as const;

type PaymentWithRelations = Prisma.PaymentGetPayload<{
  include: typeof PAYMENT_DETAILS_INCLUDE;
}>;

type PaymentListItem = Prisma.PaymentGetPayload<{
  include: typeof PAYMENT_INCLUDE;
}>;

import { requireImage } from '../common/upload/image-file';
import {
  adminReceiptUploadedEmail,
  paymentRejectedEmail,
  paymentVerifiedEmail,
  receiptReceivedEmail,
} from '../mail/templates';

/** A payment can only be accepted while its order is still waiting for one. */
const PAYABLE_ORDER_STATUSES: OrderStatus[] = [
  OrderStatus.ORDER_RECEIVED,
  OrderStatus.AWAITING_PAYMENT,
];

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly storageService: R2StorageService,
  ) {}

  // ─── Customer: Get My Payments ──────────────────────────────────────────────

  async findMyPayments(customerId: string): Promise<PaymentListItem[]> {
    return this.prisma.payment.findMany({
      where: {
        order: {
          customerId,
        },
      },
      include: PAYMENT_INCLUDE,
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  // ─── Customer: Get My Single Payment ────────────────────────────────────────

  async findMyPayment(
    paymentId: string,
    customerId: string,
  ): Promise<PaymentWithRelations> {
    const payment = await this.prisma.payment.findFirst({
      where: {
        id: paymentId,
        order: {
          customerId,
        },
      },
      include: PAYMENT_DETAILS_INCLUDE,
    });
    if (!payment) {
      throw new NotFoundException('Payment not found');
    }
    return payment;
  }

  // ─── Admin: Get All Payments ───────────────────────────────────────────────

  async findAll(): Promise<PaymentListItem[]> {
    return this.prisma.payment.findMany({
      include: PAYMENT_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
  }

  // ─── Admin: Get Single Payment ─────────────────────────────────────────────

  async findOne(id: string): Promise<PaymentWithRelations> {
    const payment = await this.prisma.payment.findUnique({
      where: { id },
      include: PAYMENT_DETAILS_INCLUDE,
    });

    if (!payment) {
      throw new NotFoundException(`Payment ${id} not found`);
    }

    return payment;
  }

  // ─── Admin: Upload Proof ───────────────────────────────────────────────────

  async uploadProof(
    paymentId: string,
    customerId: string,
    file: Express.Multer.File,
  ): Promise<PaymentWithRelations> {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    const payment = await this.findMyPayment(
      paymentId,
      customerId,
    );

    if (payment.status === PaymentStatus.VERIFIED) {
      throw new BadRequestException(
        'Cannot upload proof for a verified payment',
      );
    }

    if (!PAYABLE_ORDER_STATUSES.includes(payment.order.status)) {
      throw new BadRequestException(
        payment.order.status === OrderStatus.CANCELLED
          ? 'This order was cancelled, so it no longer takes a payment.'
          : 'This order is no longer waiting for a payment.',
      );
    }

    const image = requireImage(file);
    const key = `payments/${paymentId}-${Date.now()}.${image.extension}`;
    const proofImageUrl = await this.storageService.uploadFile(
      file.buffer,
      key,
      image.contentType,
    );

    // Never turn a payment an admin verified during the upload back into "uploaded".
    const uploaded = await this.prisma.payment.updateMany({
      where: {
        id: paymentId,
        status: { not: PaymentStatus.VERIFIED },
      },
      data: {
        proofImageUrl,
        status: PaymentStatus.UPLOADED,
        rejectedById: null,
        rejectedAt: null,
        rejectionReason: null,
      },
    });
    if (uploaded.count === 0) {
      throw new BadRequestException(
        'Cannot upload proof for a verified payment',
      );
    }
    const updatedPayment = await this.prisma.payment.findUniqueOrThrow({
      where: { id: paymentId },
      include: PAYMENT_DETAILS_INCLUDE,
    });

    // Note: the previous proof image (if any) is intentionally left in R2
    // rather than deleted — receipt images are tiny, and this avoids the
    // added complexity/risk of a delete call here. Can be revisited with a
    // periodic cleanup job later if storage volume ever becomes a concern.
    
    const { order } = updatedPayment;
    const customerName = `${order.customer.firstName} ${order.customer.lastName}`;

    await this.notificationsService.notifyCustomer({
      user: order.customer,
      type: 'PAYMENT',
      orderId: order.id,
      title: 'Receipt received',
      message: `We're checking your receipt for order ${order.orderNumber}. We'll let you know once it's confirmed.`,
      email: receiptReceivedEmail(order.customer.firstName, order),
    });

    try {
      await this.notificationsService.notifyAllAdmins(
        'PAYMENT',
        'Payment Proof Uploaded',
        `${customerName} uploaded a receipt for order ${order.orderNumber} — needs review.`,
        updatedPayment.orderId,
        adminReceiptUploadedEmail(order.orderNumber, customerName, order.totalAmount),
      );
    } catch (error) {
      console.error('Failed to notify admins of uploaded payment proof', error);
    }

    return updatedPayment;
  }

  // ─── Admin: Verify Payment ─────────────────────────────────────────────────

  async verify(
    id: string,
    adminId: string,
  ): Promise<PaymentWithRelations> {
    const payment = await this.findOne(id);

    if (payment.status !== PaymentStatus.UPLOADED) {
      throw new BadRequestException(
        'Only uploaded payments can be verified',
      );
    }

    if (!PAYABLE_ORDER_STATUSES.includes(payment.order.status)) {
      throw new BadRequestException(
        payment.order.status === OrderStatus.CANCELLED
          ? 'This order was cancelled, so its payment can no longer be verified.'
          : 'This order is no longer waiting for a payment.',
      );
    }

    const updatedPayment = await this.prisma.$transaction(async (tx) => {
      // Conditional updates: if another admin verified or rejected this
      // payment, or the order was cancelled, a moment ago, nothing changes.
      const paid = await tx.payment.updateMany({
        where: { id, status: PaymentStatus.UPLOADED },
        data: {
          status: PaymentStatus.VERIFIED,
          verifiedById: adminId,
          verifiedAt: new Date(),
        },
      });
      const moved = await tx.order.updateMany({
        where: { id: payment.orderId, status: { in: PAYABLE_ORDER_STATUSES } },
        data: {
          status: OrderStatus.PAYMENT_CONFIRMED,
        },
      });
      if (paid.count === 0 || moved.count === 0) {
        throw new ConflictException(
          'This payment or order was just changed by someone else. Refresh and try again.',
        );
      }

      const updatedPayment = await tx.payment.findUniqueOrThrow({
        where: { id },
        include: PAYMENT_DETAILS_INCLUDE,
      });

      await tx.orderStatusHistory.create({
        data: {
          orderId: payment.orderId,
          status: 'PAYMENT_CONFIRMED',
          changedById: adminId,
          note: 'Payment verified',
        },
      });

      return updatedPayment;
    });

    await this.notificationsService.notifyCustomer({
      user: payment.order.customer,
      type: 'PAYMENT',
      orderId: payment.orderId,
      title: 'Payment Verified',
      message: `Your payment for order ${payment.order.orderNumber} has been verified.`,
      email: paymentVerifiedEmail(payment.order.customer.firstName, payment.order),
    });

    return updatedPayment;
  }

  // ─── Admin: Reject Payment ─────────────────────────────────────────────────

  async reject(
    id: string,
    adminId: string,
    dto: RejectPaymentDto,
  ): Promise<PaymentWithRelations> {
    const payment = await this.findOne(id);

    if (
      payment.status !== PaymentStatus.PENDING &&
      payment.status !== PaymentStatus.UPLOADED
    ) {
      throw new BadRequestException(
        'Only pending or uploaded payments can be rejected',
      );
    }

    // Only if it is still pending/uploaded — never overwrite a payment another
    // admin verified a moment ago.
    const rejected = await this.prisma.payment.updateMany({
      where: {
        id,
        status: { in: [PaymentStatus.PENDING, PaymentStatus.UPLOADED] },
      },
      data: {
        status: PaymentStatus.REJECTED,
        rejectedById: adminId,
        rejectionReason: dto.reason,
        rejectedAt: new Date(),
      },
    });
    if (rejected.count === 0) {
      throw new ConflictException(
        'This payment was just changed by someone else. Refresh and try again.',
      );
    }
    const updatedPayment = await this.prisma.payment.findUniqueOrThrow({
      where: { id },
      include: PAYMENT_DETAILS_INCLUDE,
    });

    await this.notificationsService.notifyCustomer({
      user: payment.order.customer,
      type: 'PAYMENT',
      orderId: payment.orderId,
      title: 'Payment Rejected',
      message: `Your payment for order ${payment.order.orderNumber} was rejected. Reason: ${dto.reason}`,
      email: paymentRejectedEmail(payment.order.customer.firstName, payment.order, dto.reason),
    });

    return updatedPayment;
  }
}
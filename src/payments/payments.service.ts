import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PaymentStatus, Prisma } from '@prisma/client';
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

    const extension = file.originalname.split('.').pop() ?? 'jpg';
    const key = `payments/${paymentId}-${Date.now()}.${extension}`;
    const proofImageUrl = await this.storageService.uploadFile(
      file.buffer,
      key,
      file.mimetype,
    );

    const updatedPayment = await this.prisma.payment.update({
      where: {
        id: paymentId,
      },
      data: {
        proofImageUrl,
        status: PaymentStatus.UPLOADED,
        rejectedById: null,
        rejectedAt: null,
        rejectionReason: null,
      },
      include: PAYMENT_DETAILS_INCLUDE,
    });

    // Note: the previous proof image (if any) is intentionally left in R2
    // rather than deleted — receipt images are tiny, and this avoids the
    // added complexity/risk of a delete call here. Can be revisited with a
    // periodic cleanup job later if storage volume ever becomes a concern.
    
    try {
      await this.notificationsService.notifyAllAdmins(
        'PAYMENT',
        'Payment Proof Uploaded',
        `${updatedPayment.order.customer.firstName} ${updatedPayment.order.customer.lastName} uploaded a receipt for order ${updatedPayment.order.orderNumber} — needs review.`,
        updatedPayment.orderId,
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

    const updatedPayment = await this.prisma.$transaction(async (tx) => {
      const updatedPayment = await tx.payment.update({
        where: { id },
        data: {
          status: PaymentStatus.VERIFIED,
          verifiedById: adminId,
          verifiedAt: new Date(),
        },
        include: PAYMENT_DETAILS_INCLUDE,
      });

      await tx.order.update({
        where: { id: payment.orderId },
        data: {
          status: 'PAYMENT_CONFIRMED',
        },
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

        try {
  await this.notificationsService.createPaymentNotification(
    payment.order.customer.id,
    payment.orderId,
    'Payment Verified',
    `Your payment for order ${payment.order.orderNumber} has been verified.`,
  );
} catch (error) {
  console.error('Failed to create payment notification', error);
}

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

    const updatedPayment = await this.prisma.payment.update({
      where: { id },
      data: {
        status: PaymentStatus.REJECTED,
        rejectedById: adminId,
        rejectionReason: dto.reason,
        rejectedAt: new Date(),
      },
      include: PAYMENT_DETAILS_INCLUDE,
    });

    try {
  await this.notificationsService.createPaymentNotification(
    payment.order.customer.id,
    payment.orderId,
    'Payment Rejected',
    `Your payment for order ${payment.order.orderNumber} was rejected. Reason: ${dto.reason}`,
  );
} catch (error) {
  console.error('Failed to create payment notification', error);
}

return updatedPayment;
  }
}
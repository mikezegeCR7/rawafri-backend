import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Complaint, ComplaintStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateComplaintDto } from './dto/create-complaint.dto';
import { UpdateComplaintDto } from './dto/update-complaint.dto';
import {
  adminNewComplaintEmail,
  complaintReceivedEmail,
  complaintUpdatedEmail,
} from '../mail/templates';

const COMPLAINT_STATUS_LABELS: Record<ComplaintStatus, string> = {
  OPEN: 'Open',
  IN_PROGRESS: 'Being handled',
  RESOLVED: 'Resolved',
  CLOSED: 'Closed',
};

@Injectable()
export class ComplaintsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  // Customer: Create complaint
  async create(
    customerId: string,
    dto: CreateComplaintDto,
  ): Promise<Complaint> {
    if (dto.orderId) {
      const order = await this.prisma.order.findFirst({
        where: {
          id: dto.orderId,
          customerId,
        },
      });

      if (!order) {
        throw new BadRequestException(
          'Order not found or does not belong to you',
        );
      }
    }

    const existing = await this.prisma.complaint.findFirst({
      where: {
        customerId,
        orderId: dto.orderId ?? null,
        subject: dto.subject.trim(),
        status: {
          in: [
            ComplaintStatus.OPEN,
            ComplaintStatus.IN_PROGRESS,
          ],
        },
      },
    });
    if (existing) {
      throw new BadRequestException(
        'You already have an open complaint with this subject.',
      );
    }

       const complaint = await this.prisma.complaint.create({
      data: {
        customerId,
        orderId: dto.orderId,
        subject: dto.subject.trim(),
        message: dto.message.trim(),
      },
    });

    try {
      const [customer, order] = await Promise.all([
        this.prisma.user.findUniqueOrThrow({
          where: { id: customerId },
          select: { id: true, email: true, firstName: true, lastName: true },
        }),
        complaint.orderId
          ? this.prisma.order.findUnique({
              where: { id: complaint.orderId },
              select: { orderNumber: true },
            })
          : null,
      ]);
      const customerName = `${customer.firstName} ${customer.lastName}`;

      await this.notificationsService.notifyCustomer({
        user: customer,
        type: 'SYSTEM',
        orderId: complaint.orderId ?? undefined,
        title: 'Complaint received',
        message: `We've received your complaint "${complaint.subject}" and will get back to you.`,
        email: complaintReceivedEmail(customer.firstName, complaint.subject, complaint.message, order?.orderNumber),
      });

      await this.notificationsService.notifyAllAdmins(
        'SYSTEM',
        'New Complaint Filed',
        `New complaint from ${customerName}: "${complaint.subject}"`,
        complaint.orderId ?? undefined,
        adminNewComplaintEmail(customerName, complaint.subject, complaint.message, order?.orderNumber),
      );
    } catch (error) {
      console.error('Failed to send new-complaint notifications', error);
    }

    return complaint;
  }

  // Customer: My complaints
  async findMine(customerId: string) {
    return this.prisma.complaint.findMany({
      where: {
        customerId,
      },
      include: {
        order: {
          select: {
            id: true,
            orderNumber: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  // Customer: Single complaint
  async findMineById(
    id: string,
    customerId: string,
  ) {
    const complaint =
      await this.prisma.complaint.findFirst({
        where: {
          id,
          customerId,
        },
        include: {
          order: {
            select: {
              id: true,
              orderNumber: true,
            },
          },
        },
      });

    if (!complaint) {
      throw new NotFoundException(
        'Complaint not found',
      );
    }

    return complaint;
  }

  // Admin: All complaints
  async findAll() {
    return this.prisma.complaint.findMany({
      include: {
        customer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        order: {
          select: {
            id: true,
            orderNumber: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  // Admin: Single complaint
  async findOne(id: string) {
    const complaint =
      await this.prisma.complaint.findUnique({
        where: {
          id,
        },
        include: {
          customer: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          order: {
            select: {
              id: true,
              orderNumber: true,
            },
          },
        },
      });

    if (!complaint) {
      throw new NotFoundException(
        'Complaint not found',
      );
    }

    return complaint;
  }

  // Admin: Update complaint
  async update(
    id: string,
    dto: UpdateComplaintDto,
  ) {
    const complaint = await this.findOne(id);
    if (
      dto.status === complaint.status &&
      dto.adminResponse === complaint.adminResponse
    ) {
      return complaint;
    }

    const updated =
      await this.prisma.complaint.update({
        where: {
          id,
        },
        data: {
          ...(dto.status && {
            status: dto.status,
          }),
          ...(dto.adminResponse !== undefined && {
            adminResponse:
              dto.adminResponse.trim(),
          }),
          ...(dto.status === ComplaintStatus.RESOLVED &&
            !complaint.resolvedAt && {
              resolvedAt: new Date(),
          }),
        },
      });

    const statusLabel = COMPLAINT_STATUS_LABELS[updated.status];
    await this.notificationsService.notifyCustomer({
      user: complaint.customer,
      type: 'SYSTEM',
      orderId: complaint.orderId ?? undefined,
      title: `Complaint ${statusLabel.toLowerCase()}`,
      message: updated.adminResponse
        ? `Update on "${complaint.subject}": ${updated.adminResponse}`
        : `Your complaint "${complaint.subject}" is now ${statusLabel.toLowerCase()}.`,
      email: complaintUpdatedEmail(
        complaint.customer.firstName,
        complaint.subject,
        updated.status,
        // Only include the response when it's new, so a status-only change
        // doesn't repeat an old reply.
        dto.adminResponse !== undefined && dto.adminResponse.trim() !== (complaint.adminResponse ?? '')
          ? updated.adminResponse
          : null,
      ),
    });

    return updated;
  }
}
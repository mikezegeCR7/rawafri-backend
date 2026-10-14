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
      await this.notificationsService.notifyAllAdmins(
        'SYSTEM',
        'New Complaint Filed',
        `New complaint: "${complaint.subject}"`,
        complaint.orderId ?? undefined,
      );
    } catch (error) {
      console.error('Failed to notify admins of new complaint', error);
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

    try {
      await this.notificationsService.createSystemNotification(
        complaint.customerId,
        `Complaint ${dto.status ?? 'Updated'}`,
        `Your complaint "${complaint.subject}" is now ${dto.status ?? 'updated'}.`,
      );
    } catch (error) {
      console.error(
        'Failed to create complaint notification',
        error,
      );
    }

    return updated;
  }
}
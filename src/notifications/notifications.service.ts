import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { Prisma, Role } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

import { CreateNotificationDto } from './dto/create-notification.dto';


const NOTIFICATION_INCLUDE = {
  order: {
    select: {
      id: true,
      orderNumber: true,
      status: true,
    },
  },
} as const;


type NotificationWithRelations = Prisma.NotificationGetPayload<{
  include: typeof NOTIFICATION_INCLUDE;
}>;


@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async create(
    createNotificationDto: CreateNotificationDto,
  ): Promise<NotificationWithRelations> {
    const {
      userId,
      orderId,
      type,
      title,
      message,
    } = createNotificationDto;

    return this.prisma.notification.create({
      data: {
        userId,
        orderId,
        type,
        title,
        message,
      },
      include: NOTIFICATION_INCLUDE,
    });
  }

  async findAll(
    userId: string,
  ): Promise<NotificationWithRelations[]> {
    return this.prisma.notification.findMany({
      where: { userId },
      include: NOTIFICATION_INCLUDE,
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async findUnreadCount(userId: string): Promise<{ count: number }> {
    const count = await this.prisma.notification.count({
      where: {
        userId,
        isRead: false,
      },
    });

    return { count };
  }

  async markAsRead(
    userId: string,
    notificationId: string,
  ): Promise<NotificationWithRelations> {
    const notification = await this.prisma.notification.findFirst({
      where: {
        id: notificationId,
        userId,
      },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    if (notification.isRead) {
      return this.prisma.notification.findUniqueOrThrow({
        where: {
          id: notificationId,
        },
        include: NOTIFICATION_INCLUDE,
      });
    }

    return this.prisma.notification.update({
      where: {
        id: notificationId,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
      include: NOTIFICATION_INCLUDE,
    });
  }

  async markAllAsRead(userId: string): Promise<{ success: boolean }> {
    await this.prisma.notification.updateMany({
      where: {
        userId,
        isRead: false,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    return { success: true };
  }

  async createOrderNotification(
    userId: string,
    orderId: string,
    title: string,
    message: string,
  ) {
    return this.create({
      userId,
      orderId,
      type: 'ORDER_STATUS',
      title,
      message,
    });
  }

  async createPaymentNotification(
    userId: string,
    orderId: string,
    title: string,
    message: string,
  ) {
    return this.create({
      userId,
      orderId,
      type: 'PAYMENT',
      title,
      message,
    });
  }

  async createSystemNotification(
    userId: string,
    title: string,
    message: string,
  ) {
    return this.create({
      userId,
      type: 'SYSTEM',
      title,
      message,
    });
  }

  async notifyAllAdmins(
    type: CreateNotificationDto['type'],
    title: string,
    message: string,
    orderId?: string,
  ): Promise<void> {
    const admins = await this.prisma.user.findMany({
      where: {
        role: Role.ADMIN,
      },
      select: {
        id: true,
      },
    });

    if (admins.length === 0) {
      return;
    }

    await Promise.all(
      admins.map((admin) =>
        this.create({
          userId: admin.id,
          orderId,
          type,
          title,
          message,
        }),
      ),
    );
  }
}
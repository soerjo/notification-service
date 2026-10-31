import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  DeliveryLogStatus,
  NotificationChannel,
  NotificationStatus,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';

export interface CreateNotificationInput {
  traceId: string;
  idempotencyKey: string;
  domainId?: string | null;
  channel: NotificationChannel;
  recipientId: string;
  recipientTarget: string;
  templateCode: string | null;
  title: string;
  content: string;
  payload: Prisma.InputJsonValue;
}

export interface UpdateNotificationStatusInput {
  status: NotificationStatus;
  retryCount: number;
}

export interface CreateDeliveryLogInput {
  notificationId: string;
  attempt: number;
  status: DeliveryLogStatus;
  providerResponse: Prisma.InputJsonValue;
  latencyMs: number;
}

export interface FindDeliveryLogsOptions {
  notificationId?: string;
  startDate: Date;
  endDate: Date;
  page?: number;
  limit?: number;
  order?: 'asc' | 'desc';
  channel?: NotificationChannel;
  status?: DeliveryLogStatus;
}

export interface PaginatedDeliveryLogs {
  items: Array<
    Omit<Prisma.NotificationDeliveryLogGetPayload<object>, 'id'> & {
      id: string;
    }
  >;
  meta: {
    total: number;
    page: number;
    limit: number;
    total_pages: number;
    has_next: boolean;
    has_prev: boolean;
  };
}

@Injectable()
export class NotificationsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByIdempotencyKey(idempotencyKey: string) {
    return this.prisma.notification.findUnique({
      where: { idempotencyKey },
    });
  }

  findByBaseIdempotencyKey(baseIdempotencyKey: string) {
    return this.prisma.notification.findMany({
      where: {
        OR: [
          { idempotencyKey: baseIdempotencyKey },
          { idempotencyKey: { startsWith: `${baseIdempotencyKey}::` } },
        ],
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  create(input: CreateNotificationInput) {
    return this.prisma.notification.create({ data: input });
  }

  async findById(id: string) {
    const notification = await this.prisma.notification.findUnique({
      where: { id },
    });
    if (!notification) {
      throw new NotFoundException(`Notification with id ${id} not found`);
    }
    return notification;
  }

  updateStatus(id: string, input: UpdateNotificationStatusInput) {
    return this.prisma.notification.update({
      where: { id },
      data: input,
    });
  }

  createDeliveryLog(input: CreateDeliveryLogInput) {
    return this.prisma.notificationDeliveryLog.create({ data: input });
  }

  async findDeliveryLogs(notificationId: string) {
    const logs = await this.prisma.notificationDeliveryLog.findMany({
      where: { notificationId },
      orderBy: { id: 'asc' },
    });
    return logs.map((log) => ({ ...log, id: log.id.toString() }));
  }

  async findDeliveryLogsPaginated(
    options: FindDeliveryLogsOptions,
  ): Promise<PaginatedDeliveryLogs> {
    const page = Math.max(1, options.page ?? 1);
    const limit = Math.max(1, Math.min(100, options.limit ?? 10));
    const skip = (page - 1) * limit;
    const order = options.order ?? 'desc';

    const where: Prisma.NotificationDeliveryLogWhereInput = {
      ...(options.notificationId
        ? { notificationId: options.notificationId }
        : {}),
      ...(options.status ? { status: options.status } : {}),
      ...(options.channel
        ? { notification: { channel: options.channel } }
        : {}),
      createdAt: {
        gte: options.startDate,
        lte: options.endDate,
      },
    };

    const [total, logs] = await Promise.all([
      this.prisma.notificationDeliveryLog.count({ where }),
      this.prisma.notificationDeliveryLog.findMany({
        where,
        orderBy: { createdAt: order },
        skip,
        take: limit,
      }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      items: logs.map((log) => ({ ...log, id: log.id.toString() })),
      meta: {
        total,
        page,
        limit,
        total_pages: totalPages,
        has_next: page < totalPages,
        has_prev: page > 1,
      },
    };
  }
}

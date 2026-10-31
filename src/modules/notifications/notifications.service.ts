import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { NotificationChannel, Prisma, type Notification } from '@prisma/client';
import { sanitize } from '../../common/utils/sanitizer.util.js';
import {
  SendNotificationDto,
  NotificationDestinationDto,
  SendEmailDto,
  SendTelegramDto,
  SendWhatsappDto,
  SendSocketDto,
  GetNotificationLogsDto,
} from './dto/index.js';
import {
  NotificationsRepository,
  CreateNotificationInput,
} from './notifications.repository.js';
import { TemplateService } from './templates/template.service.js';
import { NotificationsQueueService } from './notifications.queue.js';

export interface SendResult {
  notificationIds: string[];
  traceId: string;
  idempotent: boolean;
}

interface ResolvedRecipient {
  recipientId: string;
  destination: NotificationDestinationDto;
}

const MAX_TITLE_LENGTH = 255;
const MAX_IDEMPOTENCY_KEY_LENGTH = 255;

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly repository: NotificationsRepository,
    private readonly templateService: TemplateService,
    private readonly queue: NotificationsQueueService,
  ) {}

  async send(dto: SendNotificationDto): Promise<SendResult> {
    const baseIdempotencyKey = dto.idempotency_key.slice(
      0,
      MAX_IDEMPOTENCY_KEY_LENGTH,
    );

    const existing =
      await this.repository.findByBaseIdempotencyKey(baseIdempotencyKey);
    if (existing.length > 0) {
      return {
        notificationIds: existing.map((notification) => notification.id),
        traceId: existing[0].traceId,
        idempotent: true,
      };
    }

    const traceId = dto.trace_id ?? randomUUID();
    const recipients = this.buildRecipients(dto);
    const items = await this.buildItems(
      dto,
      recipients,
      traceId,
      baseIdempotencyKey,
    );

    const notificationIds: string[] = [];
    let createdAny = false;

    for (const item of items) {
      const { notification, created } = await this.persist(item);
      notificationIds.push(notification.id);
      if (created) {
        createdAny = true;
        await this.queue.enqueue(notification.id);
      }
    }

    return { notificationIds, traceId, idempotent: !createdAny };
  }

  async sendEmail(dto: SendEmailDto): Promise<SendResult> {
    const contentBody = dto.body ?? dto.html;
    if (!dto.template_code && !contentBody) {
      throw new BadRequestException(
        'Either body/html or template_code must be provided for email',
      );
    }

    const metadata: Record<string, unknown> = {
      ...(dto.metadata ?? {}),
      ...(dto.template_data ?? {}),
      ...(dto.html ? { html: dto.html } : {}),
      ...(dto.cc ? { cc: dto.cc } : {}),
      ...(dto.bcc ? { bcc: dto.bcc } : {}),
      ...(dto.reply_to ? { reply_to: dto.reply_to } : {}),
    };

    return this.send({
      idempotency_key: dto.idempotency_key,
      trace_id: dto.trace_id,
      recipient_id: dto.recipient_id ?? dto.to,
      channels: [NotificationChannel.EMAIL],
      destination: { email: dto.to },
      content: {
        title: dto.subject,
        body: contentBody,
      },
      template_code: dto.template_code,
      metadata,
    });
  }

  async sendTelegram(dto: SendTelegramDto): Promise<SendResult> {
    if (!dto.template_code && !dto.message) {
      throw new BadRequestException(
        'Either message or template_code must be provided for telegram',
      );
    }

    const metadata: Record<string, unknown> = {
      ...(dto.metadata ?? {}),
      ...(dto.template_data ?? {}),
      ...(dto.parse_mode ? { parse_mode: dto.parse_mode } : {}),
    };

    return this.send({
      idempotency_key: dto.idempotency_key,
      trace_id: dto.trace_id,
      recipient_id: dto.recipient_id ?? dto.chat_id,
      channels: [NotificationChannel.TELEGRAM],
      destination: { telegram_chat_id: dto.chat_id },
      content: {
        title: dto.title,
        body: dto.message,
      },
      template_code: dto.template_code,
      metadata,
    });
  }

  async sendWhatsapp(dto: SendWhatsappDto): Promise<SendResult> {
    if (!dto.template_code && !dto.message) {
      throw new BadRequestException(
        'Either message or template_code must be provided for whatsapp',
      );
    }

    const metadata: Record<string, unknown> = {
      ...(dto.metadata ?? {}),
      ...(dto.template_data ?? {}),
      ...(dto.media_url ? { media_url: dto.media_url } : {}),
    };

    return this.send({
      idempotency_key: dto.idempotency_key,
      trace_id: dto.trace_id,
      recipient_id: dto.recipient_id ?? dto.phone_number,
      channels: [NotificationChannel.WHATSAPP],
      destination: { whatsapp_number: dto.phone_number },
      content: {
        body: dto.message,
      },
      template_code: dto.template_code,
      metadata,
    });
  }

  async sendSocket(dto: SendSocketDto): Promise<SendResult> {
    if (!dto.template_code && !dto.message && !dto.payload) {
      throw new BadRequestException(
        'Either message, payload, or template_code must be provided for socket',
      );
    }

    const metadata: Record<string, unknown> = {
      ...(dto.metadata ?? {}),
      ...(dto.template_data ?? {}),
      ...(dto.payload ? { socket_payload: dto.payload } : {}),
      ...(dto.event ? { event: dto.event } : {}),
    };

    return this.send({
      idempotency_key: dto.idempotency_key,
      trace_id: dto.trace_id,
      recipient_id: dto.recipient_id ?? dto.room,
      channels: [NotificationChannel.SOCKET_IO],
      destination: { socket_room: dto.room },
      content: {
        title: dto.title,
        body: dto.message ?? (dto.payload ? JSON.stringify(dto.payload) : ''),
      },
      template_code: dto.template_code,
      metadata,
    });
  }

  async getLogs(query: GetNotificationLogsDto) {
    if (!query?.start_date || !query?.end_date) {
      throw new BadRequestException('start_date and end_date are required');
    }

    const start = new Date(query.start_date);
    let end = new Date(query.end_date);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      throw new BadRequestException(
        'Invalid date format for start_date or end_date',
      );
    }

    if (/^\d{4}-\d{2}-\d{2}$/.test(query.end_date.trim())) {
      end = new Date(`${query.end_date.trim()}T23:59:59.999Z`);
    }

    if (start > end) {
      throw new BadRequestException(
        'start_date must be before or equal to end_date',
      );
    }

    if (query.notification_id) {
      await this.repository.findById(query.notification_id);
    }

    return this.repository.findDeliveryLogsPaginated({
      notificationId: query.notification_id,
      startDate: start,
      endDate: end,
      page: query.page,
      limit: query.limit,
      order: query.order,
      channel: query.channel,
      status: query.status,
    });
  }

  async listTemplates(channel?: NotificationChannel) {
    return this.templateService.listTemplates(channel);
  }

  async getTemplateDetails(code: string, channel?: NotificationChannel) {
    return this.templateService.getTemplateDetails(code, channel);
  }

  private buildRecipients(dto: SendNotificationDto): ResolvedRecipient[] {
    if (dto.recipients && dto.recipients.length > 0) {
      return dto.recipients.map((recipient) => ({
        recipientId: recipient.recipient_id,
        destination: recipient.destination ?? dto.destination ?? {},
      }));
    }

    if (dto.recipient_id) {
      return [
        {
          recipientId: dto.recipient_id,
          destination: dto.destination ?? {},
        },
      ];
    }

    throw new BadRequestException(
      'Either recipient_id or recipients must be provided',
    );
  }

  private async buildItems(
    dto: SendNotificationDto,
    recipients: ResolvedRecipient[],
    traceId: string,
    baseIdempotencyKey: string,
  ): Promise<CreateNotificationInput[]> {
    const items: CreateNotificationInput[] = [];

    for (const recipient of recipients) {
      for (const channel of dto.channels) {
        const recipientTarget = this.resolveTarget(
          channel,
          recipient.destination,
        );
        const { title, content } = await this.renderContent(
          dto,
          channel,
          recipient,
        );

        items.push({
          traceId,
          idempotencyKey: this.deriveIdempotencyKey(
            baseIdempotencyKey,
            recipients.length,
            dto.channels.length,
            channel,
            recipient.recipientId,
          ),
          domainId: dto.domain_id ?? null,
          channel,
          recipientId: recipient.recipientId,
          recipientTarget,
          templateCode: dto.template_code ?? null,
          title,
          content,
          payload: sanitize({
            metadata: dto.metadata ?? {},
            content: dto.content ?? {},
            destination: recipient.destination,
            domain_id: dto.domain_id,
          }) as Prisma.InputJsonValue,
        });
      }
    }

    return items;
  }

  private resolveTarget(
    channel: NotificationChannel,
    destination: NotificationDestinationDto,
  ): string {
    let target: string | undefined;
    switch (channel) {
      case NotificationChannel.SOCKET_IO:
        target = destination.socket_room;
        break;
      case NotificationChannel.TELEGRAM:
        target = destination.telegram_chat_id;
        break;
      case NotificationChannel.EMAIL:
        target = destination.email;
        break;
      case NotificationChannel.WHATSAPP:
        target = destination.whatsapp_number;
        break;
      default:
        target = undefined;
    }

    if (!target) {
      throw new BadRequestException(
        `Missing destination target for channel ${channel}`,
      );
    }

    return target;
  }

  private async renderContent(
    dto: SendNotificationDto,
    channel: NotificationChannel,
    recipient: ResolvedRecipient,
  ): Promise<{ title: string; content: string }> {
    const context: Record<string, unknown> = {
      ...(dto.metadata ?? {}),
      ...(dto.content ?? {}),
      recipient_id: recipient.recipientId,
    };

    if (dto.template_code) {
      const hasTemplate = await this.templateService.has(
        dto.template_code,
        channel,
        dto.domain_id,
      );
      if (!hasTemplate) {
        throw new BadRequestException(
          `Unknown template_code: ${dto.template_code}`,
        );
      }
      const rendered = await this.templateService.render(
        dto.template_code,
        channel,
        context,
        dto.domain_id,
      );
      return {
        title: rendered.title.slice(0, MAX_TITLE_LENGTH),
        content: rendered.body,
      };
    }

    const content = dto.content?.body;
    if (!content) {
      throw new BadRequestException(
        'content.body is required when template_code is not provided',
      );
    }

    return {
      title: (dto.content?.title ?? '').slice(0, MAX_TITLE_LENGTH),
      content,
    };
  }

  private deriveIdempotencyKey(
    base: string,
    recipientCount: number,
    channelCount: number,
    channel: NotificationChannel,
    recipientId: string,
  ): string {
    if (recipientCount === 1 && channelCount === 1) {
      return base.slice(0, MAX_IDEMPOTENCY_KEY_LENGTH);
    }
    return `${base}::${channel}::${recipientId}`.slice(
      0,
      MAX_IDEMPOTENCY_KEY_LENGTH,
    );
  }

  private async persist(
    input: CreateNotificationInput,
  ): Promise<{ notification: Notification; created: boolean }> {
    try {
      const notification = await this.repository.create(input);
      return { notification, created: true };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        this.logger.warn(
          `Idempotency key collision for ${input.idempotencyKey}; fetching existing notification`,
        );
        const existing = await this.repository.findByIdempotencyKey(
          input.idempotencyKey,
        );
        if (existing) {
          return { notification: existing, created: false };
        }
      }
      throw error;
    }
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DeliveryLogStatus, NotificationStatus } from '@prisma/client';
import { sanitize } from '../../common/utils/sanitizer.util.js';
import { MetricsService } from '../metrics/metrics.service.js';
import { NotificationsRepository } from './notifications.repository.js';
import { ChannelRegistry } from './channels/channel-registry.js';
import type { ChannelMessage } from './channels/notification-channel.interface.js';

export interface DispatchJob {
  notificationId: string;
  attempt: number;
  maxAttempts: number;
}

function toRecord(payload: Prisma.JsonValue): Record<string, unknown> {
  if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
    return payload;
  }
  return { value: payload };
}

function errorResponse(
  error: unknown,
  channel: string,
): Record<string, unknown> {
  if (error instanceof Error) {
    const code = (error as { code?: unknown }).code;
    return {
      channel,
      error: error.message,
      code: typeof code === 'string' ? code : 'ERROR',
    };
  }
  return { channel, error: String(error), code: 'ERROR' };
}

@Injectable()
export class NotificationsDispatcher {
  private readonly logger = new Logger(NotificationsDispatcher.name);

  constructor(
    private readonly repository: NotificationsRepository,
    private readonly channelRegistry: ChannelRegistry,
    private readonly metricsService: MetricsService,
  ) {}

  async dispatch(job: DispatchJob): Promise<void> {
    const notification = await this.repository.findById(job.notificationId);

    await this.repository.updateStatus(notification.id, {
      status: NotificationStatus.PROCESSING,
      retryCount: Math.max(job.attempt - 1, 0),
    });

    const adapter = this.channelRegistry.get(notification.channel);
    const message: ChannelMessage = {
      notificationId: notification.id,
      channel: notification.channel,
      recipientId: notification.recipientId,
      recipientTarget: notification.recipientTarget,
      title: notification.title,
      content: notification.content,
      payload: toRecord(notification.payload),
      templateCode: notification.templateCode,
      domainId: notification.domainId,
    };

    const start = performance.now();

    try {
      const result = await adapter.send(message);
      const latencyMs =
        result.latencyMs ?? Math.round(performance.now() - start);

      await this.repository.updateStatus(notification.id, {
        status: NotificationStatus.SENT,
        retryCount: Math.max(job.attempt - 1, 0),
      });
      await this.repository.createDeliveryLog({
        notificationId: notification.id,
        attempt: job.attempt,
        status: DeliveryLogStatus.SUCCESS,
        providerResponse: sanitize(result.response) as Prisma.InputJsonValue,
        latencyMs,
      });
      this.metricsService.recordDelivery(notification.channel, true);
      this.logger.log(
        `Notification ${notification.id} delivered via ${notification.channel} on attempt ${job.attempt}`,
      );
    } catch (error) {
      const latencyMs = Math.round(performance.now() - start);
      const isFinal = job.attempt >= job.maxAttempts;

      await this.repository.updateStatus(notification.id, {
        status: isFinal ? NotificationStatus.FAILED : NotificationStatus.RETRY,
        retryCount: job.attempt,
      });
      await this.repository.createDeliveryLog({
        notificationId: notification.id,
        attempt: job.attempt,
        status: DeliveryLogStatus.FAILED,
        providerResponse: sanitize(
          errorResponse(error, notification.channel),
        ) as Prisma.InputJsonValue,
        latencyMs,
      });
      this.metricsService.recordDelivery(notification.channel, false);
      this.logger.error(
        `Notification ${notification.id} failed via ${notification.channel} on attempt ${job.attempt}/${job.maxAttempts}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );

      throw error instanceof Error ? error : new Error(String(error));
    }
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { NotificationChannel as ChannelType } from '@prisma/client';
import {
  NotificationsGateway,
  NOTIFICATION_ROOM_EVENT,
} from '../gateway/notifications.gateway.js';
import type {
  ChannelMessage,
  ChannelSendResult,
  NotificationChannel,
} from './notification-channel.interface.js';

@Injectable()
export class SocketIoChannel implements NotificationChannel {
  readonly channel = ChannelType.SOCKET_IO;

  private readonly logger = new Logger(SocketIoChannel.name);

  constructor(private readonly gateway: NotificationsGateway) {}

  send(message: ChannelMessage): Promise<ChannelSendResult> {
    const start = performance.now();
    const payloadObj = message.payload as Record<string, unknown> | undefined;
    const metadataObj = payloadObj?.metadata as
      Record<string, unknown> | undefined;
    const customEvent =
      (typeof payloadObj?.event === 'string' ? payloadObj.event : undefined) ??
      (typeof metadataObj?.event === 'string' ? metadataObj.event : undefined);
    const eventName =
      customEvent && customEvent.trim().length > 0
        ? customEvent.trim()
        : NOTIFICATION_ROOM_EVENT;

    const customPayload =
      (payloadObj?.socket_payload as Record<string, unknown> | undefined) ??
      (metadataObj?.socket_payload as Record<string, unknown> | undefined) ??
      message.payload;

    const delivered = this.gateway.emitToRoom(
      message.recipientTarget,
      eventName,
      {
        notificationId: message.notificationId,
        title: message.title,
        content: message.content,
        payload: customPayload,
        timestamp: new Date().toISOString(),
      },
    );

    const latencyMs = Math.round(performance.now() - start);
    this.logger.log(
      `Socket.IO event ${eventName} emitted to room ${message.recipientTarget} (delivered=${delivered})`,
    );

    return Promise.resolve({
      ok: true,
      response: {
        room: message.recipientTarget,
        event: eventName,
        delivered,
      },
      latencyMs,
    });
  }
}

import { Injectable } from '@nestjs/common';
import { NotificationChannel as ChannelType } from '@prisma/client';
import { TelegramChannel } from './telegram.channel.js';
import { EmailChannel } from './email.channel.js';
import { SocketIoChannel } from './socket-io.channel.js';
import { WhatsappChannel } from './whatsapp.channel.js';
import type { NotificationChannel } from './notification-channel.interface.js';

@Injectable()
export class ChannelRegistry {
  private readonly channels = new Map<ChannelType, NotificationChannel>();

  constructor(
    telegram: TelegramChannel,
    email: EmailChannel,
    socketIo: SocketIoChannel,
    whatsapp: WhatsappChannel,
  ) {
    for (const adapter of [telegram, email, socketIo, whatsapp]) {
      this.channels.set(adapter.channel, adapter);
    }
  }

  get(channel: ChannelType): NotificationChannel {
    const adapter = this.channels.get(channel);
    if (!adapter) {
      throw new Error(`No adapter registered for channel ${channel}`);
    }
    return adapter;
  }
}

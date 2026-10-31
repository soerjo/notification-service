import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Telegraf } from 'telegraf';
import { NotificationChannel as ChannelType } from '@prisma/client';
import { PlatformConfigService } from './platform-config.service.js';
import type {
  ChannelMessage,
  ChannelSendResult,
  NotificationChannel,
} from './notification-channel.interface.js';

@Injectable()
export class TelegramChannel implements NotificationChannel {
  readonly channel = ChannelType.TELEGRAM;

  private readonly logger = new Logger(TelegramChannel.name);
  private defaultBot: Telegraf | null = null;

  constructor(
    private readonly configService: ConfigService,
    private readonly platformConfig: PlatformConfigService,
  ) {
    const token = this.configService.get<string>('TELEGRAM_BOT_TOKEN');
    this.defaultBot = token ? new Telegraf(token) : null;
  }

  async send(message: ChannelMessage): Promise<ChannelSendResult> {
    const bot = await this.resolveBot();
    if (!bot) {
      throw new Error(
        'Telegram channel is not configured. Provide TELEGRAM_BOT_TOKEN or configure notification_platforms in DB.',
      );
    }

    const payloadObj = message.payload as Record<string, unknown> | undefined;
    const metadataObj = payloadObj?.metadata as
      Record<string, unknown> | undefined;
    const parseMode =
      (typeof payloadObj?.parse_mode === 'string'
        ? payloadObj.parse_mode
        : undefined) ??
      (typeof metadataObj?.parse_mode === 'string'
        ? metadataObj.parse_mode
        : undefined) ??
      'HTML';

    const start = performance.now();
    const result = await bot.telegram.sendMessage(
      message.recipientTarget,
      message.content,
      { parse_mode: parseMode as 'HTML' | 'Markdown' | 'MarkdownV2' },
    );
    const latencyMs = Math.round(performance.now() - start);

    this.logger.log(
      `Telegram message sent to chat ${message.recipientTarget} (message_id=${result.message_id})`,
    );

    return {
      ok: true,
      response: {
        message_id: result.message_id,
        chat_id: message.recipientTarget,
      },
      latencyMs,
    };
  }

  private async resolveBot(): Promise<Telegraf | null> {
    const platform = await this.platformConfig.getActivePlatform(this.channel);
    const dbToken = platform?.config?.bot_token as string | undefined;

    if (dbToken) {
      return new Telegraf(dbToken);
    }

    return this.defaultBot;
  }
}

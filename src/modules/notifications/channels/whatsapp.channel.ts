import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NotificationChannel as ChannelType } from '@prisma/client';
import { PlatformConfigService } from './platform-config.service.js';
import type {
  ChannelMessage,
  ChannelSendResult,
  NotificationChannel,
} from './notification-channel.interface.js';

@Injectable()
export class WhatsappChannel implements NotificationChannel {
  readonly channel = ChannelType.WHATSAPP;

  private readonly logger = new Logger(WhatsappChannel.name);
  private readonly defaultAccountSid?: string;
  private readonly defaultAuthToken?: string;
  private readonly defaultFrom?: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly platformConfig: PlatformConfigService,
  ) {
    this.defaultAccountSid = configService.get<string>('TWILIO_ACCOUNT_SID');
    this.defaultAuthToken = configService.get<string>('TWILIO_AUTH_TOKEN');
    this.defaultFrom = configService.get<string>('TWILIO_WHATSAPP_FROM');
  }

  async send(message: ChannelMessage): Promise<ChannelSendResult> {
    const start = performance.now();
    const { accountSid, authToken, fromNumber } =
      await this.resolveCredentials();

    if (!accountSid || !authToken) {
      throw new Error(
        'WhatsApp channel (Twilio) is not configured. Missing TWILIO_ACCOUNT_SID/TWILIO_AUTH_TOKEN in env or notification_platforms in DB.',
      );
    }

    if (!fromNumber) {
      throw new Error(
        'WhatsApp channel (Twilio) is missing sender number (TWILIO_WHATSAPP_FROM in env or from in DB platform config).',
      );
    }

    // Format destination e.g. "whatsapp:+628123456789"
    const formattedTo = message.recipientTarget.startsWith('whatsapp:')
      ? message.recipientTarget
      : `whatsapp:${message.recipientTarget.replace(/[^\d+]/g, '')}`;

    const formattedFrom = fromNumber.startsWith('whatsapp:')
      ? fromNumber
      : `whatsapp:${fromNumber}`;

    const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
    const params = new URLSearchParams();
    params.append('To', formattedTo);
    params.append('From', formattedFrom);
    params.append('Body', message.content);

    const payloadObj = message.payload as Record<string, unknown> | undefined;
    const metadataObj = payloadObj?.metadata as
      Record<string, unknown> | undefined;
    const mediaUrl =
      (typeof payloadObj?.media_url === 'string'
        ? payloadObj.media_url
        : undefined) ??
      (typeof metadataObj?.media_url === 'string'
        ? metadataObj.media_url
        : undefined);

    if (mediaUrl) {
      params.append('MediaUrl', mediaUrl);
    }
    const authHeader = `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    const data = (await response.json()) as Record<string, unknown>;
    const latencyMs = Math.round(performance.now() - start);

    if (!response.ok) {
      this.logger.error(
        `Failed to send WhatsApp message to ${formattedTo}: ${JSON.stringify(data)}`,
      );
      const errorMessage =
        typeof data.message === 'string' ? data.message : 'Unknown error';
      throw new Error(
        `Twilio WhatsApp send failed with status ${response.status}: ${errorMessage}`,
      );
    }

    const sid = typeof data.sid === 'string' ? data.sid : '';
    this.logger.log(
      `WhatsApp message sent via Twilio to ${formattedTo} (sid=${sid})`,
    );

    return {
      ok: true,
      response: {
        sid: data.sid,
        status: data.status,
        to: data.to,
      },
      latencyMs,
    };
  }

  private async resolveCredentials(): Promise<{
    accountSid?: string;
    authToken?: string;
    fromNumber?: string;
  }> {
    const platform = await this.platformConfig.getActivePlatform(this.channel);
    const cfg = platform?.config;

    const accountSid =
      (cfg?.account_sid as string | undefined) ??
      (cfg?.accountSid as string | undefined) ??
      this.defaultAccountSid;

    const authToken =
      (cfg?.auth_token as string | undefined) ??
      (cfg?.authToken as string | undefined) ??
      this.defaultAuthToken;

    const fromNumber =
      (cfg?.from as string | undefined) ??
      (cfg?.whatsapp_from as string | undefined) ??
      this.defaultFrom;

    return { accountSid, authToken, fromNumber };
  }
}

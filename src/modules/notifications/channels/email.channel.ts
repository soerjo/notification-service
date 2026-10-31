import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { NotificationChannel as ChannelType } from '@prisma/client';
import { TemplateService } from '../templates/template.service.js';
import { PlatformConfigService } from './platform-config.service.js';
import type {
  ChannelMessage,
  ChannelSendResult,
  NotificationChannel,
} from './notification-channel.interface.js';

@Injectable()
export class EmailChannel implements NotificationChannel {
  readonly channel = ChannelType.EMAIL;

  private readonly logger = new Logger(EmailChannel.name);
  private readonly defaultTransporter: Transporter | null;
  private readonly defaultFrom: string;
  private readonly transporterPool = new Map<string, Transporter>();

  constructor(
    private readonly configService: ConfigService,
    private readonly templateService: TemplateService,
    private readonly platformConfig: PlatformConfigService,
  ) {
    const host = configService.get<string>('SMTP_HOST');
    const port = Number(configService.get<string>('SMTP_PORT') ?? 587);
    const user = configService.get<string>('SMTP_USER');
    const pass = configService.get<string>('SMTP_PASS');
    this.defaultFrom =
      configService.get<string>('SMTP_FROM') ?? 'notifications@localhost';

    this.defaultTransporter = host
      ? nodemailer.createTransport({
          host,
          port,
          secure: port === 465,
          auth: user ? { user, pass } : undefined,
        })
      : null;
  }

  async send(message: ChannelMessage): Promise<ChannelSendResult> {
    const payloadObj = message.payload as Record<string, unknown> | undefined;
    const metadataObj = payloadObj?.metadata as
      Record<string, unknown> | undefined;
    const contentObj = payloadObj?.content as
      Record<string, unknown> | undefined;

    const candidates = [
      payloadObj?.domain_id,
      payloadObj?.domainId,
      metadataObj?.domain_id,
      metadataObj?.domainId,
      message.domainId,
      message.domain_id,
    ];
    let domainId: string | undefined;
    for (const candidate of candidates) {
      if (typeof candidate === 'string' && candidate.trim().length > 0) {
        domainId = candidate.trim();
        break;
      }
    }
    const { transporter, from } = await this.resolveTransporter(domainId);
    if (!transporter) {
      throw new Error(
        'Email channel is not configured. Provide SMTP env vars or configure notification_platforms in DB.',
      );
    }
    const customHtml =
      (typeof payloadObj?.html === 'string' ? payloadObj.html : undefined) ??
      (typeof metadataObj?.html === 'string' ? metadataObj.html : undefined);
    const cc = payloadObj?.cc ?? metadataObj?.cc;
    const bcc = payloadObj?.bcc ?? metadataObj?.bcc;
    const replyTo =
      (typeof payloadObj?.reply_to === 'string'
        ? payloadObj.reply_to
        : undefined) ??
      (typeof metadataObj?.reply_to === 'string'
        ? metadataObj.reply_to
        : undefined);

    const templateContext: Record<string, unknown> = {
      ...(metadataObj ?? {}),
      ...(contentObj ?? {}),
      ...(payloadObj ?? {}),
      recipient_id: message.recipientId,
      recipient_target: message.recipientTarget,
    };

    let html = customHtml ?? message.content;
    if (message.templateCode) {
      const hasTemplate = await this.templateService.has(
        message.templateCode,
        this.channel,
        domainId,
      );
      if (hasTemplate) {
        html = await this.templateService.renderBody(
          message.templateCode,
          this.channel,
          templateContext,
          domainId,
        );
      }
    }

    const start = performance.now();
    const info = await transporter.sendMail({
      from,
      to: message.recipientTarget,
      subject: message.title,
      html,
      text: message.content,
      ...(cc ? { cc } : {}),
      ...(bcc ? { bcc } : {}),
      ...(replyTo ? { replyTo } : {}),
    });
    const latencyMs = Math.round(performance.now() - start);

    this.logger.log(
      `Email sent to ${message.recipientTarget} (messageId=${info.messageId})`,
    );

    return {
      ok: true,
      response: {
        messageId: info.messageId,
        accepted: info.accepted,
        rejected: info.rejected,
      },
      latencyMs,
    };
  }

  private async resolveTransporter(domainId?: string): Promise<{
    transporter: Transporter | null;
    from: string;
  }> {
    const platform = await this.platformConfig.getActivePlatform(
      this.channel,
      domainId,
    );
    const cfg = platform?.config;

    if (cfg?.host) {
      const host = (cfg.host as string) ?? '';
      const port = Number(cfg.port ?? 587);
      const user = (cfg.user as string) ?? '';
      const pass = (cfg.pass as string) ?? '';
      const poolKey = `${host}:${port}:${user}`;
      let transporter = this.transporterPool.get(poolKey);

      if (!transporter) {
        transporter = nodemailer.createTransport({
          host,
          port,
          secure: port === 465 || cfg.secure === true,
          auth: user ? { user, pass } : undefined,
        });
        this.transporterPool.set(poolKey, transporter);
      }

      return {
        transporter,
        from: typeof cfg.from === 'string' ? cfg.from : this.defaultFrom,
      };
    }

    return {
      transporter: this.defaultTransporter,
      from: this.defaultFrom,
    };
  }
}

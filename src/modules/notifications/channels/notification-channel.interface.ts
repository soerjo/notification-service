import type { NotificationChannel as ChannelType } from '@prisma/client';

export interface ChannelMessage {
  notificationId: string;
  channel: ChannelType;
  recipientId: string;
  recipientTarget: string;
  title: string;
  content: string;
  payload: Record<string, unknown>;
  templateCode: string | null;
  domainId?: string | null;
  domain_id?: string | null;
}

export interface ChannelSendResult {
  ok: boolean;
  response: Record<string, unknown>;
  latencyMs: number;
}

export interface NotificationChannel {
  readonly channel: ChannelType;
  send(message: ChannelMessage): Promise<ChannelSendResult>;
}

export class ChannelNotImplementedError extends Error {
  readonly code = 'NOT_IMPLEMENTED';

  constructor(channel: ChannelType) {
    super(`Channel ${channel} is not implemented yet`);
    this.name = 'ChannelNotImplementedError';
  }
}

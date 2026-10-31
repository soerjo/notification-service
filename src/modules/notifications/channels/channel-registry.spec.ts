import { NotificationChannel } from '@prisma/client';
import { ChannelRegistry } from './channel-registry.js';
import { WhatsappChannel } from './whatsapp.channel.js';
import { SocketIoChannel } from './socket-io.channel.js';
import { NOTIFICATION_ROOM_EVENT } from '../gateway/notifications.gateway.js';
import type { NotificationChannel as Channel } from './notification-channel.interface.js';

function stub(channel: NotificationChannel): Channel {
  return {
    channel,
    send: () =>
      Promise.resolve({ ok: true, response: { stub: true }, latencyMs: 0 }),
  };
}

function buildRegistry(): ChannelRegistry {
  return new ChannelRegistry(
    stub(NotificationChannel.TELEGRAM) as never,
    stub(NotificationChannel.EMAIL) as never,
    stub(NotificationChannel.SOCKET_IO) as never,
    stub(NotificationChannel.WHATSAPP) as never,
  );
}

describe('ChannelRegistry', () => {
  it('resolves every registered adapter', () => {
    const registry = buildRegistry();

    expect(registry.get(NotificationChannel.TELEGRAM).channel).toBe(
      NotificationChannel.TELEGRAM,
    );
    expect(registry.get(NotificationChannel.EMAIL).channel).toBe(
      NotificationChannel.EMAIL,
    );
    expect(registry.get(NotificationChannel.SOCKET_IO).channel).toBe(
      NotificationChannel.SOCKET_IO,
    );
    expect(registry.get(NotificationChannel.WHATSAPP).channel).toBe(
      NotificationChannel.WHATSAPP,
    );
  });

  it('throws when no adapter is registered for a channel', () => {
    const registry = buildRegistry();
    (
      registry as unknown as { channels: Map<NotificationChannel, Channel> }
    ).channels.clear();

    expect(() => registry.get(NotificationChannel.TELEGRAM)).toThrow(
      'No adapter registered',
    );
  });
});

describe('WhatsApp channel unconfigured', () => {
  const message = {
    notificationId: 'n1',
    channel: NotificationChannel.WHATSAPP,
    recipientId: 'u1',
    recipientTarget: '+628123456789',
    title: 'Verification',
    content: 'Your OTP is 1234',
    payload: {},
    templateCode: null,
  };

  it('WhatsApp throws error when Twilio credentials missing', async () => {
    const mockConfigService = {
      get: jest.fn().mockReturnValue(undefined),
    };
    const mockPlatformConfig = {
      getActivePlatform: jest.fn().mockResolvedValue(null),
    };
    const channel = new WhatsappChannel(
      mockConfigService as never,
      mockPlatformConfig as never,
    );

    await expect(channel.send(message)).rejects.toThrow(
      'WhatsApp channel (Twilio) is not configured',
    );
  });
});

describe('SocketIoChannel', () => {
  it('emits with custom event name and custom payload when provided', async () => {
    const mockGateway = {
      emitToRoom: jest.fn().mockReturnValue(true),
    };
    const channel = new SocketIoChannel(mockGateway as never);

    const result = await channel.send({
      notificationId: 'notif-1',
      channel: NotificationChannel.SOCKET_IO,
      recipientId: 'u1',
      recipientTarget: 'room_usr_1',
      title: 'Order Status',
      content: 'Shipped',
      payload: {
        event: 'order_update',
        socket_payload: { order_id: 123, status: 'SHIPPED' },
      },
      templateCode: null,
    });

    expect(result.ok).toBe(true);
    expect(result.response.event).toBe('order_update');
    expect(mockGateway.emitToRoom).toHaveBeenCalledWith(
      'room_usr_1',
      'order_update',
      expect.objectContaining({
        notificationId: 'notif-1',
        title: 'Order Status',
        content: 'Shipped',
        payload: { order_id: 123, status: 'SHIPPED' },
      }),
    );
  });

  it('falls back to default NOTIFICATION_ROOM_EVENT when event is omitted', async () => {
    const mockGateway = {
      emitToRoom: jest.fn().mockReturnValue(true),
    };
    const channel = new SocketIoChannel(mockGateway as never);

    const result = await channel.send({
      notificationId: 'notif-2',
      channel: NotificationChannel.SOCKET_IO,
      recipientId: 'u2',
      recipientTarget: 'room_usr_2',
      title: 'Notice',
      content: 'Hello',
      payload: {},
      templateCode: null,
    });

    expect(result.ok).toBe(true);
    expect(result.response.event).toBe(NOTIFICATION_ROOM_EVENT);
    expect(mockGateway.emitToRoom).toHaveBeenCalledWith(
      'room_usr_2',
      NOTIFICATION_ROOM_EVENT,
      expect.any(Object),
    );
  });
});

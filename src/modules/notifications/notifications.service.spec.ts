import { BadRequestException } from '@nestjs/common';
import {
  NotificationChannel,
  NotificationStatus,
  Prisma,
} from '@prisma/client';
import { NotificationsService } from './notifications.service.js';
import { MASKED_VALUE } from '../../common/utils/sanitizer.util.js';
import type { NotificationsRepository } from './notifications.repository.js';
import type { TemplateService } from './templates/template.service.js';
import type { NotificationsQueueService } from './notifications.queue.js';
import type { PlatformConfigService } from './channels/platform-config.service.js';
import type { SendNotificationDto } from './dto/send-notification.dto.js';

interface CreateNotificationInput {
  channel: NotificationChannel;
  recipientTarget: string;
  status?: NotificationStatus;
  title?: string;
  content: string;
  payload: { metadata: Record<string, unknown> };
  idempotencyKey: string;
  templateCode?: string | null;
}

interface Mocks {
  repository: {
    findByIdempotencyKey: jest.Mock;
    findByBaseIdempotencyKey: jest.Mock;
    create: jest.Mock<Promise<{ id: string }>, [CreateNotificationInput]>;
    findById: jest.Mock;
    findDeliveryLogs: jest.Mock;
    findDeliveryLogsPaginated: jest.Mock;
  };
  templateService: {
    has: jest.Mock;
    render: jest.Mock;
    listTemplates: jest.Mock;
    getTemplateDetails: jest.Mock;
    createOrUpdateTemplate: jest.Mock;
  };
  queue: { enqueue: jest.Mock };
  platformConfigService: {
    createOrUpdatePlatform: jest.Mock;
    listPlatforms: jest.Mock;
  };
}

function buildService(): { service: NotificationsService; mocks: Mocks } {
  const mocks: Mocks = {
    repository: {
      findByIdempotencyKey: jest.fn(),
      findByBaseIdempotencyKey: jest.fn().mockResolvedValue([]),
      create: jest.fn<Promise<{ id: string }>, [CreateNotificationInput]>(),
      findById: jest.fn(),
      findDeliveryLogs: jest.fn(),
      findDeliveryLogsPaginated: jest.fn(),
    },
    templateService: {
      has: jest.fn().mockResolvedValue(true),
      render: jest.fn().mockResolvedValue({ title: 'T', body: 'B' }),
      listTemplates: jest.fn().mockResolvedValue([]),
      getTemplateDetails: jest.fn().mockResolvedValue({}),
      createOrUpdateTemplate: jest.fn().mockResolvedValue({}),
    },
    queue: { enqueue: jest.fn().mockResolvedValue(undefined) },
    platformConfigService: {
      createOrUpdatePlatform: jest.fn().mockResolvedValue({}),
      listPlatforms: jest.fn().mockResolvedValue([]),
    },
  };

  const service = new NotificationsService(
    mocks.repository as unknown as NotificationsRepository,
    mocks.templateService as unknown as TemplateService,
    mocks.queue as unknown as NotificationsQueueService,
    mocks.platformConfigService as unknown as PlatformConfigService,
  );

  return { service, mocks };
}

function baseDto(
  overrides: Partial<SendNotificationDto> = {},
): SendNotificationDto {
  return {
    idempotency_key: 'req-1',
    recipient_id: 'usr_1',
    channels: [NotificationChannel.SOCKET_IO],
    destination: { socket_room: 'room_usr_1' },
    content: { title: 'Hi', body: 'Hello' },
    ...overrides,
  };
}

describe('NotificationsService', () => {
  it('persists and enqueues a new notification', async () => {
    const { service, mocks } = buildService();
    mocks.repository.findByIdempotencyKey.mockResolvedValue(null);
    mocks.repository.create.mockResolvedValue({ id: 'n1' });

    const result = await service.send(baseDto());

    expect(result.notificationIds).toEqual(['n1']);
    expect(result.idempotent).toBe(false);
    expect(result.traceId).toBeDefined();
    expect(mocks.queue.enqueue).toHaveBeenCalledWith('n1');

    const created = mocks.repository.create.mock.calls[0][0] as {
      channel: string;
      recipientTarget: string;
      status?: string;
    };
    expect(created.channel).toBe(NotificationChannel.SOCKET_IO);
    expect(created.recipientTarget).toBe('room_usr_1');
  });

  it('returns the existing notification on an idempotency conflict', async () => {
    const { service, mocks } = buildService();
    mocks.repository.findByBaseIdempotencyKey.mockResolvedValue([
      { id: 'existing', traceId: 'trace-existing' },
    ]);

    const result = await service.send(baseDto());

    expect(result.notificationIds).toEqual(['existing']);
    expect(result.idempotent).toBe(true);
    expect(mocks.repository.create).not.toHaveBeenCalled();
    expect(mocks.queue.enqueue).not.toHaveBeenCalled();
  });

  it('returns all existing rows for a duplicate key even when the fan-out shape changed', async () => {
    const { service, mocks } = buildService();
    mocks.repository.findByBaseIdempotencyKey.mockResolvedValue([
      { id: 'existing-socket', traceId: 'original-trace' },
      { id: 'existing-email', traceId: 'original-trace' },
    ]);

    const result = await service.send(
      baseDto({
        idempotency_key: 'req-1',
        channels: [NotificationChannel.SOCKET_IO],
      }),
    );

    expect(mocks.repository.findByBaseIdempotencyKey).toHaveBeenCalledWith(
      'req-1',
    );
    expect(result.notificationIds).toEqual([
      'existing-socket',
      'existing-email',
    ]);
    expect(result.traceId).toBe('original-trace');
    expect(result.idempotent).toBe(true);
    expect(mocks.repository.create).not.toHaveBeenCalled();
    expect(mocks.queue.enqueue).not.toHaveBeenCalled();
  });

  it('resolves a concurrent insert race via the unique constraint', async () => {
    const { service, mocks } = buildService();
    mocks.repository.findByBaseIdempotencyKey.mockResolvedValue([]);
    mocks.repository.findByIdempotencyKey.mockResolvedValue({ id: 'raced' });
    const prismaError = new Prisma.PrismaClientKnownRequestError(
      'Unique constraint failed',
      {
        code: 'P2002',
        clientVersion: '6.19.3',
      },
    );
    mocks.repository.create.mockRejectedValue(prismaError);

    const result = await service.send(baseDto());

    expect(result.notificationIds).toEqual(['raced']);
    expect(result.idempotent).toBe(true);
    expect(mocks.queue.enqueue).not.toHaveBeenCalled();
  });

  it('rethrows unexpected persistence errors', async () => {
    const { service, mocks } = buildService();
    mocks.repository.findByIdempotencyKey.mockResolvedValue(null);
    mocks.repository.create.mockRejectedValue(new Error('db down'));

    await expect(service.send(baseDto())).rejects.toThrow('db down');
  });

  it('requires a recipient', async () => {
    const { service } = buildService();
    await expect(
      service.send(baseDto({ recipient_id: undefined })),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('requires a destination matching each channel', async () => {
    const { service } = buildService();
    await expect(
      service.send(baseDto({ channels: [NotificationChannel.EMAIL] })),
    ).rejects.toThrow('Missing destination target for channel EMAIL');
  });

  it('masks sensitive fields in the stored payload', async () => {
    const { service, mocks } = buildService();
    mocks.repository.findByIdempotencyKey.mockResolvedValue(null);
    mocks.repository.create.mockResolvedValue({ id: 'n1' });

    await service.send(
      baseDto({
        metadata: {
          token: 'super-secret',
          otp_code: '123456',
          public_info: 'safe',
        },
      }),
    );

    const created = mocks.repository.create.mock.calls[0][0] as {
      payload: { metadata: Record<string, unknown> };
    };
    expect(created.payload.metadata.token).toBe(MASKED_VALUE);
    expect(created.payload.metadata.otp_code).toBe(MASKED_VALUE);
    expect(created.payload.metadata.public_info).toBe('safe');
  });

  it('fans out multicast notifications', async () => {
    const { service, mocks } = buildService();
    mocks.repository.findByIdempotencyKey.mockResolvedValue(null);
    mocks.repository.create
      .mockResolvedValueOnce({ id: 'n1' })
      .mockResolvedValueOnce({ id: 'n2' });

    const result = await service.send(
      baseDto({
        recipient_id: undefined,
        recipients: [
          {
            recipient_id: 'u1',
            destination: { socket_room: 'r1' },
          },
          {
            recipient_id: 'u2',
            destination: { socket_room: 'r2' },
          },
        ],
      }),
    );

    expect(result.notificationIds).toEqual(['n1', 'n2']);
    expect(mocks.repository.create).toHaveBeenCalledTimes(2);
    expect(mocks.queue.enqueue).toHaveBeenCalledTimes(2);
  });

  describe('channel-specific methods', () => {
    it('sendEmail dispatches email with custom payload attributes', async () => {
      const { service, mocks } = buildService();
      mocks.repository.create.mockResolvedValueOnce({ id: 'email-1' });

      const result = await service.sendEmail({
        idempotency_key: 'email-key-1',
        to: 'user@example.com',
        subject: 'Welcome!',
        body: 'Welcome to our service',
        html: '<h1>Welcome to our service</h1>',
        cc: 'manager@example.com',
        bcc: 'audit@example.com',
        reply_to: 'support@example.com',
      });

      expect(result.notificationIds).toEqual(['email-1']);
      expect(mocks.repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          channel: NotificationChannel.EMAIL,
          recipientTarget: 'user@example.com',
          title: 'Welcome!',
          content: 'Welcome to our service',
        }),
      );
    });

    it('sendEmail forwards domain_id to send', async () => {
      const { service, mocks } = buildService();
      mocks.repository.create.mockResolvedValueOnce({ id: 'email-domain-1' });

      const result = await service.sendEmail({
        idempotency_key: 'email-key-domain',
        to: 'user@example.com',
        subject: 'Hello Domain',
        body: 'Email body',
        domain_id: 'pos.soerjo.id',
      });

      expect(result.notificationIds).toEqual(['email-domain-1']);
      expect(mocks.repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          domainId: 'pos.soerjo.id',
          channel: NotificationChannel.EMAIL,
        }),
      );
    });

    it('sendEmail renders template from template_code and template_data', async () => {
      const { service, mocks } = buildService();
      mocks.repository.create.mockResolvedValueOnce({ id: 'email-tpl-1' });
      mocks.templateService.has.mockResolvedValueOnce(true);
      mocks.templateService.render.mockResolvedValueOnce({
        title: 'Please verify your email address',
        body: '<p>Click here to verify</p>',
      });

      const result = await service.sendEmail({
        idempotency_key: 'email-key-tpl',
        to: 'user@example.com',
        template_code: 'verification-email',
        template_data: {
          user_name: 'Alex',
          verification_url: 'https://example.com/verify',
        },
      });

      expect(result.notificationIds).toEqual(['email-tpl-1']);
      expect(mocks.templateService.render).toHaveBeenCalledWith(
        'verification-email',
        NotificationChannel.EMAIL,
        expect.objectContaining({
          user_name: 'Alex',
          verification_url: 'https://example.com/verify',
        }),
        undefined,
      );
      expect(mocks.repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          channel: NotificationChannel.EMAIL,
          recipientTarget: 'user@example.com',
          title: 'Please verify your email address',
          content: '<p>Click here to verify</p>',
        }),
      );
    });

    it('sendEmail throws error if body/html and template_code are missing', async () => {
      const { service } = buildService();

      await expect(
        service.sendEmail({
          idempotency_key: 'email-key-2',
          to: 'user@example.com',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('sendTelegram dispatches telegram with custom parse_mode', async () => {
      const { service, mocks } = buildService();
      mocks.repository.create.mockResolvedValueOnce({ id: 'tg-1' });

      const result = await service.sendTelegram({
        idempotency_key: 'tg-key-1',
        chat_id: '123456789',
        message: 'Order #123 confirmed',
        parse_mode: 'HTML',
      });

      expect(result.notificationIds).toEqual(['tg-1']);
      expect(mocks.repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          channel: NotificationChannel.TELEGRAM,
          recipientTarget: '123456789',
          content: 'Order #123 confirmed',
        }),
      );
    });

    it('sendTelegram throws error if message and template_code are missing', async () => {
      const { service } = buildService();

      await expect(
        service.sendTelegram({
          idempotency_key: 'tg-key-2',
          chat_id: '123456789',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('sendWhatsapp dispatches whatsapp with custom media_url', async () => {
      const { service, mocks } = buildService();
      mocks.repository.create.mockResolvedValueOnce({ id: 'wa-1' });

      const result = await service.sendWhatsapp({
        idempotency_key: 'wa-key-1',
        phone_number: '+628123456789',
        message: 'Your OTP is 123456',
        media_url: 'https://example.com/receipt.pdf',
      });

      expect(result.notificationIds).toEqual(['wa-1']);
      expect(mocks.repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          channel: NotificationChannel.WHATSAPP,
          recipientTarget: '+628123456789',
          content: 'Your OTP is 123456',
        }),
      );
    });

    it('sendWhatsapp throws error if message and template_code are missing', async () => {
      const { service } = buildService();

      await expect(
        service.sendWhatsapp({
          idempotency_key: 'wa-key-2',
          phone_number: '+628123456789',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('sendSocket dispatches socket event with custom room, event, and payload', async () => {
      const { service, mocks } = buildService();
      mocks.repository.create.mockResolvedValueOnce({ id: 'sock-1' });

      const result = await service.sendSocket({
        idempotency_key: 'sock-key-1',
        room: 'room_usr_1',
        event: 'order_status',
        title: 'Status Update',
        message: 'Order shipped',
        payload: { order_id: 123, status: 'SHIPPED' },
      });

      expect(result.notificationIds).toEqual(['sock-1']);
      expect(mocks.repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          channel: NotificationChannel.SOCKET_IO,
          recipientTarget: 'room_usr_1',
          title: 'Status Update',
          content: 'Order shipped',
        }),
      );
    });

    it('sendSocket throws error if message, payload, and template_code are missing', async () => {
      const { service } = buildService();

      await expect(
        service.sendSocket({
          idempotency_key: 'sock-key-2',
          room: 'room_usr_1',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getLogs', () => {
    it('throws BadRequestException if start_date or end_date is missing', async () => {
      const { service } = buildService();

      await expect(service.getLogs({} as never)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws BadRequestException if date format is invalid', async () => {
      const { service } = buildService();

      await expect(
        service.getLogs({
          start_date: 'invalid-date',
          end_date: '2026-10-25',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException if start_date is after end_date', async () => {
      const { service } = buildService();

      await expect(
        service.getLogs({
          start_date: '2026-10-25T00:00:00.000Z',
          end_date: '2026-10-01T00:00:00.000Z',
        }),
      ).rejects.toThrow('start_date must be before or equal to end_date');
    });

    it('queries repository across all notifications when notification_id is omitted', async () => {
      const { service, mocks } = buildService();
      const mockPaginated = {
        items: [
          {
            id: '1',
            notificationId: 'notif-1',
            attempt: 1,
            status: 'SUCCESS',
            providerResponse: {},
            latencyMs: 50,
            createdAt: new Date(),
          },
        ],
        meta: {
          total: 1,
          page: 1,
          limit: 10,
          total_pages: 1,
          has_next: false,
          has_prev: false,
        },
      };
      mocks.repository.findDeliveryLogsPaginated.mockResolvedValueOnce(
        mockPaginated,
      );

      const result = await service.getLogs({
        start_date: '2026-10-01',
        end_date: '2026-10-25',
        page: 2,
        limit: 5,
      });

      expect(mocks.repository.findById).not.toHaveBeenCalled();
      expect(mocks.repository.findDeliveryLogsPaginated).toHaveBeenCalledWith(
        expect.objectContaining({
          notificationId: undefined,
          page: 2,
          limit: 5,
        }),
      );
      expect(result).toEqual(mockPaginated);
    });

    it('verifies notification existence when notification_id is provided', async () => {
      const { service, mocks } = buildService();
      mocks.repository.findById.mockResolvedValueOnce({ id: 'notif-1' });
      mocks.repository.findDeliveryLogsPaginated.mockResolvedValueOnce({
        items: [],
        meta: {
          total: 0,
          page: 1,
          limit: 10,
          total_pages: 0,
          has_next: false,
          has_prev: false,
        },
      });

      await service.getLogs({
        notification_id: 'notif-1',
        start_date: '2026-10-01',
        end_date: '2026-10-25',
      });

      expect(mocks.repository.findById).toHaveBeenCalledWith('notif-1');
      expect(mocks.repository.findDeliveryLogsPaginated).toHaveBeenCalledWith(
        expect.objectContaining({
          notificationId: 'notif-1',
        }),
      );
    });
  });

  describe('platform & template admin methods', () => {
    it('createOrUpdatePlatform delegates to platformConfigService', async () => {
      const { service, mocks } = buildService();
      const dto = {
        channel: NotificationChannel.EMAIL,
        name: 'hostinger-smtp',
        config: { host: 'smtp.hostinger.com', port: 465, pass: 'secret' },
        domain_id: 'pos.soerjo.id',
      };
      const expected = { id: 'plat-1', ...dto };
      mocks.platformConfigService.createOrUpdatePlatform.mockResolvedValueOnce(
        expected,
      );

      const result = await service.createOrUpdatePlatform(dto);
      expect(
        mocks.platformConfigService.createOrUpdatePlatform,
      ).toHaveBeenCalledWith(dto);
      expect(result).toEqual(expected);
    });

    it('listPlatforms delegates to platformConfigService', async () => {
      const { service, mocks } = buildService();
      const filter = {
        domain_id: 'pos.soerjo.id',
        channel: NotificationChannel.EMAIL,
      };
      const expected = [{ id: 'plat-1' }];
      mocks.platformConfigService.listPlatforms.mockResolvedValueOnce(expected);

      const result = await service.listPlatforms(filter);
      expect(mocks.platformConfigService.listPlatforms).toHaveBeenCalledWith(
        filter,
      );
      expect(result).toEqual(expected);
    });

    it('createOrUpdateTemplate delegates to templateService', async () => {
      const { service, mocks } = buildService();
      const dto = {
        domain_id: 'pos.soerjo.id',
        code: 'order_receipt',
        channel: NotificationChannel.EMAIL,
        name: 'Order Receipt',
        body: '<p>Order {{id}}</p>',
      };
      const expected = { id: 'tpl-1', ...dto };
      mocks.templateService.createOrUpdateTemplate.mockResolvedValueOnce(
        expected,
      );

      const result: unknown = await service.createOrUpdateTemplate(dto);
      expect(mocks.templateService.createOrUpdateTemplate).toHaveBeenCalledWith(
        dto,
      );
      expect(result).toEqual(expected);
    });

    it('listTemplates delegates to templateService without domainId', async () => {
      const { service, mocks } = buildService();
      const expected = [{ code: 'tpl-1' }];
      mocks.templateService.listTemplates.mockResolvedValueOnce(expected);

      const result = await service.listTemplates(NotificationChannel.EMAIL);
      expect(mocks.templateService.listTemplates).toHaveBeenCalledWith(
        NotificationChannel.EMAIL,
      );
      expect(result).toEqual(expected);
    });

    it('listTemplates delegates to templateService with domainId', async () => {
      const { service, mocks } = buildService();
      const expected = [{ code: 'tpl-domain-1' }];
      mocks.templateService.listTemplates.mockResolvedValueOnce(expected);

      const result = await service.listTemplates(
        NotificationChannel.EMAIL,
        'pos.soerjo.id',
      );
      expect(mocks.templateService.listTemplates).toHaveBeenCalledWith(
        NotificationChannel.EMAIL,
        'pos.soerjo.id',
      );
      expect(result).toEqual(expected);
    });

    it('getTemplateDetails delegates to templateService', async () => {
      const { service, mocks } = buildService();
      const expected = { code: 'tpl-1', parameters: [] };
      mocks.templateService.getTemplateDetails.mockResolvedValueOnce(expected);

      const result = await service.getTemplateDetails(
        'tpl-1',
        NotificationChannel.EMAIL,
      );
      expect(mocks.templateService.getTemplateDetails).toHaveBeenCalledWith(
        'tpl-1',
        NotificationChannel.EMAIL,
      );
      expect(result).toEqual(expected);
    });
  });
});

import { NotificationChannel } from '@prisma/client';
import nodemailer from 'nodemailer';
import { EmailChannel } from './email.channel.js';
import type { ChannelMessage } from './notification-channel.interface.js';

const mockSendMail = jest.fn();

jest.mock('nodemailer', () => ({
  __esModule: true,
  default: {
    createTransport: jest.fn(() => ({
      sendMail: mockSendMail,
    })),
  },
}));

describe('EmailChannel', () => {
  const mockConfigService = {
    get: jest.fn((key: string) => {
      switch (key) {
        case 'SMTP_HOST':
          return 'smtp.global.com';
        case 'SMTP_PORT':
          return '587';
        case 'SMTP_USER':
          return 'global_user';
        case 'SMTP_PASS':
          return 'global_pass';
        case 'SMTP_FROM':
          return 'global@example.com';
        default:
          return undefined;
      }
    }),
  };

  const mockTemplateService = {
    has: jest.fn(),
    renderBody: jest.fn(),
  };

  const mockPlatformConfig = {
    getActivePlatform: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockSendMail.mockResolvedValue({
      messageId: 'msg-12345',
      accepted: ['user@example.com'],
      rejected: [],
    });
    mockPlatformConfig.getActivePlatform.mockResolvedValue(null);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  function createChannel(config = mockConfigService): EmailChannel {
    return new EmailChannel(
      config as never,
      mockTemplateService as never,
      mockPlatformConfig as never,
    );
  }

  describe('domain-scoped template rendering', () => {
    it('passes domainId to templateService.has and renderBody when domain_id is in payload', async () => {
      const channel = createChannel();
      mockTemplateService.has.mockResolvedValue(true);
      mockTemplateService.renderBody.mockResolvedValue('<h1>Domain OTP</h1>');

      const message: ChannelMessage = {
        notificationId: 'notif-1',
        channel: NotificationChannel.EMAIL,
        recipientId: 'u1',
        recipientTarget: 'user@example.com',
        title: 'Your OTP',
        content: 'Fallback OTP',
        payload: {
          domain_id: 'tenant-a',
          otp: '123456',
        },
        templateCode: 'otp_verification',
      };

      const result = await channel.send(message);

      expect(mockTemplateService.has).toHaveBeenCalledWith(
        'otp_verification',
        NotificationChannel.EMAIL,
        'tenant-a',
      );
      expect(mockTemplateService.renderBody).toHaveBeenCalledWith(
        'otp_verification',
        NotificationChannel.EMAIL,
        expect.objectContaining({
          domain_id: 'tenant-a',
          otp: '123456',
          recipient_id: 'u1',
          recipient_target: 'user@example.com',
        }),
        'tenant-a',
      );
      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          html: '<h1>Domain OTP</h1>',
          text: 'Fallback OTP',
          to: 'user@example.com',
          subject: 'Your OTP',
        }),
      );
      expect(result.ok).toBe(true);
      expect(result.response).toEqual({
        messageId: 'msg-12345',
        accepted: ['user@example.com'],
        rejected: [],
      });
    });

    it('extracts domainId from payload.domainId', async () => {
      const channel = createChannel();
      mockTemplateService.has.mockResolvedValue(true);
      mockTemplateService.renderBody.mockResolvedValue(
        '<p>Payload domainId</p>',
      );

      const message: ChannelMessage = {
        notificationId: 'notif-2',
        channel: NotificationChannel.EMAIL,
        recipientId: 'u2',
        recipientTarget: 'user2@example.com',
        title: 'Title',
        content: 'Content',
        payload: {
          domainId: 'domain-camel',
        },
        templateCode: 'welcome',
      };

      await channel.send(message);

      expect(mockTemplateService.has).toHaveBeenCalledWith(
        'welcome',
        NotificationChannel.EMAIL,
        'domain-camel',
      );
      expect(mockTemplateService.renderBody).toHaveBeenCalledWith(
        'welcome',
        NotificationChannel.EMAIL,
        expect.anything(),
        'domain-camel',
      );
    });

    it('extracts domainId from payload.metadata.domain_id', async () => {
      const channel = createChannel();
      mockTemplateService.has.mockResolvedValue(true);
      mockTemplateService.renderBody.mockResolvedValue(
        '<p>Metadata domain_id</p>',
      );

      const message: ChannelMessage = {
        notificationId: 'notif-3',
        channel: NotificationChannel.EMAIL,
        recipientId: 'u3',
        recipientTarget: 'user3@example.com',
        title: 'Title',
        content: 'Content',
        payload: {
          metadata: { domain_id: 'meta-tenant' },
        },
        templateCode: 'welcome',
      };

      await channel.send(message);

      expect(mockTemplateService.has).toHaveBeenCalledWith(
        'welcome',
        NotificationChannel.EMAIL,
        'meta-tenant',
      );
      expect(mockTemplateService.renderBody).toHaveBeenCalledWith(
        'welcome',
        NotificationChannel.EMAIL,
        expect.anything(),
        'meta-tenant',
      );
    });

    it('extracts domainId from payload.metadata.domainId', async () => {
      const channel = createChannel();
      mockTemplateService.has.mockResolvedValue(true);
      mockTemplateService.renderBody.mockResolvedValue(
        '<p>Metadata domainId</p>',
      );

      const message: ChannelMessage = {
        notificationId: 'notif-4',
        channel: NotificationChannel.EMAIL,
        recipientId: 'u4',
        recipientTarget: 'user4@example.com',
        title: 'Title',
        content: 'Content',
        payload: {
          metadata: { domainId: 'meta-camel' },
        },
        templateCode: 'welcome',
      };

      await channel.send(message);

      expect(mockTemplateService.has).toHaveBeenCalledWith(
        'welcome',
        NotificationChannel.EMAIL,
        'meta-camel',
      );
    });

    it('extracts domainId from message.domainId', async () => {
      const channel = createChannel();
      mockTemplateService.has.mockResolvedValue(true);
      mockTemplateService.renderBody.mockResolvedValue(
        '<p>Message domainId</p>',
      );

      const message: ChannelMessage = {
        notificationId: 'notif-5',
        channel: NotificationChannel.EMAIL,
        recipientId: 'u5',
        recipientTarget: 'user5@example.com',
        title: 'Title',
        content: 'Content',
        payload: {},
        templateCode: 'welcome',
        domainId: 'direct-domain',
      };

      await channel.send(message);

      expect(mockTemplateService.has).toHaveBeenCalledWith(
        'welcome',
        NotificationChannel.EMAIL,
        'direct-domain',
      );
      expect(mockTemplateService.renderBody).toHaveBeenCalledWith(
        'welcome',
        NotificationChannel.EMAIL,
        expect.anything(),
        'direct-domain',
      );
    });

    it('extracts domainId from message.domain_id', async () => {
      const channel = createChannel();
      mockTemplateService.has.mockResolvedValue(true);
      mockTemplateService.renderBody.mockResolvedValue(
        '<p>Message domain_id</p>',
      );

      const message: ChannelMessage = {
        notificationId: 'notif-6',
        channel: NotificationChannel.EMAIL,
        recipientId: 'u6',
        recipientTarget: 'user6@example.com',
        title: 'Title',
        content: 'Content',
        payload: {},
        templateCode: 'welcome',
        domain_id: 'snake-domain',
      };

      await channel.send(message);

      expect(mockTemplateService.has).toHaveBeenCalledWith(
        'welcome',
        NotificationChannel.EMAIL,
        'snake-domain',
      );
    });

    it('passes undefined domainId when no domainId is in payload, metadata, or message', async () => {
      const channel = createChannel();
      mockTemplateService.has.mockResolvedValue(true);
      mockTemplateService.renderBody.mockResolvedValue('<p>Global</p>');

      const message: ChannelMessage = {
        notificationId: 'notif-7',
        channel: NotificationChannel.EMAIL,
        recipientId: 'u7',
        recipientTarget: 'user7@example.com',
        title: 'Global',
        content: 'Global Content',
        payload: {},
        templateCode: 'global_template',
      };

      await channel.send(message);

      expect(mockTemplateService.has).toHaveBeenCalledWith(
        'global_template',
        NotificationChannel.EMAIL,
        undefined,
      );
      expect(mockTemplateService.renderBody).toHaveBeenCalledWith(
        'global_template',
        NotificationChannel.EMAIL,
        expect.anything(),
        undefined,
      );
    });

    it('falls back to message.content when templateService.has returns false', async () => {
      const channel = createChannel();
      mockTemplateService.has.mockResolvedValue(false);

      const message: ChannelMessage = {
        notificationId: 'notif-8',
        channel: NotificationChannel.EMAIL,
        recipientId: 'u8',
        recipientTarget: 'user8@example.com',
        title: 'Plain',
        content: '<p>Fallback Raw</p>',
        payload: { domain_id: 'domain-xyz' },
        templateCode: 'missing_template',
      };

      await channel.send(message);

      expect(mockTemplateService.has).toHaveBeenCalledWith(
        'missing_template',
        NotificationChannel.EMAIL,
        'domain-xyz',
      );
      expect(mockTemplateService.renderBody).not.toHaveBeenCalled();
      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          html: '<p>Fallback Raw</p>',
        }),
      );
    });

    it('uses custom html, cc, bcc, and replyTo from payload and metadata', async () => {
      const channel = createChannel();

      const message: ChannelMessage = {
        notificationId: 'notif-9',
        channel: NotificationChannel.EMAIL,
        recipientId: 'u9',
        recipientTarget: 'user9@example.com',
        title: 'Custom Props',
        content: 'Fallback',
        payload: {
          html: '<div>Custom HTML</div>',
          cc: ['cc@example.com'],
          bcc: ['bcc@example.com'],
          reply_to: 'reply@example.com',
        },
        templateCode: null,
      };

      await channel.send(message);

      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          html: '<div>Custom HTML</div>',
          cc: ['cc@example.com'],
          bcc: ['bcc@example.com'],
          replyTo: 'reply@example.com',
        }),
      );
    });
  });

  describe('domain-scoped platform transporter resolution', () => {
    it('creates and pools domain-specific transporter when platform config is returned', async () => {
      const channel = createChannel();
      mockPlatformConfig.getActivePlatform.mockResolvedValue({
        id: 'plat-1',
        name: 'Tenant SMTP',
        config: {
          host: 'smtp.tenant.com',
          port: 465,
          user: 'tenant_user',
          pass: 'tenant_pass',
          from: 'tenant@domain.com',
        },
      });

      const message: ChannelMessage = {
        notificationId: 'notif-10',
        channel: NotificationChannel.EMAIL,
        recipientId: 'u10',
        recipientTarget: 'user10@example.com',
        title: 'Platform Test',
        content: 'Hello',
        payload: { domain_id: 'tenant-1' },
        templateCode: null,
      };

      await channel.send(message);

      expect(mockPlatformConfig.getActivePlatform).toHaveBeenCalledWith(
        NotificationChannel.EMAIL,
        'tenant-1',
      );
      expect(nodemailer.createTransport).toHaveBeenCalledWith({
        host: 'smtp.tenant.com',
        port: 465,
        secure: true,
        auth: { user: 'tenant_user', pass: 'tenant_pass' },
      });
      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          from: 'tenant@domain.com',
        }),
      );

      // Subsequent call with same config reuses pooled transporter
      const createTransportSpy = nodemailer.createTransport as jest.Mock;
      createTransportSpy.mockClear();

      await channel.send(message);
      expect(createTransportSpy).not.toHaveBeenCalled();
    });

    it('throws when neither platform config nor defaultTransporter is configured', async () => {
      const unconfiguredConfig = {
        get: jest.fn().mockReturnValue(undefined),
      };
      const channel = createChannel(unconfiguredConfig);
      mockPlatformConfig.getActivePlatform.mockResolvedValue(null);

      const message: ChannelMessage = {
        notificationId: 'notif-11',
        channel: NotificationChannel.EMAIL,
        recipientId: 'u11',
        recipientTarget: 'user11@example.com',
        title: 'Unconfigured',
        content: 'Fail',
        payload: {},
        templateCode: null,
      };

      await expect(channel.send(message)).rejects.toThrow(
        'Email channel is not configured. Provide SMTP env vars or configure notification_platforms in DB.',
      );
    });
  });
});

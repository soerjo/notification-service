import { NotificationChannel } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service.js';
import { TemplateService } from './template.service.js';

describe('TemplateService', () => {
  let service: TemplateService;
  let mockPrisma: {
    template: {
      findFirst: jest.Mock;
      findMany: jest.Mock;
    };
  };

  beforeEach(() => {
    mockPrisma = {
      template: {
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    service = new TemplateService(mockPrisma as unknown as PrismaService);
  });

  it('reports known static templates', async () => {
    expect(await service.has('otp')).toBe(true);
    expect(await service.has('notification-default')).toBe(true);
    expect(await service.has('does-not-exist')).toBe(false);
  });

  it('reports known DB templates', async () => {
    mockPrisma.template.findFirst.mockResolvedValueOnce({
      id: 't1',
      code: 'custom-db-template',
      channel: NotificationChannel.EMAIL,
      isActive: true,
    });
    expect(
      await service.has('custom-db-template', NotificationChannel.EMAIL),
    ).toBe(true);
  });

  it('renders placeholders in the body for static template', async () => {
    const rendered = await service.render('otp', NotificationChannel.EMAIL, {
      otp: '482910',
      expires_in_minutes: 5,
    });
    expect(rendered.body).toContain('482910');
    expect(rendered.body).toContain('5');
    expect(rendered.body).not.toContain('{{otp}}');
  });

  it('renders DB template when matched by channel', async () => {
    mockPrisma.template.findFirst.mockResolvedValueOnce({
      id: 't-email',
      code: 'welcome-user',
      channel: NotificationChannel.EMAIL,
      subject: 'Selamat Datang, {{name}}!',
      body: '<h1>Halo {{name}}</h1><p>Email verifikasi Anda: {{code}}</p>',
      isActive: true,
    });

    const rendered = await service.render(
      'welcome-user',
      NotificationChannel.EMAIL,
      {
        name: 'Budi',
        code: '998877',
      },
    );

    expect(rendered.title).toBe('Selamat Datang, Budi!');
    expect(rendered.body).toContain('<h1>Halo Budi</h1>');
    expect(rendered.body).toContain('998877');
  });

  it('falls back to literal content for the default template', async () => {
    const rendered = await service.render(
      'notification-default',
      NotificationChannel.TELEGRAM,
      {
        title: 'Hello',
        body: 'World',
      },
    );
    expect(rendered.title).toBe('Hello');
    expect(rendered.body).toBe('World');
  });

  it('uses the fallback branch when content is absent', async () => {
    const rendered = await service.render(
      'notification-default',
      NotificationChannel.SOCKET_IO,
      {},
    );
    expect(rendered.title).toBe('Notification');
  });

  it('escapes html by default in body', async () => {
    const rendered = await service.render(
      'notification-default',
      NotificationChannel.TELEGRAM,
      {
        body: '<script>alert(1)</script>',
      },
    );
    expect(rendered.body).not.toContain('<script>');
  });

  it('throws for unknown templates', async () => {
    await expect(
      service.render('unknown', NotificationChannel.EMAIL, {}),
    ).rejects.toThrow('Unknown notification template');
  });

  describe('domain scoped template resolution', () => {
    it('prioritizes domain template over global template when domainId is passed', async () => {
      mockPrisma.template.findFirst
        .mockResolvedValueOnce({
          code: 'otp',
          channel: NotificationChannel.EMAIL,
          name: 'CMS OTP',
          subject: 'CMS Custom OTP',
          body: 'CMS Code: {{otp}}',
        });

      const rendered = await service.render(
        'otp',
        NotificationChannel.EMAIL,
        { otp: '123456' },
        'cms.soerjo.id',
      );

      expect(rendered.title).toBe('CMS Custom OTP');
      expect(rendered.body).toBe('CMS Code: 123456');
    });

    it('falls back to global template when domain template does not exist', async () => {
      mockPrisma.template.findFirst
        .mockResolvedValueOnce(null) // domain template not found
        .mockResolvedValueOnce({
          code: 'otp',
          channel: NotificationChannel.EMAIL,
          name: 'Global OTP',
          subject: 'Global OTP',
          body: 'Global Code: {{otp}}',
        });

      const rendered = await service.render(
        'otp',
        NotificationChannel.EMAIL,
        { otp: '654321' },
        'unknown.domain.id',
      );

      expect(rendered.title).toBe('Global OTP');
      expect(rendered.body).toBe('Global Code: 654321');
    });
  });

  describe('listTemplates & getTemplateDetails', () => {
    it('listTemplates returns extracted parameters from DB templates', async () => {
      mockPrisma.template.findMany.mockResolvedValueOnce([
        {
          code: 'tpl-1',
          channel: NotificationChannel.EMAIL,
          name: 'Tpl 1',
          description: 'Desc',
          subject: 'Hello {{user_name}}',
          body: 'Click {{action_url}} to proceed {{user_name}}',
        },
      ]);

      const list = await service.listTemplates(NotificationChannel.EMAIL);
      expect(list).toHaveLength(1);
      expect(list[0].parameters).toEqual(
        expect.arrayContaining(['user_name', 'action_url']),
      );
    });

    it('getTemplateDetails returns template with parameters and sample payload', async () => {
      mockPrisma.template.findFirst.mockResolvedValueOnce({
        code: 'verification-email',
        channel: NotificationChannel.EMAIL,
        name: 'Email Verification',
        description: 'Verify',
        subject: 'Verify {{company_name}}',
        body: '<p>{{verification_url}}</p>',
      });

      const details = await service.getTemplateDetails('verification-email');
      expect(details.code).toBe('verification-email');
      expect(details.parameters).toEqual(
        expect.arrayContaining(['company_name', 'verification_url']),
      );
      expect(details.sample_payload).toBeDefined();
    });

    it('getTemplateDetails throws NotFoundException for unknown template', async () => {
      mockPrisma.template.findFirst.mockResolvedValueOnce(null);
      await expect(
        service.getTemplateDetails('totally-unknown-code'),
      ).rejects.toThrow('Template with code "totally-unknown-code" not found');
    });
  });
});

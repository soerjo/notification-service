import { NotificationChannel } from '@prisma/client';
import { PlatformConfigService } from './platform-config.service.js';
import { MASKED_VALUE } from '../../../common/utils/sanitizer.util.js';
import type { PrismaService } from '../../../prisma/prisma.service.js';

describe('PlatformConfigService', () => {
  let service: PlatformConfigService;
  let mockPrisma: {
    notificationPlatform: {
      findFirst: jest.Mock;
      findMany: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      updateMany: jest.Mock;
    };
  };

  beforeEach(() => {
    mockPrisma = {
      notificationPlatform: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
    };
    service = new PlatformConfigService(mockPrisma as unknown as PrismaService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('getActivePlatform', () => {
    it('returns domain-specific platform if available', async () => {
      mockPrisma.notificationPlatform.findFirst.mockResolvedValueOnce({
        id: 'plat-domain',
        name: 'domain-smtp',
        config: { host: 'smtp.domain.com' },
      });

      const result = await service.getActivePlatform(
        NotificationChannel.EMAIL,
        'pos.soerjo.id',
      );
      expect(result).toEqual({
        id: 'plat-domain',
        name: 'domain-smtp',
        config: { host: 'smtp.domain.com' },
      });
      expect(mockPrisma.notificationPlatform.findFirst).toHaveBeenCalledWith({
        where: {
          domainId: 'pos.soerjo.id',
          channel: NotificationChannel.EMAIL,
          isActive: true,
        },
        orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
      });
    });

    it('falls back to global platform when domain platform not found', async () => {
      mockPrisma.notificationPlatform.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          id: 'plat-global',
          name: 'global-smtp',
          config: { host: 'smtp.global.com' },
        });

      const result = await service.getActivePlatform(
        NotificationChannel.EMAIL,
        'pos.soerjo.id',
      );
      expect(result).toEqual({
        id: 'plat-global',
        name: 'global-smtp',
        config: { host: 'smtp.global.com' },
      });
    });

    it('returns null if neither domain nor global platform exists', async () => {
      mockPrisma.notificationPlatform.findFirst.mockResolvedValue(null);

      const result = await service.getActivePlatform(NotificationChannel.EMAIL);
      expect(result).toBeNull();
    });

    it('handles non-object config gracefully', async () => {
      mockPrisma.notificationPlatform.findFirst.mockResolvedValueOnce({
        id: 'plat-invalid',
        name: 'invalid-smtp',
        config: 'invalid-string',
      });

      const result = await service.getActivePlatform(NotificationChannel.EMAIL);
      expect(result).toEqual({
        id: 'plat-invalid',
        name: 'invalid-smtp',
        config: {},
      });
    });
  });

  describe('createOrUpdatePlatform', () => {
    it('creates a new platform when none exists', async () => {
      mockPrisma.notificationPlatform.findFirst.mockResolvedValueOnce(null);
      mockPrisma.notificationPlatform.create.mockResolvedValueOnce({
        id: 'plat-1',
        domainId: 'pos.soerjo.id',
        channel: NotificationChannel.EMAIL,
        name: 'hostinger-smtp',
        config: { host: 'smtp.hostinger.com', pass: 'secret' },
        isDefault: false,
        isActive: true,
      });

      const result = await service.createOrUpdatePlatform({
        domain_id: 'pos.soerjo.id',
        channel: NotificationChannel.EMAIL,
        name: 'hostinger-smtp',
        config: { host: 'smtp.hostinger.com', pass: 'secret' },
      });

      expect(mockPrisma.notificationPlatform.create).toHaveBeenCalledWith({
        data: {
          domainId: 'pos.soerjo.id',
          channel: NotificationChannel.EMAIL,
          name: 'hostinger-smtp',
          config: { host: 'smtp.hostinger.com', pass: 'secret' },
          isDefault: false,
          isActive: true,
        },
      });
      const configObj = result.config as Record<string, unknown>;
      expect(configObj.pass).toBe(MASKED_VALUE);
    });

    it('updates existing platform and clears default on others when is_default=true', async () => {
      mockPrisma.notificationPlatform.findFirst.mockResolvedValueOnce({
        id: 'plat-existing',
      });
      mockPrisma.notificationPlatform.update.mockResolvedValueOnce({
        id: 'plat-existing',
        domainId: null,
        channel: NotificationChannel.EMAIL,
        name: 'default-smtp',
        config: { host: 'smtp.default.com', password: 'sec' },
        isDefault: true,
        isActive: true,
      });

      const result = await service.createOrUpdatePlatform({
        channel: NotificationChannel.EMAIL,
        name: 'default-smtp',
        config: { host: 'smtp.default.com', password: 'sec' },
        is_default: true,
        is_active: true,
      });

      expect(mockPrisma.notificationPlatform.updateMany).toHaveBeenCalledWith({
        where: { channel: NotificationChannel.EMAIL, domainId: null },
        data: { isDefault: false },
      });
      expect(mockPrisma.notificationPlatform.update).toHaveBeenCalledWith({
        where: { id: 'plat-existing' },
        data: {
          config: { host: 'smtp.default.com', password: 'sec' },
          isDefault: true,
          isActive: true,
        },
      });
      const updateConfigObj = result.config as Record<string, unknown>;
      expect(updateConfigObj.password).toBe(MASKED_VALUE);
    });

    it('savePlatform convenience method calls createOrUpdatePlatform', async () => {
      mockPrisma.notificationPlatform.findFirst.mockResolvedValueOnce(null);
      mockPrisma.notificationPlatform.create.mockResolvedValueOnce({
        id: 'plat-2',
        domainId: 'sub.domain.com',
        channel: NotificationChannel.TELEGRAM,
        name: 'tg-bot',
        config: { bot_token: '123:ABC' },
        isDefault: true,
        isActive: true,
      });

      const result = await service.savePlatform(
        NotificationChannel.TELEGRAM,
        'tg-bot',
        { bot_token: '123:ABC' },
        true,
        'sub.domain.com',
      );

      expect(result.id).toBe('plat-2');
      const botConfigObj = result.config as Record<string, unknown>;
      expect(botConfigObj.bot_token).toBe(MASKED_VALUE);
    });
  });

  describe('listPlatforms', () => {
    it('lists platforms and masks sensitive config fields', async () => {
      mockPrisma.notificationPlatform.findMany.mockResolvedValueOnce([
        {
          id: 'plat-1',
          domainId: 'pos.soerjo.id',
          channel: NotificationChannel.EMAIL,
          name: 'hostinger-smtp',
          config: {
            host: 'smtp.hostinger.com',
            port: 465,
            user: 'info@pos.soerjo.id',
            pass: 'mypassword',
          },
          isDefault: true,
          isActive: true,
        },
      ]);

      const result = await service.listPlatforms({
        domain_id: 'pos.soerjo.id',
        channel: NotificationChannel.EMAIL,
      });

      expect(result).toHaveLength(1);
      const firstConfig = result[0]?.config as Record<string, unknown>;
      expect(firstConfig.pass).toBe(MASKED_VALUE);
      expect(firstConfig.host).toBe('smtp.hostinger.com');
      expect(mockPrisma.notificationPlatform.findMany).toHaveBeenCalledWith({
        where: {
          domainId: 'pos.soerjo.id',
          channel: NotificationChannel.EMAIL,
        },
        orderBy: [{ channel: 'asc' }, { name: 'asc' }],
      });
    });

    it('lists all platforms without filter when filter is omitted', async () => {
      mockPrisma.notificationPlatform.findMany.mockResolvedValueOnce([]);

      const result = await service.listPlatforms();
      expect(result).toEqual([]);
      expect(mockPrisma.notificationPlatform.findMany).toHaveBeenCalledWith({
        where: {},
        orderBy: [{ channel: 'asc' }, { name: 'asc' }],
      });
    });
  });
});

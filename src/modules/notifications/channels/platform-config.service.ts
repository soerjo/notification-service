import { Injectable } from '@nestjs/common';
import { NotificationChannel, Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service.js';

export interface PlatformConfig {
  id?: string;
  name?: string;
  config: Record<string, unknown>;
}

@Injectable()
export class PlatformConfigService {
  constructor(private readonly prisma: PrismaService) {}

  async getActivePlatform(
    channel: NotificationChannel,
    domainId?: string | null,
  ): Promise<PlatformConfig | null> {
    if (domainId) {
      const domainPlatform = await this.prisma.notificationPlatform.findFirst({
        where: { domainId, channel, isActive: true },
        orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
      });
      if (domainPlatform) {
        return this.mapConfig(domainPlatform);
      }
    }

    const globalPlatform = await this.prisma.notificationPlatform.findFirst({
      where: { domainId: null, channel, isActive: true },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });

    if (!globalPlatform) {
      return null;
    }

    return this.mapConfig(globalPlatform);
  }

  private mapConfig(platform: {
    id: string;
    name: string;
    config: unknown;
  }): PlatformConfig {
    const config =
      platform.config &&
      typeof platform.config === 'object' &&
      !Array.isArray(platform.config)
        ? (platform.config as Record<string, unknown>)
        : {};

    return {
      id: platform.id,
      name: platform.name,
      config,
    };
  }

  async savePlatform(
    channel: NotificationChannel,
    name: string,
    config: Record<string, unknown>,
    isDefault = false,
    domainId?: string | null,
  ) {
    if (isDefault) {
      await this.prisma.notificationPlatform.updateMany({
        where: { channel, domainId: domainId ?? null },
        data: { isDefault: false },
      });
    }

    return this.prisma.notificationPlatform.create({
      data: {
        channel,
        domainId: domainId ?? null,
        name,
        config: config as Prisma.InputJsonValue,
        isDefault,
        isActive: true,
      },
    });
  }
}

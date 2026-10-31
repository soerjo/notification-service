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
  ): Promise<PlatformConfig | null> {
    const platform = await this.prisma.notificationPlatform.findFirst({
      where: { channel, isActive: true },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });

    if (!platform) {
      return null;
    }

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
  ) {
    if (isDefault) {
      await this.prisma.notificationPlatform.updateMany({
        where: { channel },
        data: { isDefault: false },
      });
    }

    return this.prisma.notificationPlatform.create({
      data: {
        channel,
        name,
        config: config as Prisma.InputJsonValue,
        isDefault,
        isActive: true,
      },
    });
  }
}

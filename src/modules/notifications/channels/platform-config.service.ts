import { Injectable } from '@nestjs/common';
import {
  NotificationChannel,
  NotificationPlatform,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service.js';
import { sanitize } from '../../../common/utils/sanitizer.util.js';
import type {
  CreateOrUpdatePlatformDto,
  GetPlatformsDto,
} from '../dto/index.js';

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

  async createOrUpdatePlatform(
    dto: CreateOrUpdatePlatformDto,
  ): Promise<NotificationPlatform> {
    const domainId = dto.domain_id?.trim() || null;
    const isDefault = dto.is_default ?? false;
    const isActive = dto.is_active ?? true;

    if (isDefault) {
      await this.prisma.notificationPlatform.updateMany({
        where: { channel: dto.channel, domainId },
        data: { isDefault: false },
      });
    }

    const existing = await this.prisma.notificationPlatform.findFirst({
      where: {
        channel: dto.channel,
        domainId,
        name: dto.name,
      },
    });

    let saved: NotificationPlatform;
    if (existing) {
      saved = await this.prisma.notificationPlatform.update({
        where: { id: existing.id },
        data: {
          config: dto.config as Prisma.InputJsonValue,
          isDefault,
          isActive,
        },
      });
    } else {
      saved = await this.prisma.notificationPlatform.create({
        data: {
          channel: dto.channel,
          domainId,
          name: dto.name,
          config: dto.config as Prisma.InputJsonValue,
          isDefault,
          isActive,
        },
      });
    }

    const sanitizedConfig = sanitize(saved.config) as Prisma.JsonValue;
    return {
      ...saved,
      config: sanitizedConfig,
    };
  }

  async listPlatforms(
    filter?: GetPlatformsDto,
  ): Promise<NotificationPlatform[]> {
    const where: Prisma.NotificationPlatformWhereInput = {};
    if (filter?.domain_id !== undefined && filter.domain_id !== '') {
      where.domainId = filter.domain_id.trim();
    }
    if (filter?.channel !== undefined) {
      where.channel = filter.channel;
    }

    const platforms = await this.prisma.notificationPlatform.findMany({
      where,
      orderBy: [{ channel: 'asc' }, { name: 'asc' }],
    });

    return platforms.map((p) => ({
      ...p,
      config: sanitize(p.config as Record<string, unknown>) as Record<
        string,
        unknown
      >,
    })) as unknown as NotificationPlatform[];
  }

  async savePlatform(
    channel: NotificationChannel,
    name: string,
    config: Record<string, unknown>,
    isDefault = false,
    domainId?: string | null,
  ): Promise<NotificationPlatform> {
    return this.createOrUpdatePlatform({
      channel,
      name,
      config,
      is_default: isDefault,
      domain_id: domainId ?? undefined,
    });
  }
}

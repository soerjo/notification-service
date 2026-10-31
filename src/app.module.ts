import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { WinstonModule } from 'nest-winston';
import { PrismaModule } from './prisma/prisma.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { MetricsModule } from './modules/metrics/metrics.module.js';
import { RedisModule } from './modules/redis/redis.module.js';
import { NotificationsModule } from './modules/notifications/notifications.module.js';
import { SignaturesModule } from './modules/signatures/signatures.module.js';
import { ApiKeyGuard } from './common/guards/api-key.guard.js';
import { loggerConfig } from './config/logger.config.js';
import { validate } from './config/env.validation.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate }),
    WinstonModule.forRoot(loggerConfig),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),
    PrismaModule,
    RedisModule,
    HealthModule,
    MetricsModule,
    NotificationsModule,
    SignaturesModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: ApiKeyGuard },
  ],
})
export class AppModule {}

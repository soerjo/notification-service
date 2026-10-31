import { Module } from '@nestjs/common';
import { MetricsModule } from '../metrics/metrics.module.js';
import { NotificationsController } from './notifications.controller.js';
import { NotificationsService } from './notifications.service.js';
import { NotificationsRepository } from './notifications.repository.js';
import { NotificationsDispatcher } from './notifications.dispatcher.js';
import { NotificationsQueueService } from './notifications.queue.js';
import { TemplateService } from './templates/template.service.js';
import { NotificationsGateway } from './gateway/notifications.gateway.js';
import { ChannelRegistry } from './channels/channel-registry.js';
import { PlatformConfigService } from './channels/platform-config.service.js';
import { TelegramChannel } from './channels/telegram.channel.js';
import { EmailChannel } from './channels/email.channel.js';
import { SocketIoChannel } from './channels/socket-io.channel.js';
import { WhatsappChannel } from './channels/whatsapp.channel.js';

@Module({
  imports: [MetricsModule],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    NotificationsRepository,
    NotificationsDispatcher,
    NotificationsQueueService,
    TemplateService,
    NotificationsGateway,
    ChannelRegistry,
    PlatformConfigService,
    TelegramChannel,
    EmailChannel,
    SocketIoChannel,
    WhatsappChannel,
  ],
  exports: [NotificationsService, TemplateService, PlatformConfigService],
})
export class NotificationsModule {}

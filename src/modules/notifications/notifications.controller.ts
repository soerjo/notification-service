import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { NotificationChannel } from '@prisma/client';
import type { Response } from 'express';
import {
  SendNotificationDto,
  SendEmailDto,
  SendTelegramDto,
  SendWhatsappDto,
  SendSocketDto,
  GetNotificationLogsDto,
} from './dto/index.js';
import { NotificationsService } from './notifications.service.js';

@ApiTags('Notifications')
@ApiSecurity('api-key')
@Controller('v1/notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Post('send')
  @HttpCode(202)
  async send(
    @Body() dto: SendNotificationDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.notificationsService.send(dto);
    response.status(result.idempotent ? 200 : 202);
    return {
      notification_ids: result.notificationIds,
      trace_id: result.traceId,
    };
  }

  @Post('email')
  @HttpCode(202)
  @ApiOperation({ summary: 'Send an email notification' })
  async sendEmail(
    @Body() dto: SendEmailDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.notificationsService.sendEmail(dto);
    response.status(result.idempotent ? 200 : 202);
    return {
      notification_id: result.notificationIds[0],
      notification_ids: result.notificationIds,
      trace_id: result.traceId,
    };
  }

  @Post('telegram')
  @HttpCode(202)
  @ApiOperation({ summary: 'Send a Telegram notification' })
  async sendTelegram(
    @Body() dto: SendTelegramDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.notificationsService.sendTelegram(dto);
    response.status(result.idempotent ? 200 : 202);
    return {
      notification_id: result.notificationIds[0],
      notification_ids: result.notificationIds,
      trace_id: result.traceId,
    };
  }

  @Post('whatsapp')
  @HttpCode(202)
  @ApiOperation({ summary: 'Send a WhatsApp notification' })
  async sendWhatsapp(
    @Body() dto: SendWhatsappDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.notificationsService.sendWhatsapp(dto);
    response.status(result.idempotent ? 200 : 202);
    return {
      notification_id: result.notificationIds[0],
      notification_ids: result.notificationIds,
      trace_id: result.traceId,
    };
  }

  @Post(['socket', 'socket-io'])
  @HttpCode(202)
  @ApiOperation({ summary: 'Send a Socket.IO real-time notification' })
  async sendSocket(
    @Body() dto: SendSocketDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.notificationsService.sendSocket(dto);
    response.status(result.idempotent ? 200 : 202);
    return {
      notification_id: result.notificationIds[0],
      notification_ids: result.notificationIds,
      trace_id: result.traceId,
    };
  }

  @Get('logs')
  @ApiOperation({
    summary: 'Get paginated delivery logs within a required date range',
  })
  async logs(@Query() query: GetNotificationLogsDto) {
    return this.notificationsService.getLogs(query);
  }

  @Get('templates')
  @ApiOperation({
    summary: 'List available notification templates with extracted parameters',
  })
  @ApiQuery({
    name: 'channel',
    enum: NotificationChannel,
    required: false,
    description: 'Filter templates by notification channel',
  })
  async listTemplates(@Query('channel') channel?: NotificationChannel) {
    return this.notificationsService.listTemplates(channel);
  }

  @Get('templates/:code')
  @ApiOperation({
    summary:
      'Get template details, required parameters, and sample payload for a specific template',
  })
  @ApiQuery({
    name: 'channel',
    enum: NotificationChannel,
    required: false,
    description: 'Filter template by notification channel',
  })
  async getTemplateDetails(
    @Param('code') code: string,
    @Query('channel') channel?: NotificationChannel,
  ) {
    return this.notificationsService.getTemplateDetails(code, channel);
  }
}

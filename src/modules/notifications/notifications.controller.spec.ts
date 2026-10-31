import { NotificationChannel } from '@prisma/client';
import type { Response } from 'express';
import { NotificationsController } from './notifications.controller.js';
import type { NotificationsService } from './notifications.service.js';

describe('NotificationsController', () => {
  let controller: NotificationsController;
  let serviceMock: {
    send: jest.Mock;
    sendEmail: jest.Mock;
    sendTelegram: jest.Mock;
    sendWhatsapp: jest.Mock;
    sendSocket: jest.Mock;
    getLogs: jest.Mock;
    listTemplates: jest.Mock;
    getTemplateDetails: jest.Mock;
    createOrUpdatePlatform: jest.Mock;
    listPlatforms: jest.Mock;
    createOrUpdateTemplate: jest.Mock;
  };
  let mockResponse: Partial<Response>;

  beforeEach(() => {
    serviceMock = {
      send: jest.fn(),
      sendEmail: jest.fn(),
      sendTelegram: jest.fn(),
      sendWhatsapp: jest.fn(),
      sendSocket: jest.fn(),
      getLogs: jest.fn(),
      listTemplates: jest.fn(),
      getTemplateDetails: jest.fn(),
      createOrUpdatePlatform: jest.fn(),
      listPlatforms: jest.fn(),
      createOrUpdateTemplate: jest.fn(),
    };
    mockResponse = {
      status: jest.fn().mockReturnThis(),
    };
    controller = new NotificationsController(
      serviceMock as unknown as NotificationsService,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('send handles generic notification dispatch (202 status)', async () => {
    serviceMock.send.mockResolvedValue({
      notificationIds: ['notif-1'],
      traceId: 'trace-1',
      idempotent: false,
    });

    const result = await controller.send(
      {
        idempotency_key: 'req-1',
        channels: [NotificationChannel.EMAIL],
        destination: { email: 'test@example.com' },
        content: { body: 'Hello' },
      },
      mockResponse as Response,
    );

    expect(mockResponse.status).toHaveBeenCalledWith(202);
    expect(result).toEqual({
      notification_ids: ['notif-1'],
      trace_id: 'trace-1',
    });
  });

  it('send handles idempotent hits (200 status)', async () => {
    serviceMock.send.mockResolvedValue({
      notificationIds: ['notif-1'],
      traceId: 'trace-1',
      idempotent: true,
    });

    const result = await controller.send(
      {
        idempotency_key: 'req-1',
        channels: [NotificationChannel.EMAIL],
      },
      mockResponse as Response,
    );

    expect(mockResponse.status).toHaveBeenCalledWith(200);
    expect(result.notification_ids).toEqual(['notif-1']);
  });

  it('sendEmail delegates to notificationsService.sendEmail', async () => {
    serviceMock.sendEmail.mockResolvedValue({
      notificationIds: ['email-1'],
      traceId: 'trace-email',
      idempotent: false,
    });

    const result = await controller.sendEmail(
      {
        idempotency_key: 'email-key-1',
        to: 'user@example.com',
        subject: 'Reset Password',
        body: 'Click here',
      },
      mockResponse as Response,
    );

    expect(mockResponse.status).toHaveBeenCalledWith(202);
    expect(result).toEqual({
      notification_id: 'email-1',
      notification_ids: ['email-1'],
      trace_id: 'trace-email',
    });
    expect(serviceMock.sendEmail).toHaveBeenCalled();
  });

  it('sendTelegram delegates to notificationsService.sendTelegram', async () => {
    serviceMock.sendTelegram.mockResolvedValue({
      notificationIds: ['tg-1'],
      traceId: 'trace-tg',
      idempotent: false,
    });

    const result = await controller.sendTelegram(
      {
        idempotency_key: 'tg-key-1',
        chat_id: '123456789',
        message: 'Hello telegram',
      },
      mockResponse as Response,
    );

    expect(mockResponse.status).toHaveBeenCalledWith(202);
    expect(result).toEqual({
      notification_id: 'tg-1',
      notification_ids: ['tg-1'],
      trace_id: 'trace-tg',
    });
    expect(serviceMock.sendTelegram).toHaveBeenCalled();
  });

  it('sendWhatsapp delegates to notificationsService.sendWhatsapp', async () => {
    serviceMock.sendWhatsapp.mockResolvedValue({
      notificationIds: ['wa-1'],
      traceId: 'trace-wa',
      idempotent: false,
    });

    const result = await controller.sendWhatsapp(
      {
        idempotency_key: 'wa-key-1',
        phone_number: '+628123456789',
        message: 'Hello whatsapp',
      },
      mockResponse as Response,
    );

    expect(mockResponse.status).toHaveBeenCalledWith(202);
    expect(result).toEqual({
      notification_id: 'wa-1',
      notification_ids: ['wa-1'],
      trace_id: 'trace-wa',
    });
    expect(serviceMock.sendWhatsapp).toHaveBeenCalled();
  });

  it('sendSocket delegates to notificationsService.sendSocket', async () => {
    serviceMock.sendSocket.mockResolvedValue({
      notificationIds: ['socket-1'],
      traceId: 'trace-socket',
      idempotent: false,
    });

    const result = await controller.sendSocket(
      {
        idempotency_key: 'socket-key-1',
        room: 'room_1',
        message: 'Hello socket',
      },
      mockResponse as Response,
    );

    expect(mockResponse.status).toHaveBeenCalledWith(202);
    expect(result).toEqual({
      notification_id: 'socket-1',
      notification_ids: ['socket-1'],
      trace_id: 'trace-socket',
    });
    expect(serviceMock.sendSocket).toHaveBeenCalled();
  });

  it('logs delegates to notificationsService.getLogs with query', async () => {
    const paginatedResponse = {
      items: [{ id: 'log-1', status: 'SUCCESS' }],
      meta: {
        total: 1,
        page: 1,
        limit: 10,
        total_pages: 1,
        has_next: false,
        has_prev: false,
      },
    };
    serviceMock.getLogs.mockResolvedValue(paginatedResponse);

    const query = {
      start_date: '2026-10-01T00:00:00.000Z',
      end_date: '2026-10-25T23:59:59.999Z',
      page: 1,
      limit: 10,
    };

    const result = await controller.logs(query);

    expect(serviceMock.getLogs).toHaveBeenCalledWith(query);
    expect(result).toEqual(paginatedResponse);
  });

  it('listTemplates delegates to notificationsService.listTemplates', async () => {
    const templates = [
      {
        code: 'verification-email',
        channel: NotificationChannel.EMAIL,
        parameters: ['user_name'],
      },
    ];
    serviceMock.listTemplates.mockResolvedValue(templates);

    const result = await controller.listTemplates(NotificationChannel.EMAIL);
    expect(serviceMock.listTemplates).toHaveBeenCalledWith(
      NotificationChannel.EMAIL,
    );
    expect(result).toEqual(templates);
  });

  it('listTemplates delegates with domain_id when provided', async () => {
    const templates = [
      {
        code: 'order_receipt',
        channel: NotificationChannel.EMAIL,
        parameters: ['order_id'],
      },
    ];
    serviceMock.listTemplates.mockResolvedValue(templates);

    const result = await controller.listTemplates(
      NotificationChannel.EMAIL,
      'pos.soerjo.id',
    );
    expect(serviceMock.listTemplates).toHaveBeenCalledWith(
      NotificationChannel.EMAIL,
      'pos.soerjo.id',
    );
    expect(result).toEqual(templates);
  });

  it('createOrUpdatePlatform delegates to notificationsService.createOrUpdatePlatform', async () => {
    const dto = {
      channel: NotificationChannel.EMAIL,
      name: 'hostinger-smtp',
      config: { host: 'smtp.hostinger.com', port: 465, pass: 'secret' },
      domain_id: 'pos.soerjo.id',
      is_default: true,
    };
    const platformResponse = {
      id: 'plat-1',
      domainId: 'pos.soerjo.id',
      channel: NotificationChannel.EMAIL,
      name: 'hostinger-smtp',
      config: { host: 'smtp.hostinger.com', port: 465, pass: '***MASKED***' },
      isDefault: true,
      isActive: true,
    };
    serviceMock.createOrUpdatePlatform.mockResolvedValue(platformResponse);

    const result = await controller.createOrUpdatePlatform(dto);
    expect(serviceMock.createOrUpdatePlatform).toHaveBeenCalledWith(dto);
    expect(result).toEqual(platformResponse);
  });

  it('listPlatforms delegates to notificationsService.listPlatforms', async () => {
    const query = {
      domain_id: 'pos.soerjo.id',
      channel: NotificationChannel.EMAIL,
    };
    const platforms = [
      {
        id: 'plat-1',
        domainId: 'pos.soerjo.id',
        channel: NotificationChannel.EMAIL,
        name: 'hostinger-smtp',
        config: { host: 'smtp.hostinger.com', port: 465, pass: '***MASKED***' },
      },
    ];
    serviceMock.listPlatforms.mockResolvedValue(platforms);

    const result = await controller.listPlatforms(query);
    expect(serviceMock.listPlatforms).toHaveBeenCalledWith(query);
    expect(result).toEqual(platforms);
  });

  it('createOrUpdateTemplate delegates to notificationsService.createOrUpdateTemplate', async () => {
    const dto = {
      domain_id: 'pos.soerjo.id',
      code: 'welcome_user',
      channel: NotificationChannel.EMAIL,
      name: 'Welcome Template',
      subject: 'Welcome {{user_name}}',
      body: '<p>Welcome {{user_name}}</p>',
    };
    const savedTemplate = {
      id: 'tpl-new-1',
      domainId: 'pos.soerjo.id',
      code: 'welcome_user',
      channel: NotificationChannel.EMAIL,
      name: 'Welcome Template',
      subject: 'Welcome {{user_name}}',
      body: '<p>Welcome {{user_name}}</p>',
      isActive: true,
    };
    serviceMock.createOrUpdateTemplate.mockResolvedValue(savedTemplate);

    const result: unknown = await controller.createOrUpdateTemplate(dto);
    expect(serviceMock.createOrUpdateTemplate).toHaveBeenCalledWith(dto);
    expect(result).toEqual(savedTemplate);
  });
  it('getTemplateDetails delegates to notificationsService.getTemplateDetails', async () => {
    const details = {
      code: 'verification-email',
      channel: NotificationChannel.EMAIL,
      parameters: ['user_name'],
      sample_payload: { user_name: 'Alex' },
    };
    serviceMock.getTemplateDetails.mockResolvedValue(details);

    const result = await controller.getTemplateDetails(
      'verification-email',
      NotificationChannel.EMAIL,
    );
    expect(serviceMock.getTemplateDetails).toHaveBeenCalledWith(
      'verification-email',
      NotificationChannel.EMAIL,
    );
    expect(result).toEqual(details);
  });
});

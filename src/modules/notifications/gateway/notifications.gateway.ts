import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';

export const NOTIFICATION_ROOM_EVENT = 'notification';

@WebSocketGateway({ cors: { origin: '*' } })
export class NotificationsGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(NotificationsGateway.name);

  @WebSocketServer()
  private server!: Server;

  constructor(private readonly configService: ConfigService) {}

  handleConnection(client: Socket): void {
    const expected =
      this.configService.get<string>('API_KEY') || process.env.API_KEY;
    const token = client.handshake.query.token;
    const provided = Array.isArray(token) ? token[0] : token;

    if (provided && expected && provided !== expected) {
      this.logger.warn(`Rejected socket client ${client.id}: invalid token`);
      client.disconnect(true);
      return;
    }

    const room = client.handshake.query.room;
    const roomName = Array.isArray(room) ? room[0] : room;
    if (roomName) {
      void client.join(roomName);
    }

    this.logger.log(`Socket client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket): void {
    this.logger.log(`Socket client disconnected: ${client.id}`);
  }

  @SubscribeMessage('join')
  handleJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { room?: string },
  ): { joined: string | null } {
    if (body?.room) {
      void client.join(body.room);
    }
    return { joined: body?.room ?? null };
  }

  emitToRoom(
    room: string,
    event: string,
    data: Record<string, unknown>,
  ): boolean {
    if (!this.server) {
      this.logger.warn(`Socket server not ready; dropping event for ${room}`);
      return false;
    }
    this.server.to(room).emit(event, data);
    return true;
  }
}

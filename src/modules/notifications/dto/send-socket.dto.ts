import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator';

export class SendSocketDto {
  @ApiProperty({ example: 'unique-req-uuid-1234' })
  @IsString()
  @IsNotEmpty()
  idempotency_key: string;

  @ApiProperty({
    example: 'room_usr_9981',
    description: 'Socket.IO room name',
  })
  @IsString()
  @IsNotEmpty()
  room: string;

  @ApiPropertyOptional({
    example: 'notification',
    description: 'Socket.IO event name (defaults to notification)',
  })
  @IsString()
  @IsOptional()
  event?: string;

  @ApiPropertyOptional({ example: 'Order Updated' })
  @IsString()
  @IsOptional()
  title?: string;

  @ApiPropertyOptional({ example: 'Your order is currently being prepared.' })
  @IsString()
  @IsOptional()
  message?: string;

  @ApiPropertyOptional({
    example: { order_id: 'ord-123', status: 'PREPARING' },
    description: 'Custom payload delivered inside socket event',
  })
  @IsObject()
  @IsOptional()
  payload?: Record<string, unknown>;

  @ApiPropertyOptional({ example: 'order_status_update' })
  @IsString()
  @IsOptional()
  template_code?: string;

  @ApiPropertyOptional({ example: { order_id: 'ord-123' } })
  @IsObject()
  @IsOptional()
  template_data?: Record<string, unknown>;

  @ApiPropertyOptional({ example: 'usr_9981' })
  @IsString()
  @IsOptional()
  recipient_id?: string;

  @ApiPropertyOptional({ example: 'trace-uuid-1234' })
  @IsString()
  @IsOptional()
  trace_id?: string;

  @ApiPropertyOptional({ example: { internal_ref: 'abc' } })
  @IsObject()
  @IsOptional()
  metadata?: Record<string, unknown>;
}

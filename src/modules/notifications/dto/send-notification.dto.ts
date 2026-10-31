import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { NotificationChannel } from '@prisma/client';

export class NotificationDestinationDto {
  @ApiPropertyOptional({ example: 'room_usr_9981' })
  @IsString()
  @IsOptional()
  socket_room?: string;

  @ApiPropertyOptional({ example: '987654321' })
  @IsString()
  @IsOptional()
  telegram_chat_id?: string;

  @ApiPropertyOptional({ example: 'user@example.com' })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiPropertyOptional({ example: '+628123456789' })
  @IsString()
  @IsOptional()
  whatsapp_number?: string;
}

export class NotificationContentDto {
  @ApiPropertyOptional({ example: 'Transaksi Berhasil' })
  @IsString()
  @IsOptional()
  title?: string;

  @ApiPropertyOptional({
    example: 'Pembayaran Anda sebesar Rp 150.000 telah diverifikasi.',
  })
  @IsString()
  @IsOptional()
  body?: string;

  @ApiPropertyOptional({ example: 'https://app.domain.com/orders/123' })
  @IsString()
  @IsOptional()
  action_url?: string;
}

export class NotificationRecipientDto {
  @ApiProperty({ example: 'usr_9981' })
  @IsString()
  @IsNotEmpty()
  recipient_id: string;

  @ApiPropertyOptional({ type: NotificationDestinationDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => NotificationDestinationDto)
  destination?: NotificationDestinationDto;
}

export class SendNotificationDto {
  @ApiProperty({ example: 'unique-req-uuid-1234' })
  @IsString()
  @IsNotEmpty()
  idempotency_key: string;

  @ApiPropertyOptional({ example: 'trace-uuid-1234' })
  @IsString()
  @IsOptional()
  trace_id?: string;

  @ApiPropertyOptional({ example: 'cms.soerjo.id' })
  @IsString()
  @IsOptional()
  domain_id?: string;

  @ApiPropertyOptional({ example: 'usr_9981' })
  @IsString()
  @IsOptional()
  recipient_id?: string;

  @ApiProperty({ enum: NotificationChannel, isArray: true })
  @IsArray()
  @ArrayNotEmpty()
  @IsEnum(NotificationChannel, { each: true })
  channels: NotificationChannel[];

  @ApiPropertyOptional({ type: NotificationDestinationDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => NotificationDestinationDto)
  destination?: NotificationDestinationDto;

  @ApiPropertyOptional({ type: NotificationContentDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => NotificationContentDto)
  content?: NotificationContentDto;

  @ApiPropertyOptional({ example: 'otp' })
  @IsString()
  @IsOptional()
  template_code?: string;

  @ApiPropertyOptional({
    example: { source_service: 'billing-service', priority: 'HIGH' },
  })
  @IsObject()
  @IsOptional()
  metadata?: Record<string, unknown>;

  @ApiPropertyOptional({ type: [NotificationRecipientDto] })
  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => NotificationRecipientDto)
  recipients?: NotificationRecipientDto[];
}

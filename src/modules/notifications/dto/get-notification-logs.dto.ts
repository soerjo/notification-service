import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsIn,
  IsInt,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { DeliveryLogStatus, NotificationChannel } from '@prisma/client';

export class GetNotificationLogsDto {
  @ApiProperty({
    description:
      'Start of date range (ISO 8601 string, e.g. 2026-10-01T00:00:00.000Z or 2026-10-01)',
    example: '2026-10-01T00:00:00.000Z',
    required: true,
  })
  @IsISO8601()
  @IsNotEmpty()
  start_date: string;

  @ApiProperty({
    description:
      'End of date range (ISO 8601 string, e.g. 2026-10-25T23:59:59.999Z or 2026-10-25)',
    example: '2026-10-25T23:59:59.999Z',
    required: true,
  })
  @IsISO8601()
  @IsNotEmpty()
  end_date: string;

  @ApiPropertyOptional({
    description: 'Filter logs by specific notification UUID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID()
  @IsOptional()
  notification_id?: string;

  @ApiPropertyOptional({
    description: 'Filter logs by notification channel',
    enum: NotificationChannel,
    example: NotificationChannel.EMAIL,
  })
  @IsEnum(NotificationChannel)
  @IsOptional()
  channel?: NotificationChannel;

  @ApiPropertyOptional({
    description: 'Filter logs by delivery status',
    enum: DeliveryLogStatus,
    example: DeliveryLogStatus.SUCCESS,
  })
  @IsEnum(DeliveryLogStatus)
  @IsOptional()
  status?: DeliveryLogStatus;

  @ApiPropertyOptional({
    description: 'Page number (1-based)',
    example: 1,
    default: 1,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Number of logs per page (max 100)',
    example: 10,
    default: 10,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit?: number = 10;

  @ApiPropertyOptional({
    description: 'Sort order by creation timestamp',
    enum: ['asc', 'desc'],
    example: 'desc',
    default: 'desc',
  })
  @IsIn(['asc', 'desc'])
  @IsOptional()
  order?: 'asc' | 'desc' = 'desc';
}

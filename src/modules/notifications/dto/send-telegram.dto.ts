import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
} from 'class-validator';

export class SendTelegramDto {
  @ApiProperty({ example: 'unique-req-uuid-1234' })
  @IsString()
  @IsNotEmpty()
  idempotency_key: string;

  @ApiProperty({
    example: '987654321',
    description: 'Telegram chat ID or @channelusername',
  })
  @IsString()
  @IsNotEmpty()
  chat_id: string;

  @ApiPropertyOptional({
    example: 'Halo! Transaksi #TRX-123 berhasil diverifikasi.',
  })
  @IsString()
  @IsOptional()
  message?: string;

  @ApiPropertyOptional({ example: 'Transaksi Berhasil' })
  @IsString()
  @IsOptional()
  title?: string;

  @ApiPropertyOptional({
    enum: ['HTML', 'Markdown', 'MarkdownV2'],
    default: 'HTML',
    example: 'HTML',
  })
  @IsIn(['HTML', 'Markdown', 'MarkdownV2'])
  @IsOptional()
  parse_mode?: 'HTML' | 'Markdown' | 'MarkdownV2';

  @ApiPropertyOptional({ example: 'payment_success' })
  @IsString()
  @IsOptional()
  template_code?: string;

  @ApiPropertyOptional({
    example: { amount: 'Rp 150.000', order_id: 'TRX-123' },
  })
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

  @ApiPropertyOptional({ example: { source: 'billing' } })
  @IsObject()
  @IsOptional()
  metadata?: Record<string, unknown>;
}

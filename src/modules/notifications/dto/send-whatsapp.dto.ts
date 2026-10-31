import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator';

export class SendWhatsappDto {
  @ApiProperty({ example: 'unique-req-uuid-1234' })
  @IsString()
  @IsNotEmpty()
  idempotency_key: string;

  @ApiProperty({
    example: '+628123456789',
    description: 'Recipient WhatsApp phone number',
  })
  @IsString()
  @IsNotEmpty()
  phone_number: string;

  @ApiPropertyOptional({
    example: 'Kode OTP Anda adalah: 492810. Rahasiakan kode ini.',
  })
  @IsString()
  @IsOptional()
  message?: string;

  @ApiPropertyOptional({
    example: 'https://cdn.example.com/invoices/inv-001.pdf',
    description: 'Optional media attachment URL supported by Twilio',
  })
  @IsString()
  @IsOptional()
  media_url?: string;

  @ApiPropertyOptional({ example: 'otp_verification' })
  @IsString()
  @IsOptional()
  template_code?: string;

  @ApiPropertyOptional({ example: { otp: '492810' } })
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

  @ApiPropertyOptional({ example: { source: 'auth_service' } })
  @IsObject()
  @IsOptional()
  metadata?: Record<string, unknown>;
}

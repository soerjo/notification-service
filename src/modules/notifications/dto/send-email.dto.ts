import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
} from 'class-validator';

export class SendEmailDto {
  @ApiProperty({ example: 'unique-req-uuid-1234' })
  @IsString()
  @IsNotEmpty()
  idempotency_key: string;

  @ApiPropertyOptional({ example: 'pos.soerjo.id' })
  @IsString()
  @IsOptional()
  domain_id?: string;

  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  @IsNotEmpty()
  to: string;

  @ApiPropertyOptional({ example: 'Password Reset Request' })
  @IsString()
  @IsOptional()
  subject?: string;

  @ApiPropertyOptional({ example: 'Your password reset token is 123456.' })
  @IsString()
  @IsOptional()
  body?: string;

  @ApiPropertyOptional({
    example: '<p>Your password reset token is <strong>123456</strong>.</p>',
  })
  @IsString()
  @IsOptional()
  html?: string;

  @ApiPropertyOptional({
    example: 'manager@example.com',
    description: 'Optional CC email address or list of addresses',
  })
  @IsOptional()
  cc?: string | string[];

  @ApiPropertyOptional({
    example: 'audit@example.com',
    description: 'Optional BCC email address or list of addresses',
  })
  @IsOptional()
  bcc?: string | string[];

  @ApiPropertyOptional({ example: 'support@example.com' })
  @IsEmail()
  @IsOptional()
  reply_to?: string;

  @ApiPropertyOptional({ example: 'password_reset' })
  @IsString()
  @IsOptional()
  template_code?: string;

  @ApiPropertyOptional({ example: { reset_link: 'https://example.com/reset' } })
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

  @ApiPropertyOptional({ example: { campaign: 'security_alert' } })
  @IsObject()
  @IsOptional()
  metadata?: Record<string, unknown>;
}

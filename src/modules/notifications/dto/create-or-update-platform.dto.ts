import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
} from 'class-validator';
import { NotificationChannel } from '@prisma/client';

export class CreateOrUpdatePlatformDto {
  @ApiPropertyOptional({ example: 'pos.soerjo.id' })
  @IsString()
  @IsOptional()
  domain_id?: string;

  @ApiProperty({
    enum: NotificationChannel,
    example: NotificationChannel.EMAIL,
  })
  @IsEnum(NotificationChannel)
  @IsNotEmpty()
  channel: NotificationChannel;

  @ApiProperty({ example: 'hostinger-smtp' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    example: {
      host: 'smtp.hostinger.com',
      port: 465,
      secure: true,
      user: 'info@pos.soerjo.id',
      pass: 'secret-password',
      from: 'POS Soerjo <info@pos.soerjo.id>',
    },
  })
  @IsObject()
  @IsNotEmpty()
  config: Record<string, unknown>;

  @ApiPropertyOptional({ example: false, default: false })
  @IsBoolean()
  @IsOptional()
  is_default?: boolean;

  @ApiPropertyOptional({ example: true, default: true })
  @IsBoolean()
  @IsOptional()
  is_active?: boolean;
}

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';
import { NotificationChannel } from '@prisma/client';

export class CreateOrUpdateTemplateDto {
  @ApiPropertyOptional({ example: 'pos.soerjo.id' })
  @IsString()
  @IsOptional()
  domain_id?: string;

  @ApiProperty({ example: 'order_receipt' })
  @IsString()
  @IsNotEmpty()
  code: string;

  @ApiProperty({
    enum: NotificationChannel,
    example: NotificationChannel.EMAIL,
  })
  @IsEnum(NotificationChannel)
  @IsNotEmpty()
  channel: NotificationChannel;

  @ApiProperty({ example: 'Order Receipt' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({
    example: 'Order receipt email template with itemized details',
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ example: 'Your Receipt for Order #{{order_id}}' })
  @IsString()
  @IsOptional()
  subject?: string;

  @ApiProperty({
    example:
      '<p>Hi {{customer_name}}, thank you for your order #{{order_id}}.</p>',
  })
  @IsString()
  @IsNotEmpty()
  body: string;

  @ApiPropertyOptional({ example: true, default: true })
  @IsBoolean()
  @IsOptional()
  is_active?: boolean;
}

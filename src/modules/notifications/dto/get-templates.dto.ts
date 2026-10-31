import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { NotificationChannel } from '@prisma/client';

export class GetTemplatesDto {
  @ApiPropertyOptional({
    enum: NotificationChannel,
    description: 'Filter templates by notification channel',
  })
  @IsEnum(NotificationChannel)
  @IsOptional()
  channel?: NotificationChannel;

  @ApiPropertyOptional({
    example: 'pos.soerjo.id',
    description: 'Filter templates by domain ID',
  })
  @IsString()
  @IsOptional()
  domain_id?: string;
}

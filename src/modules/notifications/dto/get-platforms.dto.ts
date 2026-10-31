import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { NotificationChannel } from '@prisma/client';

export class GetPlatformsDto {
  @ApiPropertyOptional({
    example: 'pos.soerjo.id',
    description: 'Filter platforms by domain ID',
  })
  @IsString()
  @IsOptional()
  domain_id?: string;

  @ApiPropertyOptional({
    enum: NotificationChannel,
    description: 'Filter platforms by notification channel',
  })
  @IsEnum(NotificationChannel)
  @IsOptional()
  channel?: NotificationChannel;
}

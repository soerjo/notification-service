import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator.js';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly configService: ConfigService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const expectedApiKey =
      this.configService.get<string>('API_KEY') || process.env.API_KEY;
    if (!expectedApiKey) {
      if (process.env.NODE_ENV !== 'production') {
        return true;
      }
      throw new UnauthorizedException('API key is not configured');
    }

    const request = context.switchToHttp().getRequest<{
      headers: Record<string, string | string[] | undefined>;
    }>();
    const xApiKey = request.headers['x-api-key'];
    const authorization = request.headers['authorization'];
    const apiKey =
      (Array.isArray(xApiKey) ? xApiKey[0] : xApiKey) ||
      (Array.isArray(authorization)
        ? authorization[0]
        : authorization
      )?.replace(/^Bearer\s+/i, '');

    if (!apiKey || apiKey !== expectedApiKey) {
      throw new UnauthorizedException('Invalid or missing API key');
    }

    return true;
  }
}

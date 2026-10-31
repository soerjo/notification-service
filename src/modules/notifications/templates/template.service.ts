import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import Handlebars from 'handlebars';
import { NotificationChannel } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service.js';
import { getTemplate } from '../../../templates/index.js';
import {
  extractHandlebarsVariables,
  getSamplePayloadForCode,
} from './template-variables.util.js';
export interface RenderedTemplate {
  title: string;
  body: string;
}

export interface TemplateSummary {
  code: string;
  channel: NotificationChannel;
  name: string;
  description: string | null;
  subject: string | null;
  parameters: string[];
}

export interface TemplateDetails extends TemplateSummary {
  sample_payload: Record<string, unknown> | null;
}

@Injectable()
export class TemplateService {
  private readonly logger = new Logger(TemplateService.name);
  private readonly handlebars = Handlebars.create();
  private readonly compiledCache = new Map<
    string,
    Handlebars.TemplateDelegate
  >();

  constructor(private readonly prisma: PrismaService) {}

  async has(
    code: string,
    channel?: NotificationChannel,
    domainId?: string | null,
  ): Promise<boolean> {
    const codes = [code, code.replace(/_/g, '-'), code.replace(/-/g, '_')];
    if (domainId) {
      // 1. Check domain-specific template first
      const domainTemplate = await this.prisma.template.findFirst({
        where: {
          domainId,
          code: { in: codes },
          ...(channel ? { channel } : {}),
          isActive: true,
        },
      });
      if (domainTemplate) return true;
    }

    // 2. Fallback to global template (domainId is null)
    const globalTemplate = await this.prisma.template.findFirst({
      where: {
        domainId: null,
        code: { in: codes },
        ...(channel ? { channel } : {}),
        isActive: true,
      },
    });
    if (globalTemplate) return true;

    // Fallback to static code templates if present
    return getTemplate(code) !== undefined;
  }

  async listTemplates(
    channel?: NotificationChannel,
  ): Promise<TemplateSummary[]> {
    const where = channel ? { channel, isActive: true } : { isActive: true };
    const dbTemplates = await this.prisma.template.findMany({
      where,
      orderBy: [{ channel: 'asc' }, { code: 'asc' }],
    });

    return dbTemplates.map((tpl) => {
      const subjectVars = extractHandlebarsVariables(tpl.subject);
      const bodyVars = extractHandlebarsVariables(tpl.body);
      const parameters = Array.from(new Set([...subjectVars, ...bodyVars]));

      return {
        code: tpl.code,
        channel: tpl.channel,
        name: tpl.name,
        description: tpl.description,
        subject: tpl.subject,
        parameters,
      };
    });
  }

  async getTemplateDetails(
    code: string,
    channel?: NotificationChannel,
    domainId?: string | null,
  ): Promise<TemplateDetails> {
    const codes = [code, code.replace(/_/g, '-'), code.replace(/-/g, '_')];
    let tpl: {
      id: string;
      domainId: string | null;
      code: string;
      channel: NotificationChannel;
      name: string;
      description: string | null;
      subject: string | null;
      body: string;
      isActive: boolean;
      createdAt: Date;
      updatedAt: Date;
    } | null = null;

    if (domainId) {
      tpl = await this.prisma.template.findFirst({
        where: {
          domainId,
          code: { in: codes },
          ...(channel ? { channel } : {}),
          isActive: true,
        },
      });
    }

    if (!tpl) {
      tpl = await this.prisma.template.findFirst({
        where: {
          domainId: null,
          code: { in: codes },
          ...(channel ? { channel } : {}),
          isActive: true,
        },
      });
    }

    if (!tpl) {
      const staticTpl = getTemplate(code);
      if (staticTpl) {
        const subjectVars = extractHandlebarsVariables(staticTpl.title);
        const bodyVars = extractHandlebarsVariables(staticTpl.body);
        const parameters = Array.from(new Set([...subjectVars, ...bodyVars]));
        return {
          code: staticTpl.code,
          channel: channel ?? NotificationChannel.EMAIL,
          name: staticTpl.title,
          description: null,
          subject: staticTpl.title,
          parameters,
          sample_payload: getSamplePayloadForCode(staticTpl.code),
        };
      }
      throw new NotFoundException(
        `Template with code "${code}" not found${channel ? ` for channel "${channel}"` : ''}`,
      );
    }

    const subjectVars = extractHandlebarsVariables(tpl.subject);
    const bodyVars = extractHandlebarsVariables(tpl.body);
    const parameters = Array.from(new Set([...subjectVars, ...bodyVars]));
    const samplePayload = getSamplePayloadForCode(tpl.code);

    return {
      code: tpl.code,
      channel: tpl.channel,
      name: tpl.name,
      description: tpl.description,
      subject: tpl.subject,
      parameters,
      sample_payload: samplePayload,
    };
  }

  async render(
    code: string,
    channel: NotificationChannel,
    context: Record<string, unknown>,
    domainId?: string | null,
  ): Promise<RenderedTemplate> {
    const codes = [code, code.replace(/_/g, '-'), code.replace(/-/g, '_')];

    // 1. Try finding domain-specific template in database
    if (domainId) {
      const domainTemplate = await this.prisma.template.findFirst({
        where: { domainId, code: { in: codes }, channel, isActive: true },
      });
      if (domainTemplate) {
        const titleDelegate = this.compile(
          `${domainId}:${code}:${channel}:title`,
          domainTemplate.subject ?? domainTemplate.name,
        );
        const bodyDelegate = this.compile(
          `${domainId}:${code}:${channel}:body`,
          domainTemplate.body,
        );

        return {
          title: titleDelegate(context),
          body: bodyDelegate(context),
        };
      }
    }

    // 2. Try finding global channel-specific template in database
    const dbTemplate = await this.prisma.template.findFirst({
      where: { domainId: null, code: { in: codes }, channel, isActive: true },
    });
    if (dbTemplate) {
      const titleDelegate = this.compile(
        `global:${code}:${channel}:title`,
        dbTemplate.subject ?? dbTemplate.name,
      );
      const bodyDelegate = this.compile(
        `global:${code}:${channel}:body`,
        dbTemplate.body,
      );

      return {
        title: titleDelegate(context),
        body: bodyDelegate(context),
      };
    }

    // 3. Fallback to any active channel template with same code in database
    const fallbackDb = await this.prisma.template.findFirst({
      where: { code: { in: codes }, isActive: true },
    });
    if (fallbackDb) {
      const titleDelegate = this.compile(
        `${fallbackDb.domainId ?? 'global'}:${code}:${fallbackDb.channel}:title`,
        fallbackDb.subject ?? fallbackDb.name,
      );
      const bodyDelegate = this.compile(
        `${fallbackDb.domainId ?? 'global'}:${code}:${fallbackDb.channel}:body`,
        fallbackDb.body,
      );

      return {
        title: titleDelegate(context),
        body: bodyDelegate(context),
      };
    }

    // 4. Fallback to hardcoded code-based templates
    const staticTemplate = getTemplate(code);
    if (staticTemplate) {
      const titleDelegate = this.compile(
        `${code}:static:title`,
        staticTemplate.title,
      );
      const bodyDelegate = this.compile(
        `${code}:static:body`,
        staticTemplate.body,
      );

      return {
        title: titleDelegate(context),
        body: bodyDelegate(context),
      };
    }

    throw new Error(
      `Unknown notification template "${code}" for channel "${channel}"`,
    );
  }

  async renderBody(
    code: string,
    channel: NotificationChannel,
    context: Record<string, unknown>,
    domainId?: string | null,
  ): Promise<string> {
    const rendered = await this.render(code, channel, context, domainId);
    return rendered.body;
  }

  private compile(
    cacheKey: string,
    source: string,
  ): Handlebars.TemplateDelegate {
    const cached = this.compiledCache.get(cacheKey);
    if (cached) {
      return cached;
    }
    const compiled = this.handlebars.compile(source);
    this.compiledCache.set(cacheKey, compiled);
    return compiled;
  }
}

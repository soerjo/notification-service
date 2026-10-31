import Handlebars from 'handlebars';
import fs from 'node:fs';
import path from 'node:path';

const SAMPLE_PAYLOAD_MAP: Record<string, string> = {
  'verification-email': '01-verification-email.json',
  'welcome-registration': '02-welcome-registration-success.json',
  'forgot-password-redirect': '03-forgot-password-redirect.json',
  'request-reset-password': '04-request-reset-password.json',
  'otp-code': '05-otp-code.json',
  otp: '05-otp-code.json',
  'transaction-success': '06-transaction-success.json',
  'official-invoice': '07-official-invoice.json',
  invoice: '07-official-invoice.json',
  'purchase-order': '08-purchase-order.json',
  po: '08-purchase-order.json',
  'subscription-renewal': '09-subscription-renewal.json',
  'security-alert-new-login': '10-security-alert-new-login.json',
};

export function extractHandlebarsVariables(source?: string | null): string[] {
  if (!source || typeof source !== 'string') {
    return [];
  }

  try {
    const ast = Handlebars.parse(source);
    const vars = new Set<string>();

    const addParam = (param: unknown) => {
      if (
        param &&
        typeof param === 'object' &&
        'original' in param &&
        typeof param.original === 'string'
      ) {
        vars.add(param.original);
      }
    };

    const walk = (node: hbs.AST.Node | undefined) => {
      if (!node) return;
      if (
        node.type === 'MustacheStatement' &&
        'path' in node &&
        node.path &&
        typeof node.path === 'object' &&
        'original' in node.path &&
        typeof node.path.original === 'string'
      ) {
        const name = node.path.original;
        if (
          name &&
          !['if', 'unless', 'each', 'with', 'lookup'].includes(name)
        ) {
          vars.add(name);
        }
      }

      if (node.type === 'BlockStatement') {
        if (
          'path' in node &&
          node.path &&
          typeof node.path === 'object' &&
          'original' in node.path &&
          typeof node.path.original === 'string'
        ) {
          const name = node.path.original;
          if (
            name &&
            !['if', 'unless', 'each', 'with', 'lookup'].includes(name)
          ) {
            vars.add(name);
          }
        }
        if (
          'program' in node &&
          node.program &&
          typeof node.program === 'object' &&
          'body' in node.program &&
          Array.isArray(node.program.body)
        ) {
          for (const child of node.program.body) {
            walk(child as hbs.AST.Node);
          }
        }
        if (
          'inverse' in node &&
          node.inverse &&
          typeof node.inverse === 'object' &&
          'body' in node.inverse &&
          Array.isArray(node.inverse.body)
        ) {
          for (const child of node.inverse.body) {
            walk(child as hbs.AST.Node);
          }
        }
      }

      if ('params' in node && Array.isArray(node.params)) {
        for (const p of node.params) {
          addParam(p);
        }
      }

      if ('body' in node && Array.isArray(node.body)) {
        for (const child of node.body) {
          walk(child as hbs.AST.Node);
        }
      }
    };

    walk(ast);
    return Array.from(vars);
  } catch {
    return [];
  }
}

export function getSamplePayloadForCode(
  code: string,
): Record<string, unknown> | null {
  const normalized = code.replace(/_/g, '-');
  const filename = SAMPLE_PAYLOAD_MAP[normalized] ?? SAMPLE_PAYLOAD_MAP[code];
  if (!filename) {
    return null;
  }

  const payloadPath = path.resolve(
    process.cwd(),
    'prisma/email-templates/sample-payloads',
    filename,
  );

  if (fs.existsSync(payloadPath)) {
    try {
      const content = fs.readFileSync(payloadPath, 'utf8');
      return JSON.parse(content) as Record<string, unknown>;
    } catch {
      return null;
    }
  }

  return null;
}

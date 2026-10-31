import { NotificationChannel, PrismaClient } from '@prisma/client';
import fs from 'node:fs';
import path from 'node:path';

const prisma = new PrismaClient();

interface TemplateSeed {
  fileName: string;
  code: string;
  aliases?: string[];
  name: string;
  description: string;
  subject: string;
}

const EMAIL_TEMPLATES: TemplateSeed[] = [
  {
    fileName: '01-verification-email.html',
    code: 'verification-email',
    aliases: [
      'verification_email',
      'verify-email',
      'verify_email',
      'auth-email-verification',
      'auth_email_verification',
    ],
    name: 'Email Verification',
    description: 'Account activation and email verification link',
    subject: 'Please verify your email address',
  },
  {
    fileName: '02-welcome-registration-success.html',
    code: 'welcome-registration',
    aliases: ['welcome_registration', 'welcome-email', 'welcome_email'],
    name: 'Welcome & Registration Success',
    description: 'Onboarding welcome email after successful sign-up',
    subject: 'Welcome to {{company_name}}, {{user_name}}!',
  },
  {
    fileName: '03-forgot-password-redirect.html',
    code: 'forgot-password-redirect',
    aliases: ['forgot_password_redirect', 'forgot-password', 'forgot_password'],
    name: 'Forgot Password Redirect',
    description: 'Security notice when password reset is requested',
    subject: 'Forgot your password?',
  },
  {
    fileName: '04-request-reset-password.html',
    code: 'request-reset-password',
    aliases: [
      'request_reset_password',
      'reset-password',
      'reset_password',
      'auth-password-reset',
      'auth_password_reset',
    ],
    name: 'Password Reset Request',
    description: 'Actionable password reset button with expiration',
    subject: 'Password Reset Request',
  },
  {
    fileName: '05-otp-code.html',
    code: 'otp-code',
    aliases: ['otp_code', 'otp'],
    name: 'Two-Factor OTP Code',
    description: 'Security verification OTP code display',
    subject: 'Your Two-Factor Code: {{otp_code}}',
  },
  {
    fileName: '06-transaction-success.html',
    code: 'transaction-success',
    aliases: ['transaction_success', 'payment-success', 'payment_success'],
    name: 'Transaction Success',
    description: 'Payment receipt and transaction confirmation',
    subject: 'Payment Received - {{transaction_id}}',
  },
  {
    fileName: '07-official-invoice.html',
    code: 'official-invoice',
    aliases: ['official_invoice', 'invoice'],
    name: 'Official Invoice',
    description: 'Billed invoice with breakdown table and tax details',
    subject: 'Invoice {{invoice_number}} from {{company_name}}',
  },
  {
    fileName: '08-purchase-order.html',
    code: 'purchase-order',
    aliases: ['purchase_order', 'po'],
    name: 'Purchase Order',
    description: 'Vendor purchase order notification with line items',
    subject: 'Purchase Order #{{po_number}}',
  },
  {
    fileName: '09-subscription-renewal.html',
    code: 'subscription-renewal',
    aliases: ['subscription_renewal', 'plan-renewal', 'plan_renewal'],
    name: 'Subscription Renewal Notice',
    description: 'Upcoming plan renewal and billing date reminder',
    subject: 'Upcoming Plan Renewal - {{plan_name}}',
  },
  {
    fileName: '10-security-alert-new-login.html',
    code: 'security-alert-new-login',
    aliases: ['security_alert_new_login', 'new-login-alert', 'new_login_alert'],
    name: 'Security Alert - New Login',
    description: 'Unrecognized login attempt alert with device details',
    subject: 'New Login Detected from {{device_name}}',
  },
];

async function main() {
  const templatesDir = path.resolve(
    process.cwd(),
    'prisma/email-templates',
  );

  console.log(`Loading email templates from: ${templatesDir}`);

  for (const item of EMAIL_TEMPLATES) {
    const filePath = path.join(templatesDir, item.fileName);
    if (!fs.existsSync(filePath)) {
      console.warn(`Template file not found: ${filePath}, skipping...`);
      continue;
    }

    const body = fs.readFileSync(filePath, 'utf8');
    const allCodes = [item.code, ...(item.aliases ?? [])];

    for (const code of allCodes) {
      const existing = await prisma.template.findFirst({
        where: {
          domainId: null,
          code,
          channel: NotificationChannel.EMAIL,
        },
      });

      if (existing) {
        await prisma.template.update({
          where: { id: existing.id },
          data: {
            name: item.name,
            description: item.description,
            subject: item.subject,
            body,
            isActive: true,
          },
        });
      } else {
        await prisma.template.create({
          data: {
            domainId: null,
            code,
            channel: NotificationChannel.EMAIL,
            name: item.name,
            description: item.description,
            subject: item.subject,
            body,
            isActive: true,
          },
        });
      }
      console.log(`✓ Seeded template [EMAIL] ${code}`);
    }
  }

  console.log('Seeding completed successfully.');
}

main()
  .catch((e) => {
    console.error('Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

import nodemailer from 'nodemailer';
import prisma from './prisma';

export const EMAIL_CONFIGURED = Boolean(
  process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS,
);

const MAX_ATTEMPTS = 5;

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
}

function getTransport() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

/**
 * Queue an email for delivery. When SMTP is not configured the email is logged
 * to the console (development fallback) so callers never need to branch.
 */
export async function queueEmail(msg: EmailMessage) {
  try {
    if (!EMAIL_CONFIGURED) {
      console.log(`[email:dev] To: ${msg.to} | Subject: ${msg.subject}`);
      return null;
    }
    return await prisma.emailOutbox.create({
      data: { to: msg.to, subject: msg.subject, html: msg.html },
    });
  } catch (err) {
    // Email must never break the main flow.
    console.error('Email queue failed:', err);
    return null;
  }
}

/**
 * Deliver a batch of queued emails. Used by the cron worker and can be called
 * on demand. Returns a small summary for tests/logging.
 */
export async function flushEmailQueue(batch = 50) {
  const summary = { sent: 0, failed: 0, remaining: 0 };
  if (!EMAIL_CONFIGURED) return summary;

  const transport = getTransport();
  const fromName = process.env.SMTP_FROM_NAME || 'HR Pro';
  const fromAddress = process.env.SMTP_FROM || (process.env.SMTP_USER as string);

  const pending = await prisma.emailOutbox.findMany({
    where: { status: 'PENDING' },
    orderBy: { createdAt: 'asc' },
    take: batch,
  });

  for (const mail of pending) {
    try {
      await transport.sendMail({
        from: `"${fromName}" <${fromAddress}>`,
        to: mail.to,
        subject: mail.subject,
        html: mail.html,
      });
      await prisma.emailOutbox.update({
        where: { id: mail.id },
        data: { status: 'SENT', sentAt: new Date() },
      });
      summary.sent += 1;
    } catch (err: any) {
      const attempts = mail.attempts + 1;
      await prisma.emailOutbox.update({
        where: { id: mail.id },
        data: {
          status: attempts >= MAX_ATTEMPTS ? 'FAILED' : 'PENDING',
          attempts,
          error: String(err?.message || err).slice(0, 500),
        },
      });
      summary.failed += 1;
    }
  }

  summary.remaining = await prisma.emailOutbox.count({ where: { status: 'PENDING' } });
  return summary;
}

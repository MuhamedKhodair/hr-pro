import cron from 'node-cron';
import prisma from './prisma';
import { flushEmailQueue } from './email';
import { pendingLeaveDigestEmail } from './emailTemplates';
import { queueEmail } from './email';

async function cleanupExpired() {
  const now = new Date();
  await prisma.$transaction([
    prisma.refreshToken.deleteMany({ where: { expiresAt: { lt: now } } }),
    prisma.notification.deleteMany({
      where: { read: true, createdAt: { lt: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000) } },
    }),
    prisma.emailOutbox.deleteMany({
      where: {
        status: { in: ['SENT', 'FAILED'] },
        createdAt: { lt: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) },
      },
    }),
  ]);
}

async function sendPendingLeaveDigest() {
  try {
    const pendingCount = await prisma.leaveRequest.count({
      where: { status: 'Pending', isCancelled: false },
    });
    if (!pendingCount) return;
    const recipients = await prisma.user.findMany({
      where: { role: { in: ['Admin', 'HR'] } },
      select: { email: true },
    });
    const email = pendingLeaveDigestEmail({ count: pendingCount, link: process.env.FRONTEND_URL || 'http://localhost:3000/leaves' });
    for (const user of recipients) {
      await queueEmail({ to: user.email, subject: email.subject, html: email.html });
    }
  } catch (err) {
    console.error('Daily leave digest failed:', err);
  }
}

export function startCron() {
  // Email queue: flush every 2 minutes.
  cron.schedule('*/2 * * * *', () => {
    flushEmailQueue().catch((err) => console.error('Email flush failed:', err));
  });

  // Housekeeping: purge expired tokens / stale rows nightly at 03:00.
  cron.schedule('0 3 * * *', () => {
    cleanupExpired().catch((err) => console.error('Cron cleanup failed:', err));
  });

  // Daily digest of pending leave requests for Admin/HR at 07:00.
  cron.schedule('0 7 * * *', () => {
    sendPendingLeaveDigest().catch((err) => console.error('Cron digest failed:', err));
  });
}

export { cleanupExpired, sendPendingLeaveDigest };

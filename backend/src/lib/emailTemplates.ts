function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function layout(title: string, bodyHtml: string): string {
  const company = escapeHtml(process.env.SMTP_FROM_NAME || 'HR Pro');
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Inter,-apple-system,Segoe UI,Roboto,sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:32px 16px;">
    <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
      <div style="background:#2563eb;padding:18px 28px;">
        <span style="color:#ffffff;font-size:16px;font-weight:700;letter-spacing:0.01em;">${company}</span>
      </div>
      <div style="padding:28px;color:#1e293b;font-size:14px;line-height:1.6;">
        ${bodyHtml}
      </div>
      <div style="padding:16px 28px;border-top:1px solid #e2e8f0;color:#64748b;font-size:12px;">
        This is an automated message from your HR system. Please do not reply to this email.
      </div>
    </div>
  </div>
</body>
</html>`;
}

function paragraph(text: string): string {
  return `<p style="margin:0 0 16px;">${escapeHtml(text)}</p>`;
}

export interface RenderedEmail {
  subject: string;
  html: string;
}

export function accountCreatedEmail(userEmail: string): RenderedEmail {
  const subject = 'Your HR Pro account is ready';
  const html = layout(
    subject,
    `${paragraph('Hello,')}
     ${paragraph(`An account has been created for you with email ${escapeHtml(userEmail)}. You will be asked to set a new password the first time you sign in.`)}
     <p style="margin:0;">&mdash; HR Team</p>`,
  );
  return { subject, html };
}

export function passwordResetEmail(userEmail: string): RenderedEmail {
  const subject = 'Your HR Pro password was reset';
  const html = layout(
    subject,
    `${paragraph('Hello,')}
     ${paragraph(`Your password for ${escapeHtml(userEmail)} was reset by an administrator. The next time you sign in you will be required to choose a new password.`)}
     <p style="margin:0;">&mdash; HR Team</p>`,
  );
  return { subject, html };
}

export function leaveReviewedEmail(options: {
  employeeName: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  status: 'Approved' | 'Rejected';
  comment?: string;
}): RenderedEmail {
  const subject = `Leave request ${options.status.toLowerCase()} — ${options.leaveType}`;
  const statusColor = options.status === 'Approved' ? '#16a34a' : '#dc2626';
  const html = layout(
    subject,
    `${paragraph(`Hi ${escapeHtml(options.employeeName)},`)}
     ${paragraph(`Your leave request has been <strong style="color:${statusColor};">${escapeHtml(options.status.toLowerCase())}</strong>.`)}
     <table style="width:100%;border-collapse:collapse;margin:0 0 16px;font-size:13px;">
       <tr><td style="padding:6px 0;color:#64748b;">Type</td><td style="padding:6px 0;font-weight:600;">${escapeHtml(options.leaveType)}</td></tr>
       <tr><td style="padding:6px 0;color:#64748b;">From</td><td style="padding:6px 0;font-weight:600;">${escapeHtml(options.startDate)}</td></tr>
       <tr><td style="padding:6px 0;color:#64748b;">To</td><td style="padding:6px 0;font-weight:600;">${escapeHtml(options.endDate)}</td></tr>
       ${options.comment ? `<tr><td style="padding:6px 0;color:#64748b;">Comment</td><td style="padding:6px 0;">${escapeHtml(options.comment)}</td></tr>` : ''}
     </table>
     <p style="margin:0;">&mdash; HR Team</p>`,
  );
  return { subject, html };
}

export function payrollReadyEmail(options: {
  employeeName: string;
  periodLabel: string;
  netSalary: string;
  currency: string;
}): RenderedEmail {
  const subject = `Your payslip for ${options.periodLabel} is ready`;
  const html = layout(
    subject,
    `${paragraph(`Hi ${escapeHtml(options.employeeName)},`)}
     ${paragraph(`Your payslip for <strong>${escapeHtml(options.periodLabel)}</strong> has been generated.`)}
     <p style="margin:0 0 16px;font-size:16px;">Net salary: <strong>${escapeHtml(options.currency)} ${escapeHtml(options.netSalary)}</strong></p>
     <p style="margin:0;">Sign in to the HR portal to download your payslip.</p>`,
  );
  return { subject, html };
}

export function pendingLeaveDigestEmail(options: { count: number; link: string }): RenderedEmail {
  const subject = options.count > 0 ? `${options.count} leave request(s) awaiting review` : 'No pending leave requests';
  const html = layout(
    subject,
    options.count > 0
      ? `${paragraph('Hello,')}
         ${paragraph(`There ${options.count === 1 ? 'is' : 'are'} <strong>${options.count}</strong> leave request(s) waiting for review in the HR portal.`)}
         <table role="presentation" style="margin:0 0 16px;"><tr><td style="border-radius:8px;background:#2563eb;">
           <a href="${escapeHtml(options.link)}" style="display:inline-block;padding:10px 20px;color:#ffffff;text-decoration:none;font-size:13px;font-weight:600;">Review now</a>
         </td></tr></table>
         <p style="margin:0;">&mdash; HR Team</p>`
      : `${paragraph('Good news,')}
         ${paragraph('there are no leave requests waiting for review.')}`,
  );
  return { subject, html };
}

export function candidateStatusEmail(candidateName: string, jobTitle: string, status: string): RenderedEmail {
  const subject = `Application update — ${jobTitle}`;
  const color = status === 'HIRED' ? '#16a34a' : status === 'OFFER' ? '#2563eb' : '#dc2626';
  const message =
    status === 'HIRED'
      ? `Congratulations! You have been <strong style="color:${color};">hired</strong> for the ${escapeHtml(jobTitle)} position.`
      : status === 'OFFER'
        ? `We are pleased to extend an <strong style="color:${color};">offer</strong> for the ${escapeHtml(jobTitle)} position.`
        : `Thank you for your interest in the ${escapeHtml(jobTitle)} position. Unfortunately, we have decided to close this application.`;
  const html = layout(
    subject,
    `${paragraph(`Hi ${escapeHtml(candidateName)},`)}
     ${paragraph(message)}
     <p style="margin:0;">&mdash; HR Team</p>`,
  );
  return { subject, html };
}

export function interviewScheduledEmail(candidateName: string, jobTitle: string, scheduledAt: Date, type: string): RenderedEmail {
  const subject = `Interview scheduled — ${jobTitle}`;
  const html = layout(
    subject,
    `${paragraph(`Hi ${escapeHtml(candidateName)},`)}
     ${paragraph(`An interview has been scheduled for the <strong>${escapeHtml(jobTitle)}</strong> position.`)}
     <table style="width:100%;border-collapse:collapse;margin:0 0 16px;font-size:13px;">
       <tr><td style="padding:6px 0;color:#64748b;">Date &amp; time</td><td style="padding:6px 0;font-weight:600;">${escapeHtml(scheduledAt.toLocaleString('en-GB', { timeZone: 'UTC' }))} UTC</td></tr>
       <tr><td style="padding:6px 0;color:#64748b;">Type</td><td style="padding:6px 0;font-weight:600;">${escapeHtml(type.replace('_', ' '))}</td></tr>
     </table>
     <p style="margin:0;">&mdash; HR Team</p>`,
  );
  return { subject, html };
}
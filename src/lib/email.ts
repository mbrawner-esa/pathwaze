// Resend wrapper. Lazily imports the SDK so we don't crash when RESEND_API_KEY
// isn't set — caller can decide whether to surface that to the user.

interface InviteEmailParams {
  to: string
  inviterName: string
  loginUrl: string
  /** Kept for API compatibility; no longer used. */
  origin?: string
}

interface TaskAssignedEmailParams {
  to: string
  recipientName: string
  taskTitle: string
  taskDescription: string | null
  projectName: string | null
  dueDate: string | null
  priority: string | null
  type: string | null
  assignerName: string
  taskUrl: string
}

interface TaskCompletedEmailParams {
  to: string
  recipientName: string
  taskTitle: string
  projectName: string | null
  completerName: string
  taskUrl: string
}

type SendResult = { sent: boolean; error?: string }

// ───────────────────────────── Public API ─────────────────────────────

export async function sendInviteEmail(params: InviteEmailParams): Promise<SendResult> {
  return send({
    to: params.to,
    subject: `${params.inviterName} invited you to Pathwaze`,
    html: inviteHtml(params),
  })
}

export async function sendTaskAssignedEmail(params: TaskAssignedEmailParams): Promise<SendResult> {
  return send({
    to: params.to,
    subject: `${params.assignerName} assigned you: ${params.taskTitle}`,
    html: taskAssignedHtml(params),
  })
}

export async function sendTaskCompletedEmail(params: TaskCompletedEmailParams): Promise<SendResult> {
  return send({
    to: params.to,
    subject: `Task complete: ${params.taskTitle}`,
    html: taskCompletedHtml(params),
  })
}

// ──────────────────────────── Resend helper ───────────────────────────

async function send(args: { to: string; subject: string; html: string }): Promise<SendResult> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return { sent: false, error: 'RESEND_API_KEY not configured' }

  try {
    const { Resend } = await import('resend')
    const resend = new Resend(apiKey)
    const fromRaw = process.env.RESEND_FROM || 'Pathwaze <onboarding@resend.dev>'
    // Defensive: bare email wrapped in angle brackets ("<noreply@x.com>") is
    // invalid per Resend. Strip them so a misconfigured env var doesn't break sends.
    const from = /^<[^>]+>$/.test(fromRaw.trim()) ? fromRaw.trim().slice(1, -1) : fromRaw

    const { error } = await resend.emails.send({ from, to: args.to, subject: args.subject, html: args.html })
    if (error) return { sent: false, error: error.message || 'Resend send failed' }
    return { sent: true }
  } catch (e) {
    return { sent: false, error: e instanceof Error ? e.message : 'Unknown send error' }
  }
}

// ──────────────────────────── HTML templates ──────────────────────────
// All templates share the same outer shell (navy header + white card).
// Logo is served as a static asset from public/email-logo.png — no CID,
// no attachments, no auth gates. The middleware exempts /email-logo* so
// it's publicly reachable.

function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL || 'https://pathwaze.vercel.app'
}

function shell(bodyHtml: string): string {
  const logoUrl = `${appUrl()}/email-logo.png`
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="540" cellpadding="0" cellspacing="0" style="max-width:540px;background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 1px 3px rgba(15,27,38,0.08);">
        <tr>
          <td style="background:#1C303C;padding:24px 32px;text-align:left;">
            <img src="${logoUrl}" alt="Pathwaze" width="160" height="40" style="display:block;width:160px;height:40px;border:0;outline:none;text-decoration:none;" />
          </td>
        </tr>
        ${bodyHtml}
      </table>
      <div style="margin-top:18px;font-size:11px;color:#94a3b8;">© ESA Solar Energy, LLC and Affiliates</div>
    </td></tr>
  </table>
</body>
</html>`
}

function ctaButton(label: string, href: string, bg = '#2C5485'): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0">
    <tr><td style="border-radius:8px;background:${bg};">
      <a href="${href}" style="display:inline-block;padding:13px 26px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;">${label}</a>
    </td></tr>
  </table>`
}

function metaRow(label: string, value: string): string {
  return `<tr>
    <td style="padding:6px 16px 6px 0;font-size:12px;color:#706E6B;width:90px;vertical-align:top;">${label}</td>
    <td style="padding:6px 0;font-size:13px;color:#181818;vertical-align:top;">${value}</td>
  </tr>`
}

// ────── Invite ──────

function inviteHtml({ inviterName, loginUrl }: InviteEmailParams): string {
  return shell(`
    <tr>
      <td style="padding:32px 32px 8px 32px;">
        <h1 style="margin:0 0 14px 0;font-size:20px;font-weight:700;color:#181818;line-height:1.3;">
          You&rsquo;ve been invited to Pathwaze
        </h1>
        <p style="margin:0 0 16px 0;font-size:14.5px;color:#3E3E3C;line-height:1.55;">
          <strong>${escapeHtml(inviterName)}</strong> added you as a teammate on Pathwaze, our project management workspace for ESA Solar.
        </p>
        <p style="margin:0 0 24px 0;font-size:14.5px;color:#3E3E3C;line-height:1.55;">
          Sign in with your Slack account to get started — your access is already approved, no extra steps needed.
        </p>
        ${ctaButton('Sign in with Slack', loginUrl, '#4A154B')}
        <p style="margin:24px 0 0 0;font-size:12px;color:#94a3b8;line-height:1.55;">
          Or paste this link into your browser: <a href="${loginUrl}" style="color:#2C5485;">${loginUrl}</a>
        </p>
      </td>
    </tr>
    <tr>
      <td style="padding:24px 32px;background:#fafbfc;border-top:1px solid #e2e8f0;">
        <p style="margin:0;font-size:11.5px;color:#94a3b8;line-height:1.5;">
          If you weren&rsquo;t expecting this invitation, you can ignore this email. It will expire if unused.
        </p>
      </td>
    </tr>`)
}

// ────── Task assigned ──────

function taskAssignedHtml(p: TaskAssignedEmailParams): string {
  const meta: string[] = []
  if (p.projectName) meta.push(metaRow('Project', escapeHtml(p.projectName)))
  if (p.dueDate) meta.push(metaRow('Due', escapeHtml(formatDate(p.dueDate))))
  if (p.priority) meta.push(metaRow('Priority', escapeHtml(p.priority)))
  if (p.type) meta.push(metaRow('Type', escapeHtml(p.type)))

  return shell(`
    <tr>
      <td style="padding:32px 32px 8px 32px;">
        <h1 style="margin:0 0 6px 0;font-size:20px;font-weight:700;color:#181818;line-height:1.3;">
          ${escapeHtml(p.assignerName)} assigned you a task
        </h1>
        <p style="margin:0 0 20px 0;font-size:13px;color:#706E6B;">Hi ${escapeHtml(firstName(p.recipientName))} —</p>

        <div style="padding:16px 18px;background:#f8fafc;border-left:3px solid #70A0D0;border-radius:6px;margin-bottom:20px;">
          <p style="margin:0 0 8px 0;font-size:15px;font-weight:600;color:#181818;line-height:1.35;">${escapeHtml(p.taskTitle)}</p>
          ${p.taskDescription ? `<p style="margin:0;font-size:13px;color:#3E3E3C;line-height:1.5;">${escapeHtml(p.taskDescription)}</p>` : ''}
        </div>

        ${meta.length ? `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin-bottom:24px;">${meta.join('')}</table>` : ''}

        ${ctaButton('Open task', p.taskUrl)}
      </td>
    </tr>
    <tr>
      <td style="padding:24px 32px;background:#fafbfc;border-top:1px solid #e2e8f0;">
        <p style="margin:0;font-size:11.5px;color:#94a3b8;line-height:1.5;">
          You can change which task notifications you receive in <a href="${appUrl()}/settings" style="color:#2C5485;">Settings</a>.
        </p>
      </td>
    </tr>`)
}

// ────── Task completed ──────

function taskCompletedHtml(p: TaskCompletedEmailParams): string {
  return shell(`
    <tr>
      <td style="padding:32px 32px 8px 32px;">
        <table role="presentation" cellpadding="0" cellspacing="0" style="margin-bottom:18px;">
          <tr>
            <td style="vertical-align:middle;padding-right:10px;">
              <div style="width:28px;height:28px;background:#D1FAE5;border-radius:50%;display:flex;align-items:center;justify-content:center;">
                <span style="color:#047857;font-size:16px;font-weight:700;line-height:1;">&#10003;</span>
              </div>
            </td>
            <td style="vertical-align:middle;">
              <h1 style="margin:0;font-size:20px;font-weight:700;color:#181818;line-height:1.3;">Task complete</h1>
            </td>
          </tr>
        </table>

        <p style="margin:0 0 16px 0;font-size:14.5px;color:#3E3E3C;line-height:1.55;">
          Hi ${escapeHtml(firstName(p.recipientName))} — <strong>${escapeHtml(p.completerName)}</strong> marked a task you created as complete:
        </p>

        <div style="padding:16px 18px;background:#f8fafc;border-left:3px solid #10b981;border-radius:6px;margin-bottom:24px;">
          <p style="margin:0 0 4px 0;font-size:15px;font-weight:600;color:#181818;line-height:1.35;">${escapeHtml(p.taskTitle)}</p>
          ${p.projectName ? `<p style="margin:0;font-size:12.5px;color:#706E6B;">${escapeHtml(p.projectName)}</p>` : ''}
        </div>

        ${ctaButton('View task', p.taskUrl)}
      </td>
    </tr>
    <tr>
      <td style="padding:24px 32px;background:#fafbfc;border-top:1px solid #e2e8f0;">
        <p style="margin:0;font-size:11.5px;color:#94a3b8;line-height:1.5;">
          You can change which task notifications you receive in <a href="${appUrl()}/settings" style="color:#2C5485;">Settings</a>.
        </p>
      </td>
    </tr>`)
}

// ──────────────────────────────── Utils ───────────────────────────────

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))
}

function firstName(full: string): string {
  return (full || 'there').trim().split(/\s+/)[0]
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  } catch {
    return iso
  }
}

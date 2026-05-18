// Resend wrapper. Lazily imports the SDK so we don't crash when RESEND_API_KEY
// isn't set — caller can decide whether to surface that to the user.

interface InviteEmailParams {
  to: string
  inviterName: string
  loginUrl: string
}

export async function sendInviteEmail(params: InviteEmailParams): Promise<{ sent: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return { sent: false, error: 'RESEND_API_KEY not configured' }

  try {
    const { Resend } = await import('resend')
    const resend = new Resend(apiKey)
    const from = process.env.RESEND_FROM || 'Pathwaze <onboarding@resend.dev>'

    const { error } = await resend.emails.send({
      from,
      to: params.to,
      subject: `${params.inviterName} invited you to Pathwaze`,
      html: inviteHtml(params),
    })
    if (error) return { sent: false, error: error.message || 'Resend send failed' }
    return { sent: true }
  } catch (e) {
    return { sent: false, error: e instanceof Error ? e.message : 'Unknown send error' }
  }
}

function inviteHtml({ inviterName, loginUrl }: InviteEmailParams): string {
  // Absolute logo URL — points at the live /icon.png so swapping the file
  // automatically updates every future email without code changes.
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const logoUrl = `${appUrl}/icon.png`

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="540" cellpadding="0" cellspacing="0" style="max-width:540px;background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 1px 3px rgba(15,27,38,0.08);">
        <tr>
          <td style="background:#1C303C;padding:24px 32px;text-align:left;">
            <img src="${logoUrl}" alt="Pathwaze" height="40" style="display:block;height:40px;width:auto;border:0;outline:none;text-decoration:none;" />
          </td>
        </tr>
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
            <table role="presentation" cellpadding="0" cellspacing="0">
              <tr><td style="border-radius:8px;background:#4A154B;">
                <a href="${loginUrl}" style="display:inline-block;padding:13px 26px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;">
                  Sign in with Slack
                </a>
              </td></tr>
            </table>
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
        </tr>
      </table>
      <div style="margin-top:18px;font-size:11px;color:#94a3b8;">© ESA Solar Energy, LLC and Affiliates</div>
    </td></tr>
  </table>
</body>
</html>`
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))
}

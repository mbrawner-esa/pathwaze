/**
 * What's New — the release note shown in the login modal and on /whats-new.
 *
 * This is the single source of truth for both surfaces. To ship the next
 * update: rewrite RELEASE below and bump `key`. Every user's
 * `users.whats_new_seen` will no longer match, so the modal fires once for
 * each of them on their next page load (see WhatsNewGate).
 *
 * `summary` is what the modal shows (scannable). `body` / `howTo` are the
 * long-form detail, rendered only on /whats-new.
 */

export interface ReleaseSection {
  id: string
  /** Emoji used as the section marker on both surfaces. */
  icon: string
  title: string
  /** One line, shown in the modal list and under the heading on the page. */
  summary: string
  /** Long-form paragraphs, page only. */
  body: string[]
  /** Optional step-by-step for features with a real learning curve. */
  howTo?: { title: string; steps: string[]; note?: string }
  /** Optional deep link into the feature. */
  link?: { href: string; label: string }
}

export interface Release {
  key: string
  title: string
  window: string
  intro: string
  sections: ReleaseSection[]
  next: { title: string; detail: string }[]
}

export const RELEASE: Release = {
  key: '2026-08-21-summer',
  title: 'Summer Release',
  window: 'June 9 – August 21, 2026',
  intro:
    'Pathwaze went live on June 9. Three release waves later, here is everything that changed — what it does, and how to use the parts that need a walkthrough.',

  sections: [
    {
      id: 'drawings',
      icon: '📐',
      title: 'Drawings, Site Plans & reviews',
      summary:
        'Structured as-built reviews on every project — and Site Plans that link to systems and keep the Technical tab current on their own.',
      body: [
        'Every project now has a Drawings tab. Upload an as-built, link it to a building and a discipline, and Pathwaze generates a structured review against that drawing type’s action plan — the Universal questions plus the checklist for each discipline you tagged. Each item takes a disposition (Confirmed, Field-Verify, Unknown, Conflict, or Risk) along with a finding, sheet reference, and Survey SOW action, tracked against a live progress bar.',
        'Universal answers sync across the whole area-and-type set, so you answer them once rather than once per sheet. If one drawing genuinely differs, answering it there records an override and leaves the rest of the set alone.',
        'From any finding you can Delegate it into an Engineering task or Create RFI to open a formal request. Either way the finding keeps a chip linking to whatever it spawned, so the drawing stays the system of record.',
        '**Site Plans are new, and they work differently from as-builts.** A site plan uploads as its own drawing type and links to one or more **systems** rather than to an area and discipline — so it skips the review checklist and instead becomes the current plan of record for those systems.',
        '**The linkage is what makes it worth doing.** The Technical tab reads the site plan directly: each linked system shows the current plan without anyone re-keying it, and when you upload a new site-plan revision, Pathwaze bumps the design revision on **every system that plan is linked to**, with a date. Re-issue one drawing and the whole Technical tab moves with it — no manual reconciliation, and no system quietly sitting on a superseded plan.',
      ],
      howTo: {
        title: 'Run a drawing review end to end',
        steps: [
          'Open a project and go to the **Drawings** tab. Pick a collection (As-Builts ships seeded) or create your own drawing type with an owner and review type.',
          'Click **Upload drawings** and select one or more PDFs. They land in a "needs an area + discipline" queue.',
          'For each drawing, choose its **area** (a building row from the Site tab) and tag one or more **disciplines**. Saving that link is what creates the review — a drawing with no area has no review yet.',
          'Open the drawing to start reviewing. Work down the Universal questions first, then each discipline checklist. Set a **disposition** on every item and add the finding, sheet ref, and SOW action where relevant.',
          'Hit **View PDF** to read the sheet inline while you answer — no need to open it in another tab.',
          'On any item that needs someone else: **Delegate ▸** creates a linked Engineering task with an assignee, or **Create RFI ▸** opens a numbered RFI with a ball-in-court and question. The finding then shows a chip linking to it.',
          'For a **site plan**, upload it into the Site Plan collection instead and link it to the **systems** it covers — no area or discipline needed. The Technical tab picks it up from there, and any later revision re-stamps every linked system automatically.',
        ],
        note:
          'Findings marked Risk notify admins automatically — you do not need to flag them separately.',
      },
    },

    {
      id: 'rfis',
      icon: '📋',
      title: 'RFIs',
      summary:
        'A Procore-style RFI log in the top nav — numbered per project, with ball-in-court, linkages, and overdue reminders.',
      body: [
        'RFIs is now its own module in the top nav: a portfolio-wide log with per-project numbering (#001…), status and overdue filters, and a clear ball-in-court on every row so there is never a question of who owes the next move.',
        'Each RFI carries linkages to the records it concerns — area, system, meter, stakeholder, or drawing — plus a Received From field that accepts either an internal user or a stakeholder, with inline add if they are not in the directory yet. Details are collapsible, and an RFI stays editable after it is opened.',
        'The response thread supports rich text, file attachments, and @-mentions. Official responses are distinguished from ordinary ones, and posting one can close the RFI in the same step. Attachments can also live on the RFI itself rather than only on a response.',
        'Notifications are wired throughout: creating, responding, @-mentioning, closing, and reopening all notify the ball-in-court and the distribution list by email and Slack DM. Open RFIs past their due date get a daily reminder, and Risk findings escalated from a drawing review go to admins automatically.',
        'The log filters by who the ball is in court with and sorts by most recent, due date, days open, or RFI number. Your own open RFIs also surface on the dashboard, with an overdue flag.',
      ],
      link: { href: '/rfis', label: 'Open the RFI log' },
    },

    {
      id: 'email-threads',
      icon: '💬',
      title: 'Your email is now in Pathwaze',
      summary:
        'Connect Outlook once and stakeholder email lands in the project Threads tab, alongside Slack and notes.',
      body: [
        'Connect your own Outlook mailbox once from Settings and any mail whose sender or recipient matches a stakeholder on a project is mirrored into that project’s Threads tab. It covers your whole mailbox — Inbox, Sent, and filed mail — across the last 12 months, backfilled oldest-first and kept current by a daily sync.',
        'The connection is read-only. Pathwaze can read your mail in order to match it to projects; it cannot send anything from your account. Each person connects their own mailbox, and you can disconnect at any time from the same screen.',
        'The Threads tab itself is now a unified feed rather than a Slack-only mirror. Slack messages, emails, and notes appear together with a search box, sorting (newest first by default, or by date and author), and long items collapsed so a busy thread stays readable. Slack formatting — bold, bullets, mrkdwn — renders properly, and file attachments are clickable.',
        'The note / task / file composer that was already on every other project tab now works on Threads too, so you can capture a note or spin off a task without leaving the conversation.',
      ],
      howTo: {
        title: 'Connect your mailbox',
        steps: [
          'Go to **Settings** (avatar menu, top right) and find the **Email (Outlook)** section.',
          'Click **Connect Outlook** and sign in with your normal Microsoft account. You will be asked to approve read access to your mail.',
          'That is it. The first backfill walks 12 months of mail in chunks, so history fills in over the next few syncs rather than all at once.',
          'Open any project’s **Threads** tab to see matched email appear next to Slack messages and notes.',
          'For mail to match, the correspondent must exist as a **stakeholder** on that project with the right email address — if a thread is not showing up, check the Stakeholders tab first.',
          'To turn it off, return to Settings → Email (Outlook) and click **Disconnect**.',
        ],
        note:
          'Read-only: Pathwaze has no permission to send mail from your account.',
      },
      link: { href: '/settings', label: 'Connect your mailbox' },
    },

    {
      id: 'fewer-clicks',
      icon: '🎯',
      title: 'Fewer clicks to the thing you need',
      summary:
        'Activity entries are links that open the exact record. Plus per-tab feeds, a project Tasks tab, and saved filters.',
      body: [
        'Entity names in the activity feed and the notification bell are now links. Click "…updated a meter" and Pathwaze jumps to that project, scrolls to that row, highlights it, and opens its detail drawer — wired for meters, buildings, permits, systems, and offtaker pricing.',
        'Each project tab now shows only its own history: Site covers buildings and parcels, Utility covers meters and accounts, Technical covers systems and specs, Drawings covers as-builts and their status. Project field edits — including stage and deal health — are now logged, so the record is there for portfolio reporting.',
        'Every project has a Tasks tab listing that project’s work grouped by status, with priority, type, due date, and assignee. Completed tasks sit behind a toggle, a row opens that task’s drawer, and "Open in Task Tracker" jumps to the full list pre-filtered to the project.',
        'The Projects and Tasks lists can save the current filters as a named preset and re-apply them in one click. Presets are per-user and follow you across devices.',
      ],
    },

    {
      id: 'tasks',
      icon: '✅',
      title: 'Tasks & collaboration',
      summary:
        'Reassign straight from the drawer, @-mention anyone from any editor, and attach files where the work actually lives.',
      body: [
        'You can reassign a task straight from the drawer without entering edit mode, and the usual assignment notifications still fire.',
        '@-mentions now work in task descriptions, project notes, pricing notes, RFI responses, and thread composers. Typing @ brings up a name picker, and the person you mention gets notified by email and Slack.',
        'Drawing reviews have a free-form comments section for anything the structured checklist does not cover, and files attach directly to an RFI rather than only to an individual response.',
        'Every notification email now uses the same branded template as the invite email, so what lands in your inbox is recognisable at a glance.',
      ],
    },

    {
      id: 'systems',
      icon: '🔧',
      title: 'Automatic design revisions on Systems',
      summary:
        'The revision stamps itself when a design-defining field changes — no more hand-typed version numbers.',
      body: [
        'A system’s design revision now bumps itself, with a date and an author, whenever a design-defining field changes: sizes, yield, system type, module and inverter counts and ratings, design URL, or linked areas.',
        'Cosmetic edits are deliberately excluded. Renaming a system or changing its status does not bump the revision, so the number stays meaningful as a signal that the design itself moved.',
        'The hand-typed version box is gone. The field is now read-only and doubles as a last-modified marker — one less thing to remember to update, and one less way for two people to disagree about which revision is current.',
        'Site-plan revisions feed the same mechanism: re-issuing a site plan bumps the revision on every system linked to it.',
      ],
    },

    {
      id: 'meters',
      icon: '⚡',
      title: 'Meter usage datasets',
      summary:
        'Meters now record how their usage data was captured, so a savings number can be traced back to its source.',
      body: [
        'Meters carry three new fields describing the dataset behind them: **Data Type** — Annual Bills, Interval Data (30-minute), or Interval Data (60-minute) — plus **Billing Start Year** and **Billing Start Month**.',
        'The point is traceability. A savings calculation built on twelve annual bills and one built on a year of 30-minute interval data are not the same quality of number, and until now nothing on the record said which you were looking at.',
        'Capturing the billing start also makes it clear what period the data actually covers, which matters when a meter was added mid-year or the utility changed its billing cycle.',
      ],
    },

    {
      id: 'permits',
      icon: '🏛️',
      title: 'Permitting data load',
      summary:
        '99 Permit Scout records loaded across 16 AdventHealth projects, with the curated rows preserved.',
      body: [
        '99 permit records sourced from Permit Scout were loaded across 16 AdventHealth projects, giving the Permitting tab real jurisdictional history to work from instead of a mostly empty table.',
        'The 7 previously curated rows were preserved rather than overwritten, so any hand-verified detail already in the system survived the load.',
        'The extract, preview, and load scripts are committed to the repo, so the same pipeline can be re-run as Permit Scout data refreshes or as new projects come online.',
      ],
    },
  ],

  next: [
    {
      title: 'Schedule tab',
      detail:
        'Detailed project schedules and project milestones — coming soon.',
    },
    {
      title: 'Reply from Threads',
      detail:
        'Send an email or Slack reply from inside the Threads tab so a conversation can continue without leaving Pathwaze.',
    },
    {
      title: 'Design drift',
      detail:
        'See what changed between system revisions, not just that something did — design version history on the Technical tab.',
    },
    {
      title: 'Priority dashboard',
      detail:
        'A pipeline-health view showing where priorities sit and how they moved this week.',
    },
  ],
}

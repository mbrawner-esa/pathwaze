/**
 * What's New: the release note shown in the login modal and on /whats-new.
 *
 * This is the single source of truth for both surfaces. To ship the next
 * update: rewrite RELEASE below and bump `key`. Every user's
 * `users.whats_new_seen` will no longer match, so the modal fires once for
 * each of them on their next page load (see WhatsNewGate).
 *
 * `summary` is what the modal shows (scannable). Everything else is long-form
 * detail rendered only on /whats-new.
 *
 * House style for the copy in this file: US spelling, no em dashes, and no
 * inline bold. `Md` still renders **bold** if a future release wants it, but
 * emphasis scattered through a paragraph reads as noise rather than emphasis.
 */

/**
 * A screen captured from the real product, served from `public/release/`.
 *
 * Deliberately not under `public/whats-new/`, because that path shadows the
 * `/whats-new` route and makes it ambiguous whether a request hits the page or
 * a file. These sit behind the same auth gate as the rest of the app
 * (`src/middleware.ts` allowlists only `/investor` and `/email-logo`), which is
 * what we want: internal product screens should not be publicly fetchable.
 *
 * `kind` is shown as a badge so a reader knows whether they are looking at a
 * still or something that plays. An animated GIF that has already looped once
 * otherwise reads as a broken screenshot.
 */
export interface ReleaseMedia {
  src: string
  /** Describes the screen for anyone not seeing it. Required, not optional. */
  alt: string
  caption: string
  kind: 'still' | 'recorded'
  /**
   * Numbered "what to look at" points, rendered beneath the image.
   *
   * Deliberately a list rather than markers positioned over the screenshot:
   * absolute overlays drift the moment an image is recaptured at a different
   * size, and they are invisible to anyone using a screen reader.
   */
  callouts?: string[]
}

/**
 * One capability inside a larger feature, for releases big enough that a wall
 * of paragraphs hides what actually shipped.
 */
export interface ReleaseFeature {
  icon: string
  name: string
  what: string
}

/** One of the three lanes a project runs in, and the checkpoints it owns. */
export interface ReleaseWorkstream {
  icon: string
  name: string
  /** One line on what this lane is responsible for. */
  governs: string
  detail: string
  /** Major milestones in catalog order, exactly as they appear in the app. */
  majors: string[]
}

/**
 * A teaching block. Used for headline features that need explaining before the
 * capability list means anything, so the page reads as a short tutorial:
 * intro, then the concepts, then what the thing can do.
 */
export interface ReleaseBlock<T> {
  heading: string
  intro: string[]
  items: T[]
  note?: string
  media?: ReleaseMedia[]
}

export interface ReleaseSection {
  id: string
  /** Emoji used as the section marker on both surfaces. */
  icon: string
  title: string
  /** One line, shown in the modal list and under the heading on the page. */
  summary: string
  /** Long-form paragraphs, page only. */
  body: string[]
  /**
   * Tutorial blocks, page only, rendered in this fixed order after `body`:
   * the three lanes, then how milestones hang off them, then the capability
   * list. Concepts first, because the feature list is meaningless to anyone
   * who does not yet know what a workstream is.
   */
  workstreams?: ReleaseBlock<ReleaseWorkstream>
  milestones?: ReleaseBlock<ReleaseFeature>
  featureList?: ReleaseBlock<ReleaseFeature>
  /** Screens not tied to a block. Rendered last. */
  media?: ReleaseMedia[]
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
  key: '2026-08-27-workstreams',
  title: 'Workstreams',
  window: 'June 9 to August 27, 2026',
  intro:
    'Workstreams is live, and it is the headline of this release. Everything after it is the summer’s work, from launch on June 9 through August: what changed, and how to use the parts that need a walkthrough.',

  sections: [
    {
      id: 'workstreams',
      icon: '🧭',
      title: 'Workstreams',
      summary:
        'A dynamic schedule and action plan for every project, built to keep the team aligned and show the real health of active work.',
      body: [
        'Workstreams is a living schedule and action plan for each project. It answers a question a Gantt chart cannot: not what one person is assigned, but what the project itself is waiting on, who owns it, and whether the date has moved from what we originally committed.',
        'The goal is one plan everybody works from, and an honest read on how active projects are actually doing. Because every date is measured against the baseline it started from, a project that is drifting says so long before anything is technically overdue. Workstreams is now the source of truth for project timing, so the Next Milestone on the projects list and the summary card both read straight from it.',
      ],
      workstreams: {
        heading: 'The three workstreams',
        intro: [
          'Every project runs three workstreams at once, and they are independent on purpose. Approvals does not sit waiting for Commercial to finish, and a stall in one lane is visible without hiding progress in the other two.',
          'Each workstream owns a fixed set of major milestones, listed below. These are the same on all 19 sites, which is what makes it possible to compare projects against each other.',
        ],
        items: [
          {
            icon: '💰',
            name: 'Commercial',
            governs: 'The deal itself: proving the savings, competing the price, and getting signatures on paper.',
            detail:
              'Runs from the first term sheet through to execution. This is where the economics are validated, contractor pricing is competed and clarified, and the forms of agreement are reviewed and approved. When Commercial stalls, nothing downstream is worth spending money on, which is why it is usually the first lane to check.',
            majors: [
              'Term Sheet',
              'Savings Validation',
              'Legal Review',
              'Market-Based Pricing',
              'Final Commercial Terms',
              'Closing',
            ],
          },
          {
            icon: '🔧',
            name: 'Technical',
            governs: 'The design and the build: what gets installed, where it goes, and whether the site can take it.',
            detail:
              'Runs from a conceptual layout through site feasibility and design development, into pre-construction and construction. This is the lane that turns an assumption about a roof into a buildable design and then into a system. It is also where surprises show up first, because it is the only lane that involves physically going to look at the site.',
            majors: [
              'Conceptual Design',
              'Site Feasibility',
              'Design Development',
              'Late-Stage Development',
              'Pre-Construction',
              'Construction',
            ],
          },
          {
            icon: '🏛️',
            name: 'Approvals',
            governs: 'Permission to build: the jurisdictions, the utility, and in Florida the state health authority.',
            detail:
              'Runs from confirming what the AHJ and the utility actually require, through the interconnection application and each permit, to Notice to Proceed. This is the lane with the least control over its own dates, since somebody else sets them. That is precisely why it needs a baseline: it is the only way to show that a date moved because a reviewer took longer, not because we were slow.',
            majors: [
              'Governing Requirements and Code Review',
              'Utility Approval',
              'Discretionary Permits Approved',
              'Ministerial Permits Approved',
              'AHCA Approval (Florida sites only)',
              'Notice to Proceed',
            ],
          },
        ],
        media: [
          {
            src: '/release/workstreams-timeline.gif',
            alt: 'The Workstreams overview timeline switching between Baseline, Current and Both views, then between Month, Quarter and Year scales.',
            caption:
              'The Overview timeline puts all three workstreams against one calendar, so you can see where the lanes overlap and where one is holding up the others.',
            kind: 'recorded',
            callouts: [
              'Each workstream is a labelled group of rows, and each row is one major milestone.',
              'In the Both view, the dotted bar is the baseline and the solid bar below it is the current plan. Where the two do not line up, that gap is the slip.',
              'The red vertical line is today. Bars are colored by status: green for complete, amber for in flight, grey for not yet started.',
              'The Scale buttons compress the same plan into months, quarters or years without changing any dates.',
            ],
          },
        ],
      },

      milestones: {
        heading: 'How milestones hang off a workstream',
        intro: [
          'A workstream is a lane. A major milestone is a fixed checkpoint in that lane. A milestone is the work you plan in order to reach that checkpoint, and it is entirely yours to shape.',
          'That split is the whole idea. The majors are identical on every project so Reports can compare them across the portfolio, which is why nobody can rename or add one. The milestones underneath differ site by site, because every site is different. Renaming a major would break reporting; renaming a milestone breaks nothing.',
          'Dates live on milestones, never on majors. A major takes its target from the latest target of the milestones inside it, so when a major turns red it is because something underneath it moved, and you can always open it and see which one.',
        ],
        items: [
          {
            icon: '🗂️',
            name: 'Workstream',
            what:
              'Commercial, Technical or Approvals. Three per project, fixed. Pick one from the dropdown, or stay on Overview to see all three at once.',
          },
          {
            icon: '🏁',
            name: 'Major milestone',
            what:
              'The checkpoint. Eighteen across the three lanes, identical on every project and owned by the build. You set the owner and can mark one complete, but you cannot rename, add or remove one.',
          },
          {
            icon: '✏️',
            name: 'Milestone',
            what:
              'The work needed to reach that checkpoint. Forty-eight come seeded per project as a starting point. Add, reorder, delete and date them freely. This is the level that carries the baseline, the target, the weight and the critical-path flag.',
          },
          {
            icon: '✅',
            name: 'Task',
            what:
              'The actual doing. A task created under a milestone is an ordinary Pathwaze task: it appears in Tasks, on the kanban and on the assignee’s list, and completing it shows up in the milestone’s update thread.',
          },
        ],
        note:
          'A useful rule of thumb: if two people on different projects would recognize it by the same name, it is a major. If it only makes sense on this site, it is a milestone.',
        media: [
          {
            src: '/release/still-milestone-detail.gif',
            alt: 'Milestones inside the Site Feasibility major milestone, showing department chips, baseline and target date fields, variance badges, weights, exit gates, key objectives and the weekly update thread.',
            caption:
              'One major milestone, Site Feasibility, opened up. Everything visible here is a milestone or something attached to one.',
            kind: 'still',
            callouts: [
              'Each row is a milestone, numbered in order, with its own Baseline and Target date fields.',
              'The red badge is variance: how far that milestone’s target has moved from its baseline.',
              'Grey chips are department tags, naming the teams the milestone will pull in.',
              'The percentage on the right is that milestone’s weight, its share of the major.',
              'Exit gates and key objectives in the right column are what must be true before the major can close.',
              'Weekly updates run underneath, with completed tasks interleaved into the same thread.',
            ],
          },
        ],
      },

      featureList: {
        heading: 'What the tab can do',
        intro: [
          'Once the plan is in place, these are the things Workstreams does with it.',
        ],
        items: [
          {
            icon: '📅',
            name: 'Baseline and target',
            what:
              'Two dates on every milestone. The baseline is where you first said it would land, captured once and then locked to admins. The target is where it lands now, and it moves as reality moves.',
          },
          {
            icon: '📊',
            name: 'Variance',
            what:
              'The gap between those two dates, in days. This is the number the whole tab is built around, and it appears the moment a date moves rather than waiting until something is already late.',
          },
          {
            icon: '🚦',
            name: 'Traffic lights',
            what:
              'Green for on track, amber for at risk when the date lands inside a week, red for delayed once the target has passed its baseline or the date has simply gone by.',
          },
          {
            icon: '⚖️',
            name: 'Weighted progress',
            what:
              'Each milestone carries a share of its major, so finishing a big piece of work counts for more than ticking off a small one.',
          },
          {
            icon: '⚡',
            name: 'Critical path',
            what:
              'Flag the milestones that genuinely drive the schedule, so they stand out from the ones that can slip without hurting anything.',
          },
          {
            icon: '🚪',
            name: 'Exit gates and key objectives',
            what:
              'What has to be true before a major can close. A gate can require a milestone from any workstream, which is how a cross-lane dependency gets recorded instead of remembered.',
          },
          {
            icon: '👥',
            name: 'Department tags',
            what:
              'Tag which teams a milestone will pull in, so Engineering can see a site walk coming well before the week it happens.',
          },
          {
            icon: '📝',
            name: 'Weekly updates',
            what:
              'A note thread on each major, interleaved with tasks as they complete. A date that moved should have the reason sitting next to it.',
          },
          {
            icon: '🩺',
            name: 'Deal health suggestion',
            what:
              'Workstreams reads the schedule and suggests a health value for the project. Accept it, or keep your own and stop the prompt.',
          },
          {
            icon: '⏸️',
            name: 'On hold',
            what:
              'A parked project pauses rather than rotting. Its milestones stop accruing variance until it comes back into the active queue.',
          },
        ],
        media: [
          {
            src: '/release/workstreams-milestones.gif',
            alt: 'Scrolling one workstream from the major milestone accordion with traffic lights and variance down to majors that have no dates set.',
            caption:
              'Scrolling one workstream end to end, from the majors in flight down to the ones nobody has planned yet.',
            kind: 'recorded',
            callouts: [
              'Every major carries a traffic light and a Target, Baseline and Variance row along the right.',
              'The bar underneath is weighted progress, so it reflects effort rather than a count of ticked boxes.',
              'Majors nobody has dated read Not Planned rather than pretending to be on track.',
              'The owner sits under each major, with a co-owner slot next to it.',
            ],
          },
          {
            src: '/release/still-summary-card.gif',
            alt: 'The project summary card showing Active Workstreams as colored pills with percentages, and Next Milestone with its date and an overdue flag.',
            caption:
              'You get the headline without opening the tab at all. Both of these rows are derived from Workstreams, so nobody types them.',
            kind: 'still',
            callouts: [
              'Active Workstreams lists the majors currently in flight, each with its weighted progress.',
              'Next Milestone names the actual next deliverable with its date, and flags it when that date has passed.',
              'The same Next Milestone also appears as a column on the projects list.',
            ],
          },
        ],
      },
      howTo: {
        title: 'Turn it on for your projects',
        steps: [
          'Open a project and go to the Workstreams tab. Pick a workstream from the dropdown, or leave it on Overview for the timeline across all three.',
          'Expand a major milestone that is actually in flight. Do not try to date all 48 at once. Start with the work you are doing now.',
          'Set the baseline first. The target field stays disabled until a baseline exists, on purpose: a target with nothing behind it is measured against nothing, and every variance figure in the tab stays blank.',
          'Then set the target. If it matches the baseline you are on plan. If it is later, the tab shows exactly how much later, and says so on the projects list too.',
          'Check the owner on each major and fix it if it is wrong. A few projects have no PM assigned, so their majors came through unowned.',
          'Tag the departments a milestone will pull in. Nothing consumes these yet, but the Lookahead is next on the roadmap and it can only be as good as the tags.',
          'Post a weekly update on anything that moved. A date that changes with no note is exactly the thing that generates the meeting this tab exists to avoid.',
        ],
        note:
          'Almost nothing is dated yet, so timelines and traffic lights will look empty until baselines exist. Setting them is the single highest-value thing anyone can do this week.',
      },
      link: { href: '/projects', label: 'Open a project and start' },
    },

    {
      id: 'drawings',
      icon: '📐',
      title: 'Drawings, Site Plans & reviews',
      summary:
        'Structured as-built reviews on every project, plus Site Plans that link to systems and keep the Technical tab current on their own.',
      body: [
        'Every project now has a Drawings tab. Upload an as-built, link it to a building and a discipline, and Pathwaze generates a structured review against that drawing type’s action plan: the Universal questions plus the checklist for each discipline you tagged. Each item takes a disposition (Confirmed, Field-Verify, Unknown, Conflict, or Risk) along with a finding, sheet reference, and Survey SOW action, tracked against a live progress bar.',
        'Universal answers sync across the whole area-and-type set, so you answer them once rather than once per sheet. If one drawing genuinely differs, answering it there records an override and leaves the rest of the set alone.',
        'From any finding you can Delegate it into an Engineering task or Create RFI to open a formal request. Either way the finding keeps a chip linking to whatever it spawned, so the drawing stays the system of record.',
        'Site Plans are new, and they work differently from as-builts. A site plan uploads as its own drawing type and links to one or more systems rather than to an area and discipline, so it skips the review checklist and instead becomes the current plan of record for those systems.',
        'The linkage is what makes it worth doing. The Technical tab reads the site plan directly: each linked system shows the current plan without anyone re-keying it, and when you upload a new site-plan revision, Pathwaze bumps the design revision on every system that plan is linked to, with a date. Re-issue one drawing and the whole Technical tab moves with it, with no manual reconciliation and no system quietly sitting on a superseded plan.',
      ],
      howTo: {
        title: 'Run a drawing review end to end',
        steps: [
          'Open a project and go to the Drawings tab. Pick a collection (As-Builts ships seeded) or create your own drawing type with an owner and review type.',
          'Click Upload drawings and select one or more PDFs. They land in a "needs an area + discipline" queue.',
          'For each drawing, choose its area (a building row from the Site tab) and tag one or more disciplines. Saving that link is what creates the review, so a drawing with no area has no review yet.',
          'Open the drawing to start reviewing. Work down the Universal questions first, then each discipline checklist. Set a disposition on every item and add the finding, sheet ref, and SOW action where relevant.',
          'Hit View PDF to read the sheet inline while you answer, rather than opening it in another tab.',
          'On any item that needs someone else: Delegate creates a linked Engineering task with an assignee, or Create RFI opens a numbered RFI with a ball-in-court and question. The finding then shows a chip linking to it.',
          'For a site plan, upload it into the Site Plan collection instead and link it to the systems it covers. No area or discipline needed. The Technical tab picks it up from there, and any later revision re-stamps every linked system automatically.',
        ],
        note:
          'Findings marked Risk notify admins automatically, so you do not need to flag them separately.',
      },
    },

    {
      id: 'rfis',
      icon: '📋',
      title: 'RFIs',
      summary:
        'A Procore-style RFI log in the top nav, numbered per project, with ball-in-court, linkages, and overdue reminders.',
      body: [
        'RFIs is now its own module in the top nav: a portfolio-wide log with per-project numbering (#001…), status and overdue filters, and a clear ball-in-court on every row so there is never a question of who owes the next move.',
        'Each RFI carries linkages to the records it concerns (area, system, meter, stakeholder, or drawing) plus a Received From field that accepts either an internal user or a stakeholder, with inline add if they are not in the directory yet. Details are collapsible, and an RFI stays editable after it is opened.',
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
        'Connect your own Outlook mailbox once from Settings and any mail whose sender or recipient matches a stakeholder on a project is mirrored into that project’s Threads tab. It covers your whole mailbox (Inbox, Sent, and filed mail) across the last 12 months, backfilled oldest-first and kept current by a daily sync.',
        'The connection is read-only. Pathwaze can read your mail in order to match it to projects; it cannot send anything from your account. Each person connects their own mailbox, and you can disconnect at any time from the same screen.',
        'The Threads tab itself is now a unified feed rather than a Slack-only mirror. Slack messages, emails, and notes appear together with a search box, sorting (newest first by default, or by date and author), and long items collapsed so a busy thread stays readable. Slack formatting such as bold, bullets and mrkdwn renders properly, and file attachments are clickable.',
        'The note, task and file composer that was already on every other project tab now works on Threads too, so you can capture a note or spin off a task without leaving the conversation.',
      ],
      howTo: {
        title: 'Connect your mailbox',
        steps: [
          'Go to Settings (avatar menu, top right) and find the Email (Outlook) section.',
          'Click Connect Outlook and sign in with your normal Microsoft account. You will be asked to approve read access to your mail.',
          'That is it. The first backfill walks 12 months of mail in chunks, so history fills in over the next few syncs rather than all at once.',
          'Open any project’s Threads tab to see matched email appear next to Slack messages and notes.',
          'For mail to match, the correspondent must exist as a stakeholder on that project with the right email address. If a thread is not showing up, check the Stakeholders tab first.',
          'To turn it off, return to Settings, then Email (Outlook), and click Disconnect.',
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
        'Entity names in the activity feed and the notification bell are now links. Click "…updated a meter" and Pathwaze jumps to that project, scrolls to that row, highlights it, and opens its detail drawer. This is wired for meters, buildings, permits, systems, and offtaker pricing.',
        'Each project tab now shows only its own history: Site covers buildings and parcels, Utility covers meters and accounts, Technical covers systems and specs, Drawings covers as-builts and their status. Project field edits, including stage and deal health, are now logged, so the record is there for portfolio reporting.',
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
        'Every notification email now uses the same branded template as the invite email, so what lands in your inbox is recognizable at a glance.',
      ],
    },

    {
      id: 'systems',
      icon: '🔧',
      title: 'Automatic design revisions on Systems',
      summary:
        'The revision stamps itself when a design-defining field changes, so there are no more hand-typed version numbers.',
      body: [
        'A system’s design revision now bumps itself, with a date and an author, whenever a design-defining field changes: sizes, yield, system type, module and inverter counts and ratings, design URL, or linked areas.',
        'Cosmetic edits are deliberately excluded. Renaming a system or changing its status does not bump the revision, so the number stays meaningful as a signal that the design itself moved.',
        'The hand-typed version box is gone. The field is now read-only and doubles as a last-modified marker: one less thing to remember to update, and one less way for two people to disagree about which revision is current.',
        'Site-plan revisions feed the same mechanism, so re-issuing a site plan bumps the revision on every system linked to it.',
      ],
    },

    {
      id: 'meters',
      icon: '⚡',
      title: 'Meter usage datasets',
      summary:
        'Meters now record how their usage data was captured, so a savings number can be traced back to its source.',
      body: [
        'Meters carry three new fields describing the dataset behind them: Data Type (Annual Bills, Interval Data at 30 minutes, or Interval Data at 60 minutes), plus Billing Start Year and Billing Start Month.',
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
      title: 'Lookahead',
      detail:
        'What lands in the next few weeks and who gets pulled in. Upcoming milestones filtered by department, so Engineering sees the site walks coming without reading 19 project pages. This is what the department tags feed.',
    },
    {
      title: 'Reply from Threads',
      detail:
        'Send an email or Slack reply from inside the Threads tab so a conversation can continue without leaving Pathwaze.',
    },
    {
      title: 'Design drift',
      detail:
        'See what changed between system revisions, not just that something did. Design version history on the Technical tab.',
    },
    {
      title: 'Priority dashboard',
      detail:
        'A pipeline-health view showing where priorities sit and how they moved this week.',
    },
  ],
}

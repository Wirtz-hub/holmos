# HolmOS

HolmNordic's own CRM, ad reporting and (later) marketing platform — replacing GoHighLevel,
AgencyAnalytics and AgencyFlow. One admin login today; built so client logins can be added later.

**Setting it up?** Read [SETUP.md](SETUP.md).

## What's built (Phase 1)

- **Pipeline** — drag-and-drop board (New, Contacted, Qualified, Proposal, Won, Lost).
- **Client records** — contact info, deal value, notes, goal, and an activity log
  (stage moves and ad-account changes are logged automatically by database triggers).
- **Ad accounts** — connect Meta (Marketing API) and Google Ads via OAuth, once per login.
  Each ad account is assigned to one client; reassigning is a dropdown change, no reconnect.
- **Per-client dashboards** — spend, impressions/reach, clicks/CTR, results mapped to the
  client's goal (lead, purchase, booking) and cost per result, with date-range filtering.
  Data is fetched live from the platforms for the selected range.

## What's built (Phase 2)

- **Pages & funnels** — block editor (hero, text, image, form, call to action, testimonials,
  booking) with drag-and-drop, multi-step funnels, four starter templates, autosaved drafts,
  preview, and publish. Visitors only ever see the published version, at `/f/<slug>` or on a
  custom domain (host-based routing in `src/proxy.ts`).
- **Forms** — question builder; use them in pages or embed anywhere (script that auto-sizes an
  iframe, plain iframe, or link). Every answer creates or updates a client (matched by email,
  then phone) and lands in the activity log. Honeypot, timing check and per-IP rate limit
  against spam. Optional email alert per answer.
- **Booking** — booking pages per meeting type (length, weekly hours, buffers, start-time
  step, notice, how far ahead), a public booking flow in Danish or English, double-booking
  prevented in the database, cancel links. Google Calendar sync blocks busy times and adds
  events (with Meet links). Confirmation, cancellation and reminder emails via Resend; a
  daily Vercel cron job sends reminders.

## Roadmap

1. ~~CRM + ad dashboards~~
2. ~~Funnels, landing pages, forms, booking calendars~~
3. Email/SMS broadcasts, drip sequences, tagging, visual workflow builder
4. Google review requests and monitoring; Stripe invoices and payment links
5. Unified inbox (Instagram DM, SMS, email) with AI agent; courses; surveys; social planner

Out of scope for now: client self-service logins (designed for, not built), ad platforms
beyond Meta and Google, white-labelling, native mobile app.

## Development

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # unit tests + database tests (migrations run in in-memory Postgres)
npm run typecheck
npm run lint
npm run build
```

Stack: Next.js 16 (App Router, Cache Components, `proxy.ts`), React 19, Tailwind CSS 4,
Supabase (Postgres + Auth), Recharts, dnd-kit. Hosted on Vercel.

### Layout

| Path | What lives there |
|---|---|
| `supabase/migrations/` | Database schema, triggers and row-level security |
| `src/proxy.ts` | Session refresh + redirect to `/login`; public paths; custom domains → `/sites/<domain>` |
| `src/lib/auth.ts` | `requireAdmin()` — every page, server action and API route calls it first |
| `src/lib/actions/` | Server actions (clients, ad accounts, auth, funnels, forms, booking) |
| `src/lib/funnels/`, `src/lib/forms/`, `src/lib/booking/` | Page blocks and templates, form questions and answer checks, free-time calculation, booking emails |
| `src/lib/public-data.ts` | What public pages read (published content only, cached, refreshed on publish) |
| `src/app/f/`, `src/app/sites/`, `src/app/book/`, `src/app/embed/`, `src/app/api/public/` | **Public** pages and endpoints — the only routes without `requireAdmin()` |
| `src/app/api/cron/reminders/` | Daily reminder job (checks `CRON_SECRET`); scheduled in `vercel.json` |
| `src/lib/ads/` | Meta + Google API clients, OAuth, token storage, result mapping, report aggregation |
| `src/app/(app)/` | Signed-in pages |
| `src/app/api/oauth/[platform]/` | OAuth start + callback for `meta` and `google` |
| `src/components/` | UI |

### Data and access model

- `clients` — one row per lead/client, holding contact info, pipeline stage, deal value, goal, notes.
- `activities` — the activity log.
- `ad_connections` — one per OAuth login. Tokens are AES-256-GCM encrypted
  (`TOKEN_ENCRYPTION_KEY`) and their columns are not granted to logged-in sessions; only the
  server, using the Supabase secret key, reads them.
- `ad_accounts` — one per platform account, with a nullable `client_id`.
- `funnels` — a page or funnel: `draft` (what you edit) and `published` (what visitors see),
  both JSON validated by `src/lib/funnels/schema.ts`, plus an optional `custom_domain`.
- `forms` / `form_submissions` — questions as JSON, and each answer as a label/value snapshot.
- `booking_calendars` / `bookings` — a booking page's rules and weekly hours; bookings store
  their blocked time (meeting plus buffers) under an exclusion constraint, so two confirmed
  bookings can never overlap.
- `calendar_connections` — the one Google Calendar login; tokens handled like `ad_connections`.
- **Visitors** (the `anon` role) can't read any of these tables. They get published content
  through `published_funnel()`, `published_funnel_for_domain()`, `public_form()` and
  `public_booking_calendar()`. Answers and bookings go through the server, which calls
  `record_form_submission()`, `book_slot()` and `cancel_booking_by_token()` with the secret
  key (they aren't executable by visitors or logged-in sessions). Activity log entries for
  answers, bookings and cancellations are written by triggers.
- **Access layer** (`app_users`, `client_access`, `is_admin()`, `can_view_client()`) is separate
  from client data. Today only the admin passes. To add client logins later: create the user,
  add a `client_access` row, set `clients.portal_enabled = true`, and build a client-facing
  route group — the read policies already scope them to their own client.

### What counts as a "result"

- **Meta:** the first action group the account actually reports for the goal
  (e.g. `lead`, else on-Facebook form leads + website leads). Overlapping variants are never
  summed. Overridable per client (`meta_result_action`).
- **Google:** conversions grouped by conversion-action category (`SUBMIT_LEAD_FORM`,
  `PURCHASE`, `BOOK_APPOINTMENT`, …), or every conversion if the client opts in.

See `src/lib/ads/results.ts` and its tests.

# iLeads Dashboard — Sault Nissan

Live internet-lead tracking dashboard, replacing the manual "August 2026" Google Sheet.
Next.js + TypeScript + Tailwind. Single-user, password-gated.

## Run it

```bash
npm install
npm run dev
```

Open http://localhost:3000 and sign in with the password in `.env.local`
(`DASHBOARD_PASSWORD`) — change it before this goes anywhere shared.

## What's live vs. manual right now

Each section shows a colored dot: 🟢 live from the source's API, 🟡 manually entered
(click "Edit manual values" to type numbers in directly, same as the sheet today),
🔴 configured but the API call is failing.

| Section | Status | What's needed |
|---|---|---|
| Lead source table (16 rows, matches the sheet) | 🔴 not connected yet | BKD.ai's API key auth format is unconfirmed — see below |
| Website Traffic (sessions/visitors/conversion) | 🟢 live | Connected via GA4 OAuth — nothing left to do |
| Social Media (Instagram) | 🟡 manual | Connect Instagram — see below |

### BKD.ai (CRM) — blocking issue

`src/lib/sources/bkd.ts` calls BKD.ai's MCP endpoint
(`https://rixrkhumtmhzfgavzjyn.supabase.co/functions/v1/mcp`) using the API key created
under CRM → Settings → API Keys ("iLeads Dashboard", stored in `.env.local` as
`BKD_API_KEY`). The key is active in the CRM, but the endpoint returns
`"Invalid or expired token"` for `Authorization: Bearer <key>` — that's the
conventional format, but there's no public docs page confirming it, and the CRM's own
"Connect to Claude" button doesn't fire any request yet (looks unfinished on their end).

**Next step:** ask your BKD.ai/CRM contact (`jason@autoagents.io` shows up on your
team list and looks like the builder) what header format the API keys under
Settings → API Keys expect, and what the contacts/deals tool names are. Once that's
confirmed, only `src/lib/sources/bkd.ts` needs updating — the rest of the app doesn't
change. Every lead source from the sheet already maps 1:1 to a BKD.ai channel; see
`src/lib/leadSources.ts` for the mapping.

### GA4 (website traffic) — done

Connected as of 2026-08-24. This GCP org (`saultnissan.ca`) has a policy blocking
service-account key downloads, so `src/lib/sources/ga4.ts` uses an OAuth refresh
token instead: a one-time consent (`/api/auth/google/start`, signed in as
`marketing@saultnissan.ca`) that saved `GOOGLE_REFRESH_TOKEN` and auto-detected
`GA4_PROPERTY_ID` (Sault Nissan, `512530038`) straight into `.env.local`. The refresh
token doesn't expire from use, so this shouldn't need to be repeated — if it ever
gets revoked (e.g. from myaccount.google.com/permissions), just re-visit
`/api/auth/google/start` to get a new one.

Note: the "Conversion" figure reads GA4's `sessionConversionRate` metric, which
depends on how Key Events are configured in this GA4 property. It's currently
showing ~97%, which suggests a broad event (e.g. `page_view` or `session_start`) is
marked as a Key Event rather than something meaningful like a form submission — worth
checking GA4 Admin → Events → Key Events if this number should be smaller.

### Instagram (social stats)

Needs a Meta Business app + long-lived Page access token with `instagram_basic` +
`instagram_manage_insights` scopes on the connected IG Business account:

```
IG_BUSINESS_ACCOUNT_ID=17841...
IG_ACCESS_TOKEN=EAAG...
```

Same deal — needs your Meta Business login.

## Architecture

- `src/lib/sources/*.ts` — one client per external source (BKD.ai, GA4, Instagram).
  Each exports a `*Configured` boolean and a fetch function that throws on failure.
- `src/lib/overrides.ts` — manual-entry fallback. Auto-selects storage: if
  `DATABASE_URL` is set, it persists to Postgres (works on any serverless host —
  Vercel Postgres, Neon, Supabase all work, just paste the connection string in);
  otherwise it falls back to `data/overrides.json` for local dev. The Postgres path
  is written but hasn't been smoke-tested against a live database yet (none available
  in this environment) — worth a quick check the first time `DATABASE_URL` is set.
- `src/lib/dashboard.ts` — merges live + manual data per section, computes the
  "Tracking for" pace columns the same way the sheet does:
  `round(monthToDateCount / daysComplete * daysInMonth)`.
- `src/middleware.ts` → renamed to `src/proxy.ts` per Next.js 16's proxy convention —
  simple password gate via a signed cookie (`src/lib/auth.ts`, Web Crypto HMAC so it
  works in the Edge runtime).

## Deploying

Not yet deployed. Once BKD.ai auth is sorted and you're ready to put this somewhere
your team can reach:

1. Push this repo somewhere (GitHub) and connect it on vercel.com — that needs your
   own Vercel account, since account creation isn't something that can be done for you.
2. Add a Postgres database (Vercel's own Postgres add-on, or Neon/Supabase's free
   tiers all work) and copy its connection string into the project as `DATABASE_URL`.
   `src/lib/overrides.ts` picks it up automatically — no code changes needed.
3. Copy every other value from `.env.local` into the Vercel project's Environment
   Variables (`BKD_API_KEY`, `DASHBOARD_PASSWORD`, `SESSION_SECRET`, and the GA4/IG
   ones once you've got them).

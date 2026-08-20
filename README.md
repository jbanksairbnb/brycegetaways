# Bryce Mountain Getaways

Direct-booking marketing site for **Bryce Mountain Getaways** — two luxury
short-term-rental homes side by side on Aspen Way South in Basye, Virginia,
next to Bryce Resort. Live at **www.brycemountaingetaways.com**.

## Status

**Phase 1 — homepage (this repo).** A pixel-accurate, mobile-responsive,
static homepage matching the approved design, hosted on GitHub Pages. Includes
an interim booking-*request* form that emails the hosts (via Formspree) until
the full availability + hold flow is built.

Since shipped on top of Pages: dedicated property pages, the availability
calendar, the owner's `/manage.html` editor, and Airbnb iCal sync (see below).
Still planned (see `docs/` / the design handoff): date holds and a full owner
admin back end, which do need a dynamic app host (e.g. Vercel).

## Structure

```
index.html              Homepage
assets/css/styles.css   Design system + all styles
assets/js/main.js       Season tabs, sticky header, mobile nav, booking form
assets/js/discount.js   First-booking $50 discount (popup, banner, signup)
assets/js/site-config.js EmailJS + Supabase + discount configuration
assets/js/bookings-store.js The bookings ledger (insert public, read owners-only)
assets/js/manage-bookings.js The Bookings tab on /manage.html
assets/img/             Photography (see assets/img/PHOTOS.md for the drop-in guide)
CNAME                   Custom domain (www.brycemountaingetaways.com)
```

## First-booking $50 discount

A first-visit popup (and a permanent homepage banner) offers **$50 off a first
booking** in exchange for a name + e-mail. The signup e-mails the guest their
code and a "book here" link, notifies the owners, and stores the address so the
owners can see who has claimed the discount and who has already booked with it.
When that guest books, the $50 comes off the total automatically (`booking.js`),
and the owner's request e-mail flags the credit so they can confirm it before
collecting payment.

The experience adapts to the visitor: a brand-new visitor sees the form; a
returning visitor who never signed up gets a nudge; a guest who has a code sees
"your $50 is waiting"; a guest who has already booked sees a plain welcome-back.

**It works out of the box** — with nothing configured the popup, banner, and the
$50-off math all run, the owners still get an e-mail per signup, and the code is
remembered in the guest's browser. Configuring the two services below makes it
robust across devices and adds the guest auto-reply.

### 1. Store the e-mails (Supabase — free)

1. Create a project at [supabase.com](https://supabase.com).
2. In the SQL editor, create the table and lock it down with Row Level Security:

   ```sql
   create table discount_signups (
     id          bigint generated always as identity primary key,
     email       text not null,
     name        text,
     code        text,
     status      text default 'eligible',      -- 'eligible' | 'redeemed'
     created_at  timestamptz default now(),
     redeemed_at timestamptz
   );
   alter table discount_signups enable row level security;

   -- The site uses the public anon key, so only allow exactly what it needs:
   create policy "anon can sign up"    on discount_signups for insert to anon with check (true);
   create policy "anon can look up"    on discount_signups for select to anon using (true);
   create policy "anon can redeem"     on discount_signups for update to anon using (true) with check (true);
   ```

3. Paste **Project URL** and the **anon public key** (Settings → API) into
   `assets/js/site-config.js` under `discount.supabaseUrl` / `supabaseAnonKey`.

The anon key is safe in the browser *because* RLS is on — that's how Supabase is
designed. Owners can watch signups in the Supabase table editor.

### 2. The guest auto-reply (EmailJS)

Add a template whose body includes `{{discount_code}}` and `{{book_url}}`, then
put its template ID in `site-config.js` under `emailjs.discountTemplateId`. Until
it's set, signup skips the guest e-mail (the owners are still notified via
Formspree) and the code is shown on-screen instead.

### Turning it off / changing the amount

Set `discount.amount` in `site-config.js` — any dollar value, or `0` to switch
the whole promotion off site-wide (popup, banner, and booking credit all hide).

**Note (Phase 1):** enforcement is *owner-verified* — the site shows and records
the discount and flags it in the request e-mail, but doesn't hard-block a second
use; the owners confirm against the stored list before collecting payment.

## Booking requests & the signed agreement

When a guest completes step 3 of the booking flow they have already ticked
"I agree" and typed their name as an electronic signature, so the submission is
a **signed agreement** and both sides need a copy of it. Submitting fires two
independent sends, so one failing never loses the signed document:

| Send | Goes to | Always? | Carries |
| --- | --- | --- | --- |
| **Formspree** (`/f/mqaqgypl`) | The owners — the file copy | Yes | Booking summary **plus the full agreement text** in `signed_agreement` |
| **EmailJS** (`templateId`) | The guest — their own copy | Only when EmailJS is configured | The same, as `agreement_html` / `agreement_text` |

The owners' copy deliberately does **not** depend on how the EmailJS template is
wired — Formspree is posted on every submission, so the record exists even if
EmailJS is misconfigured or down. (That means the owners can receive two
e-mails per booking when the EmailJS template also copies them; that redundancy
is intentional.)

### Wiring the guest's copy (EmailJS template)

Adding a parameter in code does nothing on its own — EmailJS only sends what the
template body references. In the EmailJS dashboard, open the booking template
(`emailjs.templateId` in `site-config.js`) and make sure it has:

- **To:** `{{to_email}}` — the guest. Add `{{owner_email}}` (or
  `brycegetaways@gmail.com`) as **Bcc** if the owners want the EmailJS copy too.
- **Bcc:** `{{owner_email}}` — the owners' copy through EmailJS.
- **Reply-To:** `{{reply_to}}` — this resolves to the *owners'* mailbox, not the
  guest's: the message is addressed to the guest, so replying to it has to reach
  Jonathan & Anna. (The owners' reply-to-the-guest path is the Formspree
  notification, whose `_replyto` is the guest.)
- In the body, the booking summary (`{{summary}}`) **and the agreement itself**:
  - HTML template → `{{{agreement_html}}}` — **three** braces, so EmailJS injects
    the rendered agreement instead of escaping the tags. If a test send shows raw
    `<h2>`/`<p>` tags, the template is being treated as plain text — use the
    `agreement_text` form below instead.
  - Plain-text template → `{{agreement_text}}`, ideally inside a `<pre>` block so
    the line breaks survive.

Without one of those two variables in the body the guest gets a booking summary
with a signature line but **not** the agreement they signed.

Other params the template can use: `guest_name`, `guest_email`, `guest_phone`, `guest_address`,
`home`, `property_address`, `check_in`, `check_out`, `nights`, `guests`, `dogs`,
`nightly_subtotal`, `cleaning_fee`, `pet_fee`, `taxes`, `discount`, `total`,
`payment_type`, `due_now`, `balance`, `balance_due`, `signature`, `signed_at`.

Worth double-checking in the dashboard: `emailjs.serviceId` is currently set to
`brycegetaways@gmail.com`, which is the mailbox address rather than the
`service_xxxxxxx`-style Service ID EmailJS issues. If it doesn't match the
Service ID shown under **Email Services**, the guest's copy silently fails and
only the Formspree (owner) copy goes out.

## Bookings ledger

Every signed rental agreement is filed in Supabase the moment the guest submits,
and the owners work it from the **Bookings** section of `/manage.html`: who has
signed, who still owes a deposit, and the exact agreement each guest put their
name to. Marking a deposit received is what takes the dates off the calendar.

```
guest signs  →  status: signed            dates still bookable
deposit in   →  status: deposit_received  dates held  ← you set this
balance in   →  status: paid_in_full      dates held
cancelled    →  status: cancelled         dates released
```

Dates are held by **money, not by a signature**. A signed booking leaves the
nights bookable until you mark the deposit received, which matches §5 of the
agreement: no deposit inside 3 days and the dates are released. The trade-off is
that two guests can sign for the same dates before either pays — the tab flags a
deposit that has gone past its window so you can release those dates yourself.

A stay from check-in to check-out holds the nights **check-in through the night
before check-out** — the checkout morning stays bookable, the same rule the
Airbnb sync applies.

The daily **Bookings** workflow e-mails the owners two things, once each:

- a **balance due**, on the day it falls due (5 days before check-in);
- a **deposit still unpaid** past the agreement's 3-day window.

### Setup

**1 — The table.** In the Supabase SQL editor:

```sql
create table bookings (
  id            bigint generated always as identity primary key,
  created_at    timestamptz not null default now(),
  home_key      text not null,                       -- 'chalet' | 'modern'
  home_name     text not null,
  check_in      date not null,
  check_out     date not null,
  nights        int  not null,
  guests        int  not null,
  dogs          int  not null default 0,
  guest_name    text not null,
  guest_email   text not null,
  guest_phone   text,
  guest_address text,
  nightly_subtotal numeric(10,2),
  cleaning_fee     numeric(10,2),
  pet_fee          numeric(10,2),
  taxes            numeric(10,2),
  discount         numeric(10,2) default 0,
  total            numeric(10,2) not null,
  deposit_due      numeric(10,2) not null,
  balance_due      numeric(10,2) not null default 0,
  balance_due_date date,
  paid_in_full_at_booking boolean not null default false,
  signature      text not null,
  signed_at      timestamptz not null,
  agreement_html text not null,                      -- the document they signed
  status         text not null default 'signed',
  deposit_received_at   timestamptz,
  paid_in_full_at       timestamptz,
  cancelled_at          timestamptz,
  reminder_sent_at      timestamptz,                 -- balance reminder latch
  deposit_alert_sent_at timestamptz,                 -- deposit alert latch
  owner_notes    text
);
alter table bookings enable row level security;

-- The site files bookings with the public anon key, so that key gets INSERT and
-- nothing else. There is deliberately no anon SELECT: guest names, addresses and
-- phone numbers cannot be read out of the public site at all.
create policy "anon can file a signed booking" on bookings for insert to anon with check (true);

-- Reading and updating require an owner signed in through Supabase Auth.
create policy "owners can read"   on bookings for select to authenticated using (true);
create policy "owners can update" on bookings for update to authenticated using (true) with check (true);
```

**2 — The owner login.** Supabase → **Authentication → Users → Add user**, with
"Auto confirm user" ticked. One shared login for both owners is fine. That
e-mail and password are what you type into the Bookings section; the session
lives in `sessionStorage` and dies with the tab.

**3 — Actions secrets.** Settings → Secrets and variables → Actions:

| Secret | Value |
| --- | --- |
| `SUPABASE_URL` | `https://xxxxxxxx.supabase.co` (Settings → API → Project URL) |
| `SUPABASE_SERVICE_KEY` | the **service_role** key — bypasses RLS, so it may only ever live here |
| `MAIL_USERNAME` | `brycegetaways@gmail.com` |
| `MAIL_PASSWORD` | a Gmail **app password**, not the account password |

For the app password: Google Account → Security → 2-Step Verification (must be
on) → App passwords → generate one for "Mail". It's a 16-character string.

**4 — One addition to the GitHub token.** The token already pasted at the top of
`/manage.html` needs **Actions: Read and write** alongside Contents, so a status
change can kick the calendar rebuild immediately. Without it everything still
works — the calendar just updates at the next daily run instead of in a minute.

Then run it once from **Actions → Bookings → Run workflow**.

### What is stored, and who can read it

The ledger holds real personal data: name, mailing address, phone, e-mail and
the signed agreement. Two things keep it private — RLS giving anonymous callers
no read at all, and the owner login gating the Bookings tab. `/manage.html`
itself is unlisted but publicly reachable, so the login is what protects the
data, not the obscurity of the URL. Don't add an anon `select` policy to this
table.

## Airbnb calendar sync

The public calendar merges three sources, so a stay booked on Airbnb stops
showing as available here without anyone touching the site:

| Source | What it holds | Who updates it |
| --- | --- | --- |
| `assets/data/availability.json` | Rates, minimum stays, manual blocks | The owners, via `/manage.html` |
| `assets/data/ota-blocked.json` | Nights booked or blocked on Airbnb/VRBO | The **Sync Airbnb calendar** workflow, hourly |
| `assets/data/direct-booked.json` | Nights held by a **paid** direct booking | The **Bookings** workflow, daily and on demand |
| `/api/availability` | The same OTA nights, live | Only on a dynamic host (Vercel) |

The sync runs in GitHub Actions rather than in the browser because the OTAs
send no CORS headers, and it commits a static file rather than relying on the
serverless function because the live site is served by GitHub Pages, which
can't run one. `calendar.js` reads whichever sources answer and ignores the
rest, so this works on Pages, on Vercel, and in local preview.

### Setup (one time)

The iCal URLs are private — anyone holding one can read the raw reservation
details — so they live in Actions secrets, never in this public repo. Under
**Settings → Secrets and variables → Actions → New repository secret**, add:

| Secret | Home | Value |
| --- | --- | --- |
| `ICS_CHALET` | The Chalet, 133 Aspen Way S | Airbnb → Calendar → Availability → Connect calendars → Export |
| `ICS_MODERN` | The Cabin, 155 Aspen Way S | same, for the second listing |

Comma-separate the value to sync more than one platform for a home, e.g.
`https://www.airbnb.com/calendar/ical/123.ics?t=…, https://www.vrbo.com/icalendar/abc.ics`.

Then run it once from **Actions → Sync Airbnb calendar → Run workflow**. After
that it runs hourly on its own, and only commits when the dates actually change.

If a listing's URL is ever rotated or revoked, the run goes **red** and the
affected home keeps its previous nights rather than dropping them — an unsynced
night must never show as bookable. Re-export the feed and update the secret.

## Local preview

It's static — open `index.html`, or run any static server:

```
python3 -m http.server 8000   # then visit http://localhost:8000
```

## Photos

See `assets/img/PHOTOS.md` for the exact filenames each slot expects and how
they map to the owners' original photo files. Missing photos show a soft
placeholder tile, so the layout never breaks.

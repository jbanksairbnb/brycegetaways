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

## Airbnb calendar sync

The public calendar merges three sources, so a stay booked on Airbnb stops
showing as available here without anyone touching the site:

| Source | What it holds | Who updates it |
| --- | --- | --- |
| `assets/data/availability.json` | Rates, minimum stays, manual blocks | The owners, via `/manage.html` |
| `assets/data/ota-blocked.json` | Nights booked or blocked on Airbnb/VRBO | The **Sync Airbnb calendar** workflow, hourly |
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

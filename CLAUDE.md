# CLAUDE.md — Bryce Mountain Getaways

Read this first in every session. `README.md` holds the detailed setup and
operations docs; this file is the working context: who, what, how we work, and
how we measure whether the business is doing well.

## The business

- **Owners / hosts:** Jonathan & Anna (Airbnb Superhosts). Contact:
  `brycegetaways@gmail.com`. They are comfortable with Claude making changes
  directly, with no special rules. Explain changes in plain English.
- **Two homes, side by side on Aspen Way South, Bryce Resort, Basye VA 22810:**

  | | **The Chalet** (133 Aspen Way S) | **The Cabin** (155 Aspen Way S) |
  |---|---|---|
  | Code key / page | `chalet` / `the-chalet.html` | `modern` / `the-modern.html` (formerly "The Modern") |
  | Size | 5 BR · 3 BA · sleeps 10 | 4 BR · 3 BA · sleeps 10 |
  | Age / status | Older; Guest Favorite, 4.99 ★, 275 reviews, "Most Popular Ski Airbnb '22" | New for 2026, few reviews so far |
  | Headline amenities | Game room (pool table, Golden Tee), sunken lounge + fireplace, 2 decks, valley view, firepit, 5-min walk to slopes | **Hot tub**, fire pit + fire table, EV charger, heated bath floors, espresso bar, fiber Wi-Fi, loft game room, 2-min walk to ski run |
  | Airbnb | https://www.airbnb.com/rooms/48973014 | https://www.airbnb.com/rooms/1739477967930103129 |

- **Channels:** Airbnb, VRBO, Booking.com, Houfy, and direct through this site.
- **Payments for direct bookings:** Venmo or Zelle only. **Do not add online
  payment.** The owners don't want it.
- **Status (Nov 2026):** everything is working. No feature work is planned. The
  current focus is **revenue and occupancy** (see below).

## The website (technical summary)

- Static HTML/CSS/JS with no build step. Hosted on **GitHub Pages** at
  www.brycemountaingetaways.com (`CNAME`). Pushing to `main` deploys.
- Services: **Supabase** (bookings ledger, guests, discount signups),
  **EmailJS** + **Formspree** (email), **GitHub Actions** (hourly OTA calendar sync
  in `sync-airbnb-calendar.yml`, daily bookings job in `bookings.yml`).
- `/manage.html` is the owner tool for rates, availability, bookings and guest
  messaging. It commits `assets/data/availability.json` through a GitHub token,
  which produces the "Update availability & rates" commits.
- Bots commit to `main` constantly ("Sync Airbnb availability", "Update
  direct-booking calendar"). **Always `git pull --rebase origin main` before
  pushing.**
- Secrets live in GitHub Actions secrets, never in the repo. `site-config.js`
  holds only browser-safe keys. The repo is **public**.
- Preview locally with `python3 -m http.server 8000`.
- Full setup, data model and troubleshooting (EmailJS service-ID gotcha, Gmail
  OAuth breakage, RLS policies) are in `README.md`.

### Useful data already in the repo

| File | What it tells us |
|---|---|
| `assets/data/ota-blocked.json` | Every night blocked on the OTAs per home, refreshed hourly. Includes owner blocks and the far-future availability-window cutoff, so it's a *proxy* for bookings. |
| `assets/data/direct-booked.json` | Nights held by paid direct bookings |
| `assets/data/availability.json` | Direct-site rates (`defaultRate`, `weekendRate`, per-date `rates`), min stays, tax rate |
| `assets/data/reviews.json` | 275 reviews (all The Chalet, from Airbnb) |

---

## Performance management

The goal is to **maximize profit across both homes**, not just fill nights. Every
review follows the same loop: **collect data → compare to the last period and the
market → decide on a few changes → log them → check the result next time.**

The current plan, the starting numbers and the reasoning live in
`docs/performance/`:

- `docs/performance/2026-11-baseline.md`: the first assessment and action plan
- `docs/performance/metrics.csv`: monthly KPI log (one row per home per month)
- `docs/performance/changes-log.md`: every pricing, listing or amenity change, with its date

### Cadence

| When | What | Owner provides | Claude does |
|---|---|---|---|
| **Monthly** (first week) | KPI review | The monthly data pack (below) | Fill `metrics.csv`, compare to last month and last year, check pace for the next 90 days, recommend at most 3 actions, update `changes-log.md` |
| **Quarterly** | Strategy review | Monthly pack + comp-set snapshot + costs | Re-evaluate pricing structure, the amenity roadmap and SEO progress; write `docs/performance/YYYY-MM-review.md` |
| **Before each season** (Oct for ski, Apr for summer) | Season setup | Planned events, blackout dates | Set season and holiday rates and min stays; refresh seasonal site content |
| **Ad hoc** | Gap fill | "We have an empty week on X" | Suggest a targeted discount, length-of-stay change or a guest-list email from `/manage.html` |

To start a review, say: **"Run the monthly performance review"** and attach the
data pack.

### Monthly data pack (what the owners send)

These are needed for a meaningful review. Exports or screenshots both work.

1. **Airbnb, per listing (Performance / Insights tab):** booked nights, occupancy,
   ADR, revenue; **search impressions, listing views, conversion rate** (views →
   bookings); wishlist adds. The conversion funnel is the most important input,
   because it shows whether the problem is *visibility* (low impressions) or
   *appeal/price* (views but no bookings).
2. **Airbnb reservations / earnings CSV** (Menu → Earnings or Reservations →
   Export) for the month.
3. **VRBO, Booking.com, Houfy:** the reservations or payout report for the month
   (nights, gross, fees).
4. **Direct bookings:** in Supabase already. Send a CSV export of `bookings`
   (Supabase → Table editor → Export).
5. **Costs:** cleaning, supplies, utilities, repairs, platform fees, and anything
   unusual. Monthly totals per home are enough. Mortgage, tax and insurance only
   need updating once a year.
6. **Reviews:** any new review under 5★ or with a complaint, plus a note on any
   guest issues.
7. **Website (once analytics exist, see the SEO plan):** Google Search Console
   performance export (queries, clicks, impressions) and analytics visits.

**Quarterly additions:** a **comp-set snapshot**, meaning the price for 3 sample
dates (a peak ski weekend, a winter midweek, a summer weekend) for the 6–8 listings
in `docs/performance/2026-11-baseline.md#comp-set`. Screenshots are fine. Claude
can't reach airbnb.com from cloud sessions unless the domain is allowed in the
environment's network settings.

### KPIs (tracked per home in `metrics.csv`)

- **Occupancy %:** booked nights ÷ available nights. Report weekends and weekdays separately.
- **ADR:** gross nightly revenue ÷ booked nights, excluding cleaning and pet fees.
- **RevPAN:** revenue per available night (occupancy × ADR). **This is the headline number.**
- **Net profit:** revenue minus platform fees, cleaning, supplies, utilities and repairs.
- **Channel mix:** % of nights from Airbnb, VRBO, Booking.com, Houfy and direct. Direct bookings save about 15% in fees.
- **Booking window / pace:** nights on the books for the next 30/60/90 days compared with the same point last year.
- **Funnel (Airbnb):** impressions → views → bookings conversion.
- **Rating:** overall rating and the count of reviews under 5★.

### Decision rules (starting points; refine with data)

- **Peak dates booked more than 60 days out:** the price was too low. Raise
  comparable future dates 10–15%.
- **Weekend still open 14 days out:** cut that weekend 10%, and relax min stay to 2.
  At 7 days out, cut another 10% or email the guest list.
- **High views, low conversion:** a price or presentation problem (photos, title,
  first 3 photos, price compared with the other home).
- **Low impressions:** a visibility problem (search ranking, Guest Favorite, calendar
  availability, min stays, response rate, missing amenity filters).
- **The two homes are each other's nearest competitor.** Always compare them side
  by side. Don't price them identically when one has clearly better amenities.
- Change **one or two levers at a time** per home so results can be attributed,
  and log every change in `changes-log.md`.

### Current priorities (from the Nov 2026 baseline; details in the baseline doc)

1. **The Chalet's bookings are light.** It is priced the same as the newer Cabin
   next door, which has a hot tub. Guests who see both listings choose the
   Cabin. Fix: differentiate on price now, and evaluate adding a **hot tub**
   (the biggest amenity gap) plus low-cost amenity upgrades.
2. **The Cabin's pricing:** it books well at the same rates, so peak dates are
   probably underpriced. Raise peak and holiday rates and use pace rules.
3. **SEO / AI visibility:** add analytics and Search Console, per-home
   `VacationRental` structured data, a Google Business Profile, `llms.txt`,
   question-style content, and image compression.

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

## Performance & revenue management

Revenue data, pricing strategy and performance reviews live in the **private**
repo `jbanksairbnb/bryce-business-ops`, not here: this repo is public and
served on the live site. To run a review, attach that repo and follow its
`CLAUDE.md`. Never commit earnings, costs or strategy documents to this repo.

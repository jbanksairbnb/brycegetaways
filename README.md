# Bryce Mountain Getaways

Direct-booking marketing site for **Bryce Mountain Getaways** — two luxury
short-term-rental homes side by side on Aspen Way South in Basye, Virginia,
next to Bryce Resort. Live at **www.brycemountaingetaways.com**.

## Status

**Phase 1 — homepage (this repo).** A pixel-accurate, mobile-responsive,
static homepage matching the approved design, hosted on GitHub Pages. Includes
an interim booking-*request* form that emails the hosts (via Formspree) until
the full availability + hold flow is built.

Planned next (see `docs/` / the design handoff): dedicated property pages, a
real availability calendar with date holds, Airbnb iCal sync, and an owner
admin back end. Those require a dynamic app host (e.g. Vercel) rather than
GitHub Pages — a decision to be made before Phase 2.

## Airbnb / VRBO calendar sync

Booked nights from each home's OTA calendar show up as unavailable on the site
automatically — no manual blocking needed for those. A scheduled GitHub Action
(`.github/workflows/sync-ical.yml`, every 30 min) runs `scripts/sync-ical.js`,
which fetches each home's private iCal feed, extracts the booked nights, and
commits them to `assets/data/ota-blocked.json`. The public calendar
(`assets/js/calendar.js`) reads that file and merges those nights on top of the
manual blocks in `assets/data/availability.json`. No dynamic host required —
this all works on plain GitHub Pages.

**Setup (one time):** add the private `.ics` URL for each home as an *Actions
secret* — repo **Settings → Secrets and variables → Actions → New repository
secret**. Never put these URLs in the repo; anyone with one can read your
booking calendar.

| Secret name  | Home       | Value                                                    |
|--------------|------------|----------------------------------------------------------|
| `ICS_CHALET` | The Chalet | The Chalet's Airbnb (and/or VRBO) `.ics` URL(s)          |
| `ICS_MODERN` | The Cabin  | The Cabin's Airbnb (and/or VRBO) `.ics` URL(s)           |

Comma-separate multiple feeds for one home (e.g. Airbnb **and** VRBO). Get each
URL from Airbnb → Calendar → **Availability settings → Sync calendars → Export
calendar**. After adding the secrets, trigger the first run from the **Actions**
tab → *Sync Airbnb/VRBO calendars* → **Run workflow** (it also runs on its own
every 30 minutes). Manual date blocks still work as before via `manage.html`.

## Structure

```
index.html              Homepage
assets/css/styles.css   Design system + all styles
assets/js/main.js       Season tabs, sticky header, mobile nav, booking form
assets/img/             Photography (see assets/img/PHOTOS.md for the drop-in guide)
CNAME                   Custom domain (www.brycemountaingetaways.com)
```

## Local preview

It's static — open `index.html`, or run any static server:

```
python3 -m http.server 8000   # then visit http://localhost:8000
```

## Photos

See `assets/img/PHOTOS.md` for the exact filenames each slot expects and how
they map to the owners' original photo files. Missing photos show a soft
placeholder tile, so the layout never breaks.

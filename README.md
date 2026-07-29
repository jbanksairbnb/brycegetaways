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

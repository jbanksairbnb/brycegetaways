# Performance baseline & action plan: November 2026

Written 2026-11-02 from what is in this repo: the synced OTA calendars, the
direct-site rates, the two property pages and the site's SEO setup. Airbnb's own
numbers (occupancy history, ADR, conversion funnel) were **not** available, and
airbnb.com can't be reached from the cloud session. Treat the diagnoses below as
**hypotheses to confirm with the first monthly data pack**.

## 1. What the data shows today

### Forward calendar (nights blocked across all OTAs, as of 2026-11-02)

| Month | The Chalet | The Cabin |
|---|---|---|
| Nov 2026 | **9** / 30 | **23** / 30 |
| Dec 2026 | 16 / 31 | 18 / 31 |
| Jan 2027 | 12 / 31 | 15 / 31 |
| Feb 2027 | 5 / 28 | 11 / 28 |
| Mar 2027 | 2 / 31 | 8 / 31 |
| Summer 2027 (Jun–Aug) | 34 | 34 |

Source: `assets/data/ota-blocked.json`. The figures include owner blocks.
Sep–Oct 2027 show fully blocked, which is the end of the OTA booking window, not
bookings.

**Reading:** the Chalet is behind the Cabin in every winter month and is at
less than a third of the Cabin's nights for November. Summer is even.

### Rates (direct site; OTA rates may differ, so confirm)

| | The Chalet | The Cabin |
|---|---|---|
| Default weekday | $365 | $365 |
| Default weekend | $645 | $645 |
| Nov–Mar range | $345–$695 | $325–$850 |
| e.g. Fri–Sat Nov 6–7 | $385 / $375 | $695 / $695 |

**The Cabin is booking more nights at the same or *higher* prices.** That points
away from "the Chalet is too expensive in general" and toward **product and
presentation**: the newer home next door simply looks like the better deal at the
same price.

### Market context (Basye, VA)

- About 151 active Airbnb listings; ADR about $229; occupancy about 37% (Rabbu,
  Apr 2026). That is for *all* listing sizes. 4–5 BR luxury homes should run well
  above that ADR, and occupancy around 45–60% would be a strong target.
- Demand peaks in ski season (mid-Dec to early Mar, weekends and holidays) and in
  summer (lake, golf, mountain biking). Fall foliage weekends are strong.
  Midweeks outside holidays are the soft spot for every Bryce rental.
- Sources: [Rabbu – Basye](https://rabbu.com/airbnb-data/basye-va),
  [RedAwning – Basye](https://pm.redawning.com/market-overview/bayse-virginia),
  [AirDNA – Basye](https://airdna.co/vacation-rental-data/app/us/virginia/basye/overview).

## 2. The Chalet: why bookings are light, and what to do

### Likely causes, most to least likely

1. **Cannibalization by the Cabin.** Same hosts, same street, same price, and
   Airbnb shows guests both. The Cabin is new, photographs as modern luxury, and
   has a hot tub, EV charger, heated floors and an espresso bar. At an identical
   price most groups of ≤ 8 pick the Cabin. Before the Cabin launched, the Chalet
   competed only with other people's homes.
2. **No hot tub.** In a ski/mountain market this is the most-filtered amenity.
   A guest who ticks "Hot tub" in Airbnb's filters never sees the Chalet at all.
   This is a *visibility* loss, not just an appeal loss.
3. **Dated positioning.** "Most Popular Ski Airbnb '22" signals age. The listing's
   lead photos, title and first lines may not have been refreshed since the
   Cabin's launch.
4. **Rate structure.** Weekend rates are inconsistent (some Fri/Sat at $375,
   others $695), and there are many more custom min-stay rules than on the Cabin
   (63 vs 28), which can block 2-night gaps.

### Plan

**Now (no cost, this month)**
- **Price the Chalet below the Cabin** on comparable dates: about 10–15% under on
  weekends, about 10% under midweek. It becomes the "value" choice for larger
  groups (it has 5 BR versus 4). Keep it high only on peak holiday dates, when
  both homes sell out anyway.
- **Reposition the listing around what the Cabin can't offer:** 5 bedrooms, the
  bigger group capacity, the game room with Golden Tee, 275 reviews at 4.99, Guest
  Favorite status, and the valley view. New title idea: *"5BR Ski Chalet · Walk to
  Slopes · Game Room · 275 5★ Reviews"*.
- **Refresh the first 5 Airbnb photos**: lead with the valley-view deck or the
  sunken fireplace lounge at golden hour. Add a twilight exterior shot.
- **Simplify min stays:** a 2-night min everywhere except holiday weekends, and
  allow 1-night gap fills midweek.
- **Turn on weekly (7+ night) and monthly discounts** and a last-minute discount
  (within 7 days) on all OTAs to win midweek and remote-work stays.
- **Promote "book both homes"** (up to 20 guests: reunions, weddings, corporate
  retreats). The Chalet is the natural anchor.

**Next 1–3 months (low cost, under about $2k)**
- **EV charger** (Level 2, about $800–$1,500 installed): the Cabin already has
  one, and it's an Airbnb filter.
- Ski-season comforts: a boot dryer and ski rack, a mudroom bench and hooks.
- Outdoor upgrades: refresh the firepit seating, add string lights on the deck,
  outdoor heaters.
- Smaller fixes that show up in photos and reviews: new throw pillows and
  blankets, a statement light, a kids' game corner.

**Capital decision (decide by spring, install before next ski season)**
- **Add a hot tub.** Roughly $8k–$15k installed, plus about $50–$100/month to run.
  Payback: if it adds even 2 booked nights a month at about $400, or lifts ADR
  about $50 across about 120 nights a year, it pays back in roughly 1–2 years. It
  also puts the Chalet back into hot-tub-filtered searches. This is the single
  biggest lever. Re-evaluate with the first 2–3 months of funnel data. If the
  Chalet's *impressions* are low compared with the Cabin's, that confirms the
  filter effect.
- Alternatives if a hot tub isn't feasible: a barrel sauna (about $5–$8k), or
  converting part of the game room into a theater.

**Success target:** close half the occupancy gap with the Cabin within 3 months,
and reach ≥ 90% of the Cabin's RevPAN within 12 months.

## 3. The Cabin: pricing for profit

Signals that it is **underpriced on peak dates**: it books well at rates identical
to the older home, holds 23 of 30 nights in November, and is a brand-new luxury
build with every top amenity.

- **Raise peak and ski-weekend rates 10–15%**, and holiday weeks (Christmas–New
  Year, MLK, Presidents' Day) 20–30%. Then use the pace rules in `CLAUDE.md`. If
  peak dates are still booking more than 60 days out, keep raising.
- **Keep midweek competitive**, since that's where the whole market is soft. Add
  weekly and monthly discounts and target remote workers (fiber Wi-Fi, desk space).
- **Build reviews fast:** a new listing's ranking depends on review count. Send a
  friendly post-stay reminder, and aim for 20+ reviews in the first season to
  earn Guest Favorite.
- **Gaps to consider:** a sauna or cold plunge (premium wellness positioning), and
  ski storage and a boot dryer.
- **Consider a dynamic pricing tool** (PriceLabs, Wheelhouse or Beyond, about
  $20–$40 per listing per month). It adjusts nightly rates to local demand and
  events and syncs to all four OTAs. Optional; the pace rules in `CLAUDE.md` work
  manually.

## 4. Search and AI visibility (Google, ChatGPT, Gemini, etc.)

What's already good: unique titles and descriptions, Open Graph tags, canonical
tags, a sitemap, `LodgingBusiness` + `FAQPage` structured data on the homepage,
and strong local content (hiking, fishing, wine country).

Gaps, in priority order:

1. **No analytics or Search Console.** We can't measure anything. Add Google
   Search Console (free; verify through a DNS TXT record or a meta tag) and a
   privacy-friendly analytics tool such as GA4 or Cloudflare Web Analytics.
2. **Google Business Profile** for "Bryce Mountain Getaways" (category: vacation
   home rental agency) with photos, the website link and reviews. This is the
   biggest driver of Maps, local and AI-answer visibility. *(Owners: confirm
   whether one exists.)*
3. **Per-home `VacationRental` structured data** on `the-chalet.html` and
   `the-modern.html`: bedrooms, beds, bathrooms, occupancy, amenities (hot tub,
   pets, Wi-Fi, EV charger), photos, address and geo, check-in and check-out
   times, and each home's own rating. Google supports this type for vacation
   rentals, and AI systems read it as facts.
4. **Rename `the-modern.html` → `the-cabin.html`.** The URL should match the name
   people search for. Keep a redirect stub at the old URL, since GitHub Pages
   can't do server redirects, so use a meta-refresh plus a canonical tag.
5. **`llms.txt` and a plain "Facts" block** on each home page (address, sleeps,
   bedrooms, distance to slopes, pet policy, starting price, how to book). AI
   assistants quote clear, factual, consistent text.
6. **Question-style content** that matches how people ask AI and Google: "pet
   friendly cabins at Bryce Resort with hot tub", "Bryce Resort rentals for large
   groups sleeps 20", "Bryce Resort ski season guide 2026–27", "things to do at
   Bryce Resort in winter". Add an FAQ per home page, and a seasonal or events page.
7. **Image weight:** `assets/img` is 53 MB, with single photos up to 776 KB.
   Compress them, serve WebP and lazy-load. Page speed is a ranking factor,
   especially on mobile.
8. **Consistency and links:** use the same name, address and phone on Airbnb,
   VRBO, Booking.com, Houfy and Google. Link the website from Houfy and social
   profiles. Ask for links from Bryce Resort lodging pages, the Shenandoah County
   tourism site, and the Travel Off Path article.
9. **Refresh sitemap `lastmod` dates** whenever pages change (currently July).
10. **Direct-booking incentive:** advertise "Book direct and save ~10% (no
    platform fees)". The Venmo/Zelle flow makes this profitable.

## 5. Comp set

To be filled in by the owners: 6–8 Basye/Bryce listings that guests would
realistically compare against (4–6 BR, sleeps 8–14, near the slopes). Include at
least 3 with hot tubs. Paste their Airbnb URLs here. Each quarter, record their
prices for: a peak ski Saturday, a winter Tuesday and a July Saturday.

| Listing | URL | BR / sleeps | Hot tub? | Rating / reviews | Peak Sat | Winter Tue | July Sat |
|---|---|---|---|---|---|---|---|
| | | | | | | | |

## 6. Open questions for the owners

- Are the OTA nightly rates the same as the site's `availability.json` rates, or
  set separately on each platform?
- Is a dynamic pricing tool already in use on any channel?
- Does a Google Business Profile exist?
- Is a hot tub physically and practically possible at the Chalet (deck load,
  electrical, HOA rules)?
- Last year's monthly numbers for the Chalet, to set a true pre-Cabin baseline.

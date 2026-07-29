# Photos — what's here

All images are web-optimized JPGs (long edge ≤ 2200px, progressive, ~quality 82).
Source uploads were resized/renamed into the clean slots below. To swap any
photo, replace the file with the same name (keep it a JPG) and commit.

## Homepage

| File | Slot |
|------|------|
| `hero-modern-twilight.jpg` | Full-screen hero — The Modern at twilight |
| `season-summer.jpg` | Seasons → Summer (deck bar, valley view) |
| `season-spring.jpg` | Seasons → Spring (Chalet kitchen, per approved design) |
| `season-winter.jpg` | Seasons → Winter (skiers at the resort) |
| `season-fall.jpg` | Seasons → Fall (Shenandoah foliage sunset) |
| `chalet-living.jpg` | The Chalet — main (stone fireplace + peak panel) |
| `chalet-sunroom.jpg` · `chalet-dining.jpg` · `chalet-gameroom.jpg` | The Chalet — thumbnail strip |
| `modern-greatroom.jpg` | The Modern — main (ring chandelier great room) |
| `modern-kitchen.jpg` · `modern-deck.jpg` · `modern-loft.jpg` | The Modern — thumbnail strip |

## Extra angles (for the property detail pages / galleries)

`chalet-dining-2.jpg`, `chalet-kitchen.jpg`, `modern-greatroom-2.jpg`,
`modern-kitchen-2.jpg`, `modern-twilight-side.jpg`, `fall-tibbett.jpg`
(Tibbett's Knob foliage), `winter-snowboard.jpg`.

## Heads-up: a couple of filenames are misleading

The original filenames don't all match their contents. For the record:

- `chalet-dining-2.jpg` is the **real Chalet kitchen** (black quartz island).
- `chalet-kitchen.jpg` is actually a **covered deck** with the hanging chair.

The walkthrough pages already point at the correct files — this note is just so
nobody trusts the filename over the picture again.

## Adding walkthrough photos (bedrooms, baths, etc.)

The property pages (`the-chalet.html`, `the-modern.html`) are built to grow.
Each room is an `<article class="room">` block; every `<img>` inside its
`.room__gallery` tiles automatically, so adding a photo = adding one `<img>`.

**Naming convention** — keep the flat `assets/img/` folder and name new files:

```
<home>-<room>[-<n>].jpg
```

- `<home>` = `chalet` or `modern`
- `<room>` = `bedroom-primary`, `bedroom-2`, `bedroom-bunk`, `bath-primary`,
  `bath-hall`, `entry`, `exterior`, `hot-tub`, `fire-pit`, `laundry`, …
- `<n>` = optional angle number when a room has more than one shot (`-2`, `-3`)

Examples: `chalet-bedroom-primary.jpg`, `chalet-bath-hall-2.jpg`,
`modern-bedroom-king.jpg`, `modern-hot-tub.jpg`.

**Specs:** web-optimized JPG, long edge ≤ ~2200px, ~quality 82. Landscape
frames best in the gallery tiles (they crop to a wide box); portraits work but
get center-cropped.

Upload however's easiest — even GitHub's drag-and-drop with default names is
fine. If the names are messy, just tell us which home + room each photo is and
we'll optimize, rename to the convention above, and slot it into the tour.

## Notes

- **Winter & Fall season photos are stand-ins** (resort/scenic shots, not the
  homes themselves). Swap in real Bryce winter/fall photography when available,
  and confirm usage rights for the two scenic shots before launch.
- `season-summer.jpg` and `modern-deck.jpg` are the same source photo (0037).

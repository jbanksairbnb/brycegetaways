# Video

## Background hero loop — `modern-hero.mp4`

The Cabin's hero (`the-modern.html`) is wired to play `assets/video/modern-hero.mp4`
as a silent, looping background. Until that file exists, the poster photo
(`assets/img/hero-modern-twilight.jpg`) shows instead — so there's never a
broken state.

For a background loop you want a **short, silent, small** file:

- **Length:** ~12–25 seconds (it loops)
- **No audio** (browsers require muted autoplay anyway)
- **Resolution:** 1080p is plenty; 720p is fine and smaller
- **Target size:** ideally **≤ ~8 MB** so the page stays fast
- **Format:** H.264 MP4, `+faststart` so it starts before fully downloaded

One-line conversion (needs [ffmpeg](https://ffmpeg.org)):

```bash
ffmpeg -i INPUT.mov -t 20 -an -vf "scale=-2:1080" \
  -c:v libx264 -profile:v high -crf 26 -preset slower \
  -movflags +faststart -pix_fmt yuv420p modern-hero.mp4
```

Raise `-crf` (e.g. 28–30) for a smaller file, lower it for higher quality.
Prefer HandBrake? Use the "Web Optimized" preset, strip audio, cap to 1080p.

## Getting a large video into the site — options

GitHub blocks files over 100 MB and the web drag-and-drop caps at ~25 MB, so a
raw phone video usually can't be committed directly. Pick one:

1. **Compress it small and commit it** (best for the hero loop). The command
   above gets most clips well under 25 MB — then upload it here via GitHub.
2. **Host the full-length tour externally** (best for a watchable video):
   upload to **YouTube (unlisted)** or **Vimeo**, send the link, and we embed a
   proper player section on the Modern page. No repo bloat, no size limit.
3. **Vercel Blob / a CDN** if you'd rather self-host the full file — send it and
   we'll wire a direct `<video controls>` to the hosted URL.

For the **background hero**, option 1 (a small self-hosted MP4) looks best.
For a **full walkthrough video** guests press play on, option 2 is simplest.

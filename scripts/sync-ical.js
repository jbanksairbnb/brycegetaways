#!/usr/bin/env node
/* Bryce Mountain Getaways — OTA calendar sync (GitHub Actions).
 *
 * Fetches each home's iCal feed(s) from Airbnb / VRBO and writes the booked and
 * blocked nights to assets/data/ota-blocked.json, which the public calendar
 * (assets/js/calendar.js) merges on top of the manually-managed blocks in
 * assets/data/availability.json.
 *
 * This runs in CI rather than in the browser because the OTAs don't send CORS
 * headers, and as a committed static file rather than a serverless function
 * because the site is served by GitHub Pages, which can't run one.
 *
 * CONFIGURE via GitHub → Settings → Secrets and variables → Actions.
 * One secret per home; comma-separate multiple feeds (e.g. Airbnb + VRBO):
 *   ICS_CHALET = https://www.airbnb.com/calendar/ical/XXXX.ics?t=...
 *   ICS_MODERN = https://www.airbnb.com/calendar/ical/YYYY.ics?t=... , https://www.vrbo.com/icalendar/ZZZ.ics
 *
 * The feed URLs are private — anyone holding one can read the raw reservation
 * details — so they live only in those secrets, never in this public repo.
 *
 * Safety rule: a feed that fails never clears a home's dates. Dropping a booked
 * night would advertise it as available and invite a double booking, so on any
 * fetch error the home keeps its previous nights and the job exits non-zero.
 */

"use strict";

var fs = require("fs");
var path = require("path");

var FEEDS = { chalet: "ICS_CHALET", modern: "ICS_MODERN" };
var OUT = path.join(__dirname, "..", "assets", "data", "ota-blocked.json");
var ATTEMPTS = 3;
var TIMEOUT_MS = 20000;
var KEEP_PAST_DAYS = 1; // drop nights older than this so the file stays small

/* ------------------------------------------------------------ date helpers */
function pad(n) { return (n < 10 ? "0" : "") + n; }
function isoUTC(d) {
  return d.getUTCFullYear() + "-" + pad(d.getUTCMonth() + 1) + "-" + pad(d.getUTCDate());
}
function ymdToDate(ymd) {
  return new Date(Date.UTC(+ymd.slice(0, 4), +ymd.slice(4, 6) - 1, +ymd.slice(6, 8)));
}
function addDays(d, n) { var x = new Date(d); x.setUTCDate(x.getUTCDate() + n); return x; }

/* ------------------------------------------------------------ iCal parsing */
// Parse an iCal string into a Set of blocked night dates (YYYY-MM-DD).
// A reservation DTSTART..DTEND blocks the nights DTSTART .. DTEND-1, because the
// checkout morning is free for the next guest.
function parseICS(text) {
  text = text.replace(/\r\n[ \t]/g, "").replace(/\n[ \t]/g, ""); // unfold folded lines
  var lines = text.split(/\r\n|\n|\r/);
  var dates = new Set();
  var inEvent = false, start = null, end = null, cancelled = false;

  for (var i = 0; i < lines.length; i++) {
    var line = lines[i];
    if (line.indexOf("BEGIN:VEVENT") === 0) {
      inEvent = true; start = end = null; cancelled = false; continue;
    }
    if (line.indexOf("END:VEVENT") === 0) {
      if (start && !cancelled) {
        var s = ymdToDate(start);
        var e = end ? ymdToDate(end) : addDays(s, 1);
        if (e <= s) e = addDays(s, 1); // guard against malformed same-day events
        for (var d = new Date(s); d < e; d = addDays(d, 1)) dates.add(isoUTC(d));
      }
      inEvent = false; continue;
    }
    if (!inEvent) continue;

    if (/^DTSTART/.test(line)) { var ms = line.match(/(\d{8})/); if (ms) start = ms[1]; }
    else if (/^DTEND/.test(line)) { var me = line.match(/(\d{8})/); if (me) end = me[1]; }
    else if (/^STATUS:CANCELLED/i.test(line)) { cancelled = true; }
  }
  return dates;
}

/* --------------------------------------------------------------- fetching */
async function fetchFeed(url) {
  var lastErr = null;
  for (var attempt = 1; attempt <= ATTEMPTS; attempt++) {
    var timer = null;
    try {
      var ctrl = new AbortController();
      timer = setTimeout(function () { ctrl.abort(); }, TIMEOUT_MS);
      var r = await fetch(url, {
        signal: ctrl.signal,
        headers: { "User-Agent": "BryceGetaways-CalendarSync/1.0 (+https://www.brycemountaingetaways.com)" }
      });
      if (!r.ok) throw new Error("HTTP " + r.status);
      var body = await r.text();
      if (body.indexOf("BEGIN:VCALENDAR") === -1) throw new Error("response is not an iCal feed");
      return body;
    } catch (e) {
      lastErr = e;
      if (attempt < ATTEMPTS) await new Promise(function (res) { setTimeout(res, attempt * 2000); });
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
  throw lastErr;
}

/* ------------------------------------------------------------------- main */
function readExisting() {
  try { return JSON.parse(fs.readFileSync(OUT, "utf8")); }
  catch (e) { return { blocked: {} }; }
}

// Never print a feed URL: it carries the private token that unlocks the feed.
function redact(url) {
  var m = String(url).match(/\/ical\/(\d+)\.ics/);
  return m ? "airbnb:" + m[1] : "feed";
}

async function main() {
  var previous = readExisting();
  var cutoff = isoUTC(addDays(new Date(), -KEEP_PAST_DAYS));
  var blocked = {};
  var homes = {};
  var failed = [];
  var missing = [];

  for (var home of Object.keys(FEEDS)) {
    var raw = process.env[FEEDS[home]];
    var urls = (raw || "").split(",").map(function (s) { return s.trim(); }).filter(Boolean);

    if (!urls.length) {
      missing.push(FEEDS[home]);
      blocked[home] = (previous.blocked && previous.blocked[home]) || [];
      homes[home] = { feeds: 0, ok: 0, status: "unconfigured" };
      continue;
    }

    var all = new Set();
    var ok = 0;
    for (var url of urls) {
      try {
        var dates = parseICS(await fetchFeed(url));
        dates.forEach(function (d) { all.add(d); });
        ok++;
        console.log("  " + home + " ← " + redact(url) + ": " + dates.size + " nights");
      } catch (e) {
        failed.push(home + " (" + redact(url) + "): " + e.message);
        console.error("  " + home + " ← " + redact(url) + ": FAILED — " + e.message);
      }
    }

    if (ok < urls.length) {
      // Partial or total failure: keep what we had rather than under-reporting.
      var prev = (previous.blocked && previous.blocked[home]) || [];
      prev.forEach(function (d) { all.add(d); });
      homes[home] = { feeds: urls.length, ok: ok, status: "stale" };
    } else {
      homes[home] = { feeds: urls.length, ok: ok, status: "ok" };
    }

    blocked[home] = Array.from(all).filter(function (d) { return d >= cutoff; }).sort();
    homes[home].nights = blocked[home].length;
  }

  // Every field here has to be stable when the calendar is unchanged, or the
  // hourly run commits (and redeploys) forever. That rules out a "last checked"
  // timestamp — the Actions run history already records when the sync last ran,
  // and a failed run goes red there.
  var sameDates = JSON.stringify(previous.blocked || {}) === JSON.stringify(blocked);
  var payload = {
    updated: (sameDates && previous.updated) ? previous.updated : new Date().toISOString(),
    homes: homes,
    blocked: blocked
  };
  fs.writeFileSync(OUT, JSON.stringify(payload, null, 2) + "\n");

  Object.keys(blocked).forEach(function (h) {
    console.log(h + ": " + blocked[h].length + " blocked nights (" + homes[h].status + ")");
  });

  if (missing.length) {
    console.error("\nMissing secret(s): " + missing.join(", ") +
      "\nAdd them under Settings → Secrets and variables → Actions.");
  }
  if (failed.length) {
    console.error("\nFeed failures (previous nights kept for those homes):\n  " + failed.join("\n  "));
  }
  if (missing.length || failed.length) process.exitCode = 1;
}

main().catch(function (e) {
  console.error("sync-ical failed: " + e.message);
  process.exit(1);
});

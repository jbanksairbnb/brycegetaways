/* Bryce Mountain Getaways — OTA calendar sync (GitHub Actions job).
 *
 * The public site is static (GitHub Pages), so it can't fetch Airbnb/VRBO iCal
 * feeds at request time (cross-origin + no server). Instead this script runs on
 * a schedule in GitHub Actions: it fetches each home's iCal feed(s), extracts the
 * booked/blocked nights, and writes them to assets/data/ota-blocked.json, which
 * the Action commits back to the repo. The public calendar (assets/js/calendar.js)
 * reads that file and merges the booked nights on top of the manually-managed
 * blocks in assets/data/availability.json.
 *
 * CONFIGURE via GitHub → repo → Settings → Secrets and variables → Actions.
 * One secret per home; comma-separate multiple feeds (e.g. Airbnb + VRBO):
 *   ICS_CHALET = https://www.airbnb.com/calendar/ical/XXXX.ics?t=...
 *   ICS_MODERN = https://www.airbnb.com/calendar/ical/YYYY.ics?t=... , https://www.vrbo.com/icalendar/ZZZ.ics
 *
 * Note: internally the two homes are keyed "chalet" and "modern" — "modern" is
 * The Cabin. Private feed URLs live only in the Actions secrets, never in the repo.
 */

var fs = require("fs");
var path = require("path");

var FEEDS = { chalet: "ICS_CHALET", modern: "ICS_MODERN" };
var OUT = path.join(__dirname, "..", "assets", "data", "ota-blocked.json");

function pad(n) { return (n < 10 ? "0" : "") + n; }
function isoUTC(d) {
  return d.getUTCFullYear() + "-" + pad(d.getUTCMonth() + 1) + "-" + pad(d.getUTCDate());
}
function ymdToDate(ymd) {
  return new Date(Date.UTC(+ymd.slice(0, 4), +ymd.slice(4, 6) - 1, +ymd.slice(6, 8)));
}
function addDays(d, n) { var x = new Date(d); x.setUTCDate(x.getUTCDate() + n); return x; }

// Parse an iCal string into a Set of blocked night dates (YYYY-MM-DD).
// A reservation DTSTART..DTEND blocks the nights DTSTART .. DTEND-1 (checkout day is free).
function parseICS(text) {
  text = text.replace(/\r\n[ \t]/g, "").replace(/\n[ \t]/g, ""); // unfold folded lines
  var lines = text.split(/\r\n|\n|\r/);
  var dates = new Set();
  var inEvent = false, start = null, end = null;
  for (var i = 0; i < lines.length; i++) {
    var line = lines[i];
    if (line.indexOf("BEGIN:VEVENT") === 0) { inEvent = true; start = end = null; continue; }
    if (line.indexOf("END:VEVENT") === 0) {
      if (start) {
        var s = ymdToDate(start);
        var e = end ? ymdToDate(end) : addDays(s, 1);
        for (var d = new Date(s); d < e; d = addDays(d, 1)) dates.add(isoUTC(d));
      }
      inEvent = false; continue;
    }
    if (!inEvent) continue;
    if (/^DTSTART/.test(line)) { var ms = line.match(/(\d{8})/); if (ms) start = ms[1]; }
    else if (/^DTEND/.test(line)) { var me = line.match(/(\d{8})/); if (me) end = me[1]; }
  }
  return dates;
}

async function fetchFeed(url) {
  var r = await fetch(url, {
    headers: { "User-Agent": "BryceGetaways-CalendarSync/1.0 (+https://www.brycemountaingetaways.com)" }
  });
  if (!r.ok) throw new Error("HTTP " + r.status + " for " + url.split("?")[0]);
  return await r.text();
}

(async function main() {
  var blocked = {};
  var hadError = false;

  for (var home of Object.keys(FEEDS)) {
    blocked[home] = [];
    var raw = process.env[FEEDS[home]];
    if (!raw) { console.log("· " + home + ": no " + FEEDS[home] + " secret set — skipping"); continue; }
    var urls = raw.split(",").map(function (s) { return s.trim(); }).filter(Boolean);
    var all = new Set();
    for (var url of urls) {
      try {
        var txt = await fetchFeed(url);
        parseICS(txt).forEach(function (d) { all.add(d); });
      } catch (e) {
        hadError = true;
        console.error("! " + home + ": " + e.message);
      }
    }
    blocked[home] = Array.from(all).sort();
    console.log("· " + home + ": " + blocked[home].length + " blocked night(s)");
  }

  // Don't clobber good data with an empty result if every feed failed to fetch.
  if (hadError && Object.keys(blocked).every(function (k) { return blocked[k].length === 0; })) {
    console.error("All feeds failed and no dates parsed — leaving existing file untouched.");
    process.exit(1);
  }

  var out = JSON.stringify({ blocked: blocked, updated: new Date().toISOString() }, null, 2) + "\n";
  fs.writeFileSync(OUT, out);
  console.log("Wrote " + OUT);
})().catch(function (e) {
  console.error(e);
  process.exit(1);
});

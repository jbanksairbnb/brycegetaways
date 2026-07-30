/* Bryce Mountain Getaways — OTA calendar sync (Vercel serverless function).
 *
 * Fetches each home's iCal feed(s) from Airbnb / VRBO server-side (browsers can't,
 * due to cross-origin restrictions) and returns the booked/blocked nights as JSON.
 * The public availability calendar (assets/js/calendar.js) merges these on top of
 * the manually-managed blocks in assets/data/availability.json.
 *
 * CONFIGURE via Vercel → Project → Settings → Environment Variables.
 * One variable per home; comma-separate multiple feeds (e.g. Airbnb + VRBO):
 *   ICS_CHALET = https://www.airbnb.com/calendar/ical/XXXX.ics?t=...
 *   ICS_MODERN = https://www.airbnb.com/calendar/ical/YYYY.ics?t=... , https://www.vrbo.com/icalendar/ZZZ.ics
 *
 * Private feed URLs live only in these env vars — never in the repo.
 */

var FEEDS = { chalet: "ICS_CHALET", modern: "ICS_MODERN" };

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
  try {
    var r = await fetch(url, {
      headers: { "User-Agent": "BryceGetaways-CalendarSync/1.0 (+https://www.brycemountaingetaways.com)" }
    });
    if (!r.ok) return null;
    return await r.text();
  } catch (e) { return null; }
}

module.exports = async function handler(req, res) {
  var blocked = {};
  await Promise.all(Object.keys(FEEDS).map(async function (home) {
    blocked[home] = [];
    var raw = process.env[FEEDS[home]];
    if (!raw) return;
    var urls = raw.split(",").map(function (s) { return s.trim(); }).filter(Boolean);
    var all = new Set();
    await Promise.all(urls.map(async function (url) {
      var txt = await fetchFeed(url);
      if (txt) parseICS(txt).forEach(function (d) { all.add(d); });
    }));
    blocked[home] = Array.from(all).sort();
  }));

  res.setHeader("Content-Type", "application/json");
  // Cache at the edge for 5 min so we don't hammer the OTAs; refresh in background.
  res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=1800");
  res.status(200).json({ blocked: blocked, updated: new Date().toISOString() });
};

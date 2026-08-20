#!/usr/bin/env node
/* Bryce Mountain Getaways — direct-booking calendar + payment reminders.
 *
 * Reads the Supabase bookings ledger (every signed rental agreement) and does
 * two jobs the static site can't do for itself:
 *
 *   1. Writes assets/data/direct-booked.json — the nights held by bookings whose
 *      deposit has landed. assets/js/calendar.js merges it exactly like the OTA
 *      file, so a paid direct booking stops showing as available.
 *   2. Emits the reminders due today to $GITHUB_OUTPUT, for the workflow's mail
 *      step: balances due 5 days before check-in, and deposits still unpaid past
 *      the 3-day window the rental agreement gives them.
 *
 * Runs in CI, not the browser, because it needs the Supabase service key — the
 * only credential that can read guest details. That key must NEVER appear in a
 * committed file or in any asset the site serves.
 *
 * CONFIGURE via GitHub → Settings → Secrets and variables → Actions:
 *   SUPABASE_URL         = https://xxxxxxxx.supabase.co
 *   SUPABASE_SERVICE_KEY = a secret key (Project Settings → API Keys → Secret keys;
 *                          the legacy service_role key on older projects)
 */
"use strict";

var fs = require("fs");

var OUT = "assets/data/direct-booked.json";
var HOMES = ["chalet", "modern"];
var BLOCKING = ["deposit_received", "paid_in_full"]; // statuses that hold dates
var DEPOSIT_GRACE_DAYS = 3;   // §5 of the agreement: deposit due within 3 days
var KEEP_PAST_DAYS = 2;       // keep just-finished stays so today never flickers

var URL = (process.env.SUPABASE_URL || "").replace(/\/+$/, "");
var KEY = process.env.SUPABASE_SERVICE_KEY || "";
var TABLE = process.env.SUPABASE_BOOKINGS_TABLE || "bookings";

/* ------------------------------------------------------------------ dates */
function pad(n) { return (n < 10 ? "0" : "") + n; }
function isoUTC(d) { return d.getUTCFullYear() + "-" + pad(d.getUTCMonth() + 1) + "-" + pad(d.getUTCDate()); }
function addDays(d, n) { var x = new Date(d.getTime()); x.setUTCDate(x.getUTCDate() + n); return x; }
function parseISO(s) { var p = String(s).split("-"); return Date.UTC(+p[0], +p[1] - 1, +p[2]); }
function daysBetween(a, b) { return Math.round((parseISO(b) - parseISO(a)) / 86400000); }

// check_in .. check_out-1 — the checkout morning belongs to the next guest.
// Same rule scripts/sync-ical.js applies to DTSTART..DTEND, so the two sources
// never disagree about which nights a stay occupies.
function nightsOf(b) {
  var out = [], d = b.check_in;
  while (d < b.check_out) { out.push(d); d = isoUTC(addDays(new Date(parseISO(d)), 1)); }
  return out;
}

/* --------------------------------------------------------------- supabase */
async function sb(path, opts) {
  opts = opts || {};
  var headers = { apikey: KEY, Authorization: "Bearer " + KEY, "Content-Type": "application/json" };
  Object.keys(opts.headers || {}).forEach(function (k) { headers[k] = opts.headers[k]; });
  var res = await fetch(URL + path, { method: opts.method || "GET", headers: headers, body: opts.body });
  var text = await res.text();
  if (!res.ok) throw new Error("Supabase " + res.status + ": " + text.slice(0, 300));
  return text ? JSON.parse(text) : null;
}
function listBookings() { return sb("/rest/v1/" + TABLE + "?select=*&order=check_in.asc"); }
function stamp(id, field, when) {
  var patch = {};
  patch[field] = when;
  return sb("/rest/v1/" + TABLE + "?id=eq." + encodeURIComponent(id), {
    method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify(patch)
  });
}

/* ------------------------------------------------------------------ main */
function readExisting() {
  try { return JSON.parse(fs.readFileSync(OUT, "utf8")); }
  catch (e) { return { blocked: {} }; }
}
function money(n) { return "$" + Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function line(b, what) {
  return "  • " + b.guest_name + " — " + b.home_name + ", " + b.check_in + " → " + b.check_out + "\n" +
         "    " + what + "\n" +
         "    " + b.guest_email + (b.guest_phone ? " · " + b.guest_phone : "") + "\n";
}

async function main() {
  if (!URL || !KEY) {
    // Not configured is a real failure, not a no-op: silently writing an empty
    // file would un-block every paid booking on the public calendar.
    console.error("SUPABASE_URL and SUPABASE_SERVICE_KEY are required.");
    process.exit(1);
  }

  var bookings = await listBookings();
  var today = isoUTC(new Date());
  var cutoff = isoUTC(addDays(new Date(), -KEEP_PAST_DAYS));
  console.log("Ledger: " + bookings.length + " booking(s); today is " + today);

  /* 1 — the nights a paid booking holds ---------------------------------- */
  var blocked = {}, counts = {};
  HOMES.forEach(function (h) { blocked[h] = []; counts[h] = 0; });
  bookings.forEach(function (b) {
    if (BLOCKING.indexOf(b.status) === -1) return;
    if (!blocked[b.home_key]) return; // unknown home — ignore rather than crash
    nightsOf(b).forEach(function (d) { if (d >= cutoff) blocked[b.home_key].push(d); });
    counts[b.home_key]++;
  });
  HOMES.forEach(function (h) {
    blocked[h] = Array.from(new Set(blocked[h])).sort();
    console.log("  " + h + ": " + counts[h] + " booking(s), " + blocked[h].length + " night(s) held");
  });

  // `updated` only moves when the dates do, or the daily run would commit (and
  // redeploy the site) every single day for no reason.
  var previous = readExisting();
  var same = JSON.stringify(previous.blocked || {}) === JSON.stringify(blocked);
  fs.writeFileSync(OUT, JSON.stringify({
    updated: (same && previous.updated) ? previous.updated : new Date().toISOString(),
    note: "Nights held by direct bookings whose deposit has been received. Generated from the Supabase bookings ledger by scripts/sync-bookings.js — do not edit by hand.",
    blocked: blocked
  }, null, 2) + "\n");

  /* 2 — what needs chasing today ----------------------------------------- */
  var balances = [], deposits = [];
  for (var b of bookings) {
    // Balance due: 5 days before check-in, once the deposit is in and the stay
    // wasn't paid up front. Sent once — reminder_sent_at is the latch.
    if (b.status === "deposit_received" && !b.reminder_sent_at &&
        Number(b.balance_due) > 0 && b.balance_due_date && b.balance_due_date <= today &&
        b.check_out >= today) {
      balances.push(b);
    }
    // Deposit overdue: signed more than 3 days ago with nothing received, so the
    // agreement lets the dates be released. Also sent once.
    if (b.status === "signed" && !b.deposit_alert_sent_at && b.signed_at &&
        daysBetween(String(b.signed_at).slice(0, 10), today) > DEPOSIT_GRACE_DAYS &&
        b.check_out >= today) {
      deposits.push(b);
    }
  }

  var body = "";
  if (balances.length) {
    body += "BALANCE DUE — 5 days before check-in\n\n";
    balances.forEach(function (b) {
      body += line(b, "Balance of " + money(b.balance_due) + " was due " + b.balance_due_date + ".");
    });
    body += "\n";
  }
  if (deposits.length) {
    body += "DEPOSIT NOT RECEIVED — past the 3-day window\n\n";
    deposits.forEach(function (b) {
      body += line(b, "Deposit of " + money(b.deposit_due) + " still unpaid; signed " +
        String(b.signed_at).slice(0, 10) + ". The agreement allows these dates to be released.");
    });
    body += "\n";
  }
  if (body) body += "Manage these at https://www.brycemountaingetaways.com/manage.html\n";

  console.log("Reminders: " + balances.length + " balance, " + deposits.length + " deposit");

  // Latch only after the body is built. If the mail step then fails, the run
  // goes red and the stamps are already set — so re-check the manager page on a
  // red run rather than assuming a reminder was delivered.
  var now = new Date().toISOString();
  for (var x of balances) await stamp(x.id, "reminder_sent_at", now);
  for (var y of deposits) await stamp(y.id, "deposit_alert_sent_at", now);

  var out = process.env.GITHUB_OUTPUT;
  if (out) {
    fs.appendFileSync(out, "has_reminders=" + (body ? "true" : "false") + "\n");
    fs.appendFileSync(out, "subject=Bryce Getaways — " + (balances.length + deposits.length) + " payment reminder(s)\n");
    fs.appendFileSync(out, "body<<BMG_EOF\n" + body + "\nBMG_EOF\n");
  } else if (body) {
    console.log("\n" + body);
  }
}

main().catch(function (e) {
  console.error("Booking sync failed: " + e.message);
  process.exit(1);
});

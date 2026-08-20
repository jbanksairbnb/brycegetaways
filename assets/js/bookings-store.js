/* Bryce Mountain Getaways — the bookings ledger (Supabase).

   Every signed agreement is filed here at submit time, and the owners work the
   ledger from /manage.html. Two very different callers share this module:

     • booking.js  — inserts with the public (anon) key. Insert is the ONLY thing
       that key is allowed to do; it cannot read a single row back. Guest names,
       addresses and phone numbers never leave the table for an anonymous caller.
     • manage.js   — reads and updates after the owner signs in through Supabase
       Auth. The access token, not the anon key, is what unlocks those rows.

   See the README ("Bookings ledger") for the table and the row-level security
   policies that make the split above true — the policies are what enforce it,
   not this file. */
(function () {
  "use strict";

  var SESSION_KEY = "bmg_sb_session";
  var BLOCKING = ["deposit_received", "paid_in_full"]; // statuses that hold dates

  function cfg() {
    var c = window.BMGConfig || {};
    // The bookings table lives in the same project as the discount signups, so
    // fall back to that block rather than making the owners paste the URL twice.
    var sb = c.supabase || c.discount || {};
    var b = c.bookings || {};
    return {
      url: (sb.supabaseUrl || sb.url || "").replace(/\/+$/, ""),
      anonKey: sb.supabaseAnonKey || sb.anonKey || "",
      table: b.table || "bookings"
    };
  }
  function configured() { var c = cfg(); return !!(c.url && c.anonKey); }

  /* ------------------------------------------------------------ dates */
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function iso(d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
  function parseISO(s) { var p = String(s).split("-"); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function addDaysISO(s, n) { var d = parseISO(s); d.setDate(d.getDate() + n); return iso(d); }

  // A stay from check_in to check_out holds the nights check_in .. check_out-1 —
  // the checkout morning is free for the next guest. Same rule the Airbnb sync
  // applies to DTSTART..DTEND, so both sources agree on what "booked" means.
  function nightsOf(b) {
    var out = [], d = b.check_in;
    while (d < b.check_out) { out.push(d); d = addDaysISO(d, 1); }
    return out;
  }
  function holdsDates(b) { return BLOCKING.indexOf(b.status) !== -1; }

  /* ------------------------------------------------------------- REST */
  function rest(path, opts) {
    var c = cfg();
    opts = opts || {};
    var headers = { apikey: c.anonKey, "Content-Type": "application/json" };
    Object.keys(opts.headers || {}).forEach(function (k) { headers[k] = opts.headers[k]; });
    headers.Authorization = "Bearer " + (opts.token || c.anonKey);
    return fetch(c.url + path, { method: opts.method || "GET", headers: headers, body: opts.body })
      .then(function (r) {
        return r.text().then(function (t) {
          var data = null;
          try { data = t ? JSON.parse(t) : null; } catch (e) { data = null; }
          if (!r.ok) {
            var msg = (data && (data.message || data.error_description || data.error || data.msg)) || ("HTTP " + r.status);
            throw new Error(msg);
          }
          return data;
        });
      });
  }

  /* ------------------------------------------------------------- save */
  // Called by booking.js the moment a guest signs. Resolves false rather than
  // rejecting when Supabase isn't configured, so the booking flow can treat a
  // missing ledger as "not filed" without special-casing it.
  function save(record) {
    if (!configured()) return Promise.resolve(false);
    return rest("/rest/v1/" + cfg().table, {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify(record)
    }).then(function () { return true; });
  }

  /* ------------------------------------------------------------- auth */
  function session() {
    try {
      var s = JSON.parse(sessionStorage.getItem(SESSION_KEY) || "null");
      if (s && s.expires_at && s.expires_at * 1000 > Date.now()) return s;
    } catch (e) { /* fall through to signed-out */ }
    return null;
  }
  function signIn(email, password) {
    return rest("/auth/v1/token?grant_type=password", {
      method: "POST",
      body: JSON.stringify({ email: email, password: password })
    }).then(function (s) {
      if (!s || !s.access_token) throw new Error("No session returned.");
      // Kept in sessionStorage, not localStorage: the owner's read access to
      // every guest's details dies with the tab rather than lingering forever.
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(s));
      return s;
    });
  }
  function signOut() { sessionStorage.removeItem(SESSION_KEY); }
  function token() { var s = session(); return s && s.access_token; }

  /* -------------------------------------------------- read / update */
  function list() {
    var t = token();
    if (!t) return Promise.reject(new Error("Not signed in."));
    return rest("/rest/v1/" + cfg().table + "?select=*&order=check_in.asc", { token: t });
  }
  function update(id, patch) {
    var t = token();
    if (!t) return Promise.reject(new Error("Not signed in."));
    return rest("/rest/v1/" + cfg().table + "?id=eq." + encodeURIComponent(id), {
      method: "PATCH", token: t,
      headers: { Prefer: "return=representation" },
      body: JSON.stringify(patch)
    });
  }

  window.BMGBookings = {
    BLOCKING: BLOCKING,
    configured: configured, save: save,
    signIn: signIn, signOut: signOut, session: session,
    list: list, update: update,
    nightsOf: nightsOf, holdsDates: holdsDates, addDaysISO: addDaysISO
  };
})();

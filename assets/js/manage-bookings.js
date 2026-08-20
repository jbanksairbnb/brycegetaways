/* Bryce Mountain Getaways — the Bookings tab on /manage.html.

   Every signed rental agreement lands in the Supabase ledger (bookings-store.js).
   This is where the owners work it: see who signed, mark a deposit received,
   read or print the agreement a guest actually signed.

   Two separate credentials are in play on this page, and they do different jobs:
     • the Supabase owner login — unlocks the guest details. Nothing on the
       public site can read them; only a signed-in owner can.
     • the GitHub token already at the top of the page — used only to kick the
       Bookings workflow so the calendar catches up in a minute rather than at
       tomorrow's scheduled run.

   Marking a deposit received is what holds the dates: the workflow regenerates
   assets/data/direct-booked.json from this ledger, and the calendar merges it. */
(function () {
  "use strict";

  var OWNER = "jbanksairbnb", REPO = "brycegetaways", WORKFLOW = "bookings.yml";
  var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  var DEPOSIT_GRACE_DAYS = 3;

  var LABELS = {
    signed: "Signed — awaiting deposit",
    deposit_received: "Deposit received",
    paid_in_full: "Paid in full",
    cancelled: "Cancelled"
  };

  var rows = [];   // the ledger, newest stay last
  var el = {};

  /* --------------------------------------------------------- formatting */
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }
  function money(n) { return "$" + Number(n || 0).toLocaleString("en-US", { maximumFractionDigits: 2 }); }
  function fmt(d) {
    if (!d) return "—";
    var p = String(d).slice(0, 10).split("-");
    return MONTHS[+p[1] - 1] + " " + (+p[2]) + ", " + p[0];
  }
  function todayISO() {
    var d = new Date();
    return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2);
  }
  function daysSince(ts) {
    if (!ts) return 0;
    return Math.floor((Date.parse(todayISO()) - Date.parse(String(ts).slice(0, 10))) / 86400000);
  }

  function status(msg, isErr) {
    el.status.textContent = msg || "";
    el.status.className = "mgr-status " + (isErr ? "is-err" : "is-ok");
  }

  /* ------------------------------------------------------- what's urgent */
  // Two things the owners must not miss, both straight out of the agreement:
  // a deposit that never arrived inside its 3-day window, and a balance due
  // 5 days before check-in. The daily workflow e-mails these; the tab shows
  // them the moment the page is open.
  function flagsFor(b) {
    var out = [];
    if (b.status === "signed" && daysSince(b.signed_at) > DEPOSIT_GRACE_DAYS && b.check_out >= todayISO()) {
      out.push({ cls: "is-late", text: "Deposit " + daysSince(b.signed_at) + " days overdue — dates may be released" });
    }
    if (b.status === "deposit_received" && Number(b.balance_due) > 0 &&
        b.balance_due_date && b.balance_due_date <= todayISO() && b.check_out >= todayISO()) {
      out.push({ cls: "is-late", text: "Balance " + money(b.balance_due) + " due " + fmt(b.balance_due_date) });
    }
    return out;
  }

  /* ---------------------------------------------------------- rendering */
  function render() {
    if (!rows.length) {
      el.list.innerHTML = '<p class="mgr-sub">No bookings yet. A booking appears here the moment a guest signs the agreement.</p>';
      el.summary.textContent = "";
      return;
    }
    var today = todayISO();
    var upcoming = rows.filter(function (b) { return b.check_out >= today && b.status !== "cancelled"; });
    var rest = rows.filter(function (b) { return upcoming.indexOf(b) === -1; });
    var owed = upcoming.reduce(function (n, b) {
      return n + (b.status === "signed" ? Number(b.deposit_due || 0)
        : b.status === "deposit_received" ? Number(b.balance_due || 0) : 0);
    }, 0);
    el.summary.textContent = upcoming.length + " upcoming · " + money(owed) + " outstanding";

    el.list.innerHTML =
      section("Upcoming", upcoming.sort(byCheckIn)) +
      section("Past &amp; cancelled", rest.sort(byCheckIn).reverse());
    bindRows();
  }
  function byCheckIn(a, b) { return a.check_in < b.check_in ? -1 : a.check_in > b.check_in ? 1 : 0; }

  function section(title, list) {
    if (!list.length) return "";
    return '<h3 class="bkg-h">' + title + "</h3>" + list.map(card).join("");
  }

  function card(b) {
    var flags = flagsFor(b).map(function (f) {
      return '<div class="bkg-flag ' + f.cls + '">' + esc(f.text) + "</div>";
    }).join("");
    var pay = b.status === "signed" ? "Deposit due " + money(b.deposit_due)
      : b.status === "deposit_received" ? (Number(b.balance_due) > 0
          ? "Balance " + money(b.balance_due) + " due " + fmt(b.balance_due_date)
          : "Paid in full at booking")
      : b.status === "paid_in_full" ? "Paid in full"
      : "Cancelled";

    return '<div class="bkg-card" data-id="' + esc(b.id) + '">' +
      '<div class="bkg-card__top">' +
        "<div>" +
          '<div class="bkg-guest">' + esc(b.guest_name) + "</div>" +
          '<div class="bkg-meta">' + esc(b.home_name) + " · " + fmt(b.check_in) + " → " + fmt(b.check_out) +
            " · " + b.nights + " night" + (b.nights > 1 ? "s" : "") +
            " · " + b.guests + " guest" + (b.guests > 1 ? "s" : "") + (b.dogs ? " · " + b.dogs + " dog" + (b.dogs > 1 ? "s" : "") : "") +
          "</div>" +
        "</div>" +
        '<span class="bkg-badge bkg-badge--' + esc(b.status) + '">' + esc(LABELS[b.status] || b.status) + "</span>" +
      "</div>" +
      flags +
      '<div class="bkg-meta bkg-meta--contact">' + esc(b.guest_email) +
        (b.guest_phone ? " · " + esc(b.guest_phone) : "") +
        (b.guest_address ? " · " + esc(b.guest_address) : "") + "</div>" +
      '<div class="bkg-money"><strong>' + money(b.total) + "</strong> total · " + esc(pay) +
        " · signed " + fmt(b.signed_at) + "</div>" +
      '<div class="bkg-actions">' +
        '<button type="button" class="mgr-btn mgr-btn--ghost" data-act="agreement">View agreement</button>' +
        (b.status === "signed" ? '<button type="button" class="mgr-btn" data-act="deposit">Deposit received</button>' : "") +
        (b.status === "deposit_received" ? '<button type="button" class="mgr-btn" data-act="paid">Mark paid in full</button>' : "") +
        (b.status !== "cancelled" ? '<button type="button" class="mgr-btn mgr-btn--ghost" data-act="cancel">Cancel</button>'
                                  : '<button type="button" class="mgr-btn mgr-btn--ghost" data-act="reopen">Reopen</button>') +
      "</div>" +
    "</div>";
  }

  function bindRows() {
    Array.prototype.forEach.call(el.list.querySelectorAll(".bkg-card"), function (cardEl) {
      var b = byId(cardEl.getAttribute("data-id"));
      Array.prototype.forEach.call(cardEl.querySelectorAll("[data-act]"), function (btn) {
        btn.addEventListener("click", function () { act(b, btn.getAttribute("data-act"), btn); });
      });
    });
  }
  function byId(id) {
    for (var i = 0; i < rows.length; i++) if (String(rows[i].id) === String(id)) return rows[i];
    return null;
  }

  /* ------------------------------------------------------------ actions */
  function act(b, what, btn) {
    if (!b) return;
    if (what === "agreement") return showAgreement(b);

    var now = new Date().toISOString(), patch;
    if (what === "deposit") patch = { status: "deposit_received", deposit_received_at: now };
    else if (what === "paid") patch = { status: "paid_in_full", paid_in_full_at: now };
    else if (what === "cancel") {
      if (!window.confirm("Cancel " + b.guest_name + "'s booking? This releases the dates back onto the calendar.")) return;
      patch = { status: "cancelled", cancelled_at: now };
    } else if (what === "reopen") patch = { status: "signed", cancelled_at: null };
    else return;

    // Whether the nights are held changes on either side of this update, so the
    // calendar has to be regenerated in both directions — a cancellation must
    // give the dates back just as promptly as a deposit takes them.
    var wasHolding = window.BMGBookings.holdsDates(b);
    btn.disabled = true;
    window.BMGBookings.update(b.id, patch)
      .then(function () {
        Object.keys(patch).forEach(function (k) { b[k] = patch[k]; });
        render();
        if (wasHolding !== window.BMGBookings.holdsDates(b)) return refreshCalendar();
        status("Saved.", false);
      })
      .catch(function (e) { btn.disabled = false; status("Couldn't save: " + e.message, true); });
  }

  // Ask the Bookings workflow to rebuild the calendar now. Best-effort: the
  // scheduled run does the same job, so a token without Actions permission
  // means "tomorrow", not "broken".
  function refreshCalendar() {
    var tokenEl = document.getElementById("mgr-token");
    var token = tokenEl && tokenEl.value.trim();
    var branchEl = document.getElementById("mgr-branch");
    var ref = (branchEl && branchEl.value.trim()) || "main";
    if (!token) {
      status("Saved. Paste your GitHub token above to push the calendar update now — otherwise it lands at the next daily run.", false);
      return;
    }
    return fetch("https://api.github.com/repos/" + OWNER + "/" + REPO + "/actions/workflows/" + WORKFLOW + "/dispatches", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + token,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28"
      },
      body: JSON.stringify({ ref: ref })
    }).then(function (r) {
      if (r.status === 204) { status("Saved. The calendar updates in about a minute.", false); return; }
      throw new Error("HTTP " + r.status);
    }).catch(function () {
      status("Saved. Couldn't start the calendar rebuild — check the token has Actions: Read and write. It will update at the next daily run.", true);
    });
  }

  function showAgreement(b) {
    var w = window.open("", "_blank");
    if (!w) { status("Allow pop-ups to view the agreement.", true); return; }
    w.document.write('<!doctype html><html><head><meta charset="utf-8"><title>Rental Agreement — ' +
      esc(b.guest_name) + '</title>' +
      '<style>body{font-family:Georgia,serif;max-width:7.2in;margin:0 auto;padding:24px;color:#1b1d1b;line-height:1.5}' +
      'h1{font-size:22px;text-align:center;margin:0 0 2px}.agr-brand{text-align:center;color:#3d5c4c;margin-bottom:16px}' +
      'h2{font-size:15px;margin:16px 0 4px}p,li{font-size:12.5px}.agr-table{border-collapse:collapse;width:100%;margin:6px 0}' +
      '.agr-table th,.agr-table td{border:1px solid #999;padding:5px 8px;font-size:12.5px;text-align:left}.agr-table .amt{text-align:right}' +
      '.agr-sign{margin-top:20px}</style></head><body>' +
      (b.agreement_html || "<p>No agreement was stored for this booking.</p>") + "</body></html>");
    w.document.close();
  }

  /* --------------------------------------------------------------- auth */
  function load() {
    status("Loading bookings…", false);
    return window.BMGBookings.list()
      .then(function (data) { rows = data || []; status("", false); render(); })
      .catch(function (e) { status("Couldn't load bookings: " + e.message, true); });
  }

  function showSignedIn(yes) {
    el.login.hidden = yes;
    el.panel.hidden = !yes;
  }

  function signIn() {
    var email = el.email.value.trim(), pw = el.pw.value;
    if (!email || !pw) { status("Enter the owner e-mail and password.", true); return; }
    el.signin.disabled = true;
    window.BMGBookings.signIn(email, pw)
      .then(function () { el.pw.value = ""; showSignedIn(true); return load(); })
      .catch(function (e) { status("Sign-in failed: " + e.message, true); })
      .then(function () { el.signin.disabled = false; });
  }

  /* --------------------------------------------------------------- init */
  function init() {
    el.card = document.getElementById("bkg");
    if (!el.card) return;
    el.login = document.getElementById("bkg-login");
    el.panel = document.getElementById("bkg-panel");
    el.email = document.getElementById("bkg-email");
    el.pw = document.getElementById("bkg-pw");
    el.signin = document.getElementById("bkg-signin");
    el.signout = document.getElementById("bkg-signout");
    el.refresh = document.getElementById("bkg-refresh");
    el.status = document.getElementById("bkg-status");
    el.summary = document.getElementById("bkg-summary");
    el.list = document.getElementById("bkg-list");

    if (!window.BMGBookings || !window.BMGBookings.configured()) {
      el.login.innerHTML = '<p class="mgr-sub">Bookings aren\'t configured yet — add the Supabase project to ' +
        "<code>assets/js/site-config.js</code>. See the README (&ldquo;Bookings ledger&rdquo;).</p>";
      return;
    }

    el.signin.addEventListener("click", signIn);
    el.pw.addEventListener("keydown", function (e) { if (e.key === "Enter") signIn(); });
    el.refresh.addEventListener("click", load);
    el.signout.addEventListener("click", function () {
      window.BMGBookings.signOut(); rows = []; showSignedIn(false); status("Signed out.", false);
    });

    if (window.BMGBookings.session()) { showSignedIn(true); load(); }
    else showSignedIn(false);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();

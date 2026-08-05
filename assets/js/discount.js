/* Bryce Mountain Getaways — first-booking $50 discount.

   Three jobs:
     1. First-visit popup (once per browser) inviting a name + e-mail for $50 off.
     2. A permanent homepage banner, so the offer never depends on the popup.
     3. Signup handling — store the e-mail (Supabase), e-mail the guest their code
        and a "book here" link, notify the owners — plus the window.BMGDiscount API
        that booking.js uses to apply the $50 and mark it redeemed.

   The experience adapts to who the visitor is (see `state()` below): a brand-new
   visitor sees the form; a returning visitor who never signed up gets a nudge; a
   guest who has their code sees "your $50 is waiting"; a guest who has already
   booked with it sees a plain welcome-back — no second offer.

   Enforcement is owner-verified (Phase 1): the site shows and records the discount,
   and the owners confirm eligibility against the stored list before collecting
   payment. Everything degrades gracefully — with no Supabase/EmailJS configured the
   signup still works and the owners are still e-mailed; it just isn't persisted. */
(function () {
  "use strict";

  var OWNER_FORM = "https://formspree.io/f/mqaqgypl"; // same endpoint the site already uses
  var SEEN_KEY = "bmg_seen";   // "1" once the popup has been shown
  var DISC_KEY = "bmg_disc";   // JSON { code, email, name, status, ts }

  /* --------------------------------------------------------------- config */
  function cfg() { return (window.BMGConfig && window.BMGConfig.discount) || {}; }
  function amount() { var a = cfg().amount; return a == null ? 0 : +a; }
  function promoOn() { return amount() > 0; }
  function label() { return cfg().label || "First-booking discount"; }
  function emailCfg() { return (window.BMGConfig && window.BMGConfig.emailjs) || {}; }

  /* ------------------------------------------------------------- storage */
  function get() { try { return JSON.parse(localStorage.getItem(DISC_KEY) || "null"); } catch (e) { return null; } }
  function set(rec) { try { localStorage.setItem(DISC_KEY, JSON.stringify(rec)); } catch (e) {} }
  function seen() { try { return localStorage.getItem(SEEN_KEY) === "1"; } catch (e) { return false; } }
  function markSeen() { try { localStorage.setItem(SEEN_KEY, "1"); } catch (e) {} }

  // 'new'       — never here before (show popup)
  // 'returning' — been here, never signed up (nudge on the banner)
  // 'claimed'   — has a code, hasn't booked with it (remind them it's waiting)
  // 'redeemed'  — already booked with the discount (welcome back, no new offer)
  function state() {
    var r = get();
    if (r && r.status === "redeemed") return "redeemed";
    if (r && r.code) return "claimed";
    return seen() ? "returning" : "new";
  }

  function validEmail(s) { return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s || ""); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

  function newCode() {
    var rand;
    try { rand = (crypto.randomUUID ? crypto.randomUUID().replace(/-/g, "") : ""); } catch (e) { rand = ""; }
    if (!rand) { try { var a = new Uint8Array(8); crypto.getRandomValues(a); rand = Array.prototype.map.call(a, function (b) { return (b + 256).toString(16).slice(-2); }).join(""); } catch (e2) { rand = ""; } }
    return "BMG50-" + (rand ? rand.slice(0, 8) : String(new Date().getTime()).slice(-8)).toUpperCase();
  }

  function bookUrl(code) {
    var origin = window.location.origin + window.location.pathname.replace(/[^\/]*$/, "");
    // Land on the homepage homes/calendar section, carrying the code so the booking
    // flow can recover it (and, via Supabase, the guest's e-mail) on another device.
    return origin + "index.html?d=" + encodeURIComponent(code) + "#homes";
  }

  /* -------------------------------------------------------- Supabase REST */
  function sb() { var c = cfg(); return (c.supabaseUrl && c.supabaseAnonKey) ? c : null; }
  function sbUrl(c, qs) { return c.supabaseUrl.replace(/\/$/, "") + "/rest/v1/" + (c.table || "discount_signups") + (qs ? "?" + qs : ""); }
  function sbHeaders(c, extra) {
    var h = { apikey: c.supabaseAnonKey, Authorization: "Bearer " + c.supabaseAnonKey, "Content-Type": "application/json" };
    if (extra) for (var k in extra) h[k] = extra[k];
    return h;
  }
  function sbInsert(rec) {
    var c = sb(); if (!c) return Promise.resolve(null);
    return fetch(sbUrl(c), { method: "POST", headers: sbHeaders(c, { Prefer: "return=minimal" }), body: JSON.stringify(rec) })
      .then(function (r) { return r.ok ? true : null; }).catch(function () { return null; });
  }
  function sbFind(field, value) {
    var c = sb(); if (!c) return Promise.resolve(null);
    return fetch(sbUrl(c, field + "=eq." + encodeURIComponent(value) + "&select=email,name,code,status&limit=1"), { headers: sbHeaders(c) })
      .then(function (r) { return r.ok ? r.json() : []; })
      .then(function (rows) { return (rows && rows[0]) || null; })
      .catch(function () { return null; });
  }
  function sbSetRedeemed(email) {
    var c = sb(); if (!c || !email) return Promise.resolve(null);
    return fetch(sbUrl(c, "email=eq." + encodeURIComponent(email)), {
      method: "PATCH", headers: sbHeaders(c, { Prefer: "return=minimal" }),
      body: JSON.stringify({ status: "redeemed", redeemed_at: new Date().toISOString() })
    }).then(function (r) { return r.ok; }).catch(function () { return null; });
  }

  /* ------------------------------------------------------ signup pipeline */
  function autoReply(rec) {
    var e = emailCfg();
    if (!(window.emailjs && e.publicKey && e.serviceId && e.discountTemplateId)) return Promise.resolve(false);
    return window.emailjs.send(e.serviceId, e.discountTemplateId, {
      to_email: rec.email, reply_to: rec.email, guest_name: rec.name,
      discount_code: rec.code, discount_amount: "$" + amount(),
      book_url: bookUrl(rec.code)
    }, { publicKey: e.publicKey }).then(function () { return true; }).catch(function () { return false; });
  }
  function notifyOwner(rec) {
    return fetch(OWNER_FORM, {
      method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        _subject: "New $" + amount() + " discount signup — " + rec.name,
        _replyto: rec.email, type: "Discount signup",
        name: rec.name, email: rec.email, discount_code: rec.code,
        amount: "$" + amount(), signed_up_at: new Date().toISOString(),
        message: rec.name + " (" + rec.email + ") claimed the $" + amount() +
          " first-booking discount. Code: " + rec.code + ". Honor it once, on their first booking only."
      })
    }).then(function (r) { return r.ok; }).catch(function () { return false; });
  }

  // Store + e-mail + notify. Best-effort on every channel; the local record is
  // what makes the discount usable in this browser regardless of the network.
  function signup(name, email) {
    var rec = { code: newCode(), name: name, email: email, status: "eligible", ts: new Date().toISOString() };
    set(rec);
    var stored = { email: email, name: name, code: rec.code, status: "eligible", created_at: rec.ts };
    return Promise.all([sbInsert(stored), autoReply(rec), notifyOwner(rec)])
      .then(function (res) { return { rec: rec, emailed: !!res[1] }; });
  }

  /* ------------------------------------------------------------- the popup */
  var els = {};
  function build() {
    var o = document.createElement("div");
    o.className = "dq-overlay";
    o.setAttribute("hidden", "");
    o.innerHTML =
      '<div class="dq-modal" role="dialog" aria-modal="true" aria-label="' + amount() + ' dollars off your first stay">' +
        '<button class="dq-close" type="button" aria-label="Close">&times;</button>' +
        '<div class="dq-body"></div>' +
      '</div>';
    document.body.appendChild(o);
    els.overlay = o;
    els.body = o.querySelector(".dq-body");
    o.querySelector(".dq-close").addEventListener("click", close);
    o.addEventListener("click", function (e) { if (e.target === o) close(); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !o.hasAttribute("hidden")) close(); });
  }

  function renderForm() {
    els.body.innerHTML =
      '<div class="dq-eyebrow">Book direct &amp; save</div>' +
      '<h3 class="dq-title">$' + amount() + ' off your first stay</h3>' +
      '<p class="dq-sub">Drop your name and e-mail and we’ll send a code for $' + amount() +
        ' off your first booking at The Chalet or The Cabin — plus a link to check dates.</p>' +
      '<form class="dq-form" novalidate>' +
        '<label class="dq-field"><span>Name</span><input type="text" id="dq-name" autocomplete="name" required></label>' +
        '<label class="dq-field"><span>Email</span><input type="email" id="dq-email" autocomplete="email" required></label>' +
        '<div class="dq-err" id="dq-err" role="alert"></div>' +
        '<button type="submit" class="btn btn--dark dq-submit">SEND MY $' + amount() + ' CODE</button>' +
        '<p class="dq-fine">One code per guest, good for your first booking only. We’ll only e-mail you about your stay — no spam, unsubscribe anytime.</p>' +
      '</form>';
    var form = els.body.querySelector(".dq-form");
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var name = document.getElementById("dq-name").value.trim();
      var email = document.getElementById("dq-email").value.trim();
      var err = document.getElementById("dq-err");
      if (!name) { err.textContent = "Please add your name."; return; }
      if (!validEmail(email)) { err.textContent = "Please add a valid e-mail address."; return; }
      err.textContent = "";
      var btn = form.querySelector(".dq-submit");
      btn.disabled = true; btn.textContent = "SENDING…";
      signup(name, email).then(function (out) { renderSuccess(out.rec, out.emailed); })
        .catch(function () { renderSuccess(get() || { code: "", email: email }, false); });
    });
  }

  function renderSuccess(rec, emailed) {
    syncBanner();
    els.body.innerHTML =
      '<div class="dq-eyebrow">You’re in</div>' +
      '<h3 class="dq-title">Your $' + amount() + ' code is ready</h3>' +
      '<div class="dq-code">' + esc(rec.code) + '</div>' +
      '<p class="dq-sub">' + (emailed
        ? "We’ve e-mailed it to you with a link to check dates."
        : "It’s saved to this browser — it’ll apply automatically when you book.") +
        " It comes off your total on your first booking.</p>" +
      '<div class="dq-actions">' +
        '<button type="button" class="btn btn--dark" id="dq-book">CHECK DATES &amp; BOOK</button>' +
      '</div>';
    document.getElementById("dq-book").addEventListener("click", function () { close(); gotoBook(); });
  }

  // Already has a code but hasn't booked — remind them it's waiting.
  function renderWaiting(rec) {
    els.body.innerHTML =
      '<div class="dq-eyebrow">Welcome back</div>' +
      '<h3 class="dq-title">Your $' + amount() + ' is waiting</h3>' +
      '<div class="dq-code">' + esc(rec.code) + '</div>' +
      '<p class="dq-sub">It’ll come off your total automatically on your first booking.</p>' +
      '<div class="dq-actions">' +
        '<button type="button" class="btn btn--dark" id="dq-book">CHECK DATES &amp; BOOK</button>' +
      '</div>';
    document.getElementById("dq-book").addEventListener("click", function () { close(); gotoBook(); });
  }

  function open() {
    if (!promoOn()) return;
    if (!els.overlay) build();
    var s = state();
    if (s === "claimed") renderWaiting(get());
    else renderForm(); // 'new', 'returning', or (defensively) anything else
    els.overlay.removeAttribute("hidden");
    document.body.style.overflow = "hidden";
    var first = els.body.querySelector("input");
    if (first) setTimeout(function () { first.focus(); }, 60);
  }
  function close() { if (els.overlay) { els.overlay.setAttribute("hidden", ""); document.body.style.overflow = ""; } }

  function gotoBook() {
    var homes = document.getElementById("homes");
    if (homes) homes.scrollIntoView({ behavior: "smooth" });
    else window.location.href = "index.html#homes";
  }

  /* ------------------------------------------------------- homepage banner */
  // Any element with [data-discount-banner] is shown/hidden and its
  // [data-discount-msg] / [data-discount-cta] filled per the visitor's state.
  function syncBanner() {
    if (!promoOn()) {
      document.querySelectorAll("[data-discount-banner]").forEach(function (b) { b.setAttribute("hidden", ""); });
      return;
    }
    var s = state(), msg, cta;
    if (s === "redeemed") { msg = "Thanks for booking with us — your $" + amount() + " discount has been applied. See you at the mountain."; cta = ""; }
    else if (s === "claimed") { msg = "Your $" + amount() + " first-booking discount is ready — it comes off your total automatically."; cta = "Book your stay"; }
    else { msg = "Book direct and take $" + amount() + " off your first stay."; cta = "Get $" + amount() + " off"; }

    document.querySelectorAll("[data-discount-banner]").forEach(function (b) {
      b.removeAttribute("hidden");
      var m = b.querySelector("[data-discount-msg]"); if (m) m.textContent = msg;
      var c = b.querySelector("[data-discount-cta]");
      if (c) {
        if (cta) { c.textContent = cta; c.removeAttribute("hidden"); }
        else c.setAttribute("hidden", "");
      }
    });
  }

  function wireTriggers() {
    document.querySelectorAll("[data-discount-open]").forEach(function (el) {
      el.addEventListener("click", function (e) {
        e.preventDefault();
        if (state() === "redeemed") { gotoBook(); return; }
        open();
      });
    });
  }

  /* ---------------------------------------------------- arrive-with-a-code */
  // A guest clicking the "book here" link from their auto-reply lands with ?d=CODE.
  // Recover the code locally; if Supabase is configured, recover their name/e-mail
  // too so the discount is theirs even on a new device.
  function absorbUrlCode() {
    var m = window.location.search.match(/[?&]d=([^&]+)/);
    if (!m) return Promise.resolve();
    var code = decodeURIComponent(m[1]);
    var cur = get();
    if (cur && cur.code === code) return Promise.resolve();
    return sbFind("code", code).then(function (row) {
      if (row && row.code) set({ code: row.code, name: row.name, email: row.email, status: row.status === "redeemed" ? "redeemed" : "eligible", ts: new Date().toISOString() });
      else if (!cur) set({ code: code, name: "", email: "", status: "eligible", ts: new Date().toISOString() });
    });
  }

  /* ------------------------------------------------------------- public API */
  // Used by booking.js to apply the discount and record redemption.
  window.BMGDiscount = {
    amount: amount,
    label: label,
    current: get,
    state: state,
    openSignup: open,
    // Dollars to take off for this booking. Owner-verified (Phase 1): apply when
    // this browser holds a non-redeemed code. If the guest types a different
    // e-mail than the one on the code, still apply — the owners verify the list.
    amountFor: function (email) {
      if (!promoOn()) return 0;
      var r = get();
      if (r && r.code && r.status !== "redeemed") return amount();
      return 0;
    },
    // Mark the code used once a booking request goes in (local + Supabase best-effort).
    markRedeemed: function (email) {
      var r = get();
      if (r) { r.status = "redeemed"; r.email = r.email || email; set(r); }
      syncBanner();
      return sbSetRedeemed(email || (r && r.email));
    }
  };

  /* ------------------------------------------------------------------ init */
  function init() {
    if (!promoOn()) { syncBanner(); return; }
    wireTriggers();
    absorbUrlCode().then(function () {
      syncBanner();
      // First-visit popup: once per browser, and never for a guest who's already booked.
      if (!seen() && state() !== "redeemed") {
        markSeen();
        setTimeout(open, 1200);
      } else {
        markSeen();
      }
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();

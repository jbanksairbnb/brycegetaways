/* Bryce Mountain Getaways — booking request flow.
   Opened from the availability calendar with a home + date range. Shows the full
   cost (nightly + cleaning + pet + tax), collects guest details, presents the
   auto-filled rental agreement for a typed e-signature, and emails the request.
   Payment is collected by the owners (Zelle / Venmo / PayPal) — no online payment. */
(function () {
  "use strict";

  var FORM_ENDPOINT = "https://formspree.io/f/mqaqgypl";
  var TEMPLATE_URL = "assets/agreement-template.html";
  var LABEL = { chalet: "The Chalet", modern: "The Modern" };
  var ADDRESS = {
    chalet: "133 Aspen Way South, Basye, VA 22810",
    modern: "155 Aspen Way South, Basye, VA 22810"
  };
  var MONTHS = ["January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"];
  var DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  var tpl = null; // agreement template text (fetched once)
  var st = {};    // current booking state
  var els = {};

  /* ----------------------------------------------------------- helpers */
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function iso(d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
  function parseISO(s) { var p = s.split("-"); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function addDaysISO(s, n) { var d = parseISO(s); d.setDate(d.getDate() + n); return iso(d); }
  function nights(a, b) { return Math.round((parseISO(b) - parseISO(a)) / 86400000); }
  function todayISO() { return iso(new Date()); }
  function fmtLong(s) { var d = parseISO(s); return DAYS[d.getDay()] + ", " + MONTHS[d.getMonth()] + " " + d.getDate() + ", " + d.getFullYear(); }
  function round2(n) { return Math.round(n * 100) / 100; }
  function money(n) {
    var whole = Math.abs(n - Math.round(n)) < 1e-9;
    return "$" + n.toLocaleString("en-US", { minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: 2 });
  }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

  function homeObj(k) { return (window.BMGData && window.BMGData.homes && window.BMGData.homes[k]) || null; }
  function priceFor(h, s) {
    if (h.rates && h.rates[s] != null) return h.rates[s];
    var dow = parseISO(s).getDay(), weekend = (dow === 5 || dow === 6);
    return (weekend && h.weekendRate != null) ? h.weekendRate : h.defaultRate;
  }
  function feeCleaning(h) { return h.cleaningFee != null ? h.cleaningFee : 150; }
  function feePet(h) { return h.petFee != null ? h.petFee : 50; }
  function taxRate() { var d = window.BMGData; return (d && d.taxRate != null) ? d.taxRate : 10.3; }

  function compute() {
    var h = homeObj(st.homeKey), n = nights(st.start, st.end), sub = 0;
    for (var i = 0; i < n; i++) sub += priceFor(h, addDaysISO(st.start, i));
    var clean = feeCleaning(h);
    var pet = st.dogs > 0 ? feePet(h) : 0;
    var tax = round2(sub * taxRate() / 100); // room rate only
    var total = round2(sub + clean + pet + tax);
    var deposit = round2(total / 2);
    return { n: n, sub: sub, clean: clean, pet: pet, tax: tax, total: total, deposit: deposit, balance: round2(total - deposit) };
  }

  /* --------------------------------------------------------- build shell */
  function build() {
    var o = document.createElement("div");
    o.className = "bk-overlay";
    o.setAttribute("hidden", "");
    o.innerHTML =
      '<div class="bk-modal" role="dialog" aria-modal="true" aria-label="Request to book">' +
        '<button class="bk-close" type="button" aria-label="Close">&times;</button>' +
        '<div class="bk-head">' +
          '<img class="bk-home-img" alt="">' +
          '<div><div class="bk-eyebrow">Request to Book</div>' +
          '<h3 class="bk-home-name"></h3><div class="bk-dates"></div></div>' +
        '</div>' +
        '<div class="bk-steps">' +
          '<span data-s="1">1 · Your stay</span>' +
          '<span data-s="2">2 · Details &amp; agreement</span>' +
          '<span data-s="3">3 · Confirm</span>' +
        '</div>' +
        '<div class="bk-body"></div>' +
      '</div>';
    document.body.appendChild(o);
    els.overlay = o;
    els.modal = o.querySelector(".bk-modal");
    els.img = o.querySelector(".bk-home-img");
    els.name = o.querySelector(".bk-home-name");
    els.dates = o.querySelector(".bk-dates");
    els.body = o.querySelector(".bk-body");
    els.steps = o.querySelector(".bk-steps");
    o.querySelector(".bk-close").addEventListener("click", close);
    o.addEventListener("click", function (e) { if (e.target === o) close(); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !o.hasAttribute("hidden")) close(); });
  }

  function setStep(n) {
    st.step = n;
    Array.prototype.forEach.call(els.steps.children, function (c) {
      c.classList.toggle("is-active", +c.getAttribute("data-s") === n);
      c.classList.toggle("is-done", +c.getAttribute("data-s") < n);
    });
    els.body.scrollTop = 0;
    els.modal.scrollTop = 0;
  }

  /* ------------------------------------------------------------ step 1 */
  function renderStep1() {
    setStep(1);
    var guestOpts = "";
    for (var g = 1; g <= 10; g++) guestOpts += '<option value="' + g + '"' + (g === st.guests ? " selected" : "") + ">" + g + "</option>";
    var dogOpts = "";
    [0, 1, 2].forEach(function (d) { dogOpts += '<option value="' + d + '"' + (d === st.dogs ? " selected" : "") + ">" + d + (d === 1 ? " dog" : " dogs") + "</option>"; });
    els.body.innerHTML =
      '<div class="bk-grid2">' +
        '<label class="bk-field"><span>Guests</span><select id="bk-guests">' + guestOpts + "</select></label>" +
        '<label class="bk-field"><span>Dogs</span><select id="bk-dogs">' + dogOpts + "</select>" +
          '<small class="bk-hint">Up to 2 dogs · more? <a href="#contact" data-bk-contact>contact us</a></small></label>' +
      "</div>" +
      '<div class="bk-summary" id="bk-summary"></div>' +
      '<div class="bk-actions"><button type="button" class="btn btn--light-outline" id="bk-back-cal">&larr; Dates</button>' +
      '<button type="button" class="btn btn--dark" id="bk-to2">CONTINUE</button></div>';
    document.getElementById("bk-guests").addEventListener("change", function () { st.guests = +this.value; });
    document.getElementById("bk-dogs").addEventListener("change", function () { st.dogs = +this.value; renderSummary(); });
    document.getElementById("bk-back-cal").addEventListener("click", function () { close(); if (window.BMGCalendar) window.BMGCalendar.open(st.homeKey); });
    document.getElementById("bk-to2").addEventListener("click", renderStep2);
    els.body.querySelector("[data-bk-contact]").addEventListener("click", function (e) { e.preventDefault(); close(); gotoContact(); });
    renderSummary();
  }

  function renderSummary() {
    var c = compute();
    var rows =
      row("Nightly rate — " + c.n + " night" + (c.n > 1 ? "s" : ""), money(c.sub)) +
      row("Cleaning fee", money(c.clean)) +
      (st.dogs > 0 ? row("Pet fee", money(c.pet)) : "") +
      row("Taxes (" + taxRate() + "% room rate)", money(c.tax)) +
      '<div class="bk-row bk-row--total"><span>Total</span><span>' + money(c.total) + "</span></div>" +
      '<div class="bk-row bk-row--sub"><span>Due now to hold (50%)</span><span>' + money(c.deposit) + "</span></div>" +
      '<div class="bk-row bk-row--sub"><span>Balance, 5 days before check-in</span><span>' + money(c.balance) + "</span></div>";
    document.getElementById("bk-summary").innerHTML = rows +
      '<p class="bk-fineprint">Estimate before your booking is confirmed. You pay the owners directly — nothing is charged here.</p>';
  }
  function row(label, val) { return '<div class="bk-row"><span>' + esc(label) + "</span><span>" + val + "</span></div>"; }

  /* ------------------------------------------------------------ step 2 */
  function renderStep2() {
    setStep(2);
    els.body.innerHTML =
      '<div class="bk-grid2">' +
        field("bk-name", "Full name", "text", st.name) +
        field("bk-email", "Email", "email", st.email) +
        field("bk-phone", "Phone", "tel", st.phone) +
        field("bk-address", "Mailing address", "text", st.address) +
      "</div>" +
      '<div class="bk-agree-head"><span class="bk-eyebrow">Rental Agreement</span>' +
        '<button type="button" class="bk-link" id="bk-download">Download a copy</button></div>' +
      '<div class="agreement-doc" id="bk-agreement">Loading agreement…</div>' +
      '<label class="bk-check"><input type="checkbox" id="bk-agreed"' + (st.agreed ? " checked" : "") + '> I have read and agree to the Rental Agreement above.</label>' +
      '<label class="bk-field bk-sign"><span>Type your full name to sign</span><input type="text" id="bk-signature" value="' + esc(st.signature || "") + '" placeholder="Your full legal name"></label>' +
      '<div class="bk-err" id="bk-err2"></div>' +
      '<div class="bk-actions"><button type="button" class="btn btn--light-outline" id="bk-to1">&larr; Back</button>' +
      '<button type="button" class="btn btn--dark" id="bk-to3">REVIEW &amp; SUBMIT</button></div>';

    bindField("bk-name", "name"); bindField("bk-email", "email");
    bindField("bk-phone", "phone"); bindField("bk-address", "address");
    document.getElementById("bk-agreed").addEventListener("change", function () { st.agreed = this.checked; });
    document.getElementById("bk-signature").addEventListener("input", function () { st.signature = this.value; refillAgreement(); });
    document.getElementById("bk-download").addEventListener("click", downloadAgreement);
    document.getElementById("bk-to1").addEventListener("click", renderStep1);
    document.getElementById("bk-to3").addEventListener("click", validateStep2);
    loadAgreement();
  }

  function field(id, label, type, val) {
    return '<label class="bk-field"><span>' + label + "</span><input id=\"" + id + "\" type=\"" + type + "\" value=\"" + esc(val || "") + "\"></label>";
  }
  function bindField(id, key) { document.getElementById(id).addEventListener("input", function () { st[key] = this.value.trim(); if (key === "name" && !st.signature) { st.signature = this.value; var s = document.getElementById("bk-signature"); if (s) s.value = this.value; refillAgreement(); } }); }

  function tokenMap() {
    var c = compute();
    return {
      AGREEMENT_DATE: fmtLong(todayISO()), GUEST_NAME: st.name || "____________________",
      PROPERTY_NAME: LABEL[st.homeKey], PROPERTY_ADDRESS: ADDRESS[st.homeKey],
      CHECKIN_DATE: fmtLong(st.start), CHECKOUT_DATE: fmtLong(st.end),
      NUM_GUESTS: st.guests, NUM_DOGS: st.dogs, NUM_NIGHTS: c.n,
      NIGHTLY_SUBTOTAL: money(c.sub), CLEANING_FEE: money(c.clean), PET_FEE: money(c.pet),
      TAX_RATE: taxRate(), TAX_AMOUNT: money(c.tax), TOTAL: money(c.total),
      DEPOSIT_AMOUNT: money(c.deposit), BALANCE_AMOUNT: money(c.balance),
      BALANCE_DUE_DATE: fmtLong(addDaysISO(st.start, -5)), CANCEL_BY_DATE: fmtLong(addDaysISO(st.start, -5)),
      SIGNATURE: st.signature ? esc(st.signature) : "____________________", SIGN_DATE: fmtLong(todayISO())
    };
  }
  function fill(text) { var m = tokenMap(); return text.replace(/\{\{(\w+)\}\}/g, function (_, k) { return m[k] != null ? m[k] : ""; }); }
  function loadAgreement() {
    if (tpl != null) { refillAgreement(); return; }
    fetch(TEMPLATE_URL, { cache: "no-store" }).then(function (r) { return r.text(); })
      .then(function (t) { tpl = t; refillAgreement(); })
      .catch(function () { var b = document.getElementById("bk-agreement"); if (b) b.textContent = "Couldn't load the agreement. Please email brycegetaways@gmail.com."; });
  }
  function refillAgreement() { var b = document.getElementById("bk-agreement"); if (b && tpl != null) b.innerHTML = fill(tpl); }

  function downloadAgreement() {
    if (tpl == null) return;
    var w = window.open("", "_blank");
    if (!w) return;
    w.document.write('<!doctype html><html><head><meta charset="utf-8"><title>Rental Agreement — Bryce Mountain Getaways</title>' +
      '<style>body{font-family:Georgia,serif;max-width:7.2in;margin:0 auto;padding:24px;color:#1b1d1b;line-height:1.5}' +
      'h1{font-size:22px;text-align:center;margin:0 0 2px}.agr-brand{text-align:center;color:#3d5c4c;margin-bottom:16px}' +
      'h2{font-size:15px;margin:16px 0 4px}p,li{font-size:12.5px}.agr-table{border-collapse:collapse;width:100%;margin:6px 0}' +
      '.agr-table th,.agr-table td{border:1px solid #999;padding:5px 8px;font-size:12.5px;text-align:left}.agr-table .amt{text-align:right}' +
      '.agr-sign{margin-top:20px}</style></head><body>' + fill(tpl) + "</body></html>");
    w.document.close();
    setTimeout(function () { w.focus(); w.print(); }, 350);
  }

  function validateStep2() {
    var err = [];
    if (!st.name) err.push("your name");
    if (!st.email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(st.email)) err.push("a valid email");
    if (!st.phone) err.push("a phone number");
    if (!st.address) err.push("a mailing address");
    var e2 = document.getElementById("bk-err2");
    if (err.length) { e2.textContent = "Please add " + err.join(", ") + "."; return; }
    if (!st.agreed) { e2.textContent = "Please check the box to agree to the Rental Agreement."; return; }
    if (!st.signature || st.signature.trim().length < 2) { e2.textContent = "Please type your full name to sign."; return; }
    e2.textContent = "";
    renderStep3();
  }

  /* ------------------------------------------------------------ step 3 */
  function renderStep3() {
    setStep(3);
    var c = compute();
    els.body.innerHTML =
      '<div class="bk-summary">' +
        row(LABEL[st.homeKey] + " · " + st.guests + " guest" + (st.guests > 1 ? "s" : "") + (st.dogs ? " · " + st.dogs + " dog" + (st.dogs > 1 ? "s" : "") : ""), "") +
        row(fmtLong(st.start) + " → " + fmtLong(st.end), c.n + " nights") +
        row("Total", money(c.total)) +
        '<div class="bk-row bk-row--total"><span>Due now to hold (50%)</span><span>' + money(c.deposit) + "</span></div>" +
      "</div>" +
      '<p class="bk-fineprint">Submitting sends your signed request to Jonathan &amp; Anna. They\'ll confirm and you\'ll pay them directly — see options below.</p>' +
      '<div class="bk-err" id="bk-err3"></div>' +
      '<div class="bk-actions"><button type="button" class="btn btn--light-outline" id="bk-to2b">&larr; Back</button>' +
      '<button type="button" class="btn btn--dark" id="bk-submit">SUBMIT REQUEST</button></div>';
    document.getElementById("bk-to2b").addEventListener("click", renderStep2);
    document.getElementById("bk-submit").addEventListener("click", submit);
  }

  function submit() {
    var btn = document.getElementById("bk-submit"), err = document.getElementById("bk-err3");
    btn.disabled = true; btn.textContent = "SENDING…";
    var c = compute();
    var payload = {
      _subject: "Booking request — " + LABEL[st.homeKey] + " — " + st.name,
      type: "Booking request", home: LABEL[st.homeKey], property_address: ADDRESS[st.homeKey],
      check_in: st.start, check_out: st.end, nights: c.n, guests: st.guests, dogs: st.dogs,
      nightly_subtotal: money(c.sub), cleaning_fee: money(c.clean), pet_fee: money(c.pet),
      taxes: money(c.tax), total: money(c.total), deposit_due_now: money(c.deposit),
      balance: money(c.balance), balance_due: fmtLong(addDaysISO(st.start, -5)),
      name: st.name, email: st.email, phone: st.phone, mailing_address: st.address,
      agreement_accepted: "YES", signature_typed: st.signature, signed_at: new Date().toISOString(),
      _replyto: st.email
    };
    fetch(FORM_ENDPOINT, { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify(payload) })
      .then(function (r) { if (!r.ok) throw new Error("bad"); return r.json(); })
      .then(function () { renderDone(c); })
      .catch(function () {
        err.textContent = "Something went wrong sending your request. Please email brycegetaways@gmail.com and we'll sort it out.";
        btn.disabled = false; btn.textContent = "SUBMIT REQUEST";
      });
  }

  function renderDone(c) {
    setStep(3);
    els.body.innerHTML =
      '<div class="bk-done">' +
        '<div class="bk-done__check">✓</div>' +
        "<h4>Request received — thank you!</h4>" +
        "<p>Jonathan &amp; Anna will confirm your dates shortly. A copy of your signed agreement is yours to download above. To <strong>hold your dates</strong>, the 50% reservation deposit of <strong>" + money(c.deposit) + "</strong> is due within <strong>3 days</strong>, or the dates are released.</p>" +
        '<div class="bk-pay">' +
          '<div class="bk-pay__title">How to send your deposit</div>' +
          "<ul>" +
            "<li><strong>Zelle</strong> — 805-689-2914 (no fee)</li>" +
            "<li><strong>Venmo</strong> — @jonathan-banks-27 (Goods &amp; Services adds 3%)</li>" +
            "<li><strong>PayPal</strong> — we'll send a payment link (Goods &amp; Services adds 3%)</li>" +
          "</ul>" +
        "</div>" +
        '<div class="bk-actions"><button type="button" class="btn btn--light-outline" id="bk-download2">Download agreement</button>' +
        '<button type="button" class="btn btn--dark" id="bk-done-close">DONE</button></div>' +
      "</div>";
    document.getElementById("bk-download2").addEventListener("click", downloadAgreement);
    document.getElementById("bk-done-close").addEventListener("click", close);
  }

  /* -------------------------------------------------------- open/close */
  function gotoContact() {
    var c = document.getElementById("contact");
    if (c) c.scrollIntoView({ behavior: "smooth" });
    else window.location.href = "index.html#contact";
  }

  function open(homeKey, start, end) {
    if (!homeObj(homeKey)) return;
    st = { homeKey: homeKey, start: start, end: end, guests: 2, dogs: 0, name: "", email: "", phone: "", address: "", agreed: false, signature: "", step: 1 };
    if (!els.overlay) build();
    var h = homeObj(homeKey);
    els.img.src = h.image; els.img.alt = h.name;
    els.name.textContent = h.name;
    els.dates.textContent = fmtLong(start) + " → " + fmtLong(end) + " · " + nights(start, end) + " nights";
    renderStep1();
    els.overlay.removeAttribute("hidden");
    document.body.style.overflow = "hidden";
  }
  function close() { if (els.overlay) { els.overlay.setAttribute("hidden", ""); document.body.style.overflow = ""; } }

  window.BMGBooking = { open: open };
})();

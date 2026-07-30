/* Bryce Mountain Getaways — availability calendar (public pop-up modal)
   Reads assets/data/availability.json (edited via /manage.html) and shows a
   12-month, per-home availability + rate calendar. Selecting a date range
   hands off to the booking-request form. No backend required. */
(function () {
  "use strict";

  var DATA_URL = "assets/data/availability.json";
  var monthsAhead = 12; // overridden by data.publicMonths on load
  var LABEL = { chalet: "The Chalet", modern: "The Modern" };

  var state = { data: null, homeKey: "chalet", start: null, end: null };
  var els = {};

  /* -------------------------------------------------------- date helpers */
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function iso(d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
  function parseISO(s) { var p = s.split("-"); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function today() { var d = new Date(); d.setHours(0, 0, 0, 0); return d; }
  function addDays(d, n) { var x = new Date(d); x.setDate(x.getDate() + n); return x; }
  function nightsBetween(a, b) { return Math.round((parseISO(b) - parseISO(a)) / 86400000); }
  function money(n) { return "$" + Math.round(n).toLocaleString(); }

  var MONTH_NAMES = ["January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"];
  var DOW = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

  function fmt(isoStr) {
    var d = parseISO(isoStr);
    return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d.getDay()] + ", " +
      MONTH_NAMES[d.getMonth()].slice(0, 3) + " " + d.getDate();
  }

  /* ---------------------------------------------------- data lookups */
  function home() { return state.data.homes[state.homeKey]; }
  function priceFor(h, isoStr) {
    if (h.rates && h.rates[isoStr] != null) return h.rates[isoStr];
    var dow = parseISO(isoStr).getDay();
    var weekend = (dow === 5 || dow === 6); // Fri & Sat nights
    return (weekend && h.weekendRate != null) ? h.weekendRate : h.defaultRate;
  }
  function isBlocked(h, isoStr) { return h.blocked && h.blocked.indexOf(isoStr) !== -1; }
  function rangeHasBlocked(h, a, b) { // nights a .. b-1
    var n = nightsBetween(a, b);
    for (var i = 0; i < n; i++) { if (isBlocked(h, iso(addDays(parseISO(a), i)))) return true; }
    return false;
  }
  function baseMin(h) { return h.minNights || 2; }
  function minStayFor(h, isoStr) {
    if (h.minStays && h.minStays[isoStr] != null) return h.minStays[isoStr];
    return baseMin(h);
  }
  // A stay must meet the highest minimum among the nights it covers.
  function requiredMin(h, a, b) {
    var req = baseMin(h), n = nightsBetween(a, b);
    for (var i = 0; i < n; i++) req = Math.max(req, minStayFor(h, iso(addDays(parseISO(a), i))));
    return req;
  }

  /* --------------------------------------------------------- build DOM */
  function build() {
    var overlay = document.createElement("div");
    overlay.className = "cal-overlay";
    overlay.setAttribute("hidden", "");
    overlay.innerHTML =
      '<div class="cal-modal" role="dialog" aria-modal="true" aria-label="Availability and rates">' +
        '<button class="cal-close" type="button" aria-label="Close calendar">&times;</button>' +
        '<div class="cal-head">' +
          '<div class="cal-home">' +
            '<img class="cal-home__img" alt="">' +
            '<div><div class="cal-home__eyebrow">Availability &amp; Rates</div>' +
            '<h3 class="cal-home__name"></h3></div>' +
          '</div>' +
          '<div class="cal-toggle" role="tablist" aria-label="Choose a home">' +
            '<button class="cal-tab" type="button" data-home="chalet" role="tab">The Chalet</button>' +
            '<button class="cal-tab" type="button" data-home="modern" role="tab">The Modern</button>' +
          '</div>' +
        '</div>' +
        '<div class="cal-legend">' +
          '<span class="cal-key cal-key--open"></span>Available' +
          '<span class="cal-key cal-key--blk"></span>Booked' +
          '<span class="cal-key cal-key--sel"></span>Your dates' +
          '<span class="cal-minnote"></span>' +
        '</div>' +
        '<div class="cal-months"></div>' +
        '<div class="cal-foot">' +
          '<div class="cal-summary">Select your check-in date</div>' +
          '<button class="btn btn--dark cal-request" type="button" disabled>CONTINUE</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(overlay);

    els.overlay = overlay;
    els.img = overlay.querySelector(".cal-home__img");
    els.name = overlay.querySelector(".cal-home__name");
    els.months = overlay.querySelector(".cal-months");
    els.summary = overlay.querySelector(".cal-summary");
    els.request = overlay.querySelector(".cal-request");
    els.minnote = overlay.querySelector(".cal-minnote");
    els.tabs = Array.prototype.slice.call(overlay.querySelectorAll(".cal-tab"));

    overlay.querySelector(".cal-close").addEventListener("click", close);
    overlay.addEventListener("click", function (e) { if (e.target === overlay) close(); });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !overlay.hasAttribute("hidden")) close();
    });
    els.tabs.forEach(function (t) {
      t.addEventListener("click", function () { setHome(t.getAttribute("data-home")); });
    });
    els.months.addEventListener("click", onDayClick);
    els.request.addEventListener("click", request);
  }

  /* ------------------------------------------------------- rendering */
  function setHome(k) {
    state.homeKey = k; state.start = null; state.end = null;
    var h = home();
    els.img.src = h.image; els.img.alt = h.name;
    els.name.textContent = h.name;
    els.minnote.textContent = " · " + (h.minNights || 2) + "-night minimum";
    els.tabs.forEach(function (t) {
      t.classList.toggle("is-active", t.getAttribute("data-home") === k);
    });
    renderMonths();
    updateFoot();
  }

  function renderMonths() {
    var h = home(), t = today(), html = "";
    for (var m = 0; m < monthsAhead; m++) {
      var first = new Date(t.getFullYear(), t.getMonth() + m, 1);
      var y = first.getFullYear(), mo = first.getMonth();
      html += '<div class="cal-month"><div class="cal-month__label">' +
        MONTH_NAMES[mo] + " " + y + '</div><div class="cal-grid">';
      for (var d = 0; d < 7; d++) html += '<div class="cal-dow">' + DOW[d] + "</div>";
      var startDow = new Date(y, mo, 1).getDay();
      for (var i = 0; i < startDow; i++) html += '<div class="cal-cell cal-cell--empty"></div>';
      var days = new Date(y, mo + 1, 0).getDate();
      for (var day = 1; day <= days; day++) {
        var cd = new Date(y, mo, day), s = iso(cd);
        var cls = "cal-cell";
        if (cd < t) {
          cls += " cal-cell--past";
          html += '<div class="' + cls + '"><span class="cal-daynum">' + day + "</span></div>";
        } else if (isBlocked(h, s)) {
          cls += " cal-cell--blocked";
          html += '<div class="' + cls + '"><span class="cal-daynum">' + day + "</span></div>";
        } else {
          cls += " cal-cell--open";
          var cell = '<div class="' + cls + '" data-date="' + s + '">' +
            '<span class="cal-daynum">' + day + "</span>" +
            '<span class="cal-price">' + money(priceFor(h, s)) + "</span>";
          var ms = (h.minStays && h.minStays[s] != null) ? h.minStays[s] : null;
          if (ms != null && ms !== baseMin(h)) cell += '<span class="cal-min">' + ms + "-night min</span>";
          html += cell + "</div>";
        }
      }
      html += "</div></div>";
    }
    els.months.innerHTML = html;
    paintSelection();
  }

  function paintSelection() {
    var cells = els.months.querySelectorAll(".cal-cell[data-date]");
    Array.prototype.forEach.call(cells, function (c) {
      c.classList.remove("is-start", "is-end", "is-range");
      var s = c.getAttribute("data-date");
      if (state.start && s === state.start) c.classList.add("is-start");
      if (state.end && s === state.end) c.classList.add("is-end");
      if (state.start && state.end &&
        parseISO(s) > parseISO(state.start) && parseISO(s) < parseISO(state.end)) {
        c.classList.add("is-range");
      }
    });
  }

  /* ---------------------------------------------------- interaction */
  function onDayClick(e) {
    var cell = e.target.closest(".cal-cell--open");
    if (!cell) return;
    var s = cell.getAttribute("data-date");
    if (!state.start || state.end || parseISO(s) <= parseISO(state.start)) {
      state.start = s; state.end = null;           // begin a new selection
    } else if (rangeHasBlocked(home(), state.start, s)) {
      state.start = s; state.end = null;           // can't span a booked night
    } else {
      state.end = s;                               // complete the range
    }
    paintSelection();
    updateFoot();
  }

  function updateFoot() {
    var h = home();
    if (state.start && state.end) {
      var n = nightsBetween(state.start, state.end), total = 0;
      for (var i = 0; i < n; i++) total += priceFor(h, iso(addDays(parseISO(state.start), i)));
      var min = requiredMin(h, state.start, state.end);
      if (n < min) {
        els.summary.textContent = n + " night" + (n > 1 ? "s" : "") + " selected — " + min + "-night minimum for these dates";
        els.request.disabled = true;
      } else {
        els.summary.innerHTML = fmt(state.start) + " &rarr; " + fmt(state.end) +
          ' &middot; <strong>' + n + " nights</strong> &middot; " + money(total) +
          ' <span class="cal-est">est. before taxes &amp; fees</span>';
        els.request.disabled = false;
      }
    } else if (state.start) {
      els.summary.textContent = "Check-in " + fmt(state.start) + " — now pick your check-out";
      els.request.disabled = true;
    } else {
      els.summary.textContent = "Select your check-in date";
      els.request.disabled = true;
    }
  }

  function request() {
    if (!state.start || !state.end) return;
    close();
    if (window.BMGBooking) {
      window.BMGBooking.open(state.homeKey, state.start, state.end);
    } else {
      window.location.href = "index.html?home=" + state.homeKey +
        "&in=" + state.start + "&out=" + state.end + "#homes";
    }
  }

  /* ---------------------------------------------------- open / close */
  function open(k) {
    if (!state.data) return;
    setHome(k && state.data.homes[k] ? k : "chalet");
    els.overlay.removeAttribute("hidden");
    document.body.style.overflow = "hidden";
  }
  function close() {
    els.overlay.setAttribute("hidden", "");
    document.body.style.overflow = "";
  }

  function bindTriggers() {
    document.querySelectorAll("[data-availability]").forEach(function (el) {
      el.addEventListener("click", function (e) {
        e.preventDefault();
        open(el.getAttribute("data-availability") || "chalet");
      });
    });
  }

  /* ------------------------------------------------------------- init */
  fetch(DATA_URL, { cache: "no-store" })
    .then(function (r) { return r.json(); })
    .then(function (d) {
      state.data = d;
      window.BMGData = d; // shared with the booking flow (booking.js)
      if (d.publicMonths && d.publicMonths >= 1) monthsAhead = d.publicMonths;
      build();
      bindTriggers();
      window.BMGCalendar = { open: open };
    })
    .catch(function () { /* leave the buttons as plain #book links on failure */ });
})();

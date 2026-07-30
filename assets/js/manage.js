/* Bryce Mountain Getaways — availability manager (private).
   Loads/saves assets/data/availability.json via the GitHub Contents API using a
   fine-grained token the owner pastes once (kept in localStorage). No server. */
(function () {
  "use strict";

  var OWNER = "jbanksairbnb", REPO = "brycegetaways", PATH = "assets/data/availability.json";
  var TOKEN_KEY = "bmg_gh_token", BRANCH_KEY = "bmg_gh_branch";
  var MONTHS_AHEAD = 15; // editor shows 15 months out; the public calendar shows 12
  var MONTH_NAMES = ["January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"];
  var DOW = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

  var state = { data: null, sha: null, homeKey: "chalet", picked: {} };
  var el = {};

  /* ---- date helpers ---- */
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function iso(d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
  function parseISO(s) { var p = s.split("-"); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function today() { var d = new Date(); d.setHours(0, 0, 0, 0); return d; }
  function money(n) { return "$" + Math.round(n).toLocaleString(); }

  /* ---- data helpers ---- */
  function home() { return state.data.homes[state.homeKey]; }
  function priceFor(h, s) {
    if (h.rates && h.rates[s] != null) return h.rates[s];
    var dow = parseISO(s).getDay(), weekend = (dow === 5 || dow === 6);
    return (weekend && h.weekendRate != null) ? h.weekendRate : h.defaultRate;
  }
  function isBlocked(h, s) { return h.blocked && h.blocked.indexOf(s) !== -1; }
  function hasOverride(h, s) { return h.rates && h.rates[s] != null; }
  function baseMin(h) { return h.minNights || 2; }

  /* ---- GitHub ---- */
  function token() { return (el.token.value || "").trim(); }
  function branch() { return (el.branch.value || "main").trim(); }
  function ghHeaders() {
    return {
      "Authorization": "Bearer " + token(),
      "Accept": "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28"
    };
  }
  function b64encode(str) { return btoa(unescape(encodeURIComponent(str))); }
  function b64decode(str) { return decodeURIComponent(escape(atob(str.replace(/\s/g, "")))); }

  function status(msg, isErr) {
    el.status.textContent = msg;
    el.status.className = "mgr-status " + (isErr ? "is-err" : "is-ok");
  }

  function contentsUrl(withRef) {
    var u = "https://api.github.com/repos/" + OWNER + "/" + REPO + "/contents/" + PATH;
    return withRef ? u + "?ref=" + encodeURIComponent(branch()) : u;
  }

  function ghGet() {
    return fetch(contentsUrl(true), { headers: ghHeaders(), cache: "no-store" })
      .then(function (r) { if (!r.ok) throw new Error("GET " + r.status); return r.json(); })
      .then(function (j) { state.sha = j.sha; return JSON.parse(b64decode(j.content)); });
  }

  function loadLocal() {
    return fetch(PATH, { cache: "no-store" })
      .then(function (r) { return r.json(); })
      .then(function (d) { state.data = d; state.sha = null; })
      .catch(function () { state.data = defaultData(); state.sha = null; });
  }

  function defaultData() {
    return {
      homes: {
        chalet: { name: "The Chalet", image: "assets/img/chalet-livingroom.jpg", minNights: 2, defaultRate: 375, weekendRate: 375, rates: {}, blocked: [] },
        modern: { name: "The Modern", image: "assets/img/modern-greatroom.jpg", minNights: 2, defaultRate: 375, weekendRate: 375, rates: {}, blocked: [] }
      }, updatedAt: null
    };
  }

  function load() {
    localStorage.setItem(TOKEN_KEY, token());
    localStorage.setItem(BRANCH_KEY, branch());
    state.picked = {};
    if (token()) {
      ghGet().then(function (d) { state.data = d; status("Loaded “" + branch() + "”. Ready to edit."); render(); })
        .catch(function (e) {
          status("Couldn't load from GitHub (" + e.message + "). Check the token, branch, and repo access. Showing the published copy for now.", true);
          loadLocal().then(render);
        });
    } else {
      loadLocal().then(function () { status("Preview only — paste a GitHub token, then Load, to enable saving.", true); render(); });
    }
  }

  function save() {
    if (!token()) { status("Paste a GitHub token first.", true); return; }
    el.save.disabled = true;
    status("Saving…");
    var doPut = function () {
      state.data.updatedAt = new Date().toISOString();
      var body = {
        message: "Update availability & rates (" + branch() + ")",
        content: b64encode(JSON.stringify(state.data, null, 2) + "\n"),
        branch: branch()
      };
      if (state.sha) body.sha = state.sha;
      return fetch(contentsUrl(false), { method: "PUT", headers: ghHeaders(), body: JSON.stringify(body) })
        .then(function (r) {
          if (!r.ok) return r.text().then(function (t) { throw new Error(r.status + " " + t.slice(0, 160)); });
          return r.json();
        })
        .then(function (j) { state.sha = j.content.sha; status("Saved ✓ — the site updates in about a minute."); });
    };
    // Make sure we have the current file SHA for this branch before writing.
    var pre = state.sha ? Promise.resolve() : ghGet().then(function (d) { /* refresh sha only */ });
    pre.then(doPut).catch(function (e) { status("Save failed: " + e.message, true); })
      .then(function () { el.save.disabled = false; });
  }

  /* ---- editing ops (apply to the picked set) ---- */
  function pickedList() { return Object.keys(state.picked); }
  function setPrice(v) {
    var h = home(); if (!h.rates) h.rates = {};
    pickedList().forEach(function (s) { if (v == null) delete h.rates[s]; else h.rates[s] = v; });
  }
  function setBlocked(on) {
    var h = home(); if (!h.blocked) h.blocked = [];
    pickedList().forEach(function (s) {
      var i = h.blocked.indexOf(s);
      if (on && i < 0) h.blocked.push(s);
      if (!on && i >= 0) h.blocked.splice(i, 1);
    });
  }
  function setMinStay(v) {
    var h = home(); if (!h.minStays) h.minStays = {};
    pickedList().forEach(function (s) { if (v == null) delete h.minStays[s]; else h.minStays[s] = v; });
  }

  /* ---- render ---- */
  function setHome(k) {
    state.homeKey = k; state.picked = {};
    var h = home();
    el.homeImg.src = h.image; el.homeImg.alt = h.name;
    el.homeName.textContent = h.name;
    el.rateDefault.value = h.defaultRate;
    el.rateWeekend.value = (h.weekendRate != null ? h.weekendRate : h.defaultRate);
    el.minBase.value = baseMin(h);
    el.tabs.forEach(function (t) { t.classList.toggle("is-active", t.getAttribute("data-home") === k); });
    render();
  }

  function render() {
    if (!state.data) return;
    var h = home(), t = today(), html = "";
    for (var m = 0; m < MONTHS_AHEAD; m++) {
      var first = new Date(t.getFullYear(), t.getMonth() + m, 1);
      var y = first.getFullYear(), mo = first.getMonth();
      html += '<div class="cal-month"><div class="cal-month__label">' + MONTH_NAMES[mo] + " " + y + '</div><div class="cal-grid">';
      for (var d = 0; d < 7; d++) html += '<div class="cal-dow">' + DOW[d] + "</div>";
      var startDow = new Date(y, mo, 1).getDay();
      for (var i = 0; i < startDow; i++) html += '<div class="cal-cell cal-cell--empty"></div>';
      var days = new Date(y, mo + 1, 0).getDate();
      for (var day = 1; day <= days; day++) {
        var cd = new Date(y, mo, day), s = iso(cd);
        if (cd < t) { html += '<div class="cal-cell cal-cell--past"><span class="cal-daynum">' + day + "</span></div>"; continue; }
        var blk = isBlocked(h, s);
        var minOv = (h.minStays && h.minStays[s] != null && h.minStays[s] !== baseMin(h));
        var cls = "cal-cell " + (blk ? "cal-cell--blocked" : "cal-cell--open");
        if (hasOverride(h, s)) cls += " has-override";
        if (minOv) cls += " has-minoverride";
        if (state.picked[s]) cls += " is-picked";
        html += '<div class="' + cls + '" data-date="' + s + '"><span class="cal-daynum">' + day + "</span>";
        if (blk) {
          html += '<span class="cal-price">Booked</span>';
        } else {
          html += '<span class="cal-price">' + money(priceFor(h, s)) + "</span>";
          if (minOv) html += '<span class="cal-min">' + h.minStays[s] + "-night min</span>";
        }
        html += "</div>";
      }
      html += "</div></div>";
    }
    el.cal.innerHTML = html;
    updateToolbar();
  }

  function updateToolbar() {
    var n = pickedList().length;
    el.count.textContent = n ? (n + " day" + (n > 1 ? "s" : "") + " selected") : "No days selected";
    el.toolbar.setAttribute("data-empty", n ? "false" : "true");
  }

  function onCellClick(e) {
    var cell = e.target.closest(".cal-cell[data-date]");
    if (!cell) return;
    var s = cell.getAttribute("data-date");
    if (state.picked[s]) delete state.picked[s]; else state.picked[s] = true;
    cell.classList.toggle("is-picked");
    updateToolbar();
  }

  /* ---- wire up ---- */
  function init() {
    el.token = document.getElementById("mgr-token");
    el.branch = document.getElementById("mgr-branch");
    el.status = document.getElementById("mgr-status");
    el.homeImg = document.getElementById("mgr-home-img");
    el.homeName = document.getElementById("mgr-home-name");
    el.rateDefault = document.getElementById("mgr-default");
    el.rateWeekend = document.getElementById("mgr-weekend");
    el.minBase = document.getElementById("mgr-minbase");
    el.cal = document.getElementById("mgr-cal");
    el.toolbar = document.getElementById("mgr-toolbar");
    el.count = document.getElementById("mgr-count");
    el.save = document.getElementById("mgr-save");
    el.tabs = Array.prototype.slice.call(document.querySelectorAll(".cal-tab"));

    el.token.value = localStorage.getItem(TOKEN_KEY) || "";
    el.branch.value = localStorage.getItem(BRANCH_KEY) || "claude/bryce-mountain-getaways-site-oaq9ts";

    document.getElementById("mgr-load").addEventListener("click", load);
    el.save.addEventListener("click", save);
    el.tabs.forEach(function (t) { t.addEventListener("click", function () { setHome(t.getAttribute("data-home")); }); });
    el.cal.addEventListener("click", onCellClick);

    document.getElementById("mgr-apply-rates").addEventListener("click", function () {
      var h = home();
      var dv = parseFloat(el.rateDefault.value), wv = parseFloat(el.rateWeekend.value), mb = parseInt(el.minBase.value, 10);
      if (!isNaN(dv)) h.defaultRate = dv;
      if (!isNaN(wv)) h.weekendRate = wv;
      if (!isNaN(mb) && mb >= 1) h.minNights = mb;
      render();
      status("Base settings updated for " + h.name + " — remember to Save.", false);
    });
    document.getElementById("mgr-setprice").addEventListener("click", function () {
      var v = parseFloat(el.price.value);
      if (isNaN(v)) { status("Enter a price first.", true); return; }
      setPrice(v); render();
    });
    el.price = document.getElementById("mgr-price");
    document.getElementById("mgr-resetprice").addEventListener("click", function () { setPrice(null); render(); });
    document.getElementById("mgr-block").addEventListener("click", function () { setBlocked(true); render(); });
    document.getElementById("mgr-unblock").addEventListener("click", function () { setBlocked(false); render(); });
    el.min = document.getElementById("mgr-min");
    document.getElementById("mgr-setmin").addEventListener("click", function () {
      var v = parseInt(el.min.value, 10);
      if (isNaN(v) || v < 1) { status("Enter a minimum-night number first.", true); return; }
      setMinStay(v); render();
    });
    document.getElementById("mgr-resetmin").addEventListener("click", function () { setMinStay(null); render(); });
    document.getElementById("mgr-clear").addEventListener("click", function () { state.picked = {}; render(); });

    // First paint from the published copy so the grid isn't empty before Load.
    loadLocal().then(function () {
      el.tabs.forEach(function (t) { t.classList.toggle("is-active", t.getAttribute("data-home") === state.homeKey); });
      setHome(state.homeKey);
      if (token()) load(); else status("Paste your GitHub token and click Load to edit the live data.", false);
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();

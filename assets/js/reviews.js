/* Bryce Mountain Getaways — homepage reviews.
   Loads all 275 Airbnb reviews from assets/data/reviews.json, renders an
   editorial "what guests love" theme row (clickable to filter), and a
   masonry card wall revealed in batches via "Read more". Progressive
   enhancement: if the fetch fails, the static fallback cards remain. */
(function () {
  "use strict";

  var DATA_URL = "assets/data/reviews.json";
  var BATCH = 9;                 // cards revealed per "Read more"
  var START = 6;                 // cards shown initially

  // Theme filters shown in the highlight row (order matters). Keys match the
  // `themes` tags in reviews.json; counts are computed from the data.
  var THEMES = [
    { key: "view",    label: "The View" },
    { key: "hosts",   label: "Our Hospitality" },
    { key: "comfort", label: "Comfort &amp; Care" },
    { key: "kitchen", label: "The Kitchen" },
    { key: "family",  label: "Kids &amp; Family" },
    { key: "dogs",    label: "Dog-Friendly" }
  ];

  var all = [], active = null, shown = START;
  var els = {};

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }
  function stars(n) { var s = ""; for (var i = 0; i < n; i++) s += "★"; return s; }

  // Keep cards tidy: trim the rare essay-length review at a word boundary.
  function clip(t, max) {
    if (t.length <= max) return t;
    var cut = t.slice(0, max);
    var sp = cut.lastIndexOf(" ");
    return cut.slice(0, sp > 0 ? sp : max).replace(/[.,;:\s]+$/, "") + "…";
  }

  function filtered() {
    return active ? all.filter(function (r) { return r.themes.indexOf(active) !== -1; }) : all;
  }

  function cardHTML(r) {
    var who = esc(r.name) + (r.loc ? " · " + esc(r.loc) : "");
    var meta = [r.date, r.trip].filter(Boolean).map(esc).join(" · ");
    return '<figure class="review-card">' +
      '<div class="review-stars">' + stars(r.stars) + "</div>" +
      '<blockquote class="review-quote">“' + esc(clip(r.text, 360)) + "”</blockquote>" +
      '<figcaption class="review-who">' + who +
        (meta ? '<span class="review-meta">' + meta + "</span>" : "") +
      "</figcaption></figure>";
  }

  function renderThemes() {
    var html = '<button class="rev-theme is-active" type="button" data-theme="">All' +
      '<span class="rev-theme__n">' + all.length + "</span></button>";
    THEMES.forEach(function (t) {
      var n = all.filter(function (r) { return r.themes.indexOf(t.key) !== -1; }).length;
      if (!n) return;
      html += '<button class="rev-theme" type="button" data-theme="' + t.key + '">' +
        t.label + '<span class="rev-theme__n">' + n + "</span></button>";
    });
    els.themes.innerHTML = html;
  }

  function render() {
    var list = filtered();
    els.grid.innerHTML = list.slice(0, shown).map(cardHTML).join("");
    var more = shown < list.length;
    els.more.style.display = more ? "" : "none";
    els.count.textContent = "Showing " + Math.min(shown, list.length) + " of " + list.length +
      (active ? " matching reviews" : " reviews");
    Array.prototype.forEach.call(els.themes.children, function (b) {
      b.classList.toggle("is-active", (b.getAttribute("data-theme") || "") === (active || ""));
    });
  }

  function setActive(theme) {
    active = theme || null;
    shown = START;
    render();
  }

  function init(data) {
    all = data;
    els.themes = document.getElementById("revThemes");
    els.grid = document.getElementById("revGrid");
    els.more = document.getElementById("revMore");
    els.count = document.getElementById("revCount");
    if (!els.grid) return;

    renderThemes();
    els.themes.addEventListener("click", function (e) {
      var b = e.target.closest(".rev-theme");
      if (b) setActive(b.getAttribute("data-theme"));
    });
    els.more.addEventListener("click", function () {
      shown += BATCH; render();
    });
    render();
  }

  fetch(DATA_URL, { cache: "no-store" })
    .then(function (r) { return r.json(); })
    .then(init)
    .catch(function () { /* leave the static fallback cards in place */ });
})();

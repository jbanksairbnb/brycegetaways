/* Bryce Mountain Getaways — homepage interactions */
(function () {
  "use strict";

  /* ---------------------------------------------------------------- Seasons */
  var seasons = {
    Winter: {
      img: "assets/img/season-winter.jpg",
      alt: "Snow on the slopes at Bryce Resort",
      title: "Ski-country winters, minutes from your door",
      copy: "Bryce Resort runs day and night skiing, snowboarding, tubing, and ice skating all winter — a five-minute walk from The Modern, a short stroll from The Chalet. Come home to the fireplace, or a hot tub under a cold, clear sky.",
      chips: ["Skiing & snowboarding", "Ski & snowboard lessons", "Night skiing", "Snow tubing", "Ice skating", "Après by the fire"]
    },
    Spring: {
      img: "assets/img/season-spring.jpg",
      alt: "Spring porch and deck at the homes",
      title: "The valley wakes up",
      copy: "Trails dry out, trout streams run high, and the porch swing season begins. Spring at Bryce is quiet, green, and yours — hiking, biking, and farmers markets without the crowds.",
      chips: ["Hiking trails", "Mountain biking", "Fly fishing", "Farmers markets"]
    },
    Summer: {
      img: "assets/img/season-summer.jpg",
      alt: "Covered deck bar with the Shenandoah Valley below",
      title: "Golf, lake days, and long evenings on the deck",
      copy: "Tee off on the PGA championship course, swim or kayak at Lake Laura, ride the mountain bike park — then grill dinner with the whole Shenandoah Valley laid out below you.",
      chips: ["PGA golf", "Fling golf", "Scenic lift rides", "Lake Laura", "Mountain bike park", "Deck dinners"]
    },
    Fall: {
      img: "assets/img/season-fall.jpg",
      alt: "Fall foliage across the valley on Skyline Drive",
      title: "Foliage season on Skyline Drive",
      copy: "October is peak Bryce — fire-red ridgelines, wineries along the Shenandoah Wine Trail, and the most famous fall drive in America under an hour away. Firepit nights included.",
      chips: ["Skyline Drive foliage", "Shenandoah wineries", "Mountain biking", "Hiking", "Firepit nights"]
    }
  };

  var seasonImg = document.getElementById("seasonImg");
  var seasonTitle = document.getElementById("seasonTitle");
  var seasonCopy = document.getElementById("seasonCopy");
  var seasonChips = document.getElementById("seasonChips");
  var panel = document.getElementById("season-panel");
  var tabs = Array.prototype.slice.call(document.querySelectorAll(".season-tab"));

  function selectSeason(name) {
    var d = seasons[name];
    if (!d) return;
    seasonImg.src = d.img;
    seasonImg.alt = d.alt;
    seasonImg.setAttribute("data-label", name);
    seasonImg.classList.remove("img-missing");
    seasonTitle.textContent = d.title;
    seasonCopy.textContent = d.copy;
    seasonChips.innerHTML = "";
    d.chips.forEach(function (label) {
      var span = document.createElement("span");
      span.className = "chip";
      span.textContent = label;
      seasonChips.appendChild(span);
    });
    tabs.forEach(function (t) {
      var on = t.getAttribute("data-season") === name;
      t.classList.toggle("is-active", on);
      if (on) { t.setAttribute("aria-selected", "true"); }
      else { t.removeAttribute("aria-selected"); }
    });
    if (panel) panel.setAttribute("aria-labelledby", "tab-" + name);
  }

  // Seasons only exist on the homepage — guard so this script is safe to
  // include on interior pages (wine country, property pages) too.
  if (seasonImg && seasonTitle && seasonCopy && seasonChips && tabs.length) {
    tabs.forEach(function (t, i) {
      t.addEventListener("click", function () { selectSeason(t.getAttribute("data-season")); });
      t.addEventListener("keydown", function (e) {
        if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
        e.preventDefault();
        var dir = e.key === "ArrowRight" ? 1 : -1;
        var next = tabs[(i + dir + tabs.length) % tabs.length];
        next.focus();
        selectSeason(next.getAttribute("data-season"));
      });
    });
    selectSeason("Summer");
  }

  /* --------------------------------------------------------- Sticky header */
  var header = document.getElementById("siteHeader");
  function onScroll() { header.classList.toggle("is-scrolled", window.scrollY > 40); }
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });

  /* ----------------------------------------------------------- Mobile nav */
  var toggle = document.getElementById("navToggle");
  var nav = document.getElementById("siteNav");
  if (toggle && nav) {
    toggle.addEventListener("click", function () {
      var open = nav.classList.toggle("is-open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
      toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    });
    nav.addEventListener("click", function (e) {
      if (e.target.tagName === "A") {
        nav.classList.remove("is-open");
        toggle.setAttribute("aria-expanded", "false");
      }
    });
  }

  /* --------------------------------------- Deep-link a home into the form */
  var homeSelect = document.getElementById("f-home");
  document.querySelectorAll("[data-home]").forEach(function (el) {
    el.addEventListener("click", function () {
      if (!homeSelect) return;
      var map = { chalet: "The Chalet", modern: "The Modern", both: "Both homes" };
      var val = map[el.getAttribute("data-home")];
      if (val) homeSelect.value = val;
    });
  });

  /* --------------------------------------------- Booking form submission */
  var form = document.getElementById("bookForm");
  var status = document.getElementById("formStatus");
  var submitBtn = document.getElementById("bookSubmit");
  var checkin = document.getElementById("f-checkin");
  var checkout = document.getElementById("f-checkout");

  // Prevent past dates; keep check-out after check-in with a 2-night minimum.
  var today = new Date().toISOString().split("T")[0];
  if (checkin) checkin.min = today;
  if (checkout) checkout.min = today;
  if (checkin && checkout) {
    checkin.addEventListener("change", function () {
      if (!checkin.value) return;
      var min = new Date(checkin.value);
      min.setDate(min.getDate() + 2);
      checkout.min = min.toISOString().split("T")[0];
      if (checkout.value && checkout.value < checkout.min) checkout.value = "";
    });
  }

  if (form) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (!form.checkValidity()) { form.reportValidity(); return; }
      submitBtn.disabled = true;
      submitBtn.textContent = "SENDING…";
      status.textContent = "";

      fetch(form.action, {
        method: "POST",
        body: new FormData(form),
        headers: { Accept: "application/json" }
      })
        .then(function (res) {
          if (res.ok) {
            form.reset();
            status.style.color = "var(--pine)";
            status.textContent = "Your request is in — Jonathan or Anna will reach out within a few hours with booking & payment details. Your dates are on hold.";
            submitBtn.textContent = "REQUEST SENT ✓";
          } else {
            throw new Error("Bad response");
          }
        })
        .catch(function () {
          status.style.color = "#b3261e";
          status.textContent = "Something went wrong sending your request. Please email brycegetaways@gmail.com and we'll sort it out right away.";
          submitBtn.disabled = false;
          submitBtn.textContent = "REQUEST THESE DATES";
        });
    });
  }

  /* --------------------------------- Graceful fallback for missing photos */
  function markMissing(img) {
    img.classList.add("img-missing");
    img.alt = "";
    // A transparent 1x1 GIF keeps the element sized but paints nothing, so no
    // broken-image icon or leftover alt text shows over the placeholder tile.
    img.src = "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==";
  }
  document.querySelectorAll("img[data-label]").forEach(function (img) {
    img.addEventListener("error", function () { markMissing(img); });
    if (img.complete && img.naturalWidth === 0) markMissing(img);
  });

  /* ------------------------------------------------ Rotating verbatims */
  // Any <section class="pull-quote" data-quote-rotator> with a JSON list of
  // {quote, who} in a .pull-quote__quotes script tag cycles through them,
  // fading between quotes. Honors prefers-reduced-motion (shows the first).
  var reduceMotion = window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  document.querySelectorAll("[data-quote-rotator]").forEach(function (section) {
    var dataEl = section.querySelector(".pull-quote__quotes");
    var quoteEl = section.querySelector("blockquote");
    var citeEl = section.querySelector("cite");
    if (!dataEl || !quoteEl || !citeEl) return;
    var quotes;
    try { quotes = JSON.parse(dataEl.textContent); } catch (e) { return; }
    if (!Array.isArray(quotes) || quotes.length < 2 || reduceMotion) return;
    var i = 0;
    setInterval(function () {
      i = (i + 1) % quotes.length;
      section.classList.add("is-fading");
      setTimeout(function () {
        quoteEl.textContent = '"' + quotes[i].quote + '"';
        citeEl.textContent = quotes[i].who;
        section.classList.remove("is-fading");
      }, 450); // match the CSS opacity transition
    }, 7000);
  });
})();

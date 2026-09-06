/* Bryce Mountain Getaways — trail & water card filter.
   Shared by hiking.html and fishing.html. Cards carry data-category (difficulty
   on the trails, quarry on the waters) and data-drive in minutes; the filter
   bar's buttons name a category, or "close" / "all". Progressive: with JS off
   every card is already in the DOM and visible, and the bar simply does nothing. */
(function () {
  "use strict";

  var bar = document.querySelector("[data-trail-filter]");
  var list = document.getElementById("trails");
  if (!bar || !list) return;

  var cards = Array.prototype.slice.call(list.querySelectorAll(".trail"));
  var buttons = Array.prototype.slice.call(bar.querySelectorAll("button[data-filter]"));
  var countEl = bar.querySelector("[data-trail-count]");
  var CLOSE_MINUTES = 15; // what "under 15 min away" means, in one place

  function matches(card, filter) {
    if (filter === "all") return true;
    if (filter === "close") return parseInt(card.getAttribute("data-drive"), 10) <= CLOSE_MINUTES;
    return card.getAttribute("data-category") === filter;
  }

  function apply(filter) {
    var shown = 0;
    cards.forEach(function (card) {
      var on = matches(card, filter);
      card.hidden = !on;
      if (on) shown++;
    });
    buttons.forEach(function (b) {
      b.classList.toggle("is-active", b.getAttribute("data-filter") === filter);
    });
    if (countEl) {
      countEl.textContent = shown === cards.length
        ? ""
        : shown + " of " + cards.length + " shown";
    }
  }

  buttons.forEach(function (b) {
    b.addEventListener("click", function () { apply(b.getAttribute("data-filter")); });
  });
})();

/* Bryce Mountain Getaways — the Guests tab on /manage.html.

   Three jobs, all behind the same Supabase owner login the Bookings tab uses:
     1. A guest list — every discount signup lands here automatically (database
        trigger, see supabase/guests.sql); past guests can be imported from the
        bookings ledger, and anyone can be added or edited by hand with their
        phone, stay dates, tags and notes.
     2. A composer — write one message and send it to a single guest or a
        filtered / hand-picked group. Each recipient gets their own e-mail
        (personalised with {{name}}) through EmailJS, with an unsubscribe link.
     3. A message log — every send, successful or failed, is kept in
        guest_messages so there is a record of what went to whom.

   Guests who unsubscribe are never offered as recipients. */
(function () {
  "use strict";

  var HOMES = { chalet: "The Chalet", modern: "The Cabin" };
  var SEND_GAP_MS = 450; // gentle on EmailJS rate limits

  var guests = [];
  var selected = {};      // guest id -> true
  var editing = null;     // guest object being edited, or {} for a new one
  var el = {};

  /* ------------------------------------------------------------ helpers */
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }
  function api() { return window.BMGBookings; }
  function table(t) { return "/rest/v1/" + t; }
  function call(path, method, body, prefer) {
    var h = {};
    if (prefer) h.Prefer = prefer;
    return api().rest(path, { method: method, token: api().token(), headers: h, body: body ? JSON.stringify(body) : undefined });
  }
  function status(msg, isErr) {
    el.status.textContent = msg || "";
    el.status.className = "mgr-status " + (isErr ? "is-err" : "is-ok");
  }
  function fmt(d) {
    if (!d) return "—";
    var M = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    var p = String(d).slice(0, 10).split("-");
    return M[+p[1] - 1] + " " + (+p[2]) + ", " + p[0];
  }
  function validEmail(s) { return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s || ""); }
  function firstName(g) { return String(g.name || "").trim().split(/\s+/)[0] || "there"; }
  function staysOf(g) { return Array.isArray(g.stays) ? g.stays : []; }
  function lastStay(g) {
    var s = staysOf(g).map(function (x) { return x.check_out || x.check_in || ""; }).sort();
    return s.length ? s[s.length - 1] : "";
  }
  function hasStayed(g, home) {
    return staysOf(g).some(function (s) { return !home || s.home === home; });
  }

  /* ---------------------------------------------------------- filtering */
  function visible() {
    var q = el.search.value.trim().toLowerCase();
    var f = el.filter.value;
    return guests.filter(function (g) {
      if (q && (g.name || "").toLowerCase().indexOf(q) === -1 && (g.email || "").toLowerCase().indexOf(q) === -1 &&
          (g.tags || []).join(" ").toLowerCase().indexOf(q) === -1) return false;
      if (f === "unsub") return !g.subscribed;
      if (!g.subscribed) return false;
      if (f === "all") return true;
      if (f === "never") return !hasStayed(g);
      if (f === "stayed") return hasStayed(g);
      if (f === "chalet" || f === "modern") return hasStayed(g, f);
      if (f.indexOf("tag:") === 0) return (g.tags || []).indexOf(f.slice(4)) !== -1;
      if (f.indexOf("year:") === 0) return staysOf(g).some(function (s) { return String(s.check_in || "").slice(0, 4) === f.slice(5); });
      return true;
    });
  }

  function refreshFilterOptions() {
    var cur = el.filter.value;
    var tags = {}, years = {};
    guests.forEach(function (g) {
      (g.tags || []).forEach(function (t) { tags[t] = 1; });
      staysOf(g).forEach(function (s) { if (s.check_in) years[String(s.check_in).slice(0, 4)] = 1; });
    });
    var html = '<option value="all">All subscribed</option>' +
      '<option value="never">Signed up, never stayed</option>' +
      '<option value="stayed">Past guests (have stayed)</option>' +
      '<option value="chalet">Stayed at The Chalet</option>' +
      '<option value="modern">Stayed at The Cabin</option>';
    Object.keys(years).sort().reverse().forEach(function (y) { html += '<option value="year:' + y + '">Stayed in ' + y + "</option>"; });
    Object.keys(tags).sort().forEach(function (t) { html += '<option value="tag:' + esc(t) + '">Tag: ' + esc(t) + "</option>"; });
    html += '<option value="unsub">Unsubscribed</option>';
    el.filter.innerHTML = html;
    el.filter.value = cur;
    if (el.filter.value !== cur) el.filter.value = "all";
  }

  /* ---------------------------------------------------------- rendering */
  function render() {
    refreshFilterOptions();
    var list = visible();
    var subscribed = guests.filter(function (g) { return g.subscribed; }).length;
    el.summary.textContent = guests.length + " guests · " + subscribed + " subscribed";

    if (!list.length) {
      el.list.innerHTML = '<p class="mgr-sub">' + (guests.length ? "No guests match this filter." :
        "No guests yet. Discount signups appear here automatically; you can also add a guest or import past bookings.") + "</p>";
    } else {
      el.list.innerHTML = list.map(row).join("");
      Array.prototype.forEach.call(el.list.querySelectorAll(".gst-card"), function (card) {
        var g = byId(card.getAttribute("data-id"));
        card.querySelector("input[type=checkbox]").addEventListener("change", function (e) {
          if (e.target.checked) selected[g.id] = true; else delete selected[g.id];
          updateCompose();
        });
        card.querySelector("[data-act=edit]").addEventListener("click", function () { openEditor(g); });
        card.querySelector("[data-act=msg]").addEventListener("click", function () { selected = {}; selected[g.id] = true; render(); focusCompose(); });
      });
    }
    updateCompose();
  }

  function row(g) {
    var stays = staysOf(g).slice().sort(function (a, b) { return String(b.check_in).localeCompare(String(a.check_in)); })
      .map(function (s) { return esc(HOMES[s.home] || s.home || "Stay") + " " + fmt(s.check_in) + (s.check_out ? " → " + fmt(s.check_out) : ""); });
    return '<div class="bkg-card gst-card" data-id="' + esc(g.id) + '">' +
      '<div class="bkg-card__top">' +
        '<label class="gst-pick"><input type="checkbox"' + (selected[g.id] ? " checked" : "") + (g.subscribed ? "" : " disabled") + '>' +
          '<span><span class="bkg-guest">' + esc(g.name || "(no name)") + '</span>' +
          '<span class="bkg-meta">' + esc(g.email) + (g.phone ? " · " + esc(g.phone) : "") + "</span></span></label>" +
        '<span class="bkg-badge">' + (g.subscribed ? esc(g.source) : "unsubscribed") + "</span>" +
      "</div>" +
      (stays.length ? '<div class="bkg-meta">Stays: ' + stays.join(" · ") + "</div>" : '<div class="bkg-meta">No stays recorded</div>') +
      ((g.tags || []).length ? '<div class="bkg-meta">Tags: ' + (g.tags || []).map(esc).join(", ") + "</div>" : "") +
      (g.notes ? '<div class="bkg-meta">' + esc(g.notes) + "</div>" : "") +
      '<div class="bkg-actions">' +
        (g.subscribed ? '<button type="button" class="mgr-btn mgr-btn--ghost" data-act="msg">Message</button>' : "") +
        '<button type="button" class="mgr-btn mgr-btn--ghost" data-act="edit">Edit</button>' +
      "</div></div>";
  }
  function byId(id) {
    for (var i = 0; i < guests.length; i++) if (String(guests[i].id) === String(id)) return guests[i];
    return null;
  }

  /* ------------------------------------------------------------- editor */
  function stayRow(s) {
    s = s || {};
    return '<div class="gst-stay">' +
      '<select class="gst-home">' + Object.keys(HOMES).map(function (k) {
        return '<option value="' + k + '"' + (s.home === k ? " selected" : "") + ">" + HOMES[k] + "</option>";
      }).join("") + "</select>" +
      '<input type="date" class="gst-in" value="' + esc(s.check_in || "") + '">' +
      '<input type="date" class="gst-out" value="' + esc(s.check_out || "") + '">' +
      '<button type="button" class="mgr-btn mgr-btn--ghost gst-rm">Remove</button></div>';
  }

  function openEditor(g) {
    editing = g || {};
    var e = editing;
    el.editor.hidden = false;
    el.editor.innerHTML =
      '<h3 class="bkg-h">' + (e.id ? "Edit guest" : "Add guest") + "</h3>" +
      '<div class="mgr-bar">' +
        field("Name", '<input id="gst-name" type="text" value="' + esc(e.name || "") + '">') +
        field("Email", '<input id="gst-email" class="wide" type="email" value="' + esc(e.email || "") + '">') +
        field("Phone", '<input id="gst-phone" type="tel" value="' + esc(e.phone || "") + '">') +
        field("Tags (comma-separated)", '<input id="gst-tags" type="text" value="' + esc((e.tags || []).join(", ")) + '">') +
      "</div>" +
      '<h3 class="bkg-h">Stays</h3><div id="gst-stays">' + staysOf(e).map(stayRow).join("") + "</div>" +
      '<button type="button" class="mgr-btn mgr-btn--ghost" id="gst-addstay">+ Add stay</button>' +
      '<div class="mgr-field" style="margin-top:14px"><label for="gst-notes">Notes</label>' +
        '<textarea id="gst-notes" rows="2" style="width:100%">' + esc(e.notes || "") + "</textarea></div>" +
      (e.id ? '<label class="gst-sub"><input type="checkbox" id="gst-subscribed"' + (e.subscribed ? " checked" : "") +
        "> Subscribed to offers &amp; availability e-mails</label>" : "") +
      '<div class="bkg-actions"><button type="button" class="mgr-btn" id="gst-save">Save guest</button>' +
        '<button type="button" class="mgr-btn mgr-btn--ghost" id="gst-cancel">Cancel</button>' +
        (e.id ? '<button type="button" class="mgr-btn mgr-btn--ghost" id="gst-delete">Delete</button>' : "") + "</div>";

    var staysEl = document.getElementById("gst-stays");
    function bindRm() {
      Array.prototype.forEach.call(staysEl.querySelectorAll(".gst-rm"), function (b) {
        b.onclick = function () { b.parentNode.parentNode.removeChild(b.parentNode); };
      });
    }
    bindRm();
    document.getElementById("gst-addstay").onclick = function () {
      staysEl.insertAdjacentHTML("beforeend", stayRow({}));
      bindRm();
    };
    document.getElementById("gst-cancel").onclick = closeEditor;
    document.getElementById("gst-save").onclick = saveEditor;
    var del = document.getElementById("gst-delete");
    if (del) del.onclick = deleteGuest;
    el.editor.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }
  function field(label, input) { return '<div class="mgr-field"><label>' + label + "</label>" + input + "</div>"; }
  function closeEditor() { editing = null; el.editor.hidden = true; el.editor.innerHTML = ""; }

  function saveEditor() {
    var email = document.getElementById("gst-email").value.trim().toLowerCase();
    if (!validEmail(email)) { status("Enter a valid e-mail address.", true); return; }
    var stays = [];
    Array.prototype.forEach.call(document.querySelectorAll("#gst-stays .gst-stay"), function (r) {
      var inn = r.querySelector(".gst-in").value, out = r.querySelector(".gst-out").value;
      if (inn) stays.push({ home: r.querySelector(".gst-home").value, check_in: inn, check_out: out || null });
    });
    var tags = document.getElementById("gst-tags").value.split(",").map(function (t) { return t.trim(); }).filter(Boolean);
    var rec = {
      name: document.getElementById("gst-name").value.trim() || null, email: email,
      phone: document.getElementById("gst-phone").value.trim() || null,
      tags: tags, stays: stays, notes: document.getElementById("gst-notes").value.trim() || null
    };
    var sub = document.getElementById("gst-subscribed");
    if (editing.id && sub && sub.checked !== editing.subscribed) {
      rec.subscribed = sub.checked;
      rec.unsubscribed_at = sub.checked ? null : new Date().toISOString();
    }
    var req = editing.id
      ? call(table("guests") + "?id=eq." + encodeURIComponent(editing.id), "PATCH", rec, "return=minimal")
      : call(table("guests"), "POST", rec, "return=minimal");
    req.then(function () { closeEditor(); status("Saved.", false); return load(); })
      .catch(function (e) { status(/duplicate|unique/i.test(e.message) ? "That e-mail is already on the list." : "Couldn't save: " + e.message, true); });
  }

  function deleteGuest() {
    if (!window.confirm("Delete " + (editing.name || editing.email) + " from the guest list? Their message history is kept.")) return;
    var id = editing.id;
    call(table("guests") + "?id=eq." + encodeURIComponent(id), "DELETE")
      .then(function () { closeEditor(); delete selected[id]; status("Deleted.", false); return load(); })
      .catch(function (e) { status("Couldn't delete: " + e.message, true); });
  }

  /* ------------------------------------------------ import from bookings */
  function importBookings() {
    status("Importing from bookings…", false);
    api().list().then(function (bookings) {
      var byEmail = {};
      guests.forEach(function (g) { byEmail[g.email.toLowerCase()] = g; });
      var jobs = [], added = 0, updated = 0;
      var grouped = {};
      bookings.filter(function (b) { return b.status !== "cancelled" && validEmail(b.guest_email); }).forEach(function (b) {
        var k = b.guest_email.trim().toLowerCase();
        (grouped[k] = grouped[k] || []).push(b);
      });
      Object.keys(grouped).forEach(function (email) {
        var bs = grouped[email], g = byEmail[email];
        var stays = g ? staysOf(g).slice() : [];
        var changed = false;
        bs.forEach(function (b) {
          var dup = stays.some(function (s) { return s.home === b.home_key && s.check_in === b.check_in; });
          if (!dup) { stays.push({ home: b.home_key, check_in: b.check_in, check_out: b.check_out }); changed = true; }
        });
        if (g) {
          var patch = {};
          if (changed) patch.stays = stays;
          if (!g.phone && bs[0].guest_phone) patch.phone = bs[0].guest_phone;
          if (!g.name && bs[0].guest_name) patch.name = bs[0].guest_name;
          if (Object.keys(patch).length) { updated++; jobs.push(call(table("guests") + "?id=eq." + g.id, "PATCH", patch, "return=minimal")); }
        } else {
          added++;
          jobs.push(call(table("guests"), "POST", {
            email: email, name: bs[0].guest_name, phone: bs[0].guest_phone || null, source: "booking", stays: stays
          }, "return=minimal"));
        }
      });
      return Promise.all(jobs).then(function () { status("Imported: " + added + " new guest" + (added === 1 ? "" : "s") + ", " + updated + " updated.", false); return load(); });
    }).catch(function (e) { status("Couldn't import: " + e.message, true); });
  }

  /* ----------------------------------------------------------- composing */
  function recipients() {
    return guests.filter(function (g) { return g.subscribed && selected[g.id]; });
  }
  function updateCompose() {
    var n = recipients().length;
    el.to.textContent = n ? n + " recipient" + (n === 1 ? "" : "s") + " selected" : "No recipients selected — tick guests above, or use “Select all shown”.";
    el.send.disabled = !n;
    el.send.textContent = n ? "Send to " + n : "Send";
  }
  function focusCompose() { el.compose.scrollIntoView({ behavior: "smooth", block: "start" }); el.subject.focus(); }

  function merge(text, g) {
    return text.replace(/\{\{\s*first_name\s*\}\}/g, firstName(g)).replace(/\{\{\s*name\s*\}\}/g, g.name || "there");
  }
  function unsubUrl(g) {
    var base = window.location.origin + window.location.pathname.replace(/[^\/]*$/, "");
    return base + "unsubscribe.html?t=" + encodeURIComponent(g.unsub_token);
  }
  function build(g, subject, body) {
    var text = merge(body, g);
    var footer = "\n\n—\nBryce Mountain Getaways\nYou’re receiving this because you signed up or stayed with us. Unsubscribe: " + (g.unsub_token ? unsubUrl(g) : "(link added when sent)");
    var plain = text + footer;
    var html = esc(text).replace(/\n/g, "<br>") +
      '<br><br><span style="color:#888;font-size:12px">Bryce Mountain Getaways<br>You’re receiving this because you signed up or stayed with us. ' +
      (g.unsub_token ? '<a href="' + esc(unsubUrl(g)) + '">Unsubscribe</a>' : "Unsubscribe link added when sent") + "</span>";
    return { subject: merge(subject, g), plain: plain, html: html };
  }
  function emailParams(g, m) {
    return { to_email: g.email, guest_name: g.name || "there", subject: m.subject, message: m.plain, message_html: m.html, reply_to: "brycegetaways@gmail.com" };
  }
  function emailReady() {
    var e = (window.BMGConfig && window.BMGConfig.emailjs) || {};
    return window.emailjs && e.publicKey && e.serviceId && e.broadcastTemplateId ? e : null;
  }
  function sendOne(e, g, m) {
    return window.emailjs.send(e.serviceId, e.broadcastTemplateId, emailParams(g, m), { publicKey: e.publicKey });
  }

  function validateCompose() {
    var s = el.subject.value.trim(), b = el.body.value.trim();
    if (!s || !b) { status("Write a subject and a message first.", true); return null; }
    if (!emailReady()) { status("Sending isn't set up yet — add emailjs.broadcastTemplateId to site-config.js (see README → Guest list & messages).", true); return null; }
    return { subject: s, body: b };
  }

  function preview() {
    var c = el.subject.value.trim() || el.body.value.trim() ? { subject: el.subject.value, body: el.body.value } : null;
    if (!c) { status("Write something to preview.", true); return; }
    var g = recipients()[0] || { name: "Alex Sample", email: "alex@example.com" };
    var m = build(g, c.subject, c.body);
    el.preview.hidden = false;
    el.preview.innerHTML = '<div class="bkg-meta">Preview for ' + esc(g.name || g.email) + "</div><strong>" + esc(m.subject) + "</strong><div style=\"margin-top:8px\">" + m.html + "</div>";
  }

  function sendTest() {
    var c = validateCompose(); if (!c) return;
    var to = el.testTo.value.trim();
    if (!validEmail(to)) { status("Enter the e-mail address to send the test to.", true); return; }
    var g = recipients()[0] || { name: "Alex Sample" };
    g = { name: g.name, email: to, unsub_token: g.unsub_token };
    var m = build(g, "[TEST] " + c.subject, c.body);
    status("Sending test…", false);
    sendOne(emailReady(), g, m).then(function () { status("Test sent to " + to + ".", false); })
      .catch(function (e) { status("Test failed: " + ((e && (e.text || e.message)) || e), true); });
  }

  function sendAll() {
    var c = validateCompose(); if (!c) return;
    var list = recipients();
    if (!list.length) return;
    if (!window.confirm("Send “" + c.subject + "” to " + list.length + " guest" + (list.length === 1 ? "" : "s") + "? This can't be undone.")) return;
    var e = emailReady(), batch = new Date().toISOString(), ok = 0, bad = 0, i = 0;
    el.send.disabled = true;

    function next() {
      if (i >= list.length) {
        status("Done — " + ok + " sent" + (bad ? ", " + bad + " failed (see history)" : "") + ".", !!bad && !ok);
        selected = {}; el.send.disabled = false;
        return loadHistory().then(render);
      }
      var g = list[i++], m = build(g, c.subject, c.body);
      status("Sending " + i + " of " + list.length + "…", false);
      return sendOne(e, g, m).then(function () { ok++; return "sent"; })
        .catch(function (err) { bad++; return (err && (err.text || err.message)) || "failed"; })
        .then(function (res) {
          var failed = res !== "sent";
          return call(table("guest_messages"), "POST", {
            guest_id: g.id, email: g.email, subject: m.subject, body: m.plain,
            status: failed ? "failed" : "sent", error: failed ? String(res) : null, batch: batch
          }, "return=minimal").catch(function () {});
        })
        .then(function () { return new Promise(function (r) { setTimeout(r, SEND_GAP_MS); }); })
        .then(next);
    }
    next();
  }

  /* ------------------------------------------------------------- history */
  var history = [];
  function loadHistory() {
    return call(table("guest_messages") + "?select=id,sent_at,email,subject,status,error,batch&order=sent_at.desc&limit=100", "GET")
      .then(function (rows) { history = rows || []; renderHistory(); })
      .catch(function () {});
  }
  function renderHistory() {
    if (!history.length) { el.history.innerHTML = '<p class="mgr-sub">No messages sent yet.</p>'; return; }
    el.history.innerHTML = history.map(function (m) {
      return '<div class="bkg-meta gst-hist">' + esc(fmt(m.sent_at) + " " + String(m.sent_at).slice(11, 16)) + " · " + esc(m.email) + " · " + esc(m.subject) +
        (m.status === "failed" ? ' · <span style="color:#b3261e">failed: ' + esc(m.error || "") + "</span>" : "") + "</div>";
    }).join("");
  }

  /* ---------------------------------------------------------------- load */
  function load() {
    status("Loading guests…", false);
    return call(table("guests") + "?select=*&order=created_at.desc", "GET")
      .then(function (rows) { guests = rows || []; status("", false); render(); return loadHistory(); })
      .catch(function (e) {
        status(/relation|does not exist|schema cache/i.test(e.message)
          ? "The guests table isn't set up yet — run supabase/guests.sql in Supabase (see README)." : "Couldn't load guests: " + e.message, true);
      });
  }

  function sync() {
    var on = !!(api() && api().session());
    el.login.hidden = on; el.panel.hidden = !on;
    if (on) load(); else { guests = []; selected = {}; }
  }

  /* ---------------------------------------------------------------- init */
  function init() {
    el.card = document.getElementById("gst");
    if (!el.card) return;
    ["login", "panel", "status", "summary", "list", "editor", "search", "filter", "compose", "to", "subject", "body", "send", "preview", "testTo", "history"]
      .forEach(function (k) { el[k] = document.getElementById("gst-" + k); });

    if (!api() || !api().configured()) { el.login.innerHTML = '<p class="mgr-sub">Supabase isn\'t configured yet.</p>'; return; }

    el.search.addEventListener("input", render);
    el.filter.addEventListener("change", render);
    document.getElementById("gst-add").addEventListener("click", function () { openEditor(null); });
    document.getElementById("gst-import").addEventListener("click", importBookings);
    document.getElementById("gst-selall").addEventListener("click", function () { visible().forEach(function (g) { selected[g.id] = true; }); render(); });
    document.getElementById("gst-selnone").addEventListener("click", function () { selected = {}; render(); });
    document.getElementById("gst-previewbtn").addEventListener("click", preview);
    document.getElementById("gst-test").addEventListener("click", sendTest);
    el.send.addEventListener("click", sendAll);
    document.addEventListener("bmg:auth", sync);
    sync();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();

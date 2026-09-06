/* Bryce Mountain Getaways — site configuration.

   EmailJS sends the booking confirmation to BOTH the guest and the owners.
   These three values are safe to expose in the browser — that is how EmailJS
   is designed to work (the public key is not a secret). Paste them here after
   creating a free EmailJS account (https://www.emailjs.com):

     publicKey  — EmailJS dashboard → Account → General → Public Key
     serviceId  — EmailJS dashboard → Email Services → your service → Service ID.
                  It has to match the dashboard exactly or every send fails.
                  Note this is per-*service*: rebuilding the Gmail service (as on
                  2026-09-06, when the old OAuth grant could not be revived)
                  issues a brand-new ID, and the value below has to follow it.
     templateId — EmailJS dashboard → Email Templates → your template → Template ID

   Until all three are filled in, the booking form still works — it falls back
   to emailing the owners only (via Formspree). */
window.BMGConfig = {
  emailjs: {
    publicKey: "Olkr11Rp94JH-M-Nm",
    serviceId: "service_mvhwiu6",
    templateId: "template_je53hdm",        // booking confirmation + signed agreement (guest)
    ownerTemplateId: "",                    // booking notification addressed to the owners; blank reuses templateId
    contactTemplateId: "",                  // Contact-Us form (owner + auto-reply)
    discountTemplateId: "template_guuhec9"  // First-booking $50 signup auto-reply (guest)
  },

  /* Bookings ledger (Supabase) — every signed rental agreement is filed here and
     worked from /manage.html. It lives in the same Supabase project as the
     discount signups, so the URL and key below are reused from `discount`.

     The publishable (anon) key can only INSERT into this table: row-level
     security gives anonymous callers no read at all, so guest names, addresses
     and phone numbers can't be pulled out of the public site. Reading and
     updating need an owner login through Supabase Auth. See the README
     ("Bookings ledger") for the exact table and policies. */
  bookings: {
    table: "bookings"
  },

  /* First-booking $50 discount.
     The signup form (popup + homepage banner) captures a name + e-mail, e-mails
     the guest a "book here" auto-reply, and stores the address so the owners can
     see who has claimed the $50 and who has already booked with it. Supabase is
     the store; the publishable (anon) key below is safe in the browser as long as
     Row Level Security is enabled on the table (see README → "First-booking
     discount"). Never put the Supabase *secret* key here — this file is public.

     Everything degrades gracefully: with no Supabase configured the signup still
     works — the guest gets their code, the owners get an e-mail — it just isn't
     persisted for cross-device reuse-checking. Set `amount: 0` to switch the
     whole promotion off site-wide. */
  discount: {
    amount: 50,                             // dollars off the first booking; 0 = promo off
    label: "First-booking discount",
    supabaseUrl: "https://lgjnssklvdblzohibzpw.supabase.co",       // Settings → API → Project URL
    supabaseAnonKey: "sb_publishable_fTsNp10j8FnIYbXc1CrN_Q_Myem4vAR", // Settings → API → publishable key
    table: "discount_signups"
  }
};

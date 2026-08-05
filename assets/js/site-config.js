/* Bryce Mountain Getaways — site configuration.

   EmailJS sends the booking confirmation to BOTH the guest and the owners.
   These three values are safe to expose in the browser — that is how EmailJS
   is designed to work (the public key is not a secret). Paste them here after
   creating a free EmailJS account (https://www.emailjs.com):

     publicKey  — EmailJS dashboard → Account → General → Public Key
     serviceId  — EmailJS dashboard → Email Services → your service → Service ID
     templateId — EmailJS dashboard → Email Templates → your template → Template ID

   Until all three are filled in, the booking form still works — it falls back
   to emailing the owners only (via Formspree). */
window.BMGConfig = {
  emailjs: {
    publicKey: "Olkr11Rp94JH-M-Nm",
    serviceId: "brycegetaways@gmail.com",
    templateId: "template_je53hdm",        // booking confirmation (guest + owner)
    contactTemplateId: "",                  // Contact-Us form (owner + auto-reply)
    discountTemplateId: ""                  // First-booking $50 signup auto-reply (guest)
  },

  /* First-booking $50 discount.
     The signup form (popup + homepage banner) captures a name + e-mail, e-mails
     the guest a "book here" auto-reply, and stores the address so the owners can
     see who has claimed the $50 and who has already booked with it. Supabase is
     the store; the anon key below is safe in the browser as long as Row Level
     Security is enabled on the table (see README → "First-booking discount").

     Everything degrades gracefully: with no Supabase configured the signup still
     works — the guest gets their code, the owners get an e-mail — it just isn't
     persisted for cross-device reuse-checking. Set `amount: 0` to switch the
     whole promotion off site-wide. */
  discount: {
    amount: 50,                             // dollars off the first booking; 0 = promo off
    label: "First-booking discount",
    supabaseUrl: "",                        // Supabase → Project Settings → API → Project URL
    supabaseAnonKey: "",                    // Supabase → Project Settings → API → anon public key
    table: "discount_signups"
  }
};

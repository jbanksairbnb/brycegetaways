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
    templateId: "template_je53hdm"
  }
};

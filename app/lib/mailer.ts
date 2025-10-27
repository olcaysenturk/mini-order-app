import nodemailer from "nodemailer";

export const mailer = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT ?? 465),
  secure: String(process.env.SMTP_SECURE ?? "true") === "true",
  auth: {
    user: process.env.SMTP_USER!,
    pass: process.env.SMTP_PASS!,
  },
});

export function resetEmailHtml(link: string) {
  return `
  <div style="font-family:Inter,system-ui,sans-serif;line-height:1.6">
    <h2>Parolanı Sıfırla</h2>
    <p>Bu bağlantıya 60 dakika içinde tıkla ve yeni parolanı belirle:</p>
    <p><a href="${link}" style="display:inline-block;padding:10px 14px;border-radius:8px;background:#4f46e5;color:#fff;text-decoration:none">Parolayı Sıfırla</a></p>
    <p>Eğer talep etmediysen bu e-postayı yok sayabilirsin.</p>
  </div>`;
}

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

// Varsayılan From
function getFrom() {
  const name = process.env.SMTP_FROM_NAME || "Perdexa";
  const addr = process.env.SMTP_FROM || process.env.SMTP_USER!;
  return `${name} <${addr}>`;
}

export async function sendMail(opts: {
  to: string;
  subject: string;
  html: string;
  text?: string;
  from?: string;
  headers?: Record<string, string>;
}) {
  const info = await mailer.sendMail({
    from: opts.from ?? getFrom(),
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
    text: opts.text,
    headers: opts.headers,
  });
  return info;
}



/** ========== WELCOME EMAIL (HTML) ========== */
export function welcomeEmailHtml(params: {
  userName?: string | null;
  dashboardUrl: string;
  helpUrl?: string;
}) {
  const name = params.userName?.trim() || "Hoş geldin!";
  const help = params.helpUrl || "https://perdexa.com/help";
  const btn = params.dashboardUrl;

  return /* html */ `
  <div style="font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;background:#f6f7f9;padding:32px">
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="max-width:640px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #eceef2">
      <tr>
        <td style="padding:20px 24px;border-bottom:1px solid #eceef2">
          <table width="100%">
            <tr>
              <td style="font-size:14px;color:#111827;font-weight:700">
                Perdexa
              </td>
              <td align="right" style="font-size:12px;color:#6b7280">Hoş Geldin</td>
            </tr>
          </table>
        </td>
      </tr>

      <tr>
        <td style="padding:28px 24px 4px 24px">
          <h1 style="margin:0;font-size:20px;line-height:28px;color:#111827">${name}</h1>
          <p style="margin:8px 0 0 0;font-size:14px;line-height:22px;color:#374151">
            Perdexa’ya katıldığın için teşekkürler. Perde siparişlerini kategori & varyant bazında yönet,
            m² ve pile sıklığına göre otomatik hesapla, A4 çıktılar al — hepsi tek yerden.
          </p>
        </td>
      </tr>

      <tr>
        <td style="padding:16px 24px 8px 24px">
          <a href="${btn}"
             style="display:inline-block;background:#4f46e5;color:#fff;text-decoration:none;
                    padding:10px 14px;border-radius:10px;font-weight:600;font-size:14px">
            Panoya Git
          </a>
          <div style="font-size:12px;color:#6b7280;margin-top:10px">
            İlk adım: Şirket profilini tamamla ve “Merkez” şubeni doğrula.
          </div>
        </td>
      </tr>

      <tr>
        <td style="padding:8px 24px 24px 24px">
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
                 style="background:#f9fafb;border:1px dashed #e5e7eb;border-radius:10px">
            <tr>
              <td style="padding:14px 16px;font-size:13px;color:#374151">
                <strong>Destek gerekirse:</strong>
                <a href="${help}" style="color:#4f46e5;text-decoration:none">Yardım Merkezi</a> veya bu e-postaya yanıt ver.
              </td>
            </tr>
          </table>
        </td>
      </tr>

      <tr>
        <td style="padding:14px 24px;border-top:1px solid #eceef2;font-size:12px;color:#6b7280">
          © ${new Date().getFullYear()} Perdexa. Tüm hakları saklıdır.
        </td>
      </tr>
    </table>
  </div>
  `;
}

/** İsteğe bağlı düz metin versiyon (Gmail preview & plain clients) */
export function welcomeEmailText(params: {
  userName?: string | null;
  dashboardUrl: string;
  helpUrl?: string;
}) {
  const name = params.userName?.trim() || "Hoş geldin!";
  const help = params.helpUrl || "https://perdexa.com/help";
  return `${name}
Perdexa’ya katıldığın için teşekkürler.

Panoya Git: ${params.dashboardUrl}
Yardım Merkezi: ${help}

© ${new Date().getFullYear()} Perdexa`;
}

// Senin hazır şablonun (ister bu, ister welcome kullan)
export function resetEmailHtml(link: string) {
  return `
  <div style="font-family:Inter,system-ui,sans-serif;line-height:1.6">
    <h2>Parolanı Sıfırla</h2>
    <p>Bu bağlantıya 60 dakika içinde tıkla ve yeni parolanı belirle:</p>
    <p><a href="${link}" style="display:inline-block;padding:10px 14px;border-radius:8px;background:#4f46e5;color:#fff;text-decoration:none">Parolayı Sıfırla</a></p>
    <p>Eğer talep etmediysen bu e-postayı yok sayabilirsin.</p>
  </div>`;
}

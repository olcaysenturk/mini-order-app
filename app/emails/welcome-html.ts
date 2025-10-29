export function welcomeHtml(params: { appName?: string; appUrl?: string; userName?: string }) {
  const appName = params.appName || process.env.APP_NAME || 'Perdexa'
  const appUrl  = params.appUrl  || process.env.APP_URL  || 'https://example.com'
  const hiName  = params.userName ? `Merhaba ${params.userName},` : 'Merhaba,'
  return `
  <div style="background:#f6f7fb;padding:24px 0;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Ubuntu,Cantarell,Noto Sans;">
    <table width="560" cellpadding="0" cellspacing="0" align="center" style="background:#fff;border-radius:12px;overflow:hidden">
      <tr><td style="padding:24px 28px 8px">
        <h2 style="margin:0 0 8px 0;font-size:22px;color:#111827">${hiName}</h2>
        <p style="margin:0 0 12px 0;color:#555;font-size:14px;line-height:22px">
          ${appName}’a katıldığın için teşekkürler. Başlamak için paneli açabilir ve ilk siparişini oluşturabilirsin.
        </p>
        <p style="margin:8px 0 0">
          <a href="${appUrl}" style="display:inline-block;background:#111827;color:#fff;text-decoration:none;padding:10px 16px;border-radius:10px;font-size:14px;font-weight:600">
            Panele Git
          </a>
        </p>
      </td></tr>
      <tr><td style="border-top:1px solid #eee;padding:12px 28px 20px;">
        <p style="margin:0;color:#6b7280;font-size:12px">Yardıma ihtiyacın olursa bu e-postayı yanıtlayabilirsin.</p>
      </td></tr>
    </table>
    <p style="text-align:center;color:#9ca3af;font-size:12px;margin-top:12px">© ${new Date().getFullYear()} ${appName}</p>
  </div>`
}

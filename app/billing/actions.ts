// app/billing/actions.ts  (veya senin yolun)
// !!! DİKKAT: export edilen tek şey async fonksiyon(lar) olmalı
"use server";

import "server-only";

import { authOptions } from "@/app/api/auth/[...nextauth]/options";
import { getServerSession } from "next-auth";
import { parseMonthKey } from "@/app/lib/billing";
import { headers, cookies } from "next/headers";
import { prisma } from "@/app/lib/db";

async function requireUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Giriş gerekli");
  return session.user;
}

/** "Ödeme yapmak istiyorum" talebi — mail atar, redirect YOK */
export async function payForMonth(formData: FormData) {
  const user = await requireUser();

  const monthKey = String(formData.get("monthKey") ?? "").trim();
  if (!/^\d{4}-\d{2}$/.test(monthKey)) throw new Error("Geçersiz ay formatı");
  parseMonthKey(monthKey);

  const u = await prisma.user.findUnique({
    where: { id: user.id },
    select: { monthlyPriceCents: true, email: true },
  });
  const amountKurus = u?.monthlyPriceCents ?? 200000;
  const amountTry = (amountKurus / 100).toLocaleString("tr-TR", {
    style: "currency",
    currency: "TRY",
    minimumFractionDigits: 2,
  });

  const h = await headers();
  const ip =
    h.get("x-real-ip") ||
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    undefined;
  const ua = h.get("user-agent") || undefined;
  const referer = h.get("referer") || undefined;

  const to = (process.env.BILLING_ALERT_EMAIL || process.env.SMTP_USER)!.trim();
  const subject = `Ödeme talebi: ${u?.email ?? user.id} — ${monthKey} (${amountTry})`;

  const html = `
    <div style="font-family:Inter,system-ui,Segoe UI,Arial,sans-serif;line-height:1.6;color:#111">
      <h2 style="margin:0 0 8px">Kullanıcı ödeme yapmak istiyor</h2>
      <p style="margin:0 0 12px;color:#444">
        Panelden <strong>${monthKey}</strong> ayı için <strong>ödeme talebi</strong> gönderildi.
      </p>
      <table style="border-collapse:collapse;width:100%;max-width:560px">
        <tr><td style="padding:6px 0;color:#666">Kullanıcı</td><td style="padding:6px 0"><strong>${u?.email ?? "-"}</strong> <span style="color:#999">(${user.id})</span></td></tr>
        <tr><td style="padding:6px 0;color:#666">Ay</td><td style="padding:6px 0"><strong>${monthKey}</strong></td></tr>
        <tr><td style="padding:6px 0;color:#666">Talep Tutarı</td><td style="padding:6px 0"><strong>${amountTry}</strong></td></tr>
        <tr><td style="padding:6px 0;color:#666">Zaman</td><td style="padding:6px 0">${new Date().toLocaleString("tr-TR")}</td></tr>
        ${ip ? `<tr><td style="padding:6px 0;color:#666">IP</td><td style="padding:6px 0">${ip}</td></tr>` : ""}
        ${ua ? `<tr><td style="padding:6px 0;color:#666">User-Agent</td><td style="padding:6px 0">${ua}</td></tr>` : ""}
        ${referer ? `<tr><td style="padding:6px 0;color:#666">Referer</td><td style="padding:6px 0">${referer}</td></tr>` : ""}
      </table>
      <p style="margin-top:16px;color:#666">Not: Bu mesaj <em>talep</em> bildirimi içindir; sistemde ödeme kaydı oluşturulmadı.</p>
    </div>
  `;
  const text =
    `Kullanıcı ödeme yapmak istiyor\n` +
    `Kullanıcı: ${u?.email ?? "-"} (${user.id})\n` +
    `Ay: ${monthKey}\n` +
    `Talep Tutarı: ${amountTry}\n` +
    `Zaman: ${new Date().toLocaleString("tr-TR")}\n` +
    (ip ? `IP: ${ip}\n` : "") +
    (ua ? `User-Agent: ${ua}\n` : "") +
    (referer ? `Referer: ${referer}\n` : "") +
    `\nBu mesaj "talep" bildirimi içindir; sistemde ödeme kaydı oluşturulmadı.\n`;

  try {
    // Nodemailer'ı sadece server'da, çağrı anında yükle
    const nodemailer = (await import("nodemailer")).default;

    const host = process.env.SMTP_HOST!;
    const port = Number(process.env.SMTP_PORT ?? 465);
    const secure = String(process.env.SMTP_SECURE ?? "true") === "true";
    const userEnv = process.env.SMTP_USER!;
    const pass = process.env.SMTP_PASS!;

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user: userEnv, pass },
    });

    await transporter.sendMail({ from: userEnv, to, subject, html, text });

    // Kısa ömürlü cookie (UI popup için)
    const c = await cookies();
    c.set("billing_req", "ok", { httpOnly: false, path: "/billing", maxAge: 2 });
    c.set("billing_month", monthKey, { httpOnly: false, path: "/billing", maxAge: 2 });

    return { ok: true };
  } catch {
    return { ok: false, error: "Mail gönderilemedi" };
  }
}

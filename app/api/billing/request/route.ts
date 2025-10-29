// app/api/billing/request/route.ts
import "server-only";                    // client bundla karışmasın
export const runtime = "nodejs";         // nodemailer için node runtime

import { NextRequest, NextResponse } from "next/server";
import { headers, cookies } from "next/headers";
import nodemailer from "nodemailer";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";
import { prisma } from "@/app/lib/db";
import { parseMonthKey } from "@/app/lib/billing";

function createTransport() {
  const host = process.env.SMTP_HOST!;
  const port = Number(process.env.SMTP_PORT ?? 465);
  const secure = String(process.env.SMTP_SECURE ?? "true") === "true";
  const user = process.env.SMTP_USER!;
  const pass = process.env.SMTP_PASS!;
  return nodemailer.createTransport({ host, port, secure, auth: { user, pass } });
}

export async function POST(req: NextRequest) {
  // 1) Auth
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  // 2) Input
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "INVALID_JSON" }, { status: 400 });
  }

  const monthKey = String(body?.monthKey ?? "").trim();
  if (!/^\d{4}-\d{2}$/.test(monthKey)) {
    return NextResponse.json({ ok: false, error: "INVALID_MONTH" }, { status: 400 });
  }
  // Geçersiz tarihleri elemek için bir de parse edelim
  parseMonthKey(monthKey);

  // 3) Kullanıcı ücreti (opsiyonel – mailde göstermek için)
  const u = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { email: true, monthlyPriceCents: true },
  });
  const amountKurus = u?.monthlyPriceCents ?? 200000;
  const amountTry = (amountKurus / 100).toLocaleString("tr-TR", {
    style: "currency",
    currency: "TRY",
    minimumFractionDigits: 2,
  });

  // 4) Header info – DİKKAT: await!
  const h = await headers();
  const ip =
    h.get("x-real-ip") ||
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    undefined;
  const ua = h.get("user-agent") || undefined;
  const referer = h.get("referer") || undefined;

  // 5) Mail içeriği
  const to = (process.env.BILLING_ALERT_EMAIL || process.env.SMTP_USER)!.trim();
  const subject = `Ödeme talebi: ${u?.email ?? session.user.id} — ${monthKey} (${amountTry})`;
  const html = `
    <div style="font-family:Inter,system-ui,Segoe UI,Arial,sans-serif;line-height:1.6;color:#111">
      <h2 style="margin:0 0 8px">Kullanıcı ödeme yapmak istiyor</h2>
      <p style="margin:0 0 12px;color:#444">
        Panelden <strong>${monthKey}</strong> ayı için <strong>ödeme talebi</strong> gönderildi.
      </p>
      <table style="border-collapse:collapse;width:100%;max-width:560px">
        <tr><td style="padding:6px 0;color:#666">Kullanıcı</td><td style="padding:6px 0"><strong>${u?.email ?? "-"}</strong> <span style="color:#999">(${session.user.id})</span></td></tr>
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
    `Kullanıcı: ${u?.email ?? "-"} (${session.user.id})\n` +
    `Ay: ${monthKey}\n` +
    `Talep Tutarı: ${amountTry}\n` +
    `Zaman: ${new Date().toLocaleString("tr-TR")}\n` +
    (ip ? `IP: ${ip}\n` : "") +
    (ua ? `User-Agent: ${ua}\n` : "") +
    (referer ? `Referer: ${referer}\n` : "") +
    `\nBu mesaj "talep" bildirimi içindir; sistemde ödeme kaydı oluşturulmadı.\n`;

  // 6) Mail gönder
  try {
    const transporter = createTransport();
    await transporter.sendMail({
      from: process.env.SMTP_USER!,
      to,
      subject,
      html,
      text,
    });

    // 7) UI modalını tetiklemek için kısa ömürlü cookie
    const c = await cookies(); // DİKKAT: await!
    c.set("billing_req", "ok", { httpOnly: false, path: "/billing", maxAge: 10 });
    c.set("billing_month", monthKey, { httpOnly: false, path: "/billing", maxAge: 10 });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[/api/billing/request] mail error:", err);
    return NextResponse.json({ ok: false, error: "MAIL_FAILED" }, { status: 500 });
  }
}

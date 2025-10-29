import { NextRequest, NextResponse } from "next/server";
import { sendMail, welcomeEmailHtml, welcomeEmailText } from "@/app/lib/mailer";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  // Prod için basit koruma
  const isProd = process.env.NODE_ENV === "production";
  const headerToken = req.headers.get("x-test-email-token") || "";
  const required = process.env.TEST_EMAIL_TOKEN || "";
  if (isProd && (!required || headerToken !== required)) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const to = String(body.to || process.env.TEST_EMAIL_TO || "").trim();
  const name = body.userName ?? "Perdexa’ya Hoş Geldin";
  const dashboardUrl = body.dashboardUrl || process.env.DASHBOARD_URL || "https://app.perdexa.com";
  const helpUrl = body.helpUrl || "https://perdexa.com/help";

  if (!to) {
    return NextResponse.json({ ok: false, error: "missing_to" }, { status: 400 });
  }

  try {
    const html = welcomeEmailHtml({ userName: name, dashboardUrl, helpUrl });
    const text = welcomeEmailText({ userName: name, dashboardUrl, helpUrl });

    const info = await sendMail({
      to,
      subject: "Perdexa’ya Hoş Geldin 🎉",
      html,
      text,
      headers: {
        "X-Entity-Ref-ID": "welcome-test",
      },
    });

    return NextResponse.json({ ok: true, messageId: info.messageId });
  } catch (e: any) {
    console.error("test-welcome failed:", e);
    return NextResponse.json({ ok: false, error: "send_failed" }, { status: 500 });
  }
}

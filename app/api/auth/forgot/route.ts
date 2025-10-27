// app/api/auth/forgot/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/db";
import { mailer, resetEmailHtml } from "@/app/lib/mailer";
import crypto from "crypto";

export async function POST(req: Request) {
  const { email } = await req.json();

  // Kullanıcıyı çek
  const user = await prisma.user.findUnique({ where: { email } });

  // Güvenli cevap (kullanıcı yoksa da ok dön)
  if (!user) return NextResponse.json({ ok: true });

  // Eski tokenları temizle
  await prisma.passwordResetToken.deleteMany({ where: { userId: user.id } });

  // Yeni token üret + hashle
  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 60 dk

  // ⬇️ DÜZELTME: schema alan adlarına göre
  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash,
      expiresAt,
    },
  });

  // Linkini üret (route’un senin projende neredeyse ona göre değiştir)
  const link = `${process.env.APP_URL}/auth/reset-password?token=${token}&email=${encodeURIComponent(email)}`;

  // Mail gönder
  await mailer.sendMail({
    from: `"Perdexa" <${process.env.SMTP_USER}>`,
    to: email,
    subject: "Parolanı Sıfırla",
    html: resetEmailHtml(link),
  });

  return NextResponse.json({ ok: true });
}

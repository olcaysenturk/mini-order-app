"use server";

import { prisma } from "@/app/lib/db";
import { revalidatePath } from "next/cache";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";
import { getServerSession } from "next-auth";
import { addMonths, parseMonthKey, startOfMonth } from "@/app/lib/billing";

async function requireUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Giriş gerekli");
  return session.user;
}

/**
 * Seçilen ay için ödeme yapar.
 * - Zaten ödenmişse hata atar
 * - Payment kaydı oluşturur
 * - billingPaidForMonth & billingNextDueAt alanlarını ileri alır
 */
export async function payForMonth(formData: FormData) {
  const user = await requireUser();
  const monthKey = String(formData.get("monthKey") ?? "").trim(); // YYYY-MM

  if (!/^\d{4}-\d{2}$/.test(monthKey)) throw new Error("Geçersiz ay formatı");

  // Kullanıcı fiyatı (kuruş)
  const u = await prisma.user.findUnique({
    where: { id: user.id },
    select: { monthlyPriceCents: true },
  });
  const amount = u?.monthlyPriceCents ?? 200000; // 2000,00 ₺ default

  await prisma.$transaction(async (tx) => {
    // Aynı ay daha önce ödenmiş mi?
    const exists = await tx.payment.findFirst({
      where: { userId: user.id, monthKey },
      select: { id: true },
    });
    if (exists) throw new Error("Bu ay zaten ödenmiş.");

    // Ödeme kaydı
    await tx.payment.create({
      data: {
        userId: user.id,
        monthKey,
        amount,
        currency: "TRY",
        status: "paid",
      },
    });

    // Kullanıcı vadesini ay başına sabitleyip +1 ay ileri al
    const chosen = parseMonthKey(monthKey); // Ayın 1’i
    const nextDue = addMonths(startOfMonth(chosen), 1);

    await tx.user.update({
      where: { id: user.id },
      data: {
        billingPaidForMonth: chosen,
        billingNextDueAt: nextDue,
      },
    });
  });

  revalidatePath("/billing");
}

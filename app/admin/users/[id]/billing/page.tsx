// app/admin/users/[id]/billing/page.tsx
import { prisma } from "@/app/lib/db";
import { requireSuperAdmin } from "@/app/lib/requireSuperAdmin";
import Link from "next/link";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

// ---- helpers -------------------------------------------------
const fmtDate = (d?: Date | null) =>
  d ? new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium" }).format(d) : "—";

const planClass = (p?: string | null) =>
  p === "PRO"
    ? "bg-indigo-50 text-indigo-700"
    : "bg-neutral-100 text-neutral-700";

const statusClass = (s?: string | null) => {
  switch (s) {
    case "active":
      return "bg-emerald-50 text-emerald-700";
    case "trialing":
      return "bg-amber-50 text-amber-700";
    case "past_due":
      return "bg-rose-50 text-rose-700";
    case "canceled":
      return "bg-neutral-100 text-neutral-700";
    default:
      return "bg-neutral-100 text-neutral-700";
  }
};

const invoiceStatusClass = (s?: string | null) => {
  switch (s) {
    case "paid":
      return "bg-emerald-50 text-emerald-700";
    case "open":
      return "bg-amber-50 text-amber-700";
    case "failed":
    case "voided":
    case "refunded":
      return "bg-rose-50 text-rose-700";
    default:
      return "bg-neutral-100 text-neutral-700";
  }
};

// ---------------------------------------------------------------

export default async function AdminUserBillingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireSuperAdmin();
  const { id } = await params;

  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      email: true,
      memberships: {
        select: {
          role: true,
          tenant: { select: { id: true, name: true } },
        },
      },
    },
  });
  if (!user) return notFound();

  const tenantIds = user.memberships.map((m) => m.tenant.id);

  const [subs, invoices, seatCounts] = await Promise.all([
    tenantIds.length
      ? prisma.subscription.findMany({ where: { tenantId: { in: tenantIds } } })
      : Promise.resolve([]),
    tenantIds.length
      ? prisma.invoice.findMany({
          where: { tenantId: { in: tenantIds } },
          orderBy: { createdAt: "desc" },
          take: 60,
        })
      : Promise.resolve([]),
    tenantIds.length
      ? prisma.membership.groupBy({
          by: ["tenantId"],
          where: { tenantId: { in: tenantIds } },
          _count: { _all: true },
        })
      : Promise.resolve([]),
  ]);

  const subMap = new Map(subs.map((s) => [s.tenantId, s]));
  const invoiceMap = new Map<string, typeof invoices>();
  for (const i of invoices) {
    const arr = invoiceMap.get(i.tenantId) ?? [];
    arr.push(i as any);
    invoiceMap.set(i.tenantId, arr);
  }
  const seatMap = new Map(seatCounts.map((r) => [r.tenantId, r._count._all]));

  return (
    <main className="mx-auto max-w-5xl p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">
          Faturalandırma · {user.name ?? user.email}
        </h1>
        <Link
          prefetch={false}
          href={`/admin/users/`}
          className="text-sm text-indigo-600 hover:underline"
        >
          ← Kullanıcılara dön
        </Link>
      </div>

      {user.memberships.length === 0 ? (
        <div className="rounded-2xl border border-neutral-200 bg-white p-5 text-neutral-600">
          Bu kullanıcının herhangi bir tenant üyeliği yok.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {user.memberships.map((m) => {
            const s = subMap.get(m.tenant.id);
            const inv = invoiceMap.get(m.tenant.id) ?? [];
            const seats = seatMap.get(m.tenant.id) ?? 0;

            // “uyarı” çubuğu: past_due/canceled durumlarında göster
            const showBanner =
              s?.status === "past_due" || s?.status === "canceled";

            return (
              <section
                key={m.tenant.id}
                className="rounded-2xl border border-neutral-200 bg-white overflow-hidden shadow-sm"
              >
                <div className="flex items-center justify-between px-4 py-3 bg-neutral-50 border-b border-neutral-200">
                  <div className="font-medium">
                    {m.tenant.name}{" "}
                    <span className="text-neutral-400">· {m.role}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 ${planClass(
                        s?.plan
                      )}`}
                    >
                      {s?.plan ?? "FREE"}
                    </span>
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 ${statusClass(
                        s?.status
                      )}`}
                    >
                      {s?.status ?? "trialing"}
                    </span>
                  </div>
                </div>

                {showBanner && (
                  <div className="mx-4 mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700">
                    Ödeme gerekli veya abonelik kapalı. “Ödeme Portalı” ile
                    yöntemi güncelleyebilir ya da yeniden başlatabilirsiniz.
                  </div>
                )}

                <div className="p-4 space-y-4">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                    <div>
                      <div className="text-neutral-500">Seats</div>
                      <div className="font-semibold">
                        {seats}
                        {s?.seatLimit ? ` / ${s.seatLimit}` : ""}
                      </div>
                    </div>
                    <div>
                      <div className="text-neutral-500">Dönem Sonu</div>
                      <div className="font-semibold">
                        {fmtDate(s?.currentPeriodEnd)}
                      </div>
                    </div>
                    <div>
                      <div className="text-neutral-500">Plan</div>
                      <div className="font-semibold">{s?.plan ?? "FREE"}</div>
                    </div>
                    <div>
                      <div className="text-neutral-500">Durum</div>
                      <div className="font-semibold">
                        {s?.status ?? "trialing"}
                      </div>
                    </div>
                  </div>

                  {/* Aksiyonlar */}
                  <div className="flex flex-wrap items-center gap-2">
                    {/* PRO — birincil */}
                    <Link
                      prefetch={false}
                      href={`/admin/users/${user.id}/billing/checkout?tenantId=${m.tenant.id}&plan=PRO`}
                      className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 active:scale-[.99] focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
                      title="Bu tenant için PRO planını etkinleştir"
                      aria-label="PRO planını etkinleştir"
                    >
                      {/* crown */}
                      <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
                        <path
                          fill="currentColor"
                          d="M5 18h14l1-9-5 3-3-6-3 6-5-3zM4 20h16v2H4z"
                        />
                      </svg>
                      <span>PRO’ya Geç</span>
                    </Link>

                    {/* FREE — ikincil/outline */}
                    <Link
                      prefetch={false}
                      href={`/admin/users/${user.id}/billing/checkout?tenantId=${m.tenant.id}&plan=FREE`}
                      className="inline-flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 active:scale-[.99] focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
                      title="Bu tenant için ücretsiz plana dön"
                      aria-label="Ücretsiz plana dön"
                    >
                      {/* rotate-ccw */}
                      <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
                        <path
                          fill="currentColor"
                          d="M12 5V1L7 6l5 5V7a5 5 0 1 1-5 5H5a7 7 0 1 0 7-7z"
                        />
                      </svg>
                      <span>FREE’ye Dön</span>
                    </Link>

                    {/* Portal — ikincil/outline */}
                    <Link
                      prefetch={false}
                      href={`/admin/users/${user.id}/billing/portal?tenantId=${m.tenant.id}`}
                      className="inline-flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 active:scale-[.99] focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
                      title="Ödeme yöntemlerini ve faturaları yönet"
                      aria-label="Ödeme portalını aç"
                    >
                      {/* credit-card */}
                      <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
                        <path
                          fill="currentColor"
                          d="M2 7a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2zm2 0h16v2H4zm0 6h6v2H4z"
                        />
                      </svg>
                      <span>Ödeme Portalı</span>
                    </Link>
                    {s?.status !== "canceled" && !s?.cancelAtPeriodEnd && (
                      <Link
                        prefetch={false}
                        href={`/admin/users/${user.id}/billing/cancel?tenantId=${m.tenant.id}&mode=period_end`}
                        className="inline-flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-800 hover:bg-amber-100 active:scale-[.99] focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2"
                        title="Dönem sonunda aboneliği pasifleştir"
                        aria-label="Dönem sonunda pasifleştir"
                      >
                        {/* clock icon */}
                        <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
                          <path
                            fill="currentColor"
                            d="M12 1a11 11 0 1 0 11 11A11.013 11.013 0 0 0 12 1Zm1 11h5v2h-7V6h2Z"
                          />
                        </svg>
                        <span>Dönem Sonunda Pasifleştir</span>
                      </Link>
                    )}

                    {/* Hemen pasifleştir */}
                    {s?.status !== "canceled" && (
                      <Link
                        prefetch={false}
                        href={`/admin/users/${user.id}/billing/cancel?tenantId=${m.tenant.id}&mode=now`}
                        className="inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-100 active:scale-[.99] focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 focus-visible:ring-offset-2"
                        title="Aboneliği hemen pasifleştir"
                        aria-label="Hemen pasifleştir"
                      >
                        {/* power icon */}
                        <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
                          <path
                            fill="currentColor"
                            d="M12 2h2v10h-2zM7.05 4.05 5.64 5.46A8 8 0 1 0 18.36 5.46l-1.41-1.41A6 6 0 1 1 7.05 4.05z"
                          />
                        </svg>
                        <span>Hemen Pasifleştir</span>
                      </Link>
                    )}

                    {/* İptali geri al (cancelAtPeriodEnd true ise veya status canceled ise) */}
                    {(s?.cancelAtPeriodEnd || s?.status === "canceled") && (
                      <Link
                        prefetch={false}
                        href={`/admin/users/${user.id}/billing/resume?tenantId=${m.tenant.id}`}
                        className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-100 active:scale-[.99] focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2"
                        title="İptali geri al ve aboneliği aktifleştir"
                        aria-label="İptali geri al"
                      >
                        {/* play icon */}
                        <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
                          <path fill="currentColor" d="M8 5v14l11-7z" />
                        </svg>
                        <span>İptali Geri Al</span>
                      </Link>
                    )}
                  </div>

                  {/* Faturalar */}
                  <div className="rounded-xl border border-neutral-200 overflow-hidden">
                    <div className="px-3 py-2 text-sm font-medium bg-neutral-50 border-b border-neutral-200">
                      Son Faturalar
                    </div>
                    <table
                      className="w-full text-sm"
                      aria-label="Son faturalar"
                    >
                      <thead>
                        <tr className="[&>th]:px-3 [&>th]:py-2 text-left text-neutral-500">
                          <th>Tarih</th>
                          <th>Tutar</th>
                          <th>Durum</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {inv.length === 0 ? (
                          <tr>
                            <td
                              colSpan={3}
                              className="px-3 py-6 text-center text-neutral-500"
                            >
                              Fatura yok.
                            </td>
                          </tr>
                        ) : (
                          inv.slice(0, 10).map((i) => (
                            <tr key={i.id} className="[&>td]:px-3 [&>td]:py-2">
                              <td>{fmtDate(i.createdAt)}</td>
                              <td>
                                {Number(i.amount).toLocaleString("tr-TR", {
                                  style: "currency",
                                  currency: i.currency,
                                })}
                              </td>
                              <td>
                                <span
                                  className={`inline-flex items-center rounded-full px-2 py-0.5 ${invoiceStatusClass(
                                    i.status as any
                                  )}`}
                                >
                                  {i.status}
                                </span>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </section>
            );
          })}
        </div>
      )}
    </main>
  );
}

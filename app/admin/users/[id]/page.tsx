"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { signIn, useSession } from "next-auth/react";

/* ================= Types ================ */
type Plan = "FREE" | "PRO";
type SubStatus = "trialing" | "active" | "past_due" | "canceled";

type Invoice = {
  id: string;
  createdAt: string;
  status: "open" | "paid" | "failed" | "voided" | "refunded";
  amount: number;
  currency: string;
  provider: string;
  providerInvoiceId?: string | null;
  paidAt?: string | null;
  dueAt?: string | null;
};

type Subscription = {
  plan: Plan;
  status: SubStatus;
  provider: string;
  currentPeriodStart?: string | null;
  currentPeriodEnd?: string | null;
  trialEndsAt?: string | null;
  cancelAtPeriodEnd?: boolean;
  seats?: number;
  seatLimit?: number | null;
  graceUntil?: string | null;
} | null;

type TenantRow = {
  id: string;
  name: string;
  role: "OWNER" | "ADMIN" | "STAFF";
  createdAt: string;
  memberSince?: string | null;
  subscription: Subscription;
  invoices: Invoice[];
};

type UserRow = {
  id: string;
  name?: string | null;
  email: string;
  isActive: boolean;
  role: "ADMIN" | "STAFF" | "SUPERADMIN";
  createdAt: string;
};

type BillingResp = {
  user: UserRow;
  tenants: TenantRow[];
};

/* ================= Helpers ================= */
function fmtDateTR(v?: string | Date | null) {
  if (!v) return "—";
  const d = v instanceof Date ? v : new Date(v);
  if (isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium" }).format(d);
}
function startOfMonth(d: Date) {
  const x = new Date(d);
  x.setDate(1);
  x.setHours(0, 0, 0, 0);
  return x;
}
function labelTR(year: number, m0: number) {
  const names = [
    "Ocak","Şubat","Mart","Nisan","Mayıs","Haziran",
    "Temmuz","Ağustos","Eylül","Ekim","Kasım","Aralık",
  ];
  return `${names[m0]} ${year}`;
}
function daysLeft(sub: Subscription) {
  if (!sub) return null;
  const now = new Date();
  const ends =
    (sub.status === "trialing" && sub.trialEndsAt
      ? new Date(sub.trialEndsAt)
      : null) || (sub.currentPeriodEnd ? new Date(sub.currentPeriodEnd) : null);
  if (!ends || isNaN(ends.getTime())) return null;
  const diff = Math.ceil((ends.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  return diff;
}
function buildMonthsForYear(memberSince: Date, invoices: Invoice[], year: number) {
  const now = new Date();
  const months: Array<{
    y: number; m0: number; label: string; paid: boolean;
    invoiceId?: string; paidAt?: string; payable: boolean;
  }> = [];

  const ms = startOfMonth(memberSince);
  const jan = new Date(year, 0, 1);
  const dec = new Date(year, 11, 31, 23, 59, 59, 999);
  const begin = startOfMonth(ms > jan ? ms : jan);
  const end = new Date(Math.min(startOfMonth(now).getTime(), startOfMonth(dec).getTime()));
  if (begin.getTime() > end.getTime()) return months;

  const paidMap = new Map<string, Invoice>();
  for (const inv of invoices || []) {
    if (inv.status !== "paid") continue;
    const paidD = inv.paidAt ? new Date(inv.paidAt) : null;
    const dueD = inv.dueAt ? new Date(inv.dueAt) : null;
    const anchor = paidD && !isNaN(paidD.getTime()) ? paidD : dueD && !isNaN(dueD.getTime()) ? dueD : null;
    if (!anchor) continue;
    paidMap.set(`${anchor.getFullYear()}-${anchor.getMonth()}`, inv);
  }

  let cursor = new Date(begin);
  while (cursor.getTime() <= end.getTime()) {
    const key = `${cursor.getFullYear()}-${cursor.getMonth()}`;
    const inv = paidMap.get(key);
    months.push({
      y: cursor.getFullYear(),
      m0: cursor.getMonth(),
      label: labelTR(cursor.getFullYear(), cursor.getMonth()),
      paid: !!inv,
      invoiceId: inv?.id,
      paidAt: inv?.paidAt ?? undefined,
      payable: true,
    });
    cursor.setMonth(cursor.getMonth() + 1);
    cursor = startOfMonth(cursor);
  }
  return months;
}

/* ================= Page ================= */
export default function AdminUserDetailPage() {
  const { data: session } = useSession();
  const isAdmin =
    session?.user?.role === "ADMIN" || session?.user?.role === "SUPERADMIN";

  const params = useParams<{ id: string }>();
  const router = useRouter();
  const sp = useSearchParams();
  const id = params.id;

  const thisYear = new Date().getFullYear();
  const qYear = parseInt(sp.get("year") ?? "", 10);
  const selectedYear = Number.isFinite(qYear) ? qYear : thisYear;

  const [data, setData] = useState<BillingResp | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = async () => {
    if (!id) return;
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch(`/api/admin/users/${id}/billing?year=${selectedYear}`, { cache: "no-store" });
      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(txt || "Yüklenemedi");
      }
      const j = (await res.json()) as BillingResp;
      setData(j);
    } catch (e: any) {
      console.error("GET /api/admin/users/[id]/billing error:", e);
      setErr(e?.message || "Yüklenemedi");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(); // eslint-disable-next-line
  }, [id, selectedYear]);

  const user = data?.user ?? null;
  const tenants = data?.tenants ?? [];

  const uniqueTenants = useMemo(() => {
    const seen = new Set<string>();
    const out: TenantRow[] = [];
    for (const t of tenants) {
      if (seen.has(t.id)) continue;
      seen.add(t.id);
      out.push(t);
    }
    return out;
  }, [tenants]);

  const [toggling, setToggling] = useState(false);
  const toggleActive = async () => {
    if (!user) return;
    setToggling(true);
    try {
      const res = await fetch(`/api/admin/users/${user.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !user.isActive }),
      });
      if (!res.ok) throw new Error(await res.text());
      await load();
    } catch (e: any) {
      console.error(e);
      alert(e?.message || "Durum güncellenemedi.");
    } finally {
      setToggling(false);
    }
  };

  const changeYear = (y: number) => {
    const usp = new URLSearchParams(sp.toString());
    usp.set("year", String(y));
    router.replace(`?${usp.toString()}`, { scroll: false });
  };

  // ⬇️ Impersonation: Kullanıcı olarak giriş yap
  const [impLoading, setImpLoading] = useState(false);
  const loginAsUser = async () => {
    if (!user) return;
    setImpLoading(true);
    try {
      const r = await fetch(`/api/admin/impersonate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUserId: user.id, scope: "tenant" }),
      });

      const raw = await r.text();              // <-- önce ham metni al
      let out: any = null;
      try { out = raw ? JSON.parse(raw) : null } catch { /* yut */ }

      if (!r.ok) {
        const msg = out?.error || raw || "İşlem başarısız";
        throw new Error(msg);
      }

      const { token, next } = (out || {}) as { token: string; next?: string };
      if (!token) throw new Error("Token üretilemedi.");

      await signIn("impersonate", { token, redirect: true, callbackUrl: next || "/" });
    } catch (e: any) {
      console.error(e);
      alert(e?.message || "İşlem başarısız");
    } finally {
      setImpLoading(false);
    }
  };

  return (
    <main className="mx-auto max-w-6xl p-4 sm:p-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Kullanıcı Detayı</h1>
          {user ? (
            <div className="mt-1 text-sm text-neutral-600">
              {user.name ?? "—"} • {user.email} • Rol: <b>{user.role}</b>
            </div>
          ) : loading ? (
            <div className="mt-2 h-4 w-48 animate-pulse rounded bg-neutral-200" />
          ) : null}
        </div>

        <div className="flex items-center gap-2">
          <select
            className="h-9 rounded-xl border border-neutral-200 bg-white px-3 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            value={selectedYear}
            onChange={(e) => changeYear(parseInt(e.target.value, 10))}
            aria-label="Yıl"
          >
            {Array.from({ length: 6 }).map((_, i) => {
              const y = thisYear + 1 - i;
              return (
                <option key={y} value={y}>
                  {y}
                </option>
              );
            })}
          </select>

          {user ? (
            <>
              {isAdmin && (
                <button
                  onClick={loginAsUser}
                  disabled={impLoading || !user.isActive}
                  className="inline-flex h-9 items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 text-sm text-neutral-700 hover:bg-neutral-50 disabled:opacity-60"
                  title="Bu kullanıcı olarak oturum aç"
                >
                  {impLoading ? "Açılıyor…" : "Kullanıcı olarak giriş yap"}
                </button>
              )}

              <button
                onClick={toggleActive}
                disabled={toggling}
                className={`inline-flex h-9 items-center gap-2 rounded-xl px-3 text-sm shadow-sm ${
                  user.isActive
                    ? "bg-rose-600 text-white hover:bg-rose-700"
                    : "bg-emerald-600 text-white hover:bg-emerald-700"
                } disabled:opacity-60`}
                title={user.isActive ? "Pasife al" : "Aktif et"}
              >
                {user.isActive ? "Pasife Al" : "Aktif Et"}
              </button>
            </>
          ) : loading ? (
            <div className="h-9 w-28 animate-pulse rounded-xl bg-neutral-200" />
          ) : null}
        </div>
      </div>

      {err && (
        <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {err}
        </div>
      )}

      {/* ===== Skeletonlar ===== */}
      {loading ? (
        <div className="grid grid-cols-1 gap-4">
          <SkeletonTenantCard />
        </div>
      ) : (
        <>
          {user && uniqueTenants.length === 0 ? (
            <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
              Bu kullanıcıya bağlı tenant bulunamadı.
            </div>
          ) : null}

          <div className="grid grid-cols-1 gap-4">
            {uniqueTenants.map((t) => (
              <TenantBillingCard
                key={t.id}
                tenant={t}
                selectedYear={selectedYear}
                onChanged={load}
              />
            ))}
          </div>
        </>
      )}
    </main>
  );
}

/* ============== Tenant kartı ============== */

function TenantBillingCard({
  tenant,
  selectedYear,
  onChanged,
}: {
  tenant: TenantRow;
  selectedYear: number;
  onChanged: () => void;
}) {
  const sub = tenant.subscription;
  const memberSince = tenant.memberSince || tenant.createdAt;
  const msDate = new Date(memberSince);

  const months = useMemo(
    () => buildMonthsForYear(msDate, tenant.invoices || [], selectedYear),
    [tenant.id, memberSince, selectedYear, tenant.invoices?.length]
  );

  const left = daysLeft(sub);
  const planHuman = sub?.plan === "PRO" ? "PRO" : "FREE";
  const statusHuman =
    sub?.status === "trialing" ? "Deneme"
    : sub?.status === "active" ? "Aktif"
    : sub?.status === "past_due" ? "Gecikmiş"
    : sub?.status === "canceled" ? "İptal" : "—";

  return (
    <section className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold">{tenant.name}</div>
          <div className="mt-0.5 text-[12px] text-neutral-600">
            Üyelik başlangıcı: <b>{fmtDateTR(memberSince)}</b>
          </div>
          <div className="mt-0.5 text-[12px] text-neutral-600">
            Paket: <b>{planHuman}</b> • Durum: <b>{statusHuman}</b>{" "}
            {left !== null && left !== undefined ? (
              <span className="ms-2">
                (Kalan: <b>{left}</b> gün)
              </span>
            ) : null}
          </div>
        </div>

        <PlanChanger tenantId={tenant.id} current={sub?.plan ?? "FREE"} onChanged={onChanged} />
      </div>

      <MonthList tenantId={tenant.id} months={months} onChanged={onChanged} />
      <InvoiceTable invoices={tenant.invoices} />
    </section>
  );
}

/* ============== PlanChanger ============== */

function PlanChanger({
  tenantId,
  current,
  onChanged,
}: {
  tenantId: string;
  current: Plan;
  onChanged: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const saveAs = async (planToSend: Plan) => {
    setSaving(true);
    setMsg(null);
    setErr(null);
    try {
      const res = await fetch(`/api/admin/tenants/${tenantId}/subscription`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: planToSend }),
      });
      const out = await res.json().catch(() => null);
      if (!res.ok) throw new Error(out?.error || "Paket güncellenemedi");
      setMsg("Paket güncellendi");
      onChanged();
    } catch (e: any) {
      console.error(e);
      setErr(e?.message || "Paket güncellenemedi");
      alert(e?.message || "Paket güncellenemedi");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => saveAs("PRO")}
        disabled={saving}
        className="inline-flex h-9 items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 text-sm text-neutral-700 hover:bg-neutral-50 disabled:opacity-60"
        title="PRO'ya al"
      >
        PRO’ya Al
      </button>
      <button
        type="button"
        onClick={() => saveAs("FREE")}
        disabled={saving}
        className="inline-flex h-9 items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 text-sm text-neutral-700 hover:bg-neutral-50 disabled:opacity-60"
        title="FREE yap"
      >
        FREE yap
      </button>

      {msg && <span className="text-[12px] text-emerald-700">{msg}</span>}
      {err && <span className="text-[12px] text-rose-700">{err}</span>}
    </div>
  );
}

/* ============== Ay Listesi + Ödeme ============== */

function MonthList({
  tenantId,
  months,
  onChanged,
}: {
  tenantId: string;
  months: Array<{
    y: number;
    m0: number;
    label: string;
    paid: boolean;
    paidAt?: string;
    payable: boolean;
  }>;
  onChanged: () => void;
}) {
  const [payingKey, setPayingKey] = useState<string | null>(null);

  const pay = async (y: number, m0: number) => {
    const key = `${y}-${m0}`;
    setPayingKey(key);
    try {
      // ✅ tenant tabanlı endpoint
      const res = await fetch(`/api/admin/tenants/${tenantId}/billing/pay`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year: y, month: m0 + 1 }),
      });
      const out = await res.json().catch(() => null);
      if (!res.ok) throw new Error(out?.error || "Ödeme kaydedilemedi");
      onChanged();
    } catch (e: any) {
      console.error(e);
      alert(e?.message || "Ödeme kaydedilemedi");
    } finally {
      setPayingKey(null);
    }
  };

  return (
    <div className="mt-4 rounded-xl border border-neutral-200">
      <div className="px-3 py-2 text-sm font-medium">Ay Bazında Durum</div>
      {months.length === 0 ? (
        <div className="px-3 pb-3 text-sm text-neutral-600">Listelenecek ay yok.</div>
      ) : (
        <ul className="divide-y">
          {months.map((m) => {
            const key = `${m.y}-${m.m0}`;
            const canPay = !m.paid && m.payable;
            return (
              <li key={key} className="px-3 py-2 text-sm flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span
                    className="inline-flex size-2.5 rounded-full"
                    style={{ backgroundColor: m.paid ? "#10B981" : "#F59E0B" }}
                    aria-hidden
                  />
                  <span className="font-medium">{m.label}</span>
                </div>

                <div className="flex items-center gap-2 text-[12px] text-neutral-600">
                  {m.paid ? (
                    <>
                      <b>Ödendi</b>
                      {m.paidAt ? <> • {fmtDateTR(m.paidAt)}</> : null}
                    </>
                  ) : (
                    <>
                      <b>Ödeme bekliyor</b>
                      <button
                        type="button"
                        onClick={() => pay(m.y, m.m0)}
                        disabled={!canPay || payingKey === key}
                        className="ms-2 inline-flex h-7 items-center gap-2 rounded-lg border border-neutral-200 bg-white px-2 text-[12px] text-neutral-700 hover:bg-neutral-50 disabled:opacity-60"
                        title="Ödeme Yap"
                      >
                        {payingKey === key ? "Kaydediliyor…" : "Ödeme Yap (2000 ₺)"}
                      </button>
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/* ============== Fatura Tablosu ============== */

function InvoiceTable({ invoices }: { invoices: Invoice[] }) {
  return (
    <div className="mt-4">
      <div className="mb-2 text-sm font-semibold">Faturalar (son 10)</div>
      {!invoices?.length ? (
        <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-700">
          Kayıt yok.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="[&>th]:px-3 [&>th]:py-2 text-left text-neutral-500">
                <th>#</th>
                <th>Durum</th>
                <th>Tutar</th>
                <th>Oluşturulma</th>
                <th>Vade</th>
                <th>Ödeme</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {invoices.slice(0, 10).map((inv, i) => (
                <tr key={inv.id} className="[&>td]:px-3 [&>td]:py-2">
                  <td className="text-neutral-500">{i + 1}</td>
                  <td className="font-medium">
                    {inv.status === "paid"
                      ? "Ödendi"
                      : inv.status === "open"
                      ? "Açık"
                      : inv.status === "failed"
                      ? "Başarısız"
                      : inv.status === "voided"
                      ? "İptal"
                      : inv.status === "refunded"
                      ? "İade"
                      : inv.status}
                  </td>
                  <td className="tabular-nums">
                    {new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2 }).format(inv.amount)} {inv.currency}
                  </td>
                  <td>{fmtDateTR(inv.createdAt)}</td>
                  <td>{fmtDateTR(inv.dueAt)}</td>
                  <td>{fmtDateTR(inv.paidAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ============== Skeleton Components ============== */

function SkeletonTenantCard() {
  return (
    <section className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
      {/* header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="h-4 w-40 animate-pulse rounded bg-neutral-200" />
          <div className="mt-2 h-3 w-56 animate-pulse rounded bg-neutral-200" />
          <div className="mt-1 h-3 w-64 animate-pulse rounded bg-neutral-200" />
        </div>
        <div className="flex items-center gap-2">
          <div className="h-9 w-28 animate-pulse rounded-xl bg-neutral-200" />
          <div className="h-9 w-24 animate-pulse rounded-xl bg-neutral-200" />
        </div>
      </div>

      {/* months skeleton */}
      <div className="mt-4 rounded-xl border border-neutral-200">
        <div className="px-3 py-2 text-sm font-medium">Ay Bazında Durum</div>
        <ul className="divide-y">
          {Array.from({ length: 4 }).map((_, i) => (
            <li key={i} className="px-3 py-2 text-sm flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="inline-flex size-2.5 rounded-full bg-neutral-200" />
                <div className="h-3 w-32 animate-pulse rounded bg-neutral-200" />
              </div>
              <div className="h-7 w-28 animate-pulse rounded-lg bg-neutral-200" />
            </li>
          ))}
        </ul>
      </div>

      {/* invoices skeleton */}
      <div className="mt-4">
        <div className="mb-2 h-4 w-40 animate-pulse rounded bg-neutral-200" />
        <div className="overflow-x-auto">
          <div className="min-w-full">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="mb-2 grid grid-cols-6 gap-3">
                <div className="h-3 w-8 animate-pulse rounded bg-neutral-200" />
                <div className="h-3 w-20 animate-pulse rounded bg-neutral-200" />
                <div className="h-3 w-24 animate-pulse rounded bg-neutral-200" />
                <div className="h-3 w-28 animate-pulse rounded bg-neutral-200" />
                <div className="h-3 w-28 animate-pulse rounded bg-neutral-200" />
                <div className="h-3 w-28 animate-pulse rounded bg-neutral-200" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

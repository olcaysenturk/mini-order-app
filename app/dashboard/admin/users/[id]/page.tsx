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

  const roleLabel =
    user?.role === "SUPERADMIN"
      ? "Super Admin"
      : user?.role === "ADMIN"
      ? "Admin"
      : user?.role === "STAFF"
      ? "Staff"
      : "—";
  const uniqueTenantCount = uniqueTenants.length;
  const elevatedTenantCount = uniqueTenants.filter((t) => t.role !== "STAFF").length;
  const statusTone: "emerald" | "rose" | "neutral" = user ? (user.isActive ? "emerald" : "rose") : "neutral";
  const summaryCards: ReadonlyArray<{
    label: string;
    value: string | number;
    helper: string;
    tone: "indigo" | "emerald" | "amber" | "rose" | "neutral";
  }> = [
    {
      label: "Rol",
      value: user ? roleLabel : "—",
      helper: user ? "Sistem içi yetki seviyesi" : "Veriler yükleniyor",
      tone: "indigo" as const,
    },
    {
      label: "Durum",
      value: user ? (user.isActive ? "Aktif" : "Pasif") : "—",
      helper: user ? (user.isActive ? "Erişimi açık" : "Erişimi kapalı") : "Veriler yükleniyor",
      tone: statusTone,
    },
    {
      label: "Tenant Sayısı",
      value: user ? uniqueTenantCount : "—",
      helper: user ? `${elevatedTenantCount} admin/owner yetkisi` : "Veriler yükleniyor",
      tone: "amber" as const,
    },
    {
      label: "Kayıt Tarihi",
      value: user ? fmtDateTR(user.createdAt) : "—",
      helper: `Faturalama yılı: ${selectedYear}`,
      tone: "neutral" as const,
    },
  ];

  return (
    <main className="mx-auto max-w-6xl space-y-8 p-4 sm:p-6">
      <section className="relative overflow-hidden rounded-3xl border border-neutral-200 bg-white/90 shadow-xl">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(79,70,229,0.18),transparent_55%),radial-gradient(circle_at_bottom_right,rgba(16,185,129,0.16),transparent_55%)]" />
        <div className="relative z-10 grid gap-6 px-6 py-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <div className="space-y-5">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-1 text-xs font-semibold text-indigo-700 ring-1 ring-indigo-100">
              Admin • Kullanıcı Detayı
            </span>
            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-neutral-900 sm:text-4xl">
                {user ? user.name ?? user.email : "Kullanıcı Detayı"}
              </h1>
              <p className="mt-2 max-w-2xl text-sm text-neutral-600">
                {user
                  ? `${user.email} kullanıcısına ait tenant yetkileri, abonelik durumu ve faturaları görüntüleyin.`
                  : "Kullanıcı bilgileri yükleniyor…"}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-600">
              {user ? (
                <>
                  <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 font-medium text-indigo-700 ring-1 ring-indigo-200">
                    Rol: {roleLabel}
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                      user.isActive
                        ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
                        : "bg-rose-50 text-rose-700 ring-1 ring-rose-200"
                    }`}
                  >
                    {user.isActive ? "Aktif" : "Pasif"}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-medium text-neutral-700 ring-1 ring-neutral-300">
                    Üyelik: {fmtDateTR(user.createdAt)}
                  </span>
                </>
              ) : (
                <span className="h-4 w-32 animate-pulse rounded bg-neutral-200" aria-hidden />
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <label className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/70 bg-white/90 px-3 text-sm text-neutral-600 shadow-sm">
                <span className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
                  Yıl
                </span>
                <select
                  className="bg-transparent text-sm font-semibold text-neutral-800 focus:outline-none"
                  value={selectedYear}
                  onChange={(e) => changeYear(parseInt(e.target.value, 10))}
                  aria-label="Yıl seçimi"
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
              </label>
              {user && isAdmin && (
                <button
                  onClick={loginAsUser}
                  disabled={impLoading || !user.isActive}
                  className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/70 bg-white/90 px-3 text-sm font-semibold text-neutral-800 shadow-sm transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
                  title="Bu kullanıcı olarak oturum aç"
                >
                  {impLoading ? "Açılıyor…" : "Kullanıcı olarak giriş yap"}
                </button>
              )}
              {user && (
                <button
                  onClick={toggleActive}
                  disabled={toggling}
                  className={`inline-flex h-10 items-center gap-2 rounded-xl px-3 text-sm font-semibold shadow-sm transition ${
                    user.isActive
                      ? "bg-rose-600 text-white hover:bg-rose-700"
                      : "bg-emerald-600 text-white hover:bg-emerald-700"
                  } disabled:opacity-60`}
                  title={user.isActive ? "Pasife al" : "Aktif et"}
                >
                  {user.isActive ? "Pasife Al" : "Aktif Et"}
                </button>
              )}
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {summaryCards.map((card) => (
              <StatTile key={card.label} {...card} />
            ))}
          </div>
        </div>
      </section>

      {err && (
        <div className="rounded-3xl border border-rose-200 bg-rose-50/80 px-4 py-3 text-sm text-rose-700 shadow-sm">
          {err}
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 gap-4">
          <SkeletonTenantCard />
        </div>
      ) : (
        <>
          {user && uniqueTenants.length === 0 ? (
            <div className="rounded-3xl border border-neutral-200 bg-white/80 px-4 py-6 text-sm text-neutral-600 shadow-sm">
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

/* ============== Yardımcı bileşenler ============== */

function StatTile({
  label,
  value,
  helper,
  tone,
}: {
  label: string;
  value: string | number;
  helper?: string;
  tone: "indigo" | "emerald" | "amber" | "rose" | "neutral";
}) {
  const toneClass =
    tone === "emerald"
      ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
      : tone === "amber"
      ? "bg-amber-50 text-amber-700 ring-amber-200"
      : tone === "rose"
      ? "bg-rose-50 text-rose-700 ring-rose-200"
      : tone === "neutral"
      ? "bg-neutral-50 text-neutral-700 ring-neutral-200"
      : "bg-indigo-50 text-indigo-700 ring-indigo-200";

  return (
    <div className={`rounded-2xl bg-white/75 px-4 py-3 text-sm shadow-sm ring-1 ${toneClass}`}>
      <div className="text-xs font-medium uppercase tracking-wide text-neutral-500">{label}</div>
      <div className="mt-1 text-xl font-semibold">{value}</div>
      {helper && <div className="mt-1 text-[11px] text-neutral-500">{helper}</div>}
    </div>
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
  const tenantRoleLabel =
    tenant.role === "OWNER" ? "Owner" : tenant.role === "ADMIN" ? "Admin" : "Staff";

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
    <section className="rounded-3xl border border-neutral-200 bg-white/90 p-6 shadow-sm backdrop-blur">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 space-y-2">
          <div className="inline-flex flex-wrap items-center gap-2 text-[11px] font-medium">
            <span className="inline-flex items-center gap-1 rounded-full bg-neutral-900 px-2.5 py-0.5 text-white shadow-sm shadow-neutral-900/10">
              Tenant
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2 py-0.5 text-neutral-700 ring-1 ring-neutral-300">
              Rol: {tenantRoleLabel}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-indigo-700 ring-1 ring-indigo-200">
              Plan: {planHuman}
            </span>
          </div>
          <div className="text-lg font-semibold text-neutral-900">{tenant.name}</div>
          <div className="text-[12px] text-neutral-600">
            Üyelik başlangıcı: <b>{fmtDateTR(memberSince)}</b>
          </div>
          <div className="text-[12px] text-neutral-600">
            Durum: <b>{statusHuman}</b>{" "}
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
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <button
        type="button"
        onClick={() => saveAs("PRO")}
        disabled={saving}
        className="inline-flex h-9 items-center gap-2 rounded-xl bg-indigo-600 px-3 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
        title="PRO'ya al"
      >
        PRO’ya Al
      </button>
      <button
        type="button"
        onClick={() => saveAs("FREE")}
        disabled={saving}
        className="inline-flex h-9 items-center gap-2 rounded-xl border border-neutral-200 bg-white/90 px-3 text-sm font-semibold text-neutral-700 shadow-sm hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
        title="FREE yap"
      >
        FREE yap
      </button>

      {msg && (
        <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 ring-1 ring-emerald-200">
          {msg}
        </span>
      )}
      {err && (
        <span className="inline-flex items-center rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-medium text-rose-700 ring-1 ring-rose-200">
          {err}
        </span>
      )}
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
    <div className="mt-6 rounded-2xl border border-neutral-200 bg-neutral-50/80 shadow-inner">
      <div className="flex items-center justify-between gap-2 rounded-t-2xl bg-neutral-100/80 px-4 py-2">
        <span className="text-sm font-semibold text-neutral-800">Ay Bazında Durum</span>
        {months.length > 0 && (
          <span className="text-xs font-medium text-neutral-500">
            Görüntülenen yıl: {months[0]?.y}
          </span>
        )}
      </div>
      {months.length === 0 ? (
        <div className="px-4 py-3 text-sm text-neutral-600">Listelenecek ay yok.</div>
      ) : (
        <ul className="divide-y divide-neutral-200/70">
          {months.map((m) => {
            const key = `${m.y}-${m.m0}`;
            const canPay = !m.paid && m.payable;
            return (
              <li key={key} className="flex items-center justify-between px-4 py-3 text-sm">
                <div className="flex items-center gap-3">
                  <span
                    className={`inline-flex size-2.5 rounded-full ${m.paid ? "bg-emerald-500" : "bg-amber-400"}`}
                    aria-hidden
                  />
                  <div className="min-w-0">
                    <div className="font-semibold text-neutral-800">{m.label}</div>
                    {m.paidAt && (
                      <div className="text-[11px] text-neutral-500">
                        Ödendi: {fmtDateTR(m.paidAt)}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 text-[12px] text-neutral-600">
                  {m.paid ? (
                    <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-700 ring-1 ring-emerald-200">
                      Ödendi
                    </span>
                  ) : (
                    <>
                      <span className="font-semibold text-amber-600">Ödeme bekliyor</span>
                      <button
                        type="button"
                        onClick={() => pay(m.y, m.m0)}
                        disabled={!canPay || payingKey === key}
                        className="inline-flex h-8 items-center gap-2 rounded-xl border border-neutral-200 bg-white/90 px-3 text-[12px] font-semibold text-neutral-700 shadow-sm hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
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
    <div className="mt-6">
      <div className="mb-2 text-sm font-semibold text-neutral-800">Faturalar (son 10)</div>
      {!invoices?.length ? (
        <div className="rounded-2xl border border-neutral-200 bg-neutral-50/90 px-4 py-3 text-sm text-neutral-700">
          Kayıt yok.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-neutral-200 bg-white/80 shadow-sm">
          <table className="min-w-full text-sm">
            <thead className="bg-neutral-100/80 text-xs uppercase tracking-wide text-neutral-500">
              <tr className="[&>th]:px-4 [&>th]:py-2 text-left">
                <th>#</th>
                <th>Durum</th>
                <th>Tutar</th>
                <th>Oluşturulma</th>
                <th>Vade</th>
                <th>Ödeme</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100/70">
              {invoices.slice(0, 10).map((inv, i) => (
                <tr key={inv.id} className="[&>td]:px-4 [&>td]:py-2">
                  <td className="text-neutral-500">{i + 1}</td>
                  <td className="font-medium text-neutral-800">
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
                  <td className="tabular-nums font-semibold text-neutral-900">
                    {new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2 }).format(inv.amount)} {inv.currency}
                  </td>
                  <td className="text-neutral-600">{fmtDateTR(inv.createdAt)}</td>
                  <td className="text-neutral-600">{fmtDateTR(inv.dueAt)}</td>
                  <td className="text-neutral-600">{fmtDateTR(inv.paidAt)}</td>
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
    <section className="rounded-3xl border border-neutral-200 bg-white/90 p-6 shadow-sm backdrop-blur">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 space-y-2">
          <div className="h-4 w-32 animate-pulse rounded-full bg-neutral-200" />
          <div className="h-5 w-48 animate-pulse rounded bg-neutral-200" />
          <div className="h-3 w-40 animate-pulse rounded bg-neutral-200" />
          <div className="h-3 w-44 animate-pulse rounded bg-neutral-200" />
        </div>
        <div className="flex items-center gap-2">
          <div className="h-9 w-28 animate-pulse rounded-xl bg-neutral-200" />
          <div className="h-9 w-24 animate-pulse rounded-xl bg-neutral-200" />
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-neutral-200 bg-neutral-50/80 shadow-inner">
        <div className="h-8 rounded-t-2xl bg-neutral-100/80" />
        <ul className="divide-y divide-neutral-200/70">
          {Array.from({ length: 4 }).map((_, i) => (
            <li key={i} className="flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-3">
                <span className="inline-flex size-2.5 rounded-full bg-neutral-200" />
                <div className="h-3 w-32 animate-pulse rounded bg-neutral-200" />
              </div>
              <div className="h-8 w-28 animate-pulse rounded-xl bg-neutral-200" />
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-6 rounded-2xl border border-neutral-200 bg-white/80 p-4 shadow-sm">
        <div className="mb-3 h-4 w-32 animate-pulse rounded bg-neutral-200" />
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="grid grid-cols-6 gap-3">
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
    </section>
  );
}

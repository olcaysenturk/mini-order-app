// app/reports/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

/* -------------------- helpers -------------------- */
type Status = "pending" | "processing" | "completed" | "cancelled" | "workshop";
type FilterKey = "active" | "completed" | "all";
const STATUS_PRESETS: Record<FilterKey, string> = {
  active: "pending,processing,completed",
  completed: "completed",
  all: "pending,processing,completed,cancelled",
};

const fmtMoney = (n: number | undefined | null) =>
  new Intl.NumberFormat("tr-TR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(n ?? 0));
const fmtInt = (n: number | undefined | null) =>
  new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 0 }).format(
    Number(n ?? 0)
  );
const fmtPct = (n: number | undefined | null) =>
  new Intl.NumberFormat("tr-TR", {
    style: "percent",
    maximumFractionDigits: 1,
  }).format(Number(n ?? 0));
const fmtCm = (n: number | undefined | null) =>
  new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 0 }).format(
    Number(n ?? 0)
  );

// Güvenli CSV helpers
const csvEsc = (v: unknown) => `"${String(v).replace(/"/g, '""')}"`;
const rowsToCSV = (rows: (string | number)[][]) =>
  rows.map((r) => r.map(csvEsc).join(",")).join("\n");

/* -------------------- API response types -------------------- */
type OverviewResp = {
  mode: string;
  statuses: Status[];
  currency: "TRY" | string;
  totals: { day: number; week: number; month: number; year: number };
  series30d: { date: string; total: number }[];
};

type PaymentsResp = {
  paid: { amount: number; count: number };
  unpaid: { amount: number; count: number };
  methods: {
    method: "CASH" | "TRANSFER" | "CARD" | string;
    amount: number;
    count: number;
  }[];
  last30dCumulative?: { date: string; paid: number; unpaid: number }[];
};

type CategoriesResp = {
  byCategory: { category: string; amount: number; qty: number }[];
};

type VariantsResp = {
  topVariants: {
    variant: string;
    category?: string;
    amount: number;
    qty: number;
  }[];
};

type CustomersResp = {
  topCustomers: { customer: string; orders: number; amount: number }[];
};

type DailyResp = {
  last30d: { date: string; revenue: number; paid: number }[];
};

type BranchesResp = {
  byBranch: {
    branchId: string | null;
    branch: string;
    code: string | null;
    orders: number;
    revenue: number;
    paid: number;
  }[];
};

type ItemsAggResp = {
  byProduct: {
    group: string;
    qty: number;
    amount: number;
    totalWidthCm: number;
    totalHeightCm: number;
  }[];
};

/* -------------------- page -------------------- */
export default function ReportsPage() {
  const [filter, setFilter] = useState<FilterKey>("active");

  const [over, setOver] = useState<OverviewResp | null>(null);
  const [pay, setPay] = useState<PaymentsResp | null>(null);
  const [cats, setCats] = useState<CategoriesResp | null>(null);
  const [vars, setVars] = useState<VariantsResp | null>(null);
  const [cust, setCust] = useState<CustomersResp | null>(null);
  const [daily, setDaily] = useState<DailyResp | null>(null);
  const [branches, setBranches] = useState<BranchesResp | null>(null);
  const [itemsAgg, setItemsAgg] = useState<ItemsAggResp | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadAll() {
    setLoading(true);
    setError(null);
    try {
      const statusQs = `status=${encodeURIComponent(STATUS_PRESETS[filter])}`;
      const [r1, r2, r3, r4, r5, r6, r7, r8] = await Promise.all([
        fetch(`/api/reports?section=overview&${statusQs}`, { cache: "no-store" }),
        fetch(`/api/reports?section=payments&${statusQs}`, { cache: "no-store" }),
        fetch(`/api/reports?section=categories&${statusQs}`, { cache: "no-store" }),
        fetch(`/api/reports?section=variants&${statusQs}`, { cache: "no-store" }),
        fetch(`/api/reports?section=customers&${statusQs}`, { cache: "no-store" }),
        fetch(`/api/reports?section=daily&${statusQs}`, { cache: "no-store" }),
        fetch(`/api/reports?section=branches&${statusQs}`, { cache: "no-store" }),
        fetch(`/api/reports?section=items_agg&${statusQs}`, { cache: "no-store" }),
      ]);

      setOver(r1.ok ? ((await r1.json()) as OverviewResp) : null);
      setPay(r2.ok ? ((await r2.json()) as PaymentsResp) : null);
      setCats(r3.ok ? ((await r3.json()) as CategoriesResp) : null);
      setVars(r4.ok ? ((await r4.json()) as VariantsResp) : null);
      setCust(r5.ok ? ((await r5.json()) as CustomersResp) : null);
      setDaily(r6.ok ? ((await r6.json()) as DailyResp) : null);
      setBranches(r7.ok ? ((await r7.json()) as BranchesResp) : null);
      setItemsAgg(r8.ok ? ((await r8.json()) as ItemsAggResp) : null);
    } catch (e: any) {
      setError(e?.message || "Bilinmeyen hata");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, [filter]);

  const chartData = useMemo(() => over?.series30d ?? [], [over]);

  // Günlük + Kümülatif liste (ciro) + Günlük alınan/kalan/oran
  const dailyWithCum = useMemo(() => {
    let cumRevenue = 0;
    return (daily?.last30d ?? []).map((d) => {
      const r = Number(d.revenue || 0);
      const p = Number(d.paid || 0);
      cumRevenue += r;
      return {
        ...d,
        cumRevenue,
        unpaid: Math.max(0, r - p),
        ratio: r > 0 ? p / r : 0,
      };
    });
  }, [daily]);

  const dailyTotals = useMemo(() => {
    const days = dailyWithCum.length || 0;
    const revenue = dailyWithCum.reduce((a, b) => a + Number(b.revenue || 0), 0);
    const paid = dailyWithCum.reduce((a, b) => a + Number(b.paid || 0), 0);
    const balance = Math.max(0, revenue - paid);
    const avg = days ? revenue / days : 0;
    return { revenue, paid, balance, avg, days };
  }, [dailyWithCum]);

  // ŞUBE verileri
  const branchData = branches?.byBranch ?? [];
  const branchesWithRatio = useMemo(() => {
    return branchData.map((b) => ({
      ...b,
      ratio: (b.revenue || 0) > 0 ? (b.paid || 0) / b.revenue : 0,
      balance: Math.max(0, (b.revenue || 0) - (b.paid || 0)),
      label: b.code ? `${b.branch} (${b.code})` : b.branch,
    }));
  }, [branchData]);

  const [branchQuery, setBranchQuery] = useState("");
  const [branchSort, setBranchSort] = useState<
    "revenue" | "paid" | "ratio" | "orders" | "balance" | "branch"
  >("revenue");
  const [branchDesc, setBranchDesc] = useState(true);
  const [onlyDebtors, setOnlyDebtors] = useState(false);

  const branchRows = useMemo(() => {
    const q = branchQuery.trim().toLowerCase();
    const filtered = branchesWithRatio.filter(
      (r) =>
        (!q || r.label.toLowerCase().includes(q)) &&
        (!onlyDebtors || r.balance > 0)
    );

    const cmp = (a: any, b: any) => {
      switch (branchSort) {
        case "branch":
          return a.label.localeCompare(b.label, "tr");
        case "orders":
          return (a.orders || 0) - (b.orders || 0);
        case "revenue":
          return (a.revenue || 0) - (b.revenue || 0);
        case "paid":
          return (a.paid || 0) - (b.paid || 0);
        case "balance":
          return (a.balance || 0) - (b.balance || 0);
        case "ratio":
          return (a.ratio || 0) - (b.ratio || 0);
      }
    };
    const sorted = filtered.sort((a, b) =>
      branchDesc ? -cmp(a, b) : cmp(a, b)
    );
    return sorted;
  }, [branchesWithRatio, branchQuery, onlyDebtors, branchSort, branchDesc]);

  const branchTotals = useMemo(() => {
    const revenue = branchRows.reduce((a, b) => a + Number(b.revenue || 0), 0);
    const paid = branchRows.reduce((a, b) => a + Number(b.paid || 0), 0);
    const orders = branchRows.reduce((a, b) => a + Number(b.orders || 0), 0);
    const balance = Math.max(0, revenue - paid);
    const ratio = revenue > 0 ? paid / revenue : 0;
    return { revenue, paid, orders, balance, ratio };
  }, [branchRows]);

  const PIE_COLORS = [
    "#6366F1",
    "#10B981",
    "#F59E0B",
    "#EF4444",
    "#0EA5E9",
    "#A855F7",
    "#84CC16",
  ];

  // CSV indirme: Son 30 gün toplam ciro
  const downloadCSV = () => {
    if (!chartData.length) return;
    const rows: (string | number)[][] = [
      ["Tarih", "Toplam (TRY)"],
      ...chartData.map((x) => [x.date, x.total]),
    ];
    const csv = rowsToCSV(rows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `rapor_son30gun_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // CSV indirme: Günlük ciro + alınan + kalan + oran
  const downloadDailyCSV = () => {
    if (!dailyWithCum.length) return;
    const rows: (string | number)[][] = [
      ["Tarih", "Ciro (TRY)", "Alınan (TRY)", "Kalan (TRY)", "Tahsilat Oranı"],
      ...dailyWithCum.map((d) => [
        d.date,
        d.revenue,
        d.paid,
        d.unpaid,
        (d.ratio || 0).toFixed(4),
      ]),
    ];
    const csv = rowsToCSV(rows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `gunluk_ciro_tahsilat_${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // CSV indirme: Şube bazlı ciro & tahsilat
  const downloadBranchesCSV = () => {
    if (!branchRows.length) return;
    const rows: (string | number)[][] = [
      ["Şube", "Sipariş", "Ciro (TRY)", "Alınan (TRY)", "Tahsilat Oranı", "Kalan (TRY)"],
      ...branchRows.map((b) => [
        b.label,
        b.orders,
        b.revenue,
        b.paid,
        (b.ratio || 0).toFixed(4),
        b.balance,
      ]),
    ];
    const csv = rowsToCSV(rows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sube_ciro_tahsilat_${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const METHOD_TR: Record<string, string> = {
    CASH: "Nakit",
    CARD: "K.Kartı",
    TRANSFER: "Havale",
    BANK_TRANSFER: "Havale/EFT",
    WIRE: "Havale/EFT",
    QR: "QR Ödeme",
    POS: "POS",
    VIRTUAL_POS: "Sanal POS",
    ONLINE_CARD: "Online Kart",
    PAYPAL: "PayPal",
    APPLE_PAY: "Apple Pay",
    GOOGLE_PAY: "Google Pay",
    CRYPTO: "Kripto",
    USDT: "USDT",
    BTC: "Bitcoin",
  };

  return (
    <main className="mx-auto max-w-7xl p-4 sm:p-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight">Raporlar</h1>
        <div className="flex flex-wrap items-center gap-2">
          <div
            role="tablist"
            aria-label="Durum filtresi"
            className="inline-flex rounded-xl border border-neutral-200 bg-white p-0.5"
          >
            {(
              [
                { k: "active", label: "Aktif" },
                { k: "completed", label: "Tamamlanan" },
                { k: "all", label: "Tümü" },
              ] as { k: FilterKey; label: string }[]
            ).map(({ k, label }) => (
              <button
                key={k}
                role="tab"
                aria-selected={filter === k}
                onClick={() => setFilter(k)}
                className={`px-3 py-1.5 text-sm rounded-[10px] transition ${
                  filter === k
                    ? "bg-indigo-600 text-white"
                    : "text-neutral-700 hover:bg-neutral-50"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <button
            className="inline-flex h-9 items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 text-sm text-neutral-700 hover:bg-neutral-50"
            onClick={loadAll}
            disabled={loading}
            title="Yenile"
          >
            <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
              <path
                fill="currentColor"
                d="M12 6V3L8 7l4 4V8a4 4 0 1 1-4 4H6a6 6 0 1 0 6-6z"
              />
            </svg>
            {loading ? "Yükleniyor…" : "Yenile"}
          </button>

          <button
            className="inline-flex h-9 items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 text-sm text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
            onClick={downloadCSV}
            disabled={!chartData.length}
            title="Son 30 gün ciro CSV"
          >
            <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
              <path
                fill="currentColor"
                d="M12 3v10l4-4 1.4 1.4L12 17l-5.4-6.6L8 9l4 4V3zM5 19h14v2H5z"
              />
            </svg>
            Ciro CSV
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </div>
      )}

      {/* Üst metrikler */}
      <section className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <MetricCard label="Bugün"     value={over ? fmtMoney(over.totals.day)   : null} />
        <MetricCard label="Bu Hafta"  value={over ? fmtMoney(over.totals.week)  : null} />
        <MetricCard label="Bu Ay"     value={over ? fmtMoney(over.totals.month) : null} />
        <MetricCard label="Bu Yıl"    value={over ? fmtMoney(over.totals.year)  : null} />
      </section>

      {/* Günlük Ciro + Alınan + Kümülatif Ciro */}
      <section className="mb-6 rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <div className="text-sm font-semibold">
            Günlük Ciro &amp; Alınan + Kümülatif (Son 30 Gün)
          </div>
          <div className="ms-auto flex items-center gap-2">
            <button
              className="inline-flex h-9 items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 text-sm text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
              onClick={downloadDailyCSV}
              disabled={!dailyWithCum.length}
              title="Günlük ciro & tahsilat CSV indir"
            >
              <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
                <path
                  fill="currentColor"
                  d="M12 3v10l4-4 1.4 1.4L12 17l-5.4-6.6L8 9l4 4V3zM5 19h14v2H5z"
                />
              </svg>
              CSV
            </button>
          </div>
        </div>

        <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
          <SummaryTile label="Toplam Ciro"           value={`${fmtMoney(dailyTotals.revenue)} ₺`} />
          <SummaryTile label="Toplam Alınan"         value={`${fmtMoney(dailyTotals.paid)} ₺`} />
          <SummaryTile label="Toplam Kalan"          value={`${fmtMoney(dailyTotals.balance)} ₺`} tone="amber" />
          <SummaryTile label="Günlük Ortalama Ciro"  value={`${fmtMoney(dailyTotals.avg)} ₺`}    tone="indigo" />
        </div>

        {!dailyWithCum.length ? (
          <SkeletonBox />
        ) : (
          <>
            <div className="h-[320px] w-full">
              <ResponsiveContainer>
                <ComposedChart data={dailyWithCum}>
                  <CartesianGrid stroke="#E5E7EB" strokeDasharray="3 3" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} minTickGap={16} tickLine={false} axisLine={{ stroke: "#E5E7EB" }} />
                  <YAxis tickFormatter={(v) => fmtMoney(Number(v))} width={80} tickLine={false} axisLine={{ stroke: "#E5E7EB" }} />
                  <Tooltip
                    formatter={(v: any, name: string) => {
                      const map: Record<string, string> = {
                        revenue: "Günlük Ciro",
                        paid: "Günlük Alınan",
                        cumRevenue: "Kümülatif Ciro",
                      };
                      return [`${fmtMoney(Number(v))} ₺`, map[name] ?? name];
                    }}
                    contentStyle={{ borderRadius: 12, borderColor: "#E5E7EB" }}
                    labelFormatter={(d) => `Tarih: ${d}`}
                  />
                  <defs>
                    <linearGradient id="barFillRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#6366F1" />
                      <stop offset="100%" stopColor="#A78BFA" />
                    </linearGradient>
                    <linearGradient id="barFillPaid" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10B981" />
                      <stop offset="100%" stopColor="#34D399" />
                    </linearGradient>
                  </defs>
                  <Bar dataKey="revenue" name="Günlük Ciro"   fill="url(#barFillRevenue)" radius={[8, 8, 0, 0]} />
                  <Bar dataKey="paid"    name="Günlük Alınan" fill="url(#barFillPaid)"    radius={[8, 8, 0, 0]} />
                  <Line type="monotone" dataKey="cumRevenue" name="Kümülatif Ciro" dot={false} stroke="#0EA5E9" strokeWidth={2} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            {/* Günlük tablo */}
            {/* <div className="mt-4 overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="[&>th]:px-3 [&>th]:py-2 text-left text-neutral-500">
                    <th>Tarih</th>
                    <th className="text-right">Ciro</th>
                    <th className="text-right">Alınan</th>
                    <th className="text-right">Kalan</th>
                    <th className="text-right">Tahsilat Oranı</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {dailyWithCum.map((d) => (
                    <tr key={d.date} className="[&>td]:px-3 [&>td]:py-2">
                      <td className="font-medium">{d.date}</td>
                      <td className="text-right">{fmtMoney(d.revenue)} ₺</td>
                      <td className="text-right">{fmtMoney(d.paid)} ₺</td>
                      <td className="text-right">{fmtMoney(d.unpaid)} ₺</td>
                      <td className="text-right">{fmtPct(d.ratio)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div> */}
          </>
        )}
      </section>

      {/* Şube Bazlı Ciro & Tahsilat */}
      <section className="mb-6 rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <div className="text-sm font-semibold">Şube Bazlı Ciro &amp; Tahsilat</div>
          <div className="ms-auto flex flex-wrap items-center gap-2">
            <div className="relative">
              <input
                className="h-9 w-56 rounded-xl border border-neutral-200 bg-white px-3 pe-8 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                placeholder="Şube ara"
                value={branchQuery}
                onChange={(e) => setBranchQuery(e.target.value)}
                aria-label="Şube ara"
              />
              <svg
                className="pointer-events-none absolute right-2 top-1/2 size-4 -translate-y-1/2 text-neutral-400"
                viewBox="0 0 24 24"
                aria-hidden
              >
                <path
                  fill="currentColor"
                  d="M10 4a6 6 0 1 1 3.9 10.6l3.8 3.8-1.4 1.4-3.8-3.8A6 6 0 0 1 10 4m0 2a4 4 0 1 0 0 8a4 4 0 0 0 0-8z"
                />
              </svg>
            </div>

            <label className="inline-flex cursor-pointer select-none items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50">
              <input
                type="checkbox"
                className="size-4 accent-indigo-600"
                checked={onlyDebtors}
                onChange={(e) => setOnlyDebtors(e.target.checked)}
              />
              Borcu olanlar
            </label>

            <div className="inline-flex items-center gap-1">
              <select
                className="h-9 rounded-xl border border-neutral-200 bg-white px-3 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                value={branchSort}
                onChange={(e) => setBranchSort(e.target.value as any)}
                aria-label="Sırala"
              >
                <option value="revenue">Ciro (₺)</option>
                <option value="paid">Alınan (₺)</option>
                <option value="balance">Kalan (₺)</option>
                <option value="ratio">Tahsilat Oranı</option>
                <option value="orders">Sipariş</option>
                <option value="branch">Şube Adı</option>
              </select>
              <button
                type="button"
                onClick={() => setBranchDesc((s) => !s)}
                className="inline-flex h-9 items-center rounded-xl border border-neutral-200 bg-white px-2 text-sm text-neutral-700 hover:bg-neutral-50"
                title={branchDesc ? "Azalan" : "Artan"}
                aria-label={branchDesc ? "Azalan sırala" : "Artan sırala"}
              >
                <svg
                  viewBox="0 0 24 24"
                  className={`size-4 transition-transform ${branchDesc ? "" : "rotate-180"}`}
                  aria-hidden
                >
                  <path fill="currentColor" d="M7 10l5 5 5-5H7z" />
                </svg>
              </button>
            </div>

            <button
              className="inline-flex h-9 items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 text-sm text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
              onClick={downloadBranchesCSV}
              disabled={!branchRows.length}
              title="Şube CSV indir"
            >
              <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
                <path
                  fill="currentColor"
                  d="M12 3v10l4-4 1.4 1.4L12 17l-5.4-6.6L8 9l4 4V3zM5 19h14v2H5z"
                />
              </svg>
              CSV
            </button>
          </div>
        </div>

        <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
          <SummaryTile label="Toplam Ciro"   value={`${fmtMoney(branchTotals.revenue)} ₺`} />
          <SummaryTile label="Toplam Alınan" value={`${fmtMoney(branchTotals.paid)} ₺`} />
          <SummaryTile label="Toplam Kalan"  value={`${fmtMoney(branchTotals.balance)} ₺`} tone="amber" />
          <SummaryTile label="Ort. Tahsilat Oranı" value={fmtPct(branchTotals.ratio)} tone="indigo" />
        </div>

        {!branchesWithRatio.length ? (
          <SkeletonBox />
        ) : branchRows.length === 0 ? (
          <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-700">
            Kriterlere uyan şube bulunamadı.
          </div>
        ) : (
          <ul className="divide-y rounded-xl border border-neutral-200">
            {branchRows.map((b, i) => (
              <li key={`${b.branchId ?? b.label}-${i}`} className="p-3 sm:p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <div className="truncate text-sm font-semibold">{b.label}</div>
                      <RatioBadge ratio={b.ratio} />
                    </div>
                    <div className="mt-0.5 text-xs text-neutral-600">{fmtInt(b.orders)} sipariş</div>
                  </div>

                  <div className="grid w-full grid-cols-3 items-end gap-3 sm:w-auto sm:min-w-[420px] sm:grid-cols-4">
                    <KPI label="Ciro"   value={`${fmtMoney(b.revenue)} ₺`} />
                    <KPI label="Alınan" value={`${fmtMoney(b.paid)} ₺`} />
                    <KPI label="Kalan"  value={`${fmtMoney(b.balance)} ₺`} tone={b.balance > 0 ? "amber" : "neutral"} />
                    <KPI label="Oran"   value={fmtPct(b.ratio)} />
                  </div>
                </div>

                <div className="mt-3">
                  <Progress value={Math.max(0, Math.min(100, Math.round((b.ratio || 0) * 100)))} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Ödemeler */}
      <section className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
          <div className="mb-3 text-sm font-semibold">Ödeme Durumu</div>
          {!pay ? (
            <SkeletonBox />
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <StatTile title="Ödenen"  amount={fmtMoney(pay.paid?.amount)}  count={fmtInt(pay.paid?.count)}  accent="emerald" />
              <StatTile title="Bekleyen" amount={fmtMoney(pay.unpaid?.amount)} count={fmtInt(pay.unpaid?.count)} accent="rose" />
              <div className="col-span-2 mt-2 text-xs text-neutral-600">
                {pay.last30dCumulative?.length
                  ? "Son 30 gün kümülatif görünüm sağ sütunda."
                  : "Detay grafiği mevcut değil."}
              </div>
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
          <div className="mb-3 text-sm font-semibold">Ödeme Yöntemi Dağılımı</div>
          {!pay || !pay.methods?.length ? (
            <SkeletonBox />
          ) : (
            <div className="h-[260px] w-full">
              <ResponsiveContainer>
                <PieChart>
                  <Pie dataKey="amount" data={pay.methods} innerRadius={50} outerRadius={80} label>
                    {pay.methods.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: any) => `${fmtMoney(Number(v))} ₺`} />
                  <Legend
                    verticalAlign="bottom"
                    align="center"
                    iconType="circle"
                    formatter={(value, entry: any) => METHOD_TR[entry?.payload?.method] ?? value}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </section>

      {/* Kategoriler & Ürün toplamları */}
      <section className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
          <div className="mb-3 text-sm font-semibold">Kategori Bazlı Satış (₺)</div>
          {!cats?.byCategory?.length ? (
            <SkeletonBox />
          ) : (
            <div className="h-[300px]">
              <ResponsiveContainer>
                <BarChart data={cats.byCategory}>
                  <CartesianGrid stroke="#E5E7EB" strokeDasharray="3 3" />
                  <XAxis dataKey="category" tick={{ fontSize: 11 }} interval={0} angle={-10} height={60} tickLine={false} axisLine={{ stroke: "#E5E7EB" }} />
                  <YAxis tickFormatter={(v) => fmtMoney(Number(v))} width={80} tickLine={false} axisLine={{ stroke: "#E5E7EB" }} />
                  <Tooltip formatter={(v: any) => `${fmtMoney(Number(v))} ₺`} contentStyle={{ borderRadius: 12, borderColor: "#E5E7EB" }} />
                  <defs>
                    <linearGradient id="barFillCategory" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#6366F1" />
                      <stop offset="100%" stopColor="#A78BFA" />
                    </linearGradient>
                  </defs>
                  <Bar dataKey="amount" fill="url(#barFillCategory)" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Ürün Toplamları (cm) */}
        <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
          <div className="mb-3 text-sm font-semibold">Ürün Bazlı Satış (cm)</div>
          {!itemsAgg?.byProduct?.length ? (
            <SkeletonBox />
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="[&>th]:px-3 [&>th]:py-2 text-left text-neutral-500">
                    <th>Ürün Grubu</th>
                    <th className="text-right">Adet</th>
                    <th className="text-right">Toplam En</th>
                    <th className="text-right">Toplam Boy</th>
                    <th className="text-right">Tutar</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {itemsAgg.byProduct.map((p, i) => (
                    <tr key={i} className="[&>td]:px-3 [&>td]:py-2">
                      <td className="font-medium">{p.group}</td>
                      <td className="text-right">{fmtInt(p.qty)}</td>
                      <td className="text-right">{fmtCm(p.totalWidthCm / 100)} m</td>
                      <td className="text-right">{fmtCm(p.totalHeightCm / 100)} m</td>
                      <td className="text-right">{fmtMoney(p.amount)} ₺</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {/* En çok müşteri */}
      <section className="mb-6 rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
        <div className="mb-3 text-sm font-semibold">En Çok Sipariş Veren Müşteriler</div>
        {!cust?.topCustomers?.length ? (
          <SkeletonBox />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="[&>th]:px-3 [&>th]:py-2 text-left text-neutral-500">
                  <th>Müşteri</th>
                  <th className="text-right">Sipariş</th>
                  <th className="text-right">Tutar</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {cust.topCustomers.map((c, i) => (
                  <tr key={i} className="[&>td]:px-3 [&>td]:py-2">
                    <td className="font-medium">{c.customer}</td>
                    <td className="text-right">{fmtInt(c.orders)}</td>
                    <td className="text-right">{fmtMoney(c.amount)} ₺</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}

/* -------------------- küçük komponentler -------------------- */
function MetricCard({ label, value }: { label: string; value: string | null }) {
  const loading = value === null;
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
      <div className="mb-1 flex items-center gap-1.5 text-xs text-neutral-500">
        <svg viewBox="0 0 24 24" className="size-3.5" aria-hidden>
          <path fill="currentColor" d="M4 20h16v-2H4zM6 16h3V8H6zm5 0h3V4h-3zm5 0h3v-6h-3z" />
        </svg>
        {label}
      </div>
      {loading ? (
        <div className="h-6 w-24 animate-pulse rounded bg-neutral-200" />
      ) : (
        <div className="text-lg font-semibold tracking-wide">{value} ₺</div>
      )}
    </div>
  );
}

function SkeletonBox() {
  return <div className="h-[260px] w-full animate-pulse rounded-xl bg-neutral-100" />;
}

function StatTile({
  title,
  amount,
  count,
  accent = "indigo",
}: {
  title: string;
  amount: string;
  count: string;
  accent?: "indigo" | "emerald" | "rose";
}) {
  const tone =
    accent === "emerald"
      ? "text-emerald-700 bg-emerald-50 border-emerald-200"
      : accent === "rose"
      ? "text-rose-700 bg-rose-50 border-rose-200"
      : "text-indigo-700 bg-indigo-50 border-indigo-200";
  return (
    <div className={`rounded-xl border ${tone} p-3`}>
      <div className="text-xs">{title}</div>
      <div className="mt-1 text-base font-semibold">{amount} ₺</div>
      <div className="text-xs">({count} sipariş)</div>
    </div>
  );
}

function SummaryTile({
  label,
  value,
  tone = "emerald",
}: {
  label: string;
  value: string;
  tone?: "emerald" | "amber" | "indigo";
}) {
  const map = {
    emerald: "text-emerald-700 bg-emerald-50 border-emerald-200",
    amber: "text-amber-700 bg-amber-50 border-amber-200",
    indigo: "text-indigo-700 bg-indigo-50 border-indigo-200",
  } as const;
  return (
    <div className={`rounded-2xl border ${map[tone]} p-3`}>
      <div className="text-xs">{label}</div>
      <div className="mt-1 text-base font-semibold">{value}</div>
    </div>
  );
}

function KPI({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "neutral" | "amber";
}) {
  const cls = tone === "amber" ? "text-amber-700" : "text-neutral-900";
  return (
    <div className="min-w-0 text-right">
      <div className="text-[11px] text-neutral-500">{label}</div>
      <div className={`truncate text-sm font-semibold ${cls}`}>{value}</div>
    </div>
  );
}

function Progress({ value }: { value: number }) {
  return (
    <div className="h-2 rounded-full bg-neutral-100">
      <div
        className="h-2 rounded-full bg-emerald-500 transition-[width] duration-300"
        style={{ width: `${value}%` }}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={value}
        role="progressbar"
      />
    </div>
  );
}

function RatioBadge({ ratio }: { ratio: number }) {
  const pct = Math.round((ratio || 0) * 100);
  let tone = "bg-neutral-100 text-neutral-700 ring-neutral-200";
  if (pct >= 90) tone = "bg-emerald-50 text-emerald-700 ring-emerald-200";
  else if (pct >= 50) tone = "bg-amber-50 text-amber-700 ring-amber-200";
  else tone = "bg-rose-50 text-rose-700 ring-rose-200";
  return (
    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${tone}`}>
      {pct}% tahsilat
    </span>
  );
}

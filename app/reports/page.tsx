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

// Güvenli CSV helpers
const csvEsc = (v: unknown) => `"${String(v).replace(/"/g, '""')}"`;
const rowsToCSV = (rows: (string | number)[][]) =>
  rows.map((r) => r.map(csvEsc).join(",")).join("\n");

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

type BranchOpt = { id: string; name: string; code: string | null };

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

// KALDIRILDI: CustomersResp

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

/** Ürünler (sayfalı) */
type ProductRow = {
  product: string;
  qty: number;
  areaM2: number;
  amount: number;
};
type ProductsResp = {
  rows: ProductRow[];
  total: number;
  page: number;
  pageSize: number;
};

/** Günlük liste (şube + tarih aralığı) */
type BranchDailyRow = { date: string; revenue: number; paid: number };
type MethodsByDateRow = { date: string; method: string; amount: number };

/* -------------------- page -------------------- */
export default function ReportsPage() {
  const [filter, setFilter] = useState<FilterKey>("active");
  const [loading, setLoading] = useState(false);

  const [over, setOver] = useState<OverviewResp | null>(null);
  const [pay, setPay] = useState<PaymentsResp | null>(null);
  const [cats, setCats] = useState<CategoriesResp | null>(null);
  const [vars, setVars] = useState<VariantsResp | null>(null);
  const [daily, setDaily] = useState<DailyResp | null>(null);
  const [branches, setBranches] = useState<BranchesResp | null>(null);
  const [itemsAgg, setItemsAgg] = useState<ItemsAggResp | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Şube seçim
  const [branch, setBranch] = useState<string>("all");
  const [branchOptions, setBranchOptions] = useState<BranchOpt[]>([]);

  // Tarih aralığı (default: bugün dahil SON 10 gün)
  const today = new Date();
  const toIso = (d: Date) => d.toISOString().slice(0, 10);
  const [dateFrom, setDateFrom] = useState<string>(() => {
    const d = new Date(); d.setDate(d.getDate() - 9); return toIso(d);
  });
  const [dateTo, setDateTo] = useState<string>(() => toIso(today));

  // Şube bazlı günlük liste + ödeme tipleri
  const [branchDaily, setBranchDaily] = useState<BranchDailyRow[]>([]);
  const [methodsByDate, setMethodsByDate] = useState<Map<string, MethodsByDateRow[]>>(new Map());
  const [loadingDaily, setLoadingDaily] = useState(false);

  // ÜRÜNLER (sayfalı)
  const [products, setProducts] = useState<ProductsResp | null>(null);
  const [prodLoading, setProdLoading] = useState(false);
  const [prodQuery, setProdQuery] = useState("");
  const [prodSort, setProdSort] = useState<"amount" | "qty" | "area" | "product">("amount");
  const [prodDesc, setProdDesc] = useState(true);
  const [prodPage, setProdPage] = useState(1);
  const [prodPageSize, setProdPageSize] = useState(20);

  const PIE_COLORS = ["#6366F1","#10B981","#F59E0B","#EF4444","#0EA5E9","#A855F7","#84CC16"];

  // Yükleme overlay
  const showOverlay = loading;

  async function loadAll() {
    setLoading(true);
    setError(null);
    try {
      const statusQs = `status=${encodeURIComponent(STATUS_PRESETS[filter])}`;
      const [r1, r2, r3, r4, r6, r7, r8] = await Promise.all([
        fetch(`/api/reports?section=overview&${statusQs}`, { cache: "no-store" }),
        fetch(`/api/reports?section=payments&${statusQs}`, { cache: "no-store" }),
        fetch(`/api/reports?section=categories&${statusQs}`, { cache: "no-store" }),
        fetch(`/api/reports?section=variants&${statusQs}`, { cache: "no-store" }),
        fetch(`/api/reports?section=daily&${statusQs}`, { cache: "no-store" }),
        fetch(`/api/reports?section=branches&${statusQs}`, { cache: "no-store" }),
        fetch(`/api/reports?section=items_agg&${statusQs}`, { cache: "no-store" }),
      ]);

      setOver(r1.ok ? ((await r1.json()) as OverviewResp) : null);
      setPay(r2.ok ? ((await r2.json()) as PaymentsResp) : null);
      setCats(r3.ok ? ((await r3.json()) as CategoriesResp) : null);
      setVars(r4.ok ? ((await r4.json()) as VariantsResp) : null);
      setDaily(r6.ok ? ((await r6.json()) as DailyResp) : null);
      setBranches(r7.ok ? ((await r7.json()) as BranchesResp) : null);
      setItemsAgg(r8.ok ? ((await r8.json()) as ItemsAggResp) : null);
    } catch (e: any) {
      setError(e?.message || "Bilinmeyen hata");
    } finally {
      setLoading(false);
    }
  }

  // Ürünleri çek (sayfalı)
  async function loadProducts(page = prodPage, pageSize = prodPageSize) {
    setProdLoading(true);
    try {
      const qs = new URLSearchParams({
        section: "products",
        status: STATUS_PRESETS[filter],
        page: String(page),
        pageSize: String(pageSize),
        q: prodQuery.trim(),
        sort: prodSort,
        dir: prodDesc ? "desc" : "asc",
      }).toString();
      const r = await fetch(`/api/reports?${qs}`, { cache: "no-store" });
      setProducts(r.ok ? ((await r.json()) as ProductsResp) : { rows: [], total: 0, page, pageSize });
    } finally {
      setProdLoading(false);
    }
  }

  // Şube listesi
  async function loadBranchOptions() {
    try {
      const r = await fetch(`/api/branches?all=1`, { cache: "no-store" });
      if (!r.ok) return setBranchOptions([]);
      const j = await r.json();
      const items = Array.isArray(j?.items) ? j.items : [];
      const opts = items.map((x: any) => ({
        id: String(x.id),
        name: String(x.name ?? "Şube"),
        code: x.code ? String(x.code) : null,
      })) as BranchOpt[];
      setBranchOptions(opts);
    } catch {
      setBranchOptions([]);
    }
  }

  // İlk yüklemeler
  useEffect(() => { loadBranchOptions(); }, []);
  useEffect(() => { loadAll(); }, [filter]);

  // Ürün sorguları (filter/sort/search/page değişince)
  useEffect(() => {
    setProdPage(1); // filtre/sort/değişince başa dön
  }, [filter, prodQuery, prodSort, prodDesc, prodPageSize]);
  useEffect(() => {
    loadProducts(prodPage, prodPageSize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, prodPage, prodPageSize, prodQuery, prodSort, prodDesc]);

  // Grafik datası
  const chartData = useMemo(() => over?.series30d ?? [], [over]);

  // Şube bazlı tarih aralığı verisini çek (yalnızca branch !== all)
  useEffect(() => {
    const run = async () => {
      if (branch === "all") { setBranchDaily([]); setMethodsByDate(new Map()); return; }
      if (!dateFrom || !dateTo) return;
      setLoadingDaily(true);
      try {
        // Günlük ciro & alınan
        const q = new URLSearchParams({ section: "daily_by_branch", branchId: branch, from: dateFrom, to: dateTo }).toString();
        const r1 = await fetch(`/api/reports?${q}`, { cache: "no-store" });
        const j1 = r1.ok ? await r1.json() : { lastByBranch: [] };
        const rows: BranchDailyRow[] = Array.isArray(j1?.lastByBranch) ? j1.lastByBranch : [];
        rows.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)); // bugün en başta
        setBranchDaily(rows);

        // Ödeme tipleri (gün bazlı)
        const q2 = new URLSearchParams({ section: "methods_by_date", branchId: branch, from: dateFrom, to: dateTo }).toString();
        const r2 = await fetch(`/api/reports?${q2}`, { cache: "no-store" });
        const j2 = r2.ok ? await r2.json() : { methods: [] };
        const list: MethodsByDateRow[] = Array.isArray(j2?.methods) ? j2.methods : [];
        const map = new Map<string, MethodsByDateRow[]>();
        for (const m of list) {
          if (!map.has(m.date)) map.set(m.date, []);
          map.get(m.date)!.push(m);
        }
        setMethodsByDate(map);
      } finally {
        setLoadingDaily(false);
      }
    };
    run();
  }, [branch, dateFrom, dateTo]);

  // Şube bazlı liste (UI data)
  const dailyInRange = branchDaily;

  // Üst metrikler için placeholder loading
  const metricsLoading = !over;

  // Şube bazlı özet
  const branchData = branches?.byBranch ?? [];
  const [branchQuery, setBranchQuery] = useState("");
  const [branchSort, setBranchSort] = useState<"revenue" | "paid" | "orders" | "branch">("revenue");
  const [branchDesc, setBranchDesc] = useState(true);

  const branchesWithBasic = useMemo(() => {
    return branchData.map((b) => ({
      ...b,
      label: b.code ? `${b.branch} (${b.code})` : b.branch,
    }));
  }, [branchData]);

  const branchRows = useMemo(() => {
    const q = branchQuery.trim().toLowerCase();
    const filtered = branchesWithBasic.filter((r) => (!q || r.label.toLowerCase().includes(q)));
    const cmp = (a: any, b: any) => {
      switch (branchSort) {
        case "branch":  return a.label.localeCompare(b.label, "tr");
        case "orders":  return (a.orders || 0) - (b.orders || 0);
        case "revenue": return (a.revenue || 0) - (b.revenue || 0);
        case "paid":    return (a.paid || 0) - (b.paid || 0);
      }
    };
    const sorted = filtered.sort((a, b) => (branchDesc ? -cmp(a, b) : cmp(a, b)));
    return sorted;
  }, [branchesWithBasic, branchQuery, branchSort, branchDesc]);

  /* -------------------- UI -------------------- */
  return (
    <main className="relative mx-auto max-w-7xl p-4 sm:p-6">
      {/* Loading overlay */}
      {showOverlay && (
        <div className="pointer-events-none absolute inset-0 z-50 flex items-start justify-center rounded-2xl bg-white/60 backdrop-blur-sm">
          <div className="flex items-center gap-3 rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm text-neutral-700 shadow-sm">
            <svg className="size-4 animate-spin" viewBox="0 0 24 24" aria-hidden>
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" fill="none" opacity=".2" />
              <path d="M22 12a10 10 0 0 1-10 10" fill="none" stroke="currentColor" strokeWidth="3" />
            </svg>
            Yükleniyor…
          </div>
        </div>
      )}

      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight">Raporlar</h1>
          {/* Şube seçimi */}
          <div className="inline-flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-2 py-1">
            <span className="text-xs text-neutral-500">Şube</span>
            <select
              className="h-8 rounded-lg border border-neutral-200 bg-white px-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
            >
              <option value="all">Tüm şubeler</option>
              {(Array.isArray(branchOptions) ? branchOptions : []).map((b) => (
                <option key={b.id} value={b.id}>
                  {b.code ? `${b.name} (${b.code})` : b.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div
            role="tablist"
            aria-label="Durum filtresi"
            className="inline-flex rounded-xl border border-neutral-200 bg-white p-0.5"
          >
            {([
              { k: "active", label: "Aktif" },
              { k: "completed", label: "Tamamlanan" },
              { k: "all", label: "Tümü" },
            ] as { k: FilterKey; label: string }[]).map(({ k, label }) => (
              <button
                key={k}
                role="tab"
                aria-selected={filter === k}
                onClick={() => setFilter(k)}
                className={`px-3 py-1.5 text-sm rounded-[10px] transition ${
                  filter === k ? "bg-indigo-600 text-white" : "text-neutral-700 hover:bg-neutral-50"
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
              <path fill="currentColor" d="M12 6V3L8 7l4 4V8a4 4 0 1 1-4 4H6a6 6 0 1 0 6-6z" />
            </svg>
            {loading ? "Yükleniyor…" : "Yenile"}
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
        <MetricCard label="Bugün"     value={over ? fmtMoney(over.totals.day) : null} />
        <MetricCard label="Bu Hafta"  value={over ? fmtMoney(over.totals.week) : null} />
        <MetricCard label="Bu Ay"     value={over ? fmtMoney(over.totals.month) : null} />
        <MetricCard label="Bu Yıl"    value={over ? fmtMoney(over.totals.year) : null} />
      </section>

      {/* Şube Bazlı Ciro */}
      <section className="mb-6 rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <div className="text-sm font-semibold">Şube Bazlı Ciro</div>
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

            <div className="inline-flex items-center gap-1">
              <select
                className="h-9 rounded-xl border border-neutral-200 bg-white px-3 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                value={branchSort}
                onChange={(e) => setBranchSort(e.target.value as any)}
                aria-label="Sırala"
              >
                <option value="revenue">Ciro (₺)</option>
                <option value="paid">Alınan (₺)</option>
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
          </div>
        </div>

        {!branchesWithBasic.length ? (
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
                    <div className="truncate text-sm font-semibold">{b.label}</div>
                    <div className="mt-0.5 text-xs text-neutral-600">{fmtInt(b.orders)} sipariş</div>
                  </div>
                  <div className="grid w-full grid-cols-2 items-end gap-3 sm:w-auto sm:min-w-[320px] sm:grid-cols-2">
                    <KPI label="Ciro"   value={`${fmtMoney(b.revenue)} ₺`} />
                    <KPI label="Alınan" value={`${fmtMoney(b.paid)} ₺`} />
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* === YENİ: Tarih Aralığı – Şube Bazlı Günlük Ciro & Alınan (Liste) === */}
      {branch !== "all" && (
        <section className="mb-6 rounded-2xl border border-neutral-200 bg-white shadow-sm">
          {/* Sticky toolbar */}
          <div className="sticky top-[64px] z-20 rounded-t-2xl border-b border-neutral-200 bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/70">
            <div className="flex flex-wrap items-center gap-3 p-3 sm:p-4">
              <div className="flex min-w-0 flex-col">
                <span className="text-[11px] uppercase tracking-wide text-neutral-500">Günlük Liste</span>
                <h2 className="truncate text-sm font-semibold text-neutral-900">
                  Tarih Aralığı – Şube Bazlı Ciro &amp; Kasa
                </h2>
              </div>

              <div className="ms-auto flex flex-wrap items-center gap-2">
                <DateChip label="Başlangıç" value={dateFrom} onChange={setDateFrom} max={dateTo || undefined} />
                <DateChip label="Bitiş" value={dateTo} onChange={setDateTo} min={dateFrom || undefined} />

                <button
                  className="inline-flex h-9 items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 text-sm text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
                  onClick={() => {
                    if (!dailyInRange.length) return;
                    const rows: (string | number)[][] = [
                      ["Tarih", "Ciro (TRY)", "Alınan (TRY)", "Ödeme Tipleri"],
                      ...dailyInRange.map((d) => {
                        const meth = (methodsByDate.get(d.date) ?? [])
                          .map((m) => `${METHOD_TR[m.method] ?? m.method}:${fmtMoney(m.amount)}`)
                          .join(" | ");
                        return [d.date, d.revenue, d.paid, meth];
                      }),
                    ];
                    const csv = rowsToCSV(rows);
                    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `gunluk_ciro_${new Date().toISOString().slice(0, 10)}.csv`;
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                  disabled={!dailyInRange.length}
                  title="Günlük liste CSV"
                >
                  <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
                    <path fill="currentColor" d="M12 3v10l4-4 1.4 1.4L12 17l-5.4-6.6L8 9l4 4V3zM5 19h14v2H5z" />
                  </svg>
                  CSV
                </button>
              </div>
            </div>
          </div>

          {/* Totals strip */}
          <div className="grid gap-3 border-b border-neutral-200 p-3 sm:grid-cols-3 sm:p-4">
            <Tile label="Seçili Tarih Aralığı" value={`${dateFrom} → ${dateTo}`} mono />
            <Tile
              label="Toplam Ciro"
              value={`${fmtMoney(dailyInRange.reduce((a, b) => a + Number(b.revenue || 0), 0))} ₺`}
            />
            <Tile
              label="Toplam Kasa"
              value={`${fmtMoney(dailyInRange.reduce((a, b) => a + Number(b.paid || 0), 0))} ₺`}
            />
          </div>

          {/* Content */}
          {loadingDaily ? (
            <div className="p-4"><SkeletonBox /></div>
          ) : !dailyInRange.length ? (
            <div className="p-4">
              <div className="h-[220px] rounded-2xl border border-dashed border-neutral-300 bg-neutral-50/70 p-6 text-center">
                <div className="mx-auto mb-2 mt-6 size-10 rounded-full border border-neutral-200 bg-white p-2">
                  <svg viewBox="0 0 24 24" className="size-6 text-neutral-500" aria-hidden>
                    <path fill="currentColor" d="M19 4h-1V2h-2v2H8V2H6v2H5a2 2 0 0 0-2 2v13a3 3 0 0 0 3 3h12a3 3 0 0 0 3-3V6a2 2 0 0 0-2-2m0 15a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V9h14z" />
                  </svg>
                </div>
                <div className="text-sm font-medium text-neutral-800">Kayıt bulunamadı</div>
                <div className="mt-1 text-xs text-neutral-600">Tarih aralığını daraltmayı veya farklı bir aralık seçmeyi deneyin.</div>
              </div>
            </div>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden sm:block">
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="sticky top-0 z-10 bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/70">
                        <th className="px-3 py-2 text-left text-[12px] font-medium uppercase tracking-wide text-neutral-500">Tarih</th>
                        <th className="px-3 py-2 text-right text-[12px] font-medium uppercase tracking-wide text-neutral-500">Ciro</th>
                        <th className="px-3 py-2 text-right text-[12px] font-medium uppercase tracking-wide text-neutral-500">Kasa</th>
                        <th className="px-3 py-2 text-left text-[12px] font-medium uppercase tracking-wide text-neutral-500">Ödeme Tipleri</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100">
                      {dailyInRange.map((d) => {
                        const methods = methodsByDate.get(d.date) ?? [];
                        return (
                          <tr key={d.date} className="hover:bg-neutral-50">
                            <td className="px-3 py-2 font-medium text-neutral-900 whitespace-nowrap">{d.date}</td>
                            <td className="px-3 py-2 text-right tabular-nums">{fmtMoney(d.revenue)} ₺</td>
                            <td className="px-3 py-2 text-right tabular-nums">{fmtMoney(d.paid)} ₺</td>
                            <td className="px-3 py-2">
                              {methods.length === 0 ? (
                                <span className="text-xs text-neutral-500">—</span>
                              ) : (
                                <div className="flex flex-wrap gap-1.5">
                                  {methods.map((m, i) => (
                                    <MethodPill key={i} label={METHOD_TR[m.method] ?? m.method} amount={fmtMoney(m.amount)} />
                                  ))}
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="bg-neutral-50/60">
                        <td className="px-3 py-2 text-xs font-medium text-neutral-600">Toplam</td>
                        <td className="px-3 py-2 text-right text-sm font-semibold">
                          {fmtMoney(dailyInRange.reduce((a, b) => a + Number(b.revenue || 0), 0))} ₺
                        </td>
                        <td className="px-3 py-2 text-right text-sm font-semibold">
                          {fmtMoney(dailyInRange.reduce((a, b) => a + Number(b.paid || 0), 0))} ₺
                        </td>
                        <td className="px-3 py-2" />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* Mobile cards */}
              <div className="divide-y sm:hidden">
                {dailyInRange.map((d) => {
                  const methods = methodsByDate.get(d.date) ?? [];
                  return (
                    <div key={d.date} className="p-3">
                      <div className="mb-2 flex items-center justify-between">
                        <div className="text-sm font-semibold">{d.date}</div>
                        <div className="text-xs text-neutral-500">Gün</div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2">
                          <div className="text-[11px] text-neutral-500">Ciro</div>
                          <div className="text-sm font-semibold">{fmtMoney(d.revenue)} ₺</div>
                        </div>
                        <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2">
                          <div className="text-[11px] text-neutral-500">Alınan</div>
                          <div className="text-sm font-semibold">{fmtMoney(d.paid)} ₺</div>
                        </div>
                      </div>
                      <div className="mt-2">
                        <div className="mb-1 text-[11px] font-medium text-neutral-500">Ödeme Tipleri</div>
                        {methods.length === 0 ? (
                          <div className="text-xs text-neutral-500">—</div>
                        ) : (
                          <div className="flex flex-wrap gap-1.5">
                            {methods.map((m, i) => (
                              <MethodPill key={i} label={METHOD_TR[m.method] ?? m.method} amount={fmtMoney(m.amount)} />
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </section>
      )}

      {/* Günlük Ciro + Alınan + Kümülatif Ciro (Son 30 Gün) */}
      <section className="mb-6 rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
        <div className="mb-3 text-sm font-semibold">
          Günlük Ciro &amp; Alınan + Kümülatif (Son 30 Gün)
        </div>

        {!daily?.last30d?.length ? (
          <SkeletonBox />
        ) : (
          <div className="h-[320px] w-full">
            <ResponsiveContainer>
              <ComposedChart
                data={(() => {
                  // kümülatif revenue hesapla
                  let cumRevenue = 0;
                  return (daily?.last30d ?? []).map((d) => {
                    cumRevenue += Number(d.revenue || 0);
                    return { ...d, cumRevenue };
                  });
                })()}
              >
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
        )}
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
          <div className="mb-3 text-sm font-semibold">Kategori Bazlı Satış</div>
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
                      <td className="text-right">{(p.totalWidthCm / 100).toLocaleString("tr-TR", { maximumFractionDigits: 0 })} m</td>
                      <td className="text-right">{(p.totalHeightCm / 100).toLocaleString("tr-TR", { maximumFractionDigits: 0 })} m</td>
                      <td className="text-right">{fmtMoney(p.amount)} ₺</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {/* === YENİ === En Çok Satılan Ürünler (tüm ürünler, sayfalama) */}
      <section className="mb-6 rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <div className="text-sm font-semibold">En Çok Satılan Ürünler</div>
          <div className="ms-auto flex flex-wrap items-center gap-2">
            <div className="relative">
              <input
                className="h-9 w-60 rounded-xl border border-neutral-200 bg-white px-3 pe-8 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                placeholder="Ürün ara"
                value={prodQuery}
                onChange={(e) => setProdQuery(e.target.value)}
                aria-label="Ürün ara"
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
            <select
              className="h-9 rounded-xl border border-neutral-200 bg-white px-3 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
              value={prodSort}
              onChange={(e) => setProdSort(e.target.value as any)}
              aria-label="Sırala"
            >
              <option value="amount">Tutar (₺)</option>
              <option value="qty">Adet</option>
              <option value="area">Toplam m²</option>
              <option value="product">Ürün adı</option>
            </select>
            <button
              type="button"
              onClick={() => setProdDesc((s) => !s)}
              className="inline-flex h-9 items-center rounded-xl border border-neutral-200 bg-white px-2 text-sm text-neutral-700 hover:bg-neutral-50"
              title={prodDesc ? "Azalan" : "Artan"}
              aria-label={prodDesc ? "Azalan sırala" : "Artan sırala"}
            >
              <svg viewBox="0 0 24 24" className={`size-4 transition-transform ${prodDesc ? "" : "rotate-180"}`} aria-hidden>
                <path fill="currentColor" d="M7 10l5 5 5-5H7z" />
              </svg>
            </button>

            {/* Sayfa boyutu */}
            <select
              className="h-9 rounded-xl border border-neutral-200 bg-white px-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
              value={prodPageSize}
              onChange={(e) => setProdPageSize(Number(e.target.value))}
              aria-label="Sayfa boyutu"
            >
              {[10,20,50,100].map(n => <option key={n} value={n}>{n}/sayfa</option>)}
            </select>

            {/* CSV */}
            <button
              className="inline-flex h-9 items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 text-sm text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
              onClick={() => {
                const rows: (string|number)[][] = [
                  ["Ürün", "Adet", "Toplam m²", "Toplam Tutar (TRY)"],
                  ...(products?.rows ?? []).map(r => [r.product, r.qty, r.areaM2.toLocaleString("tr-TR", {minimumFractionDigits:2, maximumFractionDigits:2}), r.amount]),
                ];
                const csv = rowsToCSV(rows);
                const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `en_cok_satilan_urunler_${new Date().toISOString().slice(0,10)}.csv`;
                a.click();
                URL.revokeObjectURL(url);
              }}
              disabled={!products?.rows?.length}
              title="CSV indir"
            >
              <svg viewBox="0 0 24 24" className="size-4" aria-hidden><path fill="currentColor" d="M12 3v10l4-4 1.4 1.4L12 17l-5.4-6.6L8 9l4 4V3zM5 19h14v2H5z"/></svg>
              CSV
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          {!products || prodLoading ? (
            <SkeletonBox />
          ) : (products.rows ?? []).length === 0 ? (
            <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-700">
              Kayıt bulunamadı.
            </div>
          ) : (
            <>
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="[&>th]:px-3 [&>th]:py-2 text-left text-neutral-500">
                    <th>Ürün</th>
                    <th className="text-right">Adet</th>
                    <th className="text-right">Toplam m²</th>
                    <th className="text-right">Toplam Tutar</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {products.rows.map((r, i) => (
                    <tr key={i} className="[&>td]:px-3 [&>td]:py-2 hover:bg-neutral-50">
                      <td className="font-medium">{r.product}</td>
                      <td className="text-right tabular-nums">{fmtInt(r.qty)}</td>
                      <td className="text-right tabular-nums">{r.areaM2.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      <td className="text-right tabular-nums">{fmtMoney(r.amount)} ₺</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Pagination */}
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <div className="text-xs text-neutral-500">
                  Toplam {products.total.toLocaleString("tr-TR")} kayıt • Sayfa {products.page} / {Math.max(1, Math.ceil(products.total / products.pageSize))}
                </div>
                <div className="inline-flex items-center gap-2">
                  <button
                    className="h-8 rounded-xl border border-neutral-200 px-3 text-sm disabled:opacity-50"
                    onClick={() => setProdPage((p) => Math.max(1, p - 1))}
                    disabled={products.page <= 1}
                  >
                    Önceki
                  </button>
                  <button
                    className="h-8 rounded-xl border border-neutral-200 px-3 text-sm disabled:opacity-50"
                    onClick={() => {
                      const last = Math.max(1, Math.ceil(products.total / products.pageSize));
                      setProdPage((p) => Math.min(last, p + 1));
                    }}
                    disabled={products.page >= Math.max(1, Math.ceil(products.total / products.pageSize))}
                  >
                    Sonraki
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
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
      <div className="mt-1 text-base font-semibold">{amount}</div>
      <div className="text-xs">({count} sipariş)</div>
    </div>
  );
}

function KPI({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 text-right">
      <div className="text-[11px] text-neutral-500">{label}</div>
      <div className={`truncate text-sm font-semibold text-neutral-900`}>{value}</div>
    </div>
  );
}

function DateChip({
  label,
  value,
  onChange,
  min,
  max,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  min?: string;
  max?: string;
}) {
  return (
    <label className="inline-flex items-center gap-2 rounded-xl border border-neutral-200 bg-white p-1.5 text-sm text-neutral-700 hover:bg-neutral-50">
      <span className="text-xs text-neutral-500">{label}</span>
      <input
        type="date"
        className="h-8 rounded-lg border border-neutral-200 bg-white px-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        min={min}
        max={max}
      />
    </label>
  );
}

function Tile({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white px-3 py-2">
      <div className="text-[11px] text-neutral-500">{label}</div>
      <div className={`mt-0.5 text-sm font-semibold ${mono ? "tabular-nums tracking-tight" : ""}`}>{value}</div>
    </div>
  );
}

function MethodPill({ label, amount }: { label: string; amount: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-lg border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-[11px] text-neutral-800">
      <svg viewBox="0 0 24 24" className="size-3.5 text-neutral-500" aria-hidden>
        <path fill="currentColor" d="M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2H3zM3 11h18v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      </svg>
      <b className="font-medium">{label}:</b> {amount} ₺
    </span>
  );
}

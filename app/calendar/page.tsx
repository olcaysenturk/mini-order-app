"use client";

import { useEffect, useMemo, useState } from "react";

/* ========= Types ========= */
type Status = "pending" | "processing" | "completed" | "cancelled" | "workshop";
type HeaderFilter = "active" | "completed" | "all";

type Order = {
  id: string;
  createdAt: string; // ISO
  deliveryAt?: string | null; // ISO (yeni alan)
  deliveryDate?: string | null; // legacy
  customerName: string;
  customerPhone: string;
  dealer?: { name?: string | null };
  status: Status;
  netTotal?: number;
  total?: number;
  paidTotal?: number;
  totalPaid?: number;
  balance?: number;
};

/* ========= Utils ========= */
const statusLabel: Record<Status, string> = {
  pending: "Beklemede",
  processing: "İşlemde",
  completed: "Tamamlandı",
  cancelled: "İptal",
  workshop: "Atölyede"
};
const statusDot: Record<Status, string> = {
  pending: "bg-amber-500",
  processing: "bg-blue-600",
  completed: "bg-emerald-600",
  cancelled: "bg-rose-600",
  workshop: "bg-blue-100",
};
const fmt = (n: number) =>
  new Intl.NumberFormat("tr-TR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n || 0);

function toYMD(d: Date) {
  const y = d.getFullYear();
  const m = (d.getMonth() + 1).toString().padStart(2, "0");
  const dd = d.getDate().toString().padStart(2, "0");
  return `${y}-${m}-${dd}`;
}
function dateKeyFromISO(iso?: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.valueOf())) return null;
  return toYMD(new Date(d.getFullYear(), d.getMonth(), d.getDate()));
}
function orderDayKey(o: Order) {
  return (
    dateKeyFromISO(o.deliveryAt) ??
    dateKeyFromISO(o.deliveryDate) ??
    dateKeyFromISO(o.createdAt)!
  );
}
function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function addMonths(d: Date, delta: number) {
  return new Date(d.getFullYear(), d.getMonth() + delta, 1);
}
function isTodayYMD(ymd: string) {
  return ymd === toYMD(new Date());
}

/* ========= Calendar Grid ========= */
type DayCell = { ymd: string; inCurrentMonth: boolean; isToday: boolean };

function buildMonthGrid(currentMonth: Date): DayCell[] {
  const start = startOfMonth(currentMonth);
  const startDay = (start.getDay() + 6) % 7; // Mon=0
  const totalCells = 42; // 6 hafta
  const grid: DayCell[] = [];
  const firstCellDate = new Date(start);
  firstCellDate.setDate(start.getDate() - startDay);
  for (let i = 0; i < totalCells; i++) {
    const d = new Date(firstCellDate);
    d.setDate(firstCellDate.getDate() + i);
    const ymd = toYMD(d);
    const inCurrentMonth =
      d.getFullYear() === start.getFullYear() &&
      d.getMonth() === start.getMonth();
    grid.push({ ymd, inCurrentMonth, isToday: isTodayYMD(ymd) });
  }
  return grid;
}

/* ========= Accessible Modal ========= */
function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  // ESC ile kapama
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // scroll kilidi
  useEffect(() => {
    if (!open) return;
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = overflow;
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      {/* Backdrop */}
      <button
        className="absolute inset-0 bg-black/40"
        aria-label="Kapat"
        onClick={onClose}
      />
      {/* Dialog */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative z-10 w-full max-w-2xl origin-bottom rounded-t-2xl bg-white shadow-2xl sm:origin-center sm:rounded-2xl"
      >
        <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3 sm:px-5">
          <h2 className="text-base font-semibold">{title}</h2>
          <button
            onClick={onClose}
            className="inline-flex size-8 items-center justify-center rounded-lg border border-neutral-200 hover:bg-neutral-50"
            aria-label="Kapat"
          >
            <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
              <path
                fill="currentColor"
                d="M18.3 5.71L12 12.01l-6.29-6.3L4.3 7.12 10.59 13.4l-6.3 6.29 1.42 1.42 6.29-6.3 6.29 6.3 1.42-1.42-6.3-6.29 6.3-6.29z"
              />
            </svg>
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto px-4 py-4 sm:px-5">
          {children}
        </div>
      </div>
    </div>
  );
}

/* ========= Page ========= */
export default function OrdersCalendarPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // üst sekme filtresi
  const [headerFilter, setHeaderFilter] = useState<HeaderFilter>("active");

  // filtreler
  const [statusFilter, setStatusFilter] = useState<Status | "all">("all");
  const [dealerFilter, setDealerFilter] = useState<"all" | string>("all");
  const [q, setQ] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false); // mobil bottom sheet

  // takvim
  const [cursor, setCursor] = useState<Date>(() => startOfMonth(new Date()));
  const [selectedYMD, setSelectedYMD] = useState<string | null>(null);

  // veri çek
  useEffect(() => {
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const qs =
          headerFilter === "completed"
            ? `?status=${encodeURIComponent("completed")}&take=200`
            : headerFilter === "active"
            ? `?status=${encodeURIComponent("pending,processing")}&take=200`
            : `?take=200`;
        const res = await fetch(`/api/orders${qs}`, { cache: "no-store" });
        if (!res.ok) throw new Error("Siparişler alınamadı");
        const data = (await res.json()) as Order[];
        const normalized: Order[] = data.map((o: any) => ({
          ...o,
          deliveryAt: o.deliveryAt ?? o.deliveryDate ?? null,
        }));
        setOrders(normalized);
      } catch (e: any) {
        setErr(e?.message || "Hata");
      } finally {
        setLoading(false);
      }
    })();
  }, [headerFilter]);

  // bayi listesi
  const dealerNames = useMemo(() => {
    const names = orders
      .map((o) => (o.dealer?.name || "").trim())
      .filter(Boolean);
    return Array.from(new Set(names)).sort((a, b) => a.localeCompare(b, "tr"));
  }, [orders]);

  // filtreli siparişler
  const filteredOrders = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return orders.filter((o) => {
      if (statusFilter !== "all" && o.status !== statusFilter) return false;
      if (dealerFilter !== "all" && (o.dealer?.name || "") !== dealerFilter)
        return false;
      if (needle) {
        const inHeader =
          o.id.toLowerCase().includes(needle) ||
          (o.customerName || "").toLowerCase().includes(needle) ||
          (o.customerPhone || "").toLowerCase().includes(needle) ||
          (o.dealer?.name || "").toLowerCase().includes(needle);
        if (!inHeader) return false;
      }
      return true;
    });
  }, [orders, statusFilter, dealerFilter, q]);

  // gün -> siparişler
  const dayMap = useMemo(() => {
    const map = new Map<string, Order[]>();
    for (const o of filteredOrders) {
      const key = orderDayKey(o);
      if (!key) continue;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(o);
    }
    for (const [, arr] of map) {
      arr.sort((a, b) => {
        const ad = new Date(a.deliveryAt || a.createdAt).getTime();
        const bd = new Date(b.deliveryAt || b.createdAt).getTime();
        return ad - bd;
      });
    }
    return map;
  }, [filteredOrders]);

  const cells = useMemo(() => buildMonthGrid(cursor), [cursor]);
  const monthLabel = useMemo(
    () =>
      new Intl.DateTimeFormat("tr-TR", {
        month: "long",
        year: "numeric",
      }).format(cursor),
    [cursor]
  );

  // aktif filtre chip'leri
  const activeChips = useMemo(() => {
    const chips: { key: string; label: string; onClear: () => void }[] = [];
    if (statusFilter !== "all")
      chips.push({
        key: "status",
        label: statusLabel[statusFilter],
        onClear: () => setStatusFilter("all"),
      });
    if (dealerFilter !== "all")
      chips.push({
        key: "dealer",
        label: `Bayi: ${dealerFilter}`,
        onClear: () => setDealerFilter("all"),
      });
    if (q.trim())
      chips.push({
        key: "q",
        label: `Ara: “${q.trim()}”`,
        onClear: () => setQ(""),
      });
    return chips;
  }, [statusFilter, dealerFilter, q]);

  const selectedOrders = selectedYMD ? dayMap.get(selectedYMD) ?? [] : [];

  return (
    <div className="flex flex-col bg-[linear-gradient(180deg,#f7f7fb_0%,#ffffff_20%)]">
      {/* Sticky Header */}
      <header className="sticky top-0 z-20 border-b border-neutral-200/70 bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/70">
        <div className="mx-auto max-w-7xl px-3 py-2 sm:px-6 sm:py-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2 hidden sm:flex">
              <div className="inline-flex size-9 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm">
                <svg viewBox="0 0 24 24" className="size-5" aria-hidden>
                  <path
                    fill="currentColor"
                    d="M7 3h10a2 2 0 0 1 2 2v3H5V5a2 2 0 0 1 2-2zm14 8H3v8a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2zM7 14h4v4H7z"
                  />
                </svg>
              </div>
              <div className="min-w-0">
                <h1 className="truncate text-lg font-bold tracking-tight sm:text-2xl">
                  Takvim
                </h1>
                <div className="text-xs text-neutral-500 sm:hidden">
                  {monthLabel}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Ay navigasyonu */}
              <div className="hidden items-center gap-2 rounded-xl border border-neutral-200 bg-white p-1 shadow-sm sm:inline-flex">
                <button
                  className="inline-flex size-8 items-center justify-center rounded-lg hover:bg-neutral-50"
                  onClick={() => setCursor((c) => addMonths(c, -1))}
                  title="Önceki Ay"
                >
                  <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
                    <path
                      fill="currentColor"
                      d="M15 6l-6 6 6 6 1.4-1.4L11.8 12l4.6-4.6z"
                    />
                  </svg>
                </button>
                <div className="min-w-40 px-2 text-sm font-semibold">
                  {monthLabel}
                </div>
                <button
                  className="inline-flex size-8 items-center justify-center rounded-lg hover:bg-neutral-50"
                  onClick={() => setCursor((c) => addMonths(c, +1))}
                  title="Sonraki Ay"
                >
                  <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
                    <path
                      fill="currentColor"
                      d="M9 6l6 6-6 6-1.4-1.4L12.2 12 7.6 7.4z"
                    />
                  </svg>
                </button>
                <button
                  className="ms-1 inline-flex h-8 items-center rounded-lg bg-indigo-600 px-3 text-xs font-semibold text-white hover:bg-indigo-700"
                  onClick={() => {
                    const today = startOfMonth(new Date());
                    setCursor(today);
                    setSelectedYMD(toYMD(new Date()));
                  }}
                >
                  Bugün
                </button>
              </div>

              {/* Mobil: ay kısayolları */}
              <div className="inline-flex items-center gap-1 sm:hidden">
                <button
                  className="inline-flex size-8 items-center justify-center rounded-lg border border-neutral-200 bg-white hover:bg-neutral-50"
                  onClick={() => setCursor((c) => addMonths(c, -1))}
                  title="Önceki"
                >
                  <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
                    <path
                      fill="currentColor"
                      d="M15 6l-6 6 6 6 1.4-1.4L11.8 12l4.6-4.6z"
                    />
                  </svg>
                </button>
                <button
                  className="inline-flex size-8 items-center justify-center rounded-lg border border-neutral-200 bg-white hover:bg-neutral-50"
                  onClick={() => setCursor((c) => addMonths(c, +1))}
                  title="Sonraki"
                >
                  <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
                    <path
                      fill="currentColor"
                      d="M9 6l6 6-6 6-1.4-1.4L12.2 12 7.6 7.4z"
                    />
                  </svg>
                </button>
                <button
                  className="inline-flex h-8 items-center rounded-lg bg-indigo-600 px-2.5 text-xs font-semibold text-white hover:bg-indigo-700"
                  onClick={() => {
                    const today = startOfMonth(new Date());
                    setCursor(today);
                    setSelectedYMD(toYMD(new Date()));
                  }}
                >
                  Bugün
                </button>
              </div>

              {/* Filtre butonu (mobil) */}
              <button
                className="inline-flex h-9 items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 text-sm text-neutral-700 shadow-sm hover:bg-neutral-50 sm:hidden"
                onClick={() => setFiltersOpen(true)}
              >
                <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
                  <path
                    fill="currentColor"
                    d="M3 5h18v2H3zM6 11h12v2H6zm3 6h6v2H9z"
                  />
                </svg>
                Filtreler
              </button>
            </div>
          </div>

          {/* Masaüstü filtre satırı */}
          <div className="mt-2 hidden grid-cols-3 gap-2 sm:grid mt-4">
            <div className="relative">
              <input
                className="h-9 w-full rounded-xl border border-neutral-200 bg-white px-3 pe-8 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                placeholder="Müşteri / telefon / bayi"
                value={q}
                onChange={(e) => setQ(e.target.value)}
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
            <div>
              <select
                className="h-9 w-full rounded-xl border border-neutral-200 bg-white px-3 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
              >
                <option value="all">Durum: Tümü</option>
                <option value="pending">Durum: Beklemede</option>
                <option value="processing">Durum: İşlemde</option>
                <option value="completed">Durum: Tamamlandı</option>
                <option value="cancelled">Durum: İptal</option>
                <option value="workshop">Durum: Atölyede</option>
              </select>
            </div>
            <div>
              <select
                className="h-9 w-full rounded-xl border border-neutral-200 bg-white px-3 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                value={dealerFilter}
                onChange={(e) => setDealerFilter(e.target.value)}
              >
                <option value="all">Bayi: Tümü</option>
                {dealerNames.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Aktif filtre chip'leri */}
          {activeChips.length > 0 && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {activeChips.map((c) => (
                <span
                  key={c.key}
                  className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-medium text-neutral-700 ring-1 ring-inset ring-neutral-200"
                >
                  {c.label}
                  <button
                    className="rounded p-0.5 hover:bg-neutral-200"
                    onClick={c.onClear}
                    aria-label="Temizle"
                  >
                    <svg viewBox="0 0 24 24" className="size-3.5" aria-hidden>
                      <path
                        fill="currentColor"
                        d="M18.3 5.71L12 12.01l-6.29-6.3L4.3 7.12 10.59 13.4l-6.3 6.29 1.42 1.42 6.29-6.3 6.29 6.3 1.42-1.42-6.3-6.29 6.3-6.29z"
                      />
                    </svg>
                  </button>
                </span>
              ))}
              <button
                className="text-xs text-indigo-700 underline underline-offset-2"
                onClick={() => {
                  setQ("");
                  setStatusFilter("all");
                  setDealerFilter("all");
                }}
              >
                Hepsini sıfırla
              </button>
            </div>
          )}
        </div>
      </header>

      {/* İçerik */}
      <div className="relative mx-auto flex w-full max-w-7xl flex-1 overflow-hidden">
        {/* Grid kapsayıcı – mobilde yatay kaydırma */}
        <div className="flex min-w-0 flex-1 flex-col overflow-x-auto">
          <div className="min-w-[720px] px-3 sm:px-6">
            {/* Hafta başlıkları */}
            <div className="grid grid-cols-7 gap-2 pt-2 sm:pt-4">
              {["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"].map((d) => (
                <div
                  key={d}
                  className="px-2 py-1 text-center text-[11px] font-semibold text-neutral-500 sm:text-xs"
                >
                  {d}
                </div>
              ))}
            </div>

            {/* 6x7 grid */}
            <div className="grid grid-cols-7 gap-2 pb-3 sm:pb-4">
              {cells.map((c) => {
                const list = dayMap.get(c.ymd) ?? [];
                const cnt = list.length;
                const day = Number(c.ymd.slice(-2));
                const bg = c.inCurrentMonth ? "bg-white" : "bg-neutral-50";
                const border = "border-neutral-200/80";
                const isOverdue =
                  list.some((o) => {
                    const dAt = new Date(o.deliveryAt || o.createdAt);
                    const today = new Date();
                    const notDone =
                      o.status !== "completed" && o.status !== "cancelled";
                    return (
                      notDone &&
                      dAt <
                        new Date(
                          today.getFullYear(),
                          today.getMonth(),
                          today.getDate()
                        )
                    );
                  }) && c.inCurrentMonth;
                const ring = c.isToday
                  ? "ring-2 ring-indigo-400"
                  : isOverdue
                  ? "ring-2 ring-rose-300"
                  : "";

                const preview = list.slice(0, 2); // mobilde 2 satır önizleme

                return (
                  <button
                    key={c.ymd}
                    onClick={() => setSelectedYMD(c.ymd)}
                    className={[
                      "group relative min-h-[88px] sm:min-h-[110px] overflow-hidden rounded-2xl border p-2 text-left shadow-sm transition",
                      bg,
                      border,
                      ring,
                      "hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500",
                    ].join(" ")}
                    title={`${c.ymd} — ${cnt} kayıt`}
                  >
                    <div className="mb-1 flex items-center justify-between">
                      <span
                        className={[
                          "inline-flex size-6 items-center justify-center rounded-full text-xs font-semibold sm:size-7",
                          c.isToday
                            ? "bg-indigo-600 text-white"
                            : "text-neutral-700",
                        ].join(" ")}
                      >
                        {day}
                      </span>
                      {cnt > 0 && (
                        <span className="rounded-md bg-neutral-100 px-1.5 py-0.5 text-[10px] font-medium text-neutral-700 ring-1 ring-inset ring-neutral-200">
                          {cnt}
                        </span>
                      )}
                    </div>

                    <div className="flex h-[calc(100%-28px)] sm:h-[calc(100%-30px)] flex-col gap-1 overflow-y-auto pr-1">
                      {preview.map((o) => (
                        <div
                          key={o.id}
                          className="flex items-center gap-1 truncate rounded-lg bg-neutral-50 px-1.5 py-1 text-[11px] text-neutral-700 ring-1 ring-inset ring-neutral-200 sm:text-xs"
                          title={`${o.customerName} • ${o.dealer?.name ?? "—"}`}
                        >
                          <span
                            className={`inline-block h-2 w-2 rounded-full ${
                              statusDot[o.status]
                            }`}
                          />
                          <span className="truncate">
                            {o.customerName || "—"}
                          </span>
                        </div>
                      ))}
                      {cnt > preview.length && (
                        <div className="text-[10px] text-neutral-500 sm:text-[11px]">
                          +{cnt - preview.length} diğer
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Hata/Yükleniyor */}
            {loading && (
              <div className="py-8 text-center text-sm text-neutral-500">
                Yükleniyor…
              </div>
            )}
            {err && (
              <div className="mb-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {err}{" "}
                <button
                  className="underline underline-offset-2"
                  onClick={() => setHeaderFilter((s) => s)}
                >
                  Tekrar dene
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ======= Gün Detay Modal ======= */}
      <Modal
        open={!!selectedYMD}
        onClose={() => setSelectedYMD(null)}
        title={
          selectedYMD
            ? new Intl.DateTimeFormat("tr-TR", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
              }).format(new Date(selectedYMD))
            : "Gün detayı"
        }
      >
        {!selectedYMD ? (
          <div className="text-sm text-neutral-500">Bir gün seçin.</div>
        ) : selectedOrders.length === 0 ? (
          <div className="text-sm text-neutral-500">Kayıt bulunamadı.</div>
        ) : (
          <ul className="space-y-3">
            {selectedOrders.map((o) => {
              const net = Number(o.netTotal ?? o.total ?? 0);
              const paid = Number(o.paidTotal ?? o.totalPaid ?? 0);
              const bal = Number(o.balance ?? Math.max(0, net - paid));
              return (
                <li
                  key={o.id}
                  className="rounded-2xl border border-neutral-200 p-3 shadow-sm"
                >
                  <div className="mb-1 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-block h-2.5 w-2.5 rounded-full ${
                          statusDot[o.status]
                        }`}
                        title={statusLabel[o.status]}
                      />
                      <a
                        href={`/orders/${o.id}`}
                        className="font-semibold text-indigo-700 hover:underline flex items-center gap-1"
                      >
                        Sipariş detayı
                        <span>
                          <svg
                            viewBox="0 0 24 24"
                            width="1em"
                            height="1em"
                            aria-hidden="true"
                            xmlns="http://www.w3.org/2000/svg"
                          >
                            <path
                              fill="currentColor"
                              fill-rule="evenodd"
                              clip-rule="evenodd"
                              d="M12.293 4.293a1 1 0 0 1 1.414 0l7 7a1 1 0 0 1 0 1.414l-7 7a1 1 0 1 1-1.414-1.414L17.586 13H4a1 1 0 1 1 0-2h13.586l-5.293-5.293a1 1 0 0 1 0-1.414Z"
                            />
                          </svg>
                        </span>
                      </a>
                    </div>
                    <span className="rounded-md bg-neutral-50 px-2 py-0.5 text-[11px] text-neutral-700 ring-1 ring-inset ring-neutral-200">
                      {statusLabel[o.status]}
                    </span>
                  </div>

                  <div className="text-sm">
                    <div className="truncate">
                      <b>Müşteri:</b> {o.customerName || "—"}
                    </div>
                    <div className="truncate">
                      <b>Telefon:</b> {o.customerPhone || "—"}
                    </div>
                    <div className="truncate">
                      <b>Bayi:</b> {o.dealer?.name || "—"}
                    </div>
                    <div className="truncate">
                      <b>Teslim:</b>{" "}
                      {new Intl.DateTimeFormat("tr-TR", {
                        dateStyle: "medium",
                      }).format(
                        new Date(o.deliveryAt || o.deliveryDate || o.createdAt)
                      )}
                    </div>
                  </div>

                  <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                    <div className="rounded-lg bg-neutral-50 p-2 text-neutral-700 ring-1 ring-inset ring-neutral-200">
                      <div className="text-[11px]">NET</div>
                      <div className="font-semibold">{fmt(net)} ₺</div>
                    </div>
                    <div className="rounded-lg bg-emerald-50 p-2 text-emerald-700 ring-1 ring-inset ring-emerald-200">
                      <div className="text-[11px]">Ödenen</div>
                      <div className="font-semibold">{fmt(paid)} ₺</div>
                    </div>
                    <div className="rounded-lg bg-amber-50 p-2 text-amber-700 ring-1 ring-inset ring-amber-200">
                      <div className="text-[11px]">Kalan</div>
                      <div className="font-semibold">{fmt(bal)} ₺</div>
                    </div>
                  </div>

                  <div className="mt-2 flex items-center justify-end gap-2">
                    <a
                      href={`/orders/${o.id}`}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-neutral-200 bg-white px-2.5 py-1.5 text-xs text-neutral-700 hover:bg-neutral-50"
                    >
                      Düzenle
                    </a>
                    {/* <a
                      href={`/orders/${o.id}?pay=1`}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100"
                    >
                      Ödeme Ekle
                    </a> */}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Modal>

      {/* ======= Mobil Filtre Bottom Sheet ======= */}
      {filtersOpen && (
        <div className="fixed inset-0 z-40 flex items-end bg-black/40">
          {/* backdrop */}
          <button
            className="absolute inset-0"
            onClick={() => setFiltersOpen(false)}
            aria-label="Kapat"
          />
          {/* sheet */}
          <div className="relative w-full rounded-t-2xl bg-white p-4 shadow-2xl">
            <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-neutral-200" />
            <div className="mb-2 text-base font-semibold">Filtreler</div>

            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs text-neutral-600">
                  Arama
                </label>
                <input
                  className="h-10 w-full rounded-xl border border-neutral-200 bg-white px-3 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                  placeholder="Müşteri / telefon / bayi"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                />
              </div>

              <div>
                <label className="mb-1 block text-xs text-neutral-600">
                  Durum
                </label>
                <select
                  className="h-10 w-full rounded-xl border border-neutral-200 bg-white px-3 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                >
                  <option value="all">Tümü</option>
                  <option value="pending">Beklemede</option>
                  <option value="processing">İşlemde</option>
                  <option value="completed">Tamamlandı</option>
                  <option value="cancelled">İptal</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs text-neutral-600">
                  Bayi
                </label>
                <select
                  className="h-10 w-full rounded-xl border border-neutral-200 bg-white px-3 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                  value={dealerFilter}
                  onChange={(e) => setDealerFilter(e.target.value)}
                >
                  <option value="all">Tümü</option>
                  {dealerNames.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </div>

              {/* Aktif chip'ler */}
              {activeChips.length > 0 && (
                <div className="pt-1">
                  <div className="mb-1 text-xs text-neutral-600">Aktif</div>
                  <div className="flex flex-wrap items-center gap-2">
                    {activeChips.map((c) => (
                      <span
                        key={c.key}
                        className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-medium text-neutral-700 ring-1 ring-inset ring-neutral-200"
                      >
                        {c.label}
                        <button
                          className="rounded p-0.5 hover:bg-neutral-200"
                          onClick={c.onClear}
                          aria-label="Temizle"
                        >
                          <svg
                            viewBox="0 0 24 24"
                            className="size-3.5"
                            aria-hidden
                          >
                            <path
                              fill="currentColor"
                              d="M18.3 5.71L12 12.01l-6.29-6.3L4.3 7.12 10.59 13.4l-6.3 6.29 1.42 1.42 6.29-6.3 6.29 6.3 1.42-1.42-6.3-6.29 6.3-6.29z"
                            />
                          </svg>
                        </button>
                      </span>
                    ))}
                    <button
                      className="text-xs text-indigo-700 underline underline-offset-2"
                      onClick={() => {
                        setQ("");
                        setStatusFilter("all");
                        setDealerFilter("all");
                      }}
                    >
                      Hepsini sıfırla
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                className="h-10 rounded-xl border border-neutral-200 bg-white px-3 text-sm text-neutral-700"
                onClick={() => {
                  setQ("");
                  setStatusFilter("all");
                  setDealerFilter("all");
                }}
              >
                Temizle
              </button>
              <button
                className="h-10 rounded-xl bg-indigo-600 px-4 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700"
                onClick={() => setFiltersOpen(false)}
              >
                Uygula
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

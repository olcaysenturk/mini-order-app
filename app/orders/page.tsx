// app/orders/page.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

/* ========= Types ========= */
type Status = "pending" | "processing" | "completed" | "cancelled";
type PaymentMethod = "CASH" | "TRANSFER" | "CARD";
type HeaderFilter = "active" | "completed" | "all";

type OrderItem = {
  id: string;
  qty: number;
  width: number;
  height: number;
  unitPrice: number;
  subtotal: number;
  note?: string | null;
  category: { name: string };
  variant: { name: string };
};

type Order = {
  id: string;
  createdAt: string;
  note?: string | null;
  total: number;
  items: OrderItem[];
  customerName: string;
  dealer: { name: string };
  customerPhone: string;
  status: Status;
  paidTotal?: number; // ✅ liste API
  totalPaid?: number; // ✅ legacy alias (varsa)
  balance?: number; // ✅ liste API
  netTotal?: number; // ✅ liste API
};

type Payment = {
  id: string;
  method: PaymentMethod;
  amount: number;
  paidAt: string;
  note?: string | null;
};

type OrderDetail = {
  id: string;
  total: number;
  netTotal: number;
  discount: number;
  payments: Payment[];
  paidTotal: number;
  balance: number;
};

/* ========= Utils ========= */
const fmt = (n: number) =>
  new Intl.NumberFormat("tr-TR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
const fmtInt = (n: number) =>
  new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 0 }).format(n);

const statusLabel: Record<Status, string> = {
  pending: "Beklemede",
  processing: "İşlemde",
  completed: "Tamamlandı",
  cancelled: "İptal",
};
const methodLabel: Record<PaymentMethod, string> = {
  CASH: "Nakit",
  TRANSFER: "Havale/EFT",
  CARD: "Kredi Kartı",
};

function StatusBadge({ s }: { s: Status }) {
  const base =
    "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border";
  const map: Record<Status, string> = {
    pending: `${base} bg-neutral-100 text-neutral-700 border-neutral-200`,
    processing: `${base} bg-blue-50 text-blue-700 border-blue-200`,
    completed: `${base} bg-emerald-50 text-emerald-700 border-emerald-200`,
    cancelled: `${base} bg-rose-50 text-rose-700 border-rose-200`,
  };
  return <span className={map[s]}>{statusLabel[s]}</span>;
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
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${tone}`}
    >
      {pct}% tahsilat
    </span>
  );
}
function SummaryTile({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "neutral" | "emerald" | "amber" | "indigo";
}) {
  const map = {
    neutral: "text-neutral-800 bg-neutral-50 border-neutral-200",
    emerald: "text-emerald-700 bg-emerald-50 border-emerald-200",
    amber: "text-amber-700 bg-amber-50 border-amber-200",
    indigo: "text-indigo-700 bg-indigo-50 border-indigo-200",
  } as const;
  return (
    <div className={`rounded-xl border ${map[tone]} p-3`}>
      <div className="text-xs">{label}</div>
      <div className="mt-1 text-base font-semibold">{value}</div>
    </div>
  );
}

/* ========= Page ========= */
export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [headerFilter, setHeaderFilter] = useState<HeaderFilter>("active");
  const [q, setQ] = useState("");

  // filters
  const [paymentStatus, setPaymentStatus] = useState<
    "all" | "unpaid" | "partial" | "paid"
  >("all");
  const [methodFilters, setMethodFilters] = useState<PaymentMethod[]>([]);
  const [filtersOpen, setFiltersOpen] = useState(false);

  // ✅ BAYİ filtresi (varsayılan: tümü)
  const [dealerFilter, setDealerFilter] = useState<"all" | string>("all");

  // ✅ Listeden mevcut bayileri tekilleştir
  const dealers = useMemo(() => {
    const names = orders
      .map((o) => (o.dealer?.name ?? "").trim())
      .filter(Boolean);
    return Array.from(new Set(names)).sort((a, b) => a.localeCompare(b, "tr"));
  }, [orders]);

  // ✅ Seçili bayi listede yoksa otomatik "tümü"ne dön
  useEffect(() => {
    if (dealerFilter !== "all" && !dealers.includes(dealerFilter)) {
      setDealerFilter("all");
    }
  }, [dealers, dealerFilter]);

  // expanded rows
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());

  // details cache
  const [detailById, setDetailById] = useState<
    Record<string, OrderDetail | undefined>
  >({});
  const [detailLoading, setDetailLoading] = useState<Record<string, boolean>>(
    {}
  );
  const [detailError, setDetailError] = useState<Record<string, string | null>>(
    {}
  );

  // payment form
  const [payAmount, setPayAmount] = useState<Record<string, string>>({});
  const [payMethod, setPayMethod] = useState<Record<string, PaymentMethod>>({});
  const [payNote, setPayNote] = useState<Record<string, string>>({});
  const [paySaving, setPaySaving] = useState<Record<string, boolean>>({});

  // modal
  const [payModalOpenId, setPayModalOpenId] = useState<string | null>(null);
  const modalBackdropRef = useRef<HTMLDivElement | null>(null);

  const toggleOpen = async (id: string) => {
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    if (!detailById[id]) {
      await fetchOrderDetail(id);
    }
  };

  // fetch list
  const fetchOrders = async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    try {
      const qs =
        headerFilter === "completed"
          ? `?status=${encodeURIComponent("completed")}`
          : "";
      const res = await fetch(`/api/orders${qs}`, {
        cache: "no-store",
        signal,
      });
      if (!res.ok) throw new Error("Siparişler alınamadı");
      const data: Order[] = await res.json();
      setOrders(data);
    } catch (e: any) {
      if (e?.name !== "AbortError") setError(e?.message || "Bilinmeyen hata");
    } finally {
      setLoading(false);
    }
  };

  const fetchOrderDetail = async (id: string) => {
    setDetailLoading((s) => ({ ...s, [id]: true }));
    setDetailError((s) => ({ ...s, [id]: null }));
    try {
      const res = await fetch(`/api/orders/${id}`, { cache: "no-store" });
      if (!res.ok) throw new Error("Detay alınamadı");
      const data = await res.json();
      const d: OrderDetail = {
        id: data.id,
        total: Number(data.total ?? 0),
        netTotal: Number(data.netTotal ?? data.total ?? 0),
        discount: Number(data.discount ?? 0),
        payments: (data.payments ?? []).map((p: any) => ({
          id: p.id,
          method: p.method,
          amount: Number(p.amount),
          paidAt: p.paidAt,
          note: p.note ?? null,
        })),
        paidTotal: Number(data.paidTotal ?? data.totalPaid ?? 0),
        balance: Number(
          data.balance ??
            Math.max(
              0,
              Number(data.netTotal ?? data.total ?? 0) -
                Number(data.paidTotal ?? data.totalPaid ?? 0)
            )
        ),
      };
      setDetailById((m) => ({ ...m, [id]: d }));
      // modal alanlarını da doldur
      setPayMethod((m) => ({ ...m, [id]: m[id] ?? "CASH" }));
      setPayAmount((m) => ({ ...m, [id]: m[id] ?? "" }));
      setPayNote((m) => ({ ...m, [id]: m[id] ?? "" }));
      // liste pill'lerini hemen güncelle (optimistik senkron)
      setOrders((prev) =>
        prev.map((o) =>
          o.id === id
            ? {
                ...o,
                netTotal: d.netTotal ?? o.netTotal ?? o.total,
                paidTotal: d.paidTotal,
                totalPaid: d.paidTotal,
                balance: d.balance,
              }
            : o
        )
      );
    } catch (e: any) {
      setDetailError((s) => ({ ...s, [id]: e?.message || "Detay alınamadı" }));
    } finally {
      setDetailLoading((s) => ({ ...s, [id]: false }));
    }
  };

  // İlk yük + header filter
  useEffect(() => {
    const ac = new AbortController();
    fetchOrders(ac.signal);
    return () => ac.abort();
  }, [headerFilter]);

  const onRefresh = () => {
    const ac = new AbortController();
    fetchOrders(ac.signal);
  };

  // ❗ Yalnızca yöntem filtresi aktifken (payments[].method lazım) görünen siparişlerin detayını çek
  useEffect(() => {
    if (methodFilters.length === 0) return;
    const ids = orders.map((o) => o.id);
    (async () => {
      await Promise.all(
        ids.map(async (id) => {
          if (!detailById[id] && !detailLoading[id]) {
            try {
              await fetchOrderDetail(id);
            } catch {}
          }
        })
      );
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [methodFilters, orders]);

  // Modal açılınca detay yoksa çek
  useEffect(() => {
    if (!payModalOpenId) return;
    if (!detailById[payModalOpenId]) fetchOrderDetail(payModalOpenId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payModalOpenId]);

  // Modal "kalan" auto-fill (ilk gelişte)
  useEffect(() => {
    if (!payModalOpenId) return;
    const d = detailById[payModalOpenId];
    if (d && !(payAmount[payModalOpenId] ?? "").trim()) {
      setPayAmount((m) => ({
        ...m,
        [payModalOpenId]:
          d.balance > 0 ? String(d.balance).replace(".", ",") : "",
      }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payModalOpenId, detailById]);

  // ESC & backdrop
  useEffect(() => {
    if (!payModalOpenId) return;
    const onKey = (e: KeyboardEvent) =>
      e.key === "Escape" && setPayModalOpenId(null);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [payModalOpenId]);

  const openPayModal = (id: string) => setPayModalOpenId(id);
  const closePayModal = () => setPayModalOpenId(null);
  const onBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === modalBackdropRef.current) closePayModal();
  };

  // Sil
  const removeOrder = async (id: string) => {
    if (!confirm(`#${id} siparişini silmek istiyor musun?`)) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/orders/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Silme başarısız");
      setOrders((prev) => prev.filter((o) => o.id !== id));
      setOpenIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      toast.success("Sipariş silindi");
    } catch (e: any) {
      toast.error(e?.message || "Silmede hata");
    } finally {
      setDeletingId(null);
    }
  };

  // Text filter
  const textFiltered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return orders;
    return orders.filter((o) => {
      const inHeader =
        o.id.toLowerCase().includes(needle) ||
        (o.note || "").toLowerCase().includes(needle) ||
        (o.customerName || "").toLowerCase().includes(needle) ||
        (o.customerPhone || "").toLowerCase().includes(needle);
      const inItems = o.items?.some(
        (it) =>
          it.category.name.toLowerCase().includes(needle) ||
          it.variant.name.toLowerCase().includes(needle) ||
          (it.note || "").toLowerCase().includes(needle)
      );
      return inHeader || inItems;
    });
  }, [orders, q]);

  // Header status filter
  const statusHeaderFiltered = useMemo(() => {
    if (headerFilter === "all") return textFiltered;
    if (headerFilter === "completed")
      return textFiltered.filter((o) => o.status === "completed");
    return textFiltered.filter((o) => o.status !== "cancelled");
  }, [textFiltered, headerFilter]);

  // Payment filters
  const filtered = useMemo(() => {
    return statusHeaderFiltered.filter((o) => {
      if (dealerFilter !== "all") {
        if ((o.dealer?.name ?? "") !== dealerFilter) return false;
      }

      // paymentStatus: liste payload'ı yeterli
      if (paymentStatus !== "all") {
        const net = Number(o.netTotal ?? o.total ?? 0);
        const paid = Number(o.paidTotal ?? o.totalPaid ?? 0);
        const bal = Number(o.balance ?? Math.max(0, net - paid));
        if (paymentStatus === "unpaid" && !(paid === 0 && net > 0))
          return false;
        if (paymentStatus === "partial" && !(bal > 0 && paid > 0)) return false;
        if (paymentStatus === "paid" && !(bal <= 0 && net >= 0)) return false;
      }
      // methodFilters: payments[].method gerektiği için detay lazım
      if (methodFilters.length > 0) {
        const d = detailById[o.id];
        if (!d) return true; // detay yüklenene kadar liste dışlamayalım
        const hasMethod = d.payments.some((p) =>
          methodFilters.includes(p.method)
        );
        if (!hasMethod) return false;
      }
      return true;
    });
  }, [statusHeaderFiltered, paymentStatus, methodFilters, detailById]);

  // List aggregates (yalnızca liste payload)
  const listAgg = useMemo(() => {
    let net = 0,
      paid = 0;
    for (const o of filtered) {
      const n = Number(o.netTotal ?? o.total ?? 0);
      const p = Number(o.paidTotal ?? o.totalPaid ?? 0);
      net += n;
      paid += p;
    }
    const balance = Math.max(0, net - paid);
    const ratio = net > 0 ? paid / net : 0;
    return { net, paid, balance, ratio, count: filtered.length };
  }, [filtered]);

  // CSV (filtrelenmiş)
  const downloadOrdersCSV = () => {
    if (!filtered.length) return;
    const rows = [
      ["ID", "Tarih", "Müşteri", "Durum", "NET (₺)", "Ödenen (₺)", "Kalan (₺)"],
      ...filtered.map((o) => {
        const net = Number(o.netTotal ?? o.total ?? 0);
        const paid = Number(o.paidTotal ?? o.totalPaid ?? 0);
        const bal = Number(o.balance ?? Math.max(0, net - paid));
        return [
          o.id,
          new Date(o.createdAt).toISOString(),
          o.customerName ?? "",
          o.status,
          String(net),
          String(paid),
          String(bal),
        ];
      }),
    ];
    const csv = rows
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `siparisler_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Ödeme ekle
  const addPayment = async (id: string) => {
    const amountStr = (payAmount[id] ?? "").trim();
    const amount = parseFloat(amountStr.replace(",", "."));
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("Geçerli bir ödeme tutarı girin.");
      return;
    }
    const method = payMethod[id] ?? "CASH";
    const note = (payNote[id] ?? "").trim() || undefined;

    setPaySaving((s) => ({ ...s, [id]: true }));
    try {
      const res = await fetch(`/api/orders/${id}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount, method, note }),
      });
      if (!res.ok) {
        const t = await res.text().catch(() => "");
        throw new Error(t || "Ödeme kaydedilemedi");
      }

      // ✅ Listeyi optimistik güncelle
      setOrders((prev) =>
        prev.map((o) => {
          if (o.id !== id) return o;
          const net = Number(o.netTotal ?? o.total ?? 0);
          const paid = Number(o.paidTotal ?? o.totalPaid ?? 0) + amount;
          const balance = Math.max(0, net - paid);
          return { ...o, paidTotal: paid, totalPaid: paid, balance };
        })
      );

      // ✅ Detayı yenile (ödeme geçmişi tablosu için)
      await fetchOrderDetail(id);

      setPayAmount((m) => ({ ...m, [id]: "" }));
      setPayNote((m) => ({ ...m, [id]: "" }));
      toast.success("Ödeme kaydedildi");
    } catch (e: any) {
      toast.error(e?.message || "Ödeme kaydedilemedi");
    } finally {
      setPaySaving((s) => ({ ...s, [id]: false }));
    }
  };

  const toggleMethod = (m: PaymentMethod) =>
    setMethodFilters((prev) =>
      prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]
    );

  const Skeleton = () => (
    <div className="animate-pulse space-y-3 rounded-2xl border border-neutral-200 p-4">
      <div className="h-4 w-40 rounded bg-neutral-200" />
      <div className="h-3 w-64 rounded bg-neutral-200" />
      <div className="h-3 w-52 rounded bg-neutral-200" />
      <div className="mt-2 h-24 w-full rounded bg-neutral-100" />
    </div>
  );

  return (
    <main className="mx-auto max-w-7xl p-3 sm:p-6 overflow-x-hidden">
      {/* HEADER */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight">Siparişler</h1>
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
              ] as {
                k: HeaderFilter;
                label: string;
              }[]
            ).map(({ k, label }) => (
              <button
                key={k}
                role="tab"
                aria-selected={headerFilter === k}
                onClick={() => setHeaderFilter(k)}
                className={`px-3 py-1.5 text-sm rounded-[10px] transition ${
                  headerFilter === k
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
            onClick={onRefresh}
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
            onClick={downloadOrdersCSV}
            disabled={!filtered.length}
            title="CSV indir (filtrelenmiş)"
          >
            <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
              <path
                fill="currentColor"
                d="M12 3v10l4-4 1.4 1.4L12 17l-5.4-6.6L8 9l4 4V3zM5 19h14v2H5z"
              />
            </svg>
            CSV
          </button>

          <a
            href="/order/new"
            className="inline-flex h-9 items-center gap-2 rounded-xl bg-indigo-600 px-3 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700"
          >
            <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
              <path fill="currentColor" d="M11 11V6h2v5h5v2h-5v5h-2v-5H6v-2z" />
            </svg>
            Yeni Sipariş
          </a>
        </div>
      </div>

      {/* Filtreler */}
      <div className="rounded-2xl border border-neutral-200 bg-white p-3 sm:p-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full sm:w-80">
            <input
              className="h-9 w-full rounded-xl border border-neutral-200 bg-white px-3 pe-9 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
              placeholder="Arama yap"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              aria-label="Siparişlerde ara"
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

          <div className="ms-auto flex w-full justify-between gap-2 sm:w-auto">
            <button
              type="button"
              onClick={() => setFiltersOpen((s) => !s)}
              className="inline-flex h-9 items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 text-sm text-neutral-700 hover:bg-neutral-50 sm:hidden"
              aria-expanded={filtersOpen}
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

        <div
          className={[
            "mt-3 grid gap-2 sm:mt-4 sm:grid-cols-3",
            filtersOpen ? "grid" : "hidden sm:grid",
          ].join(" ")}
        >
          {/* Ödeme Durumu */}
          <div className="rounded-xl border border-neutral-200 p-3">
            <div className="mb-2 text-xs font-semibold text-neutral-500">
              Ödeme Durumu
            </div>
            <div className="flex flex-wrap gap-2">
              {[
                { v: "all", label: "Tümü" },
                { v: "unpaid", label: "Ödenmemiş" },
                { v: "partial", label: "Kısmi" },
                { v: "paid", label: "Tam Ödendi" },
              ].map((b) => {
                const active = paymentStatus === (b.v as any);
                return (
                  <button
                    key={b.v}
                    type="button"
                    onClick={() => setPaymentStatus(b.v as any)}
                    className={`h-8 rounded-lg border px-3 text-xs ${
                      active
                        ? "border-amber-600 bg-amber-600 text-white"
                        : "border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50"
                    }`}
                    aria-pressed={active}
                  >
                    {b.label}
                  </button>
                );
              })}
            </div>
            {paymentStatus !== "all" && (
              <div className="mt-2 text-[11px] text-neutral-500">
                Not: Durum filtresi liste verileriyle hesaplanır, ek detay
                isteği yapılmaz.
              </div>
            )}
          </div>

          {/* Ödeme Yöntemi */}
          <div className="rounded-xl border border-neutral-200 p-3">
            <div className="mb-2 text-xs font-semibold text-neutral-500">
              Ödeme Yöntemi
            </div>
            <div className="flex flex-wrap gap-2">
              {(["CASH", "TRANSFER", "CARD"] as PaymentMethod[]).map((m) => {
                const active = methodFilters.includes(m);
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() =>
                      setMethodFilters((prev) =>
                        prev.includes(m)
                          ? prev.filter((x) => x !== m)
                          : [...prev, m]
                      )
                    }
                    className={`h-8 rounded-lg border px-3 text-xs ${
                      active
                        ? "border-emerald-600 bg-emerald-600 text-white"
                        : "border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50"
                    }`}
                    aria-pressed={active}
                  >
                    {methodLabel[m]}
                  </button>
                );
              })}
            </div>
            {methodFilters.length > 0 && (
              <div className="mt-2 text-[11px] text-neutral-500">
                Not: Yöntem filtresi için ilgili siparişlerin ödeme geçmişleri
                arka planda yüklenir.
              </div>
            )}
          </div>

          {/* ✅ Bayi */}
          <div className="rounded-xl border border-neutral-200 p-3">
            <div className="mb-2 text-xs font-semibold text-neutral-500">
              Bayi
            </div>
            <select
                    className="select w-full rounded-lg border border-neutral-200 bg-white px-1 py-1 text-sm text-neutral-700 hover:bg-neutral-50 h-[32px]"
                    value={dealerFilter}
                    onChange={(e) => setDealerFilter(e.target.value)}
                    aria-label="Bayi filtresi"
                  >
                    <option value="all">Tümü</option>
                    {dealers.map((name) => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                  </select>

            {/* İstersen hızlı butonlar */}
            {/* {!!dealers.length && (
              <div className="mt-2 flex flex-wrap gap-2">
                {dealers.slice(0, 6).map((name) => {
                  const active = dealerFilter === name;
                  return (
                    <button
                      key={name}
                      type="button"
                      onClick={() => setDealerFilter(name)}
                      className={`h-8 rounded-lg border px-3 text-xs ${
                        active
                          ? "border-neutral-900 bg-neutral-900 text-white"
                          : "border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50"
                      }`}
                      aria-pressed={active}
                      title={name}
                    >
                      {name}
                    </button>
                  );
                })}
                {dealers.length > 6 && (
                  <button
                    type="button"
                    onClick={() => setDealerFilter("all")}
                    className="h-8 rounded-lg border border-neutral-200 bg-white px-3 text-xs text-neutral-700 hover:bg-neutral-50"
                    title="Tümü"
                  >
                    Tümü
                  </button>
                )}
              </div>
            )} */}
          </div>
        </div>
      </div>

      {/* Uyarılar */}
      {loading && <p className="mt-3 text-sm text-neutral-500">Yükleniyor…</p>}
      {error && (
        <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}{" "}
          <button
            type="button"
            onClick={onRefresh}
            className="underline decoration-rose-400 underline-offset-2 hover:text-rose-800"
          >
            Tekrar dene
          </button>
        </div>
      )}
      {!loading && filtered.length === 0 && !error && (
        <p className="mt-3 text-neutral-600">Sonuç bulunamadı.</p>
      )}

      {/* Liste */}
      <div className="mt-4 space-y-4">
        {loading && orders.length === 0 && (
          <>
            <Skeleton />
            <Skeleton />
            <Skeleton />
          </>
        )}

        {!loading &&
          filtered.map((order, idx) => {
            const num = filtered.length - idx;
            const isOpen = openIds.has(order.id);
            const d = detailById[order.id];
            const detailId = `order-detail-${order.id}`;

            const net = Number(order.netTotal ?? order.total ?? 0);
            const paid = Number(order.paidTotal ?? order.totalPaid ?? 0);
            const balance = Number(order.balance ?? Math.max(0, net - paid));
            const ratio = net > 0 ? paid / net : 0;

            return (
              <section
                key={order.id}
                className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm"
              >
                {/* Header */}
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <div className="font-semibold">Sipariş #{num}</div>
                      <StatusBadge s={order.status} />
                      <RatioBadge ratio={ratio} />
                    </div>
                    <div className="text-sm max-w-[240px] break-words sm:max-w-none">
                      <span className="font-medium">
                        <b>Bayi</b>:
                      </span>{" "}
                      {order.dealer.name || "—"}
                    </div>
                    <div className="text-sm max-w-[240px] break-words sm:max-w-none">
                      <span className="font-medium">
                        <b>Müşteri:</b>
                      </span>{" "}
                      {order.customerName || "—"}
                    </div>
                    <div className="text-sm max-w-[240px] break-words sm:max-w-none">
                      <span className="font-medium">
                        <b>Telefon:</b>
                      </span>{" "}
                      {order.customerPhone || "—"}
                    </div>
                  </div>

                  <div className="flex flex-col items-end">
                    <div className="mb-2.5 flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1 rounded-lg bg-neutral-50 px-2.5 py-1 text-xs font-medium text-neutral-700 ring-1 ring-inset ring-neutral-200">
                        NET: <strong className="ms-1">{fmt(net)} ₺</strong>
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-200">
                        Ödenen: <strong className="ms-1">{fmt(paid)} ₺</strong>
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-lg bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-200">
                        Kalan:{" "}
                        <strong className="ms-1">{fmt(balance)} ₺</strong>
                      </span>
                    </div>

                    <div className="mb-2.5 text-right text-xs text-neutral-500">
                      {new Intl.DateTimeFormat("tr-TR", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      }).format(new Date(order.createdAt))}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <a
                        href={`/orders/${order.id}`}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-neutral-200 bg-white px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50"
                        title="Düzenle"
                      >
                        <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
                          <path
                            fill="currentColor"
                            d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1.003 1.003 0 0 0 0-1.42l-2.34-2.34a1.003 1.003 0 0 0-1.42 0l-1.83 1.83l3.75 3.75l1.84-1.82z"
                          />
                        </svg>
                        Düzenle
                      </a>

                      <button
                        className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-700 hover:bg-emerald-100"
                        onClick={() => openPayModal(order.id)}
                        title="Ödeme Yap"
                      >
                        <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
                          <path
                            fill="currentColor"
                            d="M12 21a9 9 0 1 1 9-9h-2a7 7 0 1 0-7 7v2zm1-9h5v2h-7V7h2v5z"
                          />
                        </svg>
                        Ödeme Yap
                      </button>

                      <button
                        className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-sm font-medium text-rose-700 hover:bg-rose-100 disabled:opacity-50"
                        onClick={() => removeOrder(order.id)}
                        disabled={deletingId === order.id}
                        title="Sil"
                      >
                        <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
                          <path
                            fill="currentColor"
                            d="M6 7h12l-1 14H7L6 7zm3-3h6l1 2H8l1-2z"
                          />
                        </svg>
                        {deletingId === order.id ? "Siliniyor…" : "Sil"}
                      </button>

                      <button
                        className="inline-flex items-center gap-1.5 rounded-xl border border-neutral-200 bg-white px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50"
                        aria-expanded={isOpen}
                        aria-controls={detailId}
                        onClick={() => toggleOpen(order.id)}
                        title={isOpen ? "Detayı gizle" : "Detayı göster"}
                      >
                        <svg
                          viewBox="0 0 24 24"
                          className={`size-4 transition-transform ${
                            isOpen ? "rotate-180" : ""
                          }`}
                          aria-hidden
                        >
                          <path fill="currentColor" d="M7 10l5 5 5-5H7z" />
                        </svg>
                        {isOpen ? "Gizle" : "Detay"}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Tahsilat Progress */}
                <div className="mt-3">
                  <Progress
                    value={Math.max(0, Math.min(100, Math.round(ratio * 100)))}
                  />
                </div>

                {/* Detay */}
                {isOpen && (
                  <div id={detailId} className="mt-4 space-y-4">
                    {/* Not */}
                    {order.note && (
                      <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-3 text-sm">
                        <span className="font-medium">Sipariş Notu:</span>{" "}
                        {order.note}
                      </div>
                    )}

                    {/* Mobil kalemler */}
                    <div className="sm:hidden">
                      <ul className="divide-y rounded-2xl border border-neutral-200">
                        {order.items.map((it) => (
                          <li key={it.id} className="p-3">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <div className="truncate text-sm font-medium">
                                  {it.category.name} · {it.variant.name}
                                </div>
                                {it.note && (
                                  <div className="mt-0.5 text-[11px] text-neutral-500 break-words">
                                    Not: {it.note}
                                  </div>
                                )}
                              </div>
                              <div className="shrink-0 text-right text-sm font-semibold">
                                {fmt(Number(it.subtotal))} ₺
                              </div>
                            </div>
                            <div className="mt-1 grid grid-cols-2 text-xs text-neutral-600">
                              <div>
                                Adet:{" "}
                                <span className="font-medium">{it.qty}</span>
                              </div>
                              <div className="text-right">
                                Birim:{" "}
                                <span className="font-medium">
                                  {fmt(Number(it.unitPrice))}
                                </span>
                              </div>
                              <div>
                                En:{" "}
                                <span className="font-medium">{it.width}</span>
                              </div>
                              <div className="text-right">
                                Boy:{" "}
                                <span className="font-medium">{it.height}</span>
                              </div>
                            </div>
                          </li>
                        ))}
                      </ul>
                      <div className="mt-2 rounded-2xl border border-neutral-200 bg-neutral-50 p-3 text-sm">
                        <div className="flex justify-between">
                          <span className="font-semibold">Toplam</span>
                          <span className="font-bold">
                            {fmt(Number(d?.total ?? order.total ?? 0))} ₺
                          </span>
                        </div>
                        <div className="mt-1 flex justify-between">
                          <span className="font-semibold">İskonto</span>
                          <span>- {fmt(Number(d?.discount ?? 0))} ₺</span>
                        </div>
                        <div className="mt-1 flex justify-between">
                          <span className="font-semibold">NET</span>
                          <span className="font-bold">
                            {fmt(
                              Number(
                                d?.netTotal ??
                                  order.netTotal ??
                                  order.total ??
                                  0
                              )
                            )}{" "}
                            ₺
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Desktop kalemler */}
                    <div className="hidden sm:block overflow-x-auto rounded-2xl border border-neutral-200">
                      <table className="min-w-full text-sm">
                        <thead className="bg-neutral-50">
                          <tr className="[&>th]:px-3 [&>th]:py-2 text-left text-neutral-500">
                            <th>Kategori</th>
                            <th>Varyant</th>
                            <th className="text-right">Adet</th>
                            <th className="text-right">En</th>
                            <th className="text-right">Boy</th>
                            <th className="text-right">Birim</th>
                            <th className="text-right">Tutar</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {order.items.map((it) => (
                            <tr key={it.id} className="[&>td]:px-3 [&>td]:py-2">
                              <td>{it.category.name}</td>
                              <td>
                                <div>{it.variant.name}</div>
                                {it.note && (
                                  <div className="text-xs text-neutral-500">
                                    Not: {it.note}
                                  </div>
                                )}
                              </td>
                              <td className="text-right">{it.qty}</td>
                              <td className="text-right">{it.width}</td>
                              <td className="text-right">{it.height}</td>
                              <td className="text-right">
                                {fmt(Number(it.unitPrice))}
                              </td>
                              <td className="text-right">
                                {fmt(Number(it.subtotal))}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="bg-neutral-50">
                          <tr className="[&>td]:px-3 [&>td]:py-2">
                            <td
                              colSpan={6}
                              className="text-right font-semibold"
                            >
                              Toplam
                            </td>
                            <td className="text-right font-bold">
                              {fmt(Number(d?.total ?? order.total ?? 0))} ₺
                            </td>
                          </tr>
                          <tr className="[&>td]:px-3 [&>td]:py-2">
                            <td
                              colSpan={6}
                              className="text-right font-semibold"
                            >
                              İskonto
                            </td>
                            <td className="text-right">
                              - {fmt(Number(d?.discount ?? 0))} ₺
                            </td>
                          </tr>
                          <tr className="[&>td]:px-3 [&>td]:py-2">
                            <td
                              colSpan={6}
                              className="text-right font-semibold"
                            >
                              NET
                            </td>
                            <td className="text-right font-bold">
                              {fmt(
                                Number(
                                  d?.netTotal ??
                                    order.netTotal ??
                                    order.total ??
                                    0
                                )
                              )}{" "}
                              ₺
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>

                    {/* Ödemeler */}
                    <div className="rounded-2xl border border-neutral-200 p-3">
                      <div className="mb-2 font-medium">Alınan Ödemeler</div>
                      {(d?.payments?.length ?? 0) === 0 ? (
                        <div className="text-sm text-neutral-500">
                          Henüz ödeme yok.
                        </div>
                      ) : (
                        <>
                          {/* Mobil */}
                          <div className="sm:hidden">
                            <ul className="divide-y rounded-2xl border border-neutral-200">
                              {d!.payments.map((p) => (
                                <li key={p.id} className="p-3 text-sm">
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0">
                                      <div className="font-medium">
                                        {methodLabel[p.method as PaymentMethod]}
                                      </div>
                                      <div className="mt-0.5 text-xs text-neutral-600">
                                        {new Intl.DateTimeFormat("tr-TR", {
                                          dateStyle: "medium",
                                          timeStyle: "short",
                                        }).format(new Date(p.paidAt))}
                                      </div>
                                      {p.note && (
                                        <div className="mt-0.5 text-xs text-neutral-600 break-words">
                                          Not: {p.note}
                                        </div>
                                      )}
                                    </div>
                                    <div className="shrink-0 text-right font-semibold">
                                      {fmt(p.amount)} ₺
                                    </div>
                                  </div>
                                </li>
                              ))}
                            </ul>

                            <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                              <div className="rounded-xl bg-neutral-50 p-2 text-neutral-700 ring-1 ring-inset ring-neutral-200">
                                <div className="text-[11px]">Toplam Ödenen</div>
                                <div className="font-semibold">
                                  {fmt(d!.paidTotal)} ₺
                                </div>
                              </div>
                              <div className="rounded-xl bg-amber-50 p-2 text-amber-700 ring-1 ring-inset ring-amber-200">
                                <div className="text-[11px]">Kalan Borç</div>
                                <div className="font-semibold">
                                  {fmt(d!.balance)} ₺
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Desktop */}
                          <div className="hidden sm:block overflow-x-auto">
                            <table className="min-w-full text-sm">
                              <thead className="bg-neutral-50">
                                <tr className="[&>th]:px-3 [&>th]:py-2 text-left text-neutral-500">
                                  <th>Tarih</th>
                                  <th>Yöntem</th>
                                  <th>Not</th>
                                  <th className="text-right">Tutar</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y">
                                {d!.payments.map((p) => (
                                  <tr
                                    key={p.id}
                                    className="[&>td]:px-3 [&>td]:py-2"
                                  >
                                    <td>
                                      {new Intl.DateTimeFormat("tr-TR", {
                                        dateStyle: "medium",
                                        timeStyle: "short",
                                      }).format(new Date(p.paidAt))}
                                    </td>
                                    <td>
                                      <span className="inline-flex items-center rounded-md bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-700 ring-1 ring-inset ring-neutral-200">
                                        {methodLabel[p.method as PaymentMethod]}
                                      </span>
                                    </td>
                                    <td className="text-neutral-600">
                                      {p.note || "—"}
                                    </td>
                                    <td className="text-right font-medium">
                                      {fmt(p.amount)} ₺
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                              <tfoot className="bg-neutral-50">
                                <tr className="[&>td]:px-3 [&>td]:py-2">
                                  <td
                                    colSpan={3}
                                    className="text-right font-semibold"
                                  >
                                    Toplam Ödenen
                                  </td>
                                  <td className="text-right font-bold">
                                    {fmt(d!.paidTotal)} ₺
                                  </td>
                                </tr>
                                <tr className="[&>td]:px-3 [&>td]:py-2">
                                  <td
                                    colSpan={3}
                                    className="text-right font-semibold"
                                  >
                                    Kalan Borç
                                  </td>
                                  <td className="text-right font-bold">
                                    {fmt(d!.balance)} ₺
                                  </td>
                                </tr>
                              </tfoot>
                            </table>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </section>
            );
          })}
      </div>

      {/* Payment Modal */}
      {payModalOpenId && (
        <div
          ref={modalBackdropRef}
          onClick={onBackdropClick}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-[1px]"
          aria-modal="true"
          role="dialog"
          aria-labelledby="pay-modal-title"
        >
          <div className="w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl border border-neutral-200 bg-white p-4 sm:p-5 shadow-xl transition ease-out animate-[fadeIn_0.15s_ease-out]">
            <div className="mb-3 flex items-start justify-between">
              <div>
                <div id="pay-modal-title" className="text-base font-semibold">
                  Ödeme Yap
                </div>
                <div className="text-xs text-neutral-500">
                  Sipariş ID:{" "}
                  <span className="font-mono">{payModalOpenId}</span>
                </div>
              </div>
              <button
                className="inline-flex size-8 items-center justify-center rounded-xl border border-neutral-200 hover:bg-neutral-50"
                onClick={closePayModal}
                title="Kapat"
              >
                <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
                  <path
                    fill="currentColor"
                    d="M18.3 5.71L12 12.01l-6.29-6.3L4.3 7.12 10.59 13.4l-6.3 6.29 1.42 1.42 6.29-6.3 6.29 6.3 1.42-1.42-6.3-6.29 6.3-6.29z"
                  />
                </svg>
              </button>
            </div>

            {/* Body */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-lg bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-200">
                  Kalan:
                  <strong className="ms-1">
                    {fmt(detailById[payModalOpenId]?.balance ?? 0)} ₺
                  </strong>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    const bal = detailById[payModalOpenId]?.balance ?? 0;
                    setPayAmount((m) => ({
                      ...m,
                      [payModalOpenId]: bal
                        ? String(bal).replace(".", ",")
                        : "",
                    }));
                  }}
                  className="h-8 rounded-lg border border-neutral-200 bg-white px-2.5 text-xs text-neutral-700 hover:bg-neutral-50"
                >
                  Kalanı Doldur
                </button>
              </div>

              <div>
                <label className="text-xs text-neutral-600">Tutar (₺)</label>
                <input
                  className="input mt-1 w-full text-right"
                  placeholder="0,00"
                  inputMode="decimal"
                  value={payAmount[payModalOpenId] ?? ""}
                  onChange={(e) =>
                    setPayAmount((m) => ({
                      ...m,
                      [payModalOpenId]: e.target.value,
                    }))
                  }
                />
                <div className="mt-2 flex flex-wrap gap-2">
                  {[100, 500, 1000].map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() =>
                        setPayAmount((m) => ({
                          ...m,
                          [payModalOpenId]: String(v).replace(".", ","),
                        }))
                      }
                      className="h-8 rounded-lg border border-neutral-200 bg-white px-2.5 text-xs text-neutral-700 hover:bg-neutral-50"
                    >
                      {fmt(v)} ₺
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="mb-1 text-xs text-neutral-600">Ödeme Tipi</div>
                <div className="flex flex-wrap gap-2">
                  {(["CASH", "TRANSFER", "CARD"] as PaymentMethod[]).map(
                    (m) => {
                      const active =
                        (payMethod[payModalOpenId] ?? "CASH") === m;
                      return (
                        <button
                          key={m}
                          type="button"
                          onClick={() =>
                            setPayMethod((s) => ({ ...s, [payModalOpenId]: m }))
                          }
                          className={`inline-flex items-center gap-2 rounded-xl border px-3 py-1.5 text-sm ${
                            active
                              ? "border-neutral-900 bg-neutral-900 text-white"
                              : "border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50"
                          }`}
                          aria-pressed={active}
                        >
                          {methodLabel[m]}
                        </button>
                      );
                    }
                  )}
                </div>
              </div>

              <div>
                <label className="text-xs text-neutral-600">
                  Not (opsiyonel)
                </label>
                <input
                  className="input mt-1 w-full"
                  placeholder="Açıklama…"
                  value={payNote[payModalOpenId] ?? ""}
                  onChange={(e) =>
                    setPayNote((m) => ({
                      ...m,
                      [payModalOpenId]: e.target.value,
                    }))
                  }
                />
              </div>
            </div>

            {/* Footer */}
            <div className="mt-4 flex items-center justify-between">
              <div className="text-xs text-neutral-500">
                {detailLoading[payModalOpenId] ? "Detay yükleniyor…" : "\u00A0"}
                {detailError[payModalOpenId] && (
                  <span className="text-rose-600">
                    {detailError[payModalOpenId]}
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={async () => {
                  await addPayment(payModalOpenId!);
                  closePayModal();
                }}
                disabled={!!paySaving[payModalOpenId!]}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
              >
                {paySaving[payModalOpenId!] ? "Kaydediliyor…" : "Şimdi Öde"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Alt bilgi */}
      <div className="mt-6 text-sm text-neutral-600">
        {fmtInt(listAgg.count)} kayıt • NET: <b>{fmt(listAgg.net)} ₺</b> •
        ÖDENEN: <b>{fmt(listAgg.paid)} ₺</b> • KALAN:{" "}
        <b>{fmt(listAgg.balance)} ₺</b>
      </div>
    </main>
  );
}

/* === Projenizde yoksa basit input/select class’ları ===
.input { @apply h-9 rounded-xl border border-neutral-200 bg-white px-3 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500; }
.select { @apply h-9 rounded-xl border border-neutral-200 bg-white px-3 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500; }
*/

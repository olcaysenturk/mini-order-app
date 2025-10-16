"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

/* ========= Types ========= */
type Status = "pending" | "processing" | "completed" | "cancelled";
type PaymentMethod = "CASH" | "TRANSFER" | "CARD";

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
  customerPhone: string;
  status: Status;
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
  new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

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
  const common =
    "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border";
  const map: Record<Status, string> = {
    pending: `${common} bg-neutral-100 text-neutral-700 border-neutral-200`,
    processing: `${common} bg-blue-50 text-blue-700 border-blue-200`,
    completed: `${common} bg-emerald-50 text-emerald-700 border-emerald-200`,
    cancelled: `${common} bg-rose-50 text-rose-700 border-rose-200`,
  };
  return <span className={map[s]}>{statusLabel[s]}</span>;
}

/* ========= Page ========= */
export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // TEXT + STATUS filters
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | Status>("all");

  // PAYMENT filters
  const [paymentStatus, setPaymentStatus] =
    useState<"all" | "unpaid" | "partial" | "paid">("all");
  const [methodFilters, setMethodFilters] = useState<PaymentMethod[]>([]); // çoklu seçim

  // Responsive filter panel
  const [filtersOpen, setFiltersOpen] = useState(false);

  // expanded orders
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());

  // order details cache
  const [detailById, setDetailById] = useState<Record<string, OrderDetail | undefined>>({});
  const [detailLoading, setDetailLoading] = useState<Record<string, boolean>>({});
  const [detailError, setDetailError] = useState<Record<string, string | null>>({});

  // payment form states
  const [payAmount, setPayAmount] = useState<Record<string, string>>({});
  const [payMethod, setPayMethod] = useState<Record<string, PaymentMethod>>({});
  const [payNote, setPayNote] = useState<Record<string, string>>({});
  const [paySaving, setPaySaving] = useState<Record<string, boolean>>({});

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

  const fetchOrders = async (status: "all" | Status, signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    try {
      const qs = status === "all" ? "" : `?status=${encodeURIComponent(status)}`;
      const res = await fetch(`/api/orders${qs}`, { cache: "no-store", signal });
      if (!res.ok) throw new Error("Siparişler alınamadı");
      const data: Order[] = await res.json();
      setOrders(data);
    } catch (e: unknown) {
      if ((e as any)?.name === "AbortError") return;
      const msg = e instanceof Error ? e.message : "Bilinmeyen hata";
      setError(msg);
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
        paidTotal: Number(data.paidTotal ?? 0),
        balance: Number(data.balance ?? 0),
      };
      setDetailById((m) => ({ ...m, [id]: d }));
      setPayMethod((m) => ({ ...m, [id]: m[id] ?? "CASH" }));
      setPayAmount((m) => ({ ...m, [id]: m[id] ?? "" }));
      setPayNote((m) => ({ ...m, [id]: m[id] ?? "" }));
    } catch (e: any) {
      setDetailError((s) => ({ ...s, [id]: e?.message || "Detay alınamadı" }));
    } finally {
      setDetailLoading((s) => ({ ...s, [id]: false }));
    }
  };

  // ödeme filtresi aktifken, listedeki siparişlerin detaylarını toparla (ilk kez)
  useEffect(() => {
    if (paymentStatus === "all" && methodFilters.length === 0) return;
    const ids = orders.map((o) => o.id);
    (async () => {
      await Promise.all(
        ids.map(async (id) => {
          if (!detailById[id]) {
            try {
              await fetchOrderDetail(id);
            } catch {
              /* yut */
            }
          }
        })
      );
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paymentStatus, methodFilters, orders]);

  // initial + status change
  useEffect(() => {
    const ac = new AbortController();
    fetchOrders(statusFilter, ac.signal);
    return () => ac.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  const onRefresh = () => {
    const ac = new AbortController();
    fetchOrders(statusFilter, ac.signal);
  };

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
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Silmede hata");

    } finally {
      setDeletingId(null);
    }
  };

  // text filter
  const filteredByTextAndStatus = useMemo(() => {
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

  // payment filter
  const filtered = useMemo(() => {
    if (paymentStatus === "all" && methodFilters.length === 0) {
      return filteredByTextAndStatus;
    }

    return filteredByTextAndStatus.filter((o) => {
      const d = detailById[o.id];
      // Detay gelmediyse (yüklenene kadar) elemeden geçir
      if (!d) return true;

      // Ödeme yöntemi filtresi
      if (methodFilters.length > 0) {
        const hasMethod = d.payments.some((p) => methodFilters.includes(p.method));
        if (!hasMethod) return false;
      }

      // Ödeme durumu filtresi
      if (paymentStatus !== "all") {
        const balance = d.balance;
        const net = d.netTotal;
        if (paymentStatus === "unpaid" && !(d.paidTotal === 0 && net > 0)) return false;
        if (paymentStatus === "partial" && !(balance > 0 && d.paidTotal > 0)) return false;
        if (paymentStatus === "paid" && !(balance <= 0 && net >= 0)) return false;
      }

      return true;
    });
  }, [filteredByTextAndStatus, paymentStatus, methodFilters, detailById]);

  const summary = useMemo(() => {
    const count = filtered.length;
    const total = filtered.reduce((acc, o) => acc + Number(o.total || 0), 0);
    return { count, total };
  }, [filtered]);

  // payment add
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
      await fetchOrderDetail(id);
      setPayAmount((m) => ({ ...m, [id]: "" }));
      setPayNote((m) => ({ ...m, [id]: "" }));
    } catch (e: any) {
      toast.error(e?.message || "Ödeme kaydedilemedi");
    } finally {
      setPaySaving((s) => ({ ...s, [id]: false }));
    }
  };

  // simple skeleton
  const Skeleton = () => (
    <div className="animate-pulse space-y-3 rounded-2xl border border-neutral-200 p-4">
      <div className="h-4 w-40 rounded bg-neutral-200" />
      <div className="h-3 w-64 rounded bg-neutral-200" />
      <div className="h-3 w-52 rounded bg-neutral-200" />
      <div className="mt-2 h-24 w-full rounded bg-neutral-100" />
    </div>
  );

  // helper: method filter toggle
  const toggleMethod = (m: PaymentMethod) =>
    setMethodFilters((prev) =>
      prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]
    );

  return (
    <main className="mx-auto max-w-7xl p-4 sm:p-6">
      {/* Başlık + özet */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight">Siparişler</h1>
        <div className="text-sm text-neutral-600">
          {summary.count} kayıt · Toplam {fmt(summary.total)} ₺
        </div>
      </div>

      {/* Filtreler */}
      <div className="mt-4 rounded-2xl border border-neutral-200 bg-white p-3 sm:p-4">
        {/* Üst satır: durum chip’leri + responsive arama + panel butonu */}
        <div className="flex flex-wrap items-center gap-2">
         

              <input
                className="h-9 w-full sm:w-80 rounded-xl border border-neutral-200 bg-white px-3 pe-9 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                placeholder="Arama yap"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                aria-label="Siparişlerde ara"
              />
          <div className="ms-auto flex w-full justify-between gap-2 sm:w-auto">
            {/* Arama (mobile full width) */}
            

            {/* Gelişmiş filtre paneli aç/kapat (mobile visible) */}
            <button
              type="button"
              onClick={() => setFiltersOpen((s) => !s)}
              className="inline-flex h-9 items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 text-sm text-neutral-700 hover:bg-neutral-50 sm:hidden"
              aria-expanded={filtersOpen}
            >
              <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
                <path fill="currentColor" d="M3 5h18v2H3zM6 11h12v2H6zm3 6h6v2H9z" />
              </svg>
              Filtreler
            </button>

            {/* <button
              type="button"
              onClick={() => {
                setQ("");
                setPaymentStatus("all");
                setMethodFilters([]);
              }}
              className="h-9 rounded-xl border border-neutral-200 bg-white px-3 text-sm text-neutral-700 hover:bg-neutral-50"
            >
              Temizle
            </button> */}

            {/* Yenile */}
            <button
              type="button"
              onClick={onRefresh}
              className="hidden sm:inline-flex h-9 items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 text-sm text-neutral-700 hover:bg-neutral-50"
              title="Listeyi yenile"
            >
              
              <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
                <path fill="currentColor" d="M12 6V3L8 7l4 4V8a4 4 0 1 1-4 4H6a6 6 0 1 0 6-6z" />
              </svg>
              Yenile
            </button>

            <a
              href="/order"
              className="h-9 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-3 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700"
            >
              <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
                <path fill="currentColor" d="M11 11V6h2v5h5v2h-5v5h-2v-5H6v-2z" />
              </svg>
              Yeni Sipariş
            </a>
          </div>
        </div>

        {/* Gelişmiş filtreler: desktop’ta satır içi, mobile’da panel */}
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
                    className={[
                      "h-8 rounded-lg border px-3 text-xs",
                      active
                        ? "border-amber-600 bg-amber-600 text-white"
                        : "border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50",
                    ].join(" ")}
                    aria-pressed={active}
                  >
                    {b.label}
                  </button>
                );
              })}
            </div>
            {paymentStatus !== "all" && (
              <div className="mt-2 text-[11px] text-neutral-500">
                Not: Bu filtre aktifken listelenen siparişlerin ödeme detayları arka planda yüklenir.
              </div>
            )}
          </div>

          {/* Ödeme Yöntemi (çoklu) */}
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
                    onClick={() => toggleMethod(m)}
                    className={[
                      "h-8 rounded-lg border px-3 text-xs",
                      active
                        ? "border-emerald-600 bg-emerald-600 text-white"
                        : "border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50",
                    ].join(" ")}
                    aria-pressed={active}
                  >
                    {methodLabel[m]}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-xl border border-neutral-200 p-3">
            <div className="mb-2 text-xs font-semibold text-neutral-500">
              Sipariş Durumu
            </div>
            <div className="flex flex-wrap gap-2">
               {[
              { v: "all", label: "Tümü" },
              { v: "pending", label: "Beklemede" },
              { v: "processing", label: "İşlemde" },
              { v: "completed", label: "Tamamlandı" },
              { v: "cancelled", label: "İptal" },
            ].map((b) => {
              const active = statusFilter === (b.v as any);
              return (
                <button
                  key={b.v}
                  type="button"
                  onClick={() => setStatusFilter(b.v as any)}
                  className={[
                    "h-9 shrink-0 rounded-xl border px-3 text-sm",
                    active
                      ? "border-neutral-900 bg-neutral-900 text-white"
                      : "border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50",
                  ].join(" ")}
                  aria-pressed={active}
                >
                  {b.label}
                </button>
              );
            })}
            </div>
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
                    </div>
                    <div className="text-sm">
                      <span className="font-medium">Müşteri:</span>{" "}
                      {order.customerName || "—"}
                    </div>
                    <div className="text-sm">
                      <span className="font-medium">Telefon:</span>{" "}
                      {order.customerPhone || "—"}
                    </div>
                  </div>

                  <div className="flex flex-col items-end">
                    {/* Ödeme özet pill’leri */}
                    <div className="mb-2.5 flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1 rounded-lg bg-neutral-50 px-2.5 py-1 text-xs font-medium text-neutral-700 ring-1 ring-inset ring-neutral-200">
                        Toplam:{" "}
                        <strong className="ms-1">
                          {fmt(d?.netTotal ?? order.total ?? 0)} ₺
                        </strong>
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-200">
                        Ödenen:{" "}
                        <strong className="ms-1">
                          {fmt(d?.paidTotal ?? 0)} ₺
                        </strong>
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-lg bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-200">
                        Kalan:{" "}
                        <strong className="ms-1">
                          {fmt(d?.balance ?? (order.total ?? 0))} ₺
                        </strong>
                      </span>
                    </div>

                    <div className="mb-2.5 text-right text-xs text-neutral-500">
                      {new Intl.DateTimeFormat("tr-TR", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      }).format(new Date(order.createdAt))}
                    </div>

                    <div className="flex items-center gap-2">
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
                        className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-sm font-medium text-rose-700 hover:bg-rose-100 disabled:opacity-50"
                        onClick={() => removeOrder(order.id)}
                        disabled={deletingId === order.id}
                        title="Sil"
                      >
                        <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
                          <path fill="currentColor" d="M6 7h12l-1 14H7L6 7zm3-3h6l1 2H8l1-2z" />
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

                {/* Detay */}
                {isOpen && (
                  <div id={detailId} className="mt-4 space-y-4">
                    {/* Ödeme Ekle */}
                    <div className="rounded-xl border border-neutral-200 p-3">
                      <div className="mb-2 flex items-center justify-between">
                        <div className="font-medium">Ödeme Ekle</div>
                        {detailLoading[order.id] && (
                          <div className="text-xs text-neutral-500">Yükleniyor…</div>
                        )}
                        {detailError[order.id] && (
                          <div className="text-xs text-rose-600">
                            {detailError[order.id]}
                          </div>
                        )}
                      </div>

                      <div className="grid gap-2 sm:grid-cols-4">
                        <div className="sm:col-span-1">
                          <label className="text-xs text-neutral-600">Tutar (₺)</label>
                          <input
                            className="input mt-1 w-full text-right"
                            placeholder="0,00"
                            inputMode="decimal"
                            value={payAmount[order.id] ?? ""}
                            onChange={(e) =>
                              setPayAmount((m) => ({ ...m, [order.id]: e.target.value }))
                            }
                          />
                        </div>
                        <div className="sm:col-span-1">
                          <label className="text-xs text-neutral-600">Ödeme Tipi</label>
                          <select
                            className="select mt-1 w-full"
                            value={payMethod[order.id] ?? "CASH"}
                            onChange={(e) =>
                              setPayMethod((m) => ({
                                ...m,
                                [order.id]: e.target.value as PaymentMethod,
                              }))
                            }
                          >
                            <option value="CASH">Nakit</option>
                            <option value="TRANSFER">Havale/EFT</option>
                            <option value="CARD">Kredi Kartı</option>
                          </select>
                        </div>
                        <div className="sm:col-span-2">
                          <label className="text-xs text-neutral-600">Not (opsiyonel)</label>
                          <input
                            className="input mt-1 w-full"
                            placeholder="Açıklama…"
                            value={payNote[order.id] ?? ""}
                            onChange={(e) =>
                              setPayNote((m) => ({ ...m, [order.id]: e.target.value }))
                            }
                          />
                        </div>
                      </div>

                      <div className="mt-3 flex items-center justify-between">
                        <div className="text-sm text-neutral-600">
                          Kalan:&nbsp;
                          <span className="font-semibold">
                            {fmt(d?.balance ?? 0)} ₺
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => addPayment(order.id)}
                          disabled={!!paySaving[order.id]}
                          className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
                        >
                          {paySaving[order.id] ? (
                            <>
                              <svg className="size-4 animate-spin" viewBox="0 0 24 24">
                                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" opacity=".25" />
                                <path d="M4 12a8 8 0 0 1 8-8" stroke="currentColor" strokeWidth="4" fill="none" />
                              </svg>
                              Kaydediliyor…
                            </>
                          ) : (
                            <>
                              <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
                                <path fill="currentColor" d="M12 21a9 9 0 1 1 9-9h-2a7 7 0 1 0-7 7v2zm1-9h5v2h-7V7h2v5z" />
                              </svg>
                              Ödeme Ekle
                            </>
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Not */}
                    {order.note && (
                      <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-3 text-sm">
                        <span className="font-medium">Sipariş Notu:</span> {order.note}
                      </div>
                    )}

                    {/* Kalemler */}
                    <div className="overflow-x-auto rounded-xl border border-neutral-200">
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
                                  <div className="text-xs text-neutral-500">Not: {it.note}</div>
                                )}
                              </td>
                              <td className="text-right">{it.qty}</td>
                              <td className="text-right">{it.width}</td>
                              <td className="text-right">{it.height}</td>
                              <td className="text-right">{fmt(Number(it.unitPrice))}</td>
                              <td className="text-right">{fmt(Number(it.subtotal))}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="bg-neutral-50">
                          <tr className="[&>td]:px-3 [&>td]:py-2">
                            <td colSpan={6} className="text-right font-semibold">
                              Toplam
                            </td>
                            <td className="text-right font-bold">
                              {fmt(Number(d?.total ?? order.total ?? 0))} ₺
                            </td>
                          </tr>
                          <tr className="[&>td]:px-3 [&>td]:py-2">
                            <td colSpan={6} className="text-right font-semibold">
                              İskonto
                            </td>
                            <td className="text-right">- {fmt(Number(d?.discount ?? 0))} ₺</td>
                          </tr>
                          <tr className="[&>td]:px-3 [&>td]:py-2">
                            <td colSpan={6} className="text-right font-semibold">
                              NET
                            </td>
                            <td className="text-right font-bold">
                              {fmt(Number(d?.netTotal ?? order.total ?? 0))} ₺
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>

                    {/* Ödemeler */}
                    <div className="rounded-xl border border-neutral-200 p-3">
                      <div className="mb-2 font-medium">Alınan Ödemeler</div>
                      {(d?.payments?.length ?? 0) === 0 ? (
                        <div className="text-sm text-neutral-500">Henüz ödeme yok.</div>
                      ) : (
                        <div className="overflow-x-auto">
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
                                <tr key={p.id} className="[&>td]:px-3 [&>td]:py-2">
                                  <td>
                                    {new Intl.DateTimeFormat("tr-TR", {
                                      dateStyle: "medium",
                                      timeStyle: "short",
                                    }).format(new Date(p.paidAt))}
                                  </td>
                                  <td>
                                    <span className="inline-flex items-center rounded-md bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-700 ring-1 ring-inset ring-neutral-200">
                                      {methodLabel[p.method]}
                                    </span>
                                  </td>
                                  <td className="text-neutral-600">{p.note || "—"}</td>
                                  <td className="text-right font-medium">{fmt(p.amount)} ₺</td>
                                </tr>
                              ))}
                            </tbody>
                            <tfoot className="bg-neutral-50">
                              <tr className="[&>td]:px-3 [&>td]:py-2">
                                <td colSpan={3} className="text-right font-semibold">
                                  Toplam Ödenen
                                </td>
                                <td className="text-right font-bold">{fmt(d!.paidTotal)} ₺</td>
                              </tr>
                              <tr className="[&>td]:px-3 [&>td]:py-2">
                                <td colSpan={3} className="text-right font-semibold">
                                  Kalan Borç
                                </td>
                                <td className="text-right font-bold">{fmt(d!.balance)} ₺</td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </section>
            );
          })}
      </div>
    </main>
  );
}

/* === Projenizde yoksa basit input/select class’ları ===
.input { @apply h-9 rounded-xl border border-neutral-200 bg-white px-3 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500; }
.select { @apply h-9 rounded-xl border border-neutral-200 bg-white px-3 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500; }
*/

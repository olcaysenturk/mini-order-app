"use client";

import { useEffect, useMemo, useState } from "react";

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

type Status = "pending" | "processing" | "completed" | "cancelled";

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

const fmt = (n: number) =>
  new Intl.NumberFormat("tr-TR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);

const statusLabel: Record<Status, string> = {
  pending: "Beklemede",
  processing: "İşlemde",
  completed: "Tamamlandı",
  cancelled: "İptal",
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

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // filtreler
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | Status>("all");

  // Açık (genişletilmiş) sipariş id'leri
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());
  const toggleOpen = (id: string) => {
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
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
      if ((e as any)?.name === "AbortError") return; // sayfadan ayrılma/filtre değişimi
      const msg = e instanceof Error ? e.message : "Bilinmeyen hata";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  // ilk yükleme + status değişiminde yeniden çek (iptalli güvenli)
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
      alert(e instanceof Error ? e.message : "Silmede hata");
    } finally {
      setDeletingId(null);
    }
  };

  // Metin araması (müşteri, telefon, not, kategori/varyant / id)
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return orders;
    return orders.filter((o) => {
      const inHeader =
        o.id.toLowerCase().includes(needle) ||
        (o.note || "").toLowerCase().includes(needle) ||
        (o.customerName || "").toLowerCase().includes(needle) ||
        (o.customerPhone || "").toLowerCase().includes(needle);

      const inItems = o.items.some(
        (it) =>
          it.category.name.toLowerCase().includes(needle) ||
          it.variant.name.toLowerCase().includes(needle) ||
          (it.note || "").toLowerCase().includes(needle)
      );
      return inHeader || inItems;
    });
  }, [orders, q]);

  const summary = useMemo(() => {
    const count = filtered.length;
    const total = filtered.reduce((acc, o) => acc + Number(o.total || 0), 0);
    return { count, total };
  }, [filtered]);

  // loading skeleton
  const Skeleton = () => (
    <div className="animate-pulse space-y-3 rounded-2xl border border-neutral-200 p-4">
      <div className="h-4 w-40 rounded bg-neutral-200" />
      <div className="h-3 w-64 rounded bg-neutral-200" />
      <div className="h-3 w-52 rounded bg-neutral-200" />
      <div className="mt-2 h-24 w-full rounded bg-neutral-100" />
    </div>
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

      {/* Filtre çubuğu */}
      <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-neutral-200 bg-white p-3 sm:p-4">
        <div className="flex flex-wrap items-center gap-2">
          {/* Durum buton grubu */}
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
                  "inline-flex items-center rounded-xl border px-3 py-1.5 text-sm",
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

          <div className="ms-auto flex items-center gap-2">
            {/* Arama */}
            <div className="relative">
              <input
                className="h-9 w-72 rounded-xl border border-neutral-200 bg-white px-3 pe-9 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                placeholder="Ara: müşteri, telefon, not, kategori/varyant…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                aria-label="Siparişlerde ara"
              />
              {q && (
                <button
                  type="button"
                  onClick={() => setQ("")}
                  className="absolute right-1.5 top-1.5 grid size-6 place-items-center rounded-md text-neutral-500 hover:bg-neutral-100"
                  aria-label="Aramayı temizle"
                  title="Temizle"
                >
                  <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
                    <path
                      fill="currentColor"
                      d="M18 6L6 18M6 6l12 12"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                  </svg>
                </button>
              )}
            </div>

            {/* Yenile */}
            <button
              type="button"
              onClick={onRefresh}
              className="inline-flex h-9 items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 text-sm text-neutral-700 hover:bg-neutral-50"
              title="Listeyi yenile"
            >
              <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
                <path
                  fill="currentColor"
                  d="M12 6V3L8 7l4 4V8a4 4 0 1 1-4 4H6a6 6 0 1 0 6-6z"
                />
              </svg>
              Yenile
            </button>

            {/* Yeni sipariş */}
            <a
              href="/order"
              className="inline-flex h-9 items-center gap-2 rounded-xl bg-indigo-600 px-3 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700"
            >
              <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
                <path fill="currentColor" d="M11 11V6h2v5h5v2h-5v5h-2v-5H6v-2z" />
              </svg>
              Yeni
            </a>
          </div>
        </div>
      </div>

      {/* Uyarılar */}
      {loading && (
        <p className="mt-3 text-sm text-neutral-500">Yükleniyor…</p>
      )}
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

                {/* Detay */}
                {isOpen && (
                  <div id={detailId} className="mt-4">
                    {order.note && (
                      <div className="mb-3 text-sm">
                        <span className="font-medium">Sipariş Notu:</span>{" "}
                        {order.note}
                      </div>
                    )}

                    <div className="overflow-x-auto">
                      <table className="min-w-full text-sm">
                        <thead>
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
                        <tfoot>
                          <tr className="[&>td]:px-3 [&>td]:py-2">
                            <td colSpan={6} className="text-right font-semibold">
                              Toplam
                            </td>
                            <td className="text-right font-bold">
                              {fmt(Number(order.total))} ₺
                            </td>
                          </tr>
                        </tfoot>
                      </table>
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

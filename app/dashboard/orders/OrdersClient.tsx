// app/orders/page.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

type ConfirmState = {
  id: string;
  title: string;
  description?: string;
  confirmText?: string;
};

/* ========= Types ========= */
type Status = "pending" | "processing" | "completed" | "cancelled" | "workshop" | "deleted";
type PaymentMethod = "CASH" | "TRANSFER" | "CARD";
type HeaderFilter = "all" | "completed" | "workshop" | "deleted" | "active";
type SortMode = "default" | "deliveryAsc" | "deliveryDesc";

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
  paidTotal?: number;
  totalPaid?: number;
  discount?: any;
  balance?: number;
  netTotal?: number;
  deliveryDate?: string; // "YYYY-MM-DD"
  orderType?: 0 | 1;     // 0: Yeni Sipariş, 1: Fiyat Teklifi
  subTotal?: 0;
};

type Payment = {
  id: string;
  method: PaymentMethod;
  amount: number;
  paidAt: string;
  note?: string | null;
};

type OrderAuditUser = {
  id: string;
  name?: string | null;
  email?: string | null;
} | null;

type OrderAuditEntry = {
  id: string;
  action: string;
  createdAt: string;
  payload?: any;
  user: OrderAuditUser;
};

type OrderDetail = {
  id: string;
  total: number;
  netTotal: number;
  discount: number;
  payments: Payment[];
  paidTotal: number;
  balance: number;
  audits: OrderAuditEntry[];
};

/* ========= Utils ========= */
const fmt = (n: number | undefined | null) =>
  new Intl.NumberFormat("tr-TR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(n ?? 0));

const fmtInt = (n: number | undefined | null) =>
  new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 0 }).format(Number(n ?? 0));

const statusLabel: Record<Status, string> = {
  pending: "Beklemede",
  processing: "İşlemde",
  completed: "Tamamlandı",
  cancelled: "İptal",
  workshop: "Atölyede",
  deleted: "Silindi",
};

const auditActionLabel: Record<string, string> = {
  "order.create": "Sipariş oluşturuldu",
  "order.update": "Sipariş güncellendi",
  "order.delete": "Sipariş silindi",
  "order.restore": "Sipariş geri alındı",
};

const methodLabel: Record<PaymentMethod, string> = {
  CASH: "Nakit",
  TRANSFER: "Havale/EFT",
  CARD: "Kredi Kartı",
};

/* ========= Tiny UI helpers ========= */
function StatusBadge({ s }: { s: Status }) {
  const base = "inline-flex items-center px-2 py-0.5 rounded-sm text-xs font-medium border";
  const map: Record<Status, string> = {
    pending: `${base} bg-neutral-100 text-neutral-700 border-neutral-200`,
    processing: `${base} bg-blue-50 text-blue-700 border-blue-200`,
    completed: `${base} bg-emerald-50 text-emerald-700 border-emerald-200`,
    cancelled: `${base} bg-rose-50 text-rose-700 border-rose-200`,
    workshop: `${base} bg-blue-100 text-blue-700 border-blue-200`,
    deleted: `${base} bg-neutral-200 text-neutral-700 border-neutral-300`,
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
    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${tone}`}>
      {pct}% tahsilat
    </span>
  );
}

/* ========= DUE HELPERS ========= */
const MS_PER_DAY = 24 * 60 * 60 * 1000;
function parseYMDToLocalDate(ymd?: string | null): Date | null {
  if (!ymd) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!m) return null;
  const [, y, mo, d] = m;
  return new Date(Number(y), Number(mo) - 1, Number(d));
}
function startOfTodayLocal(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}
type DueInfo = {
  label: string;
  tone: "neutral" | "indigo" | "amber" | "rose" | "slate";
  iconPath: string;
  dateText: string;
};
function getDueInfo(ymd?: string): DueInfo {
  const d = parseYMDToLocalDate(ymd);
  const dateText = d
    ? new Intl.DateTimeFormat("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(d)
    : "—";

  if (!d) {
    return {
      label: "Tarih yok",
      tone: "slate",
      iconPath: "M12 8v4l3 3-.7.7L11 12.9V8h1zM12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z",
      dateText,
    };
  }

  const today = startOfTodayLocal();
  const diffDays = Math.round((d.getTime() - today.getTime()) / MS_PER_DAY);

  if (diffDays === 0) {
    return { label: "Teslimat Bugün", tone: "amber", iconPath: "M12 8v4l3 3-1.4 1.4L11 13.4V8h1z", dateText };
  }
  if (diffDays === 1) {
    return { label: "Yarın", tone: "indigo", iconPath: "M12 6v6l4 4 1.4-1.4L13 10.6V6h-1z", dateText };
  }
  if (diffDays > 1) {
    const label = `Teslimata ${diffDays} gün kaldı`;
    const tone = diffDays <= 3 ? "amber" : "indigo";
    return { label, tone, iconPath: "M12 6v6l4 4-1.4 1.4L11 12.4V6h1z", dateText };
  }

  const overdue = Math.abs(diffDays);
  return { label: `Teslimat ${overdue} gün gecikti`, tone: "rose", iconPath: "M15.5 14.5 12 11V6h-2v6l4.5 4.5 1-1z", dateText };
}
function toneClasses(tone: DueInfo["tone"]) {
  const map = {
    slate: "bg-slate-50 text-slate-700 ring-slate-200",
    neutral: "bg-neutral-50 text-neutral-700 ring-neutral-200",
    indigo: "bg-indigo-50 text-indigo-700 ring-indigo-200",
    amber: "bg-amber-50 text-amber-700 ring-amber-200",
    rose: "bg-rose-50 text-rose-700 ring-rose-200",
  } as const;
  return map[tone];
}
function DuePill({ info }: { info: DueInfo }) {
  return (
    <span
      className={`inline-flex flex-col w-full h-10 items-start gap-0 rounded-sm px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${toneClasses(info.tone)}`}
      title={`Teslim: ${info.dateText}`}
    >
      <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
        <path fill="currentColor" d={info.iconPath} />
      </svg>
      <span className="font-semibold">{info.label}</span>
      <span className="opacity-75">{info.dateText}</span>
    </span>
  );
}

function InlineLoader() {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="flex flex-col items-center gap-3">
        <div className="size-8 rounded-full border-2 border-neutral-300 border-t-indigo-600 animate-spin" />
        <div className="text-sm font-medium text-neutral-700">Siparişler yükleniyor…</div>
      </div>
    </div>
  );
}

/* ========= Page ========= */
export default function OrdersPage() {
  const router = useRouter();
  const { data: session } = useSession();

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  const [headerFilter, setHeaderFilter] = useState<HeaderFilter>("all");
  const [q, setQ] = useState("");

  // filters
  const [paymentStatus, setPaymentStatus] = useState<"all" | "unpaid" | "partial" | "paid">("all");
  const [methodFilters, setMethodFilters] = useState<PaymentMethod[]>([]);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sortMode, setSortMode] = useState<SortMode>("default");

  // Pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<10 | 20 | 50>(20);

  // Bayi filtresi
  const [dealerFilter, setDealerFilter] = useState<"all" | string>("all");

  // expanded rows
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());

  // detay cache
  const [detailById, setDetailById] = useState<Record<string, OrderDetail | undefined>>({});
  const [detailLoading, setDetailLoading] = useState<Record<string, boolean>>({});
  const [detailError, setDetailError] = useState<Record<string, string | null>>({});

  // payment form
  const [payAmount, setPayAmount] = useState<Record<string, string>>({});
  const [payMethod, setPayMethod] = useState<Record<string, PaymentMethod>>({});
  const [payNote, setPayNote] = useState<Record<string, string>>({});
  const [paySaving, setPaySaving] = useState<Record<string, boolean>>({});

  // modal
  const [payModalOpenId, setPayModalOpenId] = useState<string | null>(null);
  const modalBackdropRef = useRef<HTMLDivElement | null>(null);

  const [confirm, setConfirm] = useState<ConfirmState | null>(null);

  const isDeletedTab = headerFilter === "deleted";

  const canDeleteOrders = useMemo(() => {
    const role = session?.user?.role;
    if (role === "SUPERADMIN") return true;
    const tenantRole = session?.tenantRole ?? null;
    return tenantRole === "OWNER" || tenantRole === "ADMIN";
  }, [session]);

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
      // Sekmeye göre doğru query
      let qs = "";
      if (headerFilter === "completed") {
        qs = `?status=${encodeURIComponent("completed")}`;
      } else if (headerFilter === "workshop") {
        qs = `?status=${encodeURIComponent("workshop")}`;
      } else if (headerFilter === "deleted") {
        qs = `?only=deleted`;
      }
      // "all" ve "active" için parametre yok

      const res = await fetch(`/api/orders${qs}`, { cache: "no-store", signal });
      if (!res.ok) throw new Error("Siparişler alınamadı");
      const data: Order[] = await res.json();

      // Yalnızca orderType = 0 olanları temel liste olarak kullan
      const onlyOrders = data.filter((o) => o.orderType === 0);
      setOrders(onlyOrders);
    } catch (e: any) {
      if (e?.name !== "AbortError") setError(e?.message || "Bilinmeyen hata");
    } finally {
      setLoading(false);
      setHasLoadedOnce(true);
    }
  };

  const removeOrderInternal = async (id: string) => {
    if (!canDeleteOrders) {
      toast.error("Bu işlem için yetkin yok");
      return;
    }
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

  const restoreOrder = async (id: string) => {
    if (!canDeleteOrders) {
      toast.error("Bu işlem için yetkin yok");
      return;
    }
    setRestoringId(id);
    try {
      const res = await fetch(`/api/orders/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restore: true }),
      });
      const raw = await res.text();
      if (!res.ok) {
        let message = raw;
        try {
          const parsed = raw ? JSON.parse(raw) : null;
          message = parsed?.message || parsed?.error || message;
        } catch {
          // ignore JSON parse errors
        }
        throw new Error(message || "Geri alma başarısız");
      }

      let newStatus: Status = "pending";
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed.status === "string") {
            const candidate = parsed.status as Status;
            if ((statusLabel as Record<string, string>)[candidate]) {
              newStatus = candidate;
            }
          }
        } catch {
          // no-op
        }
      }

      setOrders((prev) => {
        if (isDeletedTab) {
          return prev.filter((o) => o.id !== id);
        }
        return prev.map((o) => (o.id === id ? { ...o, status: newStatus } : o));
      });
      setOpenIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      toast.success("Sipariş geri alındı");
    } catch (e: any) {
      toast.error(e?.message || "Geri alma başarısız");
    } finally {
      setRestoringId(null);
    }
  };

  const askDelete = (id: string) => {
    setConfirm({
      id,
      title: "Siparişi Sil",
      description:
        "Bu işlem geri alınamaz. Sipariş ve tüm ilişkili verileri (kalemler, ödemeler, notlar) kalıcı olarak silinecek.",
      confirmText: "Evet, sil",
    });
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
        audits: Array.isArray(data.audits)
          ? data.audits.map((audit: any) => ({
              id: audit.id,
              action: audit.action,
              createdAt: audit.createdAt,
              payload: audit.payload ?? null,
              user: audit.user
                ? {
                    id: audit.user.id,
                    name: audit.user.name ?? null,
                    email: audit.user.email ?? null,
                  }
                : null,
            }))
          : [],
      };
      setDetailById((m) => ({ ...m, [id]: d }));
      setPayMethod((m) => ({ ...m, [id]: m[id] ?? "CASH" }));
      setPayAmount((m) => ({ ...m, [id]: m[id] ?? "" }));
      setPayNote((m) => ({ ...m, [id]: m[id] ?? "" }));
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

  // Yöntem filtresi için detayları yükle
  useEffect(() => {
    if (methodFilters.length === 0) return;
    const ids = orders.filter(o => o.orderType === 0).map((o) => o.id);
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

  // Modal "kalan" auto-fill
  useEffect(() => {
    if (!payModalOpenId) return;
    const d = detailById[payModalOpenId];
    if (d && !(payAmount[payModalOpenId] ?? "").trim()) {
      setPayAmount((m) => ({
        ...m,
        [payModalOpenId]: d.balance > 0 ? String(d.balance).replace(".", ",") : "",
      }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payModalOpenId, detailById]);

  const openPayModal = (id: string) => setPayModalOpenId(id);
  const closePayModal = () => setPayModalOpenId(null);
  const onBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === modalBackdropRef.current) closePayModal();
  };

  // Sil
  const removeOrder = (id: string) => {
    if (!canDeleteOrders) {
      toast.error("Bu işlem için yetkin yok");
      return;
    }
    askDelete(id);
  };

  // Yalnızca orderType = 0 olanları temel liste olarak kullan
  const typeFiltered = useMemo(() => orders.filter((o) => o.orderType === 0), [orders]);

  // Bayileri tekilleştir
  const dealers = useMemo(() => {
    const names = typeFiltered.map((o) => (o.dealer?.name ?? "").trim()).filter(Boolean);
    return Array.from(new Set(names)).sort((a, b) => a.localeCompare(b, "tr"));
  }, [typeFiltered]);

  useEffect(() => {
    if (dealerFilter !== "all" && !dealers.includes(dealerFilter)) {
      setDealerFilter("all");
    }
  }, [dealers, dealerFilter]);

  // Text filter
  const textFiltered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return typeFiltered;
    return typeFiltered.filter((o) => {
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
  }, [typeFiltered, q]);

  // Header status filter (Silinenler sekmesi eklendi)
  const statusHeaderFiltered = useMemo(() => {
    switch (headerFilter) {
      case "all":
        return textFiltered;
      case "completed":
        return textFiltered.filter((o) => o.status === "completed");
      case "workshop":
        return textFiltered.filter((o) => o.status === "workshop");
      case "deleted":
        return textFiltered.filter((o) => o.status === "deleted");
      case "active":
      default:
        // Aktif: iptal hariç hepsi (pending, processing, workshop, completed)
        return textFiltered.filter((o) => o.status !== "cancelled");
    }
  }, [textFiltered, headerFilter]);

  // Payment + bayi filtreleri
  const filtered = useMemo(() => {
    return statusHeaderFiltered.filter((o) => {
      if (dealerFilter !== "all") {
        if ((o.dealer?.name ?? "") !== dealerFilter) return false;
      }

      // Silinen listesinde ödeme/metot filtreleri anlamsız, yine de uygulamak istersen bırakıyoruz
      if (paymentStatus !== "all") {
        const net = Number(o.netTotal ?? o.total ?? 0);
        const paid = Number(o.paidTotal ?? o.totalPaid ?? 0);
        const bal = Number(o.balance ?? Math.max(0, net - paid));
        if (paymentStatus === "unpaid" && !(paid === 0 && net > 0)) return false;
        if (paymentStatus === "partial" && !(bal > 0 && paid > 0)) return false;
        if (paymentStatus === "paid" && !(bal <= 0 && net >= 0)) return false;
      }
      if (methodFilters.length > 0) {
        const d = detailById[o.id];
        if (!d) return true; // detay yüklenene kadar dışlama
        const hasMethod = d.payments.some((p) => methodFilters.includes(p.method));
        if (!hasMethod) return false;
      }
      return true;
    });
  }, [statusHeaderFiltered, paymentStatus, methodFilters, detailById, dealerFilter]);

  // Teslim tarihine göre sıralama
  const displayed = useMemo(() => {
    if (sortMode === "default") return filtered;

    const getTime = (o: Order) => {
      const d = parseYMDToLocalDate(o.deliveryDate);
      return d ? d.getTime() : NaN;
    };

    const arr = [...filtered];
    if (sortMode === "deliveryAsc") {
      arr.sort((a, b) => {
        const ta = getTime(a);
        const tb = getTime(b);
        if (Number.isNaN(ta) && Number.isNaN(tb)) return 0;
        if (Number.isNaN(ta)) return 1;
        if (Number.isNaN(tb)) return -1;
        return ta - tb;
      });
    } else if (sortMode === "deliveryDesc") {
      arr.sort((a, b) => {
        const ta = getTime(a);
        const tb = getTime(b);
        if (Number.isNaN(ta) && Number.isNaN(tb)) return 0;
        if (Number.isNaN(ta)) return -1;
        if (Number.isNaN(tb)) return 1;
        return tb - ta;
      });
    }
    return arr;
  }, [filtered, sortMode]);

  // Pagination – sliced list
  const paged = useMemo(() => {
    const total = displayed.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const safePage = Math.min(page, totalPages);
    const start = (safePage - 1) * pageSize;
    const end = start + pageSize;
    return {
      items: displayed.slice(start, end),
      total,
      totalPages,
      page: safePage,
      startIndex: start,
    };
  }, [displayed, page, pageSize]);

  // Filtre/sıralama/arama/limit değişince 1. sayfaya dön
  useEffect(() => {
    setPage(1);
  }, [q, headerFilter, paymentStatus, methodFilters, dealerFilter, sortMode, pageSize, orders.length]);

  const headerFilterLabelMap: Record<HeaderFilter, string> = {
    all: "Tüm siparişler",
    completed: "Tamamlanan siparişler",
    workshop: "Atölyedeki siparişler",
    deleted: "Silinen siparişler",
    active: "Aktif siparişler",
  };
  const stats = useMemo(() => {
    const total = filtered.length;
    let completed = 0;
    let deleted = 0;
    let active = 0;
    for (const o of filtered) {
      if (o.status === "completed") completed += 1;
      if (o.status === "deleted") deleted += 1;
      if (o.status !== "completed" && o.status !== "deleted" && o.status !== "cancelled") active += 1;
    }
    return { total, completed, deleted, active };
  }, [filtered]);
  const summaryCards: Array<{ label: string; value: string; hint?: string }> = [
    { label: "Filtrelenen Sipariş", value: fmtInt(stats.total), hint: headerFilterLabelMap[headerFilter] },
    { label: "Tamamlanan", value: fmtInt(stats.completed), hint: "Filtre kapsamındaki tamamlanan siparişler" },
    { label: "Aktif", value: fmtInt(stats.active), hint: "Devam eden siparişler" },
    { label: "Silinen", value: fmtInt(stats.deleted), hint: "Geri dönüşümdeki kayıtlar" },
  ];

  // CSV - filtre+sort (pagination'dan bağımsız)
  const downloadOrdersCSV = () => {
    if (!displayed.length) return;
    const rows = [
      ["ID", "Tarih", "Müşteri", "Durum", "Teslim", "NET (₺)", "Ödenen (₺)", "Kalan (₺)"],
      ...displayed.map((o) => {
        const net = Number(o.netTotal ?? o.total ?? 0);
        const paid = Number(o.paidTotal ?? o.totalPaid ?? 0);
        const bal = Number(o.balance ?? Math.max(0, net - paid));
        return [
          o.id,
          new Date(o.createdAt).toISOString(),
          o.customerName ?? "",
          o.status,
          o.deliveryDate ?? "",
          String(net),
          String(paid),
          String(bal),
        ];
      }),
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `siparisler_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

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

      setOrders((prev) =>
        prev.map((o) => {
          if (o.id !== id) return o;
          const net = Number(o.netTotal ?? o.total ?? 0);
          const paid = Number(o.paidTotal ?? o.totalPaid ?? 0) + amount;
          const balance = Math.max(0, net - paid);
          return { ...o, paidTotal: paid, totalPaid: paid, balance };
        })
      );

      await fetchOrderDetail(id);

      setPayAmount((m) => ({ ...m, [id]: "" }));
      setPayNote((m) => ({ ...m, [id]: "" }));
      toast.success("Ödeme kaydedildi");
      closePayModal();
    } catch (e: any) {
      toast.error(e?.message || "Ödeme kaydedilemedi");
    } finally {
      setPaySaving((s) => ({ ...s, [id]: false }));
    }
  };

  const Skeleton = () => (
    <div className="animate-pulse space-y-3 rounded-2xl border border-neutral-200 p-4">
      <div className="h-4 w-40 rounded bg-neutral-200" />
      <div className="h-3 w-64 rounded bg-neutral-200" />
      <div className="h-3 w-52 rounded bg-neutral-200" />
      <div className="mt-2 h-24 w-full rounded bg-neutral-100" />
    </div>
  );

  return (
    <>
      <main className="mx-auto max-w-7xl p-3 sm:p-6 overflow-x-hidden">
        {/* HERO */}
        <section className="relative mb-6 overflow-hidden rounded-3xl border border-neutral-200 bg-white/90 shadow-xl">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(79,70,229,0.18),transparent_55%),radial-gradient(circle_at_bottom_right,rgba(16,185,129,0.18),transparent_55%)]" />
          <div className="relative z-10 grid gap-6 px-6 py-8 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)] lg:items-center">
            <div className="space-y-5">
              <span className="inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-1 text-xs font-medium text-indigo-700 ring-1 ring-indigo-100">
                Sipariş yönetimi
              </span>
              <div>
                <h1 className="text-3xl font-semibold tracking-tight text-neutral-900 sm:text-4xl">Siparişler</h1>
                <p className="mt-1 max-w-2xl text-sm text-neutral-600">
                  Filtrelerinize göre toplam tutarları, tahsilat durumunu ve bekleyen siparişleri tek ekrandan takip edin.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => router.push("/dashboard/order/new")}
                  className="inline-flex h-9 items-center gap-2 rounded-xl bg-indigo-600 px-3 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
                >
                  <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
                    <path fill="currentColor" d="M11 11V6h2v5h5v2h-5v5h-2v-5H6v-2z" />
                  </svg>
                  Yeni Sipariş
                </button>
                <button
                  className="inline-flex h-9 items-center gap-2 rounded-xl border border-white/70 bg-white/90 px-3 text-sm text-neutral-700 shadow-sm transition hover:bg-white disabled:opacity-50"
                  onClick={downloadOrdersCSV}
                  disabled={!displayed.length}
                  title="CSV indir (filtre+sort)"
                >
                  <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
                    <path fill="currentColor" d="M12 3v10l4-4 1.4 1.4L12 17l-5.4-6.6L8 9l4 4V3zM5 19h14v2H5z" />
                  </svg>
                  CSV
                </button>
                <button
                  className="inline-flex h-9 items-center gap-2 rounded-xl border border-white/70 bg-white/90 px-3 text-sm text-neutral-700 shadow-sm transition hover:bg-white disabled:opacity-50"
                  onClick={onRefresh}
                  disabled={loading}
                  title="Yenile"
                >
                  <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
                    <path fill="currentColor" d="M12 6V3L8 7l4 4V8a4 4 0 1 1-4 4H6a6 6 0 1 0 6-6z" />
                  </svg>
                  {loading ? "Yükleniyor…" : "Yenile"}
                </button>
                <div className="hidden sm:flex items-center gap-2 rounded-xl border border-white/70 bg-white/90 px-3 py-1 text-xs text-neutral-600 shadow-sm">
                  <span>Sayfa</span>
                  <select
                    className="rounded-lg border border-neutral-200 bg-white px-2 py-1 text-xs font-medium text-neutral-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                    value={pageSize}
                    onChange={(e) => setPageSize(Number(e.target.value) as any)}
                    aria-label="Sayfa boyutu"
                  >
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                  </select>
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-500">
                  <span>Durum filtresi</span>
                  <span className="hidden sm:inline text-neutral-400">•</span>
                  <span className="hidden sm:inline text-neutral-500">{headerFilterLabelMap[headerFilter]}</span>
                </div>
                <div
                  role="tablist"
                  aria-label="Durum filtresi"
                  className="inline-flex flex-wrap gap-2 rounded-2xl border border-white/70 bg-white/90 p-1 shadow-sm"
                >
                  {(
                    [
                      { k: "all", label: "Tümü" },
                      { k: "completed", label: "Tamamlanan" },
                      { k: "workshop", label: "Atölyede" },
                      { k: "deleted", label: "Silinenler" },
                    ] as { k: HeaderFilter; label: string }[]
                  ).map(({ k, label }) => (
                    <button
                      key={k}
                      role="tab"
                      aria-selected={headerFilter === k}
                      onClick={() => setHeaderFilter(k)}
                      className={`rounded-xl px-3 py-1.5 text-sm font-medium transition ${
                        headerFilter === k
                          ? "bg-indigo-600 text-white shadow-sm"
                          : "text-neutral-700 hover:bg-neutral-100"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <div className="sm:hidden">
                  <label className="flex items-center gap-2 rounded-xl border border-white/70 bg-white/90 px-3 py-2 text-xs text-neutral-600 shadow-sm">
                    <span>Sayfa</span>
                    <select
                      className="w-full rounded-lg border border-neutral-200 bg-white px-2 py-1 text-sm text-neutral-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                      value={pageSize}
                      onChange={(e) => setPageSize(Number(e.target.value) as any)}
                      aria-label="Sayfa boyutu (mobil)"
                    >
                      <option value={10}>10</option>
                      <option value={20}>20</option>
                      <option value={50}>50</option>
                    </select>
                  </label>
                </div>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {summaryCards.map((card) => (
                <div
                  key={card.label}
                  className="rounded-2xl border border-white/60 bg-white/80 px-4 py-3 text-sm shadow-sm backdrop-blur"
                >
                  <div className="text-[11px] font-medium uppercase tracking-wide text-neutral-500">{card.label}</div>
                  <div className="mt-2 text-2xl font-semibold text-neutral-900">{card.value}</div>
                  {card.hint && <div className="mt-1 text-xs text-neutral-500">{card.hint}</div>}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Filtreler */}
        <div className="rounded-2xl border border-neutral-200 bg-white p-3 sm:p-4">
          <div className="grid w-full items-end gap-2 sm:grid-cols-3">
            {/* Arama */}
            <div className="rounded-xl border border-neutral-200 bg-white p-3">
              <label className="mb-1 block text-xs font-semibold text-neutral-500">Ara</label>
              <div className="relative">
                <input
                  className="h-9 w-full rounded-sm border border-neutral-200 bg-white px-3 pe-9 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                  placeholder="Siparişlerde ara"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  aria-label="Siparişlerde ara"
                />
                <svg className="pointer-events-none absolute right-2 top-1/2 size-4 -translate-y-1/2 text-neutral-400" viewBox="0 0 24 24" aria-hidden>
                  <path fill="currentColor" d="M10 4a6 6 0 1 1 3.9 10.6l3.8 3.8-1.4 1.4-3.8-3.8A6 6 0 0 1 10 4m0 2a4 4 0 1 0 0 8a4 4 0 0 0 0-8z" />
                </svg>
              </div>
            </div>

            {/* Bayi */}
            <div className="rounded-xl border border-neutral-200 bg-white p-3">
              <label className="mb-1 block text-xs font-semibold text-neutral-500">Bayi</label>
              <select
                className="h-9 w-full rounded-sm border border-neutral-200 bg-white px-2 text-sm text-neutral-700 hover:bg-neutral-50"
                value={dealerFilter}
                onChange={(e) => setDealerFilter(e.target.value)}
                aria-label="Bayi filtresi"
              >
                <option value="all">Tümü</option>
                {dealers.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </div>

            {/* Sıralama */}
            <div className="rounded-xl border border-neutral-200 p-3">
              <div className="mb-2 text-xs font-semibold text-neutral-500">Teslim tarihine göre sırala</div>
              <select
                className="w-full rounded-sm border border-neutral-200 bg-white px-1 py-1 text-sm text-neutral-700 hover:bg-neutral-50 h-[32px]"
                value={sortMode}
                onChange={(e) => setSortMode(e.target.value as SortMode)}
                aria-label="Sıralama"
              >
                <option value="default">Varsayılan</option>
                <option value="deliveryAsc">Teslim (en yakın önce)</option>
                <option value="deliveryDesc">Teslim (en geç önce)</option>
              </select>
            </div>

            {/* Filtreler butonu (mobil) */}
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setFiltersOpen((s) => !s)}
                className="inline-flex h-9 items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 text-sm text-neutral-700 hover:bg-neutral-50 sm:hidden"
                aria-expanded={filtersOpen}
                aria-controls="filters-panel"
              >
                <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
                  <path fill="currentColor" d="M3 5h18v2H3zM6 11h12v2H6zm3 6h6v2H9z" />
                </svg>
                Filtreler
              </button>
            </div>
          </div>

          <div className={["mt-3 grid gap-2 sm:mt-4 sm:grid-cols-2", filtersOpen ? "grid" : "hidden sm:grid"].join(" ")}>
            {/* Ödeme Durumu */}
            <div className="rounded-xl border border-neutral-200 p-3">
              <div className="mb-2 text-xs font-semibold text-neutral-500">Ödeme Durumu</div>
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
                      className={`h-8 rounded-sm border px-3 text-xs ${
                        active ? "border-amber-600 bg-amber-600 text-white" : "border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50"
                      }`}
                      aria-pressed={active}
                    >
                      {b.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Ödeme Yöntemi */}
            <div className="rounded-xl border border-neutral-200 p-3">
              <div className="mb-2 text-xs font-semibold text-neutral-500">Ödeme Yöntemi</div>
              <div className="flex flex-wrap gap-2">
                {(["CASH", "TRANSFER", "CARD"] as PaymentMethod[]).map((m) => {
                  const active = methodFilters.includes(m);
                  return (
                    <button
                      key={m}
                      type="button"
                      onClick={() =>
                        setMethodFilters((prev) => (prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]))
                      }
                      className={`h-8 rounded-sm border px-3 text-xs ${
                        active ? "border-emerald-600 bg-emerald-600 text-white" : "border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50"
                      }`}
                      aria-pressed={active}
                    >
                      {methodLabel[m]}
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
            <button type="button" onClick={onRefresh} className="underline decoration-rose-400 underline-offset-2 hover:text-rose-800">
              Tekrar dene
            </button>
          </div>
        )}

        {/* Liste */}
        <div className="mt-4 space-y-4 min-h-[100vh]">
          {orders.length === 0 && loading && <InlineLoader />}

          {!loading
            ? paged.items.map((order, idx) => {
                const globalIndex = paged.startIndex + idx;
                const num = displayed.length - globalIndex;
                const isOpen = openIds.has(order.id);
                const d = detailById[order.id];
                const detailId = `order-detail-${order.id}`;

                const net = Number(order.netTotal ?? order.total ?? 0);
                const paid = Number(order.paidTotal ?? order.totalPaid ?? 0);
                const balance = Number(order.subTotal) - Number(paid) - Number(order.discount);
                const ratio = net > 0 ? paid / net : 0;
                const total = Number(order.subTotal)

                const disabledActions = order.status === "deleted";
                const deleteDisabled = order.status === "deleted" || !canDeleteOrders || deletingId === order.id;
                const showRestore = order.status === "deleted" && canDeleteOrders;

                return (
                  <section key={order.id} className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
                    {/* Header */}
                    <div className="flex flex-col md:flex-row items-start justify-between gap-3">
                      {/* Sol */}
                      <div className="flex w-full md:w-auto flex-1 flex-col gap-2">
                        <div className="flex w-full md:w-[350px] justify-between flex-wrap items-center gap-2">
                          <div className="flex items-center gap-2">
                            <span
                              className="inline-flex size-6 items-center justify-center rounded-sm border border-neutral-300 bg-neutral-50 text-[11px] font-semibold text-neutral-700 ring-1 ring-inset ring-white/50 print:bg-white print:text-black"
                              aria-hidden
                            >
                              {num}
                            </span>
                            <div className="shrink-0 font-semibold truncate text-lg">{order.dealer.name || "—"}</div>
                          </div>
                          <StatusBadge s={order.status} />
                        </div>

                        <div className="grid gap-2 text-sm sm:grid-cols-2 sm:gap-2 w-full md:w-[350px]">
                          <div className="min-w-0">
                            <span className="flex flex-col items-start justify-between rounded-sm bg-neutral-50 px-2.5 py-1 text-xs font-medium text-neutral-700 ring-1 ring-inset ring-neutral-200">
                              <span>MÜŞTERİ</span> <strong>{order.customerName || "—"}</strong>
                            </span>
                          </div>
                          <div className="min-w-0">
                            <span className="flex flex-col items-start justify-between rounded-sm bg-neutral-50 px-2.5 py-1 text-xs font-medium text-neutral-700 ring-1 ring-inset ring-neutral-200">
                              <span>TELEFON</span> <strong>{order.customerPhone || "—"}</strong>
                            </span>
                          </div>
                          <div className="min-w-0 flex">
                            <DuePill info={getDueInfo(order.deliveryDate)} />
                          </div>
                          <div className="min-w-0">
                            <span className="inline-flex w-full h-10 items-center gap-1 rounded-sm px-2.5 py-1 text-xs font-medium ring-1 ring-inset bg-neutral-50 text-neutral-700 ring-neutral-200" title="Oluşturma">
                              <svg viewBox="0 0 24 24" className="size-3.5" aria-hidden>
                                <path fill="currentColor" d="M7 2h2v2h6V2h2v2h3v2H4V4h3V2zm-3 6h16v12H4V8zm2 2v8h12v-8H6z" />
                              </svg>
                              {new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(order.createdAt))}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Sağ: finans + aksiyon */}
                      <div className="flex w-full flex-col items-end gap-2 md:w-auto">
                        {/* Finans özet */}
                        <div className="grid w-full grid-cols-2 gap-2 sm:grid-cols-4">
                          <span className="flex w-full flex-col items-center justify-between rounded-sm bg-neutral-50 px-2.5 py-1 text-xs font-medium text-neutral-700 ring-1 ring-inset ring-neutral-200">
                            <span>G.TOPLAM</span> <strong className="ms-1">{fmt(total)} ₺</strong>
                          </span>
                          <span className="flex w-full flex-col items-center justify-between rounded-sm bg-neutral-50 px-2.5 py-1 text-xs font-medium text-neutral-700 ring-1 ring-inset ring-neutral-200">
                            <span>İskonto</span> <strong className="ms-1">{fmt(order.discount)} ₺</strong>
                          </span>
                          <span className="flex w-full flex-col items-center justify-between rounded-sm bg-neutral-50 px-2.5 py-1 text-xs font-medium text-neutral-700 ring-1 ring-inset ring-neutral-200">
                            <span>Ödenen</span> <strong className="ms-1">{fmt(paid)} ₺</strong>
                          </span>
                          <span className="flex w-full flex-col items-center justify-between rounded-sm bg-neutral-50 px-2.5 py-1 text-xs font-medium text-neutral-700 ring-1 ring-inset ring-neutral-200">
                            <span>Kalan</span> <strong className="ms-1">{fmt(balance)} ₺</strong>
                          </span>
                        </div>

                        {/* Aksiyonlar */}
                        <div className="grid w-full grid-cols-2 gap-2">
                          <button
                            onClick={() => router.push(`/dashboard/orders/${order.id}/print`)}
                            className="inline-flex w-full items-center justify-center gap-1.5 rounded-sm border border-neutral-200 bg-white px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
                            title="Yazdır"
                            disabled={disabledActions}
                          >
                            <svg className="size-4" viewBox="0 0 24 24" aria-hidden>
                              <path fill="currentColor" d="M7 3h10v4H7z" />
                              <path fill="currentColor" d="M5 9h14a2 2 0 0 1 2 2v6h-4v-3H7v3H3v-6a2 2 0 0 1 2-2z" />
                              <path fill="currentColor" d="M7 17h10v4H7z" />
                            </svg>
                            Yazdır
                          </button>

                          <button
                            onClick={() => router.push(`/dashboard/orders/${order.id}`)}
                            className="inline-flex w-full items-center justify-center gap-1.5 rounded-sm border border-neutral-200 bg-white px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
                            title="Önizleme / Düzenle"
                            disabled={disabledActions}
                          >
                            <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
                              <path fill="currentColor" d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1.003 1.003 0 0 0 0-1.42l-2.34-2.34a1.003 1.003 0 0 0 1.42 0l-1.83 1.83l3.75 3.75l1.84-1.82z" />
                            </svg>
                            Önizleme / Düzenle
                          </button>

                          <button
                            className="inline-flex w-full items-center justify-center gap-1.5 rounded-sm border border-neutral-200 bg-white px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
                            onClick={() => openPayModal(order.id)}
                            title="Ödeme Ekle"
                            disabled={disabledActions}
                          >
                            <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
                              <path fill="currentColor" d="M12 21a9 9 0 1 1 9-9h-2a7 7 0 1 0-7 7v2zm1-9h5v2h-7V7h2v5z" />
                            </svg>
                            Ödeme Ekle
                          </button>

                          <button
                            className="inline-flex w-full items-center justify-center gap-1.5 rounded-sm border border-rose-200 bg-white px-3 py-1.5 text-sm text-rose-700 hover:bg-rose-50 disabled:opacity-50"
                            onClick={() => removeOrder(order.id)}
                            disabled={deleteDisabled}
                            title="Sil"
                          >
                            <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
                              <path fill="currentColor" d="M6 7h12l-1 14H7L6 7zm3-3h6l1 2H8l1-2z" />
                            </svg>
                            {deletingId === order.id ? "Siliniyor…" : "Sil"}
                          </button>

                          {showRestore && (
                            <button
                              className="inline-flex w-full items-center justify-center gap-1.5 rounded-sm border border-emerald-200 bg-white px-3 py-1.5 text-sm text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
                              onClick={() => restoreOrder(order.id)}
                              disabled={restoringId === order.id}
                              title="Geri Al"
                            >
                              <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
                                <path
                                  fill="currentColor"
                                  d="M12 5v4H8l4 4 4-4h-4V5h-2zm-6 9h2a6 6 0 1 0 6-6v-2a8 8 0 1 1-8 8z"
                                />
                              </svg>
                              {restoringId === order.id ? "Geri alınıyor…" : "Geri Al"}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Detay toggle */}
                    <div className="mt-3">
                      <button
                        className="flex w-full items-center justify-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-50"
                        aria-expanded={isOpen}
                        aria-controls={detailId}
                        onClick={() => toggleOpen(order.id)}
                        title={isOpen ? "Detayı gizle" : "Detayı göster"}
                      >
                        <svg viewBox="0 0 24 24" className={`size-4 transition-transform ${isOpen ? "rotate-180" : ""}`} aria-hidden>
                          <path fill="currentColor" d="M7 10l5 5 5-5H7z" />
                        </svg>
                        {isOpen ? "Detayı Gizle" : "Detayı Göster"}
                      </button>
                    </div>

                    {/* Tahsilat Progress */}
                    <div className="mt-3">
                      <Progress value={Math.max(0, Math.min(100, Math.round(ratio * 100)))} />
                    </div>

                    {/* Detay */}
                    {isOpen && (
                      <div id={detailId} className="mt-4 space-y-4">
                        {order.note && (
                          <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-3 text-sm">
                            <span className="font-medium">Sipariş Notu:</span> {order.note}
                          </div>
                        )}

                        {/* Kalemler */}
                        <div className="rounded-2xl border border-neutral-200">
                          <div className="border-b border-neutral-200 px-3 py-2 text-sm font-semibold">Kalemler ({order.items.length})</div>
                          <div className="overflow-x-auto">
                            <table className="min-w-full text-sm">
                              <thead className="bg-neutral-50 text-neutral-600">
                                <tr>
                                  <th className="px-3 py-2 text-left">Kategori</th>
                                  <th className="px-3 py-2 text-left">Ürün</th>
                                  <th className="px-3 py-2 text-right">Adet</th>
                                  <th className="px-3 py-2 text-right">En</th>
                                  <th className="px-3 py-2 text-right">Boy</th>
                                  <th className="px-3 py-2 text-right">Birim ₺</th>
                                  <th className="px-3 py-2 text-right">Tutar ₺</th>
                                </tr>
                              </thead>
                              <tbody>
                                {order.items.map((it) => (
                                  <tr key={it.id} className="border-t border-neutral-100">
                                    <td className="px-3 py-2">{it.category.name}</td>
                                    <td className="px-3 py-2">{it.variant.name}</td>
                                    <td className="px-3 py-2 text-right">{fmtInt(it.qty)}</td>
                                    <td className="px-3 py-2 text-right">{fmtInt(it.width)}</td>
                                    <td className="px-3 py-2 text-right">{fmtInt(it.height)}</td>
                                    <td className="px-3 py-2 text-right">{fmt(it.unitPrice)}</td>
                                    <td className="px-3 py-2 text-right">{fmt(it.subtotal)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>

                        {/* Ödemeler */}
                        <div className="rounded-2xl border border-neutral-200">
                          <div className="flex items-center justify-between border-b border-neutral-200 px-3 py-2">
                            <div className="text-sm font-semibold">Ödemeler</div>
                            <button
                              className="inline-flex items-center gap-1.5 rounded-sm border border-neutral-200 bg-white px-3 py-1.5 text-xs text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
                              onClick={() => openPayModal(order.id)}
                              disabled={disabledActions}
                            >
                              <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
                                <path fill="currentColor" d="M12 21a9 9 0 1 1 9-9h-2a7 7 0 1 0-7 7v2zm1-9h5v2h-7V7h2v5z" />
                              </svg>
                              Ödeme Yap
                            </button>
                          </div>

                          <div className="p-3">
                            {detailLoading[order.id] && <Skeleton />}
                            {detailError[order.id] && (
                              <div className="rounded-sm border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{detailError[order.id]}</div>
                            )}
                            {!detailLoading[order.id] && !detailError[order.id] && (
                              <>
                                {d && d.payments.length > 0 ? (
                                  <div className="overflow-x-auto">
                                    <table className="min-w-full text-sm">
                                      <thead className="bg-neutral-50 text-neutral-600">
                                        <tr>
                                          <th className="px-3 py-2 text-left">Tarih</th>
                                          <th className="px-3 py-2 text-left">Yöntem</th>
                                          <th className="px-3 py-2 text-right">Tutar ₺</th>
                                          <th className="px-3 py-2 text-left">Not</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {d.payments.map((p) => (
                                          <tr key={p.id} className="border-t border-neutral-100">
                                            <td className="px-3 py-2">
                                              {new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(p.paidAt))}
                                            </td>
                                            <td className="px-3 py-2">{methodLabel[p.method]}</td>
                                            <td className="px-3 py-2 text-right">{fmt(p.amount)}</td>
                                            <td className="px-3 py-2">{p.note ?? "—"}</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                        ) : (
                          <div className="text-sm text-neutral-500">Henüz ödeme yok.</div>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {/* İşlem geçmişi */}
                <div className="rounded-2xl border border-neutral-200">
                  <div className="border-b border-neutral-200 px-3 py-2 text-sm font-semibold">İşlem Geçmişi</div>
                  <div className="p-3 space-y-3">
                    {detailLoading[order.id] && <Skeleton />}
                    {detailError[order.id] && (
                      <div className="rounded-sm border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                        {detailError[order.id]}
                      </div>
                    )}
                    {!detailLoading[order.id] && !detailError[order.id] && (
                      <>
                        {d && d.audits.length > 0 ? (
                          <ul className="space-y-3">
                            {d.audits.map((entry) => {
                              const label = auditActionLabel[entry.action] ?? entry.action;
                              const actor = entry.user?.name || entry.user?.email || "Sistem";
                              const dateText = new Intl.DateTimeFormat("tr-TR", {
                                dateStyle: "medium",
                                timeStyle: "short",
                              }).format(new Date(entry.createdAt));
                              return (
                                <li key={entry.id} className="rounded-xl border border-neutral-200 bg-neutral-50 p-3 text-sm">
                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                    <span className="font-medium text-neutral-800">{label}</span>
                                    <span className="text-xs text-neutral-500">{dateText}</span>
                                  </div>
                                  <div className="mt-1 text-xs text-neutral-600">İşlemi yapan: {actor}</div>
                                  
                                </li>
                              );
                            })}
                          </ul>
                        ) : (
                          <div className="text-sm text-neutral-500">Henüz işlem kaydı yok.</div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}
          </section>
        );
      })
            : ""}
        </div>

        {/* Pagination controls */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm text-neutral-600">
            Toplam {fmtInt(paged.total)} kayıt • Sayfa {paged.page}/{paged.totalPages}
          </div>

          <div className="flex items-center gap-1">
            <button
              className="h-9 rounded-xl border border-neutral-200 bg-white px-3 text-sm text-neutral-700 disabled:opacity-50"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={paged.page <= 1}
            >
              Önceki
            </button>

            {/* Sayfa numaraları */}
            {Array.from({ length: paged.totalPages }, (_, i) => i + 1)
              .filter((n) => {
                const p = paged.page;
                return n === 1 || n === paged.totalPages || (n >= p - 2 && n <= p + 2);
              })
              .map((n, idx, arr) => {
                const prev = arr[idx - 1];
                const gap = prev && n - prev > 1;
                return (
                  <span key={n} className="inline-flex">
                    {gap && <span className="px-1 text-neutral-400">…</span>}
                    <button
                      className={`h-9 min-w-9 rounded-xl border px-3 text-sm ${
                        n === paged.page
                          ? "border-indigo-600 bg-indigo-600 text-white"
                          : "border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50"
                      }`}
                      onClick={() => setPage(n)}
                    >
                      {n}
                    </button>
                  </span>
                );
              })}

            <button
              className="h-9 rounded-xl border border-neutral-200 bg-white px-3 text-sm text-neutral-700 disabled:opacity-50"
              onClick={() => setPage((p) => Math.min(paged.totalPages, p + 1))}
              disabled={paged.page >= paged.totalPages}
            >
              Sonraki
            </button>
          </div>
        </div>
      </main>

      {/* Confirm Delete Modal */}
      {confirm && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setConfirm(null);
          }}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40"
          aria-modal="true"
          role="dialog"
        >
          <div className="w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl bg-white shadow-xl p-4 sm:p-6">
            <div className="mb-3 flex items-start justify-between">
              <h2 className="text-lg font-semibold">{confirm.title}</h2>
              <button onClick={() => setConfirm(null)} className="rounded-sm p-1.5 text-neutral-500 hover:bg-neutral-100" aria-label="Kapat">
                <svg viewBox="0 0 24 24" className="size-5">
                  <path fill="currentColor" d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            {confirm.description && <p className="mb-4 text-sm text-neutral-600">{confirm.description}</p>}

            <div className="flex items-center justify-end gap-2">
              <button className="rounded-xl border border-neutral-200 bg-white px-3 py-1.5 text-sm hover:bg-neutral-50" onClick={() => setConfirm(null)} disabled={!!deletingId}>
                Vazgeç
              </button>
              <button
                className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
                onClick={async () => {
                  const id = confirm.id;
                  await removeOrderInternal(id);
                  setConfirm(null);
                }}
                disabled={!!deletingId}
              >
                <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
                  <path fill="currentColor" d="M6 7h12l-1 14H7L6 7zm3-3h6l1 2H8l1-2z" />
                </svg>
                {deletingId === confirm.id ? "Siliniyor…" : (confirm.confirmText ?? "Sil")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pay Modal */}
      {payModalOpenId && (
        <div
          ref={modalBackdropRef}
          onClick={onBackdropClick}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40"
          aria-modal="true"
          role="dialog"
        >
          <div className="w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl bg-white shadow-xl p-4 sm:p-6">
            {(() => {
              const d = detailById[payModalOpenId!];
              const saving = !!paySaving[payModalOpenId!];
              const amount = payAmount[payModalOpenId!] ?? "";
              const method = payMethod[payModalOpenId!] ?? "CASH";
              const note = payNote[payModalOpenId!] ?? "";

              return (
                <>
                  <div className="mb-3 flex items-start justify-between">
                    <h2 className="text-lg font-semibold">Ödeme Ekle</h2>
                    <button onClick={closePayModal} className="rounded-sm p-1.5 text-neutral-500 hover:bg-neutral-100" aria-label="Kapat">
                      <svg viewBox="0 0 24 24" className="size-5">
                        <path fill="currentColor" d="M18 6L6 18M6 6l12 12" />
                      </svg>
                    </button>
                  </div>

                  {!d ? (
                    <div className="py-8 text-center text-sm text-neutral-600">Detay yükleniyor…</div>
                  ) : (
                    <div className="space-y-4">
                      <div className="grid grid-cols-3 gap-2 text-sm">
                        <div className="rounded-sm bg-neutral-50 p-2">
                          <div className="text-neutral-500">Net</div>
                          <div className="font-semibold">{fmt(d.netTotal)} ₺</div>
                        </div>
                        <div className="rounded-sm bg-emerald-50 p-2">
                          <div className="text-emerald-700">Ödenen</div>
                          <div className="font-semibold text-emerald-700">{fmt(d.paidTotal)} ₺</div>
                        </div>
                        <div className="rounded-sm bg-amber-50 p-2">
                          <div className="text-amber-700">Kalan</div>
                          <div className="font-semibold text-amber-700">{fmt(d.balance)} ₺</div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="block text-sm font-medium">Tutar</label>
                        <input
                          className="w-full rounded-md border border-neutral-200 px-3 py-2"
                          placeholder="0,00"
                          value={amount}
                          onChange={(e) => setPayAmount((m) => ({ ...m, [payModalOpenId!]: e.target.value }))}
                          inputMode="decimal"
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="block text-sm font-medium">Yöntem</label>
                        <select
                          className="w-full rounded-md border border-neutral-200 px-3 py-2"
                          value={method}
                          onChange={(e) => setPayMethod((m) => ({ ...m, [payModalOpenId!]: e.target.value as PaymentMethod }))}
                        >
                          <option value="CASH">Nakit</option>
                          <option value="TRANSFER">Havale/EFT</option>
                          <option value="CARD">Kredi Kartı</option>
                        </select>
                      </div>

                      <div className="space-y-2">
                        <label className="block text-sm font-medium">Not (opsiyonel)</label>
                        <textarea
                          className="w-full rounded-sm bg-neutral-50 p-3 border border-neutral-200"
                          rows={3}
                          value={note}
                          onChange={(e) => setPayNote((m) => ({ ...m, [payModalOpenId!]: e.target.value }))}
                        />
                      </div>

                      <div className="flex items-center justify-end gap-2 pt-1">
                        <button className="rounded-xl border border-neutral-200 bg-white px-3 py-1.5 text-sm hover:bg-neutral-50" onClick={closePayModal} disabled={saving}>
                          İptal
                        </button>
                        <button
                          className="rounded-xl bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                          onClick={() => addPayment(payModalOpenId!)}
                          disabled={saving}
                        >
                          {saving ? "Kaydediliyor…" : "Kaydet"}
                        </button>
                      </div>
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        </div>
      )}
    </>
  );
}

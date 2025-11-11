"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { PageOverlay } from "@/app/components/PageOverlay";

/* ========= Types ========= */
type Variant = { id: string; name: string; unitPrice: number };
type Category = { id: string; name: string; variants: Variant[] };
type Status = "pending" | "processing" | "completed" | "cancelled" | "workshop";

type LineItem = {
  id: string;
  categoryId: string;
  variantId: string;
  qty: number;
  width: number;
  height: number;
  unitPrice: number;
  note?: string | null;
  fileDensity: number;
  subtotal: number;
  slotIndex: number | null;
  lineStatus: Status;
};

type Order = {
  id: string;
  note?: string | null;
  createdAt: string;
  total: number;
  items: LineItem[];
  customerName: string;
  customerPhone: string;
  status: Status;
  deliveryAt?: string | null;
  netTotal?: number;
  discount?: number;
  paidTotal?: number;
  balance?: number;
  orderType?: number;
};

type InsertSlot = { title: string; index: number } | null;

type Profile = {
  companyName?: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  taxNumber?: string | null;
  taxOffice?: string | null;
  logoUrl?: string | null;
  instagram?: string | null;
  website?: string | null;
};

type Branch = {
  id: string;
  name: string;
  code?: string | null;
  isActive: boolean;
  showOnHeader: boolean;
  sortOrder: number;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
};

/* ========= Helpers ========= */
const uid = () => Math.random().toString(36).slice(2, 10);
const fmt = (n: number) =>
  new Intl.NumberFormat("tr-TR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);

const BOX_COUNTS: Record<string, number> = {
  "TÜL PERDE": 10,
  "FON PERDE": 5,
  GÜNEŞLİK: 5,
};
const normalize = (s: string) => s.trim().toLocaleUpperCase("tr-TR");

const isSlottedByName = (name: string) =>
  Object.keys(BOX_COUNTS).some((k) => normalize(k) === normalize(name));

const statusLabelMap: Record<Status, string> = {
  pending: "Beklemede",
  processing: "İşlemde",
  completed: "Tamamlandı",
  cancelled: "İptal",
  workshop: "Atölyede"
};
const statusDot: Record<Status, string> = {
  pending: "bg-amber-500",
  processing: "bg-blue-500",
  completed: "bg-emerald-600",
  cancelled: "bg-rose-600",
  workshop: "bg-blue-100",
};

// ISO/Date → YYYY-MM-DD (input için)
const toYMD = (value?: string | null) => {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
};
// YYYY-MM-DD → yerel gösterim
const ymdToLocal = (ymd?: string | null) => {
  if (!ymd) return "—";
  const d = new Date(`${ymd}T00:00:00`);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("tr-TR");
};

/* ========= API ========= */
async function fetchCategories(): Promise<Category[]> {
  const res = await fetch("/api/categories", { cache: "no-store" });
  if (!res.ok) throw new Error("Kategoriler yüklenemedi");
  return res.json();
}
async function fetchOrderById(id: string): Promise<Order> {
  const res = await fetch(`/api/orders/${id}`, { cache: "no-store" });
  if (!res.ok) throw new Error("Sipariş yüklenemedi");
  return res.json();
}
async function fetchProfile(): Promise<Profile> {
  const res = await fetch("/api/company-profile", { cache: "no-store" });
  if (!res.ok) throw new Error("Profil alınamadı");
  const j = await res.json();
  return {
    companyName: j?.profile?.companyName ?? "",
    phone: j?.profile?.phone ?? null,
    email: j?.profile?.email ?? null,
    address: j?.profile?.address ?? null,
    taxNumber: j?.profile?.taxNumber ?? null,
    taxOffice: j?.profile?.taxOffice ?? null,
    logoUrl: j?.profile?.logoUrl ?? null,
    instagram: j?.profile?.instagram ?? null,
    website: j?.profile?.website ?? null,
  };
}
async function fetchBranches(): Promise<Branch[]> {
  const res = await fetch("/api/branches?all=1", { cache: "no-store" });
  if (!res.ok) throw new Error("Şubeler alınamadı");
  const j = await res.json();
  const arr = Array.isArray(j) ? j : j?.items ?? [];
  return arr.map((b: any) => ({
    id: b.id,
    name: b.name,
    code: b.code ?? null,
    isActive: !!b.isActive,
    showOnHeader: !!b.showOnHeader,
    sortOrder: Number.isFinite(b.sortOrder) ? b.sortOrder : 0,
    phone: b.phone ?? null,
    email: b.email ?? null,
    address: b.address ?? null,
  })) as Branch[];
}

/** Kategoriye yeni varyant ekleme */
async function createVariant(
  categoryId: string,
  payload: { name: string; unitPrice: number }
) {
  const res = await fetch(`/api/categories/${categoryId}/variants`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await res.text().catch(() => "Ürün eklenemedi"));
  return res.json() as Promise<Variant>;
}

/* ========= Page ========= */
export default function EditOrderPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  // master
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  // company/header
  const [profile, setProfile] = useState<Profile | null>(null);
  const [headerBranches, setHeaderBranches] = useState<Branch[]>([]);

  // order
  const [orderId, setOrderId] = useState<string>("");
  const [items, setItems] = useState<LineItem[]>([]);
  const [orderNote, setOrderNote] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [status, setStatus] = useState<Status>("pending");
  const [orderType, setOrderType] = useState(0);
  const [deliveryAt, setDeliveryAt] = useState<string>(""); // YYYY-MM-DD

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const existingDbItemIds = useRef<Set<string>>(new Set());

  // drawer
  const [slot, setSlot] = useState<InsertSlot>(null);
  const [catId, setCatId] = useState("");
  const [varId, setVarId] = useState("");
  const [qty, setQty] = useState(1);
  const [width, setWidth] = useState(0);
  const [height, setHeight] = useState(0);
  const [lineNote, setLineNote] = useState("");
  const [fileDensity, setFileDensity] = useState(1.0);
  const [editingLineId, setEditingLineId] = useState<string | null>(null);
  const [targetSlotIndex, setTargetSlotIndex] = useState<number | null>(null);
  const [lineStatus, setLineStatus] = useState<Status>("processing");
  const [useCustomPrice, setUseCustomPrice] = useState(false);
  const [unitPriceInput, setUnitPriceInput] = useState<number>(0);

  // Yeni varyant modal
  const [showVarModal, setShowVarModal] = useState(false);
  const [newVarName, setNewVarName] = useState("");
  const [newVarPrice, setNewVarPrice] = useState<string>("");
  const [savingVariant, setSavingVariant] = useState(false);
  const [netTotal, setNetTotal] = useState(0);
  const [totalPrice, setTotalPrice] = useState(0);
  const [discount, setDiscount] = useState(0);
  const [paidAmount, setPaidAmount] = useState(0);

  /* ==== Load ==== */
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        const [cats, ord, prof, brs] = await Promise.all([
          fetchCategories(),
          fetchOrderById(id),
          fetchProfile().catch(() => null),
          fetchBranches().catch(() => []),
        ]);
        if (!alive) return;

        setCategories(cats);

        setOrderId(ord.id);
        setCustomerName(ord.customerName || "");
        setCustomerPhone(ord.customerPhone || "");
        setOrderNote(ord.note || "");
        setStatus(ord.status ?? "processing");
        setDeliveryAt(toYMD(ord.deliveryAt)); // GET’ten Date/string → input
        setNetTotal(ord.netTotal || 0);
        setDiscount(ord.discount || 0);
        setTotalPrice(ord.total || 0);
        setPaidAmount(ord.paidTotal ?? 0);
        setOrderType(ord.orderType || 0);


        const normalized: LineItem[] = (ord.items || []).map((i: any) => {
          const qty = Math.max(1, Number(i.qty ?? 1));
          const width = Math.max(0, Number(i.width ?? 0));
          const height = Math.max(0, Number(i.height ?? 0));
          const unitPrice = Number(i.unitPrice ?? 0);
          const density = Number(i.fileDensity ?? 1);
          const sub = unitPrice * ((width / 100) * density || 1) * qty;
          const ls: Status =
            (i.lineStatus as Status) || (ord.status as Status) || "processing";
          return {
            id: i.id || uid(),
            categoryId: i.categoryId,
            variantId: i.variantId,
            qty,
            width,
            height,
            unitPrice,
            fileDensity: density,
            note: i.note ?? null,
            subtotal: sub,
            slotIndex: Number.isFinite(i.slotIndex)
              ? Number(i.slotIndex)
              : null,
            lineStatus: ls,
          };
        });
        setItems(normalized);
        existingDbItemIds.current = new Set(
          (ord.items || []).map((it: any) => it.id)
        );

        setProfile(prof);
        const hb = (brs || [])
          .filter((b) => b.isActive && b.showOnHeader)
          .sort((a, b) => a.sortOrder - b.sortOrder);
        setHeaderBranches(hb);
      } catch (e: any) {
        setError(e?.message || "Bir şeyler ters gitti");
      } finally {
        setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [id]);

  /* ==== Derived ==== */
  const selectedCategory = useMemo(
    () => categories.find((c) => c.id === catId),
    [categories, catId]
  );
  const variants = selectedCategory?.variants ?? [];
  const selectedVariant = useMemo(
    () => variants.find((v) => v.id === varId),
    [variants, varId]
  );

  useEffect(() => {
    if (!selectedCategory) {
      setVarId("");
      return;
    }
    if (variants.length > 0 && !variants.find((v) => v.id === varId))
      setVarId(variants[0].id);
  }, [selectedCategory, variants, varId]);

  useEffect(() => {
    if (!useCustomPrice) {
      setUnitPriceInput(Number(selectedVariant?.unitPrice ?? 0));
    }
  }, [selectedVariant, useCustomPrice]);

  // useEffect(() => {
  //   const subtotal = items.reduce((acc, item) => {
  //     const existing = Number(item.subtotal ?? 0);
  //     if (Number.isFinite(existing) && existing > 0) {
  //       return acc + existing;
  //     }
  //     const qtySafe = Math.max(1, Number(item.qty ?? 1));
  //     const widthSafe = Math.max(0, Number(item.width ?? 0));
  //     const densitySafe = Number(item.fileDensity ?? 1) || 1;
  //     const unitSafe = Number(item.unitPrice ?? 0);
  //     const fallback = unitSafe * ((widthSafe / 100) * densitySafe || 1) * qtySafe;
  //     return acc + fallback;
  //   }, 0);
  //   setTotalPrice(subtotal);
  //   setNetTotal(Math.max(0, subtotal - Number(discount || 0)));
  // }, [items, discount]);

  const previewSubtotal = useMemo(() => {
    if (!selectedVariant) return 0;
    const price =
      Number(useCustomPrice ? unitPriceInput : selectedVariant.unitPrice) || 0;
    const q = Math.max(1, Math.floor(qty));
    const w = Math.max(0, Math.floor(width));
    const d = Number(fileDensity) || 1;
    return price * ((w / 100) * d || 1) * q;
  }, [selectedVariant, useCustomPrice, unitPriceInput, qty, width, fileDensity]);

  const catById = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories]
  );
  const variantById = useMemo(() => {
    const m = new Map<string, Variant>();
    for (const c of categories) for (const v of c.variants) m.set(v.id, v);
    return m;
  }, [categories]);

  const groupedByCategoryName = useMemo(() => {
    const g = new Map<string, LineItem[]>();
    for (const it of items) {
      const catName = catById.get(it.categoryId)?.name?.trim() || "Kategori";
      if (!g.has(catName)) g.set(catName, []);
      g.get(catName)!.push(it);
    }
    return g;
  }, [items, catById]);

  const slottedByCategoryName = useMemo(() => {
    const m = new Map<string, (LineItem | undefined)[]>();
    for (const titleRaw of Object.keys(BOX_COUNTS))
      m.set(titleRaw, Array(BOX_COUNTS[titleRaw]).fill(undefined));
    for (const it of items) {
      const catName = catById.get(it.categoryId)?.name?.trim() || "Kategori";
      const key = Object.keys(BOX_COUNTS).find(
        (k) => normalize(k) === normalize(catName)
      );
      if (!key) continue;
      const arr = m.get(key)!;
      let target =
        Number.isFinite(it.slotIndex) && it.slotIndex !== null
          ? Math.max(0, Math.min(arr.length - 1, Number(it.slotIndex)))
          : -1;
      if (target >= 0 && arr[target] === undefined) {
        arr[target] = it;
        continue;
      }
      const firstEmpty = arr.findIndex((x) => x === undefined);
      if (firstEmpty !== -1) {
        arr[firstEmpty] = it;
        continue;
      }
    }
    return m;
  }, [items, catById]);

  // const total = useMemo(
  //   () => items.reduce((a, b) => a + (Number(b.subtotal) || 0), 0),
  //   [items]
  // );

  

  function LegendDot({ c, label }: { c: string; label: string }) {
    return (
      <span className="inline-flex items-center gap-1">
        <span className={`inline-block h-2.5 w-2.5 rounded-full ${c}`} />
        {label}
      </span>
    );
  }

  /* ===== actions ===== */
  const openAddAt = (title: string, index: number) => {
    setSlot({ title, index });
    const match = categories.find(
      (c) => normalize(c.name) === normalize(title)
    );
    setCatId(match?.id || "");
    if (match?.variants?.length) setVarId(match.variants[0].id);
    setQty(1);
    setWidth(0);
    setHeight(0);
    setLineNote("");
    setFileDensity(1.0);
    setEditingLineId(null);
    setTargetSlotIndex(index);
    setLineStatus("processing");
    const defaultPrice = Number(match?.variants?.[0]?.unitPrice ?? 0);
    setUseCustomPrice(false);
    setUnitPriceInput(defaultPrice);
  };

  const openQuickFor = (categoryName: string, index: number) => {
    const cat = categories.find(
      (c) => normalize(c.name) === normalize(categoryName)
    );
    setSlot({ title: categoryName, index });
    setCatId(cat?.id || "");
    if (cat?.variants?.length) setVarId(cat.variants[0].id);
    setQty(1);
    setWidth(0);
    setHeight(0);
    setLineNote("");
    setFileDensity(1.0);
    setEditingLineId(null);
    setTargetSlotIndex(null);
    setLineStatus("pending");
    const defaultPrice = Number(cat?.variants?.[0]?.unitPrice ?? 0);
    setUseCustomPrice(false);
    setUnitPriceInput(defaultPrice);
  };

  const closeDrawer = () => {
    setSlot(null);
    setEditingLineId(null);
  };

  const addOrUpdateLine = () => {
    if (!selectedCategory || !selectedVariant) return;
    const q = Math.max(1, Math.floor(qty));
    const w = Math.max(0, Math.floor(width));
    const price =
      Number(useCustomPrice ? unitPriceInput : selectedVariant.unitPrice) || 0;
    const d = Number(fileDensity) || 1;
    const sub = price * ((w / 100) * d || 1) * q;
    const selectedCatName = catById.get(selectedCategory.id)?.name || "";
    const isSlotted = isSlottedByName(selectedCatName);

    if (editingLineId) {
      setItems((prev) =>
        prev.map((it) =>
          it.id === editingLineId
            ? {
                ...it,
                categoryId: selectedCategory.id,
                variantId: selectedVariant.id,
                qty: q,
                width: w,
                height,
                unitPrice: price,
                note: lineNote || null,
                fileDensity: d,
                subtotal: sub,
                slotIndex: isSlotted
                  ? targetSlotIndex ?? it.slotIndex ?? 0
                  : null,
                lineStatus,
              }
            : it
        )
      );
    } else {
      const line: LineItem = {
        id: uid(),
        categoryId: selectedCategory.id,
        variantId: selectedVariant.id,
        qty: q,
        width: w,
        height,
        unitPrice: price,
        note: lineNote || undefined,
        fileDensity: d,
        subtotal: sub,
        slotIndex: isSlotted ? targetSlotIndex ?? 0 : null,
        lineStatus,
      };
      setItems((prev) => [...prev, line]);
    }
    closeDrawer();
  };

  const removeLine = (id: string) =>
    setItems((prev) => prev.filter((i) => i.id !== id));
  const editLine = (line: LineItem) => {
    setEditingLineId(line.id);
    setSlot({
      title: catById.get(line.categoryId)?.name || "Kategori",
      index: 0,
    });
    setCatId(line.categoryId);
    setVarId(line.variantId);
    setQty(line.qty);
    setWidth(line.width);
    setHeight(line.height);
    setLineNote(line.note || "");
    setFileDensity(line.fileDensity || 1.0);
    setTargetSlotIndex(
      Number.isFinite(line.slotIndex as any) ? (line.slotIndex as number) : null
    );
    setLineStatus(line.lineStatus || "pending");
    const variantPrice = Number(
      catById
        .get(line.categoryId)
        ?.variants?.find((v) => v.id === line.variantId)?.unitPrice ??
        line.unitPrice ??
        0
    );
    const currentUnit = Number(line.unitPrice ?? variantPrice);
    setUnitPriceInput(currentUnit);
    setUseCustomPrice(Math.abs(currentUnit - variantPrice) > 0.0001);
  };
  const swapInCategory = (title: string, from: number, to: number) => {
    setItems((prev) => {
      const slots = slottedByCategoryName.get(title) || [];
      const a = slots[from];
      const b = slots[to];
      return prev.map((it) => {
        if (a && it.id === a.id) return { ...it, slotIndex: to };
        if (b && it.id === b.id) return { ...it, slotIndex: from };
        return it;
      });
    });
  };
  const updateLineStatus = (id: string, s: Status) =>
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, lineStatus: s } : it))
    );

  const saveOrder = async () => {
    if (!customerName.trim() || !customerPhone.trim()) {
      toast.error("Müşteri adı ve telefon zorunlu.");
      return;
    }
    if (items.length === 0) {
      toast.error("En az bir satır ekleyin.");
      return;
    }
    setSaving(true);
    try {
      const payloadItems = items.map((i) => {
        const base: any = {
          categoryId: i.categoryId,
          variantId: i.variantId,
          qty: i.qty,
          width: i.width,
          height: i.height,
          unitPrice: i.unitPrice,
          fileDensity: i.fileDensity,
          note: i.note ?? null,
          slotIndex: Number.isFinite(i.slotIndex as any) ? i.slotIndex : null,
          lineStatus: i.lineStatus,
        };
        if (existingDbItemIds.current.has(i.id)) base.id = i.id;
        return base;
      });

      const currentIds = new Set(items.map((i) => i.id));
      const deletedIds: string[] = [];
      existingDbItemIds.current.forEach((oldId) => {
        if (!currentIds.has(oldId)) deletedIds.push(oldId);
      });
      const deleteOps = deletedIds.map((x) => ({
        id: x,
        _action: "delete" as const,
      }));

      const payload = {
        customerName,
        customerPhone,
        note: orderNote || null,
        status,
        deliveryAt: deliveryAt || null, // ✅ API artık bekliyor (YYYY-MM-DD)
        orderType: orderType,
        items: [...payloadItems, ...deleteOps],
      };

      const res = await fetch(`/api/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        console.error(
          "PATCH /api/orders/:id failed:",
          await res.text().catch(() => "")
        );
        toast.error("Değişiklikler kaydedilemedi.");
        return;
      }
      toast.success("Sipariş güncellendi!");
      router.refresh?.();
    } finally {
      setSaving(false);
    }
  };

  const storItems = useMemo(
    () => groupedByCategoryName.get("STOR PERDE") || [],
    [groupedByCategoryName]
  );
  const aksesuarItems = useMemo(
    () => groupedByCategoryName.get("AKSESUAR") || [],
    [groupedByCategoryName]
  );
  const remainingAmount = useMemo(
    () => Math.max(0, Number(netTotal || 0) - Number(paidAmount || 0)),
    [netTotal, paidAmount]
  );

  if (loading) return <div className="p-6">Yükleniyor…</div>;
  if (error) return <div className="p-6 text-red-600">Hata: {error}</div>;

  return (
    <>
      <PageOverlay show={saving} label="Kaydediliyor…" />
      <div className="mx-auto my-4 bg-white text-black print:my-0 print:bg-white print:text-black">
      {/* Toolbar (ekranda görünsün) */}
      <div className="print:hidden border-b border-neutral-200 bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/60 mb-10">
        <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center justify-between gap-3 py-3">
            {/* Left: title + tiny meta like list header */}
            <div className="min-w-0">
              <h1 className="truncate text-base font-semibold text-neutral-900">
                Siparişi Düzenle
              </h1>
            </div>

            {/* Right: actions (list page style) */}
            <div className="flex items-center gap-2">
              {/* Segmented-like pair (desktop) */}
              <div className="hidden sm:flex overflow-hidden rounded-xl border border-neutral-200 bg-white p-0.5">
                {/* A4 Yazdır */}
                <button
                  onClick={() => router.push(`/dashboard/orders/${orderId}/print`)}
                  className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
                  title="A4 Yazdır"
                >
                  <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
                    <path fill="currentColor" d="M7 3h10v4H7z" />
                    <path
                      fill="currentColor"
                      d="M5 9h14a2 2 0 0 1 2 2v6h-4v-3H7v3H3v-6a2 2 0 0 1 2-2z"
                    />
                    <path fill="currentColor" d="M7 17h10v4H7z" />
                  </svg>
                  A4 Yazdır
                </button>

                {/* Barkod Yazdır */}
                <button
                  onClick={() => router.push(`/dashboard/orders/${orderId}/label`)}
                  className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
                  title="Barkod Yazdır"
                >
                  <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
                    <path
                      fill="currentColor"
                      d="M3 4h2v16H3zM6 4h1v16H6zM9 4h2v16H9zM12 4h1v16h-1zM15 4h2v16h-2zM19 4h1v16h-1z"
                    />
                  </svg>
                  Barkod Yazdır
                </button>

                {/* Değişiklikleri Kaydet */}
                <button
                  disabled={saving}
                  onClick={saveOrder}
                  className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-60"
                  title="Değişiklikleri Kaydet"
                >
                  {saving ? (
                    <>
                      <span className="size-4 rounded-full border-2 border-neutral-300 border-t-neutral-700 animate-spin" />
                      Kaydediliyor…
                    </>
                  ) : (
                    <>
                      <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
                        <path
                          fill="currentColor"
                          d="M17 3H5a2 2 0 0 0-2 2v14h18V7l-4-4zM7 5h8v4H7V5zm13 12H4V7h2v4h10V7h.59L20 9.41V17z"
                        />
                      </svg>
                      Değişiklikleri Kaydet
                    </>
                  )}
                </button>

                {/* Sipariş Listesi */}
                {/* <button
                  onClick={() => router.push(`/dashboard/orders`)}
                  className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
                  title="Sipariş Listesi"
                >
                  <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
                    <path
                      fill="currentColor"
                      d="M7 5h14v2H7zM3 5h2v2H3zM7 11h14v2H7zM3 11h2v2H3zM7 17h14v2H7zM3 17h2v2H3z"
                    />
                  </svg>
                  Sipariş Listesi
                </button> */}
              </div>

              {/* Stacked pair (mobile) */}
              <div className="grid w-full grid-cols-2 gap-2 sm:hidden">
                <button
                  onClick={() => window.print()}
                  className="h-9 rounded-xl border border-neutral-200 bg-white px-3 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
                  title="A4 Yazdır"
                >
                  <span className="inline-flex items-center gap-1.5">
                    <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
                      <path fill="currentColor" d="M7 3h10v4H7z" />
                      <path
                        fill="currentColor"
                        d="M5 9h14a2 2 0 0 1 2 2v6h-4v-3H7v3H3v-6a2 2 0 0 1 2-2z"
                      />
                      <path fill="currentColor" d="M7 17h10v4H7z" />
                    </svg>
                    A4 Yazdır
                  </span>
                </button>

                <button
                  onClick={() => router.push(`/dashboard/orders/${orderId}/label`)}
                  className="h-9 rounded-xl border border-neutral-200 bg-white px-3 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
                  title="Barkod Yazdır"
                >
                  <span className="inline-flex items-center gap-1.5">
                    <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
                      <path
                        fill="currentColor"
                        d="M3 4h2v16H3zM6 4h1v16H6zM9 4h2v16H9zM12 4h1v16h-1zM15 4h2v16h-2zM19 4h1v16h-1z"
                      />
                    </svg>
                    Barkod Yazdır
                  </span>
                </button>

                <button
                  disabled={saving}
                  onClick={saveOrder}
                  className="h-9 rounded-xl border border-neutral-200 bg-white px-3 text-sm font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
                  title="Değişiklikleri Kaydet"
                >
                  <span className="inline-flex items-center gap-1.5">
                    <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
                      <path
                        fill="currentColor"
                        d="M17 3H5a2 2 0 0 0-2 2v14h18V7l-4-4zM7 5h8v4H7V5zm13 12H4V7h2v4h10V7h.59L20 9.41V17z"
                      />
                    </svg>
                    Kaydet
                  </span>
                </button>

                {/* <button
                  onClick={() => router.push(`/dashboard/orders`)}
                  className="h-9 rounded-xl border border-neutral-200 bg-white px-3 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
                  title="Sipariş Listesi"
                >
                  <span className="inline-flex items-center gap-1.5">
                    <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
                      <path
                        fill="currentColor"
                        d="M7 5h14v2H7zM3 5h2v2H3zM7 11h14v2H7zM3 11h2v2H3zM7 17h14v2H7zM3 17h2v2H3z"
                      />
                    </svg>
                    Liste
                  </span>
                </button> */}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* A4 Alanı */}
      <div className="m-auto w-[210mm] min-h-[297mm] print:w-auto print:min-h-[auto]">
        <Header
          customerName={customerName}
          customerPhone={customerPhone}
          status={status}
          profile={profile}
          headerBranches={headerBranches}
          deliveryAt={deliveryAt}
        />

        {/* Düzenlenebilir alanlar */}
        <div className="grid grid-cols-3 gap-3 my-4 print:hidden">
          <div>
            <label className="text-sm block">Durum</label>
            <select
              className="select mt-1 w-full"
              value={status}
              onChange={(e) => setStatus(e.target.value as Status)}
            >
              <option value="pending">Beklemede</option>
              <option value="processing">İşlemde</option>
              <option value="workshop">Atölyede</option>
              <option value="completed">Tamamlandı</option>
              <option value="cancelled">İptal</option>
            </select>
          </div>
          <div>
            <label className="text-sm block">Teslim Tarihi</label>
            <input
              type="date"
              className="select mt-1 w-full"
              value={deliveryAt}
              onChange={(e) => setDeliveryAt(e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm block">Sipariş Tipi</label>
            <select
              className="select mt-1 w-full"
              value={orderType}
              onChange={(e) => setOrderType(Number(e.target.value))}
            >
              <option value="0">Yeni Sipariş</option>
              <option value="1">Sipariş Teklifi</option>
            </select>
          </div>
          <div></div>
          <div className="mt-4 text-[10px] flex gap-4 print:hidden justify-end">
            <LegendDot c={statusDot.pending} label="Beklemede" />
            <LegendDot c={statusDot.processing} label="İşlemde" />
            <LegendDot c={statusDot.completed} label="Tamamlandı" />
            <LegendDot c={statusDot.cancelled} label="İptal" />
            <LegendDot c={statusDot.workshop} label="Atölyede" />
          </div>
        </div>

        {/* Slotted kategoriler */}
        {Object.keys(BOX_COUNTS).map((title) => {
          const key = normalize(title);
          const boxCount = BOX_COUNTS[key];
          const slots =
            slottedByCategoryName.get(title) || Array(boxCount).fill(undefined);
          return (
            <SectionEditable
              key={title}
              title={title}
              slots={slots}
              boxCount={boxCount}
              variantById={variantById}
              onAddAt={(idx) => openAddAt(title, idx)}
              onRemove={(id) => removeLine(id)}
              onEdit={(id) => {
                const line = items.find((x) => x.id === id);
                if (line) {
                  setTargetSlotIndex(
                    Number.isFinite(line.slotIndex as any)
                      ? (line.slotIndex as number)
                      : null
                  );
                  editLine(line);
                }
              }}
              onSwapSlots={(from, to) => swapInCategory(title, from, to)}
              onStatusChange={updateLineStatus}
            />
          );
        })}

        {/* Slotted olmayanlar */}
        <SectionQuickPlus
          title="STOR PERDE"
          items={storItems}
          variantById={variantById}
          onAddAt={(i) => openQuickFor("STOR PERDE", i)}
          onEdit={(id) => {
            const line = items.find((x) => x.id === id);
            if (line) editLine(line);
          }}
        />
        <SectionQuickPlus
          title="AKSESUAR"
          items={aksesuarItems}
          variantById={variantById}
          onAddAt={(i) => openQuickFor("AKSESUAR", i)}
          onEdit={(id) => {
            const line = items.find((x) => x.id === id);
            if (line) editLine(line);
          }}
        />

        {/* Not */}
        <div className="mt-6">
          <label className="text-sm font-semibold text-neutral-700">
            Sipariş Notu
          </label>
          <textarea
            className="input mt-2 min-h-[120px] w-full resize-y rounded-2xl"
            value={orderNote}
            placeholder="Bu siparişe özel not ekleyin…"
            onChange={(e) => setOrderNote(e.target.value)}
          />
        </div>

        {/* Toplam Kartları */}
        <section className="mt-4 rounded-3xl border border-neutral-200 bg-white/90 p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-base font-semibold text-neutral-900">
                Özet
              </h3>
              <p className="text-xs text-neutral-500">
                Kalemler değiştikçe rakamlar otomatik güncellenir.
              </p>
            </div>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-4">
            <StatRow label="Toplam" value={`${fmt(totalPrice)} ₺`} />
            <StatRow label="İskonto" value={`${fmt(discount)} ₺`} />
            <StatRow label="Ödenen" value={`${fmt(paidAmount)} ₺`} />
            <StatRow label="Kalan" value={`${fmt(remainingAmount)} ₺`} />
          </div>
            <div className="sm:col-span-2 rounded-2xl bg-indigo-500 px-4 py-3 text-white shadow-inner mt-3">
              <div className="text-xs font-medium uppercase tracking-wide text-white/80">
                Genel Toplam
              </div>
              <div className="mt-1 text-2xl font-semibold">{fmt(netTotal)} ₺</div>
            </div>
        </section>

        <div className="mt-4 text-[10px] tracking-wide">
          ÖZEL SİPARİŞLE YAPILAN TÜLLERDE <b>DEĞİŞİM YAPILMAMAKTADIR</b>.
          MÜŞTERİDEN KAYNAKLI HATALI ÖLÇÜLERDE <b>TERZİ ÜCRETİ ALINMAKTADIR</b>.
        </div>
      </div>

      {/* Drawer */}
      {slot && (
        <div
          className="fixed inset-0 bg-black/40 z-50 print:hidden"
          onClick={closeDrawer}
        >
          <div
            className="absolute right-0 top-0 h-full w-full max-w-[520px] bg-white shadow-xl p-4 overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="text-lg font-semibold">
                {editingLineId
                  ? "Satırı Düzenle"
                  : `${slot.title} - Kutucuk #${slot.index + 1}`}
              </div>
              <button className="btn-secondary" onClick={closeDrawer}>
                Kapat
              </button>
            </div>

            {/* Kategori & Varyant (+Yeni) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
              <div>
                <label className="text-sm">Kategori</label>
                <select
                  className="select mt-1"
                  value={catId}
                  onChange={(e) => setCatId(e.target.value)}
                >
                  <option value="">Seçin</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm">Ürün</label>
                <div className="mt-1 flex items-center gap-2">
                  <select
                    className="select flex-1"
                    value={varId}
                    onChange={(e) => setVarId(e.target.value)}
                    disabled={!selectedCategory}
                  >
                    {!selectedCategory && <option>Önce kategori seçin</option>}
                    {selectedCategory &&
                      selectedCategory.variants.length === 0 && (
                        <option>Ürün yok</option>
                      )}
                    {selectedCategory?.variants.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="h-9 rounded-xl border border-neutral-300 px-3 text-sm hover:bg-neutral-50 disabled:opacity-50"
                    disabled={!selectedCategory}
                    onClick={() => {
                      setNewVarName("");
                      setNewVarPrice("");
                      setShowVarModal(true);
                    }}
                    title="Yeni ürün ekle"
                  >
                    + Yeni
                  </button>
                </div>
              </div>
            </div>

            {/* Ölçüler */}
            <div className="grid grid-cols-3 gap-3 mb-3">
              <div>
                <label className="text-sm">Adet</label>
                <input
                  className="input mt-1 text-right"
                  type="number"
                  min={1}
                  step={1}
                  value={qty}
                  onChange={(e) => setQty(parseInt(e.target.value || "1"))}
                />
              </div>
              <div>
                <label className="text-sm">En (cm)</label>
                <input
                  className="input mt-1 text-right"
                  type="number"
                  min={0}
                  step={1}
                  value={width}
                  onChange={(e) => setWidth(parseInt(e.target.value || "0"))}
                />
              </div>
              <div>
                <label className="text-sm">Boy (cm)</label>
                <input
                  className="input mt-1 text-right"
                  type="number"
                  min={0}
                  step={1}
                  value={height}
                  onChange={(e) => setHeight(parseInt(e.target.value || "0"))}
                />
              </div>
            </div>

            {/* Pile Sıklığı + Birim Fiyat */}
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="text-sm">Pile Sıklığı</label>
                <select
                  className="select mt-1"
                  value={String(fileDensity)}
                  onChange={(e) => setFileDensity(parseFloat(e.target.value))}
                >
                  <option value="1">1.0x</option>
                  <option value="1.5">1.5x</option>
                  <option value="2">2.0x</option>
                  <option value="2.5">2.5x</option>
                  <option value="3">3.0x</option>
                  <option value="3.5">3.5x</option>
                  <option value="4">4.0x</option>
                  <option value="4.5">4.5x</option>
                  <option value="5">5.0x</option>
                </select>
              </div>
              <div>
                <label className="text-sm">Birim Fiyat</label>
                <div className="mt-1 flex items-center gap-2">
                  <input
                    className="input flex-1 text-right disabled:bg-neutral-100"
                    type="number"
                    min={0}
                    step="0.01"
                    value={
                      Number.isFinite(unitPriceInput) ? unitPriceInput : 0
                    }
                    onChange={(e) =>
                      setUnitPriceInput(parseFloat(e.target.value || "0"))
                    }
                    disabled={!useCustomPrice || !selectedVariant}
                    placeholder={
                      selectedVariant
                        ? fmt(Number(selectedVariant.unitPrice))
                        : "—"
                    }
                  />
                  <label className="flex items-center gap-1 text-xs whitespace-nowrap">
                    <input
                      type="checkbox"
                      className="size-4"
                      disabled={!selectedVariant}
                      checked={useCustomPrice}
                      onChange={(e) => setUseCustomPrice(e.target.checked)}
                    />
                    Elle
                  </label>
                </div>
              </div>
            </div>

            {/* Satır Durumu */}
            <div className="mb-4">
              <label className="text-sm">Satır Durumu</label>
              <select
                className="select mt-1 w-full"
                value={lineStatus}
                onChange={(e) => setLineStatus(e.target.value as Status)}
              >
                <option value="pending">Beklemede</option>
                <option value="processing">İşlemde</option>
                <option value="completed">Tamamlandı</option>
                <option value="cancelled">İptal</option>
              </select>
            </div>

            {/* Ara Toplam + Not */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <label className="text-sm">Ara Toplam</label>
                <input
                  className="input mt-1 text-right"
                  value={selectedVariant ? fmt(previewSubtotal) : ""}
                  readOnly
                  placeholder="—"
                />
              </div>
              <div>
                <label className="text-sm">Satır Notu</label>
                <input
                  className="input mt-1"
                  value={lineNote}
                  onChange={(e) => setLineNote(e.target.value)}
                  placeholder="Bu satıra özel not…"
                />
              </div>
            </div>

            <div className="flex gap-2">
              <button className="btn" onClick={addOrUpdateLine}>
                {editingLineId ? "Kaydet" : "Kutucuğa Ekle"}
              </button>
              {editingLineId && (
                <button
                  className="btn-secondary"
                  onClick={() => {
                    if (editingLineId) removeLine(editingLineId);
                    closeDrawer();
                  }}
                >
                  Satırı Sil
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Yeni Varyant Modal */}
      {showVarModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          role="dialog"
          aria-modal="true"
          onClick={() => setShowVarModal(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <div className="text-base font-semibold">Yeni Ürün</div>
              <button
                className="inline-flex size-8 items-center justify-center rounded-xl border border-neutral-200 hover:bg-neutral-50"
                onClick={() => setShowVarModal(false)}
                aria-label="Kapat"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-sm">Kategori</label>
                <input
                  className="input mt-1 w-full"
                  value={selectedCategory?.name || "—"}
                  readOnly
                />
              </div>
              <div>
                <label className="text-sm">Ürün Adı *</label>
                <input
                  className="input mt-1 w-full"
                  value={newVarName}
                  onChange={(e) => setNewVarName(e.target.value)}
                  placeholder="Örn: Deluxe 280 cm"
                />
              </div>
              <div>
                <label className="text-sm">Birim Fiyat (₺) *</label>
                <input
                  className="input mt-1 w-full text-right"
                  inputMode="decimal"
                  placeholder="0,00"
                  value={newVarPrice}
                  onChange={(e) => setNewVarPrice(e.target.value)}
                />
                <p className="mt-1 text-[11px] text-neutral-500">
                  Ondalık için virgül veya nokta kullanabilirsiniz.
                </p>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                className="h-9 rounded-xl border border-neutral-300 px-3 text-sm hover:bg-neutral-50"
                onClick={() => setShowVarModal(false)}
              >
                Vazgeç
              </button>
              <button
                type="button"
                className="h-9 rounded-xl bg-neutral-900 px-3 text-sm font-semibold text-white hover:bg-neutral-800 disabled:opacity-50"
                disabled={
                  !selectedCategory ||
                  !newVarName.trim() ||
                  !newVarPrice.trim() ||
                  savingVariant
                }
                onClick={async () => {
                  if (!selectedCategory) return;
                  const price = parseFloat(newVarPrice.replace(",", "."));
                  if (!Number.isFinite(price) || price < 0) {
                    toast.error("Geçerli bir fiyat girin.");
                    return;
                  }
                  try {
                    setSavingVariant(true);
                    const created = await createVariant(selectedCategory.id, {
                      name: newVarName.trim(),
                      unitPrice: price,
                    });
                    setCategories((prev) =>
                      prev.map((c) =>
                        c.id !== selectedCategory.id
                          ? c
                          : { ...c, variants: [...c.variants, created] }
                      )
                    );
                    setVarId(created.id);
                    setUseCustomPrice(false);
                    setUnitPriceInput(Number(created.unitPrice ?? 0));
                    toast.success("Ürün eklendi");
                    setShowVarModal(false);
                  } catch (err: any) {
                    toast.error(err?.message || "Ürün eklenemedi");
                  } finally {
                    setSavingVariant(false);
                  }
                }}
              >
                {savingVariant ? "Kaydediliyor…" : "Ekle"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Print styles */}
      <style jsx global>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 0;
          }
          html,
          body {
            background: white !important;
          }
          .btn,
          .btn-secondary,
          .print\\:hidden {
            display: none !important;
          }
          input,
          select,
          textarea {
            border: none !important;
            outline: none !important;
          }
        }
        input,
        select,
        textarea {
          outline: none !important;
          box-shadow: none !important;
        }
        input:focus,
        select:focus,
        textarea:focus {
          outline: none !important;
          box-shadow: none !important;
        }
      `}</style>
      </div>
    </>
  );
}

/* ========= Sub Components ========= */

function Header({
  customerName,
  customerPhone,
  status,
  profile,
  headerBranches,
  deliveryAt, // YYYY-MM-DD
}: {
  customerName: string;
  customerPhone: string;
  status: Status;
  profile: Profile | null;
  headerBranches: Branch[];
  deliveryAt?: string | null;
}) {
  return (
    <div className="flex items-start justify-between">
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold tracking-wide">
            {profile?.companyName || "—"}
          </h1>
        </div>

        <div className="mt-2 text-xs leading-5">
          {headerBranches.map((b) => (
            <div key={b.id} className="mt-1">
              <b>{b.code == "MAIN" ? "Merkez" : b.code}:</b>
              <br />
              <span>{b.address || "—"}</span>
              {b.phone ? (
                <div>
                  <b>Gsm:</b> {b.phone}
                </div>
              ) : null}
            </div>
          ))}
          {profile?.instagram && (
            <div className="mt-1 flex items-center gap-1">
              @{profile.instagram.replace(/^@/, "")}
            </div>
          )}
        </div>
      </div>

      <div className="w-[300px] text-left">
        <div className="mb-3">
          <img
            src={profile?.logoUrl || ""}
            alt=""
            height={60}
            style={{ width: "100%", height: "150px" }}
          />
        </div>
        <div className="text-xs flex justify-between">
          <b>Müşteri Adı:</b>
          <span className="inline-block min-w-[120px] text-right">
            {customerName || "—"}
          </span>
        </div>
        <div className="text-xs mt-1 flex justify-between">
          <b>Telefon:</b>
          <span className="inline-block min-w-[140px] text-right">
            {customerPhone || "—"}
          </span>
        </div>
        <div className="text-xs mt-1 flex justify-between">
          <b>Durum:</b>
          <span className="inline-block min-w-[140px] text-right">
            {statusLabelMap[status]}
          </span>
        </div>
        <div className="text-xs mt-1 flex justify-between">
          <b>Teslim Tarihi:</b>
          <span className="inline-block min-w-[140px] text-right">
            {ymdToLocal(deliveryAt || undefined)}
          </span>
        </div>
      </div>
    </div>
  );
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white px-4 py-3 shadow-sm">
      <div className="text-xs font-medium uppercase tracking-wide text-neutral-500">
        {label}
      </div>
      <div className="mt-1 text-xl font-semibold text-neutral-900">{value}</div>
    </div>
  );
}

function SectionEditable({
  title,
  slots,
  boxCount,
  variantById,
  onAddAt,
  onRemove,
  onEdit,
  onSwapSlots,
  onStatusChange,
}: {
  title: string;
  slots: (LineItem | undefined)[];
  boxCount: number;
  variantById: Map<string, Variant>;
  onAddAt: (index: number) => void;
  onRemove: (id: string) => void;
  onEdit: (id: string) => void;
  onSwapSlots: (from: number, to: number) => void;
  onStatusChange: (id: string, s: Status) => void;
}) {
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const handleDragStart = (i: number) => () => setDragIdx(i);
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };
  const handleDrop = (i: number) => (e: React.DragEvent) => {
    e.preventDefault();
    if (dragIdx === null || dragIdx === i) return;
    onSwapSlots(dragIdx, i);
    setDragIdx(null);
  };

  return (
    <div className="mt-5 break-inside-avoid">
      <div className="font-semibold mb-2 uppercase">{title}</div>
      <div className="grid grid-cols-5 gap-x-6 gap-y-3">
        {Array.from({ length: boxCount }).map((_, i) => {
          const it = slots[i];
          const variant = it ? variantById.get(it.variantId) : null;
          const statusColor = it ? statusDot[it.lineStatus] : "";

          return (
            <div
              key={i}
              className={`min-h-[60px] border border-black/70 p-2 border-l-0 border-b-0 relative group ${statusColor} ${
                dragIdx === i ? "bg-black/5" : ""
              }`}
              onDragOver={handleDragOver}
              onDrop={handleDrop(i)}
            >
              {!it ? (
                <button
                  className="absolute inset-0 w-full h-full flex items-center justify-center text-sm text-gray-600 hover:text-black hover:bg-black/5 print:hidden"
                  onClick={() => onAddAt(i)}
                >
                  + Ekle
                </button>
              ) : (
                <div
                  className="text-[8px] leading-3"
                  draggable
                  onDragStart={handleDragStart(i)}
                  title="Sürükleyip başka kutuya bırakın"
                >
                  <div className="absolute right-1 top-1 flex items-center gap-1 print:hidden opacity-0 group-hover:opacity-100 transition">
                    <span
                      className={`inline-block h-2.5 w-2.5 rounded-full ${
                        statusDot[it.lineStatus]
                      }`}
                    />
                    <select
                      className="border text-[10px] rounded px-1 py-0.5 bg-white"
                      value={it.lineStatus}
                      onChange={(e) =>
                        onStatusChange(it.id, e.target.value as Status)
                      }
                    >
                      <option value="pending">Beklemede</option>
                      <option value="processing">İşlemde</option>
                      <option value="completed">Tamamlandı</option>
                      <option value="cancelled">İptal</option>
                    </select>
                  </div>

                  <div>
                    <b>Tür :</b> {variant?.name || "—"}
                    <br />
                    <b>Adet :</b> {it.qty} – <b>Ölçü :</b> {it.width}×
                    {it.height} cm
                    <br />
                    <b>Pile Sıklığı :</b> {it.fileDensity}x<br />
                    <b>Birim :</b> {fmt(Number(it.unitPrice))}
                    <br />
                    <b>Tutar :</b> {fmt(Number(it.subtotal))}
                  </div>
                  {it.note && (
                    <div className="text-[10px] text-gray-700 mt-1">
                      Not: {it.note}
                    </div>
                  )}
                  <div className="absolute right-1 bottom-1 flex gap-1 print:hidden opacity-0 group-hover:opacity-100 transition">
                    <button
                      className="px-1 py-0.5 text-[10px] border bg-white"
                      onClick={() => onEdit(it.id)}
                    >
                      Düzenle
                    </button>
                    <button
                      className="px-1 py-0.5 text-[10px] border bg-white"
                      onClick={() => onRemove(it.id)}
                    >
                      Sil
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SectionQuickPlus({
  title,
  items,
  variantById,
  onAddAt,
  onEdit,
}: {
  title: string;
  items: LineItem[];
  variantById: Map<string, Variant>;
  onAddAt: (index: number) => void;
  onEdit: (id: string) => void;
}) {
  const order = [0, 3, 1, 4, 2, 5];
  return (
    <div className="mt-5 break-inside-avoid">
      <div className="font-semibold uppercase mb-0">{title}</div>
      <div className="grid grid-cols-2 gap-0">
        {order.map((i) => {
          const it = items[i];
          const variant = it ? variantById.get(it.variantId) : null;
          return (
            <div key={i} className="flex items-center gap-0">
              <div className="w-6 text-right text-xs">{i + 1}-</div>
              <button
                type="button"
                onClick={() => (it ? onEdit(it.id) : onAddAt(i))}
                className="input flex-1 h-[23px] rounded-none border-0 border-b border-[#999] p-0 text-sm text-left pl-2 hover:bg-black/5"
                title={it ? "Düzenle" : "Ekle"}
              >
                {it ? (
                  `${variant?.name ?? "—"} • ${it.qty} adet • ${it.width}×${
                    it.height
                  } cm • ${fmt(it.subtotal)}`
                ) : (
                  <span className="print:hidden">+ Ekle</span>
                )}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

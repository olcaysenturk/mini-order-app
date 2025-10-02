"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";

/* ========= Types ========= */
type Variant = { id: string; name: string; unitPrice: number };
type Category = { id: string; name: string; variants: Variant[] };
type Status = "pending" | "processing" | "completed" | "cancelled";

type LineItem = {
  id: string;
  categoryId: string;
  variantId: string;
  qty: number;
  width: number; // cm
  height: number; // cm (formülde kullanılmıyor ama UI'da dursun)
  unitPrice: number; // snapshot
  note?: string | null;
  fileDensity: number; // default 1.0
  subtotal: number; // unitPrice * ((width/100)*fileDensity || 1) * qty
};

type Order = {
  id: string;
  seq?: number | null;
  note?: string | null;
  createdAt: string;
  total: number;
  items: LineItem[];
  customerName: string;
  customerPhone: string;
  status: Status;
};

type InsertSlot = { title: string; index: number } | null;

/* ========= Helpers ========= */
const uid = () => Math.random().toString(36).slice(2, 10);
const fmt = (n: number) =>
  new Intl.NumberFormat("tr-TR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);

// Sadece bu kategoriler gridte görünsün
const BOX_COUNTS: Record<string, number> = {
  "TÜL PERDE": 10,
  "FON PERDE": 5,
  "GÜNEŞLİK": 5,
};

const normalize = (s: string) => s.trim().toLocaleUpperCase("tr-TR");
const hasBoxCount = (name: string) =>
  Object.prototype.hasOwnProperty.call(BOX_COUNTS, normalize(name));

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

/* ========= Page ========= */
export default function EditOrderPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  // master data
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  // order
  const [orderId, setOrderId] = useState<string>("");
  const [items, setItems] = useState<LineItem[]>([]);
  const [orderNote, setOrderNote] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [orderSeq, setOrderSeq] = useState<number | string>("—");
  const [status, setStatus] = useState<Status>("pending");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // PATCH’te “sadece DB’de var olan” item id’lerini göndermek için
  const existingDbItemIds = useRef<Set<string>>(new Set());

  // drawer (inline editor)
  const [slot, setSlot] = useState<InsertSlot>(null);
  const [catId, setCatId] = useState("");
  const [varId, setVarId] = useState("");
  const [qty, setQty] = useState(1);
  const [width, setWidth] = useState(0);
  const [height, setHeight] = useState(0);
  const [lineNote, setLineNote] = useState("");
  const [fileDensity, setFileDensity] = useState(1.0); // default 1.0
  const [editingLineId, setEditingLineId] = useState<string | null>(null);

  /* ==== Load ==== */
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        const [cats, ord] = await Promise.all([
          fetchCategories(),
          fetchOrderById(id),
        ]);
        if (!alive) return;

        setCategories(cats);
        setOrderId(ord.id);
        setCustomerName(ord.customerName || "");
        setCustomerPhone(ord.customerPhone || "");
        setOrderNote(ord.note || "");
        setOrderSeq(typeof ord.seq === "number" ? ord.seq : ord.id);
        setStatus(ord.status ?? "pending");

        // Normalize: yeni formülle subtotal (unitPrice * ((width/100)*density || 1) * qty)
        const normalized: LineItem[] = (ord.items || []).map((i: any) => {
          const qty = Math.max(1, Number(i.qty ?? 1));
          const width = Math.max(0, Number(i.width ?? 0));
          const height = Math.max(0, Number(i.height ?? 0));
          const unitPrice = Number(i.unitPrice ?? 0);
          const density = Number(i.fileDensity ?? 1);
          const sub = unitPrice * (((width / 100) * density) || 1) * qty;
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
          };
        });
        setItems(normalized);

        // DB’den gelen gerçek kalem id’leri
        existingDbItemIds.current = new Set(
          (ord.items || []).map((it: any) => it.id)
        );
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
    if (variants.length > 0 && !variants.find((v) => v.id === varId)) {
      setVarId(variants[0].id);
    }
  }, [selectedCategory, variants, varId]);

  // Önizleme: unitPrice * ((width/100) * fileDensity || 1) * qty
  const previewSubtotal = useMemo(() => {
    if (!selectedVariant) return 0;
    const p = Number(selectedVariant.unitPrice) || 0;
    const q = Math.max(1, Math.floor(qty));
    const w = Math.max(0, Math.floor(width));
    const d = Number(fileDensity) || 1;
    return p * (((w / 100) * d) || 1) * q;
  }, [selectedVariant, qty, width, fileDensity]);

  // Maps
  const catById = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories]
  );
  const variantById = useMemo(() => {
    const m = new Map<string, Variant>();
    for (const c of categories) for (const v of c.variants) m.set(v.id, v);
    return m;
  }, [categories]);

  // Grouping (print düzeniyle aynı)
  const groupedByCategoryName = useMemo(() => {
    const g = new Map<string, LineItem[]>();
    for (const it of items) {
      const catName = catById.get(it.categoryId)?.name?.trim() || "Kategori";
      if (!g.has(catName)) g.set(catName, []);
      g.get(catName)!.push(it);
    }
    return g;
  }, [items, catById]);

  const sectionTitles = useMemo(() => {
    const arr = Array.from(groupedByCategoryName.keys());
    const priority = ["TÜL PERDE", "FON PERDE", "GÜNEŞLİK"];
    const sorted: string[] = [];
    for (const p of priority) {
      if (!arr.find((a) => a.toLowerCase() === p.toLowerCase())) {
        sorted.push(p); // boş da olsa göster
      } else {
        sorted.push(arr.find((a) => a.toLowerCase() === p.toLowerCase())!);
      }
    }
    const others = arr.filter(
      (a) => !priority.find((p) => p.toLowerCase() === a.toLowerCase())
    );
    others.sort((a, b) => a.localeCompare(b, "tr"));
    return [...sorted, ...others];
  }, [groupedByCategoryName]);

  const total = useMemo(
    () => items.reduce((a, b) => a + (Number(b.subtotal) || 0), 0),
    [items]
  );

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
    setFileDensity(1.0); // reset default 1.0
    setEditingLineId(null);
  };

  // ÖZEL: Belirli kategori adıyla hızlı + aç (STOR/AKSESUAR)
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
  };

  const closeDrawer = () => {
    setSlot(null);
    setEditingLineId(null);
  };

  const addOrUpdateLine = () => {
    if (!selectedCategory || !selectedVariant) return;
    const q = Math.max(1, Math.floor(qty));
    const w = Math.max(0, Math.floor(width));
    const price = Number(selectedVariant.unitPrice) || 0;
    const d = Number(fileDensity) || 1;

    // Yeni formül
    const sub = price * (((w / 100) * d) || 1) * q;

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
  };

  const saveOrder = async () => {
    if (!customerName.trim() || !customerPhone.trim()) {
      alert("Müşteri adı ve telefon zorunlu.");
      return;
    }
    if (items.length === 0) {
      alert("En az bir satır ekleyin.");
      return;
    }
    setSaving(true);
    try {
      // SADECE DB'de var olan id'leri gönder (upsert); yeni eklenenlerde id gönderme (create)
      const payloadItems = items.map((i) => {
        const base = {
          categoryId: i.categoryId,
          variantId: i.variantId,
          qty: i.qty,
          width: i.width,
          height: i.height,
          unitPrice: i.unitPrice,
          fileDensity: i.fileDensity,
          note: i.note ?? null,
        } as any;
        if (existingDbItemIds.current.has(i.id)) {
          base.id = i.id; // update
        }
        return base;
      });

      // UI’dan silinenler
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
        items: [...payloadItems, ...deleteOps],
      };

      const res = await fetch(`/api/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        console.error("PATCH /api/orders/:id failed:", txt);
        alert("Değişiklikler kaydedilemedi.");
        return;
      }

      alert("Sipariş güncellendi!");
      router.refresh?.();
    } finally {
      setSaving(false);
    }
  };

  // Özel bölümlerde ilgili kategorinin mevcut satırlarını alalım
  const storItems = groupedByCategoryName.get("STOR PERDE") || [];
  const aksesuarItems = groupedByCategoryName.get("AKSESUAR") || [];

  if (loading) return <div className="p-6">Yükleniyor…</div>;
  if (error) return <div className="p-6 text-red-600">Hata: {error}</div>;

  return (
    <div className="mx-auto my-4 bg-white text-black print:my-0 print:bg-white print:text-black">
      {/* Toolbar (ekranda) */}
      <div className="flex items-center justify-between gap-3 mb-4 print:hidden p-3">
        <h1 className="text-xl font-semibold">Sipariş Düzenle</h1>
        <div className="flex justify-between gap-3">
          <button className="btn" onClick={() => window.print()}>
            🖨️ Yazdır
          </button>
          <button className="btn" onClick={() => router.push(`/orders/${orderId}/label`)}>
            🖨️ Barkod Yazdır
          </button>
          <button
            className="btn-secondary disabled:opacity-50"
            disabled={saving}
            onClick={saveOrder}
          >
            {saving ? "Kaydediliyor…" : "Değişiklikleri Kaydet"}
          </button>
          <button className="btn-secondary" onClick={() => router.back()}>
            Geri
          </button>
        </div>
      </div>

      {/* A4 Alanı */}
      <div className="m-auto w-[210mm] min-h-[297mm] print:w-auto print:min-h-[auto]">
        {/* Header */}
        <Header
          orderSeq={orderSeq ?? "—"}
          customerName={customerName}
          customerPhone={customerPhone}
          status={status}
        />

        {/* Müşteri Alanları (ekranda düzenlenebilir) */}
        <div className="grid grid-cols-3 gap-3 my-4 print:hidden">
          <div>
            <label className="text-sm">Müşteri Adı</label>
            <input
              className="input mt-1"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Ad Soyad"
            />
          </div>
          <div>
            <label className="text-sm">Telefon</label>
            <input
              className="input mt-1"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              placeholder="05xx xxx xx xx"
            />
          </div>

          {/* Durum seçimi */}
          <div>
            <label className="text-sm">Durum</label>
            <select
              className="select mt-1"
              value={status}
              onChange={(e) => setStatus(e.target.value as Status)}
            >
              <option value="pending">Beklemede</option>
              <option value="processing">İşlemde</option>
              <option value="completed">Tamamlandı</option>
              <option value="cancelled">İptal</option>
            </select>
          </div>
        </div>

        {/* Kategoriler (print grid düzeni) — sadece BOX_COUNTS’ta olanlar */}
        {sectionTitles.map((title) => {
          const key = normalize(title);
          const visible = hasBoxCount(title);
          if (!visible) return null;

          const boxCount = BOX_COUNTS[key];
          const lines = groupedByCategoryName.get(title) || [];

          return (
            <SectionEditable
              key={title}
              title={title}
              items={lines}
              boxCount={boxCount}
              visible={lines.length > 0}
              variantById={variantById}
              onAddAt={(idx) => openAddAt(title, idx)}
              onRemove={(id) => removeLine(id)}
              onEdit={(id) => {
                const line = items.find((x) => x.id === id);
                if (line) editLine(line);
              }}
            />
          );
        })}

        {/* === ÖZEL BÖLÜM: STOR PERDE (input yerine +, doluysa özet) === */}
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

        {/* === ÖZEL BÖLÜM: AKSESUAR (STOR ile aynı davranış) === */}
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

        {/* Genel Not & Toplam */}
        <div className="grid grid-cols-3 gap-4 mt-6">
          <div className="col-span-2">
            <input
              type="text"
              className="input mt-1 min-h-[40px] w-full rounded-none"
              value={orderNote}
              placeholder="Not:"
              onChange={(e) => setOrderNote(e.target.value)}
            />
          </div>
          <div className="text-sm">
            <div className="mt-1 border border-black/70 h-9 px-2 flex items-center justify-between text-base tracking-wide">
              <span>Toplam:</span>
              <span>{fmt(total)} ₺</span>
            </div>
          </div>
        </div>

        {/* Alt uyarı */}
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

            {/* Kategori & Varyant */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
              <div>
                <label className="text-sm">Kategori</label>
                <select
                  className="select mt-1"
                  value={catId}
                  onChange={(e) => setCatId(e.target.value)}
                  disabled={loading}
                >
                  <option value="">{loading ? "Yükleniyor…" : "Seçin"}</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm">Varyant</label>
                <select
                  className="select mt-1"
                  value={varId}
                  onChange={(e) => setVarId(e.target.value)}
                  disabled={!selectedCategory || loading}
                >
                  {!selectedCategory && <option>Önce kategori seçin</option>}
                  {selectedCategory &&
                    selectedCategory.variants.length === 0 && (
                      <option>Varyant yok</option>
                    )}
                  {selectedCategory?.variants.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name}
                    </option>
                  ))}
                </select>
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

            {/* File Sıklığı + Birim Fiyat */}
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="text-sm">File Sıklığı</label>
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
                </select>
              </div>

              <div>
                <label className="text-sm">Birim Fiyat</label>
                <input
                  className="input mt-1 text-right"
                  value={
                    selectedVariant
                      ? fmt(Number(selectedVariant.unitPrice))
                      : ""
                  }
                  readOnly
                  placeholder="—"
                />
              </div>
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
        /* Focus/outline tamamen kapansın */
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
  );
}

/* ========= Sub Components ========= */

function Header({
  orderSeq,
  customerName,
  customerPhone,
  status,
}: {
  orderSeq: number | string;
  customerName: string;
  customerPhone: string;
  status: Status;
}) {
  const seqStr =
    typeof orderSeq === "number"
      ? orderSeq.toString().padStart(6, "0")
      : orderSeq.toString();

  const statusLabelMap: Record<Status, string> = {
    pending: "Beklemede",
    processing: "İşlemde",
    completed: "Tamamlandı",
    cancelled: "İptal",
  };

  return (
    <div className="flex items-start justify-between">
      <div>
        <h1 className="text-4xl font-bold tracking-wide">PERDE KONAĞI</h1>
        <div className="text-xs leading-5 mt-1">
          <div>
            <b>Gaziosmanpaşa Şubesi:</b>
            <br />
            Bağlarbaşı Mah. Bağlarbaşı Cad. No: 80-82 G.O.Paşa / İST.
          </div>
          <div>Gsm: 0531 688 50 45</div>
          <div className="mt-1">
            <b>Sultangazi Şubesi:</b>
            <br />
            Uğur Mumcu Mah. Muhsin Yazıcıoğlu Cad. No: 56/A Sultangazi / İST.
          </div>
          <div>Gsm: 0533 702 04 88</div>
          <div className="mt-1 flex items-center gap-1">Perdekonagi</div>
        </div>
      </div>
      <div className="w-[300px] text-left">
        <div className="mb-3">
          <img
            src={"/brillant.png"}
            alt="Brillant"
            height={60}
            style={{ width: "100%", height: "100px" }}
          />
        </div>
        <div className="text-xs flex justify-between">
          <b>Müşteri Adı:</b>{" "}
          <span className="inline-block min-w-[120px] text-right">
            {customerName || "—"}
          </span>
        </div>
        <div className="text-xs mt-1 flex justify-between">
          <b>Telefon:</b>{" "}
          <span className="inline-block min-w-[140px] text-right">
            {customerPhone || "—"}
          </span>
        </div>

        {/* Durum satırı */}
        <div className="text-xs mt-1 flex justify-between">
          <b>Durum:</b>{" "}
          <span className="inline-block min-w-[140px] text-right">
            {statusLabelMap[status]}
          </span>
        </div>

        <div className="mt-3 font-semibold">
          SIRA No:{" "}
          <span className="inline-block min-w-[80px] text-red-700">
            {seqStr}
          </span>
        </div>
      </div>
    </div>
  );
}

function SectionEditable({
  title,
  items,
  boxCount,
  variantById,
  onAddAt,
  onRemove,
  onEdit,
  visible, // API uyumu için var; faydalı değilse kaldırabilirsiniz
}: {
  title: string;
  items: LineItem[];
  boxCount: number;
  variantById: Map<string, Variant>;
  onAddAt: (index: number) => void;
  onRemove: (id: string) => void;
  onEdit: (id: string) => void;
  visible: boolean;
}) {
  return (
    <div className="mt-5 break-inside-avoid">
      <div className="font-semibold mb-2 uppercase">{title}</div>
      <div className={`grid grid-cols-5 gap-x-6 gap-y-3`}>
        {Array.from({ length: boxCount }).map((_, i) => {
          const it = items[i];
          const variant = it ? variantById.get(it.variantId) : null;

          return (
            <div
              key={i}
              className="min-h-[60px] border border-black/70 p-2 border-l-0 border-b-0 relative group"
            >
              {!it ? (
                <button
                  className="absolute inset-0 w-full h-full flex items-center justify-center text-sm text-gray-600 hover:text-black hover:bg-black/5 print:hidden"
                  onClick={() => onAddAt(i)}
                >
                  + Ekle
                </button>
              ) : (
                <div className="text-[8px] leading-3">
                  <div className="font-medium">
                    <b>Tür :</b> {variant?.name || "—"}
                  </div>
                  <div>
                    <b>Adet :</b> {it.qty} – <b>Ölçü :</b> {it.width}×
                    {it.height} cm
                    <br />
                    <b>File Sıklığı :</b> {it.fileDensity}x
                    <br />
                    <b>Birim :</b> {fmt(Number(it.unitPrice))}
                    <br />
                    <b>Tutar :</b> {fmt(Number(it.subtotal))}
                  </div>
                  {it.note && (
                    <div className="text-[10px] text-gray-700 mt-1">
                      Not: {it.note}
                    </div>
                  )}
                  {/* Row actions (screen only) */}
                  <div className="absolute right-1 top-1 flex gap-1 print:hidden opacity-0 group-hover:opacity-100 transition">
                    <button
                      className="px-1 py-0.5 text-[10px] border"
                      onClick={() => onEdit(it.id)}
                    >
                      Düzenle
                    </button>
                    <button
                      className="px-1 py-0.5 text-[10px] border"
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

/* ===== Özel Bölüm: STOR / AKSESUAR (input yerine “+ Ekle”; doluysa özet) ===== */
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
  // İki sütunda 1-4, 2-5, 3-6
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
                className="
                  input flex-1 h-[23px]
                  rounded-none border-0 border-b border-[#999]
                  p-0 text-sm text-left pl-2
                  appearance-none outline-none focus:outline-none focus-visible:outline-none
                  focus:ring-0 focus:ring-transparent focus:shadow-none
                  hover:bg-black/5
                "
                title={it ? "Düzenlemek için tıklayın" : "Ekle"}
              >
                {it
                  ? `${variant?.name ?? "—"} • ${it.qty} adet • ${it.width}×${
                      it.height
                    } cm • ${fmt(it.subtotal)}`
                  : <span className="only-screen print:hidden">+ Ekle</span>}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// app/orders/[id]/labels-thermal/page.tsx
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { toast } from 'sonner';

type LineStatus = 'pending' | 'processing' | 'completed' | 'cancelled' | 'success';

type OrderItem = {
  id: string;
  qty: number;
  width: number;
  height: number;
  unitPrice: number | string;
  subtotal: number | string;
  note?: string | null;
  fileDensity: number | string;
  category: { name: string };
  variant: { name: string };
  lineStatus?: LineStatus | string;
};

type Order = {
  id: string;
  items: OrderItem[];
  customerName: string;
  customerPhone: string;
  note?: string | null;
};

const fmt = (n: number) =>
  new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

const normalize = (s: string) => s.trim().toLocaleUpperCase('tr-TR');
const cx = (...arr: Array<string | false | null | undefined>) => arr.filter(Boolean).join(' ');

// İsim yazısı için kısa yardımcı (taşmayı engelle)
const nameText = (s?: string | null, max = 28) =>
  (s ?? '').toString().trim().toLocaleUpperCase('tr-TR').slice(0, max);

export default function OrderLabelsThermal() {
  const { id } = useParams<{ id: string }>();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(false);
  const [printing, setPrinting] = useState(false);

  // Görünüm seçenekleri
  const [showNotes, setShowNotes] = useState(true);

  // Barkod svg ref’leri
  const barcodeRefs = useRef<Record<string, SVGSVGElement | null>>({});

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/orders/${id}`, { cache: 'no-store' });
        if (!res.ok) throw new Error('Sipariş alınamadı');
        setOrder(await res.json());
      } catch (e: any) {
        toast.error(e?.message || 'Sipariş alınamadı');
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [id]);

  // 🔹 SADECE processing satırlar ve HER ÜRÜN İÇİN TEK ETİKET
  const { labels, filteredCount, totalCount } = useMemo(() => {
    if (!order) return { labels: [] as any[], filteredCount: 0, totalCount: 0 };

    const isProcessing = (st?: string) => String(st || '').toLowerCase() === 'processing';
    const filtered = order.items.filter((it) => isProcessing(it.lineStatus));

    // Her satır için 1 adet etiket (qty ne olursa olsun)
    const out = filtered.map((it) => {
      const orderTail = (order.id || '').slice(-6);
      const itemTail = (it.id || '').slice(-6);
      const barcodeValue = `${orderTail}-${itemTail}-01`;
      const key = it.id; // tek kopya olduğu için direkt id
      return { base: it, key, barcodeValue, customerName: order.customerName ?? '' };
    });

    return { labels: out, filteredCount: filtered.length, totalCount: order.items.length };
  }, [order]);

  // Barkodları çiz
  useEffect(() => {
    (async () => {
      if (!order || labels.length === 0) return;
      const JsBarcode = (await import('jsbarcode')).default; // npm i jsbarcode
      labels.forEach(({ key, barcodeValue, customerName }) => {
        const svg = barcodeRefs.current[key];
        if (svg) {
          JsBarcode(svg, barcodeValue, {
            format: 'CODE128',
            displayValue: true,               // barkod altında yazı göster
            text: nameText(customerName),     // yazıya müşteri adı koy
            textMargin: 2,                    // yazı üst boşluk
            fontSize: 12,                     // termal 60x40 için uygun
            margin: 0,
            lineColor: '#000',
            width: 1.2,
            height: 44,
          });
        }
      });
    })();
  }, [order, labels]);

  // Atölyeye geçir + yazdır
  const setWorkshopAndPrint = async () => {
    if (!order?.id) return;
    setPrinting(true);
    try {
      const res = await fetch(`/api/orders/${order.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'workshop' }),
      });
      if (!res.ok) {
        const t = await res.text().catch(() => '');
        throw new Error(t || 'Durum güncellenemedi');
      }
      toast.success('Sipariş atölyeye aktarıldı');

      try {
        const refreshed = await fetch(`/api/orders/${order.id}`, { cache: 'no-store' });
        if (refreshed.ok) setOrder(await refreshed.json());
      } catch {}

      window.print();
    } catch (e: any) {
      toast.error(e?.message || 'İşlem başarısız');
    } finally {
      setPrinting(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse rounded-2xl border border-gray-200 bg-white p-4">
          <div className="mb-4 h-6 w-44 rounded bg-gray-200" />
          <div className="grid grid-cols-2 gap-3">
            <div className="h-16 rounded bg-gray-100" />
            <div className="h-16 rounded bg-gray-100" />
          </div>
        </div>
      </div>
    );
  }
  if (!order) return <div className="p-6">Sipariş bulunamadı.</div>;

  const labelCount = labels.length;

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-50 to-white print:bg-white print:from-white print:to-white">
      <div className="mx-auto max-w-[1200px] p-4 print:p-0">
        {/* Üst çubuk */}
        <div className="sticky top-0 z-10 mb-4 print:hidden">
          <div className="rounded-2xl border border-zinc-200 bg-white/70 backdrop-blur supports-[backdrop-filter]:bg-white/60 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="flex flex-col gap-1">
                <h1 className="text-lg font-semibold tracking-tight">Barkod Etiketleri</h1>
                <div className="flex items-center gap-2">
                  <Badge>Yalnızca<b className="ml-2">İşlemde olan satırlar</b></Badge>
                  <Badge muted>Satır: {filteredCount}/{totalCount}</Badge>
                  <Badge muted>Etiket: {labelCount}</Badge>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {/* İstersen not gizle/göster */}
                <button
                  onClick={() => setShowNotes((v) => !v)}
                  className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50"
                >
                  {showNotes ? 'Notları Gizle' : 'Notları Göster'}
                </button>

                <button
                  className={cx(
                    'inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium',
                    labelCount === 0 || printing
                      ? 'bg-zinc-200 text-zinc-500 cursor-not-allowed'
                      : 'bg-black text-white hover:bg-black/90'
                  )}
                  onClick={setWorkshopAndPrint}
                  disabled={labelCount === 0 || printing}
                  title={labelCount === 0 ? 'Yazdırılacak satır yok' : 'Atölyeye aktar ve yazdır'}
                >
                  {printing ? 'İşleniyor…' : '🖨️ Yazdır (Atölye)'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Etiketler */}
        <div className="labels-grid">
          {labels.map(({ base, key, barcodeValue, customerName }) => (
            <div className="sheet rounded-xl border border-zinc-200 bg-white shadow-sm" key={key}>
              <Label60x40
                it={base}
                showNote={showNotes}
                barcodeValue={barcodeValue}
                customerName={customerName}
                svgRef={(el) => (barcodeRefs.current[key] = el)}
              />
            </div>
          ))}

          {labelCount === 0 && (
            <div className="col-span-full">
              <EmptyState />
            </div>
          )}
        </div>
      </div>

      {/* Global stiller (mm ölçüleri + print) */}
      <style jsx global>{`
  :root {
    --label-w: 60mm;
    --label-h: 40mm;
    --pad: 1mm; /* ekran için; print'te 0'a çekiyoruz */
  }

  .labels-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(var(--label-w), 1fr));
    gap: 14px;
  }
  .sheet {
    width: var(--label-w);
    height: var(--label-h);
    page-break-after: always;
  }

  @media print {
    @page {
      size: var(--label-w) var(--label-h);
      margin: 0;
    }
    * {
      margin: 0 !important;
      padding: 0 !important;
      border: 0 !important;
      box-shadow: none !important;
      background: transparent !important;
    }
    html, body {
      width: var(--label-w) !important;
      height: var(--label-h) !important;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
      line-height: 1 !important;
    }
    .min-h-screen { background: #fff !important; }
    .mx-auto, .max-w\\[1200px\\], .p-4 { 
      max-width: none !important;
      width: var(--label-w) !important;
      padding: 0 !important;
      margin: 0 !important;
    }
    .labels-grid {
      display: block !important;
      gap: 0 !important;
    }
    .sheet {
      width: var(--label-w) !important;
      height: var(--label-h) !important;
      background: #fff !important;
      page-break-after: always;
      break-after: page;
      page-break-inside: avoid;
      border-radius: 0 !important;
    }
    :root { --pad: 0mm; }
    .print\\:hidden { display: none !important; }
  }
`}</style>
    </div>
  );
}

/* ==== Küçük UI parçaları ==== */
function Badge({ children, muted = false }: { children: React.ReactNode; muted?: boolean }) {
  return (
    <span
      className={cx(
        'inline-flex items-center rounded-lg border px-2 py-0.5 text-xs',
        muted ? 'border-zinc-200 bg-zinc-50 text-zinc-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'
      )}
    >
      {children}
    </span>
  );
}

function EmptyState() {
  return (
    <div className="flex h-[220px] flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 text-center">
      <div className="mb-2 text-5xl">🧾</div>
      <div className="text-sm font-medium text-zinc-800">Yazdırılacak etiket yok</div>
      <div className="mt-1 text-xs text-zinc-600">Yalnızca <b>Hazırlanıyor</b> durumundaki satırlar etiketlenir.</div>
    </div>
  );
}

/* ==== Tek etiket (60×40 mm) ==== */
function Label60x40({
  it,
  showNote,
  barcodeValue,
  customerName,
  svgRef,
}: {
  it: OrderItem;
  showNote: boolean;
  barcodeValue: string;
  customerName: string;
  svgRef: (el: SVGSVGElement | null) => void;
}) {
  const cat = it.category?.name ?? '';
  const typeName = it.variant?.name ?? '—';
  const w = Number(it.width || 0);
  const h = Number(it.height || 0);
  const density = Number(it.fileDensity || 1);
  const isStor = normalize(cat) === 'STOR PERDE';
  const area = isStor ? (w / 100) * (h / 100) : 0;

  return (
    <div className="flex h-full w-full flex-col justify-between p-[var(--pad)] text-black">
      {/* Üst bilgi */}
      <div className="leading-tight">
        <div className="mb-2 flex items-center gap-1 text-[18px] font-bold uppercase tracking-tight">
          
          {isStor && (
            <span className="rounded-md border border-emerald-200 bg-emerald-50 px-1.5 py-[1px] text-[10px] font-medium text-emerald-700">
              m² hesap
            </span>
          )}
        </div>

        <div className="space-y-1 text-[14px]">
          <div>
            <b className='mb-1 block'>{nameText(customerName)}</b>
            <b>Ürün :</b>{cat} - {typeName}
            <br />
            <b>Adet :</b> {it.qty}
            <br />
            <b>En :</b> {w} cm
            <br />
            <b>Boy :</b> {h} cm
            {isStor && (
              <>
                {' '}– <b>Alan :</b> {fmt(area)} m²
              </>
            )}
          </div>

          <div><b>Pile Sıklığı :</b> {density}x</div>

          {showNote && it.note ? (
            <div className="mt-1 line-clamp-3 text-[14px]">
              <b>Not:</b> {it.note}
            </div>
          ) : null}
        </div>
      </div>

      {/* Barkod + altında müşteri adı */}
      {/* <div className="flex justify-center">
        <svg
          ref={svgRef}
          width="100%"
          height="44"
          aria-label={`Barkod: ${barcodeValue} - ${nameText(customerName)}`}
        />
      </div> */}
    </div>
  );
}

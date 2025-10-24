'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'next/navigation';

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
  /** filtre için */
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

// ufak yardımcı — koşullu class
const cx = (...arr: Array<string | false | null | undefined>) => arr.filter(Boolean).join(' ');

export default function OrderLabelsThermal() {
  const { id } = useParams<{ id: string }>();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(false);

  // ekran seçenekleri
  const [replicateByQty, setReplicateByQty] = useState(true); // adet kadar kopya
  const [showNotes, setShowNotes] = useState(true); // not göster/gizle

  // barkod svg ref’leri
  const barcodeRefs = useRef<Record<string, SVGSVGElement | null>>({});

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/orders/${id}`, { cache: 'no-store' });
        if (!res.ok) throw new Error('Sipariş alınamadı');
        setOrder(await res.json());
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [id]);

  // SADECE success/completed
  const { labels, filteredCount, totalCount } = useMemo(() => {
    if (!order) return { labels: [] as any[], filteredCount: 0, totalCount: 0 };

    const isOk = (st?: string) => {
      const s = String(st || '').toLowerCase();
      return s === 'success' || s === 'completed';
    };

    const filtered = order.items.filter((it) => isOk(it.lineStatus));
    const out: Array<{ base: OrderItem; idx: number; key: string; barcodeValue: string }> = [];

    for (const it of filtered) {
      const copies = replicateByQty ? Math.max(1, Number(it.qty || 1)) : 1;
      for (let i = 0; i < copies; i++) {
        const key = `${it.id}-${i}`;
        const orderTail = (order.id || '').slice(-6);
        const itemTail = (it.id || '').slice(-6);
        const barcodeValue = `${orderTail}-${itemTail}-${(i + 1).toString().padStart(2, '0')}`;
        out.push({ base: it, idx: i, key, barcodeValue });
      }
    }

    return { labels: out, filteredCount: filtered.length, totalCount: order.items.length };
  }, [order, replicateByQty]);

  // barkodları çiz
  useEffect(() => {
    (async () => {
      if (!order || labels.length === 0) return;
      const JsBarcode = (await import('jsbarcode')).default; // npm i jsbarcode
      labels.forEach(({ key, barcodeValue }) => {
        const svg = barcodeRefs.current[key];
        if (svg) {
          JsBarcode(svg, barcodeValue, {
            format: 'CODE128',
            displayValue: false,
            margin: 0,
            lineColor: '#000',
            width: 1.2,
            height: 44,
          });
        }
      });
    })();
  }, [order, labels]);

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse rounded-2xl border border-gray-200 bg-white p-4">
          <div className="h-6 w-44 rounded bg-gray-200 mb-4" />
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
        <div className="print:hidden sticky top-0 z-10 mb-4">
          <div className="rounded-2xl border border-zinc-200 bg-white/70 backdrop-blur supports-[backdrop-filter]:bg-white/60 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="flex flex-col gap-1">
                <h1 className="text-lg font-semibold tracking-tight">Barkod Etiketleri</h1>
                <div className="flex items-center gap-2">
                  <Badge>Yalnızca <b className='ml-2'>Tamamlanan siparişler</b></Badge>
                  <Badge muted>
                    Satır: {filteredCount}/{totalCount}
                  </Badge>
                  <Badge muted>Etiket: {labelCount}</Badge>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {/* <Toggle
                  label="Adet kadar çoğalt"
                  pressed={replicateByQty}
                  onClick={() => setReplicateByQty((v) => !v)}
                />
                <Toggle
                  label="Notları göster"
                  pressed={showNotes}
                  onClick={() => setShowNotes((v) => !v)}
                /> */}
                <button
                  className={cx(
                    'inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium',
                    labelCount === 0
                      ? 'bg-zinc-200 text-zinc-500 cursor-not-allowed'
                      : 'bg-black text-white hover:bg-black/90'
                  )}
                  onClick={() => window.print()}
                  disabled={labelCount === 0}
                  title={labelCount === 0 ? 'Yazdırılacak satır yok' : 'Yazdır'}
                >
                  🖨️ Yazdır
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* İçerik */}
        <div className="labels-grid">
          {labels.map(({ base, key, barcodeValue }) => (
            <div className="sheet rounded-xl border border-zinc-200 bg-white shadow-sm" key={key}>
              <Label70
                it={base}
                showNote={showNotes}
                qtyOnLabel={replicateByQty ? 1 : Number(base.qty || 1)}
                barcodeValue={barcodeValue}
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
          --label-w: 70mm;
          --label-h: 70mm;
          --pad: 3mm;
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
          @page { size: var(--label-w) var(--label-h); margin: 0; }
          html, body {
            width: var(--label-w);
            height: var(--label-h);
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
            background: #fff !important;
          }
          .labels-grid { display: block; }
          .sheet {
            width: var(--label-w) !important;
            height: var(--label-h) !important;
            border: none !important;
            box-shadow: none !important;
            break-after: page;
            page-break-after: always;
            border-radius: 0 !important;
          }
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

function Toggle({ label, pressed, onClick }: { label: string; pressed: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={pressed}
      className={cx(
        'inline-flex items-center gap-2 rounded-xl border px-3 py-1.5 text-sm font-medium transition',
        pressed
          ? 'border-black bg-black text-white shadow-sm'
          : 'border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50'
      )}
      type="button"
    >
      <span
        className={cx(
          'h-4 w-7 rounded-full transition',
          pressed ? 'bg-white/30 ring-1 ring-white/60' : 'bg-zinc-100'
        )}
      />
      {label}
    </button>
  );
}

function EmptyState() {
  return (
    <div className="flex h-[220px] flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 text-center">
      <div className="mb-2 text-5xl">🧾</div>
      <div className="text-sm font-medium text-zinc-800">Yazdırılacak etiket yok</div>
      <div className="mt-1 text-xs text-zinc-600">
        Yalnızca <b>Tamamlanmış</b> durumundaki satırlar etiketlenir.
      </div>
    </div>
  );
}

/* ==== Tek etiket (70×70 mm) ==== */
function Label70({
  it,
  qtyOnLabel,
  showNote,
  barcodeValue,
  svgRef,
}: {
  it: OrderItem;
  qtyOnLabel: number;
  showNote: boolean;
  barcodeValue: string;
  svgRef: (el: SVGSVGElement | null) => void;
}) {
  const cat = it.category?.name ?? '';
  const typeName = it.variant?.name ?? '—';
  const qty = Math.max(1, Number(qtyOnLabel || it.qty || 1));
  const w = Number(it.width || 0);
  const h = Number(it.height || 0);
  const density = Number(it.fileDensity || 1);
  const unit = Number(it.unitPrice || 0);
  const isStor = normalize(cat) === 'STOR PERDE';
  const area = isStor ? (w / 100) * (h / 100) : 0;

  return (
    <div className="flex h-full w-full flex-col justify-between p-[var(--pad)] text-black">
      {/* Üst bilgi */}
      <div className="leading-tight">
        <div className="mb-2 flex items-center gap-1 text-[18px] font-bold uppercase tracking-tight">
          <span>{cat}</span>
          {isStor && (
            <span className="rounded-md border border-emerald-200 bg-emerald-50 px-1.5 py-[1px] text-[10px] font-medium text-emerald-700">
              m² hesap
            </span>
          )}
        </div>

        <div className="space-y-1 text-[22px]">
          <div>
            <b>Tür :</b> {typeName}
          </div>
          <div>
            <b>Adet :</b> {qty} <span>–</span>{' '}
            <b>Ölçü :</b> {w}×{h} cm
            {isStor && (
              <>
                {' '}<span>–</span>{' '}
                <b>Alan :</b> {fmt(area)} m²
              </>
            )}
          </div>
          <div><b>File Sıklığı :</b> {density}x</div>
          <div><b>Birim :</b> {fmt(unit)}</div>
          {showNote && it.note ? (
            <div className="mt-1 line-clamp-3 text-[14px]">
              <b>Not:</b> {it.note}
            </div>
          ) : null}
        </div>
      </div>

      {/* Barkod */}
      {/* <div className="flex justify-center">
        <svg ref={svgRef} width="100%" height="44" />
      </div> */}
    </div>
  );
}

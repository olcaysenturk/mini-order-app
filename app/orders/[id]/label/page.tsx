'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'next/navigation';

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
};

type Order = {
  id: string;
  items: OrderItem[];
  customerName: string;
  customerPhone: string;
  note?: string | null;
};

const fmt = (n: number) =>
  new Intl.NumberFormat('tr-TR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);

export default function OrderLabelsThermal() {
  const { id } = useParams<{ id: string }>();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(false);

  // seçenekler (sadece ekranda)
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

  // etiket listesi (sipariş kalemlerini çoğalt)
  const labels = useMemo(() => {
    if (!order) return [];
    const out: Array<{
      base: OrderItem;
      idx: number;
      key: string;
      barcodeValue: string;
    }> = [];
    for (const it of order.items) {
      const copies = replicateByQty ? Math.max(1, Number(it.qty || 1)) : 1;
      for (let i = 0; i < copies; i++) {
        const key = `${it.id}-${i}`;
        // barkod değeri: kısa ve benzersiz bir desen (ör. sipariş/kalem son 6 char + sıra)
        const barcodeValue = `${order.id.slice(-6)}-${it.id.slice(-6)}-${(i + 1)
          .toString()
          .padStart(2, '0')}`;
        out.push({ base: it, idx: i, key, barcodeValue });
      }
    }
    return out;
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
            width: 1.2, // çizgi kalınlığı (px)
            height: 44, // px – CSS ile etiket alanına sığdırıyoruz
          });
        }
      });
    })();
  }, [order, labels]);

  if (loading) return <div className="p-4">Yükleniyor…</div>;
  if (!order) return <div className="p-4">Sipariş bulunamadı.</div>;

  return (
    <div className="p-4 print:p-0">
      {/* araç çubuğu (ekranda) */}
      <div className="print:hidden flex flex-wrap items-center gap-3 mb-4">
        <h1 className="text-lg font-semibold">Barkod Etiketleri · #{order.id.slice(0, 6)}</h1>
        <label className="inline-flex items-center gap-2">
          <input
            type="checkbox"
            className="accent-black"
            checked={replicateByQty}
            onChange={(e) => setReplicateByQty(e.target.checked)}
          />
          Adet kadar çoğalt
        </label>
        <label className="inline-flex items-center gap-2">
          <input
            type="checkbox"
            className="accent-black"
            checked={showNotes}
            onChange={(e) => setShowNotes(e.target.checked)}
          />
          Notları göster
        </label>
        <button className="btn" onClick={() => window.print()}>🖨️ Yazdır</button>
      </div>

      {/* Ekran için grid önizleme; yazdırırken her .sheet ayrı sayfa olur */}
      <div className="labels-grid">
        {labels.map(({ base, key, barcodeValue }) => (
          <div className="sheet" key={key}>
            <Label70
              it={base}
              showNote={showNotes}
              qtyOnLabel={replicateByQty ? 1 : Number(base.qty || 1)}
              barcodeValue={barcodeValue}
              svgRef={(el) => (barcodeRefs.current[key] = el)}
            />
          </div>
        ))}
      </div>

      {/* Stiller */}
      <style jsx global>{`
        :root {
          --label-w: 70mm;
          --label-h: 70mm;
          --pad: 3mm;
        }

        /* Ekranda grid önizleme */
        .labels-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(var(--label-w), 1fr));
          gap: 12px;
        }
        .sheet {
          width: var(--label-w);
          height: var(--label-h);
          background: white;
          border: 1px solid #ddd; /* ekran önizleme çerçevesi */
          box-shadow: 0 2px 10px rgba(0,0,0,.06);
          page-break-after: always; /* yazdırırken her biri yeni sayfa */
        }

        /* Yazıcıya özel ayar: her sayfa tam 70×70mm, kenar boşluğu yok */
        @media print {
          @page {
            size: var(--label-w) var(--label-h);
            margin: 0;
          }
          html, body {
            width: var(--label-w);
            height: var(--label-h);
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
            background: #fff !important;
          }
          .labels-grid {
            display: block; /* grid yerine tek kolon */
          }
          .sheet {
            width: var(--label-w) !important;
            height: var(--label-h) !important;
            border: none !important;
            box-shadow: none !important;
            break-after: page;
            page-break-after: always;
          }
        }
      `}</style>
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
  const sub = Number(it.subtotal || 0);

  return (
    <div
      className="label-wrap"
      style={{
        width: '100%',
        height: '100%',
        padding: '3mm',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        color: '#000',
        fontFamily: 'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif',
      }}
    >
      {/* Üst bilgi */}
      <div style={{ lineHeight: 1.1 }}>
        <div
          style={{
            fontWeight: 700,
            fontSize: '18px',
            textTransform: 'uppercase',
            letterSpacing: '.2px',
            marginBottom: '2mm',
          }}
        >
          {cat}
        </div>

        <div style={{ fontSize: '16px' }}>
          <div><b>Tür :</b> {typeName}</div>
          <div>
            <b>Adet :</b> {qty} <span>–</span>{' '}
            <b>Ölçü :</b> {w}×{h} cm
          </div>
          <div><b>File Sıklığı :</b> {density}x</div>
          <div><b>Birim :</b> {fmt(unit)}</div>
          <div><b>Tutar :</b> {fmt(sub)}</div>
          {showNote && it.note ? (
            <div
              style={{
                marginTop: '2mm',
                fontSize: '14px',
                maxHeight: '18mm',
                overflow: 'hidden',
                display: '-webkit-box',
                WebkitLineClamp: 3,
                WebkitBoxOrient: 'vertical',
              }}
            >
              <b>Not:</b> {it.note}
            </div>
          ) : null}
        </div>
      </div>


    </div>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";

type OrderItem = {
  id: string;
  qty: number;
  width: number;
  height: number;
  unitPrice: number;
  subtotal: number;
  note?: string | null;
  category: { id: string; name: string };
  variant: { id: string; name: string };
};
type Order = {
  id: string;
  seq?: number; // sıra no
  note?: string | null;
  createdAt: string;
  total: number;
  items: OrderItem[];
  customerName: string;
  customerPhone: string;
};

const fmt = (n: number) =>
  new Intl.NumberFormat("tr-TR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);

// kategori başına kutu sayısı
const BOX_COUNTS: Record<string, number> = {
  "TÜL PERDE": 10,
  "FON PERDE": 5,
  "GÜNEŞLİK": 5,
};

export default function OrderPrintPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [paidStr, setPaidStr] = useState("");

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/orders/${params.id}`, {
          cache: "no-store",
        });
        const data: Order = await res.json();
        setOrder(data);
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [params.id]);

  // ► Kategorilere göre grupla
  const groupedByCategory = useMemo(() => {
    const g = new Map<string, OrderItem[]>();
    if (!order) return g;
    for (const it of order.items) {
      const key = it.category.name?.trim() || "Kategori";
      if (!g.has(key)) g.set(key, []);
      g.get(key)!.push(it);
    }
    return g;
  }, [order]);

  // Başlık sırası → önce 3 ana kategori, sonra diğerleri
  const sectionTitles = useMemo(() => {
    const arr = Array.from(groupedByCategory.keys());
    const priority = ["TÜL PERDE", "FON PERDE", "GÜNEŞLİK"];
    const sorted: string[] = [];

    // öncelikli olanları sıraya ekle
    for (const p of priority) {
      if (!arr.find((a) => a.toLowerCase() === p.toLowerCase())) {
        // kategori yoksa bile boş görünsün
        sorted.push(p);
      } else {
        sorted.push(arr.find((a) => a.toLowerCase() === p.toLowerCase())!);
      }
    }

    // geri kalanları alfabetik sırayla ekle
    const others = arr.filter(
      (a) => !priority.find((p) => p.toLowerCase() === a.toLowerCase())
    );
    others.sort((a, b) => a.localeCompare(b, "tr"));
    return [...sorted, ...others];
  }, [groupedByCategory]);

  const paid = useMemo(() => {
    const n = parseFloat((paidStr || "0").replace(",", "."));
    return Number.isFinite(n) ? Math.max(0, n) : 0;
  }, [paidStr]);

  const remaining = useMemo(() => {
    const t = Number(order?.total ?? 0);
    return Math.max(0, t - paid);
  }, [order, paid]);

  const handlePrint = () => window.print();

  if (loading || !order) {
    return (
      <div className="card print:hidden">
        {loading ? "Yükleniyor…" : "Sipariş bulunamadı."}
      </div>
    );
  }

  return (
    <div className="mx-auto my-4 bg-white text-black print:my-0 print:bg-white print:text-black">
      {/* Ekran üst barı */}
      <div className="flex items-center gap-2 mb-4 print:hidden">
       
        <button className="btn" onClick={handlePrint}>
          🖨️ Yazdır
        </button>

      </div>

      {/* A4 alanı */}
      <div className="m-auto   w-[210mm] min-h-[297mm] print:w-auto print:min-h-[auto]">
        {/* Üst başlık */}
        <Header
          orderSeq={order.seq ?? order.id}
          customerName={order.customerName}
          customerPhone={order.customerPhone}
        />

        {/* Dinamik kategoriler */}
        {sectionTitles.map((title) => {
          const boxCount = BOX_COUNTS[title.toUpperCase()] ?? 5;
          const items = groupedByCategory.get(title) || [];
          return (
            <Section
              key={title}
              title={title}
              items={items}
              boxCount={boxCount}
            />
          );
        })}

        {/* Toplamlar */}
        <div className="grid grid-cols-3 gap-4 mt-6">
          <TotalRow label="TOPLAM" value={fmt(Number(order.total))} />
          <TotalRow label="ALINAN" value={fmt(paid)} />
          <TotalRow label="KALAN" value={fmt(remaining)} />
        </div>

        {/* Alt uyarı */}
        <div className="mt-6 text-[10px] tracking-wide">
          ÖZEL SİPARİŞLE YAPILAN TÜLLERDE <b>DEĞİŞİM YAPILMAMAKTADIR</b>.
          MÜŞTERİDEN KAYNAKLI HATALI ÖLÇÜLERDE <b>TERZİ ÜCRETİ ALINMAKTADIR</b>.
        </div>
      </div>

      {/* Baskı stilleri */}
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
        }
      `}</style>
    </div>
  );
}

/* ---------- Parçalar ---------- */

function Header({
  orderSeq,
  customerName,
  customerPhone,
}: {
  orderSeq: number | string;
  customerName: string;
  customerPhone: string;
}) {
  const seqStr =
    typeof orderSeq === "number"
      ? orderSeq.toString().padStart(6, "0")
      : orderSeq.toString();

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
          <img src={"/brillant.png"} alt="Brillant" width={300} />
        </div>
        <div className="text-xs flex justify-between">
          <b>Müşteri Adı:</b>{" "}
          <span className="inline-block min-w-[120px] text-right">
            {customerName}
          </span>
        </div>
        <div className="text-xs mt-1 flex justify-between">
          <b>Telefon:</b>{" "}
          <span className="inline-block min-w-[140px] text-right">
            {customerPhone}
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

function Section({
  title,
  items,
  boxCount,
}: {
  title: string;
  items: OrderItem[];
  boxCount: number;
}) {
  return (
    <div className="mt-5 break-inside-avoid">
      <div className="font-semibold mb-2 uppercase">{title}</div>
      <div className={`grid grid-cols-5 gap-x-6 gap-y-3`}>
        {Array.from({ length: boxCount }).map((_, i) => {
          const it = items[i];
          return (
            <div key={i} className="min-h-[80px] border border-black/70 p-2 border-l-0 border-b-0">
              {!it ? null : (
                <div className="text-[8px] leading-3">
                  <div className="font-medium"><b>Tür :</b> {it.variant.name}</div>
                  <div>
                    {/* <b>Adet :</b> {it.qty} – <b>Ölçü :</b> {it.width}×{it.height}<br /> */}
                    <b>Birim :</b> {fmt(Number(it.unitPrice))}<br />
                    <b>Tutar :</b> {fmt(Number(it.subtotal))}
                  </div>
                  {it.note && (
                    <div className="text-[10px] text-gray-700 mt-1">Not: {it.note}</div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TotalRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-sm">
      <div className="font-semibold">{label} :</div>
      <div className="mt-1 border border-black/70 h-9 px-2 flex items-center justify-end text-base tracking-wide">
        {value}
      </div>
    </div>
  );
}

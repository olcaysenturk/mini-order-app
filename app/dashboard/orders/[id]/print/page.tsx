"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { parseYMDToLocalDate } from "@/app/lib/date";
import { PageOverlay } from "@/app/components/PageOverlay";

/* ========= Types ========= */
type Status = "pending" | "processing" | "completed" | "cancelled" | "workshop" | "delivered";
type Variant = { id: string; name: string; unitPrice: number };
type Category = { id: string; name: string; variants: Variant[] };
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
  discount?: any;
  paidTotal?: any;
  netTotal?: any;
};
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
const BOX_COUNTS: Record<string, number> = {
  "TÜL PERDE": 10,
  "FON PERDE": 5,
  GÜNEŞLİK: 5,
};
const normalize = (s: string) => s.trim().toLocaleUpperCase("tr-TR");
const fmt = (n: number) =>
  new Intl.NumberFormat("tr-TR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(n ?? 0));
const ymdToLocal = (ymd?: string | null) => {
  if (!ymd) return "—";
  const d = new Date(`${ymd}T00:00:00`);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("tr-TR");
};
const statusLabelMap: Record<Status, string> = {
  pending: "Beklemede",
  processing: "İşlemde",
  completed: "Tamamlandı",
  cancelled: "İptal",
  workshop: "Atölyede",
  delivered: "Teslim Edildi"
};

/* ========= Component ========= */
export default function PrintOrderPage() {
  const { id } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [order, setOrder] = useState<Order | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [headerBranches, setHeaderBranches] = useState<Branch[]>([]);
  const [error, setError] = useState<string | null>(null);

  // fetch data client-side
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        const [ordRes, profRes, brsRes, catsRes] = await Promise.all([
          fetch(`/api/orders/${id}`, { cache: "no-store" }),
          fetch(`/api/company-profile`, { cache: "no-store" }),
          fetch(`/api/branches?all=1`, { cache: "no-store" }),
          fetch(`/api/categories`, { cache: "no-store" }),
        ]);

        if (!alive) return;

        if (!ordRes.ok) throw new Error("Sipariş bulunamadı");
        const ord = (await ordRes.json()) as Order;
        setOrder(ord);

        const profRaw = profRes.ok ? await profRes.json() : null;
        setProfile({
          companyName: profRaw?.profile?.companyName ?? "",
          phone: profRaw?.profile?.phone ?? null,
          email: profRaw?.profile?.email ?? null,
          address: profRaw?.profile?.address ?? null,
          taxNumber: profRaw?.profile?.taxNumber ?? null,
          taxOffice: profRaw?.profile?.taxOffice ?? null,
          logoUrl: profRaw?.profile?.logoUrl ?? null,
          instagram: profRaw?.profile?.instagram ?? null,
          website: profRaw?.profile?.website ?? null,
        });

        const brsJson = brsRes.ok ? await brsRes.json() : [];
        const arr = Array.isArray(brsJson) ? brsJson : brsJson?.items ?? [];
        const hb = (arr as any[])
          .map((b) => ({
            id: b.id,
            name: b.name,
            code: b.code ?? null,
            isActive: !!b.isActive,
            showOnHeader: !!b.showOnHeader,
            sortOrder: Number.isFinite(b.sortOrder) ? b.sortOrder : 0,
            phone: b.phone ?? null,
            email: b.email ?? null,
            address: b.address ?? null,
          }))
          .filter((b: Branch) => b.isActive && b.showOnHeader)
          .sort((a: Branch, b: Branch) => a.sortOrder - b.sortOrder);
        setHeaderBranches(hb);

        const cats = catsRes.ok ? ((await catsRes.json()) as Category[]) : [];
        setCategories(cats);
      } catch (e: any) {
        setError(e?.message || "Bir hata oluştu");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [id]);

  // auto print
  useEffect(() => {
    if (searchParams.get("auto") && typeof window !== "undefined") {
      // bir tick bekleyelim ki DOM çizilsin
      const t = setTimeout(() => {
        try {
          window.print();
        } catch { }
      }, 100);
      return () => clearTimeout(t);
    }
  }, [searchParams]);

  // lookup maps
  const catById = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories]
  );
  const variantById = useMemo(() => {
    const m = new Map<string, Variant>();
    for (const c of categories) for (const v of c.variants) m.set(v.id, v);
    return m;
  }, [categories]);

  // slotted mapping
  const slottedByCategoryName = useMemo(() => {
    const m = new Map<string, (LineItem | undefined)[]>();
    for (const title of Object.keys(BOX_COUNTS))
      m.set(title, Array(BOX_COUNTS[title]).fill(undefined));
    for (const it of order?.items ?? []) {
      const catName = catById.get(it.categoryId)?.name?.trim() || "Kategori";
      const key = Object.keys(BOX_COUNTS).find(
        (k) => normalize(k) === normalize(catName)
      );
      if (!key) continue;
      const arr = m.get(key)!;
      const idx =
        Number.isFinite(it.slotIndex as any) && it.slotIndex !== null
          ? Math.max(0, Math.min(arr.length - 1, Number(it.slotIndex)))
          : -1;
      if (idx >= 0 && arr[idx] === undefined) {
        arr[idx] = it;
      } else {
        const firstEmpty = arr.findIndex((x) => x === undefined);
        if (firstEmpty !== -1) arr[firstEmpty] = it;
      }
    }
    return m;
  }, [order?.items, catById]);

  // non-slotted groups
  const groupedByCategoryName = useMemo(() => {
    const g = new Map<string, LineItem[]>();
    for (const it of order?.items ?? []) {
      const catName = catById.get(it.categoryId)?.name?.trim() || "Kategori";
      if (!g.has(catName)) g.set(catName, []);
      g.get(catName)!.push(it);
    }
    return g;
  }, [order?.items, catById]);

  const storItems = groupedByCategoryName.get("STOR PERDE") || [];
  const aksesuarItems = groupedByCategoryName.get("AKSESUAR") || [];
  const total = useMemo(
    () =>
      (order?.items ?? []).reduce((a, b) => a + (Number(b.subtotal) || 0), 0),
    [order?.items]
  );

  if (loading) return <PageOverlay show={true} label="Yükleniyor..." />;
  if (error) return <div className="p-6 text-red-600">Hata: {error}</div>;
  if (!order)
    return <div className="p-6 text-red-600">Sipariş bulunamadı.</div>;

  return (
    <div className="mx-auto my-4 bg-white text-black print:my-0">
      {/* Toolbar (ekranda görünsün) */}
      <div className="print:hidden border-b border-neutral-200 bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/60">
        <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center justify-between gap-3 py-3">
            {/* Left: title + tiny meta like list header */}
            <div className="min-w-0">
              <h1 className="truncate text-base font-semibold text-neutral-900">
                Yazdırma Önizlemesi
              </h1>
              <div className="mt-1 flex items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-lg bg-neutral-50 px-2.5 py-1 text-xs font-medium text-neutral-700 ring-1 ring-inset ring-neutral-200">
                  <svg viewBox="0 0 24 24" className="size-3.5" aria-hidden>
                    <path
                      fill="currentColor"
                      d="M6 2h9l5 5v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2m8 1.5V8h5.5"
                    />
                  </svg>
                  A4 & Barkod destekli
                </span>
                <span className="inline-flex items-center gap-1 rounded-lg bg-neutral-50 px-2.5 py-1 text-xs font-medium text-neutral-700 ring-1 ring-inset ring-neutral-200">
                  Önizleme aktif
                </span>
              </div>
            </div>

            {/* Right: actions (list page style) */}
            <div className="flex items-center gap-2">
              {/* Segmented-like pair (desktop) */}
              <div className="hidden sm:flex overflow-hidden rounded-xl border border-neutral-200 bg-white p-0.5">
                <button
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
                  title="A4 Yazdır"
                >
                  <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
                    <path fill="currentColor" d="M7 3h10v4H7z" />
                    <path
                      fill="currentColor"
                      d="M5 9h14a2 2 0 0 1 2 2v6h-4v-3H7v3H3v-6a2 2 0 0 1 2-2zm12.5 4a1 1 0 1 0 0 2 1 1 0 0 0 0-2Z"
                    />
                    <path fill="currentColor" d="M7 17h10v4H7z" />
                  </svg>
                  A4 Yazdır
                </button>
                <button
                  onClick={() => router.push(`/dashboard/orders/${order.id}/label`)}
                  className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
                  title="Barkod Yazdır"
                >
                  <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
                    <path
                      fill="currentColor"
                      d="M3 4h2v16H3V4m3 0h1v16H6V4m3 0h2v16H9V4m3 0h1v16h-1V4m3 0h2v16h-2V4m4 0h1v16h-1V4"
                    />
                  </svg>
                  Barkod Yazdır
                </button>
              </div>

              {/* Stacked pair (mobile) */}
              <div className="grid w-full grid-cols-2 gap-2 sm:hidden">
                <button
                  onClick={() => window.print()}
                  className="h-9 rounded-xl border border-neutral-200 bg-white px-3 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
                >
                  A4 Yazdır
                </button>
                <button
                  onClick={() => window.print()}
                  className="h-9 rounded-xl border border-neutral-200 bg-white px-3 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
                >
                  Barkod Yazdır
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* A4 içerik */}
      <div className="m-auto w-[210mm] h-[297mm] p-[10mm] print:overflow-hidden print:bg-white print:shadow-none">
        <PrintHeader
          customerName={order.customerName}
          customerPhone={order.customerPhone}
          status={order.status}
          profile={profile}
          headerBranches={headerBranches}
          deliveryAt={order.deliveryAt}
        />

        {/* Slot’lu kategoriler */}
        {Object.keys(BOX_COUNTS).map((title) => {
          const boxCount = BOX_COUNTS[title];
          const slots =
            slottedByCategoryName.get(title) || Array(boxCount).fill(undefined);
          return (
            <SectionSlottedPrint
              key={title}
              title={title}
              slots={slots}
              boxCount={boxCount}
              variantById={variantById}
            />
          );
        })}

        {/* Slot’suzlar */}
        <SectionListPrint
          title="STOR PERDE"
          items={storItems}
          variantById={variantById}
        />
        <SectionListPrint
          title="AKSESUAR"
          items={aksesuarItems}
          variantById={variantById}
        />

        {/* Not & Toplam */}
        <div className="mt-6 grid grid-cols-1">
          <div className="col-span-2">
            <div className="min-h-[36px] rounded-xs border border-neutral-200 bg-gradient-to-br from-neutral-50 to-white  p-2">
              <div className="">Not: {order.note || ""}</div>
            </div>
          </div>

          <div className="text-sm mt-3.5">
            <div
              className={`grid gap-2 sm:grid-cols-${order.discount > 0 ? 4 : 2
                }`}
            >
              {order.discount > 0 && (
                <div className="rounded-xs border border-neutral-200 bg-gradient-to-br from-neutral-50 to-white ">
                  <div className="flex items-center justify-between px-3 py-2">
                    <div className="flex items-center gap-2">
                      {/* <span className="print:hidden inline-flex size-6 items-center justify-center rounded-lg bg-amber-100 text-amber-700 text-xs font-semibold">
                        %
                      </span> */}
                      <span className="text-[12px] text-neutral-500">
                        İskonto
                      </span>
                    </div>
                    <span className="font-semibold tabular-nums">
                      {fmt(order.discount)} ₺
                    </span>
                  </div>
                </div>
              )}

              {/* Ödenen */}
              <div className="rounded-xs border border-neutral-200 bg-gradient-to-br from-neutral-50 to-white ">
                <div className="flex items-center justify-between px-3 py-2">
                  <div className="flex items-center gap-2">
                    {/* <span className="print:hidden inline-flex size-6 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 text-xs font-semibold">
                      ₺
                    </span> */}
                    <span className="text-[12px] text-neutral-500">Ödenen</span>
                  </div>
                  <span className="font-semibold tabular-nums">
                    {fmt(order.paidTotal)} ₺
                  </span>
                </div>
              </div>

              {/* Kalan */}
              <div className="rounded-xs border border-neutral-200 bg-gradient-to-br from-neutral-50 to-white ">
                <div className="flex items-center justify-between px-3 py-2">
                  <div className="flex items-center gap-2">
                    {/* <span className="print:hidden inline-flex size-6 items-center justify-center rounded-lg bg-indigo-100 text-indigo-700 text-xs font-semibold">
                      Σ
                    </span> */}
                    <span className="text-[12px] text-neutral-500">Kalan</span>
                  </div>
                  <span className="font-semibold tabular-nums">
                    {fmt(order.netTotal - order.paidTotal)} ₺
                  </span>
                </div>
              </div>

              {/* Toplam */}
              <div className="rounded-xs border border-neutral-200 bg-gradient-to-br from-neutral-50 to-white ">
                <div className="flex items-center justify-between px-3 py-2">
                  <div className="flex items-center gap-2">
                    {/* <span className="print:hidden inline-flex size-6 items-center justify-center rounded-lg bg-indigo-100 text-indigo-700 text-xs font-semibold">
                      Σ
                    </span> */}
                    <span className="text-[12px] text-neutral-500">Toplam</span>
                  </div>
                  <span className="font-semibold tabular-nums">
                    {fmt(order.netTotal)} ₺
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4 text-[10px] tracking-wide">
          ÖZEL SİPARİŞLE YAPILAN TÜLLERDE <b>DEĞİŞİM YAPILMAZ</b>. MÜŞTERİ
          KAYNAKLI HATALI ÖLÇÜLERDE <b>TERZİ ÜCRETİ ALINIR</b>.
        </div>
      </div>

      {/* SAF <style> — styled-jsx yok */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @media print {
              @page { size: A4 portrait; margin: 10mm; }
              .no-print { display: none !important; }
              html, body { background: white !important; }
              .avoid-break { break-inside: avoid; page-break-inside: avoid; }
            }
          `,
        }}
      />
    </div>
  );
}

/* ========= Subcomponents ========= */
function PrintHeader({
  customerName,
  customerPhone,
  status,
  profile,
  headerBranches,
  deliveryAt,
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
              <b>{b.code === "MAIN" ? "Merkez" : b.code}:</b>
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
              <InstagramIcon className="h-3.5 w-3.5" />
              <span>@{profile.instagram.replace(/^@/, "")}</span>
            </div>
          )}
        </div>
      </div>

      <div className="w-[300px] text-left">
        <div className="mb-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {profile?.logoUrl ? (
            <img
              src={profile.logoUrl}
              alt="Logo"
              style={{ width: "100%", height: "150px", objectFit: "contain" }}
            />
          ) : (
            <div className="flex h-[150px] w-full items-center justify-center border border-dashed border-neutral-300 text-xs text-neutral-500">
              Logo
            </div>
          )}
        </div>
        <div className="flex justify-between text-xs">
          <b>Müşteri Adı:</b>
          <span className="inline-block min-w-[120px] text-right">
            {customerName || "—"}
          </span>
        </div>
        <div className="mt-1 flex justify-between text-xs">
          <b>Telefon:</b>
          <span className="inline-block min-w-[140px] text-right">
            {customerPhone || "—"}
          </span>
        </div>
        <div className="mt-1 flex justify-between text-xs print:hidden">
          <b>Durum:</b>
          <span className="inline-block min-w-[140px] text-right">
            {statusLabelMap[status]}
          </span>
        </div>
        <div className="mt-1 flex justify-between text-xs">
          <b>Teslim Tarihi:</b>
          <span className="inline-block min-w-[140px] text-right">
            <b>
              {deliveryAt
                ? parseYMDToLocalDate(deliveryAt).toLocaleDateString("tr-TR")
                : "—"}
            </b>
          </span>
        </div>
      </div>
    </div>
  );
}

function SectionSlottedPrint({
  title,
  slots,
  boxCount,
  variantById,
}: {
  title: string;
  slots: (LineItem | undefined)[];
  boxCount: number;
  variantById: Map<string, Variant>;
}) {
  return (
    <div className="avoid-break mt-5">
      <div className="mb-2 font-semibold uppercase">{title}</div>
      <div className="grid grid-cols-5 gap-x-6 gap-y-3">
        {Array.from({ length: boxCount }).map((_, i) => {
          const it = slots[i];
          const variant = it ? variantById.get(it.variantId) : null;
          return (
            <div
              key={i}
              className="relative min-h-[70px] border border-black/70 p-2 border-l-0 border-b-0"
            >
              {!it ? (
                <div className="text-center text-xs text-neutral-500"></div>
              ) : (
                <div className="text-[10px] leading-3">
                  <span className="absolute left-0 -top-2 font-bold flex justify-center w-full">
                    <b className="bg-white py-[2px] px-[5px]">{it.width} cm</b>
                  </span>
                  <span className="absolute rotate-90 top-0 -right-2.5 w-20 bottom-0 flex justify-center">
                    <b className="bg-white py-[2px] px-[5px]">{it.height} cm</b>
                  </span>
                  <div className="relative">
                    <b>Tür :</b> {variant?.name || "—"}
                    <br />
                    <b>Adet :</b> {it.qty}
                    <br />
                    <b>Pile Sıklığı :</b> {it.fileDensity}x
                    <br />
                    <b>Birim :</b> {fmt(Number(it.unitPrice))}
                    <br />
                    <b>Tutar :</b> {fmt(Number(it.subtotal))}
                  </div>
                  {it.note && (
                    <div className="mt-1 text-[10px] text-gray-700">
                      Not: {it.note}
                    </div>
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

function SectionListPrint({
  title,
  items,
  variantById,
}: {
  title: string;
  items: LineItem[];
  variantById: Map<string, Variant>;
}) {
  const order = [0, 3, 1, 4, 2, 5]; // görsel sırayı koru
  return (
    <div className="avoid-break mt-5">
      <div className="mb-1 font-semibold uppercase">{title}</div>
      <div className="grid grid-cols-2 gap-0">
        {order.map((i) => {
          const it = items[i];
          const variant = it ? variantById.get(it.variantId) : null;
          return (
            <div key={i} className="flex items-center gap-0">
              <div className="w-6 text-right text-xs">{i + 1}-</div>
              <div className="h-[23px] flex-1 border-0 border-b border-[#999] p-0 pl-2 text-left text-sm">
                {it
                  ? `${variant?.name ?? "—"} • ${it.qty} adet • ${it.width}×${it.height
                  } cm • ${fmt(it.subtotal)} ₺`
                  : ""}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function InstagramIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <rect
        x="3"
        y="3"
        width="18"
        height="18"
        rx="5"
        ry="5"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <circle
        cx="12"
        cy="12"
        r="4.25"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <circle cx="17.25" cy="6.75" r="1.25" fill="currentColor" />
    </svg>
  );
}

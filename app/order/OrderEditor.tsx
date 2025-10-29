'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { useOrderSetupStore } from '@/app/lib/orderSetupStore'
import { toast } from 'sonner'
import { PageOverlay } from '../components/PageOverlay'
import { parseYMDToLocalDate } from '../lib/date'

/* ========= Types ========= */
type Status = 'processing' | 'pending' | 'completed' | 'cancelled'
type PaymentMethod = 'CASH' | 'TRANSFER' | 'CARD'

type Profile = {
  companyName: string
  phone?: string
  email?: string
  address?: string
  taxNumber?: string
  taxOffice?: string
  logoUrl?: string
  instagram?: string
  website?: string
}

type Branch = {
  phone: string
  address: string
  id: string
  name: string
  code?: string | null
  isActive: boolean
  showOnHeader: boolean
  sortOrder: number
}

type Variant = { id: string; name: string; unitPrice: number }
type Category = { id: string; name: string; variants: Variant[] }

/** 🔔 slotIndex YOK — sadece UI sırası / ekleme sırası
 * lineStatus: satırın görsel durumu (API'ye de gidiyor)
 */
type LineItem = {
  id: string
  categoryId: string
  variantId: string
  qty: number
  width: number
  height: number
  unitPrice: number
  note?: string | null
  fileDensity: number
  subtotal: number
  lineStatus: Status
}

type InsertSlot = { title: string; index: number } | null

/* ========= Helpers ========= */
const uid = () => Math.random().toString(36).slice(2, 10)
const fmt = (n: number) =>
  new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)

const BOX_COUNTS: Record<string, number> = { 'TÜL PERDE': 10, 'FON PERDE': 5, 'GÜNEŞLİK': 5 }
const normalize = (s: string) => s.trim().toLocaleUpperCase('tr-TR')
const hasBoxCount = (name: string) => Object.prototype.hasOwnProperty.call(BOX_COUNTS, normalize(name))

const statusLabel: Record<Status, string> = {
  processing: 'İşlemde',
  pending: 'Beklemede',
  completed: 'Tamamlandı',
  cancelled: 'İptal',
}
const statusDot: Record<Status, string> = {
  pending: 'bg-amber-500',
  processing: 'bg-blue-500',
  completed: 'bg-emerald-600',
  cancelled: 'bg-rose-600',
}

const isStorPerdeByName = (name: string) => normalize(name) === 'STOR PERDE'

/** 🔢 Tutar hesabı:
 * - STOR PERDE: m² hesabı (en/100 * boy/100) * adet * price (density YOK)
 * - Diğerleri: (en/100 * fileDensity || 1) * adet * price
 */
function calcSubtotal(catName: string, price: number, qty: number, width: number, height: number, fileDensity: number) {
  const q = Math.max(1, Math.floor(qty))
  const w = Math.max(0, Math.floor(width))
  const h = Math.max(0, Math.floor(height))
  if (isStorPerdeByName(catName)) {
    const area = (w / 100) * (h / 100)
    return price * (area || 0) * q
  } else {
    return price * (((w / 100) * (fileDensity || 1)) || 1) * q
  }
}

/* ========= API ========= */
async function fetchCategories(): Promise<Category[]> {
  const res = await fetch('/api/categories', { cache: 'no-store' })
  if (!res.ok) throw new Error('Kategoriler yüklenemedi')
  return res.json()
}

async function createVariant(categoryId: string, payload: { name: string; unitPrice: number }) {
  const res = await fetch(`/api/categories/${categoryId}/variants`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error(await res.text().catch(() => 'Ürün eklenemedi'))
  return res.json() as Promise<Variant> // { id, name, unitPrice }
}

/* ========= Component ========= */
export default function OrderEditor({
  profile,
  branches,
  headerBranches,
}: {
  profile: Profile
  branches: Branch[]
  headerBranches: Branch[]
}) {
  const router = useRouter()
  const setup = useOrderSetupStore((s) => s.setup)
  const clearSetup = useOrderSetupStore((s) => s.clear)

  // master
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(false)

  // order state
  const [items, setItems] = useState<LineItem[]>([])
  const [orderNote, setOrderNote] = useState('')
  const [status, setStatus] = useState<Status>('processing')

  // selection (setup → store’dan)
  const [dealerId, setDealerId] = useState('')
  const [dealerName, setDealerName] = useState('')

  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null)
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [orderDeliveryDate, setOrderDeliveryDate] = useState('')

  // discount + payment
  const [discountPercent, setDiscountPercent] = useState(0)
  const [discountAmount, setDiscountAmount] = useState(0)

  // 💳 ödeme
  const [paidAmount, setPaidAmount] = useState(0)
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH')

  // drawer
  const [slot, setSlot] = useState<InsertSlot>(null)
  const [catId, setCatId] = useState('')
  const [varId, setVarId] = useState('')
  const [qty, setQty] = useState(1)
  const [width, setWidth] = useState(0)
  const [height, setHeight] = useState(0)
  const [lineNote, setLineNote] = useState('')
  const [fileDensity, setFileDensity] = useState(1.0)
  const [editingLineId, setEditingLineId] = useState<string | null>(null)
  const [lineStatus, setLineStatus] = useState<Status>('processing')

  // 💲 Elle fiyat modları
  const [useCustomPrice, setUseCustomPrice] = useState(false)
  const [unitPriceInput, setUnitPriceInput] = useState<number>(0)

  const [pageBusy, setPageBusy] = useState(false)

  // Yeni Ürün modal
  const [showVarModal, setShowVarModal] = useState(false)
  const [newVarName, setNewVarName] = useState('')
  const [newVarPrice, setNewVarPrice] = useState<string>('') // virgül desteği
  const [savingVariant, setSavingVariant] = useState(false)

  /* ==== setup’dan prefill ==== */
  useEffect(() => {
    if (!setup) {
      // router.replace('/order/new')
      return
    }
    setDealerId(setup.dealerId)
    setDealerName(
      setup.dealerName ||
        branches.find((b) => b.id === setup.dealerId)?.name ||
        'Seçili Bayi'
    )
    setSelectedCustomerId(setup.customerId ?? null)
    setCustomerName(setup.customerName || '')
    setCustomerPhone(setup.customerPhone || '')
    setOrderDeliveryDate(setup.deliveryDate || '')
    setOrderNote(setup.note || '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setup])

  /* ==== kategoriler ==== */
  useEffect(() => {
    (async () => {
      setLoading(true)
      try { setCategories(await fetchCategories()) }
      finally { setLoading(false) }
    })()
  }, [])

  /* ==== derived ==== */
  const selectedCategory = useMemo(() => categories.find(c => c.id === catId), [categories, catId])
  const variants = selectedCategory?.variants ?? []
  const selectedVariant = useMemo(() => variants.find(v => v.id === varId), [variants, varId])

  useEffect(() => {
    if (!selectedCategory) { setVarId(''); return }
    if (variants.length > 0 && !variants.find(v => v.id === varId)) setVarId(variants[0].id)
  }, [selectedCategory, variants, varId])

  // Ürün veya elle mod kapalıyken fiyat inputunu senkronla
  useEffect(() => {
    if (!useCustomPrice) {
      setUnitPriceInput(Number(selectedVariant?.unitPrice ?? 0))
    }
  }, [selectedVariant, useCustomPrice])

  const previewSubtotal = useMemo(() => {
    if (!selectedVariant) return 0
    const price = Number(useCustomPrice ? unitPriceInput : selectedVariant.unitPrice) || 0
    return calcSubtotal(selectedCategory?.name || '', price, qty, width, height, fileDensity)
  }, [selectedVariant, useCustomPrice, unitPriceInput, selectedCategory, qty, width, height, fileDensity])

  const catById = useMemo(() => new Map(categories.map(c => [c.id, c])), [categories])

  // Grup: kategori adına göre; render sırası eklenme sırası
  const groupedByCategoryName = useMemo(() => {
    const g = new Map<string, LineItem[]>()
    for (const it of items) {
      const name = catById.get(it.categoryId)?.name?.trim() || 'Kategori'
      if (!g.has(name)) g.set(name, [])
      g.get(name)!.push(it)
    }
    return g
  }, [items, catById])

  const sectionTitles = useMemo(() => {
    const arr = Array.from(groupedByCategoryName.keys())
    const priority = ['TÜL PERDE', 'FON PERDE', 'GÜNEŞLİK']
    const sorted: string[] = []
    for (const p of priority) {
      const hit = arr.find(a => normalize(a) === normalize(p))
      sorted.push(hit ?? p)
    }
    const others = arr.filter(a => !priority.some(pr => normalize(pr) === normalize(a)))
    others.sort((a, b) => a.localeCompare(b, 'tr'))
    return [...sorted, ...others]
  }, [groupedByCategoryName])

  const subTotal = useMemo(() => items.reduce((a, b) => a + (Number(b.subtotal) || 0), 0), [items])
  const computedDiscount = useMemo(() => {
    const pct = Math.max(0, Math.min(100, Number(discountPercent) || 0))
    const byPct = (subTotal * pct) / 100
    const fixed = Math.max(0, Number(discountAmount) || 0)
    return Math.min(fixed > 0 ? fixed : byPct, subTotal)
  }, [subTotal, discountPercent, discountAmount])
  const grandTotal = useMemo(() => Math.max(0, subTotal - computedDiscount), [subTotal, computedDiscount])

  const remaining = useMemo(
    () => Math.max(0, grandTotal - (Number(paidAmount) || 0)),
    [grandTotal, paidAmount]
  )

  /* ==== actions ==== */
  const openAddAt = (title: string, index: number) => {
    setSlot({ title, index })
    const match = categories.find(c => normalize(c.name) === normalize(title))
    setCatId(match?.id || '')
    if (match?.variants?.length) setVarId(match.variants[0].id)
    setQty(1); setWidth(0); setHeight(0); setLineNote(''); setFileDensity(1.0)
    setEditingLineId(null); setLineStatus('processing')

    const defaultPrice = Number(match?.variants?.[0]?.unitPrice ?? 0)
    setUseCustomPrice(false)
    setUnitPriceInput(defaultPrice)
  }
  const openQuickFor = (categoryName: string, index: number) => {
    const cat = categories.find(c => normalize(c.name) === normalize(categoryName))
    setSlot({ title: categoryName, index })
    setCatId(cat?.id || '')
    if (cat?.variants?.length) setVarId(cat.variants[0].id)
    setQty(1); setWidth(0); setHeight(0); setLineNote(''); setFileDensity(1.0)
    setEditingLineId(null); setLineStatus('processing')

    const defaultPrice = Number(cat?.variants?.[0]?.unitPrice ?? 0)
    setUseCustomPrice(false)
    setUnitPriceInput(defaultPrice)
  }
  const closeDrawer = () => { setSlot(null); setEditingLineId(null) }

  const addOrUpdateLine = () => {
    if (!selectedCategory || !selectedVariant) return
    const q = Math.max(1, Math.floor(qty))
    const w = Math.max(0, Math.floor(width))
    const h = Math.max(0, Math.floor(height))
    const price = Number(useCustomPrice ? unitPriceInput : selectedVariant.unitPrice) || 0
    const d = Number(fileDensity) || 1

    const sub = calcSubtotal(selectedCategory.name, price, q, w, h, d)

    if (editingLineId) {
      setItems(prev => prev.map(it => it.id === editingLineId
        ? {
            ...it,
            categoryId: selectedCategory.id,
            variantId: selectedVariant.id,
            qty: q, width: w, height: h,
            unitPrice: price, note: lineNote || null, fileDensity: d, subtotal: sub,
            lineStatus,
          }
        : it))
    } else {
      const newItem: LineItem = {
        id: uid(),
        categoryId: selectedCategory.id,
        variantId: selectedVariant.id,
        qty: q, width: w, height: h,
        unitPrice: price, note: lineNote || undefined, fileDensity: d, subtotal: sub,
        lineStatus,
      }
      setItems(prev => [...prev, newItem])
    }
    closeDrawer()
  }

  const removeLine = (id: string) => setItems(prev => prev.filter(i => i.id !== id))
  const editLine = (line: LineItem) => {
    setEditingLineId(line.id)
    setSlot({
      title: catById.get(line.categoryId)?.name || 'Kategori',
      index: 0, // sadece görsel
    })
    setCatId(line.categoryId); setVarId(line.variantId); setQty(line.qty); setWidth(line.width); setHeight(line.height)
    setLineNote(line.note || ''); setFileDensity(line.fileDensity || 1.0); setLineStatus(line.lineStatus || 'processing')

    const variantPrice = Number(
      catById.get(line.categoryId)?.variants?.find(v => v.id === line.variantId)?.unitPrice ?? 0
    )
    const currentUnit = Number(line.unitPrice) || variantPrice
    setUnitPriceInput(currentUnit)
    setUseCustomPrice(currentUnit !== variantPrice)
  }

  // satır durumunu inline güncelle (kutucuğun içindeki select’ten)
  const updateLineStatus = (id: string, s: Status) =>
    setItems(prev => prev.map(it => (it.id === id ? { ...it, lineStatus: s } : it)))

  // özel bölümler (kutusuz)
  const storItems = items.filter(i => isStorPerdeByName(catById.get(i.categoryId)?.name || ''))
  const aksesuarItems = items.filter(i => normalize(catById.get(i.categoryId)?.name || '') === 'AKSESUAR')

  return (
    <div className="mx-auto my-4 bg-white text-black print:my-0 print:bg-white print:text-black">
      <PageOverlay show={pageBusy} label="Kaydediliyor…" />
      {/* Toolbar */}
      <div className=" m-auto w-[210mm] print:w-auto print:min-h-[auto] flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold">Yeni Sipariş</h1>
        <div className="flex items-center gap-2">
          {profile.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={profile.logoUrl} alt="Logo" className="h-8 w-8 object-contain rounded-md ring-1 ring-gray-200" />
          ) : null}
          <span className="text-sm text-gray-600">{profile.companyName}</span>
        </div>
      </div>

      {/* A4 Alanı */}
      <div className="m-auto w-[210mm] min-h-[297mm] print:w-auto print:min-h-[auto]">
        {/* Header – şirket bilgileri + seçilen bayi/müşteri + durum */}
        <Header
          orderSeq="YENİ"
          status={status}
          onChangeStatus={setStatus}
          customerName={customerName}
          orderDeliveryDate={orderDeliveryDate}
          customerPhone={customerPhone}
          dealerName={dealerName}
          profile={profile}
          headerBranches={headerBranches}
        />

        {/* Kategoriler (kutulu) — eklenme sırasına göre doldur */}
        {sectionTitles.map((title) => {
          const key = normalize(title)
          const visible = hasBoxCount(title)
          if (!visible) return null

          const boxCount = BOX_COUNTS[key]
          const lines = (groupedByCategoryName.get(title) || []) as LineItem[]
          const catIdForTitle =
            lines[0]?.categoryId ??
            categories.find(c => normalize(c.name) === key)?.id ??
            ''

          return (
            <SectionEditable
              key={title}
              title={title}
              categoryId={catIdForTitle}
              items={lines}
              boxCount={boxCount}
              catById={catById}
              onAddAt={(i) => openAddAt(title, i)}
              onRemove={removeLine}
              onEdit={(id) => { const line = items.find(x => x.id === id); if (line) editLine(line) }}
              onStatusChange={updateLineStatus}
            />
          )
        })}

        {/* STOR / AKSESUAR (satır mantığı—kutusuz; eklenme sırasına göre) */}
        <SectionQuickPlus
          title="STOR PERDE"
          items={storItems}
          catById={catById}
          onAddAt={(i) => openQuickFor('STOR PERDE', i)}
          onEdit={(id) => { const line = items.find(x => x.id === id); if (line) editLine(line) }}
        />
        <SectionQuickPlus
          title="AKSESUAR"
          items={aksesuarItems}
          catById={catById}
          onAddAt={(i) => openQuickFor('AKSESUAR', i)}
          onEdit={(id) => { const line = items.find(x => x.id === id); if (line) editLine(line) }}
        />

        {/* Not & Toplamlar */}
        <div className="grid grid-cols-2 gap-4 mt-6">
          <div className="col-span-1">
            <div className="text-sm font-semibold">Sipariş Notu</div>
            <textarea className="input mt-1 min-h-[227px] w-full" value={orderNote} onChange={(e) => setOrderNote(e.target.value)} />
          </div>
          <Totals
            subTotal={subTotal}
            discountPercent={discountPercent}
            setDiscountPercent={setDiscountPercent}
            discountAmount={discountAmount}
            setDiscountAmount={setDiscountAmount}
            computedDiscount={computedDiscount}
            grandTotal={grandTotal}
            paidAmount={paidAmount}
            setPaidAmount={setPaidAmount}
            paymentMethod={paymentMethod}
            setPaymentMethod={setPaymentMethod}
            remaining={remaining}
          />
        </div>

        {/* Alt uyarı */}
        <div className="mt-6 text-[10px] tracking-wide">
          ÖZEL SİPARİŞLE YAPILAN TÜLLERDE <b>DEĞİŞİM YAPILMAMAKTADIR</b>. MÜŞTERİDEN
          KAYNAKLI HATALI ÖLÇÜLERDE <b>TERZİ ÜCRETİ ALINMAKTADIR</b>.
        </div>

        {/* Durum efsanesi (legend) */}
        <div className="mt-4 text-[10px] flex gap-4 print:hidden">
          <LegendDot c={statusDot.pending} label="Beklemede" />
          <LegendDot c={statusDot.processing} label="İşlemde" />
          <LegendDot c={statusDot.completed} label="Tamamlandı" />
          <LegendDot c={statusDot.cancelled} label="İptal" />
        </div>
      </div>

      {/* Drawer */}
      {slot && (
        <div className="fixed inset-0 bg-black/40 z-50 print:hidden" onClick={closeDrawer}>
          <div className="absolute right-0 top-0 h-full w-full max-w-[520px] bg-white shadow-xl p-4 overflow-y-auto" onClick={(e)=>e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <div className="text-lg font-semibold">
                {editingLineId ? 'Satırı Düzenle' : `${slot.title} - Kutucuk #${slot.index + 1}`}
              </div>
              <button className="btn-secondary" onClick={closeDrawer}>Kapat</button>
            </div>

            {/* Kategori & Ürün */}
            <div className="mb-3 grid grid-cols-1 gap-3 md:grid-cols-2">
              <div>
                <label className="text-sm">Kategori</label>
                <select className="select mt-1" value={catId} onChange={(e) => setCatId(e.target.value)} disabled={loading}>
                  <option value="">{loading ? 'Yükleniyor…' : 'Seçin'}</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm">Ürün</label>
                <div className="mt-1 flex items-center gap-2">
                  <select
                    className="select flex-1"
                    value={varId}
                    onChange={(e) => setVarId(e.target.value)}
                    disabled={!selectedCategory || loading}
                  >
                    {!selectedCategory && <option>Önce kategori seçin</option>}
                    {selectedCategory && selectedCategory.variants.length === 0 && <option>Ürün yok</option>}
                    {selectedCategory?.variants.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                  </select>
                  <button
                    type="button"
                    className="h-9 rounded-xl border border-neutral-300 px-3 text-sm hover:bg-neutral-50 disabled:opacity-50"
                    disabled={!selectedCategory}
                    onClick={() => { setNewVarName(''); setNewVarPrice(''); setShowVarModal(true) }}
                    title="Yeni Ürün ekle"
                  >
                    + Yeni
                  </button>
                </div>
              </div>
            </div>

            {/* Ölçüler */}
            <div className="mb-3 grid grid-cols-3 gap-3">
              <NumberField label="Adet" value={qty} setValue={v=>setQty(v)} min={1} step={1}/>
              <NumberField label="En (cm)" value={width} setValue={v=>setWidth(v)} min={0} step={1}/>
              <NumberField label="Boy (cm)" value={height} setValue={v=>setHeight(v)} min={0} step={1}/>
            </div>

            {/* File Sıklığı + Birim Fiyat */}
            <div className="mb-3 grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm">File Sıklığı</label>
                <select
                  className="select mt-1"
                  value={String(fileDensity)}
                  onChange={(e)=>setFileDensity(parseFloat(e.target.value))}
                  disabled={isStorPerdeByName(selectedCategory?.name || '')}
                  title={isStorPerdeByName(selectedCategory?.name || '') ? 'STOR PERDE m² hesabı: file dikkate alınmaz' : undefined}
                >
                  <option value="1">1.0x</option><option value="1.5">1.5x</option><option value="2">2.0x</option>
                  <option value="2.5">2.5x</option><option value="3">3.0x</option><option value="3.5">3.5x</option>
                  <option value="4">4.0x</option><option value="4.5">4.5x</option><option value="5">5.0x</option>
                </select>
                {isStorPerdeByName(selectedCategory?.name || '') && (
                  <div className="mt-1 text-[10px] text-emerald-700 font-medium">
                    STOR PERDE <b>m²</b> hesabı ile (En×Boy/10.000) fiyatlanır; file dikkate alınmaz.
                  </div>
                )}
              </div>
              <div>
                <label className="text-sm">Birim Fiyat</label>
                <div className="mt-1 flex items-center gap-2">
                  <input
                    className="input flex-1 text-right disabled:bg-gray-100"
                    type="text" min={0} step="0.01"
                    value={Number.isFinite(unitPriceInput) ? unitPriceInput : 0}
                    onChange={(e)=>setUnitPriceInput(parseFloat(e.target.value || '0'))}
                    disabled={!useCustomPrice}
                    placeholder={selectedVariant ? fmt(Number(selectedVariant.unitPrice)) : '—'}
                  />
                  <label className="flex items-center gap-1 text-xs whitespace-nowrap">
                    <input
                      type="checkbox"
                      checked={useCustomPrice}
                      onChange={(e)=>setUseCustomPrice(e.target.checked)}
                    />
                    Elle
                  </label>
                </div>
              </div>
            </div>

            {/* Satır Durumu */}
            <div className="mb-4">
              <label className="text-sm">Satır Durumu</label>
              <select className="select mt-1 w-full" value={lineStatus} onChange={(e)=>setLineStatus(e.target.value as Status)}>
                <option value="pending">Beklemede</option>
                <option value="processing">İşlemde</option>
                <option value="completed">Tamamlandı</option>
                <option value="cancelled">İptal</option>
              </select>
            </div>

            {/* Ara Toplam + Not */}
            <div className="mb-4 grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm">Ara Toplam</label>
                <input className="input mt-1 text-right" value={selectedVariant ? fmt(previewSubtotal) : ''} readOnly placeholder="—" />
              </div>
              <div>
                <label className="text-sm">Satır Notu</label>
                <input className="input mt-1" value={lineNote} onChange={(e)=>setLineNote(e.target.value)} placeholder="Bu satıra özel not…" />
              </div>
            </div>

            <div className="flex gap-2">
              <button className="btn" onClick={addOrUpdateLine}>{editingLineId ? 'Kaydet' : 'Kutucuğa Ekle'}</button>
              {editingLineId && (
                <button className="btn-secondary" onClick={() => { if (editingLineId) removeLine(editingLineId); closeDrawer() }}>
                  Satırı Sil
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Yeni Ürün Modal */}
      {showVarModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" role="dialog" aria-modal="true" onClick={()=>setShowVarModal(false)}>
          <div className="w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-4 shadow-xl" onClick={(e)=>e.stopPropagation()}>
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
                <input className="input mt-1 w-full" value={selectedCategory?.name || '—'} readOnly />
              </div>
              <div>
                <label className="text-sm">Ürün Adı *</label>
                <input
                  className="input mt-1 w-full"
                  value={newVarName}
                  onChange={(e)=>setNewVarName(e.target.value)}
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
                  onChange={(e)=>setNewVarPrice(e.target.value)}
                />
                <p className="mt-1 text-[11px] text-neutral-500">Ondalık için virgül veya nokta kullanabilirsiniz.</p>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                className="h-9 rounded-xl border border-neutral-300 px-3 text-sm hover:bg-neutral-50"
                onClick={()=>setShowVarModal(false)}
              >
                Vazgeç
              </button>
              <button
                type="button"
                className="h-9 rounded-xl bg-neutral-900 px-3 text-sm font-semibold text-white hover:bg-neutral-800 disabled:opacity-50"
                disabled={!selectedCategory || !newVarName.trim() || !newVarPrice.trim() || savingVariant}
                onClick={async ()=>{
                  if (!selectedCategory) return
                  const price = parseFloat(newVarPrice.replace(',', '.'))
                  if (!Number.isFinite(price) || price < 0) { toast.error('Geçerli bir fiyat girin.'); return }

                  try {
                    setSavingVariant(true)
                    const created = await createVariant(selectedCategory.id, { name: newVarName.trim(), unitPrice: price })

                    // Kategoriler state’inde ilgili kategoriye ekle
                    setCategories(prev => prev.map(c => {
                      if (c.id !== selectedCategory.id) return c
                      return { ...c, variants: [...c.variants, created] }
                    }))

                    // Yeni varyantı seç ve fiyatı senkronla
                    setVarId(created.id)
                    setUseCustomPrice(false)
                    setUnitPriceInput(Number(created.unitPrice ?? 0))

                    toast.success('Ürün eklendi')
                    setShowVarModal(false)
                  } catch (err: any) {
                    toast.error(err?.message || 'Ürün eklenemedi')
                  } finally {
                    setSavingVariant(false)
                  }
                }}
              >
                {savingVariant ? 'Kaydediliyor…' : 'Ekle'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="print:hidden mt-4 mb-4 px-4 py-4 flex items-center justify-end gap-3">
        <button
          className="btn-secondary disabled:opacity-50 text-white bg-green-600 hover:bg-green-700"
          disabled={false}
          onClick={async () => {
            // ✅ Önce validasyon
            if (!customerName.trim() || !customerPhone.trim()) { toast.error("Müşteri adı ve telefon zorunlu."); return }
            if (items.length === 0) { toast.error("En az bir satır ekleyin."); return }

            setPageBusy(true)
            // payload — lineStatus artık gönderiliyor
            const payload: any = {
              dealerId, // (veya branchId kullanıyorsanız ona geçin)
              customerId: selectedCustomerId ?? undefined,
              customerName, customerPhone, note: (orderNote || ''), status,
              discount: computedDiscount,
              deliveryDate: orderDeliveryDate,
              items: items.map(i => ({
                categoryId: i.categoryId,
                variantId: i.variantId,
                qty: i.qty,
                width: i.width,
                height: i.height,
                unitPrice: i.unitPrice,
                note: i.note ?? null,
                fileDensity: i.fileDensity,
                lineStatus: i.lineStatus, // ✅ <-- GÖNDER
              })),
            }

            try {
              const res = await fetch('/api/orders', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(payload)
              })
              if (!res.ok) {
                console.error('POST /api/orders failed:', await res.text().catch(()=>'')); 
                toast.error('Sipariş kaydedilemedi')
                return
              }
              const created = await res.json()

              if ((Number(paidAmount) || 0) > 0) {
                const payRes = await fetch(`/api/orders/${created.id}/payments`, {
                  method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
                  body: JSON.stringify({ amount: Number(paidAmount), method: paymentMethod }),
                })
                if (!payRes.ok) {
                  console.error('POST /api/orders/:id/payments failed:', await payRes.text().catch(()=>'')) 
                  toast.error('Sipariş oluşturuldu, ancak ödeme kaydı eklenemedi. Ödemeyi sipariş detayından ekleyebilirsiniz.')
                }
              }
              toast.success('Sipariş kaydedildi')
              router.push('/orders')
              clearSetup(); 
            } catch { 
              toast.error('Sunucu hatası') 
            } finally {
              setPageBusy(false)
            }
          }}
        >
          Siparişi Kaydet
        </button>
      </div>

      {/* Print styles */}
      <style jsx global>{`
        @media print {
          @page { size: A4 portrait; margin: 0; }
          html, body { background: white !important; }
          .btn, .btn-secondary, .print\\:hidden { display: none !important; }
          input, select, textarea { border: none !important; outline: none !important; }
        }
        input, select, textarea { outline: none !important; box-shadow: none !important; }
        input:focus, select:focus, textarea:focus { outline: none !important; box-shadow: none !important; }
      `}</style>
    </div>
  )
}

/* ========= Sub Components ========= */

function Header({
  orderSeq, status, onChangeStatus, customerName, orderDeliveryDate, customerPhone, dealerName, profile, headerBranches,
}: {
  orderSeq: number | string
  status: Status
  onChangeStatus: (s: Status) => void
  customerName: string
  orderDeliveryDate: string
  customerPhone: string
  dealerName: string
  profile: Profile
  headerBranches: Branch[]
}) {
  const seqStr = typeof orderSeq === 'number' ? orderSeq.toString().padStart(6,'0') : orderSeq.toString()

  return (
    <div className="flex items-start justify-between">
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-4xl font-bold tracking-wide">{profile.companyName}</h1>
        </div>

        <div className="mt-2 text-xs leading-5">
          {headerBranches.map(b => (
            <div key={b.id} className="mt-1">
              <b>{b.code == 'MAIN' ? 'MERKEZ' : b.code} Şubesi:</b>
              <br />
              {b.address}
              <br />
              GSM: {b.phone}
            </div>
          ))}
          <span className='flex items-center mt-3'>
            <svg className="size-5 text-neutral-700" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <rect x="3" y="3" width="18" height="18" rx="5" ry="5" stroke="currentColor" stroke-width="1.5"/>
              <circle cx="12" cy="12" r="4.25" stroke="currentColor" stroke-width="1.5"/>
              <circle cx="17.25" cy="6.75" r="1.25" fill="currentColor"/>
            </svg>
            {profile.instagram && <div className="flex items-center gap-1 font-bold">@{profile.instagram.replace(/^@/,'')}</div>}
          </span>
          
        </div>
      </div>
      <div className="w-[320px] text-left">
        <div className="mb-3">
          {profile.logoUrl && (
            <Image src={profile.logoUrl} alt="Brillant" width={300} height={80} priority style={{ width: '100%', height: 'auto' }} />
          )}
        </div>
        <div className="text-xs mt-1 flex justify-between">
          <b>Müşteri Adı:</b>{' '}
          <span className="inline-block min-w-[140px] text-right">
            {(customerName || '—')}
          </span>
        </div>
        <div className="text-xs mt-1 flex justify-between">
          <b>Telefon:</b>{' '}
          <span className="inline-block min-w-[140px] text-right">
            {(customerPhone || '—')}
          </span>
        </div>
        <div className="text-xs mt-1 flex items-center justify-between gap-2">
          <b>Durum:</b>
          <select className="select ml-auto" value={status} onChange={(e) => onChangeStatus(e.target.value as Status)}>
            <option value="pending">Beklemede</option>
            <option value="processing">İşlemde</option>
            <option value="completed">Tamamlandı</option>
            <option value="cancelled">İptal</option>
          </select>
        </div>
        <div className="mt-3 font-semibold">
          Teslim Tarihi:{' '}
          <span className="inline-block min-w-[80px] text-red-700">
            {orderDeliveryDate ? parseYMDToLocalDate(orderDeliveryDate).toLocaleDateString('tr-TR') : '—'}
          </span>
        </div>
      </div>
    </div>
  )
}

function LegendDot({ c, label }: { c: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className={`inline-block h-2.5 w-2.5 rounded-full ${c}`} />
      {label}
    </span>
  )
}

/** Kutulu bölüm: eklenme sırası + inline durum */
function SectionEditable({
  title, categoryId, items, boxCount, catById,
  onAddAt, onRemove, onEdit, onStatusChange,
}: {
  title: string
  categoryId: string
  items: LineItem[]
  boxCount: number
  catById: Map<string, Category>
  onAddAt: (index: number) => void
  onRemove: (id: string) => void
  onEdit: (id: string) => void
  onStatusChange: (id: string, s: Status) => void
}) {
  // eklenme sırasına göre ilk boxCount kadarını al
  const ordered = items.slice(0, boxCount)

  return (
    <div className="mt-5 break-inside-avoid">
      <div className="mb-2 font-semibold uppercase">{title}</div>
      <div className="grid grid-cols-5 gap-x-6 gap-y-3">
        {Array.from({ length: boxCount }).map((_, i) => {
          const it = ordered[i] || null
          const variantName = it
            ? (catById.get(it.categoryId)?.variants?.find(v => v.id === it.variantId)?.name ?? '—')
            : null

          return (
            <div
              key={i}
              className="relative min-h-[86px] border border-black/70 border-l-0 border-b-0 p-2 group"
            >
              {!it ? (
                <button
                  className="absolute inset-0 flex h-full w-full items-center justify-center text-sm text-gray-600 hover:bg-black/5 hover:text-black print:hidden"
                  onClick={() => onAddAt(i)}
                  title="Bu kutuya ekle"
                >
                  + Ekle
                </button>
              ) : (
                <div className="text-[9px] leading-3">
                  {/* Üst sağ: durum rozeti + hızlı select */}
                  <div className="absolute right-1 top-1 flex items-center gap-1 print:hidden">
                    <span className={`inline-block h-2.5 w-2.5 rounded-full ${statusDot[it.lineStatus]}`} />
                    <select
                      className="border text-[10px] rounded px-1 py-0.5 bg-white"
                      value={it.lineStatus}
                      onChange={(e)=>onStatusChange(it.id, e.target.value as Status)}
                    >
                      <option value="pending">Beklemede</option>
                      <option value="processing">İşlemde</option>
                      <option value="completed">Tamamlandı</option>
                      <option value="cancelled">İptal</option>
                    </select>
                  </div>

                  <div className="font-medium pr-24"><b>Tür :</b> {variantName}</div>
                  <div>
                    <b>Adet :</b> {it.qty} – <b>Ölçü :</b> {it.width}×{it.height} cm<br/>
                    <b>File :</b> {it.fileDensity}x · <b>Birim :</b> {fmt(Number(it.unitPrice))}<br/>
                    <b>Tutar :</b> {fmt(Number(it.subtotal))}
                  </div>
                  {it.note && <div className="mt-1 text-[10px] text-gray-700">Not: {it.note}</div>}

                  <div className="absolute right-1 bottom-1 flex opacity-0 transition group-hover:opacity-100 print:hidden">
                    <button className="px-1 py-0.5 text-[10px] border bg-white" onClick={() => onEdit(it.id)}>Düzenle</button>
                    <button className="ml-1 px-1 py-0.5 text-[10px] border bg-white" onClick={() => onRemove(it.id)}>Sil</button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

/** Hızlı liste alanları (STOR/AKSESUAR) — eklenme sırası */
function SectionQuickPlus({ title, items, catById, onAddAt, onEdit }: {
  title: string; items: LineItem[]; catById: Map<string, Category>;
  onAddAt: (index: number) => void; onEdit: (id: string) => void;
}) {
  const order = [0,3,1,4,2,5] // görsel sıra (sadece satır numaralandırma için)
  const visibleRows = Array.from({ length: order.length }).map((_, idx) => items[idx] || null)
  const isStor = isStorPerdeByName(title)

  return (
    <div className="mt-6 break-inside-avoid">
      <div className="mb-0 font-semibold uppercase flex items-center gap-2">
        {title}
        {isStor && <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 border border-emerald-200">m² hesap</span>}
      </div>
      <div className="grid grid-cols-2 gap-0">
        {order.map((rowNumber, visIndex) => {
          const it = visibleRows[visIndex]
          const variantName = it
            ? (catById.get(it.categoryId)?.variants?.find(v => v.id === it.variantId)?.name ?? '—')
            : null

          let label = <span className="print:hidden">+ Ekle</span>
          if (it) {
            const area = isStor ? ((it.width / 100) * (it.height / 100)) : 0
            label = (
              <>
                {variantName ?? '—'} • {it.qty} adet • {it.width}×{it.height} cm
                {isStor && <> • Alan: {fmt(area)} m²</>}
                {' '}• {fmt(it.subtotal)}
              </>
            )
          }

          return (
            <div key={rowNumber} className="flex items-center gap-0">
              <div className="w-6 text-right text-xs">{visIndex + 1}-</div>
              <button
                type="button"
                onClick={() => (it ? onEdit(it.id) : onAddAt(rowNumber))}
                className="input h-[23px] flex-1 rounded-none border-0 border-b border-[#999] p-0 pl-2 text-left text-sm hover:bg-black/5"
                title={it ? 'Düzenle' : 'Ekle'}
              >
                {label}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function NumberField({ label, value, setValue, min=0, step=1 }: {
  label: string; value: number; setValue: (v:number)=>void; min?: number; step?: number;
}) {
  return (
    <div>
      <label className="text-sm">{label}</label>
      <input className="input mt-1 text-right" type="text" min={min} step={step} value={Number.isFinite(value) ? value : 0} onChange={(e)=>setValue(parseFloat(e.target.value || '0'))}/>
    </div>
  )
}

function Totals({
  subTotal,
  discountPercent, setDiscountPercent,
  discountAmount, setDiscountAmount,
  computedDiscount,
  grandTotal,
  paidAmount, setPaidAmount,
  paymentMethod, setPaymentMethod,
  remaining,
}: {
  subTotal: number
  discountPercent: number; setDiscountPercent: (v:number)=>void
  discountAmount: number; setDiscountAmount: (v:number)=>void
  computedDiscount: number
  grandTotal: number
  paidAmount: number; setPaidAmount: (v:number)=>void
  paymentMethod: PaymentMethod; setPaymentMethod: (m: PaymentMethod)=>void
  remaining: number
}) {
  return (
    <div className="text-sm space-y-2">
      <div className="flex items-center justify-between">
        <div>Ara Toplam</div><div className="font-medium">{fmt(subTotal)}</div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs">İskonto %</label>
          <input className="input mt-1 text-right" type="text" min={0} max={100} step="0.01"
            value={discountPercent} onChange={(e)=>setDiscountPercent(parseFloat(e.target.value || '0'))}/>
        </div>
        <div>
          <label className="text-xs">İskonto (₺)</label>
          <input className="input mt-1 text-right" type="text" min={0} step="0.01"
            value={discountAmount} onChange={(e)=>setDiscountAmount(parseFloat(e.target.value || '0'))}/>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div>Uygulanan İskonto</div><div className="font-medium">- {fmt(computedDiscount)}</div>
      </div>

      <div className="flex items-center justify-between">
        <div>Genel Toplam</div><div className="font-semibold">{fmt(grandTotal)}</div>
      </div>

      {/* 💳 ÖDEME ALANI */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs">Alınan Ödeme (₺)</label>
          <input
            className="input mt-1 text-right"
            type="text" min={0} step="0.01"
            value={Number.isFinite(paidAmount) ? paidAmount : 0}
            onChange={(e)=>setPaidAmount(parseFloat(e.target.value || '0'))}
          />
        </div>
        <div>
          <label className="text-xs">Ödeme Şekli</label>
          <select
            className="select mt-1 w-full"
            value={paymentMethod}
            onChange={(e)=>setPaymentMethod(e.target.value as PaymentMethod)}
          >
            <option value="CASH">Nakit</option>
            <option value="TRANSFER">Havale / EFT</option>
            <option value="CARD">Kredi Kartı</option>
          </select>
        </div>
      </div>

      <div className="flex items-center justify-between border-t pt-2">
        <div className="font-semibold">Kalan Borç</div>
        <div className="text-base font-bold">{fmt(remaining)}</div>
      </div>
    </div>
  )
}

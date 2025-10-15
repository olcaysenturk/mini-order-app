'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { useOrderSetupStore } from '@/app/lib/orderSetupStore'

/* ========= Types ========= */
type Status = 'pending' | 'processing' | 'completed' | 'cancelled'

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
  id: string
  name: string
  code?: string | null
  isActive: boolean
  showOnHeader: boolean
  sortOrder: number
}

type Variant = { id: string; name: string; unitPrice: number }
type Category = { id: string; name: string; variants: Variant[] }
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
}
type InsertSlot = { title: string; index: number } | null

/* ========= Helpers ========= */
const uid = () => Math.random().toString(36).slice(2, 10)
const fmt = (n: number) =>
  new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)
const BOX_COUNTS: Record<string, number> = { 'TÜL PERDE': 10, 'FON PERDE': 5, 'GÜNEŞLİK': 5 }
const normalize = (s: string) => s.trim().toLocaleUpperCase('tr-TR')
const hasBoxCount = (name: string) => Object.prototype.hasOwnProperty.call(BOX_COUNTS, normalize(name))

/* ========= API ========= */
async function fetchCategories(): Promise<Category[]> {
  const res = await fetch('/api/categories', { cache: 'no-store' })
  if (!res.ok) throw new Error('Kategoriler yüklenemedi')
  return res.json()
}

export default function OrderEditor({
  profile,
  branches,          // gerekirse dealerName fallback için
  headerBranches,    // başlıkta gösterilecek şubeler
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
  const [status, setStatus] = useState<Status>('pending')

  // selection (setup → store’dan)
  const [dealerId, setDealerId] = useState('')
  const [dealerName, setDealerName] = useState('')

  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null)
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')

  // discount
  const [discountPercent, setDiscountPercent] = useState(0)
  const [discountAmount, setDiscountAmount] = useState(0)

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

  /* ==== setup’dan prefill ==== */
  useEffect(() => {
    if (!setup) {
      // doğrudan gelindiyse setup ekranına
      router.replace('/order/new')
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

  const previewSubtotal = useMemo(() => {
    if (!selectedVariant) return 0
    const price = Number(selectedVariant.unitPrice) || 0
    const q = Math.max(1, Math.floor(qty))
    const w = Math.max(0, Math.floor(width))
    const d = Number(fileDensity) || 1
    return price * ((w / 100) * d || 1) * q
  }, [selectedVariant, qty, width, fileDensity])

  const catById = useMemo(() => new Map(categories.map(c => [c.id, c])), [categories])
  const variantById = useMemo(() => {
    const m = new Map<string, Variant>()
    for (const c of categories) for (const v of c.variants) m.set(v.id, v)
    return m
  }, [categories])

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
      const hit = arr.find(a => a.toLowerCase() === p.toLowerCase())
      sorted.push(hit ?? p)
    }
    const others = arr.filter(a => !priority.some(p => p.toLowerCase() === a.toLowerCase()))
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

  /* ==== actions ==== */
  const openAddAt = (title: string, index: number) => {
    setSlot({ title, index })
    const match = categories.find(c => c.name.toLowerCase() === title.toLowerCase())
    setCatId(match?.id || '')
    if (match?.variants?.length) setVarId(match.variants[0].id)
    setQty(1); setWidth(0); setHeight(0); setLineNote(''); setFileDensity(1.0); setEditingLineId(null)
  }
  const openQuickFor = (categoryName: string, index: number) => {
    const cat = categories.find(c => c.name.trim().toLowerCase() === categoryName.trim().toLowerCase())
    setSlot({ title: categoryName, index })
    setCatId(cat?.id || ''); if (cat?.variants?.length) setVarId(cat.variants[0].id)
    setQty(1); setWidth(0); setHeight(0); setLineNote(''); setFileDensity(1.0); setEditingLineId(null)
  }
  const closeDrawer = () => { setSlot(null); setEditingLineId(null) }

  const addOrUpdateLine = () => {
    if (!selectedCategory || !selectedVariant) return
    const q = Math.max(1, Math.floor(qty))
    const w = Math.max(0, Math.floor(width))
    const price = Number(selectedVariant.unitPrice) || 0
    const d = Number(fileDensity) || 1
    const sub = price * ((w / 100) * d || 1) * q
    if (editingLineId) {
      setItems(prev => prev.map(it => it.id === editingLineId
        ? { ...it, categoryId: selectedCategory.id, variantId: selectedVariant.id, qty: q, width: w, height, unitPrice: price, note: lineNote || null, fileDensity: d, subtotal: sub }
        : it))
    } else {
      setItems(prev => [...prev, { id: uid(), categoryId: selectedCategory.id, variantId: selectedVariant.id, qty: q, width: w, height, unitPrice: price, note: lineNote || undefined, fileDensity: d, subtotal: sub }])
    }
    closeDrawer()
  }

  const removeLine = (id: string) => setItems(prev => prev.filter(i => i.id !== id))
  const editLine = (line: LineItem) => {
    setEditingLineId(line.id); setSlot({ title: catById.get(line.categoryId)?.name || 'Kategori', index: 0 })
    setCatId(line.categoryId); setVarId(line.variantId); setQty(line.qty); setWidth(line.width); setHeight(line.height)
    setLineNote(line.note || ''); setFileDensity(line.fileDensity || 1.0)
  }

  const [savingOrder, setSavingOrder] = useState(false)
  const saveOrder = async () => {
    if (!customerName.trim() || !customerPhone.trim()) { alert('Müşteri adı ve telefon zorunlu.'); return }
    if (items.length === 0) { alert('En az bir satır ekleyin.'); return }
    setSavingOrder(true)
    try {
      const payload: any = {
        // dealerId gerekiyorsa aç:
        dealerId: dealerId,
        customerId: selectedCustomerId ?? undefined,
        customerName, customerPhone,
        note: orderNote || '',
        status,
        discount: computedDiscount,
        items: items.map(i => ({
          categoryId: i.categoryId, variantId: i.variantId, qty: i.qty,
          width: i.width, height: i.height, unitPrice: i.unitPrice,
          note: i.note ?? null, fileDensity: i.fileDensity,
        })),
      }
      const res = await fetch('/api/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(payload) })
      if (!res.ok) { console.error('POST /api/orders failed:', await res.text().catch(()=>'')); alert('Sipariş kaydedilemedi'); return }
      alert('Sipariş kaydedildi!')
      clearSetup()
      router.push('/orders')
    } finally { setSavingOrder(false) }
  }

  // özel bölümler
  const storItems = groupedByCategoryName.get('STOR PERDE') || []
  const aksesuarItems = groupedByCategoryName.get('AKSESUAR') || []

  return (
    <div className="mx-auto my-4 bg-white text-black print:my-0 print:bg-white print:text-black">
      {/* Toolbar */}
      <div className="print:hidden mt-4 mb-4 px-4 py-4 flex items-center justify-between gap-3">
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
          customerPhone={customerPhone}
          dealerName={dealerName}
          profile={profile}
          headerBranches={headerBranches}
        />

        {/* Kategoriler */}
        {sectionTitles.map((title) => {
          const key = normalize(title)
          const visible = hasBoxCount(title)
          if (!visible) return null
          const boxCount = BOX_COUNTS[key]
          const lines = groupedByCategoryName.get(title) || []
          return (
            <SectionEditable
              key={title}
              title={title}
              items={lines}
              boxCount={boxCount}
              variantById={variantById}
              onAddAt={(i) => openAddAt(title, i)}
              onRemove={removeLine}
              onEdit={(id) => { const line = items.find(x => x.id === id); if (line) editLine(line) }}
            />
          )
        })}

        {/* STOR / AKSESUAR */}
        <SectionQuickPlus
          title="STOR PERDE"
          items={storItems}
          variantById={variantById}
          onAddAt={(i) => openQuickFor('STOR PERDE', i)}
          onEdit={(id) => { const line = items.find(x => x.id === id); if (line) editLine(line) }}
        />
        <SectionQuickPlus
          title="AKSESUAR"
          items={aksesuarItems}
          variantById={variantById}
          onAddAt={(i) => openQuickFor('AKSESUAR', i)}
          onEdit={(id) => { const line = items.find(x => x.id === id); if (line) editLine(line) }}
        />

        {/* Not & Toplamlar */}
        <div className="grid grid-cols-3 gap-4 mt-6">
          <div className="col-span-2">
            <div className="text-sm font-semibold">Sipariş Notu</div>
            <textarea className="input mt-1 min-h-[125px] w-full" value={orderNote} onChange={(e) => setOrderNote(e.target.value)} />
          </div>
          <Totals
            subTotal={subTotal}
            discountPercent={discountPercent}
            setDiscountPercent={setDiscountPercent}
            discountAmount={discountAmount}
            setDiscountAmount={setDiscountAmount}
            computedDiscount={computedDiscount}
            grandTotal={grandTotal}
          />
        </div>

        {/* Alt uyarı */}
        <div className="mt-6 text-[10px] tracking-wide">
          ÖZEL SİPARİŞLE YAPILAN TÜLLERDE <b>DEĞİŞİM YAPILMAMAKTADIR</b>. MÜŞTERİDEN
          KAYNAKLI HATALI ÖLÇÜLERDE <b>TERZİ ÜCRETİ ALINMAKTADIR</b>.
        </div>
      </div>

      {/* Drawer */}
      {slot && (
        <div className="fixed inset-0 bg-black/40 z-50 print:hidden" onClick={closeDrawer}>
          <div className="absolute right-0 top-0 h-full w-full max-w-[520px] bg-white shadow-xl p-4 overflow-y-auto" onClick={(e)=>e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <div className="text-lg font-semibold">{editingLineId ? 'Satırı Düzenle' : `${slot.title} - Kutucuk #${slot.index + 1}`}</div>
              <button className="btn-secondary" onClick={closeDrawer}>Kapat</button>
            </div>

            {/* Kategori & Varyant */}
            <div className="mb-3 grid grid-cols-1 gap-3 md:grid-cols-2">
              <div>
                <label className="text-sm">Kategori</label>
                <select className="select mt-1" value={catId} onChange={(e) => setCatId(e.target.value)} disabled={loading}>
                  <option value="">{loading ? 'Yükleniyor…' : 'Seçin'}</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm">Varyant</label>
                <select className="select mt-1" value={varId} onChange={(e) => setVarId(e.target.value)} disabled={!selectedCategory || loading}>
                  {!selectedCategory && <option>Önce kategori seçin</option>}
                  {selectedCategory && selectedCategory.variants.length === 0 && <option>Varyant yok</option>}
                  {selectedCategory?.variants.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                </select>
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
                <select className="select mt-1" value={String(fileDensity)} onChange={(e)=>setFileDensity(parseFloat(e.target.value))}>
                  <option value="1">1.0x</option><option value="1.5">1.5x</option><option value="2">2.0x</option>
                  <option value="2.5">2.5x</option><option value="3">3.0x</option>
                </select>
              </div>
              <div>
                <label className="text-sm">Birim Fiyat</label>
                <input className="input mt-1 text-right" value={selectedVariant ? fmt(Number(selectedVariant.unitPrice)) : ''} readOnly placeholder="—" />
              </div>
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

      <div className="print:hidden mt-4 mb-4 px-4 py-4 flex items-center justify-end gap-3">
        <button className="btn-secondary disabled:opacity-50 text-white bg-green-600 hover:bg-green-700" disabled={savingOrder} onClick={saveOrder}>
          {savingOrder ? 'Kaydediliyor…' : 'Siparişi Kaydet'}
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
  orderSeq, status, onChangeStatus, customerName, customerPhone, dealerName, profile, headerBranches,
}: {
  orderSeq: number | string
  status: Status
  onChangeStatus: (s: Status) => void
  customerName: string
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
              <b>{b.code} Şubesi:</b>
              <br />
              {b.address}
              <br />
                GSM: {b.phone}
              {/* Adres/telefon kolonları eklediğinde burada göster */}
              {console.log(b)}
            </div>
          ))}
          {profile.instagram && <div className="mt-1 flex items-center gap-1">@{profile.instagram.replace(/^@/,'')}</div>}
        </div>
      </div>
      <div className="w-[320px] text-left">
        <div className="mb-3">
          <Image src={profile.logoUrl} alt="Brillant" width={300} height={80} priority style={{ width: '100%', height: 'auto' }} />
        </div>
        <div className="text-xs flex justify-between">
          {/* <b>Bayi:</b> <span className="inline-block min-w-[120px] text-right">{dealerName || '—'}</span> */}
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
          SIRA No:{' '}
          <span className="inline-block min-w-[80px] text-red-700">{seqStr}</span>
        </div>
      </div>
    </div>
  )
}

function SectionEditable({ title, items, boxCount, variantById, onAddAt, onRemove, onEdit }: {
  title: string; items: LineItem[]; boxCount: number; variantById: Map<string, Variant>;
  onAddAt: (index: number) => void; onRemove: (id: string) => void; onEdit: (id: string) => void;
}) {
  return (
    <div className="mt-5 break-inside-avoid">
      <div className="mb-2 font-semibold uppercase">{title}</div>
      <div className="grid grid-cols-5 gap-x-6 gap-y-3">
        {Array.from({ length: boxCount }).map((_, i) => {
          const it = items[i]; const variant = it ? variantById.get(it.variantId) : null
          return (
            <div key={i} className="relative min-h-[80px] border border-black/70 border-l-0 border-b-0 p-2 group">
              {!it ? (
                <button className="absolute inset-0 flex h-full w-full items-center justify-center text-sm text-gray-600 hover:bg-black/5 hover:text-black print:hidden" onClick={() => onAddAt(i)}>
                  + Ekle
                </button>
              ) : (
                <div className="text-[8px] leading-3">
                  <div className="font-medium"><b>Tür :</b> {variant?.name || '—'}</div>
                  <div>
                    <b>Adet :</b> {it.qty} – <b>Ölçü :</b> {it.width}×{it.height} cm<br/>
                    <b>File Sıklığı :</b> {it.fileDensity}x<br/>
                    <b>Birim :</b> {fmt(Number(it.unitPrice))}<br/>
                    <b>Tutar :</b> {fmt(Number(it.subtotal))}
                  </div>
                  {it.note && <div className="mt-1 text-[10px] text-gray-700">Not: {it.note}</div>}
                  <div className="absolute right-1 top-1 flex opacity-0 transition group-hover:opacity-100 print:hidden">
                    <button className="px-1 py-0.5 text-[10px] border" onClick={() => onEdit(it.id)}>Düzenle</button>
                    <button className="ml-1 px-1 py-0.5 text-[10px] border" onClick={() => onRemove(it.id)}>Sil</button>
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

function SectionQuickPlus({ title, items, variantById, onAddAt, onEdit }: {
  title: string; items: LineItem[]; variantById: Map<string, Variant>;
  onAddAt: (index: number) => void; onEdit: (id: string) => void;
}) {
  const order = [0,3,1,4,2,5]
  return (
    <div className="mt-6 break-inside-avoid">
      <div className="mb-0 font-semibold uppercase">{title}</div>
      <div className="grid grid-cols-2 gap-0">
        {order.map(i => {
          const it = items[i]; const variant = it ? variantById.get(it.variantId) : null
          return (
            <div key={i} className="flex items-center gap-0">
              <div className="w-6 text-right text-xs">{i + 1}-</div>
              <button
                type="button"
                onClick={() => (it ? onEdit(it.id) : onAddAt(i))}
                className="input h-[23px] flex-1 rounded-none border-0 border-b border-[#999] p-0 pl-2 text-left text-sm hover:bg-black/5"
                title={it ? 'Düzenle' : 'Ekle'}
              >
                {it ? `${variant?.name ?? '—'} • ${it.qty} adet • ${it.width}×${it.height} cm • ${fmt(it.subtotal)}` : <span className="print:hidden">+ Ekle</span>}
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
      <input className="input mt-1 text-right" type="number" min={min} step={step} value={value} onChange={(e)=>setValue(parseInt(e.target.value || '0'))}/>
    </div>
  )
}

function Totals({
  subTotal, discountPercent, setDiscountPercent, discountAmount, setDiscountAmount, computedDiscount, grandTotal,
}: {
  subTotal: number; discountPercent: number; setDiscountPercent: (v:number)=>void;
  discountAmount: number; setDiscountAmount: (v:number)=>void; computedDiscount: number; grandTotal: number;
}) {
  return (
    <div className="text-sm space-y-2">
      <div className="flex items-center justify-between"><div>Ara Toplam</div><div className="font-medium">{fmt(subTotal)}</div></div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs">İskonto %</label>
          <input className="input mt-1 text-right" type="number" min={0} max={100} step="0.01" value={discountPercent} onChange={(e)=>setDiscountPercent(parseFloat(e.target.value || '0'))}/>
        </div>
        <div>
          <label className="text-xs">İskonto (₺)</label>
          <input className="input mt-1 text-right" type="number" min={0} step="0.01" value={discountAmount} onChange={(e)=>setDiscountAmount(parseFloat(e.target.value || '0'))}/>
        </div>
      </div>
      <div className="flex items-center justify-between"><div>Uygulanan İskonto</div><div className="font-medium">- {fmt(computedDiscount)}</div></div>
      <div className="flex items-center justify-between border-t pt-2"><div className="font-semibold">GENEL TOPLAM</div><div className="text-base font-bold">{fmt(grandTotal)}</div></div>
    </div>
  )
}

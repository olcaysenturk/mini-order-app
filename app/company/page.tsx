// app/(dashboard)/settings/company/page.tsx
'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  Camera, Image as ImageIcon, Link as LinkIcon,
  Pencil, Check, X, Plus, TriangleAlert
} from 'lucide-react'
import { toast  } from 'sonner'

type Profile = {
  companyName: string
  phone?: string | null
  email?: string | null
  address?: string | null
  taxNumber?: string | null
  taxOffice?: string | null
  logoUrl?: string | null
  instagram?: string | null
  website?: string | null
}

type Branch = {
  id: string
  name: string
  code?: string | null
  phone?: string | null
  email?: string | null
  address?: string | null
  isActive: boolean
  showOnHeader: boolean
  sortOrder: number
}

type ApiError = {
  error: string
  message?: string
  fieldErrors?: Record<string, string>
  issues?: { path: string; message: string; code: string }[]
}

export default function CompanyAdminPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  // ---- view/edit kontrolü
  const [editMode, setEditMode] = useState(false)

  // ---- profil state
  const [profile, setProfile] = useState<Profile>({
    companyName: '', phone: '', email: '', address: '',
    taxNumber: '', taxOffice: '', logoUrl: '', instagram: '', website: '',
  })

  // ---- hata state (API 422 için)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [errorList, setErrorList] = useState<{ path: string; message: string }[]>([])

  // ---- şubeler
  const [branches, setBranches] = useState<Branch[]>([])
  const [openAdd, setOpenAdd] = useState(false)

  // add form
  const [bName, setBName] = useState(''); const [bCode, setBCode] = useState('')
  const [bPhone, setBPhone] = useState(''); const [bEmail, setBEmail] = useState('')
  const [bAddress, setBAddress] = useState(''); const [bShow, setBShow] = useState(false)
  const [bOrder, setBOrder] = useState<number>(0)

  // inline edit
  const [editingId, setEditingId] = useState<string | null>(null)
  const [eName, setEName] = useState(''); const [eCode, setECode] = useState('')
  const [ePhone, setEPhone] = useState(''); const [eEmail, setEEmail] = useState('')
  const [eAddress, setEAddress] = useState(''); const [eShow, setEShow] = useState(false)
  const [eOrder, setEOrder] = useState<number>(0); const [eActive, setEActive] = useState<boolean>(true)
  const [savingBranch, setSavingBranch] = useState(false)

  const logoPreview = useMemo(() => (profile.logoUrl ? profile.logoUrl : ''), [profile.logoUrl])
  const primaryBranch = useMemo(
    () => branches.find(b => b.showOnHeader && b.sortOrder === 0) || null, [branches]
  )

  useEffect(() => {
    (async () => {
      setLoading(true); setErr(null)
      try {
        const [profRes, brRes] = await Promise.all([
          fetch('/api/company-profile', { cache: 'no-store', credentials: 'include' }),
          fetch('/api/branches?all=1', { cache: 'no-store', credentials: 'include' }),
        ])
        if (!profRes.ok) throw new Error('profile_fetch_failed')
        const pj = await profRes.json()
        if (pj?.ok) {
          setProfile({
            companyName: pj.profile?.companyName ?? '',
            phone: pj.profile?.phone ?? '',
            email: pj.profile?.email ?? '',
            address: pj.profile?.address ?? '',
            taxNumber: pj.profile?.taxNumber ?? '',
            taxOffice: pj.profile?.taxOffice ?? '',
            logoUrl: pj.profile?.logoUrl ?? '',
            instagram: pj.profile?.instagram ?? '',
            website: pj.profile?.website ?? '',
          })
          // kayıt yoksa edit modda aç; varsa view modda kilitli
          setEditMode(!pj.profile?.companyName)
        }
        if (!brRes.ok) throw new Error('branches_fetch_failed')
        const bj = await brRes.json()
        if (bj?.ok) setBranches(bj.items as Branch[])
      } catch { setErr('Veriler alınamadı') }
      finally { setLoading(false) }
    })()
  }, [])

  // ilk şube için varsayılan kısa ad
  useEffect(() => {
    if (openAdd && branches.length === 0 && !bCode) setBCode('Merkez')
  }, [openAdd, branches.length, bCode])

  // ---- kaydet
  async function saveProfile(e: React.FormEvent) {
    e.preventDefault()
    if (!editMode) return // edit değilken submit etme
    setSaving(true); setErr(null); setErrors({}); setErrorList([])
    try {
      const res = await fetch('/api/company-profile', {
        method: 'PATCH', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profile),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) {
        if (res.status === 422) {
          const apiErr = j as ApiError
          const fromIssues =
            (apiErr.issues || []).reduce<Record<string,string>>((acc, it) => {
              if (!acc[it.path]) acc[it.path] = it.message
              return acc
            }, {})
          const merged = { ...fromIssues, ...(apiErr.fieldErrors ?? {}) }
          setErrors(merged)
          setErrorList((apiErr.issues || []).map(it => ({ path: it.path, message: it.message })))
          toast.error(apiErr.message || 'Bazı alanlar hatalı, lütfen kontrol edin.')
          return
        }
        throw new Error(j?.error || 'save_failed')
      }
      toast.success('Şirket profili kaydedildi')
      setEditMode(false)             // kaydedince tekrar view mod
    } catch (e:any) {
      setErr(e?.message || 'Profil kaydedilemedi')
      toast.error('Profil kaydedilemedi')
    } finally { setSaving(false) }
  }

  // ---- şube işlemleri
  async function addBranch(e: React.FormEvent) {
    e.preventDefault()
    if (!bName.trim()) { toast.warning('Şube adı zorunlu'); return }
    try {
      const res = await fetch('/api/branches', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: bName.trim(), code: bCode.trim() || undefined,
          phone: bPhone.trim() || undefined, email: bEmail.trim() || undefined,
          address: bAddress.trim() || undefined, showOnHeader: bShow,
          sortOrder: Number.isFinite(bOrder) ? bOrder : 0,
        }),
      })
      const j = await res.json()
      if (!res.ok || !j?.ok) throw new Error(j?.error || 'Şube eklenemedi')
      setBranches(prev => [j.branch, ...prev])
      setBName(''); setBCode(''); setBPhone(''); setBEmail(''); setBAddress('')
      setBShow(false); setBOrder(0); setOpenAdd(false)
      toast.success('Şube eklendi')
    } catch (e:any) { toast.error(e.message || 'Şube eklenemedi') }
  }

  async function patchBranch(id: string, data: Partial<Branch>, revert: () => void) {
    try {
      const res = await fetch(`/api/branches/${id}`, {
        method: 'PATCH', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error()
    } catch { revert(); toast.error('Güncellenemedi') }
  }
  function toggleHeader(id: string, val: boolean) {
    const old = branches.slice()
    setBranches(prev => prev.map(b => b.id === id ? { ...b, showOnHeader: val } : b))
    patchBranch(id, { showOnHeader: val }, () => setBranches(old))
  }
  function updateSort(id: string, val: number) {
    const v = Number.isFinite(val) ? val : 0
    const old = branches.slice()
    setBranches(prev => prev.map(b => b.id === id ? { ...b, sortOrder: v } : b))
    patchBranch(id, { sortOrder: v }, () => setBranches(old))
  }
  function toggleActive(id: string, val: boolean) {
    const old = branches.slice()
    setBranches(prev => prev.map(b => b.id === id ? { ...b, isActive: val } : b))
    patchBranch(id, { isActive: val }, () => setBranches(old))
  }
  async function deleteBranch(id: string) {
    if (branches.length <= 1) { toast.warning('En az bir şube bulunmalı.'); return }
    if (primaryBranch?.id === id) { toast.warning('İlk şube silinemez.'); return }
    if (!confirm('Bu şubeyi silmek istediğinize emin misiniz?')) return
    const old = branches.slice()
    setBranches(prev => prev.filter(b => b.id !== id))
    try {
      const res = await fetch(`/api/branches/${id}`, { method: 'DELETE', credentials: 'include' })
      if (!res.ok) throw new Error()
      toast.warning('Şube silindi')
    } catch { setBranches(old); toast.error('Şube silinemedi') }
  }
  function openEdit(b: Branch) {
    setEditingId(b.id)
    setEName(b.name || ''); setECode(b.code || '')
    setEPhone(b.phone || ''); setEEmail(b.email || '')
    setEAddress(b.address || ''); setEShow(!!b.showOnHeader)
    setEOrder(Number.isFinite(b.sortOrder) ? b.sortOrder : 0)
    setEActive(!!b.isActive)
  }
  async function saveEdit() {
    if (!editingId) return
    if (!eName.trim()) { toast.warning('Şube adı zorunlu'); return }
    setSavingBranch(true)
    const old = branches.slice()
    const patch: Partial<Branch> = {
      name: eName.trim(), code: eCode.trim() || null,
      phone: ePhone.trim() || null, email: eEmail.trim() || null,
      address: eAddress.trim() || null, showOnHeader: eShow,
      sortOrder: Number.isFinite(eOrder) ? eOrder : 0, isActive: eActive,
    }
    setBranches(prev => prev.map(b => b.id === editingId ? { ...b, ...patch } as Branch : b))
    try {
      const res = await fetch(`/api/branches/${editingId}`, {
        method: 'PATCH', credentials: 'include',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch),
      })
      if (!res.ok) throw new Error()
      toast.success('Şube güncellendi'); setEditingId(null)
    } catch {
      setBranches(old); toast.error('Şube güncellenemedi')
    } finally { setSavingBranch(false) }
  }

  // ---- yardımcılar
  const makeReadOnly = !editMode
  const onCancelEdit = () => {
    setEditMode(false)
    setErrors({})
    setErrorList([])
    // view moda geçince alanları temizce gösteriyoruz (sunucudan gelen state zaten duruyor)
  }

  return (
    <div className="mx-auto max-w-6xl p-6">
      {/* HEADER */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Şirket Ayarları</h1>
          <p className="text-xs text-neutral-500">Profil ve şube yönetimi</p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="inline-flex items-center gap-1 rounded-lg bg-neutral-50 px-2.5 py-1 ring-1 ring-neutral-200 text-neutral-700">
            Şube: <b className="ms-1">{branches.length}</b>
          </span>
          <span className="text-neutral-400">{loading ? 'Yükleniyor…' : 'Hazır'}</span>
        </div>
      </div>

      {err && (
        <div className="mb-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{err}</div>
      )}

      {/* HATA ÖZETİ */}
      {editMode && errorList.length > 0 && (
        <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <div className="mb-1 flex items-center gap-2 font-medium">
            <TriangleAlert className="h-4 w-4" /> Bazı alanlar hatalı, lütfen kontrol edin.
          </div>
          <ul className="ms-6 list-disc">
            {errorList.map((it, i) => (
              <li key={i}><b>{prettyLabel(it.path)}:</b> {it.message}</li>
            ))}
          </ul>
        </div>
      )}

      {/* PROFİL BLOĞU (liste görünümü) */}
      <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
        {/* Üst satır */}
        <div className="flex items-start justify-between border-b border-neutral-200 p-4">
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center overflow-hidden rounded-xl bg-white ring-1 ring-neutral-200">
              {logoPreview
                ? <img src={logoPreview} alt="Logo" className="h-full w-full object-contain" />
                : <ImageIcon className="h-5 w-5 text-neutral-400" />
              }
            </div>
            <div>
              <div className="text-sm font-semibold">{profile.companyName || '—'}</div>
              <div className="text-xs text-neutral-500">{profile.website || 'Website yok'}</div>
            </div>
          </div>

          {!editMode ? (
            <button
              onClick={() => { setEditMode(true); setErrors({}); setErrorList([]) }}
              className="inline-flex items-center gap-1.5 rounded-xl border border-neutral-200 bg-white px-3 py-1.5 text-xs text-neutral-700 hover:bg-neutral-50"
            >
              <Pencil className="h-4 w-4" /> Düzenle
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={onCancelEdit}
                className="inline-flex items-center gap-1.5 rounded-xl border border-neutral-200 bg-white px-3 py-1.5 text-xs text-neutral-700 hover:bg-neutral-50"
              >
                <X className="h-4 w-4" /> Vazgeç
              </button>
              <button
                onClick={(e)=>saveProfile(e as any)}
                disabled={saving}
                className="inline-flex items-center gap-1.5 rounded-xl bg-black px-3 py-1.5 text-xs font-medium text-white hover:bg-black/90 disabled:opacity-50"
              >
                <Check className="h-4 w-4" /> {saving ? 'Kaydediliyor…' : 'Kaydet'}
              </button>
            </div>
          )}
        </div>

        {/* Form satırları */}
        <form onSubmit={saveProfile} noValidate>
          <div className="grid grid-cols-1 gap-px border-b border-neutral-200 bg-neutral-100/40 sm:grid-cols-[240px_1fr]">
            {/* Logo */}
            <CellLabel>Logo</CellLabel>
            <div className="bg-white p-3">
              <div className="flex flex-wrap items-center gap-2">
                <label
                  className={`inline-flex items-center gap-2 rounded-xl border border-neutral-200 px-3 py-1.5 text-sm ${
                    makeReadOnly ? 'opacity-60 cursor-not-allowed' : 'hover:bg-neutral-50 cursor-pointer'
                  }`}
                >
                  <Camera className="h-4 w-4" />
                  <span>Dosya Seç</span>
                  <input
                    type="file" accept="image/*" className="hidden" disabled={makeReadOnly}
                    onChange={(e) => {
                      const file = e.target.files?.[0]; if (!file) return
                      const reader = new FileReader()
                      reader.onload = () => setProfile(p => ({ ...p, logoUrl: String(reader.result || '') }))
                      reader.readAsDataURL(file)
                      toast.success('Logo seçildi (önizleme). Kaydet ile profilde saklanır.')
                    }}
                  />
                </label>

                <div className="relative flex-1 min-w-[240px]">
                  <div className="pointer-events-none absolute inset-y-0 left-0 grid w-10 place-items-center text-neutral-400">
                    <LinkIcon className="h-4 w-4" />
                  </div>
                  <input
                    disabled={makeReadOnly}
                    className={`w-full rounded-xl border px-3 py-2 pl-10 text-sm focus:ring-2 ${
                      errors.logoUrl ? 'border-rose-300 focus:ring-rose-200' : 'border-neutral-300 focus:ring-black/10'
                    } ${makeReadOnly ? 'bg-neutral-50 cursor-not-allowed' : ''}`}
                    placeholder="https://…"
                    value={profile.logoUrl ?? ''}
                    onChange={(e) => setProfile(p => ({ ...p, logoUrl: e.target.value }))}
                    aria-invalid={!!errors.logoUrl || undefined}
                    aria-describedby={errors.logoUrl ? 'logoUrl-err' : undefined}
                  />
                  {errors.logoUrl && <p id="logoUrl-err" className="mt-1 text-xs text-rose-600">{errors.logoUrl}</p>}
                </div>
              </div>
            </div>

            {/* Zorunlu + opsiyonel alanlar */}
            <CellLabel>Şirket Adı *</CellLabel>
            <CellInput
              value={profile.companyName}
              onChange={(v)=>setProfile(p=>({...p, companyName:v}))}
              placeholder="Perdexa Perde"
              error={errors.companyName}
              readOnly={makeReadOnly}
            />

            <CellLabel>Telefon *</CellLabel>
            <CellInput
              value={profile.phone ?? ''} onChange={(v)=>setProfile(p=>({...p, phone:v}))}
              placeholder="+90…" error={errors.phone}
              inputMode="tel" autoComplete="tel" readOnly={makeReadOnly}
            />

            <CellLabel>E-posta *</CellLabel>
            <CellInput
              value={profile.email ?? ''} onChange={(v)=>setProfile(p=>({...p, email:v}))}
              placeholder="mail@ornek.com" error={errors.email}
              inputMode="email" autoComplete="email" readOnly={makeReadOnly}
            />

            <CellLabel>Adres *</CellLabel>
            <CellTextarea
              value={profile.address ?? ''} onChange={(v)=>setProfile(p=>({...p, address:v}))}
              rows={2} error={errors.address} readOnly={makeReadOnly}
            />

            <CellLabel>Vergi No</CellLabel>
            <CellInput
              value={profile.taxNumber ?? ''} onChange={(v)=>setProfile(p=>({...p, taxNumber:v}))}
              error={errors.taxNumber} readOnly={makeReadOnly}
            />

            <CellLabel>Vergi Dairesi</CellLabel>
            <CellInput
              value={profile.taxOffice ?? ''} onChange={(v)=>setProfile(p=>({...p, taxOffice:v}))}
              error={errors.taxOffice} readOnly={makeReadOnly}
            />

            <CellLabel>Instagram</CellLabel>
            <CellInput
              value={profile.instagram ?? ''} onChange={(v)=>setProfile(p=>({...p, instagram:v}))}
              placeholder="@marka" error={errors.instagram} readOnly={makeReadOnly}
            />

            <CellLabel>Website</CellLabel>
            <CellInput
              value={profile.website ?? ''} onChange={(v)=>setProfile(p=>({...p, website:v}))}
              placeholder="https://…" error={errors.website} readOnly={makeReadOnly}
            />
          </div>

          {/* Sticky actions — sadece edit modda */}
          {editMode && (
            <div className="sticky bottom-3 mt-3 flex items-center justify-end gap-2 rounded-xl border border-neutral-200 bg-white px-3 py-2 shadow-sm">
              <button
                type="button"
                onClick={onCancelEdit}
                className="inline-flex items-center gap-1.5 rounded-xl border border-neutral-200 bg-white px-3 py-1.5 text-xs text-neutral-700 hover:bg-neutral-50"
              >
                <X className="h-4 w-4" /> Vazgeç
              </button>
              <button
                type="submit" disabled={saving}
                className="inline-flex items-center gap-1.5 rounded-xl bg-black px-3 py-1.5 text-xs font-medium text-white hover:bg-black/90 disabled:opacity-50"
              >
                <Check className="h-4 w-4" /> {saving ? 'Kaydediliyor…' : 'Kaydet'}
              </button>
            </div>
          )}
        </form>
      </div>

      {/* ŞUBELER */}
      <BranchesSection
        branches={branches}
        openAdd={openAdd}
        setOpenAdd={setOpenAdd}
        bName={bName} setBName={setBName}
        bCode={bCode} setBCode={setBCode}
        bPhone={bPhone} setBPhone={setBPhone}
        bEmail={bEmail} setBEmail={setBEmail}
        bAddress={bAddress} setBAddress={setBAddress}
        bShow={bShow} setBShow={setBShow}
        bOrder={bOrder} setBOrder={setBOrder}
        addBranch={addBranch}
        openEdit={openEdit}
        deleteBranch={deleteBranch}
        toggleHeader={toggleHeader}
        updateSort={updateSort}
        toggleActive={toggleActive}
        editingId={editingId}
        setEditingId={setEditingId}
        eName={eName} setEName={setEName}
        eCode={eCode} setECode={setECode}
        ePhone={ePhone} setEPhone={setEPhone}
        eEmail={eEmail} setEEmail={setEEmail}
        eAddress={eAddress} setEAddress={setEAddress}
        eShow={eShow} setEShow={setEShow}
        eOrder={eOrder} setEOrder={setEOrder}
        eActive={eActive} setEActive={setEActive}
        saveEdit={saveEdit}
        savingBranch={savingBranch}
      />

    </div>
  )
}

/* -------------------- küçük bileşenler -------------------- */

function CellLabel({ children }: { children: React.ReactNode }) {
  return <div className="bg-neutral-50 p-3 text-xs font-medium text-neutral-600">{children}</div>
}

function CellInput({
  value, onChange, placeholder, error, inputMode, autoComplete, readOnly=false,
}: {
  value: string; onChange: (v:string)=>void; placeholder?: string; error?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode']; autoComplete?: string;
  readOnly?: boolean;
}) {
  return (
    <div className="bg-white p-3">
      <input
        value={value} onChange={(e)=>onChange(e.target.value)} placeholder={placeholder}
        inputMode={inputMode} autoComplete={autoComplete}
        readOnly={readOnly}
        aria-readonly={readOnly || undefined}
        aria-invalid={!!error || undefined}
        aria-describedby={error ? 'err' : undefined}
        className={`w-full rounded-xl border px-3 py-2 text-sm focus:ring-2 ${
          error ? 'border-rose-300 focus:ring-rose-200' : 'border-neutral-300 focus:ring-black/10'
        } ${readOnly ? 'bg-neutral-50 cursor-not-allowed' : ''}`}
      />
      {error && <p className="mt-1 text-xs text-rose-600" id="err">{error}</p>}
    </div>
  )
}

function CellTextarea({
  value, onChange, rows=3, error, readOnly=false,
}: { value:string; onChange:(v:string)=>void; rows?:number; error?:string; readOnly?:boolean }) {
  return (
    <div className="bg-white p-3">
      <textarea
        rows={rows} value={value} onChange={(e)=>onChange(e.target.value)}
        readOnly={readOnly} aria-readonly={readOnly || undefined}
        aria-invalid={!!error || undefined} aria-describedby={error ? 'err' : undefined}
        className={`w-full rounded-xl border px-3 py-2 text-sm focus:ring-2 ${
          error ? 'border-rose-300 focus:ring-rose-200' : 'border-neutral-300 focus:ring-black/10'
        } ${readOnly ? 'bg-neutral-50 cursor-not-allowed' : ''}`}
      />
      {error && <p className="mt-1 text-xs text-rose-600" id="err">{error}</p>}
    </div>
  )
}

/* -------- Şube bölümü (liste görünümü) -------- */

function BranchesSection(props: any) {
  const {
    branches, openAdd, setOpenAdd, bName, setBName, bCode, setBCode, bPhone, setBPhone,
    bEmail, setBEmail, bAddress, setBAddress, bShow, setBShow, bOrder, setBOrder, addBranch,
    openEdit, deleteBranch, toggleHeader, updateSort, toggleActive,
    editingId, setEditingId, eName, setEName, eCode, setECode, ePhone, setEPhone,
    eEmail, setEEmail, eAddress, setEAddress, eShow, setEShow, eOrder, setEOrder,
    eActive, setEActive, saveEdit, savingBranch,
  } = props

  return (
    <div className="mt-8 overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b p-4">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold">Şubeler</h2>
          <span className="inline-flex items-center gap-1 rounded-lg bg-neutral-50 px-2 py-0.5 text-[11px] ring-1 ring-neutral-200 text-neutral-700">
            {branches.length} kayıt
          </span>
        </div>
        <button
          type="button" onClick={() => setOpenAdd((s:boolean)=>!s)}
          className="inline-flex items-center gap-1.5 rounded-xl border border-neutral-200 bg-white px-3 py-1.5 text-xs text-neutral-700 hover:bg-neutral-50"
        >
          <Plus className="h-4 w-4" /> {openAdd ? 'Formu Gizle' : 'Şube Ekle'}
        </button>
      </div>

      {openAdd && (
        <form onSubmit={addBranch} className="border-b p-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <MiniField label="Ad *" value={bName} onChange={setBName} />
            <MiniField label="Şube Adı" value={bCode} onChange={setBCode} />
            <MiniField label="Telefon" value={bPhone} onChange={setBPhone} inputMode="tel" autoComplete="tel" />
            <MiniField label="E-posta" value={bEmail} onChange={setBEmail} inputMode="email" autoComplete="email" placeholder="mail@ornek.com" />
            <MiniField label="Adres" value={bAddress} onChange={setBAddress} className="sm:col-span-2" />
            <div className="flex items-center gap-4">
              <label className="inline-flex items-center gap-2 text-sm">
                <input type="checkbox" checked={bShow} onChange={(e)=>setBShow(e.target.checked)}
                       className="h-4 w-4 rounded border-neutral-300 text-black focus:ring-black"/>
                Başlıkta Göster
              </label>
              <div className="flex items-center gap-2">
                <span className="text-sm text-neutral-600">Sıra</span>
                <input
                  type="number" value={bOrder} onChange={(e)=>setBOrder(parseInt(e.target.value || '0'))}
                  className="w-20 rounded-xl border border-neutral-300 px-3 py-2 text-right focus:ring-2 focus:ring-black/10"
                />
              </div>
            </div>
          </div>

          <div className="mt-3 flex items-center justify-end gap-2">
            <button type="button" onClick={()=>setOpenAdd(false)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-neutral-200 bg-white px-3 py-1.5 text-xs text-neutral-700 hover:bg-neutral-50">
              <X className="h-4 w-4" /> İptal
            </button>
            <button className="inline-flex items-center gap-1.5 rounded-xl bg-black px-3 py-1.5 text-xs font-medium text-white hover:bg-black/90">
              Kaydet
            </button>
          </div>
        </form>
      )}

      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="sticky top-0 bg-neutral-50">
            <tr className="text-left">
              <Th>Ad</Th><Th>Şube Adı</Th><Th>Telefon</Th><Th>Adres</Th>
              <Th>Header</Th><Th>Sıra</Th><Th>Durum</Th><Th className="text-right">Aksiyon</Th>
            </tr>
          </thead>
          <tbody>
            {branches.map((b:Branch) => (
              <tr key={b.id} className="border-t align-top hover:bg-neutral-50/60">
                <Td className="font-medium">{b.name}</Td>
                <Td>{b.code || '—'}</Td>
                <Td>{b.phone || '—'}</Td>
                <Td className="max-w-[360px] truncate" title={b.address || ''}>{b.address || '—'}</Td>
                <Td>
                  <label className="relative inline-flex cursor-pointer items-center">
                    <input type="checkbox" className="peer sr-only" checked={b.showOnHeader}
                           onChange={(e)=>props.toggleHeader(b.id, e.target.checked)} />
                    <div className="h-5 w-9 rounded-full bg-neutral-300 after:absolute after:left-0.5 after:top-0.5 after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-all peer-checked:bg-black peer-checked:after:translate-x-4" />
                  </label>
                </Td>
                <Td>
                  <input
                    type="number" value={b.sortOrder}
                    onChange={(e)=>props.updateSort(b.id, parseInt(e.target.value || '0'))}
                    className="w-20 rounded-xl border border-neutral-300 px-2 py-1 text-right focus:ring-2 focus:ring-black/10"
                  />
                </Td>
                <Td>
                  <button
                    onClick={()=>props.toggleActive(b.id, !b.isActive)}
                    className={`rounded-xl px-3 py-1 text-xs font-medium ${
                      b.isActive ? 'bg-rose-600 text-white hover:bg-rose-700' : 'bg-emerald-600 text-white hover:bg-emerald-700'
                    }`}
                  >
                    {b.isActive ? 'Pasifleştir' : 'Aktif Et'}
                  </button>
                </Td>
                <Td className="space-x-2 text-right">
                  <button
                    onClick={()=>props.openEdit(b)}
                    className="inline-flex items-center gap-1 rounded-xl border border-neutral-200 px-3 py-1.5 text-xs hover:bg-neutral-50"
                    title="Düzenle"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={()=>props.deleteBranch(b.id)}
                    className="inline-flex items-center gap-1 rounded-xl border border-neutral-200 px-3 py-1.5 text-xs hover:bg-neutral-50"
                    title="Sil"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </Td>
              </tr>
            ))}
            {branches.length === 0 && (
              <tr><Td colSpan={8} className="p-6 text-center text-neutral-500">Şube yok.</Td></tr>
            )}
          </tbody>
        </table>
      </div>

      {editingId && (
        <div className="border-t p-4">
          <div className="rounded-2xl border border-neutral-200 p-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="text-sm font-semibold">Şubeyi Düzenle</div>
              <button onClick={()=>setEditingId(null)}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-neutral-200 bg-white px-3 py-1.5 text-xs text-neutral-700 hover:bg-neutral-50">
                <X className="h-4 w-4" /> Kapat
              </button>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <MiniField label="Ad *" value={eName} onChange={setEName} />
              <MiniField label="Şube Adı" value={eCode} onChange={setECode} />
              <MiniField label="Telefon" value={ePhone} onChange={setEPhone} inputMode="tel" autoComplete="tel" />
              <MiniField label="E-posta" value={eEmail} onChange={setEEmail} inputMode="email" autoComplete="email" placeholder="mail@ornek.com" />
              <MiniField label="Adres" value={eAddress} onChange={setEAddress} className="sm:col-span-2" />
              <div className="flex items-center gap-4">
                <label className="inline-flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={eShow} onChange={(e)=>setEShow(e.target.checked)}
                         className="h-4 w-4 rounded border-neutral-300 text-black focus:ring-black"/>
                  Başlıkta Göster
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-neutral-600">Sıra</span>
                  <input
                    type="number" value={eOrder} onChange={(e)=>setEOrder(parseInt(e.target.value || '0'))}
                    className="w-24 rounded-xl border border-neutral-300 px-3 py-2 text-right focus:ring-2 focus:ring-black/10"
                  />
                </div>
                <label className="inline-flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={eActive} onChange={(ev)=>setEActive(ev.target.checked)}
                         className="h-4 w-4 rounded border-neutral-300 text-black focus:ring-black"/>
                  Aktif
                </label>
              </div>
            </div>
            <div className="mt-4 flex items-center justify-end gap-2">
              <button type="button" onClick={()=>setEditingId(null)}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-neutral-200 bg-white px-3 py-1.5 text-xs text-neutral-700 hover:bg-neutral-50">
                <X className="h-4 w-4" /> Vazgeç
              </button>
              <button type="button" disabled={savingBranch} onClick={saveEdit}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-black px-3 py-1.5 text-xs font-medium text-white hover:bg-black/90 disabled:opacity-50">
                <Check className="h-4 w-4" /> {savingBranch ? 'Kaydediliyor…' : 'Kaydet'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ----- tablo yardımcıları ----- */
function Th({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <th className={`p-3 text-xs font-semibold uppercase tracking-wide text-neutral-500 ${className}`}>{children}</th>
}
function Td({ children, className = '', colSpan, title }: { children: React.ReactNode; className?: string; colSpan?: number; title?: string }) {
  return <td colSpan={colSpan} className={`p-3 align-middle ${className}`} title={title}>{children}</td>
}
function MiniField({
  label, value, onChange, placeholder='', className='', inputMode, autoComplete,
}: {
  label:string; value:string; onChange:(v:string)=>void; placeholder?:string; className?:string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode']; autoComplete?: string
}) {
  const id = label.replace(/\s+/g,'-').toLowerCase()
  return (
    <div className={className}>
      <label htmlFor={id} className="block text-xs text-neutral-600">{label}</label>
      <input
        id={id} value={value} onChange={(e)=>onChange(e.target.value)} placeholder={placeholder}
        inputMode={inputMode} autoComplete={autoComplete}
        className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm focus:ring-2 focus:ring-black/10"
      />
    </div>
  )
}


function prettyLabel(path: string) {
  const map: Record<string, string> = {
    companyName: 'Şirket Adı', phone: 'Telefon', email: 'E-posta', address: 'Adres',
    website: 'Website', logoUrl: 'Logo URL', taxNumber: 'Vergi No',
    taxOffice: 'Vergi Dairesi', instagram: 'Instagram',
  }
  return map[path] || path
}

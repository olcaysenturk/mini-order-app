'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  Camera,
  Image as ImageIcon,
  Link as LinkIcon,
  Trash2,
  Pencil,
  Check,
  X,
  Plus,
} from 'lucide-react'

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

export default function CompanyAdminPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  // profil edit modu
  const [editMode, setEditMode] = useState(false)

  // profile
  const [profile, setProfile] = useState<Profile>({
    companyName: '',
    phone: '',
    email: '',
    address: '',
    taxNumber: '',
    taxOffice: '',
    logoUrl: '',
    instagram: '',
    website: '',
  })

  // branches
  const [branches, setBranches] = useState<Branch[]>([])
  const [openAdd, setOpenAdd] = useState(false)

  // create branch form
  const [bName, setBName] = useState('')
  const [bCode, setBCode] = useState('') // label: Şube Adı
  const [bPhone, setBPhone] = useState('')
  const [bEmail, setBEmail] = useState('')
  const [bAddress, setBAddress] = useState('')
  const [bShow, setBShow] = useState(false)
  const [bOrder, setBOrder] = useState<number>(0)

  // edit branch form (inline)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [eName, setEName] = useState('')
  const [eCode, setECode] = useState('')
  const [ePhone, setEPhone] = useState('')
  const [eEmail, setEEmail] = useState('')
  const [eAddress, setEAddress] = useState('')
  const [eShow, setEShow] = useState(false)
  const [eOrder, setEOrder] = useState<number>(0)
  const [eActive, setEActive] = useState<boolean>(true)
  const [savingBranch, setSavingBranch] = useState(false)

  // logo preview derived
  const logoPreview = useMemo(() => (profile.logoUrl ? profile.logoUrl : ''), [profile.logoUrl])

  // “ilk şube” (header + sort=0) — silmeye karşı koruyoruz
  const primaryBranch = useMemo(
    () => branches.find(b => b.showOnHeader && b.sortOrder === 0) || null,
    [branches]
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
          // profil varsa view modu, yoksa edit modunda aç
          setEditMode(!pj.profile?.companyName)
        }
        if (!brRes.ok) throw new Error('branches_fetch_failed')
        const bj = await brRes.json()
        if (bj?.ok) setBranches(bj.items as Branch[])
      } catch {
        setErr('Veriler alınamadı')
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  // İlk şube oluşturulacaksa “Şube Adı” (code) varsayılan Merkez olsun
  useEffect(() => {
    if (openAdd && branches.length === 0 && !bCode) {
      setBCode('Merkez')
    }
  }, [openAdd, branches.length, bCode])

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true); setErr(null)
    try {
      const res = await fetch('/api/company-profile', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profile),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok || !j?.ok) throw new Error(j?.error || 'save_failed')
      toast('Şirket profili kaydedildi')
      setEditMode(false)
    } catch (e: any) {
      setErr(e?.message || 'Profil kaydedilemedi')
      toast('Profil kaydedilemedi', 'error')
    } finally {
      setSaving(false)
    }
  }

  async function addBranch(e: React.FormEvent) {
    e.preventDefault()
    if (!bName.trim()) { toast('Şube adı zorunlu', 'warn'); return }
    try {
      const res = await fetch('/api/branches', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: bName.trim(),
          code: bCode.trim() || undefined, // Şube Adı (kısa)
          phone: bPhone.trim() || undefined,
          email: bEmail.trim() || undefined,
          address: bAddress.trim() || undefined,
          showOnHeader: bShow,
          sortOrder: Number.isFinite(bOrder) ? bOrder : 0,
        }),
      })
      const j = await res.json()
      if (!res.ok || !j?.ok) throw new Error(j?.error || 'Şube eklenemedi')
      setBranches(prev => [j.branch, ...prev])
      // reset
      setBName(''); setBCode(''); setBPhone(''); setBEmail(''); setBAddress('')
      setBShow(false); setBOrder(0)
      toast('Şube eklendi')
    } catch (e: any) {
      toast(e.message || 'Şube eklenemedi', 'error')
      throw e
    }
  }

  async function patchBranch(id: string, data: Partial<Branch>, revert: () => void) {
    try {
      const res = await fetch(`/api/branches/${id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error()
    } catch {
      revert()
      toast('Güncellenemedi', 'error')
    }
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
    if (branches.length <= 1) {
      toast('En az bir şube bulunmalı. Bu şubeyi silemezsiniz.', 'warn')
      return
    }
    if (primaryBranch?.id === id) {
      toast('İlk şubeyi silemezsiniz. Önce başka bir şubeyi ilk şube yapın.', 'warn')
      return
    }
    if (!confirm('Bu şubeyi silmek istediğinize emin misiniz?')) return
    const old = branches.slice()
    setBranches(prev => prev.filter(b => b.id !== id))
    try {
      const res = await fetch(`/api/branches/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      if (!res.ok) throw new Error()
      toast('Şube silindi')
    } catch {
      setBranches(old)
      toast('Şube silinemedi', 'error')
    }
  }

  function openEdit(b: Branch) {
    setEditingId(b.id)
    setEName(b.name || '')
    setECode(b.code || '')
    setEPhone(b.phone || '')
    setEEmail(b.email || '')
    setEAddress(b.address || '')
    setEShow(!!b.showOnHeader)
    setEOrder(Number.isFinite(b.sortOrder) ? b.sortOrder : 0)
    setEActive(!!b.isActive)
  }

  async function saveEdit() {
    if (!editingId) return
    if (!eName.trim()) { toast('Şube adı zorunlu', 'warn'); return }
    setSavingBranch(true)
    const old = branches.slice()
    const patch: Partial<Branch> = {
      name: eName.trim(),
      code: eCode.trim() || null,
      phone: ePhone.trim() || null,
      email: eEmail.trim() || null,
      address: eAddress.trim() || null,
      showOnHeader: eShow,
      sortOrder: Number.isFinite(eOrder) ? eOrder : 0,
      isActive: eActive,
    }
    setBranches(prev => prev.map(b => b.id === editingId ? { ...b, ...patch } as Branch : b))
    try {
      const res = await fetch(`/api/branches/${editingId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      if (!res.ok) throw new Error()
      toast('Şube güncellendi')
      setEditingId(null)
    } catch {
      setBranches(old)
      toast('Şube güncellenemedi', 'error')
    } finally {
      setSavingBranch(false)
    }
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Şirket Ayarları</h1>
          <p className="text-sm text-gray-500">Logo, şirket bilgileri ve şube yönetimi</p>
        </div>
        <span className="text-xs text-gray-400">{loading ? 'Yükleniyor…' : 'Hazır'}</span>
      </div>

      {err && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {err}
        </div>
      )}

      {/* Profile – View / Edit */}
      {!editMode ? (
        <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
          <div className="flex items-start gap-5 border-b p-5">
            <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-2xl ring-1 ring-gray-200 bg-white grid place-items-center">
              {logoPreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoPreview} alt="Logo" className="h-full w-full object-contain" />
              ) : (
                <ImageIcon className="h-6 w-6 text-gray-400" />
              )}
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">{profile.companyName || '—'}</h2>
                <button
                  onClick={() => setEditMode(true)}
                  className="inline-flex items-center gap-1 rounded-xl border px-3 py-1.5 text-sm hover:bg-gray-50"
                >
                  <Pencil className="h-4 w-4" /> Düzenle
                </button>
              </div>
              <div className="mt-2 grid gap-2 text-sm text-gray-700 md:grid-cols-2">
                <div><b>Telefon:</b> <span className="text-gray-600">{profile.phone || '—'}</span></div>
                <div><b>E-posta:</b> <span className="text-gray-600">{profile.email || '—'}</span></div>
                <div className="md:col-span-2"><b>Adres:</b> <span className="text-gray-600">{profile.address || '—'}</span></div>
                <div><b>Vergi No:</b> <span className="text-gray-600">{profile.taxNumber || '—'}</span></div>
                <div><b>Vergi Dairesi:</b> <span className="text-gray-600">{profile.taxOffice || '—'}</span></div>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                {profile.instagram && (
                  <a
                    href={`https://instagram.com/${profile.instagram.replace(/^@/, '')}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center rounded-xl border px-3 py-1.5 text-sm hover:bg-gray-50"
                  >
                    Instagram: {profile.instagram}
                  </a>
                )}
                {profile.website && (
                  <a
                    href={profile.website}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center rounded-xl border px-3 py-1.5 text-sm hover:bg-gray-50"
                  >
                    Website: {profile.website}
                  </a>
                )}
              </div>
            </div>
          </div>

          <div className="px-5 py-3 text-xs text-gray-500">
            Not: Şirket bilgileri ilk şube ile senkron tutulur (Başlıkta göster & sıra=0).
          </div>
        </div>
      ) : (
        <form onSubmit={saveProfile} className="relative overflow-hidden rounded-2xl border bg-white shadow-sm">
          <div className="bg-gradient-to-r from-gray-50 to-white p-5 border-b">
            <div className="flex items-center gap-4">
              {/* Logo */}
              <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-2xl ring-1 ring-gray-200 bg-white grid place-items-center">
                {logoPreview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={logoPreview} alt="Logo" className="h-full w-full object-contain" />
                ) : (
                  <ImageIcon className="h-6 w-6 text-gray-400" />
                )}
              </div>
              <div>
                <div className="text-sm text-gray-500">Logo</div>
                <div className="mt-1 flex items-center gap-2">
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-1.5 text-sm hover:bg-gray-50">
                    <Camera className="h-4 w-4" />
                    <span>Dosya Seç</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0]
                        if (!file) return
                        const reader = new FileReader()
                        reader.onload = () => {
                          const url = String(reader.result || '')
                          setProfile((p) => ({ ...p, logoUrl: url }))
                        }
                        reader.readAsDataURL(file)
                        toast('Logo seçildi (önizleme). Kaydet ile profilde saklanır.', 'info')
                      }}
                    />
                  </label>

                  <div className="relative flex-1">
                    <div className="pointer-events-none absolute inset-y-0 left-0 grid w-10 place-items-center text-gray-400">
                      <LinkIcon className="h-4 w-4" />
                    </div>
                    <input
                      className="w-full rounded-xl border bg-white pl-10 pr-3 py-2 text-sm focus:ring-2 focus:ring-black/10"
                      placeholder="https://…"
                      value={profile.logoUrl ?? ''}
                      onChange={(e) => setProfile((p) => ({ ...p, logoUrl: e.target.value }))}
                    />
                  </div>
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  Not: Dosya seçimi önizleme yapar. Kalıcı yükleme için S3/UploadThing bağlayabilirsiniz.
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-5 p-5 md:grid-cols-2">
            <Field label="Şirket Adı *" value={profile.companyName} onChange={(v) => setProfile((p) => ({ ...p, companyName: v }))} required />
            <Field label="Instagram (örn: @perdekonagi)" value={profile.instagram ?? ''} onChange={(v) => setProfile((p) => ({ ...p, instagram: v }))} placeholder="@marka" />
            <Field label="Telefon" value={profile.phone ?? ''} onChange={(v) => setProfile((p) => ({ ...p, phone: v }))} placeholder="+90…" />
            <Field label="E-posta" type="email" value={profile.email ?? ''} onChange={(v) => setProfile((p) => ({ ...p, email: v }))} placeholder="mail@ornek.com" />
            <Field label="Website" value={profile.website ?? ''} onChange={(v) => setProfile((p) => ({ ...p, website: v }))} placeholder="https://…" />
            <Field label="Vergi No" value={profile.taxNumber ?? ''} onChange={(v) => setProfile((p) => ({ ...p, taxNumber: v }))} />
            <Field label="Vergi Dairesi" value={profile.taxOffice ?? ''} onChange={(v) => setProfile((p) => ({ ...p, taxOffice: v }))} />
            <Textarea className="md:col-span-2" label="Adres" rows={2} value={profile.address ?? ''} onChange={(v) => setProfile((p) => ({ ...p, address: v }))} />
          </div>

          <div className="flex items-center justify-between gap-2 border-t bg-gray-50 p-4">
            <button type="button" onClick={() => setEditMode(false)} className="inline-flex items-center gap-1 rounded-xl border px-4 py-2 text-sm hover:bg-gray-50">
              <X className="h-4 w-4" /> Vazgeç
            </button>
            <button type="submit" disabled={saving} className="inline-flex items-center gap-1 rounded-xl bg-black px-4 py-2 text-sm font-medium text-white hover:bg-black/90 disabled:opacity-50">
              <Check className="h-4 w-4" />
              {saving ? 'Kaydediliyor…' : 'Profili Kaydet'}
            </button>
          </div>
        </form>
      )}

      {/* Branches Card */}
      <div className="mt-8 overflow-hidden rounded-2xl border bg-white shadow-sm">
        <div className="flex items-center justify-between border-b p-5">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold">Şubeler</h2>
            <span className="text-xs text-gray-400">{branches.length} kayıt</span>
          </div>

          <button
            type="button"
            onClick={() => setOpenAdd(s => !s)}
            className="inline-flex items-center gap-2 rounded-xl border px-3 py-1.5 text-sm hover:bg-gray-50"
          >
            <Plus className="h-4 w-4" />
            {openAdd ? 'Formu Gizle' : 'Şube Ekle'}
          </button>
        </div>

        {/* Add new – collapsible */}
        {openAdd && (
          <form
            onSubmit={async (e) => {
              try {
                await addBranch(e)
                setOpenAdd(false)
              } catch {
                // toast already shown
              }
            }}
            className="border-b p-5"
          >
            <div className="rounded-2xl border border-dashed p-4">
              <div className="grid gap-3 md:grid-cols-3">
                <Field label="Ad *" value={bName} onChange={setBName} required />
                <Field label="Şube Adı" value={bCode} onChange={setBCode} />
                <Field label="Telefon" value={bPhone} onChange={setBPhone} />
                <Field label="E-posta" type="email" value={bEmail} onChange={setBEmail} />
                <Field label="Adres" value={bAddress} onChange={setBAddress} className="md:col-span-2" />

                <div className="flex items-center gap-4">
                  <label className="inline-flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={bShow}
                      onChange={(e) => setBShow(e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300 text-black focus:ring-black"
                    />
                    Başlıkta Göster
                  </label>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-600">Sıra</span>
                    <input
                      type="number"
                      value={bOrder}
                      onChange={(e) => setBOrder(parseInt(e.target.value || '0'))}
                      className="w-24 rounded-xl border px-3 py-2 text-right"
                    />
                  </div>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-end gap-2">
                <button type="button" onClick={() => setOpenAdd(false)} className="inline-flex items-center gap-1 rounded-xl border px-4 py-2 text-sm hover:bg-gray-50">
                  <X className="h-4 w-4" /> İptal
                </button>
                <button className="inline-flex items-center rounded-xl bg-black px-4 py-2 text-sm font-medium text-white hover:bg-black/90">
                  Şube Ekle
                </button>
              </div>
            </div>
          </form>
        )}

        {/* List */}
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="sticky top-0 bg-gray-50">
              <tr className="text-left">
                <Th>Ad</Th>
                <Th>Şube Adı</Th>
                <Th>Telefon</Th>
                <Th>Adres</Th>
                <Th>Header</Th>
                <Th>Sıra</Th>
                <Th>Durum</Th>
                <Th className="text-right">Aksiyon</Th>
              </tr>
            </thead>
            <tbody>
              {branches.map((b) => (
                <tr key={b.id} className="border-t align-top hover:bg-gray-50/40">
                  <Td className="font-medium">{b.name}</Td>
                  <Td>{b.code || '—'}</Td>
                  <Td>{b.phone || '—'}</Td>
                  <Td className="max-w-[360px] truncate" title={b.address || ''}>{b.address || '—'}</Td>
                  <Td>
                    <label className="relative inline-flex cursor-pointer items-center">
                      <input
                        type="checkbox"
                        className="peer sr-only"
                        checked={b.showOnHeader}
                        onChange={(e) => toggleHeader(b.id, e.target.checked)}
                      />
                      <div className="h-5 w-9 rounded-full bg-gray-300 after:absolute after:left-0.5 after:top-0.5 after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-all peer-checked:bg-black peer-checked:after:translate-x-4"></div>
                    </label>
                  </Td>
                  <Td>
                    <input
                      type="number"
                      value={b.sortOrder}
                      onChange={(e) => updateSort(b.id, parseInt(e.target.value || '0'))}
                      className="w-20 rounded-xl border px-2 py-1 text-right"
                    />
                  </Td>
                  <Td>
                    <button
                      onClick={() => toggleActive(b.id, !b.isActive)}
                      className={`rounded-xl px-3 py-1 text-xs font-medium ${
                        b.isActive
                          ? 'bg-red-600 text-white hover:bg-red-700'
                          : 'bg-green-600 text-white hover:bg-green-700'
                      }`}
                    >
                      {b.isActive ? 'Pasifleştir' : 'Aktif Et'}
                    </button>
                  </Td>
                  <Td className="space-x-2 text-right">
                    <button
                      onClick={() => openEdit(b)}
                      className="inline-flex items-center gap-1 rounded-xl border px-3 py-1.5 text-xs hover:bg-gray-50"
                      title="Düzenle"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => deleteBranch(b.id)}
                      className="inline-flex items-center gap-1 rounded-xl border px-3 py-1.5 text-xs hover:bg-gray-50"
                      title="Sil"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </Td>
                </tr>
              ))}
              {branches.length === 0 && (
                <tr>
                  <Td colSpan={8} className="p-6 text-center text-gray-500">Şube yok.</Td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Edit inline panel */}
        {editingId && (
          <div className="border-t p-5">
            <div className="rounded-2xl border p-4">
              <div className="mb-3 flex items-center justify-between">
                <div className="text-sm font-semibold">Şubeyi Düzenle</div>
                <button
                  onClick={() => setEditingId(null)}
                  className="inline-flex items-center gap-1 rounded-xl border px-3 py-1.5 text-xs hover:bg-gray-50"
                >
                  <X className="h-4 w-4" /> Kapat
                </button>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <Field label="Ad *" value={eName} onChange={setEName} required />
                <Field label="Şube Adı" value={eCode} onChange={setECode} />
                <Field label="Telefon" value={ePhone} onChange={setEPhone} />
                <Field label="E-posta" type="email" value={eEmail} onChange={setEEmail} />
                <Field label="Adres" value={eAddress} onChange={setEAddress} className="md:col-span-2" />
                <div className="flex items-center gap-4">
                  <label className="inline-flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={eShow}
                      onChange={(e) => setEShow(e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300 text-black focus:ring-black"
                    />
                    Başlıkta Göster
                  </label>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-600">Sıra</span>
                    <input
                      type="number"
                      value={eOrder}
                      onChange={(e) => setEOrder(parseInt(e.target.value || '0'))}
                      className="w-24 rounded-xl border px-3 py-2 text-right"
                    />
                  </div>
                  <label className="inline-flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={eActive}
                      onChange={(ev) => setEActive(ev.target.checked)}
                      className="h-4 w-4 rounded border-gray-300 text-black focus:ring-black"
                    />
                    Aktif
                  </label>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingId(null)}
                  className="inline-flex items-center gap-1 rounded-xl border px-4 py-2 text-sm hover:bg-gray-50"
                >
                  <X className="h-4 w-4" /> Vazgeç
                </button>
                <button
                  type="button"
                  disabled={savingBranch}
                  onClick={saveEdit}
                  className="inline-flex items-center gap-1 rounded-xl bg-black px-4 py-2 text-sm font-medium text-white hover:bg-black/90 disabled:opacity-50"
                >
                  <Check className="h-4 w-4" />
                  {savingBranch ? 'Kaydediliyor…' : 'Değişiklikleri Kaydet'}
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="px-5 py-3 text-xs text-gray-500 border-t">
          Not: İlk şube (başlıkta göster & sıra=0) profil ile senkron tutulur.
        </div>
      </div>

      {/* toast root */}
      <div id="toast-root" className="fixed bottom-4 right-4 z-50 space-y-2" />
    </div>
  )
}

/* ======= Little UI helpers ======= */

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
  className = '',
  required = false,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  type?: string
  className?: string
  required?: boolean
}) {
  return (
    <div className={className}>
      <label className="block text-sm text-gray-700">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        className="mt-1 w-full rounded-xl border px-3 py-2 text-sm focus:ring-2 focus:ring-black/10"
      />
    </div>
  )
}

function Textarea({
  label,
  value,
  onChange,
  rows = 3,
  className = '',
}: {
  label: string
  value: string
  onChange: (v: string) => void
  rows?: number
  className?: string
}) {
  return (
    <div className={className}>
      <label className="block text-sm text-gray-700">{label}</label>
      <textarea
        rows={rows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-xl border px-3 py-2 text-sm focus:ring-2 focus:ring-black/10"
      />
    </div>
  )
}

function Th({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <th className={`p-3 text-xs font-semibold uppercase tracking-wide text-gray-500 ${className}`}>{children}</th>
}
function Td({ children, className = '', colSpan }: { children: React.ReactNode; className?: string; colSpan?: number }) {
  return <td colSpan={colSpan} className={`p-3 align-middle ${className}`}>{children}</td>
}

/* ======= ultra tiny toast ======= */
function toast(msg: string, variant: 'info' | 'warn' | 'error' = 'info') {
  if (typeof document === 'undefined') return
  const root = document.getElementById('toast-root')
  if (!root) return
  const el = document.createElement('div')
  const base = 'rounded-xl px-3 py-2 text-sm shadow-md border transition-all'
  const theme =
    variant === 'warn'
      ? 'bg-amber-50 border-amber-200 text-amber-900'
      : variant === 'error'
      ? 'bg-rose-50 border-rose-200 text-rose-900'
      : 'bg-white border-gray-200 text-gray-900'
  el.className = `${base} ${theme}`
  el.textContent = msg
  root.appendChild(el)
  // animate in
  el.style.opacity = '0'
  el.style.transform = 'translateY(6px)'
  requestAnimationFrame(() => {
    el.style.opacity = '1'
    el.style.transform = 'translateY(0)'
  })
  // auto hide
  setTimeout(() => {
    el.style.opacity = '0'
    el.style.transform = 'translateY(6px)'
    setTimeout(() => el.remove(), 200)
  }, 2200)
}

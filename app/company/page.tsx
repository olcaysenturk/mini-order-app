// app/(dashboard)/settings/company/page.tsx
'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  Camera, Image as ImageIcon, Link as LinkIcon,
  Pencil, Check, X, Plus, TriangleAlert
} from 'lucide-react'
import { toast  } from 'sonner'
import { useSession } from 'next-auth/react'

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

type TenantMember = {
  membershipId: string
  tenantRole: string
  createdAt: string
  user: {
    id: string
    name: string | null
    email: string
    role: string
    isActive: boolean
    createdAt: string
  }
}

type ApiError = {
  error: string
  message?: string
  fieldErrors?: Record<string, string>
  issues?: { path: string; message: string; code: string }[]
}

export default function CompanyAdminPage() {
  const { data: session, status: sessionStatus } = useSession()
  const userRole = (session?.user as any)?.role as string | undefined
  const tenantRole = (session as any)?.tenantRole ?? null
  const isSuperAdmin = userRole === 'SUPERADMIN'
  const isTenantAdmin = isSuperAdmin || tenantRole === 'OWNER' || tenantRole === 'ADMIN'

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

  // Kullanıcı yönetimi
  const [members, setMembers] = useState<TenantMember[]>([])
  const [membersLoading, setMembersLoading] = useState(false)
  const [membersError, setMembersError] = useState<string | null>(null)
  const [inviteName, setInviteName] = useState('')
  const [inviteEmail, setInviteEmail] = useState('')
  const [creatingMember, setCreatingMember] = useState(false)
  const [invitePassword, setInvitePassword] = useState<string | null>(null)
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null)

  const logoPreview = useMemo(() => (profile.logoUrl ? profile.logoUrl : ''), [profile.logoUrl])
  const primaryBranch = useMemo(
    () => branches.find(b => b.showOnHeader && b.sortOrder === 0) || null, [branches]
  )

  useEffect(() => {
    if (!isTenantAdmin || sessionStatus === 'loading') return
    ;(async () => {
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
      } catch {
        setErr('Veriler alınamadı')
      } finally {
        setLoading(false)
      }
    })()
  }, [isTenantAdmin, sessionStatus])

  // ilk şube için varsayılan kısa ad
  useEffect(() => {
    if (openAdd && branches.length === 0 && !bCode) setBCode('Merkez')
  }, [openAdd, branches.length, bCode])

  useEffect(() => {
    if (!isTenantAdmin || sessionStatus === 'loading') return
    loadMembers()
  }, [isTenantAdmin, sessionStatus])

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

  async function loadMembers() {
    if (!isTenantAdmin) return
    setMembersLoading(true); setMembersError(null)
    try {
      const res = await fetch('/api/admin/users', { cache: 'no-store', credentials: 'include' })
      const raw = await res.text()
      let parsed: any = null
      try { parsed = raw ? JSON.parse(raw) : null } catch { /* ignore */ }
      if (!res.ok || !parsed?.ok) {
        throw new Error(parsed?.error || raw || 'Kullanıcılar alınamadı')
      }
      const items = Array.isArray(parsed.items) ? parsed.items : []
      setMembers(items)
    } catch (e: any) {
      setMembersError(e?.message || 'Kullanıcılar alınamadı')
      setMembers([])
    } finally {
      setMembersLoading(false)
    }
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    if (!inviteEmail.trim()) {
      toast.warning('E-posta zorunlu')
      return
    }
    if (!isTenantAdmin) {
      toast.error('Yetki bulunmuyor')
      return
    }

    setCreatingMember(true)
    setMembersError(null)
    setInvitePassword(null)
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: inviteEmail.trim(),
          name: inviteName.trim() || undefined,
        }),
      })
      const raw = await res.text()
      let data: any = null
      try { data = raw ? JSON.parse(raw) : null } catch { /* ignore */ }
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || raw || 'Kullanıcı eklenemedi')
      }
      if (data.member) {
        setMembers(prev => {
          const filtered = prev.filter(m => m.user.id !== data.member.user.id)
          return [data.member, ...filtered]
        })
      } else {
        await loadMembers()
      }
      if (data.initialPassword) {
        setInvitePassword(data.initialPassword)
      }
      toast.success('Kullanıcı eklendi')
      setInviteEmail('')
      setInviteName('')
    } catch (e: any) {
      const message = e?.message || 'Kullanıcı eklenemedi'
      setMembersError(message)
      toast.error(message)
    } finally {
      setCreatingMember(false)
    }
  }

  async function handleRemoveMember(member: TenantMember) {
    if (!isTenantAdmin) {
      toast.error('Yetki bulunmuyor')
      return
    }
    if (member.tenantRole === 'OWNER' && !isSuperAdmin) {
      toast.warning('Owner rolündeki kullanıcı kaldırılamaz.')
      return
    }
    if (!confirm(`${member.user.email} kullanıcısını kaldırmak istediğinize emin misiniz?`)) {
      return
    }

    setRemovingMemberId(member.membershipId)
    try {
      const res = await fetch(`/api/admin/users/memberships/${member.membershipId}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      const raw = await res.text()
      let parsed: any = null
      try { parsed = raw ? JSON.parse(raw) : null } catch { /* ignore */ }
      if (!res.ok || !parsed?.ok) {
        throw new Error(parsed?.error || raw || 'Kullanıcı kaldırılamadı')
      }
      setMembers(prev => prev.filter(m => m.membershipId !== member.membershipId))
      toast.success('Kullanıcı kaldırıldı')
    } catch (e: any) {
      toast.error(e?.message || 'Kullanıcı kaldırılamadı')
    } finally {
      setRemovingMemberId(null)
    }
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

  if (sessionStatus === 'loading') {
    return (
      <div className="mx-auto max-w-6xl p-6">
        <div className="rounded-2xl border border-neutral-200 bg-white p-6 text-sm text-neutral-600">
          Yükleniyor…
        </div>
      </div>
    )
  }

  if (!isTenantAdmin) {
    return (
      <div className="mx-auto max-w-4xl p-6">
        <div className="rounded-2xl border border-neutral-200 bg-white p-6 text-center text-sm text-neutral-600">
          Bu sayfayı görüntüleme yetkiniz yok.
        </div>
      </div>
    )
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

      {/* KULLANICI YÖNETİMİ */}
      <section className="mt-6 overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold text-neutral-800">Kullanıcılar</h2>
            <p className="text-xs text-neutral-500">Bu tenant altında yetkili kullanıcılar</p>
          </div>
          <button
            type="button"
            onClick={loadMembers}
            disabled={membersLoading}
            className="inline-flex items-center gap-1.5 rounded-xl border border-neutral-200 bg-white px-3 py-1.5 text-xs text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
          >
            {membersLoading ? 'Yükleniyor…' : 'Yenile'}
          </button>
        </div>

        <div className="grid gap-4 p-4">
          <form onSubmit={handleInvite} className="grid gap-3 rounded-xl border border-dashed border-neutral-200 bg-neutral-50/60 p-4 text-sm">
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="grid gap-1">
                <span className="text-xs font-medium text-neutral-600">Ad Soyad (opsiyonel)</span>
                <input
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                  placeholder="Örneğin: Ayşe Yılmaz"
                  className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                />
              </label>
              <label className="grid gap-1">
                <span className="text-xs font-medium text-neutral-600">E-posta *</span>
                <input
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  required
                  type="email"
                  placeholder="kullanici@ornek.com"
                  className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                />
              </label>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-neutral-500">Yeni kullanıcılar <strong>STAFF</strong> rolüyle eklenir ve raporlar/şirket sayfasını görüntüleyemez.</p>
              <button
                type="submit"
                disabled={creatingMember}
                className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
              >
                {creatingMember ? 'Ekleniyor…' : 'Kullanıcı Ekle'}
              </button>
            </div>
          </form>

          {invitePassword && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-700">
              <strong>Geçici şifre:</strong> <code className="font-mono text-sm">{invitePassword}</code>
              <span className="ms-2">(Kullanıcı ilk girişte şifreyi değiştirmek zorunda.)</span>
            </div>
          )}

          {membersError && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{membersError}</div>
          )}

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-neutral-50 text-xs text-neutral-500">
                <tr>
                  <th className="px-3 py-2 text-left">Kullanıcı</th>
                  <th className="px-3 py-2 text-left">E-posta</th>
                  <th className="px-3 py-2 text-left">Rol</th>
                  <th className="px-3 py-2 text-left">Üyelik</th>
                  <th className="px-3 py-2 text-left">Durum</th>
                  <th className="px-3 py-2 text-left">Eklenme</th>
                  <th className="px-3 py-2 text-left">İşlem</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {membersLoading ? (
                  <tr><td colSpan={6} className="px-3 py-4 text-center text-neutral-500">Yükleniyor…</td></tr>
                ) : members.length === 0 ? (
                  <tr><td colSpan={6} className="px-3 py-4 text-center text-neutral-500">Bu tenant için henüz kullanıcı eklenmemiş.</td></tr>
                ) : (
                  members.map((member) => {
                    const user = member.user
                    const date = new Date(member.createdAt)
                    const createdText = new Intl.DateTimeFormat('tr-TR', { dateStyle: 'medium', timeStyle: 'short' }).format(date)
                    const removable = member.tenantRole !== 'OWNER' || isSuperAdmin
                    return (
                      <tr key={member.membershipId} className="bg-white">
                        <td className="px-3 py-2 font-medium text-neutral-800">{user.name || '—'}</td>
                        <td className="px-3 py-2 text-neutral-600">{user.email}</td>
                        <td className="px-3 py-2 text-neutral-600">{user.role}</td>
                        <td className="px-3 py-2 text-neutral-600">{member.tenantRole}</td>
                        <td className="px-3 py-2 text-neutral-600">{user.isActive ? 'Aktif' : 'Pasif'}</td>
                        <td className="px-3 py-2 text-neutral-500">{createdText}</td>
                        <td className="px-3 py-2">
                          <button
                            type="button"
                            onClick={() => handleRemoveMember(member)}
                            disabled={!removable || removingMemberId === member.membershipId}
                            className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-white px-2 py-1 text-xs text-rose-600 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {removingMemberId === member.membershipId ? 'Kaldırılıyor…' : 'Kaldır'}
                          </button>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

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

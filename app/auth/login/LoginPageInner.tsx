// app/auth/login/LoginPageInner.tsx
'use client'

import { FormEvent, useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'

export default function LoginPageInner() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const router = useRouter()
  const sp = useSearchParams()
  const callbackUrl = sp.get('callbackUrl') || '/'

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (loading) return
    setErr(null); 
    setTimeout(() => {
      setLoading(true)
      
    }, 300);

    try {
      await toast.promise(
        (async () => {
          const res = await signIn('credentials', { email, password, redirect: false, callbackUrl })
          if (!res || res.error) throw new Error('Email veya şifre hatalı')
          router.push(res.url || '/')
        })(),
        {
          loading: 'Giriş yapılıyor…',
          success: 'Hoş geldin! 🤝',
          error: (e) => (e instanceof Error ? e.message : 'Giriş başarısız'),
        }
      )
    } catch (e: any) {
      setErr(e?.message ?? 'HATA')
    } finally {
      setLoading(false)
    }
  }

  const canSubmit = email.trim() !== '' && password.trim() !== '' && !loading

  return (
    <div className="relative mx-auto max-w-sm p-6">
      {loading && (
        <div
          className="pointer-events-auto absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-white/70 backdrop-blur-sm"
          aria-hidden="true"
        >
          <div className="flex items-center gap-2 text-sm font-medium text-neutral-700">
            <span className="inline-flex size-4 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-700" />
            Giriş yapılıyor…
          </div>
        </div>
      )}

      <h1 className="text-xl font-semibold mb-4">Giriş Yap</h1>

      <form onSubmit={submit} className="space-y-3">
        <input className="input w-full" placeholder="Email" type="email" value={email}
               onChange={e => setEmail(e.target.value)} required autoFocus autoComplete="email" />
        <div className="space-y-2">
          <input className="input w-full" placeholder="Şifre" type="password" value={password}
                 onChange={e => setPassword(e.target.value)} required autoComplete="current-password" />
          <div className="flex items-center justify-between text-sm">
            <Link href="/auth/forgot-password" className="underline hover:no-underline">
              Şifremi unuttum?
            </Link>
          </div>
        </div>

        {err && <div className="text-sm text-red-600">{err}</div>}

        <button className="btn w-full" disabled={!canSubmit}>
          {loading ? 'Gönderiliyor…' : 'Giriş Yap'}
        </button>
      </form>

      <div className="mt-3 text-sm">
        Hesabın yok mu? <Link className="underline hover:no-underline" href="/auth/register">Kayıt ol</Link>
      </div>
    </div>
  )
}

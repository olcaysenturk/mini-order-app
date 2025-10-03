// app/login/page.tsx
import { Suspense } from 'react'
import LoginPageInner from './LoginPageInner'

export default function Page() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-sm p-6">Yükleniyor…</div>}>
      <LoginPageInner />
    </Suspense>
  )
}

// app/pricing/page.tsx
'use client'
import { useState } from 'react'

export default function PricingPage() {
  const [loading, setLoading] = useState<string | null>(null)

  const goCheckout = async (priceId: string) => {
    setLoading(priceId)
    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priceId }),
      })
      const data = await res.json()
      if (data.url) window.location.href = data.url
    } finally { setLoading(null) }
  }

  const openPortal = async () => {
    const res = await fetch('/api/billing/portal', { method: 'POST' })
    const data = await res.json()
    if (data.url) window.location.href = data.url
  }

  return (
    <div className="card">
      <h1 className="text-xl font-semibold mb-6">Planlar</h1>
      <div className="grid md:grid-cols-3 gap-4">
        <PlanCard title="Free" price="0₺" features={['Aylık 30 sipariş', 'Sınırlı özellik']}>
          <button className="btn-secondary" disabled>Şu anki</button>
        </PlanCard>

        <PlanCard title="Pro" price="299₺/ay" features={['Aylık 300 sipariş', 'Raporlar']}>
          <button className="btn" onClick={() => goCheckout(process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO!)} disabled={loading!==null}>
            {loading ? 'Yönlendiriliyor…' : 'Satın Al'}
          </button>
        </PlanCard>

        <PlanCard title="Business" price="999₺/ay" features={['Aylık 5000 sipariş', 'Öncelikli destek']}>
          <button className="btn" onClick={() => goCheckout(process.env.NEXT_PUBLIC_STRIPE_PRICE_BUSINESS!)} disabled={loading!==null}>
            {loading ? 'Yönlendiriliyor…' : 'Satın Al'}
          </button>
        </PlanCard>
      </div>

      <div className="mt-6">
        <button className="btn-secondary" onClick={openPortal}>Aboneliğimi Yönet</button>
      </div>
    </div>
  )
}

function PlanCard({
  title, price, features, children,
}: { title: string; price: string; features: string[]; children: React.ReactNode }) {
  return (
    <div className="border rounded-2xl p-4">
      <div className="text-lg font-semibold">{title}</div>
      <div className="text-2xl mt-1">{price}</div>
      <ul className="mt-3 space-y-1 text-sm">
        {features.map(f => <li key={f}>• {f}</li>)}
      </ul>
      <div className="mt-4">{children}</div>
    </div>
  )
}

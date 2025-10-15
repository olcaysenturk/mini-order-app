// app/dealers/page.tsx  (SERVER)
import DealersView from "./DealersView"

export default async function Page(props: any) {
  // Next 14/15 farklı tiplerde olabilir: sync veya Promise
  const sp =
    props?.searchParams && typeof props.searchParams.then === 'function'
      ? await props.searchParams
      : (props?.searchParams ?? {})

  const q = (sp.q ?? '').trim()
  const page = Math.max(1, Number(sp.page ?? 1))
  const pageSize = Math.min(100, Math.max(1, Number(sp.pageSize ?? 20)))
  const active = sp.active === '1' ? '1' : sp.active === '0' ? '0' : ''

  return (
    <DealersView
      initialQ={q}
      initialActive={active as '' | '1' | '0'}
      initialPage={page}
      pageSize={pageSize}
    />
  )
}

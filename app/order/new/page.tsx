// app/orders/new/page.tsx
import NewOrderView from './NewOrderView'

export const dynamic = 'force-dynamic' // liste hep güncel gelsin

export default function Page() {
  return <NewOrderView />
}

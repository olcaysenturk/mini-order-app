'use client'

import { create } from 'zustand'

export type OrderSetup = {
  dealerId: string
  dealerName?: string
  customerId?: string | null
  customerName?: string
  customerPhone?: string
  note?: string
  deliveryDate?: string | null
  orderType?: number | null
}

type Store = {
  setup: OrderSetup | null
  setSetup: (s: OrderSetup) => void
  clear: () => void
}

export const useOrderSetupStore = create<Store>((set) => ({
  setup: null,
  setSetup: (s) => set({ setup: s }),
  clear: () => set({ setup: null }),
}))

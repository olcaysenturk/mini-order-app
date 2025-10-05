// app/lib/plan.ts
export const PLAN_LIMITS = {
  FREE: { monthlyOrders: 30, reports: false },
  PRO: { monthlyOrders: 300, reports: true },
  BUSINESS: { monthlyOrders: 5000, reports: true },
} as const

export type AppPlan = keyof typeof PLAN_LIMITS

export function canUseReports(plan: AppPlan) {
  return PLAN_LIMITS[plan].reports
}

// app/lib/plan.ts
export const PLAN_LIMITS = {
  FREE: { monthlyOrders: 5, reports: false },
  PRO: { monthlyOrders: 30, reports: true },
  BUSINESS: { monthlyOrders: 365, reports: true },
} as const

export type AppPlan = keyof typeof PLAN_LIMITS

export function canUseReports(plan: AppPlan) {
  return PLAN_LIMITS[plan].reports
}

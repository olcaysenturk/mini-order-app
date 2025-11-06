import { Suspense } from "react";
import OrdersClient from "./OrdersClient";

/** Gezinmelerde (client transitions) loader göstermek için Server boundary */
function OrdersSkeleton() {
  return (
    <main className="mx-auto max-w-7xl p-3 sm:p-6">
      <div className="mb-6 h-7 w-40 rounded bg-neutral-200" />
      <div className="space-y-4">
        {/* Basit iskelet kartlar */}
        {[...Array(3)].map((_, i) => (
          <div
            key={i}
            className="animate-pulse rounded-2xl border border-neutral-200 bg-white p-4"
          >
            <div className="h-5 w-64 rounded bg-neutral-200" />
            <div className="mt-3 h-3 w-80 rounded bg-neutral-100" />
            <div className="mt-4 h-24 w-full rounded bg-neutral-100" />
          </div>
        ))}
      </div>
    </main>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<OrdersSkeleton />}>
      <OrdersClient />
    </Suspense>
  );
}

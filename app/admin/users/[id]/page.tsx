// app/admin/users/[id]/page.tsx (Next.js 15 uyumlu) — phone alanı kaldırıldı
import { prisma } from "@/app/lib/db";
import { requireSuperAdmin } from "@/app/lib/requireSuperAdmin";
import Link from "next/link";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic"; // session/role kontrolü için

export default async function UserDetailPage({
  params,
}: {
  // Next.js 15: params bir Promise
  params: Promise<{ id: string }>
}) {
  await requireSuperAdmin();
  const { id } = await params;

  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      createdAt: true,
    //   image: true,
      memberships: {
        select: {
          role: true,
          tenant: { select: { id: true, name: true } },
        },
      },
    },
  });

  if (!user) return notFound();

  return (
    <main className="mx-auto max-w-3xl p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Kullanıcı Detayı</h1>
        <Link href="/admin/users" className="text-sm text-indigo-600 hover:underline">← Listeye dön</Link>
      </div>

      <div className="mt-6 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-3">

        <div className="size-12 rounded-full bg-neutral-200" />
          <div>
            <div className="text-lg font-semibold">{user.name ?? "İsimsiz"}</div>
            <div className="text-sm text-neutral-600">{user.email}</div>
          </div>
        </div>

        <dl className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div>
            <dt className="text-neutral-500">Rol</dt>
            <dd>
              <span className="inline-flex items-center rounded-full bg-indigo-50 px-2 py-0.5 text-xs text-indigo-700">{user.role}</span>
            </dd>
          </div>
          <div>
            <dt className="text-neutral-500">Kayıt</dt>
            <dd className="tabular-nums">{new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium", timeStyle: "short" }).format(user.createdAt)}</dd>
          </div>
        </dl>
      </div>

      {/* Üyelikler */}
      <div className="mt-6 rounded-2xl border border-neutral-200 bg-white overflow-hidden shadow-sm">
        <div className="px-4 py-3 text-sm font-medium bg-neutral-50 border-b border-neutral-200">Tenant Üyelikleri</div>
        <table className="w-full text-sm">
          <thead>
            <tr className="[&>th]:px-4 [&>th]:py-2 text-left text-neutral-500">
              <th>Tenant</th>
              <th>Rol</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {user.memberships.length === 0 ? (
              <tr>
                <td colSpan={2} className="px-4 py-6 text-center text-neutral-500">Üyelik yok.</td>
              </tr>
            ) : (
              user.memberships.map((m, idx) => (
                <tr key={idx} className="[&>td]:px-4 [&>td]:py-2">
                  <td className="font-medium">{m.tenant.name}</td>
                  <td>
                    <span className="inline-flex items-center rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-700">{m.role}</span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}

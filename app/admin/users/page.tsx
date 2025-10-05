// app/admin/users/page.tsx (Next.js 15 + Prisma tip düzeltmeleri)
import Link from "next/link";
import { prisma } from "@/app/lib/db";
import { requireSuperAdmin } from "@/app/lib/requireSuperAdmin";
import { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

// küçük yardımcı
function toInt(v: string | undefined, def = 1) {
  const n = parseInt(v ?? "");
  return Number.isFinite(n) && n > 0 ? n : def;
}

export default async function AdminUsersPage({
  searchParams,
}: {
  // Next.js 15: searchParams bir Promise
  searchParams: Promise<{ q?: string; page?: string; size?: string; sort?: string }>;
}) {
  await requireSuperAdmin();

  const sp = await searchParams; // ✅ Promise'i çöz
  const q = (sp.q ?? "").trim();
  const page = toInt(sp.page, 1);
  const size = Math.min(100, toInt(sp.size, 20));
  const sort = sp.sort ?? "createdAt:desc";

  const [sortField, sortDir] = ((): ["createdAt" | "name" | "email" | "role", "asc" | "desc"] => {
    const [f, d] = sort.split(":");
    const field = ([("createdAt" as const), ("name" as const), ("email" as const), ("role" as const)] as const).includes(
      f as any
    )
      ? (f as any)
      : "createdAt";
    const dir = d === "asc" ? "asc" : "desc";
    return [field, dir];
  })();

  // 🔧 Tip güvenliği için açıkça Prisma.UserWhereInput kullan
  const where: Prisma.UserWhereInput = q
    ? {
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { email: { contains: q, mode: "insensitive" } },
        ],
      }
    : {};

  const [total, users] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      orderBy: { [sortField]: sortDir },
      skip: (page - 1) * size,
      take: size,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
        // image: true,
      },
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / size));

  return (
    <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Kullanıcılar</h1>
        <div className="text-sm text-neutral-500">Toplam: {total}</div>
      </div>

      {/* Filters */}
      <form className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3" method="get">
        <input
          name="q"
          defaultValue={q}
          placeholder="İsim veya e‑posta…"
          className="h-10 rounded-xl border border-neutral-200 bg-white px-3 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
        />
        <select name="sort" defaultValue={sort} className="h-10 rounded-xl border border-neutral-200 bg-white px-3 text-sm">
          <option value="createdAt:desc">Yeni kayıt</option>
          <option value="createdAt:asc">Eski kayıt</option>
          <option value="name:asc">İsim A→Z</option>
          <option value="name:desc">İsim Z→A</option>
          <option value="email:asc">E‑posta A→Z</option>
          <option value="email:desc">E‑posta Z→A</option>
          <option value="role:asc">Rol A→Z</option>
          <option value="role:desc">Rol Z→A</option>
        </select>
        <select name="size" defaultValue={String(size)} className="h-10 rounded-xl border border-neutral-200 bg-white px-3 text-sm">
          {[10, 20, 50, 100].map((n) => (
            <option key={n} value={n}>
              {n} / sayfa
            </option>
          ))}
        </select>
        <div className="sm:col-span-3 flex items-center gap-2">
          <button
            className="inline-flex items-center rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 active:scale-[.99]"
            type="submit"
          >
            Uygula
          </button>
          {q || sort !== "createdAt:desc" || size !== 20 ? (
            <Link href="/admin/users" className="text-sm text-neutral-500 hover:text-neutral-700">
              Sıfırla
            </Link>
          ) : null}
        </div>
      </form>

      {/* Table */}
      <div className="mt-6 rounded-2xl border border-neutral-200 bg-white overflow-hidden shadow-sm">
        <div className="px-4 py-3 text-sm font-medium bg-neutral-50 border-b border-neutral-200">Kayıtlı Kullanıcılar</div>
        <table className="w-full text-sm" aria-label="Kullanıcı listesi">
          <thead>
            <tr className="[&>th]:px-4 [&>th]:py-2 text-left text-neutral-500">
              <th>#</th>
              <th>İsim</th>
              <th>E‑posta</th>
              <th>Rol</th>
              <th className="text-right">Kayıt Tarihi</th>
              <th className="text-right">İşlem</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {users.map((u, i) => (
              <tr key={u.id} className="[&>td]:px-4 [&>td]:py-2">
                <td className="font-mono text-xs text-neutral-500">{(page - 1) * size + i + 1}</td>
                <td className="font-medium flex items-center gap-2">
                  
                <div className="size-6 rounded-full bg-neutral-200" />
                  {u.name ?? "—"}
                </td>
                <td className="text-neutral-600">{u.email ?? "—"}</td>
                <td>
                  <span className="inline-flex items-center rounded-full bg-indigo-50 px-2 py-0.5 text-xs text-indigo-700">{u.role}</span>
                </td>
                <td className="text-right tabular-nums">
                  {new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(u.createdAt))}
                </td>
                <td className="text-right">
                  <div className="inline-flex items-center gap-3">
                    {/* <Link href={`/admin/users/${u.id}`} className="text-indigo-600 hover:underline">
                      Detay
                    </Link>
                    <span className="text-neutral-300">·</span> */}
                    <Link href={`/admin/users/${u.id}/billing`} className="text-indigo-600 hover:underline">
                      Detay
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-neutral-500">
                  Kayıt bulunamadı.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="mt-4 flex items-center justify-between text-sm">
        <div className="text-neutral-500">
          Sayfa {page} / {totalPages}
        </div>
        <div className="flex items-center gap-2">
          <Link
            aria-disabled={page <= 1}
            href={{ pathname: "/admin/users", query: { q, size, sort, page: Math.max(1, page - 1) } }}
            className={`inline-flex items-center rounded-xl border px-3 py-1.5 ${
              page <= 1 ? "pointer-events-none opacity-40" : "border-neutral-200 hover:bg-neutral-50"
            }`}
          >
            Önceki
          </Link>
          <Link
            aria-disabled={page >= totalPages}
            href={{ pathname: "/admin/users", query: { q, size, sort, page: Math.min(totalPages, page + 1) } }}
            className={`inline-flex items-center rounded-xl border px-3 py-1.5 ${
              page >= totalPages ? "pointer-events-none opacity-40" : "border-neutral-200 hover:bg-neutral-50"
            }`}
          >
            Sonraki
          </Link>
        </div>
      </div>
    </main>
  );
}

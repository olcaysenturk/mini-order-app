// app/admin/users/page.tsx
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
    const field = (["createdAt", "name", "email", "role"] as const).includes(f as any)
      ? (f as any)
      : "createdAt";
    const dir = d === "asc" ? "asc" : "desc";
    return [field, dir];
  })();

  // 🔧 Tip güvenliği için açık prisma tipi
  const where: Prisma.UserWhereInput = q
    ? {
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { email: { contains: q, mode: "insensitive" } },
        ],
      }
    : {};

  const [total, users, grouped] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      orderBy: { [sortField]: sortDir } as Prisma.UserOrderByWithRelationInput,
      skip: (page - 1) * size,
      take: size,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
      },
    }),
    // rol bazlı chip’ler için ufak toplama
    prisma.user.groupBy({
      by: ["role"],
      where,
      _count: { _all: true },
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / size));

  // chip verileri (rol sıralaması: alfabetik)
  const roleChips = grouped
    .map((g) => ({ role: g.role, count: g._count._all }))
    .sort((a, b) => String(a.role).localeCompare(String(b.role), "tr"));

  return (
    <main className="mx-auto max-w-7xl p-4 sm:p-6">
      {/* HEADER */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight">Kullanıcılar</h1>
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-xl bg-neutral-50 px-2.5 py-1 text-xs font-medium text-neutral-700 ring-1 ring-inset ring-neutral-200">
            Toplam: <strong className="ms-1">{total}</strong>
          </span>
          {roleChips.map((c) => (
            <span
              key={String(c.role)}
              className="inline-flex items-center gap-1 rounded-xl bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700 ring-1 ring-inset ring-indigo-200"
              title={`Rol: ${String(c.role)}`}
            >
              {String(c.role)} <strong className="ms-1">{c.count}</strong>
            </span>
          ))}
        </div>
      </div>

      {/* FİLTRELER – Raporlar’daki kart düzeni */}
      <form
        className="mb-6 rounded-2xl border border-neutral-200 bg-white p-3 sm:p-4 shadow-sm"
        method="get"
      >
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <div className="relative">
            <input
              name="q"
              defaultValue={q}
              placeholder="İsim veya e-posta…"
              className="h-9 w-full rounded-xl border border-neutral-200 bg-white pl-8 pr-3 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
              aria-label="Kullanıcılarda ara"
            />
            <svg
              className="pointer-events-none absolute left-2 top-1/2 size-4 -translate-y-1/2 text-neutral-400"
              viewBox="0 0 24 24"
              aria-hidden
            >
              <path
                fill="currentColor"
                d="M10 4a6 6 0 1 1 3.9 10.6l3.8 3.8-1.4 1.4-3.8-3.8A6 6 0 0 1 10 4m0 2a4 4 0 1 0 0 8a4 4 0 0 0 0-8z"
              />
            </svg>
          </div>

          <select
            name="sort"
            defaultValue={sort}
            className="h-9 rounded-xl border border-neutral-200 bg-white px-3 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            aria-label="Sırala"
          >
            <option value="createdAt:desc">Yeni kayıt</option>
            <option value="createdAt:asc">Eski kayıt</option>
            <option value="name:asc">İsim A→Z</option>
            <option value="name:desc">İsim Z→A</option>
            <option value="email:asc">E-posta A→Z</option>
            <option value="email:desc">E-posta Z→A</option>
            <option value="role:asc">Rol A→Z</option>
            <option value="role:desc">Rol Z→A</option>
          </select>

          <select
            name="size"
            defaultValue={String(size)}
            className="h-9 rounded-xl border border-neutral-200 bg-white px-3 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            aria-label="Sayfa boyutu"
          >
            {[10, 20, 50, 100].map((n) => (
              <option key={n} value={n}>
                {n} / sayfa
              </option>
            ))}
          </select>
        </div>

        <div className="mt-3 flex items-center gap-2">
          <button
            className="inline-flex h-9 items-center gap-2 rounded-xl bg-indigo-600 px-3 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 active:scale-[.99]"
            type="submit"
          >
            Uygula
          </button>

          {(q || sort !== "createdAt:desc" || size !== 20) && (
            <Link
              href="/admin/users"
              className="inline-flex h-9 items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 text-sm text-neutral-700 hover:bg-neutral-50"
            >
              Sıfırla
            </Link>
          )}

          {/* “Yenile” – SSR sayfada parametreleri koruyarak tekrar yükler */}
          <Link
            href={{ pathname: "/admin/users", query: { q, size, sort, page } }}
            className="ms-auto inline-flex h-9 items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 text-sm text-neutral-700 hover:bg-neutral-50"
            title="Yenile"
          >
            <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
              <path fill="currentColor" d="M12 6V3L8 7l4 4V8a4 4 0 1 1-4 4H6a6 6 0 1 0 6-6z" />
            </svg>
            Yenile
          </Link>
        </div>
      </form>

      {/* TABLO – Raporlar’daki gibi kart + overflow koruması */}
      <section className="rounded-2xl border border-neutral-200 bg-white shadow-sm">
        <div className="px-4 py-3 text-sm font-medium text-neutral-800 border-b border-neutral-200">
          Kayıtlı Kullanıcılar
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-[780px] w-full text-sm" aria-label="Kullanıcı listesi">
            <thead className="bg-neutral-50">
              <tr className="[&>th]:px-4 [&>th]:py-2 text-left text-neutral-500">
                <th>#</th>
                <th>Kullanıcı</th>
                <th>Rol</th>
                <th className="text-right">Kayıt</th>
                <th className="text-right">İşlem</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {users.map((u, i) => (
                <tr key={u.id} className="[&>td]:px-4 [&>td]:py-2">
                  <td className="font-mono text-xs text-neutral-500">
                    {(page - 1) * size + i + 1}
                  </td>

                  <td>
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="size-8 shrink-0 rounded-full bg-neutral-200" aria-hidden />
                      <div className="min-w-0">
                        <div className="truncate font-medium">{u.name ?? "—"}</div>
                        <div className="truncate text-xs text-neutral-600">{u.email ?? "—"}</div>
                      </div>
                    </div>
                  </td>

                  <td>
                    <span className="inline-flex items-center rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700 ring-1 ring-inset ring-indigo-200">
                      {String(u.role)}
                    </span>
                  </td>

                  <td className="text-right tabular-nums text-neutral-700">
                    {new Intl.DateTimeFormat("tr-TR", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    }).format(new Date(u.createdAt))}
                  </td>

                  <td className="text-right">
                    <div className="inline-flex items-center gap-2">
                      <Link
                        href={`/admin/users/${u.id}/billing`}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-neutral-200 bg-white px-3 py-1.5 text-xs text-neutral-700 hover:bg-neutral-50"
                        title="Detay"
                      >
                        Detay
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}

              {users.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-neutral-500">
                    Kayıt bulunamadı.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* SAYFALAMA – Raporlar stilinde butonlar */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm">
        <div className="text-neutral-600">
          Sayfa <b>{page}</b> / <b>{totalPages}</b>
        </div>
        <div className="flex items-center gap-2">
          <Link
            aria-disabled={page <= 1}
            href={{ pathname: "/admin/users", query: { q, size, sort, page: Math.max(1, page - 1) } }}
            className={`inline-flex h-9 items-center rounded-xl border px-3 text-sm ${
              page <= 1
                ? "pointer-events-none opacity-40"
                : "border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50"
            }`}
          >
            Önceki
          </Link>
          <Link
            aria-disabled={page >= totalPages}
            href={{ pathname: "/admin/users", query: { q, size, sort, page: Math.min(totalPages, page + 1) } }}
            className={`inline-flex h-9 items-center rounded-xl border px-3 text-sm ${
              page >= totalPages
                ? "pointer-events-none opacity-40"
                : "border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50"
            }`}
          >
            Sonraki
          </Link>
        </div>
      </div>
    </main>
  );
}

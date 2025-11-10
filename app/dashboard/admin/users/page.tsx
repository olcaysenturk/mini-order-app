// app/admin/users/page.tsx
import Link from "next/link";
import { Prisma, TenantRole, UserRole } from "@prisma/client";
import { prisma } from "@/app/lib/db";
import { requireSuperAdmin } from "@/app/lib/requireSuperAdmin";
import { UserDeleteButton } from "./UserDeleteButton";

const STAFF_ROLES: TenantRole[] = [TenantRole.STAFF];
const ADMIN_ROLES: TenantRole[] = [TenantRole.ADMIN, TenantRole.OWNER];

function toInt(v: string | undefined, def = 1) {
  const n = parseInt(v ?? "", 10);
  return Number.isFinite(n) && n > 0 ? n : def;
}

function parseSort(sort: string): ["createdAt" | "name" | "email", "asc" | "desc"] {
  const [field, dir] = sort.split(":");
  const allowedFields: Array<"createdAt" | "name" | "email"> = ["createdAt", "name", "email"];
  const safeField = allowedFields.includes(field as any) ? (field as any) : "createdAt";
  const safeDir = dir === "asc" ? "asc" : "desc";
  return [safeField, safeDir];
}

function buildOrderBy(field: "createdAt" | "name" | "email", dir: "asc" | "desc") {
  const orderBy: Prisma.UserOrderByWithRelationInput = {};
  orderBy[field] = dir;
  return orderBy;
}

type AdminTeam = {
  id: string;
  name: string | null;
  email: string;
  createdAt: Date;
  tenantCount: number;
  totalStaff: number;
  tenants: Array<{
    id: string;
    name: string;
    role: TenantRole;
    staff: Array<{
      id: string;
      name: string | null;
      email: string;
      createdAt: Date;
    }>;
  }>;
};

type StaffRow = {
  id: string;
  name: string | null;
  email: string;
  createdAt: Date;
  isActive: boolean;
  admins: string[];
  tenants: Array<{ id: string; name: string }>;
};

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string; size?: string; sort?: string; tab?: string }>;
}) {
  await requireSuperAdmin();

  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const page = toInt(sp.page, 1);
  const size = Math.min(100, toInt(sp.size, 20));
  const sort = sp.sort ?? "createdAt:desc";
  const [sortField, sortDir] = parseSort(sort);
  const activeTab = (sp.tab ?? "admins") === "staff" ? "staff" : "admins";

  const searchFilter: Prisma.UserWhereInput = q
    ? {
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { email: { contains: q, mode: "insensitive" } },
        ],
      }
    : {};

  const adminFilter: Prisma.UserWhereInput =
    activeTab === "admins"
      ? { ...searchFilter, role: UserRole.ADMIN }
      : { role: UserRole.ADMIN };
  const staffFilter: Prisma.UserWhereInput = { ...searchFilter, role: UserRole.STAFF };

  const [adminTotal, staffTotal, adminUsersRaw, staffFilteredTotal, staffUsersRaw] = await Promise.all([
    prisma.user.count({ where: { role: UserRole.ADMIN } }),
    prisma.user.count({ where: { role: UserRole.STAFF } }),
    prisma.user.findMany({
      where: adminFilter,
      orderBy: { createdAt: "desc" },
      include: {
        memberships: {
          where: { role: { in: ADMIN_ROLES } },
          select: {
            role: true,
            tenant: {
              select: {
                id: true,
                name: true,
                memberships: {
                  where: { role: { in: STAFF_ROLES } },
                  select: {
                    user: {
                      select: {
                        id: true,
                        name: true,
                        email: true,
                        createdAt: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    }),
    prisma.user.count({ where: staffFilter }),
    prisma.user.findMany({
      where: staffFilter,
      orderBy: buildOrderBy(sortField, sortDir),
      skip: (page - 1) * size,
      take: size,
      include: {
        memberships: {
          select: {
            tenant: {
              select: {
                id: true,
                name: true,
                memberships: {
                  where: { role: { in: ADMIN_ROLES } },
                  select: {
                    role: true,
                    user: {
                      select: {
                        id: true,
                        name: true,
                        email: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    }),
  ]);

  const adminTeams: AdminTeam[] = adminUsersRaw.map((admin) => {
    const tenants = admin.memberships.map((membership) => {
      const tenantStaff = membership.tenant.memberships.map((staffMembership) => ({
        id: staffMembership.user.id,
        name: staffMembership.user.name,
        email: staffMembership.user.email,
        createdAt: staffMembership.user.createdAt,
      }));

      return {
        id: membership.tenant.id,
        name: membership.tenant.name,
        role: membership.role,
        staff: tenantStaff,
      };
    });

    const totalStaff = tenants.reduce((acc, tenant) => acc + tenant.staff.length, 0);

    return {
      id: admin.id,
      name: admin.name,
      email: admin.email,
      createdAt: admin.createdAt,
      tenantCount: tenants.length,
      totalStaff,
      tenants,
    };
  });

  const staffRows: StaffRow[] = staffUsersRaw.map((staff) => {
    const tenants = staff.memberships.map((membership) => ({
      id: membership.tenant.id,
      name: membership.tenant.name,
      admins: membership.tenant.memberships.map((adminMembership) => ({
        id: adminMembership.user.id,
        name: adminMembership.user.name ?? adminMembership.user.email,
        email: adminMembership.user.email,
      })),
    }));

    const adminNames = Array.from(
      new Set(
        tenants.flatMap((tenant) =>
          tenant.admins.map((admin) => admin.name ?? admin.email),
        ),
      ),
    );

    return {
      id: staff.id,
      name: staff.name,
      email: staff.email,
      createdAt: staff.createdAt,
      isActive: staff.isActive,
      admins: adminNames,
      tenants: tenants.map((tenant) => ({ id: tenant.id, name: tenant.name })),
    };
  });

  const totalPages = Math.max(1, Math.ceil(staffFilteredTotal / size));
  const formatter = new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium", timeStyle: "short" });

  const filteredAdminCount = adminTeams.length;
  const filteredStaffCount = staffFilteredTotal;
  const totalTeamsStaff = adminTeams.reduce((acc, team) => acc + team.totalStaff, 0);
  const tabContextLabel = activeTab === "admins" ? "Listelenen Admin" : "Listelenen Staff";
  const tabContextCount = activeTab === "admins" ? filteredAdminCount : filteredStaffCount;
  const avgTeamSize = filteredAdminCount > 0 ? (totalTeamsStaff / filteredAdminCount).toFixed(1) : "—";
  const tabs = [
    { id: "admins", label: "Yöneticiler ve üyeleri", helper: "Yöneticiler ve ekipleri", count: filteredAdminCount },
    { id: "staff", label: "Üye Kullanıcılar", helper: "Tüm ekip üyeleri", count: filteredStaffCount },
  ] as const;
  const summaryCards: Array<{
    label: string;
    value: string | number;
    accent: "indigo" | "emerald" | "amber" | "rose";
    helper: string;
  }> = [
    { label: "Toplam Yönetici", value: adminTotal, accent: "indigo", helper: "Sistemdeki yönetici sayısı" },
    { label: "Toplam Üye", value: staffTotal, accent: "emerald", helper: "Tenantlara bağlı ekip üyeleri" },
    { label: tabContextLabel, value: tabContextCount, accent: "amber", helper: activeTab === "staff" && q ? `Arama: “${q}”` : "Tab seçiminize göre" },
    { label: "Ortalama Ekip", value: avgTeamSize, accent: "rose", helper: "Listelenen admin başına staff" },
  ];

  return (
    <main className="mx-auto max-w-7xl space-y-8 p-4 sm:p-6">
      <section className="relative overflow-hidden rounded-3xl border border-neutral-200 bg-white/90 shadow-xl">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(79,70,229,0.18),transparent_55%),radial-gradient(circle_at_bottom_right,rgba(16,185,129,0.18),transparent_55%)]" />
        <div className="relative z-10 grid gap-6 px-6 py-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] lg:items-center">
          <div className="space-y-5">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-1 text-xs font-medium text-indigo-700 ring-1 ring-indigo-100">
              Yönetici paneli
            </span>
            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-neutral-900 sm:text-4xl">
                Kullanıcı Yönetimi
              </h1>
              <p className="mt-2 max-w-2xl text-sm text-neutral-600">
                Adminleri ve ekip üyelerini görün, filtreleyin ve detay sayfalarına hızlıca geçiş yapın. Arama yalnızca staff sekmesinde uygulanır.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {tabs.map((tab) => {
                const isActive = activeTab === tab.id;
                const query: Record<string, string> = {
                  tab: tab.id,
                  size: String(size),
                  sort,
                  page: "1",
                };
                if (q) query.q = q;
                return (
                  <Link
                    key={tab.id}
                    href={{ pathname: "/dashboard/admin/users", query }}
                    className={`flex min-w-[160px] flex-col rounded-xl px-4 py-2 text-sm transition ${
                      isActive
                        ? "bg-neutral-900 text-white shadow-sm"
                        : "bg-white/90 text-neutral-600 ring-1 ring-inset ring-neutral-200 hover:bg-white"
                    }`}
                  >
                    <span className="font-semibold">{tab.label}</span>
                    <span className={`mt-1 text-xs ${isActive ? "text-neutral-200" : "text-neutral-400"}`}>
                      {tab.helper} • {tab.count}
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {summaryCards.map((card) => (
              <SummaryTile
                key={card.label}
                label={card.label}
                value={card.value}
                accent={card.accent}
                helper={card.helper}
              />
            ))}
          </div>
        </div>
      </section>

      <form className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm" method="get">
        <input type="hidden" name="tab" value={activeTab} />
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[2fr_1fr_1fr]">
          <label className="flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm focus-within:ring-2 focus-within:ring-indigo-500">
            <svg viewBox="0 0 24 24" className="size-4 text-neutral-400" aria-hidden>
              <path
                fill="currentColor"
                d="M10 4a6 6 0 1 1 3.9 10.6l3.8 3.8-1.4 1.4-3.8-3.8A6 6 0 0 1 10 4m0 2a4 4 0 1 0 0 8a4 4 0 0 0 0-8z"
              />
            </svg>
            <input
              name="q"
              defaultValue={q}
              placeholder="Staff kullanıcılarında ara…"
              className="w-full bg-transparent outline-none placeholder:text-neutral-400"
              aria-label="Staff kullanıcılarında ara"
            />
          </label>

          <select
            name="sort"
            defaultValue={sort}
            className="h-10 rounded-xl border border-neutral-200 bg-white px-3 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            aria-label="Sırala"
          >
            <option value="createdAt:desc">Yeni kayıt (varsayılan)</option>
            <option value="createdAt:asc">Eski kayıt</option>
            <option value="name:asc">İsim A→Z</option>
            <option value="name:desc">İsim Z→A</option>
            <option value="email:asc">E-posta A→Z</option>
            <option value="email:desc">E-posta Z→A</option>
          </select>

          <select
            name="size"
            defaultValue={String(size)}
            className="h-10 rounded-xl border border-neutral-200 bg-white px-3 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            aria-label="Sayfa boyutu"
          >
            {[10, 20, 50, 100].map((n) => (
              <option key={n} value={n}>
                {n} / sayfa
              </option>
            ))}
          </select>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-indigo-600 px-3 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 active:scale-[.99]"
            type="submit"
          >
            Uygula
          </button>
          {(q || sort !== "createdAt:desc" || size !== 20) && (
            <Link
              href={{ pathname: "/dashboard/admin/users", query: { tab: activeTab } }}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 text-sm text-neutral-700 hover:bg-neutral-50"
            >
              Sıfırla
            </Link>
          )}
        </div>
      </form>

      {activeTab === "admins" && (
        <section className="space-y-4">
          <div className="rounded-3xl border border-neutral-200 bg-white/90 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-200 px-5 py-4">
              <div>
                <h2 className="text-lg font-semibold text-neutral-900">
                  Admin Takımları ({filteredAdminCount})
                </h2>
                <p className="text-xs text-neutral-500">
                  Yönetici kullanıcılar ve bağlı oldukları tenantlardaki staff üyeleri.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-500">
                <span className="inline-flex items-center gap-1 rounded-lg bg-neutral-100 px-2 py-0.5 font-medium text-neutral-600 ring-1 ring-neutral-300">
                  Toplam staff: <strong>{totalTeamsStaff}</strong>
                </span>
                <span className="inline-flex items-center gap-1 rounded-lg bg-indigo-50 px-2 py-0.5 font-medium text-indigo-700 ring-1 ring-indigo-200">
                  Ortalama ekip: <strong>{avgTeamSize}</strong>
                </span>
              </div>
            </div>

            {adminTeams.length === 0 ? (
              <div className="p-6 text-sm text-neutral-500">
                Kriterlere uygun admin bulunamadı.
              </div>
            ) : (
              <div className="flex flex-col gap-4 p-5">
                {adminTeams.map((team) => (
                  <article
                    key={team.id}
                    className="flex flex-col gap-4 rounded-2xl border border-neutral-200 bg-white/80 p-5 shadow-sm backdrop-blur"
                  >
                    <header className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h3 className="text-base font-semibold text-neutral-900">
                          {team.name ?? "İsimsiz Admin"}
                        </h3>
                        <p className="text-xs text-neutral-500">{team.email}</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-500">
                        <span className="inline-flex items-center gap-1 rounded-lg bg-indigo-50 px-2 py-0.5 font-medium text-indigo-700 ring-1 ring-indigo-200">
                          {team.tenantCount} tenant
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2 py-0.5 font-medium text-emerald-700 ring-1 ring-emerald-200">
                          {team.totalStaff} staff
                        </span>
                        <Link
                          href={`/dashboard/admin/users/${team.id}`}
                          className="inline-flex items-center gap-1.5 rounded-full bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-indigo-700"
                        >
                          Admin Detayı
                        </Link>
                      </div>
                    </header>

                    <details className="rounded-2xl border border-neutral-200 bg-white/70 p-3">
                      <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-semibold text-neutral-800 [&::-webkit-details-marker]:hidden">
                        <span>Tenant bilgileri</span>
                        <span className="text-xs text-neutral-500">{team.tenantCount} kayıt</span>
                      </summary>
                      <div className="mt-3 space-y-3 text-sm">
                        {team.tenants.length === 0 ? (
                          <div className="rounded-xl border border-dashed border-neutral-200 bg-neutral-50/70 px-3 py-2 text-neutral-600">
                            Bu admin herhangi bir tenantta yetkili değil.
                          </div>
                        ) : (
                          team.tenants.map((tenant) => (
                            <div key={`${team.id}-${tenant.id}`} className="rounded-xl border border-neutral-200 bg-neutral-50/50 p-3">
                              <div className="flex items-center justify-between text-xs text-neutral-500">
                                <span className="font-medium text-neutral-800">{tenant.name}</span>
                                <span className="uppercase tracking-wide text-neutral-400">{tenant.role}</span>
                              </div>
                              {tenant.staff.length === 0 ? (
                                <p className="mt-2 text-xs text-neutral-500">Bu tenantta staff üyesi bulunmuyor.</p>
                              ) : (
                                <ul className="mt-3 space-y-2">
                                  {tenant.staff.map((staff) => (
                                    <li key={staff.id} className="flex items-center justify-between rounded-lg bg-white/80 px-3 py-2 text-xs shadow-sm">
                                      <div className="min-w-0">
                                        <p className="truncate font-medium text-neutral-800">{staff.name ?? "İsimsiz Kullanıcı"}</p>
                                        <p className="truncate text-neutral-500">{staff.email}</p>
                                      </div>
                                      <span className="text-[11px] text-neutral-400">
                                        {formatter.format(staff.createdAt)}
                                      </span>
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    </details>
                  </article>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {activeTab === "staff" && (
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-lg font-semibold text-neutral-900">
                Staff Kullanıcıları ({filteredStaffCount})
              </h2>
              <p className="text-xs text-neutral-500">
                Arama ve sıralama sadece bu listeyi etkiler. Her satır ilgili adminleri gösterir.
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs text-neutral-500">
              <span>Sayfa {page} / {totalPages}</span>
            </div>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-neutral-200 bg-white shadow-sm">
            <table className="min-w-[900px] w-full text-sm" aria-label="Staff kullanıcı listesi">
              <thead className="bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500">
                <tr className="[&>th]:px-4 [&>th]:py-2 text-left">
                  <th>#</th>
                  <th>Kullanıcı</th>
                  <th>Bağlı Adminler</th>
                  <th>Tenantlar</th>
                  <th>Durum</th>
                  <th className="text-right">Kayıt</th>
                  <th className="text-right">İşlem</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {staffRows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-neutral-500">
                      Kayıt bulunamadı.
                    </td>
                  </tr>
                ) : (
                  staffRows.map((row, index) => (
                  <tr key={row.id} className="[&>td]:px-4 [&>td]:py-2">
                    <td className="font-mono text-xs text-neutral-400">
                      {(page - 1) * size + index + 1}
                    </td>
                    <td>
                      <div className="flex items-center gap-3">
                        <div className="size-8 shrink-0 rounded-full bg-neutral-200" aria-hidden />
                        <div className="min-w-0">
                          <p className="truncate font-medium text-neutral-900">{row.name ?? "İsimsiz Kullanıcı"}</p>
                          <p className="truncate text-xs text-neutral-500">{row.email}</p>
                        </div>
                      </div>
                    </td>
                    <td>
                      {row.admins.length === 0 ? (
                        <span className="text-xs text-neutral-400">Admin atanmamış</span>
                      ) : (
                        <div className="flex flex-wrap items-center gap-1">
                          {row.admins.map((adminName) => (
                            <span
                              key={`${row.id}-${adminName}`}
                              className="inline-flex items-center rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-medium text-indigo-700 ring-1 ring-indigo-200"
                            >
                              {adminName}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td>
                      {row.tenants.length === 0 ? (
                        <span className="text-xs text-neutral-400">Tenant yok</span>
                      ) : (
                        <div className="flex flex-wrap items-center gap-1">
                          {row.tenants.map((tenant) => (
                            <span
                              key={`${row.id}-${tenant.id}`}
                              className="inline-flex items-center rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] text-neutral-600 ring-1 ring-neutral-300"
                            >
                              {tenant.name}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td>
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                          row.isActive
                            ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
                            : "bg-rose-50 text-rose-700 ring-1 ring-rose-200"
                        }`}
                      >
                        {row.isActive ? "Aktif" : "Pasif"}
                      </span>
                    </td>
                    <td className="text-right text-xs text-neutral-500">
                      {formatter.format(row.createdAt)}
                    </td>
                    <td className="text-right">
                      <div className="inline-flex items-center gap-2">
                        <Link
                          href={`/dashboard/admin/users/${row.id}`}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-neutral-200 bg-white px-3 py-1.5 text-xs text-neutral-700 hover:bg-neutral-50"
                        >
                          Detay
                        </Link>
                        <UserDeleteButton userId={row.id} userName={row.name ?? row.email} />
                      </div>
                    </td>
                  </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-neutral-600">
            <div>
              Sayfa <strong>{page}</strong> / <strong>{totalPages}</strong>
            </div>
            <div className="flex items-center gap-2">
              <PageLink
                disabled={page <= 1}
                href={{
                  pathname: "/dashboard/admin/users",
                  query: {
                    tab: "staff",
                    page: String(Math.max(1, page - 1)),
                    size: String(size),
                    sort,
                    ...(q ? { q } : {}),
                  },
                }}
              >
                Önceki
              </PageLink>
              <PageLink
                disabled={page >= totalPages}
                href={{
                  pathname: "/dashboard/admin/users",
                  query: {
                    tab: "staff",
                    page: String(Math.min(totalPages, page + 1)),
                    size: String(size),
                    sort,
                    ...(q ? { q } : {}),
                  },
                }}
              >
                Sonraki
              </PageLink>
            </div>
          </div>
        </section>
      )}
    </main>
  );
}

function SummaryTile({
  label,
  value,
  accent,
  helper,
}: {
  label: string;
  value: string | number;
  accent: "indigo" | "emerald" | "amber" | "rose";
  helper?: string;
}) {
  const colors =
    accent === "emerald"
      ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
      : accent === "amber"
      ? "bg-amber-50 text-amber-700 ring-amber-200"
      : accent === "rose"
      ? "bg-rose-50 text-rose-700 ring-rose-200"
      : "bg-indigo-50 text-indigo-700 ring-indigo-200";

  return (
    <div className={`rounded-2xl bg-white/70 px-4 py-3 text-sm shadow-sm ring-1 ${colors}`}>
      <div className="text-xs font-medium uppercase text-neutral-500">{label}</div>
      <div className="mt-1 text-xl font-semibold">{value}</div>
      {helper && <div className="mt-1 text-[11px] text-neutral-500">{helper}</div>}
    </div>
  );
}

function PageLink({
  disabled,
  href,
  children,
}: {
  disabled: boolean;
  href: { pathname: string; query: Record<string, string | number> };
  children: React.ReactNode;
}) {
  if (disabled) {
    return (
      <span className="inline-flex h-9 items-center rounded-xl border border-neutral-200 px-3 text-sm text-neutral-400">
        {children}
      </span>
    );
  }
  return (
    <Link
      href={href}
      className="inline-flex h-9 items-center rounded-xl border border-neutral-200 px-3 text-sm text-neutral-700 hover:bg-neutral-50"
    >
      {children}
    </Link>
  );
}

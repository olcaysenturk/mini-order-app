'use client';

import { useState } from "react";
import { useRouter } from "next/navigation";

export function UserDeleteButton({
  userId,
  userName,
}: {
  userId: string;
  userName?: string | null;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    if (loading) return;
    const label = userName?.trim() || "bu kullanıcıyı";
    const confirmed = window.confirm(
      `${label} silmek istediğine emin misin? Bu işlem geri alınamaz.`,
    );
    if (!confirmed) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/admin/users/${userId}`, { method: "DELETE" });
      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        let message = txt;
        try {
          const json = JSON.parse(txt);
          message = json?.message || json?.error || txt;
        } catch {
          // ignore parse errors
        }
        throw new Error(message || "Silme işlemi başarısız");
      }
      router.refresh();
    } catch (err: any) {
      console.error("User delete failed:", err);
      window.alert(err?.message || "Kullanıcı silinemedi.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 bg-white px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 disabled:pointer-events-none disabled:opacity-60"
      title="Kullanıcıyı sil"
    >
      {loading ? "Siliniyor…" : "Sil"}
    </button>
  );
}

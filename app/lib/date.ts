export function parseYMDToLocalDate(ymd: string | Date | number): Date {
  if (ymd instanceof Date) return ymd;
  if (typeof ymd === 'number') return new Date(ymd);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (m) return new Date(+m[1], +m[2]-1, +m[3]);
  const d = new Date(ymd);
  if (!isNaN(d.getTime())) return d;
  throw new Error('Geçersiz tarih');
}
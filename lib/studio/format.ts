export function money(n: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: n % 100 ? 2 : 0,
    minimumFractionDigits: n % 100 ? 2 : 0,
  }).format(n / 100);
}
export function dayLabel(s: string, long = false) {
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    ...(long ? { year: 'numeric' } : {}),
    timeZone: 'UTC',
  }).format(new Date(s.slice(0, 10) + 'T12:00:00Z'));
}
export function shift(s: string, n: number) {
  const d = new Date(s + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
export function dayDiff(a: string, b: string) {
  return Math.round((Date.parse(b) - Date.parse(a)) / 86400000);
}

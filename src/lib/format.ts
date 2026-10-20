export const money = (n: number | null | undefined, dp = 0) => {
  const v = Number(n ?? 0);
  return (v < 0 ? '−$' : '$') + Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp });
};
export const kmoney = (n: number) => Math.abs(n) >= 1e6 ? '$' + (n / 1e6).toFixed(2) + 'M' : Math.abs(n) >= 1e3 ? (n < 0 ? '−$' : '$') + (Math.abs(n) / 1e3).toFixed(1) + 'K' : money(n);
export const pct = (n: number | null | undefined, dp = 0) => n == null || !isFinite(n) ? '—' : (n * 100).toFixed(dp) + '%';
export const num = (n: number) => Math.round(n).toLocaleString('en-US');
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const d = (s: string | Date) => typeof s === 'string' ? new Date(s.length === 10 ? s + 'T12:00:00Z' : s) : s;
export const fdate = (s: string | Date | null | undefined) => { if (!s) return '—'; const x = d(s); return `${MON[x.getUTCMonth()]} ${x.getUTCDate()}`; };
export const fdateY = (s: string | Date | null | undefined) => { if (!s) return '—'; const x = d(s); return `${MON[x.getUTCMonth()]} ${x.getUTCDate()}, ${x.getUTCFullYear()}`; };
export const fdatetime = (s: Date | null | undefined) => s ? `${fdateY(s)} ${s.toISOString().slice(11, 16)} UTC` : '—';
export const isoToday = () => new Date().toISOString().slice(0, 10);
export const addDays = (s: string, n: number) => { const x = d(s); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
export const daysBetween = (a: string, b: string) => Math.round((d(b).getTime() - d(a).getTime()) / 86400000);
export const MONTHS = MON;
export const STATUS_LABEL: Record<string, string> = { DRAFT: 'Draft', SUBMITTED: 'Needs review', SENT_BACK: 'Sent back', APPROVED: 'Approved', REJECTED: 'Rejected', WITHDRAWN: 'Withdrawn' };
export const STATUS_TONE: Record<string, string> = { DRAFT: '', SUBMITTED: 'info', SENT_BACK: 'warn', APPROVED: 'good', REJECTED: 'bad', WITHDRAWN: '' };

import Link from 'next/link';
import { classifyFunding, type FundClass } from '@/lib/economics';
import { money, pct, STATUS_LABEL, STATUS_TONE } from '@/lib/format';

export function PageHead({ title, sub, children }: { title: string; sub?: React.ReactNode; children?: React.ReactNode }) {
  return <div className="page-head"><div className="grow"><h1>{title}</h1>{sub && <p>{sub}</p>}</div>{children && <div className="actions">{children}</div>}</div>;
}
export function Flash({ sp }: { sp: { ok?: string; error?: string } }) {
  return <>{sp.ok && <p className="flash ok" role="status">{sp.ok}</p>}{sp.error && <p className="flash err" role="alert">{sp.error}</p>}</>;
}
export const StatusPill = ({ s, auto }: { s: string; auto?: boolean }) => <span className={`pill ${STATUS_TONE[s] ?? ''}`}>{STATUS_LABEL[s] ?? s}{auto && s === 'APPROVED' ? ' · auto' : ''}</span>;
const FTONE: Record<FundClass, string> = { 'Vendor funded': 'good', Shared: 'warn', 'Retailer funded': '' };
export function FundPill({ markdown, vendorFunds, threshold }: { markdown: number; vendorFunds: number; threshold: number }) {
  const f = classifyFunding(markdown, vendorFunds, threshold);
  return <span className={`pill ${FTONE[f.cls]}`} title={markdown > 0 ? `${pct(f.share)} of markdown covered by vendor funds` : 'Fee or accrual, no markdown'}>{f.cls}{f.cls === 'Shared' ? ' ' + pct(f.share) : ''}</span>;
}
export function MixBar({ vendor, wholesaler, markdown }: { vendor: number; wholesaler: number; markdown: number }) {
  const base = Math.max(markdown, vendor + wholesaler) || 1; const rtl = Math.max(0, markdown - vendor - wholesaler);
  return <div className="mix" title={`Vendor ${money(vendor)} · wholesaler ${money(wholesaler)} · retailer ${money(rtl)}`}><i className="v" style={{ width: `${vendor / base * 100}%` }} /><i className="w" style={{ width: `${wholesaler / base * 100}%` }} /><i className="r" style={{ width: `${rtl / base * 100}%` }} /></div>;
}
export const DealLink = ({ id, number }: { id: string; number: string }) => <Link className="id" href={`/deals/${id}`}>{number}</Link>;
export function Empty({ children }: { children: React.ReactNode }) { return <div className="empty">{children}</div>; }

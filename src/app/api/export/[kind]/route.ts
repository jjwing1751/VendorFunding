import { db } from '@/db';
import { audit } from '@/lib/audit';
import { actorName, can, getSessionUser, isVendorUser, mfaSetupNeeded, clientIp } from '@/lib/auth';
import { toCsv } from '@/lib/csv';
import { loadMeasured } from '@/lib/measure-data';
import { addDays, isoToday } from '@/lib/format';
import { mondayOf } from '@/lib/measure';

export const dynamic = 'force-dynamic';

const csv = (name: string, body: string) => new Response(body, { headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': `attachment; filename="${name}"`, 'cache-control': 'no-store' } });
const r2 = (n: number) => Math.round(n * 100) / 100;

export async function GET(_: Request, { params }: { params: Promise<{ kind: string }> }) {
  const me = await getSessionUser();
  if (!me || !me.session.mfaPassed || me.user.mustChangePassword || mfaSetupNeeded(me)) return new Response('Sign in first.', { status: 401 });
  const { kind } = await params;
  const wk = mondayOf(addDays(isoToday(), -14)), wk2 = mondayOf(addDays(isoToday(), -7));

  if (kind === 'template-sales.csv') return csv(kind, toCsv([['upc', 'week_start', 'units', 'sales'], ['0-85390-10011', wk, 742, 3183.18], ['0-85390-10011', wk2, 715, 3067.35]]));
  if (kind === 'template-receipts.csv') return csv(kind, toCsv([['upc', 'week_start', 'cases', 'cost'], ['0-85390-10011', wk, 60, 1512.0], ['0-85390-10011', wk2, 58, '']]));
  if (kind === 'template-bbm.csv') return csv(kind, toCsv([['deal_number', 'invoice_number', 'vendor_number', 'invoice_date', 'amount_billed', 'amount_collected', 'status', 'method'], ['DL-XXXX', 'BBM-100245', '01004410', isoToday(), 1250.0, 1250.0, 'Deducted', 'deduction']]));

  if (kind === 'sample-bbm.csv') {
    // A stand-in for what Bill Back Manager would send back after billing the ready-to-bill export, so the round trip can be tried.
    if (!can(me, 'manage_billing')) return new Response('Not allowed.', { status: 403 });
    const { measured } = await loadMeasured(me);
    const due = measured.filter(({ m }) => m.ended && m.gap > Math.max(5, m.billable * 0.01));
    const stamp = Date.now().toString(36).slice(-5).toUpperCase();
    return csv('sample-bill-back-manager.csv', toCsv([['deal_number', 'invoice_number', 'vendor_number', 'invoice_date', 'amount_billed', 'amount_collected', 'status', 'method'],
      ...due.map(({ d, m }) => [d.number, `BBM-S${stamp}-${d.number.slice(3)}`, d.vendor.number, isoToday(), r2(m.gap), 0, 'Open', d.vendor.settlement === 'DEDUCTION' ? 'deduction' : 'invoice'])]));
  }

  if (kind === 'ready-to-bill.csv' || kind === 'reconciliation.csv') {
    if (isVendorUser(me) || !(can(me, 'manage_billing') || can(me, 'view_performance'))) return new Response('Not allowed.', { status: 403 });
    const { measured } = await loadMeasured(me);
    const rows = measured.filter(({ m }) => kind === 'reconciliation.csv' ? m.started : m.ended && m.gap > Math.max(5, m.billable * 0.01));
    const header = ['deal_number', 'vendor_number', 'vendor_name', 'settlement', 'deal_type', 'deal_start', 'deal_end', 'units_sold', 'bill_back_and_scan', 'ad_fee', 'accrual_rate', 'accrual_purchases', 'accrual_earned', 'billable_earned', 'already_billed', 'amount_to_bill', 'collected', 'status'];
    const body = toCsv([header, ...rows.map(({ d, m }) => [d.number, d.vendor.number, d.vendor.name, d.vendor.settlement.toLowerCase(), m.type, d.startDate, d.endDate, m.actual == null ? '' : Math.round(m.actual), r2(m.billable - m.adEarned - m.accrual), r2(m.adEarned), d.accrualPct, r2(m.purchases), r2(m.accrual), r2(m.billable), r2(m.billed), r2(Math.max(0, m.gap)), r2(m.collected), m.status])]);
    if (kind === 'ready-to-bill.csv') await audit(db, { actorId: me.user.id, actorName: actorName(me), action: 'Ready-to-bill file exported', objectType: 'billing', objectId: 'export', detail: `${rows.length} deals · $${Math.round(rows.reduce((s, r) => s + Math.max(0, r.m.gap), 0)).toLocaleString()} to bill`, ip: await clientIp() });
    return csv(`fundline-${kind.replace('.csv', '')}-${isoToday()}.csv`, body);
  }
  return new Response('Not found.', { status: 404 });
}

/* Measurement engine: what vendors committed, what they earned once sales and receipts came in,
   what Bill Back Manager billed and collected, accrual balances, and event performance.
   Pure functions, no database or server imports, so the seed, the pages and the tests share them. */
import { dealEcon, lineCalc, weeksIn, type LineInput } from './economics';

export type WeekRow = { upc: string; weekStart: string; units: number; sales?: number | null };
export type ReceiptRow = { upc: string; weekStart: string; cases: number; cost: number };
export type BillRow = { dealNumber: string; billed: number; collected: number; status: string };

export type MDeal = {
  number: string; status: string; vendorId: string; eventId: string;
  startDate: string; endDate: string; adFee: number; accrualPct: number; forecastUnits: number | null;
  lines: (LineInput & { upc: string })[];
};

const DAY = 86400000;
const t = (iso: string) => Date.parse(iso + 'T00:00:00Z');
const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10);
export const mondayOf = (isoDate: string) => { const ms = t(isoDate); const dow = (new Date(ms).getUTCDay() + 6) % 7; return iso(ms - dow * DAY); };
const minIso = (a: string, b: string) => (a < b ? a : b);

/** Days of week [ws, ws+6] that fall inside [a, b] (inclusive). */
function overlapDays(ws: string, a: string, b: string) {
  const s = Math.max(t(ws), t(a)), e = Math.min(t(ws) + 6 * DAY, t(b));
  return e < s ? 0 : Math.round((e - s) / DAY) + 1;
}

/** Index rows by UPC once; every measure below reads from it. */
export type Actuals = { sales: Map<string, WeekRow[]>; receipts: Map<string, ReceiptRow[]> };
export function indexActuals(sales: WeekRow[], rec: ReceiptRow[]): Actuals {
  const s = new Map<string, WeekRow[]>(), r = new Map<string, ReceiptRow[]>();
  for (const x of sales) (s.get(x.upc) ?? s.set(x.upc, []).get(x.upc)!).push(x);
  for (const x of rec) (r.get(x.upc) ?? r.set(x.upc, []).get(x.upc)!).push(x);
  return { sales: s, receipts: r };
}

/** Units sold for one UPC in [a, b], prorating partial weeks. `covered` = share of the days that have a loaded week. */
export function unitsIn(A: Actuals, upc: string, a: string, b: string) {
  let units = 0, sales = 0, days = 0;
  for (const w of A.sales.get(upc) ?? []) { const d = overlapDays(w.weekStart, a, b); if (d) { units += w.units * d / 7; sales += (w.sales ?? 0) * d / 7; days += d; } }
  const total = Math.max(1, Math.round((t(b) - t(a)) / DAY) + 1);
  return { units, sales, covered: Math.min(1, days / total) };
}
export function purchasesIn(A: Actuals, upc: string, a: string, b: string) {
  let cases = 0, cost = 0;
  for (const w of A.receipts.get(upc) ?? []) { const d = overlapDays(w.weekStart, a, b); if (d) { cases += w.cases * d / 7; cost += w.cost * d / 7; } }
  return { cases, cost };
}

export type BillingStatus = 'Not started' | 'Running' | 'Waiting for sales data' | 'Off-invoice only' | 'Ready to bill' | 'Under-billed' | 'Over-billed' | 'Billed in full' | 'Collected' | 'Disputed';
export const BILLING_TONE: Record<BillingStatus, string> = {
  'Not started': '', Running: 'info', 'Waiting for sales data': '', 'Off-invoice only': '', 'Ready to bill': 'warn',
  'Under-billed': 'bad', 'Over-billed': 'bad', 'Billed in full': 'acc', Collected: 'good', Disputed: 'bad',
};

/**
 * One deal, measured.
 * committed  = vendor + wholesaler funding forecast at approval (what the contract promised)
 * earned     = the same rates applied to actual units sold (prorated), plus the ad fee once the deal starts, plus accrual % × purchases received
 * billable   = the part the retailer bills the vendor: bill-back + unit scan + ad fee + accrual (off-invoice is taken on the invoice; wholesaler scan is billed by the wholesaler)
 */
export function measureDeal(d: MDeal, A: Actuals, bills: BillRow[], today: string, claimDays = 90) {
  const econ = dealEcon({ lines: d.lines, startDate: d.startDate, endDate: d.endDate, adFee: d.adFee, accrualPct: d.accrualPct, forecastUnits: d.forecastUnits });
  const started = today >= d.startDate, ended = today > d.endDate;
  const to = minIso(d.endDate, today);
  const W = d.lines.reduce((s, l) => s + Math.max(1, l.baseWeeklyUnits), 0) || 1;
  const weeks = weeksIn(d.startDate, d.endDate);
  let actual = 0, coveredW = 0, offInvoice = 0, billVar = 0, wholesaler = 0, purchases = 0, promoGM = 0, baseGM = 0;
  const lines = d.lines.map(l => {
    const c = lineCalc(l);
    const share = Math.max(1, l.baseWeeklyUnits) / W;
    const baseline = l.baseWeeklyUnits * weeks;
    const forecast = econ.planUnits * share;
    const u = started ? unitsIn(A, l.upc, d.startDate, to) : { units: 0, sales: 0, covered: 0 };
    const p = started ? purchasesIn(A, l.upc, d.startDate, to) : { cases: 0, cost: 0 };
    actual += u.units; coveredW += u.covered * share;
    offInvoice += u.units * c.oiPU; billVar += u.units * (c.bbPU + c.rsPU); wholesaler += u.units * c.whPU; purchases += p.cost;
    // Baseline for the days that have actually run, so a deal still in progress compares like with like.
    const baseToDate = started ? l.baseWeeklyUnits * weeksIn(d.startDate, to) : 0;
    if (u.covered > 0) { promoGM += u.units * (c.promo - c.netUnitCost); baseGM += baseToDate * (l.regularRetail - c.unitCost); }
    return { upc: l.upc, description: (l as { description?: string }).description ?? '', baseline, baseToDate, forecast, forecastToDate: forecast * (started ? weeksIn(d.startDate, to) / weeks : 0), actual: u.covered > 0 ? u.units : null, covered: u.covered, lift: u.covered > 0 && baseToDate > 0 ? u.units / baseToDate - 1 : null };
  });
  const hasData = coveredW > 0;
  const adEarned = started ? d.adFee : 0;
  const accrual = d.accrualPct * purchases;
  const earned = offInvoice + billVar + wholesaler + adEarned + accrual;
  const billable = billVar + adEarned + accrual;
  const committedBillable = (econ.lines.reduce((s, l) => s + (l.calc.bbPU + l.calc.rsPU) * econ.planUnits * Math.max(1, l.baseWeeklyUnits) / W, 0)) + d.adFee + d.accrualPct * econ.planUnits * econ.cost;
  const committedAccrual = d.accrualPct * econ.planUnits * econ.cost;
  const mine = bills.filter(b => b.dealNumber === d.number);
  const billed = mine.reduce((s, b) => s + b.billed, 0), collected = mine.reduce((s, b) => s + b.collected, 0);
  const tol = Math.max(5, billable * 0.01);
  let status: BillingStatus;
  if (!started) status = 'Not started';
  else if (mine.some(b => b.status === 'DISPUTED')) status = 'Disputed';
  else if (!ended) status = 'Running';
  else if (committedBillable <= 0.5 && billed === 0) status = 'Off-invoice only';
  else if (!hasData && d.accrualPct === 0 && billed === 0 && d.adFee === 0) status = 'Waiting for sales data';
  else if (billed === 0 && billable > tol) status = 'Ready to bill';
  else if (billed < billable - tol) status = 'Under-billed';
  else if (billed > billable + tol) status = 'Over-billed';
  else status = billed > 0 && collected >= billed - 1 ? 'Collected' : 'Billed in full';
  const elapsed = !started ? 0 : ended ? 1 : (t(today) - t(d.startDate)) / Math.max(DAY, t(d.endDate) - t(d.startDate));
  const claimBy = iso(t(d.endDate) + claimDays * DAY);
  return {
    number: d.number, econ, type: econ.type, started, ended, elapsed, hasData, coverage: coveredW, lines,
    baseline: econ.baseUnits, forecast: econ.planUnits, actual: hasData ? actual : null,
    committed: econ.totalFunds, committedBillable, committedAccrual,
    earned, billable, offInvoice, wholesaler, adEarned, accrual, purchases,
    billed, collected, open: billed - collected, gap: billable - billed, status, bills: mine,
    promoGM, baseGM, claimBy,
  };
}
export type DealMeasure = ReturnType<typeof measureDeal>;

export type AccrualStatus = 'Not started' | 'Earning' | 'Ready to bill' | 'Expiring' | 'Expired unbilled' | 'Fully billed';
export const ACCRUAL_TONE: Record<AccrualStatus, string> = { 'Not started': '', Earning: 'info', 'Ready to bill': 'warn', Expiring: 'bad', 'Expired unbilled': 'bad', 'Fully billed': 'good' };

/** Accrual view of a measured deal: earned to date vs committed, balance left to bill, claim deadline. */
export function accrualView(m: DealMeasure, today: string) {
  const balance = Math.max(0, m.billable - m.billed);
  const daysToClaim = Math.round((t(m.claimBy) - t(today)) / DAY);
  const tol = Math.max(5, m.billable * 0.01);
  let status: AccrualStatus;
  if (!m.started) status = 'Not started';
  else if (!m.ended) status = 'Earning';
  else if (balance <= tol) status = 'Fully billed';
  else if (daysToClaim < 0) status = 'Expired unbilled';
  else if (daysToClaim <= 30) status = 'Expiring';
  else status = 'Ready to bill';
  const expected = m.committedAccrual * m.elapsed;
  return { status, balance, daysToClaim, pace: expected > 0 ? m.accrual / expected : null, pctOfCommit: m.committedAccrual > 0 ? m.accrual / m.committedAccrual : null };
}

/** Event performance: funding target vs committed/earned/billed/collected, lift and margin. Accrual deals count toward funding, not lift. */
export function measureEvent(
  e: { startDate: string; endDate: string; fundingTarget: number; mediaBudget: number },
  ms: DealMeasure[],
  promos: { lines: { upc: string; unitCost: number; regularRetail: number; promoRetail: number; baseWeeklyUnits: number }[] }[],
  A: Actuals, today: string,
) {
  const sum = (f: (m: DealMeasure) => number) => ms.reduce((s, m) => s + f(m), 0);
  const promoMs = ms.filter(m => m.type !== 'ACCR');
  const started = today >= e.startDate, to = minIso(e.endDate, today);
  const weeks = weeksIn(e.startDate, e.endDate), elapsedWeeks = started ? weeksIn(e.startDate, to) : 0;
  let baseline = sum(m => m.type === 'ACCR' ? 0 : m.baseline), forecast = sum(m => m.type === 'ACCR' ? 0 : m.forecast);
  let actual = 0, baseToDate = 0, covered = false;
  let promoGM = sum(m => m.type === 'ACCR' ? 0 : m.promoGM), baseGM = sum(m => m.type === 'ACCR' ? 0 : m.baseGM);
  let fcToDate = 0;
  for (const m of promoMs) for (const l of m.lines) if (l.actual != null) { actual += l.actual; baseToDate += l.baseToDate; fcToDate += l.forecastToDate; covered = true; }
  for (const p of promos) for (const l of p.lines) {
    const depth = l.regularRetail ? (l.regularRetail - l.promoRetail) / l.regularRetail : 0;
    const lift = 0.45 * Math.pow(Math.max(depth, 0.05) / 0.25, 0.8);
    baseline += l.baseWeeklyUnits * weeks; forecast += l.baseWeeklyUnits * weeks * (1 + lift);
    if (started) { const u = unitsIn(A, l.upc, e.startDate, to); if (u.covered > 0) { actual += u.units; baseToDate += l.baseWeeklyUnits * elapsedWeeks; fcToDate += l.baseWeeklyUnits * elapsedWeeks * (1 + lift); covered = true; promoGM += u.units * (l.promoRetail - l.unitCost); baseGM += l.baseWeeklyUnits * elapsedWeeks * (l.regularRetail - l.unitCost); } }
  }
  const fees = sum(m => m.adEarned + m.accrual);
  const incGM = covered ? promoGM + fees - baseGM : null;
  const vendorEarned = sum(m => m.earned);
  const incUnits = covered ? actual - baseToDate : null;
  return {
    target: e.fundingTarget, committed: sum(m => m.committed), earned: vendorEarned, billable: sum(m => m.billable), billed: sum(m => m.billed), collected: sum(m => m.collected),
    baseline, forecast, actual: covered ? actual : null, baseToDate,
    forecastLift: baseline > 0 ? forecast / baseline - 1 : null,
    actualLift: covered && baseToDate > 0 ? actual / baseToDate - 1 : null,
    accuracy: covered && fcToDate > 0 ? actual / fcToDate : null,
    promoGM: covered ? promoGM : null, incGM, mediaBudget: e.mediaBudget,
    mediaReturn: incGM != null && e.mediaBudget > 0 ? incGM / e.mediaBudget : null,
    vendorPerIncUnit: incUnits && incUnits > 0 ? vendorEarned / incUnits : null,
    started, ended: today > e.endDate,
  };
}

/** Vendor scorecard from that vendor's deals and their measures. */
export function scorecard(
  ds: { status: string; submittedAt: Date | null; autoApproved: boolean; cutoff: string }[],
  ms: DealMeasure[], complianceScore: number,
) {
  const submitted = ds.filter(d => d.status !== 'DRAFT' && d.submittedAt);
  const approved = ds.filter(d => d.status === 'APPROVED');
  const onTime = submitted.filter(d => d.submittedAt!.toISOString().slice(0, 10) <= d.cutoff);
  const promo = ms.filter(m => m.type !== 'ACCR');
  const md = promo.reduce((s, m) => s + m.econ.markdown, 0), vf = promo.reduce((s, m) => s + m.econ.totalFunds, 0);
  const withData = promo.filter(m => m.actual != null && m.ended);
  const act = withData.reduce((s, m) => s + (m.actual ?? 0), 0);
  const fc = withData.reduce((s, m) => s + m.lines.reduce((a, l) => a + (l.actual != null ? l.forecastToDate : 0), 0), 0);
  const bl = withData.reduce((s, m) => s + m.lines.reduce((a, l) => a + (l.actual != null ? l.baseToDate : 0), 0), 0);
  const sum = (f: (m: DealMeasure) => number) => ms.reduce((s, m) => s + f(m), 0);
  const billed = sum(m => m.billed);
  const endedBillable = ms.filter(m => m.ended).reduce((s, m) => s + m.billable, 0);
  const endedBilled = ms.filter(m => m.ended).reduce((s, m) => s + m.billed, 0);
  return {
    submitted: submitted.length, approved: approved.length,
    approvalRate: submitted.length ? approved.length / submitted.length : null,
    autoRate: approved.length ? approved.filter(d => d.autoApproved).length / approved.length : null,
    onTimeRate: submitted.length ? onTime.length / submitted.length : null,
    committed: sum(m => m.committed), earned: sum(m => m.earned), billable: sum(m => m.billable), billed, collected: sum(m => m.collected),
    collectionRate: billed > 0 ? sum(m => m.collected) / billed : null,
    unbilled: Math.max(0, endedBillable - endedBilled),
    fundingShare: md > 0 ? vf / md : null,
    accuracy: fc > 0 ? act / fc : null, liftDelivered: bl > 0 ? act / bl - 1 : null,
    complianceScore, measuredDeals: withData.length,
  };
}

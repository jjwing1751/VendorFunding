import type { RuleValues } from '@/db/schema';

export const DEFAULT_RULES: RuleValues = {
  minGM: 0.25, minCov: 0.40, minLift: 0.20, minInc: 0, minScore: 0.90, maxAuto: 50000, maxOpt: 1.30,
  fullFund: 0.90, autoApprove: true, cutoffDays: 42, reviewDays: 3, claimDays: 90,
};
export const RULE_FIELDS: { key: keyof RuleValues; label: string; kind: 'pct' | 'money' | 'num' | 'days' | 'bool' }[] = [
  { key: 'minGM', label: 'Minimum promo gross margin', kind: 'pct' },
  { key: 'minCov', label: 'Minimum vendor share of markdown', kind: 'pct' },
  { key: 'minLift', label: 'Minimum forecast lift', kind: 'pct' },
  { key: 'minInc', label: 'Minimum incremental gross margin ($)', kind: 'money' },
  { key: 'minScore', label: 'Minimum vendor compliance score', kind: 'num' },
  { key: 'maxAuto', label: 'Auto-approval cap: total funding ($)', kind: 'money' },
  { key: 'maxOpt', label: 'Maximum vendor forecast ÷ model forecast', kind: 'num' },
  { key: 'fullFund', label: 'Vendor-funded threshold (share of markdown)', kind: 'pct' },
  { key: 'cutoffDays', label: 'Deal cutoff before event start (days)', kind: 'days' },
  { key: 'reviewDays', label: 'Category manager decision window (days)', kind: 'days' },
  { key: 'claimDays', label: 'Accrual claim window after the deal ends (days)', kind: 'days' },
  { key: 'autoApprove', label: 'Auto-approve deals that pass every rule', kind: 'bool' },
];

export type LineInput = {
  upc: string; casePack: number; caseCost: number; regularRetail: number; baseWeeklyUnits: number;
  cmap?: number; tpr?: number; ad?: number; billBack?: number; wholesalerScan?: number; retailerScan?: number;
  zone3Retail?: number | null; zone4Retail?: number | null; zone5Retail?: number | null;
};

const n = (v: unknown) => { const x = Number(v); return isFinite(x) ? x : 0; };

/** Mirrors the CAISSP spreadsheet: total off-invoice, deal case cost and net unit cost. */
export function lineCalc(l: LineInput) {
  const pack = n(l.casePack) || 1;
  const totOI = n(l.cmap) + n(l.tpr) + n(l.ad);
  const dealCaseCost = n(l.caseCost) - totOI - n(l.billBack) - n(l.wholesalerScan) * pack - n(l.retailerScan) * pack;
  const netUnitCost = dealCaseCost / pack;
  const unitCost = n(l.caseCost) / pack;
  const promo = n(l.zone4Retail) || n(l.zone5Retail) || n(l.zone3Retail) || n(l.regularRetail);
  const oiPU = totOI / pack, bbPU = n(l.billBack) / pack, rsPU = n(l.retailerScan), whPU = n(l.wholesalerScan);
  const vendorPU = oiPU + bbPU + rsPU;
  const markdownPU = Math.max(0, n(l.regularRetail) - promo);
  const share = markdownPU > 0 ? (vendorPU + whPU) / markdownPU : null;
  const promoGM = promo ? (promo - netUnitCost) / promo : 0;
  return { pack, totOI, dealCaseCost, netUnitCost, unitCost, promo, oiPU, bbPU, rsPU, whPU, vendorPU, markdownPU, share, promoGM };
}

export type DealType = 'OI' | 'BB' | 'SCAN' | 'AD' | 'ACCR';
export const DEAL_TYPE_LABEL: Record<DealType, string> = { OI: 'Off-invoice', BB: 'Bill-back', SCAN: 'Scan / TPR', AD: 'Ad & display fee', ACCR: 'Accrual' };
const DEFAULT_LIFT: Record<DealType, number> = { OI: 0.18, BB: 0.35, SCAN: 0.45, AD: 0.30, ACCR: 0.06 };

export const weeksIn = (a: string, b: string) => (Math.round((Date.parse(b) - Date.parse(a)) / 86400000) + 1) / 7;

export type DealInput = { lines: LineInput[]; startDate: string; endDate: string; adFee: number; accrualPct: number; forecastUnits?: number | null };

/** Unit-weighted aggregate across UPC lines plus the deal-level forecast and economics. */
export function dealEcon(d: DealInput) {
  const weeks = weeksIn(d.startDate, d.endDate);
  let W = 0; const a = { cost: 0, retail: 0, promo: 0, oi: 0, bb: 0, rs: 0, wh: 0, net: 0 };
  const lines = d.lines.map(l => {
    const c = lineCalc(l); const w = Math.max(1, n(l.baseWeeklyUnits));
    W += w; a.cost += w * c.unitCost; a.retail += w * n(l.regularRetail); a.promo += w * c.promo;
    a.oi += w * c.oiPU; a.bb += w * c.bbPU; a.rs += w * c.rsPU; a.wh += w * c.whPU; a.net += w * c.netUnitCost;
    return { ...l, calc: c };
  });
  W = W || 1;
  const cost = a.cost / W, retail = a.retail / W, promo = a.promo / W;
  const vendorPU = (a.oi + a.bb + a.rs) / W, whPU = a.wh / W;
  const type: DealType = d.accrualPct > 0 ? 'ACCR' : d.adFee > 0 ? 'AD' : (a.rs + a.wh) > 0 ? 'SCAN' : a.bb > 0 ? 'BB' : 'OI';
  const depth = retail ? (retail - promo) / retail : 0;
  const lift = type === 'ACCR' ? DEFAULT_LIFT.ACCR : DEFAULT_LIFT[type] * Math.pow(Math.max(depth, 0.05) / 0.25, 0.8);
  const baseUnits = Math.round(W * weeks);
  const modelUnits = Math.round(baseUnits * (1 + lift));
  const forecast = d.forecastUnits && d.forecastUnits > 0 ? d.forecastUnits : modelUnits;
  const planUnits = Math.min(forecast, Math.round(modelUnits * 1.1));
  const markdownPU = Math.max(0, retail - promo);
  const accr = d.accrualPct * planUnits * cost;
  const vendorFunds = vendorPU * planUnits + d.adFee + accr;
  const whFunds = whPU * planUnits;
  const markdown = markdownPU * planUnits;
  const netCost = cost - vendorPU - whPU;
  const promoGM = promo ? (promo - netCost) / promo : 0;
  const coverage = markdownPU > 0 ? (vendorPU + whPU) / markdownPU : null;
  const incGM = planUnits * (promo - netCost) + d.adFee + accr - baseUnits * (retail - cost);
  return { lines, type, cost, retail, promo, vendorPU, whPU, depth, lift, baseUnits, modelUnits, forecast, planUnits, markdown, vendorFunds, whFunds, totalFunds: vendorFunds + whFunds, netCost, promoGM, coverage, incGM, optimism: forecast / Math.max(1, modelUnits) };
}

export type FundClass = 'Vendor funded' | 'Shared' | 'Retailer funded';
export function classifyFunding(markdown: number, vendorFunds: number, threshold: number): { cls: FundClass; share: number } {
  if (vendorFunds <= 0) return { cls: 'Retailer funded', share: 0 };
  if (markdown <= 0) return { cls: 'Vendor funded', share: 1 };
  const share = vendorFunds / markdown;
  return { cls: share >= threshold ? 'Vendor funded' : 'Shared', share: Math.min(1, share) };
}

export type Check = { key: string; label: string; value: string; pass: boolean };
export type Evaluation = { checks: Check[]; fails: Check[]; rec: 'Approve' | 'Counter' | 'Review' | 'Reject'; reason: string; counterRate: number | null; score: number; econ: ReturnType<typeof dealEcon> };

const pctS = (x: number | null) => x == null ? '—' : (x * 100).toFixed(0) + '%';
const moneyS = (x: number) => (x < 0 ? '−$' : '$') + Math.abs(Math.round(x)).toLocaleString('en-US');

export function evaluate(d: DealInput, ctx: { rules: RuleValues; complianceScore: number; event: { startDate: string; endDate: string } | null; overlaps: string[]; unknownUpcs: string[] }): Evaluation {
  const r = ctx.rules, e = dealEcon(d);
  const isA = e.type === 'ACCR';
  const fit = !!ctx.event && (isA || (d.startDate >= ctx.event.startDate && d.endDate <= ctx.event.endDate));
  const all: (Check & { na?: boolean })[] = [
    { key: 'lines', label: 'At least one UPC line', value: String(d.lines.length), pass: d.lines.length > 0 },
    { key: 'upc', label: 'Every UPC is in the item master', value: ctx.unknownUpcs.length ? ctx.unknownUpcs.length + ' unknown' : 'All found', pass: !ctx.unknownUpcs.length },
    { key: 'gm', label: `Promo gross margin ≥ ${pctS(r.minGM)}`, value: pctS(e.promoGM), pass: e.promoGM >= r.minGM, na: isA },
    { key: 'cov', label: `Vendor funds ≥ ${pctS(r.minCov)} of the markdown`, value: pctS(e.coverage), pass: e.coverage == null || e.coverage >= r.minCov, na: isA },
    { key: 'lift', label: `Forecast lift ≥ ${pctS(r.minLift)}`, value: pctS(e.lift), pass: e.lift >= r.minLift, na: isA },
    { key: 'inc', label: `Incremental gross margin ≥ ${moneyS(r.minInc)}`, value: moneyS(e.incGM), pass: e.incGM >= r.minInc },
    { key: 'opt', label: `Vendor forecast ≤ ${pctS(r.maxOpt)} of model`, value: pctS(e.optimism), pass: e.optimism <= r.maxOpt, na: isA || !d.forecastUnits },
    { key: 'vs', label: `Vendor compliance score ≥ ${r.minScore.toFixed(2)}`, value: ctx.complianceScore.toFixed(2), pass: ctx.complianceScore >= r.minScore },
    { key: 'cap', label: `Total funding ≤ ${moneyS(r.maxAuto)} auto-approval cap`, value: moneyS(e.totalFunds), pass: e.totalFunds <= r.maxAuto },
    { key: 'fit', label: 'Dates fit inside the event', value: fit ? 'Yes' : 'No', pass: fit },
    { key: 'ovl', label: 'No other active deal on these UPCs for the same dates', value: ctx.overlaps.length ? ctx.overlaps.join(', ') : 'Clear', pass: !ctx.overlaps.length, na: isA },
  ];
  const checks = all.filter(c => !c.na).map(({ na, ...c }) => c);
  const fails = checks.filter(c => !c.pass);
  let rec: Evaluation['rec'] = 'Approve', reason = 'Passes every rule.', counterRate: number | null = null;
  if (fails.length) {
    const md = Math.max(0, e.retail - e.promo);
    const fixable = fails.every(f => ['gm', 'cov', 'inc'].includes(f.key)) && !isA && md > 0;
    if (fixable) {
      const otherPU = e.whPU;
      const needCov = r.minCov * md - otherPU;
      const needGM = e.cost - e.promo * (1 - r.minGM) - otherPU;
      const needInc = (r.minInc + e.baseUnits * (e.retail - e.cost) - d.adFee - e.planUnits * (e.promo - e.cost + otherPU)) / Math.max(1, e.planUnits);
      counterRate = Math.ceil(Math.max(needCov, needGM, needInc, e.vendorPU + 0.05) * 20) / 20;
      rec = 'Counter';
      reason = `Raise vendor funding to about $${counterRate.toFixed(2)} per unit (weighted across UPCs) to pass ${fails.map(f => f.key === 'gm' ? 'margin' : f.key === 'cov' ? 'coverage' : 'incremental margin').join(' and ')}.`;
    } else if (fails.some(f => f.key === 'fit' || f.key === 'lines' || f.key === 'upc')) {
      rec = 'Reject'; reason = fails.filter(f => ['fit', 'lines', 'upc'].includes(f.key)).map(f => f.label).join('; ') + ' — fix before it can be approved.';
    } else { rec = 'Review'; reason = 'Needs a decision: ' + fails.map(f => f.label.toLowerCase()).join('; ') + '.'; }
  }
  return { checks, fails, rec, reason, counterRate, score: Math.round(100 * checks.filter(c => c.pass).length / Math.max(1, checks.length)), econ: e };
}

export function promoEcon(lines: { unitCost: number; regularRetail: number; promoRetail: number; baseWeeklyUnits: number }[], startDate: string, endDate: string) {
  const weeks = weeksIn(startDate, endDate);
  let units = 0, md = 0, gm = 0;
  for (const l of lines) {
    const depth = l.regularRetail ? (l.regularRetail - l.promoRetail) / l.regularRetail : 0;
    const lift = DEFAULT_LIFT.SCAN * Math.pow(Math.max(depth, 0.05) / 0.25, 0.8);
    const u = Math.round(l.baseWeeklyUnits * weeks * (1 + lift));
    units += u; md += Math.max(0, l.regularRetail - l.promoRetail) * u; gm += (l.promoRetail - l.unitCost) * u;
  }
  return { units, markdown: md, promoGMDollars: gm };
}

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyFunding, dealEcon, evaluate, lineCalc } from '../src/lib/economics';

const base = { upc: '0-85390-10011', casePack: 12, caseCost: 25.20, regularRetail: 4.29, baseWeeklyUnits: 700 };

test('lineCalc matches the CAISSP spreadsheet formulas', () => {
  // Deal Case Cost = Case Cost − Total OI − Bill Back − (Wholesaler scan × pack) − (Unit scan × pack)
  const c = lineCalc({ ...base, cmap: 1, tpr: 6, ad: 0.5, billBack: 1.2, wholesalerScan: 0.1, retailerScan: 0.4, zone4Retail: 2.79 });
  assert.equal(c.totOI, 7.5);
  assert.ok(Math.abs(c.dealCaseCost - (25.20 - 7.5 - 1.2 - 0.1 * 12 - 0.4 * 12)) < 1e-9);
  assert.ok(Math.abs(c.netUnitCost - c.dealCaseCost / 12) < 1e-9);
  assert.equal(c.promo, 2.79);
});

test('funding classification thresholds', () => {
  assert.equal(classifyFunding(1000, 0, 0.9).cls, 'Retailer funded');
  assert.equal(classifyFunding(1000, 500, 0.9).cls, 'Shared');
  assert.equal(classifyFunding(1000, 950, 0.9).cls, 'Vendor funded');
  assert.equal(classifyFunding(0, 500, 0.9).cls, 'Vendor funded');
});

test('deal type and recommendation', () => {
  const d = { lines: [{ ...base, tpr: 6, retailerScan: 0.45, zone4Retail: 2.5 }], startDate: '2027-01-27', endDate: '2027-02-08', adFee: 0, accrualPct: 0 };
  const e = dealEcon(d);
  assert.equal(e.type, 'SCAN');
  const rules = { minGM: 0.25, minCov: 0.4, minLift: 0.2, minInc: 0, minScore: 0.9, maxAuto: 50000, maxOpt: 1.3, fullFund: 0.9, autoApprove: true, cutoffDays: 42, reviewDays: 3, claimDays: 90 };
  const ev = evaluate(d, { rules, complianceScore: 0.97, event: { startDate: '2027-01-27', endDate: '2027-02-08' }, overlaps: [], unknownUpcs: [] });
  assert.equal(ev.rec, 'Approve');
  const weak = evaluate({ ...d, lines: [{ ...base, retailerScan: 0.1, zone4Retail: 2.5 }] }, { rules, complianceScore: 0.97, event: { startDate: '2027-01-27', endDate: '2027-02-08' }, overlaps: [], unknownUpcs: [] });
  assert.equal(weak.rec, 'Counter');
  assert.ok(weak.counterRate! > 0.1);
});

test('dates outside the event are rejected', () => {
  const d = { lines: [{ ...base, retailerScan: 1, zone4Retail: 2.5 }], startDate: '2027-01-01', endDate: '2027-02-08', adFee: 0, accrualPct: 0 };
  const rules = { minGM: 0.25, minCov: 0.4, minLift: 0.2, minInc: -1e9, minScore: 0.9, maxAuto: 50000, maxOpt: 1.3, fullFund: 0.9, autoApprove: true, cutoffDays: 42, reviewDays: 3, claimDays: 90 };
  const ev = evaluate(d, { rules, complianceScore: 0.97, event: { startDate: '2027-01-27', endDate: '2027-02-08' }, overlaps: [], unknownUpcs: [] });
  assert.equal(ev.rec, 'Reject');
});

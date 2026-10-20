import { test } from 'node:test';
import assert from 'node:assert/strict';
import { accrualView, indexActuals, measureDeal, measureEvent, mondayOf, scorecard, unitsIn } from '../src/lib/measure';

const line = { upc: 'U1', casePack: 12, caseCost: 24, regularRetail: 4, baseWeeklyUnits: 100, tpr: 2.4, billBack: 1.2, retailerScan: 0.3, zone4Retail: 3 };
const deal = { number: 'DL-1', status: 'APPROVED', vendorId: 'v', eventId: 'e', startDate: '2026-03-02', endDate: '2026-03-15', adFee: 500, accrualPct: 0, forecastUnits: null, lines: [line] };
const A = indexActuals([{ upc: 'U1', weekStart: '2026-03-02', units: 180 }, { upc: 'U1', weekStart: '2026-03-09', units: 160 }], []);
const near = (a: number, b: number, eps = 0.01) => assert.ok(Math.abs(a - b) < eps, `${a} ≈ ${b}`);

test('weeks start Monday', () => {
  assert.equal(mondayOf('2026-03-04'), '2026-03-02');
  assert.equal(mondayOf('2026-03-08'), '2026-03-02');
  assert.equal(mondayOf('2026-03-09'), '2026-03-09');
});

test('partial weeks are prorated by day', () => {
  const u = unitsIn(A, 'U1', '2026-03-04', '2026-03-10'); // 5 days of week 1, 2 days of week 2
  near(u.units, 180 * 5 / 7 + 160 * 2 / 7);
  near(u.covered, 1);
});

test('earned, billable and billing status', () => {
  const m = measureDeal(deal, A, [{ dealNumber: 'DL-1', billed: 600, collected: 600, status: 'PAID' }], '2026-04-01');
  assert.equal(m.actual, 340);
  near(m.offInvoice, 340 * 0.2);          // TPR $2.40/case ÷ 12 = $0.20/unit, taken off invoice
  near(m.billable, 340 * (0.1 + 0.3) + 500); // bill-back $0.10/unit + scan $0.30 + ad fee
  near(m.earned, 340 * 0.6 + 500);
  near(m.lines[0].lift!, 340 / 200 - 1);   // baseline 100/week × 2 weeks
  assert.equal(m.status, 'Under-billed');  // $636 billable, $600 billed
  assert.equal(measureDeal(deal, A, [{ dealNumber: 'DL-1', billed: 636, collected: 636, status: 'PAID' }], '2026-04-01').status, 'Collected');
  assert.equal(measureDeal(deal, A, [{ dealNumber: 'DL-1', billed: 636, collected: 0, status: 'OPEN' }], '2026-04-01').status, 'Billed in full');
  assert.equal(measureDeal(deal, A, [], '2026-04-01').status, 'Ready to bill');
  assert.equal(measureDeal(deal, A, [], '2026-03-10').status, 'Running');
  assert.equal(measureDeal(deal, A, [], '2026-02-01').status, 'Not started');
  assert.equal(measureDeal(deal, A, [{ dealNumber: 'DL-1', billed: 636, collected: 0, status: 'DISPUTED' }], '2026-04-01').status, 'Disputed');
});

test('accruals earn % of purchases and expire after the claim window', () => {
  const acc = { ...deal, number: 'DL-2', adFee: 0, accrualPct: 0.03, lines: [{ ...line, tpr: 0, billBack: 0, retailerScan: 0, zone4Retail: 4 }] };
  const R = indexActuals([], [{ upc: 'U1', weekStart: '2026-03-02', cases: 40, cost: 1000 }, { upc: 'U1', weekStart: '2026-03-09', cases: 80, cost: 2000 }]);
  const running = measureDeal(acc, R, [], '2026-03-08');
  near(running.accrual, 0.03 * 1000);      // first week only
  assert.equal(accrualView(running, '2026-03-08').status, 'Earning');
  const done = measureDeal(acc, R, [{ dealNumber: 'DL-2', billed: 30, collected: 30, status: 'PAID' }], '2026-05-01', 90);
  near(done.accrual, 90); near(accrualView(done, '2026-05-01').balance, 60);
  assert.equal(done.claimBy, '2026-06-13');
  assert.equal(accrualView(done, '2026-05-01').status, 'Ready to bill');
  assert.equal(accrualView(measureDeal(acc, R, [], '2026-06-01', 90), '2026-06-01').status, 'Expiring');
  assert.equal(accrualView(measureDeal(acc, R, [], '2026-07-01', 90), '2026-07-01').status, 'Expired unbilled');
  assert.equal(accrualView(measureDeal(acc, R, [{ dealNumber: 'DL-2', billed: 90, collected: 0, status: 'OPEN' }], '2026-07-01', 90), '2026-07-01').status, 'Fully billed');
});

test('event performance and vendor scorecard', () => {
  const m = measureDeal(deal, A, [{ dealNumber: 'DL-1', billed: 636, collected: 300, status: 'PARTIAL' }], '2026-04-01');
  const ev = measureEvent({ startDate: '2026-03-02', endDate: '2026-03-15', fundingTarget: 1000, mediaBudget: 400 }, [m], [], A, '2026-04-01');
  assert.equal(ev.target, 1000); near(ev.billed, 636); near(ev.collected, 300);
  assert.equal(ev.actual, 340); near(ev.actualLift!, 0.7);
  // promo GM: 340 × ($3.00 − net unit cost); net = (24 − 2.4 − 1.2 − 0.3×12)/12 = $1.40
  near(ev.promoGM!, 340 * (3 - 1.4));
  near(ev.incGM!, 340 * 1.6 + 500 - 200 * (4 - 2));
  near(ev.mediaReturn!, ev.incGM! / 400);
  const sc = scorecard([{ status: 'APPROVED', submittedAt: new Date('2026-01-10T12:00:00Z'), autoApproved: true, cutoff: '2026-01-19' }], [m], 0.95);
  assert.equal(sc.onTimeRate, 1); assert.equal(sc.autoRate, 1); near(sc.collectionRate!, 300 / 636);
  near(sc.liftDelivered!, 0.7);
});

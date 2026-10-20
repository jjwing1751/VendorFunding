/* Fictional "Northfield Market" demo data and shared demo accounts.
   Used by the startup seed (scripts/seed.ts) and by Admin → Demo data → Reset.
   No server-only imports: this file runs under tsx at startup as well as inside Next.js. */
import { and, eq, inArray, notInArray, sql } from 'drizzle-orm';
import type { PgDatabase } from 'drizzle-orm/pg-core';
import * as s from '../db/schema';
import { DEFAULT_ROLES } from './permissions';
import { DEFAULT_RULES, dealEcon, type LineInput } from './economics';
import { indexActuals, measureDeal, mondayOf, type MDeal, type WeekRow, type ReceiptRow } from './measure';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = PgDatabase<any, typeof s>;

/** Demo sign-in is on when DEMO_ACCOUNTS=true, or (by default) whenever SEED_DEMO=true. */
export function demoEnabled() {
  const v = process.env.DEMO_ACCOUNTS ?? process.env.SEED_DEMO ?? 'true';
  return v === 'true';
}

export type DemoUser = { email: string; name: string; role: string; vendorNumber?: string; categories?: string[]; blurb: string };

/** One shared account per built-in role. `.test` addresses can never receive real email. */
export const DEMO_USERS: DemoUser[] = [
  { email: 'avery.admin@northfield.test', name: 'Avery Admin', role: 'Admin', blurb: 'Users, roles, vendors, audit, demo reset' },
  { email: 'dana.director@northfield.test', name: 'Dana Whitfield', role: 'Category director', blurb: 'All categories, rule exceptions, approval rules, events' },
  { email: 'casey.cm@northfield.test', name: 'Casey Morgan', role: 'Category manager', categories: ['Salty Snacks', 'Candy', 'Breakfast', 'Center Store Meals'], blurb: 'Approve, counter and note deals; ask vendors for funding' },
  { email: 'fran.finance@northfield.test', name: 'Fran Ortiz', role: 'Finance / AR', blurb: 'Funding vs. billed, Bill Back Manager files, accruals' },
  { email: 'ivy.items@northfield.test', name: 'Ivy Chen', role: 'Item setup', blurb: 'Item master by UPC' },
  { email: 'andre.analyst@northfield.test', name: 'Andre Lewis', role: 'Analyst (read only)', blurb: 'Read-only: calendar, deal economics, audit' },
  { email: 'kim.brandt@prairiegold.test', name: 'Kim Brandt', role: 'Vendor admin', vendorNumber: '01004410', blurb: 'Prairie Gold Snacks: team, CAISSP deals' },
  { email: 'pat.haas@harvesttable.test', name: 'Pat Haas', role: 'Vendor user', vendorNumber: '01004430', blurb: 'Harvest Table Foods: respond to a counter-offer' },
  { email: 'tara.greer@summithome.test', name: 'Tara Greer', role: 'Vendor viewer', vendorNumber: '01004460', blurb: 'Summit Home Care: view only' },
];
export const isBuiltInDemo = (email: string) => DEMO_USERS.some(d => d.email === email.toLowerCase());

const V = [
  ['01004410', 'Prairie Gold Snacks', 'Great Plains Brokerage', 'Salty Snacks', 'DEDUCTION', 0.97],
  ['01004420', 'Lakeshore Beverage Co.', null, 'Beverages', 'INVOICE', 0.95],
  ['01004430', 'Harvest Table Foods', 'Great Plains Brokerage', 'Center Store Meals', 'INVOICE', 0.92],
  ['01004440', 'Bright Morning Cereal', 'Heartland Sales Group', 'Breakfast', 'INVOICE', 0.91],
  ['01004450', 'Cedar Ridge Dairy', null, 'Dairy', 'DEDUCTION', 0.88],
  ['01004460', 'Summit Home Care', 'Heartland Sales Group', 'Household', 'INVOICE', 0.94],
  ['01004470', 'Blue Heron Coffee', null, 'Coffee & Tea', 'INVOICE', 0.98],
  ['01004480', 'Pinecone Pet Supply', 'Northstar Marketing', 'Pet', 'INVOICE', 0.90],
  ['01004490', 'Maple Street Confections', 'Northstar Marketing', 'Candy', 'DEDUCTION', 0.93],
] as const;

const I: [string, string | null, string, string, string, string, number, number, number, number][] = [
  ['0-85390-10011', '01004410', 'PRAIRIE GOLD KETTLE CHIPS SEA SALT', '8', 'OZ', 'PG10011', 12, 25.20, 4.29, 700],
  ['0-85390-10012', '01004410', 'PRAIRIE GOLD KETTLE CHIPS JALAPENO', '8', 'OZ', 'PG10012', 12, 25.20, 4.29, 550],
  ['0-85390-10013', '01004410', 'PRAIRIE GOLD KETTLE CHIPS BBQ', '8', 'OZ', 'PG10013', 12, 25.20, 4.29, 550],
  ['0-85390-10021', '01004410', 'PRAIRIE GOLD TORTILLA CHIPS REST STYLE', '13', 'OZ', 'PG10021', 12, 22.80, 3.99, 800],
  ['0-71240-20011', '01004420', 'LAKESHORE SPARKLING WATER LIME 12PK', '144', 'FZ', 'LS20011', 2, 6.80, 6.49, 1300],
  ['0-71240-20012', '01004420', 'LAKESHORE SPARKLING WATER GRAPEFRUIT 12PK', '144', 'FZ', 'LS20012', 2, 6.80, 6.49, 1300],
  ['0-71240-20031', '01004420', 'LAKESHORE COLA 12PK CANS', '144', 'FZ', 'LS20031', 2, 6.20, 6.99, 1500],
  ['0-44710-30011', '01004430', 'HARVEST TABLE SKILLET LASAGNA', '6.4', 'OZ', 'HT30011', 12, 12.60, 2.19, 700],
  ['0-44710-30012', '01004430', 'HARVEST TABLE SKILLET CHEDDAR MAC', '6.4', 'OZ', 'HT30012', 12, 12.60, 2.19, 700],
  ['0-44710-30041', '01004430', 'HARVEST TABLE HOLIDAY STUFFING', '6', 'OZ', 'HT30041', 12, 14.40, 2.49, 1400],
  ['0-61880-40011', '01004440', 'BRIGHT MORNING HONEY OAT CEREAL', '18', 'OZ', 'BM40011', 10, 26.00, 4.99, 1200],
  ['0-61880-40012', '01004440', 'BRIGHT MORNING WHOLE GRAIN FLAKES', '14', 'OZ', 'BM40012', 10, 26.00, 4.99, 1200],
  ['0-27350-50011', '01004450', 'CEDAR RIDGE GREEK YOGURT VANILLA 4PK', '21.2', 'OZ', 'CR50011', 6, 13.20, 3.99, 1050],
  ['0-27350-50012', '01004450', 'CEDAR RIDGE GREEK YOGURT STRAWBERRY 4PK', '21.2', 'OZ', 'CR50012', 6, 13.20, 3.99, 1050],
  ['0-36020-60011', '01004460', 'SUMMIT MULTI-SURFACE CLEANER', '32', 'FZ', 'SH60011', 6, 18.60, 5.49, 700],
  ['0-36020-60012', '01004460', 'SUMMIT MULTI-SURFACE CLEANER LEMON', '32', 'FZ', 'SH60012', 6, 18.60, 5.49, 700],
  ['0-81230-70011', '01004470', 'BLUE HERON BREAKFAST BLEND GROUND', '12', 'OZ', 'BH70011', 6, 37.20, 10.99, 800],
  ['0-79310-80011', '01004480', 'PINECONE DENTAL CHEWS MEDIUM', '12', 'CT', 'PC80011', 6, 24.60, 7.99, 450],
  ['0-41420-90011', '01004490', 'MAPLE STREET FUN SIZE ASSORTMENT', '10', 'OZ', 'MS90011', 12, 28.80, 4.49, 2500],
  ['0-41420-90012', '01004490', 'MAPLE STREET HOLIDAY TOFFEE TIN', '8', 'OZ', 'MS90012', 6, 18.00, 5.99, 1000],
  ['0-41000-12001', null, 'NORTHFIELD HOT DOG BUNS 8CT', '12', 'OZ', 'NF12001', 12, 11.40, 2.29, 1400],
  ['0-41000-12002', null, 'NORTHFIELD BRAT BUNS 6CT', '15', 'OZ', 'NF12002', 12, 11.40, 2.29, 1200],
  ['2-04512-00000', null, 'FROZEN WHOLE TURKEY 12-16 LB (PER LB)', '1', 'LB', 'MT04512', 1, 1.15, 1.79, 9000],
];

// [name, days from today to start, length in days, theme, vehicles, media $, funding target $, status]
// Harvest Feast's deal cutoff (42 days before start by default) lands about a week out, so it shows up as "lock soon".
const E: [string, number, number, string, string[], number, number, 'PLANNING' | 'LOCKED' | 'COMPLETED'][] = [
  ['Summer Grilling', -118, 21, 'Grill-out season', ['Circular p1', 'Endcaps', 'Social'], 18000, 35000, 'COMPLETED'],
  ['Back to School', -60, 21, 'Lunchbox and fast breakfast', ['Circular p1', 'Endcaps', 'Social'], 55000, 45000, 'COMPLETED'],
  ['Game Day Snacks', 10, 21, 'Game-day snacks and drinks', ['Circular p1', 'Endcaps', 'Retail media'], 50000, 30000, 'LOCKED'],
  ['Harvest Feast', 49, 16, 'Everything for the table', ['Circular wrap', 'Endcaps', 'Digital coupons'], 90000, 30000, 'PLANNING'],
  ['Holiday Entertaining', 66, 23, 'Hosting made easy', ['Circular p1', 'Endcaps', 'In-store sampling'], 80000, 40000, 'PLANNING'],
  ['New Year Reset', 93, 19, 'Better-for-you start', ['Circular p1', 'Digital coupons'], 35000, 15000, 'PLANNING'],
  ['Big Game', 118, 13, 'Party snacks and drinks', ['Circular p1', 'Endcaps', 'Retail media'], 65000, 70000, 'PLANNING'],
  ['Spring Cleaning', 152, 21, 'Fresh start for the home', ['Circular p2', 'Endcaps', 'Email'], 30000, 12000, 'PLANNING'],
];

type L = { upc: string; tpr?: number; billBack?: number; retailerScan?: number; wholesalerScan?: number; cmap?: number; promo: number };
type DD = { v: string; ev: string; title: string; status: 'DRAFT' | 'SUBMITTED' | 'SENT_BACK' | 'APPROVED'; lines: L[]; adFee?: number; signer: string; note?: string; counter?: number; auto?: boolean; by?: string;
  accrual?: number; from?: number; to?: number; sub?: number; real?: number };
// Deals 1–8 are the ones the walkthroughs use. 9–17 are completed or running deals with sales, receipts and billing
// so the funding, accrual and performance pages have history: `sub` = days before the event the deal was submitted,
// `real` = how much of its forecast lift the generated sales deliver, `from`/`to` = accrual dates (days from today).
const D: DD[] = [
  { v: '01004410', ev: 'Game Day Snacks', title: 'Game Day kettle chips', status: 'APPROVED', auto: true, signer: 'K. Brandt', lines: ['0-85390-10011', '0-85390-10012', '0-85390-10013'].map(u => ({ upc: u, tpr: 4.80, retailerScan: 0.40, promo: 2.79 })) },
  { v: '01004420', ev: 'Game Day Snacks', title: 'Cola 12-pack 3 for $13', status: 'APPROVED', by: 'Category manager', signer: 'D. Ruiz', lines: [{ upc: '0-71240-20031', billBack: 2.00, promo: 4.44 }] },
  { v: '01004490', ev: 'Holiday Entertaining', title: 'Holiday toffee tins', status: 'SUBMITTED', signer: 'H. Becker', lines: [{ upc: '0-41420-90012', billBack: 2.40, promo: 3.99 }] },
  { v: '01004440', ev: 'New Year Reset', title: 'Whole grain flakes reset', status: 'SUBMITTED', signer: 'L. Moreau', lines: [{ upc: '0-61880-40012', tpr: 4.00, retailerScan: 0.30, promo: 2.99 }] },
  { v: '01004410', ev: 'Big Game', title: 'Big Game kettle chips', status: 'SUBMITTED', signer: 'K. Brandt', lines: ['0-85390-10011', '0-85390-10012', '0-85390-10013'].map(u => ({ upc: u, tpr: 6.00, retailerScan: 0.45, promo: 2.50 })) },
  { v: '01004450', ev: 'New Year Reset', title: 'Greek yogurt feature', status: 'SUBMITTED', adFee: 12000, signer: 'A. Novak', lines: ['0-27350-50011', '0-27350-50012'].map(u => ({ upc: u, retailerScan: 0.30, promo: 3.33 })) },
  { v: '01004430', ev: 'Harvest Feast', title: 'Holiday stuffing', status: 'SENT_BACK', signer: 'P. Haas', note: 'Funding covers about 30% of the markdown. We need $0.45 per unit to hold margin.', counter: 0.45, by: 'Category manager', lines: [{ upc: '0-44710-30041', retailerScan: 0.25, promo: 1.67 }] },
  { v: '01004460', ev: 'Spring Cleaning', title: 'Spring cleaner endcap', status: 'DRAFT', signer: 'T. Greer', lines: ['0-36020-60011', '0-36020-60012'].map(u => ({ upc: u, cmap: 1.20, wholesalerScan: 0.30, retailerScan: 0.35, promo: 3.99 })) },
  { v: '01004410', ev: 'Summer Grilling', title: 'Summer kettle chips', status: 'APPROVED', auto: true, sub: 55, real: 1.15, signer: 'K. Brandt', lines: ['0-85390-10011', '0-85390-10012', '0-85390-10013'].map(u => ({ upc: u, tpr: 4.20, retailerScan: 0.35, promo: 2.99 })) },
  { v: '01004420', ev: 'Summer Grilling', title: 'Sparkling water 2 for $11', status: 'APPROVED', by: 'Casey Morgan', sub: 48, real: 0.75, signer: 'D. Ruiz', lines: ['0-71240-20011', '0-71240-20012'].map(u => ({ upc: u, billBack: 1.60, promo: 5.49 })) },
  { v: '01004470', ev: 'Summer Grilling', title: 'Breakfast blend feature', status: 'APPROVED', by: 'Dana Whitfield', sub: 30, real: 1.0, adFee: 6000, signer: 'R. Ito', lines: [{ upc: '0-81230-70011', retailerScan: 1.00, promo: 8.99 }] },
  { v: '01004440', ev: 'Back to School', title: 'Cereal back to school', status: 'APPROVED', auto: true, sub: 50, real: 1.3, signer: 'L. Moreau', lines: ['0-61880-40011', '0-61880-40012'].map(u => ({ upc: u, tpr: 5.00, retailerScan: 0.30, promo: 3.49 })) },
  { v: '01004430', ev: 'Back to School', title: 'Skillet meals lunchbox', status: 'APPROVED', by: 'Casey Morgan', sub: 46, real: 0.55, signer: 'P. Haas', lines: ['0-44710-30011', '0-44710-30012'].map(u => ({ upc: u, retailerScan: 0.40, promo: 1.67 })) },
  { v: '01004490', ev: 'Back to School', title: 'Fun size lunchbox', status: 'APPROVED', auto: true, sub: 60, real: 1.05, signer: 'H. Becker', lines: [{ upc: '0-41420-90011', billBack: 4.80, promo: 3.49 }] },
  { v: '01004450', ev: 'Back to School', title: 'Greek yogurt growth accrual', status: 'APPROVED', by: 'Dana Whitfield', sub: 70, accrual: 0.03, from: -120, to: 60, signer: 'A. Novak', lines: ['0-27350-50011', '0-27350-50012'].map(u => ({ upc: u, promo: 3.99 })) },
  { v: '01004480', ev: 'Summer Grilling', title: 'Dental chews annual accrual', status: 'APPROVED', by: 'Dana Whitfield', sub: 80, accrual: 0.04, from: -200, to: -20, signer: 'M. Lund', lines: [{ upc: '0-79310-80011', promo: 7.99 }] },
  { v: '01004460', ev: 'Summer Grilling', title: 'Cleaner growth accrual', status: 'APPROVED', by: 'Dana Whitfield', sub: 80, accrual: 0.025, from: -180, to: -75, signer: 'T. Greer', lines: ['0-36020-60011', '0-36020-60012'].map(u => ({ upc: u, promo: 5.49 })) },
];

const P: [string, string, string, string | null, [string, number][]][] = [
  ['Hot dog and brat buns', 'Game Day Snacks', 'Own brand', null, [['0-41000-12001', 1.49], ['0-41000-12002', 1.49]]],
  ['Whole turkey (per lb)', 'Harvest Feast', 'Loss leader', null, [['2-04512-00000', 0.59]]],
  ['Honey Oat 2 for $7', 'Holiday Entertaining', 'Competitive price match', '01004440', [['0-61880-40011', 3.50]]],
  ['Grill-out buns', 'Summer Grilling', 'Own brand', null, [['0-41000-12001', 1.49], ['0-41000-12002', 1.49]]],
];

const iso = (d: Date) => d.toISOString().slice(0, 10);
const plus = (n: number) => { const d = new Date(); d.setUTCHours(12, 0, 0, 0); d.setUTCDate(d.getUTCDate() + n); return iso(d); };
const quarter = (isoDate: string) => { const d = new Date(isoDate + 'T12:00:00Z'); return `Q${Math.floor(d.getUTCMonth() / 3) + 1} ${d.getUTCFullYear()}`; };

/** Upserts the demo vendors (by number) and inserts items, events, deals and promotions. Expects those tables to be empty. */
export async function loadDemoData(tx: DB) {
  const vid: Record<string, string> = {};
  for (const v of V) {
    const vals = { name: v[1], broker: v[2], category: v[3], settlement: v[4], complianceScore: v[5], status: 'ACTIVE' as const };
    const r = await tx.insert(s.vendors).values({ number: v[0], ...vals }).onConflictDoUpdate({ target: s.vendors.number, set: vals }).returning({ id: s.vendors.id });
    vid[v[0]] = r[0].id;
  }
  const vcat = Object.fromEntries(V.map(v => [v[0], v[3]]));
  await tx.insert(s.items).values(I.map(i => ({ upc: i[0], vendorId: i[1] ? vid[i[1]] : null, category: i[1] ? vcat[i[1]] : 'Own brand / fresh', description: i[2], size: i[3], uom: i[4], orderCode: i[5], casePack: i[6], caseCost: i[7], regularRetail: i[8], baseWeeklyUnits: i[9] })));
  const item = (u: string) => I.find(i => i[0] === u)!;

  const eid: Record<string, { id: string; start: string; end: string }> = {};
  let ei = 0;
  for (const e of E) {
    // Completed events start on a Monday so their weeks line up with the weekly sales data.
    ei++; const start = e[7] === 'COMPLETED' ? mondayOf(plus(e[1])) : plus(e[1]);
    const end = new Date(Date.parse(start + 'T12:00:00Z') + (e[2] - 1) * DAYMS).toISOString().slice(0, 10);
    const r = await tx.insert(s.events).values({ code: `EV-${String(ei).padStart(3, '0')}`, name: e[0], quarter: quarter(start), theme: e[3], startDate: start, endDate: end, vehicles: e[4], mediaBudget: e[5], fundingTarget: e[6], status: e[7] }).returning({ id: s.events.id });
    eid[e[0]] = { id: r[0].id, start, end };
  }

  let di = 0;
  const made: (MDeal & { real: number })[] = [];
  for (const d of D) {
    di++; const ev = eid[d.ev]; const number = `DL-${String(di).padStart(4, '0')}`;
    const e = d.from != null ? { ...ev, start: plus(d.from), end: plus(d.to!) } : ev;
    const vend = V.find(v => v[0] === d.v)!;
    const now = d.sub ? new Date(Date.parse(ev.start + 'T15:00:00Z') - d.sub * 86400000) : new Date();
    const decided = d.sub ? new Date(now.getTime() + 2 * 86400000) : now;
    const r = await tx.insert(s.deals).values({
      number, vendorId: vid[d.v], eventId: ev.id, status: d.status, title: d.title, startDate: e.start, endDate: e.end, adFee: d.adFee ?? 0, accrualPct: d.accrual ?? 0, signer: d.signer,
      header: { vendorNumber: vend[0], broker: vend[2] ?? 'Direct', salesperson: d.signer, promotion: d.ev, adRunDates: `${e.start} to ${e.end}`, billingCompany: vend[1], feature: d.title },
      periods: Object.fromEntries((['tpr', 'bb', 'rscan', 'wscan', 'amap'] as const).filter(k => d.lines.some(l => (k === 'tpr' && l.tpr) || (k === 'bb' && l.billBack) || (k === 'rscan' && l.retailerScan) || (k === 'wscan' && l.wholesalerScan) || (k === 'amap' && l.cmap))).map(k => [k, { start: e.start, end: e.end }])),
      storeGroups: ['All stores'],
      submittedAt: d.status === 'DRAFT' ? null : now, decidedAt: ['APPROVED', 'SENT_BACK'].includes(d.status) ? decided : null, createdAt: now, updatedAt: decided,
      decidedByName: d.auto ? 'Autopilot' : d.by ?? null, autoApproved: !!d.auto, decisionNote: d.note ?? null, counterRate: d.counter ?? null, ruleVersion: 1,
    }).returning({ id: s.deals.id });
    const lineRows = d.lines.map((l, k) => { const it = item(l.upc); return {
      dealId: r[0].id, upc: it[0], description: it[2], casePack: it[6], caseCost: it[7], regularRetail: it[8], baseWeeklyUnits: it[9],
      tpr: l.tpr ?? 0, billBack: l.billBack ?? 0, retailerScan: l.retailerScan ?? 0, wholesalerScan: l.wholesalerScan ?? 0, cmap: l.cmap ?? 0,
      zone3Retail: Math.round((l.promo + 0.2) * 100) / 100, zone4Retail: l.promo, zone5Retail: l.promo, sort: k }; });
    await tx.insert(s.dealLines).values(lineRows);
    if (d.status === 'APPROVED') made.push({ number, status: d.status, vendorId: vid[d.v], eventId: ev.id, startDate: e.start, endDate: e.end, adFee: d.adFee ?? 0, accrualPct: d.accrual ?? 0, forecastUnits: null, lines: lineRows, real: d.real ?? 1 });
    if (d.note) await tx.insert(s.comments).values({ dealId: r[0].id, authorName: 'Category manager', body: d.note });
  }

  let pi = 0;
  for (const p of P) {
    pi++;
    const r = await tx.insert(s.promotions).values({ number: `PR-${String(pi).padStart(4, '0')}`, name: p[0], reason: p[2], eventId: eid[p[1]].id, brandVendorId: p[3] ? vid[p[3]] : null }).returning({ id: s.promotions.id });
    await tx.insert(s.promotionLines).values(p[4].map(([u, promo]) => { const it = item(u); return { promotionId: r[0].id, upc: u, description: it[2], unitCost: Math.round(it[7] / it[6] * 100) / 100, regularRetail: it[8], promoRetail: promo, baseWeeklyUnits: it[9] }; }));
  }
  const promoWindows = P.flatMap(p => p[4].map(([u, promo]) => ({ upc: u, promo, start: eid[p[1]].start, end: eid[p[1]].end })));
  await loadDemoActuals(tx, made, promoWindows, vid);
  for (const [name, value] of [['event', E.length], ['deal', D.length], ['promo', P.length]] as const)
    await tx.insert(s.counters).values({ name, value }).onConflictDoUpdate({ target: s.counters.name, set: { value } });
  return `${V.length} vendors, ${I.length} items, ${E.length} events, ${D.length} deals, ${P.length} retailer-funded promotions, 26 weeks of sales and receipts, Bill Back Manager history`;
}

/**
 * Creates or repairs the shared demo accounts. `hash` is the bcrypt hash of the shared demo password,
 * applied to accounts being created and, when `forceHash` is true, to existing ones too.
 * Returns the emails created. Vendor accounts are skipped when their demo vendor doesn't exist.
 */
export async function ensureDemoUsers(tx: DB, hash: string, forceHash: boolean) {
  const roleRows = await tx.select().from(s.roles);
  const vendorRows = await tx.select().from(s.vendors);
  const created: string[] = [];
  for (const d of DEMO_USERS) {
    const role = roleRows.find(r => r.name === d.role); if (!role) continue;
    const vendor = d.vendorNumber ? vendorRows.find(v => v.number === d.vendorNumber) : null;
    if (d.vendorNumber && !vendor) continue;
    const base = { name: d.name, roleId: role.id, vendorId: vendor?.id ?? null, categories: d.categories ?? [], status: 'ACTIVE' as const, demo: true, mustChangePassword: false, failedLogins: 0, lockedUntil: null, totpEnabled: false, totpSecret: null };
    const cur = (await tx.select().from(s.users).where(eq(s.users.email, d.email)))[0];
    if (!cur) {
      await tx.insert(s.users).values({ email: d.email, passwordHash: hash, passwordChangedAt: new Date(), guideStartedAt: new Date(), ...base });
      created.push(d.email);
    } else {
      await tx.update(s.users).set({ ...base, ...(forceHash ? { passwordHash: hash, passwordChangedAt: new Date() } : {}) }).where(eq(s.users.id, cur.id));
    }
  }
  return created;
}

/** Turns demo sign-in off: deactivates every demo account and ends its sessions. */
export async function disableDemoUsers(tx: DB) {
  const ids = (await tx.select({ id: s.users.id }).from(s.users).where(and(eq(s.users.demo, true), eq(s.users.status, 'ACTIVE')))).map(r => r.id);
  if (!ids.length) return 0;
  await tx.update(s.users).set({ status: 'DEACTIVATED' }).where(inArray(s.users.id, ids));
  await tx.delete(s.sessions).where(inArray(s.sessions.userId, ids));
  return ids.length;
}

/**
 * Puts the demo back to its starting point: removes all deals, events, promotions and items, restores the
 * built-in roles and default rules, removes users that demo accounts created, reloads the sample data, and
 * restarts every demo walkthrough. Real (non-demo) users and the audit trail are kept.
 */
export async function resetDemo(tx: DB, demoHash: string | null) {
  await tx.delete(s.comments);
  await tx.delete(s.dealLines);
  await tx.delete(s.fundingRequests);
  await tx.delete(s.deals);
  await tx.delete(s.promotionLines);
  await tx.delete(s.promotions);
  await tx.delete(s.events);
  await tx.delete(s.items);
  await tx.delete(s.salesActuals);
  await tx.delete(s.receipts);
  await tx.delete(s.billingRecords);
  await tx.delete(s.dataUploads);
  // Users created by demo accounts (testers' "new teammates") go; the built-in demo accounts are repaired below.
  const builtIn = DEMO_USERS.map(d => d.email);
  await tx.delete(s.users).where(and(eq(s.users.demo, true), notInArray(s.users.email, builtIn)));
  // Vendors added during testing go too, unless a real user belongs to them.
  const keep = V.map(v => v[0] as string);
  await tx.execute(sql`delete from vendors v where v.number not in (${sql.join(keep.map(k => sql`${k}`), sql`, `)}) and not exists (select 1 from users u where u.vendor_id = v.id)`);
  // Built-in roles back to their default permissions.
  for (const r of DEFAULT_ROLES) {
    const cur = (await tx.select().from(s.roles).where(eq(s.roles.name, r.name)))[0];
    if (cur) await tx.update(s.roles).set({ permissions: r.permissions, requireMfa: r.requireMfa }).where(eq(s.roles.id, cur.id));
    else await tx.insert(s.roles).values({ name: r.name, org: r.org, permissions: r.permissions, requireMfa: r.requireMfa, system: true });
  }
  // Default approval rules as a new version (history is kept).
  const latest = (await tx.select().from(s.ruleSets).orderBy(sql`${s.ruleSets.version} desc`).limit(1))[0];
  if (!latest || JSON.stringify(latest.values) !== JSON.stringify(DEFAULT_RULES)) await tx.insert(s.ruleSets).values({ values: DEFAULT_RULES, createdBy: 'Demo reset' });

  const summary = await loadDemoData(tx);

  if (demoHash) await ensureDemoUsers(tx, demoHash, false);
  const demoIds = (await tx.select({ id: s.users.id }).from(s.users).where(eq(s.users.demo, true))).map(r => r.id);
  if (demoIds.length) {
    await tx.delete(s.guideProgress).where(inArray(s.guideProgress.userId, demoIds));
    await tx.update(s.users).set({ guideStartedAt: new Date() }).where(inArray(s.users.id, demoIds));
  }
  return summary;
}

/* ---------- generated actuals for the demo ---------- */

/** Deterministic 0–1 from a string, so every reset produces the same numbers. */
function rnd(key: string) { let h = 2166136261; for (let i = 0; i < key.length; i++) { h ^= key.charCodeAt(i); h = Math.imul(h, 16777619); } return ((h >>> 0) % 10000) / 10000; }
const DAYMS = 86400000;
const overlap = (ws: string, a: string, b: string) => { const s0 = Math.max(Date.parse(ws), Date.parse(a)), e0 = Math.min(Date.parse(ws) + 6 * DAYMS, Date.parse(b)); return e0 < s0 ? 0 : Math.round((e0 - s0) / DAYMS) + 1; };

/**
 * 26 weeks of POS sales and receipts for every demo UPC: baseline ±6% noise, lifted during approved deals
 * (each deal delivers `real` × its forecast lift) and retailer promotions; then the Bill Back Manager
 * records that leave each completed deal in a different billing state.
 */
async function loadDemoActuals(tx: DB, made: (MDeal & { real: number })[], promos: { upc: string; promo: number; start: string; end: string }[], vid: Record<string, string>) {
  const last = mondayOf(plus(-7));
  const weeks: string[] = []; for (let k = 25; k >= 0; k--) weeks.push(new Date(Date.parse(last + 'T00:00:00Z') - k * 7 * DAYMS).toISOString().slice(0, 10));
  const lifts = made.map(m => ({ m, lift: dealEcon({ lines: m.lines as LineInput[], startDate: m.startDate, endDate: m.endDate, adFee: m.adFee, accrualPct: m.accrualPct, forecastUnits: null }).lift }));
  const sales: WeekRow[] = [], recs: ReceiptRow[] = [];
  for (const it of I) {
    const [upc, , , , , , pack, caseCost, retail, base] = it;
    for (const w of weeks) {
      let f = 0.94 + 0.12 * rnd(upc + w), price = retail;
      for (const { m, lift } of lifts) { const l = m.lines.find(x => x.upc === upc); const d = l ? overlap(w, m.startDate, m.endDate) : 0; if (d && m.accrualPct === 0) { f *= 1 + lift * m.real * d / 7; price = l!.zone4Retail ?? retail; } else if (d) f *= 1 + lift * m.real * d / 7; }
      for (const p of promos) { const d = p.upc === upc ? overlap(w, p.start, p.end) : 0; if (d) { const depth = (retail - p.promo) / retail; f *= 1 + 1.1 * 0.45 * Math.pow(Math.max(depth, 0.05) / 0.25, 0.8) * d / 7; price = p.promo; } }
      const units = Math.round(base * f);
      sales.push({ upc, weekStart: w, units, sales: Math.round(units * price * 100) / 100 });
      const cases = Math.max(0, Math.round(units / pack * (0.9 + 0.2 * rnd('r' + upc + w))));
      recs.push({ upc, weekStart: w, cases, cost: Math.round(cases * caseCost * 100) / 100 });
    }
  }
  const sUp = await tx.insert(s.dataUploads).values({ kind: 'SALES', fileName: 'demo-pos-sales.csv', rows: sales.length, notes: `${sales.length} UPC-weeks, ${weeks[0]} to ${last} (generated for the demo)`, byName: 'System (demo data)' }).returning({ id: s.dataUploads.id });
  const rUp = await tx.insert(s.dataUploads).values({ kind: 'RECEIPTS', fileName: 'demo-receipts.csv', rows: recs.length, notes: `${recs.length} UPC-weeks, ${weeks[0]} to ${last} (generated for the demo)`, byName: 'System (demo data)' }).returning({ id: s.dataUploads.id });
  for (let i = 0; i < sales.length; i += 400) await tx.insert(s.salesActuals).values(sales.slice(i, i + 400).map(x => ({ ...x, uploadId: sUp[0].id })));
  for (let i = 0; i < recs.length; i += 400) await tx.insert(s.receipts).values(recs.slice(i, i + 400).map(x => ({ ...x, uploadId: rUp[0].id })));

  // Bill Back Manager history: each completed deal ends up in a different reconciliation state.
  const A = indexActuals(sales, recs);
  const today = plus(0);
  const settle = (v: string) => V.find(x => vid[x[0]] === v)?.[4] === 'DEDUCTION';
  const plan: Record<string, (b: number, adFee: number) => { billed: number; collected: number; status: string }[]> = {
    'DL-0009': b => [{ billed: b, collected: b, status: 'DEDUCTED' }],          // billed and collected
    'DL-0010': b => [{ billed: b, collected: 0, status: 'OPEN' }],              // billed, waiting on payment
    'DL-0011': (_b, fee) => [{ billed: fee, collected: fee, status: 'PAID' }],  // ad fee billed, scan never billed → under-billed
    'DL-0012': b => [{ billed: b, collected: 0, status: 'DISPUTED' }],          // vendor disputes the claim
    // DL-0013: nothing billed → ready to bill
    'DL-0014': b => [{ billed: Math.round(b * 1.06 * 100) / 100, collected: Math.round(b * 1.06 * 100) / 100, status: 'DEDUCTED' }], // over-billed 6%
    'DL-0016': b => [{ billed: Math.round(b * 0.55 * 100) / 100, collected: Math.round(b * 0.55 * 100) / 100, status: 'PAID' }, { billed: Math.round(b * 0.45 * 100) / 100, collected: Math.round(b * 0.45 * 100) / 100, status: 'PAID' }], // accrual fully billed in two claims
    'DL-0017': b => [{ billed: Math.round(b * 0.4 * 100) / 100, collected: Math.round(b * 0.4 * 100) / 100, status: 'PAID' }],     // accrual 40% billed, balance expiring
  };
  const rows: (typeof s.billingRecords.$inferInsert)[] = [];
  for (const m of made) {
    const f = plan[m.number]; if (!f) continue;
    const r = measureDeal(m, A, [], today, DEFAULT_RULES.claimDays);
    f(Math.round(r.billable * 100) / 100, m.adFee).forEach((x, k) => rows.push({
      invoiceNumber: `BBM-${m.number.slice(3)}-${k + 1}`, dealNumber: m.number, vendorNumber: V.find(v => vid[v[0]] === m.vendorId)?.[0] ?? null,
      invoiceDate: new Date(Date.parse(m.endDate + 'T12:00:00Z') + (14 + 30 * k) * DAYMS).toISOString().slice(0, 10), method: settle(m.vendorId) ? 'deduction' : 'invoice', ...x,
    }));
  }
  if (rows.length) {
    const bUp = await tx.insert(s.dataUploads).values({ kind: 'BILLING', fileName: 'demo-bill-back-manager.csv', rows: rows.length, notes: `$${Math.round(rows.reduce((a, r) => a + (r.billed ?? 0), 0)).toLocaleString()} billed · $${Math.round(rows.reduce((a, r) => a + (r.collected ?? 0), 0)).toLocaleString()} collected (generated for the demo)`, byName: 'System (demo data)' }).returning({ id: s.dataUploads.id });
    await tx.insert(s.billingRecords).values(rows.map(r => ({ ...r, uploadId: bUp[0].id })));
  }
}

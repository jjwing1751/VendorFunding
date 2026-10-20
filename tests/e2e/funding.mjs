// Funding, billing, accruals and performance against a running server with a fresh seeded DB:
//   DEMO_PASSWORD=... node tests/e2e/funding.mjs http://localhost:3100
import { chromium } from 'playwright';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import pg from 'pg';

const BASE = process.argv[2] || 'http://localhost:3100';
const PW = process.env.DEMO_PASSWORD;
const db = new pg.Client({ connectionString: process.env.DATABASE_URL }); await db.connect();
const results = []; const ok = (name, cond, extra = '') => results.push([cond ? 'PASS' : 'FAIL', name, extra]);
const browser = await chromium.launch();
const dir = mkdtempSync(join(tmpdir(), 'fl-'));
async function as(email) {
  const ctx = await browser.newContext({ acceptDownloads: true }); const p = await ctx.newPage();
  p.on('pageerror', e => results.push(['FAIL', 'page error', e.message]));
  await p.goto(BASE + '/login'); await p.fill('#email', email); await p.fill('#password', PW); await p.click('button:has-text("Sign in")');
  await p.waitForURL(BASE + '/', { timeout: 15000 }).catch(() => {}); await p.waitForLoadState('networkidle'); return { ctx, p };
}
const main = p => p.textContent('main');
const dealId = async n => (await db.query('select id from deals where number=$1', [n])).rows[0].id;
const fetchText = async (p, path) => p.evaluate(async u => { const r = await fetch(u); return { status: r.status, text: await r.text() }; }, path);
const statusOf = async (p, n) => { await p.goto(BASE + '/billing'); return (await p.locator('tr', { hasText: n }).locator('.pill').last().textContent())?.trim(); };

// Finance / AR
const F = await as('fran.finance@northfield.test');
await F.p.goto(BASE + '/performance');
let t = await main(F.p);
ok('performance page shows target, committed, earned, billed, collected', ['Target', 'Committed', 'Earned to date', 'Billed', 'Collected'].every(k => t.includes(k)));
ok('performance lists completed events with lift', t.includes('Summer Grilling') && t.includes('Back to School') && /\+\d+%/.test(t));
await F.p.click('text=Back to School'); await F.p.waitForLoadState('networkidle');
t = await main(F.p);
ok('event page has a Performance section with deal billing states', t.includes('Performance') && t.includes('Ready to bill') && t.includes('Disputed') && t.includes('Over-billed'));
await F.p.goto(BASE + '/billing'); t = await main(F.p);
ok('billing shows the four problem deals', ['DL-0011', 'DL-0012', 'DL-0013', 'DL-0014'].every(n => t.includes(n)));
ok('DL-0013 is ready to bill', (await statusOf(F.p, 'DL-0013')) === 'Ready to bill', await statusOf(F.p, 'DL-0013'));
ok('DL-0011 is under-billed', (await statusOf(F.p, 'DL-0011')) === 'Under-billed');
const ready = await fetchText(F.p, '/api/export/ready-to-bill.csv');
const lines = ready.text.trim().split(/\r?\n/);
ok('ready-to-bill export: under-billed DL-0011, unbilled DL-0013, expiring accrual DL-0017', ready.status === 200 && lines.length === 4 && ['DL-0011', 'DL-0013', 'DL-0017'].every(n => ready.text.includes(n)) && !ready.text.includes('DL-0014'), lines.map(l => l.split(',')[0]).join(' '));
await F.p.goto(BASE + '/accruals'); t = await main(F.p);
ok('accruals: earning, expiring and fully billed', t.includes('Earning') && t.includes('Expiring') && t.includes('Fully billed') && t.includes('DL-0017'));
const sample = await fetchText(F.p, '/api/export/sample-bbm.csv');
const f1 = join(dir, 'bbm.csv'); writeFileSync(f1, sample.text);
await F.p.goto(BASE + '/billing'); await F.p.setInputFiles('#bbm-file', f1); await F.p.click('button:has-text("Import billing file")');
await F.p.waitForSelector('.flash', { timeout: 15000 }).catch(() => {});
ok('Bill Back Manager file imports', (await F.p.textContent('.flash'))?.includes('Imported 3 invoices'), await F.p.textContent('.flash'));
ok('DL-0013 now billed in full', (await statusOf(F.p, 'DL-0013')) === 'Billed in full', await statusOf(F.p, 'DL-0013'));
ok('DL-0011 now billed in full', (await statusOf(F.p, 'DL-0011')) === 'Billed in full');
const bad = join(dir, 'bad.csv'); writeFileSync(bad, 'deal_number,invoice_number,amount_billed\nDL-9999,X-1,100\nDL-0013,,5\n');
await F.p.goto(BASE + '/billing'); await F.p.setInputFiles('#bbm-file', bad); await F.p.click('button:has-text("Import billing file")'); await F.p.waitForSelector('.flash.err', { timeout: 15000 }).catch(() => {});
t = await F.p.textContent('.flash') ?? '';
ok('bad billing rows are rejected with reasons', t.includes('Nothing loaded') && t.includes('isn’t a Fundline deal number') && t.includes('no invoice'), t.slice(0, 160));
await F.p.goto(BASE + '/accruals'); t = await main(F.p);
ok('expiring accrual is fully billed after the import', !t.includes('Expiring ·') && (await F.p.locator('tr', { hasText: 'DL-0017' }).textContent())?.includes('Fully billed'));
// sales upload with store rows summed, a week-ending date, an unknown UPC
const s1 = join(dir, 'sales.csv');
writeFileSync(s1, 'UPC,Week Ending,Units,Sales $\n085390100110,2026-10-11,100,"$429.00"\n0-85390-10011,2026-10-11,50,214.50\n999999999999,2026-10-11,5,1\n');
await F.p.goto(BASE + '/data'); await F.p.selectOption('#actuals-kind', 'SALES'); await F.p.setInputFiles('#actuals-file', s1); await F.p.click('button:has-text("Upload")'); await F.p.waitForSelector('.flash', { timeout: 15000 }).catch(() => {});
t = await F.p.textContent('.flash') ?? '';
ok('sales upload loads (12-digit UPC with check digit matches) and skips unknown UPC', t.includes('Loaded 1 UPC-weeks') && t.includes('1 row skipped') && t.includes('not in the item master'), t.slice(0, 160));
const w = (await db.query("select units from sales_actuals where upc='0-85390-10011' and week_start='2026-10-05'")).rows[0];
ok('store rows summed under the week’s Monday', w && Number(w.units) === 150, JSON.stringify(w));
await F.p.goto(BASE + '/deals/' + await dealId('DL-0013')); t = await main(F.p);
ok('deal page shows funding to date and the BBM invoice', t.includes('Funding to date') && t.includes('BBM-S'));
await F.p.goto(BASE + '/performance/vendors'); t = await main(F.p);
ok('scorecards list vendors with collection and on-time', t.includes('Harvest Table Foods') && t.includes('Blue Heron Coffee') && t.includes('On time'));

// Vendor sees only its own funding
const K = await as('kim.brandt@prairiegold.test');
await K.p.goto(BASE + '/performance/vendors'); t = await main(K.p);
ok('vendor scorecard is their own', t.includes('Prairie Gold Snacks scorecard') && t.includes('DL-0009') && !t.includes('Harvest Table'));
ok('vendor blocked from billing export', (await fetchText(K.p, '/api/export/ready-to-bill.csv')).status === 403);
await K.p.goto(BASE + '/billing'); ok('vendor blocked from billing page', (await main(K.p)).includes('can’t see billing'));

// Category manager sees only their categories; can't import
const C = await as('casey.cm@northfield.test');
await C.p.goto(BASE + '/performance/vendors'); t = await main(C.p);
ok('CM scorecard limited to their categories', t.includes('Prairie Gold') && !t.includes('Pinecone Pet') && !t.includes('Lakeshore'));
await C.p.goto(BASE + '/billing'); ok('CM sees billing but no import form', (await main(C.p)).includes('Billing reconciliation') && !(await C.p.$('#bbm-file')));
await C.p.goto(BASE + '/performance'); ok('CM sees no event targets', !(await main(C.p)).includes('of target'));

// Audit
const A = await as('avery.admin@northfield.test');
await A.p.goto(BASE + '/audit?verify=1'); t = await main(A.p);
ok('imports and exports are audited; chain intact', t.includes('Chain intact') && t.includes('Bill Back Manager file imported') && t.includes('Sales data uploaded') && t.includes('Ready-to-bill file exported'));

await browser.close(); await db.end();
for (const r of results) console.log(r[0], '-', r[1], r[2] ? `(${r[2]})` : '');
const fails = results.filter(r => r[0] === 'FAIL').length; console.log(`\n${results.length - fails} passed, ${fails} failed`); process.exit(fails ? 1 : 0);

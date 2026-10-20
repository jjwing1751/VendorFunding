// Demo accounts + walkthrough test against a running server with a fresh seeded DB:
//   DEMO_PASSWORD=... node tests/e2e/demo.mjs http://localhost:3100
import { chromium } from 'playwright';
import pg from 'pg';

const BASE = process.argv[2] || 'http://localhost:3100';
const PW = process.env.DEMO_PASSWORD;
if (!PW) { console.error('Set DEMO_PASSWORD'); process.exit(2); }
const db = new pg.Client({ connectionString: process.env.DATABASE_URL }); await db.connect();
const results = []; const ok = (name, cond, extra = '') => results.push([cond ? 'PASS' : 'FAIL', name, extra]);
const browser = await chromium.launch();
async function session() { const ctx = await browser.newContext(); const p = await ctx.newPage(); p.on('pageerror', e => results.push(['FAIL', 'page error', e.message])); return { ctx, p }; }
async function login(p, email) {
  await p.goto(BASE + '/login'); await p.fill('#email', email); await p.fill('#password', PW); await p.click('button:has-text("Sign in")');
  await Promise.race([p.waitForURL(u => !u.toString().endsWith('/login'), { timeout: 15000 }), p.waitForSelector('p.err', { timeout: 15000 })]).catch(() => {}); await p.waitForLoadState('networkidle');
}
const dealId = async n => (await db.query('select id from deals where number=$1', [n])).rows[0].id;
const progress = async p => (await p.textContent('.guide .panel-h .pill'))?.trim();
const main = p => p.textContent('main');
const submit = async (p, sel) => { const before = p.url(); await p.click(sel); await p.waitForURL(u => u.toString() !== before && u.toString().includes('?'), { timeout: 15000 }).catch(() => {}); await p.waitForLoadState('networkidle'); };
const waitProgress = (p, want) => p.waitForFunction(w => document.querySelector('.guide .panel-h .pill')?.textContent?.trim() === w, want, { timeout: 15000 }).catch(() => {});

const ACCOUNTS = {
  'Admin': 'avery.admin@northfield.test', 'Category director': 'dana.director@northfield.test', 'Category manager': 'casey.cm@northfield.test',
  'Finance / AR': 'fran.finance@northfield.test', 'Item setup': 'ivy.items@northfield.test', 'Analyst (read only)': 'andre.analyst@northfield.test',
  'Vendor admin': 'kim.brandt@prairiegold.test', 'Vendor user': 'pat.haas@harvesttable.test', 'Vendor viewer': 'tara.greer@summithome.test',
};

// 1. Login page lists the demo accounts and "Use" fills the email
{ const { p, ctx } = await session(); await p.goto(BASE + '/login');
  const body = await p.textContent('body');
  ok('login page lists all 9 demo roles', Object.keys(ACCOUNTS).every(r => body.includes(r)));
  ok('login page does not show the demo password', !body.includes(PW));
  await p.click('button[aria-label="Use the Vendor user demo account"]');
  ok('Use fills in the email', (await p.inputValue('#email')) === ACCOUNTS['Vendor user']);
  await ctx.close(); }

// 2. Every demo role signs in straight to My work with its walkthrough, and every step link opens without error
for (const [role, email] of Object.entries(ACCOUNTS)) {
  const { p, ctx } = await session(); await login(p, email);
  const url = p.url();
  ok(`${role}: signs in to My work without password change or MFA`, url === BASE + '/', url);
  const txt = await main(p);
  ok(`${role}: walkthrough shown on My work`, txt.includes(`Walkthrough: ${role}`));
  ok(`${role}: demo badge in sidebar`, (await p.textContent('nav')).includes('Demo account'));
  const hrefs = await p.$$eval('.guide .step-actions a', as => as.map(a => a.getAttribute('href')));
  let bad = [];
  for (const h of hrefs) { const r = await p.goto(BASE + h); const t = await main(p); if (!r || r.status() >= 400 || /could not be found|Something went wrong/i.test(t)) bad.push(`${h} ${r?.status()}`); }
  ok(`${role}: all ${hrefs.length} step links open`, hrefs.length > 0 && !bad.length, bad.join(', '));
  await ctx.close();
}

// 3. Category manager: auto-detected steps, manual mark/undo
const C = await session(); await login(C.p, ACCOUNTS['Category manager']);
ok('CM starts at 0 of 7', (await progress(C.p)) === '0 of 7 done', await progress(C.p));
await C.p.goto(BASE + '/deals/' + await dealId('DL-0005')); await submit(C.p, 'button.btn.good:has-text("Approve")');
ok('CM approved DL-0005', (await main(C.p)).includes('approved and added'));
await C.p.goto(BASE + '/deals/' + await dealId('DL-0004')); await submit(C.p, 'button:has-text("Send back with counter")');
ok('CM countered DL-0004', (await main(C.p)).includes('sent back'));
await C.p.goto(BASE + '/deals/' + await dealId('DL-0003')); await C.p.fill('textarea[name=body]', 'Check the tin display height.'); await C.p.check('input[name=internal]'); await submit(C.p, 'button:has-text("Post")');
await C.p.goto(BASE + '/');
ok('approve, counter and internal-note steps ticked from the audit trail', (await progress(C.p)) === '3 of 7 done', await progress(C.p));
ok('auto steps say where they came from', (await main(C.p)).includes('we saw it in the audit trail'));
const calStep = C.p.locator('.step', { hasText: 'Check the funding picture' });
await calStep.locator('button:has-text("Mark done")').click(); await waitProgress(C.p, '4 of 7 done');
ok('manual mark done', (await progress(C.p)) === '4 of 7 done', await progress(C.p));
await C.p.locator('.step', { hasText: 'Check the funding picture' }).locator('button:has-text("Undo")').click(); await waitProgress(C.p, '3 of 7 done');
ok('undo manual step', (await progress(C.p)) === '3 of 7 done', await progress(C.p));
await C.p.goto(BASE + '/guide'); ok('guide page shows the same progress', (await progress(C.p)) === '3 of 7 done');
await C.p.goto(BASE + '/account');
ok('demo account page explains shared account, no password form', (await main(C.p)).includes('Shared demo account') && !(await C.p.$('#current')));

// 4. Demo admin: no MFA, can't touch real accounts, users it adds are demo users
const A = await session(); await login(A.p, ACCOUNTS['Admin']);
ok('demo admin reaches My work without MFA setup', A.p.url() === BASE + '/', A.p.url());
const josh = (await db.query("select id from users where demo = false limit 1")).rows[0].id;
await A.p.goto(BASE + '/admin/users/' + josh); await A.p.fill('#confirm', 'x').catch(() => {});
await A.p.goto(BASE + '/admin/users/' + josh); await submit(A.p, 'button:has-text("Deactivate")').catch(() => {});
ok('demo admin cannot deactivate a real admin', (await main(A.p)).includes('Demo accounts can only change'), A.p.url());
const kim = (await db.query("select id from users where email=$1", [ACCOUNTS['Vendor admin']])).rows[0].id;
await A.p.goto(BASE + '/admin/users/' + kim); await submit(A.p, 'button:has-text("Deactivate")').catch(() => {});
ok('demo admin cannot deactivate a built-in demo login', (await main(A.p)).includes('Demo accounts can only change'));
await A.p.goto(BASE + '/admin/users'); await A.p.fill('#nu_name', 'Test Tester'); await A.p.fill('#nu_email', 'tester1@example.com');
await A.p.selectOption('#nu_org', { label: 'Retailer staff' }); await A.p.selectOption('#nu_role', { label: 'Analyst (read only)' }); await A.p.click('button:has-text("Add user")'); await A.p.waitForSelector('.secret');
ok('user added by demo admin is flagged demo', (await db.query("select demo from users where email='tester1@example.com'")).rows[0]?.demo === true);
await A.p.goto(BASE + '/admin/vendors'); const arch = A.p.locator('tr', { hasText: 'Prairie Gold Snacks' }).locator('button:has-text("Archive")');
if (await arch.count()) { await arch.click(); await A.p.waitForLoadState('networkidle'); }
ok('demo admin cannot archive a vendor with demo logins', (await db.query("select status from vendors where number='01004410'")).rows[0].status === 'ACTIVE');
await A.p.goto(BASE + '/admin/demo'); const dtext = await main(A.p);
ok('demo admin page lists accounts and tester-added users', dtext.includes('casey.cm@northfield.test') && dtext.includes('tester1@example.com'));

// 5. Analyst and vendor viewer are read-only
const N = await session(); await login(N.p, ACCOUNTS['Analyst (read only)']);
await N.p.goto(BASE + '/deals/' + await dealId('DL-0006'));
ok('analyst sees no decision buttons', !(await N.p.$('button:has-text("Approve")')) && !(await N.p.$('button:has-text("Send back with counter")')));
const T = await session(); await login(T.p, ACCOUNTS['Vendor viewer']);
await T.p.goto(BASE + '/deals/' + await dealId('DL-0008')); const ttext = await main(T.p);
ok('vendor viewer sees own draft read-only', ttext.includes('Spring cleaner endcap') && !(await T.p.$('button:has-text("Sign and submit")')) && !(await T.p.$('a:has-text("Edit")')));

// 6. Vendor user accepts the counter
const P = await session(); await login(P.p, ACCOUNTS['Vendor user']);
await P.p.goto(BASE + '/deals/' + await dealId('DL-0007')); await P.p.fill('textarea[name=body]', 'We can meet the counter.'); await submit(P.p, 'button:has-text("Post")');
await submit(P.p, 'button:has-text("Accept $")');
ok('vendor user accepted counter on DL-0007 (passes every rule, so auto-approved)', /approved automatically/.test(await main(P.p)));
await P.p.goto(BASE + '/'); ok('vendor user at 2 of 5 after reply + accept', (await progress(P.p)) === '2 of 5 done', await progress(P.p));

// 7. Reset restores the sample data and restarts walkthroughs
await A.p.goto(BASE + '/admin/demo'); await A.p.fill('#confirm', 'RESET'); await submit(A.p, 'button:has-text("Reset demo data")');
ok('reset reports success', (await main(A.p)).includes('Demo reset'));
const st = Object.fromEntries((await db.query("select number, status from deals")).rows.map(r => [r.number, r.status]));
ok('DL-0005 back to submitted, DL-0007 back to sent back', st['DL-0005'] === 'SUBMITTED' && st['DL-0007'] === 'SENT_BACK' && Object.keys(st).length === 17, JSON.stringify(st));
ok('tester-added user removed', !(await db.query("select 1 from users where email='tester1@example.com'")).rows.length);
ok('real admin kept', (await db.query("select 1 from users where id=$1", [josh])).rows.length === 1);
await C.p.goto(BASE + '/'); ok('CM walkthrough back to 0 of 7', (await progress(C.p)) === '0 of 7 done', await progress(C.p));
await A.p.goto(BASE + '/audit?verify=1'); ok('audit chain still verifies after reset', (await main(A.p)).includes('Chain intact'));

await browser.close(); await db.end();
for (const r of results) console.log(r[0], '-', r[1], r[2] ? `(${r[2]})` : '');
const fails = results.filter(r => r[0] === 'FAIL').length; console.log(`\n${results.length - fails} passed, ${fails} failed`); process.exit(fails ? 1 : 0);

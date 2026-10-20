// End-to-end smoke test against a running server: node tests/e2e/smoke.mjs http://localhost:3100
import { chromium } from 'playwright';
import { createHmac } from 'node:crypto';
import pg from 'pg';

const BASE = process.argv[2] || 'http://localhost:3100';
const ADMIN = { email: 'admin@example.com', pw: process.env.ADMIN_PASSWORD || 'ChangeMe-Admin-2026!' };
const NEWPW = 'Granite-ledger-7741!';
const db = new pg.Client({ connectionString: process.env.DATABASE_URL }); await db.connect();
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const b32d = s => { let bits = 0, v = 0; const o = []; for (const c of s) { v = (v << 5) | B32.indexOf(c); bits += 5; if (bits >= 8) { o.push((v >>> (bits - 8)) & 255); bits -= 8; } } return Buffer.from(o); };
const totp = s => { const b = Buffer.alloc(8); b.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000))); const h = createHmac('sha1', b32d(s)).update(b).digest(); const o = h[h.length - 1] & 15; return ((h.readUInt32BE(o) & 0x7fffffff) % 1e6).toString().padStart(6, '0'); };
const secretOf = async email => (await db.query('select totp_secret from users where email=$1', [email])).rows[0].totp_secret;
const results = []; const ok = (name, cond, extra = '') => { results.push([cond ? 'PASS' : 'FAIL', name, extra]); };

const browser = await chromium.launch();
async function session() { const ctx = await browser.newContext(); const p = await ctx.newPage(); p.on('pageerror', e => results.push(['FAIL', 'page error', e.message])); return { ctx, p }; }
async function login(p, email, pw) { await p.goto(BASE + '/login'); await p.fill('#email', email); await p.fill('#password', pw); await p.click('button:has-text("Sign in")');
  await Promise.race([p.waitForURL(u => !u.toString().endsWith('/login'), { timeout: 15000 }), p.waitForSelector('p.err', { timeout: 15000 })]).catch(() => {}); await p.waitForLoadState('networkidle'); }
async function changePw(p, cur, next) { const before = p.url(); await p.fill('#current', cur); await p.fill('#next', next); await p.fill('#confirm', next); await p.click('button:has-text("Change password")');
  await Promise.race([p.waitForURL(u => u.toString() !== before, { timeout: 15000 }), p.waitForSelector('p.err', { timeout: 15000 })]).catch(() => {}); await p.waitForLoadState('networkidle'); }

// 1. unauthenticated redirect
{ const { p, ctx } = await session(); await p.goto(BASE + '/deals'); ok('unauthenticated users go to login', p.url().endsWith('/login')); await ctx.close(); }

// 2. admin first sign-in: forced password change, then required MFA
const A = await session();
await login(A.p, ADMIN.email, ADMIN.pw);
ok('admin forced to change temp password', A.p.url().includes('/account/password'), A.p.url());
await changePw(A.p, ADMIN.pw, 'password12345');
ok('weak password rejected', (await A.p.textContent('body')).includes('Mix at least three'));
await changePw(A.p, ADMIN.pw, NEWPW); await A.p.waitForURL(/\/account\/mfa/, { timeout: 15000 }).catch(() => {});
ok('admin sent to MFA setup (role requires it)', A.p.url().includes('/account/mfa'), A.p.url());
await A.p.click('button:has-text("Start setup")'); await A.p.waitForLoadState('networkidle');
await A.p.fill('#code', '000000'); await A.p.click('button:has-text("Turn on")'); await A.p.waitForSelector('p.err', { timeout: 15000 }).catch(() => {});
ok('wrong MFA code rejected', (await A.p.textContent('body')).includes('didn’t match'));
await A.p.fill('#code', totp(await secretOf(ADMIN.email))); await A.p.click('button:has-text("Turn on")'); await A.p.waitForURL(/\/account\?ok=/, { timeout: 15000 }).catch(() => {});
ok('MFA enabled', (await A.p.textContent('body')).includes('Two-step verification is on'));
await A.p.goto(BASE + '/'); ok('admin reaches My work', (await A.p.textContent('h1')).includes('Good to see you'));

// 3. admin creates users
async function createUser(name, email, org, role, cats = []) {
  await A.p.goto(BASE + '/admin/users'); await A.p.fill('#nu_name', name); await A.p.fill('#nu_email', email);
  await A.p.selectOption('#nu_org', { label: org }); await A.p.selectOption('#nu_role', { label: role });
  for (const c of cats) await A.p.check(`input[name=categories][value="${c}"]`);
  await A.p.click('button:has-text("Add user")'); await A.p.waitForSelector('.secret');
  const t = await A.p.textContent('.secret'); return t.split('·')[1].trim();
}
const cmPw = await createUser('Maria Alvarez', 'cm@example.com', 'Retailer staff', 'Category manager', ['Salty Snacks', 'Candy']);
const vPw = await createUser('Kim Brandt', 'vendor@example.com', 'Prairie Gold Snacks', 'Vendor admin');
const v2Pw = await createUser('Dee Ruiz', 'lake@example.com', 'Lakeshore Beverage Co.', 'Vendor user');
ok('three users created with temp passwords', !!(cmPw && vPw && v2Pw));

// 4. vendor flow
const V = await session();
await login(V.p, 'vendor@example.com', vPw); await changePw(V.p, vPw, NEWPW);
await V.p.goto(BASE + '/'); ok('vendor sees My work', (await V.p.textContent('h1')).includes('Good to see you'));
await V.p.goto(BASE + '/deals'); const vtext = await V.p.textContent('main');
ok('vendor sees only own deals', vtext.includes('Prairie Gold') || vtext.includes('kettle') , ''); ok('vendor does not see other vendors deals', !vtext.includes('Holiday toffee tins'));
const other = (await db.query("select d.id from deals d join vendors v on v.id=d.vendor_id where v.name='Maple Street Confections' limit 1")).rows[0].id;
const resp = await V.p.goto(BASE + '/deals/' + other); ok('vendor blocked from another vendor’s deal (404)', resp.status() === 404, String(resp.status()));
const adminPage = await V.p.goto(BASE + '/admin/users'); ok('vendor cannot use admin page', (await V.p.textContent('main')).includes('Only admins'));
// new deal via form
await V.p.goto(BASE + '/deals/new');
await V.p.selectOption('#event', { index: 3 }); await V.p.fill('#title', 'Test holiday chips');
await V.p.fill('input[aria-label="UPC line 1"]', '0-85390-10021');
await V.p.fill('input[aria-label="TPR, line 1"]', '6'); await V.p.fill('input[aria-label="Unit scan, line 1"]', '0.40'); await V.p.fill('input[aria-label="Zone 4 retail, line 1"]', '2.49');
await V.p.fill('#signer', 'Kim Brandt'); await V.p.click('button:has-text("Save draft")'); await V.p.waitForURL(/\/deals\/[^/]+\?ok=/);
ok('vendor saved a UPC-level draft', (await V.p.textContent('main')).includes('Saved as a draft'));
await V.p.click('button:has-text("Sign and submit")'); await V.p.waitForLoadState('networkidle');
const subText = await V.p.textContent('main'); ok('vendor submitted deal', /submitted for review|approved automatically/.test(subText), subText.match(/DL-\d+[^.]*\./)?.[0] ?? '');
// import CAISSP
await V.p.goto(BASE + '/deals/import'); await V.p.setInputFiles('#file', '/mnt/user-data/outputs/Sample CAISSP - Prairie Gold (filled).xlsx');
await V.p.selectOption('#eventId', { index: 4 }); await V.p.click('button:has-text("Import as a draft")'); await V.p.waitForURL(/\/deals\/[^/]+\?/);
ok('vendor imported CAISSP spreadsheet', (await V.p.textContent('main')).includes('Imported 4 UPC lines'));

// 5. category manager decides
const C = await session();
await login(C.p, 'cm@example.com', cmPw); await changePw(C.p, cmPw, NEWPW);
const tins = (await db.query("select d.id from deals d where d.title='Holiday toffee tins'")).rows[0].id;
await C.p.goto(BASE + '/deals/' + tins); await C.p.fill('#cnote', 'Need more funding'); await C.p.click('button:has-text("Send back with counter")'); await C.p.waitForLoadState('networkidle');
ok('CM sent deal back with counter', (await C.p.textContent('main')).includes('sent back'));
const yogurt = (await db.query("select id from deals where title='Greek yogurt feature'")).rows[0].id;
await C.p.goto(BASE + '/deals/' + yogurt); ok('CM blocked outside categories', (await C.p.textContent('main')).includes('not one of your assigned categories'));
const big = (await db.query("select id from deals where title='Big Game kettle chips'")).rows[0].id;
await C.p.goto(BASE + '/deals/' + big); await C.p.click('button:has-text("Approve")'); await C.p.waitForLoadState('networkidle');
ok('CM approved in-scope deal', (await C.p.textContent('main')).includes('approved and added'));
await C.p.goto(BASE + '/audit?verify=1'); ok('audit chain verifies', (await C.p.textContent('main')).includes('Chain intact'));
await C.p.goto(BASE + '/promotions'); ok('promotions page shows funding labels', /Vendor funded|Shared|Retailer funded/.test(await C.p.textContent('main')));
await C.p.goto(BASE + '/calendar'); ok('calendar renders', (await C.p.textContent('main')).includes('Promo calendar'));
await C.p.goto(BASE + '/items/0-85390-10011'); ok('UPC history page', (await C.p.textContent('main')).includes('Deal and promotion history'));

// 6. lockout
const L = await session();
for (let i = 0; i < 5; i++) await login(L.p, 'lake@example.com', 'wrong-password-' + i);
await login(L.p, 'lake@example.com', v2Pw); ok('account locks after 5 failures', (await L.p.textContent('body')).includes('locked'));

// 7. admin MFA on next sign-in; delete & archive
const A2 = await session();
await login(A2.p, ADMIN.email, NEWPW); ok('admin asked for MFA code', A2.p.url().includes('/login/mfa'));
await A2.p.waitForTimeout(31000); await A2.p.fill('#code', totp(await secretOf(ADMIN.email))); await A2.p.click('button:has-text("Verify")'); await A2.p.waitForURL(BASE + '/', { timeout: 15000 }).catch(() => {});
ok('admin signed in with MFA', A2.p.url() === BASE + '/');
await A2.p.goto(BASE + '/admin/vendors'); await A2.p.fill('#vn', 'Test Vendor'); await A2.p.fill('#vnum', 'T-9999'); await A2.p.fill('#vc', 'Snacks'); await A2.p.click('button:has-text("Add vendor")'); await A2.p.waitForSelector('text=Test Vendor added', { timeout: 15000 }).catch(() => {});
ok('vendor added', (await A2.p.textContent('main')).includes('Test Vendor added'));
const row = A2.p.locator('tr', { hasText: 'Test Vendor' }); await row.locator('input[name=confirm]').fill('T-9999'); await row.locator('button:has-text("Delete")').click(); await A2.p.waitForSelector('text=Test Vendor deleted', { timeout: 15000 }).catch(() => {});
ok('vendor without history deleted', (await A2.p.textContent('main')).includes('Test Vendor deleted'));
const lake = (await db.query("select id from users where email='lake@example.com'")).rows[0].id;
await A2.p.goto(BASE + '/admin/users/' + lake); await A2.p.fill('#confirm', 'lake@example.com'); await A2.p.click('button:has-text("Delete user")'); await A2.p.waitForSelector('text=Dee Ruiz deleted', { timeout: 15000 }).catch(() => {});
ok('user deleted', (await A2.p.textContent('main')).includes('Dee Ruiz deleted'));
const last = (await db.query('select action from audit_log order by seq desc limit 1')).rows[0].action; ok('deletion audited', last === 'User deleted', last);
// session cookie flags
const ck = (await A2.ctx.cookies()).find(c => c.name === 'fl_session'); ok('session cookie is HttpOnly + SameSite=Lax', ck && ck.httpOnly && ck.sameSite === 'Lax', JSON.stringify({ httpOnly: ck?.httpOnly, secure: ck?.secure, sameSite: ck?.sameSite }));

await browser.close(); await db.end();
for (const r of results) console.log(r[0], '-', r[1], r[2] ? `(${r[2]})` : '');
const fails = results.filter(r => r[0] === 'FAIL').length; console.log(`\n${results.length - fails} passed, ${fails} failed`); process.exit(fails ? 1 : 0);

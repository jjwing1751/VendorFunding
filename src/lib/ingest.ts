import 'server-only';
import { sql } from 'drizzle-orm';
import { db } from '@/db';
import { billingRecords, dataUploads, deals, items, receipts, salesActuals, vendors } from '@/db/schema';
import { audit } from './audit';
import { normUpc } from './caissp';
import { BBM_COLS, RECEIPT_COLS, SALES_COLS, isoDate, mapColumns, num, parseCsv, validIso } from './csv';
import { mondayOf } from './measure';

export type IngestResult = { ok: boolean; kind: string; rows: number; skipped: number; problems: string[]; message: string };
type Actor = { id: string | null; name: string; ip: string | null };

const MAX_ROWS = 50000;

/** Match a UPC from a POS or receiving file to the item master: with or without dashes and leading zeros, and with or without the trailing check digit. */
function findItem<T>(byNorm: Map<string, T>, raw: string): T | undefined {
  const n = normUpc(raw);
  if (!n) return undefined;
  return byNorm.get(n) ?? (raw.replace(/\D/g, '').length >= 12 ? byNorm.get(normUpc(raw.replace(/\D/g, '').slice(0, -1))) : undefined);
}
const note = (problems: string[], line: number, msg: string) => { if (problems.length < 12) problems.push(`Row ${line}: ${msg}`); };

/** POS sales or receipts by UPC and week. Rows for the same UPC and week are added together (e.g. several stores); the total replaces what was loaded before. */
export async function ingestActuals(kind: 'SALES' | 'RECEIPTS', fileName: string, text: string, actor: Actor): Promise<IngestResult> {
  const rows = parseCsv(text);
  const label = kind === 'SALES' ? 'sales' : 'receipts';
  if (rows.length < 2) return { ok: false, kind, rows: 0, skipped: 0, problems: [], message: 'The file has no data rows.' };
  if (rows.length - 1 > MAX_ROWS) return { ok: false, kind, rows: 0, skipped: 0, problems: [], message: `Split the file: at most ${MAX_ROWS.toLocaleString()} rows per upload.` };
  const C = (kind === 'SALES' ? mapColumns(rows[0], SALES_COLS) : mapColumns(rows[0], RECEIPT_COLS)) as Record<string, number>;
  const need = kind === 'SALES' ? ['upc', 'week', 'units'] : ['upc', 'week', 'cases'];
  const missing = need.filter(k => C[k] < 0);
  if (missing.length) return { ok: false, kind, rows: 0, skipped: 0, problems: [], message: `Missing column${missing.length > 1 ? 's' : ''}: ${missing.join(', ')}. Download the template to see the expected headers.` };

  const master = await db.select({ upc: items.upc, caseCost: items.caseCost }).from(items);
  const byNorm = new Map(master.map(i => [normUpc(i.upc), i]));
  const agg = new Map<string, { upc: string; week: string; a: number; b: number | null }>();
  const problems: string[] = []; let skipped = 0;
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r]; const line = r + 1;
    const it = findItem(byNorm, row[C.upc] ?? '');
    if (!it) { skipped++; note(problems, line, `UPC ${row[C.upc] || '(blank)'} is not in the item master`); continue; }
    const d = isoDate(row[C.week]);
    if (!validIso(d)) { skipped++; note(problems, line, `can’t read the week “${row[C.week] ?? ''}”`); continue; }
    const a = num(row[kind === 'SALES' ? C.units : C.cases]);
    if (a == null || a < 0) { skipped++; note(problems, line, `${kind === 'SALES' ? 'units' : 'cases'} must be a number ≥ 0`); continue; }
    const bCol = kind === 'SALES' ? C.sales : C.cost;
    let b = bCol >= 0 ? num(row[bCol]) : null;
    if (kind === 'RECEIPTS' && b == null) b = a * it.caseCost; // cost defaults to cases × case cost on file
    const week = mondayOf(d);
    const k = it.upc + '|' + week;
    const cur = agg.get(k);
    if (cur) { cur.a += a; cur.b = cur.b == null && b == null ? null : (cur.b ?? 0) + (b ?? 0); } else agg.set(k, { upc: it.upc, week, a, b });
  }
  const vals = [...agg.values()];
  if (!vals.length) return { ok: false, kind, rows: 0, skipped, problems, message: `Nothing loaded: none of the ${rows.length - 1} rows could be read.` };
  const weeks = vals.map(v => v.week).sort();
  await db.transaction(async tx => {
    const up = await tx.insert(dataUploads).values({ kind, fileName: fileName.slice(0, 200), rows: rows.length - 1 - skipped, skipped, notes: `${vals.length} UPC-weeks, ${weeks[0]} to ${weeks[weeks.length - 1]}`, byName: actor.name }).returning({ id: dataUploads.id });
    for (let i = 0; i < vals.length; i += 500) {
      const chunk = vals.slice(i, i + 500);
      if (kind === 'SALES') await tx.insert(salesActuals).values(chunk.map(v => ({ upc: v.upc, weekStart: v.week, units: v.a, sales: v.b, uploadId: up[0].id })))
        .onConflictDoUpdate({ target: [salesActuals.upc, salesActuals.weekStart], set: { units: sql`excluded.units`, sales: sql`excluded.sales`, uploadId: sql`excluded.upload_id` } });
      else await tx.insert(receipts).values(chunk.map(v => ({ upc: v.upc, weekStart: v.week, cases: v.a, cost: v.b ?? 0, uploadId: up[0].id })))
        .onConflictDoUpdate({ target: [receipts.upc, receipts.weekStart], set: { cases: sql`excluded.cases`, cost: sql`excluded.cost`, uploadId: sql`excluded.upload_id` } });
    }
    await audit(tx, { actorId: actor.id, actorName: actor.name, action: kind === 'SALES' ? 'Sales data uploaded' : 'Receipts data uploaded', objectType: 'upload', objectId: fileName.slice(0, 120), detail: `${vals.length} UPC-weeks (${weeks[0]} to ${weeks[weeks.length - 1]}) · ${skipped} rows skipped`, ip: actor.ip });
  });
  return { ok: true, kind, rows: rows.length - 1 - skipped, skipped, problems, message: `Loaded ${vals.length.toLocaleString()} UPC-weeks of ${label} (${weeks[0]} to ${weeks[weeks.length - 1]}).${skipped ? ` ${skipped} row${skipped > 1 ? 's' : ''} skipped.` : ''}` };
}

const STATUS_MAP: [RegExp, string][] = [[/disput/i, 'DISPUTED'], [/write|w\/o/i, 'WRITTEN_OFF'], [/deduct/i, 'DEDUCTED'], [/partial/i, 'PARTIAL'], [/paid|collect|closed|settled/i, 'PAID'], [/open|issued|billed|sent|pending/i, 'OPEN']];

/** Bill Back Manager export: one row per invoice or claim. Re-importing an invoice number updates it. */
export async function ingestBbm(fileName: string, text: string, actor: Actor): Promise<IngestResult> {
  const rows = parseCsv(text);
  if (rows.length < 2) return { ok: false, kind: 'BILLING', rows: 0, skipped: 0, problems: [], message: 'The file has no data rows.' };
  const C = mapColumns(rows[0], BBM_COLS);
  const missing = (['deal', 'invoice', 'billed'] as const).filter(k => C[k] < 0);
  if (missing.length) return { ok: false, kind: 'BILLING', rows: 0, skipped: 0, problems: [], message: `Missing column${missing.length > 1 ? 's' : ''}: ${missing.join(', ')}. Bill Back Manager’s file needs the Fundline deal number, the invoice or claim number and the amount billed.` };
  const ds = await db.select({ number: deals.number, vendorId: deals.vendorId }).from(deals);
  const vs = await db.select({ id: vendors.id, number: vendors.number, settlement: vendors.settlement }).from(vendors);
  const byDigits = new Map(ds.map(d => [d.number.replace(/\D/g, '').replace(/^0+/, ''), d]));
  const problems: string[] = []; let skipped = 0;
  const out = new Map<string, typeof billingRecords.$inferInsert>();
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r]; const line = r + 1;
    const raw = row[C.deal] ?? '';
    const d = ds.find(x => x.number.toLowerCase() === raw.trim().toLowerCase()) ?? byDigits.get(raw.replace(/\D/g, '').replace(/^0+/, ''));
    if (!d) { skipped++; note(problems, line, `deal “${raw || '(blank)'}” isn’t a Fundline deal number`); continue; }
    const inv = (row[C.invoice] ?? '').trim().slice(0, 80);
    if (!inv) { skipped++; note(problems, line, 'no invoice or claim number'); continue; }
    const billed = num(row[C.billed]);
    if (billed == null) { skipped++; note(problems, line, 'amount billed is not a number'); continue; }
    const collected = C.collected >= 0 ? num(row[C.collected]) ?? 0 : 0;
    const v = vs.find(x => x.id === d.vendorId);
    const rawStatus = C.status >= 0 ? row[C.status] ?? '' : '';
    const status = STATUS_MAP.find(([re]) => re.test(rawStatus))?.[1] ?? (collected >= billed - 0.005 && billed > 0 ? (v?.settlement === 'DEDUCTION' ? 'DEDUCTED' : 'PAID') : collected > 0 ? 'PARTIAL' : 'OPEN');
    const date = C.date >= 0 ? isoDate(row[C.date]) : '';
    out.set(inv, { invoiceNumber: inv, dealNumber: d.number, vendorNumber: (C.vendor >= 0 ? row[C.vendor] : '') || v?.number || null, invoiceDate: validIso(date) ? date : null, method: (C.method >= 0 ? row[C.method] : '') || (v?.settlement === 'DEDUCTION' ? 'deduction' : 'invoice'), billed, collected, status, updatedAt: new Date() });
  }
  const vals = [...out.values()];
  if (!vals.length) return { ok: false, kind: 'BILLING', rows: 0, skipped, problems, message: `Nothing loaded: none of the ${rows.length - 1} rows matched a Fundline deal.` };
  const total = vals.reduce((s, v) => s + (v.billed ?? 0), 0), coll = vals.reduce((s, v) => s + (v.collected ?? 0), 0);
  await db.transaction(async tx => {
    const up = await tx.insert(dataUploads).values({ kind: 'BILLING', fileName: fileName.slice(0, 200), rows: vals.length, skipped, notes: `$${Math.round(total).toLocaleString()} billed · $${Math.round(coll).toLocaleString()} collected`, byName: actor.name }).returning({ id: dataUploads.id });
    for (let i = 0; i < vals.length; i += 500)
      await tx.insert(billingRecords).values(vals.slice(i, i + 500).map(v => ({ ...v, uploadId: up[0].id })))
        .onConflictDoUpdate({ target: billingRecords.invoiceNumber, set: { dealNumber: sql`excluded.deal_number`, vendorNumber: sql`excluded.vendor_number`, invoiceDate: sql`excluded.invoice_date`, method: sql`excluded.method`, billed: sql`excluded.billed`, collected: sql`excluded.collected`, status: sql`excluded.status`, uploadId: sql`excluded.upload_id`, updatedAt: sql`now()` } });
    await audit(tx, { actorId: actor.id, actorName: actor.name, action: 'Bill Back Manager file imported', objectType: 'upload', objectId: fileName.slice(0, 120), detail: `${vals.length} invoices/claims on ${new Set(vals.map(v => v.dealNumber)).size} deals · $${Math.round(total).toLocaleString()} billed · $${Math.round(coll).toLocaleString()} collected · ${skipped} rows skipped`, ip: actor.ip });
  });
  return { ok: true, kind: 'BILLING', rows: vals.length, skipped, problems, message: `Imported ${vals.length} invoices and claims: $${Math.round(total).toLocaleString()} billed, $${Math.round(coll).toLocaleString()} collected.${skipped ? ` ${skipped} row${skipped > 1 ? 's' : ''} skipped.` : ''}` };
}

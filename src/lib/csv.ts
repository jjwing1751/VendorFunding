/* Small, dependency-free CSV reader for uploads (POS sales, receipts, Bill Back Manager exports). */

/** RFC 4180-style parse: quoted fields, doubled quotes, commas/newlines inside quotes, CRLF, BOM. Also accepts tab- or semicolon-delimited files. */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, '');
  const first = src.split(/\r?\n/, 1)[0] ?? '';
  const delim = [',', '\t', ';'].map(d => [d, first.split(d).length] as const).sort((a, b) => b[1] - a[1])[0][0];
  const rows: string[][] = []; let row: string[] = []; let f = ''; let q = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (q) { if (c === '"') { if (src[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; continue; }
    if (c === '"' && f === '') q = true;
    else if (c === delim) { row.push(f); f = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && src[i + 1] === '\n') i++; row.push(f); f = ''; if (row.some(x => x.trim() !== '')) rows.push(row); row = []; }
    else f += c;
  }
  row.push(f); if (row.some(x => x.trim() !== '')) rows.push(row);
  return rows.map(r => r.map(x => x.trim()));
}

const key = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

/** Finds each wanted column by any of its accepted header names. Returns column indexes (−1 = missing). */
export function mapColumns<K extends string>(header: string[], aliases: Record<K, string[]>) {
  const h = header.map(key);
  const out = {} as Record<K, number>;
  for (const k of Object.keys(aliases) as K[]) out[k] = h.findIndex(x => aliases[k].some(a => key(a) === x));
  return out;
}

/** "$1,234.50", "(12.00)" → numbers. Blank → null. */
export function num(s: string | undefined): number | null {
  if (s == null) return null;
  const t = s.replace(/[$,\s]/g, '');
  if (t === '') return null;
  const neg = /^\(.*\)$/.test(t);
  const v = Number(t.replace(/[()]/g, ''));
  return isFinite(v) ? (neg ? -v : v) : null;
}

/** 2026-03-02, 3/2/2026, 3/2/26, 20260302 → ISO date. Unknown → ''. */
export function isoDate(s: string | undefined): string {
  if (!s) return '';
  const t = s.trim();
  let m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/); if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  m = t.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/); if (m) { let y = +m[3]; if (y < 100) y += 2000; return `${y}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`; }
  m = t.match(/^(\d{4})(\d{2})(\d{2})$/); if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  return '';
}
export const validIso = (s: string) => !!s && !isNaN(Date.parse(s + 'T00:00:00Z')) && new Date(s + 'T00:00:00Z').toISOString().slice(0, 10) === s;

export function toCsv(rows: (string | number | null | undefined)[][]) {
  return rows.map(r => r.map(v => { const s = v == null ? '' : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; }).join(',')).join('\r\n') + '\r\n';
}

/* Accepted column names. The Bill Back Manager names are a best guess until we have a sample export from it. */
export const SALES_COLS = {
  upc: ['upc', 'item upc', 'gtin', 'upc code', 'item'],
  week: ['week start', 'week_start', 'week', 'week beginning', 'week ending', 'week_end', 'date', 'fiscal week start'],
  units: ['units', 'unit sales', 'qty', 'quantity', 'units sold', 'movement'],
  sales: ['sales', 'sales $', 'net sales', 'dollars', 'sales dollars', 'revenue'],
};
export const RECEIPT_COLS = {
  upc: SALES_COLS.upc,
  week: SALES_COLS.week,
  cases: ['cases', 'cases received', 'case qty', 'qty cases', 'received cases'],
  cost: ['cost', 'purchase $', 'purchases', 'extended cost', 'cost $', 'received cost', 'invoice cost'],
};
export const BBM_COLS = {
  deal: ['deal', 'deal number', 'deal #', 'deal no', 'fundline deal', 'agreement', 'agreement number', 'contract', 'promotion id', 'reference'],
  invoice: ['invoice', 'invoice number', 'invoice #', 'invoice no', 'claim', 'claim number', 'claim #', 'bill number', 'document number'],
  vendor: ['vendor', 'vendor number', 'vendor #', 'vendor no', 'supplier number'],
  date: ['invoice date', 'date', 'bill date', 'claim date', 'document date'],
  billed: ['billed', 'amount billed', 'billed amount', 'invoice amount', 'claim amount', 'amount'],
  collected: ['collected', 'amount collected', 'paid', 'amount paid', 'deducted', 'deduction amount', 'received'],
  status: ['status', 'invoice status', 'claim status'],
  method: ['method', 'settlement', 'settlement method', 'type', 'payment method'],
};

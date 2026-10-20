import 'server-only';
import JSZip from 'jszip';

export type ParsedLine = {
  upc: string; description: string; casePack: number | null; caseCost: number | null;
  cmap: number; tpr: number; ad: number; billBack: number; wholesalerScan: number; retailerScan: number;
  zone3Retail: number | null; zone4Retail: number | null; zone5Retail: number | null; loyaltyMulti: string | null;
};
export type ParsedCaissp = {
  sheet: string;
  header: { vendorNumber: string; broker: string; salesperson: string; phone: string; email: string; datePresented: string; promotion: string; adRunDates: string; aimContract: string; billingCompany: string; billingContact: string; billingEmail: string; feature: string };
  adFee: number;
  periods: Partial<Record<'amap' | 'tpr' | 'ad' | 'bb' | 'wscan' | 'rscan', { start: string; end: string }>>;
  stores: string[];
  lines: ParsedLine[];
};

type Cell = string | number | Date | null;

const txt = (v: Cell) => v == null ? '' : v instanceof Date ? v.toISOString().slice(0, 10) : String(v).replace(/\s+/g, ' ').trim();
const num = (v: Cell) => { if (v == null || v === '') return null; const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/[$,]/g, '')); return isFinite(n) ? n : null; };
export const normUpc = (s: string) => s.replace(/\D/g, '').replace(/^0+/, '');

export function toIso(v: Cell): string {
  if (v == null || v === '') return '';
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === 'number' && v > 20000 && v < 80000) return new Date(Math.round((v - 25569) * 86400000)).toISOString().slice(0, 10);
  const s = String(v).trim();
  const m = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/);
  if (m) { let y = +m[3]; if (y < 100) y += 2000; return `${y}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`; }
  const m2 = s.match(/^(\d{4})-(\d{2})-(\d{2})/); return m2 ? m2[0] : '';
}

/** Parse the rows of a CAISSP sheet (same layout as the retailer's spreadsheet). */
export function parseRows(rows: Cell[][], sheet = 'CAISSP'): ParsedCaissp {
  const hIdx = rows.findIndex(r => r.some(c => /item upc/i.test(txt(c))));
  if (hIdx < 0) throw new Error('No CAISSP item table found. The sheet needs a column named “Individual item UPC Code”.');
  const LABEL = /^(vendor number|vendor\/broker|salesperson name|phone number|email address|date presented|promotion:|ad fee|billing |ad run dates|aim contract|store specific|start|end|notes|feature description|.* stores)/i;
  const val = (re: RegExp): Cell => {
    for (let r = 0; r < hIdx; r++) {
      const row = rows[r] ?? [];
      for (let c = 0; c < row.length; c++) if (re.test(txt(row[c]))) {
        for (let k = c + 1; k < Math.min(row.length, c + 7); k++) { const t = txt(row[k]); if (!t) continue; return LABEL.test(t) ? '' : row[k]; }
        return '';
      }
    }
    return '';
  };
  const period = (re: RegExp) => {
    for (let r = 0; r < hIdx; r++) {
      const row = rows[r] ?? []; const c = row.findIndex(x => re.test(txt(x))); if (c < 0) continue;
      const s = row.findIndex((x, i) => i > c && /^start$/i.test(txt(x))), e = row.findIndex((x, i) => i > c && /^end$/i.test(txt(x)));
      const start = s >= 0 ? toIso(row[s + 1] ?? null) : '', end = e >= 0 ? toIso(row[e + 1] ?? null) : '';
      return start ? { start, end: end || start } : null;
    }
    return null;
  };
  const header = {
    vendorNumber: txt(val(/^vendor number/i)), broker: txt(val(/^vendor\/broker/i)), salesperson: txt(val(/^salesperson name/i)), phone: txt(val(/^phone number/i)),
    email: txt(val(/^email address/i)), datePresented: toIso(val(/^date presented/i)), promotion: txt(val(/^promotion:/i)), adRunDates: txt(val(/^ad run dates/i)),
    aimContract: txt(val(/^aim contract/i)), billingCompany: txt(val(/^billing company/i)), billingContact: txt(val(/^billing contact/i)),
    billingEmail: txt(val(/^billing email/i)), feature: txt(val(/^feature description/i)),
  };
  const periods: ParsedCaissp['periods'] = {};
  const P: [keyof ParsedCaissp['periods'], RegExp][] = [['amap', /amap deal|cmap deal/i], ['tpr', /tpr deal/i], ['ad', /ad deal/i], ['bb', /bill back/i], ['wscan', /awg unit scan|wholesal.*scan/i], ['rscan', /only unit scan|retailer.*scan|^cob.*unit scan/i]];
  for (const [k, re] of P) { const p = period(re); if (p) periods[k] = p; }
  const stores: string[] = [];
  for (let r = 0; r < hIdx; r++) { const row = rows[r] ?? []; row.forEach((x, i) => { const t = txt(x); if (/ stores$/i.test(t) && /^(y|yes|x|true|1)$/i.test(txt(row[i + 1] ?? null))) stores.push(t); }); }

  const head = (rows[hIdx] ?? []).map(c => txt(c).toLowerCase());
  const col = (re: RegExp, not?: RegExp) => head.findIndex(h => re.test(h) && !(not && not.test(h)));
  const C = {
    upc: col(/upc/), desc: col(/description/), pack: col(/case\s*pack/), caseCost: col(/regular\s*case\s*cost|^case\s*cost/),
    cmap: col(/cmap|amap/, /total/), tpr: col(/tpr/), ad: col(/ad deal/), bb: col(/bill back/), ws: col(/awg|wholesal/), rs: col(/unit scan/, /awg|wholesal/),
    z3: col(/ps-3|rural/), z4: col(/ps-4|mid-comp/), z5: col(/ps-5|most-comp/), multi: col(/multi/),
  };
  const g = (row: Cell[], i: number) => i >= 0 ? row[i] ?? null : null;
  const lines: ParsedLine[] = [];
  for (let r = hIdx + 1; r < rows.length; r++) {
    const row = rows[r] ?? []; const upc = txt(g(row, C.upc)); if (!normUpc(upc)) continue;
    lines.push({
      upc, description: txt(g(row, C.desc)), casePack: num(g(row, C.pack)), caseCost: num(g(row, C.caseCost)),
      cmap: num(g(row, C.cmap)) ?? 0, tpr: num(g(row, C.tpr)) ?? 0, ad: num(g(row, C.ad)) ?? 0, billBack: num(g(row, C.bb)) ?? 0,
      wholesalerScan: num(g(row, C.ws)) ?? 0, retailerScan: num(g(row, C.rs)) ?? 0,
      zone3Retail: num(g(row, C.z3)), zone4Retail: num(g(row, C.z4)), zone5Retail: num(g(row, C.z5)), loyaltyMulti: txt(g(row, C.multi)) || null,
    });
  }
  return { sheet, header, adFee: num(val(/^ad fee/i)) ?? 0, periods, stores, lines };
}

/* Minimal .xlsx reader: reads cached cell values from the workbook XML. It ignores drawings, macros and styles,
   which is all the CAISSP import needs and avoids parser failures on templates with embedded images. */
const ENT: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
const unxml = (s: string) => s.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (_, e: string) =>
  e[0] === '#' ? String.fromCodePoint(e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)) : ENT[e.toLowerCase()] ?? _);
const textOf = (xml: string) => [...xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map(m => unxml(m[1])).join('');
const colIndex = (ref: string) => { let n = 0; for (const ch of ref.replace(/\d+/g, '')) n = n * 26 + (ch.charCodeAt(0) - 64); return n - 1; };

async function readWorkbook(buf: ArrayBuffer) {
  let zip: JSZip;
  try { zip = await JSZip.loadAsync(buf); } catch { throw new Error('This file could not be read as an .xlsx workbook.'); }
  const wbXml = await zip.file('xl/workbook.xml')?.async('string');
  if (!wbXml) throw new Error('This file is not an .xlsx workbook. Save it as Excel Workbook (.xlsx) and try again.');
  const rels = (await zip.file('xl/_rels/workbook.xml.rels')?.async('string')) ?? '';
  const relMap = new Map([...rels.matchAll(/<Relationship\b[^>]*>/g)].map(m => [/Id="([^"]+)"/.exec(m[0])?.[1] ?? '', /Target="([^"]+)"/.exec(m[0])?.[1] ?? '']));
  const ssXml = (await zip.file('xl/sharedStrings.xml')?.async('string')) ?? '';
  const shared = [...ssXml.matchAll(/<si>([\s\S]*?)<\/si>/g)].map(m => textOf(m[1]));
  const sheets = [...wbXml.matchAll(/<sheet\b[^>]*>/g)].map(m => ({ name: unxml(/name="([^"]*)"/.exec(m[0])?.[1] ?? ''), rid: /r:id="([^"]+)"/.exec(m[0])?.[1] ?? '' }));
  return { sheets, rows: async (rid: string) => {
    let target = relMap.get(rid) ?? ''; target = target.startsWith('/') ? target.slice(1) : 'xl/' + target.replace(/^\.\//, '');
    const xml = (await zip.file(target)?.async('string')) ?? '';
    const rows: Cell[][] = [];
    for (const rm of xml.matchAll(/<row\b([^>]*)>([\s\S]*?)<\/row>/g)) {
      const r = parseInt(/\br="(\d+)"/.exec(rm[1])?.[1] ?? '0', 10) - 1; if (r < 0 || r > 5000) continue;
      const out: Cell[] = [];
      for (const cm of rm[2].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
        const attrs = cm[1]; const body = cm[2] ?? '';
        const ref = /\br="([A-Z]+\d+)"/.exec(attrs)?.[1]; if (!ref) continue;
        const t = /\bt="([^"]+)"/.exec(attrs)?.[1];
        const v = /<v>([\s\S]*?)<\/v>/.exec(body)?.[1];
        let val: Cell = null;
        if (t === 's') val = v != null ? shared[parseInt(v, 10)] ?? '' : null;
        else if (t === 'inlineStr') val = textOf(body);
        else if (t === 'str' || t === 'e') val = v != null && t === 'str' ? unxml(v) : null;
        else if (t === 'b') val = v === '1' ? 'TRUE' : 'FALSE';
        else if (v != null && v !== '') { const n = Number(v); val = isFinite(n) ? n : unxml(v); }
        const c = colIndex(ref); if (c >= 0 && c < 200) out[c] = val;
      }
      rows[r] = out;
    }
    for (let i = 0; i < rows.length; i++) if (!rows[i]) rows[i] = [];
    return rows;
  } };
}

export async function parseCaisspFile(buf: ArrayBuffer): Promise<ParsedCaissp> {
  const wb = await readWorkbook(buf);
  const named = wb.sheets.find(s => /caissp/i.test(s.name));
  const cand = named ? [named, ...wb.sheets.filter(s => s !== named)] : wb.sheets;
  for (const s of cand) {
    const rows = await wb.rows(s.rid);
    if (rows.some(r => r.some(c => /item upc/i.test(txt(c))))) return parseRows(rows, s.name);
  }
  throw new Error('No sheet in this workbook has a CAISSP item table (a column named “Individual item UPC Code”).');
}

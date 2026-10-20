'use server';
import { redirect } from 'next/navigation';
import { and, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import { comments, dealLines, deals, events, fundingRequests, items, vendors } from '@/db/schema';
import { audit } from '@/lib/audit';
import { actorName, can, clientIp, inScope, isVendorUser, requireUser, type Me } from '@/lib/auth';
import { normUpc, parseCaisspFile } from '@/lib/caissp';
import { evaluateDeal, loadDeal, nextNumber, type LoadedDeal } from '@/lib/data';
import { back, str } from '@/lib/flash';
import { isoToday } from '@/lib/format';

const money = z.coerce.number().min(0).max(1_000_000).catch(0);
const optMoney = z.union([z.literal('').transform(() => null), z.coerce.number().min(0).max(100_000)]).nullable().catch(null);
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const PeriodKeys = ['amap', 'tpr', 'ad', 'bb', 'wscan', 'rscan'] as const;

const DealSchema = z.object({
  vendorId: z.string().optional(),
  eventId: z.string().min(1, 'Choose an event.'),
  title: z.string().trim().min(2, 'Give the deal a short title.').max(120),
  header: z.object({
    broker: z.string().max(120).optional(), salesperson: z.string().max(120).optional(), phone: z.string().max(40).optional(), email: z.string().max(160).optional(),
    promotion: z.string().max(160).optional(), adRunDates: z.string().max(80).optional(), aimContract: z.string().max(60).optional(),
    billingCompany: z.string().max(160).optional(), billingContact: z.string().max(120).optional(), billingEmail: z.string().max(160).optional(),
    feature: z.string().max(400).optional(), notes: z.string().max(2000).optional(),
  }).partial().default({}),
  periods: z.partialRecord(z.enum(PeriodKeys), z.object({ start: z.string().max(10), end: z.string().max(10) })).default({}),
  storeGroups: z.array(z.string().max(80)).max(20).default([]),
  adFee: money, accrualPct: z.coerce.number().min(0).max(0.5).catch(0),
  forecastUnits: z.union([z.literal('').transform(() => null), z.coerce.number().int().min(0).max(10_000_000)]).nullable().catch(null),
  signer: z.string().trim().max(120).optional(),
  lines: z.array(z.object({
    upc: z.string().trim().min(1).max(40),
    cmap: money, tpr: money, ad: money, billBack: money, wholesalerScan: money, retailerScan: money,
    zone3Retail: optMoney, zone4Retail: optMoney, zone5Retail: optMoney, loyaltyMulti: z.string().max(40).nullable().optional(),
  })).max(200),
});
export type DealPayload = z.input<typeof DealSchema>;

function canEdit(me: Me, d: { vendorId: string; status: string; createdById: string | null }) {
  if (!['DRAFT', 'SENT_BACK'].includes(d.status)) return false;
  if (isVendorUser(me)) return can(me, 'submit_deals') && me.vendor?.id === d.vendorId;
  return can(me, 'import_caissp') && d.createdById === me.user.id;
}

async function resolveLines(vendorId: string, lines: z.infer<typeof DealSchema>['lines']) {
  const upcs = [...new Set(lines.map(l => l.upc))];
  const all = upcs.length ? await db.select().from(items).where(inArray(items.upc, upcs)) : [];
  // Match by digits too, so 085390100110 finds 0-85390-10011 style keys.
  const allVendor = await db.select().from(items).where(eq(items.vendorId, vendorId));
  const find = (u: string) => all.find(i => i.upc === u) ?? allVendor.find(i => normUpc(i.upc) === normUpc(u));
  const unknown: string[] = [], foreign: string[] = [];
  const out = [] as (typeof dealLines.$inferInsert)[];
  lines.forEach((l, k) => {
    const it = find(l.upc);
    if (!it) { unknown.push(l.upc); return; }
    if (it.vendorId !== vendorId) { foreign.push(l.upc); return; }
    out.push({ dealId: '', upc: it.upc, description: it.description, casePack: it.casePack, caseCost: it.caseCost, regularRetail: it.regularRetail, baseWeeklyUnits: it.baseWeeklyUnits,
      cmap: l.cmap, tpr: l.tpr, ad: l.ad, billBack: l.billBack, wholesalerScan: l.wholesalerScan, retailerScan: l.retailerScan,
      zone3Retail: l.zone3Retail, zone4Retail: l.zone4Retail, zone5Retail: l.zone5Retail, loyaltyMulti: l.loyaltyMulti ?? null, sort: k });
  });
  return { out, unknown, foreign };
}

function datesFrom(periods: Record<string, { start: string; end: string }>, ev: { startDate: string; endDate: string }) {
  const ps = Object.values(periods).filter(p => isoDate.safeParse(p.start).success);
  if (!ps.length) return { start: ev.startDate, end: ev.endDate };
  return { start: ps.map(p => p.start).sort()[0], end: ps.map(p => isoDate.safeParse(p.end).success ? p.end : p.start).sort().slice(-1)[0] };
}

export type SaveState = { error?: string } | undefined;

export async function saveDeal(_: SaveState, form: FormData): Promise<SaveState> {
  const me = await requireUser();
  let raw: unknown;
  try { raw = JSON.parse(String(form.get('payload') ?? '{}')); } catch { return { error: 'The form could not be read. Reload the page and try again.' }; }
  const parsed = DealSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Check the form.' };
  const p = parsed.data;
  const dealId = String(form.get('dealId') ?? '') || null;

  let vendorId: string;
  if (isVendorUser(me)) {
    if (!can(me, 'submit_deals') || !me.vendor) return { error: `Your role (${me.role.name}) can’t create deals.` };
    vendorId = me.vendor.id;
  } else {
    if (!can(me, 'import_caissp')) return { error: `Your role (${me.role.name}) can’t enter deals for vendors.` };
    if (!p.vendorId) return { error: 'Choose the vendor this contract is from.' };
    vendorId = p.vendorId;
  }
  const vendor = (await db.select().from(vendors).where(eq(vendors.id, vendorId)))[0];
  if (!vendor || vendor.status !== 'ACTIVE') return { error: 'That vendor is not active.' };
  const ev = (await db.select().from(events).where(eq(events.id, p.eventId)))[0];
  if (!ev || ev.status === 'COMPLETED') return { error: 'Choose an open event.' };
  if (!p.lines.length) return { error: 'Add at least one UPC line.' };

  const { out, unknown, foreign } = await resolveLines(vendorId, p.lines);
  if (unknown.length) return { error: `Not in the item master: ${unknown.slice(0, 5).join(', ')}${unknown.length > 5 ? '…' : ''}. New items must be set up before they can be on a deal.` };
  if (foreign.length) return { error: `These UPCs belong to another brand owner: ${foreign.slice(0, 5).join(', ')}.` };
  const { start, end } = datesFrom(p.periods, ev);
  const header = { ...p.header, vendorNumber: vendor.number, datePresented: isoToday() };

  let id = dealId;
  await db.transaction(async tx => {
    if (id) {
      const cur = (await tx.select().from(deals).where(eq(deals.id, id)))[0];
      if (!cur || !canEdit(me, cur)) throw new Error('You can’t edit this deal.');
      await tx.update(deals).set({ eventId: ev.id, title: p.title, header, periods: p.periods, storeGroups: p.storeGroups, startDate: start, endDate: end, adFee: p.adFee, accrualPct: p.accrualPct, forecastUnits: p.forecastUnits, signer: p.signer || null, updatedAt: new Date() }).where(eq(deals.id, id));
      await tx.delete(dealLines).where(eq(dealLines.dealId, id));
      await tx.insert(dealLines).values(out.map(l => ({ ...l, dealId: id! })));
      await audit(tx, { actorId: me.user.id, actorName: actorName(me), action: 'Deal edited', objectType: 'deal', objectId: cur.number, detail: `${out.length} UPC lines · ${ev.name}`, ip: await clientIp() });
    } else {
      const number = await nextNumber(tx, 'deal', 'DL');
      const r = await tx.insert(deals).values({ number, vendorId, eventId: ev.id, title: p.title, header, periods: p.periods, storeGroups: p.storeGroups, startDate: start, endDate: end, adFee: p.adFee, accrualPct: p.accrualPct, forecastUnits: p.forecastUnits, signer: p.signer || null, imported: form.get('imported') === '1', createdById: me.user.id }).returning({ id: deals.id });
      id = r[0].id;
      await tx.insert(dealLines).values(out.map(l => ({ ...l, dealId: id! })));
      await audit(tx, { actorId: me.user.id, actorName: actorName(me), action: form.get('imported') === '1' ? 'CAISSP imported' : 'Deal drafted', objectType: 'deal', objectId: number, detail: `${vendor.name} · ${out.length} UPC lines · ${ev.name}`, ip: await clientIp() });
    }
  });
  redirect(`/deals/${id}?ok=${encodeURIComponent('Saved as a draft. Review the checks, then submit.')}`);
}

async function guardDeal(id: string) {
  const me = await requireUser();
  const d = await loadDeal(id);
  if (!d) throw new Error('Deal not found.');
  if (isVendorUser(me) && me.vendor?.id !== d.vendorId) throw new Error('Deal not found.');
  return { me, d };
}

async function approve(tx: Parameters<Parameters<typeof db.transaction>[0]>[0], d: LoadedDeal, by: { id: string | null; name: string }, note: string, auto: boolean, ruleVersion: number) {
  await tx.update(deals).set({ status: 'APPROVED', decidedAt: new Date(), decidedById: by.id, decidedByName: by.name, decisionNote: note || null, autoApproved: auto, ruleVersion, counterRate: null, updatedAt: new Date() }).where(eq(deals.id, d.id));
}

export async function submitDeal(form: FormData) {
  const { me, d } = await guardDeal(str(form, 'id', 64));
  const path = `/deals/${d.id}`;
  if (!canEdit(me, d)) back(path, { error: 'You can’t submit this deal.' });
  if (d.event.status !== 'PLANNING' && isVendorUser(me)) back(path, { error: `${d.event.name} is ${d.event.status.toLowerCase()} and no longer takes deals.` });
  if (!d.lines.length) back(path, { error: 'Add at least one UPC line before submitting.' });
  const signer = str(form, 'signer', 120) || d.signer;
  if (!signer) back(path, { error: 'Enter the name of the person authorized to sign this contract.' });
  const ev = await evaluateDeal(d);
  const rules = ev.rules;
  const resub = d.status === 'SENT_BACK';
  let msg = '';
  await db.transaction(async tx => {
    await tx.update(deals).set({ status: 'SUBMITTED', signer, submittedAt: new Date(), version: resub ? d.version + 1 : d.version, updatedAt: new Date() }).where(eq(deals.id, d.id));
    await audit(tx, { actorId: me.user.id, actorName: actorName(me), action: resub ? 'Deal resubmitted' : 'Deal submitted', objectType: 'deal', objectId: d.number, detail: `Signed by ${signer} · score ${ev.score} · ${ev.rec}`, ip: await clientIp() });
    await tx.update(fundingRequests).set({ status: 'ANSWERED', dealId: d.id }).where(and(eq(fundingRequests.vendorId, d.vendorId), eq(fundingRequests.eventId, d.eventId), eq(fundingRequests.status, 'OPEN')));
    if (rules.autoApprove && ev.rec === 'Approve') {
      await approve(tx, d, { id: null, name: 'Autopilot' }, `All ${ev.checks.length} rules passed`, true, ev.ruleVersion);
      await audit(tx, { actorName: 'Autopilot', action: 'Auto-approved', objectType: 'deal', objectId: d.number, detail: `All ${ev.checks.length} rules passed (rules v${ev.ruleVersion})` });
      msg = `${d.number} passed every rule and was approved automatically.`;
    } else msg = `${d.number} submitted for review.`;
  });
  back(path, { ok: msg });
}

export async function decideDeal(form: FormData) {
  const { me, d } = await guardDeal(str(form, 'id', 64));
  const path = `/deals/${d.id}`;
  const decision = str(form, 'decision', 20);
  const note = str(form, 'note', 1000);
  if (isVendorUser(me) || !can(me, 'approve_deals')) back(path, { error: `Your role (${me.role.name}) can’t decide on deals.` });
  if (d.status !== 'SUBMITTED') back(path, { error: 'Only submitted deals can be decided.' });
  if (!inScope(me, d.vendor.category)) back(path, { error: `${d.vendor.category} is not one of your categories.` });
  if (d.createdById === me.user.id) back(path, { error: 'You entered this deal, so another approver has to decide on it (segregation of duties).' });
  const ev = await evaluateDeal(d);
  if (decision === 'approve') {
    if (ev.econ.totalFunds > ev.rules.maxAuto && !can(me, 'approve_over_cap')) back(path, { error: `This deal is above the $${ev.rules.maxAuto.toLocaleString()} cap. A category director has to approve it.` });
    await db.transaction(async tx => {
      await approve(tx, d, { id: me.user.id, name: me.user.name }, note, false, ev.ruleVersion);
      await audit(tx, { actorId: me.user.id, actorName: actorName(me), action: 'Deal approved', objectType: 'deal', objectId: d.number, detail: `${note || 'Approved'} · ${ev.fails.length} rule exception${ev.fails.length === 1 ? '' : 's'} · rules v${ev.ruleVersion}`, ip: await clientIp() });
    });
    back(path, { ok: `${d.number} approved and added to the promo calendar.` });
  }
  if (decision === 'counter') {
    const rate = Number(str(form, 'rate', 20));
    if (!(rate > 0 && rate < 1000)) back(path, { error: 'Enter the counter funding per unit.' });
    if (!note) back(path, { error: 'Add a note so the vendor knows what to change.' });
    await db.transaction(async tx => {
      await tx.update(deals).set({ status: 'SENT_BACK', decidedAt: new Date(), decidedById: me.user.id, decidedByName: me.user.name, decisionNote: note, counterRate: rate, updatedAt: new Date() }).where(eq(deals.id, d.id));
      await tx.insert(comments).values({ dealId: d.id, userId: me.user.id, authorName: me.user.name, body: `Counter-offer: $${rate.toFixed(2)} per unit. ${note}` });
      await audit(tx, { actorId: me.user.id, actorName: actorName(me), action: 'Sent back with counter', objectType: 'deal', objectId: d.number, detail: `$${rate.toFixed(2)}/unit · ${note}`, ip: await clientIp() });
    });
    back(path, { ok: `${d.number} sent back to ${d.vendor.name}.` });
  }
  if (decision === 'reject') {
    if (!note) back(path, { error: 'A reason is required to reject a deal.' });
    await db.transaction(async tx => {
      await tx.update(deals).set({ status: 'REJECTED', decidedAt: new Date(), decidedById: me.user.id, decidedByName: me.user.name, decisionNote: note, updatedAt: new Date() }).where(eq(deals.id, d.id));
      await audit(tx, { actorId: me.user.id, actorName: actorName(me), action: 'Deal rejected', objectType: 'deal', objectId: d.number, detail: note, ip: await clientIp() });
    });
    back(path, { ok: `${d.number} rejected.` });
  }
  back(path, { error: 'Unknown decision.' });
}

/** Vendor accepts the counter: raises each UPC's unit scan so the weighted vendor funding reaches the counter, then resubmits. */
export async function acceptCounter(form: FormData) {
  const { me, d } = await guardDeal(str(form, 'id', 64));
  const path = `/deals/${d.id}`;
  if (!isVendorUser(me) || !canEdit(me, d) || d.status !== 'SENT_BACK' || !d.counterRate) back(path, { error: 'There is no counter-offer to accept.' });
  const ev = await evaluateDeal(d);
  const delta = Math.max(0, Math.round((d.counterRate! - ev.econ.vendorPU) * 100) / 100);
  await db.transaction(async tx => {
    for (const l of d.lines) await tx.update(dealLines).set({ retailerScan: Math.round((l.retailerScan + delta) * 100) / 100 }).where(eq(dealLines.id, l.id));
    const periods = { ...d.periods, rscan: d.periods.rscan ?? { start: d.startDate, end: d.endDate } };
    await tx.update(deals).set({ periods, updatedAt: new Date() }).where(eq(deals.id, d.id));
    await audit(tx, { actorId: me.user.id, actorName: actorName(me), action: 'Counter accepted', objectType: 'deal', objectId: d.number, detail: `Unit scan +$${delta.toFixed(2)} on ${d.lines.length} UPCs to reach $${d.counterRate!.toFixed(2)}/unit`, ip: await clientIp() });
  });
  const fd = new FormData(); fd.set('id', d.id); fd.set('signer', d.signer ?? me.user.name);
  return submitDeal(fd);
}

export async function withdrawDeal(form: FormData) {
  const { me, d } = await guardDeal(str(form, 'id', 64));
  const path = `/deals/${d.id}`;
  const own = isVendorUser(me) ? can(me, 'submit_deals') : d.createdById === me.user.id;
  if (!own || !['DRAFT', 'SUBMITTED', 'SENT_BACK'].includes(d.status)) back(path, { error: 'You can’t withdraw this deal.' });
  await db.transaction(async tx => {
    await tx.update(deals).set({ status: 'WITHDRAWN', updatedAt: new Date() }).where(eq(deals.id, d.id));
    await audit(tx, { actorId: me.user.id, actorName: actorName(me), action: 'Deal withdrawn', objectType: 'deal', objectId: d.number, detail: str(form, 'note', 300) || 'Withdrawn', ip: await clientIp() });
  });
  back(path, { ok: `${d.number} withdrawn.` });
}

export async function addComment(form: FormData) {
  const { me, d } = await guardDeal(str(form, 'id', 64));
  const body = str(form, 'body', 2000);
  const internal = !isVendorUser(me) && form.get('internal') === 'on';
  if (!body) back(`/deals/${d.id}`, { error: 'Write a comment first.' });
  await db.transaction(async tx => {
    await tx.insert(comments).values({ dealId: d.id, userId: me.user.id, authorName: me.user.name, body, internal });
    await audit(tx, { actorId: me.user.id, actorName: actorName(me), action: internal ? 'Internal note added' : 'Comment added', objectType: 'deal', objectId: d.number, detail: body.slice(0, 300) });
  });
  back(`/deals/${d.id}#comments`, { ok: 'Comment posted.' });
}

export type ImportState = { error?: string } | undefined;
export async function importCaissp(_: ImportState, form: FormData): Promise<ImportState> {
  const me = await requireUser();
  const vendorUser = isVendorUser(me);
  if (vendorUser ? !can(me, 'submit_deals') : !can(me, 'import_caissp')) return { error: `Your role (${me.role.name}) can’t import CAISSPs.` };
  const file = form.get('file');
  if (!(file instanceof File) || file.size === 0) return { error: 'Choose a CAISSP .xlsx file.' };
  if (file.size > 5 * 1024 * 1024) return { error: 'That file is larger than 5 MB.' };
  if (!/\.xls[xm]$/i.test(file.name)) return { error: 'Upload the CAISSP as an .xlsx file.' };
  let p;
  try { p = await parseCaisspFile(await file.arrayBuffer()); } catch (e) { return { error: (e as Error).message }; }
  if (!p.lines.length) return { error: 'The CAISSP has no item lines yet. Add UPCs to the item table and try again.' };

  let vendor;
  if (vendorUser) vendor = me.vendor!;
  else {
    const chosen = str(form, 'vendorId', 64);
    const all = await db.select().from(vendors).where(eq(vendors.status, 'ACTIVE'));
    vendor = chosen ? all.find(v => v.id === chosen) : all.find(v => normUpc(v.number) && normUpc(v.number) === normUpc(p.header.vendorNumber));
    if (!vendor) return { error: `No active vendor matches vendor number “${p.header.vendorNumber || 'blank'}”. Choose the vendor and import again.` };
  }
  const allEvents = await db.select().from(events);
  const start = Object.values(p.periods).map(x => x!.start).sort()[0];
  const chosenEv = str(form, 'eventId', 64);
  const ev = (chosenEv && allEvents.find(e => e.id === chosenEv)) || (start && allEvents.find(e => e.status !== 'COMPLETED' && start >= e.startDate && start <= e.endDate)) || null;
  if (!ev) return { error: 'No open event covers the CAISSP dates. Choose the event and import again.' };

  const vendorItems = await db.select().from(items).where(eq(items.vendorId, vendor.id));
  const known = p.lines.filter(l => vendorItems.some(i => normUpc(i.upc) === normUpc(l.upc)));
  const unknown = p.lines.filter(l => !known.includes(l));
  if (!known.length) return { error: `None of the ${p.lines.length} UPCs are ${vendor.name} items in the item master (${unknown.slice(0, 3).map(l => l.upc).join(', ')}…). Set the items up first.` };
  const { start: s, end: e } = datesFrom(p.periods as Record<string, { start: string; end: string }>, ev);
  let id = '';
  await db.transaction(async tx => {
    const number = await nextNumber(tx, 'deal', 'DL');
    const r = await tx.insert(deals).values({
      number, vendorId: vendor!.id, eventId: ev.id, title: (p.header.feature || p.header.promotion || `${vendor!.name} CAISSP`).slice(0, 120), imported: true, createdById: me.user.id,
      header: { ...p.header, vendorNumber: vendor!.number }, periods: p.periods, storeGroups: p.stores, startDate: s, endDate: e, adFee: p.adFee, signer: p.header.salesperson || null,
    }).returning({ id: deals.id });
    id = r[0].id;
    await tx.insert(dealLines).values(known.map((l, k) => { const it = vendorItems.find(i => normUpc(i.upc) === normUpc(l.upc))!; return {
      dealId: id, upc: it.upc, description: it.description, casePack: it.casePack, caseCost: it.caseCost, regularRetail: it.regularRetail, baseWeeklyUnits: it.baseWeeklyUnits,
      cmap: l.cmap, tpr: l.tpr, ad: l.ad, billBack: l.billBack, wholesalerScan: l.wholesalerScan, retailerScan: l.retailerScan,
      zone3Retail: l.zone3Retail, zone4Retail: l.zone4Retail, zone5Retail: l.zone5Retail, loyaltyMulti: l.loyaltyMulti, sort: k }; }));
    await audit(tx, { actorId: me.user.id, actorName: actorName(me), action: 'CAISSP imported', objectType: 'deal', objectId: number, detail: `${file.name} · sheet ${p.sheet} · ${known.length} of ${p.lines.length} UPC lines${unknown.length ? ` · not in item master: ${unknown.map(l => l.upc).join(', ')}` : ''}`, ip: await clientIp() });
  });
  const note = unknown.length ? `Imported ${known.length} of ${p.lines.length} lines. Not in the item master: ${unknown.slice(0, 4).map(l => l.upc).join(', ')}${unknown.length > 4 ? '…' : ''}.` : `Imported ${known.length} UPC lines as a draft. Review, then submit.`;
  redirect(`/deals/${id}?${unknown.length ? 'error' : 'ok'}=${encodeURIComponent(note)}`);
}


'use server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import { events } from '@/db/schema';
import { audit } from '@/lib/audit';
import { actorName, clientIp, requirePerm } from '@/lib/auth';
import { nextNumber } from '@/lib/data';
import { back, str } from '@/lib/flash';

const EventSchema = z.object({
  name: z.string().trim().min(2, 'Name the event.').max(80),
  theme: z.string().trim().max(200),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Enter a start date.'),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Enter an end date.'),
  vehicles: z.string().max(400),
  mediaBudget: z.coerce.number().min(0).max(100_000_000),
  fundingTarget: z.coerce.number().min(0).max(100_000_000),
}).refine(v => v.endDate >= v.startDate, { message: 'The end date must be on or after the start date.' });

const quarter = (iso: string) => { const d = new Date(iso + 'T12:00:00Z'); return `Q${Math.floor(d.getUTCMonth() / 3) + 1} ${d.getUTCFullYear()}`; };

export async function saveEvent(form: FormData) {
  const me = await requirePerm('plan_events');
  const id = str(form, 'id', 64);
  const p = EventSchema.safeParse(Object.fromEntries(['name', 'theme', 'startDate', 'endDate', 'vehicles', 'mediaBudget', 'fundingTarget'].map(k => [k, str(form, k, 400)])));
  if (!p.success) back(id ? `/events/${id}` : '/events/new', { error: p.error.issues[0].message });
  const v = { ...p.data, vehicles: p.data.vehicles.split(',').map(x => x.trim()).filter(Boolean), quarter: quarter(p.data.startDate) };
  let eid = id;
  await db.transaction(async tx => {
    if (id) {
      const cur = (await tx.select().from(events).where(eq(events.id, id)))[0];
      if (!cur) throw new Error('Event not found.');
      await tx.update(events).set(v).where(eq(events.id, id));
      await audit(tx, { actorId: me.user.id, actorName: actorName(me), action: 'Event edited', objectType: 'event', objectId: cur.code, detail: `${v.name} · ${v.startDate} to ${v.endDate} · media $${v.mediaBudget.toLocaleString()} · target $${v.fundingTarget.toLocaleString()}`, ip: await clientIp() });
    } else {
      const code = await nextNumber(tx, 'event', 'EV', 3);
      const r = await tx.insert(events).values({ ...v, code }).returning({ id: events.id });
      eid = r[0].id;
      await audit(tx, { actorId: me.user.id, actorName: actorName(me), action: 'Event created', objectType: 'event', objectId: code, detail: `${v.name} · ${v.startDate} to ${v.endDate}`, ip: await clientIp() });
    }
  });
  back(`/events/${eid}`, { ok: 'Event saved.' });
}

export async function setEventStatus(form: FormData) {
  const me = await requirePerm('plan_events');
  const id = str(form, 'id', 64), status = str(form, 'status', 20) as 'PLANNING' | 'LOCKED' | 'COMPLETED';
  if (!['PLANNING', 'LOCKED', 'COMPLETED'].includes(status)) back(`/events/${id}`, { error: 'Unknown status.' });
  const cur = (await db.select().from(events).where(eq(events.id, id)))[0];
  if (!cur) back('/events', { error: 'Event not found.' });
  await db.transaction(async tx => {
    await tx.update(events).set({ status }).where(eq(events.id, id));
    await audit(tx, { actorId: me.user.id, actorName: actorName(me), action: status === 'LOCKED' ? 'Event plan locked' : status === 'COMPLETED' ? 'Event completed' : 'Event reopened', objectType: 'event', objectId: cur.code, detail: cur.name, ip: await clientIp() });
  });
  back(`/events/${id}`, { ok: status === 'LOCKED' ? 'Plan locked. Vendors can no longer submit deals to this event.' : 'Event updated.' });
}

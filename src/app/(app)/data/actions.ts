'use server';
import { revalidatePath } from 'next/cache';
import { actorName, can, clientIp, requireUser } from '@/lib/auth';
import { ingestActuals, ingestBbm, type IngestResult } from '@/lib/ingest';

export type UploadState = IngestResult | { ok: false; message: string; problems?: string[] } | undefined;
const MAX_BYTES = 5 * 1024 * 1024;

async function readFile(form: FormData) {
  const f = form.get('file');
  if (!(f instanceof File) || !f.size) return { error: 'Choose a CSV file.' } as const;
  if (f.size > MAX_BYTES) return { error: 'Files up to 5 MB. Split larger exports by month.' } as const;
  if (!/\.(csv|txt|tsv)$/i.test(f.name)) return { error: 'Save the file as CSV first (File → Save As → CSV).' } as const;
  return { name: f.name, text: await f.text() } as const;
}

export async function uploadActuals(_: UploadState, form: FormData): Promise<UploadState> {
  const me = await requireUser();
  if (!can(me, 'upload_actuals')) return { ok: false, message: `Your role (${me.role.name}) can’t upload sales or receipts.` };
  const kind = form.get('kind') === 'RECEIPTS' ? 'RECEIPTS' : 'SALES';
  const f = await readFile(form); if ('error' in f) return { ok: false, message: f.error! };
  const r = await ingestActuals(kind, f.name, f.text, { id: me.user.id, name: actorName(me), ip: await clientIp() });
  revalidatePath('/data');
  return r;
}

export async function importBillBackManager(_: UploadState, form: FormData): Promise<UploadState> {
  const me = await requireUser();
  if (!can(me, 'manage_billing')) return { ok: false, message: `Your role (${me.role.name}) can’t import billing files.` };
  const f = await readFile(form); if ('error' in f) return { ok: false, message: f.error! };
  const r = await ingestBbm(f.name, f.text, { id: me.user.id, name: actorName(me), ip: await clientIp() });
  revalidatePath('/billing');
  return r;
}

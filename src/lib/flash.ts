import 'server-only';
import { redirect } from 'next/navigation';

/** Redirect back with a message shown by <Flash/>. Messages are plain text rendered by React (escaped). */
export function back(path: string, msg: { ok?: string; error?: string }): never {
  const q = new URLSearchParams();
  if (msg.ok) q.set('ok', msg.ok.slice(0, 300));
  if (msg.error) q.set('error', msg.error.slice(0, 300));
  redirect(`${path}${path.includes('?') ? '&' : '?'}${q.toString()}`);
}
export const str = (f: FormData, k: string, max = 500) => String(f.get(k) ?? '').trim().slice(0, max);
export const numf = (f: FormData, k: string) => { const v = Number(String(f.get(k) ?? '').replace(/[$,]/g, '')); return isFinite(v) ? v : 0; };

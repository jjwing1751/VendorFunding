'use server';
import { revalidatePath } from 'next/cache';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { guideProgress, users } from '@/db/schema';
import { requireUser } from '@/lib/auth';
import { back, str } from '@/lib/flash';
import { guideFor } from '@/lib/guides';

const ret = (form: FormData) => (str(form, 'from', 20) === 'home' ? '/' : '/guide');

export async function markStep(form: FormData) {
  const me = await requireUser();
  const key = str(form, 'step', 40);
  if (!guideFor(me.role.name)?.steps.some(s => s.key === key)) back(ret(form), { error: 'Unknown step.' });
  await db.insert(guideProgress).values({ userId: me.user.id, stepKey: key }).onConflictDoNothing();
  revalidatePath(ret(form));
}

export async function unmarkStep(form: FormData) {
  const me = await requireUser();
  await db.delete(guideProgress).where(and(eq(guideProgress.userId, me.user.id), eq(guideProgress.stepKey, str(form, 'step', 40))));
  revalidatePath(ret(form));
}

export async function restartGuide(form: FormData) {
  const me = await requireUser();
  await db.delete(guideProgress).where(eq(guideProgress.userId, me.user.id));
  await db.update(users).set({ guideStartedAt: new Date() }).where(eq(users.id, me.user.id));
  back(ret(form), { ok: 'Walkthrough restarted. Steps now count only what you do from here.' });
}

import 'server-only';
import { db } from '@/db';
import { vendors } from '@/db/schema';
export async function allCategories() { return [...new Set((await db.select({ c: vendors.category }).from(vendors)).map(r => r.c))].sort(); }

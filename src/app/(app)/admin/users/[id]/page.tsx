import { notFound } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { roles, users, vendors } from '@/db/schema';
import { can, requireUser } from '@/lib/auth';
import { Flash, PageHead } from '@/components/ui';
import { UserDetail } from '../../UserDetail';

export default async function UserPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; error?: string }> }) {
  const me = await requireUser();
  if (!can(me, 'manage_users')) return <PageHead title="User" sub="Only admins can manage users." />;
  const row = (await db.select({ u: users, r: roles, v: vendors }).from(users).innerJoin(roles, eq(roles.id, users.roleId)).leftJoin(vendors, eq(vendors.id, users.vendorId)).where(eq(users.id, (await params).id)))[0];
  if (!row) notFound();
  return <><PageHead title={row.u.name} sub={`${row.u.email} · ${row.r.name} · ${row.v?.name ?? 'Retailer'}`} /><Flash sp={await searchParams} /><UserDetail u={row.u} me={me} /></>;
}

import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import path from 'node:path';

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set');
  const pool = new Pool({ connectionString: url, ssl: /\.render\.com|sslmode=require/.test(url) ? { rejectUnauthorized: false } : undefined });
  await migrate(drizzle(pool), { migrationsFolder: path.join(process.cwd(), 'drizzle') });
  await pool.end();
  console.log('[migrate] database is up to date');
}
main().catch(e => { console.error('[migrate] failed', e); process.exit(1); });

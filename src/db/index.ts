import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

const globalForDb = globalThis as unknown as { pool?: Pool };

function makePool() {
  // No connection is opened until the first query, so builds without DATABASE_URL still succeed.
  const url = process.env.DATABASE_URL ?? '';
  // Render's internal URL needs no TLS; external hostnames (*.render.com) or sslmode=require do.
  const needsTls = /\.render\.com|sslmode=require/.test(url);
  return new Pool({ connectionString: url, max: 10, ssl: needsTls ? { rejectUnauthorized: false } : undefined });
}

export const pool = globalForDb.pool ?? makePool();
if (process.env.NODE_ENV !== 'production') globalForDb.pool = pool;

export const db = drizzle(pool, { schema });
export type DB = typeof db;
export { schema };

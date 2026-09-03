import { neon } from '@neondatabase/serverless';

// Ambil URL database dari Vercel Environment Variables
const url = process.env.DATABASE_URL || 'postgres://user:pass@ep-fake.us-east-2.aws.neon.tech/dbname';
const sql = neon(url);

export async function openDb() {
  return sql;
}

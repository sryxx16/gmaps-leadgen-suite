import { openDb } from '@/lib/db';
import DashboardClient from './DashboardClient';

export default async function Dashboard() {
  const sql = await openDb();
  
  // Ambil data leads
  // Kita harus menggunakan tanda kutip ("") untuk nama tabel & kolom yang mengandung huruf besar (Postgres case-sensitive)
  const leads = await sql`
    SELECT 
      l.id, 
      l.name, 
      l.address, 
      l.phone, 
      l.website, 
      l."mapsUrl", 
      l."scrapedAt", 
      l.rating,
      l."reviewCount",
      c.name as "categoryName"
    FROM "Lead" l
    LEFT JOIN "Category" c ON l."categoryId" = c.id
    ORDER BY l."scrapedAt" DESC
  `;
  
  // Ambil semua kategori yang ada di sistem
  const categories = await sql`SELECT * FROM "Category" ORDER BY name`;

  return (
    <DashboardClient initialLeads={leads} categories={categories} />
  );
}

import { openDb } from '@/lib/db';
import DashboardClient from './DashboardClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function Dashboard() {
  const sql = await openDb();
  
  // Ambil data leads terbaru beserta kolom baru
  const leads = await sql`
    SELECT 
      l.id, 
      l.name, 
      l.address, 
      l.phone, 
      l.whatsapp,
      l.website, 
      l."socialMedia",
      l."onlineShop",
      l."aiResearch",
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

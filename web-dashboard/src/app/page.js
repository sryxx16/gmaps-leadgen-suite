import { openDb } from '@/lib/db';
import DashboardClient from './DashboardClient';

export default async function Dashboard() {
  const db = await openDb();
  
  // Ambil data leads
  const leads = await db.all(`
    SELECT L.*, C.name as categoryName 
    FROM Lead L
    LEFT JOIN Category C ON L.categoryId = C.id
    ORDER BY L.id DESC
  `);
  
  // Ambil semua kategori yang ada di sistem
  const categories = await db.all('SELECT * FROM Category ORDER BY name');

  return (
    <DashboardClient initialLeads={leads} categories={categories} />
  );
}

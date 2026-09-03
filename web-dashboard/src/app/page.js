import { openDb } from '@/lib/db';
import DashboardClient from './DashboardClient';

export default async function Dashboard() {
  const db = await openDb();
  
  // Ambil data leads
  const leadsResult = await db.execute(`
    SELECT L.*, C.name as categoryName 
    FROM Lead L
    LEFT JOIN Category C ON L.categoryId = C.id
    ORDER BY L.id DESC
  `);
  const leads = leadsResult.rows;
  
  // Ambil semua kategori yang ada di sistem
  const categoriesResult = await db.execute('SELECT * FROM Category ORDER BY name');
  const categories = categoriesResult.rows;

  return (
    <DashboardClient initialLeads={leads} categories={categories} />
  );
}

import { openDb } from '@/lib/db';
import DashboardClient from './DashboardClient';

export default async function Dashboard() {
  const supabase = await openDb();
  
  // Ambil data leads
  const { data: leads, error: leadsError } = await supabase
    .from('Lead')
    .select('*, categoryName:Category(name)')
    .order('id', { ascending: false });

  if (leadsError) console.error("Error fetching leads from Supabase:", leadsError);

  // Rapikan format relasi categoryName dari objek ke string
  const formattedLeads = leads ? leads.map(l => ({
    ...l,
    categoryName: l.categoryName?.name || 'Tanpa Kategori'
  })) : [];
  
  // Ambil semua kategori yang ada di sistem
  const { data: categories, error: catsError } = await supabase
    .from('Category')
    .select('*')
    .order('name');
    
  if (catsError) console.error("Error fetching categories:", catsError);

  return (
    <DashboardClient initialLeads={formattedLeads} categories={categories || []} />
  );
}

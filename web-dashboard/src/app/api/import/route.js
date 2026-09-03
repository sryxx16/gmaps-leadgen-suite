import { NextResponse } from 'next/server';
import { openDb } from '@/lib/db';

export async function POST(request) {
  try {
    const { data, categoryName } = await request.json();
    const supabase = await openDb();

    // 1. Dapatkan atau buat kategori jika diisi manual
    let manualCatId = null;
    if (categoryName) {
      let { data: catData } = await supabase
        .from('Category')
        .select('id')
        .eq('name', categoryName)
        .maybeSingle();
        
      if (!catData) {
        const { data: newCat, error: insertError } = await supabase
          .from('Category')
          .insert([{ name: categoryName }])
          .select()
          .single();
          
        if (insertError) throw insertError;
        manualCatId = newCat.id;
      } else {
        manualCatId = catData.id;
      }
    }

    // 2. Insert leads (secara bulk)
    let insertedCount = 0;
    const leadsToInsert = [];
    
    for (const lead of data) {
      const finalCategoryName = categoryName || lead.category;
      let finalCatId = manualCatId;
      
      if (!categoryName && finalCategoryName) {
         let { data: cData } = await supabase
           .from('Category')
           .select('id')
           .eq('name', finalCategoryName)
           .maybeSingle();
           
         if (!cData) {
           const { data: newCat } = await supabase
             .from('Category')
             .insert([{ name: finalCategoryName }])
             .select()
             .single();
           finalCatId = newCat?.id;
         } else {
           finalCatId = cData.id;
         }
      }

      leadsToInsert.push({
        name: lead.name,
        address: lead.address || '',
        phone: lead.phone || '',
        website: lead.website || '',
        mapsUrl: lead.mapsUrl || '',
        scrapedAt: lead.scrapedAt || new Date().toISOString(),
        categoryId: finalCatId
      });
    }

    if (leadsToInsert.length > 0) {
      const { error: insertLeadsError } = await supabase
        .from('Lead')
        .insert(leadsToInsert);
        
      if (insertLeadsError) throw insertLeadsError;
      insertedCount = leadsToInsert.length;
    }

    return NextResponse.json({ success: true, inserted: insertedCount });
  } catch (error) {
    console.error('Import error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

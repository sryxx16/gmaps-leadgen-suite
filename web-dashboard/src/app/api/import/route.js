import { NextResponse } from 'next/server';
import { openDb } from '@/lib/db';

export async function POST(request) {
  try {
    const { data, categoryName } = await request.json();
    const sql = await openDb();

    // 1. Dapatkan atau buat kategori jika diisi manual
    let manualCatId = null;
    if (categoryName) {
      let cat = await sql`SELECT id FROM "Category" WHERE name = ${categoryName}`;
        
      if (cat.length === 0) {
        const result = await sql`INSERT INTO "Category" (name) VALUES (${categoryName}) RETURNING id`;
        manualCatId = result[0].id;
      } else {
        manualCatId = cat[0].id;
      }
    }

    // 2. Insert leads
    let insertedCount = 0;
    
    for (const lead of data) {
      const finalCategoryName = categoryName || lead.category;
      let finalCatId = manualCatId;
      
      if (!categoryName && finalCategoryName) {
         let c = await sql`SELECT id FROM "Category" WHERE name = ${finalCategoryName}`;
           
         if (c.length === 0) {
           const res = await sql`INSERT INTO "Category" (name) VALUES (${finalCategoryName}) RETURNING id`;
           finalCatId = res[0].id;
         } else {
           finalCatId = c[0].id;
         }
      }

      await sql`
        INSERT INTO "Lead" (name, address, phone, website, "mapsUrl", "scrapedAt", "categoryId", rating, "reviewCount")
        VALUES (
          ${lead.name}, 
          ${lead.address || ''}, 
          ${lead.phone || ''}, 
          ${lead.website || ''}, 
          ${lead.mapsUrl || ''}, 
          ${lead.scrapedAt || new Date().toISOString()}, 
          ${finalCatId},
          ${lead.rating || ''},
          ${lead.reviewCount || ''}
        )
      `;
      insertedCount++;
    }

    return NextResponse.json({ success: true, inserted: insertedCount });
  } catch (error) {
    console.error('Import error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

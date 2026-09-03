import { NextResponse } from 'next/server';
import { openDb } from '@/lib/db';

export async function POST(request) {
  try {
    const { data, categoryName } = await request.json();
    const db = await openDb();

    // 1. Dapatkan atau buat kategori jika diisi manual
    let manualCatId = null;
    if (categoryName) {
      let catResult = await db.execute('SELECT id FROM Category WHERE name = ?', [categoryName]);
      let cat = catResult.rows[0];
      if (!cat) {
        const result = await db.execute('INSERT INTO Category (name) VALUES (?)', [categoryName]);
        manualCatId = result.lastInsertRowid;
      } else {
        manualCatId = cat.id;
      }
    }

    // 2. Insert leads
    let insertedCount = 0;
    for (const lead of data) {
      const finalCategoryName = categoryName || lead.category;
      let finalCatId = manualCatId;
      
      if (!categoryName && finalCategoryName) {
         let cResult = await db.execute('SELECT id FROM Category WHERE name = ?', [finalCategoryName]);
         let c = cResult.rows[0];
         if (!c) {
           const res = await db.execute('INSERT INTO Category (name) VALUES (?)', [finalCategoryName]);
           finalCatId = res.lastInsertRowid;
         } else {
           finalCatId = c.id;
         }
      }

      await db.execute(`
        INSERT INTO Lead (name, address, phone, website, mapsUrl, scrapedAt, categoryId)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [
        lead.name, 
        lead.address || '', 
        lead.phone || '', 
        lead.website || '', 
        lead.mapsUrl || '', 
        lead.scrapedAt || new Date().toISOString(), 
        finalCatId
      ]);
      insertedCount++;
    }

    return NextResponse.json({ success: true, inserted: insertedCount });
  } catch (error) {
    console.error('Import error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

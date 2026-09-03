import { NextResponse } from 'next/server';
import { openDb } from '@/lib/db';

export async function POST(request) {
  try {
    const { data, categoryName } = await request.json();
    const db = await openDb();

    // 1. Dapatkan atau buat kategori jika diisi manual
    let manualCatId = null;
    if (categoryName) {
      let cat = await db.get('SELECT id FROM Category WHERE name = ?', [categoryName]);
      if (!cat) {
        const result = await db.run('INSERT INTO Category (name) VALUES (?)', [categoryName]);
        manualCatId = result.lastID;
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
         let c = await db.get('SELECT id FROM Category WHERE name = ?', [finalCategoryName]);
         if (!c) {
           const res = await db.run('INSERT INTO Category (name) VALUES (?)', [finalCategoryName]);
           finalCatId = res.lastID;
         } else {
           finalCatId = c.id;
         }
      }

      await db.run(`
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

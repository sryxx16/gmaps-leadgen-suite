import { createClient } from '@libsql/client';

let db = null;

export async function openDb() {
  if (!db) {
    // Gunakan Turso Cloud jika ada URL-nya, atau gunakan file lokal jika tidak ada (buat ngetes di komputer sendiri)
    db = createClient({
      url: process.env.TURSO_DATABASE_URL || 'file:leads.db',
      authToken: process.env.TURSO_AUTH_TOKEN,
    });

    // Inisialisasi tabel jika belum ada
    await db.execute(`
      CREATE TABLE IF NOT EXISTS Category (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL
      );
    `);
    
    await db.execute(`
      CREATE TABLE IF NOT EXISTS Lead (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        address TEXT,
        phone TEXT,
        website TEXT,
        mapsUrl TEXT,
        scrapedAt TEXT,
        categoryId INTEGER,
        FOREIGN KEY(categoryId) REFERENCES Category(id)
      );
    `);
  }
  return db;
}

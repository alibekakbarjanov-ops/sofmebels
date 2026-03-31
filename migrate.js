/* =============================================
   SOF SHOP — Migration (faqat yangi ustun/jadvallar)
   Ishlatish: node migrate.js
   ⚠ Mavjud ma'lumotlarni buzmaydi!
============================================= */
import pg from "pg";
import dotenv from "dotenv";
dotenv.config();

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const SQL = `
-- products jadvaliga stock va sold_count qo'shish (agar yo'q bo'lsa)
ALTER TABLE products ADD COLUMN IF NOT EXISTS stock      INT DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS sold_count INT DEFAULT 0;

-- Mahsulot sharhlari jadvali
CREATE TABLE IF NOT EXISTS product_reviews (
  id          TEXT PRIMARY KEY,
  product_id  TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  user_uid    TEXT NOT NULL,
  order_id    TEXT NOT NULL,
  first_name  TEXT DEFAULT '',
  last_name   TEXT DEFAULT '',
  pros        TEXT DEFAULT '',
  cons        TEXT DEFAULT '',
  comment     TEXT DEFAULT '',
  created_at  BIGINT DEFAULT EXTRACT(EPOCH FROM NOW())*1000
);

CREATE INDEX IF NOT EXISTS idx_reviews_product ON product_reviews(product_id);
CREATE INDEX IF NOT EXISTS idx_reviews_user    ON product_reviews(user_uid);
`;

async function migrate() {
  const client = await pool.connect();
  try {
    console.log("🔗 Ulanmoqda...");
    await client.query(SQL);
    console.log("✅ Migration muvaffaqiyatli bajarildi!");
    console.log("   + products.stock       ustuni qo'shildi");
    console.log("   + products.sold_count  ustuni qo'shildi");
    console.log("   + product_reviews      jadvali yaratildi");
  } catch (err) {
    console.error("❌ Xato:", err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
/* =============================================
   SOF SHOP — PostgreSQL jadvallarni yaratish
   Ishlatish: node setup-db.js
============================================= */
import pg from "pg";
import dotenv from "dotenv";
dotenv.config();

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const SQL = `
-- ── Foydalanuvchilar (mijozlar) — Firebase UID bilan ─────────
CREATE TABLE IF NOT EXISTS users (
  uid          TEXT PRIMARY KEY,
  customer_id  TEXT UNIQUE,
  email        TEXT,
  first_name   TEXT NOT NULL DEFAULT '',
  last_name    TEXT NOT NULL DEFAULT '',
  phone        TEXT,
  lang         TEXT DEFAULT 'uz',
  region       TEXT,
  district     TEXT,
  lat          DOUBLE PRECISION,
  lng          DOUBLE PRECISION,
  last_seen    BIGINT DEFAULT 0,
  created_at   BIGINT DEFAULT EXTRACT(EPOCH FROM NOW())*1000
);

-- ── Mijoz autentifikatsiyasi — telefon + parol bilan login ────
--    (Firebase ishlatmaydiganlar uchun)
CREATE TABLE IF NOT EXISTS customer_auth (
  uid          TEXT PRIMARY KEY,           -- users.uid bilan bir xil
  phone        TEXT NOT NULL UNIQUE,
  password     TEXT NOT NULL,              -- bcrypt hash
  created_at   BIGINT DEFAULT EXTRACT(EPOCH FROM NOW())*1000
);

-- ── Admin / Shofer foydalanuvchilar ──────────────────────────
CREATE TABLE IF NOT EXISTS admin_users (
  uid          TEXT PRIMARY KEY,
  first_name   TEXT NOT NULL DEFAULT '',
  last_name    TEXT NOT NULL DEFAULT '',
  phone        TEXT UNIQUE NOT NULL,
  password     TEXT NOT NULL,
  role         TEXT NOT NULL DEFAULT 'admin',
  lat          DOUBLE PRECISION,
  lng          DOUBLE PRECISION,
  created_at   BIGINT DEFAULT EXTRACT(EPOCH FROM NOW())*1000
);

-- ── Mahsulotlar ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS products (
  id               TEXT PRIMARY KEY,
  name             TEXT NOT NULL DEFAULT '',
  code             TEXT UNIQUE NOT NULL DEFAULT '',
  price            BIGINT NOT NULL DEFAULT 0,
  price_3m         BIGINT DEFAULT 0,
  price_6m         BIGINT DEFAULT 0,
  price_12m        BIGINT DEFAULT 0,
  discount_percent INT DEFAULT 0,
  new_until        BIGINT DEFAULT 0,
  category         TEXT DEFAULT '',
  subcategory      TEXT DEFAULT '',
  colors           TEXT DEFAULT '',
  description      TEXT DEFAULT '',
  images           TEXT[] DEFAULT '{}',
  created_at       BIGINT DEFAULT EXTRACT(EPOCH FROM NOW())*1000
);

-- ── Reklama tanlangan mahsulotlar ────────────────────────────
CREATE TABLE IF NOT EXISTS ads_selected (
  product_id  TEXT PRIMARY KEY REFERENCES products(id) ON DELETE CASCADE
);

-- ── Sevimlilar ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS favorites (
  user_uid    TEXT NOT NULL,
  product_id  TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  PRIMARY KEY (user_uid, product_id)
);

-- ── Savat ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cart (
  user_uid    TEXT NOT NULL,
  product_id  TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  qty         INT DEFAULT 1,
  color       TEXT DEFAULT '',
  PRIMARY KEY (user_uid, product_id)
);

-- ── Buyurtmalar ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS orders (
  order_id         TEXT PRIMARY KEY,
  user_uid         TEXT,
  customer_id      TEXT,
  total            BIGINT DEFAULT 0,
  items            JSONB DEFAULT '[]',
  user_data        JSONB DEFAULT '{}',
  status_on_way    BOOLEAN DEFAULT FALSE,
  status_delivered BOOLEAN DEFAULT FALSE,
  assigned_driver  TEXT DEFAULT '',
  driver_name      TEXT DEFAULT '',
  delivered_at     BIGINT,
  created_at       BIGINT DEFAULT EXTRACT(EPOCH FROM NOW())*1000
);
-- ── Indekslar (tezlashtirish) ─────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_users_phone       ON users(phone);
CREATE INDEX IF NOT EXISTS idx_cauth_phone       ON customer_auth(phone);
CREATE INDEX IF NOT EXISTS idx_orders_uid        ON orders(user_uid);
CREATE INDEX IF NOT EXISTS idx_orders_status     ON orders(status_on_way, status_delivered);
CREATE INDEX IF NOT EXISTS idx_orders_driver     ON orders(assigned_driver);
CREATE INDEX IF NOT EXISTS idx_orders_created    ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_products_code     ON products(code);
CREATE INDEX IF NOT EXISTS idx_products_created  ON products(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_fav_user          ON favorites(user_uid);
CREATE INDEX IF NOT EXISTS idx_cart_user         ON cart(user_uid);
`;

async function setup() {
  try {
    console.log("🔗 PostgreSQL ga ulanmoqda...");
    const client = await pool.connect();
    console.log("✅ Ulandi!");
    console.log("📦 Jadvallar yaratilmoqda...");
    await client.query(SQL);
    client.release();
    console.log("✅ Barcha jadvallar muvaffaqiyatli yaratildi!");
    console.log("\n📋 Jadvallar:");
    console.log("   users           — Mijozlar (Firebase UID yoki telefon bilan)");
    console.log("   customer_auth   — Mijoz login (telefon + parol)  ← YANGI");
    console.log("   admin_users     — Admin va shoferlar");
    console.log("   products        — Mahsulotlar");
    console.log("   ads_selected    — Reklama mahsulotlari");
    console.log("   favorites       — Sevimlilar");
    console.log("   cart            — Savat");
    console.log("   orders          — Buyurtmalar");
    console.log("\n🚀 Endi serverni ishga tushiring: npm start");
  } catch (err) {
    console.error("❌ Xato:", err.message);
    console.error("\n💡 .env faylida DATABASE_URL ni tekshiring");
  } finally {
    await pool.end();
  }
}

setup();
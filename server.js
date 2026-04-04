/* =============================================
   SOF SHOP — Backend Server  (server.js)
   Node.js + Express + PostgreSQL

   Barcha endpointlar:
   POST /api/auth/register-admin    — admin/shofer ro'yxatdan o'tish
   POST /api/auth/login-admin       — admin/shofer kirish

   POST /api/auth/register          — MIJOZ ro'yxatdan o'tish (telefon+parol)
   POST /api/auth/login             — MIJOZ kirish (telefon+parol)
   GET  /api/auth/me                — MIJOZ profilini olish (token bilan)

   POST /api/users/sync             — Firebase user ni PG ga saqlash
   GET  /api/users                  — barcha mijozlar (admin)
   GET  /api/users/:uid             — bitta foydalanuvchi

   GET  /api/products               — mahsulotlar ro'yxati
   GET  /api/products/:id           — bitta mahsulot
   POST /api/products               — yangi mahsulot (admin)
   PUT  /api/products/:id           — yangilash (admin)
   DELETE /api/products/:id         — o'chirish (admin)

   GET  /api/ads                    — reklama mahsulotlari
   POST /api/ads                    — reklamani saqlash (admin)

   GET  /api/favorites/:uid         — sevimlilar
   POST /api/favorites              — sevimlilarga qo'shish
   DELETE /api/favorites            — sevimlilardan o'chirish

   GET  /api/cart/:uid              — savat
   POST /api/cart                   — savatga qo'shish
   DELETE /api/cart                 — savatdan o'chirish

   GET  /api/orders                 — buyurtmalar (filter: status, uid, driverId)
   GET  /api/orders/:id             — bitta buyurtma
   POST /api/orders                 — buyurtma yaratish
   PUT  /api/orders/:id/assign      — shoferga tayinlash
   PUT  /api/orders/:id/delivered   — yetkazildi
   GET  /api/orders/driver/:drvId   — shoferga tegishli buyurtmalar
   GET  /api/my-orders/:uid         — mijoz o'z buyurtmalari

   GET  /api/admin-users            — admin/shoferlar ro'yxati
   PUT  /api/admin-users/:uid/location  — shofer GPS koordinatasi

   GET  /api/health                 — server holati
============================================= */

import express        from "express";
import cors           from "cors";
import dotenv         from "dotenv";
import bcrypt         from "bcryptjs";
import jwt            from "jsonwebtoken";
import { query }      from "./db.js";
import { randomUUID } from "crypto";
import { createServer } from "http";
import { Server as SocketIO } from "socket.io";

dotenv.config();

const app        = express();
const httpServer = createServer(app);
const io         = new SocketIO(httpServer, {
  cors: { origin: "*", methods: ["GET","POST","PUT","DELETE"] }
});
const PORT = process.env.PORT || 4000;

/* ── Socket.io — Realtime ulanish boshqaruvi ──
   Xonalar (rooms):
     "admins"  — barcha adminlar
     "drivers" — barcha shoferlar
     uid       — har bir foydalanuvchiga shaxsiy xona
── */
io.on("connection", socket => {
  console.log("🔌 Socket ulandi:", socket.id);

  // Xonaga qo'shilish
  socket.on("join", ({ role, uid }) => {
    if (role === "admin")  socket.join("admins");
    if (role === "driver") { socket.join("drivers"); socket.join("drv_" + uid); }
    if (uid) socket.join("user_" + uid);
    console.log(`👤 ${role || "guest"} (${uid || "?"}) xonaga kirdi`);
  });

  socket.on("disconnect", () => {
    console.log("🔌 Socket uzildi:", socket.id);
  });
});

/* ── io ni boshqa modullar uchun global ── */
app._io = io;
const JWT_SECRET          = process.env.JWT_SECRET          || "sofshop_secret";
const CUSTOMER_JWT_SECRET = process.env.CUSTOMER_JWT_SECRET || "sofshop_customer_secret";

/* ─── Middleware ─── */
app.use(cors({ origin: "*" }));
app.use(express.json({ limit: "50mb" })); // rasm base64 uchun katta limit

/* ─── Admin JWT tekshirish ─── */
function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return res.status(401).json({ error: "Token kerak" });
  try {
    req.admin = jwt.verify(header.slice(7), JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: "Token noto'g'ri yoki muddati o'tgan" });
  }
}

/* ─── Mijoz JWT tekshirish ─── */
function customerAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return res.status(401).json({ error: "Token kerak" });
  try {
    req.customer = jwt.verify(header.slice(7), CUSTOMER_JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: "Token noto'g'ri yoki muddati o'tgan" });
  }
}

/* ─── Helper ─── */
const nowMs = () => Date.now();

/* ═══════════════════════════════════════
   AUTH — Mijozlar (telefon + parol)
═══════════════════════════════════════ */

// Mijoz ro'yxatdan o'tish
app.post("/api/auth/register", async (req, res) => {
  try {
    const { firstName, lastName, phone, password, region, district, lang } = req.body;

    if (!firstName || !lastName || !phone || !password)
      return res.status(400).json({ error: "Barcha maydonlar to'ldirilishi kerak" });
    if (password.length < 6)
      return res.status(400).json({ error: "Parol kamida 6 ta belgi bo'lishi kerak" });

    // Telefon band emasligini tekshirish
    const exist = await query("SELECT uid FROM customer_auth WHERE phone=$1", [phone]);
    if (exist.rows.length)
      return res.status(409).json({ error: "Bu telefon raqam allaqachon ro'yxatdan o'tgan" });

    const uid        = "cust_" + randomUUID().replace(/-/g, "").slice(0, 16);
    const customerId = String(Math.floor(1000000 + Math.random() * 9000000));
    const hash       = await bcrypt.hash(password, 10);

    // Mijoz profilini saqlash
    await query(
      `INSERT INTO users (uid, customer_id, first_name, last_name, phone, lang, region, district, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [uid, customerId, firstName, lastName, phone, lang || "uz",
       region || null, district || null, nowMs()]
    );

    // Login ma'lumotlarini saqlash
    await query(
      `INSERT INTO customer_auth (uid, phone, password, created_at) VALUES ($1,$2,$3,$4)`,
      [uid, phone, hash, nowMs()]
    );

    const user  = { uid, customerId, firstName, lastName, phone, region, district, lang: lang || "uz" };
    const token = jwt.sign(user, CUSTOMER_JWT_SECRET, { expiresIn: "30d" });
    res.status(201).json({ user, token });
  } catch (err) {
    console.error("register:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// Mijoz kirish
app.post("/api/auth/login", async (req, res) => {
  try {
    const { phone, password } = req.body;
    if (!phone || !password)
      return res.status(400).json({ error: "Telefon va parol kiritilmagan" });

    // Autentifikatsiya ma'lumotini topish
    const authRow = await query(
      "SELECT * FROM customer_auth WHERE phone=$1", [phone]
    );
    if (!authRow.rows.length)
      return res.status(404).json({ error: "Foydalanuvchi topilmadi. Ro'yxatdan o'ting." });

    const ok = await bcrypt.compare(password, authRow.rows[0].password);
    if (!ok) return res.status(401).json({ error: "Parol noto'g'ri" });

    // Profil ma'lumotlarini olish
    const uid     = authRow.rows[0].uid;
    const profile = await query("SELECT * FROM users WHERE uid=$1", [uid]);
    if (!profile.rows.length)
      return res.status(404).json({ error: "Profil topilmadi" });

    const r    = profile.rows[0];
    const user = {
      uid:        r.uid,
      customerId: r.customer_id,
      firstName:  r.first_name,
      lastName:   r.last_name,
      phone:      r.phone,
      email:      r.email,
      region:     r.region,
      district:   r.district,
      lang:       r.lang,
    };
    const token = jwt.sign(user, CUSTOMER_JWT_SECRET, { expiresIn: "30d" });
    res.json({ user, token });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Mijoz profilini olish (token bilan)
app.get("/api/auth/me", customerAuth, async (req, res) => {
  try {
    const result = await query("SELECT * FROM users WHERE uid=$1", [req.customer.uid]);
    if (!result.rows.length)
      return res.status(404).json({ error: "Profil topilmadi" });
    const r = result.rows[0];
    res.json({
      uid:        r.uid,
      customerId: r.customer_id,
      firstName:  r.first_name,
      lastName:   r.last_name,
      phone:      r.phone,
      email:      r.email,
      region:     r.region,
      district:   r.district,
      lang:       r.lang,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Mijoz profilini yangilash
app.put("/api/auth/me", customerAuth, async (req, res) => {
  try {
    const { firstName, lastName, region, district, lang, email } = req.body;
    await query(
      `UPDATE users SET
         first_name=$2, last_name=$3, region=$4, district=$5, lang=$6, email=$7
       WHERE uid=$1`,
      [req.customer.uid, firstName || "", lastName || "",
       region || null, district || null, lang || "uz", email || null]
    );
    const result = await query("SELECT * FROM users WHERE uid=$1", [req.customer.uid]);
    const r = result.rows[0];
    res.json({
      uid: r.uid, customerId: r.customer_id,
      firstName: r.first_name, lastName: r.last_name,
      phone: r.phone, email: r.email,
      region: r.region, district: r.district, lang: r.lang,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Mijoz parolini o'zgartirish
app.put("/api/auth/change-password", customerAuth, async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    if (!oldPassword || !newPassword)
      return res.status(400).json({ error: "Eski va yangi parol kiritilmagan" });
    if (newPassword.length < 6)
      return res.status(400).json({ error: "Yangi parol kamida 6 ta belgi" });

    const authRow = await query("SELECT * FROM customer_auth WHERE uid=$1", [req.customer.uid]);
    if (!authRow.rows.length)
      return res.status(404).json({ error: "Foydalanuvchi topilmadi" });

    const ok = await bcrypt.compare(oldPassword, authRow.rows[0].password);
    if (!ok) return res.status(401).json({ error: "Eski parol noto'g'ri" });

    const hash = await bcrypt.hash(newPassword, 10);
    await query("UPDATE customer_auth SET password=$2 WHERE uid=$1", [req.customer.uid, hash]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ═══════════════════════════════════════
   AUTH — Admin / Shofer
═══════════════════════════════════════ */

// Ro'yxatdan o'tish
app.post("/api/auth/register-admin", async (req, res) => {
  try {
    const { firstName, lastName, phone, password, role = "admin" } = req.body;

    if (!firstName || !lastName || !phone || !password)
      return res.status(400).json({ error: "Barcha maydonlar to'ldirilishi kerak" });
    if (password.length < 6)
      return res.status(400).json({ error: "Parol kamida 6 ta belgi bo'lishi kerak" });
    if (!["admin", "driver"].includes(role))
      return res.status(400).json({ error: "Rol: admin yoki driver bo'lishi kerak" });

    const uid = "adm_" + phone.replace(/\D/g, "");

    const exist = await query("SELECT uid FROM admin_users WHERE uid=$1", [uid]);
    if (exist.rows.length)
      return res.status(409).json({ error: "Bu telefon raqam allaqachon ro'yxatdan o'tgan" });

    const hash = await bcrypt.hash(password, 10);
    await query(
      `INSERT INTO admin_users (uid, first_name, last_name, phone, password, role, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [uid, firstName, lastName, phone, hash, role, nowMs()]
    );

    const user  = { uid, firstName, lastName, phone, role };
    const token = jwt.sign(user, JWT_SECRET, { expiresIn: "30d" });
    res.json({ user, token });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Kirish
app.post("/api/auth/login-admin", async (req, res) => {
  try {
    const { phone, password } = req.body;
    if (!phone || !password)
      return res.status(400).json({ error: "Telefon va parol kiritilmagan" });

    const uid    = "adm_" + phone.replace(/\D/g, "");
    const result = await query("SELECT * FROM admin_users WHERE uid=$1", [uid]);
    if (!result.rows.length)
      return res.status(404).json({ error: "Foydalanuvchi topilmadi. Ro'yxatdan o'ting." });

    const row = result.rows[0];
    const ok  = await bcrypt.compare(password, row.password);
    if (!ok) return res.status(401).json({ error: "Parol noto'g'ri" });

    const user = {
      uid:       row.uid,
      firstName: row.first_name,
      lastName:  row.last_name,
      phone:     row.phone,
      role:      row.role,
    };
    const token = jwt.sign(user, JWT_SECRET, { expiresIn: "30d" });
    res.json({ user, token });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ═══════════════════════════════════════
   USERS — Mijozlar (Firebase UID bilan)
═══════════════════════════════════════ */

// Firebase user ni PostgreSQL ga sync qilish
app.post("/api/users/sync", async (req, res) => {
  try {
    const { uid, customerId, email, firstName, lastName, phone, lang, region, district } = req.body;
    if (!uid) return res.status(400).json({ error: "uid kerak" });

    await query(
      `INSERT INTO users (uid, customer_id, email, first_name, last_name, phone, lang, region, district, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       ON CONFLICT (uid) DO UPDATE SET
         customer_id = EXCLUDED.customer_id,
         email       = EXCLUDED.email,
         first_name  = EXCLUDED.first_name,
         last_name   = EXCLUDED.last_name,
         phone       = EXCLUDED.phone,
         lang        = EXCLUDED.lang,
         region      = EXCLUDED.region,
         district    = EXCLUDED.district`,
      [uid, customerId || null, email || null, firstName || "", lastName || "",
       phone || null, lang || "uz", region || null, district || null, nowMs()]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Barcha mijozlar (admin)
app.get("/api/users", authMiddleware, async (req, res) => {
  try {
    const q = req.query.q || "";
    const result = await query(
      `SELECT uid, customer_id, first_name, last_name, phone, email, region, district, lat, lng, last_seen, created_at
       FROM users
       WHERE ($1 = '' OR LOWER(first_name||' '||last_name) LIKE $2 OR phone LIKE $2)
       ORDER BY created_at DESC`,
      [q, q ? `%${q.toLowerCase()}%` : ""]
    );
    res.json(result.rows.map(r => ({
      uid:        r.uid,
      customerId: r.customer_id,
      firstName:  r.first_name,
      lastName:   r.last_name,
      phone:      r.phone,
      email:      r.email,
      region:     r.region,
      district:   r.district,
      lat:        r.lat      || null,
      lng:        r.lng      || null,
      lastSeen:   r.last_seen || 0,
    })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Bitta foydalanuvchi
app.get("/api/users/:uid", async (req, res) => {
  try {
    const result = await query("SELECT * FROM users WHERE uid=$1", [req.params.uid]);
    if (!result.rows.length) return res.status(404).json({ error: "Topilmadi" });
    const r = result.rows[0];
    res.json({
      uid:        r.uid,
      customerId: r.customer_id,
      firstName:  r.first_name,
      lastName:   r.last_name,
      phone:      r.phone,
      email:      r.email,
      region:     r.region,
      district:   r.district,
      lang:       r.lang,
      lat:        r.lat    || null,
      lng:        r.lng    || null,
      lastSeen:   r.last_seen || 0,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ── Mijoz GPS joylashuvi (avto, bildirmasdan) ── */
app.put("/api/users/:uid/location", async (req, res) => {
  try {
    const { lat, lng } = req.body;
    if (lat == null || lng == null) return res.status(400).json({ error: "lat va lng kerak" });
    await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS lat DOUBLE PRECISION;`).catch(()=>{});
    await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS lng DOUBLE PRECISION;`).catch(()=>{});
    await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_seen BIGINT DEFAULT 0;`).catch(()=>{});
    await query(
      `UPDATE users SET lat=$2, lng=$3, last_seen=$4 WHERE uid=$1`,
      [req.params.uid, lat, lng, Date.now()]
    );
    // 📡 Adminlarga realtime GPS yangilash
    io.to("admins").emit("user_location", { uid: req.params.uid, lat, lng, ts: Date.now() });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ═══════════════════════════════════════
   PRODUCTS
═══════════════════════════════════════ */

// Ro'yxat
app.get("/api/products", async (req, res) => {
  try {
    const q   = req.query.q   || "";
    const cat = req.query.cat || "";
    const sub = req.query.sub || "";

    const result = await query(
      `SELECT * FROM products
       WHERE ($1='' OR LOWER(name) LIKE $2 OR LOWER(code) LIKE $2)
         AND ($3='' OR category=$3)
         AND ($4='' OR subcategory=$4)
       ORDER BY created_at DESC`,
      [q, q ? `%${q.toLowerCase()}%` : "", cat, sub]
    );
    res.json(result.rows.map(rowToProduct));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Qolmagan mahsulotlar — stock <= 0 (admin)
app.get("/api/products/out-of-stock", authMiddleware, async (req, res) => {
  try {
    const result = await query(
      `SELECT * FROM products WHERE COALESCE(stock, 0) <= 0 ORDER BY created_at DESC`
    );
    res.json(result.rows.map(rowToProduct));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// Bitta mahsulot
app.get("/api/products/:id", async (req, res) => {
  try {
    const result = await query("SELECT * FROM products WHERE id=$1", [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ error: "Topilmadi" });
    res.json(rowToProduct(result.rows[0]));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Yaratish (admin)
app.post("/api/products", authMiddleware, async (req, res) => {
  try {
    const p  = req.body;
    const id = randomUUID();
    await query(
      `INSERT INTO products
         (id, name, code, price, price_3m, price_6m, price_12m,
          discount_percent, new_until, category, subcategory,
          colors, description, images, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
      [id, p.name, p.code, p.price || 0, p.price3m || 0, p.price6m || 0, p.price12m || 0,
       p.discountPercent || 0, p.newUntil || 0, p.category || "", p.subcategory || "",
       p.colors || "", p.desc || "", p.images || [], nowMs()]
    );
    const row = await query("SELECT * FROM products WHERE id=$1", [id]);
    res.json(rowToProduct(row.rows[0]));
  } catch (err) {
    if (err.code === "23505") return res.status(409).json({ error: "Bu kod allaqachon mavjud" });
    res.status(500).json({ error: err.message });
  }
});

// Yangilash (admin)
app.put("/api/products/:id", authMiddleware, async (req, res) => {
  try {
    const p  = req.body;
    const id = req.params.id;
    await query(
      `UPDATE products SET
         name=$2, code=$3, price=$4, price_3m=$5, price_6m=$6, price_12m=$7,
         discount_percent=$8, new_until=$9, category=$10, subcategory=$11,
         colors=$12, description=$13, images=$14
       WHERE id=$1`,
      [id, p.name, p.code, p.price || 0, p.price3m || 0, p.price6m || 0, p.price12m || 0,
       p.discountPercent || 0, p.newUntil || 0, p.category || "", p.subcategory || "",
       p.colors || "", p.desc || "", p.images || []]
    );
    const row = await query("SELECT * FROM products WHERE id=$1", [id]);
    res.json(rowToProduct(row.rows[0]));
  } catch (err) {
    if (err.code === "23505") return res.status(409).json({ error: "Bu kod allaqachon mavjud" });
    res.status(500).json({ error: err.message });
  }
});

// O'chirish (admin)
app.delete("/api/products/:id", authMiddleware, async (req, res) => {
  try {
    await query("DELETE FROM products WHERE id=$1", [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// Stokni toldirish — PUT /api/products/:id/restock (admin)
app.put("/api/products/:id/restock", authMiddleware, async (req, res) => {
  try {
    const id  = req.params.id;
    const qty = Number(req.body.qty) || 0;
    if (qty < 1) return res.status(400).json({ error: "qty kamida 1 bolishi kerak" });
    const result = await query(
      `UPDATE products SET stock = COALESCE(stock, 0) + $2 WHERE id=$1 RETURNING *`,
      [id, qty]
    );
    if (!result.rows.length) return res.status(404).json({ error: "Mahsulot topilmadi" });
    res.json(rowToProduct(result.rows[0]));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

function rowToProduct(r) {
  return {
    id:              r.id,
    name:            r.name,
    code:            r.code,
    price:           Number(r.price),
    price3m:         Number(r.price_3m),
    price6m:         Number(r.price_6m),
    price12m:        Number(r.price_12m),
    discountPercent: Number(r.discount_percent),
    newUntil:        Number(r.new_until),
    category:        r.category,
    subcategory:     r.subcategory,
    colors:          r.colors,
    desc:            r.description,
    images:          r.images || [],
    stock:           Number(r.stock    || 0),
    soldCount:       Number(r.sold_count || 0),
    createdAt:       Number(r.created_at),
  };
}

/* ═══════════════════════════════════════
   ADS
═══════════════════════════════════════ */

// Hozirgi reklamalar
app.get("/api/ads", async (req, res) => {
  try {
    const result = await query(
      `SELECT p.* FROM ads_selected a
       JOIN products p ON p.id = a.product_id
       ORDER BY p.created_at DESC`
    );
    res.json(result.rows.map(rowToProduct));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Reklamani saqlash (admin)
app.post("/api/ads", authMiddleware, async (req, res) => {
  try {
    const { productIds = [] } = req.body;
    await query("DELETE FROM ads_selected");
    for (const pid of productIds) {
      await query(
        "INSERT INTO ads_selected (product_id) VALUES ($1) ON CONFLICT DO NOTHING",
        [pid]
      );
    }
    res.json({ ok: true, count: productIds.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ═══════════════════════════════════════
   FAVORITES
═══════════════════════════════════════ */

app.get("/api/favorites/:uid", async (req, res) => {
  try {
    const result = await query(
      `SELECT p.* FROM favorites f
       JOIN products p ON p.id = f.product_id
       WHERE f.user_uid=$1`,
      [req.params.uid]
    );
    res.json(result.rows.map(rowToProduct));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/favorites", async (req, res) => {
  try {
    const { uid, productId } = req.body;
    await query(
      "INSERT INTO favorites (user_uid, product_id) VALUES ($1,$2) ON CONFLICT DO NOTHING",
      [uid, productId]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/favorites", async (req, res) => {
  try {
    const { uid, productId } = req.body;
    await query("DELETE FROM favorites WHERE user_uid=$1 AND product_id=$2", [uid, productId]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ═══════════════════════════════════════
   CART
═══════════════════════════════════════ */

app.get("/api/cart/:uid", async (req, res) => {
  try {
    const result = await query(
      `SELECT c.qty, c.color, p.*
       FROM cart c JOIN products p ON p.id=c.product_id
       WHERE c.user_uid=$1`,
      [req.params.uid]
    );
    res.json(result.rows.map(r => ({ ...rowToProduct(r), qty: r.qty, color: r.color })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/cart", async (req, res) => {
  try {
    const { uid, productId, qty = 1, color = "" } = req.body;
    await query(
      `INSERT INTO cart (user_uid, product_id, qty, color)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (user_uid, product_id)
       DO UPDATE SET qty=EXCLUDED.qty, color=EXCLUDED.color`,
      [uid, productId, qty, color]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/cart", async (req, res) => {
  try {
    const { uid, productId } = req.body;
    if (productId) {
      await query("DELETE FROM cart WHERE user_uid=$1 AND product_id=$2", [uid, productId]);
    } else {
      await query("DELETE FROM cart WHERE user_uid=$1", [uid]);
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ═══════════════════════════════════════
   ORDERS
═══════════════════════════════════════ */

// ⚠️  Bu route /orders/:id dan OLDIN bo'lishi shart!
// Shoferga tegishli buyurtmalar — user jadvalidan ham lat/lng olamiz
app.get("/api/orders/driver/:drvId", authMiddleware, async (req, res) => {
  try {
    const result = await query(
      `SELECT o.*,
              u.lat  AS user_lat,
              u.lng  AS user_lng,
              u.last_seen AS user_last_seen
       FROM orders o
       LEFT JOIN users u ON u.uid = o.user_uid
       WHERE o.assigned_driver=$1
         AND o.status_on_way=true
         AND o.status_delivered=false
       ORDER BY o.created_at DESC`,
      [req.params.drvId]
    );
    res.json(result.rows.map(r => {
      const order = rowToOrder(r);
      // users jadvalidagi koordinatlar user_data dankigiiga ustunlik qiladi
      if (r.user_lat) order.user.lat = parseFloat(r.user_lat);
      if (r.user_lng) order.user.lng = parseFloat(r.user_lng);
      return order;
    }));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Ro'yxat (filterlash: ?status=new|delivery|done | ?uid= | ?driverId=)
app.get("/api/orders", authMiddleware, async (req, res) => {
  try {
    const { status, uid, driverId } = req.query;

    let where = "WHERE 1=1";
    const params = [];

    if (status === "new") {
      where += " AND status_on_way=false AND status_delivered=false";
    } else if (status === "delivery") {
      where += " AND status_on_way=true AND status_delivered=false";
    } else if (status === "done") {
      where += " AND status_delivered=true";
    }
    if (uid) {
      params.push(uid);
      where += ` AND user_uid=$${params.length}`;
    }
    if (driverId) {
      params.push(driverId);
      where += ` AND assigned_driver=$${params.length}`;
    }

    const result = await query(
      `SELECT * FROM orders ${where} ORDER BY created_at DESC`,
      params
    );
    res.json(result.rows.map(rowToOrder));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Bitta buyurtma
app.get("/api/orders/:id", authMiddleware, async (req, res) => {
  try {
    const result = await query("SELECT * FROM orders WHERE order_id=$1", [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ error: "Topilmadi" });
    res.json(rowToOrder(result.rows[0]));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Foydalanuvchi o'z buyurtmalarini ko'rishi
app.get("/api/my-orders/:uid", async (req, res) => {
  try {
    const result = await query(
      "SELECT * FROM orders WHERE user_uid=$1 ORDER BY created_at DESC",
      [req.params.uid]
    );
    res.json(result.rows.map(rowToOrder));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Buyurtma yaratish
app.post("/api/orders", async (req, res) => {
  try {
    const { userUid, customerId, total, items, userData } = req.body;
    const orderId = randomUUID();
    await query(
      `INSERT INTO orders
         (order_id, user_uid, customer_id, total, items, user_data, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [orderId, userUid || null, customerId || null, total || 0,
       JSON.stringify(items || []), JSON.stringify(userData || {}), nowMs()]
    );
    // 📦 Har bir mahsulot uchun stock kamaytirish, sold_count oshirish
    if (Array.isArray(items) && items.length) {
      for (const item of items) {
        const qty = Number(item.qty || item.quantity || 1);
        if (item.id || item.productId) {
          const pid = item.id || item.productId;
          await query(
            `UPDATE products
             SET stock      = GREATEST(COALESCE(stock, 0) - $2, 0),
                 sold_count = COALESCE(sold_count, 0) + $2
             WHERE id = $1`,
            [pid, qty]
          );
        }
      }
    }
    // 🔔 Barcha adminlarga yangi buyurtma haqida xabar
    const newOrder = {
      orderId, userUid, customerId, total: total || 0,
      items: items || [], user: userData || {},
      status: { onWay: false, delivered: false },
      createdAt: nowMs(),
    };
    io.to("admins").emit("new_order", newOrder);
    // Mijozga ham o'z buyurtmasi haqida
    if (userUid) io.to("user_" + userUid).emit("order_created", newOrder);
    res.json({ orderId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Shoferga tayinlash
app.put("/api/orders/:id/assign", authMiddleware, async (req, res) => {
  try {
    const { driverId, driverName } = req.body;
    await query(
      `UPDATE orders SET
         status_on_way=true, assigned_driver=$2, driver_name=$3
       WHERE order_id=$1`,
      [req.params.id, driverId, driverName || ""]
    );
    const payload = { orderId: req.params.id, driverId, driverName: driverName || "", status: "on_way" };
    // Shoferga: yangi buyurtma
    io.to("drv_" + driverId).emit("order_assigned", payload);
    // Barcha adminlarga: buyurtma holati o'zgardi
    io.to("admins").emit("order_updated", payload);
    // Mijozga: "Yo'lda" holati
    const orderRes = await query("SELECT user_uid FROM orders WHERE order_id=$1", [req.params.id]);
    if (orderRes.rows[0]?.user_uid) {
      io.to("user_" + orderRes.rows[0].user_uid).emit("my_order_updated", payload);
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Yetkazildi
app.put("/api/orders/:id/delivered", authMiddleware, async (req, res) => {
  try {
    const now = nowMs();
    await query(
      `UPDATE orders SET status_delivered=true, delivered_at=$2 WHERE order_id=$1`,
      [req.params.id, now]
    );
    const payload = { orderId: req.params.id, status: "delivered", deliveredAt: now };
    // Barcha adminlarga
    io.to("admins").emit("order_updated", payload);
    // Shoferlar xonasiga ham (UI yangilash uchun)
    io.to("drivers").emit("order_delivered", payload);
    // Mijozga: yetkazildi bildirishnoması
    const orderRes = await query("SELECT user_uid FROM orders WHERE order_id=$1", [req.params.id]);
    if (orderRes.rows[0]?.user_uid) {
      io.to("user_" + orderRes.rows[0].user_uid).emit("my_order_updated", payload);
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

function rowToOrder(r) {
  const userData = r.user_data || {};
  return {
    orderId:        r.order_id,
    userUid:        r.user_uid,
    customerId:     r.customer_id,
    total:          Number(r.total),
    items:          r.items || [],
    user:           userData,
    status: {
      onWay:      r.status_on_way,
      delivered:  r.status_delivered,
    },
    assignedDriver: r.assigned_driver,
    driverName:     r.driver_name,
    deliveredAt:    r.delivered_at ? Number(r.delivered_at) : null,
    createdAt:      Number(r.created_at),
  };
}

/* ═══════════════════════════════════════
   ADMIN USERS (Admin va Shoferlar)
═══════════════════════════════════════ */

// Ro'yxat
app.get("/api/admin-users", authMiddleware, async (req, res) => {
  try {
    const role = req.query.role || "";
    const result = await query(
      `SELECT uid, first_name, last_name, phone, role, lat, lng, created_at
       FROM admin_users
       WHERE ($1='' OR role=$1)
       ORDER BY created_at DESC`,
      [role]
    );
    res.json(result.rows.map(r => ({
      uid:       r.uid,
      firstName: r.first_name,
      lastName:  r.last_name,
      phone:     r.phone,
      role:      r.role,
      lat:       r.lat,
      lng:       r.lng,
    })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Shofer GPS koordinatani yangilash
app.put("/api/admin-users/:uid/location", async (req, res) => {  // authMiddleware olib tashlandi — frontend token o'tkazmaydi
  try {
    const { lat, lng } = req.body;
    await query(
      "UPDATE admin_users SET lat=$2, lng=$3 WHERE uid=$1",
      [req.params.uid, lat, lng]
    );
    // 📡 Barcha adminlarga shofer GPS yangilash
    io.to("admins").emit("driver_location", { uid: req.params.uid, lat, lng, ts: Date.now() });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ─── Health check ─── */
app.get("/health", async (req, res) => {
  try {
    await query("SELECT 1");
    res.json({ ok: true, db: "PostgreSQL ulandi ✅", time: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Eski URL ham ishlaydi
app.get("/api/health", (req, res) => res.redirect("/health"));

/* ─── 404 ─── */
app.use((req, res) => {
  res.status(404).json({ error: "Endpoint topilmadi: " + req.path });
});

/* ─── Start ─── */
httpServer.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════╗
║   SOF SHOP Backend ishga tushdi! ✅      ║
╠══════════════════════════════════════════╣
║  URL:  https://sofmebels-npsk.onrender.com              ║
║  DB:   PostgreSQL                        ║
╚══════════════════════════════════════════╝

Mijoz auth (YANGI):
  POST https://sofmebels-npsk.onrender.com/api/auth/register        ← ro'yxat
  POST https://sofmebels-npsk.onrender.com/api/auth/login           ← kirish
  GET  https://sofmebels-npsk.onrender.com//api/auth/me              ← profil (token)
  PUT  https://sofmebels-npsk.onrender.com/api/auth/me              ← profil yangilash
  PUT  https://sofmebels-npsk.onrender.com//api/auth/change-password ← parol o'zgartirish

Admin auth:
  POST https://sofmebels-npsk.onrender.com/api/auth/register-admin
  POST https://sofmebels-npsk.onrender.com/api/auth/login-admin

Health: https://sofmebels-npsk.onrender.com/
  `);
});

# SOF SHOP — Backend

## Tez ishga tushirish

```bash
# 1. Paketlarni o'rnatish
npm install

# 2. .env faylini to'ldiring (DATABASE_URL, JWT_SECRET, CUSTOMER_JWT_SECRET)

# 3. Jadvallarni yaratish (bir marta)
npm run setup

# 4. Serverni ishga tushirish
npm start
```

---

## Jadvallar

| Jadval | Vazifasi |
|--------|----------|
| `users` | Barcha mijozlar (Firebase UID yoki telefon) |
| `customer_auth` | Mijoz login — telefon + bcrypt parol ✨ YANGI |
| `admin_users` | Admin va shoferlar |
| `products` | Mahsulotlar |
| `ads_selected` | Reklama slider mahsulotlari |
| `favorites` | Sevimlilar |
| `cart` | Savat |
| `orders` | Buyurtmalar |

---

## Mijoz Auth API (YANGI) ✨

### Ro'yxatdan o'tish
```
POST /api/auth/register
Body: { firstName, lastName, phone, password, region, district, lang }
Response: { user, token }
```

### Kirish
```
POST /api/auth/login
Body: { phone, password }
Response: { user, token }
```

### Profilni olish (token bilan)
```
GET /api/auth/me
Headers: Authorization: Bearer <token>
Response: { uid, customerId, firstName, lastName, phone, ... }
```

### Profilni yangilash
```
PUT /api/auth/me
Headers: Authorization: Bearer <token>
Body: { firstName, lastName, region, district, lang, email }
```

### Parol o'zgartirish
```
PUT /api/auth/change-password
Headers: Authorization: Bearer <token>
Body: { oldPassword, newPassword }
```

---

## Admin Auth API

```
POST /api/auth/register-admin  — ro'yxat (role: admin | driver)
POST /api/auth/login-admin     — kirish
```

---

## Barcha endpointlar

```
GET  /health

POST /api/auth/register           mijoz ro'yxat
POST /api/auth/login              mijoz kirish
GET  /api/auth/me                 mijoz profil (token)
PUT  /api/auth/me                 profil yangilash (token)
PUT  /api/auth/change-password    parol o'zgartirish (token)

POST /api/auth/register-admin     admin/shofer ro'yxat
POST /api/auth/login-admin        admin/shofer kirish

POST /api/users/sync              Firebase user sync
GET  /api/users                   barcha mijozlar (admin token)
GET  /api/users/:uid              bitta foydalanuvchi

GET  /api/products                mahsulotlar (?q= &cat= &sub=)
GET  /api/products/:id            bitta mahsulot
POST /api/products                yangi mahsulot (admin token)
PUT  /api/products/:id            yangilash (admin token)
DELETE /api/products/:id          o'chirish (admin token)

GET  /api/ads                     reklama mahsulotlari
POST /api/ads                     reklamani saqlash (admin token)

GET  /api/favorites/:uid          sevimlilar
POST /api/favorites               qo'shish
DELETE /api/favorites             o'chirish

GET  /api/cart/:uid               savat
POST /api/cart                    qo'shish/yangilash
DELETE /api/cart                  o'chirish

GET  /api/orders                  barcha buyurtmalar (admin token)
GET  /api/orders/:id              bitta buyurtma (admin token)
GET  /api/orders/driver/:drvId    shofer buyurtmalari (admin token)
GET  /api/my-orders/:uid          mijoz o'z buyurtmalari
POST /api/orders                  buyurtma yaratish
PUT  /api/orders/:id/assign       shoferga tayinlash (admin token)
PUT  /api/orders/:id/delivered    yetkazildi (admin token)

GET  /api/admin-users             admin/shoferlar (admin token)
PUT  /api/admin-users/:uid/location  GPS yangilash (admin token)
```
"# sofmebels" 

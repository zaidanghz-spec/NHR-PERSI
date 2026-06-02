# Deploy NHR PERSI ke Contabo VPS

Panduan ini untuk memindahkan aplikasi dari Vercel/Turso ke satu VPS Node.js + SQLite/libSQL file.

## 1. DNS

Arahkan domain ke IP VPS:

- `peringkatpersi.id` -> `161.97.102.82`
- `www.peringkatpersi.id` -> `161.97.102.82`

Tunggu DNS propagasi sebelum mengaktifkan SSL.

## 2. Setup Server

Masuk ke VPS:

```bash
ssh root@161.97.102.82
```

Install kebutuhan dasar:

```bash
apt update
apt upgrade -y
apt install -y curl git nginx sqlite3
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt install -y nodejs
npm install -g pm2
```

## 3. Clone dan Build Aplikasi

```bash
mkdir -p /var/www/nhr-persi /var/lib/nhr-persi
cd /var/www/nhr-persi
git clone https://github.com/zaidanghz-spec/NHR-PERSI.git .
npm ci
cp .env.vps.example .env
nano .env
npm run build:vps
pm2 start server.mjs --name nhr-persi --env production
pm2 save
pm2 startup
```

Isi minimal `.env`:

```env
NODE_ENV=production
PORT=3000
DATABASE_URL=file:/var/lib/nhr-persi/nhr-persi.db
JWT_SECRET=isi-dengan-openssl-rand-base64-48
ADMIN_EMAIL=adminpersi
ADMIN_PASSWORD=password-admin-yang-dipakai
ALLOWED_ORIGIN=https://peringkatpersi.id
VITE_API_BASE_URL=
```

Untuk membuat `JWT_SECRET`:

```bash
openssl rand -base64 48
```

## 4. Nginx Reverse Proxy

Buat konfigurasi:

```bash
nano /etc/nginx/sites-available/nhr-persi
```

Isi:

```nginx
server {
  listen 80;
  server_name peringkatpersi.id www.peringkatpersi.id;

  client_max_body_size 25M;

  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

Aktifkan:

```bash
ln -s /etc/nginx/sites-available/nhr-persi /etc/nginx/sites-enabled/nhr-persi
nginx -t
systemctl reload nginx
```

## 5. SSL

```bash
apt install -y certbot python3-certbot-nginx
certbot --nginx -d peringkatpersi.id -d www.peringkatpersi.id
```

## 6. Migrasi Data dari Turso

Kalau data Turso ingin dibawa ke VPS, export dari Turso ke SQL lalu import ke SQLite VPS:

```bash
turso db shell NAMA_DATABASE ".dump" > nhr-persi.sql
sqlite3 /var/lib/nhr-persi/nhr-persi.db < nhr-persi.sql
```

Setelah migrasi, pastikan `.env` VPS memakai:

```env
DATABASE_URL=file:/var/lib/nhr-persi/nhr-persi.db
TURSO_DATABASE_URL=
TURSO_AUTH_TOKEN=
```

## 7. Cek

```bash
curl http://127.0.0.1:3000/api/health
pm2 logs nhr-persi
```

Jika health `status` sudah `ok`, buka `https://peringkatpersi.id`.

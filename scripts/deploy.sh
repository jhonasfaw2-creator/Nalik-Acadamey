#!/usr/bin/env bash
# ──────────────────────────────────────────────
# Nalik Academy — VPS Deployment Script
# Run this ONCE on a fresh Ubuntu 22.04/24.04 server.
# Usage: sudo bash scripts/deploy.sh yourdomain.com
# ──────────────────────────────────────────────
set -euo pipefail

DOMAIN="${1:-}"
APP_DIR="/var/www/nalik-academy"
LOG_DIR="/var/log/nalik-academy"
NODE_VERSION="20"

if [ -z "$DOMAIN" ]; then
  echo "Usage: sudo bash scripts/deploy.sh yourdomain.com"
  exit 1
fi

echo "═══════════════════════════════════════════"
echo "  Nalik Academy — Deploying to $DOMAIN"
echo "═══════════════════════════════════════════"

# ── 1. System packages ────────────────────────
echo ""
echo "▸ Installing system packages..."
apt update -qq
apt install -y -qq curl git nginx certbot python3-certbot-nginx ufw

# ── 2. Node.js 20 ─────────────────────────────
echo ""
echo "▸ Installing Node.js $NODE_VERSION..."
if ! command -v node &>/dev/null || [ "$(node -v | cut -d. -f1 | tr -d 'v')" -lt "$NODE_VERSION" ]; then
  curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash -
  apt install -y -qq nodejs
fi
echo "  Node $(node -v) | npm $(npm -v)"

# ── 3. PM2 ────────────────────────────────────
echo ""
echo "▸ Installing PM2..."
npm install -g pm2 2>/dev/null || true
pm2 startup systemd -u "$SUDO_USER" --hp "/home/$SUDO_USER" 2>/dev/null || true

# ── 4. App directory ──────────────────────────
echo ""
echo "▸ Setting up app directory..."
mkdir -p "$APP_DIR" "$LOG_DIR"

# Copy project files (assumes script runs from project root)
if [ -d ".git" ]; then
  rsync -a --exclude='node_modules' --exclude='.next' --exclude='dev.db' --exclude='*.mp4' --exclude='.env*' ./ "$APP_DIR/"
fi

# ── 5. Install dependencies & build ───────────
echo ""
echo "▸ Installing dependencies..."
cd "$APP_DIR"
npm ci --production=false

echo ""
echo "▸ Running Prisma generate..."
npx prisma generate

echo ""
echo "▸ Running Prisma migrate..."
npx prisma migrate deploy

echo ""
echo "▸ Building for production..."
npm run build

# ── 6. Environment file ───────────────────────
echo ""
if [ ! -f "$APP_DIR/.env" ]; then
  echo "▸ Creating .env from template..."
  cp "$APP_DIR/.env.production" "$APP_DIR/.env"
  echo "  ⚠  Edit $APP_DIR/.env with your real values!"
  echo "     nano $APP_DIR/.env"
else
  echo "▸ .env already exists — skipping."
fi

# ── 7. Nginx ──────────────────────────────────
echo ""
echo "▸ Configuring Nginx..."
cat > "/etc/nginx/sites-available/nalik-academy" << NGINX
server {
    listen 80;
    listen [::]:80;
    server_name $DOMAIN www.$DOMAIN;

    # Security headers (also set by Next.js, but nginx adds them earlier)
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Proxy to Next.js
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;

        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Cache static assets
    location /_next/static/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_cache_valid 200 365d;
        add_header Cache-Control "public, max-age=31536000, immutable";
    }

    # Cache images
    location /images/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_cache_valid 200 30d;
        add_header Cache-Control "public, max-age=2592000";
    }

    # Videos (larger cache)
    location /videos/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_cache_valid 200 7d;
        add_header Cache-Control "public, max-age=604800";

        # Support range requests for video seeking
        proxy_set_header Range \$http_range;
        proxy_set_header Partial-Content \$http_range;
    }

    # Upload size limit (50MB for media uploads)
    client_max_body_size 50M;
}
NGINX

ln -sf "/etc/nginx/sites-available/nalik-academy" "/etc/nginx/sites-enabled/nalik-academy"
rm -f /etc/nginx/sites-enabled/default

nginx -t && systemctl reload nginx

# ── 8. Firewall ───────────────────────────────
echo ""
echo "▸ Configuring firewall..."
ufw allow 22/tcp 2>/dev/null || true
ufw allow 80/tcp 2>/dev/null || true
ufw allow 443/tcp 2>/dev/null || true
ufw --force enable 2>/dev/null || true

# ── 9. SSL certificate ────────────────────────
echo ""
echo "▸ Obtaining SSL certificate..."
certbot --nginx -d "$DOMAIN" -d "www.$DOMAIN" --non-interactive --agree-tos --email "admin@$DOMAIN" || {
  echo "  ⚠  SSL setup failed. Run manually:"
  echo "     certbot --nginx -d $DOMAIN -d www.$DOMAIN"
}

# ── 10. Start app with PM2 ────────────────────
echo ""
echo "▸ Starting app with PM2..."
cd "$APP_DIR"
pm2 delete nalik-academy 2>/dev/null || true
pm2 start ecosystem.config.cjs
pm2 save

echo ""
echo "═══════════════════════════════════════════"
echo "  ✓ Deployment complete!"
echo "═══════════════════════════════════════════"
echo ""
echo "  Site:     https://$DOMAIN"
echo "  Admin:    https://$DOMAIN/admin/login"
echo "  App dir:  $APP_DIR"
echo "  Logs:     pm2 logs nalik-academy"
echo "  Restart:  pm2 restart nalik-academy"
echo ""
echo "  ⚠  Next steps:"
echo "     1. Edit $APP_DIR/.env with your real credentials"
echo "     2. Upload video files to $APP_DIR/public/videos/"
echo "     3. Restart: pm2 restart nalik-academy"
echo ""

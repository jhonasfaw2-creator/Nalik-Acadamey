# Deploying Nalik Academy to a VPS

## Prerequisites

- A VPS running **Ubuntu 22.04 or 24.04** (DigitalOcean, Hetzner, Linode, etc.)
- **Root access** or a user with `sudo`
- A **domain name** pointed to your server's IP (A record)
- At least **1GB RAM, 25GB disk**

---

## Quick Deploy (automated)

```bash
# 1. SSH into your server
ssh root@YOUR_SERVER_IP

# 2. Clone the project
git clone https://github.com/YOUR_USERNAME/nalik-academy.git /var/www/nalik-academy
cd /var/www/nalik-academy

# 3. Run the deploy script
sudo bash scripts/deploy.sh yourdomain.com
```

The script will:
- Install Node.js 20, Nginx, PM2, Certbot
- Build the Next.js app
- Set up Nginx reverse proxy with SSL
- Configure the firewall
- Start the app with PM2

---

## Manual Deploy (step by step)

### 1. Server Setup

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo bash -
sudo apt install -y nodejs

# Install PM2, Nginx, Certbot
sudo npm install -g pm2
sudo apt install -y nginx certbot python3-certbot-nginx
```

### 2. Deploy Code

```bash
# Clone or upload your project
sudo mkdir -p /var/www/nalik-academy
sudo chown $USER:$USER /var/www/nalik-academy
git clone https://github.com/YOUR_USERNAME/nalik-academy.git /var/www/nalik-academy
cd /var/www/nalik-academy
```

### 3. Configure Environment

```bash
cp .env.production .env
nano .env   # Edit with your real values
```

**Required variables:**
| Variable | How to generate |
|---|---|
| `ADMIN_PASSWORD` | `openssl rand -base64 24` |
| `SESSION_SECRET` | `openssl rand -hex 32` |
| `RESEND_API_KEY` | Sign up at [resend.com](https://resend.com) |

### 4. Build & Migrate

```bash
npm ci
npx prisma generate
npx prisma migrate deploy
npm run build
```

### 5. Upload Video Files

The `.mp4` files are excluded from git. Upload them manually:

```bash
# From your local machine:
scp -r public/videos/*.mp4 root@YOUR_SERVER_IP:/var/www/nalik-academy/public/videos/
```

Or use `rsync`:
```bash
rsync -avz public/videos/ root@YOUR_SERVER_IP:/var/www/nalik-academy/public/videos/
```

### 6. Start with PM2

```bash
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup   # Follow the instructions to auto-start on boot
```

### 7. Configure Nginx

```bash
sudo nano /etc/nginx/sites-available/nalik-academy
```

Paste the Nginx config from `scripts/deploy.sh`, then:

```bash
sudo ln -sf /etc/nginx/sites-available/nalik-academy /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
```

### 8. Enable HTTPS

```bash
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

Certbot auto-renews via a systemd timer.

---

## Updating the App

```bash
cd /var/www/nalik-academy
git pull
npm ci
npx prisma migrate deploy
npm run build
pm2 restart nalik-academy
```

---

## Useful Commands

| Command | Description |
|---|---|
| `pm2 logs nalik-academy` | View app logs |
| `pm2 restart nalik-academy` | Restart the app |
| `pm2 stop nalik-academy` | Stop the app |
| `pm2 monit` | Real-time monitoring |
| `sudo systemctl reload nginx` | Reload Nginx config |
| `sudo certbot renew --dry-run` | Test SSL renewal |
| `npx prisma studio` | Open database browser (dev only) |

---

## Troubleshooting

**App won't start:**
```bash
pm2 logs nalik-academy --lines 50
# Check for missing env vars or database errors
```

**502 Bad Gateway:**
```bash
pm2 status                    # Is the app running?
curl -I http://localhost:3000 # Can you reach it locally?
sudo nginx -t                 # Is Nginx config valid?
```

**Database errors:**
```bash
cd /var/www/nalik-academy
npx prisma migrate deploy     # Run pending migrations
npx prisma db seed            # Re-seed if needed
```

**SSL issues:**
```bash
sudo certbot certificates     # Check cert status
sudo certbot renew --force-renewal
sudo systemctl reload nginx
```

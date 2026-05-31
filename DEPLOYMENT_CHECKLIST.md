# ✅ Production Deployment Checklist

## Pre-Deployment (Before Going Live)

### Security
- [ ] Change `JWT_SECRET` to strong 32+ char random string
- [ ] Set `NODE_ENV=production` in .env
- [ ] Update `FRONTEND_URL` to production domain
- [ ] Review CORS whitelist in index.js
- [ ] Ensure `.env` is in `.gitignore`
- [ ] Change database.db location (outside repo)

### Infrastructure
- [ ] Set up SSL certificates (Let's Encrypt)
- [ ] Configure Nginx reverse proxy (see PRODUCTION.md)
- [ ] Set up logging rotation (Winston handles this)
- [ ] Configure database backups
- [ ] Set up monitoring/alerting

### Testing
- [ ] Run `npm test` - all pass
- [ ] Test auth flow (register → login → access protected routes)
- [ ] Test rate limiting (trigger and verify 429 response)
- [ ] Test error handling (intentional errors should be logged)
- [ ] Load testing with multiple concurrent users

### Documentation
- [ ] Update environment variables docs
- [ ] Document backup procedures
- [ ] Document rollback procedures
- [ ] Create runbook for common issues

---

## Deployment Steps

### Step 1: Prepare Server
```bash
# Install Docker & Docker Compose
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Create app directory
sudo mkdir -p /app/deutsch-lernen
cd /app/deutsch-lernen
```

### Step 2: Clone & Configure
```bash
git clone <your-repo-url> .

# Create .env from template
cp backend/.env.example backend/.env

# Edit with production values
nano backend/.env

# Generate JWT secret
echo "JWT_SECRET=$(openssl rand -base64 32)" >> backend/.env
```

### Step 3: Generate HTTPS Certs
```bash
# Option A: Let's Encrypt (recommended)
sudo apt-get install certbot
sudo certbot certonly --standalone -d yourdomain.com

# Update .env:
# HTTPS_KEY_PATH=/etc/letsencrypt/live/yourdomain.com/privkey.pem
# HTTPS_CERT_PATH=/etc/letsencrypt/live/yourdomain.com/fullchain.pem

# Option B: Self-signed (dev only)
openssl req -x509 -newkey rsa:4096 -nodes \
  -out backend/certs/cert.pem -keyout backend/certs/key.pem -days 365
```

### Step 4: Start Services
```bash
docker-compose up -d

# Verify
docker ps
docker logs deutsch-lernen-backend

# Test API
curl http://localhost:3001/api/health
```

### Step 5: Configure Nginx
```bash
sudo nano /etc/nginx/sites-available/deutsch-lernen

# Paste nginx config from PRODUCTION.md

sudo nginx -t
sudo systemctl restart nginx
```

### Step 6: Set Up Monitoring
```bash
# Check logs
docker logs -f deutsch-lernen-backend

# Monitor performance
docker stats

# Check disk usage
df -h
```

---

## Post-Deployment

### First 24 Hours
- [ ] Monitor error logs for issues
- [ ] Test key user journeys (register → learn)
- [ ] Verify rate limiting works
- [ ] Check log file rotation

### Weekly
- [ ] Review logs for errors/warnings
- [ ] Monitor database size
- [ ] Check certificate expiration (Let's Encrypt)
- [ ] Test backup restoration

### Monthly
- [ ] Update dependencies
- [ ] Review security logs
- [ ] Analyze usage metrics
- [ ] Plan capacity upgrades if needed

---

## Troubleshooting

### API returns 500
```bash
docker logs deutsch-lernen-backend
tail -f backend/logs/error.log
```

### Database locked
```bash
docker restart deutsch-lernen-backend
```

### Port already in use
```bash
lsof -i :3001
# Then kill the specific PID
```

### SSL certificate renewal
```bash
sudo certbot renew
docker restart deutsch-lernen-backend
```

### Clear Docker cache
```bash
docker system prune -a
docker-compose down -v
docker-compose up -d --build
```

---

## Rollback Procedure

### To previous version
```bash
# Backup current database
cp backend/database.db backend/database.db.backup-$(date +%Y%m%d)

# Restore to previous version
git revert <commit-hash>
docker-compose down
docker-compose up -d --build
```

### To previous database
```bash
docker-compose down
cp backend/database.db.backup-20240520 backend/database.db
docker-compose up -d
```

---

## Performance Optimization

### Database
- [ ] Regular backups to external storage
- [ ] Monitor database file size
- [ ] Consider PostgreSQL for large datasets

### API
- [ ] Enable compression (gzip)
- [ ] Add caching headers
- [ ] Monitor response times

### Frontend
- [ ] Vite build is already optimized
- [ ] Check bundle size: `npm run build`
- [ ] Use CDN for static assets

---

## Security Hardening

### Regular Tasks
- [ ] Check for dependency updates: `npm outdated`
- [ ] Run security audit: `npm audit`
- [ ] Review access logs
- [ ] Update firewall rules

### Incident Response
- [ ] Have on-call contact info
- [ ] Document incident procedures
- [ ] Practice recovery scenarios

---

**Ready for Production! 🚀**

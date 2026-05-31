# 🚀 Guide Production-Ready

Ce guide vous aide à déployer Deutsch Lernen en production.

## ✅ Checklist Mise en Production

### 1️⃣ **Base de Données**
- [x] SQLite persistant (database.db)
- [x] Schema avec utilisateurs et clés étrangères
- [x] Migrations automatiques

### 2️⃣ **Authentification**
- [x] JWT tokens (7 jours par défaut)
- [x] Password hashing (bcryptjs)
- [x] Endpoints: `/api/auth/register`, `/login`, `/me`
- [x] Middleware de protection des routes

### 3️⃣ **Sécurité**
- [x] CORS restrictif
- [x] Helmet (headers sécurisés)
- [x] Rate limiting (auth: 5/15min, api: 100/15min)
- [x] Input validation sur register/login
- [x] Password min 6 caractères

### 4️⃣ **Monitoring & Logging**
- [x] Winston logger (file + console)
- [x] Logs rotatifs dans `logs/`
- [x] Request logging (method, path, status, duration)
- [x] Error tracking avec stack traces

### 5️⃣ **Tests**
- [x] Tests unitaires Jest
- [x] Auth service tests
- [x] Coverage sur services/

### 6️⃣ **HTTPS**
- [x] Self-signed certs (dev) → `certs/`
- [x] Support HTTPS optionnel
- [x] Production: utiliser Nginx reverse proxy

### 7️⃣ **Docker**
- [x] Dockerfile backend (Node 18-alpine)
- [x] Dockerfile frontend (build + serve)
- [x] docker-compose.yml pour full stack

---

## 📋 Configuration Minimale

### Backend `.env`

```bash
NODE_ENV=production
PORT=3001
FRONTEND_URL=https://yourdomain.com

JWT_SECRET=votre-clé-secrète-très-longue-32-caractères-minimum
JWT_EXPIRY=7d

GEMINI_API_KEY=votre-gemini-api-key
GEMINI_MODEL=gemini-3.1-flash-lite

LOG_LEVEL=info
```

⚠️ **IMPORTANT**:
- Ne jamais commiter le `.env`
- Changer `JWT_SECRET` en production
- Minimum 32 caractères pour JWT_SECRET

### Frontend `.env`

```bash
VITE_API_URL=https://api.yourdomain.com
```

---

## 🐳 Déploiement avec Docker

### Démarrage local

```bash
docker-compose up -d
```

Backend: `http://localhost:3001`
Frontend: `http://localhost:5173`

### Production sur VPS

1. **Pull le code**
```bash
git clone <repo> && cd deutsch-lernen
```

2. **Configurer `.env`**
```bash
cp backend/.env.example backend/.env
# Éditer backend/.env avec config production
```

3. **Démarrer avec Docker**
```bash
docker-compose -f docker-compose.yml up -d
```

4. **Vérifier la santé**
```bash
curl http://localhost:3001/api/health
# {status: 'ok', ...}
```

---

## 🔒 HTTPS en Production

### Option 1: Nginx Reverse Proxy (Recommandé)

```nginx
server {
    listen 443 ssl http2;
    server_name api.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    location / {
        proxy_pass http://localhost:3001;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    location / {
        proxy_pass http://localhost:5173;
    }
}
```

### Option 2: Let's Encrypt

```bash
sudo certbot certonly --standalone -d yourdomain.com
```

---

## 📊 Monitoring

### Vérifier les logs

```bash
# Docker
docker logs deutsch-lernen-backend

# File logs
tail -f backend/logs/combined.log
tail -f backend/logs/error.log
```

### Metrics clés

- **HTTP 401**: Tokens invalides
- **HTTP 429**: Rate limit atteint
- **HTTP 500**: Erreur serveur (voir error.log)

---

## 🧪 Tests en Production

```bash
# Backend
npm test

# Frontend
npm run test
```

---

## 🔄 Updates & Maintenance

### Backup DB

```bash
cp backend/database.db backend/database.db.backup-$(date +%Y%m%d)
```

### Rolling updates

```bash
docker-compose down
git pull
docker-compose up -d
```

---

## 🐛 Troubleshooting

| Problème | Solution |
|----------|----------|
| 401 Unauthorized | Token expiré → login de nouveau |
| 429 Too Many Requests | Attendre 15 min ou réduire requêtes |
| Database locked | Vérifier permissions, redémarrer backend |
| CORS error | Vérifier FRONTEND_URL dans .env |

---

## 📚 Ressources

- [Express Security Best Practices](https://expressjs.com/en/advanced/best-practice-security.html)
- [JWT Best Practices](https://tools.ietf.org/html/rfc8725)
- [Docker Security](https://docs.docker.com/engine/security/)
- [Nginx Configuration](https://nginx.org/en/docs/)

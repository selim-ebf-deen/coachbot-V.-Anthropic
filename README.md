# CoachBot v2.0

Système de coaching personnel sur 15 jours avec IA intégrée (Claude/Anthropic).

## 🚀 Déploiement Rapide

### 1. Render.com (Recommandé)
```bash
# 1. Créer un repo GitHub avec ce code
# 2. Aller sur render.com → New Web Service  
# 3. Connecter le repo
# 4. Configurer les variables d'environnement
```

**Variables Render obligatoires :**
- `ANTHROPIC_API_KEY` : sk-ant-votre-cle (console.anthropic.com)
- `JWT_SECRET` : votre-secret-ultra-securise-123
- `DEFAULT_PROVIDER` : anthropic

### 2. Local
```bash
npm install
cp .env.example .env
# Éditer .env avec vos vraies clés
npm start
# http://localhost:8787
```

### 3. Docker
```bash
docker build -t coachbot:latest .
docker run -p 8787:8787 --env-file .env -v $(pwd)/data:/data coachbot:latest
```

## 🎯 Fonctionnalités

- ✅ Chat IA en temps réel (streaming)
- ✅ Coaching structuré 15 jours
- ✅ Profils DISC automatiques
- ✅ Authentification JWT sécurisée
- ✅ Interface admin complète
- ✅ Design glassmorphism moderne
- ✅ Responsive mobile

## 🔧 Configuration

**Clé Anthropic (obligatoire) :**
1. Aller sur console.anthropic.com
2. Créer un compte
3. Générer une clé API
4. Ajouter dans les variables d'env

**Variables optionnelles :**
- `ADMIN_EMAIL` / `ADMIN_PASSWORD` : Compte admin auto-créé
- `PORT` : Port serveur (défaut: 8787)

## 📁 Structure

- `server.js` : Serveur Express complet
- `prompt.txt` : Instructions coaching IA
- `public/` : Interface utilisateur
- `package.json` : Dépendances Node.js

## 🔒 Sécurité

- Mots de passe hachés bcrypt
- Tokens JWT avec expiration
- Rate limiting intégré
- Variables d'env protégées

## 📊 Admin

Accès via `/admin` avec compte admin configuré.

## 🆘 Support

- Logs serveur pour debug
- Health check : `/healthz`
- API status : `/healthz/ready`

---
**CoachBot v2.0** - Coaching personnel IA moderne 🤖

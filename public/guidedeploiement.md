# 🚀 Guide de Déploiement CoachBot v2.0

## 📋 Prérequis

- [ ] Compte GitHub
- [ ] Compte Anthropic (console.anthropic.com)
- [ ] Compte Render.com (gratuit)

## 🎯 Déploiement Rapide (15 minutes)

### 1. 📁 Préparation du Code

```bash
# Créer le dossier projet
mkdir coachbot
cd coachbot

# Extraire les 3 paquets téléchargés dans ce dossier
# Structure finale :
# coachbot/
# ├── package.json
# ├── server.js
# ├── prompt.txt
# ├── .env.example
# ├── .gitignore
# ├── Dockerfile
# ├── README.md
# ├── render.yaml
# ├── vercel.json
# └── public/
#     ├── index.html
#     ├── app.js
#     └── admin.html
```

### 2. 🔑 Obtenir la Clé Anthropic

1. Aller sur **console.anthropic.com**
2. Créer un compte / Se connecter
3. Aller dans **API Keys**
4. Cliquer **Create Key**
5. Copier la clé (commence par `sk-ant-`)

### 3. 📤 Créer le Repo GitHub

```bash
# Initialiser Git
git init
git add .
git commit -m "Initial CoachBot v2.0"

# Créer un repo sur github.com
# Puis connecter :
git remote add origin https://github.com/VOTRE-USERNAME/coachbot.git
git branch -M main
git push -u origin main
```

### 4. 🌐 Déployer sur Render.com

1. **Aller sur render.com → Inscription/Connexion**

2. **Cliquer "New" → "Web Service"**

3. **Connecter GitHub et sélectionner votre repo `coachbot`**

4. **Configuration :**
   - **Name :** `coachbot-v2`
   - **Environment :** `Node`
   - **Build Command :** `npm install`
   - **Start Command :** `node server.js`

5. **Variables d'Environnement (IMPORTANT) :**
   
   Cliquer "Advanced" puis ajouter ces variables :

   | Variable | Valeur |
   |----------|--------|
   | `ANTHROPIC_API_KEY` | `sk-ant-VOTRE-CLE-ICI` |
   | `JWT_SECRET` | `votre-secret-ultra-securise-123` |
   | `DEFAULT_PROVIDER` | `anthropic` |
   | `USERS_PATH` | `/data/users.json` |
   | `JOURNAL_PATH` | `/data/journal.json` |
   | `META_PATH` | `/data/meta.json` |
   | `ADMIN_EMAIL` | `admin@votre-domaine.com` |
   | `ADMIN_PASSWORD` | `motdepasse-admin-securise` |

6. **Déployer :**
   - Cliquer **"Create Web Service"**
   - Attendre 2-3 minutes
   - Récupérer l'URL : `https://coachbot-v2.onrender.com`

## ✅ Vérification Post-Déploiement

### 1. Tests de Base

- [ ] **Page d'accueil :** `https://votre-url.onrender.com`
- [ ] **Inscription utilisateur** fonctionne
- [ ] **Chat avec IA** répond
- [ ] **Navigation entre jours** J1-J15
- [ ] **Interface admin :** `https://votre-url.onrender.com/admin`

### 2. Tests Admin

1. Aller sur `/admin`
2. Se connecter avec `ADMIN_EMAIL` et `ADMIN_PASSWORD`
3. Vérifier :
   - [ ] Statistiques affichées
   - [ ] Liste des utilisateurs
   - [ ] Graphique par jour

### 3. Health Check

- [ ] **API Status :** `https://votre-url.onrender.com/healthz`
- [ ] **Réponse :** `{"ok": true}`

## 🛠️ Configuration Avancée

### Stockage Persistant (Optionnel - $1/mois)

Pour garder les données entre redémarrages :

1. **Dans Render.com :**
   - Aller dans votre service
   - **Settings** → **Disks**
   - **Add Disk :**
     - **Name :** `data`
     - **Mount Path :** `/data`
     - **Size :** `1 GB`

2. **Upgrade plan :**
   - Plan gratuit → Plan Starter ($7/mois)
   - Inclut le stockage persistant

### Domaine Personnalisé

1. **Acheter un domaine** (ex: Namecheap, OVH)
2. **Dans Render.com :**
   - **Settings** → **Custom Domains**
   - **Add Custom Domain**
   - Suivre les instructions DNS

### Variables Optionnelles

| Variable | Description | Défaut |
|----------|-------------|--------|
| `PORT` | Port serveur | `8787` |
| `ANTHROPIC_MODEL` | Modèle Claude | `claude-3-5-sonnet-20241022` |
| `ADMIN_NAME` | Nom admin | `Admin` |

## 🚨 Troubleshooting

### Problème : Deploy Failed

**Solutions :**
1. Vérifier le fichier `package.json` présent
2. Vérifier `server.js` à la racine
3. Check logs Render pour erreurs spécifiques

### Problème : IA ne répond pas

**Solutions :**
1. Vérifier `ANTHROPIC_API_KEY` correcte
2. Tester la clé sur console.anthropic.com
3. Vérifier les logs pour erreurs API

### Problème : Admin ne fonctionne pas

**Solutions :**
1. Vérifier `ADMIN_EMAIL` et `ADMIN_PASSWORD` configurés
2. Créer un utilisateur admin manuellement
3. Vérifier `/admin` accessible

### Problème : Sleep Mode (Plan Gratuit)

**Symptôme :** App lente au premier accès

**Solutions :**
1. **Normal** sur plan gratuit (15min d'inactivité)
2. **Upgrade** vers plan payant pour 0 downtime
3. **Ping service** externe pour maintenir actif

## 📊 Monitoring

### Logs Render

```bash
# Voir les logs en temps réel
render logs --service coachbot-v2 --follow
```

### Métriques Importantes

- **Temps de réponse API**
- **Taux d'erreur IA**
- **Nombre d'utilisateurs actifs**
- **Messages par jour**

## 🔒 Sécurité

### Checklist Sécurité

- [ ] **JWT_SECRET** unique et complexe
- [ ] **ADMIN_PASSWORD** fort
- [ ] **Variables d'env** non commitées
- [ ] **HTTPS** activé (automatique sur Render)
- [ ] **Rate limiting** activé

### Backup Données

```bash
# Si stockage persistant activé
# Télécharger via Render SSH ou API
curl https://votre-url.onrender.com/api/admin/backup
```

## 🎛️ Commandes Utiles

### Développement Local

```bash
# Installation
npm install

# Copier la config
cp .env.example .env
# Éditer .env avec vos vraies clés

# Lancer en local
npm start
# http://localhost:8787
```

### Docker (Optionnel)

```bash
# Build
docker build -t coachbot:latest .

# Run
docker run -p 8787:8787 --env-file .env coachbot:latest
```

### Git Workflow

```bash
# Développement
git add .
git commit -m "Feature: nouvelle fonctionnalité"
git push

# Render redéploie automatiquement
```

## 📈 Optimisation Performance

### 1. Plan Render

| Plan | Prix | Specs | Usage |
|------|------|-------|-------|
| **Free** | $0 | 512MB RAM, Sleep | Prototype |
| **Starter** | $7/mois | 512MB RAM, No Sleep | Production |
| **Standard** | $25/mois | 2GB RAM | High Traffic |

### 2. Cache Strategy

- **Sessions :** JWT (stateless)
- **Messages :** Base JSON (simple)
- **IA Responses :** Streaming (temps réel)

### 3. Monitoring

```bash
# Health checks
curl https://votre-url.onrender.com/healthz
curl https://votre-url.onrender.com/healthz/ready
```

## 🎯 Roadmap Post-Déploiement

### Phase 1 : Stabilisation (Semaine 1)
- [ ] Tests utilisateurs réels
- [ ] Fix bugs identifiés
- [ ] Optimisation performance

### Phase 2 : Amélioration (Semaine 2-4)
- [ ] Analytics détaillés
- [ ] Notifications push
- [ ] Export PDF rapports

### Phase 3 : Scale (Mois 2+)
- [ ] Base de données PostgreSQL
- [ ] Multi-tenant
- [ ] API publique

## 🆘 Support

### Documentation
- **Render.com :** https://render.com/docs
- **Anthropic :** https://docs.anthropic.com
- **Node.js :** https://nodejs.org/docs

### Contact
- **Issues GitHub :** Créer une issue sur votre repo
- **Logs Render :** Copier les logs d'erreur
- **Tests locaux :** Reproduire en développement

---

**🤲 Barakallahu fik !**

Avec ce guide, tu as maintenant CoachBot v2.0 déployé en production !

*"Wa billahi at-tawfeeq"* - Et c'est par Allah que vient le succès.

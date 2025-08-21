// CoachBot v2.0 - Serveur complet corrigé - PARTIE 1/4
import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import rateLimit from "express-rate-limit";

dotenv.config();

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 🛡️ SÉCURITÉ RENFORCÉE
const securityHeaders = (req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  next();
};

app.use(securityHeaders);

// 🚫 RATE LIMITING AMÉLIORÉ
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: "Trop de requêtes, réessayez plus tard." },
  trustProxy: true,
  standardHeaders: true,
  legacyHeaders: false
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: "Trop de tentatives de connexion." },
  trustProxy: true
});

const chatLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 20,
  message: { error: "Trop de messages envoyés." },
  trustProxy: true
});

app.use(generalLimiter);
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
  credentials: true
}));
app.use(bodyParser.json({ limit: "1mb" }));

// Configuration
const USERS_PATH = process.env.USERS_PATH || "./users.json";
const JOURNAL_PATH = process.env.JOURNAL_PATH || "./journal.json";
const META_PATH = process.env.META_PATH || "./meta.json";
const PROMPT_PATH = process.env.PROMPT_PATH || path.join(__dirname, "prompt.txt");
const JWT_SECRET = process.env.JWT_SECRET || "change_me_now";
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || "claude-3-5-sonnet-20241022";

// 🛠️ UTILITAIRES SÉCURISÉS
function ensureDir(p) { 
  try { 
    fs.mkdirSync(path.dirname(p), { recursive: true }); 
  } catch(e) {
    console.error('Erreur création dossier:', e.message);
  }
}

function loadJSON(p, fallback = {}) {
  try {
    if (!fs.existsSync(p)) return fallback;
    const raw = fs.readFileSync(p, "utf-8");
    
    if (!raw.trim()) return fallback;
    
    const obj = JSON.parse(raw);
    return obj && typeof obj === "object" ? obj : fallback;
  } catch (error) {
    console.error(`Erreur chargement JSON ${p}:`, error.message);
    
    try {
      const backupPath = `${p}.backup.${Date.now()}`;
      fs.copyFileSync(p, backupPath);
      console.log(`Backup créé: ${backupPath}`);
    } catch(e) {}
    
    return fallback;
  }
}

function saveJSON(p, obj) { 
  try {
    ensureDir(p);
    
    if (!obj || typeof obj !== 'object') {
      throw new Error('Objet invalide pour sauvegarde');
    }
    
    const jsonString = JSON.stringify(obj, null, 2);
    
    const tempPath = `${p}.tmp`;
    fs.writeFileSync(tempPath, jsonString);
    fs.renameSync(tempPath, p);
    
  } catch (error) {
    console.error(`Erreur sauvegarde JSON ${p}:`, error.message);
    throw error;
  }
}

function getPromptText() {
  try { 
    return fs.readFileSync(PROMPT_PATH, "utf-8"); 
  } catch { 
    console.warn('Prompt file non trouvé, utilisation par défaut');
    return "Tu es CoachBot 🤲🏻, un coach personnel bienveillant et orienté résultats."; 
  }
}

// 📊 LOGGING STRUCTURÉ
function logAction(level, action, userId = null, details = {}) {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    level,
    action,
    userId,
    details,
    ip: details.ip || 'unknown'
  };
  
  console.log(`[${level.toUpperCase()}] ${timestamp} - ${action}`, details);
  
  if (process.env.NODE_ENV === 'production') {
    // TODO: Intégrer avec service externe (Sentry, LogRocket, etc.)
  }
}

// Data management avec validation
function loadUsers() { 
  const users = loadJSON(USERS_PATH, {});
  
  Object.keys(users).forEach(id => {
    const user = users[id];
    if (!user || !user.email || !user.passwordHash) {
      console.warn(`Utilisateur invalide détecté: ${id}`);
      delete users[id];
    }
  });
  
  return users;
}

function saveUsers(u) { 
  if (!u || typeof u !== 'object') {
    throw new Error('Données utilisateurs invalides');
  }
  saveJSON(USERS_PATH, u); 
}

function loadJournal() { 
  const journal = loadJSON(JOURNAL_PATH, {});
  
  Object.keys(journal).forEach(userId => {
    const userJournal = journal[userId];
    if (!userJournal || typeof userJournal !== 'object') {
      console.warn(`Journal utilisateur invalide: ${userId}`);
      delete journal[userId];
    }
  });
  
  return journal;
}

function saveJournal(j) { 
  if (!j || typeof j !== 'object') {
    throw new Error('Données journal invalides');
  }
  saveJSON(JOURNAL_PATH, j); 
}

function loadMetaAll() { 
  return loadJSON(META_PATH, {}); 
}

function saveMetaAll(m) { 
  if (!m || typeof m !== 'object') {
    throw new Error('Métadonnées invalides');
  }
  saveJSON(META_PATH, m); 
}

// Plans coaching
const plans = {
  1: "Clarification des intentions : précise le défi prioritaire à résoudre en 15 jours.",
  2: "Diagnostic de la situation actuelle : état des lieux, 3 leviers, 3 obstacles.",
  3: "Vision et critères de réussite : issue idéale + 3 indicateurs.",
  4: "Valeurs et motivations : aligne objectifs et valeurs.",
  5: "Énergie : estime de soi / amour propre / confiance.",
  6: "Confiance (suite) : preuves, retours, micro-victoires.",
  7: "Bilan et KISS (Keep-Improve-Start-Stop).",
  8: "Nouveau départ : cap et prochaines 48h.",
  9: "Plan d'action simple : 1 chose / jour.",
  10: "CNV : préparer un message clé.",
  11: "Décisions : Stop / Keep / Start.",
  12: "Échelle de responsabilité : au-dessus de la ligne.",
  13: "Co-développement éclair (pairing).",
  14: "Leadership (Maxwell).",
  15: "Bilan final + plan 30 jours."
};

// CoachBot v2.0 - Serveur complet corrigé - PARTIE 2/4

// Journal functions avec validation
function getEntries(userId, day) {
  if (!userId || !day || day < 1 || day > 15) {
    return [];
  }
  
  const db = loadJournal();
  const u = db[userId] || {};
  const val = u[day];
  
  if (Array.isArray(val)) return val;
  if (val && typeof val === "object") return [val];
  return [];
}

function addEntry(userId, day, entry) {
  if (!userId || !day || day < 1 || day > 15 || !entry) {
    throw new Error('Paramètres invalides pour addEntry');
  }
  
  if (!entry.role || !entry.message) {
    throw new Error('Entrée journal invalide');
  }
  
  entry.message = String(entry.message).substring(0, 5000);
  entry.date = entry.date || new Date().toISOString();
  
  const db = loadJournal();
  if (!db[userId] || typeof db[userId] !== "object") db[userId] = {};
  
  const val = db[userId][day];
  let arr;
  if (Array.isArray(val)) arr = val;
  else if (val && typeof val === "object") arr = [val];
  else arr = [];
  
  arr.push(entry);
  
  if (arr.length > 100) {
    arr = arr.slice(-100);
  }
  
  db[userId][day] = arr;
  saveJournal(db);
  
  logAction('info', 'journal_entry_added', userId, { day, messageLength: entry.message.length });
}

function getAllUserHistory(userId) {
  if (!userId) return [];
  
  const db = loadJournal();
  const userJournal = db[userId] || {};
  
  let allMessages = [];
  
  for (let day = 1; day <= 15; day++) {
    const dayEntries = userJournal[day];
    if (dayEntries) {
      const entries = Array.isArray(dayEntries) ? dayEntries : [dayEntries];
      entries.forEach(entry => {
        if (entry && entry.message) {
          allMessages.push({
            ...entry,
            day: day
          });
        }
      });
    }
  }
  
  allMessages.sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0));
  
  return allMessages;
}

function createUserSummary(userId, currentDay) {
  if (!userId || !currentDay) return '[PROFIL UTILISATEUR]\nAucun historique disponible';
  
  const allHistory = getAllUserHistory(userId);
  const meta = getMeta(userId);
  
  let summary = `[PROFIL UTILISATEUR]\n`;
  summary += `Prénom: ${meta.name || "Non défini"}\n`;
  summary += `Profil DISC: ${meta.disc || "À identifier"}\n\n`;
  
  if (allHistory.length === 0) {
    return summary + `[PREMIÈRE SESSION - Aucun historique]`;
  }
  
  const sessionsByDay = {};
  allHistory.forEach(entry => {
    if (!sessionsByDay[entry.day]) {
      sessionsByDay[entry.day] = [];
    }
    sessionsByDay[entry.day].push(entry);
  });
  
  summary += `[HISTORIQUE DES SESSIONS PRÉCÉDENTES]\n`;
  
  Object.keys(sessionsByDay)
    .filter(day => Number(day) < currentDay)
    .sort((a, b) => Number(a) - Number(b))
    .slice(-3)
    .forEach(day => {
      summary += `\n--- JOUR ${day} ---\n`;
      const dayMessages = sessionsByDay[day];
      
      const userMessages = dayMessages.filter(m => m.role === 'user');
      const aiMessages = dayMessages.filter(m => m.role === 'ai');
      
      if (userMessages.length > 0) {
        const lastUserMessage = userMessages[userMessages.length - 1];
        summary += `Dernière interaction: ${lastUserMessage.message.substring(0, 150)}...\n`;
      }
      
      if (aiMessages.length > 0) {
        summary += `Actions proposées: ${aiMessages.length}\n`;
      }
    });
  
  return summary;
}

// Meta functions avec validation
function getMeta(userId) {
  if (!userId) return { name: null, disc: null };
  
  const m = loadMetaAll();
  const userMeta = m[userId] || { name: null, disc: null };
  
  if (userMeta.disc && !['D', 'I', 'S', 'C'].includes(userMeta.disc)) {
    userMeta.disc = null;
  }
  
  return userMeta;
}

function setMeta(userId, metaPatch) {
  if (!userId || !metaPatch) return null;
  
  const m = loadMetaAll();
  if (!m[userId]) m[userId] = { name: null, disc: null };
  
  if (typeof metaPatch?.name === "string") {
    m[userId].name = metaPatch.name.trim().substring(0, 50);
  }
  
  if (typeof metaPatch?.disc === "string") {
    const disc = metaPatch.disc.toUpperCase();
    if (['D', 'I', 'S', 'C'].includes(disc)) {
      m[userId].disc = disc;
    }
  }
  
  saveMetaAll(m);
  logAction('info', 'meta_updated', userId, { name: !!metaPatch.name, disc: !!metaPatch.disc });
  
  return m[userId];
}

// Heuristiques améliorées
function maybeExtractName(text) {
  if (!text || typeof text !== 'string') return null;
  
  const t = text.trim();
  let m = t.match(/je m(?:'|e)appelle\s+([A-Za-zÀ-ÖØ-öø-ÿ' -]{2,30})/i)
       || t.match(/moi c['']est\s+([A-Za-zÀ-ÖØ-öø-ÿ' -]{2,30})/i)
       || (t.split(/\s+/).length === 1 && t.length >= 2 && t.length <= 30 ? [null, t] : null);
  
  if (!m || !m[1]) return null;
  
  const name = m[1].trim().replace(/^[^A-Za-zÀ-ÖØ-öø-ÿ]+|[^A-Za-zÀ-ÖØ-öø-ÿ]+$/g, "");
  
  if (name.length < 2 || name.length > 30) return null;
  
  return name;
}

function inferDISC(text) {
  if (!text || typeof text !== 'string') return null;
  
  const t = text.trim();
  const ex = (t.match(/!/g) || []).length;
  const hasCaps = /[A-Z]{3,}/.test(t);
  const wantsAction = /(action|résultat|vite|maintenant|objectif|priorité)/i.test(t);
  const caresPeople = /(écoute|relation|aider|ensemble|émotion|bienveillance)/i.test(t);
  const asksDetail = /(détail|exact|précis|critère|mesurable|plan)/i.test(t);

  if (wantsAction && (ex > 0 || hasCaps)) return "D";
  if (ex > 1 || /cool|idée|créatif|enthous|fun/i.test(t)) return "I";
  if (caresPeople || /calme|rassure|routine|habitude/i.test(t)) return "S";
  if (asksDetail || t.length > 240) return "C";
  
  return null;
}

// Auth avec sécurité renforcée
function signToken(user) {
  if (!user || !user.id) {
    throw new Error('Utilisateur invalide pour token');
  }
  
  const payload = { 
    sub: user.id, 
    role: user.role || "user",
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60)
  };
  
  return jwt.sign(payload, JWT_SECRET, { algorithm: 'HS256' });
}

function authMiddleware(req, res, next) {
  try {
    const hdr = req.headers.authorization || "";
    const token = hdr.startsWith("Bearer ") ? hdr.slice(7) : null;
    
    if (!token) {
      return res.status(401).json({ error: "Token d'authentification requis" });
    }
    
    const payload = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
    
    if (!payload.sub || !payload.role) {
      return res.status(401).json({ error: "Token invalide" });
    }
    
    req.user = payload;
    req.userId = payload.sub;
    
    logAction('debug', 'auth_success', payload.sub, { ip: req.ip });
    next();
    
  } catch (error) {
    logAction('warn', 'auth_failure', null, { error: error.message, ip: req.ip });
    return res.status(401).json({ error: "Token invalide ou expiré" });
  }
}

function adminOnly(req, res, next) {
  if (req.user?.role !== "admin") {
    logAction('warn', 'admin_access_denied', req.userId, { ip: req.ip });
    return res.status(403).json({ error: "Accès administrateur requis" });
  }
  next();
}

// Seed admin sécurisé
async function seedAdminIfNeeded() {
  const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
  
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
    console.warn('Variables ADMIN_EMAIL et ADMIN_PASSWORD non configurées');
    return;
  }
  
  if (ADMIN_PASSWORD.length < 8) {
    console.error('ADMIN_PASSWORD trop faible (minimum 8 caractères)');
    return;
  }
  
  try {
    const users = loadUsers();
    const existing = Object.values(users).find(u => 
      u?.email && String(u.email).toLowerCase() === String(ADMIN_EMAIL).toLowerCase()
    );
    
    if (existing) {
      console.log('Admin déjà existant');
      return;
    }
    
    const id = "u_admin_" + Math.random().toString(36).slice(2, 10);
    const hash = await bcrypt.hash(ADMIN_PASSWORD, 12);
    
    users[id] = {
      id, 
      email: ADMIN_EMAIL.toLowerCase(), 
      name: process.env.ADMIN_NAME || "Administrateur", 
      role: "admin",
      passwordHash: hash, 
      createdAt: new Date().toISOString(),
      isSeeded: true
    };
    
    saveUsers(users);
    logAction('info', 'admin_seeded', id, { email: ADMIN_EMAIL });
    console.log(`✅ Admin seedé: ${ADMIN_EMAIL}`);
    
  } catch (error) {
    console.error('Erreur seed admin:', error.message);
  }
}

seedAdminIfNeeded().catch(console.error);

// CoachBot v2.0 - Serveur complet corrigé - PARTIE 3/4

// 🗂️ ROUTES STATIQUES SÉCURISÉES
app.use(express.static(path.join(__dirname, "public"), {
  maxAge: '1h',
  etag: true,
  lastModified: true,
  setHeaders: (res, path) => {
    if (path.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache');
    }
  }
}));

// Route HOME
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Route de debug pour voir les fichiers
app.get("/debug-files", (req, res) => {
  try {
    const publicDir = path.join(__dirname, "public");
    const files = fs.readdirSync(publicDir);
    res.json({
      publicPath: publicDir,
      files: files,
      adminExists: fs.existsSync(path.join(publicDir, "admin.html")),
      indexExists: fs.existsSync(path.join(publicDir, "index.html")),
      appExists: fs.existsSync(path.join(publicDir, "app.js"))
    });
  } catch (error) {
    res.json({ error: error.message });
  }
});

// Route ADMIN
app.get("/admin", (req, res) => {
  const adminPath = path.join(__dirname, "public", "admin.html");
  console.log("🔍 Tentative d'accès admin:", adminPath);
  console.log("📁 Fichier existe:", fs.existsSync(adminPath));
  
  if (fs.existsSync(adminPath)) {
    console.log("✅ Envoi de admin.html");
    return res.sendFile(adminPath);
  }
  
  console.log("❌ admin.html introuvable");
  res.status(404).send("Admin UI non trouvée");
});

// 👑 ADMIN DASHBOARD ROUTES
// 
// ✅ ROUTE PRINCIPALE: /adminpanel 
//    - Interface admin fonctionnelle
//    - Pas de problème de cache
//    - URL recommandée pour les admins
//
// ⚠️ ROUTE LEGACY: /admin 
//    - Problème de cache navigateur
//    - Garde pour compatibilité
//    - À corriger plus tard

// Route ADMIN TEMPORAIRE (pour test)
app.get("/adminpanel", (req, res) => {
  const adminPath = path.join(__dirname, "public", "admin.html");
  console.log("🔍 Tentative d'accès adminpanel:", adminPath);
  console.log("📁 Fichier existe:", fs.existsSync(adminPath));
  
  if (fs.existsSync(adminPath)) {
    console.log("✅ Envoi de admin.html depuis /adminpanel");
    return res.sendFile(adminPath);
  }
  
  console.log("❌ admin.html introuvable depuis /adminpanel");
  res.status(404).send("Admin UI non trouvée depuis /adminpanel");
});

// Route ONBOARDING
app.get("/onboarding", (req, res) => {
  const onboardingPath = path.join(__dirname, "public", "onboarding.html");
  if (fs.existsSync(onboardingPath)) {
    return res.sendFile(onboardingPath);
  }
  res.status(404).json({ error: "Onboarding non disponible" });
});

// 🔐 AUTH API SÉCURISÉE
app.post("/api/auth/register", authLimiter, async (req, res) => {
  try {
    const { email, password, name } = req.body || {};
    
    if (!email || !password) {
      return res.status(400).json({ error: "Email et mot de passe requis" });
    }
    
    if (password.length < 6) {
      return res.status(400).json({ error: "Mot de passe trop court (minimum 6 caractères)" });
    }
    
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: "Format email invalide" });
    }

    const users = loadUsers();
    const emailLower = String(email).toLowerCase();
    const exists = Object.values(users).find(u => 
      u?.email && String(u.email).toLowerCase() === emailLower
    );
    
    if (exists) {
      logAction('warn', 'register_duplicate_email', null, { email: emailLower, ip: req.ip });
      return res.status(400).json({ error: "Email déjà utilisé" });
    }

    const id = "u_" + Math.random().toString(36).slice(2, 10);
    const hash = await bcrypt.hash(String(password), 12);
    
    const newUser = {
      id, 
      email: emailLower, 
      name: name?.trim()?.substring(0, 50) || null,
      role: "user", 
      passwordHash: hash, 
      createdAt: new Date().toISOString()
    };
    
    users[id] = newUser;
    saveUsers(users);
    setMeta(id, { name: newUser.name || null });

    const token = signToken(newUser);
    
    logAction('info', 'user_registered', id, { email: emailLower, ip: req.ip });
    
    res.json({ 
      token, 
      user: { 
        id, 
        email: newUser.email, 
        name: newUser.name, 
        role: "user" 
      } 
    });
    
  } catch (error) {
    logAction('error', 'register_error', null, { error: error.message, ip: req.ip });
    console.error('Erreur registration:', error);
    res.status(500).json({ error: "Erreur serveur lors de l'inscription" });
  }
});

app.post("/api/auth/login", authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body || {};
    
    if (!email || !password) {
      return res.status(400).json({ error: "Email et mot de passe requis" });
    }

    const users = loadUsers();
    const emailLower = String(email).toLowerCase();
    const user = Object.values(users).find(u => 
      u?.email && String(u.email).toLowerCase() === emailLower
    );
    
    if (!user) {
      logAction('warn', 'login_user_not_found', null, { email: emailLower, ip: req.ip });
      return res.status(401).json({ error: "Identifiants invalides" });
    }

    const ok = await bcrypt.compare(String(password), user.passwordHash || "");
    if (!ok) {
      logAction('warn', 'login_wrong_password', user.id, { ip: req.ip });
      return res.status(401).json({ error: "Identifiants invalides" });
    }

    const token = signToken(user);
    
    logAction('info', 'user_login', user.id, { ip: req.ip });
    
    res.json({ 
      token, 
      user: { 
        id: user.id, 
        email: user.email, 
        name: user.name, 
        role: user.role 
      } 
    });
    
  } catch (error) {
    logAction('error', 'login_error', null, { error: error.message, ip: req.ip });
    console.error('Erreur login:', error);
    res.status(500).json({ error: "Erreur serveur lors de la connexion" });
  }
});

// Routes utilisateur avec validation
app.get("/api/user/profile", authMiddleware, (req, res) => {
  try {
    const users = loadUsers();
    const user = users[req.user.sub];
    
    if (!user) {
      return res.status(404).json({ error: "Utilisateur introuvable" });
    }
    
    const meta = getMeta(user.id);
    
    res.json({ 
      id: user.id, 
      email: user.email, 
      name: user.name, 
      prenom: meta.name || user.name,
      role: user.role 
    });
    
  } catch (error) {
    logAction('error', 'profile_error', req.userId, { error: error.message });
    res.status(500).json({ error: "Erreur récupération profil" });
  }
});

app.get("/api/me", authMiddleware, (req, res) => {
  try {
    const users = loadUsers();
    const user = users[req.user.sub];
    
    if (!user) {
      return res.status(404).json({ error: "Utilisateur introuvable" });
    }
    
    const meta = getMeta(user.id);
    
    res.json({ 
      user: { 
        id: user.id, 
        email: user.email, 
        name: user.name, 
        role: user.role 
      }, 
      meta 
    });
    
  } catch (error) {
    logAction('error', 'me_error', req.userId, { error: error.message });
    res.status(500).json({ error: "Erreur récupération données utilisateur" });
  }
});

// Routes chat avec limite de débit
app.get("/api/chat/history", authMiddleware, (req, res) => {
  try {
    const day = Number(req.query.day || 1);
    
    if (day < 1 || day > 15) {
      return res.status(400).json({ error: "Jour invalide (1-15)" });
    }
    
    const entries = getEntries(req.user.sub, day);
    res.json(entries);
    
  } catch (error) {
    logAction('error', 'chat_history_error', req.userId, { error: error.message });
    res.status(500).json({ error: "Erreur récupération historique" });
  }
});

app.post("/api/chat/save", authMiddleware, (req, res) => {
  try {
    const { day = 1, message = "", role = "user" } = req.body || {};
    
    if (!message.trim()) {
      return res.status(400).json({ error: "Message vide" });
    }
    
    if (!["user", "ai"].includes(role)) {
      return res.status(400).json({ error: "Role invalide" });
    }
    
    addEntry(req.user.sub, day, { 
      role, 
      message: message.trim(), 
      date: new Date().toISOString() 
    });
    
    res.json({ success: true });
    
  } catch (error) {
    logAction('error', 'chat_save_error', req.userId, { error: error.message });
    res.status(500).json({ error: "Erreur sauvegarde message" });
  }
});

// Routes legacy journal
app.get("/api/journal", authMiddleware, (req, res) => {
  try {
    const day = Number(req.query.day || 1);
    if (day < 1 || day > 15) {
      return res.status(400).json({ error: "Jour invalide (1-15)" });
    }
    res.json(getEntries(req.user.sub, day));
  } catch (error) {
    logAction('error', 'journal_error', req.userId, { error: error.message });
    res.status(500).json({ error: "Erreur récupération journal" });
  }
});

app.post("/api/journal/save", authMiddleware, (req, res) => {
  try {
    const { day = 1, message = "", role = "user" } = req.body || {};
    
    if (!message.trim()) {
      return res.status(400).json({ error: "Message vide" });
    }
    
    addEntry(req.user.sub, day, { role, message: message.trim(), date: new Date().toISOString() });
    res.json({ success: true });
    
  } catch (error) {
    logAction('error', 'journal_save_error', req.userId, { error: error.message });
    res.status(500).json({ error: "Erreur sauvegarde journal" });
  }
});

// CoachBot v2.0 - Serveur complet corrigé - PARTIE 4/4

// Meta API
app.get("/api/meta", authMiddleware, (req, res) => {
  try {
    res.json(getMeta(req.user.sub));
  } catch (error) {
    logAction('error', 'meta_get_error', req.userId, { error: error.message });
    res.status(500).json({ error: "Erreur récupération métadonnées" });
  }
});

app.post("/api/meta", authMiddleware, (req, res) => {
  try {
    const meta = setMeta(req.user.sub, { name: req.body?.name, disc: req.body?.disc });
    res.json({ success: true, meta });
  } catch (error) {
    logAction('error', 'meta_set_error', req.userId, { error: error.message });
    res.status(500).json({ error: "Erreur sauvegarde métadonnées" });
  }
});

// IA helpers
function systemPrompt(name, disc) {
  const base = getPromptText();
  const note = `\n\n[Contexte CoachBot]\nPrénom: ${name || "Inconnu"}\nDISC: ${disc || "À déduire"}\nRappels: réponses courtes, concrètes, micro-action 10 min, critère de réussite, tutoiement.`;
  return base + note;
}

// 🤖 CHAT IA AMÉLIORÉ AVEC TIMEOUT ET RETRY
app.post("/api/chat/message", authMiddleware, chatLimiter, async (req, res) => {
  const { message, day = 1, provider = "anthropic" } = req.body ?? {};
  
  if (!message || !message.trim()) {
    return res.status(400).json({ error: "Message requis" });
  }
  
  const meta0 = getMeta(req.user.sub);

  // Heuristiques
  if (!meta0.name) {
    const n = maybeExtractName(message);
    if (n && n.length >= 2) setMeta(req.user.sub, { name: n });
  }
  if (!meta0.disc) {
    const d = inferDISC(message);
    if (d) setMeta(req.user.sub, { disc: d });
  }

  addEntry(req.user.sub, day, { role: "user", message: message.trim(), date: new Date().toISOString() });

  const meta = getMeta(req.user.sub);
  
  // Contexte global utilisateur
  const chatHistory = getEntries(req.user.sub, day);
  const userSummary = createUserSummary(req.user.sub, day);
  
  const system = systemPrompt(meta.name, meta.disc);
  
  let conversationContext = `${userSummary}\n\n`;
  conversationContext += `[SESSION ACTUELLE - JOUR ${day}]\n`;
  conversationContext += `Plan du jour : ${plans[Number(day)] || "Plan non spécifié."}\n\n`;
  
  if (chatHistory.length > 1) {
    conversationContext += "Messages du jour actuel :\n";
    chatHistory.slice(0, -1).forEach(entry => {
      conversationContext += `${entry.role === 'user' ? 'Utilisateur' : 'Assistant'}: ${entry.message}\n`;
    });
    conversationContext += "\n";
  }
  
  conversationContext += `Message actuel de l'utilisateur : ${message}`;

  // Headers SSE avec timeout
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Cache-Control");
  
  // Timeout pour éviter les connexions qui traînent
  const timeoutId = setTimeout(() => {
    logAction('warn', 'chat_timeout', req.userId, { day });
    res.write(`data: ${JSON.stringify({ error: "Timeout de la requête" })}\n\n`);
    res.write("data: [DONE]\n\n");
    res.end();
  }, 30000); // 30 secondes timeout
  
  res.flushHeaders?.();

  const send = (obj) => res.write(`data: ${JSON.stringify(obj)}\n\n`);
  const end = () => { 
    clearTimeout(timeoutId);
    res.write("data: [DONE]\n\n"); 
    res.end(); 
  };

  try {
    if (provider === "anthropic" || provider === "claude") {
      if (!process.env.ANTHROPIC_API_KEY) { 
        send({ error: "ANTHROPIC_API_KEY manquante" }); 
        return end(); 
      }

      const controller = new AbortController();
      const timeoutAbort = setTimeout(() => controller.abort(), 25000); // Abort après 25s

      const resp = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": process.env.ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json"
        },
        body: JSON.stringify({
          model: ANTHROPIC_MODEL,
          max_tokens: 1000,
          temperature: 0.4,
          stream: true,
          system,
          messages: [{ role: "user", content: conversationContext }]
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutAbort);

      if (!resp.ok || !resp.body) {
        const errorText = await resp.text().catch(() => "");
        logAction('error', 'claude_api_error', req.userId, { status: resp.status, error: errorText });
        send({ error: `Erreur Claude API ${resp.status}: ${errorText}` });
        return end();
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let full = "";
      let chunkCount = 0;
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        chunkCount++;
        const chunk = decoder.decode(value, { stream: true });
        
        for (const line of chunk.split("\n")) {
          if (!line.startsWith("data:")) continue;
          const payload = line.slice(5).trim();
          if (payload === "[DONE]") break;
          
          try {
            const evt = JSON.parse(payload);
            if (evt.type === "content_block_delta" && evt.delta?.type === "text_delta") {
              const delta = evt.delta.text || "";
              if (delta) { 
                full += delta; 
                send({ content: delta });
              }
            }
          } catch (parseError) {
            logAction('debug', 'stream_parse_error', req.userId, { error: parseError.message });
          }
        }
        
        if (chunkCount > 1000) {
          logAction('warn', 'too_many_chunks', req.userId, { chunkCount });
          break;
        }
      }
      
      if (full.trim()) {
        addEntry(req.user.sub, day, { role: "ai", message: full, date: new Date().toISOString() });
        logAction('info', 'ai_response_success', req.userId, { responseLength: full.length, chunkCount });
      } else {
        logAction('warn', 'empty_ai_response', req.userId);
        send({ error: "Réponse IA vide" });
      }
      
      return end();
    }

    send({ error: "Fournisseur IA non supporté" });
    return end();
    
  } catch (error) {
    clearTimeout(timeoutId);
    logAction('error', 'chat_stream_error', req.userId, { error: error.message });
    console.error("Erreur chat stream:", error);
    
    if (error.name === 'AbortError') {
      send({ error: "Requête interrompue (timeout)" });
    } else {
      send({ error: "Erreur serveur lors de la génération de réponse" });
    }
    return end();
  }
});

// Chat streaming legacy (pour compatibilité)
app.post("/api/chat/stream", authMiddleware, chatLimiter, async (req, res) => {
  // Même logique que /api/chat/message mais avec 'text' au lieu de 'content'
  // Redirection vers la nouvelle route
  req.body.isLegacy = true;
  // Réutiliser la même logique mais adapter le format de sortie
  const originalSend = res.write;
  res.write = function(chunk) {
    if (chunk.includes('"content":')) {
      chunk = chunk.replace('"content":', '"text":');
    }
    return originalSend.call(this, chunk);
  };
  
  // Appeler la même logique
  return app._router.handle(req, res);
});

// 👑 ADMIN API SÉCURISÉ
app.get("/api/admin/stats", authMiddleware, adminOnly, (req, res) => {
  try {
    const users = loadUsers();
    const journal = loadJournal();
    const totalUsers = Object.keys(users).length;
    
    const totalMessages = Object.values(journal).reduce((acc, days) => {
      if (!days || typeof days !== "object") return acc;
      return acc + Object.values(days).reduce((a, arr) => a + (Array.isArray(arr) ? arr.length : 0), 0);
    }, 0);
    
    const perDay = [];
    for (let day = 1; day <= 15; day++) {
      let count = 0;
      Object.values(journal).forEach(userDays => {
        if (userDays && userDays[day]) {
          count += Array.isArray(userDays[day]) ? userDays[day].length : 1;
        }
      });
      perDay.push({ day, count });
    }
    
    logAction('info', 'admin_stats_accessed', req.userId);
    res.json({ totalUsers, totalMessages, perDay });
    
  } catch (error) {
    logAction('error', 'admin_stats_error', req.userId, { error: error.message });
    res.status(500).json({ error: "Erreur récupération statistiques" });
  }
});

app.get("/api/admin/users", authMiddleware, adminOnly, (req, res) => {
  try {
    const users = loadUsers();
    const list = Object.values(users).map(u => ({
      id: u.id, email: u.email, name: u.name || null, 
      role: u.role || "user", createdAt: u.createdAt
    }));
    
    logAction('info', 'admin_users_list', req.userId);
    res.json(list);
    
  } catch (error) {
    logAction('error', 'admin_users_error', req.userId, { error: error.message });
    res.status(500).json({ error: "Erreur récupération utilisateurs" });
  }
});

app.get("/api/admin/user/:id", authMiddleware, adminOnly, (req, res) => {
  try {
    const users = loadUsers();
    const user = users[req.params.id];
    if (!user) return res.status(404).json({ error: "Utilisateur non trouvé" });
    
    const meta = getMeta(user.id);
    const journal = loadJournal();
    const userJournal = journal[user.id] || {};
    
    let totalMessages = 0;
    let daysActive = 0;
    for (let day = 1; day <= 15; day++) {
      const dayData = userJournal[day];
      if (dayData) {
        const count = Array.isArray(dayData) ? dayData.length : 1;
        totalMessages += count;
        if (count > 0) daysActive++;
      }
    }
    
    logAction('info', 'admin_user_detail', req.userId, { targetUserId: user.id });
    
    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        createdAt: user.createdAt
      },
      meta,
      stats: {
        totalMessages,
        daysActive,
        progression: Math.round((daysActive / 15) * 100)
      },
      journal: userJournal
    });
    
  } catch (error) {
    logAction('error', 'admin_user_detail_error', req.userId, { error: error.message });
    res.status(500).json({ error: "Erreur récupération détails utilisateur" });
  }
});

app.delete("/api/admin/user/:id", authMiddleware, adminOnly, (req, res) => {
  try {
    const users = loadUsers();
    const targetUserId = req.params.id;
    
    if (!users[targetUserId]) {
      return res.status(404).json({ error: "Utilisateur non trouvé" });
    }
    
    if (targetUserId === req.userId) {
      return res.status(400).json({ error: "Impossible de supprimer son propre compte admin" });
    }
    
    delete users[targetUserId];
    saveUsers(users);
    
    const journal = loadJournal();
    delete journal[targetUserId];
    saveJournal(journal);
    
    const meta = loadMetaAll();
    delete meta[targetUserId];
    saveMetaAll(meta);
    
    logAction('warn', 'admin_user_deleted', req.userId, { deletedUserId: targetUserId });
    res.json({ success: true });
    
  } catch (error) {
    logAction('error', 'admin_user_delete_error', req.userId, { error: error.message });
    res.status(500).json({ error: "Erreur suppression utilisateur" });
  }
});

app.get("/api/admin/export/:id", authMiddleware, adminOnly, (req, res) => {
  try {
    const userId = req.params.id;
    const users = loadUsers();
    const user = users[userId];
    
    if (!user) return res.status(404).json({ error: "Utilisateur non trouvé" });
    
    const meta = getMeta(userId);
    const journal = loadJournal();
    const userJournal = journal[userId] || {};
    
    const exportData = {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        createdAt: user.createdAt
      },
      meta,
      journal: userJournal,
      exportDate: new Date().toISOString()
    };
    
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="coachbot-export-${userId}.json"`);
    res.json(exportData);
    
  } catch (error) {
    logAction('error', 'admin_export_error', req.userId, { error: error.message });
    res.status(500).json({ error: "Erreur export utilisateur" });
  }
});

app.get("/api/admin/analytics", authMiddleware, adminOnly, (req, res) => {
  try {
    const users = loadUsers();
    const journal = loadJournal();
    const meta = loadMetaAll();
    
    const userStats = {
      total: Object.keys(users).length,
      admins: Object.values(users).filter(u => u.role === "admin").length,
      users: Object.values(users).filter(u => u.role !== "admin").length
    };
    
    const discStats = { D: 0, I: 0, S: 0, C: 0, unknown: 0 };
    Object.values(meta).forEach(m => {
      if (m.disc && discStats.hasOwnProperty(m.disc)) {
        discStats[m.disc]++;
      } else {
        discStats.unknown++;
      }
    });
    
    const activityByDay = {};
    for (let day = 1; day <= 15; day++) {
      activityByDay[day] = { users: 0, messages: 0 };
    }
    
    Object.entries(journal).forEach(([userId, userJournal]) => {
      for (let day = 1; day <= 15; day++) {
        const dayData = userJournal[day];
        if (dayData) {
          const count = Array.isArray(dayData) ? dayData.length : 1;
          if (count > 0) {
            activityByDay[day].users++;
            activityByDay[day].messages += count;
          }
        }
      }
    });
    
    res.json({
      userStats,
      discStats,
      activityByDay,
      summary: {
        totalMessages: Object.values(journal).reduce((acc, userJournal) => {
          return acc + Object.values(userJournal).reduce((a, dayData) => {
            return a + (Array.isArray(dayData) ? dayData.length : (dayData ? 1 : 0));
          }, 0);
        }, 0)
      }
    });
    
  } catch (error) {
    logAction('error', 'admin_analytics_error', req.userId, { error: error.message });
    res.status(500).json({ error: "Erreur analytics" });
  }
});

// Health routes
app.get("/healthz", (req, res) => res.json({ ok: true, timestamp: new Date().toISOString() }));
app.get("/healthz/ready", (req, res) => {
  const okClaude = !!process.env.ANTHROPIC_API_KEY;
  res.json({ ok: true, claude: okClaude, time: new Date().toISOString() });
});

// 🛡️ GESTION D'ERREURS GLOBALES
app.use((err, req, res, next) => {
  logAction('error', 'unhandled_error', req.userId, { error: err.message, stack: err.stack });
  console.error("Erreur non gérée:", err);
  res.status(500).json({ 
    error: "Erreur interne du serveur",
    message: process.env.NODE_ENV === "development" ? err.message : "Une erreur s'est produite"
  });
});

// Route 404 pour API
app.use("/api/*", (req, res) => {
  res.status(404).json({ error: "Route API non trouvée" });
});

// Configuration du serveur
const PORT = process.env.PORT || 8787;
const HOST = process.env.HOST || "0.0.0.0";

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("🛑 SIGTERM reçu, arrêt du serveur...");
  process.exit(0);
});

process.on("SIGINT", () => {
  console.log("🛑 SIGINT reçu, arrêt du serveur...");
  process.exit(0);
});

// Gestion des erreurs non capturées
process.on("uncaughtException", (err) => {
  console.error("⚠️ Exception non capturée:", err);
  process.exit(1);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("⚠️ Promesse rejetée non gérée:", reason);
  process.exit(1);
});

// Démarrage du serveur
app.listen(PORT, HOST, () => {
  console.log(`
🚀 CoachBot v2.0 CORRIGÉ - Serveur démarré !
🔗 URL: http://${HOST}:${PORT}
🔐 Admin: ${process.env.ADMIN_EMAIL || "Non configuré"}
🤖 IA: ${process.env.ANTHROPIC_API_KEY ? "✅ Claude configuré" : "⚠️ API manquante"}
🗃️ Data: ${USERS_PATH}
📝 Journal: ${JOURNAL_PATH}
🧠 Meta: ${META_PATH}
🎯 Prompt: ${PROMPT_PATH}

🤲🏻 Bi-idhnillah, le coaching sécurisé peut commencer !
✅ Corrections appliquées: 
   - Routes /admin et /onboarding fixes
   - Sécurité renforcée (XSS, validation, timeouts)
   - Gestion d'erreurs améliorée
   - Logging structuré
   - Validation stricte des données
   - Protection contre corruptions JSON
   - Un seul catch-all en fin de fichier
  `);
});

// Export pour les tests
export default app;

// CoachBot v2.0 - Serveur complet avec GAMIFICATION intégrée
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

// Headers microphone
app.use((req, res, next) => {
  res.setHeader('Permissions-Policy', 'microphone=*, camera=*, geolocation=*');
  res.setHeader('Feature-Policy', 'microphone *; camera *; geolocation *');
  res.setHeader('Cross-Origin-Embedder-Policy', 'unsafe-none');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
  next();
});

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 100,
  message: "Trop de requêtes, réessayez plus tard.",
  trustProxy: true
});

app.use(limiter);
app.use(cors());
app.use(bodyParser.json({ limit: "1mb" }));

// Configuration
const USERS_PATH = process.env.USERS_PATH || "./users.json";
const JOURNAL_PATH = process.env.JOURNAL_PATH || "./journal.json";
const META_PATH = process.env.META_PATH || "./meta.json";
const GAMIFICATION_PATH = process.env.GAMIFICATION_PATH || "./gamification.json"; // NOUVEAU
const PROMPT_PATH = process.env.PROMPT_PATH || path.join(__dirname, "prompt.txt");
const JWT_SECRET = process.env.JWT_SECRET || "change_me_now";
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || "claude-3-5-sonnet-20241022";

// 🎮 SYSTÈME GAMIFICATION - CONFIGURATION
const GAMIFICATION_CONFIG = {
  points: {
    MESSAGE_SENT: 10,           // Points par message utilisateur
    AI_INTERACTION: 5,          // Points par réponse IA reçue
    DAY_COMPLETED: 100,         // Points pour finir un jour
    STREAK_BONUS: 50,           // Bonus par jour de streak
    FIRST_LOGIN: 100,           // Bonus première connexion
    PERFECT_WEEK: 500,          // Bonus semaine parfaite
    PROGRAM_COMPLETED: 1000     // Bonus programme complet
  },
  levels: {
    1: { min: 0, max: 199, title: "Débutant Sincère", emoji: "🌱" },
    2: { min: 200, max: 499, title: "Chercheur Déterminé", emoji: "🎯" },
    3: { min: 500, max: 999, title: "Marcheur Assidu", emoji: "🚶‍♂️" },
    4: { min: 1000, max: 1999, title: "Pratiquant Régulier", emoji: "📿" },
    5: { min: 2000, max: 3499, title: "Disciple Engagé", emoji: "✨" },
    6: { min: 3500, max: 5499, title: "Serviteur Pieux", emoji: "🤲🏻" },
    7: { min: 5500, max: 7999, title: "Guide Inspirant", emoji: "🌟" },
    8: { min: 8000, max: 11999, title: "Sage Accompli", emoji: "💎" },
    9: { min: 12000, max: 17999, title: "Maître Spirituel", emoji: "👑" },
    10: { min: 18000, max: 999999, title: "Champion d'Allah", emoji: "🏆" }
  },
  badges: {
    FIRST_STEPS: { name: "Premiers Pas", desc: "Première conversation", emoji: "👶", condition: "messages >= 1" },
    CONSISTENT: { name: "Assidu", desc: "3 jours consécutifs", emoji: "🔥", condition: "streak >= 3" },
    WEEK_WARRIOR: { name: "Guerrier Hebdomadaire", desc: "7 jours consécutifs", emoji: "⚔️", condition: "streak >= 7" },
    HALF_WAY: { name: "Mi-Parcours", desc: "Jour 8 atteint", emoji: "🏃‍♂️", condition: "currentDay >= 8" },
    FINISHER: { name: "Finisseur", desc: "Programme terminé", emoji: "🎯", condition: "currentDay >= 15" },
    CHATTER: { name: "Bavard", desc: "50 messages", emoji: "💬", condition: "totalMessages >= 50" },
    DEDICATED: { name: "Dévoué", desc: "100 messages", emoji: "📞", condition: "totalMessages >= 100" },
    VOCAL_MASTER: { name: "Maître Vocal", desc: "10 interactions vocales", emoji: "🎤", condition: "voiceMessages >= 10" },
    EARLY_BIRD: { name: "Lève-tôt", desc: "Session avant 7h", emoji: "🌅", condition: "earlyBird >= 1" },
    NIGHT_OWL: { name: "Noctambule", desc: "Session après 22h", emoji: "🦉", condition: "nightOwl >= 1" },
    PERFECT_WEEK: { name: "Semaine Parfaite", desc: "7 jours sans interruption", emoji: "💯", condition: "perfectWeeks >= 1" }
  }
};

// Utilitaires
function ensureDir(p) { 
  try { fs.mkdirSync(path.dirname(p), { recursive: true }); } catch(e) {}
}

function loadJSON(p, fallback = {}) {
  try {
    if (!fs.existsSync(p)) return fallback;
    const raw = fs.readFileSync(p, "utf-8");
    const obj = JSON.parse(raw);
    return obj && typeof obj === "object" ? obj : fallback;
  } catch { return fallback; }
}

function saveJSON(p, obj) { 
  ensureDir(p); 
  fs.writeFileSync(p, JSON.stringify(obj, null, 2)); 
}

function getPromptText() {
  try { return fs.readFileSync(PROMPT_PATH, "utf-8"); } 
  catch { return "Tu es CoachBot 🤲🏻, un coach personnel bienveillant et orienté résultats."; }
}

// Data management (existant)
function loadUsers() { return loadJSON(USERS_PATH, {}); }
function saveUsers(u) { saveJSON(USERS_PATH, u); }
function loadJournal() { return loadJSON(JOURNAL_PATH, {}); }
function saveJournal(j) { saveJSON(JOURNAL_PATH, j); }
function loadMetaAll() { return loadJSON(META_PATH, {}); }
function saveMetaAll(m) { saveJSON(META_PATH, m); }

// 🎮 NOUVEAU - Gamification Data Management
function loadGamification() { return loadJSON(GAMIFICATION_PATH, {}); }
function saveGamification(g) { saveJSON(GAMIFICATION_PATH, g); }

function getGamificationData(userId) {
  const allGamification = loadGamification();
  return allGamification[userId] || {
    totalPoints: 0,
    level: 1,
    currentStreak: 0,
    longestStreak: 0,
    totalMessages: 0,
    voiceMessages: 0,
    daysCompleted: 0,
    currentDay: 1,
    lastActivity: null,
    badges: [],
    stats: {
      earlyBird: 0,
      nightOwl: 0,
      perfectWeeks: 0,
      weekdaysActive: 0,
      weekendsActive: 0
    },
    dailyProgress: {},
    achievements: []
  };
}

function saveGamificationData(userId, data) {
  const allGamification = loadGamification();
  allGamification[userId] = data;
  saveGamification(allGamification);
}

// 🎮 CALCUL DU NIVEAU
function calculateLevel(points) {
  for (const [level, config] of Object.entries(GAMIFICATION_CONFIG.levels)) {
    if (points >= config.min && points <= config.max) {
      return parseInt(level);
    }
  }
  return 1;
}

// 🎮 VÉRIFICATION DES BADGES
function checkNewBadges(userId, gamificationData) {
  const newBadges = [];
  
  for (const [badgeId, badge] of Object.entries(GAMIFICATION_CONFIG.badges)) {
    if (!gamificationData.badges.includes(badgeId)) {
      // Évaluation simple des conditions
      let earned = false;
      const condition = badge.condition;
      
      // Parse conditions simples
      if (condition.includes('messages >=')) {
        const required = parseInt(condition.match(/\d+/)[0]);
        earned = gamificationData.totalMessages >= required;
      } else if (condition.includes('streak >=')) {
        const required = parseInt(condition.match(/\d+/)[0]);
        earned = gamificationData.currentStreak >= required;
      } else if (condition.includes('currentDay >=')) {
        const required = parseInt(condition.match(/\d+/)[0]);
        earned = gamificationData.currentDay >= required;
      } else if (condition.includes('voiceMessages >=')) {
        const required = parseInt(condition.match(/\d+/)[0]);
        earned = gamificationData.voiceMessages >= required;
      } else if (condition.includes('earlyBird >=')) {
        const required = parseInt(condition.match(/\d+/)[0]);
        earned = gamificationData.stats.earlyBird >= required;
      } else if (condition.includes('nightOwl >=')) {
        const required = parseInt(condition.match(/\d+/)[0]);
        earned = gamificationData.stats.nightOwl >= required;
      } else if (condition.includes('perfectWeeks >=')) {
        const required = parseInt(condition.match(/\d+/)[0]);
        earned = gamificationData.stats.perfectWeeks >= required;
      }
      
      if (earned) {
        gamificationData.badges.push(badgeId);
        newBadges.push({ id: badgeId, ...badge });
      }
    }
  }
  
  return newBadges;
}

// 🎮 CALCUL STREAK
function updateStreak(userId, gamificationData) {
  const now = new Date();
  const today = now.toDateString();
  const currentHour = now.getHours();
  
  // Stats horaires
  if (currentHour < 7) {
    gamificationData.stats.earlyBird++;
  } else if (currentHour > 22) {
    gamificationData.stats.nightOwl++;
  }
  
  if (gamificationData.lastActivity) {
    const lastDate = new Date(gamificationData.lastActivity).toDateString();
    
    if (lastDate !== today) {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      
      if (lastDate === yesterday.toDateString()) {
        // Continuité du streak
        gamificationData.currentStreak++;
      } else {
        // Streak cassé
        gamificationData.currentStreak = 1;
      }
    }
    // Si même jour, pas de changement de streak
  } else {
    // Premier jour
    gamificationData.currentStreak = 1;
  }
  
  gamificationData.longestStreak = Math.max(gamificationData.longestStreak, gamificationData.currentStreak);
  gamificationData.lastActivity = now.toISOString();
}

// 🎮 ATTRIBUTION POINTS
function awardPoints(userId, action, extraData = {}) {
  const gamificationData = getGamificationData(userId);
  const oldLevel = gamificationData.level;
  
  // Attribution des points selon l'action
  let pointsEarned = 0;
  
  switch (action) {
    case 'MESSAGE_SENT':
      pointsEarned = GAMIFICATION_CONFIG.points.MESSAGE_SENT;
      gamificationData.totalMessages++;
      if (extraData.isVoice) gamificationData.voiceMessages++;
      break;
    case 'AI_INTERACTION':
      pointsEarned = GAMIFICATION_CONFIG.points.AI_INTERACTION;
      break;
    case 'DAY_COMPLETED':
      pointsEarned = GAMIFICATION_CONFIG.points.DAY_COMPLETED;
      gamificationData.daysCompleted++;
      gamificationData.currentDay = Math.max(gamificationData.currentDay, extraData.day || 1);
      break;
    case 'FIRST_LOGIN':
      pointsEarned = GAMIFICATION_CONFIG.points.FIRST_LOGIN;
      break;
  }
  
  // Bonus streak
  updateStreak(userId, gamificationData);
  if (gamificationData.currentStreak > 1) {
    pointsEarned += GAMIFICATION_CONFIG.points.STREAK_BONUS * (gamificationData.currentStreak - 1);
  }
  
  gamificationData.totalPoints += pointsEarned;
  gamificationData.level = calculateLevel(gamificationData.totalPoints);
  
  // Vérifier nouveaux badges
  const newBadges = checkNewBadges(userId, gamificationData);
  
  // Sauvegarde
  saveGamificationData(userId, gamificationData);
  
  return {
    pointsEarned,
    totalPoints: gamificationData.totalPoints,
    level: gamificationData.level,
    levelUp: gamificationData.level > oldLevel,
    newBadges,
    streak: gamificationData.currentStreak,
    levelInfo: GAMIFICATION_CONFIG.levels[gamificationData.level]
  };
}

// Plans coaching (existant)
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

// Journal functions (existant)
function getEntries(userId, day) {
  const db = loadJournal();
  const u = db[userId] || {};
  const val = u[day];
  if (Array.isArray(val)) return val;
  if (val && typeof val === "object") return [val];
  return [];
}

function addEntry(userId, day, entry) {
  const db = loadJournal();
  if (!db[userId] || typeof db[userId] !== "object") db[userId] = {};
  const val = db[userId][day];
  let arr;
  if (Array.isArray(val)) arr = val;
  else if (val && typeof val === "object") arr = [val];
  else arr = [];
  arr.push(entry);
  db[userId][day] = arr;
  saveJournal(db);
  
  // 🎮 GAMIFICATION - Attribution points
  if (entry.role === 'user') {
    awardPoints(userId, 'MESSAGE_SENT', { isVoice: entry.isVoice || false });
  } else if (entry.role === 'ai') {
    awardPoints(userId, 'AI_INTERACTION');
  }
}

// Historique utilisateur (existant)
function getAllUserHistory(userId) {
  const db = loadJournal();
  const userJournal = db[userId] || {};
  
  let allMessages = [];
  
  for (let day = 1; day <= 15; day++) {
    const dayEntries = userJournal[day];
    if (dayEntries) {
      const entries = Array.isArray(dayEntries) ? dayEntries : [dayEntries];
      entries.forEach(entry => {
        allMessages.push({
          ...entry,
          day: day
        });
      });
    }
  }
  
  allMessages.sort((a, b) => new Date(a.date) - new Date(b.date));
  return allMessages;
}

function createUserSummary(userId, currentDay) {
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
    .sort((a, b) => Number(a) - Number(b))
    .forEach(day => {
      if (Number(day) < currentDay) {
        summary += `\n--- JOUR ${day} ---\n`;
        const dayMessages = sessionsByDay[day];
        
        let objectives = [];
        let actions = [];
        let commitments = [];
        
        dayMessages.forEach(msg => {
          const content = msg.message.toLowerCase();
          
          if (msg.role === 'user' && (content.includes('objectif') || content.includes('but') || content.includes('veux'))) {
            objectives.push(msg.message);
          }
          
          if (msg.role === 'ai' && (content.includes('micro-action') || content.includes('action pour') || content.includes('programme'))) {
            actions.push(msg.message);
          }
          
          if (msg.role === 'user' && (content.includes('oui') || content.includes('ok') || content.includes('d\'accord') || content.includes('ameen'))) {
            commitments.push(msg.message);
          }
        });
        
        if (objectives.length > 0) {
          summary += `Objectifs identifiés: ${objectives[0]}\n`;
        }
        if (actions.length > 0) {
          summary += `Actions proposées: ${actions[0]}\n`;
        }
        if (commitments.length > 0) {
          summary += `Engagement utilisateur: ${commitments[commitments.length - 1]}\n`;
        }
      }
    });
  
  return summary;
}

// Meta functions (existant)
function getMeta(userId) {
  const m = loadMetaAll();
  return m[userId] || { name: null, disc: null };
}

function setMeta(userId, metaPatch) {
  const m = loadMetaAll();
  if (!m[userId]) m[userId] = { name: null, disc: null };
  if (typeof metaPatch?.name === "string") m[userId].name = metaPatch.name.trim();
  if (typeof metaPatch?.disc === "string") m[userId].disc = metaPatch.disc.toUpperCase();
  saveMetaAll(m);
  return m[userId];
}

// Heuristiques (existant)
function maybeExtractName(text) {
  const t = (text || "").trim();
  let m = t.match(/je m(?:'|e)appelle\s+([A-Za-zÀ-ÖØ-öø-ÿ' -]{2,30})/i)
       || t.match(/moi c['']est\s+([A-Za-zÀ-ÖØ-öø-ÿ' -]{2,30})/i)
       || (t.split(/\s+/).length === 1 ? [null, t] : null);
  return m ? m[1].trim().replace(/^[^A-Za-zÀ-ÖØ-öø-ÿ]+|[^A-Za-zÀ-ÖØ-öø-ÿ]+$/g, "") : null;
}

function inferDISC(text) {
  const t = (text || "").trim();
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

// Auth (existant)
function signToken(user) {
  return jwt.sign({ sub: user.id, role: user.role || "user" }, JWT_SECRET, { expiresIn: "30d" });
}

function authMiddleware(req, res, next) {
  try {
    const hdr = req.headers.authorization || "";
    const token = hdr.startsWith("Bearer ") ? hdr.slice(7) : null;
    if (!token) return res.status(401).json({ error: "Non authentifié" });
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    next();
  } catch {
    return res.status(401).json({ error: "Token invalide/expiré" });
  }
}

function adminOnly(req, res, next) {
  if (req.user?.role !== "admin") return res.status(403).json({ error: "Accès admin requis" });
  next();
}

// Seed admin (existant)
async function seedAdminIfNeeded() {
  const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "";
  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "";
  
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) return;
  
  const users = loadUsers();
  const existing = Object.values(users).find(u => 
    u?.email && String(u.email).toLowerCase() === String(ADMIN_EMAIL).toLowerCase()
  );
  
  if (existing) return;
  
  const id = "u_" + Math.random().toString(36).slice(2, 10);
  const hash = await bcrypt.hash(ADMIN_PASSWORD, 10);
  users[id] = {
    id, email: ADMIN_EMAIL, name: "Admin", role: "admin",
    passwordHash: hash, createdAt: new Date().toISOString()
  };
  saveUsers(users);
  
  // 🎮 Initialiser gamification admin
  awardPoints(id, 'FIRST_LOGIN');
  
  console.log(`✅ Admin seedé: ${ADMIN_EMAIL}`);
}

seedAdminIfNeeded().catch(console.error);

// Routes statiques (existant)
app.use(express.static(path.join(__dirname, "public")));
app.get("/", (req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));

// Admin routes (existant)
app.get("/admin", (req, res) => {
  const adminPath = path.join(__dirname, "public", "admin.html");
  if (fs.existsSync(adminPath)) return res.sendFile(adminPath);
  res.status(404).send("Admin UI non déployée.");
});

app.get("/adminpanel", (req, res) => {
  const adminPath = path.join(__dirname, "public", "admin.html");
  if (fs.existsSync(adminPath)) return res.sendFile(adminPath);
  res.status(404).send("Admin UI non déployée.");
});

// Auth API (modifié pour gamification)
app.post("/api/auth/register", async (req, res) => {
  try {
    const { email, password, name } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: "Email et mot de passe requis" });

    const users = loadUsers();
    const exists = Object.values(users).find(u => 
      u?.email && String(u.email).toLowerCase() === String(email).toLowerCase()
    );
    if (exists) return res.status(400).json({ error: "Email déjà utilisé" });

    const id = "u_" + Math.random().toString(36).slice(2, 10);
    const hash = await bcrypt.hash(String(password), 10);
    users[id] = {
      id, email: String(email).toLowerCase(), name: name?.trim() || null,
      role: "user", passwordHash: hash, createdAt: new Date().toISOString()
    };
    saveUsers(users);
    setMeta(id, { name: users[id].name || null });

    // 🎮 GAMIFICATION - Premier login
    const gamificationResult = awardPoints(id, 'FIRST_LOGIN');

    const token = signToken(users[id]);
    res.json({ 
      token, 
      user: { id, email: users[id].email, name: users[id].name, role: "user" },
      gamification: gamificationResult
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: "Email et mot de passe requis" });

    const users = loadUsers();
    const user = Object.values(users).find(u => 
      u?.email && String(u.email).toLowerCase() === String(email).toLowerCase()
    );
    if (!user) return res.status(401).json({ error: "Identifiants invalides" });

    const ok = await bcrypt.compare(String(password), user.passwordHash || "");
    if (!ok) return res.status(401).json({ error: "Identifiants invalides" });

    // 🎮 GAMIFICATION - Mettre à jour streak sur login
    updateStreak(user.id, getGamificationData(user.id));

    const token = signToken(user);
    res.json({ 
      token, 
      user: { id: user.id, email: user.email, name: user.name, role: user.role }
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// Routes profile (existant)
app.get("/api/user/profile", authMiddleware, (req, res) => {
  const users = loadUsers();
  const user = users[req.user.sub];
  if (!user) return res.status(401).json({ error: "Utilisateur introuvable" });
  const meta = getMeta(user.id);
  res.json({ 
    id: user.id, 
    email: user.email, 
    name: user.name, 
    prenom: meta.name || user.name,
    role: user.role 
  });
});

app.get("/api/me", authMiddleware, (req, res) => {
  const users = loadUsers();
  const user = users[req.user.sub];
  if (!user) return res.status(401).json({ error: "Utilisateur introuvable" });
  const meta = getMeta(user.id);
  res.json({ user: { id: user.id, email: user.email, name: user.name, role: user.role }, meta });
});

// 🎮 NOUVELLES ROUTES GAMIFICATION
app.get("/api/gamification/profile", authMiddleware, (req, res) => {
  const gamificationData = getGamificationData(req.user.sub);
  const levelInfo = GAMIFICATION_CONFIG.levels[gamificationData.level];
  const nextLevelInfo = GAMIFICATION_CONFIG.levels[gamificationData.level + 1];
  
  res.json({
    ...gamificationData,
    levelInfo,
    nextLevelInfo,
    badges: gamificationData.badges.map(badgeId => ({
      id: badgeId,
      ...GAMIFICATION_CONFIG.badges[badgeId]
    })),
    progressToNextLevel: nextLevelInfo ? 
      ((gamificationData.totalPoints - levelInfo.min) / (nextLevelInfo.min - levelInfo.min)) * 100 : 100
  });
});

app.get("/api/gamification/leaderboard", authMiddleware, (req, res) => {
  const allGamification = loadGamification();
  const users = loadUsers();
  
  const leaderboard = Object.entries(allGamification)
    .map(([userId, data]) => ({
      userId,
      name: users[userId]?.name || getMeta(userId).name || "Utilisateur",
      totalPoints: data.totalPoints,
      level: data.level,
      levelInfo: GAMIFICATION_CONFIG.levels[data.level],
      badges: data.badges.length,
      streak: data.currentStreak
    }))
    .sort((a, b) => b.totalPoints - a.totalPoints)
    .slice(0, 20);
  
  // Position de l'utilisateur actuel
  const userPosition = leaderboard.findIndex(entry => entry.userId === req.user.sub) + 1;
  
  res.json({
    leaderboard,
    userPosition: userPosition || null,
    totalUsers: Object.keys(allGamification).length
  });
});

app.get("/api/gamification/badges", authMiddleware, (req, res) => {
  const gamificationData = getGamificationData(req.user.sub);
  const allBadges = Object.entries(GAMIFICATION_CONFIG.badges).map(([id, badge]) => ({
    id,
    ...badge,
    earned: gamificationData.badges.includes(id),
    earnedAt: gamificationData.achievements.find(a => a.type === 'badge' && a.id === id)?.date || null
  }));
  
  res.json({
    badges: allBadges,
    totalBadges: allBadges.length,
    earnedBadges: gamificationData.badges.length
  });
});

app.post("/api/gamification/complete-day", authMiddleware, (req, res) => {
  const { day } = req.body;
  if (!day || day < 1 || day > 15) {
    return res.status(400).json({ error: "Jour invalide" });
  }
  
  const result = awardPoints(req.user.sub, 'DAY_COMPLETED', { day });
  res.json(result);
});

// Routes d'historique (existant)
app.get("/api/chat/history", authMiddleware, (req, res) => {
  const day = Number(req.query.day || 1);
  return res.json(getEntries(req.user.sub, day));
});

app.post("/api/chat/save", authMiddleware, (req, res) => {
  const { day = 1, message = "", role = "user", isVoice = false } = req.body || {};
  addEntry(req.user.sub, day, { role, message, isVoice, date: new Date().toISOString() });
  return res.json({ success: true });
});

// Journal API (legacy)
app.get("/api/journal", authMiddleware, (req, res) => {
  const day = Number(req.query.day || 1);
  return res.json(getEntries(req.user.sub, day));
});

app.post("/api/journal/save", authMiddleware, (req, res) => {
  const { day = 1, message = "", role = "user" } = req.body || {};
  addEntry(req.user.sub, day, { role, message, date: new Date().toISOString() });
  return res.json({ success: true });
});

// Meta API (existant)
app.get("/api/meta", authMiddleware, (req, res) => {
  res.json(getMeta(req.user.sub));
});

app.post("/api/meta", authMiddleware, (req, res) => {
  const meta = setMeta(req.user.sub, { name: req.body?.name, disc: req.body?.disc });
  res.json({ success: true, meta });
});

// IA helpers (existant)
function systemPrompt(name, disc) {
  const base = getPromptText();
  const note = `\n\n[Contexte CoachBot]\nPrénom: ${name || "Inconnu"}\nDISC: ${disc || "À déduire"}\nRappels: réponses courtes, concrètes, micro-action 10 min, critère de réussite, tutoiement.`;
  return base + note;
}

// Route chat principal (modifié pour gamification)
app.post("/api/chat/message", authMiddleware, async (req, res) => {
  const { message, day = 1, provider = "anthropic", isVoice = false } = req.body ?? {};
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

  // Sauvegarde avec gamification
  addEntry(req.user.sub, day, { role: "user", message, isVoice, date: new Date().toISOString() });

  const meta = getMeta(req.user.sub);
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

  // Headers pour Server-Sent Events
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Cache-Control");
  res.flushHeaders?.();

  const send = (obj) => res.write(`data: ${JSON.stringify(obj)}\n\n`);
  const end = () => { res.write("data: [DONE]\n\n"); res.end(); };

  try {
    if (provider === "anthropic" || provider === "claude") {
      if (!process.env.ANTHROPIC_API_KEY) { 
        send({ error: "ANTHROPIC_API_KEY manquante" }); 
        return end(); 
      }

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
        })
      });

      if (!resp.ok || !resp.body) {
        const t = await resp.text().catch(() => "");
        console.error("Claude stream error:", resp.status, t);
        send({ error: `Claude stream error ${resp.status}: ${t}` });
        return end();
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let full = "";
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
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
          } catch { /* ignore malformed lines */ }
        }
      }
      
      if (full) {
        addEntry(req.user.sub, day, { role: "ai", message: full, date: new Date().toISOString() });
        
        // 🎮 GAMIFICATION - Envoyer stats après réponse IA
        const gamificationData = getGamificationData(req.user.sub);
        send({ 
          type: "gamification_update",
          data: {
            totalPoints: gamificationData.totalPoints,
            level: gamificationData.level,
            streak: gamificationData.currentStreak,
            levelInfo: GAMIFICATION_CONFIG.levels[gamificationData.level]
          }
        });
      }
      return end();
    }

    send({ error: "Fournisseur inconnu ou non activé" });
    return end();
  } catch (e) {
    console.error("Erreur chat stream:", e);
    send({ error: "Erreur serveur" });
    return end();
  }
});

// Chat streaming legacy (existant avec ajout gamification)
app.post("/api/chat/stream", authMiddleware, async (req, res) => {
  const { message, day = 1, provider = "anthropic" } = req.body ?? {};
  const meta0 = getMeta(req.user.sub);

  if (!meta0.name) {
    const n = maybeExtractName(message);
    if (n && n.length >= 2) setMeta(req.user.sub, { name: n });
  }
  if (!meta0.disc) {
    const d = inferDISC(message);
    if (d) setMeta(req.user.sub, { disc: d });
  }

  addEntry(req.user.sub, day, { role: "user", message, date: new Date().toISOString() });

  const meta = getMeta(req.user.sub);
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

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  const send = (obj) => res.write(`data: ${JSON.stringify(obj)}\n\n`);
  const end = () => { res.write("data: [DONE]\n\n"); res.end(); };

  try {
    if (provider === "anthropic" || provider === "claude") {
      if (!process.env.ANTHROPIC_API_KEY) { 
        send({ error: "ANTHROPIC_API_KEY manquante" }); 
        return end(); 
      }

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
        })
      });

      if (!resp.ok || !resp.body) {
        const t = await resp.text().catch(() => "");
        console.error("Claude stream error:", resp.status, t);
        send({ error: `Claude stream error ${resp.status}: ${t}` });
        return end();
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let full = "";
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
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
                send({ text: delta }); 
              }
            }
          } catch { /* ignore malformed lines */ }
        }
      }
      
      if (full) addEntry(req.user.sub, day, { role: "ai", message: full, date: new Date().toISOString() });
      return end();
    }

    send({ error: "Fournisseur inconnu ou non activé" });
    return end();
  } catch (e) {
    console.error(e);
    send({ error: "Erreur serveur" });
    return end();
  }
});

// Admin API (existant avec ajout gamification)
app.get("/api/admin/stats", authMiddleware, adminOnly, (req, res) => {
  const users = loadUsers();
  const journal = loadJournal();
  const gamification = loadGamification();
  
  const totalUsers = Object.keys(users).length;
  const totalMessages = Object.values(journal).reduce((acc, days) => {
    if (!days || typeof days !== "object") return acc;
    return acc + Object.values(days).reduce((a, arr) => a + (Array.isArray(arr) ? arr.length : 0), 0);
  }, 0);
  
  // 🎮 Stats gamification
  const totalPoints = Object.values(gamification).reduce((acc, data) => acc + (data.totalPoints || 0), 0);
  const avgLevel = Object.values(gamification).reduce((acc, data) => acc + (data.level || 1), 0) / Math.max(Object.keys(gamification).length, 1);
  const totalBadges = Object.values(gamification).reduce((acc, data) => acc + (data.badges?.length || 0), 0);
  
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
  
  res.json({ 
    totalUsers, 
    totalMessages, 
    perDay,
    gamification: {
      totalPoints,
      avgLevel: Math.round(avgLevel * 10) / 10,
      totalBadges,
      activeUsers: Object.keys(gamification).length
    }
  });
});

app.get("/api/admin/users", authMiddleware, adminOnly, (req, res) => {
  const users = loadUsers();
  const gamification = loadGamification();
  
  const list = Object.values(users).map(u => {
    const userGameData = gamification[u.id] || {};
    return {
      id: u.id, 
      email: u.email, 
      name: u.name || null, 
      role: u.role || "user", 
      createdAt: u.createdAt,
      gamification: {
        totalPoints: userGameData.totalPoints || 0,
        level: userGameData.level || 1,
        streak: userGameData.currentStreak || 0,
        badges: userGameData.badges?.length || 0
      }
    };
  });
  
  res.json(list);
});

app.get("/api/admin/user/:id", authMiddleware, adminOnly, (req, res) => {
  const users = loadUsers();
  const user = users[req.params.id];
  if (!user) return res.status(404).json({ error: "Utilisateur non trouvé" });
  
  const meta = getMeta(user.id);
  const journal = loadJournal();
  const userJournal = journal[user.id] || {};
  const gamificationData = getGamificationData(user.id);
  
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
    journal: userJournal,
    gamification: {
      ...gamificationData,
      levelInfo: GAMIFICATION_CONFIG.levels[gamificationData.level],
      badges: gamificationData.badges.map(badgeId => ({
        id: badgeId,
        ...GAMIFICATION_CONFIG.badges[badgeId]
      }))
    }
  });
});

app.delete("/api/admin/user/:id", authMiddleware, adminOnly, (req, res) => {
  const users = loadUsers();
  if (!users[req.params.id]) return res.status(404).json({ error: "Utilisateur non trouvé" });
  
  delete users[req.params.id];
  saveUsers(users);
  
  const journal = loadJournal();
  delete journal[req.params.id];
  saveJournal(journal);
  
  const meta = loadMetaAll();
  delete meta[req.params.id];
  saveMetaAll(meta);
  
  // 🎮 Supprimer données gamification
  const gamification = loadGamification();
  delete gamification[req.params.id];
  saveGamification(gamification);
  
  res.json({ success: true });
});

app.get("/api/admin/export/:id", authMiddleware, adminOnly, (req, res) => {
  const userId = req.params.id;
  const users = loadUsers();
  const user = users[userId];
  
  if (!user) return res.status(404).json({ error: "Utilisateur non trouvé" });
  
  const meta = getMeta(userId);
  const journal = loadJournal();
  const userJournal = journal[userId] || {};
  const gamificationData = getGamificationData(userId);
  
  const exportData = {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      createdAt: user.createdAt
    },
    meta,
    journal: userJournal,
    gamification: gamificationData, // 🎮 Nouveau
    exportDate: new Date().toISOString()
  };
  
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="coachbot-export-${userId}.json"`);
  res.json(exportData);
});

app.get("/api/admin/analytics", authMiddleware, adminOnly, (req, res) => {
  const users = loadUsers();
  const journal = loadJournal();
  const meta = loadMetaAll();
  const gamification = loadGamification();
  
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
  
  const userActivity = Object.entries(journal).map(([userId, userJournal]) => {
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
    
    const user = users[userId];
    const userGamification = gamification[userId] || {};
    
    return {
      userId,
      email: user?.email || "Inconnu",
      name: user?.name || meta[userId]?.name || "Inconnu",
      totalMessages,
      daysActive,
      completion: Math.round((daysActive / 15) * 100),
      gamification: {
        totalPoints: userGamification.totalPoints || 0,
        level: userGamification.level || 1,
        badges: userGamification.badges?.length || 0,
        streak: userGamification.currentStreak || 0
      }
    };
  }).sort((a, b) => b.totalMessages - a.totalMessages);
  
  // 🎮 Stats gamification globales
  const gamificationStats = {
    totalPoints: Object.values(gamification).reduce((acc, data) => acc + (data.totalPoints || 0), 0),
    avgLevel: Object.values(gamification).reduce((acc, data) => acc + (data.level || 1), 0) / Math.max(Object.keys(gamification).length, 1),
    totalBadges: Object.values(gamification).reduce((acc, data) => acc + (data.badges?.length || 0), 0),
    maxStreak: Math.max(...Object.values(gamification).map(data => data.longestStreak || 0), 0),
    activeStreaks: Object.values(gamification).filter(data => (data.currentStreak || 0) > 0).length
  };
  
  res.json({
    userStats,
    discStats,
    activityByDay,
    topUsers: userActivity.slice(0, 10),
    gamificationStats, // 🎮 Nouveau
    summary: {
      totalMessages: Object.values(journal).reduce((acc, userJournal) => {
        return acc + Object.values(userJournal).reduce((a, dayData) => {
          return a + (Array.isArray(dayData) ? dayData.length : (dayData ? 1 : 0));
        }, 0);
      }, 0),
      avgCompletion: userActivity.length > 0 
        ? Math.round(userActivity.reduce((sum, u) => sum + u.completion, 0) / userActivity.length)
        : 0
    }
  });
});

// Health routes (existant)
app.get("/healthz", (req, res) => res.json({ ok: true }));
app.get("/healthz/ready", (req, res) => {
  const okClaude = !!process.env.ANTHROPIC_API_KEY;
  res.json({ ok: true, claude: okClaude, time: new Date().toISOString() });
});

// Gestion des erreurs globales (existant)
app.use((err, req, res, next) => {
  console.error("Erreur non gérée:", err);
  res.status(500).json({ 
    error: "Erreur interne du serveur",
    message: process.env.NODE_ENV === "development" ? err.message : "Une erreur s'est produite"
  });
});

// Route 404 pour API (existant)
app.use("/api/*", (req, res) => {
  res.status(404).json({ error: "Route API non trouvée" });
});

// Fallback pour SPA (existant)
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Configuration du serveur (existant)
const PORT = process.env.PORT || 8787;
const HOST = process.env.HOST || "0.0.0.0";

// Graceful shutdown (existant)
process.on("SIGTERM", () => {
  console.log("🛑 SIGTERM reçu, arrêt du serveur...");
  process.exit(0);
});

process.on("SIGINT", () => {
  console.log("🛑 SIGINT reçu, arrêt du serveur...");
  process.exit(0);
});

// Gestion des erreurs non capturées (existant)
process.on("uncaughtException", (err) => {
  console.error("⚠️ Exception non capturée:", err);
  process.exit(1);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("⚠️ Promesse rejetée non gérée:", reason);
  process.exit(1);
});

// Démarrage du serveur (modifié)
app.listen(PORT, HOST, () => {
  console.log(`
🚀 CoachBot v2.0 - GAMIFICATION INTÉGRÉE ! 🎮
🔗 URL: http://${HOST}:${PORT}
🔐 Admin: ${process.env.ADMIN_EMAIL || "Non configuré"}
🤖 IA: ${process.env.ANTHROPIC_API_KEY ? "✅ Claude configuré" : "⚠️ API manquante"}
🗃️ Data: ${USERS_PATH}
📝 Journal: ${JOURNAL_PATH}
🧠 Meta: ${META_PATH}
🎮 Gamification: ${GAMIFICATION_PATH}
🎯 Prompt: ${PROMPT_PATH}
🎤 MICROPHONE: ✅ Headers Permissions-Policy activés !

🎮 SYSTÈME GAMIFICATION ACTIVÉ :
   ✅ Points et niveaux (10 niveaux)
   ✅ Badges et achievements (11 badges)
   ✅ Streaks et bonus
   ✅ Leaderboard compétitif
   ✅ APIs complètes

🤲🏻 Bi-idhnillah, le coaching gamifié peut commencer !
  `);
});

// Export pour les tests (existant)
export default app;

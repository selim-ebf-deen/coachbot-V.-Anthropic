// CoachBot v2.0 - Serveur complet optimisé avec contexte global + routes frontend
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

// Ajouter après les imports existants
import GamificationSystem from './gamification.js';
import { 
    getUserGamificationStats, 
    updateUserGamificationStats, 
    addPointsToUser,
    updateUserStreak 
} from './gamificationData.js';

// Initialiser le système de gamification
const gamification = new GamificationSystem();

// 🎤 HEADERS MICROPHONE OBLIGATOIRES - FIX CRITIQUE
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
const PROMPT_PATH = process.env.PROMPT_PATH || path.join(__dirname, "prompt.txt");
const JWT_SECRET = process.env.JWT_SECRET || "change_me_now";
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || "claude-3-5-sonnet-20241022";

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

// Data management
function loadUsers() { return loadJSON(USERS_PATH, {}); }
function saveUsers(u) { saveJSON(USERS_PATH, u); }
function loadJournal() { return loadJSON(JOURNAL_PATH, {}); }
function saveJournal(j) { saveJSON(JOURNAL_PATH, j); }
function loadMetaAll() { return loadJSON(META_PATH, {}); }
function saveMetaAll(m) { saveJSON(META_PATH, m); }

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

// Journal functions
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
}

// Nouvelle fonction pour récupérer TOUT l'historique d'un utilisateur
function getAllUserHistory(userId) {
  const db = loadJournal();
  const userJournal = db[userId] || {};
  
  let allMessages = [];
  
  // Parcourir tous les jours (1 à 15)
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
  
  // Trier par date pour avoir l'ordre chronologique
  allMessages.sort((a, b) => new Date(a.date) - new Date(b.date));
  
  return allMessages;
}

// Nouvelle fonction pour créer un résumé des sessions précédentes
function createUserSummary(userId, currentDay) {
  const allHistory = getAllUserHistory(userId);
  const meta = getMeta(userId);
  
  let summary = `[PROFIL UTILISATEUR]\n`;
  summary += `Prénom: ${meta.name || "Non défini"}\n`;
  summary += `Profil DISC: ${meta.disc || "À identifier"}\n\n`;
  
  if (allHistory.length === 0) {
    return summary + `[PREMIÈRE SESSION - Aucun historique]`;
  }
  
  // Grouper par jour
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
      if (Number(day) < currentDay) { // Seulement les jours précédents
        summary += `\n--- JOUR ${day} ---\n`;
        const dayMessages = sessionsByDay[day];
        
        // Résumer chaque session
        let objectives = [];
        let actions = [];
        let commitments = [];
        
        dayMessages.forEach(msg => {
          const content = msg.message.toLowerCase();
          
          // Identifier les objectifs
          if (msg.role === 'user' && (content.includes('objectif') || content.includes('but') || content.includes('veux'))) {
            objectives.push(msg.message);
          }
          
          // Identifier les actions/micro-actions
          if (msg.role === 'ai' && (content.includes('micro-action') || content.includes('action pour') || content.includes('programme'))) {
            actions.push(msg.message);
          }
          
          // Identifier les engagements
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

// Meta functions
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

// Heuristiques
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

// Auth
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

// Seed admin
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
  console.log(`✅ Admin seedé: ${ADMIN_EMAIL}`);
}

seedAdminIfNeeded().catch(console.error);

// Routes statiques
app.use(express.static(path.join(__dirname, "public")));
app.get("/", (req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));

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

// Auth API
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

    const token = signToken(users[id]);
    res.json({ token, user: { id, email: users[id].email, name: users[id].name, role: "user" } });
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

    const token = signToken(user);
    res.json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role } });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// Route profile pour frontend (OBLIGATOIRE)
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

// Routes d'historique pour frontend
app.get("/api/chat/history", authMiddleware, (req, res) => {
  const day = Number(req.query.day || 1);
  return res.json(getEntries(req.user.sub, day));
});

app.post("/api/chat/save", authMiddleware, (req, res) => {
  const { day = 1, message = "", role = "user" } = req.body || {};
  addEntry(req.user.sub, day, { role, message, date: new Date().toISOString() });
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

// Meta API
app.get("/api/meta", authMiddleware, (req, res) => {
  res.json(getMeta(req.user.sub));
});

app.post("/api/meta", authMiddleware, (req, res) => {
  const meta = setMeta(req.user.sub, { name: req.body?.name, disc: req.body?.disc });
  res.json({ success: true, meta });
});

// IA helpers
function systemPrompt(name, disc) {
  const base = getPromptText();
  const note = `\n\n[Contexte CoachBot]\nPrénom: ${name || "Inconnu"}\nDISC: ${disc || "À déduire"}\nRappels: réponses courtes, concrètes, micro-action 10 min, critère de réussite, tutoiement.`;
  return base + note;
}

// Route principale pour le frontend - Chat avec format "content"
app.post("/api/chat/message", authMiddleware, async (req, res) => {
  const { message, day = 1, provider = "anthropic" } = req.body ?? {};
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

  addEntry(req.user.sub, day, { role: "user", message, date: new Date().toISOString() });

  const meta = getMeta(req.user.sub);
  
  // RÉCUPÉRER LE CONTEXTE GLOBAL DE L'UTILISATEUR
  const chatHistory = getEntries(req.user.sub, day);
  const userSummary = createUserSummary(req.user.sub, day);
  
  const system = systemPrompt(meta.name, meta.disc);
  
  // CONSTRUIRE LE CONTEXTE COMPLET AVEC HISTORIQUE GLOBAL
  let conversationContext = `${userSummary}\n\n`;
  conversationContext += `[SESSION ACTUELLE - JOUR ${day}]\n`;
  conversationContext += `Plan du jour : ${plans[Number(day)] || "Plan non spécifié."}\n\n`;
  
  // Ajouter l'historique du jour actuel
  if (chatHistory.length > 1) {
    conversationContext += "Messages du jour actuel :\n";
    chatHistory.slice(0, -1).forEach(entry => {
      conversationContext += `${entry.role === 'user' ? 'Utilisateur' : 'Assistant'}: ${entry.message}\n`;
    });
    conversationContext += "\n";
  }
  
  conversationContext += `Message actuel de l'utilisateur : ${message}`;

  // Headers pour Server-Sent Events (SSE)
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
                send({ content: delta }); // Important: utiliser "content" pour le frontend
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
    console.error("Erreur chat stream:", e);
    send({ error: "Erreur serveur" });
    return end();
  }
});

// Chat streaming AVEC CONTEXTE GLOBAL (legacy route)
app.post("/api/chat/stream", authMiddleware, async (req, res) => {
  const { message, day = 1, provider = "anthropic" } = req.body ?? {};
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

// Admin API
app.get("/api/admin/stats", authMiddleware, adminOnly, (req, res) => {
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
  res.json({ totalUsers, totalMessages, perDay });
});

app.get("/api/admin/users", authMiddleware, adminOnly, (req, res) => {
  const users = loadUsers();
  const list = Object.values(users).map(u => ({
    id: u.id, email: u.email, name: u.name || null, 
    role: u.role || "user", createdAt: u.createdAt
  }));
  res.json(list);
});

app.get("/api/admin/user/:id", authMiddleware, adminOnly, (req, res) => {
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
});

app.get("/api/admin/analytics", authMiddleware, adminOnly, (req, res) => {
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
    return {
      userId,
      email: user?.email || "Inconnu",
      name: user?.name || meta[userId]?.name || "Inconnu",
      totalMessages,
      daysActive,
      completion: Math.round((daysActive / 15) * 100)
    };
  }).sort((a, b) => b.totalMessages - a.totalMessages);
  
  res.json({
    userStats,
    discStats,
    activityByDay,
    topUsers: userActivity.slice(0, 10),
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

// Health routes
app.get("/healthz", (req, res) => res.json({ ok: true }));
app.get("/healthz/ready", (req, res) => {
  const okClaude = !!process.env.ANTHROPIC_API_KEY;
  res.json({ ok: true, claude: okClaude, time: new Date().toISOString() });
});

// Gestion des erreurs globales
app.use((err, req, res, next) => {
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

// Fallback pour SPA (single page application)
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
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

// ===== ROUTES GAMIFICATION =====

// Obtenir stats gamification utilisateur
app.get("/api/gamification/stats", authMiddleware, (req, res) => {
    try {
        const stats = getUserGamificationStats(req.user.sub);
        const currentLevel = gamification.calculateLevel(stats.totalPoints);
        const progress = gamification.getProgressToNextLevel(stats.totalPoints);
        
        res.json({
            success: true,
            stats: {
                ...stats,
                currentLevel,
                progress
            }
        });
    } catch (error) {
        console.error('Erreur stats gamification:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// Traiter action gamification
app.post("/api/gamification/action", authMiddleware, (req, res) => {
    try {
        const { actionType, points, context } = req.body;
        const userId = req.user.sub;
        
        // Ajouter points
        const updatedStats = addPointsToUser(userId, points, actionType);
        
        // Vérifier nouveaux badges
        const newBadges = gamification.checkNewBadges(updatedStats);
        
        // Si nouveaux badges, les ajouter
        if (newBadges.length > 0) {
            updatedStats.badges = [...updatedStats.badges, ...newBadges];
            updateUserGamificationStats(userId, { badges: updatedStats.badges });
        }
        
        // Calculer niveau et progression
        const currentLevel = gamification.calculateLevel(updatedStats.totalPoints);
        const progress = gamification.getProgressToNextLevel(updatedStats.totalPoints);
        
        res.json({
            success: true,
            pointsAdded: points,
            totalPoints: updatedStats.totalPoints,
            newBadges: newBadges,
            currentLevel: currentLevel,
            progress: progress,
            celebrateNewBadges: newBadges.length > 0,
            celebrateLevelUp: false // TODO: détecter level up
        });
    } catch (error) {
        console.error('Erreur action gamification:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// Obtenir badges disponibles
app.get("/api/gamification/badges", authMiddleware, (req, res) => {
    res.json({
        success: true,
        badges: gamification.badges
    });
});

// Manuel : donner points pour du'a spécifique
app.post("/api/gamification/duaa", authMiddleware, (req, res) => {
    try {
        const { duaaType } = req.body; // "bismillah", "alhamdulillah", etc.
        const userId = req.user.sub;
        
        const points = gamification.pointsConfig.duaa[duaaType] || 10;
        const updatedStats = addPointsToUser(userId, points, 'duaa');
        
        res.json({
            success: true,
            duaaType: duaaType,
            pointsAdded: points,
            totalPoints: updatedStats.totalPoints,
            message: `🤲 ${points} points pour "${duaaType}" - Barakallahu fik !`
        });
    } catch (error) {
        console.error('Erreur du\'a gamification:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// Démarrage du serveur
app.listen(PORT, HOST, () => {
  console.log(`
🚀 CoachBot v2.0 - Serveur démarré avec FIX MICROPHONE !
🔗 URL: http://${HOST}:${PORT}
🔐 Admin: ${process.env.ADMIN_EMAIL || "Non configuré"}
🤖 IA: ${process.env.ANTHROPIC_API_KEY ? "✅ Claude configuré" : "⚠️ API manquante"}
🗃️ Data: ${USERS_PATH}
📝 Journal: ${JOURNAL_PATH}
🧠 Meta: ${META_PATH}
🎯 Prompt: ${PROMPT_PATH}
🎤 MICROPHONE: ✅ Headers Permissions-Policy activés !

🤲🏻 Bi-idhnillah, le coaching vocal peut commencer !
  `);
});

// Export pour les tests
export default app;

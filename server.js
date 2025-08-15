// CoachBot v2.0 - Serveur complet optimisé avec contexte
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
app.get("/admin", (req, res) => {
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

app.get("/api/me", authMiddleware, (req, res) => {
  const users = loadUsers();
  const user = users[req.user.sub];
  if (!user) return res.status(401).json({ error: "Utilisateur introuvable" });
  const meta = getMeta(user.id);
  res.json({ user: { id: user.id, email: user.email, name: user.name, role: user.role }, meta });
});

// Journal API
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

// Chat streaming AVEC CONTEXTE
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
  
  // RÉCUPÉRER TOUT L'HISTORIQUE DU JOUR pour donner le contexte à l'IA
  const chatHistory = getEntries(req.user.sub, day);
  
  const system = systemPrompt(meta.name, meta.disc);
  
  // CONSTRUIRE LE CONTEXTE COMPLET
  let conversationContext = `Plan du jour (${day}) : ${plans[Number(day)] || "Plan non spécifié."}\n\n`;
  
  // Ajouter l'historique des messages du jour
  if (chatHistory.length > 1) { // Plus d'un message = il y a de l'historique
    conversationContext += "Historique de la conversation d'aujourd'hui :\n";
    chatHistory.slice(0, -1).forEach(entry => { // Tous sauf le dernier (qui est le message actuel)
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
          max_tokens: 800,
          temperature: 0.4,
          stream: true,
          system,
          messages: [{ role: "user", content: conversationContext }] // CONTEXTE COMPLET
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

app.post("/api/admin/user/role", authMiddleware, adminOnly, (req, res) => {
  const { userId, role } = req.body || {};
  if (!userId || !role) return res.status(400).json({ error: "userId et role requis" });
  const users = loadUsers();
  if (!users[userId]) return res.status(404).json({ error: "Utilisateur introuvable" });
  users[userId].role = role;
  saveUsers(users);
  res.json({ success: true });
});

// Health
app.get("/healthz", (req, res) => res.json({ ok: true }));
app.get("/healthz/ready", (req, res) => {
  const okClaude = !!process.env.ANTHROPIC_API_KEY;
  res.json({ ok: true, claude: okClaude, time: new Date().toISOString() });
});

// Start
const PORT = process.env.PORT || 8787;
app.listen(PORT, () => console.log(`🚀 CoachBot v2.0 en ligne sur le port ${PORT}`));

// gamificationData.js - Gestion des données gamification
import fs from 'fs';
import path from 'path';

const GAMIFICATION_PATH = process.env.GAMIFICATION_PATH || './gamification.json';

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

// Charger données gamification
export function loadGamificationData() {
    return loadJSON(GAMIFICATION_PATH, {});
}

// Sauvegarder données gamification
export function saveGamificationData(data) {
    saveJSON(GAMIFICATION_PATH, data);
}

// Obtenir stats utilisateur
export function getUserGamificationStats(userId) {
    const data = loadGamificationData();
    
    if (!data[userId]) {
        data[userId] = {
            totalPoints: 0,
            totalSessions: 0,
            currentStreak: 0,
            maxStreak: 0,
            badges: [],
            lastSessionDate: null,
            totalDhikr: 0,
            earlyMorningSessions: 0,
            maxActionsInSession: 0,
            dailyActions: {}
        };
        saveGamificationData(data);
    }
    
    return data[userId];
}

// Mettre à jour stats utilisateur
export function updateUserGamificationStats(userId, updates) {
    const data = loadGamificationData();
    const currentStats = getUserGamificationStats(userId);
    
    data[userId] = { ...currentStats, ...updates };
    saveGamificationData(data);
    
    return data[userId];
}

// Ajouter points à un utilisateur
export function addPointsToUser(userId, points, actionType = 'unknown') {
    const stats = getUserGamificationStats(userId);
    const today = new Date().toDateString();
    
    // Mettre à jour les stats
    const updatedStats = {
        ...stats,
        totalPoints: stats.totalPoints + points,
        lastActionDate: today
    };
    
    // Compter les actions du jour
    if (!updatedStats.dailyActions[today]) {
        updatedStats.dailyActions[today] = 0;
    }
    updatedStats.dailyActions[today]++;
    
    // Mettre à jour max actions en session
    if (updatedStats.dailyActions[today] > updatedStats.maxActionsInSession) {
        updatedStats.maxActionsInSession = updatedStats.dailyActions[today];
    }
    
    // Compter dhikr spécifiquement
    if (actionType === 'dhikr') {
        updatedStats.totalDhikr = (updatedStats.totalDhikr || 0) + 1;
    }
    
    // Sessions matinales
    const currentHour = new Date().getHours();
    if (currentHour < 8) {
        updatedStats.earlyMorningSessions = (updatedStats.earlyMorningSessions || 0) + 1;
    }
    
    return updateUserGamificationStats(userId, updatedStats);
}

// Calculer streak
export function updateUserStreak(userId) {
    const stats = getUserGamificationStats(userId);
    const today = new Date().toDateString();
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toDateString();
    
    if (stats.lastSessionDate === today) {
        // Déjà compté aujourd'hui
        return stats.currentStreak;
    }
    
    let newStreak;
    if (stats.lastSessionDate === yesterday) {
        // Continuité
        newStreak = (stats.currentStreak || 0) + 1;
    } else {
        // Nouveau streak
        newStreak = 1;
    }
    
    const maxStreak = Math.max(stats.maxStreak || 0, newStreak);
    
    updateUserGamificationStats(userId, {
        currentStreak: newStreak,
        maxStreak: maxStreak,
        lastSessionDate: today,
        totalSessions: (stats.totalSessions || 0) + 1
    });
    
    return newStreak;
}

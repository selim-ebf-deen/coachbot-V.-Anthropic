// gamification.js - Système de gamification islamique
class GamificationSystem {
    constructor() {
        this.pointsConfig = {
            // Actions coaching de base
            dailyGoal: 50,
            microAction: 30,
            ameen: 25,
            earlySession: 40,
            
            // Du'as et spiritualité
            duaa: {
                bismillah: 15,
                alhamdulillah: 20,
                astaghfirullah: 35,
                salawat: 15,
                dhikr: 10,
                morning_adhkar: 35,
                evening_adhkar: 35,
                gratitude: 30
            },
            
            // Bonus temporels
            multipliers: {
                friday: 1.5,
                earlyMorning: 1.3, // Avant 8h
                lateEvening: 1.2   // Après 20h
            }
        };
        
        this.badges = {
            // Badges de départ
            "🌱 Nouveau Muslim": { points: 0, description: "Première session complète" },
            "🤲 Premier Du'a": { points: 50, description: "Premier du'a dans l'app" },
            "🔥 Streak 3": { points: 300, description: "3 jours consécutifs" },
            "⚡ Lightning": { points: 150, description: "5 actions en une session" },
            "🌅 Fajr Warrior": { points: 500, description: "10 sessions avant 7h" },
            "📿 Dhikr Master": { points: 1000, description: "100 dhikr cumulés" },
            "💎 Dedicated": { points: 1500, description: "15 jours complétés" },
            "👑 Champion": { points: 5000, description: "5000 points atteints" }
        };
        
        this.levels = [
            { level: 1, name: "🌱 Nouveau Muslim", minPoints: 0 },
            { level: 2, name: "📚 Student", minPoints: 500 },
            { level: 3, name: "🤲 Worshipper", minPoints: 1500 },
            { level: 4, name: "📿 Devoted", minPoints: 5000 },
            { level: 5, name: "🌟 Righteous", minPoints: 15000 },
            { level: 6, name: "👑 Spiritual Guide", minPoints: 50000 }
        ];
    }
    
    // Détecter actions dans un message
    detectActionsInMessage(message) {
        const lowerMessage = message.toLowerCase();
        const detectedActions = [];
        let totalPoints = 0;
        
        // Détection du'as
        if (lowerMessage.includes('bismillah') || lowerMessage.includes('بسم الله')) {
            detectedActions.push({ type: 'bismillah', points: this.pointsConfig.duaa.bismillah });
            totalPoints += this.pointsConfig.duaa.bismillah;
        }
        
        if (lowerMessage.includes('alhamdulillah') || lowerMessage.includes('الحمد لله')) {
            detectedActions.push({ type: 'alhamdulillah', points: this.pointsConfig.duaa.alhamdulillah });
            totalPoints += this.pointsConfig.duaa.alhamdulillah;
        }
        
        if (lowerMessage.includes('astaghfirullah') || lowerMessage.includes('أستغفر الله')) {
            detectedActions.push({ type: 'astaghfirullah', points: this.pointsConfig.duaa.astaghfirullah });
            totalPoints += this.pointsConfig.duaa.astaghfirullah;
        }
        
        if (lowerMessage.includes('subhanallah') || lowerMessage.includes('سبحان الله')) {
            detectedActions.push({ type: 'dhikr', points: this.pointsConfig.duaa.dhikr });
            totalPoints += this.pointsConfig.duaa.dhikr;
        }
        
        if (lowerMessage.includes('allahu akbar') || lowerMessage.includes('الله أكبر')) {
            detectedActions.push({ type: 'dhikr', points: this.pointsConfig.duaa.dhikr });
            totalPoints += this.pointsConfig.duaa.dhikr;
        }
        
        // Détection engagement
        if (lowerMessage.includes('ameen') || lowerMessage.includes('amin') || lowerMessage.includes('آمين')) {
            detectedActions.push({ type: 'ameen', points: this.pointsConfig.ameen });
            totalPoints += this.pointsConfig.ameen;
        }
        
        // Détection gratitude
        if (lowerMessage.includes('merci allah') || lowerMessage.includes('barakallahu fik') || lowerMessage.includes('jazak allah')) {
            detectedActions.push({ type: 'gratitude', points: this.pointsConfig.duaa.gratitude });
            totalPoints += this.pointsConfig.duaa.gratitude;
        }
        
        return { detectedActions, totalPoints };
    }
    
    // Calculer niveau actuel
    calculateLevel(totalPoints) {
        for (let i = this.levels.length - 1; i >= 0; i--) {
            if (totalPoints >= this.levels[i].minPoints) {
                return this.levels[i];
            }
        }
        return this.levels[0];
    }
    
    // Progression vers niveau suivant
    getProgressToNextLevel(totalPoints) {
        const currentLevel = this.calculateLevel(totalPoints);
        const nextLevelIndex = this.levels.findIndex(l => l.level === currentLevel.level) + 1;
        
        if (nextLevelIndex >= this.levels.length) {
            return { progress: 100, isMaxLevel: true };
        }
        
        const nextLevel = this.levels[nextLevelIndex];
        const progress = ((totalPoints - currentLevel.minPoints) / 
                         (nextLevel.minPoints - currentLevel.minPoints)) * 100;
        
        return {
            progress: Math.min(100, Math.max(0, progress)),
            pointsNeeded: nextLevel.minPoints - totalPoints,
            nextLevel: nextLevel,
            isMaxLevel: false
        };
    }
    
    // Vérifier nouveaux badges
    checkNewBadges(userStats) {
        const newBadges = [];
        
        Object.entries(this.badges).forEach(([badgeName, badge]) => {
            if (!userStats.badges.includes(badgeName)) {
                // Logique pour chaque badge
                let canEarn = false;
                
                switch(badgeName) {
                    case "🌱 Nouveau Muslim":
                        canEarn = userStats.totalSessions >= 1;
                        break;
                    case "🤲 Premier Du'a":
                        canEarn = userStats.totalPoints >= 50;
                        break;
                    case "🔥 Streak 3":
                        canEarn = userStats.currentStreak >= 3;
                        break;
                    case "⚡ Lightning":
                        canEarn = userStats.maxActionsInSession >= 5;
                        break;
                    case "🌅 Fajr Warrior":
                        canEarn = userStats.earlyMorningSessions >= 10;
                        break;
                    case "📿 Dhikr Master":
                        canEarn = userStats.totalDhikr >= 100;
                        break;
                    case "💎 Dedicated":
                        canEarn = userStats.totalSessions >= 15;
                        break;
                    case "👑 Champion":
                        canEarn = userStats.totalPoints >= 5000;
                        break;
                }
                
                if (canEarn) {
                    newBadges.push(badgeName);
                }
            }
        });
        
        return newBadges;
    }
}

module.exports = GamificationSystem;

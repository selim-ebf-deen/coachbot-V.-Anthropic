// CoachBot Frontend - Version finale complète avec onboarding et vocal
class VoiceManager {
    constructor(app) {
        this.app = app;
        this.isRecording = false;
        this.isPlaying = false;
        this.recognition = null;
        this.synthesis = window.speechSynthesis;
        this.currentUtterance = null;
        this.init();
    }

    init() {
        if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
            console.warn('Speech Recognition non supporté');
            return;
        }

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        this.recognition = new SpeechRecognition();
        this.recognition.lang = 'fr-FR';
        this.recognition.continuous = false;
        this.recognition.interimResults = false;

        this.recognition.onstart = () => this.onRecordingStart();
        this.recognition.onresult = (event) => this.onSpeechResult(event);
        this.recognition.onerror = (event) => this.onSpeechError(event);
        this.recognition.onend = () => this.onRecordingEnd();
    }

    toggleRecording() {
        if (!this.recognition) {
            this.app.showError('Vocal non supporté sur ce navigateur');
            return;
        }

        if (this.isRecording) {
            this.stopRecording();
        } else {
            this.startRecording();
        }
    }

    startRecording() {
        try {
            this.recognition.start();
        } catch (error) {
            this.app.showError('Erreur microphone : ' + error.message);
        }
    }

    stopRecording() {
        if (this.recognition && this.isRecording) {
            this.recognition.stop();
        }
    }

    onRecordingStart() {
        this.isRecording = true;
        const micBtn = document.getElementById('micBtn');
        if (micBtn) {
            micBtn.classList.add('recording');
            micBtn.innerHTML = '⏹️';
        }
    }

    onRecordingEnd() {
        this.isRecording = false;
        const micBtn = document.getElementById('micBtn');
        if (micBtn) {
            micBtn.classList.remove('recording');
            micBtn.innerHTML = '🎙️';
        }
    }

    onSpeechResult(event) {
        const transcript = event.results[0][0].transcript;
        const userInput = document.getElementById('userInput');
        if (userInput) {
            userInput.value = transcript;
            userInput.focus();
        }
    }

    onSpeechError(event) {
        this.isRecording = false;
        const micBtn = document.getElementById('micBtn');
        if (micBtn) {
            micBtn.classList.remove('recording');
            micBtn.innerHTML = '🎙️';
        }

        let errorMessage = 'Erreur vocal';
        switch (event.error) {
            case 'no-speech': errorMessage = 'Aucune voix détectée'; break;
            case 'audio-capture': errorMessage = 'Microphone non accessible'; break;
            case 'not-allowed': errorMessage = 'Permission micro refusée'; break;
        }
        this.app.showError(errorMessage);
    }

    speakText(text) {
        if (this.isPlaying) {
            this.stopSpeaking();
            return;
        }

        const cleanText = text
            .replace(/[🤲🏻✅❌🎯🛠️📋🔍💡🚀👑🌟]/g, '')
            .replace(/\*\*(.*?)\*\*/g, '$1')
            .replace(/\*(.*?)\*/g, '$1');

        this.currentUtterance = new SpeechSynthesisUtterance(cleanText);
        this.currentUtterance.lang = 'fr-FR';
        this.currentUtterance.rate = 0.9;
        this.currentUtterance.pitch = 1;

        this.currentUtterance.onstart = () => { this.isPlaying = true; };
        this.currentUtterance.onend = () => { 
            this.isPlaying = false;
            this.currentUtterance = null;
        };

        this.synthesis.speak(this.currentUtterance);
    }

    stopSpeaking() {
        if (this.synthesis.speaking) {
            this.synthesis.cancel();
        }
        this.isPlaying = false;
        this.currentUtterance = null;
    }
}

class CoachBot {
    constructor() {
        this.token = localStorage.getItem('coachbot_token');
        this.currentDay = 1;
        this.user = null;
        this.isLoading = false;
        this.currentStreamingMessage = null;
        this.voiceManager = new VoiceManager(this);
        this.serverMode = false;
        this.onboardingData = null;
        this.init();
    }

    init() {
        this.loadOnboardingData();
        this.checkAuth();
        this.setupEventListeners();
        this.generateDaysNav();
        this.loadSettings();
    }

    loadOnboardingData() {
        const onboardingCompleted = localStorage.getItem('coachbot_onboarding_completed');
        const onboardingData = localStorage.getItem('coachbot_onboarding');
        
        if (onboardingData) {
            this.onboardingData = JSON.parse(onboardingData);
        }

        if (!onboardingCompleted && !this.onboardingData) {
            setTimeout(() => this.showOnboardingRedirect(), 2000);
        }
    }

    showOnboardingRedirect() {
        const modal = document.createElement('div');
        modal.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0,0,0,0.8); display: flex; align-items: center;
            justify-content: center; z-index: 10000;
        `;

        modal.innerHTML = `
            <div style="background: white; padding: 40px; border-radius: 20px; text-align: center;
                max-width: 500px; margin: 20px; box-shadow: 0 20px 40px rgba(0,0,0,0.2);">
                <div style="font-size: 60px; margin-bottom: 20px;">🤲🏻</div>
                <h2 style="color: #333; margin-bottom: 15px;">Assalamu alaykum !</h2>
                <p style="color: #666; margin-bottom: 30px; line-height: 1.6;">
                    Bienvenue dans CoachBot ! Pour t'offrir la meilleure expérience possible, 
                    nous devons d'abord faire connaissance.
                </p>
                <button onclick="window.location.href='onboarding.html'" style="
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white; border: none; padding: 15px 30px; border-radius: 25px;
                    font-weight: bold; cursor: pointer; font-size: 16px; margin-right: 10px;
                ">Commencer l'introduction ✨</button>
                <button onclick="this.parentElement.parentElement.remove()" style="
                    background: #f8f9fa; color: #666; border: 2px solid #e9ecef;
                    padding: 13px 25px; border-radius: 25px; cursor: pointer; font-size: 14px;
                ">Plus tard</button>
            </div>
        `;

        document.body.appendChild(modal);
    }

    checkAuth() {
        if (!this.token) {
            this.showAuthModal();
        } else {
            this.verifyToken();
        }
    }

    setupEventListeners() {
        document.getElementById('userInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });

        document.getElementById('sendBtn').addEventListener('click', () => {
            this.sendMessage();
        });

        window.onclick = (event) => {
            const modal = document.getElementById('authModal');
            if (event.target === modal) {
                modal.style.display = 'none';
            }
        };
    }

    generateDaysNav() {
        const nav = document.getElementById('daysNav');
        nav.innerHTML = '';
        
        for (let i = 1; i <= 15; i++) {
            const btn = document.createElement('button');
            btn.className = 'day-btn';
            btn.textContent = `J${i}`;
            btn.onclick = () => this.switchDay(i);
            
            if (this.user?.role === 'admin') {
                btn.classList.add('admin-access');
                btn.title = `Jour ${i} (Accès Admin)`;
            }
            
            nav.appendChild(btn);
        }
        
        this.updateDayNavigation();
    }

    switchDay(day) {
        if (day === this.currentDay || this.isLoading) return;
        
        if (this.user?.role !== 'admin') {
            // TODO: Logique de progression pour users normaux
        }
        
        this.currentDay = day;
        this.updateDayNavigation();
        this.updateDayInfo();
        this.loadChatHistory();
    }

    updateDayNavigation() {
        document.querySelectorAll('.day-btn').forEach((btn, index) => {
            btn.classList.toggle('active', index + 1 === this.currentDay);
        });
    }

    updateDayInfo() {
        const dayInfo = document.getElementById('dayInfo');
        dayInfo.textContent = `Jour ${this.currentDay} - Transformation`;
    }

    async verifyToken() {
        try {
            const response = await fetch('/api/user/profile', {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });

            if (response.ok) {
                this.user = await response.json();
                this.serverMode = true;
                this.updateUserInfo();
                this.loadChatHistory();
                setTimeout(() => this.showWelcomeMessage(), 2000);
            } else {
                this.activateLocalMode();
            }
        } catch (error) {
            this.activateLocalMode();
        }
    }

    activateLocalMode() {
        this.serverMode = false;
        this.user = { 
            email: 'local@user.com',
            prenom: this.onboardingData?.prenom || 'Utilisateur',
            role: 'user' 
        };
        localStorage.removeItem('coachbot_token');
        this.token = null;
        this.updateUserInfo();
        document.getElementById('chatMessages').innerHTML = '';
        setTimeout(() => this.showWelcomeMessage(), 2000);
    }

    updateUserInfo() {
        const userInfo = document.getElementById('userInfo');
        let displayName = 'Utilisateur';
        
        if (this.onboardingData && this.onboardingData.prenom) {
            displayName = this.onboardingData.prenom;
        } else if (this.user) {
            displayName = this.user.prenom || this.user.email;
        }
        
        const modeText = this.serverMode ? '' : ' (Mode Local)';
        
        userInfo.innerHTML = `
            <div class="user-details ${this.user?.role === 'admin' ? 'admin' : ''}">
                <span class="user-name">${displayName}${modeText}</span>
                ${this.user?.role === 'admin' ? '<span class="admin-badge">👑 Admin</span>' : ''}
                ${this.onboardingData ? '<span class="onboarding-badge">✨ Configuré</span>' : ''}
            </div>
        `;
    }

    showAuthModal() {
        document.getElementById('authModal').style.display = 'flex';
        document.getElementById('loginForm').style.display = 'block';
        document.getElementById('registerForm').style.display = 'none';
    }

    hideAuthModal() {
        document.getElementById('authModal').style.display = 'none';
    }

    showRegister() {
        document.getElementById('loginForm').style.display = 'none';
        document.getElementById('registerForm').style.display = 'block';
    }

    showLogin() {
        document.getElementById('registerForm').style.display = 'none';
        document.getElementById('loginForm').style.display = 'block';
    }

    async login() {
        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;

        if (!email || !password) {
            this.showError('Email et mot de passe requis');
            return;
        }

        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });

            const data = await response.json();

            if (response.ok) {
                this.token = data.token;
                localStorage.setItem('coachbot_token', this.token);
                this.user = data.user;
                this.serverMode = true;
                this.hideAuthModal();
                this.updateUserInfo();
                this.loadChatHistory();
                setTimeout(() => this.showWelcomeMessage(), 2000);
            } else {
                this.showError(data.message || 'Erreur de connexion');
            }
        } catch (error) {
            this.user = { email: email, prenom: email.split('@')[0], role: 'user' };
            this.serverMode = false;
            this.hideAuthModal();
            this.updateUserInfo();
            setTimeout(() => this.showWelcomeMessage(), 2000);
        }
    }

    async register() {
        const email = document.getElementById('registerEmail').value;
        const password = document.getElementById('registerPassword').value;

        if (!email || !password) {
            this.showError('Email et mot de passe requis');
            return;
        }

        try {
            const response = await fetch('/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });

            const data = await response.json();

            if (response.ok) {
                this.token = data.token;
                localStorage.setItem('coachbot_token', this.token);
                this.user = data.user;
                this.serverMode = true;
                this.hideAuthModal();
                this.updateUserInfo();
                this.loadChatHistory();
                setTimeout(() => this.showWelcomeMessage(), 2000);
            } else {
                this.showError(data.message || 'Erreur d\'inscription');
            }
        } catch (error) {
            this.user = { email: email, prenom: email.split('@')[0], role: 'user' };
            this.serverMode = false;
            this.hideAuthModal();
            this.updateUserInfo();
            setTimeout(() => this.showWelcomeMessage(), 2000);
        }
    }

    async showWelcomeMessage() {
        const welcomeMessage = {
            role: 'ai',
            message: '',
            date: new Date().toISOString()
        };
        
        this.addMessageToChat(welcomeMessage, false);
        this.currentStreamingMessage = document.querySelector('.message:last-child .message-content');
        
        let welcomeText;
        
        if (this.onboardingData && this.onboardingData.prenom) {
            const prenom = this.onboardingData.prenom;
            const objectif = this.onboardingData.objectif;
            
            welcomeText = `Assalamu alaykum ${prenom} ! 🤲🏻

Ravi de te retrouver ! Je me souviens que tu souhaites progresser sur ${this.getObjectifText(objectif)}.

Comment s'est passée ta journée ? Es-tu prêt(e) à continuer notre travail ensemble ?`;
        } else {
            welcomeText = `Assalamu alaykum ! 🤲🏻

Je suis CoachBot, ton coach personnel pour 15 jours de transformation.

Peux-tu me dire ton prénom et l'objectif principal sur lequel tu souhaites progresser ?`;
        }
        
        await this.typeMessage(welcomeText, false);
    }

    getObjectifText(objectif) {
        const objectifs = {
            'salat': 'l\'amélioration de ta salat',
            'coran': 'ta relation avec le Coran',
            'dhikr': 'le dhikr et les invocations',
            'akhlaq': 'ton comportement et tes relations',
            'sante': 'ta santé physique et spirituelle',
            'productivite': 'ta productivité et organisation'
        };
        return objectifs[objectif] || 'ton développement personnel';
    }

    logout() {
        localStorage.removeItem('coachbot_token');
        this.token = null;
        this.user = null;
        this.serverMode = false;
        this.showAuthModal();
        document.getElementById('chatMessages').innerHTML = '';
    }

    async loadChatHistory() {
        if (!this.serverMode) {
            document.getElementById('chatMessages').innerHTML = '';
            return;
        }

        try {
            const response = await fetch(`/api/chat/history?day=${this.currentDay}`, {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });

            if (response.ok) {
                const messages = await response.json();
                this.displayChatHistory(messages);
            } else {
                document.getElementById('chatMessages').innerHTML = '';
            }
        } catch (error) {
            document.getElementById('chatMessages').innerHTML = '';
        }
    }

    displayChatHistory(messages) {
        const chatMessages = document.getElementById('chatMessages');
        chatMessages.innerHTML = '';

        messages.forEach(msg => {
            this.addMessageToChat(msg, false, false);
        });

        this.scrollToBottom();
    }

    async sendMessage() {
        const input = document.getElementById('userInput');
        const message = input.value.trim();

        if (!message || this.isLoading) return;

        input.value = '';
        this.isLoading = true;

        const userMessage = {
            role: 'user',
            message: message,
            date: new Date().toISOString()
        };

        this.addMessageToChat(userMessage, this.serverMode);

        const aiMessage = {
            role: 'ai',
            message: '',
            date: new Date().toISOString()
        };

        this.addMessageToChat(aiMessage, false);
        this.currentStreamingMessage = document.querySelector('.message:last-child .message-content');

        try {
            if (this.serverMode) {
                await this.streamAIResponse(message);
            } else {
                await this.simulateAIResponse(message);
            }
        } catch (error) {
            if (this.serverMode) {
                this.serverMode = false;
                this.updateUserInfo();
                await this.simulateAIResponse(message);
            }
        }

        this.isLoading = false;
    }

    async simulateAIResponse(userMessage) {
        let selectedResponse;
        
        if (this.onboardingData) {
            const prenom = this.onboardingData.prenom;
            const objectif = this.onboardingData.objectif;
            const style = this.onboardingData.style || 'equilibre';
            
            if (style === 'doux') {
                selectedResponse = `${prenom}, je comprends parfaitement ce que tu ressens. C'est tout à fait normal d'avoir ces défis avec ${this.getObjectifText(objectif)}. Prends ton temps, chaque petit pas compte énormément. Qu'est-ce qui t'a motivé aujourd'hui ?`;
            } else if (style === 'direct') {
                selectedResponse = `Très bien ${prenom} ! J'aime ta détermination concernant ${this.getObjectifText(objectif)}. Maintenant, passons à l'action concrète. Quelle est la première chose que tu vas faire aujourd'hui pour avancer ?`;
            } else {
                selectedResponse = `Parfait ${prenom} ! Je vois que tu es motivé(e) pour ${this.getObjectifText(objectif)}. C'est exactement l'état d'esprit qu'il faut. Dis-moi, quel a été ton plus grand défi hier ?`;
            }
        } else {
            const responses = [
                `Barakatou ! C'est un excellent objectif. Pour mieux t'accompagner, peux-tu me dire ton prénom ?`,
                `MashaAllah ! Je comprends ta motivation. Sur une échelle de 1 à 10, comment évalues-tu ta situation actuelle ?`,
                `Qu'Allah facilite ton cheminement ! Dis-moi, qu'est-ce qui t'empêche le plus de réussir en ce moment ?`
            ];
            selectedResponse = responses[Math.floor(Math.random() * responses.length)];
        }
        
        for (let i = 0; i < selectedResponse.length; i++) {
            if (!this.currentStreamingMessage) break;
            this.currentStreamingMessage.textContent += selectedResponse[i];
            this.scrollToBottom();
            await new Promise(resolve => setTimeout(resolve, 30));
        }
        
        setTimeout(() => {
            if (this.voiceManager) {
                this.voiceManager.speakText(selectedResponse);
            }
        }, 500);
    }

    async streamAIResponse(userMessage) {
        const response = await fetch('/api/chat/message', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.token}`
            },
            body: JSON.stringify({
                message: userMessage,
                day: this.currentDay
            })
        });

        if (!response.ok) {
            throw new Error(`Erreur serveur: ${response.status}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
            const { value, done } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop();

            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const data = line.slice(6);
                    if (data === '[DONE]') {
                        const finalText = this.currentStreamingMessage?.textContent;
                        if (finalText && finalText.trim()) {
                            setTimeout(() => {
                                if (this.voiceManager) {
                                    this.voiceManager.speakText(finalText);
                                }
                            }, 500);
                        }
                        return;
                    }

                    try {
                        const parsed = JSON.parse(data);
                        if (parsed.content) {
                            await this.typeMessage(parsed.content, true);
                        }
                    } catch (e) {
                        // Ignorer erreurs parsing JSON
                    }
                }
            }
        }
    }

    async typeMessage(text, isStreaming = false) {
        if (!this.currentStreamingMessage) return;

        if (isStreaming) {
            this.currentStreamingMessage.textContent += text;
        } else {
            for (let i = 0; i < text.length; i++) {
                if (!this.currentStreamingMessage) break;
                this.currentStreamingMessage.textContent += text[i];
                this.scrollToBottom();
                await new Promise(resolve => setTimeout(resolve, 20));
            }
        }
        
        this.scrollToBottom();
    }

    addMessageToChat(message, save = true, scroll = true) {
        const chatMessages = document.getElementById('chatMessages');
        const messageEl = document.createElement('div');
        messageEl.className = `message ${message.role}`;

        const time = new Date(message.date).toLocaleTimeString('fr-FR', {
            hour: '2-digit',
            minute: '2-digit'
        });

        messageEl.innerHTML = `
            <div class="message-content">${message.message}</div>
            <div class="message-time">${time}</div>
        `;

        chatMessages.appendChild(messageEl);

        if (scroll) {
            this.scrollToBottom();
        }

        if (save && this.serverMode && this.token) {
            this.saveMessage(message);
        }
    }

    async saveMessage(message) {
        try {
            await fetch('/api/chat/save', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify({
                    ...message,
                    day: this.currentDay
                })
            });
        } catch (error) {
            console.warn('Erreur sauvegarde message:', error);
        }
    }

    scrollToBottom() {
        const chatMessages = document.getElementById('chatMessages');
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    showError(message) {
        const error = document.createElement('div');
        error.className = 'error-notification';
        error.textContent = message;
        error.style.cssText = `
            position: fixed; top: 20px; right: 20px; background: #ff4444;
            color: white; padding: 12px 20px; border-radius: 8px; z-index: 10000;
            animation: slideIn 0.3s ease; max-width: 300px;
        `;

        document.body.appendChild(error);
        setTimeout(() => error.remove(), 4000);
    }

    showSettings() {
        const modal = document.createElement('div');
        modal.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0,0,0,0.5); display: flex; align-items: center;
            justify-content: center; z-index: 10000;
        `;

        modal.innerHTML = `
            <div style="background: white; padding: 30px; border-radius: 15px;
                max-width: 400px; margin: 20px;">
                <h3 style="margin-bottom: 20px; color: #333;">⚙️ Paramètres</h3>
                
                ${this.onboardingData ? `
                <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 15px;">
                    <h4 style="color: #667eea; margin-bottom: 10px;">Ton Profil :</h4>
                    <p><strong>Prénom :</strong> ${this.onboardingData.prenom}</p>
                    <p><strong>Objectif :</strong> ${this.getObjectifText(this.onboardingData.objectif)}</p>
                    <p><strong>Style :</strong> ${this.onboardingData.style}</p>
                </div>
                ` : ''}
                
                <button onclick="window.coachBot.resetOnboarding()" style="
                    background: #667eea; color: white; border: none; padding: 10px 20px;
                    border-radius: 8px; cursor: pointer; width: 100%; margin-bottom: 10px;
                ">🔄 Refaire l'introduction</button>
                
                <button onclick="this.parentElement.parentElement.remove()" style="
                    background: #f8f9fa; color: #666; border: 1px solid #e9ecef;
                    padding: 10px 20px; border-radius: 8px; cursor: pointer; width: 100%;
                ">Fermer</button>
            </div>
        `;

        document.body.appendChild(modal);
    }

    resetOnboarding() {
        localStorage.removeItem('coachbot_onboarding');
        localStorage.removeItem('coachbot_onboarding_completed');
        localStorage.removeItem('coachbot_onboarding_temp');
        this.onboardingData = null;
        this.showOnboardingRedirect();
    }

    loadSettings() {
        console.log('CoachBot initialisé en mode', this.serverMode ? 'serveur' : 'local');
    }
}

// Fonctions globales pour les boutons
function toggleVoice() {
    if (window.coachBot && window.coachBot.voiceManager) {
        window.coachBot.voiceManager.toggleRecording();
    }
}

function stopSpeaking() {
    if (window.coachBot && window.coachBot.voiceManager) {
        window.coachBot.voiceManager.stopSpeaking();
    }
}

// Initialisation au chargement
window.addEventListener('DOMContentLoaded', () => {
    window.coachBot = new CoachBot();
});

// Styles animation pour notification
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
`;
document.head.appendChild(style);

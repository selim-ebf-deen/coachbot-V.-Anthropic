// CoachBot Frontend - Version complète avec vocal
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
        // Vérification support navigateur
        if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
            console.warn('Speech Recognition non supporté');
            return;
        }

        // Configuration Speech Recognition
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        this.recognition = new SpeechRecognition();
        this.recognition.lang = 'fr-FR';
        this.recognition.continuous = false;
        this.recognition.interimResults = false;

        // Event listeners
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
        console.log('Enregistrement démarré...');
    }

    onRecordingEnd() {
        this.isRecording = false;
        const micBtn = document.getElementById('micBtn');
        if (micBtn) {
            micBtn.classList.remove('recording');
            micBtn.innerHTML = '🎙️';
        }
        console.log('Enregistrement arrêté');
    }

    onSpeechResult(event) {
        const transcript = event.results[0][0].transcript;
        console.log('Transcription:', transcript);
        
        // Insérer le texte dans le champ de saisie
        const userInput = document.getElementById('userInput');
        if (userInput) {
            userInput.value = transcript;
            userInput.focus();
        }
    }

    onSpeechError(event) {
        console.error('Erreur reconnaissance vocale:', event.error);
        this.isRecording = false;
        
        const micBtn = document.getElementById('micBtn');
        if (micBtn) {
            micBtn.classList.remove('recording');
            micBtn.innerHTML = '🎙️';
        }

        let errorMessage = 'Erreur vocal';
        switch (event.error) {
            case 'no-speech':
                errorMessage = 'Aucune voix détectée';
                break;
            case 'audio-capture':
                errorMessage = 'Microphone non accessible';
                break;
            case 'not-allowed':
                errorMessage = 'Permission micro refusée';
                break;
        }
        
        this.app.showError(errorMessage);
    }

    speakText(text) {
        if (this.isPlaying) {
            this.stopSpeaking();
            return;
        }

        // Nettoyer le texte des emojis et caractères spéciaux
        const cleanText = text
            .replace(/[🤲🏻✅❌🎯🛠️📋🔍💡🚀👑🌟]/g, '')
            .replace(/\*\*(.*?)\*\*/g, '$1')
            .replace(/\*(.*?)\*/g, '$1');

        this.currentUtterance = new SpeechSynthesisUtterance(cleanText);
        this.currentUtterance.lang = 'fr-FR';
        this.currentUtterance.rate = 0.9;
        this.currentUtterance.pitch = 1;

        this.currentUtterance.onstart = () => {
            this.isPlaying = true;
        };

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
        this.init();
    }

    init() {
        this.checkAuth();
        this.setupEventListeners();
        this.generateDaysNav();
        this.loadSettings();
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

        // Gestionnaire fermeture modale
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
        
        // Admin a accès à tous les jours
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
                this.updateUserInfo();
                this.loadChatHistory();
                setTimeout(() => this.showWelcomeMessage(), 2000);
            } else {
                this.logout();
            }
        } catch (error) {
            console.error('Erreur vérification token:', error);
            this.logout();
        }
    }

    updateUserInfo() {
        const userInfo = document.getElementById('userInfo');
        if (this.user) {
            userInfo.innerHTML = `
                <div class="user-details ${this.user.role === 'admin' ? 'admin' : ''}">
                    <span class="user-name">${this.user.prenom || this.user.email}</span>
                    ${this.user.role === 'admin' ? '<span class="admin-badge">👑 Admin</span>' : ''}
                </div>
            `;
        }
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
                this.hideAuthModal();
                this.updateUserInfo();
                this.loadChatHistory();
                setTimeout(() => this.showWelcomeMessage(), 2000);
            } else {
                this.showError(data.message || 'Erreur de connexion');
            }
        } catch (error) {
            this.showError('Erreur de connexion');
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
                this.hideAuthModal();
                this.updateUserInfo();
                this.loadChatHistory();
                setTimeout(() => this.showWelcomeMessage(), 2000);
            } else {
                this.showError(data.message || 'Erreur d\'inscription');
            }
        } catch (error) {
            this.showError('Erreur d\'inscription');
        }
    }

    async showWelcomeMessage() {
        // Créer le message vide d'abord
        const welcomeMessage = {
            role: 'ai',
            message: '',
            date: new Date().toISOString()
        };
        
        this.addMessageToChat(welcomeMessage, false);
        this.currentStreamingMessage = document.querySelector('.message:last-child .message-content');
        
        // Texte d'accueil simple et direct
        const welcomeText = `Assalamu alaykum ! 🤲🏻

Je suis CoachBot, ton coach personnel pour 15 jours de transformation.

Peux-tu me dire ton prénom et l'objectif principal sur lequel tu souhaites progresser ?`;
        
        // Effet de frappe
        await this.typeMessage(welcomeText, false);
    }

    logout() {
        localStorage.removeItem('coachbot_token');
        this.token = null;
        this.user = null;
        this.showAuthModal();
        document.getElementById('chatMessages').innerHTML = '';
    }

    async loadChatHistory() {
        try {
            const response = await fetch(`/api/chat/history?day=${this.currentDay}`, {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });

            if (response.ok) {
                const messages = await response.json();
                this.displayChatHistory(messages);
            }
        } catch (error) {
            console.error('Erreur chargement historique:', error);
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

        // Ajouter message utilisateur
        const userMessage = {
            role: 'user',
            message: message,
            date: new Date().toISOString()
        };

        this.addMessageToChat(userMessage);

        // Préparer message IA vide pour streaming
        const aiMessage = {
            role: 'ai',
            message: '',
            date: new Date().toISOString()
        };

        this.addMessageToChat(aiMessage, false);
        this.currentStreamingMessage = document.querySelector('.message:last-child .message-content');

        try {
            await this.streamAIResponse(message);
        } catch (error) {
            console.error('Erreur envoi message:', error);
            this.showError('Erreur lors de l\'envoi du message');
        }

        this.isLoading = false;
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
            throw new Error('Erreur serveur');
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
                        // Lecture vocale automatique de la réponse complète
                        const finalText = this.currentStreamingMessage?.textContent;
                        if (finalText && finalText.trim()) {
                            setTimeout(() => {
                                this.voiceManager.speakText(finalText);
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
            // Mode streaming : ajouter caractère par caractère
            this.currentStreamingMessage.textContent += text;
        } else {
            // Mode typing : effet de frappe complet
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

        // Sauvegarder en base si nécessaire
        if (save && this.token) {
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
            console.error('Erreur sauvegarde message:', error);
        }
    }

    scrollToBottom() {
        const chatMessages = document.getElementById('chatMessages');
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    showError(message) {
        // Créer notification d'erreur
        const error = document.createElement('div');
        error.className = 'error-notification';
        error.textContent = message;
        error.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #ff4444;
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            z-index: 10000;
            animation: slideIn 0.3s ease;
        `;

        document.body.appendChild(error);

        setTimeout(() => {
            error.remove();
        }, 3000);
    }

    loadSettings() {
        // Charger préférences utilisateur
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
        from { transform: translateX(100%); }
        to { transform: translateX(0); }
    }
`;
document.head.appendChild(style);

// CoachBot Frontend - Version complète et corrigée

// 🛡️ UTILITAIRES DE SÉCURITÉ
function sanitizeHTML(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validatePassword(password) {
  return password && password.length >= 6;
}

function logError(action, error, context = {}) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    action,
    error: error.message || error,
    context,
    userAgent: navigator.userAgent,
    url: window.location.href
  };
  
  console.error(`[FRONTEND ERROR] ${action}:`, logEntry);
}

// 🎤 VOICE MANAGER SIMPLIFIÉ
class VoiceManager {
    constructor(app) {
        this.app = app;
        this.isRecording = false;
        this.isPlaying = false;
        this.recognition = null;
        this.synthesis = window.speechSynthesis;
        
        if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
            this.initRecognition();
        }
    }

    initRecognition() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        this.recognition = new SpeechRecognition();
        this.recognition.continuous = false;
        this.recognition.interimResults = true;
        this.recognition.lang = 'fr-FR';

        this.recognition.onresult = (event) => {
            for (let i = event.resultIndex; i < event.results.length; i++) {
                if (event.results[i].isFinal) {
                    const transcript = event.results[i][0].transcript;
                    if (this.app.messageInput) {
                        this.app.messageInput.value = transcript;
                        this.app.sendMessage();
                    }
                }
            }
        };

        this.recognition.onstart = () => {
            this.isRecording = true;
            this.updateMicButton();
        };

        this.recognition.onend = () => {
            this.isRecording = false;
            this.updateMicButton();
        };
    }

    updateMicButton() {
        const micBtn = document.getElementById('mic-btn');
        if (micBtn) {
            micBtn.innerHTML = this.isRecording ? '⏹️' : '🎤';
            micBtn.style.background = this.isRecording ? '#dc3545' : '#28a745';
        }
    }

    updateSpeakerButton() {
        const speakerBtn = document.getElementById('speaker-btn');
        if (speakerBtn) {
            speakerBtn.innerHTML = this.isPlaying ? '⏹️' : '🔊';
            speakerBtn.style.background = this.isPlaying ? '#dc3545' : '#17a2b8';
        }
    }

    toggleRecording() {
        if (!this.recognition) return;
        
        if (this.isRecording) {
            this.recognition.stop();
        } else {
            this.recognition.start();
        }
    }

    speakText(text) {
        if (!text) return;
        
        if (this.isPlaying) {
            this.synthesis.cancel();
            this.isPlaying = false;
            this.updateSpeakerButton();
            return;
        }

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'fr-FR';
        utterance.rate = 0.9;

        utterance.onstart = () => {
            this.isPlaying = true;
            this.updateSpeakerButton();
        };

        utterance.onend = () => {
            this.isPlaying = false;
            this.updateSpeakerButton();
        };

        this.synthesis.speak(utterance);
    }

    toggleSpeaker() {
        const lastMessage = this.app.getLastAiMessage();
        if (lastMessage) {
            this.speakText(lastMessage);
        }
    }
}

// 🤖 CLASSE COACHBOT PRINCIPALE
class CoachBot {
    constructor() {
        this.currentDay = 1;
        this.serverMode = false;
        this.user = null;
        this.token = localStorage.getItem('coachbot_token');
        this.messageCounter = 0;
        
        this.initDOMElements();
        this.initEventListeners();
        this.initApp();
    }

    initDOMElements() {
        this.authModal = document.getElementById('auth-modal');
        this.loginForm = document.getElementById('login-form');
        this.registerForm = document.getElementById('register-form');
        this.chatMessages = document.querySelector('.chat-messages');
        this.messageInput = document.getElementById('message-input');
        this.userInfo = document.querySelector('.user-info');
        this.sendBtn = document.getElementById('send-btn');
    }

    initEventListeners() {
        // Navigation des jours
        document.querySelectorAll('.day-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const day = parseInt(e.target.dataset.day);
                this.switchToDay(day);
            });
        });

        // Formulaires d'auth
        if (this.loginForm) {
            this.loginForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const email = document.getElementById('login-email').value;
                const password = document.getElementById('login-password').value;
                this.login(email, password);
            });
        }

        if (this.registerForm) {
            this.registerForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const email = document.getElementById('register-email').value;
                const password = document.getElementById('register-password').value;
                const name = document.getElementById('register-name').value;
                this.register(email, password, name);
            });
        }

        // Messages
        if (this.messageInput) {
            this.messageInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.sendMessage();
                }
            });
        }

        if (this.sendBtn) {
            this.sendBtn.addEventListener('click', () => this.sendMessage());
        }

        // Déconnexion
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('logout-btn')) {
                this.logout();
            }
        });

        // Commutateurs auth
        document.addEventListener('click', (e) => {
            if (e.target.id === 'show-register') {
                this.showRegisterForm();
            } else if (e.target.id === 'show-login') {
                this.showLoginForm();
            }
        });
    }

    async initApp() {
        await this.checkServerConnection();
        this.updateUserInfo();
        this.loadMessages();
        
        // VoiceManager
        setTimeout(() => {
            this.voiceManager = new VoiceManager(this);
        }, 1000);
        
        // Onboarding
        setTimeout(() => {
            this.checkOnboarding();
        }, 2000);
    }

    async checkServerConnection() {
        if (!this.token) {
            this.activateLocalMode();
            return;
        }

        try {
            const response = await fetch('/api/user/profile', {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });

            if (response.ok) {
                this.user = await response.json();
                this.serverMode = true;
            } else {
                this.activateLocalMode();
            }
        } catch (error) {
            this.activateLocalMode();
        }
    }

    activateLocalMode() {
        this.serverMode = false;
        this.user = JSON.parse(localStorage.getItem('coachbot_user')) || null;
        console.log('Mode local activé');
    }

    updateUserInfo() {
        if (!this.userInfo) return;

        const onboardingData = localStorage.getItem('coachbot_onboarding');
        let displayName = 'Utilisateur';
        let configBadge = '';
        
        if (onboardingData) {
            const profile = JSON.parse(onboardingData);
            displayName = profile.prenom || 'Utilisateur';
            configBadge = '<span class="config-badge">✨ Configuré</span>';
        } else if (this.user?.name) {
            displayName = this.user.name;
        }

        const modeIndicator = this.serverMode ? '🟢 Serveur' : '🔴 Local';
        const adminBadge = this.user?.role === 'admin' ? '<span class="admin-badge">👑 Admin</span>' : '';
        
        this.userInfo.innerHTML = `
            <div>
                <strong>${displayName}</strong> ${adminBadge} ${configBadge}
                <div class="mode-indicator">${modeIndicator}</div>
            </div>
        `;
    }

    checkOnboarding() {
        const onboardingData = localStorage.getItem('coachbot_onboarding');
        if (!onboardingData) {
            this.showOnboardingModal();
        }
    }

    showOnboardingModal() {
        window.open('/onboarding', '_blank', 'width=800,height=600');
        
        const checkInterval = setInterval(() => {
            const onboardingData = localStorage.getItem('coachbot_onboarding');
            if (onboardingData) {
                clearInterval(checkInterval);
                this.updateUserInfo();
                location.reload();
            }
        }, 1000);
    }

    showSettings() {
        const onboardingData = localStorage.getItem('coachbot_onboarding');
        
        if (onboardingData) {
            const profile = JSON.parse(onboardingData);
            const modalContent = `
                <div class="settings-modal" style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); z-index: 10000; display: flex; align-items: center; justify-content: center;">
                    <div style="background: white; padding: 30px; border-radius: 15px; max-width: 500px; margin: 20px;">
                        <h2 style="margin-bottom: 20px; color: #333;">⚙️ Paramètres</h2>
                        
                        <div style="margin-bottom: 20px;">
                            <h3 style="color: #6366F1; margin-bottom: 10px;">Profil utilisateur</h3>
                            <p><strong>Prénom:</strong> ${profile.prenom}</p>
                            <p><strong>Âge:</strong> ${profile.age} ans</p>
                            <p><strong>Objectif:</strong> ${profile.objectif}</p>
                            <p><strong>Style de coaching:</strong> ${profile.coachingStyle}</p>
                            <p><strong>Niveau actuel:</strong> ${profile.niveauActuel}/10</p>
                        </div>
                        
                        <div style="display: flex; gap: 10px; justify-content: center;">
                            <button onclick="window.coachBot.redoOnboarding()" style="background: #6366F1; color: white; border: none; padding: 10px 20px; border-radius: 8px; cursor: pointer;">
                                🔄 Refaire l'onboarding
                            </button>
                            <button onclick="window.coachBot.closeSettings()" style="background: #64748B; color: white; border: none; padding: 10px 20px; border-radius: 8px; cursor: pointer;">
                                Fermer
                            </button>
                        </div>
                    </div>
                </div>
            `;
            document.body.insertAdjacentHTML('beforeend', modalContent);
        } else {
            alert('Aucun profil configuré. Veuillez compléter l\'onboarding d\'abord.');
            this.showOnboardingModal();
        }
    }

    redoOnboarding() {
        localStorage.removeItem('coachbot_onboarding');
        this.closeSettings();
        this.showOnboardingModal();
    }

    closeSettings() {
        const modal = document.querySelector('.settings-modal');
        if (modal) modal.remove();
    }

    switchToDay(day) {
        this.currentDay = day;
        document.querySelectorAll('.day-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        const activeBtn = document.querySelector(`[data-day="${day}"]`);
        if (activeBtn) {
            activeBtn.classList.add('active');
        }
        
        const dayTitle = document.querySelector('.day-title');
        if (dayTitle) {
            dayTitle.textContent = `Jour ${day} - Transformation`;
        }
        this.loadMessages();
    }

    async login(email, password) {
        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });

            const data = await response.json();

            if (response.ok) {
                this.token = data.token;
                this.user = data.user;
                localStorage.setItem('coachbot_token', this.token);
                localStorage.setItem('coachbot_user', JSON.stringify(this.user));
                
                this.serverMode = true;
                this.updateUserInfo();
                this.hideAuthModal();
                await this.showWelcomeMessage();
                
            } else {
                alert(data.error || 'Erreur de connexion');
            }
        } catch (error) {
            this.activateLocalMode();
            await this.showWelcomeMessage();
        }
    }

    async register(email, password, name) {
        try {
            const response = await fetch('/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password, name })
            });

            const data = await response.json();

            if (response.ok) {
                this.token = data.token;
                this.user = data.user;
                localStorage.setItem('coachbot_token', this.token);
                localStorage.setItem('coachbot_user', JSON.stringify(this.user));
                
                this.serverMode = true;
                this.updateUserInfo();
                this.hideAuthModal();
                await this.showWelcomeMessage();
                
            } else {
                alert(data.error || 'Erreur d\'inscription');
            }
        } catch (error) {
            this.activateLocalMode();
            await this.showWelcomeMessage();
        }
    }

    logout() {
        localStorage.removeItem('coachbot_token');
        localStorage.removeItem('coachbot_user');
        this.token = null;
        this.user = null;
        this.serverMode = false;
        this.updateUserInfo();
        this.showAuthModal();
    }

    showAuthModal() {
        if (this.authModal) this.authModal.style.display = 'flex';
    }

    hideAuthModal() {
        if (this.authModal) this.authModal.style.display = 'none';
    }

    showLoginForm() {
        if (this.loginForm && this.registerForm) {
            this.loginForm.style.display = 'block';
            this.registerForm.style.display = 'none';
        }
    }

    showRegisterForm() {
        if (this.loginForm && this.registerForm) {
            this.loginForm.style.display = 'none';
            this.registerForm.style.display = 'block';
        }
    }

    async showWelcomeMessage() {
        if (!this.chatMessages) return;

        const onboardingData = localStorage.getItem('coachbot_onboarding');
        let welcomeMessage = "As-salāmu ʿalaykum ! 🤲🏻 Je suis CoachBot, ton coach personnel pour ces 15 jours de transformation. Comment puis-je t'aider aujourd'hui ?";
        
        if (onboardingData) {
            const profile = JSON.parse(onboardingData);
            welcomeMessage = `As-salāmu ʿalaykum ${profile.prenom} ! 🤲🏻 Ravi de te retrouver ! Je me souviens que tu souhaites progresser sur "${profile.objectif}". Comment s'est passée ta journée ? Es-tu prêt(e) à continuer notre travail ensemble ?`;
        }

        this.addMessage(welcomeMessage, 'ai');
    }

    async loadMessages() {
        if (!this.chatMessages) return;

        try {
            if (this.serverMode) {
                const response = await fetch(`/api/chat/history?day=${this.currentDay}`, {
                    headers: { 'Authorization': `Bearer ${this.token}` }
                });

                if (response.ok) {
                    const messages = await response.json();
                    this.displayMessages(messages);
                } else {
                    this.loadLocalMessages();
                }
            } else {
                this.loadLocalMessages();
            }
        } catch (error) {
            this.loadLocalMessages();
        }
    }

    loadLocalMessages() {
        const messages = JSON.parse(localStorage.getItem(`coachbot_day${this.currentDay}`) || '[]');
        this.displayMessages(messages);
    }

    displayMessages(messages) {
        if (!this.chatMessages) return;
        this.chatMessages.innerHTML = '';
        messages.forEach(msg => {
            this.addMessage(msg.message, msg.role, false);
        });
        this.scrollToBottom();
    }

    addMessage(content, role, save = true) {
        if (!this.chatMessages) return;

        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${role}-message`;
        
        const timestamp = new Date().toLocaleTimeString('fr-FR', { 
            hour: '2-digit', 
            minute: '2-digit' 
        });

        messageDiv.innerHTML = `
            <div class="message-content">${sanitizeHTML(content)}</div>
            <div class="message-time">${timestamp}</div>
        `;

        this.chatMessages.appendChild(messageDiv);
        this.scrollToBottom();

        if (save) {
            this.saveMessage(content, role);
        }
    }

    async saveMessage(message, role) {
        try {
            if (this.serverMode) {
                await fetch('/api/chat/save', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${this.token}`
                    },
                    body: JSON.stringify({
                        day: this.currentDay,
                        message,
                        role
                    })
                });
            } else {
                const messages = JSON.parse(localStorage.getItem(`coachbot_day${this.currentDay}`) || '[]');
                messages.push({
                    message,
                    role,
                    date: new Date().toISOString()
                });
                localStorage.setItem(`coachbot_day${this.currentDay}`, JSON.stringify(messages));
            }
        } catch (error) {
            console.error('Erreur sauvegarde:', error);
        }
    }

    async sendMessage() {
        if (!this.messageInput) return;

        const message = this.messageInput.value.trim();
        if (!message) return;

        this.addMessage(message, 'user');
        this.messageInput.value = '';

        try {
            if (this.serverMode) {
                await this.streamAIResponse(message);
            } else {
                await this.simulateAIResponse(message);
            }
        } catch (error) {
            this.activateLocalMode();
            await this.simulateAIResponse(message);
        }
    }

    async streamAIResponse(message) {
        try {
            const response = await fetch('/api/chat/message', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify({
                    message,
                    day: this.currentDay
                })
            });

            if (!response.ok) throw new Error('Erreur serveur');

            const messageDiv = this.createStreamingMessageDiv();
            let fullResponse = '';

            const reader = response.body.getReader();
            const decoder = new TextDecoder();

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value);
                const lines = chunk.split('\n');

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const data = line.slice(6);
                        if (data === '[DONE]') {
                            this.saveMessage(fullResponse, 'ai');
                            return;
                        }

                        try {
                            const parsed = JSON.parse(data);
                            if (parsed.content) {
                                fullResponse += parsed.content;
                                messageDiv.querySelector('.message-content').textContent = fullResponse;
                                this.scrollToBottom();
                            }
                        } catch (e) {
                            // Ignorer erreurs parsing
                        }
                    }
                }
            }
        } catch (error) {
            this.activateLocalMode();
            await this.simulateAIResponse(message);
        }
    }

    createStreamingMessageDiv() {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message ai-message';
        
        const timestamp = new Date().toLocaleTimeString('fr-FR', { 
            hour: '2-digit', 
            minute: '2-digit' 
        });

        messageDiv.innerHTML = `
            <div class="message-content"></div>
            <div class="message-time">${timestamp}</div>
        `;

        if (this.chatMessages) {
            this.chatMessages.appendChild(messageDiv);
            this.scrollToBottom();
        }
        
        return messageDiv;
    }

    async simulateAIResponse(message) {
        const onboardingData = localStorage.getItem('coachbot_onboarding');
        const userMessage = message.toLowerCase();
        this.messageCounter++;

        // Réponses contextuelles
        let responses = [];

        if (onboardingData) {
            const profile = JSON.parse(onboardingData);
            const prenom = profile.prenom || 'mon frère/ma sœur';
            
            responses = [
                `Barakallahu fik ${prenom} 🤲🏻 Je t'accompagne avec bienveillance dans ton cheminement vers une meilleure ${profile.objectif}. Comment te sens-tu aujourd'hui ?`,
                `As-salāmu ʿalaykum ${prenom} 🤲🏻 Prends ton temps, chaque étape compte. Concernant ta ${profile.objectif}, quelle petite victoire peux-tu célébrer aujourd'hui ?`,
                `Qu'Allah facilite ton parcours ${prenom} ✨ Je suis là pour t'encourager dans l'amélioration de ta ${profile.objectif}. Raconte-moi comment ça se passe pour toi.`
            ];
        } else {
            responses = [
                "As-salāmu ʿalaykum ! 🤲🏻 Pour mieux t'accompagner, peux-tu me dire ton prénom et me partager le défi principal sur lequel tu souhaites progresser ?",
                "Barakallahu fik ! Je suis là pour t'aider dans ton développement personnel. Dis-moi, quel est ton objectif prioritaire en ce moment ?",
                "Qu'Allah te facilite ! ✨ Chaque parcours de transformation commence par une intention claire. Quelle est la tienne ?"
            ];
        }

        // Éviter répétitions
        const usedKey = `used_responses_day${this.currentDay}`;
        const usedResponses = JSON.parse(localStorage.getItem(usedKey) || '[]');
        const availableResponses = responses.filter(r => !usedResponses.includes(r));
        
        let selectedResponse;
        if (availableResponses.length > 0) {
            selectedResponse = availableResponses[Math.floor(Math.random() * availableResponses.length)];
            usedResponses.push(selectedResponse);
            localStorage.setItem(usedKey, JSON.stringify(usedResponses.slice(-5)));
        } else {
            selectedResponse = responses[0];
            localStorage.setItem(usedKey, JSON.stringify([selectedResponse]));
        }

        // Animation typing
        const messageDiv = this.createStreamingMessageDiv();
        const contentDiv = messageDiv.querySelector('.message-content');
        
        let i = 0;
        const typeWriter = () => {
            if (i < selectedResponse.length) {
                contentDiv.textContent += selectedResponse.charAt(i);
                i++;
                this.scrollToBottom();
                setTimeout(typeWriter, 30);
            } else {
                this.saveMessage(selectedResponse, 'ai');
            }
        };
        
        setTimeout(typeWriter, 500);
    }

    getLastAiMessage() {
        if (!this.chatMessages) return null;
        const aiMessages = this.chatMessages.querySelectorAll('.ai-message .message-content');
        return aiMessages.length > 0 ? aiMessages[aiMessages.length - 1].textContent : null;
    }

    scrollToBottom() {
        if (this.chatMessages) {
            this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
        }
    }
}

// 🌐 FONCTIONS GLOBALES
function toggleVoice() {
    if (window.coachBot && window.coachBot.voiceManager) {
        window.coachBot.voiceManager.toggleRecording();
    }
}

function stopSpeaking() {
    if (window.coachBot && window.coachBot.voiceManager) {
        window.coachBot.voiceManager.toggleSpeaker();
    }
}

function showSettings() {
    if (window.coachBot) {
        window.coachBot.showSettings();
    }
}

// 🚀 INITIALISATION
document.addEventListener('DOMContentLoaded', () => {
    try {
        window.coachBot = new CoachBot();
        console.log('✅ CoachBot initialisé avec succès');
    } catch (error) {
        console.error('❌ Erreur initialisation CoachBot:', error);
    }
});

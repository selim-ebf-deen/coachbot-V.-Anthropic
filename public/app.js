// CoachBot Frontend - Version corrigée complète avec sécurité renforcée - PARTIE 1/3

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

// 🎤 VOICE MANAGER COMPLET
class VoiceManager {
    constructor(app) {
        this.app = app;
        this.isRecording = false;
        this.isPlaying = false;
        this.recognition = null;
        this.synthesis = window.speechSynthesis;
        this.currentUtterance = null;
        this.isSupported = this.checkSupport();
        
        if (this.isSupported.recognition) {
            this.initRecognition();
        }
    }

    checkSupport() {
        return {
            recognition: 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window,
            synthesis: 'speechSynthesis' in window,
            full: true
        };
    }

    initRecognition() {
        try {
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            this.recognition = new SpeechRecognition();
            this.recognition.continuous = false;
            this.recognition.interimResults = true;
            this.recognition.lang = 'fr-FR';

            this.recognition.onstart = () => {
                this.isRecording = true;
                this.updateMicButton();
            };

            this.recognition.onresult = (event) => {
                let finalTranscript = '';
                for (let i = event.resultIndex; i < event.results.length; i++) {
                    if (event.results[i].isFinal) {
                        finalTranscript += event.results[i][0].transcript;
                    }
                }

                if (finalTranscript && this.app.messageInput) {
                    this.app.messageInput.value = finalTranscript.trim();
                    this.app.sendMessage();
                }
            };

            this.recognition.onend = () => {
                this.isRecording = false;
                this.updateMicButton();
            };

            this.recognition.onerror = () => {
                this.isRecording = false;
                this.updateMicButton();
            };

        } catch (error) {
            console.warn('Erreur initialisation reconnaissance vocale:', error);
            this.isSupported.recognition = false;
        }
    }

    updateMicButton() {
        const micBtn = document.getElementById('mic-btn');
        if (micBtn) {
            if (this.isRecording) {
                micBtn.style.background = '#dc3545';
                micBtn.innerHTML = '⏹️';
            } else {
                micBtn.style.background = '#28a745';
                micBtn.innerHTML = '🎤';
            }
        }
    }

    updateSpeakerButton() {
        const speakerBtn = document.getElementById('speaker-btn');
        if (speakerBtn) {
            if (this.isPlaying) {
                speakerBtn.style.background = '#dc3545';
                speakerBtn.innerHTML = '⏹️';
            } else {
                speakerBtn.style.background = '#17a2b8';
                speakerBtn.innerHTML = '🔊';
            }
        }
    }

    toggleRecording() {
        if (!this.isSupported.recognition) return;

        if (this.isRecording) {
            this.recognition.stop();
        } else {
            try {
                this.recognition.start();
            } catch (error) {
                console.warn('Erreur démarrage reconnaissance:', error);
            }
        }
    }

    speakText(text) {
        if (!this.isSupported.synthesis || !text) return;

        if (this.isPlaying) {
            this.stopSpeaking();
            return;
        }

        const cleanText = text
            .replace(/[🤲🏻✨💪🎯📈🌟⭐️🔥💎🚀📱💡🎪🎭🎨🎯🏆🎊🎉]/g, '')
            .replace(/\*\*(.*?)\*\*/g, '$1')
            .replace(/\*(.*?)\*/g, '$1')
            .trim();

        if (!cleanText) return;

        this.currentUtterance = new SpeechSynthesisUtterance(cleanText);
        this.currentUtterance.lang = 'fr-FR';
        this.currentUtterance.rate = 0.9;

        this.currentUtterance.onstart = () => {
            this.isPlaying = true;
            this.updateSpeakerButton();
        };

        this.currentUtterance.onend = () => {
            this.isPlaying = false;
            this.updateSpeakerButton();
            this.currentUtterance = null;
        };

        this.synthesis.speak(this.currentUtterance);
    }

    stopSpeaking() {
        if (this.synthesis.speaking) {
            this.synthesis.cancel();
        }
        this.isPlaying = false;
        this.updateSpeakerButton();
    }

    toggleSpeaker() {
        const lastMessage = this.app.getLastAiMessage();
        if (lastMessage) {
            this.speakText(lastMessage);
        }
    }

    destroy() {
        try {
            if (this.recognition) {
                this.recognition.stop();
            }
            if (this.synthesis.speaking) {
                this.synthesis.cancel();
            }
        } catch (error) {
            console.warn('Erreur cleanup VoiceManager:', error);
        }
    }
}

// CoachBot Frontend - PARTIE 2/3 - Classe CoachBot
// COLLER APRÈS LA PARTIE 1

class CoachBot {
    constructor() {
        this.currentDay = 1;
        this.serverMode = false;
        this.user = null;
        this.token = localStorage.getItem('coachbot_token');
        this.currentStreamingMessage = null;
        this.messageCounter = 0;
        this.isInitialized = false;
        
        this.init();
    }

    init() {
        try {
            this.initDOMElements();
            this.initEventListeners();
            this.initApp();
            this.isInitialized = true;
            console.log('✅ CoachBot initialisé avec succès');
        } catch (error) {
            console.error('❌ Erreur initialisation CoachBot:', error);
        }
    }

    initDOMElements() {
        this.authModal = document.getElementById('auth-modal');
        this.loginForm = document.getElementById('login-form');
        this.registerForm = document.getElementById('register-form');
        this.chatMessages = document.querySelector('.chat-messages');
        this.messageInput = document.getElementById('message-input');
        this.userInfo = document.querySelector('.user-info');
        this.sendBtn = document.getElementById('send-btn');
        this.micBtn = document.getElementById('mic-btn');
        this.speakerBtn = document.getElementById('speaker-btn');
    }

    initEventListeners() {
        // Navigation jours
        document.querySelectorAll('.day-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const day = parseInt(e.target.dataset.day);
                this.switchToDay(day);
            });
        });

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

        // Auth
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

        // Auth switchers
        document.addEventListener('click', (e) => {
            if (e.target.id === 'show-register') {
                this.showRegisterForm();
            } else if (e.target.id === 'show-login') {
                this.showLoginForm();
            } else if (e.target.classList.contains('logout-btn')) {
                this.logout();
            }
        });

        // Boutons vocaux
        if (this.micBtn) {
            this.micBtn.addEventListener('click', () => {
                if (this.voiceManager) {
                    this.voiceManager.toggleRecording();
                }
            });
        }

        if (this.speakerBtn) {
            this.speakerBtn.addEventListener('click', () => {
                if (this.voiceManager) {
                    this.voiceManager.toggleSpeaker();
                }
            });
        }
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
                console.log('🟢 Mode serveur activé');
            } else {
                this.activateLocalMode();
            }
        } catch (error) {
            console.log('❌ Erreur serveur, mode local activé');
            this.activateLocalMode();
        }
    }

    activateLocalMode() {
        this.serverMode = false;
        this.user = JSON.parse(localStorage.getItem('coachbot_user')) || null;
        console.log('🔴 Mode local activé');
    }

    updateUserInfo() {
        if (!this.userInfo) return;

        const onboardingData = localStorage.getItem('coachbot_onboarding');
        let displayName = 'Utilisateur';
        let configBadge = '';
        
        if (onboardingData) {
            try {
                const profile = JSON.parse(onboardingData);
                displayName = profile.prenom || 'Utilisateur';
                configBadge = '<span class="config-badge">✨ Configuré</span>';
            } catch (e) {
                console.warn('Erreur parsing onboarding');
            }
        } else if (this.user?.name) {
            displayName = this.user.name;
        }

        const modeIndicator = this.serverMode ? '🟢 Serveur' : '🔴 Local';
        const adminBadge = this.user?.role === 'admin' ? '<span class="admin-badge">👑 Admin</span>' : '';
        
        this.userInfo.innerHTML = `
            <div>
                <strong>${sanitizeHTML(displayName)}</strong> ${adminBadge} ${configBadge}
                <div class="mode-indicator">${modeIndicator}</div>
            </div>
        `;
    }

    checkOnboarding() {
        const onboardingData = localStorage.getItem('coachbot_onboarding');
        if (!onboardingData) {
            setTimeout(() => {
                this.showOnboardingModal();
            }, 3000);
        }
    }

    showOnboardingModal() {
        const confirmed = confirm('🤲🏻 As-salāmu ʿalaykum !\n\nPour une expérience optimale, nous recommandons de configurer ton profil.\n\nSouhaites-tu accéder à l\'onboarding maintenant ?');
        
        if (confirmed) {
            window.open('/onboarding', '_blank', 'width=800,height=600');
            
            const checkInterval = setInterval(() => {
                const onboardingData = localStorage.getItem('coachbot_onboarding');
                if (onboardingData) {
                    clearInterval(checkInterval);
                    this.updateUserInfo();
                    this.showMessage('✅ Profil configuré avec succès !', 'success');
                }
            }, 1000);
        }
    }

    showSettings() {
        const onboardingData = localStorage.getItem('coachbot_onboarding');
        
        if (onboardingData) {
            try {
                const profile = JSON.parse(onboardingData);
                const modalContent = `
                    <div class="settings-modal" style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); z-index: 10000; display: flex; align-items: center; justify-content: center;">
                        <div style="background: white; padding: 30px; border-radius: 15px; max-width: 500px; margin: 20px;">
                            <h2 style="margin-bottom: 20px; color: #333;">⚙️ Paramètres</h2>
                            
                            <div style="margin-bottom: 20px;">
                                <h3 style="color: #6366F1; margin-bottom: 10px;">Profil utilisateur</h3>
                                <p><strong>Prénom:</strong> ${sanitizeHTML(profile.prenom || 'Non défini')}</p>
                                <p><strong>Âge:</strong> ${sanitizeHTML(profile.age || 'Non défini')}</p>
                                <p><strong>Objectif:</strong> ${sanitizeHTML(profile.objectif || 'Non défini')}</p>
                                <p><strong>Mode:</strong> ${this.serverMode ? '🟢 Serveur' : '🔴 Local'}</p>
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
            } catch (e) {
                this.showMessage('Erreur lors de l\'ouverture des paramètres', 'error');
            }
        } else {
            this.showMessage('Aucun profil configuré. Accès à l\'onboarding...', 'warning');
            setTimeout(() => this.showOnboardingModal(), 1000);
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
        if (!email || !password) {
            this.showMessage('Email et mot de passe requis', 'error');
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
                this.user = data.user;
                localStorage.setItem('coachbot_token', this.token);
                localStorage.setItem('coachbot_user', JSON.stringify(this.user));
                
                this.serverMode = true;
                this.updateUserInfo();
                this.hideAuthModal();
                this.showWelcomeMessage();
                this.showMessage('✅ Connexion réussie !', 'success');
            } else {
                this.showMessage(data.error || 'Erreur de connexion', 'error');
            }
        } catch (error) {
            console.log('❌ Erreur connexion, mode local activé');
            this.activateLocalMode();
            this.showWelcomeMessage();
        }
    }

    async register(email, password, name) {
        if (!email || !password) {
            this.showMessage('Email et mot de passe requis', 'error');
            return;
        }

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
                this.showWelcomeMessage();
                this.showMessage('✅ Compte créé avec succès !', 'success');
            } else {
                this.showMessage(data.error || 'Erreur d\'inscription', 'error');
            }
        } catch (error) {
            console.log('❌ Erreur inscription, mode local activé');
            this.activateLocalMode();
            this.showWelcomeMessage();
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
        this.showMessage('✅ Déconnexion réussie', 'success');
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

// CoachBot Frontend - PARTIE 3/3 - Méthodes et Finalisation
// COLLER APRÈS LA PARTIE 2

    showWelcomeMessage() {
        if (!this.chatMessages) return;

        const onboardingData = localStorage.getItem('coachbot_onboarding');
        let welcomeMessage = "As-salāmu ʿalaykum ! 🤲🏻 Je suis CoachBot, ton coach personnel pour ces 15 jours de transformation. Comment puis-je t'aider aujourd'hui ?";
        
        if (onboardingData) {
            try {
                const profile = JSON.parse(onboardingData);
                welcomeMessage = `As-salāmu ʿalaykum ${profile.prenom} ! 🤲🏻 Ravi de te retrouver ! Je me souviens que tu souhaites progresser sur "${profile.objectif}". Comment s'est passée ta journée ? Es-tu prêt(e) à continuer notre travail ensemble ?`;
            } catch (e) {
                console.warn('Erreur parsing profile pour welcome message');
            }
        }

        this.addMessage(welcomeMessage, 'ai');
    }

    async loadMessages() {
        if (!this.chatMessages) return;

        try {
            if (this.serverMode && this.token) {
                const response = await fetch(`/api/chat/history?day=${this.currentDay}`, {
                    headers: { 'Authorization': `Bearer ${this.token}` }
                });

                if (response.ok) {
                    const messages = await response.json();
                    this.displayMessages(messages);
                    return;
                }
            }
        } catch (error) {
            console.log('❌ Erreur chargement serveur, fallback local');
        }

        this.loadLocalMessages();
    }

    loadLocalMessages() {
        try {
            const messages = JSON.parse(localStorage.getItem(`coachbot_day${this.currentDay}`) || '[]');
            this.displayMessages(messages);
        } catch (error) {
            console.warn('Erreur chargement messages locaux');
            this.displayMessages([]);
        }
    }

    displayMessages(messages) {
        if (!this.chatMessages) return;

        this.chatMessages.innerHTML = '';
        
        if (Array.isArray(messages)) {
            messages.forEach(msg => {
                if (msg && msg.message) {
                    this.addMessage(msg.message, msg.role, false);
                }
            });
        }
        
        this.scrollToBottom();
    }

    addMessage(content, role, save = true) {
        if (!this.chatMessages || !content) return;

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
            if (this.serverMode && this.token) {
                const response = await fetch('/api/chat/save', {
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

                if (response.ok) return;
            }
        } catch (error) {
            console.log('❌ Erreur sauvegarde serveur, fallback local');
        }

        try {
            const messages = JSON.parse(localStorage.getItem(`coachbot_day${this.currentDay}`) || '[]');
            messages.push({
                message,
                role,
                date: new Date().toISOString()
            });
            localStorage.setItem(`coachbot_day${this.currentDay}`, JSON.stringify(messages));
        } catch (error) {
            console.warn('Erreur sauvegarde locale');
        }
    }

    async sendMessage() {
        if (!this.messageInput) return;

        const message = this.messageInput.value.trim();
        if (!message) {
            this.showMessage('Veuillez saisir un message', 'warning');
            return;
        }

        this.addMessage(message, 'user');
        this.messageInput.value = '';

        this.messageInput.disabled = true;
        if (this.sendBtn) {
            this.sendBtn.disabled = true;
            this.sendBtn.textContent = 'Envoi...';
        }

        try {
            if (this.serverMode && this.token) {
                await this.streamAIResponse(message);
            } else {
                await this.simulateAIResponse(message);
            }
        } catch (error) {
            console.log('❌ Erreur envoi, fallback simulation');
            await this.simulateAIResponse(message);
        } finally {
            this.messageInput.disabled = false;
            if (this.sendBtn) {
                this.sendBtn.disabled = false;
                this.sendBtn.textContent = 'Envoyer';
            }
            this.messageInput.focus();
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
                                const contentDiv = messageDiv.querySelector('.message-content');
                                if (contentDiv) {
                                    contentDiv.textContent = fullResponse;
                                    this.scrollToBottom();
                                }
                            }
                        } catch (e) {
                            // Ignorer erreurs parsing
                        }
                    }
                }
            }
        } catch (error) {
            console.log('❌ Erreur streaming, fallback simulation');
            throw error;
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
        
        let responses = [
            "As-salāmu ʿalaykum ! 🤲🏻 Je suis là pour t'accompagner dans ton développement personnel. Comment puis-je t'aider aujourd'hui ?",
            "Barakallahu fik ! 🌟 Chaque petit pas compte dans ton parcours de transformation. Dis-moi ce qui te préoccupe.",
            "Qu'Allah te facilite ! ✨ Je suis là pour t'écouter et te guider. Partage-moi tes pensées."
        ];

        if (onboardingData) {
            try {
                const profile = JSON.parse(onboardingData);
                const prenom = profile.prenom || 'mon frère/ma sœur';
                responses = [
                    `Barakallahu fik ${prenom} 🤲🏻 Comment avance ton objectif de ${profile.objectif} ? Dis-moi où tu en es.`,
                    `As-salāmu ʿalaykum ${prenom} ! 🌟 Je suis là pour t'accompagner. Quelle est ta priorité aujourd'hui ?`,
                    `${prenom}, qu'Allah bénisse tes efforts ! ✨ Raconte-moi comment ça se passe pour toi.`
                ];
            } catch (e) {
                console.warn('Erreur parsing profile pour réponses');
            }
        }

        // Éviter répétitions
        const usedKey = `used_responses_day${this.currentDay}`;
        const usedResponses = JSON.parse(localStorage.getItem(usedKey) || '[]');
        const availableResponses = responses.filter(r => !usedResponses.includes(r));
        
        let selectedResponse;
        if (availableResponses.length > 0) {
            selectedResponse = availableResponses[Math.floor(Math.random() * availableResponses.length)];
            usedResponses.push(selectedResponse);
            localStorage.setItem(usedKey, JSON.stringify(usedResponses.slice(-3)));
        } else {
            selectedResponse = responses[0];
            localStorage.setItem(usedKey, JSON.stringify([selectedResponse]));
        }

        // Animation typing
        const messageDiv = this.createStreamingMessageDiv();
        const contentDiv = messageDiv.querySelector('.message-content');
        
        if (contentDiv) {
            let i = 0;
            const typeWriter = () => {
                if (i < selectedResponse.length) {
                    contentDiv.textContent = selectedResponse.substring(0, i + 1);
                    i++;
                    this.scrollToBottom();
                    setTimeout(typeWriter, 50);
                } else {
                    this.saveMessage(selectedResponse, 'ai');
                }
            };
            
            setTimeout(typeWriter, 500);
        }
    }

    scrollToBottom() {
        if (this.chatMessages) {
            this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
        }
    }

    showMessage(message, type = 'info') {
        const messageDiv = document.createElement('div');
        messageDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${type === 'error' ? '#dc3545' : type === 'success' ? '#28a745' : type === 'warning' ? '#ffc107' : '#17a2b8'};
            color: ${type === 'warning' ? '#000' : '#fff'};
            padding: 15px 20px;
            border-radius: 8px;
            z-index: 10001;
            font-size: 14px;
            max-width: 300px;
            box-shadow: 0 5px 15px rgba(0,0,0,0.3);
        `;
        
        messageDiv.textContent = message;
        document.body.appendChild(messageDiv);
        
        setTimeout(() => {
            if (messageDiv.parentNode) {
                messageDiv.remove();
            }
        }, 4000);
    }

    getLastAiMessage() {
        if (!this.chatMessages) return null;
        const aiMessages = this.chatMessages.querySelectorAll('.ai-message .message-content');
        return aiMessages.length > 0 ? aiMessages[aiMessages.length - 1].textContent : null;
    }

    cleanup() {
        try {
            if (this.voiceManager) {
                this.voiceManager.destroy();
            }
            document.querySelectorAll('.settings-modal').forEach(modal => modal.remove());
        } catch (error) {
            console.warn('Erreur cleanup:', error);
        }
    }
}

// 🌐 FONCTIONS GLOBALES
function toggleVoice() {
    try {
        if (window.coachBot && window.coachBot.voiceManager) {
            window.coachBot.voiceManager.toggleRecording();
        } else {
            console.warn('VoiceManager non disponible');
        }
    } catch (error) {
        console.error('Erreur toggle voice:', error);
    }
}

function stopSpeaking() {
    try {
        if (window.coachBot && window.coachBot.voiceManager) {
            window.coachBot.voiceManager.toggleSpeaker();
        } else {
            console.warn('VoiceManager non disponible');
        }
    } catch (error) {
        console.error('Erreur stop speaking:', error);
    }
}

function showSettings() {
    try {
        if (window.coachBot) {
            window.coachBot.showSettings();
        } else {
            alert('CoachBot n\'est pas encore initialisé. Veuillez patienter...');
        }
    } catch (error) {
        console.error('Erreur show settings:', error);
    }
}

function isMobile() {
    return window.innerWidth <= 768 || /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

// 🚀 INITIALISATION
document.addEventListener('DOMContentLoaded', () => {
    try {
        console.log('🚀 Démarrage CoachBot...');
        window.coachBot = new CoachBot();
        console.log('✅ CoachBot initialisé avec succès !');
        
        console.log(`
🚀 CoachBot Frontend v2.0 CORRIGÉ - Chargé avec succès !
✅ Toutes les fonctionnalités sont opérationnelles
🤲🏻 Bi-idhnillah, l'interface sécurisée est prête !
        `);
        
        // Charger les voix après un délai
        setTimeout(() => {
            if (window.speechSynthesis) {
                window.speechSynthesis.getVoices();
            }
        }, 1000);
        
    } catch (error) {
        console.error('❌ Erreur initialisation CoachBot:', error);
        alert('Erreur d\'initialisation de CoachBot. Rechargement de la page...');
        setTimeout(() => location.reload(), 2000);
    }
});

// 🧹 NETTOYAGE
window.addEventListener('beforeunload', () => {
    try {
        if (window.coachBot) {
            window.coachBot.cleanup();
        }
    } catch (error) {
        console.error('Erreur cleanup:', error);
    }
});

console.log('📄 Fichier app.js chargé avec succès');

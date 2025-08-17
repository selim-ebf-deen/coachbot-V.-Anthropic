// CoachBot Frontend - Version finale complète avec onboarding et vocal
class VoiceManager {
    constructor(app) {
        this.app = app;
        this.isRecording = false;
        this.isPlaying = false;
        this.recognition = null;
        this.synthesis = window.speechSynthesis;
        this.currentUtterance = null;
        this.initRecognition();
    }

    initRecognition() {
        if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            this.recognition = new SpeechRecognition();
            this.recognition.continuous = false;
            this.recognition.interimResults = true;
            this.recognition.lang = 'fr-FR';

            this.recognition.onstart = () => {
                this.isRecording = true;
                this.updateMicButton();
                this.showInterimResult('🎤 Écoute en cours...');
            };

            this.recognition.onresult = (event) => {
                let interimTranscript = '';
                let finalTranscript = '';

                for (let i = event.resultIndex; i < event.results.length; i++) {
                    const transcript = event.results[i][0].transcript;
                    if (event.results[i].isFinal) {
                        finalTranscript += transcript;
                    } else {
                        interimTranscript += transcript;
                    }
                }

                if (interimTranscript) {
                    this.showInterimResult('🎤 ' + interimTranscript);
                }

                if (finalTranscript) {
                    if (this.app.messageInput) {
                        this.app.messageInput.value = finalTranscript;
                        this.hideInterimResult();
                        this.app.sendMessage();
                    }
                }
            };

            this.recognition.onerror = (event) => {
                console.error('Erreur reconnaissance vocale:', event.error);
                this.isRecording = false;
                this.updateMicButton();
                this.hideInterimResult();
                
                if (event.error === 'not-allowed') {
                    alert('Veuillez autoriser l\'accès au microphone dans les paramètres de votre navigateur.');
                }
            };

            this.recognition.onend = () => {
                this.isRecording = false;
                this.updateMicButton();
                this.hideInterimResult();
            };
        }
    }

    showInterimResult(text) {
        let interim = document.getElementById('interim-result');
        if (!interim) {
            interim = document.createElement('div');
            interim.id = 'interim-result';
            interim.style.cssText = `
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: rgba(0,0,0,0.8);
                color: white;
                padding: 20px;
                border-radius: 10px;
                z-index: 10000;
                font-size: 16px;
                text-align: center;
                min-width: 200px;
            `;
            document.body.appendChild(interim);
        }
        interim.textContent = text;
    }

    hideInterimResult() {
        const interim = document.getElementById('interim-result');
        if (interim) {
            interim.remove();
        }
    }

    updateMicButton() {
        const micBtn = document.getElementById('mic-btn');
        if (micBtn) {
            if (this.isRecording) {
                micBtn.style.background = '#ff4444';
                micBtn.innerHTML = '⏹️';
                micBtn.title = 'Arrêter l\'enregistrement';
            } else {
                micBtn.style.background = '';
                micBtn.innerHTML = '🎤';
                micBtn.title = 'Commencer l\'enregistrement vocal';
            }
        }
    }

    updateSpeakerButton() {
        const speakerBtn = document.getElementById('speaker-btn');
        if (speakerBtn) {
            if (this.isPlaying) {
                speakerBtn.style.background = '#ff4444';
                speakerBtn.innerHTML = '⏹️';
                speakerBtn.title = 'Arrêter la lecture';
            } else {
                speakerBtn.style.background = '';
                speakerBtn.innerHTML = '🔊';
                speakerBtn.title = 'Lire le dernier message';
            }
        }
    }

    toggleRecording() {
        if (!this.recognition) {
            alert('Reconnaissance vocale non supportée par votre navigateur.');
            return;
        }

        if (this.isRecording) {
            this.recognition.stop();
        } else {
            try {
                this.recognition.start();
            } catch (error) {
                console.error('Erreur démarrage reconnaissance:', error);
                alert('Impossible de démarrer la reconnaissance vocale.');
            }
        }
    }

    getBestVoice() {
        const voices = this.synthesis.getVoices();
        
        // Priorité aux voix françaises de qualité
        const preferredVoices = [
            'Microsoft Hortense - French (France)',
            'Google français',
            'French (France)',
            'fr-FR'
        ];

        for (const preferred of preferredVoices) {
            const voice = voices.find(v => v.name.includes(preferred) || v.lang.includes('fr-FR'));
            if (voice) return voice;
        }

        // Fallback vers n'importe quelle voix française
        return voices.find(v => v.lang.startsWith('fr')) || voices[0];
    }

    speakText(text) {
        if (this.isPlaying) {
            this.stopSpeaking();
            return;
        }

        if (!text || text.trim() === '') return;

        // Nettoyer le texte des émoticônes et caractères spéciaux
        const cleanText = text
            .replace(/[🤲🏻✨💪🎯📈🌟⭐️🔥💎🚀📱💡🎪🎭🎨🎯🏆🎊🎉]/g, '')
            .replace(/\*\*(.*?)\*\*/g, '$1')
            .replace(/\*(.*?)\*/g, '$1')
            .trim();

        if (!cleanText) return;

        this.currentUtterance = new SpeechSynthesisUtterance(cleanText);
        
        // Configuration de la voix
        const bestVoice = this.getBestVoice();
        if (bestVoice) {
            this.currentUtterance.voice = bestVoice;
        }
        
        this.currentUtterance.rate = 0.9;
        this.currentUtterance.pitch = 1.0;
        this.currentUtterance.volume = 1.0;

        this.currentUtterance.onstart = () => {
            this.isPlaying = true;
            this.updateSpeakerButton();
        };

        this.currentUtterance.onend = () => {
            this.isPlaying = false;
            this.updateSpeakerButton();
            this.currentUtterance = null;
        };

        this.currentUtterance.onerror = () => {
            this.isPlaying = false;
            this.updateSpeakerButton();
            this.currentUtterance = null;
        };

        this.synthesis.speak(this.currentUtterance);
    }

    stopSpeaking() {
        if (this.synthesis.speaking || this.isPlaying) {
            this.synthesis.cancel();
            this.isPlaying = false;
            this.updateSpeakerButton();
            this.currentUtterance = null;
        }
    }

    toggleSpeaker() {
        if (this.isPlaying) {
            this.stopSpeaking();
        } else {
            // Lire le dernier message IA
            const lastAiMessage = this.app.getLastAiMessage();
            if (lastAiMessage) {
                this.speakText(lastAiMessage);
            } else {
                alert('Aucun message à lire.');
            }
        }
    }
}

class CoachBot {
    constructor() {
        this.currentDay = 1;
        this.serverMode = false;
        this.user = null;
        this.token = localStorage.getItem('coachbot_token');
        this.currentStreamingMessage = null;
        this.messageHistory = [];
        this.messageCounter = 0;
        this.voiceManager = new VoiceManager(this);
        
        // Initialiser les éléments du DOM de manière sécurisée
        this.initDOMElements();
        this.initEventListeners();
        this.initApp();
    }

    initDOMElements() {
        // Vérifier et initialiser les éléments du DOM
        this.authModal = document.getElementById('auth-modal');
        this.loginForm = document.getElementById('login-form');
        this.registerForm = document.getElementById('register-form');
        this.chatMessages = document.querySelector('.chat-messages');
        this.messageInput = document.getElementById('message-input');
        this.userInfo = document.querySelector('.user-info');
        
        // Si certains éléments n'existent pas, les créer ou gérer l'erreur
        if (!this.chatMessages) {
            console.warn('Element .chat-messages non trouvé');
        }
        if (!this.messageInput) {
            console.warn('Element #message-input non trouvé');
        }
        if (!this.userInfo) {
            console.warn('Element .user-info non trouvé');
        }
    }

    initEventListeners() {
        // Navigation des jours
        document.querySelectorAll('.day-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const day = parseInt(e.target.dataset.day);
                this.switchToDay(day);
            });
        });

        // Formulaires d'authentification
        if (this.loginForm) {
            this.loginForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const email = document.getElementById('login-email')?.value;
                const password = document.getElementById('login-password')?.value;
                if (email && password) {
                    this.login(email, password);
                }
            });
        }

        if (this.registerForm) {
            this.registerForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const email = document.getElementById('register-email')?.value;
                const password = document.getElementById('register-password')?.value;
                const name = document.getElementById('register-name')?.value;
                if (email && password) {
                    this.register(email, password, name);
                }
            });
        }

        // Envoi de messages
        if (this.messageInput) {
            this.messageInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.sendMessage();
                }
            });
        }

        // Bouton envoi
        const sendBtn = document.getElementById('send-btn');
        if (sendBtn) {
            sendBtn.addEventListener('click', () => {
                this.sendMessage();
            });
        }

        // Bouton déconnexion
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('logout-btn')) {
                this.logout();
            }
        });

        // Commutateurs auth modal
        document.addEventListener('click', (e) => {
            if (e.target.id === 'show-register') {
                this.showRegisterForm();
            } else if (e.target.id === 'show-login') {
                this.showLoginForm();
            }
        });

        // Boutons vocaux
        const micBtn = document.getElementById('mic-btn');
        if (micBtn) {
            micBtn.addEventListener('click', () => {
                this.voiceManager.toggleRecording();
            });
        }

        const speakerBtn = document.getElementById('speaker-btn');
        if (speakerBtn) {
            speakerBtn.addEventListener('click', () => {
                this.voiceManager.toggleSpeaker();
            });
        }
    }

    async initApp() {
        await this.checkServerConnection();
        this.updateUserInfo();
        this.loadMessages();
        
        // Vérifier onboarding après 2 secondes
        setTimeout(() => {
            this.checkOnboarding();
        }, 2000);
    }

    async checkServerConnection() {
        try {
            if (!this.token) {
                this.activateLocalMode();
                return;
            }

            const response = await fetch('/api/user/profile', {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });

            if (response.ok) {
                const userData = await response.json();
                this.user = userData;
                this.serverMode = true;
                
                // 🎯 SYNCHRONISER L'ONBOARDING SI CONNECTÉ
                await this.syncOnboardingToServer();
                
            } else {
                this.activateLocalMode();
            }
        } catch (error) {
            console.error('Erreur connexion serveur:', error);
            this.activateLocalMode();
        }
    }

    async syncOnboardingToServer() {
        try {
            const onboardingData = localStorage.getItem('coachbot_onboarding');
            if (onboardingData && this.serverMode) {
                const profile = JSON.parse(onboardingData);
                
                // Envoyer les métadonnées au serveur
                const metaResponse = await fetch('/api/meta', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${this.token}`
                    },
                    body: JSON.stringify({
                        name: profile.prenom,
                        disc: profile.coachingStyle || profile.style
                    })
                });

                if (metaResponse.ok) {
                    console.log('✅ Données d\'onboarding synchronisées avec le serveur');
                    
                    // Optionnel : sauvegarder aussi une entrée de journal avec le profil complet
                    await fetch('/api/chat/save', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${this.token}`
                        },
                        body: JSON.stringify({
                            day: 1,
                            role: 'user',
                            message: `[PROFIL ONBOARDING] Prénom: ${profile.prenom}, Âge: ${profile.age}, Objectif: ${profile.objectif}, Style de coaching: ${profile.coachingStyle}, Niveau actuel: ${profile.niveauActuel}/10, Obstacles: ${profile.obstacles}`
                        })
                    });
                }
            }
        } catch (error) {
            console.error('❌ Erreur sync onboarding:', error);
        }
    }

    activateLocalMode() {
        this.serverMode = false;
        this.user = JSON.parse(localStorage.getItem('coachbot_user')) || null;
        console.log('CoachBot initialisé en mode local');
        
        // Charger voix française pour le mode local
        if (this.voiceManager && this.voiceManager.synthesis) {
            this.voiceManager.synthesis.onvoiceschanged = () => {
                console.log('Voix sélectionnée:', this.voiceManager.getBestVoice()?.name || 'Voix par défaut');
            };
        }
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
        // Ouvrir l'onboarding dans un nouvel onglet
        window.open('/onboarding.html', '_blank', 'width=800,height=600');
        
        // Vérifier périodiquement si l'onboarding est terminé
        const checkInterval = setInterval(() => {
            const onboardingData = localStorage.getItem('coachbot_onboarding');
            if (onboardingData) {
                clearInterval(checkInterval);
                this.updateUserInfo();
                location.reload(); // Recharger pour synchroniser
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
        if (modal) {
            modal.remove();
        }
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
                headers: {
                    'Content-Type': 'application/json'
                },
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
                
                // 🎯 SYNCHRONISER L'ONBOARDING AVEC LE SERVEUR
                await this.syncOnboardingToServer();
                
                await this.showWelcomeMessage();
            } else {
                alert(data.error || 'Erreur de connexion');
            }
        } catch (error) {
            console.error('Erreur login:', error);
            this.activateLocalMode();
            await this.showWelcomeMessage();
        }
    }

    async register(email, password, name) {
        try {
            const response = await fetch('/api/auth/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
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
            console.error('Erreur register:', error);
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
        if (this.authModal) {
            this.authModal.style.display = 'flex';
        }
    }

    hideAuthModal() {
        if (this.authModal) {
            this.authModal.style.display = 'none';
        }
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
            welcomeMessage = `As-salāmu ʿalaykum ${profile.prenom} ! 🤲🏻 Ravi de te retrouver ! Je me souviens que tu souhaites progresser sur l'amélioration de ta ${profile.objectif}. Comment s'est passée ta journée ? Es-tu prêt(e) à continuer notre travail ensemble ?`;
        }

        this.addMessage(welcomeMessage, 'ai');
    }

    async loadMessages() {
        if (!this.chatMessages) return;

        try {
            if (this.serverMode) {
                const response = await fetch(`/api/chat/history?day=${this.currentDay}`, {
                    headers: {
                        'Authorization': `Bearer ${this.token}`
                    }
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
            console.error('Erreur chargement messages:', error);
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
            <div class="message-content">${content}</div>
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
            console.error('Erreur sauvegarde message:', error);
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
            if (this.serverMode) {
                console.log('Erreur serveur, basculement en mode local');
                this.serverMode = false;
                this.updateUserInfo();
                await this.simulateAIResponse(message);
            }
        }
    }

    async streamAIResponse(message) {
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

        if (!response.ok) {
            throw new Error('Erreur serveur');
        }

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
            this.currentStreamingMessage = messageDiv.querySelector('.message-content');
        }
        
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let fullResponse = '';

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
                        this.currentStreamingMessage = null;
                        return;
                    }

                    try {
                        const parsed = JSON.parse(data);
                        if (parsed.content) {
                            fullResponse += parsed.content;
                            if (this.currentStreamingMessage) {
                                this.currentStreamingMessage.textContent = fullResponse;
                                this.scrollToBottom();
                            }
                        }
                    } catch (e) {
                        // Ignorer les erreurs de parsing
                    }
                }
            }
        }
    }

    async simulateAIResponse(message) {
        const onboardingData = localStorage.getItem('coachbot_onboarding');
        const userMessage = message.toLowerCase();
        this.messageCounter++;

        // Réponses contextuelles selon l'onboarding et le message
        let responses = [];

        if (onboardingData) {
            const profile = JSON.parse(onboardingData);
            const style = profile.coachingStyle || 'bienveillant';
            
            // Réponses selon le style de coaching
            if (style === 'motivant') {
                responses = [
                    `Excellent ${profile.prenom} ! 💪 Je vois ta détermination pour améliorer ta ${profile.objectif}. Quelle micro-action vas-tu faire aujourd'hui pour progresser ?`,
                    `Mashallah ${profile.prenom} ! 🌟 Ton engagement est inspirant. Dis-moi, sur une échelle de 1 à 10, comment évalues-tu ton niveau actuel aujourd'hui ?`,
                    `Bravo ${profile.prenom} ! 🚀 Chaque pas compte dans ton parcours vers une meilleure ${profile.objectif}. Quel défi veux-tu relever maintenant ?`
                ];
            } else if (style === 'structured') {
                responses = [
                    `Bonjour ${profile.prenom}. 📋 Analysons ensemble ta progression sur l'objectif "${profile.objectif}". Peux-tu me donner 3 éléments concrets de ta situation actuelle ?`,
                    `${profile.prenom}, établissons un plan clair. 📊 Concernant ta ${profile.objectif}, quels sont tes 3 leviers principaux et tes 3 obstacles actuels ?`,
                    `Parfait ${profile.prenom}. 🎯 Définissons des critères de réussite mesurables pour ta ${profile.objectif}. Que signifierait "réussir" pour toi ?`
                ];
            } else {
                responses = [
                    `Barakallahu fik ${profile.prenom} 🤲🏻 Je t'accompagne avec bienveillance dans ton cheminement vers une meilleure ${profile.objectif}. Comment te sens-tu aujourd'hui ?`,
                    `As-salāmu ʿalaykum ${profile.prenom} 🤲🏻 Prends ton temps, chaque étape compte. Concernant ta ${profile.objectif}, quelle petite victoire peux-tu célébrer aujourd'hui ?`,
                    `Qu'Allah facilite ton parcours ${profile.prenom} ✨ Je suis là pour t'encourager dans l'amélioration de ta ${profile.objectif}. Raconte-moi comment ça se passe pour toi.`
                ];
            }
        } else {
            // Réponses par défaut si pas d'onboarding
            responses = [
                "As-salāmu ʿalaykum ! 🤲🏻 Pour mieux t'accompagner, peux-tu me dire ton prénom et me partager le défi principal sur lequel tu souhaites progresser ?",
                "Barakallahu fik ! Je suis là pour t'aider dans ton développement personnel. Dis-moi, quel est ton objectif prioritaire en ce moment ?",
                "Qu'Allah te facilite ! ✨ Chaque parcours de transformation commence par une intention claire. Quelle est la tienne ?"
            ];
        }

        // Réponses selon mots-clés
        if (userMessage.includes('niveau') || userMessage.includes('évalue')) {
            responses.push("Sur une échelle de 1 à 10, comment évalues-tu ton niveau actuel ? Et dis-moi ce qui te ferait passer au niveau supérieur.");
        }
        
        if (userMessage.includes('difficile') || userMessage.includes('obstacle')) {
            responses.push("Je comprends que ce soit difficile. 🤲🏻 Identifions ensemble le plus petit pas possible que tu peux faire aujourd'hui. Quelle micro-action de 10 minutes maximum ?");
        }
        
        if (userMessage.includes('oui') || userMessage.includes('d\'accord') || userMessage.includes('ameen')) {
            responses.push("Excellent ! 🌟 Maintenant, fixons-nous un critère de réussite concret. Comment saurais-tu que tu as progressé d'ici ce soir ?");
        }

        // Éviter les répétitions
        const usedKey = `used_responses_day${this.currentDay}`;
        const usedResponses = JSON.parse(localStorage.getItem(usedKey) || '[]');
        const availableResponses = responses.filter(r => !usedResponses.includes(r));
        
        let selectedResponse;
        if (availableResponses.length > 0) {
            selectedResponse = availableResponses[Math.floor(Math.random() * availableResponses.length)];
            usedResponses.push(selectedResponse);
            localStorage.setItem(usedKey, JSON.stringify(usedResponses.slice(-5))); // Garder 5 dernières
        } else {
            // Reset si toutes utilisées
            selectedResponse = responses[0];
            localStorage.setItem(usedKey, JSON.stringify([selectedResponse]));
        }

        // Simulation du streaming
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
            const contentDiv = messageDiv.querySelector('.message-content');
            
            // Animation de frappe
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

// Fonctions globales pour les boutons vocaux
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

// Fonction globale pour les paramètres
function showSettings() {
    if (window.coachBot) {
        window.coachBot.showSettings();
    }
}

// Initialisation sécurisée
document.addEventListener('DOMContentLoaded', () => {
    try {
        window.coachBot = new CoachBot();
        console.log('✅ CoachBot initialisé avec succès');
        
        // Charger les voix après un délai
        setTimeout(() => {
            if (window.speechSynthesis) {
                window.speechSynthesis.getVoices();
            }
        }, 1000);
    } catch (error) {
        console.error('❌ Erreur initialisation CoachBot:', error);
    }
});

// CoachBot Frontend - Version complète corrigée sans erreurs
let voiceClickTimeout = null;

class VoiceManager {
    constructor(app) {
        this.app = app;
        this.isRecording = false;
        this.isPlaying = false;
        this.recognition = null;
        this.synthesis = window.speechSynthesis;
        this.currentUtterance = null;
        this.recordingDebounce = null;
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
                    alert('Veuillez autoriser l\'accès au microphone.');
                } else if (event.error === 'network') {
                    alert('Erreur réseau. Vérifiez votre connexion internet.');
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
                position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
                background: rgba(0,0,0,0.8); color: white; padding: 20px; border-radius: 10px;
                z-index: 10000; font-size: 16px; text-align: center; min-width: 200px;
            `;
            document.body.appendChild(interim);
        }
        interim.textContent = text;
    }

    hideInterimResult() {
        const interim = document.getElementById('interim-result');
        if (interim) interim.remove();
    }

    updateMicButton() {
        const micBtn = document.getElementById('mic-btn');
        if (micBtn) {
            if (this.isRecording) {
                micBtn.style.background = '#ff4444';
                micBtn.innerHTML = '⏹️';
                micBtn.title = 'Arrêter l\'enregistrement';
                micBtn.classList.add('recording');
            } else {
                micBtn.style.background = '';
                micBtn.innerHTML = '🎤';
                micBtn.title = 'Reconnaissance vocale';
                micBtn.classList.remove('recording');
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
                speakerBtn.classList.add('playing');
            } else {
                speakerBtn.style.background = '';
                speakerBtn.innerHTML = '🔊';
                speakerBtn.title = 'Lire le dernier message';
                speakerBtn.classList.remove('playing');
            }
        }
    }

    debounceToggleRecording() {
        if (this.recordingDebounce) {
            clearTimeout(this.recordingDebounce);
        }
        
        this.recordingDebounce = setTimeout(() => {
            this.toggleRecording();
        }, 300);
    }

    toggleRecording() {
        if (!this.recognition) {
            alert('Reconnaissance vocale non supportée.');
            return;
        }

        if (this.isRecording) {
            try {
                this.recognition.stop();
            } catch (error) {
                console.log('Erreur arrêt reconnaissance:', error);
                this.isRecording = false;
                this.updateMicButton();
            }
        } else {
            try {
                if (!this.isRecording) {
                    this.recognition.start();
                }
            } catch (error) {
                console.error('Erreur démarrage reconnaissance:', error);
                this.isRecording = false;
                this.updateMicButton();
                
                if (error.name === 'InvalidStateError') {
                    alert('Le microphone est déjà en cours d\'utilisation. Patientez et réessayez.');
                } else {
                    alert('Impossible de démarrer la reconnaissance vocale.');
                }
            }
        }
    }

    getBestVoice() {
        const voices = this.synthesis.getVoices();
        const preferredVoices = ['Microsoft Hortense - French (France)', 'Google français', 'French (France)', 'fr-FR'];

        for (const preferred of preferredVoices) {
            const voice = voices.find(v => v.name.includes(preferred) || v.lang.includes('fr-FR'));
            if (voice) return voice;
        }
        return voices.find(v => v.lang.startsWith('fr')) || voices[0];
    }

    speakText(text) {
        if (this.isPlaying) {
            this.stopSpeaking();
            return;
        }

        if (!text || text.trim() === '') return;

        const cleanText = text
            .replace(/[🤲🏻✨💪🎯📈🌟⭐️🔥💎🚀📱💡🎪🎭🎨🏆🎊🎉]/g, '')
            .replace(/\*\*(.*?)\*\*/g, '$1')
            .replace(/\*(.*?)\*/g, '$1')
            .trim();

        if (!cleanText) return;

        this.currentUtterance = new SpeechSynthesisUtterance(cleanText);
        const bestVoice = this.getBestVoice();
        if (bestVoice) this.currentUtterance.voice = bestVoice;
        
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
        this.isInitialized = false;
        this.voiceManager = new VoiceManager(this);
        
        this.initDOMElements();
        this.initEventListeners();
        this.initApp();
    }

    getCurrentDay() {
        return this.currentDay || 1;
    }

    initDOMElements() {
        this.authModal = document.getElementById('auth-modal');
        this.loginForm = document.getElementById('login-form');
        this.registerForm = document.getElementById('register-form');
        this.chatMessages = document.querySelector('.chat-messages');
        this.messageInput = document.getElementById('message-input');
        this.userInfo = document.querySelector('.user-info');
        
        if (!this.chatMessages) console.warn('Element .chat-messages non trouvé');
        if (!this.messageInput) console.warn('Element #message-input non trouvé');
        if (!this.userInfo) console.warn('Element .user-info non trouvé');
    }

    initEventListeners() {
        this.setupNavigationListeners();
        this.setupAuthListeners();
        this.setupMessageListeners();
        this.setupVoiceListeners();
        this.setupKeyboardShortcuts();
    }

    setupNavigationListeners() {
        document.querySelectorAll('.day-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const day = parseInt(e.target.dataset.day);
                if (day >= 1 && day <= 15) {
                    this.switchToDay(day);
                }
            });
        });
    }

    setupAuthListeners() {
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

        document.addEventListener('click', (e) => {
            if (e.target.id === 'show-register') {
                this.showRegisterForm();
            } else if (e.target.id === 'show-login') {
                this.showLoginForm();
            }
        });

        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('logout-btn')) {
                this.logout();
            }
        });
    }

    setupMessageListeners() {
        if (this.messageInput) {
            this.messageInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.sendMessage();
                }
            });

            this.messageInput.addEventListener('input', function() {
                this.style.height = 'auto';
                this.style.height = Math.min(this.scrollHeight, 120) + 'px';
            });

            let draftTimer;
            this.messageInput.addEventListener('input', () => {
                clearTimeout(draftTimer);
                draftTimer = setTimeout(() => {
                    if (this.messageInput.value.trim()) {
                        localStorage.setItem('coachbot_message_draft', this.messageInput.value);
                    } else {
                        localStorage.removeItem('coachbot_message_draft');
                    }
                }, 1000);
            });
        }

        const sendBtn = document.getElementById('send-btn');
        if (sendBtn) {
            sendBtn.addEventListener('click', () => {
                this.sendMessage();
            });
        }
    }

    setupVoiceListeners() {
        const micBtn = document.getElementById('mic-btn');
        if (micBtn) {
            micBtn.addEventListener('click', () => {
                if (voiceClickTimeout) return;
                
                voiceClickTimeout = setTimeout(() => {
                    voiceClickTimeout = null;
                }, 1000);
                
                this.voiceManager.debounceToggleRecording();
            });
        }

        const speakerBtn = document.getElementById('speaker-btn');
        if (speakerBtn) {
            speakerBtn.addEventListener('click', () => {
                if (voiceClickTimeout) return;
                
                voiceClickTimeout = setTimeout(() => {
                    voiceClickTimeout = null;
                }, 1000);
                
                this.voiceManager.toggleSpeaker();
            });
        }
    }

    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'm') {
                e.preventDefault();
                this.voiceManager.debounceToggleRecording();
            }
            
            if ((e.ctrlKey || e.metaKey) && e.key === 'l') {
                e.preventDefault();
                this.voiceManager.toggleSpeaker();
            }
            
            if (e.key === 'Escape') {
                this.handleEscapeKey();
            }
        });
    }

    handleEscapeKey() {
        const authModal = document.getElementById('auth-modal');
        if (authModal && authModal.style.display !== 'none') {
            return;
        }
        
        const modals = document.querySelectorAll('.modal, .settings-modal');
        modals.forEach(modal => {
            if (modal.style.display !== 'none') {
                modal.style.display = 'none';
            }
        });

        if (this.voiceManager) {
            this.voiceManager.stopSpeaking();
            if (this.voiceManager.isRecording) {
                this.voiceManager.toggleRecording();
            }
        }
    }

    async initApp() {
        try {
            await this.checkServerConnection();
            this.updateUserInfo();
            this.loadMessages();
            this.restoreMessageDraft();
            
            setTimeout(() => {
                this.checkOnboarding();
            }, 2000);

            this.isInitialized = true;
            console.log('CoachBot initialisé avec succès');
            
        } catch (error) {
            console.error('Erreur initialisation CoachBot:', error);
            this.showFallbackInterface();
        }
    }

    async checkServerConnection() {
        try {
            if (!this.token) {
                this.activateLocalMode();
                return;
            }

            const response = await fetch('/api/user/profile', {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });

            if (response.ok) {
                const userData = await response.json();
                this.user = userData;
                this.serverMode = true;
                console.log('Mode serveur activé');
                await this.syncOnboardingToServer();
            } else {
                console.log('Erreur auth serveur, passage en mode local');
                this.activateLocalMode();
            }
        } catch (error) {
            console.error('Erreur connexion serveur:', error);
            this.activateLocalMode();
        }
    }

    activateLocalMode() {
        this.serverMode = false;
        this.user = JSON.parse(localStorage.getItem('coachbot_user')) || null;
        console.log('CoachBot initialisé en mode local');
    }

    async syncOnboardingToServer() {
        try {
            const onboardingData = localStorage.getItem('coachbot_onboarding');
            if (onboardingData && this.serverMode) {
                const profile = JSON.parse(onboardingData);
                
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
                    console.log('Données d\'onboarding synchronisées');
                }
            }
        } catch (error) {
            console.error('Erreur sync onboarding:', error);
        }
    }

    restoreMessageDraft() {
        if (this.messageInput) {
            const draft = localStorage.getItem('coachbot_message_draft');
            if (draft) {
                this.messageInput.value = draft;
                this.messageInput.style.height = 'auto';
                this.messageInput.style.height = Math.min(this.messageInput.scrollHeight, 120) + 'px';
            }

            setTimeout(() => {
                if (!this.authModal || this.authModal.style.display === 'none') {
                    this.messageInput.focus();
                }
            }, 2000);
        }
    }

    showFallbackInterface() {
        if (this.chatMessages && this.chatMessages.children.length === 0) {
            this.chatMessages.innerHTML = `
                <div class="message ai-message">
                    <div class="message-content" style="background: #f8d7da; color: #721c24; border-color: #f5c6cb;">
                        Erreur d'initialisation de CoachBot.<br><br>
                        <button onclick="location.reload()" style="background: #dc3545; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer;">
                            Recharger la page
                        </button>
                    </div>
                    <div class="message-time">${new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</div>
                </div>
            `;
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
                await this.syncOnboardingToServer();
                await this.showWelcomeMessage();
                
                console.log('Connexion réussie:', this.user.email);
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
                
                console.log('Inscription réussie:', this.user.email);
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
        
        if (this.chatMessages) {
            this.chatMessages.innerHTML = '';
        }
        
        console.log('Déconnexion effectuée');
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
        window.open('/onboarding.html', '_blank', 'width=800,height=600');
        
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
                    <div style="background: white; padding: 30px; border-radius: 15px; max-width: 500px; margin: 20px; box-shadow: 0 20px 40px rgba(0,0,0,0.2);">
                        <h2 style="margin-bottom: 20px; color: #333; text-align: center;">⚙️ Paramètres</h2>
                        
                        <div style="margin-bottom: 25px;">
                            <h3 style="color: #6366F1; margin-bottom: 15px; border-bottom: 2px solid #e9ecef; padding-bottom: 8px;">Profil utilisateur</h3>
                            <div style="display: grid; gap: 10px;">
                                <p><strong>Prénom:</strong> ${profile.prenom}</p>
                                <p><strong>Âge:</strong> ${profile.age} ans</p>
                                <p><strong>Objectif:</strong> ${profile.objectif}</p>
                                <p><strong>Style de coaching:</strong> ${profile.coachingStyle}</p>
                                <p><strong>Niveau actuel:</strong> ${profile.niveauActuel}/10</p>
                            </div>
                        </div>
                        
                        <div style="display: flex; gap: 10px; justify-content: center; flex-wrap: wrap;">
                            <button onclick="window.coachBot.redoOnboarding()" style="background: #6366F1; color: white; border: none; padding: 12px 20px; border-radius: 8px; cursor: pointer; font-weight: 600;">
                                🔄 Refaire l'onboarding
                            </button>
                            <button onclick="window.coachBot.exportData()" style="background: #28a745; color: white; border: none; padding: 12px 20px; border-radius: 8px; cursor: pointer; font-weight: 600;">
                                📥 Exporter mes données
                            </button>
                            <button onclick="window.coachBot.closeSettings()" style="background: #64748B; color: white; border: none; padding: 12px 20px; border-radius: 8px; cursor: pointer; font-weight: 600;">
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
        if (confirm('Êtes-vous sûr de vouloir refaire l\'onboarding ?')) {
            localStorage.removeItem('coachbot_onboarding');
            this.closeSettings();
            this.showOnboardingModal();
        }
    }

    closeSettings() {
        const modal = document.querySelector('.settings-modal');
        if (modal) modal.remove();
    }

    exportData() {
        try {
            const exportData = {
                user: this.user,
                onboarding: JSON.parse(localStorage.getItem('coachbot_onboarding') || '{}'),
                messages: {},
                exportDate: new Date().toISOString(),
                version: '2.0'
            };

            for (let day = 1; day <= 15; day++) {
                const messages = localStorage.getItem(`coachbot_day${day}`);
                if (messages) {
                    exportData.messages[`day${day}`] = JSON.parse(messages);
                }
            }

            const dataStr = JSON.stringify(exportData, null, 2);
            const dataBlob = new Blob([dataStr], { type: 'application/json' });
            const url = URL.createObjectURL(dataBlob);
            
            const link = document.createElement('a');
            link.href = url;
            link.download = `coachbot-export-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            
            alert('Vos données ont été exportées avec succès !');
        } catch (error) {
            console.error('Erreur lors de l\'export:', error);
            alert('Erreur lors de l\'export des données.');
        }
    }

    getMessageCount() {
        let total = 0;
        for (let day = 1; day <= 15; day++) {
            const messages = localStorage.getItem(`coachbot_day${day}`);
            if (messages) {
                try {
                    const parsed = JSON.parse(messages);
                    total += Array.isArray(parsed) ? parsed.length : 0;
                } catch (e) {
                    // Ignorer
                }
            }
        }
        return total;
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
            const timeGreeting = this.getTimeGreeting();
            welcomeMessage = `As-salāmu ʿalaykum ${profile.prenom} ! ${timeGreeting} Ravi de te retrouver ! Je me souviens que tu souhaites progresser sur l'amélioration de ta ${profile.objectif}. Comment s'est passée ta journée ?`;
        }

        this.addMessage(welcomeMessage, 'ai');
    }

    getTimeGreeting() {
        const hour = new Date().getHours();
        if (hour < 6) return "Masha'Allah, tu es matinal !";
        if (hour < 12) return "Bonjour et qu'Allah bénisse ta journée !";
        if (hour < 17) return "Bel après-midi !";
        if (hour < 21) return "Bonne soirée !";
        return "Bonne fin de soirée !";
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
                    console.log('Erreur serveur, chargement local');
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

        if (role === 'user') {
            localStorage.removeItem('coachbot_message_draft');
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
            
            if (this.serverMode) {
                console.log('Fallback vers sauvegarde locale');
                const messages = JSON.parse(localStorage.getItem(`coachbot_day${this.currentDay}`) || '[]');
                messages.push({
                    message,
                    role,
                    date: new Date().toISOString()
                });
                localStorage.setItem(`coachbot_day${this.currentDay}`, JSON.stringify(messages));
            }
        }
    }

    async sendMessage() {
        if (!this.messageInput) return;

        const message = this.messageInput.value.trim();
        if (!message) return;

        const sendBtn = document.getElementById('send-btn');
        if (sendBtn) {
            sendBtn.disabled = true;
            sendBtn.textContent = 'Envoi...';
        }

        this.addMessage(message, 'user');
        this.messageInput.value = '';
        this.messageInput.style.height = 'auto';

        try {
            if (this.serverMode) {
                await this.streamAIResponse(message);
            } else {
                await this.simulateAIResponse(message);
            }
        } catch (error) {
            console.error('Erreur envoi message:', error);
            
            if (this.serverMode) {
                console.log('Erreur serveur, basculement en mode local');
                this.serverMode = false;
                this.updateUserInfo();
                await this.simulateAIResponse(message);
            }
        } finally {
            if (sendBtn) {
                sendBtn.disabled = false;
                sendBtn.textContent = 'Envoyer';
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
            throw new Error(`Erreur serveur: ${response.status}`);
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

        try {
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
                            // Ignorer erreurs parsing JSON
                        }
                    }
                }
            }
        } catch (streamError) {
            console.error('Erreur pendant le streaming:', streamError);
            if (fullResponse) {
                this.saveMessage(fullResponse, 'ai');
            }
        } finally {
            this.currentStreamingMessage = null;
        }
    }

    async simulateAIResponse(message) {
        const onboardingData = localStorage.getItem('coachbot_onboarding');
        const userMessage = message.toLowerCase();
        this.messageCounter++;

        let responses = this.generateContextualResponses(onboardingData, userMessage);
        responses = responses.concat(this.generateKeywordResponses(userMessage));
        const selectedResponse = this.selectUniqueResponse(responses);
        
        await this.displayTypingResponse(selectedResponse);
    }

    generateContextualResponses(onboardingData, userMessage) {
        let responses = [];

        if (onboardingData) {
            const profile = JSON.parse(onboardingData);
            const style = profile.coachingStyle || 'bienveillant';
            
            switch (style) {
                case 'motivant':
                case 'direct':
                    responses = [
                        `Excellent ${profile.prenom} ! 💪 Je vois ta détermination pour améliorer ta ${profile.objectif}. Quelle micro-action vas-tu faire aujourd'hui ?`,
                        `Mashallah ${profile.prenom} ! 🌟 Sur une échelle de 1 à 10, comment évalues-tu ton niveau actuel ?`,
                        `Bravo ${profile.prenom} ! 🚀 Chaque pas compte. Quel défi veux-tu relever maintenant ?`,
                        `${profile.prenom}, j'aime ton état d'esprit ! Qu'as-tu fait concrètement aujourd'hui pour te rapprocher de ton objectif ?`
                    ];
                    break;
                    
                case 'structured':
                case 'equilibre':
                    responses = [
                        `Bonjour ${profile.prenom}. 📋 Analysons ta progression sur "${profile.objectif}". Donne-moi 3 éléments concrets de ta situation.`,
                        `${profile.prenom}, établissons un plan clair. 📊 Quels sont tes 3 leviers principaux et tes 3 obstacles ?`,
                        `Parfait ${profile.prenom}. 🎯 Définissons des critères mesurables. Que signifierait "réussir" pour toi ?`,
                        `Très bien ${profile.prenom}. Structurons notre approche : où en es-tu exactement aujourd'hui ?`
                    ];
                    break;
                    
                default:
                    responses = [
                        `Barakallahu fik ${profile.prenom} 🤲🏻. Je t'accompagne avec bienveillance. Comment te sens-tu aujourd'hui ?`,
                        `As-salāmu ʿalaykum ${profile.prenom} 🤲🏻. Prends ton temps, chaque étape compte. Quelle petite victoire peux-tu célébrer ?`,
                        `Qu'Allah facilite ton parcours ${profile.prenom} ✨. Raconte-moi comment ça se passe avec ta ${profile.objectif}.`,
                        `${profile.prenom}, je sens ta sincérité. Qu'est-ce qui te préoccupe aujourd'hui ?`
                    ];
            }
        } else {
            responses = [
                "As-salāmu ʿalaykum ! 🤲🏻 Pour mieux t'accompagner, dis-moi ton prénom et ton défi principal.",
                "Barakallahu fik ! Je suis là pour t'aider. Quel est ton objectif prioritaire ?",
                "Qu'Allah te facilite ! ✨ Chaque transformation commence par une intention claire. Quelle est la tienne ?",
                "Marhaban ! Je suis CoachBot. Comment puis-je t'aider aujourd'hui ?"
            ];
        }

        return responses;
    }

    generateKeywordResponses(userMessage) {
        const responses = [];
        
        if (userMessage.includes('niveau') || userMessage.includes('évalue')) {
            responses.push("Sur une échelle de 1 à 10, comment évalues-tu ton niveau actuel ? Et dis-moi ce qui te ferait passer au niveau supérieur.");
        }
        
        if (userMessage.includes('difficile') || userMessage.includes('obstacle')) {
            responses.push("Je comprends que ce soit difficile. 🤲🏻 Identifions le plus petit pas possible. Quelle micro-action de 10 minutes ?");
        }
        
        if (userMessage.includes('oui') || userMessage.includes('d\'accord') || userMessage.includes('ok')) {
            responses.push("Excellent ! 🌟 Fixons un critère de réussite concret. Comment saurais-tu que tu as progressé d'ici ce soir ?");
        }
        
        if (userMessage.includes('motivation') || userMessage.includes('envie')) {
            responses.push("La motivation fluctue, c'est normal. Mais les habitudes restent. Quelle habitude simple peux-tu mettre en place ?");
        }
        
        if (userMessage.includes('temps') || userMessage.includes('occupé')) {
            responses.push("Le temps est précieux. Mais même 5 minutes comptent ! Quelle micro-action de 5 minutes maintenant ?");
        }
        
        if (userMessage.includes('merci') || userMessage.includes('barakallahu')) {
            responses.push("Wa fiki barakallahu ! 🤲🏻 C'est un plaisir de t'accompagner. Reste concentré, tu peux y arriver bi-idhnillah !");
        }

        return responses;
    }

    selectUniqueResponse(responses) {
        const usedKey = `used_responses_day${this.currentDay}`;
        const usedResponses = JSON.parse(localStorage.getItem(usedKey) || '[]');
        const availableResponses = responses.filter(r => !usedResponses.includes(r));
        
        let selectedResponse;
        if (availableResponses.length > 0) {
            selectedResponse = availableResponses[Math.floor(Math.random() * availableResponses.length)];
            usedResponses.push(selectedResponse);
            localStorage.setItem(usedKey, JSON.stringify(usedResponses.slice(-10)));
        } else {
            selectedResponse = responses[Math.floor(Math.random() * responses.length)];
            localStorage.setItem(usedKey, JSON.stringify([selectedResponse]));
        }
        
        return selectedResponse;
    }

    async displayTypingResponse(responseText) {
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
            
            contentDiv.innerHTML = '<span class="typing-indicator">CoachBot écrit...</span>';
            this.scrollToBottom();
            
            await new Promise(resolve => setTimeout(resolve, 800));
            
            contentDiv.textContent = '';
            let i = 0;
            const typeWriter = () => {
                if (i < responseText.length) {
                    contentDiv.textContent += responseText.charAt(i);
                    i++;
                    this.scrollToBottom();
                    setTimeout(typeWriter, Math.random() * 50 + 20);
                } else {
                    this.saveMessage(responseText, 'ai');
                }
            };
            
            typeWriter();
        }
    }

    getLastAiMessage() {
        if (!this.chatMessages) return null;
        
        const aiMessages = this.chatMessages.querySelectorAll('.ai-message .message-content');
        if (aiMessages.length > 0) {
            const lastMessage = aiMessages[aiMessages.length - 1].textContent;
            return lastMessage.includes('CoachBot écrit') ? null : lastMessage;
        }
        
        return null;
    }

    scrollToBottom() {
        if (this.chatMessages) {
            requestAnimationFrame(() => {
                this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
            });
        }
    }

    clearCurrentDayMessages() {
        if (confirm(`Effacer tous les messages du jour ${this.currentDay} ?`)) {
            if (this.chatMessages) {
                this.chatMessages.innerHTML = '';
            }
            
            localStorage.removeItem(`coachbot_day${this.currentDay}`);
            
            if (this.serverMode) {
                fetch(`/api/chat/clear?day=${this.currentDay}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${this.token}` }
                }).catch(console.error);
            }
            
            console.log(`Messages du jour ${this.currentDay} effacés`);
        }
    }

    searchMessages(query) {
        if (!query || !this.chatMessages) return;
        
        const messages = this.chatMessages.querySelectorAll('.message-content');
        let found = false;
        
        messages.forEach(msg => {
            const text = msg.textContent.toLowerCase();
            const searchQuery = query.toLowerCase();
            
            if (text.includes(searchQuery)) {
                msg.style.backgroundColor = '#fff3cd';
                msg.style.border = '2px solid #ffc107';
                found = true;
            } else {
                msg.style.backgroundColor = '';
                msg.style.border = '';
            }
        });
        
        if (!found) {
            alert(`Aucun message trouvé contenant "${query}"`);
        } else {
            const firstResult = document.querySelector('.message-content[style*="background-color"]');
            if (firstResult) {
                firstResult.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }
    }
}

// Fonctions globales
function toggleVoice() {
    if (window.coachBot && window.coachBot.voiceManager) {
        window.coachBot.voiceManager.debounceToggleRecording();
    } else {
        console.warn('VoiceManager non disponible');
        alert('Le système vocal n\'est pas encore initialisé. Patientez quelques secondes.');
    }
}

function stopSpeaking() {
    if (window.coachBot && window.coachBot.voiceManager) {
        window.coachBot.voiceManager.toggleSpeaker();
    } else {
        console.warn('VoiceManager non disponible');
        alert('Le système vocal n\'est pas encore initialisé. Patientez quelques secondes.');
    }
}

function showSettings() {
    if (window.coachBot) {
        window.coachBot.showSettings();
    } else {
        console.warn('CoachBot non disponible');
        alert('CoachBot n\'est pas encore initialisé. Patientez quelques secondes.');
    }
}

function clearMessages() {
    if (window.coachBot) {
        window.coachBot.clearCurrentDayMessages();
    }
}

function searchInMessages() {
    const query = prompt('Rechercher dans les messages:');
    if (query && window.coachBot) {
        window.coachBot.searchMessages(query);
    }
}

// Gestion réseau
function updateConnectionStatus(status) {
    const statusElement = document.getElementById('connection-status');
    const textElement = document.getElementById('connection-text');
    
    if (statusElement && textElement) {
        statusElement.className = `connection-status ${status}`;
        
        switch (status) {
            case 'online':
                textElement.textContent = '🟢 En ligne';
                statusElement.style.display = 'none';
                break;
            case 'offline':
                textElement.textContent = '🔴 Hors ligne';
                statusElement.style.display = 'block';
                break;
            case 'connecting':
                textElement.textContent = '🟡 Connexion...';
                statusElement.style.display = 'block';
                break;
        }
    }
}

function updateNetworkStatus() {
    if (navigator.onLine) {
        updateConnectionStatus('connecting');
        fetch('/healthz', { method: 'HEAD', cache: 'no-cache' })
            .then(() => updateConnectionStatus('online'))
            .catch(() => updateConnectionStatus('offline'));
    } else {
        updateConnectionStatus('offline');
    }
}

function applyTheme(themeName) {
    document.body.className = document.body.className.replace(/theme-\w+/g, '');
    if (themeName && themeName !== 'default') {
        document.body.classList.add(`theme-${themeName}`);
    }
    localStorage.setItem('coachbot_theme', themeName);
}

// Gestion événements réseau
window.addEventListener('online', () => {
    console.log('Connexion rétablie');
    updateNetworkStatus();
    if (window.coachBot && !window.coachBot.serverMode && window.coachBot.token) {
        window.coachBot.checkServerConnection();
    }
});

window.addEventListener('offline', () => {
    console.log('Connexion perdue');
    updateNetworkStatus();
});

// Gestion audio contextuelle
document.addEventListener('visibilitychange', () => {
    if (document.hidden && window.coachBot && window.coachBot.voiceManager) {
        window.coachBot.voiceManager.stopSpeaking();
    }
});

// Protection erreurs critiques
window.addEventListener('error', (event) => {
    console.error('Erreur JavaScript critique:', event.error);
    
    if (!window.coachBot || !window.coachBot.isInitialized) {
        const chatMessages = document.querySelector('.chat-messages');
        if (chatMessages && chatMessages.children.length === 0) {
            chatMessages.innerHTML = `
                <div class="message ai-message">
                    <div class="message-content" style="background: #f8d7da; color: #721c24; border-color: #f5c6cb;">
                        ⚠️ Erreur d'initialisation de CoachBot.<br><br>
                        <button onclick="location.reload()" style="background: #dc3545; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer;">
                            Recharger la page
                        </button>
                    </div>
                    <div class="message-time">${new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</div>
                </div>
            `;
        }
    }
});

// Diagnostic système
function runDiagnostic() {
    console.group('🔍 Diagnostic CoachBot');
    
    console.log('CoachBot initialisé:', !!window.coachBot);
    console.log('Mode serveur:', window.coachBot?.serverMode || false);
    console.log('Utilisateur connecté:', !!window.coachBot?.user);
    console.log('Jour actuel:', window.coachBot?.currentDay || 'N/A');
    
    console.log('Reconnaissance vocale:', 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window);
    console.log('Synthèse vocale:', 'speechSynthesis' in window);
    console.log('LocalStorage:', 'localStorage' in window);
    console.log('Fetch API:', 'fetch' in window);
    
    console.log('En ligne:', navigator.onLine);
    
    const onboarding = localStorage.getItem('coachbot_onboarding');
    console.log('Onboarding complété:', !!onboarding);
    
    if (window.coachBot) {
        console.log('Messages sauvegardés:', window.coachBot.getMessageCount());
    }
    
    console.groupEnd();
}

// Raccourcis avancés
document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.shiftKey && e.key === 'D') {
        e.preventDefault();
        runDiagnostic();
    }
    
    if (e.ctrlKey && e.shiftKey && e.key === 'C') {
        e.preventDefault();
        clearMessages();
    }
    
    if (e.ctrlKey && e.key === 'f' && !e.shiftKey) {
        const focused = document.activeElement;
        if (focused && focused.closest('.chat-messages')) {
            e.preventDefault();
            searchInMessages();
        }
    }
});

// Initialisation principale
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Initialisation de CoachBot...');
    
    try {
        window.coachBot = new CoachBot();
        console.log('✅ CoachBot initialisé avec succès');
        
        setTimeout(() => {
            if (window.speechSynthesis) {
                const voices = window.speechSynthesis.getVoices();
                console.log(`${voices.length} voix disponibles`);
                
                if (voices.length === 0) {
                    window.speechSynthesis.onvoiceschanged = () => {
                        const newVoices = window.speechSynthesis.getVoices();
                        console.log(`${newVoices.length} voix chargées`);
                    };
                }
            }
        }, 1000);
        
        // Restaurer thème sauvegardé
        const savedTheme = localStorage.getItem('coachbot_theme');
        if (savedTheme) {
            applyTheme(savedTheme);
        }
        
        // Test connexion réseau
        setTimeout(updateNetworkStatus, 1000);
        
    } catch (error) {
        console.error('❌ Erreur lors de l\'initialisation:', error);
        
        const chatMessages = document.querySelector('.chat-messages');
        if (chatMessages) {
            chatMessages.innerHTML = `
                <div class="message ai-message">
                    <div class="message-content" style="background: #f8d7da; color: #721c24; border-color: #f5c6cb;">
                        ⚠️ Erreur critique: ${error.message}<br><br>
                        <button onclick="location.reload()" style="background: #dc3545; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer;">
                            Recharger la page
                        </button>
                    </div>
                    <div class="message-time">${new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</div>
                </div>
            `;
        }
    }
});

// Message de succès
window.addEventListener('load', () => {
    console.log(`
🚀 CoachBot Interface v2.0 - Chargé avec succès !

✅ Corrections appliquées :
   - Erreur 'login' identifier corrigée
   - Erreur 'voiceClickTimeout' duplicate résolue
   - Design moderne avec animations fluides
   - Responsive optimisé mobile/desktop
   - Reconnaissance vocale avec debounce
   - Sauvegarde automatique brouillons
   - Protection erreurs critiques

🎮 Raccourcis :
   - Ctrl+M : Micro
   - Ctrl+L : Lecture
   - Ctrl+Shift+D : Diagnostic
   - Ctrl+Shift+C : Effacer messages
   - Échap : Arrêter vocal

🤲🏻 Bi-idhnillah, l'interface est prête !
    `);
});

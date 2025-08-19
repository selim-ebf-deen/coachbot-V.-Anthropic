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
  
  // En production, envoyer vers service de monitoring
  if (window.location.hostname !== 'localhost') {
    // TODO: Intégrer avec service externe (Sentry, LogRocket, etc.)
  }
}

// 🎤 VOICE MANAGER AMÉLIORÉ
class VoiceManager {
    constructor(app) {
        this.app = app;
        this.isRecording = false;
        this.isPlaying = false;
        this.recognition = null;
        this.synthesis = window.speechSynthesis;
        this.currentUtterance = null;
        this.isSupported = this.checkSupport();
        this.retryCount = 0;
        this.maxRetries = 3;
        
        if (this.isSupported) {
            this.initRecognition();
            this.loadVoices();
        } else {
            console.warn('Fonctionnalités vocales non supportées sur ce navigateur');
        }
    }

    checkSupport() {
        const hasRecognition = 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;
        const hasSynthesis = 'speechSynthesis' in window;
        
        return {
            recognition: hasRecognition,
            synthesis: hasSynthesis,
            full: hasRecognition && hasSynthesis
        };
    }

    loadVoices() {
        // Charger les voix avec retry
        const loadVoicesWithRetry = () => {
            const voices = this.synthesis.getVoices();
            if (voices.length === 0 && this.retryCount < this.maxRetries) {
                this.retryCount++;
                setTimeout(loadVoicesWithRetry, 100);
            } else {
                this.availableVoices = voices;
                console.log(`Voix chargées: ${voices.length} disponibles`);
            }
        };

        // Écouter l'événement de chargement des voix
        if (this.synthesis.onvoiceschanged !== undefined) {
            this.synthesis.onvoiceschanged = loadVoicesWithRetry;
        }
        
        // Tentative immédiate
        loadVoicesWithRetry();
    }

    initRecognition() {
        if (!this.isSupported.recognition) return;

        try {
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            this.recognition = new SpeechRecognition();
            this.recognition.continuous = false;
            this.recognition.interimResults = true;
            this.recognition.lang = 'fr-FR';
            this.recognition.maxAlternatives = 1;

            this.recognition.onstart = () => {
                this.isRecording = true;
                this.updateMicButton();
                this.showInterimResult('🎤 Écoute en cours...');
                logError('voice_recording_started', 'success');
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

                if (finalTranscript && finalTranscript.trim()) {
                    if (this.app.messageInput) {
                        this.app.messageInput.value = finalTranscript.trim();
                        this.hideInterimResult();
                        // Auto-send après reconnaissance
                        setTimeout(() => this.app.sendMessage(), 500);
                    }
                    logError('voice_recognition_success', 'success', { transcript: finalTranscript });
                }
            };

            this.recognition.onerror = (event) => {
                logError('voice_recognition_error', event.error, { 
                    error: event.error, 
                    message: event.message 
                });
                
                this.isRecording = false;
                this.updateMicButton();
                this.hideInterimResult();
                
                let errorMessage = 'Erreur de reconnaissance vocale';
                switch (event.error) {
                    case 'not-allowed':
                    case 'permission-denied':
                        errorMessage = 'Veuillez autoriser l\'accès au microphone dans les paramètres de votre navigateur.';
                        break;
                    case 'no-speech':
                        errorMessage = 'Aucun son détecté. Veuillez parler plus fort.';
                        break;
                    case 'network':
                        errorMessage = 'Erreur réseau. Vérifiez votre connexion internet.';
                        break;
                    case 'audio-capture':
                        errorMessage = 'Microphone non accessible. Vérifiez qu\'il n\'est pas utilisé par une autre application.';
                        break;
                }
                
                this.showTemporaryMessage(errorMessage, 'error');
            };

            this.recognition.onend = () => {
                this.isRecording = false;
                this.updateMicButton();
                this.hideInterimResult();
            };

        } catch (error) {
            logError('voice_recognition_init_error', error);
            this.isSupported.recognition = false;
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
                background: rgba(0,0,0,0.9);
                color: white;
                padding: 20px 30px;
                border-radius: 15px;
                z-index: 10000;
                font-size: 16px;
                text-align: center;
                min-width: 250px;
                box-shadow: 0 10px 30px rgba(0,0,0,0.5);
                backdrop-filter: blur(10px);
                border: 2px solid rgba(255,255,255,0.1);
            `;
            document.body.appendChild(interim);
        }
        interim.textContent = text;
    }

    hideInterimResult() {
        const interim = document.getElementById('interim-result');
        if (interim) {
            interim.style.opacity = '0';
            setTimeout(() => interim.remove(), 300);
        }
    }

    showTemporaryMessage(text, type = 'info') {
        const messageDiv = document.createElement('div');
        messageDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${type === 'error' ? '#dc3545' : '#28a745'};
            color: white;
            padding: 15px 20px;
            border-radius: 8px;
            z-index: 10001;
            font-size: 14px;
            max-width: 300px;
            box-shadow: 0 5px 15px rgba(0,0,0,0.3);
            animation: slideIn 0.3s ease;
        `;
        
        // Animation CSS
        if (!document.getElementById('temp-message-style')) {
            const style = document.createElement('style');
            style.id = 'temp-message-style';
            style.textContent = `
                @keyframes slideIn {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
                @keyframes slideOut {
                    from { transform: translateX(0); opacity: 1; }
                    to { transform: translateX(100%); opacity: 0; }
                }
            `;
            document.head.appendChild(style);
        }
        
        messageDiv.textContent = text;
        document.body.appendChild(messageDiv);
        
        setTimeout(() => {
            messageDiv.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => messageDiv.remove(), 300);
        }, 4000);
    }

    updateMicButton() {
        const micBtn = document.getElementById('mic-btn');
        if (micBtn) {
            if (this.isRecording) {
                micBtn.style.background = 'linear-gradient(135deg, #dc3545 0%, #c82333 100%)';
                micBtn.innerHTML = '⏹️';
                micBtn.title = 'Arrêter l\'enregistrement';
                micBtn.classList.add('recording');
            } else {
                micBtn.style.background = 'linear-gradient(135deg, #28a745 0%, #20c997 100%)';
                micBtn.innerHTML = '🎤';
                micBtn.title = 'Commencer l\'enregistrement vocal';
                micBtn.classList.remove('recording');
            }
        }
    }

    updateSpeakerButton() {
        const speakerBtn = document.getElementById('speaker-btn');
        if (speakerBtn) {
            if (this.isPlaying) {
                speakerBtn.style.background = 'linear-gradient(135deg, #dc3545 0%, #c82333 100%)';
                speakerBtn.innerHTML = '⏹️';
                speakerBtn.title = 'Arrêter la lecture';
                speakerBtn.classList.add('playing');
            } else {
                speakerBtn.style.background = 'linear-gradient(135deg, #17a2b8 0%, #6f42c1 100%)';
                speakerBtn.innerHTML = '🔊';
                speakerBtn.title = 'Lire le dernier message';
                speakerBtn.classList.remove('playing');
            }
        }
    }

    toggleRecording() {
        if (!this.isSupported.recognition) {
            this.showTemporaryMessage('Reconnaissance vocale non supportée par votre navigateur.', 'error');
            return;
        }

        if (this.isRecording) {
            try {
                this.recognition.stop();
            } catch (error) {
                logError('voice_stop_error', error);
                this.isRecording = false;
                this.updateMicButton();
            }
        } else {
            try {
                this.recognition.start();
            } catch (error) {
                logError('voice_start_error', error);
                this.showTemporaryMessage('Impossible de démarrer la reconnaissance vocale.', 'error');
            }
        }
    }

    getBestVoice() {
        if (!this.availableVoices || this.availableVoices.length === 0) {
            return null;
        }
        
        // Priorité aux voix françaises de qualité
        const preferredVoices = [
            'Microsoft Hortense - French (France)',
            'Google français',
            'French (France)',
            'Amélie',
            'Thomas'
        ];

        for (const preferred of preferredVoices) {
            const voice = this.availableVoices.find(v => 
                v.name.includes(preferred) || 
                (v.lang.includes('fr-FR') && v.name.includes(preferred))
            );
            if (voice) return voice;
        }

        // Fallback vers n'importe quelle voix française
        const frenchVoice = this.availableVoices.find(v => v.lang.startsWith('fr'));
        if (frenchVoice) return frenchVoice;
        
        // Dernière option: première voix disponible
        return this.availableVoices[0] || null;
    }

    speakText(text) {
        if (!this.isSupported.synthesis) {
            this.showTemporaryMessage('Synthèse vocale non supportée.', 'error');
            return;
        }

        if (this.isPlaying) {
            this.stopSpeaking();
            return;
        }

        if (!text || text.trim() === '') {
            this.showTemporaryMessage('Aucun texte à lire.', 'error');
            return;
        }

        try {
            // Nettoyer le texte des émoticônes et caractères spéciaux
            const cleanText = text
                .replace(/[🤲🏻✨💪🎯📈🌟⭐️🔥💎🚀📱💡🎪🎭🎨🎯🏆🎊🎉👤👥📊📝🔗🔐🤖🗃️📁⚙️👑🛡️🚫📊👑]/g, '')
                .replace(/\*\*(.*?)\*\*/g, '$1')
                .replace(/\*(.*?)\*/g, '$1')
                .replace(/#{1,6}\s/g, '') // Enlever les # markdown
                .replace(/\[.*?\]/g, '') // Enlever les [texte]
                .replace(/\(.*?\)/g, '') // Enlever les (texte) courts
                .replace(/\s+/g, ' ')
                .trim();

            if (!cleanText) {
                this.showTemporaryMessage('Texte vide après nettoyage.', 'error');
                return;
            }

            // Limiter la longueur pour éviter les textes trop longs
            const maxLength = 500;
            const textToSpeak = cleanText.length > maxLength 
                ? cleanText.substring(0, maxLength) + "..."
                : cleanText;

            this.currentUtterance = new SpeechSynthesisUtterance(textToSpeak);
            
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
                logError('speech_started', 'success', { textLength: textToSpeak.length });
            };

            this.currentUtterance.onend = () => {
                this.isPlaying = false;
                this.updateSpeakerButton();
                this.currentUtterance = null;
                logError('speech_ended', 'success');
            };

            this.currentUtterance.onerror = (event) => {
                logError('speech_error', event.error, { error: event.error });
                this.isPlaying = false;
                this.updateSpeakerButton();
                this.currentUtterance = null;
                this.showTemporaryMessage('Erreur lors de la lecture vocale.', 'error');
            };

            // Vérifier que la synthèse n'est pas déjà en cours
            if (this.synthesis.speaking) {
                this.synthesis.cancel();
            }

            this.synthesis.speak(this.currentUtterance);

        } catch (error) {
            logError('speech_synthesis_error', error);
            this.showTemporaryMessage('Erreur de synthèse vocale.', 'error');
            this.isPlaying = false;
            this.updateSpeakerButton();
        }
    }

    stopSpeaking() {
        try {
            if (this.synthesis.speaking || this.isPlaying) {
                this.synthesis.cancel();
                this.isPlaying = false;
                this.updateSpeakerButton();
                this.currentUtterance = null;
                logError('speech_stopped', 'success');
            }
        } catch (error) {
            logError('speech_stop_error', error);
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
                this.showTemporaryMessage('Aucun message à lire.', 'error');
            }
        }
    }

    // Cleanup pour éviter les fuites mémoire
    destroy() {
        try {
            if (this.recognition) {
                this.recognition.stop();
                this.recognition = null;
            }
            
            if (this.synthesis && this.synthesis.speaking) {
                this.synthesis.cancel();
            }
            
            this.hideInterimResult();
            
            const tempStyle = document.getElementById('temp-message-style');
            if (tempStyle) {
                tempStyle.remove();
            }
            
        } catch (error) {
            logError('voice_manager_destroy_error', error);
        }
    }
}

// CoachBot Frontend - PARTIE 2/3 - Classe CoachBot améliorée
// COLLER APRÈS LA PARTIE 1

class CoachBot {
    constructor() {
        this.currentDay = 1;
        this.serverMode = false;
        this.user = null;
        this.token = localStorage.getItem('coachbot_token');
        this.currentStreamingMessage = null;
        this.messageHistory = [];
        this.messageCounter = 0;
        this.connectionRetries = 0;
        this.maxRetries = 3;
        this.isInitialized = false;
        
        // Initialiser de manière sécurisée
        this.safeInit();
    }

    async safeInit() {
        try {
            this.initDOMElements();
            this.initEventListeners();
            await this.initApp();
            this.isInitialized = true;
            logError('coachbot_initialized', 'success');
        } catch (error) {
            logError('coachbot_init_error', error);
            this.showErrorMessage('Erreur d\'initialisation de CoachBot');
        }
    }

    initDOMElements() {
        // Vérifier et initialiser les éléments du DOM de manière sécurisée
        const elements = {
            authModal: '#auth-modal',
            loginForm: '#login-form',
            registerForm: '#register-form',
            chatMessages: '.chat-messages',
            messageInput: '#message-input',
            userInfo: '.user-info',
            sendBtn: '#send-btn',
            micBtn: '#mic-btn',
            speakerBtn: '#speaker-btn'
        };

        Object.entries(elements).forEach(([key, selector]) => {
            this[key] = document.querySelector(selector);
            if (!this[key]) {
                console.warn(`Element ${selector} non trouvé`);
            }
        });

        // Vérifications critiques
        if (!this.chatMessages) {
            throw new Error('Element .chat-messages critique manquant');
        }
        if (!this.messageInput) {
            throw new Error('Element #message-input critique manquant');
        }
    }

    initEventListeners() {
        try {
            // Navigation des jours
            document.querySelectorAll('.day-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    const day = parseInt(e.target.dataset.day);
                    if (day && day >= 1 && day <= 15) {
                        this.switchToDay(day);
                    }
                });
            });

            // Formulaires d'authentification
            if (this.loginForm) {
                this.loginForm.addEventListener('submit', (e) => {
                    e.preventDefault();
                    this.handleLogin(e);
                });
            }

            if (this.registerForm) {
                this.registerForm.addEventListener('submit', (e) => {
                    e.preventDefault();
                    this.handleRegister(e);
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

                // Auto-resize textarea
                this.messageInput.addEventListener('input', (e) => {
                    e.target.style.height = 'auto';
                    e.target.style.height = (e.target.scrollHeight) + 'px';
                });
            }

            // Bouton envoi
            if (this.sendBtn) {
                this.sendBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.sendMessage();
                });
            }

            // Bouton déconnexion
            document.addEventListener('click', (e) => {
                if (e.target.classList.contains('logout-btn')) {
                    e.preventDefault();
                    this.logout();
                }
            });

            // Commutateurs auth modal
            document.addEventListener('click', (e) => {
                if (e.target.id === 'show-register') {
                    e.preventDefault();
                    this.showRegisterForm();
                } else if (e.target.id === 'show-login') {
                    e.preventDefault();
                    this.showLoginForm();
                }
            });

            // Boutons vocaux avec gestion d'erreurs
            if (this.micBtn) {
                this.micBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    try {
                        if (this.voiceManager) {
                            this.voiceManager.toggleRecording();
                        } else {
                            this.showErrorMessage('Gestionnaire vocal non disponible');
                        }
                    } catch (error) {
                        logError('mic_button_error', error);
                    }
                });
            }

            if (this.speakerBtn) {
                this.speakerBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    try {
                        if (this.voiceManager) {
                            this.voiceManager.toggleSpeaker();
                        } else {
                            this.showErrorMessage('Gestionnaire vocal non disponible');
                        }
                    } catch (error) {
                        logError('speaker_button_error', error);
                    }
                });
            }

            // Gestion des erreurs réseau
            window.addEventListener('online', () => {
                logError('connection_restored', 'success');
                this.showSuccessMessage('Connexion rétablie');
                this.checkServerConnection();
            });

            window.addEventListener('offline', () => {
                logError('connection_lost', 'warning');
                this.showErrorMessage('Connexion internet perdue');
                this.activateLocalMode();
            });

            // Nettoyage avant fermeture
            window.addEventListener('beforeunload', () => {
                this.cleanup();
            });

        } catch (error) {
            logError('event_listeners_init_error', error);
            throw error;
        }
    }

    async initApp() {
        try {
            await this.checkServerConnection();
            this.updateUserInfo();
            await this.loadMessages();
            
            // Initialiser le gestionnaire vocal après un délai
            setTimeout(() => {
                try {
                    this.voiceManager = new VoiceManager(this);
                    logError('voice_manager_initialized', 'success');
                } catch (error) {
                    logError('voice_manager_init_error', error);
                    console.warn('VoiceManager non disponible:', error.message);
                }
            }, 1000);
            
            // Vérifier onboarding après 2 secondes
            setTimeout(() => {
                this.checkOnboarding();
            }, 2000);
            
        } catch (error) {
            logError('app_init_error', error);
            throw error;
        }
    }

    async checkServerConnection() {
        try {
            if (!this.token) {
                this.activateLocalMode();
                return;
            }

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

            const response = await fetch('/api/user/profile', {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                },
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (response.ok) {
                const userData = await response.json();
                this.user = userData;
                this.serverMode = true;
                this.connectionRetries = 0;
                
                // Synchroniser l'onboarding si connecté
                await this.syncOnboardingToServer();
                logError('server_connection_success', 'success');
                
            } else if (response.status === 401) {
                // Token expiré
                this.clearAuthData();
                this.activateLocalMode();
                logError('token_expired', 'warning');
            } else {
                throw new Error(`Erreur serveur: ${response.status}`);
            }
        } catch (error) {
            logError('server_connection_error', error, { retries: this.connectionRetries });
            
            if (this.connectionRetries < this.maxRetries) {
                this.connectionRetries++;
                // Retry avec backoff exponentiel
                setTimeout(() => this.checkServerConnection(), 1000 * this.connectionRetries);
            } else {
                this.activateLocalMode();
            }
        }
    }

    async syncOnboardingToServer() {
        if (!this.serverMode) return;

        try {
            const onboardingData = localStorage.getItem('coachbot_onboarding');
            if (onboardingData) {
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
                    logError('onboarding_synced', 'success');
                    
                    // Sauvegarder profil complet dans journal
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
            logError('onboarding_sync_error', error);
        }
    }

    activateLocalMode() {
        this.serverMode = false;
        this.user = JSON.parse(localStorage.getItem('coachbot_user')) || null;
        logError('local_mode_activated', 'info');
        console.log('CoachBot initialisé en mode local');
        this.updateUserInfo();
    }

    clearAuthData() {
        localStorage.removeItem('coachbot_token');
        localStorage.removeItem('coachbot_user');
        this.token = null;
        this.user = null;
    }

    updateUserInfo() {
        if (!this.userInfo) return;

        try {
            const onboardingData = localStorage.getItem('coachbot_onboarding');
            let displayName = 'Utilisateur';
            let configBadge = '';
            
            if (onboardingData) {
                const profile = JSON.parse(onboardingData);
                displayName = sanitizeHTML(profile.prenom || 'Utilisateur');
                configBadge = '<span class="config-badge">✨ Configuré</span>';
            } else if (this.user?.name) {
                displayName = sanitizeHTML(this.user.name);
            }

            const modeIndicator = this.serverMode ? '🟢 Serveur' : '🔴 Local';
            const adminBadge = this.user?.role === 'admin' ? '<span class="admin-badge">👑 Admin</span>' : '';
            
            this.userInfo.innerHTML = `
                <div>
                    <strong>${displayName}</strong> ${adminBadge} ${configBadge}
                    <div class="mode-indicator">${modeIndicator}</div>
                </div>
            `;
            
        } catch (error) {
            logError('update_user_info_error', error);
            this.userInfo.innerHTML = '<div><strong>Erreur</strong></div>';
        }
    }

    checkOnboarding() {
        const onboardingData = localStorage.getItem('coachbot_onboarding');
        if (!onboardingData) {
            this.showOnboardingModal();
        }
    }

    showOnboardingModal() {
        try {
            // Ouvrir l'onboarding dans un nouvel onglet
            const onboardingWindow = window.open('/onboarding', '_blank', 'width=800,height=600');
            
            if (!onboardingWindow) {
                // Si popup bloqué, rediriger dans le même onglet
                this.showErrorMessage('Popup bloqué. Redirection vers l\'onboarding...');
                setTimeout(() => {
                    window.location.href = '/onboarding';
                }, 2000);
                return;
            }
            
            // Vérifier périodiquement si l'onboarding est terminé
            const checkInterval = setInterval(() => {
                try {
                    if (onboardingWindow.closed) {
                        clearInterval(checkInterval);
                        return;
                    }
                    
                    const onboardingData = localStorage.getItem('coachbot_onboarding');
                    if (onboardingData) {
                        clearInterval(checkInterval);
                        onboardingWindow.close();
                        this.updateUserInfo();
                        this.showSuccessMessage('Profil configuré avec succès !');
                        // Recharger pour synchroniser
                        setTimeout(() => location.reload(), 1000);
                    }
                } catch (error) {
                    // Ignorer les erreurs de cross-origin
                }
            }, 1000);
            
            // Nettoyer l'intervalle après 5 minutes
            setTimeout(() => {
                clearInterval(checkInterval);
            }, 5 * 60 * 1000);
            
        } catch (error) {
            logError('onboarding_modal_error', error);
            this.showErrorMessage('Impossible d\'ouvrir l\'onboarding');
        }
    }

    showSettings() {
        try {
            const onboardingData = localStorage.getItem('coachbot_onboarding');
            
            if (onboardingData) {
                const profile = JSON.parse(onboardingData);
                const modalContent = `
                    <div class="settings-modal" style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); z-index: 10000; display: flex; align-items: center; justify-content: center;">
                        <div style="background: white; padding: 30px; border-radius: 15px; max-width: 500px; margin: 20px; max-height: 80vh; overflow-y: auto;">
                            <h2 style="margin-bottom: 20px; color: #333;">⚙️ Paramètres</h2>
                            
                            <div style="margin-bottom: 20px;">
                                <h3 style="color: #6366F1; margin-bottom: 10px;">Profil utilisateur</h3>
                                <p><strong>Prénom:</strong> ${sanitizeHTML(profile.prenom || 'Non défini')}</p>
                                <p><strong>Âge:</strong> ${sanitizeHTML(profile.age || 'Non défini')} ans</p>
                                <p><strong>Objectif:</strong> ${sanitizeHTML(profile.objectif || 'Non défini')}</p>
                                <p><strong>Style de coaching:</strong> ${sanitizeHTML(profile.coachingStyle || 'Non défini')}</p>
                                <p><strong>Niveau actuel:</strong> ${sanitizeHTML(profile.niveauActuel || 'Non défini')}/10</p>
                            </div>
                            
                            <div style="margin-bottom: 20px;">
                                <h3 style="color: #6366F1; margin-bottom: 10px;">État de la connexion</h3>
                                <p><strong>Mode:</strong> ${this.serverMode ? '🟢 Serveur connecté' : '🔴 Mode local'}</p>
                                <p><strong>Fonctions vocales:</strong> ${this.voiceManager?.isSupported?.full ? '✅ Disponibles' : '❌ Non supportées'}</p>
                            </div>
                            
                            <div style="display: flex; gap: 10px; justify-content: center; flex-wrap: wrap;">
                                <button onclick="window.coachBot.redoOnboarding()" style="background: #6366F1; color: white; border: none; padding: 10px 20px; border-radius: 8px; cursor: pointer;">
                                    🔄 Refaire l'onboarding
                                </button>
                                <button onclick="window.coachBot.clearLocalData()" style="background: #dc3545; color: white; border: none; padding: 10px 20px; border-radius: 8px; cursor: pointer;">
                                    🗑️ Effacer données locales
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
                this.showErrorMessage('Aucun profil configuré. Redirection vers l\'onboarding...');
                setTimeout(() => this.showOnboardingModal(), 1000);
            }
        } catch (error) {
            logError('show_settings_error', error);
            this.showErrorMessage('Erreur lors de l\'ouverture des paramètres');
        }
    }

    redoOnboarding() {
        try {
            localStorage.removeItem('coachbot_onboarding');
            this.closeSettings();
            this.showOnboardingModal();
            logError('onboarding_reset', 'info');
        } catch (error) {
            logError('redo_onboarding_error', error);
        }
    }

    clearLocalData() {
        try {
            const confirmClear = confirm('Êtes-vous sûr de vouloir effacer toutes vos données locales ?\n\nCela supprimera :\n- Votre profil d\'onboarding\n- Vos conversations locales\n- Vos paramètres\n\nCette action est irréversible.');
            
            if (confirmClear) {
                // Effacer toutes les données locales CoachBot
                const keysToRemove = [];
                for (let i = 0; i < localStorage.length; i++) {
                    const key = localStorage.key(i);
                    if (key && key.startsWith('coachbot_')) {
                        keysToRemove.push(key);
                    }
                }
                
                keysToRemove.forEach(key => localStorage.removeItem(key));
                
                this.closeSettings();
                this.showSuccessMessage('Données locales effacées. Redémarrage...');
                
                logError('local_data_cleared', 'info', { keysCleared: keysToRemove });
                
                setTimeout(() => {
                    location.reload();
                }, 2000);
            }
        } catch (error) {
            logError('clear_local_data_error', error);
            this.showErrorMessage('Erreur lors de l\'effacement des données');
        }
    }

    closeSettings() {
        try {
            const modal = document.querySelector('.settings-modal');
            if (modal) {
                modal.style.opacity = '0';
                setTimeout(() => modal.remove(), 300);
            }
        } catch (error) {
            logError('close_settings_error', error);
        }
    }

    switchToDay(day) {
        try {
            if (day < 1 || day > 15) {
                this.showErrorMessage('Jour invalide sélectionné');
                return;
            }

            this.currentDay = day;
            
            // Mettre à jour la navigation
            document.querySelectorAll('.day-btn').forEach(btn => {
                btn.classList.remove('active');
            });
            
            const activeBtn = document.querySelector(`[data-day="${day}"]`);
            if (activeBtn) {
                activeBtn.classList.add('active');
            }
            
            // Mettre à jour le titre
            const dayTitle = document.querySelector('.day-title');
            if (dayTitle) {
                dayTitle.textContent = `Jour ${day} - Transformation`;
            }
            
            // Charger les messages du jour
            this.loadMessages();
            
            logError('day_switched', 'info', { day });
            
        } catch (error) {
            logError('switch_day_error', error, { day });
            this.showErrorMessage('Erreur lors du changement de jour');
        }
    }

    async handleLogin(event) {
        const submitBtn = event.target.querySelector('button[type="submit"]');
        const originalText = submitBtn.textContent;
        
        try {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Connexion...';
            
            const email = document.getElementById('login-email')?.value?.trim();
            const password = document.getElementById('login-password')?.value;
            
            if (!email || !password) {
                throw new Error('Email et mot de passe requis');
            }
            
            if (!validateEmail(email)) {
                throw new Error('Format email invalide');
            }
            
            await this.login(email, password);
            
        } catch (error) {
            logError('handle_login_error', error);
            this.showErrorMessage(error.message || 'Erreur de connexion');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = originalText;
        }
    }

    async handleRegister(event) {
        const submitBtn = event.target.querySelector('button[type="submit"]');
        const originalText = submitBtn.textContent;
        
        try {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Inscription...';
            
            const email = document.getElementById('register-email')?.value?.trim();
            const password = document.getElementById('register-password')?.value;
            const name = document.getElementById('register-name')?.value?.trim();
            
            if (!email || !password) {
                throw new Error('Email et mot de passe requis');
            }
            
            if (!validateEmail(email)) {
                throw new Error('Format email invalide');
            }
            
            if (!validatePassword(password)) {
                throw new Error('Mot de passe trop court (minimum 6 caractères)');
            }
            
            await this.register(email, password, name);
            
        } catch (error) {
            logError('handle_register_error', error);
            this.showErrorMessage(error.message || 'Erreur d\'inscription');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = originalText;
        }
    }

    showErrorMessage(message) {
        this.showTemporaryMessage(message, 'error');
    }

    showSuccessMessage(message) {
        this.showTemporaryMessage(message, 'success');
    }

    showTemporaryMessage(message, type = 'info') {
        try {
            const messageDiv = document.createElement('div');
            messageDiv.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                background: ${type === 'error' ? '#dc3545' : type === 'success' ? '#28a745' : '#17a2b8'};
                color: white;
                padding: 15px 20px;
                border-radius: 8px;
                z-index: 10001;
                font-size: 14px;
                max-width: 350px;
                box-shadow: 0 5px 15px rgba(0,0,0,0.3);
                animation: slideInRight 0.3s ease;
                word-wrap: break-word;
            `;
            
            messageDiv.textContent = message;
            document.body.appendChild(messageDiv);
            
            setTimeout(() => {
                messageDiv.style.animation = 'slideOutRight 0.3s ease';
                setTimeout(() => {
                    if (messageDiv.parentNode) {
                        messageDiv.remove();
                    }
                }, 300);
            }, 4000);
            
        } catch (error) {
            console.error('Erreur affichage message temporaire:', error);
        }
    }

    cleanup() {
        try {
            if (this.voiceManager) {
                this.voiceManager.destroy();
            }
            
            // Nettoyer les event listeners spécifiques
            document.querySelectorAll('.settings-modal').forEach(modal => modal.remove());
            
            logError('cleanup_completed', 'info');
        } catch (error) {
            logError('cleanup_error', error);
        }
    }

// CoachBot Frontend - PARTIE 3/3 - Auth, Chat et Finalisation
// COLLER APRÈS LA PARTIE 2

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
                
                // Synchroniser l'onboarding avec le serveur
                await this.syncOnboardingToServer();
                
                await this.showWelcomeMessage();
                this.showSuccessMessage(`Bienvenue ${this.user.name || 'utilisateur'} !`);
                
                logError('login_success', 'success', { userId: this.user.id });
                
            } else {
                throw new Error(data.error || 'Erreur de connexion');
            }
        } catch (error) {
            logError('login_api_error', error);
            
            if (error.name === 'TypeError' || error.message.includes('fetch')) {
                // Erreur réseau - basculer en mode local
                this.activateLocalMode();
                await this.showWelcomeMessage();
                this.showErrorMessage('Mode hors ligne activé');
            } else {
                throw error;
            }
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
                this.showSuccessMessage('Compte créé avec succès !');
                
                logError('register_success', 'success', { userId: this.user.id });
                
            } else {
                throw new Error(data.error || 'Erreur d\'inscription');
            }
        } catch (error) {
            logError('register_api_error', error);
            
            if (error.name === 'TypeError' || error.message.includes('fetch')) {
                // Erreur réseau - basculer en mode local
                this.activateLocalMode();
                await this.showWelcomeMessage();
                this.showErrorMessage('Mode hors ligne activé');
            } else {
                throw error;
            }
        }
    }

    logout() {
        try {
            this.clearAuthData();
            this.serverMode = false;
            this.updateUserInfo();
            this.showAuthModal();
            this.showSuccessMessage('Déconnexion réussie');
            
            logError('logout_success', 'info');
        } catch (error) {
            logError('logout_error', error);
        }
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

        try {
            const onboardingData = localStorage.getItem('coachbot_onboarding');
            let welcomeMessage = "As-salāmu ʿalaykum ! 🤲🏻 Je suis CoachBot, ton coach personnel pour ces 15 jours de transformation. Comment puis-je t'aider aujourd'hui ?";
            
            if (onboardingData) {
                const profile = JSON.parse(onboardingData);
                const prenom = sanitizeHTML(profile.prenom || 'mon frère/ma sœur');
                welcomeMessage = `As-salāmu ʿalaykum ${prenom} ! 🤲🏻 Ravi de te retrouver ! Je me souviens que tu souhaites progresser sur "${profile.objectif || 'ton objectif'}". Comment s'est passée ta journée ? Es-tu prêt(e) à continuer notre travail ensemble ?`;
            }

            this.addMessage(welcomeMessage, 'ai');
            
        } catch (error) {
            logError('welcome_message_error', error);
            this.addMessage("As-salāmu ʿalaykum ! 🤲🏻 Bienvenue sur CoachBot !", 'ai');
        }
    }

    async loadMessages() {
        if (!this.chatMessages) return;

        try {
            if (this.serverMode && this.token) {
                const response = await fetch(`/api/chat/history?day=${this.currentDay}`, {
                    headers: {
                        'Authorization': `Bearer ${this.token}`
                    }
                });

                if (response.ok) {
                    const messages = await response.json();
                    this.displayMessages(messages);
                    logError('messages_loaded_server', 'success', { count: messages.length, day: this.currentDay });
                } else if (response.status === 401) {
                    // Token expiré
                    this.clearAuthData();
                    this.activateLocalMode();
                    this.loadLocalMessages();
                } else {
                    throw new Error(`Erreur serveur: ${response.status}`);
                }
            } else {
                this.loadLocalMessages();
            }
        } catch (error) {
            logError('load_messages_error', error, { day: this.currentDay });
            this.loadLocalMessages();
        }
    }

    loadLocalMessages() {
        try {
            const messages = JSON.parse(localStorage.getItem(`coachbot_day${this.currentDay}`) || '[]');
            this.displayMessages(messages);
            logError('messages_loaded_local', 'success', { count: messages.length, day: this.currentDay });
        } catch (error) {
            logError('load_local_messages_error', error);
            this.displayMessages([]);
        }
    }

    displayMessages(messages) {
        if (!this.chatMessages) return;

        try {
            this.chatMessages.innerHTML = '';
            
            if (!Array.isArray(messages)) {
                logError('invalid_messages_format', 'warning', { messages });
                return;
            }

            messages.forEach(msg => {
                if (msg && msg.message) {
                    this.addMessage(msg.message, msg.role, false);
                }
            });
            
            this.scrollToBottom();
        } catch (error) {
            logError('display_messages_error', error);
        }
    }

    addMessage(content, role, save = true) {
        if (!this.chatMessages || !content) return;

        try {
            const messageDiv = document.createElement('div');
            messageDiv.className = `message ${role}-message`;
            
            const timestamp = new Date().toLocaleTimeString('fr-FR', { 
                hour: '2-digit', 
                minute: '2-digit' 
            });

            // Sanitiser le contenu mais garder les retours à la ligne
            const sanitizedContent = sanitizeHTML(content).replace(/\n/g, '<br>');

            messageDiv.innerHTML = `
                <div class="message-content">${sanitizedContent}</div>
                <div class="message-time">${timestamp}</div>
            `;

            this.chatMessages.appendChild(messageDiv);
            this.scrollToBottom();

            if (save) {
                this.saveMessage(content, role);
            }

            // Si c'est un message IA et que la synthèse vocale est activée par défaut
            if (role === 'ai' && this.voiceManager && localStorage.getItem('coachbot_auto_speech') === 'true') {
                setTimeout(() => {
                    this.voiceManager.speakText(content);
                }, 1000);
            }

        } catch (error) {
            logError('add_message_error', error, { role, contentLength: content.length });
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

                if (!response.ok && response.status === 401) {
                    // Token expiré - basculer en local
                    this.clearAuthData();
                    this.activateLocalMode();
                    this.saveMessageLocal(message, role);
                } else if (!response.ok) {
                    throw new Error(`Erreur serveur: ${response.status}`);
                }
            } else {
                this.saveMessageLocal(message, role);
            }
        } catch (error) {
            logError('save_message_error', error);
            // Fallback vers sauvegarde locale
            this.saveMessageLocal(message, role);
        }
    }

    saveMessageLocal(message, role) {
        try {
            const messages = JSON.parse(localStorage.getItem(`coachbot_day${this.currentDay}`) || '[]');
            messages.push({
                message,
                role,
                date: new Date().toISOString()
            });
            localStorage.setItem(`coachbot_day${this.currentDay}`, JSON.stringify(messages));
        } catch (error) {
            logError('save_message_local_error', error);
        }
    }

    async sendMessage() {
        if (!this.messageInput || !this.isInitialized) return;

        const message = this.messageInput.value.trim();
        if (!message) {
            this.showErrorMessage('Veuillez saisir un message');
            return;
        }

        // Validation longueur message
        if (message.length > 2000) {
            this.showErrorMessage('Message trop long (maximum 2000 caractères)');
            return;
        }

        try {
            // Désactiver temporairement l'input
            this.messageInput.disabled = true;
            if (this.sendBtn) {
                this.sendBtn.disabled = true;
                this.sendBtn.textContent = 'Envoi...';
            }

            this.addMessage(message, 'user');
            this.messageInput.value = '';
            this.messageInput.style.height = 'auto';

            if (this.serverMode && this.token) {
                await this.streamAIResponse(message);
            } else {
                await this.simulateAIResponse(message);
            }

        } catch (error) {
            logError('send_message_error', error);
            this.showErrorMessage('Erreur lors de l\'envoi du message');
        } finally {
            // Réactiver l'input
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
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

            const response = await fetch('/api/chat/message', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify({
                    message,
                    day: this.currentDay
                }),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                if (response.status === 401) {
                    this.clearAuthData();
                    this.activateLocalMode();
                    await this.simulateAIResponse(message);
                    return;
                }
                throw new Error(`Erreur serveur: ${response.status}`);
            }

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
                            this.finalizeStreamingMessage(fullResponse);
                            return;
                        }

                        try {
                            const parsed = JSON.parse(data);
                            if (parsed.content) {
                                fullResponse += parsed.content;
                                this.updateStreamingMessage(messageDiv, fullResponse);
                            } else if (parsed.error) {
                                throw new Error(parsed.error);
                            }
                        } catch (parseError) {
                            // Ignorer les erreurs de parsing non critiques
                        }
                    }
                }
            }

        } catch (error) {
            logError('stream_ai_response_error', error);
            
            if (error.name === 'AbortError') {
                this.showErrorMessage('Timeout - Passage en mode local');
            } else {
                this.showErrorMessage('Erreur IA - Passage en mode local');
            }
            
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
            this.currentStreamingMessage = messageDiv.querySelector('.message-content');
            this.scrollToBottom();
        }
        
        return messageDiv;
    }

    updateStreamingMessage(messageDiv, content) {
        if (this.currentStreamingMessage) {
            this.currentStreamingMessage.textContent = content;
            this.scrollToBottom();
        }
    }

    finalizeStreamingMessage(fullResponse) {
        if (fullResponse) {
            this.saveMessage(fullResponse, 'ai');
            logError('ai_response_received', 'success', { responseLength: fullResponse.length });
        }
        this.currentStreamingMessage = null;
    }

    async simulateAIResponse(message) {
        try {
            const onboardingData = localStorage.getItem('coachbot_onboarding');
            const userMessage = message.toLowerCase();
            this.messageCounter++;

            // Réponses contextuelles selon l'onboarding et le message
            let responses = this.generateContextualResponses(onboardingData, userMessage);

            // Éviter les répétitions
            const response = this.selectUniqueResponse(responses);

            // Simulation du streaming
            const messageDiv = this.createStreamingMessageDiv();
            
            // Animation de frappe
            await this.typeWriterEffect(response);
            
            this.saveMessage(response, 'ai');
            this.currentStreamingMessage = null;

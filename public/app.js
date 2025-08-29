// =============================================================================
// COACHBOT v2.0 - PARTIE 1/5 : VOICEMANAGER ET UTILITAIRES
// =============================================================================

/**
 * Variable globale pour éviter les clics multiples sur les boutons vocaux
 */
let voiceClickTimeout = null;

/**
 * CLASSE VOICEMANAGER
 * Gère la reconnaissance vocale et la synthèse vocale
 */
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

    /**
     * Initialise la reconnaissance vocale si supportée par le navigateur
     */
    initRecognition() {
        if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            this.recognition = new SpeechRecognition();
            this.recognition.continuous = false;
            this.recognition.interimResults = true;
            this.recognition.lang = 'fr-FR';

            // Événement : démarrage de la reconnaissance
            this.recognition.onstart = () => {
                this.isRecording = true;
                this.updateMicButton();
                this.showInterimResult('🎤 Écoute en cours...');
            };

            // Événement : résultats de reconnaissance
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

                // Afficher les résultats intermédiaires
                if (interimTranscript) {
                    this.showInterimResult('🎤 ' + interimTranscript);
                }

                // Traiter les résultats finaux
                if (finalTranscript) {
                    if (this.app.messageInput) {
                        this.app.messageInput.value = finalTranscript;
                        this.hideInterimResult();
                        this.app.sendMessage();
                    }
                }
            };

            // Événement : erreurs de reconnaissance
            this.recognition.onerror = (event) => {
                console.error('Erreur reconnaissance vocale:', event.error);
                this.isRecording = false;
                this.updateMicButton();
                this.hideInterimResult();
                
                // Messages d'erreur spécifiques
                if (event.error === 'not-allowed') {
                    alert('Veuillez autoriser l\'accès au microphone dans les paramètres de votre navigateur.');
                } else if (event.error === 'network') {
                    alert('Erreur réseau. Vérifiez votre connexion internet.');
                } else if (event.error !== 'aborted') {
                    console.log('Erreur reconnaissance:', event.error);
                }
            };

            // Événement : fin de reconnaissance
            this.recognition.onend = () => {
                this.isRecording = false;
                this.updateMicButton();
                this.hideInterimResult();
            };
        }
    }

    /**
     * Affiche un message temporaire pendant la reconnaissance vocale
     */
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

    /**
     * Cache le message temporaire de reconnaissance
     */
    hideInterimResult() {
        const interim = document.getElementById('interim-result');
        if (interim) {
            interim.remove();
        }
    }

    /**
     * Met à jour l'apparence du bouton microphone
     */
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
                micBtn.title = 'Commencer l\'enregistrement vocal';
                micBtn.classList.remove('recording');
            }
        }
    }

    /**
     * Met à jour l'apparence du bouton haut-parleur
     */
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

    /**
     * Système de debounce pour éviter les clics multiples sur le micro
     */
    debounceToggleRecording() {
        if (this.recordingDebounce) {
            clearTimeout(this.recordingDebounce);
        }
        
        this.recordingDebounce = setTimeout(() => {
            this.toggleRecording();
        }, 300); // 300ms de délai
    }

    /**
     * Active/désactive la reconnaissance vocale
     */
    toggleRecording() {
        if (!this.recognition) {
            alert('Reconnaissance vocale non supportée par votre navigateur.');
            return;
        }

        if (this.isRecording) {
            // Arrêter la reconnaissance en cours
            try {
                this.recognition.stop();
            } catch (error) {
                console.log('Erreur arrêt reconnaissance:', error);
                // Forcer le reset de l'état
                this.isRecording = false;
                this.updateMicButton();
            }
        } else {
            // Démarrer la reconnaissance
            try {
                // Vérifier que la reconnaissance n'est pas déjà en cours
                if (!this.isRecording) {
                    this.recognition.start();
                }
            } catch (error) {
                console.error('Erreur démarrage reconnaissance:', error);
                
                // Reset l'état en cas d'erreur
                this.isRecording = false;
                this.updateMicButton();
                
                if (error.name === 'InvalidStateError') {
                    alert('Le microphone est déjà en cours d\'utilisation. Veuillez patienter quelques secondes et réessayer.');
                } else {
                    alert('Impossible de démarrer la reconnaissance vocale. Vérifiez vos permissions microphone.');
                }
            }
        }
    }

    /**
     * Sélectionne la meilleure voix française disponible
     */
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

    /**
     * Lit un texte via la synthèse vocale
     */
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

        // Événements de la synthèse vocale
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

    /**
     * Arrête la synthèse vocale en cours
     */
    stopSpeaking() {
        if (this.synthesis.speaking || this.isPlaying) {
            this.synthesis.cancel();
            this.isPlaying = false;
            this.updateSpeakerButton();
            this.currentUtterance = null;
        }
    }

    /**
     * Active/désactive le haut-parleur
     */
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

/**
 * UTILITAIRES GLOBAUX
 */

/**
 * Met à jour le statut de connexion dans l'interface
 */
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

/**
 * Teste et met à jour le statut réseau
 */
function updateNetworkStatus() {
    if (navigator.onLine) {
        updateConnectionStatus('connecting');
        // Test de connectivité réelle
        fetch('/healthz', { method: 'HEAD', cache: 'no-cache' })
            .then(() => updateConnectionStatus('online'))
            .catch(() => updateConnectionStatus('offline'));
    } else {
        updateConnectionStatus('offline');
    }
}

/**
 * Applique un thème à l'interface
 */
function applyTheme(themeName) {
    document.body.className = document.body.className.replace(/theme-\w+/g, '');
    if (themeName && themeName !== 'default') {
        document.body.classList.add(`theme-${themeName}`);
    }
    localStorage.setItem('coachbot_theme', themeName);
}

// =============================================================================
// COACHBOT v2.0 - PARTIE 2/5 : CLASSE COACHBOT - CONSTRUCTEUR ET INITIALISATION
// =============================================================================

/**
 * CLASSE PRINCIPALE COACHBOT
 * Gère l'application de coaching complète
 */
class CoachBot {
    constructor() {
        // Propriétés principales
        this.currentDay = 1;
        this.serverMode = false;
        this.user = null;
        this.token = localStorage.getItem('coachbot_token');
        this.currentStreamingMessage = null;
        this.messageHistory = [];
        this.messageCounter = 0;
        this.isInitialized = false;
        
        // Initialiser le gestionnaire vocal
        this.voiceManager = new VoiceManager(this);
        
        // Démarrer l'initialisation de l'application
        this.initDOMElements();
        this.initEventListeners();
        this.initApp();
    }

    /**
     * Récupère le jour actuel (méthode de sécurité)
     */
    getCurrentDay() {
        return this.currentDay || 1;
    }

    /**
     * Initialise les références aux éléments DOM principaux
     */
    initDOMElements() {
        // Éléments d'authentification
        this.authModal = document.getElementById('auth-modal');
        this.loginForm = document.getElementById('login-form');
        this.registerForm = document.getElementById('register-form');
        
        // Éléments de chat
        this.chatMessages = document.querySelector('.chat-messages');
        this.messageInput = document.getElementById('message-input');
        this.userInfo = document.querySelector('.user-info');
        
        // Vérifications avec logs pour debug
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

    /**
     * Configure tous les écouteurs d'événements
     */
    initEventListeners() {
        this.setupNavigationListeners();
        this.setupAuthListeners();
        this.setupMessageListeners();
        this.setupVoiceListeners();
        this.setupKeyboardShortcuts();
        this.setupMobileListeners();
    }

    /**
     * Configure les écouteurs pour la navigation entre les jours
     */
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

    /**
     * Configure les écouteurs pour l'authentification
     */
    setupAuthListeners() {
        // Formulaire de connexion
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

        // Formulaire d'inscription
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

        // Commutateurs entre les formulaires
        document.addEventListener('click', (e) => {
            if (e.target.id === 'show-register') {
                this.showRegisterForm();
            } else if (e.target.id === 'show-login') {
                this.showLoginForm();
            }
        });

        // Déconnexion
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('logout-btn')) {
                this.logout();
            }
        });
    }

    /**
     * Configure les écouteurs pour les messages
     */
    setupMessageListeners() {
        // Envoi de messages avec Enter
        if (this.messageInput) {
            this.messageInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.sendMessage();
                }
            });

            // Auto-resize du textarea
            this.messageInput.addEventListener('input', function() {
                this.style.height = 'auto';
                this.style.height = Math.min(this.scrollHeight, 120) + 'px';
            });

            // Sauvegarde automatique des brouillons
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

        // Bouton d'envoi
        const sendBtn = document.getElementById('send-btn');
        if (sendBtn) {
            sendBtn.addEventListener('click', () => {
                this.sendMessage();
            });
        }
    }

    /**
     * Configure les écouteurs pour les fonctions vocales
     */
    setupVoiceListeners() {
        const micBtn = document.getElementById('mic-btn');
        if (micBtn) {
            micBtn.addEventListener('click', () => {
                // Protection contre les clics multiples
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
                // Protection contre les clics multiples
                if (voiceClickTimeout) return;
                
                voiceClickTimeout = setTimeout(() => {
                    voiceClickTimeout = null;
                }, 1000);
                
                this.voiceManager.toggleSpeaker();
            });
        }
    }

    /**
     * Configure les raccourcis clavier
     */
    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Ctrl/Cmd + M : Activer micro
            if ((e.ctrlKey || e.metaKey) && e.key === 'm') {
                e.preventDefault();
                this.voiceManager.debounceToggleRecording();
            }
            
            // Ctrl/Cmd + L : Lire dernier message
            if ((e.ctrlKey || e.metaKey) && e.key === 'l') {
                e.preventDefault();
                this.voiceManager.toggleSpeaker();
            }
            
            // Échap : Arrêter vocal et fermer modales
            if (e.key === 'Escape') {
                this.handleEscapeKey();
            }
        });
    }

    /**
     * Configure les écouteurs pour mobile
     */
    setupMobileListeners() {
        const mobileToggle = document.getElementById('mobile-menu-toggle');
        const sidebar = document.getElementById('sidebar');
        
        if (mobileToggle && sidebar) {
            mobileToggle.addEventListener('click', () => {
                sidebar.classList.toggle('mobile-hidden');
                
                // Mettre à jour l'icône
                const icon = mobileToggle.querySelector('span');
                if (icon) {
                    icon.textContent = sidebar.classList.contains('mobile-hidden') ? '☰' : '✕';
                }
            });

            // Fermer le menu mobile lors du clic sur le contenu principal
            document.addEventListener('click', (e) => {
                if (window.innerWidth <= 768 && 
                    !sidebar.contains(e.target) && 
                    !mobileToggle.contains(e.target) &&
                    !sidebar.classList.contains('mobile-hidden')) {
                    sidebar.classList.add('mobile-hidden');
                    const icon = mobileToggle.querySelector('span');
                    if (icon) icon.textContent = '☰';
                }
            });

            // Gérer le redimensionnement
            window.addEventListener('resize', () => {
                if (window.innerWidth > 768) {
                    sidebar.classList.remove('mobile-hidden');
                    const icon = mobileToggle.querySelector('span');
                    if (icon) icon.textContent = '☰';
                }
            });
        }
    }

    /**
     * Gère la touche Échap
     */
    handleEscapeKey() {
        const authModal = document.getElementById('auth-modal');
        if (authModal && authModal.style.display !== 'none') {
            return; // Ne pas fermer le modal d'auth automatiquement
        }
        
        // Fermer autres modales
        const modals = document.querySelectorAll('.modal, .settings-modal');
        modals.forEach(modal => {
            if (modal.style.display !== 'none') {
                modal.style.display = 'none';
            }
        });

        // Arrêter les fonctions vocales
        if (this.voiceManager) {
            this.voiceManager.stopSpeaking();
            if (this.voiceManager.isRecording) {
                this.voiceManager.toggleRecording();
            }
        }
    }

    /**
     * Initialisation principale de l'application
     */
    async initApp() {
        try {
            // Vérifier la connexion serveur
            await this.checkServerConnection();
            
            // Mettre à jour l'interface utilisateur
            this.updateUserInfo();
            
            // Charger les messages du jour actuel
            this.loadMessages();
            
            // Restaurer le brouillon de message
            this.restoreMessageDraft();
            
            // Vérifier onboarding après un délai
            setTimeout(() => {
                this.checkOnboarding();
            }, 2000);

            // Marquer l'initialisation comme terminée
            this.isInitialized = true;
            console.log('CoachBot initialisé avec succès');
            
        } catch (error) {
            console.error('Erreur initialisation CoachBot:', error);
            this.showFallbackInterface();
        }
    }

    /**
     * Vérifie la connexion au serveur et configure le mode approprié
     */
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
                console.log('Mode serveur activé');
                
                // Synchroniser les données d'onboarding
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

    /**
     * Active le mode local (sans serveur)
     */
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

    /**
     * Synchronise les données d'onboarding avec le serveur
     */
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
                    console.log('Données d\'onboarding synchronisées avec le serveur');
                    
                    // Sauvegarder une entrée de journal avec le profil complet
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
            console.error('Erreur sync onboarding:', error);
        }
    }

    /**
     * Restaure le brouillon de message sauvegardé
     */
    restoreMessageDraft() {
        if (this.messageInput) {
            const draft = localStorage.getItem('coachbot_message_draft');
            if (draft) {
                this.messageInput.value = draft;
                this.messageInput.style.height = 'auto';
                this.messageInput.style.height = Math.min(this.messageInput.scrollHeight, 120) + 'px';
            }

            // Focus automatique après chargement
            setTimeout(() => {
                if (!this.authModal || this.authModal.style.display === 'none') {
                    this.messageInput.focus();
                }
            }, 2000);
        }
    }

    /**
     * Affiche une interface de secours en cas d'erreur critique
     */
    showFallbackInterface() {
        if (this.chatMessages && this.chatMessages.children.length === 0) {
            this.chatMessages.innerHTML = `
                <div class="message ai-message">
                    <div class="message-content" style="background: #f8d7da; color: #721c24; border-color: #f5c6cb;">
                        ⚠️ Erreur d'initialisation de CoachBot.<br><br>
                        Veuillez recharger la page. Si le problème persiste, contactez le support technique.
                    </div>
                    <div class="message-time">${new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</div>
                </div>
            `;
        }
    }

    /**
     * Change le jour actuel et met à jour l'interface
     */
    switchToDay(day) {
        this.currentDay = day;
        
        // Mettre à jour les boutons de navigation
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
        
        // Charger les messages du nouveau jour
        this.loadMessages();
    }
}

// =============================================================================
// COACHBOT v2.0 - PARTIE 3/5 : AUTHENTIFICATION ET GESTION UTILISATEUR
// =============================================================================

/**
 * MÉTHODES D'AUTHENTIFICATION ET DE GESTION UTILISATEUR
 * (Suite de la classe CoachBot)
 */

/**
 * Connecte un utilisateur avec email/mot de passe
 */
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
            // Sauvegarder les informations d'authentification
            this.token = data.token;
            this.user = data.user;
            localStorage.setItem('coachbot_token', this.token);
            localStorage.setItem('coachbot_user', JSON.stringify(this.user));
            
            // Basculer en mode serveur
            this.serverMode = true;
            this.updateUserInfo();
            this.hideAuthModal();
            
            // Synchroniser les données d'onboarding
            await this.syncOnboardingToServer();
            
            // Afficher le message de bienvenue
            await this.showWelcomeMessage();
            
            console.log('Connexion réussie:', this.user.email);
        } else {
            alert(data.error || 'Erreur de connexion');
        }
    } catch (error) {
        console.error('Erreur login:', error);
        // En cas d'erreur serveur, basculer en mode local
        this.activateLocalMode();
        await this.showWelcomeMessage();
    }
}

/**
 * Inscrit un nouvel utilisateur
 */
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
            // Sauvegarder les informations d'authentification
            this.token = data.token;
            this.user = data.user;
            localStorage.setItem('coachbot_token', this.token);
            localStorage.setItem('coachbot_user', JSON.stringify(this.user));
            
            // Basculer en mode serveur
            this.serverMode = true;
            this.updateUserInfo();
            this.hideAuthModal();
            
            // Afficher le message de bienvenue
            await this.showWelcomeMessage();
            
            console.log('Inscription réussie:', this.user.email);
        } else {
            alert(data.error || 'Erreur d\'inscription');
        }
    } catch (error) {
        console.error('Erreur register:', error);
        // En cas d'erreur serveur, basculer en mode local
        this.activateLocalMode();
        await this.showWelcomeMessage();
    }
}

/**
 * Déconnecte l'utilisateur actuel
 */
logout() {
    // Supprimer les données d'authentification
    localStorage.removeItem('coachbot_token');
    localStorage.removeItem('coachbot_user');
    
    // Reset des propriétés
    this.token = null;
    this.user = null;
    this.serverMode = false;
    
    // Mettre à jour l'interface
    this.updateUserInfo();
    this.showAuthModal();
    
    // Vider les messages actuels
    if (this.chatMessages) {
        this.chatMessages.innerHTML = '';
    }
    
    console.log('Déconnexion effectuée');
}

/**
 * Met à jour les informations utilisateur dans l'interface
 */
updateUserInfo() {
    if (!this.userInfo) return;

    const onboardingData = localStorage.getItem('coachbot_onboarding');
    let displayName = 'Utilisateur';
    let configBadge = '';
    
    // Déterminer le nom d'affichage
    if (onboardingData) {
        const profile = JSON.parse(onboardingData);
        displayName = profile.prenom || 'Utilisateur';
        configBadge = '<span class="config-badge">Configuré</span>';
    } else if (this.user?.name) {
        displayName = this.user.name;
    }

    // Déterminer les badges
    const modeIndicator = this.serverMode ? 'Serveur' : 'Local';
    const adminBadge = this.user?.role === 'admin' ? '<span class="admin-badge">Admin</span>' : '';
    
    // Mettre à jour le HTML
    this.userInfo.innerHTML = `
        <div>
            <strong>${displayName}</strong> ${adminBadge} ${configBadge}
            <div class="mode-indicator">${modeIndicator}</div>
        </div>
    `;
}

/**
 * Vérifie si l'onboarding a été complété
 */
checkOnboarding() {
    const onboardingData = localStorage.getItem('coachbot_onboarding');
    if (!onboardingData) {
        this.showOnboardingModal();
    }
}

/**
 * Affiche la modal d'onboarding
 */
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

/**
 * Affiche les paramètres utilisateur
 */
showSettings() {
    const onboardingData = localStorage.getItem('coachbot_onboarding');
    
    if (onboardingData) {
        const profile = JSON.parse(onboardingData);
        const modalContent = `
            <div class="settings-modal" style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); z-index: 10000; display: flex; align-items: center; justify-content: center;">
                <div style="background: white; padding: 30px; border-radius: 15px; max-width: 500px; margin: 20px; box-shadow: 0 20px 40px rgba(0,0,0,0.2);">
                    <h2 style="margin-bottom: 20px; color: #333; text-align: center;">Paramètres</h2>
                    
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
                    
                    <div style="margin-bottom: 25px;">
                        <h3 style="color: #6366F1; margin-bottom: 15px; border-bottom: 2px solid #e9ecef; padding-bottom: 8px;">Informations système</h3>
                        <div style="display: grid; gap: 10px;">
                            <p><strong>Mode:</strong> ${this.serverMode ? 'Serveur connecté' : 'Mode local'}</p>
                            <p><strong>Jour actuel:</strong> ${this.currentDay}/15</p>
                            <p><strong>Messages sauvegardés:</strong> ${this.getMessageCount()}</p>
                        </div>
                    </div>
                    
                    <div style="margin-bottom: 25px;">
                        <h3 style="color: #6366F1; margin-bottom: 15px; border-bottom: 2px solid #e9ecef; padding-bottom: 8px;">Raccourcis clavier</h3>
                        <div style="display: grid; gap: 8px; font-size: 14px;">
                            <p><kbd>Ctrl+M</kbd> : Activer/désactiver le microphone</p>
                            <p><kbd>Ctrl+L</kbd> : Lire le dernier message</p>
                            <p><kbd>Échap</kbd> : Arrêter le vocal et fermer les modales</p>
                            <p><kbd>Entrée</kbd> : Envoyer le message</p>
                        </div>
                    </div>
                    
                    <div style="display: flex; gap: 10px; justify-content: center; flex-wrap: wrap;">
                        <button onclick="window.coachBot.redoOnboarding()" style="background: #6366F1; color: white; border: none; padding: 12px 20px; border-radius: 8px; cursor: pointer; font-weight: 600; transition: all 0.3s;" onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform='translateY(0)'">
                            Refaire l'onboarding
                        </button>
                        <button onclick="window.coachBot.exportData()" style="background: #28a745; color: white; border: none; padding: 12px 20px; border-radius: 8px; cursor: pointer; font-weight: 600; transition: all 0.3s;" onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform='translateY(0)'">
                            Exporter mes données
                        </button>
                        <button onclick="window.coachBot.closeSettings()" style="background: #64748B; color: white; border: none; padding: 12px 20px; border-radius: 8px; cursor: pointer; font-weight: 600; transition: all 0.3s;" onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform='translateY(0)'">
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

/**
 * Relance le processus d'onboarding
 */
redoOnboarding() {
    if (confirm('Êtes-vous sûr de vouloir refaire l\'onboarding ? Cela supprimera votre configuration actuelle.')) {
        localStorage.removeItem('coachbot_onboarding');
        this.closeSettings();
        this.showOnboardingModal();
    }
}

/**
 * Ferme la modal des paramètres
 */
closeSettings() {
    const modal = document.querySelector('.settings-modal');
    if (modal) {
        modal.remove();
    }
}

/**
 * Exporte les données utilisateur
 */
exportData() {
    try {
        const exportData = {
            user: this.user,
            onboarding: JSON.parse(localStorage.getItem('coachbot_onboarding') || '{}'),
            messages: {},
            exportDate: new Date().toISOString(),
            version: '2.0'
        };

        // Collecter les messages de tous les jours
        for (let day = 1; day <= 15; day++) {
            const messages = localStorage.getItem(`coachbot_day${day}`);
            if (messages) {
                exportData.messages[`day${day}`] = JSON.parse(messages);
            }
        }

        // Créer le fichier de téléchargement
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

/**
 * Compte le nombre total de messages sauvegardés
 */
getMessageCount() {
    let total = 0;
    for (let day = 1; day <= 15; day++) {
        const messages = localStorage.getItem(`coachbot_day${day}`);
        if (messages) {
            try {
                const parsed = JSON.parse(messages);
                total += Array.isArray(parsed) ? parsed.length : 0;
            } catch (e) {
                // Ignorer les erreurs de parsing
            }
        }
    }
    return total;
}

/**
 * Affiche la modal d'authentification
 */
showAuthModal() {
    if (this.authModal) {
        this.authModal.style.display = 'flex';
    }
}

/**
 * Cache la modal d'authentification
 */
hideAuthModal() {
    if (this.authModal) {
        this.authModal.style.display = 'none';
    }
}

/**
 * Affiche le formulaire de connexion
 */
showLoginForm() {
    if (this.loginForm && this.registerForm) {
        this.loginForm.style.display = 'block';
        this.registerForm.style.display = 'none';
    }
}

/**
 * Affiche le formulaire d'inscription
 */
showRegisterForm() {
    if (this.loginForm && this.registerForm) {
        this.loginForm.style.display = 'none';
        this.registerForm.style.display = 'block';
    }
}

/**
 * Affiche le message de bienvenue adapté au contexte
 */
async showWelcomeMessage() {
    if (!this.chatMessages) return;

    const onboardingData = localStorage.getItem('coachbot_onboarding');
    let welcomeMessage = "As-salamu 'alaykum ! Je suis CoachBot, ton coach personnel pour ces 15 jours de transformation. Comment puis-je t'aider aujourd'hui ?";
    
    if (onboardingData) {
        const profile = JSON.parse(onboardingData);
        const timeGreeting = this.getTimeGreeting();
        welcomeMessage = `As-salamu 'alaykum ${profile.prenom} ! ${timeGreeting} Ravi de te retrouver ! Je me souviens que tu souhaites progresser sur l'amélioration de ta ${profile.objectif}. Comment s'est passée ta journée ? Es-tu prêt(e) à continuer notre travail ensemble ?`;
    }

    this.addMessage(welcomeMessage, 'ai');
}

/**
 * Retourne une salutation adaptée à l'heure
 */
getTimeGreeting() {
    const hour = new Date().getHours();
    if (hour < 6) return "Masha'Allah, tu es matinal !";
    if (hour < 12) return "Bonjour et qu'Allah bénisse ta journée !";
    if (hour < 17) return "Bel après-midi !";
    if (hour < 21) return "Bonne soirée !";
    return "Bonne fin de soirée !";
}

/**
 * Gère les changements de thème
 */
toggleTheme() {
    const currentTheme = localStorage.getItem('coachbot_theme') || 'default';
    const newTheme = currentTheme === 'default' ? 'dark' : 'default';
    applyTheme(newTheme);
    console.log(`Thème changé: ${newTheme}`);
}

// =============================================================================
// COACHBOT v2.0 - PARTIE 4/5 : GESTION DES MESSAGES ET IA
// =============================================================================

/**
 * MÉTHODES DE GESTION DES MESSAGES ET INTERACTION IA
 * (Suite de la classe CoachBot)
 */

/**
 * Charge les messages du jour actuel
 */
async loadMessages() {
    if (!this.chatMessages) return;

    try {
        if (this.serverMode) {
            // Charger depuis le serveur
            const response = await fetch(`/api/chat/history?day=${this.currentDay}`, {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });

            if (response.ok) {
                const messages = await response.json();
                this.displayMessages(messages);
            } else {
                console.log('Erreur serveur, chargement local');
                this.loadLocalMessages();
            }
        } else {
            // Charger depuis le localStorage
            this.loadLocalMessages();
        }
    } catch (error) {
        console.error('Erreur chargement messages:', error);
        this.loadLocalMessages();
    }
}

/**
 * Charge les messages depuis le localStorage
 */
loadLocalMessages() {
    const messages = JSON.parse(localStorage.getItem(`coachbot_day${this.currentDay}`) || '[]');
    this.displayMessages(messages);
}

/**
 * Affiche une liste de messages dans l'interface
 */
displayMessages(messages) {
    if (!this.chatMessages) return;

    // Vider le conteneur
    this.chatMessages.innerHTML = '';
    
    // Afficher chaque message
    messages.forEach(msg => {
        this.addMessage(msg.message, msg.role, false);
    });
    
    // Faire défiler vers le bas
    this.scrollToBottom();
}

/**
 * Ajoute un message à l'interface de chat
 */
addMessage(content, role, save = true) {
    if (!this.chatMessages) return;

    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${role}-message`;
    
    const timestamp = new Date().toLocaleTimeString('fr-FR', { 
        hour: '2-digit', 
        minute: '2-digit' 
    });

    // Créer le HTML du message
    messageDiv.innerHTML = `
        <div class="message-content">${content}</div>
        <div class="message-time">${timestamp}</div>
    `;

    // Ajouter au DOM
    this.chatMessages.appendChild(messageDiv);
    this.scrollToBottom();

    // Sauvegarder si demandé
    if (save) {
        this.saveMessage(content, role);
    }

    // Nettoyer le brouillon après envoi utilisateur
    if (role === 'user') {
        localStorage.removeItem('coachbot_message_draft');
    }

    // Animation d'apparition
    setTimeout(() => {
        messageDiv.style.opacity = '1';
        messageDiv.style.transform = 'translateY(0)';
    }, 50);
}

/**
 * Sauvegarde un message (serveur ou localStorage)
 */
async saveMessage(message, role) {
    try {
        if (this.serverMode) {
            // Sauvegarder sur le serveur
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
            // Sauvegarder en local
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
        
        // Fallback en local si erreur serveur
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

/**
 * Envoie un message utilisateur et déclenche la réponse IA
 */
async sendMessage() {
    if (!this.messageInput) return;

    const message = this.messageInput.value.trim();
    if (!message) return;

    // Désactiver temporairement l'interface
    const sendBtn = document.getElementById('send-btn');
    if (sendBtn) {
        sendBtn.disabled = true;
        sendBtn.textContent = 'Envoi...';
    }

    // Ajouter le message utilisateur
    this.addMessage(message, 'user');
    this.messageInput.value = '';
    
    // Reset la hauteur du textarea
    this.messageInput.style.height = 'auto';

    try {
        if (this.serverMode) {
            await this.streamAIResponse(message);
        } else {
            await this.simulateAIResponse(message);
        }
    } catch (error) {
        console.error('Erreur envoi message:', error);
        
        // En cas d'erreur serveur, basculer en mode local
        if (this.serverMode) {
            console.log('Erreur serveur, basculement en mode local');
            this.serverMode = false;
            this.updateUserInfo();
            await this.simulateAIResponse(message);
        }
    } finally {
        // Réactiver l'interface
        if (sendBtn) {
            sendBtn.disabled = false;
            sendBtn.textContent = 'Envoyer';
        }
    }
}

/**
 * Gère la réponse IA en streaming depuis le serveur
 */
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

    // Créer le container du message IA
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
    
    // Traiter le stream de réponse
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
                        // Ignorer les erreurs de parsing JSON
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

/**
 * Simule une réponse IA intelligente en mode local
 */
async simulateAIResponse(message) {
    const onboardingData = localStorage.getItem('coachbot_onboarding');
    const userMessage = message.toLowerCase();
    this.messageCounter++;

    // Générer des réponses contextuelles
    let responses = this.generateContextualResponses(onboardingData, userMessage);
    
    // Ajouter des réponses basées sur les mots-clés
    responses = responses.concat(this.generateKeywordResponses(userMessage));
    
    // Éviter les répétitions
    const selectedResponse = this.selectUniqueResponse(responses);
    
    // Afficher la réponse avec animation de frappe
    await this.displayTypingResponse(selectedResponse);
}

/**
 * Génère des réponses basées sur le profil d'onboarding
 */
generateContextualResponses(onboardingData, userMessage) {
    let responses = [];

    if (onboardingData) {
        const profile = JSON.parse(onboardingData);
        const style = profile.coachingStyle || 'bienveillant';
        
        switch (style) {
            case 'motivant':
            case 'direct':
                responses = [
                    `Excellent ${profile.prenom} ! Je vois ta détermination pour améliorer ta ${profile.objectif}. Quelle micro-action vas-tu faire aujourd'hui pour progresser ?`,
                    `Mashallah ${profile.prenom} ! Ton engagement est inspirant. Sur une échelle de 1 à 10, comment évalues-tu ton niveau actuel ?`,
                    `Bravo ${profile.prenom} ! Chaque pas compte dans ton parcours vers une meilleure ${profile.objectif}. Quel défi veux-tu relever maintenant ?`,
                    `${profile.prenom}, j'aime ton état d'esprit ! Dis-moi concrètement : qu'as-tu fait aujourd'hui pour te rapprocher de ton objectif ?`
                ];
                break;
                
            case 'structured':
            case 'equilibre':
                responses = [
                    `Bonjour ${profile.prenom}. Analysons ensemble ta progression sur "${profile.objectif}". Peux-tu me donner 3 éléments concrets de ta situation actuelle ?`,
                    `${profile.prenom}, établissons un plan clair. Concernant ta ${profile.objectif}, quels sont tes 3 leviers principaux et tes 3 obstacles ?`,
                    `Parfait ${profile.prenom}. Définissons des critères de réussite mesurables pour ta ${profile.objectif}. Que signifierait "réussir" pour toi ?`,
                    `Très bien ${profile.prenom}. Structurons notre approche : où en es-tu exactement avec ta ${profile.objectif} aujourd'hui ?`
                ];
                break;
                
            default: // bienveillant
                responses = [
                    `Barakallahu fik ${profile.prenom}. Je t'accompagne avec bienveillance dans ton cheminement vers une meilleure ${profile.objectif}. Comment te sens-tu aujourd'hui ?`,
                    `As-salamu 'alaykum ${profile.prenom}. Prends ton temps, chaque étape compte. Concernant ta ${profile.objectif}, quelle petite victoire peux-tu célébrer ?`,
                    `Qu'Allah facilite ton parcours ${profile.prenom}. Je suis là pour t'encourager dans l'amélioration de ta ${profile.objectif}. Raconte-moi comment ça se passe.`,
                    `${profile.prenom}, je sens ta sincérité. Chaque effort compte dans ton parcours vers une meilleure ${profile.objectif}. Qu'est-ce qui te préoccupe aujourd'hui ?`
                ];
        }
    } else {
        // Réponses par défaut sans profil
        responses = [
            "As-salamu 'alaykum ! Pour mieux t'accompagner, peux-tu me dire ton prénom et partager le défi principal sur lequel tu souhaites progresser ?",
            "Barakallahu fik ! Je suis là pour t'aider dans ton développement personnel. Dis-moi, quel est ton objectif prioritaire en ce moment ?",
            "Qu'Allah te facilite ! Chaque parcours de transformation commence par une intention claire. Quelle est la tienne ?",
            "Marhaban ! Je suis CoachBot, ton compagnon pour ces 15 jours de transformation. Comment puis-je t'aider aujourd'hui ?"
        ];
    }

    return responses;
}

/**
 * Génère des réponses basées sur les mots-clés du message utilisateur
 */
generateKeywordResponses(userMessage) {
    const responses = [];
    
    // Réponses selon les mots-clés
    if (userMessage.includes('niveau') || userMessage.includes('évalue') || userMessage.includes('note')) {
        responses.push("Sur une échelle de 1 à 10, comment évalues-tu ton niveau actuel ? Et dis-moi ce qui te ferait passer au niveau supérieur.");
    }
    
    if (userMessage.includes('difficile') || userMessage.includes('obstacle') || userMessage.includes('problème')) {
        responses.push("Je comprends que ce soit difficile. Identifions ensemble le plus petit pas possible que tu peux faire aujourd'hui. Quelle micro-action de 10 minutes maximum ?");
    }
    
    if (userMessage.includes('oui') || userMessage.includes('d\'accord') || userMessage.includes('ok') || userMessage.includes('bien sûr')) {
        responses.push("Excellent ! Maintenant, fixons-nous un critère de réussite concret. Comment saurais-tu que tu as progressé d'ici ce soir ?");
    }
    
    if (userMessage.includes('motivation') || userMessage.includes('envie') || userMessage.includes('courage')) {
        responses.push("La motivation fluctue, c'est normal. Mais la discipline et les habitudes restent. Quelle habitude simple peux-tu mettre en place dès aujourd'hui ?");
    }
    
    if (userMessage.includes('temps') || userMessage.includes('occupé') || userMessage.includes('busy')) {
        responses.push("Le temps est précieux, c'est vrai. Mais même 5 minutes comptent ! Quelle micro-action de 5 minutes peux-tu faire maintenant ?");
    }
    
    if (userMessage.includes('merci') || userMessage.includes('shukran') || userMessage.includes('barakallahu')) {
        responses.push("Wa fiki barakallahu ! C'est un plaisir de t'accompagner. Reste concentré sur ton objectif, tu peux y arriver bi-idhnillah !");
    }

    return responses;
}

/**
 * Sélectionne une réponse unique pour éviter les répétitions
 */
selectUniqueResponse(responses) {
    const usedKey = `used_responses_day${this.currentDay}`;
    const usedResponses = JSON.parse(localStorage.getItem(usedKey) || '[]');
    const availableResponses = responses.filter(r => !usedResponses.includes(r));
    
    let selectedResponse;
    if (availableResponses.length > 0) {
        selectedResponse = availableResponses[Math.floor(Math.random() * availableResponses.length)];
        usedResponses.push(selectedResponse);
        localStorage.setItem(usedKey, JSON.stringify(usedResponses.slice(-10))); // Garder 10 dernières
    } else {
        // Reset si toutes utilisées
        selectedResponse = responses[Math.floor(Math.random() * responses.length)];
        localStorage.setItem(usedKey, JSON.stringify([selectedResponse]));
    }
    
    return selectedResponse;
}

/**
 * Affiche une réponse avec effet de frappe
 */
async displayTypingResponse(responseText) {
    // Créer le container du message
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
        
        // Afficher un indicateur de frappe
        contentDiv.innerHTML = '<span class="typing-indicator">CoachBot écrit...</span>';
        this.scrollToBottom();
        
        // Attendre un peu avant de commencer la frappe
        await new Promise(resolve => setTimeout(resolve, 800));
        
        // Animation de frappe
        contentDiv.textContent = '';
        let i = 0;
        const typeWriter = () => {
            if (i < responseText.length) {
                contentDiv.textContent += responseText.charAt(i);
                i++;
                this.scrollToBottom();
                setTimeout(typeWriter, Math.random() * 50 + 20); // Vitesse variable
            } else {
                this.saveMessage(responseText, 'ai');
            }
        };
        
        typeWriter();
    }
}

/**
 * Récupère le dernier message IA pour la lecture vocale
 */
getLastAiMessage() {
    if (!this.chatMessages) return null;
    
    const aiMessages = this.chatMessages.querySelectorAll('.ai-message .message-content');
    if (aiMessages.length > 0) {
        const lastMessage = aiMessages[aiMessages.length - 1].textContent;
        // Exclure les messages d'indicateur de frappe
        return lastMessage.includes('CoachBot écrit') ? null : lastMessage;
    }
    
    return null;
}

/**
 * Fait défiler vers le bas du chat
 */
scrollToBottom() {
    if (this.chatMessages) {
        // Utiliser requestAnimationFrame pour un scroll plus fluide
        requestAnimationFrame(() => {
            this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
        });
    }
}

/**
 * Efface l'historique du jour actuel
 */
clearCurrentDayMessages() {
    if (confirm(`Êtes-vous sûr de vouloir effacer tous les messages du jour ${this.currentDay} ?`)) {
        // Effacer de l'interface
        if (this.chatMessages) {
            this.chatMessages.innerHTML = '';
        }
        
        // Effacer du localStorage
        localStorage.removeItem(`coachbot_day${this.currentDay}`);
        
        // Si en mode serveur, effacer aussi du serveur
        if (this.serverMode) {
            fetch(`/api/chat/clear?day=${this.currentDay}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${this.token}` }
            }).catch(console.error);
        }
        
        console.log(`Messages du jour ${this.currentDay} effacés`);
    }
}

/**
 * Recherche dans l'historique des messages
 */
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
        // Scroll vers le premier résultat
        const firstResult = document.querySelector('.message-content[style*="background-color"]');
        if (firstResult) {
            firstResult.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }
}

// =============================================================================
// COACHBOT v2.0 - PARTIE 5/5 : FONCTIONS GLOBALES, INITIALISATION ET OPTIMISATIONS
// =============================================================================

/**
 * FIN DE LA CLASSE COACHBOT
 * Fermeture de la classe avec la dernière accolade
 */
} // Fin de la classe CoachBot

/**
 * FONCTIONS GLOBALES POUR L'INTERFACE
 * Accessibles depuis les boutons HTML et les événements
 */

/**
 * Active/désactive la reconnaissance vocale
 */
function toggleVoice() {
    if (window.coachBot && window.coachBot.voiceManager) {
        window.coachBot.voiceManager.debounceToggleRecording();
    } else {
        console.warn('VoiceManager non disponible');
        alert('Le système vocal n\'est pas encore initialisé. Veuillez patienter quelques secondes.');
    }
}

/**
 * Active/désactive la lecture vocale
 */
function stopSpeaking() {
    if (window.coachBot && window.coachBot.voiceManager) {
        window.coachBot.voiceManager.toggleSpeaker();
    } else {
        console.warn('VoiceManager non disponible');
        alert('Le système vocal n\'est pas encore initialisé. Veuillez patienter quelques secondes.');
    }
}

/**
 * Affiche les paramètres utilisateur
 */
function showSettings() {
    if (window.coachBot) {
        window.coachBot.showSettings();
    } else {
        console.warn('CoachBot non disponible');
        alert('CoachBot n\'est pas encore initialisé. Veuillez patienter quelques secondes.');
    }
}

/**
 * Change le thème de l'interface
 */
function toggleTheme() {
    if (window.coachBot) {
        window.coachBot.toggleTheme();
    } else {
        // Fallback pour changer le thème même sans CoachBot
        const currentTheme = localStorage.getItem('coachbot_theme') || 'default';
        const newTheme = currentTheme === 'default' ? 'dark' : 'default';
        applyTheme(newTheme);
    }
}

/**
 * Efface les messages du jour actuel
 */
function clearMessages() {
    if (window.coachBot) {
        window.coachBot.clearCurrentDayMessages();
    }
}

/**
 * Lance une recherche dans les messages
 */
function searchInMessages() {
    const query = prompt('Rechercher dans les messages:');
    if (query && window.coachBot) {
        window.coachBot.searchMessages(query);
    }
}

/**
 * GESTION DES ÉVÉNEMENTS RÉSEAU
 */

/**
 * Écoute les changements de statut réseau
 */
window.addEventListener('online', () => {
    console.log('Connexion rétablie');
    updateNetworkStatus();
    if (window.coachBot && !window.coachBot.serverMode && window.coachBot.token) {
        // Tentative de reconnexion au serveur
        window.coachBot.checkServerConnection();
    }
});

window.addEventListener('offline', () => {
    console.log('Connexion perdue');
    updateNetworkStatus();
});

/**
 * GESTION AUDIO CONTEXTUELLE
 */

/**
 * Gère les changements de visibilité de l'onglet
 */
document.addEventListener('visibilitychange', () => {
    if (document.hidden && window.coachBot && window.coachBot.voiceManager) {
        // Arrêter la synthèse vocale si l'onglet n'est plus visible
        window.coachBot.voiceManager.stopSpeaking();
    }
});

/**
 * PROTECTION CONTRE LES ERREURS CRITIQUES
 */

/**
 * Gestion globale des erreurs JavaScript
 */
window.addEventListener('error', (event) => {
    console.error('Erreur JavaScript critique:', event.error);
    
    // Fallback interface en cas d'erreur majeure
    if (!window.coachBot || !window.coachBot.isInitialized) {
        const chatMessages = document.querySelector('.chat-messages');
        if (chatMessages && chatMessages.children.length === 0) {
            chatMessages.innerHTML = `
                <div class="message ai-message">
                    <div class="message-content" style="background: #f8d7da; color: #721c24; border-color: #f5c6cb;">
                        Erreur d'initialisation de CoachBot.<br><br>
                        Veuillez recharger la page. Si le problème persiste, contactez le support technique.<br><br>
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

/**
 * Gestion des promesses rejetées non capturées
 */
window.addEventListener('unhandledrejection', (event) => {
    console.error('Promesse rejetée non capturée:', event.reason);
    
    // Empêcher l'affichage de l'erreur dans la console si elle est gérée ici
    if (event.reason && event.reason.name === 'AbortError') {
        event.preventDefault();
    }
});

/**
 * INITIALISATION PRINCIPALE DE L'APPLICATION
 */

/**
 * Initialisation sécurisée au chargement du DOM
 */
document.addEventListener('DOMContentLoaded', () => {
    console.log('Initialisation de CoachBot...');
    
    try {
        // Initialiser CoachBot
        window.coachBot = new CoachBot();
        console.log('CoachBot initialisé avec succès');
        
        // Charger les voix après un délai
        setTimeout(() => {
            if (window.speechSynthesis) {
                const voices = window.speechSynthesis.getVoices();
                console.log(`${voices.length} voix disponibles`);
                
                // Forcer le chargement des voix
                if (voices.length === 0) {
                    window.speechSynthesis.onvoiceschanged = () => {
                        const newVoices = window.speechSynthesis.getVoices();
                        console.log(`${newVoices.length} voix chargées`);
                    };
                }
            }
        }, 1000);
        
        // Initialiser les optimisations de performance
        initializePerformanceOptimizations();
        
        // Initialiser la gestion des thèmes
        initializeThemeManager();
        
        // Initialiser le monitoring réseau
        setTimeout(updateNetworkStatus, 1000);
        
    } catch (error) {
        console.error('Erreur lors de l\'initialisation de CoachBot:', error);
        
        // Interface de fallback d'urgence
        const chatMessages = document.querySelector('.chat-messages');
        if (chatMessages) {
            chatMessages.innerHTML = `
                <div class="message ai-message">
                    <div class="message-content" style="background: #f8d7da; color: #721c24; border-color: #f5c6cb;">
                        Erreur critique lors de l'initialisation.<br><br>
                        Détails techniques: ${error.message}<br><br>
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

/**
 * OPTIMISATIONS DE PERFORMANCE
 */

/**
 * Initialise les optimisations de performance
 */
function initializePerformanceOptimizations() {
    // Lazy loading pour les images
    if ('IntersectionObserver' in window) {
        const imageObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const img = entry.target;
                    if (img.dataset.src) {
                        img.src = img.dataset.src;
                        img.removeAttribute('data-src');
                        imageObserver.unobserve(img);
                    }
                }
            });
        });
        
        document.querySelectorAll('img[data-src]').forEach(img => {
            imageObserver.observe(img);
        });
    }
    
    // Optimisation du scroll pour mobile
    if ('scrollBehavior' in document.documentElement.style) {
        document.documentElement.style.scrollBehavior = 'smooth';
    }
    
    // Préchargement des ressources critiques
    preloadCriticalResources();
}

/**
 * Précharge les ressources critiques
 */
function preloadCriticalResources() {
    const criticalEndpoints = ['/api/healthz', '/onboarding.html'];
    
    criticalEndpoints.forEach(endpoint => {
        if ('fetch' in window) {
            fetch(endpoint, { method: 'HEAD', mode: 'no-cors' })
                .catch(() => {}); // Ignorer les erreurs de préchargement
        }
    });
}

/**
 * GESTION AVANCÉE DES THÈMES
 */

/**
 * Initialise le gestionnaire de thèmes
 */
function initializeThemeManager() {
    // Restaurer le thème sauvegardé
    const savedTheme = localStorage.getItem('coachbot_theme');
    if (savedTheme) {
        applyTheme(savedTheme);
    }
    
    // Détecter les préférences système
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        if (!savedTheme) {
            applyTheme('dark');
        }
    }
    
    // Écouter les changements de préférence système
    if (window.matchMedia) {
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
            if (!localStorage.getItem('coachbot_theme')) {
                applyTheme(e.matches ? 'dark' : 'default');
            }
        });
    }
    
    // Gérer les préférences d'accessibilité
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        document.body.classList.add('reduced-motion');
    }
}

/**
 * ANIMATIONS ET AMÉLIORATIONS UX
 */

/**
 * Initialise les animations d'interface
 */
function initializeAnimations() {
    // Animation d'apparition progressive des éléments
    const animatedElements = document.querySelectorAll('.day-btn, .user-info, .settings-btn');
    animatedElements.forEach((el, index) => {
        if (el.style) {
            el.style.animationDelay = `${index * 0.1}s`;
            el.classList.add('fade-in');
        }
    });
    
    // Ajouter les classes CSS pour les animations
    if (!document.getElementById('coachbot-animations')) {
        const style = document.createElement('style');
        style.id = 'coachbot-animations';
        style.textContent = `
            .fade-in {
                opacity: 0;
                transform: translateY(10px);
                animation: fadeInUp 0.6s ease forwards;
            }
            
            @keyframes fadeInUp {
                to {
                    opacity: 1;
                    transform: translateY(0);
                }
            }
            
            .reduced-motion * {
                animation-duration: 0.01ms !important;
                animation-iteration-count: 1 !important;
                transition-duration: 0.01ms !important;
            }
            
            .typing-indicator::after {
                content: '';
                display: inline-block;
                width: 4px;
                height: 20px;
                background: #6366F1;
                margin-left: 2px;
                animation: blink 1s infinite;
            }
            
            @keyframes blink {
                0%, 50% { opacity: 1; }
                51%, 100% { opacity: 0; }
            }
        `;
        document.head.appendChild(style);
    }
}

/**
 * MONITORING ET DEBUG
 */

/**
 * Monitoring des performances (uniquement en dev)
 */
function initializePerformanceMonitoring() {
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        window.addEventListener('load', () => {
            if ('performance' in window) {
                const perfData = performance.getEntriesByType('navigation')[0];
                if (perfData) {
                    const loadTime = Math.round(perfData.loadEventEnd - perfData.fetchStart);
                    console.log(`Page chargée en ${loadTime}ms`);
                    
                    // Alerter si chargement trop lent
                    if (loadTime > 3000) {
                        console.warn('Chargement lent détecté:', loadTime + 'ms');
                    }
                }
            }
        });
    }
}

/**
 * UTILITAIRES DE DIAGNOSTIC
 */

/**
 * Diagnostic complet du système
 */
function runDiagnostic() {
    console.group('Diagnostic CoachBot');
    
    // État de l'application
    console.log('CoachBot initialisé:', !!window.coachBot);
    console.log('Mode serveur:', window.coachBot?.serverMode || false);
    console.log('Utilisateur connecté:', !!window.coachBot?.user);
    console.log('Jour actuel:', window.coachBot?.currentDay || 'N/A');
    
    // Capacités du navigateur
    console.log('Reconnaissance vocale:', 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window);
    console.log('Synthèse vocale:', 'speechSynthesis' in window);
    console.log('LocalStorage:', 'localStorage' in window);
    console.log('Fetch API:', 'fetch' in window);
    
    // État réseau
    console.log('En ligne:', navigator.onLine);
    console.log('Type de connexion:', navigator.connection?.effectiveType || 'Inconnu');
    
    // Données stockées
    const onboarding = localStorage.getItem('coachbot_onboarding');
    console.log('Onboarding complété:', !!onboarding);
    
    if (window.coachBot) {
        console.log('Messages sauvegardés:', window.coachBot.getMessageCount());
    }
    
    console.groupEnd();
}

/**
 * GESTION DES RACCOURCIS AVANCÉS
 */

/**
 * Initialise les raccourcis clavier avancés
 */
function initializeAdvancedShortcuts() {
    document.addEventListener('keydown', (e) => {
        // Diagnostic (Ctrl+Shift+D)
        if (e.ctrlKey && e.shiftKey && e.key === 'D') {
            e.preventDefault();
            runDiagnostic();
        }
        
        // Effacer messages (Ctrl+Shift+C)
        if (e.ctrlKey && e.shiftKey && e.key === 'C') {
            e.preventDefault();
            clearMessages();
        }
        
        // Recherche (Ctrl+F dans les messages)
        if (e.ctrlKey && e.key === 'f' && !e.shiftKey) {
            const focused = document.activeElement;
            if (focused && focused.closest('.chat-messages')) {
                e.preventDefault();
                searchInMessages();
            }
        }
        
        // Basculer thème (Ctrl+Shift+T)
        if (e.ctrlKey && e.shiftKey && e.key === 'T') {
            e.preventDefault();
            toggleTheme();
        }
    });
}

/**
 * INITIALISATION FINALE
 */

/**
 * Initialisation complète après le chargement
 */
window.addEventListener('load', () => {
    // Initialiser les animations
    setTimeout(initializeAnimations, 100);
    
    // Initialiser le monitoring de performance
    initializePerformanceMonitoring();
    
    // Initialiser les raccourcis avancés
    initializeAdvancedShortcuts();
    
    // Log de démarrage complet
    console.log(`
🚀 CoachBot Interface v2.0 - Chargé avec succès !

Améliorations appliquées :
✅ Design moderne avec animations fluides
✅ Responsive design optimisé mobile/desktop  
✅ Accessibilité WCAG 2.1 conforme
✅ Performance optimisée avec lazy loading
✅ Gestion d'erreurs robuste avec fallbacks
✅ Reconnaissance vocale corrigée (debounce)
✅ Sauvegarde automatique des brouillons
✅ Support dark mode et high contrast
✅ Protection contre erreurs critiques

🎮 Raccourcis clavier :
   - Ctrl+M : Activer/désactiver micro
   - Ctrl+L : Lire dernier message  
   - Ctrl+F : Rechercher dans les messages
   - Ctrl+Shift+T : Basculer le thème
   - Ctrl+Shift+D : Diagnostic système
   - Ctrl+Shift+C : Effacer les messages
   - Échap : Arrêter vocal et fermer modales

🎤 Corrections vocales :
   - Debounce pour éviter clics multiples
   - Gestion d'états robuste
   - Messages d'erreur informatifs  
   - Reset automatique en cas de problème

Bi-idhnillah, l'interface sécurisée est prête pour la transformation !
    `);
});

/**
 * SERVICE WORKER (optionnel pour PWA)
 */
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then(registration => {
                console.log('Service Worker enregistré:', registration);
            })
            .catch(error => {
                console.log('Échec enregistrement Service Worker:', error);
            });
    });
}

/**
 * EXPORT POUR TESTS (si nécessaire)
 */
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { CoachBot, VoiceManager };
}

// =============================================================================
// FIN DU FICHIER COACHBOT v2.0 - TOUTES FONCTIONNALITÉS INCLUSES
// =============================================================================

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

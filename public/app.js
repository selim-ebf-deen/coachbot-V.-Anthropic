// CoachBot Frontend - Version corrigée avec fonctions globales
class CoachBot {
    constructor() {
        this.token = localStorage.getItem('coachbot_token');
        this.currentDay = 1;
        this.user = null;
        this.isLoading = false;
        this.currentStreamingMessage = null;
        this.typingSpeed = 30; // ms entre chaque caractère
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.generateDaysNav();
        
        if (this.token) {
            this.loadUser();
        } else {
            this.showAuth();
        }
    }

    setupEventListeners() {
        // Auth forms
        document.getElementById('loginFormElement').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleLogin();
        });

        document.getElementById('registerFormElement').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleRegister();
        });

        // Chat input
        const chatInput = document.getElementById('chatInput');
        chatInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });

        chatInput.addEventListener('input', () => {
            this.autoResizeTextarea(chatInput);
        });
    }

    autoResizeTextarea(textarea) {
        textarea.style.height = 'auto';
        textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
    }

    generateDaysNav() {
        const nav = document.getElementById('daysNav');
        nav.innerHTML = '';
        
        for (let i = 1; i <= 15; i++) {
            const btn = document.createElement('button');
            btn.className = 'day-btn';
            btn.textContent = `J${i}`;
            btn.onclick = () => this.switchDay(i);
            nav.appendChild(btn);
        }
        
        this.updateDayNavigation();
    }

    updateDayNavigation() {
        document.querySelectorAll('.day-btn').forEach((btn, index) => {
            btn.classList.toggle('active', index + 1 === this.currentDay);
        });
    }

    showAuth() {
        document.getElementById('authSection').style.display = 'block';
        document.getElementById('appSection').style.display = 'none';
    }

    showApp() {
        document.getElementById('authSection').style.display = 'none';
        document.getElementById('appSection').style.display = 'flex';
    }

    showLogin() {
        document.getElementById('loginForm').classList.add('active');
        document.getElementById('registerForm').classList.remove('active');
    }

    showRegister() {
        document.getElementById('loginForm').classList.remove('active');
        document.getElementById('registerForm').classList.add('active');
    }

    async handleLogin() {
        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;

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
                this.showApp();
                this.updateUserInfo();
                this.loadChatHistory();
            } else {
                this.showError(data.error || 'Erreur de connexion');
            }
        } catch (error) {
            this.showError('Erreur réseau');
        }
    }

    async handleRegister() {
        const name = document.getElementById('registerName').value;
        const email = document.getElementById('registerEmail').value;
        const password = document.getElementById('registerPassword').value;

        try {
            const response = await fetch('/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, email, password })
            });

            const data = await response.json();
            
            if (response.ok) {
                this.token = data.token;
                localStorage.setItem('coachbot_token', this.token);
                this.user = data.user;
                this.showApp();
                this.updateUserInfo();
                this.showWelcomeMessage();
            } else {
                this.showError(data.error || 'Erreur d\'inscription');
            }
        } catch (error) {
            this.showError('Erreur réseau');
        }
    }

    async loadUser() {
        try {
            const response = await fetch('/api/me', {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                this.user = data.user;
                this.showApp();
                this.updateUserInfo();
                this.loadChatHistory();
            } else {
                this.logout();
            }
        } catch (error) {
            this.logout();
        }
    }

    updateUserInfo() {
        if (!this.user) return;
        
        document.getElementById('userName').textContent = this.user.name || 'Utilisateur';
        document.getElementById('userEmail').textContent = this.user.email;
        
        // Avatar avec initiale
        const avatar = document.getElementById('userAvatar');
        const initial = (this.user.name || this.user.email || 'U')[0].toUpperCase();
        avatar.textContent = initial;
    }

    showWelcomeMessage() {
        const welcomeMessages = [
            "Assalamu alaykum et bienvenue sur CoachBot ! 🤲🏻",
            "Je suis ravi de t'accompagner dans ton parcours de 15 jours. Ensemble, nous allons transformer tes défis en opportunités.",
            "Commençons par faire connaissance : comment t'appelles-tu et quel est ton objectif principal pour ces 15 jours ?"
        ];
        
        this.displayMultipleBubbles(welcomeMessages);
    }

    async displayMultipleBubbles(messages) {
        for (let i = 0; i < messages.length; i++) {
            if (i > 0) await this.sleep(1000); // Délai entre bulles
            
            const aiMessage = {
                role: 'ai',
                message: '',
                date: new Date().toISOString()
            };
            this.addMessageToChat(aiMessage, false);
            this.currentStreamingMessage = document.querySelector('.message:last-child .message-content');
            
            await this.typeMessage(messages[i], false);
        }
    }

    async loadChatHistory() {
        try {
            const response = await fetch(`/api/journal?day=${this.currentDay}`, {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });

            if (response.ok) {
                const messages = await response.json();
                this.displayMessages(messages);
                this.updateDayInfo();
            }
        } catch (error) {
            console.error('Erreur chargement historique:', error);
        }
    }

    displayMessages(messages) {
        const container = document.getElementById('chatMessages');
        container.innerHTML = '';
        
        messages.forEach(msg => {
            this.addMessageToChat(msg, false);
        });
        
        this.scrollToBottom();
    }

    addMessageToChat(message, save = true) {
        const container = document.getElementById('chatMessages');
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${message.role}`;
        
        // Animation d'apparition
        messageDiv.style.opacity = '0';
        messageDiv.style.transform = 'translateY(20px)';
        
        const avatar = document.createElement('div');
        avatar.className = 'message-avatar';
        avatar.textContent = message.role === 'user' ? 
            (this.user?.name?.[0] || 'U').toUpperCase() : '🤲🏻';
        
        const content = document.createElement('div');
        content.className = 'message-content';
        content.innerHTML = this.formatMessage(message.message);
        
        messageDiv.appendChild(avatar);
        messageDiv.appendChild(content);
        container.appendChild(messageDiv);
        
        // Animation d'entrée
        setTimeout(() => {
            messageDiv.style.transition = 'all 0.3s ease-out';
            messageDiv.style.opacity = '1';
            messageDiv.style.transform = 'translateY(0)';
        }, 50);
        
        if (save && message.role === 'user') {
            this.saveMessage(message);
        }
        
        this.scrollToBottom();
    }

    formatMessage(text) {
        return text
            .replace(/\n\n/g, '<br><br>')
            .replace(/\n/g, '<br>')
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/_(.*?)_/g, '<em>$1</em>')
            .replace(/`(.*?)`/g, '<code>$1</code>');
    }

    async saveMessage(message) {
        try {
            await fetch('/api/journal/save', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify({
                    day: this.currentDay,
                    message: message.message,
                    role: message.role
                })
            });
        } catch (error) {
            console.error('Erreur sauvegarde:', error);
        }
    }

    async sendMessage() {
        if (this.isLoading) return;
        
        const input = document.getElementById('chatInput');
        const message = input.value.trim();
        
        if (!message) return;
        
        // Message utilisateur
        const userMessage = {
            role: 'user',
            message: message,
            date: new Date().toISOString()
        };
        
        this.addMessageToChat(userMessage);
        input.value = '';
        this.autoResizeTextarea(input);
        
        // État de chargement
        this.setLoading(true);
        
        // Message IA en streaming
        await this.streamAIResponse(message);
        
        this.setLoading(false);
    }

    async streamAIResponse(message) {
        try {
            const response = await fetch('/api/chat/stream', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify({
                    message: message,
                    day: this.currentDay,
                    provider: 'anthropic'
                })
            });

            if (!response.ok) {
                throw new Error('Erreur de streaming');
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            
            let fullResponse = '';
            let currentBubbleText = '';
            let isFirstBubble = true;
            
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                
                const chunk = decoder.decode(value);
                const lines = chunk.split('\n');
                
                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const data = line.slice(6);
                        if (data === '[DONE]') break;
                        
                        try {
                            const parsed = JSON.parse(data);
                            if (parsed.text) {
                                fullResponse += parsed.text;
                                currentBubbleText += parsed.text;
                                
                                // Diviser en bulles sur les retours à la ligne doubles
                                if (currentBubbleText.includes('\n\n')) {
                                    const parts = currentBubbleText.split('\n\n');
                                    const completeBubble = parts[0];
                                    currentBubbleText = parts.slice(1).join('\n\n');
                                    
                                    if (isFirstBubble) {
                                        await this.typeMessage(completeBubble, true);
                                        isFirstBubble = false;
                                    } else {
                                        await this.addNewBubbleWithTyping(completeBubble);
                                    }
                                } else if (isFirstBubble) {
                                    // Première bulle, mise à jour en temps réel
                                    await this.updateStreamingMessage(currentBubbleText);
                                }
                            }
                            if (parsed.error) {
                                throw new Error(parsed.error);
                            }
                        } catch (e) {
                            // Ignorer les lignes malformées
                        }
                    }
                }
            }
            
            // Terminer la dernière bulle
            if (currentBubbleText.trim()) {
                if (isFirstBubble) {
                    await this.typeMessage(currentBubbleText, true);
                } else {
                    await this.addNewBubbleWithTyping(currentBubbleText);
                }
            }
            
        } catch (error) {
            console.error('Erreur streaming:', error);
            this.showError('Erreur de communication avec l\'IA');
        }
    }

    async typeMessage(text, isFirst = false) {
        if (isFirst) {
            // Créer la première bulle
            const aiMessage = {
                role: 'ai',
                message: '',
                date: new Date().toISOString()
            };
            this.addMessageToChat(aiMessage, false);
            this.currentStreamingMessage = document.querySelector('.message:last-child .message-content');
        }

        // Effet de frappe
        let displayedText = '';
        for (let i = 0; i < text.length; i++) {
            displayedText += text[i];
            this.currentStreamingMessage.innerHTML = this.formatMessage(displayedText);
            this.scrollToBottom();
            
            // Vitesse variable selon le caractère
            let delay = this.typingSpeed;
            if (text[i] === '.' || text[i] === '!' || text[i] === '?') {
                delay = this.typingSpeed * 8; // Pause après ponctuation
            } else if (text[i] === ',') {
                delay = this.typingSpeed * 3; // Pause après virgule
            } else if (text[i] === ' ') {
                delay = this.typingSpeed * 0.5; // Espaces plus rapides
            }
            
            await this.sleep(delay);
        }
    }

    async updateStreamingMessage(text) {
        if (this.currentStreamingMessage) {
            this.currentStreamingMessage.innerHTML = this.formatMessage(text);
            this.scrollToBottom();
        }
    }

    async addNewBubbleWithTyping(text) {
        // Ajouter un délai avant la nouvelle bulle
        await this.sleep(800);
        
        // Créer nouvelle bulle
        const aiMessage = {
            role: 'ai',
            message: '',
            date: new Date().toISOString()
        };
        this.addMessageToChat(aiMessage, false);
        this.currentStreamingMessage = document.querySelector('.message:last-child .message-content');
        
        // Effet de frappe pour cette bulle
        await this.typeMessage(text, false);
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    setLoading(loading) {
        this.isLoading = loading;
        const sendBtn = document.getElementById('sendBtn');
        
        if (loading) {
            sendBtn.innerHTML = '<div class="loading"></div>';
            sendBtn.disabled = true;
        } else {
            sendBtn.innerHTML = '➤';
            sendBtn.disabled = false;
            this.currentStreamingMessage = null;
        }
    }

    switchDay(day) {
        if (day === this.currentDay || this.isLoading) return;
        
        this.currentDay = day;
        this.updateDayNavigation();
        this.updateDayInfo();
        this.loadChatHistory();
    }

    updateDayInfo() {
        const plans = {
            1: { title: "Clarification des intentions", desc: "Précise le défi prioritaire à résoudre en 15 jours" },
            2: { title: "Diagnostic de situation", desc: "État des lieux, 3 leviers, 3 obstacles" },
            3: { title: "Vision et critères", desc: "Issue idéale + 3 indicateurs mesurables" },
            4: { title: "Valeurs et motivations", desc: "Aligne objectifs et valeurs personnelles" },
            5: { title: "Énergie et estime", desc: "Estime de soi, amour propre, confiance" },
            6: { title: "Renforcement confiance", desc: "Preuves, retours, micro-victoires" },
            7: { title: "Bilan KISS", desc: "Keep-Improve-Start-Stop" },
            8: { title: "Nouveau départ", desc: "Cap et prochaines 48h" },
            9: { title: "Plan d'action", desc: "1 chose concrète par jour" },
            10: { title: "Communication CNV", desc: "Préparer un message clé" },
            11: { title: "Décisions importantes", desc: "Stop / Keep / Start" },
            12: { title: "Responsabilité", desc: "Au-dessus de la ligne" },
            13: { title: "Co-développement", desc: "Pairing et entraide" },
            14: { title: "Leadership", desc: "Principes de Maxwell" },
            15: { title: "Bilan final", desc: "Plan 30 jours suivants" }
        };
        
        const plan = plans[this.currentDay] || { title: "Jour inconnu", desc: "Description non disponible" };
        
        document.getElementById('dayTitle').textContent = `Jour ${this.currentDay} - ${plan.title}`;
        document.getElementById('dayDescription').textContent = plan.desc;
    }

    scrollToBottom() {
        const container = document.getElementById('chatMessages');
        setTimeout(() => {
            container.scrollTop = container.scrollHeight;
        }, 100);
    }

    showError(message) {
        // Simple alert pour les erreurs - peut être amélioré avec une notification plus jolie
        alert(message);
    }

    logout() {
        localStorage.removeItem('coachbot_token');
        this.token = null;
        this.user = null;
        this.showAuth();
        
        // Reset forms
        document.getElementById('loginFormElement').reset();
        document.getElementById('registerFormElement').reset();
    }
}

// Fonctions globales pour les onclick dans le HTML
window.showLogin = function() {
    if (window.app) {
        window.app.showLogin();
    }
};

window.showRegister = function() {
    if (window.app) {
        window.app.showRegister();
    }
};

window.sendMessage = function() {
    if (window.app) {
        window.app.sendMessage();
    }
};

window.logout = function() {
    if (window.app) {
        window.app.logout();
    }
};

// Initialisation de l'app
window.app = new CoachBot();

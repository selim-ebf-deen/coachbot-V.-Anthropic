// Modifications pour public/app.js - Streaming amélioré avec bulles multiples

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

    // ... (garder les méthodes existantes jusqu'à streamAIResponse)

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

    // ... (garder le reste des méthodes existantes)
}

// CSS amélioré pour les bulles (à ajouter dans index.html)
const improvedChatCSS = `
<style>
.message-content {
    background: rgba(255, 255, 255, 0.9);
    padding: 15px 20px;
    border-radius: 20px;
    max-width: 70%;
    line-height: 1.6;
    box-shadow: 0 4px 15px rgba(0,0,0,0.1);
    position: relative;
    word-wrap: break-word;
}

.message.user .message-content {
    background: linear-gradient(135deg, var(--accent) 0%, var(--accent2) 100%);
    color: white;
}

.message-content code {
    background: rgba(0, 0, 0, 0.1);
    padding: 2px 6px;
    border-radius: 4px;
    font-family: 'Courier New', monospace;
    font-size: 0.9em;
}

.typing-indicator {
    display: inline-block;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--primary);
    animation: pulse 1.5s ease-in-out infinite;
    margin-left: 4px;
}

@keyframes pulse {
    0%, 100% { opacity: 0.3; }
    50% { opacity: 1; }
}

.message {
    animation: slideInMessage 0.3s ease-out;
}

@keyframes slideInMessage {
    from { 
        opacity: 0; 
        transform: translateY(10px); 
    }
    to { 
        opacity: 1; 
        transform: translateY(0); 
    }
}
</style>
`;

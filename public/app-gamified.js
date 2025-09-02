<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <!-- 🎤 AUTORISATION MICROPHONE OBLIGATOIRE -->
    <meta http-equiv="Permissions-Policy" content="microphone=*">
    <meta http-equiv="Feature-Policy" content="microphone *">
    <title>CoachBot - Interface Gamifiée</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            height: 100vh;
            display: flex;
            overflow: hidden;
        }

        .sidebar {
            width: 320px;
            background: rgba(255, 255, 255, 0.1);
            backdrop-filter: blur(15px);
            padding: 20px;
            color: white;
            display: flex;
            flex-direction: column;
            overflow-y: auto;
        }

        .logo {
            text-align: center;
            margin-bottom: 25px;
        }

        .logo h1 {
            font-size: 24px;
            margin-bottom: 5px;
        }

        .logo p {
            font-size: 14px;
            opacity: 0.8;
        }

        /* 🎮 GAMIFICATION WIDGET */
        .gamification-widget {
            background: linear-gradient(135deg, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0.05) 100%);
            border-radius: 15px;
            padding: 20px;
            margin-bottom: 20px;
            border: 1px solid rgba(255,255,255,0.2);
            box-shadow: 0 8px 32px rgba(0,0,0,0.1);
        }

        .level-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 15px;
        }

        .level-info {
            display: flex;
            align-items: center;
            gap: 10px;
        }

        .level-emoji {
            font-size: 28px;
            animation: pulse 2s infinite;
        }

        @keyframes pulse {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.1); }
        }

        .level-text {
            display: flex;
            flex-direction: column;
        }

        .level-number {
            font-size: 18px;
            font-weight: bold;
            color: #FFD700;
        }

        .level-title {
            font-size: 12px;
            opacity: 0.9;
        }

        .points-display {
            text-align: right;
        }

        .points-number {
            font-size: 16px;
            font-weight: bold;
            color: #00FF88;
        }

        .points-label {
            font-size: 10px;
            opacity: 0.7;
        }

        .progress-bar {
            width: 100%;
            height: 8px;
            background: rgba(255,255,255,0.2);
            border-radius: 4px;
            overflow: hidden;
            margin-bottom: 12px;
        }

        .progress-fill {
            height: 100%;
            background: linear-gradient(90deg, #FFD700 0%, #FF6B6B 50%, #4ECDC4 100%);
            border-radius: 4px;
            transition: width 1s ease-out;
            box-shadow: 0 2px 10px rgba(255,215,0,0.3);
        }

        .streak-info {
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-size: 12px;
        }

        .streak {
            display: flex;
            align-items: center;
            gap: 5px;
        }

        .streak-flame {
            font-size: 16px;
            animation: flicker 1s infinite alternate;
        }

        @keyframes flicker {
            0% { opacity: 0.8; }
            100% { opacity: 1; }
        }

        .badges-mini {
            display: flex;
            gap: 3px;
        }

        .badge-mini {
            font-size: 12px;
            padding: 2px 6px;
            background: rgba(255,255,255,0.2);
            border-radius: 10px;
            font-weight: bold;
        }

        /* USER INFO UPDATED */
        .user-info {
            background: rgba(255, 255, 255, 0.1);
            padding: 15px;
            border-radius: 10px;
            margin-bottom: 20px;
        }

        .config-badge, .admin-badge {
            background: linear-gradient(45deg, #FFD700, #FFA500);
            color: #333;
            padding: 2px 8px;
            border-radius: 12px;
            font-size: 11px;
            font-weight: bold;
            margin-left: 5px;
        }

        .mode-indicator {
            font-size: 12px;
            opacity: 0.8;
            margin-top: 5px;
        }

        /* NAVIGATION AMÉLIORÉE */
        .navigation {
            flex: 1;
        }

        .navigation h3 {
            margin-bottom: 15px;
            font-size: 16px;
        }

        .days-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 8px;
            margin-bottom: 25px;
        }

        .day-btn {
            background: rgba(255, 255, 255, 0.2);
            color: white;
            border: none;
            padding: 12px 8px;
            border-radius: 8px;
            cursor: pointer;
            font-size: 12px;
            transition: all 0.3s;
            position: relative;
            overflow: hidden;
        }

        .day-btn:hover {
            background: rgba(255, 255, 255, 0.3);
            transform: translateY(-2px);
        }

        .day-btn.active {
            background: rgba(255, 255, 255, 0.4);
            box-shadow: 0 4px 15px rgba(255, 255, 255, 0.2);
        }

        .day-btn.completed {
            background: linear-gradient(135deg, #28a745, #20c997);
            box-shadow: 0 4px 15px rgba(40, 167, 69, 0.3);
        }

        .day-btn.completed::after {
            content: '✓';
            position: absolute;
            top: 2px;
            right: 2px;
            font-size: 10px;
            color: white;
            font-weight: bold;
        }

        /* BOUTONS GAMIFICATION */
        .gamification-buttons {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 10px;
            margin-bottom: 20px;
        }

        .game-btn {
            background: rgba(255, 255, 255, 0.2);
            color: white;
            border: none;
            padding: 10px;
            border-radius: 8px;
            cursor: pointer;
            font-size: 11px;
            font-weight: 600;
            transition: all 0.3s;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 5px;
        }

        .game-btn:hover {
            background: rgba(255, 255, 255, 0.3);
            transform: translateY(-2px);
        }

        .settings-btn, .logout-btn {
            background: rgba(255, 255, 255, 0.2);
            color: white;
            border: none;
            padding: 12px 15px;
            border-radius: 8px;
            cursor: pointer;
            transition: background 0.3s;
            margin-bottom: 10px;
        }

        .logout-btn {
            background: #dc3545;
            margin-top: auto;
        }

        .settings-btn:hover {
            background: rgba(255, 255, 255, 0.3);
        }

        .logout-btn:hover {
            background: #c82333;
        }

        /* MAIN CONTENT */
        .main-content {
            flex: 1;
            display: flex;
            flex-direction: column;
            background: white;
            margin: 20px;
            border-radius: 15px;
            overflow: hidden;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
        }

        .chat-header {
            background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
            padding: 20px;
            border-bottom: 1px solid #e9ecef;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .day-title {
            font-size: 20px;
            color: #333;
            margin: 0;
        }

        .header-gamification {
            display: flex;
            align-items: center;
            gap: 15px;
            font-size: 14px;
        }

        .quick-stats {
            display: flex;
            align-items: center;
            gap: 10px;
        }

        .stat-item {
            display: flex;
            align-items: center;
            gap: 3px;
            background: rgba(99, 102, 241, 0.1);
            padding: 5px 10px;
            border-radius: 15px;
            color: #6366F1;
            font-weight: 600;
        }

        /* CHAT MESSAGES */
        .chat-messages {
            flex: 1;
            padding: 20px;
            overflow-y: auto;
            max-height: calc(100vh - 200px);
            background: #f8f9fa;
        }

        .message {
            margin-bottom: 20px;
            animation: fadeIn 0.3s ease-in;
            position: relative;
        }

        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
        }

        .user-message {
            text-align: right;
        }

        .ai-message {
            text-align: left;
        }

        .message-content {
            display: inline-block;
            padding: 12px 16px;
            border-radius: 18px;
            max-width: 70%;
            line-height: 1.4;
            word-wrap: break-word;
            position: relative;
        }

        .user-message .message-content {
            background: linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%);
            color: white;
        }

        .ai-message .message-content {
            background: white;
            color: #333;
            border: 1px solid #e9ecef;
        }

        .message-time {
            font-size: 11px;
            color: #6c757d;
            margin-top: 5px;
        }

        /* 🎮 POINTS ANIMATION */
        .points-earned {
            position: absolute;
            top: -30px;
            right: 0;
            background: linear-gradient(45deg, #FFD700, #FF6B6B);
            color: white;
            padding: 5px 10px;
            border-radius: 15px;
            font-size: 12px;
            font-weight: bold;
            animation: pointsAnimation 2s ease-out forwards;
            z-index: 10;
        }

        @keyframes pointsAnimation {
            0% { opacity: 1; transform: translateY(0) scale(1); }
            50% { opacity: 1; transform: translateY(-15px) scale(1.2); }
            100% { opacity: 0; transform: translateY(-30px) scale(0.8); }
        }

        /* CHAT INPUT */
        .chat-input {
            display: flex;
            padding: 20px;
            gap: 15px;
            border-top: 1px solid #e9ecef;
            background: white;
            align-items: center;
        }

        .vocal-controls {
            display: flex;
            gap: 10px;
        }

        .vocal-btn {
            width: 45px;
            height: 45px;
            border-radius: 50%;
            border: none;
            cursor: pointer;
            font-size: 18px;
            transition: all 0.3s;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .vocal-btn:hover {
            transform: scale(1.1);
        }

        #mic-btn {
            background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
            color: white;
        }

        #speaker-btn {
            background: linear-gradient(135deg, #17a2b8 0%, #6f42c1 100%);
            color: white;
        }

        #message-input {
            flex: 1;
            padding: 12px 16px;
            border: 2px solid #e9ecef;
            border-radius: 25px;
            font-size: 14px;
            outline: none;
            transition: border-color 0.3s;
        }

        #message-input:focus {
            border-color: #6366F1;
        }

        #send-btn {
            background: linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%);
            color: white;
            border: none;
            padding: 12px 24px;
            border-radius: 25px;
            cursor: pointer;
            font-weight: 600;
            transition: all 0.3s;
        }

        #send-btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 5px 15px rgba(99, 102, 241, 0.4);
        }

        /* 🎮 MODALES GAMIFICATION */
        .modal {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.7);
            z-index: 10000;
            display: none;
            align-items: center;
            justify-content: center;
        }

        .modal-content {
            background: white;
            padding: 30px;
            border-radius: 15px;
            max-width: 600px;
            max-height: 80vh;
            overflow-y: auto;
            width: 90%;
            box-shadow: 0 20px 40px rgba(0,0,0,0.3);
        }

        .modal-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
            padding-bottom: 15px;
            border-bottom: 2px solid #e9ecef;
        }

        .close-modal {
            background: none;
            border: none;
            font-size: 24px;
            cursor: pointer;
            color: #999;
        }

        /* BADGES GRID */
        .badges-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
            margin: 20px 0;
        }

        .badge-card {
            background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
            padding: 20px;
            border-radius: 12px;
            text-align: center;
            border: 2px solid transparent;
            transition: all 0.3s;
        }

        .badge-card.earned {
            background: linear-gradient(135deg, #d4edda 0%, #c3e6cb 100%);
            border-color: #28a745;
            box-shadow: 0 4px 15px rgba(40, 167, 69, 0.2);
        }

        .badge-emoji {
            font-size: 40px;
            margin-bottom: 10px;
            display: block;
        }

        .badge-name {
            font-weight: bold;
            margin-bottom: 5px;
            color: #333;
        }

        .badge-desc {
            font-size: 12px;
            color: #666;
        }

        /* LEADERBOARD */
        .leaderboard-item {
            display: flex;
            align-items: center;
            padding: 15px;
            margin-bottom: 10px;
            background: #f8f9fa;
            border-radius: 10px;
            border-left: 4px solid #e9ecef;
        }

        .leaderboard-item.current-user {
            background: linear-gradient(135deg, #fff3cd 0%, #ffeaa7 100%);
            border-color: #ffc107;
        }

        .leaderboard-rank {
            font-size: 18px;
            font-weight: bold;
            margin-right: 15px;
            min-width: 30px;
        }

        .leaderboard-info {
            flex: 1;
        }

        .leaderboard-name {
            font-weight: bold;
            margin-bottom: 5px;
        }

        .leaderboard-stats {
            font-size: 12px;
            color: #666;
        }

        .leaderboard-points {
            font-size: 16px;
            font-weight: bold;
            color: #6366F1;
        }

        /* 🎮 NOTIFICATIONS */
        .notification {
            position: fixed;
            top: 20px;
            right: 20px;
            background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
            color: white;
            padding: 15px 20px;
            border-radius: 10px;
            box-shadow: 0 5px 20px rgba(40, 167, 69, 0.3);
            z-index: 10001;
            transform: translateX(100%);
            animation: slideInNotification 0.3s ease-out forwards;
            max-width: 300px;
        }

        @keyframes slideInNotification {
            to { transform: translateX(0); }
        }

        .notification.level-up {
            background: linear-gradient(135deg, #FFD700 0%, #FF6B6B 100%);
        }

        .notification.badge-earned {
            background: linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%);
        }

        .notification-title {
            font-weight: bold;
            margin-bottom: 5px;
        }

        .notification-message {
            font-size: 14px;
        }

        /* AUTH MODAL */
        #auth-modal {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.7);
            z-index: 10000;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .auth-container {
            background: white;
            padding: 40px;
            border-radius: 15px;
            width: 400px;
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
        }

        .auth-container h3 {
            text-align: center;
            margin-bottom: 25px;
            color: #333;
            font-size: 24px;
        }

        .auth-container input {
            width: 100%;
            padding: 12px 16px;
            margin: 10px 0;
            border: 2px solid #e9ecef;
            border-radius: 8px;
            font-size: 14px;
            outline: none;
            transition: border-color 0.3s;
        }

        .auth-container input:focus {
            border-color: #6366F1;
        }

        .auth-container button[type="submit"] {
            width: 100%;
            padding: 12px;
            background: linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%);
            color: white;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            font-size: 16px;
            font-weight: 600;
            margin-top: 10px;
            transition: all 0.3s;
        }

        .auth-container button[type="submit"]:hover {
            transform: translateY(-2px);
            box-shadow: 0 5px 15px rgba(99, 102, 241, 0.4);
        }

        .auth-switch {
            text-align: center;
            margin-top: 20px;
        }

        .auth-switch a {
            color: #6366F1;
            text-decoration: none;
            font-weight: 600;
        }

        .auth-switch a:hover {
            text-decoration: underline;
        }

        /* RESPONSIVE */
        @media (max-width: 768px) {
            body {
                flex-direction: column;
            }
            
            .sidebar {
                width: 100%;
                height: auto;
                padding: 15px;
            }
            
            .days-grid {
                grid-template-columns: repeat(5, 1fr);
                gap: 5px;
            }
            
            .main-content {
                margin: 10px;
                flex: 1;
            }
            
            .chat-input {
                padding: 15px;
                gap: 10px;
            }
            
            .vocal-btn {
                width: 40px;
                height: 40px;
                font-size: 16px;
            }

            .header-gamification {
                flex-direction: column;
                gap: 10px;
            }

            .badges-grid {
                grid-template-columns: 1fr;
            }
        }

        /* LOADING & TYPING */
        .loading {
            display: inline-block;
            width: 20px;
            height: 20px;
            border: 3px solid rgba(255,255,255,.3);
            border-radius: 50%;
            border-top-color: #fff;
            animation: spin 1s ease-in-out infinite;
        }

        @keyframes spin {
            to { transform: rotate(360deg); }
        }

        .typing-indicator {
            display: flex;
            padding: 10px 15px;
            background: white;
            border-radius: 18px;
            align-items: center;
            gap: 5px;
        }

        .typing-dot {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background: #6c757d;
            animation: typing 1.4s infinite ease-in-out;
        }

        .typing-dot:nth-child(1) { animation-delay: -0.32s; }
        .typing-dot:nth-child(2) { animation-delay: -0.16s; }

        @keyframes typing {
            0%, 80%, 100% {
                transform: scale(0);
                opacity: 0.5;
            }
            40% {
                transform: scale(1);
                opacity: 1;
            }
        }

        /* ANIMATIONS PERSONNALISÉES */
        @keyframes levelUpAnimation {
            0% { transform: scale(1); }
            50% { transform: scale(1.2); }
            100% { transform: scale(1); }
        }

        .level-up-animation {
            animation: levelUpAnimation 0.5s ease-in-out;
        }

        @keyframes badgeEarnedAnimation {
            0% { transform: rotate(0deg) scale(1); }
            25% { transform: rotate(-5deg) scale(1.1); }
            75% { transform: rotate(5deg) scale(1.1); }
            100% { transform: rotate(0deg) scale(1); }
        }

        .badge-earned-animation {
            animation: badgeEarnedAnimation 0.6s ease-in-out;
        }
    </style>
</head>
<body>
    <!-- Sidebar avec Gamification -->
    <div class="sidebar">
        <div class="logo">
            <h1>🤲🏻 CoachBot</h1>
            <p>15 jours de transformation</p>
        </div>

        <!-- 🎮 WIDGET GAMIFICATION PRINCIPAL -->
        <div class="gamification-widget" id="gamificationWidget">
            <div class="level-header">
                <div class="level-info">
                    <div class="level-emoji" id="levelEmoji">🌱</div>
                    <div class="level-text">
                        <div class="level-number" id="levelNumber">Niveau 1</div>
                        <div class="level-title" id="levelTitle">Débutant Sincère</div>
                    </div>
                </div>
                <div class="points-display">
                    <div class="points-number" id="pointsNumber">0</div>
                    <div class="points-label">points</div>
                </div>
            </div>
            
            <div class="progress-bar">
                <div class="progress-fill" id="progressFill" style="width: 0%"></div>
            </div>
            
            <div class="streak-info">
                <div class="streak">
                    <span class="streak-flame">🔥</span>
                    <span id="streakNumber">0</span> jours
                </div>
                <div class="badges-mini" id="badgesMini">
                    <!-- Badges mini apparaîtront ici -->
                </div>
            </div>
        </div>

        <!-- User Info -->
        <div class="user-info" id="userInfo">
            <div>
                <strong>Connexion...</strong>
                <div class="mode-indicator">🔴 Local</div>
            </div>
        </div>

        <!-- 🎮 BOUTONS GAMIFICATION -->
        <div class="gamification-buttons">
            <button class="game-btn" onclick="showBadges()">
                🏆 Badges
            </button>
            <button class="game-btn" onclick="showLeaderboard()">
                📊 Classement
            </button>
        </div>

        <!-- Settings -->
        <button class="settings-btn" onclick="showSettings()">
            ⚙️ Paramètres
        </button>

        <!-- Navigation -->
        <div class="navigation">
            <h3>Programme 15 jours</h3>
            <div class="days-grid" id="daysGrid">
                <button class="day-btn active" data-day="1">J1</button>
                <button class="day-btn" data-day="2">J2</button>
                <button class="day-btn" data-day="3">J3</button>
                <button class="day-btn" data-day="4">J4</button>
                <button class="day-btn" data-day="5">J5</button>
                <button class="day-btn" data-day="6">J6</button>
                <button class="day-btn" data-day="7">J7</button>
                <button class="day-btn" data-day="8">J8</button>
                <button class="day-btn" data-day="9">J9</button>
                <button class="day-btn" data-day="10">J10</button>
                <button class="day-btn" data-day="11">J11</button>
                <button class="day-btn" data-day="12">J12</button>
                <button class="day-btn" data-day="13">J13</button>
                <button class="day-btn" data-day="14">J14</button>
                <button class="day-btn" data-day="15">J15</button>
            </div>
        </div>

        <!-- Logout -->
        <button class="logout-btn" onclick="logout()">Déconnexion</button>
    </div>

    <!-- Main Content -->
    <div class="main-content">
        <!-- Header avec Stats -->
        <div class="chat-header">
            <h2 class="day-title" id="dayTitle">Jour 1 - Transformation</h2>
            <div class="header-gamification">
                <div class="quick-stats">
                    <div class="stat-item">
                        <span>🎯</span>
                        <span id="quickLevel">Niv. 1</span>
                    </div>
                    <div class="stat-item">
                        <span>💎</span>
                        <span id="quickPoints">0 pts</span>
                    </div>
                    <div class="stat-item">
                        <span>🔥</span>
                        <span id="quickStreak">0</span>
                    </div>
                </div>
            </div>
        </div>

        <!-- Messages Container -->
        <div class="chat-messages" id="chatMessages">
            <!-- Les messages apparaîtront ici dynamiquement -->
        </div>

        <!-- Input Area -->
        <div class="chat-input">
            <div class="vocal-controls">
                <button id="mic-btn" class="vocal-btn" onclick="toggleVoice()" title="Reconnaissance vocale">
                    🎤
                </button>
                <button id="speaker-btn" class="vocal-btn" onclick="stopSpeaking()" title="Lecture audio">
                    🔊
                </button>
            </div>
            <input 
                type="text" 
                id="message-input" 
                placeholder="Tapez votre message ou utilisez le micro..."
                autocomplete="off"
            >
            <button id="send-btn" onclick="sendMessage()">Envoyer</button>
        </div>
    </div>

    <!-- 🎮 MODAL BADGES -->
    <div id="badges-modal" class="modal">
        <div class="modal-content">
            <div class="modal-header">
                <h2>🏆 Vos Badges et Achievements</h2>
                <button class="close-modal" onclick="closeBadges()">&times;</button>
            </div>
            
            <div id="badgesContent">
                <div class="loading"></div>
            </div>
        </div>
    </div>

    <!-- 🎮 MODAL LEADERBOARD -->
    <div id="leaderboard-modal" class="modal">
        <div class="modal-content">
            <div class="modal-header">
                <h2>📊 Classement des Coaches</h2>
                <button class="close-modal" onclick="closeLeaderboard()">&times;</button>
            </div>
            
            <div id="leaderboardContent">
                <div class="loading"></div>
            </div>
        </div>
    </div>

    <!-- Auth Modal -->
    <div id="auth-modal" style="display: none;">
        <div class="auth-container">
            <!-- Login Form -->
            <form id="login-form">
                <h3>Connexion</h3>
                <input 
                    type="email" 
                    id="login-email" 
                    placeholder="Adresse email" 
                    required 
                    autocomplete="email"
                >
                <input 
                    type="password" 
                    id="login-password" 
                    placeholder="Mot de passe" 
                    required 
                    autocomplete="current-password"
                >
                <button type="submit">Se connecter</button>
                <div class="auth-switch">
                    <a href="#" id="show-register">Créer un nouveau compte</a>
                </div>
            </form>

            <!-- Register Form -->
            <form id="register-form" style="display: none;">
                <h3>Inscription</h3>
                <input 
                    type="text" 
                    id="register-name" 
                    placeholder="Nom complet" 
                    required 
                    autocomplete="name"
                >
                <input 
                    type="email" 
                    id="register-email" 
                    placeholder="Adresse email" 
                    required 
                    autocomplete="email"
                >
                <input 
                    type="password" 
                    id="register-password" 
                    placeholder="Mot de passe" 
                    required 
                    autocomplete="new-password"
                    minlength="6"
                >
                <button type="submit">Créer le compte</button>
                <div class="auth-switch">
                    <a href="#" id="show-login">Déjà un compte ? Se connecter</a>
                </div>
            </form>
        </div>
    </div>

    <!-- JavaScript -->
    <script src="app-gamified.js"></script>

    <!-- Debug Console -->
    <script>
        console.log('🎮 CoachBot Gamifié - Interface chargée !');
        
        // Protection anti-double clic vocal
        let voiceClickTimeout = null;

        window.toggleVoice = function() {
            if (voiceClickTimeout) {
                console.log('🛑 Clic vocal ignoré (protection anti-spam)');
                return;
            }
            
            voiceClickTimeout = setTimeout(() => {
                voiceClickTimeout = null;
            }, 1000);
            
            console.log('🎤 Toggle Voice appelé (protégé)');
            
            if (window.coachBot && window.coachBot.voiceManager) {
                window.coachBot.voiceManager.debounceToggleRecording();
            } else {
                console.log('⚠️ VoiceManager non disponible - initialisation en cours...');
            }
        };
        
        window.stopSpeaking = function() {
            console.log('🔊 Stop Speaking appelé');
            if (window.coachBot && window.coachBot.voiceManager) {
                window.coachBot.voiceManager.toggleSpeaker();
            } else {
                console.log('⚠️ VoiceManager non disponible');
            }
        };
        
        window.sendMessage = function() {
            if (window.coachBot) {
                window.coachBot.sendMessage();
            }
        };
        
        window.showSettings = function() {
            console.log('⚙️ Show Settings appelé');
            if (window.coachBot) {
                window.coachBot.showSettings();
            } else {
                console.log('⚠️ CoachBot non disponible');
                alert('CoachBot n\'est pas encore initialisé. Veuillez patienter...');
            }
        };

        window.logout = function() {
            if (window.coachBot) {
                window.coachBot.logout();
            }
        };

        // 🎮 FONCTIONS GAMIFICATION
        window.showBadges = function() {
            if (window.coachBot) {
                window.coachBot.showBadges();
            }
        };

        window.showLeaderboard = function() {
            if (window.coachBot) {
                window.coachBot.showLeaderboard();
            }
        };

        window.closeBadges = function() {
            document.getElementById('badges-modal').style.display = 'none';
        };

        window.closeLeaderboard = function() {
            document.getElementById('leaderboard-modal').style.display = 'none';
        };
    </script>
</body>
</html>

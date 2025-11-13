document.addEventListener("DOMContentLoaded", () => {
    // --- Riferimenti DOM ---
    const gameContainer = document.querySelector(".game-container");
    const screens = { setup: document.getElementById("setup-screen"), game: document.getElementById("game-screen"), over: document.getElementById("game-over-screen") };
    const difficultySelect = document.getElementById("difficulty-select");
    const hardcoreGroup = document.getElementById("hardcore-level-group");
    const hardcoreLevelSelect = document.getElementById("hardcore-level-select");
    const playersCountInput = document.getElementById("players-count");
    const playerNamesContainer = document.getElementById("player-names-container");
    const startGameButton = document.getElementById("start-game-button");
    const turnInfo = document.getElementById("turn-info");
    const messages = document.getElementById("messages");
    const guessInput = document.getElementById("guess-input");
    const guessButton = document.getElementById("guess-button");
    const status = document.getElementById("status");
    const gameOverMessage = document.getElementById("game-over-message");
    const gameOverDetails = document.getElementById("game-over-details");
    const playAgainButton = document.getElementById("play-again-button");
    const themeSwitcher = document.getElementById("theme-switcher");
    const historyContainer = document.getElementById("history-container");
    const historyList = document.getElementById("history-list");
    const leaderboardContainer = document.getElementById("leaderboard");
    const leaderboardTitle = document.getElementById("leaderboard-title");
    const leaderboardList = document.getElementById("leaderboard-list");
    const rangeInfo = document.getElementById("range-info");

    // --- Riferimenti Audio ---
    const sounds = { click: document.getElementById("audio-click"), success: document.getElementById("audio-success"), error: document.getElementById("audio-error"), start: document.getElementById("audio-start"), type: document.getElementById("audio-type") };

    // --- Variabili di stato ---
    let min, max, tempoLimite, numeroSegreto, finito, giocatori, giocatoreAttuale, timerId, tentativiRimanenti, tentativiFatti, timerStartTime;

    // --- Funzioni Helper ---
    const playSound = (sound) => {
        if (sounds[sound]) {
            sounds[sound].currentTime = 0;
            const playPromise = sounds[sound].play();

            if (playPromise !== undefined) {
                playPromise.catch(error => {
                    // Gestisce in modo sicuro gli errori di riproduzione audio senza bloccare il gioco.
                    console.error(`Errore nella riproduzione del suono '${sound}':`, error);
                });
            }
        }
    };
    const stopSound = (sound) => { if (sounds[sound]) { sounds[sound].pause(); sounds[sound].currentTime = 0; } };

    const typeText = (element, text) => {
        if (element.typingTimeout) {
            clearTimeout(element.typingTimeout);
        }
        stopSound('type');

        const textElement = element.querySelector('.text');
        const cursorElement = element.querySelector('.cursor');
        if (!textElement || !cursorElement) {
            element.textContent = text;
            return;
        }

        const chars = Array.from(text);
        let i = 0;
        textElement.innerHTML = "";
        cursorElement.style.display = 'inline';
        playSound('type');

        function typing() {
            if (i < chars.length) {
                textElement.innerHTML += chars[i];
                i++;
                element.typingTimeout = setTimeout(typing, 35);
            } else {
                cursorElement.style.display = 'none';
                stopSound('type');
            }
        }
        typing();
    };

    const switchScreen = (screenName) => {
        const currentScreen = document.querySelector('.screen.active');
        if (currentScreen) {
            currentScreen.classList.remove("active");
        }
        screens[screenName].classList.add("active");
    };

    const flashBody = (className) => { document.body.classList.remove("flash-red", "flash-green"); void document.body.offsetWidth; document.body.classList.add(className); };

    const updatePlayerNameInputs = () => {
        let count = parseInt(playersCountInput.value) || 0;
        count = Math.max(1, Math.min(5, count));
        playerNamesContainer.innerHTML = "";
        for (let i = 0; i < count; i++) {
            const inputGroup = document.createElement("div");
            inputGroup.className = "form-group";
            inputGroup.innerHTML = `<label for="player-name-${i}">Nome Giocatore ${i + 1}:</label><input type="text" id="player-name-${i}" placeholder="Giocatore ${i + 1}">`;
            playerNamesContainer.appendChild(inputGroup);
            setTimeout(() => inputGroup.classList.add("fade-in"), 10 * (i + 1));
        }
    };

    // --- Logica di Setup ---
    const setupGame = () => {
        gameContainer.classList.remove("low-time-warning");
        min = 1;
        const difficoltà = difficultySelect.value;
        tempoLimite = null;

        switch (difficoltà) {
            case "facile": max = 50; break;
            case "difficile": max = 200; break;
            case "impossibile": max = 500; break;
            case "hardcore":
                const hardcoreLevel = hardcoreLevelSelect.value;
                switch (hardcoreLevel) {
                    case "1": max = 1000; tempoLimite = 45; break;
                    case "2": max = 2500; tempoLimite = 40; break;
                    case "3": max = 5000; tempoLimite = 35; break;
                }
                break;
            default: max = 100; break;
        }

        giocatori = [];
        const playerCount = parseInt(playersCountInput.value);
        for (let i = 0; i < playerCount; i++) {
            const nameInput = document.getElementById(`player-name-${i}`);
            giocatori.push(nameInput.value || `Giocatore ${i + 1}`);
        }

        if (!tempoLimite) { tentativiRimanenti = new Array(giocatori.length).fill(10); }

        numeroSegreto = Math.floor(Math.random() * (max - min + 1)) + min;
        console.log(`🤫 Psst... il numero segreto è ${numeroSegreto}`);
        giocatoreAttuale = 0;
        finito = false;
        guessInput.disabled = false;
        guessButton.disabled = false;
        guessInput.value = "";
        tentativiFatti = [];
        historyList.innerHTML = '';
        historyContainer.style.display = 'none';
        rangeInfo.textContent = `Intervallo: ${min} - ${max}`;

        typeText(messages, `🤔 Indovina un numero...`);
        updateTurnInfo();
        
        if (tempoLimite) { startTimer(); } else { updateStatus(); }
        switchScreen("game");
    };

    const getAttemptsCount = (playerIndex) => {
        return tentativiFatti.filter(t => t.player === giocatori[playerIndex]).length;
    };

    const calculateScore = () => {
        const baseScore = max * 10;
        const timeBonus = (tempoLimite - (performance.now() - timerStartTime) / 1000) * 100;
        const attemptsPenalty = getAttemptsCount(giocatoreAttuale) * 50;
        return Math.max(0, Math.round(baseScore + timeBonus - attemptsPenalty));
    };

    const endGame = (vittoria) => {
        finito = true;
        guessInput.disabled = true;
        guessButton.disabled = true;
        if (timerId) clearInterval(timerId);
        gameContainer.classList.remove("low-time-warning");

        if (vittoria) {
            const winnerName = giocatori[giocatoreAttuale];
            // Calcola i tentativi DOPO aver aggiunto l'ultimo tentativo alla cronologia
            const finalAttempts = getAttemptsCount(giocatoreAttuale);

            gameOverMessage.textContent = "VITTORIA!";
            gameOverMessage.dataset.text = "VITTORIA!";
            gameOverDetails.textContent = `🎉 ${winnerName} ha indovinato il numero ${numeroSegreto} in ${finalAttempts} tentativi! 🎉`;
            
            if (tempoLimite) {
                const score = calculateScore();
                gameOverDetails.textContent += ` (Punteggio: ${score})`;
                saveScore(score);
            }
        } else {
            playSound("error");
            gameOverMessage.textContent = "GAME OVER";
            gameOverMessage.dataset.text = "GAME OVER";
            gameOverDetails.textContent = `Nessuno ha indovinato. Il numero segreto era ${numeroSegreto}.`;
        }
        displayLeaderboard();
        switchScreen("over");
    };

    // --- Logica di Gioco ---
    const handleGuess = () => {
        if (finito) return;
        playSound("click");

        const numero = parseInt(guessInput.value);
        if (isNaN(numero) || numero < min || numero > max) {
            typeText(messages, "Numero non valido!");
            flashBody("flash-red");
            playSound("error");
            return;
        }
        guessInput.value = "";
        
        // Aggiungi il tentativo alla cronologia prima di verificare la vittoria
        tentativiFatti.push({ player: giocatori[giocatoreAttuale], number: numero });
        updateHistory();

        if (numero === numeroSegreto) {
            flashBody("flash-green");
            playSound("success");
            endGame(true);
        } else {
            flashBody("flash-red");
            playSound("error");
            const distanza = Math.abs(numero - numeroSegreto);
            const range = max - min;
            let hint = "❄️ Lontano";
            if (distanza <= range * 0.05) hint = "🔥 Molto vicino!";
            else if (distanza <= range * 0.15) hint = "🌡️ Vicino";

            if (tempoLimite) {
                typeText(messages, hint);
                giocatoreAttuale = (giocatoreAttuale + 1) % giocatori.length;
                updateTurnInfo();
            } else {
                tentativiRimanenti[giocatoreAttuale]--;
                
                let finalMessage = hint;
                if (tentativiRimanenti[giocatoreAttuale] <= 0) {
                    finalMessage += `. ${giocatori[giocatoreAttuale]} ha finito i tentativi!`;
                }
                typeText(messages, finalMessage);

                const qualcunoHaAncoraTentativi = tentativiRimanenti.some(t => t > 0);
                if (!qualcunoHaAncoraTentativi) {
                    endGame(false);
                } else {
                    // Trova il prossimo giocatore che ha ancora tentativi, partendo da quello attuale
                    let nextPlayerIndex = giocatoreAttuale;
                    do {
                        nextPlayerIndex = (nextPlayerIndex + 1) % giocatori.length;
                    } while (tentativiRimanenti[nextPlayerIndex] <= 0);
                    
                    giocatoreAttuale = nextPlayerIndex;
                    updateTurnInfo();
                    updateStatus();
                }
            }
        }
    };

    // --- Funzioni di Aggiornamento e Timer ---
    const updateStatus = () => { if (!tempoLimite) status.textContent = `Tentativi per ${giocatori[giocatoreAttuale]}: ${tentativiRimanenti[giocatoreAttuale]}`; };
    const updateTurnInfo = () => typeText(turnInfo, `Turno di: ${giocatori[giocatoreAttuale]}`);
    
    const updateHistory = () => {
        historyContainer.style.display = 'block';
        const lastGuess = tentativiFatti[tentativiFatti.length - 1];
        const li = document.createElement('li');
        li.textContent = lastGuess.number;
        historyList.appendChild(li);
        historyContainer.scrollTop = historyContainer.scrollHeight;
    };

    const startTimer = () => {
        let tempoRimanente = tempoLimite;
        status.textContent = `Tempo: ${tempoRimanente}s`;
        timerStartTime = performance.now();
        timerId = setInterval(() => {
            tempoRimanente--;
            status.textContent = `Tempo: ${tempoRimanente}s`;
            if (tempoRimanente <= 10 && !gameContainer.classList.contains("low-time-warning")) { gameContainer.classList.add("low-time-warning"); }
            if (tempoRimanente <= 0) { endGame(false); }
        }, 1000);
    };

    // --- Leaderboard ---
    const saveScore = (score) => {
        const hardcoreLevel = `hardcore${hardcoreLevelSelect.value}`;
        const leaderboard = JSON.parse(localStorage.getItem(hardcoreLevel)) || [];
        leaderboard.push({ name: giocatori[giocatoreAttuale], score });
        leaderboard.sort((a, b) => b.score - a.score);
        leaderboard.splice(5); // Mantieni solo i top 5
        localStorage.setItem(hardcoreLevel, JSON.stringify(leaderboard));
    };

    const displayLeaderboard = () => {
        // Aggiungo controlli di sicurezza per evitare crash se gli elementi non vengono trovati
        const lbContainer = document.getElementById("leaderboard");
        const lbTitle = document.getElementById("leaderboard-title");
        const lbList = document.getElementById("leaderboard-list");

        if (!lbContainer || !lbTitle || !lbList) {
            console.error("Elementi della classifica non trovati nel DOM!");
            return;
        }

        const hardcoreLevel = `hardcore${hardcoreLevelSelect.value}`;
        if (!difficultySelect.value.includes('hardcore')) {
            lbContainer.style.display = 'none';
            return;
        }
        lbContainer.style.display = 'block';
        lbTitle.textContent = `Classifica - Hardcore ${hardcoreLevelSelect.value}`;
        const leaderboard = JSON.parse(localStorage.getItem(hardcoreLevel)) || [];
        lbList.innerHTML = '';
        if (leaderboard.length === 0) {
            lbList.innerHTML = '<li>Nessun punteggio registrato.</li>';
        } else {
            leaderboard.forEach(entry => {
                const li = document.createElement('li');
                li.innerHTML = `<span class="player-name">${entry.name}</span> <span class="player-score">${entry.score}</span>`;
                lbList.appendChild(li);
            });
        }
    };

    // --- Tema ---
    const themes = [
        { name: 'Turchese', vars: { '--primary-color': '#00f5d4', '--secondary-color': '#f6019d', '--accent-color': '#fee440', '--particle-color': 'rgba(0, 245, 212, 0.8)' } },
        { name: 'Synthwave', vars: { '--primary-color': '#ff79c6', '--secondary-color': '#50fa7b', '--accent-color': '#f1fa8c', '--particle-color': 'rgba(255, 121, 198, 0.8)' } },
        { name: 'Ambra', vars: { '--primary-color': '#ffc300', '--secondary-color': '#00f5d4', '--accent-color': '#ffffff', '--particle-color': 'rgba(255, 195, 0, 0.8)' } },
        { name: 'Forest', vars: { '--primary-color': '#52b788', '--secondary-color': '#d8f3dc', '--accent-color': '#b7e4c7', '--particle-color': 'rgba(82, 183, 136, 0.8)' } }
    ];
    let currentThemeIndex = 0;
    const applyTheme = () => {
        const theme = themes[currentThemeIndex];
        const root = document.documentElement;
        Object.entries(theme.vars).forEach(([key, value]) => root.style.setProperty(key, value));
        window.currentParticleColor = theme.vars['--particle-color'];
        window.initParticles();
    };
    themeSwitcher.addEventListener('click', () => {
        playSound('click');
        currentThemeIndex = (currentThemeIndex + 1) % themes.length;
        applyTheme();
    });

    const handleGuessEnter = (e) => {
        if (e.key === "Enter") {
            guessButton.click();
        }
    };

    // --- Event Listeners ---
    difficultySelect.addEventListener("change", () => { hardcoreGroup.style.display = difficultySelect.value === "hardcore" ? "block" : "none"; playSound("click"); });
    playersCountInput.addEventListener("input", updatePlayerNameInputs);
    startGameButton.addEventListener("click", () => { playSound("start"); setupGame(); });
    guessButton.addEventListener("click", handleGuess);
    guessInput.addEventListener("keyup", handleGuessEnter);
    playAgainButton.addEventListener("click", () => { playSound("click"); switchScreen("setup"); });

    // --- Inizializzazione ---
    updatePlayerNameInputs();
    switchScreen("setup");
});

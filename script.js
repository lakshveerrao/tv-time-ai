/**
 * TV Time Giver - Pure AI Edition
 * Features: Jumping Jacks, TTS Coach, Chatbot, Smart Counting, Email Workflow
 */

// Rates Configuration
const RATES = {
    pushups: { rate: 5, label: "Pushups" }, // 5 reps = 1 min
    squats: { rate: 10, label: "Squats" }, // 10 reps = 1 min

    jumpingjacks: { rate: 20, label: "Jumping Jacks" }, // 20 reps = 1 min
    bodysawplank: { rate: 20, label: "Body Saw Plank" } // 20 reps = 1 min
};

// Exercise Instructions & QA Knowledge Base
const KNOWLEDGE_BASE = {
    "pushups": "Keep your back straight. Lower body until elbows are at 90 degrees.",
    "squats": "Keep feet shoulder-width apart. Lower hips until thighs are parallel to floor. *Note: You typically cannot do these after 7 AM.*",

    "jumpingjacks": "Start with arms down/legs in. Jump to arms up/legs wide. Repeat.",
    "bodysawplank": "Start in a forearm plank. Shift your body backward by pushing through your forearms/toes, then return to center.",
    "limit": "You can earn a maximum of 10 minutes of TV time per day.",
    "bonus": "Before 7AM, you get 100% credit. After 7AM, you get 50% credit.",
    "general": "I am your AI Coach. I count your reps and correct your form."
};

// --- Speech Synthesis (Voice Coach) ---
class VoiceCoach {
    constructor() {
        this.synth = window.speechSynthesis;
        this.lastSpoken = 0;
        this.cooldown = 3000; // 3 seconds between corrections
    }

    speak(text) {
        if (!this.synth) return;

        // Don't spam corrections
        const now = Date.now();
        if (text.includes("Good") || text.includes("reps") || (now - this.lastSpoken > this.cooldown)) {
            const utter = new SpeechSynthesisUtterance(text);
            utter.rate = 1.1;
            utter.pitch = 1.0;
            this.synth.speak(utter);
            this.lastSpoken = now;
        }
    }
}

// --- Voice Assistant (Wake Word: Hey Buddy) ---
class VoiceAssistant {
    constructor(app) {
        this.app = app;
        this.model = null;
        this.recognizer = null;
        this.audioContext = null;
        this.isListeningForCommand = false;
        this.wakeWord = "hey buddy";
        this.timeoutId = null;
        this.isReady = false;

        this.initVosk();
    }

    async initVosk() {
        try {
            this.app.updateVoiceIndicator(false, "🎙️ Offline Init...");
            // Load the small English model from a verified source
            const modelUrl = 'https://ccoreilly.github.io/vosk-browser/models/vosk-model-small-en-us-0.15.tar.gz';
            this.model = await Vosk.createModel(modelUrl);

            // Optimization: Restrict vocabulary for higher accuracy and speed
            const grammar = [
                "hey", "buddy", "start", "stop", "back", "menu", "pushups", "squats",
                "crunches", "jumping", "jacks", "plank", "saw", "time", "earned", "finish", "day", "reset",
                "[unk]"
            ];

            this.recognizer = new this.model.KaldiRecognizer(16000, JSON.stringify(grammar));
            this.recognizer.setWords(true);

            this.recognizer.on("result", (item) => this.handleResult(item.result));
            this.recognizer.on("partialresult", (item) => this.handlePartialResult(item.result));

            this.isReady = true;
            this.app.updateVoiceIndicator(false, "🎙️ 'Hey Buddy'");
        } catch (err) {
            console.error("Vosk Init Error:", err);
            this.app.updateVoiceIndicator(false, "🎙️ Offline Error");
        }
    }

    async start() {
        if (!this.isReady) {
            await this.initVosk();
            if (!this.isReady) return;
        }

        try {
            if (!this.audioContext) {
                this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
                const stream = await navigator.mediaDevices.getUserMedia({
                    audio: {
                        echoCancellation: true,
                        noiseSuppression: true,
                        autoGainControl: true,
                    },
                });

                const source = this.audioContext.createMediaStreamSource(stream);
                // Reduced buffer size for faster feedback
                const processor = this.audioContext.createScriptProcessor(2048, 1, 1);

                source.connect(processor);
                processor.connect(this.audioContext.destination);

                processor.onaudioprocess = (event) => {
                    if (this.isReady && this.recognizer) {
                        this.recognizer.acceptWaveform(event.inputBuffer);
                    }
                };
            }

            if (this.audioContext.state === 'suspended') {
                await this.audioContext.resume();
            }

            this.app.updateVoiceIndicator(false, "🎙️ 'Hey Buddy'");
        } catch (err) {
            console.error("Mic Access Error:", err);
            this.app.updateVoiceIndicator(false, "🎙️ Mic Blocked");
        }
    }

    handlePartialResult(result) {
        if (!result || !result.partial) return;
        const text = result.partial.toLowerCase();

        // Instant Wake Word Detection
        if (!this.isListeningForCommand && (text.includes("buddy") || text.includes("hey buddy"))) {
            this.activate();
            this.recognizer.reset(); // Clear buffer so "buddy" doesn't bleed into command
            return;
        }

        // Instant Command Processing (while talking)
        if (this.isListeningForCommand) {
            this.processCommand(text);
        }
    }

    handleResult(result) {
        if (!result || !result.text) return;
        const text = result.text.toLowerCase();
        console.log("Assistant heard:", text);

        // Leniency: match "buddy" or "hey buddy"
        const isWake = text.includes("buddy");

        if (isWake) {
            this.activate();
            this.recognizer.reset(); // Clear buffer
            const parts = text.split("buddy");
            const command = parts[parts.length - 1].trim();
            if (command) this.processCommand(command);
        } else if (this.isListeningForCommand) {
            this.processCommand(text);
            // reset listener after a successful command to avoid double-triggering
            this.isListeningForCommand = false;
            this.app.updateVoiceIndicator(false);
        }
    }

    activate() {
        if (this.isListeningForCommand) return;
        this.isListeningForCommand = true;
        this.app.coach.speak("Yes?");
        this.app.updateVoiceIndicator(true);

        if (this.timeoutId) clearTimeout(this.timeoutId);
        this.timeoutId = setTimeout(() => {
            this.isListeningForCommand = false;
            this.app.updateVoiceIndicator(false);
        }, 6000);
    }

    processCommand(text) {
        console.log("Voice Command:", text);

        if (text.includes("pushup")) this.app.setMode('pushups');
        else if (text.includes("squat")) this.app.setMode('squats');
        else if (text.includes("crunch")) this.app.setMode('crunches');
        else if (text.includes("jumping jack")) this.app.setMode('jumpingjacks');
        else if (text.includes("plank") || text.includes("body saw")) this.app.setMode('bodysawplank');
        else if (text.includes("stop") || text.includes("back") || text.includes("menu")) this.app.backToMenu();
        else if (text.includes("time") || text.includes("earned")) {
            this.app.coach.speak(`You have earned ${this.app.todayData.earned.toFixed(1)} minutes.`);
        }
        else if (text.includes("finish") || text.includes("report")) this.app.finishAndReport();
        else if (text.includes("reset") || text.includes("new day")) this.app.resetDay();
        else return;

        this.isListeningForCommand = false;
        this.app.updateVoiceIndicator(false);
        if (this.timeoutId) clearTimeout(this.timeoutId);
    }
}

// --- Main App Logic ---
class App {
    constructor() {
        try {
            this.todayData = this.loadData();
            this.mode = null;
            this.coach = new VoiceCoach();
            this.multiplier = 1.0;

            this.state = {
                count: 0,
                stage: 'UP',
                confidence: 0,
                lastFeedback: ''
            };

            this.voiceAssistant = new VoiceAssistant(this);

            this.videoElement = document.querySelector('.camera-feed');
            this.canvasElement = document.querySelector('.canvas-overlay');
            this.canvasCtx = this.canvasElement.getContext('2d');

            this.initUI();
            this.initPose();

            // Gmail & Sheets API Config
            this.CLIENT_ID = '992206825984-3toc741fe4i7moo8eta5qp6cpmojros9.apps.googleusercontent.com'; // User provided Client ID
            this.DISCOVERY_DOCS = [
                'https://www.googleapis.com/discovery/v1/apis/gmail/v1/rest',
                'https://sheets.googleapis.com/$discovery/rest?version=v4',
                'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'
            ];
            this.SCOPES = 'https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.modify https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/drive.file';

            this.tokenClient = null;
            this.gapiInited = false;
            this.gisInited = false;
            this.pollingInterval = null;
            this.spreadsheetId = null;
            this.spreadsheetId = null;
            this.user = null;
            // FORCE the verified URL. Ignore local storage to prevent old "home" links from sticking.
            this.WEB_APP_URL = "https://script.google.com/macros/s/AKfycbxrlxnOx3kGHUqpoYmHBxRG5bVnek11ABOSybsiKTgiRctQ2qQPL5wuIX-z-hLUycc/exec";

            // Libraries will call initGapi() and initGis() when loaded
            console.log("App Class basic components initialized. Waiting for Google Libraries...");
        } catch (e) {
            console.error("CRITICAL: App Constructor failed!", e);
            alert("App failed to start. Please refresh the page.");
        }
    }

    loadData() {
        const saved = localStorage.getItem('tvTimeData_AI');
        const today = new Date().toLocaleDateString();
        // If date changed, we typically reset automatically? 
        // Or wait for user to click "Start New Day"?
        // Let's load whatever is there.
        if (saved) {
            return JSON.parse(saved);
        }
        return { date: today, earned: 0, history: [] };
    }

    saveData() {
        localStorage.setItem('tvTimeData_AI', JSON.stringify(this.todayData));
        this.updateStatsUI();
        this.syncToSheets();
    }

    resetDay() {
        if (confirm("Start a new day? This will clear all progress.")) {
            this.todayData = { date: new Date().toLocaleDateString(), earned: 0, history: [] };
            this.saveData();
            localStorage.setItem('last_sync_count', 0); // Reset sync index
            this.updateStatsUI();
            this.showMain();
            // Reset UI state
            document.querySelectorAll('.mode-btn').forEach(btn => btn.classList.remove('active'));
            this.mode = null;
            document.getElementById('exerciseFeedback').style.display = 'none';
        }
    }

    initUI() {
        this.updateStatsUI();
        this.updateInsights(); // Trigger Insights
        setInterval(() => this.updateTimeCheck(), 60000);
        this.updateTimeCheck();

        // No more tabs - Single Page View
    }

    showTab(tabName) {
        // Deprecated: Single Page Mode
        console.log("Nav to section: " + tabName);
        const section = document.getElementById(tabName + 'Section');
        if (section) section.scrollIntoView({ behavior: 'smooth' });
    }


    updateTimeCheck() {
        // Enforce 7 AM Rule (DISABLED FOR NOW via User Request)
        this.multiplier = 1.0;
        // Badge removed in Dashboard UI, logic kept for calculation only
    }

    updateStatsUI() {
        // Update Dashboard Cards
        document.getElementById('dashEarned').innerText = this.todayData.earned.toFixed(1);

        const totalReps = this.todayData.history.reduce((a, b) => a + (b.reps || 0), 0);
        document.getElementById('dashReps').innerText = totalReps;

        // Est Calories (0.1 per rep heuristic)
        document.getElementById('dashCals').innerText = (totalReps * 0.1).toFixed(0);

        // Update Log Lists (Dashboard + History)
        const logs = [document.getElementById('dashLogList'), document.getElementById('fullHistoryLog')];

        logs.forEach(logContainer => {
            if (!logContainer) return;
            logContainer.innerHTML = '';

            this.todayData.history.slice().reverse().forEach(item => {
                const div = document.createElement('div');
                div.className = 'activity-item';
                div.innerHTML = `
                    <div style="display:flex; align-items:center; gap:12px;">
                        <div class="activity-icon">💪</div>
                        <div>
                            <div style="font-weight:bold;">${item.desc}</div>
                            <small style="color:var(--text-muted);">${item.reps || 0} reps</small>
                        </div>
                    </div>
                    <div style="color:var(--success); font-weight:bold;">+${item.gain.toFixed(1)}m</div>
                `;
                logContainer.appendChild(div);
            });
        });
    }

    updateInsights() {
        const textEl = document.getElementById('coachInsightText');
        if (!textEl) return;

        const hour = new Date().getHours();
        const earned = this.todayData.earned;

        let msg = "Welcome back! Ready to train?";

        if (earned <= 0) {
            msg = "🌱 Start your day with 20 Jumping Jacks to earn your first minute!";
        } else if (earned < 5) {
            msg = "🔥 You're heating up! 5 more minutes to reach the halfway mark.";
        } else if (earned >= 10) {
            msg = "🎉 Daily Goal Reached! You're a machine!";
        }

        // Time context
        if (hour < 7) {
            msg += " (Early Bird: Squats are 100% value!)";
        } else {
            msg += " (Note: Squats are 50% value after 7am.)";
        }

        textEl.innerText = msg;
    }

    resetDay() {
        console.log("resetDay called");
        try {
            if (!confirm("Are you sure you want to start a new day? This will clear your current time and history.")) return;

            this.todayData = {
                date: new Date().toLocaleDateString(),
                earned: 0,
                history: []
            };
            this.saveData();
            this.updateStatsUI();
            this.updateInsights();
            alert("Day Reset! Ready for a fresh start. ☀️");
        } catch (e) {
            console.error("Reset Error:", e);
            alert("Error resetting day: " + e.message);
        }
    }

    setMode(mode) {
        if (!mode) {
            document.querySelectorAll('.mode-btn').forEach(btn => btn.classList.remove('active'));
            this.mode = null;
            return;
        }

        this.mode = mode;
        this.state = { count: 0, stage: 'START', confidence: 0 };

        document.querySelectorAll('.mode-btn').forEach(btn => btn.classList.remove('active'));
        const activeBtn = document.querySelector(`.mode-btn[onclick*="${mode}"]`);

        // Anti-Cheat Init
        this.noseHistory = [];
        this.isCheating = false;

        if (activeBtn) activeBtn.classList.add('active');

        document.getElementById('exerciseFeedback').style.display = 'block';
        document.getElementById('repCount').innerText = 0;
        document.getElementById('repLabel').innerText = RATES[mode].label;
        document.getElementById('coachFeedback').innerText = "Get Ready...";

        this.coach.speak(`Selected ${RATES[mode].label}. Let's go.`);

        this.startCamera();
    }

    backToMenu() {
        if (this.camera) this.camera.stop();
        document.getElementById('exerciseFeedback').style.display = 'none';

        // Remove active class from all buttons
        document.querySelectorAll('.mode-btn').forEach(btn => btn.classList.remove('active'));

        this.mode = null;
        this.coach.speak("Stopped.");

        // Scroll to top or just stay
    }

    updateVoiceIndicator(active, msg = null) {
        const indicator = document.getElementById('voiceIndicator');
        if (!indicator) return;
        if (active) {
            indicator.classList.add('active');
            indicator.innerText = msg || "🎙️ Listening...";
        } else {
            indicator.classList.remove('active');
            indicator.innerText = msg || "🎙️ 'Hey Buddy'";
        }
    }

    // --- Reporting & Approval Workflow ---

    async finishAndReport() {
        if (this.todayData.earned <= 0) {
            alert("You haven't earned any time yet!");
            return;
        }

        // Prompt for Web App URL if missing OR invalid (contains 'home')
        if (!this.WEB_APP_URL || this.WEB_APP_URL.includes('/home') || !this.WEB_APP_URL.includes('/exec')) {
            let msg = "Please enter the 'Web App URL' from your Apps Script deployment.\n\nIMPORTANT: It should end in '/exec'. Do NOT use the link from your browser address bar.";

            if (this.WEB_APP_URL && this.WEB_APP_URL.includes('/home')) {
                msg = "ERROR: You entered the Dashboard link (ends in /home). We need the App URL (ends in /exec).\n\nPlease try again:";
            }

            const url = prompt(msg);
            if (url && url.startsWith("https://") && url.includes("/exec")) {
                this.WEB_APP_URL = url.trim();
                localStorage.setItem('tv_time_webapp_url', this.WEB_APP_URL);
            } else {
                alert("Invalid URL. It must start with 'https://' and end with '/exec'. Cannot send magic buttons.");
                this.WEB_APP_URL = null; // Clear bad input
                localStorage.removeItem('tv_time_webapp_url');
                return;
            }
        }

        try {
            // Check GAPI
            if (!gapi.client || !gapi.client.sheets || !gapi.client.gmail) {
                alert("CRITICAL: Google Libraries not loaded. Please refresh the page.");
                return;
            }

            console.log("Starting Finish Flow...");
            alert("Step 1: Syncing to Google Sheets...");

            // Switch to Waiting Screen
            document.getElementById('mainAppLayout').style.display = 'none';
            document.getElementById('approvalView').style.display = 'flex';

            // Write "PENDING"
            await this.syncToSheets("PENDING");

            // Send Email
            await this.sendEmail();

            // Start Polling
            if (this.pollingInterval) clearInterval(this.pollingInterval);
            this.pollingInterval = setInterval(() => this.pollSheetStatus(), 5000);

        } catch (e) {
            console.error("Finish Flow Error:", e);
            alert("Process Failed: " + JSON.stringify(e));
            // Restore UI
            document.getElementById('mainAppLayout').style.display = 'block';
            document.getElementById('approvalView').style.display = 'none';
        }
    }

    async sendEmail() {
        alert("Step 2: Preparing Email...");
        const email = "venky24aug@gmail.com";
        const cc = "Sunshinegalsmiles4u@gmail.com";
        const bcc = "lakshveeronline@gmail.com";
        const subject = "TV Time Request: " + this.todayData.earned.toFixed(1) + " mins";

        // SAFETY CHECK: If Row ID is missing, try to find it or fail gracefully
        if (!this.lastSyncedRow) {
            console.warn("Row ID missing!");
            alert("Warning: Could not get Row ID from Sheets. Email buttons might not match.");
            // We continue anyway but warn.
        }

        const historyText = this.todayData.history.map(h => `- ${h.desc} (+${h.gain}m)`).join('<br>');

        // Interactive Buttons linking to Web App

        // Calculate Total Reps for Email
        const totalReps = this.todayData.history.reduce((sum, item) => sum + (item.reps || 0), 0);

        const bodyHtml = `
            <h2>TV Time Request</h2>
            <p><strong>Total Earned:</strong> ${this.todayData.earned.toFixed(1)} minutes</p>
            <p><strong>Total Reps:</strong> ${totalReps}</p>
            <p><strong>Activities:</strong><br>${historyText}</p>
            <br>
            <p>Please click a button to approve/reject (No Reply Needed):</p>
            <a href="${this.WEB_APP_URL}?action=APPROVE&row=${this.lastSyncedRow}&sheet_id=${this.spreadsheetId}" style="background-color:green;color:white;padding:15px 30px;text-decoration:none;font-size:18px;border-radius:5px;margin-right:20px;">WATCH TV (Approve)</a>
            <a href="${this.WEB_APP_URL}?action=REJECT&row=${this.lastSyncedRow}&sheet_id=${this.spreadsheetId}" style="background-color:red;color:white;padding:15px 30px;text-decoration:none;font-size:18px;border-radius:5px;">NO TV (Decline)</a>
        `;

        const utf8Subject = `=?utf-8?B?${btoa(subject)}?=`;
        const messageParts = [
            `To: ${email}`,
            `Cc: ${cc}`,
            `Bcc: ${bcc}`,
            `Subject: ${utf8Subject}`,
            `Content-Type: text/html; charset=utf-8`,
            `MIME-Version: 1.0`,
            ``,
            bodyHtml
        ];
        const message = messageParts.join('\n');

        // Base64Url Encode
        const raw = btoa(unescape(encodeURIComponent(message))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

        try {
            await gapi.client.gmail.users.messages.send({
                'userId': 'me',
                'resource': { 'raw': raw }
            });
            console.log("Email Sent Successfully.");
            alert("Email sent! Check your inbox and click the button.");
        } catch (err) {
            console.error("Email Send Error:", err);
            if (err.status === 401) {
                alert("Permission Missing! Please Logout and Sign In again to allow Email Sending.");
            } else {
                alert("Error sending email: " + (err.result?.error?.message || "Unknown error"));
            }
        }
    }

    async pollSheetStatus() {
        if (!this.spreadsheetId) return;

        console.log("Polling Sheet for status...");
        try {
            const range = 'Log!A:E';
            const response = await gapi.client.sheets.spreadsheets.values.get({
                spreadsheetId: this.spreadsheetId,
                range: range,
            });

            const rows = response.result.values;
            if (!rows || rows.length < 2) return;

            // We should ideally track the exact row, but last row is safe for now
            const lastRow = rows[rows.length - 1];
            // If we just synced, this is our row.
            // But we need to pass ROW NUMBER to the Web App.
            // "rows.length" is the row number of the last row (1-indexed? No 0-indexed array, so length is count).
            // Sheet Row 1 is Header. Row 2 is index 0 in data? No.
            // values.get returns array of arrays.
            // If there are N rows in sheet, array length is N.
            // The last row index in Sheet is N.
            this.lastSyncedRow = rows.length;

            const status = lastRow[4]; // Column 5

            if (status === 'APPROVED') {
                this.handleParentDecision(true);
            } else if (status === 'REJECTED') {
                this.handleParentDecision(false);
            }
        } catch (err) {
            console.error("Polling Error:", err);
        }
    }

    // Deprecated methods removed to avoid duplicates

    async checkGmailApproval() {
        try {
            const response = await gapi.client.gmail.users.messages.list({
                'userId': 'me',
                'q': 'subject:(Re: TV Time Request) is:unread',
                'maxResults': 5
            });

            const messages = response.result.messages;
            if (!messages || messages.length === 0) return;

            for (const msg of messages) {
                const message = await gapi.client.gmail.users.messages.get({
                    'userId': 'me',
                    'id': msg.id
                });

                const body = message.result.snippet.toLowerCase(); // Snippet is usually enough for "approve"/"decline"
                console.log("Checking reply:", body);

                if (body.includes("approve") || body.includes("watch tv")) {
                    this.handleParentDecision(true);
                    this.markAsRead(msg.id);
                    break;
                } else if (body.includes("decline") || body.includes("no tv")) {
                    this.handleParentDecision(false);
                    this.markAsRead(msg.id);
                    break;
                }
            }
        } catch (err) {
            console.error("Gmail Polling Error:", err);
        }
    }

    async markAsRead(id) {
        try {
            await gapi.client.gmail.users.messages.batchModify({
                'userId': 'me',
                'ids': [id],
                'removeLabelIds': ['UNREAD']
            });
        } catch (err) { console.error("Mark read error", err); }
    }

    // --- Google API Handlers ---
    initGapi() {
        if (typeof gapi === 'undefined') return;
        gapi.load('client', async () => {
            try {
                await gapi.client.init({
                    discoveryDocs: this.DISCOVERY_DOCS,
                });
                this.gapiInited = true;
                this.maybeEnableAuth();
            } catch (err) {
                console.error("GAPI Init fail:", err);
            }
        });
    }

    initGis() {
        if (typeof google === 'undefined' || !google.accounts) return;
        this.tokenClient = google.accounts.oauth2.initTokenClient({
            client_id: this.CLIENT_ID,
            scope: 'https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.modify https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/drive.file',
            callback: '', // defined in handleAuthClick
        });
        this.gisInited = true;
        this.maybeEnableAuth();
    }

    maybeEnableAuth() {
        if (this.gapiInited && this.gisInited) {
            console.log("Google Libraries Ready.");
            // Check if already logged in via session
            const token = localStorage.getItem('google_token');
            if (token) {
                gapi.client.setToken({ access_token: token });
                this.onAuthSuccess();
            }
        }
    }

    handleAuthClick() {
        // DEBUGGER
        console.log("Auth Clicked");

        if (window.location.protocol === 'file:') {
            alert("Google Login will NOT work on file://. Please run the app through a local server (e.g., http://localhost:8000).");
            return;
        }

        if (!this.tokenClient) {
            console.warn("Auth client not ready. Retrying init...");
            alert("Google Library not fully loaded. Retrying...");
            this.initGis();
            if (!this.tokenClient) {
                alert("STILL Not ready. Check your internet connection or console for errors.");
                return;
            }
        }

        this.tokenClient.callback = async (resp) => {
            if (resp.error !== undefined) {
                console.error("Auth Error:", resp);
                throw (resp);
            }
            localStorage.setItem('google_token', resp.access_token);
            this.onAuthSuccess();
        };

        if (gapi.client.getToken() === null) {
            this.tokenClient.requestAccessToken({ prompt: 'consent' });
        } else {
            this.tokenClient.requestAccessToken({ prompt: '' });
        }
    }

    async onAuthSuccess() {
        document.getElementById('loginView').style.display = 'none';
        document.getElementById('mainAppLayout').style.display = 'block'; // New Layout ID
        this.initUI();
        // Fetch User Profile
        try {
            const resp = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
                headers: { 'Authorization': `Bearer ${gapi.client.getToken().access_token}` }
            });
            this.user = await resp.json();
            document.getElementById('userName').innerText = `Hi, ${this.user.given_name}`;
            if (this.user.picture) {
                const img = document.getElementById('userAvatar');
                img.src = this.user.picture;
                img.style.display = 'block';
            }
        } catch (e) {
            console.error("Profile load fail", e);
            if (e.status === 401) {
                console.warn("Token invalid or scopes changed. Forcing Logout.");
                localStorage.removeItem('google_token');
                alert("New features added! Please Sign In again to approve them.");
                location.reload();
                return;
            }
        }

        this.findOrCreateSheet();
        if (this.status === 'waiting') this.startGmailPolling();
    }

    handleLogout() {
        localStorage.removeItem('google_token');
        location.reload();
    }

    async findOrCreateSheet() {
        try {
            // Find spreadsheet named "TV_Time_Data"
            const response = await gapi.client.drive.files.list({
                q: "name = 'TV_Time_Data' and mimeType = 'application/vnd.google-apps.spreadsheet'",
                fields: 'files(id, name)'
            });

            if (!response || !response.result || !response.result.files) {
                console.warn("Drive List failed or empty (likely 401).");
                return;
            }

            const files = response.result.files;
            if (files && files.length > 0) {
                this.spreadsheetId = files[0].id;
                console.log("Sheet found:", this.spreadsheetId);
            } else {
                // Create it
                const createResponse = await gapi.client.sheets.spreadsheets.create({
                    resource: {
                        properties: { title: 'TV_Time_Data' },
                        sheets: [{
                            properties: { title: 'Log' },
                            data: [{
                                startRow: 0,
                                startColumn: 0,
                                rowData: [{
                                    values: [
                                        { userEnteredValue: { stringValue: 'Timestamp' } },
                                        { userEnteredValue: { stringValue: 'Date' } },
                                        { userEnteredValue: { stringValue: 'Exercise' } },
                                        { userEnteredValue: { stringValue: 'Earned_Mins' } },
                                        { userEnteredValue: { stringValue: 'Daily_Total' } }
                                    ]
                                }]
                            }]
                        }]
                    }
                });
                this.spreadsheetId = createResponse.result.spreadsheetId;
                console.log("Created new Sheet:", this.spreadsheetId);
            }
        } catch (err) {
            console.error("Sheets Init Error (Make sure Drive API and Sheets API are enabled):", err);
        }
    }

    async syncToSheets(statusArg = "PENDING") {
        if (!this.spreadsheetId) await this.findOrCreateSheet();
        if (!this.spreadsheetId) return;

        // Prevent duplicates if not forcing update
        const currentCount = this.todayData.earned;
        const lastSynced = parseFloat(localStorage.getItem('last_sync_count') || '0');

        if (currentCount !== lastSynced || statusArg === "PENDING") {
            const date = new Date().toLocaleString();
            const earned = this.todayData.earned.toFixed(1);

            // Calculate Total Reps
            const totalReps = this.todayData.history.reduce((sum, item) => sum + (item.reps || 0), 0);

            const history = this.todayData.history.map(h => `${h.desc} (+${h.gain}m)`).join('\n') + `\n\nTOTAL REPS: ${totalReps}`;

            // Writing: Date, User, Earned, History (with Reps), Status
            const values = [[date, this.user.given_name, earned, history, statusArg]];

            try {
                var params = {
                    spreadsheetId: this.spreadsheetId,
                    range: 'Log!A:E',
                    valueInputOption: 'USER_ENTERED',
                    insertDataOption: 'INSERT_ROWS',
                    resource: {
                        values: values
                    }
                };

                const response = await gapi.client.sheets.spreadsheets.values.append(params);

                // Capture the Row Number for the Email Buttons!
                // response.result.updates.updatedRange like "Log!A15:E15"
                const updatedRange = response.result.updates.updatedRange;
                if (updatedRange) {
                    // regex to match the digits after the last ! and letters
                    const match = updatedRange.match(/[A-Z]+(\d+)/);
                    if (match && match[1]) {
                        this.lastSyncedRow = parseInt(match[1]);
                        console.log("Synced to Row:", this.lastSyncedRow);
                    }
                }

                localStorage.setItem('last_sync_count', currentCount.toString());
                console.log("Synced to Sheet.");
                return true;
            } catch (err) {
                console.error("Sheets Sync Error:", err);
                // SHOW THE REAL ERROR to the user
                const msg = err.result?.error?.message || err.message || JSON.stringify(err);
                alert("API Error: " + msg);
                return false;
            }
        }
        return true; // No sync needed is considered "success"
    }

    cancelReport() {
        if (this.pollingInterval) clearInterval(this.pollingInterval);
        document.getElementById('mainAppView').style.display = 'grid';
        document.getElementById('approvalView').style.display = 'none';
    }

    handleParentDecision(approved) {
        document.getElementById('approvalView').style.display = 'none';
        if (approved) {
            document.getElementById('successView').style.display = 'flex';
            document.getElementById('finalTime').innerText = this.todayData.earned.toFixed(1);
        } else {
            document.getElementById('failView').style.display = 'flex';
        }
    }

    showMain() {
        document.getElementById('successView').style.display = 'none';
        document.getElementById('failView').style.display = 'none';
        document.getElementById('approvalView').style.display = 'none';
        document.getElementById('mainAppLayout').style.display = 'block';
    }

    // --- CV & Camera ---
    startCamera() {
        if (this.isCameraRunning) return;
        const camera = new Camera(this.videoElement, {
            onFrame: async () => { await this.pose.send({ image: this.videoElement }); },
            width: 640, height: 480
        });
        camera.start();
        this.isCameraRunning = true;
        document.getElementById('camStatusText').innerText = 'AI Active';
        document.getElementById('camStatusDot').classList.add('active');
    }

    async initPose() {
        this.pose = new Pose({ locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}` });
        this.pose.setOptions({ modelComplexity: 1, smoothLandmarks: true, minDetectionConfidence: 0.5, minTrackingConfidence: 0.5 });
        this.pose.onResults((r) => this.onResults(r));
    }

    calculateAngle(a, b, c) {
        const radians = Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
        let angle = Math.abs(radians * 180.0 / Math.PI);
        if (angle > 180.0) angle = 360 - angle;
        return angle;
    }

    onResults(results) {
        this.canvasCtx.clearRect(0, 0, this.canvasElement.width, this.canvasElement.height);

        if (results.poseLandmarks) {
            // 1. Draw Skeleton (Fine Body Tracking)
            // Draw Connectors
            drawConnectors(this.canvasCtx, results.poseLandmarks, POSE_CONNECTIONS,
                { color: 'rgba(255, 255, 255, 0.6)', lineWidth: 4 });

            // Draw Landmarks (Joints) with distinct style
            drawLandmarks(this.canvasCtx, results.poseLandmarks,
                { color: '#ef4444', lineWidth: 2, radius: 4 }); // Red Joints

            // 2. Anti-Cheat Check (Must pass to count reps)
            if (this.checkAntiCheat(results.poseLandmarks)) {
                this.processExercise(results.poseLandmarks);
            }
        }
    }

    checkAntiCheat(lm) {
        const nose = lm[0];
        const feedback = document.getElementById('coachFeedback');

        // A. Face Visibility Check
        if (!nose || nose.visibility < 0.8) {
            feedback.innerText = "👀 Face Not Visible!";
            feedback.style.color = "red";
            return false;
        }

        // B. Liveness / Micro-Movement Check (Anti-Photo)
        // Store last 50 frames of Nose Y position
        this.noseHistory.push(nose.y);
        if (this.noseHistory.length > 50) this.noseHistory.shift();

        // Calculate Variance (How much is it moving?)
        if (this.noseHistory.length === 50) {
            const mean = this.noseHistory.reduce((a, b) => a + b) / 50;
            const variance = this.noseHistory.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / 50;

            // Threshold: If variance is SUPER low, it's a static image (or frozen video)
            // Normal holding still is ~0.0001. A photo is 0.000000.
            if (variance < 0.000005) {
                feedback.innerText = "⚠️ Move a little! (Anti-Cheat)";
                feedback.style.color = "orange";
                return false;
            }
        }

        // If passed checks, clear warnings (unless exercise logic sets it)
        if (feedback.innerText.includes("Face") || feedback.innerText.includes("Move")) {
            feedback.innerText = "";
            feedback.style.color = "var(--warning)";
        }

        return true;
    }

    processExercise(lm) {
        if (!this.mode) return;
        const get = (i) => lm[i];
        let angle = 0;
        let feedback = "";

        if (get(11).visibility < 0.5 || get(23).visibility < 0.5) return;

        if (this.mode === 'pushups') {
            angle = this.calculateAngle(get(11), get(13), get(15));
            if (angle > 160) this.state.stage = "UP";
            if (angle < 90 && this.state.stage === "UP") {
                this.state.stage = "DOWN";
                this.countRep();
            } else if (angle < 140 && angle > 100 && this.state.stage === "UP") {
                feedback = "Go Lower!";
            }
        }
        else if (this.mode === 'squats') {
            angle = this.calculateAngle(get(23), get(25), get(27));
            if (angle > 170) this.state.stage = "UP";
            if (angle < 90 && this.state.stage === "UP") {
                this.state.stage = "DOWN";
                this.countRep();
            } else if (angle < 140 && angle > 100 && this.state.stage === "UP") {
                feedback = "Deeper!";
            }
        }

        else if (this.mode === 'jumpingjacks') {
            const handY = (get(15).y + get(16).y) / 2;
            const noseY = get(0).y;
            const shoulderY = (get(11).y + get(12).y) / 2;
            const ankleDist = Math.abs(get(27).x - get(28).x);
            const shoulderWidth = Math.abs(get(11).x - get(12).x);

            const isHandsUp = handY < noseY;
            const isHandsDown = handY > shoulderY;
            const isLegsOut = ankleDist > (shoulderWidth * 1.5);
            const isLegsIn = ankleDist < shoulderWidth;

            if (isHandsUp && isLegsOut) this.state.stage = "OUT";
            if (isHandsDown && isLegsIn && this.state.stage === "OUT") {
                this.state.stage = "IN";
                this.countRep();
            }
        }
        else if (this.mode === 'bodysawplank') {
            const shoulder = get(11); // Left Shoulder
            const elbow = get(13); // Left Elbow
            const hip = get(23); // Left Hip

            // horizontal offset between shoulder and elbow
            const offset = Math.abs(shoulder.x - elbow.x);
            const armLen = Math.sqrt(Math.pow(shoulder.x - elbow.x, 2) + Math.pow(shoulder.y - elbow.y, 2));

            // Detection: Forward (Shoulder over Elbow) vs Backward (Shoulder behind Elbow)
            if (offset < 0.2 * armLen) this.state.stage = "FORWARD";
            if (offset > 0.5 * armLen && this.state.stage === "FORWARD") {
                this.state.stage = "BACKWARD";
                this.countRep();
            }

            // Form Correction: Keep Hips Stable
            if (hip.y < shoulder.y - 0.1) feedback = "Lower your hips!";
            if (hip.y > shoulder.y + 0.2) feedback = "Don't sag your hips!";
        }

        if (feedback && feedback !== this.state.lastFeedback) {
            this.coach.speak(feedback);
            this.state.lastFeedback = feedback;
            document.getElementById('coachFeedback').innerText = feedback;
        } else if (!feedback) {
            document.getElementById('coachFeedback').innerText = "";
        }
    }

    countRep() {
        this.state.count++;
        document.getElementById('repCount').innerText = this.state.count;
        this.coach.speak("Correct! " + this.state.count.toString());

        const rate = RATES[this.mode].rate;
        if (this.state.count % rate === 0) {
            this.addTime(1, this.mode);
            this.coach.speak("One minute earned!");
        }
    }

    addTime(mins, type) {
        // Enforce Multiplier here!
        const gain = mins * this.multiplier;

        if (this.todayData.earned + gain <= 10) {
            this.todayData.earned += gain;
            this.todayData.history.push({ desc: `${RATES[type].label} Set`, gain: gain, reps: RATES[type].rate });
            this.saveData();
        } else {
            this.coach.speak("Daily limit reached.");
        }
    }
}

// --- Chatbot Logic ---
function sendChat() {
    const input = document.getElementById('chatInput');
    const text = input.value.trim().toLowerCase();
    if (!text) return;
    addMessage(input.value, 'user');
    input.value = '';

    let response = "I'm not sure about that. Try asking about exercises or rules.";
    if (text.includes("pushup")) response = KNOWLEDGE_BASE.pushups;
    else if (text.includes("squat")) response = KNOWLEDGE_BASE.squats;
    else if (text.includes("jump") || text.includes("jack")) response = KNOWLEDGE_BASE.jumpingjacks;
    else if (text.includes("saw") || text.includes("plank")) response = KNOWLEDGE_BASE.bodysawplank;
    else if (text.includes("limit") || text.includes("max")) response = KNOWLEDGE_BASE.limit;
    else if (text.includes("early") || text.includes("time") || text.includes("bonus")) response = KNOWLEDGE_BASE.bonus;
    else if (text.includes("hello") || text.includes("hi")) response = KNOWLEDGE_BASE.general;

    setTimeout(() => addMessage(response, 'ai'), 500);
}

function addMessage(text, sender) {
    const list = document.getElementById('chatMessages');
    const div = document.createElement('div');
    div.className = `chat-msg ${sender}`;
    div.innerText = text;
    list.appendChild(div);
    list.scrollTop = list.scrollHeight;
    if (sender === 'ai') new VoiceCoach().speak(text);
}

function handleChatEnter(e) { if (e.key === 'Enter') sendChat(); }

// --- Info Modal ---
function showInfo(key, e) {
    e.stopPropagation();
    document.getElementById('modalTitle').innerText = RATES[key].label;
    document.getElementById('modalBody').innerHTML = `<p>${KNOWLEDGE_BASE[key]}</p><br><p><strong>Rate:</strong> ${RATES[key].rate} reps = 1 min TV.</p>`;
    document.getElementById('infoModal').style.display = "block";
}
function closeInfo() { document.getElementById('infoModal').style.display = "none"; }
window.onclick = function (event) { if (event.target == document.getElementById('infoModal')) closeInfo(); }

// Initialize App globally so HTML buttons can access it
window.app = new App();
console.log("TV Time App Initialized. 7 AM Rule is DISABLED (100% Mode).");

// --- Designer Mode / Layout Editor ---
App.prototype.toggleDesignerMode = function () {
    this.designerMode = !this.designerMode;
    document.body.classList.toggle('designer-mode');

    const btn = document.getElementById('designerToggle');
    btn.innerHTML = this.designerMode ? "💾" : "✏️";
    if (!this.designerMode) {
        // Save on Exit
        this.saveLayout();
        alert("Layout Saved!");
    }

    const editableTags = ['h1', 'h2', 'h3', 'p', 'span', 'div'];

    // Toggle Content Editable
    document.querySelectorAll('#mainAppLayout h1, #mainAppLayout h2, #mainAppLayout h3, #mainAppLayout p, #mainAppLayout span').forEach(el => {
        if (el.id === 'designerToggle') return; // Skip the button itself
        el.contentEditable = this.designerMode;
    });

    // Toggle Draggable Sections
    const container = document.getElementById('mainAppLayout'); // The container of sections
    // Note: In single page mode, we have querySelectorAll('section') inside main
    const sections = document.querySelectorAll('main > section');

    sections.forEach(sec => {
        sec.draggable = this.designerMode;
        if (this.designerMode) {
            sec.addEventListener('dragstart', this.handleDragStart);
            sec.addEventListener('dragover', this.handleDragOver);
            sec.addEventListener('drop', this.handleDrop);
            sec.addEventListener('dragenter', this.handleDragEnter);
            sec.addEventListener('dragleave', this.handleDragLeave);
        } else {
            sec.removeEventListener('dragstart', this.handleDragStart);
            sec.removeEventListener('dragover', this.handleDragOver);
            sec.removeEventListener('drop', this.handleDrop);
        }
    });

    // Also Cards in Stats Grid
    const cards = document.querySelectorAll('.stat-card');
    cards.forEach(card => {
        card.draggable = this.designerMode;
        if (this.designerMode) {
            card.addEventListener('dragstart', this.handleDragStart);
            card.addEventListener('dragover', this.handleDragOver);
            card.addEventListener('drop', this.handleDrop);
        } else {
            card.removeEventListener('dragstart', this.handleDragStart);
        }
    });
};

/* Drag & Drop Handlers (Bound to 'this' effectively via the class instance if planned right, 
   but since these are DOM events, 'this' is the element. We need careful handling.) 
   Actually, let's define them as standalone helpers or bind them. */

let dragSrcEl = null;

App.prototype.handleDragStart = function (e) {
    dragSrcEl = this;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', this.outerHTML);
    this.classList.add('dragging');
};

App.prototype.handleDragOver = function (e) {
    if (e.preventDefault) e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    return false;
};

App.prototype.handleDragEnter = function (e) {
    this.classList.add('over');
};

App.prototype.handleDragLeave = function (e) {
    this.classList.remove('over');
};

App.prototype.handleDrop = function (e) {
    if (e.stopPropagation) e.stopPropagation();

    if (dragSrcEl !== this) {
        // Simple Swap Logic? Or Reordering?
        // Swap Outer HTML is tricky because it destroys listeners.
        // Better: Insert Before/After

        // If we are dropping ONTO 'this', put 'dragSrcEl' before 'this'
        // Check if same parent
        if (dragSrcEl.parentNode === this.parentNode) {
            // Basic reorder: Swap positions
            // Convert node list to array to find indexes
            const parent = this.parentNode;
            const children = Array.from(parent.children);
            const srcIndex = children.indexOf(dragSrcEl);
            const targetIndex = children.indexOf(this);

            if (srcIndex < targetIndex) {
                parent.insertBefore(dragSrcEl, this.nextSibling);
            } else {
                parent.insertBefore(dragSrcEl, this);
            }
        }
    }

    document.querySelectorAll('.dragging').forEach(el => el.classList.remove('dragging'));
    document.querySelectorAll('.over').forEach(el => el.classList.remove('over'));

    return false;
};

App.prototype.saveLayout = function () {
    // Save Section Order
    const main = document.querySelector('main');
    if (!main) return;

    const sectionIds = Array.from(main.querySelectorAll('section')).map(el => el.id);
    localStorage.setItem('tv_layout_sections', JSON.stringify(sectionIds));

    // Save Stat Card Order?
    // Let's stick to sections for now as it's the biggest visual change.

    // Save Text Edits?
    // This is hard because we need unique IDs for every text element. 
    // We'll skip deep text persistence for now (too complex for this snippet) 
    // and focus on Layout Reordering.
};

App.prototype.loadLayout = function () {
    const saved = localStorage.getItem('tv_layout_sections');
    if (saved) {
        try {
            const ids = JSON.parse(saved);
            const main = document.querySelector('main');
            if (!main) return;

            ids.forEach(id => {
                const el = document.getElementById(id);
                if (el) {
                    main.appendChild(el); // Appending moves it to the end, effectively sorting
                }
            });
            console.log("Layout Restored.");
        } catch (e) { console.error("Layout load error", e); }
    }
};

// Auto-Load Layout on Init
const originalInit = App.prototype.initUI;
App.prototype.initUI = function () {
    originalInit.call(this); // Call original
    this.loadLayout(); // Then apply layout
};

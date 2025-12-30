// --- CONFIG ---
const TARGET_HOUR = 8;
const TARGET_MINUTE = 20;

const IMAGES = ['02.png', '39.png', '32.png', '08.png'];

// --- STATE ---
let isActive = false;
let wakeLock = null;
let timerInterval = null;
let lastSeconds = -1; // To track second changes

// --- DOM ---
const countdownEl = document.getElementById('countdown');
const timeEl = document.getElementById('current-time');
const imgEl = document.getElementById('status-img');
const textEl = document.getElementById('status-text');
const startBtn = document.getElementById('start-btn');
const statusEl = document.getElementById('active-status');

// --- INIT ---
function initApp() {
    isActive = true;
    startBtn.classList.add('hidden');
    statusEl.classList.remove('hidden');

    // First speak to unlock audio context on mobile
    speak("上學戰鬥模式，啟動！");
    requestWakeLock();

    // Start Loop
    runLoop();
    timerInterval = setInterval(runLoop, 1000);
}

function runLoop() {
    const now = new Date();
    const target = new Date();
    target.setHours(TARGET_HOUR, TARGET_MINUTE, 0, 0);

    // Update Clock
    const timeStr = now.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' });
    timeEl.innerText = `現在 ${timeStr}`;

    // Calculate Diff
    let diff = Math.floor((target - now) / 1000); // Seconds

    // LATE CASE
    if (diff < 0) {
        handleLateState(Math.abs(diff));
        return;
    }

    // NORMAL CASE
    updateDisplay(diff);

    // NAGGING LOGIC
    if (isActive) {
        checkNagging(diff);
    }
}

function updateDisplay(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;

    // Format MM:SS (Show HH if needed, but requirements said MM:SS mostly)
    // If > 1 hour, maybe show HH:MM:SS, but intended for morning.
    // Let's stick to MM:SS if < 1 hour.

    let text = "";
    if (h > 0) {
        text = `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    } else {
        text = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    countdownEl.innerText = text;
    document.body.classList.remove('late-mode');
}

function handleLateState(secondsLate) {
    countdownEl.innerText = "LATE!";
    document.body.classList.add('late-mode');
    textEl.innerText = "遲到了！遲到了！快滾出門！";
    imgEl.src = IMAGES[Math.floor(Math.random() * IMAGES.length)];

    // Annoy user every 10 seconds if late
    if (isActive && secondsLate % 10 === 0) {
        speak("遲到了！快點出門！");
    }
}

// --- NAGGING SYSTEM ---
function checkNagging(diffSeconds) {
    const m = Math.floor(diffSeconds / 60);
    const s = diffSeconds % 60;

    // Avoid duplicate triggers in same second
    if (s === lastSeconds) return;
    lastSeconds = s;

    let shouldSpeak = false;
    let message = "";

    // RULE 1: > 20 mins left -> Every 5 mins
    if (m >= 20) {
        if (m % 5 === 0 && s === 0) {
            shouldSpeak = true;
            message = `現在時間 ${new Date().getHours()}點${new Date().getMinutes()}分，還剩 ${m} 分鐘。`;
        }
    }
    // RULE 2: < 20 mins left -> Every 1 min
    else if (m < 20 && m >= 5) {
        if (s === 0) {
            shouldSpeak = true;
            message = `注意！只剩 ${m} 分鐘！快點動作！`;
        }
    }
    // RULE 3: < 5 mins left -> Every 30 seconds
    else if (m < 5) {
        if (s % 30 === 0) {
            shouldSpeak = true;
            if (m === 0 && s < 30) {
                message = `剩最後 ${s} 秒！快跑！`;
            } else {
                message = `快遲到了！剩 ${m} 分鐘！`;
            }
        }
    }

    if (shouldSpeak) {
        speak(message);
        changeVisuals(message);
    }
}

function changeVisuals(msg) {
    // Random Image
    const randomImg = IMAGES[Math.floor(Math.random() * IMAGES.length)];
    imgEl.src = randomImg;
    textEl.innerText = msg;
}

// --- UTILS ---
function speak(text) {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'zh-TW';
    u.rate = 1.1; // Slightly faster for urgency
    window.speechSynthesis.speak(u);
}

async function requestWakeLock() {
    try {
        if ('wakeLock' in navigator) {
            wakeLock = await navigator.wakeLock.request('screen');
            wakeLock.addEventListener('release', () => {
                console.log('Wake Lock released');
            });
        }
    } catch (err) {
        console.error(`${err.name}, ${err.message}`);
    }
}

// --- HANDLE VISIBILITY ---
document.addEventListener('visibilitychange', () => {
    if (wakeLock !== null && document.visibilityState === 'visible') {
        requestWakeLock();
    }
});

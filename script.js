// --- CONFIG ---
const MODE_CONFIG = {
    standard: { long: 5, medium: 1, short: 30 }, // Minutes, Minutes, Seconds
    gentle: { long: 10, medium: 5, short: 60 },
    hell: { long: 2, medium: 0.5, short: 10 }
};

const IMAGES = ['02.png', '39.png', '32.png', '08.png'];

// --- STATE ---
let isActive = false;
let wakeLock = null;
let timerInterval = null;
let lastSeconds = -1;
let targetHour = 8;
let targetMinute = 0;
let nagIntensity = 'standard';

// --- DOM ---
const countdownEl = document.getElementById('countdown');
const timeEl = document.getElementById('current-time');
const imgEl = document.getElementById('status-img');
const textEl = document.getElementById('status-text');
const startBtn = document.getElementById('start-btn');
const statusEl = document.getElementById('active-status');
const timeInput = document.getElementById('target-time');
const nagSelect = document.getElementById('nag-intensity');
const inputGroups = document.querySelectorAll('.input-group'); // Select all input groups
const targetDisplay = document.getElementById('target-display');
const headerInfo = document.querySelector('.header-info');

// --- LOAD SETTINGS ---
const savedTime = localStorage.getItem('schoolTimer_targetTime');
const savedIntensity = localStorage.getItem('schoolTimer_intensity');

if (savedTime) {
    timeInput.value = savedTime;
    updateTargetBadge(savedTime);
}

if (savedIntensity && MODE_CONFIG[savedIntensity]) {
    nagIntensity = savedIntensity;
    nagSelect.value = savedIntensity;
}

timeInput.addEventListener('change', (e) => {
    localStorage.setItem('schoolTimer_targetTime', e.target.value);
    updateTargetBadge(e.target.value);
});

nagSelect.addEventListener('change', (e) => {
    nagIntensity = e.target.value;
    localStorage.setItem('schoolTimer_intensity', nagIntensity);
});

function updateTargetBadge(timeStr) {
    targetDisplay.innerText = `目標 ${timeStr}`;
}

// --- INIT ---
function initApp() {
    // Parse Input Time
    const val = timeInput.value;
    if (!val) {
        alert("請先設定時間！");
        return;
    }
    const [h, m] = val.split(':');
    targetHour = parseInt(h);
    targetMinute = parseInt(m);

    // Update Intensity
    nagIntensity = nagSelect.value;

    isActive = true;
    startBtn.classList.add('hidden');
    inputGroups.forEach(el => el.classList.add('hidden'));
    statusEl.classList.remove('hidden');
    headerInfo.classList.remove('hidden');

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
    target.setHours(targetHour, targetMinute, 0, 0);

    // Update Clock
    const timeStr = now.toLocaleTimeString('zh-TW', { hour12: false, hour: '2-digit', minute: '2-digit' });
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
    const totalMinutes = Math.floor(diffSeconds / 60); // Total minutes left
    const s = diffSeconds % 60;

    // Avoid duplicate triggers in same second
    if (s === lastSeconds) return;
    lastSeconds = s;

    let shouldSpeak = false;
    let message = "";

    const config = MODE_CONFIG[nagIntensity] || MODE_CONFIG['standard'];

    // PHASE 1: > 20 mins
    if (totalMinutes >= 20) {
        // config.long is in minutes
        const intervalM = config.long;
        if (totalMinutes % intervalM === 0 && s === 0) {
            shouldSpeak = true;
            message = `現在時間 ${new Date().getHours()}點${new Date().getMinutes()}分，還剩 ${totalMinutes} 分鐘。`;
        }
    }
    // PHASE 2: < 20 mins AND >= 5 mins
    else if (totalMinutes < 20 && totalMinutes >= 5) {
        const intervalM = config.medium;
        // Handle fractional minutes if needed (0.5), but here standard is 1, gentle 5, hell 0.5 (30s)

        // Special case for Hell mode 0.5 min (30s)
        if (intervalM < 1) {
            // 30 seconds interval
            if (s % 30 === 0) {
                shouldSpeak = true;
                message = `注意！只剩 ${totalMinutes} 分鐘！快動作！`;
            }
        } else {
            // Minutes interval
            if (totalMinutes % intervalM === 0 && s === 0) {
                shouldSpeak = true;
                message = `注意！只剩 ${totalMinutes} 分鐘！快點動作！`;
            }
        }
    }
    // PHASE 3: < 5 mins
    else if (totalMinutes < 5) {
        const intervalS = config.short; // Seconds

        if (s % intervalS === 0) {
            shouldSpeak = true;
            if (totalMinutes === 0) {
                // If less than 1 minute, always speak seconds
                message = `剩最後 ${s} 秒！快跑！`;
            } else {
                message = `快遲到了！剩 ${totalMinutes} 分鐘！`;
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

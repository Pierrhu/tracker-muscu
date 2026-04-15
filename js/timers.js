// ============ TIMERS ============

// ── Timer de repos ────────────────────────────────────────────────────────────
let restTimerInterval = null;
let restTimerEnd      = 0;
let restTimerDuration = 0;

function getRestDuration(exId) {
  // Chercher dans le programme actif (inclut les programmes custom)
  for (const day of getActiveProgram()) {
    for (const ex of day.exercises) {
      if (ex.id !== exId) continue;
      // Priorité : restTime défini sur l'exercice
      if (ex.restTime) return ex.restTime;
      // Fallback : déduire du type
      if (ex.topSet)   return 180;
      if (ex.superset) return 90;
      if (ex.dropSet)  return 90;
      const f = ex.format || '';
      if (f.includes('6-8') || f.includes('6-10'))  return 150;
      if (f.includes('8-10') || f.includes('10-12')) return 120;
      return 90;
    }
  }
  return 120;
}

function startRestTimer(duration) {
  if (restTimerInterval) clearInterval(restTimerInterval);
  restTimerDuration = duration;
  restTimerEnd      = Date.now() + duration * 1000;

  const el      = document.getElementById('rest-timer');
  const timeEl  = document.getElementById('rest-timer-time');
  const fillEl  = document.getElementById('rest-timer-fill');
  const labelEl = document.getElementById('rest-timer-label');
  const day     = getActiveProgram()[state.dayIdx];

  el.classList.add('active');
  fillEl.style.background = day ? day.accent : 'var(--blue)';
  labelEl.textContent = `Repos — ${Math.floor(duration/60)}:${(duration%60).toString().padStart(2,'0')}`;

  restTimerInterval = setInterval(() => {
    const remaining = Math.max(0, Math.ceil((restTimerEnd - Date.now()) / 1000));
    const min = Math.floor(remaining / 60);
    const sec = remaining % 60;
    timeEl.textContent  = `${min}:${sec.toString().padStart(2,'0')}`;
    timeEl.style.color  = remaining <= 5 ? 'var(--green)' : 'var(--text)';
    fillEl.style.width  = `${((duration - remaining) / duration) * 100}%`;

    if (remaining <= 0) {
      clearInterval(restTimerInterval);
      restTimerInterval = null;
      timeEl.textContent = 'GO !';
      timeEl.style.color = 'var(--green)';
      fillEl.style.width = '100%';
      if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
      setTimeout(() => el.classList.remove('active'), 3000);
    }
  }, 250);
}

function skipRestTimer() {
  if (restTimerInterval) clearInterval(restTimerInterval);
  restTimerInterval = null;
  document.getElementById('rest-timer').classList.remove('active');
}

// ── Timer de séance ───────────────────────────────────────────────────────────
let sessionInterval = null;
let sessionStart    = 0;
let wakeLock        = null;

function startSession() {
  if (state._sessionActive) return;
  state._sessionActive = true;
  sessionStart = Date.now();
  document.getElementById('session-bar').classList.add('active');

  sessionInterval = setInterval(() => {
    const elapsed = Math.floor((Date.now() - sessionStart) / 1000);
    const min = Math.floor(elapsed / 60);
    const sec = elapsed % 60;
    document.getElementById('session-time').textContent =
      `${min.toString().padStart(2,'0')}:${sec.toString().padStart(2,'0')}`;
  }, 1000);

  requestWakeLock();
}

function stopSession() {
  state._sessionActive = false;
  if (sessionInterval) clearInterval(sessionInterval);
  sessionInterval = null;
  document.getElementById('session-bar').classList.remove('active');
  releaseWakeLock();
}

// ── Wake Lock ─────────────────────────────────────────────────────────────────
async function requestWakeLock() {
  try {
    if ('wakeLock' in navigator) {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => { wakeLock = null; });
    }
  } catch(e) {}
}

function releaseWakeLock() {
  if (wakeLock) { wakeLock.release(); wakeLock = null; }
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && state._sessionActive) requestWakeLock();
});

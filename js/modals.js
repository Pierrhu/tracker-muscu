// ============ MODALS & OVERLAYS ============

// ── PR Célébration ────────────────────────────────────────────────────────────
const PR_GIFS = ['gifs/felicitation-pd.gif'];

function openPRCelebrate(prIdx) {
  const pr = state._lastPRs[prIdx];
  if (!pr) return;
  const gifSrc = PR_GIFS[Math.floor(Math.random() * PR_GIFS.length)];
  document.getElementById('pr-celebrate-gif').innerHTML =
    `<img src="${gifSrc}" alt="Celebration" onerror="this.parentElement.innerHTML='<div style=\\'display:flex;align-items:center;justify-content:center;height:100%;font-size:80px\\'>🏆</div>'">`;
  document.getElementById('pr-celebrate-title').textContent  = '🔥 NOUVEAU RECORD !';
  document.getElementById('pr-celebrate-detail').textContent = pr;
  document.getElementById('pr-celebrate').classList.remove('hidden');
  launchConfetti();
}

function closePRCelebrate() {
  document.getElementById('pr-celebrate').classList.add('hidden');
  const canvas = document.getElementById('pr-confetti');
  canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
}

function launchConfetti() {
  const canvas = document.getElementById('pr-confetti');
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;
  const ctx     = canvas.getContext('2d');
  const colors  = ['#FFD700','#FF6B6B','#4ECDC4','#A78BFA','#F97316','#06B6D4','#DC2626','#34D399'];
  const particles = [];

  for (let i = 0; i < 120; i++) {
    particles.push({
      x: Math.random() * canvas.width,
      y: -20 - Math.random() * canvas.height * 0.5,
      w: 4 + Math.random() * 6, h: 8 + Math.random() * 10,
      color: colors[Math.floor(Math.random() * colors.length)],
      vx: (Math.random()-0.5)*4, vy: 2+Math.random()*4,
      rot: Math.random()*360, rotSpeed: (Math.random()-0.5)*12,
      opacity: 1,
    });
  }

  let frame = 0;
  (function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    let alive = false;
    particles.forEach(p => {
      if (p.opacity <= 0) return;
      alive = true;
      p.x += p.vx; p.vy += 0.08; p.y += p.vy; p.rot += p.rotSpeed;
      if (frame > 60) p.opacity -= 0.008;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot * Math.PI / 180);
      ctx.globalAlpha = Math.max(0, p.opacity);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.w/2, -p.h/2, p.w, p.h);
      ctx.restore();
    });
    frame++;
    if (alive && frame < 300 && !document.getElementById('pr-celebrate').classList.contains('hidden')) {
      requestAnimationFrame(animate);
    }
  })();
}

// ── Modal info exercice (panneau swipe) ───────────────────────────────────────
function findExercise(exId) {
  for (const day of getActiveProgram()) {
    for (const ex of day.exercises) {
      if (ex.id === exId) return { ex, day };
    }
  }
  return null;
}

function openInfoModal(exId) {
  const found = findExercise(exId);
  if (!found || !found.ex.info) return;
  const { ex, day } = found;
  const info = ex.info;

  const gifHtml = info.gif
    ? `<div class="info-gif-container"><img src="${info.gif}" alt="${ex.name}" onerror="this.parentElement.innerHTML='<div class=\\'gif-placeholder\\'>GIF non trouvé</div>'"></div>`
    : '';

  const execHtml = info.execution && info.execution.length
    ? `<div class="info-section">
        <div class="info-section-title" style="color:${day.accent}"><span class="dot" style="background:${day.accent}"></span>Exécution</div>
        ${info.execution.map(p => `<div class="info-point">${p}</div>`).join('')}
      </div>`
    : '';

  const whyHtml = info.interet
    ? `<div class="info-section">
        <div class="info-section-title" style="color:var(--blue)"><span class="dot" style="background:var(--blue)"></span>Pourquoi cet exercice</div>
        <div class="info-why">${info.interet}</div>
      </div>`
    : '';

  document.getElementById('swipe-panel-title').innerHTML =
    `${ex.name}<br><span style="font-size:11px;color:${day.accent};font-weight:600">${day.name} · ${ex.format}</span>`;
  document.getElementById('swipe-panel-body').innerHTML = gifHtml + execHtml + whyHtml;

  requestAnimationFrame(() => {
    document.getElementById('swipe-overlay').classList.add('open');
    document.getElementById('swipe-panel').classList.add('open');
  });
}

function closeInfoModal() {
  const panel = document.getElementById('swipe-panel');
  document.getElementById('swipe-overlay').classList.remove('open');
  panel.classList.remove('open');
  panel.style.transform = '';
  document.getElementById('swipe-overlay').style.background = '';
}

// Swipe-to-close (init une seule fois au démarrage)
(function initSwipeToClose() {
  const panel = document.getElementById('swipe-panel');
  let startX = 0, startY = 0, isDragging = false;

  panel.addEventListener('touchstart', e => {
    startX = e.touches[0].clientX; startY = e.touches[0].clientY;
    isDragging = true; panel.style.transition = 'none';
  }, { passive:true });

  panel.addEventListener('touchmove', e => {
    if (!isDragging) return;
    const dx = e.touches[0].clientX - startX;
    const dy = Math.abs(e.touches[0].clientY - startY);
    if (dy > 30 && Math.abs(dx) < dy) return;
    if (dx > 0) {
      panel.style.transform = `translateX(${dx}px)`;
      const progress = Math.min(dx / panel.offsetWidth, 1);
      document.getElementById('swipe-overlay').style.background = `rgba(0,0,0,${0.6*(1-progress)})`;
    }
  }, { passive:true });

  panel.addEventListener('touchend', e => {
    if (!isDragging) return;
    isDragging = false;
    const dx = e.changedTouches[0].clientX - startX;
    panel.style.transition = '';
    if (dx > panel.offsetWidth * 0.35) {
      closeInfoModal();
    } else {
      panel.style.transform = 'translateX(0)';
      document.getElementById('swipe-overlay').style.background = '';
    }
  }, { passive:true });
})();

// ── Récap hebdomadaire ────────────────────────────────────────────────────────
function checkWeeklyRecap() {
  const now       = new Date();
  if (now.getDay() !== 1) return; // Lundi uniquement

  const thisMonday = getWeekKey(now);
  try {
    if (localStorage.getItem('lastRecapShown') === thisMonday) return;
    localStorage.setItem('lastRecapShown', thisMonday);
  } catch(e) {}

  const lastWeekKey  = getWeekKey(new Date(now.getTime() - 7*24*3600*1000));
  const weekSessions = state.history.filter(h => getWeekKey(h.date) === lastWeekKey);
  const weekVelo     = (state.veloSessions||[]).filter(v => getWeekKey(v.date) === lastWeekKey);
  if (!weekSessions.length && !weekVelo.length) return;

  let totalKg = 0;
  weekSessions.forEach(h => {
    Object.values(h.sets).forEach(s => {
      totalKg += (parseFloat(s.kg)||0) * (parseInt(s.reps)||0);
    });
  });
  const veloKm   = weekVelo.reduce((a,v) => a+(v.distance||0), 0);
  let prCount    = 0;
  weekSessions.forEach(h => {
    const idx = state.history.indexOf(h);
    const found2 = findDayInfo(h.dayId); const day = found2 ? found2.day : null;
    if (day && idx > 0) prCount += detectPRs(h, day).length;
  });

  const lastWeekStart = new Date(now);
  lastWeekStart.setDate(lastWeekStart.getDate()-7);

  document.getElementById('recap-box').innerHTML = `
    <div class="recap-title">Recap de la semaine</div>
    <div class="recap-sub">Semaine du ${lastWeekStart.toLocaleDateString('fr-FR',{day:'2-digit',month:'long'})}</div>
    <div class="recap-stats">
      <div class="recap-stat"><div class="recap-stat-val" style="color:var(--red)">${weekSessions.length}</div><div class="recap-stat-label">Séances muscu</div></div>
      <div class="recap-stat"><div class="recap-stat-val" style="color:var(--yellow)">${veloKm>0?veloKm.toFixed(0)+'km':weekVelo.length}</div><div class="recap-stat-label">${veloKm>0?'km vélo':'Sorties vélo'}</div></div>
      <div class="recap-stat"><div class="recap-stat-val" style="color:var(--blue)">${totalKg>1000?(totalKg/1000).toFixed(1)+'t':totalKg.toFixed(0)+'kg'}</div><div class="recap-stat-label">Volume total</div></div>
      <div class="recap-stat"><div class="recap-stat-val" style="color:${prCount>0?'var(--green)':'var(--text3)'}">${prCount}</div><div class="recap-stat-label">PRs battus</div></div>
    </div>
    <button class="btn-primary" style="background:var(--purple);margin-top:0" onclick="closeRecap()">C'est parti pour cette semaine 💪</button>`;
  document.getElementById('recap-overlay').classList.remove('hidden');
}

function closeRecap() {
  document.getElementById('recap-overlay').classList.add('hidden');
}

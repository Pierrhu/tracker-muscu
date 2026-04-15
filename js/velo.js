// ============ VÉLO & BASIC FIT ============

function openVeloModal() {
  document.getElementById('velo-date').value     = new Date().toISOString().slice(0,10);
  document.getElementById('velo-distance').value = '';
  document.getElementById('velo-duration').value = '';
  document.getElementById('velo-type').value     = 'endurance';
  document.getElementById('velo-modal').classList.remove('hidden');
}

function closeVeloModal() {
  document.getElementById('velo-modal').classList.add('hidden');
}

function saveVeloSession() {
  const distance = parseFloat(document.getElementById('velo-distance').value) || 0;
  const duration = parseInt  (document.getElementById('velo-duration').value) || 0;
  const type     = document.getElementById('velo-type').value;
  const dateVal  = document.getElementById('velo-date').value;

  if (!distance && !duration) { showToast('Remplis au moins la distance ou la durée'); return; }

  const entry = {
    date: dateVal ? new Date(dateVal + 'T12:00:00').toISOString() : new Date().toISOString(),
    distance, duration, type,
  };
  if (!state.veloSessions) state.veloSessions = [];
  state.veloSessions.push(entry);
  saveState(); closeVeloModal(); showToast(`Sortie vélo enregistrée ! ${distance}km`); render();
}

// ── Basic Fit ─────────────────────────────────────────────────────────────────
function openBasicFit() {
  const ua        = navigator.userAgent;
  const isAndroid = /Android/i.test(ua);
  const isIOS     = /iPhone|iPad|iPod/i.test(ua);
  const IOS_STORE = 'https://apps.apple.com/fr/app/basic-fit/id1048254718';
  const AND_STORE = 'https://play.google.com/store/apps/details?id=com.basicfit.trainingApp';

  if (isAndroid) {
    window.location.href = AND_STORE;
  } else if (isIOS) {
    window.location.href = 'basicfit://';
    setTimeout(() => { if (!document.hidden) window.location.href = IOS_STORE; }, 1500);
  } else {
    window.location.href = AND_STORE;
  }
}

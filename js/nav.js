// ============ NAVIGATION ============

function render() {
  renderNav();
  renderWorkout();
  renderRank();
  renderProgress();
  renderBody();
  renderHistory();
  renderPrograms();

  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById('page-' + state.view).classList.add('active');
}

function renderNav() {
  const tabs = [
    {id:'workout',  icon:'<img src="icons/seance.png" alt="">',     label:'Séance'},
    {id:'rank',     icon:'<img src="icons/rang.png" alt="">',        label:'Rang'},
    {id:'progress', icon:'<img src="icons/progres.png" alt="">',     label:'Progrès'},
    {id:'body',     icon:'<img src="icons/corps.png" alt="">',       label:'Corps'},
    {id:'history',  icon:'<img src="icons/historique.png" alt="">',  label:'Historique'},
    {id:'programs', icon:'<svg width="22" height="22" viewBox="0 0 22 22" fill="none"><path d="M11 2L20 6V11C20 16 16 19.5 11 21C6 19.5 2 16 2 11V6L11 2Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" fill="none"/><path d="M8 14L11 11L14 11L11 7" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>', label:'Plans'},
  ];
  document.getElementById('nav').innerHTML = tabs.map(t =>
    `<button class="${state.view===t.id?'active':''}" onclick="setView('${t.id}')">
      <span class="icon">${t.icon}</span><span class="label">${t.label}</span>
    </button>`
  ).join('');
}

function setView(v) { state.view = v; render(); }

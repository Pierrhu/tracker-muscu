// ============ NAVIGATION ============

function render() {
  renderNav();
  renderWorkout();
  renderRank();
  renderProgress();
  renderBody();
  renderHistory();

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
  ];
  document.getElementById('nav').innerHTML = tabs.map(t =>
    `<button class="${state.view===t.id?'active':''}" onclick="setView('${t.id}')">
      <span class="icon">${t.icon}</span><span class="label">${t.label}</span>
    </button>`
  ).join('');
}

function setView(v) { state.view = v; render(); }

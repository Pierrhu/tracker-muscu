// ============ RANGS & STANDARDS ============
const RANKS = [
  {name:'Novice',     icon:'<img src="ranks/bronze.png" class="rank-img">',      cls:'rank-bronze'},
  {name:'Légionnaire',icon:'<img src="ranks/argent.png" class="rank-img">',      cls:'rank-argent'},
  {name:'Centurion',  icon:'<img src="ranks/or.png" class="rank-img">',          cls:'rank-or'},
  {name:'Gladiateur', icon:'<img src="ranks/platine.png" class="rank-img">',     cls:'rank-platine'},
  {name:'Champion',   icon:'<img src="ranks/diamant.png" class="rank-img">',     cls:'rank-diamant'},
  {name:'Imperator',  icon:'<img src="ranks/ecarlate.png" class="rank-img">',   cls:'rank-ecarlate'},
  {name:'Dieu',       icon:'<img src="ranks/iridescent.png" class="rank-img">', cls:'rank-iridescent'},
  {name:'Invictus',   icon:'<img src="ranks/top250.png" class="rank-img">',      cls:'rank-top250'},
];

// Ratio thresholds 1RM/BW : [novice, légionnaire, centurion, gladiateur, champion, imperator, dieu, invictus]
const STANDARDS = {
  bench: {
    name: 'Développé couché',
    thresholds: [0.35, 0.55, 0.75, 1.00, 1.25, 1.50, 1.75, 2.00]
  },
  row: {
    name: 'Rowing barre',
    thresholds: [0.30, 0.50, 0.70, 0.90, 1.10, 1.30, 1.50, 1.75]
  },
  ohp: {
    name: 'Développé militaire',
    thresholds: [0.20, 0.35, 0.50, 0.65, 0.80, 1.00, 1.20, 1.40]
  }
};

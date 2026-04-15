// ============ RANGS & STANDARDS ============
const RANKS = [
  {name:'Bronze',   icon:'<img src="ranks/bronze.png" class="rank-img">',   cls:'rank-bronze'},
  {name:'Argent',   icon:'<img src="ranks/argent.png" class="rank-img">',   cls:'rank-argent'},
  {name:'Or',       icon:'<img src="ranks/or.png" class="rank-img">',       cls:'rank-or'},
  {name:'Platine',  icon:'<img src="ranks/platine.png" class="rank-img">',  cls:'rank-platine'},
  {name:'Diamant',  icon:'<img src="ranks/diamant.png" class="rank-img">',  cls:'rank-diamant'},
  {name:'Écarlate', icon:'<img src="ranks/ecarlate.png" class="rank-img">', cls:'rank-ecarlate'},
  {name:'Iridescent',icon:'<img src="ranks/iridescent.png" class="rank-img">',cls:'rank-iridescent'},
  {name:'Top 250',  icon:'<img src="ranks/top250.png" class="rank-img">',   cls:'rank-top250'},
];

// Ratio thresholds 1RM/BW : [bronze, argent, or, platine, diamant, ecarlate, iridescent, top250]
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

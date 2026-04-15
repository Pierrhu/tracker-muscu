// ============ PROGRAMME ============
const PROGRAM = [
  {
    id:'A', name:'Jour A', subtitle:'Force Horizontale', accent:'#C23B3B', when:'Lundi',
    exercises: [
      {id:'a1',restTime:180,name:'Développé couché barre',format:'3 chauffe + Top set 3-5 + 2×6-8',sets:3,topSet:true,rankKey:'bench',
        info:{
          gif:'gifs/developpe-couche-barre.gif',
          execution:[
            'Échauffement : 3 séries progressives (barre à vide ×10, ~50% ×6, ~70% ×3) pour préparer les articulations et le SNC.',
            'Pieds au sol, fessiers et haut du dos en contact avec le banc, léger arc thoracique naturel.',
            'Prise légèrement plus large que les épaules, poignets droits alignés avec les avant-bras.',
            'Top set : charge max, 3-5 reps. Descente contrôlée (2-3s), poussée explosive.',
            'Back-off : ~85% du top set, 6-8 reps. Garder les omoplates serrées tout du long.'
          ],
          interet:'Mouvement roi du développement des pectoraux. 3 séries de chauffe progressive puis 1 top set lourd + 2 back-off. Format réduit à 3 séries de travail pour tenir dans l\'heure avec l\'échauffement. C\'est ton marqueur de force principal.'
        }},
      {id:'a2',restTime:180,name:'Rowing barre pronation',format:'1-2 chauffe + Top set 3-5 + 2×6-8',sets:3,topSet:true,rankKey:'row',
        info:{
          gif:'gifs/rowing-barre-pronation.gif',
          execution:[
            'Échauffement : 1-2 séries légères (~50-60%) car le corps est déjà chaud du bench.',
            'Pieds largeur de hanches, genoux légèrement fléchis, buste penché à ~45° (pas plus bas).',
            'Prise pronation (paumes vers le bas) légèrement plus large que les épaules.',
            'Tirer la barre vers le nombril en serrant les omoplates, coudes le long du corps.',
            'Descente contrôlée, bras quasi-tendus en bas. Pas d\'élan avec le buste.'
          ],
          interet:'Mouvement composé lourd pour le dos en épaisseur. Moins de chauffe nécessaire car le corps est déjà préparé par le bench. 1 top set + 2 back-off pour équilibrer le volume push/pull sans dépasser l\'heure.'
        }},
      {id:'a3',restTime:120,name:'Développé incliné DB 30°',format:'3×8-10',sets:3,
        info:{
          gif:'gifs/developpe-incline-db.gif',
          execution:[
            'Banc incliné à 30° (pas plus, sinon les deltoïdes antérieurs prennent le dessus).',
            'Haltères au niveau des épaules, paumes vers l\'avant, coudes à ~45°.',
            'Pousser en arc de cercle, les haltères se rapprochent en haut sans se toucher.',
            'Descente lente avec un étirement profond en bas — c\'est là que le muscle travaille le plus.',
            'Garder les omoplates rétractées et le dos collé au banc.'
          ],
          interet:'Cible la portion claviculaire (haut des pecs) qui est souvent en retard. Placé après le couché pour profiter de la pré-fatigue de la portion sternale — l\'incliné n\'a pas besoin d\'être lourd pour être efficace ici.'
        }},
      {id:'a4',restTime:120,name:'Tirage vertical large',format:'3×10-12',sets:3,
        info:{
          gif:'gifs/tirage-vertical-large.gif',
          execution:[
            'Prise pronation large (1.5× largeur d\'épaules), cuisses calées sous les boudins.',
            'Tirer la barre vers le haut de la poitrine en bombant légèrement le torse.',
            'Coudes tirés vers le bas et légèrement vers l\'arrière.',
            'Contrôler la remontée — ne pas laisser le poids tirer les épaules vers le haut.',
            'Garder une légère extension thoracique tout du long.'
          ],
          interet:'Complète le rowing barre avec un tirage vertical pour varier le plan de mouvement. La prise large cible la largeur du dos (grand dorsal). En volume modéré ici pour accumuler du travail sans fatiguer le bas du dos déjà sollicité par le rowing.'
        }},
      {id:'a5',restTime:90,name:'Élévations latérales',format:'3×12-15',sets:3,
        info:{
          gif:'gifs/elevations-laterales-halteres.gif',
          execution:[
            'Debout, légère inclinaison du buste vers l\'avant (~10-15°).',
            'Bras légèrement fléchis, monter les haltères sur les côtés jusqu\'à l\'horizontale.',
            'Initier le mouvement avec les coudes, pas les mains — imaginer verser une bouteille d\'eau.',
            'Descente lente et contrôlée (2s), ne pas laisser tomber.',
            'Poids léger à modéré — la technique prime sur la charge sur cet exercice.'
          ],
          interet:'Isolation pure du deltoïde latéral (médial), qui ne reçoit quasiment aucun travail indirect des composés. C\'est l\'exercice qui donne la largeur d\'épaules. En 12-15 reps car ce muscle répond mieux au volume.'
        }},
      {id:'a6',restTime:60,name:'SS: Curl EZ / Ext. corde',format:'2×8-10 / 10-12',sets:2,superset:true,
        info:{
          gif:'gifs/curl-ez.gif',
          execution:[
            'Curl EZ : prise sur les parties inclinées de la barre (réduit le stress sur les poignets). Coudes fixes le long du corps, pas d\'élan.',
            'Extension corde : coudes fixes, écarter la corde en bas du mouvement et squeeze 1s. Ne pas utiliser l\'élan.',
            'Alterner les deux sans repos entre eux, repos 1:30 après le round complet.',
            'Mouvement strict et contrôlé sur les deux — les bras sont déjà pré-fatigués par les composés.'
          ],
          interet:'Superset antagoniste biceps/triceps — la seule combinaison en superset justifiée scientifiquement. L\'inhibition réciproque permet de garder quasi 100% de ta force sur chaque mouvement tout en divisant le temps par deux. Placé en fin de séance quand la fatigue n\'a plus d\'impact sur les composés.'
        }},
    ]
  },
  {
    id:'B', name:'Jour B', subtitle:'Force Verticale', accent:'#2D7DD2', when:'Mercredi',
    exercises: [
      {id:'b1',restTime:180,name:'Développé militaire',format:'Top set 3-5 + 3×6-8',sets:4,topSet:true,rankKey:'ohp',
        info:{
          gif:'gifs/developpe-militaire-halteres.gif',
          execution:[
            'Debout, pieds largeur de hanches, prise pronation légèrement plus large que les épaules.',
            'Barre au niveau des clavicules, coudes sous la barre.',
            'Pousser la barre au-dessus de la tête en passant légèrement la tête en avant une fois la barre passée.',
            'Verrouiller en haut, bras tendus, barre au-dessus du centre de gravité.',
            'Abdos et fessiers gainés en permanence. Ne pas cambrer le dos.'
          ],
          interet:'Mouvement de force principal pour les épaules. La barre permet de charger plus lourd que les haltères. Debout, il recrute davantage le gainage et les stabilisateurs. En top set pour construire la force du deltoïde antérieur.'
        }},
      {id:'b2',restTime:150,name:'Tirage vertical neutre',format:'4×6-8 lourd',sets:4,
        info:{
          gif:'gifs/tirage-vertical-neutre.gif',
          execution:[
            'Prise neutre (paumes face à face), largeur d\'épaules ou légèrement plus serrée.',
            'Tirer les coudes vers le bas et l\'arrière, amener la barre au niveau du haut de la poitrine.',
            'Squeeze 1-2 secondes en bas du mouvement en contractant les dorsaux.',
            'Remonter lentement en contrôlant, bras quasi-tendus en haut (sans relâcher les épaules).',
            'Ne pas tirer avec les bras — penser "coudes vers les hanches".'
          ],
          interet:'Travaillé en lourd (6-8 reps) — c\'est ton chemin vers les tractions. La prise neutre sollicite davantage le grand dorsal et réduit le stress sur les épaules. Le jour où tu tireras ton poids de corps ici pour 6+ reps, tu feras ta première traction.'
        }},
      {id:'b3',restTime:120,name:'Rowing DB unilatéral',format:'3×10-12/bras',sets:3,
        info:{
          gif:'gifs/rowing-db-unilateral.gif',
          execution:[
            'Un genou et une main sur le banc, pied opposé au sol, dos plat et parallèle.',
            'Tirer l\'haltère vers la hanche (pas vers l\'épaule), coude rasant le corps.',
            'Étirement maximal en bas — laisser l\'épaule descendre légèrement.',
            'Squeeze 1s en haut en serrant l\'omoplate. Chaque bras séparément.',
            'Ne pas tourner le buste — le tronc reste fixe, seul le bras bouge.'
          ],
          interet:'Corrige les asymétries gauche/droite du dos que les mouvements bilatéraux peuvent masquer. L\'unilatéralité permet aussi une ROM plus grande et un meilleur étirement du grand dorsal. Complémentaire du tirage vertical en variant le plan.'
        }},
      {id:'b4',restTime:90,name:'Latérales poulie basse',format:'4×12-15',sets:4,
        info:{
          gif:'gifs/elevations-laterales-poulie.gif',
          execution:[
            'Debout à côté de la poulie basse, bras intérieur tient la poignée, bras extérieur en appui.',
            'Monter le bras latéralement jusqu\'à l\'horizontale, coude légèrement fléchi.',
            'La poulie crée une tension constante, même en bas du mouvement (contrairement aux haltères).',
            'Descente lente (2-3s), ne pas laisser le câble tirer brusquement.',
            'Se pencher légèrement du côté opposé pour augmenter l\'amplitude.'
          ],
          interet:'Angle différent des latérales haltères du Jour A — la poulie basse maintient une tension constante et maximise le stimulus en position d\'étirement, ce que les haltères ne font pas. 4 séries car les deltoïdes sont un point faible identifié.'
        }},
      {id:'b5',restTime:60,name:'Face pull corde',format:'3×15-20',sets:3,
        info:{
          gif:'gifs/face-pull.gif',
          execution:[
            'Poulie réglée à hauteur du visage ou légèrement au-dessus.',
            'Prise en pronation sur la corde, tirer vers le front en écartant les mains.',
            'Coudes hauts et en arrière — finir avec les mains de chaque côté des oreilles.',
            'Squeeze 2s en fin de mouvement en serrant les omoplates.',
            'Poids léger, 15-20 reps — c\'est un mouvement de santé articulaire, pas de force.'
          ],
          interet:'Non négociable pour la santé des épaules, surtout pour un cycliste qui passe des heures penché vers l\'avant. Renforce les rotateurs externes et le deltoïde postérieur, contrebalançant tout le volume de pressing. Prévention blessure + esthétique (faisceau postérieur souvent négligé).'
        }},
    ]
  },
  {
    id:'C', name:'Jour C', subtitle:'Volume & Rattrapage', accent:'#1A9E8F', when:'Vendredi',
    exercises: [
      {id:'c1',restTime:120,name:'Développé couché DB',format:'4×10-12',sets:4,
        info:{
          gif:'gifs/developpe-couche-db.gif',
          execution:[
            'Allongé sur banc plat, haltères au niveau de la poitrine, pieds au sol.',
            'Descente lente avec un étirement profond — les haltères descendent plus bas qu\'une barre.',
            'Pousser en arc de cercle, les haltères se rapprochent en haut.',
            'ROM complète — c\'est l\'avantage principal vs la barre : plus d\'amplitude = plus d\'hypertrophie.',
            'Garder les omoplates rétractées et serrées, épaules basses.'
          ],
          interet:'Stimulus différent de la barre du Jour A — la ROM plus grande et la stabilisation requise recrutent plus de fibres. En 10-12 reps jour de volume, charges modérées. Pas de top set car c\'est la veille de la sortie longue vélo.'
        }},
      {id:'c2',restTime:120,name:'Tirage horizontal serré',format:'4×10-12',sets:4,
        info:{
          gif:'gifs/tirage-horizontal-serre.gif',
          execution:[
            'Assis face à la poulie, pieds calés, genoux légèrement fléchis, dos droit.',
            'Prise serrée (V-bar ou triangle), tirer vers le bas du sternum.',
            'Serrer les omoplates 1-2s à la contraction, poitrine bombée.',
            'Phase excentrique contrôlée (2-3s), laisser les bras s\'étendre complètement.',
            'Ne pas se balancer — le buste reste quasi-fixe, seuls les bras bougent.'
          ],
          interet:'Complète les tirages verticaux des Jours A et B avec un tirage horizontal. La prise serrée cible davantage le milieu du dos (rhomboïdes, trapèzes moyens) et l\'épaisseur du dos. En volume (10-12 reps) pour accumuler du travail sans fatiguer le SNC.'
        }},
      {id:'c3',restTime:90,name:'Écarté poulie vis-à-vis',format:'3×12-15',sets:3,
        info:{
          gif:'gifs/ecarte-poulie.gif',
          execution:[
            'Poulies réglées à hauteur d\'épaules, un pied en avant pour la stabilité.',
            'Bras ouverts, coudes légèrement fléchis (fixés dans cette position tout le mouvement).',
            'Amener les mains l\'une vers l\'autre devant la poitrine en contractant les pecs.',
            'Squeeze 2s à la contraction. Retour lent en étirant bien.',
            'Ne pas changer l\'angle des coudes — ce n\'est pas un press, c\'est un écarté.'
          ],
          interet:'Isolation pure des pectoraux avec tension constante (avantage de la poulie vs haltères). En fin de séance pecs pour finir le muscle avec du volume métabolique. Complète les développés qui sont des composés multi-articulaires.'
        }},
      {id:'c4',restTime:90,name:'Latérales drop set méca.',format:'3×(8+8)',sets:3,dropSet:true,
        info:{
          gif:'gifs/elevations-laterales-halteres.gif',
          execution:[
            'Phase 1 — Penché (~45°) : 8 reps d\'élévations en position penchée (cible le deltoïde latéral en stretch).',
            'Phase 2 — Debout : sans repos, se redresser et faire 8 reps classiques debout.',
            'Même poids sur les 2 phases — le changement d\'angle rend le mouvement plus facile, ce qui permet de continuer sans baisser la charge.',
            'Repos 1:30 entre les séries complètes.'
          ],
          interet:'Technique efficace pour maximiser le volume du deltoïde latéral en peu de temps. Les 2 angles exploitent la courbe de force : quand tu es épuisé en position penchée, tu passes debout. 16 reps effectives par série avec le même poids.'
        }},
      {id:'c5',restTime:60,name:'Face pull corde',format:'2×15-20',sets:2,
        info:{
          gif:'gifs/face-pull.gif',
          execution:[
            'Même exécution que le Jour B — poulie haute, tirer vers le front, coudes hauts.',
            'Squeeze 2s, poids léger, focus sur la contraction.',
            '2 séries suffisent ici car déjà 3 séries faites le Jour B.'
          ],
          interet:'Maintien de la santé articulaire des épaules. Présent 2 fois dans la semaine (Jours B et C) pour un total de 5 séries hebdomadaires — suffisant pour la prévention sans gaspiller du temps.'
        }},
      {id:'c6',restTime:60,name:'SS: Curl marteau / Ext.',format:'2×10-12 / 10-12',sets:2,superset:true,
        info:{
          gif:'gifs/curl-marteau.gif',
          execution:[
            'Curl marteau : prise neutre (paumes face à face), bras le long du corps, monter en gardant les coudes fixes.',
            'Extension poulie barre droite : coudes collés au corps, extension complète, squeeze 1s en bas.',
            'Alterner sans repos entre les deux, 1:30 de repos après le round complet.',
            'Mouvement strict — pas d\'élan, pas de triche.'
          ],
          interet:'Curl marteau cible le brachio-radial et le long chef du biceps — donne l\'épaisseur du bras vue de face. Superset antagoniste avec les extensions pour les mêmes raisons que le Jour A. Variante différente (marteau vs EZ) pour diversifier le stimulus.'
        }},
    ]
  }
];

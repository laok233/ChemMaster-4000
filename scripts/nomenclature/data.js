"use strict";
/* ========================= CONTENUTI NOMENCLATURA ========================= */
/* I dati restano separati dalla UI: la pagina puo' crescere senza
   trasformare il rendering in un oggetto monolitico. */
const NOMENCLATURE_FILTERS = [
  {id:"all", label:"Tutte le regole", quizLabel:"Inorganica e organica"},
  {id:"traditional", label:"Nomi tradizionali", quizLabel:"Nomi tradizionali"},
  {id:"inorganic", label:"Nomenclatura inorganica", quizLabel:"Solo inorganica"},
  {id:"organic", label:"Nomenclatura organica", quizLabel:"Solo organica"}
];

const NOMENCLATURE_CARDS = [
  {
    id:"cationi-anioni",
    area:"inorganic",
    topic:"Cationi e anioni",
    title:"Cationi e anioni",
    summary:"Le cariche fissano il nome del catione e la forma dell'anione; la carica variabile richiede il numero romano di Stock.",
    rule:"Prima si nomina il catione, poi l'anione. Gli ioni metallici con carica fissa prendono il nome dell'elemento; quelli con carica variabile usano il numero romano tra parentesi, espresso come numero di ossidazione.",
    steps:[
      "Individua la carica di ciascuno ione dalla posizione nella formula o dal nome dell'acido.",
      "Scrivi il nome del catione e aggiungi, se serve, il numero romano tra parentesi.",
      "Usa il nome dell'anione indicato nella formula: per Cl⁻ e S²⁻ la forma salina è -uro; per anioni poliatomici come OH⁻, NO₃⁻ e ClO₃⁻ si usa il nome specifico (idrossido, nitrato, clorato)."
    ],
    examples:[
      {formula:"Na⁺ / Cl⁻", name:"sodio / cloruro", note:"cariche fisse: non serve un numero romano"},
      {formula:"Fe²⁺ / Cl⁻", name:"ferro(II) / cloruro", note:"Fe²⁺ ha carica variabile"},
      {formula:"Al³⁺ / O²⁻", name:"alluminio / ossido", note:"l'alluminio ha carica +3 fissa"}
    ],
    notes:[
      "La carica dell'anione si legge dal nome: Cl⁻ cloruro, O²⁻ ossido, S²⁻ solfuro.",
      "Il numero romano non è la carica con segno: per Fe²⁺ si scrive ferro(II), non ferro(2+)."
    ]
  },
  {
    id:"compositi-ionici",
    area:"inorganic",
    topic:"Composti ionici",
    title:"Composti ionici",
    summary:"Il nome di un sale o di un ossido ionico segue sempre l'ordine catione + anione, senza prefissi molecolari.",
    rule:"Si scrive prima il catione e poi l'anione. Se il catione ha più valori di ossidazione, il numero romano disambigua il suo stato; gli idrossidi si chiamano idrossido di catione, come idrossido di calcio.",
    steps:[
      "Suddividi la formula in catione e anione, senza usare i coefficienti come prefissi del nome.",
      "Scrivi il nome del catione, aggiungendo la carica romana solo quando è necessaria.",
      "Aggiungi il nome dell'anione nella forma usata per i composti ionici e scrivi il risultato in un unico nome."
    ],
    examples:[
      {formula:"NaCl", name:"cloruro di sodio", note:"Na⁺ e Cl⁻"},
      {formula:"FeCl₃", name:"cloruro di ferro(III)", note:"tre Cl⁻ richiedono Fe³⁺"},
      {formula:"Al₂O₃", name:"ossido di alluminio", note:"i coefficienti non diventano prefissi"},
      {formula:"Ca(OH)₂", name:"idrossido di calcio", note:"l'anione OH⁻ diventa idrossido"}
    ],
    notes:[
      "Non scrivere dichloruro di sodio per NaCl: NaCl contiene un solo ione di ciascun tipo.",
      "La forma con numero romano è la notazione di Stock ed è utile per i metalli di transizione."
    ]
  },
  {
    id:"composti-binari",
    area:"inorganic",
    topic:"Composti binari",
    title:"Composti covalenti binari",
    summary:"Quando due non metalli formano un composto, il numero di atomi si dichiara con prefissi italiani, non con i coefficienti della formula.",
    rule:"Il primo elemento si nomina senza prefisso quando compare una sola volta; altrimenti si aggiunge il suo prefisso. Il secondo elemento riceve sempre il prefisso corrispondente al numero di atomi.",
    steps:[
      "Conta gli atomi di ciascun elemento nella formula semplice.",
      "Scrivi il primo elemento con il prefisso adatto, omettendo mono- quando non serve.",
      "Applica al secondo elemento il prefisso del suo numero di atomi e leggi la formula in italiano."
    ],
    examples:[
      {formula:"CO", name:"monossido di carbonio", note:"mono- si omette sul primo elemento"},
      {formula:"CO₂", name:"diossido di carbonio", note:"due atomi di ossigeno"},
      {formula:"PCl₅", name:"pentacloruro di fosforo", note:"cinque atomi di cloro"},
      {formula:"N₂O₄", name:"tetraossido di dinitrogeno", note:"il prefisso indica quattro atomi di ossigeno"}
    ],
    table:{
      caption:"Prefissi per il numero di atomi",
      headers:["Prefisso","Atomi"],
      rows:[["mono",1],["di",2],["tri",3],["tetra",4],["penta",5],["esa",6],["epta",7],["otta",8],["nona",9],["deca",10]]
    },
    notes:[
      "I composti ionici non usano questi prefissi: FeCl₃ è cloruro di ferro(III), non trichloruro di ferro.",
      "La formula N₂O₄ conserva i pedici numerici; il prefisso tetra- descrive il sottoscritto dell'ossigeno."
    ]
  },
  {
    id:"acidi",
    area:"inorganic",
    topic:"Acidi",
    title:"Acidi",
    summary:"Gli idracidi derivano da idrogeno + non metallo; negli ossiacidi si usano la radice e i suffissi -oso e -ico, verificando sempre la struttura.",
    rule:"Un acido binario si nomina acido + nome del non metallo con suffisso -idrico. In un ossiacido si individua la radice: -oso indica lo stato di ossidazione più basso e -ico quello più alto. Il numero di ossigeni è un aiuto, ma non una regola valida per ogni serie.",
    steps:[
      "Conta gli atomi di idrogeno e degli altri elementi nella formula.",
      "Per un idracido, aggiungi il suffisso -idrico al nome dell'elemento.",
      "Per un ossiacido, individua la radice del non metallo, controlla gli atomi di ossigeno e scegli il suffisso -ico o -oso in base alla serie chimica."
    ],
    examples:[
      {formula:"HCl(aq)", name:"acido cloridrico", note:"idracido in soluzione acquosa"},
      {formula:"H₂S", name:"acido solfidrico", note:"H₂ + S"},
      {formula:"HClO₂", name:"acido cloroso", note:"radice cloro- + -oso"},
      {formula:"HNO₃", name:"acido nitrico", note:"radice nitr- + -ico"},
      {formula:"H₂SO₄", name:"acido solforico", note:"radice solfor- + -ico"},
      {formula:"H₃PO₄", name:"acido fosforico", note:"radice fosfor- + -ico"}
    ],
    table:{
      caption:"Suffissi degli ossiacidi più comuni",
      headers:["Radice","-oso","-ico","Altre forme"],
      rows:[
        ["cloro","cloroso (HClO₂)","clorico (HClO₃)","ipocloroso (HClO)"],
        ["nitr","nitroso (HNO₂)","nitrico (HNO₃)","—"],
        ["solfur","solforoso (H₂SO₃)","solforico (H₂SO₄)","—"],
        ["fosfor","fosforoso (H₃PO₃)","fosforico (H₃PO₄)","—"]
      ]
    },
    notes:[
      "Il numero di ossigeni segue una regola regolare solo in molte serie: per esempio HClO₂ è cloroso e HClO₃ è clorico, non nomi dedotti da un semplice conteggio valido ovunque.",
      "HCl(aq) è acido cloridrico; HCl(g) è invece cloruro di idrogeno. Gli idracidi seguono il suffisso -idrico."
    ]
  },
  {
    id:"basi-ossidi",
    area:"inorganic",
    topic:"Basi e ossidi",
    title:"Basi, ossidi e idrossidi",
    summary:"Gli idrossidi sono basi costituite dal catione e dallo ione OH⁻; gli ossidi possono essere ionici o molecolari.",
    rule:"Una base si nomina idrossido di… seguito dal catione. Un ossido si nomina ossido di…; se il metallo ha più stati di ossidazione si aggiunge il numero romano. Gli ossidi molecolari dei non metalli usano invece i prefissi.",
    steps:[
      "Riconosci lo ione caratteristico: OH⁻ per un idrossido, O²⁻ per un ossido ionico.",
      "Scrivi idrossido o ossido e aggiungi di seguito il nome del catione.",
      "Aggiungi il numero romano solo se il catione ha più di un possibile stato di ossidazione."
    ],
    examples:[
      {formula:"NaOH", name:"idrossido di sodio", note:"Na⁺ + OH⁻"},
      {formula:"Ba(OH)₂", name:"idrossido di bario", note:"l'idrossuro ha carica −1"},
      {formula:"FeO", name:"ossido di ferro(II)", note:"Fe²⁺"},
      {formula:"Fe₂O₃", name:"ossido di ferro(III)", note:"Fe³⁺"},
      {formula:"SO₂", name:"diossido di zolfo", note:"ossido molecolare: usa il prefisso"}
    ],
    notes:[
      "La formula di un idrossido non si legge come un composto binario con prefissi.",
      "Per CO e CO₂ si preferisce la nomenclatura prefissale; per FeO e Fe₂O₃ la notazione di Stock chiarisce il catione."
    ]
  },
  {
    id:"idrocarburi",
    area:"organic",
    topic:"Idrocarburi",
    title:"Idrocarburi",
    summary:"La scelta della catena e del primo punto di differenza guida il nome; il tipo di legame determina il suffisso -ano, -ene o -ine.",
    rule:"Scegli la catena di carbonio più lunga, numerala in modo da dare il primo punto di differenza il numero più basso e indica la lunghezza con il prefisso corretto: met-, et-, prop-, but-, pent- e così via.",
    steps:[
      "Trova la catena di carbonio principale più lunga che contenga il gruppo o l'insaturazione richiesta.",
      "Numera dalla estremità che fornisce il locante più basso alla prima differenza.",
      "Aggiungi il suffisso della famiglia: -ano, -ene o -ine; indica con un locante la posizione del doppio o triplo legame."
    ],
    examples:[
      {formula:"CH₄", name:"metano", note:"un solo carbonio"},
      {formula:"CH₃–CH₃", name:"etano", note:"due atomi di carbonio"},
      {formula:"CH₂=CH–CH₃", name:"prop-1-ene", note:"doppio legame in posizione 1"},
      {formula:"CH≡C–CH₂–CH₃", name:"but-1-ine", note:"triplo legame in posizione 1"}
    ],
    table:{
      caption:"Suffissi delle famiglie di idrocarburi",
      headers:["Famiglia","Legame","Suffisso"],
      rows:[["alcani","solo legami semplici","-ano"],["alcheni","almeno un doppio legame","-ene"],["alchini","almeno un triplo legame","-ine"],["areni","anello aromatico","-benzene o nome tradizionale"]]
    },
    notes:[
      "but-1-ene e but-2-ene non sono lo stesso composto: il locante indica la posizione dell'insaturazione.",
      "Gli idrocarburi aromatici possono avere nomi tradizionali riconosciuti, come benzene o toluene."
    ]
  },
  {
    id:"alcoli",
    area:"organic",
    topic:"Alcoli e fenoli",
    title:"Alcoli e fenoli",
    summary:"Il gruppo –OH è il gruppo funzionale principale dell'alcol; se è legato direttamente a un anello aromatico si parla di fenolo.",
    rule:"Gli alcoli si nominano con il suffisso -olo. Il carbonio che porta –OH riceve il locante più basso; nei fenoli si usa spesso il nome tradizionale del fenolo derivato.",
    steps:[
      "Individua il gruppo –OH e la catena carbonica che lo contiene.",
      "Numera la catena dando al carbonio con –OH il locante più basso.",
      "Aggiungi il suffisso -olo e, se necessario, il locant corrispondente."
    ],
    examples:[
      {formula:"CH₃–CH₂–OH", name:"etanolo", note:"catena di due carboni"},
      {formula:"CH₃–CH(OH)–CH₃", name:"propan-2-olo", note:"–OH sul carbonio 2"},
      {formula:"C₆H₅–OH", name:"fenolo", note:"–OH direttamente sull'anello aromatico"}
    ],
    notes:[
      "Il suffisso -olo descrive il gruppo ossidrile, non confonderlo con il simbolo dell'ossigeno.",
      "Quando sono presenti altri gruppi funzionali, la priorità può cambiare il nome; vedi la scheda sui suffissi."
    ]
  },
  {
    id:"carbonili",
    area:"organic",
    topic:"Aldeidi e chetoni",
    title:"Aldeidi e chetoni",
    summary:"Il gruppo carbonio C=O diventa aldeide quando è al termine della catena e chetone quando è interno.",
    rule:"Un aldeide ha il gruppo –CHO al termine della catena e riceve il suffisso -al; un chetone ha il carbonio carbonilico all'interno della catena e riceve -one. Il locante più basso indica la posizione.",
    steps:[
      "Localizza il gruppo carbonile C=O.",
      "Decidi se il carbonio carbonilico è terminale: in questo caso si tratta di un'aldeide.",
      "Scegli la catena più lunga, assegna il locante minimo e aggiungi -al o -one."
    ],
    examples:[
      {formula:"CH₃–CHO", name:"etanal", note:"–CHO terminale"},
      {formula:"CH₃–CH₂–CHO", name:"propanale", note:"tre atomi di carbonio"},
      {formula:"CH₃–CO–CH₃", name:"propanone", note:"il carbonile è interno"},
      {formula:"CH₃–CH₂–CO–CH₃", name:"butan-2-one", note:"il carbonile è sul carbonio 2"}
    ],
    notes:[
      "Il gruppo dell'aldeide –CHO va contato come un atomo di carbonio nella catena principale.",
      "Quando sono presenti altri gruppi funzionali, si deve applicare la gerarchia di priorità prima di scegliere il suffisso principale."
    ]
  },
  {
    id:"acidi-esteri",
    area:"organic",
    topic:"Acidi carbossilici ed esteri",
    title:"Acidi carbossilici ed esteri",
    summary:"Il gruppo carbossilico –COOH genera il suffisso -oico; la sostituzione del protone con un gruppo alchilico dà un estere con suffisso -ato.",
    rule:"Il nome di un acido carbossilico è acido + nome dell'alcano con suffisso -oico. In un estere si indica prima il gruppo alchilico legato all'ossigeno, poi carbossilato, con suffisso -ato.",
    steps:[
      "Individua il gruppo carbossilico e conta gli atomi di carbonio della catena acida.",
      "Per l'acido, sostituisci il suffisso -ano dell'alcano con -oico e aggiungi acido.",
      "Per l'estere, separa la parte acida dal gruppo alchilico legato all'ossigeno e usa il nome del carbossilato con -ato."
    ],
    examples:[
      {formula:"CH₃–COOH", name:"acido etanoico", note:"acetico è un nome tradizionale"},
      {formula:"CH₃–CH₂–COOH", name:"acido propanoico", note:"–COOH è incluso nella catena"},
      {formula:"CH₃–COO–CH₃", name:"metil etanoato", note:"acetato di metile"},
      {formula:"CH₃–CH₂–COO–CH₃", name:"metil propanoato", note:"parte alchilica prima, carbossilato dopo"}
    ],
    notes:[
      "Il nome tradizionale acetato di metile è corretto, ma metil etanoato rende esplicita la parte acida.",
      "Con altri gruppi funzionali, un acido carbossilico ha generalmente priorità come suffisso principale."
    ]
  },
  {
    id:"amine-alogenuri",
    area:"organic",
    topic:"Amine e alogenuri",
    title:"Amine e alogenuri",
    summary:"Le amine si riconoscono per il gruppo amminico; gli alogenuri si nominano come derivati degli idrocarburi con alogeno sostituito.",
    rule:"Un'ammina si nomina come idrocarburo con il suffisso -ammina. Negli alogenuri, l'alogeno sostituito viene indicato come prefisso fluoro-, cloro-, bromo- o iodo- prima del nome dell'idrocarburo.",
    steps:[
      "Per un'ammina, individua –NH₂ o un suo derivato e sostituisci il suffisso dell'idrocarburo con -ammina.",
      "Per un alogenuro, individua l'alogeno legato alla catena e assegna il locante più basso.",
      "Scrivi il nome del gruppo funzionale come prefisso, seguito dal nome dell'idrocarburo con il suo suffisso."
    ],
    examples:[
      {formula:"CH₃–NH₂", name:"metanammina", note:"un gruppo –NH₂"},
      {formula:"CH₃–CH₂–NH₂", name:"etanammina", note:"catena di due carboni"},
      {formula:"CH₃Cl", name:"clorometano", note:"un atomo di cloro"},
      {formula:"CH₂Cl₂", name:"diclorometano", note:"due atomi di cloro"}
    ],
    notes:[
      "Le ammine sono composti dell'azoto; il suffisso -ammina non vuol dire idrocarburo aromatico.",
      "Per gli alogenuri contano tutti gli atomi di alogeno, anche se sono più di uno: usa il prefisso numerico."
    ]
  },
  {
    id:"suffissi-priorita",
    area:"organic",
    topic:"Suffissi e priorità",
    title:"Suffissi e priorità",
    summary:"Quando un composto contiene più gruppi funzionali, si individua quello con priorità maggiore e si sceglie il suffisso corrispondente.",
    rule:"Il nome organico si costruisce come base idrocarburica più prefissi e un suffisso funzionale. In una molecola con più gruppi, non si possono usare due suffissi principali nello stesso nome: si sceglie quello prioritario e gli altri diventano prefissi.",
    steps:[
      "Disegna la catena e individua tutti i gruppi funzionali presenti.",
      "Consulta la gerarchia di priorità: acido carbossilico, derivati dell'acido, aldeide, chetone, alcoli e ammine.",
      "Usa un solo suffisso principale e trasforma gli altri gruppi in prefissi come idrossi-, oss-, nitro- o cloro-."
    ],
    examples:[
      {formula:"HO–CH₂–COOH", name:"acido 2-idrossietanoico", note:"–COOH è prioritario; –OH diventa idrossi-"},
      {formula:"CH₃–CH(OH)–CHO", name:"2-idrossipropanale", note:"–CHO è prioritario; –OH diventa idrossi-"},
      {formula:"Cl–CH₂–COOH", name:"acido 2-cloroetanoico", note:"il cloro è un gruppo sostituente, non un suffisso"}
    ],
    table:{
      caption:"Suffissi funzionali principali",
      headers:["Gruppo","Suffisso","Esempio"],
      rows:[["—OH (alcol)","-olo","propan-2-olo"],["—CHO (aldeide)","-al","propanale"],[">C=O (chetone)","-one","propanone"],["—COOH","-oico","acido etanoico"],["—COOR","-ato","metil etanoato"],["—NH₂ (ammina)","-ammina","metanammina"]]
    },
    notes:[
      "La priorità degli acidi è più alta di quella di aldeidi, chetoni, alcoli e ammine.",
      "I prefissi si ordinano alfabeticamente quando compaiono più gruppi sostituenti nello stesso nome."
    ]
  },
  {
    id:"acidi-tradizionali",
    area:"inorganic",
    traditional:true,
    topic:"Nomi tradizionali",
    title:"Acidi e nomi tradizionali",
    summary:"Gli idracidi e gli ossiacidi tradizionali usano suffissi storici che devono essere distinti dai nomi basati sul numero di ossidazione.",
    rule:"Nel sistema tradizionale gli idracidi prendono il suffisso -idrico, mentre gli ossiacidi usano la radice dell'elemento con -oso o -ico. I sali corrispondenti nominano l'anione con i suffissi tradizionali -ito e -ato, come ipoclorito, clorato, nitrito o nitrato.",
    steps:[
      "Conta gli atomi della formula e individua se è un idracido o un ossiacido.",
      "Per un idracido aggiungi -idrico al nome dell'elemento; per un ossiacido scegli la radice e il suffisso tradizionale.",
      "Per il sale, riconosci lo ione poliatomico e usa il suo nome tradizionale in -ito o -ato, poi cita il catione."
    ],
    examples:[
      {formula:"HCl(aq)",name:"acido cloridrico",note:"in acqua; HCl(g) è cloruro di idrogeno"},
      {formula:"HCl(g)",name:"cloruro di idrogeno",note:"composto gassoso, non acido"},
      {formula:"H₂S",name:"acido solfidrico",note:"solfuro di idrogeno in soluzione acquosa"},
      {formula:"HNO₂",name:"acido nitroso",note:"radice nitr- + -oso"},
      {formula:"HNO₃",name:"acido nitrico",note:"radice nitr- + -ico"},
      {formula:"H₂SO₃",name:"acido solforoso",note:"forma con tre ossigeni"},
      {formula:"H₂SO₄",name:"acido solforico",note:"forma con quattro ossigeni"},
      {formula:"NaClO",name:"ipoclorito di sodio",note:"l'anione ipoclorito deriva dal nome tradizionale"},
      {formula:"NaClO₃",name:"clorato di sodio",note:"l'anione clorato deriva dall'acido clorico"}
    ],
    table:{
      caption:"Radici e suffissi tradizionali di ossiacidi comuni",
      headers:["Radice","Suffisso -oso","Suffisso -ico"],
      rows:[
        ["cloro","ipocloroso (HClO)","clorico (HClO₃)"],
        ["nitr","nitroso (HNO₂)","nitrico (HNO₃)"],
        ["solfur","solforoso (H₂SO₃)","solforico (H₂SO₄)"],
        ["fosfor","fosforoso (H₃PO₃)","fosforico (H₃PO₄)"]
      ]
    },
    notes:[
      "I suffissi tradizionali -oso e -ico non indicano sempre direttamente il numero di ossigeni: vanno verificati con la radice e la formula.",
      " HCl gassoso e acido cloridrico non sono la stessa indicazione: il secondo descrive HCl in soluzione acquosa."
    ]
  },
  {
    id:"metalli-tradizionali",
    area:"inorganic",
    traditional:true,
    topic:"Nomi tradizionali",
    title:"Metalli e suffissi tradizionali",
    summary:"Alcuni metalli con più stati di ossidazione ricevono nomi tradizionali con -oso e -ico; non è una regola valida per ogni elemento.",
    rule:"Quando il catione ha due valenze tradizionalmente distinte, la radice metallica assume il suffisso -oso per lo stato minore e -ico per quello maggiore. Il nome tradizionale vale solo per i metalli e gli stati previsti da questo sistema.",
    steps:[
      "Ricava la carica del catione bilanciando la formula con gli anioni.",
      "Individua la coppia tradizionale del metallo, se esiste, e scegli -oso oppure -ico.",
      "Scrivi catione e anione senza dimenticare che -oso e -ico qui descrivono il metallo, non l'ossigeno o l'anione."
    ],
    examples:[
      {formula:"FeO",name:"ossido ferroso",note:"Fe(II)"},
      {formula:"Fe₂O₃",name:"ossido ferrico",note:"Fe(III)"},
      {formula:"FeCl₂",name:"cloruro ferroso",note:"Fe(II)"},
      {formula:"FeCl₃",name:"cloruro ferrico",note:"Fe(III)"},
      {formula:"Cu₂O",name:"ossido cuproso",note:"Cu(I)"},
      {formula:"CuO",name:"ossido cuprico",note:"Cu(II)"},
      {formula:"SnCl₂",name:"cloruro stannoso",note:"Sn(II)"},
      {formula:"SnCl₄",name:"cloruro stannico",note:"Sn(IV)"}
    ],
    table:{
      caption:"Coppie tradizionali più comuni",
      headers:["Radice","Suffisso -oso","Suffisso -ico"],
      rows:[
        ["ferro","ferroso (II)","ferrico (III)"],
        ["rame","cuproso (I)","cuprico (II)"],
        ["stagno","stannoso (II)","stannico (IV)"]
      ]
    },
    notes:[
      "Metalli a valenza fissa come alluminio, calcio e zinco non ricevono queste trasformazioni: si usano alluminio, calcio e zinco.",
      "Quando la nomenclatura Stock è richiesta, il numero romano rende esplicito lo stato di ossidazione ed è preferibile."
    ]
  },
  {
    id:"organici-tradizionali",
    area:"organic",
    traditional:true,
    topic:"Nomi tradizionali",
    title:"Nomi tradizionali organici",
    summary:"Molti composti organici hanno nomi d'uso consolidati, ma il nome IUPAC rivela con maggiore precisione struttura e gruppo funzionale.",
    rule:"Un nome tradizionale organico non segue sempre un algoritmo: identifica una molecola nota. Per passare alla nomenclatura IUPAC bisogna ricostruire catena, legami e gruppi funzionali; alcuni nomi tradizionali sono anche mantenuti ufficialmente.",
    steps:[
      "Riconosci il nome tradizionale e associane la struttura o la formula.",
      "Identifica la catena principale, le insaturazioni e il gruppo funzionale prioritario.",
      "Costruisci il nome IUPAC e annota anche il nome tradizionale solo quando è utile o richiesto."
    ],
    examples:[
      {formula:"C₆H₆",name:"benzene",note:"nome tradizionale mantenuto anche dall'IUPAC"},
      {formula:"C₇H₈",name:"toluene",note:"nome sistematico: metilbenzene"},
      {formula:"CH₃–COOH",name:"acido acetico",note:"nome IUPAC: acido etanoico"},
      {formula:"CH₃–CO–CH₃",name:"acetone",note:"nome sistematico: propan-2-one"},
      {formula:"HCHO",name:"formaldeide",note:"nome sistematico: metanale"},
      {formula:"CH₃–CH₂–OH",name:"alcool etilico",note:"nome sistematico: etanolo"},
      {formula:"CH₂=CH₂",name:"etilene",note:"nome sistematico: etene"},
      {formula:"HC≡CH",name:"acetilene",note:"nome sistematico: etina"}
    ],
    notes:[
      "Metano, etano, propano e butano sono invece nomi sistematici IUPAC derivati dalla catena carbonica.",
      "Essere tradizionale non significa automaticamente errato: benzene e acido acetico sono nomi tradizionali ritenuti e usati anche nella nomenclatura moderna."
    ]
  }
];
// END NOMENCLATURE DATA

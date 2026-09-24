"use strict";
/* ========================= CONTENUTI NOMENCLATURA ========================= */
/* I dati restano separati dalla UI: la pagina puo' crescere senza
   trasformare il rendering in un oggetto monolitico. */
const NOMENCLATURE_FILTERS = [
  {id:"all", label:"Tutte le regole"},
  {id:"inorganic", label:"Nomenclatura inorganica"},
  {id:"organic", label:"Nomenclatura organica"}
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
      "Trasforma il nome dell'anione nella forma aggettivale: -uro per i composti ionici."
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
    rule:"Si scrive prima il catione e poi l'anione. Se il catione ha più valori di ossidazione, il numero romano disambigua il suo stato; gli idrossidi si chiamano idrossido di…",
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
    rule:"Si legge il primo elemento, poi il secondo con il prefisso del suo numero di atomi. Il prefisso mono- si omette sul primo elemento quando c'è un solo atomo; per gli altri elementi si usa sempre.",
    steps:[
      "Conta gli atomi di ciascun elemento nella formula semplice.",
      "Scrivi il primo elemento senza prefisso mono- se è presente una sola volta.",
      "Applica al secondo elemento il prefisso adatto e leggi la formula in italiano."
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
    summary:"Gli idracidi derivano da idrogeno + non metallo; negli ossiacidi il numero di ossigeni distingue le forme acido, -oso, -ico.",
    rule:"Un acido binario si nomina acido + nome del non metallo con suffisso -idrico. In un ossiacido si conta il numero di atomi di ossigeno: -oso per la forma con meno ossigeno e -ico per quella con più ossigeno.",
    steps:[
      "Conta gli atomi di idrogeno e degli altri elementi nella formula.",
      "Per un idracido, aggiungi il suffisso -idrico al nome dell'elemento.",
      "Per un ossiacido, individua la radice del non metallo e scegli il suffisso -ico o -oso in base al numero di ossigeni."
    ],
    examples:[
      {formula:"HCl", name:"acido cloridrico", note:"idracido"},
      {formula:"H₂S", name:"acido solfidrico", note:"H₂ + S"},
      {formula:"HNO₃", name:"acido nitrico", note:"radice nitr- + -ico"},
      {formula:"H₂SO₄", name:"acido solforico", note:"radice solfor- + -ico"},
      {formula:"H₃PO₄", name:"acido fosforico", note:"radice fosfor- + -ico"}
    ],
    table:{
      caption:"Suffissi degli ossiacidi più comuni",
      headers:["Radice","-oso","-ico"],
      rows:[["cloro","ipocloroso","clorico"],["nitr","nitroso","nitrico"],["solfur","solforoso","solforico"],["fosfor","fosforoso","fosforico"]]
    },
    notes:[
      "Confronta sempre il numero di ossigeni nella formula: non basta il nome del sale da cui l'acido deriva.",
      "HCl è cloridrico, non cloroico: gli idracidi seguono il suffisso -idrico."
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
      {formula:"HO–CH₂–COOH", name:"acido idrossietanoico", note:"–COOH è prioritario; –OH diventa idrossi-"},
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
  }
];
// END NOMENCLATURE DATA

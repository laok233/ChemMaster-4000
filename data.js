"use strict";
/* ========================= DATI ========================= */
const SYMBOLS = "H He Li Be B C N O F Ne Na Mg Al Si P S Cl Ar K Ca Sc Ti V Cr Mn Fe Co Ni Cu Zn Ga Ge As Se Br Kr Rb Sr Y Zr Nb Mo Tc Ru Rh Pd Ag Cd In Sn Sb Te I Xe Cs Ba La Ce Pr Nd Pm Sm Eu Gd Tb Dy Ho Er Tm Yb Lu Hf Ta W Re Os Ir Pt Au Hg Tl Pb Bi Po At Rn Fr Ra Ac Th Pa U Np Pu Am Cm Bk Cf Es Fm Md No Lr Rf Db Sg Bh Hs Mt Ds Rg Cn Nh Fl Mc Lv Ts Og".split(" ");
const NAMES = "Idrogeno Elio Litio Berillio Boro Carbonio Azoto Ossigeno Fluoro Neon Sodio Magnesio Alluminio Silicio Fosforo Zolfo Cloro Argon Potassio Calcio Scandio Titanio Vanadio Cromo Manganese Ferro Cobalto Nichel Rame Zinco Gallio Germanio Arsenico Selenio Bromo Kripton Rubidio Stronzio Ittrio Zirconio Niobio Molibdeno Tecnezio Rutenio Rodio Palladio Argento Cadmio Indio Stagno Antimonio Tellurio Iodio Xenon Cesio Bario Lantanio Cerio Praseodimio Neodimio Promezio Samario Europio Gadolinio Terbio Disprosio Olmio Erbio Tulio Itterbio Lutezio Afnio Tantalio Wolframio Renio Osmio Iridio Platino Oro Mercurio Tallio Piombo Bismuto Polonio Astato Radon Francio Radio Attinio Torio Protoattinio Uranio Nettunio Plutonio Americio Curio Berkelio Californio Einsteinio Fermio Mendelevio Nobelio Laurencio Rutherfordio Dubnio Seaborgio Bohrio Hasio Meitnerio Darmstadtio Roentgenio Copernicio Nihonio Flerovio Moscovio Livermorio Tennesso Oganesone".split(" ");
const MASSES = ("1.008 4.0026 6.94 9.0122 10.81 12.011 14.007 15.999 18.998 20.180 " +
"22.990 24.305 26.982 28.085 30.974 32.06 35.45 39.948 39.098 40.078 " +
"44.956 47.867 50.942 51.996 54.938 55.845 58.933 58.693 63.546 65.38 " +
"69.723 72.630 74.922 78.971 79.904 83.798 85.468 87.62 88.906 91.224 " +
"92.906 95.95 [98] 101.07 102.91 106.42 107.87 112.41 114.82 118.71 " +
"121.76 127.60 126.90 131.29 132.91 137.33 138.91 140.12 140.91 144.24 " +
"[145] 150.36 151.96 157.25 158.93 162.50 164.93 167.26 168.93 173.05 " +
"174.97 178.49 180.95 183.84 186.21 190.23 192.22 195.08 196.97 200.59 " +
"204.38 207.2 208.98 [209] [210] [222] [223] [226] [227] 232.04 " +
"231.04 238.03 [237] [244] [243] [247] [247] [251] [252] [257] " +
"[258] [259] [266] [267] [268] [269] [270] [269] [278] [281] " +
"[282] [285] [286] [289] [290] [293] [294] [294]").split(/\s+/);

// v = nome della variabile CSS in :root usata per il colore della categoria
const CAT_DEF = [
  {id:"alcalini",   v:"alkali",   label:"Metalli alcalini",           syms:"Li Na K Rb Cs Fr"},
  {id:"alcalino",   v:"alkaline", label:"Alcalino-terrosi",           syms:"Be Mg Ca Sr Ba Ra"},
  {id:"transizione",v:"transition",label:"Metalli di transizione",    syms:"Sc Ti V Cr Mn Fe Co Ni Cu Zn Y Zr Nb Mo Tc Ru Rh Pd Ag Cd Hf Ta W Re Os Ir Pt Au Hg Rf Db Sg Bh Hs Mt Ds Rg Cn"},
  {id:"post",       v:"post",     label:"Metalli post-transizione",   syms:"Al Ga In Sn Tl Pb Bi Po Nh Fl Mc Lv"},
  {id:"semimetallo",v:"metalloid",label:"Semimetalli (metalloidi)",   syms:"B Si Ge As Sb Te"},
  {id:"nonmetallo", v:"nonmetal", label:"Non metalli",                syms:"H C N O P S Se"},
  {id:"alogeno",    v:"halogen",  label:"Alogeni",                    syms:"F Cl Br I At Ts"},
  {id:"gasnobile",  v:"noble",    label:"Gas nobili",                 syms:"He Ne Ar Kr Xe Rn Og"},
  {id:"lanthanoidi",v:"lanth",    label:"Lantanoidi",                 syms:"La Ce Pr Nd Pm Sm Eu Gd Tb Dy Ho Er Tm Yb Lu"},
  {id:"attinoidi",  v:"actin",    label:"Attinoidi",                  syms:"Ac Th Pa U Np Pu Am Cm Bk Cf Es Fm Md No Lr"}
];
const CAT_LABEL = Object.fromEntries(CAT_DEF.map(c=>[c.id,c.label]));

// posizione (x = colonna 1..18, y = riga: 1..7 tavola, 9 lantanoidi, 10 attinoidi)
function posOf(z){
  if(z===1) return [1,1];
  if(z===2) return [18,1];
  if(z<=10) return [z<=4 ? z-2 : z+8, 2];
  if(z<=18) return [z<=12 ? z-10 : z, 3];
  if(z<=36) return [z-18, 4];
  if(z<=54) return [z-36, 5];
  if(z<=56) return [z-54, 6];
  if(z<=71) return [z-54, 9];
  if(z<=86) return [z-68, 6];
  if(z<=88) return [z-86, 7];
  if(z<=103) return [z-86, 10];
  return [z-100, 7];
}

// configurazione elettronica: ordinamento di Aufbau + eccezioni note
const AUFBAU = [["1s",2],["2s",2],["2p",6],["3s",2],["3p",6],["4s",2],["3d",10],["4p",6],
  ["5s",2],["4d",10],["5p",6],["6s",2],["4f",14],["5d",10],["6p",6],["7s",2],["5f",14],["6d",10],["7p",6]];
// le eccezioni sono scritte NELLO STESSO ordine di Aufbau di baseConfig:
// altrimenti il pannello dettagli mostrerebbero "4s2 3d6" per Fe e "3d5 4s1" per Cr
const CFG_EXC = {
  24:"1s2 2s2 2p6 3s2 3p6 4s1 3d5", 29:"1s2 2s2 2p6 3s2 3p6 4s1 3d10",
  41:"1s2 2s2 2p6 3s2 3p6 4s2 3d10 4p6 5s1 4d4", 42:"1s2 2s2 2p6 3s2 3p6 4s2 3d10 4p6 5s1 4d5",
  44:"1s2 2s2 2p6 3s2 3p6 4s2 3d10 4p6 5s1 4d7", 45:"1s2 2s2 2p6 3s2 3p6 4s2 3d10 4p6 5s1 4d8",
  46:"1s2 2s2 2p6 3s2 3p6 4s2 3d10 4p6 4d10", 47:"1s2 2s2 2p6 3s2 3p6 4s2 3d10 4p6 5s1 4d10",
  57:"1s2 2s2 2p6 3s2 3p6 4s2 3d10 4p6 5s2 4d10 5p6 6s2 5d1",
  58:"1s2 2s2 2p6 3s2 3p6 4s2 3d10 4p6 5s2 4d10 5p6 6s2 4f1 5d1",
  64:"1s2 2s2 2p6 3s2 3p6 4s2 3d10 4p6 5s2 4d10 5p6 6s2 4f7 5d1",
  78:"1s2 2s2 2p6 3s2 3p6 4s2 3d10 4p6 5s2 4d10 5p6 6s1 4f14 5d9",
  79:"1s2 2s2 2p6 3s2 3p6 4s2 3d10 4p6 5s2 4d10 5p6 6s1 4f14 5d10",
  89:"1s2 2s2 2p6 3s2 3p6 4s2 3d10 4p6 5s2 4d10 5p6 6s2 4f14 5d10 6p6 7s2 6d1",
  90:"1s2 2s2 2p6 3s2 3p6 4s2 3d10 4p6 5s2 4d10 5p6 6s2 4f14 5d10 6p6 7s2 6d2",
  91:"1s2 2s2 2p6 3s2 3p6 4s2 3d10 4p6 5s2 4d10 5p6 6s2 4f14 5d10 6p6 7s2 5f2 6d1",
  92:"1s2 2s2 2p6 3s2 3p6 4s2 3d10 4p6 5s2 4d10 5p6 6s2 4f14 5d10 6p6 7s2 5f3 6d1",
  93:"1s2 2s2 2p6 3s2 3p6 4s2 3d10 4p6 5s2 4d10 5p6 6s2 4f14 5d10 6p6 7s2 5f4 6d1",
  96:"1s2 2s2 2p6 3s2 3p6 4s2 3d10 4p6 5s2 4d10 5p6 6s2 4f14 5d10 6p6 7s2 5f7 6d1",
  103:"1s2 2s2 2p6 3s2 3p6 4s2 3d10 4p6 5s2 4d10 5p6 6s2 4f14 5d10 6p6 7s2 5f14 7p1"
};
function baseConfig(z){
  let rest=z, out=[];
  for(const [orb,cap] of AUFBAU){
    if(rest<=0) break;
    const n=Math.min(cap,rest); rest-=n;
    out.push(orb+n);
  }
  return out.join(" ");
}
function shellsOf(cfg){
  const sh={};
  cfg.split(" ").forEach(t=>{
    const m=t.match(/^(\d+)[a-z]+(\d+)$/);
    if(!m) return;
    const n=+m[1], e=+m[2];
    sh[n]=(sh[n]||0)+e;
  });
  return Object.keys(sh).sort((a,b)=>a-b).map(n=>sh[n]);
}
const SUP="⁰¹²³⁴⁵⁶⁷⁸⁹";
function prettyCfg(cfg){
  return cfg.split(" ").map(tok=>{
    const m=tok.match(/^([0-9a-z]+?)(\d+)$/);
    if(!m) return tok;
    return m[1]+[...m[2]].map(d=>SUP[+d]).join("");
  }).join(" ");
}

const catOf = (()=>{ const m={};
  CAT_DEF.forEach(c=>c.syms.split(" ").forEach(s=>m[s]=c.id));
  return m; })();

const ELEMENTS = SYMBOLS.map((sym,i)=>{
  const z=i+1, [x,y]=posOf(z);
  const cfg = CFG_EXC[z] || baseConfig(z);
  return {z, sym, name:NAMES[i], mass:MASSES[i], cat:catOf[sym], x, y,
    period: y<=7 ? y : (y===9?6:7),
    group: (y===9||y===10) ? null : x,
    cfg, shells:shellsOf(cfg)};
});
const BY_Z = Object.fromEntries(ELEMENTS.map(e=>[e.z,e]));

// elementi biorilevanti: bioelementi strutturali (H C N O P S), macroelementi
// (Na Mg Cl K Ca Fe) e micro/oligoelementi (Zn Cu Mn Se I Co Mo F V Cr Ni B Si Sn)
const BIO_SYMS = "H C N O P S Na Mg Cl K Ca Fe Zn Cu Mn Se I Co Mo F V Cr Ni B Si Sn".split(" ");
const BIO_Z = new Set(BIO_SYMS.map(s=>SYMBOLS.indexOf(s)+1).filter(z=>z>0));
// END DATA

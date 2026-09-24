"use strict";

/*
 * CIAAW, Abridged Standard Atomic Weights 2024.
 * https://www.ciaaw.org/abridged-atomic-weights.htm
 *
 * Per gli elementi privi di isotopi stabili è indicato tra parentesi quadre
 * il numero di massa dell'isotopo a emivita più lunga confermata, come
 * nella tavola periodica IUPAC. I valori sono conservati come stringhe per
 * preservare anche zeri e precisione abbrviata.
 */
const IUPAC_MASSES = (
  "1.008 4.0026 6.94 9.0122 10.81 12.011 14.007 15.999 18.998 20.180 " +
  "22.990 24.305 26.982 28.085 30.974 32.06 35.45 39.95 39.098 40.078 " +
  "44.956 47.867 50.942 51.996 54.938 55.845 58.933 58.693 63.546 65.38 " +
  "69.723 72.630 74.922 78.971 79.904 83.798 85.468 87.62 88.906 91.222 " +
  "92.906 95.95 [97] 101.07 102.91 106.42 107.87 112.41 114.82 118.71 " +
  "121.76 127.60 126.90 131.29 132.91 137.33 138.91 140.12 140.91 144.24 " +
  "[145] 150.36 151.96 157.25 158.93 162.50 164.93 167.26 168.93 173.05 " +
  "174.97 178.49 180.95 183.84 186.21 190.23 192.22 195.08 196.97 200.59 " +
  "204.38 207.2 208.98 [209] [210] [222] [223] [226] [227] 232.04 " +
  "231.04 238.03 [237] [244] [243] [247] [247] [251] [252] [257] " +
  "[258] [259] [262] [267] [268] [269] [270] [269] [277] [281] " +
  "[282] [285] [286] [290] [290] [293] [294] [294]"
).split(/\s+/);

module.exports = { IUPAC_MASSES };

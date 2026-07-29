/**
 * Desofuscación del cuerpo iReal (segmentos de 50 chars).
 * Port ESM de ireal-reader/unscramble.js — usable en browser y Node.
 */

function obfusc50(s) {
  const chars = s.split("");
  for (let i = 0; i < 5; i++) {
    chars[49 - i] = s[i];
    chars[i] = s[49 - i];
  }
  for (let i = 10; i < 24; i++) {
    chars[49 - i] = s[i];
    chars[i] = s[49 - i];
  }
  return chars.join("");
}

/**
 * @param {string} s cuerpo scrambled (sin prefijo 1r34LbKcu7)
 * @returns {string}
 */
export function ireal(s) {
  let r = "";
  let rest = String(s || "");
  while (rest.length > 50) {
    const p = rest.substring(0, 50);
    rest = rest.substring(50);
    if (rest.length < 2) {
      r += p;
    } else {
      r += obfusc50(p);
    }
  }
  return r + rest;
}

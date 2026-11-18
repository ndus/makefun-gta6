export function createRandom(seed) {
  let cursor = seed >>> 0;
  return function random() {
    cursor = (cursor + 0x6d2b79f5) | 0;
    const a = Math.imul(cursor ^ (cursor >>> 15), cursor | 1);
    const b = a ^ (a + Math.imul(a ^ (a >>> 7), a | 61));
    return ((b ^ (b >>> 14)) >>> 0) / 4294967296;
  };
}

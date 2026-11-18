// The simulation advances in fixed ticks and caps time accumulated in a single frame.
export const STEP = 1 / 60;
export const MAX_FRAME = 0.25;

export const CITY = {
  width: 4_200,
  height: 3_300,
  waterWidth: 330,
  roadWidth: 112,
  sidewalkWidth: 34,
  avenueX: Array.from({ length: 6 }, (_, column) => 560 + column * 600),
  avenueY: Array.from({ length: 6 }, (_, row) => 420 + row * 540),
  seed: 1,
};

export const PLAYER = {
  radius: 14,
  walkSpeed: 190,
  sprintMultiplier: 1.55,
  health: 100,
  gunRange: 420,
  gunCooldown: 340 / 1000,
};

export const VEHICLE = {
  enterRange: 58,
  maxSpeed: 390,
  reverseSpeed: 115,
  acceleration: 230,
  braking: 410,
  steering: 2.45,
  radius: 24,
};

export const FONT = ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'].join(', ');

// Shared palette for the street grid, waterfront and characters.
export const COLORS = {
  water: '#122e48', waterGlow: '#1e8ba2',
  ground: '#292b35', road: '#252831', roadLine: '#c9a957',
  sidewalk: '#65616a', player: '#e9d7c9',
  neonPink: '#ff59cd', neonBlue: '#47e7ef',
};

export function createRandom(seed) {
  let state = seed >>> 0;
  // Mix each new 32-bit state before scaling it to the unit interval.
  return function random() {
    state = (state + 0x6d2b79f5) | 0;
    const first = Math.imul(state ^ (state >>> 15), state | 1);
    const second = first ^ (first + Math.imul(first ^ (first >>> 7), first | 61));
    return ((second ^ (second >>> 14)) >>> 0) / 2 ** 32;
  };
}

export function makeRunSeed(search = window.location.search) {
  const parameter = new URLSearchParams(search).get('seed');
  const number = parameter?.trim() ? Number(parameter) : NaN;
  if (Number.isFinite(number)) return Math.trunc(number) >>> 0;

  const now = Date.now();
  const salt = Math.floor(Math.random() * 0xffffffff);
  return (now ^ salt) >>> 0;
}

export const STEP = 1 / 60;
export const MAX_FRAME = 0.25;

export const CITY = {
  width: 4200,
  height: 3300,
  waterWidth: 330,
  roadWidth: 112,
  sidewalkWidth: 34,
  avenueX: [560, 1160, 1760, 2360, 2960, 3560],
  avenueY: [420, 960, 1500, 2040, 2580, 3120],
  seed: 1,
};

export const PLAYER = {
  radius: 14,
  walkSpeed: 190,
  sprintMultiplier: 1.55,
  health: 100,
  gunRange: 420,
  gunCooldown: 0.34,
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

export const FONT = 'Inter, ui-sans-serif, system-ui, sans-serif';

export const COLORS = {
  water: '#122e48',
  waterGlow: '#1e8ba2',
  ground: '#292b35',
  road: '#252831',
  roadLine: '#c9a957',
  sidewalk: '#65616a',
  player: '#e9d7c9',
  neonPink: '#ff59cd',
  neonBlue: '#47e7ef',
};

/** Small mulberry32-style generator; a scene can be recreated from the same integer seed. */
export function createRandom(seed) {
  let value = seed >>> 0;
  return function random() {
    value = (value + 0x6d2b79f5) | 0;
    let mixed = Math.imul(value ^ (value >>> 15), 1 | value);
    mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed;
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

/** Use an explicit URL seed when present; otherwise make one stable for this browser session. */
export function makeRunSeed(search = window.location.search) {
  const requested = new URLSearchParams(search).get('seed');
  if (requested !== null && requested.trim() !== '') {
    const parsed = Number(requested);
    if (Number.isFinite(parsed)) return (Math.trunc(parsed) >>> 0);
  }
  return (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0;
}

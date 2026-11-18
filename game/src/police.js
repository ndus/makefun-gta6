import { CITY, VEHICLE } from './config.js';

// Indexed by wanted stars. Delay is the time in seconds between reinforcements.
const DISPATCH = [
  { cap: 0, delay: 0, roadblocks: 0 },
  { cap: 0, delay: 0, roadblocks: 0 },
  { cap: 1, delay: 4.7, roadblocks: 0 },
  { cap: 2, delay: 4.05, roadblocks: 0 },
  { cap: 3, delay: 3.4, roadblocks: 2 },
  { cap: 4, delay: 2.75, roadblocks: 2 },
];
const BUSTED_GAIN_PER_SECOND = 0.36;
const BUSTED_DECAY_PER_SECOND = 0.65;
const CRIME_WEIGHT = {
  carTheft: 1.25,
  shooting: 0.7,
  pedestrianHit: 0.85,
  recklessCollision: 0.38,
  missionAct: 1.15,
};

function actorFor(player) {
  return player.vehicle ?? player;
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function hasLineOfSight(world, from, to) {
  const length = distance(from, to);
  const steps = Math.ceil(length / 42);
  for (let step = 1; step < steps; step += 1) {
    const amount = step / steps;
    if (world.isPointBlocked(from.x + (to.x - from.x) * amount, from.y + (to.y - from.y) * amount)) return false;
  }
  return true;
}

function makePoliceCar(id, x, y, angle = 0) {
  return {
    id: `police-${id}`, x, y, angle, speed: 0, color: '#e8edf4', health: 135,
    driverKind: 'police', width: 48, length: 82, radius: VEHICLE.radius,
    trafficDirection: 1, horizontal: true, nextTurn: 0, smoke: 0, collided: 0,
    police: true, sirenPhase: 0, roadblock: false, fireCooldown: 0,
  };
}

function nearestRoad(world, x, y) {
  let best = { x: world.roads.x[0], y: world.roads.y[0], score: Infinity };
  for (const roadX of world.roads.x) {
    const candidate = { x: roadX, y: Math.max(120, Math.min(CITY.height - 160, y)), score: Math.abs(roadX - x) };
    if (candidate.score < best.score) best = candidate;
  }
  for (const roadY of world.roads.y) {
    const candidate = { x: Math.max(150, Math.min(CITY.width - CITY.waterWidth - 150, x)), y: roadY, score: Math.abs(roadY - y) };
    if (candidate.score < best.score) best = candidate;
  }
  return best;
}

function spawnUnit(state, actor, random, roadblocks) {
  const { world, police } = state;
  const angle = random() * Math.PI * 2;
  const radius = 880 + random() * 180;
  const candidate = nearestRoad(world, actor.x + Math.cos(angle) * radius, actor.y + Math.sin(angle) * radius);
  const id = police.nextId++;
  const car = makePoliceCar(id, candidate.x, candidate.y, Math.atan2(actor.y - candidate.y, actor.x - candidate.x));
  car.speed = 90;
  car.roadblock = police.units.filter((unit) => unit.roadblock).length < roadblocks;
  if (car.roadblock) {
    const heading = actor.angle ?? actor.vehicle?.angle ?? 0;
    const aheadX = actor.x + Math.cos(heading) * 300;
    const aheadY = actor.y + Math.sin(heading) * 300;
    const road = nearestRoad(world, aheadX, aheadY);
    car.x = road.x;
    car.y = road.y;
    car.angle = Math.atan2(actor.y - car.y, actor.x - car.x) + Math.PI / 2;
    car.speed = 0;
  }
  police.units.push(car);
}

/** Create the shared patrol state for a new run. */
export function createPoliceSystem() {
  return { units: [], officers: [], nextId: 1, busted: 0, noSightTime: 0, visible: false, shotCooldown: 0 };
}

/** Raise a fractional wanted score; the displayed level is its rounded-up star count. */
export function reportCrime(state, kind, amount = 1) {
  const weight = CRIME_WEIGHT[kind] ?? 0.65;
  const severity = Number.isFinite(amount) ? Math.max(0, amount) : 1;
  state.wantedHeat = Math.max(0, Math.min(5, (state.wantedHeat ?? state.wanted ?? 0) + weight * severity));
  state.wanted = Math.ceil(state.wantedHeat);
  return state.wanted;
}

// Remove cars and their dismounted officers in place so readers keep live arrays.
function prunePatrols(police, actor) {
  for (let i = police.units.length - 1; i >= 0; i -= 1) {
    const unit = police.units[i];
    if (!(unit.health > 0 && distance(unit, actor) < 1600)) police.units.splice(i, 1);
  }
  const officerIds = new Set(police.units.map((unit) => `officer-${unit.id}`));
  for (let i = police.officers.length - 1; i >= 0; i -= 1) {
    const officer = police.officers[i];
    if (officer.health <= 0 || !officerIds.has(officer.id)) police.officers.splice(i, 1);
  }
}

function updateDispatch(state, actor, level, dt, random) {
  const { police } = state;
  const dispatch = DISPATCH[level];
  if (dispatch && police.units.length < dispatch.cap && police.spawnTimer <= 0) {
    spawnUnit(state, actor, random, state.wanted >= 4 ? dispatch.roadblocks : 0);
    police.spawnTimer = dispatch.delay;
  }
  police.spawnTimer = Math.max(0, (police.spawnTimer ?? 0) - dt);
}

function updateVisibility(state, actor, dt) {
  const { police, world } = state;
  police.visible = police.units.some((unit) => distance(unit, actor) < 560 && hasLineOfSight(world, unit, actor));
  police.noSightTime = police.visible ? 0 : police.noSightTime + dt;
  if (state.wanted > 0 && !police.visible) {
    const rate = police.noSightTime > 8 ? 0.105 : 0.042;
    state.wantedHeat = Math.max(0, (state.wantedHeat ?? state.wanted) - dt * rate);
    state.wanted = Math.ceil(state.wantedHeat);
  }
}

function updateOfficers(police, player, actor, level, dt) {
  if (player.vehicle) {
    police.officers.length = 0;
    return;
  }

  const leadUnit = police.units[0];
  if (level >= 2 && police.officers.length === 0 && leadUnit && distance(leadUnit, actor) < 245) {
    police.officers.push({
      id: `officer-${leadUnit.id}`, x: leadUnit.x + 32, y: leadUnit.y + 18,
      angle: leadUnit.angle, health: 100, kind: 'officer', fireCooldown: 1,
    });
  }

  for (const officer of police.officers) {
    officer.angle = Math.atan2(actor.y - officer.y, actor.x - officer.x);
    if (distance(officer, actor) > 320) {
      officer.x += Math.cos(officer.angle) * 88 * dt;
      officer.y += Math.sin(officer.angle) * 88 * dt;
    }
  }
}

function updatePatrolCars(state, actor, level, dt, random, hooks) {
  const { police, player, world } = state;
  let close = false;
  for (const unit of police.units) {
    unit.sirenPhase = (unit.sirenPhase + dt * 8) % (Math.PI * 2);
    unit.fireCooldown = Math.max(0, unit.fireCooldown - dt);
    const gap = distance(unit, actor);
    const targetHeading = actor.angle ?? 0;
    const interceptDistance = Math.min(300, Math.max(100, Math.abs(actor.speed ?? 0) * 0.65));
    const targetX = actor.x + Math.cos(targetHeading) * interceptDistance;
    const targetY = actor.y + Math.sin(targetHeading) * interceptDistance;
    if (!unit.roadblock) {
      const desiredAngle = Math.atan2(targetY - unit.y, targetX - unit.x);
      const turn = Math.atan2(Math.sin(desiredAngle - unit.angle), Math.cos(desiredAngle - unit.angle));
      unit.angle += Math.max(-2.2 * dt, Math.min(2.2 * dt, turn));
      const targetSpeed = Math.min(290, 150 + level * 25);
      unit.speed += Math.sign(targetSpeed - unit.speed) * Math.min(Math.abs(targetSpeed - unit.speed), 115 * dt);
      const nx = unit.x + Math.cos(unit.angle) * unit.speed * dt;
      const ny = unit.y + Math.sin(unit.angle) * unit.speed * dt;
      if (!world.isCircleBlocked(nx, ny, unit.radius)) {
        unit.x = nx;
        unit.y = ny;
      } else {
        unit.speed *= 0.35;
        unit.angle += 0.8;
      }
    }
    if (gap < 62) {
      close = true;
      if (player.vehicle && gap < 48) {
        player.vehicle.health = Math.max(0, player.vehicle.health - dt * (level >= 4 ? 13 : 7));
        player.vehicle.speed *= 0.985;
      } else if (!player.vehicle && gap < 36) {
        hooks.damagePlayer?.(player, dt * 5);
      }
    }
    if (level >= 3 && gap < 470 && unit.fireCooldown <= 0) {
      unit.fireCooldown = 1.4 + random() * 0.8;
      player.suppressed = Math.max(player.suppressed ?? 0, 0.55);
      if (player.vehicle) player.vehicle.health = Math.max(0, player.vehicle.health - 1.5 - level * 0.6);
      hooks.onPoliceFire?.(unit, actor);
    }
  }
  return close;
}

function updateBustedMeter(police, player, close, dt, hooks) {
  const nearlyStopped = player.vehicle && Math.abs(player.vehicle.speed) < 30;
  if (close && (!player.vehicle || nearlyStopped)) police.busted = Math.min(1, police.busted + dt * BUSTED_GAIN_PER_SECOND);
  else police.busted = Math.max(0, police.busted - dt * BUSTED_DECAY_PER_SECOND);
  if (police.busted >= 1) hooks.onBusted?.();
}

/** Advance dispatch, pursuit, wanted decay, and arrest progress by one tick. */
export function updatePolice(state, dt, random, hooks = {}) {
  if (!state.police || !state.player || !state.world) return;
  const { police, player } = state;
  const actor = actorFor(player);
  const level = Math.ceil(state.wanted ?? 0);

  prunePatrols(police, actor);
  updateDispatch(state, actor, level, dt, random);
  updateVisibility(state, actor, dt);
  updateOfficers(police, player, actor, level, dt);
  const carClose = updatePatrolCars(state, actor, level, dt, random, hooks);
  const officerClose = police.officers.some((officer) => distance(officer, actor) < 48);
  updateBustedMeter(police, player, carClose || officerClose, dt, hooks);
  hooks.setSiren?.(police.units.length > 0);
}

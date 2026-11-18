import { CITY, VEHICLE } from './config.js';

const LEVEL_CAPS = [0, 0, 1, 2, 3, 4];
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

function spawnUnit(state, actor, random) {
  const { world, police } = state;
  const angle = random() * Math.PI * 2;
  const radius = 880 + random() * 180;
  const candidate = nearestRoad(world, actor.x + Math.cos(angle) * radius, actor.y + Math.sin(angle) * radius);
  const id = police.nextId++;
  const car = makePoliceCar(id, candidate.x, candidate.y, Math.atan2(actor.y - candidate.y, actor.x - candidate.x));
  car.speed = 90;
  car.roadblock = state.wanted >= 4 && police.units.filter((unit) => unit.roadblock).length < Math.floor(state.wanted / 2);
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
  return car;
}

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

export function updatePolice(state, dt, random, hooks = {}) {
  if (!state.police || !state.player || !state.world) return;
  const { police, player, world } = state;
  const actor = actorFor(player);
  const level = Math.ceil(state.wanted ?? 0);
  police.units = police.units.filter((unit) => unit.health > 0 && distance(unit, actor) < 1600);

  const desiredCount = LEVEL_CAPS[level] ?? 0;
  if (police.units.length < desiredCount && police.spawnTimer <= 0) {
    spawnUnit(state, actor, random);
    police.spawnTimer = Math.max(1.8, 6 - level * 0.65);
  }
  police.spawnTimer = Math.max(0, (police.spawnTimer ?? 0) - dt);

  police.visible = police.units.some((unit) => distance(unit, actor) < 560 && hasLineOfSight(world, unit, actor));
  police.noSightTime = police.visible ? 0 : police.noSightTime + dt;
  if (state.wanted > 0 && !police.visible) {
    const rate = police.noSightTime > 8 ? 0.105 : 0.042;
    state.wantedHeat = Math.max(0, (state.wantedHeat ?? state.wanted) - dt * rate);
    state.wanted = Math.ceil(state.wantedHeat);
  }

  const wantedCount = police.units.length > 0 || level > 0;
  if (wantedCount && !player.vehicle && level >= 2 && police.officers.length === 0) {
    const nearest = police.units[0];
    if (nearest && distance(nearest, actor) < 245) {
      police.officers.push({ id: `officer-${nearest.id}`, x: nearest.x + 32, y: nearest.y + 18, angle: nearest.angle, health: 100, kind: 'officer', fireCooldown: 1 });
    }
  }
  if (!player.vehicle) {
    for (const officer of police.officers) {
      const gap = distance(officer, actor);
      officer.angle = Math.atan2(actor.y - officer.y, actor.x - officer.x);
      if (gap > 320) {
        officer.x += Math.cos(officer.angle) * 88 * dt;
        officer.y += Math.sin(officer.angle) * 88 * dt;
      }
    }
  } else police.officers.length = 0;

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
      let turn = Math.atan2(Math.sin(desiredAngle - unit.angle), Math.cos(desiredAngle - unit.angle));
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
  for (const officer of police.officers) if (distance(officer, actor) < 48) close = true;

  const nearlyStopped = player.vehicle && Math.abs(player.vehicle.speed) < 30;
  if (close && (!player.vehicle || nearlyStopped)) police.busted = Math.min(1, police.busted + dt * 0.36);
  else police.busted = Math.max(0, police.busted - dt * 0.65);
  if (police.busted >= 1) hooks.onBusted?.();
  hooks.setSiren?.(police.units.length > 0);
}

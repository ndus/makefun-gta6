import { MAX_FRAME, STEP, createRandom, makeRunSeed } from './config.js';
import { createAudio } from './audio.js';
import { createHud } from './hud.js';
import { createInput } from './input.js';
import { createPedestrians, updatePedestrians } from './pedestrians.js';
import { createPlayer, damagePlayer, updatePlayer, updatePlayerHealth } from './player.js';
import { createRenderer } from './render.js';
import { stageScene } from './shots.js';
import { createVehicleSystem, updateTraffic } from './vehicles.js';
import { createWorld } from './world.js';
import { createPoliceSystem, reportCrime, updatePolice } from './police.js';
import { createMissions, resetMissionAfterFailure, updateMissions } from './missions.js';

const SAVE_KEY = 'neon-reign-viretta.save.v1';
const TITLE_CAMERA = { x: 2360, y: 1080 };
const CONTACT = { x: 2050, y: 1018 };
const CONTACT_OBJECTIVE = 'Meet your contact at the pink marker.';
const FREE_ROAM = 'Free roam · Viretta is yours to read.';

const element = (id) => document.getElementById(id);
const canvas = element('game');
const renderer = createRenderer(canvas);
const input = createInput(canvas);
const hud = createHud();
const audio = createAudio();
const status = element('status');
const startOverlay = element('start-overlay');
const pauseOverlay = element('pause-overlay');
const endOverlay = element('busted-overlay');
const continueButton = element('continue-button');
const endHeading = endOverlay.querySelector('h2');
const shot = new URLSearchParams(location.search).get('shot');
const seed = makeRunSeed();
const world = createWorld(createRandom(seed));

function readSave() {
  try {
    const save = JSON.parse(localStorage.getItem(SAVE_KEY));
    if (!save || !Number.isFinite(save.cash) || save.cash < 0) return null;
    return {
      cash: Math.floor(save.cash),
      progress: {
        metContact: save.progress?.metContact === true,
        missionsCompleted: Math.max(0, Math.min(3, save.progress?.missionsCompleted ?? 0)),
        storyComplete: save.progress?.storyComplete === true,
      },
    };
  } catch {
    return null;
  }
}

let savedRun = readSave();
let staging = shot !== null;
let random;
let accumulator = 0;
let engineActive = false;
const game = { world };
game.particles = [];
game.pickups = [];
game.wanted = 0;

function resetRun(save = null) {
  random = createRandom(seed ^ 0x95ac42de);
  game.player = createPlayer(world);
  // Start just outside the road, near the first block's parked cars.
  game.player.x = 860;
  game.player.y = 478;
  game.vehicles = createVehicleSystem(world, random);
  game.pedestrians = createPedestrians(world, random);
  game.progress = { metContact: save?.progress.metContact ?? false };
  game.progress.missionsCompleted = save?.progress.missionsCompleted ?? 0;
  game.progress.storyComplete = save?.progress.storyComplete ?? false;
  game.missions = createMissions({ completed: game.progress.missionsCompleted, storyComplete: game.progress.storyComplete });
  game.police = createPoliceSystem();
  game.wanted = 0;
  game.wantedHeat = 0;
  game.particles = [];
  game.pickups = [];
  if (save) game.player.cash = save.cash;
  game.target = game.progress.metContact ? null : { ...CONTACT };
  game.objective = game.target ? CONTACT_OBJECTIVE : FREE_ROAM;
  game.stageCamera = null;
}

function saveRun() {
  if (staging) return;
  game.progress.missionsCompleted = game.missions.completed;
  game.progress.storyComplete = game.missions.storyComplete;
  savedRun = { cash: game.player.cash, progress: { ...game.progress } };
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(savedRun));
  } catch {
    // This visit can still continue using the in-memory save.
  }
}

function syncOverlays() {
  startOverlay.hidden = game.state !== 'start';
  pauseOverlay.hidden = game.state !== 'paused';
  endOverlay.hidden = game.state !== 'busted' && game.state !== 'wasted';
  element('hud').hidden = game.state === 'start';
  continueButton.hidden = savedRun === null;
}

function updateEngine() {
  const car = game.state === 'playing' ? game.player.vehicle : null;
  if (car) audio.setDriven(true, car.speed);
  else if (engineActive) audio.setDriven(false);
  engineActive = Boolean(car);
}

function setState(state, message) {
  game.state = state;
  if (state !== 'playing') audio.setSiren(false);
  accumulator = 0;
  input.takePresses().clear();
  syncOverlays();
  updateEngine();
  status.textContent = message;
}

function followCamera(dt) {
  const car = game.player.vehicle;
  const target = game.stageCamera ?? (game.state === 'start' ? TITLE_CAMERA : game.player);
  const movement = game.state === 'playing' ? input.movement() : { x: 0, y: 0 };
  const lead = car ? car.speed * 0.32 : 42;
  renderer.updateCamera(
    target,
    dt,
    car ? Math.cos(car.angle) * lead : movement.x * lead,
    car ? Math.sin(car.angle) * lead : movement.y * lead,
  );
}

function startRun(save) {
  staging = false;
  resetRun(save);
  saveRun();
  setState('playing', 'Playing. Meet your contact or explore Viretta.');
  followCamera(1);
}

function returnToTitle() {
  saveRun();
  game.stageCamera = null;
  setState('start', 'Neon Reign: Viretta. Title screen.');
  followCamera(1);
}

function pause() {
  saveRun();
  setState('paused', 'Paused.');
}

function resume() {
  setState('playing', 'Playing.');
}

function finishRun(state, reason) {
  endHeading.textContent = state === 'busted' ? 'Busted' : 'Wasted';
  element('busted-copy').textContent = reason;
  resetMissionAfterFailure(game);
  saveRun();
  game.police.busted = 0;
  setState(state, `${endHeading.textContent}. ${reason}`);
}

function bindButton(id, action) {
  element(id).addEventListener('click', () => {
    audio.uiClick();
    action();
  });
}

bindButton('start-button', () => startRun(null));
bindButton('continue-button', () => startRun(savedRun));
bindButton('resume-button', resume);
bindButton('pause-title-button', returnToTitle);
bindButton('wasted-title-button', returnToTitle);
bindButton('retry-button', () => startRun(savedRun));
window.addEventListener('pagehide', () => {
  if (game.state !== 'start') saveRun();
});

function handleControls() {
  if (input.consumePress('KeyM')) {
    status.textContent = audio.toggleMute() ? 'Audio muted.' : 'Audio on.';
  }
  const pausePressed = input.consumePress('KeyP');
  const escapePressed = input.consumePress('Escape');
  if (pausePressed || escapePressed) {
    if (game.state === 'playing') pause();
    else if (game.state === 'paused') resume();
  }
}

// Aim uses canvas CSS pixels, the same units the camera exposes.
const aim = {
  toWorld() {
    const { x, y, moved } = input.pointer;
    if (moved) return renderer.screenToWorld(x, y);
    const player = game.player;
    return { x: player.x + Math.cos(player.angle), y: player.y + Math.sin(player.angle) };
  },
};

function updateContact() {
  const { player, target } = game;
  if (!target || Math.hypot(player.x - target.x, player.y - target.y) > 30) return;
  game.progress.metContact = true;
  player.cash += 250;
  game.target = null;
  game.objective = FREE_ROAM;
  status.textContent = 'Contact met. Earned $250.';
  audio.missionSting();
  saveRun();
}

function particleBurst(x, y, color, count = 8) {
  for (let index = 0; index < count; index += 1) {
    const angle = random() * Math.PI * 2;
    const speed = 35 + random() * 150;
    game.particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: 0.18 + random() * 0.32, age: 0, color, size: 2 + random() * 4 });
  }
}

function shootTargets(shot) {
  const targets = [];
  for (const pedestrian of game.pedestrians) if (!pedestrian.down) targets.push({ item: pedestrian, kind: 'pedestrian', radius: 13 });
  for (const guard of game.missions.guards) if (guard.health > 0) targets.push({ item: guard, kind: 'guard', radius: 16 });
  for (const officer of game.police.officers) if (officer.health > 0) targets.push({ item: officer, kind: 'police', radius: 15 });
  for (const unit of game.police.units) if (unit.health > 0) targets.push({ item: unit, kind: 'policeCar', radius: 30 });

  let hit = null;
  for (const target of targets) {
    const dx = target.item.x - shot.x;
    const dy = target.item.y - shot.y;
    const along = dx * Math.cos(shot.angle) + dy * Math.sin(shot.angle);
    if (along < 8 || along > shot.range) continue;
    const across = Math.abs(dx * Math.sin(shot.angle) - dy * Math.cos(shot.angle));
    if (across > target.radius || (hit && along > hit.along)) continue;
    hit = { ...target, along, x: shot.x + Math.cos(shot.angle) * along, y: shot.y + Math.sin(shot.angle) * along };
  }
  return hit;
}

function applyShot(shot) {
  const hit = shootTargets(shot);
  particleBurst(shot.x + Math.cos(shot.angle) * shot.range * 0.55, shot.y + Math.sin(shot.angle) * shot.range * 0.55, '#f6d77d', 2);
  const witnesses = game.pedestrians.some((pedestrian) => !pedestrian.down && Math.hypot(pedestrian.x - shot.x, pedestrian.y - shot.y) < 420);
  if (witnesses) reportCrime(game, 'shooting');
  if (!hit) return;
  game.cameraShake = Math.min(12, (game.cameraShake ?? 0) + (hit.kind === 'policeCar' ? 5 : 3));
  particleBurst(hit.x, hit.y, hit.kind === 'policeCar' ? '#5deaf1' : '#ff69a8', 12);
  hit.item.health = Math.max(0, (hit.item.health ?? 100) - 42);
  game.player.combatTimer = 5;
  if (hit.kind === 'pedestrian' && hit.item.health <= 0) {
    hit.item.down = true;
    if (random() < 0.32) game.pickups.push({ x: hit.item.x, y: hit.item.y, cash: 20 + Math.floor(random() * 81), life: 20 });
  }
  if (hit.kind === 'guard' && hit.item.health <= 0) {
    if (random() < 0.55) game.pickups.push({ x: hit.item.x, y: hit.item.y, cash: 45 + Math.floor(random() * 106), life: 24 });
  }
  if (!witnesses && (hit.kind === 'police' || hit.kind === 'policeCar')) reportCrime(game, 'shooting', 1.4);
}

function updatePlaying(dt) {
  const { player, vehicles, pedestrians } = game;
  let gunfire = null;
  updatePlayer(player, input, dt, world, vehicles, aim, (shotEvent) => {
    gunfire = shotEvent;
    audio.shot();
    applyShot(shotEvent);
  }, () => reportCrime(game, 'carTheft'));
  updateTraffic(vehicles, dt, world, random);
  updatePedestrians(pedestrians, dt, vehicles, gunfire);

  for (const pedestrian of pedestrians) {
    if (pedestrian.down) continue;
    const speed = Math.abs(player.vehicle?.speed ?? 0);
    if (player.vehicle && speed > 90 && Math.hypot(player.x - pedestrian.x, player.y - pedestrian.y) < 28) {
      pedestrian.down = true;
      player.vehicle.health = Math.max(0, player.vehicle.health - speed * 0.012);
      reportCrime(game, 'pedestrianHit');
      reportCrime(game, 'recklessCollision', speed > 250 ? 1.4 : 0.7);
      game.cameraShake = Math.min(14, (game.cameraShake ?? 0) + speed * 0.025);
      particleBurst(pedestrian.x, pedestrian.y, '#ff719d', 10);
    }
  }

  if (!player.vehicle) {
    for (const car of vehicles.cars) {
      const speed = Math.abs(car.speed);
      if (speed < 70 || Math.hypot(car.x - player.x, car.y - player.y) >= car.radius + player.radius) continue;
      if (damagePlayer(player, speed * 0.45)) {
        reportCrime(game, 'recklessCollision', 0.8);
        game.cameraShake = Math.min(14, (game.cameraShake ?? 0) + 2);
      }
    }
  }

  if (player.health <= 0) {
    finishRun('wasted', 'You were struck by traffic.');
  } else if (player.vehicle?.health <= 0) {
    finishRun('busted', 'Your car was wrecked and impounded.');
  } else updateContact();

  if (game.state !== 'playing') return;
  updatePolice(game, dt, random, {
    damagePlayer,
    setSiren: (enabled) => audio.setSiren(enabled),
    onBusted: () => finishRun('busted', 'The police closed in. The crew will have to regroup.'),
  });
  if (game.state !== 'playing') return;
  const safehouse = game.missions?.active === 0
    ? { x: 480, y: 3120 }
    : game.missions?.active === 2 ? { x: 1160, y: 3120 } : null;
  updatePlayerHealth(player, dt, Boolean(safehouse && Math.hypot(player.x - safehouse.x, player.y - safehouse.y) < 110));
  updateMissions(game, dt, input, { onReward: () => audio.missionSting() });
  game.progress.missionsCompleted = game.missions.completed;
  game.progress.storyComplete = game.missions.storyComplete;
  for (const pickup of game.pickups) {
    pickup.life -= dt;
    if (Math.hypot(player.x - pickup.x, player.y - pickup.y) < 28) {
      player.cash += pickup.cash;
      pickup.life = 0;
      audio.pickup();
    }
  }
  game.pickups = game.pickups.filter((pickup) => pickup.life > 0);
  for (const particle of game.particles) {
    particle.age += dt;
    particle.x += particle.vx * dt;
    particle.y += particle.vy * dt;
    particle.vx *= 0.92;
    particle.vy *= 0.92;
  }
  game.particles = game.particles.filter((particle) => particle.age < particle.life);
}

resetRun();
game.state = 'start';
if (staging) stageScene(shot, game, random);
syncOverlays();
followCamera(1);

let previousTime = performance.now();
function frame(now) {
  const elapsed = Math.min(MAX_FRAME, (now - previousTime) / 1000);
  previousTime = now;
  handleControls();

  if (game.state === 'playing' || game.state === 'start') {
    accumulator += elapsed;
    while (accumulator >= STEP) {
      accumulator -= STEP;
      if (game.state === 'playing') {
        input.takePresses();
        updatePlaying(STEP);
      } else {
        // Keep the city behind the title alive.
        updateTraffic(game.vehicles, STEP, world, random);
        updatePedestrians(game.pedestrians, STEP, game.vehicles, null);
      }
      followCamera(STEP);
    }
  }

  updateEngine();
  renderer.draw(game);
  if (game.state !== 'start') hud.update(game, now);
  if (game.shotReady) window.__shotReady = true;
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);

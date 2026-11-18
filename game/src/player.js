import { PLAYER } from './config.js';
import { enterNearestCar, exitVehicle, updatePlayerVehicle } from './vehicles.js';

const INITIAL_POSITION = { x: 850, y: 790 };

function directionOf(x, y) {
  const magnitude = Math.hypot(x, y);
  return magnitude ? { x: x / magnitude, y: y / magnitude } : { x: 0, y: 0 };
}

export function createPlayer(world) {
  return {
    world,
    ...INITIAL_POSITION,
    radius: PLAYER.radius,
    angle: 0,
    health: PLAYER.health,
    cash: 840,
    vehicle: null,
    gunCooldown: 0,
    muzzleFlash: 0,
    invulnerable: 0,
    lastShot: null,
  };
}

export function resetPlayer(player) {
  Object.assign(player, {
    ...INITIAL_POSITION,
    angle: 0,
    health: PLAYER.health,
    vehicle: null,
    gunCooldown: 0,
    muzzleFlash: 0,
    invulnerable: 0,
    lastShot: null,
  });
}

export function updatePlayer(player, input, dt, world, vehicles, pointer, onShot = () => {}, onEnterCar = () => {}) {
  player.gunCooldown = Math.max(0, player.gunCooldown - dt);
  player.muzzleFlash = Math.max(0, player.muzzleFlash - dt);
  player.invulnerable = Math.max(0, player.invulnerable - dt);

  if (input.consumePress('KeyE')) {
    if (player.vehicle) {
      exitVehicle(player, vehicles);
    } else if (enterNearestCar(player, vehicles)) {
      onEnterCar(player.vehicle);
    }
  }

  if (player.vehicle) {
    updatePlayerVehicle(player, input, dt, world, vehicles);
    return;
  }

  const controls = input.movement();
  const direction = directionOf(controls.x, controls.y);
  const running = input.isDown('ShiftLeft') || input.isDown('ShiftRight');
  const pace = PLAYER.walkSpeed * (running ? PLAYER.sprintMultiplier : 1);
  const proposedX = player.x + direction.x * pace * dt;
  const proposedY = player.y + direction.y * pace * dt;
  if (!world.isCircleBlocked(proposedX, player.y, player.radius)) player.x = proposedX;
  if (!world.isCircleBlocked(player.x, proposedY, player.radius)) player.y = proposedY;

  const aim = pointer.toWorld ? pointer.toWorld() : { x: player.x + 1, y: player.y };
  player.angle = Math.atan2(aim.y - player.y, aim.x - player.x);
  const fired = input.consumePress('Space') || input.consumePress('PointerPrimary');
  if (fired && player.gunCooldown <= 0) {
    player.gunCooldown = PLAYER.gunCooldown;
    player.muzzleFlash = 0.09;
    player.lastShot = { x: player.x, y: player.y, angle: player.angle, range: PLAYER.gunRange };
    onShot(player.lastShot);
  }
}

export function damagePlayer(player, amount) {
  if (player.invulnerable > 0 || player.vehicle) return false;
  player.health = Math.max(0, player.health - amount);
  player.invulnerable = 0.32;
  return true;
}

export function updatePlayerHealth(player, dt, safehouse = false) {
  player.suppressed = Math.max(0, (player.suppressed ?? 0) - dt);
  if (!safehouse && player.combatTimer > 0) {
    player.combatTimer = Math.max(0, player.combatTimer - dt);
  }
  if (safehouse || player.combatTimer <= 0) {
    player.health = Math.min(100, player.health + dt * (safehouse ? 7 : 2.1));
  }
}

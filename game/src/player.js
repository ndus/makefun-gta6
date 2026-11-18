import { PLAYER } from './config.js';
import { enterNearestCar, exitVehicle, updatePlayerVehicle } from './vehicles.js';

function normalise(x, y) {
  const length = Math.hypot(x, y);
  return length > 0 ? { x: x / length, y: y / length } : { x: 0, y: 0 };
}

export function createPlayer(world) {
  return {
    world,
    x: 850,
    y: 790,
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
  player.x = 850;
  player.y = 790;
  player.angle = 0;
  player.health = PLAYER.health;
  player.vehicle = null;
  player.gunCooldown = 0;
  player.muzzleFlash = 0;
  player.invulnerable = 0;
  player.lastShot = null;
}

export function updatePlayer(player, input, dt, world, vehicles, pointer, onShot = () => {}, onEnterCar = () => {}) {
  player.gunCooldown = Math.max(0, player.gunCooldown - dt);
  player.muzzleFlash = Math.max(0, player.muzzleFlash - dt);
  player.invulnerable = Math.max(0, player.invulnerable - dt);

  if (input.consumePress('KeyE')) {
    if (player.vehicle) exitVehicle(player, vehicles);
    else if (enterNearestCar(player, vehicles)) onEnterCar(player.vehicle);
  }

  if (player.vehicle) {
    updatePlayerVehicle(player, input, dt, world, vehicles);
    return;
  }

  const movement = input.movement();
  const direction = normalise(movement.x, movement.y);
  const speed = PLAYER.walkSpeed * ((input.isDown('ShiftLeft') || input.isDown('ShiftRight')) ? PLAYER.sprintMultiplier : 1);
  const nextX = player.x + direction.x * speed * dt;
  const nextY = player.y + direction.y * speed * dt;
  if (!world.isCircleBlocked(nextX, player.y, player.radius)) player.x = nextX;
  if (!world.isCircleBlocked(player.x, nextY, player.radius)) player.y = nextY;

  const pointerWorld = pointer.toWorld ? pointer.toWorld() : { x: player.x + 1, y: player.y };
  player.angle = Math.atan2(pointerWorld.y - player.y, pointerWorld.x - player.x);
  if ((input.consumePress('Space') || input.consumePress('PointerPrimary')) && player.gunCooldown <= 0) {
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
  if (!safehouse && player.combatTimer > 0) player.combatTimer = Math.max(0, player.combatTimer - dt);
  if (safehouse || player.combatTimer <= 0) player.health = Math.min(100, player.health + dt * (safehouse ? 7 : 2.1));
}

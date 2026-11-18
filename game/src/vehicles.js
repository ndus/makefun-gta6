import { CITY, VEHICLE } from './config.js';

const PAINTS = ['#bc425e', '#477d9b', '#d4ae62', '#705b91', '#4f8c75', '#d6d8dc', '#c86637'];

function makeCar(id, x, y, angle, color, driverKind) {
  return {
    id, x, y, angle, speed: 0, color,
    health: 100,
    driverKind,
    width: 48,
    length: 82,
    radius: VEHICLE.radius,
    trafficDirection: 1,
    nextTurn: 0,
    smoke: 0,
    collided: 0,
  };
}

function nearestIntersection(roads, x, y) {
  let nearestX = roads.x[0];
  let nearestY = roads.y[0];
  for (const roadX of roads.x) if (Math.abs(roadX - x) < Math.abs(nearestX - x)) nearestX = roadX;
  for (const roadY of roads.y) if (Math.abs(roadY - y) < Math.abs(nearestY - y)) nearestY = roadY;
  return { x: nearestX, y: nearestY };
}

export function createVehicleSystem(world, random) {
  const cars = [];
  let nextId = 1;
  for (let index = 0; index < world.parkedSpawns.length; index += 3) {
    const spawn = world.parkedSpawns[index];
    cars.push(makeCar(nextId++, spawn.x, spawn.y, spawn.angle, PAINTS[Math.floor(random() * PAINTS.length)], 'parked'));
  }

  for (let index = 0; index < 12; index += 1) {
    const column = Math.floor(random() * world.roads.x.length);
    const row = Math.floor(random() * world.roads.y.length);
    const horizontal = random() > 0.48;
    const direction = random() > 0.5 ? 1 : -1;
    const lane = direction > 0 ? -1 : 1;
    const x = horizontal ? 140 + random() * (world.width - world.waterWidth - 280) : world.roads.x[column] + lane * 25;
    const y = horizontal ? world.roads.y[row] + lane * 25 : 150 + random() * (world.height - 350);
    const angle = horizontal ? (direction > 0 ? 0 : Math.PI) : (direction > 0 ? Math.PI / 2 : -Math.PI / 2);
    const car = makeCar(nextId++, x, y, angle, PAINTS[Math.floor(random() * PAINTS.length)], 'traffic');
    car.speed = 85 + random() * 45;
    car.trafficDirection = direction;
    car.horizontal = horizontal;
    const intersection = nearestIntersection(world.roads, x, y);
    car.nextTurn = horizontal ? intersection.x + direction * (CITY.roadWidth / 2 + 16) : intersection.y + direction * (CITY.roadWidth / 2 + 16);
    cars.push(car);
  }

  return { cars, playerCar: null, nextId };
}

export function enterNearestCar(player, system) {
  if (player.vehicle) return false;
  let candidate = null;
  let nearest = VEHICLE.enterRange;
  for (const car of system.cars) {
    if (car.driverKind === 'player') continue;
    const distance = Math.hypot(car.x - player.x, car.y - player.y);
    if (distance < nearest) {
      candidate = car;
      nearest = distance;
    }
  }
  if (!candidate) return false;
  candidate.driverKind = 'player';
  candidate.speed = 0;
  system.playerCar = candidate;
  player.vehicle = candidate;
  player.x = candidate.x;
  player.y = candidate.y;
  return true;
}

export function exitVehicle(player, system) {
  const car = player.vehicle;
  if (!car) return false;
  const side = car.angle + Math.PI / 2;
  const exits = [
    { x: car.x + Math.cos(side) * 42, y: car.y + Math.sin(side) * 42 },
    { x: car.x - Math.cos(side) * 42, y: car.y - Math.sin(side) * 42 },
  ];
  const exit = exits.find((point) => !player.world.isCircleBlocked(point.x, point.y, player.radius));
  if (exit) {
    player.x = exit.x;
    player.y = exit.y;
  }
  car.driverKind = 'parked';
  car.speed = 0;
  system.playerCar = null;
  player.vehicle = null;
  return Boolean(exit);
}

function collisionWithCar(car, system) {
  for (const other of system.cars) {
    if (other === car || other.health <= 0) continue;
    const distance = Math.hypot(car.x - other.x, car.y - other.y);
    if (distance < car.radius + other.radius - 4) return other;
  }
  return null;
}

function moveCar(car, dx, dy, world, system, damageScale = 1) {
  const nx = car.x + dx;
  const ny = car.y + dy;
  if (world.isCircleBlocked(nx, ny, car.radius)) {
    car.speed *= -0.16;
    car.health = Math.max(0, car.health - Math.max(1, Math.abs(car.speed) * damageScale * 0.014));
    car.collided = 0.25;
    return false;
  }
  const oldX = car.x;
  const oldY = car.y;
  car.x = nx;
  car.y = ny;
  const other = collisionWithCar(car, system);
  if (other) {
    car.x = oldX;
    car.y = oldY;
    car.speed *= -0.28;
    other.speed *= -0.25;
    car.health = Math.max(0, car.health - 5 * damageScale);
    other.health = Math.max(0, other.health - 4);
    car.collided = 0.35;
    return false;
  }
  return true;
}

export function updatePlayerVehicle(player, input, dt, world, system) {
  const car = player.vehicle;
  if (!car) return;
  const movement = input.movement();
  const handbrake = input.isDown('ShiftLeft') || input.isDown('ShiftRight');
  const longitudinal = -movement.y;
  if (longitudinal > 0) car.speed = Math.min(VEHICLE.maxSpeed, car.speed + VEHICLE.acceleration * dt);
  else if (longitudinal < 0) {
    if (car.speed > 20) car.speed = Math.max(0, car.speed - VEHICLE.braking * dt);
    else car.speed = Math.max(-VEHICLE.reverseSpeed, car.speed - VEHICLE.acceleration * 0.62 * dt);
  } else {
    car.speed *= Math.max(0, 1 - dt * (handbrake ? 2.8 : 0.75));
  }

  const steeringInput = movement.x;
  if (Math.abs(car.speed) > 5) {
    const grip = handbrake ? 0.58 : 1;
    const speedFactor = 0.35 + Math.min(1, Math.abs(car.speed) / VEHICLE.maxSpeed) * 0.65;
    car.angle += steeringInput * VEHICLE.steering * speedFactor * grip * dt * Math.sign(car.speed);
  }
  if (handbrake && Math.abs(car.speed) > 80) car.angle += steeringInput * Math.sign(car.speed) * 0.025;

  const distance = car.speed * dt;
  const moved = moveCar(car, Math.cos(car.angle) * distance, Math.sin(car.angle) * distance, world, system, 1.4);
  if (!moved && Math.abs(car.speed) < 3) car.speed = 0;
  player.x = car.x;
  player.y = car.y;
  player.angle = car.angle;
}

function trafficHasObstacle(car, system, gap) {
  const dx = Math.cos(car.angle);
  const dy = Math.sin(car.angle);
  for (const other of system.cars) {
    if (other === car || other.health <= 0) continue;
    const ahead = (other.x - car.x) * dx + (other.y - car.y) * dy;
    const side = Math.abs((other.x - car.x) * -dy + (other.y - car.y) * dx);
    if (ahead > 0 && ahead < gap && side < 35) return true;
  }
  return false;
}

export function updateTraffic(system, dt, world, random) {
  for (const car of system.cars) {
    if (car.collided > 0) car.collided = Math.max(0, car.collided - dt);
    if (car.smoke > 0) car.smoke = Math.max(0, car.smoke - dt);
    if (car.driverKind !== 'traffic') continue;

    const atIntersection = world.roadAt(car.x, car.y)?.orientation === 'intersection';
    const coordinate = car.horizontal ? car.x : car.y;
    if (atIntersection && Math.abs(coordinate - car.nextTurn) < 23) {
      const turn = random() < 0.38;
      if (turn) {
        car.horizontal = !car.horizontal;
        car.angle += (random() > 0.5 ? 1 : -1) * Math.PI / 2;
      }
      const next = nearestIntersection(world.roads, car.x + Math.cos(car.angle) * 300, car.y + Math.sin(car.angle) * 300);
      car.nextTurn = car.horizontal ? next.x : next.y;
    }

    const blocked = trafficHasObstacle(car, system, 105);
    const targetSpeed = blocked ? 0 : 105;
    car.speed += Math.sign(targetSpeed - car.speed) * Math.min(Math.abs(targetSpeed - car.speed), 75 * dt);
    const distance = car.speed * dt;
    const moved = moveCar(car, Math.cos(car.angle) * distance, Math.sin(car.angle) * distance, world, system, 0.6);
    if (!moved) {
      car.speed = 0;
      car.angle += (random() > 0.5 ? 1 : -1) * Math.PI / 2;
      car.horizontal = !car.horizontal;
      car.nextTurn = car.horizontal ? world.roads.x[0] : world.roads.y[0];
    }
    if (car.x < 120 || car.x > world.width - world.waterWidth - 120 || car.y < 100 || car.y > world.height - 130) {
      const node = nearestIntersection(world.roads, car.x, car.y);
      car.x = node.x;
      car.y = node.y;
      car.angle = Math.floor(random() * 4) * Math.PI / 2;
      car.horizontal = Math.abs(Math.cos(car.angle)) > 0.5;
      car.nextTurn = car.horizontal ? node.x + Math.cos(car.angle) * 250 : node.y + Math.sin(car.angle) * 250;
    }
  }
}

export function vehicleAtPoint(system, x, y, radius = 38) {
  return system.cars.find((car) => Math.hypot(car.x - x, car.y - y) < radius) ?? null;
}

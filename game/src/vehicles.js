import { CITY, VEHICLE } from './config.js';

const PAINTS = ['#bc425e', '#477d9b', '#d4ae62', '#705b91', '#4f8c75', '#d6d8dc', '#c86637'];

function makeCar(id, x, y, angle, color, driverKind) {
  return {
    id, x, y, angle, color,
    speed: 0,
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
  const nearest = (coordinates, position) => coordinates.reduce(
    (winner, value) => Math.abs(value - position) < Math.abs(winner - position) ? value : winner,
    coordinates[0],
  );
  return { x: nearest(roads.x, x), y: nearest(roads.y, y) };
}

export function createVehicleSystem(world, random) {
  const cars = [];
  let nextId = 1;
  const paint = () => PAINTS[Math.floor(random() * PAINTS.length)];

  world.parkedSpawns.forEach((spot, index) => {
    if (index % 3 === 0) cars.push(makeCar(nextId++, spot.x, spot.y, spot.angle, paint(), 'parked'));
  });

  for (let index = 0; index < 12; index++) {
    const column = Math.floor(random() * world.roads.x.length);
    const row = Math.floor(random() * world.roads.y.length);
    const horizontal = random() > 0.48;
    const direction = random() > 0.5 ? 1 : -1;
    const laneOffset = direction > 0 ? -25 : 25;
    const x = horizontal
      ? 140 + random() * (world.width - world.waterWidth - 280)
      : world.roads.x[column] + laneOffset;
    const y = horizontal
      ? world.roads.y[row] + laneOffset
      : 150 + random() * (world.height - 350);
    const angle = horizontal
      ? (direction > 0 ? 0 : Math.PI)
      : (direction > 0 ? Math.PI / 2 : -Math.PI / 2);
    const car = makeCar(nextId++, x, y, angle, paint(), 'traffic');
    car.speed = 85 + random() * 45;
    car.trafficDirection = direction;
    car.horizontal = horizontal;
    const crossing = nearestIntersection(world.roads, x, y);
    car.nextTurn = (horizontal ? crossing.x : crossing.y) + direction * (CITY.roadWidth / 2 + 16);
    cars.push(car);
  }

  return { cars, playerCar: null, nextId };
}

export function enterNearestCar(player, system) {
  if (player.vehicle) return false;

  let chosen = null;
  let closest = VEHICLE.enterRange;
  for (const car of system.cars) {
    if (car.driverKind === 'player') continue;
    const range = Math.hypot(car.x - player.x, car.y - player.y);
    if (range < closest) {
      chosen = car;
      closest = range;
    }
  }
  if (!chosen) return false;

  chosen.driverKind = 'player';
  chosen.speed = 0;
  system.playerCar = chosen;
  player.vehicle = chosen;
  player.x = chosen.x;
  player.y = chosen.y;
  return true;
}

export function exitVehicle(player, system) {
  const car = player.vehicle;
  if (!car) return false;

  const offset = car.angle + Math.PI / 2;
  const sidePoints = [1, -1].map((sign) => ({
    x: car.x + Math.cos(offset) * 42 * sign,
    y: car.y + Math.sin(offset) * 42 * sign,
  }));
  const spot = sidePoints.find(({ x, y }) => !player.world.isCircleBlocked(x, y, player.radius));

  if (spot) Object.assign(player, { x: spot.x, y: spot.y });
  car.driverKind = 'parked';
  car.speed = 0;
  system.playerCar = null;
  player.vehicle = null;
  return Boolean(spot);
}

function touchingCar(car, system) {
  return system.cars.find((other) => other !== car && other.health > 0
    && Math.hypot(car.x - other.x, car.y - other.y) < car.radius + other.radius - 4) ?? null;
}

function moveCar(car, dx, dy, world, system, damageScale = 1) {
  const x = car.x + dx;
  const y = car.y + dy;
  if (world.isCircleBlocked(x, y, car.radius)) {
    car.speed *= -0.16;
    car.health = Math.max(0, car.health - Math.max(1, Math.abs(car.speed) * damageScale * 0.014));
    car.collided = 0.25;
    return false;
  }

  const previous = { x: car.x, y: car.y };
  car.x = x;
  car.y = y;
  const other = touchingCar(car, system);
  if (!other) return true;

  Object.assign(car, previous);
  car.speed *= -0.28;
  other.speed *= -0.25;
  car.health = Math.max(0, car.health - 5 * damageScale);
  other.health = Math.max(0, other.health - 4);
  car.collided = 0.35;
  return false;
}

export function updatePlayerVehicle(player, input, dt, world, system) {
  const car = player.vehicle;
  if (!car) return;

  const controls = input.movement();
  const brake = input.isDown('ShiftLeft') || input.isDown('ShiftRight');
  const throttle = -controls.y;

  if (throttle > 0) {
    car.speed = Math.min(VEHICLE.maxSpeed, car.speed + VEHICLE.acceleration * dt);
  } else if (throttle < 0) {
    car.speed = car.speed > 20
      ? Math.max(0, car.speed - VEHICLE.braking * dt)
      : Math.max(-VEHICLE.reverseSpeed, car.speed - VEHICLE.acceleration * 0.62 * dt);
  } else {
    car.speed *= Math.max(0, 1 - dt * (brake ? 2.8 : 0.75));
  }

  if (Math.abs(car.speed) > 5) {
    const grip = brake ? 0.58 : 1;
    const pace = 0.35 + Math.min(1, Math.abs(car.speed) / VEHICLE.maxSpeed) * 0.65;
    car.angle += controls.x * VEHICLE.steering * pace * grip * dt * Math.sign(car.speed);
  }
  if (brake && Math.abs(car.speed) > 80) car.angle += controls.x * Math.sign(car.speed) * 0.025;

  const travel = car.speed * dt;
  if (!moveCar(car, Math.cos(car.angle) * travel, Math.sin(car.angle) * travel, world, system, 1.4)
      && Math.abs(car.speed) < 3) car.speed = 0;
  player.x = car.x;
  player.y = car.y;
  player.angle = car.angle;
}

function obstacleAhead(car, system, distanceLimit) {
  const forwardX = Math.cos(car.angle);
  const forwardY = Math.sin(car.angle);
  return system.cars.some((other) => {
    if (other === car || other.health <= 0) return false;
    const dx = other.x - car.x;
    const dy = other.y - car.y;
    const along = dx * forwardX + dy * forwardY;
    const across = Math.abs(dx * -forwardY + dy * forwardX);
    return along > 0 && along < distanceLimit && across < 35;
  });
}

export function updateTraffic(system, dt, world, random) {
  for (const car of system.cars) {
    car.collided = Math.max(0, car.collided - dt);
    car.smoke = Math.max(0, car.smoke - dt);
    if (car.driverKind !== 'traffic') continue;

    const crossing = world.roadAt(car.x, car.y)?.orientation === 'intersection';
    const position = car.horizontal ? car.x : car.y;
    if (crossing && Math.abs(position - car.nextTurn) < 23) {
      if (random() < 0.38) {
        car.horizontal = !car.horizontal;
        car.angle += (random() > 0.5 ? 1 : -1) * Math.PI / 2;
      }
      const nextNode = nearestIntersection(
        world.roads,
        car.x + Math.cos(car.angle) * 300,
        car.y + Math.sin(car.angle) * 300,
      );
      car.nextTurn = car.horizontal ? nextNode.x : nextNode.y;
    }

    const desired = obstacleAhead(car, system, 105) ? 0 : 105;
    car.speed += Math.sign(desired - car.speed) * Math.min(Math.abs(desired - car.speed), 75 * dt);
    const distance = car.speed * dt;
    if (!moveCar(car, Math.cos(car.angle) * distance, Math.sin(car.angle) * distance, world, system, 0.6)) {
      car.speed = 0;
      car.angle += (random() > 0.5 ? 1 : -1) * Math.PI / 2;
      car.horizontal = !car.horizontal;
      car.nextTurn = car.horizontal ? world.roads.x[0] : world.roads.y[0];
    }

    const outside = car.x < 120 || car.x > world.width - world.waterWidth - 120
      || car.y < 100 || car.y > world.height - 130;
    if (outside) {
      const junction = nearestIntersection(world.roads, car.x, car.y);
      car.x = junction.x;
      car.y = junction.y;
      car.angle = Math.floor(random() * 4) * Math.PI / 2;
      car.horizontal = Math.abs(Math.cos(car.angle)) > 0.5;
      car.nextTurn = car.horizontal
        ? junction.x + Math.cos(car.angle) * 250
        : junction.y + Math.sin(car.angle) * 250;
    }
  }
}

export function vehicleAtPoint(system, x, y, radius = 38) {
  return system.cars.find((car) => Math.hypot(car.x - x, car.y - y) < radius) ?? null;
}

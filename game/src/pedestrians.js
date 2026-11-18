const SKIN_TONES = ['#e8bd9e', '#d999ba', '#a7cbcf', '#ded4a6', '#a9a5d7'];

function positionAlong(path, fraction) {
  if (path.axis === 'x') return { x: path.x1 + (path.x2 - path.x1) * fraction, y: path.y1 };
  return { x: path.x1, y: path.y1 + (path.y2 - path.y1) * fraction };
}

export function createPedestrians(world, random, count = 34) {
  const routes = world.pedestrianPaths.filter((path) => Math.hypot(path.x2 - path.x1, path.y2 - path.y1) > 130);
  const crowd = [];
  for (let index = 0; index < count; index++) {
    const path = routes[Math.floor(random() * routes.length)];
    const progress = random();
    const start = positionAlong(path, progress);
    crowd.push({
      x: start.x,
      y: start.y,
      path,
      progress,
      direction: random() > 0.5 ? 1 : -1,
      speed: 24 + random() * 20,
      angle: path.axis === 'x' ? 0 : Math.PI / 2,
      color: SKIN_TONES[Math.floor(random() * SKIN_TONES.length)],
      fear: 0,
      fleeAngle: 0,
    });
  }
  return crowd;
}

function fleeFrom(pedestrian, source, duration) {
  pedestrian.fear = duration;
  pedestrian.fleeAngle = Math.atan2(pedestrian.y - source.y, pedestrian.x - source.x);
}

export function updatePedestrians(pedestrians, dt, vehicles, gunfire) {
  for (const person of pedestrians) {
    person.fear = Math.max(0, person.fear - dt);

    if (gunfire && Math.hypot(gunfire.x - person.x, gunfire.y - person.y) < 380) {
      fleeFrom(person, gunfire, 2.4);
    }
    if (!person.fear) {
      const threat = vehicles.cars.find((car) => Math.abs(car.speed) >= 175
        && Math.hypot(car.x - person.x, car.y - person.y) < 105);
      if (threat) fleeFrom(person, threat, 1.6);
    }

    if (person.fear > 0) {
      person.angle = person.fleeAngle;
      person.x = Math.max(20, Math.min(4160, person.x + Math.cos(person.angle) * 78 * dt));
      person.y = Math.max(20, Math.min(3220, person.y + Math.sin(person.angle) * 78 * dt));
      continue;
    }

    const { path } = person;
    const span = path.axis === 'x' ? path.x2 - path.x1 : path.y2 - path.y1;
    person.progress += person.direction * person.speed * dt / span;
    if (person.progress > 1) {
      person.progress = 1;
      person.direction = -1;
    } else if (person.progress < 0) {
      person.progress = 0;
      person.direction = 1;
    }

    const position = positionAlong(path, person.progress);
    person.x = position.x;
    person.y = position.y;
    person.angle = path.axis === 'x'
      ? (person.direction > 0 ? 0 : Math.PI)
      : (person.direction > 0 ? Math.PI / 2 : -Math.PI / 2);
  }
}

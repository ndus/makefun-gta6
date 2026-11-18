function pointOnPath(path, amount) {
  return path.axis === 'x'
    ? { x: path.x1 + (path.x2 - path.x1) * amount, y: path.y1 }
    : { x: path.x1, y: path.y1 + (path.y2 - path.y1) * amount };
}

export function createPedestrians(world, random, count = 34) {
  const paths = world.pedestrianPaths.filter((path) => Math.hypot(path.x2 - path.x1, path.y2 - path.y1) > 130);
  const pedestrians = [];
  for (let index = 0; index < count; index += 1) {
    const path = paths[Math.floor(random() * paths.length)];
    const amount = random();
    const point = pointOnPath(path, amount);
    pedestrians.push({
      x: point.x,
      y: point.y,
      path,
      progress: amount,
      direction: random() > 0.5 ? 1 : -1,
      speed: 24 + random() * 20,
      angle: path.axis === 'x' ? 0 : Math.PI / 2,
      color: ['#e8bd9e', '#d999ba', '#a7cbcf', '#ded4a6', '#a9a5d7'][Math.floor(random() * 5)],
      fear: 0,
      fleeAngle: 0,
    });
  }
  return pedestrians;
}

export function updatePedestrians(pedestrians, dt, vehicles, gunfire) {
  for (const pedestrian of pedestrians) {
    pedestrian.fear = Math.max(0, pedestrian.fear - dt);
    if (gunfire && Math.hypot(gunfire.x - pedestrian.x, gunfire.y - pedestrian.y) < 380) {
      pedestrian.fear = 2.4;
      pedestrian.fleeAngle = Math.atan2(pedestrian.y - gunfire.y, pedestrian.x - gunfire.x);
    }
    if (!pedestrian.fear) {
      for (const car of vehicles.cars) {
        if (Math.abs(car.speed) < 175) continue;
        const distance = Math.hypot(car.x - pedestrian.x, car.y - pedestrian.y);
        if (distance < 105) {
          pedestrian.fear = 1.6;
          pedestrian.fleeAngle = Math.atan2(pedestrian.y - car.y, pedestrian.x - car.x);
          break;
        }
      }
    }

    if (pedestrian.fear > 0) {
      pedestrian.angle = pedestrian.fleeAngle;
      pedestrian.x += Math.cos(pedestrian.angle) * 78 * dt;
      pedestrian.y += Math.sin(pedestrian.angle) * 78 * dt;
      pedestrian.x = Math.max(20, Math.min(4160, pedestrian.x));
      pedestrian.y = Math.max(20, Math.min(3220, pedestrian.y));
      continue;
    }

    const path = pedestrian.path;
    const length = path.axis === 'x' ? path.x2 - path.x1 : path.y2 - path.y1;
    pedestrian.progress += pedestrian.direction * pedestrian.speed * dt / length;
    if (pedestrian.progress > 1) {
      pedestrian.progress = 1;
      pedestrian.direction = -1;
    } else if (pedestrian.progress < 0) {
      pedestrian.progress = 0;
      pedestrian.direction = 1;
    }
    const point = pointOnPath(path, pedestrian.progress);
    pedestrian.x = point.x;
    pedestrian.y = point.y;
    pedestrian.angle = path.axis === 'x'
      ? (pedestrian.direction > 0 ? 0 : Math.PI)
      : (pedestrian.direction > 0 ? Math.PI / 2 : -Math.PI / 2);
  }
}

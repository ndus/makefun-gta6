import { stageMissionScene } from './missions.js';

/** Place the requested scene into the live city before the first frame. */
export function stageScene(name, game, random) {
  const showTitle = name === 'start';
  game.state = showTitle ? 'start' : 'playing';
  game.stageCamera = showTitle ? { x: 2950, y: 960 } : null;

  if (name === 'chase') {
    const { player, world, vehicles } = game;
    const x = world.roads.x[3];
    const y = world.roads.y[1];
    player.x = x - 430;
    player.y = y + 24;
    player.angle = 0;
    player.vehicle = vehicles.cars.find((car) => car.driverKind === 'parked') ?? null;
    if (player.vehicle) {
      Object.assign(player.vehicle, { x: player.x, y: player.y, angle: 0, speed: 310, driverKind: 'player' });
      vehicles.playerCar = player.vehicle;
    }
    for (const car of vehicles.cars) {
      if (car.driverKind === 'parked' && car.x > player.x - 50 && car.x < player.x + 650 && Math.abs(car.y - y) < 80) car.y = y - 64;
    }
    game.wantedHeat = 3;
    game.wanted = 3;
    game.objective = 'Wanted 3 · Keep moving through Downtown.';
    game.target = null;
    for (const [index, car] of vehicles.cars.filter((item) => item.driverKind === 'traffic').slice(0, 2).entries()) {
      Object.assign(car, { x: x + 150 + index * 280, y: y + (index ? 24 : -26), angle: index ? 0 : Math.PI, speed: 105, horizontal: true, nextTurn: x + (index ? 600 : 0) });
    }
    game.police.units = [
      { id: 'police-stage-1', x: x - 700, y: y + 22, angle: 0, speed: 260, color: '#e8edf4', health: 135, driverKind: 'police', width: 48, length: 82, radius: 24, police: true, sirenPhase: 1, roadblock: false, fireCooldown: 0 },
      { id: 'police-stage-2', x: x - 800, y: y - 26, angle: 0, speed: 245, color: '#e8edf4', health: 135, driverKind: 'police', width: 48, length: 82, radius: 24, police: true, sirenPhase: 4, roadblock: false, fireCooldown: 0 },
    ];
    game.police.visible = true;
    game.police.spawnTimer = 8;
    game.police.nextId = 3;
  } else if (name === 'mission') {
    const { player } = game;
    player.vehicle = null;
    player.x = 960;
    player.y = 2580;
    game.wantedHeat = 1.1;
    game.wanted = 2;
    game.police.units = [{ id: 'police-stage-mission', x: 560, y: 2580, angle: Math.PI, speed: 120, color: '#e8edf4', health: 135, driverKind: 'police', width: 48, length: 82, radius: 24, police: true, sirenPhase: 1, roadblock: true, fireCooldown: 0 }];
    game.police.nextId = 1;
    stageMissionScene(game);
    player.x = 560;
    player.y = 2820;
    player.angle = -Math.PI / 2;
    game.stageCamera = { x: 650, y: 2850 };
    const traffic = game.vehicles.cars.filter((car) => car.driverKind === 'traffic');
    for (const [index, car] of traffic.slice(0, 2).entries()) {
      Object.assign(car, { x: 1100 + index * 105, y: 2538 + index * 42, angle: Math.PI, speed: 85, horizontal: true });
    }
  }

  if (!showTitle && name !== 'chase' && name !== 'mission') {
    const { player, world, vehicles, pedestrians } = game;
    const x = world.roads.x[2];
    const y = world.roads.y[1];
    player.x = x - 68;
    player.y = y + 75;
    player.angle = -Math.PI / 4;

    // Keep the objective within view and on a walkable stretch of sidewalk.
    game.target = { x: x + 170 + random() * 60, y: y + 67 };
    game.objective = 'Meet your contact at the pink marker.';

    // Existing cars remain normal traffic / enterable parked vehicles.
    const parked = vehicles.cars.filter((car) => car.driverKind === 'parked');
    for (const [index, car] of parked.slice(0, 6).entries()) {
      Object.assign(car, { x: x + [-410, -280, -145, 145, 280, 410][index],
        y: y + (index % 2 ? 40 : -40), angle: index % 2 ? Math.PI : 0, speed: 0 });
    }
    const traffic = vehicles.cars.filter((car) => car.driverKind === 'traffic');
    for (const [index, car] of traffic.slice(0, 2).entries()) {
      Object.assign(car, { x: x + (index ? 25 : -25), y: y + (index ? -200 : 180),
        angle: index ? Math.PI / 2 : -Math.PI / 2, speed: 85,
        horizontal: false, nextTurn: y + (index ? 540 : -540) });
    }

    const paths = world.pedestrianPaths.filter((path) => path.axis === 'x'
      && Math.abs(path.y1 - y) === 42
      && path.x2 > x - 500 && path.x1 < x + 500)
      .map((path) => ({ ...path, y1: y + Math.sign(path.y1 - y) * 72, y2: y + Math.sign(path.y2 - y) * 72 }));
    for (const [index, pedestrian] of pedestrians.slice(0, 12).entries()) {
      const path = paths[index % paths.length];
      const progress = 0.18 + Math.floor(index / paths.length) * .26;
      Object.assign(pedestrian, { path, progress, direction: index % 2 ? -1 : 1,
        x: path.x1 + (path.x2 - path.x1) * progress, y: path.y1 });
    }
  }

  // The frame loop publishes readiness once the city and HUD have been painted.
  game.shotReady = true;
  return game;
}

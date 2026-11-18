import { stageMissionScene } from './missions.js';

function placePlayer(game, x, y, angle) {
  Object.assign(game.player, { x, y, angle });
}

function seatPlayer(game, speed) {
  const { player, vehicles } = game;
  const car = vehicles.cars.find((item) => item.driverKind === 'parked') ?? null;
  player.vehicle = car;
  if (!car) return;

  const { x, y, angle } = player;
  Object.assign(car, { x, y, angle, speed, driverKind: 'player' });
  vehicles.playerCar = car;
}

function placeCars(game, driverKind, count, placement) {
  const cars = game.vehicles.cars.filter((car) => car.driverKind === driverKind);
  cars.slice(0, count).forEach((car, index) => Object.assign(car, placement(index)));
}

function placeTraffic(game, placement) {
  placeCars(game, 'traffic', 2, placement);
}

function setWanted(game, heat, stars, units, dispatch) {
  game.wantedHeat = heat;
  game.wanted = stars;
  game.police.units.splice(0, game.police.units.length, ...units);
  Object.assign(game.police, dispatch);
}

function patrol(id, x, y, { speed, sirenPhase, angle = 0, roadblock = false }) {
  return {
    id: `police-stage-${id}`, x, y, angle, speed, color: '#e8edf4', health: 135,
    driverKind: 'police', width: 48, length: 82, radius: 24, police: true,
    sirenPhase, roadblock, fireCooldown: 0,
  };
}

function setMission(game) {
  game.player.vehicle = null;
  stageMissionScene(game);
  placePlayer(game, 560, 2820, -Math.PI / 2);
  game.stageCamera = { x: 650, y: 2850 };
}

function placePedestrians(game, x, y) {
  const paths = game.world.pedestrianPaths
    .filter((path) => path.axis === 'x' && Math.abs(path.y1 - y) === 42
      && path.x2 > x - 500 && path.x1 < x + 500)
    .map((path) => ({
      ...path,
      y1: y + Math.sign(path.y1 - y) * 72,
      y2: y + Math.sign(path.y2 - y) * 72,
    }));
  if (!paths.length) return;

  game.pedestrians.slice(0, 12).forEach((pedestrian, index) => {
    const path = paths[index % paths.length];
    const progress = 0.18 + Math.floor(index / paths.length) * 0.26;
    Object.assign(pedestrian, {
      path, progress, direction: index % 2 ? -1 : 1,
      x: path.x1 + (path.x2 - path.x1) * progress, y: path.y1,
    });
  });
}

function stageStart(game) {
  game.state = 'start';
  game.stageCamera = { x: 2950, y: 960 };
}

function stagePlay(game, random) {
  const x = game.world.roads.x[2];
  const y = game.world.roads.y[1];
  placePlayer(game, x - 68, y + 75, -Math.PI / 4);
  // Keep the marker on a visible, walkable stretch of sidewalk.
  game.target = { x: x + 170 + random() * 60, y: y + 67 };
  game.objective = 'Meet your contact at the pink marker.';

  const parkingOffsets = [-410, -280, -145, 145, 280, 410];
  placeCars(game, 'parked', parkingOffsets.length, (index) => ({
    x: x + parkingOffsets[index], y: y + (index % 2 ? 40 : -40),
    angle: index % 2 ? Math.PI : 0, speed: 0,
  }));
  placeTraffic(game, (index) => ({
    x: x + (index ? 25 : -25), y: y + (index ? -200 : 180),
    angle: index ? Math.PI / 2 : -Math.PI / 2, speed: 85,
    horizontal: false, nextTurn: y + (index ? 540 : -540),
  }));
  placePedestrians(game, x, y);
}

function stageChase(game) {
  const x = game.world.roads.x[3];
  const y = game.world.roads.y[1];
  placePlayer(game, x - 430, y + 24, 0);
  seatPlayer(game, 310);
  for (const car of game.vehicles.cars) {
    if (car.driverKind === 'parked' && car.x > game.player.x - 50
      && car.x < game.player.x + 650 && Math.abs(car.y - y) < 80) car.y = y - 64;
  }
  placeTraffic(game, (index) => ({
    x: x + 150 + index * 280, y: y + (index ? 24 : -26),
    angle: index ? 0 : Math.PI, speed: 105,
    horizontal: true, nextTurn: x + (index ? 600 : 0),
  }));
  setWanted(game, 3, 3, [
    patrol(1, x - 700, y + 22, { speed: 260, sirenPhase: 1 }),
    patrol(2, x - 800, y - 26, { speed: 245, sirenPhase: 4 }),
  ], { visible: true, spawnTimer: 8, nextId: 3 });
  game.objective = 'Wanted 3 · Keep moving through Downtown.';
  game.target = null;
}

function stageMission(game) {
  setMission(game);
  setWanted(game, 1.1, 1.6, [
    patrol('mission', 560, 2580, { speed: 120, sirenPhase: 1, angle: Math.PI, roadblock: true }),
  ], { nextId: 1 });
  placeTraffic(game, (index) => ({
    x: 1100 + index * 105, y: 2538 + index * 42,
    angle: Math.PI, speed: 85, horizontal: true,
  }));
}

const SCENES = new Map([
  ['start', stageStart],
  ['play', stagePlay],
  ['chase', stageChase],
  ['mission', stageMission],
]);

/** Prepare a screenshot scene before the first frame, defaulting to play. */
export function stageScene(name, game, random) {
  game.state = 'playing';
  game.stageCamera = null;
  const setup = SCENES.get(name) ?? stagePlay;
  setup(game, random);
  // The frame loop publishes readiness after painting both the city and HUD.
  game.shotReady = true;
  return game;
}

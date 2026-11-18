import { CITY, COLORS, FONT } from './config.js';

const TWO_PI = Math.PI * 2;
const DEPTH_ACTOR = 0;
const DEPTH_OFFICER = 1;
const DEPTH_VEHICLE = 2;

function roundedRect(context, x, y, width, height, radius) {
  context.beginPath();
  context.roundRect(x, y, width, height, Math.min(radius, width / 2, height / 2));
}

function drawCar(context, car, now) {
  context.save();
  context.translate(car.x, car.y);
  context.rotate(car.angle);
  context.shadowBlur = 12;
  context.shadowColor = car.police ? '#52dff2' : car.color;
  context.fillStyle = car.police ? '#e5e9ee' : car.color;
  roundedRect(context, -car.length / 2, -car.width / 2, car.length, car.width, 10);
  context.fill();
  if (car.police) {
    context.fillStyle = '#182737';
    context.fillRect(-7, -car.width / 2 + 4, 26, car.width - 8);
    context.fillStyle = '#d9e1e8';
    context.font = `bold 8px ${FONT}`;
    context.fillText('VPD', -5, 3);
  }
  context.shadowBlur = 0;
  context.fillStyle = '#172431';
  roundedRect(context, -10, -car.width / 2 + 5, 24, car.width - 10, 5);
  context.fill();
  if (car.police) {
    const flash = Math.sin(now * 0.008) >= 0;
    for (let lamp = 0; lamp < 2; lamp += 1) {
      const active = flash === (lamp === 0);
      context.fillStyle = active ? (lamp === 0 ? '#ff365d' : '#45c8ff') : '#202b40';
      context.shadowColor = context.fillStyle;
      context.shadowBlur = active ? 24 : 0;
      context.fillRect(-5, lamp === 0 ? -17 : 7, 12, 10);
    }
    context.shadowBlur = 0;
  }
  context.fillStyle = '#f9e4a0';
  context.fillRect(car.length / 2 - 6, -car.width / 2 + 5, 4, 7);
  context.fillRect(car.length / 2 - 6, car.width / 2 - 12, 4, 7);
  context.fillStyle = '#fc4c79';
  context.fillRect(-car.length / 2 + 3, -car.width / 2 + 5, 4, 7);
  context.fillRect(-car.length / 2 + 3, car.width / 2 - 12, 4, 7);
  if (car.health < 55) {
    context.globalAlpha = 0.34;
    context.fillStyle = '#b7b8c3';
    context.beginPath();
    context.arc(-20, 0, 11, 0, TWO_PI);
    context.fill();
    context.globalAlpha = 1;
  }
  context.restore();
}

function drawPedestrian(context, pedestrian, kind = pedestrian.kind, color = pedestrian.color) {
  if (pedestrian.down) return;
  context.save();
  context.translate(pedestrian.x, pedestrian.y);
  context.rotate(pedestrian.angle);
  context.fillStyle = kind === 'guard' ? '#d9a43e' : '#e8bd9e';
  context.beginPath();
  context.arc(0, -7, 5, 0, TWO_PI);
  context.fill();
  context.fillStyle = kind === 'guard' ? '#352c27' : pedestrian.fear > 0 ? '#e95e88' : color;
  roundedRect(context, -5, -2, 10, 17, 4);
  context.fill();
  context.restore();
}

function drawGround(context) {
  context.fillStyle = COLORS.ground;
  context.fillRect(0, 0, CITY.width, CITY.height);
  context.fillStyle = COLORS.water;
  context.fillRect(0, CITY.height - 86, CITY.width, 86);
  context.fillRect(0, 0, CITY.waterWidth, CITY.height);
  context.strokeStyle = 'rgba(73,211,226,.42)';
  context.lineWidth = 2;
  for (let y = 60; y < CITY.height; y += 34) {
    context.beginPath();
    context.moveTo(0, y);
    context.quadraticCurveTo(90, y - 10, 220, y + 4);
    context.stroke();
  }
  context.fillStyle = '#438c9b';
  context.fillRect(CITY.waterWidth - 5, 0, 5, CITY.height);
  context.fillRect(0, CITY.height - 87, CITY.width, 3);
  context.fillStyle = 'rgba(120,225,230,.35)';
  for (let y = 12; y < CITY.height; y += 47) {
    context.fillRect(CITY.waterWidth - 23, y, 12, 20);
    context.fillRect(35 + (y % 180), y + 13, 48, 2);
  }
  for (let x = 24; x < CITY.width; x += 97) context.fillRect(x, CITY.height - 54 + (x % 17), 52, 2);
}

function drawRoads(context, world) {
  context.save();
  context.beginPath();
  context.rect(CITY.waterWidth, 0, CITY.width - CITY.waterWidth, CITY.height - 86);
  context.clip();
  context.fillStyle = COLORS.sidewalk;
  for (const x of world.roads.x) context.fillRect(x - 77, 0, 154, CITY.height);
  for (const y of world.roads.y) context.fillRect(0, y - 77, CITY.width, 154);
  context.fillStyle = COLORS.road;
  for (const x of world.roads.x) context.fillRect(x - 56, 0, 112, CITY.height);
  for (const y of world.roads.y) context.fillRect(0, y - 56, CITY.width, 112);
  context.strokeStyle = '#9c929f';
  context.lineWidth = 2;
  for (const x of world.roads.x) {
    for (const side of [-1, 1]) {
      context.beginPath();
      context.moveTo(x + side * 58, 0);
      context.lineTo(x + side * 58, CITY.height);
      context.stroke();
    }
  }
  for (const y of world.roads.y) {
    for (const side of [-1, 1]) {
      context.beginPath();
      context.moveTo(0, y + side * 58);
      context.lineTo(CITY.width, y + side * 58);
      context.stroke();
    }
  }
  context.setLineDash([26, 22]);
  context.strokeStyle = 'rgba(247,211,124,.72)';
  context.lineWidth = 3;
  for (const x of world.roads.x) {
    context.beginPath();
    context.moveTo(x, 0);
    context.lineTo(x, CITY.height);
    context.stroke();
  }
  for (const y of world.roads.y) {
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(CITY.width, y);
    context.stroke();
  }
  context.setLineDash([]);
  for (const x of world.roads.x) {
    for (const y of world.roads.y) {
      context.fillStyle = COLORS.road;
      context.fillRect(x - 55, y - 55, 110, 110);
      context.fillStyle = 'rgba(233,231,217,.78)';
      for (let mark = -40; mark <= 40; mark += 16) {
        for (const side of [-1, 1]) {
          context.fillRect(x + mark, y + side * 65 - 9, 8, 18);
          context.fillRect(x + side * 65 - 9, y + mark, 18, 8);
        }
      }
    }
  }
  context.restore();
}

function drawBuildings(context, world) {
  for (const building of world.buildings) {
    context.fillStyle = 'rgba(8,10,18,.35)';
    context.fillRect(building.x + 12, building.y + 15, building.width, building.height);
    context.fillStyle = building.color;
    context.fillRect(building.x, building.y, building.width, building.height);
    context.fillStyle = building.roof;
    context.fillRect(building.x + 5, building.y + 5, building.width - 10, 13);
    for (const window of building.windows) {
      context.fillStyle = window.lit ? window.hue : 'rgba(15,21,31,.5)';
      context.fillRect(window.x, window.y, 10, 7);
      if (window.lit) {
        context.globalAlpha = 0.12;
        context.fillRect(window.x - 2, window.y - 2, 14, 11);
        context.globalAlpha = 1;
      }
    }
    if (building.neon) {
      context.save();
      context.shadowBlur = 13;
      context.shadowColor = building.neon.color;
      context.fillStyle = building.neon.color;
      context.globalAlpha = 0.2;
      context.fillRect(building.x + 7, building.y + building.height - 38, Math.min(building.width - 14, 155), 33);
      context.globalAlpha = 1;
      context.fillRect(building.x + 9, building.y + building.height - 35, 3, 27);
      context.font = `bold 11px ${FONT}`;
      context.fillText(building.neon.text, building.x + 12, building.y + building.height - 12);
      context.restore();
    }
  }
}

function drawProps(context, world) {
  context.fillStyle = '#315b45';
  context.fillRect(world.park.left, world.park.top, world.park.right - world.park.left, world.park.bottom - world.park.top);
  context.strokeStyle = '#8bc292';
  context.lineWidth = 12;
  context.lineCap = 'round';
  for (const path of world.parkPaths) {
    context.beginPath();
    context.moveTo(path.x1, path.y1);
    context.lineTo(path.x2, path.y2);
    context.stroke();
  }
  context.lineCap = 'butt';
  for (const crate of world.crates) {
    context.save();
    context.translate(crate.x, crate.y);
    context.rotate(crate.angle);
    const size = crate.size;
    context.fillStyle = '#111d29';
    context.fillRect(-size / 2 + 8, -size / 2 + 10, size + 4, size + 4);
    for (let level = 0; level < (crate.stack ?? 1); level += 1) {
      const offset = level * 5;
      context.fillStyle = level % 2 ? '#b48251' : '#916445';
      context.fillRect(-size / 2 - offset, -size / 2 - offset, size, size);
      context.fillStyle = '#d6a66a';
      context.fillRect(-size / 2 - offset, -size / 2 - offset, size, 4);
      context.fillStyle = '#593f35';
      context.fillRect(size / 2 - offset - 5, -size / 2 - offset + 4, 5, size - 4);
      context.strokeStyle = '#d1a16a';
      context.lineWidth = 2;
      context.strokeRect(-size / 2 + 6 - offset, -size / 2 + 6 - offset, size - 17, size - 12);
      context.beginPath();
      context.moveTo(-size / 2 + 6 - offset, -size / 2 + 6 - offset);
      context.lineTo(size / 2 - 11 - offset, size / 2 - 6 - offset);
      context.stroke();
    }
    context.restore();
  }
  for (const tree of world.trees) {
    context.fillStyle = '#192f30';
    context.fillRect(tree.x - 3, tree.y + 6, 6, 13);
    context.fillStyle = tree.shade > 0.5 ? '#45a673' : '#33845f';
    context.beginPath();
    context.arc(tree.x, tree.y, tree.radius, 0, TWO_PI);
    context.fill();
    context.fillStyle = '#62b384';
    context.beginPath();
    context.arc(tree.x - 5, tree.y - 5, tree.radius * 0.6, 0, TWO_PI);
    context.fill();
  }
}

function addRenderable(renderables, pool, type, item) {
  const index = renderables.length;
  const entry = pool[index] ?? (pool[index] = {});
  entry.y = item.y;
  entry.type = type;
  entry.item = item;
  renderables.push(entry);
}

function drawVehicles(renderables, pool, vehicles, police) {
  for (const car of vehicles.cars) addRenderable(renderables, pool, DEPTH_VEHICLE, car);
  for (const unit of police?.units ?? []) addRenderable(renderables, pool, DEPTH_VEHICLE, unit);
}

function drawActors(renderables, pool, pedestrians, missions, police) {
  for (const actor of pedestrians) {
    if (!actor.down) addRenderable(renderables, pool, DEPTH_ACTOR, actor);
  }
  for (const guard of missions?.guards ?? []) {
    if (guard.health > 0) addRenderable(renderables, pool, DEPTH_ACTOR, guard);
  }
  for (const officer of police?.officers ?? []) {
    if (officer.health > 0) addRenderable(renderables, pool, DEPTH_OFFICER, officer);
  }
}

function drawEffects(context, game) {
  for (const pickup of game.pickups ?? []) {
    context.fillStyle = '#ffe07b';
    context.shadowBlur = 12;
    context.shadowColor = '#ffe07b';
    context.beginPath();
    context.arc(pickup.x, pickup.y, 8, 0, TWO_PI);
    context.fill();
    context.shadowBlur = 0;
  }
  for (const particle of game.particles ?? []) {
    context.globalAlpha = Math.max(0, 1 - particle.age / particle.life);
    context.fillStyle = particle.color;
    context.beginPath();
    context.arc(particle.x, particle.y, particle.size, 0, TWO_PI);
    context.fill();
  }
  context.globalAlpha = 1;
}

function drawMarkers(context, target, player) {
  if (target) {
    context.save();
    context.strokeStyle = COLORS.neonPink;
    context.shadowBlur = 16;
    context.shadowColor = COLORS.neonPink;
    context.lineWidth = 4;
    const pulse = Math.sin(performance.now() / 220);
    context.beginPath();
    context.arc(target.x, target.y, 23 + pulse * 5, 0, TWO_PI);
    context.stroke();
    context.globalAlpha = 0.5;
    context.fillStyle = COLORS.neonPink;
    context.fillRect(target.x - 2, target.y - 46 - Math.abs(pulse) * 8, 4, 28 + Math.abs(pulse) * 8);
    context.restore();
  }
  if (!player || player.vehicle) return;
  context.save();
  context.translate(player.x, player.y);
  context.rotate(player.angle);
  context.fillStyle = '#111a2b';
  context.beginPath();
  context.arc(0, 0, 15, 0, TWO_PI);
  context.fill();
  context.strokeStyle = '#8ffff0';
  context.lineWidth = 2;
  context.stroke();
  context.fillStyle = '#29e5c5';
  context.beginPath();
  context.arc(0, 0, 10, 0, TWO_PI);
  context.fill();
  context.fillStyle = '#e9d7c9';
  context.fillRect(5, -3, 16, 6);
  context.fillStyle = '#182537';
  context.fillRect(17, -3, 15, 6);
  context.strokeStyle = 'rgba(112,255,226,.55)';
  context.lineWidth = 1.5;
  context.beginPath();
  context.moveTo(33, 0);
  context.lineTo(78, 0);
  context.stroke();
  if (player.muzzleFlash > 0) {
    context.fillStyle = '#ffe38b';
    context.shadowBlur = 18;
    context.shadowColor = '#ff9d50';
    context.beginPath();
    context.arc(31, 0, 9, 0, TWO_PI);
    context.fill();
  }
  context.restore();
}

/** Creates the camera, coordinate conversion, and canvas renderer for the city. */
export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { width: 1, height: 1, x: 0, y: 0, ratio: 1 };
  const renderables = [];
  const renderablePool = [];

  function resize() {
    const ratio = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.floor(window.innerWidth * ratio);
    canvas.height = Math.floor(window.innerHeight * ratio);
    view.width = canvas.width / ratio;
    view.height = canvas.height / ratio;
    view.ratio = ratio;
    canvas.style.width = `${view.width}px`;
    canvas.style.height = `${view.height}px`;
  }

  /** Smoothly follows a world position while keeping the camera inside the city. */
  function updateCamera(target, dt, lookAheadX = 0, lookAheadY = 0) {
    const desiredX = target.x + lookAheadX - view.width / 2;
    const desiredY = target.y + lookAheadY - view.height / 2;
    const maxX = Math.max(0, CITY.width - view.width);
    const maxY = Math.max(0, CITY.height - view.height);
    view.x += (Math.max(0, Math.min(maxX, desiredX)) - view.x) * Math.min(1, dt * 5.6);
    view.y += (Math.max(0, Math.min(maxY, desiredY)) - view.y) * Math.min(1, dt * 5.6);
  }

  /** Converts canvas pixel coordinates into city world coordinates. */
  function screenToWorld(screenX, screenY) {
    return { x: screenX + view.x, y: screenY + view.y };
  }

  /** Draws the complete world frame, including camera shake and post tint. */
  function draw(game) {
    context.setTransform(view.ratio, 0, 0, view.ratio, 0, 0);
    context.fillStyle = '#080c15';
    context.fillRect(0, 0, view.width, view.height);
    if (game.cameraShake > 0) {
      const shake = game.cameraShake;
      context.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
      game.cameraShake = Math.max(0, shake - 0.45);
    }
    context.save();
    context.translate(-view.x, -view.y);
    drawGround(context);
    drawRoads(context, game.world);
    drawBuildings(context, game.world);
    drawProps(context, game.world);
    drawMarkers(context, game.target, null);
    drawEffects(context, game);
    renderables.length = 0;
    drawActors(renderables, renderablePool, game.pedestrians, game.missions, game.police);
    drawVehicles(renderables, renderablePool, game.vehicles, game.police);
    renderables.sort((a, b) => a.y - b.y);
    const now = performance.now();
    for (const drawable of renderables) {
      if (drawable.type === DEPTH_VEHICLE) drawCar(context, drawable.item, now);
      else if (drawable.type === DEPTH_OFFICER) drawPedestrian(context, drawable.item, 'guard', '#74d5ee');
      else drawPedestrian(context, drawable.item);
    }
    drawMarkers(context, null, game.player);
    context.restore();
    context.fillStyle = 'rgba(58,20,74,.09)';
    context.fillRect(0, 0, view.width, view.height);
  }

  resize();
  window.addEventListener('resize', resize);
  return { view, resize, updateCamera, screenToWorld, draw };
}

import { CITY, COLORS } from './config.js';

const PARK = { left: 1816, top: 1560, right: 2320, bottom: 2020 };
const DISTRICTS = [
  ['Dockyard', 0, 2040, 1816, 3300, '#33333a'],
  ['Downtown', 560, 0, 2960, 1500, '#34313d'],
  ['Casino Strip', 2960, 420, 4200, 2040, '#3a2b3d'],
  ['Residential', 1160, 1500, 2960, 3300, '#343744'],
  ['Old Viretta', 0, 0, 1160, 2040, '#34353d'],
].map(([name, x1, y1, x2, y2, color]) => ({ name, x1, y1, x2, y2, color }));

const FACADES = ['#5e5b68', '#555868', '#70616e', '#4d5864', '#6d6570', '#59616b'];
const ROOFS = ['#474653', '#56515e', '#3f4856'];
const SIGNS = ['VIOLET ROOM', 'PALMS', 'LUCKY STAR', 'NOCTURNE', 'MERCURY', 'HOTEL LUX'];
const segment = (axis, x1, y1, x2, y2) => ({ x1, y1, x2, y2, axis });
const sample = (items, random) => items[Math.floor(random() * items.length)];

function inPark(x, y) {
  return x >= PARK.left && x <= PARK.right && y >= PARK.top && y <= PARK.bottom;
}

function districtFor(x, y) {
  if (inPark(x, y)) return 'Viretta Park';
  const area = DISTRICTS.find(({ x1, x2, y1, y2 }) => x >= x1 && x < x2 && y >= y1 && y < y2);
  return area?.name ?? (x >= CITY.width - CITY.waterWidth ? 'Harbor' : 'Viretta');
}

function makeBuilding(random, left, top, right, bottom, district) {
  const margin = 28 + random() * 32;
  const x = left + margin;
  const y = top + margin;
  const width = Math.max(100, right - left - 2 * margin - random() * 32);
  const height = Math.max(100, bottom - top - 2 * margin - random() * 32);
  const casino = district === 'Casino Strip';
  const tall = casino || district === 'Downtown';
  const floors = (tall ? 7 : 2) + Math.floor(random() * (tall ? 23 : 8));
  const tint = random() > 0.5 ? '#ffdc9b' : '#80dfe7';
  const rows = Math.max(2, Math.floor(height / 23));
  const columns = Math.max(2, Math.floor(width / 24));
  const strideX = (width - 26) / columns;
  const strideY = (height - 38) / rows;
  const windows = [];

  for (let cell = 0; cell < rows * columns; cell++) {
    if (!(random() > 0.12)) continue;
    windows.push({
      x: x + 13 + (cell % columns) * strideX,
      y: y + 19 + Math.floor(cell / columns) * strideY,
      lit: random() > 0.23,
      hue: random() > 0.6 ? '#f5ad78' : tint,
    });
  }

  const color = sample(FACADES, random);
  const roof = sample(ROOFS, random);
  let neon = null;
  if (tall && random() > (casino ? 0.15 : 0.48)) {
    neon = { text: sample(SIGNS, random), color: random() > 0.5 ? COLORS.neonPink : COLORS.neonBlue };
  } else if (random() > 0.96) {
    neon = { text: 'OPEN', color: COLORS.neonPink };
  }
  return { x, y, width, height, floors, color, roof, windows, neon, district };
}

function hitsBox(x, y, radius, box) {
  const offsetX = x - Math.max(box.x, Math.min(x, box.x + box.width));
  const offsetY = y - Math.max(box.y, Math.min(y, box.y + box.height));
  return offsetX ** 2 + offsetY ** 2 < radius ** 2;
}

function makePark(random) {
  const parkPaths = [
    segment('x', 1860, 1585, 2275, 1585),
    segment('x', 1860, 1990, 2275, 1990),
    segment('y', 1860, 1585, 1860, 1990),
    segment('y', 2275, 1585, 2275, 1990),
    segment('x', 1860, 1788, 2275, 1788),
  ];
  const trees = [];
  for (let attempt = 0; attempt < 58; attempt++) {
    const x = PARK.left + 24 + random() * (PARK.right - PARK.left - 48);
    const y = PARK.top + 24 + random() * (PARK.bottom - PARK.top - 48);
    const nearWalkway = parkPaths.some((path) => {
      const horizontal = path.axis === 'x';
      const along = horizontal ? x : y;
      const across = horizontal ? y - path.y1 : x - path.x1;
      const start = horizontal ? path.x1 : path.y1;
      const end = horizontal ? path.x2 : path.y2;
      return across > -38 && across < 38 && along >= start - 20 && along <= end + 20;
    });
    if (!nearWalkway) trees.push({ x, y, radius: 12 + random() * 11, shade: random() });
  }
  return { parkPaths, trees };
}

function makeCargo(random) {
  const crates = Array.from({ length: 38 }, () => ({
    x: 360 + random() * 1300,
    y: 2110 + random() * 300,
    size: 25 + random() * 22,
    angle: random() * Math.PI,
  }));

  // Two columns of cargo sit alongside the waterfront.
  for (let row = 0; row < 6; row++) {
    for (const column of [0, 1]) {
      const tier = (row * 2 + column) % 3;
      crates.push({ x: 377 + column * 59, y: 2630 + row * 76, size: 40 + tier * 3, angle: 0, stack: 1 + tier });
    }
  }
  return crates;
}

export function createWorld(random) {
  const buildings = [];
  const sidewalks = [];
  const parkedSpawns = [];
  const roads = { x: CITY.avenueX.slice(), y: CITY.avenueY.slice(), width: CITY.roadWidth };
  const halfRoad = CITY.roadWidth / 2;

  // Traverse the blocks in row order so the same seed gives the same city.
  for (let row = 1; row < roads.y.length; row++) {
    const avenue = roads.y[row - 1];
    const top = avenue + halfRoad;
    const bottom = roads.y[row] - halfRoad;
    const centerY = (top + bottom) / 2;
    for (let column = 1; column < roads.x.length; column++) {
      const left = roads.x[column - 1] + halfRoad;
      const right = roads.x[column] - halfRoad;
      const centerX = (left + right) / 2;
      if (inPark(centerX, centerY)) continue;

      const district = districtFor(centerX, centerY);
      if (district === 'Dockyard' || Math.floor(random() * 2) === 0) {
        buildings.push(makeBuilding(random, left, top, right, bottom, district));
      } else {
        buildings.push(
          makeBuilding(random, left, top, centerX - 10, bottom, district),
          makeBuilding(random, centerX + 10, top, right, bottom, district),
        );
      }

      for (const side of [-1, 1]) {
        parkedSpawns.push({ x: centerX + (random() - 0.5) * 110, y: avenue + side * (halfRoad - 16), angle: 0 });
      }
      sidewalks.push(
        segment('x', left + 8, top - 14, right - 8, top - 14),
        segment('x', left + 8, bottom + 14, right - 8, bottom + 14),
        segment('y', left - 14, top + 8, left - 14, bottom - 8),
        segment('y', right + 14, top + 8, right + 14, bottom - 8),
      );
    }
  }

  const { parkPaths, trees } = makePark(random);
  const crates = makeCargo(random);

  function isWater(x, y) {
    return x < CITY.waterWidth || y > CITY.height - 86;
  }

  function isPointBlocked(x, y) {
    if (x < 0 || y < 0 || x >= CITY.width || y >= CITY.height || isWater(x, y)) return true;
    return buildings.some((box) => x >= box.x && x <= box.x + box.width && y >= box.y && y <= box.y + box.height)
      || crates.some((crate) => {
        const half = crate.size * 0.46;
        return Math.abs(x - crate.x) < half && Math.abs(y - crate.y) < half;
      });
  }

  function isCircleBlocked(x, y, radius = 0) {
    const west = x - radius;
    const east = x + radius;
    const north = y - radius;
    const south = y + radius;
    if (west < 0 || north < 0 || east >= CITY.width || south >= CITY.height) return true;
    if (isWater(x, y) || isWater(east, y) || isWater(west, y) || isWater(x, south) || isWater(x, north)) return true;
    return buildings.some((box) => hitsBox(x, y, radius, box)) || crates.some((crate) => {
      const half = crate.size * 0.45;
      const size = crate.size * 0.9;
      return hitsBox(x, y, radius, { x: crate.x - half, y: crate.y - half, width: size, height: size });
    });
  }

  function roadAt(x, y) {
    const avenue = roads.x.find((center) => Math.abs(x - center) <= CITY.roadWidth / 2);
    const street = roads.y.find((center) => Math.abs(y - center) <= CITY.roadWidth / 2);
    if (avenue === undefined) return street === undefined ? null : { orientation: 'horizontal', y: street };
    return street === undefined
      ? { orientation: 'vertical', x: avenue }
      : { orientation: 'intersection', x: avenue, y: street };
  }

  return {
    width: CITY.width, height: CITY.height, waterWidth: CITY.waterWidth,
    roads, buildings, crates, trees, parkPaths, sidewalks, parkedSpawns,
    districts: DISTRICTS, park: PARK,
    isWater, isPointBlocked, isCircleBlocked, roadAt, districtAt: districtFor,
    pedestrianPaths: sidewalks.concat(parkPaths),
  };
}

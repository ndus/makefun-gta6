import { CITY, COLORS } from './config.js';

const PARK = { left: 1816, top: 1560, right: 2320, bottom: 2020 };

const DISTRICTS = [
  { name: 'Dockyard', x1: 0, y1: 2040, x2: 1816, y2: 3300, color: '#33333a' },
  { name: 'Downtown', x1: 560, y1: 0, x2: 2960, y2: 1500, color: '#34313d' },
  { name: 'Casino Strip', x1: 2960, y1: 420, x2: 4200, y2: 2040, color: '#3a2b3d' },
  { name: 'Residential', x1: 1160, y1: 1500, x2: 2960, y2: 3300, color: '#343744' },
  { name: 'Old Viretta', x1: 0, y1: 0, x2: 1160, y2: 2040, color: '#34353d' },
];

const BUILDING_COLORS = ['#5e5b68', '#555868', '#70616e', '#4d5864', '#6d6570', '#59616b'];
const NEON_LABELS = ['VIOLET ROOM', 'PALMS', 'LUCKY STAR', 'NOCTURNE', 'MERCURY', 'HOTEL LUX'];

function insideRect(x, y, rect) {
  return x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height;
}

function overlapsCircleRect(x, y, radius, rect) {
  const closestX = Math.max(rect.x, Math.min(x, rect.x + rect.width));
  const closestY = Math.max(rect.y, Math.min(y, rect.y + rect.height));
  const dx = x - closestX;
  const dy = y - closestY;
  return dx * dx + dy * dy < radius * radius;
}

function makeBuilding(random, left, top, right, bottom, district) {
  const inset = 28 + random() * 32;
  const x = left + inset;
  const y = top + inset;
  const width = Math.max(100, right - left - inset * 2 - random() * 32);
  const height = Math.max(100, bottom - top - inset * 2 - random() * 32);
  const towerDistrict = district === 'Downtown' || district === 'Casino Strip';
  const heightFloors = towerDistrict ? 7 + Math.floor(random() * 23) : 2 + Math.floor(random() * 8);
  const windowColor = random() > 0.5 ? '#ffdc9b' : '#80dfe7';
  const rows = Math.max(2, Math.floor(height / 23));
  const columns = Math.max(2, Math.floor(width / 24));
  const windows = [];
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      if (random() > 0.12) {
        windows.push({
          x: x + 13 + column * ((width - 26) / columns),
          y: y + 19 + row * ((height - 38) / rows),
          lit: random() > 0.23,
          hue: random() > 0.6 ? '#f5ad78' : windowColor,
        });
      }
    }
  }
  return {
    x, y, width, height, floors: heightFloors,
    color: BUILDING_COLORS[Math.floor(random() * BUILDING_COLORS.length)],
    roof: ['#474653', '#56515e', '#3f4856'][Math.floor(random() * 3)],
    windows,
    neon: towerDistrict && random() > (district === 'Casino Strip' ? 0.15 : 0.48)
      ? { text: NEON_LABELS[Math.floor(random() * NEON_LABELS.length)], color: random() > 0.5 ? COLORS.neonPink : COLORS.neonBlue }
      : (random() > 0.96 ? { text: 'OPEN', color: COLORS.neonPink } : null),
    district,
  };
}

function districtFor(x, y) {
  if (x >= PARK.left && x <= PARK.right && y >= PARK.top && y <= PARK.bottom) return 'Viretta Park';
  for (const district of DISTRICTS) {
    if (x >= district.x1 && x < district.x2 && y >= district.y1 && y < district.y2) return district.name;
  }
  return x >= CITY.width - CITY.waterWidth ? 'Harbor' : 'Viretta';
}

/** Build deterministic city geometry and expose read-only collision and location queries. */
export function createWorld(random) {
  const buildings = [];
  const crates = [];
  const trees = [];
  const parkPaths = [];
  const sidewalks = [];
  const parkedSpawns = [];
  const roads = { x: [...CITY.avenueX], y: [...CITY.avenueY], width: CITY.roadWidth };

  for (let row = 0; row < CITY.avenueY.length - 1; row += 1) {
    for (let column = 0; column < CITY.avenueX.length - 1; column += 1) {
      const left = CITY.avenueX[column] + CITY.roadWidth / 2;
      const right = CITY.avenueX[column + 1] - CITY.roadWidth / 2;
      const top = CITY.avenueY[row] + CITY.roadWidth / 2;
      const bottom = CITY.avenueY[row + 1] - CITY.roadWidth / 2;
      const centerX = (left + right) / 2;
      const centerY = (top + bottom) / 2;
      if (centerX >= PARK.left && centerX <= PARK.right && centerY >= PARK.top && centerY <= PARK.bottom) continue;

      const district = districtFor(centerX, centerY);
      const count = district === 'Dockyard' ? 1 : 1 + Math.floor(random() * 2);
      for (let index = 0; index < count; index += 1) {
        const split = count === 1 ? [left, top, right, bottom]
          : index === 0 ? [left, top, centerX - 10, bottom]
            : [centerX + 10, top, right, bottom];
        buildings.push(makeBuilding(random, ...split, district));
      }

      // Parking bays are placed on quiet side streets and remain accessible from the sidewalk.
      for (let spot = 0; spot < 2; spot += 1) {
        const lane = spot === 0 ? -1 : 1;
        parkedSpawns.push({
          x: centerX + (random() - 0.5) * 110,
          y: CITY.avenueY[row] + lane * (CITY.roadWidth / 2 - 16),
          angle: 0,
        });
      }
      sidewalks.push({ x1: left + 8, y1: top - 14, x2: right - 8, y2: top - 14, axis: 'x' });
      sidewalks.push({ x1: left + 8, y1: bottom + 14, x2: right - 8, y2: bottom + 14, axis: 'x' });
      sidewalks.push({ x1: left - 14, y1: top + 8, x2: left - 14, y2: bottom - 8, axis: 'y' });
      sidewalks.push({ x1: right + 14, y1: top + 8, x2: right + 14, y2: bottom - 8, axis: 'y' });
    }
  }

  // Park paths form a loop with short cross paths; trees are kept away from the walkable strips.
  parkPaths.push(
    { x1: 1860, y1: 1585, x2: 2275, y2: 1585, axis: 'x' },
    { x1: 1860, y1: 1990, x2: 2275, y2: 1990, axis: 'x' },
    { x1: 1860, y1: 1585, x2: 1860, y2: 1990, axis: 'y' },
    { x1: 2275, y1: 1585, x2: 2275, y2: 1990, axis: 'y' },
    { x1: 1860, y1: 1788, x2: 2275, y2: 1788, axis: 'x' },
  );
  for (let index = 0; index < 58; index += 1) {
    const x = PARK.left + 24 + random() * (PARK.right - PARK.left - 48);
    const y = PARK.top + 24 + random() * (PARK.bottom - PARK.top - 48);
    if (parkPaths.some((path) => path.axis === 'x'
      ? y > path.y1 - 38 && y < path.y1 + 38 && x >= path.x1 - 20 && x <= path.x2 + 20
      : x > path.x1 - 38 && x < path.x1 + 38 && y >= path.y1 - 20 && y <= path.y2 + 20)) continue;
    trees.push({ x, y, radius: 12 + random() * 11, shade: random() });
  }

  for (let index = 0; index < 38; index += 1) {
    const x = 360 + random() * 1300;
    const y = 2110 + random() * 300;
    crates.push({ x, y, size: 25 + random() * 22, angle: random() * Math.PI });
  }

  // Waterfront cargo stacks leave the avenue and harbor escape route clear.
  for (let index = 0; index < 12; index += 1) {
    crates.push({ x: 377 + (index % 2) * 59, y: 2630 + Math.floor(index / 2) * 76,
      size: 40 + (index % 3) * 3, angle: 0, stack: 1 + index % 3 });
  }

  function isWater(x, y) {
    return x < CITY.waterWidth || y > CITY.height - 86;
  }

  function isPointBlocked(x, y) {
    if (x < 0 || y < 0 || x >= CITY.width || y >= CITY.height || isWater(x, y)) return true;
    for (const building of buildings) if (insideRect(x, y, building)) return true;
    for (const crate of crates) {
      if (Math.abs(x - crate.x) < crate.size * 0.46 && Math.abs(y - crate.y) < crate.size * 0.46) return true;
    }
    return false;
  }

  function isCircleBlocked(x, y, radius = 0) {
    if (x - radius < 0 || y - radius < 0 || x + radius >= CITY.width || y + radius >= CITY.height) return true;
    if (isWater(x, y) || isWater(x + radius, y) || isWater(x - radius, y) || isWater(x, y + radius) || isWater(x, y - radius)) return true;
    for (const building of buildings) if (overlapsCircleRect(x, y, radius, building)) return true;
    for (const crate of crates) {
      const box = { x: crate.x - crate.size * 0.45, y: crate.y - crate.size * 0.45, width: crate.size * 0.9, height: crate.size * 0.9 };
      if (overlapsCircleRect(x, y, radius, box)) return true;
    }
    return false;
  }

  function roadAt(x, y) {
    const vertical = roads.x.find((roadX) => Math.abs(x - roadX) <= CITY.roadWidth / 2);
    const horizontal = roads.y.find((roadY) => Math.abs(y - roadY) <= CITY.roadWidth / 2);
    if (vertical !== undefined && horizontal !== undefined) return { orientation: 'intersection', x: vertical, y: horizontal };
    if (vertical !== undefined) return { orientation: 'vertical', x: vertical };
    if (horizontal !== undefined) return { orientation: 'horizontal', y: horizontal };
    return null;
  }

  return {
    width: CITY.width,
    height: CITY.height,
    waterWidth: CITY.waterWidth,
    roads,
    buildings,
    crates,
    trees,
    parkPaths,
    sidewalks,
    parkedSpawns,
    districts: DISTRICTS,
    park: PARK,
    isWater,
    isPointBlocked,
    isCircleBlocked,
    roadAt,
    districtAt: districtFor,
    pedestrianPaths: [...sidewalks, ...parkPaths],
  };
}

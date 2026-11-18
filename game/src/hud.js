import { CITY } from './config.js';

export function createHud() {
  const health = document.getElementById('health-fill');
  const cash = document.getElementById('cash');
  const wanted = document.getElementById('wanted');
  const objective = document.getElementById('objective');
  const busted = document.getElementById('busted-meter');
  const banner = document.getElementById('mission-banner');
  const dialogue = document.getElementById('dialogue');
  const dialogueSpeaker = document.getElementById('dialogue-speaker');
  const dialogueCopy = document.getElementById('dialogue-copy');
  const mode = document.getElementById('mode');
  const map = document.getElementById('minimap');
  const context = map.getContext('2d');
  const scaleX = map.width / CITY.width;
  const scaleY = map.height / CITY.height;

  function drawMinimap(game, now) {
    context.clearRect(0, 0, map.width, map.height);
    context.fillStyle = '#131a25'; context.fillRect(0, 0, map.width, map.height);
    const tints = ['#66503c', '#414f72', '#753f70', '#426254', '#61546e'];
    for (const [index, district] of game.world.districts.entries()) {
      context.fillStyle = tints[index];
      context.fillRect(district.x1 * scaleX, district.y1 * scaleY, (district.x2 - district.x1) * scaleX, (district.y2 - district.y1) * scaleY);
    }
    context.fillStyle = '#173b55'; context.fillRect(0, (CITY.height - 86) * scaleY, map.width, 86 * scaleY);
    context.fillRect(0, 0, CITY.waterWidth * scaleX, map.height);
    const park = game.world.park;
    context.fillStyle = '#348260'; context.fillRect(park.left * scaleX, park.top * scaleY, (park.right - park.left) * scaleX, (park.bottom - park.top) * scaleY);
    context.save(); context.beginPath(); context.rect(CITY.waterWidth * scaleX, 0, (CITY.width - CITY.waterWidth) * scaleX, (CITY.height - 86) * scaleY); context.clip();
    context.strokeStyle = '#c2c8d0'; context.lineWidth = 4;
    for (const x of game.world.roads.x) { context.beginPath(); context.moveTo(x * scaleX, 0); context.lineTo(x * scaleX, map.height); context.stroke(); }
    for (const y of game.world.roads.y) { context.beginPath(); context.moveTo(0, y * scaleY); context.lineTo(map.width, y * scaleY); context.stroke(); }
    context.restore();
    for (const car of game.vehicles.cars) {
      context.fillStyle = car.driverKind === 'player' ? '#fff18c' : '#f58b86';
      context.beginPath(); context.arc(car.x * scaleX, car.y * scaleY, car.driverKind === 'player' ? 5 : 2, 0, Math.PI * 2); context.fill();
    }
    for (const unit of game.police?.units ?? []) { context.strokeStyle = '#091323'; context.lineWidth = 2; context.fillStyle = '#ff456c'; context.beginPath(); context.arc(unit.x * scaleX, unit.y * scaleY, 5.5, 0, Math.PI * 2); context.fill(); context.stroke(); }
    for (const officer of game.police?.officers ?? []) { context.fillStyle = '#78e8ff'; context.beginPath(); context.arc(officer.x * scaleX, officer.y * scaleY, 3.5, 0, Math.PI * 2); context.fill(); }
    if (game.target) {
      const pulse = 5 + (Math.sin(now / 180) + 1) * 2.2;
      context.fillStyle = '#ff72df'; context.beginPath(); context.arc(game.target.x * scaleX, game.target.y * scaleY, 4, 0, Math.PI * 2); context.fill();
      context.strokeStyle = '#fb60d4'; context.lineWidth = 3;
      context.beginPath(); context.arc(game.target.x * scaleX, game.target.y * scaleY, pulse, 0, Math.PI * 2); context.stroke();
    }
    const actor = game.player.vehicle ?? game.player;
    const px = actor.x * scaleX;
    const py = actor.y * scaleY;
    context.save(); context.translate(px, py); context.rotate(actor.angle);
    context.strokeStyle = '#06131e'; context.lineWidth = 3; context.fillStyle = '#62fff0'; context.beginPath(); context.moveTo(9, 0); context.lineTo(-6, -5); context.lineTo(-4, 0); context.lineTo(-6, 5); context.closePath(); context.fill(); context.stroke(); context.restore();
  }

  function update(game, now = performance.now()) {
    health.style.width = `${Math.max(0, Math.min(100, game.player.health))}%`;
    cash.textContent = `$${Math.max(0, Math.floor(game.player.cash)).toLocaleString('en-US')}`;
    const level = Math.max(0, Math.min(5, Math.ceil(game.wanted ?? 0)));
    wanted.textContent = '★'.repeat(level) + '☆'.repeat(5 - level);
    wanted.setAttribute('aria-label', `Wanted level ${level} of 5`);
    wanted.classList.toggle('decaying', Boolean(game.police?.noSightTime > 0 && !game.police?.visible && level > 0));
    const car = game.player.vehicle;
    mode.textContent = car
      ? `DRIVING · ${Math.round(Math.abs(car.speed) * 0.14)} MPH · ${game.world.districtAt(game.player.x, game.player.y)}`
      : `ON FOOT · ${game.world.districtAt(game.player.x, game.player.y)}`;
    const actor = game.player.vehicle ?? game.player;
    const distance = game.target ? Math.round(Math.hypot(actor.x - game.target.x, actor.y - game.target.y)) : null;
    objective.textContent = `${game.objective ?? 'Free roam · Viretta is yours to read.'}${distance === null ? '' : ` · ${distance} m`}`;
    const meter = game.police?.busted ?? 0;
    busted.hidden = meter <= 0;
    busted.firstElementChild.style.width = `${Math.round(meter * 100)}%`;
    banner.hidden = !(game.missions?.bannerTimer > 0);
    banner.textContent = game.missions?.banner ?? '';
    const line = game.missions?.dialogue?.[0];
    dialogue.hidden = !line || game.missions?.dialogueTimer <= 0;
    dialogueSpeaker.textContent = game.missions?.active >= 0 ? 'Luca "Shade" Marquez' : 'Contact';
    dialogueCopy.textContent = line ?? '';
    drawMinimap(game, now);
  }

  return { update };
}

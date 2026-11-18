import { reportCrime } from './police.js';

export const MISSION_DEFINITIONS = [
  {
    title: 'Echoes of the Harbor',
    start: { x: 860, y: 2580 },
    intro: ['Luca, the harbor crew has a drone case with your name on it.', 'Lift it from the dockyard. The case is hot; get it to the safehouse.'],
    pickup: { x: 860, y: 2580 },
    safehouse: { x: 480, y: 3120 },
    reward: 900,
  },
  {
    title: 'Circuit Break',
    start: { x: 1760, y: 960 },
    intro: ['The tower routes half the city cameras.', 'Plant the evidence upstairs, then disappear completely.'],
    tower: { x: 1760, y: 960 },
    reward: 1450,
  },
  {
    title: 'Neon Reckoning',
    start: { x: 3560, y: 960 },
    intro: ['The Sky-Arc crew has been waiting for you.', 'Clear the guards, take the payout, and make the safehouse.'],
    casino: { x: 3560, y: 960 },
    case: { x: 3560, y: 960 },
    safehouse: { x: 1160, y: 3120 },
    reward: 3200,
  },
];

const HOLD_TIME = 0.85;
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const actor = (player) => player.vehicle ?? player;

function setObjective(state, label, target) {
  state.objective = label;
  state.target = target ? { ...target } : null;
}

function startMission(state, index) {
  const mission = state.missions;
  const definition = MISSION_DEFINITIONS[index];
  mission.active = index;
  mission.step = 'intro';
  mission.hold = 0;
  mission.dialogue = [...definition.intro];
  mission.dialogueTimer = 3.8;
  mission.banner = `${definition.title} — started`;
  mission.bannerTimer = 3.4;
  if (index === 2) {
    mission.guards = [
      { id: 'guard-1', x: 3490, y: 916, angle: 0, health: 100, kind: 'guard', fireCooldown: 0.7 },
      { id: 'guard-2', x: 3620, y: 916, angle: Math.PI, health: 100, kind: 'guard', fireCooldown: 1.4 },
      { id: 'guard-3', x: 3560, y: 1028, angle: -Math.PI / 2, health: 100, kind: 'guard', fireCooldown: 2 },
    ];
    mission.payoutDropped = false;
  }
}

export function createMissions(saved = {}) {
  return {
    active: -1,
    step: 'start',
    completed: Math.max(0, Math.min(MISSION_DEFINITIONS.length, saved.completed ?? 0)),
    storyComplete: saved.storyComplete === true,
    hold: 0,
    dialogue: [],
    dialogueTimer: 0,
    banner: '',
    bannerTimer: 0,
    guards: [],
    payoutDropped: false,
  };
}

function nextStep(state, step, label, target, line) {
  const mission = state.missions;
  mission.step = step;
  mission.hold = 0;
  if (line) {
    mission.dialogue = [line];
    mission.dialogueTimer = 3.8;
  }
  setObjective(state, label, target);
}

function resolveMission(state, definition, hooks) {
  const mission = state.missions;
  state.player.cash += definition.reward;
  mission.completed = Math.max(mission.completed, mission.active + 1);
  mission.banner = `${definition.title} complete · +$${definition.reward.toLocaleString('en-US')}`;
  mission.bannerTimer = 5;
  mission.active = -1;
  mission.step = 'start';
  mission.guards = [];
  mission.payoutDropped = false;
  mission.storyComplete = mission.completed >= MISSION_DEFINITIONS.length;
  setObjective(state, mission.storyComplete ? 'Story complete · Viretta is yours.' : 'Mission complete · Find the next pink marker.', null);
  if (!mission.storyComplete) {
    const next = MISSION_DEFINITIONS[mission.completed];
    state.target = { ...next.start };
  }
  hooks.onReward?.(definition.reward);
}

export function updateMissions(state, dt, input, hooks = {}) {
  if (!state.missions || !state.player) return;
  const mission = state.missions;
  mission.bannerTimer = Math.max(0, mission.bannerTimer - dt);
  mission.dialogueTimer = Math.max(0, mission.dialogueTimer - dt);
  if (mission.dialogueTimer === 0 && mission.dialogue.length) {
    mission.dialogue.shift();
    if (mission.dialogue.length) mission.dialogueTimer = 3.8;
  }
  const actorPosition = actor(state.player);

  if (mission.active < 0) {
    if (state.progress?.metContact !== true) return;
    if (mission.completed >= MISSION_DEFINITIONS.length) return;
    const definition = MISSION_DEFINITIONS[mission.completed];
    setObjective(state, `Mission: ${definition.title} · Hold F at the marker`, definition.start);
    if (distance(actorPosition, definition.start) < 46 && (input?.isDown('KeyF') || input?.isDown('KeyE'))) {
      mission.hold += dt;
      if (mission.hold >= HOLD_TIME) startMission(state, mission.completed);
    } else mission.hold = 0;
    return;
  }

  const definition = MISSION_DEFINITIONS[mission.active];
  const player = state.player;
  if (mission.active === 0) {
    if (mission.step === 'intro') nextStep(state, 'pickup', 'Reach the dockyard and hold F to lift the drone case.', definition.pickup);
    else if (mission.step === 'pickup') {
      setObjective(state, `Lift the drone case · ${Math.round(distance(actorPosition, definition.pickup))} m`, definition.pickup);
      if (distance(actorPosition, definition.pickup) < 48 && (input?.isDown('KeyF') || input?.isDown('KeyE'))) {
        mission.hold += dt;
        if (mission.hold >= HOLD_TIME) {
          reportCrime(state, 'missionAct', 1.1);
          nextStep(state, 'escape', 'Escape to the harbor safehouse · lose the tail or get below 3 stars.', definition.safehouse, 'The case is yours. Patrols are moving in — lose them before the safehouse.');
        }
      } else mission.hold = 0;
    } else if (mission.step === 'escape') {
      setObjective(state, `Reach the harbor safehouse · ${Math.round(distance(actorPosition, definition.safehouse))} m · Wanted ${Math.ceil(state.wanted)}`, definition.safehouse);
      if (distance(actorPosition, definition.safehouse) < 55 && state.wanted < 3) resolveMission(state, definition, hooks);
    }
  } else if (mission.active === 1) {
    if (mission.step === 'intro') nextStep(state, 'plant', 'Reach the traffic-control tower and hold F to plant the evidence.', definition.tower);
    else if (mission.step === 'plant') {
      setObjective(state, `Plant the evidence · ${Math.round(distance(actorPosition, definition.tower))} m`, definition.tower);
      if (!player.vehicle && distance(actorPosition, definition.tower) < 48 && (input?.isDown('KeyF') || input?.isDown('KeyE'))) {
        mission.hold += dt;
        if (mission.hold >= 1.15) {
          reportCrime(state, 'missionAct', 1.4);
          nextStep(state, 'tail', 'Lose the police completely · Wanted 0.', null, 'Evidence planted. The whole city is looking for a ghost.');
        }
      } else mission.hold = 0;
    } else if (mission.step === 'tail') {
      setObjective(state, `Lose the police · Wanted ${Math.ceil(state.wanted)}${state.police.units.length ? ' · Break line of sight' : ''}`, null);
      if (state.wanted <= 0) resolveMission(state, definition, hooks);
    }
  } else if (mission.active === 2) {
    if (mission.step === 'intro') nextStep(state, 'guards', 'Defeat the Sky-Arc guards.', definition.casino);
    else if (mission.step === 'guards') {
      setObjective(state, `Defeat the Sky-Arc guards · ${mission.guards.filter((guard) => guard.health > 0).length} remaining`, definition.casino);
      if (mission.guards.every((guard) => guard.health <= 0)) {
        mission.payoutDropped = true;
        nextStep(state, 'case', 'Collect the payout case.', definition.case, 'The casino is quiet. Grab the payout and run.');
      }
    } else if (mission.step === 'case') {
      setObjective(state, `Collect the payout case · ${Math.round(distance(actorPosition, definition.case))} m`, definition.case);
      if (distance(actorPosition, definition.case) < 52) {
        mission.payoutDropped = false;
        mission.hasPayout = true;
        reportCrime(state, 'missionAct', 0.8);
        nextStep(state, 'escape', 'Escape to the safehouse.', definition.safehouse);
      }
    } else if (mission.step === 'escape') {
      setObjective(state, `Escape to the safehouse · ${Math.round(distance(actorPosition, definition.safehouse))} m`, definition.safehouse);
      if (distance(actorPosition, definition.safehouse) < 55) resolveMission(state, definition, hooks);
    }
  }
}

export function resetMissionAfterFailure(state) {
  if (!state.missions || state.missions.active < 0) return;
  const index = state.missions.active;
  state.missions.active = -1;
  state.missions.step = 'start';
  state.missions.hold = 0;
  state.missions.dialogue = [];
  state.missions.guards = [];
  state.target = { ...MISSION_DEFINITIONS[index].start };
  state.objective = `Mission reset · Return to ${MISSION_DEFINITIONS[index].title}.`;
}

export function stageMissionScene(state) {
  if (!state.missions) state.missions = createMissions();
  const mission = state.missions;
  mission.completed = 0;
  mission.active = 0;
  mission.step = 'escape';
  mission.dialogue = ['The case is yours. Patrols are moving in — lose them before the safehouse.'];
  mission.dialogueTimer = 8;
  mission.banner = '';
  mission.bannerTimer = 0;
  state.player.x = 960;
  state.player.y = 2580;
  state.player.angle = Math.PI;
  state.wanted = 1.6;
  setObjective(state, 'Reach the harbor safehouse · lose the tail or get below 3 stars.', MISSION_DEFINITIONS[0].safehouse);
}

import { reportCrime } from './police.js';

/** Mission titles, locations, intro dialogue, and rewards in story order. */
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

// Keep the exported mission metadata usable by callers independently of the runner.
const distanceLabel = (label) => ({ gap }) => `${label} · ${Math.round(gap)} m`;
const interact = (input) => input?.isDown('KeyF') || input?.isDown('KeyE');
const crime = (amount) => ({ state }) => reportCrime(state, 'missionAct', amount);
const intro = { id: 'intro', objective: null, target: null, complete: () => true };

function heldNear(radius, duration = HOLD_TIME, onFoot = false) {
  return ({ state, gap, input, dt }) => {
    const mission = state.missions;
    const holding = gap < radius && (!onFoot || !state.player.vehicle) && interact(input);
    mission.hold = holding ? mission.hold + dt : 0;
    return mission.hold >= duration;
  };
}

const HARBOR_ESCAPE_DIALOGUE = 'The case is yours. Patrols are moving in — lose them before the safehouse.';

// Targets name locations in MISSION_DEFINITIONS. Entry text is shown for the
// transition tick; objective text is refreshed while the step is active.
const MISSION_STEPS = [
  [
    intro,
    {
      id: 'pickup', target: 'pickup',
      entry: 'Reach the dockyard and hold F to lift the drone case.',
      objective: distanceLabel('Lift the drone case'),
      complete: heldNear(48),
      onComplete: crime(1.1),
    },
    {
      id: 'escape', target: 'safehouse',
      entry: 'Escape to the harbor safehouse · lose the tail or get below 3 stars.',
      dialogue: HARBOR_ESCAPE_DIALOGUE,
      objective: ({ state, gap }) => `Reach the harbor safehouse · ${Math.round(gap)} m · Wanted ${Math.ceil(state.wanted)}`,
      complete: ({ state, gap }) => gap < 55 && state.wanted < 3,
    },
  ],
  [
    intro,
    {
      id: 'plant', target: 'tower',
      entry: 'Reach the traffic-control tower and hold F to plant the evidence.',
      objective: distanceLabel('Plant the evidence'),
      complete: heldNear(48, 1.15, true),
      onComplete: crime(1.4),
    },
    {
      id: 'tail', target: null,
      entry: 'Lose the police completely · Wanted 0.',
      dialogue: 'Evidence planted. The whole city is looking for a ghost.',
      objective: ({ state }) => `Lose the police · Wanted ${Math.ceil(state.wanted)}${state.police.units.length ? ' · Break line of sight' : ''}`,
      complete: ({ state }) => state.wanted <= 0,
    },
  ],
  [
    {
      ...intro,
      onStart(mission) {
        mission.guards = [
          { id: 'guard-1', x: 3490, y: 916, angle: 0, health: 100, kind: 'guard', fireCooldown: 0.7 },
          { id: 'guard-2', x: 3620, y: 916, angle: Math.PI, health: 100, kind: 'guard', fireCooldown: 1.4 },
          { id: 'guard-3', x: 3560, y: 1028, angle: -Math.PI / 2, health: 100, kind: 'guard', fireCooldown: 2 },
        ];
        mission.payoutDropped = false;
      },
    },
    {
      id: 'guards', target: 'casino',
      entry: 'Defeat the Sky-Arc guards.',
      objective: ({ state }) => `Defeat the Sky-Arc guards · ${state.missions.guards.filter((guard) => guard.health > 0).length} remaining`,
      complete: ({ state }) => state.missions.guards.every((guard) => guard.health <= 0),
      onComplete: ({ state }) => { state.missions.payoutDropped = true; },
    },
    {
      id: 'case', target: 'case',
      entry: 'Collect the payout case.',
      dialogue: 'The casino is quiet. Grab the payout and run.',
      objective: distanceLabel('Collect the payout case'),
      complete: ({ gap }) => gap < 52,
      onComplete: ({ state }) => {
        state.missions.payoutDropped = false;
        state.missions.hasPayout = true;
        reportCrime(state, 'missionAct', 0.8);
      },
    },
    {
      id: 'escape', target: 'safehouse',
      entry: 'Escape to the safehouse.',
      objective: distanceLabel('Escape to the safehouse'),
      complete: ({ gap }) => gap < 55,
    },
  ],
];

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
  MISSION_STEPS[index][0].onStart?.(mission);
}

/** Create mission state from saved story progress. */
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

function enterStep(state, definition, step) {
  const mission = state.missions;
  mission.step = step.id;
  mission.hold = 0;
  if (step.dialogue) {
    mission.dialogue = [step.dialogue];
    mission.dialogueTimer = 3.8;
  }
  setObjective(state, step.entry, definition[step.target]);
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

/** Advance dialogue, offer the next mission, or run one active mission step. */
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
    if (distance(actorPosition, definition.start) < 46 && interact(input)) {
      mission.hold += dt;
      if (mission.hold >= HOLD_TIME) startMission(state, mission.completed);
    } else mission.hold = 0;
    return;
  }

  const definition = MISSION_DEFINITIONS[mission.active];
  const steps = MISSION_STEPS[mission.active];
  const index = steps?.findIndex((step) => step.id === mission.step) ?? -1;
  if (index < 0) return;

  const step = steps[index];
  const target = definition[step.target];
  const context = { state, dt, input, gap: target ? distance(actorPosition, target) : Infinity };
  if (step.objective) setObjective(state, step.objective(context), target);
  if (!step.complete(context)) return;

  step.onComplete?.(context);
  const next = steps[index + 1];
  if (next) enterStep(state, definition, next);
  else resolveMission(state, definition, hooks);
}

/** Abandon the active attempt and point the player back to its start marker. */
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

/** Stage the harbor escape with its screenshot dialogue and objective. */
export function stageMissionScene(state) {
  if (!state.missions) state.missions = createMissions();
  const mission = state.missions;
  mission.completed = 0;
  mission.active = 0;
  mission.step = 'escape';
  mission.dialogue = [HARBOR_ESCAPE_DIALOGUE];
  mission.dialogueTimer = 8;
  mission.banner = '';
  mission.bannerTimer = 0;
  state.player.x = 960;
  state.player.y = 2580;
  state.player.angle = Math.PI;
  state.wanted = 1.6;
  setObjective(state, 'Reach the harbor safehouse · lose the tail or get below 3 stars.', MISSION_DEFINITIONS[0].safehouse);
}

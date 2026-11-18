const AXES = [
  [['KeyD', 'ArrowRight'], ['KeyA', 'ArrowLeft']],
  [['KeyS', 'ArrowDown'], ['KeyW', 'ArrowUp']],
];
const CAPTURED_KEYS = new Set(['Space', ...AXES.flat(2)]);
const POINTER_PRESS = ['PointerPrimary', undefined, 'PointerSecondary'];

export function createInput(canvas) {
  const keysDown = new Set();
  let queued = new Set();
  let thisFrame = new Set();
  const pointer = { x: 0, y: 0, buttons: 0, moved: false };
  const isDown = (code) => keysDown.has(code);
  const wasPressed = (code) => thisFrame.has(code) || queued.has(code);

  window.addEventListener('keydown', (event) => {
    const key = event.code;
    if (CAPTURED_KEYS.has(key)) event.preventDefault();
    if (!isDown(key)) queued.add(key);
    keysDown.add(key);
  });
  window.addEventListener('keyup', ({ code }) => keysDown.delete(code));
  window.addEventListener('blur', () => {
    keysDown.clear();
    queued.clear();
    thisFrame.clear();
    pointer.buttons = 0;
  });

  // Keep the mouse in CSS pixels so aiming can use the renderer's viewport.
  function locatePointer(event) {
    const { left, top } = canvas.getBoundingClientRect();
    Object.assign(pointer, { x: event.clientX - left, y: event.clientY - top, moved: true });
  }

  canvas.addEventListener('pointermove', locatePointer);
  canvas.addEventListener('pointerdown', (event) => {
    locatePointer(event);
    pointer.buttons |= 1 << event.button;
    const press = POINTER_PRESS[event.button];
    if (press) queued.add(press);
    canvas.setPointerCapture?.(event.pointerId);
  });
  canvas.addEventListener('pointerup', ({ button }) => {
    pointer.buttons &= ~(1 << button);
  });
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());

  const axisValue = ([positive, negative]) => Number(positive.some(isDown)) - Number(negative.some(isDown));
  return {
    isDown,
    wasPressed,
    takePresses() {
      thisFrame = new Set(queued);
      queued.clear();
      return thisFrame;
    },
    consumePress(code) {
      const pending = thisFrame.has(code) || queued.has(code);
      thisFrame.delete(code);
      queued.delete(code);
      return pending;
    },
    movement() {
      const [x, y] = AXES.map(axisValue);
      return { x, y };
    },
    pointer,
  };
}

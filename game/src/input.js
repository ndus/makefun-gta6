const MOVEMENT = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight']);
const PREVENT_DEFAULT = new Set([...MOVEMENT, 'Space']);

/** Keyboard holds and one-frame presses, plus pointer state in canvas CSS pixels. */
export function createInput(canvas) {
  const held = new Set();
  const pressed = new Set();
  let framePressed = new Set();
  const pointer = { x: 0, y: 0, buttons: 0, moved: false };

  function onKeyDown(event) {
    if (PREVENT_DEFAULT.has(event.code)) event.preventDefault();
    if (!held.has(event.code)) pressed.add(event.code);
    held.add(event.code);
  }

  function onKeyUp(event) {
    held.delete(event.code);
  }

  function onPointerMove(event) {
    const rect = canvas.getBoundingClientRect();
    pointer.x = event.clientX - rect.left;
    pointer.y = event.clientY - rect.top;
    pointer.moved = true;
  }

  function clear() {
    held.clear();
    pressed.clear();
    framePressed.clear();
    pointer.buttons = 0;
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', clear);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerdown', (event) => {
    onPointerMove(event);
    pointer.buttons |= 1 << event.button;
    if (event.button === 0) pressed.add('PointerPrimary');
    if (event.button === 2) pressed.add('PointerSecondary');
    canvas.setPointerCapture?.(event.pointerId);
  });
  canvas.addEventListener('pointerup', (event) => {
    pointer.buttons &= ~(1 << event.button);
  });
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());

  return {
    isDown(code) { return held.has(code); },
    wasPressed(code) { return framePressed.has(code) || pressed.has(code); },
    takePresses() {
      framePressed = new Set(pressed);
      pressed.clear();
      return framePressed;
    },
    consumePress(code) {
      const hadPress = framePressed.has(code) || pressed.has(code);
      framePressed.delete(code);
      pressed.delete(code);
      return hadPress;
    },
    movement() {
      const x = (held.has('KeyD') || held.has('ArrowRight') ? 1 : 0)
        - (held.has('KeyA') || held.has('ArrowLeft') ? 1 : 0);
      const y = (held.has('KeyS') || held.has('ArrowDown') ? 1 : 0)
        - (held.has('KeyW') || held.has('ArrowUp') ? 1 : 0);
      return { x, y };
    },
    pointer,
  };
}

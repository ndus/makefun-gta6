/** Tiny local synth that degrades to silent no-ops when WebAudio is unavailable. */
export function createAudio() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  let context = null;
  let master = null;
  let engineOscillator = null;
  let engineGain = null;
  let sirenOscillator = null;
  let muted = false;

  function ensureContext() {
    if (!AudioContextClass) return null;
    try {
      if (!context) {
        context = new AudioContextClass();
        master = context.createGain();
        master.gain.value = muted ? 0 : 0.23;
        master.connect(context.destination);
      }
      if (context.state === 'suspended') context.resume().catch(() => {});
      return context;
    } catch {
      return null;
    }
  }

  function tone(frequency, duration, type = 'sine', volume = 0.18) {
    const audio = ensureContext();
    if (!audio) return;
    try {
      const oscillator = audio.createOscillator();
      const gain = audio.createGain();
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency, audio.currentTime);
      gain.gain.setValueAtTime(volume, audio.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + duration);
      oscillator.connect(gain); gain.connect(master);
      oscillator.start(); oscillator.stop(audio.currentTime + duration);
    } catch {
      // Browsers may refuse audio while a tab is backgrounded; gameplay still continues.
    }
  }

  function setDriven(isDriving, speed = 0) {
    const audio = ensureContext();
    if (!audio) return;
    try {
      if (isDriving && !engineOscillator) {
        engineOscillator = audio.createOscillator();
        engineGain = audio.createGain();
        engineOscillator.type = 'sawtooth';
        engineOscillator.frequency.value = 48;
        engineGain.gain.value = 0;
        engineOscillator.connect(engineGain); engineGain.connect(master);
        engineOscillator.start();
      }
      if (engineOscillator && engineGain) {
        engineOscillator.frequency.setTargetAtTime(44 + Math.min(240, Math.abs(speed) * 0.52), audio.currentTime, 0.12);
        engineGain.gain.setTargetAtTime(isDriving ? 0.055 : 0, audio.currentTime, 0.18);
      }
    } catch {
      engineOscillator = null;
      engineGain = null;
    }
  }

  return {
    unlock: ensureContext,
    shot() { tone(210, 0.075, 'square', 0.14); tone(92, 0.12, 'triangle', 0.1); },
    pickup() { tone(660, 0.09, 'sine', 0.12); tone(880, 0.16, 'sine', 0.1); },
    missionSting() { tone(330, 0.15, 'triangle', 0.12); tone(495, 0.22, 'triangle', 0.13); tone(660, 0.32, 'sine', 0.1); },
    uiClick() { tone(420, 0.055, 'sine', 0.08); },
    setDriven,
    setSiren(enabled) {
      const audio = ensureContext();
      if (!audio) return;
      if (enabled && !sirenOscillator) {
        try {
          sirenOscillator = audio.createOscillator();
          const gain = audio.createGain();
          sirenOscillator.type = 'sawtooth';
          sirenOscillator.frequency.value = 530;
          gain.gain.value = 0.035;
          sirenOscillator.connect(gain); gain.connect(master); sirenOscillator.start();
          const mod = audio.createOscillator();
          const modGain = audio.createGain();
          mod.frequency.value = 0.7; modGain.gain.value = 250; mod.connect(modGain); modGain.connect(sirenOscillator.frequency); mod.start();
          sirenOscillator.__modulator = mod;
        } catch { sirenOscillator = null; }
      } else if (!enabled && sirenOscillator) {
        try { sirenOscillator.__modulator?.stop(); sirenOscillator.stop(); } catch { /* already stopped */ }
        sirenOscillator = null;
      }
    },
    toggleMute() {
      muted = !muted;
      if (master && context) master.gain.setTargetAtTime(muted ? 0 : 0.23, context.currentTime, 0.05);
      return muted;
    },
    get muted() { return muted; },
  };
}

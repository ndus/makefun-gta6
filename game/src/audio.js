/** Creates the small WebAudio sound system used by the game. */
export function createAudio() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  let context = null;
  let master = null;
  let limiter = null;
  let engine = null;
  let siren = null;
  let muted = false;
  const oneShots = new Set();

  function ensureContext() {
    if (!AudioContextClass) return null;
    try {
      if (!context) {
        context = new AudioContextClass();
        master = context.createGain();
        master.gain.value = muted ? 0 : 0.23;
        limiter = context.createDynamicsCompressor();
        limiter.threshold.value = -8;
        limiter.knee.value = 0;
        limiter.ratio.value = 20;
        limiter.attack.value = 0.003;
        limiter.release.value = 0.12;
        master.connect(limiter);
        limiter.connect(context.destination);
      }
      if (context.state === 'suspended') context.resume().catch(() => {});
      return context;
    } catch {
      return null;
    }
  }

  function stopOscillator(oscillator) {
    if (!oscillator) return;
    try { oscillator.stop(); } catch { /* It may already have stopped. */ }
    try { oscillator.disconnect(); } catch { /* The context may be closing. */ }
  }

  function stopLoop(loop) {
    if (!loop) return;
    stopOscillator(loop.oscillator);
    for (const oscillator of loop.modulators) stopOscillator(oscillator);
  try { loop.gain?.disconnect(); } catch { /* The context may be closing. */ }
  }

  function stopLoops() {
    stopLoop(engine);
    stopLoop(siren);
    engine = null;
    siren = null;
  }

  function stopOneShots() {
    for (const oscillator of oneShots) stopOscillator(oscillator);
    oneShots.clear();
  }

  function tone(frequency, duration, type = 'sine', volume = 0.18) {
    if (muted) return;
    const audio = ensureContext();
    if (!audio) return;
    let oscillator;
    try {
      oscillator = audio.createOscillator();
      const gain = audio.createGain();
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency, audio.currentTime);
      gain.gain.setValueAtTime(volume, audio.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + duration);
      oscillator.connect(gain);
      gain.connect(master);
      oneShots.add(oscillator);
      oscillator.addEventListener('ended', () => {
        oneShots.delete(oscillator);
        oscillator.disconnect();
        gain.disconnect();
      }, { once: true });
      oscillator.start();
      oscillator.stop(audio.currentTime + duration);
    } catch {
      if (oscillator) {
        oneShots.delete(oscillator);
        stopOscillator(oscillator);
      }
    }
  }

  function setDriven(isDriving, speed = 0) {
    if (muted || !isDriving) {
      stopLoop(engine);
      engine = null;
      return;
    }
    const audio = ensureContext();
    if (!audio) return;
    let oscillator;
    let gain;
    try {
      if (!engine) {
        oscillator = audio.createOscillator();
        gain = audio.createGain();
        oscillator.type = 'sawtooth';
        oscillator.frequency.value = 48;
        gain.gain.value = 0.055;
        oscillator.connect(gain);
        gain.connect(master);
        oscillator.start();
        engine = { oscillator, gain, modulators: [] };
      }
      engine.oscillator.frequency.setTargetAtTime(44 + Math.min(240, Math.abs(speed) * 0.52), audio.currentTime, 0.12);
    } catch {
      stopOscillator(oscillator);
      try { gain?.disconnect(); } catch { /* The context may be closing. */ }
      stopLoop(engine);
      engine = null;
    }
  }

  function setSiren(enabled) {
    if (muted || !enabled) {
      stopLoop(siren);
      siren = null;
      return;
    }
    const audio = ensureContext();
    if (!audio || siren) return;
    let oscillator;
    const modulators = [];
    try {
      oscillator = audio.createOscillator();
      const gain = audio.createGain();
      oscillator.type = 'sawtooth';
      oscillator.frequency.value = 530;
      gain.gain.value = 0.035;
      oscillator.connect(gain);
      gain.connect(master);
      oscillator.start();

      const modulator = audio.createOscillator();
      const modulatorGain = audio.createGain();
      modulator.frequency.value = 0.7;
      modulatorGain.gain.value = 250;
      modulator.connect(modulatorGain);
      modulatorGain.connect(oscillator.frequency);
      modulator.start();
      modulators.push(modulator);
      siren = { oscillator, gain, modulators };
    } catch {
      stopOscillator(oscillator);
      for (const modulator of modulators) stopOscillator(modulator);
      siren = null;
    }
  }

  function toggleMute() {
    muted = !muted;
    if (muted) {
      stopOneShots();
      stopLoops();
    }
    if (master && context) master.gain.setTargetAtTime(muted ? 0 : 0.23, context.currentTime, 0.05);
    return muted;
  }

  return {
    /** Starts or resumes the audio context after a user gesture. */
    unlock: ensureContext,
    /** Plays the paired report of a weapon shot. */
    shot() { tone(210, 0.075, 'square', 0.14); tone(92, 0.12, 'triangle', 0.1); },
    /** Plays the two-note pickup cue. */
    pickup() { tone(660, 0.09, 'sine', 0.12); tone(880, 0.16, 'sine', 0.1); },
    /** Plays the mission completion cue. */
    missionSting() { tone(330, 0.15, 'triangle', 0.12); tone(495, 0.22, 'triangle', 0.13); tone(660, 0.32, 'sine', 0.1); },
    /** Plays the short interface confirmation cue. */
    uiClick() { tone(420, 0.055, 'sine', 0.08); },
    /** Starts or updates the engine loop, stopping it when the player leaves the car. */
    setDriven,
    /** Starts or stops the police siren loop. */
    setSiren,
    /** Toggles sound and immediately stops all active voices when muted. */
    toggleMute,
    get muted() { return muted; },
  };
}

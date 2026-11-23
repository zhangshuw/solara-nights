// Procedural WebAudio sound engine (zero external audio files): engine hum, gunshots, sirens, ambient pad, UI blips.

import { clamp } from './random.js';

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.ready = false;

    this.engineOsc = null;
    this.engineSub = null;
    this.engineGain = null;

    this.sirenOsc = null;
    this.sirenGain = null;

    this.padGain = null;
    this.noiseBuffer = null;
    this.sirenPhase = 0;
  }

  unlock() {
    if (this.ready) {
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      return;
    }
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;

    try {
      this.ctx = new AudioCtx();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.34;
      this.master.connect(this.ctx.destination);

      this.noiseBuffer = this._createNoiseBuffer(1.5);
      this._initContinuousLoops();
      this.ready = true;
    } catch {
      this.ready = false;
    }
  }

  _createNoiseBuffer(durationSec) {
    const sampleRate = this.ctx.sampleRate;
    const len = Math.floor(sampleRate * durationSec);
    const buf = this.ctx.createBuffer(1, len, sampleRate);
    const data = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.08 * white) / 1.08;
      data[i] = white * 0.7 + last * 0.3;
    }
    return buf;
  }

  _initContinuousLoops() {
    const ctx = this.ctx;

    // Warm coastal night synth pad (two soft detuned chords)
    this.padGain = ctx.createGain();
    this.padGain.gain.value = 0.045;
    const padFilter = ctx.createBiquadFilter();
    padFilter.type = 'lowpass';
    padFilter.frequency.value = 520;
    padFilter.connect(this.padGain);
    this.padGain.connect(this.master);

    for (const freq of [110, 164.81, 220, 261.63]) {
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      const g = ctx.createGain();
      g.gain.value = 0.22;
      osc.connect(g);
      g.connect(padFilter);
      osc.start();
    }

    // Vehicle engine hum (sawtooth + sub sine through lowpass)
    this.engineGain = ctx.createGain();
    this.engineGain.gain.value = 0;
    const engFilter = ctx.createBiquadFilter();
    engFilter.type = 'lowpass';
    engFilter.frequency.value = 260;

    this.engineOsc = ctx.createOscillator();
    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.value = 52;

    this.engineSub = ctx.createOscillator();
    this.engineSub.type = 'triangle';
    this.engineSub.frequency.value = 26;

    this.engineOsc.connect(engFilter);
    this.engineSub.connect(engFilter);
    engFilter.connect(this.engineGain);
    this.engineGain.connect(this.master);
    this.engineOsc.start();
    this.engineSub.start();

    // Police siren continuous oscillator
    this.sirenGain = ctx.createGain();
    this.sirenGain.gain.value = 0;
    const sirenFilter = ctx.createBiquadFilter();
    sirenFilter.type = 'bandpass';
    sirenFilter.frequency.value = 950;
    sirenFilter.Q.value = 2.4;

    this.sirenOsc = ctx.createOscillator();
    this.sirenOsc.type = 'sawtooth';
    this.sirenOsc.frequency.value = 660;
    this.sirenOsc.connect(sirenFilter);
    sirenFilter.connect(this.sirenGain);
    this.sirenGain.connect(this.master);
    this.sirenOsc.start();
  }

  setMuted(muted) {
    this.muted = Boolean(muted);
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(this.muted ? 0 : 0.34, this.ctx.currentTime, 0.03);
    }
  }

  toggleMute() {
    this.setMuted(!this.muted);
    if (!this.muted) this.playUiBlip(620);
    return this.muted;
  }

  updateContinuous(dt, { inVehicle, speedRatio, sirenProximity, active }) {
    if (!this.ready || !this.ctx) return;
    const now = this.ctx.currentTime;

    if (!active) {
      this.engineGain.gain.setTargetAtTime(0, now, 0.08);
      this.sirenGain.gain.setTargetAtTime(0, now, 0.08);
      this.padGain.gain.setTargetAtTime(0.035, now, 0.25);
      return;
    }

    this.padGain.gain.setTargetAtTime(0.048, now, 0.25);

    if (inVehicle) {
      const r = clamp(Math.abs(speedRatio), 0, 1.2);
      const targetFreq = 46 + r * 112;
      this.engineOsc.frequency.setTargetAtTime(targetFreq, now, 0.05);
      this.engineSub.frequency.setTargetAtTime(targetFreq * 0.5, now, 0.05);
      this.engineGain.gain.setTargetAtTime(0.09 + r * 0.09, now, 0.06);
    } else {
      this.engineGain.gain.setTargetAtTime(0, now, 0.08);
    }

    if (sirenProximity > 0.02) {
      this.sirenPhase += dt * 2.2;
      const wail = 650 + Math.sin(this.sirenPhase * Math.PI) * 290;
      this.sirenOsc.frequency.setTargetAtTime(wail, now, 0.03);
      this.sirenGain.gain.setTargetAtTime(clamp(sirenProximity, 0, 1) * 0.09, now, 0.06);
    } else {
      this.sirenGain.gain.setTargetAtTime(0, now, 0.12);
    }
  }

  playGunshot(kind = 'pistol', volumeScale = 1) {
    if (!this.ready || this.muted || !this.ctx) return;
    const now = this.ctx.currentTime;

    // Noise crack
    const noise = this.ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = kind === 'shotgun' ? 680 : kind === 'smg' ? 1450 : 1120;
    filter.Q.value = kind === 'shotgun' ? 0.6 : 1.1;

    const gain = this.ctx.createGain();
    const peak = (kind === 'shotgun' ? 0.42 : kind === 'smg' ? 0.2 : 0.28) * clamp(volumeScale, 0.1, 1);
    const dur = kind === 'shotgun' ? 0.24 : kind === 'smg' ? 0.09 : 0.13;
    gain.gain.setValueAtTime(peak, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + dur);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    noise.start(now);
    noise.stop(now + dur + 0.02);

    // Low punch thump
    const osc = this.ctx.createOscillator();
    osc.type = 'triangle';
    const startFreq = kind === 'shotgun' ? 155 : kind === 'smg' ? 210 : 180;
    osc.frequency.setValueAtTime(startFreq, now);
    osc.frequency.exponentialRampToValueAtTime(42, now + dur * 0.75);
    const og = this.ctx.createGain();
    og.gain.setValueAtTime(peak * 0.75, now);
    og.gain.exponentialRampToValueAtTime(0.001, now + dur * 0.8);
    osc.connect(og);
    og.connect(this.master);
    osc.start(now);
    osc.stop(now + dur);
  }

  playExplosion() {
    if (!this.ready || this.muted || !this.ctx) return;
    const now = this.ctx.currentTime;

    const noise = this.ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(520, now);
    filter.frequency.exponentialRampToValueAtTime(70, now + 0.75);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.55, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    noise.start(now);
    noise.stop(now + 0.85);
  }

  playCrash(strength = 0.6) {
    if (!this.ready || this.muted || !this.ctx) return;
    const now = this.ctx.currentTime;
    const vol = clamp(strength, 0.15, 1) * 0.28;

    const noise = this.ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 420;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(vol, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    noise.start(now);
    noise.stop(now + 0.2);
  }

  playDoor() {
    this.playUiBlip(240, 0.08, 'triangle');
  }

  playUiBlip(freq = 520, duration = 0.08, type = 'sine') {
    if (!this.ready || this.muted || !this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    osc.frequency.exponentialRampToValueAtTime(freq * 1.25, now + duration);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.14, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + duration);
    osc.connect(g);
    g.connect(this.master);
    osc.start(now);
    osc.stop(now + duration + 0.01);
  }

  playMissionComplete() {
    if (!this.ready || this.muted || !this.ctx) return;
    const notes = [392, 493.88, 587.33, 783.99];
    const now = this.ctx.currentTime;
    notes.forEach((freq, idx) => {
      const t = now + idx * 0.095;
      const osc = this.ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t);
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.18, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.32);
      osc.connect(g);
      g.connect(this.master);
      osc.start(t);
      osc.stop(t + 0.34);
    });
  }
}

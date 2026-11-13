import * as THREE from 'three';
import { createHeroMesh, createProjectileMesh, imbueColorOf } from './models3d.js';
import { getClass } from '../systems/classes.js';
import { skillTiming, STATUS, BERSERK } from '../systems/mechanics.js';

const ELEMENT_FX_COLORS = { fire: 0xff6a2a, ice: 0x6fd4ff, cold: 0x6fd4ff, lightning: 0xffee44, poison: 0x7dff5a, dark: 0x9333ea, holy: 0xfef08a };

function hexToCss(c) {
  return typeof c === 'number' ? `#${c.toString(16).padStart(6, '0')}` : String(c || '#ffffff');
}

/**
 * Procedural WebAudio API Sound Synthesizer for ARKENVEIL: SIGILS & JOURNEYS
 */
export class SoundFX {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.masterVolume = 0.28;
  }

  _ensureContext() {
    if (!this.enabled || typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  play(type = 'slash', options = {}) {
    const ctx = this._ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    try {
      if (type === 'slash') {
        const step = options.combo || 1;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        const baseFreq = step === 3 ? 190 : step === 2 ? 280 : 230;
        osc.frequency.setValueAtTime(baseFreq, now);
        osc.frequency.exponentialRampToValueAtTime(65, now + 0.14);
        gain.gain.setValueAtTime(this.masterVolume * 0.65, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.15);
      } else if (type === 'hit' || type === 'crit') {
        const isCrit = type === 'crit' || options.crit;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = isCrit ? 'sawtooth' : 'square';
        osc.frequency.setValueAtTime(isCrit ? 520 : 160, now);
        osc.frequency.exponentialRampToValueAtTime(48, now + (isCrit ? 0.22 : 0.12));
        gain.gain.setValueAtTime(this.masterVolume * (isCrit ? 0.9 : 0.6), now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + (isCrit ? 0.23 : 0.13));
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + (isCrit ? 0.23 : 0.13));
      } else if (type === 'skill') {
        const freqs = [260, 390, 520];
        freqs.forEach((f, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(f, now + idx * 0.03);
          osc.frequency.exponentialRampToValueAtTime(f * 1.4, now + 0.28);
          gain.gain.setValueAtTime(this.masterVolume * 0.4, now + idx * 0.03);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now + idx * 0.03);
          osc.stop(now + 0.3);
        });
      } else if (type === 'dash') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(340, now);
        osc.frequency.exponentialRampToValueAtTime(110, now + 0.16);
        gain.gain.setValueAtTime(this.masterVolume * 0.45, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.17);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.17);
      } else if (type === 'block') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(680, now);
        osc.frequency.exponentialRampToValueAtTime(220, now + 0.14);
        gain.gain.setValueAtTime(this.masterVolume * 0.6, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.15);
      } else if (type === 'levelup') {
        const notes = [261.63, 329.63, 392.0, 523.25, 659.25];
        notes.forEach((freq, i) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, now + i * 0.08);
          gain.gain.setValueAtTime(this.masterVolume * 0.65, now + i * 0.08);
          gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.08 + 0.38);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now + i * 0.08);
          osc.stop(now + i * 0.08 + 0.39);
        });
      } else if (type === 'loot' || type === 'coin' || type === 'potion') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(type === 'potion' ? 440 : 780, now);
        osc.frequency.exponentialRampToValueAtTime(type === 'potion' ? 880 : 1180, now + 0.16);
        gain.gain.setValueAtTime(this.masterVolume * 0.5, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.18);
      } else if (type === 'bow') {
        // Bowstring twang: plucked triangle with a fast pitch drop + low thump
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(620, now);
        osc.frequency.exponentialRampToValueAtTime(150, now + 0.12);
        gain.gain.setValueAtTime(this.masterVolume * 0.55, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.16);

        const thump = ctx.createOscillator();
        const tGain = ctx.createGain();
        thump.type = 'sine';
        thump.frequency.setValueAtTime(130, now);
        thump.frequency.exponentialRampToValueAtTime(60, now + 0.08);
        tGain.gain.setValueAtTime(this.masterVolume * 0.4, now);
        tGain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
        thump.connect(tGain);
        tGain.connect(ctx.destination);
        thump.start(now);
        thump.stop(now + 0.09);
      } else if (type === 'magic') {
        // Shimmering whoosh: detuned rising sines + a descending sparkle
        const big = Boolean(options.big);
        [0, 7].forEach((detune, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.detune.setValueAtTime(detune * 10, now);
          osc.frequency.setValueAtTime(big ? 380 : 480, now);
          osc.frequency.exponentialRampToValueAtTime(big ? 1100 : 1350, now + 0.18);
          gain.gain.setValueAtTime(0.001, now);
          gain.gain.exponentialRampToValueAtTime(this.masterVolume * (idx ? 0.22 : 0.32), now + 0.04);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now);
          osc.stop(now + 0.25);
        });
        const sparkle = ctx.createOscillator();
        const sGain = ctx.createGain();
        sparkle.type = 'triangle';
        sparkle.frequency.setValueAtTime(2200, now + 0.03);
        sparkle.frequency.exponentialRampToValueAtTime(900, now + 0.2);
        sGain.gain.setValueAtTime(this.masterVolume * 0.12, now + 0.03);
        sGain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
        sparkle.connect(sGain);
        sGain.connect(ctx.destination);
        sparkle.start(now + 0.03);
        sparkle.stop(now + 0.23);
      } else if (type === 'alchemy_success') {
        // Rising major arpeggio with a bright shimmer tail (bigger for +7 and up)
        const big = Boolean(options.big);
        const notes = big ? [392.0, 523.25, 659.25, 783.99, 1046.5] : [523.25, 659.25, 783.99];
        notes.forEach((freq, i) => {
          const t = now + i * 0.07;
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, t);
          gain.gain.setValueAtTime(this.masterVolume * 0.5, t);
          gain.gain.exponentialRampToValueAtTime(0.001, t + 0.32);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(t);
          osc.stop(t + 0.33);
        });
        const end = now + notes.length * 0.07;
        const shimmer = ctx.createOscillator();
        const sGain = ctx.createGain();
        shimmer.type = 'sine';
        shimmer.frequency.setValueAtTime(1800, end);
        shimmer.frequency.exponentialRampToValueAtTime(2600, end + 0.35);
        sGain.gain.setValueAtTime(this.masterVolume * 0.15, end);
        sGain.gain.exponentialRampToValueAtTime(0.001, end + 0.4);
        shimmer.connect(sGain);
        sGain.connect(ctx.destination);
        shimmer.start(end);
        shimmer.stop(end + 0.41);
      } else if (type === 'alchemy_fail') {
        // Crack: short noise burst + falling low square "thud"
        const len = Math.floor(ctx.sampleRate * 0.12);
        const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
        const noise = ctx.createBufferSource();
        noise.buffer = buffer;
        const nGain = ctx.createGain();
        nGain.gain.setValueAtTime(this.masterVolume * 0.8, now);
        nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
        noise.connect(nGain);
        nGain.connect(ctx.destination);
        noise.start(now);
        noise.stop(now + 0.13);
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(180, now + 0.02);
        osc.frequency.exponentialRampToValueAtTime(45, now + 0.35);
        gain.gain.setValueAtTime(this.masterVolume * 0.45, now + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.36);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + 0.02);
        osc.stop(now + 0.37);
      } else if (type === 'berserk') {
        // Dramatic rising power chord + electric hum
        const chord = [130.81, 196.0, 261.63, 392.0, 523.25];
        chord.forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(freq * 0.75, now + idx * 0.04);
          osc.frequency.exponentialRampToValueAtTime(freq * 1.05, now + idx * 0.04 + 0.35);
          gain.gain.setValueAtTime(0.001, now + idx * 0.04);
          gain.gain.linearRampToValueAtTime(this.masterVolume * 0.5, now + idx * 0.04 + 0.08);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.7);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now + idx * 0.04);
          osc.stop(now + 0.72);
        });
        const hum = ctx.createOscillator();
        const hGain = ctx.createGain();
        hum.type = 'sawtooth';
        hum.frequency.setValueAtTime(80, now);
        hum.frequency.linearRampToValueAtTime(160, now + 0.4);
        hGain.gain.setValueAtTime(this.masterVolume * 0.45, now);
        hGain.gain.exponentialRampToValueAtTime(0.001, now + 0.65);
        hum.connect(hGain);
        hGain.connect(ctx.destination);
        hum.start(now);
        hum.stop(now + 0.65);
      } else if (type === 'hurt') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(140, now);
        osc.frequency.exponentialRampToValueAtTime(55, now + 0.18);
        gain.gain.setValueAtTime(this.masterVolume * 0.65, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.19);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.19);
      }
    } catch {
      // Ignore WebAudio autoplay restrictions before first interaction
    }
  }
}

const FALLBACK_SKILLS = [
  {
    skillId: 'whirlwind_slash',
    name: 'Whirlwind Slash',
    kind: 'nova',
    vfx: 'whirlwind',
    element: 'physical',
    radius: 3.1,
    mult: 1.65,
    spCost: 12,
    cooldown: 3.5,
    color: 0x38bdf8
  },
  {
    skillId: 'flame_cleave',
    name: 'Flame Cleave',
    kind: 'melee_arc',
    vfx: 'fireball',
    element: 'fire',
    range: 3.2,
    angle: Math.PI * 1.1,
    mult: 2.0,
    spCost: 16,
    cooldown: 4.5,
    color: 0xff5522
  },
  {
    skillId: 'thunder_nova',
    name: 'Thunder Shockwave',
    kind: 'nova',
    vfx: 'shockwave',
    element: 'lightning',
    radius: 3.8,
    mult: 2.2,
    spCost: 20,
    cooldown: 6.0,
    color: 0xfacc15
  },
  {
    skillId: 'frost_burst',
    name: 'Frost Nova',
    kind: 'nova',
    vfx: 'ice_nova',
    element: 'ice',
    radius: 3.5,
    mult: 1.8,
    spCost: 18,
    cooldown: 5.5,
    color: 0x38bdf8
  },
  {
    skillId: 'holy_recovery',
    name: 'Holy Recovery',
    kind: 'heal',
    vfx: 'heal',
    element: 'holy',
    healPct: 0.35,
    spCost: 22,
    cooldown: 8.0,
    color: 0x4ade80
  }
];

export class PlayerController {
  constructor({ renderer, gameState, world, enemyManager, onInteract, onToast }) {
    this.renderer = renderer;
    this.gameState = gameState;
    this.world = world;
    this.enemyManager = enemyManager;
    this.onInteract = onInteract;
    this.onToast = onToast;

    this.sound = new SoundFX();

    this.position = new THREE.Vector3(0, 0, 0);
    this.velocity = new THREE.Vector3(0, 0, 0);
    this._scratchMoveInput = new THREE.Vector3(0, 0, 0);
    this._scratchDesiredMove = new THREE.Vector3(0, 0, 0);
    this._scratchZeroVec = new THREE.Vector3(0, 0, 0);
    this.rotation = 0; // Yaw in radians (0 = +Z)
    this.radius = 0.42;

    this.state = 'idle'; // 'idle' | 'walk' | 'attack' | 'skill' | 'dash' | 'block' | 'block_walk' | 'walk_slow'
    this.comboCount = 0; // Hit counter for HUD combo gauge
    this.comboDecayTimer = 0;

    // 3-stage melee combo state
    this.comboStage = 1;
    this.comboWindowTimer = 0;
    this.attackTimer = 0;
    this.attackDuration = 0.28;
    this.attackHitTriggered = false;

    // Skill / Dash / Block timers
    this.skillTimer = 0;
    this.skillCastSeq = 0;
    this.dashTimer = 0;
    this.dashCooldown = 0;
    this.dashDir = new THREE.Vector3(0, 0, 1);
    this.invulnerableTimer = 0;
    this.isBlocking = false;

    this.fallbackCooldowns = [0, 0, 0, 0, 0];

    // Class-driven basic attack state
    this.attackKind = 'melee'; // 'melee' | 'melee_heavy' | 'magic_bolt' | 'arrow'
    this.attackHitAt = 0.35; // normalized attack progress at which the hit / release happens
    this.aimPoint = null; // optional THREE.Vector3 the current ranged attack aims at
    this.skillAnim = null; // 'cast' | 'shoot' | null (null => legacy spin 'skill' pose)
    this.skillDuration = 0.36;

    // Live projectiles & delayed ground AoE ticks
    this.projectiles = [];
    this.delayedHits = [];

    // Skill phase state (prep -> release -> recover, chains). null when no skill is running.
    this.skillPhase = null;
    this.skillAnimCombo = 3;
    this.skillAnimProgress = 0;
    this._imbueSynced = undefined;

    // Input state
    this.keys = new Set();
    this.mousePos = typeof window !== 'undefined'
      ? { x: window.innerWidth * 0.5, y: window.innerHeight * 0.5 }
      : { x: 400, y: 300 };
    this.isMouseDown = false;
    this.isRightMouseDown = false;
    this.inputEnabled = true;

    // Create 3D Hero Mesh and add to scene
    const initialEquip = this._getEquipment();
    this.heroMesh = createHeroMesh(initialEquip, this._getLook());
    this.mesh = this.heroMesh;
    if (this.renderer?.scene?.add) {
      this.renderer.scene.add(this.heroMesh);
    }
    this.applyHeroLook();

    this._bindEvents();
    this._bindGameEvents();
  }

  get mesh() {
    return this.heroMesh;
  }

  set mesh(val) {
    this.heroMesh = val;
  }

  tryActivateBerserk() {
    const res = this.gameState?.activateBerserk?.();
    if (res?.ok) {
      this.sound?.play('berserk');
      this.renderer?.setBerserkAura?.(this.mesh, true);
      this.renderer?.spawnLevelUpPillar?.(this.position);
      this.onToast?.('⚡ BERSERK MODE ACTIVATED! (2x DMG, +38% Speed)', 'levelup');
    } else if (res?.reason) {
      this.onToast?.(res.reason, 'warning');
    }
    return res;
  }

  /** Subscribe to gameState events (alchemy results). Safe without an event emitter. */
  _bindGameEvents() {
    const gs = this.gameState;
    if (!gs || typeof gs.on !== 'function') return;
    this._offAlchemy = gs.on('alchemy', (ev) => this.onAlchemyResult(ev));
  }

  /** Alchemy result VFX/SFX: { success, item, plus, prevPlus, chance }. */
  onAlchemyResult(ev = {}) {
    const pos = this.position;
    const plus = Number(ev.plus ?? ev.item?.plus) || 0;
    if (ev.success) {
      const big = plus >= 7;
      const sealHex = ev.item?.seal ? ({ sun: 0xfbbf24, moon: 0xc4b5fd, star: 0x7dd3fc })[ev.item.seal] : null;
      const color = sealHex ?? (big ? 0xfacc15 : 0x7dd3fc);
      this.sound.play('alchemy_success', { big });
      if (big) {
        if (typeof this.renderer.spawnAlchemyPillar === 'function') this.renderer.spawnAlchemyPillar(pos, color);
        else this.renderer.spawnLevelUpPillar?.(pos);
      }
      this.renderer.spawnShockwave?.(pos, big ? 3.2 : 2.0, color, 0.5);
      this.renderer.spawnHitSparks?.({ x: pos.x, y: 0.4, z: pos.z }, color, big ? 26 : 14);
      this.renderer.spawnFloatingText?.(pos, `+${plus}`, { color: hexToCss(color), isCrit: big });
    } else {
      this.sound.play('alchemy_fail');
      if (typeof this.renderer.spawnSmokePuff === 'function') this.renderer.spawnSmokePuff(pos, 0x9ca3af);
      else this.renderer.spawnHitSparks?.({ x: pos.x, y: 0.4, z: pos.z }, 0x9ca3af, 12);
      this.renderer.spawnFloatingText?.(pos, plus > 0 ? `Failed (+${plus})` : 'Failed', { color: '#9ca3af' });
    }
    if (ev.item && Object.values(this._getEquipment() || {}).includes(ev.item)) this.syncEquipment();
  }

  _getHeroClass() {
    const gs = this.gameState;
    return gs?.heroClass || getClass(gs?.classId || gs?.hero?.classId);
  }

  _getAttackStyle() {
    return this._getHeroClass()?.attackStyle || 'melee';
  }

  /** Only a real shield in the offhand slot can block (an Axeman's offhand axe cannot). */
  _canBlock() {
    const sh = this.gameState?.inventory?.equipment?.shield;
    if (!sh) return false;
    const sub = String(sh.subtype || sh.subType || '').toLowerCase();
    return sub === 'shield' || (!sub && sh.type !== 'weapon');
  }

  _isShiftHeld() {
    return this.keys.has('ShiftLeft') || this.keys.has('ShiftRight') || this.keys.has('Shift');
  }

  _getLook() {
    const gs = this.gameState;
    return {
      classId: gs?.classId || gs?.hero?.classId || 'knight',
      appearance: gs?.hero?.appearance || null
    };
  }

  /**
   * Re-read class + appearance from gameState and rebuild the hero visuals.
   * Call after character creation or a save load.
   */
  applyHeroLook() {
    const look = this._getLook();
    const equipped = this._getEquipment();
    if (this.heroMesh?.userData?.setLook) {
      this.heroMesh.userData.setLook({ ...look, equipped });
    }
    this.syncEquipment();
    this.attackTimer = 0;
    this.comboStage = 1;
    return look;
  }

  _getEquipment() {
    const inv = this.gameState?.inventory;
    if (!inv) return {};
    return inv.equipment || inv.equipped || {};
  }

  syncEquipment() {
    if (this.heroMesh?.userData?.updateEquipment) {
      this.heroMesh.userData.updateEquipment(this._getEquipment());
    }
  }

  setPosition(x = 0, y = 0, z = 0) {
    if (typeof x === 'object' && x !== null) {
      this.position.set(Number(x.x) || 0, Number(x.y) || 0, Number(x.z) || 0);
    } else {
      this.position.set(Number(x) || 0, Number(y) || 0, Number(z) || 0);
    }
    this.heroMesh.position.copy(this.position);
  }

  resetPosition(x = 0, y = 0, z = 0) {
    this.setPosition(x, y, z);
    this.velocity.set(0, 0, 0);
    this.state = 'idle';
    this.attackTimer = 0;
    this.skillTimer = 0;
    this.clearProjectiles();
  }

  /** Stop any running skill / chain without feedback (zone change, reset, death). */
  cancelSkill() {
    this.skillPhase = null;
    this.skillAnim = null;
    if (this.state === 'skill') this.state = 'idle';
  }

  _bindEvents() {
    if (typeof window === 'undefined') return;
    this._onKeyDown = (e) => {
      if (!this.inputEnabled) return;
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      const code = e.code;
      this.keys.add(code);
      if (e.shiftKey) this.keys.add('Shift');

      if (code === 'Space') {
        e.preventDefault();
        this.performDash();
      } else if (code === 'Tab' || code === 'KeyR') {
        if (code === 'Tab') e.preventDefault();
        this.tryActivateBerserk();
      } else if (code === 'KeyJ') {
        this.performMeleeAttack(false);
      } else if (code === 'KeyE' || code === 'KeyF') {
        if (this.onInteract) this.onInteract();
      } else if (code === 'Digit1') {
        this.triggerSkillSlot(0);
      } else if (code === 'Digit2') {
        this.triggerSkillSlot(1);
      } else if (code === 'Digit3') {
        this.triggerSkillSlot(2);
      } else if (code === 'Digit4') {
        this.triggerSkillSlot(3);
      } else if (code === 'Digit5') {
        this.triggerSkillSlot(4);
      } else if (code === 'KeyU') {
        this.triggerSkillSlot(0);
      } else if (code === 'KeyL') {
        this.triggerSkillSlot(1);
      } else if (code === 'KeyH') {
        this.useQuickPotion(0, { allowEmergencyFallback: true });
      } else if (code === 'KeyG') {
        this.useQuickPotion(1, { allowEmergencyFallback: true });
      } else if (code === 'Digit6') {
        this.triggerQuickSlot(0);
      } else if (code === 'Digit7') {
        this.triggerQuickSlot(1);
      } else if (code === 'Digit8') {
        this.triggerQuickSlot(2);
      } else if (code === 'Digit9') {
        this.triggerQuickSlot(3);
      } else if (code === 'BracketLeft') {
        this.renderer.rotateCamera(-0.35);
      } else if (code === 'BracketRight') {
        this.renderer.rotateCamera(0.35);
      }
    };

    this._onKeyUp = (e) => {
      this.keys.delete(e.code);
      if (!e.shiftKey) {
        this.keys.delete('Shift');
        this.keys.delete('ShiftLeft');
        this.keys.delete('ShiftRight');
      }
    };

    this._onMouseDown = (e) => {
      if (!this.inputEnabled) return;
      if (e.target !== this.renderer.domElement) return;
      this.mousePos.x = e.clientX;
      this.mousePos.y = e.clientY;
      if (e.button === 0) {
        this.isMouseDown = true;
        this.performMeleeAttack(true);
      } else if (e.button === 2) {
        this.isRightMouseDown = true;
      }
    };

    this._onMouseMove = (e) => {
      if (this.isRightMouseDown && this.inputEnabled) {
        const dx = e.clientX - this.mousePos.x;
        this.renderer.rotateCamera(-dx * 0.0065);
      }
      this.mousePos.x = e.clientX;
      this.mousePos.y = e.clientY;
    };

    this._onMouseUp = (e) => {
      if (e.button === 0) this.isMouseDown = false;
      if (e.button === 2) this.isRightMouseDown = false;
    };

    this._onContextMenu = (e) => {
      if (e.target === this.renderer.domElement) {
        e.preventDefault();
      }
    };

    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    window.addEventListener('mousedown', this._onMouseDown);
    window.addEventListener('mousemove', this._onMouseMove);
    window.addEventListener('mouseup', this._onMouseUp);
    window.addEventListener('contextmenu', this._onContextMenu);
  }

  triggerQuickSlot(quickIndex = 0) {
    const q = Number(quickIndex);
    if (!Number.isInteger(q) || q < 0 || q > 3) return false;
    const barSlot = 5 + q;
    const assignedSkillId = Array.isArray(this.gameState?.skills?.hotbar) ? this.gameState.skills.hotbar[barSlot] : null;
    if (assignedSkillId) {
      return this.triggerSkillSlot(barSlot);
    }
    return this.useQuickPotion(q);
  }

  useQuickPotion(slotIndex = 0, opts = {}) {
    const inv = this.gameState?.inventory;
    let res = null;
    let used = false;
    if (inv && typeof inv.useQuickSlot === 'function') {
      res = inv.useQuickSlot(slotIndex);
      used = Boolean(res && res.ok !== false);
    }
    const hadAssigned = Boolean(inv?.quickSlots?.[slotIndex]);
    if (!used && !hadAssigned && opts.allowEmergencyFallback && this.gameState && typeof this.gameState.heal === 'function') {
      // Fallback emergency potion only for KeyH/KeyG when the slot itself is empty
      const bag = inv?.bag || [];
      const pot = bag.find((it) => it && (it.type === 'potion' || it.type === 'consumable' || String(it.name || '').toLowerCase().includes('potion')));
      if (pot && inv?.useItem) {
        res = inv.useItem(pot.uid || pot.id);
        used = Boolean(res && res.ok !== false);
      }
    }
    if (used) {
      const eff = res?.effect || res?.item?.effect || {};
      const isScrollOrBuff = Boolean(eff.buff || eff.townPortal || eff.berserkCharge || eff.mysteryBox || eff.cure || eff.resetAll || (eff.stamina && !eff.heal && !eff.mana));
      if (isScrollOrBuff) {
        this.sound.play('magic', { big: Boolean(eff.berserkCharge || eff.mysteryBox) });
        this.renderer.spawnAura(this.position, eff.berserkCharge ? 0xef4444 : 0xfacc15, 'buff');
      } else {
        this.sound.play('potion');
        const col = eff.mana && !eff.heal ? 0x38bdf8 : (eff.heal && eff.mana ? 0xfacc15 : 0x22c55e);
        const auraKind = eff.mana && !eff.heal ? 'mana' : 'heal';
        this.renderer.spawnAura(this.position, col, auraKind);
      }
    } else if (res?.msg && hadAssigned && this.onToast) {
      this.onToast(res.msg, 'info');
    }
    return used;
  }

  performDash(opts = {}) {
    const fromSkill = Boolean(opts && opts.fromSkill);
    if (!fromSkill && this.skillPhase) {
      // Dodging out of a wind-up cancels it smoothly
      if (this.skillPhase.stage !== 'prep' || !this.interruptSkill(null)) return false;
    }
    if (this.dashTimer > 0 || (!fromSkill && this.dashCooldown > 0)) return false;
    if (!fromSkill && this.gameState && typeof this.gameState.useStamina === 'function') {
      if (!this.gameState.useStamina(18)) return false;
    }

    const dashDist = Number(opts?.distance) || 0;
    const stats = this.gameState?.getStats ? this.gameState.getStats() : {};
    const moveSpeed = 6.4 * (Number(stats.moveSpeed) || 1.0);
    const dur = dashDist > 0
      ? Math.max(0.18, Math.min(0.38, dashDist / (moveSpeed * 2.55)))
      : 0.22;

    this.dashTimer = dur;
    if (!fromSkill) this.dashCooldown = 0.65;
    this.invulnerableTimer = Math.max(this.invulnerableTimer || 0, Number(opts?.invuln) || 0.32);
    this.state = 'dash';

    const moveVec = this._getMoveInputVector();
    if (moveVec.lengthSq() > 0.01) {
      this.dashDir.copy(moveVec).normalize();
      this.rotation = Math.atan2(this.dashDir.x, this.dashDir.z);
    } else {
      if (opts?.aimAtCursor) {
        const pt = this.renderer.screenToGround?.(this.mousePos.x, this.mousePos.y, this.position.y);
        if (pt) {
          const dx = pt.x - this.position.x;
          const dz = pt.z - this.position.z;
          if (dx * dx + dz * dz > 0.04) this.rotation = Math.atan2(dx, dz);
        }
      }
      this.dashDir.set(Math.sin(this.rotation), 0, Math.cos(this.rotation));
    }

    this.sound.play('dash');
    this.renderer.spawnSkillEffect('dash_trail', this.position, this.rotation, { color: 0x38bdf8 });
    return dur;
  }

  /**
   * Basic attack entry point (LMB / J). Dispatches on the hero class attackStyle.
   */
  attack(faceCursor = false) {
    return this.performMeleeAttack(faceCursor);
  }

  performMeleeAttack(faceCursor = false) {
    if (this.state === 'attack' || this.state === 'dash' || this.state === 'skill' || this.skillPhase) return false;

    const style = this._getAttackStyle();
    const imbueColor = this._imbueColor();
    const cls = this._getHeroClass();
    const ranged = style === 'magic_bolt' || style === 'arrow';
    this.aimPoint = null;

    if (faceCursor) {
      const hitPt = this.renderer.screenToGround(this.mousePos.x, this.mousePos.y, this.position.y);
      const dx = hitPt.x - this.position.x;
      const dz = hitPt.z - this.position.z;
      if (dx * dx + dz * dz > 0.04) {
        this.rotation = Math.atan2(dx, dz);
        if (ranged) this.aimPoint = new THREE.Vector3(hitPt.x, 0, hitPt.z);
      }
    } else if (ranged) {
      // Keyboard attack: soft auto-aim at the nearest enemy in front
      const target = this._findAutoAimTarget(Number(cls?.attackRange) || 10, Math.PI * 0.6);
      if (target) this.rotation = Math.atan2(target.x - this.position.x, target.z - this.position.z);
    }

    // Advance combo stage if within combo window
    if (this.comboWindowTimer > 0) {
      this.comboStage = (this.comboStage % 3) + 1;
    } else {
      this.comboStage = 1;
    }

    const stats = this.gameState?.getStats ? this.gameState.getStats() : {};
    const atkSpeed = Math.max(0.5, Math.min(3.0, Number(stats.attackSpeed || 0.85)));

    this.state = 'attack';
    this.attackKind = style;
    this.attackHitTriggered = false;
    this.skillCastSeq = (this.skillCastSeq || 0) + 1;
    this.comboWindowTimer = 0.85;

    if (style === 'melee_heavy') {
      this.attackDuration = ((this.comboStage === 3 ? 0.38 : 0.28) * 1.35 + 0.08) / atkSpeed;
      this.attackHitAt = this.comboStage === 3 ? 0.55 : 0.42;
      this.comboWindowTimer = 1.0;
      this.sound.play('slash', { combo: 3 });
    } else if (style === 'magic_bolt') {
      this.attackDuration = (this.comboStage === 3 ? 0.45 : 0.34) / atkSpeed;
      this.attackHitAt = 0.4;
      this.comboWindowTimer = 0.9;
    } else if (style === 'arrow') {
      this.attackDuration = (this.comboStage === 3 ? 0.52 : 0.44) / atkSpeed;
      this.attackHitAt = 0.65;
      this.comboWindowTimer = 1.0;
    } else {
      this.attackDuration = (this.comboStage === 3 ? 0.38 : 0.28) / atkSpeed;
      this.attackHitAt = 0.35;
      this.comboWindowTimer = 0.85;
      this.sound?.play?.('slash', { combo: this.comboStage });
      const slashColor = imbueColor ?? (this.comboStage === 3 ? 0xfacc15 : this.comboStage === 2 ? 0x60a5fa : 0x38bdf8);
      const radius = this.comboStage === 3 ? 2.65 : 2.15;
      const arc = this.comboStage === 3 ? Math.PI * 1.15 : Math.PI * 0.9;
      this.renderer?.spawnSlashArc?.(this.position, this.rotation, radius, slashColor, arc, this.comboStage);
      this.renderer?.spawnWeaponTrail?.(this.position, this.rotation, {
        reach: radius,
        imbueElement: this.gameState?.hero?.activeImbue?.element || this.gameState?.getActiveImbue?.()?.element
      });
    }
    this.attackTimer = this.attackDuration;

    return true;
  }

  /** Called once per basic attack when the swing connects / the shot is released. */
  _onAttackRelease() {
    if (this.attackKind === 'magic_bolt' || this.attackKind === 'arrow') {
      this._fireBasicProjectile();
    } else {
      this._executeMeleeHitbox();
    }
  }

  _basicRollFn(mult, magic = false) {
    const gs = this.gameState;
    return (def) => gs?.rollBasicAttack?.(def, { mult })
      ?? gs?.rollAttack?.(def, { mult, magic })
      ?? { damage: Math.max(1, Math.round(12 * mult)), crit: false, miss: false };
  }

  _executeMeleeHitbox() {
    const heavy = this.attackKind === 'melee_heavy';
    const cls = this._getHeroClass();
    let mult;
    let range;
    let arc;
    let knockback;
    if (heavy) {
      const baseRange = Number(cls?.attackRange) || 2.9;
      mult = this.comboStage === 3 ? 2.0 : this.comboStage === 2 ? 1.5 : 1.25;
      range = this.comboStage === 3 ? baseRange + 0.35 : baseRange;
      arc = this.comboStage === 3 ? Math.PI * 1.2 : Math.PI * 1.35;
      knockback = this.comboStage === 3 ? 2.4 : 1.1;

      // Heavy swings show their arc on impact (after the wind-up)
      const isDualAxe = cls?.id === 'axeman';
      const color = this._imbueColor() ?? (this.comboStage === 3 ? 0xf97316 : 0xef4444);
      this.renderer.spawnSlashArc(this.position, this.rotation, range, color, arc, this.comboStage);
      if (isDualAxe) {
        this.renderer.spawnSlashArc(this.position, this.rotation + 0.35, range * 0.95, color, arc * 0.9, this.comboStage + 1);
      }
      this.renderer?.spawnWeaponTrail?.(this.position, this.rotation, {
        reach: range,
        imbueElement: this.gameState?.hero?.activeImbue?.element || this.gameState?.getActiveImbue?.()?.element
      });
      if (this.comboStage === 3) {
        const fx = this.position.x + Math.sin(this.rotation) * 1.4;
        const fz = this.position.z + Math.cos(this.rotation) * 1.4;
        this.renderer.spawnShockwave({ x: fx, y: 0, z: fz }, 2.2, 0xf97316, 0.4);
        this.renderer.spawnHitSparks({ x: fx, y: 0, z: fz }, 0xfbbf24, 12);
      }
    } else {
      mult = this.comboStage === 3 ? 1.55 : this.comboStage === 2 ? 1.18 : 1.0;
      range = this.comboStage === 3 ? 2.75 : 2.25;
      arc = this.comboStage === 3 ? Math.PI * 1.2 : Math.PI * 0.98;
      knockback = this.comboStage === 3 ? 1.4 : 0.55;
    }

    // 1. Check breakable barrels/crates/urns
    if (this.world && typeof this.world.getBreakablesInArc === 'function') {
      const breakables = this.world.getBreakablesInArc(this.position.x, this.position.z, this.rotation, range, arc) || [];
      for (const b of breakables) {
        this.world.damageBreakable(b, heavy ? 40 : 25);
        this.renderer.spawnHitSparks(b.position || { x: b.x, y: 0.4, z: b.z }, 0xfbbf24, 10);
      }
    }

    // 2. Check enemies in arc
    let hitEnemies = [];
    if (this.enemyManager) {
      if (typeof this.enemyManager.getEnemiesInArc === 'function') {
        hitEnemies = this.enemyManager.getEnemiesInArc(this.position.x, this.position.z, this.rotation, range, arc) || [];
      } else if (typeof this.enemyManager.getEnemiesInRange === 'function') {
        hitEnemies = this.enemyManager.getEnemiesInRange(this.position.x, this.position.z, range) || [];
      }
    }

    let anyCrit = false;
    const rollDamageFn = this._basicRollFn(mult, false);
    for (const enemy of hitEnemies) {
      this._applyPlayerAttackToEnemy(enemy, { mult, element: 'physical', knockback, rollDamageFn });
      if (enemy._lastHitCrit) anyCrit = true;
    }

    if (hitEnemies.length > 0) {
      this.comboCount += hitEnemies.length;
      this.comboDecayTimer = 4.5;
      if (heavy) {
        this.renderer.shake(anyCrit || this.comboStage === 3 ? 0.45 : 0.26, 0.2);
      } else if (this.comboStage === 3 || anyCrit) {
        this.renderer.shake(anyCrit ? 0.35 : 0.22, 0.18);
      }
    } else if (heavy && this.comboStage === 3) {
      this.renderer.shake(0.2, 0.15);
    }
  }

  /** Nearest living enemy within `range` and inside a forward cone of `cone` total radians. */
  _findAutoAimTarget(range = 10, cone = Math.PI * 0.6, origin = null, yaw = null) {
    const em = this.enemyManager;
    if (!em || typeof em.getEnemiesInRange !== 'function') return null;
    const ox = origin ? origin.x : this.position.x;
    const oz = origin ? origin.z : this.position.z;
    const ry = yaw ?? this.rotation;
    const fx = Math.sin(ry);
    const fz = Math.cos(ry);
    const halfCos = Math.cos(cone * 0.5);
    let best = null;
    let bestD = Infinity;
    for (const e of em.getEnemiesInRange(ox, oz, range) || []) {
      if (!e || e.dead) continue;
      const dx = e.x - ox;
      const dz = e.z - oz;
      const d = Math.hypot(dx, dz);
      if (d < 0.001) return e;
      if ((dx / d) * fx + (dz / d) * fz < halfCos) continue;
      if (d < bestD) {
        bestD = d;
        best = e;
      }
    }
    return best;
  }

  _projectileOrigin(yaw) {
    return new THREE.Vector3(
      this.position.x + Math.sin(yaw) * 0.55,
      (this.position.y || 0) + 1.0,
      this.position.z + Math.cos(yaw) * 0.55
    );
  }

  _aimYaw() {
    if (this.aimPoint) {
      const dx = this.aimPoint.x - this.position.x;
      const dz = this.aimPoint.z - this.position.z;
      if (dx * dx + dz * dz > 0.04) return Math.atan2(dx, dz);
    }
    return this.rotation;
  }

  _fireBasicProjectile() {
    const cls = this._getHeroClass();
    const range = Number(cls?.attackRange) || (this.attackKind === 'arrow' ? 13 : 11);
    const yaw = this._aimYaw();
    const origin = this._projectileOrigin(yaw);
    const stage = this.comboStage;

    if (this.attackKind === 'magic_bolt') {
      const weapon = this._getEquipment()?.weapon;
      const element = weapon?.element || 'physical';
      const color = this._imbueColor() ?? ({ fire: 0xff7a3d, ice: 0x7dd3fc, lightning: 0xfde047, poison: 0x86efac }[element] || 0xc084fc);
      const mult = stage === 3 ? 0.9 : stage === 2 ? 1.15 : 1.0;
      const offsets = stage === 3 ? [-0.25, 0, 0.25] : [0];
      for (const off of offsets) {
        this.spawnProjectile({
          kind: 'bolt',
          pos: origin,
          yaw: yaw + off,
          speed: 16,
          range,
          radius: 0.45,
          pierce: false,
          mult,
          element,
          color,
          homing: true,
          knockback: 0.5,
          rollDamageFn: this._basicRollFn(mult, true),
          scale: stage === 3 ? 0.9 : 1
        });
      }
      this.sound.play('magic', { big: stage === 3 });
      this.renderer.spawnHitSparks({ x: origin.x, y: 0.3, z: origin.z }, color, 5);
    } else {
      const pierce = stage === 3;
      const mult = stage === 3 ? 1.4 : stage === 2 ? 1.1 : 1.0;
      const color = this._imbueColor() ?? (pierce ? 0xfacc15 : 0xe5e7eb);
      this.spawnProjectile({
        kind: 'arrow',
        pos: origin,
        yaw,
        speed: 28,
        range,
        radius: 0.38,
        pierce,
        mult,
        element: 'physical',
        color,
        homing: false,
        knockback: pierce ? 1.0 : 0.45,
        rollDamageFn: this._basicRollFn(mult, false)
      });
      this.sound.play('bow');
    }
  }

  // ------------------------------------------------------------------ projectiles
  /**
   * Spawn a player projectile.
   * opts: { kind:'arrow'|'bolt'|'orb', pos:{x,y,z}, yaw?|dir?:{x,z}, speed, range, radius, pierce,
   *         mult, element, color, rollDamageFn, knockback, homing, aoeRadius, scale }
   */
  spawnProjectile(opts = {}) {
    const kind = opts.kind || 'bolt';
    const color = opts.color ?? 0xa855f7;
    const dir = new THREE.Vector3();
    if (opts.dir) {
      dir.set(Number(opts.dir.x) || 0, 0, Number(opts.dir.z) || 0);
    } else {
      const yaw = Number.isFinite(opts.yaw) ? opts.yaw : this.rotation;
      dir.set(Math.sin(yaw), 0, Math.cos(yaw));
    }
    if (dir.lengthSq() < 1e-6) dir.set(Math.sin(this.rotation), 0, Math.cos(this.rotation));
    dir.normalize();

    const pos = new THREE.Vector3(
      Number(opts.pos?.x ?? this.position.x),
      Number(opts.pos?.y ?? 1.0),
      Number(opts.pos?.z ?? this.position.z)
    );

    const mesh = createProjectileMesh(kind, color, opts.scale || 1);
    mesh.position.copy(pos);
    mesh.rotation.y = Math.atan2(dir.x, dir.z);
    this.renderer.scene.add(mesh);

    const proj = {
      mesh,
      pos,
      dir,
      speed: Number(opts.speed) || 16,
      traveled: 0,
      range: Number(opts.range) || 10,
      radius: Number(opts.radius) || 0.4,
      pierce: Boolean(opts.pierce),
      hit: new Set(),
      mult: Number(opts.mult) || 1,
      element: opts.element || 'physical',
      rollDamageFn: typeof opts.rollDamageFn === 'function' ? opts.rollDamageFn : null,
      color,
      kind,
      knockback: opts.knockback ?? 0.6,
      homing: Boolean(opts.homing),
      aoeRadius: Number(opts.aoeRadius) || 0,
      age: 0
    };
    this.projectiles.push(proj);
    return proj;
  }

  _removeProjectile(index) {
    const p = this.projectiles[index];
    if (!p) return;
    this.projectiles.splice(index, 1);
    if (p.mesh) {
      p.mesh.parent?.remove(p.mesh);
      p.mesh.userData?.dispose?.();
    }
  }

  /** Remove all live projectiles and pending delayed skill actions (zone change / reset). */
  clearProjectiles() {
    if (Array.isArray(this.projectiles)) {
      for (let i = this.projectiles.length - 1; i >= 0; i--) this._removeProjectile(i);
    }
    this.projectiles = [];
    this.delayedHits = [];
    this.cancelSkill();
  }

  _projectileImpact(p, enemyTarget = null) {
    const at = { x: p.pos.x, y: p.pos.y, z: p.pos.z };
    if (typeof this.renderer.spawnProjectileImpact === 'function') {
      this.renderer.spawnProjectileImpact(at, p.color, p.aoeRadius ? 1.6 : 1);
    } else {
      this.renderer.spawnHitSparks({ x: at.x, y: 0.2, z: at.z }, p.color, 8);
    }
    if (p.aoeRadius > 0) {
      this.renderer.spawnShockwave?.({ x: at.x, y: 0, z: at.z }, p.aoeRadius, p.color, 0.4);
      const targets = this.enemyManager?.getEnemiesInRange?.(at.x, at.z, p.aoeRadius) || [];
      let n = 0;
      for (const e of targets) {
        if (!e || e.dead || e === enemyTarget || p.hit.has(e)) continue;
        p.hit.add(e);
        this._applyPlayerAttackToEnemy(e, { mult: p.mult, element: p.element, knockback: p.knockback, rollDamageFn: p.rollDamageFn });
        n++;
      }
      if (n > 0) {
        this.comboCount += n;
        this.comboDecayTimer = 4.5;
      }
      this.renderer.shake(0.18, 0.14);
    } else if (enemyTarget) {
      this.renderer.shake?.(0.12, 0.1);
    }
  }

  _updateProjectiles(dt) {
    if (!this.projectiles.length) return;
    const em = this.enemyManager;
    const world = this.world;

    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.age += dt;

      // Gentle homing toward the nearest enemy within a 30 degree cone
      if (p.homing) {
        const yaw = Math.atan2(p.dir.x, p.dir.z);
        const target = this._findAutoAimTarget(Math.min(7, p.range - p.traveled + 1), Math.PI / 6, p.pos, yaw);
        if (target) {
          const desired = Math.atan2(target.x - p.pos.x, target.z - p.pos.z);
          let diff = desired - yaw;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;
          const maxTurn = 3.2 * dt;
          const ny = yaw + Math.max(-maxTurn, Math.min(maxTurn, diff));
          p.dir.set(Math.sin(ny), 0, Math.cos(ny));
        }
      }

      // Sub-step so fast projectiles cannot tunnel through targets
      const totalStep = p.speed * dt;
      const steps = Math.max(1, Math.ceil(totalStep / 0.35));
      const stepLen = totalStep / steps;
      let remove = false;

      for (let s = 0; s < steps && !remove; s++) {
        p.pos.addScaledVector(p.dir, stepLen);
        p.traveled += stepLen;

        // Walls
        if (world && typeof world.isWalkable === 'function' && world.isWalkable(p.pos.x, p.pos.z, 0.1) === false) {
          this._projectileImpact(p);
          remove = true;
          break;
        }

        // Enemies
        const candidates = em?.getEnemiesInRange?.(p.pos.x, p.pos.z, p.radius) || [];
        for (const enemy of candidates) {
          if (!enemy || enemy.dead || p.hit.has(enemy)) continue;
          p.hit.add(enemy);
          this._applyPlayerAttackToEnemy(enemy, {
            mult: p.mult,
            element: p.element,
            knockback: p.knockback,
            rollDamageFn: p.rollDamageFn
          });
          this.comboCount += 1;
          this.comboDecayTimer = 4.5;
          if (!p.pierce) {
            this._projectileImpact(p, enemy);
            remove = true;
            break;
          } else {
            this.renderer.spawnHitSparks({ x: p.pos.x, y: 0.2, z: p.pos.z }, p.color, 5);
          }
        }
        if (remove) break;

        // Breakables
        if (world && typeof world.getBreakablesInArc === 'function') {
          const brks = world.getBreakablesInArc(p.pos.x, p.pos.z, 0, p.radius, Math.PI * 2) || [];
          for (const b of brks) {
            if (!b || b.destroyed || p.hit.has(b)) continue;
            p.hit.add(b);
            world.damageBreakable?.(b, 25);
            this.renderer.spawnHitSparks(b.position || { x: b.x, y: 0.4, z: b.z }, 0xfbbf24, 8);
            if (!p.pierce) {
              this._projectileImpact(p);
              remove = true;
              break;
            }
          }
        }

        if (p.traveled >= p.range) {
          if (p.aoeRadius > 0) this._projectileImpact(p);
          else this.renderer.spawnHitSparks({ x: p.pos.x, y: 0.2, z: p.pos.z }, p.color, 3);
          remove = true;
        }
      }

      if (remove) {
        this._removeProjectile(i);
        continue;
      }

      // Visual sync: position, facing, pulse
      p.mesh.position.copy(p.pos);
      p.mesh.rotation.y = Math.atan2(p.dir.x, p.dir.z);
      const glow = p.mesh.userData.glow;
      if (glow) glow.scale.setScalar(1 + Math.sin(p.age * 30) * 0.18);
      const core = p.mesh.userData.core;
      if (core) core.rotation.x += dt * 12;
    }
  }

  _updateDelayedHits(dt) {
    if (!this.delayedHits.length) return;
    for (let i = this.delayedHits.length - 1; i >= 0; i--) {
      const d = this.delayedHits[i];
      d.t -= dt;
      if (d.t <= 0) {
        this.delayedHits.splice(i, 1);
        try {
          d.fn();
        } catch (err) {
          console.warn('[PlayerController] delayed skill action failed', err);
        }
      }
    }
  }

  _applyPlayerAttackToEnemy(enemy, { mult = 1.0, element = 'physical', knockback = 0.6, rollDamageFn = null, stun = 0 }) {
    if (!enemy || enemy.dead) return;
    const defStats = { def: enemy.def || enemy.defense || 2, level: enemy.level || 1, dodge: 0 };

    let roll;
    if (typeof rollDamageFn === 'function') {
      roll = rollDamageFn(defStats);
    } else if (this.gameState && typeof this.gameState.rollAttack === 'function') {
      roll = this.gameState.rollAttack(defStats, { mult, element });
    } else {
      const stats = this.gameState?.getStats ? this.gameState.getStats() : { atkMin: 12, atkMax: 18, critRate: 0.12, critDmg: 1.75 };
      const base = (stats.atkMin || 10) + Math.random() * ((stats.atkMax || 16) - (stats.atkMin || 10));
      const crit = Math.random() < (stats.critRate || 0.1);
      const damage = Math.max(1, Math.round((base * mult - (defStats.def * 0.4)) * (crit ? (stats.critDmg || 1.75) : 1)));
      roll = { damage, crit, miss: false };
    }

    const ePos = enemy.position || enemy.mesh?.position || { x: enemy.x || 0, y: 0, z: enemy.z || 0 };
    if (roll.miss) {
      this.renderer.spawnFloatingText(ePos, 'MISS', { color: '#94a3b8' });
      return;
    }

    enemy._lastHitCrit = Boolean(roll.crit);
    this.sound.play(roll.crit ? 'crit' : 'hit', { crit: roll.crit });

    const imbue = roll.imbue && Number(roll.imbue.extra) > 0 ? roll.imbue : null;
    const imbueColor = imbue ? imbueColorOf(imbue) ?? ELEMENT_FX_COLORS[imbue.element] ?? 0xffffff : null;
    const sparkColor = roll.crit ? 0xfacc15 : imbueColor ?? 0xf8fafc;
    this.renderer.spawnHitSparks(ePos, sparkColor, roll.crit ? 18 : 10);

    if (enemy.mesh?.userData?.triggerHitFlash) {
      enemy.mesh.userData.triggerHitFlash(0.15);
    }

    const kbDir = {
      x: (ePos.x || 0) - this.position.x,
      z: (ePos.z || 0) - this.position.z
    };

    const em = this.enemyManager;
    // Shock bonus is applied inside applyDamageToEnemy; preview it for the numbers when unavailable
    let dealt = roll.damage;
    let res = null;
    if (em) {
      if (typeof em.applyDamageToEnemy === 'function') {
        res = em.applyDamageToEnemy(enemy, roll.damage, {
          isCrit: roll.crit,
          element,
          knockback,
          knockbackDir: kbDir
        });
      } else if (typeof em.damageEnemy === 'function') {
        res = em.damageEnemy(enemy, roll.damage, roll.crit, kbDir, element);
      }
    }
    if (res && Number(res.damage) > 0) dealt = res.damage;

    // Damage numbers: main hit + a smaller element-colored number for the imbue extra
    if (imbue) {
      const total = Math.max(1, Number(roll.damage) || 1);
      const extraShown = Math.max(1, Math.round(dealt * (imbue.extra / total)));
      this.renderer.spawnFloatingText(ePos, Math.max(1, dealt - extraShown), { isCrit: roll.crit });
      this.renderer.spawnFloatingText({ x: ePos.x, y: (ePos.y || 0) + 0.35, z: ePos.z }, `+${extraShown}`, { color: hexToCss(imbueColor), small: true });
    } else {
      this.renderer.spawnFloatingText(ePos, dealt, { isCrit: roll.crit });
    }

    // Status effects (imbue proc / elemental skill) and skill stun, only on survivors
    if (em && !enemy.dead && !res?.killed) {
      if (roll.status && roll.status.id && typeof em.applyStatus === 'function') {
        em.applyStatus(enemy, roll.status);
      }
      const stunDur = Number(stun) || 0;
      if (stunDur > 0 && typeof em.applyStatus === 'function' && !(roll.status && roll.status.id === 'stun')) {
        em.applyStatus(enemy, { id: 'stun', duration: stunDur });
      }
    }
  }

  /**
   * Execute an active skill from slot 0..4 (or fallback signature ASJ skill)
   */
  triggerSkillSlot(slotIndex = 0) {
    if (this.state === 'dash') return false;

    // Fluid basic attack cancel: cancel recovery frames directly into skill
    if (this.state === 'attack') {
      this.state = 'idle';
      this.attackTimer = 0;
    }

    const skillsSys = this.gameState?.skills;
    let descriptor = null;

    // While a skill / chain is running only instant skills (imbue, buffs) may fire
    if (this.skillPhase && !this._slotIsInstant(slotIndex)) return false;

    if (skillsSys) {
      const assignedSkillId = Array.isArray(skillsSys.hotbar) ? skillsSys.hotbar[slotIndex] : null;
      if (assignedSkillId) {
        // The slot has an assigned skill in the hotbar!
        const check = typeof skillsSys.canCast === 'function' ? skillsSys.canCast(slotIndex) : null;
        if (check && !check.ok) {
          // Skill is on cooldown, out of SP, or uncastable.
          // Never trigger fallback skill when an assigned skill cannot be cast!
          return false;
        }
        if (typeof skillsSys.castSlot === 'function') {
          descriptor = skillsSys.castSlot(slotIndex);
        } else if (typeof skillsSys.cast === 'function') {
          descriptor = skillsSys.cast(assignedSkillId);
        }
        if (!descriptor) return false;
      }
    }

    // Only if the hotbar slot is completely empty (no assigned skill), provide fallback
    if (!descriptor) {
      const fb = FALLBACK_SKILLS[slotIndex];
      if (!fb) return false;
      if (this.fallbackCooldowns[slotIndex] > 0) return false;
      const hero = this.gameState?.hero;
      if (hero && typeof hero.mp === 'number' && hero.mp < fb.spCost) {
        if (this.onToast) this.onToast('Not enough SP (Mana)!', 'info');
        return false;
      }
      if (hero && typeof hero.mp === 'number') {
        hero.mp = Math.max(0, hero.mp - fb.spCost);
      }
      this.fallbackCooldowns[slotIndex] = fb.cooldown;
      descriptor = { ...fb };
    }

    return this.executeSkillDescriptor(descriptor);
  }

  _slotIsInstant(slotIndex) {
    const sk = this.gameState?.skills;
    const id = sk?.hotbar?.[slotIndex];
    if (!id) return false;
    const view = sk.getSkillView?.(id) || sk.get?.(id);
    if (view && typeof view.instant === 'boolean') return view.instant;
    return view?.kind === 'imbue' || view?.kind === 'buff';
  }

  // ------------------------------------------------------------------ skill timing (prep -> release -> recover)
  /** True while a skill wind-up, chain or follow-through owns the hero. */
  isSkillBusy() {
    return Boolean(this.skillPhase);
  }

  /** Animation plan for a skill (or chain segment): wind-up pose, release point and follow-through pose. */
  _skillAnimPlan(desc, index = 0, isChain = false) {
    const kind = String(desc?.kind || desc?.vfx || 'nova').toLowerCase();
    const style = this._getAttackStyle();
    const cls = this._getHeroClass();
    const classId = String(cls?.id || this.gameState?.classId || this.gameState?.hero?.classId || 'knight').toLowerCase();
    const range = Number(desc?.range) || 3.2;
    const ranged = kind === 'projectile' || (kind === 'aoe' && range > 5);
    const combo = isChain ? (index % 3) + 1 : kind === 'aoe' ? 3 : 1;

    // Silkroad Martial Arts Class-Specific Animation Plans
    if (classId === 'wizard' || style === 'magic_bolt') {
      const wizCombo = isChain ? ((index % 2) + 1) : (kind === 'aoe' ? 2 : (desc?.element === 'fire' || kind === 'melee_arc') ? 3 : 1);
      return { prep: 'wizard_prep', release: 'wizard_release', recover: 'wizard_recover', combo: wizCombo, rel: 0.4 };
    }
    if (classId === 'archer' || style === 'arrow') {
      const archerCombo = isChain ? 2 : (kind === 'aoe' ? 4 : desc?.pierce ? 3 : 1);
      return { prep: 'archer_prep', release: 'archer_release', recover: 'archer_recover', combo: archerCombo, rel: 0.72 };
    }
    if (classId === 'axeman' || style === 'melee_heavy') {
      const axeCombo = isChain ? (index % 3) + 1 : (kind === 'nova' || kind === 'aoe') ? 3 : (kind === 'buff') ? 4 : (kind === 'dash') ? 2 : 1;
      return { prep: 'axeman_prep', release: 'axeman_release', recover: 'axeman_recover', combo: axeCombo, rel: axeCombo === 3 ? 0.45 : 0.35 };
    }
    // Knight (Bicheon)
    const knightCombo = isChain ? (index % 3) + 1 : (kind === 'projectile' || desc?.element === 'lightning') ? 3 : (kind === 'nova' || kind === 'aoe') ? 2 : 1;
    return { prep: 'knight_prep', release: 'knight_release', recover: 'knight_recover', combo: knightCombo, rel: knightCombo === 3 ? 0.45 : 0.35 };
  }

  _setSkillAnim(plan, stage, g) {
    const k = Math.max(0, Math.min(1, g));
    if (stage === 'recover') {
      this.skillAnim = plan.recover || 'idle';
      this.skillAnimCombo = plan.combo;
      this.skillAnimProgress = k;
    } else if (stage === 'release') {
      this.skillAnim = plan.release || (plan.prep ? plan.prep.replace('_prep', '_release') : 'attack');
      this.skillAnimCombo = plan.combo;
      this.skillAnimProgress = k;
    } else {
      this.skillAnim = plan.prep;
      this.skillAnimCombo = plan.combo;
      this.skillAnimProgress = k;
    }
  }

  /** Face the cursor for ranged skills. Returns the ground point or null. */
  _aimSkillAtCursor(desc) {
    const kind = String(desc?.kind || '').toLowerCase();
    const range = Number(desc?.range) || 3.2;
    if (!(kind === 'projectile' || (kind === 'aoe' && range > 5))) return null;
    const pt = this.renderer.screenToGround?.(this.mousePos.x, this.mousePos.y, this.position.y);
    if (!pt) return null;
    const dx = pt.x - this.position.x;
    const dz = pt.z - this.position.z;
    if (dx * dx + dz * dz <= 0.04) return null;
    this.rotation = Math.atan2(dx, dz);
    return pt;
  }

  _imbueColor() {
    const im = this.gameState?.getActiveImbue?.();
    return im ? imbueColorOf(im) : null;
  }

  /**
   * Start a skill from a descriptor (systems castSlot() or fallback).
   * Honors desc.prep / desc.recover / desc.instant (see mechanics.js skillTiming) and kind:'chain'.
   */
  executeSkillDescriptor(desc) {
    if (!desc) return false;
    const kind = String(desc.kind || desc.vfx || 'nova').toLowerCase();
    const timing = skillTiming({ ...desc, kind });
    const prep = Math.max(0, Number(timing.prep) || 0);
    const recover = Math.max(0, Number(timing.recover) || 0);

    // Instant skills (imbue / buffs): effect now, never interrupt the current action
    if (timing.instant || kind === 'imbue') {
      this._releaseInstantSkill(desc, kind);
      return true;
    }

    const isChain = kind === 'chain' && Array.isArray(desc.chain) && desc.chain.length > 0;
    const first = isChain ? this._chainSegmentDesc(desc, 0) : desc;

    // A real skill cancels a basic attack in progress
    this.attackTimer = 0;
    this.attackHitTriggered = true;
    this.skillTimer = 0;
    this.skillCastSeq = (this.skillCastSeq || 0) + 1;
    this.state = 'skill';

    const plan = this._skillAnimPlan(first, 0, isChain);
    this.skillPhase = {
      desc,
      stage: 'prep',
      timer: prep,
      total: Math.max(0.0001, prep),
      recover,
      plan,
      chain: isChain ? { segs: desc.chain, index: 0 } : null
    };
    this._aimSkillAtCursor(first);
    this._setSkillAnim(plan, 'prep', 0);

    if (prep <= 0) this._advanceSkillPhase();
    return true;
  }

  /** Merge a chain segment with its head descriptor into a normal skill descriptor. */
  _chainSegmentDesc(head, index) {
    const seg = head?.chain?.[index] || {};
    return {
      ...seg,
      skillId: head.skillId || head.id,
      id: head.id,
      name: head.name,
      ok: head.ok,
      kind: String(seg.kind || 'melee_arc').toLowerCase(),
      element: seg.element || head.element || 'physical',
      color: seg.color ?? head.color,
      magic: seg.magic ?? head.magic,
      mult: seg.mult ?? head.mult,
      range: seg.range ?? head.range,
      radius: seg.radius ?? seg.range ?? head.radius,
      angle: seg.angle ?? head.angle,
      vfx: seg.vfx || head.vfx,
      stun: seg.stun ?? 0,
      rollDamage: typeof seg.rollDamage === 'function' ? seg.rollDamage : head.rollDamage,
      _chainIndex: index
    };
  }

  /** Called when the current prep / chain gap ends: release, then queue the next segment or recover. */
  _advanceSkillPhase() {
    const ph = this.skillPhase;
    if (!ph) return;
    const chain = ph.chain;
    const relDesc = chain ? this._chainSegmentDesc(ph.desc, chain.index) : ph.desc;
    this._aimSkillAtCursor(relDesc);
    this._setSkillAnim(ph.plan, 'release', 0.5);
    this._releaseSkill(relDesc, { chainIndex: chain ? chain.index : -1 });
    if (this.skillPhase !== ph) return; // cleared during release (zone change, death...)

    if (chain && chain.index + 1 < chain.segs.length) {
      const next = chain.index + 1;
      const delay = Math.max(0.05, Number(chain.segs[next]?.delay) || 0.2);
      chain.index = next;
      ph.stage = 'gap';
      ph.timer = delay;
      ph.total = delay;
      this.skillCastSeq = (this.skillCastSeq || 0) + 1;
      ph.plan = this._skillAnimPlan(this._chainSegmentDesc(ph.desc, next), next, true);
      this._setSkillAnim(ph.plan, 'prep', 0);
      return;
    }
    this._startSkillRecover();
  }

  _startSkillRecover() {
    const ph = this.skillPhase;
    if (!ph) return;
    ph.stage = 'recover';
    ph.timer = ph.recover;
    ph.total = Math.max(0.0001, ph.recover);
    this._setSkillAnim(ph.plan, 'recover', 0);
    if (ph.recover <= 0) this._endSkillPhase();
  }

  _endSkillPhase() {
    this.skillPhase = null;
    this.skillAnim = null;
    if (this.state === 'skill') this.state = 'idle';
  }

  /** Cancel a skill wind-up (resources stay spent). */
  interruptSkill(reason = 'Interrupted') {
    const ph = this.skillPhase;
    if (!ph || (ph.stage !== 'prep' && ph.stage !== 'gap')) return false;
    this._endSkillPhase();
    if (reason) this.renderer.spawnFloatingText?.(this.position, reason, { color: '#94a3b8', small: true });
    return true;
  }

  /** Per-frame skill phase tick. Returns true while the skill owns the hero. */
  _updateSkillPhase(dt, moveInput) {
    const ph = this.skillPhase;
    if (!ph) return false;
    ph.timer -= dt;
    const g = 1 - Math.max(0, ph.timer) / ph.total;
    if (ph.stage === 'prep' || ph.stage === 'gap') {
      this._setSkillAnim(ph.plan, 'prep', g);
      if (ph.timer <= 0) {
        if (ph.stage === 'gap' && !this._chainHasTarget(ph)) {
          this._startSkillRecover();
        } else {
          this._advanceSkillPhase();
        }
      }
    } else {
      this._setSkillAnim(ph.plan, 'recover', g);
      if (ph.timer <= 0) this._endSkillPhase();
    }
    return Boolean(this.skillPhase);
  }

  /** Chain continues only if an enemy is within the next segment's range. */
  _chainHasTarget(ph) {
    const seg = ph?.chain?.segs?.[ph.chain.index];
    if (!seg) return false;
    const em = this.enemyManager;
    if (!em || typeof em.getEnemiesInRange !== 'function') return true;
    const range = Number(seg.range) || Number(ph.desc.range) || 3;
    return (em.getEnemiesInRange(this.position.x, this.position.z, range) || []).some((e) => e && !e.dead);
  }

  /** Instant skills: buffs / imbue. Systems side already applied the effect; we only show VFX. */
  _releaseInstantSkill(desc, kind) {
    const imbue = desc.imbue || (kind === 'imbue' ? { element: desc.element, status: desc.status } : null);
    if (kind === 'imbue' && imbue) {
      const color = imbueColorOf(imbue) ?? desc.color ?? 0xffffff;
      this.heroMesh?.userData?.setImbue?.(this.gameState?.getActiveImbue?.() || imbue);
      this.renderer.spawnAura?.(this.position, color, 'imbue');
      this.renderer.spawnFloatingText?.(this.position, desc.name || 'Imbued', { color, small: true });
      this.sound.play('magic', { big: false });
      return;
    }
    this.sound.play('skill');
    this.renderer.spawnSkillEffect(desc.vfx && String(desc.vfx).includes('heal') ? desc.vfx : kind === 'heal' ? 'heal' : 'buff', this.position, this.rotation, {
      color: desc.color || 0xfacc15,
      radius: desc.radius || 3.4
    });
    if (kind === 'heal') this._showHeal(desc);
  }

  _showHeal(desc) {
    if (desc.ok && desc.skillId && typeof desc.healed === 'number') {
      if (desc.healed > 0) this.renderer.spawnFloatingText(this.position, `+${desc.healed} HP`, { type: 'heal' });
      return;
    }
    const stats = this.gameState?.getStats ? this.gameState.getStats() : { maxHp: 100 };
    const healAmt = Math.round((stats.maxHp || 100) * (desc.healPct || 0.3));
    if (this.gameState && typeof this.gameState.heal === 'function') this.gameState.heal(healAmt, 0);
    this.renderer.spawnFloatingText(this.position, `+${healAmt} HP`, { type: 'heal' });
  }

  /** The release moment: projectiles / arcs / novas / AoE / heal / dash. */
  _releaseSkill(desc, { chainIndex = -1 } = {}) {
    if (!desc) return;
    const kind = String(desc.kind || desc.vfx || 'nova').toLowerCase();
    const element = desc.element || 'physical';
    const color = desc.color || (element === 'fire' ? 0xff5522 : element === 'ice' ? 0x38bdf8 : element === 'lightning' ? 0xfacc15 : 0xa855f7);
    const style = this._getAttackStyle();
    const isProjectile = kind === 'projectile';
    const range = Number(desc.range) || 3.2;
    const isTargetedAoe = kind === 'aoe' && range > 5;
    const inChain = chainIndex >= 0;

    if (!inChain) this.sound.play('skill');
    else if (!isProjectile && !isTargetedAoe) this.sound.play('slash', { combo: (chainIndex % 3) + 1 });

    let cursorPt = null;
    if (isProjectile || isTargetedAoe) cursorPt = this._aimSkillAtCursor(desc);

    if (isProjectile) {
      this._fireSkillProjectiles(desc, { element, color, style });
      return;
    }
    if (isTargetedAoe) {
      this._castTargetedAoe(desc, { element, color, range, cursorPt });
      return;
    }

    this.renderer.spawnSkillEffect(desc.vfx || kind, this.position, this.rotation, {
      color,
      radius: desc.radius || 3.4,
      range: desc.range || 3.2,
      angle: desc.angle
    });

    if (inChain || kind === 'melee_arc') {
      const reach = Number(desc.reach || desc.range || desc.radius || 3.2);
      this.renderer?.spawnWeaponTrail?.(this.position, this.rotation, {
        reach,
        imbueElement: this.gameState?.hero?.activeImbue?.element || this.gameState?.getActiveImbue?.()?.element || (element !== 'physical' ? element : null)
      });
    }

    if (kind === 'heal' || kind === 'buff') {
      if (kind === 'heal') this._showHeal(desc);
      return;
    }

    const radius = desc.radius || desc.range || 3.4;
    if (kind === 'dash') {
      const dashDur = Number(this.performDash({
        fromSkill: true,
        distance: desc.distance,
        invuln: desc.invuln,
        aimAtCursor: true
      })) || 0.24;
      if ((Number(desc.mult) || 0) <= 0) return;

      const hitSet = new Set();
      const applyDashImpact = (isLanding) => {
        const hitRad = isLanding ? radius : Math.max(1.8, radius * 0.75);
        const list = this.enemyManager?.getEnemiesInRange?.(this.position.x, this.position.z, hitRad) || [];
        let landedHits = 0;
        for (const enemy of list) {
          if (!enemy || enemy.dead || hitSet.has(enemy)) continue;
          hitSet.add(enemy);
          landedHits++;
          this._applyPlayerAttackToEnemy(enemy, {
            mult: desc.mult || 2.0,
            element,
            knockback: desc.knockback || 2.5,
            rollDamageFn: desc.rollDamage,
            stun: desc.stun
          });
        }
        if (isLanding) {
          this.renderer?.spawnSkillEffect?.(desc.vfx || 'slam', this.position, this.rotation, { color, radius });
          this.renderer?.spawnShockwave?.(this.position, radius, color, 0.35);
          if (this.world?.getBreakablesInArc) {
            const brks = this.world.getBreakablesInArc(this.position.x, this.position.z, this.rotation, radius, Math.PI * 2) || [];
            for (const b of brks) this.world.damageBreakable?.(b, 40);
          }
        }
        if (landedHits > 0) {
          this.comboCount += landedHits;
          this.comboDecayTimer = 4.5;
          this.renderer?.shake?.(Math.min(0.38, Number(desc.shake) || 0.25), 0.18);
        }
      };

      applyDashImpact(false);
      this.delayedHits.push({ t: Math.max(0.12, dashDur * 0.85), fn: () => applyDashImpact(true) });
      return;
    }

    const hits = kind === 'nova' ? Math.max(1, Math.min(6, Math.round(Number(desc.hits) || 1))) : 1;
    const novaScale = hits > 1 ? 1.45 / hits : 1.0;
    const pulseRoll = hits > 1 && typeof desc.rollDamage === 'function'
      ? (defStats) => {
        const res = desc.rollDamage(defStats);
        if (res && !res.miss) {
          res.damage = Math.max(1, Math.round(res.damage * novaScale));
          if (res.imbue && res.imbue.extra) res.imbue = { ...res.imbue, extra: Math.max(1, Math.round(res.imbue.extra * novaScale)) };
        }
        return res;
      }
      : desc.rollDamage;

    const executePulse = (pulseIdx) => {
      let targets = [];
      if (this.enemyManager) {
        if (kind === 'melee_arc' && typeof this.enemyManager.getEnemiesInArc === 'function') {
          targets = this.enemyManager.getEnemiesInArc(
            this.position.x,
            this.position.z,
            this.rotation,
            desc.range || 3.2,
            desc.angle || Math.PI * 1.15
          ) || [];
        } else if (typeof this.enemyManager.getEnemiesInRange === 'function') {
          targets = this.enemyManager.getEnemiesInRange(this.position.x, this.position.z, radius) || [];
        }
      }

      for (const enemy of targets) {
        this._applyPlayerAttackToEnemy(enemy, {
          mult: (desc.mult || 1.85) * novaScale,
          element,
          knockback: pulseIdx === hits - 1 ? (desc.knockback || 1.1) : 0.4,
          rollDamageFn: pulseRoll,
          stun: pulseIdx === 0 ? desc.stun : 0
        });
      }

      if (pulseIdx > 0) {
        this.sound.play('slash', { combo: (pulseIdx % 3) + 1 });
        this.renderer?.spawnWeaponTrail?.(this.position, this.rotation + pulseIdx * 2.1, {
          reach: radius,
          imbueElement: element !== 'physical' ? element : null
        });
        this.renderer?.spawnShockwave?.(this.position, radius * 0.85, color, 0.25);
      } else if (this.world && typeof this.world.getBreakablesInArc === 'function') {
        const brkArc = kind === 'melee_arc' ? (desc.angle || Math.PI * 1.15) : Math.PI * 2;
        const brkRange = kind === 'melee_arc' ? (desc.range || 3.2) : radius;
        const brks = this.world.getBreakablesInArc(this.position.x, this.position.z, this.rotation, brkRange, brkArc) || [];
        for (const b of brks) {
          this.world.damageBreakable?.(b, 40);
        }
      }

      if (targets.length > 0) {
        this.comboCount += targets.length;
        this.comboDecayTimer = 4.5;
        const shk = Math.min(0.38, Number(desc.shake) || 0.22);
        this.renderer?.shake?.(pulseIdx === 0 ? shk : shk * 0.55, 0.16);
      }
    };

    executePulse(0);
    for (let i = 1; i < hits; i++) {
      this.delayedHits.push({ t: i * 0.17, fn: () => executePulse(i) });
    }
  }

  /** kind: 'projectile' skills - fan of `count` projectiles across `angle` radians. */
  _fireSkillProjectiles(desc, { element, color, style }) {
    const count = Math.max(1, Math.min(12, Math.round(Number(desc.count) || 1)));
    const spread = count > 1 ? Math.max(0, Number(desc.angle) || 0.5) : 0;
    const radius = Number(desc.radius) || 1.0;
    const pierce = Boolean(desc.pierce);
    const magic = Boolean(desc.magic);
    const visual = magic || style !== 'arrow' ? 'bolt' : 'arrow';
    const aoeRadius = !pierce && radius >= 2 ? radius : 0;
    const hitRadius = Math.max(0.35, Math.min(0.9, radius * 0.45));
    const mult = Number(desc.mult) || 1.5;
    const baseYaw = this.rotation;
    const origin = this._projectileOrigin(baseYaw);
    const fallbackRoll = this._basicRollFn(mult, magic);

    for (let i = 0; i < count; i++) {
      const t = count > 1 ? i / (count - 1) - 0.5 : 0;
      this.spawnProjectile({
        kind: visual,
        pos: origin,
        yaw: baseYaw + t * spread,
        speed: Number(desc.speed) || 16,
        range: Number(desc.range) || 10,
        radius: hitRadius,
        pierce,
        mult,
        element,
        color,
        homing: magic && !pierce && count > 1,
        knockback: Number(desc.knockback) || 1.2,
        aoeRadius,
        rollDamageFn: typeof desc.rollDamage === 'function' ? desc.rollDamage : fallbackRoll,
        scale: aoeRadius ? 1.5 : pierce ? 1.2 : 1
      });
    }
    this.sound.play(visual === 'arrow' ? 'bow' : 'magic', { big: true });
  }

  /** Ranged 'aoe' skills (rain of arrows, meteor...) land at the cursor, clamped to range. */
  _castTargetedAoe(desc, { element, color, range, cursorPt }) {
    let tx;
    let tz;
    if (cursorPt) {
      const dx = cursorPt.x - this.position.x;
      const dz = cursorPt.z - this.position.z;
      const d = Math.hypot(dx, dz);
      const k = d > range ? range / d : 1;
      tx = this.position.x + dx * k;
      tz = this.position.z + dz * k;
    } else {
      const target = this._findAutoAimTarget(range, Math.PI * 2);
      const dist = Math.min(range, 4);
      tx = target ? target.x : this.position.x + Math.sin(this.rotation) * dist;
      tz = target ? target.z : this.position.z + Math.cos(this.rotation) * dist;
    }

    const radius = Number(desc.radius) || 3.5;
    const id = String(desc.skillId || desc.id || '').toLowerCase();
    const vfx = String(desc.vfx || '').toLowerCase();
    const type = vfx.includes('meteor') || id.includes('meteor') ? 'meteor'
      : id.includes('rain') || id.includes('arrow') ? 'rain'
      : element === 'fire' ? 'fire' : 'burst';
    const firstDelay = type === 'meteor' ? 0.32 : type === 'rain' ? 0.2 : 0.05;
    const hits = Math.max(1, Math.min(6, Math.round(Number(desc.hits) || 1)));

    if (typeof this.renderer.spawnTargetedAoE === 'function') {
      this.renderer.spawnTargetedAoE(type, { x: tx, y: 0, z: tz }, { radius, color });
    } else {
      this.renderer.spawnSkillEffect(desc.vfx || 'aoe', { x: tx, y: 0, z: tz }, this.rotation, { color, radius });
    }

    const hitOnce = (idx) => {
      const targets = this.enemyManager?.getEnemiesInRange?.(tx, tz, radius) || [];
      for (const enemy of targets) {
        if (!enemy || enemy.dead) continue;
        this._applyPlayerAttackToEnemy(enemy, {
          mult: desc.mult || 1.85,
          element,
          knockback: idx === hits - 1 ? (desc.knockback || 1.1) : 0.2,
          rollDamageFn: desc.rollDamage
        });
      }
      if (targets.length > 0) {
        this.comboCount += targets.length;
        this.comboDecayTimer = 4.5;
      }
      if (idx === 0 && this.world?.getBreakablesInArc) {
        const brks = this.world.getBreakablesInArc(tx, tz, 0, radius, Math.PI * 2) || [];
        for (const b of brks) this.world.damageBreakable?.(b, 40);
      }
      if (type !== 'meteor' && idx > 0) this.renderer.spawnShockwave?.({ x: tx, y: 0, z: tz }, radius * 0.6, color, 0.3);
      if (targets.length > 0 || type === 'meteor') {
        const shk = type === 'meteor' ? 0.32 : 0.18;
        this.renderer?.shake?.(shk, 0.16);
      }
    };
    for (let i = 0; i < hits; i++) {
      this.delayedHits.push({ t: firstDelay + i * 0.25, fn: () => hitOnce(i) });
    }
  }

  /**
   * Handle incoming enemy or trap damage on the player
   */
  receiveHit(rawDamage, source = null, options = {}) {
    if (this.invulnerableTimer > 0) return { damage: 0, dodged: true };

    let dmg = Number(rawDamage) || 5;
    if (this.isBlocking) {
      dmg = Math.max(1, Math.round(dmg * 0.3));
      this.sound.play('block');
      this.renderer.spawnHitSparks(this.position, 0x38bdf8, 10);
      this.renderer.spawnFloatingText(this.position, `BLOCKED (${dmg})`, { color: '#38bdf8' });
    }

    let result = { damage: dmg, dodged: false };
    if (this.gameState && typeof this.gameState.takeDamage === 'function') {
      result = this.gameState.takeDamage(dmg, { element: options.element || 'physical', source });
    }

    if (result.dodged) {
      this.renderer.spawnFloatingText(this.position, 'DODGE!', { color: '#38bdf8' });
      return result;
    }

    if (!this.isBlocking) {
      this.sound.play('hurt');
      this.renderer.spawnFloatingText(this.position, `-${result.damage}`, { type: 'player_hit' });
      this.renderer.shake(0.24, 0.16);
      if (result.damage > 0 && this.skillPhase && (this.skillPhase.stage === 'prep' || this.skillPhase.stage === 'gap')) {
        this.interruptSkill('Interrupted');
      }
    }

    if (this.heroMesh?.userData?.triggerHitFlash) {
      this.heroMesh.userData.triggerHitFlash(0.16);
    }
    this.invulnerableTimer = 0.25;
    return result;
  }

  /** Push the active imbue (gameState.getActiveImbue) into the hero mesh when it changes. */
  _syncImbueVisual() {
    const im = this.gameState?.getActiveImbue?.() || null;
    const key = im ? `${im.element || ''}|${im.status || ''}` : null;
    if (key === this._imbueSynced) return;
    this._imbueSynced = key;
    this.heroMesh?.userData?.setImbue?.(im);
  }

  _getMoveInputVector() {
    let ix = 0;
    let iz = 0;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) iz -= 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) iz += 1;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) ix -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) ix += 1;

    const vec = this._scratchMoveInput.set(ix, 0, iz);
    if (vec.lengthSq() > 0) {
      vec.normalize();
      // Rotate movement vector by camera yaw so W always moves away from camera
      const yaw = this.renderer.cameraYaw || 0;
      const cos = Math.cos(yaw);
      const sin = Math.sin(yaw);
      const rx = vec.x * cos + vec.z * sin;
      const rz = -vec.x * sin + vec.z * cos;
      vec.set(rx, 0, rz);
    }
    return vec;
  }

  update(dt = 0.016, elapsed = 0) {
    // Cooldowns & timers
    if (this.dashCooldown > 0) this.dashCooldown = Math.max(0, this.dashCooldown - dt);
    if (this.invulnerableTimer > 0) this.invulnerableTimer = Math.max(0, this.invulnerableTimer - dt);
    if (this.comboWindowTimer > 0) this.comboWindowTimer = Math.max(0, this.comboWindowTimer - dt);
    if (this.comboDecayTimer > 0) {
      this.comboDecayTimer = Math.max(0, this.comboDecayTimer - dt);
      if (this.comboDecayTimer === 0) this.comboCount = 0;
    }
    for (let i = 0; i < this.fallbackCooldowns.length; i++) {
      if (this.fallbackCooldowns[i] > 0) {
        this.fallbackCooldowns[i] = Math.max(0, this.fallbackCooldowns[i] - dt);
      }
    }

    // Shift: raise the shield when one is equipped, otherwise walk slowly. Never interrupts skills.
    const shiftHeld = this.inputEnabled && this._isShiftHeld();
    this.isBlocking = shiftHeld && this._canBlock();
    const slowWalk = shiftHeld && !this.isBlocking;

    this._updateDelayedHits(dt);
    this._syncImbueVisual();

    const stats = this.gameState?.getStats ? this.gameState.getStats() : {};
    const moveSpeed = 6.4 * (Number(stats.moveSpeed) || 1.0);

    const desiredMove = this._scratchDesiredMove.set(0, 0, 0);
    let attackProgress = 0;
    let skillPhaseActive = false;
    if (this.skillPhase && this.dashTimer <= 0) {
      const mv = this.inputEnabled && !shiftHeld ? this._getMoveInputVector() : null;
      skillPhaseActive = this._updateSkillPhase(dt, mv);
      if (skillPhaseActive) {
        this.state = 'skill';
        attackProgress = this.skillAnimProgress;
      }
    }

    if (skillPhaseActive) {
      // Rooted while the skill wind-up / chain / follow-through runs
    } else if (this.dashTimer > 0) {
      this.dashTimer = Math.max(0, this.dashTimer - dt);
      this.state = 'dash';
      desiredMove.copy(this.dashDir).multiplyScalar(moveSpeed * 2.55);
    } else if (this.attackTimer > 0) {
      this.attackTimer = Math.max(0, this.attackTimer - dt);
      this.state = 'attack';
      attackProgress = 1 - this.attackTimer / Math.max(0.05, this.attackDuration);
      if (!this.attackHitTriggered && attackProgress >= (this.attackHitAt || 0.35)) {
        this.attackHitTriggered = true;
        this._onAttackRelease();
      }
      if (this.attackKind === 'melee') {
        // Subtle forward lunge during melee swing
        desiredMove.set(Math.sin(this.rotation), 0, Math.cos(this.rotation)).multiplyScalar(1.8 * (1 - attackProgress));
      } else if (this.attackKind === 'melee_heavy') {
        // Heavy step into the swing once the wind-up ends
        const lunge = attackProgress > 0.3 ? 1.6 * (1 - attackProgress) : 0;
        desiredMove.set(Math.sin(this.rotation), 0, Math.cos(this.rotation)).multiplyScalar(lunge);
      }
      if (this.attackTimer === 0) {
        this.state = 'idle';
      }
    } else if (this.skillTimer > 0) {
      this.skillTimer = Math.max(0, this.skillTimer - dt);
      this.state = 'skill';
      if (this.skillAnim) attackProgress = 1 - this.skillTimer / Math.max(0.05, this.skillDuration);
      if (this.skillTimer === 0) {
        this.state = 'idle';
        this.skillAnim = null;
      }
    } else if (this.isBlocking) {
      const moveInput = this.inputEnabled ? this._getMoveInputVector() : this._scratchZeroVec;
      this.state = 'block';
      if (moveInput.lengthSq() > 0.001) {
        this.state = 'block_walk';
        desiredMove.copy(moveInput).multiplyScalar(moveSpeed * 0.38);
        this.rotation = Math.atan2(moveInput.x, moveInput.z);
      }
    } else {
      const moveInput = this.inputEnabled ? this._getMoveInputVector() : this._scratchZeroVec;
      if (moveInput.lengthSq() > 0.001) {
        this.state = slowWalk ? 'walk_slow' : 'walk';
        desiredMove.copy(moveInput).multiplyScalar(slowWalk ? moveSpeed * 0.4 : moveSpeed);
        const targetYaw = Math.atan2(moveInput.x, moveInput.z);
        // Smooth angular interpolation
        let diff = targetYaw - this.rotation;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        this.rotation += diff * Math.min(1, dt * 16);
      } else {
        this.state = 'idle';
      }

      // Hold Left Mouse or J for continuous combo chaining
      if (this.inputEnabled && (this.isMouseDown || this.keys.has('KeyJ'))) {
        this.performMeleeAttack(this.isMouseDown);
      }
    }

    // Apply movement & world collision resolution
    if (desiredMove.lengthSq() > 0.0001) {
      const nextX = this.position.x + desiredMove.x * dt;
      const nextZ = this.position.z + desiredMove.z * dt;

      if (this.world && typeof this.world.resolveCollision === 'function') {
        const resolved = this.world.resolveCollision(nextX, nextZ, this.radius);
        if (resolved && typeof resolved.x === 'number' && typeof resolved.z === 'number') {
          this.position.x = resolved.x;
          this.position.z = resolved.z;
        } else {
          this.position.x = nextX;
          this.position.z = nextZ;
        }
      } else if (this.world && typeof this.world.isWalkable === 'function') {
        if (this.world.isWalkable(nextX, nextZ, this.radius)) {
          this.position.x = nextX;
          this.position.z = nextZ;
        } else if (this.world.isWalkable(nextX, this.position.z, this.radius)) {
          this.position.x = nextX;
        } else if (this.world.isWalkable(this.position.x, nextZ, this.radius)) {
          this.position.z = nextZ;
        }
      } else {
        this.position.x = nextX;
        this.position.z = nextZ;
      }
    }

    // Auto-pickup nearby ground loot
    if (this.world && typeof this.world.pickupNearbyLoot === 'function') {
      const picked = this.world.pickupNearbyLoot(this.position.x, this.position.z, 1.35);
      if (Array.isArray(picked) && picked.length > 0) {
        this.sound.play('loot');
      }
    }

    // Move projectiles & resolve their hits
    this._updateProjectiles(dt);

    // Sync 3D Hero mesh transform & animation
    this.heroMesh.position.copy(this.position);
    this.heroMesh.rotation.y = this.rotation;

    // Keep Berserk 3D Aura synchronized
    const isBerserk = !!this.gameState?.hero?.berserkActive;
    this.renderer?.setBerserkAura?.(this.mesh, isBerserk);
    if (this.heroMesh?.userData) {
      this.heroMesh.userData.isBerserk = isBerserk;
    }
    if (this.heroMesh.userData?.animate) {
      let animState = this.state;
      let animCombo = this.comboStage;
      let attackProgress = 0;
      if (this.state === 'attack') {
        attackProgress = 1 - Math.max(0, this.attackTimer) / Math.max(0.0001, this.attackDuration);
        if (this.attackKind === 'arrow') animState = 'shoot';
        else if (this.attackKind === 'magic_bolt') animState = 'cast';
      } else if (this.state === 'skill' && this.skillPhase && this.skillAnim) {
        animState = this.skillAnim;
        animCombo = this.skillAnimCombo || 3;
        attackProgress = this.skillAnimProgress || 0;
      } else if (this.state === 'skill' && this.skillAnim) {
        animState = this.skillAnim;
        animCombo = 3;
        attackProgress = this.skillAnimProgress || 0;
      }
      this.heroMesh.userData.animate(animState, elapsed, dt, animCombo, attackProgress, this.skillCastSeq || 0);
    }
  }
}

export default PlayerController;

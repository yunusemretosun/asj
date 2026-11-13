/**
 * MusicManager — streamed background music with crossfading decks.
 *
 * Two HTMLAudioElement decks (loop, preload="none") crossfade over ~1.5s.
 * play(key) is a no-op when the key is already playing; unknown keys or
 * missing/undecodable files are silently skipped. Browsers block autoplay,
 * so the first requested track is deferred until the first pointerdown /
 * keydown. Playback pauses while the tab is hidden. Volume + mute persist
 * in localStorage under 'asj.audio'. Everything is a safe no-op in Node.
 */

export const MUSIC_BASE_URL = 'assets/sro/music/';
export const AUDIO_STORAGE_KEY = 'asj.audio';
export const CROSSFADE_SECONDS = 1.5;

/** Logical track key → file under public/assets/sro/music/. */
export const MUSIC_TRACKS = Object.freeze({
  title: 'title.ogg',
  village: 'village.ogg',
  outskirts: 'outskirts.ogg',
  donhwang: 'cave_sandstone.ogg',
  karakoram: 'mountain_pass.ogg',
  qinshi: 'ancient_tomb.ogg',
  flame: 'flame_halls.ogg',
  holywater: 'spirit_temple.ogg',
  jupiter: 'sky_temple.ogg',
  demon: 'demon_depths.ogg',
  roc_nest: 'roc_peak.ogg',
  togui: 'haunted_village.ogg',
  wreck: 'sunken_wreck.ogg',
  boss: 'boss.ogg',
  finalBoss: 'final_boss.ogg',
  victory: 'victory.ogg',
  death: 'death.ogg'
});

/** Stingers play once (no loop) and then hand back to the previous loop. */
const STINGERS = new Set(['victory', 'death']);
const STINGER_MAX_MS = 12000;

/**
 * Resolve the music key for a dungeon floor definition
 * ({ sroDungeon, isBossFloor, isFinalBossFloor }). Variant suffixes such as
 * 'qinshi_b6' fall back to their base dungeon.
 */
export function resolveFloorMusic(def, { preferBoss = false } = {}) {
  if (!def) return 'donhwang';
  if (def.isFinalBossFloor) return 'finalBoss';
  if (preferBoss && def.isBossFloor) return 'boss';
  const raw = String(def.sroDungeon || def.decorProfile || '');
  if (MUSIC_TRACKS[raw]) return raw;
  const base = raw.replace(/_b\d+$/, '');
  return MUSIC_TRACKS[base] ? base : 'donhwang';
}

const clamp01 = (v, d) => (Number.isFinite(Number(v)) ? Math.min(1, Math.max(0, Number(v))) : d);

function loadSettings() {
  const out = { musicVolume: 0.5, sfxVolume: 0.28, muted: false };
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(AUDIO_STORAGE_KEY) : null;
    if (raw) {
      const s = JSON.parse(raw);
      out.musicVolume = clamp01(s.musicVolume, out.musicVolume);
      out.sfxVolume = clamp01(s.sfxVolume, out.sfxVolume);
      out.muted = Boolean(s.muted);
    }
  } catch { /* ignore corrupt storage */ }
  return out;
}

export class MusicManager {
  constructor({ baseUrl = MUSIC_BASE_URL, tracks = MUSIC_TRACKS, sound = null } = {}) {
    this.baseUrl = baseUrl;
    this.tracks = tracks;
    this.sound = sound;
    const s = loadSettings();
    this.musicVolume = s.musicVolume;
    this.sfxVolume = s.sfxVolume;
    this.muted = s.muted;
    this.currentKey = null;
    this._loopKey = null;
    this._unlocked = false;
    this._hidden = false;
    this._fadeRaf = 0;
    this._stingerTimer = null;
    this.enabled = typeof window !== 'undefined' && typeof Audio !== 'undefined';
    this._decks = this.enabled ? [this._makeDeck(), this._makeDeck()] : [];
    this._active = 0;
    this._applySfx();
    if (!this.enabled) return;

    this._onUnlock = () => {
      if (this._unlocked) return;
      this._unlocked = true;
      window.removeEventListener('pointerdown', this._onUnlock, true);
      window.removeEventListener('keydown', this._onUnlock, true);
      this._resume();
    };
    this._onVisibility = () => {
      this._hidden = document.visibilityState === 'hidden';
      if (this._hidden) for (const d of this._decks) d.el.pause();
      else this._resume();
    };
    window.addEventListener('pointerdown', this._onUnlock, true);
    window.addEventListener('keydown', this._onUnlock, true);
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', this._onVisibility);
  }

  _makeDeck() {
    const el = new Audio();
    el.preload = 'none';
    el.loop = true;
    el.volume = 0;
    const deck = { el, key: null, gain: 0, failed: false };
    el.addEventListener('error', () => { deck.failed = true; });
    el.addEventListener('ended', () => { if (STINGERS.has(deck.key)) this._endStinger(); });
    return deck;
  }

  get targetVolume() { return this.muted ? 0 : this.musicVolume; }

  /** Crossfade to a track key. Same key → no-op. Unknown key → silent skip. */
  play(key) {
    if (!key || key === this.currentKey) return false;
    const file = this.tracks[key];
    if (!file) return false;
    const stinger = STINGERS.has(key);
    clearTimeout(this._stingerTimer);
    this._stingerTimer = null;
    if (!stinger) this._loopKey = key;
    this.currentKey = key;
    if (!this.enabled) return true;

    const next = this._active ^ 1;
    const deck = this._decks[next];
    deck.el.pause();
    deck.key = key;
    deck.failed = false;
    deck.gain = 0;
    deck.el.loop = !stinger;
    deck.el.src = this.baseUrl + file;
    deck.el.volume = 0;
    this._active = next;
    if (stinger) this._stingerTimer = setTimeout(() => this._endStinger(), STINGER_MAX_MS);
    this._resume();
    return true;
  }

  /** One-shot stinger, then return to the loop that was playing before. */
  stinger(key, thenKey = null) {
    if (thenKey && this.tracks[thenKey]) this._loopKey = thenKey;
    return this.play(key);
  }

  _endStinger() {
    if (!STINGERS.has(this.currentKey)) return;
    const back = this._loopKey;
    this.currentKey = null;
    if (back) this.play(back);
  }

  stop() {
    this.currentKey = null;
    this._loopKey = null;
    clearTimeout(this._stingerTimer);
    if (!this.enabled) return;
    this._active ^= 1;
    this._decks[this._active].key = null;
    this._startFade();
  }

  _resume() {
    if (!this.enabled || !this._unlocked || this._hidden) return;
    const deck = this._decks[this._active];
    if (deck.key && !deck.failed && deck.el.paused) {
      const p = deck.el.play();
      if (p && typeof p.catch === 'function') p.catch(() => { deck.failed = true; });
    }
    this._startFade();
  }

  _startFade() {
    if (this._fadeRaf || typeof requestAnimationFrame === 'undefined') return;
    let last = performance.now();
    const step = (now) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const delta = dt / CROSSFADE_SECONDS;
      const target = this.targetVolume;
      let busy = false;
      for (let i = 0; i < 2; i++) {
        const d = this._decks[i];
        const want = i === this._active && d.key && !d.failed ? 1 : 0;
        if (d.gain < want) d.gain = Math.min(want, d.gain + delta);
        else if (d.gain > want) d.gain = Math.max(want, d.gain - delta);
        if (d.gain !== want) busy = true;
        d.el.volume = d.gain * target;
        if (d.gain === 0 && !d.el.paused) d.el.pause();
      }
      this._fadeRaf = busy ? requestAnimationFrame(step) : 0;
    };
    this._fadeRaf = requestAnimationFrame(step);
  }

  _applyVolume() {
    if (!this.enabled) return;
    const target = this.targetVolume;
    for (const d of this._decks) d.el.volume = d.gain * target;
  }

  _applySfx() {
    if (this.sound && 'masterVolume' in this.sound) this.sound.masterVolume = this.muted ? 0 : this.sfxVolume;
  }

  _save() {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(AUDIO_STORAGE_KEY, JSON.stringify({ musicVolume: this.musicVolume, sfxVolume: this.sfxVolume, muted: this.muted }));
      }
    } catch { /* storage full / disabled */ }
  }

  /** Attach the SoundFX instance whose masterVolume follows the SFX slider. */
  bindSound(sound) { this.sound = sound || null; this._applySfx(); }

  setMusicVolume(v) { this.musicVolume = clamp01(v, this.musicVolume); this._applyVolume(); this._save(); }
  setSfxVolume(v) { this.sfxVolume = clamp01(v, this.sfxVolume); this._applySfx(); this._save(); }
  setMuted(m) { this.muted = Boolean(m); this._applyVolume(); this._applySfx(); this._save(); return this.muted; }
  toggleMute() { return this.setMuted(!this.muted); }

  dispose() {
    clearTimeout(this._stingerTimer);
    if (!this.enabled) return;
    if (this._fadeRaf) cancelAnimationFrame(this._fadeRaf);
    window.removeEventListener('pointerdown', this._onUnlock, true);
    window.removeEventListener('keydown', this._onUnlock, true);
    document.removeEventListener('visibilitychange', this._onVisibility);
    for (const d of this._decks) { d.el.pause(); d.el.removeAttribute('src'); }
  }
}

export function createMusicManager(opts) { return new MusicManager(opts); }
export default MusicManager;

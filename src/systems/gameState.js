// =============================================================================
// ASJ (ARKENVEIL: SIGILS & JOURNEYS) - Core RPG state (hero progression, derived stats,
// combat math, buffs, stamina, save/load). Owned by rpg-systems.
//
// Pure logic module: no DOM / three.js dependencies (localStorage is optional).
// Typical use (main.js):
//   import { createGame, createUIHost } from './systems/gameState.js';
//   const game = createGame({ data: extractedData });
//   game.inventory / game.skills / game.quests are attached subsystems.
//   per frame: game.update(dt)
// =============================================================================

import { Inventory, applyItemData, rollLoot, generateItem, RARITY, SLOTS, getItemBase, floorMonsterLevel, createOffhandAxe, applyVisualMetadata } from './inventory.js';
import { STATUS, BERSERK, berserkOrbs, NEMESIS, createNemesisTitle, HOT_SPRINGS } from './mechanics.js';
import { SkillSystem, applySkillData, BASIC_COMBO } from './skills.js';
import { QuestSystem, applyQuestData } from './quests.js';
import { CLASSES, DEFAULT_CLASS, getClass, isValidClass, sanitizeAppearance, canClassUse } from './classes.js';
import { PetSystem } from './petSystem.js';

export const SAVE_VERSION = 1;
export const SAVE_PREFIX = 'asj-save-';

export const ATTRIBUTES = ['str', 'dex', 'int', 'lck'];
export const ATTRIBUTE_INFO = {
  str: { name: 'Strength', short: 'STR', desc: 'Raises physical attack, Max HP, defense and HP regeneration.' },
  dex: { name: 'Dexterity', short: 'DEX', desc: 'Raises attack speed, hit rate, dodge, stamina and critical rate.' },
  int: { name: 'Intelligence', short: 'INT', desc: 'Raises magic attack, Max MP, MP regeneration and magic/elemental defense.' },
  lck: { name: 'Luck', short: 'LCK', desc: 'Raises critical rate, critical damage, gold find and magic find.' },
};

export const ELEMENTS = ['fire', 'ice', 'lightning', 'poison'];

/** Permanent Oakhaven Guild Academy training tracks (purchased with Gold). */
export const TOWN_TRAINING_DEFS = {
  might: {
    id: 'might',
    name: 'Martial Might Hall',
    icon: '⚔️',
    maxRank: 10,
    baseCost: 2000,
    costStep: 1800,
    desc: '+15 ATK & +3% Physical Attack per rank',
    perRank: { atk: 15, atkPct: 3 },
  },
  arcana: {
    id: 'arcana',
    name: 'Astral Conduit Hall',
    icon: '🔮',
    maxRank: 10,
    baseCost: 2000,
    costStep: 1800,
    desc: '+18 MATK, +3% Magic Attack, +25 Max SP & +0.8 SP Regen/s per rank',
    perRank: { matk: 18, matkPct: 3, mp: 25, mpRegen: 0.8 },
  },
  vitality: {
    id: 'vitality',
    name: 'Iron Bulwark Hall',
    icon: '🛡️',
    maxRank: 10,
    baseCost: 1800,
    costStep: 1600,
    desc: '+90 Max HP, +14 DEF & +1.2 HP Regen/s per rank',
    perRank: { hp: 90, def: 14, hpRegen: 1.2 },
  },
  agility: {
    id: 'agility',
    name: 'Wind Reflex Hall',
    icon: '💨',
    maxRank: 10,
    baseCost: 2400,
    costStep: 2000,
    desc: '+2.5% Attack Speed, +1.5% Crit Rate & +1.5% Move Speed per rank',
    perRank: { attackSpeedPct: 2.5, critRate: 1.5, moveSpeedPct: 1.5 },
  },
  fortune: {
    id: 'fortune',
    name: 'Oakhaven Merchant Guild',
    icon: '🪙',
    maxRank: 10,
    baseCost: 2200,
    costStep: 1800,
    desc: '+12% Gold Find, +12% Magic Find & +4% EXP Bonus per rank',
    perRank: { goldFind: 12, magicFind: 12, expBonus: 4 },
  },
};

/** 10-minute Town Sanctuary Blessings (purchased with Gold from Elder Aldric). */
export const TOWN_BLESSINGS = {
  war: {
    id: 'blessing_war',
    key: 'war',
    name: 'Blessing of War',
    icon: '⚔️',
    cost: 1500,
    duration: 600,
    desc: '+20% ATK & MATK, +8% Crit Rate for 10 minutes',
    mods: { atkPct: 20, matkPct: 20, critRate: 8 },
  },
  citadel: {
    id: 'blessing_citadel',
    key: 'citadel',
    name: 'Blessing of Iron Citadel',
    icon: '🏰',
    cost: 1500,
    duration: 600,
    desc: '+25% DEF, +12% Max HP & +10% All Resistances for 10 minutes',
    mods: { defPct: 25, hpPct: 12, allRes: 10 },
  },
  caravan: {
    id: 'blessing_caravan',
    key: 'caravan',
    name: 'Blessing of Oakhaven Merchant Guild',
    icon: '🐫',
    cost: 2500,
    duration: 600,
    desc: '+40% EXP, +60% Gold Find, +45% Magic Find & +15% Move Speed for 10 minutes',
    mods: { expBonus: 40, goldFind: 60, magicFind: 45, moveSpeedPct: 15 },
  },
  grand: {
    id: 'blessing_grand',
    key: 'grand',
    name: 'Grand Oakhaven Benediction',
    icon: '👑',
    cost: 4500,
    duration: 600,
    desc: 'Activates War, Iron Citadel & Oakhaven Merchant Guild blessings simultaneously for 10 minutes!',
    bundle: ['war', 'citadel', 'caravan'],
  },
};

/** Progression constants (may be overridden by extracted data). */
export const PROGRESSION = {
  maxLevel: 60,
  apPerLevel: 5,
  spPerLevel: 1,
  startLevel: 1,
  startGold: 150,
  startAttrs: { str: 5, dex: 5, int: 5, lck: 5 },
  expTable: null, // optional explicit table: expTable[level-1] = exp needed for level -> level+1
  deathGoldPenalty: 0.1,
};

/** EXP required to advance from `level` to `level + 1`. */
export function expToNext(level) {
  const L = Math.max(1, level | 0);
  const t = PROGRESSION.expTable;
  if (Array.isArray(t) && t.length >= L && Number(t[L - 1]) > 0) return Number(t[L - 1]);
  return Math.floor(30 * Math.pow(L, 1.8) + 30 * L);
}

/** Default monster EXP if the world does not provide one. */
export function monsterExp(level, { isElite = false, isBoss = false } = {}) {
  const base = 8 + level * 4 + Math.floor(level * level * 0.15);
  return Math.round(base * (isBoss ? 15 : isElite ? 3 : 1));
}

// ----------------------------------------------------------------------------- utils
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const rand = (a, b) => a + Math.random() * (b - a);
const num = (v, d = 0) => (typeof v === 'number' && isFinite(v) ? v : d);

export class Emitter {
  constructor() { this._handlers = {}; }
  on(evt, fn) { (this._handlers[evt] ||= []).push(fn); return () => this.off(evt, fn); }
  once(evt, fn) { const off = this.on(evt, (...a) => { off(); fn(...a); }); return off; }
  off(evt, fn) { const h = this._handlers[evt]; if (h) this._handlers[evt] = h.filter((f) => f !== fn); }
  emit(evt, ...args) {
    for (const key of [evt, '*']) {
      const h = this._handlers[key];
      if (!h) continue;
      for (const fn of h.slice()) {
        try { key === '*' ? fn(evt, ...args) : fn(...args); } catch (e) { console.error(`[gameState] handler for "${evt}" failed`, e); }
      }
    }
  }
}

/** Sum stat-modifier maps ({atkPct: 10, def: 5, ...}) into target. */
export function addMods(target, mods, scale = 1) {
  if (!mods) return target;
  for (const k in mods) {
    const v = mods[k];
    if (typeof v === 'number') target[k] = (target[k] || 0) + v * scale;
  }
  return target;
}

/**
 * Generic ASJ-style damage roll.
 * att: { atkMin, atkMax | atk, critRate, critDmg, hit, level, elemDmg:{fire..}, lifeSteal }
 * def: { def, dodge, level, res:{fire..}, block }
 * opts: { mult=1, flat=0, element, canCrit=true, sureHit=false, armorPierce=0 (0..1), bonusPct=0 }
 */
export function calcDamage(att = {}, def = {}, opts = {}) {
  const mult = num(opts.mult, 1);
  const atkMin = num(att.atkMin, num(att.atk, 5) * 0.85);
  const atkMax = Math.max(atkMin, num(att.atkMax, num(att.atk, 5) * 1.15));
  const hit = num(att.hit, 90);
  const dodge = num(def.dodge, 0);
  if (!opts.sureHit) {
    const hitChance = clamp((hit + 10 - dodge) / 100, 0.3, 1);
    if (Math.random() > hitChance) return { damage: 0, crit: false, miss: true, element: opts.element || null };
  }
  let dmg = rand(atkMin, atkMax) * mult + num(opts.flat);
  const res = def.res || {};
  if (opts.element) dmg *= 1 - clamp(num(res[opts.element]), -100, 80) / 100;
  // weapon elemental damage (always added, reduced by matching resistance)
  if (att.elemDmg) {
    for (const el of ELEMENTS) {
      const e = num(att.elemDmg[el]);
      if (e > 0) dmg += e * Math.max(0.5, mult * 0.75) * (1 - clamp(num(res[el]), -100, 80) / 100);
    }
  }
  const attLevel = num(att.level, 1);
  const armor = Math.max(0, num(def.def) * (1 - clamp(num(opts.armorPierce), 0, 1)));
  dmg *= 1 - armor / (armor + 40 + 8 * attLevel);
  dmg *= 1 + num(opts.bonusPct) / 100;
  let crit = false;
  if (opts.canCrit !== false && Math.random() * 100 < num(att.critRate, 5)) {
    crit = true;
    dmg *= num(att.critDmg, 150) / 100;
  }
  dmg = Math.max(1, Math.round(dmg * rand(0.95, 1.05)));
  return { damage: dmg, crit, miss: false, element: opts.element || null };
}

// =============================================================================
// Story Chronicles (unlocked as floors are fully cleared)
// =============================================================================
export const STORY_CHRONICLES = {
  0: {
    floor: 0,
    title: 'Prologue: Oakhaven Frontier Warden',
    summary: 'Reach Level 10 across the four open hunting grounds around Oakhaven to break the seal of the Whispering Stone Caverns.'
  },
  1: {
    floor: 1,
    title: 'Chapter 1: Cavern Gates Cleared (B1F)',
    summary: 'The stone-fang packs and cavern stalkers in the upper galleries of the Whispering Stone Caverns have been driven back as deeper trails emerge.'
  },
  2: {
    floor: 2,
    title: 'Chapter 2: Echoes of the Earthen Vaults (B2F)',
    summary: 'The stonebound wraith wardens have fallen; the passage leading into the Frostfang Empress’s lair now lies undefended.'
  },
  3: {
    floor: 3,
    title: 'Chapter 3: Fall of the Frostfang Lair (B3F)',
    summary: 'The Whispering Stone Caverns are completely cleared! The defeat of the Frostfang Empress sent raiders fleeing toward Ironcrest Crags.'
  },
  4: {
    floor: 4,
    title: 'Chapter 4: Crag Raiders Repelled (B4F)',
    summary: 'The Ironcrest raider vanguard was shattered, revealing charts of the frozen passages beneath Frosthollow.'
  },
  5: {
    floor: 5,
    title: 'Chapter 5: Breaking the Glacial Snare (B5F)',
    summary: 'Frost beasts, icebound stalkers, and glacial sentinels were routed in the frozen halls, exposing the citadel gates.'
  },
  6: {
    floor: 6,
    title: 'Chapter 6: Frosthollow Citadel Conquered (B6F)',
    summary: 'Ironcrest Crags & Frosthollow are purified! Warchief Drakmor’s defeat opened the ancient road to the Sunken Sovereign Vaults.'
  },
  7: {
    floor: 7,
    title: 'Chapter 7: Stone Wardens Awakened (B7F)',
    summary: 'The outer gallery of the Sunken Sovereign Vaults has been cleared, and the ancient tomb seals are beginning to yield.'
  },
  8: {
    floor: 8,
    title: 'Chapter 8: Collapse of the Frostbound Wing (B8F)',
    summary: 'The sunken vault legions have been swept aside, weakening the seal guarding Lady Glaciera in the central sanctum.'
  },
  9: {
    floor: 9,
    title: 'Chapter 9: The Sovereign Vaults Purified (B9F)',
    summary: 'The four vault guardians and Lady Glaciera have been vanquished! The path now opens to the Scorched Sunspire Ruins.'
  },
  10: {
    floor: 10,
    title: 'Chapter 10: Victory at the Ash Pass (B10F)',
    summary: 'Cinder witches and ash-shell swarms in the Scorched Sunspire Ruins were broken; the basalt galleries lie ready to cross.'
  },
  11: {
    floor: 11,
    title: 'Chapter 11: Necropolis of Scorched Bone (B11F)',
    summary: 'Bone reavers and charred dreadguards have been destroyed as the summit of Valkor, Bone Sovereign draws near.'
  },
  12: {
    floor: 12,
    title: 'Chapter 12: Fall of the Bone Sovereign (B12F)',
    summary: 'Valkor, Bone Sovereign and his cinder-forged legion are eradicated! The legendary gate of the Sunlit Crypt has opened.'
  },
  13: {
    floor: 13,
    title: 'Chapter 13: Seal of the Sunlit Crypt (B13F)',
    summary: 'The radiant wardens of the Sunlit Crypt have been overcome, revealing the celestial bridge toward the deeper sanctum.'
  },
  14: {
    floor: 14,
    title: 'Chapter 14: Liberation of the Sanctum Hall (B14F)',
    summary: 'The abyssal heralds were defeated in battle, unlocking the final seal into the Ashen Abyss.'
  },
  15: {
    floor: 15,
    title: 'Chapter 15: The Ashen Abyss Cleared (B15F)',
    summary: 'Malakor, Ember Archfiend and his abyssal fiends have been banished! The final ascent to Skycrown Citadel has begun.'
  },
  16: {
    floor: 16,
    title: 'Final Chapter: Savior of Skycrown Citadel (B16F)',
    summary: 'Aetherion, Sky Sovereign and the skybound host have been vanquished! Peace has returned to Oakhaven and all of Arkenveil.'
  },
  101: {
    floor: 101,
    title: 'Forgotten Realm: Ashen Totem Hollow Purified (S1F)',
    summary: 'The cursed totem shrine and the Elder Totem Chieftain of Ashen Totem Hollow have been destroyed.'
  },
  102: {
    floor: 102,
    title: 'Forgotten Realm: Shattered Armada Cove Cleared (S2F)',
    summary: 'The spectral crew of Shattered Armada Cove and their phantom captain have been silenced forever.'
  },
  103: {
    floor: 103,
    title: 'Hidden Sanctum: Vespera, Venom Queen Fallen (S3F)',
    summary: 'Vespera, Venom Queen and her royal serpent guards in the Serpent Queen’s Sanctum have been completely vanquished.'
  }
};

const EMPTY_HUD_BUFFS = Object.freeze([]);

// =============================================================================
// GameState
// =============================================================================
export class GameState extends Emitter {
  constructor(opts = {}) {
    super();
    if (opts.data) applyExtractedData(opts.data);
    this.data = opts.data || null;
    this.storage = opts.storage !== undefined ? opts.storage : (typeof localStorage !== 'undefined' ? localStorage : null);
    this._statsDirty = true;
    this._stats = null;
    this._hudSummaryCache = {};
    this._expiredBuffIds = [];
    this.activeSlot = 0;
    this._nemesis = null;
    this._lastGoldLost = 0;
    this._soakTimer = 0;
    this._newHero(opts.heroName, opts.classId, opts.appearance);
    this.inventory = new Inventory(this);
    this.skills = new SkillSystem(this);
    this.quests = new QuestSystem(this);
    this.pets = new PetSystem(this);
    this.inventory.grantStarterKit(this.hero.classId);
    this.skills.grantStarterSkills(this.hero.classId);
    this.fullRestore();
  }

  // --------------------------------------------------------------- hero setup
  _newHero(name = 'Hero', classId = DEFAULT_CLASS, appearance = null) {
    const cls = getClass(isValidClass(classId) ? classId : DEFAULT_CLASS);
    this.hero = {
      name,
      classId: cls.id,
      appearance: sanitizeAppearance(appearance, cls.id),
      level: PROGRESSION.startLevel,
      exp: 0,
      maxExp: expToNext(PROGRESSION.startLevel),
      gold: PROGRESSION.startGold,
      ap: 0,
      sp: 0,
      attrs: { ...cls.startAttrs },
      hp: 1, mp: 1, stamina: 100,
      combo: 0,
      buffs: [],
      dead: false,
      berserkCharge: 0,
      berserkActive: false,
      berserkRemaining: 0,
      restedExp: 0,
      isSoaking: false,
      nemesisKills: 0,
      townTraining: { might: 0, arcana: 0, vitality: 0, agility: 0, fortune: 0 },
    };
    this.progress = {
      maxFloor: 0,          // deepest floor reached
      currentFloor: 0,      // 0 = village
      floorsCleared: [],
      storyChronicles: [
        {
          floor: 0,
          title: STORY_CHRONICLES[0].title,
          summary: STORY_CHRONICLES[0].summary,
          cleared: false
        }
      ],
      bossesDefeated: [],
      kills: 0,
      deaths: 0,
      playTime: 0,
      composes: 0,
      storyCompleted: false,
    };
    this._comboTimer = 0;
    this._staminaDelay = 0;
    this._invuln = 0;
    this._regenAcc = 0;
  }

  // -------------------------------------------------------------- data access
  markDirty() { this._statsDirty = true; }

  get nemesis() { return this._nemesis; }
  set nemesis(v) { this._nemesis = v; this.emit('change'); }
  get berserkCharge() { return this.hero.berserkCharge; }
  get berserkActive() { return this.hero.berserkActive; }
  get berserkRemaining() { return this.hero.berserkRemaining; }
  get restedExp() { return this.hero.restedExp; }
  get isSoaking() { return this.hero.isSoaking; }
  get maxExp() { return this.hero.maxExp || expToNext(this.hero.level); }

  get classId() { return this.hero.classId || DEFAULT_CLASS; }
  get heroClass() { return getClass(this.classId); }
  get level() { return this.hero.level; }
  get exp() { return this.hero.exp; }
  get expToNext() { return expToNext(this.hero.level); }
  get gold() { return this.hero.gold; }
  get ap() { return this.hero.ap; }
  get sp() { return this.hero.sp; }
  get skillPoints() { return this.hero.sp; }
  get str() { return this.getAttr('str'); }
  get dex() { return this.getAttr('dex'); }
  get int() { return this.getAttr('int'); }
  get lck() { return this.getAttr('lck'); }
  get hp() { return this.hero.hp; }
  get mp() { return this.hero.mp; }
  get stamina() { return this.hero.stamina; }
  get buffs() { return this.hero.buffs; }
  get isDead() { return this.hero.dead; }
  get isInvulnerable() { return this._invuln > 0; }
  get maxHp() { return this.getStats().maxHp; }
  get maxMp() { return this.getStats().maxMp; }
  get maxStamina() { return this.getStats().maxStamina; }
  get atkMin() { return this.getStats().atkMin; }
  get atkMax() { return this.getStats().atkMax; }
  get def() { return this.getStats().def; }
  get critRate() { return this.getStats().critRate; }
  get critDmg() { return this.getStats().critDmg; }
  get dodge() { return this.getStats().dodge; }

  /** Collected stat modifiers from gear, passive skills and buffs. */
  getModifiers() {
    const mods = {};
    addMods(mods, this.heroClass.statMods);
    addMods(mods, this.inventory ? this.inventory.getEquipStats() : null);
    addMods(mods, this.skills ? this.skills.getPassiveBonuses() : null);
    if (this.pets) addMods(mods, this.pets.getPassiveMods());
    const tt = this.hero?.townTraining || {};
    for (const [k, def] of Object.entries(TOWN_TRAINING_DEFS)) {
      const rank = Math.max(0, Math.min(def.maxRank, tt[k] | 0));
      if (rank > 0) addMods(mods, def.perRank, rank);
    }
    for (const b of this.hero.buffs) addMods(mods, b.mods, b.stacks || 1);
    return mods;
  }

  getTownTrainingCost(key) {
    const def = TOWN_TRAINING_DEFS[key];
    if (!def) return null;
    const rank = Math.max(0, this.hero?.townTraining?.[key] | 0);
    if (rank >= def.maxRank) return Infinity;
    return def.baseCost + rank * def.costStep;
  }

  trainTownMastery(key) {
    const def = TOWN_TRAINING_DEFS[key];
    if (!def) return { ok: false, msg: 'Unknown Guild Training track.' };
    this.hero.townTraining ||= { might: 0, arcana: 0, vitality: 0, agility: 0, fortune: 0 };
    const rank = this.hero.townTraining[key] | 0;
    if (rank >= def.maxRank) return { ok: false, msg: `${def.name} is already at Max Rank (${def.maxRank})!` };
    const cost = this.getTownTrainingCost(key);
    if ((this.hero.gold || 0) < cost) {
      return { ok: false, msg: `Not enough Gold! Requires ${cost.toLocaleString()} G.` };
    }
    this.spendGold(cost);
    this.hero.townTraining[key] = rank + 1;
    this.markDirty();
    this.clampVitals();
    this.emit('change');
    const msg = `${def.name} trained to Rank ${rank + 1}/${def.maxRank}!`;
    this.emit('toast', msg, 'levelup');
    return { ok: true, msg, key, rank: rank + 1, cost };
  }

  buyTownBlessing(key = 'grand') {
    const cfg = TOWN_BLESSINGS[key];
    if (!cfg) return { ok: false, msg: 'Unknown town blessing.' };
    if ((this.hero.gold || 0) < cfg.cost) {
      return { ok: false, msg: `Not enough Gold! Requires ${cfg.cost.toLocaleString()} G.` };
    }
    this.spendGold(cfg.cost);
    const list = Array.isArray(cfg.bundle) ? cfg.bundle.map((k) => TOWN_BLESSINGS[k]).filter(Boolean) : [cfg];
    for (const b of list) {
      this.addBuff({
        id: b.id,
        name: b.name,
        icon: b.icon,
        duration: b.duration,
        mods: { ...b.mods },
        desc: b.desc,
      });
    }
    this.fullRestore();
    const msg = `${cfg.name} activated for 10 minutes!`;
    this.emit('toast', msg, 'levelup');
    return { ok: true, msg, key, cost: cfg.cost };
  }

  getTownHallView() {
    const buffs = this.hero?.buffs || [];
    const training = Object.values(TOWN_TRAINING_DEFS).map((def) => {
      const rank = Math.max(0, this.hero?.townTraining?.[def.id] | 0);
      return {
        ...def,
        rank,
        cost: rank >= def.maxRank ? 0 : this.getTownTrainingCost(def.id),
        maxed: rank >= def.maxRank,
      };
    });
    const blessings = Object.values(TOWN_BLESSINGS).map((b) => {
      const active = buffs.find((bf) => bf && bf.id === b.id);
      return {
        ...b,
        activeRemaining: active ? Math.max(0, active.remaining || 0) : 0,
      };
    });
    const inv = this.inventory;
    return {
      gold: this.hero.gold || 0,
      training,
      blessings,
      bag: {
        size: inv ? inv.bagSize : 36,
        max: 60,
        step: 6,
        cost: inv && typeof inv.getBagExpandCost === 'function' ? inv.getBagExpandCost() : 0,
      },
      storage: {
        size: inv ? inv.storageSize : 48,
        max: 88,
        step: 10,
        cost: inv && typeof inv.getStorageExpandCost === 'function' ? inv.getStorageExpandCost() : 0,
      },
    };
  }

  getAttr(a) {
    const m = this.getModifiers();
    return Math.round(num(this.hero.attrs[a]) + num(m[a]) + num(m.allAttrs));
  }

  /** Derived combat stats (cached until something changes). */
  getStats() {
    if (!this._statsDirty && this._stats) return this._stats;
    this._stats = this.computeDerivedStats();
    this._statsDirty = false;
    return this._stats;
  }

  computeDerivedStats() {
    const m = this.getModifiers();
    const L = this.hero.level;
    const A = {};
    for (const a of ATTRIBUTES) A[a] = Math.max(0, num(this.hero.attrs[a]) + num(m[a]) + num(m.allAttrs));
    const { str, dex, int, lck } = A;
    const pct = (k) => 1 + num(m[k]) / 100;

    const wMin = this.inventory && this.inventory.equipment.weapon ? num(m.atkMin) : 1 + num(m.atkMin);
    const wMax = this.inventory && this.inventory.equipment.weapon ? num(m.atkMax) : 3 + num(m.atkMax);
    // Physical attack scales from the class's primary attribute: archers draw their power
    // from DEX (bows) the way melee classes draw it from STR. Wizards keep the STR formula
    // for their (weak) staff swings; their real damage is MATK below.
    const dexPrimary = this.heroClass.primary === 'dex';
    const pMain = dexPrimary ? dex : str;
    const pSub = dexPrimary ? str : dex;
    const atkMin = Math.round((wMin + pMain * 1.25 + pSub * 0.25 + L * 1.1 + num(m.atk)) * pct('atkPct'));
    const atkMax = Math.max(atkMin, Math.round((wMax + pMain * 1.85 + pSub * 0.45 + L * 1.5 + num(m.atk)) * pct('atkPct')));
    const res = {};
    for (const el of ELEMENTS) res[el] = clamp(Math.round(num(m[el + 'Res']) + num(m.allRes) + int * 0.2), -100, 75);
    const elemDmg = {};
    for (const el of ELEMENTS) elemDmg[el] = Math.round(num(m[el + 'Dmg']));

    const baseAtkSpeed = 0.85;
    const atkSpeedBonus = (dex * 0.75 + num(m.attackSpeedPct)) / 100;
    const attackSpeed = Math.round(clamp(baseAtkSpeed + atkSpeedBonus, 0.5, 3.0) * 100) / 100;

    const s = {
      level: L,
      str, dex, int, lck,
      maxHp: Math.round((70 + L * 18 + str * 7.0 + num(m.hp)) * pct('hpPct')),
      maxMp: Math.round((25 + L * 8 + int * 6.5 + num(m.mp)) * pct('mpPct')),
      maxStamina: Math.round(100 + dex * 0.6 + num(m.stamina)),
      atkMin,
      atkMax,
      atk: Math.round((atkMin + atkMax) / 2),
      // INT -> MATK tuned with weapon scaling so Wizard elemental spells hit with authentic arcane power
      matk: Math.round(((wMin + wMax) * 0.45 + int * 2.0 + L * 1.25 + num(m.matk) * 1.4) * pct('matkPct')),
      def: Math.round((num(m.def) + str * 0.55 + dex * 0.25 + L * 0.85) * pct('defPct')),
      critRate: Math.round(clamp(5 + lck * 0.3 + dex * 0.1 + num(m.critRate), 0, 75) * 10) / 10,
      critDmg: Math.round(150 + lck * 0.75 + num(m.critDmg)),
      dodge: Math.round(clamp(2 + dex * 0.25 + lck * 0.05 + num(m.dodge), 0, 60) * 10) / 10,
      hit: Math.round((85 + dex * 0.45 + lck * 0.1 + num(m.hit)) * 10) / 10,
      block: Math.round(clamp(num(m.block), 0, 50) * 10) / 10,
      damageAbsorbPct: Math.round(clamp(num(m.damageAbsorbPct), 0, 75) * 10) / 10,
      attackSpeed,
      moveSpeed: Math.round(clamp(pct('moveSpeedPct'), 0.4, 2) * 100) / 100,
      hpRegen: Math.round((1.0 + L * 0.15 + str * 0.1 + num(m.hpRegen)) * 10) / 10,
      mpRegen: Math.round((1.2 + L * 0.1 + int * 0.12 + num(m.mpRegen)) * 10) / 10,
      staminaRegen: Math.round(22 + dex * 0.12 + num(m.staminaRegen)),
      lifeSteal: clamp(num(m.lifeSteal), 0, 30),
      manaSteal: clamp(num(m.manaSteal), 0, 20),
      magicFind: Math.round(lck * 0.6 + num(m.magicFind)),
      goldFind: Math.round(lck * 0.5 + num(m.goldFind)),
      expBonus: num(m.expBonus),
      cooldownReduction: clamp(num(m.cdr), 0, 40),
      thorns: num(m.thorns),
      res,
      elemDmg,
    };
    s.fireRes = res.fire; s.iceRes = res.ice; s.lightningRes = res.lightning; s.poisonRes = res.poison;

    if (this.hero?.berserkActive) {
      s.atkMin = Math.round(s.atkMin * BERSERK.damageMult);
      s.atkMax = Math.round(s.atkMax * BERSERK.damageMult);
      s.atk = Math.round((s.atkMin + s.atkMax) / 2);
      s.matk = Math.round(s.matk * BERSERK.damageMult);
      s.moveSpeed = Math.round(s.moveSpeed * BERSERK.moveSpeedMult * 100) / 100;
      s.attackSpeed = Math.round(s.attackSpeed * BERSERK.atkSpeedMult * 100) / 100;
    }
    return s;
  }

  recalcStats() {
    this.markDirty();
    return this.getStats();
  }
  getDerivedStats() {
    return this.getStats();
  }

  // ------------------------------------------------------------ progression
  addExp(amount, { silent = false } = {}) {
    const h = this.hero;
    if (h.level >= PROGRESSION.maxLevel) return 0;
    let restedBonus = 0;
    const baseAmt = Math.max(0, Math.round(amount));
    if (h.restedExp > 0 && baseAmt > 0) {
      restedBonus = Math.min(h.restedExp, Math.max(1, Math.round(baseAmt * HOT_SPRINGS.bonusExpMult)));
      h.restedExp -= restedBonus;
    }
    const bonus = 1 + num(this.getStats().expBonus) / 100;
    const gained = Math.max(0, Math.round(baseAmt * bonus)) + restedBonus;
    h.exp += gained;
    let levels = 0;
    while (h.level < PROGRESSION.maxLevel && h.exp >= expToNext(h.level)) {
      h.exp -= expToNext(h.level);
      h.level += 1;
      h.ap += PROGRESSION.apPerLevel;
      h.sp += PROGRESSION.spPerLevel;
      levels++;
    }
    if (h.level >= PROGRESSION.maxLevel) h.exp = 0;
    h.maxExp = expToNext(h.level);
    if (!silent) this.emit('exp', gained, h.exp, expToNext(h.level));
    if (levels > 0) {
      this.markDirty();
      this.fullRestore();
      this.emit('levelup', h.level, levels);
      this.emit('toast', `Level Up! You reached level ${h.level} (+${PROGRESSION.apPerLevel * levels} AP, +${PROGRESSION.spPerLevel * levels} SP)`, 'levelup');
      if (this.inventory) this.inventory.restockShops();
      if (this.quests) this.quests.onLevel(h.level);
    }
    this.emit('change');
    return gained;
  }
  gainExp(amount, opts) {
    return this.addExp(amount, opts);
  }

  addGold(amount) {
    const v = Math.round(amount);
    this.hero.gold = Math.max(0, this.hero.gold + v);
    this.emit('gold', this.hero.gold, v);
    this.emit('change');
    return this.hero.gold;
  }

  spendGold(amount) {
    if (this.hero.gold < amount) return false;
    this.addGold(-amount);
    return true;
  }

  /** Spend attribute points. Returns {ok,msg}. */
  allocate(attr, n = 1) {
    attr = String(attr || '').toLowerCase().slice(0, 3);
    if (!ATTRIBUTES.includes(attr)) return { ok: false, msg: 'Unknown attribute' };
    n = Math.max(1, n | 0);
    if (this.hero.ap < n) return { ok: false, msg: 'Not enough attribute points' };
    const oldMaxHp = this.maxHp, oldMaxMp = this.maxMp;
    this.hero.ap -= n;
    this.hero.attrs[attr] += n;
    this.markDirty();
    // keep current HP/MP growing with their maximums
    this.hero.hp = Math.min(this.maxHp, this.hero.hp + Math.max(0, this.maxHp - oldMaxHp));
    this.hero.mp = Math.min(this.maxMp, this.hero.mp + Math.max(0, this.maxMp - oldMaxMp));
    this.emit('change');
    return { ok: true, msg: `+${n} ${ATTRIBUTE_INFO[attr].short}` };
  }
  allocateStat(attr, n) { return this.allocate(attr, n); }
  spendAP(attr, n) { return this.allocate(attr, n); }

  /** Refund all attribute points (e.g. by a reset scroll / NPC). */
  resetAttributes() {
    const h = this.hero;
    let spent = 0;
    const base = this.heroClass.startAttrs;
    for (const a of ATTRIBUTES) { spent += h.attrs[a] - base[a]; h.attrs[a] = base[a]; }
    h.ap += spent;
    this.markDirty();
    this.clampVitals();
    this.emit('change');
    return spent;
  }

  // ------------------------------------------------------------- vitals
  clampVitals() {
    const s = this.getStats();
    this.hero.hp = clamp(this.hero.hp, 0, s.maxHp);
    this.hero.mp = clamp(this.hero.mp, 0, s.maxMp);
    this.hero.stamina = clamp(this.hero.stamina, 0, s.maxStamina);
  }

  fullRestore() {
    this.markDirty();
    const s = this.getStats();
    this.hero.hp = s.maxHp;
    this.hero.mp = s.maxMp;
    this.hero.stamina = s.maxStamina;
    this.hero.dead = false;
    this.emit('hp', this.hero.hp, s.maxHp);
    this.emit('mp', this.hero.mp, s.maxMp);
  }

  heal(hp = 0, mp = 0) {
    const s = this.getStats();
    if (this.hero.dead) return { hp: 0, mp: 0 };
    const h0 = this.hero.hp, m0 = this.hero.mp;
    this.hero.hp = clamp(this.hero.hp + num(hp), 0, s.maxHp);
    this.hero.mp = clamp(this.hero.mp + num(mp), 0, s.maxMp);
    if (this.hero.hp !== h0) this.emit('hp', this.hero.hp, s.maxHp);
    if (this.hero.mp !== m0) this.emit('mp', this.hero.mp, s.maxMp);
    return { hp: this.hero.hp - h0, mp: this.hero.mp - m0 };
  }
  restoreMp(mp) { return this.heal(0, mp).mp; }

  useMp(cost) {
    if (this.hero.mp < cost) return false;
    this.hero.mp -= cost;
    this.emit('mp', this.hero.mp, this.maxMp);
    return true;
  }

  useStamina(cost) {
    if (this.hero.stamina < cost) return false;
    this.hero.stamina -= cost;
    this._staminaDelay = 0.8;
    return true;
  }

  /** Make the hero invulnerable for `sec` seconds (dash i-frames, respawn, etc.). */
  setInvulnerable(sec) { this._invuln = Math.max(this._invuln, num(sec)); }

  /** Basic-attack combo counter (call on every successful hit). */
  registerHit(count = 1) {
    this.hero.combo += count;
    this._comboTimer = 3;
    return this.hero.combo;
  }
  get comboBonusPct() { return Math.min(20, Math.floor(this.hero.combo / 5) * 2); }

  /**
   * Damage the hero.
   *   takeDamage(25)                         -> raw number, mitigated by DEF/dodge/block
   *   takeDamage(25, { element:'fire' })
   *   takeDamage(monsterStats, {mult})       -> attacker stats object: full calcDamage roll
   *   opts: { element, raw (skip DEF), canDodge=true, canBlock=true, source }
   * Returns { damage, dodged, blocked, crit, dead }.
   */
  takeDamage(amountOrAttacker, optsOrKiller = {}, extraOpts = {}) {
    const h = this.hero;
    if (h.dead) return { damage: 0, dodged: false, blocked: false, crit: false, dead: true };
    let opts = extraOpts;
    let killer = null;
    if (typeof amountOrAttacker === 'object' && amountOrAttacker) {
      killer = amountOrAttacker;
      opts = optsOrKiller || {};
    } else if (typeof optsOrKiller === 'object' && optsOrKiller) {
      if (optsOrKiller.killer || optsOrKiller.attacker || optsOrKiller.source) {
        killer = optsOrKiller.killer || optsOrKiller.attacker || optsOrKiller.source;
        opts = optsOrKiller;
      } else if (optsOrKiller.type || optsOrKiller.name || optsOrKiller.baseName) {
        killer = optsOrKiller;
        opts = { ...optsOrKiller, ...extraOpts };
      } else {
        opts = optsOrKiller;
      }
    }
    if (this._invuln > 0 && !opts.ignoreInvuln) return { damage: 0, dodged: true, blocked: false, crit: false, dead: false, invulnerable: true };
    const s = this.getStats();
    let damage, crit = false;
    if (typeof amountOrAttacker === 'object' && amountOrAttacker) {
      const r = calcDamage(amountOrAttacker, s, opts);
      if (r.miss) { this.emit('dodge'); return { damage: 0, dodged: true, blocked: false, crit: false, dead: false }; }
      damage = r.damage; crit = r.crit;
    } else {
      damage = num(amountOrAttacker);
      if (opts.canDodge !== false && Math.random() * 100 < s.dodge) {
        this.emit('dodge');
        return { damage: 0, dodged: true, blocked: false, crit: false, dead: false };
      }
      if (!opts.raw) damage *= 1 - s.def / (s.def + 40 + 8 * num(opts.attackerLevel, h.level));
      if (opts.element) damage *= 1 - num(s.res[opts.element]) / 100;
    }
    if (s.damageAbsorbPct > 0) {
      damage *= 1 - s.damageAbsorbPct / 100;
    }
    let blocked = false;
    if (opts.canBlock !== false && s.block > 0 && Math.random() * 100 < s.block) { blocked = true; damage *= 0.3; }
    if (opts.blocking) { blocked = true; damage *= 0.4; } // active shield-block from the controller
    damage = Math.max(1, Math.round(damage));
    h.hp = Math.max(0, h.hp - damage);
    this.emit('hp', h.hp, s.maxHp);
    this.emit('damaged', damage, { crit, blocked, element: opts.element || null });
    if (opts.element === 'poison' && !opts.noDot) this.addBuff({ id: 'poisoned', name: 'Poisoned', icon: '☠', debuff: true, duration: 4, dot: { dps: Math.max(1, Math.round(damage * 0.1)), element: 'poison' } });
    if (h.hp <= 0) this._die(killer);
    return { damage, dodged: false, blocked, crit, dead: h.dead };
  }

  _die(killer = null) {
    const h = this.hero;
    if (h.dead) return;
    h.dead = true;
    h.combo = 0;
    h.buffs = [];
    this.progress.deaths++;
    this.markDirty();
    if (killer && !killer.isBoss) {
      this.registerNemesisFromKill(killer);
    }
    this.emit('death', killer);
    this.emit('toast', 'You have fallen...', 'death');
  }

  /** Revive in town (or at a specified floor on Challenge return). */
  revive({ penalty = true, targetFloor = 0 } = {}) {
    let lost = 0;
    if (penalty) {
      lost = Math.floor(this.hero.gold * PROGRESSION.deathGoldPenalty);
      this.hero.gold -= lost;
    }
    this._lastGoldLost = lost;
    this.hero.dead = false;
    this.fullRestore();
    this.setInvulnerable(2);
    this.progress.currentFloor = targetFloor;
    this.emit('revive', lost);
    if (lost) this.emit('toast', `Revived in the village. Lost ${lost} gold.`, 'info');
    this.emit('change');
    return lost;
  }

  // -------------------------------------------------------------- berserk (hwan)
  addBerserkCharge(amount) {
    const h = this.hero;
    if (h.berserkActive) return h.berserkCharge;
    const added = num(amount, 0);
    h.berserkCharge = clamp(h.berserkCharge + added, 0, BERSERK.maxCharge);
    this.emit('berserkCharge', h.berserkCharge, BERSERK.maxCharge);
    this.emit('change');
    return h.berserkCharge;
  }

  activateBerserk() {
    const h = this.hero;
    if (h.berserkCharge < BERSERK.maxCharge || h.berserkActive) {
      return { ok: false, msg: 'Berserk gauge not full' };
    }
    h.berserkActive = true;
    h.berserkRemaining = BERSERK.duration;
    h.berserkCharge = 0;
    this.markDirty();
    this.getStats();
    this.emit('berserk', { active: true, duration: BERSERK.duration });
    this.emit('change');
    return { ok: true, duration: BERSERK.duration };
  }

  // -------------------------------------------------------------- nemesis
  registerNemesisFromKill(killer, floorNum) {
    if (killer?.isBoss) return null;
    const hero = this.hero;
    const currentFloor = this.progress?.currentFloor || 0;
    const lastGoldLost = this._lastGoldLost || Math.round((hero.gold || 0) * 0.1);
    const prevRank = (this._nemesis && this._nemesis.baseType === (killer?.type || killer?.id)) ? (this._nemesis.rank || 1) : 0;
    const rank = Math.min(NEMESIS.maxRank, prevRank + 1);
    const baseName = killer?.baseName || killer?.name || 'Shadow Stalker';
    this._nemesis = {
      baseType: killer?.type || killer?.id || 'wolf',
      baseName,
      name: createNemesisTitle(baseName, hero.classId, rank),
      rank,
      floor: Math.max(1, Number(floorNum ?? currentFloor) || 1),
      level: Math.max(1, (killer?.level || hero.level || 1) + 1),
      lostGold: Math.max(50, lastGoldLost || Math.round((hero.gold || 0) * 0.1) || 100),
    };
    this.emit('nemesisCreated', this._nemesis);
    this.emit('change');
    return this._nemesis;
  }

  claimNemesisVengeance(enemy) {
    if (!this._nemesis) return { ok: false };
    const n = this._nemesis;
    const goldRefund = Math.round((n.lostGold || 100) * NEMESIS.refundGoldRatio) + (n.rank || 1) * 80;
    const bonusExp = Math.round(45 * (n.level || 1) * NEMESIS.expBonusMult);
    this.addGold(goldRefund);
    this.addExp(bonusExp);
    this.hero.nemesisKills = (this.hero.nemesisKills || 0) + 1;
    this._nemesis = null;
    this.emit('nemesisSlain', { goldRefund, bonusExp, enemy });
    this.emit('change');
    return { ok: true, goldRefund, bonusExp };
  }

  // -------------------------------------------------------------- jade mist hot springs
  soakInHotSprings(dt = 0.1) {
    const h = this.hero;
    if (h.dead) return;
    const dtSec = clamp(num(dt, 0.1), 0, 1);
    const maxHp = this.maxHp;
    const maxMp = this.maxMp;
    h.hp = Math.min(maxHp, h.hp + maxHp * HOT_SPRINGS.hpRegenPctPerSec * dtSec);
    h.mp = Math.min(maxMp, h.mp + maxMp * HOT_SPRINGS.mpRegenPctPerSec * dtSec);
    const maxExp = h.maxExp || this.expToNext || expToNext(h.level) || 100;
    const restedGain = Math.max(1, Math.round(maxExp * HOT_SPRINGS.restedGainPctPerSec * dtSec));
    const restedMax = Math.round(maxExp * HOT_SPRINGS.maxRestedRatio);
    h.restedExp = Math.min(restedMax, (h.restedExp || 0) + restedGain);
    h.isSoaking = true;
    this._soakTimer = 0.4;
    this.emit('hp', h.hp, maxHp);
    this.emit('mp', h.mp, maxMp);
    this.emit('hotSprings', { hp: h.hp, mp: h.mp, restedExp: h.restedExp });
    this.emit('change');
  }

  // -------------------------------------------------------------- buffs
  /**
   * addBuff({ id, name, icon, duration, mods:{atkPct:20}, debuff, dot:{dps,element}, hot:{hps,mps}, maxStacks })
   * Same id refreshes duration (and stacks up to maxStacks).
   */
  addBuff(buff) {
    if (!buff || !buff.id) return null;
    const existing = this.hero.buffs.find((b) => b.id === buff.id);
    if (existing) {
      existing.remaining = Math.max(existing.remaining, num(buff.duration, existing.duration));
      existing.duration = Math.max(existing.duration, num(buff.duration, existing.duration));
      if (buff.maxStacks) existing.stacks = Math.min(buff.maxStacks, (existing.stacks || 1) + 1);
      if (buff.mods) existing.mods = { ...buff.mods };
      if (buff.imbue) existing.imbue = { ...buff.imbue };
    } else {
      this.hero.buffs.push({
        id: buff.id,
        name: buff.name || buff.id,
        icon: buff.icon || (buff.debuff ? '✖' : '✦'),
        desc: buff.desc || '',
        duration: num(buff.duration, 10),
        remaining: num(buff.duration, 10),
        mods: buff.mods ? { ...buff.mods } : null,
        debuff: !!buff.debuff,
        imbue: buff.imbue ? { ...buff.imbue } : null,
        dot: buff.dot || null,
        hot: buff.hot || null,
        stacks: 1,
        maxStacks: buff.maxStacks || 1,
        _tick: 0,
      });
    }
    this.markDirty();
    this.clampVitals();
    this.emit('buff', buff.id, true);
    this.emit('change');
    return buff.id;
  }

  removeBuff(id) {
    const n = this.hero.buffs.length;
    this.hero.buffs = this.hero.buffs.filter((b) => b.id !== id);
    if (this.hero.buffs.length !== n) {
      this.markDirty();
      this.clampVitals();
      this.emit('buff', id, false);
      this.emit('change');
    }
  }

  hasBuff(id) { return this.hero.buffs.some((b) => b.id === id); }
  cleanseDebuffs() { for (const b of this.hero.buffs.filter((x) => x.debuff)) this.removeBuff(b.id); }

  // -------------------------------------------------------------- combat
  /**
   * Roll an outgoing hero attack against a defender.
   * defStats: { def, dodge, res, level } (monster)  opts: { mult, flat, element, magic, canCrit, sureHit, armorPierce }
   */
  rollAttack(defStats = {}, opts = {}) {
    const s = this.getStats();
    const critBonus = num(opts.critBonus, 0);
    const att = opts.magic
      ? { atkMin: s.matk * 0.85, atkMax: s.matk * 1.15, critRate: s.critRate + critBonus, critDmg: s.critDmg, hit: s.hit + 10, level: s.level }
      : { atkMin: s.atkMin, atkMax: s.atkMax, critRate: s.critRate + critBonus, critDmg: s.critDmg, hit: s.hit, level: s.level, elemDmg: s.elemDmg };
    const r = calcDamage(att, defStats, { ...opts, bonusPct: num(opts.bonusPct) + this.comboBonusPct });
    if (!r.miss) {
      const im = this.getActiveImbue();
      const base = r.damage;
      let triggered = null;
      if (im && num(im.bonusPct) > 0) {
        const resv = clamp(num((defStats.res || {})[im.element]), -100, 80);
        const extra = Math.max(1, Math.round(base * num(im.bonusPct) / 100 * (1 - resv / 100)));
        r.damage += extra;
        r.imbueDamage = extra;
        r.imbue = { element: im.element, extra };
        if (im.status && STATUS[im.status] && Math.random() * 100 < num(im.statusChance)) triggered = im.status;
      }
      if (!triggered && opts.status && STATUS[opts.status] && Math.random() * 100 < num(opts.statusChance)) triggered = opts.status;
      r.status = triggered ? this._makeStatus(triggered, r.damage) : null;
      if (s.lifeSteal > 0) this.heal(r.damage * s.lifeSteal / 100, 0);
      if (s.manaSteal > 0) this.heal(0, r.damage * s.manaSteal / 100);
    }
    return r;
  }

  /** Active imbue ({element, bonusPct, status, statusChance}) from the 'imbue' buff, or null. */
  getActiveImbue() {
    const b = this.hero.buffs.find((x) => x.id === 'imbue' && x.imbue && x.remaining > 0);
    return b ? b.imbue : null;
  }
  _makeStatus(id, damage) {
    const def = STATUS[id];
    const st = { id, duration: def.duration };
    if (def.dotPctOfHit) st.dotPerTick = Math.max(1, Math.round(damage * def.dotPctOfHit));
    return st;
  }

  /** Basic-attack roll honouring the class attack style (wizard bolts use MATK). */
  rollBasicAttack(defStats = {}, { mult = 1, ...rest } = {}) {
    const magic = this.heroClass.attackStyle === 'magic_bolt';
    return this.rollAttack(defStats, { ...rest, mult, magic });
  }
  getBasicAttackRoll(defStats, mult = 1) { return this.rollBasicAttack(defStats, { mult }); }

  /** Descriptor for basic attack combo stage (0-based). */
  getBasicAttack(stage = 0) {
    const c = BASIC_COMBO[clamp(stage | 0, 0, BASIC_COMBO.length - 1)];
    const s = this.getStats();
    return {
      ...c,
      stage,
      attackSpeed: s.attackSpeed,
      duration: Math.round((c.duration / Math.max(0.5, s.attackSpeed)) * 100) / 100,
      staminaCost: c.staminaCost || 0,
      rollDamage: (defStats) => this.rollBasicAttack(defStats, { mult: c.mult }),
    };
  }

  /**
   * Handle a monster death: EXP, gold, loot roll, quest progress.
   * monster: { type|id|name, level, exp?, gold?, isElite, isBoss, floor, drops? }
   * Returns { exp, gold, drops: [item...] } - drops are NOT auto-added to the bag:
   * the world spawns them as ground loot (or call game.inventory.addItem(item)).
   */
  onMonsterKilled(monster = {}) {
    const level = num(monster.level, floorMonsterLevel(Math.max(1, this.progress.currentFloor || 1)));
    const isBoss = !!monster.isBoss, isElite = !!monster.isElite, isGiant = !!monster.isGiant;
    const floor = num(monster.floor, this.progress.currentFloor);
    let exp = num(monster.exp, monsterExp(level, { isElite, isBoss }));
    // level difference scaling (no farming trivially weak monsters)
    const diff = level - this.hero.level;
    exp = Math.max(1, Math.round(exp * clamp(1 + diff * 0.1, 0.2, 1.5)));
    const s = this.getStats();
    const loot = rollLoot(level, { isBoss, isElite, isGiant, magicFind: s.magicFind, goldFind: s.goldFind, classId: this.classId });
    const gold = monster.gold != null ? Math.round(num(monster.gold) * (1 + s.goldFind / 100)) : loot.gold;
    const drops = loot.items;
    if (Array.isArray(monster.drops)) {
      for (const d of monster.drops) {
        const chance = num(d.chance, 1);
        if (Math.random() <= chance) {
          const it = generateItem({ baseId: d.baseId || d.id || d.itemId, level, rarity: d.rarity, count: d.count || 1 });
          if (it) drops.push(it);
        }
      }
    }
    // quest-specific drops
    if (this.quests) drops.push(...this.quests.rollQuestDrops(monster));
    this.progress.kills++;
    if (isBoss) {
      const id = monster.type || monster.id || monster.name || `boss_f${floor}`;
      if (!this.progress.bossesDefeated.includes(id)) this.progress.bossesDefeated.push(id);
    }
    this.addBerserkCharge(isBoss ? BERSERK.gainBoss : isGiant ? Math.round(BERSERK.gainElite * 1.5) : isElite ? BERSERK.gainElite : BERSERK.gainNormal);
    if (monster.isNemesis) {
      this.claimNemesisVengeance(monster);
    }
    this.addExp(exp);
    if (this.pets) this.pets.addExp(Math.max(1, Math.round(exp * 0.35)));
    if (this.quests) this.quests.onKill(monster);
    this.emit('kill', monster, { exp, gold, drops });
    return { exp, gold, drops };
  }
  onEnemyKill(monster) { return this.onMonsterKilled(monster); }
  recordKill(monster) { return this.onMonsterKilled(monster); }

  /** World notifications (also forwarded to quests). */
  enterFloor(floor) {
    floor = num(floor, 0);
    this.progress.currentFloor = floor;
    if (floor > this.progress.maxFloor) this.progress.maxFloor = floor;
    if (this.quests && floor > 0) this.quests.onReachFloor(floor);
    this.emit('floor', floor);
    this.emit('change');
  }
  floorCleared(floor) {
    floor = num(floor, this.progress.currentFloor);
    const firstClear = !this.progress.floorsCleared.includes(floor);
    if (firstClear) this.progress.floorsCleared.push(floor);
    const meta = STORY_CHRONICLES[floor];
    if (meta) {
      if (!Array.isArray(this.progress.storyChronicles)) this.progress.storyChronicles = [];
      let entry = this.progress.storyChronicles.find((c) => c.floor === floor);
      if (!entry) {
        entry = { floor, title: meta.title, summary: meta.summary, cleared: true };
        this.progress.storyChronicles.push(entry);
      } else {
        entry.cleared = true;
      }
      this.emit('chronicle', entry);
      if (firstClear) {
        this.emit('toast', `📖 Chronicle Updated: ${meta.title}`, 'quest');
      }
    }
    if (this.quests) this.quests.onFloorCleared(floor);
    this.emit('floorCleared', floor);
    this.emit('change');
  }
  getStoryChronicles() {
    const list = Array.isArray(this.progress?.storyChronicles) ? [...this.progress.storyChronicles] : [];
    return list.sort((a, b) => (a.floor || 0) - (b.floor || 0));
  }
  get unlockedMaxFloor() { return Math.max(1, this.progress.maxFloor + (this.progress.floorsCleared.includes(this.progress.maxFloor) ? 1 : 0)); }

  // -------------------------------------------------------------- update
  update(dt) {
    dt = clamp(num(dt), 0, 0.5);
    const h = this.hero;
    this.progress.playTime += dt;
    if (this._invuln > 0) this._invuln -= dt;
    if (this._comboTimer > 0) { this._comboTimer -= dt; if (this._comboTimer <= 0) h.combo = 0; }
    if (this._soakTimer > 0) {
      this._soakTimer -= dt;
      if (this._soakTimer <= 0) h.isSoaking = false;
    } else {
      h.isSoaking = false;
    }
    if (h.berserkActive) {
      h.berserkRemaining -= dt;
      if (h.berserkRemaining <= 0) {
        h.berserkRemaining = 0;
        h.berserkActive = false;
        this.markDirty();
        this.getStats();
        this.emit('berserk', { active: false });
        this.emit('change');
      }
    }
    if (this.skills) this.skills.update(dt);
    if (this.inventory) this.inventory.update(dt);
    if (h.dead) return;
    let s = this.getStats();
    // buffs & DoT/HoT
    if (h.buffs.length > 0) {
      let expired = false;
      for (let i = 0; i < h.buffs.length; i++) {
        const b = h.buffs[i];
        b.remaining -= dt;
        b._tick += dt;
        while (b._tick >= 1) {
          b._tick -= 1;
          if (b.hot) this.heal(num(b.hot.hps), num(b.hot.mps));
          if (b.dot) this.takeDamage(num(b.dot.dps), { raw: true, canDodge: false, canBlock: false, ignoreInvuln: true, noDot: true });
        }
        if (b.remaining <= 0) expired = true;
      }
      if (h.dead) return;
      if (expired) {
        const goneIds = this._expiredBuffIds;
        goneIds.length = 0;
        let writeIdx = 0;
        for (let i = 0; i < h.buffs.length; i++) {
          const b = h.buffs[i];
          if (b.remaining > 0) {
            h.buffs[writeIdx++] = b;
          } else {
            goneIds.push(b.id);
          }
        }
        h.buffs.length = writeIdx;
        this.markDirty();
        this.clampVitals();
        s = this.getStats();
        for (let i = 0; i < goneIds.length; i++) this.emit('buff', goneIds[i], false);
      }
    }
    if (h.dead) return;
    // regeneration
    const hp0 = h.hp, mp0 = h.mp;
    if (h.hp < s.maxHp) h.hp = Math.min(s.maxHp, h.hp + s.hpRegen * dt);
    if (h.mp < s.maxMp) h.mp = Math.min(s.maxMp, h.mp + s.mpRegen * dt);
    if (this._staminaDelay > 0) this._staminaDelay -= dt;
    else if (h.stamina < s.maxStamina) h.stamina = Math.min(s.maxStamina, h.stamina + s.staminaRegen * dt);
    this._regenAcc += dt;
    if (this._regenAcc > 0.25 && (h.hp !== hp0 || h.mp !== mp0)) {
      this._regenAcc = 0;
      this.emit('hp', h.hp, s.maxHp);
      this.emit('mp', h.mp, s.maxMp);
    }
  }

  // -------------------------------------------------------------- snapshot for UI
  /**
   * Low-/zero-allocation summary for 60fps HUD updates. Populates and returns `out`
   * (defaulting to the internal `_hudSummaryCache`) without cloning appearance,
   * attributes, nemesis, or buff arrays.
   */
  getHudSummary(out = this._hudSummaryCache) {
    const target = out && typeof out === 'object' ? out : this._hudSummaryCache;
    const s = this.getStats();
    const h = this.hero;
    const cls = this.heroClass;
    const charge = h.berserkCharge || 0;
    const mpFloor = Math.floor(h.mp);

    target.name = h.name;
    target.classId = cls.id;
    target.className = cls.name;
    target.classIcon = cls.icon;
    target.classColor = cls.css;
    target.attackStyle = cls.attackStyle;
    target.appearance = h.appearance || null;
    target.level = h.level;
    target.hp = Math.ceil(h.hp);
    target.maxHp = s.maxHp;
    target.mp = mpFloor;
    target.maxMp = s.maxMp;
    target.sp = mpFloor;
    target.maxSp = s.maxMp;
    target.stamina = Math.floor(h.stamina);
    target.maxStamina = s.maxStamina;
    target.combo = h.combo;
    target.exp = h.exp;
    target.expToNext = expToNext(h.level);
    target.gold = h.gold;
    target.ap = h.ap;
    target.skillPoints = h.sp;
    target.berserkCharge = charge;
    target.berserkActive = !!h.berserkActive;
    target.berserkRemaining = Math.max(0, h.berserkRemaining || 0);
    target.berserkOrbs = berserkOrbs(charge);
    target.restedExp = h.restedExp || 0;
    target.isSoaking = !!h.isSoaking;
    target.nemesis = this._nemesis || null;
    target.nemesisKills = h.nemesisKills || 0;
    const statsOut = target.stats && typeof target.stats === 'object'
      ? target.stats
      : (target.stats = { str: 0, dex: 0, int: 0, lck: 0 });
    statsOut.str = s.str;
    statsOut.dex = s.dex;
    statsOut.int = s.int;
    statsOut.lck = s.lck;
    target.baseStats = h.attrs;
    target.derived = s;
    target.buffs = h.buffs.length > 0 ? h.buffs : EMPTY_HUD_BUFFS;
    target.dead = h.dead;
    target.floor = this.progress.currentFloor;
    target.maxFloor = this.progress.maxFloor;
    return target;
  }

  getPlayerSnapshot() {
    const s = this.getStats();
    const h = this.hero;
    const cls = this.heroClass;
    return {
      name: h.name,
      classId: cls.id,
      className: cls.name,
      classIcon: cls.icon,
      classColor: cls.css,
      attackStyle: cls.attackStyle,
      appearance: { ...(h.appearance || sanitizeAppearance(null, cls.id)) },
      level: h.level,
      hp: Math.ceil(h.hp), maxHp: s.maxHp,
      mp: Math.floor(h.mp), maxMp: s.maxMp,
      sp: Math.floor(h.mp), maxSp: s.maxMp, // UI calls mana "SP"
      stamina: Math.floor(h.stamina), maxStamina: s.maxStamina,
      combo: h.combo,
      exp: h.exp, expToNext: expToNext(h.level),
      gold: h.gold,
      ap: h.ap,
      skillPoints: h.sp,
      berserkCharge: h.berserkCharge || 0,
      berserkActive: !!h.berserkActive,
      berserkRemaining: Math.max(0, h.berserkRemaining || 0),
      berserkOrbs: berserkOrbs(h.berserkCharge || 0),
      restedExp: h.restedExp || 0,
      isSoaking: !!h.isSoaking,
      nemesis: this._nemesis ? { ...this._nemesis } : null,
      nemesisKills: h.nemesisKills || 0,
      stats: { str: s.str, dex: s.dex, int: s.int, lck: s.lck },
      baseStats: { ...h.attrs },
      derived: s,
      buffs: h.buffs.map((b) => ({ id: b.id, name: b.name, icon: b.icon, remaining: Math.max(0, b.remaining), duration: b.duration, debuff: b.debuff, imbue: b.imbue || null, stacks: b.stacks, desc: b.desc })),
      dead: h.dead,
      floor: this.progress.currentFloor,
      maxFloor: this.progress.maxFloor,
    };
  }

  // -------------------------------------------------------------- save / load
  toJSON() {
    return {
      version: SAVE_VERSION,
      savedAt: Date.now(),
      hero: { ...this.hero, buffs: this.hero.buffs.map((b) => ({ ...b })) },
      progress: JSON.parse(JSON.stringify(this.progress)),
      nemesis: this._nemesis ? { ...this._nemesis } : null,
      inventory: this.inventory.toJSON(),
      skills: this.skills.toJSON(),
      quests: this.quests.toJSON(),
      pets: this.pets ? this.pets.toJSON() : null,
    };
  }

  fromJSON(d) {
    if (!d || typeof d !== 'object' || !d.hero) throw new Error('Invalid save data');
    const savedClass = isValidClass(d.hero.classId) ? String(d.hero.classId).toLowerCase() : DEFAULT_CLASS;
    this._newHero(d.hero.name, savedClass, d.hero.appearance);
    const { classId: _c, appearance: _a, ...heroRest } = d.hero;
    Object.assign(this.hero, heroRest);
    this.hero.classId = savedClass;
    this.hero.appearance = sanitizeAppearance(d.hero.appearance, savedClass);
    this.hero.attrs = { ...getClass(savedClass).startAttrs, ...(d.hero.attrs || {}) };
    this.hero.buffs = Array.isArray(d.hero.buffs) ? d.hero.buffs : [];
    this.hero.berserkCharge = Number(d.hero.berserkCharge) || 0;
    this.hero.berserkActive = Boolean(d.hero.berserkActive);
    this.hero.berserkRemaining = Number(d.hero.berserkRemaining) || 0;
    this.hero.restedExp = Number(d.hero.restedExp) || 0;
    this.hero.isSoaking = false;
    this.hero.nemesisKills = Number(d.hero.nemesisKills) || 0;
    this.hero.townTraining = { might: 0, arcana: 0, vitality: 0, agility: 0, fortune: 0, ...(d.hero.townTraining || {}) };
    this._nemesis = d.nemesis ? { ...d.nemesis } : null;
    Object.assign(this.progress, d.progress || {});
    this.progress.storyCompleted = Boolean(this.progress.storyCompleted);
    if (!Array.isArray(this.progress.floorsCleared)) this.progress.floorsCleared = [];
    if (!Array.isArray(this.progress.storyChronicles) || this.progress.storyChronicles.length === 0) {
      this.progress.storyChronicles = [
        {
          floor: 0,
          title: STORY_CHRONICLES[0].title,
          summary: STORY_CHRONICLES[0].summary,
          cleared: this.progress.maxFloor >= 1
        }
      ];
      for (const cf of this.progress.floorsCleared) {
        const meta = STORY_CHRONICLES[cf];
        if (meta) this.progress.storyChronicles.push({ floor: cf, title: meta.title, summary: meta.summary, cleared: true });
      }
    }
    this.inventory.classId = savedClass;
    this.inventory.fromJSON(d.inventory || {});
    this.inventory.classId = savedClass;

    // Repair any mismatched starter weapons/shields from older saves so each class holds its signature gear
    const eq = this.inventory.equipment;
    const cls = getClass(savedClass);
    const starter = cls.starter || {};
    if (!eq.weapon || !canClassUse(savedClass, eq.weapon).ok) {
      if (starter.weapon) {
        eq.weapon = generateItem({ baseId: starter.weapon, rarity: 'normal', level: 1, classId: savedClass });
      }
    }
    if ((savedClass === 'archer' || savedClass === 'wizard' || cls.twoHanded || !cls.shield) && eq.shield) {
      eq.shield = null;
    } else if (savedClass === 'axeman' && (!eq.shield || eq.shield.baseId === 'shield_1' || String(eq.shield.subtype || eq.shield.subType || '').toLowerCase() !== 'axe')) {
      eq.shield = createOffhandAxe(0) || eq.shield;
    }
    // Older saves rendered staves as Chinese spears and offhand axes as glaives: refresh weapon visuals
    const refreshVisual = (it) => {
      if (!it) return;
      const sub = String(it.subtype || it.subType || '').toLowerCase();
      if ((it.slot === 'weapon' || it.slot === 'shield') && (sub === 'staff' || sub === 'axe' || sub === 'blade')) applyVisualMetadata(it);
    };
    Object.values(eq).forEach(refreshVisual);
    (this.inventory.bag || []).forEach(refreshVisual);

    this.skills.fromJSON(d.skills || {});
    this.quests.fromJSON(d.quests || {});
    if (d.pets && this.pets) this.pets.fromJSON(d.pets);
    this.markDirty();
    this.clampVitals();
    if (this.hero.hp <= 0) this.fullRestore();
    this.emit('loaded');
    this.emit('change');
    return this;
  }

  save(slot = this.activeSlot) {
    try {
      const json = JSON.stringify(this.toJSON());
      if (!this.storage) return { ok: false, msg: 'Saving unavailable (no localStorage)' };
      this.storage.setItem(SAVE_PREFIX + slot, json);
      this.activeSlot = slot;
      this.emit('saved', slot);
      this.emit('toast', 'Game saved', 'info');
      return { ok: true, msg: 'Game saved' };
    } catch (e) {
      return { ok: false, msg: 'Save failed: ' + e.message };
    }
  }

  load(slot = 0) {
    try {
      if (!this.storage) return { ok: false, msg: 'No storage' };
      const raw = this.storage.getItem(SAVE_PREFIX + slot);
      if (!raw) return { ok: false, msg: 'No save found' };
      this.fromJSON(JSON.parse(raw));
      this.activeSlot = slot;
      this.emit('toast', 'Game loaded', 'info');
      return { ok: true, msg: 'Game loaded' };
    } catch (e) {
      console.error('[gameState] load failed', e);
      return { ok: false, msg: 'Load failed: ' + e.message };
    }
  }

  hasSave(slot = 0) {
    try { return !!(this.storage && this.storage.getItem(SAVE_PREFIX + slot)); } catch { return false; }
  }

  getSaveInfo(slot = 0) {
    try {
      const d = JSON.parse(this.storage.getItem(SAVE_PREFIX + slot));
      if (!d) return null;
      const cls = getClass(d.hero.classId);
      return { level: d.hero.level, name: d.hero.name, gold: d.hero.gold, savedAt: d.savedAt, maxFloor: d.progress?.maxFloor || 0, classId: cls.id, className: cls.name, classIcon: cls.icon };
    } catch { return null; }
  }

  deleteSave(slot = 0) { try { this.storage && this.storage.removeItem(SAVE_PREFIX + slot); } catch { /* ignore */ } }

  /** Start a brand new character (does not delete saves unless wipeSave). */
  reset({ wipeSave = false, heroName } = {}) {
    if (wipeSave) this.deleteSave(0);
    this._nemesis = null;
    this._soakTimer = 0;
    this._lastGoldLost = 0;
    this._newHero(heroName || this.hero.name, this.hero.classId, this.hero.appearance);
    this.inventory = new Inventory(this);
    this.skills = new SkillSystem(this);
    this.quests = new QuestSystem(this);
    this.pets = new PetSystem(this);
    this.inventory.grantStarterKit(this.hero.classId);
    this.skills.grantStarterSkills(this.hero.classId);
    this.fullRestore();
    this.emit('reset');
    this.emit('change');
    return this;
  }

  /** Create a brand new character of a permanent class (character-creation screen). */
  newCharacter({ name, classId, appearance, slot = 0 } = {}) {
    const cid = isValidClass(classId) ? String(classId).toLowerCase() : DEFAULT_CLASS;
    const heroName = String(name == null ? '' : name).trim().slice(0, 16) || 'Hero';
    this.activeSlot = slot;
    this._nemesis = null;
    this._soakTimer = 0;
    this._lastGoldLost = 0;
    this._newHero(heroName, cid, appearance);
    this.inventory = new Inventory(this);
    this.skills = new SkillSystem(this);
    this.quests = new QuestSystem(this);
    this.pets = new PetSystem(this);
    this.markDirty();
    this.inventory.grantStarterKit(cid);
    this.skills.grantStarterSkills(cid);
    this.fullRestore();
    this.emit('reset');
    this.emit('equip');
    this.emit('change');
    return this;
  }

  /** Mark the main story as completed upon defeating the Final Sovereign (Aetherion, Sky Sovereign on Floor 16). */
  completeStory(boss = null) {
    const firstTime = !this.progress.storyCompleted;
    this.progress.storyCompleted = true;
    const bossName = (boss && (boss.name || boss.id)) || 'Aetherion, Sky Sovereign';
    if (!this.progress.bossesDefeated.includes(bossName)) {
      this.progress.bossesDefeated.push(bossName);
    }
    const bonusGold = firstTime ? 25000 : 0;
    const bonusExp = firstTime ? 12000 : 0;
    if (firstTime) {
      this.addGold(bonusGold);
      this.addExp(bonusExp);
      this.markDirty();
    }
    this.emit('story:complete', { firstTime, bossName, bonusGold, bonusExp });
    this.emit('change');
    return { ok: true, firstTime, bossName, bonusGold, bonusExp };
  }
}

// =============================================================================
// Extracted data integration (tolerant of unknown schemas)
// =============================================================================
export function applyExtractedData(data) {
  if (!data || typeof data !== 'object') return;
  const prog = data.progression || data.hero || data.player || data.formulas || {};
  const pick = (...keys) => { for (const k of keys) { const v = prog[k] ?? data[k]; if (v != null) return v; } return undefined; };
  const maxLevel = pick('maxLevel', 'levelCap');
  if (Number(maxLevel) > 1) PROGRESSION.maxLevel = Number(maxLevel);
  const apl = pick('apPerLevel', 'statPointsPerLevel', 'attributePointsPerLevel');
  if (Number(apl) > 0) PROGRESSION.apPerLevel = Number(apl);
  const spl = pick('spPerLevel', 'skillPointsPerLevel');
  if (Number(spl) > 0) PROGRESSION.spPerLevel = Number(spl);
  const sg = pick('startGold', 'startingGold');
  if (Number(sg) >= 0 && sg != null) PROGRESSION.startGold = Number(sg);
  let table = pick('expTable', 'experienceTable', 'expCurve');
  if (table && !Array.isArray(table) && typeof table === 'object') table = table.table || table.values;
  if (Array.isArray(table) && table.length > 5 && table.every((v) => Number(v) >= 0)) {
    // accept cumulative tables too
    const nums = table.map(Number);
    const cumulative = nums.every((v, i) => i === 0 || v >= nums[i - 1]) && nums[nums.length - 1] > nums[1] * 20;
    PROGRESSION.expTable = cumulative ? nums.slice(1).map((v, i) => Math.max(1, v - nums[i])).filter((v) => v > 0) : nums.filter((v) => v > 0);
  }
  const sa = pick('startAttrs', 'startStats', 'baseStats');
  if (sa && typeof sa === 'object') {
    for (const a of ATTRIBUTES) {
      const v = sa[a] ?? sa[a.toUpperCase()] ?? sa[ATTRIBUTE_INFO[a].name.toLowerCase()];
      if (Number(v) > 0) PROGRESSION.startAttrs[a] = Number(v);
    }
  }
  try { applyItemData(data); } catch (e) { console.warn('[gameState] item data merge failed', e); }
  try { applySkillData(data); } catch (e) { console.warn('[gameState] skill data merge failed', e); }
  try { applyQuestData(data); } catch (e) { console.warn('[gameState] quest data merge failed', e); }
}

// =============================================================================
// Factories
// =============================================================================
export function createGame(opts = {}) {
  if (typeof opts === 'string') opts = { classId: opts };
  else if (opts && !opts.data && (opts.items || opts.skills || opts.monsters || opts.quests)) opts = { data: opts }; // createGame(data)
  return new GameState(opts || {});
}
export const createGameState = (dataOrOpts) => createGame(dataOrOpts);

/** Shared default instance (main.js may use this or create its own). Call gameState.applyData(data) to merge data later. */
export const gameState = new GameState();
GameState.prototype.applyData = function (data) {
  applyExtractedData(data);
  this.data = data;
  this.inventory.restockShops(true);
  this.markDirty();
  this.emit('change');
  return this;
};

/**
 * Builds the `host` adapter expected by src/ui (hud.js / menus.js, see board #8).
 * `extras` supplies world/engine parts: getMinimap, getBoss, getPrompt, getFloors,
 * teleportToFloor, dropItem, onSave, etc. and overrides any default.
 */
export function createUIHost(game, extras = {}) {
  const inv = () => game.inventory;
  const res = (r, okMsg) => (r && typeof r === 'object' ? r : { ok: !!r, msg: r ? okMsg : 'Failed' });
  const host = {
    game,
    getPlayer: () => game.getPlayerSnapshot(),
    getHudSummary: (out) => game.getHudSummary(out),
    getStats: () => game.getStats(),
    getSkillBar: () => game.skills.getSkillBar(),
    fillSkillBar: (out) => game.skills.fillSkillBar(out),
    getPotionSlots: () => inv().getQuickSlotView(),
    getInventory: () => inv().getView(),
    getSkills: () => game.skills.getTreeView(),
    getQuests: () => game.quests.getLogView(),
    getShop: (npcId) => inv().getShop(npcId),
    getStorage: () => inv().getStorageView(),
    getComposePreview: (uids) => inv().previewCompose(uids),
    getUpgradePreview: (uid, mats) => inv().previewUpgrade(uid, mats),
    getTooltip: (itemOrUid) => inv().getTooltip(itemOrUid),
    getCompare: (uid) => inv().compareWithEquipped(uid),
    getNpcDialogue: (npcId) => game.quests.getNpcDialogue(npcId),
    getQuestDialogue: (questId) => game.quests.getQuestDialogue(questId),
    getRecipes: () => inv().getRecipes(),
    getStoryChronicles: () => game.getStoryChronicles(),
    getFloors: () => {
      const max = game.unlockedMaxFloor;
      const out = [];
      for (let f = 1; f <= Math.max(max, 1); f++) {
        out.push({
          floor: f,
          name: `Floor ${f}`,
          unlocked: f <= max,
          cleared: (game.progress.floorsCleared || []).includes(f),
          minDungeonLevel: 10,
          recommendedLevel: floorMonsterLevel(f)
        });
      }
      return out;
    },
    getMinimap: () => null,
    getBoss: () => null,
    getPrompt: () => null,
    spendAP: (stat, n) => game.allocate(stat, n),
    equip: (uid) => inv().equip(uid),
    unequip: (slot) => inv().unequip(slot),
    dropItem: (uid) => inv().drop(uid),
    sellItem: (uid, qty) => inv().sell(uid, qty),
    buyItem: (npcId, idx, qty) => inv().buy(npcId, idx, qty),
    useItem: (uid) => inv().useItem(uid),
    usePotion: (slotIdx) => inv().useQuickSlot(slotIdx),
    assignPotion: (slotIdx, uidOrBaseId) => inv().assignQuickSlot(slotIdx, uidOrBaseId),
    compose: (uids) => inv().compose(uids),
    upgradeItem: (uid, matUids) => inv().upgrade(uid, matUids),
    sortBag: () => res(inv().sortBag(), 'Sorted'),
    deposit: (uid) => inv().deposit(uid),
    withdraw: (uid) => inv().withdraw(uid),
    depositGold: (amt) => inv().depositGold(amt),
    withdrawGold: (amt) => inv().withdrawGold(amt),
    depositMaterials: (mode = 'material') => inv().depositAllByFilter(mode),
    levelSkill: (id) => game.skills.learn(id),
    assignSkill: (id, slotIdx) => game.skills.assign(slotIdx, id),
    castSkillSlot: (i) => game.skills.castSlot(i),
    acceptQuest: (id) => game.quests.accept(id),
    turnInQuest: (id) => game.quests.turnIn(id),
    abandonQuest: (id) => game.quests.abandon(id),
    dialogueAction: (action) => game.quests.handleDialogueAction(action),
    teleportToFloor: () => ({ ok: false, msg: 'Teleport unavailable' }),
    activateBerserk: () => game.activateBerserk(),
    addBerserkCharge: (amt) => game.addBerserkCharge(amt),
    getNemesis: () => game.nemesis,
    claimNemesisVengeance: (enemy) => game.claimNemesisVengeance(enemy),
    soakInHotSprings: (dt) => game.soakInHotSprings(dt),
    getTownHallView: () => game.getTownHallView(),
    trainTownMastery: (key) => game.trainTownMastery(key),
    buyTownBlessing: (key) => game.buyTownBlessing(key),
    expandBag: () => inv().expandBag(),
    expandStorage: () => inv().expandStorage(),
    getSocketForgeCost: (uid) => inv().getSocketForgeCost(uid),
    forgeAddSocket: (uid) => inv().forgeAddSocket(uid),
    getReforgeCost: (uid) => inv().getReforgeCost(uid),
    forgeReforgeAffixes: (uid) => inv().forgeReforgeAffixes(uid),
    trainActivePet: (cost, expGain) => game.pets.trainActivePetWithGold(cost, expGain),
    save: () => game.save(game.activeSlot),
    load: () => game.load(game.activeSlot),
    reset: () => { game.reset(); return { ok: true, msg: 'New game started' }; },
    on: (evt, fn) => game.on(evt, fn),
  };
  return Object.assign(host, extras);
}

export { RARITY, SLOTS, getItemBase, BERSERK, berserkOrbs, NEMESIS, createNemesisTitle, HOT_SPRINGS };

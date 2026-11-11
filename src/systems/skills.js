// =============================================================================
// ASJ (ARKENVEIL: SIGILS & JOURNEYS) - Battle & Passive Skill System.
// Owned by rpg-systems. Pure logic (no DOM / three.js).
// =============================================================================

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const num = (v, d = 0) => (typeof v === 'number' && isFinite(v) ? v : Number.isFinite(Number(v)) && v !== '' && v != null ? Number(v) : d);
const slug = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

export const DEFAULT_HOTBAR_KEYS = ['1', '2', '3', '4', '5'];

/** 4-stage melee combo descriptors for basic attacks (J / Left Click). */
export const BASIC_COMBO = [
  { stage: 0, name: 'Slash', mult: 1.0, range: 2.3, angle: 1.7, duration: 0.26, knockback: 1.2, stun: 0.1, staminaCost: 0, color: 0xffffff, vfx: 'slash', shake: 0.08 },
  { stage: 1, name: 'Cross Slash', mult: 1.15, range: 2.4, angle: 1.9, duration: 0.28, knockback: 1.5, stun: 0.12, staminaCost: 0, color: 0xffe08a, vfx: 'slash', shake: 0.1 },
  { stage: 2, name: 'Spinning Cleave', mult: 1.35, range: 2.6, angle: 2.8, duration: 0.32, knockback: 2.2, stun: 0.18, staminaCost: 0, color: 0xffaa44, vfx: 'spin', shake: 0.16 },
  { stage: 3, name: 'Crushing Finisher', mult: 1.75, range: 2.9, angle: 2.2, duration: 0.4, knockback: 3.8, stun: 0.45, staminaCost: 0, color: 0xff5522, vfx: 'slam', shake: 0.3 },
];

/** Canonical ASJ skill definitions (Battle & Passive trees). */
export const SKILL_DEFS = {
  // ============================================================== BATTLE TREE
  // Row 0 (Tier 1)
  power_strike: {
    id: 'power_strike', name: 'Power Strike', icon: '⚔️', tree: 'Battle', type: 'active', kind: 'melee_arc',
    tier: 1, row: 0, col: 0, maxLevel: 10, reqLevel: 1, requires: [],
    spCostBase: 8, spCostPerLv: 1.5, cooldown: 3.5, cooldownPerLv: -0.08,
    multBase: 1.65, multPerLv: 0.18, range: 2.8, radius: 2.8, angle: 1.9, knockback: 3.0, stun: 0.5,
    color: 0xffcc44, vfx: 'power_strike', shake: 0.28,
    desc: 'Unleash a heavy downward strike in a frontal arc with high knockback and brief stun.',
  },
  whirlwind: {
    id: 'whirlwind', name: 'Whirlwind', icon: '🌀', tree: 'Battle', type: 'active', kind: 'nova',
    tier: 1, row: 0, col: 1, maxLevel: 10, reqLevel: 2, requires: [],
    spCostBase: 12, spCostPerLv: 2, cooldown: 5.5, cooldownPerLv: -0.12,
    multBase: 1.35, multPerLv: 0.15, hits: 2, range: 3.2, radius: 3.2, angle: Math.PI * 2, knockback: 2.2, stun: 0.25,
    color: 0x66ccff, vfx: 'whirlwind', shake: 0.22,
    desc: 'Spin fiercely with your weapon, striking all nearby enemies twice.',
  },
  battle_cry: {
    id: 'battle_cry', name: 'Battle Cry', icon: '📯', tree: 'Battle', type: 'buff', kind: 'buff',
    tier: 1, row: 0, col: 2, maxLevel: 10, reqLevel: 2, requires: [],
    spCostBase: 14, spCostPerLv: 2, cooldown: 16, cooldownPerLv: -0.3,
    multBase: 0, multPerLv: 0, range: 3.5, radius: 3.5,
    buff: (lv) => ({
      id: 'battle_cry', name: 'Battle Cry', icon: '📯', duration: 14 + lv * 1.5,
      mods: { atkPct: 18 + lv * 3.5, defPct: 15 + lv * 3 },
    }),
    color: 0xffaa22, vfx: 'aura_gold', shake: 0.18,
    desc: 'Let out a war cry that boosts your Attack and Defense for a duration.',
  },

  // Row 1 (Tier 2)
  flame_slash: {
    id: 'flame_slash', name: 'Flame Slash', icon: '🔥', tree: 'Battle', type: 'active', kind: 'melee_arc', element: 'fire',
    tier: 2, row: 1, col: 0, maxLevel: 10, reqLevel: 5, requires: ['power_strike'],
    spCostBase: 14, spCostPerLv: 2, cooldown: 5.0, cooldownPerLv: -0.1,
    multBase: 1.9, multPerLv: 0.2, range: 3.3, radius: 3.3, angle: 2.2, knockback: 2.6, stun: 0.35,
    color: 0xff5522, vfx: 'flame_slash', shake: 0.3,
    desc: 'Sweep a blazing arc of fire across enemies in front of you, dealing heavy Fire damage.',
  },
  shield_bash: {
    id: 'shield_bash', name: 'Shield Rush', icon: '🛡️', tree: 'Battle', type: 'active', kind: 'dash',
    tier: 2, row: 1, col: 1, maxLevel: 10, reqLevel: 5, requires: ['whirlwind'],
    spCostBase: 13, spCostPerLv: 1.5, cooldown: 6.5, cooldownPerLv: -0.15,
    multBase: 1.5, multPerLv: 0.16, range: 5.5, radius: 2.2, distance: 5.5, knockback: 3.8, stun: 1.1, stunPerLv: 0.1,
    invuln: 0.45, color: 0x88ddff, vfx: 'dash_strike', shake: 0.26,
    desc: 'Charge forward behind your shield, crashing through foes and stunning them.',
  },
  healing_light: {
    id: 'healing_light', name: 'Healing Light', icon: '💚', tree: 'Battle', type: 'active', kind: 'heal',
    tier: 2, row: 1, col: 2, maxLevel: 10, reqLevel: 6, requires: ['battle_cry'],
    spCostBase: 18, spCostPerLv: 2.5, cooldown: 12, cooldownPerLv: -0.25,
    healPctBase: 0.24, healPctPerLv: 0.03,
    buff: (lv) => ({
      id: 'healing_light', name: 'Regeneration', icon: '💚', duration: 6,
      hot: { hps: 6 + lv * 4 },
    }),
    color: 0x55ff88, vfx: 'heal', shake: 0.1,
    desc: 'Channel restorative energy to immediately recover Max HP and regenerate health over 6s.',
  },

  // Row 2 (Tier 3)
  frost_nova: {
    id: 'frost_nova', name: 'Frost Nova', icon: '❄️', tree: 'Battle', type: 'active', kind: 'nova', element: 'ice',
    tier: 3, row: 2, col: 0, maxLevel: 10, reqLevel: 10, requires: ['flame_slash'],
    spCostBase: 20, spCostPerLv: 2.5, cooldown: 7.5, cooldownPerLv: -0.15,
    multBase: 1.8, multPerLv: 0.19, range: 4.2, radius: 4.2, angle: Math.PI * 2, knockback: 1.8, stun: 1.4, stunPerLv: 0.1,
    color: 0x6fd4ff, vfx: 'frost_nova', shake: 0.3,
    desc: 'Erupt a ring of glacial spikes around you, dealing Ice damage and freezing enemies in place.',
  },
  thunder_wave: {
    id: 'thunder_wave', name: 'Thunder Wave', icon: '⚡', tree: 'Battle', type: 'active', kind: 'projectile', element: 'lightning',
    tier: 3, row: 2, col: 1, maxLevel: 10, reqLevel: 11, requires: ['shield_bash'],
    spCostBase: 18, spCostPerLv: 2.2, cooldown: 6.0, cooldownPerLv: -0.12,
    multBase: 1.75, multPerLv: 0.19, range: 8.5, radius: 2.8, angle: 1.4, count: 3, speed: 15, knockback: 2.0, stun: 0.6,
    color: 0xffee44, vfx: 'lightning', shake: 0.28,
    desc: 'Unleash surging bolts of lightning forward that shock and stun enemies in a cone.',
  },
  shadow_step: {
    id: 'shadow_step', name: 'Berserk Trance', icon: '🩸', tree: 'Battle', type: 'buff', kind: 'buff',
    tier: 3, row: 2, col: 2, maxLevel: 10, reqLevel: 12, requires: ['healing_light'],
    spCostBase: 22, spCostPerLv: 2.5, cooldown: 20, cooldownPerLv: -0.35,
    buff: (lv) => ({
      id: 'berserk_trance', name: 'Berserk Trance', icon: '🩸', duration: 11 + lv * 1.0,
      mods: { critRate: 12 + lv * 2, attackSpeedPct: 20 + lv * 3, lifeSteal: 4 + lv * 1, moveSpeedPct: 12 + lv },
    }),
    color: 0xff3355, vfx: 'aura_red', shake: 0.2,
    desc: 'Enter a crimson battle trance that greatly increases Crit Rate, Attack Speed, Move Speed, and Life Steal.',
  },

  // Row 3 (Tier 4 - Ultimates)
  meteor_drop: {
    id: 'meteor_drop', name: 'Meteor Impact', icon: '☄️', tree: 'Battle', type: 'active', kind: 'aoe', element: 'fire',
    tier: 4, row: 3, col: 0, maxLevel: 10, reqLevel: 18, requires: ['frost_nova'],
    spCostBase: 30, spCostPerLv: 3.5, cooldown: 11, cooldownPerLv: -0.2,
    multBase: 2.6, multPerLv: 0.28, range: 5.0, radius: 4.5, angle: Math.PI * 2, knockback: 4.5, stun: 1.2,
    color: 0xff4400, vfx: 'meteor', shake: 0.5,
    desc: 'Call down a cataclysmic meteor that shatters the ground for massive AoE Fire damage.',
  },
  blade_storm: {
    id: 'blade_storm', name: 'Arkenveil Judgment', icon: '🌩️', tree: 'Battle', type: 'active', kind: 'nova', element: 'lightning',
    tier: 4, row: 3, col: 1, maxLevel: 10, reqLevel: 20, requires: ['thunder_wave'],
    spCostBase: 34, spCostPerLv: 4, cooldown: 13, cooldownPerLv: -0.25,
    multBase: 2.85, multPerLv: 0.32, hits: 3, range: 5.0, radius: 5.0, angle: Math.PI * 2, knockback: 3.5, stun: 1.0,
    armorPierce: 0.35, invuln: 0.6, color: 0xffe066, vfx: 'judgment', shake: 0.55,
    desc: 'Ultimate technique: summon a storm of sacred blades and lightning around you, piercing 35% armor.',
  },
  aegis_barrier: {
    id: 'aegis_barrier', name: 'Divine Aegis', icon: '✨', tree: 'Battle', type: 'buff', kind: 'buff',
    tier: 4, row: 3, col: 2, maxLevel: 10, reqLevel: 18, requires: ['shadow_step'],
    spCostBase: 28, spCostPerLv: 3, cooldown: 24, cooldownPerLv: -0.4,
    healPctBase: 0.25, healPctPerLv: 0.02,
    buff: (lv) => ({
      id: 'divine_aegis', name: 'Divine Aegis', icon: '✨', duration: 12 + lv * 1.2,
      mods: { defPct: 45 + lv * 5, atkPct: 25 + lv * 3, allRes: 20 + lv * 2, hpRegen: 5 + lv * 2 },
    }),
    invuln: 1.0, color: 0xffee88, vfx: 'aegis', shake: 0.25,
    desc: 'Wreathe yourself in golden light, healing HP and granting massive Attack, Defense, and All Resistances.',
  },

  // ============================================================= PASSIVE TREE
  // Row 0 (Tier 1)
  weapon_mastery: {
    id: 'weapon_mastery', name: 'Weapon Mastery', icon: '🗡️', tree: 'Passive', type: 'passive', kind: 'passive',
    tier: 1, row: 0, col: 0, maxLevel: 10, reqLevel: 1, requires: [],
    passive: (lv) => ({ atkPct: lv * 4, matkPct: lv * 4, hit: lv * 2 }),
    desc: 'Hones your weapon technique, permanently increasing Attack (+4%/Lv), Magic Attack (+4%/Lv), and Hit (+2/Lv).',
  },
  vitality: {
    id: 'vitality', name: 'Vitality', icon: '❤️', tree: 'Passive', type: 'passive', kind: 'passive',
    tier: 1, row: 0, col: 1, maxLevel: 10, reqLevel: 1, requires: [],
    passive: (lv) => ({ hpPct: lv * 5, hp: lv * 12, hpRegen: lv * 0.4 }),
    desc: 'Fortifies your body, permanently increasing Max HP (+5% & +12/Lv) and HP Regeneration (+0.4/s per Lv).',
  },
  spirit_flow: {
    id: 'spirit_flow', name: 'Spirit Flow', icon: '🔷', tree: 'Passive', type: 'passive', kind: 'passive',
    tier: 1, row: 0, col: 2, maxLevel: 10, reqLevel: 1, requires: [],
    passive: (lv) => ({ mpPct: lv * 5, mp: lv * 8, mpRegen: lv * 0.35 }),
    desc: 'Expands your inner spirit, permanently increasing Max SP (+5% & +8/Lv) and SP Regeneration (+0.35/s per Lv).',
  },

  // Row 1 (Tier 2)
  lethal_focus: {
    id: 'lethal_focus', name: 'Lethal Focus', icon: '🎯', tree: 'Passive', type: 'passive', kind: 'passive',
    tier: 2, row: 1, col: 0, maxLevel: 10, reqLevel: 6, requires: ['weapon_mastery'],
    passive: (lv) => ({ critRate: lv * 1.5, critDmg: lv * 6 }),
    desc: 'Sharpens your eye for weak points: +1.5% Crit Rate and +6% Crit Damage per level.',
  },
  iron_skin: {
    id: 'iron_skin', name: 'Iron Resolve', icon: '🛡️', tree: 'Passive', type: 'passive', kind: 'passive',
    tier: 2, row: 1, col: 1, maxLevel: 10, reqLevel: 6, requires: ['vitality'],
    passive: (lv) => ({ defPct: lv * 5, def: lv * 4, block: lv * 1.5 }),
    desc: 'Hardens your stance in battle: +5% Defense, +4 flat Defense, and +1.5% Block Chance per level.',
  },
  swift_footwork: {
    id: 'swift_footwork', name: 'Swift Footwork', icon: '🥾', tree: 'Passive', type: 'passive', kind: 'passive',
    tier: 2, row: 1, col: 2, maxLevel: 10, reqLevel: 6, requires: ['spirit_flow'],
    passive: (lv) => ({ moveSpeedPct: lv * 2, attackSpeedPct: lv * 2.5, dodge: lv * 1.2, staminaRegen: lv * 1.5 }),
    desc: 'Lightens your step: +2% Move Speed, +2.5% Attack Speed, and +1.2% Dodge per level.',
  },

  // Row 2 (Tier 3)
  bloodthirst: {
    id: 'bloodthirst', name: 'Bloodthirst', icon: '🧛', tree: 'Passive', type: 'passive', kind: 'passive',
    tier: 3, row: 2, col: 0, maxLevel: 10, reqLevel: 14, requires: ['lethal_focus'],
    passive: (lv) => ({ lifeSteal: lv * 1.2, atkPct: lv * 2 }),
    desc: 'Every strike drains life from foes: +1.2% Life Steal and +2% Attack per level.',
  },
  elemental_ward: {
    id: 'elemental_ward', name: 'Elemental Ward', icon: '🔰', tree: 'Passive', type: 'passive', kind: 'passive',
    tier: 3, row: 2, col: 1, maxLevel: 10, reqLevel: 14, requires: ['iron_skin'],
    passive: (lv) => ({ allRes: lv * 3.5, thorns: lv * 4 }),
    desc: 'Wards against the elements: +3.5% All Elemental Resistances and +4 Thorns damage per level.',
  },
  treasure_hunter: {
    id: 'treasure_hunter', name: "Fortune's Favor", icon: '🍀', tree: 'Passive', type: 'passive', kind: 'passive',
    tier: 3, row: 2, col: 2, maxLevel: 10, reqLevel: 14, requires: ['swift_footwork'],
    passive: (lv) => ({ magicFind: lv * 6, goldFind: lv * 7, expBonus: lv * 2, cdr: lv * 1.5 }),
    desc: 'Blesses your journey: +6% Magic Find, +7% Gold Find, +2% EXP Bonus, and +1.5% Cooldown Reduction per level.',
  },
};

export const SKILLS = SKILL_DEFS;

export function registerSkill(def) {
  if (!def || !def.id) return null;
  SKILL_DEFS[def.id] = { ...SKILL_DEFS[def.id], ...def };
  return SKILL_DEFS[def.id];
}

export function getSkillDef(id) {
  return SKILL_DEFS[id] || null;
}

// =============================================================================
// SkillSystem
// =============================================================================
export class SkillSystem {
  constructor(game = null) {
    this.game = game;
    this.levels = {};
    this.cooldowns = {};
    this.cooldownTotals = {};
    this.hotbar = ['power_strike', null, null, null, null];
  }

  // ---- compatibility aliases -----------------------------------------------
  get equippedSkills() { return this.hotbar; }
  set equippedSkills(v) { if (Array.isArray(v)) this.hotbar = v.slice(0, 5).concat([null, null, null, null, null]).slice(0, 5); }
  get skills() { return this.getTreeView(); }

  _emit(...a) { if (this.game) this.game.emit(...a); }
  _changed(statsToo = false) {
    if (this.game) {
      if (statsToo) { this.game.markDirty(); this.game.clampVitals(); }
      this.game.emit('skills');
      this.game.emit('change');
    }
  }
  _heroLevel() { return this.game ? this.game.hero.level : 1; }
  _sp() { return this.game ? this.game.hero.sp : 0; }

  grantStarterSkills() {
    this.levels = { power_strike: 1 };
    this.cooldowns = {};
    this.cooldownTotals = {};
    this.hotbar = ['power_strike', null, null, null, null];
    if (this.game) this.game.markDirty();
  }

  get(id) { return this.getSkillView(id); }
  getLevel(id) { return this.levels[id] | 0; }

  /** Compute effective SP (mana) cost at a given skill level. */
  getSpCost(id, lv = null) {
    const def = SKILL_DEFS[id];
    if (!def || def.type === 'passive') return 0;
    const L = Math.max(1, lv != null ? lv : (this.getLevel(id) || 1));
    return Math.max(1, Math.round(num(def.spCostBase, num(def.spCost, 10)) + num(def.spCostPerLv, 0) * (L - 1)));
  }

  /** Compute effective cooldown (seconds) at a given skill level, factoring hero CDR. */
  getBaseCooldown(id, lv = null) {
    const def = SKILL_DEFS[id];
    if (!def || def.type === 'passive') return 0;
    const L = Math.max(1, lv != null ? lv : (this.getLevel(id) || 1));
    const raw = Math.max(0.5, num(def.cooldown, 4) + num(def.cooldownPerLv, 0) * (L - 1));
    const cdr = this.game ? num(this.game.getStats().cooldownReduction, 0) : 0;
    return Math.round(Math.max(0.4, raw * (1 - clamp(cdr, 0, 50) / 100)) * 10) / 10;
  }

  /** Compute effective damage multiplier at a given skill level. */
  getDamageMult(id, lv = null) {
    const def = SKILL_DEFS[id];
    if (!def) return 1;
    const L = Math.max(1, lv != null ? lv : (this.getLevel(id) || 1));
    return Math.round((num(def.multBase, 1.4) + num(def.multPerLv, 0.15) * (L - 1)) * 100) / 100;
  }

  /** Check if a skill can be learned/upgraded right now. */
  canLearn(id) {
    const def = SKILL_DEFS[id];
    if (!def) return { ok: false, reason: 'Unknown skill' };
    const lv = this.getLevel(id);
    const maxLv = def.maxLevel || 10;
    if (lv >= maxLv) return { ok: false, reason: 'Max level reached' };
    const reqHeroLv = (def.reqLevel || 1) + lv * 2;
    if (this._heroLevel() < reqHeroLv) return { ok: false, reason: `Requires Hero Lv ${reqHeroLv}` };
    for (const req of def.requires || []) {
      const reqId = typeof req === 'object' ? req.id : req;
      const reqLv = typeof req === 'object' ? (req.level || 1) : 1;
      if (this.getLevel(reqId) < reqLv) {
        const rName = SKILL_DEFS[reqId]?.name || reqId;
        return { ok: false, reason: `Requires ${rName} Lv ${reqLv}` };
      }
    }
    if (this._sp() < 1) return { ok: false, reason: 'Need 1 Skill Point (SP)' };
    return { ok: true, reason: '' };
  }

  /** Spend 1 SP to learn or upgrade `id`. */
  learn(id) {
    const check = this.canLearn(id);
    if (!check.ok) return { ok: false, msg: check.reason, reason: check.reason };
    const def = SKILL_DEFS[id];
    if (this.game) this.game.hero.sp = Math.max(0, this.game.hero.sp - 1);
    const newLv = (this.levels[id] | 0) + 1;
    this.levels[id] = newLv;
    // Auto-assign newly learned active/buff skill to the first empty hotbar slot
    if (newLv === 1 && def.type !== 'passive' && !this.hotbar.includes(id)) {
      const empty = this.hotbar.indexOf(null);
      if (empty >= 0) this.hotbar[empty] = id;
    }
    this._emit('skill:learned', id, newLv);
    this._changed(def.type === 'passive');
    return { ok: true, msg: `${def.name} upgraded to Lv ${newLv}!`, level: newLv };
  }
  learnOrUpgradeSkill(id) { return this.learn(id); }
  levelSkill(id) { return this.learn(id); }

  /**
   * Assign an active/buff skill to a hotbar slot (0..4).
   * Accepts both `assign(slotIdx, skillId)` and `assign(skillId, slotIdx)`.
   */
  assign(slotOrId, idOrSlot) {
    let slot, id;
    if (typeof slotOrId === 'number' || (/^[0-4]$/.test(String(slotOrId)) && typeof idOrSlot === 'string' && !/^[0-4]$/.test(idOrSlot))) {
      slot = Number(slotOrId);
      id = idOrSlot;
    } else {
      id = slotOrId;
      slot = Number(idOrSlot);
    }
    if (!Number.isInteger(slot) || slot < 0 || slot >= 5) return { ok: false, msg: 'Invalid hotkey slot' };
    if (!id) {
      this.hotbar[slot] = null;
      this._changed();
      return { ok: true, msg: `Cleared slot ${slot + 1}` };
    }
    const def = SKILL_DEFS[id];
    if (!def) return { ok: false, msg: 'Unknown skill' };
    if (def.type === 'passive') return { ok: false, msg: 'Passive skills are always active' };
    if (this.getLevel(id) <= 0) return { ok: false, msg: 'Learn this skill first' };
    for (let i = 0; i < this.hotbar.length; i++) if (this.hotbar[i] === id) this.hotbar[i] = null;
    this.hotbar[slot] = id;
    this._changed();
    return { ok: true, msg: `Assigned ${def.name} to slot ${slot + 1}` };
  }
  assignSkillSlot(slotOrId, idOrSlot) { return this.assign(slotOrId, idOrSlot); }

  /** Refund all spent skill points. */
  resetAll() {
    let refund = 0;
    for (const [id, lv] of Object.entries(this.levels)) {
      refund += id === 'power_strike' ? Math.max(0, lv - 1) : lv;
    }
    this.levels = { power_strike: 1 };
    this.hotbar = ['power_strike', null, null, null, null];
    if (this.game) this.game.hero.sp += refund;
    this._changed(true);
    return refund;
  }

  /** Aggregate passive stat bonuses across all learned passive skills. */
  getPassiveBonuses() {
    const mods = {};
    for (const [id, lv] of Object.entries(this.levels)) {
      if (lv <= 0) continue;
      const def = SKILL_DEFS[id];
      if (!def || typeof def.passive !== 'function') continue;
      const b = def.passive(lv) || {};
      for (const [k, v] of Object.entries(b)) {
        if (typeof v === 'number') mods[k] = (mods[k] || 0) + v;
      }
    }
    return mods;
  }

  // ---- Cooldowns & Casting ---------------------------------------------------
  update(dt) {
    dt = clamp(num(dt), 0, 0.5);
    for (const id of Object.keys(this.cooldowns)) {
      if (this.cooldowns[id] > 0) {
        this.cooldowns[id] = Math.max(0, this.cooldowns[id] - dt);
      }
    }
  }
  updateCooldowns(dt) { this.update(dt); }

  getCooldown(id) {
    const remaining = Math.max(0, num(this.cooldowns[id], 0));
    const total = Math.max(remaining, num(this.cooldownTotals[id], this.getBaseCooldown(id)));
    return { remaining, total, pct: total > 0 ? remaining / total : 0, ready: remaining <= 0 };
  }

  _resolveSkillId(idOrSlot) {
    if (typeof idOrSlot === 'number' || /^[0-4]$/.test(String(idOrSlot))) {
      return this.hotbar[Number(idOrSlot)] || null;
    }
    return idOrSlot || null;
  }

  canCast(idOrSlot) {
    const id = this._resolveSkillId(idOrSlot);
    if (!id) return { ok: false, reason: 'No skill assigned' };
    const def = SKILL_DEFS[id];
    if (!def) return { ok: false, reason: 'Unknown skill' };
    if (def.type === 'passive') return { ok: false, reason: 'Passive skill' };
    const lv = this.getLevel(id);
    if (lv <= 0) return { ok: false, reason: 'Skill not learned' };
    if (this.game && this.game.hero.dead) return { ok: false, reason: 'You are dead' };
    const cd = this.getCooldown(id);
    if (cd.remaining > 0.05) return { ok: false, reason: `On cooldown (${cd.remaining.toFixed(1)}s)` };
    const cost = this.getSpCost(id, lv);
    if (this.game && this.game.hero.mp < cost) return { ok: false, reason: 'Not enough SP' };
    return { ok: true, id, level: lv, spCost: cost };
  }
  canUseSkill(idOrSlot) { return this.canCast(idOrSlot).ok; }

  /**
   * Consume SP, start cooldown, apply self-buff/heal effects, and return an
   * execution descriptor for `playerController.js` to animate and hit-test in 3D.
   */
  cast(idOrSlot) {
    const check = this.canCast(idOrSlot);
    if (!check.ok) return null;
    const { id, level, spCost } = check;
    const def = SKILL_DEFS[id];
    const g = this.game;
    if (g) g.useMp(spCost);
    const totalCd = this.getBaseCooldown(id, level);
    this.cooldowns[id] = totalCd;
    this.cooldownTotals[id] = totalCd;

    let healed = 0;
    if (g && (def.healPctBase || def.healFlat)) {
      const pct = num(def.healPctBase, 0) + num(def.healPctPerLv, 0) * (level - 1);
      const amount = Math.round(g.maxHp * pct + num(def.healFlat, 0) * level);
      healed = g.heal(amount, 0).hp;
    }
    let buffApplied = null;
    if (g && typeof def.buff === 'function') {
      const b = def.buff(level);
      if (b) { g.addBuff(b); buffApplied = b; }
    }
    if (g && def.invuln) g.setInvulnerable(def.invuln);

    const mult = this.getDamageMult(id, level);
    const stun = def.stun ? Math.round((def.stun + num(def.stunPerLv, 0) * (level - 1)) * 100) / 100 : 0;
    const descriptor = {
      ok: true,
      id: def.id,
      skillId: def.id,
      name: def.name,
      icon: def.icon,
      level,
      type: def.type,
      kind: def.kind,
      element: def.element || 'physical',
      color: def.color || 0xffaa33,
      vfx: def.vfx || def.id,
      vfxType: def.vfx || def.id,
      mult,
      damageMultiplier: mult,
      flatDamage: num(def.flat, 0) * level,
      hits: def.hits || 1,
      range: def.range || 3.0,
      radius: def.radius || def.range || 3.0,
      angle: def.angle || 2.0,
      distance: def.distance || 5.0,
      count: def.count || 1,
      speed: def.speed || 14,
      duration: def.castDuration || 0.38,
      stun,
      knockback: def.knockback || 2.0,
      armorPierce: def.armorPierce || 0,
      shake: def.shake || 0.25,
      spCost,
      mpCost: spCost,
      cooldown: totalCd,
      healed,
      buff: buffApplied,
      rollDamage: (targetDefStats = {}) => (g
        ? g.rollAttack(targetDefStats, {
          mult,
          element: def.element || null,
          magic: !!def.magic,
          armorPierce: def.armorPierce || 0,
        })
        : { damage: Math.round(20 * mult), crit: false, miss: false, element: def.element || null }),
    };
    this._emit('skill:cast', descriptor);
    return descriptor;
  }
  useSkill(idOrSlot) { return this.cast(idOrSlot); }
  castSlot(slotIdx) { return this.cast(Number(slotIdx)); }

  // ---- UI Views --------------------------------------------------------------
  getSkillView(id) {
    const def = SKILL_DEFS[id];
    if (!def) return null;
    const level = this.getLevel(id);
    const check = this.canLearn(id);
    const spCost = this.getSpCost(id, Math.max(1, level));
    const cooldown = this.getBaseCooldown(id, Math.max(1, level));
    const cd = this.getCooldown(id);
    const mult = def.multBase ? Math.round(this.getDamageMult(id, Math.max(1, level)) * 100) : 0;
    const effectNote = mult ? ` (${mult}% DMG)` : '';
    return {
      id: def.id,
      skillId: def.id,
      name: def.name,
      desc: def.desc + effectNote,
      icon: def.icon || '✨',
      tree: def.tree || (def.type === 'passive' ? 'Passive' : 'Battle'),
      type: def.type,
      kind: def.kind,
      element: def.element || null,
      tier: def.tier || 1,
      row: def.row ?? 0,
      col: def.col ?? 0,
      level,
      maxLevel: def.maxLevel || 10,
      reqLevel: (def.reqLevel || 1) + level * 2,
      requires: (def.requires || []).slice(),
      spCost,
      mpCost: spCost,
      cooldown,
      cooldownRemaining: cd.remaining,
      canLevel: check.ok,
      reason: check.reason,
    };
  }

  list(tree = null) {
    const all = Object.keys(SKILL_DEFS).map((id) => this.getSkillView(id));
    return tree ? all.filter((s) => s.tree.toLowerCase() === String(tree).toLowerCase()) : all;
  }
  getTreeView() { return this.list(); }

  getSkillBar() {
    return DEFAULT_HOTBAR_KEYS.map((key, i) => {
      const id = this.hotbar[i];
      if (!id || !SKILL_DEFS[id]) return null;
      const def = SKILL_DEFS[id];
      const level = Math.max(1, this.getLevel(id));
      const cd = this.getCooldown(id);
      const spCost = this.getSpCost(id, level);
      return {
        slot: i,
        key,
        id: def.id,
        skillId: def.id,
        name: def.name,
        icon: def.icon || '✨',
        level,
        cooldown: cd.remaining,
        cooldownMax: cd.total || this.getBaseCooldown(id, level),
        spCost,
        mpCost: spCost,
        ready: cd.ready && (!this.game || this.game.hero.mp >= spCost),
      };
    });
  }

  // ---- Save / Load -----------------------------------------------------------
  toJSON() {
    return {
      levels: { ...this.levels },
      hotbar: this.hotbar.slice(0, 5),
    };
  }

  fromJSON(d = {}) {
    this.levels = { power_strike: 1, ...(d.levels || {}) };
    if (Array.isArray(d.hotbar)) {
      this.hotbar = d.hotbar.slice(0, 5).map((id) => (id && SKILL_DEFS[id] ? id : null));
      while (this.hotbar.length < 5) this.hotbar.push(null);
    }
    this.cooldowns = {};
    this.cooldownTotals = {};
    if (this.game) this.game.markDirty();
  }
}

export const Skills = SkillSystem;
export const createSkillSystem = (game) => new SkillSystem(game);

// =============================================================================
// Extracted SWF data merge (tolerant of schema variations)
// =============================================================================
export function applySkillData(data) {
  if (!data || typeof data !== 'object') return 0;
  const raw = data.skills || data.skillTree || data.abilities;
  const list = Array.isArray(raw)
    ? raw
    : raw && typeof raw === 'object'
      ? [
        ...(Array.isArray(raw.active) ? raw.active : []),
        ...(Array.isArray(raw.passive) ? raw.passive : []),
        ...(Array.isArray(raw.battle) ? raw.battle : []),
        ...(Array.isArray(raw.list) ? raw.list : []),
        ...Object.entries(raw).filter(([, v]) => v && typeof v === 'object' && !Array.isArray(v)).map(([k, v]) => ({ id: v.id || k, ...v })),
      ]
      : [];
  let count = 0;
  for (const s of list) {
    if (!s || typeof s !== 'object' || !s.name) continue;
    const id = s.id && SKILL_DEFS[s.id] ? s.id : Object.keys(SKILL_DEFS).find((k) => slug(SKILL_DEFS[k].name) === slug(s.name)) || null;
    if (id && SKILL_DEFS[id]) {
      const def = SKILL_DEFS[id];
      if (s.desc || s.description) def.desc = String(s.desc || s.description);
      if (Number(s.maxLevel) > 0) def.maxLevel = Number(s.maxLevel);
      if (Number(s.spCost || s.mpCost || s.manaCost) > 0) def.spCostBase = Number(s.spCost || s.mpCost || s.manaCost);
      if (Number(s.cooldown || s.cd) > 0) def.cooldown = Number(s.cooldown || s.cd);
      if (Number(s.reqLevel || s.requiredLevel) > 0) def.reqLevel = Number(s.reqLevel || s.requiredLevel);
      count++;
    }
  }
  return count;
}

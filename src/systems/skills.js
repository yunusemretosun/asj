// =============================================================================
// ASJ (ARKENVEIL: SIGILS & JOURNEYS) - Battle & Passive Skill System.
// Owned by rpg-systems. Pure logic (no DOM / three.js).
// =============================================================================

import { DEFAULT_CLASS, getClass } from './classes.js';

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
    id: 'power_strike', name: 'Power Strike', icon: '⚔️', tree: 'Knight', classes: ['knight'], type: 'active', kind: 'melee_arc',
    tier: 1, row: 0, col: 0, maxLevel: 10, reqLevel: 1, requires: [],
    spCostBase: 8, spCostPerLv: 1.5, cooldown: 3.5, cooldownPerLv: -0.08,
    multBase: 1.65, multPerLv: 0.18, range: 2.8, radius: 2.8, angle: 1.9, knockback: 3.0, stun: 0.5,
    color: 0xffcc44, vfx: 'power_strike', shake: 0.28,
    desc: 'Unleash a heavy downward strike in a frontal arc with high knockback and brief stun.',
  },
  whirlwind: {
    id: 'whirlwind', name: 'Whirlwind', icon: '🌀', tree: 'Knight', classes: ['knight'], type: 'active', kind: 'nova',
    tier: 1, row: 0, col: 1, maxLevel: 10, reqLevel: 2, requires: [],
    spCostBase: 12, spCostPerLv: 2, cooldown: 5.5, cooldownPerLv: -0.12,
    multBase: 1.35, multPerLv: 0.15, hits: 2, range: 3.2, radius: 3.2, angle: Math.PI * 2, knockback: 2.2, stun: 0.25,
    color: 0x66ccff, vfx: 'whirlwind', shake: 0.22,
    desc: 'Spin fiercely with your weapon, striking all nearby enemies twice.',
  },
  battle_cry: {
    id: 'battle_cry', name: 'Battle Cry', icon: '📯', tree: 'Knight', classes: ['knight'], type: 'buff', kind: 'buff',
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
    id: 'flame_slash', name: 'Flame Slash', icon: '🔥', tree: 'Knight', classes: ['knight'], type: 'active', kind: 'melee_arc', element: 'fire',
    tier: 2, row: 1, col: 0, maxLevel: 10, reqLevel: 5, requires: ['power_strike'],
    spCostBase: 14, spCostPerLv: 2, cooldown: 5.0, cooldownPerLv: -0.1,
    multBase: 1.9, multPerLv: 0.2, range: 3.3, radius: 3.3, angle: 2.2, knockback: 2.6, stun: 0.35,
    color: 0xff5522, vfx: 'flame_slash', shake: 0.3,
    desc: 'Sweep a blazing arc of fire across enemies in front of you, dealing heavy Fire damage.',
  },
  shield_bash: {
    id: 'shield_bash', name: 'Shield Rush', icon: '🛡️', tree: 'Knight', classes: ['knight'], type: 'active', kind: 'dash',
    tier: 2, row: 1, col: 1, maxLevel: 10, reqLevel: 5, requires: ['whirlwind'],
    spCostBase: 13, spCostPerLv: 1.5, cooldown: 6.5, cooldownPerLv: -0.15,
    multBase: 1.5, multPerLv: 0.16, range: 5.5, radius: 2.2, distance: 5.5, knockback: 3.8, stun: 1.1, stunPerLv: 0.1,
    invuln: 0.45, color: 0x88ddff, vfx: 'dash_strike', shake: 0.26,
    desc: 'Charge forward behind your shield, crashing through foes and stunning them.',
  },
  healing_light: {
    id: 'healing_light', name: 'Healing Light', icon: '💚', tree: 'Knight', classes: ['knight'], type: 'active', kind: 'heal',
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
    id: 'frost_nova', name: 'Frost Nova', icon: '❄️', tree: 'Knight', classes: ['knight'], type: 'active', kind: 'nova', element: 'ice',
    tier: 3, row: 2, col: 0, maxLevel: 10, reqLevel: 10, requires: ['flame_slash'],
    spCostBase: 20, spCostPerLv: 2.5, cooldown: 7.5, cooldownPerLv: -0.15,
    multBase: 1.8, multPerLv: 0.19, range: 4.2, radius: 4.2, angle: Math.PI * 2, knockback: 1.8, stun: 1.4, stunPerLv: 0.1,
    color: 0x6fd4ff, vfx: 'frost_nova', shake: 0.3,
    desc: 'Erupt a ring of glacial spikes around you, dealing Ice damage and freezing enemies in place.',
  },
  thunder_wave: {
    id: 'thunder_wave', name: 'Thunder Wave', icon: '⚡', tree: 'Knight', classes: ['knight'], type: 'active', kind: 'projectile', element: 'lightning',
    tier: 3, row: 2, col: 1, maxLevel: 10, reqLevel: 11, requires: ['shield_bash'],
    spCostBase: 18, spCostPerLv: 2.2, cooldown: 6.0, cooldownPerLv: -0.12,
    multBase: 1.75, multPerLv: 0.19, range: 8.5, radius: 2.8, angle: 1.4, count: 3, speed: 15, knockback: 2.0, stun: 0.6,
    color: 0xffee44, vfx: 'lightning', shake: 0.28,
    desc: 'Unleash surging bolts of lightning forward that shock and stun enemies in a cone.',
  },
  shadow_step: {
    id: 'shadow_step', name: 'Berserk Trance', icon: '🩸', tree: 'Knight', classes: ['knight'], type: 'buff', kind: 'buff',
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
    id: 'meteor_drop', name: 'Meteor Impact', icon: '☄️', tree: 'Knight', classes: ['knight'], type: 'active', kind: 'aoe', element: 'fire',
    tier: 4, row: 3, col: 0, maxLevel: 10, reqLevel: 18, requires: ['frost_nova'],
    spCostBase: 30, spCostPerLv: 3.5, cooldown: 11, cooldownPerLv: -0.2,
    multBase: 2.6, multPerLv: 0.28, range: 5.0, radius: 4.5, angle: Math.PI * 2, knockback: 4.5, stun: 1.2,
    color: 0xff4400, vfx: 'meteor', shake: 0.5,
    desc: 'Call down a cataclysmic meteor that shatters the ground for massive AoE Fire damage.',
  },
  blade_storm: {
    id: 'blade_storm', name: 'Arkenveil Judgment', icon: '🌩️', tree: 'Knight', classes: ['knight'], type: 'active', kind: 'nova', element: 'lightning',
    tier: 4, row: 3, col: 1, maxLevel: 10, reqLevel: 20, requires: ['thunder_wave'],
    spCostBase: 34, spCostPerLv: 4, cooldown: 13, cooldownPerLv: -0.25,
    multBase: 2.85, multPerLv: 0.32, hits: 3, range: 5.0, radius: 5.0, angle: Math.PI * 2, knockback: 3.5, stun: 1.0,
    armorPierce: 0.35, invuln: 0.6, color: 0xffe066, vfx: 'judgment', shake: 0.55,
    desc: 'Ultimate technique: summon a storm of sacred blades and lightning around you, piercing 35% armor.',
  },
  aegis_barrier: {
    id: 'aegis_barrier', name: 'Divine Aegis', icon: '✨', tree: 'Knight', classes: ['knight'], type: 'buff', kind: 'buff',
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

  // ============================================================= PASSIVE TREE (shared by all classes)
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


const PI2 = Math.PI * 2;

/** Class skill trees (Axeman / Wizard / Archer). Knight skills live in SKILL_DEFS above. */
Object.assign(SKILL_DEFS, {
  // ============================================================== AXEMAN TREE
  ax_cleave: {
    id: 'ax_cleave', name: 'Cleave', icon: '🪓', tree: 'Axeman', classes: ['axeman'], type: 'active', kind: 'melee_arc',
    tier: 1, row: 0, col: 0, maxLevel: 10, reqLevel: 1, requires: [],
    spCostBase: 8, spCostPerLv: 1.5, cooldown: 3.5, cooldownPerLv: -0.08,
    multBase: 1.75, multPerLv: 0.2, range: 3.1, radius: 3.1, angle: 2.4, knockback: 3.0, stun: 0.4,
    color: 0xff7744, vfx: 'power_strike', shake: 0.3,
    desc: 'Swing your axe in a wide, brutal arc that hits every foe in front of you.',
  },
  ax_ground_slam: {
    id: 'ax_ground_slam', name: 'Ground Slam', icon: '💥', tree: 'Axeman', classes: ['axeman'], type: 'active', kind: 'aoe',
    tier: 1, row: 0, col: 1, maxLevel: 10, reqLevel: 2, requires: [],
    spCostBase: 12, spCostPerLv: 2, cooldown: 5.5, cooldownPerLv: -0.12,
    multBase: 1.5, multPerLv: 0.17, range: 2.5, radius: 3.4, angle: PI2, knockback: 2.4, stun: 0.7,
    color: 0xcc8844, vfx: 'slam', shake: 0.35,
    desc: 'Smash the ground ahead of you, damaging and stunning enemies caught in the shockwave.',
  },
  ax_war_bellow: {
    id: 'ax_war_bellow', name: 'War Bellow', icon: '📣', tree: 'Axeman', classes: ['axeman'], type: 'buff', kind: 'buff',
    tier: 1, row: 0, col: 2, maxLevel: 10, reqLevel: 2, requires: [],
    spCostBase: 14, spCostPerLv: 2, cooldown: 16, cooldownPerLv: -0.3,
    multBase: 0, multPerLv: 0, range: 3.5, radius: 3.5,
    buff: (lv) => ({
      id: 'war_bellow', name: 'War Bellow', icon: '📣', duration: 14 + lv * 1.5,
      mods: { atkPct: 20 + lv * 3.5, critDmg: 15 + lv * 3 },
    }),
    color: 0xff5533, vfx: 'aura_red', shake: 0.2,
    desc: 'Roar to the heavens, boosting your Attack and Critical Damage for a time.',
  },

  ax_rending_chop: {
    id: 'ax_rending_chop', name: 'Rending Chop', icon: '🔪', tree: 'Axeman', classes: ['axeman'], type: 'active', kind: 'melee_arc',
    tier: 2, row: 1, col: 0, maxLevel: 10, reqLevel: 5, requires: ['ax_cleave'],
    spCostBase: 14, spCostPerLv: 2, cooldown: 5.0, cooldownPerLv: -0.1,
    multBase: 2.1, multPerLv: 0.22, range: 3.0, radius: 3.0, angle: 1.4, knockback: 1.8, stun: 0.3, armorPierce: 0.25,
    color: 0xdd2233, vfx: 'slash', shake: 0.3,
    desc: 'A savage overhead chop that tears through armor, ignoring 25% of defense.',
  },
  ax_leaping_strike: {
    id: 'ax_leaping_strike', name: 'Leaping Strike', icon: '🦘', tree: 'Axeman', classes: ['axeman'], type: 'active', kind: 'dash',
    tier: 2, row: 1, col: 1, maxLevel: 10, reqLevel: 5, requires: ['ax_ground_slam'],
    spCostBase: 13, spCostPerLv: 1.5, cooldown: 6.5, cooldownPerLv: -0.15,
    multBase: 1.65, multPerLv: 0.18, range: 6.0, radius: 2.6, distance: 6.0, knockback: 3.4, stun: 0.9, stunPerLv: 0.08,
    invuln: 0.45, color: 0xffaa66, vfx: 'dash_strike', shake: 0.3,
    desc: 'Leap across the battlefield and crash down on your enemies, stunning them.',
  },
  ax_second_wind: {
    id: 'ax_second_wind', name: 'Second Wind', icon: '💚', tree: 'Axeman', classes: ['axeman'], type: 'active', kind: 'heal',
    tier: 2, row: 1, col: 2, maxLevel: 10, reqLevel: 6, requires: ['ax_war_bellow'],
    spCostBase: 18, spCostPerLv: 2.5, cooldown: 12, cooldownPerLv: -0.25,
    healPctBase: 0.26, healPctPerLv: 0.03,
    buff: (lv) => ({ id: 'second_wind', name: 'Second Wind', icon: '💚', duration: 6, hot: { hps: 6 + lv * 4 } }),
    color: 0x55ff88, vfx: 'heal', shake: 0.1,
    desc: 'Catch your breath, instantly recovering Max HP and regenerating health over 6s.',
  },

  ax_earthsplitter: {
    id: 'ax_earthsplitter', name: 'Earthsplitter', icon: '🌋', tree: 'Axeman', classes: ['axeman'], type: 'active', kind: 'aoe', element: 'fire',
    tier: 3, row: 2, col: 0, maxLevel: 10, reqLevel: 10, requires: ['ax_rending_chop'],
    spCostBase: 20, spCostPerLv: 2.5, cooldown: 7.5, cooldownPerLv: -0.15,
    multBase: 1.95, multPerLv: 0.21, range: 4.0, radius: 3.8, angle: PI2, knockback: 3.2, stun: 1.0,
    color: 0xff6622, vfx: 'flame_slash', shake: 0.4,
    desc: 'Cleave the earth open, sending a molten fissure that burns and stuns enemies.',
  },
  ax_reaver_spin: {
    id: 'ax_reaver_spin', name: 'Reaver Spin', icon: '🌀', tree: 'Axeman', classes: ['axeman'], type: 'active', kind: 'nova',
    tier: 3, row: 2, col: 1, maxLevel: 10, reqLevel: 11, requires: ['ax_leaping_strike'],
    spCostBase: 19, spCostPerLv: 2.3, cooldown: 6.5, cooldownPerLv: -0.13,
    multBase: 1.45, multPerLv: 0.16, hits: 3, range: 3.6, radius: 3.6, angle: PI2, knockback: 2.0, stun: 0.3,
    color: 0xffcc66, vfx: 'whirlwind', shake: 0.25,
    desc: 'Spin your axe in a whirling frenzy, striking all nearby enemies three times.',
  },
  ax_bloodrage: {
    id: 'ax_bloodrage', name: 'Bloodrage', icon: '🩸', tree: 'Axeman', classes: ['axeman'], type: 'buff', kind: 'buff',
    tier: 3, row: 2, col: 2, maxLevel: 10, reqLevel: 12, requires: ['ax_second_wind'],
    spCostBase: 22, spCostPerLv: 2.5, cooldown: 20, cooldownPerLv: -0.35,
    buff: (lv) => ({
      id: 'bloodrage', name: 'Bloodrage', icon: '🩸', duration: 11 + lv * 1.0,
      mods: { atkPct: 15 + lv * 2.5, attackSpeedPct: 18 + lv * 3, lifeSteal: 5 + lv * 1, moveSpeedPct: 10 + lv },
    }),
    color: 0xff3355, vfx: 'aura_red', shake: 0.2,
    desc: 'Give in to rage: more Attack, Attack Speed, Move Speed and Life Steal.',
  },

  ax_cyclone: {
    id: 'ax_cyclone', name: 'Cyclone of Axes', icon: '🌪️', tree: 'Axeman', classes: ['axeman'], type: 'active', kind: 'nova',
    tier: 4, row: 3, col: 0, maxLevel: 10, reqLevel: 18, requires: ['ax_earthsplitter'],
    spCostBase: 34, spCostPerLv: 4, cooldown: 13, cooldownPerLv: -0.25,
    multBase: 2.7, multPerLv: 0.3, hits: 3, range: 5.0, radius: 5.0, angle: PI2, knockback: 3.4, stun: 0.9,
    armorPierce: 0.3, invuln: 0.6, color: 0xffdd88, vfx: 'judgment', shake: 0.55,
    desc: 'Ultimate: become a whirling storm of steel, hitting everything around you four times.',
  },
  ax_executioner: {
    id: 'ax_executioner', name: "Executioner's Fall", icon: '☠️', tree: 'Axeman', classes: ['axeman'], type: 'active', kind: 'melee_arc',
    tier: 4, row: 3, col: 1, maxLevel: 10, reqLevel: 20, requires: ['ax_reaver_spin'],
    spCostBase: 30, spCostPerLv: 3.5, cooldown: 11, cooldownPerLv: -0.2,
    multBase: 3.2, multPerLv: 0.34, range: 3.6, radius: 3.6, angle: 1.8, knockback: 5.0, stun: 1.2,
    armorPierce: 0.2, color: 0xaa1122, vfx: 'meteor', shake: 0.55,
    desc: 'A single titanic blow that deals enormous damage to everything in front of you.',
  },
  ax_unbreakable: {
    id: 'ax_unbreakable', name: 'Unbreakable', icon: '🗿', tree: 'Axeman', classes: ['axeman'], type: 'buff', kind: 'buff',
    tier: 4, row: 3, col: 2, maxLevel: 10, reqLevel: 18, requires: ['ax_bloodrage'],
    spCostBase: 28, spCostPerLv: 3, cooldown: 24, cooldownPerLv: -0.4,
    healPctBase: 0.2, healPctPerLv: 0.02,
    buff: (lv) => ({
      id: 'unbreakable', name: 'Unbreakable', icon: '🗿', duration: 12 + lv * 1.2,
      mods: { defPct: 40 + lv * 5, atkPct: 20 + lv * 3, allRes: 15 + lv * 2, hpRegen: 5 + lv * 2 },
    }),
    invuln: 1.0, color: 0xddbb88, vfx: 'aegis', shake: 0.25,
    desc: 'Harden your will: heal, and gain massive Defense, Attack and All Resistances.',
  },

  // ============================================================== WIZARD TREE (magic: true => MATK)
  wz_arcane_missiles: {
    id: 'wz_arcane_missiles', name: 'Arcane Missiles', icon: '✨', tree: 'Wizard', classes: ['wizard'], type: 'active', kind: 'projectile', magic: true,
    tier: 1, row: 0, col: 0, maxLevel: 10, reqLevel: 1, requires: [],
    spCostBase: 8, spCostPerLv: 1.5, cooldown: 3.0, cooldownPerLv: -0.07,
    multBase: 0.55, multPerLv: 0.06, range: 11, radius: 1.2, angle: 0.4, count: 3, speed: 18, knockback: 1.0, stun: 0.15,
    color: 0xc084fc, vfx: 'lightning', shake: 0.1,
    desc: 'Fire a volley of three homing-quick arcane bolts.',
  },
  wz_fireball: {
    id: 'wz_fireball', name: 'Fireball', icon: '🔥', tree: 'Wizard', classes: ['wizard'], type: 'active', kind: 'projectile', magic: true, element: 'fire',
    tier: 1, row: 0, col: 1, maxLevel: 10, reqLevel: 2, requires: [],
    spCostBase: 12, spCostPerLv: 2, cooldown: 4.5, cooldownPerLv: -0.1,
    multBase: 2.2, multPerLv: 0.24, range: 12, radius: 2.6, angle: 0, count: 1, speed: 15, knockback: 2.4, stun: 0.3,
    color: 0xff5522, vfx: 'flame_slash', shake: 0.25,
    desc: 'Hurl a blazing orb that explodes on impact, burning enemies around it.',
  },
  wz_mana_ward: {
    id: 'wz_mana_ward', name: 'Mana Ward', icon: '🔮', tree: 'Wizard', classes: ['wizard'], type: 'buff', kind: 'buff',
    tier: 1, row: 0, col: 2, maxLevel: 10, reqLevel: 2, requires: [],
    spCostBase: 14, spCostPerLv: 2, cooldown: 16, cooldownPerLv: -0.3,
    multBase: 0, multPerLv: 0,
    buff: (lv) => ({
      id: 'mana_ward', name: 'Mana Ward', icon: '🔮', duration: 14 + lv * 1.5,
      mods: { matkPct: 18 + lv * 3.5, defPct: 12 + lv * 3, mpRegen: 1 + lv * 0.4 },
    }),
    color: 0x8888ff, vfx: 'aura_gold', shake: 0.15,
    desc: 'Surround yourself with warding magic: more Magic Attack, Defense and SP regeneration.',
  },

  wz_glacial_nova: {
    id: 'wz_glacial_nova', name: 'Glacial Nova', icon: '❄️', tree: 'Wizard', classes: ['wizard'], type: 'active', kind: 'nova', magic: true, element: 'ice',
    tier: 2, row: 1, col: 0, maxLevel: 10, reqLevel: 5, requires: ['wz_arcane_missiles'],
    spCostBase: 16, spCostPerLv: 2.2, cooldown: 6.5, cooldownPerLv: -0.14,
    multBase: 1.8, multPerLv: 0.2, range: 4.2, radius: 4.2, angle: PI2, knockback: 2.0, stun: 1.4, stunPerLv: 0.1,
    color: 0x6fd4ff, vfx: 'frost_nova', shake: 0.25,
    desc: 'Release a ring of frost that damages and freezes enemies around you.',
  },
  wz_blink: {
    id: 'wz_blink', name: 'Blink', icon: '💨', tree: 'Wizard', classes: ['wizard'], type: 'active', kind: 'dash', magic: true,
    tier: 2, row: 1, col: 1, maxLevel: 10, reqLevel: 5, requires: ['wz_fireball'],
    spCostBase: 12, spCostPerLv: 1.2, cooldown: 6.0, cooldownPerLv: -0.2,
    multBase: 0.9, multPerLv: 0.1, range: 7.0, radius: 2.2, distance: 7.0, knockback: 2.8, stun: 0.5,
    invuln: 0.5, color: 0xa5b4fc, vfx: 'dash_strike', shake: 0.12,
    desc: 'Teleport a short distance, becoming briefly untouchable and shocking enemies at the start.',
  },
  wz_arcane_renewal: {
    id: 'wz_arcane_renewal', name: 'Arcane Renewal', icon: '💚', tree: 'Wizard', classes: ['wizard'], type: 'active', kind: 'heal',
    tier: 2, row: 1, col: 2, maxLevel: 10, reqLevel: 6, requires: ['wz_mana_ward'],
    spCostBase: 18, spCostPerLv: 2.5, cooldown: 12, cooldownPerLv: -0.25,
    healPctBase: 0.24, healPctPerLv: 0.03,
    buff: (lv) => ({ id: 'arcane_renewal', name: 'Arcane Renewal', icon: '💚', duration: 6, hot: { hps: 5 + lv * 4, mps: 2 + lv } }),
    color: 0x55ff88, vfx: 'heal', shake: 0.1,
    desc: 'Mend your wounds with arcane energy, restoring HP now and HP/SP over 6s.',
  },

  wz_chain_lightning: {
    id: 'wz_chain_lightning', name: 'Chain Lightning', icon: '⚡', tree: 'Wizard', classes: ['wizard'], type: 'active', kind: 'projectile', magic: true, element: 'lightning', pierce: true,
    tier: 3, row: 2, col: 0, maxLevel: 10, reqLevel: 10, requires: ['wz_glacial_nova'],
    spCostBase: 20, spCostPerLv: 2.4, cooldown: 6.0, cooldownPerLv: -0.12,
    multBase: 1.5, multPerLv: 0.17, range: 12, radius: 1.6, angle: 0.9, count: 3, speed: 22, knockback: 1.6, stun: 0.6,
    color: 0xffee44, vfx: 'lightning', shake: 0.28,
    desc: 'Fling piercing lightning forks that shock every enemy along their path.',
  },
  wz_inferno_ring: {
    id: 'wz_inferno_ring', name: 'Inferno Ring', icon: '⭕', tree: 'Wizard', classes: ['wizard'], type: 'active', kind: 'aoe', magic: true, element: 'fire',
    tier: 3, row: 2, col: 1, maxLevel: 10, reqLevel: 11, requires: ['wz_blink'],
    spCostBase: 22, spCostPerLv: 2.6, cooldown: 7.5, cooldownPerLv: -0.15,
    multBase: 1.9, multPerLv: 0.2, hits: 2, range: 6.0, radius: 4.0, angle: PI2, knockback: 2.0, stun: 0.4,
    color: 0xff7733, vfx: 'flame_slash', shake: 0.3,
    desc: 'Engulf a distant area in a ring of flame that burns enemies twice.',
  },
  wz_arcane_surge: {
    id: 'wz_arcane_surge', name: 'Arcane Surge', icon: '🌟', tree: 'Wizard', classes: ['wizard'], type: 'buff', kind: 'buff',
    tier: 3, row: 2, col: 2, maxLevel: 10, reqLevel: 12, requires: ['wz_arcane_renewal'],
    spCostBase: 22, spCostPerLv: 2.5, cooldown: 20, cooldownPerLv: -0.35,
    buff: (lv) => ({
      id: 'arcane_surge', name: 'Arcane Surge', icon: '🌟', duration: 11 + lv * 1.0,
      mods: { matkPct: 20 + lv * 3, critRate: 10 + lv * 2, cdr: 8 + lv, mpRegen: 2 + lv * 0.5 },
    }),
    color: 0xd8b4fe, vfx: 'aura_gold', shake: 0.2,
    desc: 'Overflow with power: more Magic Attack, Crit Rate, cooldown reduction and SP regeneration.',
  },

  wz_meteor: {
    id: 'wz_meteor', name: 'Meteor Fall', icon: '☄️', tree: 'Wizard', classes: ['wizard'], type: 'active', kind: 'aoe', magic: true, element: 'fire',
    tier: 4, row: 3, col: 0, maxLevel: 10, reqLevel: 18, requires: ['wz_chain_lightning'],
    spCostBase: 32, spCostPerLv: 3.8, cooldown: 11, cooldownPerLv: -0.2,
    multBase: 2.8, multPerLv: 0.3, range: 8.0, radius: 4.8, angle: PI2, knockback: 4.5, stun: 1.2,
    color: 0xff4400, vfx: 'meteor', shake: 0.5,
    desc: 'Ultimate: call a meteor from the sky to crush a large area with devastating Fire damage.',
  },
  wz_prism_beam: {
    id: 'wz_prism_beam', name: 'Prismatic Beam', icon: '🌈', tree: 'Wizard', classes: ['wizard'], type: 'active', kind: 'projectile', magic: true, pierce: true, element: 'lightning',
    tier: 4, row: 3, col: 1, maxLevel: 10, reqLevel: 20, requires: ['wz_inferno_ring'],
    spCostBase: 34, spCostPerLv: 4, cooldown: 13, cooldownPerLv: -0.25,
    multBase: 3.0, multPerLv: 0.33, range: 14, radius: 1.8, angle: 0, count: 1, speed: 34, knockback: 3.0, stun: 0.8,
    armorPierce: 0.35, color: 0xffe0ff, vfx: 'judgment', shake: 0.5,
    desc: 'Ultimate: unleash a piercing beam of pure magic that ignores 35% armor.',
  },
  wz_arcane_barrier: {
    id: 'wz_arcane_barrier', name: 'Arcane Barrier', icon: '🛡️', tree: 'Wizard', classes: ['wizard'], type: 'buff', kind: 'buff',
    tier: 4, row: 3, col: 2, maxLevel: 10, reqLevel: 18, requires: ['wz_arcane_surge'],
    spCostBase: 28, spCostPerLv: 3, cooldown: 24, cooldownPerLv: -0.4,
    healPctBase: 0.2, healPctPerLv: 0.02,
    buff: (lv) => ({
      id: 'arcane_barrier', name: 'Arcane Barrier', icon: '🛡️', duration: 12 + lv * 1.2,
      mods: { defPct: 50 + lv * 5, matkPct: 20 + lv * 3, allRes: 20 + lv * 2, hpRegen: 4 + lv * 2 },
    }),
    invuln: 1.2, color: 0xa5b4fc, vfx: 'aegis', shake: 0.2,
    desc: 'Wrap yourself in a shimmering barrier: heal, gain huge Defense and Resistances, and briefly become invulnerable.',
  },

  // ============================================================== ARCHER TREE
  ar_power_shot: {
    id: 'ar_power_shot', name: 'Power Shot', icon: '🏹', tree: 'Archer', classes: ['archer'], type: 'active', kind: 'projectile', pierce: true,
    tier: 1, row: 0, col: 0, maxLevel: 10, reqLevel: 1, requires: [],
    spCostBase: 8, spCostPerLv: 1.4, cooldown: 3.2, cooldownPerLv: -0.07,
    multBase: 1.9, multPerLv: 0.2, range: 14, radius: 1.0, angle: 0, count: 1, speed: 32, knockback: 2.4, stun: 0.3,
    color: 0xfacc15, vfx: 'dash_strike', shake: 0.15,
    desc: 'Loose a powerful arrow that pierces through every enemy in its path.',
  },
  ar_multishot: {
    id: 'ar_multishot', name: 'Multishot', icon: '🎯', tree: 'Archer', classes: ['archer'], type: 'active', kind: 'projectile',
    tier: 1, row: 0, col: 1, maxLevel: 10, reqLevel: 2, requires: [],
    spCostBase: 12, spCostPerLv: 1.8, cooldown: 5.0, cooldownPerLv: -0.1,
    multBase: 0.8, multPerLv: 0.09, range: 11, radius: 1.0, angle: 0.7, count: 5, speed: 28, knockback: 1.2, stun: 0.15,
    color: 0xa3e635, vfx: 'slash', shake: 0.15,
    desc: 'Fire a fan of five arrows at once.',
  },
  ar_eagle_eye: {
    id: 'ar_eagle_eye', name: 'Eagle Eye', icon: '🦅', tree: 'Archer', classes: ['archer'], type: 'buff', kind: 'buff',
    tier: 1, row: 0, col: 2, maxLevel: 10, reqLevel: 2, requires: [],
    spCostBase: 14, spCostPerLv: 2, cooldown: 16, cooldownPerLv: -0.3,
    multBase: 0, multPerLv: 0,
    buff: (lv) => ({
      id: 'eagle_eye', name: 'Eagle Eye', icon: '🦅', duration: 14 + lv * 1.5,
      mods: { critRate: 10 + lv * 2, critDmg: 15 + lv * 4, hit: 8 + lv * 2 },
    }),
    color: 0xfde047, vfx: 'aura_gold', shake: 0.15,
    desc: 'Sharpen your aim: more Crit Rate, Crit Damage and Hit.',
  },

  ar_frost_arrow: {
    id: 'ar_frost_arrow', name: 'Frost Arrow', icon: '🧊', tree: 'Archer', classes: ['archer'], type: 'active', kind: 'projectile', element: 'ice',
    tier: 2, row: 1, col: 0, maxLevel: 10, reqLevel: 5, requires: ['ar_power_shot'],
    spCostBase: 14, spCostPerLv: 2, cooldown: 5.5, cooldownPerLv: -0.12,
    multBase: 1.85, multPerLv: 0.2, range: 13, radius: 2.0, angle: 0, count: 1, speed: 26, knockback: 1.2, stun: 1.3, stunPerLv: 0.1,
    color: 0x6fd4ff, vfx: 'frost_nova', shake: 0.2,
    desc: 'An icy arrow that freezes the target and chills enemies around it.',
  },
  ar_evasive_roll: {
    id: 'ar_evasive_roll', name: 'Evasive Roll', icon: '🌀', tree: 'Archer', classes: ['archer'], type: 'active', kind: 'dash',
    tier: 2, row: 1, col: 1, maxLevel: 10, reqLevel: 5, requires: ['ar_multishot'],
    spCostBase: 10, spCostPerLv: 1.0, cooldown: 5.0, cooldownPerLv: -0.15,
    multBase: 0, multPerLv: 0, range: 6.0, radius: 1.5, distance: 6.0, knockback: 0, stun: 0,
    invuln: 0.6, color: 0xbef264, vfx: 'dash_strike', shake: 0.08,
    desc: 'Roll swiftly away from danger, becoming briefly untouchable.',
  },
  ar_rally: {
    id: 'ar_rally', name: 'Rally', icon: '💚', tree: 'Archer', classes: ['archer'], type: 'active', kind: 'heal',
    tier: 2, row: 1, col: 2, maxLevel: 10, reqLevel: 6, requires: ['ar_eagle_eye'],
    spCostBase: 18, spCostPerLv: 2.5, cooldown: 12, cooldownPerLv: -0.25,
    healPctBase: 0.22, healPctPerLv: 0.03,
    buff: (lv) => ({ id: 'rally', name: 'Rally', icon: '💚', duration: 6, hot: { hps: 5 + lv * 4 } }),
    color: 0x55ff88, vfx: 'heal', shake: 0.1,
    desc: 'Tend your wounds, instantly recovering HP and regenerating over 6s.',
  },

  ar_explosive_arrow: {
    id: 'ar_explosive_arrow', name: 'Explosive Arrow', icon: '💣', tree: 'Archer', classes: ['archer'], type: 'active', kind: 'projectile', element: 'fire',
    tier: 3, row: 2, col: 0, maxLevel: 10, reqLevel: 10, requires: ['ar_frost_arrow'],
    spCostBase: 20, spCostPerLv: 2.5, cooldown: 7.0, cooldownPerLv: -0.15,
    multBase: 2.2, multPerLv: 0.24, range: 13, radius: 3.4, angle: 0, count: 1, speed: 24, knockback: 3.6, stun: 0.7,
    color: 0xff6622, vfx: 'flame_slash', shake: 0.3,
    desc: 'An arrow tipped with blasting powder that detonates on impact in a wide radius.',
  },
  ar_rain_of_arrows: {
    id: 'ar_rain_of_arrows', name: 'Rain of Arrows', icon: '🌧️', tree: 'Archer', classes: ['archer'], type: 'active', kind: 'aoe',
    tier: 3, row: 2, col: 1, maxLevel: 10, reqLevel: 11, requires: ['ar_evasive_roll'],
    spCostBase: 22, spCostPerLv: 2.6, cooldown: 8.0, cooldownPerLv: -0.16,
    multBase: 1.2, multPerLv: 0.14, hits: 3, range: 9.0, radius: 4.0, angle: PI2, knockback: 1.0, stun: 0.3,
    color: 0xd9f99d, vfx: 'whirlwind', shake: 0.2,
    desc: 'Call down a volley on a distant area, striking every enemy there three times.',
  },
  ar_hunters_focus: {
    id: 'ar_hunters_focus', name: "Hunter's Focus", icon: '🎣', tree: 'Archer', classes: ['archer'], type: 'buff', kind: 'buff',
    tier: 3, row: 2, col: 2, maxLevel: 10, reqLevel: 12, requires: ['ar_rally'],
    spCostBase: 22, spCostPerLv: 2.5, cooldown: 20, cooldownPerLv: -0.35,
    buff: (lv) => ({
      id: 'hunters_focus', name: "Hunter's Focus", icon: '🎣', duration: 11 + lv * 1.0,
      mods: { attackSpeedPct: 22 + lv * 3, atkPct: 12 + lv * 2.5, moveSpeedPct: 10 + lv, dodge: 4 + lv },
    }),
    color: 0x86efac, vfx: 'aura_gold', shake: 0.15,
    desc: 'Lock into the hunt: more Attack Speed, Attack, Move Speed and Dodge.',
  },

  ar_storm_of_arrows: {
    id: 'ar_storm_of_arrows', name: 'Storm of Arrows', icon: '⛈️', tree: 'Archer', classes: ['archer'], type: 'active', kind: 'aoe',
    tier: 4, row: 3, col: 0, maxLevel: 10, reqLevel: 18, requires: ['ar_explosive_arrow'],
    spCostBase: 34, spCostPerLv: 4, cooldown: 13, cooldownPerLv: -0.25,
    multBase: 1.25, multPerLv: 0.15, hits: 6, range: 10.0, radius: 5.2, angle: PI2, knockback: 1.6, stun: 0.5,
    armorPierce: 0.25, invuln: 0.4, color: 0xfef08a, vfx: 'judgment', shake: 0.45,
    desc: 'Ultimate: blot out the sky with arrows that strike an entire area six times.',
  },
  ar_piercing_gale: {
    id: 'ar_piercing_gale', name: 'Piercing Gale', icon: '🌬️', tree: 'Archer', classes: ['archer'], type: 'active', kind: 'projectile', pierce: true, element: 'lightning',
    tier: 4, row: 3, col: 1, maxLevel: 10, reqLevel: 20, requires: ['ar_rain_of_arrows'],
    spCostBase: 30, spCostPerLv: 3.5, cooldown: 11, cooldownPerLv: -0.2,
    multBase: 1.7, multPerLv: 0.2, range: 14, radius: 1.4, angle: 0.5, count: 3, speed: 36, knockback: 2.0, stun: 0.5,
    armorPierce: 0.3, color: 0xfde68a, vfx: 'lightning', shake: 0.3,
    desc: 'Loose three shocking arrows that pierce through enemies and armor.',
  },
  ar_phantom_veil: {
    id: 'ar_phantom_veil', name: 'Phantom Veil', icon: '👻', tree: 'Archer', classes: ['archer'], type: 'buff', kind: 'buff',
    tier: 4, row: 3, col: 2, maxLevel: 10, reqLevel: 18, requires: ['ar_hunters_focus'],
    spCostBase: 28, spCostPerLv: 3, cooldown: 24, cooldownPerLv: -0.4,
    healPctBase: 0.15, healPctPerLv: 0.02,
    buff: (lv) => ({
      id: 'phantom_veil', name: 'Phantom Veil', icon: '👻', duration: 12 + lv * 1.2,
      mods: { dodge: 18 + lv * 2.5, critRate: 10 + lv * 1.5, atkPct: 18 + lv * 3, moveSpeedPct: 12 + lv },
    }),
    invuln: 0.8, color: 0xbbf7d0, vfx: 'aegis', shake: 0.2,
    desc: 'Fade into a ghostly veil: heal, and gain Dodge, Crit Rate, Attack and Move Speed.',
  },
});

export const SKILLS = SKILL_DEFS;

/** Is a skill usable by this class? (no `classes` = shared) */
export function skillAllowedForClass(def, classId) {
  if (!def) return false;
  if (!Array.isArray(def.classes) || !def.classes.length) return true;
  return def.classes.includes(String(classId || DEFAULT_CLASS).toLowerCase());
}

/** First skill (row 0, col 0) of a class tree. */
export function getStarterSkillId(classId) {
  const cid = getClass(classId).id;
  const d = Object.values(SKILL_DEFS).find((s) => Array.isArray(s.classes) && s.classes.includes(cid) && s.row === 0 && s.col === 0 && s.type !== 'passive');
  return d ? d.id : 'power_strike';
}

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

  _classId() { return this.game ? (this.game.classId || DEFAULT_CLASS) : DEFAULT_CLASS; }
  _classOk(def) { return !this.game || skillAllowedForClass(def, this._classId()); }

  grantStarterSkills(classId = this._classId()) {
    const starter = getStarterSkillId(classId);
    this.levels = { [starter]: 1 };
    this.cooldowns = {};
    this.cooldownTotals = {};
    this.hotbar = [starter, null, null, null, null];
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
    if (!this._classOk(def)) return { ok: false, reason: 'Not available for your class' };
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
    if (!this._classOk(def)) return { ok: false, msg: 'Not available for your class' };
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
    const starter = getStarterSkillId(this._classId());
    for (const [id, lv] of Object.entries(this.levels)) {
      refund += id === starter ? Math.max(0, lv - 1) : lv;
    }
    this.levels = { [starter]: 1 };
    this.hotbar = [starter, null, null, null, null];
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
    if (!this._classOk(def)) return { ok: false, reason: 'Not available for your class' };
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
      magic: !!def.magic,
      pierce: !!def.pierce,
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
      classes: Array.isArray(def.classes) ? def.classes.slice() : null,
      magic: !!def.magic,
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
    const all = Object.keys(SKILL_DEFS).filter((id) => this._classOk(SKILL_DEFS[id])).map((id) => this.getSkillView(id));
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
    const starter = getStarterSkillId(this._classId());
    this.levels = { [starter]: 1 };
    for (const [id, lv] of Object.entries(d.levels || {})) {
      if (SKILL_DEFS[id] && this._classOk(SKILL_DEFS[id])) this.levels[id] = lv;
    }
    if (Array.isArray(d.hotbar)) {
      this.hotbar = d.hotbar.slice(0, 5).map((id) => (id && SKILL_DEFS[id] && this._classOk(SKILL_DEFS[id]) && this.levels[id] > 0 ? id : null));
      while (this.hotbar.length < 5) this.hotbar.push(null);
    } else {
      this.hotbar = [starter, null, null, null, null];
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

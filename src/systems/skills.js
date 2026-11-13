// =============================================================================
// ASJ (ARKENVEIL: SIGILS & JOURNEYS) - Battle & Passive Skill System.
// Owned by rpg-systems. Pure logic (no DOM / three.js).
// =============================================================================

import { DEFAULT_CLASS, getClass } from './classes.js';
import { skillTiming, IMBUE_DEFAULTS, STATUS } from './mechanics.js';

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const num = (v, d = 0) => (typeof v === 'number' && isFinite(v) ? v : Number.isFinite(Number(v)) && v !== '' && v != null ? Number(v) : d);
const slug = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

export const DEFAULT_HOTBAR_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

/** 4-stage melee combo descriptors for basic attacks (J / Left Click). */
export const BASIC_COMBO = [
  { stage: 0, name: 'Slash', mult: 1.0, range: 2.3, angle: 1.7, duration: 0.26, knockback: 1.2, stun: 0.1, staminaCost: 0, color: 0xffffff, vfx: 'slash', shake: 0.08 },
  { stage: 1, name: 'Cross Slash', mult: 1.15, range: 2.4, angle: 1.9, duration: 0.28, knockback: 1.5, stun: 0.12, staminaCost: 0, color: 0xffe08a, vfx: 'slash', shake: 0.1 },
  { stage: 2, name: 'Spinning Cleave', mult: 1.35, range: 2.6, angle: 2.8, duration: 0.32, knockback: 2.2, stun: 0.18, staminaCost: 0, color: 0xffaa44, vfx: 'spin', shake: 0.16 },
  { stage: 3, name: 'Crushing Finisher', mult: 1.75, range: 2.9, angle: 2.2, duration: 0.4, knockback: 3.8, stun: 0.45, staminaCost: 0, color: 0xff5522, vfx: 'slam', shake: 0.3 },
];

/** Canonical ASJ skill definitions (Battle & Passive trees). */
export const SKILL_DEFS = {
  // ============================================================== BATTLE TREE (KNIGHT / AEGIS)
  // Row 0 (Tier 1)
  power_strike: {
    id: 'power_strike', name: 'Soul Cut — Aegis Smash', icon: '/assets/sro/icons/skills/sword_smash_a.png', sroCode: 'SKILL_CH_SWORD_SMASH_A', tree: 'Knight', classes: ['knight'], type: 'active', kind: 'melee_arc',
    tier: 1, row: 0, col: 0, maxLevel: 10, reqLevel: 1, requires: [],
    spCostBase: 8, spCostPerLv: 1.5, cooldown: 2.6, cooldownPerLv: -0.08,
    multBase: 3.1, multPerLv: 0.36, critBonus: 15, range: 3.5, radius: 3.5, angle: 2.2, knockback: 3.5, stun: 0.9,
    color: '#fbbf24', vfx: 'slash_arc', shake: 0.3,
    desc: 'Unleash the iconic Aegis jumping downward smash with +15% Crit Rate, heavy burst damage and stun.',
  },
  whirlwind: {
    id: 'whirlwind', name: 'Illusion Chain — Aegis Flurry', icon: '/assets/sro/icons/skills/sword_chain_a.png', sroCode: 'SKILL_CH_SWORD_CHAIN_A', tree: 'Knight', classes: ['knight'], type: 'active', kind: 'nova',
    tier: 1, row: 0, col: 1, maxLevel: 10, reqLevel: 2, requires: [],
    spCostBase: 12, spCostPerLv: 2, cooldown: 4.2, cooldownPerLv: -0.12,
    multBase: 3.5, multPerLv: 0.40, hits: 3, range: 3.8, radius: 3.8, angle: Math.PI * 2, knockback: 2.4, stun: 0.4,
    color: '#f59e0b', vfx: 'spin_slash', shake: 0.25,
    desc: 'Execute a blinding 3-pulse Aegis sword flurry around you, slicing through nearby enemies.',
  },
  battle_cry: {
    id: 'battle_cry', name: 'Glacial Aegis Force', icon: '/assets/sro/icons/skills/sword_shieldpd_a.png', sroCode: 'SKILL_CH_SWORD_SHIELDPD_A', tree: 'Knight', classes: ['knight'], type: 'buff', kind: 'buff',
    tier: 1, row: 0, col: 2, maxLevel: 10, reqLevel: 2, requires: [],
    spCostBase: 14, spCostPerLv: 2, cooldown: 10, cooldownPerLv: -0.2,
    multBase: 0, multPerLv: 0, range: 3.5, radius: 3.5,
    buff: (lv) => ({
      id: 'battle_cry', name: 'Glacial Aegis Force', icon: '/assets/sro/icons/skills/sword_shieldpd_a.png', duration: 180 + lv * 15,
      mods: { atkPct: 26 + lv * 4, defPct: 24 + lv * 3.5, allRes: 6 + lv },
    }),
    color: '#38bdf8', vfx: 'warcry_ring', shake: 0.18,
    desc: 'Long stance (3m+): empower Attack (+26% +4%/Lv), Defense (+24% +3.5%/Lv), and All Resistances.',
  },

  // Row 1 (Tier 2)
  flame_slash: {
    id: 'flame_slash', name: 'Flying Dragon — Sword Dance Qi', icon: '/assets/sro/icons/skills/sword_geomgi_a.png', sroCode: 'SKILL_CH_SWORD_GEOMGI_A', tree: 'Knight', classes: ['knight'], type: 'active', kind: 'melee_arc', element: 'fire',
    tier: 2, row: 1, col: 0, maxLevel: 10, reqLevel: 5, requires: ['power_strike'],
    spCostBase: 14, spCostPerLv: 2, cooldown: 4.0, cooldownPerLv: -0.1,
    multBase: 3.8, multPerLv: 0.42, range: 4.5, radius: 4.5, angle: 2.3, knockback: 3.0, stun: 0.5,
    color: '#f97316', vfx: 'earth_shatter', shake: 0.32,
    desc: 'Sweep a piercing 3-hit arc of flaming sword energy wave across enemies in front of you.',
  },
  shield_bash: {
    id: 'shield_bash', name: 'Castle Shield Rush', icon: '/assets/sro/icons/skills/sword_shield_a.png', sroCode: 'SKILL_CH_SWORD_SHIELD_A', tree: 'Knight', classes: ['knight'], type: 'active', kind: 'dash',
    tier: 2, row: 1, col: 1, maxLevel: 10, reqLevel: 5, requires: ['whirlwind'],
    spCostBase: 13, spCostPerLv: 1.5, cooldown: 4.8, cooldownPerLv: -0.12,
    multBase: 3.0, multPerLv: 0.34, range: 7.5, radius: 3.0, distance: 7.5, knockback: 4.5, stun: 1.6, stunPerLv: 0.1,
    invuln: 0.6, color: '#60a5fa', vfx: 'shield_impact', shake: 0.28,
    desc: 'Charge forward behind an impenetrable castle shield, slamming enemies at impact and stunning them.',
  },
  healing_light: {
    id: 'healing_light', name: 'Killing Heaven Blade', icon: '/assets/sro/icons/skills/sword_downattack_a.png', sroCode: 'SKILL_CH_SWORD_DOWNATTACK_A', tree: 'Knight', classes: ['knight'], type: 'active', kind: 'heal',
    tier: 2, row: 1, col: 2, maxLevel: 10, reqLevel: 6, requires: ['battle_cry'],
    spCostBase: 16, spCostPerLv: 2.2, cooldown: 9.5, cooldownPerLv: -0.25,
    healPctBase: 0.34, healPctPerLv: 0.035,
    buff: (lv) => ({
      id: 'healing_light', name: 'Killing Heaven Blade', icon: '/assets/sro/icons/skills/sword_downattack_a.png', duration: 18 + lv * 2,
      hot: { hps: 14 + lv * 7, mps: 3 + lv * 0.8 },
    }),
    color: '#fde047', vfx: 'holy_pillar', shake: 0.1,
    desc: 'Invoke Killing Heaven Blade to immediately restore 34% (+3.5%/Lv) Max HP and sustain rapid HP/SP regeneration (20s+).',
  },

  // Row 2 (Tier 3)
  frost_nova: {
    id: 'frost_nova', name: 'Aegis Frost Nova', icon: '/assets/sro/icons/skills/cold_gigongjang_a.png', sroCode: 'SKILL_CH_COLD_GIGONGJANG_A', tree: 'Knight', classes: ['knight'], type: 'active', kind: 'nova', element: 'ice',
    tier: 3, row: 2, col: 0, maxLevel: 10, reqLevel: 10, requires: ['flame_slash'],
    spCostBase: 18, spCostPerLv: 2.4, cooldown: 5.8, cooldownPerLv: -0.15,
    multBase: 3.3, multPerLv: 0.38, range: 5.0, radius: 5.0, angle: Math.PI * 2, knockback: 2.2, stun: 2.0, stunPerLv: 0.12,
    color: 0x6fd4ff, vfx: 'frost_nova', shake: 0.32,
    desc: 'Erupt a wide ring of glacial frost spikes, dealing Ice damage and freezing surrounding enemies in place.',
  },
  thunder_wave: {
    id: 'thunder_wave', name: 'Thunder Sword Wave', icon: '/assets/sro/icons/skills/lightning_gyeonggong_a.png', sroCode: 'SKILL_CH_LIGHTNING_GIGONGTA_A', tree: 'Knight', classes: ['knight'], type: 'active', kind: 'projectile', element: 'lightning',
    tier: 3, row: 2, col: 1, maxLevel: 10, reqLevel: 11, requires: ['shield_bash'],
    spCostBase: 17, spCostPerLv: 2.0, cooldown: 4.5, cooldownPerLv: -0.12,
    multBase: 3.4, multPerLv: 0.38, critBonus: 12, range: 11.0, radius: 2.8, angle: 1.5, count: 4, speed: 20, knockback: 2.4, stun: 0.9,
    color: 0xffee44, vfx: 'lightning', shake: 0.3,
    desc: 'Unleash 4 surging bolts of thunder dragon sword qi that shock and pierce enemies.',
  },
  shadow_step: {
    id: 'shadow_step', name: 'Berserk Trance', icon: '/assets/sro/icons/skills/sword_knockdown_a.png', sroCode: 'SKILL_CH_SWORD_KNOCKDOWN_B', tree: 'Knight', classes: ['knight'], type: 'buff', kind: 'buff',
    tier: 3, row: 2, col: 2, maxLevel: 10, reqLevel: 12, requires: ['healing_light'],
    spCostBase: 20, spCostPerLv: 2.2, cooldown: 14, cooldownPerLv: -0.3,
    buff: (lv) => ({
      id: 'berserk_trance', name: 'Berserk Trance', icon: '/assets/sro/icons/skills/sword_knockdown_a.png', duration: 120 + lv * 12,
      mods: { critRate: 18 + lv * 2.5, attackSpeedPct: 26 + lv * 3.5, lifeSteal: 6 + lv * 1.2, moveSpeedPct: 16 + lv * 1.5 },
    }),
    color: 0xff3355, vfx: 'aura_red', shake: 0.2,
    desc: 'Long combat trance (2m+): massive Crit Rate, Attack Speed, Move Speed, and Life Steal.',
  },

  // Row 3 (Tier 4 - Ultimates)
  meteor_drop: {
    id: 'meteor_drop', name: 'Heavenly Sword Meteor', icon: '/assets/sro/icons/skills/sword_downattack_a.png', sroCode: 'SKILL_CH_FIRE_HWABYEOK_B', tree: 'Knight', classes: ['knight'], type: 'active', kind: 'aoe', element: 'fire',
    tier: 4, row: 3, col: 0, maxLevel: 10, reqLevel: 18, requires: ['frost_nova'],
    spCostBase: 28, spCostPerLv: 3.2, cooldown: 8.5, cooldownPerLv: -0.2,
    multBase: 5.2, multPerLv: 0.58, critBonus: 15, range: 7.5, radius: 5.8, angle: Math.PI * 2, knockback: 5.0, stun: 1.6,
    color: 0xff4400, vfx: 'meteor', shake: 0.5,
    desc: 'Call down a colossal heavenly meteor that shatters the earth for massive AoE Fire damage.',
  },
  blade_storm: {
    id: 'blade_storm', name: 'Asura Blood Blade Storm', icon: '/assets/sro/icons/skills/sword_knockdown_a.png', sroCode: 'SKILL_CH_SWORD_KNOCKDOWN_A', tree: 'Knight', classes: ['knight'], type: 'active', kind: 'nova', element: 'lightning',
    tier: 4, row: 3, col: 1, maxLevel: 10, reqLevel: 20, requires: ['thunder_wave'],
    spCostBase: 30, spCostPerLv: 3.5, cooldown: 10.5, cooldownPerLv: -0.25,
    multBase: 5.8, multPerLv: 0.68, critBonus: 20, hits: 4, range: 6.0, radius: 6.0, angle: Math.PI * 2, knockback: 4.0, stun: 1.4,
    armorPierce: 0.45, invuln: 0.85, color: '#ef4444', vfx: 'avatar_ascend', shake: 0.55,
    desc: 'Ultimate technique: summon a 4-pulse Asura blood blade tempest shredding 45% enemy armor.',
  },
  aegis_barrier: {
    id: 'aegis_barrier', name: 'Ironwall Castle Defense', icon: '/assets/sro/icons/skills/sword_passive_a.png', sroCode: 'SKILL_CH_SWORD_PASSIVE_A', tree: 'Knight', classes: ['knight'], type: 'buff', kind: 'buff',
    tier: 4, row: 3, col: 2, maxLevel: 10, reqLevel: 18, requires: ['shadow_step'],
    spCostBase: 24, spCostPerLv: 2.5, cooldown: 16, cooldownPerLv: -0.35,
    healPctBase: 0.30, healPctPerLv: 0.03,
    buff: (lv) => ({
      id: 'divine_aegis', name: 'Ironwall Castle Defense', icon: '/assets/sro/icons/skills/sword_passive_a.png', duration: 120 + lv * 12,
      mods: { defPct: 60 + lv * 6, atkPct: 35 + lv * 4, allRes: 30 + lv * 3, hpRegen: 10 + lv * 3 },
    }),
    invuln: 1.2, color: '#94a3b8', vfx: 'iron_fortress', shake: 0.25,
    desc: 'Long barrier (2m+): heal on cast, become briefly invulnerable, and gain colossal Attack, Defense, and Resistances.',
  },

  // ============================================================= PASSIVE TREE (shared by all classes)
  // Row 0 (Tier 1)
  weapon_mastery: {
    id: 'weapon_mastery', name: 'Weapon Mastery', icon: '/assets/sro/icons/skills/sword_passive_a.png', sroCode: 'SKILL_CH_SWORD_PASSIVE_A', tree: 'Passive', type: 'passive', kind: 'passive',
    tier: 1, row: 0, col: 0, maxLevel: 10, reqLevel: 1, requires: [],
    passive: (lv) => ({ atkPct: lv * 6, matkPct: lv * 6, hit: lv * 3 }),
    desc: 'Hones your weapon mastery, permanently increasing Attack (+6%/Lv), Magic Attack (+6%/Lv), and Hit (+3/Lv).',
  },
  vitality: {
    id: 'vitality', name: 'Vitality', icon: '/assets/sro/icons/skills/water_selfheal_b.png', sroCode: 'SKILL_CH_WATER_PASSIVE_A', tree: 'Passive', type: 'passive', kind: 'passive',
    tier: 1, row: 0, col: 1, maxLevel: 10, reqLevel: 1, requires: [],
    passive: (lv) => ({ hpPct: lv * 6, hp: lv * 25, hpRegen: lv * 0.6 }),
    desc: 'Fortifies your body, permanently increasing Max HP (+6% & +25/Lv) and HP Regeneration (+0.6/s per Lv).',
  },
  spirit_flow: {
    id: 'spirit_flow', name: 'Spirit Flow', icon: '/assets/sro/icons/skills/water_passive_a.png', sroCode: 'SKILL_CH_WATER_PASSIVE_B', tree: 'Passive', type: 'passive', kind: 'passive',
    tier: 1, row: 0, col: 2, maxLevel: 10, reqLevel: 1, requires: [],
    passive: (lv) => ({ mpPct: lv * 6, mp: lv * 18, mpRegen: lv * 0.5 }),
    desc: 'Expands your inner spirit, permanently increasing Max SP (+6% & +18/Lv) and SP Regeneration (+0.5/s per Lv).',
  },

  // Row 1 (Tier 2)
  lethal_focus: {
    id: 'lethal_focus', name: 'Lethal Focus', icon: '/assets/sro/icons/skills/lightning_jipjung_a.png', sroCode: 'SKILL_CH_LIGHTNING_PASSIVE_A', tree: 'Passive', type: 'passive', kind: 'passive',
    tier: 2, row: 1, col: 0, maxLevel: 10, reqLevel: 6, requires: ['weapon_mastery'],
    passive: (lv) => ({ critRate: lv * 2.5, critDmg: lv * 8 }),
    desc: 'Sharpens your eye for weak points: +2.5% Crit Rate and +8% Crit Damage per level.',
  },
  iron_skin: {
    id: 'iron_skin', name: 'Iron Resolve', icon: '/assets/sro/icons/skills/cold_passive_a.png', sroCode: 'SKILL_CH_COLD_PASSIVE_A', tree: 'Passive', type: 'passive', kind: 'passive',
    tier: 2, row: 1, col: 1, maxLevel: 10, reqLevel: 6, requires: ['vitality'],
    passive: (lv) => ({ defPct: lv * 6, def: lv * 8, block: lv * 2 }),
    desc: 'Hardens your stance in battle: +6% Defense, +8 flat Defense, and +2% Block Chance per level.',
  },
  swift_footwork: {
    id: 'swift_footwork', name: 'Swift Footwork', icon: '/assets/sro/icons/skills/lightning_gyeonggong_a.png', sroCode: 'SKILL_CH_LIGHTNING_GYEONGGONG_B', tree: 'Passive', type: 'passive', kind: 'passive',
    tier: 2, row: 1, col: 2, maxLevel: 10, reqLevel: 6, requires: ['spirit_flow'],
    passive: (lv) => ({ moveSpeedPct: lv * 2.5, attackSpeedPct: lv * 3.5, dodge: lv * 2, staminaRegen: lv * 2 }),
    desc: 'Lightens your step: +2.5% Move Speed, +3.5% Attack Speed, and +2% Dodge per level.',
  },

  // Row 2 (Tier 3)
  bloodthirst: {
    id: 'bloodthirst', name: 'Bloodthirst', icon: '/assets/sro/icons/skills/fire_passive_a.png', sroCode: 'SKILL_CH_FIRE_PASSIVE_A', tree: 'Passive', type: 'passive', kind: 'passive',
    tier: 3, row: 2, col: 0, maxLevel: 10, reqLevel: 14, requires: ['lethal_focus'],
    passive: (lv) => ({ lifeSteal: lv * 1.5, atkPct: lv * 3.5 }),
    desc: 'Every strike drains life from foes: +1.5% Life Steal and +3.5% Attack per level.',
  },
  elemental_ward: {
    id: 'elemental_ward', name: 'Elemental Ward', icon: '/assets/sro/icons/skills/fire_shield_a.png', sroCode: 'SKILL_CH_FIRE_SHIELD_A', tree: 'Passive', type: 'passive', kind: 'passive',
    tier: 3, row: 2, col: 1, maxLevel: 10, reqLevel: 14, requires: ['iron_skin'],
    passive: (lv) => ({ allRes: lv * 4.5, thorns: lv * 8 }),
    desc: 'Wards against the elements: +4.5% All Elemental Resistances and +8 Thorns damage per level.',
  },
  treasure_hunter: {
    id: 'treasure_hunter', name: "Fortune's Favor", icon: '/assets/sro/icons/skills/water_resurrection_a.png', sroCode: 'SKILL_CH_WATER_RESURRECTION_A', tree: 'Passive', type: 'passive', kind: 'passive',
    tier: 3, row: 2, col: 2, maxLevel: 10, reqLevel: 14, requires: ['swift_footwork'],
    passive: (lv) => ({ magicFind: lv * 8, goldFind: lv * 10, expBonus: lv * 3, cdr: lv * 2 }),
    desc: 'Blesses your journey: +8% Magic Find, +10% Gold Find, +3% EXP Bonus, and +2% Cooldown Reduction per level.',
  },
};


const PI2 = Math.PI * 2;

/** Class skill trees (Axeman / Wizard / Archer). Knight skills live in SKILL_DEFS above. */
Object.assign(SKILL_DEFS, {
  // ============================================================== AXEMAN TREE (DUAL-AXE WARRIOR)
  ax_cleave: {
    id: 'ax_cleave', name: 'Dual Axe Down Cross', icon: '/assets/sro/icons/skills/spear_frontarea_a.png', sroCode: 'SKILL_EU_WARRIOR_DUALA_CROSS_A', tree: 'Axeman', classes: ['axeman'], type: 'active', kind: 'melee_arc',
    tier: 1, row: 0, col: 0, maxLevel: 10, reqLevel: 1, requires: [],
    spCostBase: 8, spCostPerLv: 1.5, cooldown: 2.6, cooldownPerLv: -0.08,
    multBase: 3.3, multPerLv: 0.38, critBonus: 12, range: 3.6, radius: 3.6, angle: 2.5, knockback: 3.5, stun: 0.6, armorPierce: 0.30,
    color: '#ef4444', vfx: 'heavy_cleave', shake: 0.32,
    desc: 'Savage European dual axe cross strike shredding 30% armor with +12% Crit Rate and heavy bleed.',
  },
  ax_ground_slam: {
    id: 'ax_ground_slam', name: 'Dual Axe Twist & Stomp', icon: '/assets/sro/icons/skills/spear_spin_a.png', sroCode: 'SKILL_EU_WARRIOR_DUALA_TWIST_A', tree: 'Axeman', classes: ['axeman'], type: 'active', kind: 'aoe',
    tier: 1, row: 0, col: 1, maxLevel: 10, reqLevel: 2, requires: [],
    spCostBase: 12, spCostPerLv: 2, cooldown: 4.4, cooldownPerLv: -0.12,
    multBase: 3.0, multPerLv: 0.35, range: 3.6, radius: 4.2, angle: PI2, knockback: 3.2, stun: 1.3,
    color: '#d97706', vfx: 'seismic_stomp', shake: 0.38,
    desc: 'Spin your twin axes into the ground with a devastating shockwave that damages and stuns all nearby foes.',
  },
  ax_war_bellow: {
    id: 'ax_war_bellow', name: 'War Cry — Dual Axe Fury', icon: '/assets/sro/icons/skills/fire_gongup_a.png', sroCode: 'SKILL_EU_WARRIOR_TWOHANDA_CRY_A', tree: 'Axeman', classes: ['axeman'], type: 'buff', kind: 'buff',
    tier: 1, row: 0, col: 2, maxLevel: 10, reqLevel: 2, requires: [],
    spCostBase: 14, spCostPerLv: 2, cooldown: 10, cooldownPerLv: -0.2,
    multBase: 0, multPerLv: 0, range: 3.5, radius: 3.5,
    buff: (lv) => ({
      id: 'war_bellow', name: 'War Cry — Dual Axe Fury', icon: '/assets/sro/icons/skills/fire_gongup_a.png', duration: 180 + lv * 15,
      mods: { atkPct: 30 + lv * 4, critDmg: 25 + lv * 4, attackSpeedPct: 16 + lv * 2 },
    }),
    color: 0xff5533, vfx: 'aura_red', shake: 0.2,
    desc: 'Long warcry (3m+): boost Attack (+30% +4%/Lv), Critical Damage (+25% +4%/Lv), and Attack Speed.',
  },

  ax_rending_chop: {
    id: 'ax_rending_chop', name: 'Chain Twin-Axe — Tiger Cross', icon: '/assets/sro/icons/skills/spear_chain_a.png', sroCode: 'SKILL_CH_SPEAR_CHAIN_A', tree: 'Axeman', classes: ['axeman'], type: 'active', kind: 'melee_arc',
    tier: 2, row: 1, col: 0, maxLevel: 10, reqLevel: 5, requires: ['ax_cleave'],
    spCostBase: 14, spCostPerLv: 2, cooldown: 4.0, cooldownPerLv: -0.1,
    multBase: 4.0, multPerLv: 0.45, critBonus: 15, range: 3.6, radius: 3.6, angle: 2.0, knockback: 2.2, stun: 0.5, armorPierce: 0.35,
    color: '#b91c1c', vfx: 'bleed_slash', shake: 0.32,
    desc: 'A ferocious three-strike dual axe chain combo tearing through 35% of enemy armor.',
  },
  ax_leaping_strike: {
    id: 'ax_leaping_strike', name: 'Sudden Raid — Flying Axe Leap', icon: '/assets/sro/icons/skills/spear_pierce_a.png', sroCode: 'SKILL_CH_SPEAR_PIERCE_A', tree: 'Axeman', classes: ['axeman'], type: 'active', kind: 'dash',
    tier: 2, row: 1, col: 1, maxLevel: 10, reqLevel: 5, requires: ['ax_ground_slam'],
    spCostBase: 13, spCostPerLv: 1.5, cooldown: 4.8, cooldownPerLv: -0.15,
    multBase: 3.2, multPerLv: 0.36, range: 7.5, radius: 3.2, distance: 7.5, knockback: 4.2, stun: 1.4, stunPerLv: 0.1,
    invuln: 0.6, color: '#f97316', vfx: 'leap_slam', shake: 0.32,
    desc: 'Leap across the battlefield and crash down with both axes, slamming and stunning targets at impact.',
  },
  ax_second_wind: {
    id: 'ax_second_wind', name: 'Iron Fortitude', icon: '/assets/sro/icons/skills/water_heal_a.png', sroCode: 'SKILL_CH_WATER_HEAL_A', tree: 'Axeman', classes: ['axeman'], type: 'active', kind: 'heal',
    tier: 2, row: 1, col: 2, maxLevel: 10, reqLevel: 6, requires: ['ax_war_bellow'],
    spCostBase: 16, spCostPerLv: 2.2, cooldown: 9.5, cooldownPerLv: -0.25,
    healPctBase: 0.35, healPctPerLv: 0.035,
    buff: (lv) => ({ id: 'second_wind', name: 'Iron Fortitude', icon: '/assets/sro/icons/skills/water_heal_a.png', duration: 18 + lv * 2, hot: { hps: 14 + lv * 7, mps: 2 + lv * 0.6 } }),
    color: 0x55ff88, vfx: 'heal', shake: 0.1,
    desc: 'Tap into warrior reserves to recover 35% (+3.5%/Lv) Max HP and sustain rapid regeneration (20s+).',
  },

  ax_earthsplitter: {
    id: 'ax_earthsplitter', name: 'Extreme Fire Force Cleave', icon: '/assets/sro/icons/skills/fire_gigongta_b.png', sroCode: 'SKILL_CH_FIRE_GIGONGTA_B', tree: 'Axeman', classes: ['axeman'], type: 'active', kind: 'aoe', element: 'fire',
    tier: 3, row: 2, col: 0, maxLevel: 10, reqLevel: 10, requires: ['ax_rending_chop'],
    spCostBase: 18, spCostPerLv: 2.4, cooldown: 5.8, cooldownPerLv: -0.15,
    multBase: 3.7, multPerLv: 0.42, range: 5.0, radius: 4.8, angle: PI2, knockback: 3.8, stun: 1.3,
    color: '#ff4500', vfx: 'cataclysm_fissure', shake: 0.42,
    desc: 'Cleave the earth open with extreme fire force, creating a molten fissure that burns and stuns enemies.',
  },
  ax_reaver_spin: {
    id: 'ax_reaver_spin', name: 'Dual Axe Whirlwind Axis', icon: '/assets/sro/icons/skills/spear_roundarea_a.png', sroCode: 'SKILL_EU_WARRIOR_DUALA_WHIRLWIND_A', tree: 'Axeman', classes: ['axeman'], type: 'active', kind: 'nova',
    tier: 3, row: 2, col: 1, maxLevel: 10, reqLevel: 11, requires: ['ax_leaping_strike'],
    spCostBase: 18, spCostPerLv: 2.2, cooldown: 4.8, cooldownPerLv: -0.12,
    multBase: 4.2, multPerLv: 0.48, hits: 3, range: 4.5, radius: 4.5, angle: PI2, knockback: 2.5, stun: 0.6,
    color: '#ef4444', vfx: 'crimson_tornado', shake: 0.3,
    desc: 'Spin both European axes in a ferocious 3-pulse crimson whirlwind, slicing all nearby enemies.',
  },
  ax_bloodrage: {
    id: 'ax_bloodrage', name: 'Berserker Frenzy — Blood Body', icon: '/assets/sro/icons/skills/fire_gongup_a.png', sroCode: 'SKILL_CH_FIRE_GONGUP_A', tree: 'Axeman', classes: ['axeman'], type: 'buff', kind: 'buff',
    tier: 3, row: 2, col: 2, maxLevel: 10, reqLevel: 12, requires: ['ax_second_wind'],
    spCostBase: 20, spCostPerLv: 2.2, cooldown: 14, cooldownPerLv: -0.3,
    buff: (lv) => ({
      id: 'bloodrage', name: 'Berserker Frenzy — Blood Body', icon: '/assets/sro/icons/skills/fire_gongup_a.png', duration: 120 + lv * 12,
      mods: { atkPct: 26 + lv * 3.5, attackSpeedPct: 26 + lv * 4, lifeSteal: 8 + lv * 1.5, moveSpeedPct: 16 + lv * 1.5 },
    }),
    color: '#dc2626', vfx: 'blood_aura', shake: 0.2,
    desc: 'Long frenzy (2m+): massive Attack, Attack Speed, Movement Speed, and Life Steal.',
  },

  ax_cyclone: {
    id: 'ax_cyclone', name: 'Dual Axe Cyclone of Steel', icon: '/assets/sro/icons/skills/spear_roundarea_a.png', sroCode: 'SKILL_EU_WARRIOR_DUALA_WHIRLWIND_B', tree: 'Axeman', classes: ['axeman'], type: 'active', kind: 'nova',
    tier: 4, row: 3, col: 0, maxLevel: 10, reqLevel: 18, requires: ['ax_earthsplitter'],
    spCostBase: 30, spCostPerLv: 3.5, cooldown: 10.5, cooldownPerLv: -0.25,
    multBase: 5.5, multPerLv: 0.62, hits: 4, range: 6.0, radius: 6.0, angle: PI2, knockback: 4.0, stun: 1.0,
    armorPierce: 0.40, invuln: 0.85, color: 0xffdd88, vfx: 'judgment', shake: 0.55,
    desc: 'Ultimate: become a cataclysmic 4-pulse cyclone of twin battle axes shredding 40% armor.',
  },
  ax_executioner: {
    id: 'ax_executioner', name: 'Titan Guillotine — Soul Departs', icon: '/assets/sro/icons/skills/spear_stun_a.png', sroCode: 'SKILL_CH_SPEAR_STUN_A', tree: 'Axeman', classes: ['axeman'], type: 'active', kind: 'melee_arc',
    tier: 4, row: 3, col: 1, maxLevel: 10, reqLevel: 20, requires: ['ax_reaver_spin'],
    spCostBase: 28, spCostPerLv: 3.2, cooldown: 8.5, cooldownPerLv: -0.2,
    multBase: 6.4, multPerLv: 0.72, critBonus: 35, range: 4.6, radius: 4.6, angle: 2.2, knockback: 6.0, stun: 1.6,
    armorPierce: 0.40, color: '#991b1b', vfx: 'guillotine', shake: 0.6,
    desc: 'A titanic executioner guillotine chop with +35% Crit Rate that obliterates enemies for 640%+ damage.',
  },
  ax_unbreakable: {
    id: 'ax_unbreakable', name: 'Titan Blood Armor', icon: '/assets/sro/icons/skills/spear_passive_a.png', sroCode: 'SKILL_EU_WARRIOR_TWOHANDA_STAND01', tree: 'Axeman', classes: ['axeman'], type: 'buff', kind: 'buff',
    tier: 4, row: 3, col: 2, maxLevel: 10, reqLevel: 18, requires: ['ax_bloodrage'],
    spCostBase: 24, spCostPerLv: 2.5, cooldown: 16, cooldownPerLv: -0.35,
    healPctBase: 0.30, healPctPerLv: 0.03,
    buff: (lv) => ({
      id: 'unbreakable', name: 'Titan Blood Armor', icon: '/assets/sro/icons/skills/spear_passive_a.png', duration: 120 + lv * 12,
      mods: { defPct: 58 + lv * 6, atkPct: 32 + lv * 4, allRes: 28 + lv * 3, hpRegen: 10 + lv * 3 },
    }),
    invuln: 1.2, color: 0xddbb88, vfx: 'aegis', shake: 0.25,
    desc: 'Long barrier (2m+): heal on cast and gain colossal Defense (+58%), Attack (+32%), and All Resistances.',
  },

  // ============================================================== WIZARD TREE (EUROPEAN STAFF / NATURAL MAGIC)
  wz_arcane_missiles: {
    id: 'wz_arcane_missiles', name: 'Arcane Bolt Barrage', icon: '/assets/sro/icons/skills/wizard_arcane_bolt.png', sroCode: 'SKILL_EU_WIZARD_TWOHAND_TARGET_SHOT', tree: 'Wizard', classes: ['wizard'], type: 'active', kind: 'projectile', magic: true,
    tier: 1, row: 0, col: 0, maxLevel: 10, reqLevel: 1, requires: [],
    spCostBase: 8, spCostPerLv: 1.5, cooldown: 2.2, cooldownPerLv: -0.06,
    multBase: 3.0, multPerLv: 0.34, range: 14, radius: 1.5, angle: 0.42, count: 3, speed: 24, knockback: 1.5, stun: 0.25,
    color: 0xc084fc, vfx: 'lightning', shake: 0.15,
    desc: 'Unleash a rapid barrage of three homing arcane bolts with high velocity and crisp cooldown.',
  },
  wz_fireball: {
    id: 'wz_fireball', name: 'Fire Wave — Burning Hell', icon: '/assets/sro/icons/skills/wizard_fireball.png', sroCode: 'SKILL_EU_WIZARD_FIREA_SPRAY_A', tree: 'Wizard', classes: ['wizard'], type: 'active', kind: 'projectile', magic: true, element: 'fire',
    tier: 1, row: 0, col: 1, maxLevel: 10, reqLevel: 2, requires: [],
    spCostBase: 12, spCostPerLv: 2, cooldown: 3.0, cooldownPerLv: -0.08,
    multBase: 3.9, multPerLv: 0.46, range: 14, radius: 3.6, angle: 0, count: 1, speed: 21, knockback: 3.2, stun: 0.5,
    color: '#f97316', vfx: 'fireball_proj', shake: 0.32,
    desc: 'Hurl the iconic Fire Wave that detonates wide on impact, incinerating targets with Fire damage.',
  },
  wz_mana_ward: {
    id: 'wz_mana_ward', name: 'Snow Shield — Mana Ward', icon: '/assets/sro/icons/skills/wizard_snow_shield.png', sroCode: 'SKILL_EU_WIZARD_COLDA_SHIELD_A', tree: 'Wizard', classes: ['wizard'], type: 'buff', kind: 'buff',
    tier: 1, row: 0, col: 2, maxLevel: 10, reqLevel: 2, requires: [],
    spCostBase: 14, spCostPerLv: 2, cooldown: 10, cooldownPerLv: -0.2,
    multBase: 0, multPerLv: 0,
    buff: (lv) => ({
      id: 'mana_ward', name: 'Snow Shield — Mana Ward', icon: '/assets/sro/icons/skills/wizard_snow_shield.png', duration: 180 + lv * 15,
      mods: { matkPct: 30 + lv * 4, defPct: 24 + lv * 3.5, mpRegen: 3.0 + lv * 0.7, damageAbsorbPct: 5 + Math.floor(lv / 2) },
    }),
    color: '#60a5fa', vfx: 'arcane_orb', shake: 0.15,
    desc: 'Long stance (3m+): Snow Shield empowers Magic Attack (+30% +4%/Lv), Defense, Absorb, and MP regeneration.',
  },

  wz_glacial_nova: {
    id: 'wz_glacial_nova', name: 'Cold Wave — Frost Nova', icon: '/assets/sro/icons/skills/wizard_frost_nova.png', sroCode: 'SKILL_EU_WIZARD_COLDA_WAVE_A', tree: 'Wizard', classes: ['wizard'], type: 'active', kind: 'nova', magic: true, element: 'ice',
    tier: 2, row: 1, col: 0, maxLevel: 10, reqLevel: 5, requires: ['wz_arcane_missiles'],
    spCostBase: 15, spCostPerLv: 2.0, cooldown: 4.8, cooldownPerLv: -0.12,
    multBase: 3.3, multPerLv: 0.38, range: 5.2, radius: 5.2, angle: PI2, knockback: 2.6, stun: 2.0, stunPerLv: 0.12,
    color: '#38bdf8', vfx: 'frost_ring', shake: 0.3,
    desc: 'Erupt a wide freezing glacial ring around the wizard, freezing enemies solid in ice.',
  },
  wz_blink: {
    id: 'wz_blink', name: 'Ghost Walk — Phantom Teleport', icon: '/assets/sro/icons/skills/wizard_teleport.png', sroCode: 'SKILL_EU_WIZARD_LIGHTNINGA_TELEPORT_A', tree: 'Wizard', classes: ['wizard'], type: 'active', kind: 'dash', magic: true, element: 'lightning',
    tier: 2, row: 1, col: 1, maxLevel: 10, reqLevel: 5, requires: ['wz_fireball'],
    spCostBase: 11, spCostPerLv: 1.2, cooldown: 4.2, cooldownPerLv: -0.15,
    multBase: 2.4, multPerLv: 0.28, range: 8.5, radius: 3.2, distance: 8.5, knockback: 3.2, stun: 0.8,
    invuln: 0.7, color: '#c084fc', vfx: 'blink_flash', shake: 0.15,
    desc: 'Phase rapidly through the astral plane, turning untouchable and blasting enemies at arrival.',
  },
  wz_arcane_renewal: {
    id: 'wz_arcane_renewal', name: 'Life Turnover', icon: '/assets/sro/icons/skills/wizard_life_turnover.png', sroCode: 'SKILL_EU_WIZARD_RECOVERY_A', tree: 'Wizard', classes: ['wizard'], type: 'active', kind: 'heal',
    tier: 2, row: 1, col: 2, maxLevel: 10, reqLevel: 6, requires: ['wz_mana_ward'],
    spCostBase: 16, spCostPerLv: 2.2, cooldown: 9.5, cooldownPerLv: -0.25,
    healPctBase: 0.34, healPctPerLv: 0.035,
    buff: (lv) => ({ id: 'arcane_renewal', name: 'Life Turnover', icon: '/assets/sro/icons/skills/wizard_life_turnover.png', duration: 18 + lv * 2, hot: { hps: 12 + lv * 6, mps: 6 + lv * 2.5 } }),
    color: 0x55ff88, vfx: 'heal', shake: 0.1,
    desc: 'Channel Life Turnover to restore 34% (+3.5%/Lv) Max HP and sustain rapid HP/MP regeneration (20s+).',
  },

  wz_chain_lightning: {
    id: 'wz_chain_lightning', name: 'Chain Lightning — Shock Shout', icon: '/assets/sro/icons/skills/wizard_chain_lightning.png', sroCode: 'SKILL_EU_WIZARD_LIGHTNINGA_CHAIN_A', tree: 'Wizard', classes: ['wizard'], type: 'active', kind: 'projectile', magic: true, element: 'lightning', pierce: true,
    tier: 3, row: 2, col: 0, maxLevel: 10, reqLevel: 10, requires: ['wz_glacial_nova'],
    spCostBase: 18, spCostPerLv: 2.2, cooldown: 4.4, cooldownPerLv: -0.12,
    multBase: 3.6, multPerLv: 0.42, critBonus: 15, range: 14, radius: 2.2, angle: 1.0, count: 4, speed: 28, knockback: 2.0, stun: 0.9,
    color: '#a855f7', vfx: 'chain_arc', shake: 0.32,
    desc: 'Fling 4 piercing lightning arcs that tear through multiple enemies, dealing massive Lightning damage.',
  },
  wz_inferno_ring: {
    id: 'wz_inferno_ring', name: 'Snow Breeze — Blizzard Storm', icon: '/assets/sro/icons/skills/wizard_blizzard.png', sroCode: 'SKILL_EU_WIZARD_COLDA_BLIZZARD_A', tree: 'Wizard', classes: ['wizard'], type: 'active', kind: 'aoe', magic: true, element: 'ice',
    tier: 3, row: 2, col: 1, maxLevel: 10, reqLevel: 11, requires: ['wz_blink'],
    spCostBase: 20, spCostPerLv: 2.4, cooldown: 5.8, cooldownPerLv: -0.15,
    multBase: 4.0, multPerLv: 0.48, hits: 3, range: 8.0, radius: 5.0, angle: PI2, knockback: 2.2, stun: 0.7,
    color: '#0ea5e9', vfx: 'ice_storm', shake: 0.35,
    desc: 'Call down a raging blizzard ice storm on a wide area, pelting enemies 3 times with severe Cold damage.',
  },
  wz_arcane_surge: {
    id: 'wz_arcane_surge', name: 'Thunder Sky Force — Overcharge', icon: '/assets/sro/icons/skills/wizard_arcane_surge.png', sroCode: 'SKILL_EU_WIZARD_TWOHAND_CHARGE_A', tree: 'Wizard', classes: ['wizard'], type: 'buff', kind: 'buff',
    tier: 3, row: 2, col: 2, maxLevel: 10, reqLevel: 12, requires: ['wz_arcane_renewal'],
    spCostBase: 20, spCostPerLv: 2.2, cooldown: 14, cooldownPerLv: -0.3,
    buff: (lv) => ({
      id: 'arcane_surge', name: 'Thunder Sky Force — Overcharge', icon: '/assets/sro/icons/skills/wizard_arcane_surge.png', duration: 120 + lv * 12,
      mods: { matkPct: 36 + lv * 4.5, critRate: 16 + lv * 2.5, attackSpeedPct: 16 + lv * 2.0, cdr: 14 + lv * 1.5, mpRegen: 4 + lv * 0.9 },
    }),
    color: '#8b5cf6', vfx: 'arcane_beam', shake: 0.2,
    desc: 'Long overcharge (2m+): colossal Magic Attack (+36% +4.5%/Lv), Attack Speed, Crit Rate, CDR, and MP Regen.',
  },

  wz_meteor: {
    id: 'wz_meteor', name: 'Meteor Fall — Earth Shock', icon: '/assets/sro/icons/skills/wizard_meteor.png', sroCode: 'SKILL_EU_WIZARD_FIREA_METEOR_A', tree: 'Wizard', classes: ['wizard'], type: 'active', kind: 'aoe', magic: true, element: 'fire',
    tier: 4, row: 3, col: 0, maxLevel: 10, reqLevel: 18, requires: ['wz_chain_lightning'],
    spCostBase: 28, spCostPerLv: 3.4, cooldown: 8.5, cooldownPerLv: -0.2,
    multBase: 6.2, multPerLv: 0.75, critBonus: 18, range: 10.5, radius: 6.2, angle: PI2, knockback: 5.5, stun: 1.7,
    color: '#ef4444', vfx: 'meteor_fall', shake: 0.6,
    desc: 'Ultimate: summon a colossal burning meteor crushing a huge target zone with astronomical Fire damage.',
  },
  wz_prism_beam: {
    id: 'wz_prism_beam', name: 'Prismatic Charged Laser', icon: '/assets/sro/icons/skills/wizard_prism_beam.png', sroCode: 'SKILL_EU_WIZARD_TWOHAND_BEAM_A', tree: 'Wizard', classes: ['wizard'], type: 'active', kind: 'projectile', magic: true, pierce: true, element: 'lightning',
    tier: 4, row: 3, col: 1, maxLevel: 10, reqLevel: 20, requires: ['wz_inferno_ring'],
    spCostBase: 30, spCostPerLv: 3.5, cooldown: 9.5, cooldownPerLv: -0.25,
    multBase: 5.6, multPerLv: 0.65, critBonus: 25, range: 18, radius: 2.5, angle: 0, count: 1, speed: 42, knockback: 3.8, stun: 1.2,
    armorPierce: 0.50, color: 0xffe0ff, vfx: 'judgment', shake: 0.55,
    desc: 'Ultimate: fire a piercing laser beam with +25% Crit Rate that shreds 50% of enemy armor.',
  },
  wz_arcane_barrier: {
    id: 'wz_arcane_barrier', name: 'Celestial Arcane Barrier', icon: '/assets/sro/icons/skills/wizard_arcane_barrier.png', sroCode: 'SKILL_EU_WIZARD_BARRIER_A', tree: 'Wizard', classes: ['wizard'], type: 'buff', kind: 'buff',
    tier: 4, row: 3, col: 2, maxLevel: 10, reqLevel: 18, requires: ['wz_arcane_surge'],
    spCostBase: 24, spCostPerLv: 2.5, cooldown: 16, cooldownPerLv: -0.35,
    healPctBase: 0.30, healPctPerLv: 0.03,
    buff: (lv) => ({
      id: 'arcane_barrier', name: 'Celestial Arcane Barrier', icon: '/assets/sro/icons/skills/wizard_arcane_barrier.png', duration: 120 + lv * 12,
      mods: { defPct: 68 + lv * 6, matkPct: 32 + lv * 4, allRes: 32 + lv * 3, hpRegen: 8 + lv * 2.5 },
    }),
    invuln: 1.4, color: 0xa5b4fc, vfx: 'aegis', shake: 0.2,
    desc: 'Long barrier (2m+): heal, become untouchable for 1.4s, and gain colossal Defense (+68%) and Magic Attack.',
  },

  // ============================================================== ARCHER TREE (RANGER BOW)
  ar_power_shot: {
    id: 'ar_power_shot', name: 'Demon Soul Arrow — Sniper', icon: '/assets/sro/icons/skills/bow_normal_a.png', sroCode: 'SKILL_CH_BOW_NORMAL_A', tree: 'Archer', classes: ['archer'], type: 'active', kind: 'projectile', pierce: true,
    tier: 1, row: 0, col: 0, maxLevel: 10, reqLevel: 1, requires: [],
    spCostBase: 8, spCostPerLv: 1.4, cooldown: 2.4, cooldownPerLv: -0.06,
    multBase: 3.4, multPerLv: 0.40, critBonus: 28, range: 17, radius: 1.3, angle: 0, count: 1, speed: 40, knockback: 2.8, stun: 0.5,
    color: '#10b981', vfx: 'venom_shot', shake: 0.2,
    desc: 'Loose a supersonic piercing demon soul arrow with +28% bonus Critical Hit Rate.',
  },
  ar_multishot: {
    id: 'ar_multishot', name: 'Autumn Wind — 6-Arrow Volley', icon: '/assets/sro/icons/skills/bow_chain_a.png', sroCode: 'SKILL_CH_BOW_CHAIN_A', tree: 'Archer', classes: ['archer'], type: 'active', kind: 'projectile',
    tier: 1, row: 0, col: 1, maxLevel: 10, reqLevel: 2, requires: [],
    spCostBase: 11, spCostPerLv: 1.6, cooldown: 3.8, cooldownPerLv: -0.1,
    multBase: 3.2, multPerLv: 0.36, range: 13, radius: 1.2, angle: 0.72, count: 6, speed: 35, knockback: 1.8, stun: 0.3,
    color: '#22c55e', vfx: 'arrow_fan', shake: 0.2,
    desc: 'Rapidly fire a wide 6-arrow fan volley, shredding nearby and distant foes alike.',
  },
  ar_eagle_eye: {
    id: 'ar_eagle_eye', name: 'Mind Concentration — Hawk Eye', icon: '/assets/sro/icons/skills/bow_passive_a.png', sroCode: 'SKILL_CH_BOW_PASSIVE_A', tree: 'Archer', classes: ['archer'], type: 'buff', kind: 'buff',
    tier: 1, row: 0, col: 2, maxLevel: 10, reqLevel: 2, requires: [],
    spCostBase: 14, spCostPerLv: 2, cooldown: 10, cooldownPerLv: -0.2,
    multBase: 0, multPerLv: 0,
    buff: (lv) => ({
      id: 'eagle_eye', name: 'Mind Concentration — Hawk Eye', icon: '/assets/sro/icons/skills/bow_passive_a.png', duration: 180 + lv * 15,
      mods: { critRate: 18 + lv * 2.5, critDmg: 28 + lv * 5, hit: 18 + lv * 3, moveSpeedPct: 6 + lv },
    }),
    color: '#facc15', vfx: 'predator_aura', shake: 0.15,
    desc: 'Long stance (3m+): Hawk concentration grants massive Crit Rate (+18%), Crit Damage (+28%), Hit, and Move Speed.',
  },

  ar_frost_arrow: {
    id: 'ar_frost_arrow', name: 'Autumn Wind — Flame Piercer', icon: '/assets/sro/icons/skills/bow_pierce_a.png', sroCode: 'SKILL_CH_BOW_PIERCE_A', tree: 'Archer', classes: ['archer'], type: 'active', kind: 'projectile', pierce: true, element: 'ice',
    tier: 2, row: 1, col: 0, maxLevel: 10, reqLevel: 5, requires: ['ar_power_shot'],
    spCostBase: 14, spCostPerLv: 2, cooldown: 4.4, cooldownPerLv: -0.12,
    multBase: 3.7, multPerLv: 0.42, range: 15, radius: 2.6, angle: 0, count: 1, speed: 34, knockback: 2.0, stun: 1.5, stunPerLv: 0.1,
    color: '#f97316', vfx: 'phoenix_flight', shake: 0.25,
    desc: 'Loose an enchanted piercing elemental arrow that chills and freezes enemies along its path.',
  },
  ar_evasive_roll: {
    id: 'ar_evasive_roll', name: 'White Hawk Glide', icon: '/assets/sro/icons/skills/bow_call_a.png', sroCode: 'SKILL_CH_BOW_CALL_A', tree: 'Archer', classes: ['archer'], type: 'active', kind: 'dash',
    tier: 2, row: 1, col: 1, maxLevel: 10, reqLevel: 5, requires: ['ar_multishot'],
    spCostBase: 10, spCostPerLv: 1.0, cooldown: 3.8, cooldownPerLv: -0.15,
    multBase: 0, multPerLv: 0, range: 7.5, radius: 1.8, distance: 7.5, knockback: 0, stun: 0,
    invuln: 0.85, color: '#4ade80', vfx: 'wind_dash', shake: 0.1,
    desc: 'Summon the white hawk spirit to glide swiftly with 0.85s of complete invulnerability.',
  },
  ar_rally: {
    id: 'ar_rally', name: 'Bandage & Focus', icon: '/assets/sro/icons/skills/water_cure_a.png', sroCode: 'SKILL_CH_WATER_CURE_A', tree: 'Archer', classes: ['archer'], type: 'active', kind: 'heal',
    tier: 2, row: 1, col: 2, maxLevel: 10, reqLevel: 6, requires: ['ar_eagle_eye'],
    spCostBase: 16, spCostPerLv: 2.2, cooldown: 9.5, cooldownPerLv: -0.25,
    healPctBase: 0.32, healPctPerLv: 0.035,
    buff: (lv) => ({ id: 'rally', name: 'Bandage & Focus', icon: '/assets/sro/icons/skills/water_cure_a.png', duration: 18 + lv * 2, hot: { hps: 12 + lv * 6, mps: 3 + lv * 0.8 } }),
    color: 0x55ff88, vfx: 'heal', shake: 0.1,
    desc: 'Tend your wounds to restore 32% (+3.5%/Lv) Max HP and sustain rapid HP/SP regeneration (20s+).',
  },

  ar_explosive_arrow: {
    id: 'ar_explosive_arrow', name: 'Mind Bow — Flower Trap Blast', icon: '/assets/sro/icons/skills/bow_special_a.png', sroCode: 'SKILL_CH_BOW_SPECIAL_A', tree: 'Archer', classes: ['archer'], type: 'active', kind: 'projectile', element: 'fire',
    tier: 3, row: 2, col: 0, maxLevel: 10, reqLevel: 10, requires: ['ar_frost_arrow'],
    spCostBase: 18, spCostPerLv: 2.2, cooldown: 5.2, cooldownPerLv: -0.15,
    multBase: 4.1, multPerLv: 0.46, critBonus: 15, range: 15, radius: 4.8, angle: 0, count: 1, speed: 30, knockback: 4.2, stun: 0.9,
    color: '#84cc16', vfx: 'spike_trap', shake: 0.35,
    desc: 'Loose a flower trap explosive arrow that detonates in a wide radial firestorm.',
  },
  ar_rain_of_arrows: {
    id: 'ar_rain_of_arrows', name: 'Berserker Arrow Rain', icon: '/assets/sro/icons/skills/bow_area_a.png', sroCode: 'SKILL_CH_BOW_AREA_A', tree: 'Archer', classes: ['archer'], type: 'active', kind: 'aoe',
    tier: 3, row: 2, col: 1, maxLevel: 10, reqLevel: 11, requires: ['ar_evasive_roll'],
    spCostBase: 20, spCostPerLv: 2.4, cooldown: 6.2, cooldownPerLv: -0.15,
    multBase: 3.9, multPerLv: 0.44, hits: 4, range: 11.0, radius: 5.0, angle: PI2, knockback: 1.5, stun: 0.4,
    color: '#16a34a', vfx: 'arrow_rain', shake: 0.25,
    desc: 'Rain down a deadly 4-wave storm of arrows onto a wide target zone.',
  },
  ar_hunters_focus: {
    id: 'ar_hunters_focus', name: 'White Hawk Stance', icon: '/assets/sro/icons/skills/bow_critical_a.png', sroCode: 'SKILL_CH_BOW_CRITICAL_B', tree: 'Archer', classes: ['archer'], type: 'buff', kind: 'buff',
    tier: 3, row: 2, col: 2, maxLevel: 10, reqLevel: 12, requires: ['ar_rally'],
    spCostBase: 20, spCostPerLv: 2.2, cooldown: 14, cooldownPerLv: -0.3,
    buff: (lv) => ({
      id: 'hunters_focus', name: 'White Hawk Stance', icon: '/assets/sro/icons/skills/bow_critical_a.png', duration: 120 + lv * 12,
      mods: { attackSpeedPct: 32 + lv * 4, atkPct: 22 + lv * 3, moveSpeedPct: 16 + lv * 1.5, dodge: 10 + lv * 1.5 },
    }),
    color: 0x86efac, vfx: 'aura_gold', shake: 0.15,
    desc: 'Long stance (2m+): White Hawk boosts Attack Speed (+32% +4%/Lv), Attack, Move Speed, and Dodge.',
  },

  ar_storm_of_arrows: {
    id: 'ar_storm_of_arrows', name: 'Storm of Dragon Arrows — Ultimate', icon: '/assets/sro/icons/skills/bow_chain_a.png', sroCode: 'SKILL_CH_BOW_AREA_B', tree: 'Archer', classes: ['archer'], type: 'active', kind: 'aoe',
    tier: 4, row: 3, col: 0, maxLevel: 10, reqLevel: 18, requires: ['ar_explosive_arrow'],
    spCostBase: 30, spCostPerLv: 3.5, cooldown: 10.5, cooldownPerLv: -0.25,
    multBase: 5.8, multPerLv: 0.68, critBonus: 20, hits: 6, range: 12.0, radius: 6.0, angle: PI2, knockback: 2.4, stun: 0.7,
    armorPierce: 0.40, invuln: 0.6, color: 0xfef08a, vfx: 'judgment', shake: 0.5,
    desc: 'Ultimate technique: summon 6 waves of dragon arrows shredding 40% enemy armor across a huge zone.',
  },
  ar_piercing_gale: {
    id: 'ar_piercing_gale', name: 'Anti-Devil Bow — Annihilate', icon: '/assets/sro/icons/skills/bow_critical_a.png', sroCode: 'SKILL_CH_BOW_CRITICAL_A', tree: 'Archer', classes: ['archer'], type: 'active', kind: 'projectile', pierce: true, element: 'lightning',
    tier: 4, row: 3, col: 1, maxLevel: 10, reqLevel: 20, requires: ['ar_rain_of_arrows'],
    spCostBase: 28, spCostPerLv: 3.2, cooldown: 8.8, cooldownPerLv: -0.2,
    multBase: 5.4, multPerLv: 0.64, critBonus: 35, range: 18, radius: 1.8, angle: 0.42, count: 4, speed: 44, knockback: 3.0, stun: 0.9,
    armorPierce: 0.45, color: '#eab308', vfx: 'rail_arrow', shake: 0.38,
    desc: 'Anti-Devil Bow: loose 4 piercing lightning arrows with +35% Critical Rate and 45% armor pierce.',
  },
  ar_phantom_veil: {
    id: 'ar_phantom_veil', name: 'Ghost Hawk Veil', icon: '/assets/sro/icons/skills/bow_passive_a.png', sroCode: 'SKILL_CH_BOW_PASSIVE_B', tree: 'Archer', classes: ['archer'], type: 'buff', kind: 'buff',
    tier: 4, row: 3, col: 2, maxLevel: 10, reqLevel: 18, requires: ['ar_hunters_focus'],
    spCostBase: 24, spCostPerLv: 2.5, cooldown: 16, cooldownPerLv: -0.35,
    healPctBase: 0.28, healPctPerLv: 0.03,
    buff: (lv) => ({
      id: 'phantom_veil', name: 'Ghost Hawk Veil', icon: '/assets/sro/icons/skills/bow_passive_a.png', duration: 120 + lv * 12,
      mods: { dodge: 26 + lv * 3, critRate: 22 + lv * 2.5, atkPct: 28 + lv * 3.5, moveSpeedPct: 20 + lv * 1.5 },
    }),
    invuln: 1.1, color: 0xbbf7d0, vfx: 'aegis', shake: 0.2,
    desc: 'Long veil (2m+): heal, gain huge Dodge (+26%), Crit Rate (+22%), Attack, and Move Speed.',
  },
});

// =============================================================================
// Milestone 2: imbue skills (row 4), elemental statuses, timing overrides, chain skills
// =============================================================================
const imbueSkill = (id, name, icon, cls, tree, requires, element, status, color, desc, sroCode = '') => ({
  id, name, icon, tree, classes: [cls], type: 'buff', kind: 'imbue', instant: true, sroCode,
  tier: 5, row: 4, col: 1, maxLevel: 10, reqLevel: 24, requires: [requires],
  spCostBase: 14, spCostPerLv: 1.5, cooldown: 8, cooldownPerLv: -0.2,
  multBase: 0, multPerLv: 0, element, imbueStatus: status,
  // IMBUE_DEFAULTS scaled by level: bonus +6%/lv, long duration 120s + 15s/lv (up to 255s)
  imbue: (lv) => ({ element, bonusPct: IMBUE_DEFAULTS.bonusPct + 6 * (lv - 1), status, statusChance: IMBUE_DEFAULTS.statusChance + 2 * (lv - 1), duration: Math.round(IMBUE_DEFAULTS.duration + 15 * (lv - 1)) }),
  color, vfx: 'aura_gold', shake: 0.1, desc,
});
Object.assign(SKILL_DEFS, {
  radiant_edge: imbueSkill('radiant_edge', 'Radiant Edge', '/assets/sro/icons/skills/lightning_gigongta_b.png', 'knight', 'Knight', 'blade_storm', 'lightning', 'shock', 0xffee44,
    'Imbue your blade with lightning: attacks and skills deal bonus Lightning damage and may Shock enemies.', 'SKILL_CH_LIGHTNING_GIGONGTA_B'),
  ax_blood_rend: imbueSkill('ax_blood_rend', 'Blood Rend', '/assets/sro/icons/skills/fire_ganggi_a.png', 'axeman', 'Axeman', 'ax_executioner', 'physical', 'bleed', 0xdc2626,
    'Wreathe your axe in rending force: attacks and skills deal bonus damage and may cause Bleeding.', 'SKILL_CH_FIRE_GANGGI_A'),
  wz_frostfire_weave: imbueSkill('wz_frostfire_weave', 'Frostfire Weave', '/assets/sro/icons/skills/wizard_frostfire.png', 'wizard', 'Wizard', 'wz_prism_beam', 'ice', 'chill', 0x6fd4ff,
    'Weave frost into your spells: attacks and skills deal bonus Ice damage and may Chill enemies.', 'SKILL_EU_WIZARD_COLDA_IMBUE_A'),
  ar_venom_tips: imbueSkill('ar_venom_tips', 'Venom Tips', '/assets/sro/icons/skills/water_cure_a.png', 'archer', 'Archer', 'ar_piercing_gale', 'poison', 'poison', 0x7dff5a,
    'Coat your arrows in venom: attacks and skills deal bonus Poison damage and may Poison enemies.', 'SKILL_CH_WATER_CURE_B'),
});
for (const id of ['radiant_edge', 'ax_blood_rend', 'wz_frostfire_weave', 'ar_venom_tips']) { SKILL_DEFS[id].imbueElementLabel = SKILL_DEFS[id].element; }

// elemental / heavy-hit statuses: id -> [status, chance%]
const SKILL_STATUS = {
  power_strike: ['stun', 45], flame_slash: ['burn', 40], frost_nova: ['freeze', 75], thunder_wave: ['shock', 45], meteor_drop: ['burn', 50], blade_storm: ['shock', 45],
  ax_ground_slam: ['stun', 40], ax_earthsplitter: ['burn', 45], ax_executioner: ['stun', 50],
  wz_fireball: ['burn', 50], wz_glacial_nova: ['freeze', 75], wz_chain_lightning: ['shock', 50], wz_inferno_ring: ['burn', 40], wz_meteor: ['burn', 60], wz_prism_beam: ['shock', 45],
  ar_frost_arrow: ['chill', 60], ar_explosive_arrow: ['burn', 45], ar_piercing_gale: ['shock', 50],
};
for (const id in SKILL_STATUS) { SKILL_DEFS[id].status = SKILL_STATUS[id][0]; SKILL_DEFS[id].statusChance = SKILL_STATUS[id][1]; }

// per-skill timing overrides (seconds)
const SKILL_PREP = { ar_power_shot: 0.35, ar_frost_arrow: 0.35, ar_explosive_arrow: 0.38, ar_piercing_gale: 0.40, meteor_drop: 0.55, wz_meteor: 0.55, wz_fireball: 0.32 };
for (const id in SKILL_PREP) SKILL_DEFS[id].prep = SKILL_PREP[id];

// chain skills: `chain` holds fractions of the skill's total multiplier (frac sums to 1.0 so total damage == the old single hit)
Object.assign(SKILL_DEFS.flame_slash, {
  name: 'Flying Dragon — Sword Dance Qi', kind: 'chain', range: 4.2, radius: 4.2,
  chain: [
    { frac: 0.3, kind: 'melee_arc', range: 4.0, radius: 4.0, angle: 2.2, delay: 0.18, vfx: 'flame_slash', knockback: 1.2, stun: 0 },
    { frac: 0.3, kind: 'melee_arc', range: 4.0, radius: 4.0, angle: 2.4, delay: 0.20, vfx: 'flame_slash', knockback: 1.6, stun: 0 },
    { frac: 0.4, kind: 'aoe', range: 4.2, radius: 4.2, angle: PI2, delay: 0.24, vfx: 'slam', knockback: 3.0, stun: 0.4 },
  ],
  desc: 'A three-part sword dance combo: two blazing arcs, then a fiery ground slam. Each part needs an enemy in reach.',
});
Object.assign(SKILL_DEFS.ax_rending_chop, {
  name: 'Chain Twin-Axe — Tiger Cross', kind: 'chain', range: 3.3, radius: 3.3,
  chain: [
    { frac: 0.3, kind: 'melee_arc', range: 3.2, radius: 3.2, angle: 1.6, delay: 0.18, vfx: 'slash', knockback: 1.2, stun: 0 },
    { frac: 0.3, kind: 'melee_arc', range: 3.2, radius: 3.2, angle: 1.8, delay: 0.20, vfx: 'slash', knockback: 1.4, stun: 0 },
    { frac: 0.4, kind: 'melee_arc', range: 3.4, radius: 3.4, angle: 2.0, delay: 0.24, vfx: 'slam', knockback: 2.8, stun: 0.4 },
  ],
  desc: 'Two savage twin-axe chops and a crushing overhead finisher, all tearing through 30% of armor.',
});

export const SKILLS = SKILL_DEFS;

/** Legacy skill ID aliases mapped to canonical internal IDs */
export const SKILL_ALIASES = {
  // Knight (Aegis Sword & Shield Mastery)
  k_slash: 'power_strike',
  k_shield_bash: 'shield_bash',
  k_war_cry: 'battle_cry',
  k_whirlwind: 'whirlwind',
  k_holy_strike: 'healing_light',
  k_earthquake: 'flame_slash',
  k_iron_skin: 'aegis_barrier',
  k_avatar: 'blade_storm',

  // Axeman (Bloodaxe Dual-Axe & Fire Force Mastery)
  a_cleave: 'ax_cleave',
  a_leap: 'ax_leaping_strike',
  a_blood_rage: 'ax_bloodrage',
  a_rend: 'ax_rending_chop',
  a_whirl: 'ax_reaver_spin',
  a_execute: 'ax_executioner',
  a_war_stomp: 'ax_ground_slam',
  a_ragnarok: 'ax_earthsplitter',

  // Wizard (Cold, Lightning & Fire Force Mastery)
  w_fireball: 'wz_fireball',
  w_frost_nova: 'wz_glacial_nova',
  w_chain_lightning: 'wz_chain_lightning',
  w_teleport: 'wz_blink',
  w_meteor: 'wz_meteor',
  w_blizzard: 'wz_inferno_ring',
  w_mana_shield: 'wz_mana_ward',
  w_archon: 'wz_arcane_surge',

  // Archer (Ranger Bow Mastery)
  r_multi_shot: 'ar_multishot',
  r_poison_arrow: 'ar_power_shot',
  r_evade_roll: 'ar_evasive_roll',
  r_trap: 'ar_explosive_arrow',
  r_piercing: 'ar_piercing_gale',
  r_rain: 'ar_rain_of_arrows',
  r_hawk_eye: 'ar_eagle_eye',
  r_phoenix: 'ar_frost_arrow',
};

// Register aliases directly in SKILL_DEFS with matching metadata
for (const [aliasId, baseId] of Object.entries(SKILL_ALIASES)) {
  const base = SKILL_DEFS[baseId];
  if (base) {
    SKILL_DEFS[aliasId] = {
      ...base,
      id: aliasId,
      aliasOf: baseId,
      classId: Array.isArray(base.classes) && base.classes.length ? base.classes[0] : 'knight',
    };
  }
}

/** Is a skill usable by this class? (no `classes` = shared) */
export function skillAllowedForClass(def, classId) {
  if (!def) return false;
  if (!Array.isArray(def.classes) || !def.classes.length) return true;
  return def.classes.includes(String(classId || DEFAULT_CLASS).toLowerCase());
}

/** First skill (row 0, col 0) of a class tree. */
export function getStarterSkillId(classId) {
  const cid = getClass(classId).id;
  const d = Object.values(SKILL_DEFS).find((s) => !s.aliasOf && Array.isArray(s.classes) && s.classes.includes(cid) && s.row === 0 && s.col === 0 && s.type !== 'passive');
  return d ? d.id : 'power_strike';
}

export function registerSkill(def) {
  if (!def || !def.id) return null;
  SKILL_DEFS[def.id] = { ...SKILL_DEFS[def.id], ...def };
  return SKILL_DEFS[def.id];
}

export function getSkillDef(id) {
  if (!id) return null;
  return SKILL_DEFS[id] || (SKILL_ALIASES[id] ? SKILL_DEFS[SKILL_ALIASES[id]] : null);
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
    this._hasActiveCooldowns = false;
    this.hotbar = ['power_strike', null, null, null, null, null, null, null, null];
    this._barSlots = DEFAULT_HOTBAR_KEYS.map((key, i) => ({
      slot: i,
      key,
      id: '',
      skillId: '',
      name: '',
      icon: '✨',
      level: 1,
      cooldown: 0,
      cooldownMax: 0,
      spCost: 0,
      mpCost: 0,
      ready: true,
    }));
  }

  // ---- compatibility aliases -----------------------------------------------
  get equippedSkills() { return this.hotbar; }
  set equippedSkills(v) {
    if (Array.isArray(v)) {
      const next = v.slice(0, 9);
      while (next.length < 9) next.push(null);
      this.hotbar = next;
    }
  }
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

  _resolveId(id) {
    if (!id) return null;
    return SKILL_ALIASES[id] || id;
  }

  _classId() { return this.game ? (this.game.classId || DEFAULT_CLASS) : DEFAULT_CLASS; }
  _classOk(def) { return !this.game || skillAllowedForClass(def, this._classId()); }

  grantStarterSkills(classId = this._classId()) {
    const cid = getClass(classId).id;
    const starters = Object.values(SKILL_DEFS).filter((s) => !s.aliasOf && Array.isArray(s.classes) && s.classes.includes(cid) && s.row === 0);
    this.levels = {};
    for (const s of starters) {
      this.levels[s.id] = 1;
    }
    if (!Object.keys(this.levels).length) {
      this.levels[getStarterSkillId(cid)] = 1;
    }
    this.cooldowns = {};
    this.cooldownTotals = {};
    this._hasActiveCooldowns = false;
    this.hotbar = [
      starters[0]?.id || getStarterSkillId(cid),
      starters[1]?.id || null,
      starters[2]?.id || null,
      null,
      null,
      null,
      null,
      null,
      null
    ];
    if (this.game) this.game.markDirty();
  }

  get(id) { return this.getSkillView(id); }
  getLevel(id) {
    const rid = this._resolveId(id);
    return (this.levels[rid] ?? this.levels[id]) | 0;
  }

  /** Compute effective SP (mana) cost at a given skill level. */
  getSpCost(id, lv = null) {
    const rid = this._resolveId(id);
    const def = SKILL_DEFS[rid] || SKILL_DEFS[id];
    if (!def || def.type === 'passive') return 0;
    const L = Math.max(1, lv != null ? lv : (this.getLevel(rid) || 1));
    return Math.max(1, Math.round(num(def.spCostBase, num(def.spCost, 10)) + num(def.spCostPerLv, 0) * (L - 1)));
  }

  /** Compute effective cooldown (seconds) at a given skill level, factoring hero CDR. */
  getBaseCooldown(id, lv = null) {
    const rid = this._resolveId(id);
    const def = SKILL_DEFS[rid] || SKILL_DEFS[id];
    if (!def || def.type === 'passive') return 0;
    const L = Math.max(1, lv != null ? lv : (this.getLevel(rid) || 1));
    const raw = Math.max(0.5, num(def.cooldown, 4) + num(def.cooldownPerLv, 0) * (L - 1));
    const cdr = this.game ? num(this.game.getStats().cooldownReduction, 0) : 0;
    return Math.round(Math.max(0.4, raw * (1 - clamp(cdr, 0, 50) / 100)) * 10) / 10;
  }

  /** Compute effective damage multiplier at a given skill level. */
  getDamageMult(id, lv = null) {
    const rid = this._resolveId(id);
    const def = SKILL_DEFS[rid] || SKILL_DEFS[id];
    if (!def) return 1;
    const L = Math.max(1, lv != null ? lv : (this.getLevel(rid) || 1));
    return Math.round((num(def.multBase, 1.4) + num(def.multPerLv, 0.15) * (L - 1)) * 100) / 100;
  }

  /** Check if a skill can be learned/upgraded right now. */
  canLearn(id) {
    const rid = this._resolveId(id);
    const def = SKILL_DEFS[rid] || SKILL_DEFS[id];
    if (!def) return { ok: false, reason: 'Unknown skill' };
    if (!this._classOk(def)) return { ok: false, reason: 'Not available for your class' };
    const lv = this.getLevel(rid);
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
    const rid = this._resolveId(id);
    const def = SKILL_DEFS[rid] || SKILL_DEFS[id];
    if (this.game) this.game.hero.sp = Math.max(0, this.game.hero.sp - 1);
    const newLv = (this.levels[rid] | 0) + 1;
    this.levels[rid] = newLv;
    // Auto-assign newly learned active/buff skill to 1-5 first, then any truly empty 6-9 slot
    if (newLv === 1 && def.type !== 'passive' && !this.hotbar.includes(rid) && !this.hotbar.includes(id)) {
      let empty = this.hotbar.slice(0, 5).indexOf(null);
      if (empty < 0) {
        const qs = this.game?.inventory?.quickSlots;
        for (let i = 5; i < 9; i++) {
          if (this.hotbar[i] == null && (!qs || qs[i - 5] == null)) { empty = i; break; }
        }
      }
      if (empty >= 0) this.hotbar[empty] = rid;
    }
    this._emit('skill:learned', rid, newLv);
    this._changed(def.type === 'passive');
    return { ok: true, msg: `${def.name} upgraded to Lv ${newLv}!`, level: newLv };
  }
  learnOrUpgradeSkill(id) { return this.learn(id); }
  levelSkill(id) { return this.learn(id); }

  /**
   * Assign an active/buff skill to a hotbar slot (0..8 -> keys 1..9).
   * Accepts both `assign(slotIdx, skillId)` and `assign(skillId, slotIdx)`.
   */
  assign(slotOrId, idOrSlot) {
    let slot, id;
    if (typeof slotOrId === 'number' || (/^[0-8]$/.test(String(slotOrId)) && typeof idOrSlot === 'string' && !/^[0-8]$/.test(idOrSlot))) {
      slot = Number(slotOrId);
      id = idOrSlot;
    } else {
      id = slotOrId;
      slot = Number(idOrSlot);
    }
    if (!Number.isInteger(slot) || slot < 0 || slot >= 9) return { ok: false, msg: 'Invalid hotkey slot' };
    while (this.hotbar.length < 9) this.hotbar.push(null);
    if (!id) {
      this.hotbar[slot] = null;
      this._changed();
      return { ok: true, msg: `Cleared slot ${slot + 1}` };
    }
    const rid = this._resolveId(id);
    const def = SKILL_DEFS[rid] || SKILL_DEFS[id];
    if (!def) return { ok: false, msg: 'Unknown skill' };
    if (!this._classOk(def)) return { ok: false, msg: 'Not available for your class' };
    if (def.type === 'passive') return { ok: false, msg: 'Passive skills are always active' };
    if (this.getLevel(rid) <= 0) return { ok: false, msg: 'Learn this skill first' };
    for (let i = 0; i < this.hotbar.length; i++) if (this.hotbar[i] === rid || this.hotbar[i] === id) this.hotbar[i] = null;
    this.hotbar[slot] = rid;
    // If placed into quick-bar slots 6-9 (index 5..8), clear any consumable sitting in that slot
    if (slot >= 5 && this.game?.inventory?.quickSlots && this.game.inventory.quickSlots[slot - 5] != null) {
      this.game.inventory.quickSlots[slot - 5] = null;
      this.game.inventory._changed?.();
    }
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
    this.hotbar = [starter, null, null, null, null, null, null, null, null];
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
    if (!this._hasActiveCooldowns) return;
    dt = clamp(num(dt), 0, 0.5);
    if (dt <= 0) return;
    let anyActive = false;
    const cds = this.cooldowns;
    for (const id in cds) {
      const rem = cds[id];
      if (rem > 0) {
        const next = rem - dt;
        if (next > 0) {
          cds[id] = next;
          anyActive = true;
        } else {
          cds[id] = 0;
        }
      }
    }
    this._hasActiveCooldowns = anyActive;
  }
  updateCooldowns(dt) { this.update(dt); }

  getCooldown(id) {
    const rid = this._resolveId(id);
    const remaining = Math.max(0, num(this.cooldowns[rid] ?? this.cooldowns[id], 0));
    const total = Math.max(remaining, num(this.cooldownTotals[rid] ?? this.cooldownTotals[id], this.getBaseCooldown(rid)));
    return { remaining, total, pct: total > 0 ? remaining / total : 0, ready: remaining <= 0 };
  }

  _resolveSkillId(idOrSlot) {
    if (typeof idOrSlot === 'number' || /^[0-4]$/.test(String(idOrSlot))) {
      return this._resolveId(this.hotbar[Number(idOrSlot)] || null);
    }
    return this._resolveId(idOrSlot || null);
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
    if (totalCd > 0) this._hasActiveCooldowns = true;

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
    const rollOpts = { element: def.element || null, magic: !!def.magic, armorPierce: def.armorPierce || 0, critBonus: num(def.critBonus, 0) };
    const statusOf = (src) => ({ status: src.status ?? def.status ?? null, statusChance: src.statusChance ?? def.statusChance ?? 0 });
    const roller = (m, src) => (targetDefStats = {}) => (g
      ? g.rollAttack(targetDefStats, { ...rollOpts, mult: m, ...statusOf(src) })
      : { damage: Math.round(20 * m), crit: false, miss: false, element: def.element || null, status: null });
    const chain = def.kind === 'chain' && Array.isArray(def.chain)
      ? def.chain.map((seg) => {
        const m = Math.round(mult * num(seg.frac, 1 / def.chain.length) * 100) / 100;
        return {
          mult: m, kind: seg.kind || 'melee_arc', range: seg.range ?? def.range ?? 3, angle: seg.angle ?? def.angle ?? 2, radius: seg.radius ?? seg.range ?? def.radius ?? 3,
          hits: seg.hits || 1, delay: seg.delay ?? 0.2, vfx: seg.vfx || def.vfx || def.id, count: seg.count || 1, speed: seg.speed || def.speed || 14, pierce: !!(seg.pierce ?? def.pierce),
          knockback: seg.knockback ?? def.knockback ?? 1, stun: seg.stun ?? 0, shake: seg.shake ?? def.shake ?? 0.2, color: seg.color ?? def.color ?? 0xffaa33,
          magic: !!def.magic, element: def.element || 'physical', armorPierce: def.armorPierce || 0,
          ...statusOf(seg), rollDamage: roller(m, seg),
        };
      })
      : null;
    let imbueApplied = null;
    if (g && def.kind === 'imbue' && typeof def.imbue === 'function') {
      const im = def.imbue(level);
      imbueApplied = { element: im.element, bonusPct: im.bonusPct, status: im.status, statusChance: im.statusChance };
      const b = { id: 'imbue', name: def.name, icon: def.icon, duration: im.duration, imbue: imbueApplied };
      g.addBuff(b);
      buffApplied = b;
    }
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
      imbue: imbueApplied,
      ...skillTiming(def),
      chain,
      status: def.status || null,
      statusChance: def.statusChance || 0,
      rollDamage: roller(mult, def),
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
      status: def.status || null,
      statusChance: def.statusChance || 0,
      chain: Array.isArray(def.chain) ? def.chain.length : 0,
      instant: skillTiming(def).instant,
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
    const all = Object.keys(SKILL_DEFS)
      .filter((id) => !SKILL_DEFS[id].aliasOf && this._classOk(SKILL_DEFS[id]))
      .map((id) => this.getSkillView(id));
    return tree ? all.filter((s) => s.tree.toLowerCase() === String(tree).toLowerCase()) : all;
  }
  getTreeView() { return this.list(); }

  _populateBarSlot(target, i, key) {
    const id = this.hotbar[i];
    if (!id || !SKILL_DEFS[id]) return null;
    const def = SKILL_DEFS[id];
    const rid = this._resolveId(id);
    const level = Math.max(1, this.getLevel(rid));
    const remaining = Math.max(0, num(this.cooldowns[rid] ?? this.cooldowns[id], 0));
    const cdTotalRaw = this.cooldownTotals[rid] ?? this.cooldownTotals[id];
    const baseCd = this.getBaseCooldown(rid, level);
    const total = Math.max(remaining, cdTotalRaw != null ? num(cdTotalRaw, baseCd) : baseCd);
    const spCost = this.getSpCost(rid, level);
    target.slot = i;
    target.key = key;
    target.id = def.id;
    target.skillId = def.id;
    target.name = def.name;
    target.icon = def.icon || '✨';
    target.level = level;
    target.cooldown = remaining;
    target.cooldownMax = total || baseCd;
    target.spCost = spCost;
    target.mpCost = spCost;
    target.ready = remaining <= 0 && (!this.game || this.game.hero.mp >= spCost);
    return target;
  }

  /** Zero-allocation hotbar view for 60fps HUD updates; updates pre-allocated slot objects in `out`. */
  fillSkillBar(out = []) {
    const slots = this._barSlots;
    for (let i = 0; i < DEFAULT_HOTBAR_KEYS.length; i++) {
      out[i] = this._populateBarSlot(slots[i], i, DEFAULT_HOTBAR_KEYS[i]);
    }
    if (out.length !== DEFAULT_HOTBAR_KEYS.length) out.length = DEFAULT_HOTBAR_KEYS.length;
    return out;
  }

  getSkillBar() {
    return DEFAULT_HOTBAR_KEYS.map((key, i) => this._populateBarSlot({}, i, key));
  }

  // ---- Save / Load -----------------------------------------------------------
  toJSON() {
    return {
      levels: { ...this.levels },
      hotbar: this.hotbar.slice(0, 9),
    };
  }

  fromJSON(d = {}) {
    const starter = getStarterSkillId(this._classId());
    this.levels = { [starter]: 1 };
    for (const [id, lv] of Object.entries(d.levels || {})) {
      const rid = this._resolveId(id);
      if (SKILL_DEFS[rid] && this._classOk(SKILL_DEFS[rid])) this.levels[rid] = lv;
    }
    if (Array.isArray(d.hotbar)) {
      this.hotbar = d.hotbar.slice(0, 9).map((id) => {
        if (!id) return null;
        const rid = this._resolveId(id);
        return SKILL_DEFS[rid] && this._classOk(SKILL_DEFS[rid]) && this.levels[rid] > 0 ? rid : null;
      });
      while (this.hotbar.length < 9) this.hotbar.push(null);
    } else {
      this.hotbar = [starter, null, null, null, null, null, null, null, null];
    }
    this.cooldowns = {};
    this.cooldownTotals = {};
    this._hasActiveCooldowns = false;
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

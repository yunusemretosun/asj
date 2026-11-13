// =============================================================================
// ASJ (ARKENVEIL: SIGILS & JOURNEYS) - Milestone 2 shared mechanics contract.
// Alchemy (+N enhancement), rarity seals, elemental imbue, status effects,
// skill timing phases and chain attacks. Pure data/logic: no DOM / three.js.
// Owned by coordinator; rpg-systems, engine-3d, world-ai and ui-hud import from it.
// =============================================================================

// ----------------------------------------------------------------------------- ALCHEMY
export const ALCHEMY = {
  maxPlus: 10,
  fuseSeconds: 3,            // channel time; moving / attacking / taking a hit cancels (nothing consumed)
  // Base success % for reaching +N (index = target plus - 1), elixir only.
  elixirChance: [70, 60, 50, 40, 32, 25, 19, 14, 10, 7],
  // Extra % from a Luck Powder whose grade matches the item's tier band.
  powderBonus: [25, 22, 18, 15, 12, 10, 8, 6, 5, 4],
  // Failure: item drops to +0 (it never breaks). With a Guardian Talisman it only loses 1.
  failResetTo: 0,
  // Stat scaling per + level on the item's scalable base stats (atkMin/atkMax/matk/def/hp/mp/atk).
  // Significantly increased from 8% to 15% per plus so enhancing is deeply rewarding!
  perPlusPct: 15,
  // Milestone bonuses at key enhancement thresholds (+3, +5, +7, +9, +10)
  milestones: {
    weapon: {
      3: { critRate: 2, atk: 8, label: '+2% Crit, +8 Atk' },
      5: { critRate: 4, attackSpeedPct: 7, atk: 22, label: '+4% Crit, +7% Atk Spd, +22 Atk' },
      7: { critRate: 7, attackSpeedPct: 14, atk: 50, allAttrs: 6, label: '+7% Crit, +14% Atk Spd, +50 Atk, +6 All Stats' },
      9: { critRate: 11, attackSpeedPct: 20, atk: 90, allAttrs: 14, label: '+11% Crit, +20% Atk Spd, +90 Atk, +14 All Stats' },
      10: { critRate: 16, attackSpeedPct: 28, atk: 160, allAttrs: 28, label: '★ GODLIKE: +16% Crit, +28% Atk Spd, +160 Atk, +28 All Stats' },
    },
    armor: {
      3: { hp: 50, def: 10, label: '+50 HP, +10 Def' },
      5: { hp: 140, def: 24, damageAbsorbPct: 6, label: '+140 HP, +24 Def, +6% Absorb' },
      7: { hp: 300, def: 52, damageAbsorbPct: 12, allAttrs: 6, label: '+300 HP, +52 Def, +12% Absorb, +6 All Stats' },
      9: { hp: 550, def: 95, damageAbsorbPct: 18, allAttrs: 14, label: '+550 HP, +95 Def, +18% Absorb, +14 All Stats' },
      10: { hp: 1000, def: 180, damageAbsorbPct: 28, allAttrs: 28, label: '★ GODLIKE: +1000 HP, +180 Def, +28% Absorb, +28 All Stats' },
    }
  },
  // Visual glow bands (engine): +1..+3 faint, +4..+6 strong, +7..+9 strong + glint trail, +10 aura.
  glowBands: [{ min: 1, level: 1 }, { min: 4, level: 2 }, { min: 7, level: 3 }, { min: 10, level: 4 }],
  announceAt: 7,             // toast "X enhanced Y to +N!" when reaching this or higher
  goldCost: (plus, tier) => Math.round((40 + tier * 35) * Math.pow(plus + 1, 1.7)),
};

/** Elixir kind for an equipment slot. */
export function elixirKindForSlot(slot) {
  if (slot === 'weapon') return 'weapon';
  if (slot === 'shield') return 'shield';
  if (slot === 'necklace' || slot === 'ring') return 'accessory';
  return 'armor';
}

/** Luck powder grade (1..4) matching an item tier (0..7): tiers 0-1 -> 1, 2-3 -> 2, 4-5 -> 3, 6-7 -> 4. */
export function powderGradeForTier(tier) {
  return Math.min(4, Math.max(1, Math.floor((tier | 0) / 2) + 1));
}

export function alchemyChance(targetPlus, { powder = false, rarityBonus = 0 } = {}) {
  const i = Math.max(0, Math.min(ALCHEMY.maxPlus - 1, (targetPlus | 0) - 1));
  return Math.max(1, Math.min(100, ALCHEMY.elixirChance[i] + (powder ? ALCHEMY.powderBonus[i] : 0) + rarityBonus));
}

export function glowLevel(plus) {
  let lv = 0;
  for (const b of ALCHEMY.glowBands) if ((plus | 0) >= b.min) lv = b.level;
  return lv;
}

// ----------------------------------------------------------------------------- RARITY SEALS
// A seal is an extra quality layer on top of normal rarity (normal/magic/rare/epic/unique).
// Seals only roll on set pieces and generic equipment from monsters/chests (never shops).
// Rebalanced: Star is rare & prestigious, Moon is legendary, Sun is god-tier mythical.
export const SEALS = {
  star: { id: 'star', name: 'Seal of Star', short: '★', color: '#7dd3fc', statMult: 1.0, perPlusMult: 1.0, critRate: 1, priceMult: 1.5, dropPct: 0.35 },
  moon: { id: 'moon', name: 'Seal of Moon', short: '☾', color: '#c4b5fd', statMult: 1.3, perPlusMult: 1.16, critRate: 2, priceMult: 2.2, dropPct: 0.08, minLevel: 10 },
  sun: { id: 'sun', name: 'Seal of Sun', short: '☀', color: '#fbbf24', statMult: 1.6, perPlusMult: 1.35, critRate: 3, priceMult: 3.5, dropPct: 0.02, minLevel: 20 },
};
export const SEAL_ORDER = ['sun', 'moon', 'star']; // rolled rarest first

/** Roll a seal id or null. Boss/giant/elite multiply chances. */
export function rollSeal(level = 1, { isBoss = false, isGiant = false, isElite = false, magicFind = 0 } = {}) {
  const mult = (isBoss ? 8.0 : isGiant ? 3.5 : isElite ? 1.8 : 1.0) * (1 + Math.max(0, magicFind) / 250);
  for (const id of SEAL_ORDER) {
    const s = SEALS[id];
    if (s.minLevel && level < s.minLevel) continue;
    if (Math.random() * 100 < s.dropPct * mult) return id;
  }
  return null;
}

// ----------------------------------------------------------------------------- STATUS EFFECTS
// Applied to enemies by imbue / elemental skills. Engine/world implement the behaviour.
export const STATUS = {
  burn: { id: 'burn', name: 'Burn', element: 'fire', duration: 4, dotPctOfHit: 0.12, tick: 1, color: 0xff5522 },
  freeze: { id: 'freeze', name: 'Frozen', element: 'ice', duration: 1.6, slowPct: 100, color: 0x6fd4ff },
  chill: { id: 'chill', name: 'Chilled', element: 'ice', duration: 3, slowPct: 40, color: 0x93c5fd },
  shock: { id: 'shock', name: 'Shocked', element: 'lightning', duration: 2.5, dmgTakenPct: 15, color: 0xffee44 },
  poison: { id: 'poison', name: 'Poisoned', element: 'poison', duration: 5, dotPctOfHit: 0.08, tick: 1, color: 0x7dff5a },
  stun: { id: 'stun', name: 'Stunned', element: 'physical', duration: 1.0, color: 0xffffff },
  bleed: { id: 'bleed', name: 'Bleeding', element: 'physical', duration: 4, dotPctOfHit: 0.1, tick: 1, color: 0xdc2626 },
};

// ----------------------------------------------------------------------------- IMBUE
// Imbue = instant self-buff (does not interrupt current action): for `duration` seconds every
// basic attack / skill hit deals extra elemental damage (% of the hit) and may apply a status.
export const IMBUE_DEFAULTS = { duration: 120, bonusPct: 24, statusChance: 28 };

// ----------------------------------------------------------------------------- SKILL TIMING
// Phases (seconds) used by the engine to sequence skills:
//   prep    : wind-up / draw / channel pose, cancellable by moving (resources NOT refunded)
//   release : the moment damage is rolled / projectile spawns
//   recover : follow-through; no new action until it ends
// Instant skills (imbue, most buffs) have prep 0 and don't interrupt the current action.
export const TIMING_DEFAULTS = {
  melee_arc: { prep: 0.18, recover: 0.22 },
  nova: { prep: 0.25, recover: 0.25 },
  aoe: { prep: 0.45, recover: 0.3 },
  projectile: { prep: 0.3, recover: 0.2 },
  dash: { prep: 0.05, recover: 0.2 },
  heal: { prep: 0.35, recover: 0.15 },
  buff: { prep: 0, recover: 0, instant: true },
  imbue: { prep: 0, recover: 0, instant: true },
  chain: { prep: 0.12, recover: 0.18 },
};

export function skillTiming(def = {}) {
  const base = TIMING_DEFAULTS[def.kind] || TIMING_DEFAULTS.melee_arc;
  return {
    prep: def.prep ?? base.prep,
    recover: def.recover ?? base.recover,
    instant: def.instant ?? !!base.instant,
  };
}

// ----------------------------------------------------------------------------- CHAINS
// kind:'chain' skills carry `chain: [{ mult, kind, range, angle, radius, hits, delay, vfx, status }]`.
// Only the head costs MP / starts the cooldown. Segment i+1 starts `delay` s after segment i
// releases, and only if at least one enemy is still within `range` (else the chain ends early).

// =============================================================================
// MILESTONE 5 — Silkroad-Inspired Combat Juice, Nemesis, Boss Aegis, Hot Springs & Jobs
// =============================================================================

// ----------------------------------------------------------------------------- BERSERK (HWAN) GAUGE
export const BERSERK = {
  maxOrbs: 5,
  maxCharge: 100,            // 20 charge per orb (5 orbs = 100)
  chargePerOrb: 20,
  gainNormal: 12,            // charge gained on normal monster kill
  gainElite: 35,             // charge gained on elite monster kill
  gainBoss: 100,             // boss kill fills all 5 orbs
  duration: 20,              // seconds of active Berserk transformation
  damageMult: 2.0,           // 2x physical & magical damage
  moveSpeedMult: 1.38,       // +38% movement speed
  atkSpeedMult: 1.3,         // +30% attack speed
  scaleMult: 1.12,           // hero mesh scale multiplier while Berserk
  color: 0xfbbf24,           // golden-amber lightning aura
};

export function berserkOrbs(charge = 0) {
  return Math.max(0, Math.min(BERSERK.maxOrbs, Math.floor((Number(charge) || 0) / BERSERK.chargePerOrb)));
}

// ----------------------------------------------------------------------------- RARITY BEAMS & DROP TOSS
export const RARITY_BEAMS = {
  tossDuration: 0.45,        // seconds for parabolic drop toss arc
  tossApex: 0.75,            // peak height (m) of drop toss arc
  star: {
    seal: 'star',
    height: 3.6,
    radius: 0.28,
    ringRadius: 0.85,
    color: 0x38bdf8,
    orbitCount: 2,
  },
  moon: {
    seal: 'moon',
    height: 6.0,
    radius: 0.36,
    ringRadius: 1.15,
    color: 0xc084fc,
    orbitCount: 3,
  },
  sun: {
    seal: 'sun',
    height: 9.2,
    radius: 0.48,
    ringRadius: 1.45,
    color: 0xfbbf24,
    orbitCount: 4,
  },
};

// ----------------------------------------------------------------------------- NEMESIS SYSTEM
export const NEMESIS = {
  maxRank: 5,
  hpMultBase: 1.85,          // +85% HP at Rank 1 (+25% per extra rank)
  atkMultBase: 1.4,          // +40% ATK at Rank 1 (+12% per extra rank)
  scaleBase: 1.42,           // 1.42x mesh scale
  alertRadius: 28,           // HUD warning & minimap pulse distance
  refundGoldRatio: 0.5,      // 50% of lost gold refunded + bonus bounty
  expBonusMult: 2.5,         // 2.5x monster EXP on vengeance kill
  color: 0xef4444,           // crimson menace aura
  titlesByClass: {
    knight: ['the Shield-Breaker', 'the Knight-Bane', 'the Iron-Crusher'],
    axeman: ['the Berserk-Slayer', 'the Axe-Shatterer', 'the Blood-Reaver'],
    wizard: ['the Spell-Eater', 'the Mage-Bane', 'the Arcane-Scourge'],
    archer: ['the Bow-Snapper', 'the Wind-Stalker', 'the Arrow-Bane'],
    default: ['the Hero-Slayer', 'the Unforgiven', 'the Dread-Stalker'],
  },
};

export function createNemesisTitle(monsterName = 'Monster', classId = 'knight', rank = 1) {
  const list = NEMESIS.titlesByClass[classId] || NEMESIS.titlesByClass.default;
  const suffix = list[(Math.max(1, rank) - 1) % list.length];
  const numeral = ['I', 'II', 'III', 'IV', 'V'][Math.max(0, Math.min(4, (rank | 0) - 1))] || 'I';
  return `${monsterName} ${suffix} (${numeral})`;
}

// ----------------------------------------------------------------------------- BOSS FURY & AEGIS CRYSTALS
export const BOSS_MECHANICS = {
  furyTimerSeconds: 180,     // 3-minute countdown before boss enters Fury Mode
  enrageHpRatio: 0.25,       // boss also enters Fury when HP drops to <= 25%
  furyAtkMult: 1.55,         // +55% damage in Fury mode
  furySpeedMult: 1.35,       // +35% speed in Fury mode
  aegisTriggerRatio: 0.55,   // at 55% HP, boss summons 3 Elemental Aegis Crystals
  aegisCrystalCount: 3,
  aegisDamageReduction: 0.8, // 80% damage reduction while any Aegis crystal stands
  aegisCrystalHpRatio: 0.12, // each crystal has 12% of boss maxHp
};

// ----------------------------------------------------------------------------- JADE MIST HOT SPRINGS & RESTED EXP
export const HOT_SPRINGS = {
  center: { x: -16, z: -14 },
  radius: 4.5,
  hpRegenPctPerSec: 0.12,    // 12% max HP restored per second while soaking
  mpRegenPctPerSec: 0.15,    // 15% max MP restored per second while soaking
  restedGainPctPerSec: 0.04, // gains 4% of maxExp as Rested EXP pool per second soaking
  maxRestedRatio: 0.5,       // Rested EXP pool caps at 50% of current level's maxExp
  bonusExpMult: 0.5,         // +50% bonus combat EXP drawn from Rested EXP pool
};


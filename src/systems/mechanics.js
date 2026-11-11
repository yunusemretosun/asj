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
  perPlusPct: 8,
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
export const SEALS = {
  star: { id: 'star', name: 'Seal of Star', short: '★', color: '#7dd3fc', statMult: 1.0, perPlusMult: 1.0, critRate: 1, priceMult: 1.5, dropPct: 2.5 },
  moon: { id: 'moon', name: 'Seal of Moon', short: '☾', color: '#c4b5fd', statMult: 1.3, perPlusMult: 1.16, critRate: 2, priceMult: 2.2, dropPct: 0.8, minLevel: 10 },
  sun: { id: 'sun', name: 'Seal of Sun', short: '☀', color: '#fbbf24', statMult: 1.6, perPlusMult: 1.35, critRate: 3, priceMult: 3.5, dropPct: 0.25, minLevel: 20 },
};
export const SEAL_ORDER = ['sun', 'moon', 'star']; // rolled rarest first

/** Roll a seal id or null. Boss/elite multiply chances. */
export function rollSeal(level = 1, { isBoss = false, isElite = false, magicFind = 0 } = {}) {
  const mult = (isBoss ? 4 : isElite ? 2 : 1) * (1 + Math.max(0, magicFind) / 200);
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
export const IMBUE_DEFAULTS = { duration: 6, bonusPct: 20, statusChance: 25 };

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

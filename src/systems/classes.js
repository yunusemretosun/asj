// =============================================================================
// ASJ (ARKENVEIL: SIGILS & JOURNEYS) - Hero classes & appearance contract.
// Shared by rpg-systems, engine-3d, ui-hud and coordinator. Pure logic (no DOM / three.js).
//
// A hero picks ONE class at character creation; it can never change afterwards.
// Class decides: usable weapon subtypes, shield access, basic attack style,
// starting attributes, flat class bonuses, starter gear and skill tree.
// Armor / helmet / boots / necklace / ring are usable by every class.
// =============================================================================

export const DEFAULT_CLASS = 'knight';
export const CLASS_IDS = ['knight', 'axeman', 'wizard', 'archer'];

/**
 * attackStyle:
 *   'melee'      - sword-and-board 3-hit combo arc (existing behaviour)
 *   'melee_heavy'- slower, wider, harder-hitting axe cleaves
 *   'magic_bolt' - fires a homing-ish arcane bolt projectile, damage from MATK (rollAttack {magic:true})
 *   'arrow'      - fires a fast straight arrow projectile, damage from ATK
 */
export const CLASSES = {
  knight: {
    id: 'knight',
    primary: 'str',
    name: 'Knight',
    plural: 'Knights',
    icon: '🛡️',
    tagline: 'Sword & shield guardian',
    desc: 'A sturdy frontline fighter. Wields swords or maces with a shield, blocks well and shrugs off punishment.',
    weapons: ['sword', 'mace'],
    shield: true,
    twoHanded: false,
    attackStyle: 'melee',
    attackRange: 2.4,
    startAttrs: { str: 7, dex: 5, int: 3, lck: 5 },
    statMods: { defPct: 12, hpPct: 10, block: 5 },
    starter: { weapon: 'sword_1', shield: 'shield_1', armor: 'armor_1' },
    skillTree: 'Knight',
    mastery: 'Bicheon (Sword & Shield)',
    sroMastery: 'Bicheon',
    color: 0x38bdf8,
    css: '#38bdf8',
    difficulty: 'Easy',
  },
  axeman: {
    id: 'axeman',
    primary: 'str',
    name: 'Axeman',
    plural: 'Axemen',
    icon: '🪓',
    tagline: 'Dual-axe berserker',
    desc: 'A ferocious fighter wielding axes in both hands. Devastating cleaves, high HP and dual-wielding offensive power.',
    weapons: ['axe', 'dagger'],
    shield: true,
    dualWield: true,
    canOffhandAxe: true,
    twoHanded: false,
    attackStyle: 'melee_heavy',
    attackRange: 2.9,
    startAttrs: { str: 9, dex: 4, int: 2, lck: 5 },
    statMods: { atkPct: 15, hpPct: 15, critDmg: 20 },
    starter: { weapon: 'axe_1', armor: 'armor_1' },
    skillTree: 'Axeman',
    mastery: 'Heuksal (Dual-Axe / Spear & Fire)',
    sroMastery: 'Heuksal',
    color: 0xef4444,
    css: '#ef4444',
    difficulty: 'Easy',
  },
  wizard: {
    id: 'wizard',
    primary: 'int',
    name: 'Wizard',
    plural: 'Wizards',
    icon: '🪄',
    tagline: 'Elemental spellcaster',
    desc: 'Hurls arcane bolts from range and commands fire, ice and lightning. Fragile, but deadly from afar.',
    weapons: ['staff'],
    shield: false,
    twoHanded: true,
    attackStyle: 'magic_bolt',
    attackRange: 11,
    startAttrs: { str: 2, dex: 4, int: 10, lck: 4 },
    statMods: { matkPct: 20, mpPct: 30, mpRegen: 1.5 },
    starter: { weapon: 'staff_1', armor: 'armor_1' },
    skillTree: 'Wizard',
    mastery: 'Elemental (Cold / Lightning / Fire)',
    sroMastery: 'Elemental',
    color: 0xa855f7,
    css: '#a855f7',
    difficulty: 'Hard',
  },
  archer: {
    id: 'archer',
    primary: 'dex',
    name: 'Archer',
    plural: 'Archers',
    icon: '🏹',
    tagline: 'Swift ranged marksman',
    desc: 'Looses rapid arrows from a distance, dodges nimbly and lands frequent critical hits.',
    weapons: ['bow'],
    shield: false,
    twoHanded: true,
    attackStyle: 'arrow',
    attackRange: 13,
    startAttrs: { str: 4, dex: 9, int: 2, lck: 5 },
    statMods: { critRate: 6, attackSpeedPct: 10, dodge: 4, moveSpeedPct: 5 },
    starter: { weapon: 'bow_1', armor: 'armor_1' },
    skillTree: 'Archer',
    mastery: 'Pacheon (Bow)',
    sroMastery: 'Pacheon',
    color: 0x22c55e,
    css: '#22c55e',
    difficulty: 'Normal',
  },
};

/** Weapon subtype -> display noun (for messages like "Only Archers can use bows"). */
export const WEAPON_NOUNS = { sword: 'swords', mace: 'maces', axe: 'axes', dagger: 'daggers', blade: 'blades', staff: 'staves', bow: 'bows', shield: 'shields' };

// ----------------------------------------------------------------------------- appearance
export const APPEARANCE_OPTIONS = {
  skinTones: [0xf5cba7, 0xe0ac69, 0xc68642, 0x8d5524, 0x5c3a21, 0xffe0bd],
  hairColors: [0x2563eb, 0x1c1917, 0x78350f, 0xfacc15, 0xdc2626, 0xe5e7eb, 0x7c3aed, 0x16a34a],
  hairStyles: ['spiky', 'short', 'long', 'ponytail', 'mohawk', 'bald'],
  outfitColors: [0x334155, 0x7f1d1d, 0x1e3a8a, 0x14532d, 0x4c1d95, 0x78350f, 0x111827, 0xe5e7eb],
  capeColors: [0xb91c1c, 0x1d4ed8, 0x15803d, 0x6d28d9, 0x0f172a, 0xca8a04],
  eyeColors: [0x1e293b, 0x2563eb, 0x16a34a, 0x92400e, 0xdc2626, 0xa855f7],
};

export const CLASS_DEFAULT_APPEARANCE = {
  knight: { skin: 0xf5cba7, hairColor: 0x2563eb, hairStyle: 'spiky', outfit: 0x334155, cape: 0xb91c1c, eyes: 0x1e293b },
  axeman: { skin: 0xe0ac69, hairColor: 0xdc2626, hairStyle: 'mohawk', outfit: 0x78350f, cape: 0x0f172a, eyes: 0x92400e },
  wizard: { skin: 0xffe0bd, hairColor: 0xe5e7eb, hairStyle: 'long', outfit: 0x4c1d95, cape: 0x6d28d9, eyes: 0xa855f7 },
  archer: { skin: 0xc68642, hairColor: 0x78350f, hairStyle: 'ponytail', outfit: 0x14532d, cape: 0x15803d, eyes: 0x16a34a },
};

// ----------------------------------------------------------------------------- helpers
export function getClass(id) {
  return CLASSES[String(id || '').toLowerCase()] || CLASSES[DEFAULT_CLASS];
}

export function isValidClass(id) {
  return !!CLASSES[String(id || '').toLowerCase()];
}

export function defaultAppearance(classId) {
  return { ...(CLASS_DEFAULT_APPEARANCE[getClass(classId).id] || CLASS_DEFAULT_APPEARANCE.knight) };
}

/** Keep only known appearance keys with valid values; fill gaps from class defaults. */
export function sanitizeAppearance(a, classId) {
  const base = defaultAppearance(classId);
  if (!a || typeof a !== 'object') return base;
  const out = { ...base };
  const pickNum = (k, list) => { const v = Number(a[k]); if (Number.isFinite(v) && v >= 0 && v <= 0xffffff && (!list || list.includes(v))) out[k] = v; };
  pickNum('skin', APPEARANCE_OPTIONS.skinTones);
  pickNum('hairColor', APPEARANCE_OPTIONS.hairColors);
  pickNum('outfit', APPEARANCE_OPTIONS.outfitColors);
  pickNum('cape', APPEARANCE_OPTIONS.capeColors);
  pickNum('eyes', APPEARANCE_OPTIONS.eyeColors);
  if (APPEARANCE_OPTIONS.hairStyles.includes(a.hairStyle)) out.hairStyle = a.hairStyle;
  return out;
}

function normalizeWeaponSubtype(item) {
  const raw = String(item?.subtype || item?.subType || item?.weaponType || '').toLowerCase().trim();
  const base = String(item?.baseId || item?.visualModel || item?.id || '').toLowerCase();
  const name = String(item?.name || '').toLowerCase();
  const probe = raw || base || name;
  if (probe.includes('bow') || base.startsWith('bow_') || base.includes('_archer_')) return 'bow';
  if (probe.includes('staff') || probe.includes('spear') || probe.includes('wand') || probe.includes('rod') || probe.includes('glaive') || base.startsWith('staff_') || base.startsWith('spear_') || base.includes('_wizard_')) return 'staff';
  if (probe.includes('axe') || probe.includes('tblade') || probe.includes('cleaver') || base.startsWith('axe_') || base.startsWith('tblade_') || base.includes('_axeman_')) return 'axe';
  if (probe.includes('dagger') || probe.includes('dirk') || base.startsWith('dagger_')) return 'dagger';
  if (probe.includes('mace') || probe.includes('hammer') || probe.includes('club') || base.startsWith('mace_')) return 'mace';
  if (probe.includes('sword') || probe.includes('blade') || base.startsWith('sword_') || base.startsWith('blade_') || base.includes('_knight_')) return 'sword';
  return raw;
}

/**
 * Can a hero of `classId` equip `item`? Returns { ok, msg, classReq }.
 * classReq = display string of class(es) that may use it, or null when universal.
 */
export function canClassUse(classId, item) {
  if (!item || (!item.slot && !item.type)) return { ok: true, msg: '', classReq: null };
  const cls = getClass(classId);
  const slot = String(item.slot || item.type || '').toLowerCase();
  const sub = normalizeWeaponSubtype(item);

  // Axeman dual-wield & offhand axe / dagger / shield access
  if (cls.id === 'axeman' && (sub === 'axe' || sub === 'dagger' || sub === 'shield' || slot === 'shield')) {
    return { ok: true, msg: '', classReq: null };
  }

  // Class-locked gear (class tier sets): item.classOnly = 'wizard' or item.classes = ['knight', ...]
  const only = item.classOnly ? [String(item.classOnly).toLowerCase()] : Array.isArray(item.classes) && item.classes.length ? item.classes.map((c) => String(c).toLowerCase()) : null;
  if (only) {
    const ids = CLASS_IDS.filter((c) => only.includes(c));
    if (ids.length) {
      const classReq = ids.map((c) => CLASSES[c].name).join(' / ');
      if (!ids.includes(cls.id)) {
        const what = item.setName ? `${item.setName} gear` : 'this gear';
        return { ok: false, msg: `Only ${ids.map((c) => CLASSES[c].plural).join(' / ')} can wear ${what}`, classReq };
      }
      // Class matches explicitly! Allow equipping any piece of this class's set.
      return { ok: true, msg: '', classReq };
    }
  }
  if (slot === 'shield') {
    if (sub === 'axe' && cls.id === 'axeman') return { ok: true, msg: '', classReq: CLASSES.axeman.name };
    const users = CLASS_IDS.filter((c) => CLASSES[c].shield).map((c) => CLASSES[c].name);
    const plural = cls.plural || cls.name + 's';
    return cls.shield
      ? { ok: true, msg: '', classReq: users.join(' / ') }
      : { ok: false, msg: `${plural} cannot use shields`, classReq: users.join(' / ') };
  }
  if (slot === 'weapon') {
    if (!sub) return { ok: true, msg: '', classReq: null };
    const userIds = CLASS_IDS.filter((c) => CLASSES[c].weapons.includes(sub));
    const users = userIds.map((c) => CLASSES[c].name);
    const classReq = users.length ? users.join(' / ') : null;
    if (cls.weapons.includes(sub) || !userIds.length) return { ok: true, msg: '', classReq };
    const noun = WEAPON_NOUNS[sub] || sub + 's';
    return { ok: false, msg: userIds.length ? `Only ${userIds.map((c) => CLASSES[c].plural).join(' / ')} can use ${noun}` : `${cls.plural} cannot use ${noun}`, classReq };
  }
  return { ok: true, msg: '', classReq: null };
}

/** Weapon subtypes a class can use (for loot / shop biasing). */
export function classWeaponSubtypes(classId) {
  return getClass(classId).weapons.slice();
}

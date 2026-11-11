// =============================================================================
// ASJ (ARKENVEIL: SIGILS & JOURNEYS) - Items, equipment, bag, shops & the Composing system.
// Owned by rpg-systems. Pure logic (no DOM / three.js).
//
// Item objects are UI-ready plain JSON:
//   { uid, baseId, name, icon, type:'weapon'|'armor'|'accessory'|'consumable'|'material'|'quest',
//     slot, subtype, tier, rarity, rarityName, color, level, reqLevel, stats:{...effective},
//     affixes:[text], mods:[{stat,value,name}], plus, sockets, gems:[{element,tier}],
//     setId, value (sell), price (buy), count, stackable, maxStack, desc }
// =============================================================================

export const SLOTS = ['weapon', 'shield', 'helmet', 'armor', 'boots', 'necklace', 'ring'];
export const SLOT_NAMES = { weapon: 'Weapon', shield: 'Shield', helmet: 'Helmet', armor: 'Armor', boots: 'Boots', necklace: 'Necklace', ring: 'Ring' };
const SLOT_ALIASES = { offhand: 'shield', off_hand: 'shield', head: 'helmet', helm: 'helmet', body: 'armor', chest: 'armor', feet: 'boots', shoes: 'boots', amulet: 'necklace', neck: 'necklace', accessory: 'ring', mainhand: 'weapon', main_hand: 'weapon' };
export const normalizeSlot = (s) => { s = String(s || '').toLowerCase(); return SLOTS.includes(s) ? s : SLOT_ALIASES[s] || null; };

export const RARITY = {
  normal: { id: 'normal', name: 'Normal', color: '#d9d9d9', affixes: [0, 0], statMult: 1.0, priceMult: 1, weight: 1000, sockets: 1 },
  magic: { id: 'magic', name: 'Magic', color: '#4f8cff', affixes: [1, 2], statMult: 1.1, priceMult: 2.5, weight: 280, sockets: 1 },
  rare: { id: 'rare', name: 'Rare', color: '#ffd84a', affixes: [2, 3], statMult: 1.22, priceMult: 5, weight: 70, sockets: 2 },
  epic: { id: 'epic', name: 'Epic', color: '#b866ff', affixes: [3, 4], statMult: 1.36, priceMult: 10, weight: 14, sockets: 2 },
  unique: { id: 'unique', name: 'Unique', color: '#ff8c2e', affixes: [4, 5], statMult: 1.5, priceMult: 20, weight: 2.5, sockets: 3 },
};
export const RARITY_ORDER = ['normal', 'magic', 'rare', 'epic', 'unique'];
export const ELEMENTS = ['fire', 'ice', 'lightning', 'poison'];
const ELEMENT_NAMES = { fire: 'Fire', ice: 'Ice', lightning: 'Lightning', poison: 'Poison', prism: 'Prism' };
const ELEMENT_COLORS = { fire: '#ff5a2a', ice: '#6fd4ff', lightning: '#ffe94a', poison: '#7dff5a', prism: '#ffffff' };

// ----------------------------------------------------------------------------- utils
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const rand = (a, b) => a + Math.random() * (b - a);
const randi = (a, b) => Math.floor(rand(a, b + 1));
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const num = (v, d = 0) => (typeof v === 'number' && isFinite(v) ? v : Number.isFinite(Number(v)) && v !== '' && v != null ? Number(v) : d);
const slug = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
function weighted(entries) { // [[value, weight]]
  const total = entries.reduce((s, e) => s + e[1], 0);
  let r = Math.random() * total;
  for (const [v, w] of entries) { if ((r -= w) <= 0) return v; }
  return entries[entries.length - 1][0];
}
let _uidCounter = 1;
const newUid = () => `it${Date.now().toString(36)}${(_uidCounter++).toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`;

// =============================================================================
// Item bases
// =============================================================================
export const TIER_LEVELS = [1, 5, 10, 16, 22, 30, 40, 50];
export const TIER_MATERIALS = ['Crude', 'Iron', 'Steel', 'Knight', 'Mithril', 'Rune', 'Dragon', 'Arkenveil'];

const EQUIP_NAMES = {
  sword: ['Short Sword', 'Long Sword', 'Broad Sword', 'Knight Sword', 'Flamberge', 'Rune Blade', 'Dragon Slayer', 'Arkenveil Blade'],
  axe: ['Hand Axe', 'Battle Axe', 'War Axe', 'Bearded Axe', 'Executioner', 'Rune Axe', 'Dragon Cleaver', 'Titan Axe'],
  mace: ['Club', 'Mace', 'Morning Star', 'Flail', 'War Hammer', 'Rune Maul', 'Dragon Hammer', 'Thunder Maul'],
  staff: ['Wooden Staff', 'Oak Staff', 'Crystal Staff', 'Mystic Staff', 'Sage Staff', 'Rune Staff', 'Dragon Staff', 'Arcane Scepter'],
  shield: ['Wooden Buckler', 'Round Shield', 'Kite Shield', 'Heater Shield', 'Tower Shield', 'Rune Shield', 'Dragon Shield', 'Aegis of Arkenveil'],
  helmet: ['Leather Cap', 'Chain Coif', 'Iron Helm', 'Steel Helm', 'Knight Helm', 'Rune Helm', 'Dragon Helm', 'Crown of Arkenveil'],
  armor: ['Leather Vest', 'Chain Mail', 'Scale Mail', 'Plate Armor', 'Knight Plate', 'Rune Armor', 'Dragon Armor', 'Arkenveil Battleplate'],
  boots: ['Leather Boots', 'Chain Boots', 'Iron Greaves', 'Steel Greaves', 'Knight Greaves', 'Rune Boots', 'Dragon Boots', 'Boots of Arkenveil'],
  necklace: ['Copper Amulet', 'Silver Amulet', 'Gold Amulet', 'Jade Pendant', 'Sapphire Pendant', 'Rune Talisman', 'Dragon Talisman', 'Heart of Arkenveil'],
  ring: ['Copper Ring', 'Silver Ring', 'Gold Ring', 'Ruby Ring', 'Emerald Ring', 'Rune Ring', 'Dragon Ring', 'Seal of Arkenveil'],
};
const WEAPON_ATK = [[3, 6], [7, 12], [12, 19], [18, 28], [26, 39], [36, 53], [50, 72], [68, 96]];
const ICONS = {
  sword: '🗡️', axe: '🪓', mace: '🔨', staff: '🪄', shield: '🛡️', helmet: '⛑️', armor: '🥋', boots: '👢', necklace: '📿', ring: '💍',
  hp: '🧪', mp: '🔷', elixir: '⚗️', scroll: '📜', crystal: '💎', stone: '🪨', charm: '🍀', quest: '📦', tonic: '🍶', antidote: '🌿',
};

/** id -> base definition. */
export const ITEM_BASES = {};

export function registerItemBase(def) {
  if (!def || !def.id) return null;
  ITEM_BASES[def.id] = { ...ITEM_BASES[def.id], ...def };
  return ITEM_BASES[def.id];
}
export const getItemBase = (id) => ITEM_BASES[id] || null;

function buildEquipmentBases() {
  for (let t = 0; t < 8; t++) {
    const reqLevel = TIER_LEVELS[t];
    const price = Math.round(30 * Math.pow(t + 1, 2.2));
    const [mn, mx] = WEAPON_ATK[t];
    const W = (sub, stats, extra = {}) => registerItemBase({
      id: `${sub}_${t + 1}`, name: EQUIP_NAMES[sub][t], type: 'weapon', slot: 'weapon', subtype: sub, tier: t, reqLevel,
      stats, price: Math.round(price * (extra.pmul || 1)), icon: ICONS[sub], material: TIER_MATERIALS[t],
    });
    W('sword', { atkMin: mn, atkMax: mx });
    W('axe', { atkMin: Math.round(mn * 0.85), atkMax: Math.round(mx * 1.22), attackSpeedPct: -6 });
    W('mace', { atkMin: Math.round(mn * 1.12), atkMax: Math.round(mx * 1.04), critDmg: 10 + t * 3 });
    W('staff', { atkMin: Math.round(mn * 0.6), atkMax: Math.round(mx * 0.6), matk: Math.round((mn + mx) * 0.6), mp: 10 + t * 8 }, { pmul: 1.1 });
    const A = (slot, type, stats) => registerItemBase({
      id: `${slot}_${t + 1}`, name: EQUIP_NAMES[slot][t], type, slot, subtype: slot, tier: t, reqLevel,
      stats, price: Math.round(price * (type === 'accessory' ? 1.3 : 0.9)), icon: ICONS[slot], material: TIER_MATERIALS[t],
    });
    A('shield', 'armor', { def: [3, 6, 10, 15, 21, 29, 39, 52][t], block: Math.round(5 + t * 1.5) });
    A('helmet', 'armor', { def: [2, 4, 7, 10, 14, 19, 26, 35][t], hp: t * 8 });
    A('armor', 'armor', { def: [4, 8, 13, 19, 27, 37, 50, 66][t], hp: 10 + t * 12 });
    A('boots', 'armor', { def: [1, 3, 5, 8, 11, 15, 20, 27][t], moveSpeedPct: 3 + t });
    A('necklace', 'accessory', { hp: 10 + t * 10, mp: 5 + t * 6 });
    A('ring', 'accessory', { critRate: 1 + t * 0.5, atk: 1 + t * 2 });
  }
}

const CRYSTAL_TIER_NAMES = ['Chipped', 'Flawed', 'Clear', 'Flawless', 'Perfect'];
const STONE_NAMES = ['Lesser Composing Stone', 'Composing Stone', 'Greater Composing Stone', 'Divine Composing Stone'];

function buildConsumables() {
  const C = (id, name, icon, price, reqLevel, effect, desc, extra = {}) =>
    registerItemBase({ id, name, icon, type: 'consumable', stackable: true, maxStack: 99, price, reqLevel, effect, desc, ...extra });
  C('hp_potion_s', 'Small HP Potion', ICONS.hp, 20, 1, { heal: 50 }, 'Restores 50 HP.', { potion: true });
  C('hp_potion_m', 'HP Potion', ICONS.hp, 60, 8, { heal: 150 }, 'Restores 150 HP.', { potion: true });
  C('hp_potion_l', 'Large HP Potion', ICONS.hp, 160, 18, { heal: 400 }, 'Restores 400 HP.', { potion: true });
  C('hp_potion_x', 'Grand HP Potion', ICONS.hp, 380, 32, { heal: 900 }, 'Restores 900 HP.', { potion: true });
  C('mp_potion_s', 'Small SP Potion', ICONS.mp, 25, 1, { mana: 30 }, 'Restores 30 SP (mana).', { potion: true });
  C('mp_potion_m', 'SP Potion', ICONS.mp, 70, 8, { mana: 90 }, 'Restores 90 SP (mana).', { potion: true });
  C('mp_potion_l', 'Large SP Potion', ICONS.mp, 180, 18, { mana: 220 }, 'Restores 220 SP (mana).', { potion: true });
  C('mp_potion_x', 'Grand SP Potion', ICONS.mp, 400, 32, { mana: 500 }, 'Restores 500 SP (mana).', { potion: true });
  C('elixir', 'Elixir of Life', ICONS.elixir, 600, 15, { healPct: 1, manaPct: 1, stamina: 999 }, 'Fully restores HP, SP and stamina.', { potion: true });
  C('antidote', 'Antidote Herb', ICONS.antidote, 15, 1, { cure: true }, 'Removes all negative effects.');
  C('stamina_tonic', 'Stamina Tonic', ICONS.tonic, 45, 3, { stamina: 999, buff: { id: 'tonic', name: 'Second Wind', icon: '🍶', duration: 30, mods: { staminaRegen: 15 } } }, 'Restores stamina and boosts stamina regeneration for 30s.');
  C('scroll_return', 'Return Scroll', ICONS.scroll, 40, 1, { townPortal: true }, 'Teleports you back to the village.');
  C('scroll_might', 'Scroll of Might', ICONS.scroll, 120, 5, { buff: { id: 'scroll_might', name: 'Might', icon: '⚔', duration: 60, mods: { atkPct: 25 } } }, '+25% attack for 60s.');
  C('scroll_iron', 'Scroll of Iron Skin', ICONS.scroll, 120, 5, { buff: { id: 'scroll_iron', name: 'Iron Skin', icon: '🛡', duration: 60, mods: { defPct: 35 } } }, '+35% defense for 60s.');
  C('scroll_haste', 'Scroll of Haste', ICONS.scroll, 150, 10, { buff: { id: 'scroll_haste', name: 'Haste', icon: '💨', duration: 45, mods: { moveSpeedPct: 20, attackSpeedPct: 15 } } }, '+20% move speed, +15% attack speed for 45s.');
  C('scroll_fortune', 'Scroll of Fortune', ICONS.scroll, 200, 10, { buff: { id: 'scroll_fortune', name: 'Fortune', icon: '🍀', duration: 120, mods: { magicFind: 50, goldFind: 50 } } }, '+50% magic find and gold find for 120s.');
  C('scroll_reset', 'Scroll of Rebirth', ICONS.scroll, 1500, 10, { resetAll: true }, 'Refunds all attribute and skill points.');

  for (const el of ELEMENTS) {
    for (let t = 1; t <= 5; t++) {
      registerItemBase({
        id: `crystal_${el}_${t}`, name: `${CRYSTAL_TIER_NAMES[t - 1]} ${ELEMENT_NAMES[el]} Crystal`, icon: ICONS.crystal, type: 'material', subtype: 'crystal',
        element: el, tier: t, stackable: true, maxStack: 1, price: Math.round(30 * Math.pow(3, t - 1)), reqLevel: 1, color: ELEMENT_COLORS[el],
        desc: `Composing material. Infuse into gear for ${ELEMENT_NAMES[el]} power, or combine 2–3 to synthesize a higher tier.`,
      });
    }
  }
  for (let t = 1; t <= 5; t++) {
    registerItemBase({
      id: `crystal_prism_${t}`, name: `${CRYSTAL_TIER_NAMES[t - 1]} Prism Crystal`, icon: ICONS.crystal, type: 'material', subtype: 'crystal', element: 'prism', tier: t,
      stackable: true, maxStack: 1, price: Math.round(150 * Math.pow(3, t - 1)), reqLevel: 1, color: ELEMENT_COLORS.prism,
      desc: 'Fused from four elemental crystals. Infuse into weapons for all attributes, or armor for all resistances.',
    });
  }
  STONE_NAMES.forEach((name, i) => registerItemBase({
    id: `stone_${i + 1}`, name, icon: ICONS.stone, type: 'material', subtype: 'stone', tier: i + 1, stackable: true, maxStack: 1,
    price: [80, 300, 1000, 3500][i], reqLevel: 1,
    desc: `Upgrades equipment up to +${[4, 7, 10, 10][i]}${i === 3 ? ' with +15% success' : ''}. Use at the Composing Master.`,
  }));
  registerItemBase({ id: 'lucky_charm', name: 'Lucky Charm', icon: ICONS.charm, type: 'material', subtype: 'charm', stackable: true, maxStack: 99, price: 500, reqLevel: 1, desc: 'Add when composing: +15% success and prevents upgrade level loss on failure.' });
}

buildEquipmentBases();
buildConsumables();

// =============================================================================
// Affixes, uniques & sets
// =============================================================================
const W_ = ['weapon'], ARM = ['shield', 'helmet', 'armor', 'boots'], ACC = ['necklace', 'ring'], ALL = SLOTS;
export const AFFIXES = [
  // prefixes
  { id: 'sharp', kind: 'prefix', name: 'Sharp', stat: 'atkPct', min: 4, max: 9, per: 0.15, slots: W_ },
  { id: 'brutal', kind: 'prefix', name: 'Brutal', stat: 'atk', min: 1, max: 4, per: 0.5, slots: [...W_, ...ACC] },
  { id: 'fiery', kind: 'prefix', name: 'Fiery', stat: 'fireDmg', min: 2, max: 5, per: 0.6, slots: W_ },
  { id: 'frozen', kind: 'prefix', name: 'Frozen', stat: 'iceDmg', min: 2, max: 5, per: 0.6, slots: W_ },
  { id: 'shocking', kind: 'prefix', name: 'Shocking', stat: 'lightningDmg', min: 1, max: 7, per: 0.6, slots: W_ },
  { id: 'venomous', kind: 'prefix', name: 'Venomous', stat: 'poisonDmg', min: 2, max: 5, per: 0.6, slots: W_ },
  { id: 'sturdy', kind: 'prefix', name: 'Sturdy', stat: 'def', min: 2, max: 5, per: 0.5, slots: ARM },
  { id: 'fortified', kind: 'prefix', name: 'Fortified', stat: 'defPct', min: 5, max: 10, per: 0.15, slots: ['armor', 'shield', 'helmet'] },
  { id: 'healthy', kind: 'prefix', name: 'Healthy', stat: 'hp', min: 10, max: 20, per: 3, slots: [...ARM, ...ACC] },
  { id: 'mystic', kind: 'prefix', name: 'Mystic', stat: 'mp', min: 8, max: 15, per: 2, slots: ['helmet', 'weapon', ...ACC] },
  { id: 'arcane', kind: 'prefix', name: 'Arcane', stat: 'matk', min: 3, max: 6, per: 0.6, slots: [...W_, ...ACC] },
  { id: 'lucky', kind: 'prefix', name: 'Lucky', stat: 'magicFind', min: 5, max: 12, per: 0.2, slots: [...ACC, 'helmet', 'boots'] },
  { id: 'swift', kind: 'prefix', name: 'Swift', stat: 'moveSpeedPct', min: 3, max: 6, per: 0.05, slots: ['boots'] },
  { id: 'vampiric', kind: 'prefix', name: 'Vampiric', stat: 'lifeSteal', min: 1, max: 3, per: 0.03, slots: ['weapon', 'ring'], minRarity: 'rare' },
  // suffixes
  { id: 'bear', kind: 'suffix', name: 'of the Bear', stat: 'str', min: 2, max: 4, per: 0.25, slots: ALL },
  { id: 'fox', kind: 'suffix', name: 'of the Fox', stat: 'dex', min: 2, max: 4, per: 0.25, slots: ALL },
  { id: 'owl', kind: 'suffix', name: 'of the Owl', stat: 'int', min: 2, max: 4, per: 0.25, slots: ALL },
  { id: 'fortune', kind: 'suffix', name: 'of Fortune', stat: 'lck', min: 2, max: 4, per: 0.25, slots: ALL },
  { id: 'precision', kind: 'suffix', name: 'of Precision', stat: 'critRate', min: 1, max: 3, per: 0.05, slots: ['weapon', 'helmet', ...ACC] },
  { id: 'slaughter', kind: 'suffix', name: 'of Slaughter', stat: 'critDmg', min: 5, max: 12, per: 0.3, slots: ['weapon', 'necklace'] },
  { id: 'evasion', kind: 'suffix', name: 'of Evasion', stat: 'dodge', min: 1, max: 3, per: 0.05, slots: ['boots', 'armor', 'ring'] },
  { id: 'haste', kind: 'suffix', name: 'of Haste', stat: 'attackSpeedPct', min: 3, max: 7, per: 0.08, slots: ['weapon', 'ring', 'boots'] },
  { id: 'regen', kind: 'suffix', name: 'of Regeneration', stat: 'hpRegen', min: 0.5, max: 1.5, per: 0.05, slots: ['armor', 'helmet', ...ACC], decimals: 1 },
  { id: 'meditation', kind: 'suffix', name: 'of Meditation', stat: 'mpRegen', min: 0.4, max: 1, per: 0.04, slots: ['helmet', ...ACC], decimals: 1 },
  { id: 'flameward', kind: 'suffix', name: 'of Flame Warding', stat: 'fireRes', min: 6, max: 14, per: 0.2, slots: [...ARM, ...ACC] },
  { id: 'frostward', kind: 'suffix', name: 'of Frost Warding', stat: 'iceRes', min: 6, max: 14, per: 0.2, slots: [...ARM, ...ACC] },
  { id: 'stormward', kind: 'suffix', name: 'of Storm Warding', stat: 'lightningRes', min: 6, max: 14, per: 0.2, slots: [...ARM, ...ACC] },
  { id: 'antivenom', kind: 'suffix', name: 'of Antivenom', stat: 'poisonRes', min: 6, max: 14, per: 0.2, slots: [...ARM, ...ACC] },
  { id: 'greed', kind: 'suffix', name: 'of Greed', stat: 'goldFind', min: 8, max: 18, per: 0.3, slots: [...ACC, 'boots'] },
  { id: 'thorns', kind: 'suffix', name: 'of Thorns', stat: 'thorns', min: 2, max: 6, per: 0.4, slots: ['armor', 'shield'] },
  { id: 'blocking', kind: 'suffix', name: 'of Blocking', stat: 'block', min: 2, max: 5, per: 0.05, slots: ['shield'] },
  { id: 'titan', kind: 'suffix', name: 'of the Titan', stat: 'allAttrs', min: 1, max: 2, per: 0.1, slots: [...ACC, 'armor'], minRarity: 'rare' },
  { id: 'wisdom', kind: 'suffix', name: 'of Wisdom', stat: 'expBonus', min: 3, max: 6, per: 0.05, slots: ['necklace', 'helmet'], minRarity: 'rare' },
  { id: 'alacrity', kind: 'suffix', name: 'of Alacrity', stat: 'cdr', min: 3, max: 6, per: 0.05, slots: [...ACC, 'helmet'], minRarity: 'epic' },
];

export const STAT_LABELS = {
  atkMin: 'Min Attack', atkMax: 'Max Attack', atk: 'Attack', atkPct: '% Attack', matk: 'Magic Attack', matkPct: '% Magic Attack',
  def: 'Defense', defPct: '% Defense', hp: 'Max HP', hpPct: '% Max HP', mp: 'Max SP', mpPct: '% Max SP', block: '% Block Chance',
  str: 'Strength', dex: 'Dexterity', int: 'Intelligence', lck: 'Luck', allAttrs: 'All Attributes',
  critRate: '% Critical Rate', critDmg: '% Critical Damage', dodge: '% Dodge', hit: 'Hit Rate',
  attackSpeedPct: '% Attack Speed', moveSpeedPct: '% Move Speed', hpRegen: 'HP Regen/s', mpRegen: 'SP Regen/s', staminaRegen: 'Stamina Regen/s', stamina: 'Max Stamina',
  lifeSteal: '% Life Steal', manaSteal: '% Mana Steal', magicFind: '% Magic Find', goldFind: '% Gold Find', expBonus: '% EXP Gained', cdr: '% Cooldown Reduction', thorns: 'Thorns Damage',
  fireDmg: 'Fire Damage', iceDmg: 'Ice Damage', lightningDmg: 'Lightning Damage', poisonDmg: 'Poison Damage',
  fireRes: '% Fire Resistance', iceRes: '% Ice Resistance', lightningRes: '% Lightning Resistance', poisonRes: '% Poison Resistance', allRes: '% All Resistances',
};
export function formatStat(stat, value) {
  const label = STAT_LABELS[stat] || stat;
  const v = Math.abs(value) < 10 && value % 1 ? value.toFixed(1) : Math.round(value);
  const sign = value >= 0 ? '+' : '';
  return label.startsWith('%') ? `${sign}${v}${label}` : `${sign}${v} ${label}`;
}

export const UNIQUES = [
  { id: 'u_flamebrand', name: 'Flamebrand', base: 'sword', minLevel: 8, mods: { fireDmg: 14, atkPct: 15, str: 5 }, lore: 'Forged in the heart of the Ember Caverns.' },
  { id: 'u_frostbite', name: 'Frostbite Cleaver', base: 'axe', minLevel: 14, mods: { iceDmg: 20, critDmg: 30, dex: 6 }, lore: 'Its edge never thaws.' },
  { id: 'u_stormcaller', name: 'Stormcaller', base: 'staff', minLevel: 18, mods: { lightningDmg: 18, matkPct: 25, int: 10, cdr: 8 }, lore: 'Thunder answers its bearer.' },
  { id: 'u_skullcrusher', name: 'Skullcrusher', base: 'mace', minLevel: 24, mods: { atkPct: 25, critRate: 6, str: 10 }, lore: 'Favored by the orc warlords.' },
  { id: 'u_wall_of_ages', name: 'Wall of Ages', base: 'shield', minLevel: 20, mods: { defPct: 30, block: 10, allRes: 12, hp: 80 }, lore: 'It has never been breached.' },
  { id: 'u_wanderer', name: "Wanderer's Stride", base: 'boots', minLevel: 12, mods: { moveSpeedPct: 15, dodge: 6, staminaRegen: 10 }, lore: 'Light as the wind.' },
  { id: 'u_eye_of_arkenveil', name: 'Eye of Arkenveil', base: 'necklace', minLevel: 30, mods: { allAttrs: 8, expBonus: 10, magicFind: 25 }, lore: 'The sealed eye still watches.' },
  { id: 'u_blood_ring', name: 'Ring of Blood Oath', base: 'ring', minLevel: 16, mods: { lifeSteal: 6, atk: 20, critRate: 4 }, lore: 'Power, paid for in blood.' },
];

export const SETS = {
  guardian: { id: 'guardian', name: "Guardian's Bulwark", minLevel: 10, pieces: { helmet: 'Guardian Helm', armor: 'Guardian Plate', shield: 'Guardian Wall' }, bonuses: { 2: { defPct: 15, hp: 60 }, 3: { block: 10, allRes: 15 } } },
  shadow: { id: 'shadow', name: 'Shadow Stalker', minLevel: 16, pieces: { boots: 'Shadow Treads', ring: 'Shadow Band', necklace: 'Shadow Charm' }, bonuses: { 2: { dodge: 6, critRate: 4 }, 3: { attackSpeedPct: 12, critDmg: 30 } } },
  archmage: { id: 'archmage', name: 'Archmage Regalia', minLevel: 20, pieces: { weapon: 'Archmage Staff', helmet: 'Archmage Circlet', necklace: 'Archmage Amulet' }, bonuses: { 2: { matkPct: 20, mp: 50 }, 3: { cdr: 12, mpRegen: 3 } } },
};

// =============================================================================
// Item creation
// =============================================================================
const SOCKET_GEM_DMG = [4, 9, 16, 26, 40];
const SOCKET_GEM_RES = [5, 9, 14, 20, 28];
const SOCKET_PRISM_ATTR = [1, 2, 4, 6, 9];
const SOCKET_PRISM_RES = [3, 6, 9, 13, 18];

/** Recompute effective stats/name/affix text/value of an item (after upgrade, gems...). */
export function recalcItem(item) {
  if (!item || item.stackable) return item;
  const r = RARITY[item.rarity] || RARITY.normal;
  const plusMult = 1 + 0.1 * (item.plus || 0);
  const stats = {};
  for (const k in item.baseStats || {}) {
    const v = item.baseStats[k];
    const scalable = ['atkMin', 'atkMax', 'def', 'matk', 'hp', 'mp', 'atk'].includes(k);
    stats[k] = scalable ? Math.round(v * plusMult) : v;
  }
  const affixes = [];
  for (const m of item.mods || []) {
    stats[m.stat] = (stats[m.stat] || 0) + m.value;
    affixes.push(formatStat(m.stat, m.value));
  }
  const isWeapon = item.slot === 'weapon';
  for (const g of item.gems || []) {
    const t = clamp(g.tier | 0, 1, 5) - 1;
    if (g.element === 'prism') {
      const [stat, val] = isWeapon ? ['allAttrs', SOCKET_PRISM_ATTR[t]] : ['allRes', SOCKET_PRISM_RES[t]];
      stats[stat] = (stats[stat] || 0) + val;
      affixes.push(`◆ ${formatStat(stat, val)}`);
    } else {
      const [stat, val] = isWeapon ? [`${g.element}Dmg`, SOCKET_GEM_DMG[t]] : [`${g.element}Res`, SOCKET_GEM_RES[t]];
      stats[stat] = (stats[stat] || 0) + val;
      affixes.push(`◆ ${formatStat(stat, val)}`);
    }
  }
  for (const k in stats) if (typeof stats[k] === 'number') stats[k] = Math.round(stats[k] * 10) / 10;
  item.stats = stats;
  item.affixes = affixes;
  item.rarityName = r.name;
  item.color = r.color;
  item.name = (item.plus ? `+${item.plus} ` : '') + item.baseName;
  item.price = Math.round(item.basePrice * r.priceMult * (1 + 0.06 * (item.mods || []).length) * (1 + 0.15 * (item.plus || 0)) + (item.gems || []).length * 40);
  item.value = Math.max(1, Math.floor(item.price * 0.25));
  item.atk = stats.atkMin != null ? `${stats.atkMin}-${stats.atkMax}` : undefined;
  return item;
}

function rollRarity({ level = 1, magicFind = 0, isBoss = false, isElite = false, minRarity = 'normal' } = {}) {
  const mf = 1 + Math.max(0, magicFind) / 100;
  const boost = isBoss ? 3 : isElite ? 1.8 : 1;
  let r = weighted(RARITY_ORDER.map((id) => [id, id === 'normal' ? RARITY[id].weight : RARITY[id].weight * mf * boost]));
  if (r === 'unique' && level < 8) r = 'epic';
  if (r === 'epic' && level < 5) r = 'rare';
  if (RARITY_ORDER.indexOf(r) < RARITY_ORDER.indexOf(minRarity)) r = minRarity;
  return r;
}

function pickEquipBase({ slot, subtype, level = 1 }) {
  let cands = Object.values(ITEM_BASES).filter((b) => b.slot && (!slot || b.slot === slot) && (!subtype || b.subtype === subtype) && !b.questItem && !b.noDrop);
  if (!cands.length) cands = Object.values(ITEM_BASES).filter((b) => b.slot);
  const ok = cands.filter((b) => (b.reqLevel || 1) <= level + 1);
  const pool = ok.length ? ok : cands.sort((a, b) => (a.reqLevel || 1) - (b.reqLevel || 1)).slice(0, 4);
  const maxReq = Math.max(...pool.map((b) => b.reqLevel || 1));
  return weighted(pool.map((b) => {
    const gap = maxReq - (b.reqLevel || 1);
    return [b, gap === 0 ? 6 : gap <= 6 ? 2 : 0.3];
  }));
}

function rollAffixes(slot, rarity, level, count) {
  const ri = RARITY_ORDER.indexOf(rarity);
  const pool = AFFIXES.filter((a) => a.slots.includes(slot) && RARITY_ORDER.indexOf(a.minRarity || 'normal') <= ri);
  const out = [];
  const used = new Set();
  let prefixes = 0, suffixes = 0;
  for (let i = 0; i < count && pool.length; i++) {
    const avail = pool.filter((a) => !used.has(a.stat) && (a.kind === 'prefix' ? prefixes < 3 : suffixes < 3));
    if (!avail.length) break;
    const a = pick(avail);
    used.add(a.stat);
    a.kind === 'prefix' ? prefixes++ : suffixes++;
    let v = rand(a.min, a.max) + a.per * level;
    v = a.decimals ? Math.round(v * 10) / 10 : Math.max(1, Math.round(v));
    out.push({ id: a.id, kind: a.kind, name: a.name, stat: a.stat, value: v });
  }
  return out;
}

/**
 * Create an item instance.
 * opts: { baseId, slot, subtype, level, rarity, minRarity, magicFind, isBoss, isElite, count, plus, uniqueId, setId }
 */
export function generateItem(opts = {}) {
  if (typeof opts === 'string') opts = { baseId: opts };
  const level = Math.max(1, num(opts.level, 1) | 0);
  let base = opts.baseId ? ITEM_BASES[opts.baseId] : null;
  if (opts.baseId && !base) {
    // fuzzy match by name/slug
    const s = slug(opts.baseId);
    base = Object.values(ITEM_BASES).find((b) => slug(b.name) === s || b.id.startsWith(s));
    if (!base) return null;
  }
  // ---- stackables
  if (base && base.stackable) {
    return {
      uid: newUid(), baseId: base.id, name: base.name, baseName: base.name, icon: base.icon, type: base.type, subtype: base.subtype || base.type,
      tier: base.tier || 0, element: base.element, rarity: base.rarity || (base.type === 'quest' ? 'rare' : 'normal'),
      rarityName: RARITY[base.rarity || 'normal']?.name || 'Normal', color: base.color || RARITY[base.rarity || 'normal']?.color,
      level: base.reqLevel || 1, reqLevel: base.reqLevel || 1, stats: {}, affixes: [], desc: base.desc || '',
      stackable: true, maxStack: base.maxStack || 99, count: clamp(num(opts.count, 1) | 0, 1, 99),
      price: base.price || 0, value: Math.max(base.type === 'quest' ? 0 : 1, Math.floor((base.price || 0) * 0.25)), effect: base.effect || null, questItem: !!base.questItem,
    };
  }
  // ---- equipment
  if (!base) base = pickEquipBase({ slot: normalizeSlot(opts.slot) || opts.slot, subtype: opts.subtype, level });
  if (!base) return null;
  const rarity = RARITY[opts.rarity] ? opts.rarity : rollRarity({ level, magicFind: opts.magicFind, isBoss: opts.isBoss, isElite: opts.isElite, minRarity: opts.minRarity });
  const r = RARITY[rarity];
  const levelScale = clamp(1 + (level - (base.reqLevel || 1)) * 0.02, 1, 1.3);
  const baseStats = {};
  for (const k in base.stats || {}) {
    const v = base.stats[k];
    const scalable = ['atkMin', 'atkMax', 'def', 'matk', 'hp', 'mp', 'atk'].includes(k);
    baseStats[k] = scalable ? Math.max(1, Math.round(v * r.statMult * levelScale * rand(0.92, 1.08))) : v;
  }
  if (baseStats.atkMax != null && baseStats.atkMin != null && baseStats.atkMax < baseStats.atkMin) baseStats.atkMax = baseStats.atkMin;
  const affixLevel = Math.max(level, base.reqLevel || 1);
  let mods = rollAffixes(base.slot, rarity, affixLevel, randi(r.affixes[0], r.affixes[1]));
  let baseName = base.name;
  let uniqueId = null, setId = null, lore = null;
  if (rarity === 'unique') {
    const uniq = opts.uniqueId ? UNIQUES.find((u) => u.id === opts.uniqueId) : null;
    const sets = Object.values(SETS).filter((s) => s.pieces[base.slot] && s.minLevel <= level + 2);
    const uniqs = UNIQUES.filter((u) => (ITEM_BASES[base.id]?.subtype === u.base) && u.minLevel <= level + 2);
    const useSet = opts.setId ? SETS[opts.setId] : (!uniq && sets.length && (Math.random() < 0.5 || !uniqs.length)) ? pick(sets) : null;
    const u = uniq || (!useSet && uniqs.length ? pick(uniqs) : null);
    if (useSet && useSet.pieces[base.slot]) {
      setId = useSet.id;
      baseName = useSet.pieces[base.slot];
      mods = mods.slice(0, 3);
    } else if (u) {
      uniqueId = u.id;
      baseName = u.name;
      lore = u.lore;
      const scale = 1 + Math.max(0, level - u.minLevel) * 0.03;
      mods = Object.entries(u.mods).map(([stat, value]) => ({ id: u.id + '_' + stat, kind: 'unique', name: u.name, stat, value: Math.round(value * scale * 10) / 10 }));
    } else {
      baseName = `${pick(['Ancient', 'Legendary', 'Hallowed', 'Doom', 'Sacred', 'Eternal'])} ${base.name}`;
    }
  } else if (mods.length) {
    const pre = mods.find((m) => m.kind === 'prefix');
    const suf = mods.find((m) => m.kind === 'suffix');
    if (rarity === 'magic' || rarity === 'rare') baseName = `${pre ? pre.name + ' ' : ''}${base.name}${suf ? ' ' + suf.name : ''}`;
    else baseName = `${pre ? pre.name + ' ' : ''}${base.name}${suf ? ' ' + suf.name : ''}`;
  }
  const item = {
    uid: newUid(), baseId: base.id, baseName, name: baseName, icon: base.icon, type: base.type, slot: base.slot, subtype: base.subtype,
    tier: base.tier || 0, material: base.material, rarity, level, reqLevel: Math.max(base.reqLevel || 1, uniqueId ? (UNIQUES.find((u) => u.id === uniqueId)?.minLevel || 1) : 1),
    baseStats, mods, gems: [], sockets: r.sockets, plus: clamp(num(opts.plus) | 0, 0, 10), setId, uniqueId, lore,
    basePrice: base.price || 20, count: 1, stackable: false, desc: base.desc || '',
  };
  return recalcItem(item);
}

/**
 * Loot roll for a slain monster / opened chest.
 * Returns { gold, items:[item] }.
 */
export function rollLoot(level = 1, { isBoss = false, isElite = false, isChest = false, magicFind = 0, goldFind = 0 } = {}) {
  level = Math.max(1, level | 0);
  const items = [];
  const gf = 1 + Math.max(0, goldFind) / 100;
  let gold = 0;
  const goldChance = isBoss || isElite || isChest ? 1 : 0.6;
  if (Math.random() < goldChance) gold = Math.round((level * rand(1.5, 4) + 2) * (isBoss ? 15 : isElite ? 3 : isChest ? 5 : 1) * gf);
  const equipRolls = isBoss ? 3 + (Math.random() < 0.5 ? 1 : 0) : isChest ? 1 + (Math.random() < 0.35 ? 1 : 0) : isElite ? (Math.random() < 0.45 ? 1 : 0) + (Math.random() < 0.2 ? 1 : 0) : (Math.random() < 0.1 ? 1 : 0);
  for (let i = 0; i < equipRolls; i++) {
    items.push(generateItem({ level, magicFind, isBoss, isElite, minRarity: isBoss ? (i === 0 ? 'rare' : 'magic') : 'normal' }));
  }
  const potionChance = isBoss ? 1 : isChest ? 0.6 : isElite ? 0.4 : 0.12;
  if (Math.random() < potionChance) {
    const t = level < 8 ? 's' : level < 18 ? 'm' : level < 32 ? 'l' : 'x';
    items.push(generateItem({ baseId: `${Math.random() < 0.6 ? 'hp' : 'mp'}_potion_${t}`, count: isBoss ? randi(2, 4) : 1 }));
  }
  const crystalChance = isBoss ? 1 : isChest ? 0.35 : isElite ? 0.25 : 0.05;
  if (Math.random() < crystalChance) {
    const t = clamp(Math.floor(level / 15) + 1 + (isBoss && Math.random() < 0.3 ? 1 : 0), 1, 5);
    items.push(generateItem({ baseId: `crystal_${pick(ELEMENTS)}_${t}`, count: isBoss ? randi(1, 3) : 1 }));
  }
  const stoneChance = isBoss ? 1 : isChest ? 0.15 : isElite ? 0.12 : 0.025;
  if (Math.random() < stoneChance) {
    const t = clamp(level < 15 ? 1 : level < 32 ? weighted([[1, 2], [2, 1]]) : weighted([[2, 2], [3, 1]]), 1, 4);
    items.push(generateItem({ baseId: `stone_${t}` }));
  }
  if (Math.random() < (isBoss ? 0.5 : isChest ? 0.1 : 0.01)) {
    items.push(generateItem({ baseId: pick(['scroll_return', 'scroll_might', 'scroll_iron', 'antidote', 'stamina_tonic', level >= 10 ? 'scroll_fortune' : 'scroll_return']) }));
  }
  if (isBoss && Math.random() < 0.25) items.push(generateItem({ baseId: 'lucky_charm' }));
  return { gold, items: items.filter(Boolean) };
}

// =============================================================================
// Shops
// =============================================================================
export const SHOP_DEFS = {
  blacksmith: { id: 'blacksmith', name: 'Blacksmith', kind: 'equipment', size: 12 },
  merchant: { id: 'merchant', name: 'Potion Merchant', kind: 'fixed', items: ['hp_potion_s', 'hp_potion_m', 'hp_potion_l', 'hp_potion_x', 'mp_potion_s', 'mp_potion_m', 'mp_potion_l', 'mp_potion_x', 'elixir', 'antidote', 'stamina_tonic', 'scroll_return', 'scroll_might', 'scroll_iron', 'scroll_haste', 'scroll_fortune'] },
  composer: { id: 'composer', name: 'Composing Master', kind: 'fixed', items: ['stone_1', 'stone_2', 'stone_3', 'lucky_charm', 'crystal_fire_1', 'crystal_ice_1', 'crystal_lightning_1', 'crystal_poison_1', 'scroll_reset'] },
};
const SHOP_ALIASES = [
  ['blacksmith', ['smith', 'weapon', 'armor', 'armour', 'forge', 'equipment', 'gorn', 'fallon', 'gran', 'npc2']],
  ['merchant', ['potion', 'item', 'general', 'alchem', 'shop', 'store', 'merchant', 'trader', 'elara', 'joanna', 'npc3', 'npc6']],
  ['composer', ['compos', 'crystal', 'synth', 'enchant', 'gem', 'jewel', 'lyra']],
];
export function resolveShopId(id) {
  const s = String(id || '').toLowerCase();
  if (SHOP_DEFS[s]) return s;
  for (const [shop, keys] of SHOP_ALIASES) if (keys.some((k) => s.includes(k))) return shop;
  return 'merchant';
}

// =============================================================================
// Composing recipes
// =============================================================================
export const RECIPES = [
  { id: 'r_hp_m', name: 'Brew HP Potion', inputs: [{ baseId: 'hp_potion_s', count: 3 }], output: { baseId: 'hp_potion_m', count: 1 }, chance: 100, gold: 0 },
  { id: 'r_hp_l', name: 'Brew Large HP Potion', inputs: [{ baseId: 'hp_potion_m', count: 3 }], output: { baseId: 'hp_potion_l', count: 1 }, chance: 100, gold: 10 },
  { id: 'r_hp_x', name: 'Brew Grand HP Potion', inputs: [{ baseId: 'hp_potion_l', count: 3 }], output: { baseId: 'hp_potion_x', count: 1 }, chance: 100, gold: 30 },
  { id: 'r_mp_m', name: 'Brew SP Potion', inputs: [{ baseId: 'mp_potion_s', count: 3 }], output: { baseId: 'mp_potion_m', count: 1 }, chance: 100, gold: 0 },
  { id: 'r_mp_l', name: 'Brew Large SP Potion', inputs: [{ baseId: 'mp_potion_m', count: 3 }], output: { baseId: 'mp_potion_l', count: 1 }, chance: 100, gold: 10 },
  { id: 'r_mp_x', name: 'Brew Grand SP Potion', inputs: [{ baseId: 'mp_potion_l', count: 3 }], output: { baseId: 'mp_potion_x', count: 1 }, chance: 100, gold: 30 },
  { id: 'r_elixir', name: 'Brew Elixir of Life', inputs: [{ baseId: 'hp_potion_l', count: 1 }, { baseId: 'mp_potion_l', count: 1 }], output: { baseId: 'elixir', count: 1 }, chance: 100, gold: 50 },
  { id: 'r_stone_2', name: 'Refine Composing Stone', inputs: [{ baseId: 'stone_1', count: 3 }], output: { baseId: 'stone_2', count: 1 }, chance: 90, gold: 100 },
  { id: 'r_stone_3', name: 'Refine Greater Composing Stone', inputs: [{ baseId: 'stone_2', count: 3 }], output: { baseId: 'stone_3', count: 1 }, chance: 75, gold: 400 },
  { id: 'r_stone_4', name: 'Refine Divine Composing Stone', inputs: [{ baseId: 'stone_3', count: 3 }], output: { baseId: 'stone_4', count: 1 }, chance: 55, gold: 1500 },
];

export const UPGRADE_CHANCE = [100, 95, 90, 80, 70, 60, 50, 40, 30, 20];
export const MAX_PLUS = 10;
const SYNTH_CHANCE = [100, 85, 70, 55];
const requiredStoneTier = (plus) => (plus < 4 ? 1 : plus < 7 ? 2 : 3);
const isEquip = (it) => it && !it.stackable && !!it.slot;
const isCrystal = (it) => it && it.subtype === 'crystal';
const isStone = (it) => it && it.subtype === 'stone';
const isCharm = (it) => it && it.subtype === 'charm';

// =============================================================================
// Inventory
// =============================================================================
export class Inventory {
  constructor(game = null, { bagSize = 36, storageSize = 48 } = {}) {
    this.game = game;
    this.bagSize = bagSize;
    this.bag = new Array(bagSize).fill(null);
    this.storageSize = storageSize;
    this.storage = new Array(storageSize).fill(null);
    this.equipment = Object.fromEntries(SLOTS.map((s) => [s, null]));
    this.quickSlots = ['hp_potion_s', 'mp_potion_s', null, null];
    this.shops = {};
    this.potionCooldown = 0;
    this.potionCooldownMax = 0.8;
    this.restockShops(true);
  }

  // ---- compat aliases ------------------------------------------------------
  get equipped() { return this.equipment; }
  get gold() { return this.game ? this.game.hero.gold : 0; }
  equipItem(uid) { return this.equip(uid); }
  unequipItem(slot) { return this.unequip(slot); }
  composeItems(uids) { return this.compose(uids); }
  upgradeEquipment(uid, mats) { return this.upgrade(uid, mats); }
  getShopInventory(id) { return this.getShop(id); }
  buyItem(shopId, idx, qty) { return this.buy(shopId, idx, qty); }
  sellItem(uid, qty) { return this.sell(uid, qty); }
  generateItem(opts) { return generateItem(opts); }

  _emit(...a) { if (this.game) this.game.emit(...a); }
  _changed(statsToo = false) {
    if (this.game) {
      if (statsToo) { this.game.markDirty(); this.game.clampVitals(); }
      this.game.emit('inventory');
      this.game.emit('change');
    }
  }
  _level() { return this.game ? this.game.hero.level : 1; }

  grantStarterKit() {
    const eq = (baseId) => { const it = generateItem({ baseId, rarity: 'normal', level: 1 }); this.equipment[it.slot] = it; };
    eq('sword_1'); eq('shield_1'); eq('armor_1');
    this.addItem(generateItem({ baseId: 'hp_potion_s', count: 5 }), { silent: true });
    this.addItem(generateItem({ baseId: 'mp_potion_s', count: 3 }), { silent: true });
    this.addItem(generateItem({ baseId: 'scroll_return', count: 1 }), { silent: true });
    this.addItem(generateItem({ baseId: 'stone_1', count: 2 }), { silent: true });
    this.addItem(generateItem({ baseId: 'crystal_fire_1', count: 2 }), { silent: true });
    if (this.game) this.game.markDirty();
  }

  // ---- lookup ----------------------------------------------------------------
  findItem(uid) {
    if (uid && typeof uid === 'object') uid = uid.uid;
    let i = this.bag.findIndex((it) => it && it.uid === uid);
    if (i >= 0) return { item: this.bag[i], container: 'bag', index: i };
    for (const s of SLOTS) if (this.equipment[s] && this.equipment[s].uid === uid) return { item: this.equipment[s], container: 'equipment', slot: s };
    i = this.storage.findIndex((it) => it && it.uid === uid);
    if (i >= 0) return { item: this.storage[i], container: 'storage', index: i };
    return null;
  }
  getItem(uid) { const f = this.findItem(uid); return f ? f.item : null; }
  countItem(baseId) { return this.bag.reduce((n, it) => n + (it && it.baseId === baseId ? it.count || 1 : 0), 0); }
  hasItem(baseId, count = 1) { return this.countItem(baseId) >= count; }
  freeSlots() { return this.bag.filter((x) => !x).length; }
  isFull() { return this.freeSlots() === 0; }

  /** Can this item (or stack) fit in the bag? */
  canAdd(item) {
    if (!item) return false;
    if (this.freeSlots() > 0) return true;
    if (!item.stackable) return false;
    const room = this.bag.reduce((n, it) => n + (it && it.baseId === item.baseId ? (it.maxStack || 99) - it.count : 0), 0);
    return room >= (item.count || 1);
  }

  /** Add an item to the bag (stacks merge). Returns {ok,msg,item,leftover}. */
  addItem(item, { silent = false, container = 'bag' } = {}) {
    if (typeof item === 'string') item = generateItem({ baseId: item });
    if (!item) return { ok: false, msg: 'Invalid item' };
    const arr = container === 'storage' ? this.storage : this.bag;
    let remaining = item.count || 1;
    if (item.stackable) {
      for (const it of arr) {
        if (remaining <= 0) break;
        if (it && it.baseId === item.baseId && it.count < (it.maxStack || 99)) {
          const add = Math.min(remaining, (it.maxStack || 99) - it.count);
          it.count += add;
          remaining -= add;
          item.uid = it.uid;
        }
      }
      let firstSlot = true;
      while (remaining > 0) {
        const idx = arr.indexOf(null);
        if (idx < 0) break;
        const add = Math.min(remaining, item.maxStack || 99);
        const uid = firstSlot ? item.uid : newUid();
        firstSlot = false;
        arr[idx] = { ...item, uid, count: add };
        remaining -= add;
      }
    } else {
      const idx = arr.indexOf(null);
      if (idx >= 0) { arr[idx] = item; remaining = 0; }
    }
    const added = (item.count || 1) - remaining;
    if (added <= 0) {
      if (!silent) this._emit('toast', 'Your bag is full!', 'warning');
      return { ok: false, msg: 'Bag is full', item, leftover: item };
    }
    if (!silent && container === 'bag') {
      this._emit('item:added', item, added);
      this._emit('toast', `Obtained ${item.name}${added > 1 ? ' x' + added : ''}`, 'loot');
    }
    if (container === 'bag' && this.game && this.game.quests) this.game.quests.onCollect(item.baseId);
    this._changed();
    const leftover = remaining > 0 ? { ...item, count: remaining } : null;
    return { ok: true, msg: remaining > 0 ? 'Bag partially full' : 'Added', item, added, leftover };
  }

  /** Remove (part of) a bag item. Returns the removed item (copy for partial stacks) or null. */
  removeItem(uid, qty = null) {
    const f = this.findItem(uid);
    if (!f || f.container === 'equipment') return null;
    const arr = f.container === 'storage' ? this.storage : this.bag;
    const it = f.item;
    if (it.stackable && qty != null && qty < it.count) {
      it.count -= qty;
      this._changed();
      return { ...it, uid: newUid(), count: qty };
    }
    arr[f.index] = null;
    this._changed();
    return it;
  }

  /** Consume `qty` of a stackable baseId from the bag. */
  consume(baseId, qty = 1) {
    if (this.countItem(baseId) < qty) return false;
    for (let i = 0; i < this.bag.length && qty > 0; i++) {
      const it = this.bag[i];
      if (!it || it.baseId !== baseId) continue;
      const take = Math.min(qty, it.count || 1);
      it.count = (it.count || 1) - take;
      qty -= take;
      if (it.count <= 0) this.bag[i] = null;
    }
    this._changed();
    return true;
  }

  /** Drop from bag; emits 'item:dropped' so the world can spawn it as ground loot. */
  drop(uid, qty = null) {
    const f = this.findItem(uid);
    if (!f || f.container !== 'bag') return { ok: false, msg: 'Item not in bag' };
    if (f.item.questItem) return { ok: false, msg: 'Quest items cannot be dropped' };
    const it = this.removeItem(uid, qty);
    this._emit('item:dropped', it);
    return { ok: true, msg: `Dropped ${it.name}`, item: it };
  }

  sortBag() {
    const typeOrder = { weapon: 0, armor: 1, accessory: 2, consumable: 3, material: 4, quest: 5 };
    const items = this.bag.filter(Boolean);
    items.sort((a, b) => (typeOrder[a.type] ?? 9) - (typeOrder[b.type] ?? 9)
      || SLOTS.indexOf(a.slot) - SLOTS.indexOf(b.slot)
      || RARITY_ORDER.indexOf(b.rarity) - RARITY_ORDER.indexOf(a.rarity)
      || (b.level || 0) - (a.level || 0)
      || String(a.baseId).localeCompare(String(b.baseId)));
    this.bag = new Array(this.bagSize).fill(null);
    // re-add to merge stacks
    for (const it of items) {
      if (it.stackable) this.addItem(it, { silent: true });
      else this.bag[this.bag.indexOf(null)] = it;
    }
    this._changed();
    return true;
  }

  // ---- equipment -------------------------------------------------------------
  canEquip(item) {
    if (!isEquip(item)) return { ok: false, msg: 'Cannot equip this' };
    if ((item.reqLevel || 1) > this._level()) return { ok: false, msg: `Requires level ${item.reqLevel}` };
    return { ok: true };
  }

  equip(uid) {
    const f = this.findItem(uid);
    if (!f) return { ok: false, msg: 'Item not found' };
    if (f.container === 'equipment') return { ok: true, msg: 'Already equipped' };
    const item = f.item;
    const can = this.canEquip(item);
    if (!can.ok) return can;
    const slot = item.slot;
    const arr = f.container === 'storage' ? this.storage : this.bag;
    const prev = this.equipment[slot];
    arr[f.index] = prev || null; // swap into the same bag cell
    this.equipment[slot] = item;
    this._emit('equip', slot, item, prev);
    this._changed(true);
    return { ok: true, msg: `Equipped ${item.name}`, slot, item, prev };
  }

  unequip(slot) {
    slot = normalizeSlot(slot) || slot;
    const item = this.equipment[slot];
    if (!item) return { ok: false, msg: 'Nothing equipped' };
    const idx = this.bag.indexOf(null);
    if (idx < 0) return { ok: false, msg: 'Bag is full' };
    this.bag[idx] = item;
    this.equipment[slot] = null;
    this._emit('equip', slot, null, item);
    this._changed(true);
    return { ok: true, msg: `Unequipped ${item.name}`, slot, item };
  }

  /** Active set piece counts {setId: n}. */
  getSetCounts() {
    const counts = {};
    for (const s of SLOTS) { const it = this.equipment[s]; if (it && it.setId) counts[it.setId] = (counts[it.setId] || 0) + 1; }
    return counts;
  }

  /** Summed stat modifiers from equipped gear (+ set bonuses). */
  getEquipStats() {
    const out = {};
    for (const s of SLOTS) {
      const it = this.equipment[s];
      if (!it || !it.stats) continue;
      for (const k in it.stats) if (typeof it.stats[k] === 'number') out[k] = (out[k] || 0) + it.stats[k];
    }
    const counts = this.getSetCounts();
    for (const id in counts) {
      const set = SETS[id];
      if (!set) continue;
      for (const n in set.bonuses) if (counts[id] >= Number(n)) for (const k in set.bonuses[n]) out[k] = (out[k] || 0) + set.bonuses[n][k];
    }
    return out;
  }

  /** Visual gear info for models3d (hero mesh). */
  getVisualEquipment() {
    const v = {};
    for (const s of SLOTS) {
      const it = this.equipment[s];
      v[s] = it ? { slot: s, subtype: it.subtype, tier: it.tier, rarity: it.rarity, color: it.color, plus: it.plus || 0, glow: (it.plus || 0) >= 7 || it.rarity === 'unique', gems: (it.gems || []).map((g) => g.element) } : null;
    }
    return v;
  }

  compareWithEquipped(uid) {
    const it = this.getItem(uid);
    if (!isEquip(it)) return null;
    const cur = this.equipment[it.slot];
    const keys = new Set([...Object.keys(it.stats || {}), ...Object.keys(cur?.stats || {})]);
    const diff = {};
    for (const k of keys) { const d = (it.stats?.[k] || 0) - (cur?.stats?.[k] || 0); if (Math.abs(d) > 0.01) diff[k] = Math.round(d * 10) / 10; }
    return { item: it, equipped: cur, diff, lines: Object.entries(diff).map(([k, d]) => ({ text: formatStat(k, d), better: d > 0 })) };
  }

  // ---- consumables -----------------------------------------------------------
  update(dt) { if (this.potionCooldown > 0) this.potionCooldown = Math.max(0, this.potionCooldown - dt); }

  useItem(uid) {
    const f = this.findItem(uid);
    if (!f) return { ok: false, msg: 'Item not found' };
    const it = f.item;
    if (isEquip(it)) return f.container === 'equipment' ? this.unequip(f.slot) : this.equip(uid);
    if (it.type !== 'consumable' || !it.effect) return { ok: false, msg: 'Cannot use this item' };
    if (f.container !== 'bag') return { ok: false, msg: 'Move it to your bag first' };
    const g = this.game;
    if (!g) return { ok: false, msg: 'No hero' };
    if (g.hero.dead) return { ok: false, msg: 'You are dead' };
    const e = it.effect;
    const base = ITEM_BASES[it.baseId] || {};
    if (base.potion && this.potionCooldown > 0) return { ok: false, msg: 'Potion on cooldown' };
    const s = g.getStats();
    if (base.potion && !e.stamina && ((e.heal || e.healPct) && !(e.mana || e.manaPct)) && g.hero.hp >= s.maxHp) return { ok: false, msg: 'HP is already full' };
    if (base.potion && ((e.mana || e.manaPct) && !(e.heal || e.healPct)) && g.hero.mp >= s.maxMp) return { ok: false, msg: 'SP is already full' };
    if (e.heal || e.mana) g.heal(e.heal || 0, e.mana || 0);
    if (e.healPct || e.manaPct) g.heal(s.maxHp * (e.healPct || 0), s.maxMp * (e.manaPct || 0));
    if (e.stamina) g.hero.stamina = Math.min(s.maxStamina, g.hero.stamina + e.stamina);
    if (e.cure) g.cleanseDebuffs();
    if (e.buff) g.addBuff({ ...e.buff });
    if (e.resetAll) { g.resetAttributes(); if (g.skills) g.skills.resetAll(); }
    if (e.townPortal) {
      g.emit('townPortal');
      if (typeof window !== 'undefined' && window.__ASJ_GAME__ && typeof window.__ASJ_GAME__.returnToVillage === 'function') {
        window.__ASJ_GAME__.returnToVillage();
      }
    }
    if (base.potion) this.potionCooldown = this.potionCooldownMax;
    this.removeItem(uid, 1);
    g.emit('item:used', it);
    return { ok: true, msg: `Used ${it.baseName || it.name}`, item: it, effect: e };
  }

  /** Assign quick slot to a consumable (uid or baseId). */
  assignQuickSlot(i, uidOrBaseId) {
    if (i < 0 || i >= this.quickSlots.length) return { ok: false, msg: 'Invalid slot' };
    if (uidOrBaseId == null) { this.quickSlots[i] = null; this._changed(); return { ok: true, msg: 'Slot cleared' }; }
    const it = this.getItem(uidOrBaseId);
    const baseId = it ? it.baseId : uidOrBaseId;
    const base = ITEM_BASES[baseId];
    if (!base || base.type !== 'consumable') return { ok: false, msg: 'Only consumables can be assigned' };
    this.quickSlots = this.quickSlots.map((q) => (q === baseId ? null : q));
    this.quickSlots[i] = baseId;
    this._changed();
    return { ok: true, msg: `${base.name} assigned to slot ${i + 1}` };
  }

  useQuickSlot(i) {
    const baseId = this.quickSlots[i];
    if (!baseId) return { ok: false, msg: 'Empty slot' };
    const it = this.bag.find((x) => x && x.baseId === baseId);
    if (!it) return { ok: false, msg: `No ${ITEM_BASES[baseId]?.name || 'items'} left` };
    return this.useItem(it.uid);
  }

  getQuickSlotView() {
    return this.quickSlots.map((baseId, i) => {
      const base = baseId ? ITEM_BASES[baseId] : null;
      return {
        key: String(i + 1 + 5 > 9 ? i + 1 : i + 6), // default keys 6-9 (1-5 are skills)
        slot: i,
        baseId,
        cooldown: this.potionCooldown, cooldownMax: this.potionCooldownMax,
        item: base ? { baseId, name: base.name, icon: base.icon, count: this.countItem(baseId), desc: base.desc } : null,
      };
    });
  }

  // ---- storage ---------------------------------------------------------------
  deposit(uid) {
    const f = this.findItem(uid);
    if (!f || f.container !== 'bag') return { ok: false, msg: 'Item not in bag' };
    if (!this.storage.includes(null) && !(f.item.stackable && this.storage.some((s) => s && s.baseId === f.item.baseId && s.count + f.item.count <= (s.maxStack || 99)))) return { ok: false, msg: 'Storage is full' };
    const it = this.removeItem(uid);
    this.addItem(it, { silent: true, container: 'storage' });
    return { ok: true, msg: `Stored ${it.name}` };
  }
  withdraw(uid) {
    const f = this.findItem(uid);
    if (!f || f.container !== 'storage') return { ok: false, msg: 'Item not in storage' };
    if (!this.canAdd(f.item)) return { ok: false, msg: 'Bag is full' };
    this.storage[f.index] = null;
    this.addItem(f.item, { silent: true });
    return { ok: true, msg: `Withdrew ${f.item.name}` };
  }
  getStorageView() { return { items: this.storage.slice(), size: this.storageSize }; }

  // ---- shops -----------------------------------------------------------------
  restockShops(force = false) {
    const lvl = this._level();
    for (const id in SHOP_DEFS) {
      const def = SHOP_DEFS[id];
      if (def.kind === 'equipment') {
        if (!force && this.shops[id] && this.shops[id].level === lvl) continue;
        const stock = [];
        for (let i = 0; i < def.size; i++) {
          const slot = SLOTS[i % SLOTS.length];
          const rarity = weighted([['normal', 60], ['magic', 30], ['rare', lvl >= 5 ? 9 : 0], ['epic', lvl >= 15 ? 1 : 0]]);
          const it = generateItem({ slot, level: Math.max(1, lvl + randi(-1, 2)), rarity });
          if (it) stock.push(it);
        }
        this.shops[id] = { level: lvl, stock };
      } else {
        this.shops[id] = { level: lvl, stock: def.items.filter((b) => ITEM_BASES[b]).map((b) => generateItem({ baseId: b })) };
      }
    }
  }

  getShop(shopId) {
    const id = resolveShopId(shopId);
    const def = SHOP_DEFS[id];
    if (!this.shops[id]) this.restockShops(true);
    const lvl = this._level();
    const items = this.shops[id].stock.map((it, idx) => ({ ...it, idx, price: it.price, buyPrice: it.price, locked: (it.reqLevel || 1) > lvl + 5, unlimited: def.kind === 'fixed' }));
    return { id, name: def.name, kind: def.kind, items, gold: this.gold };
  }

  buy(shopId, idx, qty = 1) {
    const id = resolveShopId(shopId);
    const def = SHOP_DEFS[id];
    const shop = this.shops[id];
    const tpl = shop && shop.stock[idx];
    if (!tpl) return { ok: false, msg: 'Item not available' };
    qty = Math.max(1, qty | 0);
    if (!tpl.stackable) qty = 1;
    const cost = tpl.price * qty;
    if (!this.game || this.game.hero.gold < cost) return { ok: false, msg: 'Not enough gold' };
    const item = tpl.stackable ? { ...tpl, uid: newUid(), count: qty } : (def.kind === 'fixed' ? { ...tpl, uid: newUid() } : tpl);
    delete item.idx; delete item.buyPrice; delete item.locked; delete item.unlimited;
    if (!this.canAdd(item)) return { ok: false, msg: 'Bag is full' };
    this.game.spendGold(cost);
    if (def.kind === 'equipment') shop.stock.splice(idx, 1);
    this.addItem(item, { silent: true });
    this._emit('toast', `Bought ${item.name}${qty > 1 ? ' x' + qty : ''} for ${cost}g`, 'loot');
    this._emit('shop:buy', item, cost);
    return { ok: true, msg: `Bought ${item.name}`, item, cost };
  }

  sell(uid, qty = null) {
    const f = this.findItem(uid);
    if (!f || f.container !== 'bag') return { ok: false, msg: 'Item not in bag' };
    if (f.item.questItem) return { ok: false, msg: 'Quest items cannot be sold' };
    const n = f.item.stackable ? (qty == null ? f.item.count : clamp(qty | 0, 1, f.item.count)) : 1;
    const gold = (f.item.value || 0) * n;
    const it = this.removeItem(uid, f.item.stackable ? n : null);
    if (this.game) this.game.addGold(gold);
    this._emit('shop:sell', it, gold);
    return { ok: true, msg: `Sold ${it.name}${n > 1 ? ' x' + n : ''} for ${gold}g`, gold };
  }

  // ---- composing -------------------------------------------------------------
  getRecipes() {
    return RECIPES.map((r) => ({
      ...r,
      inputs: r.inputs.map((i) => ({ ...i, name: ITEM_BASES[i.baseId]?.name || i.baseId, have: this.countItem(i.baseId) })),
      outputName: ITEM_BASES[r.output.baseId]?.name || r.output.baseId,
      canCraft: r.inputs.every((i) => this.countItem(i.baseId) >= i.count),
    })).concat([
      { id: 'upgrade', name: 'Upgrade Equipment', desc: 'Equipment + Composing Stone (+ Lucky Charm): +1 upgrade level (+10% base stats per level, max +10).' },
      { id: 'infuse', name: 'Crystal Infusion', desc: 'Equipment + Crystal: socket the crystal. Weapons gain elemental damage, armor gains resistance.' },
      { id: 'synthesis', name: 'Crystal Synthesis', desc: '3 crystals of the same element and tier: 1 crystal of the next tier.' },
      { id: 'fusion', name: 'Prism Fusion', desc: 'Fire + Ice + Lightning + Poison crystals of the same tier: 1 Prism Crystal.' },
      { id: 'reforge', name: 'Reforge', desc: '3 equipment of the same rarity: 1 random equipment of the next rarity.' },
      { id: 'dismantle', name: 'Dismantle', desc: '1 equipment: break it down into crystals and composing stones.' },
    ]);
  }

  _resolveUids(uids) {
    if (!Array.isArray(uids)) uids = [uids];
    const seen = new Set();
    const out = [];
    for (const u of uids) {
      const key = u && typeof u === 'object' ? u.uid : u;
      if (!key || seen.has(key)) continue;
      seen.add(key);
      const f = this.findItem(key);
      if (f && f.container !== 'storage') out.push(f);
    }
    return out;
  }

  /**
   * Analyse a set of selected item uids and describe what composing would do.
   * Returns { ok, mode, title, desc, chance, cost, reason, consumes:[{uid,count}] }.
   */
  previewCompose(uids, forceMode = null) {
    const wrap = (obj) => ({ ...obj, text: obj.desc || obj.title || '', msg: obj.reason || obj.desc || '' });
    const found = this._resolveUids(uids);
    const items = found.map((f) => f.item);
    const fail = (reason) => wrap({ ok: false, mode: null, title: 'Compose', desc: reason, reason, chance: 0, cost: 0 });
    if (!items.length) return fail('Place items into the composing slots.');
    if (found.some((f) => f.container === 'equipment' && !isEquip(f.item))) return fail('Invalid selection.');
    const equips = items.filter(isEquip);
    const charms = items.filter(isCharm);
    const others = items.filter((i) => !isEquip(i) && !isCharm(i));
    const charmBonus = charms.length ? 15 : 0;
    const gold = this.gold;

    // 1. recipes (exact multiset of stackables)
    if (!equips.length && !forceMode) {
      for (const r of RECIPES) {
        const need = {};
        for (const i of r.inputs) need[i.baseId] = (need[i.baseId] || 0) + i.count;
        const selBases = new Set(others.map((i) => i.baseId));
        if (selBases.size !== Object.keys(need).length || ![...selBases].every((b) => need[b])) continue;
        const enough = Object.entries(need).every(([b, c]) => this.countItem(b) >= c);
        const chance = clamp((r.chance || 100) + charmBonus, 0, 100);
        const consumes = Object.entries(need).map(([baseId, count]) => ({ baseId, count }));
        if (charms.length) consumes.push({ baseId: 'lucky_charm', count: 1 });
        return wrap({
          ok: enough && gold >= (r.gold || 0), mode: 'recipe', recipe: r.id, title: r.name, chance, cost: r.gold || 0, consumes,
          desc: `${r.inputs.map((i) => `${i.count}x ${ITEM_BASES[i.baseId]?.name}`).join(' + ')} → ${r.output.count}x ${ITEM_BASES[r.output.baseId]?.name}`,
          reason: !enough ? 'Not enough materials' : gold < (r.gold || 0) ? 'Not enough gold' : null,
        });
      }
    }

    // 2/3. single equipment + stone(s) or crystal
    if (equips.length === 1 && others.length) {
      const target = equips[0];
      const stones = others.filter(isStone);
      const crystals = others.filter(isCrystal);
      if ((stones.length && !crystals.length && forceMode !== 'infuse') || forceMode === 'upgrade') {
        const plus = target.plus || 0;
        if (plus >= MAX_PLUS) return fail('This item is already at maximum upgrade (+10).');
        const req = requiredStoneTier(plus);
        const stone = stones.filter((s) => s.tier >= req).sort((a, b) => a.tier - b.tier)[0];
        if (!stone) return fail(`Requires a ${STONE_NAMES[req - 1]} or better for +${plus + 1}.`);
        const chance = clamp(UPGRADE_CHANCE[plus] + (stone.tier - req) * 8 + (stone.tier === 4 ? 15 : 0) + charmBonus, 1, 100);
        const cost = Math.round(25 * Math.pow(plus + 1, 2) + (target.level || 1) * 5);
        const consumes = [{ uid: stone.uid, count: 1 }];
        if (charms.length) consumes.push({ uid: charms[0].uid, count: 1 });
        return wrap({
          ok: gold >= cost, mode: 'upgrade', title: `Upgrade to +${plus + 1}`, target: target.uid, chance, cost, consumes,
          desc: `${target.name} → +${plus + 1} (+10% base stats). ${plus >= 4 && !charms.length ? 'On failure the item loses 1 upgrade level.' : 'No penalty on failure.'}`,
          reason: gold < cost ? 'Not enough gold' : null,
        });
      }
      if (crystals.length === 1 && !stones.length) {
        const c = crystals[0];
        const gems = target.gems || [];
        if (gems.length >= (target.sockets || 1)) return fail(`${target.name} has no free sockets (${gems.length}/${target.sockets || 1}).`);
        const cost = 60 * c.tier;
        const eff = target.slot === 'weapon'
          ? (c.element === 'prism' ? formatStat('allAttrs', SOCKET_PRISM_ATTR[c.tier - 1]) : formatStat(`${c.element}Dmg`, SOCKET_GEM_DMG[c.tier - 1]))
          : (c.element === 'prism' ? formatStat('allRes', SOCKET_PRISM_RES[c.tier - 1]) : formatStat(`${c.element}Res`, SOCKET_GEM_RES[c.tier - 1]));
        return wrap({
          ok: gold >= cost, mode: 'infuse', title: 'Crystal Infusion', target: target.uid, chance: 100, cost,
          consumes: [{ uid: c.uid, count: 1 }], desc: `Socket ${c.baseName || c.name} into ${target.name}: ${eff}`, reason: gold < cost ? 'Not enough gold' : null,
        });
      }
      return fail('Combine one equipment with a Composing Stone (upgrade) or a single Crystal (infusion).');
    }

    // 4/5. crystals only
    if (!equips.length && others.length && others.every(isCrystal)) {
      const elems = new Set(others.map((c) => c.element));
      const tiers = new Set(others.map((c) => c.tier));
      if (tiers.size !== 1) return fail('Crystals must be of the same tier.');
      const tier = [...tiers][0];
      if (elems.size === 1) {
        const el = [...elems][0];
        const selCount = others.reduce((n, c) => n + (c.count || 1), 0);
        const bagCount = this.countItem(`crystal_${el}_${tier}`);
        const total = others.length === 1 && selCount < 2 ? Math.min(3, bagCount) : selCount;
        if (tier >= 5) return fail('Perfect crystals cannot be synthesized further.');
        if (total < 2) return fail(`Synthesis needs at least 2 crystals (selected ${total}).`);
        const usedCount = Math.min(3, total);
        const chance = clamp(SYNTH_CHANCE[tier - 1] - (usedCount < 3 ? 10 : 0) + charmBonus, 10, 100);
        const cost = 50 * tier * tier;
        const consumes = [{ baseId: `crystal_${el}_${tier}`, count: usedCount }];
        if (charms.length) consumes.push({ uid: charms[0].uid, count: 1 });
        return wrap({
          ok: gold >= cost, mode: 'synthesis', title: 'Crystal Synthesis', chance, cost, consumes, output: `crystal_${el}_${tier + 1}`,
          desc: `${usedCount}x ${ITEM_BASES[`crystal_${el}_${tier}`].name} → ${ITEM_BASES[`crystal_${el}_${tier + 1}`].name}. On failure 1 crystal is lost.`,
          reason: gold < cost ? 'Not enough gold' : null,
        });
      }
      if (ELEMENTS.every((e) => elems.has(e)) && elems.size === 4) {
        const cost = 120 * tier;
        return wrap({
          ok: gold >= cost, mode: 'fusion', title: 'Prism Fusion', chance: 100, cost, output: `crystal_prism_${tier}`,
          consumes: ELEMENTS.map((e) => ({ baseId: `crystal_${e}_${tier}`, count: 1 })),
          desc: `Fire + Ice + Lightning + Poison → ${ITEM_BASES[`crystal_prism_${tier}`].name}`, reason: gold < cost ? 'Not enough gold' : null,
        });
      }
      return fail('Use 2–3 crystals of one element (synthesis) or one of each element (fusion).');
    }

    // 6. reforge (2-4 equipment items of the same rarity)
    if (equips.length >= 2 && equips.length <= 4 && !others.length) {
      const rar = new Set(equips.map((e) => e.rarity));
      if (rar.size !== 1) return fail('Reforging needs items of the same rarity.');
      const r = [...rar][0];
      if (r === 'unique') return fail('Unique items cannot be reforged.');
      if (found.some((f) => f.container !== 'bag')) return fail('Unequip items before reforging.');
      const next = RARITY_ORDER[RARITY_ORDER.indexOf(r) + 1];
      const cost = 100 * (RARITY_ORDER.indexOf(r) + 1) * (RARITY_ORDER.indexOf(r) + 1) + Math.max(...equips.map((e) => e.level || 1)) * 10;
      const chance = clamp(equips.length >= 3 ? 100 : 80 + charmBonus, 10, 100);
      return wrap({
        ok: gold >= cost, mode: 'reforge', title: 'Reforge', chance, cost, nextRarity: next,
        consumes: equips.map((e) => ({ uid: e.uid, count: 1 })),
        desc: `${equips.length} ${RARITY[r].name} items → 1 random ${RARITY[next].name} item.`, reason: gold < cost ? 'Not enough gold' : null,
      });
    }

    // 7. dismantle
    if (equips.length === 1 && !others.length && !charms.length) {
      if (found[0].container !== 'bag') return fail('Unequip the item before dismantling.');
      return wrap({ ok: true, mode: 'dismantle', title: 'Dismantle', chance: 100, cost: 0, consumes: [{ uid: equips[0].uid, count: 1 }], desc: `Break down ${equips[0].name} into crystals and composing stones.` });
    }
    return fail('No composing formula matches these items.');
  }

  /** Execute composing. Returns { ok, success, msg, item, mode }. */
  compose(uids, forceMode = null) {
    const p = this.previewCompose(uids, forceMode);
    if (!p.ok) return { ok: false, success: false, msg: p.reason || p.desc, preview: p };
    const g = this.game;
    if (p.cost && !(g && g.spendGold(p.cost))) return { ok: false, success: false, msg: 'Not enough gold' };
    const success = Math.random() * 100 < p.chance;
    const consumeAll = () => {
      for (const c of p.consumes || []) {
        if (c.uid) this.removeItem(c.uid, this.getItem(c.uid)?.stackable ? c.count : null);
        else this.consume(c.baseId, c.count);
      }
    };
    let result = null, msg = '';
    const hasCharm = (p.consumes || []).some((c) => (c.uid && this.getItem(c.uid)?.subtype === 'charm') || c.baseId === 'lucky_charm');
    switch (p.mode) {
      case 'recipe': {
        const r = RECIPES.find((x) => x.id === p.recipe);
        consumeAll();
        if (success) { result = generateItem({ baseId: r.output.baseId, count: r.output.count }); this._addOrDrop(result); msg = `Created ${result.name}${r.output.count > 1 ? ' x' + r.output.count : ''}!`; }
        else msg = 'Composing failed. The materials were lost.';
        break;
      }
      case 'upgrade': {
        const target = this.getItem(p.target);
        consumeAll();
        if (success) { target.plus = (target.plus || 0) + 1; msg = `Success! ${target.baseName} is now +${target.plus}.`; }
        else if ((target.plus || 0) >= 4 && !hasCharm) { target.plus -= 1; msg = `Upgrade failed... ${target.baseName} dropped to +${target.plus}.`; }
        else msg = 'Upgrade failed. The stone crumbled.';
        recalcItem(target);
        result = target;
        break;
      }
      case 'infuse': {
        const target = this.getItem(p.target);
        const crystal = this.getItem(p.consumes[0].uid);
        target.gems = [...(target.gems || []), { element: crystal.element, tier: crystal.tier }];
        consumeAll();
        recalcItem(target);
        result = target;
        msg = `${target.baseName} infused with ${crystal.baseName || crystal.name}!`;
        break;
      }
      case 'synthesis': {
        if (success) { consumeAll(); result = generateItem({ baseId: p.output }); this._addOrDrop(result); msg = `Synthesized ${result.name}!`; }
        else { this.consume(p.consumes[0].baseId, 1); for (const c of p.consumes.slice(1)) if (c.uid) this.removeItem(c.uid, 1); msg = 'Synthesis failed. One crystal shattered.'; }
        break;
      }
      case 'fusion': {
        consumeAll();
        result = generateItem({ baseId: p.output });
        this._addOrDrop(result);
        msg = `Fused a ${result.name}!`;
        break;
      }
      case 'reforge': {
        const src = (p.consumes || []).map((c) => this.getItem(c.uid));
        const level = Math.max(...src.map((s) => s.level || 1));
        const slot = pick(src).slot;
        consumeAll();
        result = generateItem({ slot, level, rarity: success ? p.nextRarity : src[0].rarity });
        this._addOrDrop(result);
        msg = success ? `Reforged into ${result.name}!` : `Reforge unstable — obtained ${result.name}.`;
        break;
      }
      case 'dismantle': {
        const it = this.getItem(p.consumes[0].uid);
        consumeAll();
        const ri = RARITY_ORDER.indexOf(it.rarity);
        const ct = clamp(Math.floor((it.level || 1) / 15) + (ri >= 2 ? 1 : 0), 1, 5);
        const gains = [];
        if (ri > 0 || Math.random() < 0.5) gains.push(generateItem({ baseId: `crystal_${pick(ELEMENTS)}_${ct}`, count: ri >= 3 ? 2 : 1 }));
        if (Math.random() < [0.08, 0.2, 0.5, 0.8, 1][ri]) gains.push(generateItem({ baseId: `stone_${ri >= 3 ? 2 : 1}` }));
        if ((it.plus || 0) >= 5) gains.push(generateItem({ baseId: 'stone_2' }));
        for (const gi of gains) this._addOrDrop(gi);
        result = gains[0] || null;
        msg = gains.length ? `Dismantled into ${gains.map((x) => x.name + (x.count > 1 ? ' x' + x.count : '')).join(', ')}.` : 'Dismantled, but nothing useful remained.';
        break;
      }
      default:
        return { ok: false, success: false, msg: 'Unknown composing mode' };
    }
    if (g) {
      g.progress.composes = (g.progress.composes || 0) + 1;
      if (g.quests) g.quests.onCompose(p.mode, success, result);
      g.emit('compose', { mode: p.mode, success, item: result, msg });
      g.emit('toast', msg, success ? 'loot' : 'warning');
    }
    this._changed(true);
    return { ok: success, success, msg, item: result, mode: p.mode };
  }

  _addOrDrop(item) {
    const r = this.addItem(item, { silent: true });
    if (!r.ok || r.leftover) this._emit('item:dropped', r.leftover || item);
  }

  previewUpgrade(itemUid, matUids = []) {
    const mats = Array.isArray(matUids) ? matUids : [matUids];
    const it = this.getItem(itemUid);
    const mode = mats.map((u) => this.getItem(u)).some(isCrystal) ? 'infuse' : 'upgrade';
    return this.previewCompose([itemUid, ...mats], mode);
  }
  upgrade(itemUid, matUids = []) {
    const mats = Array.isArray(matUids) ? matUids : [matUids];
    if (!mats.length || mats.every((m) => m == null)) {
      // auto-pick the cheapest eligible stone (+ charm is never auto-used)
      const it = this.getItem(itemUid);
      if (!isEquip(it)) return { ok: false, msg: 'Select equipment to upgrade' };
      const req = requiredStoneTier(it.plus || 0);
      const stone = this.bag.filter((x) => isStone(x) && x.tier >= req).sort((a, b) => a.tier - b.tier)[0];
      if (!stone) return { ok: false, msg: `Requires a ${STONE_NAMES[req - 1]} or better` };
      mats.push(stone.uid);
    }
    const mode = mats.map((u) => this.getItem(u)).some(isCrystal) ? 'infuse' : 'upgrade';
    return this.compose([itemUid, ...mats], mode);
  }

  // ---- views -----------------------------------------------------------------
  getView() {
    return {
      gold: this.gold,
      bag: this.bag.slice(),
      bagSize: this.bagSize,
      equipment: { ...this.equipment, offhand: this.equipment.shield },
      quickSlots: this.getQuickSlotView(),
      setBonuses: this.getActiveSetBonuses(),
    };
  }

  getActiveSetBonuses() {
    const counts = this.getSetCounts();
    return Object.entries(counts).map(([id, n]) => {
      const set = SETS[id];
      return { id, name: set.name, count: n, total: Object.keys(set.pieces).length, bonuses: Object.entries(set.bonuses).map(([need, mods]) => ({ need: Number(need), active: n >= Number(need), lines: Object.entries(mods).map(([k, v]) => formatStat(k, v)) })) };
    });
  }

  /** Tooltip model: { name, color, rarityName, typeLine, lines:[string], reqLevel, value, lore }. */
  getTooltip(itemOrUid) {
    const it = typeof itemOrUid === 'object' && itemOrUid ? itemOrUid : this.getItem(itemOrUid);
    if (!it) return null;
    const lines = [];
    const s = it.stats || {};
    if (s.atkMin != null) lines.push(`Attack: ${s.atkMin} - ${s.atkMax}`);
    if (s.matk) lines.push(`Magic Attack: ${s.matk}`);
    if (s.def) lines.push(`Defense: ${s.def}`);
    if (!it.stackable) {
      for (const k in it.baseStats || {}) if (!['atkMin', 'atkMax', 'matk', 'def'].includes(k)) lines.push(formatStat(k, s[k] ?? it.baseStats[k]));
      for (const a of it.affixes || []) lines.push(a);
      if (it.sockets) lines.push(`Sockets: ${(it.gems || []).length}/${it.sockets}`);
      if (it.setId && SETS[it.setId]) {
        const set = SETS[it.setId];
        const n = this.getSetCounts()[it.setId] || 0;
        lines.push(`${set.name} (${n}/${Object.keys(set.pieces).length})`);
        for (const [need, mods] of Object.entries(set.bonuses)) lines.push(`  (${need}) ${Object.entries(mods).map(([k, v]) => formatStat(k, v)).join(', ')}`);
      }
    } else if (it.desc) lines.push(it.desc);
    const typeLine = it.slot ? `${RARITY[it.rarity]?.name || ''} ${SLOT_NAMES[it.slot]}${it.subtype && it.subtype !== it.slot ? ' (' + it.subtype + ')' : ''}` : (it.subtype || it.type);
    return {
      name: it.name + (it.count > 1 ? ` x${it.count}` : ''), color: it.color || RARITY[it.rarity]?.color, rarity: it.rarity, rarityName: RARITY[it.rarity]?.name,
      typeLine, lines, reqLevel: it.reqLevel || 1, meetsLevel: (it.reqLevel || 1) <= this._level(), value: it.value || 0, price: it.price || 0, lore: it.lore || null, icon: it.icon,
    };
  }

  // ---- persistence -----------------------------------------------------------
  toJSON() {
    return {
      bag: this.bag, equipment: this.equipment, storage: this.storage, quickSlots: this.quickSlots, shops: this.shops, bagSize: this.bagSize, storageSize: this.storageSize,
    };
  }
  fromJSON(d = {}) {
    const fix = (it) => (it && typeof it === 'object' ? recalcItem(it) : null);
    if (d.bagSize) this.bagSize = d.bagSize;
    if (d.storageSize) this.storageSize = d.storageSize;
    this.bag = new Array(this.bagSize).fill(null).map((_, i) => fix((d.bag || [])[i]));
    this.storage = new Array(this.storageSize).fill(null).map((_, i) => fix((d.storage || [])[i]));
    this.equipment = Object.fromEntries(SLOTS.map((s) => [s, fix((d.equipment || {})[s] || (s === 'shield' ? (d.equipment || {}).offhand : null))]));
    if (Array.isArray(d.quickSlots)) this.quickSlots = d.quickSlots.slice(0, 4).concat([null, null, null, null]).slice(0, 4);
    if (d.shops && typeof d.shops === 'object') this.shops = d.shops; else this.restockShops(true);
    for (const id in SHOP_DEFS) if (!this.shops[id]) this.restockShops(true);
    _uidCounter += 1000;
    if (this.game) this.game.markDirty();
  }
}

export const InventorySystem = Inventory;
export const createInventory = (game) => new Inventory(game);

// =============================================================================
// Extracted data integration (best-effort, schema tolerant)
// =============================================================================
function guessSlot(r) {
  const s = normalizeSlot(r.slot) || normalizeSlot(r.equipSlot) || normalizeSlot(r.subtype) || normalizeSlot(r.category);
  if (s) return s;
  const t = `${r.type || ''} ${r.category || ''} ${r.kind || ''} ${r.name || ''}`.toLowerCase();
  if (/sword|axe|mace|staff|blade|hammer|spear|dagger|bow|wand|weapon/.test(t)) return 'weapon';
  if (/shield|buckler|aegis/.test(t)) return 'shield';
  if (/helm|cap|hat|hood|crown|coif/.test(t)) return 'helmet';
  if (/boot|greave|shoe/.test(t)) return 'boots';
  if (/amulet|necklace|pendant|talisman/.test(t)) return 'necklace';
  if (/ring|band|seal/.test(t)) return 'ring';
  if (/armor|armour|mail|plate|vest|robe|cloth/.test(t)) return 'armor';
  return null;
}
function guessSubtype(slot, r) {
  if (slot !== 'weapon') return slot;
  const t = `${r.subtype || ''} ${r.type || ''} ${r.name || ''}`.toLowerCase();
  if (/axe|cleaver/.test(t)) return 'axe';
  if (/mace|hammer|club|maul|flail/.test(t)) return 'mace';
  if (/staff|wand|scepter|rod/.test(t)) return 'staff';
  return 'sword';
}
function readNum(r, ...keys) { for (const k of keys) { if (r[k] != null && Number.isFinite(Number(r[k]))) return Number(r[k]); if (r.stats && r.stats[k] != null && Number.isFinite(Number(r.stats[k]))) return Number(r.stats[k]); } return undefined; }

export function applyItemData(data) {
  if (!data || typeof data !== 'object') return 0;
  const groups = [];
  const push = (v) => { if (Array.isArray(v)) groups.push(...v); else if (v && typeof v === 'object') groups.push(...Object.entries(v).map(([k, x]) => (x && typeof x === 'object' ? { id: x.id || k, ...x } : null)).filter(Boolean)); };
  const src = data.items && !Array.isArray(data.items) && typeof data.items === 'object' && (data.items.weapons || data.items.armor || data.items.equipment || data.items.consumables) ? data.items : data;
  for (const key of ['items', 'equipment', 'weapons', 'armor', 'armors', 'accessories', 'shields', 'helmets', 'boots', 'rings', 'necklaces', 'potions', 'consumables', 'materials', 'gems', 'crystals']) {
    if (src[key] && !(src === data.items && key === 'items')) push(src[key]);
  }
  let added = 0;
  for (const r of groups) {
    if (!r || typeof r !== 'object' || !r.name) continue;
    const id = r.id && !ITEM_BASES[r.id] ? String(r.id) : `x_${slug(r.name)}`;
    if (ITEM_BASES[id]) continue;
    const slot = guessSlot(r);
    if (slot) {
      const reqLevel = Math.max(1, readNum(r, 'reqLevel', 'levelRequire', 'level', 'requiredLevel', 'lvl') || 1);
      const t = clamp(TIER_LEVELS.filter((l) => l <= reqLevel).length - 1, 0, 7);
      const stats = {};
      const atk = readNum(r, 'atk', 'attack', 'damage', 'dmg');
      const atkMin = readNum(r, 'atkMin', 'minAtk', 'minDamage', 'damageMin');
      const atkMax = readNum(r, 'atkMax', 'maxAtk', 'maxDamage', 'damageMax');
      if (slot === 'weapon') {
        stats.atkMin = Math.round(atkMin ?? (atk != null ? atk * 0.85 : WEAPON_ATK[t][0]));
        stats.atkMax = Math.round(atkMax ?? (atk != null ? atk * 1.15 : WEAPON_ATK[t][1]));
      } else if (atk != null) stats.atk = atk;
      const def = readNum(r, 'def', 'defense', 'defence', 'armor');
      if (def != null) stats.def = def;
      for (const [k, keys] of Object.entries({ hp: ['hp', 'maxHp', 'health'], mp: ['mp', 'maxMp', 'mana', 'sp'], str: ['str', 'strength'], dex: ['dex', 'dexterity', 'agi', 'agility'], int: ['int', 'intelligence', 'wis'], lck: ['lck', 'luck', 'luk'], critRate: ['crit', 'critRate', 'critical'], matk: ['matk', 'magic', 'magicAttack'] })) {
        const v = readNum(r, ...keys); if (v != null && !(k === 'mp' && slot === 'weapon' && keys === 'sp')) stats[k] = v;
      }
      if (slot !== 'weapon' && stats.def == null && ['shield', 'helmet', 'armor', 'boots'].includes(slot)) stats.def = [3, 6, 10, 15, 21, 29, 39, 52][t];
      const sub = guessSubtype(slot, r);
      const isGenericTier = /tier \d+$/i.test(String(r.name));
      registerItemBase({
        id, name: String(r.name), type: slot === 'weapon' ? 'weapon' : ['necklace', 'ring'].includes(slot) ? 'accessory' : 'armor', slot, subtype: sub, tier: t, reqLevel,
        stats, price: Math.max(5, readNum(r, 'price', 'basePrice', 'cost', 'value', 'gold') || Math.round(30 * Math.pow(t + 1, 2.2))), icon: ICONS[sub] || ICONS[slot], material: TIER_MATERIALS[t],
        desc: r.desc || r.description || '', noDrop: isGenericTier, source: 'swf',
      });
      added++;
    } else {
      const t = `${r.type || ''} ${r.category || ''} ${r.name || ''}`.toLowerCase();
      const heal = readNum(r, 'heal', 'hp', 'restoreHp', 'hpRestore');
      const mana = readNum(r, 'mana', 'mp', 'sp', 'restoreMp', 'mpRestore');
      if (/potion|elixir|food|herb|consum/.test(t) || heal || mana) {
        registerItemBase({ id, name: String(r.name), icon: mana && !heal ? ICONS.mp : ICONS.hp, type: 'consumable', stackable: true, maxStack: 99, price: readNum(r, 'price', 'cost', 'value') || 30, reqLevel: readNum(r, 'reqLevel', 'level') || 1, effect: { heal: heal || 0, mana: mana || 0 }, potion: true, desc: r.desc || r.description || '', source: 'swf' });
        added++;
      } else if (/crystal|gem|stone|ore|material|jewel/.test(t)) {
        registerItemBase({ id, name: String(r.name), icon: ICONS.crystal, type: 'material', subtype: 'material', stackable: true, maxStack: 99, price: readNum(r, 'price', 'cost', 'value') || 50, reqLevel: 1, desc: r.desc || r.description || 'Composing material.', source: 'swf' });
        added++;
      }
    }
  }
  const recipes = data.recipes || data.composing?.recipes || data.compose?.recipes;
  if (Array.isArray(recipes)) {
    for (const r of recipes) {
      const inputs = (r.inputs || r.ingredients || r.materials || []).map((i) => (typeof i === 'string' ? { baseId: i, count: 1 } : { baseId: i.baseId || i.id || i.item || `x_${slug(i.name)}`, count: i.count || i.qty || 1 })).filter((i) => ITEM_BASES[i.baseId]);
      const o = r.output || r.result || r.product;
      const output = typeof o === 'string' ? { baseId: o, count: 1 } : o ? { baseId: o.baseId || o.id || o.item || `x_${slug(o.name)}`, count: o.count || 1 } : null;
      if (inputs.length && output && ITEM_BASES[output.baseId] && ITEM_BASES[output.baseId].stackable && inputs.every((i) => ITEM_BASES[i.baseId].stackable)) {
        RECIPES.push({ id: r.id || `x_r_${RECIPES.length}`, name: r.name || `Compose ${ITEM_BASES[output.baseId].name}`, inputs, output, chance: r.chance || r.successRate || 100, gold: r.gold || r.cost || 0, source: 'swf' });
      }
    }
  }
  return added;
}

// =============================================================================
// ASJ (ARKENVEIL: SIGILS & JOURNEYS) - Quests, Objectives & Village NPC Dialogues.
// Owned by rpg-systems. Pure logic (no DOM / three.js).
// =============================================================================

import { registerItemBase, generateItem } from './inventory.js';

const num = (v, d = 0) => (typeof v === 'number' && isFinite(v) ? v : Number.isFinite(Number(v)) && v !== '' && v != null ? Number(v) : d);
const slug = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

// Register quest drop items in the item database so they can drop and live in bags
function registerQuestItems() {
  const Q = (id, name, icon, desc) => registerItemBase({
    id, name, icon, type: 'quest', subtype: 'quest', rarity: 'rare',
    stackable: true, maxStack: 99, price: 0, reqLevel: 1, questItem: true, noDrop: true, desc,
  });
  Q('quest_slime_gel', 'Luminous Slime Gel', '🟢', 'Glowing core gel from a dungeon slime. Requested by Elder Aldric.');
  Q('quest_goblin_ear', 'Goblin Raider Badge', '🪙', 'Crude iron emblem carried by goblin raiders.');
  Q('quest_cavern_spore', 'Cavern Glow-Spore', '🍄', 'Bioluminescent fungus sought by Alchemist Elara.');
  Q('quest_elemental_core', 'Elemental Core', '🔮', 'Pulsing crystalline core dropped by dungeon golems and mages.');
}
registerQuestItems();

// =============================================================================
// Village Hub NPCs
// =============================================================================
export const NPCS = {
  chief: {
    id: 'chief',
    name: 'Elder Aldric',
    role: 'Village Chief',
    icon: '🧙‍♂️',
    greeting: [
      'Welcome to Oakhaven, traveler. Dark tremors beneath the old ruins have awakened the dungeon monsters.',
      'Speak with our merchants, hone your skills, and descend through the portal when you are ready.',
    ],
    services: [
      { label: 'Rest & Recover (Free)', action: 'heal' },
      { label: 'Quest Log', action: 'quests' },
      { label: 'Dungeon Floors', action: 'map' },
    ],
  },
  blacksmith: {
    id: 'blacksmith',
    name: 'Blacksmith Gorn',
    role: 'Weapons & Armor',
    icon: '⚒️',
    shopId: 'blacksmith',
    greeting: [
      'Need cold steel for the dark below? My forge burns day and night.',
      'Bring me gold or spoils from the dungeon and I will outfit you like a true knight.',
    ],
    services: [
      { label: 'Browse Weapons & Armor', action: 'shop:blacksmith', shopId: 'blacksmith' },
      { label: 'Upgrade & Compose Gear', action: 'compose' },
    ],
  },
  merchant: {
    id: 'merchant',
    name: 'Alchemist Elara',
    role: 'Potions & Scrolls',
    icon: '🧪',
    shopId: 'merchant',
    greeting: [
      'Never step into the dungeon without potions and a Return Scroll!',
      'My elixirs will mend your wounds and keep your spirit flowing.',
    ],
    services: [
      { label: 'Buy Potions & Scrolls', action: 'shop:merchant', shopId: 'merchant' },
    ],
  },
  trainer: {
    id: 'trainer',
    name: 'Battle Master Kael',
    role: 'Skill Master',
    icon: '⚔️',
    greeting: [
      'Strength alone will not save you in the deeper floors. Master both Battle and Passive arts!',
      'Chain your basic strikes into a 3-hit combo and unleash Battle Skills when enemies surround you.',
    ],
    services: [
      { label: 'Open Skill Tree', action: 'skills' },
      { label: 'Reset Attributes & Skills (Free)', action: 'respec' },
    ],
  },
  composer: {
    id: 'composer',
    name: 'Crystal Sage Lyra',
    role: 'Composing Master',
    icon: '🔮',
    shopId: 'composer',
    greeting: [
      'Every crystal holds dormant elemental power. Combine three of a kind to synthesize a higher tier!',
      'You can also socket crystals into your weapons and armor, or strengthen gear with Composing Stones.',
    ],
    services: [
      { label: 'Open Composing Station', action: 'compose' },
      { label: 'Buy Crystals & Stones', action: 'shop:composer', shopId: 'composer' },
    ],
  },
  storage: {
    id: 'storage',
    name: 'Quartermaster Bram',
    role: 'Storage & Supplies',
    icon: '📦',
    greeting: [
      'Running out of room in your pack? Keep your spare gear and rare crystals safe with me.',
    ],
    services: [
      { label: 'Open Inventory & Equipment', action: 'inventory' },
      { label: 'Save Progress', action: 'save' },
    ],
  },
};

const NPC_ALIASES = [
  ['chief', ['chief', 'elder', 'aldric', 'dudas', 'wayne', 'mayor', 'leader', 'guide', 'village', 'npc1', 'npc8']],
  ['blacksmith', ['blacksmith', 'smith', 'gorn', 'fallon', 'gran', 'weapon', 'armor', 'armour', 'forge', 'npc2']],
  ['merchant', ['merchant', 'potion', 'elara', 'joanna', 'alchem', 'item', 'shop', 'trader', 'healer', 'npc3', 'npc6']],
  ['trainer', ['trainer', 'skill', 'kael', 'master', 'combat', 'instructor', 'guard', 'npc5', 'npc7']],
  ['composer', ['composer', 'compos', 'lyra', 'crystal', 'synth', 'gem', 'enchanter']],
  ['storage', ['storage', 'stash', 'bram', 'bank', 'vault', 'quartermaster', 'chest', 'innkeeper', 'npc4']],
];

export function resolveNpcId(npcId) {
  const s = String(npcId || '').toLowerCase();
  if (NPCS[s]) return s;
  for (const [id, keys] of NPC_ALIASES) {
    if (keys.some((k) => s.includes(k))) return id;
  }
  return 'chief';
}

// =============================================================================
// Quest Definitions
// =============================================================================
export const QUEST_DEFS = {
  q_slime_menace: {
    id: 'q_slime_menace',
    name: 'The Slime Menace',
    npcId: 'chief',
    reqLevel: 1,
    prereq: null,
    desc: 'Corrupted slimes have oozed into the upper dungeon entrance on Floor 1. Thin their numbers and bring back samples of their luminous gel.',
    introLines: [
      'Adventurer! Slime creatures are swarming the entrance of Floor 1.',
      'Slay 5 monsters on the first floor and recover 2 Luminous Slime Gels so we can study the corruption.',
    ],
    completeLines: [
      'Splendid work! You handle a blade well. Take these supplies and prepare for the deeper halls.',
    ],
    objectives: [
      { id: 'kill_slimes', type: 'kill', targets: ['slime', 'ooze', 'blob'], floor: 1, matchFloorFallback: true, target: 5, text: 'Slay Dungeon Slimes (Floor 1)' },
      { id: 'collect_gel', type: 'collect', itemId: 'quest_slime_gel', dropChance: 0.75, dropTargets: ['slime', 'any'], target: 2, text: 'Collect Luminous Slime Gel' },
    ],
    rewards: {
      exp: 90,
      gold: 120,
      items: [
        { baseId: 'hp_potion_s', name: 'Small HP Potion', count: 3 },
        { baseId: 'stone_1', name: 'Lesser Composing Stone', count: 1 },
      ],
    },
  },

  q_goblin_raiders: {
    id: 'q_goblin_raiders',
    name: 'Goblin Raiders',
    npcId: 'blacksmith',
    reqLevel: 1,
    prereq: null,
    desc: 'Goblin raiders stole a crate of iron ingots from Blacksmith Gorn. Hunt them down in the upper floors and recover their raider badges.',
    introLines: [
      'Those thieving goblins made off with my best iron! Cut down 8 of those pests and bring me 3 of their badges.',
    ],
    completeLines: [
      'Hah! That taught them a lesson. Here—take this freshly forged blade from my anvil!',
    ],
    objectives: [
      { id: 'kill_goblins', type: 'kill', targets: ['goblin', 'imp', 'raider', 'skeleton'], floor: 1, matchFloorFallback: true, target: 8, text: 'Slay Goblin Raiders' },
      { id: 'collect_badges', type: 'collect', itemId: 'quest_goblin_ear', dropChance: 0.65, dropTargets: ['goblin', 'any'], target: 3, text: 'Collect Goblin Raider Badges' },
    ],
    rewards: {
      exp: 180,
      gold: 200,
      items: [
        { baseId: 'sword_2', name: 'Long Sword', rarity: 'magic', level: 3, count: 1 },
      ],
    },
  },

  q_crystal_study: {
    id: 'q_crystal_study',
    name: 'The Art of Composing',
    npcId: 'composer',
    reqLevel: 2,
    prereq: null,
    desc: 'Crystal Sage Lyra wants you to experience the power of Composing: upgrade a piece of equipment, socket a crystal, or synthesize materials at the Composing Station (key O).',
    introLines: [
      'Have you tried Composing yet? Press [O] or use my station to upgrade your weapon with a Composing Stone or infuse it with an elemental crystal.',
    ],
    completeLines: [
      'You have a natural gift for resonance! Take these crystals to empower your gear further.',
    ],
    objectives: [
      { id: 'do_compose', type: 'compose', target: 1, text: 'Compose or Upgrade an item [O]' },
    ],
    rewards: {
      exp: 150,
      gold: 160,
      items: [
        { baseId: 'crystal_fire_1', name: 'Chipped Fire Crystal', count: 2 },
        { baseId: 'stone_1', name: 'Lesser Composing Stone', count: 2 },
      ],
    },
  },

  q_first_descent: {
    id: 'q_first_descent',
    name: 'Restless Bones',
    npcId: 'chief',
    reqLevel: 2,
    prereq: 'q_slime_menace',
    desc: 'Beneath the slime caves lies Floor 2, where ancient skeletons have risen from their tombs. Descend to Floor 2 and purge the undead.',
    introLines: [
      'The corruption runs deeper than Floor 1. Descend to Floor 2 and put 10 of the restless undead back to rest.',
    ],
    completeLines: [
      'You survived the second floor! Take this armor—you will need sturdier protection ahead.',
    ],
    objectives: [
      { id: 'reach_f2', type: 'floor', floor: 2, target: 1, text: 'Reach Dungeon Floor 2' },
      { id: 'kill_undead', type: 'kill', targets: ['skeleton', 'zombie', 'undead', 'bat', 'spider', 'goblin'], floor: 2, matchFloorFallback: true, target: 10, text: 'Slay Undead & Monsters on Floor 2+' },
    ],
    rewards: {
      exp: 320,
      gold: 280,
      items: [
        { baseId: 'armor_2', name: 'Chain Mail', rarity: 'magic', level: 5, count: 1 },
      ],
    },
  },

  q_alchemist_herbs: {
    id: 'q_alchemist_herbs',
    name: 'Spores of the Cavern',
    npcId: 'merchant',
    reqLevel: 3,
    prereq: null,
    desc: 'Alchemist Elara needs Cavern Glow-Spores found on monsters in the damp dungeon depths to brew stronger healing potions.',
    introLines: [
      'My stock of healing herbs is running low. Could you gather 4 Cavern Glow-Spores from creatures in the dungeon?',
    ],
    completeLines: [
      'These spores are perfect! Here is a batch of freshly brewed potions for your belt.',
    ],
    objectives: [
      { id: 'collect_spores', type: 'collect', itemId: 'quest_cavern_spore', dropChance: 0.65, dropTargets: ['any'], target: 4, text: 'Collect Cavern Glow-Spores' },
    ],
    rewards: {
      exp: 350,
      gold: 300,
      items: [
        { baseId: 'hp_potion_m', name: 'HP Potion', count: 4 },
        { baseId: 'mp_potion_m', name: 'SP Potion', count: 3 },
      ],
    },
  },

  q_trial_of_steel: {
    id: 'q_trial_of_steel',
    name: 'Trial of Steel',
    npcId: 'trainer',
    reqLevel: 4,
    prereq: null,
    desc: 'Battle Master Kael challenges you to prove your mastery by slaying dangerous foes and conquering Floor 3 of the dungeon.',
    introLines: [
      'A true warrior seeks out the strongest foes. Slay 12 dungeon monsters and reach Floor 3 to prove your mettle!',
    ],
    completeLines: [
      'Impressive form! Wield this rare steel weapon with pride.',
    ],
    objectives: [
      { id: 'reach_f3', type: 'floor', floor: 3, target: 1, text: 'Reach Dungeon Floor 3' },
      { id: 'kill_foes', type: 'kill', targets: ['any'], target: 12, text: 'Slay 12 Dungeon Monsters' },
    ],
    rewards: {
      exp: 520,
      gold: 450,
      items: [
        { baseId: 'sword_3', name: 'Broad Sword', rarity: 'rare', level: 8, count: 1 },
        { baseId: 'stone_2', name: 'Composing Stone', count: 1 },
      ],
    },
  },

  q_crypt_warden: {
    id: 'q_crypt_warden',
    name: 'Warden of the Depths',
    npcId: 'chief',
    reqLevel: 5,
    prereq: 'q_first_descent',
    desc: 'A powerful Boss guards the deeper dungeon. Defeat a Dungeon Boss to break the seal on the lower floors.',
    introLines: [
      'Our scouts report a monstrous Boss commanding the creatures below. Defeat the Boss and return to Oakhaven victorious!',
    ],
    completeLines: [
      'The ground itself feels calmer! You have done Oakhaven a great service, hero.',
    ],
    objectives: [
      { id: 'kill_boss', type: 'boss', targets: ['boss'], target: 1, text: 'Defeat a Dungeon Boss' },
    ],
    rewards: {
      exp: 850,
      gold: 750,
      items: [
        { baseId: 'shield_3', name: 'Kite Shield', rarity: 'rare', level: 10, count: 1 },
        { baseId: 'lucky_charm', name: 'Lucky Charm', count: 1 },
      ],
    },
  },

  q_orc_warband: {
    id: 'q_orc_warband',
    name: 'Crush the Warband',
    npcId: 'blacksmith',
    reqLevel: 7,
    prereq: 'q_goblin_raiders',
    desc: 'Fierce Orc Warriors and dark Mages have fortified the mid-level dungeon floors. Push into Floor 4 and break their ranks.',
    introLines: [
      'Orc warbands are marching through Floor 4! Smash 15 of their warriors and warlocks before they reach the surface.',
    ],
    completeLines: [
      'Not even an orc warlord can stand against you! Take this heavy plate armor.',
    ],
    objectives: [
      { id: 'reach_f4', type: 'floor', floor: 4, target: 1, text: 'Reach Dungeon Floor 4' },
      { id: 'kill_orcs', type: 'kill', targets: ['orc', 'mage', 'golem', 'warrior', 'skeleton'], floor: 3, matchFloorFallback: true, target: 15, text: 'Slay Orcs, Mages & Deep Foes' },
    ],
    rewards: {
      exp: 1200,
      gold: 1000,
      items: [
        { baseId: 'armor_4', name: 'Plate Armor', rarity: 'rare', level: 14, count: 1 },
        { baseId: 'stone_2', name: 'Composing Stone', count: 2 },
      ],
    },
  },

  q_elemental_cores: {
    id: 'q_elemental_cores',
    name: 'Elemental Convergence',
    npcId: 'composer',
    reqLevel: 9,
    prereq: 'q_crystal_study',
    desc: 'Crystal Sage Lyra seeks 4 Elemental Cores from the arcane golems and mages in the deeper dungeon to stabilize the village ward.',
    introLines: [
      'The elemental leylines beneath Floor 4 and Floor 5 are surging. Recover 4 Elemental Cores from the creatures below!',
    ],
    completeLines: [
      'With these cores I have synthesized a pure Prism Crystal for you. Socket it wisely!',
    ],
    objectives: [
      { id: 'collect_cores', type: 'collect', itemId: 'quest_elemental_core', dropChance: 0.6, dropTargets: ['golem', 'mage', 'orc', 'any'], target: 4, text: 'Collect Elemental Cores' },
    ],
    rewards: {
      exp: 1650,
      gold: 1400,
      items: [
        { baseId: 'crystal_prism_3', name: 'Clear Prism Crystal', count: 1 },
        { baseId: 'stone_3', name: 'Greater Composing Stone', count: 1 },
      ],
    },
  },

  q_abyss_overlord: {
    id: 'q_abyss_overlord',
    name: 'Heart of the Abyss',
    npcId: 'chief',
    reqLevel: 11,
    prereq: 'q_crypt_warden',
    desc: 'Descend to the deepest sanctum on Floor 5+, vanquish the Abyssal legions, and slay their Overlord to save Oakhaven once and for all.',
    introLines: [
      'This is the final test, champion. Descend to Floor 5, cut through 20 abyssal monsters, and vanquish the Overlord!',
    ],
    completeLines: [
      'Song and legend will remember your name forever! Accept the legendary Flamebrand, hero of Arkenveil!',
    ],
    objectives: [
      { id: 'reach_f5', type: 'floor', floor: 5, target: 1, text: 'Reach Dungeon Floor 5' },
      { id: 'kill_abyss', type: 'kill', targets: ['any'], target: 20, text: 'Slay 20 Abyssal Monsters' },
      { id: 'kill_abyss_boss', type: 'boss', targets: ['boss'], target: 1, text: 'Defeat the Abyssal Boss' },
    ],
    rewards: {
      exp: 2800,
      gold: 2500,
      items: [
        { baseId: 'sword_5', uniqueId: 'u_flamebrand', name: 'Flamebrand', rarity: 'unique', level: 18, count: 1 },
        { baseId: 'stone_4', name: 'Divine Composing Stone', count: 1 },
      ],
    },
  },
};

export const QUESTS = QUEST_DEFS;

export function registerQuest(def) {
  if (!def || !def.id) return null;
  QUEST_DEFS[def.id] = { ...QUEST_DEFS[def.id], ...def };
  return QUEST_DEFS[def.id];
}

// =============================================================================
// QuestSystem
// =============================================================================
export class QuestSystem {
  constructor(game = null) {
    this.game = game;
    this.states = {};    // questId -> 'active' | 'ready' | 'completed'
    this.progress = {};  // questId -> { [objId]: number }
    // Auto-accept the starter quest so new players immediately have an objective
    this.accept('q_slime_menace', { silent: true });
  }

  get quests() { return this.getLogView(); }

  _emit(...a) { if (this.game) this.game.emit(...a); }
  _changed() {
    if (this.game) {
      this.game.emit('quests');
      this.game.emit('change');
    }
  }
  _heroLevel() { return this.game ? this.game.hero.level : 1; }

  /** Compute current state of a quest: 'locked' | 'available' | 'active' | 'ready' | 'completed'. */
  getState(id) {
    const def = QUEST_DEFS[id];
    if (!def) return 'locked';
    const st = this.states[id];
    if (st === 'completed') return 'completed';
    if (st === 'active' || st === 'ready') {
      return this._isObjectivesComplete(def) ? 'ready' : 'active';
    }
    if ((def.reqLevel || 1) > this._heroLevel()) return 'locked';
    if (def.prereq && this.states[def.prereq] !== 'completed') return 'locked';
    return 'available';
  }

  _getObjCurrent(def, obj) {
    const p = (this.progress[def.id] && this.progress[def.id][obj.id]) || 0;
    if (obj.type === 'collect' && obj.itemId && this.game && this.game.inventory) {
      return Math.max(p, Math.min(obj.target || 1, this.game.inventory.countItem(obj.itemId)));
    }
    if (obj.type === 'floor' && this.game && this.game.progress) {
      const reached = (this.game.progress.maxFloor || 0) >= (obj.floor || 1) ? 1 : 0;
      return Math.max(p, reached);
    }
    return Math.min(obj.target || 1, p);
  }

  _isObjectivesComplete(def) {
    return (def.objectives || []).every((o) => this._getObjCurrent(def, o) >= (o.target || 1));
  }

  _syncReadyState(def) {
    if (!def) return;
    const st = this.states[def.id];
    if (st !== 'active' && st !== 'ready') return;
    const nowReady = this._isObjectivesComplete(def);
    const next = nowReady ? 'ready' : 'active';
    if (st !== next) {
      this.states[def.id] = next;
      if (next === 'ready') {
        this._emit('quest:ready', def.id);
        this._emit('toast', `Quest Ready: ${def.name} (Return to ${NPCS[def.npcId]?.name || 'Village'})`, 'quest');
      }
    }
  }

  // ---- Quest Lifecycle -------------------------------------------------------
  accept(id, { silent = false } = {}) {
    const def = QUEST_DEFS[id];
    if (!def) return { ok: false, msg: 'Unknown quest' };
    const st = this.getState(id);
    if (st === 'completed') return { ok: false, msg: 'Quest already completed' };
    if (st === 'active' || st === 'ready') return { ok: true, msg: 'Quest already active' };
    if (st === 'locked' && !silent) return { ok: false, msg: `Requires Hero Lv ${def.reqLevel || 1}` };
    this.states[id] = 'active';
    this.progress[id] = {};
    for (const o of def.objectives || []) this.progress[id][o.id] = 0;
    this._syncReadyState(def);
    if (!silent) {
      this._emit('quest:accepted', id);
      this._emit('toast', `Quest Accepted: ${def.name}`, 'quest');
    }
    this._changed();
    return { ok: true, msg: `Accepted quest: ${def.name}` };
  }
  acceptQuest(id) { return this.accept(id); }

  abandon(id) {
    const def = QUEST_DEFS[id];
    if (!def) return { ok: false, msg: 'Unknown quest' };
    if (this.states[id] !== 'active' && this.states[id] !== 'ready') return { ok: false, msg: 'Quest is not active' };
    delete this.states[id];
    delete this.progress[id];
    this._emit('quest:updated', id);
    this._changed();
    return { ok: true, msg: `Abandoned ${def.name}` };
  }
  abandonQuest(id) { return this.abandon(id); }

  turnIn(id) {
    const def = QUEST_DEFS[id];
    if (!def) return { ok: false, msg: 'Unknown quest' };
    this._syncReadyState(def);
    if (this.getState(id) !== 'ready') return { ok: false, msg: 'Quest objectives not yet complete' };

    const g = this.game;
    const inv = g ? g.inventory : null;
    // Consume any required collect-objective items from the bag
    if (inv) {
      for (const o of def.objectives || []) {
        if (o.type === 'collect' && o.itemId) inv.consume(o.itemId, o.target || 1);
      }
    }

    this.states[id] = 'completed';
    const rw = def.rewards || {};
    if (g && rw.exp) g.addExp(rw.exp);
    if (g && rw.gold) g.addGold(rw.gold);
    const grantedItems = [];
    if (inv && Array.isArray(rw.items)) {
      for (const spec of rw.items) {
        const it = generateItem({
          baseId: spec.baseId || spec.id,
          rarity: spec.rarity,
          level: spec.level || this._heroLevel(),
          uniqueId: spec.uniqueId,
          count: spec.count || 1,
        });
        if (it) {
          inv.addItem(it, { silent: true });
          grantedItems.push(it);
        }
      }
    }
    this._emit('quest:completed', id, rw);
    this._emit('toast', `Quest Completed: ${def.name}! (+${rw.exp || 0} EXP, +${rw.gold || 0} G)`, 'quest');
    this._changed();
    return { ok: true, msg: `Completed ${def.name}!`, rewards: rw, items: grantedItems };
  }
  turnInQuest(id) { return this.turnIn(id); }
  completeQuest(id) { return this.turnIn(id); }

  // ---- Event Hooks -----------------------------------------------------------
  _activeDefs() {
    return Object.values(QUEST_DEFS).filter((d) => this.states[d.id] === 'active' || this.states[d.id] === 'ready');
  }

  _matchesMonster(monster, targets, objFloor, matchFloorFallback) {
    if (!targets || !targets.length || targets.includes('any')) return true;
    const hay = `${monster.type || ''} ${monster.id || ''} ${monster.name || ''} ${monster.family || ''} ${monster.kind || ''}`.toLowerCase();
    if (targets.some((t) => hay.includes(String(t).toLowerCase()))) return true;
    if (matchFloorFallback && objFloor && (monster.floor || (this.game && this.game.progress.currentFloor) || 1) >= objFloor) return true;
    return false;
  }

  /** Roll quest-specific item drops when a monster dies. */
  rollQuestDrops(monster = {}) {
    const drops = [];
    for (const def of this._activeDefs()) {
      for (const o of def.objectives || []) {
        if (o.type !== 'collect' || !o.itemId) continue;
        if (this._getObjCurrent(def, o) >= (o.target || 1)) continue;
        if (!this._matchesMonster(monster, o.dropTargets || ['any'], o.floor, true)) continue;
        const chance = num(o.dropChance, 0.65) * (monster.isBoss ? 2 : monster.isElite ? 1.4 : 1);
        if (Math.random() <= chance) {
          const it = generateItem({ baseId: o.itemId, count: 1 });
          if (it) drops.push(it);
        }
      }
    }
    return drops;
  }

  /** Notify that a monster was killed. Accepts `(monsterObj)` or `(monsterId, floor)`. */
  onKill(monsterOrId = {}, floor = null) {
    const monster = typeof monsterOrId === 'string'
      ? { type: monsterOrId, id: monsterOrId, name: monsterOrId, floor: floor ?? (this.game?.progress?.currentFloor || 1), isBoss: /boss|lord|warden|overlord/i.test(monsterOrId) }
      : { ...monsterOrId, floor: monsterOrId.floor ?? floor ?? (this.game?.progress?.currentFloor || 1) };
    let updated = false;
    for (const def of this._activeDefs()) {
      const prog = (this.progress[def.id] ||= {});
      for (const o of def.objectives || []) {
        const cur = this._getObjCurrent(def, o);
        if (cur >= (o.target || 1)) continue;
        if (o.type === 'kill' && this._matchesMonster(monster, o.targets, o.floor, o.matchFloorFallback)) {
          prog[o.id] = Math.min(o.target || 1, (prog[o.id] || 0) + 1);
          updated = true;
        } else if (o.type === 'boss' && (monster.isBoss || /boss|overlord|warden|king|dragon/i.test(`${monster.type || ''} ${monster.name || ''}`))) {
          prog[o.id] = Math.min(o.target || 1, (prog[o.id] || 0) + 1);
          updated = true;
        } else if (o.type === 'collect' && o.itemId) {
          // Also advance collect progress directly on matching kills in case ground loot isn't picked up
          const dropChance = num(o.dropChance, 0.65);
          if (this._matchesMonster(monster, o.dropTargets || ['any'], o.floor, true) && Math.random() <= dropChance) {
            prog[o.id] = Math.min(o.target || 1, (prog[o.id] || 0) + 1);
            updated = true;
          }
        }
      }
      this._syncReadyState(def);
    }
    if (updated) {
      this._emit('quest:updated');
      this._changed();
    }
  }
  onMonsterKilled(monsterOrId, floor) { this.onKill(monsterOrId, floor); }

  onCollect(itemId, count = 1) {
    let updated = false;
    for (const def of this._activeDefs()) {
      const prog = (this.progress[def.id] ||= {});
      for (const o of def.objectives || []) {
        if (o.type === 'collect' && o.itemId === itemId) {
          prog[o.id] = Math.min(o.target || 1, Math.max(prog[o.id] || 0, this._getObjCurrent(def, o)));
          updated = true;
        }
      }
      this._syncReadyState(def);
    }
    if (updated) {
      this._emit('quest:updated');
      this._changed();
    }
  }
  onItemCollected(itemId, count) { this.onCollect(itemId, count); }

  onReachFloor(floor) {
    floor = num(floor, 0);
    let updated = false;
    for (const def of this._activeDefs()) {
      const prog = (this.progress[def.id] ||= {});
      for (const o of def.objectives || []) {
        if (o.type === 'floor' && floor >= (o.floor || 1)) {
          prog[o.id] = o.target || 1;
          updated = true;
        }
      }
      this._syncReadyState(def);
    }
    if (updated) {
      this._emit('quest:updated');
      this._changed();
    }
  }

  onFloorCleared(floor) {
    this.onReachFloor(floor);
    let updated = false;
    for (const def of this._activeDefs()) {
      const prog = (this.progress[def.id] ||= {});
      for (const o of def.objectives || []) {
        if ((o.type === 'clear_floor' || o.type === 'floor') && floor >= (o.floor || 1)) {
          prog[o.id] = o.target || 1;
          updated = true;
        }
      }
      this._syncReadyState(def);
    }
    if (updated) {
      this._emit('quest:updated');
      this._changed();
    }
  }

  onCompose() {
    let updated = false;
    for (const def of this._activeDefs()) {
      const prog = (this.progress[def.id] ||= {});
      for (const o of def.objectives || []) {
        if (o.type === 'compose') {
          prog[o.id] = Math.min(o.target || 1, (prog[o.id] || 0) + 1);
          updated = true;
        }
      }
      this._syncReadyState(def);
    }
    if (updated) {
      this._emit('quest:updated');
      this._changed();
    }
  }

  onLevel() { this._changed(); }
  onTalk(npcId) { void npcId; }

  // ---- Views & NPC Dialogue --------------------------------------------------
  getQuestView(id) {
    const def = QUEST_DEFS[id];
    if (!def) return null;
    const state = this.getState(id);
    const npc = NPCS[def.npcId] || NPCS.chief;
    return {
      id: def.id,
      name: def.name,
      desc: def.desc,
      npcId: def.npcId,
      npcName: npc.name,
      reqLevel: def.reqLevel || 1,
      state,
      objectives: (def.objectives || []).map((o) => {
        const current = state === 'completed' ? (o.target || 1) : this._getObjCurrent(def, o);
        const target = o.target || 1;
        return { id: o.id, type: o.type, text: o.text, current, target, done: current >= target };
      }),
      rewards: {
        exp: def.rewards?.exp || 0,
        gold: def.rewards?.gold || 0,
        items: (def.rewards?.items || []).map((i) => ({ ...i, id: i.baseId || i.id, name: i.name || i.baseId })),
      },
    };
  }

  getLogView() {
    const out = { available: [], active: [], ready: [], completed: [] };
    for (const id of Object.keys(QUEST_DEFS)) {
      const v = this.getQuestView(id);
      if (v && out[v.state]) out[v.state].push(v);
    }
    return out;
  }

  getActive() {
    const log = this.getLogView();
    return [...log.ready, ...log.active];
  }
  getActiveQuests() { return this.getActive(); }

  getNpcQuests(npcId) {
    const id = resolveNpcId(npcId);
    const log = this.getLogView();
    return {
      ready: log.ready.filter((q) => q.npcId === id),
      available: log.available.filter((q) => q.npcId === id),
      active: log.active.filter((q) => q.npcId === id),
    };
  }

  /** Overhead quest marker for 3D NPCs: '?' (turn-in), '!' (available), or null. */
  getNpcMarker(npcId) {
    const q = this.getNpcQuests(npcId);
    if (q.ready.length > 0) return '?';
    if (q.available.length > 0) return '!';
    return null;
  }

  /** Build interactive dialogue payload for `menus.openDialogue(npcId)`. */
  getNpcDialogue(npcId) {
    const id = resolveNpcId(npcId);
    const npc = NPCS[id] || NPCS.chief;
    const nq = this.getNpcQuests(id);
    const options = [];

    for (const q of nq.ready) {
      options.push({ label: `★ Complete Quest: ${q.name}`, action: `turnin:${q.id}`, id: `turnin:${q.id}` });
    }
    for (const q of nq.available) {
      options.push({ label: `! Quest: ${q.name}`, action: `quest_intro:${q.id}`, id: `quest_intro:${q.id}` });
    }
    for (const s of npc.services || []) {
      options.push({ ...s });
    }
    options.push({ label: 'Leave', action: 'close' });

    const lines = npc.greeting.slice();
    if (nq.ready.length > 0) {
      lines.unshift(`Ah, you have returned! Have you completed "${nq.ready[0].name}"?`);
    } else if (nq.available.length > 0) {
      lines.push(`I have a task for you: "${nq.available[0].name}".`);
    }

    return {
      npcId: id,
      name: `${npc.name} (${npc.role})`,
      role: npc.role,
      icon: npc.icon,
      lines,
      options,
    };
  }

  getQuestDialogue(questId) {
    const def = QUEST_DEFS[questId];
    if (!def) return null;
    const npc = NPCS[def.npcId] || NPCS.chief;
    return {
      npcId: def.npcId,
      name: npc.name,
      icon: npc.icon,
      lines: def.introLines || [def.desc],
      options: [
        { label: `Accept "${def.name}"`, action: `accept:${def.id}` },
        { label: 'Back', action: 'back' },
      ],
    };
  }

  /** Handle custom dialogue actions (`accept:<id>`, `turnin:<id>`, `quest_intro:<id>`, `heal`, `respec`, `save`). */
  handleDialogueAction(action, npcId = 'chief') {
    const act = String(action || '');
    if (act === 'back') return this.getNpcDialogue(npcId);
    if (act.startsWith('quest_intro:')) {
      const qId = act.split(':')[1];
      return this.getQuestDialogue(qId) || { ok: false, msg: 'Quest not found' };
    }
    if (act.startsWith('accept:')) {
      const qId = act.split(':')[1];
      return this.accept(qId);
    }
    if (act.startsWith('turnin:')) {
      const qId = act.split(':')[1];
      const def = QUEST_DEFS[qId];
      const r = this.turnIn(qId);
      if (r.ok && def && def.completeLines) {
        const npc = NPCS[def.npcId] || NPCS.chief;
        return {
          ok: true,
          msg: r.msg,
          name: npc.name,
          icon: npc.icon,
          lines: def.completeLines,
          options: [{ label: 'Continue', action: 'back' }, { label: 'Leave', action: 'close' }],
        };
      }
      return r;
    }
    if (/^heal|rest/i.test(act) && this.game) {
      this.game.fullRestore();
      this.game.cleanseDebuffs();
      return { ok: true, msg: 'HP, SP, and Stamina fully restored!' };
    }
    if (/^respec|reset/i.test(act) && this.game) {
      this.game.resetAttributes();
      if (this.game.skills) this.game.skills.resetAll();
      return { ok: true, msg: 'All Attribute Points and Skill Points have been refunded!' };
    }
    if (/^save/i.test(act) && this.game) {
      return this.game.save(0);
    }
    return { ok: true };
  }

  // ---- Save / Load -----------------------------------------------------------
  toJSON() {
    return {
      states: { ...this.states },
      progress: JSON.parse(JSON.stringify(this.progress)),
    };
  }

  fromJSON(d = {}) {
    this.states = { ...(d.states || {}) };
    this.progress = d.progress ? JSON.parse(JSON.stringify(d.progress)) : {};
    for (const id of Object.keys(this.states)) {
      if (QUEST_DEFS[id]) this._syncReadyState(QUEST_DEFS[id]);
    }
  }
}

export const Quests = QuestSystem;
export const createQuestSystem = (game) => new QuestSystem(game);

// =============================================================================
// Extracted SWF data merge
// =============================================================================
export function applyQuestData(data) {
  if (!data || typeof data !== 'object') return 0;
  const list = Array.isArray(data.quests)
    ? data.quests
    : data.quests && typeof data.quests === 'object' && Array.isArray(data.quests.list)
      ? data.quests.list
      : [];
  let count = 0;
  for (const q of list) {
    if (!q || typeof q !== 'object' || !q.name) continue;
    const id = q.id && QUEST_DEFS[q.id] ? q.id : Object.keys(QUEST_DEFS).find((k) => slug(QUEST_DEFS[k].name) === slug(q.name));
    if (id && QUEST_DEFS[id]) {
      if (q.desc || q.description) QUEST_DEFS[id].desc = String(q.desc || q.description);
      count++;
    }
  }
  return count;
}

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
  Q('quest_cavern_spore', 'Cavern Glow-Spore', '🍄', 'Bioluminescent fungus sought by Apothecary Elara.');
  Q('quest_elemental_core', 'Elemental Core', '🔮', 'Pulsing crystalline core dropped by dungeon golems and mages.');
  Q('quest_tomb_essence', 'Tombstone Essence', '🪦', 'Dark ectoplasmic residue from ancient Sunken Sovereign tomb guardians.');
  Q('quest_astral_dust', 'Astral Dust', '✨', 'Shimmering celestial powder gathered from deep dungeon archers.');
  Q('quest_emperor_tablet', 'Sunken Sovereign Tablet', '📜', 'Ancient inscribed stone fragment detailing the Sunken Sovereign’s forbidden rites.');
}
registerQuestItems();

// =============================================================================
// Village Hub NPCs
// =============================================================================
export const NPCS = {
  chief: {
    id: 'chief',
    name: 'Elder Aldric',
    role: 'Governor of Oakhaven',
    icon: '🧙‍♂️',
    greeting: [
      'Welcome to Oakhaven, traveler. As the seals of the Sunken Sovereign Vaults weaken, the beasts beyond our walls have grown ever more ferocious.',
      'Hone your strength in the Oakhaven outskirts until you reach Level 10, gear up with our merchants, and purge every dungeon floor down to the last foe.',
    ],
    services: [
      { label: '🏛 Town Blessings & Shrine (Gold)', action: 'open_menu:townhall:blessings' },
      { label: '⚔ Guild Mastery Training (Gold)', action: 'open_menu:townhall:training' },
      { label: 'Rest & Recover (Free)', action: 'heal' },
      { label: 'Quest Log & Story Quests', action: 'quests' },
      { label: 'Dungeon Floors & Progress', action: 'map' },
    ],
  },
  blacksmith: {
    id: 'blacksmith',
    name: 'Blacksmith Gorn',
    role: 'Master Weaponsmith & Armorer',
    icon: '⚒️',
    shopId: 'blacksmith',
    greeting: [
      'The finest steel in all of Arkenveil is tempered right here. Even with raider ambushes delaying our supply wagons, my anvil never grows cold.',
      'Bring me your dungeon spoils to open sockets, reforge enchantments, or temper your weapons and armor.',
    ],
    services: [
      { label: '⚔️ Browse Weapons, Shields & Armor', action: 'shop:blacksmith', shopId: 'blacksmith' },
      { label: '🔨 Masterwork Forge: Sockets & Reforge (Gold)', action: 'open_menu:townhall:forge' },
      { label: '🔥 Alchemy & Gear Upgrade Station [O]', action: 'compose' },
    ],
  },
  merchant: {
    id: 'merchant',
    name: 'Apothecary Elara',
    role: 'Potions, Tonics & Scrolls',
    icon: '🧪',
    shopId: 'merchant',
    greeting: [
      'Brook Wraiths along the Lotus Canal have made gathering medicinal herbs perilous, yet my potions remain fresh and potent.',
      'Never step beyond the outer gates without stocking up on HP/SP Potions, Antidotes, and Return Scrolls!',
    ],
    services: [
      { label: '🧪 Buy Potions, Buffs & Return Scrolls', action: 'shop:merchant', shopId: 'merchant' },
      { label: '💎 Relic Emporium (Mystery Coffers & Magic Stones)', action: 'shop:curio', shopId: 'curio' },
      { label: '🌿 Rest & Cleanse Debuffs (Free)', action: 'heal' },
    ],
  },
  trainer: {
    id: 'trainer',
    name: 'Grandmaster Kael',
    role: 'Blade & Shield / Bloodaxe / Arcane Instructor',
    icon: '⚔️',
    greeting: [
      'Brute strength alone will not carry you past the Frostfang Empress or Warchief Drakmor. Weave your active and passive skills with true mastery.',
      'Even the beasts prowling the Oakhaven plains strike with primal ferocity—time your combos and shield blocks carefully.',
    ],
    services: [
      { label: '⚔ Guild Mastery Training (Permanent Stats)', action: 'open_menu:townhall:training' },
      { label: '📜 Open Skill Tree [K]', action: 'skills' },
      { label: '🔄 Reset Attributes & Skills (Free)', action: 'respec' },
    ],
  },
  composer: {
    id: 'composer',
    name: 'Crystal Sage Lyra',
    role: 'Arcane Enchanter & Alchemist',
    icon: '🔮',
    shopId: 'composer',
    greeting: [
      'The secret of ancient stones and Luck Powders lies in arcane resonance. With Tempering Elixirs, you can empower your gear all the way to +10.',
      'Fuse Magic Stones into your equipment to permanently imbue STR, INT, Max HP, and Astral Protection.',
    ],
    services: [
      { label: '✨ Open Alchemy & Magic Stone Station [O]', action: 'compose' },
      { label: '⚗️ Buy Elixirs, Luck Powders & Talismans', action: 'shop:composer', shopId: 'composer' },
      { label: '💎 Relic Emporium (Magic Stones & Coffers)', action: 'shop:curio', shopId: 'curio' },
    ],
  },
  storage: {
    id: 'storage',
    name: 'Quartermaster Bram',
    role: 'General Shared Vault',
    icon: '🏦',
    greeting: [
      'Every merchant caravan in Oakhaven entrusts its valuables to my care. This General Storage Vault is shared across all your characters!',
      'Deposit your gold, rare Sealed relics, and alchemy elixirs here with complete peace of mind.',
    ],
    services: [
      { label: '🏦 Open General Shared Storage Vault (Items & Gold)', action: 'open_menu:storage' },
      { label: '🎒 Expand Bag & Storage Capacity (Gold)', action: 'open_menu:townhall:expand' },
      { label: '🎒 Open Inventory & Equipment [B]', action: 'inventory' },
      { label: '💾 Save Progress', action: 'save' },
    ],
  },
  pet_merchant: {
    id: 'pet_merchant',
    name: 'Beast Tamer Zara',
    role: 'Grab & Combat Companions',
    icon: '🐾',
    greeting: [
      'Hunting the wilds of Arkenveil alone is exhausting! A faithful Grab Pet will gather dropped gold and loot for you in an instant.',
      'As your companion levels up beside you, it grants bonus Critical Rate, Attack Power, and Magic Find.',
    ],
    services: [
      { label: '🐾 Open Companion Market & Stable [P]', action: 'open_menu:petshop' },
      { label: '🎒 Manage Owned Companions', action: 'open_menu:pets' },
    ],
  },
  accessory_trader: {
    id: 'accessory_trader',
    name: 'Orin',
    role: 'Rings, Necklaces & Arkenveil Relics',
    icon: '💍',
    shopId: 'accessory_trader',
    greeting: [
      'My stall carries the rarest enchanted rings, talismanic necklaces, and sealed coffers brought from every corner of Arkenveil.',
      'Blackblade Raiders along the eastern road plundered my supply wagon—teach them a lesson, and my finest jewels will be yours.',
    ],
    services: [
      { label: '💍 Browse Jewelry, Coffers & EXP Scrolls', action: 'shop:accessory_trader', shopId: 'accessory_trader' },
      { label: '💎 Relic Emporium (Mystery Coffers & Magic Stones)', action: 'shop:curio', shopId: 'curio' },
      { label: 'Quest Log', action: 'quests' },
    ],
  },
  hunter_master: {
    id: 'hunter_master',
    name: 'Garrik',
    role: 'Oakhaven Hunter Guild & Bounties',
    icon: '🏹',
    shopId: 'hunter_master',
    greeting: [
      'The Oakhaven Hunter Guild keeps the balance beyond our walls. From the Sporeling Gremlins of the southern meadows to the Frostfang Tigers of the northern ridge, every hunt earns a bounty.',
      'Once you reach Level 10, our guild armory will outfit you for the Whispering Stone Caverns and the abyss beyond.',
    ],
    services: [
      { label: '🛡️ Browse Hunter Guild Armory & Supplies', action: 'shop:hunter_master', shopId: 'hunter_master' },
      { label: '⚔ Guild Mastery Training (Permanent Stats)', action: 'open_menu:townhall:training' },
      { label: 'Rest & Recover (Free)', action: 'heal' },
    ],
  },
};

const NPC_ALIASES = [
  ['chief', ['chief', 'elder', 'aldric', 'dudas', 'wayne', 'mayor', 'leader', 'guide', 'village', 'hwangno', 'npc1', 'npc8']],
  ['blacksmith', ['blacksmith', 'smith', 'gorn', 'chulsan', 'fallon', 'gran', 'weapon', 'armor', 'armour', 'forge', 'npc2']],
  ['merchant', ['merchant', 'potion', 'elara', 'joanna', 'alchem', 'apothecary', 'store', 'healer', 'npc3', 'npc6']],
  ['trainer', ['trainer', 'skill', 'kael', 'master', 'combat', 'instructor', 'guard', 'npc5', 'npc7']],
  ['composer', ['composer', 'compos', 'lyra', 'crystal', 'synth', 'gem', 'enchanter']],
  ['storage', ['storage', 'stash', 'bram', 'wangu', 'bank', 'vault', 'quartermaster', 'warehouse', 'chest', 'innkeeper', 'npc4']],
  ['pet_merchant', ['pet_merchant', 'pet_shop', 'pet', 'zara', 'tamer', 'companion', 'stable']],
  ['accessory_trader', ['accessory_trader', 'accessory', 'orin', 'jodaesan', 'jewel', 'ring', 'necklace', 'specialty']],
  ['hunter_master', ['hunter_master', 'hunter', 'garrik', 'gwakwi', 'bounty', 'guild_officer']],
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
      { id: 'kill_slimes', type: 'kill', targets: ['slime', 'ooze', 'blob', 'mangyang'], floor: 1, matchFloorFallback: true, target: 5, text: 'Slay Dungeon Slimes (Floor 1)' },
      { id: 'collect_gel', type: 'collect', itemId: 'quest_slime_gel', dropChance: 0.85, dropTargets: ['slime', 'mangyang', 'any'], target: 2, text: 'Collect Luminous Slime Gel' },
    ],
    rewards: {
      exp: 450,
      gold: 500,
      ap: 1,
      items: [
        { baseId: 'hp_potion_s', name: 'Small HP Potion', count: 5 },
        { baseId: 'elixir_weapon', name: 'Elixir of Tempering (Weapon)', count: 1 },
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
      { id: 'kill_goblins', type: 'kill', targets: ['goblin', 'imp', 'raider', 'gyo_weasel', 'skeleton'], floor: 1, matchFloorFallback: true, target: 8, text: 'Slay Goblin Raiders' },
      { id: 'collect_badges', type: 'collect', itemId: 'quest_goblin_ear', dropChance: 0.75, dropTargets: ['goblin', 'gyo_weasel', 'any'], target: 3, text: 'Collect Goblin Raider Badges' },
    ],
    rewards: {
      exp: 750,
      gold: 850,
      ap: 1,
      items: [
        { baseId: 'sword_2', name: 'Long Sword', rarity: 'rare', level: 3, count: 1 },
        { baseId: 'elixir_armor', name: 'Elixir of Tempering (Armor)', count: 1 },
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
      exp: 650,
      gold: 700,
      sp: 1,
      items: [
        { baseId: 'crystal_fire_1', name: 'Chipped Fire Crystal', count: 3 },
        { baseId: 'elixir_shield', name: 'Elixir of Tempering (Shield)', count: 1 },
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
      { id: 'kill_undead', type: 'kill', targets: ['skeleton', 'zombie', 'undead', 'tiger', 'gyo_weasel'], floor: 2, matchFloorFallback: true, target: 10, text: 'Slay Undead & Monsters on Floor 2+' },
    ],
    rewards: {
      exp: 1200,
      gold: 1100,
      ap: 1,
      sp: 1,
      items: [
        { baseId: 'armor_2', name: 'Chain Mail', rarity: 'rare', level: 5, count: 1 },
        { baseId: 'elixir_armor', name: 'Elixir of Tempering (Armor)', count: 1 },
      ],
    },
  },

  q_village_council: {
    id: 'q_village_council',
    name: 'Council of Oakhaven',
    npcId: 'chief',
    reqLevel: 3,
    prereq: 'q_first_descent',
    desc: 'Elder Aldric asks you to coordinate defense efforts across Oakhaven: deliver battle scouting to Blacksmith Gorn, consult Alchemist Elara for siege tinctures, and return to the Chief.',
    introLines: [
      'Dark tremors shake the bedrock. I need you to coordinate with our town masters. Speak with Blacksmith Gorn and Alchemist Elara, then report back!',
    ],
    completeLines: [
      'Excellent leadership! With the forge and brewery synchronized, our defenses stand impenetrable.',
    ],
    objectives: [
      { id: 'talk_gorn', type: 'talk_npc', npcId: 'blacksmith', target: 1, text: 'Deliver Scout Report to Blacksmith Gorn', dialogue: 'The monsters are mobilizing in mass? Good to know. Tell the Chief my forge will produce reinforced steel day and night.' },
      { id: 'talk_elara', type: 'talk_npc', npcId: 'merchant', target: 1, text: 'Request Siege Medicine from Alchemist Elara', dialogue: 'I have already prepared batches of concentrated healing salves. Take this report back to Elder Aldric at once.' },
      { id: 'talk_aldric', type: 'talk_npc', npcId: 'chief', target: 1, text: 'Conclude Briefing with Elder Aldric', dialogue: 'Our town stands ready. Your courier service has bound Oakhaven together in unity!' },
    ],
    rewards: {
      exp: 1800,
      gold: 1500,
      ap: 2,
      sp: 1,
      items: [
        { baseId: 'elixir_weapon', name: 'Elixir of Tempering (Weapon)', count: 2 },
        { baseId: 'elixir_armor', name: 'Elixir of Tempering (Armor)', count: 2 },
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
      { id: 'collect_spores', type: 'collect', itemId: 'quest_cavern_spore', dropChance: 0.75, dropTargets: ['any'], target: 4, text: 'Collect Cavern Glow-Spores' },
    ],
    rewards: {
      exp: 1400,
      gold: 1200,
      sp: 1,
      items: [
        { baseId: 'hp_potion_m', name: 'HP Potion', count: 6 },
        { baseId: 'mp_potion_m', name: 'SP Potion', count: 6 },
        { baseId: 'elixir', name: 'Elixir of Life', count: 2 },
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
      exp: 2200,
      gold: 1800,
      ap: 2,
      sp: 1,
      items: [
        { baseId: 'sword_3', name: 'Broad Sword', rarity: 'rare', level: 8, count: 1 },
        { baseId: 'elixir_weapon', name: 'Elixir of Tempering (Weapon)', count: 2 },
      ],
    },
  },

  q_crypt_warden: {
    id: 'q_crypt_warden',
    name: 'Frostfang Empress, Ruler of the Wilds',
    npcId: 'chief',
    reqLevel: 5,
    prereq: 'q_trial_of_steel',
    desc: 'The ferocious Frostfang Empress commands the savage pack from the depths of Floor 3. Defeat her to shatter the ancient cavern seal and claim glory!',
    introLines: [
      'The Frostfang Empress commands the wild Frostfang Tigers from the summit of B3F. Vanquish her and restore peace to the outer wilds!',
    ],
    completeLines: [
      'The Frostfang Empress has fallen! Songs of your bravery ring out across all of Arkenveil!',
    ],
    objectives: [
      { id: 'kill_boss', type: 'boss', targets: ['tiger_girl', 'boss'], target: 1, text: 'Defeat the Frostfang Empress on Floor 3' },
    ],
    rewards: {
      exp: 3800,
      gold: 3200,
      ap: 2,
      sp: 2,
      items: [
        { baseId: 'shield_3', name: 'Kite Shield', rarity: 'epic', seal: 'star', level: 10, count: 1 },
        { baseId: 'elixir_shield', name: 'Elixir of Tempering (Shield)', count: 2 },
      ],
    },
  },

  q_forged_in_starlight: {
    id: 'q_forged_in_starlight',
    name: 'Forged in Starlight',
    npcId: 'blacksmith',
    reqLevel: 6,
    prereq: 'q_crypt_warden',
    desc: 'Blacksmith Gorn and Crystal Sage Lyra partner to forge star-tempered arms. Slay 10 Blackblade Marksmen on Floor 4–5, gather Astral Dust, consult Lyra, and return to Gorn.',
    introLines: [
      'Blackblade marksmen loose enchanted arrows in the catacombs. Slay 10 marksmen, gather their Astral Dust, consult Lyra for purification, and bring the infused dust back to my forge!',
    ],
    completeLines: [
      'Behold! The blade shines with astral radiance! Take this Seal of Star armament!',
    ],
    objectives: [
      { id: 'kill_archers', type: 'kill', targets: ['bandit_archer', 'archer'], floor: 4, matchFloorFallback: true, target: 10, text: 'Slay Blackblade Marksmen (B4F–B5F)' },
      { id: 'collect_astral', type: 'collect', itemId: 'quest_astral_dust', dropChance: 0.8, dropTargets: ['bandit_archer', 'any'], target: 3, text: 'Gather Astral Dust' },
      { id: 'talk_lyra', type: 'talk_npc', npcId: 'composer', target: 1, text: 'Consult Crystal Sage Lyra for Astral Blessing', dialogue: 'The cosmic dust is humming! I have infused it with pure starlight. Hand it to Gorn for smithing.' },
      { id: 'talk_gorn', type: 'talk_npc', npcId: 'blacksmith', target: 1, text: 'Deliver Starlight Dust to Blacksmith Gorn', dialogue: 'Incredible luminescence! Watch as I forge this into a masterwork.' },
    ],
    rewards: {
      exp: 4500,
      gold: 3800,
      ap: 2,
      sp: 2,
      items: [
        { baseId: 'sword_4', name: 'Star-Tempered Longsword', rarity: 'epic', seal: 'star', level: 14, count: 1 },
        { baseId: 'elixir_weapon', name: 'Elixir of Tempering (Weapon)', count: 2 },
      ],
    },
  },

  q_orc_warband: {
    id: 'q_orc_warband',
    name: 'Ironcrest Raider Fortress',
    npcId: 'blacksmith',
    reqLevel: 7,
    prereq: 'q_goblin_raiders',
    desc: 'Blackblade brigands have garrisoned the fortress across Floor 4 and Floor 5. Push deep into Ironcrest Crags and break their frontline ranks.',
    introLines: [
      'Raider warbands are massing on Floor 4 and Floor 5! Break 15 of their warriors and marksmen before they strike our outposts.',
    ],
    completeLines: [
      'Not even the Ironcrest Fortress could withstand your might! Take this heavy plate armor.',
    ],
    objectives: [
      { id: 'reach_f4', type: 'floor', floor: 4, target: 1, text: 'Reach Dungeon Floor 4' },
      { id: 'kill_orcs', type: 'kill', targets: ['bandit', 'bandit_archer', 'water_ghost', 'ghost_bug'], floor: 4, matchFloorFallback: true, target: 15, text: 'Slay Fortress Raiders & Wraiths' },
    ],
    rewards: {
      exp: 4800,
      gold: 4200,
      ap: 2,
      sp: 1,
      items: [
        { baseId: 'armor_4', name: 'Plate Armor', rarity: 'epic', seal: 'star', level: 14, count: 1 },
        { baseId: 'elixir_armor', name: 'Elixir of Tempering (Armor)', count: 2 },
      ],
    },
  },

  q_bandit_stronghold: {
    id: 'q_bandit_stronghold',
    name: 'Warchief Drakmor, Raider Overlord',
    npcId: 'chief',
    reqLevel: 8,
    prereq: 'q_forged_in_starlight',
    desc: 'The infamous raider overlord Warchief Drakmor commands the Frosthollow Citadel on Floor 6. Infiltrate his lair and bring his tyranny to an end!',
    introLines: [
      'Warchief Drakmor has pillaged Oakhaven trade caravans for years from his throne on B6F. End his reign of terror!',
    ],
    completeLines: [
      'Warchief Drakmor is defeated! Supply horns echo in celebration across the realm of Arkenveil!',
    ],
    objectives: [
      { id: 'kill_uruchi', type: 'boss', targets: ['bandit_lord', 'boss'], target: 1, text: 'Defeat Warchief Drakmor, Raider Overlord (Floor 6)' },
    ],
    rewards: {
      exp: 6200,
      gold: 5500,
      ap: 3,
      sp: 2,
      items: [
        { baseId: 'bow_3', name: 'Overlord Composite Bow', rarity: 'epic', seal: 'star', level: 18, count: 1 },
        { baseId: 'elixir_weapon', name: 'Elixir of Tempering (Weapon)', count: 3 },
      ],
    },
  },

  q_elemental_cores: {
    id: 'q_elemental_cores',
    name: 'Elemental Convergence',
    npcId: 'composer',
    reqLevel: 9,
    prereq: 'q_crystal_study',
    desc: 'Crystal Sage Lyra seeks 4 Elemental Cores from Cairn Sentinels and subterranean spellweavers to stabilize the town protection barrier.',
    introLines: [
      'The elemental leylines beneath Floor 6 and Floor 7 are surging. Recover 4 Elemental Cores from the creatures below!',
    ],
    completeLines: [
      'With these cores I have synthesized a pure Prism Crystal for you. Socket it wisely!',
    ],
    objectives: [
      { id: 'collect_cores', type: 'collect', itemId: 'quest_elemental_core', dropChance: 0.7, dropTargets: ['stone_ghost', 'earth_ghost', 'any'], target: 4, text: 'Collect Elemental Cores' },
    ],
    rewards: {
      exp: 5500,
      gold: 5000,
      sp: 2,
      items: [
        { baseId: 'crystal_prism_3', name: 'Clear Prism Crystal', count: 2 },
        { baseId: 'elixir_weapon', name: 'Elixir of Tempering (Weapon)', count: 2 },
        { baseId: 'elixir_shield', name: 'Elixir of Tempering (Shield)', count: 2 },
      ],
    },
  },

  q_alchemists_panacea: {
    id: 'q_alchemists_panacea',
    name: "The Alchemist's Panacea",
    npcId: 'merchant',
    reqLevel: 9,
    prereq: 'q_alchemist_herbs',
    desc: 'Apothecary Elara and Grandmaster Kael collaborate to distill an ultimate panacea against tomb curses. Gather Tombstone Essences, consult Kael, and brew the elixir.',
    introLines: [
      'The cursed air of the Sunken Sovereign Vaults rots the soul. Collect 3 Tombstone Essences on B7F, consult Grandmaster Kael on focus and breath, and return here!',
    ],
    completeLines: [
      'The Panacea is complete! Drink deeply and fear no curse in the deepest crypts.',
    ],
    objectives: [
      { id: 'collect_tomb', type: 'collect', itemId: 'quest_tomb_essence', dropChance: 0.75, dropTargets: ['tombstone_ghost', 'chakji', 'any'], target: 3, text: 'Collect Tombstone Essences (Floor 7+)' },
      { id: 'talk_kael', type: 'talk_npc', npcId: 'trainer', target: 1, text: 'Consult Grandmaster Kael on Focus & Balance', dialogue: 'To channel this panacea, align your breath with your core strikes. Tell Elara the formula is sound.' },
      { id: 'talk_elara', type: 'talk_npc', npcId: 'merchant', target: 1, text: 'Deliver Catalysts to Apothecary Elara', dialogue: 'Perfection! Here is your personal share of the Panacea Elixir.' },
    ],
    rewards: {
      exp: 6500,
      gold: 5800,
      ap: 3,
      sp: 2,
      items: [
        { baseId: 'elixir', name: 'Elixir of Life', count: 4 },
        { baseId: 'elixir_armor', name: 'Elixir of Tempering (Armor)', count: 3 },
      ],
    },
  },

  q_abyss_overlord: {
    id: 'q_abyss_overlord',
    name: 'Lady Glaciera, Sovereign of Frost',
    npcId: 'chief',
    reqLevel: 10,
    prereq: 'q_bandit_stronghold',
    desc: 'Descend into the Sunken Sovereign Vaults on Floor 9 and vanquish Lady Glaciera, the Sovereign of Frost.',
    introLines: [
      'Lady Glaciera commands frozen spirits deep inside B9F. Defeat her and shatter the frost seal!',
    ],
    completeLines: [
      'Lady Glaciera has fallen! Oakhaven celebrates your triumph!',
    ],
    objectives: [
      { id: 'reach_f9', type: 'floor', floor: 9, target: 1, text: 'Reach Dungeon Floor 9' },
      { id: 'kill_general', type: 'boss', targets: ['isyutaru', 'earth_king', 'boss'], target: 1, text: 'Defeat Lady Glaciera (Floor 9)' },
    ],
    rewards: {
      exp: 9500,
      gold: 8500,
      ap: 3,
      sp: 3,
      items: [
        { baseId: 'sword_5', name: 'Earth Monarch Greatsword', rarity: 'epic', seal: 'star', level: 24, count: 1 },
        { baseId: 'elixir_weapon', name: 'Elixir of Tempering (Weapon)', count: 3 },
        { baseId: 'elixir_armor', name: 'Elixir of Tempering (Armor)', count: 3 },
      ],
    },
  },

  q_emperor_conspiracy: {
    id: 'q_emperor_conspiracy',
    name: "Sovereign's Secret Conspiracy",
    npcId: 'chief',
    reqLevel: 12,
    prereq: 'q_abyss_overlord',
    desc: 'Unearth the Sunken Sovereign’s ancient resurrection tablets from Cairn Sentinels, decipher them with Lyra, secure Oakhaven’s vaults with Bram, and brief Elder Aldric.',
    introLines: [
      'Disturbing rumors claim the Sunken Sovereign’s spirit seeks complete resurrection. Gather Sunken Sovereign Tablets from Cairn Sentinels, decipher them with Sage Lyra, coordinate with Quartermaster Bram, and report back!',
    ],
    completeLines: [
      'We now comprehend their dark rituals. Thanks to your tireless investigation, Oakhaven is forewarned and prepared.',
    ],
    objectives: [
      { id: 'collect_tablet', type: 'collect', itemId: 'quest_emperor_tablet', dropChance: 0.8, dropTargets: ['stone_ghost', 'earth_ghost', 'any'], target: 2, text: 'Recover Sunken Sovereign Tablets (Floor 7–9)' },
      { id: 'talk_lyra', type: 'talk_npc', npcId: 'composer', target: 1, text: 'Decipher Tablet with Crystal Sage Lyra', dialogue: 'These glyphs describe forbidden soul-forging rites! Bram must reinforce the village storage wards.' },
      { id: 'talk_bram', type: 'talk_npc', npcId: 'storage', target: 1, text: 'Alert Quartermaster Bram of Intruders', dialogue: 'I will double the vault locks immediately. Go inform Elder Aldric of the threat!' },
      { id: 'talk_aldric', type: 'talk_npc', npcId: 'chief', target: 1, text: 'Brief Elder Aldric on Findings', dialogue: 'Magnificent work. The Council salutes your vigilance!' },
    ],
    rewards: {
      exp: 10500,
      gold: 9500,
      ap: 3,
      sp: 3,
      items: [
        { baseId: 'necklace_3', name: 'Seal of the Moon Amulet', rarity: 'epic', seal: 'moon', level: 28, count: 1 },
        { baseId: 'elixir_weapon', name: 'Elixir of Tempering (Weapon)', count: 4 },
      ],
    },
  },

  q_steppe_legend: {
    id: 'q_steppe_legend',
    name: 'Secret Highland Sanctuary',
    npcId: 'trainer',
    reqLevel: 11,
    prereq: 'q_crypt_warden',
    desc: 'Enter the hidden rift to Secret Floor S1F (Secret Highland Sanctuary) and hunt down the apex Frostfang Tigers roaming the untouched wilds.',
    introLines: [
      'A secret portal rift has appeared leading to the untouched highlands. Slay 12 Frostfang Tigers in the secret zone to prove your supremacy!',
    ],
    completeLines: [
      'You conquered the secret highland wilds! Wear this beastmaster mantle with pride.',
    ],
    objectives: [
      { id: 'kill_white_tigers', type: 'kill', targets: ['white_tiger', 'tiger'], floor: 101, matchFloorFallback: true, target: 12, text: 'Slay Apex Frostfang Tigers in Sanctuary S1F' },
    ],
    rewards: {
      exp: 11500,
      gold: 10000,
      ap: 3,
      sp: 2,
      items: [
        { baseId: 'armor_4', name: 'Beastmaster Tiger Robes', rarity: 'epic', seal: 'moon', level: 25, count: 1 },
        { baseId: 'elixir_armor', name: 'Elixir of Tempering (Armor)', count: 4 },
      ],
    },
  },

  q_taklamakan_storm: {
    id: 'q_taklamakan_storm',
    name: 'Scorched Sunspire Ruins',
    npcId: 'blacksmith',
    reqLevel: 14,
    prereq: 'q_emperor_conspiracy',
    desc: 'The scorching winds of the Scorched Sunspire Ruins on Floor 10–11 harbor monstrous Cinder Scarabs and Sunspire Marauders. Slay 18 desert terrors.',
    introLines: [
      'The Sunspire Wastes are crawling with vicious Cinder Scarabs and Sunspire Marauders. Crush 18 of them on B10F–B11F!',
    ],
    completeLines: [
      'The sands run clear! Accept this volcanic forged armament.',
    ],
    objectives: [
      { id: 'reach_f10', type: 'floor', floor: 10, target: 1, text: 'Reach Scorched Sunspire Ruins (B10F)' },
      { id: 'kill_desert', type: 'kill', targets: ['devil_bug', 'hyungno', 'blue_tiger'], floor: 10, matchFloorFallback: true, target: 18, text: 'Slay Cinder Scarabs & Sunspire Marauders on B10F+' },
    ],
    rewards: {
      exp: 14500,
      gold: 12500,
      ap: 4,
      sp: 3,
      items: [
        { baseId: 'sword_5', name: 'Sunspire Scimitar', rarity: 'epic', seal: 'moon', level: 32, count: 1 },
        { baseId: 'elixir_weapon', name: 'Elixir of Tempering (Weapon)', count: 4 },
      ],
    },
  },

  q_blue_monarch: {
    id: 'q_blue_monarch',
    name: 'Valkor, Bone Sovereign',
    npcId: 'chief',
    reqLevel: 16,
    prereq: 'q_taklamakan_storm',
    desc: 'Valkor, Bone Sovereign rules the Scorched Sunspire Ruins on Floor 12. Vanquish this dreaded tyrant!',
    introLines: [
      'At the Sovereign Bone Spire on B12F, Valkor, Bone Sovereign awaits. End his scorched dominion!',
    ],
    completeLines: [
      'Valkor, Bone Sovereign has been defeated! You are a living legend!',
    ],
    objectives: [
      { id: 'kill_blue_boss', type: 'boss', targets: ['lord_yarkan', 'blue_tiger_boss', 'boss'], target: 1, text: 'Defeat Valkor, Bone Sovereign (Floor 12)' },
    ],
    rewards: {
      exp: 19500,
      gold: 16000,
      ap: 5,
      sp: 4,
      items: [
        { baseId: 'staff_5', name: 'Sunspire Sovereign Staff', rarity: 'epic', seal: 'moon', level: 40, count: 1 },
        { baseId: 'elixir_weapon', name: 'Elixir of Tempering (Weapon)', count: 5 },
        { baseId: 'elixir_shield', name: 'Elixir of Tempering (Shield)', count: 4 },
      ],
    },
  },

  q_secret_vault_heist: {
    id: 'q_secret_vault_heist',
    name: "Raider Monarch's Secret Vault",
    npcId: 'storage',
    reqLevel: 15,
    prereq: 'q_blue_monarch',
    desc: 'Enter Secret Floor S2F through the rift, infiltrate the Raider Monarch’s secret treasury, and plunder their fabled hoards.',
    introLines: [
      'Our spies uncovered a rift leading into the Raider Monarch’s private vault on S2F. Clean out the guardians and recover their hoarded wealth!',
    ],
    completeLines: [
      'What magnificent treasures! Quartermaster Bram safely vaults your plunder!',
    ],
    objectives: [
      { id: 'kill_vault_guards', type: 'kill', targets: ['bandit_archer', 'chakji', 'water_ghost'], floor: 102, matchFloorFallback: true, target: 15, text: 'Slay Vault Wardens in Secret Floor S2F' },
    ],
    rewards: {
      exp: 18000,
      gold: 20000,
      ap: 4,
      sp: 3,
      items: [
        { baseId: 'armor_5', name: 'Vault Monarch Royal Garb', rarity: 'epic', seal: 'moon', level: 35, count: 1 },
        { baseId: 'elixir_armor', name: 'Elixir of Tempering (Armor)', count: 5 },
      ],
    },
  },

  q_hyeongcheon_fall: {
    id: 'q_hyeongcheon_fall',
    name: 'Malakor, Ember Archfiend',
    npcId: 'chief',
    reqLevel: 19,
    prereq: 'q_blue_monarch',
    desc: 'Descend to the deepest abyss on Floor 15 and defeat Malakor, Ember Archfiend to liberate Arkenveil.',
    introLines: [
      'Malakor, the Ember Archfiend, has awakened in the Ashen Abyss on B15F. Slay the dread archfiend and seal the underworld!',
    ],
    completeLines: [
      'MALAKOR, THE EMBER ARCHFIEND HAS FALLEN! Your name echoes forever as the Savior of Arkenveil!',
    ],
    objectives: [
      { id: 'reach_f15', type: 'floor', floor: 15, target: 1, text: 'Reach Floor 15' },
      { id: 'kill_hyeongcheon', type: 'boss', targets: ['demon_shaitan', 'hyeongcheon', 'boss'], target: 1, text: 'Defeat Malakor, Ember Archfiend (Floor 15)' },
    ],
    rewards: {
      exp: 35000,
      gold: 30000,
      ap: 6,
      sp: 5,
      items: [
        { baseId: 'sword_5', name: 'Aegis of the Sun Destroyer', rarity: 'epic', seal: 'sun', level: 50, count: 1 },
        { baseId: 'elixir_weapon', name: 'Elixir of Tempering (Weapon)', count: 6 },
        { baseId: 'elixir_armor', name: 'Elixir of Tempering (Armor)', count: 6 },
      ],
    },
  },

  // ---- Oakhaven Outskirts Hunting Progression (Lv 1 -> Lv 10 Dungeon Gate) ----
  q_outskirts_meadow: {
    id: 'q_outskirts_meadow',
    name: 'Oakhaven Border: Southern Meadow (Lv 1–3)',
    npcId: 'chief',
    reqLevel: 1,
    prereq: null,
    desc: 'The dungeon gates remain sealed until you reach Level 10! Step out through Oakhaven’s Southern and Southeastern gates to hunt respawning Sporeling Gremlins and Gloom-Eye Wisps and grow stronger.',
    introLines: [
      'Welcome! The Whispering Stone Caverns only open to warriors of Level 10 and above.',
      'Step outside any of Oakhaven’s four great gates—Sporeling Gremlins and Gloom-Eye Wisps respawn swiftly across the meadows!',
    ],
    completeLines: [
      'A strong start! Now press onward to the denser hunting camps in the Western Willowwood and Lotus Marsh.',
    ],
    objectives: [
      { id: 'hunt_meadow', type: 'kill', targets: ['mangyang', 'small_eye_ghost', 'bigeye_ghost', 'slime'], floor: 0, matchFloorFallback: false, target: 6, text: 'Hunt Oakhaven Southern Meadow monsters (Lv 1–3)' },
    ],
    rewards: {
      exp: 360,
      gold: 450,
      ap: 1,
      sp: 1,
      items: [
        { baseId: 'hp_potion_s', name: 'Small HP Potion', count: 5 },
      ],
    },
  },

  q_outskirts_woods: {
    id: 'q_outskirts_woods',
    name: 'Western Willowwood: Jackals & Brook Wraiths (Lv 4–6)',
    npcId: 'trainer',
    reqLevel: 2,
    prereq: 'q_outskirts_meadow',
    desc: 'Beyond the Western Gate, Thornback Jackals, Rabid Howlers, and Brook Wraiths have overrun the willow grove and marsh.',
    introLines: [
      'Venture out of the Western Gate and cull the packs of Thornback Jackals, Rabid Howlers, and Brook Wraiths!',
    ],
    completeLines: [
      'Your reflexes are growing sharper! The Eastern Quarry and Raider Canyon await you next.',
    ],
    objectives: [
      { id: 'hunt_woods', type: 'kill', targets: ['old_weasel', 'gyo_weasel', 'water_ghost_slave', 'water_ghost'], floor: 0, matchFloorFallback: false, target: 8, text: 'Hunt Western Willowwood & Marsh creatures (Lv 4–6)' },
    ],
    rewards: {
      exp: 760,
      gold: 850,
      ap: 1,
      sp: 2,
      items: [
        { baseId: 'mp_potion_s', name: 'Small SP Potion', count: 5 },
      ],
    },
  },

  q_outskirts_outpost: {
    id: 'q_outskirts_outpost',
    name: 'Eastern Ruins: Cairn Sentinels & Raiders (Lv 7–9)',
    npcId: 'blacksmith',
    reqLevel: 4,
    prereq: 'q_outskirts_woods',
    desc: 'Cairn Sentinels and Blackblade Raiders have entrenched themselves in the ancient stone quarry and ruins outside the Eastern Gate.',
    introLines: [
      'Clear the Cairn Sentinels and Blackblade Raider bands from the Eastern Ruins to reopen the Oakhaven trade road!',
    ],
    completeLines: [
      'Steadfast as forged iron! March to the Northern Tiger Ridge for your final outskirts trial.',
    ],
    objectives: [
      { id: 'hunt_outpost', type: 'kill', targets: ['broken_stone_ghost', 'stone_ghost', 'tombstone_ghost', 'tombstone', 'bandit_subordinate', 'bandit_archer', 'bandit_bowman', 'bandit'], floor: 0, matchFloorFallback: false, target: 10, text: 'Hunt Eastern Ruins & Blackblade Raiders (Lv 7–9)' },
    ],
    rewards: {
      exp: 1450,
      gold: 1400,
      ap: 2,
      sp: 2,
      items: [
        { baseId: 'elixir_weapon', name: 'Elixir of Tempering (Weapon)', count: 2 },
      ],
    },
  },

  q_outskirts_ridge: {
    id: 'q_outskirts_ridge',
    name: 'Northern Ridge & the Level 10 Trial',
    npcId: 'chief',
    reqLevel: 6,
    prereq: 'q_outskirts_outpost',
    desc: 'Hunt Thornwood Dryads, Hollowbark Brutes, and Ashwood & Frostfang Tigers along Oakhaven’s Northern Ridge until you reach Level 10.',
    introLines: [
      'The Thornwood Dryads and Frostfang Tigers of the Northern Ridge are the fiercest beasts in the outskirts. Reach Level 10 to unseal the Dungeon Gate!',
    ],
    completeLines: [
      'You have reached Level 10! You may now enter the Whispering Stone Caverns and purge every floor to advance the realm’s story!',
    ],
    objectives: [
      { id: 'hunt_ridge', type: 'kill', targets: ['decayed_yeoha', 'yeoha', 'young_tiger', 'tiger', 'black_tiger', 'white_tiger', 'chakji_worker', 'tombstone'], floor: 0, matchFloorFallback: false, target: 10, text: 'Hunt Oakhaven Northern Ridge monsters (Lv 8–10)' },
      { id: 'reach_lv10', type: 'level', target: 10, text: 'Reach Level 10 (Unseal the Dungeon Gate)' },
    ],
    rewards: {
      exp: 2600,
      gold: 2800,
      ap: 3,
      sp: 3,
      items: [
        { baseId: 'armor_2', name: 'Reinforced Iron Armor', rarity: 'rare', level: 10, count: 1 },
        { baseId: 'elixir_armor', name: 'Elixir of Tempering (Armor)', count: 2 },
      ],
    },
  },

  // ---- Story-Integrated Oakhaven NPC Quests ----
  q_tamer_bond: {
    id: 'q_tamer_bond',
    name: 'Companion Bond: Oakhaven Wilds',
    npcId: 'pet_merchant',
    reqLevel: 3,
    prereq: null,
    desc: 'Beast Tamer Zara is investigating why the wild beasts beyond Oakhaven’s walls have grown aggressive, and asks you to log supplies with Quartermaster Bram.',
    introLines: [
      'Traveler! Even the young tigers and jackals have grown restless lately. Scout a few packs in the outskirts and check in with Quartermaster Bram.',
    ],
    completeLines: [
      'Splendid work! You can now adopt a Grab or Combat Pet from the [P] menu to fight at your side. Don’t forget to store your spare loot in the General Shared Vault!',
    ],
    objectives: [
      { id: 'hunt_beasts', type: 'kill', targets: ['young_tiger', 'tiger', 'old_weasel', 'gyo_weasel'], floor: 0, matchFloorFallback: false, target: 6, text: 'Investigate Tiger & Jackal packs in the outskirts' },
      { id: 'talk_wangu', type: 'talk_npc', npcId: 'storage', target: 1, text: 'Register supplies with Quartermaster Bram', dialogue: 'Did Zara send you? The General Storage Vault is shared across all your characters. Leave your gold and relics here anytime!' },
    ],
    rewards: {
      exp: 950,
      gold: 1600,
      ap: 1,
      sp: 1,
      items: [
        { baseId: 'elixir_accessory', name: 'Elixir of Tempering (Accessory)', count: 1 },
      ],
    },
  },

  q_canal_shadows: {
    id: 'q_canal_shadows',
    name: 'Shadows in the Lotus Canal',
    npcId: 'merchant',
    reqLevel: 4,
    prereq: null,
    desc: 'Apothecary Elara wants you to drive away the Brook Wraiths fouling Oakhaven’s canals and bring a water sample to Crystal Sage Lyra for analysis.',
    introLines: [
      'Brook Wraiths drifting up from the southwestern Lotus Marsh are tainting our healing springs with frost magic. Push them back and consult Lyra!',
    ],
    completeLines: [
      'Wonderful! The canal waters run clear once more. Take these potions and Luck Powders—they will serve you well in the depths.',
    ],
    objectives: [
      { id: 'purge_water', type: 'kill', targets: ['water_ghost_slave', 'water_ghost'], floor: 0, matchFloorFallback: false, target: 6, text: 'Purge Brook Wraiths from the Lotus Marsh' },
      { id: 'talk_lyra', type: 'talk_npc', npcId: 'composer', target: 1, text: 'Have Crystal Sage Lyra inspect the sample', dialogue: 'This frost resonance is seeping up from beneath the Whispering Stone Caverns. Remember to temper your gear with elixirs!' },
    ],
    rewards: {
      exp: 1200,
      gold: 1400,
      ap: 1,
      sp: 2,
      items: [
        { baseId: 'hp_potion_m', name: 'HP Potion', count: 5 },
        { baseId: 'powder_1', name: 'Luck Powder (Grade 1)', count: 3 },
      ],
    },
  },

  q_bandit_caravan: {
    id: 'q_bandit_caravan',
    name: 'The Stolen Caravan',
    npcId: 'hunter_master',
    reqLevel: 6,
    prereq: null,
    desc: 'Hunter Master Garrik wants you to crush the Blackblade Raider bands ambushing caravans outside the Eastern Gate and report the cleared route to Orin.',
    introLines: [
      'Blackblade Raiders and Marksmen have blockaded the eastern road! Scatter their warband and reassure Specialty Trader Orin.',
    ],
    completeLines: [
      'The trade road is open once again! Orin has opened his finest selection of rings and relics to you.',
    ],
    objectives: [
      { id: 'defeat_bandits', type: 'kill', targets: ['bandit_subordinate', 'bandit', 'bandit_archer', 'bandit_bowman'], floor: 0, matchFloorFallback: false, target: 8, text: 'Defeat Eastern Oakhaven Blackblade Raiders' },
      { id: 'talk_jodaesan', type: 'talk_npc', npcId: 'accessory_trader', target: 1, text: 'Confirm the open trade route with Orin', dialogue: 'So Garrik sent his finest hunter! Thank you for driving off those raiders. My rings, necklaces, and EXP scrolls are always at your service.' },
    ],
    rewards: {
      exp: 1950,
      gold: 2400,
      ap: 2,
      sp: 2,
      items: [
        { baseId: 'box_gear', name: 'Mystery War Coffer', count: 1 },
      ],
    },
  },

  // ---- Full Floor Purge Quests (updated via onFloorCleared) ----
  q_clear_donhwang: {
    id: 'q_clear_donhwang',
    name: 'Whispering Stone Caverns Purge (B1F–B3F)',
    npcId: 'chief',
    reqLevel: 10,
    prereq: 'q_outskirts_ridge',
    desc: 'Purge every last monster across Floors 1, 2, and 3 of the Whispering Stone Caverns.',
    introLines: [
      'The gate to the next floor remains sealed until every foe is vanquished. Cleanse all three floors of the Whispering Stone Caverns!',
    ],
    completeLines: [
      'The Whispering Stone Caverns are secure! Your chronicle has been updated.',
    ],
    objectives: [
      { id: 'clr_f1', type: 'clear_floor', floor: 1, target: 1, text: 'Fully Clear B1F (Whispering Stone Caverns B1F)' },
      { id: 'clr_f2', type: 'clear_floor', floor: 2, target: 1, text: 'Fully Clear B2F (Whispering Stone Caverns B2F)' },
      { id: 'clr_f3', type: 'clear_floor', floor: 3, target: 1, text: 'Fully Clear B3F (Frostfang Empress Lair)' },
    ],
    rewards: {
      exp: 4200,
      gold: 3800,
      ap: 3,
      sp: 3,
    },
  },

  q_clear_karakoram: {
    id: 'q_clear_karakoram',
    name: 'Ironcrest Crags & Frosthollow Purge (B4F–B6F)',
    npcId: 'chief',
    reqLevel: 10,
    prereq: 'q_clear_donhwang',
    desc: 'Clear all enemies across Ironcrest Crags and Frosthollow (B4F–B6F).',
    introLines: [
      'Cleanse all three floors of Warchief Drakmor and his raiders without leaving a single foe standing.',
    ],
    completeLines: [
      'Ironcrest Crags and Frosthollow are cleared! The path to the Sunken Sovereign Vaults lies open.',
    ],
    objectives: [
      { id: 'clr_f4', type: 'clear_floor', floor: 4, target: 1, text: 'Fully Clear B4F (Ironcrest Crags)' },
      { id: 'clr_f5', type: 'clear_floor', floor: 5, target: 1, text: 'Fully Clear B5F (Frosthollow Cavern)' },
      { id: 'clr_f6', type: 'clear_floor', floor: 6, target: 1, text: 'Fully Clear B6F (Warchief Drakmor’s Citadel)' },
    ],
    rewards: {
      exp: 7500,
      gold: 6500,
      ap: 4,
      sp: 4,
    },
  },

  q_clear_qinshi: {
    id: 'q_clear_qinshi',
    name: 'Sunken Sovereign Vaults Purge (B7F–B9F)',
    npcId: 'chief',
    reqLevel: 14,
    prereq: 'q_clear_karakoram',
    desc: 'Purge every guardian inside the Sunken Sovereign Vaults across Floors B7F–B9F.',
    introLines: [
      'Cleanse all three vault tiers held by Lady Glaciera and the Sovereign’s undead legion!',
    ],
    completeLines: [
      'The Sunken Sovereign Vaults have fallen silent! Press onward to the Scorched Sunspire Ruins.',
    ],
    objectives: [
      { id: 'clr_f7', type: 'clear_floor', floor: 7, target: 1, text: 'Fully Clear B7F (Sunken Sovereign Vaults B1F)' },
      { id: 'clr_f8', type: 'clear_floor', floor: 8, target: 1, text: 'Fully Clear B8F (Sunken Sovereign Vaults B2F)' },
      { id: 'clr_f9', type: 'clear_floor', floor: 9, target: 1, text: 'Fully Clear B9F (Lady Glaciera’s Sanctum)' },
    ],
    rewards: {
      exp: 12000,
      gold: 10500,
      ap: 4,
      sp: 4,
    },
  },

  q_clear_flame: {
    id: 'q_clear_flame',
    name: 'Scorched Sunspire Ruins Purge (B10F–B12F)',
    npcId: 'chief',
    reqLevel: 18,
    prereq: 'q_clear_qinshi',
    desc: 'Purge the Scorched Sunspire Ruins and Bone Galleries (B10F–B12F) down to the final creature.',
    introLines: [
      'Cleanse Valkor, Bone Sovereign’s scorched galleries completely!',
    ],
    completeLines: [
      'The Scorched Sunspire Ruins are subdued! The seal to the Sanctum of Light has broken.',
    ],
    objectives: [
      { id: 'clr_f10', type: 'clear_floor', floor: 10, target: 1, text: 'Fully Clear B10F (Ash Passage)' },
      { id: 'clr_f11', type: 'clear_floor', floor: 11, target: 1, text: 'Fully Clear B11F (Magma Galleries)' },
      { id: 'clr_f12', type: 'clear_floor', floor: 12, target: 1, text: 'Fully Clear B12F (Valkor’s Bone Spire)' },
    ],
    rewards: {
      exp: 22000,
      gold: 18000,
      ap: 5,
      sp: 5,
    },
  },

  q_clear_pantheon: {
    id: 'q_clear_pantheon',
    name: 'Sanctum of Light & Skycrown Path (B13F–B15F)',
    npcId: 'chief',
    reqLevel: 24,
    prereq: 'q_clear_flame',
    desc: 'Fully purge the Sanctum of Light (B13F), Stormspire Temple (B14F), and Ashen Abyss (B15F).',
    introLines: [
      'The path to Skycrown Citadel will not open until the legions of the Sanctum Wardens and Malakor, the Ember Archfiend, are completely purged!',
    ],
    completeLines: [
      'You are ready for the final battle high above the clouds, hero!',
    ],
    objectives: [
      { id: 'clr_f13', type: 'clear_floor', floor: 13, target: 1, text: 'Fully Clear B13F (Sanctum of Light)' },
      { id: 'clr_f14', type: 'clear_floor', floor: 14, target: 1, text: 'Fully Clear B14F (Stormspire Temple)' },
      { id: 'clr_f15', type: 'clear_floor', floor: 15, target: 1, text: 'Fully Clear B15F (Ashen Abyss)' },
    ],
    rewards: {
      exp: 42000,
      gold: 35000,
      ap: 6,
      sp: 6,
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
    // Auto-accept the Oakhaven outskirts starter quest & dungeon slime quest
    this.accept('q_outskirts_meadow', { silent: true });
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
    if (obj.type === 'clear_floor' && this.game && this.game.progress) {
      const cleared = Array.isArray(this.game.progress.floorsCleared) && this.game.progress.floorsCleared.includes(obj.floor) ? 1 : 0;
      return Math.max(p, cleared);
    }
    if (obj.type === 'level') {
      return Math.max(p, Math.min(obj.target || 10, this._heroLevel()));
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
    if (g && rw.ap && g.hero) { g.hero.ap = (g.hero.ap || 0) + rw.ap; }
    if (g && rw.sp && g.hero) { g.hero.sp = (g.hero.sp || 0) + rw.sp; }
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

  onLevel() {
    for (const def of this._activeDefs()) {
      this._syncReadyState(def);
    }
    this._emit('quest:updated');
    this._changed();
  }
  onTalk(npcId) {
    const norm = resolveNpcId(npcId);
    let updated = false;
    for (const def of this._activeDefs()) {
      const prog = (this.progress[def.id] ||= {});
      for (const o of def.objectives || []) {
        if (o.type === 'talk' || o.type === 'talk_npc') {
          const targetNpc = resolveNpcId(o.npcId || o.targetNpc || o.npc);
          if (targetNpc === norm) {
            const cur = prog[o.id] || 0;
            if (cur < (o.target || 1)) {
              prog[o.id] = (o.target || 1);
              updated = true;
              this._emit('toast', `Talked with ${NPCS[norm]?.name || norm}!`, 'quest');
            }
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
    const id = resolveNpcId(npcId);
    for (const def of this._activeDefs()) {
      if (this.states[def.id] === 'active') {
        for (const o of def.objectives || []) {
          if ((o.type === 'talk' || o.type === 'talk_npc') && resolveNpcId(o.npcId || o.targetNpc || o.npc) === id) {
            const cur = this._getObjCurrent(def, o);
            if (cur < (o.target || 1)) return '?';
          }
        }
      }
    }
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
    // Multi-NPC dialogue options
    for (const def of this._activeDefs()) {
      if (this.states[def.id] === 'active') {
        for (const o of def.objectives || []) {
          if ((o.type === 'talk' || o.type === 'talk_npc') && resolveNpcId(o.npcId || o.targetNpc || o.npc) === id) {
            const cur = this._getObjCurrent(def, o);
            if (cur < (o.target || 1)) {
              options.push({ label: `💬 Quest: ${o.text || `Speak with ${npc.name}`}`, action: `talk_npc:${def.id}:${o.id}`, id: `talk_npc:${def.id}:${o.id}` });
            }
          }
        }
      }
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
    if (act.startsWith('talk_npc:')) {
      const parts = act.split(':');
      const qId = parts[1];
      const objId = parts[2];
      const def = QUEST_DEFS[qId];
      if (def) {
        const prog = (this.progress[def.id] ||= {});
        const o = (def.objectives || []).find((obj) => obj.id === objId);
        prog[objId] = (o?.target || 1);
        this._syncReadyState(def);
        this._emit('quest:updated');
        this._changed();
        const dlgText = o?.dialogue || `Thank you for consulting me regarding "${def.name}". Here is the counsel you need.`;
        const id = resolveNpcId(npcId);
        const npc = NPCS[id] || NPCS.chief;
        return {
          ok: true,
          name: npc.name,
          icon: npc.icon,
          lines: [dlgText],
          options: [{ label: 'Continue', action: 'back' }, { label: 'Leave', action: 'close' }]
        };
      }
    }
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
    if (act.startsWith('open_menu:')) {
      const [, menu, tab] = act.split(':');
      return { ok: true, openMenu: menu, tab: tab || null };
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

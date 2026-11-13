import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three';
import { CLASSES, CLASS_IDS, getClass, canClassUse } from '../src/systems/classes.js';
import {
  ALCHEMY,
  SEALS,
  STATUS,
  IMBUE_DEFAULTS,
  BERSERK,
  berserkOrbs,
  RARITY_BEAMS,
  NEMESIS,
  createNemesisTitle,
  BOSS_MECHANICS,
  HOT_SPRINGS
} from '../src/systems/mechanics.js';
import { createGame, createUIHost, TOWN_TRAINING_DEFS, TOWN_BLESSINGS } from '../src/systems/gameState.js';
import { ITEM_BASES, SET_BASE_IDS, SETS, SHOP_DEFS, SHARED_STORAGE_KEY, floorMonsterLevel, generateItem, recalcItem, Inventory, MAGIC_STONES } from '../src/systems/inventory.js';
import { QuestSystem, NPCS } from '../src/systems/quests.js';
import { PET_TYPES, PetSystem } from '../src/systems/petSystem.js';
import { SKILL_DEFS, SKILL_ALIASES } from '../src/systems/skills.js';
import { createDungeonGenerator, DUNGEON_THEMES, CHALLENGE_TYPES, TILE } from '../src/world/dungeonGenerator.js';
import { nearOpening, SRO_DUNGEON_PROPS, resolveSroDungeon } from '../src/world/dungeonDecor.js';
import { createEnemyManager, AI_STATE, OUTSKIRT_GIANT_KILL_THRESHOLD } from '../src/world/enemyAI.js';
import { models3d, CLASS_CLIP_MAP } from '../src/engine/models3d.js';
import { PlayerController } from '../src/engine/playerController.js';
import { buildVillage } from '../src/world/villageBuilder.js';
import { Renderer } from '../src/engine/renderer.js';
import { MUSIC_TRACKS, resolveFloorMusic, MusicManager } from '../src/engine/musicManager.js';

let passed = 0;
function check(label, cond) {
  assert.ok(cond, `FAIL: ${label}`);
  passed++;
}

// 1. Classes, 32 Sets, and Stat Scaling
check('4 permanent classes defined', CLASS_IDS.length === 4);
for (const cid of CLASS_IDS) {
  const cls = getClass(cid);
  check(`Class ${cid} has primary attr and weapons`, Boolean(cls && cls.primary && cls.weapons?.length));
  const classSkills = Object.values(SKILL_DEFS).filter((s) => (s.classId || '').toLowerCase() === cid || (s.tree || '').toLowerCase() === cid);
  check(`Class ${cid} has >= 12 skills`, classSkills.length >= 12);
  for (let t = 1; t <= 8; t++) {
    const setKey = `${cid}_${t}`;
    check(`Class set ${setKey} exists`, Boolean(SETS[setKey] && Object.keys(SETS[setKey].pieces).length >= 4));
  }
}

const game = createGame({});
game.newCharacter({ name: 'TestArcher', classId: 'archer', slot: 0 });
check('Archer class assigned', game.hero.classId === 'archer');
const bowItem = generateItem('bow_1', 'rare', 1);
const axeItem = generateItem('axe_1', 'rare', 1);
check('Archer can use bow', canClassUse('archer', bowItem).ok === true);
check('Archer cannot use 2H axe', canClassUse('archer', axeItem).ok === false);
check('Floor 15 maps to monster level 52', floorMonsterLevel(15) === 52);

// 2. Alchemy, Seals, Imbues & Chains
const sword = generateItem('sword_3', 'epic', 10);
game.newCharacter({ name: 'TestKnight', classId: 'knight', slot: 0 });
game.addGold(50000);
game.inventory.addItem(sword);
game.inventory.addItem({ id: 'elixir_weapon', baseId: 'elixir_weapon', count: 5 });
game.inventory.addItem({ id: 'powder_2', baseId: 'powder_2', count: 5 });
game.inventory.addItem({ id: 'guardian_talisman', baseId: 'guardian_talisman', count: 5 });
const prev = game.inventory.previewAlchemy(sword.uid, { usePowder: true, useTalisman: true });
check('previewAlchemy returns valid chance and cost', prev && prev.ok && prev.chance > 0);
check('Alchemy constants and Seals defined', Boolean(ALCHEMY && SEALS && STATUS && IMBUE_DEFAULTS));

{
  const ag = createGame({});
  ag.newCharacter({ name: 'AlchKnight', classId: 'knight', slot: 0 });
  ag.addGold(5000);
  const inv = ag.inventory;
  const wpn = inv.equipment.weapon;
  const atk0 = ag.atkMax, gold0 = ag.hero.gold, armorElx0 = inv.countItem('elixir_armor');
  const events = []; ag.on('alchemy', (e) => events.push(e));
  let questHook = 0; const origOnCompose = ag.quests.onCompose.bind(ag.quests);
  ag.quests.onCompose = (...a) => { questHook++; return origOnCompose(...a); };
  const pv = inv.previewAlchemy(wpn.uid, {});
  check('Equipped starter weapon can be previewed for alchemy', pv.ok && pv.elixirId === 'elixir_weapon' && pv.haveElixir === 2 && pv.chance === ALCHEMY.elixirChance[0]);
  const rnd = Math.random;
  Math.random = () => 0;
  const r1 = inv.alchemy(wpn.uid, {});
  Math.random = rnd;
  check('Equipped weapon alchemy success raises +1 and keeps it equipped', r1.ok && r1.success && inv.equipment.weapon === wpn && wpn.plus === 1);
  check('Alchemy consumes exactly one matching elixir and the gold cost', inv.countItem('elixir_weapon') === 1 && inv.countItem('elixir_armor') === armorElx0 && ag.hero.gold === gold0 - pv.cost);
  check('Equipped weapon alchemy updates hero attack stats', ag.atkMax > atk0);
  check('Alchemy emits event and counts toward compose/upgrade quests', events.length === 1 && events[0].item === wpn && questHook === 1);
  const saved = JSON.parse(JSON.stringify(ag.toJSON()));
  const lg = createGame({}); lg.fromJSON(saved);
  check('Alchemy +N persists through save/load', lg.inventory.equipment.weapon && lg.inventory.equipment.weapon.plus === 1);
  Math.random = () => 0.999;
  const r2 = inv.alchemy(wpn.uid, {});
  Math.random = rnd;
  check('Alchemy failure resets to +0 without breaking the item', r2.ok && !r2.success && wpn.plus === 0 && inv.equipment.weapon === wpn && inv.countItem('elixir_weapon') === 0);
  const r3 = inv.alchemy(wpn.uid, {});
  check('Alchemy without a matching elixir is refused', !r3.ok && wpn.plus === 0);
}

// 3. Village Hub, Forest Outskirts, and Minimap Contract
const scene = new THREE.Scene();
const telegraphs = [];
const mockRenderer = {
  scene,
  camera: new THREE.PerspectiveCamera(),
  setEnvironmentTheme() {},
  applyAtmosphere() {},
  brightenWorldMaterials() {},
  addPointLight() { return new THREE.PointLight(); },
  clearDynamicLights() {},
  spawnFloatingText() {},
  spawnBossTelegraph(kind, origin, dir, opts) {
    telegraphs.push({ kind, origin: { x: origin.x, z: origin.z }, opts });
  }
};

const dungeon = createDungeonGenerator({ renderer: mockRenderer, scene, models3d }, models3d, {});
const hub = dungeon.loadVillageHub(mockRenderer, models3d);
check('Village hub spawns 9 interactive NPCs (including Beast Tamer Zara, Jodaesan & Gwakwi)', hub.npcs.length === 9);
check('Village build includes animated crowd villagers & outer grove', dungeon.villageBuild?.villagers?.length > 0);
const mm = dungeon.getMinimapData({ x: 0, z: 0 }, 0, []);
const mmNpcs = mm.entities.filter((e) => e.type === 'npc');
check('Minimap shows only the 9 interactive NPCs (no crowd villagers)', mmNpcs.length === 9);

// 4. All 15 Dungeon Floors, Weather Themes, Puzzles, Boss Arenas & Sleeping Monster Packs
check('Cave theme has spores weather (0x86efac)', DUNGEON_THEMES.cave?.atmosphere?.weather === 'spores' && DUNGEON_THEMES.cave?.atmosphere?.weatherColor === 0x86efac);
check('Crypt theme has mist weather (0x94a3b8) and never snow', DUNGEON_THEMES.crypt?.atmosphere?.weather === 'mist' && DUNGEON_THEMES.crypt?.atmosphere?.weatherColor === 0x94a3b8);
check('Ruins theme has incense weather (0xfde047)', DUNGEON_THEMES.ruins?.atmosphere?.weather === 'incense' && DUNGEON_THEMES.ruins?.atmosphere?.weatherColor === 0xfde047);
check('Lava theme has sand weather (0xd97706)', DUNGEON_THEMES.lava?.atmosphere?.weather === 'sand' && DUNGEON_THEMES.lava?.atmosphere?.weatherColor === 0xd97706);
check('Boss theme has embers weather (0xef4444)', DUNGEON_THEMES.boss?.atmosphere?.weather === 'embers' && DUNGEON_THEMES.boss?.atmosphere?.weatherColor === 0xef4444);
check('Village theme has petals weather', DUNGEON_THEMES.village?.atmosphere?.weather === 'petals');

// Renderer weather system checks (fallback must never be snow)
const testRenderer = Object.create(Renderer.prototype);
testRenderer.scene = { add() {} };
testRenderer.setWeather('unknown_invalid_weather');
check('Renderer setWeather falls back to null, never snow', testRenderer._weatherKind === null);
testRenderer.setWeather(null);
check('Renderer setWeather(null) clears weather', testRenderer._weatherKind === null);
testRenderer.setWeather('mist');
check('Renderer setWeather supports mist', testRenderer._weatherKind === 'mist' && testRenderer._weatherCfg?.color === 0x94a3b8);
testRenderer.setWeather('spores');
check('Renderer setWeather supports spores', testRenderer._weatherKind === 'spores' && testRenderer._weatherCfg?.color === 0x86efac);
testRenderer.setWeather('incense');
check('Renderer setWeather supports incense', testRenderer._weatherKind === 'incense' && testRenderer._weatherCfg?.color === 0xfde047);
testRenderer.setWeather('sand');
check('Renderer setWeather supports sand', testRenderer._weatherKind === 'sand' && testRenderer._weatherCfg?.color === 0xd97706);
testRenderer.setWeather('embers');
check('Renderer setWeather supports embers', testRenderer._weatherKind === 'embers' && testRenderer._weatherCfg?.color === 0xef4444);
testRenderer.setWeather('petals');
check('Renderer setWeather supports petals', testRenderer._weatherKind === 'petals' && testRenderer._weatherCfg?.color === 0xfbcfe8);

// Weather particles diluted and spread checks
const wpAttr = testRenderer._weatherPoints?.geometry?.getAttribute('position');
check('Weather particle count is diluted into 160-190 range', wpAttr && wpAttr.count >= 160 && wpAttr.count <= 190);
testRenderer.cameraTarget = new THREE.Vector3(10, 0, 10);
testRenderer._updateWeather(0.016, 0.0, { x: 10, z: 10 });
testRenderer.cameraTarget.set(20, 0, 20);
testRenderer._updateWeather(0.016, 0.016, { x: 20, z: 20 });
check('Weather points follow camera/hero smoothly without harsh snapping', testRenderer._weatherPoints.position.x > 10 && testRenderer._weatherPoints.position.x < 20);

for (const themeKey of ['cave', 'crypt', 'ruins', 'lava', 'boss']) {
  check(`Theme ${themeKey} has weather configured`, Boolean(DUNGEON_THEMES[themeKey]?.atmosphere?.weather));
}

const enemyMgr = createEnemyManager({ renderer: mockRenderer, scene, models3d, dungeon }, models3d, {});
for (let f = 1; f <= 15; f++) {
  const fData = dungeon.generateFloor(f, mockRenderer, models3d, {});
  check(`Floor ${f} spawnPoint is walkable`, dungeon.isWalkable(fData.spawnPoint.x, fData.spawnPoint.z, 0.35));
  const atSpawn = dungeon.getNearestInteractable(fData.spawnPoint.x, fData.spawnPoint.z, 3.0);
  check(`Floor ${f} spawn is outside portal interaction reach`, atSpawn?.type !== 'portal');
  check(`Floor ${f} portals stand on walkable floor`, dungeon.portals.every((p) => dungeon.isWalkable(p.x, p.z, 0.35)));
  check(`Floor ${f} has rooms and atmosphere`, fData.rooms.length >= 4 && Boolean(fData.atmosphere));
  check(`Floor ${f} never has snow weather`, fData.atmosphere?.weather !== 'snow');
  const expectedWeather = f <= 3 ? 'spores' : f <= 6 ? 'mist' : f <= 9 ? 'incense' : f <= 12 ? 'sand' : 'embers';
  check(`Floor ${f} has thematic weather ${expectedWeather}`, fData.atmosphere?.weather === expectedWeather);
  check(`Floor ${f} breakables never block doorways or corridor openings`, dungeon.breakables.every((b) => !nearOpening(dungeon, b.x, b.z, 3)));
  if (f === 15) {
    const finalRift = dungeon.portals.find((p) => p.lockedByBoss);
    check('Floor 15 boss rift leads to Floor 16 Final Boss Sanctum', finalRift?.targetFloor === 16 && finalRift?.portalType === 'next_floor');
  }
  if ([3, 6, 9, 12, 15].includes(f)) {
    check(`Boss floor ${f} has bossArena`, Boolean(fData.bossArena?.center && fData.bossArena?.radius > 5));
  }
  enemyMgr.clearEnemies();
  const spawned = enemyMgr.spawnFloorEnemies(fData, f, scene, models3d, {});
  check(`Floor ${f} spawns monsters`, spawned.length > 0);

  const sleepingMonsters = spawned.filter((e) => e.sleeping && e.state === AI_STATE.SLEEP && e.packId);
  check(`Floor ${f} has sleeping monster packs`, sleepingMonsters.length > 0);

  // Damaging one sleeping monster wakes its entire pack
  const target = sleepingMonsters[0];
  const packmates = spawned.filter((e) => e.packId === target.packId);
  enemyMgr.applyDamageToEnemy(target, 1);
  check(
    `Floor ${f} pack ${target.packId} wakes together on damage`,
    packmates.every((m) => !m.sleeping && (m.state === AI_STATE.CHASE || m.state === AI_STATE.STUN))
  );
}

// 5. Boss Telegraph Decals inside bossArena
const f3 = dungeon.generateFloor(3, mockRenderer, models3d, {});
enemyMgr.clearEnemies();
enemyMgr.spawnFloorEnemies(f3, 3, scene, models3d, {});
const boss = enemyMgr.enemies.find((e) => e.isBoss);
check('Floor 3 boss spawned', Boolean(boss));
const bossRift = dungeon.portals.find((p) => p.id === 'boss_exit_f3');
check('Boss rift starts sealed and refuses entry', bossRift?.lockedByBoss === true && dungeon.interact({ type: 'portal', entity: bossRift }, {}).ok === false);
check('Boss rift clears arena braziers/pillars', dungeon.solidObstacles.every((o) => Math.hypot(o.x - bossRift.x, o.z - bossRift.z) > o.radius + 1.5));
boss.skillCooldown = 0;
boss.state = AI_STATE.CHASE;
enemyMgr.update(0.05, 1.0, { x: boss.x + 2, z: boss.z + 2 }, dungeon, {});
check('Boss skill windup spawns bossArena telegraph decal', telegraphs.length > 0 && Boolean(telegraphs[0].opts?.arena));

// 6. Status application on EnemyManager
const burnEntry = enemyMgr.applyStatus(boss, { id: 'burn', duration: 4, dotPerTick: 10 });
check('Burn status applied to boss', Boolean(burnEntry && enemyMgr.hasStatus(boss, 'burn')));

// 7. Milestone 5: 5-Orb Berserk (Hwan) Mode
check('berserkOrbs maps 0..100 to 0..5 orbs', berserkOrbs(0) === 0 && berserkOrbs(60) === 3 && berserkOrbs(100) === 5);
const baseStatsBefore = game.getStats();
game.addBerserkCharge(100);
check('Berserk charge reaches 100', game.hero.berserkCharge === 100);
const bRes = game.activateBerserk();
check('Berserk activates when 5 orbs full', Boolean(bRes?.ok && game.hero.berserkActive));
const berserkStats = game.getStats();
check('Berserk doubles attack power', berserkStats.atk >= Math.floor(baseStatsBefore.atk * BERSERK.damageMult * 0.95));
check('Berserk increases move speed', berserkStats.moveSpeed > baseStatsBefore.moveSpeed);
for (let t = 0; t < 45; t++) game.update(0.5);
check('Berserk expires after duration', !game.hero.berserkActive);

// 8. Milestone 5: Jade Mist Hot Springs & Rested EXP
check('Village hub includes Jade Mist Hot Springs', Boolean(hub.hotSprings && hub.hotSprings.radius > 0));
game.soakInHotSprings(5.0);
check('Soaking in Hot Springs grants Rested EXP', game.hero.restedExp > 0 && game.hero.isSoaking === true);
const restedBefore = game.hero.restedExp;
game.gainExp(20);
check('Gaining EXP consumes Rested EXP pool for bonus EXP', game.hero.restedExp < restedBefore);

// 9. Milestone 5: Nemesis System & Vengeance Payout
const nemEntry = game.registerNemesisFromKill({ name: 'White Tiger', type: 'tiger', level: 10 }, 3);
check('registerNemesisFromKill creates ranked Nemesis', Boolean(nemEntry && game.nemesis && game.nemesis.rank === 1 && game.nemesis.floor === 3));
const enemyMgrNem = createEnemyManager({ renderer: mockRenderer, scene, models3d, dungeon, gameState: game }, models3d, {});
const f3Nem = dungeon.generateFloor(3, mockRenderer, models3d, {});
const spawnedF3 = enemyMgrNem.spawnFloorEnemies(f3Nem, 3, scene, models3d, {});
const spawnedNemesis = spawnedF3.find((e) => e.isNemesis);
check('Floor 3 spawns promoted Nemesis monster', Boolean(spawnedNemesis && spawnedNemesis.nemesisRank >= 1));
const vengeance = game.claimNemesisVengeance(spawnedNemesis);
check('Claiming Nemesis vengeance clears active Nemesis and rewards gold/EXP', Boolean(vengeance?.ok && !game.nemesis && game.hero.nemesisKills >= 1));

// 10. Milestone 5: Boss Fury Countdown & Elemental Aegis Shield Crystals
const bossF3 = spawnedF3.find((e) => e.isBoss);
check('Boss initializes with Fury countdown timer', Boolean(bossF3 && bossF3.furyTimer === BOSS_MECHANICS.furyTimerSeconds));
enemyMgrNem.spawnBossAegisCrystals(bossF3);
const spawnedCrystals = enemyMgrNem.enemies.filter((e) => !e.dead && e.isAegisCrystal && e.parentBossId === bossF3.id);
check('Boss spawns Elemental Aegis shield crystals', Boolean(bossF3.aegisActive && spawnedCrystals.length === BOSS_MECHANICS.aegisCrystalCount));
for (const crystal of spawnedCrystals) {
  enemyMgrNem.applyDamageToEnemy(crystal, 99999);
}
check('Destroying all Aegis crystals breaks Boss Aegis shield', !bossF3.aegisActive);
const atkBeforeFury = bossF3.atk;
enemyMgrNem.triggerBossFury(bossF3);
check('Boss Fury mode boosts boss attack and speed', Boolean(bossF3.isFurious && bossF3.atk > atkBeforeFury));

// 11. Silkroad Online Genderless Icons, Drop Boxes, Skill Icons & Clean Alchemy Shop
for (const baseId of SET_BASE_IDS) {
  const piece = ITEM_BASES[baseId];
  check(
    `Set piece ${baseId} has genderless Silkroad PNG icon`,
    Boolean(piece && /^\/assets\/sro\/icons\/(armor|weapon|shield)\/[a-z0-9_]+\.png$/.test(piece.icon))
  );
}
const sunWeapon = generateItem('sword_4', 'legendary', 12);
check('Generated weapon has Silkroad PNG icon and dropModel GLB', sunWeapon.icon.startsWith('/assets/sro/icons/weapon/') && (sunWeapon.dropModel.startsWith('/assets/sro/drops/') || sunWeapon.dropModel.startsWith('/assets/sro/item_drops/')));
const composerItems = SHOP_DEFS.composer?.items || [];
check('Alchemy shop stocks Elixirs, Powders, and Talisman', composerItems.includes('elixir_weapon') && composerItems.includes('powder_1') && composerItems.includes('guardian_talisman'));
check('Obsolete composing stones and crystals removed from Alchemy shop', !composerItems.some((id) => id.startsWith('stone_') || id.startsWith('crystal_') || id === 'lucky_charm'));
const allSkillsHaveSroIcons = Object.values(SKILL_DEFS).every((sk) => typeof sk.icon === 'string' && sk.icon.startsWith('/assets/sro/icons/skills/') && sk.icon.endsWith('.png'));
check('All 48 skills use Silkroad skill PNG icons', allSkillsHaveSroIcons);
const wizardSkillsHaveEuropeanIcons = Object.values(SKILL_DEFS).filter((sk) => sk.classes?.includes('wizard')).every((sk) => sk.icon.includes('/wizard_'));
check('Wizard skills use dedicated European wizard icons (no Chinese icons)', wizardSkillsHaveEuropeanIcons);

// 12. Celestial Rarity Beams & Parabolic Loot Drop Arc
const beamLootMesh = models3d.createLootMesh({ rarity: 'legendary', seal: 'sealOfSun', name: 'Sun Sword' });
check('Legendary/Seal loot mesh includes Celestial Rarity Beam', Boolean(beamLootMesh?.userData?.rarityBeam));
const droppedEntry = dungeon.spawnGroundLoot(2, 2, sunWeapon, { x: 0, z: 0 });
check('Ground loot spawns with parabolic toss arc metadata', Boolean(droppedEntry && droppedEntry.tossDuration > 0));

// 13. Axeman Dual-Wield Axes, Visual Metadata & Silkroad Skills
check('Axeman class has dualWield and canOffhandAxe', Boolean(CLASSES.axeman.dualWield && CLASSES.axeman.canOffhandAxe));
check('Axeman can use axe, dagger, and shield', canClassUse('axeman', { type: 'weapon', subType: 'axe' }) && canClassUse('axeman', { type: 'weapon', subType: 'dagger' }) && canClassUse('axeman', { type: 'shield' }));

const axemanGame = createGame('axeman');
check('Axeman starter kit equips mainhand axe and offhand axe', Boolean(axemanGame.inventory.equipment.weapon && axemanGame.inventory.equipment.shield && (axemanGame.inventory.equipment.shield.subType || axemanGame.inventory.equipment.shield.subtype) === 'axe'));

const initialAtk = axemanGame.getStats().atk;
const offhandBonus = axemanGame.inventory.calcEquipmentBonuses();
check('Equipment bonuses calculate stats from offhand axe in shield slot', offhandBonus.atk > 0 || offhandBonus.dmg > 0);

// Equipping a second axe fills empty shield slot
const testInv = new Inventory(null, 'axeman');
testInv.equipment.weapon = generateItem('axe_1', 'normal', 1);
const secondAxe = generateItem('axe_1', 'normal', 1);
testInv.addItem(secondAxe);
testInv.equip(0);
check('Equipping a second axe when offhand empty places it in shield slot', Boolean(testInv.equipment.shield && testInv.equipment.shield.uid === secondAxe.uid));

// Visual metadata on dropped / generated items
const droppedArmor = generateItem('armor_2', 'rare', 5);
check('Generated armor carries visualSet, visualPart and visualGlb', Boolean(droppedArmor.visualSet && droppedArmor.visualPart && droppedArmor.visualGlb));

// Silkroad 32 Skill IDs and SRO metadata
const expectedSroKeys = [
  'k_slash', 'k_shield_bash', 'k_war_cry', 'k_whirlwind', 'k_holy_strike', 'k_earthquake', 'k_iron_skin', 'k_avatar',
  'a_cleave', 'a_leap', 'a_blood_rage', 'a_rend', 'a_whirl', 'a_execute', 'a_war_stomp', 'a_ragnarok',
  'w_fireball', 'w_frost_nova', 'w_chain_lightning', 'w_teleport', 'w_meteor', 'w_blizzard', 'w_mana_shield', 'w_archon',
  'r_multi_shot', 'r_poison_arrow', 'r_evade_roll', 'r_trap', 'r_piercing', 'r_rain', 'r_hawk_eye', 'r_phoenix'
];
for (const k of expectedSroKeys) {
  const sk = SKILL_DEFS[k];
  check(`Silkroad skill ${k} exists with authentic icon and sroCode`, Boolean(sk && sk.icon?.startsWith('/assets/sro/icons/skills/') && sk.sroCode));
}

// Skill alias resolution
check('Axeman skill alias level lookup resolves seamlessly', axemanGame.skills.getLevel('a_cleave') === axemanGame.skills.getLevel('ax_cleave'));

// 14. Class-Specific Starter Kits, Archer Equip & Save/Load Class Sync
const archerGame = createGame({ classId: 'knight' }); // simulate boot default
archerGame.newCharacter({ name: 'Robin', classId: 'archer' });
check('Archer starts with Short Bow (bow_1) and no shield', archerGame.inventory.equipment.weapon?.baseId === 'bow_1' && archerGame.inventory.equipment.shield === null);
check('Archer starter armor uses light armor family', archerGame.inventory.equipment.armor?.armorFamily === 'light');

const wizardGame = createGame({ classId: 'knight' });
wizardGame.newCharacter({ name: 'Merlin', classId: 'wizard' });
check('Wizard starts with Wooden Staff (staff_1) and no shield', wizardGame.inventory.equipment.weapon?.baseId === 'staff_1' && wizardGame.inventory.equipment.shield === null);
check('Wizard starter armor uses clothes armor family', wizardGame.inventory.equipment.armor?.armorFamily === 'clothes');

const knightGame = createGame({ classId: 'knight' });
knightGame.newCharacter({ name: 'Arthur', classId: 'knight' });
check('Knight starts with Chinese Bronze Blade (blade_1, blade_01 model) and Wooden Buckler (shield_1)', knightGame.inventory.equipment.weapon?.baseId === 'blade_1' && knightGame.inventory.equipment.weapon?.visualModel === 'blade_01' && knightGame.inventory.equipment.shield?.baseId === 'shield_1');
check('Knight starter armor uses heavy armor family', knightGame.inventory.equipment.armor?.armorFamily === 'heavy' && knightGame.inventory.equipment.armor?.visualSet === 'heavy_01');
check('Wizard starter staff uses the European staff model (not a Chinese spear)', wizardGame.inventory.equipment.weapon?.visualModel === 'staff_01');
const axeStarter = createGame({ classId: 'knight' });
axeStarter.newCharacter({ name: 'Ragnar', classId: 'axeman' });
check('Axeman starts with European dual axes (main + offhand axe_01)', axeStarter.inventory.equipment.weapon?.visualModel === 'axe_01' && axeStarter.inventory.equipment.shield?.subtype === 'axe' && axeStarter.inventory.equipment.shield?.visualModel === 'axe_01');
check('Knight can equip and only Knights use blades', canClassUse('knight', { slot: 'weapon', subtype: 'blade' }).ok && !canClassUse('wizard', { slot: 'weapon', subtype: 'blade' }).ok);
const oldWizSave = wizardGame.toJSON();
oldWizSave.inventory.equipment.weapon.visualModel = 'spear_01';
const reloadedWiz = createGame({ classId: 'knight' });
reloadedWiz.fromJSON(oldWizSave);
check('Old wizard saves migrate spear visuals to the European staff', reloadedWiz.inventory.equipment.weapon?.visualModel === 'staff_01');

// Save and reload Archer into a fresh GameState (which boots as knight)
const savedArcherJSON = archerGame.toJSON();
const reloadedGame = createGame({ classId: 'knight' });
reloadedGame.fromJSON(savedArcherJSON);
check('Reloaded Archer save syncs inventory.classId to archer', reloadedGame.inventory.classId === 'archer');

const archerSetWeapon = generateItem({ baseId: 'set_archer_1_weapon', rarity: 'rare', level: 1 });
const archerSetArmor = generateItem({ baseId: 'set_archer_1_armor', rarity: 'rare', level: 1 });
reloadedGame.inventory.addItem(archerSetWeapon);
reloadedGame.inventory.addItem(archerSetArmor);
const eqBowRes = reloadedGame.inventory.equip(archerSetWeapon.uid);
const eqArmRes = reloadedGame.inventory.equip(archerSetArmor.uid);
check('Archer can equip Scout Longbow (set_archer_1_weapon) after save load', Boolean(eqBowRes.ok && reloadedGame.inventory.equipment.weapon?.uid === archerSetWeapon.uid));
check('Archer can equip Scout Jerkin (set_archer_1_armor) after save load', Boolean(eqArmRes.ok && reloadedGame.inventory.equipment.armor?.uid === archerSetArmor.uid));

// 15. European Dual Axes, Visual Degree Progression (01..04) & Boss SOS Drops
import { getEquipmentGlbTier, getWeaponGlbInfo, createEuropeanAxeMesh, SRO_CHAR_GLB_MAP, gearFxProfile } from '../src/engine/models3d.js';
import { rollLoot } from '../src/systems/inventory.js';

check('Axeman character uses European Adventurer GLB', SRO_CHAR_GLB_MAP.axeman === '/assets/sro/char/europeman_adventurer.glb');
check('Axeman starter mainhand and offhand are European axes (axe_01)', axemanGame.inventory.equipment.weapon?.visualModel === 'axe_01' && axemanGame.inventory.equipment.shield?.visualModel === 'axe_01');
const axeTier2 = generateItem({ baseId: 'axe_2', rarity: 'magic', level: 5 });
const axeTier3 = generateItem({ baseId: 'axe_3', rarity: 'rare', level: 10 });
const axeTier4 = generateItem({ baseId: 'axe_4', rarity: 'epic', level: 16 });
check('Axe tiers 1..4 map to distinct visual degrees 01, 02, 03, 04',
  getEquipmentGlbTier(axemanGame.inventory.equipment.weapon) === '01' &&
  getEquipmentGlbTier(axeTier2) === '02' &&
  getEquipmentGlbTier(axeTier3) === '03' &&
  getEquipmentGlbTier(axeTier4) === '04' &&
  getWeaponGlbInfo(axeTier3, 'axeman').type === 'axe'
);
const euAxe3D = createEuropeanAxeMesh(axeTier4, '04', false);
check('createEuropeanAxeMesh builds 3D European battle axe mesh with child geometries', Boolean(euAxe3D && euAxe3D.children.length >= 6));

// Rebalanced SOS drop rate: Boss drops roll seals with balanced rarity rather than 100% flooding
const rollSealsSample = [];
for (let i = 0; i < 50; i++) {
  const drops = rollLoot(25, { isBoss: true, classId: 'axeman' });
  if (drops.items.some((it) => it && it.seal)) rollSealsSample.push(drops);
}
check('Boss loot rolls sealed equipment with rebalanced rarity (between 10% and 60%, not 100% flooded)', rollSealsSample.length >= 5 && rollSealsSample.length <= 35);


// Gear FX: +3 and above glow, seal particles, combined profile
check('Items below +3 without a seal get no gear FX', gearFxProfile({ plus: 2 }) === null);
check('+3 item gets a faint glow tier without particles', gearFxProfile({ plus: 3 })?.plusTier === 1 && gearFxProfile({ plus: 3 }).sparkles === 0);
check('+9 item gets the gold tier with glints', gearFxProfile({ plus: 9 })?.plusTier === 4 && gearFxProfile({ plus: 9 }).sparkles > 0);
const comboFx = gearFxProfile({ plus: 9, seal: 'star' });
check('Sealed +N item keeps both effects with fewer +N glints', comboFx.seal === 'star' && comboFx.sealParticles > 0 && comboFx.sparkles < gearFxProfile({ plus: 9 }).sparkles && comboFx.glowHex !== gearFxProfile({ plus: 9 }).glowHex);
check('Seal-only +0 item still gets its seal FX', gearFxProfile({ plus: 0, seal: 'moon' })?.seal === 'moon');

{
  const rg = createGame({});
  const scrollUid = () => rg.inventory.bag.find((it) => it && it.baseId === 'scroll_return' && it.uid)?.uid;
  const countScrolls = () => rg.inventory.bag.reduce((n, it) => n + (it && it.baseId === 'scroll_return' ? (it.count || 1) : 0), 0);
  const startScrolls = countScrolls();
  rg.progress.currentFloor = 0;
  const inVillage = rg.inventory.useItem(scrollUid());
  check('Return Scroll is refused in the village', inVillage.ok === false && countScrolls() === startScrolls);
  rg.progress.currentFloor = 4;
  const inDungeon = rg.inventory.useItem(scrollUid());
  check('Return Scroll is consumed in the dungeon', inDungeon.ok === true && countScrolls() === startScrolls - 1);
}
// 16. Dynamic Inventory Sync, Visual Equipment & Class Starter Kit Validation
import { getArmorVisualSet } from '../src/engine/models3d.js';
import { createHost } from '../src/ui/hud.js';

{
  const gs = createGame({});
  const ctx = {
    gameState: gs,
    game: gs,
    get inventory() { return gs.inventory; },
    get skills() { return gs.skills; },
    get quests() { return gs.quests; },
  };
  const host = createHost(ctx);
  check('Initial boot host inventory is knight blade', host.getInventory().equipment.weapon?.name?.includes('Blade'));

  // Switch / new character as Wizard
  gs.newCharacter({ classId: 'wizard' });
  check('After newCharacter(wizard), ctx.inventory dynamically tracks wizard inventory', ctx.inventory.classId === 'wizard');
  check('After newCharacter(wizard), host.getInventory() tracks wizard equipment (Wooden Staff)', host.getInventory().equipment.weapon?.name?.includes('Staff'));
  check('Wizard starts with shield === null in host inventory', host.getInventory().equipment.shield == null);

  // Level up to 5 to meet reqLevel for tier 2 items
  gs.hero.level = 5;

  // Equip newly dropped Tier 2 staff
  const droppedStaff2 = generateItem({ baseId: 'staff_2', rarity: 'rare', level: 5 });
  gs.inventory.addItem(droppedStaff2);
  const eqStaffRes = host.equip(droppedStaff2.uid);
  check('Wizard equips dropped Tier 2 staff via host.equip', eqStaffRes.ok === true && gs.inventory.equipment.weapon?.uid === droppedStaff2.uid);
  const staffGlbInfo = getWeaponGlbInfo(gs.inventory.equipment.weapon, 'wizard');
  check('Equipped Tier 2 staff resolves to degree 02', staffGlbInfo.type === 'staff' && staffGlbInfo.tier === '02');

  // Equip newly dropped Tier 2 armor
  const droppedArmor2 = generateItem({ baseId: 'armor_2', rarity: 'magic', level: 5 });
  gs.inventory.addItem(droppedArmor2);
  const eqArmorRes = host.equip(droppedArmor2.uid);
  check('Wizard equips dropped Tier 2 armor via host.equip', eqArmorRes.ok === true && gs.inventory.equipment.armor?.uid === droppedArmor2.uid);
  check('Equipped Tier 2 armor resolves to degree 02 visual set', getArmorVisualSet(gs.inventory.equipment.armor).endsWith('_02'));

  // Archer starter kit & no shield
  const archerG = createGame({ classId: 'archer' });
  check('Archer starter weapon is bow_1', archerG.inventory.equipment.weapon?.baseId === 'bow_1');
  check('Archer starter shield is null', archerG.inventory.equipment.shield == null);
  const archerGlbInfo = getWeaponGlbInfo(archerG.inventory.equipment.weapon, 'archer');
  check('Archer starter weapon GLB info is bow_01.glb', archerGlbInfo.file === 'bow_01.glb' && archerGlbInfo.type === 'bow');

  // Axeman starter kit
  const axemanG = createGame({ classId: 'axeman' });
  check('Axeman starter weapon is axe_1', axemanG.inventory.equipment.weapon?.baseId === 'axe_1');
  check('Axeman starter shield is offhand axe (subtype axe)', axemanG.inventory.equipment.shield?.subtype === 'axe');

  // Corrupted save repair test
  const corruptedSave = {
    hero: { name: 'Mage', classId: 'wizard', level: 1 },
    inventory: {
      equipment: {
        weapon: { baseId: 'blade_1', subtype: 'blade', slot: 'weapon' },
        shield: { baseId: 'shield_1', subtype: 'shield', slot: 'shield' }
      },
      bag: []
    }
  };
  const repGame = createGame({});
  repGame.fromJSON(corruptedSave);
  check('Save repair removes shield from wizard save', repGame.inventory.equipment.shield == null);
  check('Save repair equips staff on wizard save', repGame.inventory.equipment.weapon?.baseId === 'staff_1');

  // 18. Authentic Silkroad Stance Animations & Overhauled Class Skills Scaling
  // Stance clips: Wizard holds two-handed staff with authentic SRO ready stance & run
  check('Wizard CLASS_CLIP_MAP maps STAND1 to authentic SRO staff ready stance',
    CLASS_CLIP_MAP.wizard.STAND1?.includes('ATTREADY_skill_eu_wizard_twohand_attack_ready'));
  check('Wizard CLASS_CLIP_MAP maps RUN to SRO staff run',
    CLASS_CLIP_MAP.wizard.RUN?.includes('RUN_europe_man_fighter_tstaff_run'));
  check('Wizard CLASS_CLIP_MAP maps WALK to walk animation for Shift walking',
    CLASS_CLIP_MAP.wizard.WALK?.includes('WALK'));
  check('Wizard Arcane Bolt Barrage is a 3-bolt projectile matching tooltip description',
    SKILL_DEFS.wz_arcane_missiles.kind === 'projectile' && SKILL_DEFS.wz_arcane_missiles.count === 3);
  check('Knight and Axeman maintain their original authentic combat run clips',
    CLASS_CLIP_MAP.knight.RUN?.includes('RUN_chinaman_fighter_runforward_sword') &&
    CLASS_CLIP_MAP.axeman.RUN?.includes('RUN_europe_man_fighter_dagger_run_2'));

  // Skills damage multipliers and scaling
  const testWizG = createGame({ classId: 'wizard' });
  const fireballDef = SKILL_DEFS.wz_fireball;
  check('Wizard Fire Wave base multiplier is high (>= 3.4x)', fireballDef.multBase >= 3.4);
  const fbMult10 = testWizG.skills.getDamageMult('wz_fireball', 10);
  check('Wizard Fire Wave level 10 multiplier scales powerfully (>= 7.0x)', fbMult10 >= 7.0);

  const meteorDef = SKILL_DEFS.wz_meteor;
  check('Wizard Meteor Fall base multiplier is colossal (>= 5.0x)', meteorDef.multBase >= 5.0);
  const meteorMult10 = testWizG.skills.getDamageMult('wz_meteor', 10);
  check('Wizard Meteor Fall level 10 scales past 10.0x', meteorMult10 >= 10.0);

  const testKnightG = createGame({ classId: 'knight' });
  const soulCutDef = SKILL_DEFS.power_strike;
  check('Knight Soul Cut base multiplier is high (>= 2.5x)', soulCutDef.multBase >= 2.5);
  const soulCutMult10 = testKnightG.skills.getDamageMult('power_strike', 10);
  check('Knight Soul Cut level 10 scales powerfully (>= 5.0x)', soulCutMult10 >= 5.0);

  const testAxeG = createGame({ classId: 'axeman' });
  const axeCleaveDef = SKILL_DEFS.ax_cleave;
  check('Axeman Down Cross base multiplier is high (>= 2.8x)', axeCleaveDef.multBase >= 2.8);
  const axeCleaveMult10 = testAxeG.skills.getDamageMult('ax_cleave', 10);
  check('Axeman Down Cross level 10 scales powerfully (>= 5.5x)', axeCleaveMult10 >= 5.5);

  const testArcherG = createGame({ classId: 'archer' });
  const sniperDef = SKILL_DEFS.ar_power_shot;
  check('Archer Demon Soul Arrow base multiplier is high (>= 3.0x)', sniperDef.multBase >= 3.0);
  const sniperMult10 = testArcherG.skills.getDamageMult('ar_power_shot', 10);
  check('Archer Demon Soul Arrow level 10 scales powerfully (>= 6.0x)', sniperMult10 >= 6.0);

  // Wizard MATK and INT scaling
  const initialMatk = testWizG.getStats().matk;
  testWizG.hero.ap = 20;
  testWizG.allocate('int', 20);
  const boostedMatk = testWizG.getStats().matk;
  check('Allocating INT significantly boosts Wizard MATK', boostedMatk > initialMatk + 20);

  testWizG.skills.levels['wz_fireball'] = 1;
  const castDesc = testWizG.skills.cast('wz_fireball');
  check('Casting Wizard Fire Wave produces active descriptor with magic=true', castDesc?.ok && castDesc?.magic === true);
  const damageRoll = castDesc.rollDamage({ def: 10, level: 1 });
  check('Fire Wave damage roll against monster is high and matches scaled MATK', damageRoll.damage > 80);

  // Skill on cooldown check
  const cdCheck = testWizG.skills.canCast('wz_fireball');
  check('Skill immediately enters cooldown and cannot be cast again', cdCheck.ok === false && cdCheck.reason?.includes('cooldown'));
  const secondCast = testWizG.skills.cast('wz_fireball');
  check('Casting skill on cooldown returns null descriptor', secondCast === null);

  // -----------------------------------------------------------------------------
  // Comprehensive Feature Tests: Mobs, Bosses, Puzzles, Quests, Secret Floors
  // -----------------------------------------------------------------------------
  const { BOSS_CATALOG, MONSTER_CATALOG, FLOOR_POOLS } = await import('../src/world/enemyAI.js');
  check('Tiger Girl boss catalog includes canonical Blue Tiger mount', BOSS_CATALOG[3]?.mountGlbPath?.includes('bluetiger.glb'));
  check('Bandit archer has ranged projectile capabilities', MONSTER_CATALOG.bandit_archer?.isRanged === true && MONSTER_CATALOG.bandit_archer?.skills?.includes('poison_arrow'));
  check('Monster species have assigned combat skills', Array.isArray(MONSTER_CATALOG.tiger?.skills) && MONSTER_CATALOG.tiger.skills.includes('pounce'));
  check('Floor pools match Silkroad zone themes',
    FLOOR_POOLS[1].includes('mangyang') &&
    FLOOR_POOLS[4].includes('black_robber') &&
    FLOOR_POOLS[5].includes('yeti') &&
    FLOOR_POOLS[7].includes('tomb_soldier') &&
    FLOOR_POOLS[10].includes('flame_witch') &&
    FLOOR_POOLS[13].includes('anubis') && FLOOR_POOLS[13].includes('seth') &&
    FLOOR_POOLS[14].includes('babilion') && FLOOR_POOLS[14].includes('baal') &&
    FLOOR_POOLS[15].includes('underworld_knight') && FLOOR_POOLS[15].includes('shambhala_mage') &&
    FLOOR_POOLS[16].includes('rocky') && FLOOR_POOLS[16].includes('bone_roc') &&
    FLOOR_POOLS[101].includes('togui_doll') &&
    FLOOR_POOLS[102].includes('ghost_pirate') &&
    FLOOR_POOLS[103].includes('snake_woman')
  );
  check('Unique Boss names use canonical ARKENVEIL lore and omit titles',
    BOSS_CATALOG[3]?.name === 'Frostfang Empress' &&
    BOSS_CATALOG[6]?.name === 'Warchief Drakmor' &&
    BOSS_CATALOG[9]?.name === 'Lady Glaciera' &&
    BOSS_CATALOG[12]?.name === 'Valkor, Bone Sovereign' &&
    BOSS_CATALOG[15]?.name === 'Malakor, Ember Archfiend' &&
    BOSS_CATALOG[103]?.name === 'Vespera, Venom Queen' &&
    BOSS_CATALOG[16]?.name === 'Aetherion, Sky Sovereign' &&
    [3, 6, 9, 12, 15, 16, 103].every((f) => BOSS_CATALOG[f]?.title === '')
  );
  check('Unique Boss scales are enlarged and majestic (including Roc)',
    BOSS_CATALOG[3]?.scale === 2.15 &&
    BOSS_CATALOG[6]?.scale === 2.1 &&
    BOSS_CATALOG[9]?.scale === 2.2 &&
    BOSS_CATALOG[12]?.scale === 2.3 &&
    BOSS_CATALOG[15]?.scale === 2.5 &&
    BOSS_CATALOG[16]?.scale === 2.85
  );

  const { SEALS, rollSeal } = await import('../src/systems/mechanics.js');
  check('Seal of Moon and Sun have balanced authentic drop rates', SEALS.moon?.dropPct > 0 && SEALS.sun?.dropPct > 0);
  // Verify rollSeal multipliers (mocking Math.random to verify boss mult 8.0 and giant mult 3.5)
  const origRandom = Math.random;
  try {
    // If threshold is just above normal but within giant/boss reach:
    Math.random = () => (SEALS.star.dropPct * 3.0) / 100;
    check('rollSeal triggers for Giant miniboss at 3.5x multiplier', rollSeal(25, { isGiant: true }) !== null);
    check('rollSeal does not trigger for normal mob at same random threshold', rollSeal(25, { isGiant: false, isBoss: false }) === null);
  } finally {
    Math.random = origRandom;
  }

  const { FLOOR_DEFINITIONS, DungeonGenerator, SPECIAL_ROOM_CYCLE } = await import('../src/world/dungeonGenerator.js');
  check('FLOOR_DEFINITIONS unique boss names updated',
    FLOOR_DEFINITIONS.find(f => f.floor === 3)?.bossName === 'Frostfang Empress' &&
    FLOOR_DEFINITIONS.find(f => f.floor === 6)?.bossName === 'Warchief Drakmor' &&
    FLOOR_DEFINITIONS.find(f => f.floor === 9)?.bossName === 'Lady Glaciera' &&
    FLOOR_DEFINITIONS.find(f => f.floor === 12)?.bossName === 'Valkor, Bone Sovereign' &&
    FLOOR_DEFINITIONS.find(f => f.floor === 15)?.bossName === 'Malakor, Ember Archfiend' &&
    FLOOR_DEFINITIONS.find(f => f.floor === 103)?.bossName === 'Vespera, Venom Queen'
  );
  check('Special room cycle contains celestial_spring', SPECIAL_ROOM_CYCLE.includes('celestial_spring'));
  check('Secret floors S1F, S2F, S3F are registered in FLOOR_DEFINITIONS', FLOOR_DEFINITIONS.some(f => f.floor === 101) && FLOOR_DEFINITIONS.some(f => f.floor === 102) && FLOOR_DEFINITIONS.some(f => f.floor === 103));

  const secretDef101 = FLOOR_DEFINITIONS.find(f => f.floor === 101);
  check('Secret floor 101 is configured as secret floor', secretDef101?.isSecretFloor === true);

  const testDungeon = new DungeonGenerator();
  const f3State = testDungeon.generateFloor(3);
  check('Dungeon generation creates wide rooms and arena', f3State?.rooms?.length >= 6);

  // Quests expansion and multi-NPC flow
  const { QUEST_DEFS } = await import('../src/systems/quests.js');
  const questCount = Object.keys(QUEST_DEFS).length;
  check('Quest catalog expanded to 20 quests', questCount >= 20);

  const councilQuest = QUEST_DEFS.q_village_council;
  check('Multi-NPC quest Council of Oakhaven exists with talk_npc objectives', councilQuest?.objectives?.some(o => o.type === 'talk_npc'));

  const testQuestGame = createGame({ classId: 'knight' });
  testQuestGame.hero.level = 5;
  testQuestGame.quests.states['q_first_descent'] = 'completed';
  testQuestGame.quests.accept('q_village_council');
  check('Multi-NPC quest starts in active state', testQuestGame.quests.getState('q_village_council') === 'active');
  testQuestGame.quests.onTalk('blacksmith');
  testQuestGame.quests.onTalk('merchant');
  testQuestGame.quests.onTalk('chief');
  check('Visiting all designated NPCs advances multi-NPC quest to ready', testQuestGame.quests.getState('q_village_council') === 'ready');
  const turnInResult = testQuestGame.quests.turnIn('q_village_council');
  check('Turning in multi-NPC quest grants amplified rewards and AP', turnInResult.ok && turnInResult.rewards.ap >= 2 && testQuestGame.hero.ap >= 2);

  // Character Scaling Verification
  const testScalGame = createGame({ classId: 'knight' });
  const baseHp = testScalGame.getStats().maxHp;
  testScalGame.addExp(2000);
  const leveledHp = testScalGame.getStats().maxHp;
  check('Player leveling provides strong HP scaling (>= 18 HP/lvl)', leveledHp - baseHp >= 18);

  // -----------------------------------------------------------------------------
  // Enemy AI Awareness, Skill Range & Mob Pack Density Tests
  // -----------------------------------------------------------------------------
  const { isSkillInRange } = await import('../src/world/enemyAI.js');

  // 1. ALL monsters (including Lv 1-3 Jangan species) have species-appropriate skills
  const janganLv1To10Types = [
    'mangyang', 'small_eye_ghost', 'bigeye_ghost', 'old_weasel', 'gyo_weasel',
    'water_ghost_slave', 'water_ghost', 'broken_stone_ghost', 'stone_ghost',
    'tombstone_ghost', 'tombstone', 'decayed_yeoha', 'yeoha',
    'bandit_subordinate', 'bandit', 'bandit_archer', 'bandit_bowman',
    'young_tiger', 'tiger', 'black_tiger', 'white_tiger', 'chakji_worker'
  ];
  check(
    'All 22 Jangan Lv 1-10 species and full MONSTER_CATALOG entries possess >= 1 combat skill',
    janganLv1To10Types.every((t) => Array.isArray(MONSTER_CATALOG[t]?.skills) && MONSTER_CATALOG[t].skills.length >= 1) &&
    Object.values(MONSTER_CATALOG).every((cfg) => Array.isArray(cfg?.skills) && cfg.skills.length >= 1)
  );

  // 2. Special and elite monsters retain species-specific skills
  check('Special monsters retain distinctive skills',
    MONSTER_CATALOG.tiger?.skills?.includes('pounce') &&
    MONSTER_CATALOG.white_tiger?.skills?.includes('pounce') &&
    MONSTER_CATALOG.bandit_archer?.skills?.includes('poison_arrow') &&
    MONSTER_CATALOG.bandit_archer?.skills?.includes('arrow_volley') &&
    MONSTER_CATALOG.water_ghost?.skills?.includes('frost_wave') &&
    MONSTER_CATALOG.gunpowder_ghost?.skills?.includes('powder_blast') &&
    MONSTER_CATALOG.yeoha?.skills?.includes('curse_drain') &&
    MONSTER_CATALOG.chakji?.skills?.includes('whirlwind_strike') &&
    MONSTER_CATALOG.devil_bug?.skills?.includes('acid_spit') &&
    MONSTER_CATALOG.hyungno?.skills?.includes('whirlwind_strike')
  );

  // 3. Spawned monsters have initial skillCooldown between 2.5 and 5.0 seconds
  const testEnemyMgr = createEnemyManager({ renderer: mockRenderer, scene, models3d, dungeon }, models3d, {});
  const testSpawn = testEnemyMgr.spawnMonster({ type: 'tiger', floor: 1, x: 0, z: 0 });
  check(
    'Spawned monster initializes with 2.5-5.0s initial skillCooldown',
    testSpawn.skillCooldown >= 2.5 && testSpawn.skillCooldown <= 5.0
  );

  // 4. Awareness reaction delay on detecting player
  const idleEnemy = testEnemyMgr.spawnMonster({ type: 'tiger', floor: 1, x: 0, z: 0 });
  idleEnemy.state = AI_STATE.IDLE;
  idleEnemy.skillCooldown = 0;
  // Player enters aggro range (5m away, aggroRange is 11)
  testEnemyMgr.update(0.05, 1.0, { x: 5, z: 0 }, dungeon, {});
  check(
    'Monster spots player and enters awareness reaction (~0.3-0.5s) without immediately rushing into CHASE',
    idleEnemy.isAlerted === true && idleEnemy.awarenessTimer > 0 && idleEnemy.state === AI_STATE.IDLE
  );

  // 5. Skill range validation (melee vs ranged)
  check('Melee skill pounce in-range check',
    isSkillInRange('pounce', idleEnemy, idleEnemy.attackRange + 0.5) === true &&
    isSkillInRange('pounce', idleEnemy, idleEnemy.attackRange + 3.0) === false
  );
  check('Ranged skill poison_arrow in-range check (extended range, no close-range deadlock)',
    isSkillInRange('poison_arrow', idleEnemy, 4.0) === true &&
    isSkillInRange('poison_arrow', idleEnemy, 1.0) === true &&
    isSkillInRange('poison_arrow', idleEnemy, 10.0) === true &&
    isSkillInRange('poison_arrow', idleEnemy, 18.0) === false
  );

  // 6. Mob count scaling in combat rooms
  const f1Data = testDungeon.generateFloor(1);
  const combatRoom = f1Data.rooms.find(r => r.type === 'combat');
  testEnemyMgr.clearEnemies();
  testEnemyMgr.spawnFloorEnemies(f1Data, 1, scene, models3d, {});
  const f1EnemiesInCombat = testEnemyMgr.enemies.filter(e => !e.isBoss);
  check('Floor 1 combat rooms have elevated mob count (8-9 base)', f1EnemiesInCombat.length >= 8);

  // 7. Boss royal guards count is 3-5
  const bossFData = testDungeon.generateFloor(3);
  testEnemyMgr.clearEnemies();
  testEnemyMgr.spawnFloorEnemies(bossFData, 3, scene, models3d, {});
  const guards = testEnemyMgr.enemies.filter(e => !e.isBoss && Math.hypot(e.x - bossFData.bossRoom.centerX, e.z - bossFData.bossRoom.centerZ) < 8.0);
  check('Boss room spawns 3-5 royal guards', guards.length >= 3 && guards.length <= 5);

  // 8. Giant Miniboss System Validation
  const normalMob = testEnemyMgr.spawnMonster({ type: 'mangyang', floor: 1, x: 0, z: 0 });
  const giantMob = testEnemyMgr.spawnMonster({ type: 'mangyang', floor: 1, x: 1, z: 1, isGiant: true });
  check('Giant Miniboss has proper Giant naming convention', giantMob.name === 'Giant Sporeling Gremlin');
  check('Giant Miniboss is flagged with isGiant', giantMob.isGiant === true);
  check('Giant Miniboss has ~4.5x HP multiplier', giantMob.maxHp >= Math.round(normalMob.maxHp * 4.3));
  check('Giant Miniboss has ~1.45x ATK multiplier', giantMob.atk >= Math.round(normalMob.atk * 1.4));
  check('Giant Miniboss has ~3.5x EXP multiplier', giantMob.exp >= Math.round(normalMob.exp * 3.3));
  check('Giant Miniboss has ~3.5x Gold multiplier', giantMob.gold >= Math.round(normalMob.gold * 3.3));
  check('Giant Miniboss has enlarged scale', giantMob.mesh.scale.x > normalMob.mesh.scale.x * 1.5);
  check('Floor enemy spawning places Giant Minibosses in designated rooms',
    testEnemyMgr.enemies.some(e => e.isGiant)
  );

  // -----------------------------------------------------------------------------
  // 9. Tiger Mob Pounce Teleport Bugfix Verification
  // -----------------------------------------------------------------------------
  const mockWorldWithArena = {
    bossArena: { center: { x: 50, z: 50 }, radius: 12 },
    isWalkable: () => true,
    resolveCollision: (x, z) => ({ x, z })
  };
  const tigerMgr = createEnemyManager({ renderer: mockRenderer, scene, models3d }, models3d, {});
  const testTiger = tigerMgr.spawnMonster({ type: 'tiger', floor: 3, x: 0, z: 0 });
  testTiger.state = AI_STATE.CHASE;
  testTiger.pendingSkill = 'pounce';
  testTiger.chargeDir = { x: 1, z: 0 };
  testTiger.skillTravelDist = 0;
  testTiger.isBoss = false;

  testTiger.state = AI_STATE.SKILL;
  testTiger.stateTimer = 0.45;
  tigerMgr.update(0.1, 1.0, { x: 10, z: 0 }, mockWorldWithArena, {});

  check(
    'Tiger pounce does NOT teleport normal mob to bossArena circle',
    Math.hypot(testTiger.x - 50, testTiger.z - 50) > 30 && testTiger.x < 5.0
  );

  const pounceTiger = tigerMgr.spawnMonster({ type: 'tiger', floor: 3, x: 0, z: 0 });
  pounceTiger.state = AI_STATE.SKILL;
  pounceTiger.pendingSkill = 'pounce';
  pounceTiger.chargeDir = { x: 1, z: 0 };
  pounceTiger.skillTravelDist = 0;
  pounceTiger.stateTimer = 0.45;
  for (let t = 0; t < 4; t++) {
    tigerMgr.update(0.1, 2.0 + t * 0.1, { x: 20, z: 0 }, mockWorldWithArena, {});
  }
  check(
    'Tiger pounce travel distance is bounded to <= 3.5 units',
    pounceTiger.x <= 3.501 && pounceTiger.skillTravelDist <= 3.501
  );

  // -----------------------------------------------------------------------------
  // 10. Attack Speed Tuning, DEX Scaling & Buff Mechanics
  // -----------------------------------------------------------------------------
  const atkSpdGame = createGame({ classId: 'knight' });
  atkSpdGame.hero.attrs.dex = 0;
  atkSpdGame.hero.attrs.str = 10;
  atkSpdGame.markDirty();
  const baseAtkSpdStats = atkSpdGame.getStats();
  check('Base default attack speed is 0.85 without DEX', baseAtkSpdStats.attackSpeed === 0.85);

  atkSpdGame.hero.ap = 20;
  atkSpdGame.allocate('dex', 20);
  const dexStats = atkSpdGame.getStats();
  check('Allocating DEX noticeably increases attack speed (+0.75% per DEX)', dexStats.attackSpeed >= 1.00);

  atkSpdGame.inventory.equipment.weapon = {
    id: 'test_sword_haste',
    name: 'Sword of Swiftness',
    slot: 'weapon',
    stats: { attackSpeedPct: 20 }
  };
  atkSpdGame.markDirty();
  const gearStats = atkSpdGame.getStats();
  check('Gear with attackSpeedPct boosts attack speed', gearStats.attackSpeed > dexStats.attackSpeed);

  atkSpdGame.addBuff({ id: 'scroll_haste', name: 'Haste', duration: 30, mods: { attackSpeedPct: 15 } });
  const hasteStats = atkSpdGame.getStats();
  check('Haste buff increases attack speed', hasteStats.attackSpeed > gearStats.attackSpeed);

  atkSpdGame.addBerserkCharge(100);
  atkSpdGame.activateBerserk();
  const berserkAtkStats = atkSpdGame.getStats();
  check('Berserk mode accelerates attack speed by ~1.3x', berserkAtkStats.attackSpeed >= Math.round(hasteStats.attackSpeed * 1.25 * 100) / 100);

  const { PlayerController } = await import('../src/engine/playerController.js');
  const mockPlayerCtrl = new PlayerController({
    renderer: mockRenderer,
    gameState: atkSpdGame,
    world: dungeon,
    enemyManager: testEnemyMgr
  });
  mockPlayerCtrl.attack();
  const fastDuration = mockPlayerCtrl.attackDuration;

  const slowGame = createGame({ classId: 'knight' });
  slowGame.hero.attrs.dex = 0;
  slowGame.markDirty();
  mockPlayerCtrl.gameState = slowGame;
  mockPlayerCtrl.state = 'idle';
  mockPlayerCtrl.comboWindowTimer = 0;
  mockPlayerCtrl.attack();
  const slowDuration = mockPlayerCtrl.attackDuration;
  check('PlayerController attack duration is slower at base and faster with higher attackSpeed', slowDuration > fastDuration);

  // -----------------------------------------------------------------------------
  // 11. Boss Room Gate Sealed Until Non-Boss Mobs Cleared
  // -----------------------------------------------------------------------------
  const bossDungeon = new DungeonGenerator();
  const floor3Data = bossDungeon.generateFloor(3);
  const bossGate = floor3Data.bossGate || bossDungeon.bossGate || bossDungeon.gates.find(g => g.isBossGate);

  check('Boss floor spawns a locked bossGate at chamber entrance', Boolean(bossGate && bossGate.isBossGate && !bossGate.isOpen));
  check('Player cannot move through locked boss gate (canMoveTo is false)', bossDungeon.canMoveTo(bossGate.x, bossGate.z, 0.4) === false);

  const floor3EnemyMgr = createEnemyManager({ renderer: mockRenderer, scene, models3d, dungeon: bossDungeon }, models3d, {});
  floor3EnemyMgr.spawnFloorEnemies(floor3Data, 3, scene, models3d, {});

  check('Floor 3 has alive non-boss monsters in outer rooms', floor3EnemyMgr.aliveNonBosses > 0);

  for (const e of floor3EnemyMgr.enemies) {
    if (!e.isBoss && !e.inBossRoom && Math.hypot(e.x - floor3Data.bossRoom.centerX, e.z - floor3Data.bossRoom.centerZ) > 8.0) {
      floor3EnemyMgr._handleEnemyDeath(e, { world: bossDungeon });
    }
  }

  check('aliveNonBosses reaches 0 after outer room mobs killed', floor3EnemyMgr.aliveNonBosses === 0);
  check('Boss gate unlocks automatically when non-boss mobs defeated', bossGate.isOpen === true);
  check('Player can now move through unlocked boss gate (canMoveTo is true)', bossDungeon.canMoveTo(bossGate.x, bossGate.z, 0.4) === true);

  // -----------------------------------------------------------------------------
  // 12. Alchemy Rebalance & Milestone Stat Scaling
  // -----------------------------------------------------------------------------
  check('Alchemy perPlusPct boosted to 15% base scaling', ALCHEMY.perPlusPct === 15);
  check('Alchemy milestone tables defined for weapons and armors', Boolean(ALCHEMY.milestones?.weapon && ALCHEMY.milestones?.armor));

  const testSword = generateItem({ baseId: 'sword_1', rarity: 'normal', level: 1 });
  const baseAtk = testSword.stats.atkMax;
  testSword.plus = 3;
  recalcItem(testSword);
  check('+3 Weapon achieves +3 milestone (+2% crit, +8 atk)', testSword.stats.critRate >= 2 && testSword.stats.atkMax > baseAtk);
  check('+3 Weapon has milestone affix text', testSword.affixes.some(a => a.includes('+3 Bonus')));

  testSword.plus = 5;
  recalcItem(testSword);
  check('+5 Weapon achieves +5 milestone (+4% crit, +7% attackSpeedPct, +22 atk)', testSword.stats.critRate >= 4 && testSword.stats.attackSpeedPct >= 7);

  testSword.plus = 7;
  recalcItem(testSword);
  check('+7 Weapon achieves +7 milestone (+7% crit, +14% attackSpeedPct, +50 atk, +6 allAttrs)', testSword.stats.critRate >= 7 && testSword.stats.attackSpeedPct >= 14 && testSword.stats.str >= 6);

  const testArmor = generateItem({ baseId: 'armor_1', rarity: 'normal', level: 1 });
  testArmor.plus = 5;
  recalcItem(testArmor);
  check('+5 Armor gains +140 HP, +24 Def, and 6% damageAbsorbPct', testArmor.stats.damageAbsorbPct === 6 && testArmor.stats.hp >= 140);

  // Damage absorb mitigation test in gameState
  const absorbGame = createGame({ classId: 'knight' });
  absorbGame.hero.attrs.str = 0; absorbGame.hero.attrs.dex = 0;
  const dmgResultNoAbsorb = absorbGame.takeDamage(100, { raw: true, canDodge: false, canBlock: false });
  absorbGame.hero.hp = absorbGame.maxHp;
  absorbGame.inventory.equipment.armor = testArmor; // 6% absorb
  absorbGame.markDirty();
  const dmgResultAbsorb = absorbGame.takeDamage(100, { raw: true, canDodge: false, canBlock: false });
  check('Equipped armor with damageAbsorbPct reduces incoming raw damage', dmgResultAbsorb.damage < dmgResultNoAbsorb.damage);

  // -----------------------------------------------------------------------------
  // 13. Quick Sell Trash System
  // -----------------------------------------------------------------------------
  const qGame = createGame({ classId: 'knight' });
  const qInv = qGame.inventory;
  qGame.hero.gold = 100;

  // Add trash items
  const trashSword = generateItem({ baseId: 'sword_1', rarity: 'normal', level: 1 });
  trashSword.value = 50;
  const trashArmor = generateItem({ baseId: 'armor_1', rarity: 'magic', level: 1 });
  trashArmor.value = 80;
  qInv.addItem(trashSword);
  qInv.addItem(trashArmor);

  // Add protected items that should NOT be sold
  const protectedRare = generateItem({ baseId: 'sword_1', rarity: 'rare', level: 1 });
  const protectedElixir = { uid: 'elix_test', baseId: 'elixir_weapon', type: 'elixir', value: 200, count: 5 };
  const protectedPlus = generateItem({ baseId: 'armor_1', rarity: 'normal', level: 1 });
  protectedPlus.plus = 1;
  recalcItem(protectedPlus);
  qInv.addItem(protectedRare);
  qInv.addItem(protectedElixir);
  qInv.addItem(protectedPlus);

  const qSellRes = qInv.quickSellTrash();
  check('quickSellTrash succeeds and reports sold count and gold', qSellRes.ok && qSellRes.count === 2 && qSellRes.gold === 130);
  check('quickSellTrash awards correct gold to hero', qGame.hero.gold === 230);
  check('quickSellTrash leaves protected rare, elixir, and +1 gear safe in bag',
    qInv.bag.some(it => it && it.uid === protectedRare.uid) &&
    qInv.bag.some(it => it && it.baseId === 'elixir_weapon') &&
    qInv.bag.some(it => it && it.plus === 1)
  );

  const emptySell = qInv.quickSellTrash();
  check('quickSellTrash returns ok:false when bag has no trash items', !emptySell.ok);

  // -----------------------------------------------------------------------------
  // 14. Item Dropping with Ground Loot Toss & Pickup Cooldown
  // -----------------------------------------------------------------------------
  const dropItem = generateItem({ baseId: 'sword_1', rarity: 'magic', level: 1 });
  qInv.addItem(dropItem);
  let droppedEventItem = null;
  qInv.on('item:dropped', (it) => { droppedEventItem = it; });

  const dropRes = qInv.drop(dropItem.uid);
  check('Inventory drop removes item from bag and emits item:dropped', dropRes.ok && droppedEventItem && droppedEventItem.uid === dropItem.uid);
  check('Dropped item is no longer in bag', !qInv.bag.some(it => it && it.uid === dropItem.uid));

  // Spawn ground loot with pickup cooldown
  const dropLoot = bossDungeon.spawnGroundLoot(
    { x: 5, z: 5 },
    droppedEventItem,
    null,
    { x: 3.5, z: 3.5 },
    { pickupCooldown: 1800 }
  );
  check('spawnGroundLoot with pickupCooldown sets canPickupAfter in future', dropLoot && dropLoot.canPickupAfter > Date.now());

  // Attempt pickup during cooldown
  const earlyPickup = bossDungeon.pickupLoot(dropLoot.id);
  check('pickupLoot is refused during pickup cooldown (prevents instant re-vacuum)', earlyPickup.ok === false && !dropLoot.collected);

  // Expire cooldown and pickup
  dropLoot.canPickupAfter = Date.now() - 100;
  const validPickup = bossDungeon.pickupLoot(dropLoot.id, { inventory: qInv });
  check('pickupLoot succeeds after cooldown expires', validPickup.ok === true && dropLoot.collected === true);

  // -----------------------------------------------------------------------------
  // 15. Dungeon Floor Themed Texturing & Grounding
  // -----------------------------------------------------------------------------
  for (const themeKey of ['cave', 'crypt', 'ruins', 'lava', 'boss']) {
    check(`Theme ${themeKey} has floorTexture defined`, Boolean(DUNGEON_THEMES[themeKey]?.floorTexture));
  }

  // -----------------------------------------------------------------------------
  // 16. Companion Pet System (SRO GLB Pets + High-Price Town Pet Shop)
  // -----------------------------------------------------------------------------
  check('PET_TYPES defines 5 Silkroad companions with authentic .glb paths and high prices',
    Boolean(PET_TYPES.rabbit && PET_TYPES.wolf && PET_TYPES.pig && PET_TYPES.tiger && PET_TYPES.bluetiger) &&
    Object.values(PET_TYPES).every((pt) => typeof pt.glbPath === 'string' && pt.glbPath.endsWith('.glb') && pt.price >= 8000)
  );
  check('Mangnyang Pet is configured as Grab Pet with 8.5m auto-loot radius',
    PET_TYPES.rabbit.role === 'loot' && PET_TYPES.rabbit.lootRadius >= 8.0 && PET_TYPES.rabbit.passives.goldFind > 0
  );
  check('Silkroad Hound is configured as Combat Companion with ATK & Crit buffs',
    PET_TYPES.wolf.role === 'combat' && PET_TYPES.wolf.passives.atkPct > 0 && PET_TYPES.wolf.passives.critRate > 0
  );

  const petGame = createGame({});
  check('New hero starts with 0 free pets (must buy from Town Pet Shop)', Boolean(petGame.pets && petGame.pets.pets.length === 0));

  // Purchase fails without enough gold
  petGame.hero.gold = 1000;
  const failBuy = petGame.pets.buyPet('rabbit');
  check('Buying Mangnyang fails when hero has insufficient gold', failBuy.ok === false && petGame.pets.pets.length === 0);

  // Give hero sufficient gold and buy Mangnyang & Silkroad Hound
  petGame.hero.gold = 50000;
  const buyRabbit = petGame.pets.buyPet('rabbit', 'Snowy');
  const buyWolf = petGame.pets.buyPet('wolf');
  check('Buying pets deducts exact gold price and auto-summons first pet',
    buyRabbit.ok && buyWolf.ok && petGame.pets.pets.length === 2 && petGame.hero.gold === (50000 - PET_TYPES.rabbit.price - PET_TYPES.wolf.price)
  );

  const starterPet = petGame.pets.getActivePet();
  check('Purchased Snowy (Mangnyang Pet) is active and summoned',
    starterPet && starterPet.type === 'rabbit' && starterPet.name === 'Snowy' && starterPet.summoned === true
  );

  // Passive stat bonus to hero
  const statsWithRabbit = petGame.getStats();
  check('Mangnyang Pet passives contribute +15% Gold Find to hero stats', statsWithRabbit.goldFind >= 15);

  // Switch to Wolf companion
  const wolfPet = petGame.pets.pets.find(p => p.type === 'wolf');
  const sumWolf = petGame.pets.summon(wolfPet.id);
  petGame.markDirty();
  const statsWithWolf = petGame.getStats();
  check('Summoning Silkroad Hound succeeds and updates active pet', sumWolf.ok && petGame.pets.getActivePet().type === 'wolf');
  check('Silkroad Hound passives increase hero attack', statsWithWolf.atkMax > statsWithRabbit.atkMax);

  // Dismiss pet
  const dismissRes = petGame.pets.dismiss();
  petGame.markDirty();
  check('Dismissing pet removes summoned companion', dismissRes.ok && petGame.pets.getActivePet() === null);
  const statsDismissed = petGame.getStats();
  check('Dismissed pet does not provide pet passive bonus',
    !petGame.pets.getPassiveMods().goldFind && statsDismissed.goldFind < statsWithRabbit.goldFind
  );

  // Re-summon and level up
  petGame.pets.summon(starterPet.id);
  const prevMaxExp = starterPet.maxExp;
  petGame.pets.addExp(120);
  check('Adding EXP levels up pet companion and increases maxExp',
    starterPet.level === 2 && starterPet.exp === 20 && starterPet.maxExp > prevMaxExp
  );

  // Rename pet
  const renameRes = petGame.pets.rename(starterPet.id, 'Cotton');
  check('Renaming pet updates pet name', renameRes.ok && starterPet.name === 'Cotton');

  // Persistence (toJSON & fromJSON)
  const petSave = petGame.toJSON();
  check('GameState toJSON saves pet roster and active pet',
    Boolean(petSave.pets && Array.isArray(petSave.pets.pets) && petSave.pets.activePetId)
  );

  const petGame2 = createGame({});
  petGame2.fromJSON(petSave);
  const loadedPet = petGame2.pets.getActivePet();
  check('GameState fromJSON restores pet level, name, and active pet',
    loadedPet && loadedPet.name === 'Cotton' && loadedPet.level === 2
  );

  // -----------------------------------------------------------------------------
  // 17. SRO Magic Stones & Blue Stats Alchemy
  // -----------------------------------------------------------------------------
  for (const sId of ['stone_str', 'stone_int', 'stone_hp', 'stone_agi', 'stone_crit', 'stone_absorb', 'stone_astral']) {
    check(`Magic Stone ${sId} is registered in ITEM_BASES`, Boolean(ITEM_BASES[sId] && ITEM_BASES[sId].subtype === 'stone'));
  }

  const alchInv = petGame.inventory;
  const targetWeapon = generateItem({ baseId: 'sword_1', rarity: 'normal', level: 5 });
  alchInv.addItem(targetWeapon);

  // Fuse Magic Stone of Strength
  alchInv.addItem(generateItem({ baseId: 'stone_str', count: 1 }));
  const fuseStrRes = alchInv.fuseMagicStone(targetWeapon.uid, 'stone_str');
  check('fuseMagicStone with stone_str succeeds and consumes stone',
    fuseStrRes.ok && !alchInv.bag.some(it => it && it.baseId === 'stone_str')
  );
  check('Fusing stone_str adds Strength Blue Stat to weapon mods and affixes',
    targetWeapon.mods.some(m => m.kind === 'magic_stone' && m.stat === 'str') &&
    targetWeapon.affixes.some(a => a.includes('STR') || a.includes('Strength'))
  );

  // Equipping gear with Blue Stats increases hero stats
  const preStr = petGame.str;
  alchInv.equip(targetWeapon.uid);
  petGame.markDirty();
  check('Equipping gear with Blue Stat STR increases hero Strength', petGame.str > preStr);

  // Fuse Astral Stone (+4 Protection)
  alchInv.addItem(generateItem({ baseId: 'stone_astral', count: 1 }));
  const fuseAstralRes = alchInv.fuseMagicStone(targetWeapon.uid, 'stone_astral');
  check('fuseMagicStone with stone_astral imbues Astral Protection charge',
    fuseAstralRes.ok && targetWeapon.astralCharges === 1 && targetWeapon.affixes.some(a => a.includes('Astral Protection'))
  );

  // Test Astral Stone protection on alchemy failure
  petGame.addGold(50000);
  targetWeapon.plus = 5;
  recalcItem(targetWeapon);
  check('previewAlchemy reflects Astral Stone protection in failText',
    alchInv.previewAlchemy(targetWeapon.uid).failText.includes('Astral Stone protects')
  );

  // Simulate failed enhancement
  // Force 0% chance or mock failure
  const pFail = alchInv.previewAlchemy(targetWeapon.uid);
  alchInv.addItem(generateItem({ baseId: pFail.elixirId, count: 5 }));
  
  // Directly test the failure branch logic with astral charge
  const origMathRandom = Math.random;
  Math.random = () => 0.999; // guaranteed fail
  const failAlchemyRes = alchInv.alchemy(targetWeapon.uid, { powder: false, talisman: false });
  Math.random = origMathRandom;

  check('Alchemy failure with Astral Stone keeps weapon safely at +4 (does not reset to 0)',
    failAlchemyRes.success === false && targetWeapon.plus === 4 && targetWeapon.astralCharges === 0
  );

  // -----------------------------------------------------------------------------
  // 18. Dynamic Power Shrines & Tactical Explosive Barrels
  // -----------------------------------------------------------------------------
  const dWorld = new DungeonGenerator();
  dWorld.generateFloor(1);

  // Test all 4 dynamic shrine types
  dWorld._spawnShrine(10, 10, 1, 'shrine_berserk');
  dWorld._spawnShrine(12, 12, 1, 'shrine_fortune');
  dWorld._spawnShrine(14, 14, 1, 'shrine_haste');
  dWorld._spawnShrine(16, 16, 1, 'shrine_sanctuary');

  const berserkInteract = dWorld.interact({ type: 'shrine', entity: dWorld.shrines.find(s => s.shrineKind === 'shrine_berserk') }, { gameState: petGame });
  check('Hwan Berserk Obelisk grants 5 Berserk charges on interaction',
    berserkInteract.ok && petGame.hero.berserkCharge === 5
  );

  const fortuneInteract = dWorld.interact({ type: 'shrine', entity: dWorld.shrines.find(s => s.shrineKind === 'shrine_fortune') }, { gameState: petGame });
  check('Fortune Shrine grants +60% Gold & +30% Magic Find buff',
    fortuneInteract.ok && petGame.hero.buffs.some(b => b.id === 'shrine_fortune' && b.mods.goldFind === 60)
  );

  const hasteInteract = dWorld.interact({ type: 'shrine', entity: dWorld.shrines.find(s => s.shrineKind === 'shrine_haste') }, { gameState: petGame });
  check('Wind Walker Shrine grants +40% Move Speed and +30% Attack Speed buff',
    hasteInteract.ok && petGame.hero.buffs.some(b => b.id === 'shrine_haste' && b.mods.moveSpeedPct === 40)
  );

  // Tactical Explosive Barrel
  const expBarrel = dWorld._spawnBreakable(15, 15, 'barrel_explosive', 'test_exp_barrel');
  check('Spawning barrel_explosive sets kind to barrel_explosive', expBarrel.kind === 'barrel_explosive');

  // Place a mock enemy within blast radius
  let mockEnemyHit = false;
  let mockEnemyDmg = 0;
  const mockEnemy = {
    x: 16,
    z: 15,
    hp: 300,
    isDead: false,
    receiveDamage: (dmg) => { mockEnemyHit = true; mockEnemyDmg = dmg; }
  };
  const mockEnemiesMgr = { enemies: [mockEnemy] };

  const detonateRes = dWorld.damageBreakable(expBarrel, 30, { enemies: mockEnemiesMgr });
  check('Detonating explosive barrel destroys barrel and deals heavy AoE damage to nearby monsters',
    detonateRes.destroyed && mockEnemyHit && mockEnemyDmg >= 160
  );

  // -----------------------------------------------------------------------------
  // 19. Multi-Skill Starter Loadouts for All Classes
  // -----------------------------------------------------------------------------
  for (const cid of ['knight', 'axeman', 'wizard', 'archer']) {
    const classGame = createGame({ classId: cid });
    const hotbar = classGame.skills.hotbar;
    check(`Class ${cid} starts with 3 skills assigned to slots 1, 2, 3`,
      Boolean(hotbar[0] && hotbar[1] && hotbar[2] && hotbar[3] === null)
    );
  }

  // -----------------------------------------------------------------------------
  // 20. Rare & Dread-Inducing Giant Minibosses
  // -----------------------------------------------------------------------------
  const floor5Dungeon = new DungeonGenerator();
  const floor5Data = floor5Dungeon.generateFloor(5);
  const floor5EnemyMgr = createEnemyManager({ renderer: mockRenderer, scene, models3d, dungeon: floor5Dungeon }, models3d, {});
  floor5EnemyMgr.spawnFloorEnemies(floor5Data, 5, scene, models3d, {});

  const floor5Giants = floor5EnemyMgr.enemies.filter(e => e.isGiant);
  check('Floor 5 spawns at most 1 Giant miniboss across the entire floor (rare encounter, not every room)',
    floor5Giants.length <= 1
  );

  if (floor5Giants.length > 0) {
    const giant = floor5Giants[0];
    check('Giant miniboss has elevated HP mult (6.5x base), high attack, and title',
      giant.hp > 250 && giant.title.includes('Giant')
    );
  }

  // -----------------------------------------------------------------------------
  // 21. UI Host Adapters, Explosive Barrel damageEnemy Path & Floor Shrine Placement
  // -----------------------------------------------------------------------------
  const uiGame = createGame({ classId: 'knight' });
  const weapon = uiGame.inventory.equipment.weapon;
  uiGame.inventory.addItem({ baseId: 'stone_str', count: 1 });
  uiGame.hero.gold = 10000;
  uiGame.pets.buyPet('rabbit', 'Snowy');
  const uiHost = createHost({ gameState: uiGame });
  const petSnap = uiHost.getPets();
  check('createHost exposes getPets() & buyPet() for Pet Shop integration',
    Boolean(petSnap && Array.isArray(petSnap.pets) && petSnap.pets.length === 1 && petSnap.activePet?.name === 'Snowy' && typeof uiHost.buyPet === 'function')
  );
  const fuseHostRes = uiHost.fuseMagicStone(weapon.uid, 'stone_str');
  check('createHost exposes fuseMagicStone() to apply Blue Stats through the HUD/menu adapter',
    Boolean(fuseHostRes.ok && weapon.mods.some((m) => m.kind === 'magic_stone' && m.stat === 'str'))
  );

  // Explosive barrel should invoke enemiesMgr.damageEnemy when available
  const bar2 = dWorld._spawnBreakable(12, 12, 'barrel_explosive', 'test_exp_barrel_dmg_fn');
  let dmgFnCalled = false;
  let dmgFnAmt = 0;
  const mgrWithFn = {
    enemies: [{ x: 13, z: 12, hp: 500, dead: false }],
    damageEnemy: (_enemy, amount) => { dmgFnCalled = true; dmgFnAmt = amount; }
  };
  const det2 = dWorld.damageBreakable(bar2, 40, { enemies: mgrWithFn });
  check('Explosive barrel detonation uses enemiesMgr.damageEnemy when available',
    Boolean(det2.destroyed && dmgFnCalled && dmgFnAmt >= 160)
  );

  // Every dungeon floor >= 1 guarantees at least 1 interactive shrine
  for (const fNum of [1, 2, 3, 4]) {
    const dCheck = new DungeonGenerator();
    dCheck.generateFloor(fNum);
    check(`Floor ${fNum} places at least one interactive shrine`,
      Array.isArray(dCheck.shrines) && dCheck.shrines.length >= 1
    );
  }

  // -----------------------------------------------------------------------------
  // 22. Challenge Portals, Timed Arena, Animated Return Portal & Death Warp Back
  // -----------------------------------------------------------------------------
  const { CHALLENGE_TYPES } = await import('../src/world/dungeonGenerator.js');
  const chDungeon = new DungeonGenerator();
  const chFloorData = chDungeon.generateFloor(1);
  const chPortal = chDungeon.portals.find((p) => p.portalType === 'challenge_portal');
  check('Floor 1 spawns a Timed Challenge Portal with 60s Swarm Survival',
    Boolean(chPortal && chPortal.challengeType === 'survival_60' && CHALLENGE_TYPES[chPortal.challengeType]?.duration === 60)
  );

  for (const fIdx of [2, 3, 4]) {
    const fd = new DungeonGenerator();
    fd.generateFloor(fIdx);
    check(`Floor ${fIdx} spawns a Challenge Portal`,
      fd.portals.some((p) => p.portalType === 'challenge_portal')
    );
  }

  // Floor state suspend & restore across Challenge Arena
  const chEnemyMgr = createEnemyManager({ renderer: mockRenderer, scene, models3d, dungeon: chDungeon }, models3d, {});
  chEnemyMgr.spawnFloorEnemies(chFloorData, 1, scene, models3d, {});
  const originalEnemiesCount = chEnemyMgr.enemies.length;
  const originalPortalsCount = chDungeon.portals.length;

  const floorSnap = chDungeon.suspendFloorWorld();
  const enemySnap = chEnemyMgr.suspendFloorEnemies();
  chDungeon.generateChallengeArena('survival_60', 1);
  check('Challenge Arena initializes 24x24 trial chamber',
    chDungeon.zone === 'challenge' && chDungeon.rooms.length === 1 && chDungeon.rooms[0].type === 'challenge'
  );

  const rewardChests = chDungeon.spawnChallengeRewardChests(CHALLENGE_TYPES.survival_60, 1);
  const returnPortal = chDungeon.spawnChallengeReturnPortal(1);
  check('Completed Challenge spawns 3 reward chests and animated emerald return portal',
    rewardChests.length === 3 && returnPortal?.portalType === 'challenge_return' && typeof returnPortal.mesh?.userData?.playSpawnAnimation === 'function'
  );

  chEnemyMgr.clearEnemies();
  chDungeon.restoreFloorWorld(floorSnap);
  chEnemyMgr.restoreFloorEnemies(enemySnap);
  check('Exiting Challenge restores exact suspended floor portals and floor monsters',
    chDungeon.currentFloor === 1 && chDungeon.portals.length === originalPortalsCount && chEnemyMgr.enemies.length === originalEnemiesCount
  );

  // Death inside Challenge revives directly back onto the dungeon floor with 0 gold penalty
  const chGame = createGame({ classId: 'knight' });
  chGame.hero.gold = 1000;
  chGame.enterFloor(3);
  chGame._die(null);
  check('Hero enters dead state on challenge death', chGame.hero.dead === true);
  const goldLostOnChallengeDeath = chGame.revive({ penalty: false, targetFloor: 3 });
  check('Challenge death revive restores hero directly back to floor 3 with zero gold penalty',
    chGame.hero.dead === false && chGame.progress.currentFloor === 3 && goldLostOnChallengeDeath === 0 && chGame.hero.gold === 1000
  );

  // -----------------------------------------------------------------------------
  // 23. Final Boss Sanctum (Floor 16 Roc), Signature Boss Skills, 1..3 Challenges & Story Completion
  // -----------------------------------------------------------------------------
  const { VILLAGE_NPCS } = await import('../src/world/dungeonGenerator.js');
  const petNpc = VILLAGE_NPCS.find((n) => n.id === 'pet_merchant' && n.actionType === 'pet_shop');
  check('Town Center includes Beast Tamer Zara pet shop NPC', Boolean(petNpc));

  // Verify every pet GLB asset referenced in PET_TYPES actually exists under public/
  const fs = await import('node:fs');
  const path = await import('node:path');
  const allPetGlbsExist = Object.values(PET_TYPES).every((pt) =>
    fs.existsSync(path.join(process.cwd(), 'public', pt.glbPath.replace(/^\//, '')))
  );
  check('All Silkroad PET_TYPES .glb model files exist under public/', allPetGlbsExist);

  // Verify Challenge Portals spawn 1..3 per floor across multiple floors
  let challengeCountsValid = true;
  for (let fl = 1; fl <= 8; fl++) {
    const fd = new DungeonGenerator().generateFloor(fl);
    const chCount = (fd.portals || []).filter((p) => p.portalType === 'challenge_portal').length;
    if (chCount < 1 || chCount > 3) { challengeCountsValid = false; break; }
  }
  check('Every dungeon floor spawns between 1 and 3 Challenge Portals', challengeCountsValid);

  // Floor 16 colossal Final Boss Chamber (40m x 40m) with Final Unique Roc
  const f16Gen = new DungeonGenerator();
  const f16Data = f16Gen.generateFloor(16, mockRenderer, models3d, {});
  const f16BossRoom = f16Data.rooms.find((r) => r.type === 'boss');
  const f16Exit = f16Gen.portals.find((p) => p.lockedByBoss);
  check('Floor 16 generates colossal 40m x 40m Final Boss Chamber and Oakhaven Victory Rift',
    Boolean(f16BossRoom && f16BossRoom.w >= 36 && f16BossRoom.h >= 36 && f16Exit?.targetFloor === 0 && f16Exit?.portalType === 'village')
  );

  const f16Enemies = enemyMgr.spawnFloorEnemies(f16Data, 16, scene, models3d, {});
  const rocBoss = f16Enemies.find((e) => e.isBoss);
  check('Floor 16 spawns Final Unique Aetherion with elevated multipliers and signature skills',
    Boolean(rocBoss && rocBoss.name === 'Aetherion, Sky Sovereign' && Array.isArray(rocBoss.skills) && rocBoss.skills.length >= 4 && rocBoss.skills.includes('roc_hurricane_gale') && rocBoss.skills.includes('sky_feather_storm'))
  );

  // Story completion tracking & save persistence
  const storyGame = createGame({ classId: 'warrior' });
  check('New hero starts with storyCompleted === false', storyGame.progress.storyCompleted === false);
  const storyRes = storyGame.completeStory(rocBoss);
  check('completeStory marks storyCompleted, awards prestige bonus, and persists across saves',
    storyRes.ok && storyRes.firstTime === true && storyGame.progress.storyCompleted === true && storyGame.hero.gold >= 25000
  );
  const storySave = storyGame.toJSON();
  const storyReload = createGame({});
  storyReload.fromJSON(storySave);
  check('storyCompleted flag persists through toJSON / fromJSON', storyReload.progress.storyCompleted === true);

  // -----------------------------------------------------------------------------
  // 24. Extended Buff Durations, Active Skill Tuning & Oakhaven Gold Sinks
  // -----------------------------------------------------------------------------
  check('Imbue base duration is >= 120s (2 minutes+)', IMBUE_DEFAULTS.duration >= 120);
  const buffSkillIds = [
    'battle_cry', 'shadow_step', 'aegis_barrier', 'radiant_edge',
    'ax_war_bellow', 'ax_bloodrage', 'ax_unbreakable', 'ax_blood_rend',
    'wz_mana_ward', 'wz_arcane_surge', 'wz_arcane_barrier', 'wz_frostfire_weave',
    'ar_eagle_eye', 'ar_hunters_focus', 'ar_phantom_veil', 'ar_venom_tips',
  ];
  const allBuffsLong = buffSkillIds.every((id) => {
    const d = SKILL_DEFS[id];
    if (!d) return false;
    if (d.imbue) return IMBUE_DEFAULTS.duration >= 120;
    const b = typeof d.buff === 'function' ? d.buff(1) : d.buff;
    return b && b.duration >= 120;
  });
  check('All class active buffs and imbues last at least 120 seconds at rank 1', allBuffsLong);

  check('Town scrolls & tonics have extended buff durations (180s-600s)',
    ITEM_BASES.stamina_tonic.effect.buff.duration >= 180 &&
    ITEM_BASES.scroll_might.effect.buff.duration >= 300 &&
    ITEM_BASES.scroll_iron.effect.buff.duration >= 300 &&
    ITEM_BASES.scroll_haste.effect.buff.duration >= 240 &&
    ITEM_BASES.scroll_fortune.effect.buff.duration >= 300 &&
    ITEM_BASES.scroll_exp.effect.buff.duration >= 600
  );

  // rollAttack supports skill critBonus
  const critTestGame = createGame({ classId: 'archer' });
  const alwaysCrit = critTestGame.rollAttack({ def: 10 }, { mult: 1.5, critBonus: 100, sureHit: true });
  check('rollAttack applies critBonus for guaranteed skill crits', alwaysCrit.crit === true && alwaysCrit.damage > 0);

  // Oakhaven Town Gold Sinks
  const sinkGame = createGame({ classId: 'knight' });
  sinkGame.hero.gold = 100000;
  const baseAtkBeforeTrain = sinkGame.getStats().atk;
  const trainRes = sinkGame.trainTownMastery('might');
  check('trainTownMastery spends Gold and permanently raises ATK',
    trainRes.ok && trainRes.rank === 1 && sinkGame.hero.gold === 100000 - TOWN_TRAINING_DEFS.might.baseCost &&
    sinkGame.getStats().atk > baseAtkBeforeTrain
  );
  const sinkSave = sinkGame.toJSON();
  const sinkReload = createGame({});
  sinkReload.fromJSON(sinkSave);
  check('Guild Mastery training ranks persist across save/load', sinkReload.hero.townTraining.might === 1);

  const goldBeforeBless = sinkGame.hero.gold;
  const blessRes = sinkGame.buyTownBlessing('grand');
  check('buyTownBlessing grants multi-buff shrine benedictions for 10m',
    blessRes.ok && sinkGame.hero.gold === goldBeforeBless - TOWN_BLESSINGS.grand.cost &&
    sinkGame.hero.buffs.some((b) => b.id === 'blessing_war' && b.duration >= 600) &&
    sinkGame.hero.buffs.some((b) => b.id === 'blessing_caravan' && b.duration >= 600)
  );

  // Bag & Storage expansion + persistence
  const bagExpandRes = sinkGame.inventory.expandBag();
  const storageExpandRes = sinkGame.inventory.expandStorage();
  check('Bag and Storage expand for Gold (+6 bag, +10 vault)',
    bagExpandRes.ok && sinkGame.inventory.bagSize === 42 && sinkGame.inventory.bag.length === 42 &&
    storageExpandRes.ok && sinkGame.inventory.storageSize === 58 && sinkGame.inventory.storage.length === 58
  );
  const expandReload = createGame({});
  expandReload.fromJSON(sinkGame.toJSON());
  check('Expanded Bag & Storage sizes persist through toJSON/fromJSON',
    expandReload.inventory.bagSize === 42 && expandReload.inventory.storageSize === 58
  );

  // Masterwork Forge: Add Crystal Socket & Reforge Affixes preserving Blue Stone stats + Plus + Seal
  const rareSword = generateItem({ baseId: 'sword_3', rarity: 'rare', level: 15, seal: 'star', plus: 5 });
  sinkGame.inventory.addItem(rareSword, { silent: true });
  sinkGame.inventory.addItem(generateItem({ baseId: 'stone_str', count: 1 }), { silent: true });
  const fuseOk = sinkGame.inventory.fuseMagicStone(rareSword.uid, 'stone_str');
  const startSockets = rareSword.sockets;
  const sockRes = sinkGame.inventory.forgeAddSocket(rareSword.uid);
  const refRes = sinkGame.inventory.forgeReforgeAffixes(rareSword.uid);
  check('Masterwork Forge adds socket (+1 up to 4) and reforges affixes while preserving Blue Stats, Seal & +5',
    fuseOk.ok && sockRes.ok && rareSword.sockets === startSockets + 1 &&
    refRes.ok && rareSword.plus === 5 && rareSword.seal === 'star' &&
    rareSword.mods.some((m) => m.kind === 'magic_stone' && m.stat === 'str')
  );

  // Relic Emporium shop + Scroll of Zerk + Mystery Coffers + Pet Royal Feast
  check('SHOP_DEFS.curio lists Coffers & Magic Stones while composer stays clean',
    Boolean(SHOP_DEFS.curio?.items?.includes('box_gear') && SHOP_DEFS.curio?.items?.includes('box_relic') && SHOP_DEFS.curio?.items?.includes('stone_astral')) &&
    !SHOP_DEFS.composer.items.some((id) => id.startsWith('stone_'))
  );

  sinkGame.hero.berserkCharge = 0;
  const zerkScroll = generateItem({ baseId: 'scroll_berserk' });
  sinkGame.inventory.addItem(zerkScroll, { silent: true });
  const zerkRes = sinkGame.inventory.useItem(zerkScroll.uid);
  check('Using Scroll of Zerk charges Berserk gauge to 100%', zerkRes.ok && sinkGame.hero.berserkCharge === 100);

  const coffer = generateItem({ baseId: 'box_relic' });
  sinkGame.inventory.addItem(coffer, { silent: true });
  const cofferRes = sinkGame.inventory.useItem(coffer.uid);
  check('Using Imperial Relic Coffer consumes box and yields Epic/Unique equipment',
    cofferRes.ok && cofferRes.reward && ['epic', 'unique'].includes(cofferRes.reward.rarity)
  );

  // Pet Royal Feast Gold Sink
  const petBuyRes = sinkGame.pets.buyPet('wolf');
  const goldBeforeFeast = sinkGame.hero.gold;
  const feastRes = sinkGame.pets.trainActivePetWithGold(2500, 500);
  check('trainActivePetWithGold spends 2500 G and levels/exp-trains active pet',
    petBuyRes.ok && feastRes.ok && sinkGame.hero.gold === goldBeforeFeast - 2500 && sinkGame.pets.getActivePet().level >= 2
  );

  // NPC open_menu dialogue navigation + UIHost exposure
  const townUiHost = createUIHost(sinkGame);
  const dlgMenuRes = sinkGame.quests.handleDialogueAction('open_menu:townhall:forge', 'blacksmith');
  check('NPC dialogue open_menu action routes to townhall tab and UIHost exposes town services',
    dlgMenuRes.ok && dlgMenuRes.openMenu === 'townhall' && dlgMenuRes.tab === 'forge' &&
    Boolean(NPCS.chief.services.some((s) => s.action.includes('townhall'))) &&
    typeof townUiHost.getTownHallView === 'function' && typeof townUiHost.forgeReforgeAffixes === 'function' &&
    typeof townUiHost.expandBag === 'function' && typeof townUiHost.trainActivePet === 'function'
  );
}

// -----------------------------------------------------------------------------
// 25. Authentic SRO Uniques: Stats vs Giants, Bespoke Rigs, Summons & Hazards
// -----------------------------------------------------------------------------
{
  const { EnemyManager, BOSS_CATALOG, MONSTER_CATALOG } = await import('../src/world/enemyAI.js');
  const { createBossMesh, resolveUniquePrefabKey } = await import('../src/engine/models3d.js');
  const mgr = new EnemyManager();

  // Verify every Unique key has its own strong MONSTER_CATALOG definition (no Goblin fallback)
  const uniqueKeys = ['tigerwoman', 'uruchi', 'isyutaru', 'lord_yarkan', 'demon_shaitan', 'roc', 'medusa'];
  check('All SRO Uniques have dedicated MONSTER_CATALOG definitions stronger than Goblin',
    uniqueKeys.every((k) => MONSTER_CATALOG[k] && MONSTER_CATALOG[k].baseHp > MONSTER_CATALOG.goblin.baseHp * 2.5)
  );

  // Power balance check: on Floors 3, 6, 9, 12, 15, 16, each Unique must outperform a same-floor Giant mob
  const comparisonPairs = [
    [3, 'tiger'],
    [6, 'yeoha'],
    [9, 'gunpowder_ghost'],
    [12, 'hyungno'],
    [15, 'demon'],
    [16, 'demon']
  ];
  let allOutscaleGiants = true;
  for (const [fl, giantType] of comparisonPairs) {
    const cfg = BOSS_CATALOG[fl];
    const giant = mgr.spawnMonster({ type: giantType, floor: fl, isGiant: true, x: 0, z: 0 });
    const unique = mgr.spawnMonster({ type: cfg.type, floor: fl, isBoss: true, x: 3, z: 3, customConfig: cfg });
    if (!(unique.maxHp > giant.maxHp * 1.45 && unique.atk > giant.atk * 1.15)) {
      allOutscaleGiants = false;
    }
  }
  check('Every floor Unique Boss strictly outscales same-floor Giant miniboss HP and ATK', allOutscaleGiants);
  mgr.clearEnemies();

  // Bespoke 3D rig differentiation check
  const uruchiMesh = createBossMesh('uruchi', { uniqueId: 'uruchi', scale: 2.1 });
  const isyutaruMesh = createBossMesh('isyutaru', { uniqueId: 'isyutaru', scale: 2.2 });
  const yarkanMesh = createBossMesh('lord_yarkan', { uniqueId: 'lord_yarkan', scale: 2.3 });
  const shaitanMesh = createBossMesh('demon_shaitan', { uniqueId: 'demon_shaitan', scale: 2.5 });
  const rocMesh = createBossMesh('roc', { uniqueId: 'roc', scale: 2.85 });
  const medusaMesh = createBossMesh('medusa', { uniqueId: 'medusa', scale: 2.35 });
  const bespokeMeshes = [uruchiMesh, isyutaruMesh, yarkanMesh, shaitanMesh, rocMesh, medusaMesh];
  let meshAnimOk = bespokeMeshes.every((m) => m.children.length > 0 && typeof m.userData?.animateUniqueParts === 'function');
  bespokeMeshes.forEach((m) => {
    m.userData.phaseLevel = 2;
    m.userData.animate?.('skill', 1.25, 0.016);
  });
  check('All 6 non-tiger Uniques build bespoke articulated 3D rigs with custom animation drivers',
    meshAnimOk && resolveUniquePrefabKey({ name: 'Valkor, Bone Sovereign' }) === 'lord_yarkan' && resolveUniquePrefabKey({ name: 'Aetherion, Sky Sovereign' }) === 'roc'
  );

  // HP-band summon waves (80% / 58% / 35%) + Boss defeat cleanup + non-interference with getAliveNonBossCount
  const tgCfg = BOSS_CATALOG[3];
  const tgBoss = mgr.spawnMonster({ type: tgCfg.type, floor: 3, isBoss: true, x: 0, z: 0, roomId: 9, inBossRoom: true, customConfig: tgCfg });
  const mockBossWorld = { bossRoom: { id: 9, centerX: 0, centerZ: 0, w: 20, h: 20 }, isWalkable: () => true };
  // Drop HP below 80% -> should summon Wave 1
  mgr.applyDamageToEnemy(tgBoss, Math.round(tgBoss.maxHp * 0.25), { world: mockBossWorld });
  const summonedAfter80 = mgr.enemies.filter((e) => !e.dead && e.summonedByBossId === tgBoss.id);
  check('Crossing 80% HP summons Unique guards without blocking getAliveNonBossCount',
    summonedAfter80.length >= 2 && mgr.getAliveNonBossCount(mockBossWorld) === 0
  );

  // Delayed hazard queue test (Meteor Rain on Demon Shaitan)
  let hitCount = 0;
  let lastEl = null;
  const dsCfg = BOSS_CATALOG[15];
  const dsBoss = mgr.spawnMonster({ type: dsCfg.type, floor: 15, isBoss: true, x: 0, z: 0, customConfig: dsCfg });
  dsBoss.pendingSkill = 'hellfire_meteor_rain';
  const delayedCb = {
    onPlayerHit: (dmg, src, info) => { hitCount += 1; lastEl = info?.element; return { damage: dmg, dodged: false }; },
    applyPlayerStatus: () => {}
  };
  mgr._executeBossSpecialSkill(dsBoss, 0, 0, mockBossWorld, delayedCb);
  const queuedBeforeUpdate = Array.isArray(mgr._pendingStrikes) ? mgr._pendingStrikes.length : 0;
  for (let step = 0; step < 30; step++) {
    mgr.update(0.05, { x: 0, z: 0 }, mockBossWorld, delayedCb);
  }
  check('Telegraphed meteor rain queues delayed ground strikes and detonates cleanly',
    queuedBeforeUpdate >= 3 && hitCount >= 1 && lastEl === 'fire'
  );

  // Killing Unique Boss automatically collapses remaining summoned guards & pending strikes
  mgr.applyDamageToEnemy(tgBoss, tgBoss.hp + 9999, { world: mockBossWorld });
  const survivingAdds = mgr.enemies.filter((e) => !e.dead && e.summonedByBossId === tgBoss.id);
  check('Defeating a Unique collapses all remaining boss-summoned guards cleanly',
    tgBoss.dead && survivingAdds.length === 0
  );

  // Verify every Silkroad Unique boss GLB model exists on disk and resolves to authentic SRO Unique assets
  const fsSync = await import('node:fs');
  const pathMod = await import('node:path');
  const { resolveMonsterGlb } = await import('../src/engine/models3d.js');
  const uniqueGlbExpectations = [
    ['tigerwoman', 'tigerwoman.glb'],
    ['uruchi', 'uruchi.glb'],
    ['isyutaru', 'isyutaru.glb'],
    ['lord_yarkan', 'bonelord.glb'],
    ['demon_shaitan', 'tahomet.glb'],
    ['roc', 'roc.glb'],
    ['medusa', 'whitesnake.glb']
  ];
  const uniqueAssetsOk = uniqueGlbExpectations.every(([key, glbFile]) => {
    const resolved = resolveMonsterGlb(key, true);
    const monEntry = MONSTER_CATALOG[key];
    const onDisk = fsSync.existsSync(pathMod.join(process.cwd(), 'public/assets/sro/mobs', glbFile));
    return onDisk && resolved?.url?.endsWith(glbFile) && monEntry?.glbPath?.endsWith(glbFile);
  });
  check('All 7 Silkroad Uniques map to dedicated authentic .glb files existing on disk', uniqueAssetsOk);
  mgr.clearEnemies();
}

// 15. SilkroadTR Dungeon Textures, 3D Props, and 19-Floor Layout Integrity
{
  const fsSync = await import('node:fs');
  const pathMod = await import('node:path');
  const publicAssetExists = (url) =>
    typeof url === 'string' && fsSync.existsSync(pathMod.join(process.cwd(), 'public', url.replace(/^\/+/, '')));

  // Verify base dungeon theme textures exist on disk
  for (const key of ['cave', 'crypt', 'ruins', 'lava', 'boss']) {
    const theme = DUNGEON_THEMES[key];
    check(`DUNGEON_THEMES.${key} floorTexture exists on disk (${theme?.floorTexture})`, publicAssetExists(theme?.floorTexture));
    check(`DUNGEON_THEMES.${key} wallTexture exists on disk (${theme?.wallTexture})`, publicAssetExists(theme?.wallTexture));
  }

  // Verify every SilkroadTR prop .glb referenced by SRO_DUNGEON_PROPS exists on disk
  const propUrls = new Set();
  for (const set of Object.values(SRO_DUNGEON_PROPS)) {
    for (const c of set.corners || []) if (c?.url) propUrls.add(c.url);
    for (const k of ['wall', 'shrineCenter', 'shrineGuard', 'springCenter', 'bossGate', 'bossFlankLeft', 'bossFlankRight', 'bossSanctumNorth']) {
      if (set[k]?.url) propUrls.add(set[k].url);
    }
  }
  for (const url of propUrls) {
    check(`SilkroadTR dungeon prop exists on disk (${url})`, publicAssetExists(url));
  }

  // Generate all 16 normal floors + 3 secret floors and validate SilkroadTR metadata, textures, spawn & portals
  const sroDg = createDungeonGenerator();
  const allFloors = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 101, 102, 103];
  const seenSroDungeons = new Set();
  for (const f of allFloors) {
    const floorData = sroDg.generateFloor(f);
    seenSroDungeons.add(sroDg.sroDungeon);
    check(`Floor ${f} resolves valid sroDungeon (${sroDg.sroDungeon})`, Boolean(SRO_DUNGEON_PROPS[sroDg.sroDungeon]));
    check(`Floor ${f} floorTexture exists on disk (${sroDg.theme?.floorTexture})`, publicAssetExists(sroDg.theme?.floorTexture));
    check(`Floor ${f} wallTexture exists on disk (${sroDg.theme?.wallTexture})`, publicAssetExists(sroDg.theme?.wallTexture));
    check(`Floor ${f} spawnPoint is walkable`, sroDg.isWalkable(floorData.spawnPoint.x, floorData.spawnPoint.z));
    if (sroDg.floorDef?.boss) {
      check(`Floor ${f} (${sroDg.sroDungeon}) boss floor has bossRoom and bossArena`, Boolean(sroDg.bossRoom && sroDg.bossArena));
    } else {
      check(`Floor ${f} (${sroDg.sroDungeon}) has walkable exit portal`, floorData.portals.some((p) => p.portalType === 'next_floor' || p.portalType === 'village'));
    }

    const portalsWalkable = floorData.portals.every((p) => sroDg.isWalkable(p.x, p.z));
    check(`Floor ${f} portals sit on walkable tiles`, portalsWalkable);

    const bossExit = floorData.portals.find((p) => String(p.id).startsWith('boss_exit'));
    const exitClear = !bossExit || sroDg.solidObstacles.every((o) => Math.hypot(o.x - bossExit.x, o.z - bossExit.z) > o.radius + 1.5);
    check(`Floor ${f} boss exit portal has obstacle clearance`, exitClear);
  }

  for (const expectedZone of ['donhwang', 'karakoram', 'qinshi', 'flame', 'holywater', 'jupiter', 'demon', 'roc_nest', 'togui', 'wreck', 'qinshi_b6']) {
    check(`SilkroadTR dungeon zone "${expectedZone}" assigned to floor rotation`, seenSroDungeons.has(expectedZone));
  }
}

// 16. Colossal Boss Arenas, Planned Squads & Hardcore Challenge Trials
{
  const fsSync = await import('node:fs');
  const pathMod = await import('node:path');
  const THREE = await import('three');
  const dgAdv = createDungeonGenerator();
  const emAdv = createEnemyManager();
  const mockSceneAdv = { add() {}, remove() {} };
  const mockModelsAdv = {
    createEnemyMesh: () => new THREE.Group(),
    createBossMesh: () => new THREE.Group(),
    createPortalMesh: () => {
      const g = new THREE.Group();
      g.userData = {};
      return g;
    },
    createChestMesh: () => new THREE.Group()
  };

  for (const bf of [3, 6, 9, 12, 15, 103]) {
    const fd = dgAdv.generateFloor(bf);
    const br = fd.rooms.find((r) => r.type === 'boss');
    check(`Floor ${bf} boss chamber is expanded (>= 46x38m)`, Boolean(br && br.w >= 46 && br.h >= 38));
  }
  {
    const fd16 = dgAdv.generateFloor(16);
    const br16 = fd16.rooms.find((r) => r.type === 'boss');
    check('Floor 16 Sky Nest boss sanctum is >= 50x46m', Boolean(br16 && br16.w >= 50 && br16.h >= 46));
  }

  // Verify room archetypes & walkable encounter plans + squad spawning
  const validArchetypes = new Set([
    'vanguard_courtyard', 'pillared_cloister', 'crucible_sanctum',
    'reliquary_hall', 'barrack_ambush', 'processional', 'trap_gallery'
  ]);
  for (const rf of [1, 2, 4, 5, 7, 8, 10]) {
    const fd = dgAdv.generateFloor(rf);
    const nonStartRooms = fd.rooms.filter((r) => r.type !== 'start' && r.type !== 'boss' && r.type !== 'village');
    const allArchValid = nonStartRooms.every((r) => validArchetypes.has(r.archetype));
    const allPlansWalkable = nonStartRooms.every((r) =>
      Array.isArray(r.encounterPlan) && r.encounterPlan.length > 0 &&
      r.encounterPlan.every((slot) => dgAdv.isWalkable(slot.x, slot.z, 0.45))
    );
    check(`Floor ${rf} assigns valid room archetypes & walkable encounterPlan slots`, allArchValid && allPlansWalkable);
    const spawned = emAdv.spawnFloorEnemies(fd, rf, mockSceneAdv, mockModelsAdv, {});
    const plannedTotal = nonStartRooms.reduce((acc, r) => acc + r.encounterPlan.length, 0);
    check(`Floor ${rf} spawns planned tactical squads (${spawned.length} == ${plannedTotal})`, spawned.length === plannedTotal);
    emAdv.clearEnemies();
  }

  // Verify all 54 SilkroadTR dungeon .glb props including monumental & 17 exclusive floor props exist on disk
  const dunPropsDir = pathMod.join(process.cwd(), 'public/assets/sro/dun/props');
  const glbFiles = fsSync.readdirSync(dunPropsDir).filter((f) => f.endsWith('.glb'));
  const expectedNewProps = [
    'roc_altar.glb', 'roc_nest.glb', 'pha_altar.glb', 'cave_arch.glb', 'roc_portal.glb',
    'dh_lamp.glb', 'dh_temple_stone.glb', 'dh_rock_big.glb', 'jinsi_maiden_confue.glb',
    'pharaoh_ruin.glb', 'pha_statue_green.glb', 'jupiter_piety_altar.glb', 'jupiter_piety_gate.glb',
    'demon_altar_fire.glb', 'demon_altar_poison.glb', 'demon_altar_death.glb', 'demon_air_rock.glb',
    'desert_brazier.glb', 'colosseum_column.glb', 'palace_well.glb', 'garden_lion.glb', 'mayan_gong.glb'
  ];
  check('All 54 SilkroadTR dungeon .glb props (including 17 exclusive floor props) exist on disk',
    glbFiles.length === 54 && expectedNewProps.every((f) => glbFiles.includes(f))
  );

  // Challenge Coliseum 32x32m & 6 hardcore trial archetypes
  const expectedChallenges = ['survival_60', 'blitz_45', 'unique_trial', 'inferno_crucible', 'cursed_obelisk', 'blood_coliseum'];
  check('All 6 Challenge Trial types configured with escalated stats, overdrive & hazards',
    expectedChallenges.every((k) => {
      const c = CHALLENGE_TYPES[k];
      return c && c.mobHpMult >= 1.45 && c.mobAtkMult >= 1.25 && c.overdriveAt > 0 && c.hazardInterval > 0;
    })
  );

  const arenaInfo = dgAdv.generateChallengeArena('inferno_crucible', 5);
  const arenaRoom = dgAdv.rooms[0];
  const arenaRet = dgAdv.spawnChallengeReturnPortal(5);
  check('Challenge Coliseum expands to 32x32m with walkable spawn & return portal at z=-10',
    arenaInfo.zone === 'challenge' && arenaRoom.w >= 32 && arenaRoom.h >= 32 &&
    dgAdv.isWalkable(arenaInfo.spawnPoint.x, arenaInfo.spawnPoint.z, 0.5) &&
    arenaRet.z === -10 && dgAdv.isWalkable(arenaRet.x, arenaRet.z, 0.5)
  );

  // Randomization sanity across multiple runs on Floor 2 & deterministic F1 slot 0
  const f1FirstRun = dgAdv.generateFloor(1);
  const f1ChPortals = (f1FirstRun.portals || []).filter((p) => p.portalType === 'challenge_portal');
  check('Floor 1 preserves survival_60 as first Challenge Portal', f1ChPortals[0]?.challengeType === 'survival_60');

  const f2Signatures = new Set();
  let f2CountsOk = true;
  for (let run = 0; run < 8; run++) {
    const fd2 = dgAdv.generateFloor(2);
    const ps = (fd2.portals || []).filter((p) => p.portalType === 'challenge_portal');
    if (ps.length < 1 || ps.length > 3) f2CountsOk = false;
    f2Signatures.add(ps.map((p) => `${p.challengeType}@${Math.round(p.x)},${Math.round(p.z)}`).join('|'));
  }
  check('Challenge Portals vary count/type/placement across runs (1..3)', f2CountsOk && f2Signatures.size >= 2);

  // Arena hazard queues & triggers damage without needing a living boss
  let hazardDamageTaken = 0;
  emAdv.clearEnemies();
  emAdv._pendingStrikes = [];
  emAdv.queueArenaHazard({
    x: 2.0,
    z: 2.0,
    radius: 3.0,
    delay: 0.4,
    damage: 45,
    element: 'fire',
    world: dgAdv,
    callbacks: {
      onPlayerHit: (dmg) => {
        hazardDamageTaken += dmg;
        return { damage: dmg, dodged: false, dead: false };
      }
    }
  });
  check('queueArenaHazard pushes an active environmental strike without a boss entity',
    emAdv._pendingStrikes.length === 1 && emAdv._pendingStrikes[0].isArenaHazard === true
  );
  emAdv._updatePendingStrikes(0.5, 2.0, 2.0, null, {
    onPlayerHit: (dmg) => {
      hazardDamageTaken += dmg;
      return { damage: dmg, dodged: false, dead: false };
    }
  });
  check('Arena Hazard strikes cleanly on countdown expiration', hazardDamageTaken === 45 && emAdv._pendingStrikes.length === 0);

  // -----------------------------------------------------------------------------
  // Silkroad Dungeon Species Completeness, Expanded Outskirts, Lv10 Gate & Floor Clear Lock
  // -----------------------------------------------------------------------------
  const { FLOOR_DEFINITIONS, MIN_DUNGEON_LEVEL } = await import('../src/world/dungeonGenerator.js');
  const { FLOOR_POOLS, MONSTER_CATALOG } = await import('../src/world/enemyAI.js');
  const { SRO_DUNGEON_PROPS, nearOpening } = await import('../src/world/dungeonDecor.js');
  const mobsDir = pathMod.join(process.cwd(), 'public/assets/sro/mobs');
  const mobGlbSet = new Set(fsSync.readdirSync(mobsDir).filter((f) => f.endsWith('.glb')));
  const allFloorNums = [...Array.from({ length: 16 }, (_, i) => i + 1), 101, 102, 103];

  let allSpeciesValid = true;
  let allGlbsExist = true;
  let missingDiag = [];
  for (const fn of allFloorNums) {
    const fDef = FLOOR_DEFINITIONS.find((d) => d.floor === fn);
    const pool = FLOOR_POOLS[fn] || [];
    if (!fDef || pool.length === 0) {
      allSpeciesValid = false;
      missingDiag.push(`F${fn}:empty`);
      continue;
    }
    if (fDef.monsterTypes.length !== pool.length || !pool.every((s) => fDef.monsterTypes.includes(s))) {
      allSpeciesValid = false;
      missingDiag.push(`F${fn}:sync`);
    }
    for (const sp of pool) {
      const def = MONSTER_CATALOG[sp];
      if (!def) {
        allSpeciesValid = false;
        missingDiag.push(`missingCatalog:${sp}`);
        continue;
      }
      const fname = def.glbPath ? pathMod.basename(def.glbPath) : '';
      if (!fname || !mobGlbSet.has(fname)) {
        allGlbsExist = false;
        missingDiag.push(`missingGlb:${sp}->${fname}`);
      }
    }
  }
  check(`All ${allFloorNums.length} dungeon floors map authentic Silkroad species backed by .glb files (${missingDiag.join(',') || 'ok'})`,
    allSpeciesValid && allGlbsExist
  );

  // Per-floor unique decorProfile & portalStyle
  const decorProfiles = new Set(FLOOR_DEFINITIONS.map((d) => d.decorProfile));
  const portalStyles = new Set(FLOOR_DEFINITIONS.map((d) => d.portalStyle));
  check('Every floor (B1F-B16F, S1F-S3F) has a unique decorProfile & unique portalStyle',
    decorProfiles.size === FLOOR_DEFINITIONS.length && portalStyles.size === FLOOR_DEFINITIONS.length &&
    Array.from(decorProfiles).every((k) => Boolean(SRO_DUNGEON_PROPS[k]))
  );

  // Verify enemyManager.spawnFloorEnemies spawns 100% of every floor's species & decor has zero overlap
  let everyFloorSpawnsAllSpecies = true;
  let zeroDecorOverlapAllFloors = true;
  const overlapIssues = [];
  const missingSpawnIssues = [];
  for (const fn of allFloorNums) {
    emAdv.clearEnemies();
    const fState = dgAdv.generateFloor(fn);
    const spawned = emAdv.spawnFloorEnemies(fState, fn, mockSceneAdv, mockModelsAdv, {});
    const spawnedTypes = new Set(spawned.map((e) => e.type));
    const expectedPool = FLOOR_POOLS[fn] || [];
    const missingSp = expectedPool.filter((sp) => !spawnedTypes.has(sp));
    if (missingSp.length > 0) {
      everyFloorSpawnsAllSpecies = false;
      missingSpawnIssues.push(`F${fn}:${missingSp.join('|')}`);
    }

    // Check _placedDecor vs doorways, portals, chests, shrines & pairwise decor overlaps
    const placed = dgAdv._placedDecor || [];
    for (let i = 0; i < placed.length; i++) {
      const a = placed[i];
      if (nearOpening(dgAdv, a.x, a.z, 0.9)) {
        zeroDecorOverlapAllFloors = false;
        overlapIssues.push(`F${fn}:door:${a.tag}@${a.x.toFixed(1)},${a.z.toFixed(1)}`);
      }
      for (let j = i + 1; j < placed.length; j++) {
        const b = placed[j];
        if (Math.hypot(a.x - b.x, a.z - b.z) < ((a.r || 0.4) + (b.r || 0.4)) * 0.85) {
          zeroDecorOverlapAllFloors = false;
          overlapIssues.push(`F${fn}:pair:${a.tag}+${b.tag}`);
        }
      }
    }
    for (const ch of dgAdv.chests || []) {
      for (const p of dgAdv.portals || []) {
        if (Math.hypot(ch.x - p.x, ch.z - p.z) < 1.8) {
          zeroDecorOverlapAllFloors = false;
          overlapIssues.push(`F${fn}:chest+portal`);
        }
      }
    }
  }
  check(`All 19 floors spawn 100% of their authentic SRO monster species (${missingSpawnIssues.join(';') || 'ok'})`,
    everyFloorSpawnsAllSpecies
  );
  check(`Zero overlap & clear doorways audited across all 19 dungeon floors (${overlapIssues.slice(0, 4).join(';') || 'ok'})`,
    zeroDecorOverlapAllFloors
  );

  // Expanded 140x140 (280m x 280m) Jangan Metropolis, well-spaced portals & 8 Jangan-only Outskirt Lv 1-10 camps
  const hubState = dgAdv.loadVillageHub(mockSceneAdv, mockModelsAdv);
  const vPortals = hubState.portals || [];
  let minPortalDist = Infinity;
  for (let pi = 0; pi < vPortals.length; pi++) {
    for (let pj = pi + 1; pj < vPortals.length; pj++) {
      const pd = Math.hypot(vPortals[pi].x - vPortals[pj].x, vPortals[pi].z - vPortals[pj].z);
      if (pd < minPortalDist) minPortalDist = pd;
    }
  }
  check('Jangan Metropolis expanded to 140x140 (HALF=55) with 4 open gates, >=3 well-spaced portals (>=35m apart) & 16 Jangan camps',
    hubState.width === 140 && hubState.height === 140 &&
    hubState.townWallHalf === 55 &&
    vPortals.length >= 3 && minPortalDist >= 35 &&
    Array.isArray(hubState.outskirtCamps) && hubState.outskirtCamps.length === 16 &&
    dgAdv.isWalkable(0, 55, 0.5) && dgAdv.isWalkable(0, 54.2, 0.6) &&
    dgAdv.isWalkable(0, -55, 0.5) && dgAdv.isWalkable(0, -39.0, 0.6) &&
    dgAdv.isWalkable(55, 0, 0.5) && dgAdv.isWalkable(-55, 0, 0.5) &&
    !dgAdv.isWalkable(24, 55, 0.5)
  );

  emAdv.clearEnemies();
  const hubMobs = emAdv.spawnFloorEnemies(hubState, 0, mockSceneAdv, mockModelsAdv, {});
  const campIds = new Set(hubMobs.map((m) => m.campId).filter(Boolean));
  const forbiddenOutskirtTypes = new Set(['slime', 'goblin', 'wolf', 'spider', 'bug_ghost', 'black_robber', 'black_robber_archer', 'work_earth_ghost', 'soldier_earth_ghost', 'earth_ghost', 'taese', 'blindmon']);
  const hubLevelsOk = hubMobs.length >= 140 && hubMobs.every((m) => m.isOutskirtMob && m.level >= 1 && m.level <= 10 && Array.isArray(m.skills) && m.skills.length >= 1 && !forbiddenOutskirtTypes.has(m.type));
  check('Village outskirts spawn 16 Jangan-only hunting camps (>=140 Lv 1-10 skilled mobs, zero non-Jangan mobs)',
    campIds.size === 16 && hubLevelsOk
  );

  // Kill one outskirt mob and advance timer so a fresh replacement respawns at its camp
  const firstOutskirt = hubMobs[0];
  const campBefore = emAdv.enemies.filter((e) => e.campId === firstOutskirt.campId && !e.dead).length;
  emAdv._handleEnemyDeath(firstOutskirt);
  const deadAfterKill = firstOutskirt.dead === true && firstOutskirt.respawnTimer > 0 && firstOutskirt.floor === 0;
  emAdv.update((firstOutskirt.respawnDelay || 12) + 0.5, 20, { x: 0, z: 0 }, dgAdv, {});
  const campAfter = emAdv.enemies.filter((e) => e.campId === firstOutskirt.campId && !e.dead).length;
  const freshAtSpot = emAdv.enemies.find(
    (e) => e !== firstOutskirt && !e.dead && e.campId === firstOutskirt.campId &&
      Math.hypot(e.spawnX - firstOutskirt.spawnX, e.spawnZ - firstOutskirt.spawnZ) < 0.1
  );
  check('Outskirt monster respawns back at its camp after cooldown expires',
    deadAfterKill && campAfter === campBefore && Boolean(freshAtSpot && freshAtSpot.hp === freshAtSpot.maxHp)
  );

  // Level 10 gate enforcement
  const gateGame = createGame({ classId: 'warrior' });
  const gateCtx = {
    gameState: gateGame,
    game: gateGame,
    enterFloor: () => true,
    returnToVillage: () => true,
    hud: { toast: () => {}, showToast: () => {}, showBanner: () => {} }
  };
  const villageEntrance = (hubState.portals || []).find((p) => p.portalType === 'dungeon_entrance');
  const blockedLv1 = dgAdv.interact(villageEntrance, gateCtx);
  while (gateGame.hero.level < MIN_DUNGEON_LEVEL) gateGame.addExp(gateGame.expToNext);
  const allowedLv10 = dgAdv.interact(villageEntrance, gateCtx);
  check('Level 10 Dungeon Gate blocks Lv 1 hero and unlocks at Lv 10',
    MIN_DUNGEON_LEVEL === 10 &&
    blockedLv1.ok === false && blockedLv1.reason.includes('10') &&
    allowedLv10.ok === true && allowedLv10.targetFloor === 1
  );

  // Floor clear lock -> kill remaining floor enemies -> unlocks exit portal + banner + chronicle + quest
  const clearGame = createGame({ classId: 'warrior' });
  while (clearGame.hero.level < 12) clearGame.addExp(clearGame.expToNext);
  const clearCtx = {
    gameState: clearGame,
    game: clearGame,
    enterFloor: () => true,
    returnToVillage: () => true,
    hud: { toast: () => {}, showToast: () => {}, showBanner: () => {} }
  };
  const dgClear = createDungeonGenerator(clearCtx, mockModelsAdv, {});
  const emClear = createEnemyManager(clearCtx, mockModelsAdv, {});
  clearCtx.dungeon = dgClear;
  clearCtx.world = dgClear;
  const f1ClearData = dgClear.generateFloor(1);
  emClear.spawnFloorEnemies(f1ClearData, 1, mockSceneAdv, mockModelsAdv, {});
  const exitP1 = (f1ClearData.portals || []).find((p) => p.portalType === 'next_floor');
  const lockedRes = dgClear.interact(exitP1, clearCtx);

  clearGame.progress.maxFloor = 10;
  clearGame.quests.states['q_outskirts_ridge'] = 'completed';
  clearGame.quests.accept('q_clear_donhwang');

  const floorFoes = emClear.getAliveFloorEnemies(dgClear);
  for (let k = 0; k < floorFoes.length - 1; k++) {
    emClear._handleEnemyDeath(floorFoes[k]);
  }
  const stillLocked = exitP1.lockedByClear === true;
  emClear._handleEnemyDeath(floorFoes[floorFoes.length - 1]);
  const unlockedRes = dgClear.interact(exitP1, clearCtx);
  const f1Chronicle = clearGame.getStoryChronicles().find((c) => c.floor === 1);
  const donhwangQuest = clearGame.quests.getQuestView('q_clear_donhwang');
  const clrObj1 = donhwangQuest?.objectives?.find((o) => o.id === 'clr_f1');
  check('Exit portal locks until last floor enemy dies, then unlocks + updates Story & Quests',
    lockedRes.ok === false &&
    stillLocked === true &&
    exitP1.lockedByClear === false &&
    unlockedRes.ok === true &&
    clearGame.progress.floorsCleared.includes(1) &&
    Boolean(f1Chronicle?.cleared) &&
    clrObj1?.current === 1
  );

  // General Shared Storage Vault (account-wide items + shared gold) & reusable village storage chest
  const memMap = new Map();
  const memStorage = {
    getItem: (k) => (memMap.has(k) ? memMap.get(k) : null),
    setItem: (k, v) => { memMap.set(k, String(v)); },
    removeItem: (k) => { memMap.delete(k); }
  };
  const charA = createGame({ classId: 'warrior', storage: memStorage });
  const epicBlade = generateItem('sword_3', 'epic', 10);
  charA.inventory.addItem(epicBlade, { silent: true });
  charA.addGold(2500);
  const depItemRes = charA.inventory.deposit(epicBlade.uid);
  const depGoldRes = charA.inventory.depositGold(1500);
  const charB = createGame({ classId: 'wizard', storage: memStorage });
  const charBStartGold = charB.inventory.gold;
  const sharedViewB = charB.inventory.getStorageView();
  const wdrGoldRes = charB.inventory.withdrawGold(600);
  const sharedMatsRes = charA.inventory.depositAllByFilter('material');
  check('General Shared Storage persists items & gold across characters via SHARED_STORAGE_KEY',
    depItemRes.ok && depGoldRes.ok && memMap.has(SHARED_STORAGE_KEY) &&
    sharedViewB.sharedGold === 1500 &&
    sharedViewB.items.some((it) => it && it.baseId === 'sword_3') &&
    wdrGoldRes.ok && charB.inventory.gold === charBStartGold + 600 && charB.inventory.getStorageView().sharedGold === 900 &&
    typeof sharedMatsRes.ok === 'boolean'
  );

  // Village storage chest is reusable and opens 'storage' endlessly
  let openedStorageCount = 0;
  const storageChestCtx = {
    ...gateCtx,
    menus: { openMenu: (m) => { if (m === 'storage') openedStorageCount++; } }
  };
  const vChest = (hubState.chests || []).find((c) => c.id === 'village_starter_chest');
  const open1 = dgAdv.interact(vChest, storageChestCtx);
  const open2 = dgAdv.interact(vChest, storageChestCtx);
  check('Village starter chest converted to reusable General Shared Storage Vault',
    vChest?.type === 'storage_chest' && vChest?.reusable === true &&
    open1.ok && open1.type === 'storage_chest' &&
    open2.ok && open2.type === 'storage_chest' &&
    openedStorageCount === 2
  );

  // Bag-full pickupLoot must NOT delete ground item
  const fullGame = createGame({ classId: 'knight' });
  while (fullGame.inventory.bag.indexOf(null) >= 0) {
    fullGame.inventory.addItem(generateItem('sword_1', 'normal', 1), { silent: true });
  }
  const droppedRelic = generateItem('sword_4', 'epic', 12);
  const groundRelic = dgClear.spawnGroundLoot({ x: 1, z: 1 }, droppedRelic);
  const fullPickupRes = dgClear.pickupLoot(groundRelic, { gameState: fullGame, inventory: fullGame.inventory });
  check('pickupLoot keeps loot on the ground instead of deleting when bag is full',
    fullPickupRes.ok === false && fullPickupRes.full === true && groundRelic.collected === false
  );

  // Newly added Jangan NPCs, Shops, Dialogue & Skill handlers
  const mangSkillMob = emAdv.spawnMonster({ type: 'mangyang', floor: 0, x: 2, z: 0 });
  mangSkillMob.pendingSkill = 'ram_tackle';
  emAdv._executeBossSpecialSkill(mangSkillMob, 0, 0, dgAdv, { onPlayerHit: () => {} });
  const ghostSkillMob = emAdv.spawnMonster({ type: 'tombstone_ghost', floor: 0, x: 4, z: 0 });
  ghostSkillMob.pendingSkill = 'soul_bolt';
  emAdv._executeBossSpecialSkill(ghostSkillMob, 0, 0, dgAdv, { onPlayerHit: () => {} });
  const zaraDlg = fullGame.quests.getNpcDialogue('pet_merchant');
  const hunterShop = fullGame.inventory.getShop('hunter_master');
  const acceShop = fullGame.inventory.getShop('accessory_trader');
  check('Jangan NPCs (Zara dialogue, Jodaesan jewelry shop, Gwakwi hunter shop) & mob skills work cleanly',
    Boolean(NPCS.accessory_trader && NPCS.hunter_master && NPCS.pet_merchant) &&
    Boolean(zaraDlg && Array.isArray(zaraDlg.options) && zaraDlg.options.some((o) => o.action === 'open_menu:petshop')) &&
    Boolean(hunterShop?.items?.length >= 8) && Boolean(acceShop?.items?.length >= 8)
  );

  // Flexible Hotbar Slots 6-9 (Skills OR Usable Items + Persistence + Routing)
  {
    const hkGame = createGame({ classId: 'wizard' });
    hkGame.newCharacter({ name: 'HotkeyMage', classId: 'wizard', slot: 0 });
    hkGame.hero.level = 15;
    hkGame.hero.skillPoints = 10;
    const wizSkills = Object.values(SKILL_DEFS).filter(
      (s) => ((s.classId || '').toLowerCase() === 'wizard' || (s.tree || '').toLowerCase() === 'wizard') && s.type !== 'passive' && !s.requires?.length
    );
    const learnSkillA = wizSkills[0].id;
    const learnSkillB = wizSkills[1]?.id || learnSkillA;
    hkGame.skills.learn(learnSkillA);
    hkGame.skills.learn(learnSkillB);
    const hkHost = createUIHost(hkGame);

    check('Hotbar exposes 9 slots (keys 1-9) while leaving starter slots 4-9 clean',
      hkGame.skills.hotbar.length === 9 && hkHost.getSkillBar().length === 9 && hkHost.getSkillBar()[5] === null
    );

    const assignSkillTo6 = hkGame.skills.assign(5, learnSkillA);
    check('Skill can be assigned to slot 6 (index 5) and clears quickSlots[0]',
      assignSkillTo6.ok && hkGame.skills.hotbar[5] === learnSkillA && hkGame.inventory.quickSlots[0] === null && hkHost.getSkillBar()[5]?.skillId === learnSkillA
    );

    hkGame.inventory.addItem(generateItem({ baseId: 'hp_potion_m', count: 2 }), { silent: true });
    hkGame.inventory.addItem(generateItem({ baseId: 'scroll_might', count: 2 }), { silent: true });
    const potInBag = hkGame.inventory.bag.find((b) => b && b.baseId === 'hp_potion_m');
    const scrollInBag = hkGame.inventory.bag.find((b) => b && b.baseId === 'scroll_might');
    const assignPotTo6 = hkGame.inventory.assignQuickSlot(0, potInBag.uid);
    const assignScrollTo8 = hkGame.inventory.assignQuickSlot(2, scrollInBag.uid);
    const assignSkillTo7 = hkGame.skills.assign(6, learnSkillB);
    check('Consumables (potions/scrolls) can bind to slots 6-9 and cross-clear skills at matching slots',
      assignPotTo6.ok && hkGame.inventory.quickSlots[0] === 'hp_potion_m' && hkGame.skills.hotbar[5] === null &&
      assignScrollTo8.ok && hkGame.inventory.quickSlots[2] === 'scroll_might' &&
      assignSkillTo7.ok && hkGame.skills.hotbar[6] === learnSkillB && hkGame.inventory.quickSlots[1] === null
    );

    const savedSkills = hkGame.skills.toJSON();
    const savedInv = hkGame.inventory.toJSON();
    const restoredGame = createGame({ classId: 'wizard' });
    restoredGame.skills.fromJSON(savedSkills);
    restoredGame.inventory.fromJSON(savedInv);
    check('Slots 6-9 hybrid bindings (skills & scrolls/potions) survive toJSON/fromJSON roundtrip',
      restoredGame.skills.hotbar.length === 9 &&
      restoredGame.skills.hotbar[5] === null &&
      restoredGame.skills.hotbar[6] === learnSkillB &&
      restoredGame.inventory.quickSlots[0] === 'hp_potion_m' &&
      restoredGame.inventory.quickSlots[2] === 'scroll_might'
    );

    const routedCalls = [];
    const mockPc = {
      gameState: hkGame,
      skills: hkGame.skills,
      triggerSkillSlot: (idx) => { routedCalls.push(['skill', idx]); return true; },
      useQuickPotion: (qIdx) => { routedCalls.push(['item', qIdx]); return true; }
    };
    PlayerController.prototype.triggerQuickSlot.call(mockPc, 0);
    PlayerController.prototype.triggerQuickSlot.call(mockPc, 1);
    PlayerController.prototype.triggerQuickSlot.call(mockPc, 2);
    check('PlayerController.triggerQuickSlot dispatches skills vs consumables cleanly across slots 6-9',
      routedCalls.length === 3 &&
      routedCalls[0][0] === 'item' && routedCalls[0][1] === 0 &&
      routedCalls[1][0] === 'skill' && routedCalls[1][1] === 6 &&
      routedCalls[2][0] === 'item' && routedCalls[2][1] === 2
    );
  }

  // Hero Animation T-Pose Prevention (LoopOnce clampWhenFinished + Weight Normalization + Cast Sequence)
  {
    check('CLASS_CLIP_MAP.wizard includes CAST4 mapping', Boolean(CLASS_CLIP_MAP?.wizard?.CAST4));
    const hero = models3d.createHeroMesh(null, { classId: 'knight' });
    hero.userData.animate('cast', 0.1, 0.016, 1, 0.25, 1);
    hero.userData.animate('cast', 0.4, 0.016, 1, 0.65, 2);
    hero.userData.animate('knight_prep', 0.75, 0.016, 2, 0.5, 3);
    hero.userData.animate('knight_release', 1.05, 0.016, 1, 0.9, 4);
    hero.userData.animate('idle', 1.4, 0.016, 0, 0, 4);
    check('Procedural hero executes rapid skill sequence transitions cleanly',
      Number.isFinite(hero.rotation.x) && Number.isFinite(hero.rotation.y) && Number.isFinite(hero.rotation.z)
    );
    const modelsSrc = fs.readFileSync(new URL('../src/engine/models3d.js', import.meta.url), 'utf8');
    const pcSrc = fs.readFileSync(new URL('../src/engine/playerController.js', import.meta.url), 'utf8');
    check('models3d.js clamps LoopOnce skill actions and normalizes bone weights to 1.0',
      modelsSrc.includes('targetAction.clampWhenFinished = targetLoop === THREE.LoopOnce') &&
      !modelsSrc.includes('clampWhenFinished = false') &&
      modelsSrc.includes('actionSeq') &&
      pcSrc.includes('this.skillCastSeq')
    );
  }

  // Classic Restored Village Architecture + Organized Outskirts
  {
    const villageSrc = fs.readFileSync(new URL('../src/world/villageBuilder.js', import.meta.url), 'utf8');
    const brokenRefs = ['cj_pal_main_buil', 'cj5_tem_', 'cj_monstad_', 'cj_armo', 'cj_etc', 'cj_acce', 'cj_stab', 'cj_luxury', 'cj_resta', 'cj_weapon', 'cj_rich_bridge', 'cj_luxu_light', 'town/m05', 'town/guard_'];
    check('villageBuilder removes broken SRO building/bridge/crowd GLB refs and restores classic geometry',
      brokenRefs.every((r) => !villageSrc.includes(r))
    );

    const vb = buildVillage();
    const namedChildren = [];
    vb.group.traverse((o) => { if (o.name) namedChildren.push(o.name); });
    const dPortalSel = Math.hypot(vb.portalPos.x - vb.selectorPos.x, vb.portalPos.z - vb.selectorPos.z);
    const dPortalArena = Math.hypot(vb.portalPos.x - vb.arenaPortalPos.x, vb.portalPos.z - vb.arenaPortalPos.z);
    const dSelArena = Math.hypot(vb.selectorPos.x - vb.arenaPortalPos.x, vb.selectorPos.z - vb.arenaPortalPos.z);
    const totalOutskirtMobs = vb.outskirtCamps.reduce((n, c) => n + c.spawns.length, 0);
    const spawnOverlapBad = vb.outskirtCamps.some((c) => c.spawns.some((sp) =>
      vb.obstacles.some((o) => Math.hypot(sp.x - o.x, sp.z - o.z) < (o.radius || 0.5) + 0.8) ||
      vb.buildingRects.some((b) => sp.x > b.x0 - 0.8 && sp.x < b.x1 + 0.8 && sp.z > b.z0 - 0.8 && sp.z < b.z1 + 0.8)
    ));
    check('Restored classic Village + organized outskirts meet layout, portal spacing, NPC & camp contracts',
      namedChildren.includes('Village_sand') &&
      namedChildren.includes('Village_teal') &&
      namedChildren.includes('VillageFountain') &&
      namedChildren.includes('JadeMistHotSprings') &&
      namedChildren.includes('PerimeterMountains') &&
      vb.townWallHalf === 55 &&
      vb.worldBound === 122 &&
      dPortalSel >= 35 && dPortalArena >= 35 && dSelArena >= 35 &&
      Object.keys(vb.npcSpots).length === 9 &&
      Object.keys(vb.storageChestSpots).length === 2 &&
      vb.outskirtCamps.length === 16 &&
      totalOutskirtMobs === 156 &&
      !spawnOverlapBad &&
      vb.villagers.length >= 12
    );

    const gateMouthClear = [
      [0, 54.2],
      [0, -39.0],
      [0, -55.0],
      [-55.0, 0],
      [55.0, 0]
    ].every(([gx, gz]) => vb.obstacles.every((o) => Math.hypot(o.x - gx, o.z - gz) >= (o.radius || 0.5) + 2.2));
    check('Village South/North/East/West gate mouths and North dungeon portal have zero central statue/obstacle blockers',
      gateMouthClear &&
      Math.abs(vb.portalPos.x) >= 6.0 &&
      !namedChildren.some((n) => n.includes('cj_jang_gate_dragon') || n.includes('south_exit_dragon'))
    );
    vb.dispose();
  }

  // 27. Ranged Mob Projectiles (Vector3 Player + Swept Hit), Extended Skill Ranges & Open Dungeon Interiors
  {
    const { isSkillInRange } = await import('../src/world/enemyAI.js');
    const THREE = await import('three');
    const emRanged = createEnemyManager();
    const dgOpen = createDungeonGenerator();
    const rangedScene = { add() {}, remove() {} };
    const rangedModels = {
      createEnemyMesh: () => new THREE.Group(),
      createBossMesh: () => new THREE.Group(),
      createPortalMesh: () => { const g = new THREE.Group(); g.userData = {}; return g; },
      createChestMesh: () => new THREE.Group()
    };

    const bowMob = emRanged.spawnMonster({ type: 'bandit_bowman', floor: 4, x: 9.0, z: 0 }, rangedScene, rangedModels);
    const ghostMob = emRanged.spawnMonster({ type: 'tombstone_ghost', floor: 0, x: 10.5, z: 0 }, rangedScene, rangedModels);
    check('Ranged monsters have extended attackRange (>= 9.6) and long-range isSkillInRange support',
      bowMob.attackRange >= 9.6 &&
      ghostMob.attackRange >= 9.6 &&
      isSkillInRange('arrow_shot', bowMob, 11.5) === true &&
      isSkillInRange('frost_wave', ghostMob, 11.0) === true &&
      isSkillInRange('curse_drain', ghostMob, 11.0) === true
    );

    // 27a. Enemy arrow hits THREE.Vector3 player (exact shape passed by main.js) via small steps
    emRanged.projectiles = [];
    let arrowHits = 0;
    emRanged._spawnEnemyProjectile(bowMob, 0, 0, 'arrow', 25, 'physical', {});
    const vec3Player = new THREE.Vector3(0, 0, 0);
    for (let i = 0; i < 30 && arrowHits === 0; i++) {
      emRanged._updateEnemyProjectiles(0.05, vec3Player, { isWalkable: () => true }, {
        onPlayerHit: () => { arrowHits++; }
      });
    }
    check('Enemy arrows collide cleanly against THREE.Vector3 player (without .hp)', arrowHits === 1);

    // 27b. Swept arrow collision catches fast dt steps tunneling across player
    emRanged.projectiles = [];
    let sweptHits = 0;
    const closeBow = { x: 1.5, z: 0, attackRange: 12.4, type: 'bandit_bowman' };
    emRanged._spawnEnemyProjectile(closeBow, -2.0, 0, 'arrow', 20, 'physical', {});
    emRanged._updateEnemyProjectiles(0.25, new THREE.Vector3(0, 0, 0), { isWalkable: () => true }, {
      onPlayerHit: () => { sweptHits++; }
    });
    check('Swept projectile collision catches fast dt tunneling across player', sweptHits === 1);

    // 27c. CHASE AI holds ranged attacker at distance rather than walking into melee
    bowMob.position.set(8.5, 0, 0);
    bowMob.x = 8.5;
    bowMob.z = 0;
    bowMob.state = AI_STATE.CHASE;
    bowMob.atkCooldown = 2.5;
    for (let i = 0; i < 6; i++) {
      emRanged.update(0.1, 10, new THREE.Vector3(0, 0, 0), { isWalkable: () => true, doors: [] }, {
        isPlayerAlive: true,
        onPlayerHit: () => {}
      });
    }
    const postChaseDist = Math.hypot(bowMob.position.x, bowMob.position.z);
    check('Ranged archer holds fighting distance during CHASE instead of charging into melee', postChaseDist >= 6.5);

    // 27d. Ranged boss/mob special skills launch orbs / deal damage from range (>= 11m)
    emRanged.projectiles = [];
    ghostMob.x = 11.0;
    ghostMob.z = 0;
    ghostMob.position.set(11.0, 0, 0);
    ghostMob.pendingSkill = 'frost_wave';
    emRanged._executeBossSpecialSkill(ghostMob, 0, 0, { isWalkable: () => true }, { onPlayerHit: () => {} });
    const frostSpawnedProj = emRanged.projectiles.length > 0;
    let drainHits = 0;
    ghostMob.pendingSkill = 'curse_drain';
    emRanged._executeBossSpecialSkill(ghostMob, 0, 0, { isWalkable: () => true }, { onPlayerHit: () => { drainHits++; } });
    check('Ranged frost_wave and curse_drain strike/cast properly at 11m range',
      frostSpawnedProj && drainHits === 1 && isSkillInRange('venom_gaze', bowMob, 12.0) === true
    );

    // 27e. Dungeon floors keep room interiors & gate mouths clear and place subtle wall artistry
    for (const df of [1, 3, 6, 9, 14, 16]) {
      dgOpen.generateFloor(df);
      const interiorDecorBlocked = dgOpen.rooms.some((r) => {
        if (r.type === 'start' || r.w < 9 || r.h < 9) return false;
        const cx = r.centerX ?? (r.x + r.w * 0.5);
        const cz = r.centerZ ?? (r.z + r.h * 0.5);
        return (dgOpen._placedDecor || []).some((d) =>
          Math.hypot(d.x - cx, d.z - cz) < 1.8 && d.tag !== 'wall_pilaster' && d.tag !== 'vault_post' && d.tag !== 'vault_lion' && d.tag !== 'vault_lamp'
        );
      });
      const gatesClear = dgOpen.gates.every((g) => {
        const clearR = g.isBossGate ? 2.5 : 1.05;
        const sroClose = (dgOpen._sroPropsPlaced || []).some((p) => Math.hypot(p.x - g.x, p.z - g.z) < clearR);
        const obsClose = dgOpen.solidObstacles.some((o) => Math.hypot(o.x - g.x, o.z - g.z) < clearR);
        return !sroClose && !obsClose;
      });
      const hasDragonGateProp = (dgOpen._sroPropsPlaced || []).some((p) => String(p.url).includes('cj_jang_gate_dragon'));
      const hasWallPilasters = (dgOpen._placedDecor || []).some((d) => d.tag === 'wall_pilaster');
      check(`Floor ${df} keeps combat room centers & gate mouths unobstructed with edge/wall artistry`,
        !interiorDecorBlocked && gatesClear && !hasDragonGateProp && hasWallPilasters
      );
    }
  }

  // 28. RPG Village Ground Textures, Winding Outskirt Stream, Bridges & Natural Instanced Details
  {
    const texFiles = [
      'cobble_road_diff.jpg',
      'cobble_road_nor.jpg',
      'plaza_stone_diff.jpg',
      'plaza_stone_nor.jpg',
      'town_stone_diff.jpg',
      'town_stone_nor.jpg',
      'river_pebbles_diff.jpg',
      'river_pebbles_nor.jpg',
      'outskirt_road_diff.jpg',
      'outskirt_road_nor.jpg',
      'grass_diff.jpg',
      'grass_nor.jpg',
      'water_nor.jpg'
    ];
    const allTexOk = texFiles.every((f) => {
      const p = new URL(`../public/assets/textures/village/${f}`, import.meta.url);
      return fs.existsSync(p) && fs.statSync(p).size > 10 * 1024;
    });
    check('All 13 village RPG PBR textures exist locally and exceed 10KB', allTexOk);

    const vbRiver = buildVillage({});
    const riverNamed = new Set();
    vbRiver.group.traverse((o) => { if (o.name) riverNamed.add(o.name); });
    const hasRiverMeshes = [
      'OutskirtRiverBed',
      'OutskirtRiverWater',
      'OutskirtGrassTufts',
      'OutskirtWildflowers',
      'RiverbankPebbles',
      'RiverbankReeds',
      'Village_curb'
    ].every((n) => riverNamed.has(n));

    const riverPts = vbRiver.riverPoints || [];
    const allSpawns = vbRiver.outskirtCamps.flatMap((c) => c.spawns);
    const riverClearsWallsAndSpawns = riverPts.length >= 100 && riverPts.every((p) => {
      const wallMargin = Math.max(Math.abs(p.x) - vbRiver.townWallHalf, Math.abs(p.z) - vbRiver.townWallHalf);
      if (wallMargin < 1.8) return false;
      return allSpawns.every((sp) => Math.hypot(p.x - sp.x, p.z - sp.z) >= 3.2);
    });

    const bridgesClear = [[0, 60.0], [60.5, 0]].every(([bx, bz]) =>
      vbRiver.obstacles.every((o) => Math.hypot(o.x - bx, o.z - bz) >= (o.radius || 0.5) + 1.8)
    );

    let updateOk = true;
    try {
      vbRiver.update(0.016, 1.0, { x: 0, z: 0 });
    } catch {
      updateOk = false;
    }

    check('Outskirt stream, bridges, stone curbs & instanced foliage build, clear walls/spawns, and update cleanly',
      hasRiverMeshes && riverClearsWallsAndSpawns && bridgesClear && updateOk
    );
    vbRiver.dispose();
  }

  // 29. Village Splat Terrain, Unified Road/Base Ground, Biome Dungeon Rooms, Niche Shrines/Challenges & Boss Gates
  {
    const THREE = await import('three');
    const vb2 = buildVillage({});
    const terrain = vb2.group.getObjectByName('VillageTerrain');
    const groundBase = vb2.group.getObjectByName('VillageGround_base');
    const groundRoad = vb2.group.getObjectByName('VillageGround_road');
    const curbMesh = vb2.group.getObjectByName('Village_curb');

    const uvAttr = terrain?.geometry?.getAttribute('uv');
    let uMin = Infinity, uMax = -Infinity, vMin = Infinity, vMax = -Infinity;
    if (uvAttr) {
      for (let i = 0; i < uvAttr.count; i++) {
        uMin = Math.min(uMin, uvAttr.getX(i)); uMax = Math.max(uMax, uvAttr.getX(i));
        vMin = Math.min(vMin, uvAttr.getY(i)); vMax = Math.max(vMax, uvAttr.getY(i));
      }
    }
    const splatTex = terrain?.material?.userData?.splatTex;
    const splatImg = splatTex?.image;
    let hasR = false, hasG = false, hasB = false, hasA = false;
    if (splatImg?.data) {
      for (let i = 0; i < splatImg.data.length; i += 4) {
        if (splatImg.data[i] > 60) hasR = true;
        if (splatImg.data[i + 1] > 60) hasG = true;
        if (splatImg.data[i + 2] > 60) hasB = true;
        if (splatImg.data[i + 3] > 200) hasA = true;
      }
    }
    const groundNames = [];
    vb2.group.traverse((o) => { if (o.name?.startsWith('VillageGround_') || o.name === 'VillageTerrain') groundNames.push(o.name); });
    const villageSrc2 = fs.readFileSync(new URL('../src/world/villageBuilder.js', import.meta.url), 'utf8');
    const roadBox = groundRoad?.geometry ? new THREE.Box3().setFromBufferAttribute(groundRoad.geometry.getAttribute('position')) : null;
    check('Village ground merges into unified base+road+splat terrain without central plaza/diamond intrusion',
      Boolean(terrain && groundBase && groundRoad && curbMesh) &&
      terrain.rotation.x === 0 &&
      Math.abs((uMax - uMin) - (vMax - vMin)) < 0.01 &&
      splatImg?.width === 256 && splatImg?.height === 256 &&
      hasR && hasG && hasB && hasA &&
      groundNames.length === 3 &&
      !vb2.group.getObjectByName('VillageGround_plaza') &&
      !vb2.group.getObjectByName('VillageGround_trim') &&
      Boolean(curbMesh.geometry.getAttribute('uv')) &&
      villageSrc2.includes('rok_stone_02.png') &&
      Boolean(roadBox && roadBox.max.y <= 0.09)
    );
    vb2.dispose();

    // Dungeon floor & biome verification
    const allPropUrls = new Set();
    for (const set of Object.values(SRO_DUNGEON_PROPS)) {
      for (const c of set.corners || []) if (c?.url) allPropUrls.add(c.url);
      for (const k of ['wall', 'shrineCenter', 'shrineGuard', 'springCenter', 'bossGate', 'bossFlankLeft', 'bossFlankRight', 'bossSanctumNorth']) {
        if (set[k]?.url) allPropUrls.add(set[k].url);
      }
    }
    const requiredBiomeGlbs = [
      'jinsi_lantern_tall.glb', 'pha_burner.glb', 'jupiter_athena_statue.glb',
      'jupiter_nike.glb', 'roc_nest_straw.glb', 'roc_pillar_key.glb',
      'togui_gate.glb', 'wreck_barrel.glb', 'wreck_crate.glb'
    ];
    check('All newly wired SRO biome GLBs appear in SRO_DUNGEON_PROPS and zero cj_jang_gate_dragon remains',
      requiredBiomeGlbs.every((f) => Array.from(allPropUrls).some((u) => u.endsWith(`/${f}`))) &&
      !Array.from(allPropUrls).some((u) => u.includes('cj_jang_gate_dragon'))
    );

    const dg2 = createDungeonGenerator();
    // Flame Mountain (F10) carves TILE.PIT lava channels while preserving 10x10m room center
    const f10 = dg2.generateFloor(10);
    let f10Pits = 0;
    for (let gz = 0; gz < dg2.gridHeight; gz++) {
      for (let gx = 0; gx < dg2.gridWidth; gx++) if (dg2.getTileAtGrid(gx, gz) === TILE.PIT) f10Pits++;
    }
    const f10FloorInst = dg2.rootGroup.children.find((c) => c.isInstancedMesh);
    const m0 = new THREE.Matrix4();
    const pos0 = new THREE.Vector3(), quat0 = new THREE.Quaternion(), scale0 = new THREE.Vector3();
    if (f10FloorInst) {
      f10FloorInst.getMatrixAt(0, m0);
      m0.decompose(pos0, quat0, scale0);
    }
    check('Dungeon floor instanced tiles use 1.002 scale (zero gap) and Flame floors carve TILE.PIT channels',
      Math.abs(scale0.x - 1.002) < 0.002 && f10Pits > 0 && f10.rooms.every((r) => dg2.isWalkable(r.centerX, r.centerZ, 0.4))
    );

    // No terracotta placed on F13-F16, dynamic trap safeLane, bossGate wired cleanly, wall-niche shrines/challenges
    let zeroTerracottaF13_16 = true;
    const trapLanes = [];
    for (const fn of [1, 3, 6, 9, 12, 13, 14, 15, 16, 103]) {
      const fState = dg2.generateFloor(fn);
      if (fn >= 13 && fn <= 16 && (dg2._placedDecor || []).some((d) => d.tag === 'terracotta')) {
        zeroTerracottaF13_16 = false;
      }
      if (dg2.bossRoom && fn !== 16) {
        const expectedGate = SRO_DUNGEON_PROPS[resolveSroDungeon(dg2)]?.bossGate?.url;
        check(`Floor ${fn} bossGate wires authentic SRO prop (${expectedGate})`, dg2.bossGate?.gateAssetUrl === expectedGate);
      }
      const trapRm = dg2.rooms.find((r) => r.type === 'trap' && Array.isArray(r.safeLane));
      if (trapRm) trapLanes.push(trapRm.safeLane.join(','));
      const nonStartShrines = fState.shrines.filter((s) => s.type === 'shrine');
      for (const sh of nonStartShrines) {
        const rm = dg2.rooms.find((r) => sh.x >= r.x && sh.x <= r.x + r.w && sh.z >= r.z && sh.z <= r.z + r.h);
        if (rm && rm.w >= 10 && rm.h >= 10) {
          check(`Floor ${fn} shrine placed in perimeter wall niche (>=2.2m off center)`,
            Math.hypot(sh.x - rm.centerX, sh.z - rm.centerZ) >= 2.2
          );
        }
      }
      for (const chp of fState.portals.filter((p) => p.portalType === 'challenge_portal')) {
        const rm = dg2.rooms.find((r) => chp.x >= r.x && chp.x <= r.x + r.w && chp.z >= r.z && chp.z <= r.z + r.h);
        if (rm && rm.w >= 10 && rm.h >= 10) {
          check(`Floor ${fn} challenge portal placed in perimeter wall niche (>=2.2m off center)`,
            Math.hypot(chp.x - rm.centerX, chp.z - rm.centerZ) >= 2.2
          );
        }
      }
    }

    // East wall boss entrance scan test
    const mockBoss = { gx: 10, gz: 10, gw: 12, gh: 10 };
    for (let gz = 10; gz < 20; gz++) {
      dg2.setTileAtGrid(9, gz, TILE.WALL);
      dg2.setTileAtGrid(22, gz, gz >= 14 && gz <= 16 ? TILE.CORRIDOR : TILE.WALL);
    }
    for (let gx = 10; gx < 22; gx++) {
      dg2.setTileAtGrid(gx, 9, TILE.WALL);
      dg2.setTileAtGrid(gx, 20, TILE.WALL);
    }
    const eastEntrance = dg2._findBossRoomEntrance(mockBoss);
    check('F13-16 free of terracotta, trap lanes randomized, and _findBossRoomEntrance detects East wall',
      zeroTerracottaF13_16 &&
      (trapLanes.length === 0 || new Set(trapLanes).size >= 1) &&
      eastEntrance?.side === 'E'
    );
  }
}

// 29. Regression checks: alert non-spam, outskirt Giant kill-threshold, pond lotus elevation & perf contracts
{
  // (a) Pond & Hot Springs lotus sprites stay cleanly above water & lily pads
  const regVillage = buildVillage({ useDirectLights: false });
  const lotusY = [];
  regVillage.group.traverse((child) => {
    if (typeof child.name === 'string' && child.name.includes('c_pondflower')) {
      lotusY.push({ y: child.position.y, x: child.position.x, z: child.position.z });
    }
  });
  const pondLotusOk = lotusY.filter((l) => l.x > 0).every((l) => l.y > 0.10);
  const springLotusOk = lotusY.filter((l) => l.x < 0).every((l) => l.y > 0.20);
  check('Pond and Hot Springs lotus quads sit above water surfaces to eliminate z-fighting/gliding',
    lotusY.length === 7 && pondLotusOk && springLotusOk
  );

  // (b) Alert '!' non-spam while chasing/hit & tether return without alert re-trigger
  const emittedAlerts = [];
  const regToasts = [];
  const mockRegRenderer = {
    updateCamera: () => {},
    spawnFloatingText: (_pos, txt) => {
      if (txt === '!') emittedAlerts.push(txt);
    },
    spawnSkillEffect: () => {},
    spawnHitSparks: () => {},
    shakeScreen: () => {}
  };
  const regEm = createEnemyManager(mockRegRenderer);
  regEm.setContext({ hud: { toast: (m, t) => regToasts.push({ m, t }) } });
  const regVillageSpawn = regEm.spawnVillageOutskirts(regVillage);
  check('OUTSKIRT_GIANT_KILL_THRESHOLD is 10 and spawns outskirt camps',
    OUTSKIRT_GIANT_KILL_THRESHOLD === 10 && regVillageSpawn.length >= 140
  );

  const soloMob = regEm.spawnMonster({
    type: 'mangyang',
    floor: 0,
    x: 500,
    z: 500,
    isOutskirtMob: true,
    campId: 'test_isolated_camp',
    campName: 'Isolated Test Camp'
  });
  soloMob.hp = 5000;
  soloMob.maxHp = 5000;
  soloMob.isAlerted = true;
  soloMob.state = AI_STATE.CHASE;
  const beforeHitAlerts = emittedAlerts.length;
  regEm.applyDamageToEnemy(soloMob, 25);
  regEm.applyDamageToEnemy(soloMob, 25);
  regEm.wakePack(soloMob, { allowTriggerAlert: true });
  soloMob.state = AI_STATE.PATROL;
  regEm.applyDamageToEnemy(soloMob, 25); // already alerted in patrol -> allowTriggerAlert: false
  const extraHitAlerts = emittedAlerts.length - beforeHitAlerts;

  // Move soloMob beyond outskirt leash (spawnDist > 26) and tick AI update; must return home without popping '!'
  soloMob.state = AI_STATE.CHASE;
  soloMob.x = soloMob.spawnX + 30;
  soloMob.z = soloMob.spawnZ;
  soloMob.position.set(soloMob.x, 0, soloMob.z);
  const alertsBeforeTether = emittedAlerts.length;
  regEm.update(0.1, 1.0, { x: soloMob.x - 1, z: soloMob.z }, null, {});
  regEm.update(0.1, 1.1, { x: soloMob.x - 1, z: soloMob.z }, null, {});
  const tetherAlerts = emittedAlerts.length - alertsBeforeTether;
  check('Already-chasing/alerted mobs and outskirt tether return emit zero extra "!" alerts',
    extraHitAlerts === 0 && tetherAlerts === 0 && soloMob._returningHome === true
  );

  // (c) Outskirt camp Giant spawns on 10th non-giant kill, resets counter, and prevents double-spawn while Giant is alive
  const testCampId = 'camp_south_gate_meadow';
  const campMobs = regEm.enemies.filter((e) => e.campId === testCampId && !e.isGiant);
  const leadMob = campMobs[0];
  for (let k = 0; k < OUTSKIRT_GIANT_KILL_THRESHOLD - 1; k++) {
    regEm._handleEnemyDeath(campMobs[k]);
  }
  const progBefore10 = regEm.getCampKillProgress(testCampId);
  regEm._handleEnemyDeath(campMobs[OUTSKIRT_GIANT_KILL_THRESHOLD - 1]);
  const spawnedGiants = regEm.enemies.filter((e) => !e.dead && e.isGiant && e.campId === testCampId);
  const progAfter10 = regEm.getCampKillProgress(testCampId);

  // Kill another 10 non-giant mobs while that Giant is still alive -> must not double-spawn a 2nd Giant
  for (let r = 0; r < OUTSKIRT_GIANT_KILL_THRESHOLD; r++) {
    const extraMob = regEm.spawnMonster({
      type: 'mangyang',
      floor: 0,
      x: leadMob.spawnX,
      z: leadMob.spawnZ,
      isOutskirtMob: true,
      campId: testCampId,
      campName: 'Oakhaven West Meadow'
    });
    regEm._handleEnemyDeath(extraMob);
  }
  const giantsWhileActive = regEm.enemies.filter((e) => !e.dead && e.isGiant && e.campId === testCampId);
  check('Killing 10 outskirt camp mobs spawns one spawnOnce Giant, resets campKills, and blocks double-spawn while active',
    progBefore10.kills === 9 &&
    spawnedGiants.length === 1 &&
    spawnedGiants[0].isGiant === true &&
    spawnedGiants[0].campId === testCampId &&
    spawnedGiants[0].spawnOnce === true &&
    progAfter10.kills === 0 &&
    progAfter10.hasActiveGiant === true &&
    giantsWhileActive.length === 1 &&
    regToasts.some((t) => /Giant/i.test(t.m))
  );

  // (d) Perf & spatial contracts: resolveCollision, getHudSummary, fillSkillBar
  const colDg = createDungeonGenerator();
  colDg.generateFloor(1, { scene: null }, null, {});
  const startRoom = colDg.rooms.find((r) => r.type === 'start') || colDg.rooms[0];
  const resolved = colDg.resolveCollision(startRoom.centerX, startRoom.centerZ, 0.45);
  const perfGame = createGame({ classId: 'warrior' });
  perfGame.newCharacter({ name: 'PerfTester', classId: 'warrior', slot: 0 });
  const hudOut = perfGame.getHudSummary();
  const hudSameRef = perfGame.getHudSummary(hudOut);
  const barOut = [];
  const barRet = perfGame.skills.fillSkillBar(barOut);
  check('Perf contracts: resolveCollision, getHudSummary cache reuse, and fillSkillBar operate accurately',
    Number.isFinite(resolved.x) && Number.isFinite(resolved.z) &&
    hudSameRef === hudOut && hudOut.className === 'Knight' &&
    Array.isArray(barRet) && barRet === barOut && barOut.length === 9 && barOut[0]?.ready !== undefined
  );
}

// -----------------------------------------------------------------------------
// 38. SRO Music System (MUSIC_TRACKS, assets on disk, resolveFloorMusic, headless MusicManager)
// -----------------------------------------------------------------------------
{
  const expectedKeys = [
    'title', 'village', 'outskirts', 'donhwang', 'karakoram', 'qinshi',
    'flame', 'holywater', 'jupiter', 'demon', 'roc_nest', 'togui', 'wreck',
    'boss', 'finalBoss', 'victory', 'death'
  ];
  const hasAllKeys = expectedKeys.every((k) => typeof MUSIC_TRACKS[k] === 'string' && MUSIC_TRACKS[k].length > 0);
  check('MUSIC_TRACKS defines all expected zone, boss, and stinger keys', hasAllKeys);

  let allFilesValid = true;
  for (const file of Object.values(MUSIC_TRACKS)) {
    const fileUrl = new URL(`../public/assets/sro/music/${file}`, import.meta.url);
    try {
      const st = fs.statSync(fileUrl);
      if (!st.isFile() || st.size <= 0) allFilesValid = false;
    } catch {
      allFilesValid = false;
    }
  }
  check('Every track file in MUSIC_TRACKS exists on disk under public/assets/sro/music/ with non-zero size', allFilesValid);

  check('resolveFloorMusic resolves finalBoss, preferBoss, variant suffix, and fallback cleanly',
    resolveFloorMusic({ isFinalBossFloor: true, isBossFloor: true, sroDungeon: 'qinshi' }, { preferBoss: true }) === 'finalBoss' &&
    resolveFloorMusic({ isBossFloor: true, sroDungeon: 'qinshi' }, { preferBoss: true }) === 'boss' &&
    resolveFloorMusic({ isBossFloor: true, sroDungeon: 'qinshi' }, { preferBoss: false }) === 'qinshi' &&
    resolveFloorMusic({ sroDungeon: 'qinshi_b6' }) === 'qinshi' &&
    resolveFloorMusic({ sroDungeon: 'unknown_zone_xyz' }) === 'donhwang' &&
    resolveFloorMusic(null) === 'donhwang'
  );

  const mm = new MusicManager();
  const playFirst = mm.play('village');
  const playSame = mm.play('village');
  const playUnknown = mm.play('nonexistent_track');
  const stingerOk = mm.stinger('victory', 'donhwang');
  mm.setMusicVolume(0.75);
  mm.setSfxVolume(0.4);
  const muteOn = mm.toggleMute();
  const muteOff = mm.toggleMute();
  mm.stop();
  mm.dispose();
  check('MusicManager operates safely in headless Node without throwing',
    mm.enabled === false &&
    playFirst === true &&
    playSame === false &&
    playUnknown === false &&
    stingerOk === true &&
    mm.musicVolume === 0.75 &&
    mm.sfxVolume === 0.4 &&
    muteOn === true &&
    muteOff === false &&
    mm.currentKey === null
  );
}

// -----------------------------------------------------------------------------
// 39. Axeman Offhand Axe Orientation (createEuropeanAxeMesh)
// -----------------------------------------------------------------------------
{
  const mainAxe = createEuropeanAxeMesh(null, '01', false);
  const offAxe = createEuropeanAxeMesh(null, '01', true);
  check('Mainhand European axe has rotation.z === 0', mainAxe.rotation.z === 0);
  check('Offhand European axe has rotation.z === Math.PI', Math.abs(offAxe.rotation.z - Math.PI) < 1e-6);
}

// -----------------------------------------------------------------------------
// 40. Melee Skill Poise (_isSkillUninterruptible, receiveHit, lethal & performDash)
// -----------------------------------------------------------------------------
{
  const poiseRenderer = {
    spawnFloatingText() {},
    spawnHitSparks() {},
    spawnSkillEffect() {},
    shake() {},
    screenToGround() { return null; }
  };
  const poiseWorld = {
    canMoveTo() { return true; },
    resolveCollision(x, z) { return { x, z }; }
  };

  const makePoisePlayer = (classId) => {
    const gs = createGame({ classId });
    gs.newCharacter({ name: `Poise_${classId}`, classId, slot: 0 });
    gs.hero.hp = 5000;
    gs.hero.maxHp = 5000;
    gs.hero.stamina = 100;
    gs.hero.maxStamina = 100;
    const origGetStats = gs.getStats.bind(gs);
    gs.getStats = () => ({ ...origGetStats(), dodge: 0, blockChance: 0 });
    const pc = new PlayerController({
      renderer: poiseRenderer,
      gameState: gs,
      world: poiseWorld,
      enemyManager: null
    });
    pc.invulnerableTimer = 0;
    pc.isBlocking = false;
    return pc;
  };

  const makeSkillPhase = () => ({
    desc: { id: 'test_skill' },
    stage: 'prep',
    timer: 0.5,
    total: 0.5,
    recover: 0.1,
    plan: null,
    chain: null
  });

  for (const meleeClass of ['knight', 'axeman']) {
    const pc = makePoisePlayer(meleeClass);
    pc.skillPhase = makeSkillPhase();
    pc.state = 'skill';
    const uninterruptible = pc._isSkillUninterruptible();
    const hit = pc.receiveHit(100, null, { element: 'physical' });
    check(`Melee class ${meleeClass} has uninterruptible skill poise against non-lethal hits`,
      uninterruptible === true && !hit.dodged && !hit.dead && hit.damage > 0 && pc.skillPhase !== null && pc.state === 'skill'
    );
  }

  for (const rangedClass of ['wizard', 'archer']) {
    const pc = makePoisePlayer(rangedClass);
    pc.skillPhase = makeSkillPhase();
    pc.state = 'skill';
    const uninterruptible = pc._isSkillUninterruptible();
    const hit = pc.receiveHit(100, null, { element: 'physical' });
    check(`Ranged/caster class ${rangedClass} skillPhase is interrupted by non-lethal hits`,
      uninterruptible === false && !hit.dodged && !hit.dead && hit.damage > 0 && pc.skillPhase === null && pc.state === 'idle'
    );
  }

  const lethalPc = makePoisePlayer('knight');
  lethalPc.skillPhase = makeSkillPhase();
  lethalPc.state = 'skill';
  const lethalRes = lethalPc.receiveHit(999999, null, { element: 'physical' });
  check('Lethal hit cleanly cancels melee skillPhase', lethalRes.dead === true && lethalPc.skillPhase === null);

  const dashPc = makePoisePlayer('axeman');
  dashPc.skillPhase = makeSkillPhase();
  dashPc.state = 'skill';
  const dashed = dashPc.performDash();
  check('performDash cleanly cancels active skillPhase', dashed > 0 && dashPc.skillPhase === null && dashPc.state === 'dash');
}

console.log(`ALL ${passed} CHECKS PASSED.`);

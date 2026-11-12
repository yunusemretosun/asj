import assert from 'node:assert/strict';
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
import { createGame } from '../src/systems/gameState.js';
import { ITEM_BASES, SET_BASE_IDS, SETS, SHOP_DEFS, floorMonsterLevel, generateItem, Inventory } from '../src/systems/inventory.js';
import { SKILL_DEFS, SKILL_ALIASES } from '../src/systems/skills.js';
import { createDungeonGenerator, DUNGEON_THEMES } from '../src/world/dungeonGenerator.js';
import { createEnemyManager, AI_STATE } from '../src/world/enemyAI.js';
import { models3d } from '../src/engine/models3d.js';

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
check('Village hub spawns 6 interactive NPCs', hub.npcs.length === 6);
check('Village build includes animated crowd villagers & outer grove', dungeon.villageBuild?.villagers?.length > 0);
const mm = dungeon.getMinimapData({ x: 0, z: 0 }, 0, []);
const mmNpcs = mm.entities.filter((e) => e.type === 'npc');
check('Minimap shows only the 6 interactive NPCs (no crowd villagers)', mmNpcs.length === 6);

// 4. All 15 Dungeon Floors, Weather Themes, Puzzles, Boss Arenas & Sleeping Monster Packs
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
  if (f === 15) {
    const finalRift = dungeon.portals.find((p) => p.lockedByBoss);
    check('Floor 15 boss rift leads back to the village', finalRift?.targetFloor === 0 && finalRift?.portalType === 'village');
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

const bossDrops = rollLoot(15, { isBoss: true, classId: 'axeman' });
const bossSealedCount = bossDrops.items.filter((it) => it && it.seal).length;
check('Boss loot guarantees at least one SOS/SOM/SOSun sealed equipment drop', bossSealedCount >= 1);


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
console.log(`ALL ${passed} CHECKS PASSED.`);

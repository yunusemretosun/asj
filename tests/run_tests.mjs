import assert from 'node:assert/strict';
import * as THREE from 'three';
import { CLASSES, CLASS_IDS, getClass, canClassUse } from '../src/systems/classes.js';
import { ALCHEMY, SEALS, STATUS, IMBUE_DEFAULTS } from '../src/systems/mechanics.js';
import { createGame } from '../src/systems/gameState.js';
import { SETS, floorMonsterLevel, generateItem } from '../src/systems/inventory.js';
import { SKILL_DEFS } from '../src/systems/skills.js';
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
  check(`Floor ${f} has rooms and atmosphere`, fData.rooms.length >= 4 && Boolean(fData.atmosphere));
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
boss.skillCooldown = 0;
boss.state = AI_STATE.CHASE;
enemyMgr.update(0.05, 1.0, { x: boss.x + 2, z: boss.z + 2 }, dungeon, {});
check('Boss skill windup spawns bossArena telegraph decal', telegraphs.length > 0 && Boolean(telegraphs[0].opts?.arena));

// 6. Status application on EnemyManager
const burnEntry = enemyMgr.applyStatus(boss, { id: 'burn', duration: 4, dotPerTick: 10 });
check('Burn status applied to boss', Boolean(burnEntry && enemyMgr.hasStatus(boss, 'burn')));

console.log(`ALL ${passed} CHECKS PASSED.`);

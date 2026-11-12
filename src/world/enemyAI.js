import * as THREE from 'three';
import {
  models3d as defaultModels3d,
  createMonsterMesh,
  createBossMesh
} from '../engine/models3d.js';
import { loadSROProp } from './dungeonDecor.js';
// rpg-systems: floor -> monster level mapping (see floorMonsterLevel docs in inventory.js)
import { floorMonsterLevel, generateItem } from '../systems/inventory.js';
// Milestone 2 & 5 shared contract: status effects, nemesis, boss mechanics
import { STATUS, NEMESIS, BOSS_MECHANICS, createNemesisTitle } from '../systems/mechanics.js';

const STATUS_FALLBACK = {
  burn: { id: 'burn', name: 'Burn', duration: 4, tick: 1, dotPctOfHit: 0.12, color: 0xff5522 },
  freeze: { id: 'freeze', name: 'Frozen', duration: 1.6, slowPct: 100, color: 0x6fd4ff },
  chill: { id: 'chill', name: 'Chilled', duration: 3, slowPct: 40, color: 0x93c5fd },
  shock: { id: 'shock', name: 'Shocked', duration: 2.5, dmgTakenPct: 15, color: 0xffee44 },
  poison: { id: 'poison', name: 'Poisoned', duration: 5, tick: 1, dotPctOfHit: 0.08, color: 0x7dff5a },
  stun: { id: 'stun', name: 'Stunned', duration: 1.0, color: 0xffffff },
  bleed: { id: 'bleed', name: 'Bleeding', duration: 4, tick: 1, dotPctOfHit: 0.1, color: 0xdc2626 }
};
const DOT_STATUSES = new Set(['burn', 'poison', 'bleed']);
// Ring color priority when several statuses are active (first match wins)
const STATUS_RING_PRIORITY = ['freeze', 'stun', 'shock', 'burn', 'poison', 'bleed', 'chill'];

function statusDef(id) {
  return (STATUS && STATUS[id]) || STATUS_FALLBACK[id] || null;
}

function colorToCss(c) {
  return typeof c === 'number' ? `#${c.toString(16).padStart(6, '0')}` : String(c || '#ffffff');
}

export const AI_STATE = {
  SLEEP: 'SLEEP',
  IDLE: 'IDLE',
  PATROL: 'PATROL',
  CHASE: 'CHASE',
  TELEGRAPH: 'TELEGRAPH',
  ATTACK: 'ATTACK',
  SKILL: 'SKILL',
  STUN: 'STUN',
  DEAD: 'DEAD'
};

export const MONSTER_CATALOG = {
  // =========================================================================
  // Authentic Silkroad Online Mob Roster
  // =========================================================================
  mangyang: {
    type: 'mangyang',
    name: 'Mangyang',
    glbPath: '/assets/sro/mobs/mangnyang.glb',
    targetHeight: 1.4,
    baseHp: 42,
    baseAtk: 8,
    baseDef: 3,
    baseExp: 16,
    baseGold: 8,
    moveSpeed: 3.4,
    attackRange: 1.6,
    aggroRange: 8.5,
    attackCooldown: 1.35,
    telegraphTime: 0.4,
    element: 'physical',
    color: 0x93c5fd,
    scale: 1.0
  },
  bigeye_ghost: {
    type: 'bigeye_ghost',
    name: 'Big-Eyed Ghost',
    glbPath: '/assets/sro/mobs/bigeyeghost.glb',
    targetHeight: 1.45,
    baseHp: 46,
    baseAtk: 11,
    baseDef: 3,
    baseExp: 20,
    baseGold: 9,
    moveSpeed: 4.5,
    attackRange: 2.2,
    aggroRange: 9.5,
    attackCooldown: 1.25,
    telegraphTime: 0.35,
    element: 'dark',
    color: 0x818cf8,
    scale: 1.0
  },
  gyo_weasel: {
    type: 'gyo_weasel',
    name: 'Weasel Gyo',
    glbPath: '/assets/sro/mobs/gyo.glb',
    targetHeight: 1.35,
    baseHp: 55,
    baseAtk: 12,
    baseDef: 4,
    baseExp: 22,
    baseGold: 11,
    moveSpeed: 4.8,
    attackRange: 1.7,
    aggroRange: 10.0,
    attackCooldown: 1.15,
    telegraphTime: 0.32,
    element: 'physical',
    color: 0xd97706,
    scale: 1.0
  },
  water_ghost: {
    type: 'water_ghost',
    name: 'Water Ghost',
    glbPath: '/assets/sro/mobs/waterghost.glb',
    targetHeight: 1.5,
    baseHp: 70,
    baseAtk: 16,
    baseDef: 5,
    baseExp: 30,
    baseGold: 14,
    moveSpeed: 4.0,
    attackRange: 3.8,
    aggroRange: 10.5,
    attackCooldown: 1.5,
    telegraphTime: 0.42,
    isRanged: true,
    element: 'ice',
    color: 0x38bdf8,
    scale: 1.05
  },
  stone_ghost: {
    type: 'stone_ghost',
    name: 'Stone Ghost',
    glbPath: '/assets/sro/mobs/stoneghost.glb',
    targetHeight: 1.75,
    baseHp: 150,
    baseAtk: 24,
    baseDef: 15,
    baseExp: 55,
    baseGold: 26,
    moveSpeed: 2.9,
    attackRange: 2.2,
    aggroRange: 9.0,
    attackCooldown: 1.75,
    telegraphTime: 0.55,
    element: 'earth',
    color: 0x94a3b8,
    scale: 1.25
  },
  tombstone_ghost: {
    type: 'tombstone_ghost',
    name: 'Tomb Stone Ghost',
    glbPath: '/assets/sro/mobs/tombstone.glb',
    targetHeight: 1.55,
    baseHp: 88,
    baseAtk: 18,
    baseDef: 8,
    baseExp: 35,
    baseGold: 16,
    moveSpeed: 3.2,
    attackRange: 1.85,
    aggroRange: 9.5,
    attackCooldown: 1.4,
    telegraphTime: 0.44,
    element: 'dark',
    color: 0x64748b,
    scale: 1.1
  },
  yeoha: {
    type: 'yeoha',
    name: 'Yeoha Tree Spirit',
    glbPath: '/assets/sro/mobs/yeoha.glb',
    targetHeight: 1.65,
    baseHp: 95,
    baseAtk: 19,
    baseDef: 7,
    baseExp: 38,
    baseGold: 18,
    moveSpeed: 3.6,
    attackRange: 2.4,
    aggroRange: 10.0,
    attackCooldown: 1.35,
    telegraphTime: 0.42,
    element: 'poison',
    color: 0x16a34a,
    scale: 1.1
  },
  bandit: {
    type: 'bandit',
    name: 'Black Tiger Bandit',
    glbPath: '/assets/sro/mobs/bandit.glb',
    targetHeight: 1.8,
    baseHp: 90,
    baseAtk: 20,
    baseDef: 7,
    baseExp: 40,
    baseGold: 20,
    moveSpeed: 4.4,
    attackRange: 1.85,
    aggroRange: 10.5,
    attackCooldown: 1.25,
    telegraphTime: 0.38,
    element: 'physical',
    color: 0xca8a04,
    scale: 1.05
  },
  bandit_archer: {
    type: 'bandit_archer',
    name: 'Bandit Bowman',
    glbPath: '/assets/sro/mobs/banditarcher.glb',
    targetHeight: 1.8,
    baseHp: 75,
    baseAtk: 22,
    baseDef: 5,
    baseExp: 38,
    baseGold: 19,
    moveSpeed: 4.1,
    attackRange: 5.2,
    aggroRange: 12.0,
    attackCooldown: 1.6,
    telegraphTime: 0.45,
    isRanged: true,
    element: 'physical',
    color: 0xa16207,
    scale: 1.05
  },
  tiger: {
    type: 'tiger',
    name: 'Jangan Tiger',
    glbPath: '/assets/sro/mobs/tiger.glb',
    targetHeight: 1.5,
    baseHp: 110,
    baseAtk: 23,
    baseDef: 8,
    baseExp: 45,
    baseGold: 22,
    moveSpeed: 5.2,
    attackRange: 1.8,
    aggroRange: 11.0,
    attackCooldown: 1.1,
    telegraphTime: 0.32,
    element: 'physical',
    color: 0xf97316,
    scale: 1.15
  },
  white_tiger: {
    type: 'white_tiger',
    name: 'White Tiger',
    glbPath: '/assets/sro/mobs/whitetiger.glb',
    targetHeight: 1.6,
    baseHp: 135,
    baseAtk: 27,
    baseDef: 10,
    baseExp: 55,
    baseGold: 26,
    moveSpeed: 5.4,
    attackRange: 1.9,
    aggroRange: 11.5,
    attackCooldown: 1.1,
    telegraphTime: 0.34,
    element: 'ice',
    color: 0xe2e8f0,
    scale: 1.2
  },
  blue_tiger: {
    type: 'blue_tiger',
    name: 'Blue Mountain Tiger',
    glbPath: '/assets/sro/mobs/bluetiger.glb',
    targetHeight: 1.7,
    baseHp: 155,
    baseAtk: 30,
    baseDef: 12,
    baseExp: 65,
    baseGold: 30,
    moveSpeed: 5.5,
    attackRange: 2.0,
    aggroRange: 12.0,
    attackCooldown: 1.15,
    telegraphTime: 0.36,
    element: 'lightning',
    color: 0x38bdf8,
    scale: 1.25
  },
  chakji: {
    type: 'chakji',
    name: 'Chakji Brute',
    glbPath: '/assets/sro/mobs/chakji.glb',
    targetHeight: 1.7,
    baseHp: 160,
    baseAtk: 28,
    baseDef: 13,
    baseExp: 60,
    baseGold: 28,
    moveSpeed: 3.8,
    attackRange: 2.1,
    aggroRange: 10.0,
    attackCooldown: 1.45,
    telegraphTime: 0.45,
    element: 'physical',
    color: 0x854d0e,
    scale: 1.2
  },
  ghost_bug: {
    type: 'ghost_bug',
    name: 'Ghost Bug',
    glbPath: '/assets/sro/mobs/ghostbug.glb',
    targetHeight: 1.25,
    baseHp: 65,
    baseAtk: 16,
    baseDef: 5,
    baseExp: 28,
    baseGold: 13,
    moveSpeed: 4.6,
    attackRange: 1.6,
    aggroRange: 9.5,
    attackCooldown: 1.2,
    telegraphTime: 0.32,
    element: 'poison',
    color: 0x22c55e,
    scale: 0.95
  },
  devil_bug: {
    type: 'devil_bug',
    name: 'Devil Bug',
    glbPath: '/assets/sro/mobs/devilbug.glb',
    targetHeight: 1.35,
    baseHp: 85,
    baseAtk: 21,
    baseDef: 7,
    baseExp: 38,
    baseGold: 18,
    moveSpeed: 5.0,
    attackRange: 1.8,
    aggroRange: 10.5,
    attackCooldown: 1.15,
    telegraphTime: 0.35,
    element: 'fire',
    color: 0xdc2626,
    scale: 1.05
  },
  hyungno: {
    type: 'hyungno',
    name: 'Hyungno Ghost Soldier',
    glbPath: '/assets/sro/mobs/hyungno.glb',
    targetHeight: 1.9,
    baseHp: 180,
    baseAtk: 32,
    baseDef: 16,
    baseExp: 75,
    baseGold: 35,
    moveSpeed: 4.0,
    attackRange: 2.2,
    aggroRange: 11.0,
    attackCooldown: 1.4,
    telegraphTime: 0.42,
    element: 'physical',
    color: 0x475569,
    scale: 1.22
  },
  earth_ghost: {
    type: 'earth_ghost',
    name: 'Earth Ghost',
    glbPath: '/assets/sro/mobs/earthghost.glb',
    targetHeight: 1.6,
    baseHp: 125,
    baseAtk: 26,
    baseDef: 11,
    baseExp: 52,
    baseGold: 25,
    moveSpeed: 3.5,
    attackRange: 3.6,
    aggroRange: 10.5,
    attackCooldown: 1.6,
    telegraphTime: 0.48,
    isRanged: true,
    element: 'earth',
    color: 0xa16207,
    scale: 1.15
  },
  gunpowder_ghost: {
    type: 'gunpowder_ghost',
    name: 'Gunpowder Ghost',
    glbPath: '/assets/sro/mobs/gunpowderghost_clon.glb',
    targetHeight: 1.45,
    baseHp: 105,
    baseAtk: 29,
    baseDef: 7,
    baseExp: 55,
    baseGold: 27,
    moveSpeed: 4.2,
    attackRange: 4.6,
    aggroRange: 11.5,
    attackCooldown: 1.7,
    telegraphTime: 0.5,
    isRanged: true,
    element: 'fire',
    color: 0xea580c,
    scale: 1.1
  },

  // =========================================================================
  // Mapped Legacy Entries (enhanced with Silkroad GLBs & exact target heights)
  // =========================================================================
  slime: {
    type: 'slime',
    name: 'Cavern Slime (Mangyang)',
    glbPath: '/assets/sro/mobs/mangnyang.glb',
    targetHeight: 1.4,
    baseHp: 38,
    baseAtk: 7,
    baseDef: 2,
    baseExp: 14,
    baseGold: 6,
    moveSpeed: 3.1,
    attackRange: 1.55,
    aggroRange: 8.5,
    attackCooldown: 1.4,
    telegraphTime: 0.42,
    element: 'poison',
    color: 0x22c55e,
    scale: 1.0
  },
  goblin: {
    type: 'goblin',
    name: 'Goblin Raider (Weasel Gyo)',
    glbPath: '/assets/sro/mobs/gyo.glb',
    targetHeight: 1.35,
    baseHp: 52,
    baseAtk: 10,
    baseDef: 3,
    baseExp: 20,
    baseGold: 10,
    moveSpeed: 4.3,
    attackRange: 1.75,
    aggroRange: 9.5,
    attackCooldown: 1.2,
    telegraphTime: 0.36,
    element: 'physical',
    color: 0x65a30d,
    scale: 1.0
  },
  bat: {
    type: 'bat',
    name: 'Dusk Vampire Bat (Big-Eyed Ghost)',
    glbPath: '/assets/sro/mobs/bigeyeghost.glb',
    targetHeight: 1.4,
    baseHp: 34,
    baseAtk: 9,
    baseDef: 2,
    baseExp: 16,
    baseGold: 7,
    moveSpeed: 5.2,
    attackRange: 1.5,
    aggroRange: 10.5,
    attackCooldown: 1.05,
    telegraphTime: 0.3,
    element: 'dark',
    color: 0x6d28d9,
    scale: 0.95
  },
  wolf: {
    type: 'wolf',
    name: 'Dire Shadow Wolf (Jangan Tiger)',
    glbPath: '/assets/sro/mobs/tiger.glb',
    targetHeight: 1.5,
    baseHp: 64,
    baseAtk: 13,
    baseDef: 4,
    baseExp: 25,
    baseGold: 12,
    moveSpeed: 5.0,
    attackRange: 1.75,
    aggroRange: 10.5,
    attackCooldown: 1.1,
    telegraphTime: 0.32,
    element: 'physical',
    color: 0x475569,
    scale: 1.05
  },
  spider: {
    type: 'spider',
    name: 'Venomfang Spider (Yeoha)',
    glbPath: '/assets/sro/mobs/yeoha.glb',
    targetHeight: 1.65,
    baseHp: 58,
    baseAtk: 12,
    baseDef: 4,
    baseExp: 24,
    baseGold: 11,
    moveSpeed: 4.6,
    attackRange: 1.65,
    aggroRange: 9.5,
    attackCooldown: 1.15,
    telegraphTime: 0.34,
    element: 'poison',
    color: 0x166534,
    scale: 1.0
  },
  skeleton: {
    type: 'skeleton',
    name: 'Restless Skeleton (Bandit)',
    glbPath: '/assets/sro/mobs/bandit.glb',
    targetHeight: 1.8,
    baseHp: 78,
    baseAtk: 15,
    baseDef: 6,
    baseExp: 32,
    baseGold: 15,
    moveSpeed: 3.9,
    attackRange: 1.85,
    aggroRange: 10.0,
    attackCooldown: 1.3,
    telegraphTime: 0.4,
    element: 'physical',
    color: 0xe2e8f0,
    scale: 1.05
  },
  mage: {
    type: 'mage',
    name: 'Abyssal Cultist Mage (Earth Ghost)',
    glbPath: '/assets/sro/mobs/earthghost.glb',
    targetHeight: 1.6,
    baseHp: 66,
    baseAtk: 19,
    baseDef: 5,
    baseExp: 38,
    baseGold: 18,
    moveSpeed: 3.5,
    attackRange: 4.8,
    aggroRange: 11.5,
    attackCooldown: 1.8,
    telegraphTime: 0.52,
    isRanged: true,
    element: 'dark',
    color: 0x7e22ce,
    scale: 1.05
  },
  orc: {
    type: 'orc',
    name: 'Orc Vanguard (Chakji)',
    glbPath: '/assets/sro/mobs/chakji.glb',
    targetHeight: 1.7,
    baseHp: 115,
    baseAtk: 22,
    baseDef: 9,
    baseExp: 46,
    baseGold: 22,
    moveSpeed: 3.8,
    attackRange: 2.05,
    aggroRange: 10.0,
    attackCooldown: 1.45,
    telegraphTime: 0.45,
    element: 'physical',
    color: 0x3f6212,
    scale: 1.18
  },
  golem: {
    type: 'golem',
    name: 'Runestone Golem (Stone Ghost)',
    glbPath: '/assets/sro/mobs/stoneghost.glb',
    targetHeight: 1.75,
    baseHp: 165,
    baseAtk: 27,
    baseDef: 15,
    baseExp: 62,
    baseGold: 30,
    moveSpeed: 2.8,
    attackRange: 2.3,
    aggroRange: 9.5,
    attackCooldown: 1.85,
    telegraphTime: 0.58,
    element: 'physical',
    color: 0x64748b,
    scale: 1.32
  },
  mummy: {
    type: 'mummy',
    name: 'Cursed Mummy (Tomb Stone Ghost)',
    glbPath: '/assets/sro/mobs/tombstone.glb',
    targetHeight: 1.55,
    baseHp: 92,
    baseAtk: 17,
    baseDef: 8,
    baseExp: 36,
    baseGold: 16,
    moveSpeed: 2.9,
    attackRange: 1.8,
    aggroRange: 9.5,
    attackCooldown: 1.45,
    telegraphTime: 0.45,
    element: 'poison',
    color: 0xd6d3d1,
    scale: 1.08
  },
  zombie: {
    type: 'zombie',
    name: 'Plague Zombie (Ghost Bug)',
    glbPath: '/assets/sro/mobs/ghostbug.glb',
    targetHeight: 1.25,
    baseHp: 98,
    baseAtk: 18,
    baseDef: 7,
    baseExp: 38,
    baseGold: 17,
    moveSpeed: 3.0,
    attackRange: 1.75,
    aggroRange: 9.5,
    attackCooldown: 1.4,
    telegraphTime: 0.42,
    element: 'poison',
    color: 0x4d7c0f,
    scale: 1.06
  },
  lizardman: {
    type: 'lizardman',
    name: 'Scaleblade Lizardman (Bandit Archer)',
    glbPath: '/assets/sro/mobs/banditarcher.glb',
    targetHeight: 1.8,
    baseHp: 120,
    baseAtk: 23,
    baseDef: 10,
    baseExp: 48,
    baseGold: 24,
    moveSpeed: 4.3,
    attackRange: 1.95,
    aggroRange: 10.5,
    attackCooldown: 1.25,
    telegraphTime: 0.38,
    element: 'poison',
    color: 0x15803d,
    scale: 1.12
  },
  wraith: {
    type: 'wraith',
    name: 'Phantom Wraith (Water Ghost)',
    glbPath: '/assets/sro/mobs/waterghost.glb',
    targetHeight: 1.5,
    baseHp: 88,
    baseAtk: 24,
    baseDef: 6,
    baseExp: 45,
    baseGold: 22,
    moveSpeed: 4.4,
    attackRange: 4.2,
    aggroRange: 11.0,
    attackCooldown: 1.6,
    telegraphTime: 0.44,
    isRanged: true,
    element: 'dark',
    color: 0x6366f1,
    scale: 1.08
  },
  gargoyle: {
    type: 'gargoyle',
    name: 'Obsidian Gargoyle (Devil Bug)',
    glbPath: '/assets/sro/mobs/devilbug.glb',
    targetHeight: 1.35,
    baseHp: 130,
    baseAtk: 25,
    baseDef: 13,
    baseExp: 54,
    baseGold: 26,
    moveSpeed: 4.7,
    attackRange: 1.85,
    aggroRange: 11.0,
    attackCooldown: 1.25,
    telegraphTime: 0.36,
    element: 'fire',
    color: 0x475569,
    scale: 1.2
  },
  stoneGolem: {
    type: 'stoneGolem',
    name: 'Ancient Stone Golem (Stone Ghost)',
    glbPath: '/assets/sro/mobs/stoneghost.glb',
    targetHeight: 1.85,
    baseHp: 175,
    baseAtk: 28,
    baseDef: 16,
    baseExp: 65,
    baseGold: 32,
    moveSpeed: 2.8,
    attackRange: 2.3,
    aggroRange: 9.5,
    attackCooldown: 1.85,
    telegraphTime: 0.58,
    element: 'physical',
    color: 0x64748b,
    scale: 1.35
  },
  hellHound: {
    type: 'hellHound',
    name: 'Infernal Hell Hound (Jangan Tiger)',
    glbPath: '/assets/sro/mobs/tiger.glb',
    targetHeight: 1.6,
    baseHp: 125,
    baseAtk: 26,
    baseDef: 9,
    baseExp: 52,
    baseGold: 25,
    moveSpeed: 5.3,
    attackRange: 1.8,
    aggroRange: 11.0,
    attackCooldown: 1.05,
    telegraphTime: 0.32,
    element: 'fire',
    color: 0xb91c1c,
    scale: 1.15
  },
  wizard: {
    type: 'wizard',
    name: 'Archon Chaos Wizard (Gunpowder Ghost)',
    glbPath: '/assets/sro/mobs/gunpowderghost_clon.glb',
    targetHeight: 1.5,
    baseHp: 110,
    baseAtk: 30,
    baseDef: 8,
    baseExp: 58,
    baseGold: 28,
    moveSpeed: 3.6,
    attackRange: 5.0,
    aggroRange: 12.0,
    attackCooldown: 1.65,
    telegraphTime: 0.48,
    isRanged: true,
    element: 'lightning',
    color: 0x9333ea,
    scale: 1.1
  },
  darkKnight: {
    type: 'darkKnight',
    name: 'Abyssal Dark Knight (Hyungno)',
    glbPath: '/assets/sro/mobs/hyungno.glb',
    targetHeight: 1.95,
    baseHp: 160,
    baseAtk: 31,
    baseDef: 14,
    baseExp: 64,
    baseGold: 32,
    moveSpeed: 3.9,
    attackRange: 2.15,
    aggroRange: 10.5,
    attackCooldown: 1.35,
    telegraphTime: 0.42,
    element: 'dark',
    color: 0x1e1b4b,
    scale: 1.24
  },
  demon: {
    type: 'demon',
    name: 'Hellfire Demon (Hyeongcheon Guard)',
    glbPath: '/assets/sro/mobs/hyeongcheon.glb',
    targetHeight: 2.1,
    baseHp: 180,
    baseAtk: 34,
    baseDef: 15,
    baseExp: 72,
    baseGold: 36,
    moveSpeed: 4.1,
    attackRange: 2.2,
    aggroRange: 11.0,
    attackCooldown: 1.35,
    telegraphTime: 0.42,
    element: 'fire',
    color: 0x991b1b,
    scale: 1.3
  }
};

// Aliases for thematic monster names
MONSTER_CATALOG.dark_mage = MONSTER_CATALOG.mage;
MONSTER_CATALOG.demon_hound = MONSTER_CATALOG.wolf;
MONSTER_CATALOG.fire_imp = MONSTER_CATALOG.gunpowder_ghost;
MONSTER_CATALOG.harpy = MONSTER_CATALOG.devil_bug;
MONSTER_CATALOG.minotaur = MONSTER_CATALOG.hyungno;
MONSTER_CATALOG.lich = MONSTER_CATALOG.earth_ghost;
MONSTER_CATALOG.abyssal_knight = MONSTER_CATALOG.darkKnight;
MONSTER_CATALOG.void_stalker = MONSTER_CATALOG.white_tiger;

export const MONSTER_DEFS = MONSTER_CATALOG;

export const ELITE_MODIFIERS = [
  {
    id: 'berserk',
    prefix: 'Berserk',
    hpMult: 1.85,
    atkMult: 1.45,
    defMult: 1.1,
    speedMult: 1.2,
    expMult: 2.4,
    color: 0xef4444,
    element: 'fire'
  },
  {
    id: 'vampiric',
    prefix: 'Vampiric',
    hpMult: 1.9,
    atkMult: 1.3,
    defMult: 1.2,
    speedMult: 1.12,
    expMult: 2.4,
    lifesteal: 0.35,
    color: 0x991b1b,
    element: 'dark'
  },
  {
    id: 'swift',
    prefix: 'Swiftblade',
    hpMult: 1.65,
    atkMult: 1.3,
    defMult: 1.05,
    speedMult: 1.45,
    expMult: 2.2,
    color: 0x38bdf8,
    element: 'lightning'
  },
  {
    id: 'ironclad',
    prefix: 'Ironclad',
    hpMult: 2.35,
    atkMult: 1.25,
    defMult: 1.75,
    speedMult: 0.95,
    expMult: 2.5,
    knockbackRes: 0.7,
    color: 0xfacc15,
    element: 'physical'
  },
  {
    id: 'molten',
    prefix: 'Molten',
    hpMult: 1.95,
    atkMult: 1.4,
    defMult: 1.25,
    speedMult: 1.1,
    expMult: 2.5,
    deathNova: true,
    color: 0xf97316,
    element: 'fire'
  },
  {
    id: 'frostborne',
    prefix: 'Frostborne',
    hpMult: 1.9,
    atkMult: 1.35,
    defMult: 1.3,
    speedMult: 1.1,
    expMult: 2.4,
    chillOnHit: true,
    color: 0x38bdf8,
    element: 'ice'
  }
];

export const BOSS_CATALOG = {
  3: {
    id: 'tiger_girl',
    legacyId: 'kimura',
    type: 'tigerwoman',
    name: 'Tiger Girl (Bicheon Champion)',
    title: 'Silkroad Unique Boss (Jangan Steppes)',
    glbPath: '/assets/sro/mobs/tigerwoman.glb',
    targetHeight: 2.1,
    hpMult: 5.5,
    atkMult: 1.85,
    defMult: 1.6,
    scale: 1.68,
    color: 0xef4444,
    element: 'fire',
    summonType: 'whitetiger',
    skills: ['shockwave', 'charge', 'summon']
  },
  6: {
    id: 'bandit_lord',
    legacyId: 'celestine',
    type: 'bandit',
    name: 'Black Tiger Bandit Leader',
    title: 'Silkroad Unique Boss (Bandit Stronghold)',
    glbPath: '/assets/sro/mobs/bandit.glb',
    targetHeight: 2.2,
    hpMult: 6.2,
    atkMult: 2.0,
    defMult: 1.65,
    scale: 1.65,
    color: 0xf97316,
    element: 'physical',
    summonType: 'bandit',
    skills: ['nova', 'summon', 'shockwave']
  },
  9: {
    id: 'earth_king',
    legacyId: 'onim',
    type: 'earthking',
    name: 'Earth Taoist King',
    title: 'Silkroad Unique Boss (Qin-Shi Tomb)',
    glbPath: '/assets/sro/mobs/earthking.glb',
    targetHeight: 2.3,
    hpMult: 7.0,
    atkMult: 2.15,
    defMult: 2.1,
    scale: 1.8,
    color: 0xfacc15,
    element: 'earth',
    summonType: 'stone_ghost',
    skills: ['shockwave', 'charge', 'nova']
  },
  12: {
    id: 'blue_tiger_boss',
    legacyId: 'chaos',
    type: 'bluetiger',
    name: 'Blue Tiger Sovereign',
    title: 'Silkroad Unique Boss (Mount Bicheon Peak)',
    glbPath: '/assets/sro/mobs/bluetiger.glb',
    targetHeight: 2.2,
    hpMult: 7.8,
    atkMult: 2.3,
    defMult: 2.0,
    scale: 1.85,
    color: 0x38bdf8,
    element: 'ice',
    summonType: 'tiger',
    skills: ['shockwave', 'nova', 'charge', 'summon']
  },
  15: {
    id: 'hyeongcheon',
    legacyId: 'devil',
    type: 'hyeongcheon',
    name: 'Hyeongcheon the Immortal',
    title: 'Silkroad Supreme Boss (Abyssal Tomb)',
    glbPath: '/assets/sro/mobs/hyeongcheon.glb',
    targetHeight: 2.4,
    hpMult: 9.0,
    atkMult: 2.5,
    defMult: 2.25,
    scale: 2.0,
    color: 0xdc2626,
    element: 'fire',
    summonType: 'hyungno',
    skills: ['shockwave', 'charge', 'nova', 'summon']
  }
};

BOSS_CATALOG.kimura = BOSS_CATALOG[3];
BOSS_CATALOG.tiger_girl = BOSS_CATALOG[3];
BOSS_CATALOG.celestine = BOSS_CATALOG[6];
BOSS_CATALOG.bandit_lord = BOSS_CATALOG[6];
BOSS_CATALOG.onim = BOSS_CATALOG[9];
BOSS_CATALOG.earth_king = BOSS_CATALOG[9];
BOSS_CATALOG.chaos = BOSS_CATALOG[12];
BOSS_CATALOG.blue_tiger_boss = BOSS_CATALOG[12];
BOSS_CATALOG.devil = BOSS_CATALOG[15];
BOSS_CATALOG.hyeongcheon = BOSS_CATALOG[15];

export const FLOOR_BOSSES = BOSS_CATALOG;

export const FLOOR_POOLS = {
  1: ['mangyang', 'gyo_weasel', 'bigeye_ghost', 'slime'],
  2: ['mangyang', 'gyo_weasel', 'tiger', 'goblin'],
  3: ['gyo_weasel', 'tiger', 'white_tiger', 'bigeye_ghost'],
  4: ['bandit', 'bandit_archer', 'water_ghost', 'tombstone_ghost'],
  5: ['bandit', 'bandit_archer', 'ghost_bug', 'yeoha'],
  6: ['bandit_archer', 'water_ghost', 'ghost_bug', 'yeoha'],
  7: ['stone_ghost', 'earth_ghost', 'chakji', 'gunpowder_ghost'],
  8: ['stone_ghost', 'earth_ghost', 'chakji', 'tombstone_ghost'],
  9: ['chakji', 'stone_ghost', 'gunpowder_ghost', 'earth_ghost'],
  10: ['white_tiger', 'blue_tiger', 'devil_bug', 'hyungno'],
  11: ['white_tiger', 'blue_tiger', 'devil_bug', 'hyungno'],
  12: ['blue_tiger', 'devil_bug', 'hyungno', 'chakji'],
  13: ['hyungno', 'chakji', 'gunpowder_ghost', 'blue_tiger'],
  14: ['hyungno', 'chakji', 'gunpowder_ghost', 'stone_ghost'],
  15: ['hyungno', 'gunpowder_ghost', 'blue_tiger', 'earth_ghost']
};

function attachHealthBarAndTelegraph(enemy) {
  const root = enemy.mesh;
  if (!root) return;

  // Floating 3D health bar above monster
  const barGroup = new THREE.Group();
  barGroup.name = 'HealthBar';
  barGroup.userData.keepWithGLB = true;
  const barY = enemy.isBoss ? 2.45 : enemy.isElite ? 1.95 : 1.65;
  barGroup.position.set(0, barY, 0);

  const width = enemy.isBoss ? 1.45 : enemy.isElite ? 1.05 : 0.82;
  const height = enemy.isBoss ? 0.13 : 0.09;

  const bgMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(width + 0.04, height + 0.04),
    new THREE.MeshBasicMaterial({ color: 0x0f172a, side: THREE.DoubleSide, transparent: true, opacity: 0.85 })
  );
  bgMesh.userData.noFlash = true;
  barGroup.add(bgMesh);

  const fillColor = enemy.isBoss ? 0xef4444 : enemy.isElite ? 0xfacc15 : 0x22c55e;
  const fillGeo = new THREE.PlaneGeometry(width, height);
  fillGeo.translate(width * 0.5, 0, 0);
  const fillMesh = new THREE.Mesh(
    fillGeo,
    new THREE.MeshBasicMaterial({ color: fillColor, side: THREE.DoubleSide })
  );
  fillMesh.position.set(-width * 0.5, 0, 0.01);
  fillMesh.userData.noFlash = true;
  barGroup.add(fillMesh);

  barGroup.visible = Boolean(enemy.isBoss || enemy.isElite);
  root.add(barGroup);

  // Ground telegraph warning ring (visible during TELEGRAPH / SKILL windup)
  const ringRadius = enemy.attackRange ? Math.max(1.1, Math.min(3.6, enemy.attackRange * 0.85)) : 1.4;
  const telegraphMesh = new THREE.Mesh(
    new THREE.RingGeometry(0.25, ringRadius, 24),
    new THREE.MeshBasicMaterial({
      color: 0xef4444,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.0
    })
  );
    telegraphMesh.rotation.x = -Math.PI / 2;
  telegraphMesh.position.y = 0.04;
  telegraphMesh.visible = false;
  telegraphMesh.name = 'TelegraphRing';
  telegraphMesh.userData.noFlash = true;
  root.add(telegraphMesh);

  enemy.healthBarGroup = barGroup;
  enemy.healthFillMesh = fillMesh;
  enemy.telegraphMesh = telegraphMesh;
}

export class EnemyAI {
  constructor(config = {}) {
    this.id = config.id || `enemy_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    this.type = config.type || 'goblin';
    this.name = config.name || 'Goblin Raider';
    this.title = config.title || '';
    this.floor = Number(config.floor || 1);
    this.level = Number(config.level || this.floor);

    this.isElite = Boolean(config.isElite);
    this.isBoss = Boolean(config.isBoss);
    this.modifier = config.modifier || null;

    this.maxHp = Math.max(10, Math.round(Number(config.maxHp || 50)));
    this.hp = this.maxHp;
    this.atk = Math.max(2, Math.round(Number(config.atk || 10)));
    this.def = Math.max(0, Math.round(Number(config.def || 3)));
    this.exp = Math.max(5, Math.round(Number(config.exp || 18)));
    this.gold = Math.max(2, Math.round(Number(config.gold || 10)));

    this.moveSpeed = Number(config.moveSpeed || 3.8);
    this.attackRange = Number(config.attackRange || 1.8);
    this.aggroRange = Number(config.aggroRange || 9.5);
    this.attackCooldownMax = Number(config.attackCooldown || 1.3);
    this.telegraphDuration = Number(config.telegraphTime || 0.42);
    this.element = config.element || 'physical';
    this.isRanged = Boolean(config.isRanged);

    this.radius = this.isBoss ? 0.95 : this.isElite ? 0.62 : 0.48;
    this.spawnX = Number(config.x || 0);
    this.spawnZ = Number(config.z || 0);
    this.x = this.spawnX;
    this.y = 0;
    this.z = this.spawnZ;
    this.position = new THREE.Vector3(this.x, 0, this.z);
    this.rotation = Math.random() * Math.PI * 2;

    this.packId = config.packId || null;
    this.sleeping = Boolean(config.sleeping && !this.isBoss);
    this.state = this.sleeping ? AI_STATE.SLEEP : AI_STATE.IDLE;
    this.stateTimer = 0.5 + Math.random() * 1.2;
    this.attackCooldown = Math.random() * 0.6;
    this.skillCooldown = 4.5 + Math.random() * 2.5;
    this.stunTimer = 0;
    // Active status effects keyed by STATUS id: { id, remaining, duration, tick, tickTimer, dotPerTick, slowPct, root, dmgTakenPct, color }
    this.statuses = {};
    this.statusRing = null;
    this.deathTimer = 0;
    this.dead = false;
    this.isDead = false;

    this.patrolTarget = { x: this.spawnX, z: this.spawnZ };
    this.pendingSkill = null;
    this.chargeDir = { x: 0, z: 1 };

    // Boss multi-phase state (Phases 1 -> 2 -> 3)
    this.phase = 1;
    this.maxPhases = this.isBoss ? 3 : 1;
    this.skills = config.skills || (this.isBoss ? ['shockwave', 'charge', 'summon'] : []);
    this.summonType = config.summonType || 'goblin';
    this.summonCount = 0;

    this.speed = this.moveSpeed;
    if (this.isBoss) {
      this.furyTimer = BOSS_MECHANICS.furyTimerSeconds;
      this.maxFuryTimer = BOSS_MECHANICS.furyTimerSeconds;
      this.isFurious = false;
      this.aegisTriggered = false;
      this.aegisActive = false;
    } else {
      this.furyTimer = 0;
      this.maxFuryTimer = 0;
      this.isFurious = false;
      this.aegisTriggered = false;
      this.aegisActive = false;
    }

    this.mesh = config.mesh || null;
    if (this.mesh) {
      this.mesh.position.set(this.x, 0, this.z);
      this.mesh.rotation.y = this.rotation;
      attachHealthBarAndTelegraph(this);
    }
  }

  syncHealthBar(camera = null) {
    if (!this.healthBarGroup || !this.healthFillMesh) return;
    if (this.dead) {
      this.healthBarGroup.visible = false;
      return;
    }
    if (this.hp < this.maxHp || this.isBoss || this.isElite) {
      this.healthBarGroup.visible = true;
    }
    const pct = Math.max(0, Math.min(1, this.hp / Math.max(1, this.maxHp)));
    this.healthFillMesh.scale.x = Math.max(0.001, pct);
    if (camera) {
      this.healthBarGroup.quaternion.copy(camera.quaternion);
    }
  }
}

export class EnemyManager {
  constructor(rendererOrOptions = null, models3dArg = null, dataArg = null) {
    this.renderer = null;
    this.scene = null;
    this.models3d = defaultModels3d;
    this.data = null;
    this.gameContext = null;

    this._applyInitArgs(rendererOrOptions, models3dArg, dataArg);

    this.rootGroup = new THREE.Group();
    this.rootGroup.name = 'EnemiesRoot';
    if (this.scene) {
      this.scene.add(this.rootGroup);
    }

    this.enemies = [];
    this.projectiles = [];
    this.currentFloor = 0;
    this.floorClearedNotified = false;
    this.elapsedTime = 0;
    this.lastCallbacks = {};
  }

  _applyInitArgs(rendererOrOptions, models3dArg, dataArg) {
    if (!rendererOrOptions) return;

    if (rendererOrOptions.isScene) {
      this.scene = rendererOrOptions;
    } else if (typeof rendererOrOptions === 'object') {
      if (rendererOrOptions.isWebGLRenderer || typeof rendererOrOptions.updateCamera === 'function') {
        this.renderer = rendererOrOptions;
        this.scene = rendererOrOptions.scene || this.scene;
      } else {
        this.gameContext = rendererOrOptions;
        if (rendererOrOptions.renderer) {
          this.renderer = rendererOrOptions.renderer;
          this.scene = rendererOrOptions.renderer.scene || this.scene;
        }
        if (rendererOrOptions.scene?.isScene) {
          this.scene = rendererOrOptions.scene;
        }
        if (rendererOrOptions.models3d) {
          this.models3d = rendererOrOptions.models3d;
        }
        if (rendererOrOptions.data || rendererOrOptions.extractedData) {
          this.data = rendererOrOptions.data || rendererOrOptions.extractedData;
        }
      }
    }

    if (models3dArg) this.models3d = models3dArg;
    if (dataArg) this.data = dataArg;
  }

  setContext(context = {}) {
    this._applyInitArgs(context);
    if (this.scene && this.rootGroup.parent !== this.scene) {
      this.scene.add(this.rootGroup);
    }
    return this;
  }

  get context() {
    return this.gameContext;
  }

  set context(v) {
    this.gameContext = v;
  }

  promoteToNemesis(enemy, nem) {
    if (!enemy) return null;
    enemy.isNemesis = true;
    enemy.isElite = true;
    enemy.name = nem.name || 'Nemesis';
    enemy.nemesisRank = nem.rank || 1;

    const hpMult = NEMESIS.hpMultBase + (enemy.nemesisRank - 1) * 0.25;
    const atkMult = NEMESIS.atkMultBase + (enemy.nemesisRank - 1) * 0.12;
    enemy.maxHp = Math.round(enemy.maxHp * hpMult);
    enemy.hp = enemy.maxHp;
    enemy.atk = Math.round(enemy.atk * atkMult);

    if (enemy.mesh) {
      enemy.mesh.scale.multiplyScalar(NEMESIS.scaleBase);
      const ringGeo = new THREE.RingGeometry(0.7 * NEMESIS.scaleBase, 0.95 * NEMESIS.scaleBase, 24);
      const ringMat = new THREE.MeshBasicMaterial({
        color: NEMESIS.color,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.82
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.06;
      enemy.mesh.add(ring);
      enemy.nemesisRing = ring;
    }

    if (enemy.healthBarGroup) {
      enemy.healthBarGroup.visible = true;
    }
    enemy.syncHealthBar?.(this.renderer?.camera);
    return enemy;
  }

  _ensureSceneAttached(sceneOverride = null) {
    if (sceneOverride?.isScene) {
      this.scene = sceneOverride;
    } else if (sceneOverride?.scene?.isScene) {
      this.renderer = sceneOverride;
      this.scene = sceneOverride.scene;
    }
    if (this.scene && this.rootGroup.parent !== this.scene) {
      this.scene.add(this.rootGroup);
    }
  }

  clearEnemies() {
    for (const e of this.enemies) this.clearStatuses(e);
    while (this.rootGroup.children.length > 0) {
      const child = this.rootGroup.children.pop();
      this.rootGroup.remove(child);
    }
    this.enemies = [];
    this.projectiles = [];
  }

  /**
   * Spawn monsters, elites, and bosses for the given dungeon floor
   */
  spawnFloorEnemies(floorData, floorNum = 1, sceneOverride = null, models3dOverride = null, extractedDataOverride = null) {
    if (models3dOverride) this.models3d = models3dOverride;
    if (extractedDataOverride) this.data = extractedDataOverride;
    this._ensureSceneAttached(sceneOverride);
    this.clearEnemies();

    const fNum = Number(floorNum ?? floorData?.floor ?? 1);
    this.currentFloor = fNum;
    this.floorClearedNotified = false;

    if (fNum <= 0 || floorData?.zone === 'village') {
      return this.enemies;
    }

    const rooms = floorData?.rooms || [];
    const pool = this._getMonsterPoolForFloor(fNum);

    rooms.forEach((room, idx) => {
      if (idx === 0 || room.type === 'start' || room.type === 'village') return;

      if (room.type === 'boss') {
        this._spawnBossInRoom(room, fNum);
        // Spawn 2 royal guards alongside the boss
        const guardType = pool[0] || 'goblin';
        this.spawnMonster({
          type: guardType,
          floor: fNum,
          x: room.centerX - 3.4,
          z: room.centerZ + 1.8
        });
        this.spawnMonster({
          type: guardType,
          floor: fNum,
          x: room.centerX + 3.4,
          z: room.centerZ + 1.8
        });
        return;
      }

      const count = room.type === 'combat'
        ? 3 + Math.min(3, Math.floor(fNum / 4))
        : room.type === 'exit'
        ? 3
        : 2;

      const packId = `pack_f${fNum}_r${idx}`;
      // Half of room packs slumber in a tight cluster and wake together when disturbed
      const packSleeping = idx % 2 === 1 && room.type !== 'exit';

      for (let i = 0; i < count; i++) {
        const mType = pool[(idx + i) % pool.length];
        const angle = (i / count) * Math.PI * 2 + idx * 0.5;
        const dist = packSleeping ? 1.15 + (i % 2) * 0.85 : 1.6 + (i % 2) * 1.4;
        const mx = room.centerX + Math.cos(angle) * dist;
        const mz = room.centerZ + Math.sin(angle) * dist;

        const isElite = (room.type === 'exit' && i === 0) || (room.type === 'treasure' && i === 0) || (i === count - 1 && Math.random() < 0.28);
        this.spawnMonster({
          type: mType,
          floor: fNum,
          x: mx,
          z: mz,
          isElite,
          packId,
          sleeping: packSleeping
        });
      }
    });

    // Nemesis Promotion
    const nem = this.context?.gameState?.nemesis || this.gameContext?.gameState?.nemesis;
    if (nem && Number(nem.floor) === Number(fNum)) {
      const nonBosses = this.enemies.filter((e) => !e.isBoss && !e.dead);
      const target = nonBosses.find((e) => e.type === nem.baseType) || nonBosses[0];
      if (target) {
        this.promoteToNemesis(target, nem);
      }
    }

    return this.enemies;
  }

  /**
   * Wake a sleeping monster and all packmates sharing its packId (or nearby sleeping monsters).
   * Returns the array of monsters that woke up on this call.
   */
  wakePack(enemyOrPackId) {
    const trigger = typeof enemyOrPackId === 'object' ? enemyOrPackId : null;
    const packId = typeof enemyOrPackId === 'string' ? enemyOrPackId : (trigger?.packId || null);
    const woken = [];
    for (const m of this.enemies) {
      if (m.dead) continue;
      const inSamePack = packId && m.packId === packId;
      const nearbyTrigger = trigger && Math.hypot(m.x - trigger.x, m.z - trigger.z) <= 6.5;
      if (m === trigger || inSamePack || nearbyTrigger) {
        if (m.sleeping || m.state === AI_STATE.SLEEP || m.state === AI_STATE.IDLE || m.state === AI_STATE.PATROL) {
          const wasSleeping = m.sleeping || m.state === AI_STATE.SLEEP;
          m.sleeping = false;
          if (m.state !== AI_STATE.STUN && m.state !== AI_STATE.TELEGRAPH && m.state !== AI_STATE.ATTACK && m.state !== AI_STATE.SKILL) {
            m.state = AI_STATE.CHASE;
          }
          if (wasSleeping) woken.push(m);
        }
      }
    }
    if (woken.length > 0 && this.renderer?.spawnFloatingText) {
      const lead = trigger || woken[0];
      this.renderer.spawnFloatingText({ x: lead.x, y: 1.1, z: lead.z }, '!', { color: '#facc15', isCrit: true });
    }
    return woken;
  }

  _getMonsterPoolForFloor(floorNum) {
    if (FLOOR_POOLS && FLOOR_POOLS[floorNum]) {
      return FLOOR_POOLS[floorNum];
    }
    if (floorNum <= 3) return ['mangyang', 'gyo_weasel', 'bigeye_ghost', 'slime'];
    if (floorNum <= 6) return ['bandit', 'bandit_archer', 'water_ghost', 'tombstone_ghost'];
    if (floorNum <= 9) return ['chakji', 'stone_ghost', 'gunpowder_ghost', 'earth_ghost'];
    if (floorNum <= 12) return ['white_tiger', 'blue_tiger', 'devil_bug', 'hyungno'];
    return ['hyungno', 'gunpowder_ghost', 'blue_tiger', 'earth_ghost'];
  }

  spawnMonster({ type = 'goblin', floor = 1, x = 0, z = 0, isElite = false, isBoss = false, packId = null, sleeping = false, customConfig = null }) {
    const base = MONSTER_CATALOG[type] || MONSTER_CATALOG.goblin;
    // rpg-systems: monster level is no longer the raw floor number; it comes from floorMonsterLevel(floor)
    // (floor 15 -> level 52) so every gear tier is reachable. customConfig.level overrides it.
    const level = Math.max(1, Number(customConfig?.level) || floorMonsterLevel(floor));

    // Level scaling curve matching ASJ progression
    const hpScale = 1 + (level - 1) * 0.34 + Math.pow(level - 1, 1.35) * 0.08;
    const atkScale = 1 + (level - 1) * 0.24;
    const defScale = 1 + (level - 1) * 0.22;
    const expScale = 1 + (level - 1) * 0.28;

    let mod = null;
    if (isElite && !isBoss) {
      mod = ELITE_MODIFIERS[Math.floor(Math.random() * ELITE_MODIFIERS.length)];
    }

    const name = customConfig?.name || (mod ? `${mod.prefix} ${base.name}` : base.name);
    const maxHp = Math.round(base.baseHp * hpScale * (mod?.hpMult || 1) * (customConfig?.hpMult || 1));
    const atk = Math.round(base.baseAtk * atkScale * (mod?.atkMult || 1) * (customConfig?.atkMult || 1));
    const def = Math.round(base.baseDef * defScale * (mod?.defMult || 1) * (customConfig?.defMult || 1));
    const exp = Math.round(base.baseExp * expScale * (mod?.expMult || 1) * (isBoss ? 5.0 : 1));
    const gold = Math.round(base.baseGold * (1 + level * 0.25) * (isBoss ? 6 : isElite ? 2.5 : 1));

    const color = customConfig?.color || mod?.color || base.color;
    const scale = (customConfig?.scale || base.scale || 1.0) * (isElite && !isBoss ? 1.22 : 1.0);
    const element = customConfig?.element || mod?.element || base.element;

    const meshBuilder = isBoss
      ? (this.models3d?.createBossMesh || createBossMesh)
      : (this.models3d?.createMonsterMesh || createMonsterMesh);

    const glbUrl = customConfig?.glbPath || base.glbPath || null;
    const targetHeight = customConfig?.targetHeight || base.targetHeight || (isBoss ? 2.2 : 1.55);

    const mesh = meshBuilder(base.meshType || type, {
      isElite,
      isBoss,
      color,
      scale,
      tier: Math.ceil(level / 3),
      name,
      glbPath: glbUrl,
      targetHeight
    });

    this.rootGroup.add(mesh);

    const enemy = new EnemyAI({
      id: customConfig?.id || `${type}_f${level}_${this.enemies.length + 1}`,
      type,
      name,
      title: customConfig?.title || (isElite ? 'Elite Monster' : ''),
      floor: Math.max(1, Number(floor) || 1), // real dungeon floor (boss summons re-map it via floorMonsterLevel)
      level,
      isElite,
      isBoss,
      modifier: mod,
      maxHp,
      atk,
      def,
      exp,
      gold,
      moveSpeed: base.moveSpeed * (mod?.speedMult || 1),
      attackRange: base.attackRange * (isBoss ? 1.45 : isElite ? 1.15 : 1),
      aggroRange: isBoss ? 15.0 : base.aggroRange,
      attackCooldown: base.attackCooldown,
      telegraphTime: base.telegraphTime,
      element,
      isRanged: base.isRanged,
      skills: customConfig?.skills || [],
      summonType: customConfig?.summonType || 'goblin',
      packId: packId || customConfig?.packId || null,
      sleeping: Boolean(sleeping || customConfig?.sleeping),
      x,
      z,
      mesh
    });

    this.enemies.push(enemy);
    return enemy;
  }

  _spawnBossInRoom(bossRoom, floorNum) {
    const templateKey = [3, 6, 9, 12, 15].find((k) => k >= floorNum) || 15;
    const bossCfg = BOSS_CATALOG[floorNum] || BOSS_CATALOG[templateKey] || BOSS_CATALOG[3];

    return this.spawnMonster({
      type: bossCfg.type,
      floor: floorNum,
      x: bossRoom.centerX,
      z: bossRoom.centerZ,
      isBoss: true,
      customConfig: bossCfg
    });
  }

  getAliveEnemies() {
    return this.enemies.filter((e) => !e.dead);
  }

  getActiveBoss() {
    const boss = this.enemies.find((e) => e.isBoss && !e.dead);
    if (!boss) return null;
    return {
      id: boss.id,
      name: boss.name,
      title: boss.title,
      hp: boss.hp,
      maxHp: boss.maxHp,
      phase: boss.phase,
      maxPhases: boss.maxPhases,
      isBoss: true,
      entity: boss
    };
  }

  /**
   * Spatial query: get alive enemies within radius of (x, z) or ({x, z}, radius)
   */
  getEnemiesInRange(posOrX, zOrRadius = 2.5, maybeRadius = 2.5) {
    let x = 0;
    let z = 0;
    let range = 2.5;
    if (typeof posOrX === 'object' && posOrX !== null) {
      x = Number(posOrX.x || 0);
      z = Number(posOrX.z || 0);
      range = Number(zOrRadius || 2.5);
    } else {
      x = Number(posOrX || 0);
      z = Number(zOrRadius || 0);
      range = Number(maybeRadius || 2.5);
    }

    return this.enemies.filter((e) => {
      if (e.dead) return false;
      const dist = Math.hypot(e.x - x, e.z - z);
      return dist <= range + e.radius;
    });
  }

  getEnemiesInRadius(posOrX, rOrZ = 2.5, maybeR = 2.5) {
    return this.getEnemiesInRange(posOrX, rOrZ, maybeR);
  }

  /**
   * Spatial query: get alive enemies inside a melee/skill arc.
   * Supports both 5-arg (x, z, yaw, range, arcAngle) and 4-arg (originVec, dirOrYaw, range, arcAngle).
   */
  getEnemiesInArc(originOrX, dirOrZ, rotOrRange = 0, rangeOrArc = 2.5, maybeArc = Math.PI) {
    let ox = 0;
    let oz = 0;
    let forwardX = 0;
    let forwardZ = 1;
    let range = 2.5;
    let arcAngle = Math.PI;

    if (typeof originOrX === 'object' && originOrX !== null) {
      ox = Number(originOrX.x || 0);
      oz = Number(originOrX.z || 0);
      range = Number(rotOrRange || 2.5);
      arcAngle = Number(rangeOrArc || Math.PI);
      if (typeof dirOrZ === 'number') {
        forwardX = Math.sin(dirOrZ);
        forwardZ = Math.cos(dirOrZ);
      } else if (typeof dirOrZ === 'object' && dirOrZ !== null) {
        const len = Math.hypot(dirOrZ.x || 0, dirOrZ.z || 0) || 1;
        forwardX = (dirOrZ.x || 0) / len;
        forwardZ = (dirOrZ.z || 0) / len;
      }
    } else {
      ox = Number(originOrX || 0);
      oz = Number(dirOrZ || 0);
      const yaw = Number(rotOrRange || 0);
      forwardX = Math.sin(yaw);
      forwardZ = Math.cos(yaw);
      range = Number(rangeOrArc || 2.5);
      arcAngle = Number(maybeArc || Math.PI);
    }

    const halfCos = Math.cos(arcAngle * 0.5);
    return this.enemies.filter((e) => {
      if (e.dead) return false;
      const dx = e.x - ox;
      const dz = e.z - oz;
      const dist = Math.hypot(dx, dz);
      if (dist > range + e.radius) return false;
      if (dist < 0.75 + e.radius * 0.5) return true;
      const dot = (dx / dist) * forwardX + (dz / dist) * forwardZ;
      return dot >= halfCos;
    });
  }

  /**
   * Apply damage, hit-stun, knockback, boss phase transitions, and death triggers
   */
  applyDamageToEnemy(enemyOrId, amount, options = {}) {
    const enemy = typeof enemyOrId === 'string'
      ? this.enemies.find((e) => e.id === enemyOrId)
      : enemyOrId;

    if (!enemy || enemy.dead) return { hit: false, killed: false, damage: 0 };

    let rawDamage = Number(amount) || 1;
    // Boss Elemental Aegis Barrier damage reduction (80% reduction)
    if (enemy.isBoss && enemy.aegisActive) {
      rawDamage *= (1 - BOSS_MECHANICS.aegisDamageReduction);
    }

    // Shock: +dmgTakenPct% damage taken (callers that already scaled pass statusScaled: true)
    const takenMult = options.statusScaled ? 1 : this.getDamageTakenMult(enemy);
    const dmg = Math.max(1, Math.round(rawDamage * takenMult));
    enemy.hp = Math.max(0, enemy.hp - dmg);
    if (!options.isDot) enemy.mesh?.userData?.triggerHitFlash?.(0.15);
    if (enemy.sleeping || enemy.state === AI_STATE.SLEEP || enemy.packId) {
      this.wakePack(enemy);
    }

    // Apply knockback
    const kbResist = enemy.isBoss ? 0.85 : (enemy.modifier?.knockbackRes || 0);
    const kbForce = Number(options.knockback ?? 0.55) * (1 - kbResist);
    const kbDir = options.knockbackDir;
    if (kbForce > 0.02 && kbDir) {
      const len = Math.hypot(kbDir.x || 0, kbDir.z || 0) || 1;
      const nx = enemy.x + ((kbDir.x || 0) / len) * kbForce;
      const nz = enemy.z + ((kbDir.z || 0) / len) * kbForce;
      const world = options.world || this.gameContext?.dungeon || this.gameContext?.world;
      if (!world || world.isWalkable(nx, nz, enemy.radius)) {
        enemy.x = nx;
        enemy.z = nz;
        enemy.position.set(enemy.x, 0, enemy.z);
        if (enemy.mesh) enemy.mesh.position.set(enemy.x, 0, enemy.z);
      }
    }

    // Check Boss multi-phase transitions at 65% and 30% HP
    if (enemy.isBoss && enemy.hp > 0) {
      const hpRatio = enemy.hp / enemy.maxHp;
      if (enemy.phase === 1 && hpRatio <= 0.65) {
        this._triggerBossPhaseTransition(enemy, 2);
      } else if (enemy.phase === 2 && hpRatio <= 0.32) {
        this._triggerBossPhaseTransition(enemy, 3);
      }
    }

    // Boss Elemental Aegis Crystals trigger at aegisTriggerRatio (<= 55% HP)
    if (enemy.isBoss && enemy.hp > 0 && !enemy.aegisTriggered && (enemy.hp / enemy.maxHp) <= BOSS_MECHANICS.aegisTriggerRatio) {
      this.spawnBossAegisCrystals(enemy);
    }

    // Light hit-stun on regular monsters if not mid-boss-skill (DoT ticks never re-trigger it)
    if (enemy.hp > 0 && !enemy.isBoss && !options.isDot && !options.noStun && enemy.state !== AI_STATE.TELEGRAPH) {
      const wasStunned = enemy.state === AI_STATE.STUN;
      enemy.state = AI_STATE.STUN;
      enemy.stunTimer = wasStunned ? Math.max(enemy.stunTimer, 0.16) : 0.16;
    }

    enemy.syncHealthBar(this.renderer?.camera);

    if (enemy.hp <= 0) {
      this._handleEnemyDeath(enemy, options);
      return { hit: true, killed: true, damage: dmg, enemy };
    }

    return { hit: true, killed: false, damage: dmg, enemy };
  }

  damageEnemy(enemy, amount, isCrit = false, knockbackDir = null, element = 'physical', callbacks = null) {
    let opts = {};
    if (typeof isCrit === 'object' && isCrit !== null) {
      opts = { ...isCrit };
    } else {
      opts = {
        isCrit: Boolean(isCrit),
        knockbackDir,
        element,
        knockback: isCrit ? 0.95 : 0.5,
        callbacks
      };
    }
    return this.applyDamageToEnemy(enemy, amount, opts);
  }

  spawnBossAegisCrystals(boss) {
    if (!boss || boss.aegisTriggered) return;
    boss.aegisTriggered = true;
    boss.aegisActive = true;

    const count = BOSS_MECHANICS.aegisCrystalCount;
    const crystalHp = Math.max(40, Math.round(boss.maxHp * BOSS_MECHANICS.aegisCrystalHpRatio));

    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const cx = boss.x + Math.cos(angle) * 4.5;
      const cz = boss.z + Math.sin(angle) * 4.5;

      const crystalGeo = new THREE.OctahedronGeometry(0.55, 0);
      const crystalMat = new THREE.MeshStandardMaterial({
        color: i % 2 === 0 ? 0x38bdf8 : 0xc084fc,
        emissive: new THREE.Color(i % 2 === 0 ? 0x0284c7 : 0x7c3aed),
        emissiveIntensity: 0.9,
        roughness: 0.2,
        metalness: 0.8
      });
      const crystalMesh = new THREE.Mesh(crystalGeo, crystalMat);
      crystalMesh.position.set(cx, 1.2, cz);
      this.rootGroup.add(crystalMesh);

      crystalMesh.userData.animate = (time = 0) => {
        crystalMesh.rotation.y = time * 2.2;
        crystalMesh.position.y = 1.2 + Math.sin(time * 3 + i) * 0.15;
      };

      const crystal = new EnemyAI({
        id: `aegis_crystal_${boss.id}_${i + 1}`,
        type: 'aegis_crystal',
        name: 'Elemental Aegis Crystal',
        floor: boss.floor,
        level: boss.level,
        isElite: false,
        isBoss: false,
        maxHp: crystalHp,
        atk: 0,
        def: Math.round(boss.def * 0.5),
        exp: Math.round(boss.exp * 0.08),
        gold: 0,
        moveSpeed: 0,
        x: cx,
        z: cz,
        mesh: crystalMesh
      });
      crystal.hp = crystalHp;
      crystal.isAegisCrystal = true;
      crystal.parentBossId = boss.id;
      crystal.speed = 0;
      crystal.moveSpeed = 0;

      this.enemies.push(crystal);
    }

    const toastMsg = `🛡️ ${boss.name} summoned ${count} Elemental Aegis Crystals! Barrier active!`;
    const hud = this.context?.hud || this.gameContext?.hud;
    hud?.toast?.(toastMsg, 'warning');
    hud?.showToast?.(toastMsg, 'warning');
  }

  _triggerBossPhaseTransition(boss, newPhase) {
    boss.phase = newPhase;
    boss.moveSpeed *= 1.15;
    boss.atk = Math.round(boss.atk * 1.18);
    boss.state = AI_STATE.SKILL;
    boss.pendingSkill = 'shockwave';
    boss.stateTimer = 0.55;

    if (this.renderer?.spawnSkillEffect) {
      this.renderer.spawnSkillEffect('shockwave', boss.position, 0, {
        color: 0xef4444,
        radius: 4.5
      });
      this.renderer.shake?.(0.4, 0.3);
    }

    const msg = `${boss.name} enters Phase ${newPhase}!`;
    this.gameContext?.hud?.showToast?.(msg, 'warning');
    this.gameContext?.hud?.toast?.(msg, 'kill');
  }

  _handleEnemyDeath(enemy, options = {}) {
    if (enemy.dead) return;
    enemy.dead = true;
    enemy.isDead = true;
    enemy.state = AI_STATE.DEAD;
    enemy.deathTimer = 1.05;
    this.clearStatuses(enemy);

    if (enemy.telegraphMesh) enemy.telegraphMesh.visible = false;
    if (enemy.healthBarGroup) enemy.healthBarGroup.visible = false;

    const ctx = this.gameContext || {};
    const world = options.world || ctx.dungeon || ctx.world;
    const gameState = options.gameState || ctx.gameState;

    // Molten elite death explosion visual
    if (enemy.modifier?.deathNova && this.renderer?.spawnSkillEffect) {
      this.renderer.spawnSkillEffect('fireball', enemy.position, 0, { color: 0xff5522, radius: 2.8 });
    }

    // Trigger RPG systems EXP, Gold, Loot Roll & Quest kill hooks
    let rewards = { exp: enemy.exp, gold: enemy.gold, drops: [] };
    if (gameState && typeof gameState.onMonsterKilled === 'function') {
      rewards = gameState.onMonsterKilled({
        id: enemy.id,
        type: enemy.type,
        name: enemy.name,
        level: enemy.level,
        exp: enemy.exp,
        gold: enemy.gold,
        isElite: enemy.isElite,
        isBoss: enemy.isBoss,
        floor: enemy.floor
      }) || rewards;
    }

    // Nemesis Vengeance Claim
    if (enemy.isNemesis) {
      const gs = this.context?.gameState || this.gameContext?.gameState || gameState;
      const hud = this.context?.hud || this.gameContext?.hud || ctx.hud;
      const veng = gs?.claimNemesisVengeance?.(enemy);
      const goldRefund = veng?.goldRefund || 0;
      const bonusExp = veng?.bonusExp || 0;
      hud?.toast?.(`⚔ VENGEANCE CLAIMED! +${goldRefund}G, +${bonusExp} EXP`, 'levelup');
      hud?.showToast?.(`⚔ VENGEANCE CLAIMED! +${goldRefund}G, +${bonusExp} EXP`, 'levelup');

      // Guarantee an equipment drop with a Seal (star / moon / sun)
      const sealPool = ['star', 'moon', 'sun'];
      const sealChoice = veng?.seal || sealPool[Math.floor(Math.random() * sealPool.length)];
      const sealedDrop = generateItem({
        level: enemy.level || floorMonsterLevel(enemy.floor || this.currentFloor),
        isElite: true,
        seal: sealChoice,
        minRarity: 'rare'
      });
      if (sealedDrop) {
        rewards.drops = rewards.drops || [];
        rewards.drops.push(sealedDrop);
      }
    }

    // Elemental Aegis Crystal death shatter check
    if (enemy.isAegisCrystal) {
      const remainingCrystals = this.enemies.filter(
        (e) => !e.dead && e !== enemy && e.isAegisCrystal && e.parentBossId === enemy.parentBossId
      );
      if (remainingCrystals.length === 0) {
        const parentBoss = this.enemies.find((e) => e.id === enemy.parentBossId && !e.dead);
        if (parentBoss) {
          parentBoss.aegisActive = false;
          const shatterMsg = `💥 ${parentBoss.name}'s Elemental Aegis Barrier shattered!`;
          const hud = this.context?.hud || this.gameContext?.hud || ctx.hud;
          hud?.toast?.(shatterMsg, 'levelup');
          hud?.showToast?.(shatterMsg, 'levelup');
        }
      }
    }

    // Spawn 3D ground loot for gold & dropped items
    if (world && typeof world.spawnGroundLoot === 'function') {
      if (rewards.gold > 0) {
        world.spawnGroundLoot(
          { x: enemy.x + (Math.random() - 0.5) * 0.8, z: enemy.z + (Math.random() - 0.5) * 0.8 },
          { type: 'gold', name: `${rewards.gold} Gold`, amount: rewards.gold, rarity: 'normal' }
        );
      }
      if (Array.isArray(rewards.drops)) {
        rewards.drops.forEach((drop, i) => {
          const angle = (i / Math.max(1, rewards.drops.length)) * Math.PI * 2;
          world.spawnGroundLoot(
            { x: enemy.x + Math.cos(angle) * 0.9, z: enemy.z + Math.sin(angle) * 0.9 },
            drop
          );
        });
      }
    }

    if (this.renderer?.spawnFloatingText) {
      this.renderer.spawnFloatingText(
        { x: enemy.x, y: 1.1, z: enemy.z },
        `+${rewards.exp || enemy.exp} EXP`,
        { type: 'exp' }
      );
    }

    if (enemy.isBoss) {
      world?.unlockBossRoomRewards?.();
      world?.unlockFloor?.(this.currentFloor + 1);
      ctx.hud?.showToast?.(`Victory! ${enemy.name} has been vanquished!`, 'kill');
      ctx.hud?.toast?.(`Victory! ${enemy.name} has been vanquished!`, 'kill');
    }

    const onKilledCb =
      options.callbacks?.onEnemyKilled ||
      this.lastCallbacks?.onEnemyKilled ||
      ctx.onEnemyKilled;

    if (typeof onKilledCb === 'function') {
      onKilledCb(enemy, rewards);
    }

    const remaining = this.getAliveEnemies().length;
    if (remaining === 0 && !this.floorClearedNotified && this.currentFloor > 0) {
      this.floorClearedNotified = true;
      gameState?.floorCleared?.(this.currentFloor);
      world?.unlockFloor?.(this.currentFloor + 1);
      ctx.hud?.showToast?.(`Floor ${this.currentFloor} Cleared!`, 'quest');
      ctx.hud?.toast?.(`Floor ${this.currentFloor} Cleared!`, 'quest');
    }
  }

  _killEnemy(enemy, options = {}) {
    return this._handleEnemyDeath(enemy, options);
  }

  triggerBossFury(enemy) {
    if (!enemy || enemy.isFurious) return;
    enemy.isFurious = true;
    enemy.atk = Math.round(enemy.atk * BOSS_MECHANICS.furyAtkMult);
    enemy.speed = (enemy.speed || enemy.moveSpeed || 3.2) * BOSS_MECHANICS.furySpeedMult;
    enemy.moveSpeed = enemy.speed;

    if (enemy.mesh) {
      enemy.mesh.traverse((child) => {
        if (child.isMesh && child.material) {
          const mat = child.material;
          if (mat.color && typeof mat.color.setHex === 'function') mat.color.setHex(0xef4444);
          if (mat.emissive && typeof mat.emissive.setHex === 'function') {
            mat.emissive.setHex(0xb91c1c);
            mat.emissiveIntensity = 0.85;
          }
        }
      });
      const furyRingGeo = new THREE.RingGeometry(1.2, 1.45, 24);
      const furyRingMat = new THREE.MeshBasicMaterial({
        color: 0xef4444,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.85
      });
      const furyRing = new THREE.Mesh(furyRingGeo, furyRingMat);
      furyRing.rotation.x = -Math.PI / 2;
      furyRing.position.y = 0.08;
      enemy.mesh.add(furyRing);
    }

    const toastMsg = `🔥 ${enemy.name} has entered FURY MODE!`;
    const hud = this.context?.hud || this.gameContext?.hud;
    hud?.toast?.(toastMsg, 'warning');
    hud?.showToast?.(toastMsg, 'warning');
  }

  /**
   * Main per-frame AI state machine update for all floor monsters, elites, and bosses
   */
  update(dt = 0.016, elapsedOrPlayer = 0, playerPosOrWorld = null, worldOrCallbacks = null, maybeCallbacks = null) {
    this.elapsedTime += dt;
    let time = this.elapsedTime;
    let playerTarget = null;
    let world = null;
    let callbacks = {};

    if (typeof elapsedOrPlayer === 'number') {
      time = elapsedOrPlayer;
      playerTarget = playerPosOrWorld;
      world = worldOrCallbacks;
      callbacks = maybeCallbacks || {};
    } else {
      playerTarget = elapsedOrPlayer;
      world = playerPosOrWorld;
      callbacks = worldOrCallbacks || {};
    }
    if (callbacks && Object.keys(callbacks).length > 0) {
      this.lastCallbacks = callbacks;
    }

    world = world || this.gameContext?.dungeon || this.gameContext?.world;
    const playerController = this.gameContext?.player || (playerTarget?.receiveHit ? playerTarget : null);
    const px = Number(playerTarget?.x ?? playerTarget?.position?.x ?? playerController?.position?.x ?? 0);
    const pz = Number(playerTarget?.z ?? playerTarget?.position?.z ?? playerController?.position?.z ?? 0);

    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];

      if (e.dead) {
        e.deathTimer -= dt;
        e.mesh?.userData?.animate?.('dead', time, dt);
        if (e.deathTimer <= 0 && e.mesh) {
          e.mesh.visible = false;
          this.rootGroup.remove(e.mesh);
        }
        continue;
      }

      // Status effects (DoT ticks, timers, ring/tint). May kill the enemy.
      this._updateStatuses(e, dt, time);
      if (e.dead) continue;

      // Frozen (non-boss): a statue - no movement, no attacks, no cooldown progress
      if (this._isRooted(e)) {
        if (e.telegraphMesh) e.telegraphMesh.visible = false;
        this._applyStatusTint(e, dt);
        e.syncHealthBar(this.renderer?.camera);
        continue;
      }

      e.attackCooldown = Math.max(0, e.attackCooldown - dt);
      e.skillCooldown = Math.max(0, e.skillCooldown - dt);

      // Boss Fury Countdown & Enrage
      if (e.isBoss) {
        const inCombat =
          e.state === AI_STATE.CHASE ||
          e.state === AI_STATE.ATTACK ||
          e.state === AI_STATE.TELEGRAPH ||
          e.state === AI_STATE.SKILL ||
          e.hp < e.maxHp;

        if (inCombat && e.furyTimer > 0) {
          e.furyTimer = Math.max(0, e.furyTimer - dt);
        }

        if (!e.isFurious && (e.furyTimer <= 0 || (e.hp / e.maxHp) <= BOSS_MECHANICS.enrageHpRatio)) {
          this.triggerBossFury(e);
        }
      }

      const dx = px - e.x;
      const dz = pz - e.z;
      const distToPlayer = Math.hypot(dx, dz);

      if (e.state === AI_STATE.STUN) {
        e.stunTimer -= dt;
        e.mesh?.userData?.animate?.('hit', time, dt);
        if (e.stunTimer <= 0) {
          e.state = AI_STATE.CHASE;
        }
        this._applyStatusTint(e, dt);
        e.syncHealthBar(this.renderer?.camera);
        continue;
      }

      // Boss special skill trigger when off cooldown
      if (
        e.isBoss &&
        e.skills.length > 0 &&
        e.skillCooldown <= 0 &&
        distToPlayer <= e.aggroRange &&
        (e.state === AI_STATE.CHASE || e.state === AI_STATE.IDLE)
      ) {
        const chosenSkill = e.skills[Math.floor(Math.random() * e.skills.length)];
        e.pendingSkill = chosenSkill;
        e.state = AI_STATE.TELEGRAPH;
        e.stateTimer = 0.72;
        e.skillCooldown = Math.max(3.6, 6.5 - e.phase * 0.8);
        if (chosenSkill === 'charge' && distToPlayer > 0.1) {
          e.chargeDir = { x: dx / distToPlayer, z: dz / distToPlayer };
        }
        const bossArena = world?.bossArena || this.gameContext?.dungeon?.bossArena || null;
        this.renderer?.spawnBossTelegraph?.(chosenSkill, e.position, e.chargeDir, {
          radius: chosenSkill === 'nova' ? 4.6 : 3.8,
          duration: e.stateTimer,
          arena: bossArena,
          color: e.element === 'fire' ? 0xff4400 : e.element === 'lightning' ? 0xfacc15 : e.element === 'ice' ? 0x38bdf8 : 0xef4444
        });
      }

      switch (e.state) {
        case AI_STATE.SLEEP: {
          e.mesh?.userData?.animate?.('idle', time * 0.35, dt);
          if (distToPlayer <= e.aggroRange * 0.68) {
            this.wakePack(e);
          }
          break;
        }

        case AI_STATE.IDLE: {
          e.stateTimer -= dt;
          e.mesh?.userData?.animate?.('idle', time, dt);
          if (distToPlayer <= e.aggroRange) {
            if (e.packId) this.wakePack(e);
            else e.state = AI_STATE.CHASE;
          } else if (e.stateTimer <= 0) {
            const angle = Math.random() * Math.PI * 2;
            const r = 1.5 + Math.random() * 2.5;
            e.patrolTarget = {
              x: e.spawnX + Math.cos(angle) * r,
              z: e.spawnZ + Math.sin(angle) * r
            };
            e.state = AI_STATE.PATROL;
            e.stateTimer = 2.0 + Math.random() * 2.0;
          }
          break;
        }

        case AI_STATE.PATROL: {
          e.stateTimer -= dt;
          if (distToPlayer <= e.aggroRange) {
            if (e.packId) this.wakePack(e);
            else e.state = AI_STATE.CHASE;
            break;
          }
          const pdx = e.patrolTarget.x - e.x;
          const pdz = e.patrolTarget.z - e.z;
          const pDist = Math.hypot(pdx, pdz);
          if (pDist < 0.35 || e.stateTimer <= 0) {
            e.state = AI_STATE.IDLE;
            e.stateTimer = 1.2 + Math.random() * 1.5;
          } else {
            this._moveEnemy(e, pdx / pDist, pdz / pDist, e.moveSpeed * 0.55, dt, world);
            e.mesh?.userData?.animate?.('walk', time, dt);
          }
          break;
        }

        case AI_STATE.CHASE: {
          if (distToPlayer > e.aggroRange * 1.6 && !e.isBoss) {
            e.state = AI_STATE.IDLE;
            e.stateTimer = 1.0;
            break;
          }

          if (distToPlayer <= e.attackRange && e.attackCooldown <= 0) {
            e.pendingSkill = null;
            e.state = AI_STATE.TELEGRAPH;
            e.stateTimer = e.telegraphDuration;
            e.rotation = Math.atan2(dx, dz);
            break;
          }

          if (distToPlayer > 0.05) {
            this._moveEnemy(e, dx / distToPlayer, dz / distToPlayer, e.moveSpeed, dt, world);
          }
          e.mesh?.userData?.animate?.('chase', time, dt);
          break;
        }

        case AI_STATE.TELEGRAPH: {
          e.stateTimer -= dt;
          if (distToPlayer > 0.05 && e.pendingSkill !== 'charge') {
            e.rotation = Math.atan2(dx, dz);
          }
          if (e.telegraphMesh) {
            e.telegraphMesh.visible = true;
            e.telegraphMesh.material.opacity = 0.35 + Math.sin(time * 18) * 0.2;
          }
          e.mesh?.userData?.animate?.('telegraph', time, dt);

          if (e.stateTimer <= 0) {
            if (e.telegraphMesh) e.telegraphMesh.visible = false;
            if (e.pendingSkill) {
              e.state = AI_STATE.SKILL;
              e.stateTimer = e.pendingSkill === 'charge' ? 0.45 : 0.35;
              this._executeBossSpecialSkill(e, px, pz, world, callbacks);
            } else {
              e.state = AI_STATE.ATTACK;
              e.stateTimer = 0.28;
              this._executeEnemyBasicAttack(e, px, pz, distToPlayer, callbacks);
            }
          }
          break;
        }

        case AI_STATE.ATTACK: {
          e.stateTimer -= dt;
          e.mesh?.userData?.animate?.('attack', time, dt);
          if (e.stateTimer <= 0) {
            e.attackCooldown = e.attackCooldownMax;
            e.state = AI_STATE.CHASE;
          }
          break;
        }

        case AI_STATE.SKILL: {
          e.stateTimer -= dt;
          if (e.pendingSkill === 'charge') {
            this._moveEnemy(e, e.chargeDir.x, e.chargeDir.z, e.moveSpeed * 2.8, dt, world);
            const arena = world?.bossArena || this.gameContext?.dungeon?.bossArena;
            if (arena?.center && Number.isFinite(arena.radius)) {
              const adx = e.x - arena.center.x;
              const adz = e.z - arena.center.z;
              const ad = Math.hypot(adx, adz);
              const maxR = Math.max(1.5, arena.radius - 0.9);
              if (ad > maxR && ad > 0.001) {
                e.x = arena.center.x + (adx / ad) * maxR;
                e.z = arena.center.z + (adz / ad) * maxR;
              }
            }
            if (Math.hypot(px - e.x, pz - e.z) <= e.radius + 0.85) {
              this._dealDamageToPlayer(e, Math.round(e.atk * 1.35), e.element, callbacks);
              e.pendingSkill = null;
            }
          }
          e.mesh?.userData?.animate?.('skill', time, dt);
          if (e.stateTimer <= 0) {
            e.pendingSkill = null;
            e.attackCooldown = e.attackCooldownMax * 0.8;
            e.state = AI_STATE.CHASE;
          }
          break;
        }

        default:
          e.state = AI_STATE.IDLE;
          break;
      }

      // Sync 3D transform & billboard healthbar
      e.position.set(e.x, 0, e.z);
      if (e.mesh) {
        e.mesh.position.set(e.x, 0, e.z);
        e.mesh.rotation.y = e.rotation;
      }
      this._applyStatusTint(e, dt);
      e.syncHealthBar(this.renderer?.camera);
    }
  }

  // ---------------------------------------------------------------- status effects
  _resolveEnemy(enemyOrId) {
    if (!enemyOrId) return null;
    if (typeof enemyOrId === 'string') return this.enemies.find((e) => e.id === enemyOrId) || null;
    if (enemyOrId.entity && !enemyOrId.statuses) return enemyOrId.entity; // getActiveBoss() wrapper
    return enemyOrId;
  }

  /**
   * Apply (or refresh) a status effect from mechanics.js STATUS.
   * status: 'burn' | { id, duration?, dotPerTick? }. Same status refreshes its duration (no stacking).
   * Bosses: freeze -> 50% slow for the same duration, stun duration x0.4.
   * Returns the active status entry, or null when not applied.
   */
  applyStatus(enemyOrId, status) {
    const enemy = this._resolveEnemy(enemyOrId);
    if (!enemy || enemy.dead || !status) return null;
    const id = String(typeof status === 'string' ? status : status.id || '').toLowerCase();
    const def = statusDef(id);
    if (!def) return null;
    if (!enemy.statuses) enemy.statuses = {};

    let duration = Number(typeof status === 'object' ? status.duration : NaN);
    if (!Number.isFinite(duration) || duration <= 0) duration = Number(def.duration) || 1;
    if (id === 'stun' && enemy.isBoss) duration *= 0.4;

    const prev = enemy.statuses[id];
    const entry = prev || { id, name: def.name || id, color: def.color ?? 0xffffff };
    entry.duration = duration;
    entry.remaining = duration;
    entry.slowPct = 0;
    entry.root = false;
    entry.dmgTakenPct = 0;

    if (DOT_STATUSES.has(id)) {
      entry.tick = Math.max(0.2, Number(def.tick) || 1);
      if (!prev) entry.tickTimer = entry.tick;
      const given = Number(typeof status === 'object' ? status.dotPerTick : NaN);
      const fallback = Math.max(1, Math.round(enemy.maxHp * (enemy.isBoss ? 0.03 : 0.06)));
      // Keep the stronger DoT when refreshing
      const dot = Number.isFinite(given) && given > 0 ? Math.round(given) : fallback;
      entry.dotPerTick = prev ? Math.max(prev.dotPerTick || 0, dot) : dot;
    } else if (id === 'chill') {
      entry.slowPct = Number(def.slowPct) || 40;
    } else if (id === 'freeze') {
      if (enemy.isBoss) {
        entry.slowPct = 50;
      } else {
        entry.slowPct = 100;
        entry.root = true;
        // Cancel a pending wind-up so the frozen enemy cannot release an attack on thaw
        if (enemy.state === AI_STATE.TELEGRAPH || enemy.state === AI_STATE.ATTACK || enemy.state === AI_STATE.SKILL) {
          enemy.state = AI_STATE.CHASE;
          enemy.pendingSkill = null;
          enemy.attackCooldown = Math.max(enemy.attackCooldown, enemy.attackCooldownMax * 0.5);
        }
        if (enemy.telegraphMesh) enemy.telegraphMesh.visible = false;
      }
    } else if (id === 'shock') {
      entry.dmgTakenPct = Number(def.dmgTakenPct) || 15;
    } else if (id === 'stun') {
      if (enemy.telegraphMesh) enemy.telegraphMesh.visible = false;
      enemy.pendingSkill = null;
      const already = enemy.state === AI_STATE.STUN ? Number(enemy.stunTimer) || 0 : 0;
      enemy.state = AI_STATE.STUN;
      enemy.stunTimer = Math.max(already, duration);
    }

    enemy.statuses[id] = entry;
    if (!prev && this.renderer?.spawnFloatingText) {
      this.renderer.spawnFloatingText({ x: enemy.x, y: 0.9, z: enemy.z }, entry.name, { color: colorToCss(entry.color) });
    }
    this._refreshStatusRing(enemy);
    return entry;
  }

  hasStatus(enemyOrId, id) {
    const enemy = this._resolveEnemy(enemyOrId);
    return Boolean(enemy?.statuses?.[id] && enemy.statuses[id].remaining > 0);
  }

  getStatuses(enemyOrId) {
    const enemy = this._resolveEnemy(enemyOrId);
    return enemy?.statuses ? Object.values(enemy.statuses).map((s) => ({ ...s })) : [];
  }

  /** Damage-taken multiplier from Shock (1 when unaffected). */
  getDamageTakenMult(enemyOrId) {
    const enemy = this._resolveEnemy(enemyOrId);
    const pct = enemy?.statuses?.shock?.dmgTakenPct || 0;
    return 1 + Math.max(0, pct) / 100;
  }

  /** Movement speed multiplier from Chill / Freeze (strongest slow wins). */
  getSpeedMult(enemyOrId) {
    const enemy = this._resolveEnemy(enemyOrId);
    if (!enemy?.statuses) return 1;
    let slow = 0;
    for (const id in enemy.statuses) slow = Math.max(slow, enemy.statuses[id].slowPct || 0);
    return Math.max(0, 1 - Math.min(100, slow) / 100);
  }

  _isRooted(enemy) {
    return Boolean(enemy?.statuses?.freeze?.root);
  }

  clearStatuses(enemyOrId) {
    const enemy = this._resolveEnemy(enemyOrId);
    if (!enemy) return;
    const hadTint = Boolean(enemy._statusTinted);
    enemy.statuses = {};
    if (hadTint) this._restoreTint(enemy);
    this._removeStatusRing(enemy);
  }

  _updateStatuses(enemy, dt, time = 0) {
    const st = enemy.statuses;
    if (!st) return;
    let changed = false;
    for (const id of Object.keys(st)) {
      const s = st[id];
      if (s.dotPerTick > 0 && s.tick > 0) {
        s.tickTimer -= dt;
        while (s.tickTimer <= 0 && !enemy.dead && s.remaining > 0) {
          s.tickTimer += s.tick;
          const res = this.applyDamageToEnemy(enemy, s.dotPerTick, { isDot: true, noStun: true, knockback: 0, element: id });
          if (res?.damage && this.renderer?.spawnFloatingText) {
            this.renderer.spawnFloatingText({ x: enemy.x, y: 0.5, z: enemy.z }, res.damage, { color: colorToCss(s.color) });
          }
        }
        if (enemy.dead) return;
      }
      s.remaining -= dt;
      if (s.remaining <= 0) {
        delete st[id];
        changed = true;
      }
    }
    if (changed) this._refreshStatusRing(enemy);
    if (enemy.statusRing) {
      enemy.statusRing.rotation.z = time * 2.4;
      const pulse = 0.55 + Math.sin(time * 8) * 0.15;
      enemy.statusRing.material.opacity = pulse;
    }
  }

  _topStatus(enemy) {
    const st = enemy?.statuses;
    if (!st) return null;
    for (const id of STATUS_RING_PRIORITY) if (st[id]) return st[id];
    const keys = Object.keys(st);
    return keys.length ? st[keys[0]] : null;
  }

  _refreshStatusRing(enemy) {
    const top = this._topStatus(enemy);
    if (!top) {
      this._removeStatusRing(enemy);
      return;
    }
    if (!enemy.mesh) return;
    if (!enemy.statusRing) {
      const inner = enemy.isBoss ? 0.8 : 0.42;
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(inner, inner + 0.12, 20),
        new THREE.MeshBasicMaterial({ color: top.color, side: THREE.DoubleSide, transparent: true, opacity: 0.6, depthWrite: false })
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.05;
      ring.userData.noFlash = true;
      enemy.mesh.add(ring);
      enemy.statusRing = ring;
    }
    enemy.statusRing.material.color.setHex(top.color);
  }

  _removeStatusRing(enemy) {
    const ring = enemy?.statusRing;
    if (!ring) return;
    ring.parent?.remove(ring);
    ring.geometry?.dispose?.();
    ring.material?.dispose?.();
    enemy.statusRing = null;
  }

  /** Blue tint while frozen (bosses: lighter tint for the slow); restored on thaw / hit flash. */
  _applyStatusTint(enemy, dt) {
    const ud = enemy.mesh?.userData;
    if (!ud) return;
    const frozen = enemy.statuses?.freeze;
    if (frozen && this._isRooted(enemy) && ud.hitFlashTimer > 0) {
      // animate() is skipped while frozen: decay the hit flash here
      ud.hitFlashTimer = Math.max(0, ud.hitFlashTimer - dt * 6);
      ud.setHitFlash?.(ud.hitFlashTimer);
    }
    if (frozen && !(ud.hitFlashTimer > 0.02)) {
      const k = enemy.isBoss ? 0.3 : 0.6;
      for (const entry of ud.flashMaterials || []) {
        if (!entry.mat?.emissive) continue;
        entry.mat.emissive.setHex(frozen.color ?? 0x6fd4ff);
        entry.mat.emissiveIntensity = k;
      }
      enemy._statusTinted = true;
    } else if (!frozen && enemy._statusTinted) {
      this._restoreTint(enemy);
    }
  }

  _restoreTint(enemy) {
    enemy._statusTinted = false;
    const ud = enemy.mesh?.userData;
    if (!ud || ud.hitFlashTimer > 0.02) return;
    for (const entry of ud.flashMaterials || []) {
      if (!entry.mat?.emissive) continue;
      entry.mat.emissive.copy(entry.baseEmissive);
      entry.mat.emissiveIntensity = entry.baseIntensity;
    }
  }

  _moveEnemy(enemy, dirX, dirZ, speed, dt, world) {
    // Soft separation from other alive enemies so they surround the player naturally
    let sepX = 0;
    let sepZ = 0;
    for (const other of this.enemies) {
      if (other === enemy || other.dead) continue;
      const ox = enemy.x - other.x;
      const oz = enemy.z - other.z;
      const dist = Math.hypot(ox, oz);
      const minSep = enemy.radius + other.radius + 0.25;
      if (dist > 0.001 && dist < minSep) {
        const push = (minSep - dist) / minSep;
        sepX += (ox / dist) * push * 1.4;
        sepZ += (oz / dist) * push * 1.4;
      }
    }

    const vx = dirX + sepX;
    const vz = dirZ + sepZ;
    const vLen = Math.hypot(vx, vz) || 1;
    const slowed = speed * this.getSpeedMult(enemy);
    const moveX = (vx / vLen) * slowed * dt;
    const moveZ = (vz / vLen) * slowed * dt;

    const nextX = enemy.x + moveX;
    const nextZ = enemy.z + moveZ;

    if (world && typeof world.resolveCollision === 'function') {
      const resolved = world.resolveCollision(nextX, nextZ, enemy.radius);
      enemy.x = resolved.x;
      enemy.z = resolved.z;
    } else if (world && typeof world.isWalkable === 'function') {
      if (world.isWalkable(nextX, nextZ, enemy.radius)) {
        enemy.x = nextX;
        enemy.z = nextZ;
      } else if (world.isWalkable(nextX, enemy.z, enemy.radius)) {
        enemy.x = nextX;
      } else if (world.isWalkable(enemy.x, nextZ, enemy.radius)) {
        enemy.z = nextZ;
      }
    } else {
      enemy.x = nextX;
      enemy.z = nextZ;
    }

    if (Math.hypot(dirX, dirZ) > 0.05) {
      enemy.rotation = Math.atan2(dirX, dirZ);
    }
  }

  _executeEnemyBasicAttack(enemy, px, pz, distToPlayer, callbacks) {
    if (enemy.isRanged && this.renderer?.spawnSkillEffect) {
      this.renderer.spawnSkillEffect('fireball', enemy.position, enemy.rotation, {
        color: enemy.element === 'dark' ? 0xa855f7 : 0xff5522,
        range: enemy.attackRange
      });
    }

    const hitRange = enemy.attackRange + 0.65;
    if (distToPlayer <= hitRange) {
      this._dealDamageToPlayer(enemy, enemy.atk, enemy.element, callbacks);
    }
  }

  _executeBossSpecialSkill(boss, px, pz, world, callbacks) {
    const skill = boss.pendingSkill || 'shockwave';
    const dist = Math.hypot(px - boss.x, pz - boss.z);

    if (skill === 'shockwave' || skill === 'nova') {
      const radius = skill === 'nova' ? 4.6 : 3.8;
      if (this.renderer?.spawnSkillEffect) {
        this.renderer.spawnSkillEffect('shockwave', boss.position, 0, {
          color: boss.element === 'fire' ? 0xff4400 : boss.element === 'lightning' ? 0xfacc15 : 0xef4444,
          radius
        });
        this.renderer.shake?.(0.32, 0.24);
      }
      if (dist <= radius) {
        this._dealDamageToPlayer(boss, Math.round(boss.atk * 1.45), boss.element, callbacks);
      }
    } else if (skill === 'summon') {
      if (this.getAliveEnemies().length < 12 && boss.summonCount < 6) {
        boss.summonCount += 2;
        const arena = world?.bossArena || this.gameContext?.dungeon?.bossArena;
        for (const offset of [-2.2, 2.2]) {
          let sx = boss.x + offset;
          let sz = boss.z + 1.5;
          if (arena?.center && Number.isFinite(arena.radius)) {
            const adx = sx - arena.center.x;
            const adz = sz - arena.center.z;
            const ad = Math.hypot(adx, adz);
            const maxR = Math.max(1.5, arena.radius - 1.0);
            if (ad > maxR && ad > 0.001) {
              sx = arena.center.x + (adx / ad) * maxR;
              sz = arena.center.z + (adz / ad) * maxR;
            }
          }
          this.spawnMonster({
            type: boss.summonType || 'goblin',
            floor: boss.floor,
            x: sx,
            z: sz,
            isElite: false
          });
          if (this.renderer?.spawnAura) {
            this.renderer.spawnAura({ x: sx, y: 0, z: sz }, 0xa855f7, 'mana');
          }
        }
      }
    }
  }

  _dealDamageToPlayer(enemy, rawDamage, element, callbacks = {}) {
    const ctx = this.gameContext || {};
    let result = null;

    if (typeof callbacks?.onPlayerHit === 'function') {
      result = callbacks.onPlayerHit(rawDamage, enemy, { element });
    } else if (ctx.player && typeof ctx.player.receiveHit === 'function') {
      result = ctx.player.receiveHit(rawDamage, enemy, { element });
    } else if (ctx.gameState && typeof ctx.gameState.takeDamage === 'function') {
      result = ctx.gameState.takeDamage(rawDamage, { element, source: enemy });
    }

    // Vampiric Elite modifier heals on hit
    if (enemy.modifier?.lifesteal && result && !result.dodged && result.damage > 0) {
      const healAmt = Math.max(1, Math.round(result.damage * enemy.modifier.lifesteal));
      enemy.hp = Math.min(enemy.maxHp, enemy.hp + healAmt);
      enemy.syncHealthBar(this.renderer?.camera);
    }

    // Nemesis registration when enemy kills player
    const gs = this.context?.gameState || this.gameContext?.gameState || ctx.gameState;
    const isPlayerDead = Boolean(
      result?.dead ||
      (gs && (gs.hero?.hp <= 0 || gs.hero?.dead || gs.isDead))
    );

    if (isPlayerDead && enemy && !enemy.isBoss) {
      const currentFloor = this.currentFloor || enemy.floor || 1;
      gs?.registerNemesisFromKill?.(enemy, currentFloor);
    }
  }
}

export function createEnemyManager(options, models3d, data) {
  return new EnemyManager(options, models3d, data);
}

export default EnemyManager;

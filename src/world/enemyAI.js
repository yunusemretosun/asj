import * as THREE from 'three';
import {
  models3d as defaultModels3d,
  createMonsterMesh,
  createBossMesh,
  disposeObject3D
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

export const RANGED_ENEMY_SKILLS = new Set([
  'poison_arrow',
  'arrow_volley',
  'powder_blast',
  'frost_wave',
  'acid_spit',
  'soul_bolt',
  'aqua_splash',
  'spirit_stare',
  'bandit_ambush_volley',
  'ice_lance_barrage',
  'solar_spear_volley',
  'hellfire_meteor_rain',
  'viper_orb_fan',
  'sky_feather_storm',
  'thunder_judgment',
  'tiger_dark_curse',
  'uruchi_drake_breath',
  'yarkan_magma_eruption'
]);

export const MELEE_ENEMY_SKILLS = new Set([
  'pounce',
  'earth_stomp',
  'slash',
  'whirlwind_strike',
  'ram_tackle',
  'double_pebble_snap',
  'shadow_lash',
  'feral_nip',
  'quick_lunge',
  'stone_smash',
  'earth_shatter',
  'witch_claw',
  'cleave_sweep',
  'tiger_rend',
  'roar_shockwave',
  'venom_sting',
  'uruchi_whirlwind',
  'earth_splitter',
  'roc_wing_slam',
  'serpent_coil_slam'
]);

export const UNIQUE_SKILL_LABELS = {
  // Mob & Elite Skills
  ram_tackle: '🐏 Ram Tackle',
  double_pebble_snap: '💥 Twin Snap',
  spirit_stare: '👁️ Spirit Stare',
  shadow_lash: '👻 Shadow Lash',
  feral_nip: '🐺 Feral Bite',
  quick_lunge: '⚡ Quick Lunge',
  aqua_splash: '💧 Aqua Splash',
  frost_wave: '❄️ Frost Wave',
  stone_smash: '🪨 Stone Smash',
  earth_shatter: '🌋 Earth Shatter',
  soul_bolt: '💀 Soul Bolt',
  curse_drain: '🟣 Curse Drain',
  witch_claw: '🕷️ Witch Claw',
  slash: '⚔️ Wicked Slash',
  cleave_sweep: '🗡️ Cleave Sweep',
  poison_arrow: '🏹 Poison Arrow',
  arrow_volley: '🏹 Arrow Volley',
  pounce: '🐯 Pounce',
  tiger_rend: '🐾 Savage Rend',
  roar_shockwave: '🦁 Beast Roar',
  venom_sting: '🦂 Venom Sting',
  whirlwind_strike: '🌀 Whirlwind Strike',
  acid_spit: '☠️ Acid Spit',
  powder_blast: '💣 Powder Blast',
  earth_stomp: '💥 Earth Stomp',
  // Unique Boss Skills
  flame_claw_leap: '🔥 Flame Claw Leap',
  tiger_roar_ring: '🔥 Empress Roar',
  whitetiger_pack: '🐾 Frostfang Pack',
  uruchi_whirlwind: '🌀 Whirlwind Cleave',
  bandit_ambush_volley: '🏹 Ambush Volley',
  earth_splitter: '💥 Earth Splitter',
  isyutaru_blizzard: '❄️ Frost Blizzard',
  ice_lance_barrage: '🧊 Ice Lance Barrage',
  frost_prison_nova: '💎 Frost Prison',
  yarkan_sandstorm: '🌪️ Sandstorm Vortex',
  desert_earthquake: '⚡ Desert Quake',
  solar_spear_volley: '☀️ Solar Spears',
  hellfire_meteor_rain: '☄️ Hellfire Meteors',
  abyssal_soul_drain: '💀 Soul Drain',
  infernal_nova: '🔥 Infernal Nova',
  venom_gaze: '🐍 Venom Gaze',
  viper_orb_fan: '☠️ Viper Orbs',
  poison_nova: '💚 Poison Nova',
  roc_hurricane_gale: '🌪️ Hurricane Gale',
  sky_feather_storm: '🪶 Feather Storm',
  thunder_judgment: '⚡ Thunder Judgment'
};

export function isSkillInRange(skill, enemy, distToPlayer) {
  const atkRange = Number(enemy?.attackRange || 2.0);
  const rangedCap = enemy?.isBoss ? 16.5 : Math.max(13.5, atkRange + 2.5);
  if (RANGED_ENEMY_SKILLS.has(skill) || skill === 'venom_gaze') {
    return distToPlayer <= rangedCap;
  }
  if (MELEE_ENEMY_SKILLS.has(skill)) {
    return distToPlayer <= (atkRange + 1.8);
  }
  if (skill === 'curse_drain' || skill === 'abyssal_soul_drain' || skill === 'shaitan_soul_siphon') {
    return distToPlayer <= (enemy?.isBoss ? 15.5 : Math.max(12.5, atkRange + 2.0));
  }
  if (skill === 'charge' || skill === 'flame_claw_leap' || skill === 'dash_strike' || skill === 'tiger_claw_frenzy') {
    return distToPlayer <= 10.5 && distToPlayer >= 1.6;
  }
  if (
    skill === 'shockwave' || skill === 'nova' ||
    skill === 'roar_shockwave' || skill === 'tiger_roar_ring' || skill === 'savage_roar' ||
    skill === 'isyutaru_blizzard' || skill === 'frost_prison_nova' || skill === 'isyutaru_ice_mirror_shield' ||
    skill === 'yarkan_sandstorm' || skill === 'desert_earthquake' ||
    skill === 'infernal_nova' || skill === 'infernal_roar' ||
    skill === 'poison_nova' || skill === 'petrify_gaze' ||
    skill === 'roc_hurricane_gale' || skill === 'roc_wing_slam' || skill === 'serpent_coil_slam'
  ) {
    return distToPlayer <= (atkRange + 4.2);
  }
  if (skill === 'summon' || skill === 'whitetiger_pack') {
    return distToPlayer <= enemy.aggroRange;
  }
  return distToPlayer <= (atkRange + 1.6);
}

export const OUTSKIRT_GIANT_KILL_THRESHOLD = 10;

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
  // Arkenveil Outskirt & Cavern Mob Roster
  // =========================================================================
  mangyang: {
    type: 'mangyang',
    name: 'Sporeling Gremlin',
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
    scale: 1.0,
    skills: ['ram_tackle', 'double_pebble_snap']
  },
  small_eye_ghost: {
    type: 'small_eye_ghost',
    name: 'Wisp Stalker',
    glbPath: '/assets/sro/mobs/bigeyeghost_clon.glb',
    targetHeight: 1.35,
    baseHp: 44,
    baseAtk: 10,
    baseDef: 3,
    baseExp: 19,
    baseGold: 9,
    moveSpeed: 4.4,
    attackRange: 2.0,
    aggroRange: 9.2,
    attackCooldown: 1.25,
    telegraphTime: 0.34,
    element: 'dark',
    color: 0x93c5fd,
    scale: 0.94,
    skills: ['spirit_stare']
  },
  bigeye_ghost: {
    type: 'bigeye_ghost',
    name: 'Gloomgazer',
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
    scale: 1.0,
    skills: ['spirit_stare', 'shadow_lash']
  },
  old_weasel: {
    type: 'old_weasel',
    name: 'Thornback Jackal',
    glbPath: '/assets/sro/mobs/gyo_clon.glb',
    targetHeight: 1.3,
    baseHp: 52,
    baseAtk: 11,
    baseDef: 4,
    baseExp: 21,
    baseGold: 10,
    moveSpeed: 4.6,
    attackRange: 1.7,
    aggroRange: 9.5,
    attackCooldown: 1.2,
    telegraphTime: 0.32,
    element: 'physical',
    color: 0xb45309,
    scale: 0.96,
    skills: ['feral_nip']
  },
  gyo_weasel: {
    type: 'gyo_weasel',
    name: 'Rabid Howler',
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
    scale: 1.0,
    skills: ['feral_nip', 'quick_lunge']
  },
  water_ghost_slave: {
    type: 'water_ghost_slave',
    name: 'Mire Drowner',
    glbPath: '/assets/sro/mobs/waterghost_clon.glb',
    targetHeight: 1.44,
    baseHp: 64,
    baseAtk: 15,
    baseDef: 5,
    baseExp: 28,
    baseGold: 13,
    moveSpeed: 3.9,
    attackRange: 9.6,
    aggroRange: 14.5,
    attackCooldown: 1.5,
    telegraphTime: 0.4,
    isRanged: true,
    element: 'ice',
    color: 0x0ea5e9,
    scale: 0.98,
    skills: ['aqua_splash']
  },
  water_ghost: {
    type: 'water_ghost',
    name: 'Brook Wraith',
    glbPath: '/assets/sro/mobs/waterghost.glb',
    targetHeight: 1.5,
    baseHp: 70,
    baseAtk: 16,
    baseDef: 5,
    baseExp: 30,
    baseGold: 14,
    moveSpeed: 4.0,
    attackRange: 10.2,
    aggroRange: 15.0,
    attackCooldown: 1.5,
    telegraphTime: 0.42,
    isRanged: true,
    element: 'ice',
    color: 0x38bdf8,
    scale: 1.05,
    skills: ['aqua_splash', 'frost_wave']
  },
  broken_stone_ghost: {
    type: 'broken_stone_ghost',
    name: 'Cracked Runestone',
    glbPath: '/assets/sro/mobs/stoneghost_clon.glb',
    targetHeight: 1.65,
    baseHp: 135,
    baseAtk: 22,
    baseDef: 13,
    baseExp: 50,
    baseGold: 24,
    moveSpeed: 2.9,
    attackRange: 2.1,
    aggroRange: 9.2,
    attackCooldown: 1.65,
    telegraphTime: 0.5,
    element: 'earth',
    color: 0x64748b,
    scale: 1.15,
    skills: ['stone_smash']
  },
  stone_ghost: {
    type: 'stone_ghost',
    name: 'Mossbound Sentinel',
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
    scale: 1.25,
    skills: ['stone_smash', 'earth_shatter']
  },
  tombstone_ghost: {
    type: 'tombstone_ghost',
    name: 'Crypt Marker',
    glbPath: '/assets/sro/mobs/tombstone.glb',
    targetHeight: 1.55,
    baseHp: 88,
    baseAtk: 18,
    baseDef: 8,
    baseExp: 35,
    baseGold: 16,
    moveSpeed: 3.2,
    attackRange: 10.4,
    aggroRange: 15.2,
    attackCooldown: 1.45,
    telegraphTime: 0.44,
    isRanged: true,
    element: 'dark',
    color: 0x64748b,
    scale: 1.1,
    skills: ['soul_bolt']
  },
  tombstone: {
    type: 'tombstone',
    name: 'Cursed Obelisk',
    glbPath: '/assets/sro/mobs/tombstone.glb',
    targetHeight: 1.62,
    baseHp: 96,
    baseAtk: 20,
    baseDef: 9,
    baseExp: 39,
    baseGold: 18,
    moveSpeed: 3.1,
    attackRange: 10.8,
    aggroRange: 15.5,
    attackCooldown: 1.45,
    telegraphTime: 0.46,
    isRanged: true,
    element: 'dark',
    color: 0x475569,
    scale: 1.14,
    skills: ['soul_bolt', 'curse_drain']
  },
  decayed_yeoha: {
    type: 'decayed_yeoha',
    name: 'Rotting Bramblekin',
    glbPath: '/assets/sro/mobs/yeoha_clon.glb',
    targetHeight: 1.58,
    baseHp: 90,
    baseAtk: 18,
    baseDef: 7,
    baseExp: 36,
    baseGold: 17,
    moveSpeed: 3.6,
    attackRange: 2.3,
    aggroRange: 10.0,
    attackCooldown: 1.35,
    telegraphTime: 0.42,
    element: 'poison',
    color: 0x15803d,
    scale: 1.05,
    skills: ['witch_claw']
  },
  yeoha: {
    type: 'yeoha',
    name: 'Thornwood Dryad',
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
    scale: 1.1,
    skills: ['witch_claw', 'curse_drain']
  },
  bandit_subordinate: {
    type: 'bandit_subordinate',
    name: 'Highway Cutthroat',
    glbPath: '/assets/sro/mobs/bandit_clon.glb',
    targetHeight: 1.76,
    baseHp: 82,
    baseAtk: 18,
    baseDef: 6,
    baseExp: 36,
    baseGold: 18,
    moveSpeed: 4.3,
    attackRange: 1.85,
    aggroRange: 10.2,
    attackCooldown: 1.25,
    telegraphTime: 0.38,
    element: 'physical',
    color: 0xd97706,
    scale: 1.02,
    skills: ['slash']
  },
  bandit: {
    type: 'bandit',
    name: 'Blackblade Raider',
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
    scale: 1.05,
    skills: ['slash', 'cleave_sweep']
  },
  bandit_archer: {
    type: 'bandit_archer',
    name: 'Blackblade Scout',
    glbPath: '/assets/sro/mobs/banditarcher.glb',
    targetHeight: 1.8,
    baseHp: 75,
    baseAtk: 22,
    baseDef: 5,
    baseExp: 38,
    baseGold: 19,
    moveSpeed: 4.1,
    attackRange: 11.8,
    aggroRange: 16.0,
    attackCooldown: 1.6,
    telegraphTime: 0.45,
    isRanged: true,
    element: 'physical',
    color: 0xa16207,
    scale: 1.05,
    skills: ['poison_arrow', 'arrow_volley']
  },
  bandit_bowman: {
    type: 'bandit_bowman',
    name: 'Blackblade Sharpshooter',
    glbPath: '/assets/sro/mobs/banditarcher_clon.glb',
    targetHeight: 1.82,
    baseHp: 84,
    baseAtk: 24,
    baseDef: 6,
    baseExp: 42,
    baseGold: 21,
    moveSpeed: 4.2,
    attackRange: 12.4,
    aggroRange: 16.5,
    attackCooldown: 1.55,
    telegraphTime: 0.44,
    isRanged: true,
    element: 'physical',
    color: 0xb45309,
    scale: 1.08,
    skills: ['poison_arrow', 'arrow_volley']
  },
  young_tiger: {
    type: 'young_tiger',
    name: 'Striped Cub',
    glbPath: '/assets/sro/mobs/tiger_clon.glb',
    targetHeight: 1.38,
    baseHp: 96,
    baseAtk: 20,
    baseDef: 7,
    baseExp: 40,
    baseGold: 19,
    moveSpeed: 5.0,
    attackRange: 1.75,
    aggroRange: 10.5,
    attackCooldown: 1.15,
    telegraphTime: 0.32,
    element: 'physical',
    color: 0xfb923c,
    scale: 1.05,
    skills: ['pounce', 'feral_nip']
  },
  tiger: {
    type: 'tiger',
    name: 'Ashwood Tiger',
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
    scale: 1.15,
    skills: ['pounce', 'tiger_rend']
  },
  black_tiger: {
    type: 'black_tiger',
    name: 'Shadowpelt Tiger',
    glbPath: '/assets/sro/mobs/whitetiger_clon.glb',
    targetHeight: 1.56,
    baseHp: 126,
    baseAtk: 25,
    baseDef: 9,
    baseExp: 50,
    baseGold: 24,
    moveSpeed: 5.3,
    attackRange: 1.85,
    aggroRange: 11.2,
    attackCooldown: 1.1,
    telegraphTime: 0.33,
    element: 'dark',
    color: 0x475569,
    scale: 1.18,
    skills: ['pounce', 'tiger_rend']
  },
  white_tiger: {
    type: 'white_tiger',
    name: 'Frostfang Tiger',
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
    scale: 1.2,
    skills: ['pounce', 'roar_shockwave']
  },
  blue_tiger: {
    type: 'blue_tiger',
    name: 'Stormpelt Tiger',
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
    scale: 1.25,
    skills: ['pounce', 'roar_shockwave']
  },
  chakji_worker: {
    type: 'chakji_worker',
    name: 'Hollowbark Brute',
    glbPath: '/assets/sro/mobs/chakji_clon.glb',
    targetHeight: 1.56,
    baseHp: 142,
    baseAtk: 26,
    baseDef: 11,
    baseExp: 54,
    baseGold: 25,
    moveSpeed: 3.9,
    attackRange: 2.0,
    aggroRange: 10.0,
    attackCooldown: 1.4,
    telegraphTime: 0.42,
    element: 'poison',
    color: 0xa16207,
    scale: 1.12,
    skills: ['venom_sting']
  },
  chakji: {
    type: 'chakji',
    name: 'Hollowbark Marauder',
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
    scale: 1.2,
    skills: ['pounce', 'venom_sting', 'whirlwind_strike']
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
    scale: 0.95,
    skills: ['venom_sting']
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
    scale: 1.05,
    skills: ['acid_spit']
  },
  hyungno: {
    type: 'hyungno',
    name: 'Duskblade Soldier',
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
    scale: 1.22,
    skills: ['whirlwind_strike']
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
    attackRange: 10.2,
    aggroRange: 15.0,
    attackCooldown: 1.6,
    telegraphTime: 0.48,
    isRanged: true,
    element: 'earth',
    color: 0xa16207,
    scale: 1.15,
    skills: ['stone_smash', 'earth_shatter']
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
    attackRange: 10.8,
    aggroRange: 15.5,
    attackCooldown: 1.7,
    telegraphTime: 0.5,
    isRanged: true,
    element: 'fire',
    color: 0xea580c,
    scale: 1.1,
    skills: ['powder_blast']
  },

  // =========================================================================
  // Mapped Legacy Entries (enhanced with 3D models & exact target heights)
  // =========================================================================
  slime: {
    type: 'slime',
    name: 'Cavern Slime',
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
    scale: 1.0,
    skills: ['ram_tackle']
  },
  goblin: {
    type: 'goblin',
    name: 'Goblin Raider',
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
    scale: 1.0,
    skills: ['feral_nip', 'quick_lunge']
  },
  bat: {
    type: 'bat',
    name: 'Dusk Vampire Bat',
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
    scale: 0.95,
    skills: ['spirit_stare', 'shadow_lash']
  },
  wolf: {
    type: 'wolf',
    name: 'Dire Shadow Wolf',
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
    scale: 1.05,
    skills: ['pounce', 'feral_nip']
  },
  spider: {
    type: 'spider',
    name: 'Venomfang Spider',
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
    scale: 1.0,
    skills: ['witch_claw', 'venom_sting']
  },
  skeleton: {
    type: 'skeleton',
    name: 'Restless Skeleton',
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
    scale: 1.05,
    skills: ['slash', 'cleave_sweep']
  },
  mage: {
    type: 'mage',
    name: 'Abyssal Cultist Mage',
    glbPath: '/assets/sro/mobs/earthghost.glb',
    targetHeight: 1.6,
    baseHp: 66,
    baseAtk: 19,
    baseDef: 5,
    baseExp: 38,
    baseGold: 18,
    moveSpeed: 3.5,
    attackRange: 11.0,
    aggroRange: 15.5,
    attackCooldown: 1.8,
    telegraphTime: 0.52,
    isRanged: true,
    element: 'dark',
    color: 0x7e22ce,
    scale: 1.05,
    skills: ['soul_bolt', 'curse_drain']
  },
  orc: {
    type: 'orc',
    name: 'Orc Vanguard',
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
    scale: 1.18,
    skills: ['cleave_sweep', 'whirlwind_strike']
  },
  golem: {
    type: 'golem',
    name: 'Runestone Golem',
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
    scale: 1.32,
    skills: ['stone_smash', 'earth_stomp']
  },
  mummy: {
    type: 'mummy',
    name: 'Cursed Mummy',
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
    scale: 1.08,
    skills: ['soul_bolt', 'curse_drain']
  },
  zombie: {
    type: 'zombie',
    name: 'Plague Zombie',
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
    scale: 1.06,
    skills: ['venom_sting', 'acid_spit']
  },
  lizardman: {
    type: 'lizardman',
    name: 'Scaleblade Lizardman',
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
    scale: 1.12,
    skills: ['poison_arrow', 'slash']
  },
  wraith: {
    type: 'wraith',
    name: 'Phantom Wraith',
    glbPath: '/assets/sro/mobs/waterghost.glb',
    targetHeight: 1.5,
    baseHp: 88,
    baseAtk: 24,
    baseDef: 6,
    baseExp: 45,
    baseGold: 22,
    moveSpeed: 4.4,
    attackRange: 10.5,
    aggroRange: 15.2,
    attackCooldown: 1.6,
    telegraphTime: 0.44,
    isRanged: true,
    element: 'dark',
    color: 0x6366f1,
    scale: 1.08,
    skills: ['aqua_splash', 'frost_wave']
  },
  gargoyle: {
    type: 'gargoyle',
    name: 'Obsidian Gargoyle',
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
    scale: 1.2,
    skills: ['pounce', 'acid_spit']
  },
  stoneGolem: {
    type: 'stoneGolem',
    name: 'Ancient Stone Golem',
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
    scale: 1.35,
    skills: ['stone_smash', 'earth_shatter']
  },
  hellHound: {
    type: 'hellHound',
    name: 'Infernal Hell Hound',
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
    scale: 1.15,
    skills: ['pounce', 'tiger_rend']
  },
  wizard: {
    type: 'wizard',
    name: 'Archon Chaos Wizard',
    glbPath: '/assets/sro/mobs/gunpowderghost_clon.glb',
    targetHeight: 1.5,
    baseHp: 110,
    baseAtk: 30,
    baseDef: 8,
    baseExp: 58,
    baseGold: 28,
    moveSpeed: 3.6,
    attackRange: 11.2,
    aggroRange: 16.0,
    attackCooldown: 1.65,
    telegraphTime: 0.48,
    isRanged: true,
    element: 'lightning',
    color: 0x9333ea,
    scale: 1.1,
    skills: ['powder_blast', 'soul_bolt']
  },
  darkKnight: {
    type: 'darkKnight',
    name: 'Abyssal Dark Knight',
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
    scale: 1.24,
    skills: ['cleave_sweep', 'whirlwind_strike']
  },
  demon: {
    type: 'demon',
    name: 'Hellfire Demon',
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
    scale: 1.3,
    skills: ['infernal_nova', 'whirlwind_strike']
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

// Arkenveil Unique Boss Base Definitions (scaled cleanly by floor & BOSS_CATALOG multipliers)
MONSTER_CATALOG.tigerwoman = {
  type: 'tigerwoman',
  name: 'Frostfang Empress',
  glbPath: '/assets/sro/mobs/tigerwoman.glb',
  targetHeight: 1.58,
  baseHp: 155,
  baseAtk: 25,
  baseDef: 11,
  baseExp: 240,
  baseGold: 160,
  moveSpeed: 5.0,
  attackRange: 2.4,
  aggroRange: 14.0,
  attackCooldown: 1.1,
  telegraphTime: 0.42,
  element: 'fire',
  color: 0xf97316,
  scale: 1.55,
  skills: ['flame_claw_leap', 'tiger_dark_curse', 'tiger_roar_ring', 'pounce']
};

MONSTER_CATALOG.uruchi = {
  type: 'uruchi',
  name: 'Warchief Drakmor',
  uniquePrefab: 'uruchi',
  glbPath: '/assets/sro/mobs/uruchi.glb',
  targetHeight: 2.15,
  baseHp: 205,
  baseAtk: 32,
  baseDef: 14,
  baseExp: 420,
  baseGold: 280,
  moveSpeed: 4.6,
  attackRange: 2.65,
  aggroRange: 14.5,
  attackCooldown: 1.15,
  telegraphTime: 0.46,
  element: 'fire',
  color: 0xdc2626,
  scale: 1.92,
  skills: ['uruchi_drake_breath', 'uruchi_whirlwind', 'earth_splitter']
};

MONSTER_CATALOG.isyutaru = {
  type: 'isyutaru',
  name: 'Lady Glaciera',
  uniquePrefab: 'isyutaru',
  glbPath: '/assets/sro/mobs/isyutaru.glb',
  targetHeight: 2.15,
  baseHp: 250,
  baseAtk: 37,
  baseDef: 17,
  baseExp: 650,
  baseGold: 420,
  moveSpeed: 4.2,
  attackRange: 10.5,
  aggroRange: 17.5,
  attackCooldown: 1.22,
  telegraphTime: 0.48,
  isRanged: true,
  element: 'ice',
  color: 0x38bdf8,
  scale: 1.98,
  skills: ['isyutaru_blizzard', 'ice_lance_barrage', 'frost_prison_nova']
};

MONSTER_CATALOG.lord_yarkan = {
  type: 'lord_yarkan',
  name: 'Valkor, Bone Sovereign',
  uniquePrefab: 'lord_yarkan',
  glbPath: '/assets/sro/mobs/bonelord.glb',
  targetHeight: 2.35,
  baseHp: 300,
  baseAtk: 43,
  baseDef: 20,
  baseExp: 960,
  baseGold: 640,
  moveSpeed: 4.3,
  attackRange: 2.9,
  aggroRange: 15.5,
  attackCooldown: 1.18,
  telegraphTime: 0.48,
  element: 'earth',
  color: 0xf59e0b,
  scale: 2.1,
  skills: ['yarkan_magma_eruption', 'yarkan_sandstorm', 'desert_earthquake', 'solar_spear_volley']
};

MONSTER_CATALOG.demon_shaitan = {
  type: 'demon_shaitan',
  name: 'Malakor, Ember Archfiend',
  uniquePrefab: 'demon_shaitan',
  glbPath: '/assets/sro/mobs/tahomet.glb',
  targetHeight: 2.25,
  baseHp: 350,
  baseAtk: 48,
  baseDef: 22,
  baseExp: 1350,
  baseGold: 900,
  moveSpeed: 4.5,
  attackRange: 3.1,
  aggroRange: 16.0,
  attackCooldown: 1.15,
  telegraphTime: 0.46,
  element: 'fire',
  color: 0xef4444,
  scale: 2.18,
  skills: ['hellfire_meteor_rain', 'abyssal_soul_drain', 'infernal_nova']
};

MONSTER_CATALOG.roc = {
  type: 'roc',
  name: 'Aetherion, Sky Sovereign',
  uniquePrefab: 'roc',
  glbPath: '/assets/sro/mobs/roc.glb',
  targetSpan: 4.3,
  baseHp: 400,
  baseAtk: 55,
  baseDef: 26,
  baseExp: 2400,
  baseGold: 1600,
  moveSpeed: 4.85,
  attackRange: 3.5,
  aggroRange: 18.0,
  attackCooldown: 1.1,
  telegraphTime: 0.44,
  element: 'lightning',
  color: 0x0ea5e9,
  scale: 2.35,
  skills: ['roc_hurricane_gale', 'roc_wing_slam', 'sky_feather_storm', 'thunder_judgment']
};

MONSTER_CATALOG.medusa = {
  type: 'medusa',
  name: 'Vespera, Venom Queen',
  uniquePrefab: 'medusa',
  glbPath: '/assets/sro/mobs/whitesnake.glb',
  targetHeight: 2.20,
  baseHp: 275,
  baseAtk: 40,
  baseDef: 18,
  baseExp: 800,
  baseGold: 520,
  moveSpeed: 4.15,
  attackRange: 10.2,
  aggroRange: 17.0,
  attackCooldown: 1.2,
  telegraphTime: 0.48,
  isRanged: true,
  element: 'poison',
  color: 0x22c55e,
  scale: 2.02,
  skills: ['venom_gaze', 'viper_orb_fan', 'poison_nova', 'serpent_coil_slam']
};

const SRO_ELEMENT_COLORS = {
  physical: 0xd97706,
  fire: 0xf97316,
  ice: 0x38bdf8,
  lightning: 0xfacc15,
  poison: 0x22c55e,
  earth: 0xa16207,
  dark: 0x9333ea
};

function addSroMobs(specs) {
  for (const s of specs) {
    const [type, name, file, height, element, hp, atk, def, skills = [], opts = {}] = s;
    if (MONSTER_CATALOG[type]) continue;
    const isRanged = Boolean(opts.isRanged);
    MONSTER_CATALOG[type] = {
      type,
      name,
      glbPath: `/assets/sro/mobs/${file}`,
      targetHeight: height,
      baseHp: hp,
      baseAtk: atk,
      baseDef: def,
      baseExp: Math.round(hp * 0.42 + atk * 1.15),
      baseGold: Math.round(hp * 0.2 + atk * 0.55),
      moveSpeed: opts.moveSpeed || (isRanged ? 3.55 : height > 2.0 ? 3.4 : 4.25),
      attackRange: isRanged ? Math.max(9.8, opts.attackRange ? opts.attackRange * 1.9 : 11.2) : (opts.attackRange || (height > 2.0 ? 2.2 : 1.85)),
      aggroRange: opts.aggroRange || (isRanged ? 15.5 : 10.5),
      attackCooldown: opts.attackCooldown || (isRanged ? 1.55 : 1.32),
      telegraphTime: opts.telegraphTime || 0.42,
      isRanged,
      element,
      color: SRO_ELEMENT_COLORS[element] || 0xd97706,
      scale: opts.scale || 1.0,
      skills
    };
  }
}

addSroMobs([
  // Fungal Caverns & Echoing Galleries
  ['bug_ghost', 'Bug Ghost', 'bugghost.glb', 1.45, 'poison', 56, 13, 4, ['acid_spit']],
  ['work_earth_ghost', 'Earth Magician', 'workearthghost.glb', 1.65, 'earth', 74, 17, 6, ['earth_stomp'], { isRanged: true, attackRange: 4.5 }],
  ['soldier_earth_ghost', 'Earth Ghost Soldier', 'soldierearthghost.glb', 1.72, 'earth', 88, 19, 8, ['slash']],
  ['blindmon', 'Blindman Fiend', 'blindmon.glb', 1.68, 'dark', 82, 18, 6, ['pounce']],
  ['nachal', 'Nachal Sentinel', 'nachal.glb', 1.82, 'dark', 98, 21, 8, ['whirlwind_strike']],
  ['yacha', 'Yacha Warlord', 'yacha.glb', 1.9, 'dark', 112, 24, 9, ['earth_stomp', 'whirlwind_strike']],
  ['demon_horse', 'Demon Horse', 'demonhorse.glb', 1.88, 'fire', 108, 23, 8, ['charge'], { moveSpeed: 4.9 }],
  ['taese', 'Taese Bloodhound', 'taese.glb', 1.62, 'physical', 94, 20, 7, ['pounce'], { moveSpeed: 4.8 }],

  // Blackblade Stronghold & Rimevault Peaks
  ['black_robber', 'Blackblade Marauder', 'blackrobber.glb', 1.75, 'physical', 96, 21, 7, ['slash']],
  ['black_robber_archer', 'Blackblade Bowman', 'blackrobberarcher.glb', 1.75, 'physical', 78, 20, 5, ['arrow_volley', 'poison_arrow'], { isRanged: true, attackRange: 5.5 }],
  ['red_eye_ghost', 'Red-Eyed Ghost', 'redeyeghost.glb', 1.5, 'dark', 72, 19, 5, ['curse_drain'], { isRanged: true, attackRange: 4.5 }],
  ['ong', 'Ong Swarmwalker', 'ong.glb', 1.38, 'poison', 82, 18, 6, ['acid_spit']],
  ['scorpion', 'Desert Scorpion', 'scorpion.glb', 1.35, 'poison', 88, 20, 7, ['acid_spit']],
  ['red_scorpion', 'Red Crimson Scorpion', 'redscorpion.glb', 1.48, 'poison', 110, 24, 9, ['acid_spit', 'poison_nova']],
  ['desert_trunkz', 'Blood Death Bug', 'deserttrunkz.glb', 1.65, 'earth', 125, 25, 11, ['earth_stomp']],
  ['big_spider', 'Silkfang Weaver', 'bigspider.glb', 1.68, 'poison', 118, 24, 8, ['acid_spit']],
  ['yeowa', 'Venomclaw Spider', 'yeowa.glb', 1.58, 'poison', 112, 23, 8, ['pounce']],
  ['ishade', 'Rime Ice Fiend', 'ishade.glb', 1.75, 'ice', 122, 26, 9, ['frost_wave'], { isRanged: true, attackRange: 4.8 }],
  ['planar', 'Planar Specter', 'planar.glb', 1.78, 'ice', 128, 27, 9, ['frost_wave', 'curse_drain'], { isRanged: true, attackRange: 4.6 }],
  ['yeti', 'Frosthollow Yeti', 'yeti.glb', 2.05, 'ice', 165, 30, 14, ['earth_stomp']],
  ['penon_fighter', 'Frostguard Fighter', 'penon_f.glb', 1.92, 'ice', 158, 29, 13, ['whirlwind_strike', 'slash']],
  ['penon_warrior', 'Frostguard Warrior', 'penon_w.glb', 2.02, 'ice', 175, 32, 14, ['earth_stomp', 'charge']],
  ['snow_spider', 'Rime Frost Spider', 'spider.glb', 1.62, 'ice', 132, 26, 10, ['frost_wave']],
  ['white_spider', 'Great White Spider', 'gwhitespider.glb', 1.85, 'ice', 152, 29, 12, ['pounce', 'frost_wave']],

  // Sunken Imperial Mausoleum
  ['tomb_stone_spirit', 'Tomb Stone Spirit', 'tombstoneghost.glb', 1.62, 'earth', 130, 26, 12, ['earth_stomp']],
  ['tomb_bug_ghost', 'Tomb Bug Ghost', 'tombbugghost.glb', 1.48, 'poison', 122, 25, 10, ['acid_spit']],
  ['bomb_stone_ghost', 'Bomb Tombstone Ghost', 'bombstoneghost.glb', 1.65, 'fire', 128, 29, 11, ['powder_blast'], { isRanged: true, attackRange: 4.5 }],
  ['qinshi_tombstone', 'Sunken Obelisk', 'qinshitombstone.glb', 1.72, 'earth', 148, 27, 15, ['earth_stomp']],
  ['tomb_soldier', 'Terracotta Tomb Soldier', 'tombsoldier.glb', 1.82, 'physical', 145, 28, 12, ['slash']],
  ['tomb_archer', 'Terracotta Tomb Archer', 'tombarcher.glb', 1.8, 'physical', 125, 28, 9, ['arrow_volley'], { isRanged: true, attackRange: 5.8 }],
  ['tomb_general', 'Terracotta Tomb General', 'tombgeneral.glb', 1.98, 'physical', 185, 34, 15, ['whirlwind_strike', 'charge']],
  ['royal_soldier', 'Sunken Royal Guard', 'royalsoldier.glb', 1.95, 'physical', 192, 35, 16, ['whirlwind_strike', 'earth_stomp']],
  ['snake_slave', 'Snake Slave', 'snakeslave.glb', 1.78, 'poison', 140, 28, 11, ['slash']],
  ['snake_man', 'Tomb Snake Warrior', 'snakeman.glb', 1.86, 'poison', 158, 31, 13, ['slash', 'acid_spit']],
  ['snake_demon', 'Snake Demon', 'snakedemon.glb', 1.95, 'poison', 180, 34, 14, ['poison_nova', 'whirlwind_strike']],
  ['snake_general', 'Tomb Snake General', 'snakegeneral.glb', 2.05, 'poison', 210, 37, 17, ['serpent_coil_slam', 'whirlwind_strike']],
  ['snake_woman', 'Tomb Snake Mistress', 'snakewoman.glb', 1.92, 'poison', 175, 35, 13, ['venom_gaze', 'poison_nova'], { isRanged: true, attackRange: 5.2 }],
  ['black_snake', 'Black Viper Sentinel', 'blacksnake.glb', 1.88, 'poison', 168, 33, 14, ['venom_gaze', 'pounce']],
  ['east_guardian', 'Tomb East Guardian', 'eastguardian.glb', 2.1, 'lightning', 225, 38, 18, ['whirlwind_strike', 'shockwave']],
  ['west_guardian', 'Tomb West Guardian', 'westguardian.glb', 2.1, 'earth', 230, 38, 19, ['earth_stomp', 'charge']],
  ['north_guardian', 'Tomb North Guardian', 'northguardian.glb', 2.12, 'ice', 235, 39, 19, ['frost_wave', 'shockwave']],
  ['south_guardian', 'Tomb South Guardian', 'southguardian.glb', 2.12, 'fire', 235, 40, 18, ['infernal_nova', 'earth_stomp']],

  // Caldera Sanctum & Sunspire Wastes
  ['flame_ghost', 'Flame Ghost', 'flame_ghost.glb', 1.7, 'fire', 162, 34, 13, ['powder_blast'], { isRanged: true, attackRange: 4.8 }],
  ['flame_evil', 'Flame Fiend', 'flame_evil.glb', 1.75, 'fire', 168, 35, 14, ['infernal_nova'], { isRanged: true, attackRange: 4.8 }],
  ['flame_salamander', 'Flame Salamander', 'flame_salamander.glb', 1.65, 'fire', 174, 34, 14, ['pounce', 'infernal_nova']],
  ['flame_witch', 'Flame Witch', 'flame_witch.glb', 1.82, 'fire', 160, 38, 12, ['infernal_nova', 'powder_blast'], { isRanged: true, attackRange: 5.4 }],
  ['flame_archer', 'Flame Ritual Archer', 'flame_archer.glb', 1.82, 'fire', 156, 36, 12, ['arrow_volley'], { isRanged: true, attackRange: 5.8 }],
  ['flame_captain', 'Flame Captain', 'flame_captain.glb', 1.98, 'fire', 215, 39, 17, ['whirlwind_strike', 'charge']],
  ['flame_adjutant', 'Flame Adjutant', 'flame_adjutant.glb', 1.92, 'fire', 205, 37, 16, ['slash', 'infernal_nova']],
  ['flame_cow_king', 'Flame Bull Guardian', 'flame_cowking.glb', 2.12, 'fire', 245, 42, 20, ['charge', 'earth_stomp']],
  ['flame_giant', 'Flame Giant', 'flame_giant.glb', 2.18, 'fire', 255, 44, 21, ['earth_stomp', 'infernal_nova']],
  ['flame_gigantic', 'Molten Gigantic', 'flame_gigantic.glb', 2.25, 'fire', 270, 45, 22, ['shockwave', 'infernal_nova']],
  ['flame_crazy', 'Crazed Flame Demon', 'flame_crazy.glb', 1.95, 'fire', 225, 42, 17, ['whirlwind_strike', 'charge']],
  ['bone_soldier', 'Sunspire Bone Soldier', 'bonesoldier.glb', 1.82, 'dark', 175, 35, 15, ['slash']],
  ['bone_hunter', 'Bone Archer Hunter', 'bonehunter.glb', 1.8, 'dark', 158, 36, 12, ['arrow_volley'], { isRanged: true, attackRange: 5.6 }],
  ['bone_mage', 'Sunspire Bone Shaman', 'bonemage.glb', 1.85, 'dark', 162, 38, 13, ['curse_drain'], { isRanged: true, attackRange: 5.2 }],
  ['bone_general', 'Sunspire Bone General', 'bonegeneral.glb', 2.02, 'dark', 220, 41, 18, ['whirlwind_strike', 'charge']],
  ['bone_lord', 'Sunspire Sovereign Lord', 'bonelord.glb', 2.15, 'dark', 250, 44, 20, ['shockwave', 'curse_drain']],
  ['devil_eye', 'Sunspire Devil Eye', 'devileye.glb', 1.65, 'dark', 168, 37, 13, ['curse_drain'], { isRanged: true, attackRange: 5.2 }],
  ['edimmu', 'Edimmu Nightstalker', 'edimmu.glb', 1.88, 'dark', 190, 38, 15, ['pounce', 'curse_drain']],
  ['death_kara', 'Death Karkadann', 'deathkara.glb', 2.05, 'earth', 235, 42, 19, ['charge', 'earth_stomp']],
  ['hyeongcheon', 'Doomforge Vanguard', 'hyeongcheon.glb', 2.18, 'earth', 260, 45, 21, ['earth_stomp', 'whirlwind_strike']],

  // Sunken Sun Sanctum
  ['sand_mummy', 'Crypt Mummy', 'mummy.glb', 1.82, 'poison', 215, 40, 17, ['acid_spit']],
  ['aker', 'Aker Lion Guardian', 'aker.glb', 2.08, 'earth', 265, 45, 21, ['charge', 'earth_stomp']],
  ['anubis', 'Anubis Temple Knight', 'anubis.glb', 2.15, 'dark', 280, 47, 22, ['whirlwind_strike', 'curse_drain']],
  ['heron', 'Heron Temple Striker', 'heron.glb', 1.98, 'lightning', 245, 43, 19, ['pounce', 'shockwave']],
  ['keisas', 'Keisas Berserker', 'keisas.glb', 2.05, 'physical', 270, 46, 20, ['whirlwind_strike', 'charge']],
  ['apriest', 'Crypt Dark Priest', 'apriest.glb', 1.88, 'dark', 215, 45, 16, ['curse_drain'], { isRanged: true, attackRange: 5.5 }],
  ['spector', 'Spector Tomb Fiend', 'spector.glb', 1.9, 'dark', 225, 44, 17, ['curse_drain'], { isRanged: true, attackRange: 5.2 }],
  ['sphinx', 'Sphinx Sentinel', 'sphinx.glb', 2.12, 'earth', 295, 48, 24, ['desert_earthquake', 'charge']],
  ['sandman', 'Sandman Elemental', 'sandman.glb', 1.85, 'earth', 240, 42, 19, ['desert_earthquake']],
  ['sd_raider', 'Salt Desert Raider', 'raider.glb', 1.85, 'physical', 230, 43, 18, ['slash', 'pounce']],
  ['bastet', 'Bastet Sandstalker', 'bastet.glb', 1.96, 'lightning', 255, 45, 20, ['pounce', 'whirlwind_strike']],
  ['mont', 'Mont Solar Vanguard', 'mont.glb', 2.08, 'fire', 275, 47, 22, ['whirlwind_strike', 'infernal_nova']],
  ['sekhmet', 'Sekhmet Flame Warden', 'sekhmet.glb', 2.05, 'fire', 278, 48, 21, ['infernal_nova', 'charge']],
  ['haroeris', 'Haroeris Falcon Knight', 'haroeris.glb', 2.05, 'lightning', 268, 46, 21, ['whirlwind_strike', 'shockwave']],
  ['osiris', 'Osiris Underworld Champion', 'osiris.glb', 2.15, 'dark', 295, 49, 23, ['curse_drain', 'shockwave']],
  ['isis', 'Isis Temple Oracle', 'isis.glb', 1.95, 'ice', 250, 47, 19, ['frost_wave'], { isRanged: true, attackRange: 5.6 }],
  ['neith', 'Neith Astral Weaver', 'neith.glb', 1.98, 'poison', 255, 47, 19, ['poison_nova'], { isRanged: true, attackRange: 5.6 }],
  ['selkis', 'Selkis Venom Guard', 'selkis.glb', 2.02, 'poison', 265, 46, 20, ['acid_spit', 'poison_nova']],
  ['seth', 'Seth Chaos Harbinger', 'seth.glb', 2.22, 'dark', 310, 50, 25, ['desert_earthquake', 'infernal_nova']],

  // Stormspire Temple
  ['babilion', 'Sanctum Guard', 'babilion.glb', 2.05, 'lightning', 280, 48, 22, ['whirlwind_strike']],
  ['mino', 'Minotaur Enforcer', 'mino.glb', 2.18, 'earth', 305, 51, 24, ['charge', 'earth_stomp']],
  ['griffin', 'Storm Griffin', 'griffin.glb', 2.1, 'lightning', 290, 50, 22, ['pounce', 'shockwave']],
  ['charm_witch', 'Charm Witch', 'charm_witch.glb', 1.88, 'dark', 250, 49, 18, ['curse_drain'], { isRanged: true, attackRange: 5.5 }],
  ['fear_serpent', 'Fear Serpent', 'fear_serpent.glb', 1.92, 'poison', 268, 48, 20, ['venom_gaze', 'poison_nova']],
  ['fanaticism', 'Zealot of Fanaticism', 'fanaticism.glb', 1.9, 'fire', 265, 49, 20, ['infernal_nova', 'slash']],
  ['desire_watcher', 'Watcher of Desire', 'desire_watch.glb', 1.92, 'dark', 262, 50, 19, ['curse_drain'], { isRanged: true, attackRange: 5.5 }],
  ['devil_dog', 'Hellhound of Zeal', 'devildog.glb', 1.75, 'fire', 255, 47, 19, ['pounce', 'charge']],
  ['dark_dog', 'Abyssal Cerberus', 'dark_dog.glb', 1.82, 'dark', 265, 48, 20, ['pounce']],
  ['devil_dark', 'Shadow Archdemon', 'devil_dark.glb', 2.12, 'dark', 300, 51, 24, ['curse_drain', 'shockwave']],
  ['immortal_warden', 'Immortal Temple Paladin', 'immotal.glb', 2.08, 'lightning', 295, 50, 23, ['whirlwind_strike', 'shockwave']],
  ['nike_lion', 'Winged Lion Guardian', 'nike_lion.glb', 2.15, 'lightning', 310, 52, 24, ['charge', 'shockwave']],
  ['the_earth', 'The Earth Titan', 'the_earth.glb', 2.25, 'earth', 340, 53, 27, ['desert_earthquake', 'earth_stomp']],
  ['yuno', 'Juno Astral Maiden', 'yuno.glb', 2.02, 'ice', 290, 51, 22, ['frost_wave'], { isRanged: true, attackRange: 5.6 }],
  ['jupiter_sentinel', 'Stormspire Thunder Avatar', 'jupiter.glb', 2.24, 'lightning', 335, 54, 26, ['shockwave', 'charge']],
  ['baal', 'Baal Infernal Lord', 'baal.glb', 2.26, 'fire', 345, 55, 27, ['infernal_nova', 'whirlwind_strike']],

  // Underworld Abyss
  ['wendigo', 'Abyssal Wendigo', 'wendigo.glb', 2.08, 'ice', 315, 52, 24, ['frost_wave', 'pounce']],
  ['succubus', 'Abyssal Succubus', 'succubus.glb', 1.92, 'dark', 285, 52, 21, ['curse_drain'], { isRanged: true, attackRange: 5.6 }],
  ['void_devil', 'Void Devil', 'voiddevil.glb', 2.12, 'dark', 325, 54, 25, ['shockwave', 'curse_drain']],
  ['dark_guardian', 'Dark Abyss Guardian', 'darkguardian.glb', 2.18, 'dark', 340, 55, 27, ['whirlwind_strike', 'earth_stomp']],
  ['goat_demon', 'Horned Goat Demon', 'goatdemon.glb', 2.08, 'fire', 320, 53, 25, ['charge', 'infernal_nova']],
  ['garm', 'Garm Hellhound', 'garm.glb', 1.88, 'fire', 300, 52, 23, ['pounce', 'charge']],
  ['shamoot', 'Shamoot Fiend', 'shamoot.glb', 2.1, 'fire', 330, 54, 25, ['infernal_nova', 'whirlwind_strike']],
  ['underworld_knight', 'Underworld Doom Knight', 'knight.glb', 2.05, 'dark', 335, 54, 26, ['whirlwind_strike', 'charge']],
  ['shambhala_mage', 'Void Acolyte', 'mage.glb', 1.94, 'dark', 290, 55, 22, ['curse_drain'], { isRanged: true, attackRange: 5.6 }],
  ['narun', 'Narun Demonspawn', 'narun.glb', 2.15, 'dark', 342, 55, 26, ['shockwave', 'pounce']],
  ['dm_soldier', 'Asura Infernal Soldier', 'dmsolide.glb', 2.02, 'fire', 318, 53, 25, ['slash', 'whirlwind_strike']],
  ['andras', 'Andras Abyss Sovereign', 'andras.glb', 2.25, 'dark', 360, 57, 28, ['shockwave', 'curse_drain']],

  // Celestial Summit — Wing Tribe Eyrie
  ['rocky', 'Stormpeak Bird', 'rocky.glb', 1.75, 'lightning', 320, 54, 24, ['pounce']],
  ['feather_mask', 'Feather Mask Warrior', 'feathermask.glb', 1.95, 'lightning', 345, 56, 26, ['slash', 'whirlwind_strike']],
  ['wing_tribe', 'Wing Tribe Guardian', 'wingtribe.glb', 2.05, 'lightning', 360, 58, 28, ['whirlwind_strike', 'charge']],
  ['wing_tribe_spear', 'Wing Tribe Spearthrower', 'wingtribespear.glb', 2.02, 'lightning', 335, 58, 25, ['arrow_volley'], { isRanged: true, attackRange: 5.8 }],
  ['mountain_spirit', 'Stormpeak Wind Spirit', 'spirits.glb', 1.9, 'lightning', 330, 57, 24, ['frost_wave'], { isRanged: true, attackRange: 5.5 }],
  ['bone_roc', 'Bone Sky Scavenger', 'boneroc.glb', 2.15, 'dark', 375, 60, 29, ['pounce', 'shockwave']],
  ['antelope', 'Peak Horned Antelope', 'antelope.glb', 1.85, 'physical', 330, 55, 25, ['charge']],
  ['mountain_goat', 'Rocky Mountain Goat', 'goat.glb', 1.78, 'earth', 328, 54, 25, ['charge', 'earth_stomp']],
  ['devil_saytan', 'Ember Cult Disciple', 'devilsaytan.glb', 2.22, 'fire', 390, 62, 30, ['infernal_nova', 'whirlwind_strike']],

  // Forgotten Rift S1F — Ashen Totem Hollow
  ['togui_doll', 'Ashen Totem', 'togui_doll.glb', 1.48, 'dark', 185, 38, 15, ['pounce']],
  ['togui_boom', 'Cursed Boom Mask', 'togui_boom.glb', 1.68, 'fire', 175, 42, 13, ['powder_blast'], { isRanged: true, attackRange: 4.8 }],
  ['togui_soldier', 'Ashen Tribe Warrior', 'togui_soldier.glb', 1.92, 'physical', 210, 40, 17, ['slash', 'whirlwind_strike']],
  ['togui_magic', 'Ashen Tribe Shaman', 'togui_magic.glb', 1.88, 'dark', 190, 42, 15, ['curse_drain'], { isRanged: true, attackRange: 5.4 }],
  ['togui_strong', 'Ashen Iron Brute', 'togui_strong.glb', 2.12, 'earth', 255, 45, 21, ['earth_stomp', 'charge']],
  ['togui_general', 'Ashen War General', 'togui_general.glb', 2.08, 'fire', 245, 44, 20, ['whirlwind_strike', 'charge']],
  ['togui_elder', 'Ashen Elder Soothsayer', 'togui_elder.glb', 1.98, 'dark', 230, 46, 18, ['curse_drain', 'poison_nova'], { isRanged: true, attackRange: 5.6 }],
  ['togui_chieftain', 'Ashen Chieftain', 'togui_togui.glb', 2.25, 'fire', 280, 48, 22, ['shockwave', 'infernal_nova']],

  // Forgotten Rift S2F — Dread Galleon Wreck
  ['ghost_pirate', 'Ghost Ship Pirate', 'ghost_pirate.glb', 1.9, 'dark', 230, 44, 18, ['slash']],
  ['ghost_marauder', 'Ghost Ship Marauder', 'ghost_marauder.glb', 1.98, 'physical', 255, 47, 20, ['whirlwind_strike', 'charge']],
  ['ghost_beast', 'Ghost Abyssal Beast', 'ghost_beast.glb', 2.02, 'poison', 265, 48, 21, ['pounce', 'acid_spit']],
  ['ghost_curse', 'Ghost Cursed Sailor', 'ghost_curse.glb', 1.88, 'dark', 225, 47, 17, ['curse_drain'], { isRanged: true, attackRange: 5.4 }],
  ['ghost_gluttony', 'Ghost Of Gluttony', 'ghost_gluttony.glb', 2.12, 'poison', 295, 50, 23, ['poison_nova', 'earth_stomp']],
  ['ghost_specter', 'Abyssal Ship Specter', 'ghost_specter.glb', 1.92, 'ice', 235, 48, 18, ['frost_wave'], { isRanged: true, attackRange: 5.5 }],
  ['ghost_seiren', 'Drowned Seiren', 'ghost_seiren.glb', 1.95, 'ice', 245, 49, 19, ['frost_wave', 'curse_drain'], { isRanged: true, attackRange: 5.6 }],
  ['ghost_undine', 'Shipwreck Undine', 'ghost_undine.glb', 1.9, 'ice', 238, 48, 18, ['frost_wave'], { isRanged: true, attackRange: 5.5 }],
  ['ghost_king_nipper', 'Abyssal King Nipper', 'ghost_kingnipper.glb', 2.05, 'poison', 275, 49, 22, ['pounce', 'whirlwind_strike']],
  ['ghost_commander', 'Dread Ghost Commander', 'ghost_commander.glb', 2.15, 'dark', 305, 52, 24, ['whirlwind_strike', 'shockwave']],
  ['ghost_wreck', 'Dread Captain Vane', 'ghost_wreck.glb', 2.22, 'dark', 320, 54, 25, ['curse_drain', 'shockwave']]
]);

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
    name: 'Frostfang Empress',
    title: '',
    subtitle: 'Steppe Savagery Queen',
    glbPath: '/assets/sro/mobs/tigerwoman.glb',
    mountGlbPath: '/assets/sro/mobs/bluetiger.glb',
    mountTargetHeight: 1.78,
    targetHeight: 1.62,
    hpMult: 10.5,
    atkMult: 2.55,
    defMult: 2.05,
    scale: 2.15,
    color: 0xf97316,
    element: 'fire',
    summonType: 'white_tiger',
    summonPool: ['tiger', 'white_tiger'],
    summonBands: [0.8, 0.58, 0.35],
    summonCount: 3,
    appearMsg: '🐅 [UNIQUE] Frostfang Empress mounts her Stormpelt Tiger and stalks the chamber!',
    skills: ['flame_claw_leap', 'tiger_dark_curse', 'tiger_roar_ring', 'whitetiger_pack', 'charge']
  },
  6: {
    id: 'uruchi',
    legacyId: 'celestine',
    type: 'uruchi',
    uniquePrefab: 'uruchi',
    glbPath: '/assets/sro/mobs/uruchi.glb',
    name: 'Warchief Drakmor',
    title: '',
    subtitle: 'Blackblade Overlord',
    targetHeight: 2.15,
    hpMult: 11.5,
    atkMult: 2.7,
    defMult: 2.2,
    scale: 2.1,
    color: 0xdc2626,
    element: 'fire',
    summonType: 'bandit_archer',
    summonPool: ['bandit', 'bandit_archer'],
    summonBands: [0.8, 0.6, 0.38],
    summonCount: 3,
    appearMsg: '🔥 [UNIQUE] Warchief Drakmor rides forth atop his Armored War-Drake!',
    skills: ['uruchi_drake_breath', 'uruchi_whirlwind', 'bandit_ambush_volley', 'earth_splitter', 'summon']
  },
  9: {
    id: 'isyutaru',
    legacyId: 'onim',
    type: 'isyutaru',
    uniquePrefab: 'isyutaru',
    glbPath: '/assets/sro/mobs/isyutaru.glb',
    name: 'Lady Glaciera',
    title: '',
    subtitle: 'Rimevault Frost Empress',
    targetHeight: 2.15,
    hpMult: 13.0,
    atkMult: 2.85,
    defMult: 2.35,
    scale: 2.2,
    color: 0x38bdf8,
    element: 'ice',
    summonType: 'water_ghost',
    summonPool: ['yeoha', 'water_ghost'],
    summonBands: [0.8, 0.58, 0.36],
    summonCount: 3,
    appearMsg: '❄️ [UNIQUE] Lady Glaciera freezes the air with ancient mirrors!',
    skills: ['isyutaru_blizzard', 'ice_lance_barrage', 'frost_prison_nova', 'isyutaru_ice_mirror_shield', 'summon']
  },
  12: {
    id: 'lord_yarkan',
    legacyId: 'chaos',
    type: 'lord_yarkan',
    uniquePrefab: 'lord_yarkan',
    glbPath: '/assets/sro/mobs/bonelord.glb',
    name: 'Valkor, Bone Sovereign',
    title: '',
    subtitle: 'Sunspire Sand Monarch',
    targetHeight: 2.35,
    hpMult: 14.5,
    atkMult: 3.1,
    defMult: 2.55,
    scale: 2.3,
    color: 0xf59e0b,
    element: 'earth',
    summonType: 'hyungno',
    summonPool: ['hyungno', 'earth_ghost'],
    summonBands: [0.8, 0.58, 0.36],
    summonCount: 4,
    appearMsg: '🏜️ [UNIQUE] Valkor, Bone Sovereign ignites his solar wheel beneath the sands!',
    skills: ['yarkan_magma_eruption', 'yarkan_sandstorm', 'desert_earthquake', 'solar_spear_volley', 'charge', 'summon']
  },
  15: {
    id: 'demon_shaitan',
    legacyId: 'devil',
    type: 'demon_shaitan',
    uniquePrefab: 'demon_shaitan',
    glbPath: '/assets/sro/mobs/tahomet.glb',
    name: 'Malakor, Ember Archfiend',
    title: '',
    subtitle: 'Caldera Archfiend',
    targetHeight: 2.25,
    hpMult: 16.5,
    atkMult: 3.35,
    defMult: 2.7,
    scale: 2.5,
    color: 0xdc2626,
    element: 'fire',
    summonType: 'devil_bug',
    summonPool: ['devil_bug', 'gunpowder_ghost'],
    summonBands: [0.82, 0.6, 0.38],
    summonCount: 4,
    appearMsg: '😈 [UNIQUE] Malakor, Ember Archfiend tears open the Ember Abyss with Hellfire!',
    skills: ['hellfire_meteor_rain', 'abyssal_soul_drain', 'infernal_nova', 'charge', 'summon']
  },
  16: {
    id: 'roc',
    legacyId: 'roc',
    type: 'roc',
    uniquePrefab: 'roc',
    glbPath: '/assets/sro/mobs/roc.glb',
    name: 'Aetherion, Sky Sovereign',
    title: '',
    subtitle: 'Monarch of the Celestial Tempest',
    targetSpan: 4.3,
    hpMult: 19.0,
    atkMult: 3.7,
    defMult: 2.95,
    scale: 2.85,
    color: 0x0ea5e9,
    element: 'lightning',
    summonType: 'blue_tiger',
    summonPool: ['blue_tiger', 'devil_bug', 'ghost_bug'],
    summonBands: [0.8, 0.6, 0.4, 0.22],
    summonCount: 4,
    appearMsg: '🦅 [FINAL UNIQUE] Aetherion, Sky Sovereign descends with four storm wings!',
    skills: ['roc_hurricane_gale', 'roc_wing_slam', 'sky_feather_storm', 'thunder_judgment', 'abyssal_soul_drain', 'summon']
  },
  103: {
    id: 'medusa',
    legacyId: 'medusa',
    type: 'medusa',
    uniquePrefab: 'medusa',
    glbPath: '/assets/sro/mobs/whitesnake.glb',
    name: 'Vespera, Venom Queen',
    title: '',
    subtitle: 'Abyssal Gorgon Queen',
    targetHeight: 2.20,
    hpMult: 13.5,
    atkMult: 2.95,
    defMult: 2.45,
    scale: 2.35,
    color: 0x22c55e,
    element: 'poison',
    summonType: 'chakji',
    summonPool: ['chakji', 'water_ghost'],
    summonBands: [0.8, 0.55],
    summonCount: 3,
    appearMsg: '🐍 [UNIQUE] Vespera, Venom Queen awakens inside her sunken shrine!',
    skills: ['venom_gaze', 'viper_orb_fan', 'poison_nova', 'serpent_coil_slam', 'summon']
  },
  13: {
    id: 'seth_unique',
    type: 'seth',
    glbPath: '/assets/sro/mobs/seth.glb',
    name: 'Seth the Chaos Sovereign',
    subtitle: 'Sunken Sun Sanctum Guardian',
    targetHeight: 2.35,
    hpMult: 11.5,
    atkMult: 2.75,
    defMult: 2.3,
    scale: 2.45,
    color: 0xf59e0b,
    element: 'dark',
    summonType: 'anubis',
    summonPool: ['anubis', 'sphinx', 'sand_mummy'],
    summonBands: [0.8, 0.55],
    summonCount: 3,
    appearMsg: '🏺 [UNIQUE] Seth the Chaos Sovereign rises inside the Sunken Sun Sanctum!',
    skills: ['desert_earthquake', 'infernal_nova', 'abyssal_soul_drain', 'charge', 'summon']
  },
  14: {
    id: 'jupiter_unique',
    type: 'baal',
    glbPath: '/assets/sro/mobs/baal.glb',
    name: 'Baal of Stormspire',
    subtitle: 'Infernal Warden of the Spire',
    targetHeight: 2.45,
    hpMult: 12.5,
    atkMult: 2.85,
    defMult: 2.45,
    scale: 2.55,
    color: 0xdc2626,
    element: 'fire',
    summonType: 'mino',
    summonPool: ['mino', 'babilion', 'griffin'],
    summonBands: [0.8, 0.55],
    summonCount: 3,
    appearMsg: '⚡ [UNIQUE] Baal of Stormspire shakes the Stormspire Hall!',
    skills: ['hellfire_meteor_rain', 'infernal_nova', 'thunder_judgment', 'charge', 'summon']
  },
  101: {
    id: 'togui_unique',
    type: 'togui_chieftain',
    glbPath: '/assets/sro/mobs/togui_togui.glb',
    name: 'High Shaman Vorak',
    subtitle: 'Cursed Mask Idol',
    targetHeight: 2.3,
    hpMult: 10.5,
    atkMult: 2.4,
    defMult: 2.0,
    scale: 2.3,
    color: 0xea580c,
    element: 'fire',
    summonType: 'togui_soldier',
    summonPool: ['togui_doll', 'togui_boom', 'togui_soldier'],
    summonBands: [0.75, 0.45],
    summonCount: 3,
    appearMsg: '👺 [UNIQUE] High Shaman Vorak awakens the Masked Tribe!',
    skills: ['infernal_nova', 'shockwave', 'earth_stomp', 'summon']
  },
  102: {
    id: 'sereness_unique',
    type: 'ghost_wreck',
    glbPath: '/assets/sro/mobs/ghost_wreck.glb',
    name: 'Dread Captain Vane',
    subtitle: 'Phantom Admiral of the Flame Wreck',
    targetHeight: 2.35,
    hpMult: 12.0,
    atkMult: 2.65,
    defMult: 2.25,
    scale: 2.4,
    color: 0x38bdf8,
    element: 'dark',
    summonType: 'ghost_pirate',
    summonPool: ['ghost_pirate', 'ghost_curse', 'ghost_seiren'],
    summonBands: [0.8, 0.5],
    summonCount: 3,
    appearMsg: '🏴‍☠️ [UNIQUE] Dread Captain Vane commands the Ghost Fleet!',
    skills: ['abyssal_soul_drain', 'frost_prison_nova', 'shockwave', 'summon']
  }
};

BOSS_CATALOG.kimura = BOSS_CATALOG[3];
BOSS_CATALOG.tiger_girl = BOSS_CATALOG[3];
BOSS_CATALOG.celestine = BOSS_CATALOG[6];
BOSS_CATALOG.bandit_lord = BOSS_CATALOG[6];
BOSS_CATALOG.uruchi = BOSS_CATALOG[6];
BOSS_CATALOG.onim = BOSS_CATALOG[9];
BOSS_CATALOG.earth_king = BOSS_CATALOG[9];
BOSS_CATALOG.sonhyeon = BOSS_CATALOG[9];
BOSS_CATALOG.isyutaru = BOSS_CATALOG[9];
BOSS_CATALOG.chaos = BOSS_CATALOG[12];
BOSS_CATALOG.blue_tiger_boss = BOSS_CATALOG[12];
BOSS_CATALOG.lord_yarkan = BOSS_CATALOG[12];
BOSS_CATALOG.devil = BOSS_CATALOG[15];
BOSS_CATALOG.hyeongcheon = BOSS_CATALOG[15];
BOSS_CATALOG.demon_shaitan = BOSS_CATALOG[15];
BOSS_CATALOG.roc = BOSS_CATALOG[16];
BOSS_CATALOG.medusa = BOSS_CATALOG[103];

Object.assign(UNIQUE_SKILL_LABELS, {
  tiger_claw_frenzy: 'EMPRESS CLAW FRENZY',
  tiger_dark_curse: 'STEPPE DARK CURSE',
  savage_roar: 'SAVAGE STEPPE ROAR',
  uruchi_drake_breath: 'WAR-DRAKE FLAME BREATH',
  uruchi_whirlwind: 'OVERLORD WHIRLWIND',
  isyutaru_blizzard: 'GLACIAL BLIZZARD',
  isyutaru_ice_mirror_shield: 'ICE MIRROR BARRIER',
  frost_prison_nova: 'FROST PRISON NOVA',
  ice_spear_volley: 'FROZEN LANCE VOLLEY',
  yarkan_magma_eruption: 'SCORCHING MAGMA ERUPTION',
  yarkan_sandstorm: 'SANDSTORM VORTEX',
  desert_earthquake: 'DESERT TECTONIC QUAKE',
  hellfire_meteor_rain: 'HELLFIRE METEOR RAIN',
  shaitan_soul_siphon: 'ABYSSAL SOUL SIPHON',
  infernal_roar: 'INFERNAL ARCHFIEND ROAR',
  roc_hurricane_gale: 'CELESTIAL HURRICANE GALE',
  roc_wing_slam: 'SKY SOVEREIGN WING SLAM',
  thunder_judgment: 'THUNDER JUDGMENT',
  sky_feather_storm: 'FEATHER STORM BARRAGE',
  petrify_gaze: 'VENOM PETRIFY GAZE',
  venom_barrage: 'ABYSSAL VENOM BARRAGE',
  serpent_coil_slam: 'SERPENT COIL SLAM'
});

export const FLOOR_BOSSES = BOSS_CATALOG;

export const FLOOR_POOLS = {
  // Outskirts & Fungal Echo Caverns (Upper -> Inner Sanctum)
  1: ['mangyang', 'gyo_weasel', 'bigeye_ghost', 'tiger', 'bug_ghost', 'water_ghost', 'yeoha', 'work_earth_ghost'],
  2: ['bug_ghost', 'work_earth_ghost', 'soldier_earth_ghost', 'earth_ghost', 'stone_ghost', 'blindmon', 'yeoha', 'bandit', 'bandit_archer'],
  3: ['soldier_earth_ghost', 'blindmon', 'nachal', 'yacha', 'demon_horse', 'taese', 'chakji', 'stone_ghost', 'earth_ghost'],

  // Oasis & Rimevault Stronghold
  4: ['black_robber', 'black_robber_archer', 'red_eye_ghost', 'ong', 'scorpion', 'red_scorpion', 'desert_trunkz', 'bandit', 'bandit_archer'],
  5: ['ishade', 'planar', 'yeti', 'penon_fighter', 'penon_warrior', 'snow_spider', 'white_spider', 'blue_tiger', 'white_tiger'],
  6: ['red_scorpion', 'desert_trunkz', 'big_spider', 'yeowa', 'black_robber', 'black_robber_archer', 'penon_fighter', 'penon_warrior', 'yeti', 'white_tiger', 'blue_tiger', 'gunpowder_ghost'],

  // Sunken Imperial Mausoleum (Terracotta -> Viper -> Four Guardians)
  7: ['tombstone_ghost', 'tomb_stone_spirit', 'tomb_bug_ghost', 'bomb_stone_ghost', 'qinshi_tombstone', 'tomb_soldier', 'tomb_archer', 'tomb_general', 'royal_soldier'],
  8: ['snake_slave', 'snake_man', 'snake_demon', 'snake_general', 'snake_woman', 'black_snake', 'tomb_soldier', 'tomb_archer', 'devil_bug'],
  9: ['east_guardian', 'west_guardian', 'north_guardian', 'south_guardian', 'royal_soldier', 'tomb_general', 'snake_general', 'snake_woman', 'hyungno'],

  // Caldera Sanctum & Sunspire Necropolis
  10: ['flame_ghost', 'flame_evil', 'flame_salamander', 'flame_witch', 'flame_archer', 'ghost_bug', 'devil_bug'],
  11: ['bone_soldier', 'bone_hunter', 'bone_mage', 'bone_general', 'bone_lord', 'devil_eye', 'edimmu', 'death_kara', 'hyeongcheon'],
  12: ['flame_captain', 'flame_adjutant', 'flame_cow_king', 'flame_giant', 'flame_gigantic', 'flame_crazy', 'flame_witch', 'flame_archer', 'hyungno', 'hyeongcheon'],

  // Sunken Sun Sanctum, Stormspire Temple, Underworld Abyss, Celestial Peak
  13: ['sand_mummy', 'aker', 'anubis', 'heron', 'keisas', 'apriest', 'spector', 'sphinx', 'sandman', 'sd_raider', 'bastet', 'mont', 'sekhmet', 'haroeris', 'osiris', 'isis', 'neith', 'selkis', 'seth'],
  14: ['babilion', 'mino', 'griffin', 'charm_witch', 'fear_serpent', 'fanaticism', 'desire_watcher', 'devil_dog', 'dark_dog', 'devil_dark', 'immortal_warden', 'nike_lion', 'the_earth', 'yuno', 'jupiter_sentinel', 'baal'],
  15: ['wendigo', 'succubus', 'void_devil', 'dark_guardian', 'goat_demon', 'garm', 'shamoot', 'underworld_knight', 'shambhala_mage', 'narun', 'dm_soldier', 'andras'],
  16: ['rocky', 'feather_mask', 'wing_tribe', 'wing_tribe_spear', 'mountain_spirit', 'bone_roc', 'antelope', 'mountain_goat', 'devil_saytan'],

  // Forgotten Rift Secret Floors (Ashen Totem Hollow, Dread Galleon Wreck, Vespera's Sanctum)
  101: ['togui_doll', 'togui_boom', 'togui_soldier', 'togui_magic', 'togui_strong', 'togui_general', 'togui_elder', 'togui_chieftain'],
  102: ['ghost_pirate', 'ghost_marauder', 'ghost_beast', 'ghost_curse', 'ghost_gluttony', 'ghost_specter', 'ghost_seiren', 'ghost_undine', 'ghost_king_nipper', 'ghost_commander', 'ghost_wreck'],
  103: ['snake_slave', 'snake_man', 'snake_demon', 'snake_general', 'snake_woman', 'black_snake', 'tomb_general', 'royal_soldier', 'east_guardian', 'west_guardian', 'north_guardian', 'south_guardian']
};

let _sharedEnemyUi = null;
function getSharedEnemyUi() {
  if (_sharedEnemyUi) return _sharedEnemyUi;
  const markShared = (obj) => {
    if (!obj) return obj;
    obj.userData = obj.userData || {};
    obj.userData.isCachedGLB = true;
    obj.userData.isSharedAsset = true;
    obj.userData.sharedAsset = true;
    return obj;
  };
  const bgGeo = markShared(new THREE.PlaneGeometry(1, 1));
  const bgMat = markShared(new THREE.MeshBasicMaterial({
    color: 0x0f172a,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.85
  }));
  const fillGeo = markShared(new THREE.PlaneGeometry(1, 1));
  fillGeo.translate(0.5, 0, 0);
  const telegraphGeo = markShared(new THREE.RingGeometry(0.18, 1.0, 24));
  const telegraphMat = markShared(new THREE.MeshBasicMaterial({
    color: 0xef4444,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.0
  }));
  const statusRingMobGeo = markShared(new THREE.RingGeometry(0.42, 0.54, 20));
  const statusRingBossGeo = markShared(new THREE.RingGeometry(0.8, 0.92, 20));
  _sharedEnemyUi = {
    bgGeo,
    bgMat,
    fillGeo,
    fillMats: new Map(),
    telegraphGeo,
    telegraphMat,
    statusRingMobGeo,
    statusRingBossGeo,
    statusRingMats: new Map(),
    getFillMat(color) {
      let mat = this.fillMats.get(color);
      if (!mat) {
        mat = markShared(new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide }));
        this.fillMats.set(color, mat);
      }
      return mat;
    },
    getStatusRingMat(color) {
      const key = Number(color) || 0xffffff;
      let mat = this.statusRingMats.get(key);
      if (!mat) {
        mat = markShared(new THREE.MeshBasicMaterial({
          color: key,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.6,
          depthWrite: false
        }));
        this.statusRingMats.set(key, mat);
      }
      return mat;
    }
  };
  return _sharedEnemyUi;
}

function attachHealthBarAndTelegraph(enemy) {
  const root = enemy.mesh;
  if (!root || typeof root.add !== 'function') return;

  const ui = getSharedEnemyUi();

  // Floating 3D health bar above monster
  const barGroup = new THREE.Group();
  barGroup.name = 'HealthBar';
  barGroup.userData.keepWithGLB = true;
  const barY = enemy.isBoss ? (root.userData?.visualTopY || 2.65) : enemy.isGiant ? 2.25 : enemy.isElite ? 1.95 : 1.65;
  barGroup.position.set(0, barY, 0);

  const width = enemy.isBoss ? 1.45 : enemy.isGiant ? 1.25 : enemy.isElite ? 1.05 : 0.82;
  const height = enemy.isBoss ? 0.13 : enemy.isGiant ? 0.11 : 0.09;

  const bgMesh = new THREE.Mesh(ui.bgGeo, ui.bgMat);
  bgMesh.scale.set(width + 0.04, height + 0.04, 1);
  bgMesh.userData.noFlash = true;
  barGroup.add(bgMesh);

  const fillColor = enemy.isBoss ? 0xef4444 : enemy.isGiant ? 0xf59e0b : enemy.isElite ? 0xfacc15 : 0x22c55e;
  const fillMesh = new THREE.Mesh(ui.fillGeo, ui.getFillMat(fillColor));
  fillMesh.scale.set(width, height, 1);
  fillMesh.position.set(-width * 0.5, 0, 0.01);
  fillMesh.userData.noFlash = true;
  fillMesh.userData.barWidth = width;
  fillMesh.userData.barHeight = height;
  barGroup.add(fillMesh);

  barGroup.visible = Boolean(enemy.isBoss || enemy.isGiant || enemy.isElite);
  root.add(barGroup);

  // Ground telegraph warning ring (visible during TELEGRAPH / SKILL windup)
  const ringRadius = enemy.attackRange ? Math.max(1.1, Math.min(3.6, enemy.attackRange * 0.85)) : 1.4;
  const telegraphMesh = new THREE.Mesh(ui.telegraphGeo, ui.telegraphMat);
  telegraphMesh.scale.set(ringRadius, ringRadius, 1);
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
    this.floor = config.isOutskirtMob ? 0 : Number(config.floor ?? 1);
    this.level = Number(config.level || Math.max(1, this.floor));

    this.isElite = Boolean(config.isElite);
    this.isBoss = Boolean(config.isBoss);
    this.isGiant = Boolean(config.isGiant);
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

    this.radius = this.isBoss ? 1.05 : this.isGiant ? 0.85 : this.isElite ? 0.62 : 0.48;
    this.spawnX = Number(config.x || 0);
    this.spawnZ = Number(config.z || 0);
    this.x = this.spawnX;
    this.y = 0;
    this.z = this.spawnZ;
    this.position = new THREE.Vector3(this.x, 0, this.z);
    this.rotation = Math.random() * Math.PI * 2;

    this.packId = config.packId || null;
    this.roomId = config.roomId ?? null;
    this.inBossRoom = Boolean(config.inBossRoom);
    this.isOutskirtMob = Boolean(config.isOutskirtMob);
    this.isVillageMob = Boolean(config.isVillageMob || config.isOutskirtMob);
    this.isChallengeMob = Boolean(config.isChallengeMob);
    this.campId = config.campId || null;
    this.campName = config.campName || null;
    this.campLevel = config.campLevel ? Number(config.campLevel) : null;
    this.spawnOnce = Boolean(config.spawnOnce);
    this.respawnDelay = Number(config.respawnDelay ?? 12);
    this.respawnTimer = 0;
    this.villageSafeHalf = Number(config.villageSafeHalf || 25.5);
    this.sleeping = Boolean(config.sleeping && !this.isBoss && !this.isGiant && !this.isOutskirtMob);
    this.state = this.sleeping ? AI_STATE.SLEEP : AI_STATE.IDLE;
    this.stateTimer = 0.5 + Math.random() * 1.2;
    this.attackCooldown = Math.random() * 0.6;
    this.skillCooldown = 2.5 + Math.random() * 2.5;
    this.awarenessTimer = 0;
    this.isAlerted = false;
    this._returningHome = false;
    this._leashTimer = 0;
    this._lastAlertAt = -99;
    this._wakeStamp = 0;
    this._lastHitFlashAt = 0;
    this.stunTimer = 0;
    // Active status effects keyed by STATUS id: { id, remaining, duration, tick, tickTimer, dotPerTick, slowPct, root, dmgTakenPct, color }
    this.statuses = {};
    this._hasStatuses = false;
    this._lodAcc = 0;
    this._animAcc = 0;
    this._deferredMeshCfg = null;
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
    this.uniqueId = config.uniqueId || null;
    this.summonBands = Array.isArray(config.summonBands)
      ? [...config.summonBands]
      : (this.isBoss ? [0.8, 0.58, 0.36] : []);
    this.triggeredSummonBands = new Set();
    this.summonPool = Array.isArray(config.summonPool) ? [...config.summonPool] : null;
    this.summonWaveSize = Number(config.summonCount || 3);
    this.summonedByBossId = config.summonedByBossId || null;
    this.appearMsg = config.appearMsg || null;
    this.defeatMsg = config.defeatMsg || null;
    this.reflectShieldTimer = 0;
    this.activeAttackAnim = 'ATTACK1';

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
      if (!this.mesh.userData?.isDeferredStub) {
        attachHealthBarAndTelegraph(this);
      }
    }
  }

  syncHealthBar(camera = null) {
    if (!this.healthBarGroup || !this.healthFillMesh) return;
    if (this.dead) {
      this.healthBarGroup.visible = false;
      return;
    }
    if (this.hp < this.maxHp || this.isBoss || this.isGiant || this.isElite) {
      this.healthBarGroup.visible = true;
    }
    if (!this.healthBarGroup.visible) return;
    const pct = Math.max(0, Math.min(1, this.hp / Math.max(1, this.maxHp)));
    const bw = this.healthFillMesh.userData?.barWidth || 1;
    this.healthFillMesh.scale.x = Math.max(0.001, pct) * bw;
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
    this._pendingStrikes = [];
    this.currentFloor = 0;
    this.floorClearedNotified = false;
    this.elapsedTime = 0;
    this._lastTime = 0;
    this._lastPlayerPos = null;
    this.lastCallbacks = {};

    this._frustum = new THREE.Frustum();
    this._projScreenMat = new THREE.Matrix4();
    this._cullSphere = new THREE.Sphere();
    this._spatialCells = new Map();
    this._cellPool = [];
    this._cellPoolUsed = 0;
    this._validSkillsScratch = [];
    this._projectilePool = [];
    this._projectileMeshPool = new Map();
    this._wakeFrameId = 1;
    this._killStagger = 0;
    this._frameMobShockwaves = 0;
    this._frameMobSparks = 0;
    this._anyStatusRingVisible = false;
    this._aliveNonBossDirty = true;
    this._aliveNonBossCached = null;
    this._aliveNonBossDungeonRef = null;
    this.campKills = new Map();
    this.activeOutskirtCamps = [];
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
    for (const e of this.enemies) {
      e._deferredMeshCfg = null;
      this.clearStatuses(e);
    }
    while (this.rootGroup.children.length > 0) {
      const child = this.rootGroup.children.pop();
      this.rootGroup.remove(child);
      disposeObject3D(child);
    }
    this._clearAllEnemyProjectiles();
    this.enemies = [];
    this.projectiles = [];
    this._pendingStrikes = [];
    this._spatialCells.clear();
    this.campKills.clear();
    this._aliveNonBossDirty = true;
    this._aliveNonBossCached = null;
  }

  suspendFloorEnemies() {
    this._clearAllEnemyProjectiles();
    const saved = {
      enemies: [...this.enemies],
      rootChildren: [...this.rootGroup.children],
      floorClearedNotified: Boolean(this.floorClearedNotified)
    };
    while (this.rootGroup.children.length > 0) {
      const child = this.rootGroup.children.pop();
      this.rootGroup.remove(child);
    }
    this.enemies = [];
    this.projectiles = [];
    this._spatialCells.clear();
    this._aliveNonBossDirty = true;
    this._aliveNonBossCached = null;
    return saved;
  }

  restoreFloorEnemies(saved) {
    this.clearEnemies();
    if (!saved) return;
    for (const child of saved.rootChildren || []) {
      this.rootGroup.add(child);
    }
    this.enemies = [...(saved.enemies || [])];
    this.floorClearedNotified = Boolean(saved.floorClearedNotified);
    this._aliveNonBossDirty = true;
  }

  _clearAllEnemyProjectiles() {
    if (Array.isArray(this.projectiles)) {
      for (const p of this.projectiles) {
        if (p?.mesh) {
          if (typeof p.mesh.userData?.dispose === 'function') {
            p.mesh.userData.dispose();
          }
          if (p.mesh.parent) {
            p.mesh.parent.remove(p.mesh);
          } else if (this.scene) {
            this.scene.remove(p.mesh);
          }
        }
      }
    }
    if (this._projectileMeshPool) {
      for (const bucket of this._projectileMeshPool.values()) {
        for (const mesh of bucket) {
          if (!mesh) continue;
          if (typeof mesh.userData?.dispose === 'function') mesh.userData.dispose();
          if (mesh.parent) mesh.parent.remove(mesh);
          else if (this.scene) this.scene.remove(mesh);
        }
      }
      this._projectileMeshPool.clear();
    }
    if (this._projectilePool) this._projectilePool.length = 0;
    this.projectiles = [];
  }

  _removeEnemyProjectile(index) {
    if (!this.projectiles || index < 0 || index >= this.projectiles.length) return;
    const p = this.projectiles[index];
    const last = this.projectiles.length - 1;
    if (index !== last) this.projectiles[index] = this.projectiles[last];
    this.projectiles.pop();

    const mesh = p?.mesh;
    if (mesh) {
      let bucket = p.meshKey ? this._projectileMeshPool.get(p.meshKey) : null;
      if (!bucket && p.meshKey) {
        bucket = [];
        this._projectileMeshPool.set(p.meshKey, bucket);
      }
      if (bucket && bucket.length < 24) {
        mesh.visible = false;
        bucket.push(mesh);
      } else {
        if (typeof mesh.userData?.dispose === 'function') {
          mesh.userData.dispose();
        }
        if (mesh.parent) {
          mesh.parent.remove(mesh);
        } else if (this.scene) {
          this.scene.remove(mesh);
        }
      }
    }
    if (p) {
      p.mesh = null;
      p.sourceEnemy = null;
      if (this._projectilePool.length < 64) {
        this._projectilePool.push(p);
      }
    }
  }

  _spawnEnemyProjectile(enemy, targetX, targetZ, kind = 'arrow', damage = 10, element = 'physical', callbacks = {}, opts = {}) {
    const originY = 1.15;
    const dx = targetX - enemy.x;
    const dz = targetZ - enemy.z;
    const len = Math.hypot(dx, dz) || 1;
    const dirX = dx / len;
    const dirZ = dz / len;

    let mesh = null;
    const color = opts.color || (kind === 'arrow' ? 0xca8a04 : 0xef4444);
    const meshKey = `${kind}_${color}`;
    if (this.scene && typeof this.models3d?.createProjectileMesh === 'function') {
      const bucket = this._projectileMeshPool.get(meshKey);
      if (bucket && bucket.length > 0) {
        mesh = bucket.pop();
        mesh.visible = true;
        if (mesh.userData?.glow) mesh.userData.glow.scale.setScalar(1);
        if (mesh.userData?.core) mesh.userData.core.rotation.x = 0;
      } else {
        mesh = this.models3d.createProjectileMesh(kind, color, kind === 'arrow' ? 1.0 : 0.85);
      }
      mesh.position.set(enemy.x, originY, enemy.z);
      mesh.rotation.y = Math.atan2(dirX, dirZ);
      if (mesh.parent !== this.scene) {
        this.scene.add(mesh);
      }
    }

    const proj = this._projectilePool.length > 0 ? this._projectilePool.pop() : {};
    proj.id = `eproj_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    proj.kind = kind;
    proj.meshKey = meshKey;
    proj.x = enemy.x;
    proj.y = originY;
    proj.z = enemy.z;
    proj.dirX = dirX;
    proj.dirZ = dirZ;
    proj.speed = opts.speed || (kind === 'arrow' ? 17.5 : 14.5);
    proj.damage = Math.round(damage);
    proj.element = element;
    proj.range = Math.max(18.5, enemy.attackRange ? enemy.attackRange * 1.65 : 18.5);
    proj.traveled = 0;
    proj.radius = kind === 'arrow' ? 0.38 : 0.48;
    proj.mesh = mesh;
    proj.sourceEnemy = enemy;
    proj.isPoison = Boolean(opts.isPoison || element === 'poison');

    if (!Array.isArray(this.projectiles)) this.projectiles = [];
    this.projectiles.push(proj);
    return proj;
  }

  _updateEnemyProjectiles(dt, player, world, callbacks) {
    if (!this.projectiles || this.projectiles.length === 0) return;
    const px = player?.position?.x ?? player?.x ?? 0;
    const pz = player?.position?.z ?? player?.z ?? 0;
    const ctxDead = Boolean(this.gameContext?.player?.dead || this.gameContext?.gameState?.hero?.dead || this.gameContext?.gameState?.isDead);
    const hasNumericHp = Number.isFinite(player?.hp) || Number.isFinite(player?.stats?.hp) || Number.isFinite(player?.hero?.hp);
    const playerAliveByArg = hasNumericHp
      ? (player?.hp > 0 || player?.stats?.hp > 0 || player?.hero?.hp > 0)
      : true;
    const isPlayerAlive = !player?.dead && !ctxDead && (callbacks?.isPlayerAlive ?? playerAliveByArg);

    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      const prevX = p.x;
      const prevZ = p.z;
      const step = p.speed * dt;
      p.x += p.dirX * step;
      p.z += p.dirZ * step;
      p.traveled += step;

      if (p.mesh) {
        p.mesh.position.x = p.x;
        p.mesh.position.z = p.z;
      }

      // Swept segment-to-player collision so fast arrows never tunnel past the hero
      const vx = p.x - prevX;
      const vz = p.z - prevZ;
      const vLenSq = vx * vx + vz * vz;
      const tSeg = vLenSq > 1e-6 ? Math.max(0, Math.min(1, ((px - prevX) * vx + (pz - prevZ) * vz) / vLenSq)) : 0;
      const closestX = prevX + vx * tSeg;
      const closestZ = prevZ + vz * tSeg;
      const distToPlayer = Math.hypot(closestX - px, closestZ - pz);
      if (distToPlayer <= (p.radius + 0.55) && isPlayerAlive) {
        this._dealDamageToPlayer(p.sourceEnemy, p.damage, p.element, callbacks);
        if (p.isPoison && typeof callbacks?.applyPlayerStatus === 'function') {
          callbacks.applyPlayerStatus('poison', 4.0, Math.round(p.damage * 0.2));
        }
        if (this.renderer?.spawnSkillEffect) {
          this.renderer.spawnSkillEffect('spark', { x: p.x, y: 1.0, z: p.z }, 0, {
            color: p.isPoison ? 0x22c55e : 0xfbbf24
          });
        }
        this._removeEnemyProjectile(i);
        continue;
      }

      // Wall collision (allow initial 0.65m bow clearance) or range exceeded
      const hitWall = p.traveled > 0.65 && world && typeof world.isWalkable === 'function' && !world.isWalkable(p.x, p.z, 0.08);
      if (p.traveled >= p.range || hitWall) {
        if (hitWall && this.renderer?.spawnSkillEffect) {
          this.renderer.spawnSkillEffect('spark', { x: p.x, y: 1.0, z: p.z }, 0, { color: 0x94a3b8 });
        }
        this._removeEnemyProjectile(i);
        continue;
      }
    }
  }

  /**
   * Spawn monsters, elites, and bosses for the given dungeon floor (or Oakhaven Outskirts).
   */
  spawnFloorEnemies(floorData, floorNum = 1, sceneOverride = null, models3dOverride = null, extractedDataOverride = null) {
    if (models3dOverride) this.models3d = models3dOverride;
    if (extractedDataOverride) this.data = extractedDataOverride;
    this._ensureSceneAttached(sceneOverride);
    this.clearEnemies();

    const fNum = Number(floorNum ?? floorData?.floor ?? 1);
    this.currentFloor = fNum;
    this.floorClearedNotified = false;
    this.activeOutskirtCamps = Array.isArray(floorData?.outskirtCamps) ? floorData.outskirtCamps : [];

    if (fNum <= 0 || floorData?.zone === 'village') {
      if (this.activeOutskirtCamps.length > 0) {
        this.spawnVillageOutskirts(floorData);
      }
      return this.enemies;
    }

    const rooms = floorData?.rooms || [];
    const pool = this._getMonsterPoolForFloor(fNum, floorData);
    const maxGiantsOnFloor = fNum >= 8 ? 2 : 1;
    let totalGiantsOnFloor = 0;
    let poolCursor = 0;
    const spawnedTypes = new Set();

    const nextPoolType = (preferredList = null) => {
      const list = Array.isArray(preferredList) && preferredList.length > 0 ? preferredList : pool;
      // Prioritize any species in the dungeon pool that has not spawned yet on this floor
      const unspawned = list.find((t) => !spawnedTypes.has(t));
      if (unspawned) {
        spawnedTypes.add(unspawned);
        return unspawned;
      }
      const chosen = list[poolCursor % list.length];
      poolCursor++;
      spawnedTypes.add(chosen);
      return chosen;
    };

    rooms.forEach((room, idx) => {
      if (idx === 0 || room.type === 'start' || room.type === 'village') return;

      if (room.type === 'boss') {
        this._spawnBossInRoom(room, fNum);
        const guardCount = fNum >= 9 ? 5 : fNum >= 5 ? 4 : 3;
        for (let g = 0; g < guardCount; g++) {
          const guardAngle = (g / guardCount) * Math.PI * 2;
          const gx = room.centerX + Math.cos(guardAngle) * 3.8;
          const gz = room.centerZ + Math.sin(guardAngle) * 3.8;
          const guardType = nextPoolType(pool);
          this.spawnMonster({
            type: guardType,
            floor: fNum,
            x: gx,
            z: gz,
            isElite: g === 0,
            roomId: room.id,
            inBossRoom: true
          });
        }
        return;
      }

      const eligibleForGiant = idx > 1 && room.type !== 'exit' && room.type !== 'boss' && totalGiantsOnFloor < maxGiantsOnFloor;
      const shouldSpawnGiant = eligibleForGiant && (room.type === 'treasure' ? Math.random() < 0.45 : Math.random() < 0.25);

      if (Array.isArray(room.encounterPlan) && room.encounterPlan.length > 0) {
        const rangedPool = pool.filter((t) => MONSTER_CATALOG[t]?.isRanged);
        const meleePool = pool
          .filter((t) => !MONSTER_CATALOG[t]?.isRanged)
          .sort((a, b) => (MONSTER_CATALOG[b]?.baseHp || 0) - (MONSTER_CATALOG[a]?.baseHp || 0));
        let giantSpawnedInRoom = false;

        room.encounterPlan.forEach((slot, i) => {
          let mType;
          const unspawnedAny = pool.find((t) => !spawnedTypes.has(t));
          if (unspawnedAny && i % 2 === 0) {
            mType = nextPoolType(pool);
          } else if ((slot.role === 'ranged' || slot.role === 'ritualist') && rangedPool.length > 0) {
            mType = nextPoolType(rangedPool);
          } else if (slot.role === 'vanguard' && meleePool.length > 0) {
            mType = nextPoolType(meleePool);
          } else {
            mType = nextPoolType(pool);
          }

          const wantsGiant = shouldSpawnGiant && !giantSpawnedInRoom && (slot.role === 'captain' || i === room.encounterPlan.length - 1);
          if (wantsGiant) {
            giantSpawnedInRoom = true;
            totalGiantsOnFloor++;
          }

          const isElite = !wantsGiant && Boolean(
            slot.isElite ||
            (room.type === 'exit' && i === 0) ||
            (room.type === 'treasure' && i === 1)
          );

          this.spawnMonster({
            type: mType,
            floor: fNum,
            x: slot.x,
            z: slot.z,
            isElite,
            isGiant: wantsGiant,
            packId: slot.packId || `pack_f${fNum}_r${idx}_p${Math.floor(i / 3)}`,
            sleeping: Boolean(slot.sleeping) && !wantsGiant && room.type !== 'exit',
            roomId: room.id,
            inBossRoom: false
          });
        });
        return;
      }

      const count = room.type === 'combat'
        ? Math.min(24, 8 + Math.floor(fNum * 1.1))
        : room.type === 'exit'
        ? Math.min(8, 3 + Math.floor(fNum * 0.45))
        : Math.min(6, 2 + Math.floor(fNum * 0.35));

      const packs = [];
      let rem = count;
      while (rem > 0) {
        if (rem <= 4) {
          packs.push(rem);
          rem = 0;
        } else if (rem === 5) {
          packs.push(3);
          packs.push(2);
          rem = 0;
        } else if (rem >= 7) {
          const sz = rem % 3 === 0 ? 3 : 4;
          packs.push(sz);
          rem -= sz;
        } else {
          packs.push(3);
          packs.push(3);
          rem = 0;
        }
      }

      const P = packs.length;
      const rw = room.w || 18;
      const rh = room.h || 18;
      const maxOffX = Math.max(1.8, (rw * 0.5) - 3.2);
      const maxOffZ = Math.max(1.8, (rh * 0.5) - 3.2);

      let mobIndex = 0;
      let giantSpawnedInRoom = false;

      for (let p = 0; p < P; p++) {
        const packSize = packs[p];
        const packAngle = (p / P) * Math.PI * 2 + (idx * 0.7);
        const distFrac = P === 1 ? 0.3 : 0.45 + (p % 2) * 0.35;
        const pcx = room.centerX + Math.cos(packAngle) * (maxOffX * distFrac);
        const pcz = room.centerZ + Math.sin(packAngle) * (maxOffZ * distFrac);
        const packId = `pack_f${fNum}_r${idx}_p${p}`;
        const packSleeping = room.type !== 'exit' && ((idx % 2 === 1 && p % 2 === 0) || (idx % 2 === 0 && p === 1));

        for (let m = 0; m < packSize; m++) {
          const mType = nextPoolType(pool);
          const mAngle = (m / packSize) * Math.PI * 2 + (p * 0.85);
          const mDist = packSleeping ? 0.9 + (m % 2) * 0.4 : 1.2 + (m % 2) * 0.7;
          const mx = pcx + Math.cos(mAngle) * mDist;
          const mz = pcz + Math.sin(mAngle) * mDist;

          const isGiant = shouldSpawnGiant && !giantSpawnedInRoom && p === 0 && m === 0;
          if (isGiant) {
            giantSpawnedInRoom = true;
            totalGiantsOnFloor++;
          }

          const isElite = !isGiant && ((room.type === 'exit' && mobIndex === 0) ||
                          (room.type === 'treasure' && mobIndex === 1) ||
                          (p === 0 && m === 0 && Math.random() < 0.22) ||
                          (mobIndex === count - 1 && Math.random() < 0.15));

          this.spawnMonster({
            type: mType,
            floor: fNum,
            x: mx,
            z: mz,
            isElite,
            isGiant,
            packId,
            sleeping: packSleeping && !isGiant,
            roomId: room.id,
            inBossRoom: false
          });
          mobIndex++;
        }
      }
    });

    // Guarantee 100% representation of every authentic SRO species assigned to this floor
    const missingSpecies = pool.filter((t) => !spawnedTypes.has(t));
    if (missingSpecies.length > 0) {
      const targetRooms = rooms.filter((r, i) => i > 0 && r.type !== 'start' && r.type !== 'village' && r.type !== 'boss');
      const fallbackRooms = targetRooms.length > 0 ? targetRooms : rooms.filter((r, i) => i > 0 && r.type !== 'start');
      missingSpecies.forEach((mType, mIdx) => {
        if (fallbackRooms.length === 0) return;
        const room = fallbackRooms[mIdx % fallbackRooms.length];
        const ang = (mIdx * 2.39996) % (Math.PI * 2);
        const rad = Math.min(Math.max(1.5, ((Math.min(room.w || 16, room.h || 16)) * 0.24)), 3.2);
        const mx = room.centerX + Math.cos(ang) * rad;
        const mz = room.centerZ + Math.sin(ang) * rad;
        spawnedTypes.add(mType);
        this.spawnMonster({
          type: mType,
          floor: fNum,
          x: mx,
          z: mz,
          isElite: false,
          isGiant: false,
          packId: `pack_f${fNum}_extra_${room.id || 0}`,
          sleeping: false,
          roomId: room.id,
          inBossRoom: room.type === 'boss'
        });
      });
    }

    // Lock exit portal until all floor monsters are defeated
    const dungeon = this.gameContext?.dungeon || this.world?.dungeon || (typeof floorData?.setExitLockedByClear === 'function' ? floorData : null);
    if (!floorData?.isChallengeArena && this.getAliveFloorEnemies().length > 0) {
      dungeon?.setExitLockedByClear?.(true);
    }

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

  getCampKillProgress(campId) {
    const camp = this.activeOutskirtCamps?.find((c) => c.id === campId);
    const required = Math.max(1, Number(camp?.giantKillCount || OUTSKIRT_GIANT_KILL_THRESHOLD));
    const kills = this.campKills.get(campId) || 0;
    const hasActiveGiant = this.enemies.some((m) => !m.dead && m.isGiant && m.campId === campId);
    return { kills, required, hasActiveGiant };
  }

  /**
   * Spawn low-level respawning monster camps outside the Oakhaven city walls (Lv 1..10 training).
   */
  spawnVillageOutskirts(villageData) {
    const camps = Array.isArray(villageData?.outskirtCamps) ? villageData.outskirtCamps : [];
    this.activeOutskirtCamps = camps;
    const wallHalf = Number(villageData?.townWallHalf || 55) + 0.6;
    for (const camp of camps) {
      const spawns = Array.isArray(camp.spawns) ? camp.spawns : [];
      spawns.forEach((sp, idx) => {
        const mobLevel = Number(sp.level || camp.level || 1);
        this.spawnMonster({
          type: sp.type || 'mangyang',
          floor: 1,
          x: sp.x,
          z: sp.z,
          isElite: Boolean(sp.isElite),
          packId: camp.id,
          sleeping: false,
          customConfig: {
            level: mobLevel,
            isOutskirtMob: true,
            isVillageMob: true,
            campId: camp.id,
            campName: camp.name || camp.id,
            campLevel: mobLevel,
            respawnDelay: camp.respawnSeconds || 10,
            villageSafeHalf: wallHalf
          }
        });
      });
    }
    return this.enemies;
  }

  _canEmitAlert(e, time = this._lastTime) {
    if (!e || e.dead || e._returningHome || e.isAlerted) return false;
    if (
      e.state === AI_STATE.CHASE ||
      e.state === AI_STATE.TELEGRAPH ||
      e.state === AI_STATE.ATTACK ||
      e.state === AI_STATE.SKILL ||
      e.state === AI_STATE.STUN
    ) {
      return false;
    }
    return (time - (e._lastAlertAt ?? -99)) >= 8.0;
  }

  /**
   * Wake a sleeping monster and all packmates sharing its packId (or nearby sleeping monsters).
   * Returns the array of monsters that woke up on this call.
   */
  wakePack(enemyOrPackId, opts = {}) {
    const trigger = typeof enemyOrPackId === 'object' ? enemyOrPackId : null;
    const packId = typeof enemyOrPackId === 'string' ? enemyOrPackId : (trigger?.packId || null);
    const stamp = opts.aoeWakeId ?? this._wakeFrameId;
    if (trigger && trigger._wakeStamp === stamp) {
      return [];
    }
    if (trigger) trigger._wakeStamp = stamp;

    const time = this._lastTime;
    const allowTriggerAlert = opts.allowTriggerAlert !== false;
    const woken = [];
    let alertTarget = null;

    for (let i = 0; i < this.enemies.length; i++) {
      const m = this.enemies[i];
      if (m.dead) continue;
      if (m._returningHome && m !== trigger) continue;
      const inSamePack = packId && m.packId === packId;
      const nearbyTrigger = trigger && ((m.x - trigger.x) * (m.x - trigger.x) + (m.z - trigger.z) * (m.z - trigger.z)) <= 6.5 * 6.5;
      if (m === trigger || inSamePack || nearbyTrigger) {
        m._wakeStamp = stamp;
        const wasUnengaged = m.sleeping || m.state === AI_STATE.SLEEP || m.state === AI_STATE.IDLE || m.state === AI_STATE.PATROL;
        const wasAlerted = Boolean(m.isAlerted);
        if (wasUnengaged) {
          const wasSleeping = m.sleeping || m.state === AI_STATE.SLEEP;
          m.sleeping = false;
          m.isAlerted = true;
          m.awarenessTimer = 0;
          if (m.state !== AI_STATE.STUN && m.state !== AI_STATE.TELEGRAPH && m.state !== AI_STATE.ATTACK && m.state !== AI_STATE.SKILL) {
            m.state = AI_STATE.CHASE;
          }
          if (wasSleeping || !wasAlerted) {
            woken.push(m);
          }
          if (!wasAlerted && (time - (m._lastAlertAt ?? -99)) >= 8.0) {
            if (m === trigger) {
              if (allowTriggerAlert) alertTarget = m;
            } else if (!alertTarget) {
              alertTarget = m;
            }
          }
        }
      }
    }

    if (alertTarget && woken.length > 0 && this.renderer?.spawnFloatingText) {
      alertTarget._lastAlertAt = time;
      this.renderer.spawnFloatingText({ x: alertTarget.x, y: 1.1, z: alertTarget.z }, '!', { color: '#facc15', isCrit: true });
    }
    return woken;
  }

  _hydrateDeferredEnemyMesh(enemy) {
    const cfg = enemy?._deferredMeshCfg;
    if (!cfg) return;
    enemy._deferredMeshCfg = null;
    const stub = enemy.mesh;
    if (stub && stub.parent) {
      stub.parent.remove(stub);
    }
    const mesh = cfg.meshBuilder(cfg.meshType, cfg.opts);
    mesh.position.set(enemy.x, 0, enemy.z);
    mesh.rotation.y = enemy.rotation;
    this.rootGroup.add(mesh);
    enemy.mesh = mesh;
    attachHealthBarAndTelegraph(enemy);
    if (enemy._hasStatuses) {
      this._refreshStatusRing(enemy);
    }
  }

  _getMonsterPoolForFloor(floorNum, floorData = null) {
    if (Array.isArray(floorData?.monsterTypes) && floorData.monsterTypes.length > 0) {
      return floorData.monsterTypes;
    }
    if (FLOOR_POOLS && FLOOR_POOLS[floorNum]) {
      return FLOOR_POOLS[floorNum];
    }
    if (floorNum <= 3) return FLOOR_POOLS[1];
    if (floorNum <= 6) return FLOOR_POOLS[4];
    if (floorNum <= 9) return FLOOR_POOLS[7];
    if (floorNum <= 12) return FLOOR_POOLS[10];
    return FLOOR_POOLS[13];
  }

  spawnMonster({
    type = 'goblin',
    floor = 1,
    x = 0,
    z = 0,
    isElite = false,
    isBoss = false,
    isGiant = false,
    packId = null,
    sleeping = false,
    customConfig = null,
    roomId = null,
    inBossRoom = false,
    isOutskirtMob = false,
    isVillageMob = false,
    campId = null,
    campName = null,
    campLevel = null,
    aggroRange = null,
    spawnOnce = false,
    respawnDelay = null,
    villageSafeHalf = null
  }) {
    const base = MONSTER_CATALOG[type] || MONSTER_CATALOG.goblin;
    const resolvedOutskirt = Boolean(customConfig?.isOutskirtMob ?? isOutskirtMob);
    const resolvedVillage = Boolean(customConfig?.isVillageMob ?? isVillageMob ?? resolvedOutskirt);
    const resolvedCampId = customConfig?.campId ?? campId ?? null;
    const resolvedCampName = customConfig?.campName ?? campName ?? null;
    const resolvedCampLevel = customConfig?.campLevel ?? campLevel ?? null;
    const resolvedSpawnOnce = Boolean(customConfig?.spawnOnce ?? spawnOnce);
    const resolvedRespawnDelay = customConfig?.respawnDelay ?? respawnDelay ?? 12;
    const resolvedVillageSafeHalf = customConfig?.villageSafeHalf ?? villageSafeHalf ?? 25.5;
    // rpg-systems: monster level is no longer the raw floor number; it comes from floorMonsterLevel(floor)
    // (floor 15 -> level 52) so every gear tier is reachable. customConfig.level overrides it.
    const level = Math.max(1, Number(customConfig?.level ?? resolvedCampLevel) || (floor > 0 ? floorMonsterLevel(floor) : 1));

    // Level scaling curve matching ASJ progression
    const hpScale = 1 + (level - 1) * 0.34 + Math.pow(level - 1, 1.35) * 0.08;
    const atkScale = 1 + (level - 1) * 0.24;
    const defScale = 1 + (level - 1) * 0.22;
    const expScale = 1 + (level - 1) * 0.28;

    let mod = null;
    if (isElite && !isBoss && !isGiant) {
      mod = ELITE_MODIFIERS[Math.floor(Math.random() * ELITE_MODIFIERS.length)];
    }

    const name = customConfig?.name || (isGiant ? `Giant ${base.name}` : mod ? `${mod.prefix} ${base.name}` : base.name);
    const maxHp = Math.round(base.baseHp * hpScale * (isGiant ? 6.5 : (mod?.hpMult || 1)) * (customConfig?.hpMult || 1));
    const atk = Math.round(base.baseAtk * atkScale * (isGiant ? 1.85 : (mod?.atkMult || 1)) * (customConfig?.atkMult || 1));
    const def = Math.round(base.baseDef * defScale * (isGiant ? 1.55 : (mod?.defMult || 1)) * (customConfig?.defMult || 1));
    const exp = Math.round(base.baseExp * expScale * (isGiant ? 5.0 : (mod?.expMult || 1)) * (isBoss ? 5.0 : 1));
    const gold = Math.round(base.baseGold * (1 + level * 0.25) * (isBoss ? 6 : isGiant ? 4.5 : isElite ? 2.5 : 1));

    const color = customConfig?.color || (isGiant ? 0xf59e0b : (mod?.color || base.color));
    const baseScaleVal = customConfig?.scale || base.scale || 1.0;
    const scale = isBoss ? baseScaleVal : isGiant ? baseScaleVal * 1.75 : (baseScaleVal * (isElite ? 1.22 : 1.0));
    const element = customConfig?.element || mod?.element || base.element;

    const meshBuilder = isBoss
      ? (this.models3d?.createBossMesh || createBossMesh)
      : (this.models3d?.createMonsterMesh || createMonsterMesh);

    const glbUrl = customConfig?.glbPath ?? base.glbPath ?? null;
    const targetSpan = customConfig?.targetSpan ?? base.targetSpan ?? null;
    const targetHeight = targetSpan ? null : (customConfig?.targetHeight || (base.targetHeight ? base.targetHeight * (isGiant ? 1.6 : 1.0) : (isBoss ? 2.2 : isGiant ? 2.3 : 1.55)));
    const meshType = base.meshType || type;
    const meshOpts = {
      isElite,
      isBoss,
      isGiant,
      color,
      scale,
      tier: Math.ceil(level / 3),
      name,
      uniqueId: customConfig?.id || base.uniquePrefab || type,
      uniquePrefab: customConfig?.uniquePrefab || base.uniquePrefab || null,
      mountGlbPath: customConfig?.mountGlbPath || null,
      mountTargetHeight: customConfig?.mountTargetHeight || null,
      glbPath: glbUrl,
      targetHeight,
      targetSpan
    };

    const isOutskirt = resolvedOutskirt;
    const distFromOriginSq = x * x + (z - 7.5) * (z - 7.5);
    let nearLastPlayer = false;
    if (this._lastPlayerPos) {
      const pdx = x - this._lastPlayerPos.x;
      const pdz = z - this._lastPlayerPos.z;
      nearLastPlayer = (pdx * pdx + pdz * pdz) <= 48 * 48;
    }
    const deferMesh = typeof window !== 'undefined' && isOutskirt && !isBoss && !nearLastPlayer && distFromOriginSq > 48 * 48;

    let mesh;
    if (deferMesh) {
      mesh = new THREE.Group();
      mesh.name = `DeferredMonster_${type}`;
      mesh.visible = false;
      mesh.userData.isDeferredStub = true;
    } else {
      mesh = meshBuilder(meshType, meshOpts);
    }

    this.rootGroup.add(mesh);

    const enemy = new EnemyAI({
      id: customConfig?.id || `${type}_f${level}_${this.enemies.length + 1}`,
      type,
      name,
      title: customConfig?.title !== undefined ? customConfig.title : (isGiant ? 'Giant Miniboss' : isElite ? 'Elite Monster' : ''),
      floor: isOutskirt ? 0 : Math.max(1, Number(floor) || 1), // 0 for outskirt mobs so F1+ dungeon quests stay clean
      level,
      isElite,
      isBoss,
      isGiant,
      modifier: mod,
      maxHp,
      atk,
      def,
      exp,
      gold,
      moveSpeed: base.moveSpeed * (isGiant ? 1.08 : (mod?.speedMult || 1)),
      attackRange: base.isRanged
        ? Math.min(isBoss ? 14.5 : 13.5, Math.max(9.6, base.attackRange * (isBoss ? 1.35 : isGiant ? 1.22 : isElite ? 1.12 : 1)))
        : base.attackRange * (isBoss ? 1.45 : isGiant ? 1.35 : isElite ? 1.15 : 1),
      aggroRange: Number(customConfig?.aggroRange ?? aggroRange) || (isBoss ? 17.5 : isGiant ? 14.0 : (base.isRanged ? Math.max(15.0, base.aggroRange) : base.aggroRange)),
      attackCooldown: base.attackCooldown,
      telegraphTime: base.telegraphTime,
      element,
      isRanged: base.isRanged,
      skills: customConfig?.skills || (base.skills && base.skills.length > 0 ? [...base.skills] : (isGiant ? ['earth_stomp', 'whirlwind_strike'] : isElite ? ['whirlwind_strike'] : ['slash'])),
      summonType: customConfig?.summonType || 'goblin',
      summonPool: customConfig?.summonPool || null,
      summonBands: customConfig?.summonBands || (isBoss ? [0.8, 0.58, 0.36] : []),
      summonCount: customConfig?.summonCount || 3,
      summonedByBossId: customConfig?.summonedByBossId || null,
      uniqueId: customConfig?.id || base.uniquePrefab || null,
      appearMsg: customConfig?.appearMsg || null,
      defeatMsg: customConfig?.defeatMsg || null,
      packId: packId || customConfig?.packId || null,
      sleeping: Boolean(sleeping || customConfig?.sleeping),
      roomId: customConfig?.roomId ?? roomId,
      inBossRoom: Boolean(customConfig?.inBossRoom ?? inBossRoom),
      isOutskirtMob: isOutskirt,
      isVillageMob: resolvedVillage,
      isChallengeMob: Boolean(customConfig?.isChallengeMob),
      campId: resolvedCampId,
      campName: resolvedCampName,
      campLevel: resolvedCampLevel,
      spawnOnce: resolvedSpawnOnce,
      respawnDelay: resolvedRespawnDelay,
      villageSafeHalf: resolvedVillageSafeHalf,
      x,
      z,
      mesh
    });
    enemy.subtitle = customConfig?.subtitle || '';
    enemy.roomId = customConfig?.roomId ?? roomId;
    enemy.inBossRoom = Boolean(customConfig?.inBossRoom ?? inBossRoom);
    if (deferMesh) {
      enemy._deferredMeshCfg = { meshBuilder, meshType, opts: meshOpts };
    }

    this.enemies.push(enemy);
    this._aliveNonBossDirty = true;
    return enemy;
  }

  _spawnBossInRoom(bossRoom, floorNum) {
    const templateKey = BOSS_CATALOG[floorNum] ? floorNum : ([3, 6, 9, 12, 15, 16].find((k) => k >= floorNum) || 16);
    const bossCfg = BOSS_CATALOG[floorNum] || BOSS_CATALOG[templateKey] || BOSS_CATALOG[3];

    const boss = this.spawnMonster({
      type: bossCfg.type,
      floor: floorNum,
      x: bossRoom.centerX,
      z: bossRoom.centerZ,
      isBoss: true,
      roomId: bossRoom.id,
      inBossRoom: true,
      customConfig: bossCfg
    });
    if (boss && this.gameContext?.hud) {
      const msg = bossCfg.appearMsg || `⚠️ Unique ${boss.name} has appeared on Floor ${floorNum}!`;
      this.gameContext.hud.toast?.(msg, 'warning');
      this.gameContext.hud.showToast?.(msg, 'warning');
    }
    return boss;
  }

  getAliveEnemies() {
    return this.enemies.filter((e) => !e.dead);
  }

  getAliveFloorEnemies() {
    return this.enemies.filter((e) => !e.dead && !e.isOutskirtMob && !e.isChallengeMob);
  }

  getAliveNonBossCount(dungeon = null) {
    const d = dungeon || this.gameContext?.dungeon || this.world?.dungeon || null;
    if (!this._aliveNonBossDirty && this._aliveNonBossDungeonRef === d && this._aliveNonBossCached !== null) {
      return this._aliveNonBossCached;
    }
    const bossRoom = d?.bossRoom;
    let count = 0;
    for (let i = 0; i < this.enemies.length; i++) {
      const e = this.enemies[i];
      if (e.dead || e.isBoss || e.summonedByBossId || e.isOutskirtMob || e.isChallengeMob) continue;
      if (bossRoom) {
        if (e.roomId !== undefined && e.roomId !== null && e.roomId === bossRoom.id) continue;
        if (e.inBossRoom) continue;
        const dx = e.x - bossRoom.centerX;
        const dz = e.z - bossRoom.centerZ;
        const halfMin = Math.min(bossRoom.w, bossRoom.h) * 0.48;
        if (dx * dx + dz * dz < halfMin * halfMin) continue;
      }
      count++;
    }
    this._aliveNonBossCached = count;
    this._aliveNonBossDungeonRef = d;
    this._aliveNonBossDirty = false;
    return count;
  }

  get aliveNonBosses() {
    return this.getAliveNonBossCount();
  }

  /**
   * Allocation-free spatial iteration over alive enemies within range of (x, z).
   * Supports (x, z, range, fn) or ({ x, z }, range, fn). Return false from fn to stop early.
   */
  forEachEnemyInRange(posOrX, zOrRadius = 2.5, rangeOrFn = 2.5, maybeFn = null) {
    let x = 0;
    let z = 0;
    let range = 2.5;
    let fn = null;
    if (typeof posOrX === 'object' && posOrX !== null) {
      x = Number(posOrX.x || 0);
      z = Number(posOrX.z || 0);
      range = Number(zOrRadius || 2.5);
      fn = typeof rangeOrFn === 'function' ? rangeOrFn : maybeFn;
    } else {
      x = Number(posOrX || 0);
      z = Number(zOrRadius || 0);
      range = Number(rangeOrFn || 2.5);
      fn = maybeFn;
    }
    if (typeof fn !== 'function') return;
    for (let i = 0; i < this.enemies.length; i++) {
      const e = this.enemies[i];
      if (e.dead) continue;
      const dx = e.x - x;
      const dz = e.z - z;
      const maxR = range + e.radius;
      if (dx * dx + dz * dz <= maxR * maxR) {
        if (fn(e) === false) break;
      }
    }
  }

  /**
   * Allocation-free spatial iteration over alive enemies inside a melee/skill arc.
   * Return false from fn to stop early.
   */
  forEachEnemyInArc(originOrX, dirOrZ, rotOrRange = 0, rangeOrArc = 2.5, maybeArc = Math.PI, maybeFn = null) {
    let ox = 0;
    let oz = 0;
    let forwardX = 0;
    let forwardZ = 1;
    let range = 2.5;
    let arcAngle = Math.PI;
    let fn = null;

    if (typeof originOrX === 'object' && originOrX !== null) {
      ox = Number(originOrX.x || 0);
      oz = Number(originOrX.z || 0);
      range = Number(rotOrRange || 2.5);
      arcAngle = Number(rangeOrArc || Math.PI);
      fn = typeof maybeArc === 'function' ? maybeArc : maybeFn;
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
      fn = maybeFn;
    }
    if (typeof fn !== 'function') return;

    const halfCos = Math.cos(arcAngle * 0.5);
    for (let i = 0; i < this.enemies.length; i++) {
      const e = this.enemies[i];
      if (e.dead) continue;
      const dx = e.x - ox;
      const dz = e.z - oz;
      const maxR = range + e.radius;
      const dSq = dx * dx + dz * dz;
      if (dSq > maxR * maxR) continue;
      const nearR = 0.75 + e.radius * 0.5;
      if (dSq < nearR * nearR) {
        if (fn(e) === false) break;
        continue;
      }
      const dist = Math.sqrt(dSq);
      if ((dx / dist) * forwardX + (dz / dist) * forwardZ >= halfCos) {
        if (fn(e) === false) break;
      }
    }
  }

  /** Allocation-free scan for the active alive Nemesis enemy. */
  getActiveNemesis() {
    for (let i = 0; i < this.enemies.length; i++) {
      const e = this.enemies[i];
      if (e.isNemesis && !e.dead) return e;
    }
    return null;
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
    // Unique Ice Mirror Barrier reflection (Isyutaru): reduces hit & chills attacker
    if (enemy.reflectShieldTimer > 0 && !options.isDot) {
      rawDamage *= 0.65;
      const ctxPlayer = this.gameContext?.player;
      const px = Number(ctxPlayer?.position?.x ?? ctxPlayer?.x ?? 0);
      const pz = Number(ctxPlayer?.position?.z ?? ctxPlayer?.z ?? 0);
      const distP = Math.hypot(px - enemy.x, pz - enemy.z);
      if (ctxPlayer && distP <= 4.2 && !enemy._reflectHitThisTick) {
        enemy._reflectHitThisTick = true;
        setTimeout(() => { enemy._reflectHitThisTick = false; }, 350);
        const reflectDmg = Math.max(4, Math.round(enemy.atk * 0.25));
        this._dealDamageToPlayer(enemy, reflectDmg, 'ice', this.lastCallbacks);
        this.lastCallbacks?.applyPlayerStatus?.('chill', 2.2, 30);
        this.renderer?.spawnHitSparks?.(enemy.position, 0x7dd3fc, 8);
      }
    }

    if (enemy._deferredMeshCfg) {
      this._hydrateDeferredEnemyMesh(enemy);
    }
    // Shock: +dmgTakenPct% damage taken (callers that already scaled pass statusScaled: true)
    const takenMult = options.statusScaled ? 1 : this.getDamageTakenMult(enemy);
    const dmg = Math.max(1, Math.round(rawDamage * takenMult));
    enemy.hp = Math.max(0, enemy.hp - dmg);
    if (!options.isDot && enemy.mesh?.userData?.triggerHitFlash) {
      const nowMs = (typeof performance !== 'undefined' && typeof performance.now === 'function')
        ? performance.now()
        : Date.now();
      if ((nowMs - (enemy._lastHitFlashAt || 0)) >= 70) {
        enemy._lastHitFlashAt = nowMs;
        enemy.mesh.userData.triggerHitFlash(0.15);
      }
    }

    const wasUnengaged = enemy.sleeping || enemy.state === AI_STATE.SLEEP || enemy.state === AI_STATE.IDLE || enemy.state === AI_STATE.PATROL;
    const wasAlertedBefore = Boolean(enemy.isAlerted);
    if (wasUnengaged && enemy.hp > 0) {
      enemy._returningHome = false;
      this.wakePack(enemy, { allowTriggerAlert: !wasAlertedBefore });
    }
    enemy.sleeping = false;
    enemy.isAlerted = true;
    enemy.awarenessTimer = 0;
    if (wasUnengaged && enemy.hp > 0 && enemy.state !== AI_STATE.STUN && enemy.state !== AI_STATE.TELEGRAPH && enemy.state !== AI_STATE.ATTACK && enemy.state !== AI_STATE.SKILL) {
      enemy.state = AI_STATE.CHASE;
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
      this._checkBossSummonBands(enemy, options.world || this.gameContext?.dungeon || this.gameContext?.world);
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
    if (boss.mesh?.userData) {
      boss.mesh.userData.phaseLevel = newPhase;
      boss.mesh.userData.attackVariant = 'ATTACK3';
    }

    if (this.renderer?.spawnSkillEffect) {
      this.renderer.spawnSkillEffect('shockwave', boss.position, 0, {
        color: 0xef4444,
        radius: 4.5
      });
      this.renderer.shake?.(0.4, 0.3);
    }

    const msg = `${boss.name} enters Phase ${newPhase}!`;
    this.gameContext?.hud?.showBanner?.(`${boss.name} — PHASE ${newPhase}`, 'Unleashes Full Unique Power!');
    this.gameContext?.hud?.showToast?.(msg, 'warning');
    this.gameContext?.hud?.toast?.(msg, 'kill');
  }

  _checkBossSummonBands(boss, world = null) {
    if (!boss || boss.dead || !boss.isBoss || !Array.isArray(boss.summonBands)) return 0;
    const hpRatio = boss.hp / Math.max(1, boss.maxHp);
    let spawnedTotal = 0;
    for (const band of boss.summonBands) {
      if (hpRatio <= band && !boss.triggeredSummonBands.has(band)) {
        boss.triggeredSummonBands.add(band);
        spawnedTotal += this._spawnUniqueSummonWave(boss, band, world);
      }
    }
    return spawnedTotal;
  }

  _spawnUniqueSummonWave(boss, band = 0.8, world = null) {
    if (!boss || boss.dead) return 0;
    const liveBossAdds = this.enemies.filter((e) => !e.dead && e.summonedByBossId === boss.id).length;
    const maxLiveAdds = 6;
    if (liveBossAdds >= maxLiveAdds) return 0;

    const count = Math.min(boss.summonWaveSize || 3, maxLiveAdds - liveBossAdds);
    const pool = (Array.isArray(boss.summonPool) && boss.summonPool.length > 0)
      ? boss.summonPool
      : [boss.summonType || 'goblin'];
    const arena = world?.bossArena || this.gameContext?.dungeon?.bossArena;
    let spawned = 0;

    for (let i = 0; i < count; i++) {
      const ang = (i / Math.max(1, count)) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
      let sx = boss.x + Math.cos(ang) * 2.8;
      let sz = boss.z + Math.sin(ang) * 2.8;
      if (arena?.center && Number.isFinite(arena.radius)) {
        const adx = sx - arena.center.x;
        const adz = sz - arena.center.z;
        const ad = Math.hypot(adx, adz);
        const maxR = Math.max(1.5, arena.radius - 1.1);
        if (ad > maxR && ad > 0.001) {
          sx = arena.center.x + (adx / ad) * maxR;
          sz = arena.center.z + (adz / ad) * maxR;
        }
      } else if (world?.isWalkable && !world.isWalkable(sx, sz, 0.5)) {
        sx = boss.x;
        sz = boss.z;
      }

      const guardType = pool[i % pool.length];
      const add = this.spawnMonster({
        type: guardType,
        floor: boss.floor,
        x: sx,
        z: sz,
        isElite: band <= 0.45 && i === 0,
        roomId: boss.roomId,
        inBossRoom: true,
        sleeping: false,
        customConfig: { summonedByBossId: boss.id }
      });
      if (add) {
        add.isAlerted = true;
        add.state = AI_STATE.CHASE;
        spawned += 1;
      }
      this.renderer?.spawnBossTelegraph?.('summon', { x: sx, y: 0, z: sz }, { x: 0, z: 1 }, { duration: 0.55 });
    }

    if (spawned > 0) {
      const msg = `⚠️ ${boss.name} summoned ${spawned} Royal Guards!`;
      this.gameContext?.hud?.toast?.(msg, 'warning');
      if (this.renderer?.spawnFloatingText) {
        this.renderer.spawnFloatingText({ x: boss.x, y: 2.5, z: boss.z }, 'GUARD SUMMON!', { color: '#c084fc', isCrit: true });
      }
    }
    return spawned;
  }

  _spawnCampGiant(campId, triggerEnemy = null, worldArg = null) {
    const camp = this.activeOutskirtCamps?.find((c) => c.id === campId) || {
      id: campId,
      name: triggerEnemy?.campName || campId,
      level: triggerEnemy?.campLevel || triggerEnemy?.level || 1,
      center: { x: triggerEnemy?.spawnX ?? triggerEnemy?.x ?? 0, z: triggerEnemy?.spawnZ ?? triggerEnemy?.z ?? 0 },
      spawns: [{ type: triggerEnemy?.type || 'tiger' }]
    };
    const spawns = Array.isArray(camp.spawns) && camp.spawns.length > 0
      ? camp.spawns
      : [{ type: triggerEnemy?.type || 'tiger' }];
    const pickType = spawns.find((s) => !MONSTER_CATALOG[s.type]?.isRanged)?.type || triggerEnemy?.type || spawns[0].type || 'tiger';
    const cx = Number(camp.center?.x ?? triggerEnemy?.spawnX ?? 0);
    const cz = Number(camp.center?.z ?? triggerEnemy?.spawnZ ?? 0);
    const world = worldArg || this.gameContext?.dungeon || this.gameContext?.world || this.world;

    let spawnX = cx;
    let spawnZ = cz;
    const isWalkable = typeof world?.isWalkable === 'function' ? (wx, wz) => world.isWalkable(wx, wz, 0.9) : null;
    if (isWalkable && !isWalkable(spawnX, spawnZ)) {
      const radii = [2.2, 4.2, 6.5];
      let found = false;
      for (let ri = 0; ri < radii.length && !found; ri++) {
        const r = radii[ri];
        for (let a = 0; a < 8; a++) {
          const ang = (a / 8) * Math.PI * 2;
          const tx = cx + Math.cos(ang) * r;
          const tz = cz + Math.sin(ang) * r;
          if (isWalkable(tx, tz)) {
            spawnX = tx;
            spawnZ = tz;
            found = true;
            break;
          }
        }
      }
    }

    const giant = this.spawnMonster({
      type: pickType,
      floor: 0,
      x: spawnX,
      z: spawnZ,
      isGiant: true,
      isOutskirtMob: true,
      isVillageMob: true,
      campId,
      packId: campId,
      campName: camp.name,
      campLevel: camp.level || triggerEnemy?.campLevel || triggerEnemy?.level || 1,
      aggroRange: 14,
      spawnOnce: true,
      respawnDelay: 0,
      villageSafeHalf: triggerEnemy?.villageSafeHalf ?? 55.6
    });
    if (!giant) return null;
    giant.spawnOnce = true;

    const hud = this.context?.hud || this.gameContext?.hud;
    const cleanName = String(giant.name || '').replace(/^Giant\s+/i, '');
    const msg = `⚠️ Giant ${cleanName} has emerged at ${camp.name || 'the outskirt camp'}!`;
    hud?.toast?.(msg, 'levelup');
    hud?.showToast?.(msg, 'levelup');
    if (this.renderer?.spawnSkillEffect) {
      this.renderer.spawnSkillEffect('shockwave', { x: spawnX, y: 0.4, z: spawnZ }, 0, { color: 0xf59e0b, radius: 3.4 });
      this.renderer.spawnSkillEffect('spark', { x: spawnX, y: 0.9, z: spawnZ }, 0, { color: 0xfbbf24 });
    }
    if (this.renderer?.spawnHitSparks) {
      this.renderer.spawnHitSparks(giant, 0xf59e0b, 16);
    }
    if (this.renderer?.shakeScreen) {
      this.renderer.shakeScreen(0.32, 0.35);
    } else if (this.renderer?.shake) {
      this.renderer.shake(0.32, 0.35);
    }
    return giant;
  }

  _handleEnemyDeath(enemy, options = {}) {
    if (enemy.dead) return;
    enemy.dead = true;
    enemy.isDead = true;
    enemy.state = AI_STATE.DEAD;
    enemy.deathTimer = 1.05 + (this._killStagger++ % 6) * 0.08;
    enemy._deferredMeshCfg = null;
    this._aliveNonBossDirty = true;
    if (enemy.isOutskirtMob && !enemy.spawnOnce) {
      enemy.respawnTimer = Math.max(3, Number(enemy.respawnDelay || 12));
    }
    this.clearStatuses(enemy);

    if (enemy.telegraphMesh) enemy.telegraphMesh.visible = false;
    if (enemy.healthBarGroup) enemy.healthBarGroup.visible = false;

    const ctx = this.gameContext || {};
    const world = options.world || ctx.dungeon || ctx.world;
    const gameState = options.gameState || ctx.gameState;

    // Outskirt camp kill threshold -> spawn Giant Miniboss
    if (!enemy.isBoss && enemy.isOutskirtMob && enemy.campId && !enemy.isGiant) {
      const hasActiveGiant = this.enemies.some((m) => !m.dead && m.isGiant && m.campId === enemy.campId);
      if (!hasActiveGiant) {
        const camp = this.activeOutskirtCamps?.find((c) => c.id === enemy.campId);
        const threshold = Math.max(1, Number(camp?.giantKillCount || OUTSKIRT_GIANT_KILL_THRESHOLD));
        const next = (this.campKills.get(enemy.campId) || 0) + 1;
        if (next >= threshold) {
          this.campKills.set(enemy.campId, 0);
          this._spawnCampGiant(enemy.campId, enemy, world);
        } else {
          this.campKills.set(enemy.campId, next);
        }
      }
    }

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
        isGiant: enemy.isGiant,
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

    // Giant Miniboss Slaying Celebration
    if (enemy.isGiant) {
      const hud = this.context?.hud || this.gameContext?.hud || ctx.hud;
      hud?.toast?.(`⚔️ GIANT SLAIN! Defeated ${enemy.name} (+${enemy.gold}G, +${enemy.exp} EXP)`, 'levelup');
      hud?.showToast?.(`⚔️ GIANT SLAIN! Defeated ${enemy.name} (+${enemy.gold}G, +${enemy.exp} EXP)`, 'levelup');
      if (this.renderer?.shakeScreen) this.renderer.shakeScreen(0.35, 0.4);
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
      // Collapse remaining summoned boss guards and cancel mid-air delayed strikes upon boss defeat
      if (Array.isArray(this._pendingStrikes)) {
        this._pendingStrikes = this._pendingStrikes.filter((s) => s.sourceEnemy !== enemy);
      }
      for (const add of this.enemies) {
        if (!add.dead && add.summonedByBossId === enemy.id) {
          add.dead = true;
          add.isDead = true;
          add.hp = 0;
          add.deathTimer = 0.25;
          this._aliveNonBossDirty = true;
          if (add.telegraphMesh) add.telegraphMesh.visible = false;
          if (add.healthBarGroup) add.healthBarGroup.visible = false;
          this.clearStatuses(add);
          this.renderer?.spawnHitSparks?.(add, 0xfacc15, 6);
        }
      }
      world?.unlockBossRoomRewards?.();
      world?.unlockFloor?.(this.currentFloor + 1);
      const defeatBanner = enemy.defeatMsg || `⚔️ ${enemy.name} has been defeated!`;
      ctx.hud?.showBanner?.(`UNIQUE VANQUISHED: ${enemy.name}`, enemy.title || `Floor ${this.currentFloor} Guardian Defeated`);
      ctx.hud?.showToast?.(defeatBanner, 'kill');
      ctx.hud?.toast?.(defeatBanner, 'kill');
    } else {
      // Boss Chamber Gate unlock: opens when all non-boss monsters in the other rooms are cleared
      const bossGate = world?.gates?.find?.((g) => g.isBossGate) || world?.bossGate;
      if (bossGate && !bossGate.isOpen) {
        const aliveNonBosses = this.getAliveNonBossCount(world);
        if (aliveNonBosses === 0) {
          world.setGateOpen?.(bossGate.id, true);
          bossGate.isOpen = true;
          const gateMsg = 'The Boss Chamber seal has shattered! The Gate is open!';
          const hud = this.context?.hud || this.gameContext?.hud || ctx.hud;
          hud?.showToast?.(gateMsg, 'levelup');
          hud?.toast?.(gateMsg, 'levelup');
          if (this.renderer?.shake) this.renderer.shake(0.35, 0.25);
          const snd = this.sound || this.gameContext?.sound;
          if (snd?.play) snd.play('levelup');
          if (this.renderer?.spawnFloatingText) {
            this.renderer.spawnFloatingText({ x: bossGate.x, y: 1.6, z: bossGate.z }, 'GATE UNLOCKED', { color: '#facc15', isCrit: true });
          }
        }
      }
    }

    const onKilledCb =
      options.callbacks?.onEnemyKilled ||
      this.lastCallbacks?.onEnemyKilled ||
      ctx.onEnemyKilled;

    if (typeof onKilledCb === 'function') {
      onKilledCb(enemy, rewards);
    }

    const remaining = this.getAliveFloorEnemies().length;
    if (remaining === 0 && !this.floorClearedNotified && this.currentFloor > 0 && !world?.isChallengeArena && !enemy.isOutskirtMob) {
      this.floorClearedNotified = true;
      world?.setExitLockedByClear?.(false);
      world?.unlockFloor?.(this.currentFloor + 1);
      gameState?.floorCleared?.(this.currentFloor);
      const clearTitle = `FLOOR B${this.currentFloor}F CLEARED!`;
      const clearSub = `All dungeon threats vanquished — Portal unlocked & Story Chronicles updated!`;
      ctx.hud?.showBanner?.(clearTitle, clearSub);
      ctx.hud?.showToast?.(`✨ ${clearTitle} ${clearSub}`, 'quest');
      ctx.hud?.toast?.(`✨ ${clearTitle} ${clearSub}`, 'quest');
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
      enemy.mesh.userData.phaseLevel = Math.max(3, Number(enemy.mesh.userData.phaseLevel || 1));
      enemy.mesh.traverse((child) => {
        if (child.isMesh && child.material && !child.userData?.noFlash) {
          const mat = child.material;
          if (mat.emissive && typeof mat.emissive.lerp === 'function') {
            mat.emissive.lerp(new THREE.Color(0xdc2626), 0.45);
            mat.emissiveIntensity = Math.max(0.65, Math.min(1.4, (mat.emissiveIntensity || 0.25) + 0.35));
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
    this._lastTime = time;
    this._wakeFrameId++;
    this._frameMobShockwaves = 0;
    this._frameMobSparks = 0;
    this._anyStatusRingVisible = false;
    if (callbacks && Object.keys(callbacks).length > 0) {
      this.lastCallbacks = callbacks;
    }

    world = world || this.gameContext?.dungeon || this.gameContext?.world;
    const bossGate = world?.gates?.find?.((g) => g.isBossGate) || world?.bossGate;
    if (bossGate && !bossGate.isOpen) {
      const aliveNonBosses = this.getAliveNonBossCount(world);
      if (aliveNonBosses === 0 && this.enemies.some((e) => e.isBoss)) {
        world.setGateOpen?.(bossGate.id, true);
        bossGate.isOpen = true;
        const gateMsg = 'The Boss Chamber seal has shattered! The Gate is open!';
        const hud = this.context?.hud || this.gameContext?.hud;
        hud?.showToast?.(gateMsg, 'levelup');
        hud?.toast?.(gateMsg, 'levelup');
        if (this.renderer?.shake) this.renderer.shake(0.35, 0.25);
        const snd = this.sound || this.gameContext?.sound;
        if (snd?.play) snd.play('levelup');
      }
    }
    const playerController = this.gameContext?.player || (playerTarget?.receiveHit ? playerTarget : null);
    const px = Number(playerTarget?.x ?? playerTarget?.position?.x ?? playerController?.position?.x ?? 0);
    const pz = Number(playerTarget?.z ?? playerTarget?.position?.z ?? playerController?.position?.z ?? 0);
    if (!this._lastPlayerPos) this._lastPlayerPos = { x: px, z: pz };
    else {
      this._lastPlayerPos.x = px;
      this._lastPlayerPos.z = pz;
    }

    const cam = this.renderer?.camera || null;
    let frustumValid = false;
    if (cam && cam.projectionMatrix && cam.matrixWorldInverse) {
      if (typeof cam.updateMatrixWorld === 'function') cam.updateMatrixWorld();
      this._projScreenMat.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
      this._frustum.setFromProjectionMatrix(this._projScreenMat);
      frustumValid = true;
    }

    // Build reusable spatial hash grid (CELL = 4m) once per frame for O(1) neighbor separation
    // Also count active non-boss special telegraphs/skills so regular mobs rate-limit cleanly
    this._spatialCells.clear();
    this._cellPoolUsed = 0;
    let activeRegularTelegraphs = 0;
    for (let i = 0; i < this.enemies.length; i++) {
      const em = this.enemies[i];
      if (em.dead) continue;
      if (!em.isBoss && (em.state === AI_STATE.TELEGRAPH || (em.state === AI_STATE.SKILL && em.pendingSkill))) {
        activeRegularTelegraphs++;
      }
      const ddx = px - em.x;
      const ddz = pz - em.z;
      const activeMover = em.state === AI_STATE.CHASE || em.state === AI_STATE.SKILL || em._returningHome || em.isBoss;
      if (!activeMover && ddx * ddx + ddz * ddz > 46 * 46) continue;
      const cx = Math.floor(em.x * 0.25) + 4096;
      const cz = Math.floor(em.z * 0.25) + 4096;
      const key = (cx << 13) | cz;
      let bucket = this._spatialCells.get(key);
      if (!bucket) {
        bucket = this._cellPool[this._cellPoolUsed];
        if (!bucket) {
          bucket = [];
          this._cellPool[this._cellPoolUsed] = bucket;
        } else {
          bucket.length = 0;
        }
        this._cellPoolUsed++;
        this._spatialCells.set(key, bucket);
      }
      bucket.push(em);
    }

    this._updatePendingStrikes(dt, px, pz, playerController, callbacks);

    let hydratedThisFrame = 0;
    let disposedThisFrame = 0;
    let anyTelegraphVisible = false;
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      if (!e.dead && e.reflectShieldTimer > 0) {
        e.reflectShieldTimer = Math.max(0, e.reflectShieldTimer - dt);
      }

      if (e.dead) {
        e.deathTimer -= dt;
        e.mesh?.userData?.animate?.('dead', time, dt);
        if (e.deathTimer <= 0 && e.mesh) {
          e.mesh.visible = false;
          if (disposedThisFrame < 3) {
            this.rootGroup.remove(e.mesh);
            disposeObject3D(e.mesh);
            e.mesh = null;
            disposedThisFrame++;
          }
        }
        if (e.isOutskirtMob) {
          if (e.spawnOnce) {
            if (e.deathTimer <= 0 && !e.mesh) {
              this.enemies.splice(i, 1);
            }
          } else {
            e.respawnTimer -= dt;
            if (e.respawnTimer <= 0 && !e.mesh) {
              const lvl = e.campLevel || e.level || 1;
              const respawned = this.spawnMonster({
                type: e.type,
                floor: 1,
                x: e.spawnX,
                z: e.spawnZ,
                isElite: e.isElite,
                packId: e.packId,
                sleeping: false,
                customConfig: {
                  level: lvl,
                  isOutskirtMob: true,
                  isVillageMob: true,
                  campId: e.campId,
                  campName: e.campName || null,
                  campLevel: lvl,
                  respawnDelay: e.respawnDelay,
                  villageSafeHalf: e.villageSafeHalf
                }
              });
              if (respawned && this.renderer?.spawnSkillEffect) {
                this.renderer.spawnSkillEffect('spark', { x: e.spawnX, y: 0.6, z: e.spawnZ }, 0, { color: 0x4ade80 });
              }
              this.enemies.splice(i, 1);
            }
          }
        }
        continue;
      }

      const dx = px - e.x;
      const dz = pz - e.z;
      const distSq = dx * dx + dz * dz;

      // Hydrate deferred outskirt mesh smoothly as player approaches within 48m (max 3/frame)
      if (e._deferredMeshCfg && hydratedThisFrame < 3 && distSq <= 48 * 48) {
        this._hydrateDeferredEnemyMesh(e);
        hydratedThisFrame++;
      }

      // Tight LOD & distance culling for far non-boss enemies (> 38m hidden & staggered 0.35s)
      if (!e.isBoss && distSq > 38 * 38 && e.state !== AI_STATE.TELEGRAPH && e.state !== AI_STATE.SKILL && !e._pendingSkillCheck) {
        if (e.mesh) {
          if (e.mesh.visible) e.mesh.visible = false;
          if (e.mesh.castShadow) e.mesh.castShadow = false;
        }
        e._lodAcc = (e._lodAcc || ((i % 5) * 0.07)) + dt;
        if (e._lodAcc < 0.35) continue;
        const lodDt = e._lodAcc;
        e._lodAcc = 0;
        e.attackCooldown = Math.max(0, e.attackCooldown - lodDt);
        e.skillCooldown = Math.max(0, e.skillCooldown - lodDt);
        this._updateStatuses(e, lodDt, time);
        if (e.dead) continue;
        if (e.hp < e.maxHp && (e.state === AI_STATE.IDLE || e._returningHome)) {
          e.hp = Math.min(e.maxHp, e.hp + Math.max(1, Math.round(e.maxHp * 0.04)));
        }
        if (e._returningHome) {
          e._leashTimer = Math.max(0, (e._leashTimer || 0) - lodDt);
          const hdx = e.spawnX - e.x;
          const hdz = e.spawnZ - e.z;
          const hDist = Math.hypot(hdx, hdz);
          const safeOutsideWall = !e.isOutskirtMob || (Math.abs(e.x) >= e.villageSafeHalf + 1.5 || Math.abs(e.z) >= e.villageSafeHalf + 1.5);
          if ((hDist <= 10 && safeOutsideWall) || e._leashTimer <= 0 || hDist < 0.5) {
            e._returningHome = false;
            e._leashTimer = 0;
            e.isAlerted = false;
            e.awarenessTimer = 0;
            e.state = AI_STATE.IDLE;
          }
        }
        continue;
      }

      const distToPlayer = Math.sqrt(distSq);

      // Camera frustum + boss distance visibility culling
      let inFrustum = true;
      if (e.isBoss) {
        if (distSq > 52 * 52 && e.state !== AI_STATE.TELEGRAPH && e.state !== AI_STATE.SKILL && !e._pendingSkillCheck) {
          inFrustum = false;
        }
      } else if (frustumValid && distSq > 16 * 16) {
        this._cullSphere.center.set(e.x, 0.8, e.z);
        this._cullSphere.radius = Math.max(3.5, (e.radius || 0.6) * 4);
        inFrustum = this._frustum.intersectsSphere(this._cullSphere);
      }

      const shouldRender = !e._deferredMeshCfg && inFrustum;
      if (e.mesh && e.mesh.visible !== shouldRender) {
        e.mesh.visible = shouldRender;
      }

      // Inline animation throttling (0 when off-frustum/hidden, 15 Hz beyond 22m)
      let animDt = dt;
      if (!shouldRender) {
        animDt = 0;
      } else if (!e.isBoss && distSq > 22 * 22) {
        e._animAcc = (e._animAcc || 0) + dt;
        if (e._animAcc >= 0.066) {
          animDt = e._animAcc;
          e._animAcc = 0;
        } else {
          animDt = 0;
        }
      }

      // Status effects (DoT ticks, timers, ring/tint). May kill the enemy.
      this._updateStatuses(e, dt, time);
      if (e.dead) continue;

      // Frozen (non-boss): a statue - no movement, no attacks, no cooldown progress
      if (this._isRooted(e)) {
        if (e.telegraphMesh) e.telegraphMesh.visible = false;
        if (shouldRender) {
          this._applyStatusTint(e, dt);
          e.syncHealthBar(cam);
        }
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

      if (e.state === AI_STATE.STUN) {
        e.stunTimer -= dt;
        if (animDt > 0) e.mesh?.userData?.animate?.('hit', time, animDt);
        if (e.stunTimer <= 0) {
          e.state = AI_STATE.CHASE;
        }
        if (shouldRender) {
          this._applyStatusTint(e, dt);
          e.syncHealthBar(cam);
        }
        continue;
      }

      // Special skill trigger when off cooldown (bosses always when ready; non-bosses/elites when off cooldown)
      // Only triggered when actively chasing player (AI_STATE.CHASE) and in valid skill range!
      const canCastSpecial = e.isBoss ? true : (e.skills.length > 0 && e.skillCooldown <= 0);
      if (
        canCastSpecial &&
        e.skills.length > 0 &&
        e.skillCooldown <= 0 &&
        e.state === AI_STATE.CHASE
      ) {
        if (!e.isBoss && !e.isElite && !e.isGiant && activeRegularTelegraphs >= 2) {
          // Stagger regular-mob specials when >= 2 non-boss mobs are already telegraphing
          e.skillCooldown = 0.3 + Math.random() * 0.4;
        } else {
          const validSkills = this._validSkillsScratch;
          validSkills.length = 0;
          for (let si = 0; si < e.skills.length; si++) {
            const sk = e.skills[si];
            if (isSkillInRange(sk, e, distToPlayer)) validSkills.push(sk);
          }
          if (validSkills.length > 0) {
            const chosenSkill = validSkills[Math.floor(Math.random() * validSkills.length)];
            e.pendingSkill = chosenSkill;
            e.state = AI_STATE.TELEGRAPH;
            e.stateTimer = e.isBoss ? Math.max(0.45, 0.72 - e.phase * 0.08) : (e.isElite ? 0.52 : 0.42);
            e.skillCooldown = e.isBoss ? Math.max(2.3, 4.6 - e.phase * 0.7) : (e.isElite ? 4.5 + Math.random() * 2 : 6.5 + Math.random() * 3);
            if (e.mesh?.userData) {
              e.mesh.userData.phaseLevel = e.phase;
              const isCasterSkill = /curse|breath|meteor|thunder|blizzard|summon|pack|volley|barrage|storm|drain|siphon|mirror|petrify|eruption/i.test(chosenSkill);
              e.mesh.userData.attackVariant = isCasterSkill ? 'ATTACK3' : 'ATTACK2';
            }
            if (chosenSkill === 'charge' || chosenSkill === 'pounce' || chosenSkill === 'flame_claw_leap' || chosenSkill === 'dash_strike' || chosenSkill === 'tiger_claw_frenzy' || chosenSkill === 'quick_lunge' || chosenSkill === 'ram_tackle') {
              const len = distToPlayer > 0.05 ? distToPlayer : 1;
              e.chargeDir = { x: dx / len, z: dz / len };
              e.skillTravelDist = 0;
            }
            if (
              UNIQUE_SKILL_LABELS[chosenSkill] &&
              this.renderer?.spawnFloatingText &&
              (e.isBoss || e.isElite || e.isGiant || (distToPlayer < 14 && activeRegularTelegraphs < 2))
            ) {
              this.renderer.spawnFloatingText(
                { x: e.x, y: e.isBoss ? 2.3 : 1.7, z: e.z },
                UNIQUE_SKILL_LABELS[chosenSkill],
                { color: e.element === 'ice' ? '#7dd3fc' : e.element === 'poison' ? '#4ade80' : e.element === 'lightning' ? '#fde047' : '#fb923c', isCrit: e.isBoss || e.isGiant }
              );
            }
            if (!e.isBoss) {
              activeRegularTelegraphs++;
            }
            const bossArena = world?.bossArena || this.gameContext?.dungeon?.bossArena || null;
            if (e.isBoss && this.renderer?.spawnBossTelegraph) {
              this.renderer.spawnBossTelegraph(chosenSkill, e.position, e.chargeDir, {
                radius: chosenSkill.includes('nova') || chosenSkill.includes('blizzard') || chosenSkill.includes('sandstorm') || chosenSkill.includes('hurricane') ? 5.2 : 4.2,
                duration: e.stateTimer,
                arena: bossArena,
                color: e.element === 'fire' ? 0xff4400 : e.element === 'lightning' ? 0xfacc15 : e.element === 'ice' ? 0x38bdf8 : e.element === 'poison' ? 0x22c55e : 0xef4444
              });
            }
          }
        }
      }

      switch (e.state) {
        case AI_STATE.SLEEP: {
          if (animDt > 0) e.mesh?.userData?.animate?.('idle', time * 0.35, animDt);
          if (distToPlayer <= e.aggroRange * 0.68) {
            this.wakePack(e);
          }
          break;
        }

        case AI_STATE.IDLE: {
          e.stateTimer -= dt;
          if (animDt > 0) e.mesh?.userData?.animate?.('idle', time, animDt);
          if (distToPlayer <= e.aggroRange && !e._returningHome) {
            e.rotation = Math.atan2(dx, dz);
            if (!e.isAlerted) {
              e.isAlerted = true;
              e.awarenessTimer = 0.3 + Math.random() * 0.2;
              if ((time - (e._lastAlertAt ?? -99)) >= 8.0) {
                e._lastAlertAt = time;
                if (this.renderer?.spawnFloatingText) {
                  this.renderer.spawnFloatingText({ x: e.x, y: 1.1, z: e.z }, '!', { color: '#facc15', isCrit: true });
                }
              }
            }
            if (e.awarenessTimer > 0) {
              e.awarenessTimer -= dt;
              break;
            }
            if (e.packId) this.wakePack(e, { allowTriggerAlert: false });
            else e.state = AI_STATE.CHASE;
          } else {
            if (distToPlayer > e.aggroRange * 1.35) {
              e.isAlerted = false;
              e.awarenessTimer = 0;
            }
            if (e.stateTimer <= 0) {
              const angle = Math.random() * Math.PI * 2;
              const r = 1.5 + Math.random() * 2.5;
              e.patrolTarget = {
                x: e.spawnX + Math.cos(angle) * r,
                z: e.spawnZ + Math.sin(angle) * r
              };
              e.state = AI_STATE.PATROL;
              e.stateTimer = 2.0 + Math.random() * 2.0;
            }
          }
          break;
        }

        case AI_STATE.PATROL: {
          e.stateTimer -= dt;
          if (e._returningHome) {
            e._leashTimer = Math.max(0, (e._leashTimer || 0) - dt);
            const hdx = e.spawnX - e.x;
            const hdz = e.spawnZ - e.z;
            const hDist = Math.hypot(hdx, hdz);
            const safeOutsideWall = !e.isOutskirtMob || (Math.abs(e.x) >= e.villageSafeHalf + 1.5 || Math.abs(e.z) >= e.villageSafeHalf + 1.5);
            if ((hDist <= 10 && safeOutsideWall) || e._leashTimer <= 0 || hDist < 0.5) {
              e._returningHome = false;
              e._leashTimer = 0;
              e.isAlerted = false;
              e.awarenessTimer = 0;
              e.state = AI_STATE.IDLE;
              e.stateTimer = 1.2 + Math.random() * 1.5;
            } else {
              this._moveEnemy(e, hdx / hDist, hdz / hDist, e.moveSpeed * 1.15, dt, world);
              if (animDt > 0) e.mesh?.userData?.animate?.('walk', time, animDt);
            }
            break;
          }
          if (distToPlayer <= e.aggroRange) {
            e.rotation = Math.atan2(dx, dz);
            if (!e.isAlerted) {
              e.isAlerted = true;
              e.awarenessTimer = 0.3 + Math.random() * 0.2;
              if ((time - (e._lastAlertAt ?? -99)) >= 8.0) {
                e._lastAlertAt = time;
                if (this.renderer?.spawnFloatingText) {
                  this.renderer.spawnFloatingText({ x: e.x, y: 1.1, z: e.z }, '!', { color: '#facc15', isCrit: true });
                }
              }
            }
            if (e.awarenessTimer > 0) {
              e.awarenessTimer -= dt;
              if (animDt > 0) e.mesh?.userData?.animate?.('idle', time, animDt);
              break;
            }
            if (e.packId) this.wakePack(e, { allowTriggerAlert: false });
            else e.state = AI_STATE.CHASE;
            break;
          }
          const pdx = e.patrolTarget.x - e.x;
          const pdz = e.patrolTarget.z - e.z;
          const pDist = Math.hypot(pdx, pdz);
          if (pDist < 0.35 || e.stateTimer <= 0) {
            e.state = AI_STATE.IDLE;
            e.stateTimer = 1.2 + Math.random() * 1.5;
            if (distToPlayer > e.aggroRange * 1.35) {
              e.isAlerted = false;
              e.awarenessTimer = 0;
            }
          } else {
            this._moveEnemy(e, pdx / pDist, pdz / pDist, e.moveSpeed * 0.55, dt, world);
            if (animDt > 0) e.mesh?.userData?.animate?.('walk', time, animDt);
          }
          break;
        }

        case AI_STATE.CHASE: {
          if (e.isOutskirtMob) {
            const spawnDist = Math.hypot(e.x - e.spawnX, e.z - e.spawnZ);
            const nearTownWall = Math.abs(e.x) < e.villageSafeHalf && Math.abs(e.z) < e.villageSafeHalf;
            const leashR = e.isGiant ? 34 : 26;
            if (spawnDist > leashR || nearTownWall) {
              e._returningHome = true;
              e._leashTimer = 3.0;
              e.patrolTarget = { x: e.spawnX, z: e.spawnZ };
              e.state = AI_STATE.PATROL;
              e.stateTimer = 3.0;
              e.awarenessTimer = 0;
              e.hp = Math.min(e.maxHp, e.hp + Math.round(e.maxHp * 0.25));
              e.syncHealthBar?.(cam);
              break;
            }
          }
          if (distToPlayer > e.aggroRange * 1.6 && !e.isBoss) {
            e.state = AI_STATE.IDLE;
            e.stateTimer = 1.0;
            if (distToPlayer > e.aggroRange * 1.35) {
              e.isAlerted = false;
            }
            e.awarenessTimer = 0;
            break;
          }

          if (distToPlayer <= e.attackRange && e.attackCooldown <= 0) {
            e.pendingSkill = null;
            e.state = AI_STATE.TELEGRAPH;
            e.stateTimer = e.telegraphDuration;
            e.rotation = Math.atan2(dx, dz);
            break;
          }

          if (e.isRanged && distToPlayer <= e.attackRange * 0.88) {
            e.rotation = Math.atan2(dx, dz);
            if (distToPlayer < 3.4 && distToPlayer > 0.05) {
              this._moveEnemy(e, -dx / distToPlayer, -dz / distToPlayer, e.moveSpeed * 0.55, dt, world);
              if (animDt > 0) e.mesh?.userData?.animate?.('walk', time, animDt);
            } else if (animDt > 0) {
              e.mesh?.userData?.animate?.('idle', time, animDt);
            }
            break;
          }

          if (distToPlayer > 0.05) {
            this._moveEnemy(e, dx / distToPlayer, dz / distToPlayer, e.moveSpeed, dt, world);
          }
          if (animDt > 0) e.mesh?.userData?.animate?.('chase', time, animDt);
          break;
        }

        case AI_STATE.TELEGRAPH: {
          e.stateTimer -= dt;
          if (distToPlayer > 0.05 && e.pendingSkill !== 'charge' && e.pendingSkill !== 'pounce' && e.pendingSkill !== 'flame_claw_leap' && e.pendingSkill !== 'quick_lunge' && e.pendingSkill !== 'ram_tackle') {
            e.rotation = Math.atan2(dx, dz);
          }
          if (e.telegraphMesh) {
            e.telegraphMesh.visible = true;
            anyTelegraphVisible = true;
          }
          if (animDt > 0) e.mesh?.userData?.animate?.('telegraph', time, animDt);

          if (e.stateTimer <= 0) {
            if (e.telegraphMesh) e.telegraphMesh.visible = false;
            if (e.pendingSkill) {
              const isDashLike = e.pendingSkill === 'charge' || e.pendingSkill === 'pounce' || e.pendingSkill === 'flame_claw_leap' || e.pendingSkill === 'dash_strike' || e.pendingSkill === 'tiger_claw_frenzy' || e.pendingSkill === 'quick_lunge' || e.pendingSkill === 'ram_tackle';
              e.state = AI_STATE.SKILL;
              e.stateTimer = isDashLike ? 0.45 : 0.35;
              e.skillTravelDist = 0;
              this._executeBossSpecialSkill(e, px, pz, world, callbacks);
            } else {
              if (e.mesh?.userData) {
                e.mesh.userData.attackVariant = Math.random() < 0.35 ? 'ATTACK2' : 'ATTACK1';
              }
              e.state = AI_STATE.ATTACK;
              e.stateTimer = 0.28;
              this._executeEnemyBasicAttack(e, px, pz, distToPlayer, callbacks);
            }
          }
          break;
        }

        case AI_STATE.ATTACK: {
          e.stateTimer -= dt;
          if (animDt > 0) e.mesh?.userData?.animate?.('attack', time, animDt);
          if (e.stateTimer <= 0) {
            e.attackCooldown = e.attackCooldownMax;
            e.state = AI_STATE.CHASE;
          }
          break;
        }

        case AI_STATE.SKILL: {
          e.stateTimer -= dt;
          const dashSkill = e.pendingSkill === 'charge' || e.pendingSkill === 'pounce' || e.pendingSkill === 'flame_claw_leap' || e.pendingSkill === 'dash_strike' || e.pendingSkill === 'tiger_claw_frenzy' || e.pendingSkill === 'quick_lunge' || e.pendingSkill === 'ram_tackle';
          if (dashSkill) {
            if (!e.chargeDir || !Number.isFinite(e.chargeDir.x) || !Number.isFinite(e.chargeDir.z)) {
              const len = distToPlayer > 0.05 ? distToPlayer : 1;
              e.chargeDir = { x: dx / len, z: dz / len };
            }
            if (e.skillTravelDist === undefined) {
              e.skillTravelDist = 0;
            }
            const isPounce = e.pendingSkill === 'pounce' || e.pendingSkill === 'quick_lunge' || e.pendingSkill === 'ram_tackle';
            const speedMult = isPounce ? 2.4 : 2.8;
            const maxTravel = isPounce ? 3.5 : 8.0;

            const remainingTravel = maxTravel - e.skillTravelDist;
            if (remainingTravel > 0.001) {
              const prevX = e.x;
              const prevZ = e.z;
              const desiredSpeed = e.moveSpeed * speedMult;
              const maxStepSpeed = remainingTravel / Math.max(0.0001, dt);
              const effectiveSpeed = Math.min(desiredSpeed, maxStepSpeed);
              this._moveEnemy(e, e.chargeDir.x, e.chargeDir.z, effectiveSpeed, dt, world);
              const actualMoved = Math.hypot(e.x - prevX, e.z - prevZ);
              e.skillTravelDist += actualMoved;
              // If stopped by a solid obstacle / wall, end travel early
              if (actualMoved < 0.0005 && dt > 0) {
                e.skillTravelDist = maxTravel;
              }
            }

            // ONLY apply bossArena clamp to boss monsters!
            const arena = world?.bossArena || this.gameContext?.dungeon?.bossArena;
            if (e.isBoss && arena?.center && Number.isFinite(arena.radius)) {
              const adx = e.x - arena.center.x;
              const adz = e.z - arena.center.z;
              const ad = Math.hypot(adx, adz);
              const maxR = Math.max(1.5, arena.radius - 0.9);
              if (ad > maxR && ad > 0.001) {
                e.x = arena.center.x + (adx / ad) * maxR;
                e.z = arena.center.z + (adz / ad) * maxR;
              }
            }
            if (Math.hypot(px - e.x, pz - e.z) <= e.radius + 0.95) {
              const dmgMult = e.pendingSkill === 'charge' ? 1.5 : 1.32;
              this._dealDamageToPlayer(e, Math.round(e.atk * dmgMult), e.element, callbacks);
              if (this._canEmitMobSparks(e)) {
                this.renderer?.spawnHitSparks?.(e.position, e.color || 0xf97316, 12);
              }
              if (e.pendingSkill === 'charge' || e.pendingSkill === 'ram_tackle') {
                this._nudgePlayer(e.x, e.z, 0.9, world);
              }
              if (e.pendingSkill === 'pounce' && typeof callbacks?.applyPlayerStatus === 'function') {
                callbacks.applyPlayerStatus('bleed', 3.0, Math.round(e.atk * 0.15));
              }
              e.pendingSkill = null;
            }
          }
          if (animDt > 0) e.mesh?.userData?.animate?.('skill', time, animDt);
          if (e.stateTimer <= 0) {
            e.pendingSkill = null;
            e.skillTravelDist = 0;
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
      if (shouldRender) {
        this._applyStatusTint(e, dt);
        e.syncHealthBar(cam);
      }
    }

    if (anyTelegraphVisible) {
      getSharedEnemyUi().telegraphMat.opacity = 0.35 + Math.sin(time * 18) * 0.2;
    }
    if (this._anyStatusRingVisible) {
      const statusPulse = 0.55 + Math.sin(time * 8) * 0.15;
      for (const mat of getSharedEnemyUi().statusRingMats.values()) {
        mat.opacity = statusPulse;
      }
    }

    // Update active enemy projectiles (arrows, elemental bolts, acid spit)
    this._updateEnemyProjectiles(dt, playerTarget || playerController, world, callbacks);
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
    if (id === 'stun' && (enemy.isBoss || enemy.isGiant)) duration *= 0.4;

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
      if (enemy.isBoss || enemy.isGiant) {
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
    enemy._hasStatuses = true;
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
    if (!enemy?._hasStatuses || !enemy?.statuses) return 1;
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
    enemy._hasStatuses = false;
    if (hadTint) this._restoreTint(enemy);
    this._removeStatusRing(enemy);
  }

  _updateStatuses(enemy, dt, time = 0) {
    if (!enemy._hasStatuses) return;
    const st = enemy.statuses;
    if (!st) {
      enemy._hasStatuses = false;
      return;
    }
    let changed = false;
    let activeCount = 0;
    for (const id in st) {
      if (!Object.prototype.hasOwnProperty.call(st, id)) continue;
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
      } else {
        activeCount++;
      }
    }
    if (activeCount === 0) enemy._hasStatuses = false;
    if (changed) this._refreshStatusRing(enemy);
    if (enemy.statusRing) {
      enemy.statusRing.rotation.z = time * 2.4;
      this._anyStatusRingVisible = true;
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
    const ui = getSharedEnemyUi();
    const mat = ui.getStatusRingMat(top.color);
    if (!enemy.statusRing) {
      const geo = enemy.isBoss ? ui.statusRingBossGeo : ui.statusRingMobGeo;
      const ring = new THREE.Mesh(geo, mat);
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.05;
      ring.userData.noFlash = true;
      enemy.mesh.add(ring);
      enemy.statusRing = ring;
    } else if (enemy.statusRing.material !== mat) {
      enemy.statusRing.material = mat;
    }
  }

  _removeStatusRing(enemy) {
    const ring = enemy?.statusRing;
    if (!ring) return;
    ring.parent?.remove(ring);
    if (ring.geometry && !ring.geometry.userData?.isSharedAsset && !ring.geometry.userData?.sharedAsset) {
      ring.geometry.dispose?.();
    }
    if (ring.material && !ring.material.userData?.isSharedAsset && !ring.material.userData?.sharedAsset) {
      ring.material.dispose?.();
    }
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
    // Soft separation from nearby alive enemies using spatial hash grid (fallback to linear scan outside update)
    let sepX = 0;
    let sepZ = 0;
    if (this._spatialCells.size > 0) {
      const cx = Math.floor(enemy.x * 0.25) + 4096;
      const cz = Math.floor(enemy.z * 0.25) + 4096;
      for (let ox = -1; ox <= 1; ox++) {
        for (let oz = -1; oz <= 1; oz++) {
          const bucket = this._spatialCells.get(((cx + ox) << 13) | (cz + oz));
          if (!bucket) continue;
          for (let bi = 0; bi < bucket.length; bi++) {
            const other = bucket[bi];
            if (other === enemy || other.dead) continue;
            const ddx = enemy.x - other.x;
            const ddz = enemy.z - other.z;
            const minSep = enemy.radius + other.radius + 0.25;
            const distSq = ddx * ddx + ddz * ddz;
            if (distSq > 0.000001 && distSq < minSep * minSep) {
              const dist = Math.sqrt(distSq);
              const push = (minSep - dist) / minSep;
              sepX += (ddx / dist) * push * 1.4;
              sepZ += (ddz / dist) * push * 1.4;
            }
          }
        }
      }
    } else {
      for (let i = 0; i < this.enemies.length; i++) {
        const other = this.enemies[i];
        if (other === enemy || other.dead) continue;
        const ox = enemy.x - other.x;
        const oz = enemy.z - other.z;
        const minSep = enemy.radius + other.radius + 0.25;
        const distSq = ox * ox + oz * oz;
        if (distSq > 0.000001 && distSq < minSep * minSep) {
          const dist = Math.sqrt(distSq);
          const push = (minSep - dist) / minSep;
          sepX += (ox / dist) * push * 1.4;
          sepZ += (oz / dist) * push * 1.4;
        }
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
    const hasArrowSkill = Array.isArray(enemy.skills) && enemy.skills.some((s) => s === 'arrow_volley' || s === 'poison_arrow');
    const isBowArcher = enemy.type === 'bandit_archer'
      || enemy.type === 'banditarcher'
      || enemy.type === 'bandit_bowman'
      || enemy.type === 'bone_hunter'
      || enemy.attackStyle === 'arrow'
      || hasArrowSkill
      || (enemy.isRanged && /archer|bow|hunter/i.test(String(enemy.type || '')));

    if (isBowArcher) {
      this._spawnEnemyProjectile(enemy, px, pz, 'arrow', enemy.atk, enemy.element || 'physical', callbacks);
      return;
    }

    if (enemy.isRanged) {
      const kind = enemy.element === 'dark' || enemy.element === 'poison' ? 'orb' : 'bolt';
      const color = enemy.element === 'dark' ? 0xa855f7 : enemy.element === 'ice' ? 0x38bdf8 : enemy.element === 'lightning' ? 0xfacc15 : 0xff5522;
      this._spawnEnemyProjectile(enemy, px, pz, kind, enemy.atk, enemy.element || 'fire', callbacks, { color });
      return;
    }

    const hitRange = enemy.attackRange + 0.65;
    if (distToPlayer <= hitRange) {
      this._dealDamageToPlayer(enemy, enemy.atk, enemy.element, callbacks);
    }
  }

  _nudgePlayer(originX, originZ, distance, world = null) {
    const player = this.gameContext?.player;
    if (!player?.position || !Number.isFinite(distance) || Math.abs(distance) < 0.05) return;
    if (
      player.invulnerableTimer > 0 ||
      this.gameContext?.gameState?.isInvulnerable ||
      player._isSkillUninterruptible?.()
    ) return;
    const dx = player.position.x - originX;
    const dz = player.position.z - originZ;
    const len = Math.hypot(dx, dz) || 1;
    const tx = player.position.x + (dx / len) * distance;
    const tz = player.position.z + (dz / len) * distance;
    if (world?.resolveCollision) {
      const r = world.resolveCollision(tx, tz, 0.45);
      player.position.x = r.x;
      player.position.z = r.z;
    } else if (!world?.isWalkable || world.isWalkable(tx, tz, 0.45)) {
      player.position.x = tx;
      player.position.z = tz;
    }
    if (player.heroMesh) {
      player.heroMesh.position.x = player.position.x;
      player.heroMesh.position.z = player.position.z;
    }
  }

  _queueGroundStrike({
    sourceEnemy,
    isArenaHazard = false,
    x,
    z,
    radius = 3.0,
    delay = 0.85,
    damage = 25,
    element = 'fire',
    color = 0xef4444,
    statusId = null,
    statusDuration = 3.0,
    statusPower = 16,
    knockback = 0,
    world = null,
    callbacks = {}
  }) {
    if (!Array.isArray(this._pendingStrikes)) this._pendingStrikes = [];
    let sx = Number(x || 0);
    let sz = Number(z || 0);
    const arena = world?.bossArena || this.gameContext?.dungeon?.bossArena;
    if (arena?.center && Number.isFinite(arena.radius)) {
      const adx = sx - arena.center.x;
      const adz = sz - arena.center.z;
      const ad = Math.hypot(adx, adz);
      const maxR = Math.max(1.2, arena.radius - 0.8);
      if (ad > maxR && ad > 0.001) {
        sx = arena.center.x + (adx / ad) * maxR;
        sz = arena.center.z + (adz / ad) * maxR;
      }
    }
    this.renderer?.spawnBossTelegraph?.('shockwave', { x: sx, y: 0, z: sz }, { x: 0, z: 1 }, {
      radius,
      duration: delay,
      arena,
      color
    });
    this._pendingStrikes.push({
      sourceEnemy,
      isArenaHazard: Boolean(isArenaHazard),
      x: sx,
      z: sz,
      radius,
      timer: delay,
      damage: Math.max(1, Math.round(damage)),
      element,
      color,
      statusId,
      statusDuration,
      statusPower,
      knockback,
      world,
      callbacks
    });
  }

  /**
   * Schedule an environmental telegraph strike in a Challenge Coliseum (no living boss required).
   */
  queueArenaHazard(opts = {}) {
    const hazardName = opts.hazardName || 'Trial Arena Hazard';
    const sourceEnemy = opts.sourceEnemy || { name: hazardName, isBoss: true, isArenaHazard: true };
    return this._queueGroundStrike({
      radius: 2.7,
      delay: 1.35,
      damage: 26,
      element: 'fire',
      color: 0xef4444,
      statusDuration: 3.0,
      statusPower: 14,
      ...opts,
      sourceEnemy,
      isArenaHazard: true
    });
  }

  _updatePendingStrikes(dt, px, pz, playerController, callbacks = {}) {
    if (!Array.isArray(this._pendingStrikes) || this._pendingStrikes.length === 0) return;
    for (let i = this._pendingStrikes.length - 1; i >= 0; i--) {
      const s = this._pendingStrikes[i];
      if (!s.isArenaHazard && (!s.sourceEnemy || s.sourceEnemy.dead)) {
        this._pendingStrikes.splice(i, 1);
        continue;
      }
      s.timer -= dt;
      if (s.timer > 0) continue;

      this._pendingStrikes.splice(i, 1);
      if (this.renderer?.spawnSkillEffect) {
        this.renderer.spawnSkillEffect(
          s.element === 'fire' || s.element === 'earth' ? 'fireball' : 'shockwave',
          { x: s.x, y: 0.35, z: s.z },
          0,
          { color: s.color, radius: s.radius }
        );
        this.renderer.spawnShockwave?.({ x: s.x, y: 0.12, z: s.z }, s.color, s.radius);
        this.renderer.shake?.(0.32, 0.22);
      }
      const dist = Math.hypot(px - s.x, pz - s.z);
      if (dist <= s.radius + 0.45) {
        const cb = Object.keys(s.callbacks || {}).length > 0 ? s.callbacks : callbacks;
        this._dealDamageToPlayer(s.sourceEnemy, s.damage, s.element, cb);
        if (s.statusId && typeof cb?.applyPlayerStatus === 'function') {
          cb.applyPlayerStatus(s.statusId, s.statusDuration, s.statusPower);
        }
        if (s.knockback) {
          this._nudgePlayer(s.x, s.z, s.knockback, s.world);
        }
      }
    }
  }

  _canEmitMobShockwave(enemy) {
    if (enemy?.isBoss || enemy?.isElite || enemy?.isGiant) return true;
    if (this._frameMobShockwaves >= 2) return false;
    this._frameMobShockwaves++;
    return true;
  }

  _canEmitMobSparks(enemy) {
    if (enemy?.isBoss || enemy?.isElite || enemy?.isGiant) return true;
    if (this._frameMobSparks >= 3) return false;
    this._frameMobSparks++;
    return true;
  }

  _executeBossSpecialSkill(boss, px, pz, world, callbacks) {
    const skill = boss.pendingSkill || 'shockwave';
    const dist = Math.hypot(px - boss.x, pz - boss.z);
    const radialShot = (count, spreadArc, kind, dmgMult, el, color, opts = {}) => {
      const baseAngle = Math.atan2(px - boss.x, pz - boss.z);
      for (let i = 0; i < count; i++) {
        const offset = count === 1 ? 0 : spreadArc * ((i / (count - 1)) - 0.5);
        const a = baseAngle + offset;
        this._spawnEnemyProjectile(
          boss,
          boss.x + Math.sin(a) * 14,
          boss.z + Math.cos(a) * 14,
          kind,
          Math.round(boss.atk * dmgMult),
          el,
          callbacks,
          { color, ...opts }
        );
      }
    };

    if (skill === 'shockwave' || skill === 'nova' || skill === 'tiger_roar_ring' || skill === 'savage_roar' || skill === 'infernal_nova' || skill === 'infernal_roar' || skill === 'poison_nova') {
      const radius = skill === 'tiger_roar_ring' || skill === 'savage_roar' ? 5.2 : skill === 'infernal_nova' || skill === 'infernal_roar' ? 5.8 : skill === 'poison_nova' ? 5.2 : skill === 'nova' ? 4.8 : 4.0;
      const fxCol = skill === 'poison_nova' ? 0x22c55e : (skill === 'tiger_roar_ring' || skill === 'savage_roar') ? 0xf97316 : boss.element === 'fire' ? 0xff4400 : boss.element === 'lightning' ? 0xfacc15 : 0xef4444;
      if (this.renderer?.spawnSkillEffect) {
        this.renderer.spawnSkillEffect('shockwave', boss.position, 0, { color: fxCol, radius });
        this.renderer.shake?.(0.4, 0.28);
      }
      if (dist <= radius) {
        this._dealDamageToPlayer(boss, Math.round(boss.atk * (skill === 'infernal_nova' ? 1.85 : 1.55)), boss.element, callbacks);
        if (skill === 'savage_roar' || skill === 'infernal_roar') {
          this._nudgePlayer(boss.x, boss.z, 1.4, world);
        }
        if ((skill === 'tiger_roar_ring' || skill === 'savage_roar' || skill === 'infernal_nova' || skill === 'infernal_roar') && typeof callbacks?.applyPlayerStatus === 'function') {
          callbacks.applyPlayerStatus('burn', 3.5, Math.round(boss.atk * 0.2));
        } else if (skill === 'poison_nova' && typeof callbacks?.applyPlayerStatus === 'function') {
          callbacks.applyPlayerStatus('poison', 4.5, Math.round(boss.atk * 0.22));
        }
      }
    } else if (skill === 'flame_claw_leap' || skill === 'tiger_claw_frenzy' || skill === 'dash_strike') {
      const radius = 4.0;
      this.renderer?.spawnSkillEffect?.('shockwave', boss.position, 0, { color: boss.element === 'lightning' ? 0x38bdf8 : 0xff5500, radius });
      this.renderer?.spawnHitSparks?.(boss.position, 0xfb923c, 18);
      if (dist <= radius) {
        this._dealDamageToPlayer(boss, Math.round(boss.atk * 1.65), boss.element || 'fire', callbacks);
        callbacks?.applyPlayerStatus?.('bleed', 3.5, Math.round(boss.atk * 0.2));
      }
    } else if (skill === 'tiger_dark_curse') {
      radialShot(5, 1.15, 'orb', 1.05, 'poison', 0xa855f7, { isPoison: true });
      if (dist <= 4.5) {
        callbacks?.applyPlayerStatus?.('slow', 3.2, 35);
      }
    } else if (skill === 'uruchi_drake_breath') {
      radialShot(5, 0.95, 'orb', 1.1, 'fire', 0xf97316);
      this.renderer?.spawnSkillEffect?.('shockwave', boss.position, 0, { color: 0xea580c, radius: 4.0 });
      if (dist <= 4.0) {
        this._dealDamageToPlayer(boss, Math.round(boss.atk * 1.55), 'fire', callbacks);
        callbacks?.applyPlayerStatus?.('burn', 3.5, Math.round(boss.atk * 0.2));
        this._nudgePlayer(boss.x, boss.z, 1.35, world);
      }
    } else if (skill === 'uruchi_whirlwind') {
      const radius = 4.2;
      this.renderer?.spawnSkillEffect?.('shockwave', boss.position, 0, { color: 0xf97316, radius });
      this.renderer?.shake?.(0.36, 0.25);
      if (dist <= radius) {
        this._dealDamageToPlayer(boss, Math.round(boss.atk * 1.75), 'physical', callbacks);
        callbacks?.applyPlayerStatus?.('bleed', 4.0, Math.round(boss.atk * 0.22));
      }
    } else if (skill === 'bandit_ambush_volley') {
      radialShot(5, 0.85, 'arrow', 0.95, 'physical', 0xf59e0b);
    } else if (skill === 'earth_splitter') {
      const radius = 4.5;
      this.renderer?.spawnSkillEffect?.('shockwave', boss.position, 0, { color: 0xb45309, radius });
      radialShot(3, 0.5, 'orb', 1.15, 'earth', 0xd97706);
      if (dist <= radius) this._dealDamageToPlayer(boss, Math.round(boss.atk * 1.55), 'earth', callbacks);
    } else if (skill === 'isyutaru_ice_mirror_shield') {
      boss.reflectShieldTimer = 4.5;
      this.renderer?.spawnAura?.(boss.position, 0x7dd3fc, 'mana');
      this.renderer?.spawnSkillEffect?.('shockwave', boss.position, 0, { color: 0x38bdf8, radius: 3.8 });
      if (dist <= 3.8) {
        this._dealDamageToPlayer(boss, Math.round(boss.atk * 1.35), 'ice', callbacks);
        callbacks?.applyPlayerStatus?.('chill', 3.5, 45);
      }
    } else if (skill === 'isyutaru_blizzard' || skill === 'frost_prison_nova') {
      const radius = skill === 'isyutaru_blizzard' ? 5.4 : 4.4;
      this.renderer?.spawnSkillEffect?.('shockwave', boss.position, 0, { color: 0x38bdf8, radius });
      this.renderer?.shake?.(0.35, 0.25);
      if (dist <= radius) {
        this._dealDamageToPlayer(boss, Math.round(boss.atk * 1.45), 'ice', callbacks);
        callbacks?.applyPlayerStatus?.('chill', 4.0, 50);
      }
      if (skill === 'isyutaru_blizzard') {
        for (let i = 0; i < 3; i++) {
          this._queueGroundStrike({
            sourceEnemy: boss,
            x: px + (i === 0 ? 0 : (Math.random() - 0.5) * 4.2),
            z: pz + (i === 0 ? 0 : (Math.random() - 0.5) * 4.2),
            radius: 2.5,
            delay: 0.72 + i * 0.2,
            damage: Math.round(boss.atk * 1.25),
            element: 'ice',
            color: 0x7dd3fc,
            statusId: 'chill',
            statusDuration: 3.5,
            statusPower: 45,
            world,
            callbacks
          });
        }
      }
    } else if (skill === 'ice_lance_barrage') {
      radialShot(6, 1.35, 'orb', 1.0, 'ice', 0x38bdf8);
    } else if (skill === 'yarkan_magma_eruption') {
      radialShot(4, 0.9, 'orb', 1.05, 'fire', 0xf97316);
      for (let i = 0; i < 3; i++) {
        this._queueGroundStrike({
          sourceEnemy: boss,
          x: px + (i === 0 ? 0 : (Math.random() - 0.5) * 4.6),
          z: pz + (i === 0 ? 0 : (Math.random() - 0.5) * 4.6),
          radius: 2.8,
          delay: 0.78 + i * 0.18,
          damage: Math.round(boss.atk * 1.4),
          element: 'fire',
          color: 0xf97316,
          statusId: 'burn',
          statusDuration: 3.5,
          statusPower: Math.round(boss.atk * 0.22),
          knockback: 0.85,
          world,
          callbacks
        });
      }
    } else if (skill === 'yarkan_sandstorm' || skill === 'desert_earthquake') {
      const radius = skill === 'yarkan_sandstorm' ? 6.4 : 5.0;
      this.renderer?.spawnSkillEffect?.('shockwave', boss.position, 0, { color: 0xfacc15, radius });
      this.renderer?.shake?.(0.45, 0.32);
      if (skill === 'yarkan_sandstorm' && dist <= 7.2 && dist > 1.8) {
        // Vortex pulls player inward toward Lord Yarkan
        this._nudgePlayer(boss.x, boss.z, -1.65, world);
      }
      if (dist <= radius) {
        this._dealDamageToPlayer(boss, Math.round(boss.atk * 1.7), 'earth', callbacks);
        callbacks?.applyPlayerStatus?.('slow', 3.5, 45);
      }
    } else if (skill === 'solar_spear_volley') {
      radialShot(5, 0.85, 'arrow', 1.12, 'fire', 0xfde047);
    } else if (skill === 'hellfire_meteor_rain') {
      for (let i = 0; i < 4; i++) {
        this._queueGroundStrike({
          sourceEnemy: boss,
          x: px + (i === 0 ? 0 : (Math.random() - 0.5) * 5.2),
          z: pz + (i === 0 ? 0 : (Math.random() - 0.5) * 5.2),
          radius: 2.9,
          delay: 0.68 + i * 0.2,
          damage: Math.round(boss.atk * 1.38),
          element: 'fire',
          color: 0xdc2626,
          statusId: 'burn',
          statusDuration: 4.0,
          statusPower: Math.round(boss.atk * 0.25),
          knockback: 1.0,
          world,
          callbacks
        });
      }
      this.renderer?.shake?.(0.45, 0.32);
    } else if (skill === 'venom_gaze' || skill === 'petrify_gaze') {
      const radius = 5.4;
      this.renderer?.spawnSkillEffect?.('shockwave', boss.position, 0, { color: 0x22c55e, radius });
      if (dist <= radius) {
        this._dealDamageToPlayer(boss, Math.round(boss.atk * 1.55), 'poison', callbacks);
        callbacks?.applyPlayerStatus?.(skill === 'petrify_gaze' ? 'slow' : 'poison', 4.5, 55);
      } else {
        this._spawnEnemyProjectile(boss, px, pz, 'orb', Math.round(boss.atk * 1.4), 'poison', callbacks, { isPoison: true, color: 0x22c55e });
      }
    } else if (skill === 'viper_orb_fan') {
      radialShot(5, 0.95, 'orb', 1.0, 'poison', 0x4ade80, { isPoison: true });
    } else if (skill === 'serpent_coil_slam') {
      const radius = 4.4;
      this.renderer?.spawnSkillEffect?.('shockwave', boss.position, 0, { color: 0x16a34a, radius });
      if (dist <= radius) {
        this._dealDamageToPlayer(boss, Math.round(boss.atk * 1.65), 'poison', callbacks);
        callbacks?.applyPlayerStatus?.('poison', 4.0, Math.round(boss.atk * 0.2));
        this._nudgePlayer(boss.x, boss.z, 1.4, world);
      }
    } else if (skill === 'roc_hurricane_gale') {
      const radius = 6.5;
      this.renderer?.spawnSkillEffect?.('shockwave', boss.position, 0, { color: 0x38bdf8, radius });
      this.renderer?.shake?.(0.55, 0.38);
      if (dist <= radius) {
        this._dealDamageToPlayer(boss, Math.round(boss.atk * 1.85), 'lightning', callbacks);
        callbacks?.applyPlayerStatus?.('slow', 3.2, 42);
        this._nudgePlayer(boss.x, boss.z, 1.9, world);
      }
    } else if (skill === 'roc_wing_slam') {
      const radius = 4.8;
      this.renderer?.spawnSkillEffect?.('shockwave', boss.position, 0, { color: 0xfacc15, radius });
      radialShot(5, 1.4, 'arrow', 1.05, 'lightning', 0x38bdf8);
      if (dist <= radius) {
        this._dealDamageToPlayer(boss, Math.round(boss.atk * 1.75), 'physical', callbacks);
        this._nudgePlayer(boss.x, boss.z, 1.75, world);
      }
    } else if (skill === 'sky_feather_storm') {
      radialShot(7, 1.65, 'arrow', 1.02, 'lightning', 0x7dd3fc);
    } else if (skill === 'thunder_judgment') {
      radialShot(4, 0.72, 'orb', 1.15, 'lightning', 0xfacc15);
      for (let i = 0; i < 3; i++) {
        this._queueGroundStrike({
          sourceEnemy: boss,
          x: px + (i === 0 ? 0 : (Math.random() - 0.5) * 4.4),
          z: pz + (i === 0 ? 0 : (Math.random() - 0.5) * 4.4),
          radius: 3.1,
          delay: 0.72 + i * 0.18,
          damage: Math.round(boss.atk * 1.65),
          element: 'lightning',
          color: 0xfacc15,
          statusId: 'shock',
          statusDuration: 3.5,
          statusPower: 25,
          world,
          callbacks
        });
      }
    } else if (skill === 'earth_stomp') {
      const radius = 3.8;
      if (this.renderer?.spawnSkillEffect && this._canEmitMobShockwave(boss)) {
        this.renderer.spawnSkillEffect('shockwave', boss.position, 0, { color: 0xa16207, radius });
      }
      if (dist <= radius) {
        this._dealDamageToPlayer(boss, Math.round(boss.atk * 1.35), 'earth', callbacks);
        if (typeof callbacks?.applyPlayerStatus === 'function') {
          callbacks.applyPlayerStatus('slow', 3.0, 30);
        }
      }
    } else if (skill === 'frost_wave') {
      const radius = 4.2;
      if (this.renderer?.spawnSkillEffect && this._canEmitMobShockwave(boss)) {
        this.renderer.spawnSkillEffect('shockwave', boss.position, 0, { color: 0x38bdf8, radius });
      }
      if (dist <= radius) {
        this._dealDamageToPlayer(boss, Math.round(boss.atk * 1.3), 'ice', callbacks);
        if (typeof callbacks?.applyPlayerStatus === 'function') {
          callbacks.applyPlayerStatus('chill', 3.5, 40);
        }
      } else {
        this._spawnEnemyProjectile(boss, px, pz, 'orb', Math.round(boss.atk * 1.3), 'ice', callbacks, { color: 0x38bdf8 });
      }
    } else if (skill === 'powder_blast') {
      if (this.renderer?.spawnSkillEffect && this._canEmitMobShockwave(boss)) {
        this.renderer.spawnSkillEffect('fireball', { x: px, y: 0.5, z: pz }, 0, { color: 0xea580c, radius: 2.8 });
      }
      if (dist <= 3.2) {
        this._dealDamageToPlayer(boss, Math.round(boss.atk * 1.4), 'fire', callbacks);
      } else {
        this._spawnEnemyProjectile(boss, px, pz, 'orb', Math.round(boss.atk * 1.38), 'fire', callbacks, { color: 0xea580c, speed: 15.5 });
      }
    } else if (skill === 'poison_arrow') {
      this._spawnEnemyProjectile(boss, px, pz, 'arrow', Math.round(boss.atk * 1.25), 'poison', callbacks, { isPoison: true, color: 0x22c55e });
    } else if (skill === 'arrow_volley') {
      const dx = px - boss.x;
      const dz = pz - boss.z;
      const baseAngle = Math.atan2(dx, dz);
      for (const off of [-0.22, 0, 0.22]) {
        const a = baseAngle + off;
        const tx = boss.x + Math.sin(a) * 12;
        const tz = boss.z + Math.cos(a) * 12;
        this._spawnEnemyProjectile(boss, tx, tz, 'arrow', Math.round(boss.atk * 0.95), 'physical', callbacks);
      }
    } else if (skill === 'acid_spit') {
      this._spawnEnemyProjectile(boss, px, pz, 'orb', Math.round(boss.atk * 1.2), 'poison', callbacks, { isPoison: true, color: 0x84cc16 });
    } else if (skill === 'whirlwind_strike') {
      const radius = 2.8;
      if (this.renderer?.spawnSkillEffect && this._canEmitMobShockwave(boss)) {
        this.renderer.spawnSkillEffect('shockwave', boss.position, 0, { color: 0xf59e0b, radius });
      }
      if (dist <= radius) {
        this._dealDamageToPlayer(boss, Math.round(boss.atk * 1.4), 'physical', callbacks);
      }
    } else if (skill === 'curse_drain' || skill === 'abyssal_soul_drain' || skill === 'shaitan_soul_siphon') {
      const range = skill === 'curse_drain' ? (boss.isBoss ? 14.5 : 12.5) : 15.5;
      if (this.renderer?.spawnSkillEffect && this._canEmitMobSparks(boss)) {
        this.renderer.spawnSkillEffect('spark', { x: px, y: 1.0, z: pz }, 0, { color: 0xa855f7 });
      }
      if (dist <= range) {
        const drainDmg = Math.round(boss.atk * (skill === 'curse_drain' ? 1.2 : 1.55));
        this._dealDamageToPlayer(boss, drainDmg, 'dark', callbacks);
        boss.hp = Math.min(boss.maxHp, boss.hp + Math.round(drainDmg * 0.5));
        boss.syncHealthBar?.(this.renderer?.camera);
      }
    } else if (skill === 'summon' || skill === 'whitetiger_pack') {
      this._spawnUniqueSummonWave(boss, Math.max(0.1, boss.hp / Math.max(1, boss.maxHp)), world);
    } else if (skill === 'slash' || skill === 'cleave_sweep' || skill === 'shadow_lash' || skill === 'witch_claw' || skill === 'tiger_rend' || skill === 'double_pebble_snap' || skill === 'feral_nip' || skill === 'venom_sting' || skill === 'stone_smash') {
      const reach = skill === 'cleave_sweep' || skill === 'stone_smash' ? boss.attackRange + 1.55 : boss.attackRange + 1.1;
      const fxCol = skill === 'shadow_lash' ? 0x818cf8 : skill === 'witch_claw' || skill === 'venom_sting' ? 0x22c55e : skill === 'stone_smash' ? 0x94a3b8 : 0xf59e0b;
      if (this._canEmitMobShockwave(boss)) {
        this.renderer?.spawnSkillEffect?.('shockwave', boss.position, 0, { color: fxCol, radius: reach * 0.95 });
      }
      if (this._canEmitMobSparks(boss)) {
        this.renderer?.spawnHitSparks?.(boss.position, fxCol, 10);
      }
      if (dist <= reach) {
        const mult = (skill === 'cleave_sweep' || skill === 'stone_smash' || skill === 'tiger_rend') ? 1.48 : skill === 'double_pebble_snap' ? 1.38 : 1.3;
        this._dealDamageToPlayer(boss, Math.round(boss.atk * mult), boss.element || 'physical', callbacks);
        if ((skill === 'feral_nip' || skill === 'tiger_rend') && typeof callbacks?.applyPlayerStatus === 'function') {
          callbacks.applyPlayerStatus('bleed', 3.2, Math.max(2, Math.round(boss.atk * 0.14)));
        } else if ((skill === 'venom_sting' || skill === 'witch_claw') && typeof callbacks?.applyPlayerStatus === 'function') {
          callbacks.applyPlayerStatus('poison', 4.0, Math.max(2, Math.round(boss.atk * 0.14)));
        } else if (skill === 'stone_smash') {
          this._nudgePlayer(boss.x, boss.z, 0.85, world);
        }
      }
    } else if (skill === 'earth_shatter' || skill === 'roar_shockwave') {
      const radius = skill === 'roar_shockwave' ? 4.2 : 3.6;
      const fxCol = skill === 'roar_shockwave' ? 0xe2e8f0 : 0xb45309;
      if (this._canEmitMobShockwave(boss)) {
        this.renderer?.spawnSkillEffect?.('shockwave', boss.position, 0, { color: fxCol, radius });
      }
      this.renderer?.shake?.(0.32, 0.2);
      if (dist <= radius) {
        this._dealDamageToPlayer(boss, Math.round(boss.atk * 1.52), skill === 'roar_shockwave' ? (boss.element || 'ice') : 'earth', callbacks);
        callbacks?.applyPlayerStatus?.('slow', 3.0, 32);
        this._nudgePlayer(boss.x, boss.z, 1.0, world);
      }
    } else if (skill === 'soul_bolt' || skill === 'aqua_splash' || skill === 'spirit_stare') {
      const el = skill === 'aqua_splash' ? 'ice' : 'dark';
      const col = skill === 'aqua_splash' ? 0x38bdf8 : skill === 'spirit_stare' ? 0x818cf8 : 0xa855f7;
      this._spawnEnemyProjectile(boss, px, pz, 'orb', Math.round(boss.atk * 1.25), el, callbacks, { color: col });
      if (skill === 'spirit_stare' && dist <= 5.5) {
        callbacks?.applyPlayerStatus?.('slow', 2.6, 25);
      } else if (skill === 'aqua_splash' && dist <= 5.5) {
        callbacks?.applyPlayerStatus?.('chill', 3.0, 35);
      }
    } else if (skill === 'pounce' || skill === 'charge' || skill === 'quick_lunge' || skill === 'ram_tackle') {
      if (this._canEmitMobSparks(boss)) {
        this.renderer?.spawnHitSparks?.(boss.position, boss.color || 0xf59e0b, 8);
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
    if (enemy?.modifier?.lifesteal && result && !result.dodged && result.damage > 0) {
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

    if (isPlayerDead && enemy && !enemy.isBoss && !enemy.isArenaHazard) {
      const currentFloor = this.currentFloor || enemy.floor || 1;
      gs?.registerNemesisFromKill?.(enemy, currentFloor);
    }
  }
}

export function createEnemyManager(options, models3d, data) {
  return new EnemyManager(options, models3d, data);
}

export default EnemyManager;

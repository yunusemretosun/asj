import * as THREE from 'three';
import { RARITY_BEAMS, HOT_SPRINGS } from '../systems/mechanics.js';
import {
  models3d as defaultModels3d,
  createNPCMesh,
  createChestMesh,
  createPortalMesh,
  createBreakableMesh,
  createLootMesh,
  createTorchMesh,
  createTrapMesh,
  createSwitchMesh,
  createStairsMesh,
  disposeObject3D
} from '../engine/models3d.js';
import { buildVillage } from './villageBuilder.js';
import {
  InstanceBatch,
  styleFor,
  tint,
  nearOpening,
  bestCorner,
  decorateFloor,
  dressSpecialRoom,
  buildVaultAlcove,
  decorateBossArenaProps,
  addTorchInstance,
  buildBellMesh,
  buildSteleMesh,
  buildPuzzleStatueMesh,
  buildAltarMesh,
  BELL_PITCHES,
  createSilkroadCofferMesh,
  loadSROProp,
  SRO_DUNGEON_PROPS,
  resolveSroDungeon
} from './dungeonDecor.js';

const LIGHT_POOL_SIZE = 8;
export const MIN_DUNGEON_LEVEL = 10;

// Tile constants for grid collision and minimap
export const TILE = {
  VOID: 0,
  FLOOR: 1,
  WALL: 2,
  CORRIDOR: 3,
  DOOR_CLOSED: 4,
  DOOR_OPEN: 5,
  PIT: 6,
  WATER: 7
};

export const SPECIAL_ROOM_CYCLE = ['vault', 'shrine', 'processional', 'trap_gallery', 'celestial_spring'];

export const DUNGEON_THEMES = {
  village: {
    id: 'village',
    name: 'Oakhaven Village',
    subtitle: 'Safe Haven & Adventurer Hub',
    decor: 'village',
    atmosphere: {
      fogColor: 0x1e293b,
      fogNear: 75,
      fogFar: 210,
      ambientColor: 0xe2e8f0,
      ambientIntensity: 1.25,
      keyLightColor: 0xfffbeb,
      keyLightIntensity: 1.45,
      dust: false,
      weather: 'petals',
      weatherColor: 0xfbcfe8
    },
    floorColor: 0x5c7a52,
    pathColor: 0x8b9bb0,
    wallColor: 0x73849a,
    trimColor: 0xb8c7d9,
    torchColor: 0xffbb55,
    portalColor: 0x38bdf8,
    ambientColor: 0xdbeafe,
    fogColor: 0x1e293b,
    element: 'physical',
    breakableTypes: ['barrel', 'crate']
  },
  cave: {
    id: 'cave',
    name: 'Donwhang Stone Cave',
    subtitle: 'Donwhang Taş Mağarası — Webbed Galleries & Stone Relics',
    decor: 'cave',
    atmosphere: {
      fogColor: 0x161c18,
      fogNear: 24,
      fogFar: 70,
      ambientColor: 0xdcfce7,
      ambientIntensity: 0.96,
      keyLightColor: 0xfef08a,
      keyLightIntensity: 1.25,
      dust: true,
      weather: 'spores',
      weatherColor: 0x86efac
    },
    floorColor: 0x8a7965,
    altFloorColor: 0x766754,
    floorTexture: '/assets/sro/dun/tex/donhwang_floor.png',
    wallTexture: '/assets/sro/dun/tex/donhwang_wall.png',
    wallColor: 0x9c8870,
    trimColor: 0xbba488,
    torchColor: 0xffaa44,
    portalColor: 0x38bdf8,
    ambientColor: 0xdcfce7,
    fogColor: 0x161c18,
    element: 'physical',
    trapTypes: ['spikes', 'poison'],
    breakableTypes: ['barrel', 'crate']
  },
  crypt: {
    id: 'crypt',
    name: 'Black Robber Stronghold',
    subtitle: 'Karakoram & Black Robber Mağarası — Bandit Catacombs',
    decor: 'crypt',
    atmosphere: {
      fogColor: 0x101829,
      fogNear: 21,
      fogFar: 64,
      ambientColor: 0xa5b4fc,
      ambientIntensity: 0.92,
      keyLightColor: 0x38bdf8,
      keyLightIntensity: 1.18,
      dust: true,
      weather: 'mist',
      weatherColor: 0x94a3b8
    },
    floorColor: 0x5c6b7e,
    altFloorColor: 0x455263,
    floorTexture: '/assets/sro/dun/tex/karakoram_floor.png',
    wallTexture: '/assets/sro/dun/tex/karakoram_wall.png',
    wallColor: 0x718196,
    trimColor: 0x9db0c7,
    torchColor: 0x38bdf8,
    portalColor: 0x818cf8,
    ambientColor: 0xa5b4fc,
    fogColor: 0x101829,
    element: 'poison',
    trapTypes: ['spikes', 'poison', 'ice'],
    breakableTypes: ['urn', 'barrel', 'crate']
  },
  ruins: {
    id: 'ruins',
    name: "Qin-Shi Emperor's Tomb",
    subtitle: 'Qin-Shi İmparatoru Mezarlığı — Terracotta & Jade Chambers',
    decor: 'ruins',
    atmosphere: {
      fogColor: 0x1a1a16,
      fogNear: 24,
      fogFar: 72,
      ambientColor: 0xfef08a,
      ambientIntensity: 1.05,
      keyLightColor: 0xfde047,
      keyLightIntensity: 1.30,
      dust: true,
      weather: 'incense',
      weatherColor: 0xfde047
    },
    floorColor: 0x617d72,
    altFloorColor: 0x4f695f,
    floorTexture: '/assets/sro/dun/tex/qinshi_floor.png',
    wallTexture: '/assets/sro/dun/tex/qinshi_wall.png',
    wallColor: 0x78968a,
    trimColor: 0xb8a369,
    torchColor: 0xfde047,
    portalColor: 0x22d3ee,
    ambientColor: 0xfef08a,
    fogColor: 0x1a1a16,
    element: 'lightning',
    trapTypes: ['spikes', 'lightning', 'ice'],
    breakableTypes: ['urn', 'barrel', 'crate']
  },
  lava: {
    id: 'lava',
    name: 'Flame Mountain',
    subtitle: 'Alev Dağı İçinde — Volcanic Basalt & Caldera Vaults',
    decor: 'lava',
    atmosphere: {
      fogColor: 0x261409,
      fogNear: 22,
      fogFar: 65,
      ambientColor: 0xfed7aa,
      ambientIntensity: 0.96,
      keyLightColor: 0xfb923c,
      keyLightIntensity: 1.30,
      dust: true,
      weather: 'sand',
      weatherColor: 0xd97706
    },
    floorColor: 0x844b40,
    altFloorColor: 0x6f3e35,
    floorTexture: '/assets/sro/dun/tex/flame_floor.png',
    wallTexture: '/assets/sro/dun/tex/flame_wall.png',
    wallColor: 0x9b5a4d,
    trimColor: 0xc97362,
    torchColor: 0xf59e0b,
    portalColor: 0xfb923c,
    ambientColor: 0xfed7aa,
    fogColor: 0x261409,
    element: 'fire',
    trapTypes: ['fire', 'spikes'],
    breakableTypes: ['urn', 'barrel', 'crate']
  },
  boss: {
    id: 'boss',
    name: 'Jupiter & Shambhala Sanctum',
    subtitle: 'Kutsal Su, Jupiter Tapınağı & Roc Dağı Zirvesi',
    decor: 'abyss',
    atmosphere: {
      fogColor: 0x1c0d14,
      fogNear: 21,
      fogFar: 66,
      ambientColor: 0xfecaca,
      ambientIntensity: 0.98,
      keyLightColor: 0xef4444,
      keyLightIntensity: 1.28,
      dust: true,
      weather: 'embers',
      weatherColor: 0xef4444
    },
    floorColor: 0x6d5687,
    altFloorColor: 0x594570,
    floorTexture: '/assets/sro/dun/tex/jupiter_floor.png',
    wallTexture: '/assets/sro/dun/tex/jupiter_wall.png',
    wallColor: 0x846aa1,
    trimColor: 0xd4af37,
    torchColor: 0xef4444,
    portalColor: 0xf87171,
    ambientColor: 0xfecaca,
    fogColor: 0x1c0d14,
    element: 'dark',
    trapTypes: ['lightning', 'fire', 'spikes'],
    breakableTypes: ['urn', 'barrel']
  }
};

export const FLOOR_DEFINITIONS = [
  // recommendedLevel mirrors floorMonsterLevel(floor) in src/systems/inventory.js (monster level & loot tier)
  {
    floor: 1, name: 'Donwhang Stone Cave B1F', sroDungeon: 'donhwang', decorProfile: 'donhwang_b1', layoutStyle: 'cavern_branch',
    subtitle: 'Donwhang Taş Mağarası -1. Kat — Entrance Galleries',
    theme: 'cave', recommendedLevel: 1, isBossFloor: false,
    portalStyle: 'jade_gate',
    floorTexture: '/assets/sro/dun/tex/donhwang_floor.png', wallTexture: '/assets/sro/dun/tex/donhwang_wall.png',
    themeOverride: { floorColor: 0x6f7368, altFloorColor: 0x5c6055, wallColor: 0x868a7c, trimColor: 0x7aa874, torchColor: 0x4ade80, portalColor: 0x38bdf8 },
    atmosphere: { fogColor: 0x101815, fogNear: 20, fogFar: 62, ambientColor: 0xd1fae5, ambientIntensity: 0.98, keyLightColor: 0x6ee7b7, keyLightIntensity: 1.24, weather: 'spores', weatherColor: 0x6ee7b7 },
    monsterTypes: ['mangyang', 'gyo_weasel', 'bigeye_ghost', 'tiger', 'bug_ghost', 'water_ghost', 'yeoha', 'work_earth_ghost']
  },
  {
    floor: 2, name: 'Donwhang Stone Cave B2F — Earth Vaults', sroDungeon: 'donhwang', decorProfile: 'donhwang_b2', layoutStyle: 'cavern_branch',
    subtitle: 'Donwhang Taş Mağarası -2. Kat — Earth Ghosts & Buddha Alcoves',
    theme: 'cave', recommendedLevel: 3, isBossFloor: false,
    portalStyle: 'amber_cavern',
    floorTexture: '/assets/sro/dun/tex/donhwang_floor.png', wallTexture: '/assets/sro/dun/tex/donhwang_wall.png',
    themeOverride: { floorColor: 0x7a6d59, altFloorColor: 0x635746, wallColor: 0x8f7e67, trimColor: 0xd4a359, torchColor: 0xf59e0b, portalColor: 0xfbbf24 },
    atmosphere: { fogColor: 0x19150d, fogNear: 19, fogFar: 60, ambientColor: 0xfef3c7, ambientIntensity: 0.94, keyLightColor: 0xfbbf24, keyLightIntensity: 1.26, weather: 'spores', weatherColor: 0xf59e0b },
    monsterTypes: ['bug_ghost', 'work_earth_ghost', 'soldier_earth_ghost', 'earth_ghost', 'stone_ghost', 'blindmon', 'yeoha', 'bandit', 'bandit_archer']
  },
  {
    floor: 3, name: 'Donwhang Stone Cave B3F — Tiger Lair', sroDungeon: 'donhwang', decorProfile: 'donhwang_b3', layoutStyle: 'cavern_branch',
    subtitle: 'Donwhang Taş Mağarası -3. Kat — Lair of Tiger Girl',
    theme: 'cave', recommendedLevel: 5, isBossFloor: true, bossId: 'tiger_girl', bossName: 'Tiger Girl',
    portalStyle: 'crimson_tiger',
    floorTexture: '/assets/sro/dun/tex/donhwang_floor.png', wallTexture: '/assets/sro/dun/tex/donhwang_wall.png',
    themeOverride: { floorColor: 0x6e5f58, altFloorColor: 0x574a44, wallColor: 0x857168, trimColor: 0xea580c, torchColor: 0xf97316, portalColor: 0xf97316 },
    atmosphere: { fogColor: 0x1c110d, fogNear: 18, fogFar: 60, ambientColor: 0xfed7aa, ambientIntensity: 0.95, keyLightColor: 0xfb923c, keyLightIntensity: 1.32, weather: 'spores', weatherColor: 0xfb923c },
    monsterTypes: ['soldier_earth_ghost', 'blindmon', 'nachal', 'yacha', 'demon_horse', 'taese', 'chakji', 'stone_ghost', 'earth_ghost']
  },
  {
    floor: 4, name: 'Black Robber Den B4F', sroDungeon: 'karakoram', decorProfile: 'karakoram_b4', layoutStyle: 'stronghold_wing',
    subtitle: 'Black Robber Mağarası — Oasis & Karakorum Raider Outpost',
    theme: 'crypt', recommendedLevel: 9, isBossFloor: false,
    portalStyle: 'bandit_lantern',
    floorTexture: '/assets/sro/dun/tex/karakoram_floor.png', wallTexture: '/assets/sro/dun/tex/karakoram_wall.png',
    themeOverride: { floorColor: 0x6d6157, altFloorColor: 0x574c44, wallColor: 0x847467, trimColor: 0xd97706, torchColor: 0xf59e0b, portalColor: 0x38bdf8 },
    atmosphere: { fogColor: 0x17131c, fogNear: 20, fogFar: 62, ambientColor: 0xe2e8f0, ambientIntensity: 0.95, keyLightColor: 0xfde68a, keyLightIntensity: 1.24, weather: 'mist', weatherColor: 0x94a3b8 },
    monsterTypes: ['black_robber', 'black_robber_archer', 'red_eye_ghost', 'ong', 'scorpion', 'red_scorpion', 'desert_trunkz', 'bandit', 'bandit_archer']
  },
  {
    floor: 5, name: 'Karakoram Dark Cave B5F', sroDungeon: 'karakoram', decorProfile: 'karakoram_b5', layoutStyle: 'stronghold_wing',
    subtitle: 'Kara Mağara — Frozen Salt Crags & Yeti Caverns',
    theme: 'crypt', recommendedLevel: 13, isBossFloor: false,
    portalStyle: 'frost_runes',
    floorTexture: '/assets/sro/dun/tex/karakoram_floor.png', wallTexture: '/assets/sro/dun/tex/karakoram_wall.png',
    themeOverride: { floorColor: 0x58697c, altFloorColor: 0x465464, wallColor: 0x6f859c, trimColor: 0x38bdf8, torchColor: 0x67e8f9, portalColor: 0x67e8f9 },
    atmosphere: { fogColor: 0x0d1824, fogNear: 19, fogFar: 60, ambientColor: 0xcffafe, ambientIntensity: 0.98, keyLightColor: 0x7dd3fc, keyLightIntensity: 1.26, weather: 'mist', weatherColor: 0xbae6fd },
    monsterTypes: ['ishade', 'planar', 'yeti', 'penon_fighter', 'penon_warrior', 'snow_spider', 'white_spider', 'blue_tiger', 'white_tiger']
  },
  {
    floor: 6, name: 'Black Robber Citadel B6F', sroDungeon: 'karakoram', decorProfile: 'karakoram_b6', layoutStyle: 'stronghold_wing',
    subtitle: 'Karakoram Stronghold — Domain of Uruchi',
    theme: 'crypt', recommendedLevel: 17, isBossFloor: true, bossId: 'uruchi', bossName: 'Uruchi',
    portalStyle: 'obsidian_uruchi',
    floorTexture: '/assets/sro/dun/tex/karakoram_floor.png', wallTexture: '/assets/sro/dun/tex/karakoram_wall.png',
    themeOverride: { floorColor: 0x4f495f, altFloorColor: 0x3f394c, wallColor: 0x685f7d, trimColor: 0xa855f7, torchColor: 0xc084fc, portalColor: 0xa855f7 },
    atmosphere: { fogColor: 0x160f24, fogNear: 18, fogFar: 60, ambientColor: 0xe9d5ff, ambientIntensity: 0.94, keyLightColor: 0xc084fc, keyLightIntensity: 1.28, weather: 'mist', weatherColor: 0xc4b5fd },
    monsterTypes: ['red_scorpion', 'desert_trunkz', 'big_spider', 'yeowa', 'black_robber', 'black_robber_archer', 'penon_fighter', 'penon_warrior', 'yeti', 'white_tiger', 'blue_tiger', 'gunpowder_ghost']
  },
  {
    floor: 7, name: "Qin-Shi Emperor's Tomb B1F", sroDungeon: 'qinshi', decorProfile: 'qinshi_b7', layoutStyle: 'tomb_grid',
    subtitle: 'Qin-Shi İmparatoru Mezarlığı Seviye 1 — Terracotta Galleries',
    theme: 'ruins', recommendedLevel: 21, isBossFloor: false,
    portalStyle: 'terracotta_seal',
    floorTexture: '/assets/sro/dun/tex/qinshi_floor.png', wallTexture: '/assets/sro/dun/tex/qinshi_wall.png',
    themeOverride: { floorColor: 0x67756a, altFloorColor: 0x546157, wallColor: 0x7f8f83, trimColor: 0xc8a464, torchColor: 0xfde047, portalColor: 0x22d3ee },
    atmosphere: { fogColor: 0x171813, fogNear: 20, fogFar: 62, ambientColor: 0xfef08a, ambientIntensity: 0.96, keyLightColor: 0xfde047, keyLightIntensity: 1.26, weather: 'incense', weatherColor: 0xfef08a },
    monsterTypes: ['tombstone_ghost', 'tomb_stone_spirit', 'tomb_bug_ghost', 'bomb_stone_ghost', 'qinshi_tombstone', 'tomb_soldier', 'tomb_archer', 'tomb_general', 'royal_soldier']
  },
  {
    floor: 8, name: "Qin-Shi Emperor's Tomb B2F", sroDungeon: 'qinshi', decorProfile: 'qinshi_b8', layoutStyle: 'tomb_grid',
    subtitle: 'Qin-Shi İmparatoru Mezarlığı Seviye 2 — Serpent Lantern Wing',
    theme: 'ruins', recommendedLevel: 25, isBossFloor: false,
    portalStyle: 'jade_serpent',
    floorTexture: '/assets/sro/dun/tex/qinshi_floor.png', wallTexture: '/assets/sro/dun/tex/qinshi_wall.png',
    themeOverride: { floorColor: 0x4f7668, altFloorColor: 0x406155, wallColor: 0x669182, trimColor: 0x34d399, torchColor: 0x34d399, portalColor: 0x34d399 },
    atmosphere: { fogColor: 0x0e1c18, fogNear: 19, fogFar: 62, ambientColor: 0xa7f3d0, ambientIntensity: 0.95, keyLightColor: 0x6ee7b7, keyLightIntensity: 1.28, weather: 'incense', weatherColor: 0x34d399 },
    monsterTypes: ['snake_slave', 'snake_man', 'snake_demon', 'snake_general', 'snake_woman', 'black_snake', 'tomb_soldier', 'tomb_archer', 'devil_bug']
  },
  {
    floor: 9, name: "Qin-Shi Emperor's Tomb B3F — Snake Sanctum", sroDungeon: 'qinshi', decorProfile: 'qinshi_b9', layoutStyle: 'tomb_grid',
    subtitle: 'Qin-Shi Mezarlığı Merkez Mağara — Sanctum of Isyutaru',
    theme: 'ruins', recommendedLevel: 28, isBossFloor: true, bossId: 'isyutaru', bossName: 'Isyutaru',
    portalStyle: 'imperial_tetra',
    floorTexture: '/assets/sro/dun/tex/qinshi_floor.png', wallTexture: '/assets/sro/dun/tex/qinshi_wall.png',
    themeOverride: { floorColor: 0x5c687a, altFloorColor: 0x4a5463, wallColor: 0x738296, trimColor: 0xfacc15, torchColor: 0x38bdf8, portalColor: 0x38bdf8 },
    atmosphere: { fogColor: 0x101826, fogNear: 18, fogFar: 63, ambientColor: 0xbae6fd, ambientIntensity: 0.97, keyLightColor: 0x60a5fa, keyLightIntensity: 1.32, weather: 'incense', weatherColor: 0x67e8f9 },
    monsterTypes: ['east_guardian', 'west_guardian', 'north_guardian', 'south_guardian', 'royal_soldier', 'tomb_general', 'snake_general', 'snake_woman', 'hyungno']
  },
  {
    floor: 10, name: 'Flame Mountain B10F — Ash Passage', sroDungeon: 'flame', decorProfile: 'flame_b10', layoutStyle: 'caldera_ring',
    subtitle: 'Alev Dağı İçinde — Scorched Taklamakan Border',
    theme: 'lava', recommendedLevel: 32, isBossFloor: false,
    portalStyle: 'ember_caldera',
    floorTexture: '/assets/sro/dun/tex/flame_floor.png', wallTexture: '/assets/sro/dun/tex/flame_wall.png',
    themeOverride: { floorColor: 0x875043, altFloorColor: 0x6f4136, wallColor: 0x9e5f50, trimColor: 0xf59e0b, torchColor: 0xfb923c, portalColor: 0xfb923c },
    atmosphere: { fogColor: 0x261409, fogNear: 21, fogFar: 64, ambientColor: 0xfed7aa, ambientIntensity: 0.96, keyLightColor: 0xfb923c, keyLightIntensity: 1.30, weather: 'sand', weatherColor: 0xf59e0b },
    monsterTypes: ['flame_ghost', 'flame_evil', 'flame_salamander', 'flame_witch', 'flame_archer', 'ghost_bug', 'devil_bug']
  },
  {
    floor: 11, name: 'Flame Mountain B11F — Magma Galleries', sroDungeon: 'flame', decorProfile: 'flame_b11', layoutStyle: 'caldera_ring',
    subtitle: 'Alev Dağı İçinde — Volcanic Basalt & Death Bone Necropolis',
    theme: 'lava', recommendedLevel: 36, isBossFloor: false,
    portalStyle: 'ossuary_pyre',
    floorTexture: '/assets/sro/dun/tex/flame_floor.png', wallTexture: '/assets/sro/dun/tex/flame_wall.png',
    themeOverride: { floorColor: 0x6f424b, altFloorColor: 0x59343c, wallColor: 0x87505b, trimColor: 0xef4444, torchColor: 0xf87171, portalColor: 0xf43f5e },
    atmosphere: { fogColor: 0x240c10, fogNear: 20, fogFar: 64, ambientColor: 0xfecdd3, ambientIntensity: 0.94, keyLightColor: 0xfb7185, keyLightIntensity: 1.28, weather: 'sand', weatherColor: 0xf43f5e },
    monsterTypes: ['bone_soldier', 'bone_hunter', 'bone_mage', 'bone_general', 'bone_lord', 'devil_eye', 'edimmu', 'death_kara', 'hyeongcheon']
  },
  {
    floor: 12, name: 'Flame Mountain B12F — Flame Sprite Gorge', sroDungeon: 'flame', decorProfile: 'flame_b12', layoutStyle: 'caldera_ring',
    subtitle: 'Flame Sprite Geçidi — Sovereign Domain of Lord Yarkan',
    theme: 'lava', recommendedLevel: 40, isBossFloor: true, bossId: 'lord_yarkan', bossName: 'Lord Yarkan',
    portalStyle: 'sovereign_blaze',
    floorTexture: '/assets/sro/dun/tex/flame_floor.png', wallTexture: '/assets/sro/dun/tex/flame_wall.png',
    themeOverride: { floorColor: 0x803d2e, altFloorColor: 0x663024, wallColor: 0x994a38, trimColor: 0xfbbf24, torchColor: 0xfacc15, portalColor: 0xfbbf24 },
    atmosphere: { fogColor: 0x291106, fogNear: 19, fogFar: 66, ambientColor: 0xfef08a, ambientIntensity: 0.98, keyLightColor: 0xf59e0b, keyLightIntensity: 1.35, weather: 'sand', weatherColor: 0xfbbf24 },
    monsterTypes: ['flame_captain', 'flame_adjutant', 'flame_cow_king', 'flame_giant', 'flame_gigantic', 'flame_crazy', 'flame_witch', 'flame_archer', 'hyungno', 'hyeongcheon']
  },
  {
    floor: 13, name: "Holy Water Temple B13F — Pharaoh's Hall", sroDungeon: 'holywater', decorProfile: 'holywater', layoutStyle: 'basilica_wings',
    subtitle: 'Kutsal Su Tapınağı & Pharaoh Mezarı — Halls of Horus, Isis & Seth',
    theme: 'boss', recommendedLevel: 44, isBossFloor: false,
    portalStyle: 'solar_pharaoh',
    floorTexture: '/assets/sro/dun/tex/holywater_floor.png', wallTexture: '/assets/sro/dun/tex/holywater_wall.png',
    themeOverride: { floorColor: 0x87744b, altFloorColor: 0x6e5d3a, wallColor: 0xa38e5e, trimColor: 0xd4af37, torchColor: 0x38bdf8, portalColor: 0x22d3ee },
    atmosphere: { fogColor: 0x101c26, fogNear: 21, fogFar: 66, ambientColor: 0xfef3c7, ambientIntensity: 0.99, keyLightColor: 0x67e8f9, keyLightIntensity: 1.30, weather: 'embers', weatherColor: 0x38bdf8 },
    monsterTypes: ['sand_mummy', 'aker', 'anubis', 'heron', 'keisas', 'apriest', 'spector', 'sphinx', 'sandman', 'sd_raider', 'bastet', 'mont', 'sekhmet', 'haroeris', 'osiris', 'isis', 'neith', 'selkis', 'seth']
  },
  {
    floor: 14, name: 'Jupiter Temple B14F — Hall of Worship', sroDungeon: 'jupiter', decorProfile: 'jupiter', layoutStyle: 'basilica_wings',
    subtitle: 'Jupiter Tapınağı & Tanrıların Bahçesi — Sanctum of the Pantheon',
    theme: 'boss', recommendedLevel: 48, isBossFloor: false,
    portalStyle: 'olympus_lightning',
    floorTexture: '/assets/sro/dun/tex/jupiter_floor.png', wallTexture: '/assets/sro/dun/tex/jupiter_wall.png',
    themeOverride: { floorColor: 0x736c82, altFloorColor: 0x5c5669, wallColor: 0x938ca3, trimColor: 0xfacc15, torchColor: 0xfde047, portalColor: 0x60a5fa },
    atmosphere: { fogColor: 0x141628, fogNear: 21, fogFar: 66, ambientColor: 0xe0e7ff, ambientIntensity: 0.99, keyLightColor: 0xfef08a, keyLightIntensity: 1.32, weather: 'embers', weatherColor: 0xfde047 },
    monsterTypes: ['babilion', 'mino', 'griffin', 'charm_witch', 'fear_serpent', 'fanaticism', 'desire_watcher', 'devil_dog', 'dark_dog', 'devil_dark', 'immortal_warden', 'nike_lion', 'the_earth', 'yuno', 'jupiter_sentinel', 'baal']
  },
  {
    floor: 15, name: "Shambhala Abyss B15F — Guardian's Chamber", sroDungeon: 'demon', decorProfile: 'demon', layoutStyle: 'tomb_grid',
    subtitle: 'Koruyucunun Odası — Demon Shaitan Guards Roc Mountain Summit',
    theme: 'boss', recommendedLevel: 52, isBossFloor: true, bossId: 'demon_shaitan', bossName: 'Demon Shaitan',
    portalStyle: 'shambhala_void',
    floorTexture: '/assets/sro/dun/tex/demon_floor.png', wallTexture: '/assets/sro/dun/tex/demon_wall.png',
    themeOverride: { floorColor: 0x613c4f, altFloorColor: 0x4c2d3d, wallColor: 0x7a4a62, trimColor: 0xf87171, torchColor: 0xef4444, portalColor: 0xa855f7 },
    atmosphere: { fogColor: 0x21090e, fogNear: 20, fogFar: 66, ambientColor: 0xfecaca, ambientIntensity: 0.96, keyLightColor: 0xef4444, keyLightIntensity: 1.32, weather: 'embers', weatherColor: 0xef4444 },
    monsterTypes: ['wendigo', 'succubus', 'void_devil', 'dark_guardian', 'goat_demon', 'garm', 'shamoot', 'underworld_knight', 'shambhala_mage', 'narun', 'dm_soldier', 'andras']
  },
  {
    floor: 16, name: 'Mountain Roc Peak — Sky Nest Sanctum', sroDungeon: 'roc_nest', decorProfile: 'roc_nest', layoutStyle: 'roc_sanctum',
    subtitle: 'Roc Dağı Zirvesi (Roc Odası) — Final Confrontation',
    theme: 'boss', recommendedLevel: 58, isBossFloor: true, isFinalBossFloor: true, bossId: 'roc', bossName: 'Roc',
    portalStyle: 'celestial_roc',
    floorTexture: '/assets/sro/dun/tex/roc_floor.png', wallTexture: '/assets/sro/dun/tex/roc_wall.png',
    themeOverride: { floorColor: 0x766c8f, altFloorColor: 0x5e5573, wallColor: 0x9185ad, trimColor: 0xfbbf24, torchColor: 0xfde047, portalColor: 0x38bdf8 },
    atmosphere: { fogColor: 0x19142b, fogNear: 24, fogFar: 74, ambientColor: 0xfef3c7, ambientIntensity: 1.02, keyLightColor: 0xfbbf24, keyLightIntensity: 1.38, weather: 'embers', weatherColor: 0xfbbf24 },
    monsterTypes: ['rocky', 'feather_mask', 'wing_tribe', 'wing_tribe_spear', 'mountain_spirit', 'bone_roc', 'antelope', 'mountain_goat', 'devil_saytan']
  },
  // Secret floors accessible via Secret Rift Portals in vault / special rooms
  {
    floor: 101, name: 'Forgotten World — Togui Village S1F', sroDungeon: 'togui', decorProfile: 'togui', layoutStyle: 'cavern_branch',
    subtitle: 'Unutulan Dünya (Togui Köyü) — Cursed Doll Shrine',
    theme: 'cave', recommendedLevel: 15, isBossFloor: false, isSecretFloor: true, returnFloor: 4,
    portalStyle: 'togui_mask',
    floorTexture: '/assets/sro/dun/tex/togui_floor.png', wallTexture: '/assets/sro/dun/tex/donhwang_wall.png',
    themeOverride: { floorColor: 0x6b7c68, altFloorColor: 0x576654, wallColor: 0x7d8c78, trimColor: 0xc97b42, torchColor: 0xf97316, portalColor: 0xec4899 },
    atmosphere: { fogColor: 0x18130e, fogNear: 19, fogFar: 60, ambientColor: 0xfde68a, ambientIntensity: 0.94, keyLightColor: 0xfb923c, keyLightIntensity: 1.25, weather: 'spores', weatherColor: 0xf97316 },
    monsterTypes: ['togui_doll', 'togui_boom', 'togui_soldier', 'togui_magic', 'togui_strong', 'togui_general', 'togui_elder', 'togui_chieftain']
  },
  {
    floor: 102, name: 'Forgotten World — Shipwreck Hold S2F', sroDungeon: 'wreck', decorProfile: 'wreck', layoutStyle: 'stronghold_wing',
    subtitle: 'Unutulan Dünya (Batık Kalyon) — Ghost Captain Vault',
    theme: 'crypt', recommendedLevel: 30, isBossFloor: false, isSecretFloor: true, returnFloor: 7,
    portalStyle: 'ghost_galleon',
    floorTexture: '/assets/sro/dun/tex/wreck_floor.png', wallTexture: '/assets/sro/dun/tex/wreck_wall.png',
    themeOverride: { floorColor: 0x6b5a4b, altFloorColor: 0x57483b, wallColor: 0x826d5c, trimColor: 0x38bdf8, torchColor: 0x38bdf8, portalColor: 0x38bdf8 },
    atmosphere: { fogColor: 0x0d1a22, fogNear: 19, fogFar: 62, ambientColor: 0xbae6fd, ambientIntensity: 0.96, keyLightColor: 0x38bdf8, keyLightIntensity: 1.26, weather: 'mist', weatherColor: 0x38bdf8 },
    monsterTypes: ['ghost_pirate', 'ghost_marauder', 'ghost_beast', 'ghost_curse', 'ghost_gluttony', 'ghost_specter', 'ghost_seiren', 'ghost_undine', 'ghost_king_nipper', 'ghost_commander', 'ghost_wreck']
  },
  {
    floor: 103, name: 'Qin-Shi Tomb B6F — Chamber of Medusa S3F', sroDungeon: 'qinshi_b6', decorProfile: 'qinshi_b6', layoutStyle: 'tomb_grid',
    subtitle: 'Qin-Shi İmparatoru Mezarlığı Seviye 6 — Beyaz Yılan Tapınağı',
    theme: 'ruins', recommendedLevel: 45, isBossFloor: true, bossId: 'medusa', bossName: 'Medusa', isSecretFloor: true, returnFloor: 10,
    portalStyle: 'white_viper',
    floorTexture: '/assets/sro/dun/tex/qinshi_floor.png', wallTexture: '/assets/sro/dun/tex/qinshi_wall.png',
    themeOverride: { floorColor: 0x4b7063, altFloorColor: 0x3d5c51, wallColor: 0x658f80, trimColor: 0x34d399, torchColor: 0x34d399, portalColor: 0x10b981 },
    atmosphere: { fogColor: 0x0a1e17, fogNear: 18, fogFar: 64, ambientColor: 0xd1fae5, ambientIntensity: 0.98, keyLightColor: 0x34d399, keyLightIntensity: 1.32, weather: 'incense', weatherColor: 0x10b981 },
    monsterTypes: ['snake_slave', 'snake_man', 'snake_demon', 'snake_general', 'snake_woman', 'black_snake', 'tomb_general', 'royal_soldier', 'east_guardian', 'west_guardian', 'north_guardian', 'south_guardian']
  }
];

export const CHALLENGE_TYPES = {
  survival_60: {
    id: 'survival_60',
    name: '60s Swarm Survival',
    duration: 60,
    waveInterval: 4.5,
    waveCount: 5,
    maxAlive: 16,
    eliteChance: 0.35,
    mobHpMult: 1.45,
    mobAtkMult: 1.28,
    mobSpdMult: 1.12,
    hazardElement: 'physical',
    hazardInterval: 4.8,
    hazardDamageMult: 1.15,
    overdriveAt: 18,
    overdriveGiant: true,
    color: 0xf59e0b,
    chestTiers: ['rare', 'epic', 'epic'],
    desc: 'Endure escalating ambushes & shockwaves for 60s — Overdrive unleashes an Executioner Giant!'
  },
  blitz_45: {
    id: 'blitz_45',
    name: '45s Storm Blitz',
    duration: 45,
    waveInterval: 3.4,
    waveCount: 6,
    maxAlive: 18,
    eliteChance: 0.5,
    mobHpMult: 1.55,
    mobAtkMult: 1.38,
    mobSpdMult: 1.18,
    hazardElement: 'lightning',
    hazardInterval: 3.8,
    hazardDamageMult: 1.3,
    overdriveAt: 16,
    overdriveGiant: true,
    color: 0xa855f7,
    chestTiers: ['rare', 'epic', 'boss'],
    desc: 'Survive relentless rapid-fire demon & lightning waves for 45 seconds to win a Boss Chest!'
  },
  unique_trial: {
    id: 'unique_trial',
    name: '60s Dual Warden Trial',
    duration: 60,
    waveInterval: 4.8,
    waveCount: 4,
    maxAlive: 14,
    spawnGiant: true,
    wardenCount: 2,
    eliteChance: 0.45,
    mobHpMult: 1.65,
    mobAtkMult: 1.42,
    mobSpdMult: 1.16,
    hazardElement: 'fire',
    hazardInterval: 4.0,
    hazardDamageMult: 1.35,
    overdriveAt: 20,
    color: 0xef4444,
    chestTiers: ['epic', 'epic', 'boss'],
    desc: 'Vanquish Twin Shadow Wardens amidst falling meteors — or endure 60 seconds!'
  },
  inferno_crucible: {
    id: 'inferno_crucible',
    name: '65s Hellfire Crucible',
    duration: 65,
    waveInterval: 4.0,
    waveCount: 6,
    maxAlive: 18,
    eliteChance: 0.52,
    mobHpMult: 1.72,
    mobAtkMult: 1.46,
    mobSpdMult: 1.16,
    hazardElement: 'fire',
    hazardInterval: 3.1,
    hazardDamageMult: 1.45,
    overdriveAt: 20,
    overdriveGiant: true,
    color: 0xf97316,
    chestTiers: ['epic', 'boss', 'boss'],
    desc: 'Taklamakan magma rains across the coliseum while fiery elites converge from every gate!'
  },
  cursed_obelisk: {
    id: 'cursed_obelisk',
    name: '70s Qin-Shi Cursed Siege',
    duration: 70,
    waveInterval: 4.2,
    waveCount: 6,
    maxAlive: 18,
    eliteChance: 0.55,
    mobHpMult: 1.85,
    mobAtkMult: 1.45,
    mobSpdMult: 1.15,
    hazardElement: 'ice',
    hazardInterval: 3.5,
    hazardDamageMult: 1.35,
    overdriveAt: 22,
    overdriveGiant: true,
    color: 0x06b6d4,
    chestTiers: ['epic', 'epic', 'boss'],
    desc: 'Armored terracotta champions & freezing obelisk pulses test endurance for 70 seconds!'
  },
  blood_coliseum: {
    id: 'blood_coliseum',
    name: '55s Abyssal Coliseum',
    duration: 55,
    waveInterval: 3.6,
    waveCount: 5,
    maxAlive: 16,
    spawnGiant: true,
    wardenCount: 1,
    eliteChance: 0.65,
    mobHpMult: 1.75,
    mobAtkMult: 1.52,
    mobSpdMult: 1.22,
    hazardElement: 'dark',
    hazardInterval: 3.4,
    hazardDamageMult: 1.4,
    overdriveAt: 18,
    overdriveGiant: true,
    color: 0xdc2626,
    chestTiers: ['epic', 'boss', 'boss'],
    desc: 'High-lethality Elite Coliseum crowned by an Abyssal Warden and shadow shockwaves!'
  }
};

export const VILLAGE_NPCS = [
  {
    id: 'chief',
    npcId: 'chief',
    name: 'Elder Aldric',
    title: 'Jangan Governor & Questmaster',
    role: 'chief',
    actionType: 'quest',
    x: -9.5,
    z: -34.5,
    rotationY: 0.45,
    prompt: 'Speak with Elder Aldric (Quests, Chronicle & Bounties) [E]',
    dialogue: [
      'Welcome to the walled metropolis of Jangan, adventurer. Evil chi rises from the ancient Chin Tomb and Donwhang ruins beyond the north pass.',
      'Prove your strength against the Jangan wilds up to Level 10, clear every dungeon floor completely to break the ancient seals, and aid our guild masters.'
    ]
  },
  {
    id: 'blacksmith',
    npcId: 'blacksmith',
    shopId: 'blacksmith',
    name: 'Blacksmith Gorn',
    title: 'Master Weapons & Armor Smith',
    role: 'blacksmith',
    actionType: 'shop',
    x: -16.5,
    z: 14.5,
    rotationY: Math.PI * 0.45,
    prompt: 'Trade with Blacksmith Gorn (Weapons, Shields & Armor) [E]',
    dialogue: [
      'Forged in the western fires of Jangan! Upgrade your cold steel here before facing White Tigers or entering Donwhang Stone Cave.'
    ]
  },
  {
    id: 'merchant',
    npcId: 'merchant',
    shopId: 'merchant',
    name: 'Alchemist Elara',
    title: 'Pharmacy & Caravan Provisions',
    role: 'merchant',
    actionType: 'shop',
    x: 16.5,
    z: 14.5,
    rotationY: -Math.PI * 0.45,
    prompt: 'Trade with Alchemist Elara (Potions, Elixirs & Scrolls) [E]',
    dialogue: [
      'Every seasoned traveler on the Silk Road carries Return Scrolls, Haste Drafts, and ample potions before leaving the city gates!'
    ]
  },
  {
    id: 'trainer',
    npcId: 'trainer',
    name: 'Battle Master Kael',
    title: 'Martial Arts & Skill Master',
    role: 'skill_master',
    actionType: 'skills',
    x: -19.5,
    z: 32.0,
    rotationY: Math.PI * 0.65,
    prompt: 'Train with Battle Master Kael (Skills, Passives & Quests) [K / E]',
    dialogue: [
      'Even the Mangyang and Yeoha of Jangan strike with elemental techniques. Master your active combos and passive stances here!'
    ]
  },
  {
    id: 'composer',
    npcId: 'composer',
    shopId: 'composer',
    name: 'Crystal Sage Lyra',
    title: 'Alchemy & +N Enhancement Sage',
    role: 'composer',
    actionType: 'compose',
    x: 18.0,
    z: -20.5,
    rotationY: -Math.PI * 0.65,
    prompt: 'Consult Crystal Sage Lyra (Alchemy +N & Elixirs [O / E])',
    dialogue: [
      'Bring Elixirs, Luck Powders, and Magic Stones to elevate your gear toward Seal of Sun brilliance!'
    ]
  },
  {
    id: 'storage',
    npcId: 'storage',
    name: 'Quartermaster Bram',
    title: 'General Shared Vault Steward',
    role: 'storage',
    actionType: 'storage',
    x: -9.5,
    z: 22.0,
    rotationY: 0.25,
    prompt: 'Open General Shared Storage with Quartermaster Bram [E]',
    dialogue: [
      'Our Caravan Storage Chests and Ledger link across every character in your realm—store items, excess gold, and crafting materials safely.'
    ]
  },
  {
    id: 'pet_merchant',
    npcId: 'pet_merchant',
    name: 'Beast Tamer Zara',
    title: 'Silkroad Companion & Stables Master',
    role: 'merchant',
    actionType: 'pet_shop',
    x: -34.5,
    z: 26.5,
    rotationY: 0.45,
    prompt: 'Speak with Beast Tamer Zara (Pets & Quests) [E]',
    dialogue: [
      'Fine Silkroad companions, tamed along the Jangan canals! Loyal grab spirits and ferocious tiger cubs await beside the western stables.'
    ]
  },
  {
    id: 'accessory_trader',
    npcId: 'accessory_trader',
    shopId: 'accessory_trader',
    name: 'Specialty Trader Jodaesan',
    title: 'Silk Jewels, Talismans & Coffers',
    role: 'merchant',
    actionType: 'shop',
    x: 21.5,
    z: 28.5,
    rotationY: -0.55,
    prompt: 'Trade with Specialty Trader Jodaesan (Accessories & Coffers) [E]',
    dialogue: [
      'Finest jade rings, amulets, Magic Stones, and sealed coffers from Changan caravans! Take my caravan request if you head south-east.'
    ]
  },
  {
    id: 'hunter_master',
    npcId: 'hunter_master',
    shopId: 'hunter_master',
    name: 'Hunter Associate Gwakwi',
    title: 'Hunter Guild Master & Outskirts Armory',
    role: 'guard_spear',
    actionType: 'shop',
    x: 29.0,
    z: -10.5,
    rotationY: -Math.PI * 0.5,
    prompt: 'Speak with Hunter Associate Gwakwi (Guild Armory & Bounties) [E]',
    dialogue: [
      'Black Robber scouts and Water Ghosts stalk the canal road! Stock up on Hunter Guild weapons and clear the Jangan roads!'
    ]
  }
];

function extractXZ(posOrX, zOrOther, thirdArg) {
  if (typeof posOrX === 'object' && posOrX !== null) {
    const x = Number(posOrX.x ?? 0);
    const z = Number(posOrX.z ?? posOrX.y ?? 0);
    return { x, y: Number(posOrX.y ?? 0), z, extra: zOrOther, isObject: true, ref: posOrX };
  }
  return {
    x: Number(posOrX || 0),
    y: 0,
    z: Number(zOrOther || 0),
    extra: thirdArg,
    isObject: false,
    ref: null
  };
}

function seededRandom(seed) {
  let s = (Number(seed) || 1) % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

export class DungeonGenerator {
  constructor(rendererOrOptions = null, models3dArg = null, dataArg = null) {
    this.renderer = null;
    this.scene = null;
    this.models3d = defaultModels3d;
    this.data = null;
    this.gameContext = null;

    this._applyInitArgs(rendererOrOptions, models3dArg, dataArg);

    this.rootGroup = new THREE.Group();
    this.rootGroup.name = 'WorldRoot';
    if (this.scene) {
      this.scene.add(this.rootGroup);
    }

    this.zone = 'village';
    this.currentFloor = 0;
    this.floorName = 'Oakhaven Village';
    this.theme = DUNGEON_THEMES.village;

    this.tileSize = 2.0;
    this.gridWidth = 32;
    this.gridHeight = 32;
    this.originX = -(this.gridWidth * this.tileSize) * 0.5;
    this.originZ = -(this.gridHeight * this.tileSize) * 0.5;
    this.grid = [];

    this.spawnPoint = { x: 0, y: 0, z: 4 };
    this.rooms = [];
    this.corridors = [];
    this.npcs = [];
    this.chests = [];
    this.breakables = [];
    this.portals = [];
    this.traps = [];
    this.torches = [];
    this.switches = [];
    this.gates = [];
    this.shrines = [];
    this.groundLoot = [];
    this.lootDrops = this.groundLoot;
    this.hotSprings = null;
    this.solidObstacles = [];
    this.bossRoom = null;
    this.bossArena = null;
    this.bossGate = null;
    this.puzzle = null;
    this.puzzleProps = [];
    this.specialRoomType = null;
    this._reserved = [];
    this._lightSources = [];
    this._lightPool = [];
    this._lightClock = 0;
    this._batch = null;
    this._wallTiles = [];
    this.unlockedMaxFloor = 1;
    this.elapsedTime = 0;
    this.villageBuild = null;
  }

  get context() {
    return this.gameContext;
  }

  set context(v) {
    this.gameContext = v;
  }

  get lootDrops() {
    return this.groundLoot;
  }

  set lootDrops(v) {
    this.groundLoot = v;
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

  clearWorld() {
    this._freeLightPool();
    if (this.renderer?.clearDynamicLights) {
      this.renderer.clearDynamicLights();
    }

    if (this.villageBuild) {
      this.villageBuild.dispose();
      this.villageBuild = null;
    }

    while (this.rootGroup.children.length > 0) {
      const child = this.rootGroup.children.pop();
      disposeObject3D(child);
      this.rootGroup.remove(child);
    }

    this.rooms = [];
    this.corridors = [];
    this.npcs = [];
    this.chests = [];
    this.breakables = [];
    this.portals = [];
    this.traps = [];
    this.torches = [];
    this.switches = [];
    this.gates = [];
    this.shrines = [];
    this.groundLoot = [];
    this.lootDrops = this.groundLoot;
    this.hotSprings = null;
    this.solidObstacles = [];
    this.bossRoom = null;
    this.bossArena = null;
    this.bossGate = null;
    this.puzzle = null;
    this.puzzleProps = [];
    this.specialRoomType = null;
    this._reserved = [];
    this._placedDecor = [];
    this._sroPropsPlaced = [];
    this.outskirtCamps = [];
    this.townWallHalf = 55;
    this.townWallHalf = 25;
    this.exitLockedByClear = false;
    this._lightSources = [];
    this._lightPool = [];
    this._batch = null;
    this._wallTiles = [];
  }

  worldToGrid(x, z) {
    const gx = Math.floor((x - this.originX) / this.tileSize);
    const gz = Math.floor((z - this.originZ) / this.tileSize);
    return { gx, gz };
  }

  gridToWorld(gx, gz) {
    return {
      x: this.originX + (gx + 0.5) * this.tileSize,
      y: 0,
      z: this.originZ + (gz + 0.5) * this.tileSize
    };
  }

  getTileAtGrid(gx, gz) {
    if (gz < 0 || gz >= this.gridHeight || gx < 0 || gx >= this.gridWidth) {
      return TILE.WALL;
    }
    return this.grid[gz]?.[gx] ?? TILE.WALL;
  }

  setTileAtGrid(gx, gz, tileType) {
    if (gz >= 0 && gz < this.gridHeight && gx >= 0 && gx < this.gridWidth) {
      this.grid[gz][gx] = tileType;
    }
  }

  getFloors(unlockedMaxFloor = null) {
    const maxUnlocked = Math.max(
      this.unlockedMaxFloor,
      Number(unlockedMaxFloor || this.gameContext?.gameState?.hero?.maxFloor || 1)
    );
    this.unlockedMaxFloor = maxUnlocked;

    const customFloors = this.data?.dungeons?.floors || this.data?.floors;
    return FLOOR_DEFINITIONS.map((def, idx) => {
      const custom = Array.isArray(customFloors) ? customFloors[idx] : null;
      return {
        floor: def.floor,
        name: custom?.name || def.name,
        subtitle: def.subtitle || '',
        theme: def.theme,
        sroDungeon: def.sroDungeon,
        portalStyle: def.portalStyle || 'jade_gate',
        unlocked: def.floor <= maxUnlocked,
        recommendedLevel: custom?.recommendedLevel || def.recommendedLevel,
        minDungeonLevel: MIN_DUNGEON_LEVEL,
        isBossFloor: def.isBossFloor,
        bossName: custom?.bossName || def.bossName || null,
        monsterTypes: Array.isArray(def.monsterTypes) ? [...def.monsterTypes] : []
      };
    });
  }

  unlockFloor(floorNum) {
    if (floorNum > this.unlockedMaxFloor) {
      this.unlockedMaxFloor = floorNum;
    }
  }

  /**
   * Build the 3D Village Hub / Safe Zone with all 6 interactive NPCs, healing fountain,
   * training dummies/barrels, and Dungeon Entrance Portal + Floor Selector.
   */
  loadVillageHub(sceneOverride = null, models3dOverride = null) {
    if (models3dOverride) this.models3d = models3dOverride;
    this._ensureSceneAttached(sceneOverride);
    this.clearWorld();

    this.zone = 'village';
    this.currentFloor = 0;
    this.floorName = 'Oakhaven Village';
    this.theme = DUNGEON_THEMES.village;

    if (this.renderer?.setEnvironmentTheme) {
      this.renderer.setEnvironmentTheme('village');
    }

    this.tileSize = 2.0;
    this.gridWidth = 140;
    this.gridHeight = 140;
    this.originX = -(this.gridWidth * this.tileSize) * 0.5;
    this.originZ = -(this.gridHeight * this.tileSize) * 0.5;

    this.grid = Array.from({ length: this.gridHeight }, (_, gz) =>
      Array.from({ length: this.gridWidth }, (__, gx) => {
        const isBorder = gx <= 1 || gz <= 1 || gx >= this.gridWidth - 2 || gz >= this.gridHeight - 2;
        return isBorder ? TILE.WALL : TILE.FLOOR;
      })
    );

    // Silk-Road Jangan metropolis & expanded hunting outskirts (see villageBuilder.js)
    const vb = this._buildVillageScenery();
    this.villageBuild = vb;
    this.outskirtCamps = vb?.outskirtCamps || [];
    this.townWallHalf = vb?.townWallHalf || 55;
    this.hotSprings = vb?.hotSprings || {
      x: HOT_SPRINGS.center.x,
      z: HOT_SPRINGS.center.z,
      radius: HOT_SPRINGS.radius,
      name: 'Jade Mist Hot Springs'
    };
    const fountainGroup = vb.fountain;

    this.shrines.push({
      id: 'village_fountain',
      type: 'shrine',
      name: 'Fountain of Restoration',
      x: 0,
      y: 0,
      z: 0,
      radius: 3.1,
      used: false,
      reusable: true,
      prompt: 'Drink from Fountain of Restoration (Full Heal)',
      mesh: fountainGroup
    });

    // Spawn all 6 interactive Village NPCs
    const npcSource = this._resolveVillageNPCDefinitions();
    for (const baseDef of npcSource) {
      const spot = vb.npcSpots[baseDef.id];
      const npcDef = spot ? { ...baseDef, x: spot.x, z: spot.z, rotationY: spot.rotationY } : baseDef;
      const mesh = (this.models3d?.createNPCMesh || createNPCMesh)(npcDef);
      mesh.position.set(npcDef.x, 0.08, npcDef.z);
      mesh.rotation.y = npcDef.rotationY || 0;
      this.rootGroup.add(mesh);

      this.npcs.push({
        ...npcDef,
        type: 'npc',
        y: 0.08,
        position: { x: npcDef.x, y: 0.08, z: npcDef.z },
        mesh
      });
      this.solidObstacles.push({ x: npcDef.x, z: npcDef.z, radius: 0.65 });
    }

    // Well-spaced district portals across the metropolis (50m-76m apart):
    // 1. North Palace Plaza: Abyssal Dungeon Entrance Gate
    const dpPos = vb?.portalPos || { x: 9.0, y: 0, z: -33.0 };
    const dungeonPortalMesh = (this.models3d?.createPortalMesh || createPortalMesh)({ color: 0x38bdf8, portalStyle: 'jade_gate' }, 'dungeon');
    dungeonPortalMesh.position.set(dpPos.x, 0, dpPos.z);
    this.rootGroup.add(dungeonPortalMesh);
    if (this.renderer?.addPointLight) {
      this.renderer.addPointLight(new THREE.Vector3(dpPos.x, 1.8, dpPos.z), 0x38bdf8, 2.2, 14, true);
    }

    this.portals.push({
      id: 'dungeon_entrance',
      type: 'portal',
      portalType: 'dungeon_entrance',
      name: 'Abyssal Dungeon Gate (Lv 10+)',
      targetFloor: 1,
      minLevel: MIN_DUNGEON_LEVEL,
      x: dpPos.x,
      y: 0,
      z: dpPos.z,
      position: { x: dpPos.x, y: 0, z: dpPos.z },
      prompt: `Enter Dungeon (Requires Lv ${MIN_DUNGEON_LEVEL}) [E]`,
      mesh: dungeonPortalMesh
    });

    // 2. West Celestial Temple Courtyard: Waystone Floor Teleporter (50m from North Gate)
    const spPos = vb?.selectorPos || { x: -38.0, y: 0, z: -10.0 };
    const selectorMesh = (this.models3d?.createPortalMesh || createPortalMesh)({ color: 0xa855f7, portalStyle: 'celestial_roc' }, 'selector');
    selectorMesh.position.set(spPos.x, 0, spPos.z);
    this.rootGroup.add(selectorMesh);

    this.portals.push({
      id: 'floor_selector',
      type: 'portal',
      portalType: 'floor_selector',
      name: 'West Temple Waystone Teleporter',
      x: spPos.x,
      y: 0,
      z: spPos.z,
      position: { x: spPos.x, y: 0, z: spPos.z },
      prompt: 'Use Temple Waystone Floor Selector [M / E]',
      mesh: selectorMesh
    });

    // 3. East Monster Stadium Courtyard: Frontier Coliseum Waystone (76m from West Temple)
    const apPos = vb?.arenaPortalPos || { x: 38.0, y: 0, z: -10.0 };
    const arenaPortalMesh = (this.models3d?.createPortalMesh || createPortalMesh)({ color: 0xf59e0b, portalStyle: 'crimson_coliseum' }, 'selector');
    arenaPortalMesh.position.set(apPos.x, 0, apPos.z);
    this.rootGroup.add(arenaPortalMesh);

    this.portals.push({
      id: 'arena_waystone',
      type: 'portal',
      portalType: 'floor_selector',
      name: 'East Coliseum Dimensional Gate',
      x: apPos.x,
      y: 0,
      z: apPos.z,
      position: { x: apPos.x, y: 0, z: apPos.z },
      prompt: 'Use East Coliseum Floor Teleporter [M / E]',
      mesh: arenaPortalMesh
    });

    // Practice breakable barrels & crates in SW Martial Training Courtyard
    const practiceProps = [
      { x: -24.5, z: 29.0, type: 'barrel' },
      { x: -26.5, z: 30.2, type: 'crate' },
      { x: -23.0, z: 33.8, type: 'barrel' },
      { x: 19.0, z: 12.0, type: 'urn' }
    ];
    practiceProps.forEach((p, idx) => {
      this._spawnBreakable(p.x, p.z, p.type, `village_prop_${idx}`);
    });

    // Reusable Account-Wide General Shared Storage Chests (Central Bazaar + North Gate Plaza)
    const chestSpots = vb?.storageChestSpots || {
      village_starter_chest: { x: -7.2, z: 23.2 },
      village_north_vault: { x: 6.5, z: -35.5 }
    };
    this._spawnStorageChest(
      chestSpots.village_starter_chest.x,
      chestSpots.village_starter_chest.z,
      'village_starter_chest',
      'General Shared Storage Chest'
    );
    this._spawnStorageChest(
      chestSpots.village_north_vault.x,
      chestSpots.village_north_vault.z,
      'village_north_vault',
      'Expedition General Storage Vault'
    );

    // Single main room for minimap display
    this.rooms = [
      {
        id: 0,
        type: 'village',
        x: this.originX + 2 * this.tileSize,
        y: this.originZ + 2 * this.tileSize,
        z: this.originZ + 2 * this.tileSize,
        w: (this.gridWidth - 4) * this.tileSize,
        h: (this.gridHeight - 4) * this.tileSize,
        explored: true
      }
    ];

    this.spawnPoint = vb?.spawnPoint ? { ...vb.spawnPoint } : { x: 0, y: 0, z: 7.5 };
    return this.getFloorState();
  }

  // Alias for loadVillageHub
  loadVillage(sceneOverride = null, models3dOverride = null) {
    return this.loadVillageHub(sceneOverride, models3dOverride);
  }

  _resolveVillageNPCDefinitions() {
    const extractedNpcs = this.data?.npcs;
    if (!Array.isArray(extractedNpcs) || extractedNpcs.length === 0) {
      return VILLAGE_NPCS;
    }
    return VILLAGE_NPCS.map((baseNpc, i) => {
      const match = extractedNpcs.find(
        (n) =>
          n.id === baseNpc.id ||
          n.role === baseNpc.role ||
          String(n.name || '').toLowerCase().includes(baseNpc.role)
      ) || extractedNpcs[i];
      return {
        ...baseNpc,
        name: match?.name || baseNpc.name,
        title: match?.title || match?.role || baseNpc.title,
        dialogue: Array.isArray(match?.dialogue) && match.dialogue.length ? match.dialogue : baseNpc.dialogue
      };
    });
  }

  _buildVillageScenery() {
    const vb = buildVillage({
      grid: this.grid,
      tileSize: this.tileSize,
      originX: this.originX,
      originZ: this.originZ,
      gridWidth: this.gridWidth,
      gridHeight: this.gridHeight,
      createNPCMesh: this.models3d?.createNPCMesh || createNPCMesh,
      addLight: this.renderer?.addPointLight ? (p, c, i, d, f) => this.renderer.addPointLight(p, c, i, d, f) : null
    });
    this.villageBuild = vb;
    this.rootGroup.add(vb.group);
    for (const o of vb.obstacles) this.solidObstacles.push(o);
    return vb;
  }

  /**
   * Generate a multi-room 3D Dungeon Floor with connected rooms, corridors,
   * locked gates + lever switches, spike/elemental traps, torches, breakable barrels/urns,
   * treasure chests, floor stairs/portals, and dedicated Boss Arena on boss floors.
   */
  generateFloor(floorNum = 1, themeOrScene = null, models3dOverride = null, extractedDataOverride = null) {
    const fNum = Math.max(1, Number(floorNum) || 1);
    if (fNum <= 0) {
      return this.loadVillageHub(themeOrScene, models3dOverride);
    }

    if (models3dOverride) this.models3d = models3dOverride;
    if (extractedDataOverride) this.data = extractedDataOverride;
    if (themeOrScene && typeof themeOrScene === 'object') {
      this._ensureSceneAttached(themeOrScene);
    } else {
      this._ensureSceneAttached();
    }

    this.clearWorld();

    const floorDef = (fNum >= 100 ? FLOOR_DEFINITIONS.find(d => d.floor === fNum) : null)
      || FLOOR_DEFINITIONS[(fNum - 1) % FLOOR_DEFINITIONS.length]
      || FLOOR_DEFINITIONS[0];
    const isBossFloor = Boolean(floorDef.isBossFloor) || (fNum < 100 && fNum % 3 === 0);
    const themeKey = typeof themeOrScene === 'string' && DUNGEON_THEMES[themeOrScene]
      ? themeOrScene
      : floorDef.theme;

    const baseTheme = DUNGEON_THEMES[themeKey] || DUNGEON_THEMES.cave;
    this.floorDef = floorDef;
    this.sroDungeon = floorDef.sroDungeon || themeKey;
    this.decorProfile = floorDef.decorProfile || this.sroDungeon;
    this.theme = {
      ...baseTheme,
      ...(floorDef.themeOverride || {}),
      subtitle: floorDef.subtitle || baseTheme.subtitle,
      floorTexture: floorDef.floorTexture || baseTheme.floorTexture,
      wallTexture: floorDef.wallTexture || baseTheme.wallTexture,
      portalStyle: floorDef.portalStyle || 'jade_gate',
      decorProfile: this.decorProfile,
      atmosphere: { ...(baseTheme.atmosphere || {}), ...(floorDef.atmosphere || {}) },
      sroDungeon: this.sroDungeon
    };
    this.zone = 'dungeon';
    this.currentFloor = fNum;
    this.floorName = floorDef.name || (fNum <= FLOOR_DEFINITIONS.length
      ? floorDef.name
      : `${this.theme.name} B${fNum}F`);

    if (fNum > this.unlockedMaxFloor) {
      this.unlockedMaxFloor = fNum;
    }

    if (this.renderer?.setEnvironmentTheme) {
      this.renderer.setEnvironmentTheme(this.theme.id);
    }

    const rand = seededRandom(fNum * 9973 + 1337);
    this.specialRoomType = SPECIAL_ROOM_CYCLE[(fNum - 1) % SPECIAL_ROOM_CYCLE.length];

    this.tileSize = 2.0;
    this.gridWidth = fNum === 16 ? 68 : isBossFloor ? 66 : 64;
    this.gridHeight = fNum === 16 ? 76 : isBossFloor ? 72 : 64;
    this.originX = -(this.gridWidth * this.tileSize) * 0.5;
    this.originZ = -(this.gridHeight * this.tileSize) * 0.5;

    this.grid = Array.from({ length: this.gridHeight }, () =>
      Array.from({ length: this.gridWidth }, () => TILE.WALL)
    );

    // Build deterministic connected room layout modeled on Silkroad dungeon wings
    this._plannedEdges = null;
    const generatedRooms = this._layoutDungeonRooms(fNum, isBossFloor, rand, floorDef.layoutStyle);

    // Carve rooms into grid
    for (const room of generatedRooms) {
      for (let gz = room.gz; gz < room.gz + room.gh; gz++) {
        for (let gx = room.gx; gx < room.gx + room.gw; gx++) {
          this.setTileAtGrid(gx, gz, TILE.FLOOR);
        }
      }
    }

    // Carve 3-tile-wide corridors connecting rooms (explicit palace graph or wing loops)
    if (Array.isArray(this._plannedEdges)) {
      for (const [a, b] of this._plannedEdges) {
        if (generatedRooms[a] && generatedRooms[b]) {
          this._carveCorridor(generatedRooms[a], generatedRooms[b]);
        }
      }
    } else {
      for (let i = 0; i < generatedRooms.length - 1; i++) {
        this._carveCorridor(generatedRooms[i], generatedRooms[i + 1]);
      }
      if (generatedRooms.length >= 5) {
        this._carveCorridor(generatedRooms[1], generatedRooms[3]);
      }
      if (generatedRooms.length >= 7 && (floorDef.layoutStyle === 'tomb_grid' || floorDef.layoutStyle === 'basilica_wings')) {
        // Cross-axis Silkroad tomb / basilica wing junction through central nave
        this._carveCorridor(generatedRooms[2], generatedRooms[5]);
      }
    }

    // Carve biome-specific room shapes (chamfers/pockets for caves, 2-tile niches for tombs/temples, lava channels for flame)
    this._carveBiomeRoomShapes(generatedRooms, floorDef, rand);

    const COMBAT_ARCHETYPES = [
      'vanguard_courtyard',
      'pillared_cloister',
      'crucible_sanctum',
      'reliquary_hall',
      'barrack_ambush'
    ];
    const archetypeForRoom = (r, idx) => {
      if (r.type === 'start' || r.type === 'boss') return r.type;
      if (r.type === 'processional') return 'processional';
      if (r.type === 'treasure') return 'reliquary_hall';
      if (r.type === 'trap') return 'trap_gallery';
      if (r.type === 'shrine' || r.type === 'spring') return 'crucible_sanctum';
      if (r.type === 'exit') return 'vanguard_courtyard';
      return COMBAT_ARCHETYPES[(fNum * 3 + idx) % COMBAT_ARCHETYPES.length];
    };

    // Convert grid rooms to world space descriptors
    this.rooms = generatedRooms.map((r, idx) => {
      const topLeft = this.gridToWorld(r.gx, r.gz);
      const center = this.gridToWorld(
        Math.floor(r.gx + r.gw * 0.5),
        Math.floor(r.gz + r.gh * 0.5)
      );
      const roomObj = {
        id: idx,
        type: r.type,
        archetype: archetypeForRoom(r, idx),
        special: r.type === 'treasure' ? 'vault' : (r.type === 'trap' ? 'trap_gallery' : r.type === 'processional' ? 'processional' : r.type === 'shrine' ? 'shrine' : r.type === 'spring' ? 'celestial_spring' : null),
        gx: r.gx,
        gz: r.gz,
        gw: r.gw,
        gh: r.gh,
        x: topLeft.x - this.tileSize * 0.5,
        y: topLeft.z - this.tileSize * 0.5,
        z: topLeft.z - this.tileSize * 0.5,
        w: r.gw * this.tileSize,
        h: r.gh * this.tileSize,
        centerX: center.x,
        centerZ: center.z,
        explored: idx === 0,
        cleared: idx === 0,
        encounterPlan: null
      };
      if (r.type === 'boss') {
        this.bossRoom = roomObj;
      }
      return roomObj;
    });

    // Build 3D floor & wall meshes using instancing for crisp performance
    this._buildDungeonGeometry(rand);

    // Populate rooms with portals, chests, gates/switches, traps, torches, pillars & breakables
    this._populateDungeonFeatures(fNum, isBossFloor, rand);

    return this.getFloorState();
  }

  _layoutDungeonRooms(floorNum, isBossFloor, rand, layoutStyle = 'cavern_branch') {
    const mkRoom = (id, type, gx, gz, gw, gh) => ({
      id,
      type,
      gx,
      gz,
      gw,
      gh,
      cx: Math.floor(gx + gw * 0.5),
      cz: Math.floor(gz + gh * 0.5)
    });

    // Dedicated Grand Final Boss Sanctum on Floor 16 (Mountain Roc Peak — Sky Nest):
    // Ceremonal Sky Gate Foyer -> Wing Sanctuaries -> Imperial Processional Bridge -> Colossal 52m x 48m Sky Nest Throne
    if (floorNum === 16) {
      this._plannedEdges = [
        [0, 2], [0, 4], [4, 3], [3, 2], [2, 1], [2, 5]
      ];
      return [
        mkRoom(0, 'start', 27, 55, 14, 12),
        mkRoom(1, 'spring', 6, 35, 14, 13),
        mkRoom(2, 'processional', 26, 33, 16, 15),
        mkRoom(3, 'shrine', 48, 35, 14, 13),
        mkRoom(4, 'treasure', 48, 54, 14, 12),
        mkRoom(5, 'boss', 21, 4, 26, 24)
      ];
    }

    const special = SPECIAL_ROOM_CYCLE[(floorNum - 1) % SPECIAL_ROOM_CYCLE.length];
    const centerSpecial = special === 'processional' ? 'processional' : special === 'celestial_spring' ? 'spring' : 'combat';
    const sideSpecial = special === 'shrine' ? 'shrine' : 'combat';
    const trapOrCombat = special === 'trap_gallery' ? 'trap' : 'combat';

    // Dedicated Grand Boss Amphitheater Floors (F3, F6, F9, F12, F15, S3F):
    // Symmetrical multi-wing approaches feeding into a massive 48m x 40m (24x20 tiles) Sovereign Arena
    if (isBossFloor) {
      const swapSides = rand() < 0.5;
      const westCol = swapSides ? 46 : 4;
      const eastCol = swapSides ? 4 : 46;
      const wingGx = swapSides ? 49 : 4;
      this._plannedEdges = [
        [0, 1], [1, 3], [3, 5], [0, 2], [2, 4], [4, 6], [3, 6], [0, 6], [6, 7]
      ];
      return [
        mkRoom(0, 'start', 25, 50, 16, 14),
        mkRoom(1, 'combat', westCol, 49, 16, 14),
        mkRoom(2, 'treasure', eastCol, 49, 16, 14),
        mkRoom(3, sideSpecial, westCol, 27, 16, 16),
        mkRoom(4, trapOrCombat, eastCol, 27, 16, 16),
        mkRoom(5, 'combat', wingGx, 5, 14, 16),
        mkRoom(6, centerSpecial === 'combat' ? 'processional' : centerSpecial, 25, 27, 16, 16),
        mkRoom(7, 'boss', 21, 3, 24, 20)
      ];
    }

    // Structured 3x3 sector blueprint per Silkroad dungeon archetype (expanded 64x64 grid, 24m..34m halls)
    const finalType = 'exit';
    let sectors;
    if (layoutStyle === 'tomb_grid') {
      sectors = [
        { sx: 1, sz: 2, defaultType: 'start' },
        { sx: 1, sz: 1, defaultType: centerSpecial === 'combat' ? 'processional' : centerSpecial },
        { sx: 0, sz: 1, defaultType: sideSpecial },
        { sx: 0, sz: 0, defaultType: 'combat' },
        { sx: 2, sz: 1, defaultType: trapOrCombat },
        { sx: 2, sz: 2, defaultType: 'treasure' },
        { sx: 2, sz: 0, defaultType: 'combat' },
        { sx: 1, sz: 0, defaultType: finalType }
      ];
    } else if (layoutStyle === 'basilica_wings') {
      sectors = [
        { sx: 1, sz: 2, defaultType: 'start' },
        { sx: 0, sz: 2, defaultType: 'combat' },
        { sx: 0, sz: 1, defaultType: sideSpecial },
        { sx: 1, sz: 1, defaultType: centerSpecial === 'combat' ? 'processional' : centerSpecial },
        { sx: 2, sz: 1, defaultType: trapOrCombat },
        { sx: 2, sz: 2, defaultType: 'treasure' },
        { sx: 0, sz: 0, defaultType: 'combat' },
        { sx: 1, sz: 0, defaultType: finalType }
      ];
    } else if (layoutStyle === 'stronghold_wing') {
      sectors = [
        { sx: 1, sz: 2, defaultType: 'start' },
        { sx: 0, sz: 2, defaultType: 'combat' },
        { sx: 0, sz: 1, defaultType: sideSpecial },
        { sx: 1, sz: 1, defaultType: centerSpecial },
        { sx: 2, sz: 2, defaultType: 'treasure' },
        { sx: 2, sz: 1, defaultType: trapOrCombat },
        { sx: 0, sz: 0, defaultType: 'combat' },
        { sx: 1, sz: 0, defaultType: finalType }
      ];
    } else if (layoutStyle === 'caldera_ring') {
      sectors = [
        { sx: 0, sz: 2, defaultType: 'start' },
        { sx: 1, sz: 2, defaultType: 'combat' },
        { sx: 2, sz: 2, defaultType: 'treasure' },
        { sx: 2, sz: 1, defaultType: trapOrCombat },
        { sx: 2, sz: 0, defaultType: 'combat' },
        { sx: 1, sz: 1, defaultType: centerSpecial },
        { sx: 0, sz: 1, defaultType: sideSpecial },
        { sx: 1, sz: 0, defaultType: finalType }
      ];
    } else {
      sectors = [
        { sx: 0, sz: 2, defaultType: 'start' },
        { sx: 1, sz: 2, defaultType: 'combat' },
        { sx: 2, sz: 2, defaultType: 'treasure' },
        { sx: 2, sz: 1, defaultType: trapOrCombat },
        { sx: 1, sz: 1, defaultType: centerSpecial },
        { sx: 0, sz: 1, defaultType: sideSpecial },
        { sx: 0, sz: 0, defaultType: 'combat' },
        { sx: 1, sz: 0, defaultType: finalType }
      ];
    }

    const cellW = Math.floor((this.gridWidth - 6) / 3);
    const cellH = Math.floor((this.gridHeight - 6) / 3);
    const rooms = [];
    const isAxialArchitecture = layoutStyle === 'tomb_grid' || layoutStyle === 'basilica_wings';

    sectors.forEach((sec, idx) => {
      const isHall = sec.defaultType === 'processional';
      const isGallery = sec.defaultType === 'trap';
      const baseDim = layoutStyle === 'caldera_ring' ? 13 : 12;
      const rw = isHall ? Math.min(cellW - 2, 17)
        : isGallery ? 14
        : isAxialArchitecture ? Math.min(cellW - 3, 15)
        : Math.max(baseDim, Math.floor(baseDim + rand() * 5));
      const rh = isHall ? 14
        : isGallery ? 14
        : isAxialArchitecture ? Math.min(cellH - 3, 14)
        : Math.max(baseDim, Math.floor(baseDim + rand() * 5));

      const baseGx = 3 + sec.sx * cellW;
      const baseGz = 3 + sec.sz * cellH;
      const offsetX = isAxialArchitecture
        ? Math.floor(Math.max(0, (cellW - rw) * 0.5))
        : Math.floor(rand() * Math.max(1, cellW - rw - 1));
      const offsetZ = isAxialArchitecture
        ? Math.floor(Math.max(0, (cellH - rh) * 0.5))
        : Math.floor(rand() * Math.max(1, cellH - rh - 1));

      const gx = Math.min(this.gridWidth - rw - 3, Math.max(3, baseGx + offsetX));
      const gz = Math.min(this.gridHeight - rh - 3, Math.max(3, baseGz + offsetZ));

      rooms.push(mkRoom(idx, sec.defaultType, gx, gz, rw, rh));
    });

    return rooms;
  }

  _carveBiomeRoomShapes(generatedRooms, floorDef, rand) {
    const sroKey = floorDef?.sroDungeon || 'donhwang';
    const isCaveBiome = ['donhwang', 'karakoram', 'togui', 'wreck'].includes(sroKey);
    const isTempleBiome = ['qinshi', 'qinshi_b6', 'holywater', 'jupiter', 'demon', 'roc_nest'].includes(sroKey);
    const isFlameBiome = sroKey === 'flame';

    const hasAdjacentCorridor = (gx, gz, dist = 1) => {
      for (let dz = -dist; dz <= dist; dz++) {
        for (let dx = -dist; dx <= dist; dx++) {
          if (this.getTileAtGrid(gx + dx, gz + dz) === TILE.CORRIDOR) return true;
        }
      }
      return false;
    };

    const canCarveOutwardNiche = (nx, nz, nw, nh) => {
      for (let gz = nz; gz < nz + nh; gz++) {
        for (let gx = nx; gx < nx + nw; gx++) {
          if (gx < 2 || gz < 2 || gx >= this.gridWidth - 2 || gz >= this.gridHeight - 2) return false;
          if (this.getTileAtGrid(gx, gz) !== TILE.WALL) return false;
          // Ensure outer wall shell (2 tiles deep around expansion) stays solid
          for (let oz = -1; oz <= 1; oz++) {
            for (let ox = -1; ox <= 1; ox++) {
              const t = this.getTileAtGrid(gx + ox, gz + oz);
              if (t !== TILE.WALL && (gx + ox < nx || gx + ox >= nx + nw || gz + oz < nz || gz + oz >= nz + nh)) {
                // Allow touching only the parent room face
                if (t === TILE.CORRIDOR) return false;
              }
            }
          }
        }
      }
      return true;
    };

    for (const room of generatedRooms) {
      if (room.type === 'boss' || room.type === 'start' || room.type === 'trap') continue;
      if (room.gw < 10 || room.gh < 10) continue;

      if (isCaveBiome) {
        // Chamfer free outer corners (1-2 tiles) while keeping central 5x5 (>=10x10m) and corridors intact
        const corners = [
          [room.gx, room.gz, 1, 1],
          [room.gx + room.gw - 1, room.gz, -1, 1],
          [room.gx, room.gz + room.gh - 1, 1, -1],
          [room.gx + room.gw - 1, room.gz + room.gh - 1, -1, -1]
        ];
        if (room.type !== 'treasure') {
          corners.forEach(([cgx, cgz, sx, sz], ci) => {
            if ((ci + room.id) % 2 !== 0 && rand() < 0.35) return;
            const span = room.gw >= 13 && room.gh >= 13 ? 2 : 1;
            for (let dz = 0; dz < span; dz++) {
              for (let dx = 0; dx < span - dz; dx++) {
                const tx = cgx + sx * dx;
                const tz = cgz + sz * dz;
                if (Math.abs(tx - room.cx) <= 2 && Math.abs(tz - room.cz) <= 2) continue;
                if (!hasAdjacentCorridor(tx, tz, 2)) this.setTileAtGrid(tx, tz, TILE.WALL);
              }
            }
          });
        }
        // Organic cave pockets carved outward into solid wall
        const pocketDirs = [
          [Math.floor(room.cx - 1), room.gz - 2, 3, 2],
          [Math.floor(room.cx - 1), room.gz + room.gh, 3, 2],
          [room.gx - 2, Math.floor(room.cz - 1), 2, 3],
          [room.gx + room.gw, Math.floor(room.cz - 1), 2, 3]
        ];
        for (const [px, pz, pw, ph] of pocketDirs) {
          if (rand() < 0.55 && canCarveOutwardNiche(px, pz, pw, ph)) {
            for (let gz = pz; gz < pz + ph; gz++) {
              for (let gx = px; gx < px + pw; gx++) this.setTileAtGrid(gx, gz, TILE.FLOOR);
            }
          }
        }
      } else if (isTempleBiome) {
        // Symmetrical 2-tile deep side niches for chests, shrines & archers
        const niches = [
          [Math.floor(room.cx - 1), room.gz - 2, 3, 2],
          [Math.floor(room.cx - 1), room.gz + room.gh, 3, 2],
          [room.gx - 2, Math.floor(room.cz - 1), 2, 3],
          [room.gx + room.gw, Math.floor(room.cz - 1), 2, 3]
        ];
        niches.forEach(([nx, nz, nw, nh], idx) => {
          if (idx % 2 === 0 || rand() < 0.65) {
            if (canCarveOutwardNiche(nx, nz, nw, nh)) {
              for (let gz = nz; gz < nz + nh; gz++) {
                for (let gx = nx; gx < nx + nw; gx++) this.setTileAtGrid(gx, gz, TILE.FLOOR);
              }
            }
          }
        });
      } else if (isFlameBiome && room.type === 'combat' && room.gw >= 12 && room.gh >= 12) {
        // Perimeter lava channels (TILE.PIT) leaving >= 10x10m (5x5 tile) center & doorways walkable
        const minX = room.gx + 2;
        const maxX = room.gx + room.gw - 3;
        const minZ = room.gz + 2;
        const maxZ = room.gz + room.gh - 3;
        for (let gx = minX; gx <= maxX; gx++) {
          if (Math.abs(gx - room.cx) <= 2) continue;
          if (!hasAdjacentCorridor(gx, room.gz + 1, 2)) this.setTileAtGrid(gx, room.gz + 1, TILE.PIT);
          if (!hasAdjacentCorridor(gx, room.gz + room.gh - 2, 2)) this.setTileAtGrid(gx, room.gz + room.gh - 2, TILE.PIT);
        }
        for (let gz = minZ; gz <= maxZ; gz++) {
          if (Math.abs(gz - room.cz) <= 2) continue;
          if (!hasAdjacentCorridor(room.gx + 1, gz, 2)) this.setTileAtGrid(room.gx + 1, gz, TILE.PIT);
          if (!hasAdjacentCorridor(room.gx + room.gw - 2, gz, 2)) this.setTileAtGrid(room.gx + room.gw - 2, gz, TILE.PIT);
        }
      }
    }
  }

  _carveCorridor(roomA, roomB) {
    let x = roomA.cx;
    let z = roomA.cz;
    const targetX = roomB.cx;
    const targetZ = roomB.cz;

    const carveBrush = (cx, cz) => {
      for (let dz = -1; dz <= 1; dz++) {
        for (let dx = -1; dx <= 1; dx++) {
          const cur = this.getTileAtGrid(cx + dx, cz + dz);
          if (cur === TILE.WALL) {
            this.setTileAtGrid(cx + dx, cz + dz, TILE.CORRIDOR);
          }
        }
      }
    };

    while (x !== targetX) {
      carveBrush(x, z);
      x += x < targetX ? 1 : -1;
    }
    while (z !== targetZ) {
      carveBrush(x, z);
      z += z < targetZ ? 1 : -1;
    }
    carveBrush(targetX, targetZ);

    this.corridors.push({
      from: roomA.id,
      to: roomB.id,
      midGx: roomB.cx,
      midGz: roomA.cz
    });
  }

  _buildDungeonGeometry(rand) {
    const floorTiles = [];
    const wallTiles = [];
    const pitTiles = [];

    const hasAdjacentWalkable = (gx, gz) => {
      for (let dz = -1; dz <= 1; dz++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dz === 0) continue;
          const t = this.getTileAtGrid(gx + dx, gz + dz);
          if (t === TILE.FLOOR || t === TILE.CORRIDOR || t === TILE.DOOR_OPEN || t === TILE.DOOR_CLOSED || t === TILE.PIT) {
            return true;
          }
        }
      }
      return false;
    };

    for (let gz = 0; gz < this.gridHeight; gz++) {
      for (let gx = 0; gx < this.gridWidth; gx++) {
        const t = this.grid[gz][gx];
        if (t === TILE.FLOOR || t === TILE.CORRIDOR || t === TILE.DOOR_OPEN || t === TILE.DOOR_CLOSED) {
          floorTiles.push({ gx, gz, t });
        } else if (t === TILE.PIT) {
          pitTiles.push({ gx, gz });
        } else if (t === TILE.WALL && hasAdjacentWalkable(gx, gz)) {
          wallTiles.push({ gx, gz });
        }
      }
    }
    this._wallTiles = wallTiles;
    this._pitTiles = pitTiles;
    this._batch = new InstanceBatch();

    // Low, moody fill: the renderer's atmosphere carries most of the light; torches/braziers are
    // emissive meshes and the 8-light pool (see _updateLightBudget) adds warm local light.
    const atm = this.theme.atmosphere || {};
    const dungeonAmbient = new THREE.AmbientLight(atm.ambientColor ?? this.theme.ambientColor ?? 0xffffff, 0.32);
    const dungeonHemi = new THREE.HemisphereLight(0xb8c0d8, this.theme.floorColor, 0.38);
    dungeonHemi.position.set(0, 18, 0);
    this.rootGroup.add(dungeonAmbient, dungeonHemi);

    // Instanced floor tiles with continuous world-XZ texture mapping (prevents 2m box tiling)
    const floorGeo = new THREE.BoxGeometry(this.tileSize, 0.16, this.tileSize);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: new THREE.Color(this.theme.floorColor),
      emissiveIntensity: 0.14,
      roughness: 0.72,
      metalness: 0.05
    });
    floorMat.customProgramCacheKey = () => 'dungeon_floor_worldxz_v1';
    floorMat.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec2 vFloorWorldXZ;')
        .replace(
          '#include <worldpos_vertex>',
          `#include <worldpos_vertex>
vec4 floorWp = vec4(transformed, 1.0);
#ifdef USE_INSTANCING
  floorWp = instanceMatrix * floorWp;
#endif
vFloorWorldXZ = (modelMatrix * floorWp).xz;`
        );
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying vec2 vFloorWorldXZ;')
        .replace(
          '#include <map_fragment>',
          `#ifdef USE_MAP
  vec4 sampledDiffuseColor = texture2D( map, vFloorWorldXZ * 0.22 );
  diffuseColor *= sampledDiffuseColor;
#endif`
        );
    };

    const applySurfaceTexture = (mat, texUrl) => {
      if (typeof window === 'undefined' || !texUrl) return;
      try {
        const texLoader = new THREE.TextureLoader();
        texLoader.load(texUrl, (tex) => {
          tex.wrapS = THREE.RepeatWrapping;
          tex.wrapT = THREE.RepeatWrapping;
          tex.repeat.set(1, 1);
          tex.colorSpace = THREE.SRGBColorSpace;
          mat.map = tex;
          mat.needsUpdate = true;
        });
      } catch (e) {
        // Safe fallback in headless/test environments
      }
    };

    // Apply authentic Silkroad dungeon floor texture extracted from SilkroadTR Data.pk2
    applySurfaceTexture(floorMat, this.theme?.floorTexture);

    const floorInst = new THREE.InstancedMesh(floorGeo, floorMat, Math.max(1, floorTiles.length));
    floorInst.receiveShadow = true;

    const dummy = new THREE.Object3D();
    const color = new THREE.Color();
    const baseFloorCol = new THREE.Color(this.theme.floorColor);
    const altFloorCol = new THREE.Color(this.theme.altFloorColor || this.theme.floorColor);

    floorTiles.forEach((tile, i) => {
      const pos = this.gridToWorld(tile.gx, tile.gz);
      // Fixed at -0.08 with height 0.16 and slight overlap (1.002) to eliminate black seam gaps
      dummy.position.set(pos.x, -0.08, pos.z);
      dummy.scale.set(1.002, 1, 1.002);
      dummy.updateMatrix();
      floorInst.setMatrixAt(i, dummy.matrix);

      const checker = (tile.gx + tile.gz) % 2 === 0;
      color.copy(checker ? baseFloorCol : altFloorCol);
      color.multiplyScalar(0.95 + rand() * 0.09);
      if (tile.t === TILE.CORRIDOR) color.multiplyScalar(0.96);
      floorInst.setColorAt(i, color);
    });
    floorInst.instanceMatrix.needsUpdate = true;
    if (floorInst.instanceColor) floorInst.instanceColor.needsUpdate = true;
    this.rootGroup.add(floorInst);

    // Sunken glowing magma channel slabs for Flame Mountain TILE.PIT channels
    if (pitTiles.length > 0) {
      const pitGeo = new THREE.BoxGeometry(this.tileSize * 1.002, 0.12, this.tileSize * 1.002);
      const pitMat = new THREE.MeshStandardMaterial({
        color: 0xff5a1f,
        emissive: new THREE.Color(0xea580c),
        emissiveIntensity: 0.95,
        roughness: 0.35
      });
      const pitInst = new THREE.InstancedMesh(pitGeo, pitMat, pitTiles.length);
      pitTiles.forEach((tile, i) => {
        const pos = this.gridToWorld(tile.gx, tile.gz);
        dummy.position.set(pos.x, -0.14, pos.z);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        pitInst.setMatrixAt(i, dummy.matrix);
      });
      pitInst.instanceMatrix.needsUpdate = true;
      this.rootGroup.add(pitInst);
    }

    // Instanced perimeter wall blocks with authentic Silkroad dungeon wall masonry/carving textures
    const wallHeight = this.zone === 'challenge' ? 3.5 : (this.bossRoom ? 3.55 : 3.05);
    const isArchTheme = ['qinshi', 'qinshi_b6', 'holywater', 'jupiter', 'demon', 'roc_nest', 'karakoram'].includes(this.sroDungeon);
    const wallGeo = new THREE.BoxGeometry(this.tileSize, wallHeight, this.tileSize);
    const wallMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: new THREE.Color(this.theme.wallColor),
      emissiveIntensity: 0.13,
      roughness: 0.7,
      metalness: 0.06
    });
    applySurfaceTexture(wallMat, this.theme?.wallTexture);
    const wallInst = new THREE.InstancedMesh(wallGeo, wallMat, Math.max(1, wallTiles.length));
    wallInst.castShadow = false;
    wallInst.receiveShadow = true;

    // Carved trim cornice cap + base skirting plinths along perimeter walls
    const corniceGeo = new THREE.BoxGeometry(this.tileSize * 1.08, 0.2, this.tileSize * 1.08);
    const corniceMat = new THREE.MeshStandardMaterial({
      color: this.theme.trimColor || 0x94a3b8,
      roughness: 0.55,
      metalness: 0.25
    });
    const corniceInst = new THREE.InstancedMesh(corniceGeo, corniceMat, Math.max(1, wallTiles.length));
    corniceInst.receiveShadow = true;

    const skirtingGeo = new THREE.BoxGeometry(this.tileSize * 1.05, 0.22, this.tileSize * 1.05);
    const skirtingMat = new THREE.MeshStandardMaterial({
      color: tint(this.theme.wallColor || 0x64748b, 0.72),
      roughness: 0.78,
      metalness: 0.12
    });
    const skirtingInst = new THREE.InstancedMesh(skirtingGeo, skirtingMat, Math.max(1, wallTiles.length));
    skirtingInst.receiveShadow = true;

    const baseWallCol = new THREE.Color(this.theme.wallColor);
    wallTiles.forEach((tile, i) => {
      const pos = this.gridToWorld(tile.gx, tile.gz);
      const hScale = isArchTheme ? 1.0 : (0.96 + rand() * 0.08);
      dummy.position.set(pos.x, (wallHeight * hScale) * 0.5, pos.z);
      dummy.scale.set(1, hScale, 1);
      dummy.updateMatrix();
      wallInst.setMatrixAt(i, dummy.matrix);

      color.copy(baseWallCol).multiplyScalar(isArchTheme ? (0.97 + rand() * 0.06) : (0.93 + rand() * 0.12));
      wallInst.setColorAt(i, color);

      dummy.position.set(pos.x, wallHeight * hScale + 0.08, pos.z);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      corniceInst.setMatrixAt(i, dummy.matrix);

      dummy.position.set(pos.x, 0.11, pos.z);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      skirtingInst.setMatrixAt(i, dummy.matrix);
    });
    wallInst.instanceMatrix.needsUpdate = true;
    if (wallInst.instanceColor) wallInst.instanceColor.needsUpdate = true;
    corniceInst.instanceMatrix.needsUpdate = true;
    skirtingInst.instanceMatrix.needsUpdate = true;
    this.rootGroup.add(wallInst, corniceInst, skirtingInst);
  }

  /** True when a prop of `radius` can be dropped at (x, z) without clipping other solids/traps/doorways. */
  _spotFree(x, z, radius = 0.5, pad = 3) {
    if (nearOpening(this, x, z, pad)) return false;
    for (const r of this._reserved) {
      if (Math.hypot(x - r.x, z - r.z) < r.r) return false;
    }
    for (const o of this.solidObstacles) {
      if (Math.hypot(x - o.x, z - o.z) < o.radius + radius) return false;
    }
    for (const t of this.traps) {
      if (Math.hypot(x - t.x, z - t.z) < t.radius + radius + 0.4) return false;
    }
    for (const g of this.gates) {
      if (Math.hypot(x - g.x, z - g.z) < g.radius + radius) return false;
    }
    return true;
  }

  _populateDungeonFeatures(floorNum, isBossFloor, rand) {
    const startRoom = this.rooms[0];
    const st = styleFor(this.theme);
    const batch = this._batch || (this._batch = new InstanceBatch());
    this.spawnPoint = {
      x: startRoom.centerX,
      y: 0,
      z: startRoom.centerZ
    };

    // Return-to-Village portal in start room, outside interaction reach of the spawn point so
    // pressing E right after arriving does not bounce the player straight back to town
    const returnPortalMesh = (this.models3d?.createPortalMesh || createPortalMesh)(
      { color: 0x38bdf8, portalStyle: this.theme.portalStyle },
      'village'
    );
    const returnPortalPos = {
      x: startRoom.centerX - 2.8,
      y: 0,
      z: startRoom.centerZ - 3.4
    };
    returnPortalMesh.position.set(returnPortalPos.x, 0, returnPortalPos.z);
    this.rootGroup.add(returnPortalMesh);

    this.portals.push({
      id: `return_village_f${floorNum}`,
      type: 'portal',
      portalType: 'village',
      name: 'Town Portal to Oakhaven',
      targetFloor: 0,
      x: returnPortalPos.x,
      y: 0,
      z: returnPortalPos.z,
      position: returnPortalPos,
      prompt: 'Return to Oakhaven Village [E]',
      mesh: returnPortalMesh
    });
    // Keep decor/breakables off the portal pavilions
    this._reserved.push({ x: returnPortalPos.x, z: returnPortalPos.z, r: 2.4 });
    const exitRoom = this.rooms.find((r) => r.type === 'exit');
    if (exitRoom) this._reserved.push({ x: exitRoom.centerX, z: exitRoom.centerZ, r: 2.4 });

    // --- Vault alcove + puzzle placement (reserved first so decor keeps clear of them) ---------
    const vaultRoom = this.rooms.find((r) => r.type === 'treasure');
    const vaultCorner = vaultRoom ? bestCorner(this, vaultRoom, 4) : null;
    const vault = vaultRoom && vaultCorner ? buildVaultAlcove(this, batch, vaultRoom, vaultCorner) : null;
    const gateId = `f${floorNum}_gate_treasure`;
    if (vault) {
      this._reserved.push({ x: vault.center.x, z: vault.center.z, r: 4.2 });
      const gate = this._spawnGate(vault.gate.x, vault.gate.z, gateId, false);
      if (gate.mesh) gate.mesh.rotation.y = Math.PI / 2;
    }
    const puzzleRoom = this.rooms[1];
    if (vault) this._buildPuzzle(floorNum, puzzleRoom, gateId, rand);

    // --- Theme decor: pillars, arches, rubble, per-theme props --------------------------------
    decorateFloor(this, batch, rand, this._wallTiles || []);

    // --- Per-room content --------------------------------------------------------------------
    this.rooms.forEach((room, idx) => {
      // Corner torches: emissive instances pinned tight to walkable corners, lit by pooled lights
      const torchOffsets = [
        [room.x + 0.85, room.z + 0.85],
        [room.x + room.w - 0.85, room.z + 0.85],
        [room.x + 0.85, room.z + room.h - 0.85],
        [room.x + room.w - 0.85, room.z + room.h - 0.85]
      ];
      torchOffsets.forEach(([tx, tz]) => {
        if (this.isWalkable(tx, tz, 0.25) && !nearOpening(this, tx, tz, 3.2)) {
          this._spawnTorch(tx, tz, this.theme.torchColor);
        }
      });

      if (room.type === 'start') {
        const wallOffset = 0.75;
        const startX = room.x + wallOffset;
        const startZ = room.z + room.h - wallOffset;
        if (!nearOpening(this, startX, startZ, 4)) {
          this._spawnBreakable(startX, startZ - 1.0, 'barrel', `f${floorNum}_b_start1`);
          this._spawnBreakable(startX + 0.9, startZ, 'crate', `f${floorNum}_b_start2`);
        }
      } else if (room.type === 'treasure') {
        // Treasure vault: 2-3 chests inside the gated alcove
        const mainTier = floorNum >= 9 ? 'epic' : floorNum >= 4 ? 'rare' : 'magic';
        const chestCount = this.specialRoomType === 'vault' ? 3 : 2;
        const slots = vault ? vault.slots : [{ x: room.centerX, z: room.centerZ }, { x: room.centerX + 2.4, z: room.centerZ - 1.6 }, { x: room.centerX - 2.4, z: room.centerZ - 1.6 }];
        const tiers = [mainTier, 'rare', 'normal'];
        for (let c = 0; c < chestCount; c++) {
          const id = c === 0 ? `f${floorNum}_chest_treasure_main` : `f${floorNum}_chest_treasure_side${c}`;
          this._spawnChest(slots[c].x, slots[c].z, c === 0 ? tiers[0] : (c === 1 ? 'normal' : 'rare'), id);
        }
        if (floorNum === 1 && vault) {
          // Floor 1 keeps the simple lever (puzzles start on floor 2)
          const corner = this._pickPuzzleCorner(puzzleRoom);
          const lx = puzzleRoom.centerX + (corner.sx * (puzzleRoom.w * 0.5 - 2.2));
          const lz = puzzleRoom.centerZ + (corner.sz * (puzzleRoom.h * 0.5 - 2.2));
          this._spawnSwitch(lx, lz, gateId, 'Pull Rune Lever (Unlocks Treasure Vault) [E]');
          this._reserved.push({ x: lx, z: lz, r: 1.8 });
          this.puzzle = { type: 'lever', solved: false, gateId };
        }
      } else if (room.type === 'trap') {
        this._buildTrapGallery(room, floorNum, rand);
        dressSpecialRoom(this, batch, room, 'trap_gallery', rand);
      } else if (room.type === 'shrine') {
        const shrineSlot = this._pickWallNicheSpot(room, 2.7) || { x: room.centerX, z: room.z + 2.8, side: 'N' };
        this._spawnShrine(shrineSlot.x, shrineSlot.z, floorNum, null, shrineSlot.side);
        this._reserved.push({ x: shrineSlot.x, z: shrineSlot.z, r: 2.0 });
        dressSpecialRoom(this, batch, room, 'shrine', rand);
      } else if (room.type === 'processional') {
        dressSpecialRoom(this, batch, room, 'processional', rand);
        this._spawnChest(room.x + room.w - 2.4, room.centerZ, 'rare', `f${floorNum}_chest_hall`);
      } else if (room.type === 'spring') {
        this._buildCelestialSpring(room, floorNum, rand);
        dressSpecialRoom(this, batch, room, 'spring', rand);
      } else if (room.type === 'exit') {
        const floorDef = (floorNum >= 100 ? FLOOR_DEFINITIONS.find(d => d.floor === floorNum) : null)
          || FLOOR_DEFINITIONS[(floorNum - 1) % FLOOR_DEFINITIONS.length]
          || FLOOR_DEFINITIONS[0];
        const returnFl = floorDef.returnFloor ?? (floorNum >= 100 ? 0 : floorNum + 1);
        const exitPrompt = returnFl === 0 ? 'Return to Village [E]' : `Descend to Floor ${returnFl} [E]`;
        const exitName = returnFl === 0 ? 'Portal to Village' : `Passage to Floor ${returnFl}`;

        const stairsMesh = (this.models3d?.createStairsMesh || createStairsMesh)('down');
        stairsMesh.position.set(room.centerX - 3.0, 0, room.centerZ - 2.6);
        this.rootGroup.add(stairsMesh);

        const nextPortalMesh = (this.models3d?.createPortalMesh || createPortalMesh)(
          { color: this.theme.portalColor, portalStyle: this.theme.portalStyle },
          'next_floor'
        );
        nextPortalMesh.position.set(room.centerX, 0, room.centerZ);
        this.rootGroup.add(nextPortalMesh);

        // portal glow joins the pooled light budget instead of owning a light
        this._lightSources.push({ x: room.centerX, y: 1.8, z: room.centerZ, color: this.theme.portalColor, intensity: 2.2, distance: 11 });

        this.portals.push({
          id: `next_floor_f${floorNum}`,
          type: 'portal',
          portalType: returnFl === 0 ? 'village' : 'next_floor',
          name: exitName,
          targetFloor: returnFl,
          x: room.centerX,
          y: 0,
          z: room.centerZ,
          position: { x: room.centerX, y: 0, z: room.centerZ },
          prompt: exitPrompt,
          mesh: nextPortalMesh
        });

        this._spawnChest(room.centerX + 3.0, room.centerZ - 2.0, 'magic', `f${floorNum}_chest_exit`);
      } else if (room.type === 'boss') {
        this._decorateBossArena(room, floorNum);
      }

      // Breakables: Yerleşim kesinlikle kapı/koridor ağızlarından uzak (>= 4.5m), derin duvar kenarlarına ve kör köşelerine yakın
      if (room.type !== 'start' && room.type !== 'trap') {
        const breakTypes = (this.theme.breakableTypes || ['barrel', 'crate', 'urn']).filter((t) => t !== 'crystal');
        const targetCount = 3 + Math.floor(rand() * 3);
        let placed = 0;
        let attempts = 0;

        // Odaya bağlanan kapı ve koridor geçiş noktalarını topla (eşikler ve açıklıklar)
        const roomDoorways = [];
        for (let gx = room.gx; gx < room.gx + room.gw; gx++) {
          const tN = this.getTileAtGrid(gx, room.gz - 1);
          if (tN === TILE.CORRIDOR || tN === TILE.DOOR_CLOSED) {
            roomDoorways.push(this.gridToWorld(gx, room.gz));
            roomDoorways.push(this.gridToWorld(gx, room.gz - 1));
          }
          const tS = this.getTileAtGrid(gx, room.gz + room.gh);
          if (tS === TILE.CORRIDOR || tS === TILE.DOOR_CLOSED) {
            roomDoorways.push(this.gridToWorld(gx, room.gz + room.gh - 1));
            roomDoorways.push(this.gridToWorld(gx, room.gz + room.gh));
          }
        }
        for (let gz = room.gz; gz < room.gz + room.gh; gz++) {
          const tW = this.getTileAtGrid(room.gx - 1, gz);
          if (tW === TILE.CORRIDOR || tW === TILE.DOOR_CLOSED) {
            roomDoorways.push(this.gridToWorld(room.gx, gz));
            roomDoorways.push(this.gridToWorld(room.gx - 1, gz));
          }
          const tE = this.getTileAtGrid(room.gx + room.gw, gz);
          if (tE === TILE.CORRIDOR || tE === TILE.DOOR_CLOSED) {
            roomDoorways.push(this.gridToWorld(room.gx + room.gw - 1, gz));
            roomDoorways.push(this.gridToWorld(room.gx + room.gw, gz));
          }
        }
        for (const g of this.gates) {
          roomDoorways.push({ x: g.x, z: g.z });
        }

        const isSafeSpot = (bx, bz) => {
          // 1. Duvardan uzaklık kontrolü (kesinlikle 0.7 - 1.25 birim aralığında olmalı)
          const dW = bx - room.x;
          const dE = (room.x + room.w) - bx;
          const dN = bz - room.z;
          const dS = (room.z + room.h) - bz;
          const distToWall = Math.min(dW, dE, dN, dS);
          if (distToWall < 0.68 || distToWall > 1.25) return false;

          // 2. Odanın orta alanı dövüş ve hareket için temiz, ferah kalsın
          if (Math.hypot(bx - room.centerX, bz - room.centerZ) < 3.2) return false;

          // 3. Grid tile kontrolü (zemin üzerinde olmalı)
          const { gx, gz } = this.worldToGrid(bx, bz);
          if (this.getTileAtGrid(gx, gz) !== TILE.FLOOR) return false;

          // 4. Kapı veya koridor açıklıklarına yakın olmamalı (sıkı denetim pad = 3)
          if (nearOpening(this, bx, bz, 3)) return false;

          // 5. Odaların kapı geçiş noktalarından (kapı eşiklerinden) en az 4.5 birim uzakta olmalı
          for (let i = 0; i < roomDoorways.length; i++) {
            const dw = roomDoorways[i];
            if (Math.hypot(bx - dw.x, bz - dw.z) < 4.5) return false;
          }

          // 6. Diğer engeller, reserved alanlar, sandıklar, portallar ile çakışmamalı
          if (!this._spotFree(bx, bz, 0.48, 3)) return false;

          // 7. Daha önce yerleştirilmiş diğer breakable'larla çakışmamalı
          if (this.breakables.some((b) => Math.hypot(bx - b.x, bz - b.z) < 0.65)) return false;

          return true;
        };

        const corners = [
          { cx: room.x, cz: room.z, sx: 1, sz: 1 },
          { cx: room.x + room.w, cz: room.z, sx: -1, sz: 1 },
          { cx: room.x, cz: room.z + room.h, sx: 1, sz: -1 },
          { cx: room.x + room.w, cz: room.z + room.h, sx: -1, sz: -1 }
        ];

        // Kapılardan ve koridorlardan uzak kör köşeleri belirle
        const blindCorners = corners.filter((c) => {
          if (roomDoorways.some((dw) => Math.hypot(c.cx - dw.x, c.cz - dw.z) < 4.8)) return false;
          if (nearOpening(this, c.cx + c.sx * 1.2, c.cz + c.sz * 1.2, 3)) return false;
          return true;
        });
        const pickCorners = blindCorners.length > 0 ? blindCorners : corners;

        while (placed < targetCount && attempts < 80) {
          attempts++;
          let candX = 0;
          let candZ = 0;
          const wallDist = 0.78 + rand() * 0.38; // 0.78 ~ 1.16 birim

          if (rand() < 0.65 && pickCorners.length > 0) {
            // Kör köşe kümelenmesi
            const corner = pickCorners[Math.floor(rand() * pickCorners.length)];
            const mode = rand();
            if (mode < 0.45) {
              candX = corner.cx + corner.sx * wallDist;
              candZ = corner.cz + corner.sz * (wallDist + (rand() * 1.6));
            } else if (mode < 0.9) {
              candX = corner.cx + corner.sx * (wallDist + (rand() * 1.6));
              candZ = corner.cz + corner.sz * wallDist;
            } else {
              candX = corner.cx + corner.sx * (wallDist + 0.35);
              candZ = corner.cz + corner.sz * (wallDist + 0.35);
            }
          } else {
            // Derin duvar kenarı boyunca dizilim
            const side = Math.floor(rand() * 4);
            if (side === 0) {
              // Kuzey duvarı
              candZ = room.z + wallDist;
              candX = room.x + 3.0 + rand() * Math.max(1, room.w - 6.0);
            } else if (side === 1) {
              // Güney duvarı
              candZ = room.z + room.h - wallDist;
              candX = room.x + 3.0 + rand() * Math.max(1, room.w - 6.0);
            } else if (side === 2) {
              // Batı duvarı
              candX = room.x + wallDist;
              candZ = room.z + 3.0 + rand() * Math.max(1, room.h - 6.0);
            } else {
              // Doğu duvarı
              candX = room.x + room.w - wallDist;
              candZ = room.z + 3.0 + rand() * Math.max(1, room.h - 6.0);
            }
          }

          if (isSafeSpot(candX, candZ)) {
            const bType = breakTypes[Math.floor(rand() * breakTypes.length)];
            this._spawnBreakable(candX, candZ, bType, `f${floorNum}_r${idx}_b${placed}`);
            placed++;
          }
        }
      }
    });

    // Ensure every dungeon floor has at least one dynamic Power Shrine inside a framed wall niche
    if (floorNum >= 1 && !this.shrines.some((s) => s.type === 'shrine')) {
      const combatRooms = this.rooms.filter((r) => r.type === 'combat' && r.w >= 10 && r.h >= 10);
      const fallbackRooms = combatRooms.length > 0 ? combatRooms : this.rooms.filter((r) => r.type !== 'start' && r.type !== 'boss' && r.w >= 8 && r.h >= 8);
      const shrinePool = ['shrine_berserk', 'shrine_fortune', 'shrine_haste', 'shrine_sanctuary'];
      const chosenRoom = fallbackRooms.length > 0 ? fallbackRooms[Math.floor(rand() * fallbackRooms.length)] : null;
      if (chosenRoom) {
        const pickedKind = shrinePool[Math.floor(rand() * shrinePool.length)];
        const niche = this._pickWallNicheSpot(chosenRoom, 2.7, 1.4);
        if (niche) {
          this._spawnShrine(niche.x, niche.z, floorNum, pickedKind, niche.side);
          this._reserved.push({ x: niche.x, z: niche.z, r: 1.8 });
        }
      }
    }

    // Spawn 1 to 3 genuinely randomized Timed Challenge Portals inside framed perimeter wall niches
    if (floorNum >= 1 && floorNum < 100 && floorNum !== 16) {
      const chKeys = Object.keys(CHALLENGE_TYPES);
      const rollCount = Math.random();
      const targetPortals = rollCount < 0.22 ? 1 : rollCount < 0.65 ? 2 : 3;

      const eligible = this.rooms.filter(
        (r) => !['start', 'boss', 'exit', 'trap'].includes(r.type) && r.w >= 10 && r.h >= 10
      );
      const poolRooms = [...(eligible.length > 0 ? eligible : this.rooms.filter((r) => r.type !== 'start' && r.type !== 'boss'))];
      for (let i = poolRooms.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [poolRooms[i], poolRooms[j]] = [poolRooms[j], poolRooms[i]];
      }

      const usedTypes = new Set();
      let spawnedCh = 0;
      const roomIsClearOfEntities = (cx, cz) => {
        if (!this.isWalkable(cx, cz, 0.55) || nearOpening(this, cx, cz, 2.6)) return false;
        if (!this._spotFree(cx, cz, 2.0, 2.0)) return false;
        if (Math.hypot(cx - this.spawnPoint.x, cz - this.spawnPoint.z) < 4.5) return false;
        if (this.shrines.some((s) => Math.hypot(cx - s.x, cz - s.z) < 3.6)) return false;
        if (this.chests.some((c) => Math.hypot(cx - c.x, cz - c.z) < 3.1)) return false;
        if (this.portals.some((p) => Math.hypot(cx - p.x, cz - p.z) < 4.8)) return false;
        if (this.traps.some((t) => Math.hypot(cx - t.x, cz - t.z) < 2.8)) return false;
        if (this.gates.some((g) => Math.hypot(cx - g.x, cz - g.z) < 3.2)) return false;
        if ((this._placedDecor || []).some((d) => Math.hypot(cx - d.x, cz - d.z) < (d.r || 0.6) + 2.0)) return false;
        return true;
      };

      for (const rm of poolRooms) {
        if (spawnedCh >= targetPortals) break;
        let pickedType;
        if (floorNum === 1 && spawnedCh === 0) {
          pickedType = 'survival_60';
        } else {
          const unused = chKeys.filter((k) => !usedTypes.has(k));
          const typePool = unused.length > 0 ? unused : chKeys;
          pickedType = typePool[Math.floor(Math.random() * typePool.length)];
        }
        usedTypes.add(pickedType);

        const wallInset = 2.75;
        const candidates = [
          { x: rm.centerX, z: rm.z + wallInset, side: 'N' },
          { x: rm.centerX, z: rm.z + rm.h - wallInset, side: 'S' },
          { x: rm.x + wallInset, z: rm.centerZ, side: 'W' },
          { x: rm.x + rm.w - wallInset, z: rm.centerZ, side: 'E' },
          { x: rm.centerX - 4.0, z: rm.z + wallInset, side: 'N' },
          { x: rm.centerX + 4.0, z: rm.z + rm.h - wallInset, side: 'S' },
          { x: rm.x + wallInset, z: rm.centerZ - 4.0, side: 'W' },
          { x: rm.x + rm.w - wallInset, z: rm.centerZ + 4.0, side: 'E' }
        ];
        for (let i = candidates.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
        }
        for (const cand of candidates) {
          if (Math.hypot(cand.x - rm.centerX, cand.z - rm.centerZ) >= 2.8 && roomIsClearOfEntities(cand.x, cand.z)) {
            this._spawnChallengePortal(cand.x, cand.z, floorNum, pickedType, spawnedCh, cand.side);
            this._reserved.push({ x: cand.x, z: cand.z, r: 2.35 });
            spawnedCh++;
            break;
          }
        }
      }
    }

    // Build tactical encounter formations per room after all props & solids are placed
    this._buildRoomEncounterPlans(floorNum, rand);

    void st;
    this._decorMeshCount = batch.flush(this.rootGroup);
    this._createLightPool();
  }

  _buildCelestialSpring(room, floorNum, rand) {
    const cx = room.centerX;
    const cz = room.centerZ;
    this._reserved.push({ x: cx, z: cz, r: 2.5 });

    const springEntity = {
      id: `spring_f${floorNum}`,
      type: 'celestial_spring',
      name: 'Celestial Spring of Vigour',
      x: cx,
      y: 0,
      z: cz,
      position: { x: cx, y: 0, z: cz },
      radius: 2.5,
      used: false,
      prompt: 'Drink from Celestial Spring (Full Restore & 15% Blessing) [E]'
    };
    this.shrines.push(springEntity);

    this._lightSources.push({
      x: cx,
      y: 1.8,
      z: cz,
      color: 0x38bdf8,
      intensity: 2.4,
      distance: 10
    });
  }

  _spawnSecretPortal(x, z, targetFloor) {
    const portalMesh = (this.models3d?.createPortalMesh || createPortalMesh)(
      { color: 0xec4899, portalStyle: this.theme?.portalStyle },
      'secret_rift'
    );
    portalMesh.position.set(x, 0, z);
    this.rootGroup.add(portalMesh);
    this._lightSources.push({ x, y: 1.8, z, color: 0xec4899, intensity: 2.8, distance: 12 });

    const secretPortal = {
      id: `secret_portal_f${this.currentFloor}`,
      type: 'portal',
      portalType: 'secret_portal',
      name: `Rift to Secret Floor S${targetFloor - 100}F`,
      targetFloor,
      x,
      y: 0,
      z,
      position: { x, y: 0, z },
      prompt: `Enter Secret Rift (Floor S${targetFloor - 100}F) [E]`,
      mesh: portalMesh
    };
    this.portals.push(secretPortal);
  }

  _pickWallNicheSpot(room, inset = 2.7, pad = 1.6) {
    if (!room) return null;
    const spots = [
      { x: room.centerX, z: room.z + inset, side: 'N' },
      { x: room.centerX, z: room.z + room.h - inset, side: 'S' },
      { x: room.x + inset, z: room.centerZ, side: 'W' },
      { x: room.x + room.w - inset, z: room.centerZ, side: 'E' },
      { x: room.centerX - 3.6, z: room.z + inset, side: 'N' },
      { x: room.centerX + 3.6, z: room.z + room.h - inset, side: 'S' },
      { x: room.x + inset, z: room.centerZ - 3.6, side: 'W' },
      { x: room.x + room.w - inset, z: room.centerZ + 3.6, side: 'E' }
    ];
    for (const s of spots) {
      if (Math.hypot(s.x - room.centerX, s.z - room.centerZ) < 2.2) continue;
      if (!this.isWalkable(s.x, s.z, 0.5)) continue;
      if (nearOpening(this, s.x, s.z, 2.7)) continue;
      if (!this._spotFree(s.x, s.z, 0.9, pad)) continue;
      return s;
    }
    return null;
  }

  _spawnChallengePortal(x, z, floorNum, challengeType = 'survival_60', index = 0, nicheSide = 'N') {
    const cfg = CHALLENGE_TYPES[challengeType] || CHALLENGE_TYPES.survival_60;
    const portalMesh = (this.models3d?.createPortalMesh || createPortalMesh)(
      { color: cfg.color, portalStyle: this.theme?.portalStyle },
      'challenge'
    );
    portalMesh.position.set(x, 0, z);
    if (nicheSide === 'W' || nicheSide === 'E') portalMesh.rotation.y = Math.PI / 2;
    this.rootGroup.add(portalMesh);
    this._lightSources.push({ x, y: 2.2, z, color: cfg.color, intensity: 3.1, distance: 13 });

    // Framed wall-niche stone arch piers & runic ground seal under every Challenge Portal
    if (this._batch) {
      const horiz = nicheSide === 'N' || nicheSide === 'S';
      this._batch.add('cyl', x, 0.014, z, 3.1, 0.028, 3.1, 0, 0x1e293b);
      this._batch.add('glowTorus', x, 0.032, z, 2.75, 2.75, 0.16, 0, cfg.color, Math.PI / 2);
      for (const s of [-1.55, 1.55]) {
        const px = horiz ? x + s : x;
        const pz = horiz ? z : z + s;
        this._batch.add('box', px, 1.35, pz, 0.36, 2.7, 0.36, 0, 0x334155);
        this._batch.add('glowBox', px, 1.45, pz, 0.24, 0.36, 0.24, 0, cfg.color);
      }
      this._batch.add('box', x, 2.78, z, horiz ? 3.55 : 0.44, 0.28, horiz ? 0.44 : 3.55, 0, 0x475569);
    }

    const portal = {
      id: index === 0 ? `challenge_portal_f${floorNum}` : `challenge_portal_f${floorNum}_${index}`,
      type: 'portal',
      portalType: 'challenge_portal',
      challengeType: cfg.id,
      challengeCfg: cfg,
      floorNum,
      completed: false,
      name: cfg.name,
      x,
      y: 0,
      z,
      position: { x, y: 0, z },
      prompt: `⚔️ Enter Challenge: ${cfg.name} (${cfg.duration}s) [E]`,
      mesh: portalMesh
    };
    this.portals.push(portal);
    return portal;
  }

  _buildRoomEncounterPlans(floorNum, rand) {
    const ARCHETYPE_SLOTS = {
      vanguard_courtyard: [
        [-0.28, 0.45, 'vanguard', false, false],
        [0.28, 0.45, 'vanguard', false, false],
        [0, 0.22, 'vanguard', false, false],
        [-0.48, -0.25, 'ranged', false, false],
        [0.48, -0.25, 'ranged', false, false],
        [0, -0.42, 'captain', true, false]
      ],
      pillared_cloister: [
        [-0.55, -0.55, 'ambusher', false, true],
        [-0.42, -0.45, 'ambusher', false, true],
        [0.55, -0.55, 'ambusher', false, true],
        [0.42, -0.45, 'ambusher', false, true],
        [-0.52, 0.52, 'ranged', false, false],
        [0.52, 0.52, 'ranged', false, false],
        [0, 0, 'captain', true, false]
      ],
      crucible_sanctum: [
        [-0.32, -0.32, 'ritualist', false, false],
        [0.32, -0.32, 'ritualist', false, false],
        [-0.32, 0.32, 'ritualist', false, false],
        [0.32, 0.32, 'ritualist', false, false],
        [0, 0.58, 'vanguard', false, false],
        [0, -0.58, 'captain', true, false]
      ],
      reliquary_hall: [
        [-0.36, -0.22, 'vanguard', false, false],
        [0.36, -0.22, 'vanguard', false, false],
        [0, -0.44, 'captain', true, false],
        [-0.56, 0.26, 'ranged', false, false],
        [0.56, 0.26, 'ranged', false, false],
        [0, 0.46, 'ambusher', false, true]
      ],
      barrack_ambush: [
        [-0.54, 0.28, 'ambusher', false, true],
        [-0.42, 0.42, 'ambusher', false, true],
        [0.54, 0.28, 'ambusher', false, true],
        [0.42, 0.42, 'ambusher', false, true],
        [-0.25, -0.42, 'ranged', false, false],
        [0.25, -0.42, 'vanguard', false, false],
        [0, 0, 'captain', true, false]
      ],
      processional: [
        [-0.34, 0.35, 'vanguard', false, false],
        [0.34, 0.35, 'vanguard', false, false],
        [-0.34, -0.35, 'ranged', false, false],
        [0.34, -0.35, 'ranged', false, false],
        [0, 0, 'captain', true, false]
      ],
      trap_gallery: [
        [-0.48, 0.48, 'ranged', false, false],
        [0.48, 0.48, 'ranged', false, false],
        [0, -0.52, 'vanguard', false, false]
      ]
    };

    for (const room of this.rooms) {
      if (room.type === 'start' || room.type === 'boss' || room.type === 'village') continue;
      const targetCount = room.type === 'combat'
        ? Math.min(22, 8 + Math.floor(floorNum * 1.1))
        : room.type === 'exit'
          ? Math.min(8, 3 + Math.floor(floorNum * 0.45))
          : Math.min(6, 2 + Math.floor(floorNum * 0.35));

      const blueprint = ARCHETYPE_SLOTS[room.archetype] || ARCHETYPE_SLOTS.vanguard_courtyard;
      const halfW = Math.max(2.0, room.w * 0.5 - 2.4);
      const halfH = Math.max(2.0, room.h * 0.5 - 2.4);
      const plan = [];

      const findValidSpot = (wx, wz) => {
        if (this.isWalkable(wx, wz, 0.5) && this._spotFree(wx, wz, 0.45, 1.3)) return { x: wx, z: wz };
        for (let k = 0; k < 8; k++) {
          const a = (k / 8) * Math.PI * 2;
          const nx = wx + Math.cos(a) * 1.3;
          const nz = wz + Math.sin(a) * 1.3;
          if (this.isWalkable(nx, nz, 0.5) && this._spotFree(nx, nz, 0.45, 1.3)) return { x: nx, z: nz };
        }
        return null;
      };

      for (let i = 0; i < targetCount; i++) {
        const tmpl = blueprint[i % blueprint.length];
        const ring = Math.floor(i / blueprint.length);
        const jitterX = ring > 0 ? (rand() - 0.5) * 2.2 : (rand() - 0.5) * 0.9;
        const jitterZ = ring > 0 ? (rand() - 0.5) * 2.2 : (rand() - 0.5) * 0.9;
        const rawX = room.centerX + tmpl[0] * halfW + jitterX;
        const rawZ = room.centerZ + tmpl[1] * halfH + jitterZ;
        const clampedX = Math.max(room.x + 2.0, Math.min(room.x + room.w - 2.0, rawX));
        const clampedZ = Math.max(room.z + 2.0, Math.min(room.z + room.h - 2.0, rawZ));
        const pt = findValidSpot(clampedX, clampedZ);
        if (!pt) continue;
        const packIdx = Math.floor(i / 3);
        const keepSleeping = Boolean(tmpl[4]) && room.type !== 'exit';
        plan.push({
          x: Number(pt.x.toFixed(2)),
          z: Number(pt.z.toFixed(2)),
          role: tmpl[2],
          isElite: Boolean(tmpl[3]) && i === blueprint.findIndex((s) => s[3]),
          packId: `pack_f${floorNum}_r${room.id}_p${packIdx}`,
          sleeping: keepSleeping
        });
      }
      room.encounterPlan = plan;
    }
  }

  _buildTrapGallery(room, floorNum, rand) {
    // Rows of traps with one seed-randomized winding safe column per row; chest waits at the end of the path.
    const trapTypes = this.theme.trapTypes || ['spikes'];
    const colX = [-4.4, -2.2, 0, 2.2, 4.4];
    let cur = Math.floor(rand() * colX.length);
    const safe = [cur];
    for (let r = 1; r < 4; r++) {
      const step = Math.floor(rand() * 3) - 1;
      cur = Math.max(0, Math.min(colX.length - 1, cur + step));
      safe.push(cur);
    }
    const rowZ = [-3.3, -1.1, 1.1, 3.3];
    safe.forEach((sc, r) => {
      const cols = [0, 1, 2, 3, 4]
        .filter((c) => c !== sc)
        .sort((a, b) => Math.abs(a - sc) - Math.abs(b - sc))
        .slice(0, 3);
      cols.forEach((c) => {
        const tType = trapTypes[Math.floor(rand() * trapTypes.length)];
        this._spawnTrap(room.centerX + colX[c], room.centerZ + rowZ[r], tType, this.theme.element, rand() * Math.PI);
      });
    });
    room.safeLane = safe;
    room.safeLaneX = room.centerX + colX[safe[0]];
    this._spawnChest(room.centerX + colX[safe[safe.length - 1]], room.centerZ + 5.2, 'rare', `f${floorNum}_chest_trap`);
  }

  _pickPuzzleCorner(room) {
    return bestCorner(this, room, 4) || { sx: 1, sz: 1 };
  }

  /** Builds the bell-order (even floors) or rotating-statue (odd floors >= 3) puzzle in `room`. */
  _buildPuzzle(floorNum, room, gateId, rand) {
    if (floorNum < 2 || !room) return;
    const corner = this._pickPuzzleCorner(room);
    const ex = corner.sx < 0 ? room.x : room.x + room.w;
    const ez = corner.sz < 0 ? room.z : room.z + room.h;
    const at = (tx, tz) => ({ x: ex - corner.sx * tx, z: ez - corner.sz * tz });
    const st = styleFor(this.theme);
    const addProp = (type, mesh, pos, name, prompt, radius, extra = {}) => {
      mesh.position.set(pos.x, 0, pos.z);
      this.rootGroup.add(mesh);
      if (radius) this.solidObstacles.push({ x: pos.x, z: pos.z, radius });
      const p = { id: `f${floorNum}_${type}_${this.puzzleProps.length}`, type, name, prompt, x: pos.x, y: 0, z: pos.z, position: { x: pos.x, y: 0, z: pos.z }, mesh, ...extra };
      this.puzzleProps.push(p);
      return p;
    };

    if (floorNum % 2 === 0) {
      const order = BELL_PITCHES.slice();
      for (let i = order.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1));
        [order[i], order[j]] = [order[j], order[i]];
      }
      if (order.join() === BELL_PITCHES.join()) order.reverse(); // never the trivial order
      this.puzzle = { type: 'bells', solved: false, gateId, order, progress: [] };
      const slots = [at(1.8, 1.2), at(1.8, 2.8), at(1.8, 4.4), at(1.8, 6.0), at(1.8, 7.6)];
      const pitches = BELL_PITCHES.slice();
      for (let i = pitches.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1));
        [pitches[i], pitches[j]] = [pitches[j], pitches[i]];
      }
      pitches.forEach((pitch, i) => {
        const mesh = buildBellMesh(pitch);
        mesh.rotation.y = Math.PI / 2;
        addProp('bell', mesh, slots[i], `${pitch} Bell`, 'Ring Bell [E]', 0.5, { pitch });
      });
      addProp('stele', buildSteleMesh(st.stone), at(4.6, 1.3), 'Ancient Stele', 'Read Stele [E]', 0.6, {
        text: `The stele reads: ${order.join(' – ')}`
      });
      this._reserved.push({ x: at(3.0, 4.4).x, z: at(3.0, 4.4).z, r: 5.6 });
    } else {
      // Four guardians face the altar from four cardinal sides with linked turning
      const altarPos = at(4.6, 4.6);
      const dirs = [
        { x: altarPos.x + 2.8, z: altarPos.z, face: [-1, 0], idx: 0 },
        { x: altarPos.x - 2.8, z: altarPos.z, face: [1, 0], idx: 1 },
        { x: altarPos.x, z: altarPos.z + 2.8, face: [0, -1], idx: 2 },
        { x: altarPos.x, z: altarPos.z - 2.8, face: [0, 1], idx: 3 }
      ];
      this.puzzle = { type: 'statues', solved: false, gateId, statues: [] };
      addProp('altar', buildAltarMesh(), altarPos, 'Guardian Altar', 'Altar of Guardians', 0.7);
      dirs.forEach((d, i) => {
        const target = ((Math.round(Math.atan2(d.face[0], d.face[1]) / (Math.PI / 2)) % 4) + 4) % 4;
        let rot = Math.floor(rand() * 4);
        if (rot === target) rot = (target + 1 + Math.floor(rand() * 3)) % 4;
        const mesh = buildPuzzleStatueMesh(st.stone);
        mesh.rotation.y = rot * (Math.PI / 2);
        const p = addProp('puzzle_statue', mesh, d, 'Guardian Statue', 'Turn Statue [E]', 0.5, { rot, target, index: i });
        this.puzzle.statues.push(p);
      });
      addProp('stele', buildSteleMesh(st.stone), at(1.4, 1.4), 'Ancient Stele', 'Read Stele [E]', 0.6, {
        text: 'The stele reads: Four guardians watch the four cardinal winds. Turn each to face the sacred altar flame.'
      });
      this._reserved.push({ x: altarPos.x, z: altarPos.z, r: 5.8 });
    }
  }

  _solvePuzzle(ctx) {
    const pz = this.puzzle;
    if (!pz || pz.solved) return;
    pz.solved = true;
    this.setGateOpen(pz.gateId, true);
    const msg = 'A deep grinding echoes... the vault gate opens!';
    ctx?.hud?.showToast?.(msg, 'info');
    for (const a of this.puzzleProps) {
      if (a.mesh?.userData?.orb) a.mesh.userData.orb.scale?.set?.(1.8, 1.8, 1.8);
    }
  }

  _ringBell(bell, ctx) {
    const pz = this.puzzle;
    if (!pz || pz.type !== 'bells' || pz.solved) return { ok: false, reason: 'The bells are silent now.' };
    bell.mesh?.userData?.ring?.();
    const expected = pz.order[pz.progress.length];
    if (bell.pitch === expected) {
      pz.progress.push(bell.pitch);
      if (pz.progress.length >= pz.order.length) {
        this._solvePuzzle(ctx);
        return { ok: true, type: 'bell', solved: true };
      }
      ctx?.hud?.toast?.(`${bell.pitch} bell rings true.`, 'info');
      return { ok: true, type: 'bell', solved: false, progress: pz.progress.length };
    }
    pz.progress = [];
    const dmg = 6 + this.currentFloor * 2;
    let hurt = false;
    if (typeof ctx?.onPuzzleBackfire === 'function') { ctx.onPuzzleBackfire(dmg, 'physical'); hurt = true; }
    else if (typeof ctx?.damagePlayer === 'function') { ctx.damagePlayer(dmg, { element: 'physical', source: bell }); hurt = true; }
    else if (typeof ctx?.gameState?.takeDamage === 'function') { ctx.gameState.takeDamage(dmg, { element: 'physical', source: bell }); hurt = true; }
    const msg = hurt ? 'A discordant clang! The sequence resets and a shockwave bites you.' : 'A discordant clang! The sequence resets.';
    ctx?.hud?.showToast?.(msg, 'warning');
    return { ok: true, type: 'bell', solved: false, wrong: true };
  }

  _turnStatue(statue, ctx) {
    const pz = this.puzzle;
    if (!pz || pz.type !== 'statues' || pz.solved) return { ok: false, reason: 'The guardians are at rest.' };
    statue.rot = (statue.rot + 1) % 4;
    if (statue.mesh) statue.mesh.rotation.y = statue.rot * (Math.PI / 2);
    if (pz.statues.every((s) => s.rot === s.target)) {
      this._solvePuzzle(ctx);
      return { ok: true, type: 'puzzle_statue', solved: true };
    }
    return { ok: true, type: 'puzzle_statue', solved: false };
  }

  // --- Light budget -------------------------------------------------------------------------
  _createLightPool() {
    this._freeLightPool();
    this._lightPrimed = false;
    if (!this.renderer?.addPointLight || !this._lightSources.length) return;
    const n = Math.min(LIGHT_POOL_SIZE, this._lightSources.length);
    for (let i = 0; i < n; i++) {
      const src = this._lightSources[i];
      const light = this.renderer.addPointLight(new THREE.Vector3(src.x, src.y, src.z), src.color, src.intensity, src.distance, false);
      this._lightPool.push({ light, src: -1, level: 0, target: 0, phase: Math.random() * 6.28 });
    }
  }

  _freeLightPool() {
    for (const slot of this._lightPool) {
      if (this.renderer?.removeLight) this.renderer.removeLight(slot.light);
      else slot.light?.parent?.remove?.(slot.light);
    }
    this._lightPool = [];
  }

  /** Re-point the pooled PointLights at the emissive sources nearest the player (call every ~0.25 s). */
  _updateLightBudget(playerPos) {
    const pool = this._lightPool;
    if (!pool.length || !playerPos) return;
    const px = Number(playerPos.x ?? playerPos.position?.x ?? 0);
    const pz = Number(playerPos.z ?? playerPos.position?.z ?? 0);
    const scored = this._lightSources.map((s, i) => ({ i, d: (s.x - px) * (s.x - px) + (s.z - pz) * (s.z - pz) }));
    scored.sort((a, b) => a.d - b.d);
    const want = scored.slice(0, pool.length).map((s) => s.i);
    const wantSet = new Set(want);
    const taken = new Set();
    const free = [];
    for (const slot of pool) {
      if (wantSet.has(slot.src)) { taken.add(slot.src); slot.target = 1; } else free.push(slot);
    }
    let k = 0;
    for (const idx of want) {
      if (taken.has(idx)) continue;
      const slot = free[k++];
      if (!slot) break;
      const src = this._lightSources[idx];
      slot.src = idx;
      slot.level = 0;
      slot.target = 1;
      slot.light.position.set(src.x, src.y, src.z);
      slot.light.color.setHex(src.color);
      slot.light.distance = Math.max(14, src.distance * 1.5);
    }
  }

  _tickLightPool(dt, time) {
    for (const slot of this._lightPool) {
      const src = this._lightSources[slot.src];
      if (!src) { slot.light.intensity = 0; continue; }
      slot.level += (slot.target - slot.level) * Math.min(1, dt * 6);
      const wave = Math.sin(time * 9 + slot.phase) * 0.1 + Math.cos(time * 15 + slot.phase * 1.7) * 0.06;
      slot.light.intensity = Math.max(0, src.intensity * 1.05 * (1 + wave) * slot.level);
    }
  }

  _findBossRoomEntrance(bossRoom) {
    if (!bossRoom) return null;
    const isOpenTile = (gx, gz) => {
      const t = this.getTileAtGrid(gx, gz);
      return t === TILE.CORRIDOR || t === TILE.FLOOR;
    };
    const scanWall = (fixed, from, count, isXFixed, coordFixed, rotY, side) => {
      const hits = [];
      for (let i = from; i < from + count; i++) {
        if (isOpenTile(isXFixed ? fixed : i, isXFixed ? i : fixed)) hits.push(i);
      }
      if (!hits.length) return null;
      const mid = hits.reduce((a, b) => a + b, 0) / hits.length;
      const worldPos = this.gridToWorld(isXFixed ? coordFixed : mid, isXFixed ? mid : coordFixed);
      return { x: worldPos.x, z: worldPos.z, rotationY: rotY, side };
    };

    // 1. Scan south wall (primary approach from main palace corridor)
    const south = scanWall(bossRoom.gz + bossRoom.gh, bossRoom.gx, bossRoom.gw, false, bossRoom.gz + bossRoom.gh - 0.5, 0, 'S');
    if (south) return south;

    // 2. Scan west wall
    const west = scanWall(bossRoom.gx - 1, bossRoom.gz, bossRoom.gh, true, bossRoom.gx - 0.5, Math.PI / 2, 'W');
    if (west) return west;

    // 3. Scan east wall
    const east = scanWall(bossRoom.gx + bossRoom.gw, bossRoom.gz, bossRoom.gh, true, bossRoom.gx + bossRoom.gw - 0.5, Math.PI / 2, 'E');
    if (east) return east;

    // 4. Scan north wall
    const north = scanWall(bossRoom.gz - 1, bossRoom.gx, bossRoom.gw, false, bossRoom.gz - 0.5, 0, 'N');
    if (north) return north;

    // 5. Default south boundary
    const defPos = this.gridToWorld(Math.floor(bossRoom.gx + bossRoom.gw * 0.5), bossRoom.gz + bossRoom.gh - 0.5);
    return { x: defPos.x, z: defPos.z, rotationY: 0, side: 'S' };
  }

  _decorateBossArena(bossRoom, floorNum) {
    const entrance = this._findBossRoomEntrance(bossRoom);
    // Pillar ring, braziers, custom dais & entrance-oriented runner carpet
    this.bossArena = decorateBossArenaProps(this, this._batch, bossRoom, seededRandom(floorNum * 31 + 7), entrance);

    // Locked Boss Gate at the entrance corridor archway to the Boss Chamber (Final Floor 16 opens straight into the Sanctum)
    const BOSS_GATE_NAMES = {
      donhwang: 'Donwhang Cave Seal Gate',
      karakoram: 'Karakoram Black Robber Gate',
      qinshi: 'Qin-Shi Seal Gate',
      qinshi_b6: 'Medusa Chamber Seal Gate',
      flame: 'Flame Mountain Magma Gate',
      holywater: 'Holy Water Sanctum Gate',
      jupiter: 'Jupiter Inner Sanctum Gate',
      demon: 'Shambhala Guardian Gate',
      togui: 'Togui Elder Gate',
      wreck: 'Sunken Captain Gate'
    };
    if (entrance && floorNum !== 16) {
      const gateId = `f${floorNum}_boss_gate`;
      const propSet = SRO_DUNGEON_PROPS[resolveSroDungeon(this)];
      const gateSpec = propSet?.bossGate || null;
      const gate = this._spawnGate(entrance.x, entrance.z, gateId, false, gateSpec);
      gate.isBossGate = true;
      gate.radius = 2.4;
      gate.gateAssetUrl = gateSpec?.url || '/assets/sro/props/cj_portal.glb';
      gate.name = BOSS_GATE_NAMES[this.sroDungeon] || 'Chamber of the Sovereign Gate';
      if (gate.mesh) {
        gate.mesh.rotation.y = entrance.rotationY;
      }
      this.bossGate = gate;
      this._reserved.push({ x: entrance.x, z: entrance.z, r: 2.5 });
    }

    // Boss Victory Chest & Next Floor Portal at the north apse of the expanded Boss Arena
    const chestPos = {
      x: bossRoom.centerX - 3.8,
      z: bossRoom.centerZ - (floorNum === 16 ? 10.5 : 7.2)
    };
    const bossChest = this._spawnChest(chestPos.x, chestPos.z, 'boss', `f${floorNum}_boss_chest`);
    bossChest.lockedByBoss = true;

    const maxNormalFloor = FLOOR_DEFINITIONS.filter((f) => !f.isSecretFloor).length;
    const isFinalFloor = floorNum >= maxNormalFloor;
    const leadsToFinalBoss = floorNum === 15;
    const nextPortalMesh = (this.models3d?.createPortalMesh || createPortalMesh)(
      { color: leadsToFinalBoss ? 0xa855f7 : 0xef4444, portalStyle: this.theme?.portalStyle },
      'boss_exit'
    );
    const portalPos = { x: bossRoom.centerX, y: 0, z: bossRoom.centerZ - (floorNum === 16 ? 13.5 : 9.4) };
    nextPortalMesh.position.set(portalPos.x, 0, portalPos.z);
    nextPortalMesh.userData.setLocked?.(true);
    this.rootGroup.add(nextPortalMesh);
    this._reserved.push({ x: portalPos.x, z: portalPos.z, r: 2.35 });

    this.portals.push({
      id: `boss_exit_f${floorNum}`,
      type: 'portal',
      portalType: isFinalFloor ? 'village' : 'next_floor',
      name: isFinalFloor
        ? 'Victory Rift to Oakhaven'
        : leadsToFinalBoss
          ? 'Abyssal Gate to Mountain Roc Peak — Sky Nest'
          : `Abyssal Rift to Floor ${floorNum + 1}`,
      targetFloor: isFinalFloor ? 0 : floorNum + 1,
      lockedByBoss: true,
      lockedByClear: Boolean(this.exitLockedByClear),
      x: portalPos.x,
      y: 0,
      z: portalPos.z,
      position: portalPos,
      prompt: isFinalFloor
        ? 'Victory Complete! Return to Oakhaven [E]'
        : leadsToFinalBoss
          ? 'Enter Mountain Roc Peak — Sky Nest [E]'
          : `Enter Rift to Floor ${floorNum + 1} [E]`,
      mesh: nextPortalMesh
    });
  }

  unlockBossRoomRewards() {
    for (const chest of this.chests) {
      if (chest.lockedByBoss) {
        chest.lockedByBoss = false;
      }
    }
    for (const portal of this.portals) {
      if (portal.lockedByBoss) {
        portal.lockedByBoss = false;
        portal.mesh?.userData?.setLocked?.(Boolean(portal.lockedByClear));
      }
    }
    for (const gate of this.gates) {
      if (gate.isBossGate) {
        this.setGateOpen(gate.id, true);
      }
    }
  }

  onBossDefeated() {
    return this.unlockBossRoomRewards();
  }

  setExitLockedByClear(locked) {
    this.exitLockedByClear = Boolean(locked);
    for (const portal of this.portals) {
      if (
        portal.portalType === 'next_floor'
        || (portal.portalType === 'village' && String(portal.id || '').startsWith('boss_exit'))
      ) {
        portal.lockedByClear = Boolean(locked);
        portal.mesh?.userData?.setLocked?.(Boolean(portal.lockedByClear || portal.lockedByBoss));
      }
    }
  }

  _spawnTorch(x, z, color = 0xffaa44) {
    if (this._batch) {
      // emissive instanced torch; light comes from the shared 8-light pool
      addTorchInstance(this._batch, this, x, z, color, styleFor(this.theme));
      this.torches.push({ x, y: 0.85, z, color, mesh: null, pooled: true });
      return;
    }
    const mesh = (this.models3d?.createTorchMesh || createTorchMesh)(color);
    mesh.position.set(x, 0.85, z);
    this.rootGroup.add(mesh);
    if (this.renderer?.addPointLight && this.torches.length < 32) {
      this.renderer.addPointLight(new THREE.Vector3(x, 2.2, z), color, 2.5, 18.0, true);
    }
    this.torches.push({ x, y: 0.85, z, color, mesh });
  }

  _spawnStorageChest(x, z, id = 'village_starter_chest', name = 'General Shared Storage Chest') {
    const mesh = createSilkroadCofferMesh('legendary', false);
    mesh.scale.setScalar(1.22);
    mesh.position.set(x, 0, z);
    this.rootGroup.add(mesh);

    if (this.renderer?.addPointLight) {
      this.renderer.addPointLight(new THREE.Vector3(x, 1.4, z), 0xfbbf24, 1.5, 9.0, false);
    }

    const chestObj = {
      id,
      type: 'storage_chest',
      isStorageChest: true,
      reusable: true,
      tier: 'storage',
      name,
      isOpen: false,
      lockedByBoss: false,
      x,
      y: 0,
      z,
      position: { x, y: 0, z },
      prompt: `Open ${name} (Shared Gold & Items) [E]`,
      mesh
    };
    this.chests.push(chestObj);
    this.solidObstacles.push({ x, z, radius: 0.62 });
    return chestObj;
  }

  _spawnChest(x, z, tier = 'normal', id = null) {
    const chestId = id || `chest_${this.chests.length + 1}`;
    const mesh = createSilkroadCofferMesh(tier, false);
    mesh.position.set(x, 0, z);
    this.rootGroup.add(mesh);

    const chestObj = {
      id: chestId,
      type: 'chest',
      tier,
      name: `${tier.charAt(0).toUpperCase() + tier.slice(1)} Treasure Chest`,
      isOpen: false,
      lockedByBoss: false,
      x,
      y: 0,
      z,
      position: { x, y: 0, z },
      prompt: `Open ${tier.charAt(0).toUpperCase() + tier.slice(1)} Chest [E]`,
      mesh
    };
    this.chests.push(chestObj);
    this.solidObstacles.push({ x, z, radius: 0.52 });
    return chestObj;
  }

  _spawnBreakable(x, z, kind = 'barrel', id = null) {
    // Küçük mavi kristalleri kırılabilir nesne olarak kaldır - temaya uygun fallback yap
    let validKind = kind;
    if (validKind === 'crystal') {
      validKind = (this.theme?.breakableTypes && this.theme.breakableTypes[0]) || 'barrel';
    }
    if (validKind === 'barrel' && this.currentFloor > 0 && Math.random() < 0.28) {
      validKind = 'barrel_explosive';
    }
    const breakableId = id || `breakable_${this.breakables.length + 1}`;
    const mesh = (this.models3d?.createBreakableMesh || createBreakableMesh)(validKind);
    mesh.position.set(x, 0, z);
    this.rootGroup.add(mesh);

    const maxHp = validKind === 'urn' ? 15 : 25;
    const obj = {
      id: breakableId,
      type: 'breakable',
      kind: validKind,
      hp: maxHp,
      maxHp,
      destroyed: false,
      radius: 0.48,
      x,
      y: 0,
      z,
      position: { x, y: 0, z },
      mesh
    };
    this.breakables.push(obj);
    return obj;
  }

  _spawnTrap(x, z, trapType = 'spikes', element = 'physical', phaseOffset = 0) {
    const mesh = (this.models3d?.createTrapMesh || createTrapMesh)(trapType, element);
    mesh.position.set(x, 0, z);
    this.rootGroup.add(mesh);

    const trap = {
      id: `trap_${this.traps.length + 1}`,
      type: 'trap',
      trapType,
      element: trapType === 'fire' ? 'fire' : trapType === 'ice' ? 'ice' : trapType === 'poison' ? 'poison' : element,
      x,
      y: 0,
      z,
      radius: 0.85,
      cycleTime: 3.2,
      phaseOffset,
      isActive: false,
      hitCooldown: 0,
      damage: 8 + this.currentFloor * 4,
      mesh
    };
    this.traps.push(trap);
    return trap;
  }

  _spawnSwitch(x, z, targetGateId, prompt = 'Pull Gate Lever [E]') {
    const mesh = (this.models3d?.createSwitchMesh || createSwitchMesh)(false);
    mesh.position.set(x, 0, z);
    this.rootGroup.add(mesh);

    const sw = {
      id: `switch_${this.switches.length + 1}`,
      type: 'switch',
      name: 'Ancient Gate Lever',
      targetGateId,
      isActive: false,
      x,
      y: 0,
      z,
      position: { x, y: 0, z },
      prompt,
      mesh
    };
    this.switches.push(sw);
    return sw;
  }

  _spawnGate(x, z, gateId, isOpen = false, gateSpec = null) {
    const group = new THREE.Group();
    group.position.set(x, 0, z);

    const ironMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.8, roughness: 0.35 });
    const barsGroup = new THREE.Group();
    for (let bx = -1.2; bx <= 1.2; bx += 0.4) {
      const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.2, 8), ironMat);
      bar.position.set(bx, 1.1, 0);
      barsGroup.add(bar);
    }
    const crossBar = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.14, 0.16), ironMat);
    crossBar.position.set(0, 1.8, 0);
    barsGroup.add(crossBar);
    group.add(barsGroup);

    group.userData.barsGroup = barsGroup;

    // Silkroad biome boss gate or classic vault portal arch frame
    const assetUrl = gateSpec?.url || '/assets/sro/props/cj_portal.glb';
    if (typeof window !== 'undefined') {
      loadSROProp(assetUrl, {
        parent: group,
        position: [0, 0, 0],
        targetHeight: gateSpec?.targetHeight || 5.0,
        ...(gateSpec?.centerXZ ? { centerXZ: true } : {}),
        autoGround: gateSpec?.autoGround !== false,
        castShadow: false,
        receiveShadow: false
      });
    }

    this.rootGroup.add(group);

    const gate = {
      id: gateId,
      type: 'gate',
      isOpen: Boolean(isOpen),
      x,
      y: 0,
      z,
      radius: 1.15,
      mesh: group
    };
    this.gates.push(gate);
    return gate;
  }

  _spawnShrine(x, z, floorNum, shrineType = null, nicheSide = null) {
    const SHRINE_TYPES = [
      {
        kind: 'shrine_berserk',
        name: 'Hwan Berserk Obelisk',
        color: 0xef4444,
        emissive: 0xdc2626,
        prompt: 'Touch Berserk Obelisk (Max 5 Hwan Orbs!) [E]'
      },
      {
        kind: 'shrine_fortune',
        name: 'Fortune Shrine',
        color: 0xfacc15,
        emissive: 0xeab308,
        prompt: 'Touch Fortune Shrine (+60% Gold & +30% Magic Find) [E]'
      },
      {
        kind: 'shrine_haste',
        name: 'Wind Walker Shrine',
        color: 0x38bdf8,
        emissive: 0x0284c7,
        prompt: 'Touch Wind Walker Shrine (+40% Move & +30% Atk Speed) [E]'
      },
      {
        kind: 'shrine_sanctuary',
        name: 'Sanctuary Blessing Shrine',
        color: 0x4ade80,
        emissive: 0x22c55e,
        prompt: 'Drink Sanctuary Waters (Full Restore & Rapid Regen) [E]'
      }
    ];

    const picked = shrineType
      ? SHRINE_TYPES.find((s) => s.kind === shrineType) || SHRINE_TYPES[0]
      : SHRINE_TYPES[Math.max(0, (floorNum || 1) - 1) % SHRINE_TYPES.length];

    const group = new THREE.Group();
    group.position.set(x, 0, z);

    const stoneMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.6 });
    const gemMat = new THREE.MeshStandardMaterial({
      color: picked.color,
      emissive: new THREE.Color(picked.emissive),
      emissiveIntensity: 0.9,
      roughness: 0.2
    });

    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.85, 0.9, 12), stoneMat);
    base.position.y = 0.45;
    const orb = new THREE.Mesh(new THREE.OctahedronGeometry(0.32, 0), gemMat);
    orb.position.y = 1.35;
    group.add(base, orb);
    if (nicheSide && this._batch) {
      const horiz = nicheSide === 'N' || nicheSide === 'S';
      this._batch.add('cyl', x, 0.015, z, 2.5, 0.03, 2.5, 0, 0x1e293b);
      for (const s of [-1.25, 1.25]) {
        const px = horiz ? x + s : x;
        const pz = horiz ? z : z + s;
        this._batch.add('box', px, 1.25, pz, 0.3, 2.5, 0.3, 0, 0x334155);
        this._batch.add('glowBox', px, 1.45, pz, 0.18, 0.24, 0.18, 0, picked.color);
      }
      this._batch.add('box', x, 2.6, z, horiz ? 2.9 : 0.36, 0.24, horiz ? 0.36 : 2.9, 0, 0x475569);
    }
    group.userData.orb = orb;

    this.rootGroup.add(group);
    this.solidObstacles.push({ x, z, radius: 0.65 });
    this._lightSources.push({ x, y: 1.6, z, color: picked.color, intensity: 1.8, distance: 9 });

    this.shrines.push({
      id: `shrine_f${floorNum}_${this.shrines.length + 1}`,
      type: 'shrine',
      shrineKind: picked.kind,
      name: picked.name,
      x,
      y: 0,
      z,
      position: { x, y: 0, z },
      used: false,
      reusable: false,
      prompt: picked.prompt,
      mesh: group
    });
  }

  setGateOpen(gateId, open = true) {
    const gate = this.gates.find((g) => g.id === gateId);
    if (!gate) return false;
    gate.isOpen = Boolean(open);
    if (gate.mesh?.userData?.barsGroup) {
      gate.mesh.userData.barsGroup.position.y = gate.isOpen ? -2.1 : 0;
    }
    return true;
  }

  /**
   * Check whether an entity can navigate to/stand on (x, z).
   * Delegates to isWalkable, which respects walls, closed gates, and solid obstacles.
   */
  canMoveTo(posOrX, zOrRadius = 0, maybeRadius = 0.4) {
    return this.isWalkable(posOrX, zOrRadius, maybeRadius);
  }

  /**
   * Check whether a circle at (x, z) with given radius can stand on walkable ground
   */
  isWalkable(posOrX, zOrRadius = 0, maybeRadius = 0.4) {
    const parsed = extractXZ(posOrX, zOrRadius, maybeRadius);
    const x = parsed.x;
    const z = parsed.z;
    const radius = parsed.isObject ? Number(parsed.extra ?? 0.4) : Number(maybeRadius ?? 0.4);

    // Check 4 cardinal perimeter points + center against tile grid
    const sampleOffsets = [
      [0, 0],
      [radius, 0],
      [-radius, 0],
      [0, radius],
      [0, -radius],
      [radius * 0.7, radius * 0.7],
      [-radius * 0.7, radius * 0.7],
      [radius * 0.7, -radius * 0.7],
      [-radius * 0.7, -radius * 0.7]
    ];

    for (const [ox, oz] of sampleOffsets) {
      const { gx, gz } = this.worldToGrid(x + ox, z + oz);
      const tile = this.getTileAtGrid(gx, gz);
      if (tile === TILE.WALL || tile === TILE.VOID || tile === TILE.DOOR_CLOSED || tile === TILE.PIT) {
        return false;
      }
    }

    // Check closed gates
    for (const gate of this.gates) {
      if (!gate.isOpen && Math.hypot(x - gate.x, z - gate.z) < gate.radius + radius * 0.6) {
        return false;
      }
    }

    // Check solid obstacles (fountain, pillars, unopened chests, NPCs)
    for (const obs of this.solidObstacles) {
      if (Math.hypot(x - obs.x, z - obs.z) < obs.radius + radius * 0.75) {
        return false;
      }
    }

    // Check unbroken breakables
    for (const brk of this.breakables) {
      if (!brk.destroyed && Math.hypot(x - brk.x, z - brk.z) < brk.radius + radius * 0.65) {
        return false;
      }
    }

    return true;
  }

  /**
   * Resolve circle collision against walls & obstacles with smooth axis sliding.
   * Works whether called as resolveCollision(posVector3, radius) or resolveCollision(x, z, radius).
   */
  resolveCollision(posOrX, zOrRadius = 0.4, maybeRadius = 0.4) {
    const parsed = extractXZ(posOrX, zOrRadius, maybeRadius);
    let x = parsed.x;
    let z = parsed.z;
    const y = parsed.y;
    const radius = parsed.isObject ? Number(parsed.extra ?? 0.4) : Number(maybeRadius ?? 0.4);

    let collided = false;
    const normal = { x: 0, z: 0 };

    // Push out of circular obstacles (pillars, fountain, closed gates, unbroken barrels)
    const allCircles = [
      ...this.solidObstacles,
      ...this.gates.filter((g) => !g.isOpen),
      ...this.breakables.filter((b) => !b.destroyed)
    ];

    for (const obs of allCircles) {
      const dx = x - obs.x;
      const dz = z - obs.z;
      const dist = Math.hypot(dx, dz);
      const minDist = (obs.radius || 0.5) + radius * 0.8;
      if (dist < minDist) {
        collided = true;
        const nx = dist > 0.0001 ? dx / dist : 1;
        const nz = dist > 0.0001 ? dz / dist : 0;
        x = obs.x + nx * minDist;
        z = obs.z + nz * minDist;
        normal.x = nx;
        normal.z = nz;
      }
    }

    // Check wall tile collisions around (x, z)
    const { gx, gz } = this.worldToGrid(x, z);
    const halfTile = this.tileSize * 0.5;

    for (let tz = gz - 1; tz <= gz + 1; tz++) {
      for (let tx = gx - 1; tx <= gx + 1; tx++) {
        const tile = this.getTileAtGrid(tx, tz);
        if (tile !== TILE.WALL && tile !== TILE.VOID && tile !== TILE.DOOR_CLOSED) continue;

        const tileCenter = this.gridToWorld(tx, tz);
        const minX = tileCenter.x - halfTile;
        const maxX = tileCenter.x + halfTile;
        const minZ = tileCenter.z - halfTile;
        const maxZ = tileCenter.z + halfTile;

        const closestX = Math.max(minX, Math.min(x, maxX));
        const closestZ = Math.max(minZ, Math.min(z, maxZ));
        const dx = x - closestX;
        const dz = z - closestZ;
        const distSq = dx * dx + dz * dz;

        if (distSq < radius * radius) {
          collided = true;
          const dist = Math.sqrt(distSq);
          if (dist > 0.0001) {
            const overlap = radius - dist;
            const nx = dx / dist;
            const nz = dz / dist;
            x += nx * overlap;
            z += nz * overlap;
            normal.x = nx;
            normal.z = nz;
          } else {
            x += radius;
          }
        }
      }
    }

    if (parsed.isObject && parsed.ref) {
      parsed.ref.x = x;
      parsed.ref.z = z;
    }

    return { x, y, z, collided, normal };
  }

  /**
   * Find the nearest interactive object (NPC, Chest, Portal, Switch, Shrine, or Ground Loot)
   */
  getNearestInteractable(posOrX, maxDistOrZ = 2.8, maybeMaxDist = 2.8) {
    const parsed = extractXZ(posOrX, maxDistOrZ, maybeMaxDist);
    const x = parsed.x;
    const z = parsed.z;
    const maxDist = parsed.isObject ? Number(parsed.extra ?? 2.8) : Number(maybeMaxDist ?? 2.8);

    let best = null;
    let bestDist = maxDist;

    const consider = (entity, type, promptText, extraRadius = 0) => {
      const d = Math.hypot(x - entity.x, z - entity.z) - extraRadius;
      if (d <= bestDist) {
        bestDist = d;
        best = {
          id: entity.id,
          type,
          name: entity.name || type,
          prompt: promptText || entity.prompt || `Interact with ${entity.name || type}`,
          key: 'E',
          distance: Math.max(0, d),
          x: entity.x,
          y: entity.y || 0,
          z: entity.z,
          position: { x: entity.x, y: entity.y || 0, z: entity.z },
          entity,
          data: entity
        };
      }
    };

    for (const npc of this.npcs) {
      consider(npc, 'npc', npc.prompt, 0.3);
    }

    for (const chest of this.chests) {
      if (chest.type === 'storage_chest' || chest.isStorageChest) {
        consider(chest, 'storage_chest', chest.prompt || `Open ${chest.name || 'General Shared Storage'} [E]`, 0.35);
      } else if (!chest.isOpen) {
        const prompt = chest.lockedByBoss
          ? 'Locked (Defeat the Floor Boss first!)'
          : chest.prompt;
        consider(chest, 'chest', prompt, 0.2);
      }
    }

    for (const sw of this.switches) {
      if (!sw.isActive) {
        consider(sw, 'switch', sw.prompt, 0.2);
      }
    }

    for (const p of this.puzzleProps) {
      if (p.type === 'altar') continue;
      if (p.type === 'stele' || !this.puzzle?.solved) consider(p, p.type, p.prompt, 0.4);
    }

    for (const shrine of this.shrines) {
      if (!shrine.used || shrine.reusable) {
        consider(shrine, 'shrine', shrine.prompt, 0.5);
      }
    }

    const heroLv = Number(this.gameContext?.gameState?.hero?.level ?? this.gameContext?.hero?.level ?? 0);
    for (const portal of this.portals) {
      let prompt = portal.prompt;
      if (portal.lockedByClear) {
        prompt = 'Sealed Gate (Defeat all monsters on this floor first!)';
      } else if (portal.lockedByBoss) {
        prompt = 'Sealed Rift (Defeat the Floor Boss first!)';
      } else if (
        heroLv > 0 && heroLv < MIN_DUNGEON_LEVEL
        && (portal.portalType === 'dungeon_entrance' || (portal.portalType === 'next_floor' && (portal.targetFloor || 0) > 0))
      ) {
        prompt = `Dungeon Gate Locked — Reach Lv ${MIN_DUNGEON_LEVEL} in Oakhaven Outskirts (Lv ${heroLv}/${MIN_DUNGEON_LEVEL})`;
      }
      consider(portal, 'portal', prompt, 0.4);
    }

    for (const loot of this.groundLoot) {
      if (!loot.collected) {
        consider(loot, 'loot', `Pick up ${loot.name} [E]`, 0.2);
      }
    }

    return best;
  }

  /**
   * Perform interaction with an interactable object or the nearest one at playerPos
   */
  interact(interactableOrPos, context = null) {
    const ctx = context || this.gameContext || {};
    let target = interactableOrPos;

    if (target && typeof target.x === 'number' && !target.type && !target.entity) {
      target = this.getNearestInteractable(target, 3.0);
    }
    if (!target) return { ok: false, reason: 'Nothing nearby to interact with.' };

    const entity = target.entity || target;
    const type = target.type || entity.type;

    if (type === 'storage_chest' || entity.isStorageChest) {
      entity.isOpen = !entity.isOpen;
      entity.mesh?.userData?.setOpen?.(entity.isOpen);
      ctx.menus?.openMenu?.('storage');
      return {
        ok: true,
        type: 'storage_chest',
        actionType: 'storage',
        menu: 'storage',
        entity,
        message: 'Opened General Shared Storage Vault'
      };
    }

    if (type === 'chest') {
      return this.openChest(entity, ctx);
    }

    if (type === 'switch') {
      entity.isActive = true;
      entity.mesh?.userData?.setActive?.(true);
      this.setGateOpen(entity.targetGateId, true);
      if (this.puzzle && this.puzzle.gateId === entity.targetGateId) this.puzzle.solved = true;
      ctx.hud?.showToast?.('Ancient Gate Unlocked!', 'info');
      return { ok: true, type: 'switch', gateId: entity.targetGateId, message: 'Ancient Gate Unlocked!' };
    }

    if (type === 'shrine') {
      if (entity.used && !entity.reusable) {
        return { ok: false, reason: 'Shrine blessing already claimed.' };
      }
      entity.used = true;
      const k = entity.shrineKind || 'shrine_sanctuary';

      if (k === 'shrine_berserk') {
        if (ctx.gameState) {
          ctx.gameState.hero.berserkCharge = 5;
          if (ctx.player?.tryActivateBerserk) ctx.player.tryActivateBerserk();
          else if (ctx.gameState.triggerBerserk) ctx.gameState.triggerBerserk();
        }
        ctx.hud?.showToast?.('🔥 HWAN BERSERK UNLEASHED! (5 Orbs Charged!)', 'levelup');
      } else if (k === 'shrine_fortune') {
        if (ctx.gameState?.addBuff) {
          ctx.gameState.addBuff({ id: 'shrine_fortune', name: 'Fortune Blessing', icon: '💰', duration: 60, mods: { goldFind: 60, magicFind: 30 } });
        }
        ctx.hud?.showToast?.('💰 Fortune Shrine: +60% Gold & +30% Magic Find (60s)!', 'loot');
      } else if (k === 'shrine_haste') {
        if (ctx.gameState?.addBuff) {
          ctx.gameState.addBuff({ id: 'shrine_haste', name: 'Wind Walker Haste', icon: '💨', duration: 45, mods: { moveSpeedPct: 40, attackSpeedPct: 30 } });
        }
        ctx.hud?.showToast?.('💨 Wind Walker Shrine: +40% Speed & +30% Attack Speed (45s)!', 'info');
      } else {
        if (ctx.gameState?.heal) {
          ctx.gameState.heal(9999, 9999);
        } else if (ctx.gameState?.hero) {
          const stats = ctx.gameState.getStats ? ctx.gameState.getStats() : {};
          ctx.gameState.hero.hp = stats.maxHp || ctx.gameState.hero.maxHp || 100;
          ctx.gameState.hero.mp = stats.maxMp || ctx.gameState.hero.maxMp || 100;
        }
        if (ctx.gameState?.addBuff) {
          ctx.gameState.addBuff({ id: 'shrine_regen', name: 'Sanctuary Regeneration', icon: '✨', duration: 20, mods: { hpRegen: 35, mpRegen: 25 } });
        }
        ctx.hud?.showToast?.(`${entity.name}: Full HP & Mana Restored + Rapid Regen!`, 'heal');
      }
      return { ok: true, type: 'shrine', entity };
    }

    if (type === 'bell') return this._ringBell(entity, ctx);
    if (type === 'puzzle_statue') return this._turnStatue(entity, ctx);
    if (type === 'stele') {
      ctx.hud?.showToast?.(entity.text, 'info');
      return { ok: true, type: 'stele', text: entity.text };
    }

    if (type === 'celestial_spring') {
      if (entity.used) {
        ctx.hud?.showToast?.('The Celestial Spring is temporarily depleted.', 'info');
        return { ok: false, reason: 'Already used' };
      }
      entity.used = true;
      if (ctx.hero) {
        const stats = ctx.gameState?.getDerivedStats?.() || ctx.hero;
        ctx.hero.hp = stats.maxHp || ctx.hero.maxHp || 1000;
        ctx.hero.mp = stats.maxMp || ctx.hero.maxMp || 500;
      }
      if (ctx.gameState?.fullRestore) {
        ctx.gameState.fullRestore();
      }
      if (ctx.gameState?.addStatusEffect) {
        ctx.gameState.addStatusEffect('celestial_blessing', {
          name: 'Celestial Blessing',
          duration: 300,
          atkPct: 15,
          defPct: 15,
          icon: '✨'
        });
      }
      const msg = '✨ Celestial Waters replenish your essence! Full HP & MP restored, +15% ATK & DEF!';
      if (ctx.hud?.showToast) ctx.hud.showToast(msg, 'success');
      ctx.sound?.play?.('buff') || ctx.sound?.play?.('potion');
      return { ok: true, type: 'celestial_spring', entity };
    }

    if (type === 'loot') {
      return this.pickupLoot(entity, ctx);
    }

    if (type === 'portal') {
      if (entity.lockedByClear) {
        const sealedMsg = 'Clear all remaining monsters on this floor to unlock the portal!';
        if (ctx.hud?.showToast) ctx.hud.showToast(sealedMsg, 'warning');
        else ctx.hud?.toast?.(sealedMsg, 'info');
        return { ok: false, reason: 'Locked until floor cleared' };
      }
      if (entity.lockedByBoss) {
        const sealedMsg = 'Defeat the Floor Boss to unseal this portal!';
        if (ctx.hud?.showToast) ctx.hud.showToast(sealedMsg, 'warning');
        else ctx.hud?.toast?.(sealedMsg, 'info');
        return { ok: false, reason: 'Locked by Boss' };
      }
      if (entity.portalType === 'challenge_portal') {
        if (entity.completed) {
          const doneMsg = 'This Challenge Rift has already been conquered!';
          ctx.hud?.toast?.(doneMsg, 'info');
          return { ok: false, reason: 'Already completed' };
        }
        ctx.enterChallenge?.(entity);
        return { ok: true, type: 'portal', action: 'enter_challenge', challengeType: entity.challengeType, entity };
      }
      if (entity.portalType === 'challenge_return') {
        ctx.exitChallenge?.({ died: false });
        return { ok: true, type: 'portal', action: 'exit_challenge', entity };
      }
      if (entity.portalType === 'floor_selector') {
        if (ctx.menus?.openMenu) ctx.menus.openMenu('map');
        else ctx.menus?.toggle?.('map');
        return { ok: true, type: 'portal', action: 'open_floor_selector', entity };
      }
      if (entity.targetFloor === 0 || entity.portalType === 'village') {
        ctx.returnToVillage?.();
        return { ok: true, type: 'portal', action: 'return_to_village', targetFloor: 0, entity };
      }
      const nextFloor = entity.targetFloor || (this.currentFloor + 1);
      const heroLv = Number(ctx?.gameState?.hero?.level ?? ctx?.game?.hero?.level ?? ctx?.hero?.level);
      if (
        Number.isFinite(heroLv) && heroLv > 0 && heroLv < MIN_DUNGEON_LEVEL && nextFloor > 0
        && (entity.portalType === 'dungeon_entrance' || entity.portalType === 'next_floor' || entity.portalType === 'secret_portal')
      ) {
        const gateMsg = `Dungeon entrance requires Level ${MIN_DUNGEON_LEVEL}! Train in Oakhaven Outskirts first (Lv ${heroLv}/${MIN_DUNGEON_LEVEL}).`;
        if (ctx.hud?.showToast) ctx.hud.showToast(gateMsg, 'warn');
        else ctx.hud?.toast?.(gateMsg, 'warn');
        return { ok: false, reason: `Requires Level ${MIN_DUNGEON_LEVEL}` };
      }
      ctx.enterFloor?.(nextFloor);
      return { ok: true, type: 'portal', action: 'enter_floor', targetFloor: nextFloor, entity };
    }

    if (type === 'npc') {
      return {
        ok: true,
        type: 'npc',
        npc: entity,
        actionType: entity.actionType,
        shopId: entity.shopId || entity.id
      };
    }

    return { ok: false, reason: 'Unhandled interaction' };
  }

  openChest(chestOrId, context = null) {
    const ctx = context || this.gameContext || {};
    const chest = typeof chestOrId === 'string'
      ? this.chests.find((c) => c.id === chestOrId)
      : (chestOrId?.entity || chestOrId);

    if (!chest) return { ok: false, opened: false, drops: [], gold: 0 };
    if (chest.isStorageChest || chest.type === 'storage_chest') {
      chest.isOpen = !chest.isOpen;
      chest.mesh?.userData?.setOpen?.(chest.isOpen);
      ctx.menus?.openMenu?.('storage');
      return { ok: true, opened: true, type: 'storage_chest', actionType: 'storage', menu: 'storage', chest, drops: [], gold: 0 };
    }
    if (chest.isOpen) return { ok: false, opened: false, drops: [], gold: 0 };
    if (chest.lockedByBoss) {
      ctx.hud?.showToast?.('The Boss Chest is sealed until the Floor Boss falls!', 'warning');
      return { ok: false, opened: false, locked: true, drops: [], gold: 0 };
    }

    chest.isOpen = true;
    chest.mesh?.userData?.setOpen?.(true);

    const floorLevel = Math.max(1, this.currentFloor || 1);
    const tierMult = chest.tier === 'boss' ? 4 : chest.tier === 'epic' ? 3 : chest.tier === 'rare' ? 2 : 1.3;
    const isVaultOrBoss = chest.tier === 'boss' || String(chest.id).includes('treasure') || Boolean(chest.isVaultChest) || this.specialRoomType === 'vault';
    const goldMultiplier = isVaultOrBoss ? 3.2 : 1.0;
    const goldAmount = Math.round((25 + floorLevel * (isVaultOrBoss ? 65 : 18)) * tierMult * goldMultiplier);

    const drops = [];
    // Spawn gold pile
    this.spawnGroundLoot(
      { x: chest.x + (Math.random() - 0.5) * 1.4, z: chest.z + 0.9 },
      { type: 'gold', name: `${goldAmount} Gold`, amount: goldAmount, rarity: isVaultOrBoss ? 'rare' : 'normal' }
    );

    // Guaranteed Seal gear & Alchemy Elixirs for vault puzzle / boss chests
    if (isVaultOrBoss && ctx.inventory?.generateItem) {
      const sealKind = floorLevel >= 8 ? (Math.random() < 0.45 ? 'moon' : 'star') : 'star';
      const sealGear = ctx.inventory.generateItem({ level: floorLevel, rarity: 'epic', seal: sealKind });
      if (sealGear) {
        drops.push(sealGear);
        this.spawnGroundLoot({ x: chest.x + 1.25, z: chest.z + 0.5 }, sealGear);
      }
      const elxKinds = ['elixir_weapon', 'elixir_armor', 'elixir_shield', 'elixir_accessory'];
      const elxBase = elxKinds[Math.floor(Math.random() * elxKinds.length)];
      const elixirItem = ctx.inventory.generateItem({ baseId: elxBase, count: Math.floor(1 + Math.random() * 2) });
      if (elixirItem) {
        drops.push(elixirItem);
        this.spawnGroundLoot({ x: chest.x - 1.25, z: chest.z + 0.5 }, elixirItem);
      }
    }

    // Secret rift portal spawn upon unlocking high-tier vault / boss chest
    if (isVaultOrBoss && this.currentFloor >= 3 && !this.secretPortalSpawned) {
      const targetSecretFloor = this.currentFloor <= 5 ? 101 : (this.currentFloor <= 9 ? 102 : 103);
      this._spawnSecretPortal(chest.x, chest.z - 2.8, targetSecretFloor);
      this.secretPortalSpawned = true;
      const riftMsg = `🌀 A shimmering Rift to Secret Floor S${targetSecretFloor - 100}F has manifested!`;
      if (ctx.hud?.showToast) ctx.hud.showToast(riftMsg, 'legendary');
      else ctx.hud?.toast?.(riftMsg, 'legendary');
    }

    // Roll 1-3 items using inventory system if available, or procedural item descriptors
    const itemCount = chest.tier === 'boss' ? 3 : chest.tier === 'epic' || chest.tier === 'rare' ? 2 : 1;
    for (let i = 0; i < itemCount; i++) {
      let item = null;
      if (ctx.inventory?.generateItem) {
        item = ctx.inventory.generateItem({ level: floorLevel, rarityBoost: tierMult });
      } else if (ctx.gameState?.inventory?.generateItem) {
        item = ctx.gameState.inventory.generateItem({ level: floorLevel });
      } else {
        item = this._createFallbackLootItem(floorLevel, chest.tier, i);
      }
      if (item) {
        drops.push(item);
        const angle = (i / itemCount) * Math.PI * 1.4 - 0.7;
        this.spawnGroundLoot(
          { x: chest.x + Math.sin(angle) * 1.15, z: chest.z + Math.cos(angle) * 1.15 },
          item
        );
      }
    }

    return { ok: true, opened: true, chest, drops, gold: goldAmount };
  }

  _createFallbackLootItem(level, tier = 'normal', idx = 0) {
    const rarities = ['normal', 'magic', 'rare', 'epic'];
    const rarity = tier === 'boss' ? 'epic' : tier === 'epic' ? 'rare' : rarities[Math.min(rarities.length - 1, idx + 1)];
    const templates = [
      { id: 'hp_potion_s', baseId: 'hp_potion_s', name: 'Healing Potion', type: 'consumable', subType: 'potion', rarity: 'normal', healHp: 80, count: 2 },
      { id: 'crystal_str', baseId: 'crystal_str', name: 'Ruby Might Crystal', type: 'crystal', subType: 'gem', rarity: 'magic', stats: { str: 2 + Math.floor(level / 3) }, count: 1 },
      { id: `blade_lv${level}`, name: `Arkenveil Longsword +${level}`, type: 'weapon', slot: 'weapon', rarity, level, stats: { atk: 8 + level * 4, critRate: 3 } },
      { id: `armor_lv${level}`, name: `Dungeon Plate +${level}`, type: 'armor', slot: 'armor', rarity, level, stats: { def: 6 + level * 3, maxHp: 25 + level * 10 } }
    ];
    return {
      uid: `loot_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      ...templates[(level + idx) % templates.length]
    };
  }

  getBreakablesInRadius(posOrX, rOrZ = 2.0, maybeR = 2.0) {
    const parsed = extractXZ(posOrX, rOrZ, maybeR);
    const x = parsed.x;
    const z = parsed.z;
    const radius = parsed.isObject ? Number(parsed.extra ?? 2.0) : Number(maybeR ?? 2.0);

    return this.breakables.filter(
      (b) => !b.destroyed && Math.hypot(b.x - x, b.z - z) <= radius + (b.radius || 0.45)
    );
  }

  getBreakablesInArc(originOrX, dirOrZ, rotOrRange = 0, rangeOrArc = 2.4, maybeArc = Math.PI * 0.9) {
    let ox = 0;
    let oz = 0;
    let forwardX = 0;
    let forwardZ = 1;
    let range = 2.4;
    let arcAngle = Math.PI * 0.9;

    if (typeof originOrX === 'object' && originOrX !== null) {
      ox = Number(originOrX.x || 0);
      oz = Number(originOrX.z || 0);
      range = Number(rotOrRange || 2.4);
      arcAngle = Number(rangeOrArc || Math.PI * 0.9);
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
      range = Number(rangeOrArc || 2.4);
      arcAngle = Number(maybeArc || Math.PI * 0.9);
    }

    const halfCos = Math.cos(arcAngle * 0.5);
    return this.breakables.filter((b) => {
      if (b.destroyed) return false;
      const dx = b.x - ox;
      const dz = b.z - oz;
      const dist = Math.hypot(dx, dz);
      if (dist > range + b.radius) return false;
      if (dist < 0.65) return true;
      const dot = (dx / dist) * forwardX + (dz / dist) * forwardZ;
      return dot >= halfCos;
    });
  }

  damageBreakable(breakableOrId, dmg = 15, context = null) {
    const brk = typeof breakableOrId === 'string'
      ? this.breakables.find((b) => b.id === breakableOrId)
      : breakableOrId;

    if (!brk || brk.destroyed) return { destroyed: false, drops: [], gold: 0 };

    brk.hp -= Math.max(1, Number(dmg) || 10);
    brk.mesh?.userData?.triggerHitFlash?.(0.14);

    if (brk.hp > 0) {
      return { destroyed: false, breakable: brk, drops: [], gold: 0 };
    }

    brk.destroyed = true;
    if (brk.mesh) {
      brk.mesh.visible = false;
      this.rootGroup.remove(brk.mesh);
    }

    const isExplosive = brk.kind === 'barrel_explosive';
    if (isExplosive) {
      if (this.renderer?.spawnHitSparks) {
        this.renderer.spawnHitSparks(new THREE.Vector3(brk.x, 0.4, brk.z), 0xef4444, 32);
      }
      if (this.renderer?.shake) {
        this.renderer.shake(0.4, 0.28);
      }

      // Detonate AoE damage to nearby enemies within 3.8m
      this.renderer?.spawnShockwave?.({ x: brk.x, y: 0.1, z: brk.z }, 3.8, 0xff5a2a, 0.35);
      const enemiesMgr = context?.enemies || context?.enemyManager || this.gameContext?.enemies || this.gameContext?.enemyManager;
      const enemyList = enemiesMgr?.enemies || enemiesMgr?.list || this.enemies || [];
      const aoeDamage = 160 + (this.currentFloor || 1) * 30;
      for (const e of [...enemyList]) {
        if (!e || e.dead || e.isDead || e.hp <= 0) continue;
        const dx = e.x - brk.x;
        const dz = e.z - brk.z;
        const ed = Math.hypot(dx, dz);
        if (ed <= 3.8) {
          const kbDir = ed > 0.01 ? { x: dx / ed, z: dz / ed } : null;
          if (enemiesMgr && typeof enemiesMgr.damageEnemy === 'function') {
            enemiesMgr.damageEnemy(e, aoeDamage, true, kbDir, 'fire');
          } else if (typeof e.receiveDamage === 'function') {
            e.receiveDamage(aoeDamage, { name: 'Explosive Barrel' }, { isCrit: true, element: 'fire' });
          } else if (e.hp != null) {
            e.hp -= aoeDamage;
          }
        }
      }

      // Detonate small feedback damage to player if too close (< 2.2m)
      const p = context?.player || this.gameContext?.player;
      if (p?.position && Math.hypot(p.position.x - brk.x, p.position.z - brk.z) <= 2.2) {
        p.receiveHit?.(25, { name: 'Explosive Barrel' }, { element: 'fire' });
      }

      const hud = context?.hud || this.gameContext?.hud;
      hud?.showToast?.('💥 EXPLOSIVE BARREL DETONATED! Heavy AoE Fire Blast!', 'warning');
    } else if (this.renderer?.spawnHitSparks) {
      this.renderer.spawnHitSparks(new THREE.Vector3(brk.x, 0.4, brk.z), 0xfbbf24, 10);
    }

    const drops = [];
    let gold = 0;
    const roll = Math.random();
    if (roll < 0.55) {
      gold = 5 + Math.floor(Math.random() * 12) + Math.max(0, this.currentFloor * 4);
      const loot = this.spawnGroundLoot(
        { x: brk.x, z: brk.z },
        { type: 'gold', name: `${gold} Gold`, amount: gold, rarity: 'normal' }
      );
      drops.push(loot);
    } else if (roll < 0.78) {
      const potionItem = this._createFallbackLootItem(Math.max(1, this.currentFloor), 'normal', 0);
      const loot = this.spawnGroundLoot({ x: brk.x, z: brk.z }, potionItem);
      drops.push(loot);
    }

    return {
      destroyed: true,
      breakable: brk,
      drops,
      gold,
      position: { x: brk.x, y: 0, z: brk.z }
    };
  }

  _attachRarityBeam(mesh, beamDef) {
    if (!mesh || !beamDef) return;
    const col = beamDef.color || 0x38bdf8;
    // Vertical beam pillar
    const beamGeo = new THREE.CylinderGeometry(beamDef.radius * 0.45, beamDef.radius, beamDef.height, 16, 1, true);
    const beamMat = new THREE.MeshBasicMaterial({
      color: col,
      transparent: true,
      opacity: 0.45,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    const beamMesh = new THREE.Mesh(beamGeo, beamMat);
    beamMesh.position.y = beamDef.height * 0.5;
    mesh.add(beamMesh);

    // Ground ring
    const ringGeo = new THREE.RingGeometry(beamDef.ringRadius * 0.82, beamDef.ringRadius, 24);
    const ringMat = new THREE.MeshBasicMaterial({
      color: col,
      transparent: true,
      opacity: 0.65,
      side: THREE.DoubleSide
    });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.rotation.x = -Math.PI / 2;
    ringMesh.position.y = 0.04;
    mesh.add(ringMesh);

    // Orbit group with orbiting crystal motes
    const orbitGroup = new THREE.Group();
    orbitGroup.name = 'RarityOrbitGroup';
    const moteGeo = new THREE.OctahedronGeometry(0.12, 0);
    const moteMat = new THREE.MeshStandardMaterial({
      color: col,
      emissive: new THREE.Color(col),
      emissiveIntensity: 0.85,
      roughness: 0.2,
      metalness: 0.6
    });
    const count = Math.max(1, beamDef.orbitCount || 2);
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const mote = new THREE.Mesh(moteGeo, moteMat);
      mote.position.set(
        Math.cos(angle) * beamDef.ringRadius,
        0.35,
        Math.sin(angle) * beamDef.ringRadius
      );
      orbitGroup.add(mote);
    }
    mesh.add(orbitGroup);
    mesh.userData.orbitGroup = orbitGroup;
  }

  spawnLoot(item, pos = null) {
    if (!item) return null;
    let actualItem = item;
    let actualPos = pos;
    if (
      item &&
      typeof item === 'object' &&
      'x' in item &&
      'z' in item &&
      !('type' in item) &&
      !('slot' in item) &&
      !('rarity' in item) &&
      !('baseId' in item)
    ) {
      actualPos = item;
      actualItem = pos;
    }
    const origin = actualPos || { x: 0, z: 0 };
    const targetX = actualPos?.targetX ?? actualPos?.x ?? 0;
    const targetZ = actualPos?.targetZ ?? actualPos?.z ?? 0;

    const lootEntry = this.spawnGroundLoot({ x: targetX, z: targetZ }, actualItem, null, origin);
    if (lootEntry) {
      lootEntry.startX = Number(origin.x || 0);
      lootEntry.startZ = Number(origin.z || 0);
      lootEntry.targetX = lootEntry.x;
      lootEntry.targetZ = lootEntry.z;
      lootEntry.tossElapsed = 0;
      lootEntry.tossDuration = RARITY_BEAMS.tossDuration;
    }
    return lootEntry;
  }

  spawnGroundLoot(posOrX, itemOrZ, maybeItem = null, startOrigin = null, maybeOpts = null) {
    let x = 0;
    let z = 0;
    let item = itemOrZ;
    let opts = (typeof startOrigin === 'object' && startOrigin && !('x' in startOrigin) ? startOrigin : maybeOpts) || {};
    let origin = (startOrigin && 'x' in startOrigin ? startOrigin : null);
    if (typeof posOrX === 'object' && posOrX !== null) {
      x = Number(posOrX.x || 0);
      z = Number(posOrX.z || 0);
    } else {
      x = Number(posOrX || 0);
      z = Number(itemOrZ || 0);
      item = maybeItem;
    }
    if (!item) return null;

    const isGold = item.type === 'gold' || (typeof item === 'number');
    const goldAmount = typeof item === 'number' ? item : (item.amount || item.gold || 0);
    const rarity = item.rarity || 'normal';

    const mesh = (this.models3d?.createLootMesh || createLootMesh)(isGold ? 'gold' : item, rarity);
    const startX = origin ? Number(origin.x ?? x) : x;
    const startZ = origin ? Number(origin.z ?? z) : z;
    mesh.position.set(startX, 0.25, startZ);
    this.rootGroup.add(mesh);

    const sealKey = item?.seal;
    if (sealKey && RARITY_BEAMS[sealKey]) {
      this._attachRarityBeam(mesh, RARITY_BEAMS[sealKey]);
    }

    const pickupCooldown = Number(opts?.pickupCooldown) || 0;
    const lootEntry = {
      id: `ground_loot_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      type: 'loot',
      isGold,
      goldAmount,
      item: isGold ? null : item,
      name: isGold ? `${goldAmount} Gold` : (item.name || 'Equipment'),
      rarity,
      collected: false,
      canPickupAfter: pickupCooldown > 0 ? Date.now() + pickupCooldown : 0,
      x,
      y: 0.25,
      z,
      position: { x, y: 0.25, z },
      startX,
      startZ,
      targetX: x,
      targetZ: z,
      tossElapsed: 0,
      tossDuration: RARITY_BEAMS.tossDuration,
      mesh
    };
    this.groundLoot.push(lootEntry);
    return lootEntry;
  }

  pickupLoot(lootOrId, context = null) {
    const ctx = context || this.gameContext || {};
    const loot = typeof lootOrId === 'string'
      ? this.groundLoot.find((l) => l.id === lootOrId)
      : lootOrId;

    if (!loot || loot.collected) return { ok: false };
    if (loot.canPickupAfter && Date.now() < loot.canPickupAfter) return { ok: false };

    if (loot.isGold) {
      loot.collected = true;
      if (loot.mesh) {
        loot.mesh.visible = false;
        this.rootGroup.remove(loot.mesh);
      }
      if (ctx.gameState?.addGold) {
        ctx.gameState.addGold(loot.goldAmount);
      } else if (ctx.gameState?.hero) {
        ctx.gameState.hero.gold = (ctx.gameState.hero.gold || 0) + loot.goldAmount;
      }
      return { ok: true, isGold: true, amount: loot.goldAmount, name: loot.name };
    }

    if (loot.item) {
      const inv = ctx.inventory || ctx.gameState?.inventory;
      if (inv?.addItem) {
        const now = Date.now();
        const suppressToast = Boolean(this._bagFullToastAt && now - this._bagFullToastAt < 2500);
        const res = inv.addItem(loot.item, { silent: suppressToast });
        if (res && res.ok === false) {
          if (!suppressToast) {
            this._bagFullToastAt = now;
            if (!ctx.gameState) {
              ctx.hud?.showToast?.('Bag is full — store items in your General Vault or sell gear!', 'warning');
            }
          }
          return { ok: false, full: true, reason: res.msg || 'Bag is full' };
        }
        if (res?.leftover && res.leftover.count > 0) {
          loot.item = res.leftover;
          loot.name = `${loot.item.name || 'Item'} x${loot.item.count}`;
          return { ok: true, partial: true, isGold: false, item: loot.item, name: loot.name };
        }
      }
      if (ctx.quests?.onCollect) {
        ctx.quests.onCollect(loot.item.baseId || loot.item.id, 1);
      } else if (ctx.quests?.onItemCollected) {
        ctx.quests.onItemCollected(loot.item.baseId || loot.item.id);
      }
    }

    loot.collected = true;
    if (loot.mesh) {
      loot.mesh.visible = false;
      this.rootGroup.remove(loot.mesh);
    }

    return { ok: true, isGold: false, item: loot.item, name: loot.name };
  }

  pickupNearbyLoot(posOrX, radiusOrZ = 1.65, radiusOrContext = 1.65, maybeContext = null) {
    const parsed = extractXZ(posOrX, radiusOrZ, radiusOrContext);
    const x = parsed.x;
    const z = parsed.z;
    const radius = parsed.isObject
      ? Number(typeof radiusOrZ === 'number' ? radiusOrZ : 1.65)
      : Number(typeof radiusOrContext === 'number' ? radiusOrContext : 1.65);
    const ctx = (parsed.isObject
      ? (typeof radiusOrContext === 'object' ? radiusOrContext : null)
      : maybeContext) || this.gameContext || {};

    const picked = [];
    for (const loot of this.groundLoot) {
      if (loot.collected) continue;
      if (Math.hypot(loot.x - x, loot.z - z) <= radius) {
        const res = this.pickupLoot(loot, ctx);
        if (res.ok) picked.push(loot);
      }
    }
    return picked;
  }

  /**
   * Per-frame update for portals, torches, traps, chests, NPCs, room exploration, and ground loot
   */
  update(dt = 0.016, elapsedOrPlayerPos = null, playerPosOrCallbacks = null, maybeCallbacks = null) {
    this.elapsedTime += dt;
    let time = this.elapsedTime;
    let playerPos = null;
    let callbacks = maybeCallbacks || {};

    if (typeof elapsedOrPlayerPos === 'number') {
      time = elapsedOrPlayerPos;
      playerPos = playerPosOrCallbacks;
    } else if (typeof elapsedOrPlayerPos === 'object' && elapsedOrPlayerPos !== null) {
      playerPos = elapsedOrPlayerPos;
      callbacks = playerPosOrCallbacks || {};
    }

    const px = playerPos ? Number(playerPos.x ?? playerPos.position?.x ?? 0) : null;
    const pz = playerPos ? Number(playerPos.z ?? playerPos.position?.z ?? 0) : null;

    // Update room explored flag when player walks into or near a room
    if (px !== null && pz !== null) {
      for (const room of this.rooms) {
        if (
          px >= room.x - 4 &&
          px <= room.x + room.w + 4 &&
          pz >= room.z - 4 &&
          pz <= room.z + room.h + 4
        ) {
          room.explored = true;
        }
      }
    }

    // Animate NPCs & update quest markers if available
    for (const npc of this.npcs) {
      npc.mesh?.userData?.animate?.(time, dt);
      const questsSys = this.gameContext?.quests || this.gameContext?.gameState?.quests;
      if (questsSys?.getNpcMarker && npc.mesh?.userData?.setQuestMarker) {
        npc.mesh.userData.setQuestMarker(questsSys.getNpcMarker(npc.id));
      }
    }

    if (this.villageBuild) this.villageBuild.update(dt, time, playerPos);

    if (this.currentFloor === 0 && px !== null && pz !== null) {
      const distToHotSprings = Math.hypot(px - HOT_SPRINGS.center.x, pz - HOT_SPRINGS.center.z);
      if (distToHotSprings <= HOT_SPRINGS.radius) {
        const gs = this.context?.gameState || this.gameContext?.gameState;
        gs?.soakInHotSprings?.(dt);
      }
    }

    // Animate Portals, Torches, Chests, Shrines, and Ground Loot
    for (const portal of this.portals) {
      portal.mesh?.userData?.animate?.(time, dt);
    }
    for (const torch of this.torches) {
      torch.mesh?.userData?.animate?.(time, dt);
    }
    for (const p of this.puzzleProps) {
      p.mesh?.userData?.animate?.(time, dt);
    }
    if (this._lightPool.length) {
      this._lightClock += dt;
      if (px !== null && (this._lightClock >= 0.25 || !this._lightPrimed)) {
        this._lightClock = 0;
        this._lightPrimed = true;
        this._updateLightBudget(playerPos);
      }
      this._tickLightPool(dt, time);
    }
    for (const chest of this.chests) {
      chest.mesh?.userData?.animate?.(time, dt);
    }
    for (const shrine of this.shrines) {
      if (shrine.mesh?.userData?.orb) {
        shrine.mesh.userData.orb.rotation.y = time * 2.0;
        shrine.mesh.userData.orb.position.y = 1.35 + Math.sin(time * 3) * 0.08;
      }
      if (shrine.mesh?.userData?.crystal) {
        shrine.mesh.userData.crystal.rotation.y = time * 1.8;
        shrine.mesh.userData.crystal.position.y = 2.05 + Math.sin(time * 2.6) * 0.1;
      }
    }
    for (const loot of this.lootDrops) {
      if (loot.collected) continue;

      if (loot.tossElapsed < loot.tossDuration) {
        loot.tossElapsed += dt;
      }
      const t = Math.min(1, loot.tossElapsed / loot.tossDuration);

      if (t < 1) {
        const curX = loot.startX + (loot.targetX - loot.startX) * t;
        const curZ = loot.startZ + (loot.targetZ - loot.startZ) * t;
        const arcY = 0.25 + 4 * RARITY_BEAMS.tossApex * t * (1 - t);
        loot.x = curX;
        loot.z = curZ;
        loot.y = arcY;
        if (loot.mesh) {
          loot.mesh.position.set(curX, arcY, curZ);
        }
        if (loot.position) {
          loot.position.x = curX;
          loot.position.y = arcY;
          loot.position.z = curZ;
        }
      } else {
        loot.x = loot.targetX;
        loot.z = loot.targetZ;
        if (loot.mesh) {
          loot.mesh.position.x = loot.targetX;
          loot.mesh.position.z = loot.targetZ;
          loot.mesh.position.y = 0.25 + Math.sin(time * 3 + (loot.startX || 0)) * 0.06;
          loot.mesh.userData?.animate?.(time, dt);
          if (loot.mesh.userData?.orbitGroup) {
            loot.mesh.userData.orbitGroup.rotation.y += dt * 2.4;
          }
        }
        if (loot.position) {
          loot.position.x = loot.targetX;
          loot.position.y = loot.mesh ? loot.mesh.position.y : 0.25;
          loot.position.z = loot.targetZ;
        }
      }
    }

    // Update dungeon traps & check player hazard collision
    for (const trap of this.traps) {
      trap.hitCooldown = Math.max(0, trap.hitCooldown - dt);
      const wave = Math.sin(time * 2.6 + trap.phaseOffset);
      trap.isActive = wave > 0.25;
      trap.mesh?.userData?.setActive?.(trap.isActive);

      if (trap.isActive && trap.hitCooldown <= 0 && px !== null && pz !== null) {
        if (Math.hypot(px - trap.x, pz - trap.z) <= trap.radius) {
          trap.hitCooldown = 1.1;
          if (callbacks?.onTrapHit) {
            callbacks.onTrapHit(trap, trap.damage, trap.element);
          } else if (this.gameContext?.gameState?.takeDamage) {
            this.gameContext.gameState.takeDamage(trap.damage, { element: trap.element, source: trap });
          }
        }
      }
    }
  }

  /**
   * Build 2D minimap descriptor matching @ui-hud's getMinimap() contract
   */
  getMinimapData(playerPos = { x: 0, z: 0 }, playerAngle = 0, enemies = []) {
    const px = Number(playerPos?.x ?? 0);
    const pz = Number(playerPos?.z ?? playerPos?.y ?? 0);

    const entities = [];

    for (const npc of this.npcs) {
      entities.push({ type: 'npc', x: npc.x, y: npc.z, name: npc.name });
    }
    for (const chest of this.chests) {
      if (!chest.isOpen) {
        entities.push({ type: 'chest', x: chest.x, y: chest.z });
      }
    }
    for (const portal of this.portals) {
      entities.push({ type: 'portal', x: portal.x, y: portal.z, name: portal.name });
    }
    if (Array.isArray(enemies)) {
      for (const e of enemies) {
        if (e && !e.isDead && e.state !== 'DEAD' && e.state !== 'dead') {
          entities.push({
            type: e.isBoss ? 'boss' : e.isGiant ? 'miniboss' : 'enemy',
            x: Number(e.x ?? e.position?.x ?? 0),
            y: Number(e.z ?? e.position?.z ?? 0)
          });
        }
      }
    }

    return {
      zone: this.floorName,
      floor: this.currentFloor,
      w: this.gridWidth * this.tileSize,
      h: this.gridHeight * this.tileSize,
      rooms: this.rooms.map((r) => ({
        x: r.x,
        y: r.z,
        w: r.w,
        h: r.h,
        type: r.type,
        explored: Boolean(r.explored)
      })),
      player: {
        x: px,
        y: pz,
        angle: Number(playerAngle || 0)
      },
      entities
    };
  }

  getFloorState() {
    return {
      zone: this.zone,
      floor: this.currentFloor,
      name: this.floorName,
      subtitle: this.floorDef?.subtitle || this.theme?.subtitle || '',
      theme: this.theme?.id || 'cave',
      sroDungeon: this.sroDungeon || this.theme?.id || 'donhwang',
      width: this.gridWidth,
      height: this.gridHeight,
      tileSize: this.tileSize,
      grid: this.grid,
      spawnPoint: { ...this.spawnPoint },
      rooms: this.rooms,
      npcs: this.npcs,
      chests: this.chests,
      breakables: this.breakables,
      portals: this.portals,
      traps: this.traps,
      torches: this.torches,
      switches: this.switches,
      gates: this.gates,
      shrines: this.shrines,
      groundLoot: this.groundLoot,
      hotSprings: this.currentFloor === 0 ? (this.hotSprings || this.villageBuild?.hotSprings || {
        x: HOT_SPRINGS.center.x,
        z: HOT_SPRINGS.center.z,
        radius: HOT_SPRINGS.radius,
        name: 'Jade Mist Hot Springs'
      }) : null,
      bossRoom: this.bossRoom,
      bossArena: this.bossArena,
      bossGate: this.bossGate,
      atmosphere: this.theme?.atmosphere ? { ...this.theme.atmosphere } : null,
      portalStyle: this.theme?.portalStyle || 'jade_gate',
      monsterTypes: Array.isArray(this.floorDef?.monsterTypes) ? [...this.floorDef.monsterTypes] : [],
      outskirtCamps: this.zone === 'village' ? (this.outskirtCamps || []) : [],
      townWallHalf: this.zone === 'village' ? (this.townWallHalf || 55) : 0,
      exitLockedByClear: Boolean(this.exitLockedByClear),
      minDungeonLevel: MIN_DUNGEON_LEVEL,
      puzzle: this.puzzle,
      specialRoom: this.zone === 'dungeon' ? this.specialRoomType : null,
      puzzleProps: this.puzzleProps
    };
  }

  /**
   * Suspend active dungeon floor geometry & entities without disposing meshes,
   * so a timed Challenge Arena can run and restore exact floor progress afterward.
   */
  suspendFloorWorld() {
    this._freeLightPool();
    if (this.renderer?.clearDynamicLights) {
      this.renderer.clearDynamicLights();
    }
    const rootChildren = [...this.rootGroup.children];
    for (const child of rootChildren) {
      this.rootGroup.remove(child);
    }
    return {
      zone: this.zone,
      currentFloor: this.currentFloor,
      themeKey: this.themeKey,
      theme: this.theme,
      floorSeed: this.floorSeed,
      gridWidth: this.gridWidth,
      gridHeight: this.gridHeight,
      originX: this.originX,
      originZ: this.originZ,
      grid: this.grid,
      spawnPoint: { ...this.spawnPoint },
      rooms: this.rooms,
      corridors: this.corridors,
      npcs: this.npcs,
      chests: this.chests,
      breakables: this.breakables,
      portals: this.portals,
      traps: this.traps,
      torches: this.torches,
      switches: this.switches,
      gates: this.gates,
      shrines: this.shrines,
      groundLoot: this.groundLoot,
      solidObstacles: this.solidObstacles,
      bossRoom: this.bossRoom,
      bossArena: this.bossArena,
      bossGate: this.bossGate,
      puzzle: this.puzzle,
      puzzleProps: this.puzzleProps,
      specialRoomType: this.specialRoomType,
      _reserved: this._reserved,
      _lightSources: this._lightSources,
      _wallTiles: this._wallTiles,
      rootChildren
    };
  }

  restoreFloorWorld(snap) {
    this.clearWorld();
    if (!snap) return null;
    this.zone = snap.zone || 'dungeon';
    this.currentFloor = snap.currentFloor;
    this.themeKey = snap.themeKey;
    this.theme = snap.theme;
    this.floorSeed = snap.floorSeed;
    this.gridWidth = snap.gridWidth;
    this.gridHeight = snap.gridHeight;
    this.originX = snap.originX;
    this.originZ = snap.originZ;
    this.grid = snap.grid;
    this.spawnPoint = snap.spawnPoint;
    this.rooms = snap.rooms || [];
    this.corridors = snap.corridors || [];
    this.npcs = snap.npcs || [];
    this.chests = snap.chests || [];
    this.breakables = snap.breakables || [];
    this.portals = snap.portals || [];
    this.traps = snap.traps || [];
    this.torches = snap.torches || [];
    this.switches = snap.switches || [];
    this.gates = snap.gates || [];
    this.shrines = snap.shrines || [];
    this.groundLoot = snap.groundLoot || [];
    this.lootDrops = this.groundLoot;
    this.solidObstacles = snap.solidObstacles || [];
    this.bossRoom = snap.bossRoom || null;
    this.bossArena = snap.bossArena || null;
    this.bossGate = snap.bossGate || null;
    this.puzzle = snap.puzzle || null;
    this.puzzleProps = snap.puzzleProps || [];
    this.specialRoomType = snap.specialRoomType || null;
    this._reserved = snap._reserved || [];
    this._lightSources = snap._lightSources || [];
    this._wallTiles = snap._wallTiles || [];
    for (const child of snap.rootChildren || []) {
      this.rootGroup.add(child);
    }
    this._createLightPool();
    return this.getFloorState();
  }

  getFloorDef(fNum) {
    return (fNum >= 100 ? FLOOR_DEFINITIONS.find((d) => d.floor === fNum) : null)
      || FLOOR_DEFINITIONS.find((d) => d.floor === fNum)
      || FLOOR_DEFINITIONS[(fNum - 1) % FLOOR_DEFINITIONS.length]
      || FLOOR_DEFINITIONS[0];
  }

  _getFloorDef(fNum) {
    return this.getFloorDef(fNum);
  }

  /**
   * Build a dedicated 24x24m Challenge Coliseum for timed trials.
   */
  generateChallengeArena(challengeCfg, floorNum = 1, rendererOverride = null, models3dOverride = null) {
    if (models3dOverride) this.models3d = models3dOverride;
    this._ensureSceneAttached(rendererOverride);
    this.clearWorld();

    const fNum = Math.max(1, Number(floorNum) || 1);
    const cfg = typeof challengeCfg === 'string'
      ? (CHALLENGE_TYPES[challengeCfg] || CHALLENGE_TYPES.survival_60)
      : (challengeCfg || CHALLENGE_TYPES.survival_60);

    const floorDef = this._getFloorDef(fNum);
    this.zone = 'challenge';
    this.currentFloor = fNum;
    this.themeKey = floorDef.theme || 'boss';
    this.theme = DUNGEON_THEMES[this.themeKey] || DUNGEON_THEMES.boss;
    this.sroDungeon = floorDef?.sroDungeon || null;

    const gw = 16;
    const gh = 16;
    this.gridWidth = 20;
    this.gridHeight = 20;
    this.originX = -(this.gridWidth * this.tileSize) * 0.5;
    this.originZ = -(this.gridHeight * this.tileSize) * 0.5;
    this.grid = Array.from({ length: this.gridHeight }, () => Array(this.gridWidth).fill(TILE.WALL));

    for (let gz = 2; gz < 2 + gh; gz++) {
      for (let gx = 2; gx < 2 + gw; gx++) {
        this.grid[gz][gx] = TILE.FLOOR;
      }
    }

    const topLeft = this.gridToWorld(2, 2);
    const roomObj = {
      id: 0,
      type: 'challenge',
      archetype: 'coliseum',
      gx: 2,
      gz: 2,
      gw,
      gh,
      x: topLeft.x - this.tileSize * 0.5,
      y: topLeft.z - this.tileSize * 0.5,
      z: topLeft.z - this.tileSize * 0.5,
      w: gw * this.tileSize,
      h: gh * this.tileSize,
      centerX: 0,
      centerZ: 0,
      explored: true,
      cleared: false
    };
    this.rooms = [roomObj];
    this.spawnPoint = { x: 0, y: 0, z: 6.0 };

    const rand = seededRandom(fNum * 131 + cfg.duration);
    this._buildDungeonGeometry(rand);

    const accent = cfg.color || 0xf59e0b;

    // Perimeter Arena Torches, Diagonal War Braziers & 12 Coliseum Pillars (32x32m)
    const torchSpots = [
      [-14.0, -14.0], [14.0, -14.0], [-14.0, 14.0], [14.0, 14.0],
      [-14.4, 0], [14.4, 0], [0, -14.4], [0, 14.4]
    ];
    for (const [tx, tz] of torchSpots) {
      this._spawnTorch(tx, tz, accent);
    }

    const brazierSpots = [
      [-9.2, -9.2], [9.2, -9.2], [-9.2, 9.2], [9.2, 9.2]
    ];
    for (const [bx, bz] of brazierSpots) {
      this._batch.add('box', bx, 0.22, bz, 1.35, 0.44, 1.35, 0, 0x1e293b);
      this._batch.add('cyl', bx, 0.65, bz, 0.78, 0.46, 0.78, 0, 0x78350f);
      this._batch.add('glowBox', bx, 0.96, bz, 0.56, 0.24, 0.56, 0, accent);
      this.solidObstacles.push({ x: bx, z: bz, radius: 0.72 });
    }

    const pillarCount = 12;
    const pillarRadius = 13.6;
    for (let i = 0; i < pillarCount; i++) {
      const ang = ((i + 0.5) / pillarCount) * Math.PI * 2;
      const px = Math.cos(ang) * pillarRadius;
      const pz = Math.sin(ang) * pillarRadius;
      this._batch.add('box', px, 0.28, pz, 1.45, 0.56, 1.45, 0, 0x334155);
      this._batch.add('cyl', px, 2.2, pz, 0.9, 3.4, 0.9, 0, 0x475569);
      this._batch.add('box', px, 4.0, pz, 1.32, 0.4, 1.32, 0, 0x64748b);
      this._batch.add('glowBox', px, 2.6, pz, 1.0, 0.26, 1.0, 0, accent);
      this.solidObstacles.push({ x: px, z: pz, radius: 0.7 });
    }

    // Stepped center mosaic dais & cardinal bronze crossways (non-blocking)
    this._batch.add('cyl', 0, 0.014, 0, 11.2, 0.025, 11.2, 0, 0x0f172a);
    this._batch.add('cyl', 0, 0.02, 0, 7.6, 0.028, 7.6, 0, 0x1e293b);
    this._batch.add('box', 0, 0.022, 0, 26.5, 0.024, 0.36, 0, 0xb45309);
    this._batch.add('box', 0, 0.022, 0, 0.36, 0.024, 26.5, 0, 0xb45309);

    for (const [innerR, outerR, opac] of [[4.8, 5.15, 0.48], [8.8, 9.15, 0.34], [12.1, 12.4, 0.26]]) {
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(innerR, outerR, 64),
        new THREE.MeshBasicMaterial({ color: accent, side: THREE.DoubleSide, transparent: true, opacity: opac })
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.036;
      this.rootGroup.add(ring);
    }

    this._decorMeshCount = this._batch.flush(this.rootGroup);
    this._createLightPool();
    return {
      ...this.getFloorState(),
      challenge: cfg
    };
  }

  /**
   * Spawn reward chests inside the Challenge Arena upon survival/victory.
   */
  spawnChallengeRewardChests(challengeCfg = null, floorNum = this.currentFloor) {
    const tiers = challengeCfg?.chestTiers || ['rare', 'rare', 'epic'];
    const positions = [
      [-3.8, -2.6],
      [0, -3.2],
      [3.8, -2.6]
    ];
    const spawned = [];
    positions.forEach(([cx, cz], idx) => {
      const tier = tiers[idx % tiers.length];
      const chest = this._spawnChest(cx, cz, tier, `challenge_reward_f${floorNum}_${idx}_${Date.now()}`);
      chest.isVaultChest = true;
      spawned.push(chest);
    });
    return spawned;
  }

  /**
   * Spawn an animated Return Portal inside the cleared Challenge Arena to warp back to the dungeon floor.
   */
  spawnChallengeReturnPortal(floorNum = this.currentFloor) {
    const px = 0;
    const pz = -10.0;
    const portalMesh = (this.models3d?.createPortalMesh || createPortalMesh)(0x10b981, 'challenge_return');
    portalMesh.position.set(px, 0, pz);
    portalMesh.userData?.playSpawnAnimation?.();
    this.rootGroup.add(portalMesh);
    this._lightSources.push({ x: px, y: 2.2, z: pz, color: 0x10b981, intensity: 3.4, distance: 14 });
    this._freeLightPool();
    this._createLightPool();

    const retPortal = {
      id: `challenge_return_f${floorNum}`,
      type: 'portal',
      portalType: 'challenge_return',
      name: `Return to Floor B${floorNum}F`,
      targetFloor: floorNum,
      x: px,
      y: 0,
      z: pz,
      position: { x: px, y: 0, z: pz },
      prompt: `✨ Challenge Complete! Return to Floor B${floorNum}F [E]`,
      mesh: portalMesh
    };
    this.portals.push(retPortal);
    return retPortal;
  }
}

export function createDungeonGenerator(options, models3d, data) {
  return new DungeonGenerator(options, models3d, data);
}

export default DungeonGenerator;

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
  createStairsMesh
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
  loadSROProp
} from './dungeonDecor.js';

const LIGHT_POOL_SIZE = 8;

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

const SPECIAL_ROOM_CYCLE = ['vault', 'shrine', 'processional', 'trap_gallery'];

export const DUNGEON_THEMES = {
  village: {
    id: 'village',
    name: 'Oakhaven Village',
    subtitle: 'Safe Haven & Adventurer Hub',
    floorColor: 0x5c7a52,
    pathColor: 0x8b9bb0,
    wallColor: 0x73849a,
    trimColor: 0xb8c7d9,
    torchColor: 0xffbb55,
    portalColor: 0x38bdf8,
    ambientColor: 0xdbeafe,
    fogColor: 0x334155,
    element: 'physical',
    breakableTypes: ['barrel', 'crate']
  },
  cave: {
    id: 'cave',
    name: 'Mine Outskirts',
    subtitle: 'Timbered Galleries & Glittering Ore',
    decor: 'cave',
    atmosphere: { fogColor: 0x1d1810, fogNear: 24, fogFar: 70, ambientColor: 0xd9b98a, ambientIntensity: 0.95, keyLightColor: 0xffd9a0, keyLightIntensity: 1.25, dust: true, weather: 'spores', weatherColor: 0xfde68a },
    floorColor: 0x7c6f5e,
    altFloorColor: 0x6e6150,
    wallColor: 0x94836d,
    trimColor: 0xb5a186,
    torchColor: 0xffaa44,
    portalColor: 0x38bdf8,
    ambientColor: 0xfde68a,
    element: 'physical',
    trapTypes: ['spikes', 'poison'],
    breakableTypes: ['barrel', 'crate', 'crystal']
  },
  crypt: {
    id: 'crypt',
    name: 'Sealed Catacombs',
    subtitle: 'Sarcophagi, Bone Niches & Candlelight',
    decor: 'crypt',
    atmosphere: { fogColor: 0x141a2a, fogNear: 22, fogFar: 64, ambientColor: 0x9fb4d8, ambientIntensity: 0.9, keyLightColor: 0xa9c4ff, keyLightIntensity: 1.1, dust: true, weather: 'snow', weatherColor: 0xbae6fd },
    floorColor: 0x5a657d,
    altFloorColor: 0x4d576e,
    wallColor: 0x707d99,
    trimColor: 0x94a3b8,
    torchColor: 0x67e8f9,
    portalColor: 0xc084fc,
    ambientColor: 0xbae6fd,
    element: 'poison',
    trapTypes: ['spikes', 'poison', 'ice'],
    breakableTypes: ['urn', 'barrel', 'crystal']
  },
  ruins: {
    id: 'ruins',
    name: 'Sunken Temple',
    subtitle: 'Broken Pillars & Creeping Vines',
    decor: 'ruins',
    atmosphere: { fogColor: 0x10201c, fogNear: 26, fogFar: 74, ambientColor: 0xa8dcc4, ambientIntensity: 1.0, keyLightColor: 0xcfffe8, keyLightIntensity: 1.3, dust: true, weather: 'rain', weatherColor: 0x6ee7b7 },
    floorColor: 0x56756c,
    altFloorColor: 0x49665d,
    wallColor: 0x6d9186,
    trimColor: 0x99bfb3,
    torchColor: 0x6ee7b7,
    portalColor: 0x22d3ee,
    ambientColor: 0xa7f3d0,
    element: 'lightning',
    trapTypes: ['spikes', 'lightning', 'ice'],
    breakableTypes: ['urn', 'crate', 'crystal']
  },
  lava: {
    id: 'lava',
    name: 'Ember Forge',
    subtitle: 'Magma Cracks, Anvils & Hanging Chains',
    decor: 'lava',
    atmosphere: { fogColor: 0x240d08, fogNear: 22, fogFar: 62, ambientColor: 0xffb487, ambientIntensity: 0.95, keyLightColor: 0xff9a5a, keyLightIntensity: 1.3, dust: false, weather: 'embers', weatherColor: 0xf97316 },
    floorColor: 0x7a4942,
    altFloorColor: 0x693d37,
    wallColor: 0x96564d,
    trimColor: 0xc26d61,
    torchColor: 0xff7733,
    portalColor: 0xfb923c,
    ambientColor: 0xfed7aa,
    element: 'fire',
    trapTypes: ['fire', 'spikes'],
    breakableTypes: ['urn', 'barrel', 'crystal']
  },
  boss: {
    id: 'boss',
    name: "Emperor's Tomb",
    subtitle: 'Terracotta Legions & Quicksilver Rivers',
    decor: 'abyss',
    atmosphere: { fogColor: 0x0f0e1c, fogNear: 22, fogFar: 66, ambientColor: 0xa6a0d8, ambientIntensity: 0.9, keyLightColor: 0x9ff0cf, keyLightIntensity: 1.15, dust: true, weather: 'spores', weatherColor: 0xd8b4fe },
    floorColor: 0x634b82,
    altFloorColor: 0x553f73,
    wallColor: 0x7c5fa3,
    trimColor: 0xa78bfa,
    torchColor: 0xd8b4fe,
    portalColor: 0xf87171,
    ambientColor: 0xe9d5ff,
    element: 'dark',
    trapTypes: ['lightning', 'fire', 'spikes'],
    breakableTypes: ['urn', 'crystal']
  }
};

export const FLOOR_DEFINITIONS = [
  // recommendedLevel mirrors floorMonsterLevel(floor) in src/systems/inventory.js (monster level & loot tier)
  { floor: 1, name: 'Bifrost Valley B1F', theme: 'cave', recommendedLevel: 1, isBossFloor: false, monsterTypes: ['mangyang', 'gyo_weasel', 'bigeye_ghost', 'slime'] },
  { floor: 2, name: 'Jangan Outskirts B2F', theme: 'cave', recommendedLevel: 3, isBossFloor: false, monsterTypes: ['mangyang', 'gyo_weasel', 'tiger', 'goblin'] },
  { floor: 3, name: 'Tiger Lair B3F', theme: 'cave', recommendedLevel: 5, isBossFloor: true, bossId: 'tiger_girl', bossName: 'Tiger Girl (Unique Boss)', monsterTypes: ['gyo_weasel', 'tiger', 'white_tiger', 'bigeye_ghost'] },
  { floor: 4, name: 'Black Tiger Fortress B4F', theme: 'crypt', recommendedLevel: 9, isBossFloor: false, monsterTypes: ['bandit', 'bandit_archer', 'water_ghost', 'tombstone_ghost'] },
  { floor: 5, name: 'Bandit Stronghold B5F', theme: 'crypt', recommendedLevel: 13, isBossFloor: false, monsterTypes: ['bandit', 'bandit_archer', 'ghost_bug', 'yeoha'] },
  { floor: 6, name: 'Bandit Keep B6F', theme: 'crypt', recommendedLevel: 17, isBossFloor: true, bossId: 'bandit_lord', bossName: 'Black Tiger Bandit Leader (Unique Boss)', monsterTypes: ['bandit_archer', 'water_ghost', 'ghost_bug', 'yeoha'] },
  { floor: 7, name: 'Qin-Shi Tomb Ruins B7F', theme: 'ruins', recommendedLevel: 21, isBossFloor: false, monsterTypes: ['stone_ghost', 'earth_ghost', 'chakji', 'gunpowder_ghost'] },
  { floor: 8, name: 'Tomb of the Emperor B8F', theme: 'ruins', recommendedLevel: 25, isBossFloor: false, monsterTypes: ['stone_ghost', 'earth_ghost', 'chakji', 'tombstone_ghost'] },
  { floor: 9, name: 'Sanctum of the Tao B9F', theme: 'ruins', recommendedLevel: 28, isBossFloor: true, bossId: 'earth_king', bossName: 'Earth Taoist King (Unique Boss)', monsterTypes: ['chakji', 'stone_ghost', 'gunpowder_ghost', 'earth_ghost'] },
  { floor: 10, name: 'Taklamakan Wastes B10F', theme: 'lava', recommendedLevel: 32, isBossFloor: false, monsterTypes: ['white_tiger', 'blue_tiger', 'devil_bug', 'hyungno'] },
  { floor: 11, name: 'Blue Mountain Caverns B11F', theme: 'lava', recommendedLevel: 36, isBossFloor: false, monsterTypes: ['white_tiger', 'blue_tiger', 'devil_bug', 'hyungno'] },
  { floor: 12, name: 'Sovereign Pinnacle B12F', theme: 'lava', recommendedLevel: 40, isBossFloor: true, bossId: 'blue_tiger_boss', bossName: 'Blue Tiger Sovereign (Unique Boss)', monsterTypes: ['blue_tiger', 'devil_bug', 'hyungno', 'chakji'] },
  { floor: 13, name: 'Niwa Netherworld B13F', theme: 'boss', recommendedLevel: 44, isBossFloor: false, monsterTypes: ['hyungno', 'chakji', 'gunpowder_ghost', 'blue_tiger'] },
  { floor: 14, name: 'Temple of the Underworld B14F', theme: 'boss', recommendedLevel: 48, isBossFloor: false, monsterTypes: ['hyungno', 'chakji', 'gunpowder_ghost', 'stone_ghost'] },
  { floor: 15, name: 'Heart of Hyeongcheon B15F', theme: 'boss', recommendedLevel: 52, isBossFloor: true, bossId: 'hyeongcheon', bossName: 'Hyeongcheon the Immortal (Unique Boss)', monsterTypes: ['hyungno', 'gunpowder_ghost', 'blue_tiger', 'earth_ghost'] }
];

export const VILLAGE_NPCS = [
  {
    id: 'chief',
    npcId: 'chief',
    name: 'Elder Aldric',
    title: 'Village Chief',
    role: 'chief',
    actionType: 'quest',
    x: 0,
    z: -7.5,
    rotationY: 0,
    prompt: 'Talk to Elder Aldric (Quests & Lore) [E]',
    dialogue: [
      'Welcome to Oakhaven, traveler. Dark tremors beneath the old ruins have awakened the dungeon monsters.',
      'Speak with our merchants, hone your skills, and descend through the portal when you are ready.'
    ]
  },
  {
    id: 'blacksmith',
    npcId: 'blacksmith',
    shopId: 'blacksmith',
    name: 'Blacksmith Gorn',
    title: 'Weapons & Armor',
    role: 'blacksmith',
    actionType: 'shop',
    x: -9.5,
    z: -3.0,
    rotationY: Math.PI * 0.35,
    prompt: 'Trade with Blacksmith Gorn (Weapons & Armor) [E]',
    dialogue: [
      'Need cold steel for the dark below? My forge burns day and night.'
    ]
  },
  {
    id: 'merchant',
    npcId: 'merchant',
    shopId: 'merchant',
    name: 'Alchemist Elara',
    title: 'Potions & Scrolls',
    role: 'merchant',
    actionType: 'shop',
    x: 9.5,
    z: -3.0,
    rotationY: -Math.PI * 0.35,
    prompt: 'Trade with Alchemist Elara (Potions & Scrolls) [E]',
    dialogue: [
      'Never step into the dungeon without potions and a Return Scroll!'
    ]
  },
  {
    id: 'trainer',
    npcId: 'trainer',
    name: 'Battle Master Kael',
    title: 'Skill Master',
    role: 'skill_master',
    actionType: 'skills',
    x: -8.5,
    z: 5.5,
    rotationY: Math.PI * 0.65,
    prompt: 'Train with Battle Master Kael (Skill Tree [K / E])',
    dialogue: [
      'Strength alone will not save you in the deeper floors. Master both Battle and Passive arts!'
    ]
  },
  {
    id: 'composer',
    npcId: 'composer',
    shopId: 'composer',
    name: 'Crystal Sage Lyra',
    title: 'Composing Master',
    role: 'composer',
    actionType: 'compose',
    x: 8.5,
    z: 5.5,
    rotationY: -Math.PI * 0.65,
    prompt: 'Consult Crystal Sage Lyra (Composing Station [O / E])',
    dialogue: [
      'Every crystal holds dormant elemental power. Combine crystals or infuse your gear!'
    ]
  },
  {
    id: 'storage',
    npcId: 'storage',
    name: 'Quartermaster Bram',
    title: 'Storage & Supplies',
    role: 'storage',
    actionType: 'storage',
    x: -3.8,
    z: 8.5,
    rotationY: Math.PI,
    prompt: 'Speak with Quartermaster Bram (Inventory & Save) [E]',
    dialogue: [
      'Running out of room in your pack? Keep your spare gear safe and chronicle your progress.'
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
    this.puzzle = null;
    this.puzzleProps = [];
    this.specialRoomType = null;
    this._reserved = [];
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
        theme: def.theme,
        unlocked: def.floor <= maxUnlocked,
        recommendedLevel: custom?.recommendedLevel || def.recommendedLevel,
        isBossFloor: def.isBossFloor,
        bossName: custom?.bossName || def.bossName || null
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
    this.gridWidth = 26;
    this.gridHeight = 26;
    this.originX = -(this.gridWidth * this.tileSize) * 0.5;
    this.originZ = -(this.gridHeight * this.tileSize) * 0.5;

    this.grid = Array.from({ length: this.gridHeight }, (_, gz) =>
      Array.from({ length: this.gridWidth }, (__, gx) => {
        const isBorder = gx <= 1 || gz <= 1 || gx >= this.gridWidth - 2 || gz >= this.gridHeight - 2;
        return isBorder ? TILE.WALL : TILE.FLOOR;
      })
    );

    // Silk-Road caravan town (see villageBuilder.js)
    const vb = this._buildVillageScenery();
    this.villageBuild = vb;
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

    // Northern Dungeon Entrance Portal + Floor Selector Obelisk
    const dungeonPortalMesh = (this.models3d?.createPortalMesh || createPortalMesh)(0x38bdf8, 'dungeon');
    dungeonPortalMesh.position.set(0, 0, -16.5);
    this.rootGroup.add(dungeonPortalMesh);
    if (this.renderer?.addPointLight) {
      this.renderer.addPointLight(new THREE.Vector3(0, 1.8, -16.5), 0x38bdf8, 2.2, 12, true);
    }

    this.portals.push({
      id: 'dungeon_entrance',
      type: 'portal',
      portalType: 'dungeon_entrance',
      name: 'Abyssal Dungeon Gate',
      targetFloor: 1,
      x: 0,
      y: 0,
      z: -16.5,
      position: { x: 0, y: 0, z: -16.5 },
      prompt: 'Enter Dungeon / Select Floor [E]',
      mesh: dungeonPortalMesh
    });

    // Floor Selector Runestone Pillar right next to the portal
    const selectorMesh = (this.models3d?.createPortalMesh || createPortalMesh)(0xa855f7, 'selector');
    selectorMesh.position.set(3.2, 0, -15.2);
    this.rootGroup.add(selectorMesh);

    this.portals.push({
      id: 'floor_selector',
      type: 'portal',
      portalType: 'floor_selector',
      name: 'Waystone Floor Teleporter',
      x: 3.2,
      y: 0,
      z: -15.2,
      position: { x: 3.2, y: 0, z: -15.2 },
      prompt: 'Use Waystone Floor Selector [M / E]',
      mesh: selectorMesh
    });

    // Practice breakable barrels & crates near Skill Master Kyle
    const practiceProps = [
      { x: -13.0, z: 2.8, type: 'barrel' },
      { x: -14.0, z: 3.9, type: 'crate' },
      { x: -12.6, z: 5.4, type: 'barrel' },
      { x: 12.0, z: 0.5, type: 'urn' }
    ];
    practiceProps.forEach((p, idx) => {
      this._spawnBreakable(p.x, p.z, p.type, `village_prop_${idx}`);
    });

    // Starter Supply Chest in Village
    this._spawnChest(3.8, 7.6, 'normal', 'village_starter_chest');

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

    this.spawnPoint = { x: 0, y: 0, z: 4.2 };
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

    const floorDef = FLOOR_DEFINITIONS[(fNum - 1) % FLOOR_DEFINITIONS.length] || FLOOR_DEFINITIONS[0];
    const isBossFloor = fNum % 3 === 0 || Boolean(floorDef.isBossFloor);
    const themeKey = typeof themeOrScene === 'string' && DUNGEON_THEMES[themeOrScene]
      ? themeOrScene
      : floorDef.theme;

    this.theme = DUNGEON_THEMES[themeKey] || DUNGEON_THEMES.cave;
    this.zone = 'dungeon';
    this.currentFloor = fNum;
    this.floorName = fNum <= FLOOR_DEFINITIONS.length
      ? floorDef.name
      : `${this.theme.name} B${fNum}F`;

    if (fNum > this.unlockedMaxFloor) {
      this.unlockedMaxFloor = fNum;
    }

    if (this.renderer?.setEnvironmentTheme) {
      this.renderer.setEnvironmentTheme(isBossFloor ? 'boss' : this.theme.id);
    }

    const rand = seededRandom(fNum * 9973 + 1337);
    this.specialRoomType = SPECIAL_ROOM_CYCLE[(fNum - 1) % SPECIAL_ROOM_CYCLE.length];

    this.tileSize = 2.0;
    this.gridWidth = isBossFloor ? 44 : 48;
    this.gridHeight = isBossFloor ? 44 : 48;
    this.originX = -(this.gridWidth * this.tileSize) * 0.5;
    this.originZ = -(this.gridHeight * this.tileSize) * 0.5;

    this.grid = Array.from({ length: this.gridHeight }, () =>
      Array.from({ length: this.gridWidth }, () => TILE.WALL)
    );

    // Build deterministic connected room layout
    const generatedRooms = this._layoutDungeonRooms(fNum, isBossFloor, rand);

    // Carve rooms into grid
    for (const room of generatedRooms) {
      for (let gz = room.gz; gz < room.gz + room.gh; gz++) {
        for (let gx = room.gx; gx < room.gx + room.gw; gx++) {
          this.setTileAtGrid(gx, gz, TILE.FLOOR);
        }
      }
    }

    // Carve 3-tile-wide corridors connecting rooms in sequence + extra loop
    for (let i = 0; i < generatedRooms.length - 1; i++) {
      this._carveCorridor(generatedRooms[i], generatedRooms[i + 1]);
    }
    if (generatedRooms.length >= 5) {
      this._carveCorridor(generatedRooms[1], generatedRooms[3]);
    }

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
        special: r.type === 'treasure' ? 'vault' : (r.type === 'trap' ? 'trap_gallery' : r.type === 'processional' ? 'processional' : r.type === 'shrine' ? 'shrine' : null),
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
        cleared: idx === 0
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

  _layoutDungeonRooms(floorNum, isBossFloor, rand) {
    // Structured 3x3 sector layout guarantees non-overlapping, rich multi-room dungeons
    const special = SPECIAL_ROOM_CYCLE[(floorNum - 1) % SPECIAL_ROOM_CYCLE.length];
    const sectors = [
      { sx: 0, sz: 2, defaultType: 'start' },
      { sx: 1, sz: 2, defaultType: 'combat' },
      { sx: 2, sz: 2, defaultType: 'treasure' },
      { sx: 2, sz: 1, defaultType: special === 'trap_gallery' ? 'trap' : 'combat' },
      { sx: 1, sz: 1, defaultType: special === 'processional' ? 'processional' : 'combat' },
      { sx: 0, sz: 1, defaultType: special === 'shrine' ? 'shrine' : 'combat' },
      { sx: 0, sz: 0, defaultType: 'combat' },
      { sx: 1, sz: 0, defaultType: isBossFloor ? 'boss' : 'exit' }
    ];

    const cellW = Math.floor((this.gridWidth - 6) / 3);
    const cellH = Math.floor((this.gridHeight - 6) / 3);
    const rooms = [];

    sectors.forEach((sec, idx) => {
      const isBossRoom = sec.defaultType === 'boss';
      const isHall = sec.defaultType === 'processional';
      const isGallery = sec.defaultType === 'trap';
      const rw = isBossRoom ? Math.min(cellW + 4, 14)
        : isHall ? Math.min(cellW - 1, 13)
        : isGallery ? 9
        : Math.max(7, Math.floor(7 + rand() * 3));
      const rh = isBossRoom ? Math.min(cellH + 4, 14)
        : isHall ? 9
        : isGallery ? 9
        : Math.max(7, Math.floor(7 + rand() * 3));

      const baseGx = 3 + sec.sx * cellW;
      const baseGz = 3 + sec.sz * cellH;
      const offsetX = isBossRoom ? 0 : Math.floor(rand() * Math.max(1, cellW - rw - 1));
      const offsetZ = isBossRoom ? 0 : Math.floor(rand() * Math.max(1, cellH - rh - 1));

      const gx = Math.min(this.gridWidth - rw - 3, Math.max(3, baseGx + offsetX));
      const gz = Math.min(this.gridHeight - rh - 3, Math.max(3, baseGz + offsetZ));

      rooms.push({
        id: idx,
        type: sec.defaultType,
        gx,
        gz,
        gw: rw,
        gh: rh,
        cx: Math.floor(gx + rw * 0.5),
        cz: Math.floor(gz + rh * 0.5)
      });
    });

    return rooms;
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

    const hasAdjacentWalkable = (gx, gz) => {
      for (let dz = -1; dz <= 1; dz++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dz === 0) continue;
          const t = this.getTileAtGrid(gx + dx, gz + dz);
          if (t === TILE.FLOOR || t === TILE.CORRIDOR || t === TILE.DOOR_OPEN || t === TILE.DOOR_CLOSED) {
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
        } else if (t === TILE.WALL && hasAdjacentWalkable(gx, gz)) {
          wallTiles.push({ gx, gz });
        }
      }
    }
    this._wallTiles = wallTiles;
    this._batch = new InstanceBatch();

    // Low, moody fill: the renderer's atmosphere carries most of the light; torches/braziers are
    // emissive meshes and the 8-light pool (see _updateLightBudget) adds warm local light.
    const atm = this.theme.atmosphere || {};
    const dungeonAmbient = new THREE.AmbientLight(atm.ambientColor ?? this.theme.ambientColor ?? 0xffffff, 0.32);
    const dungeonHemi = new THREE.HemisphereLight(0xb8c0d8, this.theme.floorColor, 0.38);
    dungeonHemi.position.set(0, 18, 0);
    this.rootGroup.add(dungeonAmbient, dungeonHemi);

    // Instanced floor tiles (white base material so instanceColor is not darkened by multiplication)
    const floorGeo = new THREE.BoxGeometry(this.tileSize, 0.16, this.tileSize);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: new THREE.Color(this.theme.floorColor),
      emissiveIntensity: 0.22,
      roughness: 0.74,
      metalness: 0.05
    });
    const floorInst = new THREE.InstancedMesh(floorGeo, floorMat, Math.max(1, floorTiles.length));
    floorInst.receiveShadow = true;

    const dummy = new THREE.Object3D();
    const color = new THREE.Color();
    const baseFloorCol = new THREE.Color(this.theme.floorColor);
    const altFloorCol = new THREE.Color(this.theme.altFloorColor || this.theme.floorColor);

    floorTiles.forEach((tile, i) => {
      const pos = this.gridToWorld(tile.gx, tile.gz);
      dummy.position.set(pos.x, -0.08 + (rand() - 0.5) * 0.03, pos.z);
      dummy.scale.set(0.985, 1, 0.985);
      dummy.updateMatrix();
      floorInst.setMatrixAt(i, dummy.matrix);

      const checker = (tile.gx + tile.gz) % 2 === 0;
      color.copy(checker ? baseFloorCol : altFloorCol);
      color.multiplyScalar(0.86 + rand() * 0.26);
      if (rand() < 0.07) color.multiplyScalar(0.78); // cracked / soot-stained slab
      if (tile.t === TILE.CORRIDOR) color.multiplyScalar(0.92);
      floorInst.setColorAt(i, color);
    });
    floorInst.instanceMatrix.needsUpdate = true;
    if (floorInst.instanceColor) floorInst.instanceColor.needsUpdate = true;
    this.rootGroup.add(floorInst);

    // Instanced perimeter wall blocks
    const wallHeight = 2.7;
    const wallGeo = new THREE.BoxGeometry(this.tileSize, wallHeight, this.tileSize);
    const wallMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: new THREE.Color(this.theme.wallColor),
      emissiveIntensity: 0.18,
      roughness: 0.7,
      metalness: 0.06
    });
    const wallInst = new THREE.InstancedMesh(wallGeo, wallMat, Math.max(1, wallTiles.length));
    wallInst.castShadow = true;
    wallInst.receiveShadow = true;

    const baseWallCol = new THREE.Color(this.theme.wallColor);
    wallTiles.forEach((tile, i) => {
      const pos = this.gridToWorld(tile.gx, tile.gz);
      const hScale = 0.94 + (rand() * 0.14);
      dummy.position.set(pos.x, (wallHeight * hScale) * 0.5, pos.z);
      dummy.scale.set(1, hScale, 1);
      dummy.updateMatrix();
      wallInst.setMatrixAt(i, dummy.matrix);

      color.copy(baseWallCol).multiplyScalar(0.9 + rand() * 0.2);
      wallInst.setColorAt(i, color);
    });
    wallInst.instanceMatrix.needsUpdate = true;
    if (wallInst.instanceColor) wallInst.instanceColor.needsUpdate = true;
    this.rootGroup.add(wallInst);
  }

  /** True when a prop of `radius` can be dropped at (x, z) without clipping other solids/traps/doorways. */
  _spotFree(x, z, radius = 0.5) {
    if (nearOpening(this, x, z, 1)) return false;
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
    const returnPortalMesh = (this.models3d?.createPortalMesh || createPortalMesh)(0x38bdf8, 'village');
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
      // Corner torches: emissive instances, lit by the pooled lights
      const torchOffsets = [
        [room.x + 1.8, room.z + 1.8],
        [room.x + room.w - 1.8, room.z + 1.8],
        [room.x + 1.8, room.z + room.h - 1.8],
        [room.x + room.w - 1.8, room.z + room.h - 1.8]
      ];
      torchOffsets.forEach(([tx, tz]) => {
        this._spawnTorch(tx, tz, this.theme.torchColor);
      });

      if (room.type === 'start') {
        this._spawnBreakable(room.centerX + 2.8, room.centerZ - 2.0, 'barrel', `f${floorNum}_b_start1`);
        this._spawnBreakable(room.centerX + 3.5, room.centerZ - 1.2, 'crate', `f${floorNum}_b_start2`);
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
        this._spawnShrine(room.centerX, room.centerZ, floorNum);
        dressSpecialRoom(this, batch, room, 'shrine', rand);
      } else if (room.type === 'processional') {
        dressSpecialRoom(this, batch, room, 'processional', rand);
        this._spawnChest(room.x + room.w - 2.4, room.centerZ, 'rare', `f${floorNum}_chest_hall`);
      } else if (room.type === 'exit') {
        const stairsMesh = (this.models3d?.createStairsMesh || createStairsMesh)('down');
        stairsMesh.position.set(room.centerX, 0, room.centerZ - 2.2);
        this.rootGroup.add(stairsMesh);

        const nextPortalMesh = (this.models3d?.createPortalMesh || createPortalMesh)(this.theme.portalColor, 'next_floor');
        nextPortalMesh.position.set(room.centerX, 0, room.centerZ);
        this.rootGroup.add(nextPortalMesh);

        // portal glow joins the pooled light budget instead of owning a light
        this._lightSources.push({ x: room.centerX, y: 1.8, z: room.centerZ, color: this.theme.portalColor, intensity: 2.2, distance: 11 });

        this.portals.push({
          id: `next_floor_f${floorNum}`,
          type: 'portal',
          portalType: 'next_floor',
          name: `Stairs to Floor ${floorNum + 1}`,
          targetFloor: floorNum + 1,
          x: room.centerX,
          y: 0,
          z: room.centerZ,
          position: { x: room.centerX, y: 0, z: room.centerZ },
          prompt: `Descend to Floor ${floorNum + 1} [E]`,
          mesh: nextPortalMesh
        });

        this._spawnChest(room.centerX + 3.0, room.centerZ - 2.0, 'magic', `f${floorNum}_chest_exit`);
      } else if (room.type === 'boss') {
        this._decorateBossArena(room, floorNum);
      }

      // Scatter breakables (skipped where they would clog a puzzle, vault, trap lane or doorway)
      if (room.type !== 'start' && room.type !== 'trap') {
        const count = 2 + Math.floor(rand() * 3);
        const breakTypes = this.theme.breakableTypes || ['barrel', 'crate', 'urn'];
        for (let b = 0; b < count; b++) {
          const bx = room.centerX + (rand() - 0.5) * (room.w - 4.2);
          const bz = room.centerZ + (rand() - 0.5) * (room.h - 4.2);
          if (Math.hypot(bx - room.centerX, bz - room.centerZ) < 2.2) continue;
          if (!this._spotFree(bx, bz, 0.5)) continue;
          const bType = breakTypes[Math.floor(rand() * breakTypes.length)];
          this._spawnBreakable(bx, bz, bType, `f${floorNum}_r${idx}_b${b}`);
        }
      }
    });

    void st;
    this._decorMeshCount = batch.flush(this.rootGroup);
    this._createLightPool();
  }

  _buildTrapGallery(room, floorNum, rand) {
    // Rows of traps with one winding safe column per row; chest waits at the end of the path.
    const trapTypes = this.theme.trapTypes || ['spikes'];
    const colX = [-4.4, -2.2, 0, 2.2, 4.4];
    const safe = [2, 1, 2, 3];
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
    room.safeLaneX = room.centerX;
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
      const slots = [at(1.8, 1.8), at(1.8, 3.8), at(1.8, 5.8)];
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
      this._reserved.push({ x: at(3.0, 3.6).x, z: at(3.0, 3.6).z, r: 4.6 });
    } else {
      // three guardians face the altar from three sides; each interaction turns one by 90 degrees
      const altarPos = at(4.6, 4.6);
      const dirs = [
        { x: altarPos.x + corner.sx * 2.6, z: altarPos.z, face: [-corner.sx, 0] },
        { x: altarPos.x, z: altarPos.z + corner.sz * 2.6, face: [0, -corner.sz] },
        { x: altarPos.x - corner.sx * 2.6, z: altarPos.z, face: [corner.sx, 0] }
      ];
      this.puzzle = { type: 'statues', solved: false, gateId, statues: [] };
      addProp('altar', buildAltarMesh(), altarPos, 'Guardian Altar', 'Altar of Guardians', 0.7);
      dirs.forEach((d, i) => {
        const target = ((Math.round(Math.atan2(d.face[0], d.face[1]) / (Math.PI / 2)) % 4) + 4) % 4;
        let rot = Math.floor(rand() * 4);
        if (i === 0 && rot === target) rot = (target + 1 + Math.floor(rand() * 3)) % 4;
        const mesh = buildPuzzleStatueMesh(st.stone);
        mesh.rotation.y = rot * (Math.PI / 2);
        const p = addProp('puzzle_statue', mesh, d, 'Guardian Statue', 'Turn Statue [E]', 0.5, { rot, target });
        this.puzzle.statues.push(p);
      });
      addProp('stele', buildSteleMesh(st.stone), at(1.4, 1.4), 'Ancient Stele', 'Read Stele [E]', 0.6, {
        text: 'The stele reads: Let every guardian turn its gaze upon the altar flame.'
      });
      this._reserved.push({ x: altarPos.x, z: altarPos.z, r: 5.2 });
    }
  }

  _solvePuzzle(ctx) {
    const pz = this.puzzle;
    if (!pz || pz.solved) return;
    pz.solved = true;
    this.setGateOpen(pz.gateId, true);
    const msg = 'A deep grinding echoes... the vault gate opens!';
    ctx?.hud?.showToast?.(msg, 'info');
    ctx?.hud?.toast?.(msg, 'info');
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
    ctx?.hud?.toast?.(msg, 'info');
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
      slot.light.intensity = Math.max(0, src.intensity * 1.45 * (1 + wave) * slot.level);
    }
  }

  _decorateBossArena(bossRoom, floorNum) {
    // Pillar ring, braziers and dais (instanced) + arena metadata for the coordinator
    this.bossArena = decorateBossArenaProps(this, this._batch, bossRoom, seededRandom(floorNum * 31 + 7));

    // Boss Victory Chest & Next Floor Portal at the north end of the Boss Arena
    // Rift pavilion on the north axis between the diagonal braziers; chest beside it on the dais
    const chestPos = { x: bossRoom.centerX - 3.0, z: bossRoom.centerZ - 2.6 };
    const bossChest = this._spawnChest(chestPos.x, chestPos.z, 'boss', `f${floorNum}_boss_chest`);
    bossChest.lockedByBoss = true;

    const nextPortalMesh = (this.models3d?.createPortalMesh || createPortalMesh)(0xef4444, 'boss_exit');
    const portalPos = { x: bossRoom.centerX, y: 0, z: bossRoom.centerZ - 4.9 };
    nextPortalMesh.position.set(portalPos.x, 0, portalPos.z);
    nextPortalMesh.userData.setLocked?.(true);
    this.rootGroup.add(nextPortalMesh);

    this.portals.push({
      id: `boss_exit_f${floorNum}`,
      type: 'portal',
      portalType: 'next_floor',
      name: `Abyssal Rift to Floor ${floorNum + 1}`,
      targetFloor: floorNum + 1,
      lockedByBoss: true,
      x: portalPos.x,
      y: 0,
      z: portalPos.z,
      position: portalPos,
      prompt: `Enter Rift to Floor ${floorNum + 1} [E]`,
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
        portal.mesh?.userData?.setLocked?.(false);
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
    const breakableId = id || `breakable_${this.breakables.length + 1}`;
    const mesh = (this.models3d?.createBreakableMesh || createBreakableMesh)(kind);
    mesh.position.set(x, 0, z);
    this.rootGroup.add(mesh);

    const maxHp = kind === 'crystal' ? 35 : 20;
    const obj = {
      id: breakableId,
      type: 'breakable',
      kind,
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

  _spawnGate(x, z, gateId, isOpen = false) {
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

    // Silkroad portal arch frame
    if (typeof window !== 'undefined') {
      loadSROProp('/assets/sro/props/cj_portal.glb', {
        parent: group,
        position: [0, 0, 0],
        targetHeight: 5.0,
        autoGround: true,
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

  _spawnShrine(x, z, floorNum) {
    const group = new THREE.Group();
    group.position.set(x, 0, z);

    const stoneMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.6 });
    const gemMat = new THREE.MeshStandardMaterial({
      color: 0x4ade80,
      emissive: new THREE.Color(0x22c55e),
      emissiveIntensity: 0.85,
      roughness: 0.2
    });

    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.85, 0.9, 12), stoneMat);
    base.position.y = 0.45;
    const orb = new THREE.Mesh(new THREE.OctahedronGeometry(0.32, 0), gemMat);
    orb.position.y = 1.35;
    group.add(base, orb);
    group.userData.orb = orb;

    this.rootGroup.add(group);
    this.solidObstacles.push({ x, z, radius: 0.65 });

    this.shrines.push({
      id: `shrine_f${floorNum}`,
      type: 'shrine',
      name: 'Sanctuary Blessing Shrine',
      x,
      y: 0,
      z,
      position: { x, y: 0, z },
      used: false,
      reusable: false,
      prompt: 'Touch Blessing Shrine (Restore HP/MP & Buff) [E]',
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
      if (!chest.isOpen) {
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

    for (const portal of this.portals) {
      const prompt = portal.lockedByBoss
        ? 'Sealed Rift (Defeat the Floor Boss first!)'
        : portal.prompt;
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

    if (type === 'chest') {
      return this.openChest(entity, ctx);
    }

    if (type === 'switch') {
      entity.isActive = true;
      entity.mesh?.userData?.setActive?.(true);
      this.setGateOpen(entity.targetGateId, true);
      if (this.puzzle && this.puzzle.gateId === entity.targetGateId) this.puzzle.solved = true;
      ctx.hud?.showToast?.('Ancient Gate Unlocked!', 'info');
      ctx.hud?.toast?.('Ancient Gate Unlocked!', 'info');
      return { ok: true, type: 'switch', gateId: entity.targetGateId, message: 'Ancient Gate Unlocked!' };
    }

    if (type === 'shrine') {
      if (entity.used && !entity.reusable) {
        return { ok: false, reason: 'Shrine blessing already claimed.' };
      }
      entity.used = true;
      if (ctx.gameState?.heal) {
        ctx.gameState.heal(9999, 9999);
      } else if (ctx.gameState?.hero) {
        const stats = ctx.gameState.getStats ? ctx.gameState.getStats() : {};
        ctx.gameState.hero.hp = stats.maxHp || ctx.gameState.hero.maxHp || 100;
        ctx.gameState.hero.mp = stats.maxMp || ctx.gameState.hero.maxMp || 100;
      }
      ctx.hud?.showToast?.(`${entity.name}: Full HP & Mana Restored!`, 'heal');
      ctx.hud?.toast?.(`${entity.name}: Full HP & Mana Restored!`, 'info');
      return { ok: true, type: 'shrine', entity };
    }

    if (type === 'bell') return this._ringBell(entity, ctx);
    if (type === 'puzzle_statue') return this._turnStatue(entity, ctx);
    if (type === 'stele') {
      ctx.hud?.showToast?.(entity.text, 'info');
      ctx.hud?.toast?.(entity.text, 'info');
      return { ok: true, type: 'stele', text: entity.text };
    }

    if (type === 'loot') {
      return this.pickupLoot(entity, ctx);
    }

    if (type === 'portal') {
      if (entity.lockedByBoss) {
        const sealedMsg = 'Defeat the Floor Boss to unseal this portal!';
        if (ctx.hud?.showToast) ctx.hud.showToast(sealedMsg, 'warning');
        else ctx.hud?.toast?.(sealedMsg, 'info');
        return { ok: false, reason: 'Locked by Boss' };
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

    if (!chest || chest.isOpen) return { ok: false, opened: false, drops: [], gold: 0 };
    if (chest.lockedByBoss) {
      ctx.hud?.showToast?.('The Boss Chest is sealed until the Floor Boss falls!', 'warning');
      ctx.hud?.toast?.('The Boss Chest is sealed until the Floor Boss falls!', 'info');
      return { ok: false, opened: false, locked: true, drops: [], gold: 0 };
    }

    chest.isOpen = true;
    chest.mesh?.userData?.setOpen?.(true);

    const floorLevel = Math.max(1, this.currentFloor || 1);
    const tierMult = chest.tier === 'boss' ? 4 : chest.tier === 'epic' ? 3 : chest.tier === 'rare' ? 2 : 1.3;
    const goldAmount = Math.round((25 + floorLevel * 18) * tierMult);

    const drops = [];
    // Spawn gold pile
    this.spawnGroundLoot(
      { x: chest.x + (Math.random() - 0.5) * 1.4, z: chest.z + 0.9 },
      { type: 'gold', name: `${goldAmount} Gold`, amount: goldAmount, rarity: 'normal' }
    );

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

    if (this.renderer?.spawnHitSparks) {
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

  spawnGroundLoot(posOrX, itemOrZ, maybeItem = null, startOrigin = null) {
    let x = 0;
    let z = 0;
    let item = itemOrZ;
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
    const startX = startOrigin ? Number(startOrigin.x ?? x) : x;
    const startZ = startOrigin ? Number(startOrigin.z ?? z) : z;
    mesh.position.set(startX, 0.25, startZ);
    this.rootGroup.add(mesh);

    const sealKey = item?.seal;
    if (sealKey && RARITY_BEAMS[sealKey]) {
      this._attachRarityBeam(mesh, RARITY_BEAMS[sealKey]);
    }

    const lootEntry = {
      id: `ground_loot_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      type: 'loot',
      isGold,
      goldAmount,
      item: isGold ? null : item,
      name: isGold ? `${goldAmount} Gold` : (item.name || 'Equipment'),
      rarity,
      collected: false,
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

    loot.collected = true;
    if (loot.mesh) {
      loot.mesh.visible = false;
      this.rootGroup.remove(loot.mesh);
    }

    if (loot.isGold) {
      if (ctx.gameState?.addGold) {
        ctx.gameState.addGold(loot.goldAmount);
      } else if (ctx.gameState?.hero) {
        ctx.gameState.hero.gold = (ctx.gameState.hero.gold || 0) + loot.goldAmount;
      }
      return { ok: true, isGold: true, amount: loot.goldAmount, name: loot.name };
    }

    if (loot.item) {
      if (ctx.inventory?.addItem) {
        ctx.inventory.addItem(loot.item);
      } else if (ctx.gameState?.inventory?.addItem) {
        ctx.gameState.inventory.addItem(loot.item);
      }
      if (ctx.quests?.onCollect) {
        ctx.quests.onCollect(loot.item.baseId || loot.item.id, 1);
      } else if (ctx.quests?.onItemCollected) {
        ctx.quests.onItemCollected(loot.item.baseId || loot.item.id);
      }
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
            type: e.isBoss ? 'boss' : 'enemy',
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
      subtitle: this.theme?.subtitle || '',
      theme: this.theme?.id || 'cave',
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
      atmosphere: this.zone === 'dungeon' && this.theme?.atmosphere ? { ...this.theme.atmosphere } : null,
      puzzle: this.puzzle,
      specialRoom: this.zone === 'dungeon' ? this.specialRoomType : null,
      puzzleProps: this.puzzleProps
    };
  }
}

export function createDungeonGenerator(options, models3d, data) {
  return new DungeonGenerator(options, models3d, data);
}

export default DungeonGenerator;

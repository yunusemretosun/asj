import * as THREE from 'three';
import {
  models3d as defaultModels3d,
  createMonsterMesh,
  createBossMesh
} from '../engine/models3d.js';
// rpg-systems: floor -> monster level mapping (see floorMonsterLevel docs in inventory.js)
import { floorMonsterLevel } from '../systems/inventory.js';

export const AI_STATE = {
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
  slime: {
    type: 'slime',
    name: 'Cavern Slime',
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
    name: 'Goblin Raider',
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
    name: 'Dusk Vampire Bat',
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
    name: 'Dire Shadow Wolf',
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
    name: 'Venomfang Spider',
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
    name: 'Restless Skeleton',
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
    name: 'Abyssal Cultist Mage',
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
    name: 'Orc Vanguard',
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
    name: 'Runestone Golem',
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
    meshType: 'skeleton',
    name: 'Cursed Mummy',
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
    meshType: 'skeleton',
    name: 'Plague Zombie',
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
    meshType: 'orc',
    name: 'Scaleblade Lizardman',
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
    meshType: 'mage',
    name: 'Phantom Wraith',
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
    meshType: 'bat',
    name: 'Obsidian Gargoyle',
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
    meshType: 'golem',
    name: 'Ancient Stone Golem',
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
    meshType: 'wolf',
    name: 'Infernal Hell Hound',
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
    meshType: 'mage',
    name: 'Archon Chaos Wizard',
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
    meshType: 'orc',
    name: 'Abyssal Dark Knight',
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
    meshType: 'orc',
    name: 'Hellfire Demon',
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
    id: 'kimura',
    type: 'spider',
    name: 'Kimura, Queen of the Cavern',
    title: 'SWF Boss (__Packages.Kimura)',
    hpMult: 5.5,
    atkMult: 1.85,
    defMult: 1.6,
    scale: 1.68,
    color: 0x15803d,
    element: 'poison',
    summonType: 'spider',
    skills: ['shockwave', 'charge', 'summon']
  },
  6: {
    id: 'celestine',
    type: 'mage',
    name: 'Celestine the Frost Empress',
    title: 'SWF Boss (__Packages.Celestine)',
    hpMult: 6.2,
    atkMult: 2.0,
    defMult: 1.65,
    scale: 1.62,
    color: 0x38bdf8,
    element: 'ice',
    summonType: 'skeleton',
    skills: ['nova', 'summon', 'shockwave']
  },
  9: {
    id: 'onim',
    type: 'golem',
    name: 'Onim the Thunder Warlord',
    title: 'SWF Boss (__Packages.Onim)',
    hpMult: 7.0,
    atkMult: 2.15,
    defMult: 2.1,
    scale: 1.8,
    color: 0xfacc15,
    element: 'lightning',
    summonType: 'orc',
    skills: ['shockwave', 'charge', 'nova']
  },
  12: {
    id: 'chaos',
    type: 'orc',
    name: 'Chaos, Harbinger of the Void',
    title: 'SWF Boss (__Packages.Chaos)',
    hpMult: 7.8,
    atkMult: 2.3,
    defMult: 2.0,
    scale: 1.85,
    color: 0x9333ea,
    element: 'dark',
    summonType: 'wraith',
    skills: ['shockwave', 'nova', 'charge', 'summon']
  },
  15: {
    id: 'devil',
    type: 'boss',
    name: 'The Abyssal Devil',
    title: 'Final Boss (__Packages.Devil)',
    hpMult: 9.0,
    atkMult: 2.5,
    defMult: 2.25,
    scale: 2.0,
    color: 0xdc2626,
    element: 'fire',
    summonType: 'demon',
    skills: ['shockwave', 'charge', 'nova', 'summon']
  }
};

function attachHealthBarAndTelegraph(enemy) {
  const root = enemy.mesh;
  if (!root) return;

  // Floating 3D health bar above monster
  const barGroup = new THREE.Group();
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

    this.state = AI_STATE.IDLE;
    this.stateTimer = 0.5 + Math.random() * 1.2;
    this.attackCooldown = Math.random() * 0.6;
    this.skillCooldown = 4.5 + Math.random() * 2.5;
    this.stunTimer = 0;
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

      for (let i = 0; i < count; i++) {
        const mType = pool[(idx + i) % pool.length];
        const angle = (i / count) * Math.PI * 2 + idx * 0.5;
        const dist = 1.6 + (i % 2) * 1.4;
        const mx = room.centerX + Math.cos(angle) * dist;
        const mz = room.centerZ + Math.sin(angle) * dist;

        const isElite = (room.type === 'exit' && i === 0) || (room.type === 'treasure' && i === 0) || (i === count - 1 && Math.random() < 0.28);
        this.spawnMonster({
          type: mType,
          floor: fNum,
          x: mx,
          z: mz,
          isElite
        });
      }
    });

    return this.enemies;
  }

  _getMonsterPoolForFloor(floorNum) {
    if (floorNum <= 3) return ['slime', 'goblin', 'bat', 'wolf'];
    if (floorNum <= 6) return ['skeleton', 'spider', 'bat', 'mage'];
    if (floorNum <= 9) return ['orc', 'wolf', 'mage', 'golem'];
    if (floorNum <= 12) return ['orc', 'golem', 'mage', 'skeleton'];
    return ['orc', 'golem', 'mage', 'skeleton'];
  }

  spawnMonster({ type = 'goblin', floor = 1, x = 0, z = 0, isElite = false, isBoss = false, customConfig = null }) {
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

    const mesh = meshBuilder(base.meshType || type, {
      isElite,
      isBoss,
      color,
      scale,
      tier: Math.ceil(level / 3),
      name
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

    const dmg = Math.max(1, Math.round(Number(amount) || 1));
    enemy.hp = Math.max(0, enemy.hp - dmg);
    enemy.mesh?.userData?.triggerHitFlash?.(0.15);

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

    // Light hit-stun on regular monsters if not mid-boss-skill
    if (enemy.hp > 0 && !enemy.isBoss && enemy.state !== AI_STATE.TELEGRAPH) {
      enemy.state = AI_STATE.STUN;
      enemy.stunTimer = 0.16;
    }

    enemy.syncHealthBar(this.renderer?.camera);

    if (enemy.hp <= 0) {
      this._handleEnemyDeath(enemy, options);
      return { hit: true, killed: true, damage: dmg, enemy };
    }

    return { hit: true, killed: false, damage: dmg, enemy };
  }

  damageEnemy(enemy, amount, isCrit = false, knockbackDir = null, element = 'physical', callbacks = null) {
    return this.applyDamageToEnemy(enemy, amount, {
      isCrit,
      knockbackDir,
      element,
      knockback: isCrit ? 0.95 : 0.5,
      callbacks
    });
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

      e.attackCooldown = Math.max(0, e.attackCooldown - dt);
      e.skillCooldown = Math.max(0, e.skillCooldown - dt);

      const dx = px - e.x;
      const dz = pz - e.z;
      const distToPlayer = Math.hypot(dx, dz);

      if (e.state === AI_STATE.STUN) {
        e.stunTimer -= dt;
        e.mesh?.userData?.animate?.('hit', time, dt);
        if (e.stunTimer <= 0) {
          e.state = AI_STATE.CHASE;
        }
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
      }

      switch (e.state) {
        case AI_STATE.IDLE: {
          e.stateTimer -= dt;
          e.mesh?.userData?.animate?.('idle', time, dt);
          if (distToPlayer <= e.aggroRange) {
            e.state = AI_STATE.CHASE;
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
            e.state = AI_STATE.CHASE;
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
      e.syncHealthBar(this.renderer?.camera);
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
    const moveX = (vx / vLen) * speed * dt;
    const moveZ = (vz / vLen) * speed * dt;

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
        for (const offset of [-2.2, 2.2]) {
          const sx = boss.x + offset;
          const sz = boss.z + 1.5;
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
  }
}

export function createEnemyManager(options, models3d, data) {
  return new EnemyManager(options, models3d, data);
}

export default EnemyManager;

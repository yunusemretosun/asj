import './ui/styles.css';
import extractedData from './data/extracted_data.json';
import { createRenderer } from './engine/renderer.js';
import { models3d } from './engine/models3d.js';
import { PlayerController } from './engine/playerController.js';
import { PetController } from './engine/petController.js';
import { createGame } from './systems/gameState.js';
import { createDungeonGenerator, CHALLENGE_TYPES, MIN_DUNGEON_LEVEL } from './world/dungeonGenerator.js';
import { createEnemyManager } from './world/enemyAI.js';
import { createHUD } from './ui/hud.js';
import { createMenus } from './ui/menus.js';
import { openCharacterCreation } from './ui/characterCreation.js';
import { createHeroPreview } from './engine/heroPreview.js';

async function bootstrap() {
  const canvasContainer = document.getElementById('canvas-container') || document.body;
  const hudContainer = document.getElementById('hud-root') || document.body;
  const menuContainer = document.getElementById('menu-root') || document.body;

  // 1. Initialize 3D Renderer & Scene
  const renderer = createRenderer(canvasContainer);

  // 2. Initialize Core RPG GameState (attaches inventory, skills, quests)
  // Saves are loaded (or a new classed hero is created) from the title screen below.
  const gameState = createGame({ data: extractedData });

  // Shared gameContext object passed across Engine, World, Systems, and UI
  const gameContext = {
    data: extractedData,
    extractedData,
    renderer,
    scene: renderer.scene,
    models3d,
    gameState,
    game: gameState,
    get inventory() { return gameState.inventory; },
    get skills() { return gameState.skills; },
    get quests() { return gameState.quests; },
    dungeon: null,
    world: null,
    enemyManager: null,
    enemies: null,
    player: null,
    hud: null,
    menus: null,
    challenge: null,
    enterChallenge: null,
    exitChallenge: null,
    sound: null,
    enterFloor: null,
    returnToVillage: null
  };

  // 3. Initialize 3D World & Multi-Floor Dungeon Generator
  const dungeon = createDungeonGenerator(gameContext, models3d, extractedData);
  gameContext.dungeon = dungeon;
  gameContext.world = dungeon;

  // 4. Initialize 3D Enemy AI & Boss Manager
  const enemyManager = createEnemyManager(gameContext, models3d, extractedData);
  gameContext.enemyManager = enemyManager;
  gameContext.enemies = enemyManager;

  // 5. Initialize Player Combat & Movement Controller
  const player = new PlayerController({
    renderer,
    gameState,
    world: dungeon,
    enemyManager,
    onInteract: () => handlePlayerInteract(),
    onToast: (msg, type) => gameContext.hud?.toast?.(msg, type)
  });
  gameContext.player = player;
  gameContext.sound = player.sound;

  // 5b. Initialize 3D Companion Pet Controller
  const petController = new PetController({
    renderer,
    playerController: player,
    dungeon,
    enemyManager,
    gameState,
    sound: player.sound
  });
  gameContext.pet = petController;
  gameContext.pets = gameState.pets;

  // 6. Zone & Floor Transition Functions
  let activeChallenge = null;
  let challengeDeathTimer = null;
  let _reviveTimeout = null;

  function returnToVillage() {
    clearTimeout(challengeDeathTimer);
    clearTimeout(_reviveTimeout);
    _reviveTimeout = null;
    activeChallenge = null;
    gameContext.challenge = null;
    if (enemyManager?.clearEnemies) {
      enemyManager.clearEnemies();
    }
    const hubData = dungeon.loadVillageHub(renderer, models3d);
    renderer.setEnvironmentTheme('village');
    renderer.applyAtmosphere?.(hubData.atmosphere || null);
    renderer.brightenWorldMaterials?.(dungeon.rootGroup || renderer.scene);
    player.resetPosition(hubData.spawnPoint || { x: 0, y: 0, z: 4.2 });
    petController.resetPosition(hubData.spawnPoint || { x: 0, y: 0, z: 4.2 });
    if (enemyManager?.spawnFloorEnemies) {
      enemyManager.spawnFloorEnemies(hubData, 0, renderer.scene, models3d, extractedData);
    }
    if (gameState.fullRestore) {
      gameState.fullRestore();
    }
    if (gameState.enterFloor) {
      gameState.enterFloor(0);
    }
    gameContext.hud?.showZone?.(hubData.name || 'Oakhaven Village', 0);
    gameContext.menus?.closeAll?.();
  }

  function enterFloor(floorNum = 1) {
    clearTimeout(challengeDeathTimer);
    activeChallenge = null;
    gameContext.challenge = null;
    const targetFloor = Number(floorNum) || 0;
    if (targetFloor <= 0) {
      returnToVillage();
      return true;
    }

    const heroLv = Number(gameState?.hero?.level || 1);
    if (heroLv < MIN_DUNGEON_LEVEL) {
      const gateMsg = `Zindanlar Level ${MIN_DUNGEON_LEVEL} gerektirir! Oakhaven çevresindeki 4 açık kapıdan dışarıdaki kamplarda kasıl (Lv ${heroLv}/${MIN_DUNGEON_LEVEL}).`;
      gameContext.hud?.toast?.(gateMsg, 'warn');
      return false;
    }

    if (enemyManager?.clearEnemies) {
      enemyManager.clearEnemies();
    }

    const floorData = dungeon.generateFloor(targetFloor, renderer, models3d, extractedData);
    renderer.setEnvironmentTheme(floorData.theme || 'cave');
    renderer.applyAtmosphere?.(floorData.atmosphere || null);
    renderer.brightenWorldMaterials?.(dungeon.rootGroup || renderer.scene);
    player.resetPosition(floorData.spawnPoint || { x: 0, y: 0, z: 0 });
    petController.resetPosition(floorData.spawnPoint || { x: 0, y: 0, z: 0 });

    if (enemyManager?.spawnFloorEnemies) {
      enemyManager.spawnFloorEnemies(floorData, targetFloor, renderer.scene, models3d, extractedData);
    }

    if (gameState.enterFloor) {
      gameState.enterFloor(targetFloor);
    }
    if (gameState.quests?.onReachFloor) {
      gameState.quests.onReachFloor(targetFloor);
    }

    gameContext.hud?.showZone?.(floorData.name || `Dungeon B${targetFloor}F`, targetFloor);
    gameContext.menus?.closeAll?.();
    return true;
  }

  const HAZARD_STYLE_TABLE = {
    fire: { color: 0xf97316, statusId: 'burn', statusPower: 14, name: 'Infernal Meteor' },
    ice: { color: 0x06b6d4, statusId: 'slow', statusPower: 30, name: 'Frost Obelisk Pulse' },
    lightning: { color: 0xa855f7, statusId: 'shock', statusPower: 18, name: 'Tempest Bolt' },
    dark: { color: 0xdc2626, statusId: 'weaken', statusPower: 20, name: 'Abyssal Eruption' },
    physical: { color: 0xf59e0b, statusId: null, statusPower: 0, name: 'Coliseum Shockwave' }
  };

  function applyTrialScaling(enemy, hpMult = 1, atkMult = 1, spdMult = 1) {
    if (!enemy) return;
    enemy.maxHp = Math.max(20, Math.round((enemy.maxHp || 50) * hpMult));
    enemy.hp = enemy.maxHp;
    enemy.atk = Math.max(4, Math.round((enemy.atk || 10) * atkMult));
    const nextSpd = Number(((enemy.moveSpeed || 3.8) * spdMult).toFixed(2));
    enemy.moveSpeed = nextSpd;
    enemy.speed = nextSpd;
    enemy.alerted = true;
    enemy.state = 'CHASE';
    enemy.isChallengeMob = true;
    enemy.syncHealthBar?.(renderer?.camera);
  }

  function countAliveEnemies() {
    const list = enemyManager?.enemies;
    if (!list) return 0;
    let aliveCount = 0;
    for (let i = 0; i < list.length; i++) {
      if (!list[i].dead) aliveCount++;
    }
    return aliveCount;
  }

  function countRemainingGiants(exclude) {
    const list = enemyManager?.enemies;
    if (!list) return 0;
    let count = 0;
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      if (e !== exclude && !e.dead && e.isGiant) count++;
    }
    return count;
  }

  function spawnChallengeWave(chState) {
    if (!chState || chState.completed) return;
    const cfg = chState.cfg;
    const floorDef = dungeon._getFloorDef?.(chState.floorNum) || {};
    const pool = floorDef.monsterTypes?.length ? floorDef.monsterTypes : ['bandit', 'tiger'];
    const alive = countAliveEnemies();
    const cap = (cfg.maxAlive || 14) + (chState.overdriveTriggered ? 3 : 0);
    if (alive >= cap) return;

    chState.wave += 1;
    const phaseBoost = chState.overdriveTriggered ? 1.18 : 1.0;
    const hpMult = (cfg.mobHpMult || 1.45) * phaseBoost;
    const atkMult = (cfg.mobAtkMult || 1.28) * (chState.overdriveTriggered ? 1.15 : 1.0);
    const spdMult = (cfg.mobSpdMult || 1.12) * (chState.overdriveTriggered ? 1.08 : 1.0);

    // Shadow Unique / Giant Warden Champion(s) on Wave 1
    if (cfg.spawnGiant && !chState.giantSpawned) {
      chState.giantSpawned = true;
      const wardenCount = Math.max(1, cfg.wardenCount || 1);
      for (let w = 0; w < wardenCount; w++) {
        const gType = pool[(w + Math.floor(Math.random() * pool.length)) % pool.length];
        const wx = wardenCount === 1 ? 0 : (w % 2 === 0 ? -5.8 : 5.8);
        const wz = -10.5 + Math.floor(w / 2) * 3.0;
        const champion = enemyManager.spawnMonster({
          type: gType,
          floor: chState.floorNum,
          x: wx,
          z: wz,
          isGiant: true,
          isChallengeMob: true,
          roomId: 0,
          sleeping: false
        });
        if (champion) {
          champion.isChallengeMob = true;
          champion.name = wardenCount > 1
            ? `Shadow Warden #${w + 1}: ${champion.name}`
            : `Shadow ${champion.name}`;
          applyTrialScaling(champion, hpMult * 1.45, atkMult * 1.22, spdMult);
        }
        renderer.spawnShockwave?.({ x: wx, y: 0.2, z: wz }, cfg.color || 0xef4444, 3.6);
      }
    }

    const eliteChance = Math.min(0.85, (cfg.eliteChance || 0.32) + (chState.overdriveTriggered ? 0.15 : 0));
    const toSpawn = Math.min((cfg.waveCount || 4) + (chState.overdriveTriggered ? 1 : 0), cap - alive);
    for (let i = 0; i < toSpawn; i++) {
      const ang = ((Math.PI * 2) / Math.max(1, toSpawn)) * i + Math.random() * 0.45;
      const rad = 10.2 + Math.random() * 2.2;
      const sx = Math.cos(ang) * rad;
      const sz = Math.sin(ang) * rad;
      const mType = pool[Math.floor(Math.random() * pool.length)];
      const m = enemyManager.spawnMonster({
        type: mType,
        floor: chState.floorNum,
        x: sx,
        z: sz,
        isElite: Math.random() < eliteChance,
        isChallengeMob: true,
        roomId: 0,
        sleeping: false
      });
      if (m) {
        m.isChallengeMob = true;
        applyTrialScaling(m, hpMult, atkMult, spdMult);
      }
      renderer.spawnHitSparks?.({ x: sx, y: 0.5, z: sz }, cfg.color || 0xf59e0b, 8);
    }
  }

  function completeChallenge() {
    if (!activeChallenge || activeChallenge.completed) return;
    activeChallenge.completed = true;
    activeChallenge.remaining = 0;
    if (activeChallenge.portalEntity) {
      activeChallenge.portalEntity.completed = true;
    }

    // Clear remaining challenge mobs so player can safely loot chests
    for (const e of enemyManager.enemies) {
      if (!e.dead || !e.isDead) {
        e.dead = true;
        e.isDead = true;
        e.hp = 0;
        if (e.mesh) e.mesh.visible = false;
        enemyManager.clearStatuses?.(e);
        renderer.spawnHitSparks?.(e, 0xfacc15, 8);
      }
    }

    dungeon.spawnChallengeRewardChests?.(activeChallenge.cfg, activeChallenge.floorNum);
    const retPortal = dungeon.spawnChallengeReturnPortal?.(activeChallenge.floorNum);
    renderer.spawnShockwave?.({ x: 0, y: 0.2, z: retPortal?.z ?? -10.0 }, 0x10b981, 4.6);
    renderer.spawnLevelUpPillar?.(player.position);
    player.sound?.play?.('levelup');
    renderer.shake?.(0.3, 0.25);
    gameContext.hud?.toast?.('✨ Challenge Complete! Open Reward Chests & take Return Portal!', 'levelup');
  }

  function updateChallenge(dt) {
    if (!activeChallenge || !activeChallenge.active || activeChallenge.completed) return;
    const cfg = activeChallenge.cfg || {};
    activeChallenge.elapsed += dt;
    activeChallenge.remaining = Math.max(0, activeChallenge.remaining - dt);

    // Final Overdrive escalation phase
    if (cfg.overdriveAt && !activeChallenge.overdriveTriggered && activeChallenge.remaining <= cfg.overdriveAt) {
      activeChallenge.overdriveTriggered = true;
      activeChallenge.waveTimer = Math.min(activeChallenge.waveTimer, 1.2);
      gameContext.hud?.toast?.(`🔥 FINAL OVERDRIVE (${Math.ceil(activeChallenge.remaining)}s left)! Enemies enter frenzy!`, 'warning');
      renderer.shake?.(0.28, 0.25);
      if (cfg.overdriveGiant && !cfg.spawnGiant) {
        const floorDef = dungeon._getFloorDef?.(activeChallenge.floorNum) || {};
        const pool = floorDef.monsterTypes?.length ? floorDef.monsterTypes : ['bandit', 'tiger'];
        const gType = pool[Math.floor(Math.random() * pool.length)];
        const exec = enemyManager.spawnMonster({
          type: gType,
          floor: activeChallenge.floorNum,
          x: 0,
          z: -10.5,
          isGiant: true,
          isChallengeMob: true,
          roomId: 0,
          sleeping: false
        });
        if (exec) {
          exec.isChallengeMob = true;
          exec.name = `Executioner ${exec.name}`;
          applyTrialScaling(exec, (cfg.mobHpMult || 1.5) * 1.45, (cfg.mobAtkMult || 1.3) * 1.25, (cfg.mobSpdMult || 1.15) * 1.1);
        }
        renderer.spawnShockwave?.({ x: 0, y: 0.2, z: -10.5 }, cfg.color || 0xef4444, 4.0);
      }
    }

    // Periodic telegraphed arena hazards
    if (cfg.hazardInterval > 0 && activeChallenge.remaining > 2.5) {
      activeChallenge.hazardTimer -= dt;
      if (activeChallenge.hazardTimer <= 0) {
        activeChallenge.hazardTimer = (cfg.hazardInterval || 4.0) * (activeChallenge.overdriveTriggered ? 0.72 : 1.0);
        const element = cfg.hazardElement || 'fire';
        const style = HAZARD_STYLE_TABLE[element] || HAZARD_STYLE_TABLE.fire;
        const baseDmg = (20 + activeChallenge.floorNum * 9) * (cfg.hazardDamageMult || 1.25) * (activeChallenge.overdriveTriggered ? 1.2 : 1.0);
        const strikeCount = activeChallenge.overdriveTriggered ? 3 : 2;
        const px = player.position?.x || 0;
        const pz = player.position?.z || 0;
        for (let s = 0; s < strikeCount; s++) {
          const tx = s === 0
            ? Math.max(-12.5, Math.min(12.5, px + (Math.random() - 0.5) * 2.2))
            : (Math.random() - 0.5) * 20.0;
          const tz = s === 0
            ? Math.max(-12.5, Math.min(12.5, pz + (Math.random() - 0.5) * 2.2))
            : (Math.random() - 0.5) * 20.0;
          enemyManager.queueArenaHazard?.({
            x: tx,
            z: tz,
            radius: 2.75,
            delay: 1.45,
            damage: Math.round(baseDmg),
            element,
            color: style.color,
            statusId: style.statusId,
            statusDuration: 3.0,
            statusPower: style.statusPower,
            hazardName: style.name,
            world: dungeon
          });
        }
      }
    }

    activeChallenge.waveTimer -= dt;
    if (activeChallenge.waveTimer <= 0 && activeChallenge.remaining > 3.5) {
      activeChallenge.waveTimer = cfg.waveInterval || 5.5;
      spawnChallengeWave(activeChallenge);
    }
    if (activeChallenge.remaining <= 0) {
      completeChallenge();
    }
  }

  function enterChallenge(portalEntity) {
    if (!portalEntity || activeChallenge) return;
    const cfg = CHALLENGE_TYPES[portalEntity.challengeType] || portalEntity.challengeCfg || CHALLENGE_TYPES.survival_60;
    const floorNum = Math.max(1, Number(portalEntity.floorNum || dungeon.currentFloor) || 1);

    // Pick a clean return spot adjacent to the portal while floor is still active
    const candidateSpots = [
      { x: portalEntity.x, y: 0, z: portalEntity.z + 1.8 },
      { x: portalEntity.x + 1.8, y: 0, z: portalEntity.z },
      { x: portalEntity.x - 1.8, y: 0, z: portalEntity.z },
      { x: portalEntity.x, y: 0, z: portalEntity.z - 1.8 }
    ];
    let returnPos = { x: portalEntity.x, y: 0, z: portalEntity.z };
    for (const sp of candidateSpots) {
      if (dungeon.isWalkable?.(sp.x, sp.z, 0.45)) {
        returnPos = sp;
        break;
      }
    }

    const floorSnapshot = dungeon.suspendFloorWorld();
    const enemySnapshot = enemyManager.suspendFloorEnemies();

    const arenaData = dungeon.generateChallengeArena(cfg, floorNum, renderer, models3d);
    renderer.setEnvironmentTheme(arenaData.theme || 'boss');
    renderer.applyAtmosphere?.(arenaData.atmosphere || null);
    renderer.brightenWorldMaterials?.(dungeon.rootGroup || renderer.scene);

    player.cancelSkill?.();
    player.resetPosition(arenaData.spawnPoint || { x: 0, y: 0, z: 6.0 });
    petController.resetPosition(arenaData.spawnPoint || { x: 0, y: 0, z: 6.0 });

    activeChallenge = {
      active: true,
      id: cfg.id,
      name: cfg.name,
      desc: cfg.desc,
      cfg,
      floorNum,
      portalEntity,
      returnPos,
      floorSnapshot,
      enemySnapshot,
      duration: cfg.duration,
      elapsed: 0,
      remaining: cfg.duration,
      wave: 0,
      waveTimer: cfg.waveInterval || 5.5,
      hazardTimer: (cfg.hazardInterval || 4.0) * 0.75,
      overdriveTriggered: false,
      kills: 0,
      giantSpawned: false,
      completed: false
    };
    gameContext.challenge = activeChallenge;
    gameContext.hud?.showZone?.(`Trial: ${cfg.name}`, floorNum);
    gameContext.hud?.toast?.(`⚔️ ${cfg.name} started! Survive ${cfg.duration}s!`, 'levelup');
    gameContext.menus?.closeAll?.();
    spawnChallengeWave(activeChallenge);
  }

  function exitChallenge({ died = false } = {}) {
    if (!activeChallenge) return;
    clearTimeout(challengeDeathTimer);
    const ch = activeChallenge;
    activeChallenge = null;
    gameContext.challenge = null;

    enemyManager.clearEnemies();
    const floorData = dungeon.restoreFloorWorld(ch.floorSnapshot);
    enemyManager.restoreFloorEnemies(ch.enemySnapshot);

    renderer.setEnvironmentTheme(floorData?.theme || 'cave');
    renderer.applyAtmosphere?.(floorData?.atmosphere || null);
    renderer.brightenWorldMaterials?.(dungeon.rootGroup || renderer.scene);

    if (ch.completed && ch.portalEntity) {
      ch.portalEntity.completed = true;
      ch.portalEntity.prompt = '✓ Challenge Conquered';
      ch.portalEntity.mesh?.userData?.setLocked?.(true);
    }

    player.cancelSkill?.();
    player.resetPosition(ch.returnPos || floorData?.spawnPoint || { x: 0, y: 0, z: 0 });
    petController.resetPosition(ch.returnPos || floorData?.spawnPoint || { x: 0, y: 0, z: 0 });

    if (died) {
      gameState.revive?.({ penalty: false, targetFloor: ch.floorNum });
      gameContext.hud?.toast?.(`💀 Challenge Failed! Returned directly to B${ch.floorNum}F.`, 'warn');
    } else {
      gameContext.hud?.toast?.(`Returned to ${floorData?.name || `Dungeon B${ch.floorNum}F`}.`, 'info');
    }
    gameContext.hud?.showZone?.(floorData?.name || `Dungeon B${ch.floorNum}F`, ch.floorNum);
    gameContext.menus?.closeAll?.();
  }

  gameContext.enterFloor = enterFloor;
  gameContext.returnToVillage = returnToVillage;
  gameContext.enterChallenge = enterChallenge;
  gameContext.exitChallenge = exitChallenge;
  gameContext.dropItem = (uid) => gameState.inventory.drop(uid);
  gameContext.quickSellJunk = () => gameState.inventory.quickSellTrash();
  dungeon.setContext?.(gameContext);
  enemyManager.setContext?.(gameContext);

  // 7. Initialize HUD & Interactive RPG Menus
  const hud = createHUD(hudContainer, gameContext);
  const menus = createMenus(menuContainer, gameContext);
  gameContext.hud = hud;
  gameContext.menus = menus;

  // 8. Wire RPG Events to 3D VFX, Audio, and HUD
  gameState.on('levelup', (newLevel) => {
    renderer.spawnLevelUpPillar(player.position);
    player.sound.play('levelup');
    hud.toast?.(`Level Up! Reached Level ${newLevel}`, 'levelup');
  });

  gameState.on('equip', () => {
    player.syncEquipment();
  });

  gameState.on('berserk', (info) => {
    if (info?.active) {
      renderer.setBerserkAura?.(player.mesh, true);
      player.setBerserkAura?.(true);
      hud.toast?.('🔥 HWAN BERSERK UNLEASHED! (2x Damage & Speed)', 'levelup');
    } else {
      renderer.setBerserkAura?.(player.mesh, false);
      player.setBerserkAura?.(false);
    }
  });

  gameState.on('nemesisSlain', (info) => {
    renderer.spawnLevelUpPillar(player.position);
    player.sound.play('levelup');
    hud.toast?.(`⚔️ VENGEANCE CLAIMED! Slain ${info?.name || 'Nemesis'} (+${info?.gold || 0}G)`, 'levelup');
  });

  gameState.on('floorCleared', (clearedFloor) => {
    renderer.spawnLevelUpPillar(player.position);
    player.sound.play('levelup');
    hud.showBanner?.(`KAT B${clearedFloor}F TEMİZLENDİ!`, 'Sonraki kat geçidi açıldı · Hikaye ve görevler güncellendi');
  });

  // Physical 3D Ground Loot spawn on item drop
  gameState.on('item:dropped', (item) => {
    if (!item) return;
    const pos = player.position || { x: 0, y: 0, z: 0 };
    const angle = player.rotation || 0;
    const tossDist = 1.35;
    const tossX = pos.x + Math.sin(angle) * tossDist + (Math.random() - 0.5) * 0.3;
    const tossZ = pos.z + Math.cos(angle) * tossDist + (Math.random() - 0.5) * 0.3;
    dungeon.spawnGroundLoot({ x: tossX, z: tossZ }, item, null, { x: pos.x, z: pos.z }, { pickupCooldown: 1800 });
    player.sound?.play('loot');
    hud.toast?.(`Dropped ${item.name}`, 'info');
  });

  // Re-apply class look (body parts, colors, attack style) and equipment whenever the hero changes
  gameState.on('loaded', () => {
    clearTimeout(_reviveTimeout);
    _reviveTimeout = null;
    player.applyHeroLook?.();
    player.syncEquipment?.();
  });
  gameState.on('reset', () => {
    clearTimeout(_reviveTimeout);
    _reviveTimeout = null;
    player.applyHeroLook?.();
    player.syncEquipment?.();
  });

  gameState.on('death', () => {
    if (activeChallenge && activeChallenge.active) {
      hud.toast?.(`💀 Fallen in Trial! Teleporting back to B${activeChallenge.floorNum}F...`, 'warn');
      clearTimeout(challengeDeathTimer);
      challengeDeathTimer = setTimeout(() => {
        exitChallenge({ died: true });
      }, 800);
      return;
    }
    hud.toast?.('You have fallen! Returning to Oakhaven Village...', 'info');
    clearTimeout(_reviveTimeout);
    _reviveTimeout = setTimeout(() => {
      _reviveTimeout = null;
      if (gameState.revive) gameState.revive();
      returnToVillage();
    }, 1200);
  });

  // 9. Handle Player Interaction (`E` / `F`)
  function handlePlayerInteract() {
    if (menus.isAnyMenuOpen()) return;
    const nearest = dungeon.getNearestInteractable(player.position.x, player.position.z, 3.0);
    if (!nearest) return;

    if (nearest.type === 'npc') {
      const npc = nearest.entity || nearest;
      if (gameState.quests?.onTalk) {
        gameState.quests.onTalk(npc.id);
      }
      const dlg = gameState.quests?.getNpcDialogue
        ? gameState.quests.getNpcDialogue(npc.id)
        : null;
      if (dlg && menus.openDialogue) {
        menus.openDialogue({ ...dlg, npcId: npc.id });
      } else if (npc.actionType === 'pet_shop') {
        menus.openMenu('petshop');
      } else if (npc.actionType === 'shop' && menus.openShop) {
        menus.openShop(npc.shopId || npc.id);
      } else if (npc.actionType === 'compose') {
        menus.openMenu('compose');
      } else if (npc.actionType === 'skills') {
        menus.openMenu('skills');
      } else if (npc.actionType === 'storage') {
        menus.openMenu('storage');
      } else {
        menus.openMenu('quests');
      }
      return;
    }

    const res = dungeon.interact(nearest, gameContext);
    if (res?.ok) {
      if (nearest.type === 'storage_chest' || res.type === 'storage_chest') {
        player.sound.play('loot');
        renderer.spawnHitSparks(nearest.position || player.position, 0xfbbf24, 12);
        menus.openMenu?.('storage');
      } else if (nearest.type === 'chest') {
        player.sound.play('loot');
        renderer.spawnHitSparks(nearest.position || player.position, 0xfacc15, 16);
      } else if (nearest.type === 'loot') {
        player.sound.play('loot');
      } else if (nearest.type === 'shrine' || nearest.type === 'switch') {
        player.sound.play('skill');
        renderer.spawnAura(player.position, 0x4ade80, 'heal');
      }
    }
  }

  // 10. Pre-allocated per-frame callback option objects (zero GC churn in 60fps loop)
  const dungeonUpdateOpts = {
    onTrapHit: (trap, damage, element) => {
      player.receiveHit(damage, trap, { element });
      hud.damageFlash?.();
    }
  };
  const enemyUpdateOpts = {
    isPlayerAlive: true,
    onPlayerHit: (damage, enemy, attackInfo = {}) => {
      const hitRes = player.receiveHit(damage, enemy, attackInfo);
      if (!hitRes?.dodged) {
        hud.damageFlash?.();
      }
      return hitRes;
    },
    onEnemyKilled: (enemy) => {
      if (activeChallenge?.active) {
        activeChallenge.kills += 1;
        if (activeChallenge.cfg?.spawnGiant && enemy.isGiant && !activeChallenge.completed) {
          const remainingGiants = countRemainingGiants(enemy);
          if (remainingGiants === 0) {
            completeChallenge();
          } else {
            gameContext.hud?.toast?.(`⚔️ Shadow Warden slain! ${remainingGiants} Warden${remainingGiants > 1 ? 's' : ''} remaining!`, 'levelup');
          }
        }
        return;
      }
      if (enemy.isBoss) {
        const ePos = enemy.position || { x: enemy.x || 0, y: 0, z: enemy.z || 0 };
        renderer.spawnLevelUpPillar(ePos);
        player.sound.play('levelup');
        if (dungeon.currentFloor === 16) {
          const storyRes = gameState.completeStory?.(enemy);
          hud?.toast?.('👑 FINAL BOSS DEFEATED! The Sky Sovereign has fallen!', 'levelup');
          setTimeout(() => {
            menus.showStoryEnding?.({
              heroName: gameState.hero?.name,
              level: gameState.hero?.level,
              kills: gameState.progress?.kills || 0,
              deaths: gameState.progress?.deaths || 0,
              bossName: enemy.name || 'Roc',
              bonusGold: storyRes?.bonusGold || 0,
              bonusExp: storyRes?.bonusExp || 0,
            });
          }, 1600);
        }
      } else {
        const bGate = dungeon?.gates?.find?.((g) => g.isBossGate) || dungeon?.bossGate;
        if (bGate && !bGate.isOpen) {
          const remaining = enemyManager?.getAliveNonBossCount ? enemyManager.getAliveNonBossCount(dungeon) : 0;
          if (remaining === 0) {
            dungeon.setGateOpen(bGate.id, true);
            bGate.isOpen = true;
            const msg = 'The Boss Chamber seal has shattered! The Gate is open!';
            hud?.showToast?.(msg, 'levelup');
            hud?.toast?.(msg, 'levelup');
            renderer.shake?.(0.35, 0.25);
            player.sound.play('levelup');
          }
        }
      }
    }
  };

  // 11. Main 60fps Game Loop (started cleanly once title screen finishes)
  let lastTime = performance.now();
  let elapsed = 0;

  function animate(now) {
    requestAnimationFrame(animate);
    const dt = Math.min(0.05, Math.max(0.001, (now - lastTime) / 1000));
    lastTime = now;
    elapsed += dt;

    // Pause 3D movement/combat input while an RPG modal menu is open
    player.inputEnabled = !menus.isAnyMenuOpen();

    // Update RPG Systems (regen, buffs, skill cooldowns)
    gameState.update(dt);

    // Update Hero Controller
    player.update(dt, elapsed);

    // Update 3D Companion Pet Controller
    petController.update(dt, elapsed);

    // Update World Props & Traps
    dungeon.update(dt, elapsed, player.position, dungeonUpdateOpts);

    // Update Challenge Arena Timer & Wave Spawner
    if (activeChallenge?.active && !menus.isAnyMenuOpen()) {
      updateChallenge(dt);
    }

    // Update Enemy & Boss AI
    if (enemyManager?.update) {
      enemyUpdateOpts.isPlayerAlive = !player?.dead && (gameState?.hero?.hp ?? 1) > 0;
      enemyManager.update(dt, elapsed, player.position, dungeon, enemyUpdateOpts);
    }

    // Update 3D Camera, Lights, Particles & Render
    renderer.update(dt, elapsed, player.position);
    renderer.render();

    // Update HUD & Menus
    hud.update(dt, gameContext);
    menus.update?.(dt, gameContext);
  }

  window.__ASJ_GAME__ = gameContext;

  // 12. Title screen first (avoids wasting 60fps simulation & double hub builds behind overlay)
  await runTitleScreen();
  lastTime = performance.now();
  requestAnimationFrame(animate);

  async function runTitleScreen() {
    const overlayRoot = document.getElementById('modal-root') || document.body;
    const readSaves = () => [0, 1, 2].map((slot) => (gameState.getSaveInfo ? gameState.getSaveInfo(slot) : null));
    let choice = null;
    try {
      choice = await openCharacterCreation(overlayRoot, {
        saves: readSaves(),
        createPreview: (canvas) => createHeroPreview(canvas),
        onDeleteSave: (slot) => gameState.deleteSave?.(slot)
      });
    } catch (err) {
      console.error('[ASJ] Character creation failed, starting default hero:', err);
    }

    if (choice?.mode === 'continue') {
      const res = gameState.load(choice.slot);
      if (res && res.ok === false) hud.toast?.(res.msg || 'Load failed', 'warn');
    } else if (choice?.mode === 'new') {
      gameState.newCharacter({
        name: choice.name,
        classId: choice.classId,
        appearance: choice.appearance,
        slot: choice.slot
      });
      gameState.save(choice.slot);
    }

    player.applyHeroLook?.();
    player.syncEquipment?.();
    returnToVillage();
    const cls = gameState.heroClass;
    if (cls) hud.toast?.(`${cls.icon} ${gameState.hero.name} the ${cls.name} arrives in Oakhaven.`, 'info');
  }
}

bootstrap().catch((err) => {
  console.error('[ASJ] Bootstrap error:', err);
});

import './ui/styles.css';
import extractedData from './data/extracted_data.json';
import { createRenderer } from './engine/renderer.js';
import { models3d } from './engine/models3d.js';
import { PlayerController } from './engine/playerController.js';
import { createGame } from './systems/gameState.js';
import { createDungeonGenerator } from './world/dungeonGenerator.js';
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
    inventory: gameState.inventory,
    skills: gameState.skills,
    quests: gameState.quests,
    dungeon: null,
    world: null,
    enemyManager: null,
    enemies: null,
    player: null,
    hud: null,
    menus: null,
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

  // 6. Zone & Floor Transition Functions
  function returnToVillage() {
    if (enemyManager?.clearEnemies) {
      enemyManager.clearEnemies();
    }
    const hubData = dungeon.loadVillageHub(renderer, models3d);
    renderer.setEnvironmentTheme('village');
    renderer.brightenWorldMaterials?.(dungeon.rootGroup || renderer.scene);
    player.resetPosition(hubData.spawnPoint || { x: 0, y: 0, z: 4 });
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
    const targetFloor = Number(floorNum) || 0;
    if (targetFloor <= 0) {
      returnToVillage();
      return;
    }

    if (enemyManager?.clearEnemies) {
      enemyManager.clearEnemies();
    }

    const floorData = dungeon.generateFloor(targetFloor, renderer, models3d, extractedData);
    renderer.setEnvironmentTheme(floorData.theme || 'cave');
    renderer.applyAtmosphere?.(floorData.atmosphere || null);
    renderer.brightenWorldMaterials?.(dungeon.rootGroup || renderer.scene);
    player.resetPosition(floorData.spawnPoint || { x: 0, y: 0, z: 0 });

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
  }

  gameContext.enterFloor = enterFloor;
  gameContext.returnToVillage = returnToVillage;
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

  // Re-apply class look (body parts, colors, attack style) whenever the hero changes
  gameState.on('loaded', () => player.applyHeroLook?.());
  gameState.on('reset', () => player.applyHeroLook?.());

  gameState.on('death', () => {
    hud.toast?.('You have fallen! Returning to Oakhaven Village...', 'info');
    setTimeout(() => {
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
      if (nearest.type === 'chest') {
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

  // 10. Start in Oakhaven Village Safe Hub
  returnToVillage();

  // 11. Main 60fps Game Loop
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

    // Update World Props & Traps
    dungeon.update(dt, elapsed, player.position, {
      onTrapHit: (trap, damage, element) => {
        player.receiveHit(damage, trap, { element });
        hud.damageFlash?.();
      }
    });

    // Update Enemy & Boss AI
    if (enemyManager?.update) {
      enemyManager.update(dt, elapsed, player.position, dungeon, {
        onPlayerHit: (damage, enemy, attackInfo = {}) => {
          const hitRes = player.receiveHit(damage, enemy, attackInfo);
          if (!hitRes?.dodged) {
            hud.damageFlash?.();
          }
          return hitRes;
        },
        onEnemyKilled: (enemy) => {
          if (enemy.isBoss) {
            const ePos = enemy.position || { x: enemy.x || 0, y: 0, z: enemy.z || 0 };
            renderer.spawnLevelUpPillar(ePos);
            player.sound.play('levelup');
          }
        }
      });
    }

    // Update 3D Camera, Lights, Particles & Render
    renderer.update(dt, elapsed, player.position);
    renderer.render();

    // Update HUD & Menus
    hud.update(dt, gameContext);
    menus.update?.(dt, gameContext);
  }

  requestAnimationFrame(animate);
  window.__ASJ_GAME__ = gameContext;

  // 12. Title screen: pick a save slot, or choose a permanent class & design a new hero
  await runTitleScreen();

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
    returnToVillage();
    const cls = gameState.heroClass;
    if (cls) hud.toast?.(`${cls.icon} ${gameState.hero.name} the ${cls.name} arrives in Oakhaven.`, 'info');
  }
}

bootstrap().catch((err) => {
  console.error('[ASJ] Bootstrap error:', err);
});

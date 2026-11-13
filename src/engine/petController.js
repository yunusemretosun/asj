import * as THREE from 'three';
import { PET_TYPES } from '../systems/petSystem.js';
import { attachGLBModel } from './models3d.js';

/**
 * 3D Companion Pet Controller for ARKENVEIL: SIGILS & JOURNEYS.
 * Features:
 * - Spring follow physics with leash teleportation
 * - Scampering auto-loot collection (White Rabbit & Golden Piggy)
 * - Companion combat assistance (Grey Wolf & Tiger Cub)
 * - Animated bobbing/hopping physics and companion rune ring
 */
export class PetController {
  constructor({ renderer, playerController, dungeon, enemyManager, gameState, sound }) {
    this.renderer = renderer;
    this.player = playerController;
    this.dungeon = dungeon;
    this.enemyManager = enemyManager || dungeon?.gameContext?.enemyManager || null;
    this.gameState = gameState;
    this.sound = sound;

    this.petSystem = gameState?.pets || null;
    this.mesh = null;
    this.activePet = null;
    this.position = { x: 0, y: 0, z: 0 };
    this.rotation = 0;
    this.state = 'follow'; // 'follow' | 'loot' | 'combat' | 'idle'
    this.targetLoot = null;
    this.targetEnemy = null;
    this.lootScanTimer = 0;
    this.combatTimer = 0;
    this.bobTimer = 0;
    this.actionLockTimer = 0;
    this.lockedClipName = null;

    // Listen for pet system changes
    if (this.petSystem && typeof this.petSystem.on === 'function') {
      this.petSystem.on('pet:summoned', (pet) => this.onPetSummoned(pet));
      this.petSystem.on('pet:dismissed', () => this.onPetDismissed());
    }
    if (this.gameState && typeof this.gameState.on === 'function') {
      const resync = () => {
        const cur = this.petSystem?.getActivePet?.();
        if (cur && cur.summoned) this.onPetSummoned(cur);
        else this.onPetDismissed();
      };
      this.gameState.on('loaded', resync);
      this.gameState.on('reset', resync);
    }

    const initialPet = this.petSystem?.getActivePet?.();
    if (initialPet && initialPet.summoned) {
      this.onPetSummoned(initialPet);
    }
  }

  onPetSummoned(pet) {
    this.activePet = pet;
    this.removeMesh();
    if (!pet || !pet.summoned) return;

    if (this.player?.position) {
      this.position.x = this.player.position.x - 1.2;
      this.position.y = this.player.position.y || 0;
      this.position.z = this.player.position.z - 1.2;
    }
    this.state = 'follow';
    this.targetLoot = null;
    this.buildMesh(pet);
  }

  onPetDismissed() {
    this.activePet = null;
    this.removeMesh();
  }

  removeMesh() {
    if (this.mesh) {
      if (this.renderer?.scene) {
        this.renderer.scene.remove(this.mesh);
      }
      this.mesh = null;
    }
  }

  buildMesh(pet) {
    if (typeof window === 'undefined' || !this.renderer?.scene) return;
    const def = PET_TYPES[pet.type] || PET_TYPES.rabbit;
    const group = new THREE.Group();
    group.name = `PetCompanion_${pet.id}`;

    // 1. Glowing companion ground ring
    const ringGeo = new THREE.RingGeometry(0.24, 0.34, 20);
    ringGeo.rotateX(-Math.PI / 2);
    const ringColor = def.role === 'combat' ? 0xf87171 : def.role === 'loot' ? 0xfacc15 : 0x67e8f9;
    const ringMat = new THREE.MeshBasicMaterial({
      color: ringColor,
      transparent: true,
      opacity: 0.55,
      side: THREE.DoubleSide
    });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.position.y = 0.02;
    group.add(ringMesh);

    // 2. Authentic Silkroad Online 3D GLB Model (no blocky primitives)
    const modelGroup = new THREE.Group();
    modelGroup.name = 'ModelVisual';

    const glbUrl = def.glbPath || '/assets/sro/pets/p_rabbit.glb';
    attachGLBModel(modelGroup, glbUrl, {
      targetHeight: def.targetSpan ? null : (def.targetHeight || 0.78),
      targetSpan: def.targetSpan || null,
      groundAtZero: true,
      centerXZ: true,
      hideFallback: false,
      castShadow: true,
      receiveShadow: true,
      onLoaded: (clone, { animations }) => {
        let rootBone = null;
        clone.traverse((b) => {
          if (b.isMesh) b.frustumCulled = false;
          if (!rootBone && b.isBone && /^(Bip0[123]|Bone01)$/i.test(b.name)) {
            rootBone = b;
          }
        });
        const bindRootY = rootBone ? rootBone.position.y : 0;
        if (animations && animations.length > 0) {
          const mixer = new THREE.AnimationMixer(clone);
          const actions = {};
          for (const clip of animations) {
            actions[clip.name] = mixer.clipAction(clip);
          }
          group.userData.mixer = mixer;
          group.userData.actions = actions;
          const stand = actions['STAND1'] || actions['WAIT1'] || Object.values(actions)[0];
          const move = actions['RUN'] || actions['WALK'] || actions['WALK1'] || actions['RUN1'] || Object.values(actions)[1] || stand;
          const pick = actions['PICK'] || actions['EMOTION01'] || null;
          const attack = actions['ATTACK1'] || actions['ATTACK2'] || null;
          group.userData.standAction = stand || null;
          group.userData.moveAction = move || null;
          group.userData.pickAction = pick;
          group.userData.attackAction = attack;
          if (stand) {
            stand.play();
            mixer.update(0.001);
            group.userData.currentAction = stand;
            if (rootBone && rootBone.position.y < bindRootY - 0.02) {
              clone.position.y += (bindRootY - rootBone.position.y) * clone.scale.y;
            }
          }
        }
      }
    });

    group.add(modelGroup);
    group.userData.modelVisual = modelGroup;
    group.userData.ring = ringMesh;

    group.position.set(this.position.x, this.position.y, this.position.z);
    this.renderer.scene.add(group);
    this.mesh = group;
  }

  update(dt = 0.016, elapsed = 0) {
    const cur = this.petSystem?.getActivePet?.();
    if (!cur || !cur.summoned) {
      if (this.mesh && this.mesh.visible) this.mesh.visible = false;
      return;
    }
    if (this.mesh && !this.mesh.visible) this.mesh.visible = true;

    if (!this.player?.position) return;
    const pPos = this.player.position;
    const distToHero = Math.hypot(this.position.x - pPos.x, this.position.z - pPos.z);

    // 1. Leash Teleport (if hero dashed far away or changed room)
    if (distToHero > 16.0) {
      this.position.x = pPos.x - 1.2;
      this.position.y = pPos.y || 0;
      this.position.z = pPos.z - 1.2;
      this.targetLoot = null;
      this.targetEnemy = null;
      this.state = 'follow';
      if (this.renderer?.spawnHitSparks) {
        this.renderer.spawnHitSparks(this.position, 0x67e8f9, 12);
      }
    }

    const def = PET_TYPES[cur.type] || PET_TYPES.rabbit;
    const moveSpeed = (def.speed || 5.0) * (1 + (cur.level - 1) * 0.02);

    // 2. Auto-Loot Scanning (Grab Pet mechanics)
    this.lootScanTimer -= dt;
    if (this.lootScanTimer <= 0 && this.state !== 'loot') {
      this.lootScanTimer = 0.22;
      const lootList = this.dungeon?.groundLoot || [];
      const radius = def.lootRadius || 8.0;
      let nearest = null;
      let nearestDist = Infinity;
      const now = Date.now();

      for (const item of lootList) {
        if (!item || item.collected) continue;
        if (item.canPickupAfter && now < item.canPickupAfter) continue;
        const d = Math.hypot(item.x - this.position.x, item.z - this.position.z);
        if (d <= radius && d < nearestDist) {
          nearest = item;
          nearestDist = d;
        }
      }

      if (nearest) {
        this.targetLoot = nearest;
        this.state = 'loot';
      }
    }

    // 3. Combat Assistance Scanning (Wolf & Tiger Combat Pets)
    if (def.role === 'combat' || def.role === 'hybrid') {
      this.combatTimer -= dt;
      if (this.combatTimer <= 0 && this.state === 'follow' && distToHero <= 8.0) {
        const em = this.enemyManager || this.dungeon?.gameContext?.enemyManager || null;
        const enemies = em?.enemies || this.dungeon?.enemies || this.renderer?.scene?.userData?.enemies || [];
        // Scan for closest engaged monster near player
        let bestEnemy = null;
        let bestDist = 5.5;
        for (const e of enemies) {
          if (!e || e.dead || e.isDead || e.hp <= 0) continue;
          const ed = Math.hypot(e.x - pPos.x, e.z - pPos.z);
          if (ed <= bestDist) {
            bestEnemy = e;
            bestDist = ed;
          }
        }
        if (bestEnemy) {
          this.targetEnemy = bestEnemy;
          this.state = 'combat';
          this.combatTimer = 1.6;
        }
      }
    }

    // 4. State Execution
    if (this.state === 'loot' && this.targetLoot) {
      if (this.targetLoot.collected) {
        this.targetLoot = null;
        this.state = 'follow';
      } else {
        const dx = this.targetLoot.x - this.position.x;
        const dz = this.targetLoot.z - this.position.z;
        const distToLoot = Math.hypot(dx, dz);
        const scamperSpeed = moveSpeed * 1.35;

        if (distToLoot <= 0.85) {
          // Vacuum up the loot!
          const ctx = {
            gameState: this.gameState,
            inventory: this.gameState?.inventory,
            quests: this.gameState?.quests,
            hud: this.player?.onToast ? { showToast: this.player.onToast } : null
          };
          const res = this.dungeon?.pickupLoot?.(this.targetLoot, ctx);
          if (res?.ok) {
            this.actionLockTimer = 0.45;
            this.lockedClipName = 'pickAction';
            if (this.renderer?.spawnHitSparks) {
              this.renderer.spawnHitSparks({ x: this.position.x, y: 0.35, z: this.position.z }, 0xfacc15, 14);
            }
            if (this.sound?.play) {
              this.sound.play('loot');
            }
            const lootLabel = res.isGold ? `${res.amount}G` : (res.item?.name || 'Item');
            if (this.gameState?.emit) {
              this.gameState.emit('toast', `🐾 ${cur.name} auto-looted ${lootLabel}!`, 'loot');
            }
          }
          this.targetLoot = null;
          this.state = 'follow';
        } else {
          // Scamper to loot
          const step = Math.min(distToLoot, scamperSpeed * dt);
          this.position.x += (dx / distToLoot) * step;
          this.position.z += (dz / distToLoot) * step;
          this.rotation = Math.atan2(dx, dz);
          this.bobTimer += dt * 14;
        }
      }

    } else if (this.state === 'combat' && this.targetEnemy) {
      if (this.targetEnemy.dead || this.targetEnemy.isDead || this.targetEnemy.hp <= 0) {
        this.targetEnemy = null;
        this.state = 'follow';
      } else {
        const dx = this.targetEnemy.x - this.position.x;
        const dz = this.targetEnemy.z - this.position.z;
        const dist = Math.hypot(dx, dz);
        if (dist <= 1.25) {
          // Strike enemy!
          const pStats = this.gameState?.getStats ? this.gameState.getStats() : { atkMin: 20, matk: 0, critRate: 5 };
          const baseAtk = Math.max(pStats.atkMin || 20, pStats.matk || 0);
          const lvMult = 0.35 + Math.min(0.45, (cur.level - 1) * 0.025);
          const isCrit = Math.random() * 100 < (pStats.critRate || 5);
          const petDmg = Math.max(6, Math.round(baseAtk * lvMult * (isCrit ? 1.5 : 1)));
          const em = this.enemyManager || this.dungeon?.gameContext?.enemyManager || null;
          const kbDir = dist > 0.01 ? { x: dx / dist, z: dz / dist } : null;

          if (em && typeof em.damageEnemy === 'function') {
            em.damageEnemy(this.targetEnemy, petDmg, isCrit, kbDir, 'physical');
          } else if (this.targetEnemy.receiveDamage) {
            this.targetEnemy.receiveDamage(petDmg, this.player);
          } else if (this.targetEnemy.hp != null) {
            this.targetEnemy.hp -= petDmg;
          }
          if (this.renderer?.spawnHitSparks) {
            this.renderer.spawnHitSparks({ x: this.targetEnemy.x, y: 0.7, z: this.targetEnemy.z }, isCrit ? 0xfacc15 : 0xef4444, 10);
          }
          if (this.sound?.play) {
            this.sound.play('hit');
          }
          this.actionLockTimer = 0.48;
          this.lockedClipName = 'attackAction';
          this.targetEnemy = null;
          this.state = 'follow';
        } else {
          const step = Math.min(dist, moveSpeed * 1.2 * dt);
          this.position.x += (dx / dist) * step;
          this.position.z += (dz / dist) * step;
          this.rotation = Math.atan2(dx, dz);
          this.bobTimer += dt * 12;
        }
      }

    } else {
      // Follow Player
      const followAngle = (this.player.rotation || 0) + 2.35;
      const targetX = pPos.x + Math.sin(followAngle) * 1.5;
      const targetZ = pPos.z + Math.cos(followAngle) * 1.5;
      const dx = targetX - this.position.x;
      const dz = targetZ - this.position.z;
      const dist = Math.hypot(dx, dz);

      if (dist > 0.35) {
        const step = Math.min(dist, moveSpeed * dt * Math.min(2.0, dist * 0.9));
        this.position.x += (dx / dist) * step;
        this.position.z += (dz / dist) * step;
        this.rotation = Math.atan2(dx, dz);
        this.bobTimer += dt * 10;
      } else {
        // Idle sniffing / breathing
        this.bobTimer = 0;
        this.rotation += (this.player.rotation - this.rotation) * Math.min(1, dt * 4);
      }
    }

    // 5. Update 3D Mesh Transform & Animations
    if (this.mesh) {
      this.mesh.position.set(this.position.x, this.position.y, this.position.z);
      this.mesh.rotation.y = this.rotation;

      // GLB skeletal animation mixer (pick/attack vs walk vs stand)
      if (this.actionLockTimer > 0) {
        this.actionLockTimer = Math.max(0, this.actionLockTimer - dt);
        if (this.actionLockTimer === 0) this.lockedClipName = null;
      }
      const mixer = this.mesh.userData?.mixer;
      if (mixer) {
        const isMoving = this.bobTimer > 0;
        const locked = this.lockedClipName ? this.mesh.userData[this.lockedClipName] : null;
        const desiredAction = locked || (isMoving ? this.mesh.userData.moveAction : this.mesh.userData.standAction);
        if (desiredAction && desiredAction !== this.mesh.userData.currentAction) {
          this.mesh.userData.currentAction?.fadeOut?.(0.15);
          desiredAction.reset?.();
          if (locked) {
            desiredAction.setLoop?.(THREE.LoopOnce, 1);
          } else {
            desiredAction.setLoop?.(THREE.LoopRepeat, Infinity);
          }
          desiredAction.fadeIn?.(0.15).play?.();
          this.mesh.userData.currentAction = desiredAction;
        }
        mixer.update(dt);
      } else {
        const visual = this.mesh.userData?.modelVisual;
        if (visual) {
          if (this.bobTimer > 0) {
            visual.position.y = Math.abs(Math.sin(this.bobTimer)) * 0.12;
          } else {
            visual.position.y = Math.sin(elapsed * 3) * 0.02;
          }
        }
      }

      // Companion ring rotation & pulsing
      const ring = this.mesh.userData?.ring;
      if (ring) {
        ring.rotation.z = elapsed * 1.5;
        const s = 1.0 + Math.sin(elapsed * 4) * 0.06;
        ring.scale.set(s, s, s);
      }
    }
  }

  resetPosition(pos) {
    if (!pos) return;
    this.position.x = pos.x - 1.2;
    this.position.y = pos.y || 0;
    this.position.z = pos.z - 1.2;
    this.state = 'follow';
    this.targetLoot = null;
    this.targetEnemy = null;
    if (this.mesh) {
      this.mesh.position.set(this.position.x, this.position.y, this.position.z);
    }
  }

  destroy() {
    this.removeMesh();
  }
}

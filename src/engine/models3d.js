import * as THREE from 'three';
import { getClass, defaultAppearance, sanitizeAppearance } from '../systems/classes.js';

const RARITY_COLORS = {
  normal: 0xd0d6e0,
  common: 0xd0d6e0,
  magic: 0x3b82f6,
  uncommon: 0x22c55e,
  rare: 0xfacc15,
  epic: 0xa855f7,
  unique: 0xf97316,
  legendary: 0xef4444,
  set: 0x10b981
};

const ELEMENT_COLORS = {
  physical: 0xe2e8f0,
  fire: 0xff5522,
  ice: 0x38bdf8,
  cold: 0x38bdf8,
  lightning: 0xfacc15,
  thunder: 0xfacc15,
  poison: 0x4ade80,
  dark: 0x9333ea,
  shadow: 0x9333ea,
  holy: 0xfef08a
};

function getRarityColor(rarity = 'normal') {
  const key = String(rarity || 'normal').toLowerCase();
  return RARITY_COLORS[key] ?? RARITY_COLORS.normal;
}

function getElementColor(element = 'physical') {
  const key = String(element || 'physical').toLowerCase();
  return ELEMENT_COLORS[key] ?? ELEMENT_COLORS.physical;
}

function enableShadows(root, cast = true, receive = true) {
  root.traverse((obj) => {
    if (obj.isMesh) {
      obj.castShadow = cast;
      obj.receiveShadow = receive;
    }
  });
  return root;
}

function attachHitFlashSupport(group) {
  const materials = [];
  group.traverse((child) => {
    if (child.isMesh && child.material && !child.userData.noFlash) {
      const mat = child.material.clone();
      child.material = mat;
      materials.push({
        mat,
        baseEmissive: mat.emissive ? mat.emissive.clone() : new THREE.Color(0x000000),
        baseIntensity: mat.emissiveIntensity ?? 0
      });
    }
  });

  group.userData.flashMaterials = materials;
  group.userData.hitFlashTimer = 0;

  group.userData.setHitFlash = (intensity = 1.0) => {
    group.userData.hitFlashTimer = Math.max(0, Math.min(1, Number(intensity) || 0));
    for (const entry of group.userData.flashMaterials) {
      if (!entry.mat.emissive) continue;
      if (group.userData.hitFlashTimer > 0.02) {
        entry.mat.emissive.setHex(0xffffff);
        entry.mat.emissiveIntensity = 0.85 * group.userData.hitFlashTimer;
      } else {
        entry.mat.emissive.copy(entry.baseEmissive);
        entry.mat.emissiveIntensity = entry.baseIntensity;
      }
    }
  };

  group.userData.triggerHitFlash = (duration = 0.14) => {
    group.userData.hitFlashDuration = duration;
    group.userData.setHitFlash(1.0);
  };
}

/**
 * Dispose geometries (and materials not in `keepMaterials`) of an Object3D subtree.
 */
export function disposeObject3D(obj, keepMaterials = null) {
  if (!obj) return;
  obj.traverse((child) => {
    if (child.geometry && typeof child.geometry.dispose === 'function') child.geometry.dispose();
    const mats = Array.isArray(child.material) ? child.material : child.material ? [child.material] : [];
    for (const m of mats) {
      if (m && (!keepMaterials || !keepMaterials.has(m)) && typeof m.dispose === 'function') m.dispose();
    }
  });
}

function clearGroup(group, keepMaterials = null) {
  if (!group) return;
  while (group.children.length > 0) {
    const child = group.children[0];
    group.remove(child);
    disposeObject3D(child, keepMaterials);
  }
}

const WEAPON_TYPES = ['sword', 'axe', 'mace', 'staff', 'bow', 'dagger'];

/**
 * Detect weapon archetype: item.subtype first, then name/type keywords.
 */
export function detectWeaponType(item = null) {
  const sub = String(item?.subtype || item?.subType || '').toLowerCase();
  if (WEAPON_TYPES.includes(sub)) return sub;
  const n = `${item?.name || ''} ${item?.type || ''} ${sub}`.toLowerCase();
  if (/bow\b|longbow|greatbow|shortbow|crossbow/.test(n)) return 'bow';
  if (/axe|cleaver|halberd/.test(n)) return 'axe';
  if (/mace|hammer|club|maul/.test(n)) return 'mace';
  if (/staff|stave|wand|rod\b|scepter|sceptre/.test(n)) return 'staff';
  if (/dagger|knife|dirk/.test(n)) return 'dagger';
  return 'sword';
}

function buildArrowMesh(color = 0xe5e7eb, headColor = 0x94a3b8, length = 0.7) {
  // Arrow pointing along local +X, nock at x = 0
  const g = new THREE.Group();
  g.name = 'Arrow';
  const shaftMat = new THREE.MeshStandardMaterial({ color: 0x8b5a2b, roughness: 0.6 });
  const headMat = new THREE.MeshStandardMaterial({ color: headColor, metalness: 0.8, roughness: 0.25 });
  const fletchMat = new THREE.MeshStandardMaterial({ color, roughness: 0.5, side: THREE.DoubleSide });
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, length, 5), shaftMat);
  shaft.rotation.z = Math.PI / 2;
  shaft.position.x = length * 0.5;
  g.add(shaft);
  const head = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.09, 5), headMat);
  head.rotation.z = -Math.PI / 2;
  head.position.x = length + 0.04;
  g.add(head);
  const fletchA = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.05, 0.004), fletchMat);
  fletchA.position.x = 0.07;
  const fletchB = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.004, 0.05), fletchMat);
  fletchB.position.x = 0.07;
  g.add(fletchA, fletchB);
  return g;
}

/**
 * Build a weapon 3D mesh based on item descriptor or tier/type
 */
export function createWeaponMesh(weaponItem = null) {
  const group = new THREE.Group();
  group.name = 'WeaponMesh';

  const wType = detectWeaponType(weaponItem);
  const nameStr = String(weaponItem?.name || weaponItem?.subtype || weaponItem?.subType || weaponItem?.type || 'sword').toLowerCase();
  const rarity = weaponItem?.rarity || 'normal';
  const level = Number(weaponItem?.level || weaponItem?.tier || 1);
  const element = weaponItem?.element || (nameStr.includes('fire') || nameStr.includes('flame') ? 'fire'
    : nameStr.includes('ice') || nameStr.includes('frost') ? 'ice'
    : nameStr.includes('volt') || nameStr.includes('thunder') || nameStr.includes('light') ? 'lightning'
    : nameStr.includes('venom') || nameStr.includes('poison') ? 'poison' : 'physical');

  const rarityColor = getRarityColor(rarity);
  const elemColor = getElementColor(element);
  const hasGlow = rarity !== 'normal' || element !== 'physical' || level >= 5;
  const glowColor = element !== 'physical' ? elemColor : rarityColor;

  group.userData.weaponType = wType;
  group.userData.spinParts = [];

  const hiltMat = new THREE.MeshStandardMaterial({
    color: 0x4a3219,
    roughness: 0.7,
    metalness: 0.2
  });
  const guardMat = new THREE.MeshStandardMaterial({
    color: level >= 8 ? 0xfbbf24 : level >= 4 ? 0x94a3b8 : 0xb45309,
    roughness: 0.35,
    metalness: 0.75
  });
  const bladeMat = new THREE.MeshStandardMaterial({
    color: level >= 10 ? rarityColor : 0xe2e8f0,
    roughness: 0.2,
    metalness: 0.88,
    emissive: new THREE.Color(hasGlow ? glowColor : 0x000000),
    emissiveIntensity: hasGlow ? 0.35 : 0.05
  });

  // Grip
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.04, 0.28, 8), hiltMat);
  grip.position.y = 0;
  group.add(grip);

  // Pommel (bows have none)
  if (wType !== 'bow') {
    const pommel = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 8), guardMat);
    pommel.position.y = -0.15;
    group.add(pommel);
  }

  if (wType === 'axe') {
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.036, 0.85, 8), hiltMat);
    shaft.position.y = 0.35;
    group.add(shaft);

    const axeHead = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.28, 0.06), bladeMat);
    axeHead.position.set(0.12, 0.65, 0);
    group.add(axeHead);

    const backSpike = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.2, 6), bladeMat);
    backSpike.rotation.z = Math.PI / 2;
    backSpike.position.set(-0.12, 0.65, 0);
    group.add(backSpike);

    if (level >= 6) {
      // Crescent edge for higher tiers
      const edge = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.025, 6, 14, Math.PI * 0.9), bladeMat);
      edge.rotation.z = -Math.PI * 0.45;
      edge.position.set(0.16, 0.65, 0);
      group.add(edge);
    }
  } else if (wType === 'mace') {
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.04, 0.75, 8), hiltMat);
    shaft.position.y = 0.3;
    group.add(shaft);

    const head = new THREE.Mesh(new THREE.DodecahedronGeometry(0.18, 0), bladeMat);
    head.position.y = 0.72;
    group.add(head);
  } else if (wType === 'staff') {
    const tierLvl = level >= 8 ? 2 : level >= 4 ? 1 : 0;
    const shaftLen = 1.15 + tierLvl * 0.12;
    const topY = -0.155 + shaftLen + 0.03;

    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.036, shaftLen, 8), hiltMat);
    shaft.position.y = -0.155 + shaftLen * 0.5;
    group.add(shaft);

    const crown = new THREE.Mesh(new THREE.TorusGeometry(0.11 + tierLvl * 0.02, 0.025, 8, 16), guardMat);
    crown.position.y = topY;
    group.add(crown);

    const orbMat = new THREE.MeshStandardMaterial({
      color: elemColor,
      emissive: new THREE.Color(hasGlow ? glowColor : elemColor),
      emissiveIntensity: 0.9 + tierLvl * 0.25,
      roughness: 0.1
    });
    const orb = new THREE.Mesh(new THREE.OctahedronGeometry(0.09 + tierLvl * 0.025, 0), orbMat);
    orb.position.y = topY;
    group.add(orb);
    group.userData.spinParts.push(orb);

    if (tierLvl >= 1) {
      // Prongs cradling the orb + a spinning ring
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2;
        const prong = new THREE.Mesh(new THREE.ConeGeometry(0.022, 0.2, 5), guardMat);
        prong.position.set(Math.cos(a) * 0.1, topY + 0.06, Math.sin(a) * 0.1);
        prong.rotation.set(Math.sin(a) * 0.45, 0, -Math.cos(a) * 0.45);
        group.add(prong);
      }
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.012, 6, 20), orbMat);
      ring.position.y = topY;
      ring.rotation.x = Math.PI / 2.4;
      group.add(ring);
      group.userData.spinParts.push(ring);
      // Collar wrap
      const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.08, 8), guardMat);
      collar.position.y = topY - 0.18;
      group.add(collar);
    }
    if (tierLvl >= 2) {
      // Grand halo + orbiting shards
      const halo = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.016, 6, 24), guardMat);
      halo.position.y = topY;
      group.add(halo);
      group.userData.spinParts.push(halo);
      const shardGroup = new THREE.Group();
      shardGroup.position.y = topY;
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2;
        const shard = new THREE.Mesh(new THREE.OctahedronGeometry(0.03, 0), orbMat);
        shard.position.set(Math.cos(a) * 0.3, Math.sin(a * 2) * 0.04, Math.sin(a) * 0.3);
        shardGroup.add(shard);
      }
      group.add(shardGroup);
      group.userData.spinParts.push(shardGroup);
    }
  } else if (wType === 'bow') {
    // Bow in local frame: grip at origin, limbs along +/-Y, belly facing +X (shooting direction), string at -X
    const isGreat = level >= 8 || /great|long|war/.test(nameStr);
    const R = isGreat ? 0.6 : 0.5;
    const arc = isGreat ? 2.1 : 2.0;
    const limbMat = new THREE.MeshStandardMaterial({
      color: level >= 8 ? 0x3b2410 : level >= 4 ? 0x5b3a1a : 0x8b5a2b,
      roughness: 0.55,
      metalness: level >= 8 ? 0.35 : 0.1,
      emissive: new THREE.Color(hasGlow ? glowColor : 0x000000),
      emissiveIntensity: hasGlow ? 0.25 : 0
    });
    const limb = new THREE.Mesh(new THREE.TorusGeometry(R, isGreat ? 0.03 : 0.025, 6, 24, arc), limbMat);
    limb.rotation.z = -arc / 2;
    limb.position.x = -R;
    group.add(limb);

    const tipY = R * Math.sin(arc / 2);
    const tipX = R * Math.cos(arc / 2) - R;
    for (const s of [1, -1]) {
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.032, 6, 6), guardMat);
      cap.position.set(tipX, s * tipY, 0);
      group.add(cap);
      if (level >= 4) {
        // Recurve tips
        const tip = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.12, 5), guardMat);
        tip.position.set(tipX + 0.04, s * (tipY + 0.03), 0);
        tip.rotation.z = s > 0 ? -0.9 : Math.PI + 0.9;
        group.add(tip);
      }
    }

    if (level >= 4) {
      const riser = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.3, 0.05), guardMat);
      riser.position.x = 0.02;
      group.add(riser);
    }
    if (rarity !== 'normal' && rarity !== 'common') {
      const gem = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.04, 0),
        new THREE.MeshStandardMaterial({ color: rarityColor, emissive: new THREE.Color(rarityColor), emissiveIntensity: 0.7 })
      );
      gem.position.set(0.05, 0.1, 0);
      group.add(gem);
    }

    // String (3 points: top tip, nocking point, bottom tip)
    const stringPos = new Float32Array([tipX, tipY, 0, tipX, 0, 0, tipX, -tipY, 0]);
    const stringGeo = new THREE.BufferGeometry();
    stringGeo.setAttribute('position', new THREE.BufferAttribute(stringPos, 3));
    const stringMat = new THREE.LineBasicMaterial({ color: hasGlow ? glowColor : 0xe5e7eb });
    const string = new THREE.Line(stringGeo, stringMat);
    group.add(string);

    // Nocked arrow (visible while drawing)
    const nocked = buildArrowMesh(hasGlow ? glowColor : 0xe5e7eb, level >= 8 ? 0xfbbf24 : 0x94a3b8, R * 1.25);
    nocked.visible = false;
    nocked.position.x = tipX;
    group.add(nocked);

    const maxPull = R * 0.75;
    group.userData.setDraw = (d = 0) => {
      const draw = Math.max(0, Math.min(1, Number(d) || 0));
      const x = tipX - draw * maxPull;
      const attr = stringGeo.getAttribute('position');
      attr.setX(1, x);
      attr.needsUpdate = true;
      nocked.visible = draw > 0.02;
      nocked.position.x = x;
    };
  } else {
    // Sword / Greatsword / Katana / Broadsword / Dagger
    const isGreat = nameStr.includes('great') || nameStr.includes('claymore') || nameStr.includes('giant') || level >= 12;
    const isDagger = wType === 'dagger' || nameStr.includes('dagger') || nameStr.includes('knife') || nameStr.includes('dirk');
    const bladeLen = isDagger ? 0.52 : isGreat ? 1.08 : 0.82;
    const bladeWidth = isDagger ? 0.08 : isGreat ? 0.16 : 0.11;

    // Crossguard
    const guard = new THREE.Mesh(new THREE.BoxGeometry(bladeWidth * 2.5, 0.06, 0.09), guardMat);
    guard.position.y = 0.15;
    group.add(guard);

    // Gem in crossguard
    const gem = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.045, 0),
      new THREE.MeshStandardMaterial({
        color: rarityColor,
        emissive: new THREE.Color(rarityColor),
        emissiveIntensity: 0.6
      })
    );
    gem.position.set(0, 0.15, 0.04);
    group.add(gem);

    // Blade body
    const blade = new THREE.Mesh(new THREE.BoxGeometry(bladeWidth, bladeLen, 0.032), bladeMat);
    blade.position.y = 0.18 + bladeLen * 0.5;
    group.add(blade);

    // Blade tip
    const tip = new THREE.Mesh(new THREE.ConeGeometry(bladeWidth * 0.58, 0.2, 4), bladeMat);
    tip.rotation.y = Math.PI / 4;
    tip.position.y = 0.18 + bladeLen + 0.09;
    group.add(tip);
  }

  enableShadows(group, true, false);
  return group;
}

/**
 * Build a 3D Shield mesh based on shield item
 */
export function createShieldMesh(shieldItem = null) {
  const group = new THREE.Group();
  group.name = 'ShieldMesh';

  const rarity = shieldItem?.rarity || 'normal';
  const level = Number(shieldItem?.level || shieldItem?.tier || 1);
  const rarityColor = getRarityColor(rarity);

  const rimMat = new THREE.MeshStandardMaterial({
    color: level >= 6 ? 0xfbbf24 : 0x94a3b8,
    roughness: 0.35,
    metalness: 0.8
  });
  const faceMat = new THREE.MeshStandardMaterial({
    color: level >= 8 ? rarityColor : level >= 4 ? 0x1e3a8a : 0x5c3a21,
    roughness: 0.45,
    metalness: 0.5,
    emissive: new THREE.Color(rarity !== 'normal' ? rarityColor : 0x000000),
    emissiveIntensity: rarity !== 'normal' ? 0.2 : 0
  });

  if (level >= 5 || rarity === 'epic' || rarity === 'unique' || rarity === 'rare') {
    // Heater / Kite Shield
    const plate = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.54, 0.05), faceMat);
    group.add(plate);

    const trimTop = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.06, 0.07), rimMat);
    trimTop.position.y = 0.25;
    group.add(trimTop);

    const boss = new THREE.Mesh(new THREE.OctahedronGeometry(0.08, 0), rimMat);
    boss.position.z = 0.04;
    group.add(boss);
  } else {
    // Round Buckler Shield
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.045, 14), faceMat);
    disc.rotation.x = Math.PI / 2;
    group.add(disc);

    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.028, 8, 16), rimMat);
    group.add(rim);

    const boss = new THREE.Mesh(new THREE.SphereGeometry(0.065, 8, 8), rimMat);
    boss.position.z = 0.03;
    group.add(boss);
  }

  enableShadows(group, true, true);
  return group;
}

// ----------------------------------------------------------------------------- hero helpers
const BOW_CARRY_Q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(
  new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 1, 0), new THREE.Vector3(-1, 0, 0)
));
const BOW_AIM_Q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(
  new THREE.Vector3(0, -1, 0), new THREE.Vector3(0, 0, 1), new THREE.Vector3(-1, 0, 0)
));

const MOUNT_BASE_X = Math.PI / 2.2;

function clamp01(v) {
  return Math.max(0, Math.min(1, Number(v) || 0));
}

/** Build a hair group for the given style. Meshes on top of the head are tagged `hairTop`. */
function buildHair(style, hairMat) {
  const g = new THREE.Group();
  g.name = `Hair_${style}`;
  const add = (geo, x, y, z, rx = 0, ry = 0, rz = 0, top = false) => {
    const m = new THREE.Mesh(geo, hairMat);
    m.position.set(x, y, z);
    m.rotation.set(rx, ry, rz);
    m.userData.hairTop = top;
    g.add(m);
    return m;
  };

  switch (style) {
    case 'bald':
      break;
    case 'short': {
      add(new THREE.BoxGeometry(0.36, 0.09, 0.36), 0, 0.33, -0.005, 0, 0, 0, true);
      add(new THREE.BoxGeometry(0.36, 0.2, 0.06), 0, 0.23, -0.16);
      add(new THREE.BoxGeometry(0.04, 0.12, 0.2), -0.175, 0.24, -0.04);
      add(new THREE.BoxGeometry(0.04, 0.12, 0.2), 0.175, 0.24, -0.04);
      add(new THREE.BoxGeometry(0.3, 0.05, 0.05), 0, 0.3, 0.165, 0.25, 0, 0, true);
      break;
    }
    case 'long': {
      add(new THREE.BoxGeometry(0.37, 0.12, 0.37), 0, 0.32, -0.01, 0, 0, 0, true);
      add(new THREE.BoxGeometry(0.38, 0.5, 0.08), 0, 0.1, -0.19);
      add(new THREE.BoxGeometry(0.06, 0.38, 0.16), -0.19, 0.13, 0.0);
      add(new THREE.BoxGeometry(0.06, 0.38, 0.16), 0.19, 0.13, 0.0);
      add(new THREE.BoxGeometry(0.34, 0.06, 0.05), 0, 0.29, 0.17, 0.2, 0, 0, true);
      break;
    }
    case 'ponytail': {
      add(new THREE.BoxGeometry(0.37, 0.12, 0.37), 0, 0.32, -0.01, 0, 0, 0, true);
      add(new THREE.BoxGeometry(0.36, 0.18, 0.06), 0, 0.24, -0.17);
      add(new THREE.BoxGeometry(0.3, 0.05, 0.05), 0, 0.29, 0.17, 0.2, 0, 0, true);
      add(new THREE.TorusGeometry(0.045, 0.015, 6, 10), 0, 0.27, -0.215);
      const tail = add(new THREE.ConeGeometry(0.06, 0.36, 7), 0, 0.1, -0.25, Math.PI + 0.35, 0, 0);
      tail.userData.ponytail = true;
      break;
    }
    case 'mohawk': {
      for (let i = 0; i < 5; i++) {
        const z = 0.14 - i * 0.075;
        const h = 0.16 + Math.sin((i / 4) * Math.PI) * 0.08;
        add(new THREE.BoxGeometry(0.07, h, 0.08), 0, 0.33 + h * 0.5 - 0.02, z, -0.15 + i * 0.05, 0, 0, true);
      }
      add(new THREE.BoxGeometry(0.08, 0.16, 0.05), 0, 0.22, -0.18);
      break;
    }
    case 'spiky':
    default: {
      add(new THREE.BoxGeometry(0.37, 0.16, 0.37), 0, 0.30, -0.01, 0, 0, 0, true);
      const spikePositions = [
        [0, 0.38, 0.12, 0.3, 0, 0],
        [-0.12, 0.36, 0.1, 0.25, 0, 0.3],
        [0.12, 0.36, 0.1, 0.25, 0, -0.3],
        [0, 0.39, -0.14, -0.45, 0, 0],
        [-0.15, 0.32, -0.1, -0.25, 0, 0.45],
        [0.15, 0.32, -0.1, -0.25, 0, -0.45]
      ];
      for (const [sx, sy, sz, rx, ry, rz] of spikePositions) {
        add(new THREE.ConeGeometry(0.085, 0.22, 5), sx, sy, sz, rx, ry, rz, true);
      }
      break;
    }
  }
  return g;
}

/**
 * Create articulated 3D Hero mesh with dynamic equipment, class look & procedural combat animations.
 * @param {object} equipment equipped items map ({weapon, shield, armor, helmet, boots, ...})
 * @param {{classId?: string, appearance?: object}} look hero class + appearance (optional)
 */
export function createHeroMesh(equipment = {}, look = {}) {
  const root = new THREE.Group();
  root.name = 'Hero';

  const bodyPivot = new THREE.Group();
  bodyPivot.position.y = 0.72;
  root.add(bodyPivot);

  // Shared, recolorable materials (owned by this hero instance)
  const skinMat = new THREE.MeshStandardMaterial({ color: 0xf5cba7, roughness: 0.6, metalness: 0.05 });
  const hairMat = new THREE.MeshStandardMaterial({ color: 0x2563eb, roughness: 0.45, metalness: 0.15 });
  const tunicMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.5, metalness: 0.45 });
  const armorTrimMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.3, metalness: 0.75 });
  const capeMat = new THREE.MeshStandardMaterial({
    color: 0xb91c1c,
    roughness: 0.65,
    metalness: 0.1,
    side: THREE.DoubleSide
  });
  const bootMat = new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.65, metalness: 0.25 });
  const beltMat = new THREE.MeshStandardMaterial({ color: 0x3f2305, roughness: 0.6 });
  const buckleMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.8, roughness: 0.2 });
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0x1e293b });
  const eyeWhiteMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const ringMat = new THREE.MeshBasicMaterial({
    color: 0x38bdf8,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.45
  });
  ringMat.userData = { noFlash: true };

  const sharedMaterials = new Set([skinMat, hairMat, tunicMat, armorTrimMat, capeMat, bootMat, beltMat, buckleMat, eyeMat, eyeWhiteMat, ringMat]);

  // Torso / Chestplate
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.54, 0.28), tunicMat);
  torso.position.y = 0.12;
  bodyPivot.add(torso);

  const chestPlate = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.34, 0.30), armorTrimMat);
  chestPlate.position.y = 0.18;
  bodyPivot.add(chestPlate);

  const belt = new THREE.Mesh(new THREE.BoxGeometry(0.49, 0.08, 0.30), beltMat);
  belt.position.y = -0.11;
  bodyPivot.add(belt);

  const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.09, 0.04), buckleMat);
  buckle.position.set(0, -0.11, 0.15);
  bodyPivot.add(buckle);

  // Cape pivot (children rebuilt per class)
  const capePivot = new THREE.Group();
  capePivot.position.set(0, 0.36, -0.15);
  bodyPivot.add(capePivot);

  // Class-specific body parts (rebuilt by setLook)
  const classGroup = new THREE.Group();
  classGroup.name = 'ClassParts';
  bodyPivot.add(classGroup);

  // Head Group
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 0.46, 0);
  bodyPivot.add(headGroup);

  const headMesh = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.34, 0.34), skinMat);
  headMesh.position.y = 0.16;
  headGroup.add(headMesh);

  // Eyes
  const leftEyeW = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.06, 0.02), eyeWhiteMat);
  leftEyeW.position.set(-0.08, 0.16, 0.17);
  const rightEyeW = new THREE.Mesh(leftEyeW.geometry.clone(), eyeWhiteMat);
  rightEyeW.position.set(0.08, 0.16, 0.17);
  const leftPupil = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.05, 0.025), eyeMat);
  leftPupil.position.set(-0.075, 0.16, 0.175);
  const rightPupil = new THREE.Mesh(leftPupil.geometry.clone(), eyeMat);
  rightPupil.position.set(0.075, 0.16, 0.175);
  headGroup.add(leftEyeW, rightEyeW, leftPupil, rightPupil);

  // Hair (rebuilt per style)
  const hairGroup = new THREE.Group();
  hairGroup.name = 'HairGroup';
  headGroup.add(hairGroup);

  // Class-specific head parts (wizard hat, war paint, beard...)
  const headClassGroup = new THREE.Group();
  headClassGroup.name = 'HeadClassParts';
  headGroup.add(headClassGroup);

  // Helmet (rebuilt per class, toggled when helmet equipped)
  const helmetGroup = new THREE.Group();
  helmetGroup.visible = false;
  headGroup.add(helmetGroup);

  // Right Arm (Weapon Arm)
  const rightArmPivot = new THREE.Group();
  rightArmPivot.rotation.order = 'YXZ'; // yaw swings the raised arm in body space
  rightArmPivot.position.set(-0.33, 0.30, 0);
  bodyPivot.add(rightArmPivot);

  const rightArmMesh = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.38, 0.14), skinMat);
  rightArmMesh.position.y = -0.16;
  rightArmPivot.add(rightArmMesh);

  const rightArmExtras = new THREE.Group();
  rightArmPivot.add(rightArmExtras);

  const weaponMount = new THREE.Group();
  weaponMount.position.set(0, -0.34, 0.08);
  weaponMount.rotation.x = Math.PI / 2.2;
  rightArmPivot.add(weaponMount);

  // Left Arm (Shield / Offhand / Bow Arm)
  const leftArmPivot = new THREE.Group();
  leftArmPivot.rotation.order = 'YXZ';
  leftArmPivot.position.set(0.33, 0.30, 0);
  bodyPivot.add(leftArmPivot);

  const leftArmMesh = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.38, 0.14), skinMat);
  leftArmMesh.position.y = -0.16;
  leftArmPivot.add(leftArmMesh);

  const leftArmExtras = new THREE.Group();
  leftArmPivot.add(leftArmExtras);

  const shieldMount = new THREE.Group();
  shieldMount.position.set(0.08, -0.24, 0.12);
  shieldMount.rotation.y = Math.PI / 3;
  leftArmPivot.add(shieldMount);

  const bowMount = new THREE.Group();
  bowMount.name = 'BowMount';
  bowMount.position.set(0.02, -0.36, 0);
  bowMount.quaternion.copy(BOW_CARRY_Q);
  leftArmPivot.add(bowMount);

  // Legs
  const leftLegPivot = new THREE.Group();
  leftLegPivot.position.set(0.13, -0.15, 0);
  bodyPivot.add(leftLegPivot);
  const leftLegMesh = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.44, 0.18), bootMat);
  leftLegMesh.position.y = -0.22;
  leftLegPivot.add(leftLegMesh);

  const rightLegPivot = new THREE.Group();
  rightLegPivot.position.set(-0.13, -0.15, 0);
  bodyPivot.add(rightLegPivot);
  const rightLegMesh = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.44, 0.18), bootMat);
  rightLegMesh.position.y = -0.22;
  rightLegPivot.add(rightLegMesh);

  // Ground ring / hero indicator
  const heroRing = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.52, 24), ringMat);
  heroRing.userData.noFlash = true;
  heroRing.rotation.x = -Math.PI / 2;
  heroRing.position.y = 0.03;
  root.add(heroRing);

  // ---------------------------------------------------------------- look state
  const lookState = {
    classId: 'knight',
    cls: getClass('knight'),
    appearance: defaultAppearance('knight'),
    equipped: equipment || {},
    hatParts: [],
    runeOrb: null,
    weaponType: 'sword'
  };

  root.userData.parts = {
    bodyPivot,
    torso,
    chestPlate,
    belt,
    buckle,
    capePivot,
    classGroup,
    headGroup,
    headMesh,
    hairGroup,
    headClassGroup,
    helmetGroup,
    rightArmPivot,
    leftArmPivot,
    rightArmMesh,
    leftArmMesh,
    weaponMount,
    shieldMount,
    bowMount,
    leftLegPivot,
    rightLegPivot,
    heroRing,
    skinMat,
    hairMat,
    tunicMat,
    armorTrimMat,
    capeMat,
    bootMat,
    eyeMat,
    helmDome: null
  };

  // ---------------------------------------------------------------- hit flash (shared materials, no cloning)
  let flashList = [];
  const refreshFlashMaterials = () => {
    const set = new Set();
    root.traverse((child) => {
      if (!child.isMesh || child.userData.noFlash) return;
      const mats = Array.isArray(child.material) ? child.material : [child.material];
      for (const m of mats) {
        if (m && m.emissive && !m.userData?.noFlash) set.add(m);
      }
    });
    flashList = [...set];
    for (const m of flashList) {
      if (!m.userData.flashBase) {
        m.userData.flashBase = { emissive: m.emissive.clone(), intensity: m.emissiveIntensity ?? 0 };
      }
    }
    root.userData.flashMaterials = flashList.map((m) => ({
      mat: m,
      baseEmissive: m.userData.flashBase.emissive,
      baseIntensity: m.userData.flashBase.intensity
    }));
  };

  root.userData.hitFlashTimer = 0;
  root.userData.setHitFlash = (intensity = 1.0) => {
    root.userData.hitFlashTimer = clamp01(intensity);
    const on = root.userData.hitFlashTimer > 0.02;
    for (const m of flashList) {
      if (!m.emissive || !m.userData.flashBase) continue;
      if (on) {
        m.emissive.setHex(0xffffff);
        m.emissiveIntensity = 0.85 * root.userData.hitFlashTimer;
      } else {
        m.emissive.copy(m.userData.flashBase.emissive);
        m.emissiveIntensity = m.userData.flashBase.intensity;
      }
    }
  };
  root.userData.triggerHitFlash = (duration = 0.14) => {
    root.userData.hitFlashDuration = duration;
    root.userData.setHitFlash(1.0);
  };

  // ---------------------------------------------------------------- class part builders
  const ownMat = (params) => new THREE.MeshStandardMaterial(params);
  const addTo = (parent, geo, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.rotation.set(rx, ry, rz);
    parent.add(m);
    return m;
  };

  const buildKnight = () => {
    const pauldronGeo = () => new THREE.SphereGeometry(0.13, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.65);
    addTo(classGroup, pauldronGeo(), armorTrimMat, -0.31, 0.34, 0, 0, 0, 0.3);
    addTo(classGroup, pauldronGeo(), armorTrimMat, 0.31, 0.34, 0, 0, 0, -0.3);
    addTo(capePivot, new THREE.BoxGeometry(0.44, 0.72, 0.03), capeMat, 0, -0.34, -0.02, 0.16);

    // Crested helm
    const dome = addTo(helmetGroup, new THREE.BoxGeometry(0.39, 0.26, 0.39), armorTrimMat, 0, 0.27, 0);
    root.userData.parts.helmDome = dome;
    const crestMat = ownMat({ color: 0xfacc15, metalness: 0.85, roughness: 0.2 });
    addTo(helmetGroup, new THREE.BoxGeometry(0.06, 0.16, 0.42), crestMat, 0, 0.38, 0);
  };

  const buildAxeman = () => {
    torso.scale.set(1.22, 1.05, 1.18);
    chestPlate.scale.set(1.18, 0.75, 1.12);
    chestPlate.position.y = 0.24;
    belt.scale.set(1.2, 1.3, 1.15);
    buckle.position.z = 0.175;
    rightArmPivot.position.x = -0.4;
    leftArmPivot.position.x = 0.4;
    rightArmMesh.scale.set(1.4, 1.06, 1.4);
    leftArmMesh.scale.set(1.4, 1.06, 1.4);

    const furMat = ownMat({ color: 0x6b4f3a, roughness: 0.95, metalness: 0 });
    const leatherMat = ownMat({ color: 0x4a2c12, roughness: 0.7, metalness: 0.1 });
    // Fur mantle ring around the shoulders + shoulder tufts
    const mantle = addTo(classGroup, new THREE.TorusGeometry(0.26, 0.1, 8, 16), furMat, 0, 0.38, -0.02, Math.PI / 2);
    mantle.scale.set(1.35, 1.0, 1.0);
    addTo(classGroup, new THREE.DodecahedronGeometry(0.14, 0), furMat, -0.36, 0.38, 0);
    addTo(classGroup, new THREE.DodecahedronGeometry(0.14, 0), furMat, 0.36, 0.38, 0);
    // Diagonal chest strap
    addTo(classGroup, new THREE.BoxGeometry(0.08, 0.66, 0.34), leatherMat, 0, 0.1, 0.005, 0, 0, 0.65);
    // Short cape
    addTo(capePivot, new THREE.BoxGeometry(0.52, 0.36, 0.03), capeMat, 0, -0.16, -0.03, 0.12);
    // Bracers
    addTo(rightArmExtras, new THREE.BoxGeometry(0.21, 0.12, 0.21), leatherMat, 0, -0.28, 0);
    addTo(leftArmExtras, new THREE.BoxGeometry(0.21, 0.12, 0.21), leatherMat, 0, -0.28, 0);

    // War paint (stripe across the eyes + chin mark) & beard
    const paintMat = ownMat({ color: 0x991b1b, roughness: 0.8 });
    addTo(headClassGroup, new THREE.BoxGeometry(0.348, 0.03, 0.01), paintMat, 0, 0.115, 0.172);
    addTo(headClassGroup, new THREE.BoxGeometry(0.03, 0.08, 0.01), paintMat, -0.11, 0.22, 0.172);
    addTo(headClassGroup, new THREE.BoxGeometry(0.03, 0.08, 0.01), paintMat, 0.11, 0.22, 0.172);
    addTo(headClassGroup, new THREE.BoxGeometry(0.26, 0.1, 0.06), hairMat, 0, 0.0, 0.16);
    addTo(headClassGroup, new THREE.BoxGeometry(0.14, 0.08, 0.05), hairMat, 0, -0.07, 0.15);

    // Horned helm
    const dome = addTo(helmetGroup, new THREE.BoxGeometry(0.39, 0.24, 0.39), armorTrimMat, 0, 0.27, 0);
    root.userData.parts.helmDome = dome;
    addTo(helmetGroup, new THREE.BoxGeometry(0.06, 0.16, 0.04), armorTrimMat, 0, 0.15, 0.195);
    const hornMat = ownMat({ color: 0xf5f0e1, roughness: 0.5, metalness: 0.05 });
    for (const s of [-1, 1]) {
      addTo(helmetGroup, new THREE.ConeGeometry(0.06, 0.22, 7), hornMat, s * 0.27, 0.34, 0, 0, 0, -s * 1.15);
      addTo(helmetGroup, new THREE.ConeGeometry(0.04, 0.18, 7), hornMat, s * 0.37, 0.48, 0, 0, 0, -s * 0.25);
    }
  };

  const buildWizard = () => {
    chestPlate.visible = false;
    buckle.visible = false;
    belt.visible = false;
    torso.scale.set(0.96, 1, 1);

    // Long robe skirt over the legs
    addTo(classGroup, new THREE.CylinderGeometry(0.25, 0.38, 0.6, 14), tunicMat, 0, -0.41, 0);
    addTo(classGroup, new THREE.TorusGeometry(0.375, 0.022, 6, 20), armorTrimMat, 0, -0.7, 0, Math.PI / 2);
    // Robe collar / front trim
    addTo(classGroup, new THREE.BoxGeometry(0.08, 0.5, 0.02), armorTrimMat, 0, 0.12, 0.145);
    addTo(classGroup, new THREE.TorusGeometry(0.17, 0.04, 6, 14), tunicMat, 0, 0.4, 0, Math.PI / 2);

    // Glowing sash
    const sashColor = lookState.cls?.color ?? 0xa855f7;
    const sashMat = ownMat({ color: sashColor, emissive: new THREE.Color(sashColor), emissiveIntensity: 0.75, roughness: 0.35 });
    addTo(classGroup, new THREE.BoxGeometry(0.47, 0.08, 0.3), sashMat, 0, -0.11, 0);
    addTo(classGroup, new THREE.BoxGeometry(0.07, 0.26, 0.02), sashMat, 0.12, -0.25, 0.155, 0, 0, 0.12);

    // Cloak
    addTo(capePivot, new THREE.BoxGeometry(0.46, 0.92, 0.03), capeMat, 0, -0.44, -0.02, 0.1);

    // Robe sleeves (flared cuffs)
    rightArmMesh.material = tunicMat;
    leftArmMesh.material = tunicMat;
    addTo(rightArmExtras, new THREE.CylinderGeometry(0.08, 0.12, 0.14, 8), tunicMat, 0, -0.32, 0);
    addTo(leftArmExtras, new THREE.CylinderGeometry(0.08, 0.12, 0.14, 8), tunicMat, 0, -0.32, 0);
    addTo(rightArmExtras, new THREE.BoxGeometry(0.1, 0.06, 0.1), skinMat, 0, -0.41, 0);
    addTo(leftArmExtras, new THREE.BoxGeometry(0.1, 0.06, 0.1), skinMat, 0, -0.41, 0);

    // Floating rune orb near the left shoulder
    const orbGroup = new THREE.Group();
    orbGroup.position.set(0.5, 0.62, -0.12);
    const orbMat = ownMat({ color: sashColor, emissive: new THREE.Color(sashColor), emissiveIntensity: 1.2, roughness: 0.1, transparent: true, opacity: 0.92 });
    addTo(orbGroup, new THREE.IcosahedronGeometry(0.075, 0), orbMat);
    const runeRing = addTo(orbGroup, new THREE.TorusGeometry(0.12, 0.01, 6, 20), orbMat, 0, 0, 0, Math.PI / 2.5);
    runeRing.userData.spin = true;
    classGroup.add(orbGroup);
    lookState.runeOrb = orbGroup;

    // Pointed wizard hat (bent tip)
    const hatMat = capeMat;
    const brim = addTo(headClassGroup, new THREE.CylinderGeometry(0.33, 0.33, 0.03, 18), hatMat, 0, 0.33, 0);
    const band = addTo(headClassGroup, new THREE.CylinderGeometry(0.19, 0.2, 0.06, 14), armorTrimMat, 0, 0.37, 0);
    const cone1 = addTo(headClassGroup, new THREE.CylinderGeometry(0.11, 0.19, 0.3, 14), hatMat, 0, 0.52, -0.01, -0.12);
    const cone2 = addTo(headClassGroup, new THREE.ConeGeometry(0.11, 0.3, 12), hatMat, 0, 0.78, -0.08, -0.5);
    lookState.hatParts = [brim, band, cone1, cone2];

    // Arcane circlet helm
    const dome = addTo(helmetGroup, new THREE.BoxGeometry(0.38, 0.22, 0.38), armorTrimMat, 0, 0.27, 0);
    root.userData.parts.helmDome = dome;
    const gemMat = ownMat({ color: sashColor, emissive: new THREE.Color(sashColor), emissiveIntensity: 0.9 });
    addTo(helmetGroup, new THREE.OctahedronGeometry(0.05, 0), gemMat, 0, 0.27, 0.2);
    addTo(helmetGroup, new THREE.ConeGeometry(0.05, 0.2, 6), armorTrimMat, 0, 0.47, 0);
  };

  const buildArcher = () => {
    const leatherMat = ownMat({ color: 0x7c4a1e, roughness: 0.7, metalness: 0.1 });
    const darkLeather = ownMat({ color: 0x4a2c12, roughness: 0.75, metalness: 0.05 });
    chestPlate.material = leatherMat;
    chestPlate.scale.set(0.98, 0.85, 0.98);

    // Small leather pauldrons
    const pg = () => new THREE.SphereGeometry(0.09, 8, 6, 0, Math.PI * 2, 0, Math.PI * 0.6);
    addTo(classGroup, pg(), leatherMat, -0.3, 0.33, 0, 0, 0, 0.3);
    addTo(classGroup, pg(), leatherMat, 0.3, 0.33, 0, 0, 0, -0.3);

    // Hood (down, resting behind the head)
    const hood = addTo(classGroup, new THREE.SphereGeometry(0.18, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.55), capeMat, 0, 0.47, -0.23, -2.1);
    hood.scale.set(1.05, 0.8, 0.9);
    addTo(classGroup, new THREE.ConeGeometry(0.07, 0.18, 6), capeMat, 0, 0.3, -0.29, Math.PI + 0.3);

    // Scarf around the neck + trailing tail
    addTo(classGroup, new THREE.TorusGeometry(0.16, 0.05, 6, 14), capeMat, 0, 0.42, 0.01, Math.PI / 2);
    addTo(classGroup, new THREE.BoxGeometry(0.09, 0.26, 0.03), capeMat, 0.1, 0.27, 0.17, 0.1, 0, 0.2);

    // Quiver with arrows on the back
    const quiver = new THREE.Group();
    quiver.position.set(0.12, 0.14, -0.24);
    quiver.rotation.z = 0.4;
    addTo(quiver, new THREE.CylinderGeometry(0.075, 0.065, 0.5, 10), darkLeather);
    addTo(quiver, new THREE.TorusGeometry(0.075, 0.012, 6, 12), leatherMat, 0, 0.24, 0, Math.PI / 2);
    const shaftMat = ownMat({ color: 0x8b5a2b, roughness: 0.6 });
    const fletchMat = ownMat({ color: 0xf8fafc, roughness: 0.5, side: THREE.DoubleSide });
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      const ox = Math.cos(a) * 0.035;
      const oz = Math.sin(a) * 0.035;
      addTo(quiver, new THREE.CylinderGeometry(0.008, 0.008, 0.22, 4), shaftMat, ox, 0.33, oz);
      addTo(quiver, new THREE.BoxGeometry(0.004, 0.08, 0.04), fletchMat, ox, 0.42, oz, 0, a, 0);
    }
    classGroup.add(quiver);
    // Quiver strap
    addTo(classGroup, new THREE.BoxGeometry(0.05, 0.62, 0.32), darkLeather, 0, 0.12, 0, 0, 0, -0.6);

    // Leather bracers
    addTo(leftArmExtras, new THREE.BoxGeometry(0.16, 0.14, 0.16), leatherMat, 0, -0.27, 0);
    addTo(rightArmExtras, new THREE.BoxGeometry(0.16, 0.1, 0.16), leatherMat, 0, -0.29, 0);

    // Leather cap with feather (helmet)
    const dome = addTo(helmetGroup, new THREE.BoxGeometry(0.38, 0.18, 0.38), armorTrimMat, 0, 0.3, 0);
    root.userData.parts.helmDome = dome;
    addTo(helmetGroup, new THREE.BoxGeometry(0.4, 0.03, 0.18), armorTrimMat, 0, 0.22, 0.2, 0.2);
    const featherMat = ownMat({ color: 0x22c55e, roughness: 0.5, side: THREE.DoubleSide });
    addTo(helmetGroup, new THREE.BoxGeometry(0.02, 0.26, 0.07), featherMat, 0.2, 0.42, -0.08, -0.5, 0, -0.3);
  };

  const resetClassBase = () => {
    clearGroup(classGroup, sharedMaterials);
    clearGroup(capePivot, sharedMaterials);
    clearGroup(headClassGroup, sharedMaterials);
    clearGroup(helmetGroup, sharedMaterials);
    clearGroup(rightArmExtras, sharedMaterials);
    clearGroup(leftArmExtras, sharedMaterials);
    // Restore chestPlate material if it was swapped for a class-owned one
    if (chestPlate.material !== armorTrimMat) {
      if (!sharedMaterials.has(chestPlate.material)) chestPlate.material.dispose();
      chestPlate.material = armorTrimMat;
    }
    lookState.hatParts = [];
    lookState.runeOrb = null;
    root.userData.parts.helmDome = null;

    torso.scale.set(1, 1, 1);
    chestPlate.scale.set(1, 1, 1);
    chestPlate.position.y = 0.18;
    chestPlate.visible = true;
    belt.scale.set(1, 1, 1);
    belt.visible = true;
    buckle.visible = true;
    buckle.position.set(0, -0.11, 0.15);
    rightArmPivot.position.set(-0.33, 0.30, 0);
    leftArmPivot.position.set(0.33, 0.30, 0);
    rightArmMesh.scale.set(1, 1, 1);
    leftArmMesh.scale.set(1, 1, 1);
    rightArmMesh.material = skinMat;
    leftArmMesh.material = skinMat;
  };

  const rebuildHair = () => {
    clearGroup(hairGroup, sharedMaterials);
    hairGroup.add(buildHair(lookState.appearance.hairStyle || 'spiky', hairMat));
  };

  // Tint helper: keep the chosen outfit color, nudge it slightly toward the armor tier
  const applyArmorTint = () => {
    const armor = lookState.equipped?.armor || null;
    const outfit = new THREE.Color(lookState.appearance.outfit ?? 0x334155);
    if (armor) {
      const lvl = Number(armor.level || armor.tier || 1);
      const tierCol = new THREE.Color(lvl >= 8 ? 0x1e1b4b : lvl >= 4 ? 0x1e3a8a : 0x334155);
      tunicMat.color.copy(outfit).lerp(tierCol, 0.18);
      armorTrimMat.color.setHex(armor.rarity && armor.rarity !== 'normal' && armor.rarity !== 'common'
        ? getRarityColor(armor.rarity)
        : lvl >= 8 ? 0xfbbf24 : 0xcbd5e1);
    } else {
      tunicMat.color.copy(outfit);
      armorTrimMat.color.setHex(0x94a3b8);
    }
  };

  const updateHatVisibility = () => {
    const helmetOn = helmetGroup.visible;
    const hatOn = lookState.hatParts.length > 0 && !helmetOn;
    for (const p of lookState.hatParts) p.visible = hatOn;
    hairGroup.visible = !helmetOn;
    // Hide the top of the hair under the hat so spikes do not poke through
    hairGroup.traverse((c) => {
      if (c.isMesh && c.userData.hairTop) c.visible = !hatOn;
    });
  };

  root.userData.updateEquipment = (equipped = {}) => {
    if (root.userData.hitFlashTimer > 0) root.userData.setHitFlash(0);
    lookState.equipped = equipped || {};
    const cls = lookState.cls;
    const weapon = equipped?.weapon || null;
    const shield = equipped?.shield || equipped?.offhand || null;
    const helmet = equipped?.helmet || null;
    const boots = equipped?.boots || null;

    // Weapon (fallback: the class' signature weapon type)
    clearGroup(weaponMount);
    clearGroup(bowMount);
    const weaponDesc = weapon || { subtype: cls?.weapons?.[0] || 'sword', level: 1, rarity: 'normal' };
    const wType = detectWeaponType(weaponDesc);
    lookState.weaponType = wType;
    const wMesh = createWeaponMesh(weaponDesc);
    root.userData.weaponMesh = wMesh;
    if (wType === 'bow') {
      bowMount.add(wMesh);
    } else {
      weaponMount.add(wMesh);
      weaponMount.position.set(0, -0.34, wType === 'staff' ? 0.1 : 0.08);
      weaponMount.rotation.set(wType === 'staff' ? 0.4 : MOUNT_BASE_X, 0, 0);
    }

    // Shield (never for two-handed / shieldless classes)
    clearGroup(shieldMount);
    const canShield = cls ? (cls.shield && !cls.twoHanded) : true;
    if (shield && canShield && wType !== 'bow') {
      shieldMount.add(createShieldMesh(shield));
    }

    applyArmorTint();

    // Helmet
    helmetGroup.visible = Boolean(helmet);
    updateHatVisibility();

    // Boots
    if (boots) {
      const rarityCol = getRarityColor(boots.rarity);
      bootMat.color.setHex(boots.rarity && boots.rarity !== 'normal' ? rarityCol : 0x78350f);
    } else {
      bootMat.color.setHex(0x451a03);
    }

    enableShadows(weaponMount, true, false);
    enableShadows(bowMount, true, false);
    refreshFlashMaterials();
  };

  /**
   * Apply hero class + appearance. Rebuilds class parts and recolors shared materials.
   */
  root.userData.setLook = ({ classId, appearance } = {}) => {
    if (root.userData.hitFlashTimer > 0) root.userData.setHitFlash(0);
    const cls = getClass(classId || lookState.classId);
    const app = sanitizeAppearance(appearance || (cls.id === lookState.classId ? lookState.appearance : null), cls.id);
    lookState.classId = cls.id;
    lookState.cls = cls;
    lookState.appearance = app;
    root.userData.classId = cls.id;
    root.userData.attackStyle = cls.attackStyle || 'melee';
    root.userData.appearance = { ...app };

    // Colors
    skinMat.color.setHex(app.skin);
    hairMat.color.setHex(app.hairColor);
    capeMat.color.setHex(app.cape);
    eyeMat.color.setHex(app.eyes);
    ringMat.color.setHex(cls.color ?? 0x38bdf8);

    // Class parts
    resetClassBase();
    if (cls.id === 'axeman') buildAxeman();
    else if (cls.id === 'wizard') buildWizard();
    else if (cls.id === 'archer') buildArcher();
    else buildKnight();

    rebuildHair();
    enableShadows(bodyPivot, true, true);
    root.userData.updateEquipment(lookState.equipped);
  };

  root.userData.getLook = () => ({ classId: lookState.classId, appearance: { ...lookState.appearance } });

  // Initialize look + equipment
  root.userData.attackStyle = 'melee';
  lookState.equipped = equipment || {};
  root.userData.setLook({ classId: look?.classId || 'knight', appearance: look?.appearance || null });

  // ---------------------------------------------------------------- animation
  root.userData.animate = (state = 'idle', time = 0, dt = 0.016, comboStep = 0, attackProgress = 0) => {
    if (root.userData.hitFlashTimer > 0) {
      root.userData.hitFlashTimer = Math.max(0, root.userData.hitFlashTimer - dt * 6);
      root.userData.setHitFlash(root.userData.hitFlashTimer);
    }

    const style = root.userData.attackStyle || 'melee';
    const isBow = lookState.weaponType === 'bow';

    // Reset base rotations
    bodyPivot.rotation.set(0, 0, 0);
    headGroup.rotation.set(0, 0, 0);
    rightArmPivot.rotation.y = 0;
    leftArmPivot.rotation.y = 0;
    rightArmPivot.rotation.z = 0;
    leftArmPivot.rotation.z = 0;

    let bowAim = 0;
    let bowDraw = 0;
    let staffLift = 0;

    if (state === 'walk' || state === 'run' || state === 'move') {
      const walkCycle = time * 11;
      leftLegPivot.rotation.x = Math.sin(walkCycle) * 0.72;
      rightLegPivot.rotation.x = -Math.sin(walkCycle) * 0.72;
      leftArmPivot.rotation.x = -Math.sin(walkCycle) * 0.55;
      rightArmPivot.rotation.x = Math.sin(walkCycle) * 0.55;
      if (style === 'melee_heavy') {
        // Two-handed carry: axe held across the body
        rightArmPivot.rotation.x = -0.55 + Math.sin(walkCycle) * 0.12;
        leftArmPivot.rotation.x = -0.6 + Math.sin(walkCycle) * 0.12;
        leftArmPivot.rotation.y = -0.6;
      } else if (style === 'magic_bolt') {
        rightArmPivot.rotation.x = -0.25 + Math.sin(walkCycle) * 0.2;
      }
      bodyPivot.position.y = 0.72 + Math.abs(Math.sin(walkCycle)) * 0.06;
      bodyPivot.rotation.x = 0.1;
      capePivot.rotation.x = 0.35 + Math.sin(walkCycle * 2) * 0.12;
    } else if (state === 'attack' && style === 'melee_heavy') {
      // Heavy two-handed axe swings
      const p = clamp01(attackProgress);
      bodyPivot.position.y = 0.68;
      leftLegPivot.rotation.x = -0.45;
      rightLegPivot.rotation.x = 0.45;
      if (comboStep === 3) {
        // Overhead slam: wind up high, then crash down
        const e = p < 0.4 ? 0 : 1 - Math.pow(1 - (p - 0.4) / 0.6, 3);
        const wind = p < 0.4 ? p / 0.4 : 1;
        const armX = -1.2 - wind * 1.8 + e * 2.9;
        bodyPivot.rotation.x = -0.3 * wind + e * 0.75;
        rightArmPivot.rotation.x = armX;
        leftArmPivot.rotation.x = armX;
        leftArmPivot.rotation.y = -0.55;
        rightArmPivot.rotation.y = 0.15;
        bodyPivot.position.y = 0.68 - e * 0.08;
      } else {
        // Horizontal cleave (stage 1 right->left, stage 2 backhand left->right)
        const dir = comboStep === 2 ? -1 : 1;
        const e = p < 0.25 ? -0.25 * (p / 0.25) : (p - 0.25) / 0.75;
        bodyPivot.rotation.y = dir * (1.15 - e * 2.6);
        rightArmPivot.rotation.x = -1.3;
        leftArmPivot.rotation.x = -1.3;
        leftArmPivot.rotation.y = -0.7;
        rightArmPivot.rotation.z = -0.25 * dir;
        bodyPivot.rotation.z = 0.08 * dir;
      }
      capePivot.rotation.x = 0.6;
    } else if (state === 'attack') {
      const p = clamp01(attackProgress);
      const swing = Math.sin(p * Math.PI);
      bodyPivot.position.y = 0.70;
      leftLegPivot.rotation.x = -0.35;
      rightLegPivot.rotation.x = 0.35;

      if (comboStep === 1) {
        // Horizontal slash right-to-left
        bodyPivot.rotation.y = (p - 0.5) * 1.4;
        rightArmPivot.rotation.x = -1.2;
        rightArmPivot.rotation.z = -0.8 + p * 1.8;
        leftArmPivot.rotation.x = -0.4;
      } else if (comboStep === 2) {
        // Backhand upward cleave
        bodyPivot.rotation.y = (0.5 - p) * 1.5;
        rightArmPivot.rotation.x = -0.4 - swing * 1.6;
        rightArmPivot.rotation.z = 0.7 - p * 1.6;
        leftArmPivot.rotation.x = -0.5;
      } else {
        // Heavy overhead finisher slam
        bodyPivot.rotation.x = -0.3 + p * 0.65;
        rightArmPivot.rotation.x = -2.5 + p * 2.9;
        rightArmPivot.rotation.z = -0.15;
        leftArmPivot.rotation.x = -0.8;
      }
      capePivot.rotation.x = 0.55;
    } else if (state === 'shoot') {
      // Bow drawn: bow arm extended forward, string hand pulled back by progress
      const p = clamp01(attackProgress);
      const release = 0.72;
      bowDraw = p < release ? Math.sin((p / release) * Math.PI * 0.5) : 0;
      const recoil = p < release ? 0 : (1 - (p - release) / (1 - release));
      bowAim = 1;
      const twist = -0.5;
      bodyPivot.rotation.y = twist;
      bodyPivot.position.y = 0.70;
      leftLegPivot.rotation.x = -0.3;
      rightLegPivot.rotation.x = 0.3;
      leftArmPivot.rotation.x = -Math.PI / 2 - recoil * 0.15;
      leftArmPivot.rotation.y = -twist;
      rightArmPivot.rotation.x = -Math.PI / 2 + 0.05 + recoil * 0.25;
      rightArmPivot.rotation.y = -twist + 0.2 + bowDraw * 1.1 - recoil * 0.4;
      headGroup.rotation.y = -twist * 0.8;
      capePivot.rotation.x = 0.3;
    } else if (state === 'cast') {
      // Staff raised forward, other hand thrust out
      const p = clamp01(attackProgress);
      const thrust = p < 0.4 ? Math.sin((p / 0.4) * Math.PI * 0.5) : 1 - ((p - 0.4) / 0.6) * 0.6;
      const big = comboStep === 3;
      bodyPivot.position.y = 0.70 + (big ? thrust * 0.04 : 0);
      bodyPivot.rotation.x = 0.1 * thrust;
      bodyPivot.rotation.y = -0.25 * thrust;
      leftLegPivot.rotation.x = -0.35 * thrust;
      rightLegPivot.rotation.x = 0.3 * thrust;
      rightArmPivot.rotation.x = -0.3 - (big ? 2.2 : 1.05) * thrust;
      rightArmPivot.rotation.z = -0.15 * thrust;
      leftArmPivot.rotation.x = -0.2 - 1.35 * thrust;
      leftArmPivot.rotation.y = 0.25 * thrust;
      staffLift = (big ? 1.9 : 0.85) * thrust;
      capePivot.rotation.x = 0.25 + 0.35 * thrust;
    } else if (state === 'skill' || state === 'whirlwind') {
      bodyPivot.rotation.y = time * 22;
      rightArmPivot.rotation.x = -Math.PI / 2;
      rightArmPivot.rotation.z = -0.9;
      leftArmPivot.rotation.x = -Math.PI / 2;
      leftArmPivot.rotation.z = 0.9;
      capePivot.rotation.x = 0.8;
    } else if (state === 'dash' || state === 'dodge') {
      bodyPivot.rotation.x = 0.55;
      bodyPivot.position.y = 0.62;
      leftLegPivot.rotation.x = -0.6;
      rightLegPivot.rotation.x = 0.4;
      rightArmPivot.rotation.x = 0.6;
      leftArmPivot.rotation.x = -0.7;
      capePivot.rotation.x = 0.95;
    } else if (state === 'block') {
      bodyPivot.rotation.y = -0.35;
      leftArmPivot.rotation.x = -1.1;
      leftArmPivot.rotation.y = -0.6;
      rightArmPivot.rotation.x = -0.3;
      bodyPivot.position.y = 0.68;
    } else {
      // Idle breathing
      const breath = Math.sin(time * 3.2);
      bodyPivot.position.y = 0.72 + breath * 0.02;
      leftLegPivot.rotation.x = 0;
      rightLegPivot.rotation.x = 0;
      rightArmPivot.rotation.x = -0.15 + breath * 0.05;
      rightArmPivot.rotation.z = -0.08;
      leftArmPivot.rotation.x = -0.15 - breath * 0.05;
      leftArmPivot.rotation.z = 0.08;
      if (style === 'melee_heavy') {
        rightArmPivot.rotation.x = -0.45 + breath * 0.04;
        leftArmPivot.rotation.x = -0.5 + breath * 0.04;
        leftArmPivot.rotation.y = -0.65;
      } else if (style === 'magic_bolt') {
        rightArmPivot.rotation.x = -0.3 + breath * 0.04;
      } else if (isBow) {
        leftArmPivot.rotation.x = -0.25 - breath * 0.04;
      }
      capePivot.rotation.x = 0.16 + Math.sin(time * 2.4) * 0.05;
    }

    // Bow orientation (carry <-> aim) and string draw
    if (isBow) {
      bowMount.quaternion.copy(BOW_CARRY_Q).slerp(BOW_AIM_Q, bowAim);
      root.userData.weaponMesh?.userData?.setDraw?.(bowDraw);
    }

    // Keep a staff upright-ish while the arm is raised
    if (lookState.weaponType === 'staff') {
      weaponMount.rotation.x = 0.4 + staffLift;
    }

    // Spin staff crystals / ornaments
    const spin = root.userData.weaponMesh?.userData?.spinParts;
    if (spin && spin.length) {
      for (let i = 0; i < spin.length; i++) spin[i].rotation.y = time * (1.5 + i * 0.8) * (i % 2 ? -1 : 1);
    }

    // Floating rune orb
    const orb = lookState.runeOrb;
    if (orb) {
      const casting = state === 'cast';
      orb.position.y = 0.62 + Math.sin(time * 2.6) * 0.06 + (casting ? 0.08 : 0);
      orb.rotation.y = time * (casting ? 6 : 1.6);
      orb.rotation.x = Math.sin(time * 1.3) * 0.3;
    }
  };

  enableShadows(root, true, true);
  heroRing.castShadow = false;
  return root;
}

/**
 * Build a projectile mesh for player basic attacks / skills.
 * kind: 'arrow' | 'bolt' | 'orb' (default). Mesh faces local +Z (use rotation.y = yaw).
 * Returns a Group with userData.dispose() releasing all its geometries/materials.
 */
export function createProjectileMesh(kind = 'bolt', color = 0xa855f7, scale = 1) {
  const root = new THREE.Group();
  root.name = `Projectile_${kind}`;
  const inner = new THREE.Group();
  root.add(inner);

  if (kind === 'arrow') {
    const arrow = buildArrowMesh(color, 0xcbd5e1, 0.75);
    arrow.rotation.y = -Math.PI / 2; // +X -> +Z
    arrow.position.z = -0.4;
    inner.add(arrow);
    const trailMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false });
    const trail = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.004, 0.9, 6, 1, true), trailMat);
    trail.rotation.x = Math.PI / 2;
    trail.position.z = -0.85;
    inner.add(trail);
  } else {
    const coreMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const glowMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false });
    const trailMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false });
    const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.09, 0), coreMat);
    const glow = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), glowMat);
    const trail = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.8, 8, 1, true), trailMat);
    trail.rotation.x = -Math.PI / 2; // tip points backwards (-Z)
    trail.position.z = -0.45;
    inner.add(core, glow, trail);
    root.userData.glow = glow;
    root.userData.core = core;
  }
  inner.scale.setScalar(scale);
  root.traverse((c) => { c.userData.noFlash = true; });
  root.userData.dispose = () => disposeObject3D(root);
  return root;
}

/**
 * Create distinct 3D Monster / Boss meshes with animations
 */
export function createMonsterMesh(typeOrConfig = 'slime', options = {}) {
  const cfg = typeof typeOrConfig === 'object' && typeOrConfig !== null
    ? { ...typeOrConfig, ...options }
    : { type: typeOrConfig, ...options };

  const rawType = String(cfg.type || cfg.id || cfg.name || 'slime').toLowerCase();
  const isBoss = Boolean(cfg.isBoss || rawType.includes('boss') || rawType.includes('lord') || rawType.includes('king') || rawType.includes('queen'));
  const isElite = Boolean(cfg.isElite || cfg.elite);
  const tier = Number(cfg.tier || cfg.level || 1);
  const baseScale = Number(cfg.scale || (isBoss ? 1.85 : isElite ? 1.28 : 1.0));

  const root = new THREE.Group();
  root.name = `Monster_${rawType}`;

  const bodyGroup = new THREE.Group();
  root.add(bodyGroup);

  let animKind = 'biped';
  let leftLimb = null;
  let rightLimb = null;
  let leftLeg = null;
  let rightLeg = null;
  let extraPart = null;

  // Determine archetype from name/type
  if (rawType.includes('slime') || rawType.includes('blob') || rawType.includes('ooze') || rawType.includes('jelly')) {
    animKind = 'slime';
    const slimeColor = cfg.color ?? (rawType.includes('red') || rawType.includes('fire') || tier >= 8 ? 0xef4444
      : rawType.includes('blue') || rawType.includes('ice') || tier >= 4 ? 0x38bdf8
      : rawType.includes('dark') || rawType.includes('purple') ? 0xa855f7 : 0x22c55e);

    const outerMat = new THREE.MeshStandardMaterial({
      color: slimeColor,
      roughness: 0.15,
      metalness: 0.1,
      transparent: true,
      opacity: 0.82
    });
    const coreMat = new THREE.MeshStandardMaterial({
      color: slimeColor,
      emissive: new THREE.Color(slimeColor),
      emissiveIntensity: 0.55,
      roughness: 0.3
    });

    const outer = new THREE.Mesh(new THREE.SphereGeometry(0.45, 16, 12), outerMat);
    outer.scale.set(1.1, 0.82, 1.1);
    outer.position.y = 0.36;
    bodyGroup.add(outer);

    const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.18, 0), coreMat);
    core.position.y = 0.36;
    bodyGroup.add(core);
    extraPart = core;

    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x111827 });
    const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 8), eyeMat);
    eyeL.position.set(-0.14, 0.42, 0.38);
    const eyeR = eyeL.clone();
    eyeR.position.x = 0.14;
    bodyGroup.add(eyeL, eyeR);
  } else if (rawType.includes('skeleton') || rawType.includes('undead') || rawType.includes('bone') || rawType.includes('wraith')) {
    animKind = 'biped';
    const boneMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.55, metalness: 0.1 });
    const darkArmorMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.5, metalness: 0.6 });
    const eyeGlow = new THREE.MeshBasicMaterial({ color: isBoss ? 0xef4444 : 0x38bdf8 });

    // Pelvis & Spine
    const pelvis = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.12, 0.22), boneMat);
    pelvis.position.y = 0.54;
    bodyGroup.add(pelvis);

    const ribcage = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.38, 0.24), boneMat);
    ribcage.position.y = 0.84;
    bodyGroup.add(ribcage);

    // Skull
    const skull = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.3), boneMat);
    skull.position.y = 1.24;
    bodyGroup.add(skull);

    const eyeL = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.03), eyeGlow);
    eyeL.position.set(-0.07, 1.25, 0.15);
    const eyeR = eyeL.clone();
    eyeR.position.x = 0.07;
    bodyGroup.add(eyeL, eyeR);

    // Limbs
    rightLimb = new THREE.Group();
    rightLimb.position.set(-0.26, 0.98, 0);
    const rArm = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.42, 6), boneMat);
    rArm.position.y = -0.18;
    rightLimb.add(rArm);
    const sword = createWeaponMesh({ type: 'sword', level: tier });
    sword.position.set(0, -0.36, 0.08);
    sword.rotation.x = Math.PI / 2.1;
    rightLimb.add(sword);
    bodyGroup.add(rightLimb);

    leftLimb = new THREE.Group();
    leftLimb.position.set(0.26, 0.98, 0);
    const lArm = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.42, 6), boneMat);
    lArm.position.y = -0.18;
    leftLimb.add(lArm);
    const shield = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.04, 10), darkArmorMat);
    shield.rotation.x = Math.PI / 2;
    shield.position.set(0.08, -0.24, 0.1);
    leftLimb.add(shield);
    bodyGroup.add(leftLimb);

    leftLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.04, 0.5, 6), boneMat);
    leftLeg.position.set(0.1, 0.25, 0);
    rightLeg = leftLeg.clone();
    rightLeg.position.x = -0.1;
    bodyGroup.add(leftLeg, rightLeg);
  } else if (rawType.includes('mage') || rawType.includes('wizard') || rawType.includes('lich') || rawType.includes('shaman') || rawType.includes('cultist') || rawType.includes('necromancer')) {
    animKind = 'mage';
    const robeColor = cfg.color ?? (isBoss ? 0x581c87 : 0x312e81);
    const robeMat = new THREE.MeshStandardMaterial({ color: robeColor, roughness: 0.65, metalness: 0.15 });
    const trimMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.8, roughness: 0.25 });

    const robe = new THREE.Mesh(new THREE.ConeGeometry(0.38, 1.05, 10), robeMat);
    robe.position.y = 0.55;
    bodyGroup.add(robe);

    const hood = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.42, 8), robeMat);
    hood.position.y = 1.22;
    bodyGroup.add(hood);

    const faceVoid = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 8), new THREE.MeshBasicMaterial({ color: 0x05050a }));
    faceVoid.position.set(0, 1.14, 0.06);
    bodyGroup.add(faceVoid);

    const eyeGlow = new THREE.MeshBasicMaterial({ color: 0xf43f5e });
    const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 6), eyeGlow);
    eyeL.position.set(-0.05, 1.15, 0.19);
    const eyeR = eyeL.clone();
    eyeR.position.x = 0.05;
    bodyGroup.add(eyeL, eyeR);

    rightLimb = new THREE.Group();
    rightLimb.position.set(-0.32, 0.88, 0.08);
    const staff = createWeaponMesh({ type: 'staff', element: 'dark', level: tier + 4 });
    staff.position.y = -0.35;
    rightLimb.add(staff);
    bodyGroup.add(rightLimb);

    leftLimb = new THREE.Group();
    leftLimb.position.set(0.32, 0.88, 0.12);
    const orb = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.11, 0),
      new THREE.MeshStandardMaterial({ color: 0xa855f7, emissive: new THREE.Color(0xa855f7), emissiveIntensity: 0.9 })
    );
    leftLimb.add(orb);
    extraPart = orb;
    bodyGroup.add(leftLimb);
  } else if (rawType.includes('golem') || rawType.includes('elemental') || rawType.includes('colossus') || rawType.includes('guardian')) {
    animKind = 'biped';
    const rockColor = cfg.color ?? (rawType.includes('ice') ? 0x38bdf8 : rawType.includes('lava') || rawType.includes('fire') ? 0x7f1d1d : 0x64748b);
    const coreColor = rawType.includes('ice') ? 0x7dd3fc : rawType.includes('fire') || rawType.includes('lava') ? 0xff5500 : 0xfacc15;
    const rockMat = new THREE.MeshStandardMaterial({ color: rockColor, roughness: 0.85, metalness: 0.2 });
    const coreMat = new THREE.MeshStandardMaterial({ color: coreColor, emissive: new THREE.Color(coreColor), emissiveIntensity: 0.95 });

    const torso = new THREE.Mesh(new THREE.DodecahedronGeometry(0.46, 0), rockMat);
    torso.position.y = 0.95;
    bodyGroup.add(torso);

    const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.18, 0), coreMat);
    core.position.set(0, 0.96, 0.34);
    bodyGroup.add(core);
    extraPart = core;

    const head = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.26, 0.3), rockMat);
    head.position.y = 1.45;
    bodyGroup.add(head);

    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.06, 0.04), coreMat);
    visor.position.set(0, 1.46, 0.15);
    bodyGroup.add(visor);

    rightLimb = new THREE.Group();
    rightLimb.position.set(-0.56, 1.05, 0);
    const rFist = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.62, 0.26), rockMat);
    rFist.position.y = -0.26;
    rightLimb.add(rFist);
    bodyGroup.add(rightLimb);

    leftLimb = new THREE.Group();
    leftLimb.position.set(0.56, 1.05, 0);
    const lFist = rFist.clone();
    leftLimb.add(lFist);
    bodyGroup.add(leftLimb);

    leftLeg = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.5, 0.26), rockMat);
    leftLeg.position.set(0.2, 0.25, 0);
    rightLeg = leftLeg.clone();
    rightLeg.position.x = -0.2;
    bodyGroup.add(leftLeg, rightLeg);
  } else if (rawType.includes('wolf') || rawType.includes('hound') || rawType.includes('beast') || rawType.includes('spider') || rawType.includes('rat')) {
    animKind = 'quadruped';
    const furColor = cfg.color ?? (rawType.includes('shadow') || rawType.includes('dire') ? 0x1e293b : 0x57534e);
    const furMat = new THREE.MeshStandardMaterial({ color: furColor, roughness: 0.8 });

    const body = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.34, 0.72), furMat);
    body.position.y = 0.44;
    bodyGroup.add(body);

    const head = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.28, 0.34), furMat);
    head.position.set(0, 0.58, 0.42);
    bodyGroup.add(head);

    const snout = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.14, 0.22), furMat);
    snout.position.set(0, 0.52, 0.62);
    bodyGroup.add(snout);

    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
    const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 6), eyeMat);
    eyeL.position.set(-0.09, 0.62, 0.56);
    const eyeR = eyeL.clone();
    eyeR.position.x = 0.09;
    bodyGroup.add(eyeL, eyeR);

    leftLeg = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.34, 0.1), furMat);
    leftLeg.position.set(0.14, 0.17, 0.24);
    rightLeg = leftLeg.clone();
    rightLeg.position.set(-0.14, 0.17, 0.24);
    leftLimb = leftLeg.clone();
    leftLimb.position.set(0.14, 0.17, -0.24);
    rightLimb = leftLeg.clone();
    rightLimb.position.set(-0.14, 0.17, -0.24);
    bodyGroup.add(leftLeg, rightLeg, leftLimb, rightLimb);
  } else if (rawType.includes('bat') || rawType.includes('gargoyle') || rawType.includes('drake') || rawType.includes('imp')) {
    animKind = 'flying';
    const wingColor = cfg.color ?? 0x4c1d95;
    const mat = new THREE.MeshStandardMaterial({ color: wingColor, roughness: 0.6 });
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 10), mat);
    core.position.y = 0.95;
    bodyGroup.add(core);

    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xfacc15 });
    const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 6), eyeMat);
    eyeL.position.set(-0.08, 0.98, 0.21);
    const eyeR = eyeL.clone();
    eyeR.position.x = 0.08;
    bodyGroup.add(eyeL, eyeR);

    leftLimb = new THREE.Group();
    leftLimb.position.set(0.18, 0.98, 0);
    const lWing = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.04, 0.28), mat);
    lWing.position.x = 0.25;
    leftLimb.add(lWing);
    bodyGroup.add(leftLimb);

    rightLimb = new THREE.Group();
    rightLimb.position.set(-0.18, 0.98, 0);
    const rWing = lWing.clone();
    rWing.position.x = -0.25;
    rightLimb.add(rWing);
    bodyGroup.add(rightLimb);
  } else {
    // Goblin / Orc / Demon / Boss Humanoid Warrior
    animKind = 'biped';
    const isOrcOrBoss = isBoss || rawType.includes('orc') || rawType.includes('ogre') || rawType.includes('troll') || rawType.includes('knight') || rawType.includes('demon');
    const skinColor = cfg.color ?? (isBoss ? 0x991b1b : isOrcOrBoss ? 0x3f6212 : 0x4d7c0f);
    const armorColor = isBoss ? 0x18181b : isOrcOrBoss ? 0x451a03 : 0x713f12;

    const skinMat = new THREE.MeshStandardMaterial({ color: skinColor, roughness: 0.65 });
    const armorMat = new THREE.MeshStandardMaterial({ color: armorColor, roughness: 0.45, metalness: 0.55 });

    const torsoW = isOrcOrBoss ? 0.52 : 0.36;
    const torsoH = isOrcOrBoss ? 0.56 : 0.42;

    const torso = new THREE.Mesh(new THREE.BoxGeometry(torsoW, torsoH, 0.3), armorMat);
    torso.position.y = 0.72;
    bodyGroup.add(torso);

    const head = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.3, 0.32), skinMat);
    head.position.y = 0.72 + torsoH * 0.5 + 0.16;
    bodyGroup.add(head);

    // Glowing eyes
    const eyeMat = new THREE.MeshBasicMaterial({ color: isBoss ? 0xff2200 : 0xfacc15 });
    const eyeL = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.045, 0.02), eyeMat);
    eyeL.position.set(-0.07, head.position.y + 0.02, 0.165);
    const eyeR = eyeL.clone();
    eyeR.position.x = 0.07;
    bodyGroup.add(eyeL, eyeR);

    // Ears or Horns
    if (isBoss) {
      const hornMat = new THREE.MeshStandardMaterial({ color: 0xfbbf24, metalness: 0.7, roughness: 0.25 });
      const hornL = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.34, 6), hornMat);
      hornL.position.set(-0.18, head.position.y + 0.22, 0);
      hornL.rotation.z = 0.35;
      const hornR = hornL.clone();
      hornR.position.x = 0.18;
      hornR.rotation.z = -0.35;
      bodyGroup.add(hornL, hornR);
    } else if (!isOrcOrBoss) {
      // Goblin pointed ears
      const earL = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.18, 4), skinMat);
      earL.position.set(-0.22, head.position.y, 0);
      earL.rotation.z = Math.PI / 2.4;
      const earR = earL.clone();
      earR.position.x = 0.22;
      earR.rotation.z = -Math.PI / 2.4;
      bodyGroup.add(earL, earR);
    }

    rightLimb = new THREE.Group();
    rightLimb.position.set(-(torsoW * 0.5 + 0.09), 0.9, 0);
    const rArm = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.38, 0.14), skinMat);
    rArm.position.y = -0.16;
    rightLimb.add(rArm);

    const wep = createWeaponMesh({
      type: isOrcOrBoss ? 'axe' : 'dagger',
      rarity: isBoss ? 'unique' : isElite ? 'rare' : 'normal',
      level: tier
    });
    wep.position.set(0, -0.34, 0.08);
    wep.rotation.x = Math.PI / 2.2;
    rightLimb.add(wep);
    bodyGroup.add(rightLimb);

    leftLimb = new THREE.Group();
    leftLimb.position.set(torsoW * 0.5 + 0.09, 0.9, 0);
    const lArm = rArm.clone();
    leftLimb.add(lArm);
    bodyGroup.add(leftLimb);

    leftLeg = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.42, 0.16), armorMat);
    leftLeg.position.set(0.12, 0.22, 0);
    rightLeg = leftLeg.clone();
    rightLeg.position.x = -0.12;
    bodyGroup.add(leftLeg, rightLeg);
  }

  // Add Elite / Boss ground aura ring
  if (isElite || isBoss) {
    const auraColor = isBoss ? 0xef4444 : 0xfacc15;
    const auraRing = new THREE.Mesh(
      new THREE.RingGeometry(0.55, 0.72, 24),
      new THREE.MeshBasicMaterial({
        color: auraColor,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.65
      })
    );
    auraRing.userData.noFlash = true;
    auraRing.rotation.x = -Math.PI / 2;
    auraRing.position.y = 0.03;
    root.add(auraRing);
    root.userData.auraRing = auraRing;
  }

  root.scale.setScalar(baseScale);
  attachHitFlashSupport(root);

  root.userData.animate = (stateOrTime = 'idle', timeOrDt = 0, dtArg = 0.016) => {
    const state = typeof stateOrTime === 'string' ? stateOrTime.toLowerCase() : 'idle';
    const time = typeof stateOrTime === 'number' ? stateOrTime : Number(timeOrDt || 0);
    const dt = typeof stateOrTime === 'number' ? Number(timeOrDt || 0.016) : Number(dtArg || 0.016);

    if (root.userData.hitFlashTimer > 0) {
      root.userData.hitFlashTimer = Math.max(0, root.userData.hitFlashTimer - dt * 6);
      root.userData.setHitFlash(root.userData.hitFlashTimer);
    }

    if (root.userData.auraRing) {
      root.userData.auraRing.rotation.z = time * 1.8;
    }

    if (state === 'dead' || state === 'death') {
      bodyGroup.rotation.x = THREE.MathUtils.lerp(bodyGroup.rotation.x, -Math.PI / 2.2, dt * 8);
      bodyGroup.position.y = THREE.MathUtils.lerp(bodyGroup.position.y, -0.2, dt * 8);
      return;
    }

    bodyGroup.rotation.x = 0;

    if (animKind === 'slime') {
      const speed = state === 'chase' || state === 'walk' ? 8 : 4;
      const squash = Math.sin(time * speed);
      bodyGroup.scale.set(1 - squash * 0.14, 1 + squash * 0.22, 1 - squash * 0.14);
      bodyGroup.position.y = Math.max(0, squash) * (state === 'chase' ? 0.24 : 0.08);
      if (extraPart) extraPart.rotation.y = time * 3;
    } else if (animKind === 'flying') {
      bodyGroup.position.y = Math.sin(time * 6) * 0.14;
      const flap = Math.sin(time * 16) * 0.65;
      if (leftLimb) leftLimb.rotation.z = flap;
      if (rightLimb) rightLimb.rotation.z = -flap;
    } else if (animKind === 'mage') {
      bodyGroup.position.y = Math.sin(time * 3.5) * 0.08;
      if (extraPart) {
        extraPart.rotation.y = time * 4;
        extraPart.position.y = Math.sin(time * 5) * 0.06;
      }
      if (state === 'attack' || state === 'skill' || state === 'telegraph') {
        if (rightLimb) rightLimb.rotation.x = -1.1 + Math.sin(time * 12) * 0.3;
      } else {
        if (rightLimb) rightLimb.rotation.x = Math.sin(time * 2.5) * 0.12;
      }
    } else if (animKind === 'quadruped') {
      const cycle = time * (state === 'chase' || state === 'walk' ? 13 : 3);
      const amp = state === 'chase' || state === 'walk' ? 0.55 : 0.05;
      if (leftLeg) leftLeg.rotation.x = Math.sin(cycle) * amp;
      if (rightLeg) rightLeg.rotation.x = -Math.sin(cycle) * amp;
      if (leftLimb) leftLimb.rotation.x = -Math.sin(cycle) * amp;
      if (rightLimb) rightLimb.rotation.x = Math.sin(cycle) * amp;
    } else {
      // Biped
      if (state === 'chase' || state === 'walk' || state === 'patrol') {
        const w = time * 9.5;
        if (leftLeg) leftLeg.rotation.x = Math.sin(w) * 0.55;
        if (rightLeg) rightLeg.rotation.x = -Math.sin(w) * 0.55;
        if (leftLimb) leftLimb.rotation.x = -Math.sin(w) * 0.45;
        if (rightLimb) rightLimb.rotation.x = Math.sin(w) * 0.45;
        bodyGroup.position.y = Math.abs(Math.sin(w)) * 0.05;
      } else if (state === 'telegraph') {
        if (rightLimb) rightLimb.rotation.x = -2.1;
        bodyGroup.position.y = 0.04;
      } else if (state === 'attack' || state === 'skill') {
        if (rightLimb) rightLimb.rotation.x = -0.4 + Math.sin(time * 18) * 1.2;
      } else {
        const b = Math.sin(time * 3);
        bodyGroup.position.y = b * 0.02;
        if (leftLeg) leftLeg.rotation.x = 0;
        if (rightLeg) rightLeg.rotation.x = 0;
        if (rightLimb) rightLimb.rotation.x = -0.2 + b * 0.06;
        if (leftLimb) leftLimb.rotation.x = -0.15 - b * 0.06;
      }
    }
  };

  enableShadows(root, true, true);
  return root;
}

export const createEnemyMesh = createMonsterMesh;
export function createBossMesh(typeOrConfig = 'boss', options = {}) {
  return createMonsterMesh(typeOrConfig, { ...options, isBoss: true });
}

/**
 * Create Village NPC 3D mesh with role-specific attire & floating quest marker
 */
export function createNPCMesh(npcOrRole = 'chief') {
  const roleStr = String(
    typeof npcOrRole === 'object' ? (npcOrRole.role || npcOrRole.id || npcOrRole.name || 'villager') : npcOrRole
  ).toLowerCase();

  const root = new THREE.Group();
  root.name = `NPC_${roleStr}`;

  let robeColor = 0x2563eb;
  let hatColor = 0x1e40af;
  let accentColor = 0xfacc15;

  if (roleStr.includes('smith') || roleStr.includes('weapon') || roleStr.includes('forge')) {
    robeColor = 0x7c2d12;
    hatColor = 0x451a03;
    accentColor = 0xf97316;
  } else if (roleStr.includes('merchant') || roleStr.includes('potion') || roleStr.includes('shop') || roleStr.includes('item')) {
    robeColor = 0x15803d;
    hatColor = 0x166534;
    accentColor = 0x4ade80;
  } else if (roleStr.includes('skill') || roleStr.includes('master') || roleStr.includes('trainer')) {
    robeColor = 0x6d28d9;
    hatColor = 0x4c1d95;
    accentColor = 0xc084fc;
  } else if (roleStr.includes('compos') || roleStr.includes('synth') || roleStr.includes('alchem') || roleStr.includes('gem')) {
    robeColor = 0x0e7490;
    hatColor = 0x155e75;
    accentColor = 0x38bdf8;
  } else if (roleStr.includes('chief') || roleStr.includes('elder') || roleStr.includes('mayor')) {
    robeColor = 0x991b1b;
    hatColor = 0xfbbf24;
    accentColor = 0xfef08a;
  }

  const bodyMat = new THREE.MeshStandardMaterial({ color: robeColor, roughness: 0.6, metalness: 0.2 });
  const skinMat = new THREE.MeshStandardMaterial({ color: 0xf5cba7, roughness: 0.6 });
  const accentMat = new THREE.MeshStandardMaterial({
    color: accentColor,
    emissive: new THREE.Color(accentColor),
    emissiveIntensity: 0.35,
    roughness: 0.3,
    metalness: 0.6
  });

  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.32, 0.88, 12), bodyMat);
  body.position.y = 0.44;
  root.add(body);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 10), skinMat);
  head.position.y = 1.04;
  root.add(head);

  // Hat / Crown
  const hat = new THREE.Mesh(
    new THREE.ConeGeometry(0.26, 0.36, 10),
    new THREE.MeshStandardMaterial({ color: hatColor, roughness: 0.5 })
  );
  hat.position.y = 1.32;
  root.add(hat);

  // Floating role/quest indicator crystal above head
  const marker = new THREE.Mesh(new THREE.OctahedronGeometry(0.12, 0), accentMat);
  marker.position.y = 1.75;
  root.add(marker);

  // Base circle
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.42, 0.52, 24),
    new THREE.MeshBasicMaterial({ color: accentColor, side: THREE.DoubleSide, transparent: true, opacity: 0.5 })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.02;
  root.add(ring);

  root.userData.marker = marker;
  root.userData.setQuestMarker = (markerType = null) => {
    if (!markerType) {
      marker.scale.setScalar(0.85);
      return;
    }
    marker.scale.setScalar(1.25);
    if (markerType === '!') {
      accentMat.color.setHex(0xfacc15);
      accentMat.emissive.setHex(0xfacc15);
    } else if (markerType === '?') {
      accentMat.color.setHex(0x4ade80);
      accentMat.emissive.setHex(0x4ade80);
    }
  };

  root.userData.animate = (time = 0) => {
    const t = typeof time === 'number' ? time : 0;
    marker.position.y = 1.75 + Math.sin(t * 3.5) * 0.08;
    marker.rotation.y = t * 2.2;
  };

  enableShadows(root, true, true);
  return root;
}

/**
 * Create interactive 3D Treasure Chest with hinged lid
 */
export function createChestMesh(tier = 'normal', isOpen = false) {
  const root = new THREE.Group();
  root.name = `Chest_${tier}`;

  const tierStr = String(tier || 'normal').toLowerCase();
  const isGold = tierStr.includes('boss') || tierStr.includes('gold') || tierStr.includes('epic') || tierStr.includes('rare');
  const boxColor = isGold ? 0x7c2d12 : 0x5c3a21;
  const trimColor = isGold ? 0xfacc15 : 0x94a3b8;

  const woodMat = new THREE.MeshStandardMaterial({ color: boxColor, roughness: 0.65, metalness: 0.2 });
  const trimMat = new THREE.MeshStandardMaterial({ color: trimColor, roughness: 0.3, metalness: 0.85 });
  const glowMat = new THREE.MeshBasicMaterial({ color: isGold ? 0xfef08a : 0x38bdf8 });

  // Chest base
  const base = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.42, 0.52), woodMat);
  base.position.y = 0.21;
  root.add(base);

  const bandL = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.44, 0.55), trimMat);
  bandL.position.set(-0.24, 0.21, 0);
  const bandR = bandL.clone();
  bandR.position.x = 0.24;
  root.add(bandL, bandR);

  // Inner treasure glow
  const innerGlow = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.06, 0.42), glowMat);
  innerGlow.position.y = 0.40;
  innerGlow.visible = Boolean(isOpen);
  root.add(innerGlow);

  // Hinged Lid
  const lidPivot = new THREE.Group();
  lidPivot.position.set(0, 0.42, -0.26);
  root.add(lidPivot);

  const lid = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.22, 0.54), woodMat);
  lid.position.set(0, 0.11, 0.26);
  lidPivot.add(lid);

  const lock = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.16, 0.06), trimMat);
  lock.position.set(0, 0.04, 0.53);
  lidPivot.add(lock);

  root.userData.isOpen = Boolean(isOpen);
  lidPivot.rotation.x = root.userData.isOpen ? -1.15 : 0;

  root.userData.setOpen = (open = true) => {
    root.userData.isOpen = Boolean(open);
    lidPivot.rotation.x = root.userData.isOpen ? -1.15 : 0;
    innerGlow.visible = root.userData.isOpen;
  };

  root.userData.animate = (time = 0, dt = 0.016) => {
    const targetRot = root.userData.isOpen ? -1.15 : 0;
    lidPivot.rotation.x = THREE.MathUtils.lerp(lidPivot.rotation.x, targetRot, dt * 8);
  };

  enableShadows(root, true, true);
  return root;
}

/**
 * Create swirling 3D Portal / Teleporter mesh
 */
export function createPortalMesh(colorOrOptions = 0x38bdf8, type = 'dungeon') {
  const color = typeof colorOrOptions === 'object' && colorOrOptions !== null
    ? (colorOrOptions.color ?? 0x38bdf8)
    : colorOrOptions;

  const root = new THREE.Group();
  root.name = `Portal_${type}`;

  const stoneMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.8, metalness: 0.2 });
  const runeMat = new THREE.MeshStandardMaterial({
    color,
    emissive: new THREE.Color(color),
    emissiveIntensity: 0.9,
    roughness: 0.2
  });

  // Pedestal base
  const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.35, 0.18, 16), stoneMat);
  pedestal.position.y = 0.09;
  root.add(pedestal);

  // Stone Arch
  const arch = new THREE.Mesh(new THREE.TorusGeometry(0.95, 0.14, 10, 24, Math.PI), stoneMat);
  arch.position.y = 1.05;
  root.add(arch);

  const pillarL = new THREE.Mesh(new THREE.BoxGeometry(0.28, 1.1, 0.28), stoneMat);
  pillarL.position.set(-0.95, 0.55, 0);
  const pillarR = pillarL.clone();
  pillarR.position.x = 0.95;
  root.add(pillarL, pillarR);

  // Swirling Vortex Disc
  const vortexMat = new THREE.MeshBasicMaterial({
    color,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.72
  });
  const vortex = new THREE.Mesh(new THREE.CircleGeometry(0.84, 24), vortexMat);
  vortex.position.y = 1.05;
  root.add(vortex);

  const innerRing = new THREE.Mesh(new THREE.TorusGeometry(0.68, 0.035, 8, 20), runeMat);
  innerRing.position.y = 1.05;
  root.add(innerRing);

  root.userData.animate = (time = 0) => {
    const t = typeof time === 'number' ? time : 0;
    innerRing.rotation.z = t * 2.5;
    vortex.scale.setScalar(0.96 + Math.sin(t * 4) * 0.05);
  };

  enableShadows(root, true, true);
  return root;
}

/**
 * Create Breakable Dungeon Props (Barrel, Crate, Urn, Crystal)
 */
export function createBreakableMesh(type = 'barrel') {
  const root = new THREE.Group();
  const kind = String(type || 'barrel').toLowerCase();
  root.name = `Breakable_${kind}`;

  if (kind.includes('crate') || kind.includes('box')) {
    const mat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.8 });
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.62, 0.62), mat);
    box.position.y = 0.31;
    root.add(box);
  } else if (kind.includes('urn') || kind.includes('vase') || kind.includes('pot')) {
    const mat = new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.55 });
    const urn = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.26, 0.62, 12), mat);
    urn.position.y = 0.31;
    root.add(urn);
  } else if (kind.includes('crystal')) {
    const mat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: new THREE.Color(0x0284c7),
      emissiveIntensity: 0.65,
      roughness: 0.15
    });
    const shard = new THREE.Mesh(new THREE.OctahedronGeometry(0.36, 0), mat);
    shard.scale.set(0.7, 1.4, 0.7);
    shard.position.y = 0.45;
    root.add(shard);
  } else {
    // Barrel
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x713f12, roughness: 0.75 });
    const ironMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.7, roughness: 0.4 });
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.3, 0.68, 12), woodMat);
    barrel.position.y = 0.34;
    root.add(barrel);

    const hoop1 = new THREE.Mesh(new THREE.TorusGeometry(0.29, 0.02, 6, 14), ironMat);
    hoop1.rotation.x = Math.PI / 2;
    hoop1.position.y = 0.48;
    const hoop2 = hoop1.clone();
    hoop2.position.y = 0.20;
    root.add(hoop1, hoop2);
  }

  attachHitFlashSupport(root);
  enableShadows(root, true, true);
  return root;
}

/**
 * Create Ground Loot Mesh (Gold coins, Equipment bag/crystal, Potion)
 */
export function createLootMesh(itemOrType = 'bag', rarity = 'normal') {
  const root = new THREE.Group();
  const isObj = typeof itemOrType === 'object' && itemOrType !== null;
  const kind = String(isObj ? (itemOrType.type || itemOrType.slot || 'item') : itemOrType).toLowerCase();
  const rar = isObj ? (itemOrType.rarity || rarity) : rarity;
  const col = kind.includes('gold') || kind.includes('coin') ? 0xfacc15 : getRarityColor(rar);

  const mat = new THREE.MeshStandardMaterial({
    color: col,
    emissive: new THREE.Color(col),
    emissiveIntensity: 0.55,
    roughness: 0.25,
    metalness: 0.5
  });

  const mesh = kind.includes('gold')
    ? new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.2, 0.08, 12), mat)
    : new THREE.Mesh(new THREE.OctahedronGeometry(0.2, 0), mat);
  mesh.position.y = 0.28;
  root.add(mesh);

  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.04, 0.14, 0.9, 8),
    new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.32 })
  );
  beam.position.y = 0.45;
  root.add(beam);

  root.userData.animate = (time = 0) => {
    const t = typeof time === 'number' ? time : 0;
    mesh.rotation.y = t * 3;
    mesh.position.y = 0.26 + Math.sin(t * 4) * 0.07;
  };

  return root;
}

export function createTorchMesh(color = 0xff8822) {
  const root = new THREE.Group();
  const stick = new THREE.Mesh(
    new THREE.CylinderGeometry(0.04, 0.05, 0.55, 8),
    new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.8 })
  );
  stick.position.y = 0.28;
  root.add(stick);

  const flame = new THREE.Mesh(
    new THREE.ConeGeometry(0.1, 0.24, 8),
    new THREE.MeshBasicMaterial({ color })
  );
  flame.position.y = 0.64;
  root.add(flame);

  root.userData.animate = (time = 0) => {
    const t = typeof time === 'number' ? time : 0;
    flame.scale.set(
      1 + Math.sin(t * 17) * 0.15,
      1 + Math.cos(t * 23) * 0.2,
      1 + Math.sin(t * 19) * 0.15
    );
  };
  return root;
}

export function createTrapMesh(type = 'spikes', element = 'physical') {
  const root = new THREE.Group();
  const base = new THREE.Mesh(
    new THREE.BoxGeometry(1.4, 0.06, 1.4),
    new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.7, metalness: 0.5 })
  );
  base.position.y = 0.03;
  root.add(base);

  const spikesGroup = new THREE.Group();
  const spikeMat = new THREE.MeshStandardMaterial({
    color: getElementColor(element),
    metalness: 0.8,
    roughness: 0.25
  });
  for (const sx of [-0.38, 0, 0.38]) {
    for (const sz of [-0.38, 0, 0.38]) {
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.42, 6), spikeMat);
      spike.position.set(sx, 0.21, sz);
      spikesGroup.add(spike);
    }
  }
  root.add(spikesGroup);

  root.userData.setActive = (active = true) => {
    spikesGroup.position.y = active ? 0 : -0.36;
  };
  root.userData.animate = (time = 0) => {
    spikesGroup.position.y = Math.sin(time * 3) > 0.2 ? 0 : -0.34;
  };
  return root;
}

export function createSwitchMesh(isActive = false) {
  const root = new THREE.Group();
  const base = new THREE.Mesh(
    new THREE.BoxGeometry(0.45, 0.14, 0.35),
    new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.6 })
  );
  base.position.y = 0.07;
  root.add(base);

  const lever = new THREE.Mesh(
    new THREE.CylinderGeometry(0.035, 0.035, 0.55, 8),
    new THREE.MeshStandardMaterial({ color: isActive ? 0x22c55e : 0xef4444 })
  );
  lever.position.y = 0.32;
  lever.rotation.z = isActive ? -0.45 : 0.45;
  root.add(lever);

  root.userData.setActive = (active = true) => {
    lever.rotation.z = active ? -0.45 : 0.45;
    lever.material.color.setHex(active ? 0x22c55e : 0xef4444);
  };
  return root;
}

export function createStairsMesh(direction = 'down') {
  const root = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.75 });
  for (let i = 0; i < 4; i++) {
    const step = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.18, 0.38), mat);
    step.position.set(0, direction === 'up' ? i * 0.16 + 0.09 : (3 - i) * 0.12 + 0.06, (i - 1.5) * 0.36);
    root.add(step);
  }
  return root;
}

export class Models3D {
  createHeroMesh(equipment, look) { return createHeroMesh(equipment, look); }
  createProjectileMesh(kind, color, scale) { return createProjectileMesh(kind, color, scale); }
  createWeaponMesh(weapon) { return createWeaponMesh(weapon); }
  createShieldMesh(shield) { return createShieldMesh(shield); }
  createMonsterMesh(type, options) { return createMonsterMesh(type, options); }
  createEnemyMesh(type, options) { return createMonsterMesh(type, options); }
  createBossMesh(type, options) { return createBossMesh(type, options); }
  createNPCMesh(npcOrRole) { return createNPCMesh(npcOrRole); }
  createChestMesh(tier, isOpen) { return createChestMesh(tier, isOpen); }
  createPortalMesh(color, type) { return createPortalMesh(color, type); }
  createBreakableMesh(type) { return createBreakableMesh(type); }
  createLootMesh(itemOrType, rarity) { return createLootMesh(itemOrType, rarity); }
  createTorchMesh(color) { return createTorchMesh(color); }
  createTrapMesh(type, element) { return createTrapMesh(type, element); }
  createSwitchMesh(isActive) { return createSwitchMesh(isActive); }
  createStairsMesh(direction) { return createStairsMesh(direction); }
}

export const models3d = new Models3D();
export default models3d;

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { getClass, defaultAppearance, sanitizeAppearance } from '../systems/classes.js';
import { glowLevel, SEALS, STATUS, RARITY_BEAMS } from '../systems/mechanics.js';
// Namespace import: optional exports (CLASS_SET_STYLE, tierForLevel) may be missing without breaking module linking
import * as inventoryModule from '../systems/inventory.js';

const glbCache = new Map();
const _sroSpriteTexCache = new Map();
const _breakableAssetCache = new Map();
const _chestAssetCache = new Map();
const _arrowGeoCache = new Map();
const _arrowMatCache = new Map();
const _lootGeoCache = new Map();
const _lootMatCache = new Map();
let _sroSpriteLoader = null;
let gltfLoader = null;

function _markShared(asset) {
  if (!asset) return asset;
  asset.userData = asset.userData || {};
  asset.userData.sharedAsset = true;
  asset.userData.isSharedAsset = true;
  asset.userData.isCachedGLB = true;
  return asset;
}

function getCachedAsset(cache, key, factory, maxSize = 128) {
  let asset = cache.get(key);
  if (asset) return asset;
  asset = factory();
  if (cache.size < maxSize) {
    _markShared(asset);
    cache.set(key, asset);
  }
  return asset;
}

function mergeStaticGeometries(geos, useGroups = false) {
  if (!geos || geos.length === 0) return null;
  const prepared = [];
  for (let i = 0; i < geos.length; i++) {
    const g = geos[i];
    if (!g) continue;
    const norm = g.index ? g.toNonIndexed() : g;
    if (norm !== g) g.dispose?.();
    prepared.push(norm);
  }
  const merged = mergeGeometries(prepared, useGroups);
  for (let i = 0; i < prepared.length; i++) prepared[i].dispose?.();
  if (merged) {
    merged.userData = merged.userData || {};
    merged.userData.isSharedAsset = true;
    merged.userData.isCachedGLB = true;
  }
  return merged;
}

function getGLTFLoader() {
  if (!gltfLoader && typeof window !== 'undefined' && typeof document !== 'undefined') {
    gltfLoader = new GLTFLoader();
  }
  return gltfLoader;
}

/**
 * Load, parse, cache GLB scene, animations, and precomputed bounds.
 * Browser-only helper; in Node returns null immediately.
 */
export function loadGLB(url) {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return Promise.resolve(null);
  }
  if (!url) return Promise.resolve(null);
  if (glbCache.has(url)) return glbCache.get(url);

  const loader = getGLTFLoader();
  if (!loader) return Promise.resolve(null);

  const p = new Promise((resolve) => {
    loader.load(
      url,
      (gltf) => {
        const scene = gltf.scene || gltf.scenes?.[0] || null;
        if (!scene) {
          resolve(null);
          return;
        }
        scene.updateMatrixWorld(true);
        scene.traverse((child) => {
          if (child.geometry) {
            child.geometry.userData = child.geometry.userData || {};
            child.geometry.userData.isCachedGLB = true;
          }
          const mats = Array.isArray(child.material) ? child.material : child.material ? [child.material] : [];
          for (const m of mats) {
            if (m) {
              m.userData = m.userData || {};
              m.userData.isCachedGLB = true;
            }
          }
        });
        const box = new THREE.Box3().setFromObject(scene);
        const size = new THREE.Vector3();
        box.getSize(size);
        const center = new THREE.Vector3();
        box.getCenter(center);
        const bounds = {
          box,
          min: box.min.clone(),
          max: box.max.clone(),
          size,
          center
        };
        const animations = gltf.animations || [];
        resolve({ scene, animations, bounds });
      },
      undefined,
      (err) => {
        console.warn(`[models3d] Failed to load GLB: ${url}`, err);
        glbCache.delete(url);
        resolve(null);
      }
    );
  });
  glbCache.set(url, p);
  return p;
}

/**
 * Safe browser-only helper to load, cache, clone (using SkeletonUtils.clone), and attach GLB models.
 * In headless Node, returns immediately so tests remain 100% synchronous.
 */
export function attachGLBModel(targetGroup, url, {
  scale = 1,
  targetHeight = null,
  targetSpan = null,
  yOffset = 0,
  zOffset = 0,
  xOffset = 0,
  rotationY = 0,
  groundAtZero = false,
  centerXZ = false,
  hideFallback = true,
  excludeMeshNames = null,
  castShadow = false,
  receiveShadow = false,
  onLoaded = null,
  onError = null
} = {}) {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return;
  }
  if (!targetGroup || !url) {
    if (typeof onError === 'function') onError();
    return;
  }

  loadGLB(url).then((entry) => {
    if (!entry || !entry.scene || !targetGroup) {
      if (typeof onError === 'function') onError();
      return;
    }
    const { scene, animations, bounds } = entry;

    // Use SkeletonUtils.clone to properly clone SkinnedMesh and bones
    const clone = SkeletonUtils.clone(scene);

    let s = scale;
    if (targetHeight != null && bounds && bounds.size.y > 0.0001) {
      s = targetHeight / bounds.size.y;
    } else if (targetSpan != null && bounds) {
      const maxSpan = Math.max(bounds.size.x, bounds.size.y, bounds.size.z);
      if (maxSpan > 0.0001) s = targetSpan / maxSpan;
    }
    clone.scale.setScalar(s);

    let computedY = yOffset;
    if (bounds) {
      if (groundAtZero) {
        computedY = -bounds.min.y * s + yOffset;
      } else if (bounds.min.y < -0.001) {
        computedY = -bounds.min.y * s + yOffset;
      }
    }
    clone.position.y = computedY;
    if (centerXZ && bounds && bounds.center) {
      clone.position.x = -bounds.center.x * s;
      clone.position.z = -bounds.center.z * s;
    }
    if (xOffset) clone.position.x += xOffset;
    if (zOffset) clone.position.z += zOffset;
    if (rotationY) clone.rotation.y = rotationY;

    const excludeSet = excludeMeshNames
      ? new Set(Array.isArray(excludeMeshNames) ? excludeMeshNames : [excludeMeshNames])
      : null;

    const flashHex = targetGroup.userData?._flashHex ?? 0xff4444;
    clone.traverse((child) => {
      if (excludeSet && excludeSet.has(child.name)) {
        child.visible = false;
      }
      if (child.isMesh) {
        child.castShadow = castShadow;
        child.receiveShadow = receiveShadow;
        // Do NOT clone materials! Share materials across clones for high performance.
        if (child.material && child.material.map) {
          child.material.map.colorSpace = THREE.SRGBColorSpace;
        }
        patchMeshHitFlash(child, flashHex);
        if (targetGroup.userData?.flashMeshes && !targetGroup.userData.flashMeshes.includes(child)) {
          targetGroup.userData.flashMeshes.push(child);
        }
      }
    });

    if (hideFallback) {
      for (const child of targetGroup.children) {
        if (child === clone) continue;
        if (
          child.userData?.keepWithGLB ||
          child.userData?.isOrbitRing ||
          child.userData?.isRarityBeam ||
          child.name === 'OrbitRing' ||
          child.name === 'LootBeam' ||
          child.name === 'RarityRing' ||
          child.name === 'AuraRing' ||
          child.userData?.isQuestMarker
        ) {
          continue;
        }
        child.visible = false;
      }
    }

    targetGroup.add(clone);
    targetGroup.userData.glbModel = clone;
    targetGroup.userData.animations = animations;

    if (typeof onLoaded === 'function') {
      onLoaded(clone, { animations, bounds });
    }
  });
}

const FALLBACK_SET_STYLE = {
  knight: { primary: 0x38bdf8, accent: 0xfacc15 },
  axeman: { primary: 0xb91c1c, accent: 0x78350f },
  wizard: { primary: 0x7c3aed, accent: 0xe0e7ff },
  archer: { primary: 0x15803d, accent: 0xd6a85c }
};

function classSetStyle(classId) {
  const table = inventoryModule?.CLASS_SET_STYLE || FALLBACK_SET_STYLE;
  return table[classId] || FALLBACK_SET_STYLE[classId] || FALLBACK_SET_STYLE.knight;
}

function cssToHex(c, fallback = 0xffffff) {
  if (typeof c === 'number') return c;
  const m = /^#?([0-9a-f]{6})$/i.exec(String(c || '').trim());
  return m ? parseInt(m[1], 16) : fallback;
}

/** Seal color (hex int) for an item, or null. */
export function sealColorOf(item) {
  const seal = item?.seal ? SEALS?.[item.seal] : null;
  return seal ? cssToHex(seal.color, null) : null;
}

/** Gear visual tier 0..7 from item.tier (falls back to required level). */
export function itemVisualTier(item) {
  if (!item) return null;
  const t = Number(item.tier);
  if (Number.isFinite(t)) return Math.max(0, Math.min(7, Math.round(t)));
  const lvl = Number(item.reqLevel || item.level);
  if (Number.isFinite(lvl) && typeof inventoryModule?.tierForLevel === 'function') {
    return Math.max(0, Math.min(7, inventoryModule.tierForLevel(lvl) | 0));
  }
  return 0;
}

/** Element / imbue color (hex int). Physical imbues use their status color (e.g. bleed red). */
export function imbueColorOf(imbue) {
  if (!imbue) return null;
  const el = String(imbue.element || 'physical').toLowerCase();
  if (el === 'physical' || !ELEMENT_COLORS_EXT[el]) {
    const st = imbue.status ? STATUS?.[imbue.status] : null;
    if (st?.color != null) return st.color;
  }
  return ELEMENT_COLORS_EXT[el] ?? 0xe2e8f0;
}

const ELEMENT_COLORS_EXT = {
  fire: 0xff6a2a,
  ice: 0x6fd4ff,
  cold: 0x6fd4ff,
  lightning: 0xffee44,
  thunder: 0xffee44,
  poison: 0x7dff5a,
  dark: 0x9333ea,
  shadow: 0x9333ea,
  holy: 0xfef08a
};

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

let _lastFlashMat = null;
let _lastFlashCalls = -1;
let _lastFlashFrame = -1;
const _hitFlashColorTmp = new THREE.Color();

function _hitFlashOnBeforeRender(renderer, scene, camera, geometry, material) {
  const u = material?.userData?._hitFlashUniforms;
  if (!u) return;
  const flashVal = this.userData?._flashVal || 0;
  const flashHex = this.userData?._flashHex ?? 0xff4444;
  const prevVal = u.uHitFlash.value;
  const prevHex = u.uHitFlashHex;
  u.uHitFlash.value = flashVal;
  if (prevHex !== flashHex) {
    u.uHitFlashHex = flashHex;
    _hitFlashColorTmp.setHex(flashHex);
    u.uHitFlashColor.value.copy(_hitFlashColorTmp);
  }
  const info = renderer?.info?.render;
  if (info) {
    if (_lastFlashMat === material && _lastFlashFrame === info.frame && _lastFlashCalls === info.calls) {
      if (prevVal !== flashVal || prevHex !== flashHex) {
        const prog = renderer.properties?.get?.(material)?.currentProgram;
        if (prog && renderer.getContext) {
          const gl = renderer.getContext();
          const uMap = prog.getUniforms().map;
          uMap.uHitFlash?.setValue(gl, flashVal);
          if (prevHex !== flashHex) uMap.uHitFlashColor?.setValue(gl, u.uHitFlashColor.value);
        }
      }
    }
    _lastFlashMat = material;
    _lastFlashFrame = info.frame;
    _lastFlashCalls = info.calls + 1;
  }
}

function ensureHitFlashShader(mat) {
  if (!mat || mat.userData?.noFlash || mat.userData?._hitFlashPatched) return;
  if (typeof mat.onBeforeCompile !== 'function' || typeof mat.customProgramCacheKey !== 'function') return;
  const prevCompile = mat.onBeforeCompile;
  const prevCacheKey = mat.customProgramCacheKey;
  const uniforms = {
    uHitFlash: { value: 0 },
    uHitFlashColor: { value: new THREE.Color(0xff4444) },
    uHitFlashHex: 0xff4444
  };
  mat.userData = mat.userData || {};
  mat.userData._hitFlashUniforms = uniforms;
  mat.userData._hitFlashPatched = true;
  mat.onBeforeCompile = (shader, renderer) => {
    if (prevCompile) prevCompile.call(mat, shader, renderer);
    shader.uniforms.uHitFlash = uniforms.uHitFlash;
    shader.uniforms.uHitFlashColor = uniforms.uHitFlashColor;
    if (!shader.fragmentShader.includes('uniform float uHitFlash;')) {
      shader.fragmentShader = shader.fragmentShader.replace(
        'void main() {',
        'uniform float uHitFlash;\nuniform vec3 uHitFlashColor;\nvoid main() {'
      );
    }
    if (shader.fragmentShader.includes('#include <emissivemap_fragment>')) {
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <emissivemap_fragment>',
        '#include <emissivemap_fragment>\n  totalEmissiveRadiance += uHitFlashColor * uHitFlash;'
      );
    } else if (shader.fragmentShader.includes('#include <opaque_fragment>')) {
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <opaque_fragment>',
        'outgoingLight += uHitFlashColor * uHitFlash;\n  #include <opaque_fragment>'
      );
    }
  };
  mat.customProgramCacheKey = () => {
    const prev = prevCacheKey ? prevCacheKey.call(mat) : '';
    return prev ? `${prev}|hit-flash` : 'hit-flash';
  };
  mat.needsUpdate = true;
}

function patchMeshHitFlash(mesh, flashHex = 0xff4444) {
  if (!mesh || !mesh.isMesh || mesh.userData?.noFlash || !mesh.material) return false;
  const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  let anyNoFlash = false;
  for (let i = 0; i < mats.length; i++) {
    const m = mats[i];
    if (m?.userData?.noFlash) { anyNoFlash = true; continue; }
    ensureHitFlashShader(m);
  }
  if (anyNoFlash && mats.length === 1) return false;
  mesh.userData = mesh.userData || {};
  mesh.userData._flashVal = 0;
  mesh.userData._flashHex = flashHex;
  mesh.onBeforeRender = _hitFlashOnBeforeRender;
  return true;
}

function attachHitFlashSupport(group, flashHex = 0xff4444) {
  const meshes = [];
  group.traverse((child) => {
    if (patchMeshHitFlash(child, flashHex)) {
      meshes.push(child);
    }
  });

  group.userData._flashHex = flashHex;
  group.userData.flashMeshes = meshes;
  group.userData.hitFlashTimer = 0;
  group.userData.isFlashing = false;

  group.userData.setHitFlash = (intensity = 1.0) => {
    const amount = Math.max(0, Math.min(1, Number(intensity) || 0));
    group.userData.hitFlashTimer = amount;
    const shouldFlash = amount > 0.05;
    group.userData.isFlashing = shouldFlash;
    const flashVal = amount > 0.02 ? amount * 0.85 : 0;
    const list = group.userData.flashMeshes || [];
    for (let i = 0; i < list.length; i++) {
      list[i].userData._flashVal = flashVal;
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
    if (child.isInstancedMesh && typeof child.dispose === 'function') {
      child.dispose();
    }
    if (
      child.geometry &&
      !child.geometry.userData?.isCachedGLB &&
      !child.geometry.userData?.isSharedAsset &&
      !child.geometry.userData?.sharedAsset &&
      typeof child.geometry.dispose === 'function'
    ) {
      child.geometry.dispose();
    }
    const mats = Array.isArray(child.material) ? child.material : child.material ? [child.material] : [];
    for (const m of mats) {
      if (
        m &&
        !m.userData?.isCachedGLB &&
        !m.userData?.isSharedAsset &&
        !m.userData?.sharedAsset &&
        (!keepMaterials || !keepMaterials.has(m)) &&
        typeof m.dispose === 'function'
      ) {
        m.dispose();
      }
    }
    if (typeof child.userData?.disposeFx === 'function') {
      child.userData.disposeFx();
    }
  });
}

function enableSafeFrustumCulling(obj, minRadius = 2.8) {
  if (!obj) return;
  const s = Math.max(0.05, obj.scale?.x || 1);
  const localMinRadius = minRadius / s;
  obj.traverse((c) => {
    if (!c.isMesh) return;
    if (c.geometry && !c.geometry.boundingSphere) c.geometry.computeBoundingSphere?.();
    if (c.isSkinnedMesh && typeof c.computeBoundingSphere === 'function') {
      c.computeBoundingSphere();
      if (c.boundingSphere && c.boundingSphere.radius < localMinRadius) c.boundingSphere.radius = localMinRadius;
    }
    c.frustumCulled = true;
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
  const shaftMat = getCachedAsset(_arrowMatCache, 'shaft', () => new THREE.MeshStandardMaterial({ color: 0x8b5a2b, roughness: 0.6 }));
  const headMat = getCachedAsset(_arrowMatCache, `head:${headColor}`, () => new THREE.MeshStandardMaterial({ color: headColor, metalness: 0.8, roughness: 0.25 }));
  const fletchMat = getCachedAsset(_arrowMatCache, `fletch:${color}`, () => new THREE.MeshStandardMaterial({ color, roughness: 0.5, side: THREE.DoubleSide }));

  const shaftGeo = getCachedAsset(_arrowGeoCache, `shaft:${length}`, () => new THREE.CylinderGeometry(0.012, 0.012, length, 5));
  const headGeo = getCachedAsset(_arrowGeoCache, 'head', () => new THREE.ConeGeometry(0.03, 0.09, 5));
  const fletchAGeo = getCachedAsset(_arrowGeoCache, 'fletchA', () => new THREE.BoxGeometry(0.12, 0.05, 0.004));
  const fletchBGeo = getCachedAsset(_arrowGeoCache, 'fletchB', () => new THREE.BoxGeometry(0.12, 0.004, 0.05));

  const shaft = new THREE.Mesh(shaftGeo, shaftMat);
  shaft.rotation.z = Math.PI / 2;
  shaft.position.x = length * 0.5;
  g.add(shaft);
  const head = new THREE.Mesh(headGeo, headMat);
  head.rotation.z = -Math.PI / 2;
  head.position.x = length + 0.04;
  g.add(head);
  const fletchA = new THREE.Mesh(fletchAGeo, fletchMat);
  fletchA.position.x = 0.07;
  const fletchB = new THREE.Mesh(fletchBGeo, fletchMat);
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
  // Materials recolored by alchemy glow / imbue (flagged noFlash so hit-flash never overwrites them)
  group.userData.glowMats = [];
  group.userData.tipLocal = new THREE.Vector3(0, 0.7, 0);

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

    group.userData.glowMats.push(bladeMat);
    group.userData.tipLocal.set(0.2, 0.65, 0);
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
    group.userData.glowMats.push(bladeMat);
    group.userData.tipLocal.set(0, 0.72, 0);
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
    group.userData.glowMats.push(guardMat, orbMat);
    group.userData.tipLocal.set(0, topY, 0);

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
    group.userData.glowMats.push(limbMat);
    group.userData.tipLocal.set(0, 0, 0);
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
    group.userData.glowMats.push(bladeMat);
    group.userData.tipLocal.set(0, 0.18 + bladeLen * 0.85, 0);
  }

  for (const m of group.userData.glowMats) {
    m.userData.noFlash = true;
    m.userData.glowBase = { emissive: m.emissive.clone(), intensity: m.emissiveIntensity ?? 0 };
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

export const SRO_CHAR_GLB_MAP = {
  knight: '/assets/sro/char/chinaman_warrior.glb',
  axeman: '/assets/sro/char/europeman_adventurer.glb',
  wizard: '/assets/sro/char/europeman_adventurer.glb',
  archer: '/assets/sro/char/chinaman_adventurer.glb'
};

export const SRO_STARTER_SETS = {
  knight: 'heavy_01',
  axeman: 'light_01',
  wizard: 'clothes_01',
  archer: 'light_01'
};

export function getEquipmentGlbTier(item) {
  if (!item) return '01';
  const m = String(item.visualModel || item.visualGlb || item.icon || item.baseId || item.id || '').match(/(?:sword|blade|tblade|spear|staff|bow|axe|shield|heavy|light|clothes)_0?([1-4])/i);
  if (m) return '0' + m[1];
  const t = Number(item.tier ?? itemVisualTier(item) ?? 0);
  if (t >= 3) return '04';
  if (t === 2) return '03';
  if (t === 1) return '02';
  const lvl = Number(item.levelReq || item.reqLevel || item.level || 1);
  if (lvl >= 16) return '04';
  if (lvl >= 10) return '03';
  if (lvl >= 5) return '02';
  return '01';
}

export function getArmorVisualSet(item, defaultType = 'heavy') {
  if (!item) return null;
  if (item.visualSet) return item.visualSet;
  const m = String(item.icon || item.visualGlb || item.baseId || item.id || '').match(/(heavy|light|clothes)_0?([1-4])/i);
  if (m) return `${m[1].toLowerCase()}_0${m[2]}`;

  let type = defaultType;
  const sub = String(item.armorFamily || item.subType || item.subtype || item.type || item.armorType || '').toLowerCase();
  if (sub.includes('plate') || sub.includes('heavy')) type = 'heavy';
  else if (sub.includes('leather') || sub.includes('light') || sub.includes('mail')) type = 'light';
  else if (sub.includes('cloth') || sub.includes('robe') || sub.includes('clothes')) type = 'clothes';

  const tier = getEquipmentGlbTier(item);
  return `${type}_${tier}`;
}

export function getWeaponGlbInfo(weapon, classId) {
  const cls = getClass(classId);
  const defaultSub = cls?.weapons?.[0] || 'sword';
  const rawSub = String(weapon?.subType || weapon?.subtype || '').toLowerCase();
  const probe = `${rawSub} ${weapon?.baseId || ''} ${weapon?.visualModel || ''} ${weapon?.name || ''}`.toLowerCase().trim() || defaultSub;
  const tier = getEquipmentGlbTier(weapon);

  // Staves & axes are always procedural European meshes, whatever an old save's visualModel says
  if (rawSub === 'staff' || (!rawSub && classId === 'wizard' && !/spear|bow|sword|blade|axe/.test(probe))) return { file: null, type: 'staff', tier, procedural: true };
  if (rawSub === 'axe') return { file: null, type: 'axe', tier, procedural: true };

  const m = String(weapon?.visualModel || weapon?.visualGlb || weapon?.icon || weapon?.baseId || weapon?.id || '').match(/(sword|blade|tblade|spear|staff|bow|axe|shield)_0?([1-4])/i);
  if (m) {
    const matchedType = m[1].toLowerCase();
    const procedural = matchedType === 'staff' || matchedType === 'axe';
    return { file: procedural ? null : `${matchedType}_0${m[2]}.glb`, type: matchedType, tier: '0' + m[2], procedural };
  }

  let glbBase = 'sword';
  if (probe.includes('bow') || classId === 'archer') glbBase = 'bow';
  else if (probe.includes('axe') || probe.includes('cleaver') || classId === 'axeman') glbBase = 'axe';
  else if (probe.includes('tblade') || probe.includes('glaive')) glbBase = 'tblade';
  else if (probe.includes('staff') || probe.includes('wand') || probe.includes('rod') || probe.includes('scepter') || classId === 'wizard') glbBase = 'staff';
  else if (probe.includes('spear') || probe.includes('pole')) glbBase = 'spear';
  else if (probe.includes('dagger') || probe.includes('blade') || probe.includes('mace') || classId === 'knight') glbBase = 'blade';
  else glbBase = 'sword';

  const procedural = glbBase === 'staff' || glbBase === 'axe';
  return { file: procedural ? null : `${glbBase}_${tier}.glb`, type: glbBase, tier, procedural };
}

/**
 * Create a high-detail 3D European Battle Axe mesh oriented for Silkroad hand sockets (+Z shaft, X blade edge).
 */
export function createEuropeanAxeMesh(weaponItem = null, tierStr = '01', isOffhand = false) {
  const g = new THREE.Group();
  g.name = isOffhand ? `EuropeanAxeOffhand_${tierStr}` : `EuropeanAxeMain_${tierStr}`;
  const degNum = Math.max(1, Math.min(4, parseInt(tierStr, 10) || 1));
  const itemTier = Number(weaponItem?.tier ?? (degNum - 1));

  const styles = [
    { shaftCol: 0x5c3a21, metalCol: 0xb8c2cc, edgeCol: 0xe2e8f0, gemCol: 0xd97706, len: 0.72, bladeW: 0.21, bladeH: 0.23, double: false },
    { shaftCol: 0x4a2c18, metalCol: 0x94a3b8, edgeCol: 0xf1f5f9, gemCol: 0x38bdf8, len: 0.78, bladeW: 0.24, bladeH: 0.26, double: true },
    { shaftCol: 0x451a1c, metalCol: 0xd97706, edgeCol: 0xfef08a, gemCol: 0xef4444, len: 0.84, bladeW: 0.27, bladeH: 0.30, double: true },
    { shaftCol: 0x31102f, metalCol: 0xf59e0b, edgeCol: 0xfef9c3, gemCol: 0xc084fc, len: 0.90, bladeW: 0.31, bladeH: 0.34, double: true }
  ];
  const st = styles[degNum - 1] || styles[0];
  const scaleMult = 1 + Math.max(0, itemTier - (degNum - 1)) * 0.03;

  const shaftMat = new THREE.MeshStandardMaterial({ color: st.shaftCol, roughness: 0.55, metalness: 0.25, side: THREE.DoubleSide });
  const metalMat = new THREE.MeshStandardMaterial({ color: st.metalCol, roughness: 0.25, metalness: 0.85, side: THREE.DoubleSide });
  const edgeMat = new THREE.MeshStandardMaterial({
    color: st.edgeCol,
    roughness: 0.18,
    metalness: 0.92,
    emissive: new THREE.Color(st.gemCol),
    emissiveIntensity: degNum >= 3 ? 0.18 : 0.06,
    side: THREE.DoubleSide
  });
  const gemMat = new THREE.MeshStandardMaterial({
    color: st.gemCol,
    emissive: new THREE.Color(st.gemCol),
    emissiveIntensity: 0.75,
    roughness: 0.15,
    metalness: 0.5,
    side: THREE.DoubleSide
  });

  // Main shaft along +Z (grip at z=0, pommel at z=-0.16, head at z=headZ)
  const shaftLen = st.len * scaleMult;
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.019, shaftLen, 10), shaftMat);
  shaft.rotation.x = Math.PI / 2;
  shaft.position.z = shaftLen * 0.5 - 0.16;
  g.add(shaft);

  // Grip leather rings near hand (z = -0.08 .. +0.10)
  for (let i = -2; i <= 2; i++) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.024, 0.005, 6, 12), metalMat);
    ring.position.z = i * 0.045;
    g.add(ring);
  }

  // Pommel cap & spike at z = -0.17
  const pommel = new THREE.Mesh(new THREE.OctahedronGeometry(0.036, 0), metalMat);
  pommel.position.z = -0.17;
  g.add(pommel);

  const headZ = shaftLen - 0.30;
  // Heavy metallic axe collar
  const collar = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.055, 0.15), metalMat);
  collar.position.z = headZ;
  g.add(collar);

  // Top spear spike
  const topSpike = new THREE.Mesh(new THREE.ConeGeometry(0.028, 0.17, 6), edgeMat);
  topSpike.rotation.x = Math.PI / 2;
  topSpike.position.z = headZ + 0.14;
  g.add(topSpike);

  // Core jewel on both sides of the collar
  const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.034, 0), gemMat);
  gem.scale.set(1.1, 1.35, 1.1);
  gem.position.z = headZ;
  g.add(gem);

  // Sculpted crescent battle-axe blade helper (side = -1 for front edge, +1 for back blade)
  const addCrescentBlade = (side, widthScale = 1.0) => {
    const w = st.bladeW * widthScale * scaleMult;
    const h = st.bladeH * scaleMult;
    const shape = new THREE.Shape();
    shape.moveTo(0, -h * 0.32);
    shape.quadraticCurveTo(w * 0.55, -h * 0.42, w * 0.92, -h * 0.58);
    shape.quadraticCurveTo(w * 1.18, 0, w * 0.92, h * 0.58);
    shape.quadraticCurveTo(w * 0.55, h * 0.42, 0, h * 0.32);
    shape.closePath();

    const extrude = new THREE.ExtrudeGeometry(shape, {
      depth: 0.018,
      bevelEnabled: true,
      bevelSegments: 2,
      steps: 1,
      bevelSize: 0.008,
      bevelThickness: 0.008
    });
    // Orient shape X -> side * X, shape Y -> Z (along shaft), depth -> Y (thin thickness)
    const bladeMesh = new THREE.Mesh(extrude, edgeMat);
    bladeMesh.rotation.x = Math.PI / 2;
    if (side < 0) {
      bladeMesh.scale.x = -1;
    }
    bladeMesh.position.set(side * 0.025, 0.009, headZ);
    g.add(bladeMesh);

    // Inner armour plate backing the blade
    const innerPlate = new THREE.Mesh(new THREE.BoxGeometry(w * 0.58, 0.028, h * 0.56), metalMat);
    innerPlate.position.set(side * (0.03 + w * 0.28), 0, headZ);
    g.add(innerPlate);
  };

  addCrescentBlade(-1, 1.0);
  if (st.double) {
    addCrescentBlade(1, 0.94);
  } else {
    // Degree 01 back tactical spike
    const backSpike = new THREE.Mesh(new THREE.ConeGeometry(0.026, 0.14, 5), metalMat);
    backSpike.rotation.z = -Math.PI / 2;
    backSpike.position.set(0.09, 0, headZ);
    g.add(backSpike);
  }

  g.traverse((c) => {
    if (c.isMesh) {
      c.frustumCulled = false;
      c.castShadow = true;
      c.receiveShadow = true;
      c.userData._origMat = c.material;
    }
  });
  if (isOffhand) {
    // Bip01 L Hand carries ~180deg Z-axis roll relative to Bip01 R HandMid in europeman_adventurer.glb
    g.rotation.z = Math.PI;
  }
  return g;
}

/**
 * Create a 3D European two-handed Wizard staff oriented for Silkroad hand sockets
 * (+Z shaft, grip at origin, ornate crystal head towards +Z).
 */
export function createEuropeanStaffMesh(weaponItem = null, tierStr = '01') {
  const g = new THREE.Group();
  const degNum = Math.max(1, Math.min(4, parseInt(tierStr, 10) || 1));
  g.name = `EuropeanStaff_0${degNum}`;
  const styles = [
    { wood: 0x6b4423, metal: 0xa8a29e, gem: 0x60a5fa, len: 1.55, prongs: 0, orb: 0.07 },
    { wood: 0x4a2f1b, metal: 0xcbd5e1, gem: 0x22d3ee, len: 1.65, prongs: 3, orb: 0.08 },
    { wood: 0x2e1a2f, metal: 0xd4a017, gem: 0xa855f7, len: 1.75, prongs: 4, orb: 0.09 },
    { wood: 0x1c1030, metal: 0xfacc15, gem: 0xf43f5e, len: 1.85, prongs: 5, orb: 0.1 },
  ];
  const st = styles[degNum - 1] || styles[0];
  const sealId = String(weaponItem?.seal || '').toLowerCase().replace(/^sealof/, '');
  const rarity = String(weaponItem?.rarity || '').toLowerCase();
  const gemCol = sealId === 'sun' ? 0xfbbf24
    : sealId === 'moon' ? 0xc4b5fd
    : sealId === 'star' ? 0x7dd3fc
    : rarity === 'unique' ? 0xf97316
    : rarity === 'epic' ? 0xa855f7
    : rarity === 'rare' ? 0xfacc15
    : rarity === 'magic' ? 0x38bdf8
    : st.gem;

  const woodMat = new THREE.MeshStandardMaterial({ color: st.wood, roughness: 0.7, metalness: 0.08 });
  const metalMat = new THREE.MeshStandardMaterial({ color: st.metal, roughness: 0.28, metalness: 0.88 });
  const gemMat = new THREE.MeshStandardMaterial({
    color: gemCol, emissive: new THREE.Color(gemCol), emissiveIntensity: 0.95, roughness: 0.1, metalness: 0.2,
    transparent: true, opacity: 0.92,
  });

  const butt = -0.45;
  const headZ = butt + st.len;
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.019, 0.024, st.len, 10), woodMat);
  shaft.rotation.x = Math.PI / 2;
  shaft.position.z = butt + st.len / 2;
  g.add(shaft);

  // Metal ferrule, grip bands and spiral inlay
  const ferrule = new THREE.Mesh(new THREE.ConeGeometry(0.026, 0.09, 8), metalMat);
  ferrule.rotation.x = -Math.PI / 2;
  ferrule.position.z = butt - 0.03;
  g.add(ferrule);
  for (const z of [-0.12, 0.0, 0.12, headZ - 0.32]) {
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.025, 0.006, 6, 14), metalMat);
    band.position.z = z;
    g.add(band);
  }

  // Head: flared collar + cradle prongs holding a glowing crystal orb
  const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.022, 0.12, 10), metalMat);
  collar.rotation.x = Math.PI / 2;
  collar.position.z = headZ - 0.06;
  g.add(collar);
  const orbZ = headZ + st.orb + 0.02;
  const orb = new THREE.Mesh(new THREE.IcosahedronGeometry(st.orb, 1), gemMat);
  orb.position.z = orbZ;
  orb.userData.isStaffOrb = true;
  g.add(orb);
  const prongCount = st.prongs || 2;
  for (let i = 0; i < prongCount; i++) {
    const a = (i / prongCount) * Math.PI * 2;
    const pivot = new THREE.Group();
    pivot.position.set(Math.cos(a) * 0.035, Math.sin(a) * 0.035, headZ);
    pivot.rotation.z = a;
    const prong = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.01, st.orb * 2.6, 5), metalMat);
    prong.rotation.x = Math.PI / 2;
    prong.rotation.y = -0.35;
    prong.position.set(st.orb * 0.55, 0, st.orb * 1.2);
    pivot.add(prong);
    g.add(pivot);
  }
  if (!st.prongs) {
    // Degree 01: simple crescent hook around the orb
    const hook = new THREE.Mesh(new THREE.TorusGeometry(st.orb * 1.4, 0.012, 6, 16, Math.PI * 1.3), metalMat);
    hook.rotation.y = Math.PI / 2;
    hook.position.z = orbZ;
    g.add(hook);
  }
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.018, 0.1, 6), metalMat);
  tip.rotation.x = Math.PI / 2;
  tip.position.z = orbZ + st.orb + 0.07;
  g.add(tip);

  g.traverse((c) => {
    if (c.isMesh) {
      c.frustumCulled = false;
      c.castShadow = true;
      c.receiveShadow = true;
      c.userData._origMat = c.material;
    }
  });
  return g;
}

/**
 * Weapon-specific clips per class (all embedded in the class character GLB).
 * Each logical slot lists candidates in priority order; the first existing clip wins.
 */
/* ---------------- equipment +N / seal FX (small, animated, stackable) ---------------- */
const GEAR_PLUS_TIERS = [
  null,
  { color: 0x7dd3fc, base: 0.22, amp: 0.10, sparkles: 0 },  // +3..+4 faint frost shimmer
  { color: 0x60a5fa, base: 0.32, amp: 0.14, sparkles: 3 },  // +5..+6 blue glints
  { color: 0xa78bfa, base: 0.42, amp: 0.18, sparkles: 4 },  // +7..+8 violet
  { color: 0xfacc15, base: 0.55, amp: 0.22, sparkles: 6 }   // +9 and above, gold
];
const GEAR_SEAL_FX = {
  star: { color: 0x7dd3fc, particle: 0xe0f2fe, tex: 'star', count: 5 },
  moon: { color: 0xc4b5fd, particle: 0xd8b4fe, tex: 'dot', count: 4 },
  sun: { color: 0xfbbf24, particle: 0xfde68a, tex: 'dot', count: 6 }
};

/** Pure description of the visual FX an item should get (+3 and above glow, seal particles). */
export function gearFxProfile(item) {
  if (!item) return null;
  const plus = Number(item.plus ?? item.enhance ?? 0) || 0;
  const sealId = String(item.seal || '').toLowerCase().replace(/^sealof/, '');
  const seal = GEAR_SEAL_FX[sealId] ? sealId : null;
  const tierIdx = plus >= 9 ? 4 : plus >= 7 ? 3 : plus >= 5 ? 2 : plus >= 3 ? 1 : 0;
  if (!tierIdx && !seal) return null;
  const tier = GEAR_PLUS_TIERS[tierIdx];
  const sealFx = seal ? GEAR_SEAL_FX[seal] : null;
  let glowHex = tier ? tier.color : sealFx.color;
  if (tier && sealFx) glowHex = new THREE.Color(tier.color).lerp(new THREE.Color(sealFx.color), 0.35).getHex();
  // When both are present the seal particles lead, so +N glints are halved to avoid clutter
  const sparkles = tier ? (sealFx ? Math.ceil(tier.sparkles / 2) : tier.sparkles) : 0;
  return {
    plus,
    plusTier: tierIdx,
    seal,
    glowHex,
    base: tier ? tier.base : 0.25,
    amp: tier ? tier.amp : 0.08,
    sparkles,
    sparkleHex: tier ? tier.color : null,
    sealParticles: sealFx ? sealFx.count : 0
  };
}

const _gearFxTex = {};
function gearFxTexture(kind) {
  if (_gearFxTex[kind]) return _gearFxTex[kind];
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  if (kind === 'star') {
    g.fillStyle = 'rgba(255,255,255,0.9)';
    g.beginPath();
    g.moveTo(32, 2); g.quadraticCurveTo(35, 29, 62, 32); g.quadraticCurveTo(35, 35, 32, 62);
    g.quadraticCurveTo(29, 35, 2, 32); g.quadraticCurveTo(29, 29, 32, 2);
    g.fill();
    const core = g.createRadialGradient(32, 32, 0, 32, 32, 12);
    core.addColorStop(0, 'rgba(255,255,255,1)');
    core.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = core;
    g.fillRect(0, 0, 64, 64);
  } else {
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.3, 'rgba(255,255,255,0.55)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  _gearFxTex[kind] = t;
  return t;
}

function makeFxSprite(hex, texKind) {
  const mat = new THREE.SpriteMaterial({
    color: hex,
    map: gearFxTexture(texKind),
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
  const sp = new THREE.Sprite(mat);
  sp.userData.isGlowShell = true;
  sp.frustumCulled = false;
  sp.renderOrder = 5;
  return sp;
}

/** Glow follows the texture detail instead of painting the whole mesh a flat color. */
function useTextureGlow(mats) {
  for (const m of mats) {
    if (m.map && m.emissiveMap !== m.map) {
      m.emissiveMap = m.map;
      m.needsUpdate = true;
    }
  }
}

/** Adds a soft fresnel rim in the gear color; returns the uniforms so the strength can pulse per frame. */
function addRimGlow(mats, hex) {
  const uniforms = [];
  for (const m of mats) {
    const u = { uRimColor: { value: new THREE.Color(hex) }, uRimStrength: { value: 0 } };
    m.onBeforeCompile = (shader) => {
      shader.uniforms.uRimColor = u.uRimColor;
      shader.uniforms.uRimStrength = u.uRimStrength;
      shader.fragmentShader = shader.fragmentShader
        .replace('void main() {', 'uniform vec3 uRimColor;\nuniform float uRimStrength;\nvoid main() {')
        .replace('#include <opaque_fragment>', `#include <opaque_fragment>
#if defined( USE_GEAR_RIM )
  float gearRim = pow( 1.0 - clamp( dot( normalize( normal ), normalize( vViewPosition ) ), 0.0, 1.0 ), 2.6 );
  gl_FragColor.rgb += uRimColor * gearRim * uRimStrength;
#endif`);
    };
    m.defines = { ...(m.defines || {}), USE_GEAR_RIM: '' };
    m.customProgramCacheKey = () => 'gear-rim';
    m.needsUpdate = true;
    uniforms.push(u);
  }
  return uniforms;
}

function collectEmissiveMats(obj) {
  const mats = [];
  obj.traverse((child) => {
    if (!child.isMesh || child.userData.isGlowShell || !child.material) return;
    const cloned = Array.isArray(child.material) ? child.material.map((m) => m.clone()) : child.material.clone();
    child.material = cloned;
    child.userData._origMat = cloned;
    for (const m of Array.isArray(cloned) ? cloned : [cloned]) if (m.emissive) mats.push(m);
  });
  useTextureGlow(mats);
  return mats;
}

/**
 * Builds the animated FX for one equipped weapon/offhand: a breathing emissive glow for +3 and above,
 * small glints running along the blade, and seal particles (Star twinkles, Moon orbiting motes,
 * Sun rising embers). Returns an updater `(time, dt) => void` or null.
 */
function buildWeaponGearFx(modelClone, item) {
  const prof = gearFxProfile(item);
  if (!modelClone || !prof) return null;
  const mats = collectEmissiveMats(modelClone);
  const glow = new THREE.Color(prof.glowHex);
  const wBase = prof.base * 1.35;
  const wAmp = prof.amp * 1.35;
  for (const m of mats) { m.emissive.copy(glow); m.emissiveIntensity = wBase; }
  const rims = addRimGlow(mats, prof.glowHex);
  const rimBase = 0.3 + prof.plusTier * 0.12;

  // Local-space bounds of the weapon (computed before it is attached to a socket)
  modelClone.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(modelClone);
  if (box.isEmpty()) return (time) => {
    const b = Math.sin(time * 2.2);
    for (const m of mats) m.emissiveIntensity = wBase + wAmp * b;
    for (const r of rims) r.uRimStrength.value = rimBase * (0.75 + 0.25 * b);
  };
  box.applyMatrix4(new THREE.Matrix4().copy(modelClone.matrixWorld).invert());
  const size = box.getSize(new THREE.Vector3());
  const axis = size.z >= size.x && size.z >= size.y ? 'z' : size.y >= size.x ? 'y' : 'x';
  const len = Math.max(0.2, size[axis]);
  const lo = box.min[axis];
  const hi = box.max[axis];
  const center = box.getCenter(new THREE.Vector3());
  const pointAt = (u, out = new THREE.Vector3()) => { out.copy(center); out[axis] = lo + (hi - lo) * u; return out; };
  const spriteSize = len * 0.11;

  const fxGroup = new THREE.Group();
  fxGroup.name = 'GearFx';
  fxGroup.userData.isGlowShell = true;
  modelClone.add(fxGroup);

  const glints = [];
  for (let i = 0; i < prof.sparkles; i++) {
    const sp = makeFxSprite(prof.sparkleHex, 'dot');
    fxGroup.add(sp);
    glints.push({ sp, phase: i / Math.max(1, prof.sparkles), speed: 0.28 + (i % 3) * 0.06 });
  }

  const sealParts = [];
  const sealFx = prof.seal ? GEAR_SEAL_FX[prof.seal] : null;
  for (let i = 0; i < prof.sealParticles; i++) {
    const sp = makeFxSprite(sealFx.particle, sealFx.tex);
    fxGroup.add(sp);
    sealParts.push({ sp, u: 0.35 + 0.6 * ((i * 0.618) % 1), phase: i * 1.37, life: (i / prof.sealParticles) });
  }

  const tmp = new THREE.Vector3();
  const qInv = new THREE.Quaternion();
  const up = new THREE.Vector3();
  const perpA = axis === 'x' ? 'y' : 'x';
  const perpB = axis === 'z' ? 'y' : 'z';

  return (time, dt) => {
    const breathe = Math.sin(time * 2.2);
    for (const m of mats) m.emissiveIntensity = wBase + wAmp * breathe;
    for (const r of rims) r.uRimStrength.value = rimBase * (0.75 + 0.25 * breathe);

    for (const g of glints) {
      const u = (g.phase + time * g.speed) % 1;
      pointAt(0.3 + u * 0.68, g.sp.position);
      g.sp.material.opacity = Math.sin(u * Math.PI) * 0.95;
      g.sp.scale.setScalar(spriteSize * (0.7 + 0.3 * Math.sin(u * Math.PI)));
    }

    if (!sealParts.length) return;
    if (prof.seal === 'sun') {
      modelClone.getWorldQuaternion(qInv).invert();
      up.set(0, 1, 0).applyQuaternion(qInv);
      const ws = modelClone.getWorldScale(tmp).x || 1;
      up.multiplyScalar(1 / ws);
    }
    for (const p of sealParts) {
      if (prof.seal === 'star') {
        // Short twinkle flashes at fixed points on the weapon
        const tw = Math.max(0, Math.sin(time * 1.9 + p.phase));
        const flash = tw ** 8;
        pointAt(p.u, p.sp.position);
        p.sp.material.opacity = 0.15 + flash * 0.85;
        p.sp.scale.setScalar(spriteSize * (0.9 + flash * 1.4));
        p.sp.material.rotation = time * 0.6 + p.phase;
      } else if (prof.seal === 'moon') {
        // Slow motes spiralling around the weapon
        const a = time * 0.9 + p.phase;
        const u = 0.3 + ((p.u + time * 0.07) % 1) * 0.68;
        pointAt(u, p.sp.position);
        p.sp.position[perpA] += Math.cos(a) * len * 0.07;
        p.sp.position[perpB] += Math.sin(a) * len * 0.07;
        p.sp.material.opacity = 0.35 + 0.3 * Math.sin(a * 0.7) ** 2;
        p.sp.scale.setScalar(spriteSize * 0.9);
      } else {
        // Sun: warm embers that rise from the weapon and fade out
        p.life += dt * 0.55;
        if (p.life >= 1) { p.life -= 1; p.u = 0.35 + Math.random() * 0.6; }
        pointAt(p.u, p.sp.position);
        p.sp.position.addScaledVector(up, p.life * 0.18);
        p.sp.material.opacity = Math.sin(p.life * Math.PI) * 0.75;
        p.sp.scale.setScalar(spriteSize * (1 - p.life * 0.5));
      }
    }
  };
}

/** Armor pieces are skinned, so they only get a gentle emissive shimmer (seal pattern + plus glow). */
function buildArmorGearFx(clonedArmor, item) {
  const prof = gearFxProfile(item);
  if (!clonedArmor || !prof) return null;
  const mats = [];
  clonedArmor.traverse((child) => {
    if (!child.isMesh || child.userData.isGlowShell || !child.material) return;
    for (const m of Array.isArray(child.material) ? child.material : [child.material]) if (m.emissive) mats.push(m);
  });
  if (!mats.length) return null;
  useTextureGlow(mats);
  const glow = new THREE.Color(prof.glowHex);
  const base = prof.base * 0.45;
  const amp = prof.amp * 0.45;
  for (const m of mats) { m.emissive.copy(glow); m.emissiveIntensity = base; }
  const rims = addRimGlow(mats, prof.glowHex);
  const rimBase = prof.plusTier ? 0.25 + prof.plusTier * 0.12 : 0.22;
  return (time) => {
    const rb = Math.sin(time * 1.8);
    for (const r of rims) r.uRimStrength.value = rimBase * (0.7 + 0.3 * rb);
    let k = base + amp * Math.sin(time * 1.8);
    if (prof.seal === 'star') k += Math.max(0, Math.sin(time * 1.3)) ** 12 * 0.1;
    else if (prof.seal === 'moon') k += 0.04 * Math.sin(time * 0.8);
    else if (prof.seal === 'sun') k += 0.03 * Math.sin(time * 7.3) * Math.sin(time * 2.1);
    for (const m of mats) m.emissiveIntensity = Math.max(0, k);
  };
}

export const CLASS_CLIP_MAP = {
  knight: {
    RUN: ['RUN_chinaman_fighter_runforward_sword'],
    ATTACK1: ['ATTACK1_sword_base_01'],
    ATTACK2: ['ATTACK2_sword_base_02'],
    ATTACK3: ['ATTACK3_sword_base_03'],
    ATTACK4: ['ATTACK4_sword_base_04'],
    CAST1: ['SKILL_1_skill_ch_sword_smash_a'],
    CAST2: ['SKILL_2_skill_ch_sword_chain_a'],
    CAST3: ['SKILL_5_skill_ch_sword_geomgi_a'],
    CAST4: ['SKILL_7_skill_ch_sword_downattack_a'],
    DEFENCE: ['SKILL_3_skill_ch_sword_shield_wait'],
  },
  axeman: {
    RUN: ['RUN_europe_man_fighter_dagger_run_2', 'RUN_europe_man_fighter_dagger_run'],
    ATTACK1: ['ATTACK1_skill_eu_warrior_duala_attack01'],
    ATTACK2: ['ATTACK2_skill_eu_warrior_duala_attack02'],
    ATTACK3: ['SKILL_10_skill_eu_warrior_duala_twist_a', 'ATTACK1_skill_eu_warrior_duala_attack01'],
    ATTACK4: ['SKILL_4_skill_eu_warrior_duala_cross_a'],
    CAST1: ['SKILL_4_skill_eu_warrior_duala_cross_a'],
    CAST2: ['SKILL_10_skill_eu_warrior_duala_twist_a'],
    CAST3: ['SKILL_40_skill_eu_warrior_duala_whirlwind_a'],
    CAST4: ['SKILL_40_skill_eu_warrior_twohanda_cry_a'],
  },
  wizard: {
    STAND1: ['ATTREADY_skill_eu_wizard_twohand_attack_ready', 'STAND1'],
    WALK: ['WALK', 'WALK_chinaman_fighter_walkforward'],
    RUN: ['RUN_europe_man_fighter_tstaff_run'],
    ATTACK1: ['ATTACK1_skill_eu_wizard_twohand_attack01'],
    ATTACK2: ['ATTACK1_skill_eu_wizard_twohand_attack01'],
    ATTACK3: ['SKILL_1_skill_eu_wizard_twohand_target_shot'],
    CAST1: ['SKILL_1_skill_eu_wizard_twohand_target_shot'],
    CAST2: ['SKILL_2_skill_eu_wizard_twohand_area_shot'],
    CAST3: ['SKILL_20_skill_eu_wizard_firea_spray_a'],
    CAST4: ['SKILL_2_skill_eu_wizard_twohand_area_shot', 'SKILL_1_skill_eu_wizard_twohand_target_shot'],
  },
  archer: {
    RUN: ['RUN_bow_run_fighter', 'RUN_bow_run_merchant'],
    ATTACK1: ['ATTACK1_skill_ch_bow_normal'],
    ATTACK2: ['ATTACK1_skill_ch_bow_normal'],
    ATTACK3: ['ATTACK1_skill_ch_bow_normal'],
    CAST1: ['SKILL_1_skill_ch_bow_critical_a'],
    CAST2: ['SKILL_2_skill_ch_bow_chain_a'],
    CAST3: ['SKILL_10_skill_ch_bow_power_a'],
    CAST4: ['SKILL_7_skill_ch_bow_area_a'],
    CAST5: ['SKILL_3_skill_ch_bow_call_a'],
  },
};

/* Shift guard: the left-arm pose of the shield stance clip, layered over STAND1/WALK so only the shield arm rises */
const GUARD_POSE_CLIP = 'SKILL_3_skill_ch_sword_shield_wait';
const GUARD_POSE_TIME = 1.0;
const GUARD_BONE_RE = /(^|[_ ])L[_ ](Clavicle|UpperArm|Forearm|Hand)$/i;

// Swing the raised shield arm forward in front of the chest (radians around the body up / right axes)
const GUARD_TUNE = { yaw: -1.0, pitch: 0.5 };
const _gq1 = new THREE.Quaternion();
const _gq2 = new THREE.Quaternion();
const _gq3 = new THREE.Quaternion();
const _gax = new THREE.Vector3();

function applyGuardArmSwing(root, upperArm, weight) {
  if (!upperArm || !upperArm.parent) return;
  const tune = root.userData.guardTune || GUARD_TUNE;
  upperArm.parent.updateWorldMatrix(true, false);
  const toParent = upperArm.parent.getWorldQuaternion(_gq1).invert();
  const rootQ = root.getWorldQuaternion(_gq2);
  _gax.set(0, 1, 0).applyQuaternion(rootQ).applyQuaternion(toParent);
  _gq3.setFromAxisAngle(_gax, tune.yaw * weight);
  upperArm.quaternion.premultiply(_gq3);
  _gax.set(1, 0, 0).applyQuaternion(rootQ).applyQuaternion(toParent);
  _gq3.setFromAxisAngle(_gax, tune.pitch * weight);
  upperArm.quaternion.premultiply(_gq3);
}

export function buildGuardPose(clips, skeletonRoot) {
  const clip = (clips || []).find((c) => c.name === GUARD_POSE_CLIP);
  if (!clip || !skeletonRoot) return null;
  const pose = [];
  const t = Math.min(GUARD_POSE_TIME, clip.duration);
  for (const track of clip.tracks) {
    const dot = track.name.lastIndexOf('.');
    const nodeName = track.name.slice(0, dot);
    if (track.name.slice(dot + 1) !== 'quaternion' || !GUARD_BONE_RE.test(nodeName)) continue;
    const bone = skeletonRoot.getObjectByName(nodeName);
    if (!bone) continue;
    const v = track.createInterpolant().evaluate(t);
    pose.push({ bone, quat: new THREE.Quaternion(v[0], v[1], v[2], v[3]).normalize() });
  }
  return pose.length ? pose : null;
}

const HERO_BASELINE_CLIPS = ['STAND1', 'WALK', 'RUN', 'DAMAGE1', 'DIE1'];

/** Point logical action slots (RUN, ATTACK1..4, CAST1/2, DEFENCE) at the class weapon clips. */
export function applyClassClipMap(actions, classId) {
  const map = CLASS_CLIP_MAP[classId];
  if (!actions || !map) return actions;
  for (const [slot, candidates] of Object.entries(map)) {
    const hit = candidates.find((n) => actions[n]);
    if (hit) actions[slot] = actions[hit];
  }
  return actions;
}

function createLazyActionMap(mixer, clips, classId, prebindNames, uniqueActions) {
  const clipsByName = new Map();
  for (const clip of clips || []) {
    if (clip && clip.name && !clipsByName.has(clip.name)) {
      clipsByName.set(clip.name, clip);
    }
  }
  const slotToClip = new Map();
  const classMap = CLASS_CLIP_MAP[classId];
  if (classMap) {
    for (const [slot, candidates] of Object.entries(classMap)) {
      const hitName = candidates.find((n) => clipsByName.has(n));
      if (hitName) slotToClip.set(slot, clipsByName.get(hitName));
    }
  }

  const clipToAction = new Map();
  const rawActions = {};

  const getOrCreateAction = (name) => {
    if (!name || typeof name !== 'string') return undefined;
    if (Object.prototype.hasOwnProperty.call(rawActions, name)) {
      return rawActions[name];
    }
    const clip = slotToClip.get(name) || clipsByName.get(name);
    if (!clip) return undefined;
    let act = clipToAction.get(clip);
    if (!act) {
      act = mixer.clipAction(clip);
      clipToAction.set(clip, act);
      if (!uniqueActions.includes(act)) {
        uniqueActions.push(act);
      }
    }
    rawActions[name] = act;
    return act;
  };

  for (const name of prebindNames) {
    getOrCreateAction(name);
  }

  const actions = new Proxy(rawActions, {
    get(target, prop) {
      if (typeof prop === 'string') {
        if (Object.prototype.hasOwnProperty.call(target, prop)) return target[prop];
        if (slotToClip.has(prop) || clipsByName.has(prop)) return getOrCreateAction(prop);
      }
      return Reflect.get(target, prop);
    },
    has(target, prop) {
      if (typeof prop === 'string' && (slotToClip.has(prop) || clipsByName.has(prop))) return true;
      return Reflect.has(target, prop);
    }
  });

  return { actions, getOrCreateAction };
}

/**
 * Create articulated 3D Hero mesh with dynamic equipment, class look & procedural combat animations.
 * @param {object} equipment equipped items map ({weapon, shield, armor, helmet, boots, ...})
 * @param {{classId?: string, appearance?: object}} look hero class + appearance (optional)
 */
export function createHeroMesh(equipment = {}, look = {}, opts = {}) {
  const isBrowser = typeof window !== 'undefined' && typeof document !== 'undefined';
  const isLightweightCrowd = Boolean(look?.lightweightCrowd || opts?.lightweightCrowd);
  const root = new THREE.Group();
  root.name = 'Hero';

  const bodyPivot = new THREE.Group();
  bodyPivot.position.y = 0.72;
  bodyPivot.visible = !isBrowser;
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

  // ---------------------------------------------------------------- hit flash (per-mesh uniform tint, no cloning or shared material mutation)
  attachHitFlashSupport(root, 0xffffff);
  const refreshFlashMaterials = () => {
    const meshes = root.userData.flashMeshes || (root.userData.flashMeshes = []);
    for (let i = meshes.length - 1; i >= 0; i--) {
      if (!meshes[i] || !meshes[i].parent) {
        const last = meshes.length - 1;
        if (i !== last) meshes[i] = meshes[last];
        meshes.pop();
      }
    }
    root.traverse((child) => {
      if (patchMeshHitFlash(child, 0xffffff) && !meshes.includes(child)) {
        meshes.push(child);
      }
    });
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

  // ---------------------------------------------------------------- tiered armor visuals (milestone 2)
  // Reusable attachment groups, cleared + rebuilt on every equipment change.
  const gear = {
    body: new THREE.Group(),
    head: new THREE.Group(),
    helm: new THREE.Group(),
    rArm: new THREE.Group(),
    lArm: new THREE.Group(),
    lLeg: new THREE.Group(),
    rLeg: new THREE.Group(),
    cape: new THREE.Group(),
    ground: new THREE.Group()
  };
  for (const k of Object.keys(gear)) gear[k].name = `Gear_${k}`;
  const gearParents = {
    body: bodyPivot,
    head: headGroup,
    helm: headGroup,
    rArm: rightArmPivot,
    lArm: leftArmPivot,
    lLeg: leftLegPivot,
    rLeg: rightLegPivot,
    cape: capePivot,
    ground: root
  };
  const gearState = {
    band: -1,
    tier: -1,
    bootBand: -1,
    setInfo: null,
    orbs: [],
    halo: null,
    glowStrips: [],
    shimmer: null,
    setAura: null,
    hatGem: null,
    baseOrbVisible: true
  };
  root.userData.gear = gear;
  root.userData.gearState = gearState;

  const FRONT_Z = { knight: 0.155, axeman: 0.18, wizard: 0.137, archer: 0.152 };
  const SHOULDER_X = { knight: 0.34, axeman: 0.42, wizard: 0.33, archer: 0.33 };

  /** Count equipped set pieces; returns { id, count, classId, color } for the best set with >= 3 pieces. */
  const detectSet = (equipped) => {
    const counts = {};
    for (const it of Object.values(equipped || {})) {
      if (it && typeof it === 'object' && it.setId) counts[it.setId] = (counts[it.setId] || 0) + 1;
    }
    let best = null;
    for (const [id, count] of Object.entries(counts)) {
      if (count >= 3 && (!best || count > best.count)) best = { id, count };
    }
    if (!best) return null;
    const classId = String(best.id).split('_')[0];
    const style = classSetStyle(classId);
    return { ...best, classId, color: style.primary, accent: style.accent };
  };

  const computeVisualTier = (equipped) => {
    const armor = equipped?.armor || null;
    const helmet = equipped?.helmet || null;
    const boots = equipped?.boots || null;
    let sum = 0;
    let w = 0;
    const at = itemVisualTier(armor);
    const ht = itemVisualTier(helmet);
    const bt = itemVisualTier(boots);
    if (at != null) { sum += at * 2; w += 2; }
    if (ht != null) { sum += ht; w += 1; }
    if (bt != null) { sum += bt; w += 1; }
    if (!w) return -1;
    return Math.max(0, Math.min(7, Math.round(sum / w)));
  };

  const clearGear = () => {
    for (const k of Object.keys(gear)) {
      clearGroup(gear[k], sharedMaterials);
      if (gear[k].parent !== gearParents[k]) gearParents[k].add(gear[k]); // capePivot is cleared by setLook
    }
    gearState.orbs = [];
    gearState.halo = null;
    gearState.glowStrips = [];
    gearState.shimmer = null;
    gearState.setAura = null;
    gearState.hatGem = null;
  };

  const buildGear = (equipped) => {
    clearGear();
    const classId = lookState.classId;
    const tier = computeVisualTier(equipped);
    const band = tier < 0 ? -1 : Math.min(3, Math.floor(tier / 2));
    const armor = equipped?.armor || null;
    const helmet = equipped?.helmet || null;
    const boots = equipped?.boots || null;
    const setInfo = detectSet(equipped);
    gearState.tier = tier;
    gearState.band = band;
    gearState.setInfo = setInfo;

    // Palette: set pieces use the class set style, generic gear the band defaults
    const armorSetCls = armor?.setId ? String(armor.setId).split('_')[0] : null;
    const style = armorSetCls ? classSetStyle(armorSetCls) : null;
    const gemColor = style ? style.primary : 0x2563eb;
    const goldColor = 0xd4a017;
    const armorSeal = sealColorOf(armor);
    const fz = FRONT_Z[classId] ?? 0.155;
    const sx = SHOULDER_X[classId] ?? 0.34;

    const M = (params, glow = false) => {
      const m = new THREE.MeshStandardMaterial(params);
      if (glow) {
        m.userData.noFlash = true;
        m.userData.glowBaseIntensity = m.emissiveIntensity ?? 0;
      }
      return m;
    };
    const box = (parent, w, h, d, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) =>
      addTo(parent, new THREE.BoxGeometry(w, h, d), mat, x, y, z, rx, ry, rz);
    const gem = (parent, r, color, x, y, z, glow = false) => {
      const mat = M({ color, emissive: new THREE.Color(color), emissiveIntensity: glow ? 1.1 : 0.7, roughness: 0.15, metalness: 0.3 }, glow);
      if (glow) gearState.glowStrips.push(mat);
      return addTo(parent, new THREE.OctahedronGeometry(r, 0), mat, x, y, z);
    };
    const glowMat = (color, intensity = 0.9) => {
      const m = M({ color, emissive: new THREE.Color(color), emissiveIntensity: intensity, roughness: 0.3, metalness: 0.7 }, true);
      gearState.glowStrips.push(m);
      return m;
    };
    /** Rows of small staggered plates (lamellar / scale). */
    const plateRows = (parent, rows, cols, mat, { y0 = 0.3, step = 0.065, w = 0.085, h = 0.06, width = 0.38, z = fz + 0.012, tilt = -0.18 } = {}) => {
      for (let r = 0; r < rows; r++) {
        const n = r % 2 ? cols - 1 : cols;
        const span = width * (n / cols);
        for (let c = 0; c < n; c++) {
          const x = n > 1 ? -span / 2 + (c / (n - 1)) * span : 0;
          box(parent, w, h, 0.02, mat, x, y0 - r * step, z, tilt);
        }
      }
    };

    if (band >= 0) {
      if (classId === 'knight') buildKnightGear(band, { M, box, gem, glowMat, plateRows, gemColor, goldColor, fz, sx });
      else if (classId === 'axeman') buildAxemanGear(band, { M, box, gem, glowMat, plateRows, gemColor, goldColor, fz, sx });
      else if (classId === 'wizard') buildWizardGear(band, { M, box, gem, glowMat, plateRows, gemColor, goldColor, fz, sx, style });
      else buildArcherGear(band, { M, box, gem, glowMat, plateRows, gemColor, goldColor, fz, sx, style });
    }

    // Helmet band (helmet's own tier when worn)
    const helmTier = itemVisualTier(helmet);
    if (helmet && helmTier != null) {
      buildHelmGear(Math.min(3, Math.floor(helmTier / 2)), { M, box, gem, glowMat, gemColor, goldColor });
    }

    // Boots band
    const bootTier = itemVisualTier(boots);
    gearState.bootBand = boots && bootTier != null ? Math.min(3, Math.floor(bootTier / 2)) : -1;
    if (gearState.bootBand >= 1) {
      const bb = gearState.bootBand;
      const plateMat = M({ color: bb >= 2 ? 0x9ca3af : 0x6b7280, metalness: 0.75, roughness: 0.35 });
      const cuffMat = bb >= 3 ? glowMat(goldColor, 0.5) : M({ color: goldColor, metalness: 0.85, roughness: 0.25 });
      for (const leg of [gear.lLeg, gear.rLeg]) {
        box(leg, 0.13, 0.17, 0.03, plateMat, 0, -0.3, 0.095);
        if (bb >= 2) box(leg, 0.18, 0.035, 0.2, cuffMat, 0, -0.2, 0);
        if (bb >= 3) gem(leg, 0.025, gemColor, 0, -0.16, 0.1, true);
      }
    }

    // Armor +7 or higher: subtle shimmer strip along the chest trim
    if (armor && (Number(armor.plus) || 0) >= 7) {
      const col = armorSeal ?? 0xfff1c1;
      const mat = M({ color: col, emissive: new THREE.Color(col), emissiveIntensity: 0.6, roughness: 0.2, metalness: 0.9, transparent: true, opacity: 0.95 }, true);
      const y = classId === 'wizard' ? 0.33 : classId === 'axeman' ? 0.38 : 0.35;
      box(gear.body, classId === 'axeman' ? 0.54 : 0.46, 0.022, 0.02, mat, 0, y, fz + 0.03);
      gearState.shimmer = mat;
    }

    // Set aura ring (>= 3 pieces of one set)
    if (setInfo) {
      const mat = new THREE.MeshBasicMaterial({ color: setInfo.color, side: THREE.DoubleSide, transparent: true, opacity: 0.3, depthWrite: false, blending: THREE.AdditiveBlending });
      mat.userData.noFlash = true;
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.56, 0.7, 28), mat);
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.025;
      ring.userData.noFlash = true;
      gear.ground.add(ring);
      gearState.setAura = { ring, mat, pieces: setInfo.count };
    }

    // Wizard base rune orb: hidden at band 0 and at band 3 (replaced by the 3-orb orbit)
    gearState.baseOrbVisible = !(classId === 'wizard' && (band === 0 || band === 3));
    if (lookState.runeOrb) lookState.runeOrb.visible = gearState.baseOrbVisible;
  };

  const buildKnightGear = (band, k) => {
    const { M, box, gem, glowMat, plateRows, gemColor, goldColor, fz, sx } = k;
    if (band === 0) {
      // Plain cloth tabard
      const cloth = M({ color: lookState.appearance.cape ?? 0xb91c1c, roughness: 0.85 });
      box(gear.body, 0.18, 0.44, 0.012, cloth, 0, 0.07, fz + 0.008);
      return;
    }
    const plateMat = M({ color: band >= 3 ? 0xdbe4ee : band >= 2 ? 0x8fa6c1 : 0x9ca3af, metalness: band >= 3 ? 0.92 : 0.78, roughness: band >= 3 ? 0.18 : 0.35 });
    plateRows(gear.body, band + 2, 5, plateMat, { y0: 0.31, step: 0.062 });
    // Layered pauldrons (bigger per band)
    const ps = 1 + band * 0.18;
    for (const s of [-1, 1]) {
      box(gear.body, 0.2 * ps, 0.05, 0.24 * ps, plateMat, s * sx, 0.4, 0, 0, 0, s * -0.35);
      box(gear.body, 0.18 * ps, 0.045, 0.22 * ps, plateMat, s * (sx + 0.03), 0.34, 0, 0, 0, s * -0.55);
    }
    if (band >= 2) {
      const trim = band >= 3 ? glowMat(goldColor, 0.45) : M({ color: goldColor, metalness: 0.9, roughness: 0.2 });
      box(gear.body, 0.44, 0.03, 0.02, trim, 0, 0.345, fz + 0.03);
      box(gear.body, 0.44, 0.03, 0.02, trim, 0, 0.31 - (band + 1.6) * 0.062, fz + 0.03);
      for (const s of [-1, 1]) box(gear.body, 0.03, 0.03, 0.26 * ps, trim, s * (sx + 0.1 * ps), 0.38, 0, 0, 0, s * -0.35);
      gem(gear.body, band >= 3 ? 0.05 : 0.04, gemColor, 0, 0.22, fz + 0.045, band >= 3);
      // Tassets below the belt
      for (const x of [-0.15, 0, 0.15]) box(gear.body, 0.13, 0.14, 0.03, plateMat, x, -0.2, fz - 0.005, 0.12);
    }
    if (band >= 3) {
      // Gorget + upturned pauldron crest
      addTo(gear.body, new THREE.TorusGeometry(0.17, 0.035, 6, 14), plateMat, 0, 0.42, 0, Math.PI / 2);
      for (const s of [-1, 1]) box(gear.body, 0.04, 0.1, 0.2, glowMat(gemColor, 0.6), s * (sx + 0.12), 0.46, 0, 0, 0, s * -0.2);
    }
  };

  const buildAxemanGear = (band, k) => {
    const { M, box, gem, glowMat, plateRows, goldColor, fz, sx } = k;
    const fur = M({ color: 0x6b4f3a, roughness: 0.95 });
    const bone = M({ color: 0xf5f0e1, roughness: 0.5 });
    if (band === 0) {
      // Studded leather
      const stud = M({ color: 0x9ca3af, metalness: 0.8, roughness: 0.3 });
      for (const y of [0.24, 0.12]) for (const x of [-0.16, -0.055, 0.055, 0.16]) box(gear.body, 0.035, 0.035, 0.02, stud, x, y, fz + 0.01);
      return;
    }
    // Fur mantle grows with tier
    const mantle = addTo(gear.body, new THREE.TorusGeometry(0.28, 0.07 + band * 0.02, 7, 16), fur, 0, 0.41, -0.03, Math.PI / 2);
    mantle.scale.set(1.35 + band * 0.08, 1, 1);
    if (band === 1) {
      // Iron scale shirt
      const iron = M({ color: 0x8b949e, metalness: 0.7, roughness: 0.4 });
      plateRows(gear.body, 3, 6, iron, { y0: 0.27, step: 0.06, w: 0.075, width: 0.44, tilt: -0.25 });
      return;
    }
    // Spiked dark plates
    const dark = M({ color: band >= 3 ? 0x1c1917 : 0x27272a, metalness: 0.85, roughness: 0.3 });
    box(gear.body, 0.52, 0.3, 0.04, dark, 0, 0.21, fz + 0.012);
    plateRows(gear.body, 2, 6, dark, { y0: 0.02, step: 0.06, w: 0.08, width: 0.46, z: fz + 0.005, tilt: -0.2 });
    for (const s of [-1, 1]) {
      box(gear.body, 0.24, 0.07, 0.28, dark, s * sx, 0.44, 0, 0, 0, s * -0.3);
      addTo(gear.body, new THREE.ConeGeometry(0.035, 0.16, 5), dark, s * (sx + 0.02), 0.54, 0.06, 0, 0, s * -0.4);
      addTo(gear.body, new THREE.ConeGeometry(0.035, 0.16, 5), dark, s * (sx + 0.02), 0.54, -0.08, 0, 0, s * -0.4);
      // Bone tusks on the pauldron front
      addTo(gear.body, new THREE.ConeGeometry(0.025, 0.14, 5), bone, s * (sx - 0.04), 0.4, 0.17, 1.2, 0, s * 0.3);
    }
    // Belt skull plate
    box(gear.body, 0.12, 0.1, 0.03, bone, 0, -0.11, fz + 0.03);
    if (band >= 3) {
      // Ember glow: molten cracks + core
      const ember = glowMat(0xff6a1a, 1.0);
      box(gear.body, 0.3, 0.018, 0.02, ember, -0.04, 0.27, fz + 0.04, 0, 0, 0.35);
      box(gear.body, 0.24, 0.018, 0.02, ember, 0.06, 0.16, fz + 0.04, 0, 0, -0.5);
      box(gear.body, 0.018, 0.14, 0.02, ember, -0.1, 0.12, fz + 0.04);
      gem(gear.body, 0.05, 0xff6a1a, 0, 0.22, fz + 0.05, true);
      for (const s of [-1, 1]) box(gear.body, 0.2, 0.02, 0.02, ember, s * sx, 0.475, 0.13, 0, 0, s * -0.3);
    } else {
      box(gear.body, 0.5, 0.025, 0.02, M({ color: goldColor, metalness: 0.85, roughness: 0.3 }), 0, 0.35, fz + 0.04);
    }
  };

  const buildWizardGear = (band, k) => {
    const { M, box, gem, glowMat, gemColor, goldColor, fz, style } = k;
    const embroideryColor = style ? style.accent : goldColor;
    if (band === 0) {
      // Plain rope belt knot
      box(gear.body, 0.06, 0.12, 0.02, M({ color: 0xa16207, roughness: 0.8 }), -0.12, -0.2, fz + 0.01, 0, 0, 0.2);
      return;
    }
    const emb = band >= 3 ? glowMat(embroideryColor, 0.55) : M({ color: embroideryColor, metalness: 0.6, roughness: 0.35 });
    // Embroidered bands around the robe skirt
    addTo(gear.body, new THREE.TorusGeometry(0.305, 0.013, 5, 22), emb, 0, -0.3, 0, Math.PI / 2);
    if (band >= 2) addTo(gear.body, new THREE.TorusGeometry(0.345, 0.013, 5, 22), emb, 0, -0.52, 0, Math.PI / 2);
    // High collar
    const collarMat = M({ color: lookState.appearance.cape ?? 0x6d28d9, roughness: 0.6, side: THREE.DoubleSide });
    addTo(gear.body, new THREE.CylinderGeometry(0.17 + band * 0.015, 0.15, 0.1 + band * 0.03, 12, 1, true, Math.PI * 0.6, Math.PI * 1.8), collarMat, 0, 0.45, -0.01);
    if (band >= 2) {
      // Chest embroidery strips + gem clasp
      for (const s of [-1, 1]) box(gear.body, 0.025, 0.4, 0.012, emb, s * 0.07, 0.13, fz + 0.012);
      box(gear.body, 0.18, 0.025, 0.012, emb, 0, 0.3, fz + 0.012);
      gem(gear.body, 0.035, gemColor, 0, 0.3, fz + 0.03, band >= 3);
      // Widened sleeves
      const sleeve = M({ color: lookState.appearance.outfit ?? 0x4c1d95, roughness: 0.55 });
      for (const arm of [gear.rArm, gear.lArm]) {
        addTo(arm, new THREE.CylinderGeometry(0.1, 0.16 + (band - 2) * 0.03, 0.16, 10, 1, true), sleeve, 0, -0.3, 0);
        addTo(arm, new THREE.TorusGeometry(0.16 + (band - 2) * 0.03, 0.012, 5, 14), emb, 0, -0.38, 0, Math.PI / 2);
      }
    }
    // Orbiting rune orbs (base orb counts as the first at bands 1-2)
    const orbColor = style ? style.primary : (lookState.cls?.color ?? 0xa855f7);
    const extra = band === 2 ? 1 : band >= 3 ? 3 : 0;
    for (let i = 0; i < extra; i++) {
      const g = new THREE.Group();
      const mat = M({ color: orbColor, emissive: new THREE.Color(orbColor), emissiveIntensity: 1.1, roughness: 0.1, transparent: true, opacity: 0.92 }, true);
      addTo(g, new THREE.IcosahedronGeometry(0.06, 0), mat);
      g.userData.phase = (i / Math.max(1, extra)) * Math.PI * 2 + (band === 2 ? Math.PI : 0);
      gear.body.add(g);
      gearState.orbs.push(g);
    }
    if (band >= 3) {
      // Halo behind the head
      const haloMat = glowMat(embroideryColor === 0xe0e7ff ? 0xfef3c7 : embroideryColor, 0.9);
      const halo = addTo(gear.head, new THREE.TorusGeometry(0.27, 0.014, 6, 28), haloMat, 0, 0.3, -0.24);
      gearState.halo = halo;
    }
    // Hat brim gem (shown only while the hat is visible)
    if (band >= 2) {
      gearState.hatGem = gem(gear.head, 0.04, gemColor, 0, 0.37, 0.205, band >= 3);
    }
  };

  const buildArcherGear = (band, k) => {
    const { M, box, gem, glowMat, plateRows, goldColor, fz, style } = k;
    const leather = M({ color: 0x5b3a1a, roughness: 0.7, metalness: 0.1 });
    if (band === 0) {
      box(gear.body, 0.1, 0.09, 0.06, leather, 0.17, -0.15, fz - 0.02);
      return;
    }
    const scaleMat = M({ color: band >= 2 ? 0xb08d57 : 0x3f5f2a, metalness: band >= 2 ? 0.6 : 0.15, roughness: 0.45 });
    plateRows(gear.body, band + 2, 5, scaleMat, { y0: 0.27, step: 0.058, w: 0.08, h: 0.055, width: 0.36, tilt: -0.22 });
    // Shoulder guard on the bow arm (left)
    const sg = 1 + (band - 1) * 0.2;
    box(gear.lArm, 0.19 * sg, 0.05, 0.2 * sg, leather, 0.02, 0.05, 0, 0, 0, -0.3);
    box(gear.lArm, 0.17 * sg, 0.045, 0.18 * sg, scaleMat, 0.04, -0.01, 0, 0, 0, -0.45);
    if (band >= 2) {
      const gold = M({ color: goldColor, metalness: 0.85, roughness: 0.25 });
      box(gear.lArm, 0.03, 0.03, 0.21 * sg, gold, 0.11 * sg, 0.02, 0, 0, 0, -0.3);
      box(gear.lArm, 0.17, 0.13, 0.17, scaleMat, 0, -0.27, 0);
      // Feathered quiver plume
      const plumeColor = style ? style.primary : 0x0ea5e9;
      const feather = M({ color: plumeColor, roughness: 0.5, side: THREE.DoubleSide });
      for (let i = 0; i < 3; i++) {
        box(gear.body, 0.005, 0.12, 0.05, feather, -0.05 + i * 0.03, 0.57, -0.24 + (i - 1) * 0.02, -0.3, i * 0.6, 0.4);
      }
      addTo(gear.body, new THREE.TorusGeometry(0.075, 0.012, 5, 12), gold, 0.08, 0.24, -0.24, Math.PI / 2, 0, 0.4);
    }
    if (band >= 3) {
      // Short cloak with a glowing edge
      const cloak = M({ color: lookState.appearance.cape ?? 0x15803d, roughness: 0.65, side: THREE.DoubleSide });
      box(gear.cape, 0.42, 0.58, 0.025, cloak, 0, -0.3, -0.03, 0.12);
      box(gear.cape, 0.43, 0.035, 0.03, glowMat(style ? style.accent : 0x86efac, 0.9), 0, -0.59, -0.065, 0.12);
      gem(gear.body, 0.035, style ? style.primary : 0x22c55e, 0, 0.32, fz + 0.035, true);
    }
  };

  const buildHelmGear = (hb, k) => {
    const { M, box, gem, glowMat, gemColor, goldColor } = k;
    if (hb <= 0) return;
    const classId = lookState.classId;
    const gold = hb >= 3 ? glowMat(goldColor, 0.45) : M({ color: goldColor, metalness: 0.9, roughness: 0.2 });
    if (classId === 'knight') {
      if (hb >= 2) box(gear.helm, 0.41, 0.04, 0.41, gold, 0, 0.16, 0);
      if (hb >= 3) {
        const wing = M({ color: 0xf1f5f9, metalness: 0.6, roughness: 0.3 });
        for (const s of [-1, 1]) {
          box(gear.helm, 0.025, 0.2, 0.12, wing, s * 0.22, 0.36, -0.02, 0, 0, s * -0.55);
          box(gear.helm, 0.025, 0.15, 0.1, wing, s * 0.27, 0.42, -0.06, 0, 0, s * -0.85);
        }
        box(gear.helm, 0.05, 0.08, 0.3, glowMat(gemColor, 0.8), 0, 0.48, -0.02);
      }
      if (hb === 1) box(gear.helm, 0.3, 0.04, 0.03, M({ color: 0x475569, metalness: 0.8, roughness: 0.3 }), 0, 0.2, 0.2);
    } else if (classId === 'axeman') {
      const bone = M({ color: 0xf5f0e1, roughness: 0.5 });
      if (hb >= 2) for (const s of [-1, 1]) addTo(gear.helm, new THREE.ConeGeometry(0.03, 0.14, 5), bone, s * 0.1, 0.43, 0.12, 0.4, 0, s * -0.3);
      if (hb >= 3) box(gear.helm, 0.26, 0.025, 0.02, glowMat(0xff6a1a, 1.0), 0, 0.2, 0.2);
      else box(gear.helm, 0.41, 0.03, 0.41, gold, 0, 0.16, 0);
    } else if (classId === 'wizard') {
      for (const s of [-1, 1]) gem(gear.helm, 0.03, gemColor, s * 0.13, 0.27, 0.19, hb >= 3);
      if (hb >= 2) box(gear.helm, 0.4, 0.03, 0.4, gold, 0, 0.17, 0);
    } else {
      const feather = M({ color: hb >= 3 ? 0xfacc15 : 0x0ea5e9, roughness: 0.5, side: THREE.DoubleSide });
      box(gear.helm, 0.02, 0.22, 0.06, feather, 0.22, 0.4, -0.02, -0.3, 0, -0.45);
      if (hb >= 2) box(gear.helm, 0.4, 0.03, 0.4, gold, 0, 0.21, 0);
    }
  };

  // ---------------------------------------------------------------- weapon glow (alchemy +N, seal, imbue)
  const weaponFx = { level: 0, color: 0xffffff, intensity: 0, light: null, aura: null, auraMat: null, mats: [], tip: null };
  let activeImbue = null;
  let activeImbueColor = null;
  let imbueRing = null;

  const applyWeaponGlow = (weapon, wMesh) => {
    const plus = Number(weapon?.plus) || 0;
    const level = glowLevel(plus);
    const seal = sealColorOf(weapon);
    const elem = String(weapon?.element || 'physical').toLowerCase();
    const rarity = String(weapon?.rarity || 'normal').toLowerCase();
    const color = seal ?? (elem !== 'physical' ? getElementColor(elem)
      : rarity !== 'normal' && rarity !== 'common' ? getRarityColor(rarity) : 0xfff4d6);
    weaponFx.level = level;
    weaponFx.color = color;
    weaponFx.intensity = [0, 0.55, 1.1, 1.3, 1.55][level] || 0;
    weaponFx.mats = wMesh?.userData?.glowMats || [];
    weaponFx.tip = wMesh?.userData?.tipLocal || new THREE.Vector3(0, 0.7, 0);
    weaponFx.light = null;
    weaponFx.aura = null;
    weaponFx.auraMat = null;
    weaponFx.sealOnly = level === 0 && seal != null;

    if (level >= 4 && wMesh) {
      const auraMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.2, blending: THREE.AdditiveBlending, depthWrite: false });
      auraMat.userData.noFlash = true;
      const aura = new THREE.Mesh(new THREE.SphereGeometry(0.5, 10, 8), auraMat);
      aura.userData.noFlash = true;
      const isBow = wMesh.userData.weaponType === 'bow';
      aura.position.set(0, isBow ? 0 : 0.45, 0);
      aura.scale.set(isBow ? 0.3 : 0.26, isBow ? 1.25 : 0.85, isBow ? 0.3 : 0.26);
      wMesh.add(aura);
      weaponFx.aura = aura;
      weaponFx.auraMat = auraMat;
    }
    refreshWeaponEmissive(0);
  };

  /** Recompute weapon emissive: imbue element color overrides the alchemy / seal glow. */
  const refreshWeaponEmissive = (time = 0) => {
    const mats = weaponFx.mats;
    if (!mats || !mats.length) return;
    let color = null;
    let intensity = 0;
    if (activeImbueColor != null) {
      color = activeImbueColor;
      intensity = 0.95 + Math.sin(time * 9) * 0.25;
    } else if (weaponFx.level > 0) {
      color = weaponFx.color;
      intensity = weaponFx.intensity * (weaponFx.level >= 4 ? 1 + Math.sin(time * 4) * 0.15 : 1);
    } else if (weaponFx.sealOnly) {
      color = weaponFx.color;
      intensity = 0.3;
    }
    for (const m of mats) {
      if (!m.emissive) continue;
      const base = m.userData.glowBase;
      if (color == null) {
        if (base) {
          m.emissive.copy(base.emissive);
          m.emissiveIntensity = base.intensity;
        }
      } else {
        m.emissive.setHex(color);
        m.emissiveIntensity = Math.max(intensity, base ? base.intensity : 0);
      }
    }
  };

  /** Set the active imbue ({element, status} | null). Weapon tint, ground ring and particles while active. */
  root.userData.setImbue = (imbue = null) => {
    const color = imbue ? imbueColorOf(imbue) : null;
    if (color === activeImbueColor && Boolean(imbue) === Boolean(activeImbue)) {
      activeImbue = imbue;
      return;
    }
    activeImbue = imbue || null;
    activeImbueColor = color;
    if (activeImbue && !imbueRing) {
      const mat = new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, transparent: true, opacity: 0.45, depthWrite: false, blending: THREE.AdditiveBlending });
      mat.userData.noFlash = true;
      imbueRing = new THREE.Mesh(new THREE.RingGeometry(0.72, 0.84, 28), mat);
      imbueRing.rotation.x = -Math.PI / 2;
      imbueRing.position.y = 0.035;
      imbueRing.userData.noFlash = true;
      root.add(imbueRing);
    } else if (!activeImbue && imbueRing) {
      root.remove(imbueRing);
      disposeObject3D(imbueRing);
      imbueRing = null;
    }
    if (imbueRing) imbueRing.material.color.setHex(color);
    refreshWeaponEmissive(0);
  };
  root.userData.getImbueColor = () => activeImbueColor;
  root.userData.getWeaponGlow = () => ({ level: weaponFx.level, color: weaponFx.color, hasLight: Boolean(weaponFx.light), hasAura: Boolean(weaponFx.aura) });

  // ---------------------------------------------------------------- world-space particle pool (glint trail, imbue sparks)
  const fx = { group: null, geo: null, parts: [], trailAcc: 0, imbueAcc: 0 };
  const tmpTip = new THREE.Vector3();
  const fxEnsure = () => {
    const parent = root.parent;
    if (!parent) return null;
    if (!fx.group) {
      fx.group = new THREE.Group();
      fx.group.name = 'HeroFX';
      fx.geo = new THREE.BoxGeometry(1, 1, 1);
    }
    if (fx.group.parent !== parent) parent.add(fx.group);
    return fx.group;
  };
  const fxEmit = (pos, color, size, life, vx = 0, vy = 0, vz = 0) => {
    const group = fxEnsure();
    if (!group) return;
    let p = fx.parts.find((q) => q.age >= q.life);
    if (!p) {
      if (fx.parts.length >= 48) return;
      const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false });
      const mesh = new THREE.Mesh(fx.geo, mat);
      mesh.userData.noFlash = true;
      group.add(mesh);
      p = { mesh, mat, vel: new THREE.Vector3(), age: 1, life: 0, size: 0.05 };
      fx.parts.push(p);
    }
    p.mat.color.setHex(color);
    p.mesh.position.set(pos.x, pos.y, pos.z);
    p.vel.set(vx, vy, vz);
    p.age = 0;
    p.life = life;
    p.size = size;
    p.mesh.scale.setScalar(size);
    p.mesh.visible = true;
  };
  const fxUpdate = (dt) => {
    for (const p of fx.parts) {
      if (p.age >= p.life) continue;
      p.age += dt;
      if (p.age >= p.life) {
        p.mesh.visible = false;
        continue;
      }
      p.mesh.position.addScaledVector(p.vel, dt);
      const k = 1 - p.age / p.life;
      p.mat.opacity = k;
      p.mesh.scale.setScalar(p.size * (0.4 + 0.6 * k));
    }
  };
  const weaponTipWorld = () => {
    const w = root.userData.weaponMesh;
    if (!w || typeof w.localToWorld !== 'function') return null;
    tmpTip.copy(weaponFx.tip || tmpTip.set(0, 0.7, 0));
    return w.localToWorld(tmpTip);
  };
  root.userData.disposeFx = () => {
    if (fx.group) {
      fx.group.parent?.remove(fx.group);
      for (const p of fx.parts) p.mat.dispose();
      fx.geo?.dispose();
    }
    fx.group = null;
    fx.geo = null;
    fx.parts = [];
  };

  let glbLoadVer = 0;
  let glbEquipVer = 0;
  let activeEquipPromise = Promise.resolve();
  let readyResolve = null;
  let readyPromise = Promise.resolve();
  const resetReadyBarrier = () => {
    if (readyResolve) {
      const prev = readyResolve;
      readyResolve = null;
      prev();
    }
    readyPromise = new Promise((resolve) => {
      readyResolve = resolve;
    });
    return readyResolve;
  };
  root.userData.whenReady = () => readyPromise;

  const clearGLBHeroState = () => {
    if (root.userData.glbHero) {
      root.remove(root.userData.glbHero);
      disposeObject3D(root.userData.glbHero);
      root.userData.glbHero = null;
    }
    root.userData.isGLBHero = false;
    root.userData.mixer = null;
    root.userData.actions = null;
    root.userData.getOrCreateAction = null;
    root.userData.heroBonesByName = null;
    root.userData.bodyMeshes = null;
    root.userData.naturalHairMesh = null;
    root.userData.hwanHair = null;
    root.userData.glbArmorGroup = null;
    root.userData.glbNeckMount = null;
    root.userData.glbRightWeaponMount = null;
    root.userData.glbLeftWeaponMount = null;
    root.userData.glbShieldMount = null;
    root.userData.glbHeadMount = null;
    root.userData.currentAction = null;
    root.userData.currentActionName = '';
    root.userData.uniqueActions = null;
    root.userData.actionWeights = null;
    root.userData.guardPose = null;
    root.userData.guardUpperArmBone = null;
    refreshFlashMaterials();
  };

  function applyGLBWeaponGlow(modelClone, item) {
    if (isLightweightCrowd) return;
    const fx = buildWeaponGearFx(modelClone, item);
    if (fx) root.userData.gearFx.push({ target: modelClone, update: fx });
  }

  function applyGLBArmorLook(clonedArmor, item) {
    if (!clonedArmor || !item || isLightweightCrowd) return;
    const seal = item.seal ? String(item.seal).toLowerCase() : null;
    const rarity = String(item.rarity || 'normal').toLowerCase();
    const tier = Number(item.tier ?? 0);

    let tintHex = null;
    let tintStrength = 0;
    if (seal === 'sun') { tintHex = 0xfef08a; tintStrength = 0.10; }
    else if (seal === 'moon') { tintHex = 0xd8b4fe; tintStrength = 0.09; }
    else if (seal === 'star') { tintHex = 0xbae6fd; tintStrength = 0.08; }
    else if (rarity === 'unique') { tintHex = 0xfdba74; tintStrength = 0.18; }
    else if (rarity === 'epic') { tintHex = 0xd8b4fe; tintStrength = 0.15; }
    else if (rarity === 'rare') { tintHex = 0xfef08a; tintStrength = 0.12; }
    else if (tier >= 5) { tintHex = 0xfde68a; tintStrength = 0.12; }
    else if (tier === 4) { tintHex = 0xc7d2fe; tintStrength = 0.10; }

    clonedArmor.traverse((child) => {
      if (!child.isMesh || child.userData.isGlowShell) return;
      if (child.material) {
        const cloneMat = (mt) => {
          const c = mt.clone();
          c.transparent = false;
          c.alphaTest = 0;
          c.depthWrite = true;
          c.side = THREE.DoubleSide;
          if (c.map) c.map.colorSpace = THREE.SRGBColorSpace;
          if (tintHex && c.color) {
            c.color.lerp(new THREE.Color(tintHex), tintStrength);
          }
          return c;
        };
        const newMat = Array.isArray(child.material)
          ? child.material.map(cloneMat)
          : cloneMat(child.material);
        child.material = newMat;
        child.userData._origMat = newMat;
      }
    });
    const fx = buildArmorGearFx(clonedArmor, item);
    if (fx) root.userData.gearFx.push({ target: clonedArmor, update: fx });
  }

  function applyGLBEquipment(equipped = {}) {
    if (!root.userData.isGLBHero || !root.userData.heroBonesByName) return Promise.resolve();
    const version = ++glbEquipVer;
    const heroBonesByName = root.userData.heroBonesByName;
    const bodyMeshes = root.userData.bodyMeshes;
    const armorGroup = root.userData.glbArmorGroup;
    const neckMount = root.userData.glbNeckMount;
    const rWeaponMount = root.userData.glbRightWeaponMount;
    const lWeaponMount = root.userData.glbLeftWeaponMount;
    const shieldMount = root.userData.glbShieldMount;
    const classId = lookState.classId || 'knight';
    const starterSet = SRO_STARTER_SETS[classId] || 'heavy_01';

    root.userData.gearFx = [];
    // Clear previous GLB gear
    for (const grp of [armorGroup, neckMount, rWeaponMount, lWeaponMount, shieldMount]) {
      if (!grp) continue;
      while (grp.children.length > 0) {
        const c = grp.children[0];
        grp.remove(c);
        disposeObject3D(c);
      }
    }
    if (Array.isArray(root.userData.flashMeshes)) {
      const fms = root.userData.flashMeshes;
      for (let i = fms.length - 1; i >= 0; i--) {
        let p = fms[i];
        while (p && p !== root) p = p.parent;
        if (p !== root) fms.splice(i, 1);
      }
    }

    // 1. Sets (only bind armor pieces that are actually equipped in `equipped`)
    const armorItem = equipped?.armor || null;
    const bootsItem = equipped?.boots || null;
    const glovesItem = equipped?.gloves || armorItem || null;
    const helmItem = equipped?.helmet || equipped?.helm || null;

    const defaultType = starterSet.split('_')[0];
    const chestSet = armorItem ? (getArmorVisualSet(armorItem, defaultType) || starterSet) : null;
    const bootsSet = bootsItem ? (getArmorVisualSet(bootsItem, defaultType) || starterSet) : null;
    const glovesSet = glovesItem ? (getArmorVisualSet(glovesItem, defaultType) || starterSet) : null;
    const helmSet = helmItem ? (getArmorVisualSet(helmItem, defaultType) || starterSet) : null;

    root.userData.helmetEquipped = Boolean(helmSet);

    const setBodySliceVisible = (name, vis) => {
      const m = bodyMeshes?.get(name);
      if (m) {
        m.visible = vis;
        if (vis) enableSafeFrustumCulling(m, 2.8);
      }
    };

    // Reveal unequipped base slices immediately, but defer covered slices until their armor GLB binds (or fails)
    if (bodyMeshes) {
      if (!chestSet) {
        setBodySliceVisible('man_torso_upper', true);
        setBodySliceVisible('man_torso_lower', true);
        setBodySliceVisible('man_arm_upper', true);
        setBodySliceVisible('man_pelvis', true);
        setBodySliceVisible('man_thigh', true);
      }
      if (!glovesSet) {
        setBodySliceVisible('man_arm_lower', true);
      }
      if (!bootsSet) {
        setBodySliceVisible('man_calf', true);
      }
      if (!helmSet && root.userData.naturalHairMesh) {
        root.userData.naturalHairMesh.visible = !root.userData.isBerserk;
      }
    }

    const pendingLoads = [];

    const bindArmor = (url, itemForLook = null, onBound = null, onFail = null, socketTarget = null) => {
      const p = loadGLB(url)
        .then((entry) => {
          if (version !== glbEquipVer || !armorGroup || !armorGroup.parent) return;
          if (!entry || !entry.scene) {
            if (typeof onFail === 'function') onFail();
            return;
          }
          const clonedArmor = SkeletonUtils.clone(entry.scene);
          let hasSkinned = false;
          clonedArmor.traverse((child) => {
            if (child.isMesh) {
              child.castShadow = true;
              child.receiveShadow = true;
              if (child.material) {
                if (child.material.map) child.material.map.colorSpace = THREE.SRGBColorSpace;
                child.material.transparent = false;
                child.material.alphaTest = 0;
                child.material.depthWrite = true;
                child.material.side = THREE.DoubleSide;
              }
              child.userData._origMat = child.material;
            }
            if (child.isSkinnedMesh) {
              hasSkinned = true;
              const armorSkeleton = child.skeleton;
              const newBones = armorSkeleton.bones.map(
                (b) => heroBonesByName.get(b.name) || heroBonesByName.get(b.name.replace(/_/g, ' ')) || b
              );
              const newSkeleton = new THREE.Skeleton(newBones, armorSkeleton.boneInverses);
              child.bind(newSkeleton, child.bindMatrix);
            }
          });
          enableSafeFrustumCulling(clonedArmor, 2.8);
          applyGLBArmorLook(clonedArmor, itemForLook);
          clonedArmor.traverse((child) => {
            if (!child.isMesh || child.userData.isGlowShell || child.userData.noFlash) return;
            patchMeshHitFlash(child, 0xffffff);
            if (root.userData.flashMeshes && !root.userData.flashMeshes.includes(child)) {
              root.userData.flashMeshes.push(child);
            }
          });
          if (!hasSkinned && socketTarget) {
            socketTarget.add(clonedArmor);
          } else {
            armorGroup.add(clonedArmor);
          }
          if (typeof onBound === 'function') onBound();
        })
        .catch(() => {
          if (version === glbEquipVer && typeof onFail === 'function') onFail();
        });
      pendingLoads.push(p);
    };

    // Bind chest, shoulders, legs when armorItem is equipped
    if (chestSet) {
      bindArmor(
        `/assets/sro/equipment/${chestSet}_ba.glb`,
        armorItem,
        () => {
          setBodySliceVisible('man_torso_lower', false);
          setBodySliceVisible('man_torso_upper', chestSet === 'light_02');
          setBodySliceVisible('man_arm_upper', !chestSet.startsWith('heavy_'));
        },
        () => {
          setBodySliceVisible('man_torso_lower', true);
          setBodySliceVisible('man_torso_upper', true);
          setBodySliceVisible('man_arm_upper', true);
        }
      );

      bindArmor(`/assets/sro/equipment/${chestSet}_sa.glb`, armorItem, null, null, neckMount);

      bindArmor(
        `/assets/sro/equipment/${chestSet}_la.glb`,
        armorItem,
        () => {
          setBodySliceVisible('man_pelvis', false);
          setBodySliceVisible('man_thigh', false);
        },
        () => {
          setBodySliceVisible('man_pelvis', true);
          setBodySliceVisible('man_thigh', true);
        }
      );
    }

    // Bind gauntlets/bracers when glovesSet is present
    if (glovesSet) {
      bindArmor(
        `/assets/sro/equipment/${glovesSet}_aa.glb`,
        glovesItem,
        () => {
          setBodySliceVisible('man_arm_lower', !(glovesSet.startsWith('heavy_') || glovesSet === 'clothes_04'));
        },
        () => {
          setBodySliceVisible('man_arm_lower', true);
        }
      );
    }

    // Bind boots when bootsItem is equipped
    if (bootsSet) {
      bindArmor(
        `/assets/sro/equipment/${bootsSet}_fa.glb`,
        bootsItem,
        () => {
          setBodySliceVisible('man_calf', false);
        },
        () => {
          setBodySliceVisible('man_calf', true);
        }
      );
    }

    // Bind helm when helmItem is equipped
    if (helmSet) {
      bindArmor(
        `/assets/sro/equipment/${helmSet}_ha.glb`,
        helmItem,
        () => {
          if (root.userData.naturalHairMesh) root.userData.naturalHairMesh.visible = false;
        },
        () => {
          if (root.userData.naturalHairMesh) root.userData.naturalHairMesh.visible = !root.userData.isBerserk;
        }
      );
    }

    // 2. Weapons & Shields (only render weapons/shields that are actually equipped)
    const weaponItem = equipped?.weapon || null;
    const shieldItem = equipped?.shield || equipped?.offhand || null;
    const isAxeman = classId === 'axeman';

    const prepWeaponMaterials = (obj) => {
      obj.traverse((child) => {
        if (child.isMesh && !child.userData.isGlowShell) {
          child.castShadow = true;
          child.receiveShadow = true;
          const mats = Array.isArray(child.material) ? child.material : child.material ? [child.material] : [];
          for (const mt of mats) {
            if (mt) {
              if (mt.map) mt.map.colorSpace = THREE.SRGBColorSpace;
              mt.transparent = false;
              mt.alphaTest = 0;
              mt.depthWrite = true;
              mt.side = THREE.DoubleSide;
            }
          }
        }
      });
      enableSafeFrustumCulling(obj, 2.8);
    };

    let isBow = false;
    if (weaponItem) {
      const weaponInfo = getWeaponGlbInfo(weaponItem, classId);
      isBow = weaponInfo.type === 'bow';

      if (weaponInfo.type === 'axe') {
        const axeMesh = createEuropeanAxeMesh(weaponItem, weaponInfo.tier || '01', false);
        applyGLBWeaponGlow(axeMesh, weaponItem);
        if (rWeaponMount) rWeaponMount.add(axeMesh);
      } else if (weaponInfo.type === 'staff') {
        const staffMesh = createEuropeanStaffMesh(weaponItem, weaponInfo.tier || '01');
        applyGLBWeaponGlow(staffMesh, weaponItem);
        if (rWeaponMount) rWeaponMount.add(staffMesh);
      } else {
        const mainWeaponUrl = `/assets/sro/equipment/${weaponInfo.file}`;
        const wp = loadGLB(mainWeaponUrl)
          .then((entry) => {
            if (!entry || !entry.scene || version !== glbEquipVer) return;
            const wClone = SkeletonUtils.clone(entry.scene);
            prepWeaponMaterials(wClone);
            applyGLBWeaponGlow(wClone, weaponItem);
            if (isBow) {
              if (lWeaponMount) lWeaponMount.add(wClone);
            } else {
              if (rWeaponMount) rWeaponMount.add(wClone);
            }
          })
          .catch(() => {});
        pendingLoads.push(wp);
      }
    }

    // Offhand: Dual-Wield European Axe or Shield
    const cls = getClass(classId);
    const canUseShield = cls && cls.shield && !cls.twoHanded;
    if (shieldItem && canUseShield && !isBow) {
      const shieldSubType = String(shieldItem?.subType || shieldItem?.subtype || shieldItem?.visualModel || '').toLowerCase();
      const shieldIsAxe = isAxeman && (shieldSubType.includes('axe') || shieldSubType.includes('tblade') || shieldItem.type === 'weapon');

      if (shieldIsAxe) {
        const offhandAxeTier = getEquipmentGlbTier(shieldItem);
        const offAxeMesh = createEuropeanAxeMesh(shieldItem, offhandAxeTier, true);
        applyGLBWeaponGlow(offAxeMesh, shieldItem);
        if (lWeaponMount) lWeaponMount.add(offAxeMesh);
      } else {
        const shieldTier = getEquipmentGlbTier(shieldItem);
        const shieldUrl = `/assets/sro/equipment/shield_${shieldTier}.glb`;
        const shp = loadGLB(shieldUrl)
          .then((entry) => {
            if (!entry || !entry.scene || version !== glbEquipVer) return;
            const shClone = SkeletonUtils.clone(entry.scene);
            prepWeaponMaterials(shClone);
            applyGLBWeaponGlow(shClone, shieldItem);
            if (shieldMount) shieldMount.add(shClone);
          })
          .catch(() => {});
        pendingLoads.push(shp);
      }
    }

    const equipPromise = Promise.all(pendingLoads);
    activeEquipPromise = equipPromise;
    return equipPromise;
  }

  function loadGLBCharacter(classId) {
    if (!isBrowser) return Promise.resolve();
    const version = ++glbLoadVer;
    const resolveReady = resetReadyBarrier();
    clearGLBHeroState();
    bodyPivot.visible = false;

    const url = SRO_CHAR_GLB_MAP[classId] || SRO_CHAR_GLB_MAP.knight;

    return loadGLB(url)
      .then(async (entry) => {
        if (version !== glbLoadVer) return;
        if (!entry || !entry.scene) {
          bodyPivot.visible = true;
          return;
        }

        const charClone = SkeletonUtils.clone(entry.scene);
        charClone.name = 'GLBHero_' + classId;
        charClone.visible = false;
        charClone.scale.setScalar(1.0);
        charClone.position.set(0, 0, 0);

        const heroBonesByName = new Map();
        charClone.traverse((b) => {
          if (b.isBone) {
            heroBonesByName.set(b.name, b);
            heroBonesByName.set(b.name.replace(/_/g, ' '), b);
          }
          if (b.isMesh) {
            b.castShadow = true;
            b.receiveShadow = true;
            b.userData._origMat = b.material;
            if (b.material && b.material.map) b.material.map.colorSpace = THREE.SRGBColorSpace;
            patchMeshHitFlash(b, 0xffffff);
            if (root.userData.flashMeshes && !root.userData.flashMeshes.includes(b)) {
              root.userData.flashMeshes.push(b);
            }
          }
        });
        enableSafeFrustumCulling(charClone, 2.8);
        root.userData.heroBonesByName = heroBonesByName;

        const bodyMeshes = new Map();
        charClone.traverse((m) => {
          if (m.isMesh) {
            bodyMeshes.set(m.name, m);
            if (m.name.includes('_hair') && !m.name.includes('hwan')) {
              root.userData.naturalHairMesh = m;
            }
          }
        });
        root.userData.bodyMeshes = bodyMeshes;

        // SRO socket attach rule: compute bind-pose world rotation BEFORE starting any animation
        // and cancel the bone's bind-pose world rotation on each socket mount.
        charClone.updateMatrixWorld(true);
        const createSocketMount = (bone, mountName) => {
          const mount = new THREE.Group();
          mount.name = mountName;
          if (bone) {
            const bindQuat = new THREE.Quaternion();
            bone.getWorldQuaternion(bindQuat);
            mount.quaternion.copy(bindQuat).invert();
            bone.add(mount);
          }
          return mount;
        };

        const rHandMid = heroBonesByName.get('Bip01 R HandMid') || heroBonesByName.get('Bip01 R Hand');
        const lHand = heroBonesByName.get('Bip01 L Hand') || heroBonesByName.get('Bip01 L HandMid');
        const lForearm = heroBonesByName.get('Bip01 L Forearm') || lHand;
        const neckBone = heroBonesByName.get('Bip01 Neck1') || heroBonesByName.get('Bip01 Neck');
        const headBone = heroBonesByName.get('Bip01 Head');

        root.userData.glbRightWeaponMount = createSocketMount(rHandMid, 'GLBRightWeaponMount');
        root.userData.glbLeftWeaponMount = createSocketMount(lHand, 'GLBLeftWeaponMount');
        root.userData.glbShieldMount = createSocketMount(lHand || lForearm, 'GLBShieldMount');
        root.userData.glbNeckMount = createSocketMount(neckBone, 'GLBNeckMount');
        const glbHeadMount = createSocketMount(headBone, 'GLBHeadMount');
        root.userData.glbHeadMount = glbHeadMount;

        const glbArmorGroup = new THREE.Group();
        glbArmorGroup.name = 'GLBArmorGroup';
        charClone.add(glbArmorGroup);
        root.userData.glbArmorGroup = glbArmorGroup;

        const mixer = new THREE.AnimationMixer(charClone);
        const uniqueActions = [];
        const prebindNames = isLightweightCrowd
          ? HERO_BASELINE_CLIPS
          : [...HERO_BASELINE_CLIPS, ...Object.keys(CLASS_CLIP_MAP[classId] || {})];
        const { actions, getOrCreateAction } = createLazyActionMap(
          mixer,
          entry.animations,
          classId,
          prebindNames,
          uniqueActions
        );
        root.userData.mixer = mixer;
        root.userData.actions = actions;
        root.userData.getOrCreateAction = getOrCreateAction;
        root.userData.currentAction = null;
        root.userData.currentActionName = '';
        root.userData.uniqueActions = uniqueActions;
        root.userData.actionWeights = new Map();
        const guardPose = buildGuardPose(entry.animations, charClone);
        root.userData.guardPose = guardPose;
        root.userData.guardUpperArmBone = guardPose?.find((g) => /UpperArm/i.test(g.bone.name))?.bone || null;
        root.userData.guardWeight = 0;

        // Spiky Hwan Hair for Berserk
        if (!isLightweightCrowd) {
          loadGLB('/assets/sro/char/chinaman_hwan_hair.glb').then((hwanEntry) => {
            if (!hwanEntry || !hwanEntry.scene || version !== glbLoadVer) return;
            const hwanClone = SkeletonUtils.clone(hwanEntry.scene);
            hwanClone.name = 'HwanHair';
            hwanClone.visible = false;
            if (glbHeadMount) {
              glbHeadMount.add(hwanClone);
              root.userData.hwanHair = hwanClone;
            }
          });
        }

        bodyPivot.visible = false;
        root.userData.isGLBHero = true;
        root.add(charClone);
        root.userData.glbHero = charClone;

        if (actions['STAND1']) {
          actions['STAND1'].enabled = true;
          actions['STAND1'].setEffectiveWeight(1);
          actions['STAND1'].play();
          root.userData.actionWeights.set(actions['STAND1'], 1);
          mixer.update(0.001);
          root.userData.currentAction = actions['STAND1'];
          root.userData.currentActionName = 'STAND1';
        }

        await applyGLBEquipment(lookState.equipped);
        while (root.userData.isGLBHero && version === glbLoadVer && root.userData.glbHero === charClone) {
          const settledVer = glbEquipVer;
          await activeEquipPromise;
          if (settledVer === glbEquipVer) break;
        }
        if (version === glbLoadVer && root.userData.glbHero === charClone) {
          charClone.visible = true;
        }
      })
      .catch((err) => {
        if (version === glbLoadVer) {
          console.warn('[models3d] Failed to load GLB hero:', err);
          bodyPivot.visible = true;
        }
      })
      .finally(() => {
        if (readyResolve === resolveReady) {
          readyResolve = null;
          resolveReady();
        }
      });
  }

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
      const shieldSub = String(shield?.subtype || shield?.subType || '').toLowerCase();
      if (shieldSub === 'axe' || shield?.type === 'weapon') {
        const offAxe = createWeaponMesh(shield);
        offAxe.scale.x = -1;
        shieldMount.position.set(0, -0.34, 0.08);
        shieldMount.rotation.set(MOUNT_BASE_X, 0, 0);
        shieldMount.add(offAxe);
      } else {
        shieldMount.position.set(0.08, -0.24, 0.12);
        shieldMount.rotation.set(0, Math.PI / 3, 0);
        shieldMount.add(createShieldMesh(shield));
      }
    }

    applyArmorTint();

    // Helmet
    helmetGroup.visible = Boolean(helmet);
    updateHatVisibility();

    // Tiered armor details, set aura, alchemy weapon glow
    buildGear(equipped);
    gear.helm.visible = helmetGroup.visible;
    if (gearState.hatGem) gearState.hatGem.visible = !helmetGroup.visible && lookState.hatParts.length > 0;
    applyWeaponGlow(weapon, wMesh);

    // Boots
    if (boots) {
      const rarityCol = getRarityColor(boots.rarity);
      bootMat.color.setHex(boots.rarity && boots.rarity !== 'normal' ? rarityCol : 0x78350f);
    } else {
      bootMat.color.setHex(0x451a03);
    }

    enableShadows(weaponMount, true, false);
    enableShadows(bowMount, true, false);
    enableShadows(gear.body, true, false);
    refreshFlashMaterials();

    // Update GLB Hero equipment
    applyGLBEquipment(equipped);
  };

  /**
   * Apply hero class + appearance. Rebuilds class parts and recolors shared materials.
   */
  root.userData.setLook = ({ classId, appearance, equipped } = {}) => {
    if (root.userData.hitFlashTimer > 0) root.userData.setHitFlash(0);
    const cls = getClass(classId || lookState.classId);
    const app = sanitizeAppearance(appearance || (cls.id === lookState.classId ? lookState.appearance : null), cls.id);
    const prevClassId = lookState.classId;
    lookState.classId = cls.id;
    lookState.cls = cls;
    lookState.appearance = app;
    if (equipped !== undefined) {
      lookState.equipped = equipped || {};
    }
    root.userData.classId = cls.id;
    root.userData.attackStyle = cls.attackStyle || 'melee';
    root.userData.appearance = { ...app };

    const classChanged = prevClassId !== cls.id;
    if (classChanged) {
      clearGLBHeroState();
    }

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

    // Load or reload GLB base model if class changed or not loaded yet
    if (!root.userData.isGLBHero || classChanged) {
      loadGLBCharacter(cls.id);
    }
  };

  root.userData.getLook = () => ({ classId: lookState.classId, appearance: { ...lookState.appearance } });

  // Initialize look + equipment
  root.userData.attackStyle = 'melee';
  lookState.equipped = equipment || {};
  root.userData.setLook({ classId: look?.classId || 'knight', appearance: look?.appearance || null });

  // ---------------------------------------------------------------- animation
  root.userData.animate = (state = 'idle', time = 0, dt = 0.016, comboStep = 0, attackProgress = 0, actionSeq = 0) => {
    const gearFx = root.userData.gearFx;
    if (gearFx && gearFx.length) {
      for (const fx of gearFx) if (fx.target.parent) fx.update(time, dt);
    }
    if (root.userData.hitFlashTimer > 0) {
      root.userData.hitFlashTimer = Math.max(0, root.userData.hitFlashTimer - dt * 6);
      root.userData.setHitFlash(root.userData.hitFlashTimer);
    }

    // AnimationMixer for Authentic Silkroad GLB Character
    if (root.userData.mixer) {
      const isBerserk = Boolean(root.userData.isBerserk);

      // Spiky hair visibility in Berserk
      if (root.userData.hwanHair) {
        const showHwan = isBerserk && !root.userData.helmetEquipped;
        root.userData.hwanHair.visible = showHwan;
        if (root.userData.naturalHairMesh) {
          root.userData.naturalHairMesh.visible = !showHwan && !root.userData.helmetEquipped;
        }
      }

      let targetActionName = 'STAND1';
      let targetTimeScale = 1.0;
      let targetLoop = THREE.LoopRepeat;

      const st = String(state || 'idle').toLowerCase();
      const isAttackSt = st === 'attack' || st === 'shoot' || st === 'melee' || st === 'slash';
      const isSkillSt = st === 'cast' || st === 'skill' || st.includes('prep') || st.includes('release') || st.includes('recover') || st.includes('wizard_') || st.includes('force_') || st.includes('bicheon_') || st.includes('heuksal_') || st.includes('pachon_');

      if (st === 'dead' || st === 'die' || st === 'death') {
        targetActionName = 'DIE1';
        targetLoop = THREE.LoopOnce;
      } else if (st === 'damage' || st === 'hurt' || st === 'hit') {
        targetActionName = 'DAMAGE1';
        targetLoop = THREE.LoopOnce;
      } else if (st === 'stroll' || st === 'patrol') {
        targetActionName = root.userData.actions?.['WALK'] ? 'WALK' : 'RUN';
        targetTimeScale = 0.88;
      } else if (st === 'walk_slow' || st === 'block_walk') {
        targetActionName = root.userData.actions?.['WALK'] ? 'WALK' : 'RUN';
        targetTimeScale = st === 'block_walk' ? 0.9 : 1.0;
      } else if (st === 'walk') {
        targetActionName = 'RUN';
        targetTimeScale = isBerserk ? 1.25 : 0.95;
      } else if (st === 'run' || st === 'chase') {
        targetActionName = 'RUN';
        targetTimeScale = isBerserk ? 1.35 : 1.05;
      } else if (st === 'dash') {
        targetActionName = 'RUN';
        targetTimeScale = 1.6;
      } else if (isAttackSt) {
        const stage = comboStep > 0 ? ((comboStep - 1) % 3) + 1 : 1;
        const wanted = stage === 2 ? 'ATTACK2' : stage === 3 ? 'ATTACK3' : 'ATTACK1';
        targetActionName = root.userData.actions?.[wanted] ? wanted : 'ATTACK1';
        targetTimeScale = isBerserk ? 1.4 : 1.15;
        targetLoop = THREE.LoopOnce;
      } else if (isSkillSt) {
        const castSlot = comboStep === 3 ? 'CAST3' : comboStep === 4 ? 'CAST4' : (comboStep % 2 === 0) ? 'CAST2' : 'CAST1';
        targetActionName = root.userData.actions?.[castSlot] ? castSlot : ((comboStep % 2 === 0) ? 'ATTACK3' : 'ATTACK2');
        targetTimeScale = isBerserk ? 1.3 : 1.1;
        targetLoop = THREE.LoopOnce;
      } else if (st === 'defend' || st === 'block') {
        targetActionName = 'STAND1';
      } else {
        targetActionName = 'STAND1';
      }

      const actions = root.userData.actions;
      if (actions) {
        const targetAction = actions[targetActionName] || actions['STAND1'] || root.userData.uniqueActions?.[0];
        if (targetAction) {
          if (targetLoop === THREE.LoopOnce && st !== 'dead' && st !== 'die' && st !== 'death') {
            // Fit longer weapon/spell clips cleanly into combat timings (without warping 7s spray beams)
            const clipDur = targetAction.getClip?.().duration || 0;
            const windowSec = isSkillSt ? 0.95 : 0.6;
            if (clipDur > windowSec) {
              const scaleRatio = Math.min(2.6, clipDur / windowSec);
              targetTimeScale *= scaleRatio;
            }
          }

          const weights = (root.userData.actionWeights ||= new Map());
          if (!root.userData.uniqueActions) {
            root.userData.uniqueActions = Array.from(new Set(Object.values(actions).filter(Boolean)));
          }

          const prevAction = root.userData.currentAction;
          const prevSeq = root.userData.lastActionSeq;
          const prevCombo = root.userData.lastComboStep;
          const switchedAction = prevAction !== targetAction;
          const restartedSameOneShot = !switchedAction && targetLoop === THREE.LoopOnce && (
            (actionSeq && prevSeq !== actionSeq) ||
            ((isAttackSt || isSkillSt) && prevCombo !== comboStep) ||
            !targetAction.enabled
          );

          targetAction.stopFading();
          targetAction.timeScale = targetTimeScale;
          targetAction.setLoop(targetLoop, targetLoop === THREE.LoopOnce ? 1 : Infinity);
          // Critical: ALWAYS clamp LoopOnce clips so finished skill/attack animations NEVER disable and revert to bind T-pose
          targetAction.clampWhenFinished = targetLoop === THREE.LoopOnce;

          if (switchedAction || restartedSameOneShot) {
            targetAction.time = 0;
            targetAction.paused = false;
            targetAction.enabled = true;
            targetAction.play();
            root.userData.currentAction = targetAction;
            root.userData.currentActionName = targetActionName;
          } else {
            targetAction.enabled = true;
            if (targetLoop === THREE.LoopRepeat) targetAction.paused = false;
          }

          // Deterministic weight crossfade whose enabled weights ALWAYS normalize to 1.000 (zero T-pose leakage)
          const fadeDur = (isAttackSt || isSkillSt) ? 0.08 : 0.11;
          const stepW = Math.min(1, Math.max(0.016, dt) / fadeDur);
          const fadingActs = root.userData._fadingActs || (root.userData._fadingActs = []);
          fadingActs.length = 0;

          let activeOtherWeight = 0;
          let otherWTotal = 0;
          const uniqActs = root.userData.uniqueActions;
          for (let i = 0, n = uniqActs.length; i < n; i++) {
            const act = uniqActs[i];
            if (act === targetAction) continue;
            let w = weights.get(act) || 0;
            if (act.enabled && w > 0.0001) activeOtherWeight += w;
            if (w > 0) {
              w = Math.max(0, w - stepW);
              if (w <= 0.001) {
                weights.set(act, 0);
                act.setEffectiveWeight(0);
                act.enabled = false;
                act.stop();
              } else {
                act.stopFading();
                act.enabled = true;
                weights.set(act, w);
                otherWTotal += w;
                fadingActs.push(act);
              }
            } else if (act.enabled) {
              act.setEffectiveWeight(0);
              act.enabled = false;
              act.stop();
            }
          }

          let targetW = activeOtherWeight <= 0.001
                ? 1.0
                : Math.min(1.0, (weights.get(targetAction) || 0) + stepW);
              if (targetW < 0.01) targetW = stepW;
              const totalW = targetW + otherWTotal;
              const invTotal = totalW > 0.0001 ? 1 / totalW : 1;
              const normTargetW = targetW * invTotal;
              weights.set(targetAction, normTargetW);
              targetAction.setEffectiveWeight(normTargetW);
              for (let i = 0, n = fadingActs.length; i < n; i++) {
                const act = fadingActs[i];
                const normW = (weights.get(act) || 0) * invTotal;
                weights.set(act, normW);
                act.setEffectiveWeight(normW);
              }
            }
          }
      root.userData.lastComboStep = comboStep;
      root.userData.lastActionSeq = actionSeq;
      root.userData.mixer.update(dt);
      const guardPose = root.userData.guardPose;
      if (guardPose) {
        const wantGuard = st === 'block' || st === 'block_walk' || st === 'defend' ? 1 : 0;
        root.userData.guardWeight = THREE.MathUtils.damp(root.userData.guardWeight || 0, wantGuard, 12, dt);
        const gw = root.userData.guardWeight;
        if (gw > 0.001) {
          for (const g of guardPose) g.bone.quaternion.slerp(g.quat, gw);
          applyGuardArmSwing(root, root.userData.guardUpperArmBone, gw);
        }
      }
      fxUpdate(dt);
      return;
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
    } else if (state === 'knight_prep' || state === 'bicheon_prep' || (state === 'windup' && (lookState.classId === 'knight' || style === 'melee'))) {
      // Knight (Bicheon): Shield-brace crouch during prep
      bodyPivot.position.y = 0.58;
      bodyPivot.rotation.x = 0.15;
      bodyPivot.rotation.y = 0.25;
      leftLegPivot.rotation.x = -0.55;
      rightLegPivot.rotation.x = 0.35;
      leftArmPivot.rotation.x = -1.2;
      leftArmPivot.rotation.y = -0.65;
      leftArmPivot.rotation.z = 0.25;
      rightArmPivot.rotation.x = -0.25;
      rightArmPivot.rotation.y = 0.45;
      rightArmPivot.rotation.z = -0.2;
      capePivot.rotation.x = 0.45;
    } else if (state === 'knight_release' || state === 'bicheon_release') {
      // Knight (Bicheon): Rapid lunging sword slash / shield bash spin during release
      const p = clamp01(attackProgress);
      bodyPivot.position.y = 0.65;
      bodyPivot.rotation.y = (p - 0.5) * 2.2;
      bodyPivot.rotation.x = 0.2;
      leftLegPivot.rotation.x = -0.5;
      rightLegPivot.rotation.x = 0.5;
      rightArmPivot.rotation.x = -1.5;
      rightArmPivot.rotation.z = -1.0 + p * 2.4;
      leftArmPivot.rotation.x = -0.8 - Math.sin(p * Math.PI) * 0.8;
      leftArmPivot.rotation.y = -0.4;
      capePivot.rotation.x = 0.75;
    } else if (state === 'knight_recover' || state === 'bicheon_recover') {
      // Knight (Bicheon): Grounded stance in recover
      bodyPivot.position.y = 0.68;
      bodyPivot.rotation.x = 0.05;
      bodyPivot.rotation.y = 0.1;
      leftLegPivot.rotation.x = -0.2;
      rightLegPivot.rotation.x = 0.2;
      leftArmPivot.rotation.x = -0.8;
      leftArmPivot.rotation.y = -0.4;
      rightArmPivot.rotation.x = -0.5;
      rightArmPivot.rotation.z = -0.2;
      capePivot.rotation.x = 0.25;
    } else if (state === 'axeman_prep' || state === 'heuksal_prep' || (state === 'windup' && (lookState.classId === 'axeman' || style === 'melee_heavy'))) {
      // Axeman (Heuksal): High overhead polearm/greataxe raise during prep
      bodyPivot.position.y = 0.74;
      bodyPivot.rotation.x = -0.35;
      leftLegPivot.rotation.x = -0.3;
      rightLegPivot.rotation.x = 0.3;
      rightArmPivot.rotation.x = -2.85;
      rightArmPivot.rotation.y = 0.2;
      leftArmPivot.rotation.x = -2.75;
      leftArmPivot.rotation.y = -0.45;
      capePivot.rotation.x = 0.55;
    } else if (state === 'axeman_release' || state === 'heuksal_release') {
      // Axeman (Heuksal): Full 360° body spin cleave on whirlwind/chain release
      const p = clamp01(attackProgress || (time * 3) % 1);
      bodyPivot.rotation.y = p * Math.PI * 2;
      bodyPivot.position.y = 0.68;
      rightArmPivot.rotation.x = -Math.PI / 2;
      rightArmPivot.rotation.z = -0.85;
      leftArmPivot.rotation.x = -Math.PI / 2;
      leftArmPivot.rotation.z = 0.85;
      capePivot.rotation.x = 0.9;
    } else if (state === 'axeman_recover' || state === 'heuksal_recover') {
      // Axeman (Heuksal): Grounded polearm stance in recover
      bodyPivot.position.y = 0.70;
      rightArmPivot.rotation.x = -0.9;
      leftArmPivot.rotation.x = -1.0;
      leftArmPivot.rotation.y = -0.5;
      capePivot.rotation.x = 0.3;
    } else if (state === 'wizard_prep' || state === 'force_prep' || (state === 'windup' && (lookState.classId === 'wizard' || style === 'magic_bolt'))) {
      // Wizard (Force): Cast pose during prep
      bodyPivot.position.y = 0.70;
      bodyPivot.rotation.x = -0.15;
      leftLegPivot.rotation.x = 0.25;
      rightLegPivot.rotation.x = -0.2;
      rightArmPivot.rotation.x = -2.4;
      rightArmPivot.rotation.z = -0.35;
      leftArmPivot.rotation.x = -2.4;
      leftArmPivot.rotation.z = 0.35;
      staffLift = 2.0;
      capePivot.rotation.x = 0.6;
    } else if (state === 'wizard_release' || state === 'force_release') {
      // Wizard (Force): Forward staff thrust burst on release
      const p = clamp01(attackProgress);
      const thrust = p < 0.4 ? Math.sin((p / 0.4) * Math.PI * 0.5) : 1 - ((p - 0.4) / 0.6) * 0.5;
      bodyPivot.position.y = 0.70;
      bodyPivot.rotation.x = 0.25 * thrust;
      leftLegPivot.rotation.x = -0.4 * thrust;
      rightLegPivot.rotation.x = 0.4 * thrust;
      rightArmPivot.rotation.x = -0.3 - 2.2 * thrust;
      rightArmPivot.rotation.z = -0.1 * thrust;
      leftArmPivot.rotation.x = -0.2 - 1.4 * thrust;
      leftArmPivot.rotation.y = 0.4 * thrust;
      staffLift = 1.2 * thrust;
      capePivot.rotation.x = 0.75 * thrust;
    } else if (state === 'wizard_recover' || state === 'force_recover') {
      // Wizard (Force): Grounded recover
      bodyPivot.position.y = 0.70;
      rightArmPivot.rotation.x = -0.6;
      leftArmPivot.rotation.x = -0.3;
      capePivot.rotation.x = 0.3;
    } else if (state === 'archer_prep' || state === 'pachon_prep' || (state === 'windup' && (lookState.classId === 'archer' || isBow))) {
      // Archer (Pachon): Sideways bow-draw stance with torso twist during prep
      const p = clamp01(attackProgress);
      bowAim = 1;
      bowDraw = p;
      const twist = -0.7;
      bodyPivot.rotation.y = twist;
      bodyPivot.position.y = 0.68;
      leftLegPivot.rotation.x = -0.35;
      rightLegPivot.rotation.x = 0.35;
      leftArmPivot.rotation.x = -Math.PI / 2;
      leftArmPivot.rotation.y = -twist;
      rightArmPivot.rotation.x = -Math.PI / 2 + 0.1;
      rightArmPivot.rotation.y = -twist + 0.3 + p * 1.0;
      headGroup.rotation.y = -twist * 0.9;
      capePivot.rotation.x = 0.35;
    } else if (state === 'archer_release' || state === 'pachon_release') {
      // Archer (Pachon): Crisp recoil snap on release
      const p = clamp01(attackProgress);
      bowAim = 1;
      bowDraw = 0;
      const recoil = 1 - p;
      const twist = -0.7;
      bodyPivot.rotation.y = twist + recoil * 0.25;
      bodyPivot.position.y = 0.70;
      leftArmPivot.rotation.x = -Math.PI / 2 - recoil * 0.3;
      leftArmPivot.rotation.y = -twist;
      rightArmPivot.rotation.x = -Math.PI / 2;
      rightArmPivot.rotation.y = -twist - recoil * 0.3;
      capePivot.rotation.x = 0.5;
    } else if (state === 'archer_recover' || state === 'pachon_recover') {
      bodyPivot.position.y = 0.71;
      leftArmPivot.rotation.x = -0.4;
      rightArmPivot.rotation.x = -0.2;
      capePivot.rotation.x = 0.25;
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

    animateGear(state, time, dt);
  };

  const ATTACKING_STATES = new Set(['attack', 'cast', 'shoot', 'skill', 'whirlwind']);
  const animateGear = (state, time, dt) => {
    // Orbiting rune orbs (wizard bands 2-3)
    const orbs = gearState.orbs;
    if (orbs.length) {
      const speed = state === 'cast' ? 3.2 : 1.1;
      const r = orbs.length >= 3 ? 0.55 : 0.5;
      for (const g of orbs) {
        const a = time * speed + g.userData.phase;
        g.position.set(Math.cos(a) * r, 0.55 + Math.sin(a * 2 + g.userData.phase) * 0.06, Math.sin(a) * r);
        g.rotation.y = time * 2;
      }
    }
    if (gearState.halo) gearState.halo.rotation.z = time * 0.8;
    // Pulsing glow strips / gems (legendary bands)
    if (gearState.glowStrips.length) {
      const k = 0.8 + Math.sin(time * 3.1) * 0.25;
      for (const m of gearState.glowStrips) m.emissiveIntensity = (m.userData.glowBaseIntensity ?? 0.8) * k;
    }
    // Armor +7 shimmer: a slow sweeping sheen
    if (gearState.shimmer) {
      const sweep = Math.max(0, Math.sin(time * 1.7));
      gearState.shimmer.emissiveIntensity = 0.25 + Math.pow(sweep, 6) * 1.1;
    }
    // Set aura ring
    if (gearState.setAura) {
      const a = gearState.setAura;
      a.ring.rotation.z = time * 0.6;
      a.mat.opacity = 0.22 + Math.sin(time * 2.2) * 0.08 + Math.min(0.12, (a.pieces - 3) * 0.03);
    }
    // Weapon glow (imbue pulse, +10 aura, light flicker)
    if (activeImbueColor != null || weaponFx.level >= 4) refreshWeaponEmissive(time);
    if (weaponFx.aura) {
      const s = 1 + Math.sin(time * 4.2) * 0.12;
      if (weaponFx.aura.userData.baseXZ == null) weaponFx.aura.userData.baseXZ = weaponFx.aura.scale.x;
      weaponFx.aura.scale.x = weaponFx.aura.scale.z = weaponFx.aura.userData.baseXZ * s;
      weaponFx.auraMat.opacity = 0.16 + Math.sin(time * 4.2) * 0.07;
    }
    if (imbueRing) {
      imbueRing.rotation.z = -time * 1.4;
      imbueRing.material.opacity = 0.35 + Math.sin(time * 5) * 0.12;
    }

    // Particles: glint trail (+7 and up) while attacking, element sparks while imbued
    const attacking = ATTACKING_STATES.has(state);
    if ((weaponFx.level >= 3 && attacking) || activeImbueColor != null) {
      const tip = weaponTipWorld();
      if (tip) {
        if (weaponFx.level >= 3 && attacking) {
          fx.trailAcc += dt;
          while (fx.trailAcc >= 0.025) {
            fx.trailAcc -= 0.025;
            fxEmit(tip, activeImbueColor ?? weaponFx.color, 0.07, 0.28, 0, 0.2, 0);
          }
        }
        if (activeImbueColor != null) {
          fx.imbueAcc += dt;
          const every = attacking ? 0.03 : 0.09;
          while (fx.imbueAcc >= every) {
            fx.imbueAcc -= every;
            fxEmit(
              { x: tip.x + (Math.random() - 0.5) * 0.15, y: tip.y + (Math.random() - 0.5) * 0.15, z: tip.z + (Math.random() - 0.5) * 0.15 },
              activeImbueColor, 0.045 + Math.random() * 0.03, 0.45,
              (Math.random() - 0.5) * 0.4, 0.7 + Math.random() * 0.5, (Math.random() - 0.5) * 0.4
            );
          }
        }
      }
    }
    fxUpdate(dt);
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
const _projectileAssetCache = {
  geos: null,
  coreMat: null,
  colorMats: new Map(),
};

function _getProjectileSharedAssets(color) {
  if (!_projectileAssetCache.geos) {
    const arrowTrailGeo = new THREE.CylinderGeometry(0.035, 0.004, 0.9, 6, 1, true);
    const coreGeo = new THREE.IcosahedronGeometry(0.09, 0);
    const glowGeo = new THREE.SphereGeometry(0.2, 10, 8);
    const trailGeo = new THREE.ConeGeometry(0.16, 0.8, 8, 1, true);
    for (const g of [arrowTrailGeo, coreGeo, glowGeo, trailGeo]) {
      _markShared(g);
    }
    const coreMat = _markShared(new THREE.MeshBasicMaterial({ color: 0xffffff }));
    _projectileAssetCache.geos = { arrowTrailGeo, coreGeo, glowGeo, trailGeo };
    _projectileAssetCache.coreMat = coreMat;
  }
  let cMats = _projectileAssetCache.colorMats.get(color);
  if (!cMats) {
    const arrowTrailMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false });
    const glowMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false });
    const trailMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false });
    if (_projectileAssetCache.colorMats.size < 64) {
      for (const m of [arrowTrailMat, glowMat, trailMat]) {
        _markShared(m);
      }
      cMats = { arrowTrailMat, glowMat, trailMat };
      _projectileAssetCache.colorMats.set(color, cMats);
    } else {
      cMats = { arrowTrailMat, glowMat, trailMat };
    }
  }
  return { geos: _projectileAssetCache.geos, coreMat: _projectileAssetCache.coreMat, cMats };
}

export function createProjectileMesh(kind = 'bolt', color = 0xa855f7, scale = 1) {
  const root = new THREE.Group();
  root.name = `Projectile_${kind}`;
  const inner = new THREE.Group();
  root.add(inner);
  const { geos, coreMat, cMats } = _getProjectileSharedAssets(color);

  if (kind === 'arrow') {
    const arrow = buildArrowMesh(color, 0xcbd5e1, 0.75);
    arrow.rotation.y = -Math.PI / 2; // +X -> +Z
    arrow.position.z = -0.4;
    inner.add(arrow);
    const trail = new THREE.Mesh(geos.arrowTrailGeo, cMats.arrowTrailMat);
    trail.rotation.x = Math.PI / 2;
    trail.position.z = -0.85;
    inner.add(trail);
  } else {
    const core = new THREE.Mesh(geos.coreGeo, coreMat);
    const glow = new THREE.Mesh(geos.glowGeo, cMats.glowMat);
    const trail = new THREE.Mesh(geos.trailGeo, cMats.trailMat);
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

export const SRO_MOB_GLB_MAP = {
  mangnyang: { url: '/assets/sro/mobs/mangnyang.glb', height: 1.45, yOffset: 0 },
  mangyang: { url: '/assets/sro/mobs/mangnyang.glb', height: 1.45, yOffset: 0 },
  bigeyeghost: { url: '/assets/sro/mobs/bigeyeghost.glb', height: 1.52, yOffset: 0 },
  gyo: { url: '/assets/sro/mobs/gyo.glb', height: 1.40, yOffset: 0 },
  waterghost: { url: '/assets/sro/mobs/waterghost.glb', height: 1.55, yOffset: 0 },
  stoneghost: { url: '/assets/sro/mobs/stoneghost.glb', height: 1.75, yOffset: 0 },
  tombstone: { url: '/assets/sro/mobs/tombstone.glb', height: 2.10, yOffset: 0 },
  yeoha: { url: '/assets/sro/mobs/yeoha.glb', height: 1.85, yOffset: 0 },
  bandit: { url: '/assets/sro/mobs/bandit.glb', height: 1.75, yOffset: 0 },
  banditarcher: { url: '/assets/sro/mobs/banditarcher.glb', height: 1.75, yOffset: 0 },
  tiger: { url: '/assets/sro/mobs/tiger.glb', height: 1.45, yOffset: 0 },
  whitetiger: { url: '/assets/sro/mobs/whitetiger.glb', height: 1.55, yOffset: 0 },
  bluetiger: { url: '/assets/sro/mobs/bluetiger.glb', height: 1.75, yOffset: 0 },
  chakji: { url: '/assets/sro/mobs/chakji.glb', height: 1.85, yOffset: 0 },
  ghostbug: { url: '/assets/sro/mobs/ghostbug.glb', height: 1.30, yOffset: 0 },
  devilbug: { url: '/assets/sro/mobs/devilbug.glb', height: 1.40, yOffset: 0 },
  hyungno: { url: '/assets/sro/mobs/hyungno.glb', height: 1.95, yOffset: 0 },
  earthghost: { url: '/assets/sro/mobs/earthghost.glb', height: 1.60, yOffset: 0 },
  gunpowderghost_clon: { url: '/assets/sro/mobs/gunpowderghost_clon.glb', height: 1.50, yOffset: 0 }
};

export const SRO_BOSS_GLB_MAP = {
  tigerwoman: { url: '/assets/sro/mobs/tigerwoman.glb', height: 1.62, yOffset: 0 },
  tigergirl: { url: '/assets/sro/mobs/tigerwoman.glb', height: 1.62, yOffset: 0 },
  uruchi: { url: '/assets/sro/mobs/uruchi.glb', height: 2.15, yOffset: 0 },
  banditlord: { url: '/assets/sro/mobs/uruchi.glb', height: 2.15, yOffset: 0 },
  isyutaru: { url: '/assets/sro/mobs/isyutaru.glb', height: 2.15, yOffset: 0 },
  lordyarkan: { url: '/assets/sro/mobs/bonelord.glb', height: 2.35, yOffset: 0 },
  lord_yarkan: { url: '/assets/sro/mobs/bonelord.glb', height: 2.35, yOffset: 0 },
  earthking: { url: '/assets/sro/mobs/earthking.glb', height: 2.35, yOffset: 0 },
  bluetiger: { url: '/assets/sro/mobs/bluetiger.glb', height: 1.78, yOffset: 0 },
  demonshaitan: { url: '/assets/sro/mobs/tahomet.glb', height: 2.25, yOffset: 0 },
  demon_shaitan: { url: '/assets/sro/mobs/tahomet.glb', height: 2.25, yOffset: 0 },
  hyeongcheon: { url: '/assets/sro/mobs/hyeongcheon.glb', height: 2.65, yOffset: 0 },
  roc: { url: '/assets/sro/mobs/roc.glb', height: null, targetSpan: 4.3, yOffset: 0 },
  medusa: { url: '/assets/sro/mobs/whitesnake.glb', height: 2.20, yOffset: 0 },
  whitesnake: { url: '/assets/sro/mobs/whitesnake.glb', height: 2.20, yOffset: 0 }
};

export function resolveMonsterGlb(rawType, isBoss, customGlbPath = null, customTargetHeight = null, customTargetSpan = null) {
  if (customGlbPath) {
    return {
      url: customGlbPath,
      height: customTargetSpan ? null : (customTargetHeight || (isBoss ? 2.25 : 1.65)),
      targetSpan: customTargetSpan || null,
      yOffset: 0
    };
  }
  const t = String(rawType || '').toLowerCase().replace(/[\s_-]+/g, '');
  if (isBoss) {
    if (t.includes('tigerwoman') || t.includes('tigergirl') || t.includes('queen')) return SRO_BOSS_GLB_MAP.tigerwoman;
    if (t.includes('uruchi') || t.includes('bandit')) return SRO_BOSS_GLB_MAP.uruchi;
    if (t.includes('medusa') || t.includes('whitesnake') || t.includes('gorgon')) return SRO_BOSS_GLB_MAP.medusa;
    if (t.includes('isyutaru') || t.includes('yeoha')) return SRO_BOSS_GLB_MAP.isyutaru;
    if (t.includes('lordyarkan') || t.includes('yarkan') || t.includes('bonelord')) return SRO_BOSS_GLB_MAP.lordyarkan;
    if (t.includes('earthking') || t.includes('king') || t.includes('gargoyle')) return SRO_BOSS_GLB_MAP.earthking;
    if (t.includes('bluetiger')) return SRO_BOSS_GLB_MAP.bluetiger;
    if (t.includes('roc')) return SRO_BOSS_GLB_MAP.roc;
    if (t.includes('demonshaitan') || t.includes('shaitan') || t.includes('tahomet')) return SRO_BOSS_GLB_MAP.demonshaitan;
    if (t.includes('hyeongcheon') || t.includes('general') || t.includes('devil') || t.includes('chaos') || t.includes('boss')) return SRO_BOSS_GLB_MAP.demonshaitan;
    return SRO_BOSS_GLB_MAP.demonshaitan;
  }

  if (t.includes('mangnyang') || t.includes('mangyang')) return SRO_MOB_GLB_MAP.mangnyang;
  if (t.includes('bigeye') || t.includes('eye')) return SRO_MOB_GLB_MAP.bigeyeghost;
  if (t.includes('gyo') || t.includes('fish')) return SRO_MOB_GLB_MAP.gyo;
  if (t.includes('waterghost') || t.includes('water')) return SRO_MOB_GLB_MAP.waterghost;
  if (t.includes('stoneghost') || t.includes('stonegolem') || t.includes('golem') || t.includes('ancient')) return SRO_MOB_GLB_MAP.stoneghost;
  if (t.includes('tombstone') || t.includes('tomb') || t.includes('mummy')) return SRO_MOB_GLB_MAP.tombstone;
  if (t.includes('yeoha') || t.includes('wraith') || t.includes('phantom') || t.includes('ghost')) return SRO_MOB_GLB_MAP.yeoha;
  if (t.includes('banditarcher')) return SRO_MOB_GLB_MAP.banditarcher;
  if (t.includes('bandit') || t.includes('thief') || t.includes('raider') || t.includes('goblin') || t.includes('orc')) return SRO_MOB_GLB_MAP.bandit;
  if (t.includes('bluetiger')) return SRO_MOB_GLB_MAP.bluetiger;
  if (t.includes('whitetiger')) return SRO_MOB_GLB_MAP.whitetiger;
  if (t.includes('tiger') || t.includes('wolf') || t.includes('hound')) return SRO_MOB_GLB_MAP.tiger;
  if (t.includes('chakji') || t.includes('lizardman') || t.includes('scaleblade')) return SRO_MOB_GLB_MAP.chakji;
  if (t.includes('ghostbug') || t.includes('spider') || t.includes('bat')) return SRO_MOB_GLB_MAP.ghostbug;
  if (t.includes('devilbug') || t.includes('demon')) return SRO_MOB_GLB_MAP.devilbug;
  if (t.includes('hyungno') || t.includes('darkknight') || t.includes('knight')) return SRO_MOB_GLB_MAP.hyungno;
  if (t.includes('earthghost') || t.includes('zombie') || t.includes('plague')) return SRO_MOB_GLB_MAP.earthghost;
  if (t.includes('gunpowder') || t.includes('slime') || t.includes('blob') || t.includes('ooze')) return SRO_MOB_GLB_MAP.gunpowderghost_clon;

  if (SRO_MOB_GLB_MAP[t]) return SRO_MOB_GLB_MAP[t];
  return null;
}

/**
 * Create distinct 3D Monster / Boss meshes with animations
 */
export function resolveUniquePrefabKey(cfg = {}) {
  const probe = String(
    cfg.uniqueId || cfg.uniquePrefab || cfg.id || cfg.type || cfg.name || ''
  ).toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!probe) return null;
  if (probe.includes('tigergirl') || probe.includes('tigerwoman') || probe.includes('frostfangempress')) return 'tigerwoman';
  if (probe.includes('uruchi') || probe.includes('drakmor')) return 'uruchi';
  if (probe.includes('isyutaru') || probe.includes('glaciera')) return 'isyutaru';
  if (probe.includes('lordyarkan') || probe.includes('yarkan') || probe.includes('valkor')) return 'lord_yarkan';
  if (probe.includes('demonshaitan') || probe.includes('shaitan') || probe.includes('malakor')) return 'demon_shaitan';
  if (probe === 'roc' || probe.includes('aetherion') || probe.includes('skysovereign') || probe.includes('monarchofroc') || (probe.includes('roc') && !probe.includes('rock'))) return 'roc';
  if (probe.includes('medusa') || probe.includes('vespera') || probe.includes('venomqueen')) return 'medusa';
  return null;
}

/**
 * Bespoke multi-part 3D rigs for Silkroad Online Unique bosses so each Unique
 * has an unmistakable silhouette, mount/wings/halos, and phase animations.
 */
function buildUniqueBossMesh(uniqueKey, bodyGroup, cfg = {}) {
  const mat = (opts) => new THREE.MeshStandardMaterial({ roughness: 0.42, metalness: 0.35, ...opts });
  const glowMat = (color, intensity = 0.9, extra = {}) => new THREE.MeshStandardMaterial({
    color,
    emissive: new THREE.Color(color),
    emissiveIntensity: intensity,
    roughness: 0.25,
    metalness: 0.45,
    ...extra
  });

  if (uniqueKey === 'uruchi') {
    // Uruchi — Black Robber Overlord astride an Armored War-Drake Steed with Sashimono War-Banners
    const drakeScaleMat = mat({ color: 0x3b0d0c, roughness: 0.55, metalness: 0.45 });
    const bronzeArmorMat = mat({ color: 0xb45309, roughness: 0.3, metalness: 0.85 });
    const crimsonClothMat = mat({ color: 0xb91c1c, roughness: 0.6, metalness: 0.15 });
    const obsidianMat = mat({ color: 0x18181b, roughness: 0.35, metalness: 0.75 });
    const emberMat = glowMat(0xf97316, 1.05);
    const goldBladeMat = glowMat(0xfef08a, 0.75, { color: 0xfacc15, metalness: 0.9, roughness: 0.18 });

    const steedGroup = new THREE.Group();
    bodyGroup.add(steedGroup);

    // Muscular armored War-Drake barrel body
    const drakeBody = new THREE.Mesh(new THREE.SphereGeometry(0.46, 14, 10), drakeScaleMat);
    drakeBody.scale.set(0.95, 0.82, 1.68);
    drakeBody.position.set(0, 0.72, -0.05);
    steedGroup.add(drakeBody);

    // Armored barding breastplate & shoulder shields
    const chestArmor = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.46, 0.42), bronzeArmorMat);
    chestArmor.position.set(0, 0.76, 0.54);
    chestArmor.rotation.x = -0.25;
    steedGroup.add(chestArmor);

    for (let s = 0; s < 3; s++) {
      const dorsal = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.28, 6), obsidianMat);
      dorsal.position.set(0, 1.05 - s * 0.04, 0.15 - s * 0.32);
      dorsal.rotation.x = -0.4;
      steedGroup.add(dorsal);
    }

    // Thick neck + fierce horned Drake head
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.3, 0.56, 10), drakeScaleMat);
    neck.position.set(0, 1.02, 0.68);
    neck.rotation.x = 0.55;
    steedGroup.add(neck);

    const drakeHead = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.3, 0.52), obsidianMat);
    drakeHead.position.set(0, 1.24, 0.96);
    steedGroup.add(drakeHead);

    const snout = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.36, 6), bronzeArmorMat);
    snout.rotation.x = Math.PI / 2;
    snout.position.set(0, 1.2, 1.26);
    steedGroup.add(snout);

    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.045, 6, 6), emberMat);
      eye.position.set(side * 0.15, 1.3, 1.12);
      steedGroup.add(eye);
      const horn = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.46, 7), bronzeArmorMat);
      horn.position.set(side * 0.2, 1.44, 0.8);
      horn.rotation.set(-0.75, 0, side * -0.45);
      steedGroup.add(horn);
    }

    // Segmented spiked tail
    const tail = new THREE.Group();
    tail.position.set(0, 0.72, -0.78);
    for (let i = 0; i < 3; i++) {
      const seg = new THREE.Mesh(new THREE.ConeGeometry(0.14 - i * 0.03, 0.34, 6), drakeScaleMat);
      seg.rotation.x = -Math.PI / 2 - 0.18 * i;
      seg.position.set(0, -0.06 * i, -0.18 - i * 0.25);
      tail.add(seg);
    }
    steedGroup.add(tail);

    // 4 heavy armored War-Drake legs
    const legs = [];
    for (const [lx, lz] of [[-0.32, 0.46], [0.32, 0.46], [-0.34, -0.5], [0.34, -0.5]]) {
      const leg = new THREE.Group();
      leg.position.set(lx, 0.62, lz);
      const thigh = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.08, 0.56, 8), drakeScaleMat);
      thigh.position.y = -0.26;
      const hoof = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.14, 8), emberMat);
      hoof.position.y = -0.55;
      leg.add(thigh, hoof);
      steedGroup.add(leg);
      legs.push(leg);
    }

    // Rider group atop ornate saddle
    const rider = new THREE.Group();
    rider.position.set(0, 1.06, 0.02);
    bodyGroup.add(rider);

    const saddle = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.14, 0.54), bronzeArmorMat);
    saddle.position.y = 0.02;
    rider.add(saddle);

    const riderTorso = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.23, 0.58, 10), obsidianMat);
    riderTorso.position.y = 0.38;
    rider.add(riderTorso);

    const chestMedallion = new THREE.Mesh(new THREE.OctahedronGeometry(0.11, 0), emberMat);
    chestMedallion.position.set(0, 0.42, 0.24);
    rider.add(chestMedallion);

    // Layered crimson-gold spiked shoulder pauldrons
    for (const side of [-1, 1]) {
      const pauldron = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 8), bronzeArmorMat);
      pauldron.scale.set(1.2, 0.75, 1.1);
      pauldron.position.set(side * 0.34, 0.6, 0);
      rider.add(pauldron);
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.26, 6), goldBladeMat);
      spike.position.set(side * 0.44, 0.72, 0);
      spike.rotation.z = side * -0.55;
      rider.add(spike);
    }

    // Winged Bronze/Crimson Kabuto War Helm
    const riderHead = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 8), mat({ color: 0x7f1d1d }));
    riderHead.position.y = 0.84;
    rider.add(riderHead);

    const helm = new THREE.Mesh(new THREE.ConeGeometry(0.23, 0.24, 8), bronzeArmorMat);
    helm.position.y = 0.96;
    rider.add(helm);

    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.03, 0.02), emberMat);
      eye.position.set(side * 0.07, 0.85, 0.17);
      rider.add(eye);
      const crestHorn = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.38, 6), goldBladeMat);
      crestHorn.position.set(side * 0.16, 1.06, 0.08);
      crestHorn.rotation.set(0.25, 0, side * -0.52);
      rider.add(crestHorn);
    }

    // Twin iconic Sashimono War-Banners on back
    const banners = [];
    for (const side of [-1, 1]) {
      const bannerGrp = new THREE.Group();
      bannerGrp.position.set(side * 0.26, 0.56, -0.24);
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.25, 6), bronzeArmorMat);
      pole.position.y = 0.55;
      const cloth = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.72, 0.025), crimsonClothMat);
      cloth.position.set(side * 0.14, 0.76, -0.02);
      const trim = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.08, 0.03), bronzeArmorMat);
      trim.position.set(side * 0.14, 1.08, -0.02);
      bannerGrp.add(pole, cloth, trim);
      bannerGrp.rotation.x = -0.18;
      rider.add(bannerGrp);
      banners.push(bannerGrp);
    }

    // Right Arm + Colossal Moon-Crescent Great-Glaive
    const weaponArm = new THREE.Group();
    weaponArm.position.set(-0.36, 0.54, 0.08);
    const armMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.07, 0.44, 8), obsidianMat);
    armMesh.position.y = -0.18;
    weaponArm.add(armMesh);

    const glaive = new THREE.Group();
    glaive.position.set(0, -0.34, 0.15);
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.036, 2.05, 8), bronzeArmorMat);
    shaft.rotation.x = Math.PI / 2.2;
    glaive.add(shaft);
    const crescent = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.055, 6, 12, Math.PI * 1.15), goldBladeMat);
    crescent.position.set(0, 0.18, 0.96);
    crescent.rotation.y = Math.PI / 2;
    const tipSpear = new THREE.Mesh(new THREE.ConeGeometry(0.075, 0.42, 6), emberMat);
    tipSpear.position.set(0, 0.16, 1.12);
    tipSpear.rotation.x = Math.PI / 2.2;
    glaive.add(crescent, tipSpear);
    weaponArm.add(glaive);
    rider.add(weaponArm);

    // Left Arm + Spiked Siege Shield
    const shieldArm = new THREE.Group();
    shieldArm.position.set(0.36, 0.54, 0.08);
    const shieldDisc = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.28, 0.06, 8), bronzeArmorMat);
    shieldDisc.rotation.x = Math.PI / 2;
    shieldDisc.position.set(0.08, -0.16, 0.18);
    const shieldSpike = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.22, 6), emberMat);
    shieldSpike.rotation.x = Math.PI / 2;
    shieldSpike.position.set(0.08, -0.16, 0.3);
    shieldArm.add(shieldDisc, shieldSpike);
    rider.add(shieldArm);

    return {
      visualTopY: 2.85,
      animate(state, time, dt, phase = 1) {
        const isMoving = state === 'chase' || state === 'walk' || state === 'patrol';
        const cycle = time * (isMoving ? 11.5 : 3.2);
        const amp = isMoving ? 0.5 : 0.08;
        legs[0].rotation.x = Math.sin(cycle) * amp;
        legs[1].rotation.x = -Math.sin(cycle) * amp;
        legs[2].rotation.x = -Math.sin(cycle) * amp;
        legs[3].rotation.x = Math.sin(cycle) * amp;
        tail.rotation.y = Math.sin(time * 4.5) * 0.22;
        steedGroup.position.y = isMoving ? Math.abs(Math.sin(cycle)) * 0.08 : 0;
        if (state === 'telegraph' || state === 'skill') {
          steedGroup.rotation.x = -0.18;
          rider.position.y = 1.14;
          weaponArm.rotation.x = -1.75 + Math.sin(time * 12) * 0.18;
        } else if (state === 'attack') {
          steedGroup.rotation.x = 0.06;
          weaponArm.rotation.x = -0.35 + Math.sin(time * 18) * 1.15;
          weaponArm.rotation.y = Math.cos(time * 14) * 0.45;
        } else {
          steedGroup.rotation.x = 0;
          rider.position.y = 1.06 + steedGroup.position.y * 0.8;
          weaponArm.rotation.x = -0.3 + Math.sin(time * 2.5) * 0.08;
          weaponArm.rotation.y = 0;
        }
        banners.forEach((b, i) => {
          b.rotation.z = (i === 0 ? -0.12 : 0.12) + Math.sin(time * (4.5 + phase) + i) * 0.12;
          b.rotation.x = -0.22 + Math.cos(time * 5 + i) * 0.08;
        });
      }
    };
  }

  if (uniqueKey === 'isyutaru') {
    // Isyutaru — Levitating Karakorum Frost Empress (4 Crystalline Ice Wings + Hexagonal Ice Mirror Halo + 6 Frozen Lances)
    const frostSilkMat = mat({ color: 0xe0f2fe, roughness: 0.25, metalness: 0.2 });
    const sapphireMat = mat({ color: 0x0284c7, roughness: 0.3, metalness: 0.5 });
    const iceCrystalMat = glowMat(0x7dd3fc, 0.85, {
      color: 0xbae6fd,
      transparent: true,
      opacity: 0.88,
      metalness: 0.65,
      roughness: 0.12
    });
    const coreIceMat = glowMat(0x38bdf8, 1.25);

    const floatBody = new THREE.Group();
    floatBody.position.y = 0.28;
    bodyGroup.add(floatBody);

    // Flared imperial silk gown
    const lowerGown = new THREE.Mesh(new THREE.ConeGeometry(0.46, 1.02, 12), sapphireMat);
    lowerGown.position.y = 0.56;
    floatBody.add(lowerGown);

    const upperCorset = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.26, 0.5, 10), frostSilkMat);
    upperCorset.position.y = 1.16;
    floatBody.add(upperCorset);

    const crystalBrooch = new THREE.Mesh(new THREE.OctahedronGeometry(0.11, 0), coreIceMat);
    crystalBrooch.position.set(0, 1.24, 0.2);
    floatBody.add(crystalBrooch);

    // Frost Empress Head & Crystalline Tiara Crown
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 10), mat({ color: 0xf1f5f9, roughness: 0.35, metalness: 0.1 }));
    head.position.y = 1.56;
    floatBody.add(head);

    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.032, 6, 6), coreIceMat);
      eye.position.set(side * 0.065, 1.57, 0.16);
      floatBody.add(eye);
    }

    for (let c = -2; c <= 2; c++) {
      const shard = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.3 - Math.abs(c) * 0.045, 5), iceCrystalMat);
      shard.position.set(c * 0.075, 1.82 - Math.abs(c) * 0.03, 0.02);
      shard.rotation.z = -c * 0.2;
      floatBody.add(shard);
    }

    // Iconic Spinning Hexagonal Ice Mirror Halo behind back
    const mirrorHalo = new THREE.Group();
    mirrorHalo.position.set(0, 1.38, -0.32);
    const hexRing = new THREE.Mesh(new THREE.TorusGeometry(0.56, 0.035, 6, 6), coreIceMat);
    mirrorHalo.add(hexRing);
    for (let m = 0; m < 6; m++) {
      const ang = (m / 6) * Math.PI * 2;
      const mirrorNode = new THREE.Mesh(new THREE.OctahedronGeometry(0.11, 0), iceCrystalMat);
      mirrorNode.scale.set(0.7, 1.35, 0.35);
      mirrorNode.position.set(Math.cos(ang) * 0.56, Math.sin(ang) * 0.56, 0);
      mirrorNode.rotation.z = ang;
      mirrorHalo.add(mirrorNode);
    }
    floatBody.add(mirrorHalo);

    // 4 Articulated Crystalline Ice Wings
    const wings = [];
    for (const [side, yOff, scaleW, rotBase] of [[-1, 1.38, 1.0, 0.3], [1, 1.38, 1.0, 0.3], [-1, 1.05, 0.72, -0.25], [1, 1.05, 0.72, -0.25]]) {
      const wGrp = new THREE.Group();
      wGrp.position.set(side * 0.2, yOff, -0.18);
      for (let f = 0; f < 3; f++) {
        const blade = new THREE.Mesh(new THREE.OctahedronGeometry(0.16 * scaleW, 0), iceCrystalMat);
        blade.scale.set(2.9, 0.48, 0.16);
        blade.position.set(side * (0.36 + f * 0.14) * scaleW, (0.18 - f * 0.16) * scaleW, -0.05);
        blade.rotation.z = side * (0.42 - f * 0.28 + rotBase);
        wGrp.add(blade);
      }
      floatBody.add(wGrp);
      wings.push({ grp: wGrp, side, upper: scaleW > 0.8 });
    }

    // 6 Orbiting Frozen Lances
    const lanceOrbit = new THREE.Group();
    lanceOrbit.position.y = 1.15;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const lance = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.58, 5), iceCrystalMat);
      lance.position.set(Math.cos(a) * 0.92, Math.sin(a * 2) * 0.15, Math.sin(a) * 0.92);
      lance.rotation.x = Math.PI / 2;
      lance.rotation.z = -a;
      lanceOrbit.add(lance);
    }
    floatBody.add(lanceOrbit);

    // Right arm with Frost Sceptre
    const sceptreArm = new THREE.Group();
    sceptreArm.position.set(-0.3, 1.24, 0.08);
    const staffPole = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.35, 8), sapphireMat);
    staffPole.position.set(0, -0.08, 0.16);
    staffPole.rotation.x = 0.25;
    const staffGem = new THREE.Mesh(new THREE.OctahedronGeometry(0.14, 0), coreIceMat);
    staffGem.position.set(0, 0.62, 0.34);
    sceptreArm.add(staffPole, staffGem);
    floatBody.add(sceptreArm);

    return {
      visualTopY: 2.65,
      animate(state, time, dt, phase = 1) {
        const hover = Math.sin(time * 2.8) * 0.12;
        floatBody.position.y = 0.28 + hover;
        mirrorHalo.rotation.z = time * (0.9 + phase * 0.35);
        lanceOrbit.rotation.y = time * (1.8 + phase * 0.5);
        lanceOrbit.scale.setScalar((state === 'skill' || state === 'telegraph') ? 1.32 : 1.0);
        const flapFreq = state === 'skill' || state === 'attack' ? 8.5 : 4.2;
        for (const w of wings) {
          const offset = w.upper ? 0 : 0.7;
          w.grp.rotation.y = w.side * (0.25 + Math.sin(time * flapFreq + offset) * 0.32);
        }
        if (state === 'telegraph' || state === 'skill') {
          sceptreArm.rotation.x = -0.95 + Math.sin(time * 10) * 0.18;
        } else if (state === 'attack') {
          sceptreArm.rotation.x = -0.5 + Math.sin(time * 16) * 0.75;
        } else {
          sceptreArm.rotation.x = Math.sin(time * 2.2) * 0.1;
        }
      }
    };
  }

  if (uniqueKey === 'lord_yarkan') {
    // Lord Yarkan — Colossal Taklamakan Demon Monarch (Horns + Spinning Flaming Solar Wheel + Magma Core + Burning Great-Glaive)
    const obsidianMat = mat({ color: 0x1c1917, roughness: 0.38, metalness: 0.75 });
    const bronzeGoldMat = mat({ color: 0xd97706, roughness: 0.26, metalness: 0.88 });
    const magmaMat = glowMat(0xf97316, 1.3, { color: 0xfb923c });
    const goldEmissive = glowMat(0xfacc15, 0.9);

    const titan = new THREE.Group();
    bodyGroup.add(titan);

    // Massive Demon Legs & Greaves
    const legL = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.13, 0.76, 8), obsidianMat);
    legL.position.set(0.22, 0.38, 0);
    const legR = legL.clone();
    legR.position.x = -0.22;
    titan.add(legL, legR);

    // Broad Plated Demon Torso + Exposed Magma Core
    const torso = new THREE.Mesh(new THREE.DodecahedronGeometry(0.46, 0), obsidianMat);
    torso.scale.set(1.22, 1.18, 0.82);
    torso.position.y = 1.12;
    titan.add(torso);

    const magmaCore = new THREE.Mesh(new THREE.OctahedronGeometry(0.22, 0), magmaMat);
    magmaCore.scale.set(1.0, 1.25, 0.55);
    magmaCore.position.set(0, 1.14, 0.34);
    titan.add(magmaCore);

    // Layered Gold Pauldrons with Spikes
    for (const side of [-1, 1]) {
      const pauldron = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.28, 0.42), bronzeGoldMat);
      pauldron.position.set(side * 0.54, 1.44, 0);
      pauldron.rotation.z = side * -0.28;
      titan.add(pauldron);
      const shoulderSpike = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.42, 6), magmaMat);
      shoulderSpike.position.set(side * 0.68, 1.66, 0);
      shoulderSpike.rotation.z = side * -0.45;
      titan.add(shoulderSpike);
    }

    // Demon Head & Towering Swept Obsidian-Gold Devil Horns
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.38, 0.36), obsidianMat);
    head.position.y = 1.78;
    titan.add(head);

    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.045, 0.03), magmaMat);
      eye.position.set(side * 0.09, 1.81, 0.19);
      titan.add(eye);
      const hornLower = new THREE.Mesh(new THREE.ConeGeometry(0.085, 0.44, 7), bronzeGoldMat);
      hornLower.position.set(side * 0.26, 2.02, -0.02);
      hornLower.rotation.z = side * -0.75;
      const hornTip = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.42, 7), magmaMat);
      hornTip.position.set(side * 0.42, 2.28, 0.06);
      hornTip.rotation.z = side * 0.2;
      titan.add(hornLower, hornTip);
    }

    // Iconic Spinning Flaming Solar Wheel behind shoulders
    const solarWheel = new THREE.Group();
    solarWheel.position.set(0, 1.42, -0.44);
    const wheelRim = new THREE.Mesh(new THREE.TorusGeometry(0.66, 0.05, 8, 24), bronzeGoldMat);
    solarWheel.add(wheelRim);
    for (let s = 0; s < 8; s++) {
      const a = (s / 8) * Math.PI * 2;
      const ray = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.32, 5), magmaMat);
      ray.position.set(Math.cos(a) * 0.8, Math.sin(a) * 0.8, 0);
      ray.rotation.z = a - Math.PI / 2;
      solarWheel.add(ray);
    }
    titan.add(solarWheel);

    // Swirling Desert Sand Ring around boots
    const sandRing = new THREE.Mesh(new THREE.TorusGeometry(0.75, 0.045, 6, 24), goldEmissive);
    sandRing.rotation.x = Math.PI / 2;
    sandRing.position.y = 0.12;
    titan.add(sandRing);

    // Arms + Twin-Edged Burning Great-Glaive
    const armR = new THREE.Group();
    armR.position.set(-0.56, 1.32, 0.06);
    const bicepR = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.09, 0.62, 8), obsidianMat);
    bicepR.position.y = -0.26;
    armR.add(bicepR);

    const polearm = new THREE.Group();
    polearm.position.set(0, -0.5, 0.16);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.35, 8), bronzeGoldMat);
    pole.rotation.x = Math.PI / 2.2;
    const bladeFront = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.68, 4), magmaMat);
    bladeFront.position.set(0, 0.22, 1.15);
    bladeFront.rotation.x = Math.PI / 2.2;
    const bladeBack = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.44, 4), goldEmissive);
    bladeBack.position.set(0, -0.18, -1.05);
    bladeBack.rotation.x = -Math.PI / 1.8;
    polearm.add(pole, bladeFront, bladeBack);
    armR.add(polearm);
    titan.add(armR);

    const armL = new THREE.Group();
    armL.position.set(0.56, 1.32, 0.06);
    const bicepL = bicepR.clone();
    const clawL = new THREE.Mesh(new THREE.OctahedronGeometry(0.16, 0), magmaMat);
    clawL.position.y = -0.58;
    armL.add(bicepL, clawL);
    titan.add(armL);

    return {
      visualTopY: 2.85,
      animate(state, time, dt, phase = 1) {
        solarWheel.rotation.z = time * (1.2 + phase * 0.55);
        sandRing.rotation.z = time * 2.2;
        magmaCore.scale.y = 1.25 + Math.sin(time * 5) * 0.12;
        if (state === 'chase' || state === 'walk') {
          const w = time * 7.5;
          legL.rotation.x = Math.sin(w) * 0.45;
          legR.rotation.x = -Math.sin(w) * 0.45;
          armR.rotation.x = -0.35 + Math.cos(w) * 0.3;
          armL.rotation.x = -0.25 - Math.cos(w) * 0.3;
          titan.position.y = Math.abs(Math.sin(w)) * 0.06;
        } else if (state === 'telegraph' || state === 'skill') {
          titan.position.y = 0.08;
          armR.rotation.x = -1.9 + Math.sin(time * 10) * 0.2;
          armL.rotation.x = -1.6;
        } else if (state === 'attack') {
          armR.rotation.x = -0.25 + Math.sin(time * 16) * 1.25;
          armL.rotation.x = -0.45 - Math.sin(time * 16) * 0.6;
        } else {
          legL.rotation.x = 0;
          legR.rotation.x = 0;
          titan.position.y = Math.sin(time * 2.5) * 0.03;
          armR.rotation.x = -0.25 + Math.sin(time * 2.5) * 0.08;
          armL.rotation.x = -0.2;
        }
      }
    };
  }

  if (uniqueKey === 'demon_shaitan') {
    // Demon Shaitan — Towering Winged Archfiend (Flapping Obsidian-Crimson Bat Wings + Curved Ram Horns + Molten Core + Abyssal Hell-Scythe)
    const abyssMat = mat({ color: 0x111827, roughness: 0.45, metalness: 0.65 });
    const demonSkinMat = mat({ color: 0x450a0a, roughness: 0.5, metalness: 0.35 });
    const hellfireMat = glowMat(0xef4444, 1.35, { color: 0xdc2626 });
    const lavaEdgeMat = glowMat(0xfb923c, 1.15);
    const wingMembraneMat = mat({ color: 0x991b1b, emissive: new THREE.Color(0x7f1d1d), emissiveIntensity: 0.45, transparent: true, opacity: 0.88, side: THREE.DoubleSide });

    const fiend = new THREE.Group();
    bodyGroup.add(fiend);

    const legL = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.1, 0.78, 8), demonSkinMat);
    legL.position.set(0.2, 0.39, 0);
    const legR = legL.clone();
    legR.position.x = -0.2;
    fiend.add(legL, legR);

    const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.28, 0.82, 8), demonSkinMat);
    torso.position.y = 1.12;
    fiend.add(torso);

    // Glowing Molten Ribcage Core
    for (let r = 0; r < 3; r++) {
      const rib = new THREE.Mesh(new THREE.TorusGeometry(0.24 - r * 0.03, 0.028, 6, 12, Math.PI), hellfireMat);
      rib.position.set(0, 1.28 - r * 0.14, 0.16);
      rib.rotation.x = Math.PI / 2;
      fiend.add(rib);
    }

    // Archfiend Skull Crown + Twisted Ram Horns
    const head = new THREE.Mesh(new THREE.DodecahedronGeometry(0.21, 0), abyssMat);
    head.position.y = 1.72;
    fiend.add(head);

    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.038, 6, 6), lavaEdgeMat);
      eye.position.set(side * 0.08, 1.74, 0.18);
      fiend.add(eye);
      const ramHorn = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.05, 6, 12, Math.PI * 1.35), abyssMat);
      ramHorn.position.set(side * 0.2, 1.84, -0.02);
      ramHorn.rotation.y = side * Math.PI / 2;
      ramHorn.rotation.z = 0.35;
      fiend.add(ramHorn);
      const hornPoint = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.3, 6), hellfireMat);
      hornPoint.position.set(side * 0.32, 1.98, 0.14);
      hornPoint.rotation.set(0.45, 0, side * -0.4);
      fiend.add(hornPoint);
    }

    // Massive Articulated Obsidian-Crimson Demon Bat Wings
    const batWings = [];
    for (const side of [-1, 1]) {
      const wGrp = new THREE.Group();
      wGrp.position.set(side * 0.28, 1.42, -0.22);
      const spar = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.03, 1.45, 6), abyssMat);
      spar.rotation.z = side * -1.05;
      spar.position.set(side * 0.62, 0.34, -0.08);
      wGrp.add(spar);
      for (let m = 0; m < 3; m++) {
        const panel = new THREE.Mesh(new THREE.ConeGeometry(0.32 - m * 0.04, 0.92 - m * 0.1, 4), wingMembraneMat);
        panel.scale.set(0.95, 1.0, 0.14);
        panel.position.set(side * (0.42 + m * 0.28), 0.12 - m * 0.1, -0.1);
        panel.rotation.z = side * (0.35 + m * 0.15);
        wGrp.add(panel);
      }
      fiend.add(wGrp);
      batWings.push({ grp: wGrp, side });
    }

    // Abyssal Hell-Scythe
    const scytheArm = new THREE.Group();
    scytheArm.position.set(-0.48, 1.36, 0.08);
    const armMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.07, 0.56, 7), abyssMat);
    armMesh.position.y = -0.24;
    scytheArm.add(armMesh);
    const scytheGrp = new THREE.Group();
    scytheGrp.position.set(0, -0.48, 0.15);
    const scythePole = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.035, 2.2, 8), abyssMat);
    scythePole.rotation.x = Math.PI / 2.2;
    const scytheBlade = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.06, 6, 14, Math.PI * 0.95), lavaEdgeMat);
    scytheBlade.position.set(0, 0.24, 1.02);
    scytheBlade.rotation.y = Math.PI / 2;
    scytheBlade.rotation.z = 0.6;
    scytheGrp.add(scythePole, scytheBlade);
    scytheArm.add(scytheGrp);
    fiend.add(scytheArm);

    const clawArmL = new THREE.Group();
    clawArmL.position.set(0.48, 1.36, 0.08);
    const lArmMesh = armMesh.clone();
    const emberOrb = new THREE.Mesh(new THREE.OctahedronGeometry(0.16, 0), hellfireMat);
    emberOrb.position.set(0.04, -0.56, 0.12);
    clawArmL.add(lArmMesh, emberOrb);
    fiend.add(clawArmL);

    // Orbiting Hellfire Shards
    const embers = new THREE.Group();
    embers.position.y = 1.15;
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      const s = new THREE.Mesh(new THREE.OctahedronGeometry(0.09, 0), lavaEdgeMat);
      s.position.set(Math.cos(a) * 0.85, 0, Math.sin(a) * 0.85);
      embers.add(s);
    }
    fiend.add(embers);

    return {
      visualTopY: 2.8,
      animate(state, time, dt, phase = 1) {
        embers.rotation.y = time * (2.2 + phase * 0.8);
        const flapSpeed = state === 'skill' || state === 'chase' ? 6.5 : 3.2;
        for (const w of batWings) {
          w.grp.rotation.y = w.side * (0.18 + Math.sin(time * flapSpeed) * 0.42);
          w.grp.rotation.z = w.side * Math.cos(time * flapSpeed) * 0.12;
        }
        if (state === 'chase' || state === 'walk') {
          const w = time * 8.5;
          legL.rotation.x = Math.sin(w) * 0.48;
          legR.rotation.x = -Math.sin(w) * 0.48;
          fiend.position.y = 0.08 + Math.abs(Math.sin(w)) * 0.08;
        } else {
          legL.rotation.x = 0;
          legR.rotation.x = 0;
          fiend.position.y = Math.sin(time * 3.0) * 0.08;
        }
        if (state === 'telegraph' || state === 'skill') {
          scytheArm.rotation.x = -1.8 + Math.sin(time * 12) * 0.22;
          clawArmL.rotation.x = -1.4;
        } else if (state === 'attack') {
          scytheArm.rotation.x = -0.3 + Math.sin(time * 18) * 1.25;
        } else {
          scytheArm.rotation.x = -0.25 + Math.sin(time * 2.5) * 0.1;
          clawArmL.rotation.x = -0.15;
        }
      }
    };
  }

  if (uniqueKey === 'roc') {
    // Roc — Colossal Four-Winged Celestial Avian Sky-Leviathan (NO humanoid body; pure Griffin/Storm-Phoenix!)
    const azurePlumeMat = mat({ color: 0x0369a1, roughness: 0.35, metalness: 0.45 });
    const royalFeatherMat = mat({ color: 0x0284c7, roughness: 0.3, metalness: 0.55 });
    const goldArmorMat = mat({ color: 0xfacc15, roughness: 0.22, metalness: 0.9 });
    const stormGlowMat = glowMat(0x38bdf8, 1.3, { color: 0x7dd3fc });
    const lightningGoldMat = glowMat(0xfef08a, 1.1, { color: 0xfde047 });

    const birdRoot = new THREE.Group();
    birdRoot.position.y = 0.52;
    bodyGroup.add(birdRoot);

    // Aerodynamic Avian Thorax + Golden Breast Keel Plate
    const birdBody = new THREE.Mesh(new THREE.SphereGeometry(0.52, 16, 12), azurePlumeMat);
    birdBody.scale.set(0.95, 0.88, 1.55);
    birdBody.position.set(0, 0.82, -0.05);
    birdRoot.add(birdBody);

    const breastArmor = new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.85, 8), goldArmorMat);
    breastArmor.rotation.x = Math.PI / 1.8;
    breastArmor.position.set(0, 0.8, 0.45);
    birdRoot.add(breastArmor);

    // Curved Plumed Neck + Fierce Raptor Eagle Head + Hooked Golden Beak
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.32, 0.65, 10), royalFeatherMat);
    neck.position.set(0, 1.22, 0.62);
    neck.rotation.x = 0.5;
    birdRoot.add(neck);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 10), azurePlumeMat);
    head.scale.set(0.95, 0.92, 1.25);
    head.position.set(0, 1.52, 0.88);
    birdRoot.add(head);

    const upperBeak = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.42, 6), goldArmorMat);
    upperBeak.rotation.x = Math.PI / 1.85;
    upperBeak.position.set(0, 1.48, 1.2);
    const beakTipHook = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.16, 5), goldArmorMat);
    beakTipHook.rotation.x = Math.PI * 0.95;
    beakTipHook.position.set(0, 1.38, 1.36);
    birdRoot.add(upperBeak, beakTipHook);

    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.048, 6, 6), stormGlowMat);
      eye.position.set(side * 0.16, 1.56, 1.02);
      birdRoot.add(eye);
      const brow = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.34, 5), lightningGoldMat);
      brow.position.set(side * 0.15, 1.72, 0.78);
      brow.rotation.set(-0.75, 0, side * -0.35);
      birdRoot.add(brow);
    }

    // 5-Plume Celestial Storm Crest
    for (let c = -2; c <= 2; c++) {
      const crest = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.48 - Math.abs(c) * 0.08, 5), c % 2 === 0 ? stormGlowMat : goldArmorMat);
      crest.position.set(c * 0.06, 1.82 - Math.abs(c) * 0.04, 0.68);
      crest.rotation.x = -0.65;
      crest.rotation.z = -c * 0.16;
      birdRoot.add(crest);
    }

    // FOUR Massive Articulated Azure-Gold Feathered Wings
    const allWings = [];
    for (const [side, yOff, zOff, wingScale, phaseShift] of [
      [-1, 1.08, 0.22, 1.15, 0.0],
      [1, 1.08, 0.22, 1.15, 0.0],
      [-1, 0.94, -0.26, 0.85, 0.7],
      [1, 0.94, -0.26, 0.85, 0.7]
    ]) {
      const wGrp = new THREE.Group();
      wGrp.position.set(side * 0.34, yOff, zOff);
      const pinion = new THREE.Mesh(new THREE.BoxGeometry(0.95 * wingScale, 0.12, 0.26), goldArmorMat);
      pinion.position.set(side * 0.48 * wingScale, 0.05, 0);
      wGrp.add(pinion);
      for (let f = 0; f < 6; f++) {
        const feather = new THREE.Mesh(
          new THREE.ConeGeometry(0.11 * wingScale, (1.28 - f * 0.12) * wingScale, 5),
          f % 2 === 0 ? royalFeatherMat : stormGlowMat
        );
        feather.scale.set(0.7, 1.0, 0.22);
        feather.position.set(side * (0.45 + f * 0.22) * wingScale, -0.18 * wingScale, -0.18 - f * 0.06);
        feather.rotation.z = side * (1.25 - f * 0.08);
        wGrp.add(feather);
      }
      birdRoot.add(wGrp);
      allWings.push({ grp: wGrp, side, phaseShift });
    }

    // Fanned Celestial Tail Plumage
    const tailFan = new THREE.Group();
    tailFan.position.set(0, 0.78, -0.82);
    for (let t = -3; t <= 3; t++) {
      const tailFeather = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.95 - Math.abs(t) * 0.08, 5), t % 2 === 0 ? goldArmorMat : stormGlowMat);
      tailFeather.scale.set(0.85, 1.0, 0.2);
      tailFeather.rotation.x = -Math.PI / 2.2;
      tailFeather.rotation.z = t * 0.22;
      tailFeather.position.set(t * 0.12, 0, -0.35);
      tailFan.add(tailFeather);
    }
    birdRoot.add(tailFan);

    // Golden Raptor Talons
    const talons = [];
    for (const side of [-1, 1]) {
      const leg = new THREE.Group();
      leg.position.set(side * 0.28, 0.42, 0.08);
      const shank = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.06, 0.44, 7), goldArmorMat);
      shank.position.y = -0.2;
      leg.add(shank);
      for (const clawIdx of [-1, 0, 1]) {
        const claw = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.24, 5), stormGlowMat);
        claw.position.set(clawIdx * 0.065, -0.44, 0.1);
        claw.rotation.x = 0.8;
        leg.add(claw);
      }
      birdRoot.add(leg);
      talons.push(leg);
    }

    // Celestial Storm Halo + Orbiting Thunder Orbs
    const stormHalo = new THREE.Group();
    stormHalo.position.y = 1.15;
    for (let o = 0; o < 4; o++) {
      const a = (o / 4) * Math.PI * 2;
      const orb = new THREE.Mesh(new THREE.OctahedronGeometry(0.11, 0), lightningGoldMat);
      orb.position.set(Math.cos(a) * 1.15, Math.sin(a * 2) * 0.18, Math.sin(a) * 1.15);
      stormHalo.add(orb);
    }
    birdRoot.add(stormHalo);

    return {
      visualTopY: 2.75,
      animate(state, time, dt, phase = 1) {
        const hover = Math.sin(time * 3.4) * 0.14;
        birdRoot.position.y = 0.52 + hover;
        stormHalo.rotation.y = time * (2.2 + phase * 0.7);
        const flapSpeed = (state === 'skill' || state === 'attack' || state === 'chase') ? 8.8 : 4.6;
        for (const w of allWings) {
          w.grp.rotation.z = w.side * Math.sin(time * flapSpeed + w.phaseShift) * 0.48;
          w.grp.rotation.y = w.side * 0.18 * Math.cos(time * flapSpeed + w.phaseShift);
        }
        tailFan.rotation.x = Math.sin(time * 3.5) * 0.12;
        if (state === 'telegraph' || state === 'skill') {
          birdRoot.rotation.x = -0.22;
          talons.forEach((t) => { t.rotation.x = -0.55; });
        } else if (state === 'attack') {
          birdRoot.rotation.x = 0.24;
          talons.forEach((t, i) => { t.rotation.x = Math.sin(time * 16 + i) * 0.5; });
        } else {
          birdRoot.rotation.x = 0.04;
          talons.forEach((t) => { t.rotation.x = 0.1 + Math.sin(time * 3) * 0.08; });
        }
      }
    };
  }

  // Fallback unique key: 'medusa' — Abyssal Gorgon Queen
  const emeraldMat = mat({ color: 0x065f46, roughness: 0.35, metalness: 0.45 });
  const goldScaleMat = mat({ color: 0xeab308, roughness: 0.25, metalness: 0.85 });
  const venomGlow = glowMat(0x4ade80, 1.15);

  const gorgon = new THREE.Group();
  bodyGroup.add(gorgon);

  const tailSegments = [];
  for (let i = 0; i < 5; i++) {
    const seg = new THREE.Mesh(new THREE.SphereGeometry(0.32 - i * 0.045, 10, 8), i % 2 === 0 ? emeraldMat : goldScaleMat);
    seg.position.set(0, 0.22, -i * 0.34);
    gorgon.add(seg);
    tailSegments.push(seg);
  }

  const upperTorso = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.22, 0.72, 10), emeraldMat);
  upperTorso.position.y = 0.86;
  gorgon.add(upperTorso);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), mat({ color: 0xa7f3d0, roughness: 0.4 }));
  head.position.y = 1.42;
  gorgon.add(head);

  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 6), venomGlow);
    eye.position.set(side * 0.075, 1.44, 0.18);
    gorgon.add(eye);
  }

  const snakeLocks = [];
  for (let s = 0; s < 8; s++) {
    const a = (s / 8) * Math.PI * 2;
    const snake = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.34, 5), venomGlow);
    snake.position.set(Math.cos(a) * 0.22, 1.62, Math.sin(a) * 0.22);
    snake.rotation.z = -Math.cos(a) * 0.45;
    snake.rotation.x = Math.sin(a) * 0.45;
    gorgon.add(snake);
    snakeLocks.push({ mesh: snake, a });
  }

  const staffArm = new THREE.Group();
  staffArm.position.set(-0.32, 1.05, 0.1);
  const staff = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.4, 7), goldScaleMat);
  const venomOrb = new THREE.Mesh(new THREE.OctahedronGeometry(0.14, 0), venomGlow);
  venomOrb.position.y = 0.74;
  staffArm.add(staff, venomOrb);
  gorgon.add(staffArm);

  return {
    visualTopY: 2.5,
    animate(state, time) {
      tailSegments.forEach((seg, i) => {
        seg.position.x = Math.sin(time * 4.5 - i * 0.7) * (0.08 + i * 0.04);
      });
      snakeLocks.forEach((sl, i) => {
        sl.mesh.rotation.z = -Math.cos(sl.a) * (0.4 + Math.sin(time * 5 + i) * 0.2);
      });
      staffArm.rotation.x = (state === 'skill' || state === 'telegraph')
        ? -1.1 + Math.sin(time * 10) * 0.2
        : Math.sin(time * 2.5) * 0.12;
    }
  };
}

export function createMonsterMesh(typeOrConfig = 'slime', options = {}) {
  const cfg = typeof typeOrConfig === 'object' && typeOrConfig !== null
    ? { ...typeOrConfig, ...options }
    : { type: typeOrConfig, ...options };

  const rawType = String(cfg.type || cfg.id || cfg.name || 'slime').toLowerCase();
  const isBoss = Boolean(cfg.isBoss || rawType.includes('boss') || rawType.includes('lord') || rawType.includes('king') || rawType.includes('queen'));
  const isElite = Boolean(cfg.isElite || cfg.elite);
  const isGiant = Boolean(cfg.isGiant);
  const tier = Number(cfg.tier || cfg.level || 1);
  const baseScale = Number(cfg.scale || (isBoss ? 1.85 : isGiant ? 1.62 : isElite ? 1.28 : 1.0));

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

  const uniqueKey = resolveUniquePrefabKey(cfg);
  const usesBespokeUniqueRig = Boolean(
    uniqueKey && uniqueKey !== 'tigerwoman' && (isBoss || cfg.uniquePrefab || cfg.uniqueId)
  );
  const mobSpec = resolveMonsterGlb(rawType, isBoss, cfg.glbPath, cfg.targetHeight, cfg.targetSpan);

  let proceduralBuilt = false;
  const buildProceduralBody = () => {
    if (proceduralBuilt) return;
    proceduralBuilt = true;

  // Determine archetype from name/type
  if (usesBespokeUniqueRig) {
    animKind = 'unique';
    const uniqueBuilt = buildUniqueBossMesh(uniqueKey, bodyGroup, cfg);
    if (uniqueBuilt?.visualTopY) root.userData.visualTopY = uniqueBuilt.visualTopY;
    if (typeof uniqueBuilt?.animate === 'function') {
      root.userData.animateUniqueParts = uniqueBuilt.animate;
    }
  } else if (rawType.includes('slime') || rawType.includes('blob') || rawType.includes('ooze') || rawType.includes('jelly')) {
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
  }; // end buildProceduralBody

  // In browser when an external GLB monster spec exists, defer throwaway multi-part
  // procedural mesh construction until GLB load failure; keep synchronous in Node/headless tests.
  if (typeof window === 'undefined' || typeof document === 'undefined' || !mobSpec || cfg.forceProcedural || usesBespokeUniqueRig) {
    buildProceduralBody();
  }

  // Add Elite / Boss / Giant ground aura ring
  if (isElite || isBoss || isGiant) {
    const auraColor = isBoss ? 0xef4444 : isGiant ? 0xf59e0b : 0xfacc15;
    const ringInner = isGiant ? 0.75 : 0.55;
    const ringOuter = isGiant ? 0.98 : 0.72;
    const auraRing = new THREE.Mesh(
      new THREE.RingGeometry(ringInner, ringOuter, 28),
      new THREE.MeshBasicMaterial({
        color: auraColor,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: isGiant ? 0.85 : 0.65
      })
    );
    auraRing.name = 'AuraRing';
    auraRing.userData.keepWithGLB = true;
    auraRing.userData.noFlash = true;
    auraRing.rotation.x = -Math.PI / 2;
    auraRing.position.y = 0.03;
    root.add(auraRing);
    root.userData.auraRing = auraRing;
  }

  // SRO Monster / Boss GLB Models
  const isTigerBoss = isBoss && (rawType.includes('tigerwoman') || rawType.includes('tigergirl'));
  const hasMount = isTigerBoss || Boolean(cfg.mountGlbPath);
  const mountGlbUrl = cfg.mountGlbPath || (isTigerBoss ? '/assets/sro/mobs/bluetiger.glb' : null);

  if (hasMount && mountGlbUrl) {
    attachGLBModel(root, mountGlbUrl, {
      targetHeight: cfg.mountTargetHeight || 1.78,
      yOffset: cfg.mountYOffset || 0,
      hideFallback: false,
      castShadow: isBoss,
      receiveShadow: isBoss || isGiant,
      onLoaded: (clone, { animations }) => {
        root.userData.mountModel = clone;
        let mountRootBone = null;
        let saddleBone = null;
        clone.traverse((b) => {
          if (!mountRootBone && b.isBone && /^(Bip0[123]|Bone01)$/i.test(b.name)) {
            mountRootBone = b;
          }
          if (!saddleBone && b.name && /saddle/i.test(b.name)) {
            saddleBone = b;
          }
        });
        enableSafeFrustumCulling(clone, 3.2);
        const mountBindRootY = mountRootBone ? mountRootBone.position.y : 0;
        root.userData.saddleBone = saddleBone;
        if (animations && animations.length > 0) {
          const mixer = new THREE.AnimationMixer(clone);
          const actions = {};
          for (const clip of animations) {
            actions[clip.name] = mixer.clipAction(clip);
          }
          root.userData.mountMixer = mixer;
          root.userData.mountActions = actions;
          const stand = actions['STAND1'] || Object.values(actions)[0];
          if (stand) {
            stand.play();
            mixer.update(0.001);
            root.userData.currentMountAction = stand;
            if (mountRootBone && mountRootBone.position.y < mountBindRootY - 0.02) {
              clone.position.y += (mountBindRootY - mountRootBone.position.y) * clone.scale.y;
            }
          }
        }
      }
    });
  }

  // Tiger Girl mounted orb & crown aura (kept alongside tigerwoman.glb + bluetiger.glb)
  if (isTigerBoss) {
    const tFlameMat = new THREE.MeshStandardMaterial({
      color: 0xf97316,
      emissive: new THREE.Color(0xea580c),
      emissiveIntensity: 1.0,
      roughness: 0.25
    });
    const tigerCrownOrbit = new THREE.Group();
    tigerCrownOrbit.position.y = 1.65;
    tigerCrownOrbit.userData.keepWithGLB = true;
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      const orb = new THREE.Mesh(new THREE.OctahedronGeometry(0.08, 0), tFlameMat);
      orb.position.set(Math.cos(a) * 0.72, 0, Math.sin(a) * 0.72);
      tigerCrownOrbit.add(orb);
    }
    root.add(tigerCrownOrbit);
    root.userData.tigerOrbit = tigerCrownOrbit;
    root.userData.visualTopY = 2.68;
  }

  if (mobSpec) {
    const riderYOffset = isTigerBoss ? (mobSpec.yOffset || 0) + 1.02 : mobSpec.yOffset;
    const riderZOffset = isTigerBoss ? -0.06 : 0;
    attachGLBModel(root, mobSpec.url, {
      targetHeight: mobSpec.targetSpan ? null : mobSpec.height,
      targetSpan: mobSpec.targetSpan || null,
      yOffset: riderYOffset,
      zOffset: riderZOffset,
      hideFallback: true,
      castShadow: isBoss,
      receiveShadow: isBoss || isGiant,
      onError: () => {
        buildProceduralBody();
        bodyGroup.traverse((c) => {
          if (c.isMesh && !c.userData.noFlash) {
            patchMeshHitFlash(c, 0xff4444);
            if (root.userData.flashMeshes && !root.userData.flashMeshes.includes(c)) {
              root.userData.flashMeshes.push(c);
            }
          }
        });
        enableShadows(bodyGroup, isBoss, isBoss || isGiant);
      },
      onLoaded: (clone, { animations, bounds }) => {
        root.userData.riderModel = clone;
        if (!isTigerBoss && bounds && bounds.size.y > 0.01) {
          root.userData.visualTopY = Math.max(1.8, bounds.size.y * clone.scale.y + 0.35);
        }
        let rootBone = null;
        clone.traverse((b) => {
          if (!rootBone && b.isBone && /^(Bip0[123]|Bone01)$/i.test(b.name)) {
            rootBone = b;
          }
        });
        enableSafeFrustumCulling(clone, 2.8);
        const bindRootY = rootBone ? rootBone.position.y : 0;

        if (animations && animations.length > 0) {
          const mixer = new THREE.AnimationMixer(clone);
          const actions = {};
          for (const clip of animations) {
            actions[clip.name] = mixer.clipAction(clip);
          }
          root.userData.mixer = mixer;
          root.userData.actions = actions;
          root.userData.currentAction = null;
          const stand = actions['STAND1'] || actions['STAND2'] || actions['WAIT01'] || Object.values(actions)[0];
          if (stand) {
            stand.play();
            mixer.update(0.001);
            root.userData.currentAction = stand;
            root.userData.currentActionName = 'STAND1';
            // Compensate if the monster/boss STAND1 animation drops its root bone below bind pose (e.g., tigerwoman, bluetiger, hyungno, tiger, devilbug, stoneghost)
            if (rootBone && rootBone.position.y < bindRootY - 0.02) {
              const drop = (bindRootY - rootBone.position.y) * clone.scale.y;
              clone.position.y += drop;
              clone.userData.dropCompY = drop;
            }
          }
        }
        clone.userData.baseY = clone.position.y;
      }
    });
  }

  root.scale.setScalar(baseScale);
  attachHitFlashSupport(root);

  const _saddleTmp = new THREE.Vector3();
  root.userData.animate = (stateOrTime = 'idle', timeOrDt = 0, dtArg = 0.016) => {
    const state = typeof stateOrTime === 'string' ? stateOrTime.toLowerCase() : 'idle';
    const time = typeof stateOrTime === 'number' ? stateOrTime : Number(timeOrDt || 0);
    const dt = typeof stateOrTime === 'number' ? Number(timeOrDt || 0.016) : Number(dtArg || 0.016);
    const phaseLevel = Number(root.userData.phaseLevel || 1);

    if (root.userData.hitFlashTimer > 0) {
      root.userData.hitFlashTimer = Math.max(0, root.userData.hitFlashTimer - dt * 6);
      root.userData.setHitFlash(root.userData.hitFlashTimer);
    }

    if (root.userData.auraRing) {
      root.userData.auraRing.rotation.z = time * (1.8 + (phaseLevel - 1) * 1.1);
      if (phaseLevel > 1) {
        const pulse = 1 + Math.sin(time * 6) * 0.06 * phaseLevel;
        root.userData.auraRing.scale.set(pulse, pulse, 1);
      }
    }
    if (root.userData.tigerOrbit) {
      root.userData.tigerOrbit.rotation.y = time * (2.1 + phaseLevel * 0.6);
    }

    // AnimationMixer for SRO GLB Monster & Mount
    if (root.userData.mixer || root.userData.mountMixer) {
      if (root.userData.mixer) root.userData.mixer.update(dt);
      if (root.userData.mountMixer) root.userData.mountMixer.update(dt);

      // Lock rider model onto Blue Tiger 'saddle' bone socket each frame
      if (root.userData.saddleBone && root.userData.riderModel && root.userData.mountModel) {
        root.userData.saddleBone.updateWorldMatrix(true, false);
        root.userData.saddleBone.getWorldPosition(_saddleTmp);
        root.worldToLocal(_saddleTmp);
        const rModel = root.userData.riderModel;
        rModel.position.set(
          _saddleTmp.x,
          Math.max(0.75, _saddleTmp.y - 0.14 + (rModel.userData.dropCompY || 0)),
          _saddleTmp.z - 0.04
        );
      }

      const actions = root.userData.actions;
      if (actions) {
        let targetName = 'STAND1';
        let targetLoop = THREE.LoopRepeat;
        let clamp = false;
        let targetTimeScale = 1.0;
        if (state === 'dead' || state === 'death') {
          targetName = actions['DIE1'] ? 'DIE1' : 'STAND1';
          targetLoop = THREE.LoopOnce;
          clamp = true;
        } else if (state === 'hurt' || state === 'damage' || state === 'hit') {
          targetName = actions['DAMAGE1'] ? 'DAMAGE1' : (actions['DAMAGE2'] ? 'DAMAGE2' : 'STAND1');
          targetLoop = THREE.LoopOnce;
        } else if (state === 'telegraph') {
          targetName = actions['READY01'] ? 'READY01' : (actions['ATTACK2'] ? 'ATTACK2' : (actions['ATTACK1'] ? 'ATTACK1' : 'STAND1'));
          targetLoop = THREE.LoopRepeat;
        } else if (state === 'attack' || state === 'skill') {
          const variant = String(root.userData.attackVariant || (state === 'skill' ? 'ATTACK2' : 'ATTACK1')).toUpperCase();
          targetName = actions[variant]
            ? variant
            : (state === 'skill' && actions['ATTACK3'] ? 'ATTACK3'
            : (state === 'skill' && actions['ATTACK2'] ? 'ATTACK2'
            : (actions['ATTACK1'] ? 'ATTACK1' : (actions['ATTACK2'] ? 'ATTACK2' : 'STAND1'))));
          targetLoop = THREE.LoopOnce;
        } else if (state === 'walk') {
          if (actions['WALK']) {
            targetName = 'WALK';
          } else if (actions['RUN']) {
            targetName = 'RUN';
            targetTimeScale = 0.65;
          } else {
            targetName = actions['WAIT01'] ? 'WAIT01' : (actions['STAND2'] ? 'STAND2' : 'STAND1');
          }
        } else if (state === 'chase' || state === 'run') {
          targetName = actions['RUN'] ? 'RUN' : (actions['WALK'] ? 'WALK' : (actions['WAIT01'] ? 'WAIT01' : (actions['STAND2'] ? 'STAND2' : 'STAND1')));
          targetTimeScale = 1.0;
        }

        const nextAction = actions[targetName] || actions['STAND1'];
        if (nextAction) {
          nextAction.timeScale = targetTimeScale;
        }
        if (nextAction && nextAction !== root.userData.currentAction) {
          if (root.userData.currentAction) {
            root.userData.currentAction.fadeOut(0.18);
          }
          nextAction.reset();
          nextAction.setLoop(targetLoop, targetLoop === THREE.LoopOnce ? 1 : Infinity);
          nextAction.clampWhenFinished = clamp;
          nextAction.fadeIn(0.18).play();
          root.userData.currentAction = nextAction;
          root.userData.currentActionName = targetName;
        }

        // Synchronize mount animations in lockstep
        if (root.userData.mountMixer && root.userData.mountActions) {
          const mActions = root.userData.mountActions;
          const mountKey = (state === 'attack' || state === 'skill')
            ? (mActions['ATTACK1'] ? 'ATTACK1' : 'STAND1')
            : targetName;
          const nextMountAction = mActions[mountKey] || mActions['STAND1'];
          if (nextMountAction && nextMountAction !== root.userData.currentMountAction) {
            if (root.userData.currentMountAction) root.userData.currentMountAction.fadeOut(0.18);
            nextMountAction.reset();
            nextMountAction.setLoop(targetLoop, targetLoop === THREE.LoopOnce ? 1 : Infinity);
            nextMountAction.clampWhenFinished = clamp;
            nextMountAction.fadeIn(0.18).play();
            root.userData.currentMountAction = nextMountAction;
          }
        }
      }
      return;
    }

    if (root.userData.glbModel) {
      if (state === 'dead' || state === 'death') {
        root.userData.glbModel.rotation.x = THREE.MathUtils.lerp(root.userData.glbModel.rotation.x, -Math.PI / 2.2, dt * 8);
        return;
      }
      root.userData.glbModel.position.y = (state === 'chase' || state === 'walk') ? Math.sin(time * 8) * 0.04 : 0;
    }

    if (state === 'dead' || state === 'death') {
      bodyGroup.rotation.x = THREE.MathUtils.lerp(bodyGroup.rotation.x, -Math.PI / 2.2, dt * 8);
      bodyGroup.position.y = THREE.MathUtils.lerp(bodyGroup.position.y, -0.2, dt * 8);
      return;
    }

    bodyGroup.rotation.x = 0;

    if (typeof root.userData.animateUniqueParts === 'function') {
      root.userData.animateUniqueParts(state, time, dt, phaseLevel);
      return;
    }

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

  enableShadows(root, isBoss, isBoss || isGiant);
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
  marker.name = 'QuestMarker';
  marker.userData.keepWithGLB = true;
  marker.userData.isQuestMarker = true;
  root.add(marker);

  // Base circle
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.42, 0.52, 24),
    new THREE.MeshBasicMaterial({ color: accentColor, side: THREE.DoubleSide, transparent: true, opacity: 0.5 })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.02;
  ring.name = 'NpcRing';
  ring.userData.keepWithGLB = true;
  root.add(ring);

  // SRO NPC Character Models with Silkroad animations & SOS glowing weapons
  const idStr = String(
    typeof npcOrRole === 'object' ? (npcOrRole.id || npcOrRole.npcId || roleStr) : npcOrRole
  ).toLowerCase();
  const rLow = roleStr.toLowerCase();
  let npcGlbUrl = '/assets/sro/town/m01.glb';
  let npcTargetH = 1.84;
  let npcSosWeapon = 'sword_04.glb';
  if (idStr === 'pet_merchant' || rLow.includes('tamer') || rLow.includes('pet')) {
    npcGlbUrl = '/assets/sro/town/w07.glb';
    npcTargetH = 1.76;
    npcSosWeapon = 'bow_04.glb';
  } else if (idStr === 'accessory_trader' || rLow.includes('accessory') || rLow.includes('jewelry')) {
    npcGlbUrl = '/assets/sro/town/w05.glb';
    npcTargetH = 1.76;
    npcSosWeapon = 'blade_04.glb';
  } else if (idStr === 'hunter_master' || rLow.includes('hunter')) {
    npcGlbUrl = '/assets/sro/town/guard_spear.glb';
    npcTargetH = 1.88;
    npcSosWeapon = 'spear_04.glb';
  } else if (idStr === 'storage' || rLow.includes('storage') || rLow.includes('quartermaster')) {
    npcGlbUrl = '/assets/sro/town/m06.glb';
    npcTargetH = 1.82;
    npcSosWeapon = 'sword_04.glb';
  } else if (rLow.includes('smith') || rLow.includes('blacksmith') || rLow.includes('weapon') || rLow.includes('forge')) {
    npcGlbUrl = '/assets/sro/town/m03.glb';
    npcTargetH = 1.85;
    npcSosWeapon = 'tblade_04.glb';
  } else if (rLow.includes('chief') || rLow.includes('headman') || rLow.includes('mayor') || rLow.includes('elder')) {
    npcGlbUrl = '/assets/sro/town/elder_m.glb';
    npcTargetH = 1.75;
    npcSosWeapon = 'spear_04.glb';
  } else if (rLow.includes('guard_bow') || rLow.includes('archer')) {
    npcGlbUrl = '/assets/sro/town/guard_bow.glb';
    npcTargetH = 1.85;
    npcSosWeapon = 'bow_04.glb';
  } else if (rLow.includes('guard')) {
    npcGlbUrl = '/assets/sro/town/guard_spear.glb';
    npcTargetH = 1.85;
    npcSosWeapon = 'spear_04.glb';
  } else if (rLow.includes('alchem') || rLow.includes('compos') || rLow.includes('synth') || rLow.includes('gem')) {
    npcGlbUrl = '/assets/sro/town/w01.glb';
    npcTargetH = 1.78;
    npcSosWeapon = 'spear_04.glb';
  } else if (rLow.includes('merchant') || rLow.includes('potion') || rLow.includes('shop') || rLow.includes('item')) {
    npcGlbUrl = '/assets/sro/town/w02.glb';
    npcTargetH = 1.76;
    npcSosWeapon = 'blade_04.glb';
  } else if (rLow.includes('skill') || rLow.includes('master') || rLow.includes('trainer')) {
    npcGlbUrl = '/assets/sro/town/m04.glb';
    npcTargetH = 1.85;
    npcSosWeapon = 'sword_04.glb';
  } else if (rLow.includes('woman') || rLow.includes('f1') || rLow.includes('f2')) {
    npcGlbUrl = '/assets/sro/town/w01.glb';
    npcTargetH = 1.76;
    npcSosWeapon = 'bow_04.glb';
  }

  attachGLBModel(root, npcGlbUrl, {
    targetHeight: npcTargetH,
    yOffset: 0,
    onLoaded: (clone) => {
      const bonesByName = new Map();
      let rootBone = null;
      clone.traverse((c) => {
        if (c.isBone) {
          bonesByName.set(c.name, c);
          bonesByName.set(c.name.replace(/_/g, ' '), c);
          if (!rootBone && /^(Bip0[123]|Bone01)$/i.test(c.name)) rootBone = c;
        }
      });
      enableSafeFrustumCulling(clone, 2.4);
      const bindRootY = rootBone ? rootBone.position.y : 0;

      // Equip glowing SOS (Seal of Star) weapon in hand using bind-pose socket rotation cancellation
      clone.updateMatrixWorld(true);
      const isBow = npcSosWeapon.startsWith('bow');
      const handBone = isBow
        ? (bonesByName.get('Bip01 L Hand') || bonesByName.get('Bip01 L HandMid') || bonesByName.get('Bip01 R Hand'))
        : (bonesByName.get('Bip01 R HandMid') || bonesByName.get('Bip01 R Hand') || bonesByName.get('Bip01 L Hand'));
      let weaponSocket = null;
      if (handBone) {
        weaponSocket = new THREE.Group();
        const bindQuat = new THREE.Quaternion();
        handBone.getWorldQuaternion(bindQuat);
        weaponSocket.quaternion.copy(bindQuat).invert();
        handBone.add(weaponSocket);
      }

      // Bind shared Silkroad STAND1 / WALK / RUN animations from chinaman_warrior.glb so town NPCs never stay in T-pose
      loadGLB('/assets/sro/char/chinaman_warrior.glb').then((animEntry) => {
        if (!animEntry || !animEntry.animations || !animEntry.animations.length) return;
        const mixer = new THREE.AnimationMixer(clone);
        const actions = {};
        for (const clip of animEntry.animations) {
          if (clip.name === 'STAND1' || clip.name === 'WALK' || clip.name === 'RUN') {
            actions[clip.name] = mixer.clipAction(clip);
          }
        }
        root.userData.npcMixer = mixer;
        root.userData.npcActions = actions;
        const startAct = actions['STAND1'] || actions['WALK'];
        if (startAct) {
          startAct.play();
          mixer.update(0.001);
          root.userData.npcCurrentAction = startAct;
          root.userData.npcCurrentActionName = 'STAND1';
          if (rootBone && rootBone.position.y < bindRootY - 0.02) {
            clone.position.y += (bindRootY - rootBone.position.y) * clone.scale.y;
          }
        }
      });

      if (weaponSocket) {
        loadGLB(`/assets/sro/equipment/${npcSosWeapon}`).then((wEntry) => {
          if (!wEntry || !wEntry.scene) return;
          const wClone = SkeletonUtils.clone(wEntry.scene);
          const wMeshes = [];
          wClone.traverse((m) => { if (m.isMesh) wMeshes.push(m); });
          wMeshes.forEach((m) => {
            {
              m.frustumCulled = true;
              if (m.material) {
                const cMat = m.material.clone();
                cMat.transparent = false;
                cMat.alphaTest = 0;
                cMat.depthWrite = true;
                cMat.side = THREE.DoubleSide;
                if (cMat.emissive) {
                  cMat.emissive.setHex(0x38bdf8);
                  cMat.emissiveIntensity = 0.65;
                }
                m.material = cMat;
              }
              if (m.geometry) {
                const shell = new THREE.Mesh(
                  m.geometry,
                  new THREE.MeshBasicMaterial({
                    color: 0x38bdf8,
                    transparent: true,
                    opacity: 0.35,
                    blending: THREE.AdditiveBlending,
                    depthWrite: false,
                    side: THREE.DoubleSide
                  })
                );
                shell.scale.setScalar(1.06);
                shell.frustumCulled = true;
                m.add(shell);
              }
            }
          });
          weaponSocket.add(wClone);
        });
      }
    }
  });

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

  root.userData.animate = (stateOrTime = 0, timeOrDt = 0.016, maybeDt = 0.016) => {
    let st = 'idle';
    let t = 0;
    let dt = 0.016;
    if (typeof stateOrTime === 'string') {
      st = stateOrTime.toLowerCase();
      t = typeof timeOrDt === 'number' ? timeOrDt : 0;
      dt = typeof maybeDt === 'number' ? maybeDt : 0.016;
    } else {
      t = typeof stateOrTime === 'number' ? stateOrTime : 0;
      dt = typeof timeOrDt === 'number' ? timeOrDt : 0.016;
    }
    marker.position.y = 1.75 + Math.sin(t * 3.5) * 0.08;
    marker.rotation.y = t * 2.2;
    if (root.userData.npcMixer && root.userData.npcActions) {
      const wantWalk = st === 'walk' || st === 'run';
      const wantName = wantWalk
        ? (root.userData.npcActions['WALK'] ? 'WALK' : 'RUN')
        : 'STAND1';
      const nextAct = root.userData.npcActions[wantName];
      if (nextAct && root.userData.npcCurrentActionName !== wantName) {
        if (root.userData.npcCurrentAction) root.userData.npcCurrentAction.fadeOut(0.18);
        nextAct.reset().fadeIn(0.18).play();
        root.userData.npcCurrentAction = nextAct;
        root.userData.npcCurrentActionName = wantName;
      }
      root.userData.npcMixer.update(Math.min(0.05, Math.max(0.001, dt)));
    }
  };

  enableShadows(root, true, true);
  return root;
}

/**
 * Create interactive 3D Treasure Chest with hinged lid (Silkroad iron-bound wooden/golden treasure coffer)
 */
function _getChestAssets(tierKey) {
  let cached = _chestAssetCache.get(tierKey);
  if (cached) return cached;

  const isStorage = tierKey === 'storage';
  const isGold = isStorage || tierKey === 'gold';
  const boxColor = isStorage ? 0x1e3a8a : isGold ? 0x78350f : 0x451a03;
  const trimColor = isGold ? 0xfacc15 : 0x94a3b8;

  const woodMat = _markShared(new THREE.MeshStandardMaterial({ color: boxColor, roughness: 0.65, metalness: 0.15 }));
  const trimMat = _markShared(new THREE.MeshStandardMaterial({ color: trimColor, roughness: 0.25, metalness: 0.85 }));
  const studMat = _markShared(new THREE.MeshStandardMaterial({ color: isGold ? 0xfef08a : 0xcbd5e1, roughness: 0.2, metalness: 0.9 }));
  const keyholeMat = _markShared(new THREE.MeshBasicMaterial({ color: 0x0f172a }));
  const glowMat = _markShared(new THREE.MeshBasicMaterial({ color: isGold ? 0xfef08a : 0x38bdf8 }));

  // Base wood box
  const baseWoodGeo = new THREE.BoxGeometry(0.78, 0.42, 0.52);
  baseWoodGeo.translate(0, 0.21, 0);

  // Trim bands & lock plate
  const bandLGeo = new THREE.BoxGeometry(0.06, 0.43, 0.53);
  bandLGeo.translate(-0.24, 0.21, 0);
  const bandRGeo = new THREE.BoxGeometry(0.06, 0.43, 0.53);
  bandRGeo.translate(0.24, 0.21, 0);
  const waistGeo = new THREE.BoxGeometry(0.79, 0.05, 0.53);
  waistGeo.translate(0, 0.40, 0);
  const lockPlateGeo = new THREE.BoxGeometry(0.14, 0.16, 0.04);
  lockPlateGeo.translate(0, 0.28, 0.27);
  const baseTrimGeo = mergeStaticGeometries([bandLGeo, bandRGeo, waistGeo, lockPlateGeo], false);

  // Corner studs
  const studParts = [];
  for (const sx of [-0.38, 0.38]) {
    for (const sz of [-0.25, 0.25]) {
      const sb = new THREE.BoxGeometry(0.05, 0.05, 0.05);
      sb.translate(sx, 0.03, sz);
      const st = new THREE.BoxGeometry(0.05, 0.05, 0.05);
      st.translate(sx, 0.39, sz);
      studParts.push(sb, st);
    }
  }
  const baseStudGeo = mergeStaticGeometries(studParts, false);

  // Keyhole
  const keyholeGeo = new THREE.CylinderGeometry(0.015, 0.02, 0.045, 8);
  keyholeGeo.rotateX(Math.PI / 2);
  keyholeGeo.translate(0, 0.27, 0.285);

  const baseGeo = mergeStaticGeometries([baseWoodGeo, baseTrimGeo, baseStudGeo, keyholeGeo], true);
  const glowGeo = _markShared(new THREE.BoxGeometry(0.66, 0.06, 0.42));

  // Lid vault + curved bands + latch
  const vaultGeo = new THREE.CylinderGeometry(0.26, 0.26, 0.78, 16, 1, false, 0, Math.PI);
  vaultGeo.rotateZ(Math.PI / 2);
  vaultGeo.translate(0, 0.02, 0.26);

  const lidBandLGeo = new THREE.CylinderGeometry(0.266, 0.266, 0.06, 16, 1, false, 0, Math.PI);
  lidBandLGeo.rotateZ(Math.PI / 2);
  lidBandLGeo.translate(-0.24, 0.02, 0.26);
  const lidBandRGeo = new THREE.CylinderGeometry(0.266, 0.266, 0.06, 16, 1, false, 0, Math.PI);
  lidBandRGeo.rotateZ(Math.PI / 2);
  lidBandRGeo.translate(0.24, 0.02, 0.26);
  const latchGeo = new THREE.BoxGeometry(0.08, 0.12, 0.05);
  latchGeo.translate(0, 0.02, 0.525);
  const lidTrimGeo = mergeStaticGeometries([lidBandLGeo, lidBandRGeo, latchGeo], false);
  const lidGeo = mergeStaticGeometries([vaultGeo, lidTrimGeo], true);

  cached = {
    baseGeo,
    baseMats: [woodMat, trimMat, studMat, keyholeMat],
    glowGeo,
    glowMat,
    lidGeo,
    lidMats: [woodMat, trimMat],
  };
  _chestAssetCache.set(tierKey, cached);
  return cached;
}

export function createChestMesh(tier = 'normal', isOpen = false) {
  const root = new THREE.Group();
  root.name = `Chest_${tier}`;

  const tierStr = String(tier || 'normal').toLowerCase();
  const isStorage = tierStr.includes('storage') || tierStr.includes('vault');
  const isGold = isStorage || tierStr.includes('boss') || tierStr.includes('gold') || tierStr.includes('epic') || tierStr.includes('rare') || tierStr.includes('legend');
  const tierKey = isStorage ? 'storage' : isGold ? 'gold' : 'normal';
  const assets = _getChestAssets(tierKey);

  const baseMesh = new THREE.Mesh(assets.baseGeo, assets.baseMats);
  root.add(baseMesh);

  // Inner treasure glow
  const innerGlow = new THREE.Mesh(assets.glowGeo, assets.glowMat);
  innerGlow.position.y = 0.40;
  innerGlow.visible = Boolean(isOpen);
  root.add(innerGlow);

  // Hinged Coffer Lid with curved barrel-vaulted top
  const lidPivot = new THREE.Group();
  lidPivot.name = 'ChestLid';
  lidPivot.position.set(0, 0.42, -0.26);
  root.add(lidPivot);
  root.userData.lid = lidPivot;

  const lidMesh = new THREE.Mesh(assets.lidGeo, assets.lidMats);
  lidPivot.add(lidMesh);

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
export function createPortalMesh(colorOrOptions = 0x38bdf8, type = 'dungeon', extraOpts = null) {
  const optsObj = typeof colorOrOptions === 'object' && colorOrOptions !== null
    ? { ...colorOrOptions, ...(extraOpts || {}) }
    : { color: colorOrOptions, ...(extraOpts || {}) };
  const color = optsObj.color ?? 0x38bdf8;
  const portalStyle = String(optsObj.portalStyle || type || 'classic');

  const root = new THREE.Group();
  root.name = `Portal_${type}`;

  const styleColors = {
    donhwang_moss: 0x34d399,
    donhwang_earth: 0xf59e0b,
    donhwang_tiger: 0xfb923c,
    oasis_mirage: 0xeab308,
    karakoram_frost: 0x38bdf8,
    karakoram_storm: 0x818cf8,
    qinshi_terracotta: 0xfbbf24,
    qinshi_lantern: 0x2dd4bf,
    qinshi_guardian: 0x22d3ee,
    flame_ash: 0xfb923c,
    taklamakan_bone: 0xa855f7,
    flame_core: 0xef4444,
    holywater_aqua: 0x06b6d4,
    jupiter_olympus: 0xfde047,
    shambhala_void: 0xc026d3,
    roc_celestial: 0x7dd3fc,
    togui_mask: 0xf97316,
    wreck_abyss: 0x0ea5e9,
    medusa_venom: 0x10b981
  };
  const accentColor = optsObj.accentColor || styleColors[portalStyle] || color;

  const stoneMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.8, metalness: 0.2 });
  const runeMat = new THREE.MeshStandardMaterial({
    color: accentColor,
    emissive: new THREE.Color(accentColor),
    emissiveIntensity: 0.9,
    roughness: 0.2
  });

  // Pedestal base + style crest
  const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.35, 0.18, 16), stoneMat);
  pedestal.position.y = 0.09;
  root.add(pedestal);

  // Per-floor distinctive portal sigil pillars / orbiting crystal nodes
  const styleNodes = [];
  if (type !== 'selector') {
    const nodeCount = portalStyle.includes('roc') || portalStyle.includes('jupiter') ? 6 : 4;
    const nodeGeo = portalStyle.includes('flame') || portalStyle.includes('togui')
      ? new THREE.ConeGeometry(0.12, 0.34, 4)
      : new THREE.OctahedronGeometry(0.14, 0);
    for (let i = 0; i < nodeCount; i++) {
      const a = (i / nodeCount) * Math.PI * 2;
      const orbNode = new THREE.Mesh(nodeGeo, runeMat);
      orbNode.position.set(Math.cos(a) * 1.24, 1.15 + (i % 2) * 0.35, Math.sin(a) * 1.24);
      orbNode.userData.keepWithGLB = true;
      orbNode.userData.baseAngle = a;
      root.add(orbNode);
      styleNodes.push(orbNode);
    }
  }

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
  vortex.userData.keepWithGLB = true;
  root.add(vortex);

  const innerRing = new THREE.Mesh(new THREE.TorusGeometry(0.68, 0.035, 8, 20), runeMat);
  innerRing.position.y = 1.05;
  innerRing.userData.keepWithGLB = true;
  root.add(innerRing);

  if (type === 'selector') {
    // Waystone: SRO teleport stele with a flat rune circle at its foot
    vortex.userData.keepWithGLB = false;
    innerRing.rotation.x = -Math.PI / 2;
    innerRing.position.y = 0.06;
    innerRing.scale.setScalar(1.15);
    attachGLBModel(root, '/assets/sro/props/cj_portal_stone.glb', {
      targetHeight: 1.85,
      groundAtZero: true,
      centerXZ: true
    });
  } else {
    // SRO portal pavilion: its floor slab (CJ_por_floor, y~0.91) is the ground line; the rock
    // shaft below it is a foundation that must stay buried instead of lifting the pavilion up.
    const PAVILION_SCALE = 0.32;
    attachGLBModel(root, '/assets/sro/props/cj_portal.glb', {
      scale: PAVILION_SCALE,
      centerXZ: true,
      onLoaded: (clone) => {
        let floorY = 0.91;
        const floor = clone.getObjectByName('CJ_por_floor');
        if (floor?.geometry) {
          floor.geometry.computeBoundingBox();
          floorY = floor.geometry.boundingBox.min.y;
        }
        clone.position.y = -floorY * PAVILION_SCALE;
      }
    });
    // Vortex sits between the pavilion pillars, just in front of the teleport stone
    vortex.scale.setScalar(0.72);
    vortex.position.set(0, 0.95, 0.12);
    innerRing.scale.setScalar(0.72);
    innerRing.position.set(0, 0.95, 0.12);
  }
  const vortexBaseScale = vortex.scale.x;

  // Extra halo & emergence beacon for Challenge / Challenge-Return portals
  let outerHalo = null;
  let spawnBeacon = null;
  if (type === 'challenge' || type === 'challenge_return') {
    outerHalo = new THREE.Mesh(
      new THREE.TorusGeometry(1.18, 0.04, 8, 28),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.78 })
    );
    outerHalo.rotation.x = Math.PI / 2;
    outerHalo.position.y = 0.22;
    outerHalo.userData.keepWithGLB = true;
    root.add(outerHalo);

    spawnBeacon = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.95, 5.2, 16, 1, true),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.0, side: THREE.DoubleSide, depthWrite: false })
    );
    spawnBeacon.position.y = 2.6;
    spawnBeacon.visible = false;
    spawnBeacon.userData.keepWithGLB = true;
    root.add(spawnBeacon);
  }

  // Sealed state (boss rift / floor clear lock): dim, slow vortex + crimson seal indicator
  root.userData.locked = false;
  root.userData.setLocked = (locked = true) => {
    root.userData.locked = Boolean(locked);
    vortexMat.opacity = locked ? 0.2 : 0.72;
    vortexMat.color.setHex(locked ? 0xef4444 : color);
    runeMat.emissiveIntensity = locked ? 0.18 : 0.9;
    runeMat.emissive.setHex(locked ? 0x991b1b : accentColor);
    if (outerHalo) outerHalo.material.opacity = locked ? 0.15 : 0.78;
  };
  root.userData.setSealed = root.userData.setLocked;

  let spawnTimer = -1;
  const spawnDuration = 1.15;
  root.userData.playSpawnAnimation = () => {
    spawnTimer = 0;
    root.scale.setScalar(0.05);
    if (spawnBeacon) {
      spawnBeacon.visible = true;
      spawnBeacon.material.opacity = 0.85;
    }
  };

  root.userData.animate = (time = 0, dt = 0.016) => {
    const t = typeof time === 'number' ? time : 0;
    const step = typeof dt === 'number' ? dt : 0.016;
    if (spawnTimer >= 0) {
      spawnTimer += step;
      const p = Math.min(1, spawnTimer / spawnDuration);
      // EaseOutBack bounce-emerge animation
      const c1 = 1.70158;
      const c3 = c1 + 1;
      const s = 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2);
      root.scale.setScalar(Math.max(0.05, s));
      if (spawnBeacon) {
        spawnBeacon.material.opacity = Math.max(0, (1 - p) * 0.85);
        spawnBeacon.rotation.y = t * 4.5;
        if (p >= 1) spawnBeacon.visible = false;
      }
      if (p >= 1) {
        spawnTimer = -1;
        root.scale.setScalar(1);
      }
    }
    const burstMult = spawnTimer >= 0 ? 4.0 : 1.0;
    innerRing.rotation.z = t * (root.userData.locked ? 0.4 : 2.5 * burstMult);
    vortex.scale.setScalar(vortexBaseScale * (0.96 + Math.sin(t * 4) * 0.05));
    if (outerHalo) {
      outerHalo.rotation.z = -t * 1.4;
      outerHalo.position.y = 0.22 + Math.sin(t * 2.5) * 0.08;
    }
  };

  enableShadows(root, true, true);
  return root;
}

/**
 * Create Breakable Dungeon Props (Barrel, Crate, Urn)
 * Realistic medieval/Silkroad barrels with curved staves, dark iron hoops, wooden lid & rivets.
 */
function _getBreakableAssets(cacheKey) {
  let cached = _breakableAssetCache.get(cacheKey);
  if (cached) return cached;

  if (cacheKey === 'crate') {
    const woodMat = _markShared(new THREE.MeshStandardMaterial({ color: 0x783e18, roughness: 0.8 }));
    const metalMat = _markShared(new THREE.MeshStandardMaterial({ color: 0x2e333b, metalness: 0.8, roughness: 0.4 }));
    const boxGeo = new THREE.BoxGeometry(0.62, 0.62, 0.62);
    boxGeo.translate(0, 0.31, 0);

    const bandHGeo = new THREE.BoxGeometry(0.63, 0.08, 0.63);
    bandHGeo.translate(0, 0.31, 0);
    const bandTopGeo = new THREE.BoxGeometry(0.63, 0.035, 0.63);
    bandTopGeo.translate(0, 0.60, 0);
    const bandBotGeo = new THREE.BoxGeometry(0.63, 0.035, 0.63);
    bandBotGeo.translate(0, 0.02, 0);
    const metalGeo = mergeStaticGeometries([bandHGeo, bandTopGeo, bandBotGeo], false);

    const geo = mergeStaticGeometries([boxGeo, metalGeo], true);
    cached = { geo, mats: [woodMat, metalMat] };
  } else if (cacheKey === 'urn') {
    const mat = _markShared(new THREE.MeshStandardMaterial({ color: 0xba5d23, roughness: 0.62 }));
    const darkMat = _markShared(new THREE.MeshStandardMaterial({ color: 0x7c3814, roughness: 0.7 }));
    const urnPoints = [
      new THREE.Vector2(0.14, 0),
      new THREE.Vector2(0.25, 0.22),
      new THREE.Vector2(0.27, 0.36),
      new THREE.Vector2(0.16, 0.52),
      new THREE.Vector2(0.15, 0.60),
      new THREE.Vector2(0.20, 0.64)
    ];
    const urnGeo = new THREE.LatheGeometry(urnPoints, 16);
    const rimGeo = new THREE.TorusGeometry(0.19, 0.02, 6, 16);
    rimGeo.rotateX(Math.PI / 2);
    rimGeo.translate(0, 0.64, 0);

    const geo = mergeStaticGeometries([urnGeo, rimGeo], true);
    cached = { geo, mats: [mat, darkMat] };
  } else {
    const isExplosive = cacheKey === 'barrel_explosive';
    const H = 0.74;
    const rEnds = 0.285;
    const rBelly = 0.365;
    const segments = 12;

    const points = [];
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const y = t * H;
      const bulge = Math.sin(t * Math.PI) * (rBelly - rEnds);
      points.push(new THREE.Vector2(rEnds + bulge, y));
    }
    const bodyGeo = new THREE.LatheGeometry(points, 18);
    const woodMat = _markShared(new THREE.MeshStandardMaterial({
      color: isExplosive ? 0xb91c1c : 0x6e3d1b,
      emissive: isExplosive ? new THREE.Color(0x7f1d1d) : new THREE.Color(0x000000),
      emissiveIntensity: isExplosive ? 0.45 : 0,
      roughness: 0.72,
      metalness: 0.04
    }));

    const lidGeo = new THREE.CylinderGeometry(0.275, 0.275, 0.025, 18);
    lidGeo.translate(0, H - 0.02, 0);
    const lidMat = _markShared(new THREE.MeshStandardMaterial({ color: 0x583015, roughness: 0.82 }));

    const rimGeo = new THREE.TorusGeometry(0.288, 0.014, 6, 18);
    rimGeo.rotateX(Math.PI / 2);
    rimGeo.translate(0, H, 0);
    const rimMat = _markShared(new THREE.MeshStandardMaterial({ color: 0x502a12, roughness: 0.8 }));

    const corkGeo = new THREE.CylinderGeometry(0.032, 0.026, 0.028, 8);
    corkGeo.translate(0.07, H - 0.005, 0.04);
    const corkMat = _markShared(new THREE.MeshStandardMaterial({ color: 0x8a5228, roughness: 0.65 }));

    const calcRadius = (y) => {
      const t = y / H;
      return rEnds + Math.sin(t * Math.PI) * (rBelly - rEnds);
    };
    const hoopYs = [H * 0.87, H * 0.63, H * 0.37, H * 0.13];
    const hoopMat = _markShared(new THREE.MeshStandardMaterial({ color: 0x22252a, metalness: 0.85, roughness: 0.38 }));
    const ironParts = [];
    for (let hi = 0; hi < hoopYs.length; hi++) {
      const hy = hoopYs[hi];
      const hr = calcRadius(hy);
      const hoopGeo = new THREE.TorusGeometry(hr + 0.004, 0.016, 6, 20);
      hoopGeo.rotateX(Math.PI / 2);
      hoopGeo.translate(0, hy, 0);
      ironParts.push(hoopGeo);
      for (let a = 0; a < 4; a++) {
        const angle = (a * Math.PI) / 2 + 0.2;
        const rx = Math.cos(angle) * (hr + 0.015);
        const rz = Math.sin(angle) * (hr + 0.015);
        const rivetGeo = new THREE.SphereGeometry(0.012, 4, 4);
        rivetGeo.translate(rx, hy, rz);
        ironParts.push(rivetGeo);
      }
    }
    const ironGeo = mergeStaticGeometries(ironParts, false);
    const geo = mergeStaticGeometries([bodyGeo, lidGeo, rimGeo, corkGeo, ironGeo], true);
    cached = { geo, mats: [woodMat, lidMat, rimMat, corkMat, hoopMat] };
  }

  _breakableAssetCache.set(cacheKey, cached);
  return cached;
}

export function createBreakableMesh(type = 'barrel') {
  const root = new THREE.Group();
  const rawKind = String(type || 'barrel').toLowerCase();
  const kind = rawKind.includes('crystal') ? 'urn' : rawKind;
  root.name = `Breakable_${kind}`;

  const cacheKey = (kind.includes('crate') || kind.includes('box'))
    ? 'crate'
    : (kind.includes('urn') || kind.includes('vase') || kind.includes('pot'))
      ? 'urn'
      : kind.includes('explosive')
        ? 'barrel_explosive'
        : 'barrel';

  const assets = _getBreakableAssets(cacheKey);
  if (assets?.geo) {
    root.add(new THREE.Mesh(assets.geo, assets.mats));
  }

  attachHitFlashSupport(root);
  enableShadows(root, true, true);
  return root;
}

/**
 * Create Ground Loot Mesh (Celestial Rarity Drop Beams & Distinct Ground Loot Meshes)
 */
export function createLootMesh(itemOrType = 'bag', rarity = 'normal') {
  let item = {};
  if (typeof itemOrType === 'string') {
    item = { type: itemOrType, rarity };
  } else if (itemOrType && typeof itemOrType === 'object') {
    item = { ...itemOrType };
    if (!item.rarity && rarity) item.rarity = rarity;
  }

  const group = new THREE.Group();
  group.userData = { type: 'loot', item };

  const itemType = String(item.type || item.slot || '').toLowerCase();
  const itemId = String(item.id || '').toLowerCase();
  const isGold = itemType === 'gold' || itemType === 'coin' || itemType === 'coins';

  const coreGroup = new THREE.Group();
  coreGroup.name = 'LootCore';

  if (isGold) {
    // Pile of 3-5 golden coins/ingots (0xfacc15)
    const coinMat = getCachedAsset(_lootMatCache, 'goldCoin', () => new THREE.MeshStandardMaterial({
      color: 0xfacc15,
      emissive: new THREE.Color(0xfacc15),
      emissiveIntensity: 0.45,
      roughness: 0.25,
      metalness: 0.85
    }));
    const coinGeo = getCachedAsset(_lootGeoCache, 'goldCoin', () => new THREE.CylinderGeometry(0.14, 0.14, 0.045, 12));

    const c1 = new THREE.Mesh(coinGeo, coinMat);
    c1.position.set(-0.06, 0.025, 0.04);
    c1.rotation.y = 0.2;

    const c2 = new THREE.Mesh(coinGeo, coinMat);
    c2.position.set(0.07, 0.03, -0.03);
    c2.rotation.y = -0.4;

    const c3 = new THREE.Mesh(coinGeo, coinMat);
    c3.position.set(0.01, 0.07, 0.02);
    c3.rotation.x = 0.12;
    c3.rotation.z = -0.15;

    const ingotGeo = getCachedAsset(_lootGeoCache, 'goldIngot', () => new THREE.BoxGeometry(0.2, 0.05, 0.1));
    const c4 = new THREE.Mesh(ingotGeo, coinMat);
    c4.position.set(-0.02, 0.10, -0.02);
    c4.rotation.y = 0.55;
    c4.rotation.x = 0.1;

    coreGroup.add(c1, c2, c3, c4);
  } else {
    // Silkroad Treasure Chest / Coffer geometry as the instant synchronous placeholder for all dropped items
    const rawRar = String(item.rarity || rarity || 'normal');
    const rarColor = item.seal ? (SEALS?.[item.seal]?.color ? cssToHex(SEALS[item.seal].color) : 0xf59e0b) : getRarityColor(rawRar);
    const chestMat = getCachedAsset(_lootMatCache, `chest:${rarColor}`, () => new THREE.MeshStandardMaterial({
      color: rarColor,
      emissive: new THREE.Color(rarColor),
      emissiveIntensity: 0.42,
      roughness: 0.35,
      metalness: 0.45
    }));
    const trimMat = getCachedAsset(_lootMatCache, 'chestTrim', () => new THREE.MeshStandardMaterial({
      color: 0xfbbf24,
      roughness: 0.25,
      metalness: 0.85
    }));

    const boxGeo = getCachedAsset(_lootGeoCache, 'chestBox', () => new THREE.BoxGeometry(0.32, 0.18, 0.22));
    const box = new THREE.Mesh(boxGeo, chestMat);
    box.position.y = 0.10;

    const lidGeo = getCachedAsset(_lootGeoCache, 'chestLid', () => new THREE.CylinderGeometry(0.11, 0.11, 0.322, 14, 1, false, 0, Math.PI));
    const lid = new THREE.Mesh(lidGeo, chestMat);
    lid.position.set(0, 0.19, 0);
    lid.rotation.z = Math.PI / 2;

    const lockGeo = getCachedAsset(_lootGeoCache, 'chestLock', () => new THREE.BoxGeometry(0.05, 0.06, 0.04));
    const lock = new THREE.Mesh(lockGeo, trimMat);
    lock.position.set(0, 0.14, 0.115);

    const bandGeo = getCachedAsset(_lootGeoCache, 'chestBand', () => new THREE.BoxGeometry(0.045, 0.19, 0.23));
    const band = new THREE.Mesh(bandGeo, trimMat);
    band.position.y = 0.10;

    coreGroup.add(box, lid, lock, band);
  }
  group.add(coreGroup);

  // Celestial Rarity Pillar (RARITY_BEAMS)
  const rawSeal = String(item.seal || '').toLowerCase().replace(/^sealof/, '');
  const rawRar = String(item.rarity || rarity || '').toLowerCase();
  const beamSpec = RARITY_BEAMS?.[rawSeal] || RARITY_BEAMS?.[item.seal] || RARITY_BEAMS?.[rawRar] || null;

  let orbitGroup = null;
  let rippleRing = null;

  if (beamSpec) {
    // Tall vertical translucent additive light cylinder
    const beamRadius = beamSpec.radius || 0.25;
    const beamHeight = beamSpec.height || 2.8;
    const beamOpacity = beamSpec.opacity || 0.38;
    const cylGeo = getCachedAsset(_lootGeoCache, `beamCyl:${beamRadius}:${beamHeight}`, () => new THREE.CylinderGeometry(
      beamRadius * 0.45,
      beamRadius,
      beamHeight,
      12,
      1,
      true
    ));
    const cylMat = getCachedAsset(_lootMatCache, `beamCyl:${beamSpec.color}:${beamOpacity}`, () => new THREE.MeshBasicMaterial({
      color: beamSpec.color,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: beamOpacity,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    }));
    const beamMesh = new THREE.Mesh(cylGeo, cylMat);
    beamMesh.name = 'LootBeam';
    beamMesh.userData.keepWithGLB = true;
    beamMesh.userData.isRarityBeam = true;
    beamMesh.position.y = beamHeight / 2;
    group.userData.rarityBeam = beamMesh;
    group.add(beamMesh);

    // Ground ripple ring at y = 0.04
    const ringGeo = getCachedAsset(_lootGeoCache, `beamRing:${beamSpec.ringRadius}`, () => new THREE.RingGeometry(beamSpec.ringRadius * 0.7, beamSpec.ringRadius, 24));
    const ringMat = getCachedAsset(_lootMatCache, `beamRing:${beamSpec.color}`, () => new THREE.MeshBasicMaterial({
      color: beamSpec.color,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.6,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    }));
    rippleRing = new THREE.Mesh(ringGeo, ringMat);
    rippleRing.name = 'RarityRing';
    rippleRing.userData.keepWithGLB = true;
    rippleRing.rotation.x = -Math.PI / 2;
    rippleRing.position.y = 0.04;
    group.add(rippleRing);

    // Orbiting group containing beamSpec.orbitCount glowing star/moon/sun shards
    orbitGroup = new THREE.Group();
    orbitGroup.name = 'OrbitRing';
    orbitGroup.userData.isOrbitRing = true;
    orbitGroup.userData.keepWithGLB = true;
    group.userData.orbitGroup = orbitGroup;

    const shardRadius = beamSpec.ringRadius * 0.75;
    const shardGeo = getCachedAsset(_lootGeoCache, 'beamShard', () => new THREE.OctahedronGeometry(0.08, 0));
    const shardMat = getCachedAsset(_lootMatCache, `beamShard:${beamSpec.color}`, () => new THREE.MeshBasicMaterial({
      color: beamSpec.color,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending
    }));
    for (let i = 0; i < beamSpec.orbitCount; i++) {
      const angle = (i / beamSpec.orbitCount) * Math.PI * 2;
      const shard = new THREE.Mesh(shardGeo, shardMat);
      shard.position.set(
        Math.cos(angle) * shardRadius,
        0.65,
        Math.sin(angle) * shardRadius
      );
      orbitGroup.add(shard);
    }
    group.add(orbitGroup);
  } else {
    // Non-celestial items: simple beacon
    const col = isGold ? 0xfacc15 : getRarityColor(item.rarity || rarity || 'normal');
    const simpleBeamGeo = getCachedAsset(_lootGeoCache, 'simpleBeam', () => new THREE.CylinderGeometry(0.04, 0.14, 0.9, 8));
    const simpleBeamMat = getCachedAsset(_lootMatCache, `simpleBeam:${col}`, () => new THREE.MeshBasicMaterial({
      color: col,
      transparent: true,
      opacity: 0.32,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    }));
    const simpleBeam = new THREE.Mesh(simpleBeamGeo, simpleBeamMat);
    simpleBeam.name = 'LootBeam';
    simpleBeam.userData.keepWithGLB = true;
    simpleBeam.position.y = 0.45;
    group.add(simpleBeam);
  }

  // Silkroad Online 3D Drop Box GLB Loader
  let dropUrl = '/assets/sro/drops/drop_ch_equip.glb';
  if (item.type === 'gold' || isGold) {
    const amt = Number(item.amount || item.gold || 0);
    dropUrl = amt >= 500
      ? '/assets/sro/drops/drop_ch_money_large.glb'
      : amt >= 100
        ? '/assets/sro/drops/drop_ch_money_normal.glb'
        : '/assets/sro/drops/drop_ch_money_small.glb';
    attachGLBModel(group, dropUrl, { targetHeight: 0.32, yOffset: 0.02, hideFallback: true });
  } else {
    const isAlchemyOrPotion = itemType === 'material' || itemType === 'alchemy' || itemType === 'potion' || itemType === 'consumable' || itemId.startsWith('elixir_') || itemId.startsWith('powder_') || itemId.startsWith('potion_') || itemId.startsWith('scroll_');
    const isAcc = itemType === 'necklace' || itemType === 'ring' || itemType === 'accessory' || item.slot === 'necklace' || item.slot === 'ring';
    const isRare = Boolean(item.seal || item.rarity === 'rare' || item.rarity === 'epic' || item.rarity === 'legendary');

    if (item.dropModel) {
      dropUrl = item.dropModel;
    } else if (isAlchemyOrPotion) {
      dropUrl = '/assets/sro/drops/drop_archemy.glb';
    } else if (isAcc) {
      dropUrl = isRare ? '/assets/sro/drops/drop_ch_acc_rare.glb' : '/assets/sro/drops/drop_ch_acc.glb';
    } else {
      dropUrl = isRare ? '/assets/sro/drops/drop_ch_equip_rare.glb' : '/assets/sro/drops/drop_ch_equip.glb';
    }
    attachGLBModel(group, dropUrl, { targetHeight: 0.42, yOffset: 0.02, hideFallback: true });
  }

  group.userData.animate = (time = 0) => {
    const t = typeof time === 'number' ? time : 0;
    coreGroup.rotation.y = t * 2.2;
    coreGroup.position.y = 0.12 + Math.sin(t * 3.5) * 0.05;
    if (group.userData.glbModel) {
      group.userData.glbModel.rotation.y = t * 2.2;
      group.userData.glbModel.position.y = 0.05 + Math.sin(t * 3.5) * 0.05;
    }
    if (orbitGroup) {
      orbitGroup.rotation.y = t * 2.5;
    }
    if (rippleRing) {
      const pulse = 1.0 + Math.sin(t * 3.0) * 0.08;
      rippleRing.scale.set(pulse, pulse, 1);
    }
  };

  return group;
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

/**
 * Create Silkroad Environment / Furniture / Prop Mesh from /assets/sro/props/ or /assets/sro/models/
 */
export function createSroProp(kind = 'table', options = {}) {
  const root = new THREE.Group();
  const k = String(kind || 'table').toLowerCase().replace(/\s+/g, '_');

  const PROP_MODELS = {
    table: '/assets/sro/props/cj_table01.glb',
    table_chair: '/assets/sro/props/cj_table_chair.glb',
    lamp: '/assets/sro/props/cj_lamp01.glb',
    palace_lamp: '/assets/sro/props/cj_pal_lamp.glb',
    stall: '/assets/sro/props/cj_streetstall.glb',
    portal: '/assets/sro/props/cj_portal.glb',
    lion_statue: '/assets/sro/props/cj3_lion01.glb',
    training_dummy: '/assets/sro/props/cj_dummy_01.glb',
    cart: '/assets/sro/props/cj_strawcart.glb',
    basket: '/assets/sro/props/cj_potato_basket.glb',
    // Character / Monster shortcuts:
    bandit: '/assets/sro/models/bandit.glb',
    warrior: '/assets/sro/models/chinaman_warrior.glb',
    chinaman_warrior: '/assets/sro/models/chinaman_warrior.glb',
    villageheadman: '/assets/sro/models/chinaquest_villageheadman.glb',
    village_headman: '/assets/sro/models/chinaquest_villageheadman.glb',
    headman: '/assets/sro/models/chinaquest_villageheadman.glb',
    smith: '/assets/sro/models/chinashop_smith.glb',
    blacksmith: '/assets/sro/models/chinashop_smith.glb',
    mangnyang: '/assets/sro/models/mangnyang.glb',
    stoneghost: '/assets/sro/models/stoneghost.glb',
    tiger: '/assets/sro/models/tiger.glb',
    tigerwoman: '/assets/sro/models/tigerwoman.glb',
    whitetiger: '/assets/sro/models/whitetiger.glb'
  };

  const modelUrl = PROP_MODELS[k] || PROP_MODELS.table;
  root.name = `SroProp_${k}`;

  // Procedural fallback box placeholder for headless Node or before GLB loads
  const fallbackMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.7 });
  const fallbackMesh = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 0.8), fallbackMat);
  fallbackMesh.position.y = 0.4;
  root.add(fallbackMesh);

  attachGLBModel(root, modelUrl, {
    scale: options.scale || 1,
    yOffset: options.yOffset || 0,
    rotationY: options.rotationY || 0,
    hideFallback: true
  });

  return root;
}

/**
 * Create Silkroad Foliage / Nature 3D Billboard Sprite
 */
export function createSroSprite(spriteUrl, { width = 3, height = 3, yOffset = 1.5 } = {}) {
  const root = new THREE.Group();
  root.name = 'SroSprite';

  if (typeof window === 'undefined' || typeof document === 'undefined') {
    const fallback = new THREE.Mesh(
      new THREE.PlaneGeometry(width, height),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    fallback.position.y = yOffset;
    root.add(fallback);
    return root;
  }

  try {
    if (!_sroSpriteLoader) _sroSpriteLoader = new THREE.TextureLoader();
    let map = _sroSpriteTexCache.get(spriteUrl);
    if (!map) {
      map = _sroSpriteLoader.load(spriteUrl);
      map.colorSpace = THREE.SRGBColorSpace;
      _markShared(map);
      _sroSpriteTexCache.set(spriteUrl, map);
    }
    const material = new THREE.SpriteMaterial({ map, transparent: true });
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(width, height, 1);
    sprite.position.y = yOffset;
    root.add(sprite);
  } catch (err) {
    console.warn('[models3d] Failed to create SRO sprite:', spriteUrl, err);
  }

  return root;
}

export class Models3D {
  createHeroMesh(equipment, look, opts) { return createHeroMesh(equipment, look, opts); }
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
  createSroProp(kind, options) { return createSroProp(kind, options); }
  createSroSprite(spriteUrl, options) { return createSroSprite(spriteUrl, options); }
}

export const models3d = new Models3D();
export default models3d;

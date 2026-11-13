// Procedural ancient-tomb / Silk-Road ruin decor for dungeon floors.
// Everything repeated goes through one InstanceBatch (one InstancedMesh per primitive kind). Light-emitting
// props are emissive meshes plus an entry in gen._lightSources; the generator keeps a pool of at most 8
// PointLights that hop between the sources nearest the player (see DungeonGenerator._updateLightBudget).
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

let _gltfLoader = null;
let _texLoader = null;
const _gltfCache = new Map();
const _gltfPromiseCache = new Map();
const _modelBoundsCache = new Map();
const _texCache = new Map();

function markSharedAsset(obj) {
  if (!obj) return obj;
  obj.userData = obj.userData || {};
  obj.userData.isCachedGLB = true;
  obj.userData.isSharedAsset = true;
  return obj;
}

function getGLTFLoader() {
  if (!_gltfLoader && typeof window !== 'undefined') {
    _gltfLoader = new GLTFLoader();
  }
  return _gltfLoader;
}

function getTextureLoader() {
  if (!_texLoader && typeof window !== 'undefined') {
    _texLoader = new THREE.TextureLoader();
  }
  return _texLoader;
}

function cloneModel(source) {
  let hasBones = false;
  source.traverse((child) => {
    if (child.isSkinnedMesh || child.isBone) hasBones = true;
  });
  if (hasBones) {
    try {
      return cloneSkeleton(source);
    } catch {
      return source.clone(true);
    }
  }
  return source.clone(true);
}

/**
 * Loads an authentic Silkroad GLB prop asynchronously in browser with bounding box caching,
 * exact height scaling, auto-grounding (min.y = 0), and optimized shadow performance.
 * Safe in Node: returns an empty THREE.Group synchronously without errors.
 */
export function loadSROProp(url, {
  scale = 1,
  targetHeight = null,
  rotationY = 0,
  position = [0, 0, 0],
  yOffset = 0,
  autoGround = true,
  centerXZ = false,
  castShadow = false,
  receiveShadow = false,
  parent = null,
  onLoad = null
} = {}) {
  const holder = new THREE.Group();
  holder.name = `SRO_${url.split('/').pop().replace('.glb', '')}`;
  holder.position.set(...position);
  holder.rotation.y = rotationY;
  if (parent) parent.add(holder);

  if (typeof window === 'undefined') return holder;

  const loader = getGLTFLoader();
  if (!loader) return holder;

  const applyInstance = (source, bounds) => {
    const clone = cloneModel(source);
    const isPortal = url.includes('cj_portal.glb');
    const isGate = url.includes('cj_jang_gate');
    // For cj_portal.glb, visible above-ground height is ~7.9m (min.y=-7.28 is underground pillar shaft)
    const visibleHeight = isPortal ? 7.9 : (bounds?.size?.y || 1);
    const effScale = (typeof targetHeight === 'number' && targetHeight > 0 && visibleHeight > 0)
      ? (targetHeight / visibleHeight)
      : scale;
    clone.scale.setScalar(effScale);

    if (isPortal) {
      // Bury the underground pillar foundation (-7.28..0) below y=0 so CJ_por_floor sits flush on ground
      clone.position.y = -0.90 * effScale + yOffset;
    } else if (autoGround && bounds) {
      const extraY = (Math.abs(yOffset + 2.27) < 0.05 && Math.abs(bounds.min.y - 2.27) < 0.1) ? 0 : yOffset;
      clone.position.y = -bounds.min.y * effScale + extraY * effScale;
    } else if (yOffset) {
      clone.position.y = yOffset * effScale;
    }

    if ((centerXZ || isPortal || isGate) && bounds?.min && bounds?.max) {
      const cx = (bounds.min.x + bounds.max.x) * 0.5;
      const cz = (bounds.min.z + bounds.max.z) * 0.5;
      clone.position.x = -cx * effScale;
      clone.position.z = -cz * effScale;
    }

    clone.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = Boolean(castShadow);
        child.receiveShadow = Boolean(receiveShadow);
        child.frustumCulled = true;
        if (child.geometry && !child.geometry.boundingSphere) child.geometry.computeBoundingSphere?.();
      }
    });

    holder.add(clone);
    holder.userData.glbModel = clone;
    onLoad?.(clone, holder);
  };

  if (_gltfCache.has(url)) {
    applyInstance(_gltfCache.get(url), _modelBoundsCache.get(url));
    return holder;
  }

  let pending = _gltfPromiseCache.get(url);
  if (!pending) {
    pending = new Promise((resolve, reject) => {
      loader.load(
        url,
        (gltf) => {
          gltf.scene.traverse((child) => {
            if (child.geometry) markSharedAsset(child.geometry);
            const mats = Array.isArray(child.material) ? child.material : child.material ? [child.material] : [];
            for (const m of mats) {
              if (m) markSharedAsset(m);
            }
          });
          const box = new THREE.Box3().setFromObject(gltf.scene);
          const size = new THREE.Vector3();
          box.getSize(size);
          const bounds = { min: box.min.clone(), max: box.max.clone(), size };
          _modelBoundsCache.set(url, bounds);
          _gltfCache.set(url, gltf.scene);
          _gltfPromiseCache.delete(url);
          resolve({ scene: gltf.scene, bounds });
        },
        undefined,
        (err) => {
          _gltfPromiseCache.delete(url);
          reject(err);
        }
      );
    });
    _gltfPromiseCache.set(url, pending);
  }

  pending
    .then(({ scene, bounds }) => applyInstance(scene, bounds))
    .catch((err) => {
      console.warn(`[SRO] Failed to load prop ${url}:`, err);
    });

  return holder;
}

/**
 * Loads an authentic Silkroad billboard or flat water sprite.
 * Safe in Node: returns an empty THREE.Group synchronously without errors.
 */
export function loadSROSprite(url, { width = 1, height = 1, position = [0, 0, 0], parent = null, isFlat = false, opacity = 1.0 } = {}) {
  const holder = new THREE.Group();
  holder.name = `SRO_Sprite_${url.split('/').pop().replace(/\.[^.]+$/, '')}`;
  holder.position.set(...position);
  if (parent) parent.add(holder);

  if (typeof window === 'undefined') return holder;

  const texLoader = getTextureLoader();
  if (!texLoader) return holder;

  let texture = _texCache.get(url);
  if (!texture) {
    texture = texLoader.load(url);
    texture.colorSpace = THREE.SRGBColorSpace;
    _texCache.set(url, texture);
  }

  if (isFlat) {
    const geo = new THREE.PlaneGeometry(width, height);
    const isCutout = opacity >= 0.99;
    const mat = new THREE.MeshStandardMaterial({
      map: texture,
      transparent: !isCutout,
      opacity,
      alphaTest: isCutout ? 0.35 : 0.05,
      depthWrite: isCutout,
      roughness: 0.35,
      metalness: 0.1,
      side: THREE.DoubleSide
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.receiveShadow = true;
    holder.add(mesh);
  } else {
    const mat = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      opacity,
      alphaTest: 0.08
    });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(width, height, 1);
    sprite.position.y = height * 0.5;
    holder.add(sprite);
  }

  return holder;
}

let _cofferGeos = null;
const _cofferMats = new Map();

function getCofferGeos() {
  if (_cofferGeos) return _cofferGeos;

  const bodyWood = new THREE.BoxGeometry(0.82, 0.38, 0.56);
  bodyWood.translate(0, 0.27, 0);

  const trimParts = [];
  const plinth = new THREE.BoxGeometry(0.88, 0.08, 0.62);
  plinth.translate(0, 0.04, 0);
  trimParts.push(plinth);
  for (const sx of [-0.41, 0.41]) {
    for (const sz of [-0.28, 0.28]) {
      const corner = new THREE.BoxGeometry(0.08, 0.4, 0.08);
      corner.translate(sx, 0.27, sz);
      trimParts.push(corner);
    }
  }
  const bandFront = new THREE.BoxGeometry(0.83, 0.06, 0.57);
  bandFront.translate(0, 0.27, 0);
  trimParts.push(bandFront);
  const bodyTrim = mergeGeometries(trimParts, false);
  for (const g of trimParts) g.dispose();

  const innerGlow = new THREE.BoxGeometry(0.72, 0.08, 0.46);
  innerGlow.translate(0, 0.44, 0);

  const lidBase = new THREE.BoxGeometry(0.84, 0.12, 0.58);
  lidBase.translate(0, 0.06, 0.28);
  const archCyl = new THREE.CylinderGeometry(0.28, 0.28, 0.84, 16, 1, false, 0, Math.PI);
  archCyl.rotateZ(Math.PI / 2);
  archCyl.translate(0, 0.12, 0.28);
  const lidWood = mergeGeometries([lidBase, archCyl], false);
  lidBase.dispose();
  archCyl.dispose();

  const lidTrimParts = [];
  for (const lx of [-0.3, 0, 0.3]) {
    const archTrim = new THREE.CylinderGeometry(0.285, 0.285, 0.05, 16, 1, false, 0, Math.PI);
    archTrim.rotateZ(Math.PI / 2);
    archTrim.translate(lx, 0.12, 0.28);
    lidTrimParts.push(archTrim);
  }
  const lockHasp = new THREE.BoxGeometry(0.14, 0.18, 0.06);
  lockHasp.translate(0, 0.02, 0.57);
  lidTrimParts.push(lockHasp);
  const lidTrim = mergeGeometries(lidTrimParts, false);
  for (const g of lidTrimParts) g.dispose();

  const lockJewel = new THREE.OctahedronGeometry(0.06, 0);
  lockJewel.translate(0, 0.02, 0.60);

  _cofferGeos = {
    bodyWood: markSharedAsset(bodyWood),
    bodyTrim: markSharedAsset(bodyTrim),
    innerGlow: markSharedAsset(innerGlow),
    lidWood: markSharedAsset(lidWood),
    lidTrim: markSharedAsset(lidTrim),
    lockJewel: markSharedAsset(lockJewel)
  };
  return _cofferGeos;
}

function getCofferMats(tierStr) {
  const isBoss = tierStr.includes('boss');
  const isRare = tierStr.includes('rare') || tierStr.includes('epic') || isBoss;
  const isUnique = tierStr.includes('unique') || tierStr.includes('legend');
  const key = isBoss ? 'boss' : isUnique ? 'unique' : isRare ? 'rare' : 'normal';
  let cached = _cofferMats.get(key);
  if (cached) return cached;

  const woodColor = isBoss || isUnique ? 0x221310 : isRare ? 0x6e1b12 : 0x422213;
  const trimColor = isBoss || isUnique ? 0xfacc15 : isRare ? 0xd4a437 : 0x8a7455;
  const gemColor = isBoss ? 0xef4444 : isUnique ? 0xa855f7 : isRare ? 0x10b981 : 0x38bdf8;

  cached = {
    woodMat: markSharedAsset(new THREE.MeshStandardMaterial({
      color: woodColor,
      roughness: 0.42,
      metalness: 0.25
    })),
    trimMat: markSharedAsset(new THREE.MeshStandardMaterial({
      color: trimColor,
      roughness: 0.28,
      metalness: 0.85
    })),
    gemMat: markSharedAsset(new THREE.MeshStandardMaterial({
      color: gemColor,
      emissive: new THREE.Color(gemColor),
      emissiveIntensity: 0.9,
      roughness: 0.15,
      metalness: 0.3
    })),
    innerGlowMat: markSharedAsset(new THREE.MeshBasicMaterial({
      color: isBoss ? 0xfef08a : isRare ? 0xfde047 : 0x7dd3fc,
      transparent: true,
      opacity: 0.95
    }))
  };
  _cofferMats.set(key, cached);
  return cached;
}

/**
 * Ornate Silkroad coffer styling for treasure chests
 */
export function createSilkroadCofferMesh(tier = 'normal', isOpen = false) {
  const root = new THREE.Group();
  root.name = `SilkroadCoffer_${tier}`;

  const geos = getCofferGeos();
  const { woodMat, trimMat, gemMat, innerGlowMat } = getCofferMats(String(tier || 'normal').toLowerCase());

  root.add(new THREE.Mesh(geos.bodyWood, woodMat));
  root.add(new THREE.Mesh(geos.bodyTrim, trimMat));

  // Inner treasure chamber glow
  const innerGlow = new THREE.Mesh(geos.innerGlow, innerGlowMat);
  innerGlow.visible = Boolean(isOpen);
  root.add(innerGlow);

  // Hinged arched coffer lid
  const lidPivot = new THREE.Group();
  lidPivot.position.set(0, 0.46, -0.28);
  root.add(lidPivot);

  lidPivot.add(new THREE.Mesh(geos.lidWood, woodMat));
  lidPivot.add(new THREE.Mesh(geos.lidTrim, trimMat));
  lidPivot.add(new THREE.Mesh(geos.lockJewel, gemMat));

  root.userData.isOpen = Boolean(isOpen);
  root.userData.lid = lidPivot;
  lidPivot.rotation.x = root.userData.isOpen ? -1.25 : 0;

  root.userData.setOpen = (open = true) => {
    root.userData.isOpen = Boolean(open);
    lidPivot.rotation.x = root.userData.isOpen ? -1.25 : 0;
    innerGlow.visible = root.userData.isOpen;
  };

  root.userData.animate = (time = 0) => {
    if (root.userData.isOpen && innerGlow.visible) {
      innerGlow.material.opacity = 0.8 + Math.sin(time * 5.0) * 0.2;
    }
  };

  return root;
}

// ---------------------------------------------------------------------------------------------
// Shared geometry / material kinds
// ---------------------------------------------------------------------------------------------
const geoCache = new Map();
const matCache = new Map();

const KIND_DEFS = {
  box: { g: () => new THREE.BoxGeometry(1, 1, 1), m: { r: 0.82, mt: 0.04 } },
  cyl: { g: () => new THREE.CylinderGeometry(0.5, 0.5, 1, 10), m: { r: 0.8, mt: 0.04 } },
  cone: { g: () => new THREE.ConeGeometry(0.5, 1, 8), m: { r: 0.8, mt: 0.04 } },
  sphere: { g: () => new THREE.SphereGeometry(0.5, 8, 6), m: { r: 0.8, mt: 0.04 } },
  rock: { g: () => new THREE.DodecahedronGeometry(0.5, 0), m: { r: 0.95, mt: 0, flat: true } },
  torus: { g: () => new THREE.TorusGeometry(0.5, 0.07, 6, 14), m: { r: 0.5, mt: 0.5 } },
  mbox: { g: () => new THREE.BoxGeometry(1, 1, 1), m: { r: 0.4, mt: 0.55 } },
  mcyl: { g: () => new THREE.CylinderGeometry(0.5, 0.5, 1, 12), m: { r: 0.35, mt: 0.6 } },
  glowBox: { g: () => new THREE.BoxGeometry(1, 1, 1), basic: true },
  glowCyl: { g: () => new THREE.CylinderGeometry(0.5, 0.5, 1, 14), basic: true },
  glowCone: { g: () => new THREE.ConeGeometry(0.5, 1, 7), basic: true },
  glowTorus: { g: () => new THREE.TorusGeometry(0.5, 0.07, 4, 28), basic: true },
  // quicksilver: metallic + emissive so it reads as a liquid mirror in the dark
  pool: {
    g: () => new THREE.CylinderGeometry(0.5, 0.5, 1, 18),
    m: { r: 0.12, mt: 0.9, emissive: 0x7480a0, ei: 0.7 }
  }
};

function kindGeometry(kind) {
  let g = geoCache.get(kind);
  if (!g) { g = markSharedAsset(KIND_DEFS[kind].g()); geoCache.set(kind, g); }
  return g;
}

function kindMaterial(kind) {
  let m = matCache.get(kind);
  if (m) return m;
  const d = KIND_DEFS[kind];
  if (d.basic) {
    m = new THREE.MeshBasicMaterial({ color: 0xffffff });
  } else {
    m = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: d.m.r,
      metalness: d.m.mt,
      flatShading: Boolean(d.m.flat),
      emissive: new THREE.Color(d.m.emissive || 0x000000),
      emissiveIntensity: d.m.ei || 0
    });
  }
  markSharedAsset(m);
  matCache.set(kind, m);
  return m;
}

export class InstanceBatch {
  constructor() {
    this.items = new Map();
    this.total = 0;
  }

  /** y is the CENTER of the unit-sized primitive after scaling. rx/rz are extra tilt. */
  add(kind, x, y, z, sx = 1, sy = 1, sz = 1, ry = 0, color = 0xffffff, rx = 0, rz = 0) {
    let list = this.items.get(kind);
    if (!list) { list = []; this.items.set(kind, list); }
    list.push([x, y, z, sx, sy, sz, ry, color, rx, rz]);
    this.total++;
  }

  /** Builds one InstancedMesh per kind into `group`; returns the number of meshes created. */
  flush(group) {
    const dummy = new THREE.Object3D();
    const col = new THREE.Color();
    let meshes = 0;
    for (const [kind, list] of this.items) {
      if (!list.length) continue;
      const mesh = new THREE.InstancedMesh(kindGeometry(kind), kindMaterial(kind), list.length);
      mesh.name = `Decor_${kind}`;
      mesh.receiveShadow = true;
      list.forEach((r, i) => {
        dummy.position.set(r[0], r[1], r[2]);
        dummy.rotation.set(r[8], r[6], r[9]);
        dummy.scale.set(r[3], r[4], r[5]);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
        col.setHex(r[7]);
        mesh.setColorAt(i, col);
      });
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      group.add(mesh);
      meshes++;
    }
    this.items.clear();
    return meshes;
  }
}

// ---------------------------------------------------------------------------------------------
// Palettes (keyed by theme.decor)
// ---------------------------------------------------------------------------------------------
export const DECOR_STYLES = {
  cave: { stone: 0x8a7a63, dark: 0x4a4034, timber: 0x6b4a2b, ore: 0xffb347, ore2: 0x62d0ff, rubble: 0x77695a, flame: 0xffaa44 },
  crypt: { stone: 0x7b879f, dark: 0x2c3140, bone: 0xe4dcc4, wax: 0xf2ead2, rubble: 0x68728a, flame: 0x8be9ff },
  ruins: { stone: 0x7e9a8c, dark: 0x35473f, vine: 0x3f8a46, vine2: 0x5fae5a, rubble: 0x6c8579, flame: 0x7ef0c0 },
  lava: { stone: 0x7d5248, dark: 0x2b1714, iron: 0x3a3a42, magma: 0xff6a1f, rubble: 0x6b4339, flame: 0xff7a2e },
  abyss: { stone: 0x6f6b88, dark: 0x25233a, clay: 0xb5653a, bronze: 0xb08d57, jade: 0x3fbf8a, jadeGlow: 0x7dffc4, rubble: 0x5f5b78, flame: 0x7dffc4 }
};

export function styleFor(theme) {
  return DECOR_STYLES[theme?.decor] || DECOR_STYLES.cave;
}

export function tint(hex, f) {
  const c = (v) => Math.max(0, Math.min(255, Math.round(v * f)));
  return (c((hex >> 16) & 255) << 16) | (c((hex >> 8) & 255) << 8) | c(hex & 255);
}

function jit(hex, rand, amt = 0.14) {
  return tint(hex, 1 - amt * 0.5 + rand() * amt);
}

// ---------------------------------------------------------------------------------------------
// Context helpers
// ---------------------------------------------------------------------------------------------
function addLight(gen, x, y, z, color, intensity = 1.6, distance = 12) {
  gen._lightSources.push({ x, y, z, color, intensity, distance });
}

/** True when any corridor, door tile, or gate mouth sits within `pad` tiles of (x, z): keeps props strictly out of doorways/exits. */
export function nearOpening(gen, x, z, pad = 4) {
  const { gx, gz } = gen.worldToGrid(x, z);
  const p = Math.max(1, Math.ceil(pad));
  for (let dz = -p; dz <= p; dz++) {
    for (let dx = -p; dx <= p; dx++) {
      const tile = gen.getTileAtGrid(gx + dx, gz + dz);
      if (tile === 3 || tile === 4) return true;
    }
  }
  for (const g of (gen.gates || [])) {
    const gateClear = pad >= 1.5
      ? (g.isBossGate ? Math.max(4.2, pad) : Math.max(1.8, pad * 0.9))
      : pad;
    if (Math.hypot(x - g.x, z - g.z) < gateClear) return true;
  }
  return false;
}

/** Reserved circles (vault alcove, puzzle props) that decor must keep clear. */
export function inReserved(gen, x, z, pad = 0) {
  const list = gen._reserved || [];
  for (let i = 0; i < list.length; i++) {
    if (Math.hypot(x - list[i].x, z - list[i].z) < list[i].r + pad) return true;
  }
  return false;
}

/** True when a decor piece of `radius` would collide with doorways, reserved pads, shrines, portals, chests, traps, or placed decor. */
export function blocked(gen, x, z, pad = 3, radius = 0.5) {
  if (nearOpening(gen, x, z, pad)) return true;
  if (inReserved(gen, x, z, radius)) return true;
  const minClear = (r) => (r || 0.5) + radius + 0.15;
  for (const o of (gen.solidObstacles || [])) {
    if (Math.hypot(x - o.x, z - o.z) < minClear(o.radius)) return true;
  }
  for (const d of (gen._placedDecor || [])) {
    if (Math.hypot(x - d.x, z - d.z) < (d.r || 0.5) + radius + 0.15) return true;
  }
  for (const t of (gen.traps || [])) {
    if (Math.hypot(x - t.x, z - t.z) < minClear(t.radius) + 0.25) return true;
  }
  for (const g of (gen.gates || [])) {
    if (Math.hypot(x - g.x, z - g.z) < Math.max(4.2, minClear(g.radius || 1.15) + 1.4)) return true;
  }
  for (const c of (gen.chests || [])) {
    if (Math.hypot(x - c.x, z - c.z) < 0.85 + radius) return true;
  }
  for (const s of (gen.shrines || [])) {
    if (Math.hypot(x - s.x, z - s.z) < (s.radius || 1.2) + radius) return true;
  }
  for (const p of (gen.portals || [])) {
    if (Math.hypot(x - p.x, z - p.z) < 2.6 + radius) return true;
  }
  return false;
}

/** Candidate spots hugging the room perimeter walls (side = which wall they sit against). */
function wallSpots(gen, room, inset = 0.55, step = 2.6, skip = 3.8) {
  const out = [];
  const x0 = room.x; const x1 = room.x + room.w; const z0 = room.z; const z1 = room.z + room.h;
  for (let x = x0 + skip; x <= x1 - skip + 0.01; x += step) {
    out.push({ x, z: z0 + inset, ry: 0, side: 'N' });
    out.push({ x, z: z1 - inset, ry: Math.PI, side: 'S' });
  }
  for (let z = z0 + skip; z <= z1 - skip + 0.01; z += step) {
    out.push({ x: x0 + inset, z, ry: Math.PI / 2, side: 'W' });
    out.push({ x: x1 - inset, z, ry: -Math.PI / 2, side: 'E' });
  }
  return out.filter((s) => !blocked(gen, s.x, s.z, 3.4, 0.5));
}

function registerDecor(gen, x, z, radius = 0.5, tag = 'decor', addSolid = true) {
  if (!Array.isArray(gen._placedDecor)) gen._placedDecor = [];
  gen._placedDecor.push({ x, z, r: radius, tag });
  if (addSolid && Array.isArray(gen.solidObstacles)) {
    gen.solidObstacles.push({ x, z, radius });
  }
}

function solid(gen, x, z, radius, tag = 'decor') {
  registerDecor(gen, x, z, radius, tag, true);
}

/** How cluttered with corridor mouths a corner region is (lower is a better place for props). */
export function cornerScore(gen, room, sx, sz, depth = 4) {
  let n = 0;
  const gx0 = sx < 0 ? room.gx - 1 : room.gx + room.gw - depth;
  const gz0 = sz < 0 ? room.gz - 1 : room.gz + room.gh - depth;
  for (let gz = gz0; gz < gz0 + depth + 1; gz++) {
    for (let gx = gx0; gx < gx0 + depth + 1; gx++) {
      if (gen.getTileAtGrid(gx, gz) === 3) n++;
    }
  }
  return n;
}

export function bestCorner(gen, room, depth = 4, avoid = null) {
  const corners = [{ sx: 1, sz: 1 }, { sx: -1, sz: 1 }, { sx: 1, sz: -1 }, { sx: -1, sz: -1 }];
  let best = null; let bs = Infinity;
  for (const c of corners) {
    if (avoid && avoid.sx === c.sx && avoid.sz === c.sz) continue;
    const s = cornerScore(gen, room, c.sx, c.sz, depth);
    if (s < bs) { bs = s; best = c; }
  }
  return best;
}

// ---------------------------------------------------------------------------------------------
// Props shared by every theme
// ---------------------------------------------------------------------------------------------
export function addWallPillars(b, gen, wallTiles, style, rand) {
  const T = gen.tileSize;
  const dirs = [[0, -1], [0, 1], [-1, 0], [1, 0]];
  const bannerPalette = [0x6b2737, 0x254b4d, 0x5c4728, 0x333c5c];
  const trimCol = tint(style.bronze || style.iron || style.stone, 0.85);
  const softFlame = tint(style.flame || 0xffaa44, 0.72);
  let bannerIdx = 0;

  for (const w of wallTiles) {
    const openDirs = [];
    for (const d of dirs) {
      const t = gen.getTileAtGrid(w.gx + d[0], w.gz + d[1]);
      if (t === 1 || t === 3 || t === 4 || t === 5) openDirs.push(d);
    }
    const n = openDirs.length;
    const isFlatWall = n === 1;
    const isInnerCorner = n === 2 && (openDirs[0][0] + openDirs[1][0] !== 0) && (openDirs[0][1] + openDirs[1][1] !== 0);
    if (!isFlatWall && !isInnerCorner) continue;
    const p = gen.gridToWorld(w.gx, w.gz);

    if (isInnerCorner) {
      const sx = openDirs[0][0] + openDirs[1][0];
      const sz = openDirs[0][1] + openDirs[1][1];
      const px = p.x + sx * (T * 0.5 + 0.04);
      const pz = p.z + sz * (T * 0.5 + 0.04);
      if (nearOpening(gen, px, pz, 2.8) || blocked(gen, px, pz, 2.8, 0.22)) continue;
      const h = 2.95;
      b.add('box', px, h * 0.5, pz, 0.34, h, 0.34, 0, jit(style.stone, rand, 0.12));
      b.add('box', px, 0.14, pz, 0.44, 0.28, 0.44, 0, tint(style.stone, 0.78));
      b.add('box', px, h - 0.12, pz, 0.46, 0.22, 0.46, 0, trimCol);
      registerDecor(gen, px, pz, 0.18, 'wall_pilaster', false);
      continue;
    }

    const open = openDirs[0];
    const faceX = p.x + open[0] * (T * 0.5 + 0.05);
    const faceZ = p.z + open[1] * (T * 0.5 + 0.05);
    const horiz = open[1] !== 0; // N/S wall runs along X; W/E wall runs along Z

    // Skip flat walls right next to doorways / corridor mouths
    if (nearOpening(gen, faceX, faceZ, 2.8)) continue;

    // 1. Flush engaged stone pilaster + base/capital trim (hugged tight against wall, zero floor obstruction)
    if ((w.gx * 3 + w.gz * 5) % 4 === 0) {
      const px = p.x + open[0] * (T * 0.5 + 0.08);
      const pz = p.z + open[1] * (T * 0.5 + 0.08);
      if (blocked(gen, px, pz, 2.8, 0.2)) continue;
      const h = 2.85;
      b.add('box', px, h * 0.5, pz, horiz ? 0.42 : 0.18, h, horiz ? 0.18 : 0.42, 0, jit(style.stone, rand, 0.14));
      b.add('box', px, 0.14, pz, horiz ? 0.54 : 0.24, 0.28, horiz ? 0.24 : 0.54, 0, tint(style.stone, 0.78));
      b.add('box', px, h - 0.12, pz, horiz ? 0.56 : 0.26, 0.22, horiz ? 0.26 : 0.56, 0, trimCol);
      registerDecor(gen, px, pz, 0.18, 'wall_pilaster', false);
      continue;
    }

    // 2. Wall-mounted bronze torch sconce up high on wall (y = 2.05, calm soft warm light, zero glare)
    if ((w.gx * 5 + w.gz * 3) % 6 === 0) {
      const sx = p.x + open[0] * (T * 0.5 + 0.14);
      const sz = p.z + open[1] * (T * 0.5 + 0.14);
      b.add('mbox', p.x + open[0] * (T * 0.5 + 0.07), 1.92, p.z + open[1] * (T * 0.5 + 0.07), horiz ? 0.16 : 0.22, 0.12, horiz ? 0.22 : 0.16, 0, tint(style.dark, 0.9));
      b.add('mcyl', sx, 2.04, sz, 0.18, 0.24, 0.18, 0, trimCol);
      b.add('glowCone', sx, 2.26, sz, 0.16, 0.26, 0.16, 0, softFlame);
      addLight(gen, sx + open[0] * 0.25, 2.25, sz + open[1] * 0.25, softFlame, 1.15, 11);
      continue;
    }

    // 3. Hanging muted Silkroad wall tapestry / carved wall relief plaque (y = 1.6..2.55m)
    if ((w.gx + w.gz) % 3 === 1) {
      const col = bannerPalette[bannerIdx++ % bannerPalette.length];
      b.add('mbox', faceX, 2.52, faceZ, horiz ? 0.92 : 0.08, 0.07, horiz ? 0.08 : 0.92, 0, trimCol);
      b.add('box', faceX, 1.98, faceZ, horiz ? 0.72 : 0.04, 1.0, horiz ? 0.04 : 0.72, 0, jit(col, rand, 0.12));
      b.add('box', faceX, 1.46, faceZ, horiz ? 0.44 : 0.05, 0.12, horiz ? 0.05 : 0.44, 0, trimCol);
    } else if ((w.gx + w.gz) % 3 === 2) {
      // Carved stone frieze panel upper wall
      b.add('box', faceX, 2.38, faceZ, horiz ? 0.85 : 0.08, 0.34, horiz ? 0.08 : 0.85, 0, tint(style.stone, 0.86));
      b.add('box', faceX, 2.38, faceZ, horiz ? 0.56 : 0.1, 0.14, horiz ? 0.1 : 0.56, 0, trimCol);
    }
  }
}

/** Arched doorways where a corridor meets a room wall (jambs tucked strictly outside corridor mouth). */
export function addDoorArches(b, gen, style) {
  const T = gen.tileSize;
  for (const room of gen.rooms) {
    const sides = [
      { fixed: room.gz - 1, along: 'x', from: room.gx, count: room.gw, dir: [0, -1] },
      { fixed: room.gz + room.gh, along: 'x', from: room.gx, count: room.gw, dir: [0, 1] },
      { fixed: room.gx - 1, along: 'z', from: room.gz, count: room.gh, dir: [-1, 0] },
      { fixed: room.gx + room.gw, along: 'z', from: room.gz, count: room.gh, dir: [1, 0] }
    ];
    for (const s of sides) {
      const horiz = s.along === 'x';
      let run = [];
      const flushRun = () => {
        if (run.length < 2) { run = []; return; }
        const a = horiz ? gen.gridToWorld(run[0], s.fixed) : gen.gridToWorld(s.fixed, run[0]);
        const c = horiz ? gen.gridToWorld(run[run.length - 1], s.fixed) : gen.gridToWorld(s.fixed, run[run.length - 1]);
        const mx = (a.x + c.x) * 0.5 - s.dir[0] * T * 0.5;
        const mz = (a.z + c.z) * 0.5 - s.dir[1] * T * 0.5;
        const span = run.length * T;
        // Offset jamb pillars outward into flanking walls so full corridor width stays wide open
        const ox = horiz ? span * 0.5 + 0.38 : 0;
        const oz = horiz ? 0 : span * 0.5 + 0.38;
        const stone = tint(style.stone, 0.92);
        b.add('box', mx - ox, 1.5, mz - oz, 0.54, 3.0, 0.54, 0, stone);
        b.add('box', mx + ox, 1.5, mz + oz, 0.54, 3.0, 0.54, 0, stone);
        b.add('box', mx, 3.06, mz, horiz ? span + 1.15 : 0.65, 0.38, horiz ? 0.65 : span + 1.15, 0, tint(style.stone, 1.0));
        run = [];
      };
      for (let i = 0; i < s.count; i++) {
        const gx = horiz ? s.from + i : s.fixed;
        const gz = horiz ? s.fixed : s.from + i;
        if (gen.getTileAtGrid(gx, gz) === 3) run.push(horiz ? gx : gz);
        else flushRun();
      }
      flushRun();
    }
  }
}

export function addRubble(b, gen, rand, style) {
  // Subtle perimeter-edge dust pebbles tucked tight against walls (never on combat floor center or near openings)
  for (const room of gen.rooms) {
    if (rand() < 0.65) continue;
    const cornerX = rand() < 0.5 ? room.x + 0.55 : room.x + room.w - 0.55;
    const cornerZ = rand() < 0.5 ? room.z + 0.55 : room.z + room.h - 0.55;
    if (blocked(gen, cornerX, cornerZ, 3.5, 0.35)) continue;
    const s = 0.14 + rand() * 0.08;
    b.add('rock', cornerX, s * 0.38, cornerZ, s * 1.1, s, s * 0.9, rand() * 6.28, jit(style.rubble, rand, 0.15), rand() * 0.2, rand() * 0.2);
  }
}

/** Authentic Silkroad GLB props placed neatly along room perimeters and corners */
const DUN_PROP = (file, opts = {}) => ({
  url: `/assets/sro/dun/props/${file}`,
  centerXZ: true,
  autoGround: true,
  ...opts
});

const SRO_PROP = (path, opts = {}) => ({
  url: `/assets/sro/${path}`,
  centerXZ: false,
  autoGround: true,
  ...opts
});

export const SRO_DUNGEON_PROPS = {
  // Base aliases
  donhwang: {
    corners: [
      DUN_PROP('donhwang_stone.glb', { targetHeight: 2.2, radius: 0.85 }),
      DUN_PROP('donhwang_cobweb.glb', { targetHeight: 2.35, radius: 0.4 }),
      DUN_PROP('dh_lamp.glb', { targetHeight: 2.15, radius: 0.5 })
    ],
    wall: DUN_PROP('donhwang_mushroom_rock.glb', { targetHeight: 2.3, radius: 1.25 }),
    shrineCenter: DUN_PROP('dh_temple_stone.glb', { targetHeight: 2.55, radius: 0.9 }),
    shrineGuard: DUN_PROP('dh_lamp.glb', { targetHeight: 2.2, radius: 0.5 }),
    bossGate: DUN_PROP('cave_arch.glb', { targetHeight: 4.2 }),
    bossFlankLeft: DUN_PROP('dh_temple_stone.glb', { targetHeight: 2.85, radius: 0.9 }),
    bossFlankRight: DUN_PROP('donhwang_mushroom_rock.glb', { targetHeight: 2.7, radius: 1.15 }),
    bossSanctumNorth: DUN_PROP('jinsi_lantern.glb', { targetHeight: 2.6, radius: 0.45 })
  },
  donhwang_b1: {
    corners: [
      DUN_PROP('donhwang_mushroom_rock.glb', { targetHeight: 2.2, radius: 1.15 }),
      DUN_PROP('dh_lamp.glb', { targetHeight: 2.1, radius: 0.5 }),
      DUN_PROP('donhwang_cobweb.glb', { targetHeight: 2.35, radius: 0.4 })
    ],
    wall: DUN_PROP('donhwang_stone.glb', { targetHeight: 2.3, radius: 0.85 }),
    shrineCenter: DUN_PROP('donhwang_stone.glb', { targetHeight: 2.5, radius: 0.85 }),
    shrineGuard: DUN_PROP('dh_lamp.glb', { targetHeight: 2.15, radius: 0.5 }),
    bossGate: DUN_PROP('cave_arch.glb', { targetHeight: 4.2 }),
    bossFlankLeft: DUN_PROP('donhwang_mushroom_rock.glb', { targetHeight: 2.6, radius: 1.1 }),
    bossFlankRight: DUN_PROP('donhwang_mushroom_rock.glb', { targetHeight: 2.6, radius: 1.1 }),
    bossSanctumNorth: DUN_PROP('dh_lamp.glb', { targetHeight: 2.4, radius: 0.5 })
  },
  donhwang_b2: {
    corners: [
      DUN_PROP('dh_temple_stone.glb', { targetHeight: 2.4, radius: 0.9 }),
      DUN_PROP('dh_lamp.glb', { targetHeight: 2.15, radius: 0.5 }),
      DUN_PROP('jinsi_lantern.glb', { targetHeight: 2.05, radius: 0.45 })
    ],
    wall: DUN_PROP('dh_temple_stone.glb', { targetHeight: 2.65, radius: 0.95 }),
    shrineCenter: DUN_PROP('dh_temple_stone.glb', { targetHeight: 2.75, radius: 0.95 }),
    shrineGuard: DUN_PROP('jinsi_lantern.glb', { targetHeight: 2.2, radius: 0.5 }),
    bossGate: DUN_PROP('cave_arch.glb', { targetHeight: 4.2 }),
    bossFlankLeft: DUN_PROP('dh_temple_stone.glb', { targetHeight: 2.9, radius: 0.95 }),
    bossFlankRight: DUN_PROP('donhwang_stone.glb', { targetHeight: 2.8, radius: 0.85 }),
    bossSanctumNorth: DUN_PROP('jinsi_lantern.glb', { targetHeight: 2.6, radius: 0.45 })
  },
  donhwang_b3: {
    corners: [
      DUN_PROP('dh_rock_big.glb', { targetHeight: 2.55, radius: 1.15 }),
      DUN_PROP('dh_temple_stone.glb', { targetHeight: 2.45, radius: 0.9 }),
      DUN_PROP('jinsi_flame_bowl.glb', { targetHeight: 1.5, radius: 0.75 }),
      DUN_PROP('donhwang_cobweb.glb', { targetHeight: 2.4, radius: 0.4 })
    ],
    wall: DUN_PROP('dh_rock_big.glb', { targetHeight: 2.8, radius: 1.25 }),
    shrineCenter: DUN_PROP('dh_temple_stone.glb', { targetHeight: 2.7, radius: 0.9 }),
    shrineGuard: DUN_PROP('jinsi_flame_bowl.glb', { targetHeight: 1.65, radius: 0.75 }),
    bossGate: DUN_PROP('cave_arch.glb', { targetHeight: 4.35 }),
    bossFlankLeft: DUN_PROP('dh_temple_stone.glb', { targetHeight: 3.1, radius: 0.95 }),
    bossFlankRight: DUN_PROP('dh_rock_big.glb', { targetHeight: 3.0, radius: 1.2 }),
    bossSanctumNorth: DUN_PROP('jinsi_flame_bowl.glb', { targetHeight: 2.0, radius: 0.75 })
  },
  karakoram: {
    corners: [
      DUN_PROP('karakoram_saltrock.glb', { targetHeight: 2.75, radius: 0.85 }),
      DUN_PROP('desert_brazier.glb', { targetHeight: 1.9, radius: 0.7 }),
      DUN_PROP('jinsi_flame_bowl.glb', { targetHeight: 1.4, radius: 0.75 })
    ],
    wall: DUN_PROP('karakoram_saltrock.glb', { targetHeight: 3.1, radius: 0.95 }),
    shrineCenter: DUN_PROP('karakoram_saltrock.glb', { targetHeight: 3.1, radius: 0.9 }),
    shrineGuard: DUN_PROP('desert_brazier.glb', { targetHeight: 2.0, radius: 0.7 }),
    bossGate: DUN_PROP('cave_arch.glb', { targetHeight: 4.4 }),
    bossFlankLeft: DUN_PROP('karakoram_saltrock.glb', { targetHeight: 3.4, radius: 0.9 }),
    bossFlankRight: DUN_PROP('karakoram_saltrock.glb', { targetHeight: 3.4, radius: 0.9 }),
    bossSanctumNorth: DUN_PROP('desert_brazier.glb', { targetHeight: 2.2, radius: 0.75 })
  },
  karakoram_b4: {
    corners: [
      DUN_PROP('desert_brazier.glb', { targetHeight: 1.95, radius: 0.75 }),
      DUN_PROP('dh_rock_big.glb', { targetHeight: 2.4, radius: 1.1 }),
      DUN_PROP('jinsi_lantern.glb', { targetHeight: 2.1, radius: 0.5 })
    ],
    wall: DUN_PROP('desert_brazier.glb', { targetHeight: 2.15, radius: 0.8 }),
    shrineCenter: DUN_PROP('palace_well.glb', { targetHeight: 2.1, radius: 1.1 }),
    shrineGuard: DUN_PROP('desert_brazier.glb', { targetHeight: 2.0, radius: 0.75 }),
    bossGate: DUN_PROP('cave_arch.glb', { targetHeight: 4.35 }),
    bossFlankLeft: DUN_PROP('desert_brazier.glb', { targetHeight: 2.4, radius: 0.8 }),
    bossFlankRight: DUN_PROP('desert_brazier.glb', { targetHeight: 2.4, radius: 0.8 }),
    bossSanctumNorth: DUN_PROP('jinsi_flame_bowl.glb', { targetHeight: 2.0, radius: 0.75 })
  },
  karakoram_b5: {
    corners: [
      DUN_PROP('karakoram_saltrock.glb', { targetHeight: 2.8, radius: 0.9 }),
      DUN_PROP('palace_well.glb', { targetHeight: 2.0, radius: 1.05 }),
      DUN_PROP('donhwang_cobweb.glb', { targetHeight: 2.35, radius: 0.4 })
    ],
    wall: DUN_PROP('karakoram_saltrock.glb', { targetHeight: 3.15, radius: 0.95 }),
    shrineCenter: DUN_PROP('palace_well.glb', { targetHeight: 2.25, radius: 1.1 }),
    shrineGuard: DUN_PROP('karakoram_saltrock.glb', { targetHeight: 2.9, radius: 0.9 }),
    bossGate: DUN_PROP('cave_arch.glb', { targetHeight: 4.4 }),
    bossFlankLeft: DUN_PROP('karakoram_saltrock.glb', { targetHeight: 3.4, radius: 0.95 }),
    bossFlankRight: DUN_PROP('karakoram_saltrock.glb', { targetHeight: 3.4, radius: 0.95 }),
    bossSanctumNorth: DUN_PROP('palace_well.glb', { targetHeight: 2.4, radius: 1.1 })
  },
  karakoram_b6: {
    corners: [
      DUN_PROP('garden_lion.glb', { targetHeight: 2.15, radius: 0.85 }),
      DUN_PROP('desert_brazier.glb', { targetHeight: 2.05, radius: 0.75 }),
      DUN_PROP('karakoram_saltrock.glb', { targetHeight: 2.85, radius: 0.9 })
    ],
    wall: DUN_PROP('karakoram_saltrock.glb', { targetHeight: 3.25, radius: 0.95 }),
    shrineCenter: DUN_PROP('garden_lion.glb', { targetHeight: 2.4, radius: 0.9 }),
    shrineGuard: DUN_PROP('desert_brazier.glb', { targetHeight: 2.15, radius: 0.75 }),
    bossGate: DUN_PROP('cave_arch.glb', { targetHeight: 4.5 }),
    bossFlankLeft: DUN_PROP('garden_lion.glb', { targetHeight: 2.6, radius: 0.9 }),
    bossFlankRight: DUN_PROP('garden_lion.glb', { targetHeight: 2.6, radius: 0.9 }),
    bossSanctumNorth: DUN_PROP('desert_brazier.glb', { targetHeight: 2.3, radius: 0.75 })
  },
  qinshi: {
    corners: [
      DUN_PROP('jinsi_warrior.glb', { targetHeight: 2.45, radius: 0.8 }),
      DUN_PROP('jinsi_maiden.glb', { targetHeight: 2.4, radius: 0.8 }),
      DUN_PROP('jinsi_lantern_tall.glb', { targetHeight: 2.45, radius: 0.48 }),
      DUN_PROP('jinsi_flame_bowl.glb', { targetHeight: 1.4, radius: 0.75 })
    ],
    wall: DUN_PROP('jinsi_flame_l.glb', { targetHeight: 2.5, radius: 0.7 }),
    shrineCenter: DUN_PROP('jinsi_jewel.glb', { targetHeight: 2.8, radius: 0.7 }),
    shrineGuard: DUN_PROP('jinsi_warrior.glb', { targetHeight: 2.6, radius: 0.8 }),
    bossGate: SRO_PROP('env/cj_jang_gate.glb', { centerXZ: true }),
    bossFlankLeft: DUN_PROP('jinsi_warrior.glb', { targetHeight: 3.2, radius: 0.85 }),
    bossFlankRight: DUN_PROP('jinsi_maiden.glb', { targetHeight: 3.15, radius: 0.85 }),
    bossSanctumNorth: DUN_PROP('jinsi_jewel.glb', { targetHeight: 3.1, radius: 0.7 })
  },
  qinshi_b7: {
    corners: [
      DUN_PROP('jinsi_warrior.glb', { targetHeight: 2.45, radius: 0.8 }),
      DUN_PROP('jinsi_lantern_tall.glb', { targetHeight: 2.4, radius: 0.48 }),
      DUN_PROP('jinsi_lantern.glb', { targetHeight: 2.15, radius: 0.45 }),
      DUN_PROP('jinsi_flame_bowl.glb', { targetHeight: 1.45, radius: 0.75 })
    ],
    wall: DUN_PROP('jinsi_warrior.glb', { targetHeight: 2.7, radius: 0.85 }),
    shrineCenter: DUN_PROP('jinsi_warrior.glb', { targetHeight: 2.75, radius: 0.85 }),
    shrineGuard: DUN_PROP('jinsi_lantern_tall.glb', { targetHeight: 2.45, radius: 0.5 }),
    bossGate: SRO_PROP('env/cj_jang_gate.glb', { centerXZ: true }),
    bossFlankLeft: DUN_PROP('jinsi_warrior.glb', { targetHeight: 3.1, radius: 0.85 }),
    bossFlankRight: DUN_PROP('jinsi_warrior.glb', { targetHeight: 3.1, radius: 0.85 }),
    bossSanctumNorth: DUN_PROP('jinsi_flame_bowl.glb', { targetHeight: 2.0, radius: 0.75 })
  },
  qinshi_b8: {
    corners: [
      DUN_PROP('jinsi_maiden.glb', { targetHeight: 2.45, radius: 0.8 }),
      DUN_PROP('jinsi_maiden_confue.glb', { targetHeight: 2.45, radius: 0.85 }),
      DUN_PROP('jinsi_flame_l.glb', { targetHeight: 2.35, radius: 0.7 }),
      DUN_PROP('jinsi_lantern_tall.glb', { targetHeight: 2.4, radius: 0.48 })
    ],
    wall: DUN_PROP('jinsi_flame_l.glb', { targetHeight: 2.55, radius: 0.7 }),
    shrineCenter: DUN_PROP('jinsi_maiden_confue.glb', { targetHeight: 2.75, radius: 0.85 }),
    shrineGuard: DUN_PROP('jinsi_maiden.glb', { targetHeight: 2.55, radius: 0.8 }),
    bossGate: SRO_PROP('env/cj_jang_gate.glb', { centerXZ: true }),
    bossFlankLeft: DUN_PROP('jinsi_maiden_confue.glb', { targetHeight: 3.1, radius: 0.85 }),
    bossFlankRight: DUN_PROP('jinsi_maiden.glb', { targetHeight: 3.1, radius: 0.85 }),
    bossSanctumNorth: DUN_PROP('jinsi_flame_l.glb', { targetHeight: 2.8, radius: 0.7 })
  },
  qinshi_b9: {
    corners: [
      DUN_PROP('jinsi_jewel.glb', { targetHeight: 2.55, radius: 0.65 }),
      DUN_PROP('garden_lion.glb', { targetHeight: 2.15, radius: 0.85 }),
      DUN_PROP('jinsi_warrior.glb', { targetHeight: 2.5, radius: 0.8 }),
      DUN_PROP('jinsi_lantern_tall.glb', { targetHeight: 2.45, radius: 0.48 })
    ],
    wall: DUN_PROP('jinsi_jewel.glb', { targetHeight: 2.8, radius: 0.7 }),
    shrineCenter: DUN_PROP('jinsi_jewel.glb', { targetHeight: 3.0, radius: 0.7 }),
    shrineGuard: DUN_PROP('garden_lion.glb', { targetHeight: 2.35, radius: 0.85 }),
    bossGate: SRO_PROP('env/cj_jang_gate.glb', { centerXZ: true }),
    bossFlankLeft: DUN_PROP('jinsi_warrior.glb', { targetHeight: 3.3, radius: 0.85 }),
    bossFlankRight: DUN_PROP('jinsi_maiden_confue.glb', { targetHeight: 3.25, radius: 0.85 }),
    bossSanctumNorth: DUN_PROP('jinsi_jewel.glb', { targetHeight: 3.2, radius: 0.7 })
  },
  qinshi_b6: {
    corners: [
      DUN_PROP('jinsi_maiden_confue.glb', { targetHeight: 2.55, radius: 0.85 }),
      DUN_PROP('demon_altar_poison.glb', { targetHeight: 2.35, radius: 1.0 }),
      DUN_PROP('jinsi_jewel.glb', { targetHeight: 2.6, radius: 0.65 }),
      DUN_PROP('jinsi_lantern_tall.glb', { targetHeight: 2.5, radius: 0.5 })
    ],
    wall: DUN_PROP('jinsi_flame_l.glb', { targetHeight: 2.7, radius: 0.75 }),
    shrineCenter: DUN_PROP('demon_altar_poison.glb', { targetHeight: 2.65, radius: 1.05 }),
    shrineGuard: DUN_PROP('jinsi_maiden_confue.glb', { targetHeight: 2.7, radius: 0.85 }),
    bossGate: SRO_PROP('env/cj_jang_gate.glb', { centerXZ: true }),
    bossFlankLeft: DUN_PROP('jinsi_warrior.glb', { targetHeight: 3.35, radius: 0.85 }),
    bossFlankRight: DUN_PROP('jinsi_maiden_confue.glb', { targetHeight: 3.3, radius: 0.85 }),
    bossSanctumNorth: DUN_PROP('demon_altar_poison.glb', { targetHeight: 2.9, radius: 1.05 })
  },
  flame: {
    corners: [
      DUN_PROP('flame_sroom_light.glb', { targetHeight: 2.15, radius: 0.6 }),
      DUN_PROP('demon_brazier_fire.glb', { targetHeight: 2.1, radius: 0.75 }),
      DUN_PROP('pha_fire_large.glb', { targetHeight: 2.0, radius: 0.7 })
    ],
    wall: DUN_PROP('demon_pillar.glb', { targetHeight: 3.2, radius: 0.55 }),
    shrineCenter: DUN_PROP('flame_sroom_light.glb', { targetHeight: 2.5, radius: 0.65 }),
    shrineGuard: DUN_PROP('demon_brazier_fire.glb', { targetHeight: 2.2, radius: 0.75 }),
    bossGate: DUN_PROP('cave_arch.glb', { targetHeight: 4.4 }),
    bossFlankLeft: DUN_PROP('demon_pillar.glb', { targetHeight: 3.6, radius: 0.6 }),
    bossFlankRight: DUN_PROP('demon_brazier_fire.glb', { targetHeight: 2.45, radius: 0.75 }),
    bossSanctumNorth: DUN_PROP('flame_sroom_light.glb', { targetHeight: 2.7, radius: 0.65 })
  },
  flame_b10: {
    corners: [
      DUN_PROP('desert_brazier.glb', { targetHeight: 2.05, radius: 0.75 }),
      DUN_PROP('dh_rock_big.glb', { targetHeight: 2.45, radius: 1.15 }),
      DUN_PROP('flame_sroom_light.glb', { targetHeight: 2.2, radius: 0.6 })
    ],
    wall: DUN_PROP('desert_brazier.glb', { targetHeight: 2.25, radius: 0.75 }),
    shrineCenter: DUN_PROP('flame_sroom_light.glb', { targetHeight: 2.5, radius: 0.65 }),
    shrineGuard: DUN_PROP('desert_brazier.glb', { targetHeight: 2.15, radius: 0.75 }),
    bossGate: DUN_PROP('cave_arch.glb', { targetHeight: 4.4 }),
    bossFlankLeft: DUN_PROP('desert_brazier.glb', { targetHeight: 2.45, radius: 0.75 }),
    bossFlankRight: DUN_PROP('dh_rock_big.glb', { targetHeight: 2.9, radius: 1.15 }),
    bossSanctumNorth: DUN_PROP('flame_sroom_light.glb', { targetHeight: 2.7, radius: 0.65 })
  },
  flame_b11: {
    corners: [
      DUN_PROP('demon_altar_death.glb', { targetHeight: 2.35, radius: 1.0 }),
      DUN_PROP('pha_fire_large.glb', { targetHeight: 2.05, radius: 0.7 }),
      DUN_PROP('demon_pillar.glb', { targetHeight: 3.1, radius: 0.6 })
    ],
    wall: DUN_PROP('demon_altar_death.glb', { targetHeight: 2.55, radius: 1.05 }),
    shrineCenter: DUN_PROP('demon_altar_death.glb', { targetHeight: 2.65, radius: 1.05 }),
    shrineGuard: DUN_PROP('demon_pillar.glb', { targetHeight: 3.1, radius: 0.6 }),
    bossGate: DUN_PROP('cave_arch.glb', { targetHeight: 4.45 }),
    bossFlankLeft: DUN_PROP('demon_altar_death.glb', { targetHeight: 2.8, radius: 1.05 }),
    bossFlankRight: DUN_PROP('demon_pillar.glb', { targetHeight: 3.4, radius: 0.6 }),
    bossSanctumNorth: DUN_PROP('pha_fire_large.glb', { targetHeight: 2.5, radius: 0.7 })
  },
  flame_b12: {
    corners: [
      DUN_PROP('demon_altar_fire.glb', { targetHeight: 2.4, radius: 1.05 }),
      DUN_PROP('demon_brazier_fire.glb', { targetHeight: 2.2, radius: 0.75 }),
      DUN_PROP('flame_sroom_light.glb', { targetHeight: 2.25, radius: 0.6 }),
      DUN_PROP('pha_fire_large.glb', { targetHeight: 2.15, radius: 0.7 })
    ],
    wall: DUN_PROP('demon_pillar.glb', { targetHeight: 3.3, radius: 0.6 }),
    shrineCenter: DUN_PROP('demon_altar_fire.glb', { targetHeight: 2.7, radius: 1.05 }),
    shrineGuard: DUN_PROP('demon_brazier_fire.glb', { targetHeight: 2.25, radius: 0.75 }),
    bossGate: DUN_PROP('cave_arch.glb', { targetHeight: 4.5 }),
    bossFlankLeft: DUN_PROP('demon_altar_fire.glb', { targetHeight: 2.85, radius: 1.05 }),
    bossFlankRight: DUN_PROP('demon_brazier_fire.glb', { targetHeight: 2.55, radius: 0.75 }),
    bossSanctumNorth: DUN_PROP('demon_altar_fire.glb', { targetHeight: 2.9, radius: 1.05 })
  },
  holywater: {
    corners: [
      DUN_PROP('pharaoh_ruin.glb', { targetHeight: 2.75, radius: 1.05 }),
      DUN_PROP('pha_statue_green.glb', { targetHeight: 2.65, radius: 0.85 }),
      DUN_PROP('pha_statue_blue.glb', { targetHeight: 2.65, radius: 0.85 }),
      DUN_PROP('pha_burner.glb', { targetHeight: 1.9, radius: 0.75 })
    ],
    wall: DUN_PROP('pha_altar.glb', { targetHeight: 2.95, radius: 1.2 }),
    shrineCenter: DUN_PROP('pharaoh_ruin.glb', { targetHeight: 3.05, radius: 1.1 }),
    shrineGuard: DUN_PROP('pha_burner.glb', { targetHeight: 2.05, radius: 0.75 }),
    springCenter: DUN_PROP('palace_well.glb', { targetHeight: 2.45, radius: 1.1 }),
    bossGate: DUN_PROP('roc_portal.glb', { targetHeight: 4.5 }),
    bossFlankLeft: DUN_PROP('pha_statue_green.glb', { targetHeight: 3.4, radius: 0.85 }),
    bossFlankRight: DUN_PROP('pha_statue_red.glb', { targetHeight: 3.4, radius: 0.85 }),
    bossSanctumNorth: DUN_PROP('pharaoh_ruin.glb', { targetHeight: 3.3, radius: 1.15 })
  },
  jupiter: {
    corners: [
      DUN_PROP('jupiter_piety_altar.glb', { targetHeight: 2.6, radius: 1.15 }),
      DUN_PROP('colosseum_column.glb', { targetHeight: 3.25, radius: 0.8 }),
      DUN_PROP('jupiter_athena_statue.glb', { targetHeight: 2.9, radius: 0.9 }),
      DUN_PROP('jupiter_nike.glb', { targetHeight: 2.85, radius: 0.9 })
    ],
    wall: DUN_PROP('jupiter_piety_gate.glb', { targetHeight: 3.05, radius: 1.2 }),
    shrineCenter: DUN_PROP('jupiter_athena_statue.glb', { targetHeight: 3.1, radius: 0.95 }),
    shrineGuard: DUN_PROP('colosseum_column.glb', { targetHeight: 3.2, radius: 0.8 }),
    springCenter: DUN_PROP('jupiter_fountain.glb', { targetHeight: 2.5, radius: 1.5 }),
    bossGate: DUN_PROP('jupiter_piety_gate.glb', { targetHeight: 4.6 }),
    bossFlankLeft: DUN_PROP('jupiter_athena_statue.glb', { targetHeight: 3.3, radius: 0.95 }),
    bossFlankRight: DUN_PROP('jupiter_nike.glb', { targetHeight: 3.3, radius: 0.95 }),
    bossSanctumNorth: DUN_PROP('jupiter_fountain.glb', { targetHeight: 2.8, radius: 1.5 })
  },
  demon: {
    corners: [
      DUN_PROP('demon_altar_fire.glb', { targetHeight: 2.45, radius: 1.05 }),
      DUN_PROP('demon_altar_poison.glb', { targetHeight: 2.45, radius: 1.05 }),
      DUN_PROP('demon_altar_death.glb', { targetHeight: 2.45, radius: 1.05 }),
      DUN_PROP('demon_air_rock.glb', { targetHeight: 2.65, radius: 0.95 })
    ],
    wall: DUN_PROP('demon_pillar.glb', { targetHeight: 3.4, radius: 0.6 }),
    shrineCenter: DUN_PROP('demon_altar_death.glb', { targetHeight: 2.65, radius: 1.05 }),
    shrineGuard: DUN_PROP('demon_air_rock.glb', { targetHeight: 2.8, radius: 0.95 }),
    bossGate: DUN_PROP('roc_portal.glb', { targetHeight: 4.7 }),
    bossFlankLeft: DUN_PROP('demon_altar_fire.glb', { targetHeight: 3.0, radius: 1.05 }),
    bossFlankRight: DUN_PROP('demon_altar_poison.glb', { targetHeight: 3.0, radius: 1.05 }),
    bossSanctumNorth: DUN_PROP('demon_altar_death.glb', { targetHeight: 3.1, radius: 1.05 })
  },
  roc_nest: {
    corners: [
      DUN_PROP('colosseum_column.glb', { targetHeight: 3.4, radius: 0.85 }),
      DUN_PROP('roc_pillar_key.glb', { targetHeight: 3.1, radius: 0.85 }),
      DUN_PROP('roc_altar.glb', { targetHeight: 2.8, radius: 1.25 }),
      DUN_PROP('roc_nest_straw.glb', { targetHeight: 1.6, radius: 1.15 })
    ],
    wall: DUN_PROP('roc_pillar_key.glb', { targetHeight: 3.6, radius: 0.85 }),
    shrineCenter: DUN_PROP('roc_altar.glb', { targetHeight: 3.25, radius: 1.35 }),
    shrineGuard: DUN_PROP('roc_pillar_key.glb', { targetHeight: 3.0, radius: 0.85 }),
    springCenter: DUN_PROP('jupiter_fountain.glb', { targetHeight: 2.6, radius: 1.5 }),
    bossGate: DUN_PROP('roc_portal.glb', { targetHeight: 5.0 }),
    bossFlankLeft: DUN_PROP('roc_pillar_key.glb', { targetHeight: 3.8, radius: 0.9 }),
    bossFlankRight: DUN_PROP('roc_pillar_key.glb', { targetHeight: 3.8, radius: 0.9 }),
    bossSanctumNorth: DUN_PROP('roc_nest.glb', { targetHeight: 3.8, radius: 1.4 })
  },
  togui: {
    corners: [
      DUN_PROP('togui_totem.glb', { targetHeight: 2.75, radius: 0.8 }),
      DUN_PROP('mayan_gong.glb', { targetHeight: 2.35, radius: 0.9 }),
      DUN_PROP('togui_burner.glb', { targetHeight: 1.45, radius: 0.75 }),
      DUN_PROP('jinsi_lantern.glb', { targetHeight: 2.0, radius: 0.45 })
    ],
    wall: DUN_PROP('mayan_gong.glb', { targetHeight: 2.6, radius: 0.95 }),
    allowPine: true,
    shrineCenter: DUN_PROP('mayan_gong.glb', { targetHeight: 2.8, radius: 0.95 }),
    shrineGuard: DUN_PROP('togui_totem.glb', { targetHeight: 2.85, radius: 0.85 }),
    bossGate: DUN_PROP('togui_gate.glb', { targetHeight: 4.5 }),
    bossFlankLeft: DUN_PROP('togui_totem.glb', { targetHeight: 3.25, radius: 0.85 }),
    bossFlankRight: DUN_PROP('mayan_gong.glb', { targetHeight: 2.7, radius: 0.95 }),
    bossSanctumNorth: DUN_PROP('togui_totem.glb', { targetHeight: 3.2, radius: 0.85 })
  },
  wreck: {
    corners: [
      DUN_PROP('wreck_barrel.glb', { targetHeight: 1.35, radius: 0.65 }),
      DUN_PROP('wreck_crate.glb', { targetHeight: 1.35, radius: 0.7 }),
      DUN_PROP('pha_fire_large.glb', { targetHeight: 2.0, radius: 0.7 }),
      DUN_PROP('palace_well.glb', { targetHeight: 2.0, radius: 1.0 })
    ],
    wall: DUN_PROP('wreck_crate.glb', { targetHeight: 1.75, radius: 0.85 }),
    shrineCenter: DUN_PROP('pha_altar.glb', { targetHeight: 2.8, radius: 1.2 }),
    shrineGuard: DUN_PROP('wreck_barrel.glb', { targetHeight: 1.5, radius: 0.7 }),
    bossGate: DUN_PROP('pha_statue_gold.glb', { targetHeight: 3.5 }),
    bossFlankLeft: DUN_PROP('pha_statue_gold.glb', { targetHeight: 3.0, radius: 0.85 }),
    bossFlankRight: DUN_PROP('wreck_crate.glb', { targetHeight: 1.8, radius: 0.85 }),
    bossSanctumNorth: DUN_PROP('pha_altar.glb', { targetHeight: 3.0, radius: 1.2 })
  }
};

const THEME_TO_DUNGEON = {
  cave: 'donhwang',
  crypt: 'qinshi',
  ruins: 'jupiter',
  lava: 'flame',
  boss: 'roc_nest',
  abyss: 'demon'
};

export function resolveSroDungeon(gen) {
  const profile = gen?.decorProfile || gen?.floorDef?.decorProfile || gen?.theme?.decorProfile;
  if (profile && SRO_DUNGEON_PROPS[profile]) return profile;
  const key = gen?.sroDungeon || gen?.floorDef?.sroDungeon || gen?.theme?.sroDungeon;
  if (key && SRO_DUNGEON_PROPS[key]) return key;
  return THEME_TO_DUNGEON[gen?.theme?.id || gen?.theme?.decor] || 'donhwang';
}

function placePropSpec(gen, spec, x, z, rotationY = 0, { registerSolid = true, heightScale = 1, skipCheck = false, doorPad = 3.2 } = {}) {
  if (!spec?.url || !gen) return false;
  const radius = spec.radius || 0.75;
  if (!skipCheck && blocked(gen, x, z, doorPad, radius)) return false;
  if (typeof window !== 'undefined' && gen.rootGroup) {
    const opts = {
      position: [x, 0, z],
      rotationY,
      autoGround: spec.autoGround !== false,
      centerXZ: Boolean(spec.centerXZ),
      parent: gen.rootGroup
    };
    if (spec.targetHeight) opts.targetHeight = spec.targetHeight * heightScale;
    if (spec.scale) opts.scale = spec.scale * heightScale;
    loadSROProp(spec.url, opts);
  }
  if (!Array.isArray(gen._sroPropsPlaced)) gen._sroPropsPlaced = [];
  gen._sroPropsPlaced.push({ url: spec.url, x, z, r: radius });
  registerDecor(gen, x, z, radius, 'sro_prop', Boolean(registerSolid && spec.radius));
  return true;
}

export function addAuthenticSROProps(gen, rand) {
  if (!gen) return;
  const propSet = SRO_DUNGEON_PROPS[resolveSroDungeon(gen)];
  const corners = propSet.corners || [];
  if (!corners.length) return;

  for (const room of gen.rooms) {
    if (room.type === 'boss' || room.type === 'village') continue;

    // Tuck SRO corner props tightly into room corners (inset 0.95m, strictly >=3.5m clear of doorways)
    const best = bestCorner(gen, room);
    const inset = 0.95;
    const cornerSpots = [
      {
        x: best.sx < 0 ? room.x + inset : room.x + room.w - inset,
        z: best.sz < 0 ? room.z + inset : room.z + room.h - inset
      },
      {
        x: best.sx < 0 ? room.x + room.w - inset : room.x + inset,
        z: best.sz < 0 ? room.z + room.h - inset : room.z + inset
      }
    ];

    cornerSpots.forEach((pt, idx) => {
      const spec = corners[(idx + Math.floor(rand() * corners.length)) % corners.length];
      const ry = Math.atan2(room.centerX - pt.x, room.centerZ - pt.z);
      placePropSpec(gen, spec, pt.x, pt.z, ry, { doorPad: 3.5, heightScale: 0.76 });
    });

    // Huge halls only (w >= 18, h >= 18): tuck wall landmark flush against back wall (never interior/doorways)
    if (room.w >= 18 && room.h >= 18 && propSet.wall && rand() < 0.4) {
      const northWall = rand() < 0.5;
      const wallX = room.x + 4.5 + rand() * (room.w - 9.0);
      const wallZ = room.z + (northWall ? 0.85 : room.h - 0.85);
      placePropSpec(gen, propSet.wall, wallX, wallZ, northWall ? 0 : Math.PI, { doorPad: 3.8, heightScale: 0.8 });
    }

    // Outdoor grotto pine trees strictly against outer corners away from doors
    if (propSet.allowPine && rand() < 0.4) {
      const wx = rand() < 0.5 ? room.x + 0.95 : room.x + room.w - 0.95;
      const wz = rand() < 0.5 ? room.z + 0.95 : room.z + room.h - 0.95;
      if (!blocked(gen, wx, wz, 3.6, 0.7)) {
        if (typeof window !== 'undefined' && gen.rootGroup) {
          loadSROProp('/assets/sro/env/tre_pine01.glb', {
            position: [wx, 0, wz],
            targetHeight: 3.6,
            autoGround: true,
            rotationY: rand() * Math.PI * 2,
            parent: gen.rootGroup
          });
        }
        if (!Array.isArray(gen._sroPropsPlaced)) gen._sroPropsPlaced = [];
        gen._sroPropsPlaced.push({ url: '/assets/sro/env/tre_pine01.glb', x: wx, z: wz, r: 0.7 });
        solid(gen, wx, wz, 0.7, 'sro_prop');
      }
    }
  }
}

/** Torch = instanced stick + soft emissive flame tucked to walls/corners; light borrows pooled lights. */
export function addTorchInstance(b, gen, x, z, color, style) {
  const softCol = tint(color, 0.72);
  b.add('cyl', x, 0.45, z, 0.09, 0.9, 0.09, 0, style.dark || 0x3a2a1a);
  b.add('glowCone', x, 0.98, z, 0.22, 0.36, 0.22, 0, softCol);
  addLight(gen, x, 1.55, z, softCol, 1.25, 11);
}

function candleCluster(b, gen, x, z, style, rand, light = true) {
  if (blocked(gen, x, z, 2.6, 0.38)) return false;
  const softFlame = tint(style.flame, 0.72);
  for (let i = 0; i < 3; i++) {
    const cx = x + (rand() - 0.5) * 0.42;
    const cz = z + (rand() - 0.5) * 0.42;
    const h = 0.22 + rand() * 0.2;
    b.add('cyl', cx, h * 0.5, cz, 0.09, h, 0.09, 0, style.wax || 0xf2ead2);
    b.add('glowCone', cx, h + 0.09, cz, 0.08, 0.16, 0.08, 0, softFlame);
  }
  if (light) addLight(gen, x, 0.9, z, softFlame, 1.0, 9);
  registerDecor(gen, x, z, 0.35, 'candles', false);
  return true;
}

function brazier(b, gen, x, z, color, bowlColor, scale = 1, skipCheck = false) {
  const rad = 0.42 * scale;
  if (!skipCheck && blocked(gen, x, z, 2.8, rad)) return false;
  const softFlame = tint(color, 0.74);
  b.add('mcyl', x, 0.25 * scale, z, 0.2 * scale, 0.5 * scale, 0.2 * scale, 0, bowlColor);
  b.add('mcyl', x, 0.58 * scale, z, 0.6 * scale, 0.2 * scale, 0.6 * scale, 0, bowlColor);
  b.add('glowCone', x, 0.92 * scale, z, 0.4 * scale, 0.52 * scale, 0.4 * scale, 0, softFlame);
  addLight(gen, x, 1.45 * scale, z, softFlame, 1.35, 12);
  solid(gen, x, z, rad, 'brazier');
  return true;
}

function statueFigure(b, x, z, ry, bodyCol, baseCol, rand, scale = 1) {
  b.add('box', x, 0.12 * scale, z, 0.9 * scale, 0.24 * scale, 0.9 * scale, ry, baseCol);
  b.add('cyl', x, 0.84 * scale, z, 0.5 * scale, 1.2 * scale, 0.42 * scale, ry, jit(bodyCol, rand, 0.12));
  b.add('box', x, 1.34 * scale, z, 0.78 * scale, 0.2 * scale, 0.4 * scale, ry, tint(bodyCol, 0.92));
  b.add('sphere', x, 1.68 * scale, z, 0.4 * scale, 0.44 * scale, 0.4 * scale, ry, jit(bodyCol, rand, 0.1));
}

// ---------------------------------------------------------------------------------------------
// Theme props (kept strictly flush against perimeter walls & high on walls — open combat floors!)
// ---------------------------------------------------------------------------------------------
function decorCave(b, gen, room, rand, st) {
  wallSpots(gen, room, 0.22, 3.0, 4.0).forEach((s, i) => {
    if (i % 3 !== 0) return;
    // timber beam brace flush against wall face (non-blocking)
    const horiz = s.side === 'N' || s.side === 'S';
    const ax = horiz ? 1 : 0; const az = horiz ? 0 : 1;
    for (const k of [-0.9, 0.9]) {
      b.add('box', s.x + ax * k, 1.35, s.z + az * k, 0.2, 2.7, 0.2, 0, jit(st.timber, rand));
    }
    b.add('box', s.x, 2.65, s.z, horiz ? 2.2 : 0.2, 0.22, horiz ? 0.2 : 2.2, 0, tint(st.timber, 0.88));
  });
  // Tight muted ore crystals tucked deep into far corners only
  const corners = [[0.85, 0.85], [room.w - 0.85, 0.85], [0.85, room.h - 0.85], [room.w - 0.85, room.h - 0.85]];
  corners.forEach(([ox, oz], ci) => {
    if (rand() < 0.45) return;
    const cx = room.x + ox; const cz = room.z + oz;
    if (blocked(gen, cx, cz, 3.4, 0.5)) return;
    const c1 = tint(ci % 2 ? st.ore2 : st.ore, 0.65);
    for (let i = 0; i < 3; i++) {
      const a = rand() * 6.28; const d = 0.12 + rand() * 0.25;
      const h = 0.45 + rand() * 0.55;
      b.add('glowCone', cx + Math.cos(a) * d, h * 0.5, cz + Math.sin(a) * d, 0.24, h, 0.24, 0, tint(c1, 0.85), (rand() - 0.5) * 0.3, (rand() - 0.5) * 0.3);
    }
    if (ci % 2 === 0) addLight(gen, cx, 0.85, cz, c1, 0.95, 9);
    solid(gen, cx, cz, 0.45, 'ore_cluster');
  });
}

function decorCrypt(b, gen, room, rand, st) {
  wallSpots(gen, room, 0.16, 2.8, 3.8).forEach((s, i) => {
    const horiz = s.side === 'N' || s.side === 'S';
    if (i % 2 === 0) {
      // recessed bone niche mounted up on the wall face (y = 1.5..2.3m, zero floor protrusion)
      const px = s.side === 'W' ? room.x + 0.06 : s.side === 'E' ? room.x + room.w - 0.06 : s.x;
      const pz = s.side === 'N' ? room.z + 0.06 : s.side === 'S' ? room.z + room.h - 0.06 : s.z;
      b.add('box', px, 1.85, pz, horiz ? 1.0 : 0.1, 1.0, horiz ? 0.1 : 1.0, 0, st.dark);
      b.add('sphere', px, 1.6, pz, 0.2, 0.22, 0.2, 0, tint(st.bone, 0.85));
      b.add('box', px, 2.0, pz, horiz ? 0.38 : 0.08, 0.07, horiz ? 0.08 : 0.38, 0.3, tint(st.bone, 0.85));
    } else if (i % 4 === 3 && rand() < 0.65) {
      const cx = s.x + (s.side === 'W' ? 0.25 : s.side === 'E' ? -0.25 : 0);
      const cz = s.z + (s.side === 'N' ? 0.25 : s.side === 'S' ? -0.25 : 0);
      candleCluster(b, gen, cx, cz, st, rand, rand() < 0.35);
    }
  });
}

function decorRuins(b, gen, room, rand, st) {
  wallSpots(gen, room, 0.14, 2.8, 3.6).forEach((s, i) => {
    const horiz = s.side === 'N' || s.side === 'S';
    if (i % 3 === 0) {
      // vines creeping strictly down perimeter walls (zero interior floor blocks or toppled statues)
      const wx = s.side === 'W' ? room.x + 0.06 : s.side === 'E' ? room.x + room.w - 0.06 : s.x;
      const wz = s.side === 'N' ? room.z + 0.06 : s.side === 'S' ? room.z + room.h - 0.06 : s.z;
      for (let k = 0; k < 3; k++) {
        const off = (k - 1) * 0.38;
        const len = 1.0 + rand() * 1.4;
        const vx = wx + (horiz ? off : 0); const vz = wz + (horiz ? 0 : off);
        b.add('box', vx, 2.75 - len * 0.5, vz, 0.07, len, 0.07, 0, rand() < 0.5 ? st.vine : st.vine2);
        b.add('sphere', vx, 2.75 - len, vz, 0.26, 0.13, 0.26, rand() * 3, st.vine2);
      }
    }
  });
}

function decorLava(b, gen, room, rand, st) {
  // Wall-mounted iron chains & muted bronze brackets flush against upper walls (no glaring floor lava cracks)
  wallSpots(gen, room, 0.24, 3.2, 4.0).forEach((s, i) => {
    if (i % 3 !== 0) return;
    b.add('mbox', s.x, 2.72, s.z, 0.9, 0.12, 0.22, s.ry, st.iron);
    b.add('mcyl', s.x, 2.05, s.z, 0.07, 1.3, 0.07, 0, st.iron);
    for (let k = 0; k < 3; k++) b.add('torus', s.x, 1.55 + k * 0.38, s.z, 0.22, 0.22, 0.22, k * 0.8, st.iron, (Math.PI / 2) * (k % 2));
  });
}

function decorAbyss(b, gen, room, rand, st) {
  // Corner guardians tucked tight in blind corners & slim wall mirrors/plaques on perimeter walls (zero floor clutter)
  if (room.type !== 'start') {
    const corners = [
      [room.x + 0.85, room.z + 0.85, Math.PI * 0.25],
      [room.x + room.w - 0.85, room.z + 0.85, -Math.PI * 0.25],
      [room.x + 0.85, room.z + room.h - 0.85, Math.PI * 0.75],
      [room.x + room.w - 0.85, room.z + room.h - 0.85, -Math.PI * 0.75]
    ];
    for (const [cx, cz, ry] of corners) {
      if (rand() < 0.45 || blocked(gen, cx, cz, 3.6, 0.5)) continue;
      statueFigure(b, cx, cz, ry, st.clay, tint(st.stone, 0.85), rand, 0.85);
      solid(gen, cx, cz, 0.45, 'terracotta');
    }
  }
  wallSpots(gen, room, 0.22, 3.4, 4.0).forEach((s, i) => {
    if (i % 4 === 1) {
      // slim bronze shield/mirror plaque flush against upper wall
      b.add('mcyl', s.x, 2.0, s.z, 0.85, 0.06, 0.85, s.ry, tint(st.bronze, 0.88), Math.PI / 2 - 0.05, 0);
      b.add('mbox', s.x, 2.0, s.z, 0.14, 0.95, 0.08, s.ry, tint(st.dark, 1.1));
    }
  });
}

function resolveBiomeBase(gen) {
  const key = resolveSroDungeon(gen);
  if (key === 'qinshi_b6') return 'qinshi_b6';
  if (key.startsWith('donhwang')) return 'donhwang';
  if (key.startsWith('karakoram')) return 'karakoram';
  if (key.startsWith('qinshi')) return 'qinshi';
  if (key.startsWith('flame')) return 'flame';
  return key;
}

function decorKarakoram(b, gen, room, rand, st) {
  // Salt-frost crystal shards in corners + warm bandit braziers along flat walls (zero crypt skulls!)
  wallSpots(gen, room, 0.22, 3.0, 4.0).forEach((s, i) => {
    if (i % 3 !== 0) return;
    const horiz = s.side === 'N' || s.side === 'S';
    b.add('mbox', s.x, 1.9, s.z, horiz ? 0.52 : 0.14, 0.28, horiz ? 0.14 : 0.52, 0, tint(st.bronze || st.iron, 0.9));
    b.add('glowBox', s.x, 2.2, s.z, 0.18, 0.22, 0.18, 0, tint(st.flame || 0xf59e0b, 0.72));
  });
  const corners = [[0.85, 0.85], [room.w - 0.85, 0.85], [0.85, room.h - 0.85], [room.w - 0.85, room.h - 0.85]];
  corners.forEach(([ox, oz], ci) => {
    if (rand() < 0.5) return;
    const cx = room.x + ox; const cz = room.z + oz;
    if (blocked(gen, cx, cz, 3.4, 0.45)) return;
    const frost = ci % 2 ? 0xdbeafe : 0xbae6fd;
    for (let i = 0; i < 3; i++) {
      const a = rand() * 6.28; const d = 0.1 + rand() * 0.22;
      const h = 0.5 + rand() * 0.6;
      b.add('cone', cx + Math.cos(a) * d, h * 0.5, cz + Math.sin(a) * d, 0.22, h, 0.22, 0, tint(frost, 0.85), (rand() - 0.5) * 0.25, (rand() - 0.5) * 0.25);
    }
    solid(gen, cx, cz, 0.42, 'salt_cluster');
  });
}

function decorQinshi(b, gen, room, rand, st) {
  // Imperial Silkroad lacquer plaques, lantern brackets & bronze shields along walls (zero creeping vines!)
  wallSpots(gen, room, 0.18, 3.0, 4.0).forEach((s, i) => {
    const horiz = s.side === 'N' || s.side === 'S';
    if (i % 3 === 0) {
      b.add('mbox', s.x, 2.15, s.z, horiz ? 0.82 : 0.1, 0.95, horiz ? 0.1 : 0.82, 0, 0x5c1a1a);
      b.add('mbox', s.x, 2.15, s.z, horiz ? 0.9 : 0.12, 0.12, horiz ? 0.12 : 0.9, 0, tint(st.bronze || 0xc9a24a, 0.9));
    } else if (i % 6 === 2 && !blocked(gen, s.x, s.z, 2.8, 0.35)) {
      b.add('mcyl', s.x, 1.95, s.z, 0.26, 0.36, 0.26, 0, tint(st.bronze || 0xc9a24a, 0.88));
      b.add('glowBox', s.x, 1.95, s.z, 0.18, 0.24, 0.18, 0, 0xfbbf24);
    }
  });
}

function decorHolywater(b, gen, room, rand, st) {
  // Egyptian sandstone wall obelisks & gilded sun discs (zero terracotta warriors)
  wallSpots(gen, room, 0.20, 3.2, 4.2).forEach((s, i) => {
    if (i % 3 !== 0) return;
    b.add('box', s.x, 1.35, s.z, 0.36, 2.7, 0.36, 0, tint(0xd4b483, 0.85));
    b.add('cone', s.x, 2.85, s.z, 0.28, 0.38, 0.28, 0, tint(st.bronze || 0xd4a437, 0.9));
  });
}

function decorJupiter(b, gen, room, rand, st) {
  // Greco-Roman temple bronze sun-shields & fluted wall pilasters (zero terracotta warriors)
  wallSpots(gen, room, 0.20, 3.2, 4.0).forEach((s, i) => {
    if (i % 3 === 1) {
      b.add('mcyl', s.x, 2.05, s.z, 0.85, 0.07, 0.85, s.ry, tint(st.bronze || 0xd4a437, 0.9), Math.PI / 2 - 0.04, 0);
      b.add('mbox', s.x, 2.05, s.z, 0.16, 0.92, 0.09, s.ry, tint(st.stone, 0.9));
    }
  });
}

function decorDemon(b, gen, room, rand, st) {
  // Obsidian wall blades & emerald/violet abyssal rune plaques (zero terracotta warriors)
  wallSpots(gen, room, 0.20, 3.2, 4.0).forEach((s, i) => {
    if (i % 3 === 0) {
      const horiz = s.side === 'N' || s.side === 'S';
      b.add('box', s.x, 1.85, s.z, horiz ? 0.22 : 0.14, 1.8, horiz ? 0.14 : 0.22, 0, 0x1e1b2e);
      b.add('glowBox', s.x, 2.15, s.z, 0.16, 0.35, 0.16, 0, tint(st.jadeGlow || 0xa855f7, 0.78));
    }
  });
}

function decorRoc(b, gen, room, rand, st) {
  // Sky-sanctum gilded wing crests flush against upper walls (zero terracotta warriors)
  wallSpots(gen, room, 0.22, 3.4, 4.2).forEach((s, i) => {
    if (i % 3 === 1) {
      b.add('mcyl', s.x, 2.2, s.z, 0.76, 0.06, 0.76, s.ry, 0xd4a437, Math.PI / 2 - 0.04, 0);
      b.add('glowBox', s.x, 2.2, s.z, 0.22, 0.22, 0.09, s.ry, 0xfbbf24);
    }
  });
}

function decorTogui(b, gen, room, rand, st) {
  // Tribal timber frames & carved Mayan bronze discs on walls
  wallSpots(gen, room, 0.20, 3.0, 4.0).forEach((s, i) => {
    if (i % 3 === 0) {
      const horiz = s.side === 'N' || s.side === 'S';
      b.add('box', s.x, 1.4, s.z, horiz ? 0.26 : 0.16, 2.6, horiz ? 0.16 : 0.26, 0, tint(st.timber || 0x5c3a21, 0.9));
      b.add('mcyl', s.x, 2.1, s.z, 0.56, 0.08, 0.56, s.ry, 0xb47d3b, Math.PI / 2 - 0.04, 0);
    }
  });
}

function decorWreck(b, gen, room, rand, st) {
  // Ghost-ship timber ribs & brass wall lanterns
  wallSpots(gen, room, 0.20, 3.0, 4.0).forEach((s, i) => {
    if (i % 3 === 0) {
      const horiz = s.side === 'N' || s.side === 'S';
      b.add('box', s.x, 1.4, s.z, horiz ? 0.24 : 0.18, 2.75, horiz ? 0.18 : 0.24, 0, tint(st.timber || 0x4b3320, 0.86));
      b.add('glowBox', s.x, 2.1, s.z, 0.18, 0.24, 0.18, 0, 0x7dd3fc);
    }
  });
}

const SRO_BIOME_DECORATORS = {
  donhwang: decorCave,
  karakoram: decorKarakoram,
  qinshi: decorQinshi,
  qinshi_b6: decorQinshi,
  flame: decorLava,
  holywater: decorHolywater,
  jupiter: decorJupiter,
  demon: decorDemon,
  roc_nest: decorRoc,
  togui: decorTogui,
  wreck: decorWreck
};

const THEME_DECORATORS = { cave: decorCave, crypt: decorCrypt, ruins: decorRuins, lava: decorLava, abyss: decorAbyss };

/**
 * Flush, calm ground-level inlaid stone medallions & border strips with zero harsh emissive glare
 * and zero standing obstacles on combat floors.
 */
function addFloorArtistry(b, gen, room, rand, st) {
  if (!room || room.w < 8 || room.h < 8) return;
  const cx = room.centerX;
  const cz = room.centerZ;
  const span = Math.min(room.w, room.h);
  const trim = tint(st.bronze || st.iron || st.stone, 0.65);

  if (room.type !== 'corridor' && span >= 10) {
    const r = Math.min(3.4, span * 0.22);
    b.add('cyl', cx, 0.01, cz, r * 1.4, 0.018, r * 1.4, 0, tint(st.dark, 1.18));
    b.add('cyl', cx, 0.015, cz, r * 0.9, 0.014, r * 0.9, 0, tint(trim, 0.82));
    b.add('box', cx, 0.012, cz, r * 1.8, 0.015, 0.16, 0, tint(trim, 0.76));
    b.add('box', cx, 0.012, cz, 0.16, 0.015, r * 1.8, 0, tint(trim, 0.76));
  }

  if (span >= 14) {
    const hw = room.w * 0.5 - 1.4;
    const hh = room.h * 0.5 - 1.4;
    b.add('box', cx, 0.011, cz - hh, hw * 1.65, 0.015, 0.18, 0, tint(trim, 0.64));
    b.add('box', cx, 0.011, cz + hh, hw * 1.65, 0.015, 0.18, 0, tint(trim, 0.64));
    b.add('box', cx - hw, 0.011, cz, 0.18, 0.015, hh * 1.65, 0, tint(trim, 0.64));
    b.add('box', cx + hw, 0.011, cz, 0.18, 0.015, hh * 1.65, 0, tint(trim, 0.64));
  }
}

/** Per-floor ambient decor pass: wall pillars, arches, rubble and per-theme props in every room. */
const ARCHETYPE_ACCENTS = {
  lava: 0xf97316,
  abyss: 0x10b981,
  ruins: 0x38bdf8,
  crypt: 0xa855f7,
  boss: 0xfbbf24
};

function dressRoomArchetype(gen, b, room, rand, st) {
  const arch = room?.archetype;
  if (!arch || room.type === 'boss' || room.type === 'start' || room.type === 'village') return;
  if (room.w < 12 || room.h < 12) return;

  const cx = room.centerX;
  const cz = room.centerZ;
  const trim = tint(st.bronze || st.stone, 0.78);
  const darkStone = tint(st.stone, 0.74);

  // Flush non-blocking inlaid floor carpets & architectural borders ONLY — combat center stays 100% open
  if (arch === 'vanguard_courtyard') {
    const rx = Math.min(5.2, room.w * 0.28);
    const rz = Math.min(4.8, room.h * 0.28);
    b.add('box', cx, 0.016, cz, rx * 1.45, 0.018, 0.3, 0, trim);
    b.add('box', cx, 0.016, cz, 0.3, 0.018, rz * 1.45, 0, trim);
    return;
  }

  if (arch === 'pillared_cloister' || arch === 'processional') {
    b.add('box', cx, 0.016, cz, 3.0, 0.018, room.h * 0.68, 0, arch === 'processional' ? 0x5c1a1a : darkStone);
    b.add('box', cx, 0.022, cz, 0.3, 0.016, room.h * 0.64, 0, trim);
    return;
  }

  if (arch === 'crucible_sanctum') {
    const dia = Math.min(8.2, Math.min(room.w, room.h) * 0.4);
    b.add('cyl', cx, 0.016, cz, dia, 0.02, dia, 0, darkStone);
    b.add('cyl', cx, 0.022, cz, dia * 0.65, 0.016, dia * 0.65, 0, tint(trim, 0.85));
    return;
  }

  if (arch === 'reliquary_hall') {
    b.add('box', cx, 0.016, cz, 3.2, 0.018, room.h * 0.6, 0, 0x5c1a1a);
    b.add('box', cx, 0.022, cz, 3.5, 0.014, room.h * 0.6, 0, trim);
  }
}

export function decorateFloor(gen, b, rand, wallTiles) {
  const st = styleFor(gen.theme);
  addWallPillars(b, gen, wallTiles, st, rand);
  addDoorArches(b, gen, st);
  addRubble(b, gen, rand, st);
  addAuthenticSROProps(gen, rand);
  const biomeBase = resolveBiomeBase(gen);
  const fn = SRO_BIOME_DECORATORS[biomeBase] || THEME_DECORATORS[gen.theme?.decor] || decorCave;
  for (const room of gen.rooms) {
    if (room.type === 'boss') continue; // the arena has its own set piece
    addFloorArtistry(b, gen, room, rand, st);
    dressRoomArchetype(gen, b, room, rand, st);
    fn(b, gen, room, rand, st);
  }
}

// ---------------------------------------------------------------------------------------------
// Special room dressing
// ---------------------------------------------------------------------------------------------
export function dressSpecialRoom(gen, b, room, kind, rand) {
  const st = styleFor(gen.theme);
  if (kind === 'processional') {
    // long hall: inlaid runner & corner candles tucked near walls (clear floor lane)
    b.add('box', room.centerX, 0.012, room.centerZ, room.w - 4.0, 0.02, 2.6, 0, tint(st.dark, 1.35));
    candleCluster(b, gen, room.x + 1.0, room.z + 1.0, st, rand, true);
    candleCluster(b, gen, room.x + room.w - 1.0, room.z + room.h - 1.0, st, rand, true);
  } else if (kind === 'trap_gallery') {
    // Frame the trap room perimeter cleanly without misleading center guide lines over live spike traps
    const borderCol = tint(st.bronze || st.iron || st.stone, 0.72);
    b.add('box', room.centerX, 0.012, room.z + 1.0, room.w - 2.0, 0.02, 0.24, 0, borderCol);
    b.add('box', room.centerX, 0.012, room.z + room.h - 1.0, room.w - 2.0, 0.02, 0.24, 0, borderCol);
  } else if (kind === 'shrine') {
    b.add('cyl', room.centerX, 0.012, room.centerZ, 4.4, 0.025, 4.4, 0, tint(st.dark, 1.35));
    const propSet = SRO_DUNGEON_PROPS[resolveSroDungeon(gen)];
    const centerSpec = propSet?.shrineCenter;
    const guardSpec = propSet?.shrineGuard || propSet?.corners?.[0];
    if (propSet) {
      if (centerSpec) {
        placePropSpec(gen, centerSpec, room.centerX, room.centerZ - 3.2, 0, { registerSolid: true, doorPad: 3.0 });
      }
      if (guardSpec) {
        placePropSpec(gen, guardSpec, room.centerX - 3.6, room.centerZ, Math.PI * 0.45, { registerSolid: true, doorPad: 3.0 });
        placePropSpec(gen, guardSpec, room.centerX + 3.6, room.centerZ, -Math.PI * 0.45, { registerSolid: true, doorPad: 3.0 });
      }
    }
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + 0.4;
      const kx = room.centerX + Math.cos(a) * 2.45;
      const kz = room.centerZ + Math.sin(a) * 2.45;
      candleCluster(b, gen, kx, kz, st, rand, i % 2 === 0);
    }
  } else if (kind === 'spring' || kind === 'celestial_spring') {
    b.add('cyl', room.centerX, 0.012, room.centerZ, 5.0, 0.025, 5.0, 0, 0x0e5e73);
    b.add('cyl', room.centerX, 0.12, room.centerZ, 3.6, 0.24, 3.6, 0, tint(st.stone, 0.95));
    b.add('glowBox', room.centerX, 0.22, room.centerZ, 2.5, 0.08, 2.5, 0, 0x1aa6b8);
    const propSet = SRO_DUNGEON_PROPS[resolveSroDungeon(gen)];
    const springProp = propSet?.springCenter || propSet?.shrineGuard || propSet?.corners?.[0];
    if (propSet && springProp) {
      placePropSpec(gen, springProp, room.centerX, room.centerZ - 3.6, 0, { registerSolid: true, doorPad: 3.0 });
    }
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + 0.4;
      const kx = room.centerX + Math.cos(a) * 2.85;
      const kz = room.centerZ + Math.sin(a) * 2.85;
      candleCluster(b, gen, kx, kz, st, rand, true);
    }
  }
}

export const VAULT_DEPTH = 4.4;

/**
 * Vault alcove in a room corner: a fence of gilded posts sealing the corner except for a gate gap.
 * Returns world-space helpers: gate position and chest slots (chest positions are alcove-local, inward).
 */
export function buildVaultAlcove(gen, b, room, corner) {
  const st = styleFor(gen.theme);
  const D = VAULT_DEPTH;
  const { sx, sz } = corner; // -1 = west/north corner, +1 = east/south corner
  const ex = sx < 0 ? room.x : room.x + room.w;
  const ez = sz < 0 ? room.z : room.z + room.h;
  const fx = ex - sx * D;
  const gold = 0xc9a24a;
  const at = (tx, tz) => ({ x: ex - sx * tx, z: ez - sz * tz });
  const post = (x, z) => {
    b.add('cyl', x, 0.8, z, 0.7, 1.6, 0.7, 0, tint(st.stone, 1.0));
    b.add('sphere', x, 1.72, z, 0.55, 0.45, 0.55, 0, gold);
    solid(gen, x, z, 0.36, 'vault_post');
  };
  const gateZ = ez - sz * D * 0.5;
  const fz = ez - sz * D;
  for (let t = 0.5; t <= D - 0.5; t += 1.0) {
    const z = ez - sz * t;
    if (Math.abs(z - gateZ) < 1.3) continue;
    post(fx, z); // fence A runs along z at x = fx and holds the gate gap
  }
  for (let t = 0.5; t <= D - 0.5; t += 1.0) post(ex - sx * t, fz); // fence B, solid
  post(fx, fz); // inner corner post
  b.add('box', (ex + fx) * 0.5, 0.02, (ez + fz) * 0.5, D - 0.4, 0.04, D - 0.4, 0, tint(gold, 0.7));

  // Authentic Silkroad vault guardian lion statues and palace lamp (clear of vault gate)
  if (gen) {
    const lx1 = fx - sx * 1.15; const lz1 = gateZ - 1.55;
    const lx2 = fx - sx * 1.15; const lz2 = gateZ + 1.55;
    const pxL = fx + sx * 1.45; const pzL = ez - sz * 1.35;
    if (!blocked(gen, lx1, lz1, 0.6, 0.52)) {
      if (typeof window !== 'undefined' && gen?.rootGroup) {
        loadSROProp('/assets/sro/props/cj3_lion01.glb', {
          position: [lx1, 0, lz1],
          targetHeight: 1.88,
          autoGround: true,
          rotationY: sx > 0 ? -Math.PI * 0.4 : Math.PI * 0.4,
          parent: gen.rootGroup
        });
      }
      solid(gen, lx1, lz1, 0.52, 'vault_lion');
    }
    if (!blocked(gen, lx2, lz2, 0.6, 0.52)) {
      if (typeof window !== 'undefined' && gen?.rootGroup) {
        loadSROProp('/assets/sro/props/cj3_lion01.glb', {
          position: [lx2, 0, lz2],
          targetHeight: 1.88,
          autoGround: true,
          rotationY: sx > 0 ? -Math.PI * 0.6 : Math.PI * 0.6,
          parent: gen.rootGroup
        });
      }
      solid(gen, lx2, lz2, 0.52, 'vault_lion');
    }
    if (!blocked(gen, pxL, pzL, 0.4, 0.36)) {
      if (typeof window !== 'undefined' && gen?.rootGroup) {
        loadSROProp('/assets/sro/props/cj_pal_lamp.glb', {
          position: [pxL, 0, pzL],
          targetHeight: 2.14,
          parent: gen.rootGroup
        });
      }
      solid(gen, pxL, pzL, 0.36, 'vault_lamp');
    }
  }
  return {
    center: at(D * 0.5, D * 0.5),
    gate: { x: fx, z: gateZ },
    slots: [at(2.4, 2.2), at(1.0, 1.3), at(1.0, 3.1)]
  };
}

// ---------------------------------------------------------------------------------------------
// Boss arena set piece
// ---------------------------------------------------------------------------------------------
const BOSS_ARENA_PROFILES = {
  donhwang: { carpet: 0x4b2f21, ring: 0x3b2d22, flame: 0xf59e0b, daisTint: 0.85 },
  karakoram: { carpet: 0x26415c, ring: 0x1e293b, flame: 0x38bdf8, daisTint: 0.92 },
  qinshi: { carpet: 0x5c1a1a, ring: 0x2a1a16, flame: 0xfbbf24, daisTint: 0.9 },
  qinshi_b6: { carpet: 0x1f3d2f, ring: 0x16241d, flame: 0x10b981, daisTint: 0.82 },
  flame: { carpet: 0x45120c, ring: 0x240a08, flame: 0xf97316, daisTint: 0.78 },
  holywater: { carpet: 0x6b4e1e, ring: 0x2d2414, flame: 0xfacc15, daisTint: 0.95 },
  jupiter: { carpet: 0x274060, ring: 0x1e293b, flame: 0x60a5fa, daisTint: 0.98 },
  demon: { carpet: 0x341942, ring: 0x1c1224, flame: 0xc084fc, daisTint: 0.76 },
  roc_nest: { carpet: 0x5c1a1a, ring: 0x342a4a, flame: 0xfbbf24, daisTint: 0.96 },
  togui: { carpet: 0x4a2518, ring: 0x241712, flame: 0xef4444, daisTint: 0.84 },
  wreck: { carpet: 0x1e3a4c, ring: 0x14222c, flame: 0x38bdf8, daisTint: 0.84 }
};

export function decorateBossArenaProps(gen, b, room, rand, entrance = null) {
  const st = styleFor(gen.theme);
  const cx = room.centerX; const cz = room.centerZ;
  const isFinalSanctum = Boolean(room.w >= 50 || gen.currentFloor === 16);
  const maxR = Math.max(7.6, Math.min(room.w, room.h) * 0.5 - 1.8);
  const R = Math.min(isFinalSanctum ? 20.5 : 15.8, maxR);
  const daisScale = isFinalSanctum ? 1.75 : 1.32;
  const trimCol = tint(st.bronze || st.stone, 0.78);
  const biomeBase = resolveBiomeBase(gen);
  const profile = BOSS_ARENA_PROFILES[biomeBase] || BOSS_ARENA_PROFILES.donhwang;
  const flame = tint(isFinalSanctum ? 0xfbbf24 : profile.flame, 0.74);

  // Monumental 3-tier dais customized per boss biome + inlaid cardinal crossways (wide open center)
  b.add('cyl', cx, 0.022, cz, 7.6 * daisScale, 0.045, 7.6 * daisScale, 0, tint(st.stone, 0.78 * profile.daisTint));
  b.add('cyl', cx, 0.052, cz, 5.4 * daisScale, 0.045, 5.4 * daisScale, 0, tint(st.stone, 0.88 * profile.daisTint));
  b.add('cyl', cx, 0.082, cz, 3.2 * daisScale, 0.036, 3.2 * daisScale, 0, tint(st.stone, 0.96 * profile.daisTint));
  b.add('box', cx, 0.05, cz, Math.max(room.w - 6, R * 1.7), 0.024, 0.4, 0, trimCol);
  b.add('box', cx, 0.05, cz, 0.4, 0.024, Math.max(room.h - 6, R * 1.55), 0, trimCol);

  // Determine entrance direction vector from center toward doorway (defaults to +Z south)
  let side = entrance?.side;
  if (!side && entrance) {
    const edx = entrance.x - cx;
    const edz = entrance.z - cz;
    side = Math.abs(edx) > Math.abs(edz) ? (edx > 0 ? 'E' : 'W') : (edz > 0 ? 'S' : 'N');
  }
  side = side || 'S';
  const dirVec = side === 'N' ? [0, -1] : side === 'W' ? [-1, 0] : side === 'E' ? [1, 0] : [0, 1];
  const rightVec = [-dirVec[1], dirVec[0]];
  const alongZ = dirVec[0] === 0;

  // Ceremonial carpet oriented cleanly from actual entrance threshold to the central dais
  const runnerLen = Math.min(isFinalSanctum ? 22.0 : 18.0, (alongZ ? room.h : room.w) * 0.44);
  const runnerDist = Math.min((alongZ ? room.h : room.w) * 0.25, isFinalSanctum ? 9.0 : 6.6);
  const runnerX = cx + dirVec[0] * runnerDist;
  const runnerZ = cz + dirVec[1] * runnerDist;
  const carpetW = isFinalSanctum ? 4.0 : 3.2;
  b.add('box', runnerX, 0.02, runnerZ, alongZ ? carpetW : runnerLen, 0.02, alongZ ? runnerLen : carpetW, 0, profile.carpet);
  b.add('box', runnerX, 0.026, runnerZ, alongZ ? carpetW + 0.35 : runnerLen + 0.2, 0.015, alongZ ? runnerLen + 0.2 : carpetW + 0.35, 0, trimCol);

  b.add('cyl', cx, 0.098, cz, isFinalSanctum ? 4.6 : 3.1, 0.03, isFinalSanctum ? 4.6 : 3.1, 0, profile.ring);

  // Grand 12-pillar ring pushed out along outer arena perimeter (wide open center arena for combat!)
  const pillarCount = 12;
  const pillarHeight = isFinalSanctum ? 5.6 : 4.2;
  for (let i = 0; i < pillarCount; i++) {
    const a = ((i + 0.5) / pillarCount) * Math.PI * 2;
    const px = cx + Math.cos(a) * R; const pz = cz + Math.sin(a) * R;
    if (nearOpening(gen, px, pz, 3.4)) continue;
    b.add('cyl', px, pillarHeight * 0.5, pz, 1.1, pillarHeight, 1.1, 0, jit(st.stone, rand, 0.12));
    b.add('box', px, 0.26, pz, 1.55, 0.52, 1.55, 0, tint(st.stone, 0.8));
    b.add('box', px, pillarHeight + 0.18, pz, 1.48, 0.38, 1.48, 0, trimCol);
    const ix = cx + Math.cos(a) * (R - 0.68);
    const iz = cz + Math.sin(a) * (R - 0.68);
    b.add('glowBox', ix, 2.45, iz, 0.22, 0.34, 0.22, a, flame);
    solid(gen, px, pz, 0.72);
  }

  // Outer wing braziers tucked far away from doorway entrances and the open center ring
  const bowl = st.iron || st.bronze || st.stone;
  if (room.w >= 34) {
    const wingX = room.w * 0.4;
    const wingZ = room.h * 0.34;
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const bx = cx + sx * wingX;
        const bz = cz + sz * wingZ;
        if (!nearOpening(gen, bx, bz, 3.8)) {
          brazier(b, gen, bx, bz, flame, bowl, 1.25);
        }
      }
    }
  }

  // Lateral perimeter wing landmarks & far sanctum opposite the real entrance
  const propSet = SRO_DUNGEON_PROPS[resolveSroDungeon(gen)];
  if (gen && propSet) {
    const flankForward = Math.min(R * 0.88, (alongZ ? room.h : room.w) * 0.5 - 2.4);
    const flankAside = isFinalSanctum ? 10.5 : 8.2;
    const heightScale = isFinalSanctum ? 1.25 : 1.05;
    const faceBackYaw = Math.atan2(-dirVec[0], -dirVec[1]);

    if (propSet.bossFlankLeft) {
      const fx = cx + dirVec[0] * flankForward - rightVec[0] * flankAside;
      const fz = cz + dirVec[1] * flankForward - rightVec[1] * flankAside;
      placePropSpec(gen, propSet.bossFlankLeft, fx, fz, faceBackYaw - 0.35, { registerSolid: true, doorPad: 3.6, heightScale });
    }
    if (propSet.bossFlankRight) {
      const fx = cx + dirVec[0] * flankForward + rightVec[0] * flankAside;
      const fz = cz + dirVec[1] * flankForward + rightVec[1] * flankAside;
      placePropSpec(gen, propSet.bossFlankRight, fx, fz, faceBackYaw + 0.35, { registerSolid: true, doorPad: 3.6, heightScale });
    }
    if (propSet.bossSanctumNorth) {
      const farAside = isFinalSanctum ? 9.5 : 7.6;
      const farBack = isFinalSanctum ? 14.5 : 10.5;
      const faceDoorYaw = Math.atan2(dirVec[0], dirVec[1]);
      for (const sign of [-1, 1]) {
        const sx = cx - dirVec[0] * farBack + rightVec[0] * farAside * sign;
        const sz = cz - dirVec[1] * farBack + rightVec[1] * farAside * sign;
        placePropSpec(gen, propSet.bossSanctumNorth, sx, sz, faceDoorYaw - sign * 0.4, { registerSolid: true, doorPad: 3.6, heightScale });
      }
    }
    if (propSet.wall && room.w >= 40) {
      const sideDist = isFinalSanctum ? 21.5 : 19.2;
      for (const sign of [-1, 1]) {
        const wx = cx + rightVec[0] * sideDist * sign;
        const wz = cz + rightVec[1] * sideDist * sign;
        const inwardYaw = Math.atan2(-rightVec[0] * sign, -rightVec[1] * sign);
        placePropSpec(gen, propSet.wall, wx, wz, inwardYaw, { registerSolid: true, doorPad: 3.6, heightScale: heightScale * 1.05 });
      }
    }
  }
  return { center: { x: cx, z: cz }, radius: R + 1.5 };
}

// ---------------------------------------------------------------------------------------------
// Puzzle props (individual meshes; they animate / rotate)
// ---------------------------------------------------------------------------------------------
const puzzleMats = {};
function pmat(key, opts) {
  if (!puzzleMats[key]) puzzleMats[key] = markSharedAsset(new THREE.MeshStandardMaterial(opts));
  return puzzleMats[key];
}

export const BELL_PITCHES = ['Deep', 'Low', 'Middle', 'High', 'Apex'];

export function buildBellMesh(pitch = 'Middle') {
  const idx = Math.max(0, BELL_PITCHES.indexOf(pitch));
  const tones = [0x5c3317, 0x8a5a2b, 0xc08a3e, 0xe3c15a, 0xfde047];
  const tone = tones[idx] || 0xc08a3e;
  const wood = pmat('bellWood', { color: 0x5a3b22, roughness: 0.85, metalness: 0.05 });
  const bronze = pmat(`bell${idx}`, { color: tone, roughness: 0.35, metalness: 0.4, emissive: new THREE.Color(tone), emissiveIntensity: 0.25 });
  const g = new THREE.Group();
  g.name = `Bell_${pitch}`;
  const postL = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.9, 0.16), wood); postL.position.set(-0.55, 0.95, 0);
  const postR = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.9, 0.16), wood); postR.position.set(0.55, 0.95, 0);
  const beam = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.14, 0.16), wood); beam.position.set(0, 1.85, 0);
  const swing = new THREE.Group(); swing.position.set(0, 1.78, 0);
  const sz = 0.42 - idx * 0.04;
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.12, sz, 0.62, 12), bronze); body.position.y = -0.4;
  const clap = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), wood); clap.position.y = -0.74;
  swing.add(body, clap);
  g.add(postL, postR, beam, swing);
  let power = 0; let clock = 0;
  g.userData.ring = () => { power = 1; };
  g.userData.animate = (time = 0, dt = 0.016) => {
    clock += dt;
    power = Math.max(0, power - dt * 0.8);
    swing.rotation.z = Math.sin(clock * 13) * power * 0.4;
  };
  return g;
}

export function buildSteleMesh(color = 0x7e9a8c) {
  const stone = pmat(`stele${color}`, { color, roughness: 0.85, metalness: 0.03 });
  const glyph = pmat('steleGlyph', { color: 0xe8c872, roughness: 0.5, emissive: new THREE.Color(0xe8c872), emissiveIntensity: 0.8 });
  const g = new THREE.Group();
  g.name = 'Stele';
  const base = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.25, 0.6), stone); base.position.y = 0.125;
  const slab = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.7, 0.3), stone); slab.position.y = 1.1;
  const cap = new THREE.Mesh(new THREE.ConeGeometry(0.62, 0.35, 4), stone); cap.position.y = 2.1; cap.rotation.y = Math.PI / 4;
  g.add(base, slab, cap);
  for (let i = 0; i < 4; i++) {
    const line = new THREE.Mesh(new THREE.BoxGeometry(0.52 - (i % 2) * 0.14, 0.05, 0.02), glyph);
    line.position.set(0, 1.55 - i * 0.28, 0.16);
    g.add(line);
  }
  return g;
}

export function buildPuzzleStatueMesh(color = 0x8aa497) {
  const stone = pmat(`pst${color}`, { color, roughness: 0.8, metalness: 0.04 });
  const mark = pmat('pstNose', { color: 0xe8c872, roughness: 0.4, metalness: 0.3, emissive: new THREE.Color(0xb8902a), emissiveIntensity: 0.5 });
  const g = new THREE.Group();
  g.name = 'PuzzleStatue';
  const base = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.3, 0.95), stone); base.position.y = 0.15;
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.38, 1.25, 10), stone); body.position.y = 0.92;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.25, 8, 6), stone); head.position.y = 1.75;
  const nose = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 0.34), mark); nose.position.set(0, 1.75, 0.3);
  const arms = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.16, 0.22), stone); arms.position.set(0, 1.35, 0.1);
  g.add(base, body, head, nose, arms);
  return g;
}

export function buildAltarMesh() {
  const stone = pmat('altarStone', { color: 0x6c7a86, roughness: 0.7, metalness: 0.1 });
  const glow = new THREE.MeshBasicMaterial({ color: 0xffd36b });
  const g = new THREE.Group();
  g.name = 'PuzzleAltar';
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.75, 0.8, 10), stone); base.position.y = 0.4;
  const top = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.55, 0.14, 10), stone); top.position.y = 0.87;
  const orb = new THREE.Mesh(new THREE.OctahedronGeometry(0.22, 0), glow); orb.position.y = 1.3;
  g.add(base, top, orb);
  g.userData.animate = (time = 0) => { orb.rotation.y = time * 1.6; orb.position.y = 1.3 + Math.sin(time * 2.4) * 0.06; };
  return g;
}

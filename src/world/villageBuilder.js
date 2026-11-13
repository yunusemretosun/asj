// Oakhaven Caravan Town & Organized Outskirt Hunting Grounds for ARKENVEIL: Sigils & Journeys.
// Pure scene construction + distance-culled ambient life. No game-state imports.
import * as THREE from 'three';
import { HOT_SPRINGS } from '../systems/mechanics.js';
import { loadSROProp, loadSROSprite } from './dungeonDecor.js';
import { createHeroMesh } from '../engine/models3d.js';

const WALL_TILE = 2; // TILE.WALL (kept local to avoid a circular import)

function makeRand(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function angleLerp(a, b, k) {
  let d = ((b - a + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
  return a + d * k;
}

/* ------------------------------------------------------------------ */
/* Static-geometry batcher: merges every primitive into one mesh per    */
/* material so the whole town costs only a handful of draw calls.       */
/* ------------------------------------------------------------------ */
class Batcher {
  constructor() {
    this.buckets = {};
    this.base = new THREE.Matrix4();
    this.yaw = 0;
    this._e = new THREE.Euler();
    this._q = new THREE.Quaternion();
    this._p = new THREE.Vector3();
    this._s = new THREE.Vector3();
    this._l = new THREE.Matrix4();
    this._m = new THREE.Matrix4();
  }

  at(x, z, ry, fn) {
    const prev = this.base;
    const prevYaw = this.yaw;
    this.base = new THREE.Matrix4().makeRotationY(ry);
    this.base.setPosition(x, 0, z);
    this.yaw = ry;
    fn();
    this.base = prev;
    this.yaw = prevYaw;
  }

  world(x, y, z) {
    return new THREE.Vector3(x, y, z).applyMatrix4(this.base);
  }

  add(key, geo, x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
    this._e.set(rx, ry, rz);
    this._q.setFromEuler(this._e);
    this._p.set(x, y, z);
    this._s.set(sx, sy, sz);
    this._l.compose(this._p, this._q, this._s);
    this._m.multiplyMatrices(this.base, this._l);
    geo.applyMatrix4(this._m);
    const pos = geo.getAttribute('position');
    const nor = geo.getAttribute('normal');
    const geoUv = geo.getAttribute('uv');
    const b = (this.buckets[key] ||= { pos: [], nor: [], uv: [], idx: [], count: 0 });
    const useCubicWorldUV = key === 'curb';
    const uvRate = 0.45;
    for (let i = 0; i < pos.count; i++) {
      const px = pos.getX(i), py = pos.getY(i), pz = pos.getZ(i);
      const nx = nor.getX(i), ny = nor.getY(i), nz = nor.getZ(i);
      b.pos.push(px, py, pz);
      b.nor.push(nx, ny, nz);
      if (useCubicWorldUV) {
        const ax = Math.abs(nx), ay = Math.abs(ny), az = Math.abs(nz);
        if (ay >= ax && ay >= az) b.uv.push(px * uvRate, pz * uvRate);
        else if (ax >= az) b.uv.push(pz * uvRate, py * uvRate);
        else b.uv.push(px * uvRate, py * uvRate);
      } else if (geoUv) {
        b.uv.push(geoUv.getX(i), geoUv.getY(i));
      } else {
        b.uv.push(0, 0);
      }
    }
    if (geo.index) {
      for (let i = 0; i < geo.index.count; i++) b.idx.push(geo.index.getX(i) + b.count);
    } else {
      for (let i = 0; i < pos.count; i++) b.idx.push(i + b.count);
    }
    b.count += pos.count;
    geo.dispose();
  }

  box(k, w, h, d, x, y, z, ry = 0, rx = 0, rz = 0) {
    this.add(k, new THREE.BoxGeometry(w, h, d), x, y, z, rx, ry, rz);
  }
  cyl(k, rt, rb, h, x, y, z, seg = 8, rx = 0, rz = 0) {
    this.add(k, new THREE.CylinderGeometry(rt, rb, h, seg), x, y, z, rx, 0, rz);
  }
  cone(k, r, h, x, y, z, seg = 8, rx = 0, rz = 0) {
    this.add(k, new THREE.ConeGeometry(r, h, seg), x, y, z, rx, 0, rz);
  }
  sph(k, r, x, y, z, sx = 1, sy = 1, sz = 1, seg = 8) {
    this.add(k, new THREE.SphereGeometry(r, seg, Math.max(4, seg - 2)), x, y, z, 0, 0, 0, sx, sy, sz);
  }
  tor(k, R, r, x, y, z, rx = 0, ry = 0, rz = 0) {
    this.add(k, new THREE.TorusGeometry(R, r, 6, 14), x, y, z, rx, ry, rz);
  }
  // Tapered box; y is the BASE of the frustum.
  frust(k, wb, db, wt, dt, h, x, y, z) {
    const g = new THREE.BoxGeometry(1, 1, 1);
    const p = g.getAttribute('position');
    for (let i = 0; i < p.count; i++) {
      const top = p.getY(i) > 0;
      p.setXYZ(i, p.getX(i) * (top ? wt : wb), p.getY(i) * h + h * 0.5, p.getZ(i) * (top ? dt : db));
    }
    g.computeVertexNormals();
    this.add(k, g, x, y, z);
  }

  // Upswept tiled roof: flared eave tier + steeper tiers + upturned corner cones.
  roof(k, w, d, y, over = 1.8, ridge = true) {
    const W = w + over, D = d + over;
    this.frust(k, W, D, w + over * 0.35, d + over * 0.35, 0.28, 0, y, 0);
    this.frust(k, w + over * 0.35, d + over * 0.35, w * 0.72, d * 0.72, 0.55, 0, y + 0.28, 0);
    this.frust(k, w * 0.72, d * 0.72, Math.max(0.4, w * 0.26), Math.max(0.4, d * 0.26), 0.85, 0, y + 0.83, 0);
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        this.cone(k, 0.2, 0.85, sx * (W / 2 - 0.05), y + 0.38, sz * (D / 2 - 0.05), 6, sz * 0.7, -sx * 0.7);
      }
    }
    if (ridge) {
      this.box('gold', Math.max(0.6, w * 0.45), 0.18, 0.34, 0, y + 1.74, 0);
      for (const s of [-1, 1]) this.cone('gold', 0.14, 0.5, s * Math.max(0.3, w * 0.225 + 0.1), y + 1.95, 0, 6);
    }
    return y + 1.74;
  }

  // Draped string with hang points for lanterns.
  string(x1, y1, z1, x2, y2, z2, sag, segs, hangs, every = 1) {
    let px = x1, py = y1, pz = z1;
    for (let i = 1; i <= segs; i++) {
      const u = i / segs;
      const x = x1 + (x2 - x1) * u, z = z1 + (z2 - z1) * u;
      const y = y1 + (y2 - y1) * u - sag * 4 * u * (1 - u);
      const len = Math.hypot(x - px, y - py, z - pz);
      const hx = Math.hypot(x - px, z - pz);
      this._lineSeg('dark', px, py, pz, x, y, z, len, hx);
      if (i < segs && i % every === 0) hangs.push([x, y - 0.05, z, i * 0.9 + x * 0.37]);
      px = x; py = y; pz = z;
    }
  }
  _lineSeg(k, ax, ay, az, bx, by, bz, len, hx) {
    const ry = Math.atan2(bx - ax, bz - az);
    const rx = -Math.atan2(by - ay, hx);
    this.add(k, new THREE.BoxGeometry(0.035, 0.035, len), (ax + bx) / 2, (ay + by) / 2, (az + bz) / 2, rx, ry, 0);
  }

  build(mats, group) {
    const noShadowKeys = new Set(['glow', 'dark', 'curb', 'gold', 'sack', 'fruitO', 'fruitG', 'cloth1', 'cloth2', 'leafG', 'reed']);
    for (const [key, b] of Object.entries(this.buckets)) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(b.pos, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(b.nor, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(b.uv, 2));
      g.setIndex(new THREE.Uint32BufferAttribute(b.idx, 1));
      g.computeBoundingSphere();
      const mesh = new THREE.Mesh(g, mats[key]);
      mesh.name = `Village_${key}`;
      mesh.castShadow = !noShadowKeys.has(key);
      mesh.receiveShadow = true;
      group.add(mesh);
    }
  }
}

function mergeParts(parts, mat) {
  const sb = new Batcher();
  for (const p of parts) sb.add('x', ...p);
  const b = sb.buckets.x;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(b.pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(b.nor, 3));
  g.setIndex(new THREE.Uint32BufferAttribute(b.idx, 1));
  g.computeBoundingSphere();
  return new THREE.Mesh(g, mat);
}

/* ------------------------------------------------------------------ */
/* Cached PBR textures + world-scale UV & winding stream builders     */
/* ------------------------------------------------------------------ */
const _villageTexCache = new Map();
let _villageTexLoader = null;

function loadVillageTex(url, isColor = true) {
  if (typeof window === 'undefined' || typeof document === 'undefined') return null;
  const key = `${url}|${isColor ? 'srgb' : 'lin'}`;
  if (_villageTexCache.has(key)) return _villageTexCache.get(key);
  if (!_villageTexLoader) _villageTexLoader = new THREE.TextureLoader();
  const tex = _villageTexLoader.load(url);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = isColor ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  tex.anisotropy = 4;
  tex.userData = { ...(tex.userData || {}), isCachedVillageTex: true };
  _villageTexCache.set(key, tex);
  return tex;
}

/** Scales existing BoxGeometry/PlaneGeometry UVs cleanly to uniform world-space tiles/meter. */
function scaleGroundUVs(geo, sx, sz, rate = 0.22) {
  const uv = geo.getAttribute('uv');
  const nor = geo.getAttribute('normal');
  if (!uv) return geo;
  for (let i = 0; i < uv.count; i++) {
    const ny = nor ? Math.abs(nor.getY(i)) : 1;
    if (ny > 0.5) {
      uv.setXY(i, uv.getX(i) * sx * rate, uv.getY(i) * sz * rate);
    } else {
      uv.setXY(i, uv.getX(i) * Math.max(sx, sz) * 0.14, uv.getY(i) * 0.2);
    }
  }
  uv.needsUpdate = true;
  return geo;
}

/** Projects planar world-scale UVs onto circular plazas & custom floor pads. */
function applyPlanarXZUVs(geo, rate = 0.22) {
  const pos = geo.getAttribute('position');
  const uv = geo.getAttribute('uv');
  if (!pos || !uv) return geo;
  for (let i = 0; i < pos.count; i++) {
    uv.setXY(i, pos.getX(i) * rate + 0.5, pos.getZ(i) * rate + 0.5);
  }
  uv.needsUpdate = true;
  return geo;
}

function clamp01(v) {
  return v < 0 ? 0 : (v > 1 ? 1 : v);
}

function smoothstep(edge0, edge1, x) {
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

function hash2D(ix, iz) {
  let n = Math.imul(ix, 374761393) + Math.imul(iz, 668265263);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
}

function valueNoise2D(x, z) {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fz = z - iz;
  const u = fx * fx * (3 - 2 * fx);
  const v = fz * fz * (3 - 2 * fz);
  const a = hash2D(ix, iz);
  const b = hash2D(ix + 1, iz);
  const c = hash2D(ix, iz + 1);
  const d = hash2D(ix + 1, iz + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

function fbm2D(x, z) {
  return (
    valueNoise2D(x, z) * 0.6 +
    valueNoise2D(x * 2.07 + 13.7, z * 2.07 - 5.3) * 0.28 +
    valueNoise2D(x * 4.31 - 9.1, z * 4.31 + 17.2) * 0.12
  );
}

/** Evaluates meandering cardinal outskirt trail weight with wheel-rut modulation. */
function evalWindingTrailWeight(x, z, n) {
  const roadNoise = (n - 0.5) * 1.4;
  let dist = Infinity;
  let endFade = 0;

  // North highway (outside north gate)
  if (z < -56 && z > -122 && Math.abs(x) < 16) {
    const t = clamp01((-56 - z) / 60);
    const center = Math.sin(t * Math.PI * 2.1) * 2.4 * smoothstep(0, 0.22, t);
    dist = Math.abs(x - center);
    endFade = smoothstep(-56.0, -58.5, z) * smoothstep(-122.0, -115.0, z);
  }
  // South highway (outside south bridge at z=60)
  if (z > 62.5 && z < 123 && Math.abs(x) < 16) {
    const t = clamp01((z - 62.5) / 58);
    const center = Math.sin(t * Math.PI * 1.9 + 0.3) * 2.5 * smoothstep(0, 0.22, t);
    const d = Math.abs(x - center);
    if (d < dist) {
      dist = d;
      endFade = smoothstep(62.5, 64.5, z) * smoothstep(123.0, 117.0, z);
    }
  }
  // West highway (outside west gate)
  if (x < -56 && x > -122 && Math.abs(z) < 16) {
    const t = clamp01((-56 - x) / 60);
    const center = Math.sin(t * Math.PI * 1.8 - 0.4) * 2.3 * smoothstep(0, 0.22, t);
    const d = Math.abs(z - center);
    if (d < dist) {
      dist = d;
      endFade = smoothstep(-56.0, -58.5, x) * smoothstep(-122.0, -115.0, x);
    }
  }
  // East highway (outside east bridge at x=60.5)
  if (x > 63.0 && x < 123 && Math.abs(z) < 16) {
    const t = clamp01((x - 63.0) / 58);
    const center = Math.sin(t * Math.PI * 2.0 + 0.5) * 2.2 * smoothstep(0, 0.22, t);
    const d = Math.abs(z - center);
    if (d < dist) {
      dist = d;
      endFade = smoothstep(63.0, 65.0, x) * smoothstep(123.0, 117.0, x);
    }
  }

  if (!Number.isFinite(dist) || endFade <= 0) return 0;
  const edge = 3.2 + roadNoise;
  const body = 1.0 - smoothstep(1.9, edge, dist);
  // Dual wagon wheel ruts around |offset| ~= 1.05m with lighter grassy median
  const rutProfile = 0.72 + 0.28 * Math.exp(-Math.pow((dist - 1.05) / 0.42, 2));
  return clamp01(body * rutProfile * endFade);
}

/** Builds a 256x256 RGBA terrain splat DataTexture (R=road, G=camp, B=pebble, A=city mask). */
function buildVillageSplatTexture(span, halfWall, camps, riverDistSq) {
  const size = 256;
  const data = new Uint8Array(size * size * 4);
  const halfSpan = span * 0.5;
  for (let py = 0; py < size; py++) {
    const wz = ((py + 0.5) / size - 0.5) * span;
    for (let px = 0; px < size; px++) {
      const wx = ((px + 0.5) / size - 0.5) * span;
      const n = fbm2D(wx * 0.09, wz * 0.09);
      const nFine = fbm2D(wx * 0.21 + 31.1, wz * 0.21 - 19.4);

      const cityDist = Math.max(Math.abs(wx), Math.abs(wz));
      const cityMask = 1.0 - smoothstep(halfWall - 0.6, halfWall + 0.8, cityDist);

      const rDist = Math.sqrt(riverDistSq(wx, wz));
      const pebbleW = (1.0 - smoothstep(2.4, 5.4 + (n - 0.5) * 2.2, rDist)) * (1.0 - cityMask);

      let campW = 0;
      if (cityMask < 0.5 && rDist > 3.6) {
        for (let c = 0; c < camps.length; c++) {
          const ctr = camps[c].center;
          const dc = Math.hypot(wx - ctr.x, wz - ctr.z);
          if (dc > 12.0) continue;
          const innerR = 4.8 + (nFine - 0.5) * 1.8;
          const outerR = 9.8 + (n - 0.5) * 2.6;
          const w = (1.0 - smoothstep(innerR, outerR, dc)) * smoothstep(3.6, 5.4, rDist);
          if (w > campW) campW = w;
        }
      }

      const roadW = cityMask < 0.5 ? evalWindingTrailWeight(wx, wz, n) * (1.0 - pebbleW * 0.75) : 0;

      const idx = (py * size + px) * 4;
      data[idx + 0] = Math.round(clamp01(roadW) * 255);
      data[idx + 1] = Math.round(clamp01(campW) * 255);
      data[idx + 2] = Math.round(clamp01(pebbleW) * 255);
      data[idx + 3] = Math.round(clamp01(cityMask) * 255);
    }
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearFilter;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.colorSpace = THREE.NoColorSpace;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  tex.userData = { span, halfSpan, isVillageSplat: true };
  return tex;
}

/** Merges multiple ground BoxGeometry/CylinderGeometry parts per material into single BufferGeometries. */
function createGroundBatcher() {
  const buckets = new Map();
  const pushGeo = (key, mat, geo, x = 0, y = 0, z = 0) => {
    geo.translate(x, y, z);
    const pos = geo.getAttribute('position');
    const nor = geo.getAttribute('normal');
    const uv = geo.getAttribute('uv');
    let b = buckets.get(key);
    if (!b) {
      b = { mat, name: key, pos: [], nor: [], uv: [], idx: [], count: 0 };
      buckets.set(key, b);
    }
    for (let i = 0; i < pos.count; i++) {
      b.pos.push(pos.getX(i), pos.getY(i), pos.getZ(i));
      b.nor.push(nor.getX(i), nor.getY(i), nor.getZ(i));
      b.uv.push(uv ? uv.getX(i) : 0, uv ? uv.getY(i) : 0);
    }
    if (geo.index) {
      for (let i = 0; i < geo.index.count; i++) b.idx.push(geo.index.getX(i) + b.count);
    } else {
      for (let i = 0; i < pos.count; i++) b.idx.push(i + b.count);
    }
    b.count += pos.count;
    geo.dispose();
  };
  const build = (group) => {
    const meshes = [];
    for (const b of buckets.values()) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(b.pos, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(b.nor, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(b.uv, 2));
      g.setIndex(new THREE.Uint32BufferAttribute(b.idx, 1));
      g.computeBoundingSphere();
      const mesh = new THREE.Mesh(g, b.mat);
      mesh.name = b.name;
      mesh.castShadow = false;
      mesh.receiveShadow = true;
      group.add(mesh);
      meshes.push(mesh);
    }
    return meshes;
  };
  return { pushGeo, build };
}

/** Builds a smooth undulating ribbon BufferGeometry along a CatmullRomCurve3. */
function buildStreamGeometry(curve, segments = 150, width = 4.2, yLevel = 0.044, centerDip = 0) {
  const hw = width * 0.5;
  const pts = curve.getSpacedPoints(segments);
  const cols = 3; // left bank, stream center (allows optional bowl dip), right bank
  const positions = [];
  const normals = [];
  const uvs = [];
  const indices = [];
  let accumLen = 0;

  for (let i = 0; i <= segments; i++) {
    const p = pts[i];
    if (i > 0) accumLen += p.distanceTo(pts[i - 1]);
    const t = i / segments;
    const tangent = curve.getTangentAt(Math.min(1, Math.max(0, t))).setY(0).normalize();
    const rx = -tangent.z;
    const rz = tangent.x;
    const vCoord = accumLen * 0.22;

    for (let c = 0; c < cols; c++) {
      const s = c === 0 ? -1 : (c === 1 ? 0 : 1);
      const y = c === 1 ? yLevel + centerDip : yLevel;
      positions.push(p.x + rx * hw * s, y, p.z + rz * hw * s);
      normals.push(0, 1, 0);
      uvs.push(c * 0.5, vCoord);
    }
    if (i < segments) {
      const row = i * cols;
      const next = (i + 1) * cols;
      // Left half
      indices.push(row + 0, next + 0, row + 1);
      indices.push(row + 1, next + 0, next + 1);
      // Right half
      indices.push(row + 1, next + 1, row + 2);
      indices.push(row + 2, next + 1, next + 2);
    }
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(indices);
  g.computeVertexNormals();
  g.computeBoundingSphere();
  return g;
}

/* ------------------------------------------------------------------ */
export function buildVillage(ctx = {}) {
  const {
    grid,
    tileSize = 2,
    originX = -140,
    originZ = -140,
    gridWidth = 140,
    gridHeight = 140,
    createNPCMesh = null,
    addLight = null
  } = ctx;

  const rand = makeRand(1337);
  const group = new THREE.Group();
  group.name = 'JanganMetropolis';
  const S = new Batcher();
  const obstacles = [];
  const blockedTiles = [];
  const buildingRects = [];
  const outskirtClearZones = [];
  const hangs = [];
  const awnings = [];
  const banners = [];
  const chimneys = [];
  const lights = [];

  const HALF = 55;
  const GATE_GAP = 5.2;
  const WORLD_BOUND = 122;

  // Helper builds dense Lv 1-10 outskirt hunting packs from anchor + local offsets
  const packCamp = (id, name, level, minLevel, maxLevel, respawnSeconds, center, entries) => ({
    id,
    name,
    level,
    minLevel,
    maxLevel,
    respawnSeconds,
    center,
    spawns: entries.map(([type, dx, dz, lvl, isElite = false]) => ({
      type,
      x: Number((center.x + dx).toFixed(1)),
      z: Number((center.z + dz).toFixed(1)),
      level: lvl,
      ...(isElite ? { isElite: true } : {})
    }))
  });

  // 16 dense Lv 1-10 Hunting Grounds circling Oakhaven walls (156 spawn slots, rapid respawns)
  const outskirtCamps = [
    packCamp('camp_south_gate_meadow', 'Oakhaven West Meadow', 1, 1, 2, 6.5, { x: -24, z: 72 }, [
      ['mangyang', -10, -8, 1], ['mangyang', -3, -6, 1], ['mangyang', 4, -8, 1],
      ['small_eye_ghost', -12, 0, 1], ['mangyang', -4, 2, 1], ['small_eye_ghost', 5, 1, 2],
      ['bigeye_ghost', 10, -5, 2], ['mangyang', -9, 9, 2], ['small_eye_ghost', 1, 9, 2],
      ['bigeye_ghost', 9, 8, 2]
    ]),
    packCamp('camp_south_east_pasture', 'Oakhaven East Meadow', 2, 1, 3, 7, { x: 24, z: 72 }, [
      ['mangyang', -10, -8, 1], ['bigeye_ghost', -3, -7, 2], ['mangyang', 5, -7, 2],
      ['small_eye_ghost', -11, 1, 2], ['bigeye_ghost', -2, 2, 2], ['small_eye_ghost', 7, 1, 2],
      ['old_weasel', 12, -3, 3], ['mangyang', -8, 9, 2], ['bigeye_ghost', 2, 9, 2],
      ['old_weasel', 10, 9, 3]
    ]),
    packCamp('camp_far_south_pasture', 'Southern Caravan Downs', 2, 2, 3, 7, { x: -24, z: 98 }, [
      ['mangyang', -11, -7, 2], ['small_eye_ghost', -3, -8, 2], ['bigeye_ghost', 6, -7, 2],
      ['old_weasel', -12, 1, 2], ['small_eye_ghost', -4, 2, 2], ['bigeye_ghost', 5, 2, 3],
      ['old_weasel', 11, 0, 3], ['gyo_weasel', -7, 8, 3], ['bigeye_ghost', 2, 8, 3],
      ['gyo_weasel', 10, 8, 3]
    ]),
    packCamp('camp_sw_weasel_orchard', 'Westwatch Outpost', 3, 2, 4, 7.5, { x: -64, z: 72 }, [
      ['old_weasel', -12, -9, 2], ['old_weasel', -3, -10, 3], ['gyo_weasel', 6, -9, 3],
      ['bigeye_ghost', 13, -7, 3], ['gyo_weasel', -10, 0, 3], ['old_weasel', -1, 1, 3],
      ['gyo_weasel', 8, 0, 4], ['old_weasel', -13, 9, 3], ['gyo_weasel', -3, 10, 4],
      ['gyo_weasel', 6, 11, 4, true]
    ]),
    packCamp('camp_far_sw_weasel_ridge', 'Highridge Timberline', 4, 3, 4, 7.5, { x: -94, z: 86 }, [
      ['old_weasel', -10, -8, 3], ['gyo_weasel', -2, -9, 3], ['gyo_weasel', 7, -8, 4],
      ['water_ghost_slave', -11, 1, 3], ['old_weasel', -2, 1, 4], ['gyo_weasel', 7, 1, 4],
      ['gyo_weasel', -8, 10, 4], ['water_ghost', 1, 10, 4], ['gyo_weasel', 9, 10, 4, true]
    ]),
    packCamp('camp_west_water_marsh', 'Westbrook Canal North', 4, 3, 5, 8, { x: -80, z: -24 }, [
      ['water_ghost_slave', -12, -8, 3], ['water_ghost_slave', -3, -10, 4], ['water_ghost', 7, -9, 4],
      ['decayed_yeoha', 14, -7, 4], ['water_ghost', -14, 1, 4], ['water_ghost_slave', -4, 2, 4],
      ['water_ghost', 6, 1, 5], ['decayed_yeoha', -10, 10, 4], ['water_ghost', 0, 11, 5],
      ['water_ghost', 10, 11, 5, true]
    ]),
    packCamp('camp_west_water_marsh_s', 'Westbrook Canal South', 5, 4, 5, 8, { x: -80, z: 24 }, [
      ['water_ghost_slave', -13, -10, 4], ['water_ghost', -3, -11, 4], ['decayed_yeoha', 7, -10, 4],
      ['water_ghost', -14, -1, 4], ['water_ghost_slave', -4, 0, 4], ['yeoha', 7, -1, 5],
      ['water_ghost', -11, 9, 5], ['yeoha', -2, 10, 5], ['water_ghost', 8, 9, 5],
      ['yeoha', 14, 5, 5]
    ]),
    packCamp('camp_east_ferry_yeoha', 'Shadowfen Mire', 5, 4, 6, 8, { x: 80, z: -24 }, [
      ['decayed_yeoha', -13, -9, 4], ['yeoha', -3, -10, 5], ['yeoha', 7, -9, 5],
      ['chakji_worker', 15, -7, 5], ['water_ghost', -14, 1, 5], ['decayed_yeoha', -4, 1, 5],
      ['yeoha', 6, 1, 5], ['chakji_worker', -11, 10, 5], ['yeoha', -1, 11, 6],
      ['chakji_worker', 9, 10, 6]
    ]),
    packCamp('camp_east_ferry_chakji', 'Amberpool Marsh', 6, 5, 6, 8, { x: 80, z: 24 }, [
      ['yeoha', -14, -10, 5], ['chakji_worker', -4, -11, 5], ['yeoha', 6, -10, 5],
      ['water_ghost', -13, 0, 5], ['chakji_worker', -3, 1, 5], ['chakji_worker', 7, 0, 6],
      ['chakji_worker', 15, 2, 6], ['yeoha', -10, 10, 6], ['chakji_worker', 1, 11, 6],
      ['chakji_worker', 11, 10, 6, true]
    ]),
    packCamp('camp_nw_stone_ruins', 'Old Kingsway Ruins', 6, 5, 7, 8.5, { x: -64, z: -72 }, [
      ['broken_stone_ghost', -12, -9, 5], ['broken_stone_ghost', -2, -10, 5], ['stone_ghost', 7, -9, 6],
      ['tombstone', -13, 0, 6], ['stone_ghost', -3, 0, 6], ['tombstone_ghost', 7, -1, 6],
      ['decayed_yeoha', -12, 9, 5], ['yeoha', -2, 10, 6], ['stone_ghost', 7, 10, 7],
      ['tombstone_ghost', 14, 7, 7, true]
    ]),
    packCamp('camp_far_nw_tombstones', 'Old Kingsway Watchpost', 7, 6, 7, 8.5, { x: -94, z: -88 }, [
      ['broken_stone_ghost', -10, -9, 6], ['stone_ghost', -1, -9, 6], ['tombstone', 8, -8, 6],
      ['tombstone_ghost', -11, 0, 6], ['stone_ghost', -2, 1, 7], ['tombstone_ghost', 8, 1, 7],
      ['yeoha', -9, 9, 6], ['stone_ghost', 0, 10, 7], ['tombstone_ghost', 9, 10, 7]
    ]),
    packCamp('camp_se_bandit_camp', 'Ironwood Foothills', 7, 6, 8, 8.5, { x: 66, z: 72 }, [
      ['bandit_subordinate', -12, -9, 6], ['bandit_subordinate', -3, -10, 6], ['bandit', 7, -9, 7],
      ['bandit_archer', -12, 0, 7], ['bandit_bowman', -2, 1, 7], ['bandit', 8, 0, 7],
      ['bandit_archer', -10, 10, 8], ['bandit_bowman', 0, 10, 8], ['bandit', 10, 9, 8, true],
      ['bandit_archer', 14, -2, 7]
    ]),
    packCamp('camp_far_se_bandits', 'Eastgate Bandit Camp', 8, 7, 8, 8.5, { x: 96, z: 88 }, [
      ['bandit_subordinate', -11, -8, 7], ['bandit', -2, -9, 7], ['bandit_archer', 7, -8, 7],
      ['bandit', -12, 1, 8], ['bandit_bowman', -2, 1, 8], ['bandit_archer', 8, 1, 8],
      ['bandit', -9, 9, 8], ['bandit_bowman', 1, 10, 8], ['bandit', 10, 9, 8, true],
      ['bandit_archer', -16, -3, 7]
    ]),
    packCamp('camp_ne_bandit_stronghold', 'Northwatch Tiger Woods', 8, 7, 9, 9, { x: 74, z: -72 }, [
      ['bandit_archer', -12, -9, 7], ['bandit_bowman', -2, -10, 8], ['young_tiger', 8, -9, 7],
      ['tiger', -11, 0, 8], ['black_tiger', -1, 0, 8], ['chakji_worker', 9, 0, 7],
      ['tiger', -8, 9, 9], ['black_tiger', 2, 10, 9, true], ['bandit_archer', 12, 8, 8],
      ['bandit_bowman', -18, -3, 8]
    ]),
    packCamp('camp_north_west_tigers', 'Silverfang Glade', 9, 8, 10, 9.5, { x: -24, z: -84 }, [
      ['young_tiger', -12, -8, 8], ['tiger', -2, -9, 8], ['black_tiger', 8, -8, 9],
      ['tombstone_ghost', -13, 2, 8], ['black_tiger', -3, 2, 9], ['white_tiger', 7, 2, 9],
      ['tiger', -9, 12, 9], ['white_tiger', 1, 12, 10], ['white_tiger', 10, 12, 10, true]
    ]),
    packCamp('camp_north_tiger_hill', 'Moonclaw Clearing', 9, 8, 10, 9.5, { x: 24, z: -84 }, [
      ['stone_ghost', -11, -9, 8], ['tiger', -1, -9, 9], ['white_tiger', 9, -8, 9],
      ['tombstone_ghost', -12, 2, 9], ['tiger', -2, 2, 9], ['black_tiger', 8, 2, 9],
      ['white_tiger', -8, 12, 10], ['white_tiger', 2, 12, 10], ['white_tiger', 11, 10, 10, true]
    ])
  ];

  for (const camp of outskirtCamps) {
    for (const sp of camp.spawns) {
      outskirtClearZones.push({ x: sp.x, z: sp.z, radius: 2.6 });
    }
  }

  /* ---------------- NPC & Portal anchor positions (well spaced, roads/exits crystal clear!) ---------------- */
  const PAG = { x: 22, z: -26 };
  const spawnPoint = { x: 0, y: 0, z: 7.5 };
  const portalPos = { x: 9.0, y: 0, z: -33.0 };
  const selectorPos = { x: -38.0, y: 0, z: -10.0 };
  const arenaPortalPos = { x: 38.0, y: 0, z: -10.0 };
  const storageChestSpots = {
    village_starter_chest: { x: -7.2, z: 23.2 },
    village_north_vault: { x: -6.5, z: -31.5 }
  };

  const npcSpots = {
    chief: { x: -9.5, z: -34.5, rotationY: 0.45 },
    composer: { x: 18.0, z: -20.5, rotationY: -Math.PI * 0.65 },
    blacksmith: { x: -16.5, z: 14.5, rotationY: Math.PI * 0.45 },
    merchant: { x: 16.5, z: 14.5, rotationY: -Math.PI * 0.45 },
    trainer: { x: -19.5, z: 32.0, rotationY: Math.PI * 0.65 },
    storage: { x: -9.5, z: 22.0, rotationY: 0.25 },
    pet_merchant: { x: -34.5, z: 26.5, rotationY: 0.45 },
    accessory_trader: { x: 21.5, z: 28.5, rotationY: -0.55 },
    hunter_master: { x: 29.0, z: -10.5, rotationY: -Math.PI * 0.5 }
  };

  const protectedZones = [
    portalPos,
    selectorPos,
    arenaPortalPos,
    spawnPoint,
    { x: HOT_SPRINGS.center.x, z: HOT_SPRINGS.center.z, r: HOT_SPRINGS.radius + 2.8 },
    ...Object.values(storageChestSpots).map((s) => ({ x: s.x, z: s.z, r: 2.2 })),
    ...Object.values(npcSpots).map((n) => ({ x: n.x, z: n.z, r: 2.4 }))
  ];

  /* ---------------- classic Silk-Road materials ---------------- */
  const std = (c, r = 0.85, m = 0.05, extra = {}) =>
    new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m, ...extra });
  const pbrGroundMat = (color, diffUrl, norUrl, roughness = 0.88, metalness = 0.04, norStrength = 0.8, extra = {}) => {
    const map = diffUrl ? loadVillageTex(diffUrl, true) : null;
    const normalMap = norUrl ? loadVillageTex(norUrl, false) : null;
    return new THREE.MeshStandardMaterial({
      color,
      roughness,
      metalness,
      ...(map ? { map } : {}),
      ...(normalMap ? { normalMap, normalScale: new THREE.Vector2(norStrength, norStrength) } : {}),
      ...extra
    });
  };
  const M = {
    sand: std(0xd8c9a8, 0.88),
    wood: std(0x6b3e26, 0.82),
    red: std(0xa82820, 0.72),
    teal: std(0x2d6b68, 0.58, 0.14),
    terra: std(0xb34f34, 0.68),
    stone: std(0x7c7b74, 0.9),
    curb: pbrGroundMat(0x5b6068, '/assets/sro/env/rok_stone_02.png', '/assets/textures/village/plaza_stone_nor.jpg', 0.78, 0.10, 0.55),
    gold: std(0xd9a841, 0.35, 0.65),
    dark: std(0x26262a, 0.75, 0.35),
    sack: std(0xc2ab82, 0.92),
    cloth1: std(0xc4483e, 0.85),
    cloth2: std(0x2f7d82, 0.85),
    fruitO: std(0xe07828, 0.65),
    fruitG: std(0x6fa442, 0.65),
    leafG: std(0x6f993e, 0.85),
    reed: std(0x6e873e, 0.88),
    camel: std(0xb89464, 0.88),
    horse: std(0x6b4630, 0.85),
    glow: new THREE.MeshBasicMaterial({ color: 0xffc266 })
  };

  const grassMat = pbrGroundMat(0xc3d6b0, '/assets/textures/village/grass_diff.jpg', '/assets/textures/village/grass_nor.jpg', 0.93, 0.02, 0.55);
  const splatRoadTex = loadVillageTex('/assets/textures/village/outskirt_road_diff.jpg', true);
  const splatCampTex = loadVillageTex('/assets/sro/env/c_dust_fld_01.png', true);
  const splatPebbleTex = loadVillageTex('/assets/textures/village/river_pebbles_diff.jpg', true);
  const townStoneMat = pbrGroundMat(0xd6cebf, '/assets/sro/env/c_marble_jang_01.png', '/assets/textures/village/plaza_stone_nor.jpg', 0.86, 0.04, 0.65);
  const roadMat = pbrGroundMat(0xcbc2b2, '/assets/textures/village/cobble_road_diff.jpg', '/assets/textures/village/cobble_road_nor.jpg', 0.85, 0.04, 0.85, {
    polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1
  });
  const pebbleMat = pbrGroundMat(0xcac0ae, '/assets/textures/village/river_pebbles_diff.jpg', '/assets/textures/village/river_pebbles_nor.jpg', 0.92, 0.04, 0.95);

  const waterMat = std(0x38bdf8, 0.15, 0.4, { emissive: new THREE.Color(0x0284c7), emissiveIntensity: 0.55 });
  const pondMat = std(0x2f8f9a, 0.2, 0.3, { transparent: true, opacity: 0.88, emissive: new THREE.Color(0x0e4b55), emissiveIntensity: 0.35 });
  const streamTexNor = loadVillageTex('/assets/textures/village/water_nor.jpg', false);
  const streamMat = std(0x30aab9, 0.12, 0.26, {
    ...(streamTexNor ? { normalMap: streamTexNor, normalScale: new THREE.Vector2(0.45, 0.45) } : {}),
    emissive: new THREE.Color(0x0b5868),
    emissiveIntensity: 0.26,
    transparent: true,
    opacity: 0.84
  });
  const lanternMat = std(0xd62a1a, 0.5, 0.0, { emissive: new THREE.Color(0xff3a10), emissiveIntensity: 1.1 });
  const flameMat = new THREE.MeshBasicMaterial({ color: 0xff8a2a, transparent: true, opacity: 0.9 });
  const coalMat = std(0x401008, 0.6, 0.0, { emissive: new THREE.Color(0xff4410), emissiveIntensity: 1.4 });
  const pigeonMat = std(0x8f97a6, 0.8);
  const bannerMats = [std(0xb3261e, 0.8), std(0x2a7f84, 0.8), std(0xd4a437, 0.6, 0.3)];
  for (const m of bannerMats) m.side = THREE.DoubleSide;

  /* ---------------- winding outskirt river spline & spatial helpers ---------------- */
  const riverCtrlPts = [
    new THREE.Vector3(45.5, 0, -124),
    new THREE.Vector3(44.5, 0, -96),
    new THREE.Vector3(47.0, 0, -72),
    new THREE.Vector3(53.5, 0, -61.5),
    new THREE.Vector3(60.5, 0, -51.5),
    new THREE.Vector3(60.5, 0, -24.0),
    new THREE.Vector3(60.5, 0, 0.0),
    new THREE.Vector3(60.5, 0, 24.0),
    new THREE.Vector3(60.5, 0, 48.0),
    new THREE.Vector3(59.2, 0, 57.6),
    new THREE.Vector3(53.5, 0, 58.8),
    new THREE.Vector3(44.0, 0, 59.5),
    new THREE.Vector3(24.0, 0, 60.0),
    new THREE.Vector3(0.0, 0, 60.0),
    new THREE.Vector3(-24.0, 0, 60.0),
    new THREE.Vector3(-48.0, 0, 59.8),
    new THREE.Vector3(-60.8, 0, 56.8),
    new THREE.Vector3(-73.0, 0, 48.5),
    new THREE.Vector3(-93.0, 0, 49.0),
    new THREE.Vector3(-126.0, 0, 47.5)
  ];
  const riverCurve = new THREE.CatmullRomCurve3(riverCtrlPts);
  const riverSamples = riverCurve.getSpacedPoints(180);
  const riverDistSq = (x, z) => {
    let best = Infinity;
    for (let i = 0; i < riverSamples.length; i++) {
      const dx = x - riverSamples[i].x;
      const dz = z - riverSamples[i].z;
      const d2 = dx * dx + dz * dz;
      if (d2 < best) best = d2;
    }
    return best;
  };
  const nearRiver = (x, z, pad = 3.2) => riverDistSq(x, z) < pad * pad;

  /* ---------------- collision & fast grid marking helpers ---------------- */
  const blockRect = (x0, z0, x1, z1) => {
    buildingRects.push({ x0, z0, x1, z1 });
    if (!grid) return;
    const gxMin = Math.max(0, Math.floor((x0 - 0.85 - originX) / tileSize));
    const gxMax = Math.min(gridWidth - 1, Math.ceil((x1 + 0.85 - originX) / tileSize));
    const gzMin = Math.max(0, Math.floor((z0 - 0.85 - originZ) / tileSize));
    const gzMax = Math.min(gridHeight - 1, Math.ceil((z1 + 0.85 - originZ) / tileSize));
    for (let gz = gzMin; gz <= gzMax; gz++) {
      for (let gx = gxMin; gx <= gxMax; gx++) {
        const cx = originX + (gx + 0.5) * tileSize;
        const cz = originZ + (gz + 0.5) * tileSize;
        if (cx > x0 - 0.85 && cx < x1 + 0.85 && cz > z0 - 0.85 && cz < z1 + 0.85) {
          if (grid[gz][gx] !== WALL_TILE) blockedTiles.push({ gx, gz });
          grid[gz][gx] = WALL_TILE;
        }
      }
    }
  };

  // Mark outer cliff boundary beyond WORLD_BOUND (±122m) as unwalkable walls
  if (grid) {
    for (let gz = 0; gz < gridHeight; gz++) {
      for (let gx = 0; gx < gridWidth; gx++) {
        const cx = originX + (gx + 0.5) * tileSize;
        const cz = originZ + (gz + 0.5) * tileSize;
        if (Math.abs(cx) > WORLD_BOUND || Math.abs(cz) > WORLD_BOUND) {
          if (grid[gz][gx] !== WALL_TILE) blockedTiles.push({ gx, gz });
          grid[gz][gx] = WALL_TILE;
        }
      }
    }
  }

  const obs = (x, z, radius) => obstacles.push({ x, z, radius });
  const gateClearZones = [
    { x: 0, z: -HALF, r: 9.5 },
    { x: 0, z: HALF, r: 9.5 },
    { x: -HALF, z: 0, r: 9.5 },
    { x: HALF, z: 0, r: 9.5 },
    { x: 0, z: 60.0, r: 7.5 },
    { x: 60.5, z: 0, r: 7.5 },
    { x: 0, z: -112, r: 9.5 },
    { x: 0, z: 112, r: 9.5 },
    { x: -112, z: 0, r: 9.5 },
    { x: 112, z: 0, r: 9.5 }
  ];
  const canPlaceVillage = (x, z, r = 1.0) => {
    // Keep all 4 cardinal avenues & gate approaches unobstructed inside and out
    if (Math.abs(x) < 6.4 || Math.abs(z) < 6.4) return false;
    if (nearRiver(x, z, 2.8 + r)) return false;
    for (const gz of gateClearZones) {
      if (Math.hypot(x - gz.x, z - gz.z) < gz.r + r) return false;
    }
    // Keep perimeter wall corridor & gates clear
    if ((Math.abs(Math.abs(x) - HALF) < 3.0 && Math.abs(z) <= HALF + 3.2) ||
        (Math.abs(Math.abs(z) - HALF) < 3.0 && Math.abs(x) <= HALF + 3.2)) {
      return false;
    }
    for (const pz of protectedZones) {
      if (Math.hypot(x - pz.x, z - pz.z) < (pz.r || 3.4) + r) return false;
    }
    for (const o of obstacles) {
      if (Math.hypot(x - o.x, z - o.z) < (o.radius || 0.6) + r + 0.45) return false;
    }
    for (const b of buildingRects) {
      if (x > b.x0 - r - 0.6 && x < b.x1 + r + 0.6 && z > b.z0 - r - 0.6 && z < b.z1 + r + 0.6) return false;
    }
    for (const sp of outskirtClearZones) {
      if (Math.hypot(x - sp.x, z - sp.z) < sp.radius + r) return false;
    }
    return true;
  };

  /* ---------------- ground, plazas, carved stone boulevards & outskirt river ---------------- */
  const worldW = gridWidth * tileSize;
  const worldH = gridHeight * tileSize;
  const terrainSpan = worldW + 70;
  const splatTex = buildVillageSplatTexture(terrainSpan, HALF, outskirtCamps, riverDistSq);
  grassMat.userData = { ...(grassMat.userData || {}), splatTex, isVillageGrassSplat: true };
  if (grassMat.map && splatRoadTex && splatCampTex && splatPebbleTex) {
    grassMat.color.setHex(0xffffff);
    grassMat.customProgramCacheKey = () => 'village_splat_v1';
    grassMat.onBeforeCompile = (shader) => {
      shader.uniforms.uSplatMap = { value: splatTex };
      shader.uniforms.uRoadTex = { value: splatRoadTex };
      shader.uniforms.uCampTex = { value: splatCampTex };
      shader.uniforms.uPebbleTex = { value: splatPebbleTex };
      shader.uniforms.uSplatSpan = { value: terrainSpan };
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec2 vVillageXZ;')
        .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvVillageXZ = (modelMatrix * vec4(transformed, 1.0)).xz;');
      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>
varying vec2 vVillageXZ;
uniform sampler2D uSplatMap;
uniform sampler2D uRoadTex;
uniform sampler2D uCampTex;
uniform sampler2D uPebbleTex;
uniform float uSplatSpan;`
        )
        .replace(
          '#include <map_fragment>',
          `vec2 splatUv = clamp(vVillageXZ / uSplatSpan + 0.5, 0.0, 1.0);
vec4 splat = texture2D(uSplatMap, splatUv);
vec3 grassCol = texture2D(map, vVillageXZ * 0.14).rgb * vec3(0.84, 0.92, 0.78);
float macroGrass = 0.92 + 0.08 * sin(vVillageXZ.x * 0.055) * cos(vVillageXZ.y * 0.055);
grassCol *= macroGrass;
vec3 roadCol = texture2D(uRoadTex, vVillageXZ * 0.22).rgb * vec3(0.86, 0.78, 0.68);
vec3 campCol = texture2D(uCampTex, vVillageXZ * 0.20).rgb * vec3(0.88, 0.80, 0.70);
vec3 pebbleCol = texture2D(uPebbleTex, vVillageXZ * 0.24).rgb * vec3(0.85, 0.81, 0.75);
vec3 terrainRgb = mix(grassCol, campCol, splat.g * 0.88);
terrainRgb = mix(terrainRgb, roadCol, splat.r * 0.94);
terrainRgb = mix(terrainRgb, pebbleCol, splat.b * 0.92);
terrainRgb = mix(terrainRgb, terrainRgb * 0.72, splat.a * 0.85);
diffuseColor.rgb *= terrainRgb;`
        );
    };
  }

  const grassGeo = new THREE.PlaneGeometry(terrainSpan, worldH + 70);
  grassGeo.rotateX(-Math.PI / 2);
  applyPlanarXZUVs(grassGeo, 0.14);
  const grass = new THREE.Mesh(grassGeo, grassMat);
  grass.name = 'VillageTerrain';
  grass.receiveShadow = true;
  group.add(grass);

  const groundBatch = createGroundBatcher();
  const addBoxGround = (bucketKey, mat, w, h, d, x, y, z, rate = 0.24) => {
    const geo = applyPlanarXZUVs(new THREE.BoxGeometry(w, h, d), rate);
    groundBatch.pushGeo(bucketKey, mat, geo, x, y, z);
  };

  // Full walled city floor (only 2 city ground types: non-road stone base at yTop=0.018 + non-overlapping roads at yTop=0.032)
  addBoxGround('VillageGround_base', townStoneMat, HALF * 2 + 1, 0.018, HALF * 2 + 1, 0, 0.009, 0, 0.20);

  // Cobblestone boulevards & district roads (strictly non-overlapping, zero extra pads/plazas/strips intruding on roads)
  addBoxGround('VillageGround_road', roadMat, 7.4, 0.018, HALF * 2, 0, 0.023, 0, 0.26);               // Full Internal N-S Avenue (x in [-3.7..3.7])
  addBoxGround('VillageGround_road', roadMat, HALF - 3.7, 0.018, 7.0, -(HALF + 3.7) * 0.5, 0.023, 0, 0.26); // Internal West Avenue ([-55..-3.7])
  addBoxGround('VillageGround_road', roadMat, HALF - 3.7, 0.018, 7.0, (HALF + 3.7) * 0.5, 0.023, 0, 0.26);  // Internal East Avenue ([3.7..55])

  // District connector roads flush-joined to N-S avenue with zero overlap
  addBoxGround('VillageGround_road', roadMat, 36.3, 0.018, 4.6, -21.85, 0.023, 15, 0.26);
  addBoxGround('VillageGround_road', roadMat, 36.3, 0.018, 4.6, 21.85, 0.023, 15, 0.26);
  addBoxGround('VillageGround_road', roadMat, 12, 0.018, 18, 22, 0.023, -24, 0.26);                // NE Pagoda Approach
  addBoxGround('VillageGround_road', roadMat, 16, 0.018, 4.4, -22, 0.023, -24, 0.26);              // NW Scholar Archive Walkway

  // Carved avenue stone curbs strictly outside road edges and clear of connector road mouths
  for (const segZ of [-47.5, -13.0, 29.0, 45.5]) {
    const len = Math.abs(segZ) > 35 ? 7.5 : 8.5;
    for (const sx of [-3.9, 3.9]) S.box('curb', 0.38, 0.14, len, sx, 0.08, segZ);
  }
  for (const segX of [-45.5, -21.5, 21.5, 45.5]) {
    for (const sz of [-3.7, 3.7]) S.box('curb', 8.5, 0.14, 0.38, segX, 0.08, sz);
  }

  /* ---------------- Winding Outskirt Stream (Emerald Brook), Waterfall Cliffs & Bridges ---------------- */
  const riverBedMesh = new THREE.Mesh(buildStreamGeometry(riverCurve, 150, 6.8, 0.018, -0.026), pebbleMat);
  riverBedMesh.name = 'OutskirtRiverBed';
  riverBedMesh.receiveShadow = true;
  group.add(riverBedMesh);

  const riverWaterMesh = new THREE.Mesh(buildStreamGeometry(riverCurve, 150, 4.05, 0.036, 0), streamMat);
  riverWaterMesh.name = 'OutskirtRiverWater';
  riverWaterMesh.receiveShadow = true;
  group.add(riverWaterMesh);

  // North-East Foothill Waterfall Spring Rock Cascade (45.5, -122)
  S.at(45.5, -122.0, 0.2, () => {
    S.sph('stone', 2.4, -2.5, 0.9, -1.2, 1.3, 0.9, 1.1, 7);
    S.sph('stone', 2.2, 2.4, 0.8, -1.4, 1.2, 0.85, 1.15, 7);
    S.sph('stone', 1.8, 0.2, 1.8, -2.5, 1.4, 1.1, 0.9, 7);
    S.sph('curb', 1.4, -1.3, 0.5, 0.8, 1.1, 0.7, 1.0, 7);
    S.sph('curb', 1.3, 1.4, 0.45, 0.9, 1.0, 0.65, 1.0, 7);
  });
  const springFoam = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 3.0, 0.04, 16), waterMat);
  springFoam.position.set(45.5, 0.042, -121.0);
  group.add(springFoam);
  obs(45.5, -122.5, 2.4);

  // Grand South Gate Imperial Stone Bridge (flush walk deck at (0, 60.0), carved parapets outside road)
  addBoxGround('VillageGround_road', roadMat, 6.8, 0.056, 6.8, 0, 0.052, 60.0, 0.26);
  S.at(0, 60.0, Math.PI / 2, () => {
    for (const sz of [-3.68, 3.68]) {
      S.box('stone', 7.0, 0.24, 0.36, 0, 0.14, sz);
      for (const px of [-3.2, 0, 3.2]) {
        const crest = px === 0 ? 0.12 : 0;
        S.box('curb', 0.46, 0.76 + crest, 0.46, px, 0.38 + crest * 0.5, sz);
        S.sph('gold', 0.15, px, 0.82 + crest, sz);
        const wp = S.world(px, 0, sz);
        obs(wp.x, wp.z, 0.38);
      }
      S.box('gold', 6.6, 0.1, 0.18, 0, 0.56, sz);
    }
  });

  // East Outer Caravan Timber & Stone Bridge at (60.5, 0)
  addBoxGround('VillageGround_road', roadMat, 6.8, 0.056, 6.4, 60.5, 0.052, 0, 0.26);
  groundBatch.build(group);
  S.at(60.5, 0, 0, () => {
    for (const sx of [-1, 1]) S.box('stone', 0.85, 0.12, 6.8, sx * 3.55, 0.06, 0);
    for (let i = -3; i <= 3; i++) {
      S.box('wood', 0.78, 0.05, 6.2, i * 0.88, 0.062, 0);
    }
    for (const sz of [-3.38, 3.38]) {
      for (const px of [-3.1, 0, 3.1]) {
        const crest = px === 0 ? 0.1 : 0;
        S.box('red', 0.24, 0.82 + crest, 0.24, px, 0.41 + crest * 0.5, sz);
        S.sph('gold', 0.13, px, 0.88 + crest, sz);
        const wp = S.world(px, 0, sz);
        obs(wp.x, wp.z, 0.34);
      }
      S.box('red', 6.4, 0.12, 0.14, 0, 0.78, sz);
    }
  });

  // Scenic Shallow Stepping-Stone Creek Fords (South-West Meadow & West Foothills — non-blocking)
  for (const [fx, fz, yaw, count] of [[-36.0, 59.8, 0.08, 4], [-86.0, 48.8, -0.05, 4]]) {
    for (let i = 0; i < count; i++) {
      const offset = (i - (count - 1) * 0.5) * 1.15;
      S.box('curb', 1.55, 0.06, 0.92, fx + Math.sin(yaw) * offset, 0.03, fz + Math.cos(yaw) * offset, yaw + (i % 2 ? 0.1 : -0.08));
    }
  }

  /* ---------------- lotus pond + classic East arched timber bridge ---------------- */
  const POND = { x: 18.0, z: -7.5, r: 2.6 };
  const pond = new THREE.Mesh(new THREE.CylinderGeometry(POND.r, POND.r, 0.06, 24), pondMat);
  pond.position.set(POND.x, 0.05, POND.z);
  group.add(pond);
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    S.sph('stone', 0.36 + rand() * 0.14, POND.x + Math.cos(a) * (POND.r + 0.15), 0.1, POND.z + Math.sin(a) * (POND.r + 0.15), 1, 0.7, 1, 6);
  }
  for (const [lx, lz] of [[-0.8, 0.5], [0.7, -0.6], [0.2, 1.1], [-1.1, -0.9]]) {
    S.cyl('leafG', 0.34, 0.34, 0.02, POND.x + lx, 0.095, POND.z + lz, 8);
  }
  obs(POND.x, POND.z, POND.r + 0.1);
  [
    [17.4, 0.115, -7.8, 1.05],
    [18.8, 0.115, -6.9, 0.95],
    [17.9, 0.115, -8.3, 0.9]
  ].forEach(([fx, fy, fz, size]) => {
    loadSROSprite('/assets/sro/sprites/c_pondflower-28ab3d2d@1x.png', {
      width: size, height: size, position: [fx, fy, fz], isFlat: true, parent: group
    });
  });

  // East Koi Garden Stream + Clean Classic Arched Lacquer Timber Bridge
  const CANAL = { x: 42.0, z: 22.0, w: 5.6, d: 13.6 };
  const canalWater = new THREE.Mesh(new THREE.BoxGeometry(CANAL.w, 0.08, CANAL.d), pondMat);
  canalWater.position.set(CANAL.x, 0.05, CANAL.z);
  group.add(canalWater);
  // Stone channel embankment on left & right banks + collision north/south of bridge walkway
  S.box('stone', 0.45, 0.25, CANAL.d, CANAL.x - CANAL.w * 0.5 - 0.15, 0.12, CANAL.z);
  S.box('stone', 0.45, 0.25, CANAL.d, CANAL.x + CANAL.w * 0.5 + 0.15, 0.12, CANAL.z);
  blockRect(CANAL.x - CANAL.w * 0.5, CANAL.z - CANAL.d * 0.5, CANAL.x + CANAL.w * 0.5, CANAL.z - 2.3);
  blockRect(CANAL.x - CANAL.w * 0.5, CANAL.z + 2.3, CANAL.x + CANAL.w * 0.5, CANAL.z + CANAL.d * 0.5);
  S.at(CANAL.x, CANAL.z, 0, () => {
    for (const sx of [-1, 1]) S.box('stone', 0.9, 0.28, 3.8, sx * 3.1, 0.14, 0);
    // Gently arched wooden deck spans [-2.8..+2.8]
    const segs = 7;
    const span = 6.2;
    for (let i = 0; i < segs; i++) {
      const u = (i + 0.5) / segs * 2 - 1;
      const px = u * (span / 2);
      const py = 0.24 + (1 - u * u) * 0.42;
      const slope = -2 * u * 0.42 / (span / 2);
      const tilt = Math.atan(slope);
      S.box('wood', span / segs + 0.08, 0.14, 3.4, px, py, 0, 0, 0, tilt);
    }
    for (const sz of [-1.58, 1.58]) {
      for (const px of [-2.9, 0, 2.9]) {
        const u = px / (span / 2);
        const py = 0.24 + (1 - u * u) * 0.42;
        S.box('red', 0.2, 0.95, 0.2, px, py + 0.48, sz);
        S.sph('gold', 0.12, px, py + 1.0, sz);
      }
      S.box('red', 5.8, 0.12, 0.14, 0, 1.02, sz);
    }
  });

  /* ---------------- perimeter walls (HALF = 55) + 4 open gates ---------------- */
  const wallRun = (x, z, len, alongX) => {
    if (alongX) {
      S.box('sand', len, 3.0, 1.4, x, 1.5, z);
      S.box('teal', len, 0.24, 1.9, x, 3.1, z);
      S.box('red', len, 0.14, 1.6, x, 2.65, z);
      blockRect(x - len / 2, z - 0.85, x + len / 2, z + 0.85);
    } else {
      S.box('sand', 1.4, 3.0, len, x, 1.5, z);
      S.box('teal', 1.9, 0.24, len, x, 3.1, z);
      S.box('red', 1.6, 0.14, len, x, 2.65, z);
      blockRect(x - 0.85, z - len / 2, x + 0.85, z + len / 2);
    }
  };
  const segLen = HALF - GATE_GAP;
  const segMid = (HALF + GATE_GAP) / 2;
  wallRun(-segMid, -HALF, segLen, true);
  wallRun(segMid, -HALF, segLen, true);
  wallRun(-segMid, HALF, segLen, true);
  wallRun(segMid, HALF, segLen, true);
  wallRun(-HALF, -segMid, segLen, false);
  wallRun(-HALF, segMid, segLen, false);
  wallRun(HALF, -segMid, segLen, false);
  wallRun(HALF, segMid, segLen, false);

  for (let i = -HALF; i <= HALF; i += 10) {
    for (const [px, pz] of [[i, -HALF], [i, HALF], [-HALF, i], [HALF, i]]) {
      if ((Math.abs(px) < GATE_GAP + 0.8 && Math.abs(pz) === HALF) || (Math.abs(pz) < GATE_GAP + 0.8 && Math.abs(px) === HALF)) continue;
      const isCorner = Math.abs(px) === HALF && Math.abs(pz) === HALF;
      S.box('red', isCorner ? 1.6 : 0.75, isCorner ? 4.2 : 3.4, isCorner ? 1.6 : 0.75, px, isCorner ? 2.1 : 1.7, pz);
      S.sph('gold', isCorner ? 0.34 : 0.24, px, isCorner ? 4.35 : 3.55, pz);
    }
  }

  /* ---------------- classic paifang arches + Dragon South Gate ---------------- */
  const paifang = (cx, cz, span, h, ry = 0) => {
    S.at(cx, cz, ry, () => {
      const hs = span / 2;
      for (const sx of [-1, 1]) {
        S.box('stone', 0.95, 0.5, 0.95, sx * hs, 0.25, 0);
        S.cyl('red', 0.3, 0.32, h, sx * hs, h / 2 + 0.5, 0, 10);
        S.cyl('gold', 0.38, 0.38, 0.18, sx * hs, h + 0.55, 0, 10);
        S.box('stone', 0.5, 0.35, 0.5, sx * (hs + 0.9), 0.18, 0);
        S.box('red', 0.5, h * 0.55, 0.5, sx * (hs + 0.9), h * 0.275 + 0.35, 0);
        const wp = S.world(sx * hs, 0, 0);
        obs(wp.x, wp.z, 0.5);
      }
      const N = 8;
      let prev = null;
      for (let i = 0; i <= N; i++) {
        const u = (i / N) * 2 - 1;
        const p = [u * hs, h - 0.3 + 0.55 * (1 - u * u), 0];
        if (prev) {
          const dx = p[0] - prev[0], dy = p[1] - prev[1];
          S.box('red', Math.hypot(dx, dy) + 0.05, 0.38, 0.45, (p[0] + prev[0]) / 2, (p[1] + prev[1]) / 2, 0, 0, 0, Math.atan2(dy, dx));
          S.box('gold', Math.hypot(dx, dy) + 0.05, 0.08, 0.5, (p[0] + prev[0]) / 2, (p[1] + prev[1]) / 2 + 0.23, 0, 0, 0, Math.atan2(dy, dx));
        }
        prev = p;
      }
      S.box('gold', 2.0, 0.62, 0.12, 0, h + 0.1, 0.26);
      S.box('red', 1.7, 0.4, 0.14, 0, h + 0.1, 0.27);
      S.roof('teal', 2.6, 0.72, h + 0.55, 1.0);
      for (const [lx, ly, ph] of [[-hs * 0.45, h - 0.15, 0.3], [hs * 0.45, h - 0.15, 1.9], [0, h + 0.25, 3.3]]) {
        const wl = S.world(lx, ly, 0.1);
        hangs.push([wl.x, wl.y, wl.z, ph]);
      }
    });
  };
  paifang(0, -24.0, 9.2, 4.3, 0);               // Inner road to North Palace Quarter
  paifang(0, -54.2, 9.6, 4.5, 0);               // North Wall Gate Arch
  paifang(0, 54.2, 9.8, 4.7, 0);                // Open South Wall Gate Arch (unobstructed!)
  paifang(-54.2, 0, 9.4, 4.3, Math.PI / 2);     // West Wall Gate Arch
  paifang(54.2, 0, 9.4, 4.3, -Math.PI / 2);     // East Wall Gate Arch

  // Reserve portal pads cleanly away from road & gate mouths
  obs(portalPos.x, portalPos.z, 1.25);
  obs(selectorPos.x, selectorPos.z, 1.25);
  obs(arenaPortalPos.x, arenaPortalPos.z, 1.25);

  /* ---------------- classic Silk-Road district architecture (Batcher) ---------------- */
  const building = (cx, cz, w, d, h, ry, roofKey, opts = {}) => {
    S.at(cx, cz, ry, () => {
      S.box('stone', w + 0.4, 0.4, d + 0.4, 0, 0.2, 0);
      S.frust('sand', w, d, w - 0.25, d - 0.25, h, 0, 0.4, 0);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) S.box('wood', 0.32, h, 0.32, sx * w / 2, 0.4 + h / 2, sz * d / 2);
      S.box('wood', w + 0.15, 0.3, d + 0.15, 0, h + 0.25, 0);
      S.box('wood', w + 0.1, 0.18, d + 0.1, 0, 1.3, 0);
      // door + latticed windows (front = +z)
      S.box('wood', 1.5, 2.2, 0.18, 0, 1.5, d / 2 + 0.06);
      S.box('red', 1.2, 2.0, 0.2, 0, 1.45, d / 2 + 0.09);
      S.sph('gold', 0.08, 0.35, 1.4, d / 2 + 0.22);
      for (const sx of [-1, 1]) {
        S.box('wood', 1.0, 1.0, 0.16, sx * w * 0.3, 2.1, d / 2 + 0.05);
        S.box('dark', 0.8, 0.8, 0.18, sx * w * 0.3, 2.1, d / 2 + 0.07);
        S.box('gold', 0.8, 0.05, 0.2, sx * w * 0.3, 2.1, d / 2 + 0.08);
        S.box('gold', 0.05, 0.8, 0.2, sx * w * 0.3, 2.1, d / 2 + 0.08);
        hangs.push([...S.world(sx * (w / 2 - 0.5), h + 0.1, d / 2 + 0.55).toArray(), sx * 2 + 0.5]);
      }
      S.roof(roofKey, w, d, h + 0.55, 1.8);
      if (opts.plaque) {
        S.box('gold', 2.2, 0.5, 0.1, 0, h + 0.1, d / 2 + 0.22);
        S.box('red', 1.9, 0.35, 0.12, 0, h + 0.1, d / 2 + 0.24);
      }
      if (opts.chimney) {
        const cxl = w * 0.3, czl = -d * 0.15;
        S.box('stone', 0.75, 2.5, 0.75, cxl, h + 1.0, czl);
        S.box('dark', 0.9, 0.15, 0.9, cxl, h + 2.3, czl);
        chimneys.push(S.world(cxl, h + 2.45, czl));
      }
    });
    const swap = Math.abs(Math.sin(ry)) > 0.7;
    const hw = (swap ? d : w) / 2 + 0.2, hd = (swap ? w : d) / 2 + 0.2;
    blockRect(cx - hw + 0.2, cz - hd + 0.2, cx + hw - 0.2, cz + hd - 0.2);
  };

  // North Palace Quarter
  building(-14.5, -42.0, 8.2, 6.0, 3.8, 0, 'teal', { plaque: true });            // Chief's Hall
  building(15.5, -42.0, 7.6, 5.8, 3.6, 0, 'terra', { chimney: true });            // North Guard Manor
  building(-34.0, -34.0, 7.2, 5.8, 3.4, Math.PI * 0.25, 'terra', { chimney: true }); // Scholar Archive
  building(37.0, -39.0, 7.0, 5.8, 3.4, -Math.PI * 0.25, 'teal', { plaque: true }); // East Imperial Annex

  // West Temple & East Coliseum Framing Halls (kept clear of both district portals)
  building(-47.0, -24.0, 6.6, 6.6, 3.6, Math.PI * 0.35, 'teal', { plaque: true });
  building(47.0, -24.0, 6.6, 6.6, 3.6, -Math.PI * 0.35, 'terra', { plaque: true });

  // South-West Forge, Stables & Martial Barracks Quarter
  building(-29.0, 18.0, 6.8, 6.0, 3.4, Math.PI / 2, 'terra', { chimney: true });
  building(-39.0, 38.0, 7.6, 6.0, 3.4, 0.25, 'teal', { chimney: true });
  building(-45.5, 18.0, 6.8, 6.0, 3.2, Math.PI / 2, 'terra', { chimney: false });

  // South-East Alchemist, Accessory & Merchant Quarter
  building(28.0, 14.0, 7.0, 6.0, 3.4, -Math.PI / 2, 'teal', { chimney: true });
  building(30.0, 36.0, 7.0, 6.0, 3.4, Math.PI, 'terra', { chimney: true });
  building(44.0, 40.0, 6.8, 6.0, 3.2, -Math.PI * 0.75, 'teal', { chimney: false });

  // South Caravan Inn & Quartermaster Storehouse
  building(-13.5, 42.5, 7.8, 5.8, 3.4, Math.PI, 'teal', { chimney: false });
  building(13.5, 42.5, 7.8, 5.8, 3.4, Math.PI, 'terra', { chimney: true });

  /* ---------------- Jade Mist Hot Springs sanctuary ---------------- */
  const hotSpringMat = new THREE.MeshStandardMaterial({
    color: 0x2dd4bf,
    emissive: new THREE.Color(0x0d9488),
    emissiveIntensity: 0.82,
    roughness: 0.18,
    metalness: 0.2,
    transparent: true,
    opacity: 0.82
  });
  const hotSpringMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(HOT_SPRINGS.radius, HOT_SPRINGS.radius, 0.18, 24),
    hotSpringMat
  );
  hotSpringMesh.name = 'JadeMistHotSprings';
  hotSpringMesh.position.set(HOT_SPRINGS.center.x, 0.09, HOT_SPRINGS.center.z);
  hotSpringMesh.receiveShadow = true;
  group.add(hotSpringMesh);

  for (let i = 0; i < 20; i++) {
    const a = (i / 20) * Math.PI * 2;
    if (a > 0.45 && a < 1.15) continue;
    const sx = HOT_SPRINGS.center.x + Math.cos(a) * (HOT_SPRINGS.radius + 0.18);
    const sz = HOT_SPRINGS.center.z + Math.sin(a) * (HOT_SPRINGS.radius + 0.18);
    S.sph('stone', 0.44 + rand() * 0.16, sx, 0.14, sz, 1.15, 0.65, 1.15, 7);
    if (i % 2 === 0) S.sph('leafG', 0.3, sx + (rand() - 0.5) * 0.1, 0.23, sz + (rand() - 0.5) * 0.1, 1.0, 0.32, 1.0, 6);
  }
  const deckBaseX = HOT_SPRINGS.center.x + (HOT_SPRINGS.radius - 0.3) * Math.cos(0.8);
  const deckBaseZ = HOT_SPRINGS.center.z + (HOT_SPRINGS.radius - 0.3) * Math.sin(0.8);
  S.box('wood', 3.4, 0.12, 1.6, deckBaseX + 0.8, 0.06, deckBaseZ + 0.8, -Math.PI / 4);
  [
    [-17.2, 0.215, -15.0, 1.2], [-14.5, 0.215, -13.2, 1.1],
    [-16.0, 0.215, -12.2, 1.25], [-18.0, 0.215, -13.6, 1.05]
  ].forEach(([fx, fy, fz, size]) => {
    loadSROSprite('/assets/sro/sprites/c_pondflower-28ab3d2d@1x.png', {
      width: size, height: size, position: [fx, fy, fz], isFlat: true, parent: group
    });
  });

  [
    { x: -12.0, z: -20.5, ry: 0.3 },
    { x: -16.5, z: -20.5, ry: -0.4 },
    { x: -8.5, z: 36.0, ry: 0.6 }
  ].forEach(({ x, z, ry }) => {
    loadSROProp('/assets/sro/props/cj_table01.glb', { scale: 0.72, targetHeight: 0.78, position: [x, 0, z], rotationY: ry, autoGround: true, parent: group });
    obs(x, z, 0.9);
  });

  /* ---------------- classic 3-tier NE Scholar Pagoda ---------------- */
  S.at(PAG.x, PAG.z, 0, () => {
    S.box('stone', 5.8, 0.4, 5.8, 0, 0.2, 0);
    S.box('stone', 6.4, 0.2, 6.4, 0, 0.1, 0);
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        S.cyl('red', 0.28, 0.3, 2.8, sx * 2, 1.8, sz * 2, 8);
        S.cyl('gold', 0.34, 0.34, 0.12, sx * 2, 0.46, sz * 2, 8);
        obs(PAG.x + sx * 2, PAG.z + sz * 2, 0.45);
      }
    }
    S.box('wood', 4.6, 0.3, 4.6, 0, 3.3, 0);
    S.roof('teal', 4.2, 4.2, 3.45, 2.2, false);
    S.box('sand', 3.2, 1.5, 3.2, 0, 5.3, 0);
    for (const s of [-1, 1]) { S.box('red', 0.3, 1.5, 0.3, s * 1.6, 5.3, 1.6); S.box('red', 0.3, 1.5, 0.3, s * 1.6, 5.3, -1.6); }
    S.box('dark', 1.0, 0.8, 0.1, 0, 5.3, 1.62);
    S.roof('terra', 3.2, 3.2, 6.05, 1.9, false);
    S.box('sand', 2.2, 1.3, 2.2, 0, 7.8, 0);
    S.box('dark', 0.8, 0.7, 0.1, 0, 7.8, 1.12);
    S.roof('teal', 2.2, 2.2, 8.45, 1.7, false);
    S.cyl('gold', 0.1, 0.12, 1.8, 0, 10.3, 0, 8);
    for (let i = 0; i < 4; i++) S.tor('gold', 0.34 - i * 0.05, 0.05, 0, 9.7 + i * 0.35, 0, Math.PI / 2);
    S.sph('gold', 0.18, 0, 11.3, 0);
  });
  hangs.push([PAG.x - 2.4, 3.1, PAG.z + 2.6, 0.2], [PAG.x + 2.4, 3.1, PAG.z + 2.6, 2.1], [PAG.x - 2.4, 3.1, PAG.z - 2.6, 4.2], [PAG.x + 2.4, 3.1, PAG.z - 2.6, 1.3]);

  loadSROProp('/assets/sro/props/cj3_lion01.glb', { targetHeight: 1.88, position: [PAG.x - 1.8, 0, PAG.z + 2.5], rotationY: 0, autoGround: true, parent: group });
  loadSROProp('/assets/sro/props/cj3_lion01.glb', { targetHeight: 1.88, position: [PAG.x + 1.8, 0, PAG.z + 2.5], rotationY: 0, autoGround: true, parent: group });
  loadSROProp('/assets/sro/props/cj_lamp01.glb', { scale: 0.55, targetHeight: 3.37, position: [PAG.x - 2.6, 0, PAG.z + 3.8], rotationY: 0, autoGround: true, parent: group });
  loadSROProp('/assets/sro/props/cj_lamp01.glb', { scale: 0.55, targetHeight: 3.37, position: [PAG.x + 2.6, 0, PAG.z + 3.8], rotationY: 0, autoGround: true, parent: group });
  obs(PAG.x - 1.8, PAG.z + 2.5, 0.6); obs(PAG.x + 1.8, PAG.z + 2.5, 0.6);
  obs(PAG.x - 2.6, PAG.z + 3.8, 0.4); obs(PAG.x + 2.6, PAG.z + 3.8, 0.4);

  /* ---------------- central Imperial Fountain ---------------- */
  S.cyl('stone', 2.2, 2.4, 0.5, 0, 0.25, 0, 12);
  S.tor('gold', 2.15, 0.1, 0, 0.52, 0, Math.PI / 2);
  S.cyl('stone', 0.28, 0.42, 1.3, 0, 1.15, 0, 8);
  S.cyl('stone', 0.8, 0.4, 0.22, 0, 1.55, 0, 10);
  S.sph('gold', 0.14, 0, 1.75, 0);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    S.cone('teal', 0.28, 0.5, Math.cos(a) * 2.2, 0.8, Math.sin(a) * 2.2, 4);
    S.cyl('red', 0.1, 0.12, 0.6, Math.cos(a) * 2.2, 0.55, Math.sin(a) * 2.2, 6);
  }
  const fountain = new THREE.Group();
  fountain.name = 'VillageFountain';
  const fWater = new THREE.Mesh(new THREE.CylinderGeometry(1.85, 1.85, 0.08, 20), waterMat);
  fWater.position.y = 0.48;
  const fCrystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.38, 0), waterMat);
  fCrystal.position.y = 2.05;
  fountain.add(fWater, fCrystal);
  fountain.userData.crystal = fCrystal;
  group.add(fountain);
  obs(0, 0, 2.4);

  /* ---------------- Forge & Plaza Brazier ---------------- */
  const BR = { x: 7.5, z: -7.5 };
  S.cyl('dark', 0.55, 0.35, 0.35, BR.x, 0.95, BR.z, 10);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    S.cyl('dark', 0.05, 0.05, 0.95, BR.x + Math.cos(a) * 0.3, 0.45, BR.z + Math.sin(a) * 0.3, 5);
  }
  S.tor('gold', 0.55, 0.04, BR.x, 1.12, BR.z, Math.PI / 2);
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.34, 0.8, 7), flameMat);
  flame.position.set(BR.x, 1.5, BR.z);
  group.add(flame);
  obs(BR.x, BR.z, 0.6);

  const FORGE = { x: -20.5, z: 18.0 };
  S.box('stone', 1.6, 0.7, 1.4, FORGE.x, 0.35, FORGE.z);
  S.box('stone', 1.6, 0.9, 0.3, FORGE.x - 0.55, 1.15, FORGE.z);
  const coal = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.1, 1.0), coalMat);
  coal.position.set(FORGE.x + 0.05, 0.72, FORGE.z);
  group.add(coal);
  S.cyl('wood', 0.28, 0.32, 0.55, FORGE.x + 0.1, 0.28, FORGE.z + 1.6, 8);
  S.box('dark', 0.7, 0.18, 0.28, FORGE.x + 0.1, 0.65, FORGE.z + 1.6);
  S.box('dark', 0.3, 0.15, 0.22, FORGE.x + 0.55, 0.64, FORGE.z + 1.6);
  S.box('wood', 0.5, 0.35, 0.9, FORGE.x + 1.4, 0.2, FORGE.z - 0.6, 0.3);
  S.box('dark', 0.5, 0.6, 0.1, FORGE.x - 0.9, 0.5, FORGE.z + 0.9, 0.4, -0.3);
  obs(FORGE.x, FORGE.z, 0.95);
  obs(FORGE.x + 0.1, FORGE.z + 1.6, 0.45);

  // Feed village focal lights as pooled light sources (never unpooled PointLights)
  lights.push({ pos: [FORGE.x, 1.6, FORGE.z], color: 0xff7a2a, i: 2.2, d: 13, f: true });
  lights.push({ pos: [BR.x, 1.9, BR.z], color: 0xffa040, i: 2.0, d: 13, f: true });

  /* ---------------- classic South Market stalls, props & caravan animals ---------------- */
  const stall = (x, z, awnIdx, goods) => {
    loadSROProp('/assets/sro/props/cj_streetstall.glb', {
      scale: 0.42,
      targetHeight: 2.42,
      rotationY: Math.PI,
      autoGround: true,
      position: [x, 0, z],
      parent: group
    });
    S.at(x, z, Math.PI, () => {
      const w = 3.2;
      if (typeof window === 'undefined') {
        S.box('wood', w, 0.15, 2.6, 0, 0.08, 0);
        S.box('wood', w, 1.0, 0.7, 0, 0.6, 1.0);
        S.box('red', w + 0.1, 0.12, 0.8, 0, 1.12, 1.0);
      }
      if (goods === 'fruit') {
        for (let i = 0; i < 6; i++) S.sph(i % 2 ? 'fruitO' : 'fruitG', 0.17, -1.1 + i * 0.4, 1.2, 1.0, 1, 1, 1, 6);
      } else if (goods === 'cloth') {
        S.box('cloth1', 0.9, 0.25, 0.6, -0.9, 1.2, 1.0);
        S.box('cloth2', 0.9, 0.25, 0.6, 0.0, 1.2, 1.0);
        S.box('gold', 0.9, 0.25, 0.6, 0.9, 1.2, 1.0);
      } else if (goods === 'potion') {
        for (let i = 0; i < 6; i++) S.cyl(i % 2 ? 'teal' : 'red', 0.1, 0.12, 0.3, -1.1 + i * 0.44, 1.2, 1.0, 6);
      }
      hangs.push([...S.world(-w / 2 + 0.3, 2.4, 2.0).toArray(), awnIdx], [...S.world(w / 2 - 0.3, 2.4, 2.0).toArray(), awnIdx + 2]);
    });
    obs(x - 1.0, z, 0.65); obs(x + 1.0, z, 0.65);
  };
  stall(-16.0, 26.0, 0, 'fruit');
  stall(-9.5, 26.5, 1, 'goods');
  stall(9.5, 26.5, 2, 'cloth');
  stall(16.0, 26.0, 3, 'potion');

  const crates = (x, z, n = 3, ry = 0) => {
    S.at(x, z, ry, () => {
      S.box('wood', 0.9, 0.8, 0.9, 0, 0.4, 0);
      S.box('wood', 0.8, 0.7, 0.8, 0.95, 0.35, 0.1, 0.2);
      if (n > 2) S.box('wood', 0.7, 0.6, 0.7, 0.3, 1.1, 0.05, 0.5);
      S.box('dark', 0.94, 0.06, 0.94, 0, 0.55, 0);
    });
    obs(x + 0.4, z, 0.9);
  };
  const barrels = (x, z, n = 2) => {
    for (let i = 0; i < n; i++) {
      const bx = x + (i % 2) * 0.75, bz = z + Math.floor(i / 2) * 0.7;
      S.cyl('wood', 0.34, 0.3, 0.85, bx, 0.43, bz, 10);
      S.tor('dark', 0.33, 0.025, bx, 0.25, bz, Math.PI / 2);
      S.tor('dark', 0.33, 0.025, bx, 0.62, bz, Math.PI / 2);
    }
    obs(x + 0.35, z + 0.2, 0.8);
  };
  const sacks = (x, z) => {
    const pts = [[0, 0, 0], [0.7, 0.1, 0], [0.35, 0.05, 0.6], [0.35, 0.55, 0.25]];
    for (const [dx, dy, dz] of pts) S.sph('sack', 0.4, x + dx, 0.32 + dy, z + dz, 1, 0.75, 0.9, 7);
    S.box('red', 0.3, 0.05, 0.05, x + 0.35, 0.82, z + 0.25);
    obs(x + 0.35, z + 0.25, 0.85);
  };
  crates(-18.5, 29.5, 3);
  barrels(-13.5, 29.5, 2);
  crates(12.5, 29.5, 3);
  sacks(14.5, 31.0);
  crates(-22.5, 16.0, 2);

  loadSROProp('/assets/sro/props/cj_strawcart.glb', { scale: 0.9, autoGround: true, position: [9.5, 0, 32.5], rotationY: 0.5, parent: group });
  obs(9.5, 32.5, 1.25);
  loadSROProp('/assets/sro/props/cj_strawcart.glb', { scale: 0.9, autoGround: true, position: [-29.0, 0, 25.0], rotationY: -0.4, parent: group });
  obs(-29.0, 25.0, 1.25);
  [[-12.0, 29.0], [10.0, 29.0], [-20.5, 22.0], [18.5, 24.5]].forEach(([bx, bz]) => {
    loadSROProp('/assets/sro/props/cj_potato_basket.glb', { scale: 1.0, autoGround: true, position: [bx, 0, bz], parent: group });
    obs(bx, bz, 0.45);
  });
  [[-22.0, 35.0], [-27.5, 34.0], [-29.5, 31.0]].forEach(([dx, dz], idx) => {
    loadSROProp('/assets/sro/props/cj_dummy_01.glb', { scale: 0.88, autoGround: true, position: [dx, 0, dz], rotationY: idx % 2 ? 0.4 : -0.35, parent: group });
    obs(dx, dz, 0.5);
  });

  // Caravan camels, horses & town dog
  const camel = (x, z, ry) => {
    S.at(x, z, ry, () => {
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) S.cyl('camel', 0.1, 0.08, 1.2, sx * 0.3, 0.6, sz * 0.7, 6);
      S.box('camel', 0.85, 0.8, 2.0, 0, 1.55, 0);
      S.sph('camel', 0.38, 0, 2.15, -0.45, 1, 1.1, 1, 7);
      S.sph('camel', 0.36, 0, 2.15, 0.35, 1, 1.1, 1, 7);
      S.box('camel', 0.28, 1.1, 0.3, 0, 2.2, 1.15, 0.5);
      S.box('camel', 0.3, 0.32, 0.65, 0, 2.7, 1.55);
      S.box('red', 1.05, 0.12, 1.5, 0, 1.97, 0);
      S.box('cloth2', 0.5, 0.55, 0.6, -0.55, 1.75, 0);
      S.box('wood', 0.5, 0.55, 0.6, 0.55, 1.75, 0);
    });
    obs(x, z, 1.0);
  };
  camel(-11.0, 35.5, Math.PI / 2 + 0.2);
  camel(12.0, 22.0, -Math.PI / 2 - 0.2);
  loadSROProp('/assets/sro/town/horse.glb', { position: [-36.5, 0, 31.0], targetHeight: 2.15, autoGround: true, rotationY: 0.4, parent: group });
  loadSROProp('/assets/sro/town/horse.glb', { position: [-39.0, 0, 27.0], targetHeight: 2.05, autoGround: true, rotationY: 1.0, parent: group });
  loadSROProp('/assets/sro/town/dog.glb', { position: [-5.2, 0, 11.5], targetHeight: 0.85, autoGround: true, rotationY: 0.8, parent: group });
  obs(-36.5, 31.0, 0.9); obs(-39.0, 27.0, 0.9); obs(-5.2, 11.5, 0.4);

  // Stone lantern posts (city boulevards + 4 outer frontier highway milestones)
  const postLantern = (x, z) => {
    S.box('stone', 0.5, 0.2, 0.5, x, 0.1, z);
    S.cyl('stone', 0.1, 0.13, 1.1, x, 0.75, z, 6);
    S.box('stone', 0.32, 0.12, 0.32, x, 1.36, z);
    S.box('glow', 0.22, 0.26, 0.22, x, 1.55, z);
    S.frust('stone', 0.5, 0.5, 0.1, 0.1, 0.25, x, 1.68, z);
    S.sph('stone', 0.07, x, 1.98, z);
    obs(x, z, 0.32);
  };
  for (const [x, z] of [
    [-5.5, -14], [5.5, -14], [-5.5, 14], [5.5, 14],
    [-14, -5.5], [14, -5.5], [-14, 5.5], [14, 5.5],
    [-4.8, -68], [4.8, -68], [-4.8, -94], [4.8, -94],
    [-4.8, 68], [4.8, 68], [-4.8, 94], [4.8, 94],
    [-68, -4.8], [-68, 4.8], [-94, -4.8], [-94, 4.8],
    [68, -4.8], [68, 4.8], [94, -4.8], [94, 4.8]
  ]) postLantern(x, z);

  // Banners on poles (animated flags along inner avenues)
  const bannerPole = (x, z, ci) => {
    S.cyl('wood', 0.07, 0.1, 4.4, x, 2.2, z, 6);
    S.box('wood', 1.1, 0.07, 0.07, x, 4.2, z);
    S.sph('gold', 0.12, x, 4.5, z);
    const g = new THREE.Group();
    g.position.set(x, 4.17, z);
    const flag = new THREE.Mesh(new THREE.BoxGeometry(0.85, 1.9, 0.03), bannerMats[ci % 3]);
    flag.position.y = -0.95;
    const trim = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.16, 0.04), bannerMats[(ci + 2) % 3]);
    trim.position.y = -1.85;
    g.add(flag, trim);
    group.add(g);
    banners.push({ g, phase: banners.length * 1.3 });
    obs(x, z, 0.28);
  };
  [[-7.5, -18], [7.5, -18], [-7.5, 18], [7.5, 18], [-28, -5.5], [28, -5.5], [-28, 5.5], [28, 5.5]].forEach(([x, z], i) => {
    if (canPlaceVillage(x, z, 0.6)) bannerPole(x, z, i);
  });

  // Market lantern strings
  for (const sx of [-1, 1]) {
    S.cyl('red', 0.12, 0.14, 4.4, sx * 19.0, 2.2, 23.5, 6);
    S.sph('gold', 0.15, sx * 19.0, 4.45, 23.5);
    obs(sx * 19.0, 23.5, 0.35);
  }
  S.string(-19.0, 4.3, 23.5, 19.0, 4.3, 23.5, 0.85, 18, hangs, 2);

  /* ---------------- RPG Interior Town Details: Notice Board, Well, Planters, Benches & Amphorae ---------------- */
  // Town Notice & Bounty Board (North-West side of Central Plaza)
  if (canPlaceVillage(-12.2, 11.2, 1.1)) {
    S.at(-12.2, 11.2, 0.55, () => {
      S.box('curb', 2.4, 0.22, 0.75, 0, 0.11, 0);
      for (const sx of [-0.9, 0.9]) S.box('wood', 0.18, 2.35, 0.18, sx, 1.22, 0);
      S.box('wood', 1.85, 1.15, 0.12, 0, 1.55, 0);
      S.box('sack', 0.42, 0.52, 0.15, -0.48, 1.62, 0.02);
      S.box('sack', 0.38, 0.44, 0.15, 0.04, 1.54, 0.02);
      S.box('red', 0.36, 0.46, 0.15, 0.52, 1.64, 0.02);
      S.roof('teal', 2.1, 0.75, 2.28, 0.35, false);
    });
    obs(-12.2, 11.2, 1.0);
  }

  // Carved Covered Stone Well in North-West Scholar Courtyard
  if (canPlaceVillage(-24.5, -24.5, 1.3)) {
    S.at(-24.5, -24.5, 0.3, () => {
      S.cyl('curb', 1.05, 1.15, 0.78, 0, 0.39, 0, 10);
      S.cyl('dark', 0.78, 0.78, 0.72, 0, 0.43, 0, 10);
      for (const sx of [-0.85, 0.85]) S.box('wood', 0.18, 2.1, 0.18, sx, 1.45, 0);
      S.cyl('wood', 0.1, 0.1, 1.75, 0, 1.9, 0, 6, 0, Math.PI / 2);
      S.roof('terra', 1.9, 1.4, 2.35, 0.4, false);
    });
    obs(-24.5, -24.5, 1.1);
  }

  // Carved Stone Plaza Planter Beds & Garden Benches (clear of roads/NPCs)
  for (const [px, pz] of [[-12.4, -12.4], [12.4, 12.4], [-21.5, 20.5], [21.5, 20.5], [-18.5, -28.0], [19.5, -29.0]]) {
    if (!canPlaceVillage(px, pz, 1.1)) continue;
    S.at(px, pz, Math.PI * 0.25, () => {
      S.box('curb', 1.85, 0.42, 1.85, 0, 0.21, 0);
      S.box('sand', 1.55, 0.38, 1.55, 0, 0.24, 0);
      S.cyl('leafG', 0.72, 0.52, 0.65, 0, 0.72, 0, 7);
      S.sph('leafG', 0.56, 0, 1.18, 0, 1.15, 0.85, 1.15, 6);
    });
    obs(px, pz, 0.95);
  }
  for (const [bx, bz, bry] of [[-8.6, -9.8, -0.75], [8.8, 9.6, 2.35], [37.2, 19.2, Math.PI / 2], [-31.0, -17.0, 0.25]]) {
    if (!canPlaceVillage(bx, bz, 0.9)) continue;
    S.at(bx, bz, bry, () => {
      for (const sx of [-0.65, 0.65]) S.box('curb', 0.2, 0.36, 0.52, sx, 0.18, 0);
      S.box('wood', 1.65, 0.1, 0.56, 0, 0.4, 0);
      S.box('curb', 1.68, 0.08, 0.6, 0, 0.34, 0);
    });
    obs(bx, bz, 0.72);
  }

  // Ceramic Wine Amphorae & Barracks Weapon Rack
  for (const [ax, az] of [[-10.8, 37.5], [11.2, 37.5]]) {
    if (!canPlaceVillage(ax, az, 0.9)) continue;
    S.cyl('terra', 0.24, 0.3, 0.72, ax, 0.36, az, 8);
    S.cyl('terra', 0.2, 0.25, 0.58, ax + 0.52, 0.29, az + 0.25, 8);
    S.box('red', 0.28, 0.08, 0.28, ax, 0.74, az);
    obs(ax + 0.2, az + 0.1, 0.65);
  }
  if (canPlaceVillage(-25.5, 33.5, 0.95)) {
    S.at(-25.5, 33.5, 0.3, () => {
      for (const sx of [-0.7, 0.7]) S.box('wood', 0.12, 1.5, 0.4, sx, 0.75, 0);
      S.box('wood', 1.65, 0.12, 0.12, 0, 1.35, 0);
      S.box('wood', 1.65, 0.12, 0.12, 0, 0.55, 0);
      for (const sx of [-0.45, 0, 0.45]) S.box('dark', 0.06, 1.45, 0.06, sx, 0.95, 0.12, 0, 0.18, 0);
    });
    obs(-25.5, 33.5, 0.85);
  }

  /* ---------------- Organized Outskirt Frontier Arches, Towers & Camp Waypoints ---------------- */
  // Outer wooden frontier paifang arches framing all 4 highway exits (~112m, wide clear opening)
  paifang(0, -112.0, 9.6, 3.8, 0);
  paifang(0, 112.0, 9.6, 3.8, 0);
  paifang(-112.0, 0, 9.6, 3.8, Math.PI / 2);
  paifang(112.0, 0, 9.6, 3.8, -Math.PI / 2);

  // Classic wooden border watchtowers beside the 4 outer highway ends
  for (const [wx, wz, ry] of [[8.5, -118, 0], [-8.5, 118, Math.PI], [-118, -8.5, Math.PI / 2], [118, 8.5, -Math.PI / 2]]) {
    S.at(wx, wz, ry, () => {
      S.box('stone', 3.4, 0.6, 3.4, 0, 0.3, 0);
      S.box('sand', 2.8, 3.8, 2.8, 0, 2.5, 0);
      S.roof('teal', 3.0, 3.0, 4.4, 0.9, true);
    });
    blockRect(wx - 1.8, wz - 1.8, wx + 1.8, wz + 1.8);
    hangs.push([wx, 4.1, wz + 1.6, wx * 0.1]);
  }

  // Organized rustic stone cairns / camp signposts near outskirt camps (strictly overlap-checked)
  for (const camp of outskirtCamps) {
    const candidates = [
      [camp.center.x + 6.0, camp.center.z - 5.0],
      [camp.center.x - 6.0, camp.center.z + 5.0],
      [camp.center.x + 8.0, camp.center.z + 4.0]
    ];
    for (const [cx, cz] of candidates) {
      if (!canPlaceVillage(cx, cz, 1.4)) continue;
      S.at(cx, cz, rand() * Math.PI, () => {
        S.cyl('stone', 0.45, 0.62, 0.55, 0, 0.28, 0, 7);
        S.box('wood', 0.18, 2.1, 0.18, 0.55, 1.05, 0.15);
        S.box('red', 0.95, 0.34, 0.08, 0.55, 1.75, 0.2, 0.15);
      });
      obs(cx, cz, 0.7);
      break;
    }
  }

  /* ---------------- Classic Cherry, Willow & Instanced Forest + Perimeter Mountains ---------------- */
  const foliage = [];
  const pinks = [0xf2a6b8, 0xe88aa4, 0xf7c1cf];
  const greens = [0x7fa84a, 0x6b9a3c, 0x93b85a];
  const pinePalette = [0x3d6b35, 0x4d7c42, 0x2f5929, 0xc76b28];

  const cherry = (x, z) => {
    if (!canPlaceVillage(x, z, 1.2)) return;
    S.cyl('wood', 0.18, 0.3, 2.5, x, 1.25, z, 6);
    S.cyl('wood', 0.07, 0.1, 1.2, x + 0.4, 2.6, z, 5, 0, -0.9);
    for (let i = 0; i < 5; i++) {
      const a = rand() * Math.PI * 2, r = 0.4 + rand() * 0.9;
      foliage.push([x + Math.cos(a) * r, 3.1 + rand() * 0.9, z + Math.sin(a) * r, 0.9 + rand() * 0.55, 0.8, pinks[i % 3]]);
    }
    obs(x, z, 0.5);
  };
  const willow = (x, z) => {
    if (!canPlaceVillage(x, z, 1.2)) return;
    S.cyl('wood', 0.2, 0.34, 2.3, x, 1.15, z, 6);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + rand(), r = 0.7 + rand() * 0.8;
      foliage.push([x + Math.cos(a) * r, 2.8 + rand() * 0.5, z + Math.sin(a) * r, 1.0 + rand() * 0.4, 0.55, greens[i % 3]]);
    }
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2, r = 1.7 + rand() * 0.4;
      S.box('leafG', 0.07, 1.6 + rand() * 0.5, 0.07, x + Math.cos(a) * r, 2.0, z + Math.sin(a) * r);
    }
    obs(x, z, 0.55);
  };
  const pushInstancedPine = (tx, tz, scale = 1.0, autumn = false) => {
    S.cyl('wood', 0.16 * scale, 0.28 * scale, 2.3 * scale, tx, 1.15 * scale, tz, 6);
    for (let tier = 0; tier < 3; tier++) {
      const col = autumn ? pinePalette[3] : pinePalette[tier % 3];
      foliage.push([tx, (2.2 + tier * 0.95) * scale, tz, (1.45 - tier * 0.28) * scale, 1.18, col]);
    }
  };

  // Classic cherry & willow trees inside Oakhaven plazas
  [
    [-11.5, -10.5], [14.0, -12.0], [-34.0, 12.0], [14.0, 20.0], [-42.0, -38.0], [34.0, -30.0]
  ].forEach(([x, z]) => cherry(x, z));
  [
    [13.5, -28.0], [35.0, 24.0], [-42.0, 42.0], [45.0, 10.0], [-24.0, -45.0]
  ].forEach(([x, z]) => willow(x, z));

  // Organized outskirt scenic groves along camp perimeters & avenues (strict zero-overlap with spawns/roads)
  for (let i = 0; i < 64; i++) {
    const a = (i / 64) * Math.PI * 2 + 0.17;
    const r = 61 + (i % 5) * 11.2;
    const gx = Math.cos(a) * r;
    const gz = Math.sin(a) * r;
    if (!canPlaceVillage(gx, gz, 2.2)) continue;
    if (i % 6 === 0) cherry(gx, gz);
    else if (i % 6 === 3) willow(gx, gz);
    else {
      pushInstancedPine(gx, gz, 0.95 + rand() * 0.4, (i % 5) === 0);
      obs(gx, gz, 0.6);
    }
  }

  // Dense outer border forest wall right before mountain foothills (r in 118..126m, blocking map edge cleanly)
  for (let i = 0; i < 160; i++) {
    const side = i % 4;
    const u = ((i / 160) * 2 - 1) * 124;
    const jitter = (rand() - 0.5) * 4.0;
    const tx = side < 2 ? u : (side === 2 ? -120 - rand() * 5 : 120 + rand() * 5);
    const tz = side < 2 ? (side === 0 ? -120 - rand() * 5 : 120 + rand() * 5) : u;
    if (Math.abs(tx) < 6.5 || Math.abs(tz) < 6.5) continue;
    pushInstancedPine(tx + jitter * 0.25, tz + jitter * 0.25, 1.05 + rand() * 0.5, (i % 7) === 0);
  }

  // Wild outskirt boulders outside city walls
  for (let i = 0; i < 28; i++) {
    const a = (i / 28) * Math.PI * 2 + 0.21;
    const r = 64 + (i % 4) * 13;
    const bx = Math.cos(a) * r, bz = Math.sin(a) * r;
    if (!canPlaceVillage(bx, bz, 1.8)) continue;
    S.sph('stone', 0.65 + (i % 3) * 0.22, bx, 0.25, bz, 1.25, 0.68, 1.05, 6);
    foliage.push([bx + 0.65, 0.4, bz + 0.4, 0.6, 0.65, greens[i % 3]]);
    obs(bx, bz, 0.8);
  }

  /* ---------------- Natural Outskirt Grass Tufts, Wildflowers, Reeds & River Stones (InstancedMesh) ---------------- */
  const fd = new THREE.Object3D();
  const fc = new THREE.Color();

  const onOutskirtMeadow = (x, z, allowNearRiver = false) => {
    if (Math.abs(x) < HALF + 3.2 && Math.abs(z) < HALF + 3.2) return false;
    if (Math.abs(x) > WORLD_BOUND + 6 || Math.abs(z) > WORLD_BOUND + 6) return false;
    if (Math.abs(x) < 4.5 || Math.abs(z) < 4.5) return false; // outer highways clear
    if (!allowNearRiver && nearRiver(x, z, 3.2)) return false;
    if (allowNearRiver && nearRiver(x, z, 2.25)) return false;
    return true;
  };

  // 1) 680 3-blade grass tuft clusters across lush outskirt meadows
  const grassBladeGeo = mergeParts([
    [new THREE.ConeGeometry(0.11, 0.46, 4), 0, 0.22, 0, 0.14, 0, 0.12],
    [new THREE.ConeGeometry(0.09, 0.38, 4), 0.08, 0.18, -0.05, -0.18, 0.4, -0.22],
    [new THREE.ConeGeometry(0.09, 0.41, 4), -0.07, 0.2, 0.06, 0.16, -0.35, 0.24]
  ], M.leafG).geometry;
  const grassTufts = [];
  const grassCols = [0x4c7c32, 0x5d8d3c, 0x6ca148, 0x7aad53];
  for (let i = 0; i < 950 && grassTufts.length < 680; i++) {
    const x = (rand() * 2 - 1) * WORLD_BOUND;
    const z = (rand() * 2 - 1) * WORLD_BOUND;
    if (!onOutskirtMeadow(x, z, true)) continue;
    grassTufts.push([x, z, 0.85 + rand() * 0.75, rand() * 6.28, grassCols[i % grassCols.length]]);
  }
  const grassTuftMat = std(0xffffff, 0.88, 0.0, { flatShading: true });
  const grassTuftMesh = new THREE.InstancedMesh(grassBladeGeo, grassTuftMat, Math.max(1, grassTufts.length));
  grassTuftMesh.name = 'OutskirtGrassTufts';
  grassTufts.forEach(([x, z, sc, ry, col], i) => {
    fd.position.set(x, 0, z);
    fd.scale.set(sc, sc * (0.85 + (i % 3) * 0.15), sc);
    fd.rotation.set(0, ry, 0);
    fd.updateMatrix();
    grassTuftMesh.setMatrixAt(i, fd.matrix);
    grassTuftMesh.setColorAt(i, fc.setHex(col));
  });
  grassTuftMesh.count = grassTufts.length;
  grassTuftMesh.computeBoundingSphere();
  group.add(grassTuftMesh);

  // 2) 180 colorful Meadow Wildflower patches (no obstacles, bright accents near groves & riverbanks)
  const flowerBloomGeo = mergeParts([
    [new THREE.ConeGeometry(0.08, 0.28, 4), 0, 0.14, 0, 0, 0, 0],
    [new THREE.DodecahedronGeometry(0.11, 0), 0, 0.30, 0, 0, 0, 0, 1.1, 0.55, 1.1]
  ], M.leafG).geometry;
  const flowers = [];
  const flowerCols = [0xfbbf24, 0xf8fafc, 0x60a5fa, 0xf472b6, 0xfb923c];
  for (let i = 0; i < 420 && flowers.length < 180; i++) {
    const x = (rand() * 2 - 1) * (WORLD_BOUND - 4);
    const z = (rand() * 2 - 1) * (WORLD_BOUND - 4);
    if (!onOutskirtMeadow(x, z, true)) continue;
    flowers.push([x, z, 0.85 + rand() * 0.55, rand() * 6.28, flowerCols[i % flowerCols.length]]);
  }
  const flowerMesh = new THREE.InstancedMesh(flowerBloomGeo, grassTuftMat, Math.max(1, flowers.length));
  flowerMesh.name = 'OutskirtWildflowers';
  flowers.forEach(([x, z, sc, ry, col], i) => {
    fd.position.set(x, 0, z);
    fd.scale.set(sc, sc, sc);
    fd.rotation.set(0, ry, 0);
    fd.updateMatrix();
    flowerMesh.setMatrixAt(i, fd.matrix);
    flowerMesh.setColorAt(i, fc.setHex(col));
  });
  flowerMesh.count = flowers.length;
  flowerMesh.computeBoundingSphere();
  group.add(flowerMesh);

  // 3) Riverbank Smooth Pebbles & Cattail Reeds placed cleanly along the winding stream edges (skipping bridge crossings)
  const riverStones = [];
  const riverReeds = [];
  for (let i = 4; i < riverSamples.length - 4; i += 2) {
    const cur = riverSamples[i];
    const nxt = riverSamples[i + 1];
    const tx = nxt.x - cur.x, tz = nxt.z - cur.z;
    const len = Math.hypot(tx, tz) || 1;
    const nx = -tz / len, nz = tx / len;
    const onSouthBridge = Math.abs(cur.x) < 5.4 && Math.abs(cur.z - 60.0) < 4.5;
    const onEastBridge = Math.abs(cur.z) < 5.4 && Math.abs(cur.x - 60.5) < 4.5;
    if (onSouthBridge || onEastBridge) continue;

    for (const side of [-1, 1]) {
      const bankDist = 2.15 + rand() * 0.95;
      const sx = cur.x + nx * side * bankDist + (rand() - 0.5) * 0.4;
      const sz = cur.z + nz * side * bankDist + (rand() - 0.5) * 0.4;
      if (Math.abs(sx) < HALF + 1.1 && Math.abs(sz) < HALF + 1.1) continue;
      if (Math.abs(sx) < 4.5 || Math.abs(sz) < 4.5) continue;
      riverStones.push([sx, sz, 0.24 + rand() * 0.34, rand() * 6.28, (i + (side > 0 ? 1 : 0)) % 3]);
      if (rand() < 0.72) {
        const rx = sx + nx * side * 0.45;
        const rz = sz + nz * side * 0.45;
        if (Math.abs(rx) >= HALF + 1.2 || Math.abs(rz) >= HALF + 1.2) {
          riverReeds.push([rx, rz, 0.75 + rand() * 0.5, rand() * 6.28, i % 2]);
        }
      }
    }
  }
  const stoneMatInst = std(0xffffff, 0.88, 0.04, { flatShading: true });
  const riverStoneMesh = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1, 0), stoneMatInst, Math.max(1, riverStones.length));
  riverStoneMesh.name = 'RiverbankPebbles';
  const stoneTones = [0x7e7a70, 0x8d887d, 0x6b675f];
  riverStones.forEach(([x, z, sc, ry, toneIdx], i) => {
    fd.position.set(x, sc * 0.32, z);
    fd.scale.set(sc * 1.25, sc * 0.58, sc);
    fd.rotation.set(0.1, ry, 0.08);
    fd.updateMatrix();
    riverStoneMesh.setMatrixAt(i, fd.matrix);
    riverStoneMesh.setColorAt(i, fc.setHex(stoneTones[toneIdx]));
  });
  riverStoneMesh.count = riverStones.length;
  riverStoneMesh.computeBoundingSphere();
  group.add(riverStoneMesh);

  const reedClusterGeo = mergeParts([
    [new THREE.CylinderGeometry(0.03, 0.045, 0.95, 5), 0, 0.47, 0, 0.08, 0, 0.06],
    [new THREE.CylinderGeometry(0.025, 0.04, 0.82, 5), 0.1, 0.41, 0.07, -0.1, 0, -0.1],
    [new THREE.CylinderGeometry(0.045, 0.045, 0.16, 5), 0, 0.88, 0, 0.08, 0, 0.06]
  ], M.reed).geometry;
  const riverReedMesh = new THREE.InstancedMesh(reedClusterGeo, grassTuftMat, Math.max(1, riverReeds.length));
  riverReedMesh.name = 'RiverbankReeds';
  riverReeds.forEach(([x, z, sc, ry, toneIdx], i) => {
    fd.position.set(x, 0, z);
    fd.scale.set(sc, sc, sc);
    fd.rotation.set(0, ry, 0);
    fd.updateMatrix();
    riverReedMesh.setMatrixAt(i, fd.matrix);
    riverReedMesh.setColorAt(i, fc.setHex(toneIdx ? 0x68833c : 0x7b9346));
  });
  riverReedMesh.count = riverReeds.length;
  riverReedMesh.computeBoundingSphere();
  group.add(riverReedMesh);

  const foliageMat = std(0xffffff, 0.88, 0.0, { flatShading: true });
  const foliageMesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), foliageMat, Math.max(1, foliage.length));
  foliage.forEach((f, i) => {
    fd.position.set(f[0], f[1], f[2]);
    fd.scale.set(f[3], f[3] * f[4], f[3]);
    fd.rotation.set(0, i * 0.7, 0);
    fd.updateMatrix();
    foliageMesh.setMatrixAt(i, fd.matrix);
    foliageMesh.setColorAt(i, fc.setHex(f[5]));
  });
  foliageMesh.count = foliage.length;
  foliageMesh.computeBoundingSphere();
  group.add(foliageMesh);

  // Continuous sculpted jagged mountain ridge ring closing map borders outside ±128..146m (1 draw call)
  const peakTransforms = [];
  const ridgeSteps = 34;
  for (let side = 0; side < 4; side++) {
    for (let i = 0; i <= ridgeSteps; i++) {
      const t = -146 + (i / ridgeSteps) * 292;
      const depth = 129 + ((i * 37 + side * 19) % 16);
      const x = side < 2 ? t : (side === 2 ? -depth : depth);
      const z = side < 2 ? (side === 0 ? -depth : depth) : t;
      const hScale = 14 + ((i * 23 + side * 11) % 16);
      const rScale = 7.5 + ((i * 13 + side * 7) % 5);
      peakTransforms.push({ x, z, rx: rScale, ry: hScale, yaw: (i * 1.1 + side * 0.7) % 6.28, color: (i + side) % 3 === 0 ? 0x5c574f : ((i + side) % 3 === 1 ? 0x6b6357 : 0x4b4740) });
    }
  }
  const mountainMat = std(0xffffff, 0.94, 0.04, { flatShading: true });
  const mountainMesh = new THREE.InstancedMesh(new THREE.ConeGeometry(1, 1, 6), mountainMat, peakTransforms.length);
  mountainMesh.name = 'PerimeterMountains';
  peakTransforms.forEach((p, idx) => {
    fd.position.set(p.x, p.ry * 0.45, p.z);
    fd.scale.set(p.rx, p.ry, p.rx * 0.92);
    fd.rotation.set(0, p.yaw, 0);
    fd.updateMatrix();
    mountainMesh.setMatrixAt(idx, fd.matrix);
    mountainMesh.setColorAt(idx, fc.setHex(p.color));
  });
  mountainMesh.computeBoundingSphere();
  group.add(mountainMesh);

  /* ---------------- lanterns (instanced, distance-throttled swinging) ---------------- */
  const lanternMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(0.5, 8, 6), lanternMat, Math.max(1, hangs.length));
  lanternMesh.frustumCulled = false;
  group.add(lanternMesh);
  const ld = new THREE.Object3D();
  const writeLanterns = (t) => {
    for (let i = 0; i < hangs.length; i++) {
      const h = hangs[i];
      const a = Math.sin(t * 1.3 + h[3]) * 0.12, b = Math.cos(t * 1.1 + h[3] * 1.7) * 0.07;
      ld.position.set(h[0] + Math.sin(a) * 0.3, h[1] - 0.32 * Math.cos(a), h[2] + Math.sin(b) * 0.3);
      ld.rotation.set(b, 0, -a);
      ld.scale.set(0.38, 0.52, 0.38);
      ld.updateMatrix();
      lanternMesh.setMatrixAt(i, ld.matrix);
    }
    lanternMesh.instanceMatrix.needsUpdate = true;
  };
  lanternMesh.count = hangs.length;
  writeLanterns(0);

  /* ---------------- static merge ---------------- */
  S.build(M, group);

  /* ---------------- chimney & forge smoke ---------------- */
  const puffGeo = new THREE.SphereGeometry(0.28, 7, 5);
  const puffs = [];
  const smokeSources = [...chimneys, new THREE.Vector3(FORGE.x, 1.2, FORGE.z)];
  smokeSources.forEach((src, si) => {
    for (let k = 0; k < 2; k++) {
      const mat = new THREE.MeshBasicMaterial({ color: 0xcfcac0, transparent: true, opacity: 0, depthWrite: false });
      const mesh = new THREE.Mesh(puffGeo, mat);
      group.add(mesh);
      puffs.push({ mesh, src, phase: k * 0.5 + si * 0.13, life: 3.6 + si * 0.2 });
    }
  });

  /* ---------------- classic animated plaza pigeons ---------------- */
  const pigeonParts = [
    [new THREE.SphereGeometry(1, 7, 5), 0, 0.12, 0, 0, 0, 0, 0.12, 0.1, 0.19],
    [new THREE.SphereGeometry(1, 6, 4), 0, 0.22, 0.14, 0, 0, 0, 0.065, 0.065, 0.065],
    [new THREE.BoxGeometry(0.1, 0.02, 0.14), 0, 0.12, -0.2, 0.2, 0, 0],
    [new THREE.BoxGeometry(0.36, 0.02, 0.12), 0, 0.15, 0, 0, 0, 0]
  ];
  const pigeonGeo = mergeParts(pigeonParts, pigeonMat).geometry;
  const pigeons = [];
  [[-4, 4.5], [4.5, 4.2], [-2.5, 11.4], [2.2, 12.0], [-11, 18.2], [11, 18.4], [-6, -28.2], [6, -28.2]].forEach(([x, z], i) => {
    const mesh = new THREE.Mesh(pigeonGeo, pigeonMat);
    mesh.position.set(x, 0, z);
    group.add(mesh);
    pigeons.push({ mesh, home: { x, z }, state: 'ground', t: 0, timer: 0, dir: { x: 1, z: 0 }, from: { x: 0, y: 0, z: 0 }, cool: 0, phase: i * 1.7, yaw: rand() * 6.28 });
  });

  /* ---------------- classic SOS gate guards & town adventurers (distance-culled) ---------------- */
  const villagers = [];
  const SOS_TOWN_BUILDS = {
    knight_sos: {
      classId: 'knight',
      eq: {
        weapon: { slot: 'weapon', subtype: 'blade', visualModel: 'blade_04', tier: 7, plus: 9, seal: 'star', rarity: 'unique' },
        shield: { slot: 'shield', subtype: 'shield', visualModel: 'shield_04', tier: 7, plus: 9, seal: 'star', rarity: 'unique' },
        armor: { slot: 'armor', visualSet: 'heavy_04', tier: 7, rarity: 'epic' },
        boots: { slot: 'boots', visualSet: 'heavy_04', tier: 7, rarity: 'epic' },
        helmet: { slot: 'helmet', visualSet: 'heavy_04', tier: 7, rarity: 'epic' }
      }
    },
    axeman_sos: {
      classId: 'axeman',
      eq: {
        weapon: { slot: 'weapon', subtype: 'axe', visualModel: 'axe_04', tier: 7, plus: 9, seal: 'star', rarity: 'unique' },
        shield: { slot: 'shield', subtype: 'axe', visualModel: 'axe_04', tier: 7, plus: 9, seal: 'star', rarity: 'unique' },
        armor: { slot: 'armor', visualSet: 'light_04', tier: 7, rarity: 'epic' },
        boots: { slot: 'boots', visualSet: 'light_04', tier: 7, rarity: 'epic' }
      }
    },
    wizard_sos: {
      classId: 'wizard',
      eq: {
        weapon: { slot: 'weapon', subtype: 'staff', visualModel: 'staff_04', tier: 7, plus: 10, seal: 'star', rarity: 'unique' },
        armor: { slot: 'armor', visualSet: 'clothes_04', tier: 7, rarity: 'epic' },
        boots: { slot: 'boots', visualSet: 'clothes_04', tier: 7, rarity: 'epic' }
      }
    },
    archer_sos: {
      classId: 'archer',
      eq: {
        weapon: { slot: 'weapon', subtype: 'bow', visualModel: 'bow_04', tier: 7, plus: 9, seal: 'star', rarity: 'unique' },
        armor: { slot: 'armor', visualSet: 'light_03', tier: 5, rarity: 'epic' },
        boots: { slot: 'boots', visualSet: 'light_03', tier: 5, rarity: 'epic' }
      }
    }
  };

  const spawnVillager = (role, x, z, route, speed, scale = 1, buildKey = 'knight_sos', initialYaw = null) => {
    const preset = SOS_TOWN_BUILDS[buildKey] || SOS_TOWN_BUILDS.knight_sos;
    let mesh = null;
    try {
      mesh = createHeroMesh(preset.eq, {
        classId: preset.classId,
        lightweightCrowd: true,
        disableWeaponLight: true,
        disableGearSprites: true,
        disableRimGlow: true
      });
    } catch (e) {
      if (createNPCMesh) {
        try { mesh = createNPCMesh(role); } catch (_) { return; }
      }
    }
    if (!mesh) return;
    const staleLights = [];
    mesh.traverse((c) => {
      if (c.name === 'HeroClassRing' || c.name === 'NpcRing' || c.name === 'QuestMarker') {
        c.visible = false;
      } else if (c.isPointLight) {
        staleLights.push(c);
      }
    });
    for (const pl of staleLights) pl.parent?.remove(pl);
    mesh.userData.setQuestMarker = null;
    mesh.scale.setScalar(scale);
    const groundY = 0.08;
    mesh.position.set(x, groundY, z);
    const startYaw = initialYaw != null ? initialYaw : rand() * 6;
    mesh.rotation.set(0, startYaw, 0);

    group.add(mesh);
    const phaseVal = rand() * 6;
    villagers.push({
      mesh,
      route,
      idx: 0,
      speed,
      phase: phaseVal,
      yaw: startYaw,
      isGuard: initialYaw != null,
      x,
      z,
      groundY,
      wait: route.length ? (villagers.length % 2 === 0 ? 3.5 + (phaseVal % 4.5) : 0) : 0,
      scale,
      _animAcc: 0
    });
  };

  // Stationed Guards set cleanly to courtyard sides well clear of the gate/avenue mouths & chests
  spawnVillager('guard_spear', -7.2, 46.5, [], 0, 1.04, 'knight_sos', Math.PI);
  spawnVillager('guard_bow', 7.2, 46.5, [], 0, 1.04, 'archer_sos', Math.PI);
  spawnVillager('guard_spear', -7.2, -24.0, [], 0, 1.04, 'wizard_sos', 0);
  spawnVillager('guard_bow', 7.2, -24.0, [], 0, 1.04, 'axeman_sos', 0);

  // Strolling Town Adventurers
  const ring = [];
  for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; ring.push([Math.cos(a) * 10.5, Math.sin(a) * 10.5]); }
  spawnVillager('villager', 10.5, 0, ring, 0.72, 1.0, 'knight_sos');
  spawnVillager('merchant', -10.5, 0, ring.slice().reverse(), 0.68, 0.98, 'archer_sos');
  spawnVillager('skill_master', -13.0, 21.0, [[-13, 21], [-3, 21], [10, 21], [-3, 22]], 0.72, 1.0, 'axeman_sos');
  spawnVillager('composer', 14.0, 22.0, [[14, 22], [18, 28], [24, 24], [14, 22]], 0.70, 0.96, 'wizard_sos');
  spawnVillager('villager_m1', -6.0, 18.0, [[-6, 18], [4, 18], [4, 28], [-6, 28]], 0.68, 1.0, 'knight_sos');
  spawnVillager('blacksmith', -24.0, 12.0, [[-24, 12], [-15, 12], [-15, 21], [-24, 21]], 0.70, 1.02, 'axeman_sos');
  spawnVillager('villager', 28.0, -14.0, [[28, -14], [34, -18], [36, -4], [28, -4]], 0.66, 0.96, 'wizard_sos');
  spawnVillager('merchant', -32.0, -14.0, [[-32, -14], [-40, -16], [-40, -4], [-32, -4]], 0.68, 1.0, 'archer_sos');

  /* ---------------- Distance-culled update loop ---------------- */
  let lanternAccum = 0;
  function update(dt = 0.016, t = 0, playerPos = null) {
    dt = Math.min(dt, 0.1);
    const px = playerPos ? Number(playerPos.x ?? playerPos.position?.x ?? 0) : 0;
    const pz = playerPos ? Number(playerPos.z ?? playerPos.position?.z ?? 0) : 0;
    const distOriginSq = px * px + pz * pz;
    const nearTownCore = distOriginSq < 75 * 75;

    if (nearTownCore) {
      lanternAccum += dt;
      if (lanternAccum >= 0.033) {
        lanternAccum = 0;
        writeLanterns(t);
      }
      lanternMat.emissiveIntensity = 1.05 + Math.sin(t * 7.1) * 0.1 + Math.sin(t * 13.7) * 0.07;
      waterMat.emissiveIntensity = 0.5 + Math.sin(t * 2.2) * 0.1;
      pondMat.emissiveIntensity = 0.32 + Math.sin(t * 1.6) * 0.06;
      streamMat.emissiveIntensity = 0.24 + Math.sin(t * 2.0) * 0.05;
      if (streamTexNor) {
        streamTexNor.offset.y = (streamTexNor.offset.y - dt * 0.34) % 1;
        streamTexNor.offset.x = (streamTexNor.offset.x + Math.sin(t * 0.45) * dt * 0.04) % 1;
      }
      const hsDx = px - HOT_SPRINGS.center.x;
      const hsDz = pz - HOT_SPRINGS.center.z;
      if (hsDx * hsDx + hsDz * hsDz < 42 * 42) {
        hotSpringMat.emissiveIntensity = 0.78 + Math.sin(t * 2.2) * 0.12;
      }
      const fDx = px - FORGE.x;
      const fDz = pz - FORGE.z;
      if (fDx * fDx + fDz * fDz < 38 * 38) {
        coalMat.emissiveIntensity = 1.3 + Math.sin(t * 9) * 0.25 + Math.sin(t * 5.3) * 0.15;
      }

      const fl = 1 + Math.sin(t * 11) * 0.12 + Math.sin(t * 17.3) * 0.08;
      flame.scale.set(fl, fl * (1 + Math.sin(t * 8) * 0.15), fl);
      flame.rotation.y = t * 2;
      for (const a of awnings) {
        a.g.rotation.x = a.base + Math.sin(t * a.sp + a.phase) * a.amp;
      }
      for (const b of banners) {
        b.g.rotation.x = Math.sin(t * 1.5 + b.phase) * 0.14;
        b.g.rotation.z = Math.sin(t * 1.0 + b.phase * 1.7) * 0.07;
      }
      for (const p of puffs) {
        const u = (((t / p.life) + p.phase) % 1 + 1) % 1;
        p.mesh.position.set(p.src.x + u * 1.1 + Math.sin(u * 6 + p.phase * 9) * 0.12, p.src.y + u * 3.2, p.src.z + Math.cos(u * 5 + p.phase * 7) * 0.1);
        p.mesh.scale.setScalar(0.55 + u * 1.7);
        p.mesh.material.opacity = 0.42 * (1 - u) * Math.min(1, u * 6);
      }
      for (const p of pigeons) {
        const m = p.mesh;
        p.cool = Math.max(0, p.cool - dt);
        const dSq = (px - p.home.x) * (px - p.home.x) + (pz - p.home.z) * (pz - p.home.z);
        if (p.state === 'ground') {
          m.position.set(p.home.x, 0, p.home.z);
          m.rotation.set(Math.max(0, Math.sin(t * 3 + p.phase)) * 0.4, p.yaw + Math.sin(t * 0.5 + p.phase) * 0.4, 0);
          if (dSq < 3.4 * 3.4 && p.cool <= 0) {
            p.state = 'fly'; p.t = 0; p.timer = 2.6 + (p.phase % 1.7);
            const dx = p.home.x - px, dz = p.home.z - pz, l = Math.hypot(dx, dz) || 1;
            p.dir.x = dx / l + Math.sin(p.phase) * 0.4; p.dir.z = dz / l + Math.cos(p.phase) * 0.4;
          }
        } else if (p.state === 'fly') {
          p.t += dt;
          const k = Math.min(1, p.t / 1.0), run = p.t * 2.4;
          m.position.set(p.home.x + p.dir.x * run + Math.sin(p.t * 2 + p.phase) * 0.6, k * 3.2 + Math.sin(t * 6) * 0.1, p.home.z + p.dir.z * run + Math.cos(p.t * 2 + p.phase) * 0.6);
          m.rotation.set(0, Math.atan2(p.dir.x, p.dir.z), Math.sin(t * 30 + p.phase) * 0.5);
          if (p.t > p.timer) {
            p.state = 'land';
            p.t = 0;
            p.from.x = m.position.x;
            p.from.y = m.position.y;
            p.from.z = m.position.z;
          }
        } else {
          p.t += dt / 1.5;
          const k = Math.min(1, p.t), e = k * k * (3 - 2 * k);
          m.position.set(p.from.x + (p.home.x - p.from.x) * e, p.from.y * (1 - e), p.from.z + (p.home.z - p.from.z) * e);
          m.rotation.set(0, Math.atan2(p.home.x - p.from.x, p.home.z - p.from.z), Math.sin(t * 24 + p.phase) * 0.35 * (1 - k));
          if (k >= 1) { p.state = 'ground'; p.cool = 2.5; }
        }
      }
      for (const v of villagers) {
        const distSq = (v.x - px) * (v.x - px) + (v.z - pz) * (v.z - pz);
        if (distSq > 40 * 40) {
          if (v.mesh.visible) v.mesh.visible = false;
          continue;
        }
        if (!v.mesh.visible) v.mesh.visible = true;
        const m = v.mesh;
        const gy = v.groundY ?? 0.08;
        let animDt = dt;
        if (distSq > 22 * 22) {
          v._animAcc = (v._animAcc || 0) + dt;
          if (v._animAcc >= 0.066) {
            animDt = v._animAcc;
            v._animAcc = 0;
          } else {
            animDt = 0;
          }
        }
        if (v.route.length && v.speed > 0) {
          const wp = v.route[v.idx];
          const dx = wp[0] - v.x, dz = wp[1] - v.z, dist = Math.hypot(dx, dz);
          if (v.wait > 0) {
            v.wait -= dt;
            if (animDt > 0) m.userData?.animate?.('idle', t + v.phase, animDt);
          } else if (dist < 0.25) {
            v.idx = (v.idx + 1) % v.route.length;
            v.wait = 4.5 + (v.phase % 5.0);
            if (animDt > 0) m.userData?.animate?.('idle', t + v.phase, animDt);
          } else {
            const step = Math.min(dist, v.speed * dt);
            v.x += (dx / dist) * step; v.z += (dz / dist) * step;
            v.yaw = angleLerp(v.yaw, Math.atan2(dx, dz), Math.min(1, dt * 6));
            m.position.set(v.x, gy, v.z);
            m.rotation.set(0, v.yaw, 0);
            if (animDt > 0) m.userData?.animate?.('stroll', t + v.phase, animDt);
          }
        } else {
          if (!v.isGuard) {
            m.rotation.set(0, v.yaw + Math.sin(t * 0.4 + v.phase) * 0.35, 0);
          }
          if (animDt > 0) m.userData?.animate?.('idle', t + v.phase, animDt);
        }
      }
    }
  }

  function dispose() {
    const mats = new Set();
    group.traverse((o) => {
      if (o.geometry && !o.geometry.userData?.isCachedGLB) o.geometry.dispose();
      if (o.material) {
        (Array.isArray(o.material) ? o.material : [o.material]).forEach((mm) => {
          if (mm && !mm.userData?.isCachedGLB) mats.add(mm);
        });
      }
      if (o.isInstancedMesh) o.dispose?.();
    });
    mats.forEach((mm) => mm.dispose());
    if (splatTex) splatTex.dispose();
    if (group.parent) group.parent.remove(group);
  }

  // Only emit direct unpooled lights if explicitly requested; otherwise return lightSources for the 8-light pool
  if (addLight && ctx.useDirectLights) {
    for (const l of lights) addLight(new THREE.Vector3(...l.pos), l.color, l.i, l.d, l.f);
  }

  return {
    group,
    blockedTiles,
    obstacles,
    buildingRects,
    npcSpots,
    spawnPoint,
    portalPos,
    selectorPos,
    arenaPortalPos,
    storageChestSpots,
    fountain,
    hotSprings: {
      x: HOT_SPRINGS.center.x,
      z: HOT_SPRINGS.center.z,
      radius: HOT_SPRINGS.radius,
      name: 'Jade Mist Hot Springs'
    },
    townWallHalf: HALF,
    worldBound: WORLD_BOUND,
    outskirtCamps,
    villagers,
    pigeons,
    riverPoints: riverSamples.map((p) => ({ x: Number(p.x.toFixed(1)), z: Number(p.z.toFixed(1)) })),
    lightSources: lights.map((l) => ({
      x: l.pos[0],
      y: l.pos[1],
      z: l.pos[2],
      color: l.color,
      intensity: l.i,
      distance: l.d
    })),
    lightCount: lights.length,
    update,
    dispose
  };
}

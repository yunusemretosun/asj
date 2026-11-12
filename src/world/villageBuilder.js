// Silk-Road caravan-town hub builder for ARKENVEIL: Sigils & Journeys.
// Pure scene construction + ambient-life animation. No game-state imports.
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
    const m = new THREE.Matrix4().multiplyMatrices(this.base, this._l);
    geo.applyMatrix4(m);
    const pos = geo.getAttribute('position');
    const nor = geo.getAttribute('normal');
    const b = (this.buckets[key] ||= { pos: [], nor: [], idx: [], count: 0 });
    for (let i = 0; i < pos.count; i++) {
      b.pos.push(pos.getX(i), pos.getY(i), pos.getZ(i));
      b.nor.push(nor.getX(i), nor.getY(i), nor.getZ(i));
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
    for (const [key, b] of Object.entries(this.buckets)) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(b.pos, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(b.nor, 3));
      g.setIndex(new THREE.Uint32BufferAttribute(b.idx, 1));
      const mesh = new THREE.Mesh(g, mats[key]);
      mesh.name = `Village_${key}`;
      mesh.castShadow = key !== 'glow' && key !== 'dark';
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
  return new THREE.Mesh(g, mat);
}

/* ------------------------------------------------------------------ */

export function buildVillage(ctx = {}) {
  const {
    grid,
    tileSize = 2,
    originX = -24,
    originZ = -24,
    gridWidth = 26,
    gridHeight = 26,
    createNPCMesh = null,
    addLight = null
  } = ctx;

  const rand = makeRand(1337);
  const group = new THREE.Group();
  group.name = 'SilkRoadTown';
  const S = new Batcher();
  const obstacles = [];
  const blockedTiles = [];
  const buildingRects = [];
  const hangs = []; // lantern hang points [x,y,z,phase]
  const awnings = [];
  const banners = [];
  const chimneys = [];
  const lights = [];

  /* ---------------- materials ---------------- */
  const std = (color, rough = 0.85, metal = 0.05, extra = {}) =>
    new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, ...extra });
  const M = {
    sand: std(0xd9b98a),
    wood: std(0x4a2e1a, 0.8),
    red: std(0xb3261e, 0.6),
    teal: std(0x2a7f84, 0.55, 0.1),
    terra: std(0xb5532f, 0.7),
    gold: std(0xd4a437, 0.35, 0.6),
    stone: std(0x8d8a82, 0.9),
    dark: std(0x1f1a17, 0.7),
    sack: std(0xd8c79a),
    fruitO: std(0xe8892a, 0.6),
    fruitG: std(0x5aa03c, 0.6),
    cloth1: std(0x8a2f5a),
    cloth2: std(0x2b6a9c),
    leafG: std(0x6a9440),
    camel: std(0xb98c55),
    horse: std(0x6b4630),
    glow: new THREE.MeshBasicMaterial({ color: 0xffc266 })
  };
  const grassMat = std(0x4a6b3a, 0.95);
  const dirtMat = std(0xb89a6a, 0.95);
  const plazaMat = std(0x9a8f7e, 0.85, 0.1);
  const roadMat = std(0x7d786e, 0.9);

  // Apply authentic Silkroad Jangan ground textures in browser
  const applyGroundTexture = (material, url, repeatX = 8, repeatY = 8) => {
    if (typeof window === 'undefined') return;
    const texLoader = new THREE.TextureLoader();
    texLoader.load(url, (tex) => {
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(repeatX, repeatY);
      tex.colorSpace = THREE.SRGBColorSpace;
      material.map = tex;
      material.needsUpdate = true;
    });
  };
  applyGroundTexture(grassMat, '/assets/sro/env/c_grass_fld_03.png', 24, 24);
  applyGroundTexture(plazaMat, '/assets/sro/env/c_marble_jang_01.png', 6, 6);
  applyGroundTexture(dirtMat, '/assets/sro/env/c_dust_fld_01.png', 4, 16);
  applyGroundTexture(roadMat, '/assets/sro/env/rok_stone_02.png', 4, 12);
  const waterMat = std(0x38bdf8, 0.15, 0.4, { emissive: new THREE.Color(0x0284c7), emissiveIntensity: 0.55 });
  const pondMat = std(0x2f8f9a, 0.2, 0.3, { transparent: true, opacity: 0.88, emissive: new THREE.Color(0x0e4b55), emissiveIntensity: 0.35 });
  const lanternMat = std(0xd62a1a, 0.5, 0.0, { emissive: new THREE.Color(0xff3a10), emissiveIntensity: 1.1 });
  const flameMat = new THREE.MeshBasicMaterial({ color: 0xff8a2a, transparent: true, opacity: 0.9 });
  const coalMat = std(0x401008, 0.6, 0.0, { emissive: new THREE.Color(0xff4410), emissiveIntensity: 1.4 });
  const pigeonMat = std(0x8f97a6, 0.8);
  const awnMats = [std(0xb3261e, 0.8), std(0x2a7f84, 0.8), std(0xd9a21b, 0.8), std(0x3b4a8c, 0.8)];
  const bannerMats = [std(0xb3261e, 0.8), std(0x2a7f84, 0.8), std(0xd4a437, 0.6, 0.3)];
  for (const m of [...awnMats, ...bannerMats]) m.side = THREE.DoubleSide;

  /* ---------------- collision helpers ---------------- */
  const worldToTile = (x, z) => ({
    gx: Math.floor((x - originX) / tileSize),
    gz: Math.floor((z - originZ) / tileSize)
  });
  const blockRect = (x0, z0, x1, z1) => {
    buildingRects.push({ x0, z0, x1, z1 });
    if (!grid) return;
    for (let gz = 0; gz < gridHeight; gz++) {
      for (let gx = 0; gx < gridWidth; gx++) {
        const cx = originX + (gx + 0.5) * tileSize;
        const cz = originZ + (gz + 0.5) * tileSize;
        if (cx > x0 - 0.9 && cx < x1 + 0.9 && cz > z0 - 0.9 && cz < z1 + 0.9) {
          if (grid[gz][gx] !== WALL_TILE) blockedTiles.push({ gx, gz });
          grid[gz][gx] = WALL_TILE;
        }
      }
    }
  };
  const obs = (x, z, radius) => obstacles.push({ x, z, radius });

  /* ---------------- ground ---------------- */
  const addGround = (geo, mat, x, y, z) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.receiveShadow = true;
    group.add(m);
  };
  const worldW = gridWidth * tileSize, worldH = gridHeight * tileSize;
  const grass = new THREE.Mesh(new THREE.PlaneGeometry(worldW + 36, worldH + 36), grassMat);
  grass.rotation.x = -Math.PI / 2;
  grass.receiveShadow = true;
  group.add(grass);
  addGround(new THREE.CylinderGeometry(8.2, 8.4, 0.08, 40), plazaMat, 0, 0.04, 0);
  addGround(new THREE.BoxGeometry(4.4, 0.07, 12), roadMat, 0, 0.035, -13.5);          // portal road
  addGround(new THREE.BoxGeometry(4.0, 0.07, 26), dirtMat, 0, 0.035, 20.5);            // gate & southern caravan road
  addGround(new THREE.BoxGeometry(36, 0.07, 3.6), dirtMat, 0, 0.036, 13);            // market street
  addGround(new THREE.BoxGeometry(2.4, 0.07, 6), roadMat, 8.6, 0.035, -4.6);           // pagoda path
  addGround(new THREE.BoxGeometry(6, 0.07, 3), roadMat, -9.5, 0.035, -4.2);            // forge yard
  // pond
  const POND = { x: 14.5, z: 8.7, r: 1.9 };
  const pond = new THREE.Mesh(new THREE.CylinderGeometry(POND.r, POND.r, 0.06, 20), pondMat);
  pond.position.set(POND.x, 0.05, POND.z);
  group.add(pond);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    S.sph('stone', 0.34 + rand() * 0.12, POND.x + Math.cos(a) * (POND.r + 0.1), 0.1, POND.z + Math.sin(a) * (POND.r + 0.1), 1, 0.7, 1, 6);
  }
  for (const [lx, lz] of [[-0.6, 0.4], [0.5, -0.5], [0.2, 0.9], [-0.9, -0.7]]) {
    S.cyl('leafG', 0.28, 0.28, 0.02, POND.x + lx, 0.09, POND.z + lz, 8);
  }
  S.cyl('cloth1', 0.14, 0.14, 0.03, POND.x + 0.2, 0.1, POND.z + 0.9, 8);
  obs(POND.x, POND.z, POND.r - 0.1);

  // Lotus pond flowers floating on village pond
  [
    [14.0, 0.08, 8.4, 0.95],
    [15.1, 0.08, 9.1, 0.9],
    [14.6, 0.08, 8.0, 0.85]
  ].forEach(([fx, fy, fz, size]) => {
    loadSROSprite('/assets/sro/sprites/c_pondflower-28ab3d2d@1x.png', {
      width: size,
      height: size,
      position: [fx, fy, fz],
      isFlat: true,
      parent: group
    });
  });

  /* ---------------- perimeter wall + gate ---------------- */
  const HALF = 22;
  const wallRun = (x, z, len, alongX) => {
    if (alongX) {
      S.box('sand', len, 2.4, 1.2, x, 1.2, z);
      S.box('teal', len, 0.22, 1.7, x, 2.5, z);
    } else {
      S.box('sand', 1.2, 2.4, len, x, 1.2, z);
      S.box('teal', 1.7, 0.22, len, x, 2.5, z);
    }
  };
  wallRun(0, -HALF, HALF * 2, true);
  wallRun(-HALF, 0, HALF * 2, false);
  wallRun(HALF, 0, HALF * 2, false);
  wallRun(-(HALF + 3.2) / 2 - 0.0, HALF, HALF - 3.2, true);
  wallRun((HALF + 3.2) / 2, HALF, HALF - 3.2, true);
  for (let i = -HALF; i <= HALF; i += 8) {
    for (const [px, pz] of [[i, -HALF], [i, HALF], [-HALF, i], [HALF, i]]) {
      S.box('red', 0.6, 2.9, 0.6, px, 1.45, pz);
      S.sph('gold', 0.22, px, 3.0, pz);
    }
  }
  /* ---------------- paifang arch ---------------- */
  const paifang = (cx, cz, span, h) => {
    S.at(cx, cz, 0, () => {
      const hs = span / 2;
      for (const sx of [-1, 1]) {
        S.box('stone', 0.95, 0.5, 0.95, sx * hs, 0.25, 0);
        S.cyl('red', 0.3, 0.32, h, sx * hs, h / 2 + 0.5, 0, 10);
        S.cyl('gold', 0.38, 0.38, 0.18, sx * hs, h + 0.55, 0, 10);
        S.box('stone', 0.5, 0.35, 0.5, sx * (hs + 0.9), 0.18, 0);
        S.box('red', 0.5, h * 0.55, 0.5, sx * (hs + 0.9), h * 0.275 + 0.35, 0);
        obs(cx + sx * hs, cz, 0.45);
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
      S.box('gold', 1.9, 0.62, 0.12, 0, h + 0.1, 0.26);
      S.box('red', 1.6, 0.4, 0.14, 0, h + 0.1, 0.27);
      S.roof('teal', 2.4, 0.7, h + 0.55, 1.0);
      for (const [lx, ly, ph] of [[-hs * 0.45, h - 0.15, 0.3], [hs * 0.45, h - 0.15, 1.9], [0, h + 0.25, 3.3]]) hangs.push([cx + lx, ly, cz + 0.1, ph]);
    });
  };
  paifang(0, -9.8, 6.8, 4.1);   // road to dungeon portal

  // Authentic Silkroad Dragon Gate arch at main southern entrance (centered in the south wall gap)
  loadSROProp('/assets/sro/env/cj_jang_gate_dragon.glb', {
    position: [0, 0, 21.4],
    targetHeight: 4.8,
    centerXZ: true,
    rotationY: Math.PI,
    autoGround: true,
    parent: group
  });

  // Guardian lions and palace lamps flanking main southern caravan gate
  loadSROProp('/assets/sro/props/cj3_lion01.glb', {
    position: [-3.4, 0, 18.6],
    targetHeight: 1.88,
    autoGround: true,
    rotationY: Math.PI,
    parent: group
  });
  loadSROProp('/assets/sro/props/cj3_lion01.glb', {
    position: [3.4, 0, 18.6],
    targetHeight: 1.88,
    autoGround: true,
    rotationY: Math.PI,
    parent: group
  });
  loadSROProp('/assets/sro/props/cj_pal_lamp.glb', {
    targetHeight: 2.14,
    position: [-4.6, 0, 18.6],
    rotationY: 0,
    parent: group
  });
  loadSROProp('/assets/sro/props/cj_pal_lamp.glb', {
    targetHeight: 2.14,
    position: [4.6, 0, 18.6],
    rotationY: 0,
    parent: group
  });
  obs(-3.4, 18.6, 0.6); obs(3.4, 18.6, 0.6);
  obs(-4.6, 18.6, 0.5); obs(4.6, 18.6, 0.5);
  obs(-2.6, 18.2, 0.45); obs(2.6, 18.2, 0.45);

  // Guardian lions and palace lamps flanking northern dungeon road
  loadSROProp('/assets/sro/props/cj3_lion01.glb', {
    position: [-3.6, 0, -11.5],
    targetHeight: 1.88,
    autoGround: true,
    rotationY: 0,
    parent: group
  });
  loadSROProp('/assets/sro/props/cj3_lion01.glb', {
    position: [3.6, 0, -11.5],
    targetHeight: 1.88,
    autoGround: true,
    rotationY: 0,
    parent: group
  });
  loadSROProp('/assets/sro/props/cj_pal_lamp.glb', {
    targetHeight: 2.14,
    position: [-4.8, 0, -11.5],
    rotationY: 0,
    parent: group
  });
  loadSROProp('/assets/sro/props/cj_pal_lamp.glb', {
    targetHeight: 2.14,
    position: [4.8, 0, -11.5],
    rotationY: 0,
    parent: group
  });
  obs(-3.6, -11.5, 0.6); obs(3.6, -11.5, 0.6);
  obs(-4.8, -11.5, 0.5); obs(4.8, -11.5, 0.5);
  obs(-2.6, -11.0, 0.45); obs(2.6, -11.0, 0.45);

  // Dimensional portal stone stele beside northern dungeon portal
  loadSROProp('/assets/sro/props/cj_portal_stone.glb', {
    position: [-2.3, 0, -16.5],
    targetHeight: 1.85,
    autoGround: true,
    rotationY: 0,
    parent: group
  });
  obs(0, -16.5, 1.2);

  /* ---------------- buildings ---------------- */
  const building = (cx, cz, w, d, h, ry, roofKey, opts = {}) => {
    S.at(cx, cz, ry, () => {
      S.box('stone', w + 0.4, 0.4, d + 0.4, 0, 0.2, 0);
      S.frust('sand', w, d, w - 0.25, d - 0.25, h, 0, 0.4, 0);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) S.box('wood', 0.32, h, 0.32, sx * w / 2, 0.4 + h / 2, sz * d / 2);
      S.box('wood', w + 0.15, 0.3, d + 0.15, 0, h + 0.25, 0);
      S.box('wood', w + 0.1, 0.18, d + 0.1, 0, 1.3, 0);
      // door + windows (front = +z)
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
  building(-8.8, -15, 7.6, 5.8, 3.6, 0, 'teal', { chimney: false });             // chief's hall (shifted west clear of northern portal road)
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

  // Natural ring of mossy stones around perimeter
  const hsStoneCount = 20;
  for (let i = 0; i < hsStoneCount; i++) {
    const a = (i / hsStoneCount) * Math.PI * 2;
    // Leave southeastern gap open for wooden deck entry (angle 0.45 to 1.15)
    if (a > 0.45 && a < 1.15) continue;
    const sx = HOT_SPRINGS.center.x + Math.cos(a) * (HOT_SPRINGS.radius + 0.18);
    const sz = HOT_SPRINGS.center.z + Math.sin(a) * (HOT_SPRINGS.radius + 0.18);
    S.sph('stone', 0.44 + rand() * 0.16, sx, 0.14, sz, 1.15, 0.65, 1.15, 7);
    if (i % 2 === 0) {
      S.sph('leafG', 0.3, sx + (rand() - 0.5) * 0.1, 0.23, sz + (rand() - 0.5) * 0.1, 1.0, 0.32, 1.0, 6);
    }
  }

  // Wooden stepping deck at southeastern edge
  const deckBaseX = HOT_SPRINGS.center.x + (HOT_SPRINGS.radius - 0.3) * Math.cos(0.8);
  const deckBaseZ = HOT_SPRINGS.center.z + (HOT_SPRINGS.radius - 0.3) * Math.sin(0.8);
  S.box('wood', 3.4, 0.12, 1.6, deckBaseX + 0.8, 0.06, deckBaseZ + 0.8, -Math.PI / 4);
  S.box('wood', 2.6, 0.1, 0.9, deckBaseX + 0.2, 0.09, deckBaseZ + 0.2, -Math.PI / 4);
  S.box('wood', 2.0, 0.08, 0.7, deckBaseX - 0.4, 0.12, deckBaseZ - 0.4, -Math.PI / 4);

  // Warm corner lanterns around sanctuary perimeter
  const hsCornerDist = HOT_SPRINGS.radius + 0.9;
  const hsCorners = [
    [-hsCornerDist, -hsCornerDist * 0.9],
    [hsCornerDist * 0.9, -hsCornerDist * 0.9],
    [-hsCornerDist, hsCornerDist * 0.9],
    [hsCornerDist * 0.9, hsCornerDist * 0.9]
  ];
  hsCorners.forEach(([ox, oz]) => {
    const lx = HOT_SPRINGS.center.x + ox;
    const lz = HOT_SPRINGS.center.z + oz;
    S.box('stone', 0.5, 0.2, 0.5, lx, 0.1, lz);
    S.cyl('wood', 0.09, 0.12, 1.7, lx, 0.95, lz, 6);
    S.box('stone', 0.34, 0.12, 0.34, lx, 1.82, lz);
    S.box('glow', 0.24, 0.26, 0.24, lx, 2.01, lz);
    S.roof('terra', 0.65, 0.65, 2.14, 0.35, false);
    lights.push({ pos: [lx, 2.05, lz], color: 0xffa040, i: 1.5, d: 9, f: true });
    obs(lx, lz, 0.35);
  });

  // Lotus pond flower sprites floating on Jade Mist Hot Springs
  [
    [-17.2, 0.19, -15.0, 1.2],
    [-14.5, 0.19, -13.2, 1.1],
    [-16.0, 0.19, -12.2, 1.25],
    [-18.0, 0.19, -13.6, 1.05]
  ].forEach(([fx, fy, fz, size]) => {
    loadSROSprite('/assets/sro/sprites/c_pondflower-28ab3d2d@1x.png', {
      width: size,
      height: size,
      position: [fx, fy, fz],
      isFlat: true,
      parent: group
    });
  });

  // Authentic Silkroad tea tables outside the tavern & near hot springs deck (single cleanly scaled model)
  [
    { x: -12.5, z: -9.5, ry: 0.3 },
    { x: -14.5, z: -7.5, ry: -0.5 },
    { x: -9.5, z: -14.0, ry: 0.8 }
  ].forEach(({ x, z, ry }) => {
    loadSROProp('/assets/sro/props/cj_table01.glb', {
      scale: 0.72,
      targetHeight: 0.78,
      position: [x, 0, z],
      rotationY: ry,
      autoGround: true,
      parent: group
    });
    obs(x, z, 0.95);
  });
  building(-17, -5, 6, 6, 3.2, Math.PI / 2, 'terra', { chimney: true });       // forge house
  building(17, 3, 6, 6, 3.2, -Math.PI / 2, 'teal', { chimney: true });         // east house
  building(17, 17, 6, 6, 3.2, -Math.PI / 2, 'terra', { chimney: false });      // warehouse
  building(-17, 17, 6, 6, 3.2, Math.PI / 2, 'teal', { chimney: true });        // west house
  // hall extras: gold plaque and extra eave lanterns
  S.at(-6, -15, 0, () => {
    S.box('gold', 2.2, 0.5, 0.1, 0, 3.5, 3.1);
    S.box('red', 1.9, 0.35, 0.12, 0, 3.5, 3.12);
    hangs.push(...[-2.8, 2.8].map((x, i) => [...S.world(x, 3.7, 3.4).toArray(), i + 4]));
  });

  /* ---------------- pagoda (landmark, open ground floor) ---------------- */
  const PAG = { x: 13, z: -12 };
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
    hangs.push([-2.4, 3.1, 2.6, 0.2], [2.4, 3.1, 2.6, 2.1], [-2.4, 3.1, -2.6, 4.2], [2.4, 3.1, -2.6, 1.3]);
  });
  hangs.splice(hangs.length - 4, 4, ...[[-2.4, 3.1, 2.6, 0.2], [2.4, 3.1, 2.6, 2.1], [-2.4, 3.1, -2.6, 4.2], [2.4, 3.1, -2.6, 1.3]].map((p) => [PAG.x + p[0], p[1], PAG.z + p[2], p[3]]));

  // Guardian lions and garden lamps flanking pagoda steps
  loadSROProp('/assets/sro/props/cj3_lion01.glb', {
    targetHeight: 1.88,
    position: [PAG.x - 1.8, 0, PAG.z + 2.5],
    rotationY: 0,
    autoGround: true,
    parent: group
  });
  loadSROProp('/assets/sro/props/cj3_lion01.glb', {
    targetHeight: 1.88,
    position: [PAG.x + 1.8, 0, PAG.z + 2.5],
    rotationY: 0,
    autoGround: true,
    parent: group
  });
  loadSROProp('/assets/sro/props/cj_lamp01.glb', {
    scale: 0.55,
    targetHeight: 3.37,
    position: [PAG.x - 2.6, 0, PAG.z + 3.8],
    rotationY: 0,
    autoGround: true,
    parent: group
  });
  loadSROProp('/assets/sro/props/cj_lamp01.glb', {
    scale: 0.55,
    targetHeight: 3.37,
    position: [PAG.x + 2.6, 0, PAG.z + 3.8],
    rotationY: 0,
    autoGround: true,
    parent: group
  });
  obs(PAG.x - 1.8, PAG.z + 2.5, 0.6);
  obs(PAG.x + 1.8, PAG.z + 2.5, 0.6);
  obs(PAG.x - 2.6, PAG.z + 3.8, 0.4);
  obs(PAG.x + 2.6, PAG.z + 3.8, 0.4);

  /* ---------------- fountain (healing shrine) ---------------- */
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
  obs(0, 0, 2.3);

  /* ---------------- brazier + forge ---------------- */
  const BR = { x: 4.2, z: -3.2 };
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

  const FORGE = { x: -12.6, z: -5.2 };
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
  lights.push({ pos: [FORGE.x, 1.6, FORGE.z], color: 0xff7a2a, i: 2.2, d: 12, f: true });
  lights.push({ pos: [BR.x, 1.9, BR.z], color: 0xffa040, i: 2.0, d: 12, f: true });
  lights.push({ pos: [0, 3.4, 18.4], color: 0xff6a3a, i: 1.6, d: 10, f: true });
  lights.push({ pos: [0, 3.4, 10.4], color: 0xff5a30, i: 1.8, d: 12, f: true });
  lights.push({ pos: [-6, 2.8, -11.2], color: 0xff8a40, i: 1.6, d: 10, f: true });

  /* ---------------- market stalls ---------------- */
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
        for (const sx of [-1, 1]) {
          S.box('wood', 0.14, 2.9, 0.14, sx * (w / 2 - 0.05), 1.5, -1.2);
          S.box('wood', 0.14, 2.3, 0.14, sx * (w / 2 - 0.05), 1.2, 1.2);
        }
        S.box('wood', w, 1.0, 0.7, 0, 0.6, 1.0);
        S.box('red', w + 0.1, 0.12, 0.8, 0, 1.12, 1.0);
      }
      if (goods === 'fruit') {
        for (let i = 0; i < 6; i++) S.sph(i % 2 ? 'fruitO' : 'fruitG', 0.17, -1.1 + i * 0.4, 1.2, 1.0, 1, 1, 1, 6);
        for (let i = 0; i < 4; i++) S.sph('fruitG', 0.17, -0.6 + i * 0.4, 1.2, 1.25, 1, 1, 1, 6);
      } else if (goods === 'cloth') {
        S.box('cloth1', 0.9, 0.25, 0.6, -0.9, 1.2, 1.0);
        S.box('cloth2', 0.9, 0.25, 0.6, 0.0, 1.2, 1.0);
        S.box('gold', 0.9, 0.25, 0.6, 0.9, 1.2, 1.0);
      } else if (goods === 'potion') {
        for (let i = 0; i < 6; i++) S.cyl(i % 2 ? 'teal' : 'red', 0.1, 0.12, 0.3, -1.1 + i * 0.44, 1.2, 1.0, 6);
        for (let i = 0; i < 5; i++) S.cyl(i % 2 ? 'fruitO' : 'gold', 0.09, 0.1, 0.26, -1.0 + i * 0.5, 1.2, 0.65, 6);
      }
      hangs.push([...S.world(-w / 2 + 0.3, 2.4, 2.0).toArray(), awnIdx], [...S.world(w / 2 - 0.3, 2.4, 2.0).toArray(), awnIdx + 2]);
    });
    obs(x - 1.1, z - 0.9, 0.65); obs(x, z - 0.9, 0.65); obs(x + 1.1, z - 0.9, 0.65);
  };
  // stall center z=13; local +z = counter side faces -z world after PI rotation
  stall(-10, 13, 0, 'fruit');
  stall(-4, 13, 1, 'goods');   // storage / quartermaster
  stall(4, 13, 2, 'cloth');
  stall(10, 13, 3, 'potion');  // merchant / alchemist

  /* ---------------- props ---------------- */
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
  const cart = (x, z, ry) => {
    S.at(x, z, ry, () => {
      S.box('wood', 2.2, 0.15, 1.3, 0, 0.8, 0);
      S.box('wood', 2.2, 0.5, 0.1, 0, 1.1, 0.65);
      S.box('wood', 2.2, 0.5, 0.1, 0, 1.1, -0.65);
      S.box('wood', 0.1, 0.5, 1.3, -1.1, 1.1, 0);
      for (const sz of [-1, 1]) {
        S.tor('wood', 0.5, 0.07, 0, 0.55, sz * 0.75, 0, 0, 0);
        S.cyl('dark', 0.08, 0.08, 0.2, 0, 0.55, sz * 0.75, 6, Math.PI / 2);
      }
      S.box('wood', 1.8, 0.07, 0.08, 1.8, 0.85, 0.35, 0, 0, 0.1);
      S.box('wood', 1.8, 0.07, 0.08, 1.8, 0.85, -0.35, 0, 0, 0.1);
      S.sph('sack', 0.4, -0.5, 1.2, 0, 1, 0.8, 1, 7);
      S.sph('sack', 0.4, 0.2, 1.2, 0.1, 1, 0.8, 1, 7);
      S.box('cloth2', 0.8, 0.5, 0.8, 0.6, 1.2, -0.1);
    });
    obs(x, z, 1.25);
  };
  crates(-12.6, -10.6, 3);
  barrels(-12.7, -9.3, 2);
  sacks(-13.4, 0.4);
  crates(8.4, -8.2, 3);
  sacks(8.6, -7.0);
  crates(-7.6, 14.9, 2); barrels(-6.8, 15.0, 2);
  crates(7.0, 14.9, 3); barrels(8.0, 15.1, 1);
  crates(12.0, 15.2, 3); sacks(12.4, 17.0);
  crates(-12.2, 7.4, 2, 0.4);
  // Authentic Silkroad straw carts
  loadSROProp('/assets/sro/props/cj_strawcart.glb', {
    scale: 0.85,
    autoGround: true,
    position: [7.6, 0, 18.2],
    rotationY: 0.5,
    parent: group
  });
  obs(7.6, 18.2, 1.25);

  loadSROProp('/assets/sro/props/cj_strawcart.glb', {
    scale: 0.85,
    autoGround: true,
    position: [-13.5, 0, 7.5],
    rotationY: -0.4,
    parent: group
  });
  obs(-13.5, 7.5, 1.25);

  // Authentic Silkroad potato baskets
  [
    [12.0, 15.2],
    [-7.6, 14.9],
    [7.0, 14.9],
    [-13.4, 0.4],
    [-6.8, 15.0]
  ].forEach(([bx, bz]) => {
    loadSROProp('/assets/sro/props/cj_potato_basket.glb', {
      scale: 1.0,
      autoGround: true,
      position: [bx, 0, bz],
      parent: group
    });
    obs(bx, bz, 0.4);
  });

  // Authentic Silkroad training dummies near Battle Master Kael
  loadSROProp('/assets/sro/props/cj_dummy_01.glb', {
    scale: 0.85,
    autoGround: true,
    position: [-8.2, 0, 8.0],
    rotationY: 0.35,
    parent: group
  });
  obs(-8.2, 8.0, 0.45);

  loadSROProp('/assets/sro/props/cj_dummy_01.glb', {
    scale: 0.85,
    autoGround: true,
    position: [-11.0, 0, 7.2],
    rotationY: -0.4,
    parent: group
  });
  obs(-11.0, 7.2, 0.45);

  // stone lantern posts
  const postLantern = (x, z) => {
    S.box('stone', 0.5, 0.2, 0.5, x, 0.1, z);
    S.cyl('stone', 0.1, 0.13, 1.1, x, 0.75, z, 6);
    S.box('stone', 0.32, 0.12, 0.32, x, 1.36, z);
    S.box('glow', 0.22, 0.26, 0.22, x, 1.55, z);
    S.frust('stone', 0.5, 0.5, 0.1, 0.1, 0.25, x, 1.68, z);
    S.sph('stone', 0.07, x, 1.98, z);
    obs(x, z, 0.3);
  };
  for (const [x, z] of [[-2.6, -6.5], [2.6, -6.5], [-5.5, 4.5], [5.5, 4.5], [-2.4, 16.5], [2.4, 16.5], [-2.8, -11.2], [8.4, -9.8]]) postLantern(x, z);

  // banners on poles (animated flags)
  const bannerPole = (x, z, ci) => {
    S.cyl('wood', 0.07, 0.1, 4.4, x, 2.2, z, 6);
    S.box('wood', 1.1, 0.07, 0.07, x, 4.2, z);
    S.sph('gold', 0.12, x, 4.5, z);
    S.box('gold', 0.14, 0.14, 0.14, x, 0.1, z);
    const g = new THREE.Group();
    g.position.set(x, 4.17, z);
    const flag = new THREE.Mesh(new THREE.BoxGeometry(0.85, 1.9, 0.03), bannerMats[ci % 3]);
    flag.position.y = -0.95;
    const trim = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.16, 0.04), bannerMats[(ci + 2) % 3]);
    trim.position.y = -1.85;
    g.add(flag, trim);
    group.add(g);
    banners.push({ g, phase: banners.length * 1.3 });
    obs(x, z, 0.25);
  };
  [[-7.6, -0.8], [7.6, -0.8], [-4.8, 19], [4.8, 19], [-9.2, 9], [9.2, 9]].forEach(([x, z], i) => bannerPole(x, z, i));

  // market lantern string + poles
  for (const sx of [-1, 1]) {
    S.cyl('red', 0.12, 0.14, 4.4, sx * 13.2, 2.2, 11, 6);
    S.sph('gold', 0.15, sx * 13.2, 4.45, 11);
    obs(sx * 13.2, 11, 0.3);
  }
  S.string(-13.2, 4.3, 11, 13.2, 4.3, 11, 0.7, 16, hangs, 1);
  S.string(-2.8, 3.4, 18.8, 2.8, 3.4, 18.8, 0.2, 6, hangs, 2);

  /* ---------------- animals (static silhouettes) ---------------- */
  const camel = (x, z, ry) => {
    S.at(x, z, ry, () => {
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) S.cyl('camel', 0.1, 0.08, 1.2, sx * 0.3, 0.6, sz * 0.7, 6);
      S.box('camel', 0.85, 0.8, 2.0, 0, 1.55, 0);
      S.sph('camel', 0.38, 0, 2.15, -0.45, 1, 1.1, 1, 7);
      S.sph('camel', 0.36, 0, 2.15, 0.35, 1, 1.1, 1, 7);
      S.box('camel', 0.28, 1.1, 0.3, 0, 2.2, 1.15, 0.5);
      S.box('camel', 0.3, 0.32, 0.65, 0, 2.7, 1.55);
      S.box('camel', 0.08, 0.5, 0.08, 0, 1.55, -1.1, -0.3);
      S.box('red', 1.05, 0.12, 1.5, 0, 1.97, 0);
      S.box('cloth2', 0.5, 0.55, 0.6, -0.55, 1.75, 0);
      S.box('wood', 0.5, 0.55, 0.6, 0.55, 1.75, 0);
      S.box('gold', 1.07, 0.05, 0.18, 0, 1.99, 0.35);
    });
    obs(x, z, 1.0);
  };
  camel(-6.2, 16.8, Math.PI / 2 + 0.2);
  camel(-4.3, 18.0, Math.PI / 2 - 0.25);
  S.at(5.6, 16.4, -Math.PI / 2 + 0.3, () => { // horse
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) S.cyl('horse', 0.08, 0.06, 1.0, sx * 0.22, 0.5, sz * 0.55, 6);
    S.box('horse', 0.6, 0.65, 1.5, 0, 1.2, 0);
    S.box('horse', 0.24, 0.8, 0.28, 0, 1.65, 0.8, 0.6);
    S.box('horse', 0.24, 0.26, 0.55, 0, 2.0, 1.15);
    S.box('dark', 0.08, 0.7, 0.2, 0, 1.75, 0.65, 0.6);
    S.box('dark', 0.1, 0.6, 0.1, 0, 1.2, -0.85, -0.4);
    S.box('red', 0.7, 0.1, 0.8, 0, 1.56, 0);
  });
  // Authentic Silkroad stable horse and town dog
  loadSROProp('/assets/sro/town/horse.glb', {
    position: [5.6, 0, 16.4],
    targetHeight: 2.2,
    autoGround: true,
    rotationY: -Math.PI / 2 + 0.3,
    parent: group
  });
  obs(5.6, 16.4, 0.9);

  loadSROProp('/assets/sro/town/dog.glb', {
    position: [-4.5, 0, 5.2],
    targetHeight: 0.85,
    autoGround: true,
    rotationY: 0.8,
    parent: group
  });
  obs(-4.5, 5.2, 0.4);

  /* ---------------- trees (trunks merged, foliage instanced) ---------------- */
  const foliage = [];
  const pinks = [0xf2a6b8, 0xe88aa4, 0xf7c1cf];
  const greens = [0x7fa84a, 0x6b9a3c, 0x93b85a];
  const cherry = (x, z) => {
    S.cyl('wood', 0.18, 0.3, 2.5, x, 1.25, z, 6);
    S.cyl('wood', 0.07, 0.1, 1.2, x + 0.4, 2.6, z, 5, 0, -0.9);
    for (let i = 0; i < 5; i++) {
      const a = rand() * Math.PI * 2, r = 0.4 + rand() * 0.9;
      foliage.push([x + Math.cos(a) * r, 3.1 + rand() * 0.9, z + Math.sin(a) * r, 0.9 + rand() * 0.55, 0.8, pinks[i % 3]]);
    }
    obs(x, z, 0.45);
  };
  const willow = (x, z) => {
    S.cyl('wood', 0.2, 0.34, 2.3, x, 1.15, z, 6);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + rand(), r = 0.7 + rand() * 0.8;
      foliage.push([x + Math.cos(a) * r, 2.8 + rand() * 0.5, z + Math.sin(a) * r, 1.0 + rand() * 0.4, 0.55, greens[i % 3]]);
    }
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2, r = 1.7 + rand() * 0.4;
      S.box('leafG', 0.07, 1.6 + rand() * 0.5, 0.07, x + Math.cos(a) * r, 2.0, z + Math.sin(a) * r);
    }
    obs(x, z, 0.5);
  };
  const pine = (x, z, scale = 1.0) => {
    S.cyl('wood', 0.16 * scale, 0.28 * scale, 2.2 * scale, x, 1.1 * scale, z, 6);
    const pineCols = [0x3d6b35, 0x4d7c42, 0x2f5929];
    for (let tier = 0; tier < 3; tier++) {
      const r = (1.35 - tier * 0.28) * scale;
      const y = (2.1 + tier * 0.95) * scale;
      foliage.push([x, y, z, r, 1.15, pineCols[tier % 3]]);
    }
  };
  [[-7.5, -4.5], [7.5, -6.8], [-15, 11.5], [-17.8, 8.4], [11.4, -2.6], [18, -8]].forEach(([x, z]) => cherry(x, z));
  [[13.5, 4.6], [17.4, 10.6], [-9.4, 16.8], [-19, -9.6]].forEach(([x, z]) => willow(x, z));
  // Surrounding forest & field belt outside the Silk-Road town walls (|x|>22 or |z|>22, avoiding the southern road x in -3.5..3.5)
  const outerGrove = [
    [-24, -18, 'pine'], [-26, -8, 'willow'], [-25, 4, 'pine'], [-24, 16, 'cherry'],
    [24, -18, 'pine'], [26, -6, 'cherry'], [25, 6, 'willow'], [24, 17, 'pine'],
    [-16, -24, 'pine'], [-6, -25, 'cherry'], [7, -25, 'pine'], [17, -24, 'willow'],
    [-18, 24, 'willow'], [-9, 25, 'cherry'], [-5.2, 26.5, 'pine'],
    [5.2, 26.5, 'cherry'], [10, 25, 'pine'], [18, 24, 'willow'],
    [-22, 22, 'pine'], [22, 22, 'pine'], [-22, -22, 'willow'], [22, -22, 'cherry']
  ];
  for (const [ox, oz, kind] of outerGrove) {
    if (kind === 'cherry') cherry(ox, oz);
    else if (kind === 'willow') willow(ox, oz);
    else pine(ox, oz, 0.95 + rand() * 0.3);
  }
  // Wild boulders & shrub clusters in the outer field
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2 + 0.18;
    const r = 23.5 + (i % 3) * 2.2;
    const bx = Math.cos(a) * r, bz = Math.sin(a) * r;
    if (bz > 18 && Math.abs(bx) < 4.2) continue; // keep southern caravan road clear
    S.sph('stone', 0.55 + (i % 3) * 0.22, bx, 0.22, bz, 1.2, 0.65, 1.0, 6);
    foliage.push([bx + 0.6, 0.35, bz + 0.4, 0.55, 0.65, greens[i % 3]]);
  }
  const foliageMat = std(0xffffff, 0.9, 0.0, { flatShading: true });
  const foliageMesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), foliageMat, foliage.length);
  const fd = new THREE.Object3D();
  foliage.forEach((f, i) => {
    fd.position.set(f[0], f[1], f[2]);
    fd.scale.set(f[3], f[3] * f[4], f[3]);
    fd.rotation.set(0, i, 0);
    fd.updateMatrix();
    foliageMesh.setMatrixAt(i, fd.matrix);
    foliageMesh.setColorAt(i, new THREE.Color(f[5]));
  });
  foliageMesh.castShadow = true;
  foliageMesh.receiveShadow = true;
  group.add(foliageMesh);

  // Ancient Silkroad inn tree sprites on the outskirts
  [
    [-21, -11],
    [21, -10],
    [-12, 22],
    [13, 22],
    [-22, 8],
    [22, 9],
    [-18, -21],
    [18, -21]
  ].forEach(([tx, tz]) => {
    loadSROSprite('/assets/sro/sprites/cj_inn_oldtree-da7d35bc@1x.png', {
      width: 5.8,
      height: 7.2,
      position: [tx, 0, tz],
      parent: group
    });
  });

  // Authentic Silkroad 3D trees across town
  [
    { url: '/assets/sro/env/tre_maple01.glb', x: -14.5, z: 12.0, h: 6.8 },
    { url: '/assets/sro/env/tre_pine01.glb', x: 15.0, z: -6.5, h: 6.2 },
    { url: '/assets/sro/env/tre_willow01.glb', x: 12.5, z: 6.5, h: 7.2 },
    { url: '/assets/sro/env/tre_tree01.glb', x: -8.5, z: -17.5, h: 6.5 },
    { url: '/assets/sro/env/tre_maple01.glb', x: 8.5, z: 15.5, h: 6.5 },
    { url: '/assets/sro/env/tre_pine01.glb', x: -16.0, z: -8.0, h: 6.0 }
  ].forEach(({ url, x, z, h }) => {
    loadSROProp(url, {
      position: [x, 0, z],
      targetHeight: h,
      autoGround: true,
      parent: group
    });
    obs(x, z, 0.6);
  });

  /* ---------------- lanterns (instanced, swinging) ---------------- */
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

  /* ---------------- smoke ---------------- */
  const puffGeo = new THREE.SphereGeometry(0.28, 7, 5);
  const puffs = [];
  const smokeSources = [...chimneys, new THREE.Vector3(FORGE.x, 1.2, FORGE.z)];
  smokeSources.forEach((src, si) => {
    for (let k = 0; k < (si === smokeSources.length - 1 ? 1 : 2); k++) {
      const mat = new THREE.MeshBasicMaterial({ color: 0xcfcac0, transparent: true, opacity: 0, depthWrite: false });
      const mesh = new THREE.Mesh(puffGeo, mat);
      group.add(mesh);
      puffs.push({ mesh, src, phase: k * 0.5 + si * 0.13, life: 3.6 + si * 0.2 });
    }
  });

  /* ---------------- pigeons ---------------- */
  const pigeonParts = [
    [new THREE.SphereGeometry(1, 7, 5), 0, 0.12, 0, 0, 0, 0, 0.12, 0.1, 0.19],
    [new THREE.SphereGeometry(1, 6, 4), 0, 0.22, 0.14, 0, 0, 0, 0.065, 0.065, 0.065],
    [new THREE.BoxGeometry(0.1, 0.02, 0.14), 0, 0.12, -0.2, 0.2, 0, 0],
    [new THREE.BoxGeometry(0.36, 0.02, 0.12), 0, 0.15, 0, 0, 0, 0]
  ];
  const pigeonGeo = mergeParts(pigeonParts, pigeonMat).geometry;
  const pigeons = [];
  [[-3, 3.6], [3.5, 3.2], [-1.5, 6.4], [1.2, 7.0], [-9, 9.2], [8, 9.4], [-5, -8.2], [6, 1.5]].forEach(([x, z], i) => {
    const mesh = new THREE.Mesh(pigeonGeo, pigeonMat);
    mesh.position.set(x, 0, z);
    group.add(mesh);
    pigeons.push({ mesh, home: { x, z }, state: 'ground', t: 0, timer: 0, dir: { x: 1, z: 0 }, from: null, cool: 0, phase: i * 1.7, yaw: rand() * 6.28 });
  });

  /* ---------------- villager crowd & gate guards (animated with SOS weapons) ---------------- */
  const villagers = [];
  const SOS_TOWN_BUILDS = {
    knight_sos: {
      classId: 'knight',
      eq: {
        weapon: { slot: 'weapon', subtype: 'sword', visualModel: 'sword_04', tier: 7, plus: 9, seal: 'star', rarity: 'unique' },
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
        weapon: { slot: 'weapon', subtype: 'staff', visualModel: 'spear_04', tier: 7, plus: 10, seal: 'star', rarity: 'unique' },
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
      mesh = createHeroMesh(preset.eq, { classId: preset.classId });
    } catch (e) {
      if (createNPCMesh) {
        try { mesh = createNPCMesh(role); } catch (_) { return; }
      }
    }
    if (!mesh) return;
    mesh.traverse((c) => {
      if (c.name === 'HeroClassRing' || c.name === 'NpcRing' || c.name === 'QuestMarker') {
        c.visible = false;
      }
    });
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
      scale
    });
  };

  // Stationed Gate Guards with glowing SOS weapons & idle animations
  spawnVillager('guard_spear', -2.6, 18.2, [], 0, 1.04, 'knight_sos', Math.PI);
  spawnVillager('guard_bow', 2.6, 18.2, [], 0, 1.04, 'archer_sos', Math.PI);
  spawnVillager('guard_spear', -2.6, -11.0, [], 0, 1.04, 'wizard_sos', 0);
  spawnVillager('guard_bow', 2.6, -11.0, [], 0, 1.04, 'axeman_sos', 0);

  // Calmly strolling & resting Town Adventurers with SOS weapons & idle pauses
  const ring = [];
  for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; ring.push([Math.cos(a) * 6.3, Math.sin(a) * 6.3]); }
  spawnVillager('villager', 6.3, 0, ring, 0.72, 1.0, 'knight_sos');
  spawnVillager('merchant', -6.3, 0, ring.slice().reverse(), 0.68, 0.98, 'archer_sos');
  spawnVillager('skill_master', -11, 9.4, [[-11, 9.4], [-3, 9.4], [5, 9.4], [-3, 10.2]], 0.75, 1.0, 'axeman_sos');
  spawnVillager('composer', 1.6, 5, [[1.6, 5], [1.6, 11.5], [-1.6, 11.5], [-1.6, 5]], 0.70, 0.96, 'wizard_sos');
  spawnVillager('villager_m1', 1.5, -8, [[1.4, -8], [1.4, -13], [-1.4, -13], [-1.4, -8]], 0.68, 1.0, 'knight_sos');
  spawnVillager('blacksmith', 11.5, 7.2, [[11.5, 7.2], [11.2, 10.0], [9.0, 11.0], [11.5, 7.2]], 0.72, 1.02, 'axeman_sos');
  spawnVillager('villager', -10, -8.4, [[-10, -8.4], [-6.5, -8.4], [-6.5, -5.8], [-10, -5.8]], 0.66, 0.96, 'wizard_sos');
  spawnVillager('merchant', -10.5, 10.9, [[-10.5, 10.9], [-6.8, 10.9], [-6.8, 8.2], [-10.5, 8.2]], 0.68, 1.0, 'archer_sos');
  spawnVillager('composer', 11, -7.6, [[11, -7.6], [8.2, -7.6], [8.2, -4.8], [11, -4.8]], 0.66, 0.95, 'wizard_sos');
  spawnVillager('villager', -2.2, 16.2, [[-2.2, 16.2], [2.2, 16.2], [2.2, 13.5], [-2.2, 13.5]], 0.70, 1.0, 'knight_sos');

  /* ---------------- NPC spots ---------------- */
  const npcSpots = {
    chief: { x: -8.5, z: -10.6, rotationY: 0 },
    blacksmith: { x: -11, z: -3.6, rotationY: Math.PI / 2 },
    merchant: { x: 10, z: 13.3, rotationY: Math.PI },
    trainer: { x: -9.5, z: 5.5, rotationY: Math.PI / 2 },
    composer: { x: PAG.x, z: PAG.z, rotationY: 0 },
    storage: { x: -4, z: 13.3, rotationY: Math.PI }
  };

  const spawnPoint = { x: 0, y: 0, z: 4.2 };
  const portalPos = { x: 0, y: 0, z: -16.5 };

  /* ---------------- update ---------------- */
  const tmp = { x: 0, z: 0 };
  function update(dt = 0.016, t = 0, playerPos = null) {
    dt = Math.min(dt, 0.1);
    const px = playerPos ? Number(playerPos.x ?? playerPos.position?.x ?? 0) : 1e9;
    const pz = playerPos ? Number(playerPos.z ?? playerPos.position?.z ?? 0) : 1e9;

    // lanterns: swing + soft flicker
    writeLanterns(t);
    lanternMat.emissiveIntensity = 1.05 + Math.sin(t * 7.1) * 0.1 + Math.sin(t * 13.7) * 0.07;
    waterMat.emissiveIntensity = 0.5 + Math.sin(t * 2.2) * 0.1;
    pondMat.emissiveIntensity = 0.32 + Math.sin(t * 1.6) * 0.06;
    hotSpringMat.emissiveIntensity = 0.78 + Math.sin(t * 2.2) * 0.12;
    coalMat.emissiveIntensity = 1.3 + Math.sin(t * 9) * 0.25 + Math.sin(t * 5.3) * 0.15;
    const fl = 1 + Math.sin(t * 11) * 0.12 + Math.sin(t * 17.3) * 0.08;
    flame.scale.set(fl, fl * (1 + Math.sin(t * 8) * 0.15), fl);
    flame.rotation.y = t * 2;

    for (const a of awnings) {
      a.g.rotation.x = a.base + Math.sin(t * a.sp + a.phase) * a.amp;
      a.g.rotation.z = Math.sin(t * 0.7 + a.phase) * 0.012;
    }
    for (const b of banners) {
      b.g.rotation.x = Math.sin(t * 1.5 + b.phase) * 0.14;
      b.g.rotation.z = Math.sin(t * 1.0 + b.phase * 1.7) * 0.07;
    }

    // smoke
    for (const p of puffs) {
      const u = (((t / p.life) + p.phase) % 1 + 1) % 1;
      p.mesh.position.set(p.src.x + u * 1.1 + Math.sin(u * 6 + p.phase * 9) * 0.12, p.src.y + u * 3.2, p.src.z + Math.cos(u * 5 + p.phase * 7) * 0.1);
      p.mesh.scale.setScalar(0.55 + u * 1.7);
      p.mesh.material.opacity = 0.42 * (1 - u) * Math.min(1, u * 6);
    }

    // pigeons
    for (const p of pigeons) {
      const m = p.mesh;
      p.cool = Math.max(0, p.cool - dt);
      const d = Math.hypot(px - p.home.x, pz - p.home.z);
      if (p.state === 'ground') {
        m.position.set(p.home.x, 0, p.home.z);
        m.rotation.set(Math.max(0, Math.sin(t * 3 + p.phase)) * 0.4, p.yaw + Math.sin(t * 0.5 + p.phase) * 0.4, 0);
        if (d < 3.4 && p.cool <= 0) {
          p.state = 'fly'; p.t = 0; p.timer = 2.6 + (p.phase % 1.7);
          const dx = p.home.x - px, dz = p.home.z - pz, l = Math.hypot(dx, dz) || 1;
          p.dir.x = dx / l + Math.sin(p.phase) * 0.4; p.dir.z = dz / l + Math.cos(p.phase) * 0.4;
        }
      } else if (p.state === 'fly') {
        p.t += dt;
        const k = Math.min(1, p.t / 1.0);
        const run = p.t * 2.4;
        m.position.set(p.home.x + p.dir.x * run + Math.sin(p.t * 2 + p.phase) * 0.6, k * 3.2 + Math.sin(t * 6) * 0.1, p.home.z + p.dir.z * run + Math.cos(p.t * 2 + p.phase) * 0.6);
        m.rotation.set(0, Math.atan2(p.dir.x, p.dir.z), Math.sin(t * 30 + p.phase) * 0.5);
        if (p.t > p.timer) { p.state = 'land'; p.t = 0; p.from = m.position.clone(); }
      } else {
        p.t += dt / 1.5;
        const k = Math.min(1, p.t), e = k * k * (3 - 2 * k);
        m.position.set(p.from.x + (p.home.x - p.from.x) * e, p.from.y * (1 - e), p.from.z + (p.home.z - p.from.z) * e);
        m.rotation.set(0, Math.atan2(p.home.x - p.from.x, p.home.z - p.from.z), Math.sin(t * 24 + p.phase) * 0.35 * (1 - k));
        if (k >= 1) { p.state = 'ground'; p.cool = 2.5; }
      }
    }

    // villagers & gate guards
    for (const v of villagers) {
      const m = v.mesh;
      const gy = v.groundY ?? 0.08;
      if (v.route.length && v.speed > 0) {
        const wp = v.route[v.idx];
        const dx = wp[0] - v.x, dz = wp[1] - v.z, dist = Math.hypot(dx, dz);
        if (v.wait > 0) {
          v.wait -= dt;
        } else if (dist < 0.25) {
          v.idx = (v.idx + 1) % v.route.length;
          // Pause in idle stance for 4.5..9.5s at every waypoint so villagers don't run endlessly
          v.wait = 4.5 + (v.phase % 5.0);
        } else {
          const step = Math.min(dist, v.speed * dt);
          v.x += (dx / dist) * step; v.z += (dz / dist) * step;
          v.yaw = angleLerp(v.yaw, Math.atan2(dx, dz), Math.min(1, dt * 6));
          m.position.set(v.x, gy, v.z);
          m.rotation.set(0, v.yaw, 0);
          m.userData?.animate?.('stroll', t + v.phase, dt);
          continue;
        }
        m.position.set(v.x, gy, v.z);
        m.rotation.set(0, v.yaw, 0);
        m.userData?.animate?.('idle', t + v.phase, dt);
      } else {
        m.position.set(v.x, gy, v.z);
        m.rotation.set(0, v.isGuard ? v.yaw : v.yaw + Math.sin(t * 0.4 + v.phase) * 0.35, 0);
        m.userData?.animate?.('idle', t + v.phase, dt);
      }
    }
    void tmp;
  }

  function dispose() {
    const mats = new Set();
    group.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((mm) => mats.add(mm));
      if (o.isInstancedMesh) o.dispose?.();
    });
    mats.forEach((mm) => mm.dispose());
    if (group.parent) group.parent.remove(group);
  }

  // register lights through the host (renderer-managed, cleared by clearWorld)
  if (addLight) {
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
    fountain,
    hotSprings: {
      x: HOT_SPRINGS.center.x,
      z: HOT_SPRINGS.center.z,
      radius: HOT_SPRINGS.radius,
      name: 'Jade Mist Hot Springs'
    },
    villagers,
    pigeons,
    lightCount: lights.length,
    update,
    dispose
  };
}

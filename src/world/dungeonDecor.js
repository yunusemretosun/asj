// Procedural ancient-tomb / Silk-Road ruin decor for dungeon floors.
// Everything repeated goes through one InstanceBatch (one InstancedMesh per primitive kind). Light-emitting
// props are emissive meshes plus an entry in gen._lightSources; the generator keeps a pool of at most 8
// PointLights that hop between the sources nearest the player (see DungeonGenerator._updateLightBudget).
import * as THREE from 'three';

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
  if (!g) { g = KIND_DEFS[kind].g(); geoCache.set(kind, g); }
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

/** True when any corridor tile sits within `pad` tiles of (x, z): keeps props out of doorways. */
export function nearOpening(gen, x, z, pad = 1) {
  const { gx, gz } = gen.worldToGrid(x, z);
  for (let dz = -pad; dz <= pad; dz++) {
    for (let dx = -pad; dx <= pad; dx++) {
      if (gen.getTileAtGrid(gx + dx, gz + dz) === 3) return true;
    }
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

function blocked(gen, x, z, pad = 1) {
  return nearOpening(gen, x, z, pad) || inReserved(gen, x, z);
}

/** Candidate spots hugging the room walls (side = which wall they sit against). */
function wallSpots(gen, room, inset = 1.3, step = 2.4, skip = 2.8) {
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
  return out.filter((s) => !blocked(gen, s.x, s.z, 1));
}

function solid(gen, x, z, radius) {
  gen.solidObstacles.push({ x, z, radius });
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
  for (const w of wallTiles) {
    if ((w.gx * 3 + w.gz * 5) % 4 !== 0) continue;
    let open = null; let n = 0;
    for (const d of dirs) {
      const t = gen.getTileAtGrid(w.gx + d[0], w.gz + d[1]);
      if (t === 1 || t === 3 || t === 4 || t === 5) { open = d; n++; }
    }
    if (n !== 1) continue; // only flat wall faces, never corners or doorways
    const p = gen.gridToWorld(w.gx, w.gz);
    const px = p.x + open[0] * (T * 0.5 - 0.02);
    const pz = p.z + open[1] * (T * 0.5 - 0.02);
    const h = 2.9;
    b.add('cyl', px, h * 0.5, pz, 0.62, h, 0.62, 0, jit(style.stone, rand, 0.2));
    b.add('box', px, 0.14, pz, 0.86, 0.28, 0.86, 0, tint(style.stone, 0.82));
    b.add('box', px, h - 0.1, pz, 0.86, 0.22, 0.86, 0, tint(style.stone, 0.9));
  }
}

/** Arched doorways where a corridor meets a room wall. */
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
        // a corridor tile directly outside the room edge; pull the arch back onto the room boundary
        const mx = (a.x + c.x) * 0.5 - s.dir[0] * T * 0.5;
        const mz = (a.z + c.z) * 0.5 - s.dir[1] * T * 0.5;
        const span = run.length * T;
        const ox = horiz ? span * 0.5 : 0;
        const oz = horiz ? 0 : span * 0.5;
        const stone = tint(style.stone, 0.95);
        b.add('box', mx - ox, 1.5, mz - oz, 0.62, 3.0, 0.62, 0, stone);
        b.add('box', mx + ox, 1.5, mz + oz, 0.62, 3.0, 0.62, 0, stone);
        b.add('box', mx, 3.05, mz, horiz ? span + 0.7 : 0.7, 0.42, horiz ? 0.7 : span + 0.7, 0, tint(style.stone, 1.05));
        b.add('cone', mx, 3.5, mz, 0.9, 0.55, 0.9, Math.PI / 4, tint(style.stone, 1.1));
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
  for (const room of gen.rooms) {
    const n = room.type === 'start' ? 2 : 4 + Math.floor(rand() * 4);
    for (let i = 0; i < n; i++) {
      // bias toward the room edge so rubble never clutters fight space
      const edge = rand() < 0.5;
      const x = edge ? room.x + (rand() < 0.5 ? 1.0 : room.w - 1.0) + (rand() - 0.5) * 0.8 : room.x + 1.2 + rand() * (room.w - 2.4);
      const z = edge ? room.z + 1.2 + rand() * (room.h - 2.4) : room.z + (rand() < 0.5 ? 1.0 : room.h - 1.0) + (rand() - 0.5) * 0.8;
      if (blocked(gen, x, z)) continue;
      const s = 0.22 + rand() * 0.3;
      b.add('rock', x, s * 0.4, z, s * 1.3, s, s * 1.1, rand() * 6.28, jit(style.rubble, rand, 0.3), rand() * 0.5, rand() * 0.5);
    }
  }
}

/** Torch = instanced stick + emissive flame; its light is borrowed from the pooled lights. */
export function addTorchInstance(b, gen, x, z, color, style) {
  b.add('cyl', x, 0.45, z, 0.1, 0.9, 0.1, 0, style.dark || 0x3a2a1a);
  b.add('glowCone', x, 1.0, z, 0.26, 0.42, 0.26, 0, color);
  addLight(gen, x, 1.6, z, color, 1.9, 13);
}

function candleCluster(b, gen, x, z, style, rand, light = true) {
  for (let i = 0; i < 3; i++) {
    const cx = x + (rand() - 0.5) * 0.5;
    const cz = z + (rand() - 0.5) * 0.5;
    const h = 0.22 + rand() * 0.22;
    b.add('cyl', cx, h * 0.5, cz, 0.1, h, 0.1, 0, style.wax || 0xf2ead2);
    b.add('glowCone', cx, h + 0.1, cz, 0.09, 0.2, 0.09, 0, style.flame);
  }
  if (light) addLight(gen, x, 0.9, z, style.flame, 1.5, 10);
}

function brazier(b, gen, x, z, color, bowlColor, scale = 1) {
  b.add('mcyl', x, 0.25 * scale, z, 0.2 * scale, 0.5 * scale, 0.2 * scale, 0, bowlColor);
  b.add('mcyl', x, 0.58 * scale, z, 0.62 * scale, 0.2 * scale, 0.62 * scale, 0, bowlColor);
  b.add('glowCone', x, 0.95 * scale, z, 0.46 * scale, 0.62 * scale, 0.46 * scale, 0, color);
  addLight(gen, x, 1.5 * scale, z, color, 2.1, 15);
  solid(gen, x, z, 0.4 * scale);
}

function statueFigure(b, x, z, ry, bodyCol, baseCol, rand, scale = 1) {
  b.add('box', x, 0.12 * scale, z, 0.9 * scale, 0.24 * scale, 0.9 * scale, ry, baseCol);
  b.add('cyl', x, 0.84 * scale, z, 0.5 * scale, 1.2 * scale, 0.42 * scale, ry, jit(bodyCol, rand, 0.12));
  b.add('box', x, 1.34 * scale, z, 0.78 * scale, 0.2 * scale, 0.4 * scale, ry, tint(bodyCol, 0.92));
  b.add('sphere', x, 1.68 * scale, z, 0.4 * scale, 0.44 * scale, 0.4 * scale, ry, jit(bodyCol, rand, 0.1));
}

// ---------------------------------------------------------------------------------------------
// Theme props
// ---------------------------------------------------------------------------------------------
function decorCave(b, gen, room, rand, st) {
  wallSpots(gen, room).forEach((s, i) => {
    if (i % 3 !== 0) return;
    // timber support: two posts and a crossbeam hugging the wall
    const horiz = s.side === 'N' || s.side === 'S';
    const ax = horiz ? 1 : 0; const az = horiz ? 0 : 1;
    for (const k of [-0.9, 0.9]) {
      b.add('box', s.x + ax * k, 1.3, s.z + az * k, 0.26, 2.6, 0.26, 0, jit(st.timber, rand));
    }
    b.add('box', s.x, 2.55, s.z, horiz ? 2.3 : 0.26, 0.26, horiz ? 0.26 : 2.3, 0, tint(st.timber, 0.9));
  });
  const corners = [[2.6, 2.6], [room.w - 2.6, 2.6], [2.6, room.h - 2.6], [room.w - 2.6, room.h - 2.6]];
  corners.forEach(([ox, oz], ci) => {
    if (rand() < 0.35) return;
    const cx = room.x + ox; const cz = room.z + oz;
    if (blocked(gen, cx, cz)) return;
    const c1 = ci % 2 ? st.ore2 : st.ore;
    for (let i = 0; i < 3; i++) {
      const a = rand() * 6.28; const d = 0.2 + rand() * 0.5;
      const h = 0.5 + rand() * 0.7;
      b.add('glowCone', cx + Math.cos(a) * d, h * 0.5, cz + Math.sin(a) * d, 0.3, h, 0.3, 0, tint(c1, 0.8 + rand() * 0.3), (rand() - 0.5) * 0.4, (rand() - 0.5) * 0.4);
    }
    if (ci % 2 === 0) addLight(gen, cx, 0.9, cz, c1, 1.4, 10);
  });
}

function decorCrypt(b, gen, room, rand, st) {
  wallSpots(gen, room).forEach((s, i) => {
    const horiz = s.side === 'N' || s.side === 'S';
    if (i % 4 === 0) {
      // sarcophagus (slab + lid)
      const ry = horiz ? Math.PI / 2 : 0;
      b.add('box', s.x, 0.3, s.z, 1.0, 0.6, 2.0, ry, jit(st.stone, rand, 0.15));
      b.add('box', s.x, 0.68, s.z, 1.1, 0.2, 2.1, ry, tint(st.stone, 1.1));
      solid(gen, s.x, s.z, 0.85);
    } else if (i % 4 === 2) {
      // bone niche sunk into the wall face
      const px = s.side === 'W' ? s.x - 0.95 : s.side === 'E' ? s.x + 0.95 : s.x;
      const pz = s.side === 'N' ? s.z - 1.0 : s.side === 'S' ? s.z + 1.0 : s.z;
      b.add('box', px, 1.3, pz, horiz ? 1.0 : 0.12, 1.1, horiz ? 0.12 : 1.0, 0, st.dark);
      b.add('sphere', px, 1.0, pz, 0.22, 0.24, 0.22, 0, st.bone);
      b.add('box', px, 1.45, pz, horiz ? 0.4 : 0.1, 0.08, horiz ? 0.1 : 0.4, 0.3, st.bone);
    } else if (i % 4 === 3 && rand() < 0.8) {
      const cx = s.x + (s.side === 'W' ? 0.5 : s.side === 'E' ? -0.5 : 0);
      const cz = s.z + (s.side === 'N' ? 0.5 : s.side === 'S' ? -0.5 : 0);
      candleCluster(b, gen, cx, cz, st, rand, rand() < 0.4);
    }
  });
}

function decorRuins(b, gen, room, rand, st) {
  wallSpots(gen, room).forEach((s, i) => {
    const horiz = s.side === 'N' || s.side === 'S';
    if (i % 3 === 0) {
      // broken pillar, varied height with a fallen drum beside it
      const h = 0.8 + rand() * 1.5;
      b.add('cyl', s.x, h * 0.5, s.z, 0.85, h, 0.85, 0, jit(st.stone, rand, 0.16));
      b.add('box', s.x, 0.12, s.z, 1.15, 0.24, 1.15, 0, tint(st.stone, 0.8));
      if (rand() < 0.6) b.add('cyl', s.x + 0.9, 0.3, s.z + 0.5, 0.7, 0.6, 0.7, 0, tint(st.stone, 0.9));
      solid(gen, s.x, s.z, 0.55);
    } else if (i % 3 === 1) {
      // vines creeping down the wall
      const wx = s.side === 'W' ? room.x + 0.05 : s.side === 'E' ? room.x + room.w - 0.05 : s.x;
      const wz = s.side === 'N' ? room.z + 0.05 : s.side === 'S' ? room.z + room.h - 0.05 : s.z;
      for (let k = 0; k < 3; k++) {
        const off = (k - 1) * 0.4;
        const len = 1.0 + rand() * 1.5;
        const vx = wx + (horiz ? off : 0); const vz = wz + (horiz ? 0 : off);
        b.add('box', vx, 2.7 - len * 0.5, vz, 0.07, len, 0.07, 0, rand() < 0.5 ? st.vine : st.vine2);
        b.add('sphere', vx, 2.7 - len, vz, 0.3, 0.14, 0.3, rand() * 3, st.vine2);
      }
    }
  });
  // toppled statue lying across a corner
  if (room.type !== 'start' && rand() < 0.6) {
    const sx = room.x + room.w - 3.2; const sz = room.z + room.h - 3.4;
    if (!blocked(gen, sx, sz, 2)) {
      b.add('cyl', sx, 0.3, sz, 0.55, 1.4, 0.55, 0, st.stone, Math.PI / 2, 0.3);
      b.add('sphere', sx + 0.4, 0.28, sz - 0.9, 0.42, 0.46, 0.42, 0, tint(st.stone, 1.05));
      b.add('box', sx - 1.0, 0.18, sz + 0.5, 0.9, 0.36, 0.9, 0.5, tint(st.stone, 0.8));
      solid(gen, sx, sz, 0.8);
    }
  }
}

function decorLava(b, gen, room, rand, st) {
  // glowing magma cracks: zig-zag chains of flat emissive slabs
  const cracks = room.type === 'start' ? 1 : 2 + Math.floor(rand() * 2);
  for (let c = 0; c < cracks; c++) {
    let x = room.x + 1.6 + rand() * (room.w - 3.2);
    let z = room.z + 1.6 + rand() * (room.h - 3.2);
    let a = rand() * 6.28;
    for (let i = 0; i < 5; i++) {
      const len = 0.8 + rand() * 0.9;
      const nx = x + Math.cos(a) * len; const nz = z + Math.sin(a) * len;
      if (!blocked(gen, nx, nz) && nx > room.x + 0.8 && nx < room.x + room.w - 0.8 && nz > room.z + 0.8 && nz < room.z + room.h - 0.8) {
        b.add('glowBox', (x + nx) * 0.5, 0.012, (z + nz) * 0.5, len, 0.025, 0.1, -Math.atan2(nz - z, nx - x), tint(st.magma, 0.75 + rand() * 0.35));
      }
      x = nx; z = nz; a += (rand() - 0.5) * 1.6;
    }
  }
  wallSpots(gen, room).forEach((s, i) => {
    if (i % 5 === 0) {
      // anvil: waist + face + horn
      b.add('mbox', s.x, 0.3, s.z, 0.5, 0.6, 0.5, s.ry, st.iron);
      b.add('mbox', s.x, 0.68, s.z, 0.45, 0.16, 1.1, s.ry, tint(st.iron, 1.2));
      b.add('cone', s.x, 0.68, s.z, 0.2, 0.55, 0.2, s.ry, tint(st.iron, 1.1), 0, Math.PI / 2);
      solid(gen, s.x, s.z, 0.6);
    } else if (i % 5 === 2) {
      // hanging chain from the ceiling beam
      b.add('mcyl', s.x, 2.1, s.z, 0.07, 1.6, 0.07, 0, st.iron);
      for (let k = 0; k < 4; k++) b.add('torus', s.x, 1.4 + k * 0.4, s.z, 0.24, 0.24, 0.24, k * 0.9, st.iron, (Math.PI / 2) * (k % 2));
      b.add('mbox', s.x, 2.85, s.z, 0.9, 0.12, 0.2, s.ry, st.iron);
    }
  });
}

function decorAbyss(b, gen, room, rand, st) {
  if (room.type !== 'start') {
    // terracotta warriors drawn up in two ranks along the long walls
    [room.x + 2.2, room.x + room.w - 2.2].forEach((rx, ri) => {
      for (let z = room.z + 3.0; z <= room.z + room.h - 3.0; z += 2.6) {
        if (blocked(gen, rx, z, 1) || Math.abs(z - room.centerZ) < 1.8 || rand() < 0.2) continue;
        statueFigure(b, rx, z, ri === 0 ? Math.PI / 2 : -Math.PI / 2, st.clay, tint(st.stone, 0.9), rand, 0.9);
        solid(gen, rx, z, 0.42);
      }
    });
  }
  wallSpots(gen, room).forEach((s, i) => {
    if (i % 6 === 1) {
      // bronze mirror on a stand
      b.add('mbox', s.x, 0.7, s.z, 0.14, 1.4, 0.14, 0, st.bronze);
      b.add('mcyl', s.x, 1.55, s.z, 0.95, 0.07, 0.95, s.ry, st.bronze, Math.PI / 2 - 0.15, 0);
      b.add('glowCyl', s.x, 1.55, s.z, 0.72, 0.075, 0.72, s.ry, 0x6d7a99, Math.PI / 2 - 0.15, 0);
      solid(gen, s.x, s.z, 0.4);
    } else if (i % 6 === 4) {
      brazier(b, gen, s.x, s.z, st.jadeGlow, st.jade, 1.0);
    }
  });
  // quicksilver pool
  if (room.type !== 'start' && rand() < 0.75) {
    const px = room.x + 3.4 + rand() * (room.w - 6.8);
    const pz = room.z + 3.4 + rand() * (room.h - 6.8);
    if (!blocked(gen, px, pz, 2) && Math.hypot(px - room.centerX, pz - room.centerZ) > 3.6) {
      b.add('cyl', px, 0.02, pz, 2.8, 0.04, 2.5, 0, tint(st.dark, 1.2));
      b.add('pool', px, 0.03, pz, 2.4 + rand() * 0.6, 0.05, 2.0 + rand() * 0.5, rand() * 3);
    }
  }
}

const THEME_DECORATORS = { cave: decorCave, crypt: decorCrypt, ruins: decorRuins, lava: decorLava, abyss: decorAbyss };

/** Per-floor ambient decor pass: wall pillars, arches, rubble and per-theme props in every room. */
export function decorateFloor(gen, b, rand, wallTiles) {
  const st = styleFor(gen.theme);
  addWallPillars(b, gen, wallTiles, st, rand);
  addDoorArches(b, gen, st);
  addRubble(b, gen, rand, st);
  const fn = THEME_DECORATORS[gen.theme?.decor] || decorCave;
  for (const room of gen.rooms) {
    if (room.type === 'boss') continue; // the arena has its own set piece
    fn(b, gen, room, rand, st);
  }
}

// ---------------------------------------------------------------------------------------------
// Special room dressing
// ---------------------------------------------------------------------------------------------
export function dressSpecialRoom(gen, b, room, kind, rand) {
  const st = styleFor(gen.theme);
  const figureCol = gen.theme?.decor === 'abyss' ? st.clay : st.stone;
  if (kind === 'processional') {
    // long hall: aisle runner, statue rows down both sides, candle clusters at either end
    b.add('box', room.centerX, 0.012, room.centerZ, room.w - 4.0, 0.025, 2.6, 0, tint(st.dark, 1.6));
    for (const side of [-1, 1]) {
      const rz = room.centerZ + side * 4.4;
      for (let x = room.x + 2.6; x <= room.x + room.w - 2.6 + 0.01; x += 2.6) {
        if (Math.abs(x - room.centerX) < 2.8 || blocked(gen, x, rz, 1)) continue;
        statueFigure(b, x, rz, side < 0 ? 0 : Math.PI, figureCol, tint(st.stone, 0.85), rand, 1.05);
        solid(gen, x, rz, 0.45);
      }
    }
    candleCluster(b, gen, room.x + 1.6, room.centerZ - 1.6, st, rand, true);
    candleCluster(b, gen, room.x + room.w - 1.6, room.centerZ + 1.6, st, rand, true);
  } else if (kind === 'trap_gallery') {
    // faint glowing studs mark the safe lane
    for (let z = room.z + 1.6; z <= room.z + room.h - 1.6; z += 1.4) {
      b.add('glowBox', room.centerX, 0.02, z, 0.22, 0.03, 0.22, 0, tint(st.flame, 0.55));
    }
    for (let x = room.x + 1.6; x <= room.x + room.w - 1.6; x += 1.4) {
      b.add('glowBox', x, 0.02, room.centerZ, 0.22, 0.03, 0.22, 0, tint(st.flame, 0.55));
    }
  } else if (kind === 'shrine') {
    b.add('cyl', room.centerX, 0.012, room.centerZ, 4.4, 0.025, 4.4, 0, tint(st.dark, 1.5));
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + 0.3;
      candleCluster(b, gen, room.centerX + Math.cos(a) * 2.5, room.centerZ + Math.sin(a) * 2.5, st, rand, i % 3 === 0);
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
    solid(gen, x, z, 0.55);
  };
  const gateZ = ez - sz * D * 0.5;
  const fz = ez - sz * D;
  for (let t = 0.5; t <= D + 0.01; t += 1.0) {
    const z = ez - sz * t;
    if (Math.abs(z - gateZ) < 1.3) continue;
    post(fx, z); // fence A runs along z at x = fx and holds the gate gap
  }
  for (let t = 0.5; t <= D + 0.01; t += 1.0) post(ex - sx * t, fz); // fence B, solid
  post(fx, fz); // inner corner post
  b.add('box', (ex + fx) * 0.5, 0.02, (ez + fz) * 0.5, D - 0.4, 0.04, D - 0.4, 0, tint(gold, 0.7));
  return {
    center: at(D * 0.5, D * 0.5),
    gate: { x: fx, z: gateZ },
    slots: [at(2.4, 2.2), at(1.0, 1.3), at(1.0, 3.1)]
  };
}

// ---------------------------------------------------------------------------------------------
// Boss arena set piece
// ---------------------------------------------------------------------------------------------
export function decorateBossArenaProps(gen, b, room, rand) {
  const st = styleFor(gen.theme);
  const cx = room.centerX; const cz = room.centerZ;
  const R = 7.6;
  // dais: stepped discs + glowing rune ring
  b.add('cyl', cx, 0.03, cz, 7.2, 0.06, 7.2, 0, tint(st.stone, 0.85));
  b.add('cyl', cx, 0.07, cz, 5.2, 0.05, 5.2, 0, st.stone);
  b.add('glowTorus', cx, 0.04, cz, 9.6, 9.6, 0.3, 0, tint(st.flame, 0.8), Math.PI / 2);
  // pillar ring
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
    const px = cx + Math.cos(a) * R; const pz = cz + Math.sin(a) * R;
    b.add('cyl', px, 1.8, pz, 1.1, 3.6, 1.1, 0, jit(st.stone, rand, 0.14));
    b.add('box', px, 0.22, pz, 1.6, 0.44, 1.6, 0, tint(st.stone, 0.8));
    b.add('box', px, 3.65, pz, 1.5, 0.35, 1.5, 0, tint(st.stone, 1.0));
    solid(gen, px, pz, 0.78);
  }
  // braziers on the diagonals (corridor mouths sit on the room axes)
  const flame = gen.theme?.decor === 'abyss' ? st.jadeGlow : 0xef4444;
  const bowl = st.iron || st.bronze || st.stone;
  for (let i = 0; i < 4; i++) {
    const a = Math.PI / 4 + (i / 4) * Math.PI * 2;
    brazier(b, gen, cx + Math.cos(a) * 6.2, cz + Math.sin(a) * 6.2, flame, bowl, 1.2);
  }
  return { center: { x: cx, z: cz }, radius: R + 1.2 };
}

// ---------------------------------------------------------------------------------------------
// Puzzle props (individual meshes; they animate / rotate)
// ---------------------------------------------------------------------------------------------
const puzzleMats = {};
function pmat(key, opts) {
  if (!puzzleMats[key]) puzzleMats[key] = new THREE.MeshStandardMaterial(opts);
  return puzzleMats[key];
}

export const BELL_PITCHES = ['Low', 'Middle', 'High'];

export function buildBellMesh(pitch = 'Middle') {
  const idx = Math.max(0, BELL_PITCHES.indexOf(pitch));
  const tone = [0x8a5a2b, 0xc08a3e, 0xe3c15a][idx];
  const wood = pmat('bellWood', { color: 0x5a3b22, roughness: 0.85, metalness: 0.05 });
  const bronze = pmat(`bell${idx}`, { color: tone, roughness: 0.35, metalness: 0.4, emissive: new THREE.Color(tone), emissiveIntensity: 0.25 });
  const g = new THREE.Group();
  g.name = `Bell_${pitch}`;
  const postL = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.9, 0.16), wood); postL.position.set(-0.55, 0.95, 0);
  const postR = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.9, 0.16), wood); postR.position.set(0.55, 0.95, 0);
  const beam = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.14, 0.16), wood); beam.position.set(0, 1.85, 0);
  const swing = new THREE.Group(); swing.position.set(0, 1.78, 0);
  const sz = 0.34 + (2 - idx) * 0.06;
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

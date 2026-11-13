import * as THREE from 'three';
import { BERSERK } from '../systems/mechanics.js';

let sroRingTex = null;
let sroNebulaTex = null;

function getSroFxTextures() {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return { ring: null, nebula: null };
  }
  if (!sroRingTex) {
    try {
      const loader = new THREE.TextureLoader();
      sroRingTex = loader.load('/assets/sro/fx/01ring.png');
      sroRingTex.colorSpace = THREE.SRGBColorSpace;
      sroNebulaTex = loader.load('/assets/sro/fx/blade-nebula.jpg');
      sroNebulaTex.colorSpace = THREE.SRGBColorSpace;
    } catch {
      // Fallback if browser loader encounters an error
    }
  }
  return { ring: sroRingTex, nebula: sroNebulaTex };
}

const THEME_CONFIGS = {
  village: {
    bg: 0x1e293b,
    fog: 0x1e293b,
    fogNear: 75,
    fogFar: 215,
    ambientColor: 0xe2e8f0,
    ambientIntensity: 1.75,
    hemiSky: 0xf8fafc,
    hemiGround: 0x64748b,
    hemiIntensity: 1.35,
    dirColor: 0xfffbeb,
    dirIntensity: 2.1,
    heroLightColor: 0xfff7ed,
    heroLightIntensity: 2.2,
    fillLightColor: 0xe0f2fe,
    fillLightIntensity: 1.8
  },
  cave: {
    bg: 0x141a18,
    fog: 0x141a18,
    fogNear: 48,
    fogFar: 115,
    ambientColor: 0xdcfce7,
    ambientIntensity: 1.85,
    hemiSky: 0xecfdf5,
    hemiGround: 0x52525b,
    hemiIntensity: 1.45,
    dirColor: 0xfef08a,
    dirIntensity: 1.95,
    heroLightColor: 0xa7f3d0,
    heroLightIntensity: 2.85,
    fillLightColor: 0x86efac,
    fillLightIntensity: 2.25
  },
  crypt: {
    bg: 0x0f172a,
    fog: 0x0f172a,
    fogNear: 40,
    fogFar: 100,
    ambientColor: 0x94a3b8,
    ambientIntensity: 1.75,
    hemiSky: 0xc7d2fe,
    hemiGround: 0x1e293b,
    hemiIntensity: 1.35,
    dirColor: 0x38bdf8,
    dirIntensity: 1.90,
    heroLightColor: 0x93c5fd,
    heroLightIntensity: 2.85,
    fillLightColor: 0x64748b,
    fillLightIntensity: 2.15
  },
  ruins: {
    bg: 0x1c1917,
    fog: 0x1c1917,
    fogNear: 44,
    fogFar: 110,
    ambientColor: 0xfef08a,
    ambientIntensity: 1.85,
    hemiSky: 0xfef9c3,
    hemiGround: 0x44403c,
    hemiIntensity: 1.45,
    dirColor: 0xfde047,
    dirIntensity: 2.05,
    heroLightColor: 0xfde047,
    heroLightIntensity: 2.80,
    fillLightColor: 0xfde68a,
    fillLightIntensity: 2.25
  },
  lava: {
    bg: 0x27170a,
    fog: 0x27170a,
    fogNear: 42,
    fogFar: 105,
    ambientColor: 0xfed7aa,
    ambientIntensity: 1.85,
    hemiSky: 0xffedd5,
    hemiGround: 0x7c2d12,
    hemiIntensity: 1.40,
    dirColor: 0xfb923c,
    dirIntensity: 2.10,
    heroLightColor: 0xfdba74,
    heroLightIntensity: 2.90,
    fillLightColor: 0xd97706,
    fillLightIntensity: 2.25
  },
  boss: {
    bg: 0x1f0b0c,
    fog: 0x1f0b0c,
    fogNear: 38,
    fogFar: 95,
    ambientColor: 0xfecaca,
    ambientIntensity: 1.80,
    hemiSky: 0xfee2e2,
    hemiGround: 0x450a0a,
    hemiIntensity: 1.40,
    dirColor: 0xef4444,
    dirIntensity: 2.10,
    heroLightColor: 0xf87171,
    heroLightIntensity: 2.95,
    fillLightColor: 0xb91c1c,
    fillLightIntensity: 2.30
  }
};

export class Renderer {
  constructor(container = null) {
    this.container = container || document.getElementById('canvas-container') || document.body;
    this.fctContainer = document.getElementById('floating-combat-text') || this.container;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(THEME_CONFIGS.village.bg);
    this.scene.fog = new THREE.Fog(THEME_CONFIGS.village.fog, THEME_CONFIGS.village.fogNear, THEME_CONFIGS.village.fogFar);

    const width = window.innerWidth || 1280;
    const height = window.innerHeight || 720;

    this.camera = new THREE.PerspectiveCamera(44, width / height, 0.1, 340);
    this.cameraTarget = new THREE.Vector3(0, 0, 0);
    this._scratchTarget = new THREE.Vector3(0, 0, 0);
    this._scratchProj = new THREE.Vector3(0, 0, 0);
    this._scratchRayTarget = new THREE.Vector3(0, 0, 0);
    this._scratchNdc = new THREE.Vector2(0, 0);
    this.cameraZoom = 1.0;
    this.cameraYaw = 0; // Orbit angle around Y
    this.cameraPitchHeight = 13.5;
    this.cameraDistance = 14.5;

    this.shakeTimer = 0;
    this.shakeDuration = 0.25;
    this.shakeIntensity = 0;

    this.webglRenderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance'
    });
    this.webglRenderer.setSize(width, height);
    this.webglRenderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.webglRenderer.shadowMap.enabled = true;
    this.webglRenderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.webglRenderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.webglRenderer.toneMappingExposure = 1.48;

    this.container.appendChild(this.webglRenderer.domElement);

    // Core lights — boosted for bright, high-visibility dungeon exploration
    this.hemiLight = new THREE.HemisphereLight(0xf8fafc, 0x64748b, 1.4);
    this.scene.add(this.hemiLight);

    this.ambientLight = new THREE.AmbientLight(0xe2e8f0, 1.8);
    this.scene.add(this.ambientLight);

    this.dirLight = new THREE.DirectionalLight(0xfffbeb, 2.0);
    this.dirLight.position.set(12, 26, 14);
    this.dirLight.castShadow = true;
    this.dirLight.shadow.mapSize.width = 1024;
    this.dirLight.shadow.mapSize.height = 1024;
    this.dirLight.shadow.camera.near = 2;
    this.dirLight.shadow.camera.far = 75;
    const d = 22;
    this.dirLight.shadow.camera.left = -d;
    this.dirLight.shadow.camera.right = d;
    this.dirLight.shadow.camera.top = d;
    this.dirLight.shadow.camera.bottom = -d;
    this.dirLight.shadow.bias = -0.0005;
    this.scene.add(this.dirLight);
    this.scene.add(this.dirLight.target);

    // Warm personal hero lantern light (close-to-mid range)
    this.heroLight = new THREE.PointLight(0xffedd5, 2.8, 32, 1.05);
    this.heroLight.position.set(0, 3.2, 0);
    this.scene.add(this.heroLight);

    // Wide overhead fill light following the hero so entire rooms & corridors are well-lit
    this.heroFillLight = new THREE.PointLight(0xfff7ed, 2.25, 48, 0.9);
    this.heroFillLight.position.set(0, 9.5, 0);
    this.scene.add(this.heroFillLight);

    this.dynamicLights = [];
    this.vfxList = [];
    this.particles = [];
    this.floatingTexts = [];

    this.vfxGroup = new THREE.Group();
    this.vfxGroup.name = 'VFXGroup';
    this.scene.add(this.vfxGroup);

    this.raycaster = new THREE.Raycaster();
    this.groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

    // Shared particle geometry
    this._unitBoxGeo = new THREE.BoxGeometry(1, 1, 1);
    this._unitSphereGeo = new THREE.SphereGeometry(0.5, 6, 6);

    this._onResize = () => {
      const w = window.innerWidth || 1280;
      const h = window.innerHeight || 720;
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.webglRenderer.setSize(w, h);
    };
    window.addEventListener('resize', this._onResize);

    // Mouse wheel camera zoom
    this._onWheel = (e) => {
      if (e.target && e.target !== this.webglRenderer.domElement && !this.container.contains(e.target)) return;
      this.setZoom(this.cameraZoom + (e.deltaY > 0 ? 0.08 : -0.08));
    };
    window.addEventListener('wheel', this._onWheel, { passive: true });
  }

  get domElement() {
    return this.webglRenderer.domElement;
  }

  setEnvironmentTheme(themeName = 'village') {
    const key = String(themeName || 'village').toLowerCase();
    const cfg = THEME_CONFIGS[key]
      || (key.includes('crypt') || key.includes('undead') ? THEME_CONFIGS.crypt
        : key.includes('lava') || key.includes('fire') || key.includes('hell') ? THEME_CONFIGS.lava
        : key.includes('ruin') || key.includes('forest') ? THEME_CONFIGS.ruins
        : key.includes('boss') ? THEME_CONFIGS.boss
        : key.includes('village') || key.includes('town') || key.includes('hub') ? THEME_CONFIGS.village
        : THEME_CONFIGS.cave);

    const defaultThemeWeather = {
      village: 'petals',
      cave: 'spores',
      crypt: 'mist',
      ruins: 'incense',
      lava: 'sand',
      boss: 'embers'
    };

    const targetThemeId = cfg === THEME_CONFIGS.village ? 'village'
      : cfg === THEME_CONFIGS.cave ? 'cave'
      : cfg === THEME_CONFIGS.crypt ? 'crypt'
      : cfg === THEME_CONFIGS.ruins ? 'ruins'
      : cfg === THEME_CONFIGS.lava ? 'lava'
      : cfg === THEME_CONFIGS.boss ? 'boss' : 'cave';

    this._atmo = null;
    this._setDust?.(false);
    this.setWeather?.(defaultThemeWeather[targetThemeId] || null);
    this.scene.background.setHex(cfg.bg);
    if (this.scene.fog) {
      this.scene.fog.color.setHex(cfg.fog);
      this.scene.fog.near = cfg.fogNear;
      this.scene.fog.far = cfg.fogFar;
    }
    this.ambientLight.color.setHex(cfg.ambientColor);
    this.ambientLight.intensity = cfg.ambientIntensity;
    this.hemiLight.color.setHex(cfg.hemiSky);
    this.hemiLight.groundColor.setHex(cfg.hemiGround);
    this.hemiLight.intensity = cfg.hemiIntensity;
    this.dirLight.color.setHex(cfg.dirColor);
    this.dirLight.intensity = cfg.dirIntensity;
    this.heroLight.color.setHex(cfg.heroLightColor);
    this.heroLight.intensity = cfg.heroLightIntensity;
    this.heroFillLight.color.setHex(cfg.fillLightColor);
    this.heroFillLight.intensity = cfg.fillLightIntensity;
  }

  /**
   * Apply a per-floor atmosphere override on top of the current theme (floorData.atmosphere from
   * dungeonGenerator). Fog/ambient/key light blend smoothly over ~0.6s in update(). Values are
   * clamped so tombs stay moody but readable from the isometric camera.
   * atm: { fogColor, fogNear, fogFar, ambientColor, ambientIntensity, keyLightColor, keyLightIntensity, dust, weather, weatherColor }
   */
  applyAtmosphere(atm = null) {
    if (!atm || typeof atm !== 'object') {
      this._atmo = null;
      this._setDust(false);
      return;
    }
    const num = (v, d) => (Number.isFinite(Number(v)) ? Number(v) : d);
    const fog = this.scene.fog;
    const target = {
      fogColor: new THREE.Color(num(atm.fogColor, fog ? fog.color.getHex() : 0x000000)),
      fogNear: Math.max(6, num(atm.fogNear, fog ? fog.near : 20)),
      fogFar: Math.max(28, num(atm.fogFar, fog ? fog.far : 60)),
      ambientColor: new THREE.Color(num(atm.ambientColor, this.ambientLight.color.getHex())),
      ambientIntensity: Math.max(0.55, num(atm.ambientIntensity, this.ambientLight.intensity)),
      keyColor: new THREE.Color(num(atm.keyLightColor, this.dirLight.color.getHex())),
      keyIntensity: Math.max(0.35, num(atm.keyLightIntensity, this.dirLight.intensity)),
    };
    target.fogFar = Math.max(target.fogFar, target.fogNear + 14);
    this._atmo = { target, t: 0 };
    this._setDust(!!atm.dust, atm.fogColor);
    if (atm.weather !== undefined) {
      this.setWeather(atm.weather, { color: atm.weatherColor });
    }
  }

  _updateAtmosphere(dt) {
    const a = this._atmo;
    if (!a) return;
    a.t = Math.min(1, a.t + dt / 0.6);
    const k = Math.min(1, dt * 6);
    const T = a.target;
    const fog = this.scene.fog;
    if (fog) {
      fog.color.lerp(T.fogColor, k);
      fog.near += (T.fogNear - fog.near) * k;
      fog.far += (T.fogFar - fog.far) * k;
      if (this.scene.background && this.scene.background.isColor) this.scene.background.lerp(T.fogColor, k);
    }
    this.ambientLight.color.lerp(T.ambientColor, k);
    this.ambientLight.intensity += (T.ambientIntensity - this.ambientLight.intensity) * k;
    this.dirLight.color.lerp(T.keyColor, k);
    this.dirLight.intensity += (T.keyIntensity - this.dirLight.intensity) * k;
    if (a.t >= 1 && k >= 1) this._atmo = { target: T, t: 1 };
  }

  /** Cheap floating dust motes around the hero (one Points object, reused). */
  _setDust(on, tint = 0xd6c7a1) {
    if (!on) { if (this._dust) this._dust.visible = false; return; }
    if (!this._dust) {
      const n = 160;
      const pos = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        pos[i * 3] = (Math.random() - 0.5) * 30;
        pos[i * 3 + 1] = Math.random() * 5;
        pos[i * 3 + 2] = (Math.random() - 0.5) * 30;
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      const mat = new THREE.PointsMaterial({ size: 0.07, transparent: true, opacity: 0.55, depthWrite: false, color: 0xd6c7a1 });
      this._dust = new THREE.Points(geo, mat);
      this._dust.userData.noFlash = true;
      this._dust.frustumCulled = false;
      this.scene.add(this._dust);
    }
    const c = new THREE.Color(Number.isFinite(Number(tint)) ? Number(tint) : 0xd6c7a1);
    this._dust.material.color.copy(c).lerp(new THREE.Color(0xffffff), 0.6);
    this._dust.visible = true;
  }

  _updateDust(dt, elapsed, heroPos) {
    const d = this._dust;
    if (!d || !d.visible) return;
    if (heroPos) { d.position.x = heroPos.x; d.position.z = heroPos.z; }
    d.rotation.y = elapsed * 0.02;
    d.position.y = Math.sin(elapsed * 0.4) * 0.15;
  }

  /**
   * Ambient weather / atmospheric particle system around the hero:
   * ('mist' | 'spores' | 'incense' | 'sand' | 'embers' | 'petals' | 'snow' | 'rain' | null).
   *
   * Rules:
   * - Fallback is NEVER snow. If kind is missing, null, 'none', 'clear', 'off', or unknown,
   *   particles are turned off.
   * - Snow is restricted exclusively to frozen summits. Normal dungeon floors NEVER receive snow.
   */
  setWeather(kind = null, options = {}) {
    const w = kind ? String(kind).toLowerCase().trim() : '';
    if (!w || w === 'none' || w === 'clear' || w === 'off' || w === 'null') {
      this._weatherKind = null;
      this._weatherCfg = null;
      if (this._weatherPoints) this._weatherPoints.visible = false;
      return;
    }

    const presets = {
      // 1. mist: Crypts, catacombs & graveyards - low cold ground mist, slow drifting pale slate specks
      mist: {
        color: 0x94a3b8,
        size: 0.16,
        opacity: 0.38,
        vy: -0.06,
        vx: 0.22,
        vz: 0.16,
        sway: 0.45,
        spanY: 3.8,
        minY: 0.08,
        blending: THREE.NormalBlending
      },
      // 2. spores: Caves & subterranean mines - bioluminescent emerald/amber spores drifting upward
      spores: {
        color: 0x86efac,
        size: 0.10,
        opacity: 0.70,
        vy: 0.65,
        vx: 0.20,
        vz: 0.22,
        sway: 0.85,
        spanY: 6.5,
        minY: 0.10,
        blending: THREE.AdditiveBlending
      },
      // 3. incense: Qin-Shi tombs & ancient ruins - ancient temple gold dust and rising incense embers
      incense: {
        color: 0xfde047,
        size: 0.09,
        opacity: 0.75,
        vy: 0.85,
        vx: 0.32,
        vz: -0.20,
        sway: 1.05,
        spanY: 7.2,
        minY: 0.10,
        blending: THREE.AdditiveBlending
      },
      // 4. sand: Taklamakan desert & arid wastes - strong windblown sandstorm grains sweeping horizontally
      sand: {
        color: 0xd97706,
        size: 0.08,
        opacity: 0.68,
        vy: -0.32,
        vx: 4.80,
        vz: 1.50,
        sway: 0.40,
        spanY: 6.0,
        minY: 0.10,
        blending: THREE.NormalBlending
      },
      // 5. embers: Magma caverns & underworld abyss - hot red/orange fiery embers rising from the deep
      embers: {
        color: 0xef4444,
        size: 0.11,
        opacity: 0.85,
        vy: 2.30,
        vx: 0.35,
        vz: -0.25,
        sway: 0.95,
        spanY: 7.8,
        minY: 0.10,
        blending: THREE.AdditiveBlending
      },
      // 6. petals: Village / safe hub - soft pink cherry blossom petals drifting gracefully downward
      petals: {
        color: 0xfbcfe8,
        size: 0.11,
        opacity: 0.72,
        vy: -1.25,
        vx: 0.55,
        vz: 0.35,
        sway: 1.25,
        spanY: 7.5,
        minY: 0.10,
        blending: THREE.NormalBlending
      },
      // 7. snow: Reserved ONLY for true icy mountain summits
      snow: {
        color: 0xe2e8f0,
        size: 0.12,
        opacity: 0.78,
        vy: -2.10,
        vx: 0.45,
        vz: 0.30,
        sway: 1.10,
        spanY: 8.0,
        minY: 0.10,
        blending: THREE.NormalBlending
      },
      // 8. rain: Heavy downpour
      rain: {
        color: 0x93c5fd,
        size: 0.11,
        opacity: 0.62,
        vy: -13.5,
        vx: -1.60,
        vz: 0.80,
        sway: 0.15,
        spanY: 9.0,
        minY: 0.10,
        blending: THREE.NormalBlending
      }
    };

    const cfg = presets[w];
    // CRITICAL: NEVER fallback to snow! If unknown, hide particles and clear weather.
    if (!cfg) {
      this._weatherKind = null;
      this._weatherCfg = null;
      if (this._weatherPoints) this._weatherPoints.visible = false;
      return;
    }

    this._weatherKind = w;
    this._weatherCfg = {
      ...cfg,
      color: Number.isFinite(Number(options?.color)) ? Number(options.color) : cfg.color
    };

    if (!this._weatherPoints) {
      const count = 180;
      const pos = new Float32Array(count * 3);
      const phases = new Float32Array(count);
      for (let i = 0; i < count; i++) {
        pos[i * 3] = (Math.random() - 0.5) * 72;
        pos[i * 3 + 1] = Math.random() * 8.5;
        pos[i * 3 + 2] = (Math.random() - 0.5) * 72;
        phases[i] = Math.random() * Math.PI * 2;
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      const mat = new THREE.PointsMaterial({
        size: this._weatherCfg.size,
        color: this._weatherCfg.color,
        transparent: true,
        opacity: this._weatherCfg.opacity,
        depthWrite: false,
        blending: this._weatherCfg.blending || THREE.AdditiveBlending
      });
      this._weatherPoints = new THREE.Points(geo, mat);
      this._weatherPoints.userData.noFlash = true;
      this._weatherPoints.userData.phases = phases;
      this._weatherPoints.frustumCulled = false;
      this.scene.add(this._weatherPoints);
    }

    const mat = this._weatherPoints.material;
    mat.color.setHex(this._weatherCfg.color);
    mat.size = this._weatherCfg.size;
    mat.opacity = this._weatherCfg.opacity;
    mat.blending = this._weatherCfg.blending || THREE.AdditiveBlending;
    mat.needsUpdate = true;

    // Reposition any particles outside the new vertical bounds immediately
    const posAttr = this._weatherPoints.geometry.getAttribute('position');
    if (posAttr && posAttr.array) {
      const arr = posAttr.array;
      const spanY = this._weatherCfg.spanY || 8.0;
      const minY = this._weatherCfg.minY ?? 0.08;
      for (let i = 1; i < arr.length; i += 3) {
        if (arr[i] < minY || arr[i] > minY + spanY) {
          arr[i] = minY + Math.random() * spanY;
        }
      }
      posAttr.needsUpdate = true;
    }

    this._weatherPoints.visible = true;
  }

  _updateWeather(dt, elapsed, heroPos) {
    const pts = this._weatherPoints;
    const cfg = this._weatherCfg;
    if (!pts || !pts.visible || !cfg) return;

    // Accompany hero / camera smoothly across a wide 72x72 area instead of hard-snapping to hero's head
    const targetX = this.cameraTarget ? this.cameraTarget.x : (heroPos ? (heroPos.x || 0) : 0);
    const targetZ = this.cameraTarget ? this.cameraTarget.z : (heroPos ? (heroPos.z || 0) : 0);
    if (!pts.userData.initializedPos) {
      pts.position.x = targetX;
      pts.position.z = targetZ;
      pts.userData.initializedPos = true;
    } else {
      const dx = targetX - pts.position.x;
      const dz = targetZ - pts.position.z;
      const distSq = dx * dx + dz * dz;
      if (distSq > 900) {
        // Fast snap on floor transition / distant teleport
        pts.position.x = targetX;
        pts.position.z = targetZ;
      } else {
        // Gentle lerp with wide tolerance so particles do not bunch up on top of character
        const k = Math.min(1, dt * 2.0);
        pts.position.x += dx * k;
        pts.position.z += dz * k;
      }
    }

    const attr = pts.geometry.getAttribute('position');
    const arr = attr.array;
    const phases = pts.userData.phases;
    const n = phases.length;
    const spanY = cfg.spanY || 8.0;
    const minY = cfg.minY ?? 0.08;
    for (let i = 0; i < n; i++) {
      const idx = i * 3;
      const ph = phases[i];
      arr[idx] += (cfg.vx + Math.sin(elapsed * 1.7 + ph) * cfg.sway) * dt;
      arr[idx + 1] += cfg.vy * dt;
      arr[idx + 2] += (cfg.vz + Math.cos(elapsed * 1.4 + ph) * cfg.sway) * dt;
      if (arr[idx + 1] < minY) arr[idx + 1] += spanY;
      else if (arr[idx + 1] > minY + spanY) arr[idx + 1] -= spanY;
      if (arr[idx] < -36) arr[idx] += 72;
      else if (arr[idx] > 36) arr[idx] -= 72;
      if (arr[idx + 2] < -36) arr[idx + 2] += 72;
      else if (arr[idx + 2] > 36) arr[idx + 2] -= 72;
    }
    attr.needsUpdate = true;
  }

  /**
   * Brighten dark floor/wall meshes in a world group so dungeons are always vivid and readable.
   * Skips InstancedMesh (tuned per-instance vertex colors) and avoids double-brightening shared materials.
   */
  brightenWorldMaterials(rootObject = this.scene) {
    if (!rootObject || typeof rootObject.traverse !== 'function') return;
    const hsl = { h: 0, s: 0, l: 0 };
    rootObject.traverse((obj) => {
      if (!obj.isMesh || obj.isInstancedMesh || obj.userData?.skipBrighten || !obj.material) return;
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      for (const mat of mats) {
        if (!mat || !mat.color || mat.userData?.__brightened || mat.userData?.skipBrighten) continue;
        mat.userData = { ...(mat.userData || {}), __brightened: true };
        mat.color.getHSL(hsl);
        // Lift overly dark dungeon floor/wall surfaces so details pop clearly
        if (hsl.l > 0.01 && hsl.l < 0.34) {
          const boostedL = Math.min(0.46, hsl.l * 1.38 + 0.06);
          mat.color.setHSL(hsl.h, Math.min(1, hsl.s * 1.08), boostedL);
        }
        // High metalness without an envMap makes standard materials look dark; keep roughness balanced
        if (typeof mat.metalness === 'number' && mat.metalness > 0.35 && !mat.envMap) {
          mat.metalness = Math.min(0.32, mat.metalness * 0.55);
        }
        if (typeof mat.roughness === 'number' && mat.roughness > 0.85) {
          mat.roughness = 0.72;
        }
      }
    });
  }

  setZoom(zoom) {
    this.cameraZoom = Math.max(0.55, Math.min(1.65, Number(zoom) || 1.0));
  }

  rotateCamera(deltaYaw = 0) {
    this.cameraYaw += Number(deltaYaw) || 0;
  }

  shake(intensity = 0.35, duration = 0.22) {
    this.shakeIntensity = Math.max(this.shakeIntensity, intensity);
    this.shakeDuration = Math.max(0.05, duration);
    this.shakeTimer = this.shakeDuration;
  }

  addPointLight(pos, color = 0xff9933, intensity = 2.2, distance = 18, flicker = true) {
    const boostedIntensity = Math.max(1.6, Number(intensity || 1.8) * 1.45);
    const boostedDistance = Math.max(16, Number(distance || 12) * 1.5);
    const light = new THREE.PointLight(color, boostedIntensity, boostedDistance, 1.15);
    light.position.set(pos.x || 0, pos.y ?? 2.2, pos.z || 0);
    this.scene.add(light);
    const entry = {
      light,
      baseIntensity: boostedIntensity,
      baseY: light.position.y,
      flicker,
      phase: Math.random() * Math.PI * 2
    };
    this.dynamicLights.push(entry);
    return light;
  }

  removeLight(light) {
    const idx = this.dynamicLights.findIndex((e) => e.light === light);
    if (idx !== -1) {
      this.scene.remove(this.dynamicLights[idx].light);
      this.dynamicLights.splice(idx, 1);
    } else if (light && light.parent) {
      light.parent.remove(light);
    }
  }

  clearDynamicLights() {
    for (const entry of this.dynamicLights) {
      this.scene.remove(entry.light);
    }
    this.dynamicLights.length = 0;
  }

  worldToScreen(worldPos) {
    const v = this._scratchProj.set(worldPos.x || 0, worldPos.y || 0, worldPos.z || 0);
    v.project(this.camera);
    const halfW = (window.innerWidth || 1280) * 0.5;
    const halfH = (window.innerHeight || 720) * 0.5;
    return {
      x: v.x * halfW + halfW,
      y: -v.y * halfH + halfH,
      visible: v.z < 1
    };
  }

  screenToGround(clientX, clientY, groundY = 0) {
    const w = window.innerWidth || 1280;
    const h = window.innerHeight || 720;
    this._scratchNdc.set((clientX / w) * 2 - 1, -(clientY / h) * 2 + 1);
    this.raycaster.setFromCamera(this._scratchNdc, this.camera);
    this.groundPlane.constant = -groundY;
    const hit = this.raycaster.ray.intersectPlane(this.groundPlane, this._scratchRayTarget);
    return hit || this.cameraTarget.clone();
  }

  /**
   * Spawn a glowing 3D melee slash crescent arc
   */
  spawnSlashArc(origin, yaw = 0, radius = 2.1, color = 0x38bdf8, arcAngle = Math.PI * 0.85, comboStep = 1) {
    const geo = new THREE.RingGeometry(radius * 0.45, radius, 20, 1, -arcAngle * 0.5, arcAngle);
    const mat = new THREE.MeshBasicMaterial({
      color,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(origin.x || 0, (origin.y || 0) + 0.88, origin.z || 0);
    mesh.rotation.order = 'YXZ';
    mesh.rotation.y = yaw - Math.PI * 0.5;
    mesh.rotation.x = Math.PI * 0.5 + (comboStep === 2 ? -0.25 : comboStep === 3 ? 0.35 : 0.12);

    this.vfxGroup.add(mesh);
    this.vfxList.push({
      mesh,
      mat,
      geo,
      age: 0,
      life: 0.22,
      update: (p) => {
        const s = 0.8 + p * 0.45;
        mesh.scale.set(s, s, s);
        mat.opacity = (1 - p) * 0.85;
      }
    });
  }

  /**
   * Spawn Weapon Mirage Ribbon Trail (sweeping curved blade ribbons + afterimage)
   */
  spawnWeaponTrail(origin, yaw = 0, options = {}) {
    const IMBUE_TRAIL_COLORS = {
      fire: 0xff5522,
      ice: 0x38bdf8,
      lightning: 0xfbbf24,
      poison: 0x4ade80,
      bleed: 0xef4444
    };
    const elemKey = options.imbueElement ? String(options.imbueElement).toLowerCase() : null;
    const color = (elemKey && IMBUE_TRAIL_COLORS[elemKey]) ?? (options.color || 0x93c5fd);

    const radius = Number(options.reach || options.radius || 2.4);
    const arcAngle = Number(options.arcAngle || Math.PI * 0.95);
    const duration = Number(options.duration || 0.24);

    const { ring, nebula } = getSroFxTextures();

    const trailGroup = new THREE.Group();
    trailGroup.name = 'WeaponTrailRibbon';

    // Multi-segment sweeping curved blade ribbon / layered glowing arc ribbons
    const g1 = new THREE.RingGeometry(radius * 0.72, radius * 1.05, 24, 1, -arcAngle * 0.5, arcAngle);
    const m1 = new THREE.MeshBasicMaterial({
      color,
      map: nebula || null,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const ribbon1 = new THREE.Mesh(g1, m1);

    const g2 = new THREE.RingGeometry(radius * 0.45, radius * 0.85, 20, 1, -arcAngle * 0.65, arcAngle * 0.85);
    const m2 = new THREE.MeshBasicMaterial({
      color,
      map: ring || null,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.55,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const ribbon2 = new THREE.Mesh(g2, m2);

    const g3 = new THREE.RingGeometry(radius * 0.94, radius * 1.08, 24, 1, -arcAngle * 0.45, arcAngle * 0.7);
    const m3 = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.75,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const ribbon3 = new THREE.Mesh(g3, m3);

    trailGroup.add(ribbon1, ribbon2, ribbon3);

    const ox = origin?.x || 0;
    const oy = (origin?.y || 0) + (options.height || 0.82);
    const oz = origin?.z || 0;
    trailGroup.position.set(ox, oy, oz);
    trailGroup.rotation.order = 'YXZ';
    trailGroup.rotation.y = yaw - Math.PI * 0.5;
    trailGroup.rotation.x = Math.PI * 0.5 + (options.tilt || 0.12);

    this.vfxGroup.add(trailGroup);

    const geos = [g1, g2, g3];
    const mats = [m1, m2, m3];

    this.vfxList.push({
      mesh: trailGroup,
      age: 0,
      life: duration,
      update: (p) => {
        const s = 1.0 + p * 0.28;
        trailGroup.scale.set(s, s, s);
        m1.opacity = (1 - p) * 0.9;
        m2.opacity = (1 - p) * 0.55;
        m3.opacity = (1 - p) * 0.75;
      },
      geo: {
        dispose: () => geos.forEach((g) => g.dispose())
      },
      mat: {
        dispose: () => mats.forEach((m) => m.dispose())
      }
    });

    return trailGroup;
  }

  /**
   * Set Berserk Electric Aura (Hwan transformation)
   */
  setBerserkAura(heroMesh, active = false) {
    if (!heroMesh) return;
    this._berserkHeroMesh = active ? heroMesh : null;
    const baseScale = heroMesh.userData?.baseScale || 1;

    if (!active) {
      if (heroMesh.userData?.berserkAura) {
        heroMesh.userData.berserkAura.visible = false;
      }
      heroMesh.scale.setScalar(baseScale);
      return;
    }

    let aura = heroMesh.userData?.berserkAura;
    if (!aura) {
      const { ring } = getSroFxTextures();
      aura = new THREE.Group();
      aura.name = 'BerserkAura';

      // Golden-crimson base ring (0xfbbf24 / 0xef4444)
      const outerRingGeo = new THREE.RingGeometry(0.72, 1.15, 32);
      const outerRingMat = new THREE.MeshBasicMaterial({
        color: 0xef4444, // crimson outer
        map: ring || null,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.65,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      });
      const outerRing = new THREE.Mesh(outerRingGeo, outerRingMat);
      outerRing.rotation.x = -Math.PI / 2;
      outerRing.position.y = 0.05;
      aura.add(outerRing);

      const innerRingGeo = new THREE.RingGeometry(0.85, 1.05, 32);
      const innerRingMat = new THREE.MeshBasicMaterial({
        color: 0xfbbf24, // golden inner
        map: ring || null,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.85,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      });
      const innerRing = new THREE.Mesh(innerRingGeo, innerRingMat);
      innerRing.rotation.x = -Math.PI / 2;
      innerRing.position.y = 0.06;
      aura.add(innerRing);

      // 4 orbiting lightning shards
      const shardsGroup = new THREE.Group();
      shardsGroup.name = 'BerserkShards';
      const shardGeo = new THREE.OctahedronGeometry(0.12, 0);
      const shardMat = new THREE.MeshBasicMaterial({
        color: 0xfbbf24,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.95,
        blending: THREE.AdditiveBlending
      });

      for (let i = 0; i < 4; i++) {
        const ang = (i / 4) * Math.PI * 2;
        const shard = new THREE.Mesh(shardGeo, shardMat);
        shard.position.set(Math.cos(ang) * 0.95, 0.45, Math.sin(ang) * 0.95);
        shard.scale.set(0.65, 1.35, 0.65);
        shardsGroup.add(shard);
      }
      aura.add(shardsGroup);

      aura.userData = {
        outerRing,
        innerRing,
        shardsGroup
      };

      heroMesh.userData.berserkAura = aura;
      heroMesh.add(aura);
    }

    aura.visible = true;
    const scaleMult = (typeof BERSERK !== 'undefined' && BERSERK?.scaleMult) ? BERSERK.scaleMult : 1.12;
    heroMesh.scale.setScalar(baseScale * scaleMult);
  }

  /**
   * Spawn 3D particle hit sparks
   */
  spawnHitSparks(pos, color = 0xfacc15, count = 12) {
    for (let i = 0; i < count; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 1,
        blending: THREE.AdditiveBlending
      });
      const mesh = new THREE.Mesh(this._unitBoxGeo, mat);
      const size = 0.06 + Math.random() * 0.08;
      mesh.scale.setScalar(size);
      mesh.position.set(pos.x || 0, (pos.y || 0) + 0.7, pos.z || 0);

      const angle = Math.random() * Math.PI * 2;
      const speed = 2.0 + Math.random() * 4.8;
      const vel = new THREE.Vector3(
        Math.cos(angle) * speed,
        2.2 + Math.random() * 4.0,
        Math.sin(angle) * speed
      );

      if (this.particles.length >= 120) {
        const old = this.particles.shift();
        this.vfxGroup.remove(old.mesh);
        if (old.mat) old.mat.dispose();
      }
      this.vfxGroup.add(mesh);
      this.particles.push({
        mesh,
        mat,
        vel,
        gravity: 13.5,
        age: 0,
        life: 0.32 + Math.random() * 0.22
      });
    }
  }

  /**
   * Spawn dramatic Level-Up Golden Pillar & Expanding Rings
   */
  spawnLevelUpPillar(pos) {
    const x = pos.x || 0;
    const z = pos.z || 0;

    const cylGeo = new THREE.CylinderGeometry(0.85, 1.15, 7.5, 20, 1, true);
    const cylMat = new THREE.MeshBasicMaterial({
      color: 0xfacc15,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.75,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const beam = new THREE.Mesh(cylGeo, cylMat);
    beam.position.set(x, 3.75, z);
    this.vfxGroup.add(beam);

    this.vfxList.push({
      mesh: beam,
      mat: cylMat,
      geo: cylGeo,
      age: 0,
      life: 1.25,
      update: (p) => {
        beam.position.x = this.cameraTarget.x;
        beam.position.z = this.cameraTarget.z;
        beam.scale.set(1 + p * 0.5, 1, 1 + p * 0.5);
        cylMat.opacity = (1 - p) * 0.75;
      }
    });

    this.spawnShockwave({ x, y: 0.08, z }, 4.5, 0xfef08a, 0.75);
    this.spawnHitSparks({ x, y: 0.5, z }, 0xfacc15, 24);
  }

  /**
   * Spawn expanding shockwave ring on the ground
   */
  spawnShockwave(pos, maxRadius = 3.8, color = 0xf97316, duration = 0.45) {
    const { ring: ringTex } = getSroFxTextures();
    const geo = new THREE.RingGeometry(0.2, 0.55, 28);
    const mat = new THREE.MeshBasicMaterial({
      color,
      map: ringTex || null,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const ring = new THREE.Mesh(geo, mat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(pos.x || 0, (pos.y || 0) + 0.08, pos.z || 0);
    this.vfxGroup.add(ring);

    this.vfxList.push({
      mesh: ring,
      mat,
      geo,
      age: 0,
      life: duration,
      update: (p) => {
        const s = 1 + p * (maxRadius * 1.8);
        ring.scale.set(s, s, 1);
        mat.opacity = (1 - p) * 0.9;
      }
    });
  }

  /**
   * Spawn Heal / Mana / Buff Aura around character
   */
  spawnAura(pos, color = 0x22c55e, type = 'heal') {
    const col = type === 'mana' || type === 'mp' ? 0x38bdf8 : type === 'buff' ? 0xfacc15 : color;
    this.spawnShockwave(pos, 2.0, col, 0.45);
    for (let i = 0; i < 14; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: col,
        transparent: true,
        opacity: 0.9,
        blending: THREE.AdditiveBlending
      });
      const mesh = new THREE.Mesh(this._unitSphereGeo, mat);
      mesh.scale.setScalar(0.11);
      const angle = (i / 14) * Math.PI * 2;
      const r = 0.55 + Math.random() * 0.35;
      mesh.position.set((pos.x || 0) + Math.cos(angle) * r, 0.2 + Math.random() * 0.5, (pos.z || 0) + Math.sin(angle) * r);

      if (this.particles.length >= 120) {
        const old = this.particles.shift();
        this.vfxGroup.remove(old.mesh);
        if (old.mat) old.mat.dispose();
      }
      this.vfxGroup.add(mesh);
      this.particles.push({
        mesh,
        mat,
        vel: new THREE.Vector3(0, 2.2 + Math.random() * 1.5, 0),
        gravity: -0.5,
        age: 0,
        life: 0.55 + Math.random() * 0.25
      });
    }
  }

  /**
   * Spawn Skill VFX by descriptor or skill type
   */
  spawnSkillEffect(type = 'whirlwind', pos = { x: 0, y: 0, z: 0 }, dirOrYaw = 0, options = {}) {
    const kind = String(type || 'whirlwind').toLowerCase();
    const color = options.color ?? (kind.includes('fire') ? 0xff5522
      : kind.includes('ice') || kind.includes('frost') || kind.includes('nova') ? 0x38bdf8
      : kind.includes('light') || kind.includes('thunder') || kind.includes('chain') ? 0xfacc15
      : kind.includes('poison') ? 0x4ade80
      : kind.includes('heal') ? 0x22c55e
      : 0xa855f7);

    const yaw = typeof dirOrYaw === 'number'
      ? dirOrYaw
      : Math.atan2(dirOrYaw?.x || 0, dirOrYaw?.z || 1);

    if (kind.includes('whirl') || kind.includes('spin') || kind.includes('cyclone')) {
      for (let i = 0; i < 3; i++) {
        this.spawnSlashArc(pos, yaw + (i * Math.PI * 2) / 3, options.radius || 2.8, color, Math.PI * 1.4, i + 1);
      }
      this.spawnShockwave(pos, options.radius || 3.0, color, 0.38);
    } else if (kind.includes('nova') || kind.includes('shock') || kind.includes('aoe') || kind.includes('slam')) {
      const r = options.radius || 3.8;
      this.spawnShockwave(pos, r, color, 0.48);
      this.spawnHitSparks(pos, color, 20);
    } else if (kind.includes('dash') || kind.includes('charge')) {
      this.spawnHitSparks(pos, 0x38bdf8, 10);
    } else if (kind.includes('heal') || kind.includes('buff')) {
      this.spawnAura(pos, color, kind.includes('heal') ? 'heal' : 'buff');
    } else {
      this.spawnSlashArc(pos, yaw, options.range || 2.6, color, options.angle || Math.PI * 1.05, 3);
      const impactPos = {
        x: (pos.x || 0) + Math.sin(yaw) * 1.6,
        y: pos.y || 0,
        z: (pos.z || 0) + Math.cos(yaw) * 1.6
      };
      this.spawnShockwave(impactPos, options.radius || 2.2, color, 0.35);
      this.spawnHitSparks(impactPos, color, 16);
    }
  }

  /**
   * Small burst where a projectile hits something (enemy, wall or end of range)
   */
  spawnProjectileImpact(pos, color = 0xa855f7, size = 1) {
    const p = { x: pos?.x || 0, y: 0, z: pos?.z || 0 };
    this.spawnHitSparks(p, color, Math.max(4, Math.round(8 * size)));
    const geo = new THREE.SphereGeometry(0.35 * size, 10, 8);
    const mat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const flash = new THREE.Mesh(geo, mat);
    flash.position.set(p.x, (pos?.y ?? 0.9), p.z);
    this.vfxGroup.add(flash);
    this.vfxList.push({
      mesh: flash,
      mat,
      geo,
      age: 0,
      life: 0.18,
      update: (t) => {
        flash.scale.setScalar(0.6 + t * 1.2);
        mat.opacity = (1 - t) * 0.85;
      }
    });
  }

  /**
   * Targeted ground AoE (rain of arrows, meteor, inferno ring...) at a world point.
   * type: 'rain' | 'meteor' | anything else (generic burst)
   */
  spawnTargetedAoE(type = 'rain', pos = { x: 0, y: 0, z: 0 }, options = {}) {
    const kind = String(type || 'rain').toLowerCase();
    const radius = Number(options.radius) || 3.5;
    const color = options.color ?? (kind.includes('meteor') || kind.includes('fire') ? 0xff5522 : 0xd9f99d);
    const x = pos?.x || 0;
    const z = pos?.z || 0;

    // Ground target marker
    const markGeo = new THREE.RingGeometry(radius * 0.92, radius, 40);
    const markMat = new THREE.MeshBasicMaterial({
      color,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const mark = new THREE.Mesh(markGeo, markMat);
    mark.rotation.x = -Math.PI / 2;
    mark.position.set(x, 0.06, z);
    this.vfxGroup.add(mark);
    this.vfxList.push({
      mesh: mark,
      mat: markMat,
      geo: markGeo,
      age: 0,
      life: 0.75,
      update: (t) => {
        markMat.opacity = (1 - t) * 0.8;
        mark.rotation.z = t * 1.5;
      }
    });

    if (kind.includes('meteor')) {
      // A falling fireball that impacts the center
      const geo = new THREE.IcosahedronGeometry(0.55, 1);
      const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false });
      const rock = new THREE.Mesh(geo, mat);
      rock.position.set(x - 2, 9, z - 2);
      this.vfxGroup.add(rock);
      let impacted = false;
      this.vfxList.push({
        mesh: rock,
        mat,
        geo,
        age: 0,
        life: 0.32,
        update: (t) => {
          rock.position.set(x - 2 * (1 - t), 9 * (1 - t) + 0.4, z - 2 * (1 - t));
          rock.rotation.x += 0.3;
          if (t >= 0.98 && !impacted) {
            impacted = true;
            this.spawnShockwave({ x, y: 0, z }, radius, color, 0.5);
            this.spawnHitSparks({ x, y: 0, z }, color, 26);
            this.shake(0.4, 0.25);
          }
        }
      });
    } else if (kind.includes('rain') || kind.includes('arrow')) {
      // Streaks falling inside the circle
      const count = Number(options.count) || 18;
      for (let i = 0; i < count; i++) {
        const a = Math.random() * Math.PI * 2;
        const r = Math.sqrt(Math.random()) * radius;
        const ax = x + Math.cos(a) * r;
        const az = z + Math.sin(a) * r;
        const delay = Math.random() * 0.45;
        const geo = new THREE.CylinderGeometry(0.02, 0.02, 0.8, 4);
        const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
        const streak = new THREE.Mesh(geo, mat);
        streak.position.set(ax, 7, az);
        this.vfxGroup.add(streak);
        let landed = false;
        const life = 0.75;
        this.vfxList.push({
          mesh: streak,
          mat,
          geo,
          age: 0,
          life,
          update: (t) => {
            const local = Math.max(0, (t * life - delay) / 0.22);
            if (local <= 0) return;
            const k = Math.min(1, local);
            streak.position.y = 7 - k * 6.6;
            mat.opacity = k < 1 ? 0.95 : Math.max(0, 0.95 - (local - 1) * 2);
            if (k >= 1 && !landed) {
              landed = true;
              if (i % 3 === 0) this.spawnHitSparks({ x: ax, y: -0.5, z: az }, color, 3);
            }
          }
        });
      }
      this.spawnShockwave({ x, y: 0, z }, radius * 0.8, color, 0.6);
    } else {
      this.spawnShockwave({ x, y: 0, z }, radius, color, 0.5);
      this.spawnHitSparks({ x, y: 0, z }, color, 20);
    }
  }

  /**
   * Spawn a boss ground telegraph decal inside the bossArena before a boss skill executes.
   * kind: 'shockwave' | 'nova' | 'charge' | 'summon'
   * options: { radius, length, width, duration, color, arena }
   */
  spawnBossTelegraph(kind = 'shockwave', origin = { x: 0, z: 0 }, dir = { x: 0, z: 1 }, options = {}) {
    const duration = Math.max(0.25, Number(options.duration) || 0.72);
    const color = Number.isFinite(Number(options.color)) ? Number(options.color) : 0xef4444;
    const arena = options.arena || null;
    const ox = Number(origin?.x || 0);
    const oz = Number(origin?.z || 0);

    const clampToArena = (px, pz, margin = 0.6) => {
      if (!arena?.center || !Number.isFinite(arena.radius)) return { x: px, z: pz };
      const dx = px - arena.center.x;
      const dz = pz - arena.center.z;
      const d = Math.hypot(dx, dz);
      const maxR = Math.max(1.5, arena.radius - margin);
      if (d <= maxR || d < 0.001) return { x: px, z: pz };
      return {
        x: arena.center.x + (dx / d) * maxR,
        z: arena.center.z + (dz / d) * maxR
      };
    };

    const group = new THREE.Group();
    group.position.y = 0.045;
    this.vfxGroup.add(group);
    const geos = [];
    const mats = [];

    if (kind === 'charge') {
      const len = Number(options.length) || 6.5;
      const width = Number(options.width) || 1.9;
      const dLen = Math.hypot(dir?.x || 0, dir?.z || 1) || 1;
      const nx = (dir?.x || 0) / dLen;
      const nz = (dir?.z || 1) / dLen;
      const endPt = clampToArena(ox + nx * len, oz + nz * len, 0.9);
      const actualLen = Math.max(1.8, Math.hypot(endPt.x - ox, endPt.z - oz));
      const yaw = Math.atan2(endPt.x - ox, endPt.z - oz);

      const borderGeo = new THREE.PlaneGeometry(width, actualLen);
      const fillGeo = new THREE.PlaneGeometry(width * 0.92, actualLen);
      const borderMat = new THREE.MeshBasicMaterial({
        color,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.55,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      });
      const fillMat = new THREE.MeshBasicMaterial({
        color,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.25,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      });
      geos.push(borderGeo, fillGeo);
      mats.push(borderMat, fillMat);

      const border = new THREE.Mesh(borderGeo, borderMat);
      border.rotation.x = -Math.PI / 2;
      border.rotation.z = -yaw;
      border.position.set(ox + Math.sin(yaw) * (actualLen * 0.5), 0, oz + Math.cos(yaw) * (actualLen * 0.5));

      const fill = new THREE.Mesh(fillGeo, fillMat);
      fill.rotation.x = -Math.PI / 2;
      fill.rotation.z = -yaw;
      fill.position.copy(border.position);
      fill.position.y = 0.005;

      group.add(border, fill);
      this.vfxList.push({
        mesh: group,
        age: 0,
        life: duration,
        update: (p) => {
          fill.scale.set(1, Math.max(0.05, p), 1);
          fillMat.opacity = (0.2 + p * 0.45) * (1 - Math.max(0, p - 0.9) * 10);
          borderMat.opacity = (0.45 + Math.sin(p * Math.PI * 6) * 0.2) * (1 - Math.max(0, p - 0.92) * 12);
          if (p >= 0.99) {
            geos.forEach((g) => g.dispose());
            mats.forEach((m) => m.dispose());
          }
        }
      });
      return group;
    }

    if (kind === 'summon') {
      const spots = [
        clampToArena(ox - 2.2, oz + 1.5, 1.0),
        clampToArena(ox + 2.2, oz + 1.5, 1.0)
      ];
      for (const sp of spots) {
        const rGeo = new THREE.RingGeometry(0.65, 0.95, 24);
        const rMat = new THREE.MeshBasicMaterial({
          color: 0xc084fc,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.75,
          blending: THREE.AdditiveBlending,
          depthWrite: false
        });
        geos.push(rGeo);
        mats.push(rMat);
        const rMesh = new THREE.Mesh(rGeo, rMat);
        rMesh.rotation.x = -Math.PI / 2;
        rMesh.position.set(sp.x, 0, sp.z);
        group.add(rMesh);
      }
      this.vfxList.push({
        mesh: group,
        age: 0,
        life: duration,
        update: (p) => {
          group.children.forEach((c, idx) => {
            c.rotation.z = p * Math.PI * (idx % 2 === 0 ? 3 : -3);
            c.scale.setScalar(0.6 + p * 0.55);
          });
          mats.forEach((m) => { m.opacity = Math.sin(p * Math.PI) * 0.85; });
          if (p >= 0.99) {
            geos.forEach((g) => g.dispose());
            mats.forEach((m) => m.dispose());
          }
        }
      });
      return group;
    }

    // Default: 'shockwave' / 'nova' circular arena telegraph
    const maxR = arena?.radius ? Math.min(Number(options.radius) || 4.0, arena.radius - 0.4) : (Number(options.radius) || 4.0);
    const center = clampToArena(ox, oz, 0.5);
    const outerGeo = new THREE.RingGeometry(maxR * 0.92, maxR, 40);
    const fillGeo = new THREE.CircleGeometry(maxR, 36);
    const outerMat = new THREE.MeshBasicMaterial({
      color,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const fillMat = new THREE.MeshBasicMaterial({
      color,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.22,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    geos.push(outerGeo, fillGeo);
    mats.push(outerMat, fillMat);

    const outerRing = new THREE.Mesh(outerGeo, outerMat);
    outerRing.rotation.x = -Math.PI / 2;
    outerRing.position.set(center.x, 0, center.z);

    const innerDisc = new THREE.Mesh(fillGeo, fillMat);
    innerDisc.rotation.x = -Math.PI / 2;
    innerDisc.position.set(center.x, 0.004, center.z);
    innerDisc.scale.setScalar(0.05);

    group.add(outerRing, innerDisc);
    this.vfxList.push({
      mesh: group,
      age: 0,
      life: duration,
      update: (p) => {
        innerDisc.scale.setScalar(Math.max(0.05, p));
        fillMat.opacity = (0.15 + p * 0.38) * (1 - Math.max(0, p - 0.92) * 12);
        outerMat.opacity = (0.55 + Math.sin(p * Math.PI * 8) * 0.25) * (1 - Math.max(0, p - 0.92) * 12);
        if (p >= 0.99) {
          geos.forEach((g) => g.dispose());
          mats.forEach((m) => m.dispose());
        }
      }
    });
    return group;
  }

  /**
   * Spawn a player skill indicator decal on the ground during skill preparation/aiming.
   * kind: 'arc' | 'cone' | 'circle' | 'aoe' | 'line' | 'rect'
   * options: { radius, range, angle, width, duration, color }
   */
  spawnSkillIndicator(kind = 'arc', origin = { x: 0, z: 0 }, dirOrYaw = 0, options = {}) {
    const k = String(kind || 'arc').toLowerCase();
    const duration = Math.max(0.1, Number(options.duration) || 0.45);
    const color = Number.isFinite(Number(options.color)) ? Number(options.color) : 0x38bdf8;
    const ox = Number(origin?.x || 0);
    const oz = Number(origin?.z || 0);
    const yaw = typeof dirOrYaw === 'number'
      ? dirOrYaw
      : Math.atan2(dirOrYaw?.x || 0, dirOrYaw?.z || 1);

    const group = new THREE.Group();
    group.position.set(ox, 0.045, oz);
    this.vfxGroup.add(group);
    const geos = [];
    const mats = [];

    if (k.includes('circle') || k.includes('aoe') || k.includes('nova') || k.includes('ring')) {
      const radius = Number(options.radius || options.range) || 3.5;
      const outerGeo = new THREE.RingGeometry(radius * 0.94, radius, 36);
      const innerGeo = new THREE.CircleGeometry(radius * 0.93, 32);
      const runeGeo = new THREE.RingGeometry(radius * 0.65, radius * 0.72, 24);

      const borderMat = new THREE.MeshBasicMaterial({
        color,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.8,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      });
      const fillMat = new THREE.MeshBasicMaterial({
        color,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.2,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      });
      const runeMat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.45,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      });

      geos.push(outerGeo, innerGeo, runeGeo);
      mats.push(borderMat, fillMat, runeMat);

      const border = new THREE.Mesh(outerGeo, borderMat);
      border.rotation.x = -Math.PI / 2;

      const fill = new THREE.Mesh(innerGeo, fillMat);
      fill.rotation.x = -Math.PI / 2;
      fill.position.y = 0.002;
      fill.scale.setScalar(0.05);

      const rune = new THREE.Mesh(runeGeo, runeMat);
      rune.rotation.x = -Math.PI / 2;
      rune.position.y = 0.004;

      group.add(border, fill, rune);

      this.vfxList.push({
        mesh: group,
        age: 0,
        life: duration,
        update: (p) => {
          fill.scale.setScalar(Math.max(0.05, p));
          fillMat.opacity = (0.15 + p * 0.4) * (1 - Math.max(0, p - 0.92) * 12);
          borderMat.opacity = (0.6 + Math.sin(p * Math.PI * 6) * 0.25) * (1 - Math.max(0, p - 0.92) * 12);
          rune.rotation.z = p * Math.PI * 2;
          runeMat.opacity = (0.3 + p * 0.4) * (1 - Math.max(0, p - 0.92) * 12);
          if (p >= 0.99) {
            geos.forEach((g) => g.dispose());
            mats.forEach((m) => m.dispose());
          }
        }
      });
      return group;
    }

    if (k.includes('line') || k.includes('rect') || k.includes('charge') || k.includes('dash')) {
      const len = Number(options.range || options.length) || 5.5;
      const width = Number(options.width) || 1.6;

      const borderGeo = new THREE.PlaneGeometry(width, len);
      const fillGeo = new THREE.PlaneGeometry(width * 0.9, len);
      const borderMat = new THREE.MeshBasicMaterial({
        color,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.75,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      });
      const fillMat = new THREE.MeshBasicMaterial({
        color,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.22,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      });

      geos.push(borderGeo, fillGeo);
      mats.push(borderMat, fillMat);

      const border = new THREE.Mesh(borderGeo, borderMat);
      border.rotation.x = -Math.PI / 2;
      border.rotation.z = -yaw;
      border.position.set(Math.sin(yaw) * (len * 0.5), 0, Math.cos(yaw) * (len * 0.5));

      const fill = new THREE.Mesh(fillGeo, fillMat);
      fill.rotation.x = -Math.PI / 2;
      fill.rotation.z = -yaw;
      fill.position.copy(border.position);
      fill.position.y = 0.003;

      group.add(border, fill);

      this.vfxList.push({
        mesh: group,
        age: 0,
        life: duration,
        update: (p) => {
          fill.scale.set(1, Math.max(0.05, p), 1);
          fillMat.opacity = (0.2 + p * 0.4) * (1 - Math.max(0, p - 0.92) * 12);
          borderMat.opacity = (0.55 + Math.sin(p * Math.PI * 6) * 0.2) * (1 - Math.max(0, p - 0.92) * 12);
          if (p >= 0.99) {
            geos.forEach((g) => g.dispose());
            mats.forEach((m) => m.dispose());
          }
        }
      });
      return group;
    }

    // Default: 'arc' / 'cone' / 'slash' / 'melee' sector indicator
    const range = Number(options.range || options.radius) || 3.2;
    const arcAngle = Number(options.angle) || Math.PI * 1.1;
    const segments = 24;

    const arcBorderGeo = new THREE.RingGeometry(range * 0.94, range, segments, 1, -arcAngle * 0.5, arcAngle);
    const arcFillGeo = new THREE.CircleGeometry(range * 0.93, segments, -arcAngle * 0.5, arcAngle);

    const borderMat = new THREE.MeshBasicMaterial({
      color,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const fillMat = new THREE.MeshBasicMaterial({
      color,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.22,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    geos.push(arcBorderGeo, arcFillGeo);
    mats.push(borderMat, fillMat);

    const border = new THREE.Mesh(arcBorderGeo, borderMat);
    border.rotation.x = -Math.PI / 2;
    border.rotation.z = -yaw + Math.PI / 2;

    const fill = new THREE.Mesh(arcFillGeo, fillMat);
    fill.rotation.x = -Math.PI / 2;
    fill.rotation.z = -yaw + Math.PI / 2;
    fill.position.y = 0.003;
    fill.scale.setScalar(0.05);

    group.add(border, fill);

    this.vfxList.push({
      mesh: group,
      age: 0,
      life: duration,
      update: (p) => {
        fill.scale.setScalar(Math.max(0.05, p));
        fillMat.opacity = (0.18 + p * 0.42) * (1 - Math.max(0, p - 0.92) * 12);
        borderMat.opacity = (0.6 + Math.sin(p * Math.PI * 6) * 0.2) * (1 - Math.max(0, p - 0.92) * 12);
        if (p >= 0.99) {
          geos.forEach((g) => g.dispose());
          mats.forEach((m) => m.dispose());
        }
      }
    });
    return group;
  }

  /**
   * Spawn floating 3D -> 2D combat text (damage numbers, CRITS, EXP, status)
   */
  spawnFloatingText(worldPos, text, options = {}) {
    if (!this.fctContainer) return;
    const el = document.createElement('div');
    const isCrit = Boolean(options.isCrit || options.crit);
    el.className = `fct-item${isCrit ? ' fct-crit' : ''}`;
    el.textContent = isCrit ? `💥 ${text}!` : String(text);

    if (options.color) {
      el.style.color = typeof options.color === 'number'
        ? `#${options.color.toString(16).padStart(6, '0')}`
        : String(options.color);
    } else if (options.type === 'heal') {
      el.style.color = '#4ade80';
    } else if (options.type === 'mana') {
      el.style.color = '#38bdf8';
    } else if (options.type === 'player_hit') {
      el.style.color = '#ef4444';
    } else if (options.type === 'exp' || options.type === 'gold') {
      el.style.color = '#facc15';
    } else if (!isCrit) {
      el.style.color = '#f8fafc';
    }

    this.fctContainer.appendChild(el);
    this.floatingTexts.push({
      el,
      worldPos: new THREE.Vector3(
        (worldPos.x || 0) + (Math.random() - 0.5) * 0.55,
        (worldPos.y || 0) + 1.45,
        (worldPos.z || 0) + (Math.random() - 0.5) * 0.55
      ),
      vy: isCrit ? 2.1 : 1.5,
      age: 0,
      life: isCrit ? 1.05 : 0.82
    });
  }

  updateCamera(targetPos, dt = 0.016) {
    if (targetPos) {
      const lerpFactor = Math.min(1, dt * 9.5);
      this._scratchTarget.set(targetPos.x || 0, targetPos.y || 0, targetPos.z || 0);
      this.cameraTarget.lerp(this._scratchTarget, lerpFactor);
    }

    const dist = this.cameraDistance * this.cameraZoom;
    const height = this.cameraPitchHeight * this.cameraZoom;

    let shakeX = 0;
    let shakeY = 0;
    let shakeZ = 0;
    if (this.shakeTimer > 0) {
      this.shakeTimer = Math.max(0, this.shakeTimer - dt);
      const decay = this.shakeTimer / this.shakeDuration;
      const mag = this.shakeIntensity * decay;
      shakeX = (Math.random() - 0.5) * 2 * mag;
      shakeY = (Math.random() - 0.5) * 2 * mag;
      shakeZ = (Math.random() - 0.5) * 2 * mag;
    }

    const camX = this.cameraTarget.x + Math.sin(this.cameraYaw) * dist + shakeX;
    const camY = this.cameraTarget.y + height + shakeY;
    const camZ = this.cameraTarget.z + Math.cos(this.cameraYaw) * dist + shakeZ;

    this.camera.position.set(camX, camY, camZ);
    this.camera.lookAt(
      this.cameraTarget.x + shakeX * 0.4,
      this.cameraTarget.y + 0.65 + shakeY * 0.4,
      this.cameraTarget.z + shakeZ * 0.4
    );

    // Keep shadow directional light centered around hero
    this.dirLight.position.set(this.cameraTarget.x + 12, 26, this.cameraTarget.z + 14);
    this.dirLight.target.position.copy(this.cameraTarget);

    this.heroLight.position.set(this.cameraTarget.x, this.cameraTarget.y + 3.2, this.cameraTarget.z);
    this.heroFillLight.position.set(this.cameraTarget.x, this.cameraTarget.y + 9.5, this.cameraTarget.z);
  }

  update(dt = 0.016, elapsed = 0, heroPos = null) {
    this.updateCamera(heroPos, dt);
    this._updateAtmosphere(dt);
    this._updateDust(dt, elapsed, heroPos);
    this._updateWeather(dt, elapsed, heroPos);

    // Flicker dynamic torch/portal lights
    for (const entry of this.dynamicLights) {
      if (entry.flicker) {
        const wave = Math.sin(elapsed * 9 + entry.phase) * 0.1 + Math.cos(elapsed * 15 + entry.phase) * 0.06;
        entry.light.intensity = Math.max(0.5, entry.baseIntensity * (1 + wave));
      }
    }

    // Update active mesh VFX (slash arcs, shockwaves, pillars)
    for (let i = this.vfxList.length - 1; i >= 0; i--) {
      const item = this.vfxList[i];
      item.age += dt;
      const p = Math.min(1, item.age / item.life);
      if (item.update) item.update(p, dt);
      if (item.age >= item.life) {
        this.vfxGroup.remove(item.mesh);
        if (item.geo) item.geo.dispose();
        if (item.mat) item.mat.dispose();
        this.vfxList.splice(i, 1);
      }
    }

    // Update 3D particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const pt = this.particles[i];
      pt.age += dt;
      if (pt.age >= pt.life) {
        this.vfxGroup.remove(pt.mesh);
        if (pt.mat) pt.mat.dispose();
        this.particles.splice(i, 1);
        continue;
      }
      pt.vel.y -= pt.gravity * dt;
      pt.mesh.position.addScaledVector(pt.vel, dt);
      if (pt.mesh.position.y < 0.05) {
        pt.mesh.position.y = 0.05;
        pt.vel.y *= -0.35;
      }
      pt.mat.opacity = 1 - pt.age / pt.life;
    }

    // Update floating combat text positions
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.age += dt;
      if (ft.age >= ft.life) {
        ft.el.remove();
        this.floatingTexts.splice(i, 1);
        continue;
      }
      ft.worldPos.y += ft.vy * dt;
      ft.vy *= 0.96;
      const screen = this.worldToScreen(ft.worldPos);
      const alpha = 1 - Math.pow(ft.age / ft.life, 1.6);
      ft.el.style.left = `${screen.x}px`;
      ft.el.style.top = `${screen.y}px`;
      ft.el.style.opacity = String(alpha.toFixed(2));
    }

    // Dynamic Berserk Aura rotation and pulse
    const berserkTarget = this._berserkHeroMesh || (heroPos && heroPos.mesh);
    if (berserkTarget?.userData?.berserkAura?.visible) {
      const aura = berserkTarget.userData.berserkAura;
      if (aura.userData?.shardsGroup) {
        aura.userData.shardsGroup.rotation.y = elapsed * 4.2;
      }
      if (aura.userData?.outerRing) {
        const p1 = 1.0 + Math.sin(elapsed * 6.5) * 0.09;
        aura.userData.outerRing.scale.set(p1, p1, 1);
      }
      if (aura.userData?.innerRing) {
        const p2 = 1.0 + Math.cos(elapsed * 8.5) * 0.12;
        aura.userData.innerRing.scale.set(p2, p2, 1);
      }
    }
  }

  render() {
    this.webglRenderer.render(this.scene, this.camera);
  }
}

export function createRenderer(container) {
  return new Renderer(container);
}

export default Renderer;

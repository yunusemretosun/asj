import * as THREE from 'three';

const THEME_CONFIGS = {
  village: {
    bg: 0x1e293b,
    fog: 0x1e293b,
    fogNear: 55,
    fogFar: 130,
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
    bg: 0x1e2433,
    fog: 0x1e2433,
    fogNear: 52,
    fogFar: 120,
    ambientColor: 0xfef3c7,
    ambientIntensity: 1.85,
    hemiSky: 0xfffbeb,
    hemiGround: 0x78716c,
    hemiIntensity: 1.45,
    dirColor: 0xfff7ed,
    dirIntensity: 1.95,
    heroLightColor: 0xffedd5,
    heroLightIntensity: 2.85,
    fillLightColor: 0xfde68a,
    fillLightIntensity: 2.25
  },
  crypt: {
    bg: 0x1c2237,
    fog: 0x1c2237,
    fogNear: 52,
    fogFar: 120,
    ambientColor: 0xe0e7ff,
    ambientIntensity: 1.85,
    hemiSky: 0xeef2ff,
    hemiGround: 0x64748b,
    hemiIntensity: 1.45,
    dirColor: 0xe0f2fe,
    dirIntensity: 1.95,
    heroLightColor: 0xbae6fd,
    heroLightIntensity: 2.85,
    fillLightColor: 0xc7d2fe,
    fillLightIntensity: 2.25
  },
  ruins: {
    bg: 0x1a2e2b,
    fog: 0x1a2e2b,
    fogNear: 52,
    fogFar: 120,
    ambientColor: 0xdcfce7,
    ambientIntensity: 1.85,
    hemiSky: 0xf0fdf4,
    hemiGround: 0x577568,
    hemiIntensity: 1.45,
    dirColor: 0xfef9c3,
    dirIntensity: 1.95,
    heroLightColor: 0xfef08a,
    heroLightIntensity: 2.75,
    fillLightColor: 0xa7f3d0,
    fillLightIntensity: 2.2
  },
  lava: {
    bg: 0x2c1614,
    fog: 0x2c1614,
    fogNear: 52,
    fogFar: 120,
    ambientColor: 0xffedd5,
    ambientIntensity: 1.85,
    hemiSky: 0xfff7ed,
    hemiGround: 0x9a3412,
    hemiIntensity: 1.45,
    dirColor: 0xffedd5,
    dirIntensity: 2.0,
    heroLightColor: 0xfdba74,
    heroLightIntensity: 2.9,
    fillLightColor: 0xfed7aa,
    fillLightIntensity: 2.3
  },
  boss: {
    bg: 0x251736,
    fog: 0x251736,
    fogNear: 52,
    fogFar: 120,
    ambientColor: 0xf3e8ff,
    ambientIntensity: 1.85,
    hemiSky: 0xfaf5ff,
    hemiGround: 0x6b21a8,
    hemiIntensity: 1.45,
    dirColor: 0xffe4e6,
    dirIntensity: 2.0,
    heroLightColor: 0xfef08a,
    heroLightIntensity: 2.95,
    fillLightColor: 0xe9d5ff,
    fillLightIntensity: 2.35
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

    this.camera = new THREE.PerspectiveCamera(44, width / height, 0.1, 180);
    this.cameraTarget = new THREE.Vector3(0, 0, 0);
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
    this.dirLight.shadow.mapSize.width = 2048;
    this.dirLight.shadow.mapSize.height = 2048;
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

    this._atmo = null;
    this._setDust?.(false);
    this.setWeather?.(key.includes('village') || key.includes('town') || key.includes('hub') ? 'petals' : null);
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
   * atm: { fogColor, fogNear, fogFar, ambientColor, ambientIntensity, keyLightColor, keyLightIntensity, dust }
   */
  applyAtmosphere(atm = null) {
    if (!atm || typeof atm !== 'object') { this._atmo = null; this._setDust(false); return; }
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
   * Ambient weather particle system around the hero ('rain' | 'snow' | 'embers' | 'petals' | 'spores' | null).
   * Uses a single pooled THREE.Points buffer with per-particle drift/fall/rise wrap-around.
   */
  setWeather(kind = null, options = {}) {
    const w = kind ? String(kind).toLowerCase() : '';
    if (!w || w === 'none' || w === 'clear') {
      this._weatherKind = null;
      if (this._weatherPoints) this._weatherPoints.visible = false;
      return;
    }

    const presets = {
      rain:   { color: 0x93c5fd, size: 0.11, opacity: 0.62, vy: -13.5, vx: -1.6, vz: 0.8, sway: 0.15, spanY: 9.0 },
      snow:   { color: 0xe2e8f0, size: 0.12, opacity: 0.78, vy: -2.1,  vx: 0.45, vz: 0.3, sway: 1.1,  spanY: 8.0 },
      embers: { color: 0xf97316, size: 0.11, opacity: 0.85, vy: 2.3,   vx: 0.35, vz: -0.25, sway: 0.9, spanY: 7.5 },
      petals: { color: 0xfbcfe8, size: 0.10, opacity: 0.68, vy: -1.25, vx: 0.55, vz: 0.35, sway: 1.25, spanY: 7.5 },
      spores: { color: 0x6ee7b7, size: 0.09, opacity: 0.65, vy: 0.65,  vx: 0.2,  vz: 0.2,  sway: 0.85, spanY: 6.5 }
    };
    const cfg = presets[w] || presets.snow;
    this._weatherKind = w;
    this._weatherCfg = {
      ...cfg,
      color: Number.isFinite(Number(options.color)) ? Number(options.color) : cfg.color
    };

    if (!this._weatherPoints) {
      const count = 200;
      const pos = new Float32Array(count * 3);
      const phases = new Float32Array(count);
      for (let i = 0; i < count; i++) {
        pos[i * 3] = (Math.random() - 0.5) * 28;
        pos[i * 3 + 1] = Math.random() * 8.5;
        pos[i * 3 + 2] = (Math.random() - 0.5) * 28;
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
        blending: THREE.AdditiveBlending
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
    this._weatherPoints.visible = true;
  }

  _updateWeather(dt, elapsed, heroPos) {
    const pts = this._weatherPoints;
    const cfg = this._weatherCfg;
    if (!pts || !pts.visible || !cfg) return;
    if (heroPos) {
      pts.position.x = heroPos.x || 0;
      pts.position.z = heroPos.z || 0;
    }
    const attr = pts.geometry.getAttribute('position');
    const arr = attr.array;
    const phases = pts.userData.phases;
    const n = phases.length;
    const spanY = cfg.spanY || 8.0;
    for (let i = 0; i < n; i++) {
      const idx = i * 3;
      const ph = phases[i];
      arr[idx] += (cfg.vx + Math.sin(elapsed * 1.7 + ph) * cfg.sway) * dt;
      arr[idx + 1] += cfg.vy * dt;
      arr[idx + 2] += (cfg.vz + Math.cos(elapsed * 1.4 + ph) * cfg.sway) * dt;
      if (arr[idx + 1] < 0.08) arr[idx + 1] += spanY;
      else if (arr[idx + 1] > spanY) arr[idx + 1] -= spanY;
      if (arr[idx] < -14) arr[idx] += 28;
      else if (arr[idx] > 14) arr[idx] -= 28;
      if (arr[idx + 2] < -14) arr[idx + 2] += 28;
      else if (arr[idx + 2] > 14) arr[idx + 2] -= 28;
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
    const v = new THREE.Vector3(worldPos.x || 0, worldPos.y || 0, worldPos.z || 0);
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
    const ndc = new THREE.Vector2((clientX / w) * 2 - 1, -(clientY / h) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    this.groundPlane.constant = -groundY;
    const target = new THREE.Vector3();
    const hit = this.raycaster.ray.intersectPlane(this.groundPlane, target);
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
    const geo = new THREE.RingGeometry(0.2, 0.55, 28);
    const mat = new THREE.MeshBasicMaterial({
      color,
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
      this.cameraTarget.lerp(
        new THREE.Vector3(targetPos.x || 0, targetPos.y || 0, targetPos.z || 0),
        lerpFactor
      );
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
  }

  render() {
    this.webglRenderer.render(this.scene, this.camera);
  }
}

export function createRenderer(container) {
  return new Renderer(container);
}

export default Renderer;

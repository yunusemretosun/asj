import * as THREE from 'three';
import { createHeroMesh, disposeObject3D } from './models3d.js';
import { getClass } from '../systems/classes.js';
import { buildStarterEquipment } from '../systems/inventory.js';

// Preview wears exactly the gear the class starts the game with
function previewEquipment(clsOrId) {
  const id = typeof clsOrId === 'string' ? clsOrId : clsOrId?.id;
  return buildStarterEquipment(id);
}

function attackStateFor(style) {
  if (style === 'arrow') return 'shoot';
  if (style === 'magic_bolt') return 'cast';
  return 'attack';
}

/**
 * Small self-contained turntable preview of the hero (character creation screen).
 * @param {HTMLCanvasElement} canvas
 * @param {{ classId?: string, appearance?: object } | null} [initialLook=null]
 * @returns {{ setLook: (look: {classId?: string, appearance?: object}) => void, resize: () => void, dispose: () => void }}
 */
export function createHeroPreview(canvas, initialLook = null) {
  if (!canvas) throw new Error('createHeroPreview: canvas is required');

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: false });
  renderer.setPixelRatio(Math.min(1.5, window.devicePixelRatio || 1));
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 50);
  camera.position.set(0, 1.55, 4.6);
  camera.lookAt(0, 0.95, 0);

  // Lights
  scene.add(new THREE.HemisphereLight(0xf8fafc, 0x334155, 1.6));
  const key = new THREE.DirectionalLight(0xfff7e0, 2.4);
  key.position.set(2.5, 4.5, 3.5);
  key.castShadow = true;
  key.shadow.mapSize.set(512, 512);
  key.shadow.camera.left = -2;
  key.shadow.camera.right = 2;
  key.shadow.camera.top = 3;
  key.shadow.camera.bottom = -1;
  key.shadow.camera.near = 0.5;
  key.shadow.camera.far = 15;
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x93c5fd, 1.4);
  rim.position.set(-3, 2.5, -3);
  scene.add(rim);
  const accent = new THREE.PointLight(0x38bdf8, 2.0, 6);
  accent.position.set(0, 0.4, 1.2);
  scene.add(accent);

  // Ground disc + glow ring
  const groundGeo = new THREE.CylinderGeometry(1.15, 1.25, 0.08, 40);
  const groundMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.8, metalness: 0.2 });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.position.y = -0.04;
  ground.receiveShadow = true;
  scene.add(ground);

  const ringGeo = new THREE.RingGeometry(1.12, 1.2, 48);
  const ringMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.7, side: THREE.DoubleSide });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.005;
  scene.add(ring);

  // Hero initialized directly with initialLook (never hardcodes knight when another class is selected)
  const initClsObj = getClass(initialLook?.classId || 'knight');
  const initCls = initClsObj.id;
  const initAppearance = initialLook?.appearance ? { ...initialLook.appearance } : null;
  const initCol = initClsObj.color ?? 0x38bdf8;
  ringMat.color.setHex(initCol);
  accent.color.setHex(initCol);

  const hero = createHeroMesh(
    previewEquipment(initCls),
    { classId: initCls, appearance: initAppearance, isPreview: true }
  );
  scene.add(hero);

  let currentClassId = initCls;
  let attackStyle = hero.userData.attackStyle || initClsObj.attackStyle || 'melee';
  let disposed = false;
  let rafId = 0;
  let lastT = performance.now();
  let elapsed = 0;
  let nextAttackAt = 2.5;
  let attackT = -1;
  let comboStep = 1;
  const attackLen = () => (attackStyle === 'melee_heavy' ? 0.7 : attackStyle === 'arrow' ? 0.75 : 0.55);

  const resize = () => {
    if (disposed) return;
    const w = Math.max(1, canvas.clientWidth || canvas.width || 300);
    const h = Math.max(1, canvas.clientHeight || canvas.height || 300);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };

  const setLook = ({ classId, appearance } = {}) => {
    if (disposed) return;
    const cls = getClass(classId || currentClassId);
    const nextCls = cls.id;
    const classChanged = nextCls !== currentClassId;
    hero.userData.setLook?.({ classId: nextCls, appearance });
    if (classChanged) {
      currentClassId = nextCls;
      hero.userData.updateEquipment?.(previewEquipment(cls));
      const col = cls.color ?? 0x38bdf8;
      ringMat.color.setHex(col);
      accent.color.setHex(col);
      // Show off the new class with a quick attack
      attackT = 0;
      comboStep = 1;
      nextAttackAt = elapsed + 3.5;
    }
    attackStyle = hero.userData.attackStyle || cls.attackStyle || 'melee';
  };

  const loop = (now) => {
    if (disposed) return;
    rafId = requestAnimationFrame(loop);
    const dt = Math.min(0.05, Math.max(0, (now - lastT) / 1000));
    lastT = now;
    elapsed += dt;

    hero.rotation.y += dt * 0.55;
    ring.material.opacity = 0.55 + Math.sin(elapsed * 2.2) * 0.15;

    let state = 'idle';
    let progress = 0;
    if (attackT < 0 && elapsed >= nextAttackAt) {
      attackT = 0;
      comboStep = (comboStep % 3) + 1;
    }
    if (attackT >= 0) {
      attackT += dt;
      const len = attackLen();
      progress = Math.min(1, attackT / len);
      state = attackStateFor(attackStyle);
      if (attackT >= len) {
        attackT = -1;
        nextAttackAt = elapsed + 2.8 + Math.random() * 2.2;
      }
    }

    hero.userData.animate?.(state, elapsed, dt, comboStep, progress);
    renderer.render(scene, camera);
  };

  let resizeObserver = null;
  if (typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(() => resize());
    resizeObserver.observe(canvas);
  }

  resize();
  rafId = requestAnimationFrame(loop);

  const dispose = () => {
    if (disposed) return;
    disposed = true;
    cancelAnimationFrame(rafId);
    resizeObserver?.disconnect();
    scene.remove(hero);
    disposeObject3D(hero);
    disposeObject3D(ground);
    disposeObject3D(ring);
    scene.clear();
    key.shadow?.map?.dispose?.();
    renderer.renderLists?.dispose?.();
    renderer.dispose();
  };

  return { setLook, resize, dispose };
}

export default createHeroPreview;

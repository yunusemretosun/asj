// =============================================================================
// ARKENVEIL: SIGILS & JOURNEYS (ASJ) - Companion Pet System
// Inspired by Silkroad Online Grab Pets and Attack Pets.
// Pure data & logic: safe for node/headless testing, no direct DOM/Three.js dependencies.
// =============================================================================

export const PET_TYPES = {
  rabbit: {
    type: 'rabbit',
    name: 'White Rabbit',
    title: 'Silkroad Grab Pet',
    icon: '🐇',
    role: 'loot',
    price: 8000,
    lootRadius: 9.0,
    speed: 6.2,
    meshType: 'p_rabbit',
    glbPath: '/assets/sro/pets/p_rabbit.glb',
    targetHeight: 0.78,
    passives: {
      goldFind: 18,
      magicFind: 12,
      description: 'Official Silkroad White Rabbit Grab Pet that collects ground loot & gold within 9m. +18% Gold Find, +12% Magic Find.'
    }
  },
  wolf: {
    type: 'wolf',
    name: 'Silkroad Grey Wolf',
    title: 'Guard Attack Pet',
    icon: '🐺',
    role: 'combat',
    price: 18000,
    lootRadius: 5.5,
    speed: 5.8,
    meshType: 'p_wolf_01',
    glbPath: '/assets/sro/pets/p_wolf_01.glb',
    targetHeight: 0.72,
    passives: {
      atkPct: 12,
      critRate: 4,
      description: 'Loyal Silkroad Grey Wolf Attack Pet that strikes foes alongside you. +12% Physical & Magical Attack, +4% Crit Rate.'
    }
  },
  pig: {
    type: 'pig',
    name: 'Golden Piggy',
    title: 'Fortune Grab Pet',
    icon: '🐷',
    role: 'loot',
    price: 28000,
    lootRadius: 9.5,
    speed: 6.0,
    meshType: 'p_goldpig',
    glbPath: '/assets/sro/pets/p_goldpig.glb',
    targetHeight: 0.76,
    passives: {
      goldFind: 35,
      magicFind: 18,
      description: 'Official Silkroad Golden Piggy that auto-collects loot & boosts wealth. +35% Gold Find, +18% Magic Find.'
    }
  },
  cat: {
    type: 'cat',
    name: 'Siamese Cat',
    title: 'Collector Grab Pet',
    icon: '🐱',
    role: 'loot',
    price: 36000,
    lootRadius: 10.2,
    speed: 6.3,
    meshType: 'p_cat',
    glbPath: '/assets/sro/pets/p_cat.glb',
    targetHeight: 0.68,
    passives: {
      goldFind: 28,
      magicFind: 24,
      moveSpeedPct: 6,
      description: 'Agile Silkroad Cat Grab Pet with keen treasure instincts. +28% Gold Find, +24% Magic Find, +6% Move Speed.'
    }
  },
  tiger: {
    type: 'tiger',
    name: 'White Tiger Cub',
    title: 'Ferocious Companion',
    icon: '🐯',
    role: 'hybrid',
    price: 45000,
    lootRadius: 7.5,
    speed: 6.0,
    meshType: 'whitetiger',
    glbPath: '/assets/sro/mobs/whitetiger.glb',
    targetHeight: 0.82,
    passives: {
      attackSpeedPct: 12,
      critRate: 5,
      moveSpeedPct: 10,
      description: 'Swift Silkroad White Tiger that mauls enemies & auto-loots. +12% Attack Speed, +5% Crit Rate, +10% Move Speed.'
    }
  },
  fox: {
    type: 'fox',
    name: 'Spirit Nine-Fox',
    title: 'Swift Combat Companion',
    icon: '🦊',
    role: 'combat',
    price: 55000,
    lootRadius: 6.5,
    speed: 6.4,
    meshType: 'p_fox01',
    glbPath: '/assets/sro/pets/p_fox01.glb',
    targetHeight: 0.72,
    passives: {
      atkPct: 14,
      critRate: 7,
      moveSpeedPct: 12,
      description: 'Cunning Silkroad Spirit Fox that ambushes enemies at high speed. +14% ATK, +7% Crit Rate, +12% Move Speed.'
    }
  },
  bear: {
    type: 'bear',
    name: 'Armored War Bear',
    title: 'Vanguard Attack Pet',
    icon: '🐻',
    role: 'combat',
    price: 68000,
    lootRadius: 6.0,
    speed: 5.8,
    meshType: 'p_bear01',
    glbPath: '/assets/sro/pets/p_bear01.glb',
    targetHeight: 0.96,
    passives: {
      atkPct: 20,
      attackSpeedPct: 8,
      critRate: 5,
      description: 'Fierce Silkroad Armored War Bear bred to crush dungeon Guardians. +20% ATK, +8% Attack Speed, +5% Crit Rate.'
    }
  },
  bluetiger: {
    type: 'bluetiger',
    name: 'Celestial Blue Tiger',
    title: 'Mythic War Companion',
    icon: '🐆',
    role: 'hybrid',
    price: 85000,
    lootRadius: 8.5,
    speed: 6.4,
    meshType: 'bluetiger',
    glbPath: '/assets/sro/mobs/bluetiger.glb',
    targetHeight: 0.88,
    passives: {
      atkPct: 16,
      attackSpeedPct: 15,
      critRate: 6,
      magicFind: 20,
      description: 'Mythic Silkroad Blue Tiger that ravages foes & collects rare treasure. +16% ATK, +15% Attack Speed, +6% Crit, +20% Magic Find.'
    }
  },
  dragon: {
    type: 'dragon',
    name: 'Jade Fellow Dragon',
    title: 'Sovereign Fellow Pet',
    icon: '🐉',
    role: 'hybrid',
    price: 140000,
    lootRadius: 10.5,
    speed: 6.8,
    meshType: 'pet_dragon_a',
    glbPath: '/assets/sro/pets/pet_dragon_a.glb',
    targetHeight: 1.25,
    targetSpan: 1.95,
    passives: {
      atkPct: 22,
      attackSpeedPct: 18,
      critRate: 8,
      goldFind: 25,
      magicFind: 25,
      description: 'Legendary Silkroad Fellow Dragon commanding combat & treasure. +22% ATK, +18% Atk Spd, +8% Crit, +25% Gold & Magic Find.'
    }
  }
};

export class PetSystem {
  constructor(game = null) {
    this.game = game;
    this.pets = [];
    this.activePetId = null;
    this._listeners = new Map();
  }

  on(event, fn) {
    if (!this._listeners.has(event)) this._listeners.set(event, new Set());
    this._listeners.get(event).add(fn);
    return () => this.off(event, fn);
  }

  off(event, fn) {
    if (this._listeners.has(event)) this._listeners.get(event).delete(fn);
  }

  _emit(event, ...args) {
    if (this.game && typeof this.game.emit === 'function') {
      this.game.emit(event, ...args);
    }
    if (this._listeners.has(event)) {
      for (const fn of [...this._listeners.get(event)]) {
        try { fn(...args); } catch (e) { console.error(e); }
      }
    }
  }

  grantPet(type = 'rabbit', customName = null, summonIt = false) {
    const def = PET_TYPES[type] || PET_TYPES.rabbit;
    const petId = `pet_${type}_${Math.random().toString(36).slice(2, 7)}`;
    const newPet = {
      id: petId,
      type: def.type,
      name: customName || def.name,
      level: 1,
      exp: 0,
      maxExp: 100,
      active: Boolean(summonIt),
      summoned: Boolean(summonIt),
      role: def.role,
      icon: def.icon,
      passives: { ...def.passives }
    };
    this.pets.push(newPet);
    if (summonIt) {
      this.pets.forEach(p => { if (p.id !== petId) { p.active = false; p.summoned = false; } });
      this.activePetId = petId;
      this._emit('pet:summoned', newPet);
    }
    this._emit('pet:granted', newPet);
    return newPet;
  }

  grantStarterPet(type = 'rabbit', customName = null) {
    return this.grantPet(type, customName, true);
  }

  buyPet(type = 'rabbit', customName = null) {
    const def = PET_TYPES[type];
    if (!def) return { ok: false, msg: 'Unknown companion pet type.' };
    if (this.pets.some((p) => p.type === type)) {
      return { ok: false, msg: `You already own ${def.name}!` };
    }
    const price = Number(def.price) || 8000;
    const gold = Number(this.game?.hero?.gold || 0);
    if (gold < price) {
      return { ok: false, msg: `Not enough gold! Need ${price.toLocaleString()} G for ${def.name}.` };
    }
    if (this.game?.hero) {
      this.game.hero.gold = gold - price;
    }
    const shouldSummon = !this.getActivePet();
    const pet = this.grantPet(type, customName || def.name, shouldSummon);
    this.game?.markDirty?.();
    this.game?.emit?.('change');
    this._emit('toast', `🐾 Purchased ${pet.name} for ${price.toLocaleString()} G!`, 'loot');
    return { ok: true, msg: `Purchased ${pet.name}!`, pet, spent: price };
  }

  getActivePet() {
    if (!this.activePetId) return null;
    return this.pets.find(p => p.id === this.activePetId) || null;
  }

  summon(petId) {
    const pet = this.pets.find(p => p.id === petId);
    if (!pet) return { ok: false, msg: 'Pet not found' };
    this.pets.forEach(p => { p.active = false; p.summoned = false; });
    pet.active = true;
    pet.summoned = true;
    this.activePetId = pet.id;
    if (this.game) this.game.markDirty?.();
    this._emit('pet:summoned', pet);
    return { ok: true, msg: `Summoned ${pet.name}!`, pet };
  }

  dismiss() {
    const cur = this.getActivePet();
    if (!cur) return { ok: false, msg: 'No active pet to dismiss' };
    cur.summoned = false;
    this.activePetId = null;
    if (this.game) this.game.markDirty?.();
    this._emit('pet:dismissed', cur);
    return { ok: true, msg: `Dismissed ${cur.name}.`, pet: cur };
  }

  toggleSummon(petId) {
    if (this.activePetId === petId) {
      return this.dismiss();
    }
    return this.summon(petId);
  }

  rename(petId, newName) {
    const pet = this.pets.find(p => p.id === petId);
    if (!pet || !newName) return { ok: false, msg: 'Invalid name' };
    pet.name = String(newName).trim().slice(0, 16);
    this._emit('pet:renamed', pet);
    return { ok: true, msg: `Pet renamed to ${pet.name}`, pet };
  }

  addExp(amount) {
    const pet = this.getActivePet();
    if (!pet) return;
    pet.exp += Math.max(0, Math.round(Number(amount) || 0));
    while (pet.exp >= pet.maxExp && pet.level < 100) {
      pet.exp -= pet.maxExp;
      pet.level += 1;
      pet.maxExp = Math.round(100 * Math.pow(1.18, pet.level - 1));
      this._emit('pet:levelup', pet);
      this._emit('toast', `✨ Companion ${pet.name} reached Level ${pet.level}!`, 'levelup');
    }
    this._emit('pet:exp', pet);
  }

  /** Gold sink: feed a Royal Silkroad Feast in Town to train & level the active companion pet. */
  trainActivePetWithGold(cost = 2500, expGain = 500) {
    const pet = this.getActivePet();
    if (!pet) return { ok: false, msg: 'Summon an owned companion first to feed & train it.' };
    if (pet.level >= 100) return { ok: false, msg: `${pet.name} is already Max Level!` };
    if (!this.game || (this.game.hero.gold || 0) < cost) {
      return { ok: false, msg: `Not enough Gold! Needs ${cost.toLocaleString()} G.` };
    }
    this.game.spendGold(cost);
    const prevLv = pet.level;
    this.addExp(expGain);
    this.game.markDirty?.();
    this.game.emit?.('change');
    const msg = pet.level > prevLv
      ? `🐾 ${pet.name} devoured the Royal Feast and leveled up to Lv.${pet.level}!`
      : `🐾 Fed ${pet.name} a Royal Feast (+${expGain} Pet EXP)!`;
    this._emit('toast', msg, 'loot');
    return { ok: true, msg, pet, expGain, cost };
  }

  /**
   * Passive stat bonuses granted to the player character while pet is summoned.
   */
  getPassiveMods() {
    const pet = this.getActivePet();
    if (!pet || !pet.summoned) return {};
    const base = PET_TYPES[pet.type]?.passives || {};
    const lvScale = 1 + (pet.level - 1) * 0.05;
    const out = {};
    for (const [k, v] of Object.entries(base)) {
      if (typeof v === 'number') {
        out[k] = Math.round(v * lvScale * 10) / 10;
      }
    }
    return out;
  }

  toJSON() {
    return {
      pets: this.pets,
      activePetId: this.activePetId
    };
  }

  fromJSON(d = {}) {
    if (Array.isArray(d.pets) && d.pets.length > 0) {
      this.pets = d.pets;
      this.activePetId = d.activePetId || (this.pets[0] ? this.pets[0].id : null);
    }
  }
}

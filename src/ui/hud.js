// ============================================================================
// ASJ (ARKENVEIL: SIGILS & JOURNEYS) - in-game HUD (owned by ui-hud)
//
// Usage (main.js):
//   import './ui/styles.css';
//   import { HUD } from './ui/hud.js';             // or createHUD(root, ctx)
//   const hud = new HUD(document.getElementById('hud-root'), gameContext);
//   ... each frame:  hud.update(dt, gameContext);
//
// The HUD reads everything through a normalised "host" adapter (see
// `createHost` in ./host.js section below) so it tolerates small differences in
// the systems' shapes. A custom host object may be passed instead of a context
// by giving it `{ __host: true, ...functions }`.
// ============================================================================

import { BERSERK, berserkOrbs } from '../systems/mechanics.js';

export const MENU_BUTTONS = [
  { menu: 'character', key: 'C', icon: '\u{1F9D9}', label: 'Hero' },
  { menu: 'inventory', key: 'B', icon: '\u{1F392}', label: 'Bag' },
  { menu: 'skills', key: 'K', icon: '\u2728', label: 'Skills' },
  { menu: 'compose', key: 'O', icon: '\u2697\uFE0F', label: 'Compose' },
  { menu: 'quests', key: 'Q', icon: '\u{1F4DC}', label: 'Quests' },
  { menu: 'map', key: 'M', icon: '\u{1F5FA}\uFE0F', label: 'Floors' },
  { menu: 'pet', key: 'P', icon: '\u{1F43E}', label: 'Pet' },
  { menu: '__save', key: 'F5', icon: '\u{1F4BE}', label: 'Save' },
];

export const ELEMENT_COLOR = { fire: '#ff6a2a', ice: '#6fd4ff', lightning: '#ffee44', poison: '#7dff5a', physical: '#e8e0d0', holy: '#fff0a0', dark: '#b48cff' };
export const ELEMENT_ICON = { fire: '\u{1F525}', ice: '\u2744\uFE0F', lightning: '\u26A1', poison: '\u2620\uFE0F', physical: '\u2694\uFE0F', holy: '\u2728', dark: '\u{1F311}' };

const DEFAULT_SKILL_KEYS = ['1', '2', '3', '4', '5'];
const DEFAULT_POTION_KEYS = ['6', '7', '8', '9'];
const DEFAULT_ALL_HOTBAR_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

// ---------------------------------------------------------------------------
// small DOM helpers
// ---------------------------------------------------------------------------
export function h(tag, cls, html) {
  const el = document.createElement(tag);
  if (cls) el.className = cls;
  if (html != null) el.innerHTML = html;
  return el;
}
export function esc(s) {
  return String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}
export function renderIconHTML(icon, fallback = '📦', cls = 'sro-icon') {
  if (typeof icon === 'string' && (icon.startsWith('/') || icon.startsWith('http') || icon.endsWith('.png') || icon.endsWith('.webp'))) {
    return `<img class="${cls}" src="${esc(icon)}" alt="" draggable="false"/>`;
  }
  return esc(icon || fallback);
}
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const fmt = (n) => (Math.abs(n) >= 10000 ? (n / 1000).toFixed(1) + 'k' : String(Math.round(n)));

/** A glowing HP/SP/EXP style bar with change-ghost + text label. */
class Bar {
  constructor(kind, withLabel = true) {
    this.el = h('div', 'arc-bar ' + kind);
    this.ghost = h('div', 'ghost');
    this.fill = h('div', 'fill');
    this.el.append(this.ghost, this.fill);
    if (withLabel) { this.label = h('div', 'label'); this.el.append(this.label); }
    this._p = -1; this._t = null;
  }
  set(cur, max, text) {
    const p = max > 0 ? clamp01(cur / max) : 0;
    const pr = Math.round(p * 1000) / 10;
    if (pr !== this._p) {
      this.fill.style.width = pr + '%';
      this.ghost.style.width = pr + '%';
      this._p = pr;
      this.el.classList.toggle('low', p < 0.25 && p > 0);
    }
    if (this.label) {
      const t = text != null ? text : `${fmt(cur)} / ${fmt(max)}`;
      if (t !== this._t) { this.label.textContent = t; this._t = t; }
    }
  }
}

// ---------------------------------------------------------------------------
// HUD
// ---------------------------------------------------------------------------
export class HUD {
  /**
   * @param {HTMLElement} root  element the HUD is appended to
   * @param {object} ctx        gameContext ({gameState, inventory, skills, quests, dungeon, enemyManager, player, menus...})
   *                            or a ready host ({__host:true,...})
   */
  constructor(root = document.body, ctx = null) {
    this.root = root || document.body;
    this.ctx = ctx;
    this.host = null;
    this._hostSig = null;
    this._unsub = [];
    this._recentToasts = new Map();
    this._boss = null; this._bossManual = false;
    this._mmData = null; this._mmTimer = 0; this._mmManual = false;
    this._last = { level: null, hp: null, buffKey: '', zone: '' };
    this._build();
    this._bindHost(ctx);
    document.documentElement.classList.add('arc-ui');
  }

  // ---------------------------------------------------------------- build
  _build() {
    const R = (this.el = h('div', 'arc-hud arc-ui'));
    this.root.appendChild(R);
    R.append((this.elLow = h('div', 'hud-lowhp')), (this.elFlash = h('div', 'hud-flash')));

    // --- hero panel
    const hero = (this.elHero = h('div', 'hud-hero arc-frame'));
    const por = h('div', 'hud-portrait', '\u{1F9D9}');
    this.elLevel = h('div', 'hud-level', '1');
    por.appendChild(this.elLevel);
    const bars = h('div', 'hud-bars');
    this.elName = h('div', 'hud-name', '<span class="n">Hero</span><span class="gold">0 G</span>');
    this.barHp = new Bar('hp');
    this.barSp = new Bar('sp');
    this.barStam = new Bar('stam');

    // 5-Orb Berserk (Hwan) Bar
    const berserk = (this.elBerserk = h('div', 'hud-berserk interactive'));
    berserk.id = 'hud-berserk';
    const orbsWrap = h('div', 'hud-berserk-orbs');
    this.berserkOrbEls = [];
    for (let i = 0; i < 5; i++) {
      const orb = h('div', 'hud-berserk-orb');
      this.berserkOrbEls.push(orb);
      orbsWrap.appendChild(orb);
    }
    this.elBerserkLabel = h('span', 'hud-berserk-label', 'HWAN 0/5');
    berserk.append(orbsWrap, this.elBerserkLabel);
    berserk.title = 'Berserk (Hwan) Gauge [TAB]';
    berserk.addEventListener('click', () => {
      const c = this.ctx || (this.host && this.host.ctx) || {};
      if (c.player && typeof c.player.tryActivateBerserk === 'function') {
        c.player.tryActivateBerserk();
      } else if (c.gameState && typeof c.gameState.activateBerserk === 'function') {
        c.gameState.activateBerserk();
      }
    });

    bars.append(this.elName, this.barHp.el, this.barSp.el, this.barStam.el, berserk);
    hero.append(por, bars);
    this.elPetBadge = h('div', 'pet-hud-widget interactive');
    this.elPetBadge.title = 'Companion Pet [P] — Click to manage';
    this.elPetBadge.addEventListener('click', () => this._menuClick('pet'));
    this.elChallenge = h('div', 'challenge-hud-banner');
    this.elCombo = h('div', 'hud-combo');
    this.elBuffs = h('div', 'hud-buffs');
    R.append(hero, this.elPetBadge, this.elChallenge, this.elCombo, this.elBuffs);

    // --- minimap
    const mm = (this.elMM = h('div', 'hud-minimap arc-frame'));
    this.elMMTitle = h('div', 'mm-title', '\u2014');
    this.cv = h('canvas');
    this.cv.width = 380; this.cv.height = 340;
    this.cx = this.cv.getContext('2d');
    mm.append(this.elMMTitle, this.cv, h('div', 'mm-legend',
      '<span><i style="background:#4ef">&nbsp;</i>You</span><span><i style="background:#f44"></i>Foe</span>' +
      '<span><i style="background:#fd4"></i>Chest</span><span><i style="background:#5f8"></i>NPC</span><span><i style="background:#c6f"></i>Portal</span>'));
    R.appendChild(mm);

    // --- top centre
    const tc = h('div', 'hud-top-center');
    this.elNemesisWarning = h('div', 'hud-nemesis-warning');
    this.elZone = h('div', 'hud-zone', '');
    this.elBoss = h('div', 'hud-boss arc-frame');
    this.elBoss.id = 'hud-boss-bar';
    this.elBossName = h('div', 'boss-name', '<span class="bn"></span><span class="bp"></span>');
    this.elBossBadge = h('div', 'boss-badge');
    this.barBoss = new Bar('boss');
    this.elBoss.append(this.elBossName, this.barBoss.el, this.elBossBadge);
    tc.append(this.elNemesisWarning, this.elZone, this.elBoss);
    R.appendChild(tc);

    // banner / prompt / toasts
    this.elBanner = h('div', 'hud-banner', '<div class="b-floor"></div><div class="b-name"></div>');
    this.elPrompt = h('div', 'hud-prompt');
    this.elToasts = h('div', 'hud-toasts');
    R.append(this.elBanner, this.elPrompt, this.elToasts);

    // --- bottom bar
    const bot = h('div', 'hud-bottom');
    this.elSoaking = h('div', 'hud-soaking-indicator', '\u2668 Soaking in Jade Mist Hot Springs (+HP/MP &amp; Rested EXP)');
    const expWrap = h('div', 'hud-exp-wrap');
    this.barExp = new Bar('exp');
    this.elRestedExp = h('div', 'hud-rested-badge');
    expWrap.append(this.barExp.el, this.elRestedExp);
    const ab = h('div', 'hud-actionbar arc-frame interactive');
    this.skillSlots = [];
    const sg = h('div', 'slot-group');
    for (let i = 0; i < 5; i++) {
      const s = this._makeSlot('skill', DEFAULT_SKILL_KEYS[i]);
      s.el.addEventListener('click', () => this._emit('skillslot', i));
      s.el.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        if (this.host && this.host.assignSkill) this.host.assignSkill(null, i);
      });
      this.skillSlots.push(s); sg.appendChild(s.el);
    }
    const pg = h('div', 'slot-group');
    this.potionSlots = [];
    for (let i = 0; i < 4; i++) {
      const s = this._makeSlot('potion', DEFAULT_POTION_KEYS[i]);
      s.el.addEventListener('click', () => {
        if (!this.host) return;
        const bar = (this.host.getSkillBar && this.host.getSkillBar()) || [];
        if (bar[5 + i]) this._emit('skillslot', 5 + i);
        else if (this.host.usePotion) this.host.usePotion(i);
      });
      s.el.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        if (!this.host) return;
        const bar = (this.host.getSkillBar && this.host.getSkillBar()) || [];
        if (bar[5 + i] && this.host.assignSkill) this.host.assignSkill(null, 5 + i);
        else if (this.host.assignPotion) this.host.assignPotion(i, null);
      });
      this.potionSlots.push(s); pg.appendChild(s.el);
    }
    const mb = h('div', 'hud-menubtns');
    this.menuBtns = {};
    for (const b of MENU_BUTTONS) {
      const btn = h('button', 'menu-btn', `<span>${b.icon}</span><b>${b.key}</b><i class="badge"></i>`);
      btn.title = `${b.label} (${b.key})`;
      btn.addEventListener('click', (e) => { e.currentTarget.blur(); this._menuClick(b.menu); });
      this.menuBtns[b.menu] = btn; mb.appendChild(btn);
    }
    ab.append(sg, h('div', 'slot-sep'), pg, h('div', 'slot-sep'), mb);
    bot.append(this.elSoaking, expWrap, ab);
    R.appendChild(bot);
    this._tipTarget = null;
  }

  _makeSlot(kind, key) {
    const el = h('div', 'hud-slot ' + kind + ' empty');
    const icon = h('span', 'ic', kind === 'skill' ? '\u2014' : '\u2014');
    const k = h('span', 'key', esc(key));
    const sweep = h('div', 'cd-sweep');
    const txt = h('div', 'cd-text');
    const cnt = h('span', 'cnt');
    const cost = h('span', 'sp-cost');
    const lv = h('span', 'lv');
    el.append(icon, sweep, txt, k, cnt, cost, lv);
    return { el, icon, key: k, sweep, txt, cnt, cost, lv, _ico: null, _cd: -1, _ready: true };
  }

  _menuClick(menu) {
    if (menu === '__save') {
      const r = this.host && this.host.save ? this.host.save() : null;
      this.showToast(r && r.ok === false ? (r.msg || 'Save failed') : 'Game saved', r && r.ok === false ? 'warn' : 'info');
      return;
    }
    if (this.ctx && this.ctx.menus && typeof this.ctx.menus.toggleMenu === 'function') {
      this.ctx.menus.toggleMenu(menu);
      return;
    }
    window.dispatchEvent(new CustomEvent('arc-ui-menu', { detail: { name: menu, toggle: true } }));
  }
  _emit(name, detail) {
    if (name === 'skillslot' && this.host && this.host.castSkillSlot) {
      try { this.host.castSkillSlot(detail); } catch (e) { /* ignore */ }
    }
    window.dispatchEvent(new CustomEvent('arc-ui-' + name, { detail }));
  }

  // ------------------------------------------------------------------ host
  _bindHost(ctx) {
    const sig = ctx && (ctx.__host ? ctx : (ctx.gameState || ctx.game || ctx.state || ctx));
    if (sig === this._hostSig && this.host) return;
    this._hostSig = sig;
    this._unsub.forEach((f) => { try { f(); } catch (e) { /* ignore */ } });
    this._unsub = [];
    this.ctx = ctx;
    this.host = ctx ? (ctx.__host ? ctx : createHost(ctx)) : null;
    const host = this.host;
    if (host && host.on) {
      this._unsub.push(host.on('toast', (msg, type) => this.showToast(msg, type || 'info')));
      this._unsub.push(host.on('levelup', (lv) => {
        this.showToast(`LEVEL UP!  Lv ${lv && lv.level ? lv.level : (typeof lv === 'number' ? lv : '')}`.trim(), 'levelup');
        this.levelUpFlash();
      }));
      this._unsub.push(host.on('alchemy', (d) => {
        if (d && d.success && (d.plus | 0) >= 7) {
          const nm = d.item && d.item.name ? String(d.item.name).replace(/\s*\+\d+\s*$/, '') : 'ITEM';
          this.showAlchemyBanner(`\u26A1 +${d.plus | 0} ${nm.toUpperCase()} \u26A1`);
        }
      }));
    }
  }

  // ---------------------------------------------------------------- update
  update(dt = 0.016, ctx) {
    if (ctx && ctx !== this.ctx) this._bindHost(ctx);
    else if (ctx && !this.host) this._bindHost(ctx);
    const host = this.host;
    if (!host) return;
    let p = null;
    try { p = host.getPlayer && host.getPlayer(); } catch (e) { p = null; }
    if (p) this._updateHero(p, dt);
    try { this._updateBerserk(ctx, p, dt); } catch (e) { /* ignore */ }
    try { this._updateRestedAndSoaking(ctx, p, dt); } catch (e) { /* ignore */ }
    try { this._updateNemesis(ctx, p, dt); } catch (e) { /* ignore */ }
    try { this._updatePetWidget(host); } catch (e) { /* ignore */ }
    try { this._updateChallengeBanner(ctx); } catch (e) { /* ignore */ }
    try { this._updateBar(host, p, dt); } catch (e) { /* keep HUD alive on bad data */ }
    try { this._updateMinimap(host, dt); } catch (e) { /* ignore */ }
    try { this._updateBoss(host); } catch (e) { /* ignore */ }
    try { this._updatePrompt(host); } catch (e) { /* ignore */ }
    try { this._updateBadges(host, p); } catch (e) { /* ignore */ }
  }

  _updateBerserk(ctx, p, dt) {
    if (!this.elBerserk) return;
    const c = ctx || this.ctx || (this.host && this.host.ctx) || {};
    const hero = c.hero || (c.gameState && c.gameState.hero) || p || {};
    const charge = Number(hero.berserkCharge ?? p?.berserkCharge ?? c.player?.berserkCharge ?? 0);
    const active = Boolean(hero.berserkActive ?? p?.berserkActive ?? c.player?.berserkActive);
    const remaining = Number(hero.berserkRemaining ?? p?.berserkRemaining ?? c.player?.berserkRemaining ?? 0);

    const litOrbs = active ? 5 : berserkOrbs(charge);
    for (let i = 0; i < 5; i++) {
      const orb = this.berserkOrbEls && this.berserkOrbEls[i];
      if (!orb) continue;
      orb.classList.toggle('active', i < litOrbs);
      orb.classList.toggle('blazing', active);
    }
    this.elBerserk.classList.toggle('active', active);
    const isReady = charge >= BERSERK.maxCharge && !active;
    this.elBerserk.classList.toggle('ready', isReady);

    if (active) {
      this.elBerserkLabel.textContent = `⚡ BERSERK ${remaining.toFixed(1)}s`;
    } else if (isReady) {
      this.elBerserkLabel.textContent = `[TAB] BERSERK READY!`;
    } else {
      this.elBerserkLabel.textContent = `HWAN ${berserkOrbs(charge)}/5`;
    }
  }

  _updateRestedAndSoaking(ctx, p, dt) {
    const c = ctx || this.ctx || (this.host && this.host.ctx) || {};
    const hero = c.hero || (c.gameState && c.gameState.hero) || p || {};
    const rested = Math.floor(hero.restedExp ?? p?.restedExp ?? 0);
    const soaking = Boolean(hero.isSoaking ?? p?.isSoaking ?? c.player?.isSoaking);

    if (this.elRestedExp) {
      if (rested > 0) {
        this.elRestedExp.textContent = `♨ Rested: +${rested} EXP`;
        this.elRestedExp.classList.add('on');
      } else {
        this.elRestedExp.classList.remove('on');
      }
    }

    if (this.elSoaking) {
      this.elSoaking.classList.toggle('on', soaking);
    }
  }

  _updateNemesis(ctx, p, dt) {
    const c = ctx || this.ctx || (this.host && this.host.ctx) || {};
    const em = c.enemyManager || c.enemies || (this.host && this.host.ctx && this.host.ctx.enemyManager);
    const enemies = (em && (typeof em.getAliveEnemies === 'function' ? em.getAliveEnemies() : em.enemies)) || c.enemies || [];
    const nemesis = Array.isArray(enemies)
      ? enemies.find((e) => e && e.isNemesis && (e.hp == null || e.hp > 0) && !e.isDead && e.state !== 'DEAD' && e.state !== 'dead')
      : null;

    this._activeNemesis = nemesis || null;

    if (!this.elNemesisWarning) return;
    if (!nemesis) {
      this.elNemesisWarning.classList.remove('on');
      return;
    }

    const nx = Number(nemesis.x ?? nemesis.position?.x ?? (nemesis.mesh && nemesis.mesh.position && nemesis.mesh.position.x) ?? 0);
    const nz = Number(nemesis.z ?? nemesis.y ?? nemesis.position?.z ?? nemesis.position?.y ?? (nemesis.mesh && nemesis.mesh.position && nemesis.mesh.position.z) ?? 0);

    const pc = c.player || c.playerController;
    const ppos = pc ? (pc.position || pc.pos || (pc.mesh && pc.mesh.position) || (pc.heroMesh && pc.heroMesh.position) || pc) : null;
    const px = Number(ppos?.x ?? p?.x ?? 0);
    const pz = Number(ppos?.z ?? ppos?.y ?? p?.z ?? p?.y ?? 0);

    const dist = Math.hypot(nx - px, nz - pz);
    if (dist <= 28) {
      this.elNemesisWarning.textContent = `⚔ NEMESIS NEARBY: ${nemesis.name || 'Nemesis'}`;
      this.elNemesisWarning.classList.add('on');
    } else {
      this.elNemesisWarning.classList.remove('on');
    }
  }

  _updatePetWidget(host) {
    if (!this.elPetBadge || !host || typeof host.getPets !== 'function') return;
    const data = host.getPets() || {};
    const ap = data.activePet;
    if (!ap || !ap.summoned) {
      const hasAny = Array.isArray(data.pets) && data.pets.length > 0;
      const nextKey = hasAny ? 'idle' : 'none';
      if (this._last.petKey === nextKey) return;
      this._last.petKey = nextKey;
      this.elPetBadge.classList.toggle('dismissed', true);
      this.elPetBadge.classList.toggle('hidden', !hasAny);
      this.elPetBadge.innerHTML = `<span class="pet-hud-ic">🐾</span><span class="pet-hud-meta"><b>No Pet Active</b><small>Press [P] to summon</small></span>`;
      return;
    }
    const roleTxt = ap.role === 'loot' ? 'Auto-Loot' : ap.role === 'hybrid' ? 'Loot & Combat' : 'Combat Assist';
    const expPct = ap.maxExp > 0 ? Math.min(100, Math.round((ap.exp / ap.maxExp) * 100)) : 0;
    const nextKey = `${ap.id}:${ap.level}:${expPct}:${ap.name}`;
    if (this._last.petKey === nextKey) return;
    this._last.petKey = nextKey;
    this.elPetBadge.classList.remove('dismissed', 'hidden');
    this.elPetBadge.innerHTML = `
      <span class="pet-hud-ic">${ap.icon || '🐾'}</span>
      <span class="pet-hud-meta">
        <b>${esc(ap.name)} <span class="pet-hud-lv">Lv.${ap.level | 0}</span></b>
        <small>${roleTxt} · [P]</small>
      </span>`;
  }

  _updateChallengeBanner(ctx) {
    if (!this.elChallenge) return;
    const ch = ctx?.challenge || this.ctx?.challenge || null;
    if (!ch || !ch.active) {
      if (this._last.challengeKey !== 'off') {
        this._last.challengeKey = 'off';
        this.elChallenge.className = 'challenge-hud-banner';
        this.elChallenge.innerHTML = '';
      }
      return;
    }
    const rem = Math.max(0, Number(ch.remaining) || 0).toFixed(1);
    const wave = ch.wave || 1;
    const kills = ch.kills || 0;
    const done = Boolean(ch.completed);
    const key = `${ch.id}:${done ? 'done' : rem}:${wave}:${kills}`;
    if (this._last.challengeKey === key) return;
    this._last.challengeKey = key;
    this.elChallenge.className = `challenge-hud-banner on ${done ? 'done' : ''}`;
    if (done) {
      this.elChallenge.innerHTML = `
        <div class="ch-title">✨ ${esc(ch.name || 'Challenge Complete!')}</div>
        <div class="ch-sub">Victory! Loot your reward chests &amp; enter the Emerald Return Portal [E]</div>`;
    } else {
      this.elChallenge.innerHTML = `
        <div class="ch-top">
          <span class="ch-title">⚔️ ${esc(ch.name || 'Timed Trial')}</span>
          <span class="ch-timer">⏱ ${rem}s</span>
        </div>
        <div class="ch-sub">Wave ${wave} · Slain: ${kills} · ${esc(ch.desc || 'Survive until time runs out!')}</div>`;
    }
  }

  _updateHero(p, dt) {
    const L = this._last;
    this.elName.firstChild.textContent = (p.classIcon ? p.classIcon + ' ' : '') + (p.name || 'Hero');
    this.elName.firstChild.title = p.className || '';
    const g = this.elName.lastChild; const gt = `${Math.floor(p.gold || 0).toLocaleString()} G`;
    if (g.textContent !== gt) g.textContent = gt;
    if (L.level !== p.level) {
      this.elLevel.textContent = p.level;
      if (L.level != null && p.level > L.level) this.levelUpFlash();
      L.level = p.level;
    }
    if (L.hp != null && p.hp < L.hp - 0.5) this.damageFlash(clamp01((L.hp - p.hp) / Math.max(1, p.maxHp) * 4));
    L.hp = p.hp;
    this.barHp.set(Math.max(0, p.hp), p.maxHp);
    this.barSp.set(p.sp, p.maxSp);
    this.barStam.set(p.stamina ?? 0, p.maxStamina ?? 0, '');
    this.elLow.classList.toggle('on', p.maxHp > 0 && p.hp / p.maxHp < 0.25 && p.hp > 0);

    const combo = p.combo | 0;
    if (combo > 1) {
      if (combo !== L.combo) {
        this.elCombo.innerHTML = `${combo}<small>HIT COMBO</small>`;
        this.elCombo.classList.remove('pop'); void this.elCombo.offsetWidth; this.elCombo.classList.add('pop');
      }
      this.elCombo.classList.add('on');
    } else this.elCombo.classList.remove('on');
    L.combo = combo;

    this.barExp.set(p.exp, p.expToNext, `Lv ${p.level}   EXP ${fmt(p.exp)} / ${fmt(p.expToNext)}  (${p.expToNext > 0 ? (100 * p.exp / p.expToNext).toFixed(1) : 0}%)`);
    this._updateBuffs(p.buffs || []);
  }

  _updateBuffs(buffs) {
    const key = buffs.map((b) => (b.id || b.name) + (b.imbue && b.imbue.element ? ':' + b.imbue.element : '')).join('|');
    const imb = buffs.find((b) => b && b.imbue && b.imbue.element);
    const imbEl = imb ? String(imb.imbue.element) : '';
    if (imbEl !== this._last.imbue && this.skillSlots && this.skillSlots[0]) {
      this._last.imbue = imbEl;
      const bar = this.skillSlots[0].el.parentNode && this.skillSlots[0].el.parentNode.parentNode;
      if (bar) {
        bar.classList.toggle('imbued', !!imbEl);
        if (imbEl) bar.style.setProperty('--ec', ELEMENT_COLOR[imbEl] || '#fff'); else bar.style.removeProperty('--ec');
      }
    }
    if (key !== this._last.buffKey) {
      this._last.buffKey = key;
      this.elBuffs.textContent = '';
      this._buffEls = buffs.map((b) => {
        const ie = b.imbue && b.imbue.element ? String(b.imbue.element) : '';
        const ico = b.icon || (ie ? (ELEMENT_ICON[ie] || '\u2728') : (b.debuff ? '\u2620\uFE0F' : '\u2B06\uFE0F'));
        const el = h('div', 'buff-icon' + (b.debuff ? ' debuff' : '') + (ie ? ' imbue' : ''), `<span>${esc(ico)}</span><div class="sweep"></div><span class="t"></span>`);
        el.title = b.name || b.id || '';
        if (ie) el.style.setProperty('--ec', ELEMENT_COLOR[ie] || '#fff');
        this.elBuffs.appendChild(el);
        return el;
      });
    }
    buffs.forEach((b, i) => {
      const el = this._buffEls[i]; if (!el) return;
      const rem = b.remaining, dur = b.duration;
      const t = el.querySelector('.t');
      if (rem != null && isFinite(rem)) {
        const s = rem >= 10 ? Math.ceil(rem) + '' : rem.toFixed(1);
        if (t.textContent !== s) t.textContent = s;
        if (dur) el.querySelector('.sweep').style.transform = `scaleY(${1 - clamp01(rem / dur)})`;
        el.classList.toggle('expiring', rem < 3);
      } else t.textContent = '';
    });
  }

  _renderSkillSlot(s, sk, p, defaultKey) {
    if (sk && sk.key) s.key.textContent = sk.key;
    else if (!s.key.textContent) s.key.textContent = defaultKey;
    if (!sk) {
      if (s._ico !== null) {
        s.icon.innerHTML = '\u2014'; s.el.classList.add('empty'); s._ico = null;
        s.cost.textContent = ''; s.lv.textContent = ''; s.txt.textContent = '';
        s.cnt.textContent = ''; s.el.style.opacity = '';
        s.sweep.style.setProperty('--cd', '0deg');
        s.el.title = 'Empty slot';
      }
      s.el.classList.remove('nosp');
      return;
    }
    const ico = sk.icon || '\u2728';
    const sig = `skill|${sk.skillId}|${ico}|${sk.level}|${sk.spCost}`;
    if (s._ico !== sig) {
      s._ico = sig; s.icon.innerHTML = renderIconHTML(ico, '\u2728'); s.el.classList.remove('empty');
      s.el.title = `${sk.name || ''} (Right-click to clear)`;
      s.cost.textContent = sk.spCost ? sk.spCost : ''; s.lv.textContent = sk.level ? 'L' + sk.level : '';
      s.cnt.textContent = ''; s.el.style.opacity = '';
    }
    const cd = Math.max(0, sk.cooldown || 0), max = sk.cooldownMax || 0;
    const deg = cd > 0 && max > 0 ? Math.round(clamp01(cd / max) * 360) : 0;
    if (deg !== s._cd) { s.sweep.style.setProperty('--cd', deg + 'deg'); s._cd = deg; }
    const tx = cd > 0 ? (cd >= 10 ? Math.ceil(cd) : cd.toFixed(1)) + '' : '';
    if (s.txt.textContent !== tx) s.txt.textContent = tx;
    if (s._ready === false && cd <= 0) { s.el.classList.remove('ready-flash'); void s.el.offsetWidth; s.el.classList.add('ready-flash'); }
    s._ready = cd <= 0;
    s.el.classList.toggle('nosp', !!(p && sk.spCost && p.sp < sk.spCost));
  }

  _updateBar(host, p, dt) {
    const skills = (host.getSkillBar && host.getSkillBar()) || [];
    for (let i = 0; i < this.skillSlots.length; i++) {
      this._renderSkillSlot(this.skillSlots[i], skills[i], p, DEFAULT_SKILL_KEYS[i]);
    }
    const pots = (host.getPotionSlots && host.getPotionSlots()) || [];
    for (let i = 0; i < this.potionSlots.length; i++) {
      const s = this.potionSlots[i];
      const sk = skills[5 + i];
      if (sk) {
        s.el.classList.add('as-skill');
        this._renderSkillSlot(s, sk, p, DEFAULT_POTION_KEYS[i]);
        continue;
      }
      s.el.classList.remove('as-skill', 'nosp');
      const q = pots[i];
      if (q && q.key) s.key.textContent = q.key; else if (!s.key.textContent) s.key.textContent = DEFAULT_POTION_KEYS[i];
      const it = q && q.item;
      const sig = it ? ('item|' + (it.baseId || it.uid || '') + '|' + it.name + '|' + it.icon) : '';
      if (s._ico !== sig) {
        s._ico = sig; s.icon.innerHTML = it ? renderIconHTML(it.icon, '\u{1F9EA}') : '\u2014';
        s.el.classList.toggle('empty', !it);
        s.el.title = it ? `${it.name} (Right-click to clear)` : 'Empty slot (6-9: Skill or Item)';
        s.cost.textContent = ''; s.lv.textContent = '';
      }
      const c = it ? (it.count != null ? String(it.count) : '') : '';
      if (s.cnt.textContent !== c) s.cnt.textContent = c;
      const pcd = Math.max(0, (q && q.cooldown) || 0), pmax = (q && q.cooldownMax) || 0;
      const pdeg = it && pcd > 0 && pmax > 0 ? Math.round(clamp01(pcd / pmax) * 360) : 0;
      if (pdeg !== s._cd) { s.sweep.style.setProperty('--cd', pdeg + 'deg'); s._cd = pdeg; }
      const ptx = it && pcd > 0 ? (pcd >= 10 ? Math.ceil(pcd) : pcd.toFixed(1)) + '' : '';
      if (s.txt.textContent !== ptx) s.txt.textContent = ptx;
      s.el.style.opacity = it && it.count === 0 ? '.4' : '';
    }
  }

  _updateBadges(host, p) {
    const set = (menu, n) => {
      const b = this.menuBtns[menu] && this.menuBtns[menu].querySelector('.badge');
      if (!b) return;
      b.classList.toggle('on', n > 0); b.textContent = n > 9 ? '9+' : n;
    };
    set('character', p ? (p.ap | 0) : 0);
    set('skills', p ? (p.skillPoints | 0) : 0);
    const q = host.getQuests ? host.getQuests() : null;
    set('quests', q && q.ready ? q.ready.length : 0);
  }

  _updateBoss(host) {
    let b = this._bossManual ? this._boss : (host.getBoss && host.getBoss());
    if (!b && this.ctx) {
      const em = this.ctx.enemyManager || this.ctx.enemies;
      b = (em && typeof em.getActiveBoss === 'function' ? em.getActiveBoss() : null) || this.ctx.boss || (this.ctx.gameState && this.ctx.gameState.boss);
    }
    const on = !!(b && b.maxHp > 0 && b.hp > 0);
    this.elBoss.classList.toggle('on', on);
    if (!on) {
      if (this.elBossBadge) {
        this.elBossBadge.className = 'boss-badge';
        this.elBossBadge.textContent = '';
      }
      return;
    }
    const bn = this.elBossName.firstChild, bp = this.elBossName.lastChild;
    const name = (b.title && !b.isBoss ? b.name + ' \u2014 ' + b.title : b.name) || 'Boss';
    if (bn.textContent !== name) bn.textContent = name;
    const ph = b.maxPhases > 1 ? `Phase ${b.phase || 1}/${b.maxPhases}` : (b.phase ? `Phase ${b.phase}` : '');
    if (bp.textContent !== ph) bp.textContent = ph;
    this.barBoss.set(b.hp, b.maxHp, `${fmt(b.hp)} / ${fmt(b.maxHp)}`);

    // Milestone 5: Boss Fury & Aegis Barrier Badges
    if (this.elBossBadge) {
      if (b.aegisActive) {
        this.elBossBadge.textContent = '\u{1F6E1}\uFE0F AEGIS BARRIER (-80% DMG \u2014 Destroy Crystals!)';
        this.elBossBadge.className = 'boss-badge aegis on';
      } else if (b.isFurious) {
        this.elBossBadge.textContent = '\u{1F525} FURY MODE (+55% ATK)';
        this.elBossBadge.className = 'boss-badge fury on';
      } else if (typeof b.furyTimer === 'number' && b.furyTimer > 0) {
        this.elBossBadge.textContent = `\u23F1 Fury: ${Math.ceil(b.furyTimer)}s`;
        this.elBossBadge.className = 'boss-badge timer on';
      } else {
        this.elBossBadge.textContent = '';
        this.elBossBadge.className = 'boss-badge';
      }
    }
  }

  // --------------------------------------------------------------- minimap
  /** Manually push minimap data (otherwise pulled from host.getMinimap()). */
  updateMinimap(data) { this._mmManual = !!data; this._mmData = data || null; this._drawMinimap(); }

  _updateMinimap(host, dt) {
    this._mmTimer -= dt;
    if (this._mmTimer > 0) return;
    this._mmTimer = 0.09;
    if (!this._mmManual && host.getMinimap) this._mmData = host.getMinimap();
    this._drawMinimap();
  }

  _drawMinimap() {
    const d = this._mmData, c = this.cx, W = this.cv.width, H = this.cv.height;
    c.clearRect(0, 0, W, H);
    c.fillStyle = '#050409'; c.fillRect(0, 0, W, H);
    if (!d) return;
    const title = d.zone ? (d.floor ? `${d.zone} \u2014 B${d.floor}F` : d.zone) : '\u2014';
    const dObj = this.ctx?.dungeon || this.ctx?.world || null;
    const em = this.ctx?.enemyManager || this.ctx?.enemies || null;
    const heroLv = Number(this.ctx?.gameState?.hero?.level ?? this.ctx?.hero?.level ?? 0);
    let zoneLine = title;
    if ((d.floor || 0) === 0 && heroLv > 0) {
      zoneLine = heroLv < 10
        ? `${title} \u00B7 Dış Av Sahası (Zindan: Lv ${heroLv}/10)`
        : `${title} \u00B7 Zindan Kapısı Açık \u2713`;
    } else if ((d.floor || 0) > 0 && dObj && em?.getAliveFloorEnemies) {
      const aliveCount = em.getAliveFloorEnemies(dObj).length;
      zoneLine = aliveCount > 0
        ? `${title} \u00B7 Kalan Düşman: ${aliveCount}`
        : `${title} \u00B7 KAT TEMİZLENDİ \u2713`;
    }
    if (title !== this._last.zone) {
      this._last.zone = title; this.elMMTitle.textContent = title;
    }
    if (zoneLine !== this._last.zoneLine) {
      this._last.zoneLine = zoneLine; this.elZone.textContent = zoneLine;
    }
    const mw = d.w || 100, mh = d.h || 100;
    const px = d.player ? d.player.x : 0, py = d.player ? d.player.y : 0;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const r of d.rooms || []) {
      if (r.x < minX) minX = r.x;
      if (r.y < minY) minY = r.y;
      if (r.x + r.w > maxX) maxX = r.x + r.w;
      if (r.y + r.h > maxY) maxY = r.y + r.h;
    }
    const hasBounds = isFinite(minX) && isFinite(maxX);
    const span = Math.min(Math.max(mw, mh, hasBounds ? Math.max(maxX - minX, maxY - minY) + 8 : 48), 72);
    const scale = Math.min(W, H) / Math.max(20, span);
    const useWin = Math.max(mw, mh) > span;
    const cx = useWin ? px : (hasBounds ? (minX + maxX) * 0.5 : px);
    const cy = useWin ? py : (hasBounds ? (minY + maxY) * 0.5 : py);
    const vx = cx - W / scale / 2;
    const vy = cy - H / scale / 2;
    const X = (x) => (x - vx) * scale, Y = (y) => (y - vy) * scale;

    if (d.rooms) {
      for (const r of d.rooms) {
        if (r.explored === false) continue;
        const isBoss = r.boss || r.type === 'boss';
        const isCur = r.current || (px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h);
        c.fillStyle = isBoss ? '#3a1520' : isCur ? '#3d3560' : '#2a2540';
        c.strokeStyle = isBoss ? '#c0364a' : isCur ? '#c9b27a' : '#8a7440'; c.lineWidth = 1.5;
        c.fillRect(X(r.x), Y(r.y), r.w * scale, r.h * scale);
        c.strokeRect(X(r.x), Y(r.y), r.w * scale, r.h * scale);
      }
    }
    const colors = { enemy: '#ff4444', boss: '#ff2288', miniboss: '#f59e0b', chest: '#ffdd44', npc: '#55ff88', portal: '#cc66ff', stairs: '#cc66ff', loot: '#ffffff' };
    let nemesisDrawn = false;
    for (const e of d.entities || []) {
      const x = X(e.x), y = Y(e.y);
      if (x < -10 || y < -10 || x > W + 10 || y > H + 10) continue;
      if (e.isNemesis || e.type === 'nemesis') {
        nemesisDrawn = true;
        c.save();
        c.fillStyle = '#ef4444';
        c.strokeStyle = '#ffe4e6';
        c.lineWidth = 1.5;
        c.shadowColor = '#dc2626';
        c.shadowBlur = 8;
        c.beginPath();
        const s = 8;
        c.moveTo(x, y - s);
        c.lineTo(x + s, y);
        c.lineTo(x, y + s);
        c.lineTo(x - s, y);
        c.closePath();
        c.fill();
        c.stroke();
        c.fillStyle = '#ffffff';
        c.fillRect(x - 2, y - 2, 1.5, 1.5);
        c.fillRect(x + 1, y - 2, 1.5, 1.5);
        c.fillRect(x - 1, y + 1.5, 2.5, 1.5);
        c.restore();
        continue;
      }
      c.fillStyle = colors[e.type] || '#aaa';
      c.beginPath();
      if (e.type === 'chest') { c.rect(x - 3, y - 3, 6, 6); }
      else if (e.type === 'portal' || e.type === 'stairs') { c.moveTo(x, y - 6); c.lineTo(x + 5, y); c.lineTo(x, y + 6); c.lineTo(x - 5, y); c.closePath(); }
      else c.arc(x, y, e.type === 'boss' ? 6 : e.type === 'miniboss' ? 4.8 : 3.2, 0, 6.283);
      c.fill();
      if (e.type === 'npc') { c.strokeStyle = '#000'; c.lineWidth = 1; c.stroke(); }
    }
    if (!nemesisDrawn && this._activeNemesis) {
      const ne = this._activeNemesis;
      const nx = Number(ne.x ?? ne.position?.x ?? (ne.mesh && ne.mesh.position && ne.mesh.position.x) ?? 0);
      const ny = Number(ne.z ?? ne.y ?? ne.position?.z ?? ne.position?.y ?? (ne.mesh && ne.mesh.position && ne.mesh.position.z) ?? 0);
      const x = X(nx), y = Y(ny);
      if (x >= -10 && y >= -10 && x <= W + 10 && y <= H + 10) {
        c.save();
        c.fillStyle = '#ef4444';
        c.strokeStyle = '#ffe4e6';
        c.lineWidth = 1.5;
        c.shadowColor = '#dc2626';
        c.shadowBlur = 8;
        c.beginPath();
        const s = 8;
        c.moveTo(x, y - s);
        c.lineTo(x + s, y);
        c.lineTo(x, y + s);
        c.lineTo(x - s, y);
        c.closePath();
        c.fill();
        c.stroke();
        c.fillStyle = '#ffffff';
        c.fillRect(x - 2, y - 2, 1.5, 1.5);
        c.fillRect(x + 1, y - 2, 1.5, 1.5);
        c.fillRect(x - 1, y + 1.5, 2.5, 1.5);
        c.restore();
      }
    }
    if (d.player) {
      c.save(); c.translate(X(px), Y(py)); c.rotate(d.player.angle || 0);
      c.fillStyle = '#44eeff'; c.strokeStyle = '#003040'; c.lineWidth = 1.5;
      c.beginPath(); c.moveTo(0, -8); c.lineTo(6, 6); c.lineTo(0, 3); c.lineTo(-6, 6); c.closePath(); c.fill(); c.stroke();
      c.restore();
    }
  }

  // ------------------------------------------------------------ public API
  showBossBar(boss) { this._boss = boss; this._bossManual = true; this._updateBoss({}); }
  hideBossBar() { this._boss = null; this._bossManual = true; this.elBoss.classList.remove('on'); }
  /** Return control of the boss bar to host.getBoss(). */
  autoBossBar() { this._bossManual = false; }

  showBanner(title, subtitle) {
    this.elBanner.querySelector('.b-floor').textContent = subtitle || '';
    this.elBanner.querySelector('.b-name').textContent = title || '';
    this.elBanner.classList.remove('show'); void this.elBanner.offsetWidth; this.elBanner.classList.add('show');
    if (title) this.elZone.textContent = subtitle ? `${title} \u2014 ${subtitle}` : title;
  }
  showZone(name, floor) { this.showBanner(name, floor ? `Floor ${floor}` : 'ARKENVEIL: SIGILS & JOURNEYS'); }

  showToast(msg, type = 'info') {
    if (!msg) return;
    const now = performance.now(), k = type + msg;
    if (now - (this._recentToasts.get(k) || -1e9) < 350) return;
    this._recentToasts.set(k, now);
    const el = h('div', 'hud-toast ' + type); el.textContent = msg;
    this.elToasts.appendChild(el);
    while (this.elToasts.children.length > 6) this.elToasts.firstChild.remove();
    setTimeout(() => el.classList.add('out'), type === 'levelup' ? 4500 : 3200);
    setTimeout(() => el.remove(), type === 'levelup' ? 5000 : 3700);
  }
  toast(msg, type) { this.showToast(msg, type); }

  /** Big centred banner (alchemy +7 or higher), 2.5 s. */
  showAlchemyBanner(text) {
    if (!text) return;
    if (!this.elAlch) { this.elAlch = h('div', 'hud-alch-banner'); this.el.appendChild(this.elAlch); }
    this.elAlch.textContent = text;
    this.elAlch.classList.remove('show'); void this.elAlch.offsetWidth; this.elAlch.classList.add('show');
    clearTimeout(this._alchT); this._alchT = setTimeout(() => this.elAlch && this.elAlch.classList.remove('show'), 2500);
  }

  showInteractionPrompt(text, key = 'E') {
    this._promptManual = true;
    if (!text) { this.hideInteractionPrompt(); return; }
    const sig = key + text;
    if (this._promptSig !== sig) { this.elPrompt.innerHTML = `<kbd>${esc(key)}</kbd>${esc(text)}`; this._promptSig = sig; }
    this.elPrompt.classList.add('on');
  }
  hideInteractionPrompt() { this.elPrompt.classList.remove('on'); this._promptSig = null; }

  _updatePrompt(host) {
    if (this._promptManual || !host.getPrompt) return;
    const pr = host.getPrompt();
    if (!pr) { this.hideInteractionPrompt(); return; }
    const text = typeof pr === 'string' ? pr : (pr.prompt || pr.text || '');
    const key = (typeof pr === 'object' && pr.key) || 'E';
    if (!text) { this.hideInteractionPrompt(); return; }
    const sig = key + text;
    if (this._promptSig !== sig) { this.elPrompt.innerHTML = `<kbd>${esc(key)}</kbd>${esc(text)}`; this._promptSig = sig; }
    this.elPrompt.classList.add('on');
  }

  /** Floating combat text at screen coordinates (px). type: dmg|crit|heal|player|mana|exp|miss|gold */
  spawnDamageNumber(x, y, text, isCrit = false, type = 'dmg') {
    const host = document.getElementById('floating-combat-text') || this.el;
    if (host.childElementCount > 60) host.firstChild.remove();
    const el = h('div', 'fct-item hud-dmg ' + type + (isCrit ? ' fct-crit crit' : ''));
    el.textContent = text;
    el.style.left = x + 'px'; el.style.top = y + 'px';
    el.style.position = 'absolute';
    const colors = { dmg: '#fff', crit: '#ffcc22', heal: '#6bff8a', player: '#ff5050', mana: '#6fc2ff', exp: '#d79bff', miss: '#aaa', gold: '#ffd25a' };
    if (!isCrit) el.style.color = colors[type] || '#fff';
    host.appendChild(el);
    const drift = (Math.random() - 0.5) * 40;
    if (el.animate) {
      const a = el.animate([
        { transform: 'translate(-50%,-50%) scale(.6)', opacity: 0 },
        { transform: `translate(calc(-50% + ${drift * 0.3}px),-90%) scale(${isCrit ? 1.4 : 1.1})`, opacity: 1, offset: 0.15 },
        { transform: `translate(calc(-50% + ${drift}px),-${isCrit ? 220 : 170}%) scale(1)`, opacity: 0 },
      ], { duration: isCrit ? 1100 : 850, easing: 'ease-out' });
      a.onfinish = () => el.remove();
    } else setTimeout(() => el.remove(), 900);
  }

  damageFlash(strength = 1) {
    this.elFlash.classList.add('on');
    this.elFlash.style.opacity = String(Math.min(1, 0.4 + strength));
    clearTimeout(this._ft);
    this._ft = setTimeout(() => { this.elFlash.classList.remove('on'); this.elFlash.style.opacity = ''; }, 60);
  }
  levelUpFlash() {
    this.elHero.classList.remove('levelup'); void this.elHero.offsetWidth; this.elHero.classList.add('levelup');
  }
  setVisible(v) { this.el.classList.toggle('hidden', !v); }
  dispose() { this._unsub.forEach((f) => f && f()); this.el.remove(); }
}

export function createHUD(root, ctx) { return new HUD(root, ctx); }
export default HUD;

// ============================================================================
// Host adapter: normalises whatever the game systems expose into the shape the
// HUD / menus consume. Everything is defensive; missing systems give empty UI.
// ============================================================================
export function createHost(ctx = {}) {
  if (ctx && ctx.__host) return ctx;
  const getGame = () => {
    if (!ctx) return null;
    if (ctx.hero && typeof ctx.getStats === 'function') return ctx;
    return ctx.gameState || ctx.game || ctx.state || null;
  };
  const getInv = () => {
    const g = getGame();
    return (g && g.inventory) || (ctx && ctx.inventory) || null;
  };
  const getSkillsSys = () => {
    const g = getGame();
    return (g && g.skills) || (ctx && ctx.skills) || null;
  };
  const getQuestsSys = () => {
    const g = getGame();
    return (g && g.quests) || (ctx && ctx.quests) || null;
  };
  const getDungeon = () => (ctx && (ctx.dungeon || ctx.world || ctx.dungeonGenerator)) || null;
  const getEnemies = () => (ctx && (ctx.enemyManager || ctx.enemies || ctx.enemyAI)) || null;
  const getPlayerCtrl = () => (ctx && (ctx.player || ctx.playerController)) || null;
  const getPlayerPos = () => {
    const p = getPlayerCtrl();
    if (!p) return { x: 0, y: 0, z: 0, angle: 0 };
    const pos = p.position || p.pos || (p.mesh && p.mesh.position) || (p.heroMesh && p.heroMesh.position) || p;
    const angle = (typeof p.rotation === 'number' ? p.rotation : null) ?? p.rotationY ?? p.yaw ?? p.facingAngle ?? p.angle ?? (p.mesh && p.mesh.rotation ? p.mesh.rotation.y : 0) ?? 0;
    return { x: pos.x || 0, y: pos.y || 0, z: pos.z ?? pos.y ?? 0, angle };
  };
  const wrapRes = (r, okMsg = 'OK') => {
    if (r && typeof r === 'object' && ('ok' in r || 'msg' in r)) return r;
    if (typeof r === 'boolean') return { ok: r, msg: r ? okMsg : 'Action failed.' };
    return { ok: r !== false && r !== null, msg: okMsg, value: r };
  };
  const normItem = (it) => {
    if (!it || typeof it !== 'object') return null;
    const slot = it.slot === 'offhand' ? 'shield' : it.slot;
    return {
      ...it,
      uid: it.uid ?? it.id ?? it.instanceId,
      slot,
      rawSlot: it.slot,
      rarity: String(it.rarity || 'normal').toLowerCase(),
      stats: it.stats || it.mods || {},
      affixes: Array.isArray(it.affixes)
        ? it.affixes.map((a) => (typeof a === 'string' ? a : a.label || a.text || a.name || '')).filter(Boolean)
        : [],
      value: it.value ?? it.sellPrice ?? (it.price ? Math.max(1, Math.floor(it.price * 0.4)) : 1),
      price: it.price ?? it.buyPrice ?? (it.value ? it.value * 2 : 10),
    };
  };

  const host = {
    __host: true,
    ctx,
    getPlayer() {
      if (typeof ctx.getPlayer === 'function') {
        const snap = ctx.getPlayer();
        if (snap) return snap;
      }
      const g = getGame();
      if (!g) return null;
      const snap = typeof g.getPlayerSnapshot === 'function' ? g.getPlayerSnapshot() : null;
      const s = typeof g.getStats === 'function' ? g.getStats() : (g.derived || {});
      const h = g.hero || g;
      const base = (snap && snap.baseStats) || (h.attrs ? { ...h.attrs } : { str: h.str || 5, dex: h.dex || 5, int: h.int || 5, lck: h.lck || 5 });
      const stats = (snap && snap.stats) || { str: s.str ?? g.str ?? base.str, dex: s.dex ?? g.dex ?? base.dex, int: s.int ?? g.int ?? base.int, lck: s.lck ?? g.lck ?? base.lck };
      const bonus = {
        str: Math.max(0, (stats.str || 0) - (base.str || 0)),
        dex: Math.max(0, (stats.dex || 0) - (base.dex || 0)),
        int: Math.max(0, (stats.int || 0) - (base.int || 0)),
        lck: Math.max(0, (stats.lck || 0) - (base.lck || 0)),
      };
      const pc = getPlayerCtrl();
      const ctrlCombo = pc && (pc.comboCount || pc.combo) ? (pc.comboCount || pc.combo) : 0;
      if (snap) {
        return {
          ...snap,
          berserkCharge: snap.berserkCharge ?? h.berserkCharge ?? g.berserkCharge ?? 0,
          berserkActive: Boolean(snap.berserkActive ?? h.berserkActive ?? g.berserkActive),
          berserkRemaining: snap.berserkRemaining ?? h.berserkRemaining ?? g.berserkRemaining ?? 0,
          restedExp: snap.restedExp ?? h.restedExp ?? g.restedExp ?? 0,
          isSoaking: Boolean(snap.isSoaking ?? h.isSoaking ?? g.isSoaking),
          bonus,
          combo: Math.max(snap.combo || 0, ctrlCombo),
        };
      }
      return {
        name: h.name || 'Hero',
        classId: h.classId, className: h.className, classIcon: h.classIcon, classColor: h.classColor,
        attackStyle: h.attackStyle, appearance: h.appearance,
        level: h.level || 1,
        hp: Math.ceil(h.hp ?? s.maxHp ?? 100),
        maxHp: s.maxHp ?? h.maxHp ?? 100,
        sp: Math.floor(h.mp ?? h.sp ?? s.maxMp ?? 50),
        maxSp: s.maxMp ?? h.maxMp ?? h.maxSp ?? 50,
        stamina: Math.floor(h.stamina ?? s.maxStamina ?? 100),
        maxStamina: s.maxStamina ?? h.maxStamina ?? 100,
        berserkCharge: h.berserkCharge ?? g.berserkCharge ?? 0,
        berserkActive: Boolean(h.berserkActive ?? g.berserkActive),
        berserkRemaining: h.berserkRemaining ?? g.berserkRemaining ?? 0,
        restedExp: h.restedExp ?? g.restedExp ?? 0,
        isSoaking: Boolean(h.isSoaking ?? g.isSoaking),
        combo: Math.max(h.combo || 0, ctrlCombo),
        exp: h.exp || 0,
        expToNext: g.expToNext || 100,
        gold: h.gold || 0,
        ap: h.ap || 0,
        skillPoints: h.sp ?? g.skillPoints ?? 0,
        stats,
        baseStats: base,
        bonus,
        derived: s,
        buffs: (h.buffs || []).map((b) => ({
          id: b.id, name: b.name, icon: b.icon, remaining: Math.max(0, b.remaining ?? 0), duration: b.duration ?? 10, debuff: !!b.debuff,
        })),
      };
    },

    getSkillBar() {
      if (typeof ctx.getSkillBar === 'function') return ctx.getSkillBar();
      const sk = getSkillsSys();
      if (!sk) return DEFAULT_ALL_HOTBAR_KEYS.map(() => null);
      if (typeof sk.getSkillBar === 'function') {
        return (sk.getSkillBar() || []).map((s, i) => (s ? {
          ...s,
          skillId: s.skillId || s.id,
          cooldown: s.cooldown ?? s.remaining ?? 0,
          cooldownMax: s.cooldownMax ?? s.total ?? s.cd ?? 0,
          spCost: s.spCost ?? s.mpCost ?? s.cost ?? 0,
          key: s.key || DEFAULT_ALL_HOTBAR_KEYS[i],
        } : null));
      }
      const bar = sk.hotbar || sk.equippedSkills || [];
      return DEFAULT_ALL_HOTBAR_KEYS.map((k, i) => {
        const id = bar[i];
        if (!id) return null;
        const def = typeof id === 'object' ? id : (sk.get ? sk.get(id) : null);
        if (!def) return null;
        const cd = sk.getCooldown ? sk.getCooldown(def.id) : { remaining: 0, total: def.cooldown || 0 };
        return {
          skillId: def.id,
          name: def.name,
          icon: def.icon || '✨',
          level: sk.getLevel ? sk.getLevel(def.id) : (def.level || 1),
          cooldown: cd.remaining || 0,
          cooldownMax: cd.total || def.cooldown || 0,
          spCost: def.mpCost ?? def.spCost ?? 0,
          key: k,
        };
      });
    },

    getPotionSlots() {
      if (typeof ctx.getPotionSlots === 'function') return ctx.getPotionSlots();
      const inv = getInv();
      if (!inv) return DEFAULT_POTION_KEYS.map((key) => ({ key, item: null }));
      if (typeof inv.getQuickSlotView === 'function') {
        return inv.getQuickSlotView().map((q, i) => ({
          key: (q && q.key) || DEFAULT_POTION_KEYS[i],
          cooldown: (q && q.cooldown) || 0,
          cooldownMax: (q && q.cooldownMax) || 0,
          item: q && q.item ? normItem(q.item) : (q && q.name ? normItem(q) : null),
        }));
      }
      const qs = inv.quickSlots || [];
      return DEFAULT_POTION_KEYS.map((key, i) => ({ key, item: qs[i] ? normItem(qs[i]) : null }));
    },

    getInventory() {
      if (typeof ctx.getInventory === 'function') {
        const v = ctx.getInventory();
        if (v) {
          const eq = {};
          for (const [k, it] of Object.entries(v.equipment || v.equipped || {})) {
            const nk = k === 'offhand' ? 'shield' : k;
            eq[nk] = normItem(it);
          }
          return {
            gold: v.gold ?? (getGame() ? getGame().gold : 0),
            bag: (v.bag || []).map(normItem).filter(Boolean),
            equipment: eq,
            bagSize: v.bagSize || v.maxSlots || 40,
          };
        }
      }
      const inv = getInv();
      const g = getGame();
      if (!inv) return { gold: g ? g.gold : 0, bag: [], equipment: {}, bagSize: 40 };
      const raw = typeof inv.getView === 'function' ? inv.getView() : {
        gold: g ? g.gold : 0,
        bag: inv.bag || [],
        equipment: inv.equipment || inv.equipped || {},
        bagSize: inv.maxBag || inv.bagSize || 40,
      };
      const eq = {};
      for (const [k, it] of Object.entries(raw.equipment || raw.equipped || {})) {
        const nk = k === 'offhand' ? 'shield' : k;
        eq[nk] = normItem(it);
      }
      return {
        gold: raw.gold ?? (g ? g.gold : 0),
        bag: (raw.bag || []).map(normItem).filter(Boolean),
        equipment: eq,
        bagSize: raw.bagSize || raw.maxBag || 40,
      };
    },

    getSkills() {
      if (typeof ctx.getSkills === 'function') return ctx.getSkills();
      const sk = getSkillsSys();
      if (!sk) return [];
      const list = typeof sk.getTreeView === 'function' ? sk.getTreeView() : (typeof sk.list === 'function' ? sk.list() : (sk.skills || []));
      return list.map((s) => {
        const check = sk.canLearn ? sk.canLearn(s.id) : { ok: !!s.canLevel, reason: s.reason || '' };
        return {
          ...s,
          level: s.level ?? (sk.getLevel ? sk.getLevel(s.id) : 0),
          maxLevel: s.maxLevel || 10,
          spCost: s.spCost ?? s.mpCost ?? 0,
          canLevel: s.canLevel !== undefined ? s.canLevel : !!check.ok,
          reason: s.reason ?? check.reason ?? '',
          requires: s.requires || (s.prereq ? [s.prereq] : []),
        };
      });
    },

    getQuests() {
      if (typeof ctx.getQuests === 'function') return ctx.getQuests();
      const q = getQuestsSys();
      if (!q) return { available: [], active: [], ready: [], completed: [] };
      if (typeof q.getLogView === 'function') return q.getLogView();
      return { available: [], active: q.getActive ? q.getActive() : [], ready: [], completed: [] };
    },

    getShop(npcId) {
      if (typeof ctx.getShop === 'function') {
        const s = ctx.getShop(npcId);
        if (s) return { ...s, items: (s.items || []).map(normItem).filter(Boolean) };
      }
      const inv = getInv();
      if (!inv) return { name: 'Merchant', items: [] };
      const s = typeof inv.getShop === 'function' ? inv.getShop(npcId) : (typeof inv.getShopInventory === 'function' ? inv.getShopInventory(npcId) : null);
      if (!s) return { name: 'Merchant', items: [] };
      const items = Array.isArray(s) ? s : (s.items || []);
      return { name: s.name || 'Shop', items: items.map(normItem).filter(Boolean) };
    },

    getStorage() {
      if (typeof ctx.getStorage === 'function') return ctx.getStorage();
      const inv = getInv();
      if (inv && typeof inv.getStorageView === 'function') {
        const st = inv.getStorageView();
        return { ...st, items: (st.items || st.storage || []).map(normItem).filter(Boolean) };
      }
      return { items: [], capacity: 40 };
    },

    getFloors() {
      const g = getGame();
      const d = getDungeon();
      const unlockedMax = g ? (g.unlockedMaxFloor || Math.max(1, (g.progress && g.progress.maxFloor) || 1)) : 1;
      const curFloor = (d && d.currentFloor != null) ? d.currentFloor : (g && g.progress ? g.progress.currentFloor : 0);
      let list = [];
      if (d && typeof d.getFloors === 'function') {
        list = d.getFloors(unlockedMax) || [];
      } else if (typeof ctx.getFloors === 'function') {
        list = ctx.getFloors() || [];
      } else {
        for (let f = 1; f <= Math.max(unlockedMax + 2, 10); f++) {
          list.push({ floor: f, name: `Dungeon B${f}F`, unlocked: f <= unlockedMax, recommendedLevel: Math.max(1, f * 2 - 1) });
        }
      }
      const clearedSet = new Set((g && g.progress && Array.isArray(g.progress.floorsCleared)) ? g.progress.floorsCleared : []);
      const hasVillage = list.some((f) => f.floor === 0);
      const out = hasVillage ? list : [{ floor: 0, name: 'Oakhaven Village', unlocked: true, recommendedLevel: 1, minDungeonLevel: 1 }, ...list];
      return out.map((f) => ({
        ...f,
        cleared: f.floor === 0 ? false : (Boolean(f.cleared) || clearedSet.has(f.floor)),
        minDungeonLevel: f.minDungeonLevel || (f.floor === 0 ? 1 : 10),
        current: f.floor === curFloor
      }));
    },

    getMinimap() {
      if (typeof ctx.getMinimap === 'function') {
        const m = ctx.getMinimap();
        if (m) return m;
      }
      const d = getDungeon();
      if (!d) return null;
      const pPos = getPlayerPos();
      const em = getEnemies();
      const enemyList = em ? (typeof em.getAliveEnemies === 'function' ? em.getAliveEnemies() : (em.enemies || [])) : [];
      if (typeof d.getMinimapData === 'function') {
        const mm = d.getMinimapData({ x: pPos.x, y: pPos.y, z: pPos.z }, pPos.angle, enemyList);
        if (mm && Array.isArray(mm.entities)) {
          for (const e of enemyList) {
            if (e && (e.isNemesis || (e.nemesisRank && e.nemesisRank > 0)) && (e.hp == null || e.hp > 0) && !e.isDead && e.state !== 'DEAD' && e.state !== 'dead') {
              const ex = Number(e.x ?? e.position?.x ?? (e.mesh && e.mesh.position && e.mesh.position.x) ?? 0);
              const ey = Number(e.z ?? e.y ?? e.position?.z ?? e.position?.y ?? (e.mesh && e.mesh.position && e.mesh.position.z) ?? 0);
              const found = mm.entities.find((ent) => (ent.type === 'enemy' || ent.type === 'boss') && Math.hypot(ent.x - ex, ent.y - ey) < 1.5);
              if (found) {
                found.isNemesis = true;
                found.type = 'nemesis';
                found.name = e.name;
              } else {
                mm.entities.push({ type: 'nemesis', isNemesis: true, x: ex, y: ey, name: e.name });
              }
            }
          }
        }
        return mm;
      }
      return null;
    },

    getBoss() {
      if (typeof ctx.getBoss === 'function') {
        const b = ctx.getBoss();
        if (b) return b;
      }
      const em = getEnemies();
      if (em && typeof em.getActiveBoss === 'function') return em.getActiveBoss();
      return null;
    },

    getPrompt() {
      if (typeof ctx.getPrompt === 'function') {
        const pr = ctx.getPrompt();
        if (pr) return pr;
      }
      const d = getDungeon();
      if (d && typeof d.getNearestInteractable === 'function' && getPlayerCtrl()) {
        const pPos = getPlayerPos();
        // same reach as the E/F interact handler in main.js
        const hit = d.getNearestInteractable(pPos.x, pPos.z, 3.0);
        return hit ? (hit.prompt || hit.label || null) : null;
      }
      return null;
    },

    getDialogue(npcId) {
      if (typeof ctx.getNpcDialogue === 'function') return ctx.getNpcDialogue(npcId);
      if (typeof ctx.getDialogue === 'function') return ctx.getDialogue(npcId);
      const q = getQuestsSys();
      if (q && typeof q.getNpcDialogue === 'function') return q.getNpcDialogue(npcId);
      return { name: String(npcId || 'Villager'), lines: ['Greetings, adventurer.'], options: [{ label: 'Leave', action: 'close' }] };
    },
    getNpcDialogue(npcId) { return this.getDialogue(npcId); },

    previewCompose(uids) {
      if (typeof ctx.getComposePreview === 'function') return ctx.getComposePreview(uids);
      if (typeof ctx.previewCompose === 'function') return ctx.previewCompose(uids);
      const inv = getInv();
      if (inv && typeof inv.previewCompose === 'function') return inv.previewCompose(uids);
      return { ok: uids && uids.length >= 2, text: 'Combine selected items.' };
    },
    getComposePreview(uids) { return this.previewCompose(uids); },

    previewUpgrade(uid, crystalUid) {
      const mats = Array.isArray(crystalUid) ? crystalUid : [crystalUid];
      if (typeof ctx.getUpgradePreview === 'function') return ctx.getUpgradePreview(uid, mats);
      if (typeof ctx.previewUpgrade === 'function') return ctx.previewUpgrade(uid, mats);
      const inv = getInv();
      if (inv && typeof inv.previewUpgrade === 'function') return inv.previewUpgrade(uid, mats);
      return { ok: !!(uid && crystalUid), text: 'Upgrade equipment with crystal.' };
    },
    getUpgradePreview(uid, mats) { return this.previewUpgrade(uid, mats); },

    // Actions
    spendAP(stat, n = 1) {
      if (typeof ctx.spendAP === 'function') return wrapRes(ctx.spendAP(stat, n));
      const g = getGame();
      if (g && typeof g.allocate === 'function') return wrapRes(g.allocate(stat, n));
      return { ok: false, msg: 'Unavailable' };
    },
    equip(uid, targetSlot = null) {
      let r;
      if (typeof ctx.equip === 'function') r = wrapRes(ctx.equip(uid, targetSlot), 'Equipped');
      else {
        const inv = getInv();
        r = inv && inv.equip ? wrapRes(inv.equip(uid, targetSlot), 'Equipped') : { ok: false, msg: 'Unavailable' };
      }
      const pc = getPlayerCtrl();
      if (pc && typeof pc.syncEquipment === 'function') pc.syncEquipment();
      return r;
    },
    equipToSlot(uid, targetSlot) {
      return this.equip(uid, targetSlot);
    },
    unequip(slot) {
      const inv = getInv();
      const actualSlot = (slot === 'shield' && inv && inv.equipment && !inv.equipment.shield && inv.equipment.offhand) ? 'offhand' : slot;
      let r;
      if (typeof ctx.unequip === 'function') r = wrapRes(ctx.unequip(actualSlot), 'Unequipped');
      else r = inv && inv.unequip ? wrapRes(inv.unequip(actualSlot), 'Unequipped') : { ok: false, msg: 'Unavailable' };
      const pc = getPlayerCtrl();
      if (pc && typeof pc.syncEquipment === 'function') pc.syncEquipment();
      return r;
    },
    dropItem(uid) {
      const inv = getInv();
      const d = getDungeon();
      let res = null;
      if (typeof ctx.dropItem === 'function') res = ctx.dropItem(uid);
      else if (inv && typeof inv.drop === 'function') res = inv.drop(uid);
      else if (inv && typeof inv.removeItem === 'function') res = inv.removeItem(uid);
      // If no global listener already spawned ground loot from 'item:dropped', ensure it spawns in 3D world with toss and cooldown
      if (res && res.item && d && typeof d.spawnGroundLoot === 'function' && !res._spawned) {
        const pPos = getPlayerPos();
        const tossX = pPos.x + Math.sin(pPos.angle || 0) * 1.2 + (Math.random() - 0.5) * 0.4;
        const tossZ = pPos.z + Math.cos(pPos.angle || 0) * 1.2 + (Math.random() - 0.5) * 0.4;
        try {
          d.spawnGroundLoot({ x: tossX, z: tossZ }, res.item, null, { x: pPos.x, z: pPos.z }, { pickupCooldown: 1800 });
        } catch (e) { /* ignore */ }
      }
      return wrapRes(res, 'Dropped item');
    },
    quickSellJunk() {
      const inv = getInv();
      if (inv && typeof inv.quickSellTrash === 'function') {
        return wrapRes(inv.quickSellTrash(), 'Sold junk items');
      }
      return { ok: false, msg: 'Quick sell unavailable' };
    },
    sellItem(uid, qty) {
      if (typeof ctx.sellItem === 'function') return wrapRes(ctx.sellItem(uid, qty), 'Sold');
      const inv = getInv();
      return inv && inv.sell ? wrapRes(inv.sell(uid, qty), 'Sold') : { ok: false, msg: 'Unavailable' };
    },
    buyItem(npcId, idx, qty) {
      if (typeof ctx.buyItem === 'function') return wrapRes(ctx.buyItem(npcId, idx, qty), 'Purchased');
      const inv = getInv();
      return inv && inv.buy ? wrapRes(inv.buy(npcId, idx, qty), 'Purchased') : { ok: false, msg: 'Unavailable' };
    },
    useItem(uid) {
      if (typeof ctx.useItem === 'function') return wrapRes(ctx.useItem(uid), 'Used');
      const inv = getInv();
      return inv && inv.useItem ? wrapRes(inv.useItem(uid), 'Used') : { ok: false, msg: 'Unavailable' };
    },
    usePotion(slotIdx) {
      const pc = getPlayerCtrl();
      if (pc && typeof pc.useQuickPotion === 'function') {
        const ok = pc.useQuickPotion(slotIdx);
        return { ok, msg: ok ? 'Used item' : 'No item available' };
      }
      if (typeof ctx.usePotion === 'function') return wrapRes(ctx.usePotion(slotIdx));
      const inv = getInv();
      return inv && inv.useQuickSlot ? wrapRes(inv.useQuickSlot(slotIdx)) : { ok: false, msg: 'Empty slot' };
    },
    assignPotion(slotIdx, uidOrBaseId) {
      if (typeof ctx.assignPotion === 'function') return wrapRes(ctx.assignPotion(slotIdx, uidOrBaseId), 'Slot updated');
      const inv = getInv();
      return inv && inv.assignQuickSlot ? wrapRes(inv.assignQuickSlot(slotIdx, uidOrBaseId), 'Slot updated') : { ok: false, msg: 'Unavailable' };
    },
    sortBag() {
      if (typeof ctx.sortBag === 'function') return wrapRes(ctx.sortBag(), 'Bag sorted');
      const inv = getInv();
      return inv && inv.sortBag ? wrapRes(inv.sortBag(), 'Bag sorted') : { ok: false, msg: 'Unavailable' };
    },
    deposit(uid) {
      if (typeof ctx.deposit === 'function') return wrapRes(ctx.deposit(uid), 'Deposited');
      const inv = getInv();
      return inv && inv.deposit ? wrapRes(inv.deposit(uid), 'Deposited') : { ok: false, msg: 'Unavailable' };
    },
    withdraw(uid) {
      if (typeof ctx.withdraw === 'function') return wrapRes(ctx.withdraw(uid), 'Withdrawn');
      const inv = getInv();
      return inv && inv.withdraw ? wrapRes(inv.withdraw(uid), 'Withdrawn') : { ok: false, msg: 'Unavailable' };
    },
    depositGold(amount) {
      if (typeof ctx.depositGold === 'function') return wrapRes(ctx.depositGold(amount), 'Gold deposited');
      const inv = getInv();
      return inv && inv.depositGold ? wrapRes(inv.depositGold(amount), 'Gold deposited') : { ok: false, msg: 'Unavailable' };
    },
    withdrawGold(amount) {
      if (typeof ctx.withdrawGold === 'function') return wrapRes(ctx.withdrawGold(amount), 'Gold withdrawn');
      const inv = getInv();
      return inv && inv.withdrawGold ? wrapRes(inv.withdrawGold(amount), 'Gold withdrawn') : { ok: false, msg: 'Unavailable' };
    },
    depositMaterials(filter = 'material') {
      if (typeof ctx.depositMaterials === 'function') return wrapRes(ctx.depositMaterials(filter), 'Materials stored');
      const inv = getInv();
      return inv && inv.depositAllByFilter ? wrapRes(inv.depositAllByFilter(filter), 'Materials stored') : { ok: false, msg: 'Unavailable' };
    },
    compose(uids) {
      if (typeof ctx.compose === 'function') return wrapRes(ctx.compose(uids), 'Composed!');
      const inv = getInv();
      return inv && inv.compose ? wrapRes(inv.compose(uids), 'Composed!') : { ok: false, msg: 'Unavailable' };
    },
    upgradeItem(uid, crystalUids) {
      const mats = Array.isArray(crystalUids) ? crystalUids : [crystalUids];
      if (typeof ctx.upgradeItem === 'function') return wrapRes(ctx.upgradeItem(uid, mats), 'Upgraded!');
      const inv = getInv();
      return inv && inv.upgrade ? wrapRes(inv.upgrade(uid, mats), 'Upgraded!') : { ok: false, msg: 'Unavailable' };
    },
    previewAlchemy(uid, opts = {}) {
      if (typeof ctx.previewAlchemy === 'function') return ctx.previewAlchemy(uid, opts);
      const inv = getInv();
      if (inv && typeof inv.previewAlchemy === 'function') return inv.previewAlchemy(uid, opts);
      const pv = this.previewUpgrade(uid, []);
      return { ...pv, legacy: true, ok: pv && pv.ok !== false && !!(pv && (pv.chance != null || pv.text)) };
    },
    alchemy(uid, opts = {}) {
      if (typeof ctx.alchemy === 'function') return wrapRes(ctx.alchemy(uid, opts), 'Enhanced!');
      const inv = getInv();
      if (inv && typeof inv.alchemy === 'function') return wrapRes(inv.alchemy(uid, opts), 'Enhanced!');
      return this.upgradeItem(uid, []);
    },
    getPets() {
      if (typeof ctx.getPets === 'function') return ctx.getPets();
      const g = getGame();
      const ps = (g && g.pets) || (ctx && ctx.pets) || null;
      if (!ps) return { sys: null, pets: [], activePet: null };
      const pets = Array.isArray(ps.pets) ? ps.pets : [];
      const activePet = typeof ps.getActivePet === 'function'
        ? ps.getActivePet()
        : pets.find((p) => p && p.active && p.summoned) || null;
      return { sys: ps, pets, activePet };
    },
    buyPet(type, customName) {
      if (typeof ctx.buyPet === 'function') return wrapRes(ctx.buyPet(type, customName), 'Pet purchased!');
      const ps = this.getPets().sys;
      if (!ps || typeof ps.buyPet !== 'function') return { ok: false, msg: 'Pet Merchant unavailable.' };
      return wrapRes(ps.buyPet(type, customName), 'Pet purchased!');
    },
    fuseMagicStone(uid, stoneId) {
      if (typeof ctx.fuseMagicStone === 'function') return wrapRes(ctx.fuseMagicStone(uid, stoneId), 'Stone fused!');
      const inv = getInv();
      if (inv && typeof inv.fuseMagicStone === 'function') return wrapRes(inv.fuseMagicStone(uid, stoneId), 'Stone fused!');
      return { ok: false, msg: 'Magic stone fusion unavailable.' };
    },
    getTownHallView() {
      if (typeof ctx.getTownHallView === 'function') return ctx.getTownHallView();
      const g = getGame();
      return g && typeof g.getTownHallView === 'function' ? g.getTownHallView() : null;
    },
    trainTownMastery(key) {
      if (typeof ctx.trainTownMastery === 'function') return wrapRes(ctx.trainTownMastery(key), 'Mastery trained!');
      const g = getGame();
      return g && typeof g.trainTownMastery === 'function' ? wrapRes(g.trainTownMastery(key), 'Mastery trained!') : { ok: false, msg: 'Town training unavailable.' };
    },
    buyTownBlessing(key) {
      if (typeof ctx.buyTownBlessing === 'function') return wrapRes(ctx.buyTownBlessing(key), 'Blessing active!');
      const g = getGame();
      return g && typeof g.buyTownBlessing === 'function' ? wrapRes(g.buyTownBlessing(key), 'Blessing active!') : { ok: false, msg: 'Town shrine unavailable.' };
    },
    expandBag() {
      if (typeof ctx.expandBag === 'function') return wrapRes(ctx.expandBag(), 'Bag expanded!');
      const inv = getInv();
      return inv && typeof inv.expandBag === 'function' ? wrapRes(inv.expandBag(), 'Bag expanded!') : { ok: false, msg: 'Bag expansion unavailable.' };
    },
    expandStorage() {
      if (typeof ctx.expandStorage === 'function') return wrapRes(ctx.expandStorage(), 'Storage expanded!');
      const inv = getInv();
      return inv && typeof inv.expandStorage === 'function' ? wrapRes(inv.expandStorage(), 'Storage expanded!') : { ok: false, msg: 'Storage expansion unavailable.' };
    },
    getSocketForgeCost(uid) {
      if (typeof ctx.getSocketForgeCost === 'function') return ctx.getSocketForgeCost(uid);
      const inv = getInv();
      return inv && typeof inv.getSocketForgeCost === 'function' ? inv.getSocketForgeCost(uid) : 0;
    },
    forgeAddSocket(uid) {
      if (typeof ctx.forgeAddSocket === 'function') return wrapRes(ctx.forgeAddSocket(uid), 'Socket added!');
      const inv = getInv();
      return inv && typeof inv.forgeAddSocket === 'function' ? wrapRes(inv.forgeAddSocket(uid), 'Socket added!') : { ok: false, msg: 'Masterwork forge unavailable.' };
    },
    getReforgeCost(uid) {
      if (typeof ctx.getReforgeCost === 'function') return ctx.getReforgeCost(uid);
      const inv = getInv();
      return inv && typeof inv.getReforgeCost === 'function' ? inv.getReforgeCost(uid) : 0;
    },
    forgeReforgeAffixes(uid) {
      if (typeof ctx.forgeReforgeAffixes === 'function') return wrapRes(ctx.forgeReforgeAffixes(uid), 'Reforged!');
      const inv = getInv();
      return inv && typeof inv.forgeReforgeAffixes === 'function' ? wrapRes(inv.forgeReforgeAffixes(uid), 'Reforged!') : { ok: false, msg: 'Masterwork forge unavailable.' };
    },
    trainActivePet(cost, expGain) {
      if (typeof ctx.trainActivePet === 'function') return wrapRes(ctx.trainActivePet(cost, expGain), 'Pet trained!');
      const ps = this.getPets().sys;
      return ps && typeof ps.trainActivePetWithGold === 'function' ? wrapRes(ps.trainActivePetWithGold(cost, expGain), 'Pet trained!') : { ok: false, msg: 'Pet training unavailable.' };
    },
    levelSkill(id) {
      if (typeof ctx.levelSkill === 'function') return wrapRes(ctx.levelSkill(id), 'Skill learned');
      const sk = getSkillsSys();
      return sk && sk.learn ? wrapRes(sk.learn(id), 'Skill learned') : { ok: false, msg: 'Unavailable' };
    },
    assignSkill(id, slotIdx) {
      if (typeof ctx.assignSkill === 'function') return wrapRes(ctx.assignSkill(id, slotIdx), 'Assigned');
      const sk = getSkillsSys();
      return sk && sk.assign ? wrapRes(sk.assign(slotIdx, id), 'Assigned') : { ok: false, msg: 'Unavailable' };
    },
    castSkillSlot(slotIdx) {
      const pc = getPlayerCtrl();
      if (pc && typeof pc.triggerSkillSlot === 'function') return pc.triggerSkillSlot(slotIdx);
      if (pc && typeof pc.useSkillSlot === 'function') return pc.useSkillSlot(slotIdx);
      if (typeof ctx.castSkillSlot === 'function') return ctx.castSkillSlot(slotIdx);
      const sk = getSkillsSys();
      return sk && sk.castSlot ? sk.castSlot(slotIdx) : null;
    },
    acceptQuest(id) {
      if (typeof ctx.acceptQuest === 'function') return wrapRes(ctx.acceptQuest(id), 'Quest accepted');
      const q = getQuestsSys();
      return q && q.accept ? wrapRes(q.accept(id), 'Quest accepted') : { ok: false, msg: 'Unavailable' };
    },
    turnInQuest(id) {
      if (typeof ctx.turnInQuest === 'function') return wrapRes(ctx.turnInQuest(id), 'Quest completed!');
      const q = getQuestsSys();
      return q && q.turnIn ? wrapRes(q.turnIn(id), 'Quest completed!') : { ok: false, msg: 'Unavailable' };
    },
    abandonQuest(id) {
      if (typeof ctx.abandonQuest === 'function') return wrapRes(ctx.abandonQuest(id), 'Quest abandoned');
      const q = getQuestsSys();
      return q && q.abandon ? wrapRes(q.abandon(id), 'Quest abandoned') : { ok: false, msg: 'Unavailable' };
    },
    npcAction(npcId, action, option) {
      if (typeof ctx.dialogueAction === 'function') return ctx.dialogueAction(action, npcId, option);
      const q = getQuestsSys();
      if (q && typeof q.handleDialogueAction === 'function') return q.handleDialogueAction(action, npcId);
      const g = getGame();
      if (/heal|rest/i.test(action) && g && g.fullRestore) { g.fullRestore(); return { ok: true, msg: 'Fully restored!' }; }
      if (/reset.*attr|respec/i.test(action) && g && g.resetAttributes) { g.resetAttributes(); return { ok: true, msg: 'Attributes reset!' }; }
      return { ok: true };
    },
    getStoryChronicles() {
      if (typeof ctx.getStoryChronicles === 'function') return ctx.getStoryChronicles();
      const g = getGame();
      return g && typeof g.getStoryChronicles === 'function' ? g.getStoryChronicles() : [];
    },
    teleportToFloor(floorNum) {
      const f = Number(floorNum) || 0;
      if (f === 0 && typeof ctx.returnToVillage === 'function') {
        ctx.returnToVillage();
        return { ok: true, msg: 'Returned to Village' };
      }
      const g = getGame();
      const heroLv = Number(g?.hero?.level ?? ctx?.hero?.level ?? 0);
      if (f > 0 && heroLv > 0 && heroLv < 10) {
        return { ok: false, msg: `Zindanlara giriş için Seviye 10 gerekir! (Mevcut: Lv ${heroLv}/10)` };
      }
      if (typeof ctx.enterFloor === 'function') {
        const entered = ctx.enterFloor(f);
        if (entered === false) {
          return { ok: false, msg: `Zindana giriş engellendi (Gereken: Lv 10)` };
        }
        return { ok: true, msg: f === 0 ? 'Returned to Village' : `Entered Floor ${f}` };
      }
      if (typeof ctx.teleportToFloor === 'function') return wrapRes(ctx.teleportToFloor(f));
      return { ok: false, msg: 'Teleport unavailable' };
    },
    save() {
      if (typeof ctx.save === 'function') return wrapRes(ctx.save(), 'Game saved');
      const g = getGame();
      return g && g.save ? wrapRes(g.save(0), 'Game saved') : { ok: false, msg: 'Save unavailable' };
    },
    on(evt, fn) {
      if (typeof ctx.on === 'function') return ctx.on(evt, fn);
      const g = getGame();
      return g && typeof g.on === 'function' ? g.on(evt, fn) : () => {};
    },
  };
  return host;
}


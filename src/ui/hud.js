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

export const MENU_BUTTONS = [
  { menu: 'character', key: 'C', icon: '\u{1F9D9}', label: 'Hero' },
  { menu: 'inventory', key: 'B', icon: '\u{1F392}', label: 'Bag' },
  { menu: 'skills', key: 'K', icon: '\u2728', label: 'Skills' },
  { menu: 'compose', key: 'O', icon: '\u2697\uFE0F', label: 'Compose' },
  { menu: 'quests', key: 'Q', icon: '\u{1F4DC}', label: 'Quests' },
  { menu: 'map', key: 'M', icon: '\u{1F5FA}\uFE0F', label: 'Floors' },
  { menu: '__save', key: 'F5', icon: '\u{1F4BE}', label: 'Save' },
];

const DEFAULT_SKILL_KEYS = ['1', '2', '3', '4', '5'];
const DEFAULT_POTION_KEYS = ['6', '7', '8', '9'];

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
    bars.append(this.elName, this.barHp.el, this.barSp.el, this.barStam.el);
    hero.append(por, bars);
    this.elCombo = h('div', 'hud-combo');
    this.elBuffs = h('div', 'hud-buffs');
    R.append(hero, this.elCombo, this.elBuffs);

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
    this.elZone = h('div', 'hud-zone', '');
    this.elBoss = h('div', 'hud-boss arc-frame');
    this.elBossName = h('div', 'boss-name', '<span class="bn"></span><span class="bp"></span>');
    this.barBoss = new Bar('boss');
    this.elBoss.append(this.elBossName, this.barBoss.el);
    tc.append(this.elZone, this.elBoss);
    R.appendChild(tc);

    // banner / prompt / toasts
    this.elBanner = h('div', 'hud-banner', '<div class="b-floor"></div><div class="b-name"></div>');
    this.elPrompt = h('div', 'hud-prompt');
    this.elToasts = h('div', 'hud-toasts');
    R.append(this.elBanner, this.elPrompt, this.elToasts);

    // --- bottom bar
    const bot = h('div', 'hud-bottom');
    this.barExp = new Bar('exp');
    const ab = h('div', 'hud-actionbar arc-frame interactive');
    this.skillSlots = [];
    const sg = h('div', 'slot-group');
    for (let i = 0; i < 5; i++) {
      const s = this._makeSlot('skill', DEFAULT_SKILL_KEYS[i]);
      s.el.addEventListener('click', () => this._emit('skillslot', i));
      this.skillSlots.push(s); sg.appendChild(s.el);
    }
    const pg = h('div', 'slot-group');
    this.potionSlots = [];
    for (let i = 0; i < 4; i++) {
      const s = this._makeSlot('potion', DEFAULT_POTION_KEYS[i]);
      s.el.addEventListener('click', () => this.host && this.host.usePotion && this.host.usePotion(i));
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
    bot.append(this.barExp.el, ab);
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
      this._unsub.push(host.on('townPortal', () => {
        if (this.ctx && typeof this.ctx.returnToVillage === 'function') this.ctx.returnToVillage();
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
    try { this._updateBar(host, p, dt); } catch (e) { /* keep HUD alive on bad data */ }
    try { this._updateMinimap(host, dt); } catch (e) { /* ignore */ }
    try { this._updateBoss(host); } catch (e) { /* ignore */ }
    try { this._updatePrompt(host); } catch (e) { /* ignore */ }
    try { this._updateBadges(host, p); } catch (e) { /* ignore */ }
  }

  _updateHero(p, dt) {
    const L = this._last;
    this.elName.firstChild.textContent = p.name || 'Hero';
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
    const key = buffs.map((b) => b.id || b.name).join('|');
    if (key !== this._last.buffKey) {
      this._last.buffKey = key;
      this.elBuffs.textContent = '';
      this._buffEls = buffs.map((b) => {
        const el = h('div', 'buff-icon' + (b.debuff ? ' debuff' : ''), `<span>${esc(b.icon || (b.debuff ? '\u2620\uFE0F' : '\u2B06\uFE0F'))}</span><div class="sweep"></div><span class="t"></span>`);
        el.title = b.name || b.id || '';
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

  _updateBar(host, p, dt) {
    const skills = (host.getSkillBar && host.getSkillBar()) || [];
    for (let i = 0; i < this.skillSlots.length; i++) {
      const s = this.skillSlots[i], sk = skills[i];
      if (sk && sk.key) s.key.textContent = sk.key;
      else if (!s.key.textContent) s.key.textContent = DEFAULT_SKILL_KEYS[i];
      if (!sk) {
        if (s._ico !== null) { s.icon.textContent = '\u2014'; s.el.classList.add('empty'); s._ico = null; s.cost.textContent = ''; s.lv.textContent = ''; s.txt.textContent = ''; s.sweep.style.setProperty('--cd', '0deg'); }
        continue;
      }
      const ico = sk.icon || '\u2728';
      const sig = `${sk.skillId}|${ico}|${sk.level}|${sk.spCost}`;
      if (s._ico !== sig) {
        s._ico = sig; s.icon.textContent = ico; s.el.classList.remove('empty');
        s.el.title = sk.name || ''; s.cost.textContent = sk.spCost ? sk.spCost : ''; s.lv.textContent = sk.level ? 'L' + sk.level : '';
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
    const pots = (host.getPotionSlots && host.getPotionSlots()) || [];
    for (let i = 0; i < this.potionSlots.length; i++) {
      const s = this.potionSlots[i], q = pots[i];
      if (q && q.key) s.key.textContent = q.key; else if (!s.key.textContent) s.key.textContent = DEFAULT_POTION_KEYS[i];
      const it = q && q.item;
      const sig = it ? (it.name + '|' + it.icon) : '';
      if (s._ico !== sig) {
        s._ico = sig; s.icon.textContent = it ? (it.icon || '\u{1F9EA}') : '\u2014';
        s.el.classList.toggle('empty', !it); s.el.title = it ? it.name : 'Empty potion slot';
      }
      const c = it ? (it.count != null ? String(it.count) : '') : '';
      if (s.cnt.textContent !== c) s.cnt.textContent = c;
      const pcd = Math.max(0, (q && q.cooldown) || 0), pmax = (q && q.cooldownMax) || 0;
      const pdeg = it && pcd > 0 && pmax > 0 ? Math.round(clamp01(pcd / pmax) * 360) : 0;
      if (pdeg !== s._cd) { s.sweep.style.setProperty('--cd', pdeg + 'deg'); s._cd = pdeg; }
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
    const on = !!(b && b.maxHp > 0 && b.hp > 0);
    this.elBoss.classList.toggle('on', on);
    if (!on) return;
    const bn = this.elBossName.firstChild, bp = this.elBossName.lastChild;
    const name = (b.title ? b.name + ' \u2014 ' + b.title : b.name) || 'Boss';
    if (bn.textContent !== name) bn.textContent = name;
    const ph = b.maxPhases > 1 ? `Phase ${b.phase || 1}/${b.maxPhases}` : (b.phase ? `Phase ${b.phase}` : '');
    if (bp.textContent !== ph) bp.textContent = ph;
    this.barBoss.set(b.hp, b.maxHp, `${fmt(b.hp)} / ${fmt(b.maxHp)}`);
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
    if (title !== this._last.zone) {
      this._last.zone = title; this.elMMTitle.textContent = title; this.elZone.textContent = title;
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
    const colors = { enemy: '#ff4444', boss: '#ff2288', chest: '#ffdd44', npc: '#55ff88', portal: '#cc66ff', stairs: '#cc66ff', loot: '#ffffff' };
    for (const e of d.entities || []) {
      const x = X(e.x), y = Y(e.y);
      if (x < -6 || y < -6 || x > W + 6 || y > H + 6) continue;
      c.fillStyle = colors[e.type] || '#aaa';
      c.beginPath();
      if (e.type === 'chest') { c.rect(x - 3, y - 3, 6, 6); }
      else if (e.type === 'portal' || e.type === 'stairs') { c.moveTo(x, y - 6); c.lineTo(x + 5, y); c.lineTo(x, y + 6); c.lineTo(x - 5, y); c.closePath(); }
      else c.arc(x, y, e.type === 'boss' ? 6 : 3.2, 0, 6.283);
      c.fill();
      if (e.type === 'npc') { c.strokeStyle = '#000'; c.lineWidth = 1; c.stroke(); }
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
    return (ctx && ctx.inventory) || (g && g.inventory) || null;
  };
  const getSkillsSys = () => {
    const g = getGame();
    return (ctx && ctx.skills) || (g && g.skills) || null;
  };
  const getQuestsSys = () => {
    const g = getGame();
    return (ctx && ctx.quests) || (g && g.quests) || null;
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
        return { ...snap, bonus, combo: Math.max(snap.combo || 0, ctrlCombo) };
      }
      return {
        name: h.name || 'Hero',
        level: h.level || 1,
        hp: Math.ceil(h.hp ?? s.maxHp ?? 100),
        maxHp: s.maxHp ?? h.maxHp ?? 100,
        sp: Math.floor(h.mp ?? h.sp ?? s.maxMp ?? 50),
        maxSp: s.maxMp ?? h.maxMp ?? h.maxSp ?? 50,
        stamina: Math.floor(h.stamina ?? s.maxStamina ?? 100),
        maxStamina: s.maxStamina ?? h.maxStamina ?? 100,
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
      if (!sk) return [null, null, null, null, null];
      if (typeof sk.getSkillBar === 'function') {
        return (sk.getSkillBar() || []).map((s, i) => (s ? {
          ...s,
          skillId: s.skillId || s.id,
          cooldown: s.cooldown ?? s.remaining ?? 0,
          cooldownMax: s.cooldownMax ?? s.total ?? s.cd ?? 0,
          spCost: s.spCost ?? s.mpCost ?? s.cost ?? 0,
          key: s.key || DEFAULT_SKILL_KEYS[i],
        } : null));
      }
      const bar = sk.hotbar || sk.equippedSkills || [];
      return DEFAULT_SKILL_KEYS.map((k, i) => {
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
      const hasVillage = list.some((f) => f.floor === 0);
      const out = hasVillage ? list : [{ floor: 0, name: 'Oakhaven Village', unlocked: true, recommendedLevel: 1 }, ...list];
      return out.map((f) => ({ ...f, current: f.floor === curFloor }));
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
        return d.getMinimapData({ x: pPos.x, y: pPos.y, z: pPos.z }, pPos.angle, enemyList);
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
        const hit = d.getNearestInteractable(pPos.x, pPos.z);
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
    equip(uid) {
      let r;
      if (typeof ctx.equip === 'function') r = wrapRes(ctx.equip(uid), 'Equipped');
      else {
        const inv = getInv();
        r = inv && inv.equip ? wrapRes(inv.equip(uid), 'Equipped') : { ok: false, msg: 'Unavailable' };
      }
      const pc = getPlayerCtrl();
      if (pc && typeof pc.syncEquipment === 'function') pc.syncEquipment();
      return r;
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
      if (res && res.item && d && typeof d.spawnGroundLoot === 'function') {
        const pPos = getPlayerPos();
        try { d.spawnGroundLoot(pPos.x, pPos.z, res.item); } catch (e) { /* ignore */ }
      }
      return wrapRes(res, 'Dropped item');
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
        return { ok, msg: ok ? 'Used potion' : 'No potion available' };
      }
      if (typeof ctx.usePotion === 'function') return wrapRes(ctx.usePotion(slotIdx));
      const inv = getInv();
      return inv && inv.useQuickSlot ? wrapRes(inv.useQuickSlot(slotIdx)) : { ok: false, msg: 'Empty slot' };
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
    teleportToFloor(floorNum) {
      const f = Number(floorNum) || 0;
      if (f === 0 && typeof ctx.returnToVillage === 'function') {
        ctx.returnToVillage();
        return { ok: true, msg: 'Returned to Village' };
      }
      if (typeof ctx.enterFloor === 'function') {
        ctx.enterFloor(f);
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


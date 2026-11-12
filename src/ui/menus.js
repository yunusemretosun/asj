// ============================================================================
// ASJ (ARKENVEIL: SIGILS & JOURNEYS) - interactive RPG menus (owned by ui-hud)
//
//   import { MenuManager } from './ui/menus.js';   // or createMenus(root, ctx)
//   const menus = new MenuManager(document.getElementById('menu-root'), gameContext);
//   if (menus.isAnyMenuOpen()) skip player input;
//
// Menus: character (C), inventory (B/I), skills (K), compose (O), quests (Q),
// map/floor select (M), dialogue, shop. Also handles F5 (quick save) and Esc.
// Data/actions go through the normalised host from createHost() in hud.js.
// ============================================================================
import { h, esc, createHost, renderIconHTML } from './hud.js';
import { ALCHEMY, SEALS, STATUS, elixirKindForSlot, powderGradeForTier, alchemyChance } from '../systems/mechanics.js';

const SLOT_ORDER = ['helmet', 'necklace', 'weapon', 'armor', 'shield', 'ring', 'boots'];
const SLOT_LABEL = { weapon: 'Weapon', shield: 'Shield', helmet: 'Helm', armor: 'Armor', boots: 'Boots', necklace: 'Amulet', ring: 'Ring' };
const SLOT_ICON = { weapon: '⚔️', shield: '🛡️', helmet: '⛑️', armor: '🥋', boots: '👢', necklace: '📿', ring: '💍' };
const TYPE_ICON = { potion: '🧪', gem: '💎', crystal: '🔮', stone: '🪨', scroll: '📜', material: '🔹', key: '🗝️', misc: '📦' };
const RARITY_NAME = { normal: 'Normal', magic: 'Magic', rare: 'Rare', epic: 'Epic', unique: 'Unique' };
const STAT_LABEL = {
  atk: 'Attack', atkMin: 'Min Attack', atkMax: 'Max Attack', matk: 'Magic Attack', def: 'Defense', hp: 'Max HP', maxHp: 'Max HP',
  mp: 'Max SP', maxMp: 'Max SP', sp: 'Max SP', maxSp: 'Max SP', str: 'STR', dex: 'DEX', int: 'INT', lck: 'LCK',
  critRate: 'Crit Rate', critDmg: 'Crit Damage', dodge: 'Dodge', hit: 'Hit', attackSpeed: 'Attack Speed', moveSpeed: 'Move Speed',
  hpRegen: 'HP Regen', mpRegen: 'SP Regen', magicFind: 'Magic Find', goldFind: 'Gold Find',
};
const PCT_KEYS = /(rate|crit|dodge|find|speed|chance|pct|percent|res)/i;
const MATERIAL_RE = /gem|crystal|stone|material|rune|jewel|ore|essence/i;
const HOTKEY_MENU = { c: 'character', b: 'inventory', i: 'inventory', k: 'skills', o: 'compose', q: 'quests', m: 'map' };
const ALIASES = {
  hero: 'character', char: 'character', character: 'character', stats: 'character',
  bag: 'inventory', inv: 'inventory', inventory: 'inventory', equipment: 'inventory',
  skill: 'skills', skills: 'skills', skilltree: 'skills',
  compose: 'compose', composing: 'compose', synthesis: 'compose', forge: 'compose',
  quest: 'quests', quests: 'quests', questlog: 'quests',
  map: 'map', floors: 'map', floor: 'map', floorselect: 'map', teleport: 'map', portal: 'map',
  storage: 'storage', stash: 'storage', vault: 'storage',
  dialogue: 'dialogue', dialog: 'dialogue', talk: 'dialogue', shop: 'shop', store: 'shop',
};
const TITLES = { character: 'Hero', inventory: 'Inventory & Equipment', skills: 'Skill Tree', compose: 'Alchemy Workshop', quests: 'Quest Log', map: 'Dungeon Floors', shop: 'Shop', storage: 'Storage Vault', dialogue: '' };
const KIND_NAME = { weapon: 'Weapon', shield: 'Shield', armor: 'Armor', accessory: 'Accessory' };
const HOTKEY_TXT = { character: 'C', inventory: 'B / I', skills: 'K', compose: 'O', quests: 'Q', map: 'M' };

export const itemIcon = (it) => (it && (it.icon || SLOT_ICON[it.slot] || TYPE_ICON[String(it.type || '').toLowerCase()] || (MATERIAL_RE.test(it.type || '') ? '💎' : '📦'))) || '';
const rarityOf = (it) => String((it && it.rarity) || 'normal').toLowerCase();
function sealOf(it) {
  const id = it && it.seal;
  if (!id) return null;
  const d = SEALS[id] || {};
  return { id: String(id), name: it.sealName || d.name || 'Seal', short: d.short || '\u2726', color: it.sealColor || d.color || '#fff' };
}
const isMaterial = (it) => !!it && !SLOT_LABEL[it.slot] && MATERIAL_RE.test(String(it.type || '') + ' ' + String(it.name || ''));
const isEquipItem = (it) => !!it && !!SLOT_LABEL[it.slot];
const labelOf = (k) => STAT_LABEL[k] || String(k).replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase());
function fmtStat(k, v) {
  if (typeof v !== 'number') return String(v);
  if (PCT_KEYS.test(k) && !/^res$/i.test(k)) { const p = Math.abs(v) <= 1.5 ? v * 100 : v; return (Math.round(p * 10) / 10) + '%'; }
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
}
function statEntries(it) {
  const s = (it && it.stats) || {};
  const out = {};
  for (const k of Object.keys(s)) if (typeof s[k] === 'number' && s[k] !== 0) out[k] = s[k];
  return out;
}

export class MenuManager {
  constructor(root = document.body, ctx = null) {
    this.root = root || document.body;
    this.ctx = null; this.host = null; this._hostSig = null; this._unsub = [];
    this.current = null; this.data = null; this.state = {};
    this._items = new Map(); this._drag = null; this._refreshT = 0;
    this._build();
    this._bindHost(ctx);
    this._onKey = this._onKey.bind(this);
    window.addEventListener('keydown', this._onKey, true);
    this._onMenuEvt = (e) => { const d = e.detail || {}; if (d.toggle) this.toggleMenu(d.name, d.data); else this.openMenu(d.name, d.data); };
    window.addEventListener('arc-ui-menu', this._onMenuEvt);
    this._onToastEvt = (e) => this._toast(e.detail && e.detail.msg, e.detail && e.detail.type);
    document.documentElement.classList.add('arc-ui');
  }

  // ------------------------------------------------------------------ build
  _build() {
    this.overlay = h('div', 'arc-overlay arc-ui');
    this.overlay.style.pointerEvents = 'auto';
    this.overlay.addEventListener('mousedown', (e) => { if (e.target === this.overlay && this.current !== 'dialogue') this.closeAll(); });
    this.modal = h('div', 'arc-modal arc-frame');
    this.overlay.appendChild(this.modal);
    this.tip = h('div', 'arc-tooltip pair arc-ui');
    this.ctxMenu = h('div', 'ctx-menu arc-ui');
    this.root.append(this.overlay, this.tip, this.ctxMenu);
    // delegated events
    const m = this.modal;
    m.addEventListener('click', (e) => this._onClick(e));
    m.addEventListener('dblclick', (e) => this._onDbl(e));
    m.addEventListener('contextmenu', (e) => this._onCtx(e));
    m.addEventListener('mouseover', (e) => this._onOver(e));
    m.addEventListener('mousemove', (e) => this._moveTip(e));
    m.addEventListener('mouseout', (e) => { if (!e.relatedTarget || !m.contains(e.relatedTarget) || !e.relatedTarget.closest('[data-uid]')) this._hideTip(); });
    m.addEventListener('dragstart', (e) => this._onDragStart(e));
    m.addEventListener('dragover', (e) => { const t = e.target.closest('[data-drop]'); if (t) { e.preventDefault(); t.classList.add('dragover'); } });
    m.addEventListener('dragleave', (e) => { const t = e.target.closest('[data-drop]'); if (t) t.classList.remove('dragover'); });
    m.addEventListener('drop', (e) => this._onDrop(e));
    m.addEventListener('dragend', () => { this._drag = null; m.querySelectorAll('.dragging,.dragover').forEach((n) => n.classList.remove('dragging', 'dragover')); });
    document.addEventListener('mousedown', (e) => { if (!this.ctxMenu.contains(e.target)) this.ctxMenu.classList.remove('on'); });
  }

  _bindHost(ctx) {
    const sig = ctx && (ctx.__host ? ctx : (ctx.gameState || ctx.game || ctx.state || ctx));
    if (sig === this._hostSig && this.host) return;
    this._hostSig = sig;
    this._unsub.forEach((f) => { try { f(); } catch (e) { /* ignore */ } });
    this._unsub = [];
    this.ctx = ctx;
    this.host = ctx ? (ctx.__host ? ctx : createHost(ctx)) : null;
    if (this.host && this.host.on) {
      for (const ev of ['equip', 'item:added', 'skill:learned', 'levelup', 'gold', 'quest:accepted', 'quest:updated', 'quest:completed', 'change']) {
        const off = this.host.on(ev, () => this._softRefresh());
        this._unsub.push(off);
      }
    }
  }
  /** Optional per-frame call; also lets main.js hand over a (new) context. */
  update(dt, ctx) { if (ctx && ctx !== this.ctx) this._bindHost(ctx); }

  // ---------------------------------------------------------------- opening
  isAnyMenuOpen() { return !!this.current || document.documentElement.classList.contains('asj-creating'); }
  isOpen(name) { return name ? this.current === (ALIASES[String(name).toLowerCase()] || name) : !!this.current; }
  toggleMenu(name, data) {
    const n = ALIASES[String(name).toLowerCase()] || name;
    if (this.current === n) {
      if (performance.now() - (this._lastOpenAt || 0) < 40) return;
      this.closeAll();
    } else this.openMenu(n, data);
  }
  toggle(name, data) { this.toggleMenu(name, data); }
  open(name, data) { this.openMenu(name, data); }
  closeAll() {
    if (!this.current) return;
    const prev = this.current;
    this._alchCancel(true);
    this.current = null; this.data = null; this._hideTip(); this.ctxMenu.classList.remove('on');
    this.overlay.classList.remove('open');
    this._notify(false, prev);
  }
  close() { this.closeAll(); }
  openMenu(name, data) {
    const n = ALIASES[String(name || '').toLowerCase()] || name;
    if (!n) return;
    this._lastOpenAt = performance.now();
    const was = !!this.current;
    if (this.current !== n) this.state = {};
    this.current = n; this.data = data || null;
    if (n === 'compose' && data && typeof data === 'object') {
      if (data.tab) this.state.tab = data.tab;
      if (data.uid != null) { this.state.alchUid = String(data.uid); this.state.tab = 'alchemy'; }
    }
    this._render();
    this.overlay.classList.add('open');
    if (!was) this._notify(true, n);
  }
  openDialogue(d) { this.openMenu('dialogue', typeof d === 'string' ? { npcId: d } : d); }
  openShop(npcId) { this.openMenu('shop', typeof npcId === 'object' ? npcId : { npcId }); }
  openCompose(data) { this.openMenu('compose', data); }
  openAlchemy(uid) { this.openMenu('compose', { tab: 'alchemy', uid }); }
  openFloorSelect() { this.openMenu('map'); }
  _notify(open, name) {
    document.body.classList.toggle('arc-menu-open', open);
    if (open && document.exitPointerLock) { try { document.exitPointerLock(); } catch (e) { /* ignore */ } }
    const pc = this.ctx && (this.ctx.player || this.ctx.playerController);
    if (pc && 'inputEnabled' in pc) {
      pc.inputEnabled = !open;
      if (open) { pc.isMouseDown = false; pc.isRightMouseDown = false; if (pc.keys && pc.keys.clear) pc.keys.clear(); }
    }
    window.dispatchEvent(new CustomEvent('arc-menu-change', { detail: { open, name } }));
    if (this.ctx && typeof this.ctx.onMenuChange === 'function') this.ctx.onMenuChange(open, name);
  }
  refresh() { if (this.current) this._render(); }
  _softRefresh() {
    if (!this.current || this.current === 'dialogue' || this._drag || this._fuse) return;
    clearTimeout(this._refreshT);
    this._refreshT = setTimeout(() => { if (this.current && !this._drag) this._render(); }, 60);
  }

  _onKey(e) {
    if (document.documentElement.classList.contains('asj-creating')) return;
    const t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
    if (e.ctrlKey || e.altKey || e.metaKey) return;
    if (e.key === 'F5') {
      e.preventDefault();
      const r = this.host && this.host.save ? this.host.save() : null;
      this._toast(r && r.ok === false ? (r.msg || 'Save failed') : 'Game saved', r && r.ok === false ? 'warn' : 'info');
      return;
    }
    if (e.key === 'Escape') { if (this.current) { e.preventDefault(); e.stopPropagation(); this.closeAll(); } return; }
    if (this.current === 'dialogue' && (e.key === 'Enter' || e.key === ' ' || e.key.toLowerCase() === 'e')) {
      e.preventDefault(); e.stopPropagation(); this._dlgAdvance(); return;
    }
    const menu = HOTKEY_MENU[e.key.toLowerCase()];
    if (menu && e.key.length === 1) {
      if (this.current === 'dialogue' || this.current === 'shop') { return; }
      if (e.repeat) return;
      e.preventDefault();
      this.toggleMenu(menu);
    }
  }
  _toast(msg, type = 'info') {
    if (!msg) return;
    if (this.ctx && this.ctx.hud && this.ctx.hud.showToast) this.ctx.hud.showToast(msg, type);
    else window.dispatchEvent(new CustomEvent('arc-ui-toast', { detail: { msg, type } }));
  }

  // ----------------------------------------------------------- frame / util
  _frame(name, bodyEl, cls = '') {
    this.modal.className = 'arc-modal arc-frame ' + cls;
    this.modal.textContent = '';
    if (name !== 'dialogue') {
      const t = h('div', 'arc-modal-title');
      t.innerHTML = `<span>${esc(this._title || TITLES[name] || '')}${HOTKEY_TXT[name] ? `<span class="hk">[${HOTKEY_TXT[name]}]</span>` : ''}</span>`;
      const x = h('button', 'arc-close', '✕'); x.dataset.act = 'close'; t.appendChild(x);
      this.modal.appendChild(t);
    }
    const b = h('div', 'arc-modal-body');
    b.appendChild(bodyEl);
    this.modal.appendChild(b);
    return b;
  }
  _msgEl() { return this.modal.querySelector('.arc-msg'); }
  _say(text, ok) {
    const el = this._msgEl();
    if (el) { el.textContent = text || ''; el.className = 'arc-msg ' + (ok ? 'ok' : 'bad'); }
  }
  /** run a host action and show result; r may be bool | {ok,msg} | undefined */
  _do(fn, refresh = true) {
    let r;
    try { r = fn(); } catch (e) { console.error(e); r = { ok: false, msg: String(e.message || e) }; }
    const ok = r === undefined ? true : (typeof r === 'object' && r !== null ? r.ok !== false : !!r);
    const msg = r && typeof r === 'object' && r.msg ? r.msg : (ok ? '' : 'Not possible.');
    if (refresh) this._render();
    if (msg) { this._say(msg, ok); if (!ok) this._toast(msg, 'warn'); }
    return { ok, msg, r };
  }
  _reg(it) { if (it && it.uid != null) this._items.set(String(it.uid), it); return it; }

  _render() {
    if (!this.current) return;
    this._items.clear();
    if (!this.host) { this._title = TITLES[this.current]; this._frame(this.current, h('div', 'arc-empty', 'Game not ready.')); return; }
    const scroll = this.modal.querySelector('.arc-modal-body'); const st = scroll ? scroll.scrollTop : 0;
    this._title = null;
    try {
      switch (this.current) {
        case 'character': this._rCharacter(); break;
        case 'inventory': this._rInventory(); break;
        case 'skills': this._rSkills(); break;
        case 'compose': this._rCompose(); break;
        case 'quests': this._rQuests(); break;
        case 'map': this._rFloors(); break;
        case 'dialogue': this._rDialogue(); break;
        case 'shop': this._rShop(); break;
        case 'storage': this._rStorage(); break;
        default: this._frame(this.current, h('div', 'arc-empty', 'Unknown menu: ' + esc(this.current)));
      }
    } catch (err) {
      console.error('[menus] render failed', err);
      this._frame(this.current, h('div', 'arc-empty', 'This menu failed to load: ' + esc(err.message)));
    }
    const b = this.modal.querySelector('.arc-modal-body'); if (b) b.scrollTop = st;
  }

  // --------------------------------------------------------- item widgets
  _slotHTML(it, { drag, drop, uid, extra = '', ph = '', big = false, selected = false } = {}) {
    const attrs = [];
    if (it) { this._reg(it); attrs.push(`data-uid="${esc(it.uid)}"`); if (drag) attrs.push('draggable="true"'); }
    if (drop) attrs.push(`data-drop="${esc(drop)}"`);
    if (extra) attrs.push(extra);
    const sealInfo = it ? sealOf(it) : null;
    const plusN = it && it.plus ? it.plus | 0 : 0;
    const cls = ['item-slot', it ? 'has r-' + rarityOf(it) : '', it && it.classOk === false ? 'cls-bad' : '', big ? 'big' : '', selected ? 'selected' : '', plusN >= 10 ? 'plus-max' : plusN >= 7 ? 'plus-hi' : '', sealInfo ? 'sealed seal-' + sealInfo.id : ''].join(' ');
    let inner = '';
    if (it) {
      inner = `<span>${renderIconHTML(itemIcon(it))}</span>`;
      if (it.count > 1) inner += `<span class="cnt">${it.count}</span>`;
      if (it.level && isEquipItem(it)) inner += `<span class="ilv">${it.level}</span>`;
      if (it.plus) inner += `<span class="plus">+${it.plus}</span>`;
      if (sealInfo) inner += `<span class="seal" style="color:${esc(sealInfo.color)}">${esc(sealInfo.short)}</span>`;
    } else if (ph) inner = `<span class="slot-ph">${esc(ph)}</span>`;
    return `<div class="${cls}" ${attrs.join(' ')}>${inner}</div>`;
  }

  _tipCard(it, cmp, equipped) {
    const r = rarityOf(it), me = statEntries(it), other = cmp ? statEntries(cmp) : null;
    const p = this.host.getPlayer ? this.host.getPlayer() : null;
    let stats = '';
    const keys = new Set([...Object.keys(me), ...(other ? Object.keys(other) : [])]);
    for (const k of keys) {
      const v = me[k] || 0;
      let diff = '';
      if (other && !equipped) {
        const d = v - (other[k] || 0);
        if (Math.abs(d) > 1e-9) diff = ` <span class="diff ${d > 0 ? 'up' : 'down'}">${d > 0 ? '▲' : '▼'}${fmtStat(k, Math.abs(d))}</span>`;
      }
      if (!v && !diff) continue;
      stats += `<div class="tip-stat"><span>${esc(labelOf(k))}</span><span>${v >= 0 ? '+' : ''}${esc(fmtStat(k, v))}${diff}</span></div>`;
    }
    if (!stats && it.lines && it.lines.length) stats = it.lines.map((l) => `<div class="tip-affix">${esc(l)}</div>`).join('');
    const affixes = (it.affixes || []).map((a) => `<div class="tip-affix">✦ ${esc(a)}</div>`).join('');
    const clsBad = it.classOk === false || it.meetsClass === false;
    const reqBad = p && it.reqLevel && p.level < it.reqLevel;
    const typeTxt = [RARITY_NAME[r] || r, SLOT_LABEL[it.slot] || it.type].filter(Boolean).join(' · ');
    const sl = sealOf(it);
    const nameStyle = sl ? ` style="color:${esc(sl.color)};text-shadow:0 0 8px ${esc(sl.color)}"` : '';
    const setLine = it.setName ? `<div class="tip-set">Set: ${esc(it.setName)}</div>` : '';
    const onlyLine = it.classOnly ? `<div class="tip-req ${clsBad ? 'bad' : ''}">${esc(Array.isArray(it.classOnly) ? it.classOnly.join(' / ') : it.classOnly)} only</div>` : '';
    return `<div class="tip-card r-${r} ${equipped ? 'equipped-tag' : ''}">
      <div class="tip-name"${nameStyle}>${renderIconHTML(itemIcon(it))} ${esc(it.name)}${it.plus ? ` <small>+${it.plus}</small>` : ''}</div>
      ${sl ? `<div class="tip-seal" style="color:${esc(sl.color)}">${esc(sl.short)} ${esc(sl.name)}</div>` : ''}
      <div class="tip-sub">${esc(typeTxt)}${it.level ? ` · Lv ${it.level}` : ''}</div>${setLine}
      ${stats}${affixes}
      ${it.desc ? `<div class="tip-desc">${esc(it.desc)}</div>` : ''}
      ${onlyLine}${it.classReq ? `<div class="tip-req ${clsBad ? 'bad' : ''}">Class: ${esc(it.classReq)}</div>` : ''}
      ${it.reqLevel ? `<div class="tip-req ${reqBad ? 'bad' : ''}">Requires Lv ${it.reqLevel}</div>` : ''}
      <div class="tip-foot"><span>${it.value ? `Sell <b class="arc-gold">${it.value}</b> G` : ''}</span><span>${it.count > 1 ? 'x' + it.count : ''}</span></div>
    </div>`;
  }

  _onOver(e) {
    const el = e.target.closest('[data-uid]');
    if (!el || !this.modal.contains(el)) return;
    const it = this._items.get(el.dataset.uid);
    if (!it) return;
    let cmp = null;
    const inv = this.host.getInventory ? this.host.getInventory() : null;
    const isEq = inv && inv.equipment && Object.values(inv.equipment).some((q) => q && String(q.uid) === String(it.uid));
    if (inv && isEquipItem(it) && !isEq) cmp = inv.equipment[it.slot] || null;
    let html = this._tipCard(it, cmp, isEq);
    if (cmp) html += this._tipCard(cmp, null, true);
    this.tip.innerHTML = html; this.tip.classList.add('on');
    this._moveTip(e);
  }
  _moveTip(e) {
    if (!this.tip.classList.contains('on')) return;
    const w = this.tip.offsetWidth, hgt = this.tip.offsetHeight;
    let x = e.clientX + 16, y = e.clientY + 12;
    if (x + w > innerWidth - 6) x = e.clientX - w - 16;
    if (y + hgt > innerHeight - 6) y = Math.max(6, innerHeight - hgt - 6);
    this.tip.style.left = Math.max(6, x) + 'px'; this.tip.style.top = y + 'px';
  }
  _hideTip() { this.tip.classList.remove('on'); }

  // --------------------------------------------------------- event routing
  _onClick(e) {
    const a = e.target.closest('[data-act]');
    if (a && !a.disabled) { this._act(a.dataset.act, a.dataset, e); return; }
    const s = e.target.closest('[data-uid]');
    if (s && this.modal.contains(s)) this._itemClick(s.dataset.uid, e);
  }
  _onDbl(e) {
    const s = e.target.closest('[data-uid]');
    if (!s || this.current !== 'inventory') return;
    const it = this._items.get(s.dataset.uid); if (!it) return;
    this._hideTip();
    this._smartUse(it);
  }
  _smartUse(it) {
    const inv = this.host.getInventory();
    const eqSlot = Object.keys(inv.equipment || {}).find((k) => inv.equipment[k] && String(inv.equipment[k].uid) === String(it.uid));
    if (eqSlot) this._do(() => this.host.unequip(eqSlot));
    else if (isEquipItem(it)) this._do(() => this.host.equip(it.uid));
    else this._do(() => this.host.useItem(it.uid));
  }
  _onCtx(e) {
    const s = e.target.closest('[data-uid]');
    if (!s || this.current !== 'inventory') return;
    e.preventDefault();
    const it = this._items.get(s.dataset.uid); if (!it) return;
    const inv = this.host.getInventory();
    const eqSlot = Object.keys(inv.equipment || {}).find((k) => inv.equipment[k] && String(inv.equipment[k].uid) === String(it.uid));
    const rows = [];
    if (eqSlot) { rows.push(['Unequip', () => this._do(() => this.host.unequip(eqSlot))]); rows.push(['Alchemy', () => this.openAlchemy(it.uid)]); }
    else {
      if (isEquipItem(it)) rows.push(['Equip', () => this._do(() => this.host.equip(it.uid))]);
      else rows.push(['Use', () => this._do(() => this.host.useItem(it.uid))]);
      if (isEquipItem(it)) rows.push(['Alchemy', () => this.openAlchemy(it.uid)]);
      rows.push(['Sell (' + (it.value || 0) + ' G)', () => this._do(() => this.host.sellItem(it.uid))]);
      rows.push(['Drop', () => this._do(() => this.host.dropItem(it.uid))]);
    }
    this.ctxMenu.textContent = '';
    for (const [label, fn] of rows) {
      const b = h('button', '', esc(label)); b.onclick = () => { this.ctxMenu.classList.remove('on'); this._hideTip(); fn(); };
      this.ctxMenu.appendChild(b);
    }
    this.ctxMenu.style.left = Math.min(e.clientX, innerWidth - 150) + 'px';
    this.ctxMenu.style.top = Math.min(e.clientY, innerHeight - 40 * rows.length) + 'px';
    this.ctxMenu.classList.add('on');
  }
  _onDragStart(e) {
    const s = e.target.closest('[data-uid]'); if (!s) return;
    const it = this._items.get(s.dataset.uid); if (!it) return;
    const inv = this.host.getInventory();
    const eq = Object.values(inv.equipment).some((q) => q && String(q.uid) === String(it.uid));
    this._drag = { it, from: eq ? 'equip' : 'bag' };
    this._hideTip();
    e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', String(it.uid));
    setTimeout(() => s.classList.add('dragging'), 0);
  }
  _onDrop(e) {
    const t = e.target.closest('[data-drop]'); if (!t || !this._drag) return;
    e.preventDefault(); t.classList.remove('dragover');
    const { it, from } = this._drag; this._drag = null;
    const d = t.dataset.drop;
    const inv = this.host.getInventory() || {};
    const eqSlot = from === 'equip' ? Object.keys(inv.equipment || {}).find((k) => inv.equipment[k] && String(inv.equipment[k].uid) === String(it.uid)) : null;
    if (d === 'trash') { if (from === 'equip') this._do(() => this.host.unequip(eqSlot || it.slot)); else this._do(() => this.host.dropItem(it.uid)); }
    else if (d === 'bag') { if (from === 'equip') this._do(() => this.host.unequip(eqSlot || it.slot)); }
    else if (d.startsWith('equip:')) {
      const slot = d.slice(6);
      if (from === 'equip') return;
      const p = this.host.getPlayer ? (this.host.getPlayer() || {}) : {};
      const isAxeman = String(p.classId || '').toLowerCase() === 'axeman';
      const canShieldAxe = (slot === 'shield' && isAxeman && it.type === 'weapon' && it.subType === 'axe');
      if (it.slot !== slot && !canShieldAxe) { this._say(`${it.name} cannot be equipped as ${SLOT_LABEL[slot]}.`, false); return; }
      this._do(() => (canShieldAxe ? this.host.equip(it.uid, 'shield') : this.host.equip(it.uid)));
    } else if (d === 'sell') this._do(() => this.host.sellItem(it.uid));
    else if (d === 'alchemy') { if (isEquipItem(it)) this._alchSelect(it.uid); else this._say('Only equipment can be enhanced.', false); }
  }

  _itemClick(uid, e) {
    const it = this._items.get(String(uid)); if (!it) return;
    const S = this.state;
    switch (this.current) {
      case 'inventory': S.sel = String(uid); this._render(); break;
      case 'compose': if (S.tab === 'alchemy') { if (isEquipItem(it)) this._alchSelect(it.uid); } else this._composeClick(it); break;
      case 'shop': this._shopClick(it, e); break;
      case 'storage': this._storageClick(it); break;
      default: break;
    }
  }

  _act(a, ds, e) {
    const S = this.state, host = this.host;
    switch (a) {
      case 'close': this.closeAll(); break;
      case 'tab': this._alchCancel(); S.tab = ds.tab; S.sel = null; S.picks = []; this._render(); break;
      // character
      case 'ap': this._do(() => host.spendAP(ds.stat, e && e.shiftKey ? 5 : 1)); break;
      // inventory
      case 'equip': this._do(() => host.equip(ds.uid)); break;
      case 'unequip': this._do(() => host.unequip(ds.slot)); break;
      case 'use': this._do(() => host.useItem(ds.uid)); break;
      case 'sell': this._do(() => host.sellItem(ds.uid)); break;
      case 'drop': this._do(() => host.dropItem(ds.uid)); break;
      case 'sortbag': if (host.sortBag) this._do(() => host.sortBag()); break;
      // skills
      case 'skillsel': S.skill = ds.id; this._render(); break;
      case 'skilllearn': this._do(() => host.levelSkill(ds.id)); break;
      case 'skillslot': this._do(() => host.assignSkill(ds.id, +ds.slot)); break;
      // quests
      case 'questsel': S.quest = ds.id; this._render(); break;
      case 'questaccept': this._do(() => host.acceptQuest(ds.id)); break;
      case 'questturn': this._do(() => host.turnInQuest(ds.id)); break;
      case 'questabandon': if (host.abandonQuest) this._do(() => host.abandonQuest(ds.id)); break;
      // compose
      case 'composego': if (S.tab === 'alchemy') this._alchStart(); else this._composeGo(); break;
      case 'alchclear': this._alchCancel(); S.alchUid = null; this._render(); break;
      case 'alchcancel': this._alchCancel(); this._render(); break;
      case 'alchpowder': S.alchPowder = !S.alchPowder; this._render(); break;
      case 'alchtalisman': S.alchTalisman = !S.alchTalisman; this._render(); break;
      case 'composeclear': this._alchCancel(); S.picks = []; this._render(); break;
      // floors
      case 'floor': {
        const r = this._do(() => host.teleportToFloor(+ds.floor), false);
        if (r.ok) this.closeAll();
        break;
      }
      // shop
      case 'buy': {
        const r = this._do(() => host.buyItem(S.npcId, +ds.idx));
        void r; break;
      }
      case 'dlgopt': this._dlgOption(+ds.i); break;
      case 'dlgnext': this._dlgAdvance(); break;
      default: break;
    }
  }

  // ------------------------------------------------------------ CHARACTER
  _rCharacter() {
    const p = this.host.getPlayer() || {}; const d = p.derived || {}; const st = p.stats || {};
    const el = h('div');
    const pct = (v) => { if (v == null) return '—'; const x = Math.abs(v) <= 1 ? v * 100 : v; return (Math.round(x * 10) / 10) + '%'; };
    const num = (v) => (v == null ? '—' : Number.isInteger(v) ? v : (Math.round(v * 10) / 10));
    const rows = [
      ['Attack', d.atkMin != null ? `${num(d.atkMin)} – ${num(d.atkMax)}` : '—'], ['Magic Attack', num(d.matk)], ['Defense', num(d.def)],
      ['Crit Rate', pct(d.critRate)], ['Crit Damage', d.critDmg != null ? (d.critDmg < 10 ? Math.round(d.critDmg * 100) + '%' : Math.round(d.critDmg) + '%') : '—'], ['Dodge', pct(d.dodge)],
      ['Hit', num(d.hit)], ['Attack Speed', d.attackSpeed != null ? num(d.attackSpeed) : '—'], ['Move Speed', d.moveSpeed != null ? num(d.moveSpeed) : '—'],
      ['HP Regen', num(d.hpRegen)], ['SP Regen', num(d.mpRegen)], ['Magic Find', pct(d.magicFind)], ['Gold Find', pct(d.goldFind)],
    ].filter((r) => r[1] !== '—' || ['Attack', 'Defense'].includes(r[0]));
    const bonus = p.bonus || {};
    const STATS = [
      ['str', 'Strength', 'Raises melee damage and max HP.'],
      ['dex', 'Dexterity', 'Raises hit, dodge and attack speed.'],
      ['int', 'Intelligence', 'Raises magic damage and max SP.'],
      ['lck', 'Luck', 'Raises crit rate and item/gold drops.'],
    ];
    const canSpend = (p.ap | 0) > 0;
    el.innerHTML = `<div class="char-layout">
      <div class="char-hero">
        <div class="big-portrait">${esc(p.classIcon || '🧙')}</div>
        <div class="cname">${esc(p.name || 'Hero')}</div>
        <div class="clvl">Level ${p.level || 1}</div>
        ${p.className ? `<div class="class-badge" style="--cc:${esc(/^#[0-9a-fA-F]{3,8}$/.test(p.classColor || '') ? p.classColor : '#c9b27a')}"><span>${esc(p.classIcon || '')}</span> ${esc(p.className)}</div>` : ''}
        <div id="cs-hp"></div><div id="cs-sp"></div><div id="cs-xp"></div>
        <div class="pts-line"><span>Attribute Points</span><b>${p.ap | 0}</b></div>
        <div class="pts-line"><span>Skill Points</span><b>${p.skillPoints | 0}</b></div>
        <div class="pts-line"><span>Gold</span><b>${Math.floor(p.gold || 0).toLocaleString()} G</b></div>
      </div>
      <div>
        <div class="arc-section-title">Attributes <span style="float:right;text-transform:none;letter-spacing:0;color:var(--arc-text-mute)">Shift+click: +5</span></div>
        ${STATS.map(([k, n, desc]) => `<div class="stat-row">
          <span class="sname ${k}">${k.toUpperCase()}</span><span class="sval">${st[k] ?? 0}</span>
          <span class="sbonus">${bonus[k] ? '+' + bonus[k] : ''}</span>
          <span class="sdesc"><b>${n}</b><br>${desc}</span>
          <button class="plus-btn" data-act="ap" data-stat="${k}" ${canSpend ? '' : 'disabled'} title="Spend 1 attribute point">+</button></div>`).join('')}
        <div class="arc-section-title">Combat Stats</div>
        <div class="derived-grid">${rows.map(([n, v]) => `<div><span>${n}</span><span>${v}</span></div>`).join('')}</div>
        <div class="arc-msg"></div>
      </div></div>`;
    const mk = (id, kind, cur, max, txt) => {
      const b = h('div', 'arc-bar ' + kind, `<div class="fill" style="width:${max > 0 ? Math.min(100, 100 * cur / max) : 0}%"></div><div class="label">${txt}</div>`);
      el.querySelector(id).appendChild(b);
    };
    mk('#cs-hp', 'hp', p.hp, p.maxHp, `HP ${Math.ceil(p.hp || 0)} / ${p.maxHp || 0}`);
    mk('#cs-sp', 'sp', p.sp, p.maxSp, `SP ${Math.floor(p.sp || 0)} / ${p.maxSp || 0}`);
    mk('#cs-xp', 'exp', p.exp, p.expToNext, `EXP ${Math.floor(p.exp || 0)} / ${p.expToNext || 0}`);
    this._frame('character', el);
  }

  // ------------------------------------------------------------ INVENTORY
  _rInventory() {
    const inv = this.host.getInventory() || { bag: [], equipment: {}, gold: 0, bagSize: 40 };
    const S = this.state, eqv = inv.equipment || {};
    const p = this.host.getPlayer ? (this.host.getPlayer() || {}) : {};
    const isAxeman = String(p.classId || '').toLowerCase() === 'axeman';
    const size = Math.max(inv.bagSize || 0, inv.bag.length, 40);
    const all = [...Object.values(eqv), ...inv.bag];
    const sel = S.sel ? all.find((q) => q && String(q.uid) === S.sel) : null;
    if (!sel) S.sel = null;
    const eqSlotOfSel = sel ? Object.keys(eqv).find((k) => eqv[k] && String(eqv[k].uid) === String(sel.uid)) : null;
    const isEq = Boolean(eqSlotOfSel);
    let equipHTML = SLOT_ORDER.map((s) => {
      const phLabel = (s === 'shield' && isAxeman) ? 'Offhand Axe' : SLOT_LABEL[s];
      return `<div class="eq-${s}">${this._slotHTML(eqv[s], { drag: true, drop: 'equip:' + s, ph: phLabel, big: true, selected: sel && eqv[s] && String(eqv[s].uid) === S.sel })}</div>`;
    }).join('');
    let bagHTML = '';
    for (let i = 0; i < size; i++) { const it = inv.bag[i]; bagHTML += this._slotHTML(it, { drag: true, drop: 'bag', selected: sel && it && String(it.uid) === S.sel }); }
    const infoBtns = sel ? `<div class="inv-actions">
        ${isEq ? `<button class="arc-btn small" data-act="unequip" data-slot="${esc(eqSlotOfSel)}">Unequip</button>`
        : `${isEquipItem(sel) ? `<button class="arc-btn small good" data-act="equip" data-uid="${esc(sel.uid)}">Equip</button>` : `<button class="arc-btn small good" data-act="use" data-uid="${esc(sel.uid)}">Use</button>`}
           <button class="arc-btn small" data-act="sell" data-uid="${esc(sel.uid)}">Sell ${sel.value || 0} G</button>
           <button class="arc-btn small danger" data-act="drop" data-uid="${esc(sel.uid)}">Drop</button>`}</div>` : '';
    const el = h('div');
    el.innerHTML = `<div class="inv-layout">
      <div>
        <div class="arc-section-title">Equipment</div>
        <div class="equip-paper">${equipHTML}</div>
        <div class="inv-info">${sel ? `<b class="rc-text r-${rarityOf(sel)}">${esc(sel.name)}</b><div style="color:var(--arc-text-mute)">${esc(RARITY_NAME[rarityOf(sel)] || '')} ${esc(sel.type || '')}${sel.level ? ' · Lv ' + sel.level : ''}</div>` + infoBtns
          : '<span style="color:var(--arc-text-mute)">Click an item for actions. Double-click to equip/use, right-click for menu, drag to equip/unequip.</span>'}</div>
      </div>
      <div>
        <div class="inv-top"><div class="arc-section-title" style="flex:1;margin:0">Bag (${inv.bag.length}/${size})</div>
          <span class="arc-gold" style="margin-left:12px">${Math.floor(inv.gold || 0).toLocaleString()} G</span></div>
        <div class="inv-grid">${bagHTML}</div>
        <div class="inv-actions"><div class="item-slot big" data-drop="trash" style="border-style:dashed;font-size:11px;width:auto;padding:0 14px;color:var(--arc-text-mute)">🗑 Drop here</div>
          ${this.host.sortBag ? '<button class="arc-btn small" data-act="sortbag">Sort</button>' : ''}</div>
        <div class="arc-msg"></div>
      </div></div>`;
    const b = this._frame('inventory', el);
    void b;
  }

  // ---------------------------------------------------------------- SKILLS
  _layoutSkills(list) {
    // depth by requirements, then spread per depth row
    const byId = new Map(list.map((s) => [s.id, s]));
    const depth = (s, seen = new Set()) => {
      if (s._d != null) return s._d;
      if (seen.has(s.id)) return 0; seen.add(s.id);
      const reqs = (s.requires || []).map((r) => byId.get(typeof r === 'object' ? r.id : r)).filter(Boolean);
      s._d = reqs.length ? 1 + Math.max(...reqs.map((r) => depth(r, seen))) : 0;
      return s._d;
    };
    const rows = new Map();
    for (const s of list) {
      if (s.row == null) s._row = depth(s); else s._row = s.row;
      if (!rows.has(s._row)) rows.set(s._row, []);
      rows.get(s._row).push(s);
    }
    const maxCols = Math.max(...[...rows.values()].map((r) => r.length), 1);
    for (const [, r] of rows) r.forEach((s, i) => { s._col = s.col != null ? s.col : (i + (maxCols - r.length) / 2); });
    return { maxCols: Math.max(maxCols, ...list.map((s) => (s._col || 0) + 1)), maxRow: Math.max(...list.map((s) => s._row), 0) };
  }
  _skillKindMeta(sel) {
    const bits = [];
    if (sel.kind === 'imbue') bits.push('Instant \u00B7 Imbue');
    else if (sel.kind === 'chain') bits.push((Array.isArray(sel.chain) && sel.chain.length ? sel.chain.length : 3) + '-hit chain');
    const st = Array.isArray(sel.status) ? sel.status : sel.status ? [sel.status] : [];
    for (const x of st) {
      const id = typeof x === 'object' ? (x.id || x.status) : x; if (!id) continue;
      const ch = typeof x === 'object' && x.chance != null ? x.chance : null;
      const nm = (STATUS[id] && STATUS[id].name) || id;
      bits.push(`Applies ${esc(nm)}${ch != null ? ' (' + Math.round(ch <= 1 ? ch * 100 : ch) + '%)' : ''}`);
    }
    return bits.length ? bits.map((b) => (/^Applies /.test(b) ? b : esc(b))).join(' \u00B7 ') + ' \u00B7 ' : '';
  }
  _rSkills() {
    const p = this.host.getPlayer() || {};
    const S = this.state;
    const all = (this.host.getSkills() || []).map((s) => ({ ...s, _d: null }));
    const trees = [...new Set(all.map((s) => s.tree || (s.type === 'passive' ? 'Passive' : 'Battle')))];
    if (!S.tab || !trees.includes(S.tab)) S.tab = trees[0];
    const list = all.filter((s) => (s.tree || (s.type === 'passive' ? 'Passive' : 'Battle')) === S.tab);
    const bar = this.host.getSkillBar ? this.host.getSkillBar() : [];
    const slotOf = (id) => bar.findIndex((b) => b && b.skillId === id);
    const el = h('div', 'skill-layout');
    if (!list.length) { el.innerHTML = '<div class="arc-empty">No skills available.</div>'; this._frame('skills', el); return; }
    const { maxCols, maxRow } = this._layoutSkills(list);
    const CW = 110, RH = maxRow >= 4 ? 84 : 100, PX = 50, PY = 40;
    const W = PX * 2 + (maxCols - 1) * CW + 60, H = PY * 2 + maxRow * RH + 60;
    const pos = (s) => ({ x: PX + s._col * CW + 30, y: PY + s._row * RH + 30 });
    const byId = new Map(list.map((s) => [s.id, s]));
    let lines = '', nodes = '';
    for (const s of list) {
      for (const r of s.requires || []) {
        const rs = byId.get(typeof r === 'object' ? r.id : r); if (!rs) continue;
        const a = pos(rs), b = pos(s);
        lines += `<line class="${rs.level > 0 ? 'lit' : ''}" x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}"/>`;
      }
    }
    for (const s of list) {
      const q = pos(s);
      const cls = ['skill-node', s.type === 'passive' ? 'passive' : '', s.level >= s.maxLevel ? 'maxed' : s.level > 0 ? 'learned' : '', s.canLevel ? 'can' : '', s.level <= 0 && !s.canLevel ? 'locked' : '', S.skill === s.id ? 'selected' : ''].join(' ');
      const sl = slotOf(s.id);
      nodes += `<div class="${cls}" style="left:${q.x - 30}px;top:${q.y - 30}px" data-act="skillsel" data-id="${esc(s.id)}" title="${esc(s.name)}">${renderIconHTML(s.icon, '✨')}
        <span class="slv">${s.level}/${s.maxLevel}</span>${sl >= 0 ? `<span class="skey">${esc(bar[sl].key || sl + 1)}</span>` : ''}</div>`;
    }
    const sel = list.find((s) => s.id === S.skill) || list.find((s) => s.canLevel) || list[0];
    S.skill = sel.id;
    const tabs = trees.length > 1 ? `<div class="arc-tabs">${trees.map((t) => `<div class="arc-tab ${t === S.tab ? 'active' : ''}" data-act="tab" data-tab="${esc(t)}">${esc(t)}</div>`).join('')}</div>` : '';
    const sl = slotOf(sel.id);
    const slotsHTML = sel.type === 'passive' ? '<div style="color:var(--arc-text-mute);font-size:12px">Passive skills are always active.</div>' :
      `<div style="font-size:11px;color:var(--arc-text-mute)">Assign to hotkey slot:</div><div class="hotkey-row">${[0, 1, 2, 3, 4].map((i) =>
        `<button class="hk-btn ${sl === i ? 'cur' : ''} ${sel.level > 0 ? '' : 'dis'}" data-act="skillslot" data-id="${esc(sel.id)}" data-slot="${i}" ${sel.level > 0 ? '' : 'disabled'}>${esc((bar[i] && bar[i].key) || i + 1)}</button>`).join('')}</div>`;
    const maxed = sel.level >= sel.maxLevel;
    el.innerHTML = `<div class="skill-head"><div>${tabs}</div>
        <div>Skill Points: <b class="arc-gold">${p.skillPoints | 0}</b> &nbsp; SP: <b style="color:var(--arc-sp-hi)">${Math.floor(p.sp || 0)}/${p.maxSp || 0}</b></div></div>
      <div class="skill-tree-wrap arc-scroll"><div class="skill-tree-inner" style="width:${W}px;height:${H}px">
        <svg width="${W}" height="${H}">${lines}</svg>${nodes}</div></div>
      <div class="skill-detail"><div>
        <h4>${renderIconHTML(sel.icon, '✨')} ${esc(sel.name)} <small style="color:var(--arc-text-mute)">${esc(sel.type || '')} · Lv ${sel.level}/${sel.maxLevel}</small></h4>
        <p>${esc(sel.desc || '')}</p>
        <p class="sd-meta">${this._skillKindMeta(sel)}${sel.spCost ? 'SP cost ' + sel.spCost + ' · ' : ''}${sel.cooldown ? 'Cooldown ' + sel.cooldown + 's · ' : ''}${sel.reqLevel ? 'Req. Lv ' + sel.reqLevel : ''}${sel.requires && sel.requires.length ? ' · Requires: ' + sel.requires.map((r) => esc((byId.get(typeof r === 'object' ? r.id : r) || {}).name || (typeof r === 'object' ? r.id : r))).join(', ') : ''}</p>
        ${sel.reason && !sel.canLevel && !maxed ? `<p style="color:var(--arc-bad)">${esc(sel.reason)}</p>` : ''}
      </div><div class="skill-actions">
        <button class="arc-btn good" data-act="skilllearn" data-id="${esc(sel.id)}" ${sel.canLevel ? '' : 'disabled'}>${maxed ? 'Max Level' : sel.level > 0 ? 'Level Up' : 'Learn'}</button>
        ${slotsHTML}</div></div><div class="arc-msg"></div>`;
    this._frame('skills', el);
  }

  // --------------------------------------------------------------- ALCHEMY WORKSHOP
  _rCompose() {
    this._rAlchemy();
  }

  _alchFind(uid) {
    if (uid == null) return null;
    const inv = this.host.getInventory() || { bag: [], equipment: {} };
    return [...Object.values(inv.equipment || {}), ...(inv.bag || [])].find((q) => q && String(q.uid) === String(uid)) || null;
  }

  _alchCount(id, kind) {
    if (!id && !kind) return 0;
    const inv = this.host.getInventory() || { bag: [] };
    let n = 0;
    for (const q of inv.bag || []) {
      if (!q) continue;
      if (id && (q.id === id || q.baseId === id || q.templateId === id || q.itemId === id || q.code === id)) {
        n += q.count || 1;
      } else if (kind && (q.subtype === 'elixir' || q.type === 'elixir') && (q.elixirKind === kind || q.kind === kind)) {
        n += q.count || 1;
      }
    }
    return n;
  }

  _alchSelect(uid) {
    this._alchCancel();
    this.state.alchUid = String(uid); this.state.alchRes = null;
    this._render();
  }

  _alchCancel(silent) {
    const f = this._fuse; if (!f) return;
    cancelAnimationFrame(f.raf); this._fuse = null;
    if (!silent) this._say('Enhancement cancelled.', false);
  }

  _alchOpts() { return { powder: !!this.state.alchPowder, talisman: !!this.state.alchTalisman }; }

  _alchStart() {
    const S = this.state;
    if (this._fuse || !S.alchUid) return;
    const it = this._alchFind(S.alchUid); if (!it) return;
    S.alchRes = null;
    const uid = String(S.alchUid), opts = this._alchOpts();
    const f = this._fuse = { uid, opts, t0: performance.now(), dur: ALCHEMY.fuseSeconds * 1000, raf: 0 };
    this._render();
    const tick = () => {
      if (this._fuse !== f) return;
      if (!this.current || this.current !== 'compose' || this.state.alchUid !== uid || !this._alchFind(uid)) { this._alchCancel(true); return; }
      const k = Math.min(1, (performance.now() - f.t0) / f.dur);
      const fill = this.modal.querySelector('#alc-fill'), lbl = this.modal.querySelector('#alc-fuse-t');
      if (fill) fill.style.width = (k * 100).toFixed(1) + '%';
      if (lbl) lbl.textContent = Math.max(0, (f.dur * (1 - k)) / 1000).toFixed(1) + 's';
      if (k >= 1) { this._fuse = null; this._alchFinish(uid, opts); return; }
      f.raf = requestAnimationFrame(tick);
    };
    f.raf = requestAnimationFrame(tick);
  }

  _alchFinish(uid, opts) {
    const S = this.state;
    const before = this._alchFind(uid);
    const name = before ? before.name : 'Item';
    let r;
    try { r = this.host.alchemy(uid, opts); } catch (e) { console.error(e); r = { ok: false, msg: String(e.message || e) }; }
    r = r || {};
    const ran = r.ok !== false;
    const success = ran && r.success !== false && (r.success === true || r.success === undefined);
    const after = this._alchFind(uid);
    const plus = r.plus != null ? r.plus : (after && after.plus) | 0;
    const prev = r.prevPlus != null ? r.prevPlus : (before && before.plus) | 0;
    const text = r.msg || (!ran ? 'Not possible.' : success ? `+${plus}!` : 'The enhancement failed.');
    S.alchRes = { ran, success: ran && success, plus, text };
    S.flash = !ran ? null : success ? 'success' : 'fail';
    if (ran) {
      this._alchHist = [{ ok: success, name, from: prev, to: plus, chance: r.chance }, ...(this._alchHist || [])].slice(0, 5);
    } else this._toast(text, 'warn');
    this._render();
    if (S.flash) {
      setTimeout(() => {
        if (this.state && this.state.flash) {
          this.state.flash = null;
          this._render();
        }
      }, 1200);
    }
  }

  _rAlchemy() {
    const S = this.state, host = this.host;
    const inv = host.getInventory() || { bag: [], equipment: {} };
    const gear = [...Object.values(inv.equipment || {}).filter(Boolean), ...(inv.bag || []).filter(isEquipItem)];
    let it = this._alchFind(S.alchUid);
    if (it && !isEquipItem(it)) it = null;
    if (!it) S.alchUid = null;
    const fusing = !!this._fuse;
    const poolHTML = gear.map((g) => this._slotHTML(g, { drag: true, selected: it && String(g.uid) === String(it.uid) })).join('') || '<div class="arc-empty" style="grid-column:1/-1">No equipment.</div>';

    let pv = null;
    if (it) {
      try { pv = host.previewAlchemy ? host.previewAlchemy(it.uid, this._alchOpts()) : null; } catch (e) { pv = { ok: false, reason: String(e.message || e) }; }
      pv = pv || { ok: false, reason: 'Preview unavailable.' };
    }
    const kind = it ? elixirKindForSlot(it.slot) : 'weapon';
    const recipeKind = kind === 'accessory' ? 'accessary' : (kind || 'weapon');
    const elixirIcon = `/assets/sro/icons/etc/archemy_reinforce_recipe_${recipeKind}_b.png`;
    const powderIcon = '/assets/sro/icons/etc/archemy_reinforce_prob_up_a.png';
    const talismanIcon = '/assets/sro/icons/etc/scroll_return_01.png';

    const elixirId = (pv && pv.elixirId) || (kind ? 'elixir_' + kind : '');
    const grade = it ? powderGradeForTier(it.tier != null ? it.tier : 0) : 1;
    const powderId = (pv && pv.powderId) || 'powder_' + grade;
    const talId = (pv && pv.talismanId) || 'guardian_talisman';

    const nElix = it ? (pv && typeof pv.haveElixir === 'number' ? pv.haveElixir : this._alchCount(elixirId, kind)) : 0;
    const nPow = it ? (pv && typeof pv.havePowder === 'number' ? pv.havePowder : this._alchCount(powderId)) : 0;
    const nTal = it ? (pv && typeof pv.haveTalisman === 'number' ? pv.haveTalisman : this._alchCount(talId)) : 0;

    if (S.alchPowder && nPow <= 0) S.alchPowder = false;
    if (S.alchTalisman && nTal <= 0) S.alchTalisman = false;

    const maxed = it && (it.plus | 0) >= ALCHEMY.maxPlus;
    const target = pv && pv.targetPlus != null ? pv.targetPlus : it ? (it.plus | 0) + 1 : 0;
    const powderBonus = ALCHEMY.powderBonus[Math.max(0, Math.min(ALCHEMY.maxPlus - 1, target - 1))] || 0;

    let chance = null;
    if (pv) {
      if (pv.chance != null) chance = pv.legacy && pv.chance <= 1 ? pv.chance * 100 : pv.chance;
      else if (it && !pv.legacy) chance = alchemyChance(target, { powder: !!S.alchPowder });
    }
    const chCls = chance == null ? '' : chance >= 60 ? 'hi' : chance >= 30 ? 'mid' : 'lo';
    const okp = !!it && !maxed && pv && pv.ok !== false && nElix > 0 || !!(pv && pv.legacy && pv.ok);
    const stats = pv && pv.statPreview ? Object.entries(pv.statPreview).filter(([, v]) => Array.isArray(v)) : [];
    const statHTML = stats.map(([k, v]) => `<div class="tip-stat"><span>${esc(labelOf(k))}</span><span>${esc(fmtStat(k, v[0]))} <b class="alc-arrow">→</b> <b class="alc-up">${esc(fmtStat(k, v[1]))}</b></span></div>`).join('');
    const failTxt = (pv && pv.failText) || (S.alchTalisman ? 'On failure: Item loses 1 level (Protected by Guardian Talisman).' : 'On failure: Item returns to +0 (Never breaks).');

    const hist = (this._alchHist || []).map((x) => `<li class="${x.ok ? 'ok' : 'bad'}">${x.ok ? '✔' : '✖'} ${esc(x.name)} +${x.from | 0} → +${x.to | 0}${x.chance != null ? ` <small>(${Math.round(x.chance)}%)</small>` : ''}</li>`).join('') || '<li class="none">No attempts yet.</li>';
    const rs = S.alchRes;
    const resHTML = rs ? (rs.ran ? `<div class="alc-result ${rs.success ? 'ok' : 'bad'}">${rs.success ? `<div class="alc-big">+${rs.plus | 0}!</div>` : '<div class="alc-big">✖ Failed</div>'}<div>${esc(rs.text)}</div></div>` : `<div class="alc-result bad">${esc(rs.text)}</div>`) : '';
    const frac = fusing ? Math.min(1, (performance.now() - this._fuse.t0) / this._fuse.dur) : 0;

    const el = h('div', 'alcm-workshop');
    el.innerHTML = `
      <div class="alchemy-layout">
        <div class="alcm-sidebar">
          <div class="arc-section-title">Equipment — Click to Select</div>
          <div class="compose-pool arc-scroll">${poolHTML}</div>
          <div class="arc-section-title" style="margin-top:10px">Recent Attempts</div>
          <ul class="alc-hist arc-scroll">${hist}</ul>
        </div>
        <div class="alcm-main-area">
          <div class="alcm-info">
            <div class="alcm-info-lines">
              <div class="alcm-title">Equipment Reinforcement (+N Enhancement)</div>
              <div class="alcm-target ${it && it.plus ? 'plus' : ''}">
                ${it ? `${esc(it.name)} ${it.plus ? `+${it.plus}` : '+0'} → <b class="alcm-plus-next">+${target}</b>` : '<span style="color:#78350f">Select equipment from left to enhance</span>'}
              </div>
              <div class="alcm-chance-line">
                ${it ? (maxed ? '<span style="color:#b45309">Maximum +10 enhancement reached</span>' : `Success Chance: <b class="alcm-chance-val ${chCls}">${chance != null ? Math.round(chance) + '%' : '—'}</b>${pv && pv.cost != null ? ` · Cost: <b class="arc-gold">${pv.cost} G</b>` : ''}`) : 'Place equipment and Elixir in chamber to preview'}
              </div>
              <div class="alcm-warn">${failTxt}</div>
            </div>
          </div>

          <div class="alcm-stage">
            <div class="alcm-panel">
              <!-- Animated 4x4 Sprite Sheet Overlay over rune circle -->
              ${fusing ? '<div class="alcm-sprite-fx prepare"></div>' :
                S.flash === 'success' ? '<div class="alcm-sprite-fx success"></div>' :
                S.flash === 'fail' ? '<div class="alcm-sprite-fx fail"></div>' : ''}

              <!-- Equipment Rune Circle Slot -->
              <div class="alcm-slot alcm-slot-item" data-drop="alchemy" title="${it ? esc(it.name) : 'Rune Circle: Place Equipment Here'}">
                ${it ? this._slotHTML(it, { big: true }) : '<div class="item-slot big alcm-ph"><span class="slot-ph">Gear</span></div>'}
              </div>

              <!-- Elixir Slot -->
              <div class="alcm-slot alcm-slot-elixir ${nElix > 0 ? '' : 'empty'}" title="${esc(KIND_NAME[kind] || 'Weapon')} Elixir (x${nElix})">
                <div class="item-slot has">
                  <span>${renderIconHTML(elixirIcon, '⚗️')}</span>
                  <span class="cnt">x${nElix}</span>
                </div>
              </div>

              <!-- Luck Powder Slot (toggleable) -->
              <div class="alcm-slot alcm-slot-powder ${S.alchPowder ? 'active' : ''} ${nPow > 0 ? '' : 'empty'}" data-act="alchpowder" title="Luck Powder Grade ${grade} (+${powderBonus}%) [Click to toggle]">
                <div class="item-slot has ${S.alchPowder ? 'selected' : ''}">
                  <span>${renderIconHTML(powderIcon, '✨')}</span>
                  <span class="cnt">x${nPow}</span>
                  ${S.alchPowder ? '<span class="alcm-badge-on">ON</span>' : ''}
                </div>
              </div>

              <!-- Guardian Talisman Slot (toggleable) -->
              <div class="alcm-slot alcm-slot-talisman ${S.alchTalisman ? 'active' : ''} ${nTal > 0 ? '' : 'empty'}" data-act="alchtalisman" title="Guardian Talisman (Protects from reset to +0) [Click to toggle]">
                <div class="item-slot has ${S.alchTalisman ? 'selected' : ''}">
                  <span>${renderIconHTML(talismanIcon, '🧿')}</span>
                  <span class="cnt">x${nTal}</span>
                  ${S.alchTalisman ? '<span class="alcm-badge-on">ON</span>' : ''}
                </div>
              </div>

              <!-- Closed Frame Slot (4th material slot) -->
              <div class="alcm-slot alcm-slot-closed" title="Closed Slot">
                <img src="/assets/sro/alchemy/alcm_slot_closed.png" alt="" draggable="false"/>
              </div>

              <!-- Fuse / Cancel Button -->
              <button class="alcm-fuse-btn ${fusing ? 'fusing' : ''}" data-act="${fusing ? 'alchcancel' : 'alchgo'}" ${okp && !fusing ? '' : fusing ? '' : 'disabled'} title="${fusing ? 'Cancel Enhancement' : 'Fuse Materials'}">
                <span>${fusing ? 'Cancel' : 'Fuse'}</span>
              </button>
            </div>
          </div>

          ${fusing ? `<div class="alc-fuse"><div class="alc-fuse-bar"><div class="alc-fuse-fill" id="alc-fill" style="width:${(frac * 100).toFixed(1)}%"></div></div><span id="alc-fuse-t">${((1 - frac) * ALCHEMY.fuseSeconds).toFixed(1)}s</span></div>` : ''}
          ${resHTML}
          ${statHTML ? `<div class="alc-stats">${statHTML}</div>` : ''}
          <div class="arc-msg"></div>
        </div>
      </div>`;

    this._frame('compose', el, 'alcm-modal-frame');
  }

  // ---------------------------------------------------------------- QUESTS
  _rQuests() {
    const S = this.state; const q = this.host.getQuests() || {};
    const groups = [['ready', 'Ready to Turn In'], ['active', 'Active'], ['available', 'Available'], ['completed', 'Completed']];
    const all = {}; for (const [k] of groups) for (const x of q[k] || []) all[x.id] = { ...x, _st: k };
    if (!S.quest || !all[S.quest]) S.quest = Object.keys(all)[0];
    const el = h('div');
    let list = '';
    for (const [k, label] of groups) {
      const arr = q[k] || []; if (!arr.length) continue;
      list += `<div class="arc-section-title">${label} (${arr.length})</div>` + arr.map((x) => `<div class="quest-item ${k} ${S.quest === x.id ? 'selected' : ''}" data-act="questsel" data-id="${esc(x.id)}">${esc(x.name)}</div>`).join('');
    }
    const sel = all[S.quest];
    let detail = '<div class="arc-empty">No quests yet. Talk to villagers to find work.</div>';
    if (sel) {
      const rw = sel.rewards || {};
      const objs = (sel.objectives || []).map((o) => `<div class="quest-obj ${o.current >= o.target ? 'done' : ''}"><span>${esc(o.text)}</span><span>${o.current ?? 0}/${o.target ?? 1}</span></div>`).join('');
      const items = (rw.items || []).map((i) => esc(typeof i === 'string' ? i : (i.name || i.id) + (i.count > 1 ? ' x' + i.count : ''))).join(', ');
      detail = `<div class="quest-detail"><h3>${esc(sel.name)}</h3><p style="color:var(--arc-text-dim);margin-bottom:8px">${esc(sel.desc || '')}</p>
        <div class="arc-section-title">Objectives</div>${objs || '<div style="color:var(--arc-text-mute)">—</div>'}
        <div class="quest-rewards">${rw.exp ? `<span>⭐ ${rw.exp} EXP</span>` : ''}${rw.gold ? `<span class="arc-gold">🪙 ${rw.gold} G</span>` : ''}${items ? `<span>🎁 ${items}</span>` : ''}</div>
        <div class="inv-actions" style="margin-top:12px">
          ${sel._st === 'available' ? `<button class="arc-btn good" data-act="questaccept" data-id="${esc(sel.id)}">Accept</button>` : ''}
          ${sel._st === 'ready' ? `<button class="arc-btn good" data-act="questturn" data-id="${esc(sel.id)}">Turn In</button>` : ''}
          ${sel._st === 'active' && this.host.abandonQuest ? `<button class="arc-btn danger small" data-act="questabandon" data-id="${esc(sel.id)}">Abandon</button>` : ''}
        </div></div>`;
    }
    el.innerHTML = `<div class="quest-layout"><div class="quest-list arc-scroll">${list || '<div class="arc-empty">—</div>'}</div>${detail}</div><div class="arc-msg"></div>`;
    this._frame('quests', el);
  }

  // ---------------------------------------------------------------- FLOORS
  _rFloors() {
    const fl = this.host.getFloors ? this.host.getFloors() : [];
    const p = this.host.getPlayer() || {};
    const el = h('div');
    el.innerHTML = `<div style="margin-bottom:8px;color:var(--arc-text-dim)">Choose a dungeon floor. Cleared floors unlock deeper ones.</div>
      <div class="floor-grid arc-scroll">${fl.map((f) => `<div class="floor-card ${f.unlocked ? '' : 'locked'} ${f.current ? 'current' : ''}" ${f.unlocked ? `data-act="floor" data-floor="${f.floor}"` : ''}>
        <div class="fnum">${f.floor === 0 ? '🏠' : f.floor}</div><div class="fname">${esc(f.name || 'Floor ' + f.floor)}</div>
        <div class="frec" style="${p.level < f.recommendedLevel ? 'color:var(--arc-bad)' : ''}">${f.recommendedLevel ? 'Rec. Lv ' + f.recommendedLevel : ''}</div>
        ${f.bossName ? `<div class="frec">☠ ${esc(f.bossName)}</div>` : ''}</div>`).join('') || '<div class="arc-empty">No floors available.</div>'}</div><div class="arc-msg"></div>`;
    this._frame('map', el);
  }

  // -------------------------------------------------------------- DIALOGUE
  _rDialogue() {
    const S = this.state; let d = this.data || {};
    if (!S.dlg) {
      if (!d.lines && d.npcId && this.host.getDialogue) d = { ...this.host.getDialogue(d.npcId), ...d, npcId: d.npcId };
      if (/storage|stash|bram/i.test(String(d.npcId || d.name || '')) && Array.isArray(d.options) && !d.options.some((o) => o && o.action === 'storage')) {
        d = { ...d, options: [{ label: 'Open Storage Vault', action: 'storage' }, ...d.options] };
      }
      S.dlg = { d, i: 0, typed: 0, done: false, npcId: d.npcId };
      this._dlgType();
    }
    this._dlgDraw();
  }
  _dlgDraw() {
    const { d, i, typed } = this.state.dlg;
    const lines = d.lines && d.lines.length ? d.lines : ['…'];
    const line = lines[Math.min(i, lines.length - 1)];
    const last = i >= lines.length - 1;
    const full = typed >= line.length;
    const el = h('div', 'dlg-wrap');
    const opts = (d.options || []);
    const optsHTML = last && full ? opts.map((o, k) => `<button class="arc-btn" data-act="dlgopt" data-i="${k}">${esc(o.label || o.text || o.id || '…')}</button>`).join('') + (opts.some((o) => /leave|bye|close|goodbye/i.test(o.label || '')) ? '' : '<button class="arc-btn danger" data-act="close">Leave</button>') : '';
    el.innerHTML = `<div class="arc-modal-title"><span>${esc(d.name || 'Villager')}</span><button class="arc-close" data-act="close">✕</button></div>
      <div style="padding:16px"><div class="dlg-box"><div class="dlg-portrait">${esc(d.icon || '🧑')}</div>
      <div class="dlg-text" data-act="dlgnext">${esc(line.slice(0, typed))}${full ? '' : '<span class="caret">▌</span>'}${full && !last ? ' <span class="caret">▼</span>' : ''}</div></div>
      <div class="dlg-options">${optsHTML}</div></div>`;
    this.modal.className = 'arc-modal arc-frame dlg-modal';
    this.modal.textContent = ''; this.modal.appendChild(el);
  }
  _dlgType() {
    const S = this.state; clearInterval(this._dlgT);
    this._dlgT = setInterval(() => {
      const dl = S.dlg; if (!dl || this.current !== 'dialogue') { clearInterval(this._dlgT); return; }
      const lines = dl.d.lines && dl.d.lines.length ? dl.d.lines : ['…'];
      const line = lines[Math.min(dl.i, lines.length - 1)];
      if (dl.typed < line.length) { dl.typed = Math.min(line.length, dl.typed + 2); this._dlgDraw(); } else clearInterval(this._dlgT);
    }, 22);
  }
  _dlgAdvance() {
    const dl = this.state.dlg; if (!dl) return;
    const lines = dl.d.lines && dl.d.lines.length ? dl.d.lines : ['…'];
    const line = lines[Math.min(dl.i, lines.length - 1)];
    if (dl.typed < line.length) { dl.typed = line.length; clearInterval(this._dlgT); this._dlgDraw(); return; }
    if (dl.i < lines.length - 1) { dl.i++; dl.typed = 0; this._dlgType(); this._dlgDraw(); return; }
    if (!(dl.d.options && dl.d.options.length)) this.closeAll();
  }
  _dlgOption(k) {
    const dl = this.state.dlg; const o = dl && dl.d.options && dl.d.options[k]; if (!o) return;
    const fn = o.cb || o.onSelect || o.callback || (typeof o.action === 'function' ? o.action : null);
    const act = typeof o.action === 'string' ? o.action : (o.id || '');
    const npc = dl.npcId;
    if (fn) { const r = fn(o); if (r && r.lines) { this.state.dlg = null; this.data = { ...r, npcId: npc }; this._render(); } else if (r !== false && !this.current) return; else if (r === 'keep') return; else this.closeAll(); return; }
    const a = String(act).toLowerCase();
    if (/^(close|leave|bye|exit|goodbye)/.test(a) || !a) { this.closeAll(); return; }
    if (/shop|buy|sell|store/.test(a)) { this.state = {}; this.openShop({ npcId: npc, shopId: o.shopId || a.split(':')[1] || npc }); return; }
    if (/compose|synth|forge/.test(a)) { this.state = {}; this.openMenu('compose'); return; }
    if (/quest/.test(a) && !/:/.test(a)) { this.state = {}; this.openMenu('quests'); return; }
    if (/map|floor|teleport|portal|dungeon/.test(a)) { this.state = {}; this.openMenu('map'); return; }
    if (/skill/.test(a)) { this.state = {}; this.openMenu('skills'); return; }
    if (/storage|stash|vault/.test(a)) { this.state = {}; this.openMenu('storage'); return; }
    if (/bag|inventory/.test(a)) { this.state = {}; this.openMenu('inventory'); return; }
    if (/heal|rest|save/.test(a) && this.host.npcAction) { const r = this.host.npcAction(npc, act, o); if (r && r.msg) this._toast(r.msg, r.ok === false ? 'warn' : 'info'); this.closeAll(); return; }
    // quest actions like accept:<id> / turnin:<id> or anything else -> host
    const r = this.host.npcAction ? this.host.npcAction(npc, act, o) : null;
    if (r && (r.openMenu || r.open || r.menu)) {
      const target = r.openMenu || r.open || r.menu;
      this.state = {};
      if (target === 'shop') this.openShop({ npcId: npc, shopId: r.shopId || npc });
      else this.openMenu(target, r);
      return;
    }
    if (r && r.lines) { this.state.dlg = null; this.data = { ...r, npcId: npc }; this._render(); return; }
    if (r && r.msg) this._toast(r.msg, r.ok === false ? 'warn' : 'quest');
    this.closeAll();
  }

  // --------------------------------------------------------------- STORAGE
  _rStorage() {
    const st = (this.host.getStorage && this.host.getStorage()) || { items: [], size: 40 };
    const inv = this.host.getInventory() || { bag: [], bagSize: 40, gold: 0 };
    const stItems = (st.items || []).filter(Boolean);
    const stSize = Math.max(st.size || st.capacity || 40, stItems.length);
    let vaultHTML = '';
    for (let i = 0; i < stSize; i++) vaultHTML += this._slotHTML(stItems[i]);
    const el = h('div');
    el.innerHTML = `<div class="inv-layout">
      <div><div class="arc-section-title">Storage Vault (${stItems.length}/${stSize}) — click to withdraw</div>
        <div class="inv-grid" style="grid-template-columns:repeat(5,48px)">${vaultHTML}</div></div>
      <div><div class="arc-section-title">Your Bag (${inv.bag.length}/${inv.bagSize || 40}) — click to deposit</div>
        <div class="inv-grid">${inv.bag.map((it) => this._slotHTML(it)).join('') || '<div class="arc-empty" style="grid-column:1/-1">Bag is empty</div>'}</div></div>
    </div><div class="arc-msg"></div>`;
    this._frame('storage', el);
  }
  _storageClick(it) {
    const st = (this.host.getStorage && this.host.getStorage()) || { items: [] };
    const inVault = (st.items || []).some((x) => x && String(x.uid) === String(it.uid));
    if (inVault) this._do(() => this.host.withdraw(it.uid));
    else this._do(() => this.host.deposit(it.uid));
  }

  // ------------------------------------------------------------------ SHOP
  _rShop() {
    const S = this.state; const d = this.data || {}; S.npcId = d.npcId || S.npcId;
    const shop = (this.host.getShop && this.host.getShop(d.shopId || S.npcId)) || { name: 'Shop', items: [] };
    const inv = this.host.getInventory() || { bag: [], gold: 0 };
    this._title = shop.name || 'Shop';
    const el = h('div');
    const rows = shop.items.map((it, i) => { this._reg({ ...it, uid: 'shop' + i }); return `<div class="shop-item r-${rarityOf(it)} ${inv.gold < (it.price || 0) ? 'poor' : ''}" data-act="buy" data-idx="${i}" data-uid="shop${i}">
        <div class="item-slot has r-${rarityOf(it)} ${it.classOk === false ? 'cls-bad' : ''}" style="width:40px;height:40px;font-size:22px">${renderIconHTML(itemIcon(it))}</div>
        <div><div class="si-name">${esc(it.name)}</div><div class="si-price">${it.price || 0} G</div></div></div>`; }).join('') || '<div class="arc-empty">Nothing for sale.</div>';
    el.innerHTML = `<div class="shop-layout"><div><div class="arc-section-title">For Sale</div><div class="shop-grid arc-scroll">${rows}</div></div>
      <div><div class="arc-section-title">Your Bag — click to sell</div>
        <div class="inv-grid" style="grid-template-columns:repeat(4,48px)">${inv.bag.map((it) => this._slotHTML(it)).join('') || '<div class="arc-empty" style="grid-column:1/-1">Empty</div>'}</div>
        <div style="margin-top:8px">Gold: <b class="arc-gold">${Math.floor(inv.gold || 0).toLocaleString()} G</b></div></div></div><div class="arc-msg"></div>`;
    this._frame('shop', el);
  }
  _shopClick(it, e) {
    if (String(it.uid).startsWith('shop')) return;
    this._do(() => this.host.sellItem(it.uid));
  }

  dispose() {
    window.removeEventListener('keydown', this._onKey, true);
    window.removeEventListener('arc-ui-menu', this._onMenuEvt);
    this._unsub.forEach((f) => f && f());
    this.overlay.remove(); this.tip.remove(); this.ctxMenu.remove();
  }
}

export function createMenus(root, ctx) { return new MenuManager(root, ctx); }
export { MenuManager as Menus };
export default MenuManager;

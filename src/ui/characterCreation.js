// ============================================================================
// ASJ - Title screen + character creation (owned by ui-hud). Plain DOM.
//   const r = await openCharacterCreation(root, { saves, createPreview, onDeleteSave });
//   r = { mode:'continue', slot } | { mode:'new', slot, name, classId, appearance }
// ============================================================================
import { CLASSES, CLASS_IDS, APPEARANCE_OPTIONS, defaultAppearance } from '../systems/classes.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const hex = (n) => '#' + (Number(n) >>> 0).toString(16).padStart(6, '0');
const mk = (tag, cls, html) => { const el = document.createElement(tag); if (cls) el.className = cls; if (html != null) el.innerHTML = html; return el; };

const WEAPON_TXT = { sword: 'Swords', mace: 'Maces', axe: 'Axes', staff: 'Staves', bow: 'Bows' };
const ATTRS = [['str', 'STR'], ['dex', 'DEX'], ['int', 'INT'], ['lck', 'LCK']];
const MOD_FMT = {
  atkPct: (v) => `+${v}% Attack`, matkPct: (v) => `+${v}% Magic Attack`, defPct: (v) => `+${v}% Defense`,
  hpPct: (v) => `+${v}% Max HP`, mpPct: (v) => `+${v}% Max SP`, mpRegen: (v) => `+${v} SP Regen`,
  block: (v) => `+${v}% Block`, critDmg: (v) => `+${v}% Crit Damage`, critRate: (v) => `+${v}% Crit Rate`,
  attackSpeedPct: (v) => `+${v}% Attack Speed`, dodge: (v) => `+${v}% Dodge`, moveSpeedPct: (v) => `+${v}% Move Speed`,
};
export function formatClassMods(mods) {
  return Object.keys(mods || {}).map((k) => (MOD_FMT[k] ? MOD_FMT[k](mods[k]) : `+${mods[k]} ${k}`));
}
const fmtDate = (t) => { try { return t ? new Date(t).toLocaleDateString() : ''; } catch (e) { return ''; } };
const randOf = (a) => a[Math.floor(Math.random() * a.length)];

const SWATCHES = [
  ['skin', 'Skin', 'skinTones'], ['hairColor', 'Hair Color', 'hairColors'], ['hairStyle', 'Hair Style', 'hairStyles'],
  ['outfit', 'Outfit', 'outfitColors'], ['cape', 'Cape', 'capeColors'], ['eyes', 'Eyes', 'eyeColors'],
];

export function openCharacterCreation(root, opts = {}) {
  root = root || document.body;
  const saves = Array.isArray(opts.saves) ? opts.saves : [];
  return new Promise((resolve) => {
    const S = { step: 'title', slot: 0, classId: 'knight', appearance: defaultAppearance('knight'), name: 'Hero', confirmDel: -1, confirmBegin: false };
    let preview = null, closed = false;
    const wrap = mk('div', 'asj-cc');
    const embers = mk('div', 'cc-embers');
    for (let i = 0; i < 18; i++) {
      const e = mk('i'); e.style.left = Math.random() * 100 + '%'; e.style.animationDelay = (-Math.random() * 12) + 's';
      e.style.animationDuration = (8 + Math.random() * 8) + 's'; e.style.setProperty('--sz', (2 + Math.random() * 3) + 'px');
      embers.appendChild(e);
    }
    const screen = mk('div', 'cc-screen');
    wrap.append(embers, screen);
    document.documentElement.classList.add('asj-creating');
    root.appendChild(wrap);

    const killPreview = () => { if (preview) { try { preview.dispose(); } catch (e) { /* ignore */ } preview = null; } };
    const finish = (res) => {
      if (closed) return; closed = true;
      window.removeEventListener('keydown', onKey, true);
      window.removeEventListener('resize', onResize);
      killPreview();
      wrap.remove();
      document.documentElement.classList.remove('asj-creating');
      resolve(res);
    };
    const onResize = () => { if (preview && preview.resize) { try { preview.resize(); } catch (e) { /* ignore */ } } };
    const look = () => { if (preview && preview.setLook) { try { preview.setLook({ classId: S.classId, appearance: { ...S.appearance } }); } catch (e) { /* ignore */ } } };

    function go(step) { S.step = step; S.confirmBegin = false; render(); }
    function back() {
      if (S.step === 'designer') go('class');
      else if (S.step === 'class') go('title');
    }
    function confirm() {
      if (S.step === 'class') pickClass(S.classId, true);
      else if (S.step === 'designer') begin();
    }
    function onKey(e) {
      if (closed) return;
      const t = e.target;
      const inInput = t && t.tagName === 'INPUT';
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); if (S.confirmBegin) { S.confirmBegin = false; render(); } else if (S.confirmDel >= 0) { S.confirmDel = -1; render(); } else back(); }
      else if (e.key === 'Enter') {
        if (S.step === 'title') return;
        e.preventDefault(); e.stopPropagation();
        if (inInput && S.step === 'designer') { t.blur(); }
        confirm();
      } else if (!inInput) e.stopPropagation();
    }
    function pickClass(id, advance) {
      if (S.classId !== id || !S.appearance) { S.classId = id; S.appearance = defaultAppearance(id); }
      if (advance) go('designer'); else render();
    }
    function begin() {
      if (!S.confirmBegin) { S.confirmBegin = true; renderDesigner(true); return; }
      const name = (S.name || '').trim().slice(0, 16) || 'Hero';
      finish({ mode: 'new', slot: S.slot, name, classId: S.classId, appearance: { ...S.appearance } });
    }

    // ------------------------------------------------------------ title
    function renderTitle() {
      killPreview();
      const cards = [0, 1, 2].map((i) => {
        const s = saves[i];
        if (s) {
          const c = CLASSES[s.classId];
          const conf = S.confirmDel === i;
          return `<div class="cc-slot has" style="--cc:${esc(c ? c.css : '#c9b27a')}">
            <div class="cc-slot-ico">${esc(s.classIcon || (c && c.icon) || '⚔️')}</div>
            <div class="cc-slot-name">${esc(s.name || 'Hero')}</div>
            <div class="cc-slot-sub">${esc(s.className || (c && c.name) || '')} · Level ${s.level | 0}</div>
            <div class="cc-slot-sub dim">Deepest floor B${s.maxFloor | 0}F${s.savedAt ? ' · ' + esc(fmtDate(s.savedAt)) : ''}</div>
            ${conf ? `<div class="cc-warn">Delete this hero forever?</div><div class="cc-row"><button class="cc-btn danger" data-a="delyes" data-i="${i}">Delete</button><button class="cc-btn" data-a="delno">Cancel</button></div>`
              : `<div class="cc-row"><button class="cc-btn primary" data-a="cont" data-i="${i}">Continue</button><button class="cc-btn danger" data-a="del" data-i="${i}">Delete</button></div>`}
          </div>`;
        }
        return `<div class="cc-slot empty"><div class="cc-slot-ico">✦</div><div class="cc-slot-name">New Hero</div>
          <div class="cc-slot-sub dim">Empty slot ${i + 1}</div><div class="cc-row"><button class="cc-btn primary" data-a="new" data-i="${i}">New Hero</button></div></div>`;
      }).join('');
      screen.innerHTML = `<div class="cc-title-wrap"><h1 class="cc-title">ARKENVEIL</h1><div class="cc-subtitle">SIGILS &amp; JOURNEYS</div></div>
        <div class="cc-slots">${cards}</div>`;
    }

    // ------------------------------------------------------------ class select
    function classCard(id) {
      const c = CLASSES[id];
      const bars = ATTRS.map(([k, l]) => `<div class="cc-attr"><span>${l}</span><div class="cc-attr-bar"><i style="width:${Math.min(100, (c.startAttrs[k] || 0) * 10)}%"></i></div><b>${c.startAttrs[k] | 0}</b></div>`).join('');
      const weapons = c.weapons.map((w) => WEAPON_TXT[w] || w).join(', ');
      const mods = formatClassMods(c.statMods).map((m) => `<li>${esc(m)}</li>`).join('');
      return `<div class="cc-class ${S.classId === id ? 'sel' : ''}" data-a="class" data-id="${esc(id)}" style="--cc:${esc(c.css)}">
        <div class="cc-class-ico">${esc(c.icon)}</div><div class="cc-class-name">${esc(c.name)}</div>
        <div class="cc-class-tag">${esc(c.tagline)}</div><div class="cc-class-desc">${esc(c.desc)}</div>
        <div class="cc-facts"><div><span>Weapons</span><b>${esc(weapons)}</b></div>
          <div><span>Shield</span><b class="${c.shield ? 'yes' : 'no'}">${c.shield ? '✓' : '✗'}</b></div>
          <div><span>Difficulty</span><b>${esc(c.difficulty)}</b></div></div>
        <div class="cc-attrs">${bars}</div><ul class="cc-mods">${mods}</ul></div>`;
    }
    function renderClass() {
      killPreview();
      screen.innerHTML = `<div class="cc-head"><button class="cc-btn" data-a="back">← Back</button><h2>Choose Your Class</h2><div class="cc-spacer"></div></div>
        <div class="cc-warn big">⚠ Your class is permanent and cannot be changed later.</div>
        <div class="cc-classes">${CLASS_IDS.map(classCard).join('')}</div>
        <div class="cc-foot"><button class="cc-btn primary big" data-a="tonext">Continue as ${esc(CLASSES[S.classId].name)} →</button></div>`;
    }

    // ------------------------------------------------------------ designer
    function swatchRow(key, label, listKey) {
      const list = APPEARANCE_OPTIONS[listKey] || [];
      const items = list.map((v, i) => {
        const on = S.appearance[key] === v;
        return key === 'hairStyle'
          ? `<button class="cc-style ${on ? 'on' : ''}" data-a="app" data-k="${key}" data-i="${i}">${esc(String(v).replace(/^./, (c) => c.toUpperCase()))}</button>`
          : `<button class="cc-sw ${on ? 'on' : ''}" data-a="app" data-k="${key}" data-i="${i}" style="background:${hex(v)}" title="${esc(hex(v))}"></button>`;
      }).join('');
      return `<div class="cc-swrow"><label>${esc(label)}</label><div class="cc-swatches">${items}</div></div>`;
    }
    function renderDesigner(keepInput) {
      const c = CLASSES[S.classId];
      if (keepInput && screen.querySelector('.cc-designer')) {
        const f = screen.querySelector('.cc-foot');
        f.innerHTML = footHTML();
        return;
      }
      killPreview();
      screen.innerHTML = `<div class="cc-head"><button class="cc-btn" data-a="back">← Back</button><h2>Design Your ${esc(c.name)}</h2><div class="cc-spacer"></div></div>
        <div class="cc-designer" style="--cc:${esc(c.css)}">
          <div class="cc-preview"><div class="cc-canvas-wrap"></div>
            <div class="cc-preview-cls">${esc(c.icon)} ${esc(c.name)}</div></div>
          <div class="cc-panel">
            <div class="cc-swrow"><label>Name</label><input class="cc-name" type="text" maxlength="16" value="${esc(S.name)}" spellcheck="false" autocomplete="off"></div>
            ${SWATCHES.map(([k, l, lk]) => swatchRow(k, l, lk)).join('')}
            <div class="cc-row"><button class="cc-btn" data-a="rand">🎲 Randomize</button><button class="cc-btn" data-a="reset">Reset to class default</button></div>
          </div></div>
        <div class="cc-warn big">⚠ Your class is permanent and cannot be changed later.</div>
        <div class="cc-foot">${footHTML()}</div>`;
      const cw = screen.querySelector('.cc-canvas-wrap');
      if (typeof opts.createPreview === 'function') {
        const canvas = mk('canvas', 'cc-canvas'); cw.appendChild(canvas);
        try { preview = opts.createPreview(canvas); } catch (e) { console.error(e); preview = null; }
        if (preview) { look(); requestAnimationFrame(onResize); }
      }
      if (!preview) cw.innerHTML = `<div class="cc-placeholder"><span>${esc(c.icon)}</span></div>`;
      updatePlaceholder();
      const inp = screen.querySelector('.cc-name');
      inp.addEventListener('input', () => { S.name = inp.value.slice(0, 16); });
    }
    function footHTML() {
      return S.confirmBegin
        ? `<span class="cc-confirm">Begin as <b>${esc((S.name || '').trim() || 'Hero')}</b> the ${esc(CLASSES[S.classId].name)}? This cannot be undone.</span>
           <button class="cc-btn danger" data-a="cancelbegin">Cancel</button><button class="cc-btn primary big" data-a="begin">Yes, Begin</button>`
        : `<button class="cc-btn primary big" data-a="begin">Begin Journey</button>`;
    }
    function updatePlaceholder() {
      const ph = screen.querySelector('.cc-placeholder');
      if (!ph) return;
      const a = S.appearance;
      ph.style.setProperty('--skin', hex(a.skin)); ph.style.setProperty('--outfit', hex(a.outfit));
      ph.style.setProperty('--cape', hex(a.cape)); ph.style.setProperty('--hair', hex(a.hairColor));
    }
    function refreshSwatches() {
      screen.querySelectorAll('[data-a="app"]').forEach((b) => {
        const lk = SWATCHES.find((s) => s[0] === b.dataset.k)[2];
        b.classList.toggle('on', APPEARANCE_OPTIONS[lk][+b.dataset.i] === S.appearance[b.dataset.k]);
      });
      updatePlaceholder(); look();
    }

    function render() {
      if (closed) return;
      screen.className = 'cc-screen step-' + S.step;
      if (S.step === 'title') renderTitle();
      else if (S.step === 'class') renderClass();
      else renderDesigner();
    }

    // ------------------------------------------------------------ events
    screen.addEventListener('click', (e) => {
      const el = e.target.closest('[data-a]');
      if (!el) return;
      const a = el.dataset.a, i = +el.dataset.i;
      switch (a) {
        case 'cont': finish({ mode: 'continue', slot: i }); break;
        case 'del': S.confirmDel = i; render(); break;
        case 'delno': S.confirmDel = -1; render(); break;
        case 'delyes':
          S.confirmDel = -1;
          try { if (opts.onDeleteSave) opts.onDeleteSave(i); } catch (err) { console.error(err); }
          saves[i] = null; render(); break;
        case 'new': S.slot = i; S.name = 'Hero'; go('class'); break;
        case 'class': pickClass(el.dataset.id, false); break;
        case 'tonext': pickClass(S.classId, true); break;
        case 'back': back(); break;
        case 'app': {
          const lk = SWATCHES.find((s) => s[0] === el.dataset.k)[2];
          S.appearance[el.dataset.k] = APPEARANCE_OPTIONS[lk][i]; refreshSwatches(); break;
        }
        case 'rand':
          for (const [k, , lk] of SWATCHES) S.appearance[k] = randOf(APPEARANCE_OPTIONS[lk]);
          refreshSwatches(); break;
        case 'reset': S.appearance = defaultAppearance(S.classId); refreshSwatches(); break;
        case 'begin': begin(); break;
        case 'cancelbegin': S.confirmBegin = false; renderDesigner(true); break;
        default: break;
      }
    });
    screen.addEventListener('dblclick', (e) => {
      const el = e.target.closest('[data-a="class"]');
      if (el) pickClass(el.dataset.id, true);
    });
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('resize', onResize);
    render();
  });
}

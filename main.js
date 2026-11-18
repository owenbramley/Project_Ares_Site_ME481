// Project Ares · Team DSLR
// 1. reveal on enter  2. the drop: scroll = altitude  3. size the chute  4. build index with preview

const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const g = 9.81;

/* ---------- 1. reveal once on enter; never leaves anything hidden ---------- */
(() => {
  const els = document.querySelectorAll('[data-reveal]');
  if (!('IntersectionObserver' in window)) { els.forEach((el) => el.classList.add('is-in')); return; }
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
  }, { rootMargin: '0px 0px -10% 0px', threshold: 0.08 });
  els.forEach((el) => io.observe(el));
  addEventListener('load', () => setTimeout(() => els.forEach((el) => {
    const r = el.getBoundingClientRect();
    if (r.top < innerHeight && r.bottom > 0) el.classList.add('is-in');
  }), 2500));
})();

/* ---------- 2. the drop ---------- */
(() => {
  const drop = document.querySelector('.drop');
  if (!drop || reduce) return;           // reduced motion keeps the plain sequence
  document.documentElement.classList.add('fly');

  const phases = [...drop.querySelectorAll('.phase')].map((li) => ({
    media: li.querySelector('.phase__media'),
    text: li.querySelector('.phase__text'),
    video: li.querySelector('video'),
  }));
  // each phase owns a slice of the scroll: [start, end]
  const starts = [0, 0.08, 0.19, 0.33, 0.50, 0.62, 0.72, 0.82, 0.91, 1.0];
  // altitude keyframes (progress, metres)
  const altKeys = [[0, 40], [0.06, 40], [0.12, 37], [0.22, 30], [0.40, 14], [0.56, 2.0], [0.66, 0]];
  // mission clock keyframes (progress, minutes after touchdown)
  const clockKeys = [[0.66, 0], [0.74, 10], [0.84, 11], [0.93, 12], [1, 13]];
  const VT = 3.95, H_CUT = 2.0, H_CHUTE = 36;

  const interp = (keys, p) => {
    if (p <= keys[0][0]) return keys[0][1];
    for (let i = 1; i < keys.length; i++) {
      if (p <= keys[i][0]) { const [p0, v0] = keys[i - 1], [p1, v1] = keys[i]; return lerp(v0, v1, (p - p0) / (p1 - p0)); }
    }
    return keys[keys.length - 1][1];
  };
  const speedAt = (h) => {
    if (h >= 40) return 0;
    if (h > H_CHUTE) return Math.sqrt(2 * g * (40 - h));
    const vOpen = Math.sqrt(2 * g * (40 - H_CHUTE));
    if (h > H_CUT) return VT + (vOpen - VT) * Math.exp(-(H_CHUTE - h) / 3);
    return Math.sqrt(VT * VT + 2 * g * (H_CUT - h));
  };

  const out = {
    value: drop.querySelector('[data-value]'),
    unit: drop.querySelector('[data-unit]'),
    speed: drop.querySelector('[data-speed]'),
    ground: drop.querySelector('.drop__ground'),
  };

  const ease = (t) => 1 - Math.pow(1 - t, 3);
  let ticking = false, last = -1;

  function frame() {
    ticking = false;
    const r = drop.getBoundingClientRect();
    const span = drop.offsetHeight - innerHeight;
    const p = clamp(-r.top / span, 0, 1);
    if (Math.abs(p - last) < 0.0002) return;
    last = p;

    // readout
    const h = interp(altKeys, p);
    if (p < 0.66) {
      out.value.textContent = h.toFixed(1);
      out.unit.textContent = 'm';
      const v = speedAt(h);
      out.speed.textContent = v < 0.05 ? 'Altitude, held under the drone' : `Altitude, falling at ${v.toFixed(1)} m/s`;
    } else {
      const m = interp(clockKeys, p);
      const mm = Math.floor(m), ss = Math.floor((m - mm) * 60);
      out.value.textContent = `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
      out.unit.textContent = '';
      out.speed.textContent = p < 0.68 ? 'Mission clock. Down at 7.4 m/s, upright' : 'Mission clock, on the ground';
    }

    // the ground rises as we fall: perspective-ish, it grows fast near the end
    const gh = h <= 0 ? 0.36 : 0.36 * (3 / (h + 3));
    out.ground.style.transform = `translateY(${((1 - gh) * 100).toFixed(2)}%)`;

    // each picture flies in from far away, holds, then rushes past; never two at once
    phases.forEach((ph, i) => {
      const s0 = starts[i], e0 = starts[i + 1];
      const t = (p - s0) / (e0 - s0);
      const lastOne = i === phases.length - 1;
      let op = 0, sc = 0.6, ty = 10, tx = 0, top = 0;
      if (t >= 0 && (t <= 1 || lastOne)) {
        const tt = Math.min(t, 1);
        const inK = ease(clamp(tt / 0.22, 0, 1));
        op = inK;
        sc = lerp(0.6, 1, ease(clamp(tt / 0.5, 0, 1)));
        ty = lerp(12, 0, ease(clamp(tt / 0.5, 0, 1)));
        if (!lastOne && tt > 0.82) {
          const k = (tt - 0.82) / 0.18;
          sc *= 1 + k * 0.3;
          ty -= k * 6;
          tx = k * 6;
          op *= 1 - k;
        }
        top = clamp(Math.min((tt - 0.08) / 0.14, (0.86 - tt) / 0.1), 0, 1);
        if (lastOne && tt > 0.2) top = clamp((tt - 0.08) / 0.14, 0, 1);
      }
      ph.media.style.opacity = op.toFixed(3);
      ph.media.style.visibility = op > 0.01 ? 'visible' : 'hidden';
      ph.media.style.transform = `translate3d(${tx.toFixed(2)}vw, ${ty.toFixed(2)}svh, 0) scale(${sc.toFixed(3)})`;
      ph.text.style.opacity = top.toFixed(3);
      ph.text.style.visibility = top > 0.01 ? 'visible' : 'hidden';
      ph.text.style.transform = `translate3d(0, ${((1 - top) * 18).toFixed(1)}px, 0)`;
      if (ph.video) {
        if (op > 0.05 && ph.video.paused) { ph.video.preload = 'auto'; ph.video.play().catch(() => {}); }
        else if (op <= 0.05 && !ph.video.paused) ph.video.pause();
      }
    });
  }
  const onScroll = () => { if (!ticking) { ticking = true; requestAnimationFrame(frame); } };
  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', () => { last = -1; onScroll(); });
  frame();
})();

/* ---------- 3. size the parachute ---------- */
(() => {
  const root = document.querySelector('.chute');
  if (!root) return;
  const $ = (id) => root.querySelector('#' + id);
  const show = (k, v) => { const el = root.querySelector(`[data-show="${k}"]`); if (el) el.textContent = v; };
  const put = (k, v) => { const el = root.querySelector(`[data-out="${k}"]`); if (el) el.textContent = v; };
  const RHO = 1.225;

  function update() {
    const m = +$('mass').value, d = +$('dia').value, hc = +$('cut').value;
    const cd = +root.querySelector('input[name="cd"]:checked').value;
    const A = Math.PI * (d / 2) ** 2;
    const vt = Math.sqrt((2 * m * g) / (RHO * cd * A));
    const vtd = Math.sqrt(vt * vt + 2 * g * hc);
    const ke = 0.5 * m * vtd * vtd;
    show('mass', m.toFixed(2)); show('dia', d.toFixed(2)); show('cut', hc.toFixed(1));
    put('vt', vt.toFixed(1)); put('vtd', vtd.toFixed(1)); put('ke', Math.round(ke)); put('area', A.toFixed(2));
    let verdict;
    if (vtd <= 5) verdict = 'Gentle. Well inside the limit, but that is a big canopy to pack.';
    else if (vtd <= 7.5) verdict = 'Inside the 8 m/s limit with room to spare.';
    else if (vtd <= 8.0) verdict = 'Inside the 8 m/s limit, just.';
    else verdict = `Too fast by ${(vtd - 8).toFixed(1)} m/s. Bigger canopy, or cut away lower.`;
    put('verdict', verdict);
    root.classList.toggle('is-fail', vtd > 8);
  }
  root.querySelectorAll('input').forEach((el) => el.addEventListener('input', update));
  update();
})();

/* ---------- 4. the build: rows bring up their picture ---------- */
(() => {
  const list = document.querySelector('[data-index]');
  const frame = document.querySelector('.index__frame');
  if (!list || !frame) return;
  const imgs = frame.querySelectorAll('.index__stage img');
  const cap = frame.querySelector('[data-caption]');
  const caps = [
    'Our shell panels on the waterjet, nested on one sheet.',
    'Our first panels, cut and bent.',
    'Blind rivets, the kind that hold our panels. Photo: Fructibus, CC0.',
    'One of our parts printing on a Prusa i3.',
    'Our electronics module in CAD: Pi 4 above, sensor boards below.',
    'The grass strip in Kailua, where the drops happen.',
  ];
  const rows = list.querySelectorAll('.index__row');
  const set = (n) => {
    rows.forEach((r) => r.classList.toggle('is-on', r.dataset.img === String(n)));
    imgs.forEach((im, i) => im.classList.toggle('is-on', i === n));
    cap.textContent = caps[n];
  };
  rows.forEach((r) => {
    r.addEventListener('pointerenter', () => set(+r.dataset.img));
    r.tabIndex = 0;
    r.addEventListener('focus', () => set(+r.dataset.img));
  });
})();

/* ---------- 5. the jump to status: shown after the hero, hidden over status and the drop ---------- */
(() => {
  const jump = document.querySelector('[data-jump]');
  const hero = document.querySelector('.hero');
  const status = document.getElementById('status');
  const drop = document.querySelector('.drop');
  const foot = document.querySelector('.foot');
  if (!jump || !hero || !status || !('IntersectionObserver' in window)) return;
  const seen = new Map();
  const update = () => jump.classList.toggle('is-on', !seen.get(hero) && !seen.get(status) && !seen.get(drop) && !seen.get(foot));
  const io = new IntersectionObserver((entries) => { entries.forEach((e) => seen.set(e.target, e.isIntersecting)); update(); }, { threshold: 0 });
  [hero, status, drop, foot].forEach((el) => el && io.observe(el));
})();

/* ---------- 6. project files: top folders as tiles, then browse inside ---------- */
(() => {
  const root = document.getElementById('files');
  if (!root) return;
  const tops = root.querySelector('[data-files-tops]');
  const panel = root.querySelector('[data-files-panel]');
  const meta = root.querySelector('[data-files-meta]');
  const BASE = '/wiki/files/';
  const COLOURS = [['var(--sun)', 'var(--ink)'], ['var(--shell)', 'var(--paper)'], ['var(--navy-2)', 'var(--paper)'], ['var(--rust)', 'var(--paper)'], ['var(--navy)', 'var(--paper)']];
  const pretty = (s) => s.replace(/／/g, '/').trim();
  const title = (n) => pretty(n.replace(/(\.pdf)+$|\.[a-z0-9]{2,5}$/i, ''));
  const kind = (n) => { const m = /\.([a-z0-9]{2,5})$/i.exec(n); return m ? m[1].toUpperCase() : 'File'; };
  const size = (b) => b < 1048576 ? `${Math.max(1, Math.round(b / 1024))} KB` : `${(b / 1048576).toFixed(1)} MB`;
  const href = (p) => BASE + p.split('/').map(encodeURIComponent).join('/');
  const byName = (a, b) => a.localeCompare(b, 'en', { numeric: true });
  const el = (tag, attrs = {}, ...kids) => {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) k === 'text' ? (n.textContent = v) : n.setAttribute(k, v);
    n.append(...kids);
    return n;
  };

  // folder tree: { dirs: Map(name -> node), files: [], count }
  const node = () => ({ dirs: new Map(), files: [], count: 0 });
  const tree = node();
  let path = [];

  const at = (parts) => parts.reduce((n, p) => n.dirs.get(p), tree);

  function show(parts, focus) {
    path = parts;
    const here = at(parts);
    const top = parts[0];
    const i = [...tree.dirs.keys()].sort(byName).indexOf(top);
    const [bg, fg] = COLOURS[i % COLOURS.length];
    tops.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.top === top)));
    panel.style.setProperty('--f', bg); panel.style.setProperty('--fi', fg);

    const crumbs = el('ol', { class: 'files__crumbs small' });
    parts.forEach((p, k) => {
      const last = k === parts.length - 1;
      crumbs.append(el('li', {}, last ? el('span', { 'aria-current': 'location', text: pretty(p) })
        : el('button', { type: 'button', class: 'link', 'data-to': String(k + 1), text: pretty(p) })));
    });

    const list = el('ul', { class: 'files__list' });
    if (parts.length > 1) list.append(el('li', {}, el('button', { type: 'button', class: 'files__row files__row--dir', 'data-to': String(parts.length - 1) },
      el('span', { text: 'Up a folder' }), el('span', { class: 'small', text: '' }))));
    [...here.dirs.keys()].sort(byName).forEach((d) => {
      const n = here.dirs.get(d).count;
      list.append(el('li', {}, el('button', { type: 'button', class: 'files__row files__row--dir', 'data-into': d },
        el('span', { text: pretty(d) }), el('span', { class: 'small nums', text: `${n} ${n === 1 ? 'file' : 'files'}` }))));
    });
    here.files.slice().sort((a, b) => byName(a.Name, b.Name)).forEach((f) => {
      list.append(el('li', {}, el('a', { class: 'files__row', href: href(f.Path), target: '_blank', rel: 'noopener' },
        el('span', { text: title(f.Name) }), el('span', { class: 'small nums', text: `${kind(f.Name)} · ${size(f.Size)}` }))));
    });
    panel.replaceChildren(el('div', { class: 'files__tab' }, crumbs), list);
    if (focus) panel.querySelector('.files__row')?.focus({ preventScroll: true });
  }

  panel.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.into) show([...path, b.dataset.into], true);
    else if (b.dataset.to) show(path.slice(0, +b.dataset.to), true);
  });

  fetch(BASE + '_wiki/manifest.json', { cache: 'no-cache' })
    .then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then((files) => {
      for (const f of files) {
        const parts = f.Path.split('/');
        if (parts.length === 1) continue;            // loose files: the full list has them
        let n = tree; n.count++;
        for (const p of parts.slice(0, -1)) { if (!n.dirs.has(p)) n.dirs.set(p, node()); n = n.dirs.get(p); n.count++; }
        n.files.push(f);
      }
      meta.textContent = `${files.length} files in ${tree.dirs.size} folders.`;
      [...tree.dirs.keys()].sort(byName).forEach((t, i) => {
        const [bg, fg] = COLOURS[i % COLOURS.length];
        const n = tree.dirs.get(t).count;
        const b = el('button', { type: 'button', class: 'files__top', 'data-top': t, 'aria-pressed': 'false', style: `--f:${bg};--fi:${fg}` },
          el('span', { text: pretty(t) }), el('span', { class: 'small nums', text: String(n) }));
        b.addEventListener('click', () => show([t], false));
        tops.append(b);
      });
      const first = [...tree.dirs.keys()].sort(byName)[0];
      if (first) show([first], false);
    })
    .catch(() => {
      tops.remove();
      panel.replaceChildren(el('p', {}, 'The folders are not available right now. ', el('a', { class: 'link', href: '/wiki/', text: 'Try the full file list' }), '.'));
    });
})();

/* ---------- 7. the 3D lander: load the viewer only as it comes near ---------- */
(() => {
  const mv = document.querySelector('.stage__model');
  if (!mv) return;
  const go = () => {
    if (go.done) return; go.done = true;
    const s = document.createElement('script');
    s.type = 'module';
    s.src = 'https://unpkg.com/@google/model-viewer@4.0.0/dist/model-viewer.min.js';
    document.head.append(s);
    // a tall phone frame needs the camera further back to keep the legs in
    if (matchMedia('(max-width: 760px)').matches) mv.setAttribute('camera-orbit', '-30deg 80deg 125%');
    mv.setAttribute('src', mv.dataset.src);
    // the AR button only where AR can actually start (phones and headsets)
    mv.addEventListener('load', () => mv.classList.toggle('can-ar', !!mv.canActivateAR), { once: true });
  };
  if (!('IntersectionObserver' in window)) { go(); return; }
  const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { go(); io.disconnect(); } }, { rootMargin: '900px 0px' });
  io.observe(mv);
})();

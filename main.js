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
  const altKeys = [[0, 40], [0.06, 40], [0.12, 37], [0.22, 30], [0.40, 14], [0.56, 2.5], [0.66, 0]];
  // mission clock keyframes (progress, minutes after touchdown)
  const clockKeys = [[0.66, 0], [0.74, 10], [0.84, 11], [0.93, 13], [1, 14]];
  const VT = 3.76, H_CUT = 2.5, H_CHUTE = 36;

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
      out.speed.textContent = p < 0.68 ? 'Mission clock. Down at 7.9 m/s, upright' : 'Mission clock, on the ground';
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
  const RHO = 1.2;

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
    'Our exploded shell, as drawn in CAD.',
    'A press brake, the machine that folds sheet. Photo: GaspariniIndustries, CC BY-SA 4.0.',
    'Blind rivets, the kind that hold our panels. Photo: Fructibus, CC0.',
    'A desktop printer at work. Photo: MukhtaromST, CC0.',
    'Our electronics bay in CAD: Pi 4 above, sensor boards below.',
    'Kawainui, where the drops happen. Photo: Eric Tessmer, CC BY 3.0.',
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

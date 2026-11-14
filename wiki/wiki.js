// Project files: reads the manifest the Drive mirror writes on the cluster
// (stack/ares-wiki.yml in Bramblebush) and lists it by folder, with a filter.

(() => {
  const BASE = '/wiki/files/';
  const MANIFEST = BASE + '_wiki/manifest.json';
  const COLOURS = [
    ['var(--sun)', 'var(--ink)'], ['var(--shell)', 'var(--paper)'], ['var(--navy-2)', 'var(--paper)'],
    ['var(--rust)', 'var(--paper)'], ['var(--navy)', 'var(--paper)'],
  ];

  const $ = (s) => document.querySelector(s);
  const out = { meta: $('[data-meta]'), count: $('[data-count]'), index: $('[data-index]'), folders: $('[data-folders]'), search: $('[data-search]') };

  // Drive allows "/" in names; rclone stores it as a full-width solidus.
  const pretty = (s) => s.replace(/／/g, '/').trim();
  const href = (path) => BASE + path.split('/').map(encodeURIComponent).join('/');
  const kind = (name) => { const m = /\.([a-z0-9]{2,5})$/i.exec(name); return m ? m[1].toUpperCase() : 'File'; };
  const title = (name) => pretty(name.replace(/(\.pdf)+$|\.[a-z0-9]{2,5}$/i, ''));
  const size = (b) => b < 1024 ? `${b} B` : b < 1048576 ? `${Math.round(b / 1024)} KB` : `${(b / 1048576).toFixed(1)} MB`;
  const dateFmt = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Pacific/Honolulu' });
  const stampFmt = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: 'Pacific/Honolulu' });
  const slug = (s) => 'f-' + s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const el = (tag, attrs = {}, ...kids) => {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) k === 'text' ? (n.textContent = v) : n.setAttribute(k, v);
    n.append(...kids);
    return n;
  };

  function render(files, synced) {
    const tops = new Map();   // top folder -> Map(subpath -> files)
    const loose = [];
    for (const f of files) {
      const parts = f.Path.split('/');
      if (parts.length === 1) { loose.push(f); continue; }
      const top = parts[0];
      const sub = parts.slice(1, -1).map(pretty).join(' / ');
      if (!tops.has(top)) tops.set(top, new Map());
      const subs = tops.get(top);
      if (!subs.has(sub)) subs.set(sub, []);
      subs.get(sub).push(f);
    }
    const start = loose.find((f) => /^START HERE/i.test(f.Name));
    if (!start) $('[data-start]')?.remove();

    const sorted = [...tops.keys()].sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));
    const sections = [];
    sorted.forEach((top, i) => {
      const [bg, fg] = COLOURS[i % COLOURS.length];
      const subs = tops.get(top);
      const n = [...subs.values()].reduce((a, l) => a + l.length, 0);
      const id = slug(top);

      out.index.append(el('li', {}, el('a', { href: '#' + id, class: 'link', style: `--f:${bg}` },
        el('span', { text: pretty(top) }), el('span', { class: 'nums', text: String(n) }))));

      const body = el('div', { class: 'wiki__body' });
      [...subs.keys()].sort((a, b) => a.localeCompare(b, 'en', { numeric: true })).forEach((sub) => {
        const group = el('div', { class: 'wiki__group' });
        if (sub) group.append(el('h3', { class: 'wiki__sub-h', text: sub }));
        const table = el('table', { class: 'wiki__table' });
        table.append(el('thead', {}, el('tr', {},
          el('th', { scope: 'col', text: 'Document' }), el('th', { scope: 'col', text: 'Type' }),
          el('th', { scope: 'col', class: 'nums', text: 'Size' }), el('th', { scope: 'col', text: 'Changed' }))));
        const tb = el('tbody');
        subs.get(sub).sort((a, b) => a.Name.localeCompare(b.Name, 'en', { numeric: true })).forEach((f) => {
          const tr = el('tr', { 'data-text': (f.Path).toLowerCase().replace(/／/g, '/') },
            el('td', {}, el('a', { class: 'link', href: href(f.Path), target: '_blank', rel: 'noopener', text: title(f.Name) })),
            el('td', { class: 'small', text: kind(f.Name) }),
            el('td', { class: 'small nums', text: size(f.Size) }),
            el('td', { class: 'small nums', text: dateFmt.format(new Date(f.ModTime)) }));
          tb.append(tr);
        });
        table.append(tb);
        group.append(table);
        body.append(group);
      });

      const sec = el('section', { class: 'wiki__folder', id, style: `--f:${bg};--fi:${fg}`, 'aria-label': pretty(top) },
        el('h2', { class: 'wiki__tab' }, el('span', { text: pretty(top) }), el('span', { class: 'small nums', text: `${n} ${n === 1 ? 'file' : 'files'}` })),
        body);
      sections.push(sec);
    });
    out.folders.replaceChildren(...sections);

    const total = files.length;
    const when = synced ? `, last copied ${stampFmt.format(synced)} HST` : '';
    out.meta.textContent = `${total} files${when}.`;
    out.count.textContent = '';

    const rows = [...out.folders.querySelectorAll('tbody tr')];
    const filter = () => {
      const q = out.search.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
      let shown = 0;
      rows.forEach((r) => { const ok = q.every((w) => r.dataset.text.includes(w)); r.hidden = !ok; if (ok) shown++; });
      out.folders.querySelectorAll('.wiki__group').forEach((g) => { g.hidden = !g.querySelector('tbody tr:not([hidden])'); });
      sections.forEach((s, i) => {
        const any = !!s.querySelector('.wiki__group:not([hidden])');
        s.hidden = !any;
        out.index.children[i].hidden = !any;
      });
      out.count.textContent = q.length ? (shown ? `${shown} of ${total} match` : 'Nothing matches. Try a shorter word.') : '';
    };
    out.search.addEventListener('input', filter);
    const q = new URLSearchParams(location.search).get('q');
    if (q) { out.search.value = q; filter(); }
  }

  fetch(MANIFEST, { cache: 'no-cache' })
    .then((r) => { if (!r.ok) throw new Error(r.status); return Promise.all([r.json(), r.headers.get('last-modified')]); })
    .then(([files, lm]) => render(files, lm ? new Date(lm) : null))
    .catch(() => {
      out.meta.textContent = 'The file list is not available right now.';
      out.folders.replaceChildren(el('p', {}, 'Try again in a few minutes, or ', el('a', { class: 'link', href: BASE, text: 'browse the folders directly' }), '.'));
    });
})();

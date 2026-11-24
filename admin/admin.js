/* ZENITUDE CONCIERGE — admin panel (static, Firebase-ready). All data goes through window.ZenStore. */
(() => {
  'use strict';
  const Store = window.ZenStore;
  const LOCAL = Store.mode === 'local';
  const app = document.getElementById('app');
  const toastEl = document.getElementById('toast');

  let USER = null;
  let content = null;
  let savedJSON = '';
  let route = 'dashboard';
  let enquiriesCache = [];

  /* ======================= helpers ======================= */
  function h(tag, attrs, ...kids) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = v;
      else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else if (k === 'dataset') Object.assign(el.dataset, v);
      else if (k === 'value') el.value = v;
      else if (k === 'checked') el.checked = !!v;
      else el.setAttribute(k, v === true ? '' : v);
    }
    for (const kid of kids.flat(Infinity)) {
      if (kid == null || kid === false) continue;
      el.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
    }
    return el;
  }
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const imgSrc = (p) => {
    p = String(p || '').trim();
    if (!p) return '';
    if (/^https?:\/\//i.test(p) || /^data:image\//i.test(p)) return p;
    if (/^[a-z][a-z0-9+.-]*:/i.test(p)) return '';
    return '../' + p.replace(/^\/+/, '');
  };
  const fmtDate = (s) => { const d = new Date(s); return isNaN(d) ? '' : d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }); };
  const fmtSize = (b) => b > 1048576 ? (b / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round((b || 0) / 1024)) + ' KB';
  const slugify = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  const download = (name, text, type) => { const a = h('a', { href: URL.createObjectURL(new Blob([text], { type })), download: name }); document.body.append(a); a.click(); a.remove(); };

  function toast(msg, type = 'ok') {
    toastEl.textContent = msg;
    toastEl.className = 'toast is-show toast--' + type;
    clearTimeout(toast.t);
    toast.t = setTimeout(() => toastEl.classList.remove('is-show'), type === 'error' ? 6000 : 3200);
  }
  const fail = (e) => { console.error(e); toast(e.message || String(e), 'error'); };

  function modal(title, body, actions = []) {
    return new Promise((resolve) => {
      const close = (v) => { wrap.remove(); document.removeEventListener('keydown', onKey); resolve(v); };
      const onKey = (e) => { if (e.key === 'Escape') close(null); };
      const wrap = h('div', { class: 'modal', onclick: (e) => { if (e.target === wrap) close(null); } },
        h('div', { class: 'modal__box', role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
          h('header', { class: 'modal__head' }, h('h3', { text: title }), h('button', { class: 'icon-btn', 'aria-label': 'Close', onclick: () => close(null) }, '×')),
          h('div', { class: 'modal__body' }, body),
          actions.length ? h('footer', { class: 'modal__foot' }, actions.map((a) => h('button', { class: 'btn ' + (a.class || ''), onclick: () => close(a.value) }, a.label))) : null));
      document.body.append(wrap);
      document.addEventListener('keydown', onKey);
      modal.close = close;
    });
  }
  const confirmBox = (msg, ok = 'Delete', danger = true) =>
    modal('Please confirm', h('p', { text: msg }), [{ label: 'Cancel', value: false, class: 'btn--ghost' }, { label: ok, value: true, class: danger ? 'btn--danger' : 'btn--primary' }]);

  const isDirty = () => content && JSON.stringify(content) !== savedJSON;
  function markDirty() {
    const d = isDirty();
    document.body.classList.toggle('is-dirty', d);
    const s = document.getElementById('saveBtn');
    if (s) s.disabled = !d;
  }
  window.addEventListener('beforeunload', (e) => { if (isDirty()) { e.preventDefault(); e.returnValue = ''; } });

  /* ======================= validation (before saving) ======================= */
  function validate(c) {
    for (const sec of ['destinations', 'experiences']) {
      const seen = new Set();
      (c[sec] || []).forEach((item, i) => {
        if (!String(item.name || '').trim()) throw new Error(`${sec[0].toUpperCase() + sec.slice(1)} #${i + 1} needs a name.`);
        item.slug = slugify(item.slug || item.name);
        if (!item.slug) throw new Error(`${item.name}: the page address is empty.`);
        if (seen.has(item.slug)) throw new Error(`The page address “${item.slug}” is used twice in ${sec}.`);
        seen.add(item.slug);
      });
    }
    const json = JSON.stringify(c);
    if (!LOCAL && json.length > 900000) throw new Error('Content is too large for one Firestore document — remove some embedded images.');
    return c;
  }

  /* ======================= schema ======================= */
  const T = (key, label, o = {}) => ({ type: 'text', key, label, ...o });
  const TA = (key, label, o = {}) => ({ type: 'textarea', key, label, rows: 4, ...o });
  const IMG = (key, label, o = {}) => ({ type: 'image', key, label, ...o });
  const TOG = (key, label, o = {}) => ({ type: 'toggle', key, label, ...o });
  const STR = (key, label, o = {}) => ({ type: 'strings', key, label, ...o });
  const SEL = (key, label, options, o = {}) => ({ type: 'select', key, label, options, ...o });
  const LIST = (key, label, fields, item, o = {}) => ({ type: 'list', key, label, fields, item, ...o });
  const ITALIC = 'Wrap words in *asterisks* to show them in gold italics.';

  const highlights = LIST('highlights', 'Highlights', [T('title', 'Title'), TA('text', 'Text', { rows: 3 }), IMG('image', 'Image')], { title: '', text: '', image: '' }, { labelKey: 'title', itemName: 'highlight' });
  const gallery = { type: 'images', key: 'gallery', label: 'Gallery', hint: 'Shown as a photo grid near the bottom of the page.' };

  const SECTIONS = {
    home: {
      title: 'Home page', icon: '⌂', kind: 'object', desc: 'Texts and images on the home page.',
      groups: [
        ['Hero', [T('heroEyebrow', 'Small line above the title'), TA('heroTitle', 'Main title', { rows: 3, hint: 'One line per row. ' + ITALIC }), TA('heroLead', 'Intro sentence', { rows: 2 })]],
        ['Hero video (optional)', [
          { type: 'video', key: 'heroVideo', label: 'Background video (MP4)', hint: 'Plays silently on a loop behind the title when the site opens. Use a link to an .mp4 file, or a file in the repository such as assets/video/hero.mp4. Aim for 10–30 seconds and under 10 MB. Leave empty to keep the current design.' },
          { type: 'video', key: 'heroVideoMobile', label: 'Phone version (optional)', hint: 'A smaller/vertical version for phones. If empty, phones get the main video.' },
          IMG('heroPoster', 'Still image shown while the video loads', { hint: 'Ideally the first frame of the video. Also shown to visitors who turned off animations or use data-saver.' }),
          SEL('heroVideoSound', 'Does the video have sound?', [['', 'No — silent video'], ['yes', 'Yes — show a sound on/off button (starts muted)']]),
        ]],
        ['Scrolling band', [STR('marquee', 'Words in the gold scrolling band')]],
        ['About', [T('aboutEyebrow', 'Small heading'), T('aboutTitle', 'Title', { hint: ITALIC }), TA('aboutText', 'Text', { rows: 6, hint: 'Leave an empty line between paragraphs.' }), IMG('aboutImage', 'Photo'), TA('aboutBadge', 'Badge text', { rows: 2 })]],
        ['Services intro', [T('servicesTitle', 'Title', { hint: ITALIC }), TA('servicesIntro', 'Intro', { rows: 2 })]],
        ['Team teaser', [T('teamTitle', 'Title', { hint: ITALIC + ' Also used on the Team page.' }), TA('teamText', 'Text', { rows: 3 }), IMG('teamImage', 'Group photo')]],
        ['B2B portal', [T('b2bTitle', 'Title', { hint: ITALIC }), TA('b2bText', 'Text', { rows: 3 }), STR('b2bPoints', 'Bullet points'), IMG('b2bImage', 'Decorative image (transparent PNG works best)')]],
      ],
    },
    destinations: {
      title: 'Destinations', icon: '◎', kind: 'list', page: 'destination', desc: 'Each destination has its own page.',
      item: { name: 'New destination', slug: '', published: false, theme: 'mu', tagline: '', summary: '', intro: '', heroImage: '', facts: [], highlights: [], gallery: [] }, labelKey: 'name', itemName: 'destination',
      fields: [T('name', 'Name'), { type: 'slug', key: 'slug', label: 'Page address', page: 'destination' }, TOG('published', 'Visible on website'),
        SEL('theme', 'Colour theme (used when there is no photo)', [['mu', 'Lagoon turquoise'], ['ro', 'Soft green-blue'], ['re', 'Volcanic dusk'], ['mg', 'Baobab sunset']]),
        T('tagline', 'Tagline'), TA('summary', 'Short summary (home page card)', { rows: 2 }), TA('intro', 'Page introduction', { rows: 6, hint: 'Leave an empty line between paragraphs.' }),
        IMG('heroImage', 'Header image'),
        LIST('facts', 'At a glance', [T('label', 'Label'), T('value', 'Value')], { label: '', value: '' }, { labelKey: 'label', compact: true, itemName: 'fact' }),
        highlights, gallery],
    },
    experiences: {
      title: 'Experiences', icon: '◈', kind: 'list', page: 'experience', desc: 'Air, Land & Sea — each has its own page.',
      item: { name: 'New experience', slug: '', published: false, tagline: '', summary: '', intro: '', heroImage: '', highlights: [], gallery: [] }, labelKey: 'name', itemName: 'experience',
      fields: [T('name', 'Name'), { type: 'slug', key: 'slug', label: 'Page address', page: 'experience' }, TOG('published', 'Visible on website'),
        T('tagline', 'Tagline'), TA('summary', 'Short summary (home page card)', { rows: 2 }), TA('intro', 'Page introduction', { rows: 6, hint: 'Leave an empty line between paragraphs.' }),
        IMG('heroImage', 'Header image'), highlights, gallery],
    },
    team: {
      title: 'Team', icon: '☺', kind: 'list', desc: 'The first visible person is featured at the top of the Team page.',
      item: { name: 'New team member', role: '', published: false, photo: '', bio: '' }, labelKey: 'name', thumbKey: 'photo', subKey: 'role', itemName: 'team member',
      fields: [T('name', 'Full name'), T('role', 'Job title'), TOG('published', 'Visible on website'), IMG('photo', 'Photo', { hint: 'Portrait photos work best; the face should be near the top.' }), TA('bio', 'Biography', { rows: 4 })],
    },
    testimonials: {
      title: 'Testimonials', icon: '❝', kind: 'list', desc: 'Guest reviews shown in the slider.',
      item: { quote: '', author: '', context: '', rating: 5, published: false }, labelKey: 'author', subKey: 'quote', itemName: 'testimonial',
      fields: [T('author', 'Guest name'), T('context', 'Context (e.g. "Four-day private journey")'), SEL('rating', 'Stars', [[5, '★★★★★'], [4, '★★★★'], [3, '★★★']], { number: true }), TOG('published', 'Visible on website'), TA('quote', 'Quote', { rows: 4, hint: 'Without quotation marks — they are added automatically.' })],
    },
    stays: {
      title: 'Hotels & villas', icon: '⌂', kind: 'list', desc: 'Shown on the Stays pages — one list per coast. Choose the coast for each address.',
      item: { name: 'New hotel', region: 'north', area: '', type: 'Resort', budget: '', description: '', image: '', website: '', published: false }, labelKey: 'name', thumbKey: 'image', subKey: 'region', itemName: 'hotel or villa',
      fields: [T('name', 'Name'),
        SEL('region', 'Coast', [['north', 'North'], ['east', 'East'], ['south', 'South'], ['west', 'West']]),
        T('area', 'Area / village', { hint: 'e.g. Grand Baie, Belle Mare, Le Morne' }),
        SEL('type', 'Type', [['Resort', 'Resort'], ['Hotel', 'Hotel'], ['Boutique hotel', 'Boutique hotel'], ['Villas', 'Villas'], ['Private villa', 'Private villa'], ['Guesthouse', 'Guesthouse']]),
        SEL('budget', 'Budget level (optional)', [['', '— not shown —'], ['Comfort', 'Comfort'], ['Premium', 'Premium'], ['Luxury', 'Luxury'], ['Ultra-luxury', 'Ultra-luxury']]),
        TOG('published', 'Visible on website'),
        TA('description', 'Short description', { rows: 3 }),
        IMG('image', 'Photo', { hint: 'Use photos you have permission to use (e.g. from the hotel’s press kit).' }),
        T('website', 'Hotel website (optional)', { hint: 'Full address starting with https://' })],
    },
    services: {
      title: 'Services', icon: '✦', kind: 'list', desc: 'The signature service cards on the home page.',
      item: { title: 'New service', text: '', items: [] }, labelKey: 'title', itemName: 'service',
      fields: [T('title', 'Title'), TA('text', 'Description', { rows: 3 }), STR('items', 'Bullet points')],
    },
    regions: {
      title: 'Accommodation', icon: '✧', kind: 'list', fixed: true, desc: 'The four coasts in the compass section — one entry per direction.',
      item: { key: 'north', title: '', kicker: '', desc: '' }, labelKey: 'title',
      fields: [SEL('key', 'Direction', [['north', 'North'], ['east', 'East'], ['south', 'South'], ['west', 'West']]), T('title', 'Title'), T('kicker', 'Places (small line)'), TA('desc', 'Description', { rows: 3 })],
    },
    transfers: {
      title: 'Transfers', icon: '⇄', kind: 'list', desc: 'Transfer options shown under the experiences.',
      item: { name: 'New transfer', text: '' }, labelKey: 'name', itemName: 'transfer',
      fields: [T('name', 'Name'), TA('text', 'Description', { rows: 3 })],
    },
    pages: {
      title: 'Legal pages', icon: '§', kind: 'object', desc: 'Privacy Policy and Terms pages linked in the footer.',
      groups: [
        ['Privacy Policy', [T('title', 'Page title'), TA('body', 'Text', { rows: 12, hint: 'Leave an empty line between paragraphs.' })], 'privacy'],
        ['Terms & Conditions', [T('title', 'Page title'), TA('body', 'Text', { rows: 12, hint: 'Leave an empty line between paragraphs.' })], 'terms'],
      ],
    },
    settings: {
      title: 'Settings', icon: '⚙', kind: 'object', desc: 'Contact details, social links and SEO.',
      groups: [
        ['Business', [T('siteName', 'Business name'), T('tagline', 'Tagline'), TA('metaDescription', 'Search engine description', { rows: 3, hint: 'Shown by Google under your site name. Aim for 150–160 characters.' })]],
        ['Contact', [T('phone', 'Phone'), T('email', 'Public email (also receives enquiries by email)'), T('salesEmail', 'Sales / B2B email'), T('whatsapp', 'WhatsApp number', { hint: 'International format, e.g. +230 5xxx xxxx. Leave empty to hide.' }), TA('address', 'Address', { rows: 3 }), TA('hours', 'Opening hours', { rows: 2 }), T('mapQuery', 'Map location (address searched on Google Maps)')]],
        ['Social', [T('facebook', 'Facebook URL'), T('instagram', 'Instagram URL'), T('linkedin', 'LinkedIn URL')]],
      ],
    },
  };

  const NAV = [
    ['Overview', [['dashboard', 'Dashboard', '◇'], ['enquiries', 'Enquiries', '✉']]],
    ['Website', ['home', 'destinations', 'experiences', 'stays', 'team', 'testimonials', 'services', 'regions', 'transfers', 'pages', 'settings'].map((k) => [k, SECTIONS[k].title, SECTIONS[k].icon])],
    ['Library', [['media', 'Media', '▣']]],
    ['System', [['backups', 'Backups & export', '↺'], ['account', 'Account', '⚿']]],
  ];

  /* ======================= field renderers ======================= */
  function field(label, control, hint, cls = '', tag = 'label') {
    return h(tag, { class: 'f ' + cls }, h('span', { class: 'f__label', text: label }), control, hint ? h('small', { class: 'f__hint', text: hint }) : null);
  }

  function renderField(obj, f, onLabelChange) {
    const set = (v) => { obj[f.key] = v; markDirty(); if (onLabelChange) onLabelChange(); };
    switch (f.type) {
      case 'text':
        return field(f.label, h('input', { type: 'text', value: obj[f.key] ?? '', oninput: (e) => set(e.target.value) }), f.hint);
      case 'textarea':
        return field(f.label, h('textarea', { rows: f.rows, oninput: (e) => set(e.target.value) }, obj[f.key] ?? ''), f.hint);
      case 'toggle':
        return h('label', { class: 'f f--toggle' }, h('input', { type: 'checkbox', checked: obj[f.key] !== false, onchange: (e) => set(e.target.checked) }), h('span', { class: 'switch' }), h('span', { text: f.label }));
      case 'select':
        return field(f.label, h('select', { onchange: (e) => set(f.number ? +e.target.value : e.target.value) },
          f.options.map(([v, l]) => h('option', { value: v, selected: String(obj[f.key]) === String(v) }, l))), f.hint);
      case 'slug': {
        const preview = h('code', { text: `${f.page}.html?slug=${obj[f.key] || '…'}` });
        const update = (v) => { set(v); preview.textContent = `${f.page}.html?slug=${v || '…'}`; };
        const input = h('input', { type: 'text', value: obj[f.key] ?? '', placeholder: 'auto from name', maxlength: 60,
          oninput: (e) => { e.target.value = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'); update(e.target.value); },
          onchange: (e) => { e.target.value = slugify(e.target.value); update(e.target.value); } });
        return field(f.label, h('div', { class: 'slug' }, input, preview), 'Lowercase letters, numbers and dashes. Changing it changes the page link.');
      }
      case 'video': {
        const preview = h('video', { class: 'vidf__preview', muted: true, loop: true, playsinline: true, controls: true, preload: 'metadata' });
        const status = h('small', { class: 'f__hint' });
        const show = (v) => {
          const src = String(v || '').trim();
          const ok = src && (/^https?:\/\//i.test(src) || !/^[a-z][a-z0-9+.-]*:/i.test(src));
          preview.hidden = !ok;
          status.textContent = '';
          if (ok) { preview.src = /^https?:/i.test(src) ? src : '../' + src.replace(/^\/+/, ''); }
          else preview.removeAttribute('src');
        };
        preview.addEventListener('error', () => { if (preview.getAttribute('src')) status.textContent = '⚠ This video could not be loaded — check the link or file path.'; });
        preview.addEventListener('loadedmetadata', () => { status.textContent = `✓ ${preview.videoWidth}×${preview.videoHeight}, ${Math.round(preview.duration)} s`; });
        const input = h('input', { type: 'text', value: obj[f.key] ?? '', placeholder: 'assets/video/hero.mp4 or https://…/video.mp4', oninput: (e) => set(e.target.value.trim()), onchange: (e) => show(e.target.value) });
        show(obj[f.key]);
        return field(f.label, h('div', { class: 'vidf' }, input, preview, status), f.hint, 'f--image', 'div');
      }
      case 'strings': return field(f.label, stringsEditor(obj, f.key), f.hint, '', 'div');
      case 'image': return field(f.label, imageEditor(obj, f.key), f.hint, 'f--image', 'div');
      case 'images': return field(f.label, galleryEditor(obj, f.key), f.hint, '', 'div');
      case 'list':
        if (!Array.isArray(obj[f.key])) obj[f.key] = [];
        return h('div', { class: 'f f--list' }, h('span', { class: 'f__label', text: f.label }), listEditor(obj[f.key], f));
    }
    return null;
  }

  function stringsEditor(obj, key) {
    if (!Array.isArray(obj[key])) obj[key] = [];
    const wrap = h('div', { class: 'strings' });
    const draw = () => {
      wrap.replaceChildren(
        ...obj[key].map((s, i) => h('div', { class: 'strings__row' },
          h('input', { type: 'text', value: s, oninput: (e) => { obj[key][i] = e.target.value; markDirty(); } }),
          h('button', { class: 'icon-btn', type: 'button', title: 'Move up', disabled: i === 0, onclick: () => { [obj[key][i - 1], obj[key][i]] = [obj[key][i], obj[key][i - 1]]; markDirty(); draw(); } }, '↑'),
          h('button', { class: 'icon-btn icon-btn--danger', type: 'button', title: 'Remove', onclick: () => { obj[key].splice(i, 1); markDirty(); draw(); } }, '×'))),
        h('button', { class: 'btn btn--ghost btn--sm', type: 'button', onclick: () => { obj[key].push(''); markDirty(); draw(); [...wrap.querySelectorAll('.strings__row input')].pop()?.focus(); } }, '+ Add line'));
    };
    draw();
    return wrap;
  }

  function imageEditor(obj, key) {
    const wrap = h('div', { class: 'imgf' });
    const draw = () => {
      const v = obj[key] || '';
      const shown = /^data:/.test(v) ? '(image stored in browser)' : v;
      const thumb = v ? h('img', { src: imgSrc(v), alt: '', onerror: (e) => e.target.replaceWith(h('span', { class: 'imgf__broken', text: 'Not loading' })) }) : h('span', { class: 'imgf__empty', text: 'No image' });
      wrap.replaceChildren(
        h('div', { class: 'imgf__thumb' }, thumb),
        h('div', { class: 'imgf__side' },
          h('input', { type: 'text', value: shown, placeholder: 'https://… or assets/photos/photo.jpg', readonly: /^data:/.test(v), onchange: (e) => { obj[key] = e.target.value.trim(); markDirty(); draw(); } }),
          h('div', { class: 'imgf__btns' },
            h('button', { class: 'btn btn--ghost btn--sm', type: 'button', onclick: async () => { const p = await pickMedia(false); if (p) { obj[key] = p[0]; markDirty(); draw(); } } }, 'Choose from library'),
            h('label', { class: 'btn btn--ghost btn--sm' }, 'Upload new', h('input', { type: 'file', accept: 'image/*', hidden: true, onchange: async (e) => { const r = await uploadFiles(e.target.files); if (r[0]) { obj[key] = r[0]; markDirty(); draw(); } } })),
            v ? h('button', { class: 'btn btn--ghost btn--sm', type: 'button', onclick: () => { obj[key] = ''; markDirty(); draw(); } }, 'Remove') : null)));
    };
    draw();
    return wrap;
  }

  function galleryEditor(obj, key) {
    if (!Array.isArray(obj[key])) obj[key] = [];
    const wrap = h('div', { class: 'gal' });
    const draw = () => {
      wrap.replaceChildren(
        ...obj[key].map((p, i) => h('div', { class: 'gal__item' },
          h('img', { src: imgSrc(p), alt: '', loading: 'lazy' }),
          h('div', { class: 'gal__acts' },
            h('button', { class: 'icon-btn', type: 'button', title: 'Move left', disabled: i === 0, onclick: () => { [obj[key][i - 1], obj[key][i]] = [obj[key][i], obj[key][i - 1]]; markDirty(); draw(); } }, '←'),
            h('button', { class: 'icon-btn icon-btn--danger', type: 'button', title: 'Remove', onclick: () => { obj[key].splice(i, 1); markDirty(); draw(); } }, '×')))),
        h('button', { class: 'gal__add', type: 'button', onclick: async () => { const p = await pickMedia(true); if (p) { obj[key].push(...p); markDirty(); draw(); } } }, '+ Add photos'));
    };
    draw();
    return wrap;
  }

  function listEditor(arr, cfg) {
    const wrap = h('div', { class: 'list' + (cfg.compact ? ' list--compact' : '') });
    const open = new Set();
    const label = (item) => (cfg.labelKey && String(item[cfg.labelKey] || '').trim()) || 'Untitled';
    const draw = () => {
      wrap.replaceChildren(
        ...arr.map((item, i) => {
          const title = h('strong', { class: 'item__title', text: label(item) });
          const sub = cfg.subKey ? h('span', { class: 'item__sub', text: String(item[cfg.subKey] || '').slice(0, 90) }) : null;
          const isOpen = open.has(item);
          return h('div', { class: 'item' + (isOpen ? ' is-open' : '') + (item.published === false ? ' is-hidden' : '') },
            h('div', { class: 'item__head', onclick: (e) => { if (e.target.closest('button, a')) return; isOpen ? open.delete(item) : open.add(item); draw(); } },
              cfg.thumbKey ? h('span', { class: 'item__thumb' }, item[cfg.thumbKey] ? h('img', { src: imgSrc(item[cfg.thumbKey]), alt: '', onerror: (e) => e.target.remove() }) : null) : h('span', { class: 'item__num', text: String(i + 1).padStart(2, '0') }),
              h('div', { class: 'item__text' }, title, sub),
              item.published === false ? h('span', { class: 'chip chip--muted', text: 'Hidden' }) : null,
              cfg === SECTIONS.stays && item.region ? h('a', { class: 'icon-btn', href: `../stays.html?region=${encodeURIComponent(item.region)}`, target: '_blank', title: 'View coast page (saved version)' }, '↗') : null,
              cfg.page && item.slug ? h('a', { class: 'icon-btn', href: `../${cfg.page}.html?slug=${encodeURIComponent(item.slug)}`, target: '_blank', title: 'View page (saved version)' }, '↗') : null,
              h('button', { class: 'icon-btn', type: 'button', title: 'Move up', disabled: i === 0, onclick: () => { [arr[i - 1], arr[i]] = [arr[i], arr[i - 1]]; markDirty(); draw(); } }, '↑'),
              h('button', { class: 'icon-btn', type: 'button', title: 'Move down', disabled: i === arr.length - 1, onclick: () => { [arr[i + 1], arr[i]] = [arr[i], arr[i + 1]]; markDirty(); draw(); } }, '↓'),
              cfg.fixed ? null : h('button', { class: 'icon-btn icon-btn--danger', type: 'button', title: 'Delete', onclick: async () => { if (await confirmBox(`Delete “${label(item)}”? You can still undo with “Discard changes” before saving.`)) { arr.splice(i, 1); markDirty(); draw(); } } }, '×'),
              h('span', { class: 'item__chev', text: isOpen ? '−' : '+' })),
            isOpen ? h('div', { class: 'item__body' }, cfg.fields.map((f) => renderField(item, f, () => { title.textContent = label(item); }))) : null);
        }),
        cfg.fixed ? null : h('button', { class: 'btn btn--ghost list__add', type: 'button', onclick: () => { const n = clone(cfg.item); arr.push(n); open.add(n); markDirty(); draw(); } }, '+ Add ' + (cfg.itemName || 'item')));
    };
    draw();
    return wrap;
  }

  /* ======================= media ======================= */
  async function uploadFiles(files) {
    const out = [];
    for (const file of [...files]) {
      try { toast(`Uploading ${file.name}…`, 'info'); out.push(await Store.uploadImage(file)); }
      catch (e) { toast(`${file.name}: ${e.message}`, 'error'); }
    }
    if (out.length) toast(out.length === 1 ? 'Image uploaded' : `${out.length} images uploaded`);
    return out;
  }

  async function pickMedia(multi) {
    const chosen = new Set();
    const grid = h('div', { class: 'media-grid media-grid--pick' }, h('p', { class: 'muted', text: 'Loading…' }));
    const load = async () => {
      const media = await Store.listMedia().catch((e) => { fail(e); return []; });
      grid.replaceChildren(...(media.length ? media.map((m) => {
        const card = h('button', { class: 'media-card', type: 'button', onclick: () => {
          if (!multi) { chosen.clear(); grid.querySelectorAll('.is-picked').forEach((c) => c.classList.remove('is-picked')); }
          chosen.has(m.url) ? chosen.delete(m.url) : chosen.add(m.url);
          card.classList.toggle('is-picked', chosen.has(m.url));
        }, ondblclick: () => { if (!multi) { chosen.clear(); chosen.add(m.url); modal.close('use'); } } },
          h('img', { src: m.url, alt: '', loading: 'lazy' }), h('span', { text: m.name }));
        return card;
      }) : [h('p', { class: 'muted', text: 'No images yet — upload some.' })]));
    };
    const uploader = h('label', { class: 'btn btn--ghost' }, 'Upload images', h('input', { type: 'file', accept: 'image/*', multiple: true, hidden: true, onchange: async (e) => { await uploadFiles(e.target.files); load(); } }));
    load();
    const res = await modal(multi ? 'Choose photos' : 'Choose an image', h('div', {}, h('div', { class: 'pick-bar' }, uploader, h('span', { class: 'muted', text: multi ? 'Click to select several.' : 'Click to select, double-click to use.' })), grid),
      [{ label: 'Cancel', value: null, class: 'btn--ghost' }, { label: 'Use selected', value: 'use', class: 'btn--primary' }]);
    return res === 'use' && chosen.size ? [...chosen] : null;
  }

  /* ======================= layout ======================= */
  function shell() {
    const nav = h('nav', { class: 'side__nav' }, NAV.map(([group, items]) => h('div', { class: 'side__group' },
      h('p', { class: 'side__label', text: group }),
      items.map(([key, label, icon]) => h('a', { href: '#' + key, class: 'side__link', dataset: { route: key } },
        h('span', { class: 'side__icon', text: icon }), h('span', { text: label }),
        key === 'enquiries' ? h('span', { class: 'badge', id: 'newBadge', hidden: true }) : null)))));
    app.className = 'layout';
    app.replaceChildren(
      h('aside', { class: 'side' },
        h('a', { class: 'side__brand', href: '#dashboard' }, h('img', { src: '../assets/img/emblem-white.png', alt: '' }),
          h('span', {}, h('strong', { text: 'Zenitude' }), h('small', { text: 'Admin' })),
          h('span', { class: 'mode-chip', text: LOCAL ? 'Demo' : 'Live' })),
        nav,
        h('div', { class: 'side__foot' },
          h('a', { href: '../index.html', target: '_blank', class: 'side__link' }, h('span', { class: 'side__icon', text: '↗' }), 'View website'),
          LOCAL ? null : h('button', { class: 'side__link', onclick: logout }, h('span', { class: 'side__icon', text: '⎋' }), 'Sign out'))),
      h('div', { class: 'main' },
        h('header', { class: 'top' },
          h('button', { class: 'icon-btn top__menu', 'aria-label': 'Menu', onclick: () => document.body.classList.toggle('side-open') }, '☰'),
          h('div', { class: 'top__title' }, h('h1', { id: 'pageTitle' }), h('p', { id: 'pageDesc', class: 'muted' })),
          h('div', { class: 'top__actions' },
            h('span', { class: 'unsaved', text: 'Unsaved changes' }),
            h('button', { class: 'btn btn--ghost', id: 'discardBtn', onclick: discard }, 'Discard changes'),
            h('button', { class: 'btn btn--primary', id: 'saveBtn', disabled: true, onclick: save }, LOCAL ? 'Save' : 'Save & publish'))),
        h('section', { class: 'view', id: 'view' })),
      h('div', { class: 'side__scrim', onclick: () => document.body.classList.remove('side-open') }));
    markDirty();
  }

  function demoBanner() {
    if (!LOCAL) return null;
    return h('div', { class: 'demo-banner' }, h('span', { class: 'demo-banner__icon', text: '⚠' }),
      h('div', {}, h('strong', { text: 'Demo mode — Firebase is not connected yet.' }),
        'Changes are saved in this browser only, so visitors will not see them and there is no login. To publish edits now, use ',
        h('a', { href: '#backups', text: 'Backups & export → Download content.js' }), ' and replace data/content.js in GitHub.'));
  }

  function setHead(title, desc = '') {
    document.getElementById('pageTitle').textContent = title;
    document.getElementById('pageDesc').textContent = desc;
    document.title = title + ' · Zenitude Admin';
  }

  function go() {
    route = (location.hash || '#dashboard').slice(1);
    document.body.classList.remove('side-open');
    document.querySelectorAll('.side__link[data-route]').forEach((a) => a.classList.toggle('is-active', a.dataset.route === route));
    const view = document.getElementById('view');
    view.replaceChildren();
    window.scrollTo(0, 0);
    const banner = demoBanner(); if (banner) view.append(banner);
    const views = { dashboard: viewDashboard, enquiries: viewEnquiries, media: viewMedia, backups: viewBackups, account: viewAccount };
    const run = views[route] || (SECTIONS[route] && ((v) => viewSection(v, route)));
    if (!run) { location.hash = '#dashboard'; return; }
    Promise.resolve(run(view)).catch(fail);
  }

  /* ======================= views ======================= */
  function viewSection(view, key) {
    const sec = SECTIONS[key];
    setHead(sec.title, sec.desc);
    if (!content[key] || typeof content[key] !== 'object') content[key] = sec.kind === 'list' ? [] : {};
    if (sec.kind === 'object') {
      view.append(...sec.groups.map(([title, fields, sub]) => {
        const target = sub ? (content[key][sub] = content[key][sub] || {}) : content[key];
        return h('div', { class: 'panel' }, h('h2', { class: 'panel__title', text: title }), h('div', { class: 'grid-fields' }, fields.map((f) => renderField(target, f))));
      }));
    } else {
      view.append(h('div', { class: 'panel panel--flush' }, listEditor(content[key], sec)));
    }
  }

  async function refreshEnquiries() {
    enquiriesCache = await Store.listEnquiries();
    const n = enquiriesCache.filter((q) => q.status === 'new').length;
    const b = document.getElementById('newBadge');
    if (b) { b.hidden = !n; b.textContent = n; }
    return enquiriesCache;
  }

  const statusChip = (s) => h('span', { class: 'chip chip--' + String(s || 'new').replace(/\s/g, '-'), text: s || 'new' });

  async function viewDashboard(view) {
    setHead(LOCAL ? 'Welcome' : `Welcome back${USER && USER.email ? ', ' + USER.email.split('@')[0] : ''}`, 'An overview of your website.');
    const [enq, media] = await Promise.all([refreshEnquiries().catch(() => []), Store.listMedia().catch(() => [])]);
    if (route !== 'dashboard') return;
    const live = (arr) => (arr || []).filter((x) => x.published !== false).length;
    const stat = (n, label, href) => h('a', { class: 'stat', href }, h('strong', { text: n }), h('span', { text: label }));
    view.append(
      h('div', { class: 'stats' },
        stat(enq.filter((q) => q.status === 'new').length, 'New enquiries', '#enquiries'),
        stat(live(content.destinations), 'Destinations live', '#destinations'),
        stat(live(content.team), 'Team members', '#team'),
        stat(live(content.testimonials), 'Testimonials', '#testimonials'),
        stat(media.length, 'Images in library', '#media')),
      h('div', { class: 'dash' },
        h('div', { class: 'panel' }, h('h2', { class: 'panel__title', text: 'Latest enquiries' }),
          enq.length ? h('ul', { class: 'mini-list' }, enq.slice(0, 6).map((q) => h('li', {},
            h('a', { href: '#enquiries', onclick: () => { viewEnquiries.open = q.id; } },
              h('strong', { text: q.name }), h('span', { class: 'muted', text: ` · ${q.interest || '—'}` }), statusChip(q.status), h('small', { class: 'muted', text: fmtDate(q.created) })))))
            : h('p', { class: 'muted', text: LOCAL ? 'In demo mode, enquiries are sent by email (the visitor\'s email app opens). Once Firebase is connected they will appear here.' : 'No enquiries yet.' })),
        h('div', { class: 'panel' }, h('h2', { class: 'panel__title', text: 'Quick actions' }),
          h('div', { class: 'quick' },
            h('a', { class: 'quick__btn', href: '#destinations' }, '◎ Edit destinations'),
            h('a', { class: 'quick__btn', href: '#team' }, '☺ Add a team member'),
            h('a', { class: 'quick__btn', href: '#testimonials' }, '❝ Add a testimonial'),
            h('a', { class: 'quick__btn', href: '#media' }, '▣ Upload photos'),
            h('a', { class: 'quick__btn', href: '#settings' }, '⚙ Contact details'),
            h('a', { class: 'quick__btn', href: '../index.html', target: '_blank' }, '↗ Open website')),
          h('p', { class: 'muted tip', text: 'Tip: changes are only applied when you press Save (Ctrl/Cmd + S). Every save keeps a backup you can restore.' }))));
  }

  async function viewEnquiries(view) {
    setHead('Enquiries', 'Messages sent through the website contact form.');
    let filter = 'all';
    const listEl = h('div', { class: 'enq-list' });
    const empty = () => h('p', { class: 'muted', text: 'Select an enquiry to read it.' });
    const detail = h('div', { class: 'enq-detail panel' }, empty());
    const tabs = h('div', { class: 'tabs' });
    const draw = () => {
      const all = enquiriesCache;
      const counts = { all: all.length };
      ['new', 'in progress', 'replied', 'archived'].forEach((s) => { counts[s] = all.filter((q) => q.status === s).length; });
      tabs.replaceChildren(...Object.entries(counts).map(([k, n]) => h('button', { class: 'tab' + (filter === k ? ' is-active' : ''), onclick: () => { filter = k; draw(); } }, `${k[0].toUpperCase() + k.slice(1)} (${n})`)),
        h('button', { class: 'btn btn--ghost btn--sm tabs__export', onclick: exportCSV, disabled: !all.length }, 'Export CSV'));
      const rows = all.filter((q) => filter === 'all' || q.status === filter);
      listEl.replaceChildren(...(rows.length ? rows.map((q) => h('button', { class: 'enq' + (q.status === 'new' ? ' is-new' : '') + (viewEnquiries.open === q.id ? ' is-active' : ''), onclick: () => { viewEnquiries.open = q.id; draw(); show(q); } },
        h('span', { class: 'enq__top' }, h('strong', { text: q.name }), statusChip(q.status)),
        h('span', { class: 'enq__interest', text: q.interest || '—' }),
        h('small', { class: 'muted', text: fmtDate(q.created) }))) : [h('p', { class: 'muted pad', text: 'Nothing here.' })]));
    };
    const show = (q) => {
      const row = (k, v) => v ? h('div', { class: 'kv' }, h('dt', { text: k }), h('dd', { text: v })) : null;
      const subject = encodeURIComponent('Re: your enquiry — ' + (q.interest || 'Zenitude Concierge'));
      detail.replaceChildren(
        h('div', { class: 'enq-detail__head' }, h('h2', { text: q.name }), statusChip(q.status)),
        h('dl', { class: 'kvs' }, row('Received', fmtDate(q.created)), row('Email', q.email), row('Phone', q.phone), row('Interested in', q.interest), row('Arrival', q.date), row('Guests', q.guests ? String(q.guests) : '')),
        h('div', { class: 'enq-msg', text: q.message }),
        h('div', { class: 'enq-actions' },
          h('a', { class: 'btn btn--primary', href: `mailto:${encodeURIComponent(q.email)}?subject=${subject}`, onclick: () => { if (q.status !== 'replied') setStatus(q, 'replied', true); } }, 'Reply by email'),
          q.phone ? h('a', { class: 'btn btn--ghost', href: 'tel:' + String(q.phone).replace(/[^\d+]/g, '') }, 'Call') : null,
          h('label', { class: 'f f--inline' }, h('span', { class: 'f__label', text: 'Status' }),
            h('select', { onchange: (e) => setStatus(q, e.target.value) }, ['new', 'in progress', 'replied', 'archived'].map((s) => h('option', { value: s, selected: q.status === s }, s)))),
          h('button', { class: 'btn btn--danger-ghost', onclick: async () => {
            if (!(await confirmBox('Delete this enquiry permanently?'))) return;
            try { await Store.deleteEnquiry(q.id); toast('Enquiry deleted'); viewEnquiries.open = null; await refreshEnquiries(); draw(); detail.replaceChildren(empty()); } catch (e) { fail(e); }
          } }, 'Delete')));
      if (q.status === 'new') setStatus(q, 'in progress', true);
    };
    const setStatus = async (q, s, quiet) => {
      try {
        await Store.updateEnquiry(q.id, { status: s });
        await refreshEnquiries(); draw();
        const fresh = enquiriesCache.find((x) => x.id === q.id);
        if (fresh && !quiet) show(fresh);
        else if (fresh) { q.status = fresh.status; detail.querySelector('.enq-detail__head .chip')?.replaceWith(statusChip(fresh.status)); const sel = detail.querySelector('select'); if (sel) sel.value = fresh.status; }
        if (!quiet) toast('Status updated');
      } catch (e) { fail(e); }
    };
    const exportCSV = () => {
      const cols = ['created', 'status', 'name', 'email', 'phone', 'interest', 'date', 'guests', 'message'];
      const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
      download(`enquiries-${new Date().toISOString().slice(0, 10)}.csv`, '﻿' + [cols.join(','), ...enquiriesCache.map((q) => cols.map((c) => esc(q[c])).join(','))].join('\n'), 'text/csv');
    };
    view.append(tabs, h('div', { class: 'enq-wrap' }, h('div', { class: 'panel panel--flush' }, listEl), detail));
    await refreshEnquiries();
    draw();
    const pre = enquiriesCache.find((q) => q.id === viewEnquiries.open);
    if (pre) show(pre);
  }

  async function viewMedia(view) {
    setHead('Media library', LOCAL ? 'Images are stored in this browser until Firebase is connected.' : 'Upload photos once, then use them anywhere on the site.');
    const grid = h('div', { class: 'media-grid' });
    const drop = h('label', { class: 'drop' },
      h('input', { type: 'file', accept: 'image/jpeg,image/png,image/webp,image/gif', multiple: true, hidden: true, onchange: async (e) => { await uploadFiles(e.target.files); e.target.value = ''; load(); } }),
      h('strong', { text: 'Drop images here or click to upload' }),
      h('span', { class: 'muted', text: LOCAL ? 'Demo mode: images are compressed and kept in this browser (a few MB max).' : 'JPG, PNG, WebP or GIF · large photos are resized automatically' }));
    ['dragenter', 'dragover'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('is-over'); }));
    ['dragleave', 'drop'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('is-over'); }));
    drop.addEventListener('drop', async (e) => { await uploadFiles(e.dataTransfer.files); load(); });
    const load = async () => {
      const media = await Store.listMedia();
      const used = JSON.stringify(content);
      grid.replaceChildren(...(media.length ? media.map((m) => {
        const inUse = used.includes(m.url);
        return h('div', { class: 'media-card media-card--static' },
          h('a', { href: m.url, target: '_blank' }, h('img', { src: m.url, alt: '', loading: 'lazy' })),
          h('div', { class: 'media-card__meta' },
            h('span', { class: 'media-card__name', text: m.name, title: m.name }),
            h('small', { class: 'muted', text: [m.w && m.h ? `${m.w}×${m.h}` : '', fmtSize(m.size)].filter(Boolean).join(' · ') }),
            inUse ? h('span', { class: 'chip chip--replied', text: 'In use' }) : h('span', { class: 'chip chip--muted', text: 'Unused' })),
          h('div', { class: 'media-card__acts' },
            LOCAL ? null : h('button', { class: 'btn btn--ghost btn--sm', onclick: () => { navigator.clipboard?.writeText(m.url); toast('Image link copied'); } }, 'Copy link'),
            h('button', { class: 'btn btn--danger-ghost btn--sm', onclick: async () => {
              if (!(await confirmBox(inUse ? `“${m.name}” is used on the website. Deleting it will leave an empty image there. Delete anyway?` : `Delete “${m.name}”?`))) return;
              try { await Store.deleteMedia(m); toast('Image deleted'); load(); } catch (e) { fail(e); }
            } }, 'Delete')));
      }) : [h('p', { class: 'muted', text: 'No images uploaded yet.' })]));
    };
    view.append(drop, grid);
    await load();
  }

  async function viewBackups(view) {
    setHead('Backups & export', 'A copy is kept automatically before every save.');
    const backups = await Store.listBackups();
    view.append(
      h('div', { class: 'panel' }, h('h2', { class: 'panel__title', text: 'Export & import' }),
        h('p', { class: 'muted', text: LOCAL
          ? 'To publish your edits while Firebase is not connected: download content.js and replace the file data/content.js in the GitHub repository. The live site will then show your changes.'
          : 'Download a full copy of the content for safekeeping, or to use as the default content in GitHub (data/content.js).' }),
        h('div', { class: 'btn-row' },
          h('button', { class: 'btn btn--primary', onclick: () => {
            if (isDirty()) return toast('Save your changes first.', 'error');
            download('content.js', '/* Default website content — exported from the admin on ' + new Date().toISOString() + ' */\nwindow.ZEN_DEFAULT_CONTENT = ' + JSON.stringify(content, null, 2) + ';\n', 'text/javascript');
          } }, 'Download content.js'),
          h('button', { class: 'btn btn--ghost', onclick: () => download('zenitude-content.json', JSON.stringify(content, null, 2), 'application/json') }, 'Download JSON'),
          h('label', { class: 'btn btn--ghost' }, 'Import JSON / content.js', h('input', { type: 'file', accept: '.json,.js', hidden: true, onchange: async (e) => {
            try {
              const text = await e.target.files[0].text();
              let t = text.trim();
              if (!t.startsWith('{')) t = t.slice(t.indexOf('{'), t.lastIndexOf('}') + 1); // content.js → JSON part
              const data = JSON.parse(t);
              if (!data.settings || !data.home) throw new Error('This file does not look like website content.');
              if (!(await confirmBox('Replace the content in the editor with this file? Nothing is published until you press Save.', 'Load file', false))) return;
              content = data; markDirty(); toast('File loaded — review it, then press Save.'); go();
            } catch (err) { fail(new Error('Import failed: ' + err.message)); }
            e.target.value = '';
          } })),
          h('button', { class: 'btn btn--danger-ghost', onclick: async () => {
            if (!(await confirmBox('Reset all content to the defaults in data/content.js? The current version is backed up first.', 'Reset'))) return;
            try { content = await Store.resetToDefault(); savedJSON = JSON.stringify(content); markDirty(); toast('Content reset to defaults'); go(); } catch (e) { fail(e); }
          } }, 'Reset to defaults'))),
      h('div', { class: 'panel panel--flush' }, backups.length ? h('table', { class: 'table' },
        h('thead', {}, h('tr', {}, h('th', { text: 'Saved' }), h('th', { text: 'By' }), h('th', { text: 'Size' }), h('th'))),
        h('tbody', {}, backups.map((b) => h('tr', {},
          h('td', { text: fmtDate(b.savedAt) }), h('td', { class: 'muted', text: b.by || '—' }), h('td', { text: fmtSize(b.size) }),
          h('td', { class: 'right' }, h('button', { class: 'btn btn--ghost btn--sm', onclick: async () => {
            if (!(await confirmBox(`Restore the content as it was on ${fmtDate(b.savedAt)}? The current version is backed up first.`, 'Restore', false))) return;
            try { content = await Store.restoreBackup(b.id); savedJSON = JSON.stringify(content); markDirty(); toast('Backup restored'); go(); } catch (e) { fail(e); }
          } }, 'Restore'))))))
        : h('p', { class: 'muted pad', text: 'No backups yet — one is created every time you save.' })));
  }

  function viewAccount(view) {
    setHead('Account', LOCAL ? 'Sign-in is provided by Firebase Authentication.' : 'Your admin account.');
    if (LOCAL) {
      view.append(h('div', { class: 'panel' }, h('h2', { class: 'panel__title', text: 'Connect Firebase to enable sign-in' }),
        h('p', { class: 'muted', text: 'In demo mode anyone who opens /admin can use it, but nothing they change reaches the public website. After connecting Firebase, the admin requires a login and changes publish instantly.' }),
        h('ol', { class: 'steps' },
          h('li', {}, 'Create a project at console.firebase.google.com and add a Web app.'),
          h('li', {}, 'Enable Authentication (Email/Password), Firestore Database and Storage.'),
          h('li', {}, 'Paste the web config into ', h('code', { text: 'assets/js/firebase-config.js' }), '.'),
          h('li', {}, 'Publish the rules: ', h('code', { text: 'firebase deploy --only firestore:rules,storage' }), '.'),
          h('li', {}, 'Add an admin user in Authentication, copy their UID, and create a document ', h('code', { text: 'admins/<UID>' }), ' in Firestore.'),
          h('li', {}, 'Sign in at /admin and press Save once to copy the content into Firestore.'))));
      return;
    }
    const pw = { current: '', next: '', confirm: '' };
    view.append(h('div', { class: 'dash' },
      h('form', { class: 'panel', onsubmit: async (e) => {
        e.preventDefault();
        if (pw.next !== pw.confirm) return toast('The new passwords do not match.', 'error');
        if (pw.next.length < 10) return toast('Use at least 10 characters.', 'error');
        try { await Store.auth.changePassword(pw.current, pw.next); toast('Password changed'); e.target.reset(); } catch (err) { fail(err); }
      } }, h('h2', { class: 'panel__title', text: 'Change your password' }),
        h('p', { class: 'muted', text: 'Signed in as ' + (USER && USER.email) }),
        h('div', { class: 'grid-fields' },
          field('Current password', h('input', { type: 'password', autocomplete: 'current-password', required: true, oninput: (e) => { pw.current = e.target.value; } })),
          field('New password', h('input', { type: 'password', autocomplete: 'new-password', required: true, oninput: (e) => { pw.next = e.target.value; } }), 'At least 10 characters.'),
          field('Repeat new password', h('input', { type: 'password', autocomplete: 'new-password', required: true, oninput: (e) => { pw.confirm = e.target.value; } }))),
        h('button', { class: 'btn btn--primary', type: 'submit' }, 'Update password')),
      h('div', { class: 'panel' }, h('h2', { class: 'panel__title', text: 'Adding another admin' }),
        h('ol', { class: 'steps' },
          h('li', {}, 'Firebase console → Authentication → Add user (email + temporary password).'),
          h('li', {}, 'Copy the new user\'s UID.'),
          h('li', {}, 'Firestore → collection ', h('code', { text: 'admins' }), ' → add a document whose ID is that UID (add a field "email").'),
          h('li', {}, 'To remove access, delete that document (and optionally the user).')))));
  }

  /* ======================= save / discard ======================= */
  async function save() {
    const btn = document.getElementById('saveBtn');
    btn.disabled = true; btn.textContent = 'Saving…';
    try {
      validate(content);
      content = await Store.saveContent(content, USER && USER.email);
      savedJSON = JSON.stringify(content);
      toast(LOCAL ? 'Saved in this browser. Use Backups & export → Download content.js to publish.' : 'Saved — your changes are live on the website.');
      if (SECTIONS[route]) go();
    } catch (e) { fail(e); }
    btn.textContent = LOCAL ? 'Save' : 'Save & publish';
    markDirty();
  }

  async function discard() {
    if (!isDirty() || !(await confirmBox('Discard all unsaved changes?', 'Discard'))) return;
    content = JSON.parse(savedJSON); markDirty(); go(); toast('Changes discarded', 'info');
  }

  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's' && content) { e.preventDefault(); if (isDirty()) save(); }
  });

  async function logout() {
    if (isDirty() && !(await confirmBox('You have unsaved changes. Sign out anyway?', 'Sign out'))) return;
    savedJSON = JSON.stringify(content);
    await Store.auth.logout();
  }

  /* ======================= auth ======================= */
  function renderLogin(msg) {
    const vals = {};
    const err = h('p', { class: 'auth__err', role: 'alert', text: msg || '' });
    const btn = h('button', { class: 'btn btn--primary btn--full', type: 'submit' }, 'Sign in');
    app.className = 'auth';
    app.replaceChildren(h('form', { class: 'auth__box', onsubmit: async (e) => {
      e.preventDefault(); err.textContent = ''; btn.disabled = true;
      try { await Store.auth.login(vals.email, vals.password); } catch (ex) { err.textContent = ex.message; }
      btn.disabled = false;
    } },
      h('img', { src: '../assets/img/logo-green.png', alt: 'Zenitude Concierge', class: 'auth__logo' }),
      h('h1', { text: 'Admin sign in' }), h('p', { class: 'muted', text: 'Manage the Zenitude Concierge website.' }),
      field('Email', h('input', { type: 'email', autocomplete: 'username', required: true, oninput: (e) => { vals.email = e.target.value.trim(); } })),
      field('Password', h('input', { type: 'password', autocomplete: 'current-password', required: true, oninput: (e) => { vals.password = e.target.value; } })),
      err, btn));
    app.querySelector('input')?.focus();
  }

  async function startApp() {
    content = await Store.getContent();
    savedJSON = JSON.stringify(content);
    shell();
    window.onhashchange = go;
    go();
    refreshEnquiries().catch(() => {});
  }

  (async () => {
    try {
      if (LOCAL) { USER = await Store.auth.login(); return startApp(); }
      await Store.auth.onChange((u) => {
        const was = USER;
        USER = u;
        if (u && !was) startApp().catch(fail);
        if (!u) { content = null; renderLogin(was ? 'You have been signed out.' : ''); }
      });
    } catch (e) {
      app.className = 'auth';
      app.replaceChildren(h('div', { class: 'auth__box' }, h('h1', { text: 'Admin unavailable' }), h('p', { text: e.message }), h('p', { class: 'muted', text: 'Check the Firebase configuration and your internet connection.' })));
    }
  })();
})();

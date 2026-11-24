/* =========================================================
   ZenStore — the ONLY place the website talks to data.
   ---------------------------------------------------------
   • No Firebase config  → "local" mode: content comes from data/content.js,
     admin edits are kept in this browser (localStorage). Good for building
     and previewing; use Backups → "Download content.js" to publish.
   • Firebase configured → content in Firestore, images in Storage,
     admin login with Firebase Authentication. Nothing else changes.
   ========================================================= */
(function () {
  'use strict';

  const cfg = window.ZEN_FIREBASE_CONFIG;
  const MODE = cfg && cfg.apiKey ? 'firebase' : 'local';
  const DEFAULT = window.ZEN_DEFAULT_CONTENT || {};
  const SDK = 'https://www.gstatic.com/firebasejs/10.12.2/';

  const clone = (o) => JSON.parse(JSON.stringify(o));
  // Content saved before a new section existed (e.g. "stays") gets that section from the defaults.
  const withDefaults = (c) => {
    const out = c && typeof c === 'object' ? c : {};
    for (const k of Object.keys(DEFAULT)) if (!(k in out)) out[k] = clone(DEFAULT[k]);
    return out;
  };
  /* One-time content updates. Each runs once per saved content (its id is recorded in
     content._migrations), so anything changed later in the admin is never overwritten. */
  const MIGRATIONS = [
    ['2026-11-hide-experiences', (c) => { (c.experiences || []).forEach((x) => { x.published = false; }); }],
    ['2026-11-hide-rodrigues', (c) => { (c.destinations || []).forEach((d) => { if (d.slug === 'rodrigues') d.published = false; }); }],
    ['2026-11-show-rodrigues-again', (c) => { (c.destinations || []).forEach((d) => { if (d.slug === 'rodrigues') d.published = true; }); }],
    ['2026-11-personal-excellence-middle', (c) => {
      const s = c.services || [];
      const i = s.findIndex((x) => /personal excellence/i.test(x.title || ''));
      if (i > -1 && s.length >= 3 && i !== 1) { const [x] = s.splice(i, 1); s.splice(1, 0, x); }
    }],
  ];
  const migrate = (c) => {
    if (!Array.isArray(c._migrations)) c._migrations = [];
    for (const [id, fn] of MIGRATIONS) if (!c._migrations.includes(id)) { try { fn(c); } catch (e) {} c._migrations.push(id); }
    return c;
  };
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const nowISO = () => new Date().toISOString();

  /* ---------- shared: resize an image file in the browser ---------- */
  function resizeImage(file, max = 2400, quality = 0.85, forceJpeg = false) {
    return new Promise((resolve, reject) => {
      if (!/^image\/(jpeg|png|webp|gif)$/.test(file.type)) return reject(new Error('Only JPG, PNG, WebP or GIF images are allowed.'));
      if (file.size > 15 * 1024 * 1024) return reject(new Error('Images must be under 15 MB.'));
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        const r = Math.min(1, max / Math.max(img.width, img.height));
        const w = Math.round(img.width * r), h = Math.round(img.height * r);
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        const type = file.type === 'image/png' && !forceJpeg ? 'image/png' : 'image/jpeg';
        const ctx = canvas.getContext('2d');
        if (type === 'image/jpeg') { ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, w, h); }
        ctx.drawImage(img, 0, 0, w, h);
        canvas.toBlob((blob) => blob ? resolve({ blob, type, w, h }) : reject(new Error('Could not process the image.')), type, quality);
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('This file is not a readable image.')); };
      img.src = url;
    });
  }
  const blobToDataURL = (blob) => new Promise((res) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.readAsDataURL(blob); });
  // A Firestore document holds max 1 MiB; base64 adds ~33%, so keep the image itself under ~700 KB.
  const MEDIA_MAX_BYTES = 700 * 1024;
  async function compressForDoc(file) {
    const steps = [[1800, 0.82, false], [1600, 0.78, false], [1600, 0.75, true], [1400, 0.72, true], [1200, 0.7, true], [1000, 0.66, true]];
    for (const [max, q, jpeg] of steps) {
      const r = await resizeImage(file, max, q, jpeg);
      if (r.blob.size <= MEDIA_MAX_BYTES) return r;
    }
    throw new Error('This image could not be made small enough — try a smaller image.');
  }
  const safeName = (name, ext) => (String(name).replace(/\.[^.]+$/, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50) || 'image') + '-' + uid().slice(-6) + '.' + ext;

  /* =========================================================
     LOCAL ADAPTER (browser storage)
     ========================================================= */
  const LS = {
    get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set(k, v) {
      try { localStorage.setItem(k, JSON.stringify(v)); }
      catch (e) { throw new Error('Browser storage is full. Remove some uploaded images, or connect Firebase.'); }
    },
  };
  let localUser = null;
  const localAuthListeners = [];

  const local = {
    mode: 'local',
    async getContent() { return migrate(withDefaults(clone(LS.get('zen:content', null) || DEFAULT))); },
    async saveContent(c, by) {
      const prev = LS.get('zen:content', null) || DEFAULT;
      {
        const hist = LS.get('zen:history', []);
        hist.unshift({ id: uid(), savedAt: nowISO(), by: by || '', json: JSON.stringify(prev) });
        LS.set('zen:history', hist.slice(0, 15));
      }
      LS.set('zen:content', c);
      return clone(c);
    },
    async listBackups() { return LS.get('zen:history', []).map(({ id, savedAt, by, json }) => ({ id, savedAt, by, size: json.length })); },
    async restoreBackup(id) {
      const b = LS.get('zen:history', []).find((x) => x.id === id);
      if (!b) throw new Error('Backup not found.');
      return this.saveContent(JSON.parse(b.json));
    },
    async resetToDefault() { await this.saveContent(clone(DEFAULT)); return clone(DEFAULT); },

    async addEnquiry(e) {
      const list = LS.get('zen:enquiries', []);
      list.unshift({ ...e, id: uid(), status: 'new', created: nowISO() });
      LS.set('zen:enquiries', list.slice(0, 500));
      return { stored: true, delivered: false }; // not delivered to the team: caller opens the email app
    },
    async listEnquiries() { return LS.get('zen:enquiries', []); },
    async updateEnquiry(id, patch) { LS.set('zen:enquiries', LS.get('zen:enquiries', []).map((q) => q.id === id ? { ...q, ...patch, updated: nowISO() } : q)); },
    async deleteEnquiry(id) { LS.set('zen:enquiries', LS.get('zen:enquiries', []).filter((q) => q.id !== id)); },

    async uploadImage(file) {
      const { blob, type, w, h } = await resizeImage(file, 1600, 0.8);
      const url = await blobToDataURL(blob);
      const media = LS.get('zen:media', []);
      const item = { id: uid(), name: safeName(file.name, type === 'image/png' ? 'png' : 'jpg'), url, w, h, size: blob.size, created: nowISO() };
      media.unshift(item);
      LS.set('zen:media', media);
      return item.url;
    },
    async listMedia() { return LS.get('zen:media', []).map((m) => ({ ...m, ref: m.url })); },
    async getMedia() { return ''; },
    async deleteMedia(item) { LS.set('zen:media', LS.get('zen:media', []).filter((m) => m.id !== item.id)); },

    auth: {
      needsLogin: false,
      current: () => localUser,
      async login() { localUser = { email: 'demo', uid: 'local' }; localAuthListeners.forEach((f) => f(localUser)); return localUser; },
      async logout() { localUser = null; localAuthListeners.forEach((f) => f(null)); },
      onChange(cb) { localAuthListeners.push(cb); cb(localUser); },
      async changePassword() { throw new Error('Passwords are managed by Firebase — connect it first.'); },
    },
  };

  /* =========================================================
     FIREBASE ADAPTER (Firestore + Auth + Storage, compat SDK)
     Data layout:
       site/content              { json, updatedAt, updatedBy }
       site/content/history/{id} { json, savedAt, by }
       enquiries/{id}            { name, email, …, status, createdAt }
       admins/{uid}              { email }   ← existence = admin rights
       Storage: uploads/{file}
     ========================================================= */
  const loaded = {};
  function loadScript(src) {
    if (!loaded[src]) loaded[src] = new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = src; s.onload = res; s.onerror = () => rej(new Error('Could not load Firebase (' + src.split('/').pop() + '). Check the internet connection.'));
      document.head.appendChild(s);
    });
    return loaded[src];
  }
  async function fb(parts) {
    await loadScript(SDK + 'firebase-app-compat.js');
    await Promise.all(parts.map((p) => loadScript(SDK + `firebase-${p}-compat.js`)));
    if (!firebase.apps.length) firebase.initializeApp(cfg);
    return firebase;
  }
  const mediaMem = new Map(); // id → data URL (or pending promise)
  const db = async () => (await fb(['firestore'])).firestore();
  const ts = (v) => (v && v.toDate ? v.toDate().toISOString() : v || '');

  const remote = {
    mode: 'firebase',
    async getContent() {
      try {
        const snap = await (await db()).doc('site/content').get();
        if (snap.exists && snap.data().json) return migrate(withDefaults(JSON.parse(snap.data().json)));
      } catch (e) { console.warn('[ZenStore] using default content:', e.message); }
      return migrate(clone(DEFAULT));
    },
    async saveContent(c, by) {
      const d = await db();
      const ref = d.doc('site/content');
      const prev = await ref.get();
      const batch = d.batch();
      if (prev.exists && prev.data().json) batch.set(ref.collection('history').doc(), { json: prev.data().json, savedAt: firebase.firestore.FieldValue.serverTimestamp(), by: prev.data().updatedBy || '' });
      batch.set(ref, { json: JSON.stringify(c), updatedAt: firebase.firestore.FieldValue.serverTimestamp(), updatedBy: by || '' });
      await batch.commit();
      return clone(c);
    },
    async listBackups() {
      const q = await (await db()).collection('site/content/history').orderBy('savedAt', 'desc').limit(40).get();
      return q.docs.map((d) => ({ id: d.id, savedAt: ts(d.data().savedAt), by: d.data().by, size: (d.data().json || '').length }));
    },
    async restoreBackup(id) {
      const snap = await (await db()).doc('site/content/history/' + id).get();
      if (!snap.exists) throw new Error('Backup not found.');
      return this.saveContent(JSON.parse(snap.data().json), 'restore');
    },
    async resetToDefault() { return this.saveContent(clone(DEFAULT), 'reset'); },

    async addEnquiry(e) {
      await (await db()).collection('enquiries').add({ ...e, status: 'new', createdAt: firebase.firestore.FieldValue.serverTimestamp() });
      return { stored: true, delivered: true };
    },
    async listEnquiries() {
      const q = await (await db()).collection('enquiries').orderBy('createdAt', 'desc').limit(500).get();
      return q.docs.map((d) => ({ ...d.data(), id: d.id, created: ts(d.data().createdAt) }));
    },
    async updateEnquiry(id, patch) { await (await db()).doc('enquiries/' + id).update(patch); },
    async deleteEnquiry(id) { await (await db()).doc('enquiries/' + id).delete(); },

    /* Images live in Firestore (collection "media"), one compressed image per document,
       so no paid Firebase Storage plan is needed. Content refers to them as "media:<id>". */
    async uploadImage(file) {
      const { blob, type, w, h } = await compressForDoc(file);
      const data = await blobToDataURL(blob);
      const ref = (await db()).collection('media').doc();
      await ref.set({ name: safeName(file.name, type === 'image/png' ? 'png' : 'jpg'), type, w, h, size: blob.size, data, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
      mediaMem.set(ref.id, data);
      return 'media:' + ref.id;
    },
    async listMedia() {
      const q = await (await db()).collection('media').orderBy('createdAt', 'desc').limit(300).get();
      return q.docs.map((d) => {
        const m = d.data();
        mediaMem.set(d.id, m.data);
        return { id: d.id, ref: 'media:' + d.id, name: m.name, url: m.data, w: m.w, h: m.h, size: m.size, created: ts(m.createdAt) };
      });
    },
    async deleteMedia(item) { await (await db()).doc('media/' + item.id).delete(); mediaMem.delete(item.id); try { sessionStorage.removeItem('zen:m:' + item.id); } catch (e) {} },
    async getMedia(id) {
      if (!/^[A-Za-z0-9]{1,64}$/.test(id)) return '';
      if (mediaMem.has(id)) return mediaMem.get(id);
      try { const c = sessionStorage.getItem('zen:m:' + id); if (c) { mediaMem.set(id, c); return c; } } catch (e) {}
      const p = (async () => {
        const snap = await (await db()).doc('media/' + id).get();
        const v = snap.exists ? snap.data().data || '' : '';
        mediaMem.set(id, v);
        if (v) { try { sessionStorage.setItem('zen:m:' + id, v); } catch (e) {} }
        return v;
      })().catch(() => { mediaMem.delete(id); return ''; });
      mediaMem.set(id, p);
      return p;
    },

    auth: {
      needsLogin: true,
      current: () => (window.firebase && firebase.apps.length && firebase.auth ? firebase.auth().currentUser : null),
      async login(email, password) {
        const f = await fb(['auth', 'firestore']);
        try {
          const { user } = await f.auth().signInWithEmailAndPassword(email, password);
          const adm = await f.firestore().doc('admins/' + user.uid).get();
          if (!adm.exists) { await f.auth().signOut(); throw new Error('This account is not an admin. Ask the IT team to add it in Firebase (admins collection).'); }
          return user;
        } catch (e) {
          if (/auth\/(invalid-credential|wrong-password|user-not-found|invalid-email)/.test(e.code || '')) throw new Error('Incorrect email or password.');
          if (/too-many-requests/.test(e.code || '')) throw new Error('Too many attempts — please wait a few minutes.');
          throw e;
        }
      },
      async logout() { const f = await fb(['auth']); await f.auth().signOut(); },
      async onChange(cb) {
        const f = await fb(['auth', 'firestore']);
        f.auth().onAuthStateChanged(async (u) => {
          if (!u) return cb(null);
          const adm = await f.firestore().doc('admins/' + u.uid).get().catch(() => null);
          cb(adm && adm.exists ? u : null);
        });
      },
      async changePassword(current, next) {
        const f = await fb(['auth']);
        const u = f.auth().currentUser;
        const cred = firebase.auth.EmailAuthProvider.credential(u.email, current);
        await u.reauthenticateWithCredential(cred).catch(() => { throw new Error('Current password is incorrect.'); });
        await u.updatePassword(next);
      },
    },
  };

  window.ZenStore = MODE === 'firebase' ? remote : local;
  window.ZenStore.defaults = () => clone(DEFAULT);
})();

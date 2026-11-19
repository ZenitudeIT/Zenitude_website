/* ZENITUDE CONCIERGE — interactions (all pages). Called by templates.js after rendering. */
window.ZenSite = { init() {
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;

  /* ---------- preloader (full intro only once per visit) ---------- */
  const pre = $('#preloader');
  let seen = false;
  try { seen = sessionStorage.getItem('zen-intro') === '1'; sessionStorage.setItem('zen-intro', '1'); } catch (e) {}
  document.body.classList.add('is-loading');
  const finishLoading = () => {
    if (!pre || pre.classList.contains('is-done')) return;
    pre.classList.add('is-done');
    document.body.classList.remove('is-loading');
    document.body.classList.add('is-ready');
  };
  const delay = reduceMotion ? 0 : seen ? 250 : 1300;
  if (document.readyState === 'complete') setTimeout(finishLoading, delay);
  else window.addEventListener('load', () => setTimeout(finishLoading, delay));
  setTimeout(finishLoading, 3500);

  /* ---------- image fallbacks (missing photos → branded panel) ---------- */
  const markBroken = (img) => {
    const box = img.closest('.frame, .member__photo');
    if (box) box.classList.add('frame--fallback');
  };
  $$('img[data-remove-on-error]').forEach((img) => {
    const kill = () => { const sel = img.dataset.removeOnError; (sel ? img.closest(sel) : img)?.remove(); };
    if (img.complete && img.naturalWidth === 0) kill(); else img.addEventListener('error', kill);
  });
  $$('img[data-fallback]').forEach((img) => {
    if (!img.getAttribute('src')) return markBroken(img);
    if (img.complete && img.naturalWidth === 0) markBroken(img);
    img.addEventListener('error', () => markBroken(img));
  });

  if (location.hash.length > 1) {
    const target = document.getElementById(decodeURIComponent(location.hash.slice(1)));
    if (target) setTimeout(() => target.scrollIntoView({ behavior: 'instant', block: 'start' }), 60);
  }

  /* ---------- stays: keep the selected coast tab visible on small screens ---------- */
  const activeTab = $('.coast-tab.is-active');
  if (activeTab) {
    const bar = activeTab.parentElement;
    bar.scrollLeft = activeTab.offsetLeft - (bar.clientWidth - activeTab.offsetWidth) / 2;
  }

  /* ---------- header + back-to-top ---------- */
  const header = $('#header');
  const toTop = $('#toTop');
  const onScroll = () => {
    const y = window.scrollY;
    header && header.classList.toggle('is-scrolled', y > 60);
    toTop && toTop.classList.toggle('is-visible', y > window.innerHeight * 0.9);
  };
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  /* ---------- mobile menu ---------- */
  const burger = $('#burger');
  const nav = $('#nav');
  if (burger && nav) {
    const setMenu = (open) => {
      nav.classList.toggle('is-open', open);
      burger.setAttribute('aria-expanded', String(open));
      burger.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
      document.body.style.overflow = open ? 'hidden' : '';
    };
    burger.addEventListener('click', () => setMenu(!nav.classList.contains('is-open')));
    $$('a', nav).forEach((a) => a.addEventListener('click', () => setMenu(false)));
    document.addEventListener('keydown', (e) => e.key === 'Escape' && setMenu(false));
  }

  /* ---------- active nav link (home sections) ---------- */
  const navLinks = $$('.nav > a[href*="#"]:not(.nav__cta)');
  const targets = navLinks.map((a) => {
    const id = a.getAttribute('href').split('#')[1];
    return id ? document.getElementById(id) : null;
  });
  if (targets.some(Boolean)) {
    const spy = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (!en.isIntersecting) return;
        navLinks.forEach((a) => a.classList.toggle('is-current', a.getAttribute('href').endsWith('#' + en.target.id)));
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    targets.filter(Boolean).forEach((s) => spy.observe(s));
  }

  /* ---------- reveal on scroll ---------- */
  const revealer = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (!en.isIntersecting) return;
      const el = en.target;
      const siblings = $$(':scope > .reveal', el.parentElement);
      el.style.transitionDelay = Math.min(Math.max(siblings.indexOf(el), 0), 5) * 90 + 'ms';
      el.classList.add('is-in');
      revealer.unobserve(el);
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
  $$('.reveal').forEach((el) => revealer.observe(el));

  /* ---------- counters ---------- */
  const counter = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (!en.isIntersecting) return;
      const el = en.target;
      const target = +el.dataset.count;
      const start = performance.now();
      const tick = (t) => {
        const p = Math.min((t - start) / 1400, 1);
        el.textContent = Math.round(target * (1 - Math.pow(1 - p, 3)));
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
      counter.unobserve(el);
    });
  }, { threshold: 0.6 });
  if (!reduceMotion) $$('[data-count]').forEach((el) => counter.observe(el));

  /* ---------- emblem cursor companion ring ---------- */
  const ring = $('#cursorRing');
  if (ring && finePointer && !reduceMotion) {
    let mx = -100, my = -100, rx = -100, ry = -100;
    window.addEventListener('mousemove', (e) => { mx = e.clientX; my = e.clientY; ring.classList.add('is-visible'); }, { passive: true });
    document.addEventListener('mouseleave', () => ring.classList.remove('is-visible'));
    const loop = () => {
      rx += (mx - rx) * 0.16; ry += (my - ry) * 0.16;
      ring.style.transform = `translate3d(${rx}px, ${ry}px, 0)`;
      requestAnimationFrame(loop);
    };
    loop();
    const hoverables = 'a, button, select, .realm, .dest, .card, .compass__pt, .member, .more__card, .gallery__item';
    document.addEventListener('mouseover', (e) => { if (e.target.closest(hoverables)) ring.classList.add('is-hover'); });
    document.addEventListener('mouseout', (e) => { if (e.target.closest(hoverables)) ring.classList.remove('is-hover'); });
  }

  /* ---------- experiences: desktop click → page, touch → first tap opens ---------- */
  $$('.realm').forEach((r) => {
    const link = $('a', r);
    r.addEventListener('click', (e) => {
      if (e.target.closest('a')) return;
      if (finePointer || r.classList.contains('is-open')) { if (link) location.href = link.href; return; }
      $$('.realm').forEach((o) => o !== r && o.classList.remove('is-open'));
      r.classList.add('is-open');
    });
    r.addEventListener('keydown', (e) => { if (e.key === 'Enter' && link) location.href = link.href; });
  });

  /* ---------- team: tap to reveal bio on touch ---------- */
  $$('.member').forEach((m) => m.addEventListener('click', () => {
    if (finePointer) return;
    $$('.member').forEach((o) => o !== m && o.classList.remove('is-open'));
    m.classList.toggle('is-open');
  }));

  /* ---------- accommodation compass ---------- */
  const panel = $('.compass__panel');
  const emblem = $('#compassEmblem');
  if (panel && emblem) {
    let spin = 0;
    $$('.compass__pt').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (btn.classList.contains('is-active')) return;
        $$('.compass__pt').forEach((b) => b.classList.toggle('is-active', b === btn));
        const current = ((spin % 360) + 360) % 360;
        let delta = -(+btn.dataset.rot || 0) - current;
        delta = ((delta + 540) % 360) - 180;
        spin += delta;
        emblem.style.transform = `rotate(${spin}deg)`;
        panel.classList.add('is-swapping');
        setTimeout(() => {
          $('#regionTitle').textContent = btn.dataset.title;
          $('#regionKicker').textContent = btn.dataset.kicker;
          $('#regionDesc').textContent = btn.dataset.desc;
          const stayLink = $('#stayLink');
          if (stayLink && btn.dataset.key) stayLink.href = 'stays.html?region=' + encodeURIComponent(btn.dataset.key);
          panel.classList.remove('is-swapping');
        }, 380);
      });
    });
  }

  /* ---------- testimonial slider ---------- */
  const slider = $('#slider');
  if (slider) {
    const quotes = $$('.quote', slider);
    const dotsWrap = $('.slider__dots', slider);
    let idx = 0, timer;
    const go = (i) => {
      idx = (i + quotes.length) % quotes.length;
      quotes.forEach((q, n) => q.classList.toggle('is-active', n === idx));
      $$('button', dotsWrap).forEach((d, n) => d.classList.toggle('is-active', n === idx));
    };
    const restart = () => { clearInterval(timer); if (!reduceMotion && quotes.length > 1) timer = setInterval(() => go(idx + 1), 7000); };
    quotes.forEach((_, i) => {
      const d = document.createElement('button');
      d.setAttribute('role', 'tab');
      d.setAttribute('aria-label', `Show testimonial ${i + 1}`);
      d.addEventListener('click', () => { go(i); restart(); });
      dotsWrap.appendChild(d);
    });
    $$('.slider__arrow', slider).forEach((b) => b.addEventListener('click', () => { go(idx + +b.dataset.dir); restart(); }));
    slider.addEventListener('mouseenter', () => clearInterval(timer));
    slider.addEventListener('mouseleave', restart);
    go(0); restart();
  }

  /* ---------- gallery lightbox ---------- */
  const lb = $('#lightbox');
  if (lb) {
    const lbImg = $('img', lb);
    const close = () => { lb.hidden = true; lbImg.removeAttribute('src'); };
    $$('[data-lightbox]').forEach((a) => a.addEventListener('click', (e) => { e.preventDefault(); lbImg.src = a.href; lb.hidden = false; }));
    lb.addEventListener('click', (e) => { if (e.target !== lbImg) close(); });
    document.addEventListener('keydown', (e) => e.key === 'Escape' && close());
  }

  /* ---------- contact form → ZenStore ---------- */
  const form = $('#contactForm');
  if (form) {
    const note = $('#formNote');
    const message = form.elements.message;
    const select = form.elements.interest;
    const openedAt = Date.now();

    // pre-fill from ?enquire=Madagascar (links on destination / experience pages)
    const params = new URLSearchParams(location.search);
    const wanted = params.get('enquire');
    const stay = params.get('stay');
    if (wanted) {
      const opt = [...select.options].find((o) => o.value.toLowerCase() === wanted.toLowerCase());
      if (opt) select.value = opt.value;
      if (!message.value) message.value = stay
        ? `I am interested in staying at ${stay}${params.get('region') ? ' (' + params.get('region') + ')' : ''}. Could you send me availability and rates for my dates?`
        : `I would like to know more about ${wanted}.`;
    }

    const mailtoFallback = (d) => {
      const body = [`Name: ${d.name}`, `Email: ${d.email}`, `Phone: ${d.phone || '-'}`, `Interest: ${d.interest}`,
        `Arrival: ${d.date || '-'}`, `Guests: ${d.guests || '-'}`, '', d.message].join('\n');
      location.href = `mailto:${form.dataset.email || 'info@zenitudeconcierge.com'}?subject=${encodeURIComponent('Enquiry — ' + d.interest)}&body=${encodeURIComponent(body)}`;
    };

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      let ok = true;
      $$('[required]', form).forEach((f) => {
        const bad = !f.value.trim() || (f.type === 'email' && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.value.trim()));
        f.closest('.field').classList.toggle('is-invalid', bad);
        if (bad) ok = false;
      });
      if (!ok) { note.textContent = 'Please complete the highlighted fields.'; return; }
      if (form.elements.website.value || Date.now() - openedAt < 3000) { note.textContent = 'Thank you — your enquiry has been received.'; form.reset(); return; } // spam trap

      const f = form.elements;
      const d = {
        name: f.name.value.trim().slice(0, 120), email: f.email.value.trim().slice(0, 160), phone: f.phone.value.trim().slice(0, 40),
        interest: f.interest.value.slice(0, 120), date: /^\d{4}-\d{2}-\d{2}$/.test(f.date.value) ? f.date.value : '',
        guests: f.guests.value ? Math.max(1, Math.min(500, parseInt(f.guests.value, 10) || 1)) : '', message: f.message.value.trim().slice(0, 4000),
      };
      const btn = $('button[type="submit"]', form);
      btn.disabled = true;
      note.textContent = 'Sending…';
      try {
        const r = await window.ZenStore.addEnquiry(d);
        if (r.delivered) {
          note.textContent = 'Thank you — your enquiry has been received. We will be in touch shortly.';
        } else {
          note.textContent = 'Opening your email app to send the enquiry…';
          mailtoFallback(d);
        }
        form.reset();
      } catch (err) {
        console.error(err);
        note.textContent = 'Opening your email app to send the enquiry…';
        mailtoFallback(d);
      } finally {
        btn.disabled = false;
      }
    });
    $$('input, textarea, select', form).forEach((el) => el.addEventListener('input', () => el.closest('.field') && el.closest('.field').classList.remove('is-invalid')));
  }
} };

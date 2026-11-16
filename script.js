/* ZENITUDE CONCIERGE — interactions */
(() => {
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- preloader ---------- */
  document.body.classList.add('is-loading');
  const finishLoading = () => {
    const pre = $('#preloader');
    if (!pre || pre.classList.contains('is-done')) return;
    pre.classList.add('is-done');
    document.body.classList.remove('is-loading');
    document.body.classList.add('is-ready');
  };
  window.addEventListener('load', () => setTimeout(finishLoading, reduceMotion ? 0 : 1300));
  setTimeout(finishLoading, 3500); // safety net if an external image is slow

  /* ---------- header on scroll + back-to-top ---------- */
  const header = $('#header');
  const toTop = $('#toTop');
  const onScroll = () => {
    const y = window.scrollY;
    header.classList.toggle('is-scrolled', y > 60);
    toTop.classList.toggle('is-visible', y > window.innerHeight * 0.9);
  };
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  /* ---------- mobile menu ---------- */
  const burger = $('#burger');
  const nav = $('#nav');
  const setMenu = (open) => {
    nav.classList.toggle('is-open', open);
    burger.setAttribute('aria-expanded', String(open));
    burger.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    document.body.style.overflow = open ? 'hidden' : '';
  };
  burger.addEventListener('click', () => setMenu(!nav.classList.contains('is-open')));
  $$('a', nav).forEach((a) => a.addEventListener('click', () => setMenu(false)));
  document.addEventListener('keydown', (e) => e.key === 'Escape' && setMenu(false));

  /* ---------- active nav link ---------- */
  const navLinks = $$('.nav a[href^="#"]:not(.nav__cta)');
  const sections = navLinks.map((a) => $(a.getAttribute('href'))).filter(Boolean);
  const spy = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (en.isIntersecting) {
        navLinks.forEach((a) => a.classList.toggle('is-current', a.getAttribute('href') === '#' + en.target.id));
      }
    });
  }, { rootMargin: '-45% 0px -50% 0px' });
  sections.forEach((s) => spy.observe(s));

  /* ---------- reveal on scroll ---------- */
  const revealer = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (!en.isIntersecting) return;
      const el = en.target;
      // gentle stagger for siblings revealed together
      const siblings = $$('.reveal', el.parentElement);
      el.style.transitionDelay = Math.min(siblings.indexOf(el), 5) * 90 + 'ms';
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
      const dur = 1400;
      const tick = (t) => {
        const p = Math.min((t - start) / dur, 1);
        el.textContent = Math.round(target * (1 - Math.pow(1 - p, 3)));
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
      counter.unobserve(el);
    });
  }, { threshold: 0.6 });
  $$('[data-count]').forEach((el) => counter.observe(el));

  /* ---------- emblem cursor companion ring ---------- */
  const ring = $('#cursorRing');
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;
  if (ring && finePointer && !reduceMotion) {
    let mx = -100, my = -100, rx = -100, ry = -100;
    window.addEventListener('mousemove', (e) => {
      mx = e.clientX; my = e.clientY;
      ring.classList.add('is-visible');
    }, { passive: true });
    document.addEventListener('mouseleave', () => ring.classList.remove('is-visible'));
    const loop = () => {
      rx += (mx - rx) * 0.16;
      ry += (my - ry) * 0.16;
      ring.style.transform = `translate3d(${rx}px, ${ry}px, 0)`;
      requestAnimationFrame(loop);
    };
    loop();
    const hoverables = 'a, button, select, .realm, .dest, .card, .compass__pt';
    document.addEventListener('mouseover', (e) => {
      if (e.target.closest(hoverables)) ring.classList.add('is-hover');
    });
    document.addEventListener('mouseout', (e) => {
      if (e.target.closest(hoverables)) ring.classList.remove('is-hover');
    });
  }

  /* ---------- experiences: tap to open on touch ---------- */
  $$('.realm').forEach((r) => {
    r.addEventListener('click', () => {
      $$('.realm').forEach((o) => o !== r && o.classList.remove('is-open'));
      r.classList.toggle('is-open');
    });
  });

  /* ---------- accommodation compass ---------- */
  const regions = {
    north: {
      title: 'The North',
      kicker: 'Grand Baie · Trou aux Biches · Pereybère',
      desc: "Calm, sheltered lagoons and the island's liveliest coast — boutique shopping, fine dining and easy access to the northern islets.",
      rot: 0,
    },
    east: {
      title: 'The East',
      kicker: 'Belle Mare · Trou d’Eau Douce · Île aux Cerfs',
      desc: 'Long ribbons of white sand, refreshing trade winds and many of the island’s most celebrated luxury resorts.',
      rot: 90,
    },
    south: {
      title: 'The South',
      kicker: 'Bel Ombre · Blue Bay · Souillac',
      desc: 'Wild, unspoiled and dramatic — rugged cliffs, lush hinterland and a tranquil escape far from the crowds.',
      rot: 180,
    },
    west: {
      title: 'The West',
      kicker: 'Flic en Flac · Tamarin · Le Morne',
      desc: 'Golden sunsets, dolphin bays and the majestic Le Morne Brabant — the sunniest and calmest coast of Mauritius.',
      rot: 270,
    },
  };
  const panel = $('.compass__panel');
  const emblem = $('#compassEmblem');
  let spin = 0;
  $$('.compass__pt').forEach((btn) => {
    btn.addEventListener('click', () => {
      const r = regions[btn.dataset.region];
      if (!r || btn.classList.contains('is-active')) return;
      $$('.compass__pt').forEach((b) => b.classList.toggle('is-active', b === btn));
      // rotate emblem the shortest way so the chosen petal points up
      const current = ((spin % 360) + 360) % 360;
      let delta = -r.rot - current;
      delta = ((delta + 540) % 360) - 180;
      spin += delta;
      emblem.style.transform = `rotate(${spin}deg)`;
      panel.classList.add('is-swapping');
      setTimeout(() => {
        $('#regionTitle').textContent = r.title;
        $('#regionKicker').textContent = r.kicker;
        $('#regionDesc').textContent = r.desc;
        panel.classList.remove('is-swapping');
      }, 380);
    });
  });

  /* ---------- testimonial slider ---------- */
  const slider = $('#slider');
  if (slider) {
    const quotes = $$('.quote', slider);
    const dotsWrap = $('.slider__dots', slider);
    let idx = 0, timer;
    quotes.forEach((_, i) => {
      const d = document.createElement('button');
      d.setAttribute('role', 'tab');
      d.setAttribute('aria-label', `Show testimonial ${i + 1}`);
      d.addEventListener('click', () => { go(i); restart(); });
      dotsWrap.appendChild(d);
    });
    const dots = $$('button', dotsWrap);
    const go = (i) => {
      idx = (i + quotes.length) % quotes.length;
      quotes.forEach((q, n) => q.classList.toggle('is-active', n === idx));
      dots.forEach((d, n) => d.classList.toggle('is-active', n === idx));
    };
    const restart = () => { clearInterval(timer); if (!reduceMotion) timer = setInterval(() => go(idx + 1), 7000); };
    $$('.slider__arrow', slider).forEach((b) => b.addEventListener('click', () => { go(idx + +b.dataset.dir); restart(); }));
    slider.addEventListener('mouseenter', () => clearInterval(timer));
    slider.addEventListener('mouseleave', restart);
    go(0); restart();
  }

  /* ---------- contact form ----------
     No backend yet: validates, then opens the visitor's email app
     pre-filled to info@. Swap for Formspree / WP endpoint when ready. */
  const form = $('#contactForm');
  const note = $('#formNote');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    let ok = true;
    $$('[required]', form).forEach((f) => {
      const bad = !f.value.trim() || (f.type === 'email' && !/^\S+@\S+\.\S+$/.test(f.value));
      f.closest('.field').classList.toggle('is-invalid', bad);
      if (bad) ok = false;
    });
    if (!ok) { note.textContent = 'Please complete the highlighted fields.'; return; }
    const d = Object.fromEntries(new FormData(form));
    const body = [
      `Name: ${d.name}`, `Email: ${d.email}`, `Phone: ${d.phone || '-'}`,
      `Interest: ${d.interest}`, `Arrival: ${d.date || '-'}`, `Guests: ${d.guests || '-'}`,
      '', d.message,
    ].join('\n');
    window.location.href = `mailto:info@zenitudeconcierge.com?subject=${encodeURIComponent('Enquiry — ' + d.interest)}&body=${encodeURIComponent(body)}`;
    note.textContent = 'Thank you — your email app is opening with your enquiry.';
    form.reset();
  });
  $$('input, textarea, select', form).forEach((f) => f.addEventListener('input', () => f.closest('.field').classList.remove('is-invalid')));

  /* ---------- year ---------- */
  $('#year').textContent = new Date().getFullYear();
})();

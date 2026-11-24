/* =========================================================
   ZENITUDE CONCIERGE — page templates
   Renders every page from the content returned by ZenStore.
   All content is escaped before it touches the page.
   ========================================================= */
(function () {
  'use strict';

  /* ---------- safe helpers ---------- */
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const rich = (s) => esc(s).replace(/\*(.+?)\*/gs, '<em>$1</em>').replace(/\n/g, '<br>');
  const paras = (s, cls = '') => String(s || '').trim().split(/\n\s*\n/).filter((p) => p.trim())
    .map((p) => `<p${cls ? ` class="${cls}"` : ''}>${esc(p.trim()).replace(/\n/g, '<br>')}</p>`).join('');
  const img = (src) => {
    src = String(src || '').trim();
    if (!src) return '';
    if (/^https?:\/\//i.test(src) || /^data:image\/(png|jpe?g|webp|gif);base64,/i.test(src)) return src;
    if (/^[a-z][a-z0-9+.-]*:/i.test(src)) return ''; // block javascript:, etc.
    return src.replace(/^\/+/, '');
  };
  const vidSrc = (src) => {
    src = String(src || '').trim();
    if (!src) return '';
    if (/^https?:\/\//i.test(src)) return src;
    if (/^[a-z][a-z0-9+.-]*:/i.test(src)) return '';
    return src.replace(/^\/+/, '');
  };
  const cssUrl = (u) => `url('${String(u).replace(/['"()\\\s]/g, (c) => '%' + c.charCodeAt(0).toString(16).padStart(2, '0'))}')`;
  const safeUrl = (u) => (/^(https?:\/\/|mailto:|tel:)/i.test(String(u || '').trim()) ? String(u).trim() : '');
  const pub = (arr) => (arr || []).filter((x) => x && x.published !== false);
  const pad = (n) => String(n).padStart(2, '0');
  const telHref = (p) => 'tel:' + String(p || '').replace(/[^\d+]/g, '');
  const A = 'assets/img/';

  const PAGE = document.body.dataset.page || 'home';
  const home = (hash) => (PAGE === 'home' ? '#' + hash : 'index.html#' + hash);
  const destUrl = (slug) => 'destination.html?slug=' + encodeURIComponent(slug);
  const expUrl = (slug) => 'experience.html?slug=' + encodeURIComponent(slug);
  const enquireUrl = (topic) => 'index.html?enquire=' + encodeURIComponent(topic) + '#contact';
  const staysUrl = (key) => 'stays.html?region=' + encodeURIComponent(key);
  const stayEnquireUrl = (stay, region) => 'index.html?enquire=Accommodation&stay=' + encodeURIComponent(stay) + (region ? '&region=' + encodeURIComponent(region) : '') + '#contact';
  const REGION_ORDER = ['north', 'east', 'south', 'west'];
  const cap = (k) => String(k || '').charAt(0).toUpperCase() + String(k || '').slice(1);

  const ICONS = {
    air: '<path d="M8 36h34l10-8M20 36l-6 10M30 36v8M22 28h22a6 6 0 0 1 6 6M12 22h30M27 22v6"/>',
    land: '<path d="M4 50 22 22l10 14 8-10 20 24zM18 28l4 4 4-4"/><circle cx="48" cy="14" r="5"/>',
    sea: '<path d="M30 8v30M30 10l16 26H30M30 16 18 36h12M10 40h44l-6 8H16zM4 54c5 0 5-2 10-2s5 2 10 2 5-2 10-2 5 2 10 2 5-2 10-2 5 2 10 2"/>',
    butler: '<path d="M14 46h36M18 46c0-8 6-15 14-15s14 7 14 15M32 31v-4M29 27h6M10 50h44"/>',
    yacht: '<path d="M32 10v30M32 12l14 24H32M32 18 22 36h10M12 42h40l-6 8H18zM8 54c4 0 4-2 8-2s4 2 8 2 4-2 8-2 4 2 8 2 4-2 8-2 4 2 8 2"/>',
    compass: '<circle cx="32" cy="32" r="20"/><path d="m40 24-5 11-11 5 5-11zM32 8v4M32 52v4M8 32h4M52 32h4"/>',
  };
  const icon = (n) => `<svg viewBox="0 0 64 64" aria-hidden="true">${ICONS[n] || ICONS.compass}</svg>`;

  /* ---------- header & footer ---------- */
  function header(c, active) {
    const S = c.settings || {};
    const drop = (items, url) => items.map((x) => `<a href="${esc(url(x.slug))}">${esc(x.name)}</a>`).join('');
    return `
  <header class="header" id="header">
    <div class="header__inner container">
      <a href="index.html" class="header__brand" aria-label="${esc(S.siteName)} — home">
        <img src="${A}emblem-white.png" alt="" class="brand__emblem brand--light" />
        <img src="${A}emblem-green.png" alt="" class="brand__emblem brand--dark" />
        <img src="${A}wordmark-white.png" alt="${esc(S.siteName)}" class="brand__word brand--light" />
        <img src="${A}wordmark-green.png" alt="" class="brand__word brand--dark" />
      </a>
      <nav class="nav" id="nav" aria-label="Main">
        <a href="${home('about')}">About</a>
        <a href="${home('services')}">Services</a>
        <div class="nav__group${active === 'experiences' ? ' is-active' : ''}">
          <a href="${home('experiences')}" class="nav__parent">Experiences</a>
          <div class="nav__drop">${drop(pub(c.experiences), expUrl)}</div>
        </div>
        <div class="nav__group${active === 'destinations' ? ' is-active' : ''}">
          <a href="${home('destinations')}" class="nav__parent">Destinations</a>
          <div class="nav__drop">${drop(pub(c.destinations), destUrl)}</div>
        </div>
        <div class="nav__group${active === 'stays' ? ' is-active' : ''}">
          <a href="${staysUrl((c.regions && c.regions[0] && c.regions[0].key) || 'north')}" class="nav__parent">Stays</a>
          <div class="nav__drop">${(c.regions || []).filter((r) => REGION_ORDER.includes(r.key)).map((r) => `<a href="${esc(staysUrl(r.key))}">${esc(r.title || cap(r.key))}</a>`).join('')}</div>
        </div>
        <a href="team.html"${active === 'team' ? ' class="is-current"' : ''}>Team</a>
        <a href="${home('b2b')}">B2B</a>
        <a href="${home('contact')}" class="nav__cta">Enquire</a>
      </nav>
      <button class="burger" id="burger" aria-label="Open menu" aria-expanded="false" aria-controls="nav"><span></span><span></span></button>
    </div>
  </header>`;
  }

  function footer(c) {
    const S = c.settings || {};
    const social = [['Facebook', safeUrl(S.facebook)], ['Instagram', safeUrl(S.instagram)], ['LinkedIn', safeUrl(S.linkedin)],
      ['WhatsApp', S.whatsapp ? 'https://wa.me/' + String(S.whatsapp).replace(/\D+/g, '') : '']].filter(([, u]) => u);
    return `
  <footer class="footer">
    <div class="container">
      <div class="footer__top">
        <div>
          <img src="${A}logo-white.png" alt="${esc(S.siteName)}" class="footer__logo" />
          <p class="footer__contact"><a href="${esc(telHref(S.phone))}">${esc(S.phone)}</a><br /><a href="mailto:${esc(S.email)}">${esc(S.email)}</a></p>
        </div>
        <div class="footer__cols">
          <div><h4>Explore</h4>
            <a href="${home('about')}">About us</a><a href="team.html">Our team</a><a href="${home('services')}">Services</a><a href="${staysUrl('north')}">Hotels &amp; villas</a>
            ${pub(c.experiences).map((x) => `<a href="${esc(expUrl(x.slug))}">${esc(x.name)} experiences</a>`).join('')}
          </div>
          <div><h4>Destinations</h4>${pub(c.destinations).map((d) => `<a href="${esc(destUrl(d.slug))}">${esc(d.name)}</a>`).join('')}</div>
          <div><h4>Follow</h4>${social.map(([l, u]) => `<a href="${esc(u)}" target="_blank" rel="noopener">${l}</a>`).join('')}</div>
        </div>
      </div>
      <div class="footer__bottom">
        <p>© ${new Date().getFullYear()} ${esc(S.siteName)}. All rights reserved.</p>
        <p><a href="privacy.html">Privacy Policy</a> · <a href="terms.html">Terms</a></p>
      </div>
    </div>
  </footer>
  <a href="#top" class="to-top" id="toTop" aria-label="Back to top"><img src="${A}emblem-white.png" alt="" /></a>`;
  }

  /* ---------- contact (home) ---------- */
  function contact(c) {
    const S = c.settings || {};
    const interests = ['Private Butler / Concierge', 'Yacht Charter & Fishing',
      ...pub(c.experiences).map((x) => x.name + ' experiences'), ...pub(c.destinations).map((d) => d.name),
      'Transfers', 'Accommodation', 'B2B Partnership', 'Other'];
    return `
    <section class="contact section" id="contact">
      <div class="container contact__grid">
        <div class="contact__info">
          <p class="eyebrow reveal">Contact</p>
          <h2 class="section__title reveal">Let us craft <em>your experience</em></h2>
          <p class="reveal">Tell us what you have in mind — we'll respond with a tailored proposal.</p>
          <dl class="details reveal">
            <div><dt>Telephone</dt><dd><a href="${esc(telHref(S.phone))}">${esc(S.phone)}</a></dd></div>
            <div><dt>Email</dt><dd><a href="mailto:${esc(S.email)}">${esc(S.email)}</a></dd></div>
            <div><dt>Office</dt><dd>${esc(S.address).replace(/\n/g, '<br>')}</dd></div>
            <div><dt>Hours</dt><dd>${esc(S.hours).replace(/\n/g, '<br>')}</dd></div>
          </dl>
        </div>
        <form class="form reveal" id="contactForm" novalidate data-email="${esc(S.email)}">
          <div class="form__row">
            <label class="field"><input type="text" name="name" placeholder=" " required maxlength="120" /><span>Full name</span></label>
            <label class="field"><input type="email" name="email" placeholder=" " required maxlength="160" /><span>Email address</span></label>
          </div>
          <div class="form__row">
            <label class="field"><input type="tel" name="phone" placeholder=" " maxlength="40" /><span>Phone (optional)</span></label>
            <label class="field field--select">
              <select name="interest" required><option value="" disabled selected hidden></option>${interests.map((o) => `<option>${esc(o)}</option>`).join('')}</select>
              <span>I'm interested in</span>
            </label>
          </div>
          <div class="form__row">
            <label class="field"><input type="date" name="date" placeholder=" " /><span>Arrival date</span></label>
            <label class="field"><input type="number" name="guests" min="1" max="500" placeholder=" " /><span>Guests</span></label>
          </div>
          <label class="field"><textarea name="message" rows="4" placeholder=" " required maxlength="4000"></textarea><span>Tell us about your plans</span></label>
          <label class="hp" aria-hidden="true">Website <input type="text" name="website" tabindex="-1" autocomplete="off" /></label>
          <button type="submit" class="btn btn--green btn--full">Send enquiry</button>
          <p class="form__note" id="formNote" role="status"></p>
        </form>
      </div>
      ${S.mapQuery ? `<div class="map container reveal"><iframe title="Office location" src="https://maps.google.com/maps?q=${esc(encodeURIComponent(S.mapQuery))}&amp;z=15&amp;output=embed" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe></div>` : ''}
    </section>`;
  }

  const frame = (src, alt, cls = '') => `
          <div class="frame ${cls}${img(src) ? '' : ' frame--fallback'}">
            ${img(src) ? `<img src="${esc(img(src))}" alt="${esc(alt)}" loading="lazy" data-fallback />` : '<img alt="" src="data:image/gif;base64,R0lGODlhAQABAAAAACw=" />'}
            <img src="${A}emblem-white.png" alt="" class="frame__fallback-emblem" />
          </div>`;

  /* ---------- HOME ---------- */
  function pageHome(c) {
    const H = c.home || {};
    const exps = pub(c.experiences), dests = pub(c.destinations), tests = pub(c.testimonials);
    const regions = c.regions || [];
    const pos = { north: 'n', east: 'e', south: 's', west: 'w' }, rot = { north: 0, east: 90, south: 180, west: 270 };
    const r0 = regions[0] || {};
    const marquee = H.marquee || [];
    const video = vidSrc(H.heroVideo);
    const videoMobile = vidSrc(H.heroVideoMobile);
    const poster = img(H.heroPoster);
    return `
    <section class="hero${video ? ' hero--video' : ''}"${video && poster ? ` style="${esc('--poster:' + cssUrl(poster))}"` : ''}>
      ${video ? `
      <div class="hero__video" aria-hidden="true">
        <video class="hero__media" muted loop playsinline preload="metadata"${poster ? ` poster="${esc(poster)}"` : ''} data-src="${esc(video)}"${videoMobile ? ` data-src-mobile="${esc(videoMobile)}"` : ''}></video>
      </div>` : ''}
      <div class="hero__bg" aria-hidden="true">
        <img src="${A}emblem-white.png" alt="" class="hero__watermark" />
        <svg class="hero__waves" viewBox="0 0 1440 320" preserveAspectRatio="none">
          <path d="M0,192 C240,128 480,256 720,192 C960,128 1200,256 1440,192" />
          <path d="M0,224 C240,160 480,288 720,224 C960,160 1200,288 1440,224" />
          <path d="M0,256 C240,192 480,320 720,256 C960,192 1200,320 1440,256" />
        </svg>
      </div>
      <div class="hero__content container">
        <p class="eyebrow eyebrow--light reveal">${esc(H.heroEyebrow)}</p>
        <h1 class="hero__title">${String(H.heroTitle || '').split('\n').map((l) => `<span class="line"><span>${esc(l).replace(/\*(.+?)\*/g, '<em>$1</em>')}</span></span>`).join('')}</h1>
        <p class="hero__lead reveal">${esc(H.heroLead)}</p>
        <div class="hero__actions reveal">
          <a href="#contact" class="btn btn--gold">Plan your experience</a>
          <a href="#services" class="btn btn--ghost">Discover our services</a>
        </div>
      </div>
      <a href="#about" class="hero__scroll" aria-label="Scroll to content"><span>Scroll</span><i></i></a>
      ${video ? `
      <div class="hero__vctrl">
        <button type="button" class="hero__vbtn" data-video="toggle" aria-label="Pause background video" hidden>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path class="i-pause" d="M8 5v14M16 5v14"/><path class="i-play" d="M8 5l11 7-11 7z"/></svg>
        </button>
        ${H.heroVideoSound === 'yes' ? `
        <button type="button" class="hero__vbtn" data-video="sound" aria-label="Turn sound on" hidden>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z"/><path class="i-on" d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/><path class="i-off" d="M17 9l5 6M22 9l-5 6"/></svg>
        </button>` : ''}
      </div>` : ''}
    </section>

    ${marquee.length ? `<div class="marquee" aria-hidden="true"><div class="marquee__track">${[...marquee, ...marquee].map((m) => `<span>${esc(m)}</span><b>✦</b>`).join('')}</div></div>` : ''}

    <section class="about section" id="about">
      <div class="container about__grid">
        <div class="about__media reveal">
          ${frame(H.aboutImage, 'A Zenitude Concierge representative welcoming guests')}
          <div class="about__badge"><img src="${A}emblem-gold.png" alt="" /><span>${esc(H.aboutBadge).replace(/\n/g, '<br>')}</span></div>
        </div>
        <div class="about__text">
          <p class="eyebrow reveal">${esc(H.aboutEyebrow)}</p>
          <h2 class="section__title reveal">${rich(H.aboutTitle)}</h2>
          ${paras(H.aboutText, 'reveal')}
          <ul class="stats reveal">
            <li><strong data-count="${dests.length}">${dests.length}</strong><span>Island<br />destinations</span></li>
            <li><strong>24/7</strong><span>Tailored<br />assistance</span></li>
            <li><strong data-count="${exps.length}">${exps.length}</strong><span>Realms —<br />air, land &amp; sea</span></li>
          </ul>
        </div>
      </div>
    </section>

    <section class="services section section--cream" id="services">
      <div class="container">
        <div class="section__head">
          <p class="eyebrow reveal">Signature Luxury Services</p>
          <h2 class="section__title reveal">${rich(H.servicesTitle)}</h2>
          <p class="section__intro reveal">${esc(H.servicesIntro)}</p>
        </div>
        <div class="cards">${(c.services || []).map((s, i) => `
          <article class="card${i === 1 ? ' card--feature' : ''} reveal">
            <span class="card__num">${['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX'][i] || i + 1}</span>
            <span class="card__icon">${icon(['butler', 'yacht', 'compass'][i % 3])}</span>
            <h3>${esc(s.title)}</h3><p>${esc(s.text)}</p>
            ${(s.items || []).length ? `<ul>${s.items.map((it) => `<li>${esc(it)}</li>`).join('')}</ul>` : ''}
          </article>`).join('')}
        </div>
      </div>
    </section>

    <section class="experiences section section--dark" id="experiences">
      <div class="container">
        <div class="section__head section__head--split">
          <div><p class="eyebrow eyebrow--light reveal">Experiences</p><h2 class="section__title reveal">By air, by land, <em>by sea</em></h2></div>
          <p class="section__intro reveal">Choose your element. We orchestrate the rest — the timing, the people, the small details that turn an outing into a memory.</p>
        </div>
        <div class="realms">${exps.map((x, i) => `
          <article class="realm realm--${esc(x.slug)} reveal" tabindex="0">
            <div class="realm__bg"${img(x.heroImage) ? ` style="${esc(`background-image:linear-gradient(180deg,rgba(15,34,17,.15),rgba(15,34,17,.55)),${cssUrl(img(x.heroImage))};background-size:cover;background-position:center`)}"` : ''}></div>
            <span class="realm__idx">${pad(i + 1)}</span>
            <span class="realm__icon">${icon(x.slug)}</span>
            <div class="realm__body"><h3>${esc(x.name)}</h3><p>${esc(x.summary)}</p><a href="${esc(expUrl(x.slug))}" class="link">Explore ${esc(String(x.name).toLowerCase())}</a></div>
          </article>`).join('')}
        </div>
        ${(c.transfers || []).length ? `<div class="transfers">${c.transfers.map((t, i) => `
          <div class="transfer${i % 2 ? ' transfer--gold' : ''} reveal"><p class="eyebrow eyebrow--light">Transfers</p><h3>${esc(t.name)}</h3><p>${esc(t.text)}</p></div>`).join('')}</div>` : ''}
      </div>
    </section>

    ${regions.length ? `
    <section class="stays section" id="stays">
      <div class="container">
        <div class="section__head">
          <p class="eyebrow reveal">Accommodation</p>
          <h2 class="section__title reveal">Four coasts, <em>one compass</em></h2>
          <p class="section__intro reveal">We help you select the perfect hotel or villa within your budget. Choose a coast of Mauritius to explore.</p>
        </div>
        <div class="compass reveal">
          <div class="compass__wheel">
            <img src="${A}emblem-green.png" alt="" class="compass__emblem" id="compassEmblem" />
            ${regions.filter((r) => pos[r.key]).map((r, i) => `<button class="compass__pt compass__pt--${pos[r.key]}${i === 0 ? ' is-active' : ''}" data-key="${esc(r.key)}" data-title="${esc(r.title)}" data-kicker="${esc(r.kicker)}" data-desc="${esc(r.desc)}" data-rot="${rot[r.key]}">${esc(r.key[0].toUpperCase() + r.key.slice(1))}</button>`).join('')}
          </div>
          <div class="compass__panel" aria-live="polite">
            <p class="compass__kicker" id="regionKicker">${esc(r0.kicker)}</p>
            <h3 class="compass__title" id="regionTitle">${esc(r0.title)}</h3>
            <p class="compass__desc" id="regionDesc">${esc(r0.desc)}</p>
            <a href="${esc(staysUrl(r0.key || 'north'))}" class="btn btn--green" id="stayLink">Find my stay</a>
          </div>
        </div>
      </div>
    </section>` : ''}

    <section class="destinations section section--cream" id="destinations">
      <div class="container">
        <div class="section__head section__head--split">
          <div><p class="eyebrow reveal">Destinations</p><h2 class="section__title reveal">Islands of the <em>Indian Ocean</em></h2></div>
          <p class="section__intro reveal">${dests.length} extraordinary destinations, one trusted partner on the ground.</p>
        </div>
        <div class="dests">${dests.map((d, i) => `
          <a class="dest dest--${esc(d.theme || 'mu')} reveal" href="${esc(destUrl(d.slug))}">
            <span class="dest__no">${pad(i + 1)}</span>
            <div class="dest__art${img(d.heroImage) ? ' has-photo' : ''}"${img(d.heroImage) ? ` style="${esc('background-image:' + cssUrl(img(d.heroImage)))}"` : ''}></div>
            <div class="dest__body"><h3>${esc(d.name)}</h3><p>${esc(d.summary)}</p><span class="dest__more">Discover →</span></div>
          </a>`).join('')}
        </div>
      </div>
    </section>

    ${tests.length ? `
    <section class="testimonials section section--dark" id="testimonials">
      <img src="${A}emblem-white.png" alt="" class="testimonials__mark" aria-hidden="true" />
      <div class="container">
        <p class="eyebrow eyebrow--light reveal center">Testimonials</p>
        <h2 class="section__title reveal center">Kind words from <em>our guests</em></h2>
        <div class="slider reveal" id="slider">
          <div class="slider__track">${tests.map((t, i) => { const n = Math.max(0, Math.min(5, +t.rating || 5)); return `
            <figure class="quote${i === 0 ? ' is-active' : ''}">
              <div class="stars" aria-label="${n} stars">${'★'.repeat(n)}</div>
              <blockquote>“${esc(t.quote)}”</blockquote>
              <figcaption><strong>${esc(t.author)}</strong><span>${esc(t.context)}</span></figcaption>
            </figure>`; }).join('')}
          </div>
          <div class="slider__nav"><button class="slider__arrow" data-dir="-1" aria-label="Previous testimonial">←</button><div class="slider__dots" role="tablist"></div><button class="slider__arrow" data-dir="1" aria-label="Next testimonial">→</button></div>
        </div>
      </div>
    </section>` : ''}

    <section class="team section" id="team">
      <div class="container team__grid">
        <div class="team__text">
          <p class="eyebrow reveal">The Team</p>
          <h2 class="section__title reveal">${rich(H.teamTitle)}</h2>
          <p class="reveal">${esc(H.teamText)}</p>
          <a href="team.html" class="btn btn--green reveal">Meet the team</a>
        </div>
        <div class="team__media reveal"><a href="team.html" aria-label="Meet the team">${frame(H.teamImage, 'The Zenitude Concierge team', 'frame--wide')}</a></div>
      </div>
    </section>

    <section class="b2b" id="b2b">
      <div class="container b2b__inner">
        <div class="b2b__text">
          <p class="eyebrow eyebrow--light reveal">For Travel Professionals</p>
          <h2 class="section__title reveal">${rich(H.b2bTitle)}</h2>
          <p class="reveal">${esc(H.b2bText)}</p>
          <ul class="b2b__list reveal">${(H.b2bPoints || []).map((p, i) => `<li><span>${pad(i + 1)}</span>${esc(p)}</li>`).join('')}</ul>
          <a href="mailto:${esc(c.settings.salesEmail || c.settings.email)}?subject=B2B%20Portal%20Access" class="btn btn--gold reveal">Request portal access</a>
        </div>
        <div class="b2b__art reveal" aria-hidden="true">
          ${img(H.b2bImage) ? `<img src="${esc(img(H.b2bImage))}" alt="" class="b2b__flute" loading="lazy" data-remove-on-error />` : ''}
          <img src="${A}emblem-gold.png" alt="" class="b2b__emblem" />
        </div>
      </div>
    </section>

    ${contact(c)}`;
  }

  /* ---------- TEAM ---------- */
  function pageTeam(c) {
    const H = c.home || {};
    const team = pub(c.team);
    const lead = team.shift();
    document.title = 'Our Team — ' + (c.settings.siteName || 'Zenitude Concierge');
    return `
    <section class="page-hero page-hero--plain">
      <img src="${A}emblem-white.png" alt="" class="hero__watermark" aria-hidden="true" />
      <div class="container page-hero__content">
        <nav class="crumbs reveal" aria-label="Breadcrumb"><a href="index.html">Home</a><span>/</span>Team</nav>
        <p class="eyebrow eyebrow--light reveal">The Team</p>
        <h1 class="page-hero__title reveal">${rich(H.teamTitle || 'The people behind *every detail*')}</h1>
        <p class="page-hero__lead reveal">${esc(H.teamText)}</p>
      </div>
    </section>
    ${lead ? `
    <section class="section lead-member">
      <div class="container lead-member__grid">
        <div class="lead-member__photo reveal">${frame(lead.photo, lead.name)}</div>
        <div class="lead-member__text">
          <p class="eyebrow reveal">${esc(lead.role)}</p>
          <h2 class="section__title reveal">${esc(lead.name)}</h2>
          ${paras(lead.bio, 'lead-member__bio reveal')}
          <img src="${A}emblem-gold.png" alt="" class="lead-member__mark reveal" />
        </div>
      </div>
    </section>` : ''}
    <section class="section section--cream">
      <div class="container">
        <div class="section__head"><p class="eyebrow reveal">Leadership &amp; specialists</p><h2 class="section__title reveal">Experience you can <em>rely on</em></h2></div>
        <div class="members">${team.map((m) => `
          <article class="member reveal" tabindex="0">
            <div class="member__photo${img(m.photo) ? '' : ' frame--fallback'}">
              ${img(m.photo) ? `<img src="${esc(img(m.photo))}" alt="${esc(m.name)}" loading="lazy" data-fallback />` : '<img alt="" src="data:image/gif;base64,R0lGODlhAQABAAAAACw=" />'}
              <img src="${A}emblem-white.png" alt="" class="frame__fallback-emblem" />
              <div class="member__bio"><p>${esc(m.bio)}</p></div>
            </div>
            <h3>${esc(m.name)}</h3><p class="member__role">${esc(m.role)}</p>
          </article>`).join('')}
        </div>
      </div>
    </section>
    <section class="cta-band"><div class="container cta-band__inner">
      <h2 class="section__title reveal">Let our team craft <em>your experience</em></h2>
      <a href="index.html#contact" class="btn btn--gold reveal">Get in touch</a>
    </div></section>`;
  }

  /* ---------- DESTINATION / EXPERIENCE ---------- */
  function pageDetail(c, kind) {
    const isDest = kind === 'destinations';
    const list = pub(c[kind]);
    const slug = (new URLSearchParams(location.search).get('slug') || location.pathname.split('/').filter(Boolean).pop() || '').toLowerCase();
    const item = list.find((x) => x.slug === slug);
    if (!item) return null;
    const theme = isDest ? (item.theme || 'mu') : 'x-' + item.slug;
    const hero = img(item.heroImage);
    const label = isDest ? 'Destinations' : 'Experiences';
    const topic = isDest ? item.name : item.name + ' experiences';
    const toUrl = isDest ? destUrl : expUrl;
    document.title = item.name + (isDest ? '' : ' Experiences') + ' — ' + (c.settings.siteName || 'Zenitude Concierge');
    const meta = document.querySelector('meta[name="description"]'); if (meta) meta.content = item.summary || '';
    const others = list.filter((o) => o.slug !== item.slug);
    const gallery = (item.gallery || []).map(img).filter(Boolean);
    return `
    <section class="page-hero page-hero--${esc(theme)}${hero ? ' has-photo' : ''}">
      ${hero ? `<div class="page-hero__photo" style="${esc('background-image:' + cssUrl(hero))}"></div>` : `<img src="${A}emblem-white.png" alt="" class="hero__watermark" aria-hidden="true" />`}
      <div class="container page-hero__content">
        <nav class="crumbs reveal" aria-label="Breadcrumb"><a href="index.html">Home</a><span>/</span><a href="${home(kind)}">${label}</a><span>/</span>${esc(item.name)}</nav>
        ${isDest ? '' : `<span class="page-hero__icon reveal">${icon(item.slug)}</span>`}
        <h1 class="page-hero__title page-hero__title--xl reveal">${esc(item.name)}</h1>
        <p class="page-hero__tagline reveal">${esc(item.tagline)}</p>
      </div>
      <a href="#intro" class="hero__scroll" aria-label="Scroll to content"><span>Discover</span><i></i></a>
    </section>

    <section class="section detail-intro" id="intro">
      <div class="container detail-intro__grid">
        <div class="detail-intro__text">
          <p class="eyebrow reveal">${isDest ? 'The destination' : 'The experience'}</p>
          ${paras(item.intro, 'detail-intro__p reveal')}
          <a href="${esc(enquireUrl(topic))}" class="btn btn--green reveal">Plan ${isDest ? 'your journey' : 'this experience'}</a>
        </div>
        ${(item.facts || []).length ? `
        <aside class="facts reveal">
          <img src="${A}emblem-gold.png" alt="" class="facts__mark" />
          <h2>At a glance</h2>
          <dl>${item.facts.map((f) => `<div><dt>${esc(f.label)}</dt><dd>${esc(f.value)}</dd></div>`).join('')}</dl>
        </aside>` : `
        <aside class="facts facts--quote reveal"><img src="${A}emblem-gold.png" alt="" class="facts__mark" /><p>${esc(item.summary)}</p></aside>`}
      </div>
    </section>

    ${(item.highlights || []).length ? `
    <section class="section section--cream highlights">
      <div class="container">
        <div class="section__head"><p class="eyebrow reveal">Highlights</p>
          <h2 class="section__title reveal">${isDest ? `What awaits you in <em>${esc(item.name)}</em>` : 'Ways to <em>experience it</em>'}</h2></div>
        ${item.highlights.map((h, i) => `
        <article class="hl${i % 2 ? ' hl--flip' : ''}">
          <div class="hl__media reveal">${frame(h.image, h.title, `frame--wide hl__frame hl__frame--${esc(theme)}`)}</div>
          <div class="hl__text reveal"><span class="hl__num">${pad(i + 1)}</span><h3>${esc(h.title)}</h3><p>${esc(h.text)}</p></div>
        </article>`).join('')}
      </div>
    </section>` : ''}

    ${gallery.length ? `
    <section class="section gallery-section"><div class="container">
      <p class="eyebrow reveal">Gallery</p>
      <div class="gallery">${gallery.map((g) => `<a href="${esc(g)}" class="gallery__item reveal" data-lightbox><img src="${esc(g)}" alt="${esc(item.name)}" loading="lazy" data-remove-on-error="a" /></a>`).join('')}</div>
    </div></section>` : ''}

    <section class="cta-band"><div class="container cta-band__inner">
      <div><p class="eyebrow eyebrow--light reveal">Bespoke from start to finish</p>
      <h2 class="section__title reveal">${isDest ? `Your journey to <em>${esc(item.name)}</em>` : `Your ${esc(String(item.name).toLowerCase())} <em>experience</em>`}, crafted by us</h2></div>
      <a href="${esc(enquireUrl(topic))}" class="btn btn--gold reveal">Start planning</a>
    </div></section>

    ${others.length ? `
    <section class="section more"><div class="container">
      <div class="section__head"><p class="eyebrow reveal">Continue exploring</p><h2 class="section__title reveal">More <em>${label.toLowerCase()}</em></h2></div>
      <div class="more__grid">${others.map((o) => { const oi = img(o.heroImage); return `
        <a class="more__card more__card--${esc(isDest ? (o.theme || 'mu') : 'x-' + o.slug)} reveal" href="${esc(toUrl(o.slug))}"${oi ? ` style="${esc('--photo:' + cssUrl(oi))}"` : ''}>
          <span class="more__name">${esc(o.name)}</span><span class="more__tag">${esc(o.tagline)}</span><span class="more__go">→</span>
        </a>`; }).join('')}
      </div>
    </div></section>` : ''}
    <div class="lightbox" id="lightbox" hidden><button class="lightbox__close" aria-label="Close">×</button><img alt="" /></div>`;
  }

  /* ---------- STAYS (hotels & villas per coast) ---------- */
  function pageStays(c) {
    const regions = (c.regions || []).filter((r) => REGION_ORDER.includes(r.key))
      .sort((a, b) => REGION_ORDER.indexOf(a.key) - REGION_ORDER.indexOf(b.key));
    if (!regions.length) return null;
    const want = (new URLSearchParams(location.search).get('region') || '').toLowerCase();
    const r = regions.find((x) => x.key === want) || regions[0];
    const stays = pub(c.stays).filter((s) => s.region === r.key);
    document.title = `Hotels & villas — ${r.title || cap(r.key)} of Mauritius — ` + (c.settings.siteName || 'Zenitude Concierge');
    const meta = document.querySelector('meta[name="description"]'); if (meta) meta.content = r.desc || '';
    return `
    <section class="page-hero page-hero--stay page-hero--stay-${esc(r.key)}">
      <img src="${A}emblem-white.png" alt="" class="hero__watermark" aria-hidden="true" />
      <div class="container page-hero__content">
        <nav class="crumbs reveal" aria-label="Breadcrumb"><a href="index.html">Home</a><span>/</span><a href="${home('stays')}">Accommodation</a><span>/</span>${esc(r.title || cap(r.key))}</nav>
        <p class="eyebrow eyebrow--light reveal">${esc(r.kicker)}</p>
        <h1 class="page-hero__title reveal">Stays in <em>${esc(String(r.title || cap(r.key)).replace(/^the\s+/i, 'the '))}</em></h1>
        <p class="page-hero__lead reveal">${esc(r.desc)}</p>
      </div>
    </section>

    <div class="coast-tabs" role="tablist" aria-label="Choose a coast">
      <div class="container coast-tabs__inner">
        <span class="coast-tabs__label">Choose a coast</span>
        ${regions.map((x) => `<a role="tab" aria-selected="${x.key === r.key}" class="coast-tab${x.key === r.key ? ' is-active' : ''}" href="${esc(staysUrl(x.key))}"><span class="coast-tab__dir">${esc(cap(x.key)[0])}</span>${esc(x.title || cap(x.key))}</a>`).join('')}
      </div>
    </div>

    <section class="section stays-list">
      <div class="container">
        <div class="section__head section__head--split">
          <div>
            <p class="eyebrow reveal">${stays.length} hand-picked ${stays.length === 1 ? 'address' : 'addresses'}</p>
            <h2 class="section__title reveal">Where to stay in <em>${esc(String(r.title || cap(r.key)).replace(/^the\s+/i, 'the '))}</em></h2>
          </div>
          <p class="section__intro reveal">We help you choose the right hotel or villa for your budget and style of travel, then handle the booking, transfers and every request during your stay.</p>
        </div>
        ${stays.length ? `<div class="stays">${stays.map((s, i) => {
          const pic = img(s.image);
          const site = safeUrl(s.website);
          return `
          <article class="stay reveal">
            <div class="stay__media stay__media--${esc(r.key)}${pic ? '' : ' frame--fallback'}">
              ${pic ? `<img src="${esc(pic)}" alt="${esc(s.name)}" loading="lazy" data-fallback />` : '<img alt="" src="data:image/gif;base64,R0lGODlhAQABAAAAACw=" />'}
              <img src="${A}emblem-white.png" alt="" class="frame__fallback-emblem" />
              <span class="stay__no">${pad(i + 1)}</span>
            </div>
            <div class="stay__body">
              <p class="stay__meta">${[s.area, s.type].filter(Boolean).map(esc).join(' · ')}</p>
              <h3>${esc(s.name)}</h3>
              <p class="stay__desc">${esc(s.description)}</p>
              ${s.budget ? `<p class="stay__budget"><span>Budget</span>${esc(s.budget)}</p>` : ''}
              <div class="stay__actions">
                <a class="btn btn--green" href="${esc(stayEnquireUrl(s.name, r.title || cap(r.key)))}">Enquire about this stay</a>
                ${site ? `<a class="stay__site" href="${esc(site)}" target="_blank" rel="noopener">Hotel website ↗</a>` : ''}
              </div>
            </div>
          </article>`; }).join('')}</div>`
        : `<div class="stays-empty reveal"><img src="${A}emblem-gold.png" alt="" /><p>We are curating our selection for this coast. Tell us what you are looking for and we will send you tailored suggestions.</p><a class="btn btn--green" href="${esc(enquireUrl('Accommodation'))}">Ask our team</a></div>`}
      </div>
    </section>

    <section class="cta-band"><div class="container cta-band__inner">
      <div><p class="eyebrow eyebrow--light reveal">Not sure where to stay?</p>
      <h2 class="section__title reveal">Tell us your budget — we'll find <em>the perfect match</em></h2></div>
      <a href="${esc(enquireUrl('Accommodation'))}" class="btn btn--gold reveal">Get tailored suggestions</a>
    </div></section>`;
  }

  /* ---------- 404 ---------- */
  function pageNotFound() {
    document.title = 'Page not found — Zenitude Concierge';
    return `
    <section class="page-hero page-hero--plain page-hero--full">
      <img src="${A}emblem-white.png" alt="" class="hero__watermark" aria-hidden="true" />
      <div class="container page-hero__content">
        <p class="eyebrow eyebrow--light reveal">Error 404</p>
        <h1 class="page-hero__title reveal">This door is <em>locked.</em></h1>
        <p class="page-hero__lead reveal">The page you were looking for doesn't exist — but our keys open many others.</p>
        <a href="index.html" class="btn btn--gold reveal">Return home</a>
      </div>
    </section>`;
  }

  /* ---------- simple text pages (privacy / terms) ---------- */
  function pageText(c) {
    const key = PAGE; // 'privacy' | 'terms'
    const P = (c.pages || {})[key] || {};
    document.title = (P.title || key) + ' — ' + (c.settings.siteName || 'Zenitude Concierge');
    return `
    <section class="page-hero page-hero--plain">
      <img src="${A}emblem-white.png" alt="" class="hero__watermark" aria-hidden="true" />
      <div class="container page-hero__content">
        <nav class="crumbs reveal" aria-label="Breadcrumb"><a href="index.html">Home</a><span>/</span>${esc(P.title || key)}</nav>
        <h1 class="page-hero__title reveal">${esc(P.title || key)}</h1>
      </div>
    </section>
    <section class="section"><div class="container text-page">${paras(P.body || 'Content coming soon.', 'reveal')}</div></section>`;
  }

  /* ---------- boot ---------- */
  async function boot() {
    const main = document.getElementById('top');
    let c;
    try { c = await window.ZenStore.getContent(); } catch (e) { c = window.ZenStore.defaults(); }
    if (!c.settings) c.settings = {};
    const kind = PAGE === 'destination' ? 'destinations' : PAGE === 'experience' ? 'experiences' : null;
    let html =
      PAGE === 'home' ? pageHome(c) :
      PAGE === 'team' ? pageTeam(c) :
      PAGE === 'stays' ? pageStays(c) :
      kind ? pageDetail(c, kind) :
      PAGE === 'privacy' || PAGE === 'terms' ? pageText(c) : null;
    if (html == null) html = pageNotFound();
    if (PAGE === 'home' && c.settings.metaDescription) {
      const m = document.querySelector('meta[name="description"]'); if (m) m.content = c.settings.metaDescription;
    }
    document.getElementById('site-header').outerHTML = header(c, kind || PAGE);
    main.innerHTML = html;
    document.getElementById('site-footer').outerHTML = footer(c);
    window.ZenSite.init();
  }

  window.ZenTemplates = { esc, img };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();

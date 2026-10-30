(() => {
  'use strict';
  document.documentElement.classList.add('js');
  // Décor discret : une seule mise à jour par image, aucun effet si mouvements réduits.
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let starFrame = 0;
  function updateStars() {
    starFrame = 0;
    const offset = reducedMotion.matches ? 0 : Math.min(scrollY * 0.025, 160);
    document.body.style.setProperty('--star-shift', `${-offset}px`);
  }
  function queueStars() {
    if (!reducedMotion.matches && !starFrame) starFrame = requestAnimationFrame(updateStars);
  }
  addEventListener('scroll', queueStars, { passive: true });
  reducedMotion.addEventListener('change', updateStars);
  updateStars();
  const hoverAnimation = matchMedia('(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)');
  for (const cover of document.querySelectorAll('[data-hover-gif]')) {
    let preview = null;
    const stop = () => { preview?.remove(); preview = null; };
    const hoverTarget = cover.closest('.project-card') || cover;
    hoverTarget.addEventListener('mouseenter', () => {
      if (!hoverAnimation.matches || preview) return;
      preview = new Image(640, 400);
      const candidate = preview;
      preview.onload = () => {
        if (preview === candidate && hoverAnimation.matches) cover.append(candidate);
      };
      preview.alt = '';
      preview.className = 'hover-gif';
      preview.setAttribute('aria-hidden', 'true');
      preview.src = cover.dataset.hoverGif;
    });
    hoverTarget.addEventListener('mouseleave', stop);
    hoverAnimation.addEventListener('change', stop);
  }
  const params = new URLSearchParams(location.search);
  const english = params.get('l') === 'ang';
  const language = english ? 'ang' : 'fr';
  const root = document.body.dataset.root || '';

  for (const button of document.querySelectorAll('[data-copy-email]')) {
    button.setAttribute('aria-label', english ? 'Copy email address' : 'Copier l’adresse email');
    button.addEventListener('click', async () => {
      const status = button.parentElement.querySelector('.copy-status');
      try {
        if (navigator.clipboard && window.isSecureContext) {
          await navigator.clipboard.writeText(button.dataset.copyEmail);
        } else {
          const field = document.createElement('textarea');
          field.value = button.dataset.copyEmail;
          field.style.cssText = 'position:fixed;left:-9999px;top:0';
          document.body.append(field);
          let copied = false;
          try { field.select(); copied = document.execCommand('copy'); }
          finally { field.remove(); button.focus({preventScroll:true}); }
          if (!copied) throw new Error('Clipboard unavailable');
        }
        status.textContent = english ? 'Email address copied!' : 'Adresse email copiée !';
      } catch {
        status.textContent = english ? 'Copy unavailable. Select the address to copy it.' : 'Copie indisponible. Sélectionnez l’adresse pour la copier.';
      }
    });
  }

  document.documentElement.lang = english ? 'en' : 'fr';
  if (english) {
    for (const image of document.querySelectorAll('img[data-src-en]')) image.src = image.dataset.srcEn;
    for (const element of document.querySelectorAll('[data-i18n]')) {
      const translation = window.PORTFOLIO_EN?.[element.dataset.i18n];
      if (translation !== undefined) element.textContent = translation;
    }
    document.title = document.body.dataset.titleEn;
    document.querySelector('meta[name="description"]').content = document.body.dataset.descriptionEn;
    document.querySelector('meta[property="og:title"]').content = document.title;
    document.querySelector('meta[property="og:description"]').content = document.body.dataset.descriptionEn;
    document.querySelector('.brand').setAttribute('aria-label', 'Paul Blot — home');
    document.querySelector('nav').setAttribute('aria-label', 'Main navigation');
    document.querySelector('.filters')?.setAttribute('aria-label', 'Categories');
  }
  for (const a of document.querySelectorAll('a[data-language]')) {
    const url = new URL(location.href);
    url.searchParams.set('l', a.dataset.language);
    a.href = url.href;
    a.setAttribute('aria-current', String(a.dataset.language === language));
  }
  for (const a of document.querySelectorAll('a[data-cv]')) {
    a.href = `${root}assets/documents/paul-blot-cv-${english ? 'en' : 'fr'}.pdf`;
  }
  // Keep links relative so opening index.html directly and Pages subpaths both work.
  for (const a of document.querySelectorAll('a[href]')) {
    const raw = a.getAttribute('href');
    if (!raw || a.hasAttribute('data-language') || a.hasAttribute('download') || /^(?:[a-z]+:|\/\/)/i.test(raw) || raw === '#contenu' || raw === '#top') continue;
    const [pathAndQuery, hash] = raw.split('#');
    const [path, query] = pathAndQuery.split('?');
    const next = new URLSearchParams(query);
    next.set('l', language);
    const catalogueFilter = params.get('categorie');
    if (catalogueFilter && /(?:^|\/)projets\/[^/]+\/index\.html$/.test(path)) next.set('categorie', catalogueFilter);
    if (a.hasAttribute('data-back-catalogue') && catalogueFilter) next.set('categorie', catalogueFilter);
    a.setAttribute('href', `${path}?${next}${hash ? '#' + hash : ''}`);
  }
  const carousel = document.querySelector('.hero-carousel');
  if (carousel) {
    const order = (carousel.dataset.projectOrder || '').split(',');
    const slides = [...carousel.querySelectorAll('.hero-slide')].filter(slide => slide.dataset.carouselIncluded !== 'false');
    if (carousel.dataset.projectOrder) slides.sort((a, b) => order.indexOf(a.dataset.project) - order.indexOf(b.dataset.project));
    const controls = carousel.querySelector('.carousel-controls');
    const previous = carousel.querySelector('.carousel-previous');
    const next = carousel.querySelector('.carousel-next');
    const toggle = carousel.querySelector('.carousel-toggle');
    const dotsContainer = carousel.querySelector('.carousel-dots');
    const progress = carousel.querySelector('.carousel-progress');
    const progressFill = progress.firstElementChild;
    const announcement = carousel.querySelector('.carousel-announcement');
    const interval = Math.max(3000, Number(carousel.dataset.interval) || 5000);
    let index = 0, frame = 0, elapsed = 0, lastTick = 0;
    let slideAnimations = [];
    let paused = reducedMotion.matches, hovered = false, focused = false, allowFocused = false, visible = false;
    carousel.setAttribute('aria-label', english ? 'Projects to discover' : 'Projets à découvrir');
    carousel.setAttribute('aria-roledescription', english ? 'carousel' : 'carrousel');
    previous.setAttribute('aria-label', english ? 'Previous project' : 'Projet précédent');
    next.setAttribute('aria-label', english ? 'Next project' : 'Projet suivant');
    controls.hidden = slides.length < 2;
    dotsContainer.setAttribute('aria-label', english ? 'Choose a project' : 'Choisir un projet');
    const dots = slides.map((slide, position) => {
      const dot = document.createElement('button');
      dot.type = 'button';
      dot.className = 'carousel-dot';
      dot.setAttribute('aria-label', `${english ? 'Show' : 'Afficher'} ${slide.querySelector('strong').textContent.trim()} (${position + 1}/${slides.length})`);
      dot.addEventListener('click', () => show(position, true));
      dotsContainer.append(dot);
      return dot;
    });
    progress.hidden = slides.length < 2;
    function tick(now) {
      elapsed += now - lastTick;
      lastTick = now;
      progressFill.style.transform = `scaleX(${Math.min(elapsed / interval, 1)})`;
      if (elapsed >= interval) show(index + 1);
      else frame = requestAnimationFrame(tick);
    }
    function schedule() {
      cancelAnimationFrame(frame);
      if (!paused && !hovered && (!focused || allowFocused) && visible && !document.hidden && slides.length > 1) {
        lastTick = performance.now();
        frame = requestAnimationFrame(tick);
      }
    }
    function updateToggle() {
      toggle.setAttribute('aria-label', paused ? (english ? 'Resume carousel' : 'Relancer le carrousel') : (english ? 'Pause carousel' : 'Mettre le carrousel en pause'));
      toggle.querySelector('.pause-icon').toggleAttribute('hidden', paused);
      toggle.querySelector('.play-icon').toggleAttribute('hidden', !paused);
    }
    function show(target, manual = false) {
      const previousIndex = index;
      const direction = target >= index ? 1 : -1;
      slideAnimations.forEach(animation => animation.cancel());
      slideAnimations = [];
      slides.forEach(slide => slide.classList.remove('is-leaving'));
      index = (target + slides.length) % slides.length;
      slides.forEach((slide, position) => {
        const active = position === index;
        slide.classList.toggle('is-active', active);
        slide.inert = !active;
        slide.setAttribute('aria-hidden', String(!active));
      });
      if (index !== previousIndex && !reducedMotion.matches) {
        const outgoing = slides[previousIndex];
        const incoming = slides[index];
        // Précharger la prochaine couverture avant la translation.
        incoming.querySelector('img').loading = 'eager';
        outgoing.classList.add('is-leaving');
        const options = {duration:720, easing:'cubic-bezier(.22,.61,.36,1)'};
        const leave = outgoing.animate([{transform:'translateX(0)'}, {transform:`translateX(${-direction * 100}%)`}], options);
        const enter = incoming.animate([{transform:`translateX(${direction * 100}%)`}, {transform:'translateX(0)'}], options);
        leave.onfinish = () => outgoing.classList.remove('is-leaving');
        slideAnimations = [leave, enter];
      }
      slides[(index + 1) % slides.length].querySelector('img').loading = 'eager';
      dots.forEach((dot, position) => dot.setAttribute('aria-current', String(position === index)));
      elapsed = 0;
      progressFill.style.transform = 'scaleX(0)';
      if (manual) announcement.textContent = `${slides[index].querySelector('strong').textContent}, ${index + 1} / ${slides.length}`;
      schedule();
    }
    previous.addEventListener('click', () => show(index - 1, true));
    next.addEventListener('click', () => show(index + 1, true));
    toggle.addEventListener('click', () => {
      paused = !paused;
      allowFocused = !paused;
      updateToggle();
      schedule();
    });
    carousel.addEventListener('mouseenter', () => { hovered = true; schedule(); });
    carousel.addEventListener('mouseleave', () => { hovered = false; schedule(); });
    carousel.addEventListener('focusin', () => { focused = true; allowFocused = false; schedule(); });
    carousel.addEventListener('focusout', event => {
      if (!carousel.contains(event.relatedTarget)) { focused = false; allowFocused = false; schedule(); }
    });
    carousel.addEventListener('keydown', event => {
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault();
        show(index + (event.key === 'ArrowRight' ? 1 : -1), true);
      }
    });
    document.addEventListener('visibilitychange', schedule);
    carousel.querySelectorAll('.carousel-open').forEach(link => {
      if (english) {
        link.setAttribute('aria-label', `Open project: ${link.closest('.hero-slide').querySelector('strong').textContent}`);
      }
    });
    reducedMotion.addEventListener('change', () => {
      if (reducedMotion.matches) {
        paused = true;
        slideAnimations.forEach(animation => animation.cancel());
        slides.forEach(slide => slide.classList.remove('is-leaving'));
      }
      updateToggle(); schedule();
    });
    new IntersectionObserver(entries => {
      visible = entries[0].isIntersecting;
      schedule();
    }, {threshold:0.2}).observe(carousel);
    show(0);
    updateToggle();
  }
  const menu = document.querySelector('.menu-toggle');
  const nav = document.querySelector('#navigation');
  if (menu && nav) {
    menu.hidden = false;
    function setOpen(open) {
      nav.dataset.open = String(open);
      menu.setAttribute('aria-expanded', String(open));
    }
    setOpen(false);
    menu.addEventListener('click', () => setOpen(menu.getAttribute('aria-expanded') !== 'true'));
    nav.addEventListener('click', event => { if (event.target.closest('a')) setOpen(false); });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && menu.getAttribute('aria-expanded') === 'true') { setOpen(false); menu.focus(); }
    });
    matchMedia('(min-width: 1101px)').addEventListener('change', () => setOpen(false));
  }
  // Le cadre suit la section en cours, sans modifier l'URL pendant le défilement.
  const navGroup = document.querySelector('.nav-sections');
  const indicator = navGroup?.querySelector('.nav-indicator');
  const sectionLinks = [...(navGroup?.querySelectorAll('[data-section]') || [])];
  const sectionTargets = sectionLinks.map(link => ({link, section:document.getElementById(link.dataset.section)})).filter(item=>item.section);
  const projectPage = /\/projets\//.test(location.pathname);
  if (projectPage) document.querySelector('.nav-projects')?.setAttribute('aria-current','page');
  let navFrame = 0;
  function updateNavigation() {
    navFrame = 0;
    if (!indicator || !navGroup) return;
    const marker = scrollY + document.querySelector('.site-header').offsetHeight + innerHeight * 0.2;
    let active = null;
    for (const item of sectionTargets) {
      if (item.section.getBoundingClientRect().top + scrollY <= marker) active = item;
    }
    if (scrollY + innerHeight >= document.documentElement.scrollHeight - 4) active = sectionTargets.find(item=>item.link.dataset.section==='contact') || active;
    for (const link of sectionLinks) {
      if (link === active?.link) link.setAttribute('aria-current','location');
      else link.removeAttribute('aria-current');
    }
    const bounds = active?.link.getBoundingClientRect();
    if (!bounds || !bounds.width || !bounds.height) { indicator.hidden = true; return; }
    const group = navGroup.getBoundingClientRect();
    indicator.hidden = false;
    indicator.style.width = `${bounds.width}px`;
    indicator.style.height = `${bounds.height}px`;
    indicator.style.transform = `translate(${bounds.left-group.left}px,${bounds.top-group.top}px)`;
  }
  function queueNavigation() {
    if (!navFrame) navFrame = requestAnimationFrame(updateNavigation);
  }
  addEventListener('scroll',queueNavigation,{passive:true});
  addEventListener('resize',queueNavigation);
  menu?.addEventListener('click',queueNavigation);
  document.fonts.ready.then(queueNavigation);
  updateNavigation();
  const filters = document.querySelector('.filters');
  if (filters) {
    filters.hidden = false;
    const buttons = [...filters.querySelectorAll('[data-filter]')];
    const projects = [...document.querySelectorAll('.catalogue-grid [data-category]')];
    function filter(value, updateURL) {
      if (!buttons.some(b => b.dataset.filter === value)) value = 'tous';
      for (const button of buttons) button.setAttribute('aria-pressed', String(button.dataset.filter === value));
      let count = 0;
      for (const project of projects) {
        project.hidden = value !== 'tous' && project.dataset.category !== value;
        if (!project.hidden) count++;
        for (const a of project.querySelectorAll('a[href]')) {
          const u = new URL(a.href);
          if (value === 'tous') u.searchParams.delete('categorie'); else u.searchParams.set('categorie',value);
          a.href = u.href;
        }
      }
      document.querySelector('.project-count').textContent = `${count} ${english ? (count > 1 ? 'projects' : 'project') : (count > 1 ? 'projets' : 'projet')}`;
      if (updateURL) {
        const url = new URL(location.href);
        if (value === 'tous') url.searchParams.delete('categorie'); else url.searchParams.set('categorie',value);
        history.pushState({}, '', url);
      }
      for (const a of document.querySelectorAll('[data-language]')) {
        const u = new URL(location.href);u.searchParams.set('l',a.dataset.language);a.href=u.href;
      }
    }
    filter(params.get('categorie') || 'tous', false);
    filters.addEventListener('click', e => {
      const button = e.target.closest('[data-filter]');
      if (button) filter(button.dataset.filter, true);
    });
    addEventListener('popstate', () => filter(new URLSearchParams(location.search).get('categorie') || 'tous', false));
  }
  // Une seule visionneuse pour toutes les images d’une fiche projet.
  // Les images restent visibles sans JavaScript ; le zoom est un enrichissement.
  const projectImages = [...document.querySelectorAll('.detail-media > img, .story-gallery > img, .project-gallery > img')];
  if (english) projectImages.forEach(image => { if (image.dataset.altEn) image.alt = image.dataset.altEn; });
  if (projectImages.length && typeof HTMLDialogElement !== 'undefined') {
    const icon = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="10" cy="10" r="6"/><path d="m15 15 5 5M10 7v6M7 10h6"/></svg>';
    const viewer = document.createElement('dialog');
    viewer.className = 'image-viewer';
    viewer.setAttribute('aria-labelledby', 'viewer-title');
    viewer.innerHTML = `<div class="viewer-toolbar"><h2 class="viewer-title" id="viewer-title"></h2><button type="button" class="viewer-control viewer-close" autofocus><span class="viewer-close-text">${english ? 'Close' : 'Fermer'}</span><span aria-hidden="true">✕</span></button></div><div class="viewer-stage"><img class="viewer-image" alt=""></div><div class="viewer-footer"><button type="button" class="viewer-control viewer-prev" aria-label="${english ? 'Previous image' : 'Image précédente'}">←</button><span class="viewer-count" role="status" aria-live="polite"></span><button type="button" class="viewer-control viewer-next" aria-label="${english ? 'Next image' : 'Image suivante'}">→</button></div>`;
    document.body.append(viewer);
    const display = viewer.querySelector('.viewer-image');
    const title = viewer.querySelector('.viewer-title');
    const count = viewer.querySelector('.viewer-count');
    const close = viewer.querySelector('.viewer-close');
    close.setAttribute('aria-label', english ? 'Close image viewer' : 'Fermer la vue agrandie');
    let current = 0;
    let trigger = null;
    function showImage(index) {
      current = (index + projectImages.length) % projectImages.length;
      const source = projectImages[current];
      display.src = source.currentSrc || source.src;
      display.alt = source.alt;
      const caption = source.closest('figure')?.querySelector('figcaption');
      title.textContent = (english ? source.dataset.captionEn : source.dataset.caption) || caption?.textContent || source.alt;
      count.textContent = `${current + 1} / ${projectImages.length}`;
    }
    projectImages.forEach((image, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'media-zoom';
      button.setAttribute('aria-label', `${english ? 'Enlarge image' : 'Agrandir l’image'} : ${image.alt}`);
      const mark = document.createElement('span');
      mark.className = 'zoom-mark';
      mark.innerHTML = icon;
      image.replaceWith(button);
      button.append(image, mark);
      button.addEventListener('click', () => {
        trigger = button;
        showImage(index);
        viewer.showModal();
      });
    });
    viewer.querySelector('.viewer-prev').hidden = projectImages.length < 2;
    viewer.querySelector('.viewer-next').hidden = projectImages.length < 2;
    viewer.querySelector('.viewer-prev').addEventListener('click', () => showImage(current - 1));
    viewer.querySelector('.viewer-next').addEventListener('click', () => showImage(current + 1));
    close.addEventListener('click', () => viewer.close());
    viewer.addEventListener('click', event => {
      if (event.target === viewer || event.target.classList.contains('viewer-stage')) viewer.close();
    });
    viewer.addEventListener('keydown', event => {
      if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
        event.preventDefault();
        showImage(current + (event.key === 'ArrowRight' ? 1 : -1));
      }
    });
    viewer.addEventListener('close', () => {
      display.removeAttribute('src');
      trigger?.focus({preventScroll:true});
    });
  }
})();

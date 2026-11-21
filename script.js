(() => {
  const root = document.documentElement;
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const motionAllowed = !prefersReduced.matches;
  const finePointer = window.matchMedia('(pointer: fine)').matches || navigator.maxTouchPoints === 0;

  // Theme and navigation
  const themeToggle = document.getElementById('theme-toggle');
  const themeLabel = themeToggle.querySelector('.theme-label');
  const themeIcon = themeToggle.querySelector('.theme-icon');
  const themeMeta = document.querySelector('meta[name="theme-color"]');
  let savedTheme = null;
  try { savedTheme = localStorage.getItem('fardeen-theme'); } catch { /* Storage may be unavailable in private contexts. */ }
  if (savedTheme === 'dark' || savedTheme === 'light') root.dataset.theme = savedTheme;
  let binaryColor = '#276b49';
  function updateThemeControl() {
    binaryColor = getComputedStyle(root).getPropertyValue('--binary').trim() || binaryColor;
    const isDark = root.dataset.theme === 'dark';
    themeLabel.textContent = isDark ? 'Light mode' : 'Dark mode';
    themeIcon.textContent = isDark ? '☼' : '◐';
    themeToggle.setAttribute('aria-label', `Switch to ${isDark ? 'light' : 'dark'} theme`);
    themeMeta.setAttribute('content', isDark ? '#0c1510' : '#f4f7f3');
  }
  updateThemeControl();
  themeToggle.addEventListener('click', () => {
    root.dataset.theme = root.dataset.theme === 'dark' ? 'light' : 'dark';
    try { localStorage.setItem('fardeen-theme', root.dataset.theme); } catch { /* Theme still changes for this visit. */ }
    updateThemeControl();
  });

  const header = document.querySelector('.site-header');
  const menuToggle = document.getElementById('menu-toggle');
  const nav = document.getElementById('main-nav');
  function closeMenu() {
    nav.classList.remove('is-open');
    menuToggle.setAttribute('aria-expanded', 'false');
    menuToggle.setAttribute('aria-label', 'Open navigation');
  }
  menuToggle.addEventListener('click', () => {
    const isOpen = menuToggle.getAttribute('aria-expanded') === 'true';
    menuToggle.setAttribute('aria-expanded', String(!isOpen));
    menuToggle.setAttribute('aria-label', isOpen ? 'Open navigation' : 'Close navigation');
    nav.classList.toggle('is-open', !isOpen);
  });
  nav.querySelectorAll('a').forEach(link => link.addEventListener('click', closeMenu));
  document.addEventListener('keydown', event => { if (event.key === 'Escape') closeMenu(); });

  // Word-by-word masked hero reveal and existing content reveals
  requestAnimationFrame(() => root.classList.add('hero-ready'));
  const revealItems = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window) {
    const revealObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          revealObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -35px 0px' });
    revealItems.forEach(item => revealObserver.observe(item));
    const sectionObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => entry.target.classList.toggle('section-active', entry.isIntersecting));
    }, { threshold: 0.28 });
    document.querySelectorAll('main > .section-wrap[id]').forEach(section => sectionObserver.observe(section));
  } else {
    revealItems.forEach(item => item.classList.add('is-visible'));
  }

  // Interactive shared-state switcher
  const stateCard = document.getElementById('state-switcher');
  const stateButtons = [...stateCard.querySelectorAll('[data-state-button]')];
  function setState(state) {
    stateCard.dataset.state = state;
    stateButtons.forEach(button => button.setAttribute('aria-selected', String(button.dataset.stateButton === state)));
  }
  stateButtons.forEach((button, index) => {
    button.addEventListener('click', () => setState(button.dataset.stateButton));
    button.addEventListener('keydown', event => {
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault();
        const nextIndex = (index + (event.key === 'ArrowRight' ? 1 : -1) + stateButtons.length) % stateButtons.length;
        stateButtons[nextIndex].focus();
        setState(stateButtons[nextIndex].dataset.stateButton);
      }
    });
  });

  // Expandable project details
  document.querySelectorAll('.project').forEach(project => {
    const button = project.querySelector('.project-open');
    function toggleProject() {
      const expanded = project.getAttribute('aria-expanded') === 'true';
      project.setAttribute('aria-expanded', String(!expanded));
      button.setAttribute('aria-label', `${expanded ? 'Expand' : 'Collapse'} ${project.querySelector('h3').innerText.replace(/\n/g, ' ')} details`);
      requestAnimationFrame(requestScrollUpdate);
    }
    button.addEventListener('click', toggleProject);
    project.addEventListener('keydown', event => {
      if ((event.key === 'Enter' || event.key === ' ') && event.target === project) {
        event.preventDefault();
        toggleProject();
      }
    });
  });

  // Geometry is measured together and cached; pointer handlers only read these cached boxes.
  const progressBar = document.getElementById('progress-bar');
  const showcase = document.getElementById('showcase-pin');
  const showcaseSticky = showcase.querySelector('.showcase-sticky');
  const projectTrack = showcase.querySelector('.project-list');
  const projects = [...projectTrack.querySelectorAll('.project')];
  const projectVisuals = [...document.querySelectorAll('.project-visual')];
  const timeline = document.querySelector('.timeline');
  const timelinePath = document.querySelector('.timeline-path path');
  const timelineItems = [...document.querySelectorAll('.timeline-item')];
  const magneticButtons = [...document.querySelectorAll('.magnetic-button')];
  const tiltCards = [...document.querySelectorAll('.skill-card')];
  const pointerBounds = new Map();
  const magnetStates = new Map(magneticButtons.map(element => [element, { x: 0, y: 0, vx: 0, vy: 0, tx: 0, ty: 0 }]));
  let scrollFrame = 0;

  function cachePointerBounds() {
    pointerBounds.clear();
    [...magneticButtons, ...tiltCards, ...projectVisuals, document.querySelector('.hero-art')].forEach(element => {
      if (element) pointerBounds.set(element, element.getBoundingClientRect());
    });
  }

  function clamp01(value) { return Math.max(0, Math.min(1, value)); }
  function updateScrollMotion() {
    scrollFrame = 0;
    const viewportHeight = window.innerHeight;
    const scrollY = window.scrollY;
    const maxScroll = document.documentElement.scrollHeight - viewportHeight;
    const percent = maxScroll > 0 ? clamp01(scrollY / maxScroll) * 100 : 0;
    const showcaseRect = showcase.getBoundingClientRect();
    const timelineRect = timeline.getBoundingClientRect();
    const itemRects = timelineItems.map(item => item.getBoundingClientRect());
    const visualRects = projectVisuals.map(visual => visual.getBoundingClientRect());
    const showcaseTop = window.innerWidth <= 680 ? 72 : 104;
    const showcaseTravel = Math.max(1, showcaseRect.height - (viewportHeight - showcaseTop));
    const showcaseProgress = clamp01((showcaseTop - showcaseRect.top) / showcaseTravel);
    const trackDistance = Math.max(0, projectTrack.scrollWidth - showcaseSticky.clientWidth);
    const timelineProgress = clamp01((viewportHeight * .72 - timelineRect.top) / Math.max(1, timelineRect.height));
    cachePointerBounds();

    // Writes follow all geometry reads so scroll updates do not force synchronous layout.
    progressBar.style.width = `${percent}%`;
    header.classList.toggle('is-scrolled', scrollY > 80);
    if (motionAllowed) {
      projectTrack.style.setProperty('--track-x', `${-trackDistance * showcaseProgress}px`);
      showcase.style.setProperty('--backdrop-drift', `${showcaseProgress * 220}px`);
      projects.forEach(project => {
        const speed = Number(project.dataset.speed) || 1;
        project.style.setProperty('--card-drift', `${(showcaseProgress - .5) * (speed - 1) * 34}px`);
      });
    } else {
      projectTrack.style.removeProperty('--track-x');
      showcase.style.removeProperty('--backdrop-drift');
    }
    timelinePath.style.strokeDashoffset = String(1000 * (1 - timelineProgress));
    itemRects.forEach((rect, index) => {
      const marker = rect.top + rect.height * .5;
      timelineItems[index].classList.toggle('is-lit', marker <= viewportHeight * .72);
    });
    visualRects.forEach((rect, index) => {
      const distance = (viewportHeight - rect.top) / (viewportHeight + rect.height);
      projectVisuals[index].style.setProperty('--project-parallax', `${(distance - .5) * 24}px`);
    });
  }
  function requestScrollUpdate() {
    if (!scrollFrame) scrollFrame = requestAnimationFrame(updateScrollMotion);
  }
  window.addEventListener('scroll', requestScrollUpdate, { passive: true });
  window.addEventListener('resize', requestScrollUpdate, { passive: true });
  updateScrollMotion();

  // Magnetic CTAs, specular card tilt, fluid blend cursor, and contextual labels.
  if (motionAllowed && finePointer) {
    root.classList.add('has-custom-cursor');
    const cursorDot = document.createElement('span');
    cursorDot.className = 'motion-cursor-dot';
    cursorDot.setAttribute('aria-hidden', 'true');
    const cursorRing = document.createElement('span');
    cursorRing.className = 'motion-cursor-ring';
    cursorRing.setAttribute('aria-hidden', 'true');
    const ringLabel = document.createElement('span');
    cursorRing.append(ringLabel);
    document.body.append(cursorDot, cursorRing);

    const binaryCanvas = document.createElement('canvas');
    binaryCanvas.className = 'binary-cursor-canvas';
    binaryCanvas.setAttribute('aria-hidden', 'true');
    document.body.append(binaryCanvas);
    const binaryContext = binaryCanvas.getContext('2d', { alpha: true });
    let canvasScale = Math.min(window.devicePixelRatio || 1, 1.5);
    function resizeBinaryCanvas() {
      canvasScale = Math.min(window.devicePixelRatio || 1, 1.5);
      binaryCanvas.width = Math.round(window.innerWidth * canvasScale);
      binaryCanvas.height = Math.round(window.innerHeight * canvasScale);
      binaryCanvas.style.width = `${window.innerWidth}px`;
      binaryCanvas.style.height = `${window.innerHeight}px`;
      binaryContext.setTransform(canvasScale, 0, 0, canvasScale, 0, 0);
    }
    resizeBinaryCanvas();
    window.addEventListener('resize', resizeBinaryCanvas, { passive: true });
    const binaryParticles = [];
    let binaryFrame = 0;
    let lastEmitX = 0;
    let lastEmitY = 0;
    let lastEmitTime = 0;
    function drawBinaryTrail(now) {
      binaryFrame = 0;
      binaryContext.clearRect(0, 0, window.innerWidth, window.innerHeight);
      const color = binaryColor;
      binaryContext.fillStyle = color;
      binaryParticles.forEach(particle => {
        const progress = (now - particle.born) / particle.life;
        particle.x += particle.vx;
        particle.y += particle.vy;
        particle.vx *= .985;
        particle.vy *= .99;
        if (progress >= 1) return;
        binaryContext.globalAlpha = Math.sin(Math.PI * progress) * particle.opacity;
        binaryContext.font = `500 ${particle.size}px "DM Mono", monospace`;
        binaryContext.fillText(particle.bit, particle.x, particle.y);
      });
      binaryContext.globalAlpha = 1;
      for (let i = binaryParticles.length - 1; i >= 0; i--) {
        if (now - binaryParticles[i].born >= binaryParticles[i].life) binaryParticles.splice(i, 1);
      }
      if (binaryParticles.length) binaryFrame = requestAnimationFrame(drawBinaryTrail);
    }
    function emitBinary(event) {
      if (event.pointerType === 'touch') return;
      const dx = event.clientX - lastEmitX;
      const dy = event.clientY - lastEmitY;
      const distance = Math.hypot(dx, dy);
      if (distance < 7 && event.timeStamp - lastEmitTime < 48) return;
      const count = Math.min(2, Math.max(1, Math.floor(distance / 58) + 1));
      for (let index = 0; index < count; index++) {
        binaryParticles.push({
          x: event.clientX + (Math.random() - .5) * 20,
          y: event.clientY + (Math.random() - .5) * 16,
          vx: (Math.random() - .5) * .48,
          vy: -.25 - Math.random() * .72,
          bit: Math.random() > .5 ? '1' : '0',
          size: 8 + Math.random() * 3,
          opacity: .22 + Math.random() * .12,
          born: performance.now(),
          life: 390 + Math.random() * 210
        });
      }
      if (binaryParticles.length > 64) binaryParticles.splice(0, binaryParticles.length - 64);
      lastEmitX = event.clientX;
      lastEmitY = event.clientY;
      lastEmitTime = event.timeStamp;
      if (!binaryFrame) binaryFrame = requestAnimationFrame(drawBinaryTrail);
    }
    window.addEventListener('pointermove', emitBinary, { passive: true });

    let targetX = window.innerWidth / 2;
    let targetY = window.innerHeight / 2;
    let ringX = targetX;
    let ringY = targetY;
    let cursorFrame = 0;
    let magnetFrame = 0;
    let activeLabel = '';
    function animateCursor() {
      ringX += (targetX - ringX) * .22;
      ringY += (targetY - ringY) * .22;
      cursorRing.style.setProperty('--cursor-x', `${ringX}px`);
      cursorRing.style.setProperty('--cursor-y', `${ringY}px`);
      const unsettled = Math.abs(targetX - ringX) + Math.abs(targetY - ringY) > .35;
      if (unsettled) cursorFrame = requestAnimationFrame(animateCursor);
      else cursorFrame = 0;
    }
    function setCursorLabel(label, isDrag = false) {
      if (label !== activeLabel) {
        activeLabel = label;
        ringLabel.textContent = label;
      }
      cursorRing.classList.toggle('is-hover', Boolean(label));
      cursorRing.classList.toggle('is-drag', isDrag);
    }
    function settleMagnets() {
      magnetFrame = 0;
      let moving = false;
      magnetStates.forEach((state, button) => {
        state.vx = (state.vx + (state.tx - state.x) * .16) * .68;
        state.vy = (state.vy + (state.ty - state.y) * .16) * .68;
        state.x += state.vx;
        state.y += state.vy;
        if (Math.abs(state.tx - state.x) + Math.abs(state.ty - state.y) + Math.abs(state.vx) + Math.abs(state.vy) > .08) moving = true;
        else { state.x = state.tx; state.y = state.ty; state.vx = 0; state.vy = 0; }
        button.style.setProperty('--mag-x', `${state.x}px`);
        button.style.setProperty('--mag-y', `${state.y}px`);
        button.style.setProperty('--copy-x', `${state.x * .32}px`);
        button.style.setProperty('--copy-y', `${state.y * .32}px`);
      });
      if (moving) magnetFrame = requestAnimationFrame(settleMagnets);
    }
    function aimMagnet(button, x, y) {
      const state = magnetStates.get(button);
      if (!state) return;
      state.tx = x;
      state.ty = y;
      if (!magnetFrame) magnetFrame = requestAnimationFrame(settleMagnets);
    }
    window.addEventListener('pointermove', event => {
      if (event.pointerType === 'touch') return;
      targetX = event.clientX;
      targetY = event.clientY;
      cursorDot.style.setProperty('--cursor-x', `${targetX}px`);
      cursorDot.style.setProperty('--cursor-y', `${targetY}px`);
      cursorDot.classList.add('is-active');
      cursorRing.classList.add('is-active');
      if (!cursorFrame) cursorFrame = requestAnimationFrame(animateCursor);

      const target = event.target instanceof Element ? event.target : null;
      const media = target?.closest('.project-visual, .hero-art, .state-visual');
      const link = target?.closest('a, button');
      const skill = target?.closest('.skill-card');
      const label = media ? 'VIEW' : (skill ? 'TILT' : (link ? 'GO' : ''));
      setCursorLabel(label, Boolean(target?.closest('.project-visual')));

      magneticButtons.forEach(button => {
        const rect = pointerBounds.get(button);
        if (!rect) return;
        const dx = event.clientX - (rect.left + rect.width / 2);
        const dy = event.clientY - (rect.top + rect.height / 2);
        const within = Math.abs(dx) < rect.width * .75 && Math.abs(dy) < rect.height * 1.7;
        if (within) {
          const rawX = dx * .13;
          const rawY = dy * .13;
          const length = Math.hypot(rawX, rawY) || 1;
          const scale = Math.min(1, 15 / length);
          const x = rawX * scale;
          const y = rawY * scale;
          aimMagnet(button, x, y);
        } else {
          aimMagnet(button, 0, 0);
        }
      });

      const hero = document.querySelector('.hero-art');
      const heroRect = pointerBounds.get(hero);
      if (heroRect && heroRect.width && event.clientX >= heroRect.left && event.clientX <= heroRect.right && event.clientY >= heroRect.top && event.clientY <= heroRect.bottom) {
        const nx = (event.clientX - heroRect.left) / heroRect.width - .5;
        const ny = (event.clientY - heroRect.top) / heroRect.height - .5;
        hero.style.setProperty('--card-rotate', `${-7 + nx * 9}deg`);
        hero.style.setProperty('--pointer-x', `${nx * 14}px`);
        hero.style.setProperty('--pointer-y', `${ny * 14}px`);
      }
      tiltCards.forEach(card => {
        const rect = pointerBounds.get(card);
        if (!rect || event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) return;
        const x = (event.clientX - rect.left) / rect.width - .5;
        const y = (event.clientY - rect.top) / rect.height - .5;
        card.style.setProperty('--mx', `${(x + .5) * 100}%`);
        card.style.setProperty('--my', `${(y + .5) * 100}%`);
        card.style.transform = `perspective(850px) rotateX(${y * -5}deg) rotateY(${x * 5}deg) translateY(-2px)`;
      });
      const visual = target?.closest('.project-visual');
      const visualRect = visual && pointerBounds.get(visual);
      if (visualRect) {
        visual.style.setProperty('--mx', `${event.clientX - visualRect.left}px`);
        visual.style.setProperty('--my', `${event.clientY - visualRect.top}px`);
      }
    }, { passive: true });

    document.querySelectorAll('.skill-card').forEach(card => card.addEventListener('pointerleave', () => {
      card.style.transform = '';
      card.style.setProperty('--mx', '50%');
      card.style.setProperty('--my', '50%');
    }));
    document.querySelectorAll('.magnetic-button').forEach(button => button.addEventListener('pointerleave', () => aimMagnet(button, 0, 0)));
    document.addEventListener('pointerleave', () => {
      cursorRing.classList.remove('is-active');
      cursorDot.classList.remove('is-active');
      setCursorLabel('');
    });
  }

  // Email utility
  const copyButton = document.getElementById('copy-email');
  const copyFeedback = document.getElementById('copy-feedback');
  copyButton.addEventListener('click', async () => {
    const email = copyButton.dataset.email;
    try {
      await navigator.clipboard.writeText(email);
      copyFeedback.textContent = 'Email copied to clipboard.';
    } catch {
      window.location.href = `mailto:${email}`;
      copyFeedback.textContent = 'Opening your email app.';
    }
    window.setTimeout(() => { copyFeedback.textContent = ''; }, 3000);
  });

  document.getElementById('year').textContent = new Date().getFullYear();
})();

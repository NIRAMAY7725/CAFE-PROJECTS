/* =============================================
   NOIR BREW — JAVASCRIPT INTERACTIONS
   ============================================= */
document.addEventListener('DOMContentLoaded', () => {
  // ========== LOADER ==========
  const loader = document.getElementById('loader');
  const loaderFill = document.getElementById('loaderFill');
  let progress = 0;
  const loaderInterval = setInterval(() => {
    progress += Math.random() * 18;
    if (progress >= 100) {
      progress = 100;
      loaderFill.style.width = '100%';
      clearInterval(loaderInterval);
      setTimeout(() => {
        loader.classList.add('hidden');
        document.body.style.overflow = '';
        initReveal();
        initStats();
      }, 400);
    }
    loaderFill.style.width = progress + '%';
  }, 80);
  document.body.style.overflow = 'hidden';
  // ========== CUSTOM CURSOR ==========
  const cursor = document.getElementById('cursor');
  const follower = document.getElementById('cursorFollower');
  let mouseX = 0, mouseY = 0, followerX = 0, followerY = 0;
  document.addEventListener('mousemove', e => {
    mouseX = e.clientX;
    mouseY = e.clientY;
    cursor.style.left = mouseX + 'px';
    cursor.style.top = mouseY + 'px';
  });
  const animateCursor = () => {
    followerX += (mouseX - followerX) * 0.12;
    followerY += (mouseY - followerY) * 0.12;
    follower.style.left = followerX + 'px';
    follower.style.top = followerY + 'px';
    requestAnimationFrame(animateCursor);
  };
  animateCursor();
  const hoverEls = document.querySelectorAll('a, button, .gallery-item, .menu-card, .tab, .testimonial-card');
  hoverEls.forEach(el => {
    el.addEventListener('mouseenter', () => follower.classList.add('hovered'));
    el.addEventListener('mouseleave', () => follower.classList.remove('hovered'));
  });
  // ========== NAV ==========
  const nav = document.getElementById('nav');
  const hamburger = document.getElementById('hamburger');
  const navLinks = document.getElementById('navLinks');
  let lastScroll = 0;
  window.addEventListener('scroll', () => {
    const scrollY = window.scrollY;
    if (scrollY > 60) {
      nav.classList.add('scrolled');
    } else {
      nav.classList.remove('scrolled');
    }
    lastScroll = scrollY;
  });
  hamburger.addEventListener('click', () => {
    hamburger.classList.toggle('active');
    navLinks.classList.toggle('mobile-open');
  });
  // Close mobile nav on link click
  navLinks.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
      hamburger.classList.remove('active');
      navLinks.classList.remove('mobile-open');
    });
  });
  // Active nav highlight on scroll
  const sections = document.querySelectorAll('section[id]');
  const navLinksAll = document.querySelectorAll('.nav-link');
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        navLinksAll.forEach(link => {
          link.classList.remove('active-nav');
          if (link.getAttribute('href') === '#' + entry.target.id) {
            link.classList.add('active-nav');
          }
        });
      }
    });
  }, { threshold: 0.4 });
  sections.forEach(s => observer.observe(s));
  // ========== HERO PARALLAX ==========
  const heroBg = document.getElementById('heroBg');
  window.addEventListener('scroll', () => {
    if (heroBg) {
      const scrolled = window.scrollY;
      heroBg.style.transform = `translateY(${scrolled * 0.4}px)`;
    }
  }, { passive: true });
  // ========== FLOATING PARTICLES ==========
  const particleContainer = document.getElementById('heroParticles');
  const createParticle = () => {
    const p = document.createElement('div');
    p.className = 'particle';
    const size = Math.random() * 4 + 2;
    p.style.cssText = `
      width:${size}px;height:${size}px;
      left:${Math.random() * 100}%;
      animation-duration:${Math.random() * 12 + 8}s;
      animation-delay:${Math.random() * 8}s;
    `;
    particleContainer.appendChild(p);
    p.addEventListener('animationend', () => p.remove());
  };
  setInterval(createParticle, 500);
  for (let i = 0; i < 12; i++) createParticle();
  // ========== SCROLL REVEAL ==========
  function initReveal() {
    const revealEls = document.querySelectorAll('.reveal-up, .reveal-left, .reveal-right');
    const revealObs = new IntersectionObserver((entries) => {
      entries.forEach((entry, i) => {
        if (entry.isIntersecting) {
          setTimeout(() => entry.target.classList.add('visible'), i * 80);
          revealObs.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15 });
    revealEls.forEach(el => revealObs.observe(el));
  }
  // ========== COUNTER STATS ==========
  function initStats() {
    const counters = document.querySelectorAll('.stat-num[data-target]');
    const counterObs = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          animateCounter(entry.target);
          counterObs.unobserve(entry.target);
        }
      });
    }, { threshold: 0.5 });
    counters.forEach(c => counterObs.observe(c));
  }
  function animateCounter(el) {
    const target = parseInt(el.dataset.target);
    const duration = 1800;
    const start = performance.now();
    const update = (time) => {
      const elapsed = time - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      el.textContent = Math.floor(eased * target).toLocaleString();
      if (progress < 1) requestAnimationFrame(update);
      else el.textContent = target.toLocaleString();
    };
    requestAnimationFrame(update);
  }
  // ========== MENU TABS ==========
  const tabs = document.querySelectorAll('.tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      document.querySelectorAll('.menu-grid').forEach(grid => grid.classList.add('hidden'));
      const target = document.getElementById('tab-' + tab.dataset.tab);
      if (target) {
        target.classList.remove('hidden');
        // Re-trigger reveal for newly shown items
        target.querySelectorAll('.reveal-up').forEach((el, i) => {
          el.classList.remove('visible');
          setTimeout(() => el.classList.add('visible'), i * 100);
        });
      }
    });
  });
  // ========== ADD TO CART ==========
  let cart = [];
  const cartCount = document.getElementById('cartCount');
  const cartItems = document.getElementById('cartItems');
  const cartTotal = document.getElementById('cartTotal');
  const cartBtn = document.getElementById('cartBtn');
  const cartTooltip = document.getElementById('cartTooltip');
  const cartClose = document.getElementById('cartClose');
  const cartCheckout = document.getElementById('cartCheckout');
  document.querySelectorAll('.btn-add').forEach(btn => {
    btn.addEventListener('click', () => {
      const card = btn.closest('.menu-card');
      const name = card.querySelector('h3').textContent;
      const priceStr = card.querySelector('.price').textContent;
      const price = parseInt(priceStr.replace('₹', '').replace(',', ''));
      const existing = cart.find(i => i.name === name);
      if (existing) {
        existing.qty++;
      } else {
        cart.push({ name, price, qty: 1 });
      }
      btn.textContent = '✓ Added';
      btn.classList.add('added');
      setTimeout(() => {
        btn.textContent = '+ Add';
        btn.classList.remove('added');
      }, 1400);
      updateCart();
      cartTooltip.classList.add('open');
      setTimeout(() => cartTooltip.classList.remove('open'), 3500);
    });
  });
  cartBtn.addEventListener('click', () => cartTooltip.classList.toggle('open'));
  cartClose.addEventListener('click', () => cartTooltip.classList.remove('open'));
  cartCheckout.addEventListener('click', () => {
    cartTooltip.classList.remove('open');
    document.getElementById('reserve').scrollIntoView({ behavior: 'smooth' });
  });
  function updateCart() {
    const count = cart.reduce((s, i) => s + i.qty, 0);
    const total = cart.reduce((s, i) => s + i.price * i.qty, 0);
    cartCount.textContent = count;
    cartTotal.textContent = '₹' + total.toLocaleString('en-IN');
    if (cart.length === 0) {
      cartItems.innerHTML = '<p class="cart-empty">Your cart is empty</p>';
    } else {
      cartItems.innerHTML = cart.map(item => `
        <div class="cart-item-row">
          <span>${item.name} ×${item.qty}</span>
          <span class="cart-item-price">₹${(item.price * item.qty).toLocaleString('en-IN')}</span>
        </div>
      `).join('');
    }
  }
  // ========== TESTIMONIAL SLIDER ==========
  const track = document.getElementById('testimonialsTrack');
  const tPrev = document.getElementById('tPrev');
  const tNext = document.getElementById('tNext');
  const tDots = document.getElementById('tDots');
  const cards = track.querySelectorAll('.testimonial-card');
  let tIndex = 0;
  const getVisible = () => window.innerWidth < 768 ? 1 : window.innerWidth < 1024 ? 2 : 3;
  function buildDots() {
    tDots.innerHTML = '';
    const totalSlides = Math.ceil(cards.length / getVisible());
    for (let i = 0; i < totalSlides; i++) {
      const dot = document.createElement('div');
      dot.className = 't-dot' + (i === tIndex ? ' active' : '');
      dot.addEventListener('click', () => goTo(i));
      tDots.appendChild(dot);
    }
  }
  function goTo(index) {
    const visible = getVisible();
    const maxIndex = Math.ceil(cards.length / visible) - 1;
    tIndex = Math.max(0, Math.min(index, maxIndex));
    const cardWidth = cards[0].getBoundingClientRect().width;
    const gap = 24;
    track.style.transform = `translateX(-${tIndex * visible * (cardWidth + gap)}px)`;
    buildDots();
  }
  tPrev.addEventListener('click', () => goTo(tIndex - 1));
  tNext.addEventListener('click', () => goTo(tIndex + 1));
  window.addEventListener('resize', () => { tIndex = 0; goTo(0); buildDots(); });
  buildDots();
  // Auto-advance testimonials
  setInterval(() => goTo(tIndex + 1 > Math.ceil(cards.length / getVisible()) - 1 ? 0 : tIndex + 1), 5000);
  // ========== RESERVATION FORM ==========
  let guestCount = 2;
  const guestDisplay = document.getElementById('guestCount');
  document.getElementById('guestMinus').addEventListener('click', () => {
    if (guestCount > 1) { guestCount--; guestDisplay.textContent = guestCount; }
  });
  document.getElementById('guestPlus').addEventListener('click', () => {
    if (guestCount < 20) { guestCount++; guestDisplay.textContent = guestCount; }
  });
  // Set min date to today
  const dateInput = document.getElementById('res-date');
  const today = new Date().toISOString().split('T')[0];
  dateInput.min = today;
  const form = document.getElementById('reserveForm');
  const formSuccess = document.getElementById('formSuccess');
  const newReservation = document.getElementById('newReservation');
  form.addEventListener('submit', e => {
    e.preventDefault();
    // Validate
    const name = document.getElementById('res-name').value.trim();
    const phone = document.getElementById('res-phone').value.trim();
    const date = document.getElementById('res-date').value;
    const time = document.getElementById('res-time').value;
    if (!name || !phone || !date || !time) {
      shakeForm();
      return;
    }
    // Simulate booking
    form.style.opacity = '0.5';
    form.style.pointerEvents = 'none';
    setTimeout(() => {
      form.style.display = 'none';
      formSuccess.classList.remove('hidden');
      formSuccess.style.opacity = '0';
      setTimeout(() => { formSuccess.style.transition = 'opacity 0.5s'; formSuccess.style.opacity = '1'; }, 50);
    }, 1200);
  });
  newReservation.addEventListener('click', () => {
    formSuccess.classList.add('hidden');
    form.style.display = '';
    form.style.opacity = '1';
    form.style.pointerEvents = '';
    form.reset();
    guestCount = 2;
    guestDisplay.textContent = '2';
  });
  function shakeForm() {
    form.style.animation = 'shake 0.4s ease';
    setTimeout(() => form.style.animation = '', 400);
    // Highlight empty fields
    ['res-name','res-phone','res-date','res-time'].forEach(id => {
      const el = document.getElementById(id);
      if (!el.value) {
        el.style.borderColor = '#e05555';
        el.addEventListener('input', () => el.style.borderColor = '', { once: true });
      }
    });
  }
  // ========== OPEN/CLOSED STATUS ==========
  function updateOpenStatus() {
    const openNow = document.getElementById('openNow');
    if (!openNow) return;
    const now = new Date();
    const hour = now.getHours();
    const day = now.getDay(); // 0=Sun, 6=Sat
    const isWeekend = day === 0 || day === 6;
    const openHour = isWeekend ? 8 : 7;
    const closeHour = 22; // 10pm / 11pm — using 22 as common
    const isOpen = hour >= openHour && hour < closeHour;
    if (!isOpen) {
      openNow.querySelector('span:last-child').textContent = 'Closed Now';
      openNow.style.color = '#e05555';
      openNow.querySelector('.status-dot').style.background = '#e05555';
    }
  }
  updateOpenStatus();
  // ========== SMOOTH NAV LINKS ==========
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', e => {
      const target = document.querySelector(anchor.getAttribute('href'));
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });
  // ========== SHAKE ANIMATION (CSS inject) ==========
  const style = document.createElement('style');
  style.textContent = `
    @keyframes shake {
      0%,100%{transform:translateX(0)}
      20%{transform:translateX(-8px)}
      40%{transform:translateX(8px)}
      60%{transform:translateX(-5px)}
      80%{transform:translateX(5px)}
    }
    .nav-link.active-nav { color: var(--gold) !important; }
    .nav-link.active-nav::after { width: 100% !important; }
  `;
  document.head.appendChild(style);
  console.log('%c☕ Noir Brew JS Loaded', 'color:#c9943a;font-size:1.2rem;font-weight:bold;');
});
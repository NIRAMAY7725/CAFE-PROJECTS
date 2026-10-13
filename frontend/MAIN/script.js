/* ============================================================
   DAS CAFE — Main Script · v3 (with Backend API)
   ============================================================ */

// Backend API base URL
const API_BASE = window.location.origin + '/api';

/* ── Navbar scroll ────────────────────────────────────────── */
const navbar = document.getElementById('navbar');
window.addEventListener('scroll', () => {
  navbar.classList.toggle('scrolled', window.scrollY > 40);
}, { passive: true });

/* ── Mobile menu ──────────────────────────────────────────── */
const hamburger  = document.getElementById('hamburger');
const navLinks   = document.getElementById('nav-links');
const navOverlay = document.getElementById('nav-overlay');

function closeMobileMenu() {
  navLinks.classList.remove('open');
  navOverlay.classList.remove('open');
  hamburger.setAttribute('aria-expanded', 'false');
  hamburger.querySelectorAll('span').forEach(s => { s.style.transform = ''; s.style.opacity = ''; });
}

hamburger.addEventListener('click', () => {
  const open = navLinks.classList.toggle('open');
  navOverlay.classList.toggle('open', open);
  hamburger.setAttribute('aria-expanded', open);
  const [s1, s2, s3] = hamburger.querySelectorAll('span');
  s1.style.transform = open ? 'rotate(45deg) translate(5px,5px)' : '';
  s2.style.opacity   = open ? '0' : '1';
  s3.style.transform = open ? 'rotate(-45deg) translate(5px,-5px)' : '';
});

// Close menu when clicking the overlay
navOverlay.addEventListener('click', closeMobileMenu);

// Close menu when any nav link is clicked
navLinks.querySelectorAll('a').forEach(a =>
  a.addEventListener('click', closeMobileMenu)
);

/* ── Smooth scroll ────────────────────────────────────────── */
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', e => {
    e.preventDefault();
    const target = document.querySelector(anchor.getAttribute('href'));
    if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
});

/* ══════════════════════════════════════════════════════════════
   HERO PARTICLES (golden floating dust)
══════════════════════════════════════════════════════════════ */
(function createParticles() {
  const container = document.getElementById('hero-particles');
  if (!container) return;

  const COUNT = 22;
  for (let i = 0; i < COUNT; i++) {
    const p = document.createElement('div');
    p.className = 'particle';
    const size = Math.random() * 4 + 2;            // 2–6 px
    const left = Math.random() * 100;              // 0–100%
    const dur  = (Math.random() * 10 + 8).toFixed(1); // 8–18s
    const del  = (Math.random() * 10).toFixed(1);     // 0–10s delay
    p.style.cssText = `
      width:${size}px; height:${size}px;
      left:${left}%;
      --dur:${dur}s; --delay:-${del}s;
      opacity:0;
    `;
    container.appendChild(p);
  }
})();

/* ══════════════════════════════════════════════════════════════
   SCROLL-REVEAL (single + stagger)
══════════════════════════════════════════════════════════════ */
const revealObs = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
      revealObs.unobserve(entry.target);
    }
  });
}, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

document.querySelectorAll('.reveal, .reveal-stagger').forEach(el => revealObs.observe(el));

/* ══════════════════════════════════════════════════════════════
   MENU FILTER
══════════════════════════════════════════════════════════════ */
const filterBtns = document.querySelectorAll('.filter-btn');
const menuCards  = document.querySelectorAll('.menu-card');

filterBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    filterBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const cat = btn.dataset.cat;
    menuCards.forEach(card => {
      const show = cat === 'all' || card.dataset.cat === cat;
      if (show) {
        card.style.display = '';
        card.style.animation = 'none';
        void card.offsetWidth; // force reflow
        card.style.animation = 'fadeIn .4s ease forwards';
      } else {
        card.style.display = 'none';
      }
    });
  });
});

/* ══════════════════════════════════════════════════════════════
   CART TOAST + BACKEND SALE RECORDING
══════════════════════════════════════════════════════════════ */
const toast    = document.getElementById('cart-toast');
const toastMsg = document.getElementById('toast-msg');
let   toastTimer;

document.querySelectorAll('.add-btn').forEach(btn => {
  btn.addEventListener('click', async e => {
    e.stopPropagation();
    const card     = btn.closest('.menu-card');
    const name     = card.querySelector('.menu-card-name').textContent;
    const category = card.dataset.cat || 'other';
    const priceText = card.querySelector('.menu-card-price').textContent;
    // Extract first number from price text like "₹ 20" or "₹ 10 to ₹ 50"
    const priceMatch = priceText.match(/₹\s*(\d+)/);
    const price    = priceMatch ? parseInt(priceMatch[1]) : 0;

    toastMsg.textContent = `"${name}" added to your order!`;
    // Re-trigger animation
    const icon = toast.querySelector('.toast-icon');
    icon.style.animation = 'none';
    void icon.offsetWidth;
    icon.style.animation = 'toastIconBounce .5s ease';
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 3000);

    // ── Save sale to backend ────────────────────────────────
    try {
      await fetch(API_BASE + '/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          item_name: name,
          category: category,
          price: price,
          quantity: 1,
          customer_name: 'Walk-in',
          payment_method: 'cash',
        }),
      });
    } catch (err) {
      // Backend might not be running — fail silently
      console.log('Backend not available, sale not recorded:', err.message);
    }
  });
});

/* ══════════════════════════════════════════════════════════════
   CONTACT FORM + BACKEND STORAGE
══════════════════════════════════════════════════════════════ */
const form = document.getElementById('contact-form');
if (form) {
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const btn = form.querySelector('button[type="submit"]');

    // Collect form data
    const contactData = {
      first_name: document.getElementById('fname').value.trim(),
      last_name:  document.getElementById('lname').value.trim(),
      email:      document.getElementById('email').value.trim(),
      subject:    document.getElementById('subject').value.trim(),
      message:    document.getElementById('message').value.trim(),
    };

    btn.textContent = 'Sending…';
    btn.disabled = true;

    // ── Save to backend ──────────────────────────────────────
    try {
      await fetch(API_BASE + '/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(contactData),
      });
    } catch (err) {
      console.log('Backend not available:', err.message);
    }

    btn.textContent = '✓ Message Sent!';
    btn.style.background = 'linear-gradient(135deg,#3a7d44,#52a861)';
    setTimeout(() => {
      btn.textContent = 'Send Message →';
      btn.style.background = '';
      btn.disabled = false;
      form.reset();
    }, 3000);
  });
}

/* ══════════════════════════════════════════════════════════════
   PARALLAX — hero badge subtle mouse tracking
══════════════════════════════════════════════════════════════ */
const badgeImg = document.querySelector('.badge-img');
if (badgeImg) {
  document.addEventListener('mousemove', e => {
    const { innerWidth: W, innerHeight: H } = window;
    const x = (e.clientX / W - 0.5) * 12;   // ±6 px
    const y = (e.clientY / H - 0.5) * 12;
    badgeImg.style.transform = `translate(${x}px, ${y}px)`;
  }, { passive: true });
}

/* ── Inject @keyframes for menu filter animation ───────────── */
const kf = document.createElement('style');
kf.textContent = `@keyframes fadeIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}`;
document.head.appendChild(kf);

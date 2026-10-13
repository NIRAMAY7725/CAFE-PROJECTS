/* ============================================================
   DAS CAFE — Customer Dining & Order Window Panel Logic
   Features:
     - Digital Menu Browsing with Filters & Search
     - Interactive Table Selection & Dining Mode
     - Cart & Slide-Over Checkout
     - Live Order Sync with Cafe Management (localStorage)
     - Real-Time Order Tracking & Kitchen Progress
     - Table Reservations & Guest Reviews
   ============================================================ */

'use strict';

// ── KEYS & STORAGE ────────────────────────────────────────────
const MGMT_STORE_KEY = 'DAS_CAFE_MGMT';
const ACTIVE_ORDERS_KEY = 'DAS_CAFE_ACTIVE_ORDERS';
const RESERVATIONS_KEY = 'DAS_CAFE_RESERVATIONS';
const REVIEWS_KEY = 'DAS_CAFE_REVIEWS';

// Seed Menu Items descriptions & tags
const MENU_METADATA = {
  1: { desc: "Traditional South Indian strong tea with aromatic fresh ginger and cardamom.", prep: "3-5m", veg: true, special: false },
  2: { desc: "Generous hot cup of authentic spiced cutting chai simmered to perfection.", prep: "4-6m", veg: true, special: true },
  3: { desc: "Hand-pulled filter coffee with frothy decoction and whole milk.", prep: "3-5m", veg: true, special: false },
  4: { desc: "Signature DAS CAFE degree filter coffee served in brass tumbler style.", prep: "4-6m", veg: true, special: true },
  5: { desc: "Freshly sliced toasted baker's bread smeared with golden Amul butter.", prep: "3-5m", veg: true, special: false },
  6: { desc: "Crisp cucumber, tomatoes, spiced potatoes, and homemade green chutney.", prep: "5-7m", veg: true, special: false },
  7: { desc: "Deluxe cold sandwich layered with grated processed cheese and garden vegetables.", prep: "5-7m", veg: true, special: false },
  8: { desc: "Golden butter grilled sandwich with seasoned vegetables and tangy mint dip.", prep: "7-10m", veg: true, special: true },
  9: { desc: "Loaded melted cheddar and mozzarella vegetable toastie with smoky grill marks.", prep: "8-12m", veg: true, special: true },
  10: { desc: "Triple-layer hearty jumbo feast with double cheese, spiced fillings, and chips.", prep: "10-14m", veg: true, special: true },
  11: { desc: "Pair of steamed melt-in-mouth rice cakes served with hot sambar and coconut chutney.", prep: "5-7m", veg: true, special: true },
  12: { desc: "Crispy ghee-tossed spiced idli bites with curry leaves and mustard seeds.", prep: "7-10m", veg: true, special: true },
  13: { desc: "Golden paper-thin crispy fermented rice crepe with clarified butter.", prep: "6-8m", veg: true, special: false },
  14: { desc: "Iconic Mysore spiced potato mash folded inside crisp golden crepe.", prep: "8-10m", veg: true, special: true },
  15: { desc: "Rich grated cheese showered over traditional spiced potato masala dosa.", prep: "8-11m", veg: true, special: true },
  16: { desc: "Caramelized crunchy onions with gooey cheese and aromatic tempered potatoes.", prep: "8-11m", veg: true, special: false },
  17: { desc: "Fresh cottage cheese cubes, rich cheese, and hearty masala inside crispy dosa.", prep: "10-13m", veg: true, special: true },
  18: { desc: "Fiery Schezwan sauce spread over ultra crisp dosa crepe.", prep: "7-9m", veg: true, special: false },
  19: { desc: "Fusion of spicy oriental wok spices and traditional South Indian potato mash.", prep: "8-11m", veg: true, special: true },
  20: { desc: "Spicy Schezwan base loaded with rich melted cheese and potato blend.", prep: "9-12m", veg: true, special: true },
  21: { desc: "Crispy diced red onions, fiery schezwan paste, and generous melted cheese.", prep: "9-12m", veg: true, special: false },
  22: { desc: "DAS CAFE house invention: Capsicum, sweet corn, Italian herbs, mozzarella & cheese dosa.", prep: "10-15m", veg: true, special: true },
  23: { desc: "Thunderous fizzy cola bottle 250ml chilled.", prep: "1m", veg: true, special: false },
  24: { desc: "Refreshing lemon-lime carbonated soda chilled.", prep: "1m", veg: true, special: false },
  25: { desc: "Classic ice-cold Coca Cola bottle 250ml.", prep: "1m", veg: true, special: false },
  26: { desc: "Vibrant bubbly orange soda 250ml.", prep: "1m", veg: true, special: false },
  27: { desc: "Digestive and refreshing jeera flavored sparkling drink.", prep: "1m", veg: true, special: false },
  28: { desc: "Sweet, creamy churned rich probiotic yogurt drink.", prep: "1m", veg: true, special: true },
  29: { desc: "1000ml sealed packaged drinking water.", prep: "1m", veg: true, special: false },
  30: { desc: "500ml sealed packaged drinking water.", prep: "1m", veg: true, special: false },
};

// ── STATE ─────────────────────────────────────────────────────
let cart = {}; // { itemId: { item, qty } }
let appliedDiscount = 0; // percentage or fixed
let discountType = null;
let currentFilterCat = 'all';
let currentFilterDiet = 'all';
let searchQuery = '';

// Web Audio API Sound Synthesizer (chimes without external mp3s)
function playChime(type = 'success') {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === 'success') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15); // A5
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
      osc.start();
      osc.stop(ctx.currentTime + 0.35);
    } else if (type === 'add') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.08);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.18);
      osc.start();
      osc.stop(ctx.currentTime + 0.18);
    }
  } catch (e) {
    // Audio might be blocked by browser policy until interaction
  }
}

// ── INIT ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initDiningSelector();
  initTabs();
  renderMenu();
  setupFilterHandlers();
  setupCartHandlers();
  setupReservationHandler();
  setupReviewHandler();
  renderActiveOrdersTracker();
  listenToOrderUpdates();

  // Restore cart if any in sessionStorage
  try {
    const saved = sessionStorage.getItem('DAS_CAFE_USER_CART');
    if (saved) {
      cart = JSON.parse(saved);
      updateCartUI();
    }
  } catch (e) {}
});

// ── DINING & TABLE SELECTION ──────────────────────────────────
function initDiningSelector() {
  const modeSelect = document.getElementById('dining-mode');
  const tableWrapper = document.getElementById('table-select-wrapper');
  const tableSelect = document.getElementById('table-number');
  const cartLocationText = document.getElementById('cart-location-text');

  function updateLocationDisplay() {
    if (modeSelect.value === 'takeaway') {
      tableWrapper.style.display = 'none';
      if (cartLocationText) cartLocationText.textContent = 'Takeaway (Parcel)';
    } else {
      tableWrapper.style.display = 'flex';
      if (cartLocationText) cartLocationText.textContent = `Dine-In · ${tableSelect.value}`;
    }
  }

  modeSelect.addEventListener('change', updateLocationDisplay);
  tableSelect.addEventListener('change', updateLocationDisplay);
  updateLocationDisplay();
}

// ── TABS NAVIGATION ───────────────────────────────────────────
function initTabs() {
  const tabs = document.querySelectorAll('.u-tab-btn');
  const panels = document.querySelectorAll('.u-panel');

  tabs.forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.tab;

      tabs.forEach(t => {
        t.classList.remove('active');
        t.setAttribute('aria-selected', 'false');
      });
      panels.forEach(p => p.classList.remove('active'));

      btn.classList.add('active');
      btn.setAttribute('aria-selected', 'true');

      const panel = document.getElementById('tab-' + target);
      if (panel) {
        panel.classList.add('active');
      }

      if (target === 'tracker') {
        renderActiveOrdersTracker();
      }
    });
  });
}

// ── MENU RENDERING ────────────────────────────────────────────
function renderMenu() {
  const grid = document.getElementById('u-menu-grid');
  if (!grid) return;

  const rawMenu = (typeof DAS_CAFE_MENU !== 'undefined') ? DAS_CAFE_MENU : [];

  const filtered = rawMenu.filter(item => {
    // Category filter
    if (currentFilterCat !== 'all' && item.category !== currentFilterCat) {
      return false;
    }

    const meta = MENU_METADATA[item.id] || { desc: '', prep: '5m', veg: true, special: false };

    // Dietary filter
    if (currentFilterDiet === 'veg' && !meta.veg) return false;
    if (currentFilterDiet === 'special' && !meta.special) return false;

    // Search query
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const inName = item.name.toLowerCase().includes(q);
      const inDesc = meta.desc.toLowerCase().includes(q);
      const inCat = item.category.toLowerCase().includes(q);
      if (!inName && !inDesc && !inCat) return false;
    }

    return true;
  });

  if (filtered.length === 0) {
    grid.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 48px 20px; color: var(--text-muted);">
        <div style="font-size: 2.5rem; margin-bottom: 8px;">🔍</div>
        <h3 style="color: var(--cream); font-family: var(--font-serif); margin-bottom: 6px;">No items match your search</h3>
        <p>Try searching for coffee, dosa, tea, or reset your filters.</p>
      </div>
    `;
    return;
  }

  grid.innerHTML = filtered.map(item => {
    const meta = MENU_METADATA[item.id] || { desc: 'Fresh handcrafted dish.', prep: '5-7m', veg: true, special: false };
    const inCartQty = cart[item.id] ? cart[item.id].qty : 0;

    return `
      <article class="menu-item-card" data-id="${item.id}">
        <div>
          <div class="item-top">
            <div class="item-badges">
              <span class="badge-veg" title="Vegetarian"></span>
              <span class="badge-cat">${item.category}</span>
              ${meta.special ? '<span class="badge-cat" style="background:rgba(245,158,11,0.15);color:#fbbf24;">★ Chef Pick</span>' : ''}
            </div>
            <div class="item-prep-time">⏱️ ${meta.prep}</div>
          </div>
          <h3 class="item-name">${item.name}</h3>
          <p class="item-desc">${meta.desc}</p>
        </div>

        <div class="item-bottom">
          <div class="item-price">₹ ${item.price}</div>
          <div class="item-controls" id="controls-${item.id}">
            ${inCartQty > 0 ? `
              <div class="qty-counter">
                <button class="qty-btn" onclick="modifyCartItem(${item.id}, -1)">−</button>
                <span class="qty-val">${inCartQty}</span>
                <button class="qty-btn" onclick="modifyCartItem(${item.id}, 1)">+</button>
              </div>
            ` : `
              <button class="btn-add-item" onclick="modifyCartItem(${item.id}, 1)">+ Add</button>
            `}
          </div>
        </div>
      </article>
    `;
  }).join('');
}

// ── FILTER HANDLERS ───────────────────────────────────────────
function setupFilterHandlers() {
  // Category pills
  const catPills = document.querySelectorAll('.cat-pill');
  catPills.forEach(pill => {
    pill.addEventListener('click', () => {
      catPills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      currentFilterCat = pill.dataset.cat;
      renderMenu();
    });
  });

  // Dietary filters
  const dietBtns = document.querySelectorAll('.diet-btn');
  dietBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      dietBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentFilterDiet = btn.dataset.diet;
      renderMenu();
    });
  });

  // Search input
  const searchInput = document.getElementById('menu-search');
  const searchClear = document.getElementById('search-clear');

  searchInput.addEventListener('input', e => {
    searchQuery = e.target.value.trim();
    searchClear.style.display = searchQuery ? 'block' : 'none';
    renderMenu();
  });

  searchClear.addEventListener('click', () => {
    searchInput.value = '';
    searchQuery = '';
    searchClear.style.display = 'none';
    renderMenu();
    searchInput.focus();
  });
}

// ── CART OPERATIONS ───────────────────────────────────────────
window.modifyCartItem = function(id, delta) {
  const rawMenu = (typeof DAS_CAFE_MENU !== 'undefined') ? DAS_CAFE_MENU : [];
  const item = rawMenu.find(m => m.id === id);
  if (!item) return;

  if (!cart[id]) {
    cart[id] = { item, qty: 0 };
  }

  cart[id].qty += delta;

  if (cart[id].qty <= 0) {
    delete cart[id];
  } else if (delta > 0) {
    playChime('add');
    showToast(`Added "${item.name}" to order!`);
  }

  saveCart();
  updateCartUI();
  renderMenu();
};

function saveCart() {
  try {
    sessionStorage.setItem('DAS_CAFE_USER_CART', JSON.stringify(cart));
  } catch (e) {}
}

function updateCartUI() {
  const countEl = document.getElementById('cart-count');
  const badgeTotalEl = document.getElementById('cart-badge-total');
  const itemsWrapper = document.getElementById('cart-items-wrapper');
  const footerEl = document.getElementById('cart-drawer-footer');
  const emptyState = document.getElementById('cart-empty-state');

  let totalItems = 0;
  let subtotal = 0;

  const itemKeys = Object.keys(cart);

  if (itemKeys.length === 0) {
    countEl.textContent = '0';
    badgeTotalEl.textContent = '₹0';
    footerEl.style.display = 'none';
    itemsWrapper.innerHTML = `
      <div class="cart-empty-state" id="cart-empty-state">
        <div class="empty-icon">☕</div>
        <div class="empty-title">Your cart is empty</div>
        <p>Explore our menu and add authentic coffees, dosas, and treats!</p>
        <button class="u-btn-outline" onclick="document.getElementById('btn-close-cart').click();">Browse Menu</button>
      </div>
    `;
    return;
  }

  let html = '';
  itemKeys.forEach(key => {
    const entry = cart[key];
    const lineTotal = entry.item.price * entry.qty;
    totalItems += entry.qty;
    subtotal += lineTotal;

    html += `
      <div class="cart-item-row">
        <div class="cart-item-info">
          <div class="cart-item-name">${entry.item.name}</div>
          <div class="cart-item-sub">₹ ${entry.item.price} each</div>
        </div>
        <div class="cart-item-qty">
          <button class="qty-btn" onclick="modifyCartItem(${entry.item.id}, -1)">−</button>
          <span class="qty-val">${entry.qty}</span>
          <button class="qty-btn" onclick="modifyCartItem(${entry.item.id}, 1)">+</button>
        </div>
        <div class="cart-item-total">₹ ${lineTotal}</div>
      </div>
    `;
  });

  itemsWrapper.innerHTML = html;
  footerEl.style.display = 'flex';

  countEl.textContent = String(totalItems);
  badgeTotalEl.textContent = `₹${subtotal}`;

  // Calculate bill
  let discountAmount = 0;
  if (discountType === 'percent') {
    discountAmount = Math.round((subtotal * appliedDiscount) / 100);
  } else if (discountType === 'fixed') {
    discountAmount = Math.min(appliedDiscount, subtotal);
  }

  const finalTotal = Math.max(0, subtotal - discountAmount);
  const gstInclusive = Math.round((finalTotal * 5) / 105);

  document.getElementById('bill-subtotal').textContent = `₹ ${subtotal}`;
  const discRow = document.getElementById('bill-discount-row');
  if (discountAmount > 0) {
    discRow.style.display = 'flex';
    document.getElementById('bill-discount').textContent = `-₹ ${discountAmount}`;
  } else {
    discRow.style.display = 'none';
  }

  document.getElementById('bill-tax').textContent = `₹ ${gstInclusive}`;
  document.getElementById('bill-total').textContent = `₹ ${finalTotal}`;
  document.getElementById('btn-checkout-amount').textContent = `₹ ${finalTotal}`;
}

function setupCartHandlers() {
  const drawer = document.getElementById('u-cart-drawer');
  const overlay = document.getElementById('u-cart-overlay');
  const openBtn = document.getElementById('btn-open-cart');
  const closeBtn = document.getElementById('btn-close-cart');

  function openCart() {
    drawer.classList.add('open');
    overlay.classList.add('open');
  }

  function closeCart() {
    drawer.classList.remove('open');
    overlay.classList.remove('open');
  }

  openBtn.addEventListener('click', openCart);
  closeBtn.addEventListener('click', closeCart);
  overlay.addEventListener('click', closeCart);

  // Apply Coupon
  const couponBtn = document.getElementById('btn-apply-coupon');
  const couponInput = document.getElementById('coupon-code');
  const couponMsg = document.getElementById('coupon-message');

  couponBtn.addEventListener('click', () => {
    const code = couponInput.value.trim().toUpperCase();
    if (code === 'DAS10') {
      appliedDiscount = 10;
      discountType = 'percent';
      couponMsg.className = 'coupon-msg success';
      couponMsg.textContent = '✓ 10% DAS CAFE Discount applied!';
    } else if (code === 'FIRSTCUP') {
      appliedDiscount = 20;
      discountType = 'fixed';
      couponMsg.className = 'coupon-msg success';
      couponMsg.textContent = '✓ ₹20 Welcome Credit applied!';
    } else {
      appliedDiscount = 0;
      discountType = null;
      couponMsg.className = 'coupon-msg error';
      couponMsg.textContent = '✗ Invalid voucher code';
    }
    updateCartUI();
  });

  // Place Order Action
  const placeOrderBtn = document.getElementById('btn-place-order');
  placeOrderBtn.addEventListener('click', () => {
    placeOrder();
  });
}

// ── PLACE ORDER LOGIC ─────────────────────────────────────────
function placeOrder() {
  const itemKeys = Object.keys(cart);
  if (itemKeys.length === 0) return;

  const diningMode = document.getElementById('dining-mode').value;
  const tableNum = document.getElementById('table-number').value;
  const location = diningMode === 'dine-in' ? tableNum : 'Takeaway (Parcel)';
  const custName = document.getElementById('cust-name').value.trim() || 'Guest';
  const custPhone = document.getElementById('cust-phone').value.trim() || '';
  const notes = document.getElementById('order-notes').value.trim();
  const payMethod = document.querySelector('input[name="pay-method"]:checked').value;

  let subtotal = 0;
  const orderItems = itemKeys.map(key => {
    const entry = cart[key];
    const amount = entry.item.price * entry.qty;
    subtotal += amount;
    return {
      id: entry.item.id,
      name: entry.item.name,
      category: entry.item.category,
      price: entry.item.price,
      qty: entry.qty,
      total: amount
    };
  });

  let discountAmount = 0;
  if (discountType === 'percent') {
    discountAmount = Math.round((subtotal * appliedDiscount) / 100);
  } else if (discountType === 'fixed') {
    discountAmount = Math.min(appliedDiscount, subtotal);
  }

  const grandTotal = Math.max(0, subtotal - discountAmount);

  // Generate Unique Order ID and Bill Number
  const now = new Date();
  const orderId = 'ORD-' + Math.floor(1000 + Math.random() * 9000);
  const timeStr = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
  const dateStr = now.toISOString().slice(0, 10);

  const orderRecord = {
    orderId: orderId,
    timestamp: now.getTime(),
    date: dateStr,
    time: timeStr,
    customerName: custName,
    customerPhone: custPhone,
    serviceMode: diningMode,
    tableOrParcel: location,
    items: orderItems,
    subtotal: subtotal,
    discount: discountAmount,
    grandTotal: grandTotal,
    paymentMethod: payMethod,
    notes: notes,
    status: 'new' // 'new', 'preparing', 'ready', 'completed'
  };

  // 1. Save into Active Orders for Customer Tracking & Owner KDS
  saveActiveOrder(orderRecord);

  // 2. Also record into Master Management DB (DB.salesLog)
  syncOrderToMgmtDb(orderRecord);

  // 3. Play success chime & show confirmation modal
  playChime('success');
  showOrderSuccessModal(orderRecord);

  // 4. Reset Cart
  cart = {};
  appliedDiscount = 0;
  discountType = null;
  saveCart();
  updateCartUI();
  renderMenu();

  // Close drawer
  document.getElementById('u-cart-drawer').classList.remove('open');
  document.getElementById('u-cart-overlay').classList.remove('open');

  // Update tracker view
  renderActiveOrdersTracker();
}

function saveActiveOrder(order) {
  let list = [];
  try {
    const raw = localStorage.getItem(ACTIVE_ORDERS_KEY);
    if (raw) list = JSON.parse(raw);
  } catch (e) {}

  list.unshift(order);
  localStorage.setItem(ACTIVE_ORDERS_KEY, JSON.stringify(list));
}

function syncOrderToMgmtDb(order) {
  try {
    const raw = localStorage.getItem(MGMT_STORE_KEY);
    if (!raw) return;
    const db = JSON.parse(raw);

    if (!Array.isArray(db.salesLog)) db.salesLog = [];

    // Add each order item as a salesLog entry
    order.items.forEach(item => {
      db.salesLog.push({
        billNo: db.nextBillNo || (1000 + db.salesLog.length + 1),
        date: order.date,
        time: order.time,
        itemId: 'ITM-' + String(item.id).padStart(3, '0'),
        itemName: item.name,
        qty: item.qty,
        price: item.price,
        discount: 0,
        status: 'Active',
        paymentMode: order.paymentMethod,
        enteredBy: `Customer App (${order.tableOrParcel})`,
        reason: order.notes || 'User Panel Order'
      });
    });

    if (db.nextBillNo) db.nextBillNo += 1;
    localStorage.setItem(MGMT_STORE_KEY, JSON.stringify(db));
  } catch (e) {
    console.warn('Sync to MGMT error', e);
  }
}

// ── SUCCESS MODAL & TICKET ────────────────────────────────────
function showOrderSuccessModal(order) {
  const modal = document.getElementById('order-modal-overlay');
  const details = document.getElementById('modal-ticket-details');

  details.innerHTML = `
    <div style="display: flex; justify-content: space-between; border-bottom: 1px dashed var(--border-gold); padding-bottom: 8px; margin-bottom: 8px;">
      <strong style="color: var(--gold-light); font-family: var(--font-mono); font-size: 1.1rem;">${order.orderId}</strong>
      <span style="color: var(--cream-dim);">${order.time}</span>
    </div>
    <div><strong>Location:</strong> ${order.tableOrParcel}</div>
    <div><strong>Guest:</strong> ${order.customerName}</div>
    <div><strong>Payment:</strong> ${order.paymentMethod}</div>
    <div style="margin: 8px 0; border-top: 1px solid rgba(255,255,255,0.08); padding-top: 8px;">
      ${order.items.map(it => `
        <div style="display:flex; justify-content:space-between; font-size:0.84rem;">
          <span>${it.qty}x ${it.name}</span>
          <span style="font-family:var(--font-mono)">₹ ${it.total}</span>
        </div>
      `).join('')}
    </div>
    <div style="display:flex; justify-content:space-between; border-top: 1px dashed var(--border-gold); padding-top: 8px; font-weight:700; color:var(--gold-light);">
      <span>Total Paid:</span>
      <span style="font-family:var(--font-mono)">₹ ${order.grandTotal}</span>
    </div>
  `;

  modal.classList.add('open');

  document.getElementById('btn-modal-close').onclick = () => {
    modal.classList.remove('open');
  };

  document.getElementById('btn-view-tracker').onclick = () => {
    modal.classList.remove('open');
    // Switch to tracker tab
    const trackerTabBtn = document.querySelector('[data-tab="tracker"]');
    if (trackerTabBtn) trackerTabBtn.click();
  };
}

// ── LIVE TRACKER RENDERING ────────────────────────────────────
function renderActiveOrdersTracker() {
  const container = document.getElementById('tracker-content');
  const dot = document.getElementById('active-orders-dot');
  if (!container) return;

  let orders = [];
  try {
    const raw = localStorage.getItem(ACTIVE_ORDERS_KEY);
    if (raw) orders = JSON.parse(raw);
  } catch (e) {}

  if (dot) {
    const hasUnfinished = orders.some(o => o.status !== 'completed');
    dot.style.display = hasUnfinished ? 'inline-block' : 'none';
  }

  if (orders.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 48px 20px; color: var(--text-muted); background: var(--bg-card); border-radius: var(--radius-lg); border: 1px solid var(--border-gold);">
        <div style="font-size: 3rem; margin-bottom: 12px;">🛎️</div>
        <h3 style="font-family: var(--font-serif); color: var(--cream); margin-bottom: 6px;">No Active Orders Found</h3>
        <p>You haven't placed an order yet. Select items from our menu to track preparation live!</p>
        <button class="u-btn-primary" style="margin-top: 16px;" onclick="document.querySelector('[data-tab=\\'menu\\']').click();">Explore Menu</button>
      </div>
    `;
    return;
  }

  container.innerHTML = orders.slice(0, 5).map(order => {
    // Stage indexes: 1 = new, 2 = preparing, 3 = ready, 4 = completed
    let stage = 1;
    let progressWidth = '12%';

    if (order.status === 'preparing') {
      stage = 2;
      progressWidth = '45%';
    } else if (order.status === 'ready') {
      stage = 3;
      progressWidth = '78%';
    } else if (order.status === 'completed') {
      stage = 4;
      progressWidth = '100%';
    }

    return `
      <div class="tracker-card">
        <div class="tracker-top">
          <div class="tracker-id-title">
            <span>🏷️ ${order.orderId}</span>
            <span class="status-badge ${order.status}">${order.status}</span>
          </div>
          <div style="font-size: 0.85rem; color: var(--cream-dim);">
            <span>${order.tableOrParcel}</span> · 
            <span>${order.time}</span>
          </div>
        </div>

        <!-- 4-Stage Timeline -->
        <div class="timeline-steps">
          <div class="timeline-progress-bar" style="width: ${progressWidth};"></div>
          
          <div class="t-step ${stage >= 1 ? (stage === 1 ? 'active' : 'completed') : ''}">
            <div class="t-dot">${stage > 1 ? '✓' : '1'}</div>
            <div class="t-title">Order Received</div>
          </div>

          <div class="t-step ${stage >= 2 ? (stage === 2 ? 'active' : 'completed') : ''}">
            <div class="t-dot">${stage > 2 ? '✓' : '2'}</div>
            <div class="t-title">Brewing / Cooking</div>
          </div>

          <div class="t-step ${stage >= 3 ? (stage === 3 ? 'active' : 'completed') : ''}">
            <div class="t-dot">${stage > 3 ? '✓' : '3'}</div>
            <div class="t-title">Ready at Counter</div>
          </div>

          <div class="t-step ${stage >= 4 ? 'completed active' : ''}">
            <div class="t-dot">☕</div>
            <div class="t-title">Served & Enjoy!</div>
          </div>
        </div>

        <!-- Order Items Breakdown -->
        <div class="tracker-items-list">
          <strong style="font-size:0.8rem; text-transform:uppercase; color:var(--text-muted); letter-spacing:0.06em;">Order Details:</strong>
          ${order.items.map(it => `
            <div class="t-item-row">
              <span>${it.qty} × ${it.name}</span>
              <span style="font-family: var(--font-mono); color: var(--gold-light);">₹ ${it.total}</span>
            </div>
          `).join('')}
          <div style="display:flex; justify-content:space-between; margin-top:8px; padding-top:8px; border-top:1px dashed rgba(255,255,255,0.1); font-weight:700;">
            <span>Total (${order.paymentMethod}):</span>
            <span style="font-family: var(--font-mono); color: var(--gold-light);">₹ ${order.grandTotal}</span>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// Listen to storage events so when Owner updates order status, customer tracker auto-updates!
function listenToOrderUpdates() {
  window.addEventListener('storage', (e) => {
    if (e.key === ACTIVE_ORDERS_KEY) {
      renderActiveOrdersTracker();
      playChime('success');
      showToast('Order status updated by Kitchen!');
    }
  });

  // Also periodic polling (every 3 seconds) for same-window updates
  setInterval(() => {
    renderActiveOrdersTracker();
  }, 3500);
}

// ── TABLE RESERVATIONS ────────────────────────────────────────
function setupReservationHandler() {
  const form = document.getElementById('reservation-form');
  const confirmBox = document.getElementById('res-confirmation');
  const ticketBody = document.getElementById('res-ticket-body');
  if (!form) return;

  // Set default date to today
  const dateInput = document.getElementById('res-date');
  if (dateInput) dateInput.value = new Date().toISOString().slice(0, 10);

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const resId = 'RES-' + Math.floor(100 + Math.random() * 900);
    const name = document.getElementById('res-name').value.trim();
    const phone = document.getElementById('res-phone').value.trim();
    const date = document.getElementById('res-date').value;
    const time = document.getElementById('res-time').value;
    const guests = document.getElementById('res-guests').value;
    const seating = document.getElementById('res-seating').value;
    const notes = document.getElementById('res-notes').value.trim();

    const record = { resId, name, phone, date, time, guests, seating, notes, timestamp: Date.now() };

    let allRes = [];
    try {
      const raw = localStorage.getItem(RESERVATIONS_KEY);
      if (raw) allRes = JSON.parse(raw);
    } catch (e) {}

    allRes.unshift(record);
    localStorage.setItem(RESERVATIONS_KEY, JSON.stringify(allRes));

    playChime('success');

    ticketBody.innerHTML = `
      <div><strong>Booking Ref:</strong> <code style="color:var(--gold-light)">${resId}</code></div>
      <div><strong>Guest Name:</strong> ${name}</div>
      <div><strong>Party Size:</strong> ${guests} Guests</div>
      <div><strong>Date & Time:</strong> ${date} at ${time}</div>
      <div><strong>Seating Preference:</strong> ${seating}</div>
      ${notes ? `<div><strong>Notes:</strong> ${notes}</div>` : ''}
    `;

    form.style.display = 'none';
    confirmBox.style.display = 'block';
  });
}

// ── REVIEWS & FEEDBACK ────────────────────────────────────────
function setupReviewHandler() {
  const form = document.getElementById('feedback-form');
  const list = document.getElementById('reviews-list');
  const starBtns = document.querySelectorAll('.star-btn');
  let selectedRating = 5;

  starBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const val = parseInt(btn.dataset.rating);
      selectedRating = val;
      starBtns.forEach(b => {
        const r = parseInt(b.dataset.rating);
        b.classList.toggle('active', r <= val);
      });
    });
  });

  const defaultReviews = [
    { name: "Vikram R.", rating: 5, fave: "FULL COFFEE", text: "The authentic South Indian filter coffee aroma here is unbeatable in Vega. Pure comfort in every sip!" },
    { name: "Pooja Mehta", rating: 5, fave: "MASALA DOSA", text: "Crispiest masala dosa in town! The coconut chutney has that authentic roasted chana dal taste." },
    { name: "Amitabh Sen", rating: 5, fave: "GRILL CHESSE SANDWICH", text: "Ordered from Table 4 using the digital panel — food arrived within 8 minutes piping hot. Great vibe!" }
  ];

  function renderReviews() {
    let stored = [];
    try {
      const raw = localStorage.getItem(REVIEWS_KEY);
      if (raw) stored = JSON.parse(raw);
    } catch (e) {}

    const combined = [...stored, ...defaultReviews];
    if (list) {
      list.innerHTML = combined.map(r => `
        <div class="review-item">
          <div class="review-item-top">
            <span class="review-author">${r.name}</span>
            <span class="review-stars">${'★'.repeat(r.rating)}</span>
          </div>
          <div class="review-fave">Favorite: ${r.fave}</div>
          <p class="review-text">"${r.text}"</p>
        </div>
      `).join('');
    }
  }

  renderReviews();

  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = document.getElementById('fb-name').value.trim();
      const fave = document.getElementById('fb-fave').value;
      const text = document.getElementById('fb-text').value.trim();

      const newReview = { name, rating: selectedRating, fave, text, timestamp: Date.now() };

      let stored = [];
      try {
        const raw = localStorage.getItem(REVIEWS_KEY);
        if (raw) stored = JSON.parse(raw);
      } catch (e) {}

      stored.unshift(newReview);
      localStorage.setItem(REVIEWS_KEY, JSON.stringify(stored));

      playChime('success');
      showToast('Thank you! Your review has been published.');
      form.reset();
      renderReviews();
    });
  }
}

// ── TOAST HELPER ──────────────────────────────────────────────
function showToast(msg) {
  const toast = document.getElementById('u-toast');
  const msgEl = document.getElementById('u-toast-msg');
  if (!toast || !msgEl) return;

  msgEl.textContent = msg;
  toast.classList.add('show');
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => {
    toast.classList.remove('show');
  }, 2800);
}

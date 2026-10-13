/* ============================================================
   DAS CAFE — Owner & Management Hub Logic
   Features:
     - PIN Security Gate (Default: 1234, 1-Click Demo Unlock)
     - Executive KPI HUD & Store Status
     - Live KDS Kitchen Display System with Order State Actions
     - Express Counter POS Terminal with Instant Bill Generation
     - Real-Time Inventory & Low-Stock Alerts + Quick Restock
     - Daily Cash-Out & Expense Tracker
     - 30/30/30/10 Financial Target Reconciliation
     - Deep Links to 13 Management Sheets
   ============================================================ */

'use strict';

// ── CONSTANTS & STORAGE KEYS ──────────────────────────────────
const PIN_CODE = '1234';
const AUTH_KEY = 'DAS_CAFE_OWNER_AUTH';
const MGMT_STORE_KEY = 'DAS_CAFE_MGMT';
const ACTIVE_ORDERS_KEY = 'DAS_CAFE_ACTIVE_ORDERS';
const EXPENSES_KEY = 'DAS_CAFE_EXPENSES';

// Default Tracked Ingredients for Stock Monitor
const DEFAULT_STOCK_ITEMS = [
  { id: 'ING-001', name: 'Fresh Whole Milk', category: 'Dairy', stock: 24, unit: 'Litre', min: 10, unitPrice: 56 },
  { id: 'ING-002', name: 'Coffee Decoction Blend', category: 'Beverage', stock: 8.5, unit: 'Kg', min: 4, unitPrice: 380 },
  { id: 'ING-003', name: 'Assam Tea Leaves', category: 'Beverage', stock: 6.2, unit: 'Kg', min: 3, unitPrice: 280 },
  { id: 'ING-004', name: 'Amul Butter', category: 'Dairy', stock: 12, unit: 'Pack (500g)', min: 5, unitPrice: 275 },
  { id: 'ING-005', name: 'Processed Cheese Blocks', category: 'Dairy', stock: 4.8, unit: 'Kg', min: 3, unitPrice: 480 },
  { id: 'ING-006', name: 'Sandwich Bread Loaves', category: 'Bakery', stock: 18, unit: 'Loaf', min: 8, unitPrice: 40 },
  { id: 'ING-007', name: 'Fermented Dosa/Idli Batter', category: 'Produce', stock: 32, unit: 'Kg', min: 12, unitPrice: 45 },
  { id: 'ING-008', name: 'Potatoes (Masala)', category: 'Produce', stock: 22, unit: 'Kg', min: 10, unitPrice: 28 },
  { id: 'ING-009', name: 'Fresh Green Chutney Herbs', category: 'Produce', stock: 3.5, unit: 'Kg', min: 2, unitPrice: 60 },
  { id: 'ING-010', name: 'Takeaway Cups & Packaging', category: 'Packaging', stock: 140, unit: 'Pcs', min: 50, unitPrice: 3.5 }
];

// ── STATE ─────────────────────────────────────────────────────
let enteredPin = '';
let currentKdsFilter = 'all';
let posCart = {}; // { itemId: { item, qty } }
let posSelectedPayment = 'Cash';
let storeIsOpen = true;

// Audio Chime using Web Audio API
function playChime(freq = 600, duration = 0.25) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);

    osc.start();
    osc.stop(ctx.currentTime + duration);
  } catch (e) {}
}

// ── INITIALIZATION ────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initPinGate();
  initClockAndStore();
  initOwnerTabs();
  initKdsOrders();
  initExpressPos();
  initStockMonitor();
  initExpenses();
  initReconciliation();

  // Check if session is already authorized
  if (sessionStorage.getItem(AUTH_KEY) === 'true') {
    unlockConsole();
  }
});

// ── §1 PIN SECURITY GATE ──────────────────────────────────────
function initPinGate() {
  const pinGate = document.getElementById('pin-gate');
  const errorMsg = document.getElementById('pin-error-msg');
  const demoBtn = document.getElementById('btn-demo-unlock');
  const keyClear = document.getElementById('btn-pin-clear');
  const keyDel = document.getElementById('btn-pin-del');
  const keyBtns = document.querySelectorAll('.key-btn[data-val]');
  const lockBtn = document.getElementById('btn-lock-session');

  function updatePinDots() {
    for (let i = 1; i <= 4; i++) {
      const dot = document.getElementById('pdot-' + i);
      if (dot) dot.classList.toggle('filled', i <= enteredPin.length);
    }
  }

  function handleKey(val) {
    if (enteredPin.length < 4) {
      enteredPin += val;
      updatePinDots();
      errorMsg.classList.remove('show');

      if (enteredPin.length === 4) {
        verifyPin();
      }
    }
  }

  function verifyPin() {
    if (enteredPin === PIN_CODE) {
      playChime(800, 0.3);
      sessionStorage.setItem(AUTH_KEY, 'true');
      unlockConsole();
    } else {
      playChime(300, 0.3);
      errorMsg.classList.add('show');
      setTimeout(() => {
        enteredPin = '';
        updatePinDots();
      }, 500);
    }
  }

  keyBtns.forEach(b => {
    b.addEventListener('click', () => handleKey(b.dataset.val));
  });

  keyClear.addEventListener('click', () => {
    enteredPin = '';
    updatePinDots();
    errorMsg.classList.remove('show');
  });

  keyDel.addEventListener('click', () => {
    enteredPin = enteredPin.slice(0, -1);
    updatePinDots();
  });

  // 1-Click Demo Unlock
  demoBtn.addEventListener('click', () => {
    enteredPin = PIN_CODE;
    updatePinDots();
    setTimeout(() => verifyPin(), 150);
  });

  // Lock Console
  if (lockBtn) {
    lockBtn.addEventListener('click', () => {
      sessionStorage.removeItem(AUTH_KEY);
      enteredPin = '';
      updatePinDots();
      document.getElementById('owner-app').style.display = 'none';
      pinGate.style.display = 'flex';
      showToast('Owner session locked');
    });
  }
}

function unlockConsole() {
  document.getElementById('pin-gate').style.display = 'none';
  document.getElementById('owner-app').style.display = 'block';
  refreshAllData();
}

// ── §2 CLOCK & STORE STATUS ───────────────────────────────────
function initClockAndStore() {
  const clockEl = document.getElementById('o-live-clock');
  const storeBtn = document.getElementById('btn-toggle-store');
  const storeText = document.getElementById('store-status-text');

  function updateClock() {
    const now = new Date();
    clockEl.textContent = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
  }

  setInterval(updateClock, 1000);
  updateClock();

  storeBtn.addEventListener('click', () => {
    storeIsOpen = !storeIsOpen;
    if (storeIsOpen) {
      storeBtn.className = 'store-status-btn open';
      storeText.textContent = 'OPEN (Accepting Orders)';
      showToast('Store status set to OPEN');
    } else {
      storeBtn.className = 'store-status-btn closed';
      storeText.textContent = 'CLOSED (Kitchen Paused)';
      showToast('Store status set to CLOSED', true);
    }
  });
}

// ── §3 OWNER TABS ─────────────────────────────────────────────
function initOwnerTabs() {
  const tabBtns = document.querySelectorAll('.o-tab-btn');
  const panels = document.querySelectorAll('.o-panel');

  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.tab;

      tabBtns.forEach(b => b.classList.remove('active'));
      panels.forEach(p => p.classList.remove('active'));

      btn.classList.add('active');
      const panel = document.getElementById('opanel-' + target);
      if (panel) panel.classList.add('active');

      if (target === 'kds') renderKdsOrders();
      if (target === 'stock') renderStock();
      if (target === 'reconcile') calculateReconciliation();
      if (target === 'expenses') renderExpenses();
    });
  });
}

// ── §4 REFRESH ALL DATA & KPIS ────────────────────────────────
function refreshAllData() {
  updateKpiHud();
  renderKdsOrders();
  renderPosTouchGrid();
  renderStock();
  renderExpenses();
  calculateReconciliation();
}

function updateKpiHud() {
  const revEl = document.getElementById('kpi-rev-today');
  const ordersEl = document.getElementById('kpi-orders-count');
  const activeEl = document.getElementById('kpi-active-count');
  const activeBadge = document.getElementById('kpi-active-badge');
  const aovEl = document.getElementById('kpi-aov');
  const kdsTabBadge = document.getElementById('tab-kds-badge');

  let activeOrders = [];
  try {
    const raw = localStorage.getItem(ACTIVE_ORDERS_KEY);
    if (raw) activeOrders = JSON.parse(raw);
  } catch (e) {}

  let mgmtSales = [];
  try {
    const raw = localStorage.getItem(MGMT_STORE_KEY);
    if (raw) {
      const db = JSON.parse(raw);
      mgmtSales = db.salesLog || [];
    }
  } catch (e) {}

  // Calculate Today's revenue & orders
  const todayStr = new Date().toISOString().slice(0, 10);

  // Sum active orders grand total
  let totalRev = activeOrders.reduce((sum, o) => sum + (o.grandTotal || 0), 0);
  let totalOrdersCount = activeOrders.length;

  // Active queue: status is 'new' or 'preparing'
  const activeCount = activeOrders.filter(o => o.status === 'new' || o.status === 'preparing').length;

  activeEl.textContent = String(activeCount);
  activeBadge.textContent = `${activeCount} Live`;
  if (kdsTabBadge) {
    kdsTabBadge.textContent = String(activeCount);
    kdsTabBadge.style.display = activeCount > 0 ? 'inline-block' : 'none';
  }

  // If no active orders, fall back to mgmtSales
  if (totalOrdersCount === 0 && mgmtSales.length > 0) {
    mgmtSales.forEach(s => {
      totalRev += (s.price * s.qty) - (s.discount || 0);
    });
    totalOrdersCount = mgmtSales.length;
  }

  revEl.textContent = `₹ ${totalRev.toLocaleString('en-IN')}`;
  ordersEl.textContent = String(totalOrdersCount);

  const aov = totalOrdersCount > 0 ? Math.round(totalRev / totalOrdersCount) : 0;
  aovEl.textContent = `₹ ${aov.toLocaleString('en-IN')}`;
}

// ── §5 KDS LIVE ORDERS ────────────────────────────────────────
function initKdsOrders() {
  const filterBtns = document.querySelectorAll('.kds-filter-btn');
  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentKdsFilter = btn.dataset.filter;
      renderKdsOrders();
    });
  });

  const refreshBtn = document.getElementById('btn-refresh-kds');
  if (refreshBtn) refreshBtn.addEventListener('click', () => {
    renderKdsOrders();
    updateKpiHud();
    showToast('KDS queue refreshed');
  });

  // Listen to storage events from Customer panel
  window.addEventListener('storage', (e) => {
    if (e.key === ACTIVE_ORDERS_KEY) {
      playChime(950, 0.4);
      showToast('🛎️ New Customer Order Received!');
      renderKdsOrders();
      updateKpiHud();
    }
  });

  // Polling every 3s
  setInterval(() => {
    renderKdsOrders();
    updateKpiHud();
  }, 3500);
}

function renderKdsOrders() {
  const grid = document.getElementById('kds-orders-grid');
  if (!grid) return;

  let orders = [];
  try {
    const raw = localStorage.getItem(ACTIVE_ORDERS_KEY);
    if (raw) orders = JSON.parse(raw);
  } catch (e) {}

  let filtered = orders;
  if (currentKdsFilter !== 'all') {
    filtered = orders.filter(o => o.status === currentKdsFilter);
  }

  if (filtered.length === 0) {
    grid.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 48px 20px; background: var(--bg-card); border-radius: var(--radius-lg); border: 1px dashed var(--border-gold); color: var(--text-muted);">
        <div style="font-size: 2.5rem; margin-bottom: 8px;">🍽️</div>
        <h3 style="color: var(--cream); font-family: var(--font-serif); margin-bottom: 4px;">No Orders in this Status</h3>
        <p>Customer orders from Table App and POS Terminal will appear here live.</p>
      </div>
    `;
    return;
  }

  grid.innerHTML = filtered.map(order => {
    return `
      <div class="kds-card status-${order.status}" data-id="${order.orderId}">
        <div class="kds-top">
          <div>
            <div class="kds-order-id">${order.orderId}</div>
            <div class="kds-meta">
              <strong>${order.tableOrParcel}</strong> · <span>${order.customerName}</span> · <span>${order.time}</span>
            </div>
          </div>
          <span class="kds-badge ${order.status}">${order.status}</span>
        </div>

        <div class="kds-items-list">
          ${order.items.map(it => `
            <div class="kds-item-line">
              <span><strong>${it.qty}x</strong> ${it.name}</span>
              <span class="font-mono" style="color: var(--gold-light);">₹ ${it.total}</span>
            </div>
          `).join('')}
        </div>

        ${order.notes ? `<div class="kds-note">📝 Note: "${order.notes}"</div>` : ''}

        <div style="display:flex; justify-content:space-between; font-size:0.8rem; margin-bottom:10px; color:var(--cream-dim);">
          <span>Payment: <strong>${order.paymentMethod}</strong></span>
          <span class="font-mono" style="font-weight:700; color:var(--cream);">Total: ₹ ${order.grandTotal}</span>
        </div>

        <div class="kds-actions">
          ${order.status === 'new' ? `
            <button class="kds-btn kds-btn-prep" onclick="setOrderStatus('${order.orderId}', 'preparing')">▶ Start Prep</button>
          ` : ''}
          ${order.status === 'preparing' ? `
            <button class="kds-btn kds-btn-ready" onclick="setOrderStatus('${order.orderId}', 'ready')">✓ Mark Ready</button>
          ` : ''}
          ${order.status === 'ready' ? `
            <button class="kds-btn kds-btn-complete" onclick="setOrderStatus('${order.orderId}', 'completed')">★ Completed</button>
          ` : ''}
          ${order.status === 'completed' ? `
            <span style="font-size:0.75rem; color:var(--green); display:flex; align-items:center; gap:4px;">✓ Order Settled</span>
          ` : ''}
          <button class="kds-btn kds-btn-void" onclick="setOrderStatus('${order.orderId}', 'void')" title="Void/Cancel">✕</button>
        </div>
      </div>
    `;
  }).join('');
}

window.setOrderStatus = function(orderId, nextStatus) {
  let orders = [];
  try {
    const raw = localStorage.getItem(ACTIVE_ORDERS_KEY);
    if (raw) orders = JSON.parse(raw);
  } catch (e) {}

  if (nextStatus === 'void') {
    orders = orders.filter(o => o.orderId !== orderId);
    showToast(`Order ${orderId} voided`);
  } else {
    const target = orders.find(o => o.orderId === orderId);
    if (target) {
      target.status = nextStatus;
      showToast(`Order ${orderId} marked as ${nextStatus.toUpperCase()}`);
      playChime(750, 0.2);
    }
  }

  localStorage.setItem(ACTIVE_ORDERS_KEY, JSON.stringify(orders));
  renderKdsOrders();
  updateKpiHud();
};

// ── §6 EXPRESS COUNTER POS ────────────────────────────────────
function initExpressPos() {
  const catBtns = document.querySelectorAll('.pos-cat-btn');
  catBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      catBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderPosTouchGrid(btn.dataset.cat);
    });
  });

  const payBtns = document.querySelectorAll('.pos-pay-btn');
  payBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      payBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      posSelectedPayment = btn.dataset.method;
    });
  });

  document.getElementById('btn-pos-clear').addEventListener('click', () => {
    posCart = {};
    updatePosTicketUI();
  });

  document.getElementById('btn-pos-record-sale').addEventListener('click', recordPosSale);

  renderPosTouchGrid();
}

function renderPosTouchGrid(cat = 'all') {
  const grid = document.getElementById('pos-items-grid');
  if (!grid) return;

  const menu = (typeof DAS_CAFE_MENU !== 'undefined') ? DAS_CAFE_MENU : [];
  const filtered = cat === 'all' ? menu : menu.filter(m => m.category === cat);

  grid.innerHTML = filtered.map(item => `
    <button class="pos-item-btn" onclick="addPosItem(${item.id})">
      <span class="p-item-name">${item.name}</span>
      <span class="p-item-price">₹ ${item.price}</span>
    </button>
  `).join('');
}

window.addPosItem = function(id) {
  const menu = (typeof DAS_CAFE_MENU !== 'undefined') ? DAS_CAFE_MENU : [];
  const item = menu.find(m => m.id === id);
  if (!item) return;

  if (!posCart[id]) {
    posCart[id] = { item, qty: 1 };
  } else {
    posCart[id].qty += 1;
  }

  playChime(520, 0.1);
  updatePosTicketUI();
};

window.modifyPosQty = function(id, delta) {
  if (!posCart[id]) return;
  posCart[id].qty += delta;
  if (posCart[id].qty <= 0) delete posCart[id];
  updatePosTicketUI();
};

function updatePosTicketUI() {
  const body = document.getElementById('pos-ticket-body');
  const subtotalEl = document.getElementById('pos-subtotal');
  const grandTotalEl = document.getElementById('pos-grand-total');
  const checkoutBtn = document.getElementById('btn-pos-record-sale');

  const keys = Object.keys(posCart);
  if (keys.length === 0) {
    body.innerHTML = '<div class="ticket-empty">Select items from the left to build order bill</div>';
    subtotalEl.textContent = '₹ 0';
    grandTotalEl.textContent = '₹ 0';
    checkoutBtn.disabled = true;
    checkoutBtn.textContent = 'Complete Sale & Print Bill (₹0)';
    return;
  }

  let subtotal = 0;
  body.innerHTML = keys.map(k => {
    const entry = posCart[k];
    const lineTotal = entry.item.price * entry.qty;
    subtotal += lineTotal;

    return `
      <div class="pos-ticket-line">
        <div style="flex:1;">
          <strong>${entry.item.name}</strong>
          <div style="font-size:0.75rem; color:var(--text-muted)">₹ ${entry.item.price} each</div>
        </div>
        <div class="pos-line-controls">
          <button class="pos-line-btn" onclick="modifyPosQty(${entry.item.id}, -1)">−</button>
          <span class="font-mono" style="min-width:18px; text-align:center;">${entry.qty}</span>
          <button class="pos-line-btn" onclick="modifyPosQty(${entry.item.id}, 1)">+</button>
        </div>
        <div class="font-mono" style="min-width:55px; text-align:right; font-weight:700; color:var(--gold-light);">
          ₹ ${lineTotal}
        </div>
      </div>
    `;
  }).join('');

  subtotalEl.textContent = `₹ ${subtotal}`;
  grandTotalEl.textContent = `₹ ${subtotal}`;
  checkoutBtn.disabled = false;
  checkoutBtn.textContent = `Complete Sale & Print Bill (₹${subtotal})`;
}

function recordPosSale() {
  const keys = Object.keys(posCart);
  if (keys.length === 0) return;

  const custName = document.getElementById('pos-cust-name').value.trim() || 'Walk-in Customer';
  const serviceMode = document.getElementById('pos-service-mode').value;

  let grandTotal = 0;
  const items = keys.map(k => {
    const e = posCart[k];
    const total = e.item.price * e.qty;
    grandTotal += total;
    return {
      id: e.item.id,
      name: e.item.name,
      price: e.item.price,
      qty: e.qty,
      total: total
    };
  });

  const now = new Date();
  const orderId = 'POS-' + Math.floor(1000 + Math.random() * 9000);
  const timeStr = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
  const dateStr = now.toISOString().slice(0, 10);

  const orderRecord = {
    orderId: orderId,
    timestamp: now.getTime(),
    date: dateStr,
    time: timeStr,
    customerName: custName,
    serviceMode: serviceMode,
    tableOrParcel: serviceMode,
    items: items,
    subtotal: grandTotal,
    discount: 0,
    grandTotal: grandTotal,
    paymentMethod: posSelectedPayment,
    notes: 'Walk-in POS Sale',
    status: 'completed'
  };

  // 1. Add to active orders
  let list = [];
  try {
    const raw = localStorage.getItem(ACTIVE_ORDERS_KEY);
    if (raw) list = JSON.parse(raw);
  } catch (e) {}
  list.unshift(orderRecord);
  localStorage.setItem(ACTIVE_ORDERS_KEY, JSON.stringify(list));

  // 2. Add to MGMT Store DB.salesLog
  try {
    const raw = localStorage.getItem(MGMT_STORE_KEY);
    if (raw) {
      const db = JSON.parse(raw);
      if (!Array.isArray(db.salesLog)) db.salesLog = [];

      items.forEach(it => {
        db.salesLog.push({
          billNo: db.nextBillNo || (1000 + db.salesLog.length + 1),
          date: dateStr,
          time: timeStr,
          itemId: 'ITM-' + String(it.id).padStart(3, '0'),
          itemName: it.name,
          qty: it.qty,
          price: it.price,
          discount: 0,
          status: 'Active',
          paymentMode: posSelectedPayment,
          enteredBy: 'Owner POS',
          reason: 'Counter Sale'
        });
      });
      if (db.nextBillNo) db.nextBillNo += 1;
      localStorage.setItem(MGMT_STORE_KEY, JSON.stringify(db));
    }
  } catch (e) {}

  playChime(880, 0.3);
  showToast(`Bill recorded! Order ${orderId} (₹${grandTotal})`);

  posCart = {};
  updatePosTicketUI();
  updateKpiHud();
  renderKdsOrders();
}

// ── §7 INVENTORY & STOCK ──────────────────────────────────────
function initStockMonitor() {
  const modal = document.getElementById('restock-modal');
  const openBtn = document.getElementById('btn-open-restock-modal');
  const closeBtn = document.getElementById('btn-close-restock');
  const form = document.getElementById('restock-form');
  const select = document.getElementById('restock-ing');

  if (openBtn) openBtn.onclick = () => {
    // Populate select
    const items = getStoredStock();
    select.innerHTML = items.map(it => `<option value="${it.id}">${it.name} (${it.unit}) - Currently: ${it.stock}</option>`).join('');
    modal.classList.add('open');
  };

  if (closeBtn) closeBtn.onclick = () => modal.classList.remove('open');

  if (form) form.onsubmit = (e) => {
    e.preventDefault();
    const ingId = select.value;
    const qtyAdded = parseFloat(document.getElementById('restock-qty').value);
    const cost = parseFloat(document.getElementById('restock-cost').value);
    const supplier = document.getElementById('restock-supplier').value.trim() || 'General Supplier';

    let items = getStoredStock();
    const item = items.find(i => i.id === ingId);
    if (item) {
      item.stock = parseFloat((item.stock + qtyAdded).toFixed(1));
      saveStoredStock(items);
      playChime(700, 0.2);
      showToast(`Restocked ${qtyAdded} ${item.unit} of ${item.name}`);
      modal.classList.remove('open');
      renderStock();
    }
  };
}

function getStoredStock() {
  try {
    const raw = localStorage.getItem('DAS_CAFE_STOCK_ITEMS');
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return DEFAULT_STOCK_ITEMS;
}

function saveStoredStock(items) {
  localStorage.setItem('DAS_CAFE_STOCK_ITEMS', JSON.stringify(items));
}

function renderStock() {
  const grid = document.getElementById('stock-overview-grid');
  const tbody = document.getElementById('stock-tbody');
  if (!grid || !tbody) return;

  const items = getStoredStock();

  // Overview Cards: Low stock items
  const lowItems = items.filter(i => i.stock <= i.min);

  grid.innerHTML = `
    <div class="stock-card">
      <div style="font-size:0.78rem; text-transform:uppercase; color:var(--text-muted)">Total Tracked Items</div>
      <div class="font-mono" style="font-size:1.8rem; font-weight:700; color:var(--gold-light); margin:4px 0;">${items.length}</div>
      <div style="font-size:0.75rem; color:var(--cream-dim)">Core recipes & packaging</div>
    </div>
    <div class="stock-card ${lowItems.length > 0 ? 'critical' : ''}">
      <div style="font-size:0.78rem; text-transform:uppercase; color:var(--text-muted)">Low / Reorder Alerts</div>
      <div class="font-mono" style="font-size:1.8rem; font-weight:700; color:${lowItems.length > 0 ? 'var(--red)' : 'var(--green)'}; margin:4px 0;">
        ${lowItems.length}
      </div>
      <div style="font-size:0.75rem; color:var(--cream-dim)">${lowItems.length > 0 ? 'Requires immediate restock' : 'All items at healthy levels'}</div>
    </div>
    <div class="stock-card">
      <div style="font-size:0.78rem; text-transform:uppercase; color:var(--text-muted)">Perpetual Inventory Formula</div>
      <div class="font-mono" style="font-size:1rem; font-weight:600; color:var(--cyan); margin:6px 0;">
        Opening + Purchases − Sold
      </div>
      <div style="font-size:0.75rem; color:var(--cream-dim)">Synced with DAS CAFE Recipes</div>
    </div>
  `;

  tbody.innerHTML = items.map(it => {
    let statusClass = 'normal';
    let statusText = 'Optimal';

    if (it.stock <= it.min * 0.5) {
      statusClass = 'critical';
      statusText = 'CRITICAL LOW';
    } else if (it.stock <= it.min) {
      statusClass = 'low';
      statusText = 'Reorder Soon';
    }

    return `
      <tr>
        <td><code style="color:var(--gold-light)">${it.id}</code></td>
        <td><strong>${it.name}</strong></td>
        <td><span class="stock-pill normal">${it.category}</span></td>
        <td class="font-mono"><strong>${it.stock}</strong> ${it.unit}</td>
        <td class="font-mono" style="color:var(--text-muted)">${it.min} ${it.unit}</td>
        <td class="font-mono">₹ ${it.unitPrice}</td>
        <td><span class="stock-pill ${statusClass}">${statusText}</span></td>
        <td>
          <button class="o-btn-outline-sm" onclick="quickAddStock('${it.id}')">+ Restock</button>
        </td>
      </tr>
    `;
  }).join('');
}

window.quickAddStock = function(ingId) {
  const items = getStoredStock();
  const item = items.find(i => i.id === ingId);
  if (!item) return;

  const added = prompt(`Add quantity for ${item.name} (${item.unit}):`, '10');
  if (added && !isNaN(added)) {
    item.stock = parseFloat((item.stock + parseFloat(added)).toFixed(1));
    saveStoredStock(items);
    playChime(700, 0.2);
    showToast(`Added +${added} ${item.unit} to ${item.name}`);
    renderStock();
  }
};

// ── §8 EXPENSES & CASH OUT ────────────────────────────────────
function initExpenses() {
  const form = document.getElementById('expense-form');
  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const desc = document.getElementById('exp-desc').value.trim();
      const cat = document.getElementById('exp-category').value;
      const amt = parseFloat(document.getElementById('exp-amount').value);
      const payMode = document.getElementById('exp-paymode').value;
      const by = document.getElementById('exp-by').value.trim() || 'Manager';

      const record = {
        id: 'EXP-' + Math.floor(100 + Math.random() * 900),
        desc,
        category: cat,
        amount: amt,
        payMode,
        enteredBy: by,
        time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }),
        date: new Date().toISOString().slice(0, 10)
      };

      let list = getStoredExpenses();
      list.unshift(record);
      localStorage.setItem(EXPENSES_KEY, JSON.stringify(list));

      // Also record in MGMT DB.cashOut
      try {
        const raw = localStorage.getItem(MGMT_STORE_KEY);
        if (raw) {
          const db = JSON.parse(raw);
          if (!Array.isArray(db.cashOut)) db.cashOut = [];
          db.cashOut.push({
            date: record.date,
            time: record.time,
            category: record.category,
            amount: record.amount,
            paidTo: record.desc,
            approvedBy: record.enteredBy,
            notes: record.payMode
          });
          localStorage.setItem(MGMT_STORE_KEY, JSON.stringify(db));
        }
      } catch (e) {}

      playChime(650, 0.2);
      showToast(`Recorded Cash Out: ₹${amt}`);
      form.reset();
      renderExpenses();
      calculateReconciliation();
    });
  }
}

function getStoredExpenses() {
  try {
    const raw = localStorage.getItem(EXPENSES_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return [
    { id: 'EXP-101', desc: 'Fresh Dairy Milk 15L Delivery', category: 'Dairy & Milk', amount: 840, payMode: 'Cash Register', time: '09:30 AM', date: new Date().toISOString().slice(0, 10) },
    { id: 'EXP-102', desc: 'Commercial Cooking Gas Cylinder', category: 'Utilities', amount: 1150, payMode: 'Cash Register', time: '11:15 AM', date: new Date().toISOString().slice(0, 10) }
  ];
}

function renderExpenses() {
  const stream = document.getElementById('expense-stream');
  const totalEl = document.getElementById('expense-today-total');
  if (!stream) return;

  const expenses = getStoredExpenses();
  const total = expenses.reduce((sum, e) => sum + e.amount, 0);

  if (totalEl) totalEl.textContent = `Total: ₹ ${total.toLocaleString('en-IN')}`;

  if (expenses.length === 0) {
    stream.innerHTML = '<div style="text-align:center; color:var(--text-muted); padding:32px 0;">No cash out entries recorded today.</div>';
    return;
  }

  stream.innerHTML = expenses.map(e => `
    <div class="exp-item-row">
      <div>
        <div class="exp-desc-title">${e.desc}</div>
        <div class="exp-cat-badge">📂 ${e.category} · <span>${e.payMode}</span> · <span>${e.time}</span></div>
      </div>
      <div class="exp-amt">− ₹ ${e.amount.toLocaleString('en-IN')}</div>
    </div>
  `).join('');
}

// ── §9 30/30/30/10 FINANCIAL RECONCILIATION ───────────────────
function initReconciliation() {
  const verifyBtn = document.getElementById('btn-verify-drawer');
  const calcBtn = document.getElementById('btn-calc-recon');

  if (verifyBtn) verifyBtn.addEventListener('click', verifyCashDrawer);
  if (calcBtn) calcBtn.addEventListener('click', () => {
    calculateReconciliation();
    showToast('Reconciliation calculated!');
  });
}

function calculateReconciliation() {
  const openCash = 2000;
  let cashSales = 0;
  let activeOrders = [];

  try {
    const raw = localStorage.getItem(ACTIVE_ORDERS_KEY);
    if (raw) activeOrders = JSON.parse(raw);
  } catch (e) {}

  activeOrders.forEach(o => {
    if (o.paymentMethod === 'Cash') cashSales += (o.grandTotal || 0);
  });

  const expenses = getStoredExpenses();
  const cashOut = expenses.filter(e => e.payMode === 'Cash Register').reduce((sum, e) => sum + e.amount, 0);

  const expectedCash = openCash + cashSales - cashOut;

  document.getElementById('recon-open-cash').textContent = `₹ ${openCash.toLocaleString('en-IN')}`;
  document.getElementById('recon-cash-sales').textContent = `+ ₹ ${cashSales.toLocaleString('en-IN')}`;
  document.getElementById('recon-cash-out').textContent = `− ₹ ${cashOut.toLocaleString('en-IN')}`;
  document.getElementById('recon-expected-cash').textContent = `₹ ${expectedCash.toLocaleString('en-IN')}`;

  // Default counted cash input to expected
  const countedInput = document.getElementById('recon-counted-cash');
  if (countedInput && !countedInput.value) {
    countedInput.value = expectedCash;
  }

  verifyCashDrawer();
}

function verifyCashDrawer() {
  const expectedText = document.getElementById('recon-expected-cash').textContent.replace(/[^\d]/g, '');
  const expected = parseInt(expectedText) || 2000;
  const counted = parseInt(document.getElementById('recon-counted-cash').value) || 0;

  const diff = counted - expected;
  const tolerance = 50; // ±₹50

  const verdictBox = document.getElementById('recon-verdict');
  const verdictText = document.getElementById('recon-verdict-text');
  const kpiStatus = document.getElementById('kpi-cash-status');
  const kpiDetail = document.getElementById('kpi-cash-detail');

  if (Math.abs(diff) <= tolerance) {
    verdictBox.style.color = 'var(--green)';
    verdictBox.querySelector('.verdict-icon').textContent = '✓';
    verdictText.textContent = `Cash drawer is BALANCED within tolerance limit (Variance: ${diff >= 0 ? '+' : ''}₹${diff}).`;
    kpiStatus.className = 'kpi-num status-balanced';
    kpiStatus.textContent = 'BALANCED';
    kpiDetail.textContent = `Variance: ₹${diff} (≤ ₹50 target)`;
  } else {
    verdictBox.style.color = 'var(--red)';
    verdictBox.querySelector('.verdict-icon').textContent = '⚠';
    verdictText.textContent = `VARIANCE DETECTED! Difference is ₹${diff} (Exceeds ₹50 tolerance). Immediate audit advised.`;
    kpiStatus.className = 'kpi-num status-unbalanced';
    kpiStatus.textContent = diff < 0 ? `SHORT ₹${Math.abs(diff)}` : `OVER ₹${diff}`;
    kpiDetail.textContent = 'Tolerance threshold exceeded!';
  }
}

// ── TOAST NOTIFICATION ────────────────────────────────────────
function showToast(msg, isError = false) {
  const toast = document.getElementById('o-toast');
  const msgEl = document.getElementById('o-toast-msg');
  if (!toast || !msgEl) return;

  msgEl.textContent = msg;
  toast.querySelector('.o-toast-icon').textContent = isError ? '✗' : '✓';
  toast.style.borderColor = isError ? 'var(--red)' : 'var(--gold)';
  toast.classList.add('show');

  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => {
    toast.classList.remove('show');
  }, 2800);
}

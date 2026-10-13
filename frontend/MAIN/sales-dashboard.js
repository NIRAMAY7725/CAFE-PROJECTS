/* ============================================================
   DAS CAFE — Sales Dashboard Logic
   Fetches data from the backend API and renders charts/tables
   ============================================================ */

const API = window.location.origin + '/api';

// ── State ────────────────────────────────────────────────────
let currentPage = 1;
let currentFilters = {};
let debounceTimer = null;

// ── DOM References ───────────────────────────────────────────
const statsEls = {
  totalOrders:  document.getElementById('stat-total-orders'),
  totalRevenue: document.getElementById('stat-total-revenue'),
  avgValue:     document.getElementById('stat-avg-value'),
  todayOrders:  document.getElementById('stat-today-orders'),
};

const tbody        = document.getElementById('sales-tbody');
const tableCount   = document.getElementById('table-count');
const pageInfo     = document.getElementById('page-info');
const prevBtn      = document.getElementById('page-prev');
const nextBtn      = document.getElementById('page-next');
const searchInput  = document.getElementById('search-input');
const filterCat    = document.getElementById('filter-category');
const filterPay    = document.getElementById('filter-payment');
const filterFrom   = document.getElementById('filter-date-from');
const filterTo     = document.getElementById('filter-date-to');
const refreshBtn   = document.getElementById('btn-refresh');
const exportBtn    = document.getElementById('btn-export');
const saleForm     = document.getElementById('sale-form');
const saleItem     = document.getElementById('sale-item');
const saleQty      = document.getElementById('sale-qty');
const saleCustomer = document.getElementById('sale-customer');
const salePayment  = document.getElementById('sale-payment');
const saleTotal    = document.getElementById('sale-total');

// ══════════════════════════════════════════════════════════════
//  UTILITY FUNCTIONS
// ══════════════════════════════════════════════════════════════

function formatCurrency(num) {
  if (num >= 10000000) return '₹' + (num / 10000000).toFixed(2) + ' Cr';
  if (num >= 100000)   return '₹' + (num / 100000).toFixed(2) + ' L';
  if (num >= 1000)     return '₹' + (num / 1000).toFixed(1) + 'K';
  return '₹' + num.toLocaleString('en-IN');
}

function formatNumber(num) {
  if (num >= 10000000) return (num / 10000000).toFixed(2) + ' Cr';
  if (num >= 100000)   return (num / 100000).toFixed(1) + ' L';
  if (num >= 1000)     return (num / 1000).toFixed(1) + 'K';
  return num.toLocaleString('en-IN');
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    + ' ' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

function showToast(message, isError = false) {
  // Remove existing toast
  const existing = document.querySelector('.dash-toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = 'dash-toast';
  if (isError) {
    toast.style.borderColor = 'var(--red)';
    toast.style.color = 'var(--red)';
  }
  toast.textContent = message;
  document.body.appendChild(toast);

  requestAnimationFrame(() => {
    toast.classList.add('show');
  });

  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 400);
  }, 3000);
}

// ══════════════════════════════════════════════════════════════
//  FETCH STATS
// ══════════════════════════════════════════════════════════════

async function loadStats() {
  try {
    const res = await fetch(`${API}/sales/stats`);
    const stats = await res.json();

    // Animate stat values
    animateValue(statsEls.totalOrders, stats.totalSales, formatNumber);
    animateValue(statsEls.totalRevenue, stats.totalRevenue, formatCurrency);
    animateValue(statsEls.avgValue, stats.avgOrderValue, formatCurrency);
    animateValue(statsEls.todayOrders, stats.todaySales, formatNumber);

    // Render charts
    renderBarChart('top-items-bars', stats.topItems, 'item_name', 'order_count', 'revenue', [
      'bar-fill--gold', 'bar-fill--green', 'bar-fill--blue', 'bar-fill--purple', 'bar-fill--orange'
    ]);

    renderBarChart('category-bars', stats.byCategory, 'category', 'count', 'revenue', [
      'bar-fill--orange', 'bar-fill--green', 'bar-fill--blue', 'bar-fill--purple'
    ]);

    renderBarChart('payment-bars', stats.byPayment, 'payment_method', 'count', 'revenue', [
      'bar-fill--green', 'bar-fill--gold', 'bar-fill--blue', 'bar-fill--purple', 'bar-fill--orange'
    ]);

    renderTrendChart(stats.dailyTrend);
  } catch (err) {
    console.error('Failed to load stats:', err);
    showToast('Failed to load dashboard stats', true);
  }
}

// ── Animate number change ────────────────────────────────────
function animateValue(el, target, formatter) {
  const duration = 800;
  const start = Date.now();
  const initial = 0;

  function update() {
    const elapsed = Date.now() - start;
    const progress = Math.min(elapsed / duration, 1);
    // Ease out cubic
    const eased = 1 - Math.pow(1 - progress, 3);
    const current = initial + (target - initial) * eased;
    el.textContent = formatter(Math.round(current));
    if (progress < 1) requestAnimationFrame(update);
    else el.textContent = formatter(target);
  }
  update();
}

// ══════════════════════════════════════════════════════════════
//  RENDER BAR CHARTS
// ══════════════════════════════════════════════════════════════

function renderBarChart(containerId, data, labelKey, countKey, revenueKey, colorClasses) {
  const container = document.getElementById(containerId);
  if (!container || !data || data.length === 0) {
    if (container) container.innerHTML = '<p style="color:var(--text-dim);font-size:0.8rem;text-align:center;">No data yet</p>';
    return;
  }

  const maxCount = Math.max(...data.map(d => d[countKey]));
  container.innerHTML = '';

  data.forEach((item, i) => {
    const pct = maxCount > 0 ? (item[countKey] / maxCount * 100) : 0;
    const colorClass = colorClasses[i % colorClasses.length];

    const barItem = document.createElement('div');
    barItem.className = 'bar-item';
    barItem.innerHTML = `
      <span class="bar-label" title="${item[labelKey]}">${item[labelKey]}</span>
      <div class="bar-track">
        <div class="bar-fill ${colorClass}" style="width: 0%"></div>
      </div>
      <span class="bar-value">${formatNumber(item[countKey])} · ${formatCurrency(item[revenueKey])}</span>
    `;
    container.appendChild(barItem);

    // Animate after paint
    requestAnimationFrame(() => {
      const fill = barItem.querySelector('.bar-fill');
      fill.style.width = pct + '%';
    });
  });
}

// ══════════════════════════════════════════════════════════════
//  RENDER TREND CHART
// ══════════════════════════════════════════════════════════════

function renderTrendChart(data) {
  const container = document.getElementById('trend-bars');
  if (!container) return;

  if (!data || data.length === 0) {
    container.innerHTML = '<p style="color:var(--text-dim);font-size:0.8rem;text-align:center;width:100%;">No trend data yet. Add some sales first!</p>';
    return;
  }

  const maxRev = Math.max(...data.map(d => d.revenue));
  container.innerHTML = '';

  data.forEach(item => {
    const pct = maxRev > 0 ? (item.revenue / maxRev * 100) : 0;
    const dayName = new Date(item.day + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric' });

    const wrap = document.createElement('div');
    wrap.className = 'trend-bar-wrap';
    wrap.innerHTML = `
      <span class="trend-bar-val">${formatCurrency(item.revenue)}</span>
      <div class="trend-bar">
        <div class="trend-bar-fill" style="height: 0%" title="${item.orders} orders · ${formatCurrency(item.revenue)}"></div>
      </div>
      <span class="trend-bar-day">${dayName}</span>
    `;
    container.appendChild(wrap);

    requestAnimationFrame(() => {
      wrap.querySelector('.trend-bar-fill').style.height = Math.max(pct, 4) + '%';
    });
  });
}

// ══════════════════════════════════════════════════════════════
//  FETCH & RENDER SALES TABLE
// ══════════════════════════════════════════════════════════════

async function loadSales() {
  try {
    const params = new URLSearchParams({ page: currentPage, limit: 50 });

    if (currentFilters.category && currentFilters.category !== 'all')
      params.set('category', currentFilters.category);
    if (currentFilters.payment_method && currentFilters.payment_method !== 'all')
      params.set('payment_method', currentFilters.payment_method);
    if (currentFilters.search)
      params.set('search', currentFilters.search);
    if (currentFilters.date_from)
      params.set('date_from', currentFilters.date_from);
    if (currentFilters.date_to)
      params.set('date_to', currentFilters.date_to);

    const res = await fetch(`${API}/sales?${params}`);
    const result = await res.json();

    renderSalesTable(result.data);
    updatePagination(result.pagination);
  } catch (err) {
    console.error('Failed to load sales:', err);
    tbody.innerHTML = '<tr><td colspan="9" class="table-loading">⚠️ Failed to load data. Is the backend running?</td></tr>';
  }
}

function renderSalesTable(sales) {
  if (!sales || sales.length === 0) {
    tbody.innerHTML = '<tr><td colspan="9" class="table-loading">No sale records found.</td></tr>';
    return;
  }

  tbody.innerHTML = sales.map(s => `
    <tr>
      <td><span class="order-id">${s.order_id}</span></td>
      <td style="color:var(--text-primary);font-weight:500;">${s.item_name}</td>
      <td><span class="cat-badge cat-badge--${s.category}">${s.category}</span></td>
      <td>₹${s.price}</td>
      <td>${s.quantity}</td>
      <td style="color:var(--gold);font-weight:600;">₹${s.total}</td>
      <td>${s.customer_name}</td>
      <td><span class="pay-badge">${s.payment_method}</span></td>
      <td style="font-size:0.75rem;">${formatDate(s.created_at)}</td>
    </tr>
  `).join('');
}

function updatePagination(pagination) {
  if (!pagination) return;
  const { page, total, totalPages } = pagination;

  tableCount.textContent = `${total.toLocaleString()} records`;
  pageInfo.textContent = `Page ${page} of ${totalPages.toLocaleString()}`;
  prevBtn.disabled = page <= 1;
  nextBtn.disabled = page >= totalPages;
}

// ══════════════════════════════════════════════════════════════
//  EVENT LISTENERS
// ══════════════════════════════════════════════════════════════

// Pagination
prevBtn.addEventListener('click', () => { currentPage--; loadSales(); });
nextBtn.addEventListener('click', () => { currentPage++; loadSales(); });

// Filters
filterCat.addEventListener('change', () => {
  currentFilters.category = filterCat.value;
  currentPage = 1;
  loadSales();
});

filterPay.addEventListener('change', () => {
  currentFilters.payment_method = filterPay.value;
  currentPage = 1;
  loadSales();
});

filterFrom.addEventListener('change', () => {
  currentFilters.date_from = filterFrom.value;
  currentPage = 1;
  loadSales();
});

filterTo.addEventListener('change', () => {
  currentFilters.date_to = filterTo.value;
  currentPage = 1;
  loadSales();
});

// Search with debounce
searchInput.addEventListener('input', () => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    currentFilters.search = searchInput.value.trim();
    currentPage = 1;
    loadSales();
  }, 400);
});

// Refresh
refreshBtn.addEventListener('click', () => {
  loadStats();
  loadSales();
  showToast('✅ Dashboard refreshed!');
});

// Export CSV
exportBtn.addEventListener('click', () => {
  const params = new URLSearchParams();
  if (currentFilters.category && currentFilters.category !== 'all')
    params.set('category', currentFilters.category);
  if (currentFilters.date_from) params.set('date_from', currentFilters.date_from);
  if (currentFilters.date_to)   params.set('date_to', currentFilters.date_to);

  window.open(`${API}/sales/export?${params}`, '_blank');
  showToast('📥 CSV export started!');
});

// ── Sale Form: Update total on item/qty change ───────────────
function updateSaleTotal() {
  const selected = saleItem.options[saleItem.selectedIndex];
  const price = selected ? parseFloat(selected.dataset.price) || 0 : 0;
  const qty = parseInt(saleQty.value) || 1;
  saleTotal.textContent = `Total: ₹${(price * qty).toLocaleString('en-IN')}`;
}

saleItem.addEventListener('change', updateSaleTotal);
saleQty.addEventListener('input', updateSaleTotal);

// ── Sale Form: Submit ────────────────────────────────────────
saleForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const selected = saleItem.options[saleItem.selectedIndex];
  if (!selected || !selected.value) {
    showToast('Please select an item', true);
    return;
  }

  const data = {
    item_name: selected.value,
    category: selected.dataset.cat || 'other',
    price: parseFloat(selected.dataset.price),
    quantity: parseInt(saleQty.value) || 1,
    customer_name: saleCustomer.value.trim() || 'Walk-in',
    payment_method: salePayment.value,
  };

  try {
    const res = await fetch(`${API}/sales`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    const result = await res.json();

    if (result.success) {
      showToast(`✅ Sale recorded! Order ${result.order_id} — ₹${result.total}`);
      saleForm.reset();
      saleTotal.textContent = 'Total: ₹0';
      // Refresh data
      loadStats();
      loadSales();
    } else {
      showToast('❌ Failed to save sale: ' + (result.error || 'Unknown error'), true);
    }
  } catch (err) {
    console.error('Sale submit error:', err);
    showToast('❌ Network error — is the backend running?', true);
  }
});

// ══════════════════════════════════════════════════════════════
//  INITIAL LOAD
// ══════════════════════════════════════════════════════════════

(async function init() {
  await Promise.all([loadStats(), loadSales()]);
})();

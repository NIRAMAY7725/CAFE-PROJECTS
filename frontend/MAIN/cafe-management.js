/* ============================================================
   DAS CAFE — Cafe Management System · Core Engine
   ============================================================
   Architecture:
     Customer Order → POS/Billing → Sales Record → Recipe Consumption
     → Inventory Update → Expense Records → Daily Reconciliation
     → Profit-and-Loss Dashboard
   ============================================================ */

'use strict';

/* ══════════════════════════════════════════════════════════════
   §1  DATA STORE  (localStorage persistence)
   ══════════════════════════════════════════════════════════════ */
const STORE_KEY = 'DAS_CAFE_MGMT';

const DEFAULT_SETTINGS = {
  monthStart: '',
  monthEnd: '',
  foodCostTarget: 30,
  labourCostTarget: 30,
  operatingCostTarget: 30,
  profitTarget: 10,
  openingCash: 2000,
  cashTolerance: 50,
  taxMode: 'inclusive',
  gstRate: 5,
  wastageAllowance: 3
};

function loadStore() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) { console.warn('Store load error', e); }
  return null;
}

function saveStore() {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(DB));
  } catch (e) { console.warn('Store save error', e); }
}

let DB = loadStore() || {
  settings: { ...DEFAULT_SETTINGS },
  ingredients: [],
  menu: [],
  recipes: [],
  salesLog: [],
  purchases: [],
  cashOut: [],
  wastage: [],
  stock: [],
  nextBillNo: 1001,
  nextIngId: 'ING-001',
  nextItmId: 'ITM-001'
};

// Seed default menu from DAS_CAFE_MENU if menu is empty
if (DB.menu.length === 0 && typeof DAS_CAFE_MENU !== 'undefined') {
  DAS_CAFE_MENU.forEach(item => {
    DB.menu.push({
      itmId: 'ITM-' + String(item.id).padStart(3, '0'),
      name: item.name,
      category: item.category,
      sellingPrice: item.price,
      directCost: 0,
      priceFloor: 0,
      contribution: item.price,
      prepMinutes: 5,
      unitsSold: 0
    });
  });
  DB.nextItmId = 'ITM-' + String(DAS_CAFE_MENU.length + 1).padStart(3, '0');
  saveStore();
}

/* ══════════════════════════════════════════════════════════════
   §2  UTILITY HELPERS
   ══════════════════════════════════════════════════════════════ */
const $ = id => document.getElementById(id);
const $$ = sel => document.querySelectorAll(sel);
const fmt = n => '₹ ' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
const fmtN = n => Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
const today = () => new Date().toISOString().slice(0, 10);
const now = () => new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
const genId = prefix => {
  const key = prefix === 'ING' ? 'nextIngId' : 'nextItmId';
  const current = DB[key];
  const num = parseInt(current.split('-')[1]) + 1;
  DB[key] = prefix + '-' + String(num).padStart(3, '0');
  return current;
};

function showToast(msg, isError = false) {
  const toast = $('cms-toast');
  const tmsg = $('cms-toast-msg');
  tmsg.textContent = msg;
  toast.className = 'cms-toast show' + (isError ? ' error' : '');
  $('cms-toast').querySelector('.toast-icon').textContent = isError ? '✗' : '✓';
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => toast.classList.remove('show'), 3000);
}

/* ══════════════════════════════════════════════════════════════
   §3  FORMULA ENGINE
   ══════════════════════════════════════════════════════════════ */
const Formulas = {
  // Cost per unit = Pack price / Pack size
  costPerUnit(packPrice, packSize) {
    return packSize > 0 ? packPrice / packSize : 0;
  },

  // Recipe line cost = Quantity per serving × Cost per unit
  recipeLineCost(qtyPerServing, costPerUnit) {
    return qtyPerServing * costPerUnit;
  },

  // Direct cost per serving = Ingredients + Packaging + Wastage allowance + Other direct
  directCostPerServing(ingredientsCost, packagingCost = 0, wastageAllowancePct = 3, otherDirect = 0) {
    const wastageAddon = ingredientsCost * (wastageAllowancePct / 100);
    return ingredientsCost + packagingCost + wastageAddon + otherDirect;
  },

  // Price floor = (Ingredients + Packaging) / Food cost target
  priceFloor(ingredientsCost, packagingCost = 0, foodCostTarget = 30) {
    return foodCostTarget > 0 ? (ingredientsCost + packagingCost) / (foodCostTarget / 100) : 0;
  },

  // Contribution per item = Net selling revenue - Variable cost per item
  contribution(sellingPrice, directCost) {
    return sellingPrice - directCost;
  },

  // Expected closing stock = Opening + Purchases - Recipe usage - Logged wastage
  // Recipe usage = Qty per serving × (Units Sold + Units Wasted)
  expectedClosing(opening, purchases, recipeUsage, loggedWastage) {
    return opening + purchases - recipeUsage - loggedWastage;
  },

  // Variance = Physical count - Expected closing
  variance(physicalCount, expectedClosing) {
    return physicalCount - expectedClosing;
  },

  // Actual consumption (Rs) = Opening stock value + Purchases - Closing stock value
  actualConsumption(openingValue, purchasesValue, closingValue) {
    return openingValue + purchasesValue - closingValue;
  },

  // Expected closing cash = Opening cash + Cash sales - Cash paid out
  expectedClosingCash(openingCash, cashSales, cashPaidOut) {
    return openingCash + cashSales - cashPaidOut;
  },

  // Break-even sales (month) = Fixed operating costs / Contribution margin ratio
  breakEvenSales(fixedCosts, contributionMarginRatio) {
    return contributionMarginRatio > 0 ? fixedCosts / contributionMarginRatio : 0;
  },

  // Net amount = (Price × Qty) - Discount
  netAmount(price, qty, discount) {
    return (price * qty) - discount;
  }
};

/* ══════════════════════════════════════════════════════════════
   §4  RECALCULATION ENGINE
   ══════════════════════════════════════════════════════════════ */
function recalcMenuCosts() {
  const s = DB.settings;
  DB.menu.forEach(item => {
    // Sum ingredient costs from recipes
    const recipeLines = DB.recipes.filter(r => r.itemId === item.itmId);
    let ingredientsCost = 0;
    recipeLines.forEach(r => {
      const ing = DB.ingredients.find(i => i.ingId === r.ingredientId);
      if (ing) {
        ingredientsCost += Formulas.recipeLineCost(r.qtyPerServing, ing.costPerUnit);
      }
    });

    item.directCost = Formulas.directCostPerServing(ingredientsCost, 0, s.wastageAllowance, 0);
    item.priceFloor = Formulas.priceFloor(ingredientsCost, 0, s.foodCostTarget);
    item.contribution = Formulas.contribution(item.sellingPrice, item.directCost);

    // Count units sold (only status=Sold)
    item.unitsSold = DB.salesLog
      .filter(sl => sl.itemId === item.itmId && sl.status === 'Sold')
      .reduce((sum, sl) => sum + sl.qty, 0);
  });
  saveStore();
}

function recalcIngredientCosts() {
  DB.ingredients.forEach(ing => {
    ing.costPerUnit = Formulas.costPerUnit(ing.packPrice, ing.packSize);
  });
  saveStore();
}

function recalcStock() {
  DB.stock = DB.ingredients.map(ing => {
    const existing = DB.stock.find(s => s.ingId === ing.ingId) || {};

    // Opening stock: use previous physical count or existing opening
    const opening = existing.physicalCount != null && existing.physicalCount >= 0
      ? existing.physicalCount
      : (existing.opening || 0);

    // Total purchased quantity
    const purchased = DB.purchases
      .filter(p => p.ingredientId === ing.ingId)
      .reduce((sum, p) => sum + (p.packs * ing.packSize), 0);

    // Recipe usage = sum of (qty_per_serving × (units_sold + units_wasted)) for each recipe line
    let recipeUsage = 0;
    const recipeLines = DB.recipes.filter(r => r.ingredientId === ing.ingId);
    recipeLines.forEach(rl => {
      const menuItem = DB.menu.find(m => m.itmId === rl.itemId);
      if (menuItem) {
        const unitsSold = DB.salesLog
          .filter(sl => sl.itemId === rl.itemId && sl.status === 'Sold')
          .reduce((s, sl) => s + sl.qty, 0);
        const unitsWasted = DB.salesLog
          .filter(sl => sl.itemId === rl.itemId && sl.status === 'Wasted')
          .reduce((s, sl) => s + sl.qty, 0);
        recipeUsage += rl.qtyPerServing * (unitsSold + unitsWasted);
      }
    });

    // Logged wastage (raw ingredient waste)
    const loggedWastage = DB.wastage
      .filter(w => w.ingredientId === ing.ingId)
      .reduce((sum, w) => sum + w.qty, 0);

    const expectedClosing = Formulas.expectedClosing(opening, purchased, recipeUsage, loggedWastage);
    const physicalCount = existing.physicalCount != null ? existing.physicalCount : null;
    const variance = physicalCount != null ? Formulas.variance(physicalCount, expectedClosing) : null;
    const reorder = expectedClosing <= ing.minStock;

    return {
      ingId: ing.ingId,
      name: ing.name,
      unit: ing.unit,
      opening,
      purchases: purchased,
      recipeUsage: Math.round(recipeUsage * 100) / 100,
      wastage: loggedWastage,
      expectedClosing: Math.round(expectedClosing * 100) / 100,
      physicalCount,
      variance: variance != null ? Math.round(variance * 100) / 100 : null,
      reorder
    };
  });
  saveStore();
}

/* ══════════════════════════════════════════════════════════════
   §5  MODAL SYSTEM
   ══════════════════════════════════════════════════════════════ */
let modalCallback = null;

function openModal(title, fields, callback) {
  $('modal-title').textContent = title;
  modalCallback = callback;

  const body = $('modal-body');
  body.innerHTML = '';

  let row = null;
  fields.forEach((f, i) => {
    // Create 2-column rows
    if (i % 2 === 0) {
      row = document.createElement('div');
      row.className = 'form-row';
      body.appendChild(row);
    }

    const group = document.createElement('div');
    group.className = 'form-group';

    const label = document.createElement('label');
    label.className = 'form-label';
    label.textContent = f.label;
    group.appendChild(label);

    let input;
    if (f.type === 'select') {
      input = document.createElement('select');
      input.className = 'form-input';
      f.options.forEach(opt => {
        const o = document.createElement('option');
        o.value = opt.value != null ? opt.value : opt;
        o.textContent = opt.label || opt;
        input.appendChild(o);
      });
    } else if (f.type === 'textarea') {
      input = document.createElement('textarea');
      input.className = 'form-input';
      input.rows = 3;
    } else {
      input = document.createElement('input');
      input.className = 'form-input';
      input.type = f.type || 'text';
      if (f.step) input.step = f.step;
      if (f.min != null) input.min = f.min;
      if (f.max != null) input.max = f.max;
      if (f.placeholder) input.placeholder = f.placeholder;
    }

    input.id = 'modal-' + f.key;
    if (f.value != null) input.value = f.value;
    if (f.required) input.required = true;
    if (f.readonly) { input.readOnly = true; input.style.opacity = '0.6'; }
    group.appendChild(input);
    row.appendChild(group);
  });

  // If odd number of fields, fill the last row
  if (fields.length % 2 === 1) {
    const spacer = document.createElement('div');
    spacer.className = 'form-group';
    row.appendChild(spacer);
  }

  $('modal-overlay').classList.add('open');
}

function closeModal() {
  $('modal-overlay').classList.remove('open');
  modalCallback = null;
}

function getModalValues(fields) {
  const data = {};
  fields.forEach(f => {
    const el = $('modal-' + f.key);
    if (!el) return;
    if (f.type === 'number') data[f.key] = parseFloat(el.value) || 0;
    else data[f.key] = el.value.trim();
  });
  return data;
}

/* ══════════════════════════════════════════════════════════════
   §6  SHEET RENDERERS
   ══════════════════════════════════════════════════════════════ */

/* ── 6a. INGREDIENTS ─────────────────────────────────────────── */
function renderIngredients(filter = '') {
  recalcIngredientCosts();
  const tbody = $('tbody-ingredients');
  const data = filter
    ? DB.ingredients.filter(i => i.name.toLowerCase().includes(filter.toLowerCase()) || i.ingId.toLowerCase().includes(filter.toLowerCase()))
    : DB.ingredients;

  if (data.length === 0) {
    tbody.innerHTML = `<tr><td colspan="11"><div class="empty-state">
      <div class="empty-state-icon">🧂</div>
      <div class="empty-state-text">No ingredients yet</div>
      <div class="empty-state-sub">Click "+ Add Ingredient" to get started</div>
    </div></td></tr>`;
    return;
  }

  tbody.innerHTML = data.map(i => `
    <tr>
      <td><code style="color:var(--gold)">${i.ingId}</code></td>
      <td>${i.name}</td>
      <td><span class="badge" style="background:var(--gold-dim);color:var(--gold)">${i.type}</span></td>
      <td>${i.unit}</td>
      <td class="formula-cell">${fmtN(i.packSize)}</td>
      <td class="formula-cell">${fmt(i.packPrice)}</td>
      <td class="formula-cell protected-cell">${fmt(i.costPerUnit)}</td>
      <td>${i.minStock}</td>
      <td>${i.reorderQty}</td>
      <td>${i.shelfLife}</td>
      <td>
        <div class="row-actions">
          <button class="row-action-btn edit" onclick="editIngredient('${i.ingId}')">Edit</button>
        </div>
      </td>
    </tr>
  `).join('');
}

function addIngredientModal() {
  const fields = [
    { key: 'name', label: 'Name', required: true },
    { key: 'type', label: 'Type', type: 'select', options: ['Dairy', 'Grain', 'Vegetable', 'Spice', 'Oil', 'Beverage', 'Packaging', 'Other'] },
    { key: 'unit', label: 'Unit', type: 'select', options: ['kg', 'g', 'L', 'ml', 'pcs', 'pack'] },
    { key: 'packSize', label: 'Pack Size', type: 'number', min: 0.01, step: 0.01, value: 1 },
    { key: 'packPrice', label: 'Pack Price (₹)', type: 'number', min: 0, step: 0.5, value: 0 },
    { key: 'minStock', label: 'Min Stock', type: 'number', min: 0, value: 5 },
    { key: 'reorderQty', label: 'Reorder Qty', type: 'number', min: 0, value: 10 },
    { key: 'shelfLife', label: 'Shelf Life (days)', type: 'number', min: 1, value: 30 }
  ];

  openModal('Add Ingredient', fields, () => {
    const v = getModalValues(fields);
    if (!v.name) return showToast('Name is required', true);

    const ing = {
      ingId: genId('ING'),
      name: v.name.toUpperCase(),
      type: v.type,
      unit: v.unit,
      packSize: v.packSize,
      packPrice: v.packPrice,
      costPerUnit: Formulas.costPerUnit(v.packPrice, v.packSize),
      minStock: v.minStock,
      reorderQty: v.reorderQty,
      shelfLife: v.shelfLife
    };
    DB.ingredients.push(ing);
    saveStore();
    closeModal();
    renderIngredients();
    showToast(`Ingredient "${ing.name}" added (${ing.ingId})`);
  });
}

function editIngredient(ingId) {
  const ing = DB.ingredients.find(i => i.ingId === ingId);
  if (!ing) return;

  const fields = [
    { key: 'ingId', label: 'ING ID', value: ing.ingId, readonly: true },
    { key: 'name', label: 'Name', value: ing.name, required: true },
    { key: 'type', label: 'Type', type: 'select', options: ['Dairy', 'Grain', 'Vegetable', 'Spice', 'Oil', 'Beverage', 'Packaging', 'Other'], value: ing.type },
    { key: 'unit', label: 'Unit', type: 'select', options: ['kg', 'g', 'L', 'ml', 'pcs', 'pack'], value: ing.unit },
    { key: 'packSize', label: 'Pack Size', type: 'number', min: 0.01, step: 0.01, value: ing.packSize },
    { key: 'packPrice', label: 'Pack Price (₹)', type: 'number', min: 0, step: 0.5, value: ing.packPrice },
    { key: 'minStock', label: 'Min Stock', type: 'number', min: 0, value: ing.minStock },
    { key: 'reorderQty', label: 'Reorder Qty', type: 'number', min: 0, value: ing.reorderQty },
    { key: 'shelfLife', label: 'Shelf Life (days)', type: 'number', min: 1, value: ing.shelfLife }
  ];

  openModal('Edit Ingredient', fields, () => {
    const v = getModalValues(fields);
    if (!v.name) return showToast('Name is required', true);
    Object.assign(ing, {
      name: v.name.toUpperCase(),
      type: v.type,
      unit: v.unit,
      packSize: v.packSize,
      packPrice: v.packPrice,
      costPerUnit: Formulas.costPerUnit(v.packPrice, v.packSize),
      minStock: v.minStock,
      reorderQty: v.reorderQty,
      shelfLife: v.shelfLife
    });
    saveStore();
    closeModal();
    recalcMenuCosts();
    renderIngredients();
    showToast(`Ingredient "${ing.name}" updated`);
  });
}

/* ── 6b. MENU ────────────────────────────────────────────────── */
function renderMenu() {
  recalcMenuCosts();
  const tbody = $('tbody-menu');
  if (DB.menu.length === 0) {
    tbody.innerHTML = `<tr><td colspan="10"><div class="empty-state">
      <div class="empty-state-icon">🍽️</div>
      <div class="empty-state-text">No menu items</div>
    </div></td></tr>`;
    return;
  }

  tbody.innerHTML = DB.menu.map(m => `
    <tr>
      <td><code style="color:var(--gold)">${m.itmId}</code></td>
      <td>${m.name}</td>
      <td><span class="badge" style="background:var(--blue-dim);color:var(--blue)">${m.category}</span></td>
      <td class="formula-cell">${fmt(m.sellingPrice)}</td>
      <td class="formula-cell protected-cell">${fmt(m.directCost)}</td>
      <td class="formula-cell protected-cell">${fmt(m.priceFloor)}</td>
      <td class="formula-cell protected-cell" style="color:${m.contribution >= 0 ? 'var(--green)' : 'var(--red)'}">${fmt(m.contribution)}</td>
      <td>${m.prepMinutes}</td>
      <td class="formula-cell protected-cell">${m.unitsSold}</td>
      <td>
        <div class="row-actions">
          <button class="row-action-btn edit" onclick="editMenuItem('${m.itmId}')">Edit</button>
        </div>
      </td>
    </tr>
  `).join('');
}

function addMenuItemModal() {
  const fields = [
    { key: 'name', label: 'Item Name', required: true },
    { key: 'category', label: 'Category', type: 'select', options: ['tea', 'coffee', 'sandwich', 'south', 'cold', 'water', 'snack', 'dessert', 'other'] },
    { key: 'sellingPrice', label: 'Selling Price (₹)', type: 'number', min: 0, value: 0 },
    { key: 'prepMinutes', label: 'Prep Minutes', type: 'number', min: 0, value: 5 }
  ];

  openModal('Add Menu Item', fields, () => {
    const v = getModalValues(fields);
    if (!v.name) return showToast('Name is required', true);

    const item = {
      itmId: genId('ITM'),
      name: v.name.toUpperCase(),
      category: v.category,
      sellingPrice: v.sellingPrice,
      directCost: 0,
      priceFloor: 0,
      contribution: v.sellingPrice,
      prepMinutes: v.prepMinutes,
      unitsSold: 0
    };
    DB.menu.push(item);
    saveStore();
    closeModal();
    renderMenu();
    showToast(`Menu item "${item.name}" added`);
  });
}

function editMenuItem(itmId) {
  const item = DB.menu.find(m => m.itmId === itmId);
  if (!item) return;

  const fields = [
    { key: 'itmId', label: 'ITM ID', value: item.itmId, readonly: true },
    { key: 'name', label: 'Name', value: item.name, required: true },
    { key: 'category', label: 'Category', type: 'select', options: ['tea', 'coffee', 'sandwich', 'south', 'cold', 'water', 'snack', 'dessert', 'other'], value: item.category },
    { key: 'sellingPrice', label: 'Selling Price (₹)', type: 'number', min: 0, value: item.sellingPrice },
    { key: 'prepMinutes', label: 'Prep Minutes', type: 'number', min: 0, value: item.prepMinutes }
  ];

  openModal('Edit Menu Item', fields, () => {
    const v = getModalValues(fields);
    if (!v.name) return showToast('Name is required', true);
    Object.assign(item, {
      name: v.name.toUpperCase(),
      category: v.category,
      sellingPrice: v.sellingPrice,
      prepMinutes: v.prepMinutes
    });
    saveStore();
    closeModal();
    recalcMenuCosts();
    renderMenu();
    showToast(`"${item.name}" updated`);
  });
}

/* ── 6c. RECIPES ─────────────────────────────────────────────── */
function renderRecipes() {
  const tbody = $('tbody-recipes');
  if (DB.recipes.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8"><div class="empty-state">
      <div class="empty-state-icon">📋</div>
      <div class="empty-state-text">No recipes mapped</div>
      <div class="empty-state-sub">Map ingredients to menu items with "+ Add Recipe Line"</div>
    </div></td></tr>`;
    return;
  }

  tbody.innerHTML = DB.recipes.map((r, idx) => {
    const menuItem = DB.menu.find(m => m.itmId === r.itemId);
    const ing = DB.ingredients.find(i => i.ingId === r.ingredientId);
    const lineCost = ing ? Formulas.recipeLineCost(r.qtyPerServing, ing.costPerUnit) : 0;

    return `<tr>
      <td><code style="color:var(--gold)">${r.itemId}</code></td>
      <td>${menuItem ? menuItem.name : '—'}</td>
      <td><code style="color:var(--cyan)">${r.ingredientId}</code></td>
      <td>${ing ? ing.name : '—'}</td>
      <td>${r.qtyPerServing}</td>
      <td>${ing ? ing.unit : '—'}</td>
      <td class="formula-cell protected-cell">${fmt(lineCost)}</td>
      <td>
        <div class="row-actions">
          <button class="row-action-btn edit" onclick="editRecipeLine(${idx})">Edit</button>
          <button class="row-action-btn cancel" onclick="deleteRecipeLine(${idx})">Remove</button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

function addRecipeLineModal() {
  const menuOptions = DB.menu.map(m => ({ value: m.itmId, label: `${m.itmId} — ${m.name}` }));
  const ingOptions = DB.ingredients.map(i => ({ value: i.ingId, label: `${i.ingId} — ${i.name} (${i.unit})` }));

  if (menuOptions.length === 0) return showToast('Add menu items first', true);
  if (ingOptions.length === 0) return showToast('Add ingredients first', true);

  const fields = [
    { key: 'itemId', label: 'Item ID', type: 'select', options: menuOptions, required: true },
    { key: 'ingredientId', label: 'Ingredient ID', type: 'select', options: ingOptions, required: true },
    { key: 'qtyPerServing', label: 'Qty per Serving', type: 'number', min: 0.001, step: 0.001, value: 1 },
    { key: '_spacer', label: '', type: 'hidden' }
  ];

  openModal('Add Recipe Line', fields, () => {
    const v = getModalValues(fields);
    if (!v.itemId || !v.ingredientId) return showToast('Select item and ingredient', true);

    DB.recipes.push({
      itemId: v.itemId,
      ingredientId: v.ingredientId,
      qtyPerServing: v.qtyPerServing
    });
    saveStore();
    closeModal();
    recalcMenuCosts();
    renderRecipes();
    showToast('Recipe line added');
  });
}

function editRecipeLine(idx) {
  const r = DB.recipes[idx];
  if (!r) return;

  const menuOptions = DB.menu.map(m => ({ value: m.itmId, label: `${m.itmId} — ${m.name}` }));
  const ingOptions = DB.ingredients.map(i => ({ value: i.ingId, label: `${i.ingId} — ${i.name} (${i.unit})` }));

  const fields = [
    { key: 'itemId', label: 'Item ID', type: 'select', options: menuOptions, value: r.itemId },
    { key: 'ingredientId', label: 'Ingredient ID', type: 'select', options: ingOptions, value: r.ingredientId },
    { key: 'qtyPerServing', label: 'Qty per Serving', type: 'number', min: 0.001, step: 0.001, value: r.qtyPerServing }
  ];

  openModal('Edit Recipe Line', fields, () => {
    const v = getModalValues(fields);
    Object.assign(r, { itemId: v.itemId, ingredientId: v.ingredientId, qtyPerServing: v.qtyPerServing });
    saveStore();
    closeModal();
    recalcMenuCosts();
    renderRecipes();
    showToast('Recipe line updated');
  });
}

function deleteRecipeLine(idx) {
  if (!confirm('Remove this recipe line?')) return;
  DB.recipes.splice(idx, 1);
  saveStore();
  recalcMenuCosts();
  renderRecipes();
  showToast('Recipe line removed');
}

/* ── 6d. SALES LOG ────────────────────────────────────────────── */
function renderSalesLog(filter = '', statusFilter = 'all') {
  const tbody = $('tbody-sales_log');
  let data = DB.salesLog;

  if (filter) {
    const lf = filter.toLowerCase();
    data = data.filter(s =>
      s.billNo.toString().includes(lf) ||
      (s.itemName || '').toLowerCase().includes(lf) ||
      s.enteredBy.toLowerCase().includes(lf)
    );
  }
  if (statusFilter !== 'all') {
    data = data.filter(s => s.status === statusFilter);
  }

  if (data.length === 0) {
    tbody.innerHTML = `<tr><td colspan="14"><div class="empty-state">
      <div class="empty-state-icon">🧾</div>
      <div class="empty-state-text">No sales records</div>
      <div class="empty-state-sub">Click "+ New Sale" to record a bill line</div>
    </div></td></tr>`;
    $('sales-summary').textContent = '';
    return;
  }

  tbody.innerHTML = data.map(s => {
    const net = Formulas.netAmount(s.price, s.qty, s.discount);
    const statusClass = s.status.toLowerCase();
    const payClass = s.paymentMode.toLowerCase();

    return `<tr>
      <td><code style="color:var(--gold)">${s.billNo}</code></td>
      <td>${s.date}</td>
      <td style="font-family:var(--font-mono);font-size:0.75rem">${s.time}</td>
      <td><code style="color:var(--cyan)">${s.itemId}</code></td>
      <td>${s.itemName || '—'}</td>
      <td>${s.qty}</td>
      <td class="formula-cell">${fmt(s.price)}</td>
      <td class="formula-cell">${fmt(s.discount)}</td>
      <td class="formula-cell protected-cell">${fmt(net)}</td>
      <td><span class="badge badge-${statusClass}">${s.status}</span></td>
      <td><span class="badge badge-${payClass}">${s.paymentMode}</span></td>
      <td>${s.enteredBy}</td>
      <td style="max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${s.reason || ''}">${s.reason || '—'}</td>
      <td>
        <div class="row-actions">
          ${s.status === 'Sold' ? `<button class="row-action-btn cancel" onclick="cancelSale(${s.billNo})">Cancel</button>` : ''}
        </div>
      </td>
    </tr>`;
  }).join('');

  // Summary
  const soldRows = data.filter(s => s.status === 'Sold');
  const totalNet = soldRows.reduce((sum, s) => sum + Formulas.netAmount(s.price, s.qty, s.discount), 0);
  $('sales-summary').textContent = `${data.length} records | ${soldRows.length} sold | Total Net: ${fmt(totalNet)}`;
}

function addSaleModal() {
  const menuOptions = DB.menu.map(m => ({ value: m.itmId, label: `${m.itmId} — ${m.name} (${fmt(m.sellingPrice)})` }));
  if (menuOptions.length === 0) return showToast('Add menu items first', true);

  const fields = [
    { key: 'itemId', label: 'Item', type: 'select', options: menuOptions, required: true },
    { key: 'qty', label: 'Quantity', type: 'number', min: 1, value: 1 },
    { key: 'discount', label: 'Discount (₹)', type: 'number', min: 0, value: 0 },
    { key: 'paymentMode', label: 'Payment Mode', type: 'select', options: ['Cash', 'UPI', 'Card', 'Credit'] },
    { key: 'status', label: 'Status', type: 'select', options: ['Sold', 'Wasted', 'Cancelled', 'Refund'] },
    { key: 'enteredBy', label: 'Entered By', value: 'Staff', required: true },
    { key: 'reason', label: 'Reason (if not Sold)', placeholder: 'Required for Cancel/Refund/Wasted' }
  ];

  openModal('New Sale Entry', fields, () => {
    const v = getModalValues(fields);
    if (!v.itemId) return showToast('Select an item', true);
    if (v.status !== 'Sold' && !v.reason) return showToast('Reason is mandatory for non-Sold status', true);

    const menuItem = DB.menu.find(m => m.itmId === v.itemId);

    const sale = {
      billNo: DB.nextBillNo++,
      date: today(),
      time: now(),
      itemId: v.itemId,
      itemName: menuItem ? menuItem.name : '—',
      qty: v.qty,
      price: menuItem ? menuItem.sellingPrice : 0,
      discount: v.discount,
      status: v.status,
      paymentMode: v.paymentMode,
      enteredBy: v.enteredBy,
      reason: v.reason
    };
    DB.salesLog.push(sale);
    saveStore();
    closeModal();
    recalcMenuCosts();
    renderSalesLog();
    showToast(`Bill #${sale.billNo} recorded — ${sale.itemName}`);
  });
}

// Never delete rows — cancel via status update with mandatory reason
function cancelSale(billNo) {
  const sale = DB.salesLog.find(s => s.billNo === billNo);
  if (!sale) return;

  const fields = [
    { key: 'billNo', label: 'Bill No.', value: billNo, readonly: true },
    { key: 'reason', label: 'Cancellation Reason', required: true, placeholder: 'Mandatory reason...' }
  ];

  openModal('Cancel Sale — Reason Required', fields, () => {
    const v = getModalValues(fields);
    if (!v.reason) return showToast('Reason is mandatory for cancellation', true);

    sale.status = 'Cancelled';
    sale.reason = v.reason;
    saveStore();
    closeModal();
    recalcMenuCosts();
    renderSalesLog();
    showToast(`Bill #${billNo} cancelled`);
  });
}

/* ── 6e. PURCHASES ───────────────────────────────────────────── */
function renderPurchases() {
  const tbody = $('tbody-purchases');
  if (DB.purchases.length === 0) {
    tbody.innerHTML = `<tr><td colspan="11"><div class="empty-state">
      <div class="empty-state-icon">📦</div>
      <div class="empty-state-text">No purchases recorded</div>
    </div></td></tr>`;
    return;
  }

  tbody.innerHTML = DB.purchases.map(p => {
    const ing = DB.ingredients.find(i => i.ingId === p.ingredientId);
    const totalQty = p.packs * (ing ? ing.packSize : 0);
    const unitCost = totalQty > 0 ? p.cost / totalQty : 0;
    const listPrice = ing ? ing.costPerUnit : 0;
    const diff = unitCost - listPrice;
    const diffClass = Math.abs(diff) < 0.01 ? 'variance-ok' : (diff > 0 ? 'variance-bad' : 'variance-ok');

    return `<tr>
      <td>${p.date}</td>
      <td>${p.supplier}</td>
      <td><code>${p.invoiceNo}</code></td>
      <td><code style="color:var(--cyan)">${p.ingredientId}</code></td>
      <td>${ing ? ing.name : '—'}</td>
      <td>${p.packs}</td>
      <td class="formula-cell protected-cell">${fmtN(totalQty)} ${ing ? ing.unit : ''}</td>
      <td class="formula-cell">${fmt(p.cost)}</td>
      <td class="formula-cell protected-cell">${fmt(unitCost)}</td>
      <td class="formula-cell protected-cell ${diffClass}">${diff >= 0 ? '+' : ''}${fmt(diff)}</td>
      <td>
        <div class="row-actions">
          <button class="row-action-btn edit" onclick="editPurchase(${DB.purchases.indexOf(p)})">Edit</button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

function addPurchaseModal() {
  const ingOptions = DB.ingredients.map(i => ({ value: i.ingId, label: `${i.ingId} — ${i.name}` }));
  if (ingOptions.length === 0) return showToast('Add ingredients first', true);

  const fields = [
    { key: 'date', label: 'Date', type: 'date', value: today() },
    { key: 'supplier', label: 'Supplier', required: true },
    { key: 'invoiceNo', label: 'Invoice No.', required: true },
    { key: 'ingredientId', label: 'Ingredient', type: 'select', options: ingOptions },
    { key: 'packs', label: 'Packs', type: 'number', min: 1, value: 1 },
    { key: 'cost', label: 'Total Cost (₹)', type: 'number', min: 0, value: 0 }
  ];

  openModal('Add Purchase', fields, () => {
    const v = getModalValues(fields);
    if (!v.supplier || !v.invoiceNo) return showToast('Supplier and Invoice required', true);

    DB.purchases.push({
      date: v.date || today(),
      supplier: v.supplier,
      invoiceNo: v.invoiceNo,
      ingredientId: v.ingredientId,
      packs: v.packs,
      cost: v.cost
    });
    saveStore();
    closeModal();
    renderPurchases();
    showToast('Purchase recorded');
  });
}

function editPurchase(idx) {
  const p = DB.purchases[idx];
  if (!p) return;

  const ingOptions = DB.ingredients.map(i => ({ value: i.ingId, label: `${i.ingId} — ${i.name}` }));
  const fields = [
    { key: 'date', label: 'Date', type: 'date', value: p.date },
    { key: 'supplier', label: 'Supplier', value: p.supplier },
    { key: 'invoiceNo', label: 'Invoice No.', value: p.invoiceNo },
    { key: 'ingredientId', label: 'Ingredient', type: 'select', options: ingOptions, value: p.ingredientId },
    { key: 'packs', label: 'Packs', type: 'number', min: 1, value: p.packs },
    { key: 'cost', label: 'Total Cost (₹)', type: 'number', min: 0, value: p.cost }
  ];

  openModal('Edit Purchase', fields, () => {
    const v = getModalValues(fields);
    Object.assign(p, {
      date: v.date,
      supplier: v.supplier,
      invoiceNo: v.invoiceNo,
      ingredientId: v.ingredientId,
      packs: v.packs,
      cost: v.cost
    });
    saveStore();
    closeModal();
    renderPurchases();
    showToast('Purchase updated');
  });
}

/* ── 6f. CASHOUT ──────────────────────────────────────────────── */
function renderCashOut() {
  const tbody = $('tbody-cashout');
  if (DB.cashOut.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8"><div class="empty-state">
      <div class="empty-state-icon">💸</div>
      <div class="empty-state-text">No outgoing payments</div>
    </div></td></tr>`;
    $('cashout-summary').textContent = '';
    return;
  }

  tbody.innerHTML = DB.cashOut.map((c, idx) => {
    const typeColors = {
      'Supplier payment': 'var(--blue)',
      'Operating expense': 'var(--orange)',
      'Owner withdrawal': 'var(--purple)',
      'Equipment': 'var(--cyan)',
      'Other': 'var(--text-dim)'
    };
    const color = typeColors[c.type] || 'var(--text-dim)';

    return `<tr>
      <td>${c.date}</td>
      <td><span style="color:${color};font-weight:600">${c.type}</span></td>
      <td>${c.category || '—'}</td>
      <td>${c.description || '—'}</td>
      <td class="formula-cell" style="color:var(--red)">${fmt(c.amount)}</td>
      <td><span class="badge badge-${c.mode.toLowerCase()}">${c.mode}</span></td>
      <td><code>${c.reference || '—'}</code></td>
      <td>
        <div class="row-actions">
          <button class="row-action-btn edit" onclick="editCashOut(${idx})">Edit</button>
        </div>
      </td>
    </tr>`;
  }).join('');

  const total = DB.cashOut.reduce((s, c) => s + c.amount, 0);
  const cashOnly = DB.cashOut.filter(c => c.mode === 'Cash').reduce((s, c) => s + c.amount, 0);
  $('cashout-summary').textContent = `${DB.cashOut.length} payments | Total: ${fmt(total)} | Cash: ${fmt(cashOnly)}`;
}

function addCashOutModal() {
  const fields = [
    { key: 'date', label: 'Date', type: 'date', value: today() },
    { key: 'type', label: 'Type', type: 'select', options: ['Supplier payment', 'Operating expense', 'Owner withdrawal', 'Equipment', 'Other'] },
    { key: 'category', label: 'Category', placeholder: 'e.g. Rent, Electricity, Wages' },
    { key: 'description', label: 'Description' },
    { key: 'amount', label: 'Amount (₹)', type: 'number', min: 0, value: 0 },
    { key: 'mode', label: 'Payment Mode', type: 'select', options: ['Cash', 'UPI', 'Card', 'Bank Transfer'] },
    { key: 'reference', label: 'Reference No.', placeholder: 'Txn/Cheque/Receipt No.' }
  ];

  openModal('Add Cash Out Payment', fields, () => {
    const v = getModalValues(fields);
    if (v.amount <= 0) return showToast('Amount must be > 0', true);

    DB.cashOut.push({
      date: v.date || today(),
      type: v.type,
      category: v.category,
      description: v.description,
      amount: v.amount,
      mode: v.mode,
      reference: v.reference
    });
    saveStore();
    closeModal();
    renderCashOut();
    showToast('Payment recorded');
  });
}

function editCashOut(idx) {
  const c = DB.cashOut[idx];
  if (!c) return;

  const fields = [
    { key: 'date', label: 'Date', type: 'date', value: c.date },
    { key: 'type', label: 'Type', type: 'select', options: ['Supplier payment', 'Operating expense', 'Owner withdrawal', 'Equipment', 'Other'], value: c.type },
    { key: 'category', label: 'Category', value: c.category },
    { key: 'description', label: 'Description', value: c.description },
    { key: 'amount', label: 'Amount (₹)', type: 'number', min: 0, value: c.amount },
    { key: 'mode', label: 'Payment Mode', type: 'select', options: ['Cash', 'UPI', 'Card', 'Bank Transfer'], value: c.mode },
    { key: 'reference', label: 'Reference', value: c.reference }
  ];

  openModal('Edit Cash Out', fields, () => {
    const v = getModalValues(fields);
    Object.assign(c, {
      date: v.date,
      type: v.type,
      category: v.category,
      description: v.description,
      amount: v.amount,
      mode: v.mode,
      reference: v.reference
    });
    saveStore();
    closeModal();
    renderCashOut();
    showToast('Payment updated');
  });
}

/* ── 6g. WASTAGE ──────────────────────────────────────────────── */
function renderWastage() {
  const tbody = $('tbody-wastage');
  if (DB.wastage.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8"><div class="empty-state">
      <div class="empty-state-icon">🗑️</div>
      <div class="empty-state-text">No wastage logged</div>
    </div></td></tr>`;
    return;
  }

  tbody.innerHTML = DB.wastage.map((w, idx) => {
    const ing = DB.ingredients.find(i => i.ingId === w.ingredientId);
    const value = ing ? w.qty * ing.costPerUnit : 0;

    return `<tr>
      <td>${w.date}</td>
      <td><code style="color:var(--cyan)">${w.ingredientId}</code></td>
      <td>${ing ? ing.name : '—'}</td>
      <td>${w.qty}</td>
      <td>${ing ? ing.unit : '—'}</td>
      <td class="formula-cell protected-cell" style="color:var(--orange)">${fmt(value)}</td>
      <td>${w.reason || '—'}</td>
      <td>
        <div class="row-actions">
          <button class="row-action-btn edit" onclick="editWastage(${idx})">Edit</button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

function addWastageModal() {
  const ingOptions = DB.ingredients.map(i => ({ value: i.ingId, label: `${i.ingId} — ${i.name} (${i.unit})` }));
  if (ingOptions.length === 0) return showToast('Add ingredients first', true);

  const fields = [
    { key: 'date', label: 'Date', type: 'date', value: today() },
    { key: 'ingredientId', label: 'Ingredient', type: 'select', options: ingOptions },
    { key: 'qty', label: 'Quantity Wasted', type: 'number', min: 0.01, step: 0.01, value: 1 },
    { key: 'reason', label: 'Reason', placeholder: 'e.g. Expired, Spoiled, Dropped' }
  ];

  openModal('Log Ingredient Wastage', fields, () => {
    const v = getModalValues(fields);
    if (v.qty <= 0) return showToast('Quantity must be > 0', true);

    DB.wastage.push({
      date: v.date || today(),
      ingredientId: v.ingredientId,
      qty: v.qty,
      reason: v.reason
    });
    saveStore();
    closeModal();
    renderWastage();
    showToast('Wastage logged');
  });
}

function editWastage(idx) {
  const w = DB.wastage[idx];
  if (!w) return;

  const ingOptions = DB.ingredients.map(i => ({ value: i.ingId, label: `${i.ingId} — ${i.name}` }));
  const fields = [
    { key: 'date', label: 'Date', type: 'date', value: w.date },
    { key: 'ingredientId', label: 'Ingredient', type: 'select', options: ingOptions, value: w.ingredientId },
    { key: 'qty', label: 'Quantity', type: 'number', min: 0.01, step: 0.01, value: w.qty },
    { key: 'reason', label: 'Reason', value: w.reason }
  ];

  openModal('Edit Wastage', fields, () => {
    const v = getModalValues(fields);
    Object.assign(w, {
      date: v.date,
      ingredientId: v.ingredientId,
      qty: v.qty,
      reason: v.reason
    });
    saveStore();
    closeModal();
    renderWastage();
    showToast('Wastage updated');
  });
}

/* ── 6h. STOCK ────────────────────────────────────────────────── */
function renderStock() {
  recalcStock();
  const tbody = $('tbody-stock');
  if (DB.stock.length === 0) {
    tbody.innerHTML = `<tr><td colspan="11"><div class="empty-state">
      <div class="empty-state-icon">📊</div>
      <div class="empty-state-text">No stock data — add ingredients first</div>
    </div></td></tr>`;
    return;
  }

  tbody.innerHTML = DB.stock.map(s => {
    const varClass = s.variance === null ? '' :
      Math.abs(s.variance) < 1 ? 'variance-ok' :
      Math.abs(s.variance) < 5 ? 'variance-warn' : 'variance-bad';

    return `<tr>
      <td><code style="color:var(--gold)">${s.ingId}</code></td>
      <td>${s.name}</td>
      <td>${s.unit}</td>
      <td class="formula-cell">${fmtN(s.opening)}</td>
      <td class="formula-cell" style="color:var(--green)">${fmtN(s.purchases)}</td>
      <td class="formula-cell" style="color:var(--orange)">${fmtN(s.recipeUsage)}</td>
      <td class="formula-cell" style="color:var(--red)">${fmtN(s.wastage)}</td>
      <td class="formula-cell protected-cell">${fmtN(s.expectedClosing)}</td>
      <td>${s.physicalCount != null ? fmtN(s.physicalCount) : '<span style="color:var(--text-dim)">—</span>'}</td>
      <td class="formula-cell ${varClass}">${s.variance != null ? fmtN(s.variance) : '—'}</td>
      <td class="${s.reorder ? 'reorder-yes' : ''}">${s.reorder ? '⚠️ REORDER' : '✓ OK'}</td>
    </tr>`;
  }).join('');
}

function physicalCountModal() {
  if (DB.ingredients.length === 0) return showToast('Add ingredients first', true);

  const ingOptions = DB.ingredients.map(i => ({ value: i.ingId, label: `${i.ingId} — ${i.name} (${i.unit})` }));

  const fields = [
    { key: 'ingredientId', label: 'Ingredient', type: 'select', options: ingOptions },
    { key: 'count', label: 'Physical Count', type: 'number', min: 0, step: 0.01, value: 0 }
  ];

  openModal('Enter Physical Count', fields, () => {
    const v = getModalValues(fields);
    const stockItem = DB.stock.find(s => s.ingId === v.ingredientId);
    if (stockItem) {
      stockItem.physicalCount = v.count;
      stockItem.variance = Formulas.variance(v.count, stockItem.expectedClosing);
    }
    saveStore();
    closeModal();
    renderStock();
    showToast('Physical count recorded');
  });
}

/* ── 6i. DAILY RECONCILIATION ─────────────────────────────────── */
function renderDaily(dateStr) {
  const date = dateStr || today();
  const grid = $('daily-recon-grid');
  const s = DB.settings;

  // Filter data for the selected date
  const daySales = DB.salesLog.filter(sl => sl.date === date && sl.status === 'Sold');
  const dayCashOut = DB.cashOut.filter(c => c.date === date);
  const dayWastage = DB.wastage.filter(w => w.date === date);

  // Sales metrics
  const grossRevenue = daySales.reduce((sum, sl) => sum + (sl.price * sl.qty), 0);
  const totalDiscount = daySales.reduce((sum, sl) => sum + sl.discount, 0);
  const netRevenue = grossRevenue - totalDiscount;
  const orderCount = new Set(daySales.map(sl => sl.billNo)).size;

  // Payment split
  const cashSales = daySales.filter(sl => sl.paymentMode === 'Cash').reduce((sum, sl) => sum + Formulas.netAmount(sl.price, sl.qty, sl.discount), 0);
  const upiSales = daySales.filter(sl => sl.paymentMode === 'UPI').reduce((sum, sl) => sum + Formulas.netAmount(sl.price, sl.qty, sl.discount), 0);
  const cardSales = daySales.filter(sl => sl.paymentMode === 'Card').reduce((sum, sl) => sum + Formulas.netAmount(sl.price, sl.qty, sl.discount), 0);
  const creditSales = daySales.filter(sl => sl.paymentMode === 'Credit').reduce((sum, sl) => sum + Formulas.netAmount(sl.price, sl.qty, sl.discount), 0);

  // Contribution
  let totalContribution = 0;
  daySales.forEach(sl => {
    const menuItem = DB.menu.find(m => m.itmId === sl.itemId);
    if (menuItem) {
      totalContribution += Formulas.contribution(sl.price, menuItem.directCost) * sl.qty;
    }
  });

  // Cash flow
  const cashPaidOut = dayCashOut.filter(c => c.mode === 'Cash').reduce((sum, c) => sum + c.amount, 0);
  const expectedCash = Formulas.expectedClosingCash(s.openingCash, cashSales, cashPaidOut);

  // Wastage value
  const wastageValue = dayWastage.reduce((sum, w) => {
    const ing = DB.ingredients.find(i => i.ingId === w.ingredientId);
    return sum + (ing ? w.qty * ing.costPerUnit : 0);
  }, 0);

  // Cancellations/Refunds
  const cancelled = DB.salesLog.filter(sl => sl.date === date && sl.status === 'Cancelled').length;
  const refunded = DB.salesLog.filter(sl => sl.date === date && sl.status === 'Refund').length;

  grid.innerHTML = `
    <div class="recon-section">
      <h3 class="recon-section-title">📊 Sales Summary</h3>
      <div class="recon-row"><span class="recon-row-label">Orders (Unique Bills)</span><span class="recon-row-value">${orderCount}</span></div>
      <div class="recon-row"><span class="recon-row-label">Items Sold</span><span class="recon-row-value">${daySales.reduce((s, sl) => s + sl.qty, 0)}</span></div>
      <div class="recon-row"><span class="recon-row-label">Gross Revenue</span><span class="recon-row-value">${fmt(grossRevenue)}</span></div>
      <div class="recon-row"><span class="recon-row-label">Discounts</span><span class="recon-row-value" style="color:var(--red)">${fmt(totalDiscount)}</span></div>
      <div class="recon-row total"><span class="recon-row-label">Net Revenue</span><span class="recon-row-value">${fmt(netRevenue)}</span></div>
      <div class="recon-row"><span class="recon-row-label">Contribution</span><span class="recon-row-value" style="color:var(--green)">${fmt(totalContribution)}</span></div>
      <div class="recon-row"><span class="recon-row-label">Cancelled / Refunded</span><span class="recon-row-value" style="color:var(--red)">${cancelled} / ${refunded}</span></div>
    </div>

    <div class="recon-section">
      <h3 class="recon-section-title">💳 Payment Breakdown</h3>
      <div class="recon-row"><span class="recon-row-label">Cash</span><span class="recon-row-value" style="color:var(--green)">${fmt(cashSales)}</span></div>
      <div class="recon-row"><span class="recon-row-label">UPI</span><span class="recon-row-value" style="color:var(--blue)">${fmt(upiSales)}</span></div>
      <div class="recon-row"><span class="recon-row-label">Card</span><span class="recon-row-value" style="color:var(--purple)">${fmt(cardSales)}</span></div>
      <div class="recon-row"><span class="recon-row-label">Credit</span><span class="recon-row-value" style="color:var(--orange)">${fmt(creditSales)}</span></div>
      <div class="recon-row total"><span class="recon-row-label">Total</span><span class="recon-row-value">${fmt(cashSales + upiSales + cardSales + creditSales)}</span></div>
    </div>

    <div class="recon-section">
      <h3 class="recon-section-title">💰 Cash Reconciliation</h3>
      <div class="recon-row"><span class="recon-row-label">Opening Cash</span><span class="recon-row-value">${fmt(s.openingCash)}</span></div>
      <div class="recon-row"><span class="recon-row-label">+ Cash Sales</span><span class="recon-row-value" style="color:var(--green)">+ ${fmt(cashSales)}</span></div>
      <div class="recon-row"><span class="recon-row-label">− Cash Paid Out</span><span class="recon-row-value" style="color:var(--red)">− ${fmt(cashPaidOut)}</span></div>
      <div class="recon-row total"><span class="recon-row-label">Expected Closing Cash</span><span class="recon-row-value">${fmt(expectedCash)}</span></div>
      <div class="recon-row"><span class="recon-row-label">Tolerance ±</span><span class="recon-row-value">${fmt(s.cashTolerance)}</span></div>
    </div>

    <div class="recon-section">
      <h3 class="recon-section-title">🗑️ Wastage & Losses</h3>
      <div class="recon-row"><span class="recon-row-label">Raw Ingredient Wastage</span><span class="recon-row-value" style="color:var(--orange)">${fmt(wastageValue)}</span></div>
      <div class="recon-row"><span class="recon-row-label">Items Wasted (via Sales)</span><span class="recon-row-value">${DB.salesLog.filter(sl => sl.date === date && sl.status === 'Wasted').length}</span></div>
    </div>
  `;
}

/* ── 6j. MONTHLY P&L ──────────────────────────────────────────── */
function renderMonthly() {
  const container = $('pnl-container');
  const s = DB.settings;

  // Revenue from all Sold items
  const soldItems = DB.salesLog.filter(sl => sl.status === 'Sold');
  const grossRevenue = soldItems.reduce((sum, sl) => sum + (sl.price * sl.qty), 0);
  const totalDiscount = soldItems.reduce((sum, sl) => sum + sl.discount, 0);
  const netRevenue = grossRevenue - totalDiscount;

  // Cost of goods sold (consumption-based, NOT purchase-based)
  // Actual consumption = Opening stock value + Purchases - Closing stock value
  let openingStockValue = 0;
  let closingStockValue = 0;
  let purchasesValue = DB.purchases.reduce((sum, p) => sum + p.cost, 0);

  DB.stock.forEach(st => {
    const ing = DB.ingredients.find(i => i.ingId === st.ingId);
    if (ing) {
      openingStockValue += st.opening * ing.costPerUnit;
      closingStockValue += st.expectedClosing * ing.costPerUnit;
    }
  });

  const actualConsumption = Formulas.actualConsumption(openingStockValue, purchasesValue, closingStockValue);

  // Direct wastage value
  const wastageValue = DB.wastage.reduce((sum, w) => {
    const ing = DB.ingredients.find(i => i.ingId === w.ingredientId);
    return sum + (ing ? w.qty * ing.costPerUnit : 0);
  }, 0);

  // COGS = actual consumption (ingredient cost from consumption only — no double counting)
  const cogs = actualConsumption;

  const grossProfit = netRevenue - cogs;

  // Operating expenses — only "Operating expense" type feeds fixed costs
  const operatingExpenses = DB.cashOut
    .filter(c => c.type === 'Operating expense')
    .reduce((sum, c) => sum + c.amount, 0);

  // Supplier payments only in cash view, NOT in P&L (no double counting)
  const supplierPayments = DB.cashOut
    .filter(c => c.type === 'Supplier payment')
    .reduce((sum, c) => sum + c.amount, 0);

  const ownerWithdrawals = DB.cashOut
    .filter(c => c.type === 'Owner withdrawal')
    .reduce((sum, c) => sum + c.amount, 0);

  const equipmentCost = DB.cashOut
    .filter(c => c.type === 'Equipment')
    .reduce((sum, c) => sum + c.amount, 0);

  const netProfit = grossProfit - operatingExpenses;

  // Percentages
  const foodCostPct = netRevenue > 0 ? (cogs / netRevenue * 100) : 0;
  const opCostPct = netRevenue > 0 ? (operatingExpenses / netRevenue * 100) : 0;
  const profitPct = netRevenue > 0 ? (netProfit / netRevenue * 100) : 0;

  // Contribution margin ratio
  const totalContribution = soldItems.reduce((sum, sl) => {
    const menuItem = DB.menu.find(m => m.itmId === sl.itemId);
    return sum + (menuItem ? Formulas.contribution(sl.price, menuItem.directCost) * sl.qty : 0);
  }, 0);
  const cmRatio = netRevenue > 0 ? totalContribution / netRevenue : 0;

  // Break-even
  const breakEven = Formulas.breakEvenSales(operatingExpenses, cmRatio);

  container.innerHTML = `
    <div class="pnl-section">
      <h3 class="pnl-section-title">📊 Revenue</h3>
      <div class="pnl-row"><span class="pnl-row-label">Gross Revenue</span><span class="pnl-row-value">${fmt(grossRevenue)}</span></div>
      <div class="pnl-row"><span class="pnl-row-label">Less: Discounts</span><span class="pnl-row-value" style="color:var(--red)">- ${fmt(totalDiscount)}</span></div>
      <div class="pnl-row total-row"><span class="pnl-row-label">Net Revenue</span><span class="pnl-row-value">${fmt(netRevenue)}</span></div>
    </div>

    <div class="pnl-section">
      <h3 class="pnl-section-title">🧂 Cost of Goods Sold (Consumption-Based)</h3>
      <div class="pnl-row"><span class="pnl-row-label">Opening Stock Value</span><span class="pnl-row-value">${fmt(openingStockValue)}</span></div>
      <div class="pnl-row"><span class="pnl-row-label">+ Purchases (Invoiced)</span><span class="pnl-row-value" style="color:var(--green)">+ ${fmt(purchasesValue)}</span></div>
      <div class="pnl-row"><span class="pnl-row-label">− Closing Stock Value</span><span class="pnl-row-value" style="color:var(--red)">- ${fmt(closingStockValue)}</span></div>
      <div class="pnl-row total-row"><span class="pnl-row-label">Actual Consumption (COGS)</span><span class="pnl-row-value">${fmt(cogs)}</span></div>
      <div class="pnl-row"><span class="pnl-row-label" style="font-style:italic;font-size:0.75rem;color:var(--text-dim)">Wastage (included in consumption)</span><span class="pnl-row-value" style="color:var(--orange)">${fmt(wastageValue)}</span></div>
    </div>

    <div class="pnl-section">
      <h3 class="pnl-section-title">📈 Gross Profit</h3>
      <div class="pnl-row total-row"><span class="pnl-row-label">Gross Profit (Net Revenue − COGS)</span><span class="pnl-row-value" style="color:${grossProfit >= 0 ? 'var(--green)' : 'var(--red)'}">${fmt(grossProfit)}</span></div>
    </div>

    <div class="pnl-section">
      <h3 class="pnl-section-title">🏢 Operating Expenses (Fixed Costs)</h3>
      <div class="pnl-row"><span class="pnl-row-label">Operating Expenses</span><span class="pnl-row-value" style="color:var(--red)">${fmt(operatingExpenses)}</span></div>
      <div class="pnl-row" style="opacity:0.5"><span class="pnl-row-label" style="font-size:0.72rem">ℹ️ Only CashOut rows typed "Operating expense" feed here</span><span class="pnl-row-value"></span></div>
    </div>

    <div class="pnl-section" style="border:1px solid ${netProfit >= 0 ? 'rgba(74,222,128,0.3)' : 'rgba(248,113,113,0.3)'}">
      <h3 class="pnl-section-title">💰 Net Profit</h3>
      <div class="pnl-row total-row"><span class="pnl-row-label">Net Profit (Gross Profit − Op. Expenses)</span><span class="pnl-row-value" style="color:${netProfit >= 0 ? 'var(--green)' : 'var(--red)'}; font-size:1.3rem">${fmt(netProfit)}</span></div>
    </div>

    <div class="pnl-section">
      <h3 class="pnl-section-title">🎯 30/30/30/10 Target Verification</h3>
      <div class="target-grid">
        <div class="target-card">
          <div class="target-card-label">Food Cost %</div>
          <div class="target-card-actual ${foodCostPct <= s.foodCostTarget ? 'target-ok' : 'target-bad'}">${foodCostPct.toFixed(1)}%</div>
          <div class="target-card-target">Target: ≤ ${s.foodCostTarget}%</div>
        </div>
        <div class="target-card">
          <div class="target-card-label">Labour Cost %</div>
          <div class="target-card-actual target-warn">—</div>
          <div class="target-card-target">Target: ≤ ${s.labourCostTarget}% (set in CashOut)</div>
        </div>
        <div class="target-card">
          <div class="target-card-label">Operating Cost %</div>
          <div class="target-card-actual ${opCostPct <= s.operatingCostTarget ? 'target-ok' : 'target-bad'}">${opCostPct.toFixed(1)}%</div>
          <div class="target-card-target">Target: ≤ ${s.operatingCostTarget}%</div>
        </div>
        <div class="target-card">
          <div class="target-card-label">Profit %</div>
          <div class="target-card-actual ${profitPct >= s.profitTarget ? 'target-ok' : 'target-bad'}">${profitPct.toFixed(1)}%</div>
          <div class="target-card-target">Target: ≥ ${s.profitTarget}%</div>
        </div>
      </div>
    </div>

    <div class="pnl-section">
      <h3 class="pnl-section-title">💵 Cash Flow Summary (Not P&L)</h3>
      <div class="pnl-row"><span class="pnl-row-label">Supplier Payments (cash flow only)</span><span class="pnl-row-value">${fmt(supplierPayments)}</span></div>
      <div class="pnl-row"><span class="pnl-row-label">Owner Withdrawals</span><span class="pnl-row-value">${fmt(ownerWithdrawals)}</span></div>
      <div class="pnl-row"><span class="pnl-row-label">Equipment Purchases</span><span class="pnl-row-value">${fmt(equipmentCost)}</span></div>
      <div class="pnl-row" style="opacity:0.5"><span class="pnl-row-label" style="font-size:0.72rem">ℹ️ Supplier payments appear ONLY here, not in P&L — no double counting</span><span class="pnl-row-value"></span></div>
    </div>

    <div class="pnl-breakeven">
      <div class="pnl-breakeven-label">Break-Even Sales (Month)</div>
      <div class="pnl-breakeven-value">${fmt(breakEven)}</div>
      <div style="font-size:0.72rem;color:var(--text-dim);margin-top:8px">
        Fixed Costs ${fmt(operatingExpenses)} ÷ CM Ratio ${(cmRatio * 100).toFixed(1)}%
      </div>
    </div>
  `;
}

/* ── 6k. AUDIT ────────────────────────────────────────────────── */
function renderAudit() {
  const tbody = $('tbody-audit');
  const s = DB.settings;

  // Compute all figures
  const soldItems = DB.salesLog.filter(sl => sl.status === 'Sold');
  const grossRevenue = soldItems.reduce((sum, sl) => sum + (sl.price * sl.qty), 0);
  const totalDiscount = soldItems.reduce((sum, sl) => sum + sl.discount, 0);
  const netRevenue = grossRevenue - totalDiscount;

  const cashSales = soldItems.filter(sl => sl.paymentMode === 'Cash').reduce((sum, sl) => sum + Formulas.netAmount(sl.price, sl.qty, sl.discount), 0);
  const upiSales = soldItems.filter(sl => sl.paymentMode === 'UPI').reduce((sum, sl) => sum + Formulas.netAmount(sl.price, sl.qty, sl.discount), 0);
  const cardSales = soldItems.filter(sl => sl.paymentMode === 'Card').reduce((sum, sl) => sum + Formulas.netAmount(sl.price, sl.qty, sl.discount), 0);

  const totalCashOut = DB.cashOut.reduce((sum, c) => sum + c.amount, 0);
  const cashPaidOut = DB.cashOut.filter(c => c.mode === 'Cash').reduce((sum, c) => sum + c.amount, 0);
  const operatingExpenses = DB.cashOut.filter(c => c.type === 'Operating expense').reduce((sum, c) => sum + c.amount, 0);
  const purchasesCost = DB.purchases.reduce((sum, p) => sum + p.cost, 0);

  const wastageValue = DB.wastage.reduce((sum, w) => {
    const ing = DB.ingredients.find(i => i.ingId === w.ingredientId);
    return sum + (ing ? w.qty * ing.costPerUnit : 0);
  }, 0);

  const expectedCash = Formulas.expectedClosingCash(s.openingCash, cashSales, cashPaidOut);

  // 24 audit lines
  const lines = [
    { line: 1,  desc: 'Gross Revenue',                   reported: grossRevenue,          calculated: grossRevenue },
    { line: 2,  desc: 'Total Discounts',                  reported: totalDiscount,         calculated: totalDiscount },
    { line: 3,  desc: 'Net Revenue',                      reported: netRevenue,            calculated: grossRevenue - totalDiscount },
    { line: 4,  desc: 'Cash Sales',                       reported: cashSales,             calculated: cashSales },
    { line: 5,  desc: 'UPI Sales',                        reported: upiSales,              calculated: upiSales },
    { line: 6,  desc: 'Card Sales',                       reported: cardSales,             calculated: cardSales },
    { line: 7,  desc: 'Sales Cross-Check (4+5+6 vs 3)',   reported: cashSales + upiSales + cardSales, calculated: netRevenue },
    { line: 8,  desc: 'Items Sold Count',                 reported: soldItems.reduce((s, sl) => s + sl.qty, 0), calculated: soldItems.reduce((s, sl) => s + sl.qty, 0) },
    { line: 9,  desc: 'Unique Bills',                     reported: new Set(soldItems.map(sl => sl.billNo)).size, calculated: new Set(soldItems.map(sl => sl.billNo)).size },
    { line: 10, desc: 'Total Purchases (Invoiced)',       reported: purchasesCost,         calculated: purchasesCost },
    { line: 11, desc: 'Total Cash Out',                   reported: totalCashOut,          calculated: totalCashOut },
    { line: 12, desc: 'Operating Expenses',               reported: operatingExpenses,     calculated: operatingExpenses },
    { line: 13, desc: 'Wastage Value',                    reported: wastageValue,          calculated: wastageValue },
    { line: 14, desc: 'Opening Cash',                     reported: s.openingCash,         calculated: s.openingCash },
    { line: 15, desc: 'Cash Paid Out',                    reported: cashPaidOut,           calculated: cashPaidOut },
    { line: 16, desc: 'Expected Closing Cash',            reported: expectedCash,          calculated: Formulas.expectedClosingCash(s.openingCash, cashSales, cashPaidOut) },
    { line: 17, desc: 'Cancelled Orders',                 reported: DB.salesLog.filter(sl => sl.status === 'Cancelled').length, calculated: DB.salesLog.filter(sl => sl.status === 'Cancelled').length },
    { line: 18, desc: 'Refunded Orders',                  reported: DB.salesLog.filter(sl => sl.status === 'Refund').length, calculated: DB.salesLog.filter(sl => sl.status === 'Refund').length },
    { line: 19, desc: 'Wasted Items (via Sales)',         reported: DB.salesLog.filter(sl => sl.status === 'Wasted').length, calculated: DB.salesLog.filter(sl => sl.status === 'Wasted').length },
    { line: 20, desc: 'Stock Variance Count (negative)',  reported: DB.stock.filter(s => s.variance != null && s.variance < 0).length, calculated: DB.stock.filter(s => s.variance != null && s.variance < 0).length },
    { line: 21, desc: 'Ingredients Below Min Stock',      reported: DB.stock.filter(s => s.reorder).length, calculated: DB.stock.filter(s => s.reorder).length },
    { line: 22, desc: 'Average Order Value',              reported: soldItems.length > 0 ? netRevenue / new Set(soldItems.map(sl => sl.billNo)).size : 0, calculated: soldItems.length > 0 ? netRevenue / new Set(soldItems.map(sl => sl.billNo)).size : 0 },
    { line: 23, desc: 'Food Cost %',                      reported: netRevenue > 0 ? ((purchasesCost / netRevenue) * 100) : 0, calculated: netRevenue > 0 ? ((purchasesCost / netRevenue) * 100) : 0 },
    { line: 24, desc: 'Profit Margin %',                  reported: netRevenue > 0 ? (((netRevenue - purchasesCost - operatingExpenses) / netRevenue) * 100) : 0, calculated: netRevenue > 0 ? (((netRevenue - purchasesCost - operatingExpenses) / netRevenue) * 100) : 0 }
  ];

  tbody.innerHTML = lines.map(l => {
    const diff = l.reported - l.calculated;
    const isPercent = l.line >= 23;
    const formatFn = isPercent ? (v => v.toFixed(1) + '%') : fmt;
    const diffFormatFn = isPercent ? (v => v.toFixed(1) + '%') : fmt;
    const status = Math.abs(diff) < 0.01 ? '✅ Match' :
      Math.abs(diff) <= s.cashTolerance ? '⚠️ Within tolerance' : '❌ UNEXPLAINED';
    const statusClass = Math.abs(diff) < 0.01 ? 'flag-ok' :
      Math.abs(diff) <= s.cashTolerance ? 'flag-warning' : 'flag-error';

    return `<tr>
      <td style="font-family:var(--font-mono);color:var(--gold)">${l.line}</td>
      <td>${l.desc}</td>
      <td class="formula-cell">${formatFn(l.reported)}</td>
      <td class="formula-cell">${formatFn(l.calculated)}</td>
      <td class="formula-cell ${statusClass}">${diffFormatFn(diff)}</td>
      <td class="${statusClass}">${status}</td>
    </tr>`;
  }).join('');
}

/* ── 6l. DASHBOARD (one-day KPI view) ─────────────────────────── */
function renderDashboard(dateStr) {
  const date = dateStr || today();
  const s = DB.settings;

  const daySales = DB.salesLog.filter(sl => sl.date === date && sl.status === 'Sold');
  const grossRevenue = daySales.reduce((sum, sl) => sum + (sl.price * sl.qty), 0);
  const totalDiscount = daySales.reduce((sum, sl) => sum + sl.discount, 0);
  const netRevenue = grossRevenue - totalDiscount;
  const orderCount = new Set(daySales.map(sl => sl.billNo)).size;
  const avgOrder = orderCount > 0 ? netRevenue / orderCount : 0;

  let totalContribution = 0;
  daySales.forEach(sl => {
    const mi = DB.menu.find(m => m.itmId === sl.itemId);
    if (mi) totalContribution += Formulas.contribution(sl.price, mi.directCost) * sl.qty;
  });

  const cashSales = daySales.filter(sl => sl.paymentMode === 'Cash').reduce((sum, sl) => sum + Formulas.netAmount(sl.price, sl.qty, sl.discount), 0);
  const cashPaidOut = DB.cashOut.filter(c => c.date === date && c.mode === 'Cash').reduce((sum, c) => sum + c.amount, 0);
  const cashBalance = Formulas.expectedClosingCash(s.openingCash, cashSales, cashPaidOut);

  const dayWastage = DB.wastage.filter(w => w.date === date);
  const wastageValue = dayWastage.reduce((sum, w) => {
    const ing = DB.ingredients.find(i => i.ingId === w.ingredientId);
    return sum + (ing ? w.qty * ing.costPerUnit : 0);
  }, 0);

  // Update KPI cards
  $('kpi-revenue').textContent = fmt(netRevenue);
  $('kpi-orders').textContent = orderCount;
  $('kpi-avg').textContent = fmt(avgOrder);
  $('kpi-contribution').textContent = fmt(totalContribution);
  $('kpi-cash').textContent = fmt(cashBalance);
  $('kpi-wastage').textContent = fmt(wastageValue);

  // Cash reconciliation
  $('recon-opening').textContent = fmt(s.openingCash);
  $('recon-cash-sales').textContent = '+ ' + fmt(cashSales);
  $('recon-cash-out').textContent = '− ' + fmt(cashPaidOut);
  $('recon-expected').textContent = fmt(cashBalance);

  // Top sellers
  const itemSales = {};
  daySales.forEach(sl => {
    const name = sl.itemName || sl.itemId;
    itemSales[name] = (itemSales[name] || 0) + sl.qty;
  });
  const topSellers = Object.entries(itemSales).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const maxQty = topSellers[0] ? topSellers[0][1] : 1;
  const colors = ['gold', 'blue', 'green', 'purple', 'orange', 'cyan'];

  const topContainer = $('dash-top-sellers');
  if (topSellers.length === 0) {
    topContainer.innerHTML = '<div class="empty-state"><div class="empty-state-text" style="font-size:0.8rem">No sales today</div></div>';
  } else {
    topContainer.innerHTML = topSellers.map((item, i) => `
      <div class="bar-item">
        <span class="bar-label">${item[0]}</span>
        <div class="bar-track"><div class="bar-fill ${colors[i % colors.length]}" style="width:${(item[1] / maxQty * 100).toFixed(0)}%">${item[1]}</div></div>
        <span class="bar-value">${item[1]} qty</span>
      </div>
    `).join('');
  }

  // Payment split
  const paymentSplit = {};
  daySales.forEach(sl => {
    const mode = sl.paymentMode;
    paymentSplit[mode] = (paymentSplit[mode] || 0) + Formulas.netAmount(sl.price, sl.qty, sl.discount);
  });
  const payEntries = Object.entries(paymentSplit).sort((a, b) => b[1] - a[1]);
  const maxPay = payEntries[0] ? payEntries[0][1] : 1;
  const payColors = { Cash: 'green', UPI: 'blue', Card: 'purple', Credit: 'orange' };

  const payContainer = $('dash-payment-split');
  if (payEntries.length === 0) {
    payContainer.innerHTML = '<div class="empty-state"><div class="empty-state-text" style="font-size:0.8rem">No payments today</div></div>';
  } else {
    payContainer.innerHTML = payEntries.map(p => `
      <div class="bar-item">
        <span class="bar-label">${p[0]}</span>
        <div class="bar-track"><div class="bar-fill ${payColors[p[0]] || 'gold'}" style="width:${(p[1] / maxPay * 100).toFixed(0)}%">${fmt(p[1])}</div></div>
        <span class="bar-value">${fmt(p[1])}</span>
      </div>
    `).join('');
  }

  // Hourly sales
  const hourlySales = {};
  daySales.forEach(sl => {
    // Parse time like "10:30 am"
    const match = sl.time.match(/(\d{1,2})/);
    if (match) {
      const hr = parseInt(match[1]);
      hourlySales[hr] = (hourlySales[hr] || 0) + Formulas.netAmount(sl.price, sl.qty, sl.discount);
    }
  });

  const hourlyContainer = $('dash-hourly-sales');
  const hours = Array.from({ length: 14 }, (_, i) => i + 8); // 8am to 9pm
  const maxHourly = Math.max(...hours.map(h => hourlySales[h] || 0), 1);

  if (Object.keys(hourlySales).length === 0) {
    hourlyContainer.innerHTML = '<div class="empty-state"><div class="empty-state-text" style="font-size:0.8rem">No hourly data</div></div>';
  } else {
    hourlyContainer.innerHTML = `<div class="hourly-chart">${hours.map(h => `
      <div class="hourly-bar" style="height:${((hourlySales[h] || 0) / maxHourly * 100).toFixed(0)}%" title="${h}:00 — ${fmt(hourlySales[h] || 0)}">
        <span class="hour-label">${h}</span>
      </div>
    `).join('')}</div>`;
  }
}

/* ══════════════════════════════════════════════════════════════
   §7  SETTINGS
   ══════════════════════════════════════════════════════════════ */
function loadSettings() {
  const s = DB.settings;
  $('set-month-start').value = s.monthStart || '';
  $('set-month-end').value = s.monthEnd || '';
  $('set-food-cost').value = s.foodCostTarget;
  $('set-labour-cost').value = s.labourCostTarget;
  $('set-operating-cost').value = s.operatingCostTarget;
  $('set-profit-target').value = s.profitTarget;
  $('set-opening-cash').value = s.openingCash;
  $('set-cash-tolerance').value = s.cashTolerance;
  $('set-tax-mode').value = s.taxMode;
  $('set-gst-rate').value = s.gstRate;
  $('set-wastage-allowance').value = s.wastageAllowance;
}

function saveSettings() {
  DB.settings = {
    monthStart: $('set-month-start').value,
    monthEnd: $('set-month-end').value,
    foodCostTarget: parseFloat($('set-food-cost').value) || 30,
    labourCostTarget: parseFloat($('set-labour-cost').value) || 30,
    operatingCostTarget: parseFloat($('set-operating-cost').value) || 30,
    profitTarget: parseFloat($('set-profit-target').value) || 10,
    openingCash: parseFloat($('set-opening-cash').value) || 2000,
    cashTolerance: parseFloat($('set-cash-tolerance').value) || 50,
    taxMode: $('set-tax-mode').value,
    gstRate: parseFloat($('set-gst-rate').value) || 5,
    wastageAllowance: parseFloat($('set-wastage-allowance').value) || 3
  };
  saveStore();
  recalcMenuCosts();
  showToast('Settings saved');
}

/* ══════════════════════════════════════════════════════════════
   §8  CSV EXPORT
   ══════════════════════════════════════════════════════════════ */
function exportCSV() {
  const activeSheet = document.querySelector('.sheet.active');
  const table = activeSheet.querySelector('.cms-table');
  if (!table) return showToast('No table to export', true);

  const rows = [];
  table.querySelectorAll('tr').forEach(tr => {
    const cells = [];
    tr.querySelectorAll('th, td').forEach(td => {
      let text = td.textContent.trim().replace(/"/g, '""');
      cells.push('"' + text + '"');
    });
    rows.push(cells.join(','));
  });

  const csv = rows.join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const sheetName = activeSheet.id.replace('sheet-', '');
  a.href = url;
  a.download = `DAS_CAFE_${sheetName}_${today()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  showToast(`Exported ${sheetName}.csv`);
}

/* ══════════════════════════════════════════════════════════════
   §9  CLOCK
   ══════════════════════════════════════════════════════════════ */
function updateClock() {
  const d = new Date();
  $('cms-clock').textContent = d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' }) +
    ' · ' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
}

/* ══════════════════════════════════════════════════════════════
   §10  TAB NAVIGATION
   ══════════════════════════════════════════════════════════════ */
function switchSheet(sheetName) {
  $$('.tab').forEach(t => t.classList.toggle('active', t.dataset.sheet === sheetName));
  $$('.sheet').forEach(s => s.classList.toggle('active', s.id === 'sheet-' + sheetName));

  // Render active sheet
  switch (sheetName) {
    case 'dashboard':   renderDashboard(); break;
    case 'settings':    loadSettings(); break;
    case 'ingredients': renderIngredients(); break;
    case 'menu':        renderMenu(); break;
    case 'recipes':     renderRecipes(); break;
    case 'sales_log':   renderSalesLog(); break;
    case 'purchases':   renderPurchases(); break;
    case 'cashout':     renderCashOut(); break;
    case 'wastage':     renderWastage(); break;
    case 'stock':       renderStock(); break;
    case 'daily':       renderDaily(); break;
    case 'monthly':     renderMonthly(); break;
    case 'audit':       renderAudit(); break;
  }
}

/* ══════════════════════════════════════════════════════════════
   §11  EVENT BINDINGS & INIT
   ══════════════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  // Set today's date on date inputs
  const todayStr = today();
  if ($('dash-date')) $('dash-date').value = todayStr;
  if ($('daily-date')) $('daily-date').value = todayStr;

  // Tab switching
  $$('.tab').forEach(tab => {
    tab.addEventListener('click', () => switchSheet(tab.dataset.sheet));
  });

  // Modal controls
  $('modal-close').addEventListener('click', closeModal);
  $('modal-cancel').addEventListener('click', closeModal);
  $('modal-save').addEventListener('click', () => { if (modalCallback) modalCallback(); });
  $('modal-overlay').addEventListener('click', e => { if (e.target === $('modal-overlay')) closeModal(); });

  // Sheet-specific buttons
  $('ing-add').addEventListener('click', addIngredientModal);
  $('menu-add').addEventListener('click', addMenuItemModal);
  $('recipe-add').addEventListener('click', addRecipeLineModal);
  $('sales-add').addEventListener('click', addSaleModal);
  $('purchase-add').addEventListener('click', addPurchaseModal);
  $('cashout-add').addEventListener('click', addCashOutModal);
  $('wastage-add').addEventListener('click', addWastageModal);
  $('stock-recalc').addEventListener('click', () => { recalcStock(); renderStock(); showToast('Stock recalculated'); });
  $('stock-physical').addEventListener('click', physicalCountModal);
  $('settings-save').addEventListener('click', saveSettings);
  $('btn-export-all').addEventListener('click', exportCSV);
  $('monthly-calc').addEventListener('click', renderMonthly);
  $('audit-generate').addEventListener('click', renderAudit);

  // Dashboard date change
  $('dash-date').addEventListener('change', e => renderDashboard(e.target.value));
  $('dash-refresh').addEventListener('click', () => renderDashboard($('dash-date').value));

  // Daily date change
  $('daily-date').addEventListener('change', e => renderDaily(e.target.value));
  $('daily-calc').addEventListener('click', () => renderDaily($('daily-date').value));

  // Search/filter
  $('ing-search').addEventListener('input', e => renderIngredients(e.target.value));
  $('sales-search').addEventListener('input', e => renderSalesLog(e.target.value, $('sales-status-filter').value));
  $('sales-status-filter').addEventListener('change', e => renderSalesLog($('sales-search').value, e.target.value));

  // Keyboard shortcut: Escape closes modal
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && $('modal-overlay').classList.contains('open')) closeModal();
  });

  // Clock
  updateClock();
  setInterval(updateClock, 1000);

  // Initial render
  switchSheet('dashboard');
  console.log('☕ DAS CAFE Management System initialized');
});

/* Make functions globally available for inline handlers */
window.editIngredient = editIngredient;
window.editMenuItem = editMenuItem;
window.editRecipeLine = editRecipeLine;
window.deleteRecipeLine = deleteRecipeLine;
window.cancelSale = cancelSale;
window.editPurchase = editPurchase;
window.editCashOut = editCashOut;
window.editWastage = editWastage;

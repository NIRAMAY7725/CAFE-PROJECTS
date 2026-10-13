/* ============================================================
   DAS CAFE — POS Logic
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {
    // DAS_CAFE_MENU comes from menu-data.js
    const menu = typeof DAS_CAFE_MENU !== 'undefined' ? DAS_CAFE_MENU : [];
    
    // State
    let cart = [];
    let currentCategory = 'all';
    let selectedPayment = 'cash';

    // DOM Elements
    const gridEl = document.getElementById('pos-items-grid');
    const categoriesEl = document.getElementById('pos-categories');
    const ticketListEl = document.getElementById('ticket-items-list');
    const subtotalEl = document.getElementById('subtotal');
    const totalEl = document.getElementById('grand-total');
    const paymentBtns = document.querySelectorAll('.pay-btn');
    const customerInput = document.getElementById('customer-name');
    const checkoutBtn = document.getElementById('complete-sale');
    const clearBtn = document.getElementById('clear-order');
    const toast = document.getElementById('toast');

    // ── 1. Initialize UI ────────────────────────────────────────

    function init() {
        // Extract unique categories
        const categories = [...new Set(menu.map(item => item.category))];
        
        // Render category buttons
        categories.forEach(cat => {
            const btn = document.createElement('button');
            btn.className = 'cat-btn';
            btn.dataset.cat = cat;
            btn.innerText = cat;
            btn.addEventListener('click', () => {
                document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                currentCategory = cat;
                renderGrid();
            });
            categoriesEl.appendChild(btn);
        });

        // Setup All button
        categoriesEl.querySelector('[data-cat="all"]').addEventListener('click', (e) => {
            document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            currentCategory = 'all';
            renderGrid();
        });

        // Setup Payment buttons
        paymentBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                paymentBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                selectedPayment = btn.dataset.method;
            });
        });

        // Setup actions
        clearBtn.addEventListener('click', clearCart);
        checkoutBtn.addEventListener('click', completeSale);

        renderGrid();
        renderCart();
    }

    // ── 2. Render Functions ─────────────────────────────────────

    function renderGrid() {
        gridEl.innerHTML = '';
        const itemsToRender = currentCategory === 'all' 
            ? menu 
            : menu.filter(i => i.category === currentCategory);

        itemsToRender.forEach(item => {
            const card = document.createElement('div');
            card.className = 'item-card';
            card.innerHTML = `
                <div class="item-name">${item.name}</div>
                <div class="item-price">₹${item.price}</div>
            `;
            card.addEventListener('click', () => addToCart(item));
            gridEl.appendChild(card);
        });
    }

    function renderCart() {
        if (cart.length === 0) {
            ticketListEl.innerHTML = '<div class="empty-state">No items added</div>';
            subtotalEl.innerText = '₹0';
            totalEl.innerText = '₹0';
            checkoutBtn.disabled = true;
            return;
        }

        checkoutBtn.disabled = false;
        ticketListEl.innerHTML = '';
        let total = 0;

        cart.forEach((cartItem, index) => {
            const rowTotal = cartItem.price * cartItem.quantity;
            total += rowTotal;

            const row = document.createElement('div');
            row.className = 'ticket-row';
            row.innerHTML = `
                <div class="ticket-info">
                    <div class="ticket-item-name">${cartItem.name}</div>
                    <div class="ticket-controls">
                        <button class="qty-btn" onclick="updateQty(${index}, -1)">-</button>
                        <span class="qty-val">${cartItem.quantity}</span>
                        <button class="qty-btn" onclick="updateQty(${index}, 1)">+</button>
                    </div>
                </div>
                <div class="ticket-price">₹${rowTotal}</div>
            `;
            ticketListEl.appendChild(row);
        });

        subtotalEl.innerText = `₹${total}`;
        totalEl.innerText = `₹${total}`;
        
        // Auto scroll to bottom
        ticketListEl.scrollTop = ticketListEl.scrollHeight;
    }

    // ── 3. Actions ──────────────────────────────────────────────

    window.addToCart = function(item) {
        const existing = cart.find(c => c.id === item.id);
        if (existing) {
            existing.quantity += 1;
        } else {
            cart.push({ ...item, quantity: 1 });
        }
        renderCart();
    };

    window.updateQty = function(index, delta) {
        cart[index].quantity += delta;
        if (cart[index].quantity <= 0) {
            cart.splice(index, 1);
        }
        renderCart();
    };

    function clearCart() {
        cart = [];
        customerInput.value = 'Walk-in';
        renderCart();
    }

    function showToast(msg) {
        toast.innerText = msg;
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 3000);
    }

    async function completeSale() {
        if (cart.length === 0) return;
        
        checkoutBtn.disabled = true;
        checkoutBtn.innerText = 'Processing...';

        const customerName = customerInput.value.trim() || 'Walk-in';
        const API_BASE = 'http://localhost:3000/api';

        // Prepare sales array for batch insert
        const salesData = cart.map(item => ({
            order_id: 'DAS-M-' + Math.random().toString(36).substr(2, 6).toUpperCase(),
            item_name: item.name,
            category: item.category,
            price: item.price,
            quantity: item.quantity,
            total: item.price * item.quantity,
            customer_name: customerName,
            payment_method: selectedPayment,
            notes: 'POS Entry'
        }));

        try {
            const response = await fetch(`${API_BASE}/sales/bulk`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sales: salesData })
            });

            if (response.ok) {
                showToast(`✅ Order for ${customerName} recorded!`);
                clearCart();
            } else {
                alert('Failed to record sale. Check server connection.');
            }
        } catch (error) {
            console.error('Checkout error:', error);
            alert('Error communicating with backend API.');
        } finally {
            checkoutBtn.disabled = false;
            checkoutBtn.innerText = 'Complete Sale';
        }
    }

    // Initialize
    init();
});

/* ============================================================
   DAS CAFE — Customer Order Logic
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {
    // Menu from menu-data.js
    const menu = typeof DAS_CAFE_MENU !== 'undefined' ? DAS_CAFE_MENU : [];
    
    // State
    let cart = [];
    let currentCategory = 'all';

    // DOM Elements
    const categoriesEl = document.getElementById('cust-categories');
    const menuEl = document.getElementById('cust-menu');
    const cartToggle = document.getElementById('cart-toggle');
    const closeCartBtn = document.getElementById('close-cart');
    const cartOverlay = document.getElementById('cart-overlay');
    const cartPanel = document.getElementById('cart-panel');
    const cartBadge = document.getElementById('cart-badge');
    const cartItemsEl = document.getElementById('cart-items');
    const cartTotalEl = document.getElementById('cart-total');
    const custNameInput = document.getElementById('cust-name-input');
    const placeOrderBtn = document.getElementById('place-order-btn');
    const btnTotalSpan = document.getElementById('btn-total');
    const modal = document.getElementById('success-modal');

    // ── 1. Init ────────────────────────────────────────────────

    function init() {
        const categories = [...new Set(menu.map(i => i.category))];
        
        categories.forEach(cat => {
            const btn = document.createElement('button');
            btn.className = 'cat-chip';
            btn.dataset.cat = cat;
            btn.innerText = cat;
            btn.addEventListener('click', () => {
                document.querySelectorAll('.cat-chip').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                currentCategory = cat;
                renderMenu();
            });
            categoriesEl.appendChild(btn);
        });

        // Default "All" click
        categoriesEl.querySelector('[data-cat="all"]').addEventListener('click', (e) => {
            document.querySelectorAll('.cat-chip').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            currentCategory = 'all';
            renderMenu();
        });

        cartToggle.addEventListener('click', openCart);
        closeCartBtn.addEventListener('click', closeCart);
        cartOverlay.addEventListener('click', closeCart);
        placeOrderBtn.addEventListener('click', placeOrder);

        renderMenu();
        renderCart();
    }

    // ── 2. Render Functions ─────────────────────────────────────

    function renderMenu() {
        menuEl.innerHTML = '';
        const items = currentCategory === 'all' ? menu : menu.filter(i => i.category === currentCategory);

        items.forEach(item => {
            const el = document.createElement('div');
            el.className = 'menu-item-card';
            el.innerHTML = `
                <div class="item-info">
                    <h3>${item.name}</h3>
                    <span class="category-badge">${item.category}</span>
                </div>
                <div class="item-footer">
                    <div class="item-price">₹${item.price}</div>
                    <button class="btn-add" onclick="window.addToCart(${item.id})">
                        <i class="fas fa-plus"></i>
                    </button>
                </div>
            `;
            menuEl.appendChild(el);
        });
    }

    function renderCart() {
        // Update badge
        const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
        cartBadge.innerText = totalItems;

        if (cart.length === 0) {
            cartItemsEl.innerHTML = '<div class="cart-empty">Your cart is empty. Please add some items!</div>';
            cartTotalEl.innerText = '₹0';
            btnTotalSpan.innerText = '₹0';
            placeOrderBtn.disabled = true;
            return;
        }

        placeOrderBtn.disabled = false;
        cartItemsEl.innerHTML = '';
        let grandTotal = 0;

        cart.forEach((cItem, index) => {
            const lineTotal = cItem.price * cItem.quantity;
            grandTotal += lineTotal;

            const el = document.createElement('div');
            el.className = 'cart-item';
            el.innerHTML = `
                <div class="cart-item-info">
                    <h4>${cItem.name}</h4>
                    <div class="cart-item-price">₹${lineTotal}</div>
                </div>
                <div class="cart-controls">
                    <button class="cart-qty-btn" onclick="updateQty(${index}, -1)"><i class="fas fa-minus"></i></button>
                    <span class="cart-qty-val">${cItem.quantity}</span>
                    <button class="cart-qty-btn" onclick="updateQty(${index}, 1)"><i class="fas fa-plus"></i></button>
                </div>
            `;
            cartItemsEl.appendChild(el);
        });

        cartTotalEl.innerText = `₹${grandTotal}`;
        btnTotalSpan.innerText = `₹${grandTotal}`;
    }

    // ── 3. Actions ──────────────────────────────────────────────

    window.addToCart = function(id) {
        const item = menu.find(i => i.id === id);
        const existing = cart.find(c => c.id === id);
        
        if (existing) {
            existing.quantity += 1;
        } else {
            cart.push({ ...item, quantity: 1 });
        }
        
        renderCart();
        
        // Brief visual feedback on cart icon
        cartToggle.style.transform = 'scale(1.2)';
        setTimeout(() => cartToggle.style.transform = 'translateY(0)', 200);
    };

    window.updateQty = function(index, delta) {
        cart[index].quantity += delta;
        if (cart[index].quantity <= 0) {
            cart.splice(index, 1);
        }
        renderCart();
    };

    function openCart() {
        cartOverlay.classList.add('show');
        setTimeout(() => cartPanel.classList.add('open'), 10);
    }

    function closeCart() {
        cartPanel.classList.remove('open');
        setTimeout(() => cartOverlay.classList.remove('show'), 300);
    }

    async function placeOrder() {
        if (cart.length === 0) return;
        
        const customerName = custNameInput.value.trim() || 'Self-Service Customer';
        
        placeOrderBtn.disabled = true;
        placeOrderBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';

        const API_BASE = 'http://localhost:3000/api';
        
        // Fake order ID for display (actual DB ID returned separately)
        const displayOrderId = 'DAS-QR-' + Math.random().toString(36).substr(2, 6).toUpperCase();

        const salesData = cart.map(item => ({
            order_id: displayOrderId,
            item_name: item.name,
            category: item.category,
            price: item.price,
            quantity: item.quantity,
            total: item.price * item.quantity,
            customer_name: customerName,
            payment_method: 'paytm', // default for kiosk unless specified
            notes: 'Kiosk Order'
        }));

        try {
            const res = await fetch(`${API_BASE}/sales/bulk`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sales: salesData })
            });

            if (res.ok) {
                closeCart();
                document.getElementById('success-name').innerText = customerName;
                document.getElementById('success-id').innerText = displayOrderId;
                modal.classList.add('show');
            } else {
                alert('Order failed to send. Please alert staff.');
                placeOrderBtn.disabled = false;
                placeOrderBtn.innerText = `Place Order (₹${cart.reduce((s,i)=>s+(i.price*i.quantity),0)})`;
            }
        } catch (err) {
            console.error('Order error:', err);
            alert('Cannot connect to ordering system.');
            placeOrderBtn.disabled = false;
            placeOrderBtn.innerText = 'Try Again';
        }
    }

    // Run
    init();
});

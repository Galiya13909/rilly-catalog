// ********** КОРЗИНА **********
let cart = JSON.parse(localStorage.getItem('rilly_cart')) || [];

function getCartProduct(item) {
    return products.find(p => p.code === item.code) || item;
}

function getCartPricing(item) {
    const product = getCartProduct(item);
    const basePrice = Number(product.price ?? item.price ?? 0);
    const promotion = getPromotionForProduct(product, Number(item.qty) || 0);
    const salePrice = promotion ? Number(promotion.salePrice) : basePrice;
    return { product, basePrice, promotion, salePrice };
}

function saveCart() {
    localStorage.setItem('rilly_cart', JSON.stringify(cart));
    updateCartUI();
}

function updateCartUI() {
    const badge = document.getElementById('cartBadge');
    const count = document.getElementById('cartCount');
    const totalPrice = document.getElementById('cartTotalPrice');
    const totalItems = document.getElementById('cartTotalItems');
    const totalPriceFooter = document.getElementById('cartTotalPriceFooter');
    const itemsContainer = document.getElementById('cartItems');
    const toggleBtn = document.getElementById('cartToggleBtn');
    const checkoutBtn = document.getElementById('checkoutBtn');

    const totalQty = cart.reduce((sum, item) => sum + item.qty, 0);
    const totalSum = cart.reduce((sum, item) => sum + (item.qty * getCartPricing(item).salePrice), 0);

    badge.textContent = totalQty;
    count.textContent = totalQty;
    totalPrice.textContent = totalSum.toFixed(2) + ' ₽';
    totalItems.textContent = totalQty;
    totalPriceFooter.textContent = totalSum.toFixed(2) + ' ₽';
    toggleBtn.classList.toggle('show', totalQty > 0);

    if (cart.length === 0) {
        itemsContainer.innerHTML = '<p style="color: #5a7e8f; text-align: center; padding: 40px 0;">Корзина пуста. Добавьте товары!</p>';
        checkoutBtn.disabled = true;
        return;
    }

    checkoutBtn.disabled = false;
    itemsContainer.innerHTML = '';
    cart.forEach((item, index) => {
        const pricing = getCartPricing(item);
        const priceHtml = pricing.promotion
            ? `<span style="text-decoration:line-through;opacity:.55;">${pricing.basePrice.toFixed(2)} ₽</span> <strong>${pricing.salePrice.toFixed(2)} ₽</strong><br><small>Экономия ${pricing.promotion.savingPercent}%</small>`
            : `${pricing.salePrice.toFixed(2)} ₽`;
        const div = document.createElement('div');
        div.className = 'cart-item';
        div.innerHTML = `
            <div class="cart-item-info">
                <div class="item-name">${item.name}</div>
                <div class="item-details">${priceHtml}/шт · ${pricing.product.pack} шт/кор</div>
            </div>
            <div class="cart-item-controls">
                <input type="number" min="1" value="${item.qty}" data-index="${index}" class="cart-qty-input">
                <button class="cart-item-remove" data-index="${index}">✕</button>
            </div>`;
        itemsContainer.appendChild(div);
    });

    document.querySelectorAll('.cart-qty-input').forEach(input => {
        input.addEventListener('change', function() {
            const idx = parseInt(this.dataset.index);
            const val = parseInt(this.value) || 1;
            if (val > 0) { cart[idx].qty = val; saveCart(); }
            else this.value = 1;
        });
    });
    document.querySelectorAll('.cart-item-remove').forEach(btn => {
        btn.addEventListener('click', function() {
            const idx = parseInt(this.dataset.index);
            cart.splice(idx, 1);
            saveCart();
        });
    });
}

window.cart = cart;
window.saveCart = saveCart;
window.updateCartUI = updateCartUI;
window.getCartPricing = getCartPricing;

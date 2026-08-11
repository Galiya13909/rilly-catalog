
function renderPromotionsCatalog() {
    const container = document.getElementById('promotionsCatalog');
    if (!container) return;
    const active = getCatalogPromotions();

    if (!active.length) {
        container.innerHTML = '';
        container.style.display = 'none';
        return;
    }

    container.style.display = 'block';
    const cards = active.map((p, idx) => {
        const participants = getPromotionParticipants(p);
        const participantNames = participants.slice(0, 5).map(x => x.name).join(' · ');
        const more = participants.length > 5 ? ` + ещё ${participants.length - 5}` : '';
        const details = p.details_text || p.condition_text || '';
        const dateText = p.start_date || p.end_date
            ? `${p.start_date ? new Date(p.start_date + 'T00:00:00').toLocaleDateString('ru-RU') : 'сейчас'}${p.end_date ? ` — ${new Date(p.end_date + 'T00:00:00').toLocaleDateString('ru-RU')}` : ''}`
            : '';
        let accent = 'price';
        let headline = promotionShortText(p);
        if (p.promotion_type === 'gift') {
            accent = 'gift';
            headline = `${Number(p.min_quantity || 0).toLocaleString('ru-RU')} шт. → подарок ${Number(p.min_quantity || 0) ? Math.floor(Number(p.min_quantity) / Number(p.gift_every || 20)) : ''} шт.`;
        } else if (p.promotion_type === 'repeat_info') {
            accent = 'repeat';
            headline = '10% на повторный заказ';
        } else if (p.promotion_type === 'info') {
            accent = 'info';
        }
        return `<article class="promotion-card promotion-card-${accent}">
            <div class="promotion-card-icon">${p.promotion_type === 'gift' ? '🎁' : p.promotion_type === 'repeat_info' ? '🔄' : p.promotion_type === 'info' ? 'ℹ️' : '🏷️'}</div>
            <div class="promotion-card-body">
                <div class="promotion-card-type">${promotionTypeLabel(p)}</div>
                <h3>${escapeHtml(p.name || 'Спецпредложение')}</h3>
                <div class="promotion-card-headline">${escapeHtml(headline)}</div>
                ${p.promotion_type === 'gift' ? `<div class="promotion-card-sub">Каждая ${Number(p.gift_every || 20)}-я единица — бесплатно</div>` : ''}
                ${details ? `<p>${escapeHtml(details)}</p>` : ''}
                ${participantNames ? `<div class="promotion-card-products">Участвуют: ${escapeHtml(participantNames)}${escapeHtml(more)}</div>` : ''}
                ${dateText ? `<div class="promotion-card-date">📅 ${escapeHtml(dateText)}</div>` : ''}
                <button type="button" class="promotion-more-btn" data-promo-index="${idx}">Подробнее →</button>
            </div>
        </article>`;
    }).join('');

    container.innerHTML = `
        <div class="promotion-section-header">
            <div>
                <div class="promotion-section-kicker">RILLY</div>
                <h2>🏷️ Спецпредложения</h2>
                <p>Выгодные условия на популярные товары и специальные программы для оптовых заказов.</p>
            </div>
            <span class="promotion-count">${active.length} ${active.length === 1 ? 'предложение' : 'предложения'}</span>
        </div>
        <div class="promotion-grid">${cards}</div>
        <div class="promotion-note">ℹ️ Акции не суммируются. Если вам доступны несколько предложений, уточните у менеджера наиболее подходящий вариант.</div>`;

    container.querySelectorAll('.promotion-more-btn').forEach(btn => {
        btn.addEventListener('click', () => openPromotionDetails(active[Number(btn.dataset.promoIndex)]));
    });
}

function openPromotionDetails(p) {
    const modal = document.getElementById('promotionDetailsModal');
    if (!modal || !p) return;
    const participants = getPromotionParticipants(p);
    document.getElementById('promotionDetailsTitle').textContent = p.name || 'Спецпредложение';
    document.getElementById('promotionDetailsType').textContent = promotionTypeLabel(p);
    document.getElementById('promotionDetailsText').textContent = p.details_text || p.condition_text || promotionShortText(p);
    const list = document.getElementById('promotionDetailsProducts');
    if (p.promotion_type === 'repeat_info' || p.promotion_type === 'info') {
        list.innerHTML = '<div class="promotion-details-empty">Это информационное предложение. Уточняйте применение у менеджера.</div>';
    } else {
        list.innerHTML = participants.length
            ? `<strong>Товары-участники:</strong><ul>${participants.map(x => `<li>${escapeHtml(x.name)} <span>(${escapeHtml(x.code)})</span></li>`).join('')}</ul>`
            : '<div class="promotion-details-empty">Товары-участники не указаны.</div>';
    }
    const conditions = [];
    if (p.min_quantity) conditions.push(`Минимальный объём: ${Number(p.min_quantity).toLocaleString('ru-RU')} шт.`);
    if (p.promotion_type === 'gift') conditions.push(`Каждая ${Number(p.gift_every || 20)}-я единица — бесплатно.`);
    if (p.promotion_type === 'repeat_info') conditions.push('Скидка 10% на повторный заказ. Минимальный объём — 4 000 шт. Срок — 3 месяца с даты первого заказа.');
    if (p.start_date || p.end_date) conditions.push(`Срок: ${p.start_date ? new Date(p.start_date + 'T00:00:00').toLocaleDateString('ru-RU') : 'сейчас'}${p.end_date ? ` — ${new Date(p.end_date + 'T00:00:00').toLocaleDateString('ru-RU')}` : ''}`);
    document.getElementById('promotionDetailsConditions').innerHTML = conditions.map(x => `<div>• ${escapeHtml(x)}</div>`).join('');
    modal.classList.add('show');
    document.body.style.overflow = 'hidden';
}

// ********** ОТРИСОВКА КАТАЛОГА **********
function renderCatalog() {
    const container = document.getElementById('catalogContainer');
    container.innerHTML = '';
    renderPromotionsCatalog();
    const categories = Object.keys(categoryMap);

    categories.forEach(catKey => {
        const catProducts = products.filter(p => p.category === catKey);
        if (catProducts.length === 0) return;
        const catInfo = categoryMap[catKey];
        const section = document.createElement('div');
        section.className = 'category';
        section.id = catInfo.id;

        const title = document.createElement('div');
        title.className = 'category-title';
        title.textContent = catInfo.title + ' (' + catProducts.length + ')';
        section.appendChild(title);

        const grid = document.createElement('div');
        grid.className = 'grid';

        catProducts.forEach((p) => {
            const globalIndex = products.indexOf(p);
            const card = document.createElement('div');
            card.className = 'card';
            card.dataset.index = globalIndex;

            // Открытие карточки при клике
            card.addEventListener('click', function(e) {
                if (e.target.closest('button') || e.target.closest('.card-actions') || e.target.closest('input') || e.target.closest('select') || e.target.closest('.order-row')) return;
                openCardModal(globalIndex);
            });

            const actions = document.createElement('div');
            actions.className = 'card-actions' + (isAdmin ? ' show' : '');
            actions.innerHTML = `
                <button class="edit-btn" onclick="event.stopPropagation(); editProduct(${globalIndex})">✏️</button>
                <button class="delete-btn" onclick="event.stopPropagation(); deleteProduct(${globalIndex})">🗑️</button>
            `;
            card.appendChild(actions);

           const photoDiv = document.createElement('div');
photoDiv.className = 'photo';
photoDiv.innerHTML = `
    <img src="images/${p.code}.jpg" onerror="this.parentElement.innerHTML='<div class=\\'no-photo\\'>📷 Нет фото</div>'">
    <div class="zoom-lens" id="zoomLens_${globalIndex}"></div>
`;
card.appendChild(photoDiv);

// ----- ЛОГИКА ЛУПЫ -----
const photoContainer = photoDiv;
const img = photoContainer.querySelector('img');
const lens = photoContainer.querySelector('.zoom-lens');

if (img) {
    img.onerror = function() {
        if (this.dataset.fallbackUsed === '1') {
            this.parentElement.innerHTML = '<div class="no-photo">📷 Нет фото</div>';
            return;
        }
        this.dataset.fallbackUsed = '1';
        this.src = `images/${p.code}.jpg`;
    };
}

if (img && lens && !img.hasAttribute('data-zoom-initialized')) {
    img.setAttribute('data-zoom-initialized', 'true');
    
    // Функция обновления лупы
    function moveLens(e) {
        const rect = photoContainer.getBoundingClientRect();
        
        // Позиция курсора относительно контейнера
        let x = e.clientX - rect.left;
        let y = e.clientY - rect.top;
        
        // Границы (чтобы лупа не выходила за пределы)
        const lensSize = lens.offsetWidth || 180;
        const halfLens = lensSize / 2;
        
        x = Math.min(Math.max(x, halfLens), rect.width - halfLens);
        y = Math.min(Math.max(y, halfLens), rect.height - halfLens);
        
        // Позиционируем лупу
        lens.style.left = (x - halfLens) + 'px';
        lens.style.top = (y - halfLens) + 'px';
        
        // Фон для увеличения
        const imgRect = img.getBoundingClientRect();
        const zoomX = ((x / rect.width) * 100);
        const zoomY = ((y / rect.height) * 100);
        lens.style.backgroundImage = `url(${img.src})`;
        lens.style.backgroundPosition = `${zoomX}% ${zoomY}%`;
    }
    
    // События мыши
    photoContainer.addEventListener('mousemove', moveLens);
    photoContainer.addEventListener('mouseenter', function() {
        lens.style.display = 'block';
    });
    photoContainer.addEventListener('mouseleave', function() {
        lens.style.display = 'none';
    });
}
            const infoDiv = document.createElement('div');
            infoDiv.className = 'info';

            const titleDiv = document.createElement('div');
            titleDiv.className = 'title';
            titleDiv.textContent = p.name;
            infoDiv.appendChild(titleDiv);

            const detailsDiv = document.createElement('div');
            detailsDiv.className = 'details';
            detailsDiv.textContent = p.size + ' · ' + p.pack + ' шт/кор';
            infoDiv.appendChild(detailsDiv);

            const priceDiv = document.createElement('div');
            priceDiv.className = 'price';
            priceDiv.textContent = p.price.toFixed(2) + ' ₽ / шт';
            infoDiv.appendChild(priceDiv);

            const displayPromotion = getDisplayPromotionForProduct(p);
            if (displayPromotion) {
                const promoDiv = document.createElement('div');
                promoDiv.className = 'promotion-badge';
                promoDiv.innerHTML = `🏷️ ${promotionLabel(p, displayPromotion)}`;
                infoDiv.appendChild(promoDiv);
            }
            const giftPromotion = getGiftPromotionForProduct(p);
            if (giftPromotion) {
                const giftDiv = document.createElement('div');
                giftDiv.className = 'promotion-badge promotion-badge-gift';
                giftDiv.innerHTML = `🎁 От ${Number(giftPromotion.min_quantity || 0).toLocaleString('ru-RU')} шт. · каждая ${Number(giftPromotion.gift_every || 20)}-я — бесплатно`;
                infoDiv.appendChild(giftDiv);
            }

            const artShk = document.createElement('div');
            artShk.className = 'art-shk';
            artShk.innerHTML = `<span>${p.art || '—'}</span><span>${p.shk || '—'}</span>`;
            infoDiv.appendChild(artShk);

            const orderRow = document.createElement('div');
            orderRow.className = 'order-row';

            const controlsDiv = document.createElement('div');
            controlsDiv.className = 'order-controls';

            const toggleDiv = document.createElement('div');
            toggleDiv.className = 'unit-toggle';

            const boxesBtn = document.createElement('button');
            boxesBtn.textContent = '📦 Коробки';
            boxesBtn.className = 'active';
            boxesBtn.dataset.unit = 'boxes';

            const piecesBtn = document.createElement('button');
            piecesBtn.textContent = '🔢 Штуки';
            piecesBtn.dataset.unit = 'pieces';

            toggleDiv.appendChild(boxesBtn);
            toggleDiv.appendChild(piecesBtn);

            const qtyInput = document.createElement('input');
            qtyInput.type = 'number';
            qtyInput.className = 'qty-input';
            qtyInput.min = 0;
            qtyInput.value = 0;
            qtyInput.step = 1;

            const qtyInfo = document.createElement('div');
            qtyInfo.className = 'qty-info';
            qtyInfo.innerHTML =
                `📦 <span id="boxesCount_${globalIndex}">0</span> кор. · 🔢 <span id="piecesCount_${globalIndex}">0</span> шт.`;

            controlsDiv.appendChild(toggleDiv);
            controlsDiv.appendChild(qtyInput);

            orderRow.appendChild(controlsDiv);
            orderRow.appendChild(qtyInfo);

            const addToCartBtn = document.createElement('button');
            addToCartBtn.textContent = '➕ В корзину';
            addToCartBtn.style.cssText = `
                background: #0b5a77;
                color: white;
                border: none;
                padding: 8px 16px;
                border-radius: 30px;
                font-weight: 600;
                cursor: pointer;
                transition: 0.2s;
                margin-top: 8px;
                font-size: 14px;
            `;
            addToCartBtn.onmouseover = () => addToCartBtn.style.background = '#094a62';
            addToCartBtn.onmouseout = () => addToCartBtn.style.background = '#0b5a77';
            addToCartBtn.addEventListener('click', function(e) {
                e.stopPropagation();
                const val = parseInt(qtyInput.value) || 0;
                if (val <= 0) {
                    alert('Укажите количество!');
                    return;
                }

                let isBoxes = true;
                if (piecesBtn.classList.contains('active')) isBoxes = false;

                let qty = val;
                if (isBoxes) {
                    qty = val * p.pack;
                }

                const existing = cart.find(item => item.code === p.code);
                if (existing) {
                    existing.qty += qty;
                } else {
                    cart.push({
                        code: p.code,
                        name: p.name,
                        price: p.price,
                        pack: p.pack,
                        qty: qty,
                        shk: p.shk,
                        art: p.art,
                        size: p.size
                    });
                }

                saveCart();
                qtyInput.value = 0;
                updateInfo();

                addToCartBtn.textContent = '✅ Добавлено!';
                setTimeout(() => {
                    addToCartBtn.textContent = '➕ В корзину';
                }, 1500);
            });

            orderRow.appendChild(addToCartBtn);

            let currentUnit = 'boxes';

            function updateInfo() {
                const val = parseInt(qtyInput.value) || 0;
                const packSize = p.pack || 1;
                const boxesSpan = document.getElementById(`boxesCount_${globalIndex}`);
                const piecesSpan = document.getElementById(`piecesCount_${globalIndex}`);

                if (currentUnit === 'boxes') {
                    boxesSpan.textContent = val;
                    piecesSpan.textContent = (val * packSize);
                } else {
                    piecesSpan.textContent = val;
                    boxesSpan.textContent = (val / packSize).toFixed(1);
                }
            }

            boxesBtn.addEventListener('click', function(e) {
                e.stopPropagation();
                const val = parseInt(qtyInput.value) || 0;
                const packSize = p.pack || 1;
                if (currentUnit === 'pieces') {
                    qtyInput.value = Math.round(val / packSize);
                }
                currentUnit = 'boxes';
                boxesBtn.classList.add('active');
                piecesBtn.classList.remove('active');
                updateInfo();
            });

            piecesBtn.addEventListener('click', function(e) {
                e.stopPropagation();
                const val = parseInt(qtyInput.value) || 0;
                const packSize = p.pack || 1;
                if (currentUnit === 'boxes') {
                    qtyInput.value = val * packSize;
                }
                currentUnit = 'pieces';
                piecesBtn.classList.add('active');
                boxesBtn.classList.remove('active');
                updateInfo();
            });

            qtyInput.addEventListener('input', updateInfo);

            infoDiv.appendChild(orderRow);
            card.appendChild(infoDiv);
            grid.appendChild(card);
        });

        section.appendChild(grid);
        container.appendChild(section);
    });

    document.body.classList.toggle('admin-mode', isAdmin);
    updateCartUI();
}

// ********** ОТКРЫТИЕ КАРТОЧКИ В МОДАЛЬНОМ ОКНЕ **********
function openCardModal(index) {
    const product = products[index];
    if (!product) return;

    const modalImg = document.getElementById('cardModalImg');
    modalImg.style.display = 'block';
    modalImg.dataset.fallbackUsed = '0';
    modalImg.src = getProductImageUrl(product.code);
    modalImg.onerror = function() {
        if (this.dataset.fallbackUsed === '1') {
            this.src = '';
            this.alt = 'Нет фото';
            this.style.display = 'none';
            const parent = this.parentElement;
            parent.innerHTML = '<div style="padding:40px; color:#8a7a6e; font-size:18px;">📷 Нет фото</div>';
            return;
        }
        this.dataset.fallbackUsed = '1';
        this.src = `images/${product.code}.jpg`;
    };
    document.getElementById('cardModalTitle').textContent = product.name;
    document.getElementById('cardModalDetails').textContent = product.size || 'Нет данных';
    const modalPromotion = getDisplayPromotionForProduct(product);
    document.getElementById('cardModalPrice').innerHTML = modalPromotion
        ? `<span style="text-decoration:line-through;opacity:.55;">${product.price.toFixed(2)} ₽ / шт</span><br><strong>${modalPromotion.salePrice.toFixed(2)} ₽ / шт</strong><br><small>Экономия ${modalPromotion.savingPercent}%${Number(modalPromotion.min_quantity || 0) > 0 ? ` · от ${Number(modalPromotion.min_quantity).toLocaleString('ru-RU')} шт.` : ''}</small>`
        : product.price.toFixed(2) + ' ₽ / шт';
    const modalGift = getGiftPromotionForProduct(product);
    const modalGiftNode = document.getElementById('cardModalPromotion');
    if (modalGiftNode) {
        modalGiftNode.innerHTML = modalGift
            ? `🎁 <strong>Участвует в акции:</strong> от ${Number(modalGift.min_quantity || 0).toLocaleString('ru-RU')} шт. · каждая ${Number(modalGift.gift_every || 20)}-я бесплатно`
            : '';
        modalGiftNode.style.display = modalGift ? 'block' : 'none';
    }
    document.getElementById('cardModalPack').textContent = product.pack;
    document.getElementById('cardModalPricePerPiece').textContent = product.price.toFixed(2);
    document.getElementById('cardModalArtShk').innerHTML = `
        <span>${product.art || '—'}</span>
        <span>${product.shk || '—'}</span>
    `;

    document.getElementById('cardModal').classList.add('show');
    document.body.style.overflow = 'hidden';
}

// Настройка обработчиков после загрузки DOM
document.addEventListener('DOMContentLoaded', function() {
    // Закрытие карточки
    document.getElementById('cardModalClose').addEventListener('click', function() {
        document.getElementById('cardModal').classList.remove('show');
        document.body.style.overflow = '';
    });

    document.getElementById('cardModal').addEventListener('click', function(e) {
        if (e.target === this) {
            this.classList.remove('show');
            document.body.style.overflow = '';
        }
    });

    // Корзина
    const promoDetailsClose = document.getElementById('promotionDetailsClose');
    if (promoDetailsClose) promoDetailsClose.addEventListener('click', () => { document.getElementById('promotionDetailsModal').classList.remove('show'); document.body.style.overflow = ''; });
    const promoDetailsModal = document.getElementById('promotionDetailsModal');
    if (promoDetailsModal) promoDetailsModal.addEventListener('click', e => { if (e.target === e.currentTarget) { e.currentTarget.classList.remove('show'); document.body.style.overflow = ''; } });

    document.getElementById('cartToggleBtn').addEventListener('click', function() {
        document.getElementById('cartPanel').classList.toggle('open');
    });

    document.getElementById('cartCloseBtn').addEventListener('click', function() {
        document.getElementById('cartPanel').classList.remove('open');
    });

    document.getElementById('clearCartBtn').addEventListener('click', function() {
        if (cart.length === 0) return;
        if (confirm('Очистить корзину?')) {
            cart.length = 0;
            saveCart();
            renderCatalog();
        }
    });

    document.getElementById('checkoutBtn').addEventListener('click', function() {
        if (cart.length === 0) {
            alert('Корзина пуста!');
            return;
        }

        const rows = [
            ['Код товара', 'Наименование', 'Цена без скидки (руб)', 'Скидка', 'Цена по акции (руб)', 'Количество (шт)', 'Штук в коробке', 'Сумма (руб)']
        ];
        let totalSum = 0;

        cart.forEach(item => {
            const pricing = getCartPricing(item);
            const sum = item.qty * pricing.salePrice;
            totalSum += sum;
            const discount = pricing.promotion ? `${pricing.promotion.savingPercent}%` : '';
            rows.push([
                item.code || '',
                item.name || '',
                pricing.basePrice.toFixed(2),
                discount,
                pricing.salePrice.toFixed(2),
                item.qty,
                pricing.product.pack,
                sum.toFixed(2)
            ]);
        });

        rows.push(['Итого', '', '', '', '', '', '', totalSum.toFixed(2)]);

        rows.push([]);
        rows.push([]);
        rows.push(['Дата заказа:', new Date().toLocaleString()]);
        rows.push(['Всего позиций:', cart.length]);
        rows.push(['Всего штук:', cart.reduce((sum, item) => sum + item.qty, 0)]);

        const csv = rows.map(row => row.join(';')).join('\n');
        const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'rilly_order_' + new Date().toISOString().slice(0, 10) + '.csv';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(a.href);

        document.getElementById('cartPanel').classList.remove('open');
    });
});
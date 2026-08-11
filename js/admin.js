// ********** АДМИН-ПАНЕЛЬ **********
let isAdmin = false;
let selectedPhotoFile = null;
let photoRemovePending = false;
let originalProductCode = '';

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

async function adminLogin() {
    const email = prompt('Введите email администратора:');
    if (email === null) return;
    const password = prompt('Введите пароль:');
    if (password === null) return;

    const { error } = await window.supabaseClient.auth.signInWithPassword({ email, password });
    if (error) {
        alert('Не удалось войти: ' + error.message);
        return;
    }
    await checkAdminSession();
}

async function checkAdminSession() {
    const { data: { user } } = await window.supabaseClient.auth.getUser();
    if (!user) {
        isAdmin = false;
        refreshAdminUI();
        return false;
    }

    const { data, error } = await window.supabaseClient
        .from('admin_users')
        .select('user_id')
        .eq('user_id', user.id)
        .maybeSingle();

    isAdmin = !error && !!data;
    if (!isAdmin) {
        await window.supabaseClient.auth.signOut();
        alert('У этого аккаунта нет прав администратора.');
    }
    refreshAdminUI();
    return isAdmin;
}

function refreshAdminUI() {
    const panel = document.getElementById('adminPanel');
    const btn = document.getElementById('adminToggleBtn');
    if (!panel || !btn) return;

    panel.classList.toggle('show', isAdmin);
    btn.textContent = isAdmin ? '🚪 Выйти' : '🔐 Вход';
    btn.classList.toggle('active', isAdmin);

    const importBtn = document.getElementById('importProductsBtn');
    if (importBtn) importBtn.style.display = isAdmin && window.catalogNeedsImport ? 'inline-block' : 'none';

    renderPromotionAdmin();
    renderCatalog();
}

async function saveProductToSupabase(productData, existingId = null) {
    if (existingId) {
        const { data, error } = await window.supabaseClient
            .from('products').update(productData).eq('id', existingId).select().single();
        if (error) throw error;
        return data;
    }
    const { data, error } = await window.supabaseClient
        .from('products').insert(productData).select().single();
    if (error) throw error;
    return data;
}

async function deleteProductFromSupabase(id) {
    const { error } = await window.supabaseClient.from('products').delete().eq('id', id);
    if (error) throw error;
}

async function storageFileExists(path) {
    const { data, error } = await window.supabaseClient.storage.from('product-images').list('', { search: path });
    if (error) return false;
    return (data || []).some(file => file.name === path);
}

async function removeProductPhoto(code) {
    if (!code) return;
    const { error } = await window.supabaseClient.storage.from('product-images').remove([`${code}.jpg`]);
    if (error) throw error;
}

async function moveProductPhoto(oldCode, newCode) {
    if (!oldCode || !newCode || oldCode === newCode) return;
    const bucket = window.supabaseClient.storage.from('product-images');
    const exists = await storageFileExists(`${oldCode}.jpg`);
    if (!exists) return;
    const { error } = await bucket.move(`${oldCode}.jpg`, `${newCode}.jpg`);
    if (error) throw error;
}

async function uploadProductPhoto(code, file) {
    if (!code || !file) return;

    // Всегда преобразуем выбранную картинку в JPEG, чтобы имя было строго code.jpg.
    const blob = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const img = new Image();
            img.onload = () => {
                const maxSide = 1800;
                const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
                const canvas = document.createElement('canvas');
                canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
                canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
                const ctx = canvas.getContext('2d');
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                canvas.toBlob(b => b ? resolve(b) : reject(new Error('Не удалось подготовить изображение.')), 'image/jpeg', 0.9);
            };
            img.onerror = () => reject(new Error('Не удалось прочитать изображение.'));
            img.src = reader.result;
        };
        reader.onerror = () => reject(new Error('Не удалось прочитать файл.'));
        reader.readAsDataURL(file);
    });

    const bucket = window.supabaseClient.storage.from('product-images');
    const path = `${code}.jpg`;
    const { error: removeError } = await bucket.remove([path]);
    // Отсутствие старого файла не является ошибкой.
    if (removeError && !String(removeError.message || '').toLowerCase().includes('not found')) throw removeError;

    const { error } = await bucket.upload(path, blob, {
        contentType: 'image/jpeg',
        upsert: true,
        cacheControl: '3600'
    });
    if (error) throw error;

    return window.getProductImageUrl(code) + `?v=${Date.now()}`;
}

function resetPhotoEditor() {
    selectedPhotoFile = null;
    photoRemovePending = false;
    originalProductCode = '';
    const input = document.getElementById('editPhoto');
    if (input) input.value = '';
    const status = document.getElementById('editPhotoStatus');
    if (status) status.textContent = '';
    const removeBtn = document.getElementById('removePhotoBtn');
    if (removeBtn) removeBtn.style.display = 'none';
}

function setPhotoPreview(url, statusText = '') {
    const preview = document.getElementById('editPhotoPreview');
    if (!preview) return;
    preview.innerHTML = url
        ? `<img src="${escapeHtml(url)}" alt="Фото товара" style="max-width:100%; max-height:220px; object-fit:contain; display:block;" onerror="this.onerror=null; this.src='images/${escapeHtml(originalProductCode)}.jpg';">`
        : '<span style="color:#8a9aa3;">Фото пока нет</span>';
    const status = document.getElementById('editPhotoStatus');
    if (status) status.textContent = statusText;
    const removeBtn = document.getElementById('removePhotoBtn');
    if (removeBtn) removeBtn.style.display = url ? 'inline-block' : 'none';
}

function openModal(productData, index) {
    const modal = document.getElementById('productModal');
    const modalTitle = document.getElementById('modalTitle');
    const deleteBtn = document.getElementById('deleteProductBtn');
    const editIndex = document.getElementById('editIndex');

    resetPhotoEditor();

    if (productData) {
        modalTitle.textContent = '✏️ Редактирование товара';
        document.getElementById('editCategory').value = productData.category;
        document.getElementById('editCode').value = productData.code;
        document.getElementById('editName').value = productData.name;
        document.getElementById('editPrice').value = productData.price;
        document.getElementById('editPack').value = productData.pack;
        document.getElementById('editShk').value = productData.shk || '';
        document.getElementById('editArt').value = productData.art || '';
        document.getElementById('editSize').value = productData.size || '';
        editIndex.value = index;
        deleteBtn.style.display = 'inline-block';
        originalProductCode = productData.code;
        const storageUrl = window.getProductImageUrl(productData.code);
        setPhotoPreview(storageUrl, `Файл будет храниться как ${productData.code}.jpg`);
    } else {
        modalTitle.textContent = '➕ Добавление нового товара';
        document.getElementById('productForm').reset();
        editIndex.value = '-1';
        deleteBtn.style.display = 'none';
        setPhotoPreview(null, 'После сохранения фото будет названо по коду товара.');
    }
    modal.classList.add('show');
}

function closeModal() { document.getElementById('productModal').classList.remove('show'); }

window.editProduct = function(index) {
    if (!isAdmin) return;
    const product = products[index];
    if (product) openModal(product, index);
};

window.deleteProduct = async function(index) {
    if (!isAdmin) return;
    const product = products[index];
    if (!product) return;
    if (!confirm(`Удалить товар "${product.name}"?`)) return;
    try {
        await deleteProductFromSupabase(product.id);
        try { await removeProductPhoto(product.code); } catch (photoError) { console.warn('Фото не удалено:', photoError); }
        products.splice(index, 1);
        window.products = products;
        renderCatalog();
    } catch (e) { alert('Не удалось удалить товар: ' + e.message); }
};

async function importDefaultProducts() {
    if (!isAdmin) return;
    if (!confirm(`Загрузить в базу ${defaultProducts.length} исходных товаров? Уже существующие товары с теми же кодами будут обновлены.`)) return;
    try {
        const { data, error } = await window.supabaseClient
            .from('products')
            .upsert(defaultProducts, { onConflict: 'code' })
            .select();
        if (error) throw error;
        products = data.sort((a, b) => Number(a.id) - Number(b.id));
        window.products = products;
        window.catalogNeedsImport = false;
        renderCatalog();
        refreshAdminUI();
        alert(`Готово! Загружено товаров: ${data.length}`);
    } catch (e) { alert('Не удалось импортировать товары: ' + e.message); }
}

function getPromotionSelectedProductIds(promotion) {
    if (!promotion) return [];
    const links = (window.promotionProducts || []).filter(x => Number(x.promotion_id) === Number(promotion.id));
    if (links.length) return links.map(x => String(x.product_id));
    if (promotion.product_id != null) return [String(promotion.product_id)];
    return [];
}

const PROMOTION_CATEGORY_LABELS = {
    kids: '🧸 RILLY Kids',
    body: '🛁 Губки тела',
    lappy: '⚪ LAPPY',
    tressy: '🧴 TRESSY/TRIO',
    terry: '🧴 TERRY/BIGGY',
    teflon: '🧽 Teflon',
    oval: '🥚 OVAL',
    loty: '🍀 LOTY',
    rubby: '🔴 RUBBY',
    other_dishes: '🍽️ Прочие губки',
    car: '🚗 Авто',
    bath: '🛁 Ванна',
    cloths: '🧹 Салфетки',
    other: '🧴 Ватные палочки',
    rope: '🧵 Веревка'
};

function syncPromotionPickerFromSelect() {
    const select = document.getElementById('promotionProducts');
    if (!select) return;
    const selected = new Set([...select.selectedOptions].map(o => String(o.value)));
    document.querySelectorAll('#promotionProductPicker input[data-product-id]').forEach(cb => {
        cb.checked = selected.has(String(cb.dataset.productId));
    });
    const count = selected.size;
    const countEl = document.getElementById('promotionSelectedCount');
    if (countEl) countEl.textContent = count ? `Выбрано: ${count} ${pluralizeProducts(count)}` : 'Ничего не выбрано — акция действует на все товары';
}

function pluralizeProducts(n) {
    const mod10 = n % 10, mod100 = n % 100;
    if (mod10 === 1 && mod100 !== 11) return 'товар';
    if (mod10 >= 2 && mod10 <= 4 && !(mod100 >= 12 && mod100 <= 14)) return 'товара';
    return 'товаров';
}

function setPromotionProductsSelected(ids) {
    const select = document.getElementById('promotionProducts');
    if (!select) return;
    const selected = new Set(ids.map(String));
    [...select.options].forEach(o => { o.selected = selected.has(String(o.value)); });
    syncPromotionPickerFromSelect();
}

function renderPromotionProductOptions(selectedIds = null) {
    const select = document.getElementById('promotionProducts');
    if (!select) return;

    // Сохраняем текущий выбор, если функция вызвана без нового списка выбранных товаров.
    if (selectedIds === null) selectedIds = [...select.selectedOptions].map(o => o.value);
    const selected = new Set(selectedIds.map(String));

    select.innerHTML = products.map(p => `<option value="${p.id}" ${selected.has(String(p.id)) ? 'selected' : ''}>${escapeHtml(p.name)} · ${escapeHtml(p.code)}</option>`).join('');
    select.style.display = 'none';

    let picker = document.getElementById('promotionProductPicker');
    if (!picker) {
        picker = document.createElement('div');
        picker.id = 'promotionProductPicker';
        select.insertAdjacentElement('afterend', picker);
    }

    const categories = [...new Set(products.map(p => p.category).filter(Boolean))];
    picker.innerHTML = `
        <div class="promotion-picker-top">
            <div class="promotion-picker-search-row">
                <input type="search" id="promotionProductSearch" class="promotion-picker-search" placeholder="🔎 Поиск по названию или коду..." autocomplete="off">
                <span id="promotionSelectedCount" class="promotion-selected-count"></span>
            </div>
            <div class="promotion-picker-actions">
                <button type="button" class="picker-action-btn" id="promotionSelectAll">Выбрать все</button>
                <button type="button" class="picker-action-btn" id="promotionSelectVisible">Выбрать найденные</button>
                <button type="button" class="picker-action-btn" id="promotionClearAll">Снять выбор</button>
            </div>
            <div class="promotion-category-filters">
                <button type="button" class="promotion-category-btn active" data-category="all">Все</button>
                ${categories.map(cat => `<button type="button" class="promotion-category-btn" data-category="${escapeHtml(cat)}">${escapeHtml(PROMOTION_CATEGORY_LABELS[cat] || cat)}</button>`).join('')}
            </div>
        </div>
        <div class="promotion-product-list" id="promotionProductList"></div>
    `;

    const list = picker.querySelector('#promotionProductList');
    const renderList = () => {
        const query = (picker.querySelector('#promotionProductSearch')?.value || '').trim().toLowerCase();
        const activeCategory = picker.querySelector('.promotion-category-btn.active')?.dataset.category || 'all';
        const filtered = products.filter(p => {
            const categoryOk = activeCategory === 'all' || p.category === activeCategory;
            const haystack = `${p.name || ''} ${p.code || ''}`.toLowerCase();
            return categoryOk && (!query || haystack.includes(query));
        });

        list.innerHTML = filtered.length ? filtered.map(p => {
            const checked = selected.has(String(p.id));
            return `<label class="promotion-product-option">
                <input type="checkbox" data-product-id="${p.id}" ${checked ? 'checked' : ''}>
                <span class="promotion-product-option-text">${escapeHtml(p.name)}<small>${escapeHtml(p.code)} · ${escapeHtml(PROMOTION_CATEGORY_LABELS[p.category] || p.category || '')}</small></span>
            </label>`;
        }).join('') : '<div class="promotion-picker-empty">Ничего не найдено</div>';
    };

    renderList();
    syncPromotionPickerFromSelect();

    picker.querySelector('#promotionProductSearch').addEventListener('input', renderList);
    picker.querySelectorAll('.promotion-category-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            picker.querySelectorAll('.promotion-category-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            renderList();
        });
    });

    list.addEventListener('change', e => {
        const cb = e.target.closest('input[data-product-id]');
        if (!cb) return;
        const option = [...select.options].find(o => String(o.value) === String(cb.dataset.productId));
        if (option) option.selected = cb.checked;
        if (cb.checked) selected.add(String(cb.dataset.productId));
        else selected.delete(String(cb.dataset.productId));
        syncPromotionPickerFromSelect();
    });

    picker.querySelector('#promotionSelectAll').addEventListener('click', () => {
        [...select.options].forEach(o => { o.selected = true; });
        selected.clear();
        [...select.options].forEach(o => selected.add(String(o.value)));
        renderList();
        syncPromotionPickerFromSelect();
    });

    picker.querySelector('#promotionSelectVisible').addEventListener('click', () => {
        const query = (picker.querySelector('#promotionProductSearch')?.value || '').trim().toLowerCase();
        const activeCategory = picker.querySelector('.promotion-category-btn.active')?.dataset.category || 'all';
        products.filter(p => {
            const categoryOk = activeCategory === 'all' || p.category === activeCategory;
            const haystack = `${p.name || ''} ${p.code || ''}`.toLowerCase();
            return categoryOk && (!query || haystack.includes(query));
        }).forEach(p => {
            const option = [...select.options].find(o => String(o.value) === String(p.id));
            if (option) option.selected = true;
            selected.add(String(p.id));
        });
        renderList();
        syncPromotionPickerFromSelect();
    });

    picker.querySelector('#promotionClearAll').addEventListener('click', () => {
        [...select.options].forEach(o => { o.selected = false; });
        selected.clear();
        renderList();
        syncPromotionPickerFromSelect();
    });
}

function renderPromotionAdmin() {
    const wrap = document.getElementById('promotionAdminList');
    if (!wrap) return;
    if (!isAdmin) { wrap.innerHTML = ''; return; }
    renderPromotionProductOptions();

    if (!promotions.length) {
        wrap.innerHTML = '<p class="admin-empty">Акций пока нет.</p>';
        return;
    }

    wrap.innerHTML = promotions.map((p, i) => {
        const participants = getPromotionParticipants(p);
        const target = participants.length === products.length ? 'Все товары' : `${participants.length} товар(ов)`;
        return `<div class="promotion-admin-item">
            <div>
                <strong>${escapeHtml(p.name || 'Акция')}</strong><br>
                <span>${escapeHtml(promotionTypeLabel(p))} · ${escapeHtml(promotionShortText(p))}</span><br>
                <span>Участники: ${escapeHtml(target)}</span>
                ${p.start_date || p.end_date ? `<br><small>${escapeHtml(p.start_date || 'сейчас')} — ${escapeHtml(p.end_date || 'без срока')}</small>` : ''}
                ${p.condition_text ? `<br><small>${escapeHtml(p.condition_text)}</small>` : ''}
            </div>
            <div class="promotion-admin-actions">
                <button type="button" onclick="editPromotion(${i})">✏️</button>
                <button type="button" onclick="togglePromotion(${i})">${p.is_active ? '🟢' : '🔴'}</button>
                <button type="button" onclick="deletePromotion(${i})">🗑️</button>
            </div>
        </div>`;
    }).join('');
}

function openPromotionModal(promotion = null, index = -1) {
    const modal = document.getElementById('promotionModal');
    document.getElementById('promotionEditIndex').value = index;
    document.getElementById('promotionName').value = promotion?.name || '';
    document.getElementById('promotionKind').value = promotion?.promotion_type || 'price';
    document.getElementById('promotionType').value = promotion?.discount_type || 'percent';
    document.getElementById('promotionPercent').value = promotion?.discount_percent ?? '';
    document.getElementById('promotionFixed').value = promotion?.fixed_price ?? '';
    document.getElementById('promotionMinQty').value = promotion?.min_quantity ?? '';
    document.getElementById('promotionMinQtyPrice').value = promotion?.min_quantity ?? '';
    document.getElementById('promotionGiftEvery').value = promotion?.gift_every ?? 20;
    document.getElementById('promotionCondition').value = promotion?.condition_text || '';
    document.getElementById('promotionDetails').value = promotion?.details_text || '';
    document.getElementById('promotionStartDate').value = promotion?.start_date || '';
    document.getElementById('promotionEndDate').value = promotion?.end_date || '';
    document.getElementById('promotionDisplayOrder').value = promotion?.display_order ?? 100;
    document.getElementById('promotionActive').checked = promotion ? !!promotion.is_active : true;
    renderPromotionProductOptions(getPromotionSelectedProductIds(promotion));
    updatePromotionFields();
    modal.classList.add('show');
}

function closePromotionModal() { document.getElementById('promotionModal').classList.remove('show'); }

function updatePromotionFields() {
    const kind = document.getElementById('promotionKind').value;
    document.getElementById('priceTypeFields').style.display = kind === 'price' ? 'block' : 'none';
    document.getElementById('giftTypeFields').style.display = kind === 'gift' ? 'block' : 'none';
    document.getElementById('priceMinQtyField').style.display = kind === 'price' ? 'block' : 'none';
    const details = document.getElementById('promotionDetails');
    if (details && kind === 'repeat_info' && !details.value) {
        details.value = 'Скидка 10% от прайсовой цены на повторный заказ. Минимальный объём — 4 000 шт. Срок действия — 3 месяца с даты первого заказа.';
    }
}

window.editPromotion = function(index) { if (isAdmin) openPromotionModal(promotions[index], index); };
window.deletePromotion = async function(index) {
    if (!isAdmin || !promotions[index]) return;
    if (!confirm('Удалить эту акцию?')) return;
    const { error } = await window.supabaseClient.from('promotions').delete().eq('id', promotions[index].id);
    if (error) return alert('Ошибка: ' + error.message);
    await loadPromotionsFromSupabase();
    renderPromotionAdmin();
    renderCatalog();
};
window.togglePromotion = async function(index) {
    if (!isAdmin || !promotions[index]) return;
    const p = promotions[index];
    const { error } = await window.supabaseClient.from('promotions').update({ is_active: !p.is_active }).eq('id', p.id);
    if (error) return alert('Ошибка: ' + error.message);
    await loadPromotionsFromSupabase();
    renderPromotionAdmin();
    renderCatalog();
};

async function syncPromotionProducts(promotionId, productIds) {
    const { error: deleteError } = await window.supabaseClient.from('promotion_products').delete().eq('promotion_id', promotionId);
    if (deleteError) throw deleteError;
    if (!productIds.length) return;
    const rows = productIds.map(productId => ({ promotion_id: promotionId, product_id: Number(productId) }));
    const { error } = await window.supabaseClient.from('promotion_products').insert(rows);
    if (error) throw error;
}

async function savePromotionFromForm() {
    const kind = document.getElementById('promotionKind').value;
    const type = document.getElementById('promotionType').value;
    const percent = parseFloat(document.getElementById('promotionPercent').value);
    const fixed = parseFloat(document.getElementById('promotionFixed').value);
    const minQty = kind === 'gift'
        ? parseInt(document.getElementById('promotionMinQty').value, 10)
        : (kind === 'price' ? (document.getElementById('promotionMinQtyPrice').value === '' ? null : parseInt(document.getElementById('promotionMinQtyPrice').value, 10)) : null);
    const giftEvery = kind === 'gift' ? parseInt(document.getElementById('promotionGiftEvery').value, 10) : null;

    if (kind === 'price' && type === 'percent' && (isNaN(percent) || percent <= 0 || percent >= 100)) return alert('Укажите скидку от 0 до 100%.');
    if (kind === 'price' && type === 'fixed' && (isNaN(fixed) || fixed < 0)) return alert('Укажите корректную фиксированную цену.');
    if (kind === 'gift' && (isNaN(minQty) || minQty < 1 || isNaN(giftEvery) || giftEvery < 2)) return alert('Для подарочной акции укажите минимальный объём и номер бесплатной единицы.');
    if (minQty !== null && kind === 'price' && (isNaN(minQty) || minQty < 0)) return alert('Укажите корректное количество.');

    const productIds = [...document.getElementById('promotionProducts').selectedOptions].map(o => o.value);
    const payload = {
        product_id: null,
        name: document.getElementById('promotionName').value.trim() || 'Акция',
        promotion_type: kind,
        discount_type: kind === 'price' ? type : 'percent',
        discount_percent: kind === 'price' && type === 'percent' ? percent : null,
        fixed_price: kind === 'price' && type === 'fixed' ? fixed : null,
        min_quantity: minQty,
        condition_text: document.getElementById('promotionCondition').value.trim() || null,
        details_text: document.getElementById('promotionDetails').value.trim() || null,
        start_date: document.getElementById('promotionStartDate').value || null,
        end_date: document.getElementById('promotionEndDate').value || null,
        priority: 100,
        gift_every: giftEvery,
        display_order: parseInt(document.getElementById('promotionDisplayOrder').value, 10) || 100,
        is_active: document.getElementById('promotionActive').checked
    };

    // Для обратной совместимости одиночную акцию сохраняем и в старое поле product_id.
    if (productIds.length === 1) payload.product_id = Number(productIds[0]);

    const index = parseInt(document.getElementById('promotionEditIndex').value, 10);
    try {
        let promotionId;
        if (index >= 0) {
            promotionId = promotions[index].id;
            const { error } = await window.supabaseClient.from('promotions').update(payload).eq('id', promotionId);
            if (error) throw error;
        } else {
            const { data, error } = await window.supabaseClient.from('promotions').insert(payload).select().single();
            if (error) throw error;
            promotionId = data.id;
        }
        await syncPromotionProducts(promotionId, productIds);
        await loadPromotionsFromSupabase();
        closePromotionModal();
        renderPromotionAdmin();
        renderCatalog();
    } catch (e) { alert('Не удалось сохранить акцию: ' + e.message); }
}

document.addEventListener('DOMContentLoaded', async function() {
    document.getElementById('adminToggleBtn').addEventListener('click', async function() {
        if (isAdmin) {
            await window.supabaseClient.auth.signOut();
            isAdmin = false;
            refreshAdminUI();
        } else {
            await adminLogin();
        }
    });

    document.getElementById('modalCancelBtn').addEventListener('click', closeModal);
    document.getElementById('productModal').addEventListener('click', e => { if (e.target === e.currentTarget) closeModal(); });
    document.getElementById('deleteProductBtn').addEventListener('click', async function() {
        const index = parseInt(document.getElementById('editIndex').value, 10);
        if (index >= 0) await window.deleteProduct(index);
        closeModal();
    });

    document.getElementById('productForm').addEventListener('submit', async function(e) {
        e.preventDefault();
        if (!isAdmin) return;
        const productData = {
            category: document.getElementById('editCategory').value,
            code: document.getElementById('editCode').value.trim(),
            name: document.getElementById('editName').value.trim(),
            price: parseFloat(document.getElementById('editPrice').value),
            pack: parseInt(document.getElementById('editPack').value, 10),
            shk: document.getElementById('editShk').value.trim() || null,
            art: document.getElementById('editArt').value.trim() || null,
            size: document.getElementById('editSize').value.trim() || null
        };
        if (!productData.code || !productData.name || isNaN(productData.price) || isNaN(productData.pack)) return alert('Заполните код, название, цену и количество в коробке.');
        const index = parseInt(document.getElementById('editIndex').value, 10);
        try {
            const oldProduct = index >= 0 ? products[index] : null;
            const saved = await saveProductToSupabase(productData, oldProduct ? oldProduct.id : null);

            try {
                if (photoRemovePending && oldProduct) {
                    await removeProductPhoto(oldProduct.code);
                    if (oldProduct.code !== saved.code) {
                        try { await removeProductPhoto(saved.code); } catch (_) {}
                    }
                } else if (selectedPhotoFile) {
                    if (oldProduct && oldProduct.code !== saved.code) {
                        try { await removeProductPhoto(oldProduct.code); } catch (_) {}
                    }
                    await uploadProductPhoto(saved.code, selectedPhotoFile);
                } else if (oldProduct && oldProduct.code !== saved.code) {
                    // Если код поменяли, автоматически переносим существующее фото.
                    try { await moveProductPhoto(oldProduct.code, saved.code); } catch (moveError) {
                        console.warn('Фото не перенесено:', moveError);
                    }
                }
            } catch (photoError) {
                alert('Товар сохранён, но с фотографией возникла проблема: ' + photoError.message);
            }

            if (index >= 0) products[index] = saved;
            else products.push(saved);
            window.products = products;
            closeModal();
            renderCatalog();
            renderPromotionAdmin();
        } catch (e) { alert('Не удалось сохранить товар: ' + e.message); }
    });

    document.getElementById('editPhoto').addEventListener('change', function() {
        const file = this.files?.[0];
        if (!file) return;
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
            alert('Можно загружать только JPG, PNG или WEBP.');
            this.value = '';
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            alert('Фото должно быть не больше 5 МБ.');
            this.value = '';
            return;
        }
        selectedPhotoFile = file;
        photoRemovePending = false;
        const url = URL.createObjectURL(file);
        setPhotoPreview(url, `Новое фото будет сохранено как ${document.getElementById('editCode').value.trim() || 'КОД'}.jpg`);
    });

    document.getElementById('removePhotoBtn').addEventListener('click', function() {
        selectedPhotoFile = null;
        const input = document.getElementById('editPhoto');
        if (input) input.value = '';
        photoRemovePending = true;
        setPhotoPreview(null, 'Фото будет удалено после сохранения товара.');
    });

    document.getElementById('editCode').addEventListener('input', function() {
        const status = document.getElementById('editPhotoStatus');
        if (!status) return;
        const code = this.value.trim();
        if (selectedPhotoFile) status.textContent = `Новое фото будет сохранено как ${code || 'КОД'}.jpg`;
        else if (code) status.textContent = `Фото товара: ${code}.jpg`;
    });

    document.getElementById('addProductBtn').addEventListener('click', () => openModal(null, -1));
    document.getElementById('importProductsBtn').addEventListener('click', importDefaultProducts);
    document.getElementById('addPromotionBtn').addEventListener('click', () => openPromotionModal());
    document.getElementById('promotionCancelBtn').addEventListener('click', closePromotionModal);
    document.getElementById('promotionModal').addEventListener('click', e => { if (e.target === e.currentTarget) closePromotionModal(); });
    document.getElementById('promotionType').addEventListener('change', updatePromotionFields);
    document.getElementById('promotionKind').addEventListener('change', updatePromotionFields);
    document.getElementById('promotionForm').addEventListener('submit', async e => { e.preventDefault(); await savePromotionFromForm(); });

    window.supabaseClient.auth.onAuthStateChange(() => setTimeout(checkAdminSession, 0));
    await checkAdminSession();
});

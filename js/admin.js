// ********** АДМИН-ПАНЕЛЬ **********
let isAdmin = false;

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

function openModal(productData, index) {
    const modal = document.getElementById('productModal');
    const modalTitle = document.getElementById('modalTitle');
    const deleteBtn = document.getElementById('deleteProductBtn');
    const editIndex = document.getElementById('editIndex');

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
    } else {
        modalTitle.textContent = '➕ Добавление нового товара';
        document.getElementById('productForm').reset();
        editIndex.value = '-1';
        deleteBtn.style.display = 'none';
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

function renderPromotionAdmin() {
    const select = document.getElementById('promotionProduct');
    if (select) {
        const current = select.value;
        select.innerHTML = '<option value="">🌐 Все товары</option>' + products.map(p => `<option value="${p.id}">${escapeHtml(p.name)} · ${escapeHtml(p.code)}</option>`).join('');
        if ([...select.options].some(o => o.value === current)) select.value = current;
    }
    const wrap = document.getElementById('promotionAdminList');
    if (!wrap) return;
    if (!isAdmin) { wrap.innerHTML = ''; return; }

    if (!promotions.length) {
        wrap.innerHTML = '<p class="admin-empty">Акций пока нет.</p>';
        return;
    }

    wrap.innerHTML = promotions.map((p, i) => {
        const product = p.product_id == null ? null : products.find(x => Number(x.id) === Number(p.product_id));
        const target = product ? product.name : 'Все товары';
        const value = p.discount_type === 'percent'
            ? `${Number(p.discount_percent)}%`
            : `${Number(p.fixed_price).toFixed(2)} ₽`;
        const min = Number(p.min_quantity || 0) > 0 ? ` · от ${Number(p.min_quantity).toLocaleString('ru-RU')} шт.` : '';
        return `<div class="promotion-admin-item">
            <div><strong>${escapeHtml(p.name || 'Акция')}</strong><br><span>${escapeHtml(target)}</span><br><span>${value}${min}</span>${p.condition_text ? `<br><small>${escapeHtml(p.condition_text)}</small>` : ''}</div>
            <div class="promotion-admin-actions">
                <button onclick="editPromotion(${i})">✏️</button>
                <button onclick="togglePromotion(${i})">${p.is_active ? '🟢' : '🔴'}</button>
                <button onclick="deletePromotion(${i})">🗑️</button>
            </div>
        </div>`;
    }).join('');
}

function openPromotionModal(promotion = null, index = -1) {
    const modal = document.getElementById('promotionModal');
    document.getElementById('promotionEditIndex').value = index;
    document.getElementById('promotionName').value = promotion?.name || '';
    document.getElementById('promotionProduct').value = promotion?.product_id ?? '';
    document.getElementById('promotionType').value = promotion?.discount_type || 'percent';
    document.getElementById('promotionPercent').value = promotion?.discount_percent ?? '';
    document.getElementById('promotionFixed').value = promotion?.fixed_price ?? '';
    document.getElementById('promotionMinQty').value = promotion?.min_quantity ?? '';
    document.getElementById('promotionCondition').value = promotion?.condition_text || '';
    document.getElementById('promotionActive').checked = promotion ? !!promotion.is_active : true;
    updatePromotionFields();
    modal.classList.add('show');
}

function closePromotionModal() { document.getElementById('promotionModal').classList.remove('show'); }

function updatePromotionFields() {
    const type = document.getElementById('promotionType').value;
    document.getElementById('percentField').style.display = type === 'percent' ? 'block' : 'none';
    document.getElementById('fixedField').style.display = type === 'fixed' ? 'block' : 'none';
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

async function savePromotionFromForm() {
    const type = document.getElementById('promotionType').value;
    const percent = parseFloat(document.getElementById('promotionPercent').value);
    const fixed = parseFloat(document.getElementById('promotionFixed').value);
    const minQtyRaw = document.getElementById('promotionMinQty').value;
    const minQty = minQtyRaw === '' ? null : parseInt(minQtyRaw, 10);

    if (type === 'percent' && (isNaN(percent) || percent <= 0 || percent >= 100)) return alert('Укажите скидку от 0 до 100%.');
    if (type === 'fixed' && (isNaN(fixed) || fixed < 0)) return alert('Укажите корректную фиксированную цену.');
    if (minQty !== null && (isNaN(minQty) || minQty < 0)) return alert('Укажите корректное количество.');

    const productValue = document.getElementById('promotionProduct').value;
    const payload = {
        product_id: productValue === '' ? null : Number(productValue),
        name: document.getElementById('promotionName').value.trim() || 'Акция',
        discount_type: type,
        discount_percent: type === 'percent' ? percent : null,
        fixed_price: type === 'fixed' ? fixed : null,
        min_quantity: minQty,
        condition_text: document.getElementById('promotionCondition').value.trim() || null,
        is_active: document.getElementById('promotionActive').checked
    };

    const index = parseInt(document.getElementById('promotionEditIndex').value, 10);
    try {
        if (index >= 0) {
            const { error } = await window.supabaseClient.from('promotions').update(payload).eq('id', promotions[index].id);
            if (error) throw error;
        } else {
            const { error } = await window.supabaseClient.from('promotions').insert(payload);
            if (error) throw error;
        }
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
            const saved = await saveProductToSupabase(productData, index >= 0 ? products[index].id : null);
            if (index >= 0) products[index] = saved;
            else products.push(saved);
            window.products = products;
            closeModal();
            renderCatalog();
            renderPromotionAdmin();
        } catch (e) { alert('Не удалось сохранить товар: ' + e.message); }
    });

    document.getElementById('addProductBtn').addEventListener('click', () => openModal(null, -1));
    document.getElementById('importProductsBtn').addEventListener('click', importDefaultProducts);
    document.getElementById('addPromotionBtn').addEventListener('click', () => openPromotionModal());
    document.getElementById('promotionCancelBtn').addEventListener('click', closePromotionModal);
    document.getElementById('promotionModal').addEventListener('click', e => { if (e.target === e.currentTarget) closePromotionModal(); });
    document.getElementById('promotionType').addEventListener('change', updatePromotionFields);
    document.getElementById('promotionForm').addEventListener('submit', async e => { e.preventDefault(); await savePromotionFromForm(); });

    window.supabaseClient.auth.onAuthStateChange(() => setTimeout(checkAdminSession, 0));
    await checkAdminSession();
});

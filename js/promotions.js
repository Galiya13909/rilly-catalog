// ********** АКЦИИ RILLY v3 **********
let promotions = [];
let promotionProducts = [];

function todayISO() {
    return new Date().toISOString().slice(0, 10);
}

function isPromotionCurrentlyActive(p) {
    if (!p || !p.is_active) return false;
    const today = todayISO();
    if (p.start_date && p.start_date > today) return false;
    if (p.end_date && p.end_date < today) return false;
    return true;
}

function isProductInPromotion(product, p) {
    if (!product || !p) return false;
    // Старый формат: product_id = конкретный товар, null = все товары.
    if (p.product_id !== null && p.product_id !== undefined) {
        return Number(p.product_id) === Number(product.id);
    }
    // Новый формат: связи promotion_products.
    const links = promotionProducts.filter(x => Number(x.promotion_id) === Number(p.id));
    if (!links.length) return true; // null + нет связей = все товары
    return links.some(x => Number(x.product_id) === Number(product.id));
}

function getPromotionParticipants(p) {
    if (!p) return [];
    if (p.product_id !== null && p.product_id !== undefined) {
        const product = products.find(x => Number(x.id) === Number(p.product_id));
        return product ? [product] : [];
    }
    const links = promotionProducts.filter(x => Number(x.promotion_id) === Number(p.id));
    if (!links.length) return products.slice();
    const ids = new Set(links.map(x => Number(x.product_id)));
    return products.filter(x => ids.has(Number(x.id)));
}

function getPricePromotionForProduct(product, qty = 1) {
    if (!product) return null;
    const applicable = promotions.filter(p => {
        if (p.promotion_type && p.promotion_type !== 'price') return false;
        if (!isPromotionCurrentlyActive(p)) return false;
        if (!isProductInPromotion(product, p)) return false;
        const minQty = Number(p.min_quantity || 0);
        return qty >= minQty;
    });
    if (!applicable.length) return null;

    const candidates = applicable.map(p => {
        let salePrice = Number(product.price);
        if (p.discount_type === 'percent') salePrice *= (1 - Number(p.discount_percent) / 100);
        if (p.discount_type === 'fixed') salePrice = Number(p.fixed_price);
        salePrice = Math.max(0, Math.min(Number(product.price), salePrice));
        const savingPercent = Number(product.price) > 0
            ? Math.ceil(((Number(product.price) - salePrice) / Number(product.price)) * 100)
            : 0;
        return { ...p, salePrice, savingPercent };
    });

    // Цена/приоритет: сначала меньшая итоговая цена, затем приоритет.
    candidates.sort((a, b) => a.salePrice - b.salePrice || Number(a.priority || 100) - Number(b.priority || 100));
    return candidates[0];
}

function getDisplayPromotionForProduct(product) {
    if (!product) return null;
    const applicable = promotions.filter(p =>
        isPromotionCurrentlyActive(p) &&
        p.promotion_type === 'price' &&
        isProductInPromotion(product, p)
    );
    if (!applicable.length) return null;

    const candidates = applicable.map(p => {
        let salePrice = Number(product.price);
        if (p.discount_type === 'percent') salePrice *= (1 - Number(p.discount_percent) / 100);
        if (p.discount_type === 'fixed') salePrice = Number(p.fixed_price);
        salePrice = Math.max(0, Math.min(Number(product.price), salePrice));
        const savingPercent = Number(product.price) > 0
            ? Math.ceil(((Number(product.price) - salePrice) / Number(product.price)) * 100)
            : 0;
        return { ...p, salePrice, savingPercent };
    }).filter(p => p.salePrice < Number(product.price));

    candidates.sort((a, b) => a.salePrice - b.salePrice || Number(a.priority || 100) - Number(b.priority || 100));
    return candidates[0] || null;
}

function getGiftPromotionForProduct(product) {
    if (!product) return null;
    return promotions.find(p =>
        isPromotionCurrentlyActive(p) &&
        p.promotion_type === 'gift' &&
        isProductInPromotion(product, p)
    ) || null;
}

function getInformationalPromotions() {
    return promotions
        .filter(p => isPromotionCurrentlyActive(p) && ['repeat_info', 'info'].includes(p.promotion_type))
        .sort((a, b) => Number(a.display_order || 100) - Number(b.display_order || 100));
}

function getCatalogPromotions() {
    return promotions
        .filter(isPromotionCurrentlyActive)
        .sort((a, b) => Number(a.display_order || 100) - Number(b.display_order || 100));
}

function promotionLabel(product, promotion) {
    if (!promotion) return '';
    const minQty = Number(promotion.min_quantity || 0);
    const prefix = minQty > 0 ? `От ${minQty.toLocaleString('ru-RU')} шт. — ` : '';
    const price = Number(promotion.salePrice).toFixed(2);
    return `${prefix}${price} ₽/шт. · Экономия ${promotion.savingPercent}%`;
}

function promotionShortText(p) {
    if (p.promotion_type === 'gift') {
        const min = Number(p.min_quantity || 0);
        const every = Number(p.gift_every || 20);
        return `${min ? `От ${min.toLocaleString('ru-RU')} шт. · ` : ''}каждая ${every}-я — бесплатно`;
    }
    if (p.promotion_type === 'repeat_info') {
        return '10% на повторный заказ · от 4 000 шт. · 3 месяца';
    }
    if (p.promotion_type === 'info') return p.condition_text || 'Специальные условия';
    if (p.discount_type === 'fixed') {
        const min = Number(p.min_quantity || 0);
        return `${min ? `От ${min.toLocaleString('ru-RU')} шт. · ` : ''}${Number(p.fixed_price).toFixed(2)} ₽/шт.`;
    }
    return `${Number(p.discount_percent)}% скидка${Number(p.min_quantity || 0) ? ` · от ${Number(p.min_quantity).toLocaleString('ru-RU')} шт.` : ''}`;
}

function promotionTypeLabel(p) {
    if (p.promotion_type === 'gift') return '🎁 Подарок';
    if (p.promotion_type === 'repeat_info') return '🔄 Повторный заказ';
    if (p.promotion_type === 'info') return 'ℹ️ Условия';
    return p.discount_type === 'fixed' ? '💰 Спеццена' : '📉 Скидка';
}

async function loadPromotionsFromSupabase() {
    const [{ data, error }, linksResult] = await Promise.all([
        window.supabaseClient.from('promotions').select('*').order('display_order', { ascending: true }).order('id', { ascending: true }),
        window.supabaseClient.from('promotion_products').select('promotion_id, product_id')
    ]);
    if (error) throw error;
    // Если миграция ещё не выполнена, linksResult может вернуть ошибку — старые акции всё равно работают.
    promotionProducts = linksResult.error ? [] : (linksResult.data || []);
    promotions = data || [];
    window.promotions = promotions;
    window.promotionProducts = promotionProducts;
    return promotions;
}

window.promotions = promotions;
window.promotionProducts = promotionProducts;
window.getPromotionForProduct = getPricePromotionForProduct;
window.getDisplayPromotionForProduct = getDisplayPromotionForProduct;
window.getGiftPromotionForProduct = getGiftPromotionForProduct;
window.getInformationalPromotions = getInformationalPromotions;
window.getCatalogPromotions = getCatalogPromotions;
window.getPromotionParticipants = getPromotionParticipants;
window.promotionLabel = promotionLabel;
window.promotionShortText = promotionShortText;
window.promotionTypeLabel = promotionTypeLabel;
window.isPromotionCurrentlyActive = isPromotionCurrentlyActive;
window.loadPromotionsFromSupabase = loadPromotionsFromSupabase;

// ********** АКЦИИ **********
let promotions = [];

function getPromotionForProduct(product, qty = 1) {
    if (!product) return null;

    const applicable = promotions.filter(p => {
        if (!p.is_active) return false;
        if (p.product_id !== null && Number(p.product_id) !== Number(product.id)) return false;
        const minQty = Number(p.min_quantity || 0);
        return qty >= minQty;
    });

    if (!applicable.length) return null;

    const candidates = applicable.map(p => {
        let salePrice = Number(product.price);
        if (p.discount_type === 'percent') {
            salePrice = salePrice * (1 - Number(p.discount_percent) / 100);
        } else if (p.discount_type === 'fixed') {
            salePrice = Number(p.fixed_price);
        }
        salePrice = Math.max(0, Math.min(Number(product.price), salePrice));
        const savingPercent = Number(product.price) > 0
            ? Math.ceil(((Number(product.price) - salePrice) / Number(product.price)) * 100)
            : 0;
        return { ...p, salePrice, savingPercent };
    });

    candidates.sort((a, b) => a.salePrice - b.salePrice);
    return candidates[0];
}

function getDisplayPromotionForProduct(product) {
    if (!product) return null;
    const applicable = promotions.filter(p => {
        if (!p.is_active) return false;
        return p.product_id === null || Number(p.product_id) === Number(product.id);
    });
    if (!applicable.length) return null;
    const candidates = applicable.map(p => {
        let salePrice = Number(product.price);
        if (p.discount_type === 'percent') salePrice *= (1 - Number(p.discount_percent) / 100);
        if (p.discount_type === 'fixed') salePrice = Number(p.fixed_price);
        salePrice = Math.max(0, Math.min(Number(product.price), salePrice));
        const savingPercent = Number(product.price) > 0
            ? Math.ceil(((Number(product.price) - salePrice) / Number(product.price)) * 100) : 0;
        return { ...p, salePrice, savingPercent };
    }).filter(p => p.salePrice < Number(product.price));
    candidates.sort((a, b) => a.salePrice - b.salePrice);
    return candidates[0] || null;
}

function promotionLabel(product, promotion) {
    if (!promotion) return '';
    const minQty = Number(promotion.min_quantity || 0);
    const prefix = minQty > 0 ? `От ${minQty.toLocaleString('ru-RU')} шт. — ` : '';
    const price = Number(promotion.salePrice).toFixed(2);
    return `${prefix}${price} ₽/шт. · Экономия ${promotion.savingPercent}%`;
}

async function loadPromotionsFromSupabase() {
    const { data, error } = await window.supabaseClient
        .from('promotions')
        .select('*')
        .order('id', { ascending: true });
    if (error) throw error;
    promotions = data || [];
    window.promotions = promotions;
    return promotions;
}

window.promotions = promotions;
window.getPromotionForProduct = getPromotionForProduct;
window.getDisplayPromotionForProduct = getDisplayPromotionForProduct;
window.promotionLabel = promotionLabel;
window.loadPromotionsFromSupabase = loadPromotionsFromSupabase;

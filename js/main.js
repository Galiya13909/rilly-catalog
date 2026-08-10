// ********** ЗАГРУЗКА ТОВАРОВ И АКЦИЙ **********
let products = [];

async function loadProductsFromSupabase() {
    const { data, error } = await window.supabaseClient
        .from('products')
        .select('*')
        .order('id', { ascending: true });
    if (error) throw error;
    return data || [];
}

function saveProducts() {
    // Оставлено для совместимости со старым кодом.
    // Изменения теперь сохраняются напрямую в Supabase через admin.js.
}

async function initializeRilly() {
    try {
        products = await loadProductsFromSupabase();
        if (!products.length) {
            // Пока база пустая, показываем исходный каталог.
            // Администратор сможет одним нажатием импортировать его в Supabase.
            products = JSON.parse(JSON.stringify(defaultProducts));
            window.catalogNeedsImport = true;
        }

        await loadPromotionsFromSupabase();
    } catch (error) {
        console.error('Supabase error:', error);
        products = JSON.parse(JSON.stringify(defaultProducts));
        window.catalogOffline = true;
        alert('Не удалось подключиться к базе данных. Каталог открыт в режиме просмотра.');
    }

    window.products = products;
    renderCatalog();
    if (typeof refreshAdminUI === 'function') refreshAdminUI();

    console.log('✅ RILLY Каталог загружен!');
    console.log('📦 Всего товаров:', products.length);
    console.log('🏷️ Акций:', promotions.length);
    console.log('🛒 В корзине:', cart.length, 'позиций');
}

window.addEventListener('beforeunload', function(e) {
    const totalQty = cart.reduce((sum, item) => sum + item.qty, 0);
    if (totalQty > 0) {
        e.preventDefault();
        e.returnValue = 'У вас есть товары в корзине. Вы уверены, что хотите покинуть страницу?';
        return e.returnValue;
    }
});

document.addEventListener('DOMContentLoaded', initializeRilly);

window.reinitZoom = function() {
    console.log('🔄 Лупа готова к работе');
};

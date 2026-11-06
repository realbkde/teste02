/* Guarda apenas os identificadores e quantidades, sem depender de um servidor. */
(() => {
  const storageKey = 'iracemas-beauty-cart';
  let entries = readCart();

  function readCart() {
    try {
      const stored = JSON.parse(localStorage.getItem(storageKey) || '[]');
      return Array.isArray(stored) ? stored.filter(item => Number.isInteger(item.id) && Number.isInteger(item.quantity) && item.quantity > 0) : [];
    } catch {
      return [];
    }
  }

  function saveCart() {
    try {
      localStorage.setItem(storageKey, JSON.stringify(entries));
    } catch {
      // O carrinho continua disponível durante esta visita se o armazenamento falhar.
    }
  }

  function entryKey(item) {
    return `${item.id}|${encodeURIComponent(item.cor || '')}|${encodeURIComponent(item.comprimento || '')}`;
  }

  function getItems(products) {
    return entries.map(entry => {
      const product = products.find(item => item.id === entry.id);
      if (!product) return null;
      const variant = (product.variantes || []).find(item => item.cor === entry.cor && item.comprimento === entry.comprimento)
        || (product.variantes || []).find(item => item.cor === product.cor && item.comprimento === product.comprimento)
        || { cor: product.cor, comprimento: product.comprimento, disponivel: product.disponivel };
      entry.cor = variant.cor;
      entry.comprimento = variant.comprimento;
      return {
        ...product,
        ...variant,
        preco: Number.isFinite(variant.preco) ? variant.preco : product.preco,
        quantity: entry.quantity,
        cartKey: entryKey({ id: product.id, ...variant })
      };
    }).filter(Boolean);
  }

  function add(product, variant) {
    if (!product || !product.disponivel || !variant || !variant.disponivel) return false;
    const entry = entries.find(item => entryKey(item) === entryKey({ id: product.id, ...variant }));
    if (entry) entry.quantity += 1;
    else entries.push({ id: product.id, cor: variant.cor, comprimento: variant.comprimento, quantity: 1 });
    saveCart();
    return true;
  }

  function changeQuantity(key, amount, products) {
    const entry = entries.find(item => entryKey(item) === key);
    const product = entry && products.find(item => item.id === entry.id);
    if (!entry || !product) return;
    entry.quantity = Math.min(99, entry.quantity + amount);
    if (entry.quantity < 1 || !product.disponivel) entries = entries.filter(item => entryKey(item) !== key);
    saveCart();
  }

  function remove(key) {
    entries = entries.filter(item => entryKey(item) !== key);
    saveCart();
  }

  function clear() {
    entries = [];
    saveCart();
  }

  function sync() {
    entries = readCart();
  }

  window.StoreCart = { add, changeQuantity, clear, getItems, remove, sync };
})();
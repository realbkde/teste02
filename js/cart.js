/* Guarda os identificadores e variantes, sem depender de um servidor. */
(() => {
  const storageKey = 'iracemas-beauty-cart';
  let storageError = false;
  let entries = readCart();

  function readCart() {
    try {
      const stored = JSON.parse(localStorage.getItem(storageKey) || '[]');
      if (!Array.isArray(stored)) return [];
      return stored.filter(item => Number.isInteger(item.id)
        && Number.isInteger(item.quantity)
        && item.quantity > 0
        && item.quantity <= 99
        && (item.cor === undefined || typeof item.cor === 'string')
        && (item.comprimento === undefined || typeof item.comprimento === 'string'));
    } catch (error) {
      storageError = true;
      return [];
    }
  }

  function saveCart() {
    try {
      localStorage.setItem(storageKey, JSON.stringify(entries));
      storageError = false;
    } catch (error) {
      storageError = true;
      window.dispatchEvent(new CustomEvent('cart-storage-error'));
    }
  }

  function entryKey(item) {
    return `${item.id}|${encodeURIComponent(item.cor || '')}|${encodeURIComponent(item.comprimento || '')}`;
  }

  function getItems(products) {
    return entries.map(entry => {
      const product = products.find(item => item.id === entry.id);
      if (!product) return null;
      const variants = Array.isArray(product.variantes) ? product.variantes : [];
      const variant = variants.find(item => item.cor === entry.cor && item.comprimento === entry.comprimento)
        || (!variants.length ? { cor: product.cor, comprimento: product.comprimento, disponivel: product.disponivel, preco: product.preco } : null);
      if (!variant) return null;
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
    const key = entryKey({ id: product.id, ...variant });
    const entry = entries.find(item => entryKey(item) === key);
    if (entry) {
      if (entry.quantity >= 99) return false;
      entry.quantity += 1;
    } else {
      entries.push({ id: product.id, cor: variant.cor, comprimento: variant.comprimento, quantity: 1 });
    }
    saveCart();
    return true;
  }

  function changeQuantity(key, amount, products) {
    const entry = entries.find(item => entryKey(item) === key);
    const product = entry && products.find(item => item.id === entry.id);
    if (!entry || !product || !Number.isInteger(amount)) return;
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

  window.StoreCart = { add, changeQuantity, clear, getItems, hasStorageError: () => storageError, remove, sync };
})();

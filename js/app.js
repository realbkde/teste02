/* Apresentação do catálogo, detalhe e envio do pedido. */
(() => {
  const currency = 'EUR'; // Muda para 'AOA' para apresentar valores em kwanzas.
  const whatsappNumber = '351900000000'; // Substitui pelo número da loja com indicativo, sem o sinal +.
  const money = new Intl.NumberFormat(currency === 'AOA' ? 'pt-AO' : 'pt-PT', { style: 'currency', currency });
  const fallbackProducts = [
    { id: 1, nome: 'Silk Straight 24”', categoria: 'Perucas', preco: 289, descricao: 'Peruca lisa, sedosa e versátil, com movimento natural para um look polido.', cor: 'Preto natural', comprimento: '24 polegadas', tipo: 'cabelo natural', imagens: ['https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=900&q=85'], disponivel: true },
    { id: 2, nome: 'Velvet Curl 18”', categoria: 'Perucas', preco: 315, descricao: 'Caracóis definidos e volume cheio numa peça leve e pronta a usar.', cor: 'Castanho escuro', comprimento: '18 polegadas', tipo: 'cabelo natural', imagens: ['https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=900&q=85'], disponivel: true },
    { id: 3, nome: 'The Muse Bob', categoria: 'Perucas', preco: 199, descricao: 'Um corte bob elegante com acabamento natural para usar sem esforço.', cor: 'Preto suave', comprimento: '12 polegadas', tipo: 'sintética', imagens: ['https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?auto=format&fit=crop&w=900&q=85'], disponivel: true },
    { id: 4, nome: 'Soft Halo 16”', categoria: 'Perucas', preco: 149, descricao: 'Ondas suaves e toque de volume para uma finalização descontraída.', cor: 'Castanho', comprimento: '16 polegadas', tipo: 'sintética', imagens: ['https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=900&q=85'], disponivel: false },
    { id: 5, nome: 'Invisible Tape Set', categoria: 'Extensões', preco: 129, descricao: 'Extensões de aplicação discreta que acrescentam comprimento e densidade.', cor: 'Castanho natural', comprimento: '18 polegadas', tipo: 'cabelo natural', imagens: ['https://images.unsplash.com/photo-1529139574466-a303027c1d8b?auto=format&fit=crop&w=900&q=85'], disponivel: true },
    { id: 6, nome: 'Crown Volume 22”', categoria: 'Extensões', preco: 179, descricao: 'Comprimento extra e volume generoso com uma textura de aspeto natural.', cor: 'Castanho mel', comprimento: '22 polegadas', tipo: 'cabelo natural', imagens: ['https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?auto=format&fit=crop&w=900&q=85'], disponivel: true },
    { id: 7, nome: 'Noir Silk 26”', categoria: 'Extensões', preco: 229, descricao: 'Um liso comprido e luminoso para um visual marcante.', cor: 'Preto intenso', comprimento: '26 polegadas', tipo: 'sintética', imagens: ['https://images.unsplash.com/photo-1524250502761-1ac6f2e30d43?auto=format&fit=crop&w=900&q=85'], disponivel: true },
   
  ];
  const elements = {
    grid: document.querySelector('#products-grid'),
    filters: document.querySelector('#category-filters'),
    search: document.querySelector('#product-search'),
    sort: document.querySelector('#sort-products'),
    status: document.querySelector('#catalog-status'),
    empty: document.querySelector('#empty-state'),
    drawer: document.querySelector('#cart-drawer'),
    backdrop: document.querySelector('#drawer-backdrop'),
    cartItems: document.querySelector('#cart-items'),
    detail: document.querySelector('#product-detail'),
    modal: document.querySelector('#product-modal'),
    modalBackdrop: document.querySelector('#product-backdrop'),
    reviewViewer: document.querySelector('#review-viewer'),
    reviewViewerBackdrop: document.querySelector('#review-viewer-backdrop'),
    reviewViewerImage: document.querySelector('#review-viewer-image'),
    reviews: document.querySelector('#reviews-grid'),
    reviewsMore: document.querySelector('#reviews-more'),
    reviewsEmpty: document.querySelector('#reviews-empty'),
    toast: document.querySelector('#toast')
  };
  let products = [];
  let activeCategory = 'Todos';
  let toastTimer;
  let catalogLoadError = false;
  const reviewsPageSize = 3;
  let visibleReviews = reviewsPageSize;

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
  }

  function safeImage(value) {
    if (typeof value !== 'string' || !value.trim()) return '';
    try {
      const url = new URL(value, window.location.href);
      return ['https:', 'http:', 'file:'].includes(url.protocol) ? escapeHtml(url.href) : '';
    } catch {
      return '';
    }
  }

  function availableVariants(product) {
    const variants = Array.isArray(product.variantes) && product.variantes.length
      ? product.variantes
      : [{ cor: product.cor, comprimento: product.comprimento, disponivel: product.disponivel }];
    return product.disponivel ? variants.filter(variant => variant.disponivel && variant.cor && variant.comprimento) : [];
  }

  function isVideoSource(source) {
    try {
      return /\.(mp4|webm|ogg|mov|m4v)$/i.test(new URL(source, window.location.href).pathname);
    } catch {
      return false;
    }
  }

  function productMedia(product) {
    const images = Array.isArray(product.imagens) ? product.imagens : [];
    const videos = Array.isArray(product.videos) ? product.videos : [];
    return [
      ...images.map(source => ({ src: safeImage(source), type: isVideoSource(source) ? 'video' : 'image' })),
      ...videos.map(source => ({ src: safeImage(source), type: 'video' }))
    ].filter(media => media.src);
  }

  function renderProductMedia(media, productName, className) {
    if (media.type === 'video') {
      const playable = className === 'detail-image';
      return `<video class="${className}" data-main-media src="${media.src}" ${playable ? 'controls' : 'muted'} playsinline preload="metadata" aria-label="Vídeo de ${escapeHtml(productName)}"></video>`;
    }
    return `<img class="${className}" data-main-media src="${media.src}" alt="${escapeHtml(productName)}" loading="lazy" decoding="async">`;
  }

  function renderReviews(reviews) {
    const entries = Array.isArray(reviews) ? reviews.filter(review => review && typeof review.cliente === 'string') : [];
    visibleReviews = reviewsPageSize;
    elements.reviews.innerHTML = entries.map((review, index) => {
      const media = Array.isArray(review.media) ? review.media : [];
      const mediaMarkup = media.map(item => {
        const src = safeImage(item.src);
        if (!src) return '';
        return item.tipo === 'video'
          ? `<video class="review-media" src="${src}" controls preload="metadata" aria-label="Vídeo da avaliação de ${escapeHtml(review.cliente)}"></video>`
          : `<button class="review-media-trigger" type="button" data-review-image="${src}" data-review-alt="Fotografia partilhada por ${escapeHtml(review.cliente)}" aria-label="Ampliar fotografia da avaliação"><img class="review-media" src="${src}" alt="Fotografia partilhada por ${escapeHtml(review.cliente)}" loading="lazy" decoding="async"></button>`;
      }).join('');
      return `<article class="review-card" ${index >= visibleReviews ? 'hidden' : ''}>
        ${mediaMarkup ? `<div class="review-media-grid">${mediaMarkup}</div>` : ''}
        <div class="review-copy">${review.texto ? `<p class="review-quote">“${escapeHtml(review.texto)}”</p>` : ''}
          <p class="review-customer">${escapeHtml(review.cliente)}</p>
          ${review.produto ? `<p class="review-product">${escapeHtml(review.produto)}</p>` : ''}
          ${review.data ? `<p class="review-date">${escapeHtml(review.data)}</p>` : ''}
        </div>
      </article>`;
    }).join('');
    elements.reviewsEmpty.hidden = entries.length > 0;
    elements.reviewsMore.dataset.total = String(entries.length);
    elements.reviewsMore.hidden = entries.length <= visibleReviews;
    if (!entries.length) elements.reviewsEmpty.textContent = 'Em breve, as primeiras avaliações das nossas clientes.';
  }

  function showMoreReviews() {
    visibleReviews += reviewsPageSize;
    elements.reviews.querySelectorAll('.review-card[hidden]').forEach((card, index) => {
      if (index < reviewsPageSize) card.hidden = false;
    });
    elements.reviewsMore.hidden = visibleReviews >= Number(elements.reviewsMore.dataset.total);
  }

  function showToast(message) {
    elements.toast.textContent = message;
    elements.toast.classList.add('show');
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => elements.toast.classList.remove('show'), 2500);
  }

  function getVisibleProducts() {
    const query = elements.search.value.trim().toLocaleLowerCase('pt-PT');
    const visible = products.filter(product => (activeCategory === 'Todos' || product.categoria === activeCategory)
      && `${product.nome} ${product.categoria} ${product.descricao} ${product.cor}`.toLocaleLowerCase('pt-PT').includes(query));
    if (elements.sort.value === 'price-asc') visible.sort((first, second) => first.preco - second.preco);
    if (elements.sort.value === 'price-desc') visible.sort((first, second) => second.preco - first.preco);
    return visible;
  }

  function renderFilters() {
    const categories = ['Todos', ...new Set(products.map(product => product.categoria))];
    elements.filters.innerHTML = categories.map(category => `<button class="filter-button${category === activeCategory ? ' active' : ''}" type="button" data-category="${escapeHtml(category)}" aria-pressed="${category === activeCategory}">${escapeHtml(category)}</button>`).join('');
  }

  function renderProducts() {
    const visible = getVisibleProducts();
    elements.grid.innerHTML = visible.map(product => {
      const media = productMedia(product);
      const preview = media.find(item => item.type === 'image') || media[0];
      const previewMarkup = preview ? renderProductMedia(preview, product.nome, '') : '';
      const inStock = availableVariants(product).length > 0;
      const stockBadge = inStock ? '' : '<span class="product-badge sold-out">Esgotado</span>';
      return `<article class="product-card">
        <div class="product-image"><button class="product-image-trigger" type="button" data-view="${product.id}" aria-label="Ver detalhes de ${escapeHtml(product.nome)}" aria-haspopup="dialog">${previewMarkup}</button>${stockBadge}</div>
        <div class="product-info"><h3>${escapeHtml(product.nome)}</h3><p class="product-category">${escapeHtml(product.categoria)} · ${escapeHtml(product.tipo)}</p>
          <p class="product-price">${money.format(product.preco)}</p>
        </div>
      </article>`;
    }).join('');
    elements.empty.hidden = visible.length > 0;
    if (catalogLoadError) {
      const message = 'Não conseguimos carregar a coleção atual. Estamos a apresentar uma seleção alternativa; fala connosco para confirmar os produtos disponíveis.';
      const href = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent("Olá! Não consigo consultar a coleção da Iracema's Beauty. Podem ajudar-me?")}`;
      elements.status.innerHTML = `${escapeHtml(message)} <a class="catalog-whatsapp-link" href="${href}" target="_blank" rel="noopener noreferrer">Falar connosco no WhatsApp ↗</a>`;
    } else {
      elements.status.textContent = `${visible.length} ${visible.length === 1 ? 'peça disponível' : 'peças na coleção'}`;
    }
  }

  function cartItems() {
    return window.StoreCart.getItems(products);
  }

  function renderCart() {
    const items = cartItems();
    const count = items.reduce((total, item) => total + item.quantity, 0);
    const subtotal = items.reduce((total, item) => total + item.preco * item.quantity, 0);
    document.querySelector('#cart-count').textContent = String(count);
    document.querySelector('#drawer-count').textContent = `(${count})`;
    document.querySelector('#cart-subtotal').textContent = money.format(subtotal);
    elements.cartItems.innerHTML = items.length ? items.map(item => {
      const media = productMedia(item);
      const preview = media.find(entry => entry.type === 'image') || media[0];
      return `<article class="cart-line">
      ${preview ? renderProductMedia(preview, item.nome, '') : ''}
      <div><h3>${escapeHtml(item.nome)}</h3><p>${escapeHtml(item.comprimento)} · ${escapeHtml(item.cor)}</p>
        <div class="quantity-control"><button type="button" data-quantity="${escapeHtml(item.cartKey)}" data-change="-1" aria-label="Diminuir quantidade">−</button><span>${item.quantity}</span><button type="button" data-quantity="${escapeHtml(item.cartKey)}" data-change="1" aria-label="Aumentar quantidade">+</button></div>
        <button class="remove-button" type="button" data-remove="${escapeHtml(item.cartKey)}">Remover</button></div>
      <span class="line-price">${money.format(item.preco * item.quantity)}</span>
    </article>`;
    }).join('') : '<p class="cart-empty">O carrinho está à espera da tua próxima peça.</p>';
  }

  function setDrawer(open) {
    elements.drawer.classList.toggle('open', open);
    elements.backdrop.classList.toggle('open', open);
    elements.drawer.setAttribute('aria-hidden', String(!open));
    document.body.classList.toggle('locked', open || elements.modal.classList.contains('open'));
  }

  function openProduct(id) {
    const product = products.find(item => item.id === id);
    if (!product) return;
    const variants = availableVariants(product);
    const colors = [...new Set(variants.map(variant => variant.cor))];
    const lengths = [...new Set(variants.map(variant => variant.comprimento))];
    const media = productMedia(product);
    const gallery = media.length > 1 ? `<div class="detail-thumbnails" aria-label="Imagens e vídeos de ${escapeHtml(product.nome)}">${media.map((item, index) =>
      `<button class="detail-thumbnail${index === 0 ? ' active' : ''}" type="button" data-gallery-media="${index}" aria-label="Ver ${item.type === 'video' ? 'vídeo' : 'imagem'} ${index + 1} de ${escapeHtml(product.nome)}" aria-pressed="${index === 0}">${item.type === 'video' ? `<video src="${item.src}" muted playsinline preload="metadata" aria-hidden="true"></video><span class="video-thumbnail-label" aria-hidden="true">▶</span>` : `<img src="${item.src}" alt="" loading="lazy">`}</button>`
    ).join('')}</div>` : '';
    elements.detail.innerHTML = `<div class="product-detail">
      <div class="detail-gallery">${media[0] ? renderProductMedia(media[0], product.nome, 'detail-image') : ''}${gallery}</div>
      <div class="detail-copy"><p class="eyebrow">${escapeHtml(product.categoria)} · <span class="brand-name">Iracema's Beauty</span></p><h2 id="detail-name">${escapeHtml(product.nome)}</h2>
        <p class="detail-price" aria-live="polite">${money.format(product.preco)}</p><p class="detail-description">${escapeHtml(product.descricao)}</p>
        <div class="detail-specs"><div><span>Tipo</span><strong>${escapeHtml(product.tipo)}</strong></div><div><span>Disponibilidade</span><strong>${variants.length ? 'Disponível' : 'Esgotado'}</strong></div></div>
        <div class="variant-fields">
          <label>Cor<select name="variant-color" required ${variants.length ? '' : 'disabled'}>${colors.map(color => `<option value="${escapeHtml(color)}" ${color === product.cor ? 'selected' : ''}>${escapeHtml(color)}</option>`).join('')}</select></label>
          <label>Tamanho<select name="variant-length" required ${variants.length ? '' : 'disabled'}>${lengths.map(length => `<option value="${escapeHtml(length)}" ${length === product.comprimento ? 'selected' : ''}>${escapeHtml(length)}</option>`).join('')}</select></label>
        </div>
        <p class="variant-availability" id="variant-availability" role="status"></p>
        <button class="button button-primary full-width" type="button" data-add="${product.id}" ${variants.length ? '' : 'disabled'}>${variants.length ? 'ADICIONAR AO CARRINHO' : 'ESGOTADO'} <span aria-hidden="true">↗</span></button>
      </div></div>`;
    updateVariantAvailability(product);
    elements.modal.classList.add('open');
    elements.modalBackdrop.classList.add('open');
    elements.modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('locked');
  }

  function updateVariantAvailability(product) {
    const colorSelect = elements.detail.querySelector('[name="variant-color"]');
    const lengthSelect = elements.detail.querySelector('[name="variant-length"]');
    const availability = elements.detail.querySelector('#variant-availability');
    const addButton = elements.detail.querySelector('[data-add]');
    if (!colorSelect || !lengthSelect || !availability || !addButton) return;
    const variant = availableVariants(product).find(item => item.cor === colorSelect.value && item.comprimento === lengthSelect.value);
    const priceElement = elements.detail.querySelector('.detail-price');
    priceElement.textContent = variant
      ? money.format(Number.isFinite(variant.preco) ? variant.preco : product.preco)
      : '—';
    availability.textContent = variant ? 'Disponível para encomenda' : 'Esta combinação está esgotada.';
    addButton.disabled = !variant;
  }

  function closeProduct() {
    elements.modal.classList.remove('open');
    elements.modalBackdrop.classList.remove('open');
    elements.modal.setAttribute('aria-hidden', 'true');
    document.body.classList.toggle('locked', elements.drawer.classList.contains('open'));
  }

  function setReviewViewer(open, source = '', alt = '') {
    elements.reviewViewer.classList.toggle('open', open);
    elements.reviewViewerBackdrop.classList.toggle('open', open);
    elements.reviewViewer.setAttribute('aria-hidden', String(!open));
    if (open) {
      elements.reviewViewerImage.src = source;
      elements.reviewViewerImage.alt = alt;
      document.body.classList.add('locked');
    } else {
      elements.reviewViewerImage.removeAttribute('src');
      elements.reviewViewerImage.alt = '';
      document.body.classList.toggle('locked', elements.drawer.classList.contains('open') || elements.modal.classList.contains('open'));
    }
  }

  function sendOrder(event) {
    event.preventDefault();
    const items = cartItems();
    if (!items.length) {
      showToast('Adiciona primeiro uma peça ao carrinho.');
      return;
    }
    const form = new FormData(event.currentTarget);
    const name = String(form.get('name') || '').trim();
    const phone = String(form.get('phone') || '').trim();
    const birthday = String(form.get('birthday') || '').trim();
    if (!name || !phone) {
      event.currentTarget.reportValidity();
      return;
    }
    if (birthday) {
      const match = birthday.match(/^(\d{2})\/(\d{2})$/);
      const day = match && Number(match[1]);
      const month = match && Number(match[2]);
      const parsedDate = match && new Date(Date.UTC(2000, month - 1, day));
      if (!match || parsedDate.getUTCDate() !== day || parsedDate.getUTCMonth() !== month - 1) {
        const birthdayField = event.currentTarget.elements.namedItem('birthday');
        birthdayField.setCustomValidity('Introduz uma data válida no formato DD/MM.');
        birthdayField.reportValidity();
        birthdayField.setCustomValidity('');
        return;
      }
    }
    const subtotal = items.reduce((total, item) => total + item.preco * item.quantity, 0);
    const lines = items.map(item => `• ${item.nome} (${item.cor}, ${item.comprimento}) x${item.quantity} — ${money.format(item.preco * item.quantity)}`);
    const message = [
      "Olá! Gostaria de fazer este pedido na Iracema's Beauty:", '', ...lines, '',
      `Total: ${money.format(subtotal)}`, '', 'Dados para entrega:', `Nome: ${name}`, `Telefone: ${phone}`,
      birthday ? `Data de aniversário (dia/mês): ${birthday}` : '',
      form.get('address') ? `Morada: ${String(form.get('address')).trim()}` : '',
      form.get('locality') ? `Localidade: ${String(form.get('locality')).trim()}` : '',
      form.get('notes') ? `Observações: ${String(form.get('notes')).trim()}` : '', '',
      'Gostaria de combinar a entrega e o pagamento.'
    ].filter(Boolean).join('\n');
    window.open(`https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer');
    if (window.confirm('O WhatsApp foi aberto. Queres limpar o carrinho?')) {
      window.StoreCart.clear();
      renderCart();
      event.currentTarget.reset();
    }
  }

  async function loadProducts() {
    try {
      const response = await fetch('data/produtos.json');
      if (!response.ok) throw new Error('Não foi possível carregar o catálogo.');
      products = await response.json();
      if (!Array.isArray(products)) throw new Error('Formato de catálogo inválido.');
      catalogLoadError = false;
      elements.status.textContent = '';
    } catch {
      catalogLoadError = true;
      products = fallbackProducts;
    }
    products = products.filter(product => Number.isInteger(product.id) && typeof product.nome === 'string' && Number.isFinite(product.preco) && (Array.isArray(product.imagens) || Array.isArray(product.videos)));
    renderFilters();
    renderProducts();
    renderCart();
    try {
      const response = await fetch('data/avaliacoes.json');
      if (!response.ok) throw new Error('Não foi possível carregar as avaliações.');
      renderReviews(await response.json());
    } catch {
      elements.reviewsEmpty.hidden = false;
      elements.reviewsEmpty.textContent = 'As avaliações não estão disponíveis neste momento. Volta a consultar em breve.';
    }
  }

  document.addEventListener('click', event => {
    const target = event.target.closest('[data-action],[data-category],[data-add],[data-view],[data-quantity],[data-remove],[data-gallery-media],[data-review-image]');
    if (!target) return;
    if (target.dataset.reviewImage) {
      setReviewViewer(true, target.dataset.reviewImage, target.dataset.reviewAlt || '');
      return;
    }
    if (target.dataset.action === 'close-review-viewer') {
      setReviewViewer(false);
      return;
    }
    if (target.dataset.action === 'show-more-reviews') {
      showMoreReviews();
      return;
    }
    if (target.dataset.galleryMedia !== undefined) {
      const product = products.find(item => item.id === Number(elements.detail.querySelector('[data-add]')?.dataset.add));
      const selectedMedia = product && productMedia(product)[Number(target.dataset.galleryMedia)];
      const mainMedia = elements.detail.querySelector('[data-main-media]');
      if (selectedMedia && mainMedia && product) {
        mainMedia.outerHTML = renderProductMedia(selectedMedia, product.nome, 'detail-image');
        elements.detail.querySelectorAll('[data-gallery-media]').forEach(button => {
          const isActive = button === target;
          button.classList.toggle('active', isActive);
          button.setAttribute('aria-pressed', String(isActive));
        });
      }
      return;
    }
    if (target.dataset.action === 'open-cart') setDrawer(true);
    if (target.dataset.action === 'close-cart') setDrawer(false);
    if (target.dataset.action === 'close-product') closeProduct();
    if (target.dataset.category) {
      activeCategory = target.dataset.category;
      renderFilters();
      renderProducts();
    }
    if (target.dataset.view) openProduct(Number(target.dataset.view));
    if (target.dataset.add) {
      const product = products.find(item => item.id === Number(target.dataset.add));
      const variant = product && availableVariants(product).find(item =>
        item.cor === elements.detail.querySelector('[name="variant-color"]')?.value
        && item.comprimento === elements.detail.querySelector('[name="variant-length"]')?.value);
      if (window.StoreCart.add(product, variant)) {
        renderCart();
        showToast(`${product.nome} (${variant.cor}, ${variant.comprimento}) foi adicionado ao carrinho.`);
        if (target.closest('.product-modal')) closeProduct();
      } else {
        showToast('Esta combinação de cor e tamanho não está disponível.');
      }
    }
    if (target.dataset.quantity) {
      window.StoreCart.changeQuantity(target.dataset.quantity, Number(target.dataset.change), products);
      renderCart();
    }
    if (target.dataset.remove) {
      window.StoreCart.remove(target.dataset.remove);
      renderCart();
    }
  });

  elements.detail.addEventListener('change', event => {
    if (!event.target.matches('[name="variant-color"], [name="variant-length"]')) return;
    const productId = Number(elements.detail.querySelector('[data-add]')?.dataset.add);
    const product = products.find(item => item.id === productId);
    if (product) updateVariantAvailability(product);
  });

  elements.search.addEventListener('input', renderProducts);
  elements.sort.addEventListener('change', renderProducts);
  document.querySelector('#order-form').addEventListener('submit', sendOrder);
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      setDrawer(false);
      closeProduct();
      setReviewViewer(false);
    }
  });
  window.addEventListener('storage', event => {
    if (event.key === 'iracemas-beauty-cart') {
      window.StoreCart.sync();
      renderCart();
    }
  });
  document.querySelector('#year').textContent = String(new Date().getFullYear());
  loadProducts();
})();
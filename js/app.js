/* Catálogo, carrinho, detalhe de produto e pedido por WhatsApp. */
(() => {
  const WHATSAPP_NUMBER = '351932247277';
  const currency = new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' });
  const cartStorageKey = 'iracemas-beauty-cart';
  const reviewsPageSize = 3;
  const elements = {
    grid: document.querySelector('#products-grid'),
    filters: document.querySelector('#category-filters'),
    search: document.querySelector('#product-search'),
    sort: document.querySelector('#sort-products'),
    status: document.querySelector('#catalog-status'),
    skeleton: document.querySelector('#skeleton-grid'),
    catalogError: document.querySelector('#catalog-error'),
    empty: document.querySelector('#empty-state'),
    drawer: document.querySelector('#cart-drawer'),
    drawerBackdrop: document.querySelector('#drawer-backdrop'),
    cartItems: document.querySelector('#cart-items'),
    detail: document.querySelector('#product-detail'),
    productModal: document.querySelector('#product-modal'),
    privacyModal: document.querySelector('#privacy-modal'),
    lightbox: document.querySelector('#lightbox-modal'),
    lightboxImage: document.querySelector('#lightbox-image'),
    reviewsSection: document.querySelector('#avaliacoes'),
    reviews: document.querySelector('#reviews-grid'),
    reviewsMore: document.querySelector('#reviews-more'),
    gallery: document.querySelector('#client-gallery-grid'),
    toast: document.querySelector('#toast'),
    orderForm: document.querySelector('#order-form'),
    formError: document.querySelector('#form-error')
  };
  let products = [];
  let activeCategory = 'Todas';
  let visibleReviews = reviewsPageSize;
  let toastTimer;
  let returnFocusElement = null;
  let storageWarningShown = false;

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, character => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[character]);
  }

  function safeImage(value) {
    if (typeof value !== 'string' || !value.trim()) return '';
    try {
      const url = new URL(value, window.location.href);
      return ['https:', 'http:', 'file:'].includes(url.protocol) ? escapeHtml(url.href) : '';
    } catch (error) {
      return '';
    }
  }

  function materialName(product) {
    return /sint[eé]t/i.test(product.tipo || '') ? 'Sintético' : 'Natural';
  }

  function textureName(product) {
    return String(product.textura || product.nome || 'Outra').trim();
  }

  function productVariants(product) {
    return Array.isArray(product.variantes) && product.variantes.length
      ? product.variantes
      : [{ cor: product.cor || 'Natural', comprimento: product.comprimento || 'Único', disponivel: product.disponivel, preco: product.preco }];
  }

  function availableVariants(product) {
    return product.disponivel === false ? [] : productVariants(product).filter(variant => variant.disponivel !== false);
  }

  function productStartingPrice(product) {
    const variants = availableVariants(product);
    const prices = (variants.length ? variants : productVariants(product)).map(variant =>
      Number.isFinite(variant.preco) ? variant.preco : product.preco
    );
    return prices.length ? Math.min(...prices) : product.preco;
  }

  function productLength(product) {
    const firstVariant = availableVariants(product)[0] || productVariants(product)[0];
    return product.comprimento || firstVariant && firstVariant.comprimento || 'Comprimento sob consulta';
  }

  function isVideoSource(source) {
    try {
      return /\.(mp4|webm|ogg|mov|m4v)$/i.test(new URL(source, window.location.href).pathname);
    } catch (error) {
      return false;
    }
  }

  function productMedia(product) {
    const images = Array.isArray(product.imagens) ? product.imagens : [];
    const videos = Array.isArray(product.videos) ? product.videos.filter(Boolean) : [];
    return [
      ...images.map(source => ({ src: safeImage(source), type: isVideoSource(source) ? 'video' : 'image' })),
      ...videos.map(source => ({ src: safeImage(source), type: 'video' }))
    ].filter(media => media.src);
  }

  function mediaMarkup(media, alt, className = '') {
    if (!media) return '';
    if (media.type === 'video') {
      return `<video class="${className}" data-main-media src="${media.src}" controls playsinline preload="metadata" aria-label="Vídeo de ${escapeHtml(alt)}"></video>`;
    }
    return `<img class="${className}" data-main-media src="${media.src}" alt="${escapeHtml(alt)}" width="600" height="760" loading="lazy" decoding="async">`;
  }

  function setWhatsAppLinks(root = document) {
    root.querySelectorAll('[data-whatsapp]').forEach(link => {
      const message = link.dataset.message || "Olá! Gostaria de falar com a Iracema's Beauty.";
      link.href = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
    });
  }

  function setWhatsAppNumberDisplay() {
    const nationalPrefix = WHATSAPP_NUMBER.slice(0, 3);
    const firstDigits = WHATSAPP_NUMBER.slice(3, 6);
    const middleDigits = WHATSAPP_NUMBER.slice(6, 9);
    const lastDigits = WHATSAPP_NUMBER.slice(9);
    document.querySelector('#whatsapp-number').textContent = `+${nationalPrefix} ${firstDigits} ${middleDigits} ${lastDigits}`;
  }

  function showToast(message) {
    elements.toast.textContent = message;
    elements.toast.classList.add('show');
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => elements.toast.classList.remove('show'), 3200);
  }

  function notifyStorageIssue() {
    if (!storageWarningShown && window.StoreCart.hasStorageError()) {
      storageWarningShown = true;
      showToast('O armazenamento do carrinho não está disponível. O carrinho ficará apenas nesta visita.');
    }
  }

  function updateCartCount(count) {
    document.querySelector('#cart-count').textContent = String(count);
    document.querySelectorAll('[data-action="open-cart"]').forEach(button => {
      button.setAttribute('aria-label', `Abrir carrinho, ${count} ${count === 1 ? 'artigo' : 'artigos'}`);
    });
  }

  function renderFilters() {
    const categories = ['Todas', ...new Set(products.map(product => product.categoria).filter(Boolean))];
    if (!categories.includes(activeCategory)) activeCategory = 'Todas';
    elements.filters.innerHTML = categories.map(category =>
      `<button class="filter-button${category === activeCategory ? ' active' : ''}" type="button" data-category="${escapeHtml(category)}" aria-pressed="${category === activeCategory}">${escapeHtml(category)}</button>`
    ).join('');
  }

  function getVisibleProducts() {
    const query = elements.search.value.trim().toLocaleLowerCase('pt-PT');
    const visible = products.filter(product => {
      const matchesCategory = activeCategory === 'Todas' || product.categoria === activeCategory;
      const searchable = `${product.nome} ${product.categoria || ''} ${product.tipo || ''} ${product.descricao || ''} ${product.cor || ''} ${textureName(product)}`.toLocaleLowerCase('pt-PT');
      return matchesCategory && searchable.includes(query);
    });
    if (elements.sort.value === 'price-asc') visible.sort((first, second) => productStartingPrice(first) - productStartingPrice(second));
    if (elements.sort.value === 'price-desc') visible.sort((first, second) => productStartingPrice(second) - productStartingPrice(first));
    return visible;
  }

  function addProduct(product, variant, closeModal = false) {
    if (!window.StoreCart.add(product, variant)) {
      showToast('Esta combinação não está disponível ou atingiu a quantidade máxima.');
      return;
    }
    renderCart();
    showToast(`${product.nome} foi adicionado ao carrinho.`);
    if (closeModal) closeProduct();
  }

  function renderProducts() {
    const visible = getVisibleProducts();
    elements.grid.innerHTML = visible.map(product => {
      const media = productMedia(product);
      const preview = media.find(item => item.type === 'image') || media[0];
      const available = availableVariants(product);
      const labels = Array.isArray(product.etiquetas) ? product.etiquetas.filter(Boolean) : [];
      const badges = [...labels, ...(available.length ? [] : ['Esgotado'])].map(label =>
        `<span class="product-badge${label === 'Esgotado' ? ' sold-out' : ''}">${escapeHtml(label)}</span>`
      ).join('');
      const firstVariant = available[0];
      const type = product.categoria ? `${escapeHtml(product.categoria)} · ` : '';
      return `<article class="product-card">
        <div class="product-image">
          <button class="product-image-trigger" type="button" data-view="${product.id}" aria-label="Ver detalhes de ${escapeHtml(product.nome)}" aria-haspopup="dialog">
            ${preview ? mediaMarkup(preview, product.nome) : ''}
          </button>
          ${badges ? `<div class="product-badges">${badges}</div>` : ''}
        </div>
        <div class="product-info">
          <h3>${escapeHtml(product.nome)}</h3>
          <p class="product-meta">${type}${escapeHtml(materialName(product))} · ${escapeHtml(productLength(product))} · ${escapeHtml(textureName(product))}</p>
          <div class="product-bottom">
            <span class="product-price">${available.length > 1 ? 'Desde ' : ''}${currency.format(productStartingPrice(product))}</span>
            <button class="add-button" type="button" data-quick-add="${product.id}" ${firstVariant ? '' : 'disabled'} aria-label="Adicionar ${escapeHtml(product.nome)} ao carrinho">Adicionar ao carrinho</button>
          </div>
        </div>
      </article>`;
    }).join('');
    elements.empty.hidden = visible.length > 0;
    elements.catalogError.hidden = true;
    elements.skeleton.hidden = true;
    elements.status.textContent = `${visible.length} ${visible.length === 1 ? 'peça encontrada' : 'peças encontradas'}`;
  }

  function cartItems() {
    return window.StoreCart.getItems(products);
  }

  function renderCart() {
    const items = cartItems();
    const count = items.reduce((total, item) => total + item.quantity, 0);
    const subtotal = items.reduce((total, item) => total + item.preco * item.quantity, 0);
    updateCartCount(count);
    document.querySelector('#drawer-count').textContent = `(${count})`;
    document.querySelector('#cart-subtotal').textContent = currency.format(subtotal);
    elements.cartItems.innerHTML = items.length ? items.map(item => {
      const media = productMedia(item).find(entry => entry.type === 'image');
      return `<article class="cart-line">
        ${media ? mediaMarkup(media, item.nome) : ''}
        <div><h3>${escapeHtml(item.nome)}</h3><p>${escapeHtml(item.comprimento || '')} · ${escapeHtml(item.cor || '')}</p>
          <div class="quantity-control"><button type="button" data-quantity="${escapeHtml(item.cartKey)}" data-change="-1" aria-label="Diminuir quantidade de ${escapeHtml(item.nome)}">−</button><span>${item.quantity}</span><button type="button" data-quantity="${escapeHtml(item.cartKey)}" data-change="1" aria-label="Aumentar quantidade de ${escapeHtml(item.nome)}">+</button></div>
          <button class="remove-button" type="button" data-remove="${escapeHtml(item.cartKey)}" aria-label="Remover ${escapeHtml(item.nome)} do carrinho">Remover</button></div>
        <span class="line-price">${currency.format(item.preco * item.quantity)}</span>
      </article>`;
    }).join('') : '<p class="cart-empty">O carrinho está à espera da tua próxima peça.</p>';
    notifyStorageIssue();
  }

  function setDrawer(open) {
    elements.drawer.classList.toggle('open', open);
    elements.drawerBackdrop.classList.toggle('open', open);
    elements.drawer.setAttribute('aria-hidden', String(!open));
    elements.drawer.setAttribute('aria-modal', String(open));
    document.body.classList.toggle('locked', open || elements.productModal.open || elements.privacyModal.open || elements.lightbox.open);
    if (open) {
      returnFocusElement = document.activeElement;
      elements.drawer.querySelector('[data-action="close-cart"]').focus();
    } else if (returnFocusElement && typeof returnFocusElement.focus === 'function') {
      returnFocusElement.focus();
    }
  }

  function openProduct(id) {
    const product = products.find(item => item.id === id);
    if (!product) return;
    returnFocusElement = document.activeElement;
    const variants = productVariants(product);
    const available = availableVariants(product);
    const colors = [...new Set(variants.map(variant => variant.cor).filter(Boolean))];
    const lengths = [...new Set(variants.map(variant => variant.comprimento).filter(Boolean))];
    const media = productMedia(product);
    const gallery = media.length > 1 ? `<div class="detail-thumbnails" aria-label="Fotografias de ${escapeHtml(product.nome)}">${media.map((item, index) =>
      `<button class="detail-thumbnail${index === 0 ? ' active' : ''}" type="button" data-gallery-media="${index}" aria-label="Ver ${item.type === 'video' ? 'vídeo' : 'fotografia'} ${index + 1} de ${escapeHtml(product.nome)}" aria-pressed="${index === 0}">${item.type === 'video' ? `<video src="${item.src}" muted playsinline preload="metadata" aria-hidden="true"></video>` : `<img src="${item.src}" alt="" width="68" height="82" loading="lazy" decoding="async">`}</button>`
    ).join('')}</div>` : '';
    const firstAvailable = available[0];
    elements.detail.innerHTML = `<div class="product-detail">
      <div class="detail-gallery">${media[0] ? mediaMarkup(media[0], product.nome, 'detail-image') : ''}${gallery}</div>
      <div class="detail-copy">
        <p class="eyebrow">${escapeHtml(product.categoria || 'Coleção')} · <span class="brand-name">Iracema's Beauty</span></p>
        <h2 id="detail-name">${escapeHtml(product.nome)}</h2>
        <p class="detail-price" aria-live="polite">${currency.format(firstAvailable && Number.isFinite(firstAvailable.preco) ? firstAvailable.preco : product.preco)}</p>
        <p class="detail-description">${escapeHtml(product.descricao || 'Contacta-nos para saber mais sobre esta peça.')}</p>
        <div class="detail-specs">
          <div><span>Material</span><strong>${escapeHtml(materialName(product))}</strong></div>
          <div><span>Textura</span><strong>${escapeHtml(textureName(product))}</strong></div>
          <div><span>Comprimento</span><strong>${escapeHtml(productLength(product))}</strong></div>
          <div><span>Disponibilidade</span><strong>${available.length ? 'Disponível' : 'Esgotado'}</strong></div>
        </div>
        <div class="variant-fields">
          <label>Cor<select name="variant-color" ${available.length ? '' : 'disabled'}>${colors.map(color => `<option value="${escapeHtml(color)}" ${firstAvailable && color === firstAvailable.cor ? 'selected' : ''}>${escapeHtml(color)}</option>`).join('')}</select></label>
          <label>Tamanho<select name="variant-length" ${available.length ? '' : 'disabled'}>${lengths.map(length => `<option value="${escapeHtml(length)}" ${firstAvailable && length === firstAvailable.comprimento ? 'selected' : ''}>${escapeHtml(length)}</option>`).join('')}</select></label>
        </div>
        <p class="variant-availability" id="variant-availability" role="status"></p>
        <button class="button button-primary full-width" type="button" data-add="${product.id}" ${available.length ? '' : 'disabled'}>${available.length ? 'Adicionar ao carrinho' : 'Esgotado'} <span aria-hidden="true">↗</span></button>
      </div>
    </div>`;
    updateVariantAvailability(product);
    elements.productModal.showModal();
    document.body.classList.add('locked');
    elements.productModal.querySelector('[data-action="close-product"]').focus();
  }

  function updateVariantAvailability(product) {
    const colorSelect = elements.detail.querySelector('[name="variant-color"]');
    const lengthSelect = elements.detail.querySelector('[name="variant-length"]');
    const availability = elements.detail.querySelector('#variant-availability');
    const addButton = elements.detail.querySelector('[data-add]');
    if (!colorSelect || !lengthSelect || !availability || !addButton) return;
    const variant = availableVariants(product).find(item => item.cor === colorSelect.value && item.comprimento === lengthSelect.value);
    const priceElement = elements.detail.querySelector('.detail-price');
    priceElement.textContent = variant ? currency.format(Number.isFinite(variant.preco) ? variant.preco : product.preco) : '—';
    availability.textContent = variant ? 'Disponível para encomenda' : 'Esta combinação está esgotada.';
    addButton.disabled = !variant;
  }

  function closeProduct() {
    if (elements.productModal.open) elements.productModal.close();
  }

  function openLightbox(source, alt) {
    elements.lightboxImage.src = source;
    elements.lightboxImage.alt = alt;
    elements.lightbox.showModal();
  }

  function closeLightbox() {
    if (elements.lightbox.open) elements.lightbox.close();
  }

  function renderGallery(reviews) {
    const photos = Array.isArray(reviews) ? reviews.flatMap(review =>
      Array.isArray(review.media) ? review.media.filter(item => item.tipo !== 'video' && safeImage(item.src)).map(item => ({
        src: safeImage(item.src),
        alt: `Fotografia partilhada por cliente da Iracema's Beauty`
      })) : []
    ) : [];
    elements.gallery.innerHTML = photos.length ? photos.map((photo, index) =>
      `<button class="client-photo-button" type="button" data-gallery-image="${photo.src}" data-gallery-alt="${escapeHtml(photo.alt)}" aria-label="Ampliar fotografia ${index + 1} de cliente"><img src="${photo.src}" alt="${escapeHtml(photo.alt)}" width="480" height="480" loading="lazy" decoding="async"></button>`
    ).join('') : '<p class="client-gallery-empty">Em breve, partilhamos aqui momentos da nossa comunidade.</p>';
  }

  function renderReviews(reviews) {
    const entries = Array.isArray(reviews)
      ? reviews.filter(review => review && typeof review.texto === 'string' && review.texto.trim() && typeof review.cliente === 'string')
      : [];
    visibleReviews = reviewsPageSize;
    elements.reviews.innerHTML = entries.map((review, index) => {
      const media = Array.isArray(review.media) ? review.media : [];
      const mediaMarkup = media.map(item => {
        const src = safeImage(item.src);
        if (!src) return '';
        return item.tipo === 'video'
          ? `<video class="review-media" src="${src}" controls playsinline preload="metadata" aria-label="Vídeo da avaliação de ${escapeHtml(review.cliente)}"></video>`
          : `<button class="review-media-trigger" type="button" data-gallery-image="${src}" data-gallery-alt="Fotografia partilhada por ${escapeHtml(review.cliente)}" aria-label="Ampliar fotografia da avaliação"><img class="review-media" src="${src}" alt="Fotografia partilhada por ${escapeHtml(review.cliente)}" width="480" height="360" loading="lazy" decoding="async"></button>`;
      }).join('');
      return `<article class="review-card" ${index >= visibleReviews ? 'hidden' : ''}>
        ${mediaMarkup ? `<div class="review-media-grid">${mediaMarkup}</div>` : ''}
        <div class="review-copy"><p class="review-quote">“${escapeHtml(review.texto)}”</p>
          <p class="review-customer">${escapeHtml(review.cliente)}</p>
          ${review.produto ? `<p class="review-product">${escapeHtml(review.produto)}</p>` : ''}
          ${review.data ? `<p class="review-date">${escapeHtml(review.data)}</p>` : ''}
        </div>
      </article>`;
    }).join('');
    const hasTestimonials = entries.length > 0;
    elements.reviewsSection.hidden = !hasTestimonials;
    elements.reviewsMore.hidden = entries.length <= visibleReviews;
    elements.reviewsMore.dataset.total = String(entries.length);
  }

  function showMoreReviews() {
    const previous = visibleReviews;
    visibleReviews += reviewsPageSize;
    [...elements.reviews.querySelectorAll('.review-card[hidden]')].slice(0, visibleReviews - previous).forEach(card => { card.hidden = false; });
    elements.reviewsMore.hidden = visibleReviews >= Number(elements.reviewsMore.dataset.total);
  }

  function setFieldError(name, message) {
    const field = elements.orderForm.elements.namedItem(name);
    const output = document.querySelector(`#${name}-error`);
    if (output) output.textContent = message;
    if (field && field.setAttribute) field.setAttribute('aria-invalid', String(Boolean(message)));
  }

  function validBirthday(value) {
    const match = value.match(/^(\d{2})\/(\d{2})$/);
    if (!match) return false;
    const day = Number(match[1]);
    const month = Number(match[2]);
    const date = new Date(Date.UTC(2000, month - 1, day));
    return date.getUTCDate() === day && date.getUTCMonth() === month - 1;
  }

  function sendOrder(event) {
    event.preventDefault();
    elements.formError.hidden = true;
    elements.formError.textContent = '';
    ['name', 'phone', 'birthday'].forEach(name => setFieldError(name, ''));
    const items = cartItems();
    if (!items.length) {
      showToast('Adiciona primeiro uma peça ao carrinho.');
      return;
    }
    const formData = new FormData(elements.orderForm);
    const name = String(formData.get('name') || '').trim();
    const phone = String(formData.get('phone') || '').trim();
    const phoneDigits = phone.replace(/\D/g, '');
    const birthday = String(formData.get('birthday') || '').trim();
    const birthdayConsent = formData.has('birthdayConsent');
    let firstInvalidField = null;

    if (name.length < 2) {
      setFieldError('name', 'Indica o teu nome (pelo menos 2 caracteres).');
      firstInvalidField = elements.orderForm.elements.namedItem('name');
    }
    if (phoneDigits.length < 7) {
      setFieldError('phone', 'Indica um telefone válido com pelo menos 7 algarismos.');
      firstInvalidField ||= elements.orderForm.elements.namedItem('phone');
    }
    if (birthday && !validBirthday(birthday)) {
      setFieldError('birthday', 'Introduz uma data válida no formato DD/MM.');
      firstInvalidField ||= elements.orderForm.elements.namedItem('birthday');
    } else if (birthday && !birthdayConsent) {
      setFieldError('birthday', 'Assinala o consentimento para receber o benefício de aniversário.');
      firstInvalidField ||= elements.orderForm.elements.namedItem('birthdayConsent');
    }
    if (firstInvalidField) {
      firstInvalidField.focus();
      elements.formError.textContent = 'Corrige os campos assinalados antes de enviar o pedido.';
      elements.formError.hidden = false;
      return;
    }

    const subtotal = items.reduce((total, item) => total + item.preco * item.quantity, 0);
    const lines = items.map(item => `• ${item.nome} (${item.cor}, ${item.comprimento}) x${item.quantity} — ${currency.format(item.preco * item.quantity)}`);
    const optional = [
      birthday && birthdayConsent ? `Data de aniversário (dia/mês): ${birthday}` : '',
      formData.get('address') ? `Morada: ${String(formData.get('address')).trim()}` : '',
      formData.get('locality') ? `Localidade: ${String(formData.get('locality')).trim()}` : '',
      formData.get('notes') ? `Observações: ${String(formData.get('notes')).trim()}` : ''
    ];
    const message = [
      "Olá! Gostaria de fazer este pedido na Iracema's Beauty:", '',
      ...lines, '', `Subtotal: ${currency.format(subtotal)}`, '', 'Dados para o pedido:',
      `Nome: ${name}`, `Telefone: ${phone}`, ...optional.filter(Boolean), '',
      'Gostaria de combinar a entrega pelos CTT e o pagamento.'
    ].join('\n');
    const whatsappWindow = window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`, '_blank');
    if (!whatsappWindow) {
      showToast('Não foi possível abrir o WhatsApp. Permite janelas de pop-up e tenta novamente.');
      return;
    }
    whatsappWindow.opener = null;
    if (window.confirm('O WhatsApp foi aberto com o teu pedido. Queres limpar o carrinho?')) {
      window.StoreCart.clear();
      renderCart();
      elements.orderForm.reset();
    }
  }

  function showCatalogError() {
    elements.skeleton.hidden = true;
    elements.grid.innerHTML = '';
    elements.catalogError.hidden = false;
    elements.status.textContent = 'A coleção não está disponível neste momento.';
    elements.empty.hidden = true;
    setWhatsAppLinks(elements.catalogError);
  }

  async function loadProducts() {
    try {
      const response = await fetch('data/produtos.json');
      if (!response.ok) throw new Error(`O catálogo respondeu com o estado ${response.status}.`);
      const loadedProducts = await response.json();
      if (!Array.isArray(loadedProducts)) throw new Error('O catálogo não tem um formato válido.');
      products = loadedProducts.filter(product => Number.isInteger(product.id)
        && typeof product.nome === 'string'
        && Number.isFinite(product.preco)
        && (Array.isArray(product.imagens) || Array.isArray(product.videos)));
      if (!products.length) throw new Error('O catálogo não contém produtos válidos.');
      renderFilters();
      renderProducts();
      renderCart();
    } catch (error) {
      showCatalogError();
      console.error('Não foi possível carregar a coleção.', error);
    }

    try {
      const response = await fetch('data/avaliacoes.json');
      if (!response.ok) throw new Error(`As avaliações responderam com o estado ${response.status}.`);
      const reviews = await response.json();
      renderGallery(reviews);
      renderReviews(reviews);
    } catch (error) {
      renderGallery([]);
      renderReviews([]);
      console.error('Não foi possível carregar a galeria de clientes.', error);
    }
  }

  document.addEventListener('click', event => {
    const target = event.target.closest('[data-action],[data-category],[data-add],[data-quick-add],[data-view],[data-quantity],[data-remove],[data-gallery-media],[data-gallery-image]');
    if (!target) return;
    if (target.dataset.galleryImage) {
      openLightbox(target.dataset.galleryImage, target.dataset.galleryAlt || "Fotografia de uma cliente Iracema's Beauty");
      return;
    }
    if (target.dataset.galleryMedia !== undefined) {
      const productId = Number(elements.detail.querySelector('[data-add]')?.dataset.add);
      const product = products.find(item => item.id === productId);
      const selectedMedia = product && productMedia(product)[Number(target.dataset.galleryMedia)];
      const mainMedia = elements.detail.querySelector('[data-main-media]');
      if (selectedMedia && mainMedia && product) {
        mainMedia.outerHTML = mediaMarkup(selectedMedia, product.nome, 'detail-image');
        elements.detail.querySelectorAll('[data-gallery-media]').forEach(button => {
          const isActive = button === target;
          button.classList.toggle('active', isActive);
          button.setAttribute('aria-pressed', String(isActive));
        });
      }
      return;
    }
    if (target.dataset.action === 'open-cart') { setDrawer(true); return; }
    if (target.dataset.action === 'close-cart') { setDrawer(false); return; }
    if (target.dataset.action === 'close-product') { closeProduct(); return; }
    if (target.dataset.action === 'open-privacy') {
      returnFocusElement = document.activeElement;
      elements.privacyModal.showModal();
      document.body.classList.add('locked');
      elements.privacyModal.querySelector('[data-action="close-privacy"]').focus();
      return;
    }
    if (target.dataset.action === 'close-privacy') { elements.privacyModal.close(); return; }
    if (target.dataset.action === 'close-lightbox') { closeLightbox(); return; }
    if (target.dataset.action === 'show-more-reviews') { showMoreReviews(); return; }
    if (target.dataset.category) {
      activeCategory = target.dataset.category;
      renderFilters();
      renderProducts();
      return;
    }
    if (target.dataset.view) { openProduct(Number(target.dataset.view)); return; }
    if (target.dataset.quickAdd) {
      const product = products.find(item => item.id === Number(target.dataset.quickAdd));
      const variant = product && availableVariants(product)[0];
      if (product && variant) addProduct(product, variant);
      return;
    }
    if (target.dataset.add) {
      const product = products.find(item => item.id === Number(target.dataset.add));
      const variant = product && availableVariants(product).find(item =>
        item.cor === elements.detail.querySelector('[name="variant-color"]')?.value
        && item.comprimento === elements.detail.querySelector('[name="variant-length"]')?.value);
      if (product && variant) addProduct(product, variant, true);
      return;
    }
    if (target.dataset.quantity) {
      window.StoreCart.changeQuantity(target.dataset.quantity, Number(target.dataset.change), products);
      renderCart();
      return;
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
  elements.orderForm.addEventListener('submit', sendOrder);
  elements.orderForm.addEventListener('input', event => {
    const name = event.target.name;
    if (name === 'birthday') {
      const digits = event.target.value.replace(/\D/g, '').slice(0, 4);
      event.target.value = digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits;
    }
    if (['name', 'phone', 'birthday'].includes(name)) setFieldError(name, '');
    if (!elements.orderForm.querySelector('.field-error:not(:empty)')) {
      elements.formError.hidden = true;
      elements.formError.textContent = '';
    }
  });

  elements.drawer.addEventListener('keydown', event => {
    if (event.key !== 'Tab') return;
    const focusable = [...elements.drawer.querySelectorAll('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href]')];
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && elements.drawer.classList.contains('open')) setDrawer(false);
  });

  [elements.productModal, elements.privacyModal, elements.lightbox].forEach(dialog => {
    dialog.addEventListener('close', () => {
      document.body.classList.toggle('locked', elements.drawer.classList.contains('open') || elements.productModal.open || elements.privacyModal.open || elements.lightbox.open);
      if (returnFocusElement && typeof returnFocusElement.focus === 'function' && !elements.drawer.classList.contains('open')) returnFocusElement.focus();
    });
    dialog.addEventListener('click', event => {
      if (event.target === dialog) dialog.close();
    });
  });
  elements.drawerBackdrop.addEventListener('click', () => setDrawer(false));
  window.addEventListener('storage', event => {
    if (event.key === cartStorageKey) {
      window.StoreCart.sync();
      renderCart();
    }
  });
  window.addEventListener('cart-storage-error', () => notifyStorageIssue());

  setWhatsAppLinks();
  setWhatsAppNumberDisplay();
  document.querySelector('#year').textContent = String(new Date().getFullYear());
  document.querySelectorAll('.collection, .how-to, .brand-section, .reviews-section, .buying-info').forEach(element => element.classList.add('reveal'));
  if ('IntersectionObserver' in window && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12 });
    document.querySelectorAll('.reveal').forEach(element => observer.observe(element));
  } else {
    document.querySelectorAll('.reveal').forEach(element => element.classList.add('is-visible'));
  }
  loadProducts();
})();

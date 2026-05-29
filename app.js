'use strict';
const STORAGE_KEYS = {
  CART:  'misrak_cart',
  THEME: 'misrak_theme',
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;


/* ---- MENU DATA ---- */

const MENU_ITEMS = [
  {
    id: 1,
    name: 'Yirgacheffe Grade 1 Green Coffee',
    category: 'green',
    price: 145.00,
    desc: 'Premium washed Ethiopian green beans with floral aroma and export-grade quality.',
    image:'images/greencoffeebeans.webp',
    popular: true,
  },

  {
    id: 2,
    name: 'Sidama Export Beans',
    category: 'green',
    price: 132.00,
    desc: 'Highland Arabica beans prepared for international roasting and distribution.',
    image:'images/green-coffee-beans-01.jpg',
    popular: true,
  },

  {
    id: 3,
    name: 'Harar Natural Coffee',
    category: 'green',
    price: 138.00,
    desc: 'Dry-processed Ethiopian coffee with winey notes and bold complexity.',
    image:'images/Raw-Green-Unprocessed-Coffee-Beans-Whole-5.jpg',
    popular: false,
  },

  {
    id: 4,
    name: 'Roasted Espresso Blend',
    category: 'roasted',
    price: 24.00,
    desc: 'Dark roasted espresso blend designed for cafés and hotels.',
    image:'images/rosted.jpg',
    popular: true,
  },

  {
    id: 5,
    name: 'Premium Filter Roast',
    category: 'roasted',
    price: 22.00,
    desc: 'Medium roast profile preserving Ethiopian floral sweetness.',
    image:'images/rosted2.webp',
    popular: false,
  },

  {
    id: 6,
    name: 'Bulk Commercial Supply',
    category: 'bulk',
    price: 850.00,
    desc: 'Large-volume coffee supply solution for wholesalers and retailers.',
    image:'images/large package.webp',
    popular: true,
  },

  {
    id: 7,
    name: 'Coffee Export Packaging',
    category: 'service',
    price: 120.00,
    desc: 'Professional export packaging with international shipping standards.',
   image:'images/packeage.jpg',
    popular: false,
  },

  {
    id: 8,
    name: 'Coffee Cleaning & Sorting',
    category: 'service',
    price: 95.00,
    desc: 'Advanced defect sorting and grading services.',
    image:'images/coffee-beans-after-cleaning.jpg',
    popular: false,
  },

  {
    id: 9,
    name: 'Washed Process Beans',
    category: 'green',
    price: 140.00,
    desc: 'Fully washed Arabica coffee processed for premium export markets.',
    image:'images/cleaning coffe.jpg',
    popular: true,
  },

  {
    id: 10,
    name: 'Natural Process Beans',
    category: 'green',
    price: 136.00,
    desc: 'Sun-dried natural coffee beans delivering fruity sweetness.',
    image:'images/high-angle-view-beans.jpg',
    popular: false,
  },

  {
    id: 11,
    name: 'Private Label Roasting',
    category: 'service',
    price: 180.00,
    desc: 'Custom roasting and branding solutions for cafés and coffee brands.',
    image:'images/how-to-roast-coffee.jpg',
    popular: false,
  },

  {
    id: 12,
    name: 'International Export Service',
    category: 'service',
    price: 250.00,
    desc: 'End-to-end export logistics and shipment handling.',
    image:'images/Exports-1mer3rn.jpg',
    popular: true,
  },
];

/** Lookup map for O(1) item access by id */
const MENU_MAP = new Map(MENU_ITEMS.map(item => [item.id, item]));


/* ════════════════════════════════════════════════════════════
   SECTION 1 — THEME SYSTEM
   ════════════════════════════════════════════════════════
 **/
const themeToggleBtn = document.getElementById('themeToggle');

/**
 * Apply a theme to the <html> element and persist to localStorage.
 * @param {'dark'|'light'} theme
  */
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem(STORAGE_KEYS.THEME, theme);
  themeToggleBtn.setAttribute('aria-label', `Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`);
}

/** Toggle between dark ↔ light */
function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'dark';
  applyTheme(current === 'dark' ? 'light' : 'dark');
}

/** Restore saved theme preference on page load */
function initTheme() {
  const saved = localStorage.getItem(STORAGE_KEYS.THEME);
  // Default to dark if nothing saved
  applyTheme(saved || 'dark');
}

themeToggleBtn.addEventListener('click', toggleTheme);
initTheme();


/* ════════════════════════════════════════════════════════════
   SECTION 2 — NAVBAR (scroll + active link + mobile menu)
   ════════════════════════════════════════════════════════════ */

const navbar      = document.getElementById('navbar');
const navLinks    = document.querySelectorAll('.nav-link');
const allSections = document.querySelectorAll('section[id]');
const hamburger   = document.getElementById('hamburger');
const mobileMenu  = document.getElementById('mobileMenu');

/** Darken navbar on scroll */
function handleNavScroll() {
  navbar.classList.toggle('scrolled', window.scrollY > 60);
}

/** Highlight the nav link matching the current visible section */
function updateActiveLink() {
  let current = '';
  allSections.forEach(section => {
    if (window.scrollY >= section.offsetTop - 130) {
      current = section.getAttribute('id');
    }
  });

  navLinks.forEach(link => {
    link.classList.toggle('active', link.getAttribute('href') === `#${current}`);
  });
}

window.addEventListener('scroll', () => {
  handleNavScroll();
  updateActiveLink();
}, { passive: true });

/** Mobile hamburger toggle */
hamburger.addEventListener('click', () => {
  const isOpen = mobileMenu.classList.toggle('open');
  hamburger.classList.toggle('open', isOpen);
  hamburger.setAttribute('aria-expanded', String(isOpen));
});

/** Close mobile menu when a link is clicked */
document.querySelectorAll('.mobile-nav-link').forEach(link => {
  link.addEventListener('click', () => {
    mobileMenu.classList.remove('open');
    hamburger.classList.remove('open');
    hamburger.setAttribute('aria-expanded', 'false');
  });
});

/* ════════════════════════════════════════════════════════════
   SECTION 3 — CART (localStorage + drawer + qty controls)
   ════════════════════════════════════════════════════════════ */

/** @type {Array<{id:number, name:string, price:number, qty:number, image:string}>} */
let cart = [];

/* ── Cart DOM refs ── */
const cartDrawer        = document.getElementById('cartDrawer');
const cartOverlay       = document.getElementById('cartOverlay');
const cartToggleBtn     = document.getElementById('cartToggle');
const closeCartBtn      = document.getElementById('closeCart');
const continueShoppingBtn = document.getElementById('continueShopping');
const cartItemsEl       = document.getElementById('cartItems');
const cartBadge         = document.getElementById('cartBadge');
const cartCount         = document.getElementById('cartCount');
const cartTotalAmountEl = document.getElementById('cartTotalAmount');
const checkoutBtn       = document.getElementById('checkoutBtn');


/* ── Persistence ── */

/**
 * Persist the current cart array to localStorage.
 */
function saveCart() {
  localStorage.setItem(STORAGE_KEYS.CART, JSON.stringify(cart));
}

/**
 * Restore cart from localStorage on page load.
 */
function loadCart() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.CART);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        cart = parsed;
      }
    }
  } catch {
    cart = [];
  }
}


/* ── Cart Mutations ── */

/**
 * Add an item to cart by product id, or increment qty if it exists.
 * @param {number} id
 */
function addToCart(id) {
  const item = MENU_MAP.get(id);
  if (!item) return;

  const existing = cart.find(c => c.id === id);

  if (existing) {
    existing.qty += 1;
  } else {
    cart.push({
      id:    item.id,
      name:  item.name,
      price: item.price,
      qty:   1,
      image: item.image,
    });
  }

  saveCart();
  updateCartUI();
  bumpBadge();
  showToast(`${item.name} added to cart`, 'success');
  openCartDrawer();
}

/**
 * Change the quantity of a cart item. Removes it if qty would go below 1.
 * @param {number} id
 * @param {1|-1} delta
 */
function changeQty(id, delta) {
  const existing = cart.find(c => c.id === id);
  if (!existing) return;

  existing.qty += delta;
  if (existing.qty < 1) {
    removeFromCart(id);
    return;
  }

  saveCart();
  updateCartUI();
}

/**
 * Remove an item from cart entirely.
 * @param {number} id
 */
function removeFromCart(id) {
  cart = cart.filter(item => item.id !== id);
  saveCart();
  updateCartUI();
}


/* ── Cart Rendering ── */

/**
 * Re-render the entire cart UI: items, badge, totals.
 */
function updateCartUI() {
  const total     = cart.reduce((sum, item) => sum + item.price * item.qty, 0);
  const itemCount = cart.reduce((sum, item) => sum + item.qty, 0);

  // Badge
  if (itemCount > 0) {
    cartBadge.textContent = itemCount > 99 ? '99+' : String(itemCount);
    cartBadge.classList.add('visible');
    cartBadge.setAttribute('aria-label', `${itemCount} items in cart`);
  } else {
    cartBadge.classList.remove('visible');
    cartBadge.setAttribute('aria-label', '0 items in cart');
  }

  // Count label inside drawer
  cartCount.textContent = `${itemCount} ${itemCount === 1 ? 'item' : 'items'}`;

  // Total
  cartTotalAmountEl.textContent = `$${total.toFixed(2)}`;

  // Items
  if (cart.length === 0) {
    cartItemsEl.innerHTML = `
      <div class="cart-empty-state">
        <i class="fa-solid fa-bag-shopping" aria-hidden="true"></i>
        <p>Your cart is empty.<br/>Add something delicious!</p>
      </div>
    `;
    return;
  }

  cartItemsEl.innerHTML = cart.map(item => `
    <div class="cart-item" data-id="${item.id}">
      <img
        class="cart-item__img"
        src="${item.image}"
        alt="${item.name}"
        loading="lazy"
      />
      <div class="cart-item__info">
        <p class="cart-item__name" title="${item.name}">${item.name}</p>
        <p class="cart-item__price">$${(item.price * item.qty).toFixed(2)}</p>
      </div>
      <div class="cart-item__controls">
        <div class="qty-controls" aria-label="Quantity controls for ${item.name}">
          <button
            class="qty-btn"
            data-action="decrease"
            data-id="${item.id}"
            aria-label="Decrease quantity"
          >−</button>
          <span class="qty-value" aria-label="Quantity: ${item.qty}">${item.qty}</span>
          <button
            class="qty-btn"
            data-action="increase"
            data-id="${item.id}"
            aria-label="Increase quantity"
          >+</button>
        </div>
        <button
          class="cart-item__remove"
          data-id="${item.id}"
          aria-label="Remove ${item.name} from cart"
        >
          <i class="fa-solid fa-trash-can" aria-hidden="true"></i>
        </button>
      </div>
    </div>
  `).join('');

  // Delegate events
  cartItemsEl.querySelectorAll('.qty-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const id    = parseInt(btn.dataset.id, 10);
      const delta = btn.dataset.action === 'increase' ? 1 : -1;
      changeQty(id, delta);
    });
  });

  cartItemsEl.querySelectorAll('.cart-item__remove').forEach(btn => {
    btn.addEventListener('click', () => {
      removeFromCart(parseInt(btn.dataset.id, 10));
    });
  });
}

/** Animate the cart badge */
function bumpBadge() {
  cartBadge.classList.remove('bump');
  // Force reflow to restart animation
  void cartBadge.offsetWidth;
  cartBadge.classList.add('bump');
}


/* ── Drawer Open/Close ── */

function openCartDrawer() {
  cartDrawer.classList.add('open');
  cartDrawer.setAttribute('aria-hidden', 'false');
  cartOverlay.classList.add('visible');
  cartOverlay.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
}

function closeCartDrawer() {
  cartDrawer.classList.remove('open');
  cartDrawer.setAttribute('aria-hidden', 'true');
  cartOverlay.classList.remove('visible');
  cartOverlay.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
}

cartToggleBtn.addEventListener('click', openCartDrawer);
closeCartBtn.addEventListener('click', closeCartDrawer);
cartOverlay.addEventListener('click', closeCartDrawer);
continueShoppingBtn.addEventListener('click', closeCartDrawer);

// Close on Escape key
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    closeCartDrawer();
    closeModal('serviceModal');
    closeModal('paymentModal');
  }
});

// Initialize cart from localStorage on load
loadCart();
updateCartUI();


/* ════════════════════════════════════════════════════════════
   SECTION 4 — MENU RENDERING
   ════════════════════════════════════════════════════════════ */

const menuGrid = document.getElementById('menuGrid');
const tabs     = document.querySelectorAll('.tab');

/** Friendly display names for product categories */
const CATEGORY_LABELS = {
  green:   'Green Coffee',
  roasted: 'Roasted Coffee',
  bulk:    'Bulk Supply',
  service: 'Processing Service',
};

/**
 * Build the HTML string for a single menu card.
 * @param {object} item
 * @returns {string}
 */
function createMenuItemHTML(item) {
  const isService = item.category === 'service';
  const btnLabel  = isService ? 'Inquire' : 'Add to cart';
  const categoryLabel = CATEGORY_LABELS[item.category] || item.category;

  return `
    <article class="menu-item reveal">
      <div class="menu-item__image-wrap">
        <img
          src="${item.image}"
          alt="${item.name}"
          loading="lazy"
          decoding="async"
        />
        ${item.popular ? '<span class="menu-item__badge">Popular</span>' : ''}
      </div>
      <div class="menu-item__body">
        <p class="menu-item__category">${categoryLabel}</p>
        <h3 class="menu-item__name">${item.name}</h3>
        <p class="menu-item__desc">${item.desc}</p>
        <div class="menu-item__footer">
          <span class="menu-item__price">$${item.price.toFixed(2)}</span>
          <button
            class="menu-item__add ${isService ? 'service-btn' : ''}"
            data-id="${item.id}"
            aria-label="${btnLabel}: ${item.name}"
            title="${btnLabel}"
          >
            ${isService ? '<i class="fa-solid fa-arrow-right"></i>' : '+'}
          </button>
        </div>
      </div>
    </article>
  `;
}

/**
 * Render menu cards filtered by category, and re-attach listeners.
 * @param {string} [category='all']
 */
function renderMenuItems(category = 'all') {
  const filtered = category === 'all'
    ? MENU_ITEMS
    : MENU_ITEMS.filter(item => item.category === category);

  menuGrid.innerHTML = filtered.map(createMenuItemHTML).join('');

  // Button listeners
  menuGrid.querySelectorAll('.menu-item__add').forEach(btn => {
    btn.addEventListener('click', () => {
      const id   = parseInt(btn.dataset.id, 10);
      const item = MENU_MAP.get(id);
      if (!item) return;

      if (item.category === 'service') {
        openServiceModal(item);
      } else {
        addToCart(id);
      }
    });
  });

  // Trigger scroll reveal for freshly rendered cards
  observeRevealElements();
}

// Tab switching
tabs.forEach(tab => {
  tab.addEventListener('click', () => {
    tabs.forEach(t => {
      t.classList.remove('active');
      t.setAttribute('aria-selected', 'false');
    });
    tab.classList.add('active');
    tab.setAttribute('aria-selected', 'true');
    renderMenuItems(tab.dataset.category);
  });
});

// Initial render
renderMenuItems();


/* ════════════════════════════════════════════════════════════
   SECTION 5 — PAYMENT MODAL
   ════════════════════════════════════════════════════════════ */

const paymentModal = document.getElementById('paymentModal');
const closePaymentBtn = document.getElementById('closePayment');
const paymentCards    = document.querySelectorAll('.payment-card');
const payNowBtn       = document.getElementById('payNowBtn');

let selectedPayment = '';

/** Open a modal by id */
function openModal(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.add('show');
  el.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
}

/** Close a modal by id */
function closeModal(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.remove('show');
  el.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
}

checkoutBtn.addEventListener('click', () => {
  if (cart.length === 0) {
    showToast('Your cart is empty.', 'error');
    return;
  }
  closeCartDrawer();
  selectedPayment = '';
  paymentCards.forEach(c => c.classList.remove('active'));
  openModal('paymentModal');
});

closePaymentBtn.addEventListener('click', () => closeModal('paymentModal'));

paymentCards.forEach(card => {
  card.addEventListener('click', () => {
    paymentCards.forEach(c => {
      c.classList.remove('active');
      c.setAttribute('aria-checked', 'false');
    });
    card.classList.add('active');
    card.setAttribute('aria-checked', 'true');
    selectedPayment = card.dataset.method;
  });

  // Keyboard accessibility
  card.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      card.click();
    }
  });
});

payNowBtn.addEventListener('click', () => {
  if (!selectedPayment) {
    showToast('Please select a payment method.', 'error');
    return;
  }

  payNowBtn.classList.add('loading');
  payNowBtn.disabled = true;

  // Simulate async payment processing
  setTimeout(() => {
    showToast('Payment successful! Thank you 🎉', 'success');
    closeModal('paymentModal');
    cart = [];
    saveCart();
    updateCartUI();

    payNowBtn.classList.remove('loading');
    payNowBtn.disabled = false;
    selectedPayment = '';
    paymentCards.forEach(c => c.classList.remove('active'));
  }, 2000);
});


/* ════════════════════════════════════════════════════════════
   SECTION 6 — SERVICE CUSTOMIZATION MODAL
   ════════════════════════════════════════════════════════════ */

const serviceModal   = document.getElementById('serviceModal');
const serviceContent = document.getElementById('serviceContent');

/**
 * Open the service configuration modal for a given service item.
 * @param {object} item
 */
function openServiceModal(item) {
  if (!serviceModal || !serviceContent) return;

  serviceContent.innerHTML = `
    <button id="closeServiceModal" class="modal__close" aria-label="Close service modal">
      <i class="fa-solid fa-xmark" aria-hidden="true"></i>
    </button>

    <h2 class="service-title">${item.name}</h2>
    <p class="service-desc">${item.desc}</p>

    <div class="custom-grid">

      <div class="custom-group">
        <label for="serviceQty">Order Quantity (kg)</label>
        <input
          type="number"
          id="serviceQty"
          value="1"
          min="1"
          aria-label="Order quantity in kilograms"
        />
      </div>

      <div class="custom-group">
        <label for="servicePackage">Packaging Type</label>
        <select id="servicePackage" aria-label="Packaging type">
          <option>Export Bags</option>
          <option>Vacuum Packaging</option>
          <option>Retail Packaging</option>
          <option>Private Label Packaging</option>
        </select>
      </div>

      <div class="custom-group">
        <label for="serviceRoast">Roast Level</label>
        <select id="serviceRoast" aria-label="Roast level">
          <option>Light Roast</option>
          <option>Medium Roast</option>
          <option>Dark Roast</option>
        </select>
      </div>

      <div class="custom-group">
        <label for="serviceNotes">Special Instructions</label>
        <textarea
          id="serviceNotes"
          placeholder="Additional requests or notes..."
          aria-label="Special instructions"
        ></textarea>
      </div>

    </div>

    <p class="service-total">
      Total: $<span id="servicePrice">${item.price.toFixed(2)}</span>
    </p>

    <button class="btn btn--primary btn--full" id="customOrderBtn" style="margin-top:1.5rem;">
      Add Customized Order
    </button>
  `;

  openModal('serviceModal');

  // Close button
  document.getElementById('closeServiceModal').addEventListener('click', () => {
    closeModal('serviceModal');
  });

  // Live price update
  const qtyInput     = document.getElementById('serviceQty');
  const priceDisplay = document.getElementById('servicePrice');

  qtyInput.addEventListener('input', () => {
    const qty = Math.max(1, parseInt(qtyInput.value, 10) || 1);
    priceDisplay.textContent = (qty * item.price).toFixed(2);
  });

  // Add to cart
  document.getElementById('customOrderBtn').addEventListener('click', () => {
    const qty         = Math.max(1, parseInt(qtyInput.value, 10) || 1);
    const packageType = document.getElementById('servicePackage').value;
    const roast       = document.getElementById('serviceRoast').value;

    cart.push({
      id:    item.id,
      name:  `${item.name} (${packageType}, ${roast})`,
      price: item.price,
      qty,
      image: item.image,
    });

    saveCart();
    updateCartUI();
    bumpBadge();
    closeModal('serviceModal');
    showToast('Customized order added to cart!', 'success');
    openCartDrawer();
  });
}


/* ════════════════════════════════════════════════════════════
   SECTION 7 — CONTACT FORM VALIDATION
   ════════════════════════════════════════════════════════════ */

const contactForm    = document.getElementById('contactForm');
const submitBtn      = document.getElementById('submitBtn');
const contactSuccess = document.getElementById('contactSuccess');
const contactError   = document.getElementById('contactError');

/**
 * Validate a single field; return error message or empty string.
 * @param {'name'|'email'|'message'} field
 * @param {string} value
 * @returns {string}
 */
function validateField(field, value) {
  const v = value.trim();
  switch (field) {
    case 'name':
      if (!v) return 'Full name is required.';
      if (v.length < 2) return 'Name must be at least 2 characters.';
      return '';
    case 'email':
      if (!v) return 'Email address is required.';
      if (!EMAIL_REGEX.test(v)) return 'Please enter a valid email address.';
      return '';
    case 'message':
      if (!v) return 'Message cannot be empty.';
      if (v.length < 10) return 'Message is too short (min 10 characters).';
      return '';
    default:
      return '';
  }
}

/**
 * Display or clear an inline error for a specific field.
 * @param {string} fieldId  - e.g. 'cName'
 * @param {string} errorId  - e.g. 'cNameError'
 * @param {string} message  - Empty string to clear the error
 */
function setFieldError(fieldId, errorId, message) {
  const input = document.getElementById(fieldId);
  const error = document.getElementById(errorId);

  if (message) {
    error.textContent = message;
    input.classList.add('error');
    input.setAttribute('aria-invalid', 'true');
  } else {
    error.textContent = '';
    input.classList.remove('error');
    input.setAttribute('aria-invalid', 'false');
  }
}

/** Clear all field errors */
function clearFormErrors() {
  setFieldError('cName',    'cNameError',    '');
  setFieldError('cEmail',   'cEmailError',   '');
  setFieldError('cMessage', 'cMessageError', '');
}

/** Hide feedback banners */
function hideFormFeedback() {
  contactSuccess.hidden = true;
  contactError.hidden   = true;
}

// Live validation on blur
['cName', 'cEmail', 'cMessage'].forEach(id => {
  const input    = document.getElementById(id);
  const fieldMap = { cName: 'name', cEmail: 'email', cMessage: 'message' };
  const errorMap = { cName: 'cNameError', cEmail: 'cEmailError', cMessage: 'cMessageError' };
  const field    = fieldMap[id];
  const errorId  = errorMap[id];

  input.addEventListener('blur', () => {
    const err = validateField(field, input.value);
    setFieldError(id, errorId, err);
  });

  input.addEventListener('input', () => {
    // Clear error while typing once the user starts correcting
    if (input.classList.contains('error')) {
      const err = validateField(field, input.value);
      setFieldError(id, errorId, err);
    }
  });
});

contactForm.addEventListener('submit', e => {
  e.preventDefault();
  hideFormFeedback();
  clearFormErrors();

  const nameVal    = document.getElementById('cName').value;
  const emailVal   = document.getElementById('cEmail').value;
  const messageVal = document.getElementById('cMessage').value;

  const nameErr    = validateField('name',    nameVal);
  const emailErr   = validateField('email',   emailVal);
  const messageErr = validateField('message', messageVal);

  setFieldError('cName',    'cNameError',    nameErr);
  setFieldError('cEmail',   'cEmailError',   emailErr);
  setFieldError('cMessage', 'cMessageError', messageErr);

  // Stop if any errors
  if (nameErr || emailErr || messageErr) {
    // Focus first errored field
    if (nameErr)    document.getElementById('cName').focus();
    else if (emailErr)   document.getElementById('cEmail').focus();
    else if (messageErr) document.getElementById('cMessage').focus();
    return;
  }

  // Loading state
  submitBtn.classList.add('loading');
  submitBtn.disabled = true;

  // Simulate async submission (replace with real fetch() for backend)
  setTimeout(() => {
    const success = true; // Mock API result

    submitBtn.classList.remove('loading');
    submitBtn.disabled = false;

    if (success) {
      contactForm.reset();
      contactSuccess.hidden = false;
      showToast('Message sent successfully!', 'success');
    } else {
      contactError.hidden = false;
    }
  }, 1800);
});


/* ════════════════════════════════════════════════════════════
   SECTION 8 — TOAST NOTIFICATIONS
   ════════════════════════════════════════════════════════════ */

const toastEl = document.getElementById('toast');
let toastTimer = null;

/**
 * Show a toast notification.
 * @param {string} message
 * @param {'success'|'error'|''} [type='']
 * @param {number} [duration=3000]
 */
function showToast(message, type = '', duration = 3000) {
  clearTimeout(toastTimer);

  // Build icon
  const iconMap = {
    success: '<i class="fa-solid fa-circle-check" aria-hidden="true"></i>',
    error:   '<i class="fa-solid fa-circle-exclamation" aria-hidden="true"></i>',
  };

  toastEl.innerHTML = `${iconMap[type] || ''}<span>${message}</span>`;
  toastEl.className = `toast ${type} show`;

  toastTimer = setTimeout(() => {
    toastEl.classList.remove('show');
  }, duration);
}


/* ════════════════════════════════════════════════════════════
   SECTION 9 — SCROLL REVEAL
   ════════════════════════════════════════════════════════════ */

let revealObserver = null;

/**
 * Set up an IntersectionObserver to animate .reveal elements.
 * Called after each menu render.
 */
function observeRevealElements() {
  if (revealObserver) revealObserver.disconnect();

  const elements = document.querySelectorAll('.reveal');

  revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        revealObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });

  elements.forEach(el => revealObserver.observe(el));
}

// Also observe static sections on initial load
observeRevealElements();
document.querySelectorAll('.feature-box, .about-text, .contact-left, .contact-right').forEach(el => {
  el.classList.add('reveal');
});
observeRevealElements();


/* ════════════════════════════════════════════════════════════
   SECTION 10 — INIT
   ════════════════════════════════════════════════════════════ */

// Run on DOM ready
window.addEventListener('DOMContentLoaded', () => {
  handleNavScroll();
  updateActiveLink();
});

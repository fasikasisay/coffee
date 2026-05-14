/* ============================================================
   MISRAK COFFEE — app.js
   Handles: navbar scroll, mobile menu, menu filtering,
   cart logic, order form, contact form, newsletter,
   scroll-reveal animations, and toast notifications.
   ============================================================ */

'use strict';

/* ---- Menu data ---- */
const MENU_ITEMS = [
  {
    id: 1,
    name: 'Yirgacheffe Pour-Over',
    category: 'filter',
    price: 6.50,
    desc: 'Delicate floral notes with bright lemon acidity and a jasmine finish. The most prized of Ethiopian origins.',
    emoji: '☕',
    popular: true,
  },
  {
    id: 2,
    name: 'Sidama Espresso',
    category: 'espresso',
    price: 4.00,
    desc: 'Thick, syrupy body with notes of dark chocolate, dried fruit, and a lingering sweetness.',
    emoji: '🍫',
    popular: false,
  },
  {
    id: 3,
    name: 'Harar Wild Cold Brew',
    category: 'cold',
    price: 7.00,
    desc: 'Steeped 18 hours for a smooth, wine-like coldness. Blueberry, wine gum, and earthy sweetness.',
    emoji: '🧊',
    popular: true,
  },
  {
    id: 4,
    name: 'Flat White',
    category: 'espresso',
    price: 5.00,
    desc: 'A ristretto double shot topped with velvety microfoam. Small but mighty.',
    emoji: '🥛',
    popular: false,
  },
  {
    id: 5,
    name: 'Limu Filter Drip',
    category: 'filter',
    price: 5.50,
    desc: 'Mild and balanced with hints of spice, lime zest, and mild cocoa. Beginner-friendly and endlessly drinkable.',
    emoji: '☕',
    popular: false,
  },
  {
    id: 6,
    name: 'Nitro Cold Brew',
    category: 'cold',
    price: 7.50,
    desc: 'Nitrogen-infused for a creamy, Guinness-like texture. Zero sugar, naturally sweet.',
    emoji: '🫧',
    popular: false,
  },
  {
    id: 7,
    name: 'Yirgacheffe Whole Beans (250g)',
    category: 'beans',
    price: 18.00,
    desc: 'Roasted to order. Natural process. Bright, complex, and utterly unique. Gift-ready packaging.',
    emoji: '🫘',
    popular: true,
  },
  {
    id: 8,
    name: 'Sidama Whole Beans (250g)',
    category: 'beans',
    price: 17.00,
    desc: 'Washed process. Sweet and clean. Perfect for home espresso or French press.',
    emoji: '🫘',
    popular: false,
  },
  {
    id: 9,
    name: 'Macchiato',
    category: 'espresso',
    price: 3.50,
    desc: 'Ethiopian-style: a small cup of concentrated espresso with a dollop of steamed foam.',
    emoji: '☕',
    popular: false,
  },
  {
    id: 10,
    name: 'Iced Latte',
    category: 'cold',
    price: 6.00,
    desc: 'Sidama espresso poured over ice with cold whole milk. Simple and refreshing.',
    emoji: '🥤',
    popular: false,
  },
  {
    id: 11,
    name: 'Harar Whole Beans (250g)',
    category: 'beans',
    price: 17.50,
    desc: 'Dry-processed from ancient forests. Winey, blueberry, and uniquely complex.',
    emoji: '🫘',
    popular: false,
  },
  {
    id: 12,
    name: 'Cortado',
    category: 'espresso',
    price: 4.50,
    desc: 'Equal parts espresso and warm milk. Bold, balanced, no bitterness.',
    emoji: '☕',
    popular: false,
  },
];

/* ---- Cart state ---- */
let cart = []; /* Array of { id, name, price, qty } */

/* ============================================================
   NAVBAR — scroll behavior & active link tracking
   ============================================================ */
const navbar = document.getElementById('navbar');
const navLinks = document.querySelectorAll('.nav-link');
const sections = document.querySelectorAll('section[id]');

/* Add 'scrolled' class once user scrolls past 60px */
function handleNavScroll() {
  navbar.classList.toggle('scrolled', window.scrollY > 60);
}

/* Update active nav link based on scroll position */
function updateActiveLink() {
  let current = '';
  sections.forEach(section => {
    const sectionTop = section.offsetTop - 120;
    if (window.scrollY >= sectionTop) {
      current = section.getAttribute('id');
    }
  });

  navLinks.forEach(link => {
    link.classList.toggle(
      'active',
      link.getAttribute('href') === `#${current}`
    );
  });
}

window.addEventListener('scroll', () => {
  handleNavScroll();
  updateActiveLink();
}, { passive: true });

handleNavScroll(); /* Run once on load */

/* ============================================================
   MOBILE MENU — hamburger toggle
   ============================================================ */
const hamburger = document.getElementById('hamburger');
const mobileMenu = document.getElementById('mobileMenu');
const mobileNavLinks = document.querySelectorAll('.mobile-nav-link');

function toggleMobileMenu() {
  const isOpen = mobileMenu.classList.toggle('open');
  hamburger.classList.toggle('open', isOpen);
  document.body.style.overflow = isOpen ? 'hidden' : '';
}

function closeMobileMenu() {
  mobileMenu.classList.remove('open');
  hamburger.classList.remove('open');
  document.body.style.overflow = '';
}

hamburger.addEventListener('click', toggleMobileMenu);

/* Close when a link is clicked */
mobileNavLinks.forEach(link => {
  link.addEventListener('click', closeMobileMenu);
});

/* Close if user clicks outside the menu */
document.addEventListener('click', e => {
  if (
    mobileMenu.classList.contains('open') &&
    !mobileMenu.contains(e.target) &&
    !hamburger.contains(e.target)
  ) {
    closeMobileMenu();
  }
});

/* ============================================================
   MENU — rendering and category filtering
   ============================================================ */
const menuGrid = document.getElementById('menuGrid');
const tabs = document.querySelectorAll('.tab');

function renderMenuItems(category = 'all') {
  const filtered = category === 'all'
    ? MENU_ITEMS
    : MENU_ITEMS.filter(item => item.category === category);

  /* Animate out then in */
  menuGrid.style.opacity = '0';
  menuGrid.style.transform = 'translateY(8px)';

  setTimeout(() => {
    menuGrid.innerHTML = filtered.map(item => createMenuItemHTML(item)).join('');
    menuGrid.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
    menuGrid.style.opacity = '1';
    menuGrid.style.transform = 'translateY(0)';

    /* Attach add-to-cart handlers */
    menuGrid.querySelectorAll('.menu-item__add').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const id = parseInt(btn.dataset.id);
        addToCart(id);
      });
    });
  }, 200);
}

function createMenuItemHTML(item) {
  return `
    <article class="menu-item reveal" data-id="${item.id}">
      ${item.popular ? '<span class="menu-item__badge">Popular</span>' : ''}
      <div class="menu-item__img-wrap">
        <div class="menu-item__emoji">${item.emoji}</div>
      </div>
      <div class="menu-item__body">
        <p class="menu-item__category">${formatCategory(item.category)}</p>
        <h3 class="menu-item__name">${item.name}</h3>
        <p class="menu-item__desc">${item.desc}</p>
        <div class="menu-item__footer">
          <span class="menu-item__price">$${item.price.toFixed(2)}</span>
          <button class="menu-item__add" data-id="${item.id}" aria-label="Add ${item.name} to cart">+</button>
        </div>
      </div>
    </article>
  `;
}

function formatCategory(cat) {
  const map = {
    espresso: 'Espresso',
    filter: 'Filter Coffee',
    cold: 'Cold Brew',
    beans: 'Whole Beans',
  };
  return map[cat] || cat;
}

/* Tab filtering */
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

/* Initial render */
renderMenuItems('all');

/* ============================================================
   QUICK-ADD PANEL (order section sidebar)
   ============================================================ */
const quickItems = document.getElementById('quickItems');

function renderQuickItems() {
  /* Show top 8 items in the quick-add panel */
  const top = MENU_ITEMS.slice(0, 8);
  quickItems.innerHTML = top.map(item => {
    const inCart = cart.some(c => c.id === item.id);
    return `
      <div class="quick-item ${inCart ? 'in-cart' : ''}" data-id="${item.id}" role="button" tabindex="0" aria-label="Add ${item.name}">
        <span class="quick-item__icon">${item.emoji}</span>
        <span class="quick-item__name">${item.name}</span>
        <span class="quick-item__price">$${item.price.toFixed(2)}</span>
        <span class="quick-item__btn" aria-hidden="true">${inCart ? '✓' : '+'}</span>
      </div>
    `;
  }).join('');

  /* Attach click handlers */
  quickItems.querySelectorAll('.quick-item').forEach(el => {
    el.addEventListener('click', () => addToCart(parseInt(el.dataset.id)));
    el.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') addToCart(parseInt(el.dataset.id));
    });
  });
}

renderQuickItems();

/* ============================================================
   CART LOGIC
   ============================================================ */
function addToCart(id) {
  const item = MENU_ITEMS.find(m => m.id === id);
  if (!item) return;

  const existing = cart.find(c => c.id === id);
  if (existing) {
    existing.qty += 1;
  } else {
    cart.push({ id: item.id, name: item.name, price: item.price, qty: 1 });
  }

  renderCart();
  renderQuickItems();
  showToast(`${item.name} added to order ☕`, 'success');
}

function removeFromCart(id) {
  cart = cart.filter(c => c.id !== id);
  renderCart();
  renderQuickItems();
}

function renderCart() {
  const cartItemsEl = document.getElementById('cartItems');
  const cartTotalEl = document.getElementById('cartTotal');
  const cartTotalAmountEl = document.getElementById('cartTotalAmount');

  if (cart.length === 0) {
    cartItemsEl.innerHTML = '<p class="cart-empty">No items yet. Browse the menu above!</p>';
    cartTotalEl.style.display = 'none';
    return;
  }

  const total = cart.reduce((sum, c) => sum + c.price * c.qty, 0);

  cartItemsEl.innerHTML = cart.map(item => `
    <div class="cart-row">
      <span class="cart-row__name">${item.name}</span>
      <span class="cart-row__qty">× ${item.qty}</span>
      <span class="cart-row__price">$${(item.price * item.qty).toFixed(2)}</span>
      <button class="cart-row__remove" data-id="${item.id}" aria-label="Remove ${item.name}">✕</button>
    </div>
  `).join('');

  /* Attach remove handlers */
  cartItemsEl.querySelectorAll('.cart-row__remove').forEach(btn => {
    btn.addEventListener('click', () => removeFromCart(parseInt(btn.dataset.id)));
  });

  cartTotalEl.style.display = 'flex';
  cartTotalAmountEl.textContent = `$${total.toFixed(2)}`;
}

/* ============================================================
   ORDER FORM — validation and submission
   ============================================================ */
const orderForm = document.getElementById('orderForm');
const orderType = document.getElementById('orderType');
const addressGroup = document.getElementById('addressGroup');
const orderSuccess = document.getElementById('orderSuccess');
const successMsg = document.getElementById('successMsg');

/* Show/hide delivery address field based on order type */
orderType.addEventListener('change', () => {
  const isDelivery = orderType.value === 'delivery';
  addressGroup.style.display = isDelivery ? 'flex' : 'none';
});

/* Simple validation helper */
function validateField(inputEl, errorElId, message) {
  const errorEl = document.getElementById(errorElId);
  if (!inputEl.value.trim()) {
    inputEl.classList.add('error');
    errorEl.textContent = message;
    return false;
  }
  inputEl.classList.remove('error');
  errorEl.textContent = '';
  return true;
}

function validateEmail(inputEl, errorElId) {
  const errorEl = document.getElementById(errorElId);
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(inputEl.value.trim())) {
    inputEl.classList.add('error');
    errorEl.textContent = 'Please enter a valid email address.';
    return false;
  }
  inputEl.classList.remove('error');
  errorEl.textContent = '';
  return true;
}

orderForm.addEventListener('submit', e => {
  e.preventDefault();

  const nameInput = document.getElementById('customerName');
  const emailInput = document.getElementById('customerEmail');

  const nameValid = validateField(nameInput, 'nameError', 'Please enter your name.');
  const emailValid = validateEmail(emailInput, 'emailError');

  if (!nameValid || !emailValid) return;

  if (cart.length === 0) {
    showToast('Please add at least one item to your order.', 'error');
    return;
  }

  /* Simulate order submission */
  const btn = document.getElementById('submitBtn');
  btn.textContent = 'Placing order…';
  btn.disabled = true;

  setTimeout(() => {
    const name = nameInput.value.trim().split(' ')[0];
    const total = cart.reduce((s, c) => s + c.price * c.qty, 0);
    const typeLabel = orderType.value === 'delivery' ? 'delivered to you' : 'ready for pickup';

    successMsg.textContent = `Thanks, ${name}! Your order ($${total.toFixed(2)}) will be ${typeLabel} shortly.`;
    orderForm.style.display = 'none';
    orderSuccess.style.display = 'block';
    btn.disabled = false;
    btn.textContent = 'Place Order';
  }, 1400);
});

/* Reset order form */
window.resetOrder = function () {
  cart = [];
  renderCart();
  renderQuickItems();
  orderForm.style.display = 'flex';
  orderSuccess.style.display = 'none';
  orderForm.reset();
  addressGroup.style.display = 'none';
};

/* ============================================================
   CONTACT FORM
   ============================================================ */
const contactForm = document.getElementById('contactForm');
const contactSuccess = document.getElementById('contactSuccess');

contactForm.addEventListener('submit', e => {
  e.preventDefault();

  const name = document.getElementById('cName').value.trim();
  const email = document.getElementById('cEmail').value.trim();
  const message = document.getElementById('cMessage').value.trim();

  if (!name || !email || !message) {
    showToast('Please fill in all fields.', 'error');
    return;
  }

  const btn = contactForm.querySelector('button[type="submit"]');
  btn.textContent = 'Sending…';
  btn.disabled = true;

  setTimeout(() => {
    contactForm.style.display = 'none';
    contactSuccess.style.display = 'block';
    btn.disabled = false;
    btn.textContent = 'Send Message';
  }, 1000);
});

/* ============================================================
   NEWSLETTER FORM
   ============================================================ */
const newsletterForm = document.getElementById('newsletterForm');
const newsletterNote = document.getElementById('newsletterNote');

newsletterForm.addEventListener('submit', e => {
  e.preventDefault();
  const email = document.getElementById('newsletterEmail').value.trim();

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    showToast('Please enter a valid email.', 'error');
    return;
  }

  newsletterForm.style.display = 'none';
  newsletterNote.style.display = 'block';
  showToast('You\'re subscribed! Welcome to the Misrak family 🎉', 'success');
});

/* ============================================================
   TOAST NOTIFICATION
   ============================================================ */
const toastEl = document.getElementById('toast');
let toastTimer = null;

function showToast(message, type = '') {
  toastEl.textContent = message;
  toastEl.className = `toast ${type} show`;

  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toastEl.classList.remove('show');
  }, 3000);
}

/* ============================================================
   SCROLL REVEAL — IntersectionObserver for .reveal elements
   ============================================================ */
const revealObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        revealObserver.unobserve(entry.target); /* Only animate once */
      }
    });
  },
  { threshold: 0.12 }
);

/* Observe static elements at load */
function initReveal() {
  document.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));
}

/* Also observe newly created menu items after filter renders */
const menuObserver = new MutationObserver(() => {
  document.querySelectorAll('.menu-item.reveal:not(.visible)').forEach(el => {
    revealObserver.observe(el);
  });
});

menuObserver.observe(menuGrid, { childList: true });

/* Add reveal class to static sections */
document.querySelectorAll(
  '.about-grid, .value-item, .step, .review-card, .contact-grid, .order-form-wrap, .cart-panel'
).forEach(el => {
  el.classList.add('reveal');
});

initReveal();

/* ============================================================
   SMOOTH SCROLL — for anchor links (fallback for older browsers)
   ============================================================ */
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', e => {
    const target = document.querySelector(anchor.getAttribute('href'));
    if (target) {
      e.preventDefault();
      const offset = 80; /* Account for fixed navbar */
      const top = target.getBoundingClientRect().top + window.scrollY - offset;
      window.scrollTo({ top, behavior: 'smooth' });
    }
  });
});

/* ============================================================
   ACTIVE INPUT CLEARING — remove error state on input
   ============================================================ */
document.querySelectorAll('input, select, textarea').forEach(el => {
  el.addEventListener('input', () => {
    el.classList.remove('error');
  });
});
/* ============================================================
   PAYMENT SYSTEM
============================================================ */

const paymentModal = document.getElementById('paymentModal');
const checkoutBtn = document.getElementById('checkoutBtn');
const closePayment = document.getElementById('closePayment');
const paymentCards = document.querySelectorAll('.payment-card');
const payNowBtn = document.getElementById('payNowBtn');

let selectedPayment = '';

/* OPEN PAYMENT MODAL */

checkoutBtn.addEventListener('click', () => {

  if(cart.length === 0){
    showToast('Your cart is empty.', 'error');
    return;
  }

  paymentModal.classList.add('show');
});

/* CLOSE */

closePayment.addEventListener('click', () => {
  paymentModal.classList.remove('show');
});

/* SELECT PAYMENT */

paymentCards.forEach(card => {

  card.addEventListener('click', () => {

    paymentCards.forEach(c => c.classList.remove('active'));

    card.classList.add('active');

    selectedPayment = card.dataset.method;
  });

});

/* PAYMENT */

payNowBtn.addEventListener('click', () => {

  if(!selectedPayment){
    showToast('Select a payment method.', 'error');
    return;
  }

  payNowBtn.textContent = 'Processing...';
  payNowBtn.disabled = true;

  setTimeout(() => {

    const success = Math.random() > 0.2;

    if(success){

      showToast('Payment successful ☕', 'success');

      paymentModal.classList.remove('show');

      cart = [];

      renderCart();

      renderQuickItems();

    }else{

      showToast('Insufficient balance.', 'error');

    }

    payNowBtn.textContent = 'Confirm Payment';

    payNowBtn.disabled = false;

  }, 2000);

});
'use strict';

/* ============================================================
   CONFIG
============================================================ */

const API_BASE = 'http://localhost:5000/api/v1';

const STORAGE_KEYS = {
  CART: 'misrak_cart',
  THEME: 'misrak_theme',
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;


/* ============================================================
   SERVICES DATA
============================================================ */

const SERVICES = [
  {
    serviceKey: 'svc-export-packaging',
    name: 'Coffee Export Packaging',
    price: 120.00,
    desc: 'Professional export packaging with international shipping standards.',
    image: 'images/packeage.jpg',
  },
  {
    serviceKey: 'svc-cleaning-sorting',
    name: 'Coffee Cleaning & Sorting',
    price: 95.00,
    desc: 'Advanced defect sorting and grading services.',
    image: 'images/coffee-beans-after-cleaning.jpg',
  },
  {
    serviceKey: 'svc-private-label-roasting',
    name: 'Private Label Roasting',
    price: 180.00,
    desc: 'Custom roasting and branding solutions for cafés and coffee brands.',
    image: 'images/how-to-roast-coffee.jpg',
  },
  {
    serviceKey: 'svc-international-export',
    name: 'International Export Service',
    price: 250.00,
    desc: 'End-to-end export logistics and shipment handling.',
    image: 'images/Exports-1mer3rn.jpg',
  },
];

const SERVICE_MAP = new Map(
  SERVICES.map(service => [service.serviceKey, service])
);


/* ============================================================
   LIVE PRODUCTS FROM BACKEND
============================================================ */

let PRODUCTS = [];

let PRODUCT_MAP = new Map();


/* ============================================================
   HELPERS
============================================================ */

function escapeHTML(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}


function resolveProductImage(product) {

  const imageMap = {
    'Yirgacheffe Grade 1':
      'images/greencoffeebeans.webp',

    'Sidama Natural Export':
      'images/green-coffee-beans-01.jpg',

    'Harar Longberry':
      'images/Raw-Green-Unprocessed-Coffee-Beans-Whole-5.jpg',

    'Dark Roast Espresso Blend':
      'images/rosted.jpg',

    'Premium Filter Roast':
      'images/rosted2.webp',

    'Bulk Commercial Supply':
      'images/large package.webp',

    'Washed Process Beans':
      'images/cleaning coffe.jpg',

    'Natural Process Beans':
      'images/high-angle-view-beans.jpg'
  };

  // First use the specific image assigned to the product name
  if (imageMap[product.name]) {
    return imageMap[product.name];
  }

  // Otherwise use the image from the backend
  if (
    product.image &&
    typeof product.image === 'string' &&
    product.image.trim() !== ''
  ) {
    return product.image;
  }

  // Final fallback
  return 'images/greencoffeebeans.webp';
}

function withImageFallback(img) {
  img.addEventListener(
    'error',
    () => {
      img.src = 'images/greencoffeebeans.webp';
    },
    { once: true }
  );
}


/* SECTION 1 — THEME SYSTEM */

const themeToggleBtn = document.getElementById('themeToggle');


function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);

  localStorage.setItem(
    STORAGE_KEYS.THEME,
    theme
  );

  if (themeToggleBtn) {
    themeToggleBtn.setAttribute(
      'aria-label',
      `Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`
    );
  }
}


function toggleTheme() {
  const current =
    document.documentElement.getAttribute('data-theme') || 'dark';

  applyTheme(
    current === 'dark' ? 'light' : 'dark'
  );
}


function initTheme() {
  const saved =
    localStorage.getItem(STORAGE_KEYS.THEME);

  applyTheme(saved || 'dark');
}


if (themeToggleBtn) {
  themeToggleBtn.addEventListener(
    'click',
    toggleTheme
  );
}

initTheme();

/* SECTION 2 — NAVBAR */

const navbar = document.getElementById('navbar');
const navLinks = document.querySelectorAll('.nav-link');
const allSections = document.querySelectorAll('section[id]');
const hamburger = document.getElementById('hamburger');
const mobileMenu = document.getElementById('mobileMenu');


function handleNavScroll() {
  if (!navbar) return;

  navbar.classList.toggle(
    'scrolled',
    window.scrollY > 60
  );
}


function updateActiveLink() {
  let current = '';

  allSections.forEach(section => {
    if (
      window.scrollY >=
      section.offsetTop - 130
    ) {
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


window.addEventListener(
  'scroll',
  () => {
    handleNavScroll();
    updateActiveLink();
  },
  { passive: true }
);


if (hamburger && mobileMenu) {
  hamburger.addEventListener('click', () => {
    const isOpen =
      mobileMenu.classList.toggle('open');

    hamburger.classList.toggle(
      'open',
      isOpen
    );

    hamburger.setAttribute(
      'aria-expanded',
      String(isOpen)
    );
  });
}


document
  .querySelectorAll('.mobile-nav-link')
  .forEach(link => {

    link.addEventListener('click', () => {
      if (mobileMenu) {
        mobileMenu.classList.remove('open');
      }

      if (hamburger) {
        hamburger.classList.remove('open');

        hamburger.setAttribute(
          'aria-expanded',
          'false'
        );
      }
    });

  });


/* SECTION 3 — CART */

let cart = [];


const cartDrawer =
  document.getElementById('cartDrawer');

const cartOverlay =
  document.getElementById('cartOverlay');

const cartToggleBtn =
  document.getElementById('cartToggle');

const closeCartBtn =
  document.getElementById('closeCart');

const continueShoppingBtn =
  document.getElementById('continueShopping');

const cartItemsEl =
  document.getElementById('cartItems');

const cartBadge =
  document.getElementById('cartBadge');

const cartCount =
  document.getElementById('cartCount');

const cartTotalAmountEl =
  document.getElementById('cartTotalAmount');

const checkoutBtn =
  document.getElementById('checkoutBtn');


function saveCart() {
  localStorage.setItem(
    STORAGE_KEYS.CART,
    JSON.stringify(cart)
  );
}


function loadCart() {
  try {
    const raw =
      localStorage.getItem(STORAGE_KEYS.CART);

    if (!raw) return;

    const parsed = JSON.parse(raw);

    if (Array.isArray(parsed)) {
      cart = parsed;
    }

  } catch (error) {
    console.error('Cart loading error:', error);

    cart = [];
  }
}


/* ADD PRODUCT TO CART */

function addProductToCart(id) {

  const product =
    PRODUCT_MAP.get(Number(id));

  if (!product) {
    showToast(
      'Product not found.',
      'error'
    );

    return;
  }


  const existing =
    cart.find(
      item =>
        Number(item.id) === Number(id)
    );


  if (existing) {

    existing.qty += 1;

  } else {

    cart.push({
      id: Number(product.id),
      name: product.name,
      price: Number(product.pricePerKg),
      qty: 1,
      image: resolveProductImage(product),
    });

  }


  saveCart();

  updateCartUI();

  bumpBadge();

  showToast(
    `${product.name} added to cart`,
    'success'
  );

  openCartDrawer();
}


function changeQty(id, delta) {

  const existing =
    cart.find(
      item =>
        Number(item.id) === Number(id)
    );

  if (!existing) return;

  existing.qty += delta;

  if (existing.qty < 1) {
    removeFromCart(id);
    return;
  }

  saveCart();

  updateCartUI();
}


function removeFromCart(id) {

  cart = cart.filter(
    item =>
      Number(item.id) !== Number(id)
  );

  saveCart();

  updateCartUI();
}


/* CART UI */

function updateCartUI() {

  if (
    !cartBadge ||
    !cartCount ||
    !cartTotalAmountEl ||
    !cartItemsEl
  ) {
    return;
  }


  const total =
    cart.reduce(
      (sum, item) =>
        sum +
        Number(item.price) *
        Number(item.qty),
      0
    );


  const itemCount =
    cart.reduce(
      (sum, item) =>
        sum + Number(item.qty),
      0
    );


  if (itemCount > 0) {

    cartBadge.textContent =
      itemCount > 99
        ? '99+'
        : String(itemCount);

    cartBadge.classList.add('visible');

    cartBadge.setAttribute(
      'aria-label',
      `${itemCount} items in cart`
    );

  } else {

    cartBadge.textContent = '0';

    cartBadge.classList.remove('visible');

    cartBadge.setAttribute(
      'aria-label',
      '0 items in cart'
    );
  }


  cartCount.textContent =
    `${itemCount} ${
      itemCount === 1
        ? 'item'
        : 'items'
    }`;


  cartTotalAmountEl.textContent =
    `$${total.toFixed(2)}`;


  if (cart.length === 0) {

    cartItemsEl.innerHTML = `
      <div class="cart-empty-state">
        <i
          class="fa-solid fa-bag-shopping"
          aria-hidden="true"
        ></i>

        <p>
          Your cart is empty.
          <br>
          Add something delicious!
        </p>
      </div>
    `;

    return;
  }


  cartItemsEl.innerHTML =
    cart.map(item => `

      <div
        class="cart-item"
        data-id="${item.id}"
      >

        <img
          class="cart-item__img"
          src="${escapeHTML(item.image)}"
          alt="${escapeHTML(item.name)}"
          loading="lazy"
        >

        <div class="cart-item__info">

          <p
            class="cart-item__name"
            title="${escapeHTML(item.name)}"
          >
            ${escapeHTML(item.name)}
          </p>

          <p class="cart-item__price">
            $${(
              Number(item.price) *
              Number(item.qty)
            ).toFixed(2)}
          </p>

        </div>


        <div class="cart-item__controls">

          <div
            class="qty-controls"
            aria-label="Quantity controls"
          >

            <button
              class="qty-btn"
              data-action="decrease"
              data-id="${item.id}"
              aria-label="Decrease quantity"
            >
              −
            </button>


            <span class="qty-value">
              ${item.qty}
            </span>


            <button
              class="qty-btn"
              data-action="increase"
              data-id="${item.id}"
              aria-label="Increase quantity"
            >
              +
            </button>

          </div>


          <button
            class="cart-item__remove"
            data-id="${item.id}"
            aria-label="Remove item"
          >
            <i
              class="fa-solid fa-trash-can"
              aria-hidden="true"
            ></i>
          </button>

        </div>

      </div>

    `).join('');


  cartItemsEl
    .querySelectorAll('.cart-item__img')
    .forEach(withImageFallback);


  cartItemsEl
    .querySelectorAll('.qty-btn')
    .forEach(btn => {

      btn.addEventListener('click', () => {

        const id =
          Number(btn.dataset.id);

        const delta =
          btn.dataset.action === 'increase'
            ? 1
            : -1;

        changeQty(id, delta);

      });

    });


  cartItemsEl
    .querySelectorAll('.cart-item__remove')
    .forEach(btn => {

      btn.addEventListener('click', () => {

        removeFromCart(
          Number(btn.dataset.id)
        );

      });

    });

}


function bumpBadge() {

  if (!cartBadge) return;

  cartBadge.classList.remove('bump');

  void cartBadge.offsetWidth;

  cartBadge.classList.add('bump');
}


/*  CART DRAWER */

function openCartDrawer() {

  if (!cartDrawer || !cartOverlay) return;

  cartDrawer.classList.add('open');

  cartDrawer.setAttribute(
    'aria-hidden',
    'false'
  );

  cartOverlay.classList.add('visible');

  cartOverlay.setAttribute(
    'aria-hidden',
    'false'
  );

  document.body.style.overflow = 'hidden';
}


function closeCartDrawer() {

  if (!cartDrawer || !cartOverlay) return;

  cartDrawer.classList.remove('open');

  cartDrawer.setAttribute(
    'aria-hidden',
    'true'
  );

  cartOverlay.classList.remove('visible');

  cartOverlay.setAttribute(
    'aria-hidden',
    'true'
  );

  document.body.style.overflow = '';
}


if (cartToggleBtn) {
  cartToggleBtn.addEventListener(
    'click',
    openCartDrawer
  );
}


if (closeCartBtn) {
  closeCartBtn.addEventListener(
    'click',
    closeCartDrawer
  );
}


if (cartOverlay) {
  cartOverlay.addEventListener(
    'click',
    closeCartDrawer
  );
}


if (continueShoppingBtn) {
  continueShoppingBtn.addEventListener(
    'click',
    closeCartDrawer
  );
}


loadCart();

updateCartUI();


/*  SECTION 4 — PRODUCT */

const menuGrid =
  document.getElementById('menuGrid');


async function fetchProducts() {

  if (!menuGrid) return;


  try {

    menuGrid.innerHTML = `
      <p class="empty-message">
        Loading products...
      </p>
    `;


    const response =
      await fetch(
        `${API_BASE}/products`
      );


    const result =
      await response.json();


    if (!response.ok) {

      throw new Error(
        result.error ||
        result.message ||
        'Failed to load products.'
      );

    }


    PRODUCTS =
      Array.isArray(result.data)
        ? result.data
        : [];


    PRODUCT_MAP =
      new Map(
        PRODUCTS.map(product => [
          Number(product.id),
          product
        ])
      );


    renderProducts();


  } catch (error) {

    console.error(
      'Product loading error:',
      error
    );


    menuGrid.innerHTML = `
      <p class="empty-message">
        Failed to load products.
      </p>
    `;

  }

}

function createProductHTML(product) {
  const available =
    product.isAvailable !== false;
  const buttonText =
    available
      ? 'Add To Cart'
      : 'Unavailable';
  return `
  <div class="product-slide">
    <img
        src="${escapeHTML(
          resolveProductImage(product)
        )}"
        alt="${escapeHTML(product.name)}"
        loading="lazy"
      >
      <div class="product-overlay">
      <h3>
          ${escapeHTML(product.name)}
        </h3>
        <p>
          $${Number(
            product.pricePerKg
          ).toFixed(2)}
        </p>
        <button
          class="menu-item__add"
          data-id="${product.id}"
          ${available ? '' : 'disabled'}
        >
          ${buttonText}
        </button>

      </div>

    </div>

  `;
}


function renderProducts() {

  if (!menuGrid) return;


  if (PRODUCTS.length === 0) {

    menuGrid.innerHTML = `
      <p class="empty-message">
        No products available at the moment.
      </p>
    `;

    return;
  }


  menuGrid.innerHTML =
    PRODUCTS
      .map(createProductHTML)
      .join('');


  menuGrid
    .querySelectorAll('.product-slide img')
    .forEach(withImageFallback);


  menuGrid
    .querySelectorAll('.menu-item__add')
    .forEach(btn => {

      btn.addEventListener('click', () => {

        if (btn.disabled) return;

        const productId =
          Number(btn.dataset.id);

        addProductToCart(productId);

      });

    });

}


/*  SECTION 5 — SERVICES */

const serviceGrid =
  document.getElementById('serviceGrid');


function createServiceHTML(service) {

  return `

    <div class="product-slide">

      <img
        src="${escapeHTML(service.image)}"
        alt="${escapeHTML(service.name)}"
        loading="lazy"
      >


      <div class="product-overlay">

        <h3>
          ${escapeHTML(service.name)}
        </h3>


        <p>
          Starting at $${Number(
            service.price
          ).toFixed(2)}
        </p>


        <button
          class="service-btn"
          data-id="${service.serviceKey}"
        >
          Inquire
        </button>

      </div>

    </div>

  `;
}


function renderServices() {

  if (!serviceGrid) return;


  serviceGrid.innerHTML =
    SERVICES
      .map(createServiceHTML)
      .join('');


  serviceGrid
    .querySelectorAll('.product-slide img')
    .forEach(withImageFallback);


  serviceGrid
    .querySelectorAll('.service-btn')
    .forEach(btn => {

      btn.addEventListener('click', () => {

        const service =
          SERVICE_MAP.get(
            btn.dataset.id
          );

        if (service) {
          openServiceModal(service);
        }

      });

    });

}


/* SECTION 6 — MODALS */

function openModal(id) {

  const el =
    document.getElementById(id);

  if (!el) return;

  el.classList.add('show');

  el.setAttribute(
    'aria-hidden',
    'false'
  );

  document.body.style.overflow = 'hidden';
}


function closeModal(id) {

  const el =
    document.getElementById(id);

  if (!el) return;

  el.classList.remove('show');

  el.setAttribute(
    'aria-hidden',
    'true'
  );

  document.body.style.overflow = '';
}


/* CHECKOUT */

const checkoutModal =
  document.getElementById('checkoutModal');

const checkoutForm =
  document.getElementById('checkoutForm');

const closeCheckoutBtn =
  document.getElementById('closeCheckout');


const customerName =
  document.getElementById('customerName');

const customerEmail =
  document.getElementById('customerEmail');

const customerPhone =
  document.getElementById('customerPhone');

const customerCompany =
  document.getElementById('customerCompany');

const customerCountry =
  document.getElementById('customerCountry');


let checkoutCustomer = null;


if (checkoutBtn) {

  checkoutBtn.addEventListener(
    'click',
    () => {

      if (cart.length === 0) {

        showToast(
          'Your cart is empty.',
          'error'
        );

        return;
      }


      closeCartDrawer();

      openModal('checkoutModal');

    }
  );

}


if (closeCheckoutBtn) {

  closeCheckoutBtn.addEventListener(
    'click',
    () => {
      closeModal('checkoutModal');
    }
  );

}


if (checkoutForm) {

  checkoutForm.addEventListener(
    'submit',
    event => {

      event.preventDefault();


      const name =
        customerName.value.trim();

      const email =
        customerEmail.value.trim();


      if (!name) {

        showToast(
          'Please enter your full name.',
          'error'
        );

        return;
      }


      if (!EMAIL_REGEX.test(email)) {

        showToast(
          'Please enter a valid email address.',
          'error'
        );

        return;
      }


      checkoutCustomer = {
        name,
        email,
        phone:
          customerPhone.value.trim(),
        company:
          customerCompany.value.trim(),
        country:
          customerCountry.value.trim(),
      };


      closeModal('checkoutModal');


      selectedPayment = '';


      paymentCards.forEach(card => {

        card.classList.remove('active');

        card.setAttribute(
          'aria-checked',
          'false'
        );

      });


      openModal('paymentModal');

    }
  );

}


/* PAYMENT */

const paymentModal =
  document.getElementById('paymentModal');

const closePaymentBtn =
  document.getElementById('closePayment');

const paymentCards =
  document.querySelectorAll('.payment-card');

const payNowBtn =
  document.getElementById('payNowBtn');


let selectedPayment = '';


if (closePaymentBtn) {

  closePaymentBtn.addEventListener(
    'click',
    () => {
      closeModal('paymentModal');
    }
  );

}


paymentCards.forEach(card => {

  card.addEventListener('click', () => {

    paymentCards.forEach(c => {

      c.classList.remove('active');

      c.setAttribute(
        'aria-checked',
        'false'
      );

    });


    card.classList.add('active');

    card.setAttribute(
      'aria-checked',
      'true'
    );


    selectedPayment =
      card.dataset.method;

  });


  card.addEventListener(
    'keydown',
    event => {

      if (
        event.key === 'Enter' ||
        event.key === ' '
      ) {

        event.preventDefault();

        card.click();

      }

    }
  );

});


/*CREATE ORDER — ONLY ONE EVENT LISTEN */

if (payNowBtn) {

  payNowBtn.addEventListener(
    'click',
    async () => {

      if (!selectedPayment) {

        showToast(
          'Please select a payment method.',
          'error'
        );

        return;
      }


      if (!checkoutCustomer) {

        showToast(
          'Customer information is missing.',
          'error'
        );

        closeModal('paymentModal');

        openModal('checkoutModal');

        return;
      }


      if (cart.length === 0) {

        showToast(
          'Your cart is empty.',
          'error'
        );

        closeModal('paymentModal');

        return;
      }


      const items =
        cart.map(item => ({
          productId: Number(item.id),
          quantity: Number(item.qty),
        }));


      payNowBtn.classList.add('loading');

      payNowBtn.disabled = true;


      try {

        const response =
          await fetch(
            `${API_BASE}/orders`,
            {

              method: 'POST',

              headers: {
                'Content-Type':
                  'application/json',
              },

              credentials: 'include',

              body: JSON.stringify({

                customer:
                  checkoutCustomer,

                items,

                notes:
                  `Payment method: ${selectedPayment}`,

              }),

            }
          );


        const result =
          await response.json();


        if (
          !response.ok ||
          !result.success
        ) {

          throw new Error(
            result.error ||
            result.message ||
            'Failed to create order.'
          );

        }


        /* Clear cart ONLY after success */

        cart = [];

        saveCart();

        updateCartUI();


        closeModal('paymentModal');


        showToast(
          `Order ${
            result.data?.orderNumber || ''
          } created successfully! 🎉`,
          'success'
        );


        checkoutCustomer = null;


        if (checkoutForm) {
          checkoutForm.reset();
        }


        selectedPayment = '';


        paymentCards.forEach(card => {

          card.classList.remove('active');

          card.setAttribute(
            'aria-checked',
            'false'
          );

        });


      } catch (error) {

        console.error(
          'Order error:',
          error
        );


        showToast(
          error.message ||
          'Failed to create order. Please try again.',
          'error'
        );


      } finally {

        payNowBtn.classList.remove('loading');

        payNowBtn.disabled = false;

      }

    }
  );

}


/* SECTION 7 — SERVICE ENQUIRY */

const serviceModal =
  document.getElementById('serviceModal');

const serviceContent =
  document.getElementById('serviceContent');


function openServiceModal(service) {

  if (
    !serviceModal ||
    !serviceContent
  ) {
    return;
  }


  serviceContent.innerHTML = `

    <button
      id="closeServiceModal"
      class="modal__close"
      aria-label="Close service modal"
    >
      <i
        class="fa-solid fa-xmark"
        aria-hidden="true"
      ></i>
    </button>


    <h2 class="service-title">
      ${escapeHTML(service.name)}
    </h2>


    <p class="service-desc">
      ${escapeHTML(service.desc)}
    </p>


    <form id="serviceForm">

      <div class="custom-grid">


        <div class="custom-group">

          <label for="serviceCustomerName">
            Full Name
          </label>

          <input
            type="text"
            id="serviceCustomerName"
            placeholder="Enter your full name"
            required
          >

        </div>


        <div class="custom-group">

          <label for="serviceCustomerEmail">
            Email Address
          </label>

          <input
            type="email"
            id="serviceCustomerEmail"
            placeholder="Enter your email"
            required
          >

        </div>


        <div class="custom-group">

          <label for="serviceQty">
            Quantity (kg)
          </label>

          <input
            type="number"
            id="serviceQty"
            value="1"
            min="1"
          >

        </div>


        <div class="custom-group">

          <label for="servicePackage">
            Packaging Type
          </label>

          <select id="servicePackage">

            <option>
              Export Bags
            </option>

            <option>
              Vacuum Packaging
            </option>

            <option>
              Retail Packaging
            </option>

            <option>
              Private Label Packaging
            </option>

          </select>

        </div>


        <div class="custom-group">

          <label for="serviceRoast">
            Roast Level
          </label>

          <select id="serviceRoast">

            <option>
              Light Roast
            </option>

            <option>
              Medium Roast
            </option>

            <option>
              Dark Roast
            </option>

          </select>

        </div>


        <div class="custom-group">

          <label for="serviceNotes">
            Special Instructions
          </label>

          <textarea
            id="serviceNotes"
            placeholder="Additional requests or notes..."
          ></textarea>

        </div>

      </div>


      <button
        type="submit"
        class="btn btn--primary btn--full"
        id="customOrderBtn"
        style="margin-top:1.5rem;"
      >
        Send Service Enquiry
      </button>

    </form>

  `;


  openModal('serviceModal');


  const closeServiceModalBtn =
    document.getElementById(
      'closeServiceModal'
    );


  if (closeServiceModalBtn) {

    closeServiceModalBtn.addEventListener(
      'click',
      () => {
        closeModal('serviceModal');
      }
    );

  }


  const serviceForm =
    document.getElementById('serviceForm');


  if (!serviceForm) return;


  serviceForm.addEventListener(
    'submit',
    async event => {

      event.preventDefault();


      const name =
        document
          .getElementById('serviceCustomerName')
          .value
          .trim();


      const email =
        document
          .getElementById('serviceCustomerEmail')
          .value
          .trim();


      const quantity =
        Math.max(
          1,
          parseInt(
            document
              .getElementById('serviceQty')
              .value,
            10
          ) || 1
        );


      const packageType =
        document
          .getElementById('servicePackage')
          .value;


      const roast =
        document
          .getElementById('serviceRoast')
          .value;


      const notes =
        document
          .getElementById('serviceNotes')
          .value
          .trim();


      if (!name) {

        showToast(
          'Please enter your name.',
          'error'
        );

        return;
      }


      if (
        !email ||
        !EMAIL_REGEX.test(email)
      ) {

        showToast(
          'Please enter a valid email address.',
          'error'
        );

        return;
      }


      const message = `
Service Request: ${service.name}

Quantity: ${quantity} kg
Packaging: ${packageType}
Roast Level: ${roast}

Special Instructions:
${notes || 'None'}
      `.trim();


      const button =
        document.getElementById(
          'customOrderBtn'
        );


      button.disabled = true;

      button.textContent =
        'Sending...';


      try {

        const response =
          await fetch(
            `${API_BASE}/enquiries`,
            {

              method: 'POST',

              headers: {
                'Content-Type':
                  'application/json'
              },

              body: JSON.stringify({
                name,
                email,
                message
              })

            }
          );


        const data =
          await response.json();


        if (
          !response.ok ||
          !data.success
        ) {

          throw new Error(
            data.error ||
            data.message ||
            'Failed to send service enquiry.'
          );

        }


        showToast(
          'Service enquiry sent successfully! We will contact you soon.',
          'success'
        );


        closeModal('serviceModal');


      } catch (error) {

        console.error(
          'Service enquiry error:',
          error
        );


        showToast(
          error.message ||
          'Failed to send enquiry. Please try again.',
          'error'
        );


      } finally {

        button.disabled = false;

        button.textContent =
          'Send Service Enquiry';

      }

    }
  );

}


/* SECTION 8 — CONTACT FOR */
const contactForm =
  document.getElementById('contactForm');
const submitBtn =
  document.getElementById('submitBtn');
const contactSuccess =
  document.getElementById('contactSuccess');
const contactError =
  document.getElementById('contactError');
function validateField(field, value) {
  const v = value.trim();
  switch (field) {
    case 'name':
      if (!v) {
        return 'Full name is required.';
      }
      if (v.length < 2) {
        return 'Name must be at least 2 characters.';
      }
      return '';
    case 'email':
      if (!v) {
        return 'Email address is required.';
      }
      if (!EMAIL_REGEX.test(v)) {
        return 'Please enter a valid email address.';
      }
      return '';
    case 'message':
      if (!v) {
        return 'Message cannot be empty.';
      }
      if (v.length < 10) {
        return 'Message is too short (min 10 characters).';
      }
      return '';
    default:
      return '';
  }
}function setFieldError(
  fieldId,
  errorId,
  message
) {
  const input =
    document.getElementById(fieldId);
  const error =
    document.getElementById(errorId);
  if (!input || !error) return;
  if (message) {
    error.textContent =
      message;
    input.classList.add('error');
    input.setAttribute(
      'aria-invalid',
      'true'
    );
  } else {
    error.textContent = '';
    input.classList.remove('error');
    input.setAttribute(
      'aria-invalid',
      'false'
    );
  }
}
function clearFormErrors() {
  setFieldError(
    'cName',
    'cNameError',
    ''
  );
  setFieldError(
    'cEmail',
    'cEmailError',
    ''
  );
  setFieldError(
    'cMessage',
    'cMessageError',
    ''
  );
}
function hideFormFeedback() {
  if (contactSuccess) {
    contactSuccess.hidden = true;
  }
  if (contactError) {
    contactError.hidden = true;
  }
}
['cName', 'cEmail', 'cMessage']
  .forEach(id => {
    const input =
      document.getElementById(id);
    if (!input) return;
    const fieldMap = {
      cName: 'name',
      cEmail: 'email',
      cMessage: 'message'
    };
    const errorMap = {
      cName: 'cNameError',
      cEmail: 'cEmailError',
      cMessage: 'cMessageError'
    };
    input.addEventListener(
      'blur',
      () => {

        const error =
          validateField(
            fieldMap[id],
            input.value
          );
        setFieldError(
          id,
          errorMap[id],
          error
        );
      }
    );
  });
if (contactForm) {
  contactForm.addEventListener(
    'submit',
    event => {
      event.preventDefault();
      hideFormFeedback();
      clearFormErrors();
      const nameVal =
        document
          .getElementById('cName')
          .value;
      const emailVal =
        document
          .getElementById('cEmail')
          .value;
      const messageVal =
        document
          .getElementById('cMessage')
          .value;
      const nameErr =
        validateField(
          'name',
          nameVal
        );
      const emailErr =
        validateField(
          'email',
          emailVal
        );
      const messageErr =
        validateField(
          'message',
          messageVal
        );
      setFieldError(
        'cName',
        'cNameError',
        nameErr
      );
      setFieldError(
        'cEmail',
        'cEmailError',
        emailErr
      );
      setFieldError(
        'cMessage',
        'cMessageError',
        messageErr
      );
      if (
        nameErr ||
        emailErr ||
        messageErr
      ) {
        return;
      }
      if (submitBtn) {
        submitBtn.classList.add(
          'loading'
        );
        submitBtn.disabled = true;
      }
      setTimeout(() => {
        if (submitBtn) {
          submitBtn.classList.remove(
            'loading'
          );
          submitBtn.disabled = false;
        }
        contactForm.reset();
        if (contactSuccess) {
          contactSuccess.hidden = false;
        }
        showToast(
          'Message sent successfully!',
          'success'
        );
      }, 1000);
    }
  );
}
/* SECTION 9 — PRODUCT AND SERVICE SLIDERS */

const menuSlider =
  document.getElementById('menuGrid');
const menuPrev =
  document.getElementById('menuPrev');
const menuNext =
  document.getElementById('menuNext');
if (
  menuPrev &&
  menuNext &&
  menuSlider
) {
  menuPrev.addEventListener(
    'click',
    () => {
      menuSlider.scrollBy({
        left: -350,
        behavior: 'smooth'
      });
    }
  );
  menuNext.addEventListener(
    'click',
    () => {
      menuSlider.scrollBy({
        left: 350,
        behavior: 'smooth'
      });
    }
  );
}
const serviceSlider =
  document.getElementById('serviceGrid');
const servicePrev =
  document.getElementById('servicePrev');
const serviceNext =
  document.getElementById('serviceNext');
if (
  servicePrev &&
  serviceNext &&
  serviceSlider
) {
  servicePrev.addEventListener(
    'click',
    () => {
      serviceSlider.scrollBy({
        left: -350,
        behavior: 'smooth'
      });
    }
  );
  serviceNext.addEventListener(
    'click',
    () => {
      serviceSlider.scrollBy({
        left: 350,
        behavior: 'smooth'
      });
    }
  );
}
/* SECTION 10 — TOAST */
const toastEl =
  document.getElementById('toast');
let toastTimer = null;
function showToast(
  message,
  type = '',
  duration = 3000
) {
  if (!toastEl) return;
  clearTimeout(toastTimer);
const iconMap = {
    success:
      '<i class="fa-solid fa-circle-check" aria-hidden="true"></i>',
    error:
      '<i class="fa-solid fa-circle-exclamation" aria-hidden="true"></i>',
  };
  toastEl.innerHTML = `
    ${iconMap[type] || ''}
    <span>${escapeHTML(message)}</span>
  `;
  toastEl.className =
    `toast ${type} show`;
  toastTimer =
    setTimeout(() => {
      toastEl.classList.remove('show');
    }, duration);
}

/* ABOUT SLIDER */

const slides =
  document.querySelectorAll('.about-slide');
let currentSlide = 0;
if (slides.length > 0) {
  setInterval(() => {
    slides[currentSlide]
      .classList.remove('active');
    currentSlide =
      (currentSlide + 1) %
      slides.length;
    slides[currentSlide]
      .classList.add('active');

  }, 4000);

}
/*  ESCAPE KEY */
document.addEventListener(
  'keydown',
  event => {
    if (event.key === 'Escape') {
      closeCartDrawer();
      closeModal('serviceModal');
      closeModal('checkoutModal');
      closeModal('paymentModal');
    }
  }
);
/* INITIALIZATION */
window.addEventListener(
  'DOMContentLoaded',
  () => {
    handleNavScroll();
    updateActiveLink();
    renderServices();
    fetchProducts();
  }
);
'use strict';


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



let cart = [];

/* nav */

const navbar = document.getElementById('navbar');
const navLinks = document.querySelectorAll('.nav-link');
const sections = document.querySelectorAll('section[id]');

function handleNavScroll() {
  navbar.classList.toggle('scrolled', window.scrollY > 60);
}

function updateActiveLink() {

  let current = '';

  sections.forEach(section => {

    const sectionTop = section.offsetTop - 120;

    if(window.scrollY >= sectionTop){
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

}, { passive:true });

/*  MOBILE MENU */

const hamburger = document.getElementById('hamburger');
const mobileMenu = document.getElementById('mobileMenu');

hamburger.addEventListener('click', () => {

  mobileMenu.classList.toggle('open');

  hamburger.classList.toggle('open');

});

/*   MENU */

const menuGrid = document.getElementById('menuGrid');
const tabs = document.querySelectorAll('.tab');

function formatCategory(cat){

  const map = {
    green:'Green Coffee',
    roasted:'Roasted Coffee',
    bulk:'Bulk Supply',
    service:'Processing Service',
  };

  return map[cat] || cat;
}

function createMenuItemHTML(item){

  return `
  
    <article class="menu-item">

      ${item.popular ? '<span class="menu-item__badge">Popular</span>' : ''}

      <div class="menu-image">
   <img src="${item.image}" alt="${item.name}">
</div>

      <p class="menu-item__category">
        ${formatCategory(item.category)}
      </p>

      <h3 class="menu-item__name">
        ${item.name}
      </h3>

      <p class="menu-item__desc">
        ${item.desc}
      </p>

      <div class="menu-item__footer">

        <span class="menu-item__price">
          $${item.price.toFixed(2)}
        </span>

        <button
          class="menu-item__add ${item.category === 'service' ? 'service-btn' : ''}"
          data-id="${item.id}"
        >
          +
        </button>

      </div>

    </article>

  `;
}

function renderMenuItems(category='all'){

  const filtered = category === 'all'
    ? MENU_ITEMS
    : MENU_ITEMS.filter(item => item.category === category);

  menuGrid.innerHTML = filtered
    .map(item => createMenuItemHTML(item))
    .join('');

  menuGrid.querySelectorAll('.menu-item__add').forEach(btn => {

    btn.addEventListener('click', () => {

      const id = parseInt(btn.dataset.id);

      const item = MENU_ITEMS.find(m => m.id === id);

      if(item.category === 'service'){
        openServicePage(item);
      }else{
        addToCart(id);
      }

    });

  });

}

tabs.forEach(tab => {

  tab.addEventListener('click', () => {

    tabs.forEach(t => t.classList.remove('active'));

    tab.classList.add('active');

    renderMenuItems(tab.dataset.category);

  });

});

renderMenuItems();

/* 
   CART LOGIC
*/
function addToCart(id){

  const item = MENU_ITEMS.find(m => m.id === id);

  const existing = cart.find(c => c.id === id);

  if(existing){

    existing.qty += 1;

  }else{

    cart.push({
      id:item.id,
      name:item.name,
      price:item.price,
      qty:1,
    });

  }

  renderCart();

  showToast(`${item.name} added to cart`, 'success');

}

function removeFromCart(id){

  cart = cart.filter(item => item.id !== id);

  renderCart();

}

function renderCart(){

  const cartItemsEl = document.getElementById('cartItems');
  const cartTotalAmountEl = document.getElementById('cartTotalAmount');

  if(cart.length === 0){

    cartItemsEl.innerHTML =
      '<p class="cart-empty">No items added yet.</p>';

    cartTotalAmountEl.textContent = '$0.00';

    return;
  }

  cartItemsEl.innerHTML = cart.map(item => `

    <div class="cart-row">

      <span>${item.name}</span>

      <span>x${item.qty}</span>

      <span>$${(item.price * item.qty).toFixed(2)}</span>

      <button
        class="cart-row__remove"
        data-id="${item.id}"
      >
        ✕
      </button>

    </div>

  `).join('');

  cartItemsEl.querySelectorAll('.cart-row__remove').forEach(btn => {

    btn.addEventListener('click', () => {

      removeFromCart(parseInt(btn.dataset.id));

    });

  });

  const total = cart.reduce((sum,item) => {

    return sum + item.price * item.qty;

  },0);

  cartTotalAmountEl.textContent = `$${total.toFixed(2)}`;

}

/*  PAYMENT SYSTEM*/

const paymentModal = document.getElementById('paymentModal');
const checkoutBtn = document.getElementById('checkoutBtn');
const closePayment = document.getElementById('closePayment');
const paymentCards = document.querySelectorAll('.payment-card');
const payNowBtn = document.getElementById('payNowBtn');

let selectedPayment = '';

checkoutBtn.addEventListener('click', () => {

  if(cart.length === 0){

    showToast('Your cart is empty.', 'error');

    return;
  }

  paymentModal.classList.add('show');

});

closePayment.addEventListener('click', () => {

  paymentModal.classList.remove('show');

});

paymentCards.forEach(card => {

  card.addEventListener('click', () => {

    paymentCards.forEach(c => c.classList.remove('active'));

    card.classList.add('active');

    selectedPayment = card.dataset.method;

  });

});

payNowBtn.addEventListener('click', () => {

  if(!selectedPayment){

    showToast('Select payment method.', 'error');

    return;
  }

  payNowBtn.textContent = 'Processing...';

  payNowBtn.disabled = true;

  setTimeout(() => {

    showToast('Payment successful ', 'success');

    paymentModal.classList.remove('show');

    cart = [];

    renderCart();

    payNowBtn.textContent = 'Confirm Payment';

    payNowBtn.disabled = false;

  },2000);

});
/* 
   SERVICE CUSTOMIZATION
 */

const serviceModal = document.getElementById('serviceModal');
const serviceContent = document.getElementById('serviceContent');

/* OPEN SERVICE PAGE */

function openServicePage(item){

  if(!serviceModal || !serviceContent){
    console.error('Service modal elements missing');
    return;
  }

  serviceModal.classList.add('show');

  serviceContent.innerHTML = `

    <button id="closeServiceModal" class="close-service">
      ✕
    </button>

    <h2 class="service-title">
      ${item.name}
    </h2>

    <p class="service-desc">
      ${item.desc}
    </p>

    <div class="custom-grid">

      <div class="custom-group">
        <label>Order Quantity (kg)</label>

        <input
          type="number"
          id="serviceQty"
          value="1"
          min="1"
        >
      </div>

      <div class="custom-group">

        <label>Packaging Type</label>

        <select id="servicePackage">
          <option>Export Bags</option>
          <option>Vacuum Packaging</option>
          <option>Retail Packaging</option>
          <option>Private Label Packaging</option>
        </select>

      </div>

      <div class="custom-group">

        <label>Roast Level</label>

        <select id="serviceRoast">
          <option>Light Roast</option>
          <option>Medium Roast</option>
          <option>Dark Roast</option>
        </select>

      </div>

      <div class="custom-group">

        <label>Special Instructions</label>

        <textarea
          id="serviceNotes"
          placeholder="Additional requests..."
        ></textarea>

      </div>

    </div>

    <div class="service-total">

      Total:
      $<span id="servicePrice">
        ${item.price.toFixed(2)}
      </span>

    </div>

    <button
      class="custom-order-btn"
      id="customOrderBtn"
    >
      Add Customized Order
    </button>

  `;

  /* CLOSE BUTTON */

  document
    .getElementById('closeServiceModal')
    .addEventListener('click', () => {

      serviceModal.classList.remove('show');

    });

  /* PRICE UPDATE */

  const qtyInput = document.getElementById('serviceQty');
  const totalPrice = document.getElementById('servicePrice');

  qtyInput.addEventListener('input', () => {

    const qty = parseInt(qtyInput.value) || 1;

    totalPrice.textContent =
      (qty * item.price).toFixed(2);

  });

  /* ADD CUSTOM ORDER */

  document
    .getElementById('customOrderBtn')
    .addEventListener('click', () => {

      const qty =
        parseInt(qtyInput.value) || 1;

      const packageType =
        document.getElementById('servicePackage').value;

      const roast =
        document.getElementById('serviceRoast').value;

      cart.push({

        id:item.id,

        name:`${item.name} (${packageType}, ${roast})`,

        price:item.price,

        qty:qty,

      });

      renderCart();

      serviceModal.classList.remove('show');

      showToast(
        'Customized order added ',
        'success'
      );

    });
  }

/*
   TOAST
*/

const toastEl = document.getElementById('toast');

let toastTimer = null;

function showToast(message, type=''){

  toastEl.textContent = message;

  toastEl.className = `toast ${type} show`;

  clearTimeout(toastTimer);

  toastTimer = setTimeout(() => {

    toastEl.classList.remove('show');

  },3000);

}

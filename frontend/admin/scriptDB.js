 
  const API_BASE = window.MISRAK_API_BASE || 'http://127.0.0.1:5000/api/v1';

 
 
  let authToken = null;
  let currentAdmin = null;

  /* ── INIT ──────────────────────────────────────── */
  document.addEventListener('DOMContentLoaded', () => {
    setPageDate();
    applyStoredTheme();

    // Allow pressing Enter in login form
    document.getElementById('loginPassword').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') handleLogin();
    });
    document.getElementById('loginEmail').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') document.getElementById('loginPassword').focus();
    });

   
    validateToken();
  });

  /* ── DATE ──────────────────────────────────────── */
  function setPageDate() {
    const opts = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    document.getElementById('pageDate').textContent = new Date().toLocaleDateString('en-US', opts);
  }

  /* ── THEME ─────────────────────────────────────── */
  function applyStoredTheme() {
    const saved = localStorage.getItem('mc_theme') || 'light';
    document.documentElement.setAttribute('data-theme', saved);
    updateThemeIcon(saved);
  }

  function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('mc_theme', next);
    updateThemeIcon(next);
  }

  function updateThemeIcon(theme) {
    const btn = document.getElementById('themeBtn');
    btn.innerHTML = theme === 'dark'
      ? '<i class="fa-solid fa-sun"></i>'
      : '<i class="fa-solid fa-moon"></i>';
    btn.title = theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode';
  }

  /* ── SIDEBAR ───────────────────────────────────── */
  function openSidebar() {
    document.getElementById('sidebar').classList.add('open');
    document.getElementById('sidebarOverlay').classList.add('active');
    document.body.style.overflow = 'hidden';
  }
  function closeSidebar() {
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('sidebarOverlay').classList.remove('active');
    document.body.style.overflow = '';
  }

  /* ── PAGE NAVIGATION ───────────────────────────── */
  const pages = ['dashboard', 'products', 'orders', 'customers', 'messages', 'settings'];
  const _pageLoaded = { products: false, orders: false, customers: false, messages: false };

  function setActivePage(page, navEl) {
    pages.forEach(p => {
      const el = document.getElementById(`page-${p}`);
      if (el) el.style.display = p === page ? 'block' : 'none';
    });
    document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
    if (navEl) navEl.classList.add('active');

    const titles = {
      dashboard: 'Dashboard',
      products: 'Products',
      orders: 'Orders',
      customers: 'Customers',
      messages: 'Messages',
      settings: 'Settings',
    };
    document.getElementById('pageTitle').textContent = titles[page] || page;
    closeSidebar();

    // Lazy-load each page on first visit
    if (page === 'products'  && !_pageLoaded.products)  { loadProducts();  _pageLoaded.products  = true; }
    if (page === 'orders'    && !_pageLoaded.orders)    { loadOrders();    _pageLoaded.orders    = true; }
    if (page === 'customers' && !_pageLoaded.customers) { loadCustomers(); _pageLoaded.customers = true; }
    if (page === 'messages' && !_pageLoaded.messages) { loadMessages(); _pageLoaded.messages = true; }
    if (page === 'settings') { loadBusinessSettings();}
  }

  /* ── AUTH: Login ───────────────────────────────── */
  async function handleLogin() {
    const email    = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;
    const btn      = document.getElementById('loginBtn');
    const errEl    = document.getElementById('loginError');

    errEl.classList.remove('visible');
    if (!email || !password) {
      showLoginError('Please enter both email and password.');
      return;
    }

    btn.disabled = true;
    document.getElementById('loginBtnText').innerHTML =
      '<i class="fa-solid fa-circle-notch fa-spin" style="margin-right:8px"></i>Signing in…';

    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.error || 'Login failed');

      
      authToken = 'active';
      currentAdmin = data.data;
      showApp();
    } catch (err) {
      showLoginError(err.message);
    } finally {
      btn.disabled = false;
      document.getElementById('loginBtnText').textContent = 'Sign In';
    }
  }

  function showLoginError(msg) {
    const el = document.getElementById('loginError');
    el.textContent = msg;
    el.classList.add('visible');
  }

  /* ── AUTH: Validate session via cookie ─────────── */
  async function validateToken() {
    try {
      
      const res = await fetch(`${API_BASE}/auth/me`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Session invalid');
      const data = await res.json();
      currentAdmin = data.data;
      authToken = 'cookie';  // signal that we have an active session
      showApp();
    } catch {
      authToken = null;
      
    }
  }

  /* ── AUTH: Logout ──────────────────────────────── */
  async function handleLogout() {
    try {
      // Server clears the HttpOnly cookie via Set-Cookie: token=none
      await fetch(`${API_BASE}/auth/logout`, { credentials: 'include' });
    } catch {}
    authToken = null;
    currentAdmin = null;
    // No localStorage.removeItem needed
    document.getElementById('app').classList.remove('visible');
    document.getElementById('login-screen').classList.remove('hidden');
    document.getElementById('loginPassword').value = '';
    showToast('Signed out successfully', 'success');
  }

  /* SHOW APP  */
  function showApp() {
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('app').classList.add('visible');

    if (currentAdmin) {
      const initials = currentAdmin.name
        ? currentAdmin.name.split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase()
        : 'A';
      document.getElementById('adminName').textContent = currentAdmin.name || 'Admin';
      document.getElementById('adminRole').textContent = currentAdmin.role || 'admin';
      document.getElementById('adminAvatar').textContent = initials;
      document.getElementById('settingsAdminName').textContent = currentAdmin.name || 'Admin';
document.getElementById('settingsAdminEmail').textContent = currentAdmin.email || 'Not available';
document.getElementById('settingsAdminRole').textContent = currentAdmin.role || 'Admin';
    }

    loadDashboard();
  }

  /*  DASHBOARD DATA */
  async function loadDashboard() {
    try {
      // Cookie auth — no Authorization header needed
      const res = await fetch(`${API_BASE}/dashboard/stats`, {
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      renderDashboard(data.data);
    } catch (err) {
      // Show demo data when no backend is running
      renderDashboard(getDemoData());
      showToast('Demo mode — connect your backend to see live data', 'info');
    }
  }

  function getDemoData() {
    return {
      overview: { totalOrders: 247, totalProducts: 18, totalCustomers: 84, revenue: 312450 },
      growth: { ordersThisMonth: 34, ordersLastMonth: 28, orderGrowthPercent: 21.4 },
      ordersByStatus: { pending: 12, confirmed: 8, processing: 5, shipped: 6, delivered: 194, cancelled: 22 },
      recentOrders: [
        { orderNumber: 'MC-00247', customer: { name: 'Brûlerie de Paris' }, totalAmount: 8400, status: 'shipped', createdAt: new Date().toISOString() },
        { orderNumber: 'MC-00246', customer: { name: 'Nordic Roasters AB' }, totalAmount: 12750, status: 'confirmed', createdAt: new Date(Date.now()-86400000).toISOString() },
        { orderNumber: 'MC-00245', customer: { name: 'Caffè Roma S.r.l.' }, totalAmount: 6200, status: 'processing', createdAt: new Date(Date.now()-172800000).toISOString() },
        { orderNumber: 'MC-00244', customer: { name: 'Tokyo Bean House' }, totalAmount: 9800, status: 'delivered', createdAt: new Date(Date.now()-259200000).toISOString() },
        { orderNumber: 'MC-00243', customer: { name: 'Brooklyn Roast Co.' }, totalAmount: 4100, status: 'pending', createdAt: new Date(Date.now()-345600000).toISOString() },
      ],
    };
  }

  function renderDashboard(d) {
    const { overview, growth, ordersByStatus, recentOrders } = d;

    // Animate numbers
    animateCount('stat-orders', overview.totalOrders);
    animateCount('stat-products', overview.totalProducts);
    animateCount('stat-customers', overview.totalCustomers);
    animateCount('stat-revenue', overview.revenue, true);

    // Growth indicators
    const g = growth.orderGrowthPercent;
    const dir = g > 0 ? 'up' : g < 0 ? 'down' : 'neutral';
    const arrow = g > 0 ? '↑' : g < 0 ? '↓' : '–';
    document.getElementById('stat-orders-change').className = `stat-change ${dir}`;
    document.getElementById('stat-orders-change').textContent =
      `${arrow} ${Math.abs(g)}% vs last month`;

    document.getElementById('stat-products-change').className = 'stat-change neutral';
    document.getElementById('stat-products-change').textContent = '— Available for export';

    document.getElementById('stat-customers-change').className = 'stat-change up';
    document.getElementById('stat-customers-change').textContent = '↑ Active importers';

    document.getElementById('stat-revenue-change').className = 'stat-change up';
    document.getElementById('stat-revenue-change').textContent = '↑ Cumulative revenue';

    // Pending badge
    const pending = ordersByStatus?.pending ?? 0;
    document.getElementById('pendingBadge').textContent = pending > 0 ? pending : '—';

    // Recent orders table
    renderRecentOrders(recentOrders);

    // Status breakdown
    renderStatusBreakdown(ordersByStatus, overview.totalOrders);
  }

  function animateCount(id, target, isCurrency = false) {
    const el = document.getElementById(id);
    if (!el) return;
    const start = 0;
    const duration = 1200;
    const startTime = performance.now();

    function update(now) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(start + (target - start) * ease);

      el.textContent = isCurrency
        ? '$' + current.toLocaleString()
        : current.toLocaleString();

      if (progress < 1) requestAnimationFrame(update);
    }
    requestAnimationFrame(update);
  }

  function renderRecentOrders(orders) {
    const container = document.getElementById('recentOrdersContainer');
    if (!orders || orders.length === 0) {
      container.innerHTML = '<div class="empty-state">No orders yet.</div>';
      return;
    }

    const rows = orders.map(o => {
      const date = new Date(o.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      return `
        <tr>
          <td><span class="order-num">${o.orderNumber}</span></td>
          <td>${o.customer?.name || '—'}</td>
          <td>$${Number(o.totalAmount).toLocaleString()}</td>
          <td><span class="status-badge status-${o.status}">${capitalize(o.status)}</span></td>
          <td style="color:var(--text-muted);font-size:0.8rem">${date}</td>
        </tr>`;
    }).join('');

    container.innerHTML = `
      <table class="orders-table">
        <thead>
          <tr>
            <th>Order #</th>
            <th>Customer</th>
            <th>Amount</th>
            <th>Status</th>
            <th>Date</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>`;
  }

  function renderStatusBreakdown(statusMap, total) {
    const container = document.getElementById('statusBreakdown');
    if (!statusMap) { container.innerHTML = '<div class="empty-state">No data.</div>'; return; }

    const statuses = ['pending','confirmed','processing','shipped','delivered','cancelled'];
    const rows = statuses.map(s => {
      const count = statusMap[s] ?? 0;
      const pct = total > 0 ? Math.round((count / total) * 100) : 0;
      return `
        <div class="status-row">
          <div class="status-dot dot-${s}"></div>
          <div>
            <div class="status-row-label">${capitalize(s)}</div>
            <div class="status-bar-track" style="width:120px">
              <div class="status-bar-fill fill-${s}" style="width:0%" data-target="${pct}%"></div>
            </div>
          </div>
          <div class="status-row-count">${count}</div>
        </div>`;
    }).join('');

    container.innerHTML = rows;

    // Animate bars after paint
    requestAnimationFrame(() => {
      setTimeout(() => {
        container.querySelectorAll('.status-bar-fill').forEach(bar => {
          bar.style.width = bar.dataset.target;
        });
      }, 100);
    });
  }

  /*  TOAST */
  function showToast(msg, type = 'info') {
    const toast = document.getElementById('toast');
    const icon = document.getElementById('toastIcon');
    document.getElementById('toastMsg').textContent = msg;

    toast.className = type === 'error' ? 'error' : type === 'success' ? 'success' : '';
    icon.className = type === 'success'
      ? 'fa-solid fa-circle-check'
      : type === 'error'
      ? 'fa-solid fa-circle-xmark'
      : 'fa-solid fa-circle-info';

    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3500);
  }

  /*  HELPERS */

  
  let _allOrders = [];

  async function loadOrders() {
    try {
      const res  = await apiFetch('/orders');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      _allOrders = data.data || [];
      renderOrdersTable(_allOrders);
    } catch (err) {
      document.getElementById('ordersBody').innerHTML =
        `<tr><td colspan="6" style="text-align:center;padding:2rem;color:#E88080">${err.message}</td></tr>`;
    }
  }

  function renderOrdersTable(orders) {
    document.getElementById('orders-count').textContent =
      `${orders.length} order${orders.length !== 1 ? 's' : ''}`;

    if (orders.length === 0) {
      document.getElementById('ordersBody').innerHTML =
        '<tr><td colspan="6" style="text-align:center;padding:2rem;color:var(--text-muted)">No orders found.</td></tr>';
      return;
    }
    const STATUS_OPTIONS = ['pending','confirmed','processing','shipped','delivered','cancelled'];
    document.getElementById('ordersBody').innerHTML = orders.map(o => {
      const date = new Date(o.createdAt).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});
      const opts = STATUS_OPTIONS.map(s =>
        `<option value="${s}"${o.status===s?' selected':''}>${capitalize(s)}</option>`).join('');
      return `<tr>
        <td><span class="order-num">${esc(o.orderNumber)}</span></td>
        <td>
          <div style="font-weight:500;font-size:0.9rem">${esc(o.customer?.name)||'—'}</div>
          <div style="font-size:0.75rem;color:var(--text-muted)">${esc(o.customer?.email)||''}</div>
        </td>
        <td style="font-weight:600">$${Number(o.totalAmount).toLocaleString()}</td>
        <td><span class="status-badge status-${esc(o.status)}">${capitalize(esc(o.status))}</span></td>
        <td style="color:var(--text-muted);font-size:0.8rem">${date}</td>
        <td>
          <select onchange="changeOrderStatus(${Number(o.id)},this.value,this)"
            style="font-size:0.78rem;padding:0.3rem 0.5rem;border:1px solid var(--border);border-radius:5px;background:var(--bg-surface);color:var(--text-primary);cursor:pointer">
            ${opts}
          </select>
        </td>
      </tr>`;
    }).join('');
  }

  function filterOrders(btn) {
    document.querySelectorAll('.orders-filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const status = btn.dataset.status;
    renderOrdersTable(status === 'all' ? _allOrders : _allOrders.filter(o => o.status === status));
  }

  async function changeOrderStatus(orderId, newStatus, selectEl) {
    selectEl.disabled = true;
    try {
      const res  = await apiFetch(`/orders/${orderId}/status`, {
        method: 'PATCH', body: JSON.stringify({ status: newStatus })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      const order = _allOrders.find(o => o.id === orderId);
      if (order) order.status = newStatus;
      const row   = selectEl.closest('tr');
      const badge = row.querySelector('.status-badge');
      badge.className   = `status-badge status-${newStatus}`;
      badge.textContent = capitalize(newStatus);
      showToast(`Status updated to ${newStatus}`, 'success');
    } catch (err) {
      const order = _allOrders.find(o => o.id === orderId);
      if (order) selectEl.value = order.status;
      showToast(err.message, 'error');
    } finally { selectEl.disabled = false; }
  }


  /*  PRODUCTS PAGE*/

  let _allProducts = [];

  async function loadProducts() {
    try {
      const res  = await apiFetch('/products');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      _allProducts = data.data || [];
      renderProductsTable(_allProducts);
    } catch (err) {
      document.getElementById('productsBody').innerHTML =
        `<tr><td colspan="7" style="text-align:center;padding:2rem;color:#E88080">${err.message}</td></tr>`;
    }
  }

  const CAT_LABELS = {'green-beans':'Green Beans','roasted':'Roasted','specialty':'Specialty','blend':'Blend'};

  function renderProductsTable(products) {
    document.getElementById('products-count').textContent =
      `${products.length} product${products.length!==1?'s':''}`;

    if (products.length === 0) {
      document.getElementById('productsBody').innerHTML =
        '<tr><td colspan="7" style="text-align:center;padding:2rem;color:var(--text-muted)">No products. Add one above.</td></tr>';
      return;
    }
    document.getElementById('productsBody').innerHTML = products.map(p => `
      <tr>
        <td style="font-weight:500;font-size:0.9rem">${esc(p.name)}</td>
        <td><span style="background:rgba(200,146,42,0.12);color:var(--brand-gold);font-size:0.72rem;font-weight:600;padding:2px 8px;border-radius:12px">${esc(CAT_LABELS[p.category]||p.category)}</span></td>
        <td style="font-weight:600">$${Number(p.pricePerKg).toFixed(2)}</td>
        <td>${Number(p.stock).toLocaleString()} kg</td>
        <td style="color:var(--text-muted)">${esc(p.region||'—')}</td>
        <td>
          <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:0.82rem">
            <input type="checkbox" ${p.isAvailable?'checked':''} onchange="toggleProduct(${Number(p.id)},this.checked,this)" />
            <span style="color:${p.isAvailable?'#6ABF8B':'var(--text-muted)'}">${p.isAvailable?'Available':'Hidden'}</span>
          </label>
        </td>
        <td><button class="btn-del" onclick="deleteProduct(${Number(p.id)})"><i class="fa-solid fa-trash-can"></i> Delete</button></td>
      </tr>`).join('');
  }

  async function toggleProduct(id, isAvailable, cb) {
    cb.disabled = true;
    try {
      const res  = await apiFetch(`/products/${id}`,{method:'PUT',body:JSON.stringify({isAvailable})});
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      const p = _allProducts.find(p=>p.id===id);
      if (p) p.isAvailable = isAvailable;
      const span = cb.closest('label').querySelector('span');
      span.textContent = isAvailable?'Available':'Hidden';
      span.style.color = isAvailable?'#6ABF8B':'var(--text-muted)';
      showToast(isAvailable?'Product now available':'Product hidden','success');
    } catch(err) { cb.checked = !isAvailable; showToast(err.message,'error'); }
    finally { cb.disabled = false; }
  }

  async function deleteProduct(id) {
    const product = _allProducts.find(p => p.id === id);
    const name = product ? product.name : 'this product';
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    try {
      const res  = await apiFetch(`/products/${id}`,{method:'DELETE'});
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      _allProducts = _allProducts.filter(p=>p.id!==id);
      renderProductsTable(_allProducts);
      showToast('Product deleted','success');
    } catch(err) { showToast(err.message,'error'); }
  }

  function openAddProductModal() {
    document.getElementById('addProductModal').style.display='flex';
    document.getElementById('addProductForm').reset();
    document.getElementById('addProductError').style.display='none';
  }
  function closeAddProductModal() {
    document.getElementById('addProductModal').style.display='none';
  }
  document.getElementById('addProductModal').addEventListener('click',function(e){
    if(e.target===this) closeAddProductModal();
  });

  async function submitAddProduct(e) {
    e.preventDefault();
    const btn   = document.getElementById('addProductBtn');
    const errEl = document.getElementById('addProductError');
    errEl.style.display = 'none';
    const payload = {
      name:        document.getElementById('pName').value.trim(),
      category:    document.getElementById('pCategory').value,
      pricePerKg:  Number(document.getElementById('pPrice').value),
      minOrderKg:  Number(document.getElementById('pMinOrder').value)||1,
      stock:       Number(document.getElementById('pStock').value)||0,
      region:      document.getElementById('pRegion').value.trim()||undefined,
      description: document.getElementById('pDesc').value.trim()||undefined,
    };
    btn.disabled=true; btn.textContent='Adding…';
    try {
      const res  = await apiFetch('/products',{method:'POST',body:JSON.stringify(payload)});
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      _allProducts.unshift(data.data);
      renderProductsTable(_allProducts);
      closeAddProductModal();
      showToast(`"${data.data.name}" added`,'success');
    } catch(err) { errEl.textContent=err.message; errEl.style.display='block'; }
    finally { btn.disabled=false; btn.textContent='Add Product'; }
  }


  /*  CUSTOMERS PAGE */

  async function loadCustomers() {
    try {
      const res  = await apiFetch('/orders');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      const map = new Map();
      (data.data||[]).forEach(order => {
        const email = order.customer?.email;
        if (!email) return;
        if (!map.has(email)) {
          map.set(email,{
            name:        order.customer.name,
            email,
            company:     order.customer.company||'—',
            country:     order.customer.country||'—',
            totalOrders: 0, totalSpent: 0,
            firstOrder:  order.createdAt,
          });
        }
        const c = map.get(email);
        c.totalOrders++;
        c.totalSpent += Number(order.totalAmount);
        if (new Date(order.createdAt) < new Date(c.firstOrder)) c.firstOrder = order.createdAt;
      });
      const customers = [...map.values()].sort((a,b)=>b.totalSpent-a.totalSpent);
      renderCustomersTable(customers);
    } catch(err) {
      document.getElementById('customersBody').innerHTML =
        `<tr><td colspan="7" style="text-align:center;padding:2rem;color:#E88080">${err.message}</td></tr>`;
    }
  }

  function renderCustomersTable(customers) {
    document.getElementById('customers-count').textContent =
      `${customers.length} customer${customers.length!==1?'s':''}`;
    if (customers.length===0) {
      document.getElementById('customersBody').innerHTML =
        '<tr><td colspan="7" style="text-align:center;padding:2rem;color:var(--text-muted)">No customers yet.</td></tr>';
      return;
    }
    document.getElementById('customersBody').innerHTML = customers.map(c => {
      const since = new Date(c.firstOrder).toLocaleDateString('en-US',{month:'short',year:'numeric'});
      const initials = c.name.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
      return `<tr>
        <td>
          <div style="display:flex;align-items:center;gap:10px">
            <div style="width:34px;height:34px;border-radius:50%;background:rgba(200,146,42,0.15);color:var(--brand-gold);display:flex;align-items:center;justify-content:center;font-size:0.72rem;font-weight:700;flex-shrink:0">${esc(initials)}</div>
            <div style="font-weight:500;font-size:0.9rem">${esc(c.name)}</div>
          </div>
        </td>
        <td style="font-size:0.82rem;color:var(--text-muted)">${esc(c.email)}</td>
        <td style="font-size:0.85rem">${esc(c.company)}</td>
        <td style="font-size:0.85rem">${esc(c.country)}</td>
        <td style="font-weight:600;text-align:center">${Number(c.totalOrders)}</td>
        <td style="font-weight:600;color:var(--brand-gold)">$${Number(c.totalSpent).toLocaleString()}</td>
        <td style="color:var(--text-muted);font-size:0.8rem">${esc(since)}</td>
      </tr>`;
    }).join('');
  }


 
  function apiFetch(path, options={}) {
    const { headers: _headers, ...rest } = options;
    return fetch(`${API_BASE}${path}`, {
      ...rest,
      headers: {
        'Content-Type': 'application/json',
        ...(_headers || {}),
      },
      credentials: 'include',
    });
  }

 
  function esc(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;');
  }

  function capitalize(str) {
    return str ? str.charAt(0).toUpperCase() + str.slice(1) : '';
  
  }
  document.getElementById('passwordForm').addEventListener('submit', updatePassword);

async function updatePassword(event) {
  event.preventDefault();

  const currentPassword =
    document.getElementById('currentPassword').value;

  const newPassword =
    document.getElementById('newPassword').value;

  const confirmPassword =
    document.getElementById('confirmPassword').value;

  // Check if the new passwords match
  if (newPassword !== confirmPassword) {
    showToast('New passwords do not match.', 'error');
    return;
  }

  // Minimum password length
  if (newPassword.length < 8) {
    showToast('Password must be at least 8 characters.', 'error');
    return;
  }

  try {
    const button = document.querySelector('#passwordForm button[type="submit"]');

    button.disabled = true;
    button.innerHTML =
      '<i class="fa-solid fa-circle-notch fa-spin"></i> Updating...';

    const res = await fetch(`${API_BASE}/auth/updatepassword`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include',
      body: JSON.stringify({
        currentPassword,
        newPassword
      })
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || 'Failed to update password.');
    }

    showToast('Password updated successfully!', 'success');

    // Clear the form
    document.getElementById('passwordForm').reset();

  } catch (error) {
    showToast(error.message, 'error');

  } finally {
    const button = document.querySelector('#passwordForm button[type="submit"]');

    button.disabled = false;
    button.innerHTML =
      '<i class="fa-solid fa-key"></i> Update Password';
  }
}
async function loadBusinessSettings() {
  try {
    const res = await fetch(`${API_BASE}/business-settings`, {
      credentials: 'include'
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || 'Failed to load business settings');
    }

    const settings = data.data;

    document.getElementById('businessName').value =
      settings.businessName || '';

    document.getElementById('businessEmail').value =
      settings.businessEmail || '';

    document.getElementById('businessPhone').value =
      settings.businessPhone || '';

    document.getElementById('businessAddress').value =
      settings.businessAddress || '';

    document.getElementById('businessWebsite').value =
      settings.businessWebsite || '';

    document.getElementById('businessLogo').value =
      settings.businessLogo || '';

  } catch (error) {
    console.error('Business settings error:', error);
    showToast(error.message, 'error');
  }
}
document
  .getElementById('businessSettingsForm')
  .addEventListener('submit', updateBusinessSettings);


async function updateBusinessSettings(event) {
  event.preventDefault();

  const button = document.querySelector(
    '#businessSettingsForm button[type="submit"]'
  );

  const originalHTML = button.innerHTML;

  const settings = {
    businessName:
      document.getElementById('businessName').value.trim(),

    businessEmail:
      document.getElementById('businessEmail').value.trim(),

    businessPhone:
      document.getElementById('businessPhone').value.trim(),

    businessAddress:
      document.getElementById('businessAddress').value.trim(),

    businessWebsite:
      document.getElementById('businessWebsite').value.trim(),

    businessLogo:
      document.getElementById('businessLogo').value.trim()
  };

  try {
    button.disabled = true;

    button.innerHTML =
      '<i class="fa-solid fa-circle-notch fa-spin"></i> Saving...';

    const res = await fetch(`${API_BASE}/business-settings`, {
      method: 'PUT',

      headers: {
        'Content-Type': 'application/json'
      },

      credentials: 'include',

      body: JSON.stringify(settings)
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(
        data.error || 'Failed to save business settings'
      );
    }

    showToast(
      'Business settings saved successfully!',
      'success'
    );

  } catch (error) {
    console.error('Business settings update error:', error);

    showToast(error.message, 'error');

  } finally {
    button.disabled = false;
    button.innerHTML = originalHTML;
  }
}
function updateDashboardGreeting() {
  const hour = new Date().getHours();
  const greeting = document.getElementById('dashboardGreeting');

  if (!greeting) return;

  if (hour < 12) {
    greeting.textContent = 'Good morning ☕';
  } else if (hour < 18) {
    greeting.textContent = 'Good afternoon ☕';
  } else {
    greeting.textContent = 'Good evening ☕';
  }
}

updateDashboardGreeting();
let _allMessages = [];

async function loadMessages() {
  try {
    const res = await apiFetch('/enquiries');
    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || 'Failed to load messages.');
    }

    _allMessages = data.data || [];

    renderMessagesTable(_allMessages);

  } catch (err) {

    document.getElementById('messagesBody').innerHTML = `
      <tr>
        <td
          colspan="5"
          style="text-align:center;padding:2rem;color:#E88080"
        >
          ${err.message}
        </td>
      </tr>
    `;
  }
}

function renderMessagesTable(messages) {

  document.getElementById('messages-count').textContent =
    `${messages.length} message${messages.length !== 1 ? 's' : ''}`;

  if (messages.length === 0) {

    document.getElementById('messagesBody').innerHTML = `
      <tr>
        <td
          colspan="5"
          style="text-align:center;padding:2rem;color:var(--text-muted)"
        >
          No customer messages yet.
        </td>
      </tr>
    `;

    return;
  }

  document.getElementById('messagesBody').innerHTML =
    messages.map(message => {

      const date = new Date(message.createdAt).toLocaleDateString(
        'en-US',
        {
          month: 'short',
          day: 'numeric',
          year: 'numeric'
        }
      );

      return `
        <tr>

          <td style="font-weight:600">
            ${esc(message.name)}
          </td>

          <td>
            ${esc(message.email)}
          </td>

          <td style="max-width:350px;white-space:normal">
            ${esc(message.message)}
          </td>

          <td>
            <span class="status-badge">
              ${esc(message.status)}
            </span>
          </td>

          <td>
            ${date}
          </td>

        </tr>
      `;

    }).join('');
}
/* =========================================================
   STOCK MANAGEMENT & DAILY SALES
   Loaded after scriptDB.js — reuses its helpers:
   apiFetch, esc, capitalize, showToast, setActivePage
   ========================================================= */
(function () {
  'use strict';

  /* ── helpers ─────────────────────────────────────── */
  const $ = (id) => document.getElementById(id);
  const TZ = () => new Date().getTimezoneOffset();          // minutes, UTC − local
  const money = (n) => '$' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const kg = (n) => Number(n || 0).toLocaleString('en-US') + ' kg';
  const pad = (n) => String(n).padStart(2, '0');
  const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const addDays = (d, n) => { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate() + n); return x; };
  const fmtDateTime = (v) => {
    const d = new Date(v);
    return isNaN(d) ? '—' : d.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
  };
  const fmtDay = (s) => {
    const [y, m, d] = s.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  };
  const isWhole = (s) => /^\d+$/.test(String(s).trim());
  const showErr = (id, msg) => { const el = $(id); if (!el) return; el.textContent = msg; el.style.display = 'block'; };
  const hideErr = (id) => { const el = $(id); if (el) el.style.display = 'none'; };

  async function getJson(path, options) {
    const res = await apiFetch(path, options);
    let data = null;
    try { data = await res.json(); } catch { /* non-JSON */ }
    if (!res.ok) throw new Error((data && data.error) || `Request failed (${res.status})`);
    return data;
  }

  const STATUS_LABEL = { in_stock: 'In Stock', low_stock: 'Low Stock', out_of_stock: 'Out of Stock' };
  const TYPE_LABEL = {
    initial: 'Initial stock', restock: 'Restock', adjustment: 'Adjustment', sale: 'Walk-in sale',
    order: 'Online order', order_cancel: 'Order cancelled', sale_void: 'Sale voided',
  };
  const PAY_LABEL = { cash: 'Cash', telebirr: 'Telebirr', 'cbe-birr': 'CBE Birr', card: 'Card' };
  const CAT = { 'green-beans': 'Green Beans', roasted: 'Roasted', specialty: 'Specialty', blend: 'Blend' };

  /* ── modal plumbing ──────────────────────────────── */
  function openModal(id, focusId) {
    const m = $(id);
    m.classList.add('open');
    m.setAttribute('aria-hidden', 'false');
    if (focusId) setTimeout(() => { const f = $(focusId); if (f) f.focus(); }, 30);
  }
  function closeModal(id) {
    const m = $(id);
    m.classList.remove('open');
    m.setAttribute('aria-hidden', 'true');
  }
  const MODALS = ['stockModal', 'saleModal', 'voidModal', 'payModal', 'editProductModal'];
  MODALS.forEach((id) => {
    const m = $(id);
    if (!m) return;
    m.addEventListener('mousedown', (e) => { if (e.target === m && !m.dataset.busy) closeModal(id); });
  });
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    MODALS.forEach((id) => {
      const m = $(id);
      if (m && m.classList.contains('open') && !m.dataset.busy) closeModal(id);
    });
  });

  /* Only allow digits in whole-number kg fields */
  window.blockNonDigits = function (e) {
    if (['e', 'E', '+', '-', '.', ','].includes(e.key)) e.preventDefault();
  };

  /* =======================================================
     STOCK
     ======================================================= */
  let stockItems = [];
  let stockFilter = 'all';
  let stockLoaded = false;
  let stockDirty = false;                 // set when a sale/stock change happens elsewhere

  window.loadStockPage = async function (force) {
    if (stockLoaded && !stockDirty && !force) return;
    $('stockBody').innerHTML = '<tr><td colspan="6" class="table-msg">Loading stock…</td></tr>';
    try {
      const data = await getJson('/stock');
      stockItems = data.data || [];
      stockLoaded = true;
      stockDirty = false;
      renderStockSummary(data.summary);
      renderStockTable();
      fillHistoryProducts();
      updateStockBadge({ low: data.summary.lowStock, out: data.summary.outOfStock });
      // keep the history tab current if it is the one being shown
      if ($('stock-tab-history').style.display !== 'none') window.loadHistory(historyPage);
    } catch (err) {
      $('stockBody').innerHTML = `<tr><td colspan="6" class="table-msg error">${esc(err.message)}</td></tr>`;
      $('stock-count').textContent = '';
    }
  };

  function renderStockSummary(s) {
    $('stk-total').textContent = s.totalProducts.toLocaleString('en-US');
    $('stk-total-sub').textContent = `${kg(s.totalKg)} on hand`;
    $('stk-in').textContent = s.inStock.toLocaleString('en-US');
    $('stk-low').textContent = s.lowStock.toLocaleString('en-US');
    $('stk-out').textContent = s.outOfStock.toLocaleString('en-US');
  }

  window.updateStockBadge = function (alerts) {
    const badge = $('stockBadge');
    if (!badge || !alerts) return;
    const n = Number(alerts.low || 0) + Number(alerts.out || 0);
    badge.textContent = n;
    badge.style.display = n > 0 ? '' : 'none';
    badge.title = `${alerts.out || 0} out of stock, ${alerts.low || 0} low`;
  };

  window.filterStockStatus = function (btn) {
    document.querySelectorAll('#stock-tab-inventory [data-status]').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    stockFilter = btn.dataset.status;
    renderStockTable();
  };

  window.renderStockTable = function () {
    const q = ($('stockSearch').value || '').trim().toLowerCase();
    const rows = stockItems.filter((p) =>
      (stockFilter === 'all' || p.status === stockFilter) &&
      (!q || p.name.toLowerCase().includes(q) || (CAT[p.category] || '').toLowerCase().includes(q)));

    $('stock-count').textContent = `${rows.length} of ${stockItems.length} product${stockItems.length !== 1 ? 's' : ''}`;

    if (!rows.length) {
      $('stockBody').innerHTML = `<tr><td colspan="6" class="table-msg">${stockItems.length ? 'No products match this filter.' : 'No products yet. Add one on the Products page.'}</td></tr>`;
      return;
    }
    $('stockBody').innerHTML = rows.map((p) => `
      <tr>
        <td>
          <div class="cell-strong">${esc(p.name)}</div>
          <span class="cat-pill">${esc(CAT[p.category] || p.category)}</span>
        </td>
        <td class="cell-strong ${p.stock === 0 ? 'stock-zero' : ''}">${kg(p.stock)}</td>
        <td style="color:var(--text-muted)">${kg(p.lowStockThreshold)}</td>
        <td><span class="status-badge status-${esc(p.status)}">${STATUS_LABEL[p.status]}</span></td>
        <td style="color:var(--text-muted);font-size:0.8rem;white-space:nowrap">${p.lastMovementAt ? fmtDateTime(p.lastMovementAt) : '—'}</td>
        <td>
          <div class="row-actions">
            <button class="btn-mini" onclick="openStockModal(${Number(p.id)},'add')"><i class="fa-solid fa-plus"></i> Add</button>
            <button class="btn-mini" onclick="openStockModal(${Number(p.id)},'set')"><i class="fa-solid fa-sliders"></i> Adjust</button>
            <button class="btn-mini" onclick="showProductHistory(${Number(p.id)})"><i class="fa-solid fa-clock-rotate-left"></i> History</button>
          </div>
        </td>
      </tr>`).join('');
  };

  window.switchStockTab = function (btn) {
    document.querySelectorAll('#stockTabs .orders-filter-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    const tab = btn.dataset.tab;
    $('stock-tab-inventory').style.display = tab === 'inventory' ? 'block' : 'none';
    $('stock-tab-history').style.display = tab === 'history' ? 'block' : 'none';
    if (tab === 'history') loadHistory(1);
  };

  window.showProductHistory = function (productId) {
    document.querySelector('#stockTabs [data-tab="history"]').click();
    $('histProduct').value = String(productId);
    $('histType').value = '';
    $('histFrom').value = '';
    $('histTo').value = '';
    loadHistory(1);
  };

  /* ── stock modal (add / remove / set / threshold) ── */
  let stockModalProduct = null;
  const REASON_HINTS = {
    add: ['New delivery from supplier', 'Returned by customer', 'Production / roasting batch'],
    remove: ['Damaged or spoiled', 'Sample / tasting', 'Lost or stolen'],
    set: ['Stock-take / recount', 'Correction of earlier entry'],
  };

  window.openStockModal = function (productId, action) {
    stockModalProduct = stockItems.find((p) => p.id === productId);
    if (!stockModalProduct) return;
    hideErr('stockModalError');
    $('stockForm').reset();
    $('stockModalProduct').innerHTML =
      `<strong>${esc(stockModalProduct.name)}</strong> · currently ${kg(stockModalProduct.stock)}`;
    $('stockAction').value = action || 'add';
    onStockActionChange();
    openModal('stockModal', 'stockQty');
  };
  window.closeStockModal = () => closeModal('stockModal');

  window.onStockActionChange = function () {
    const a = $('stockAction').value;
    const qty = $('stockQty');
    const labels = {
      add: 'Quantity to add (kg)', remove: 'Quantity to remove (kg)',
      set: 'New stock count (kg)', threshold: 'Low-stock level (kg)',
    };
    $('stockQtyLabel').textContent = labels[a];
    qty.min = (a === 'set' || a === 'threshold') ? '0' : '1';
    qty.value = a === 'threshold' ? String(stockModalProduct.lowStockThreshold) : '';
    $('stockReasonWrap').style.display = a === 'threshold' ? 'none' : '';
    $('stockReason').value = '';
    $('stockReasonList').innerHTML = (REASON_HINTS[a] || []).map((r) => `<option value="${esc(r)}"></option>`).join('');
    $('stockSubmitBtn').textContent = a === 'threshold' ? 'Save level' : a === 'set' ? 'Set stock' : a === 'remove' ? 'Remove stock' : 'Add stock';
    hideErr('stockModalError');
    updateStockPreview();
  };

  window.updateStockPreview = function () {
    const p = stockModalProduct;
    const box = $('stockPreview');
    if (!p) return;
    const a = $('stockAction').value;
    const raw = $('stockQty').value.trim();
    box.classList.remove('bad');

    if (a === 'threshold') {
      box.innerHTML = raw !== '' && isWhole(raw)
        ? `Marked <strong>Low Stock</strong> when ${kg(Number(raw))} or less remains.`
        : 'Set the level at which this product is flagged as Low Stock.';
      return;
    }
    if (raw === '' || !isWhole(raw)) { box.textContent = 'Enter a quantity to preview the new stock level.'; return; }
    const q = Number(raw);
    let next;
    if (a === 'add') next = p.stock + q;
    else if (a === 'remove') next = p.stock - q;
    else next = q;

    if (next < 0) { box.classList.add('bad'); box.textContent = `Cannot remove ${kg(q)} — only ${kg(p.stock)} in stock.`; return; }
    if (next > 10000000) { box.classList.add('bad'); box.textContent = 'Stock cannot exceed 10,000,000 kg.'; return; }
    const st = next <= 0 ? 'out_of_stock' : next <= p.lowStockThreshold ? 'low_stock' : 'in_stock';
    box.innerHTML = `${kg(p.stock)} → <strong>${kg(next)}</strong> <span class="status-badge status-${st}">${STATUS_LABEL[st]}</span>`;
  };

  window.submitStockForm = async function (e) {
    e.preventDefault();
    const p = stockModalProduct;
    const a = $('stockAction').value;
    const raw = $('stockQty').value.trim();
    const reason = $('stockReason').value.trim();
    hideErr('stockModalError');

    if (raw === '') return showErr('stockModalError', 'Please enter a quantity.');
    if (!isWhole(raw)) return showErr('stockModalError', 'Quantity must be a whole number (no decimals or negatives).');
    const q = Number(raw);
    if ((a === 'add' || a === 'remove') && q < 1) return showErr('stockModalError', 'Quantity must be at least 1 kg.');
    if (q > 10000000) return showErr('stockModalError', 'Quantity cannot exceed 10,000,000 kg.');
    if (a === 'remove' && q > p.stock) return showErr('stockModalError', `Cannot remove ${kg(q)} — only ${kg(p.stock)} in stock.`);
    if (a === 'set' && q === p.stock) return showErr('stockModalError', `Stock is already ${kg(q)} — nothing to change.`);
    if (a !== 'threshold' && reason.length < 3) return showErr('stockModalError', 'Please give a reason (at least 3 characters).');

    const btn = $('stockSubmitBtn');
    const label = btn.textContent;
    btn.disabled = true; btn.textContent = 'Saving…';
    $('stockModal').dataset.busy = '1';
    try {
      if (a === 'threshold') {
        await getJson(`/stock/${p.id}/threshold`, { method: 'PATCH', body: JSON.stringify({ lowStockThreshold: q }) });
        showToast('Low-stock level updated', 'success');
      } else {
        await getJson(`/stock/${p.id}/movements`, { method: 'POST', body: JSON.stringify({ action: a, quantity: q, reason }) });
        showToast(`Stock updated for ${p.name}`, 'success');
      }
      closeModal('stockModal');
      await window.loadStockPage(true);
      if (typeof _pageLoaded !== 'undefined') _pageLoaded.products = false;  // Products page re-fetches its Stock column
    } catch (err) {
      showErr('stockModalError', err.message);
    } finally {
      delete $('stockModal').dataset.busy;
      btn.disabled = false; btn.textContent = label;
    }
  };

  /* ── movement history ────────────────────────────── */
  let historyPage = 1;

  function fillHistoryProducts() {
    const sel = $('histProduct');
    const cur = sel.value;
    sel.innerHTML = '<option value="">All products</option>' +
      stockItems.map((p) => `<option value="${Number(p.id)}">${esc(p.name)}</option>`).join('');
    sel.value = cur;
  }

  function validateRange(from, to, errId) {
    hideErr(errId);
    if ((from && !to) || (!from && to)) { showErr(errId, 'Please choose both a From and a To date, or leave both empty.'); return false; }
    if (from && to) {
      if (from > to) { showErr(errId, 'The From date cannot be after the To date.'); return false; }
      const days = (new Date(to) - new Date(from)) / 86400000 + 1;
      if (days > 366) { showErr(errId, 'Please choose a range of 366 days or less.'); return false; }
    }
    return true;
  }

  window.applyHistoryFilters = function () {
    if (!validateRange($('histFrom').value, $('histTo').value, 'histError')) return;
    loadHistory(1);
  };
  window.resetHistoryFilters = function () {
    $('histProduct').value = ''; $('histType').value = ''; $('histFrom').value = ''; $('histTo').value = '';
    hideErr('histError');
    loadHistory(1);
  };

  window.loadHistory = async function (page) {
    historyPage = page || 1;
    if (!stockLoaded) await window.loadStockPage(true);
    const qs = new URLSearchParams({ page: historyPage, limit: 20, tz: TZ() });
    if ($('histProduct').value) qs.set('productId', $('histProduct').value);
    if ($('histType').value) qs.set('type', $('histType').value);
    const from = $('histFrom').value, to = $('histTo').value;
    if (from && to) { qs.set('from', from); qs.set('to', to); }

    $('histBody').innerHTML = '<tr><td colspan="7" class="table-msg">Loading history…</td></tr>';
    try {
      const data = await getJson(`/stock/movements?${qs}`);
      $('hist-count').textContent = `${data.pagination.total.toLocaleString('en-US')} movement${data.pagination.total !== 1 ? 's' : ''}`;
      if (!data.data.length) {
        $('histBody').innerHTML = '<tr><td colspan="7" class="table-msg">No stock movements found for these filters.</td></tr>';
      } else {
        $('histBody').innerHTML = data.data.map((m) => `
          <tr>
            <td style="color:var(--text-muted);font-size:0.8rem;white-space:nowrap">${fmtDateTime(m.createdAt)}</td>
            <td class="cell-strong">${esc(m.productName)}</td>
            <td><span class="status-badge mv-${esc(m.type)}">${esc(TYPE_LABEL[m.type] || m.type)}</span></td>
            <td class="${m.quantityChange >= 0 ? 'qty-plus' : 'qty-minus'}">${m.quantityChange >= 0 ? '+' : '−'}${Math.abs(m.quantityChange).toLocaleString('en-US')} kg</td>
            <td class="mono" style="font-size:0.8rem;white-space:nowrap">${Number(m.quantityBefore).toLocaleString('en-US')} → ${Number(m.quantityAfter).toLocaleString('en-US')}</td>
            <td style="white-space:normal;min-width:180px">${esc(m.reason)}</td>
            <td style="color:var(--text-muted);font-size:0.8rem">${esc(m.adminName || (m.referenceType === 'order' ? 'Customer order' : 'System'))}</td>
          </tr>`).join('');
      }
      renderPager('histPager', data.pagination, 'loadHistory');
    } catch (err) {
      $('histBody').innerHTML = `<tr><td colspan="7" class="table-msg error">${esc(err.message)}</td></tr>`;
      $('histPager').innerHTML = '';
    }
  };

  function renderPager(id, pg, fn) {
    if (pg.pages <= 1) { $(id).innerHTML = ''; return; }
    $(id).innerHTML = `
      <span>Page ${pg.page} of ${pg.pages}</span>
      <div class="pager-btns">
        <button class="btn-outline btn-sm" ${pg.page <= 1 ? 'disabled' : ''} onclick="${fn}(${pg.page - 1})">← Previous</button>
        <button class="btn-outline btn-sm" ${pg.page >= pg.pages ? 'disabled' : ''} onclick="${fn}(${pg.page + 1})">Next →</button>
      </div>`;
  }

  /* =======================================================
     DAILY SALES
     ======================================================= */
  let salesRange = null;       // { from, to, label }
  let salesPage = 1;
  let salesInit = false;
  let salesTab = 'paid';       // 'paid' | 'credit' — the two histories are kept apart
  let listReq = 0;             // guards against out-of-order responses when switching tabs fast
  const creditById = new Map();  // credit sales currently on screen (for the payment dialog)
  const CREDIT_LABEL = { unpaid: 'Unpaid', partial: 'Partly paid', paid: 'Fully paid' };

  function presetRange(name) {
    const today = new Date();
    switch (name) {
      case 'today':     return { from: ymd(today), to: ymd(today), label: 'Today' };
      case 'yesterday': return { from: ymd(addDays(today, -1)), to: ymd(addDays(today, -1)), label: 'Yesterday' };
      case '7d':        return { from: ymd(addDays(today, -6)), to: ymd(today), label: 'Last 7 days' };
      case '30d':       return { from: ymd(addDays(today, -29)), to: ymd(today), label: 'Last 30 days' };
      case 'month':     return { from: ymd(new Date(today.getFullYear(), today.getMonth(), 1)), to: ymd(today), label: 'This month' };
    }
  }

  window.loadSalesPage = function () {
    if (!salesInit) {
      salesInit = true;
      const r = presetRange('today');
      salesRange = r;
      $('salesFrom').value = r.from; $('salesTo').value = r.to;
      ['salesPayment', 'salesStatus', 'salesCreditStatus'].forEach((id) => $(id).addEventListener('change', () => loadSalesList(1)));
      let timer;
      $('salesSearch').addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(() => loadSalesList(1), 300); });
      $('payAmount').addEventListener('keydown', (e) => { if (['e', 'E', '+', '-'].includes(e.key)) e.preventDefault(); });
    }
    refreshSales();
  };

  window.applySalesPreset = function (btn) {
    document.querySelectorAll('#page-sales [data-preset]').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    salesRange = presetRange(btn.dataset.preset);
    $('salesFrom').value = salesRange.from; $('salesTo').value = salesRange.to;
    hideErr('salesRangeError');
    refreshSales();
  };

  window.applySalesCustomRange = function () {
    const from = $('salesFrom').value, to = $('salesTo').value;
    if (!from || !to) return showErr('salesRangeError', 'Please choose both a From and a To date.');
    if (!validateRange(from, to, 'salesRangeError')) return;
    document.querySelectorAll('#page-sales [data-preset]').forEach((b) => b.classList.remove('active'));
    salesRange = { from, to, label: from === to ? fmtDay(from) : `${fmtDay(from)} – ${fmtDay(to)}` };
    refreshSales();
  };

  function refreshSales() {
    loadSalesStats();
    loadSalesList(1);
  }

  /* Paid sales and credit sales have separate histories (tabs) */
  function activateSalesTab(tab, reload) {
    salesTab = tab === 'credit' ? 'credit' : 'paid';
    const credit = salesTab === 'credit';
    document.querySelectorAll('#salesTabs [data-stab]').forEach((b) => {
      const on = b.dataset.stab === salesTab;
      b.classList.toggle('active', on);
      b.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    $('paidWrap').style.display = credit ? 'none' : '';
    $('creditWrap').style.display = credit ? '' : 'none';
    $('creditFilters').style.display = credit ? '' : 'none';
    $('salesPayment').style.display = credit ? 'none' : '';      // credit sales have no payment method yet
    if (reload) loadSalesList(1);
  }
  window.switchSalesTab = (btn) => activateSalesTab(btn.dataset.stab, true);

  async function loadSalesStats() {
    const { from, to, label } = salesRange;
    try {
      const d = (await getJson(`/sales/stats?from=${from}&to=${to}&tz=${TZ()}`)).data;
      const plural = (n, w) => `${n.toLocaleString('en-US')} ${w}${n !== 1 ? 's' : ''}`;

      $('ds-paid').textContent = money(d.paid.amount);
      $('ds-paid-sub').textContent = `${plural(d.paid.transactions, 'sale')} · ${label}`;
      $('ds-credit').textContent = money(d.credit.amount);
      $('ds-credit-sub').textContent = `${plural(d.credit.transactions, 'sale')} on credit · ${label}`;
      $('ds-outstanding').textContent = money(d.outstandingCredit.amount);
      $('ds-outstanding-sub').textContent = d.outstandingCredit.accounts
        ? `${plural(d.outstandingCredit.accounts, 'open account')} · all time`
        : 'No unpaid credit';

      $('ds-transactions').textContent = d.transactions.toLocaleString('en-US');
      $('ds-voided').textContent = d.voidedCount ? `${d.voidedCount} voided (excluded)` : 'Paid + credit';
      $('ds-items').textContent = kg(d.itemsSold);
      $('ds-average').textContent = money(d.averageSale);
      $('ds-collected').textContent = money(d.credit.collected);

      renderBars('dsPayments', d.byPayment.map((r) => ({
        name: PAY_LABEL[r.paymentMethod] || r.paymentMethod, value: r.revenue, sub: plural(r.transactions, 'transaction'),
      })), d.paid.amount);
      renderBars('dsTopProducts', d.topProducts.map((r) => ({
        name: r.name, value: r.revenue, sub: kg(r.quantity) + ' sold',
      })), d.topProducts.length ? Math.max(...d.topProducts.map((r) => r.revenue)) : 0);

      const multi = from !== to;
      $('dsDailyPanel').style.display = multi && d.daily.length ? '' : 'none';
      $('dsDailyBody').innerHTML = d.daily.map((r) => `
        <tr><td>${esc(fmtDay(r.day))}</td><td>${r.transactions}</td><td>${kg(r.itemsSold)}</td>
        <td class="cell-strong">${money(r.paidAmount)}</td>
        <td class="cell-strong">${money(r.creditAmount)}</td></tr>`).join('');
    } catch (err) {
      ['dsPayments', 'dsTopProducts'].forEach((id) => { $(id).innerHTML = `<div class="empty-state" style="color:#E88080">${esc(err.message)}</div>`; });
      showToast(err.message, 'error');
    }
  }

  function renderBars(id, rows, max) {
    if (!rows.length) { $(id).innerHTML = '<div class="empty-state">No sales in this period.</div>'; return; }
    $(id).innerHTML = rows.map((r) => {
      const pct = max > 0 ? Math.max(3, Math.round((r.value / max) * 100)) : 0;
      return `<div class="bar-row">
        <div class="bar-row-top"><span class="bar-row-name" title="${esc(r.name)}">${esc(r.name)}</span><span class="bar-row-val">${money(r.value)}</span></div>
        <div class="bar-row-sub">${esc(r.sub)}</div>
        <div class="bar-track"><div class="bar-fill" style="width:${pct}%"></div></div>
      </div>`;
    }).join('');
  }

  const itemsHtml = (s) => s.items.map((i) =>
    `<div>${esc(i.name)} <span style="color:var(--text-muted)">× ${Number(i.quantity).toLocaleString('en-US')} kg</span></div>`).join('');
  const dateCell = (s) =>
    `<td style="color:var(--text-muted);font-size:0.8rem;white-space:nowrap">${fmtDateTime(s.createdAt)}${s.adminName ? `<div class="cell-sub">by ${esc(s.adminName)}</div>` : ''}</td>`;

  function paidRow(s) {
    const who  = s.customerName ? `<div class="cell-sub">${esc(s.customerName)}</div>` : '';
    const note = s.notes ? `<div class="cell-sub">${esc(s.notes)}</div>` : '';
    const voidInfo = s.status === 'voided' ? `<div class="cell-sub">${esc(s.voidReason || '')}</div>` : '';
    return `<tr>
      <td><span class="order-num">${esc(s.saleNumber)}</span>${who}</td>
      ${dateCell(s)}
      <td style="white-space:normal;min-width:170px;font-size:0.82rem">${itemsHtml(s)}${note}</td>
      <td>${esc(PAY_LABEL[s.paymentMethod] || s.paymentMethod || '—')}</td>
      <td>${Number(s.totalQuantity).toLocaleString('en-US')} kg</td>
      <td class="cell-strong" ${s.status === 'voided' ? 'style="text-decoration:line-through;opacity:.6"' : ''}>${money(s.totalAmount)}</td>
      <td><span class="status-badge status-${esc(s.status)}">${capitalize(esc(s.status))}</span>${voidInfo}</td>
      <td>${s.status === 'completed'
        ? `<button class="btn-mini danger" onclick="openVoidModal(${Number(s.id)},'${esc(s.saleNumber)}')"><i class="fa-solid fa-rotate-left"></i> Void</button>`
        : '—'}</td>
    </tr>`;
  }

  function creditRow(s) {
    const voided  = s.status === 'voided';
    const settled = s.creditStatus === 'paid';
    const pays = s.payments || [];
    const shortDate = (v) => new Date(v).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const payLines = pays.slice(-3).map((p) =>
      `<div class="pay-line">${money(p.amount)} · ${esc(PAY_LABEL[p.paymentMethod] || p.paymentMethod)} · ${esc(shortDate(p.createdAt))}</div>`).join('')
      + (pays.length > 3 ? `<div class="pay-line">+${pays.length - 3} earlier</div>` : '');
    const note = s.notes ? `<div class="cell-sub">${esc(s.notes)}</div>` : '';

    const status = voided
      ? `<span class="status-badge status-voided">Voided</span><div class="cell-sub">${esc(s.voidReason || '')}</div>`
      : `<span class="status-badge status-${esc(s.creditStatus)}">${esc(CREDIT_LABEL[s.creditStatus] || s.creditStatus)}</span>`;
    const balance = voided ? '—'
      : settled ? `<span class="balance-clear">${money(0)}</span>`
      : `<span class="balance-due">${money(s.balance)}</span>`;

    const actions = [];
    if (!voided && !settled) {
      actions.push(`<button class="btn-mini" onclick="openPayModal(${Number(s.id)})"><i class="fa-solid fa-coins"></i> Record payment</button>`);
    }
    // a credit sale that already has money on it cannot be voided (the server enforces this too)
    if (!voided && Number(s.amountPaid) === 0) {
      actions.push(`<button class="btn-mini danger" onclick="openVoidModal(${Number(s.id)},'${esc(s.saleNumber)}')"><i class="fa-solid fa-rotate-left"></i> Void</button>`);
    }

    return `<tr>
      <td><span class="order-num">${esc(s.saleNumber)}</span></td>
      ${dateCell(s)}
      <td><div class="cell-strong">${esc(s.customerName || '—')}</div>${s.customerPhone ? `<div class="cell-sub">${esc(s.customerPhone)}</div>` : ''}</td>
      <td style="white-space:normal;min-width:170px;font-size:0.82rem">${itemsHtml(s)}${note}</td>
      <td class="cell-strong" ${voided ? 'style="text-decoration:line-through;opacity:.6"' : ''}>${money(s.totalAmount)}</td>
      <td>${voided ? '—' : money(s.amountPaid)}${voided ? '' : payLines}</td>
      <td>${balance}</td>
      <td>${status}</td>
      <td><div class="row-actions">${actions.join('') || '—'}</div></td>
    </tr>`;
  }

  window.loadSalesList = async function (page) {
    salesPage = page || 1;
    const credit = salesTab === 'credit';
    const bodyId = credit ? 'creditBody' : 'salesBody';
    const cols = credit ? 9 : 8;
    const { from, to } = salesRange;

    const qs = new URLSearchParams({ from, to, tz: TZ(), page: salesPage, limit: 15, type: salesTab });
    if ($('salesStatus').value) qs.set('status', $('salesStatus').value);
    if (credit) {
      if ($('salesCreditStatus').value) qs.set('creditStatus', $('salesCreditStatus').value);
      const q = $('salesSearch').value.trim();
      if (q) qs.set('q', q);
    } else if ($('salesPayment').value) {
      qs.set('paymentMethod', $('salesPayment').value);
    }

    const req = ++listReq;
    $(bodyId).innerHTML = `<tr><td colspan="${cols}" class="table-msg">Loading ${credit ? 'credit ' : ''}sales…</td></tr>`;
    try {
      const data = await getJson(`/sales?${qs}`);
      if (req !== listReq) return;                                   // a newer request replaced this one
      const total = data.pagination.total;
      $('sales-count').textContent =
        `${total.toLocaleString('en-US')} ${credit ? 'credit' : 'paid'} sale${total !== 1 ? 's' : ''} in this period`;
      if (credit) { creditById.clear(); data.data.forEach((s) => creditById.set(s.id, s)); }
      if (!data.data.length) {
        $(bodyId).innerHTML = `<tr><td colspan="${cols}" class="table-msg">${credit
          ? 'No credit sales found for these filters.'
          : 'No sales found. Use “New Sale” to register one.'}</td></tr>`;
        $('salesPager').innerHTML = '';
        return;
      }
      $(bodyId).innerHTML = data.data.map(credit ? creditRow : paidRow).join('');
      renderPager('salesPager', data.pagination, 'loadSalesList');
    } catch (err) {
      if (req !== listReq) return;
      $(bodyId).innerHTML = `<tr><td colspan="${cols}" class="table-msg error">${esc(err.message)}</td></tr>`;
      $('salesPager').innerHTML = '';
    }
  };

  /* ── record a payment on a credit sale ───────────── */
  let paySale = null;
  const balanceCents = (s) => Math.round(Number(s.balance) * 100);

  /* "12", "12.5", "12.50" → cents, or null when not a valid amount */
  function amountToCents(raw) {
    const t = String(raw).trim();
    if (!/^\d{1,9}(\.\d{1,2})?$/.test(t)) return null;
    const [w, f = ''] = t.split('.');
    return Number(w) * 100 + Number((f + '00').slice(0, 2));
  }

  window.openPayModal = function (id) {
    const s = creditById.get(id);
    if (!s) return;
    paySale = s;
    $('payForm').reset();
    hideErr('payError');
    $('paySaleNumber').textContent = s.saleNumber;
    $('payCustomer').textContent = s.customerName || '';
    $('payTotal').textContent = money(s.totalAmount);
    $('payPaid').textContent = money(s.amountPaid);
    $('payBalance').textContent = money(s.balance);
    updatePayPreview();
    openModal('payModal', 'payAmount');
  };
  window.closePayModal = () => closeModal('payModal');

  window.fillFullBalance = function () {
    if (!paySale) return;
    $('payAmount').value = (balanceCents(paySale) / 100).toFixed(2);
    updatePayPreview();
  };

  /* returns an error string, or '' when the amount can be recorded */
  function payProblem(raw) {
    if (raw === '') return 'Enter the amount received.';
    const cents = amountToCents(raw);
    if (cents === null) return 'Enter a valid amount (numbers only, up to 2 decimals).';
    if (cents <= 0) return 'The amount must be greater than 0.';
    if (cents > balanceCents(paySale)) return `That is more than the balance of ${money(paySale.balance)}.`;
    return '';
  }

  window.updatePayPreview = function () {
    if (!paySale) return;
    const box = $('payPreview');
    const raw = $('payAmount').value.trim();
    box.classList.remove('bad', 'ok');
    if (raw === '') { box.textContent = 'Enter the amount received to preview the new balance.'; return; }
    const problem = payProblem(raw);
    if (problem) { box.classList.add('bad'); box.textContent = problem; return; }
    const left = balanceCents(paySale) - amountToCents(raw);
    if (left === 0) { box.classList.add('ok'); box.innerHTML = 'Balance after payment: <strong>$0.00</strong> <span class="status-badge status-paid">Fully paid</span>'; }
    else box.innerHTML = `Balance after payment: <strong>${money(left / 100)}</strong> <span class="status-badge status-partial">Partly paid</span>`;
  };

  window.submitPayment = async function (e) {
    e.preventDefault();
    hideErr('payError');
    const raw = $('payAmount').value.trim();
    const problem = payProblem(raw);
    if (problem) return showErr('payError', problem);

    const btn = $('paySubmitBtn');
    btn.disabled = true; btn.textContent = 'Saving…';
    $('payModal').dataset.busy = '1';
    try {
      const res = await getJson(`/sales/${paySale.id}/payments`, {
        method: 'POST',
        body: JSON.stringify({ amount: raw, paymentMethod: $('payMethod').value, note: $('payNote').value.trim() || undefined }),
      });
      closeModal('payModal');
      const settled = res.data.creditStatus === 'paid';
      showToast(`Payment of ${money(amountToCents(raw) / 100)} recorded for ${res.data.saleNumber}${settled ? ' — fully paid' : ''}`, 'success');
      refreshSales();
    } catch (err) {
      showErr('payError', err.message);
    } finally {
      delete $('payModal').dataset.busy;
      btn.disabled = false; btn.textContent = 'Record payment';
    }
  };

  /* ── void a sale ─────────────────────────────────── */
  let voidSaleId = null;
  window.openVoidModal = function (id, number) {
    voidSaleId = id;
    $('voidSaleNumber').textContent = number;
    $('voidReason').value = '';
    hideErr('voidError');
    openModal('voidModal', 'voidReason');
  };
  window.closeVoidModal = () => closeModal('voidModal');
  window.submitVoid = async function (e) {
    e.preventDefault();
    const reason = $('voidReason').value.trim();
    hideErr('voidError');
    if (reason.length < 3) return showErr('voidError', 'Please give a reason (at least 3 characters).');
    const btn = $('voidSubmitBtn');
    btn.disabled = true; btn.textContent = 'Voiding…';
    $('voidModal').dataset.busy = '1';
    try {
      await getJson(`/sales/${voidSaleId}/void`, { method: 'POST', body: JSON.stringify({ reason }) });
      closeModal('voidModal');
      showToast('Sale voided and stock returned', 'success');
      stockDirty = true;
      refreshSales();
      refreshStockBadge();
    } catch (err) {
      showErr('voidError', err.message);
    } finally {
      delete $('voidModal').dataset.busy;
      btn.disabled = false; btn.textContent = 'Void sale';
    }
  };

  /* ── new sale modal ──────────────────────────────── */
  let saleType = 'paid';       // 'paid' | 'credit'
  const validPhone = (v) => {
    const t = String(v).trim();
    if (!/^[+()\d][\d\s().-]*$/.test(t) || t.length > 40) return false;
    const digits = t.replace(/\D/g, '').length;
    return digits >= 5 && digits <= 15;
  };

  window.setSaleType = function (type) {
    saleType = type === 'credit' ? 'credit' : 'paid';
    const credit = saleType === 'credit';
    document.querySelectorAll('#saleForm .sale-type-switch [data-type]').forEach((b) => {
      const on = b.dataset.type === saleType;
      b.classList.toggle('active', on);
      b.setAttribute('aria-checked', on ? 'true' : 'false');
    });
    $('salePaymentWrap').style.display = credit ? 'none' : '';
    $('saleContactWrap').style.display = credit ? '' : 'none';
    $('saleCustomerLabel').textContent = credit ? 'Customer name *' : 'Customer name (optional)';
    $('saleCustomer').placeholder = credit ? 'Who is buying on credit?' : 'Walk-in customer';
    $('saleTypeHint').textContent = credit
      ? 'The customer takes the goods now and pays later. Stock is deducted now; record payments as they come in.'
      : 'The customer pays now.';
    $('saleTypeHint').classList.toggle('credit', credit);
    $('saleModalTitle').textContent = credit ? 'New Credit Sale' : 'New Walk-in Sale';
    $('saleSubmitBtn').innerHTML = credit
      ? '<i class="fa-solid fa-hand-holding-dollar"></i> Record Credit Sale'
      : '<i class="fa-solid fa-check"></i> Complete Sale';
    hideErr('saleModalError');
  };

  let saleProducts = [];       // stock rows (fresh when modal opens)
  let lineSeq = 0;

  window.openSaleModal = async function () {
    hideErr('saleModalError');
    $('saleForm').reset();
    setSaleType(salesTab);
    $('saleLines').innerHTML = '';
    $('saleSubmitBtn').disabled = true;
    openModal('saleModal');
    try {
      saleProducts = (await getJson('/stock')).data || [];
    } catch (err) {
      showErr('saleModalError', 'Could not load products: ' + err.message);
      return;
    }
    if (!saleProducts.some((p) => p.stock > 0)) {
      showErr('saleModalError', 'No products are in stock. Add stock first on the Stock page.');
      return;
    }
    $('saleSubmitBtn').disabled = false;
    addSaleLine();
    updateSaleTotals();
  };
  window.closeSaleModal = () => closeModal('saleModal');

  function chosenIds(exceptLine) {
    return [...document.querySelectorAll('#saleLines .sale-line')]
      .filter((l) => l.dataset.line !== String(exceptLine))
      .map((l) => l.querySelector('select').value).filter(Boolean);
  }

  function productOptions(lineId, selected) {
    const taken = chosenIds(lineId);
    return '<option value="">Select product…</option>' + saleProducts.map((p) => {
      const disabled = p.stock <= 0 || (taken.includes(String(p.id)) && String(p.id) !== String(selected));
      const note = p.stock <= 0 ? ' — out of stock' : ` — ${money(p.pricePerKg)}/kg · ${kg(p.stock)} left`;
      return `<option value="${Number(p.id)}" ${disabled ? 'disabled' : ''} ${String(p.id) === String(selected) ? 'selected' : ''}>${esc(p.name)}${note}</option>`;
    }).join('');
  }

  function refreshLineOptions() {
    document.querySelectorAll('#saleLines .sale-line').forEach((l) => {
      const sel = l.querySelector('select');
      sel.innerHTML = productOptions(l.dataset.line, sel.value);
    });
  }

  window.addSaleLine = function () {
    const id = ++lineSeq;
    const div = document.createElement('div');
    div.className = 'sale-line';
    div.dataset.line = id;
    div.innerHTML = `
      <select class="form-input sale-line-product" aria-label="Product">${productOptions(id, '')}</select>
      <input class="form-input sale-line-qty" type="number" min="1" step="1" inputmode="numeric" placeholder="Qty" aria-label="Quantity in kg" />
      <div class="sale-line-total">$0.00</div>
      <button type="button" class="sale-line-remove" aria-label="Remove line"><i class="fa-solid fa-xmark"></i></button>
      <div class="sale-line-msg" style="display:none"></div>`;
    $('saleLines').appendChild(div);

    div.querySelector('select').addEventListener('change', () => { refreshLineOptions(); validateLine(div); updateSaleTotals(); });
    const qty = div.querySelector('input');
    qty.addEventListener('keydown', blockNonDigits);
    qty.addEventListener('input', () => { validateLine(div); updateSaleTotals(); });
    div.querySelector('.sale-line-remove').addEventListener('click', () => {
      div.remove(); refreshLineOptions(); updateSaleTotals();
    });
    updateSaleTotals();
  };

  /* returns {ok, product, qty, msg} and paints the row */
  function validateLine(div, strict) {
    const sel = div.querySelector('select'), qtyEl = div.querySelector('input'), msg = div.querySelector('.sale-line-msg');
    const product = saleProducts.find((p) => String(p.id) === sel.value);
    const raw = qtyEl.value.trim();
    let problem = '', info = '';

    if (!product) { if (strict) problem = 'Choose a product.'; }
    else {
      qtyEl.max = String(product.stock);
      if (raw === '') { if (strict) problem = 'Enter a quantity.'; else info = `Up to ${kg(product.stock)} available`; }
      else if (!isWhole(raw)) problem = 'Quantity must be a whole number of kg.';
      else if (Number(raw) < 1) problem = 'Quantity must be at least 1 kg.';
      else if (Number(raw) > product.stock) problem = `Only ${kg(product.stock)} in stock.`;
      else if (Number(raw) > 100000) problem = 'Quantity cannot exceed 100,000 kg per line.';
      else info = `${kg(product.stock - Number(raw))} will remain`;
    }
    qtyEl.classList.toggle('invalid', !!problem && !!product);
    sel.classList.toggle('invalid', !!problem && !product);
    msg.style.display = problem || info ? '' : 'none';
    msg.className = 'sale-line-msg' + (problem ? ' bad' : '');
    msg.textContent = problem || info;

    const qty = isWhole(raw) ? Number(raw) : 0;
    return { ok: !problem && !!product && qty >= 1, product, qty, problem };
  }

  function updateSaleTotals() {
    let cents = 0, qtyTotal = 0, count = 0;
    document.querySelectorAll('#saleLines .sale-line').forEach((l) => {
      const { product, qty, problem } = validateLineQuiet(l);
      const lineCents = product && qty && !problem ? Math.round(Number(product.pricePerKg) * 100) * qty : 0;
      l.querySelector('.sale-line-total').textContent = money(lineCents / 100);
      if (lineCents) { cents += lineCents; qtyTotal += qty; count++; }
    });
    const lines = document.querySelectorAll('#saleLines .sale-line');
    lines.forEach((l) => { l.querySelector('.sale-line-remove').disabled = lines.length === 1; });
    $('addSaleLineBtn').disabled = lines.length >= 50 || lines.length >= saleProducts.filter((p) => p.stock > 0).length;
    $('saleSumItems').textContent = count;
    $('saleSumQty').textContent = kg(qtyTotal);
    $('saleSumTotal').textContent = money(cents / 100);
  }

  function validateLineQuiet(div) {
    const sel = div.querySelector('select');
    const product = saleProducts.find((p) => String(p.id) === sel.value);
    const raw = div.querySelector('input').value.trim();
    const qty = isWhole(raw) ? Number(raw) : 0;
    const problem = !product || !qty || qty < 1 || qty > product.stock || qty > 100000;
    return { product, qty, problem };
  }

  window.submitSale = async function (e) {
    e.preventDefault();
    hideErr('saleModalError');
    const lines = [...document.querySelectorAll('#saleLines .sale-line')];
    if (!lines.length) return showErr('saleModalError', 'Add at least one product.');

    const items = [];
    let firstProblem = '';
    for (const l of lines) {
      const r = validateLine(l, true);
      if (!r.ok) { firstProblem = firstProblem || r.problem || 'Check the highlighted line.'; continue; }
      items.push({ productId: r.product.id, quantity: r.qty });
    }
    if (firstProblem) return showErr('saleModalError', firstProblem);

    const credit = saleType === 'credit';
    const customerName = $('saleCustomer').value.trim();
    const customerPhone = $('saleContact').value.trim();
    if (credit && customerName.length < 2) {
      return showErr('saleModalError', 'Enter the customer’s name — it is required for credit sales.');
    }
    if (credit && customerPhone && !validPhone(customerPhone)) {
      return showErr('saleModalError', 'Contact must be a valid phone number (5–15 digits).');
    }

    const btn = $('saleSubmitBtn');
    const label = btn.innerHTML;
    btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Saving…';
    $('saleModal').dataset.busy = '1';
    try {
      const res = await getJson('/sales', {
        method: 'POST',
        body: JSON.stringify({
          items,
          saleType,
          paymentMethod: credit ? undefined : $('salePayment').value,
          customerName: customerName || undefined,
          customerPhone: credit && customerPhone ? customerPhone : undefined,
          notes: $('saleNotes').value.trim() || undefined,
        }),
      });
      closeModal('saleModal');
      showToast(credit
        ? `Credit sale ${res.data.saleNumber} recorded — ${money(res.data.totalAmount)} owed by ${res.data.customerName}`
        : `Sale ${res.data.saleNumber} recorded — ${money(res.data.totalAmount)}`, 'success');
      stockDirty = true;
      if (typeof _pageLoaded !== 'undefined') _pageLoaded.products = false;
      // make sure the new sale is visible: show the right history, and a range that includes today
      activateSalesTab(res.data.saleType, false);
      const today = ymd(new Date());
      if (!salesRange || salesRange.to < today || salesRange.from > today) {
        applySalesPreset(document.querySelector('#page-sales [data-preset="today"]'));
      } else {
        refreshSales();
      }
      refreshStockBadge();
    } catch (err) {
      showErr('saleModalError', err.message);
      // stock may have changed under us — refresh the product list so limits are right
      try { saleProducts = (await getJson('/stock')).data || saleProducts; refreshLineOptions(); lines.forEach((l) => validateLine(l)); updateSaleTotals(); } catch { /* ignore */ }
    } finally {
      delete $('saleModal').dataset.busy;
      btn.disabled = false; btn.innerHTML = label;
    }
  };

  /* =======================================================
     PRODUCT EDITING (name + price)
     ======================================================= */
  let editingProduct = null;

  window.openEditProduct = function (id) {
    const list = typeof _allProducts !== 'undefined' ? _allProducts : [];
    const p = list.find((x) => Number(x.id) === Number(id));
    if (!p) return;
    editingProduct = p;
    hideErr('editProductError');
    $('editProductName').value = p.name;
    $('editProductPrice').value = Number(p.pricePerKg).toFixed(2);
    openModal('editProductModal', 'editProductName');
  };
  window.closeEditProduct = () => closeModal('editProductModal');

  window.submitEditProduct = async function (e) {
    e.preventDefault();
    const p = editingProduct;
    hideErr('editProductError');
    const name = $('editProductName').value.trim();
    const priceRaw = $('editProductPrice').value.trim();

    if (!name) return showErr('editProductError', 'Product name is required.');
    if (name.length > 255) return showErr('editProductError', 'Product name must be 255 characters or fewer.');
    if (!/^\d{1,7}(\.\d{1,2})?$/.test(priceRaw) || Number(priceRaw) <= 0) {
      return showErr('editProductError', 'Enter a price greater than 0, with at most 2 decimals (maximum 9,999,999.99).');
    }

    const changes = {};
    if (name !== p.name) changes.name = name;
    if (Number(priceRaw) !== Number(p.pricePerKg)) changes.pricePerKg = priceRaw;
    if (!Object.keys(changes).length) return showErr('editProductError', 'Nothing has changed — edit the name or the price first.');

    const btn = $('editProductBtn');
    btn.disabled = true; btn.textContent = 'Saving…';
    $('editProductModal').dataset.busy = '1';
    try {
      const res = await getJson(`/products/${p.id}`, { method: 'PUT', body: JSON.stringify(changes) });
      const updated = res.data;
      const i = _allProducts.findIndex((x) => Number(x.id) === Number(p.id));
      if (i > -1) _allProducts[i] = updated;
      renderProductsTable(_allProducts);
      stockDirty = true;                      // Stock page and the new-sale picker pick up the change
      closeModal('editProductModal');
      showToast(`“${updated.name}” updated — now $${Number(updated.pricePerKg).toFixed(2)}/kg`, 'success');
    } catch (err) {
      showErr('editProductError', err.message);
    } finally {
      delete $('editProductModal').dataset.busy;
      btn.disabled = false; btn.textContent = 'Save changes';
    }
  };

  async function refreshStockBadge() {
    try { updateStockBadge((await getJson('/dashboard/stats')).data.stockAlerts); } catch { /* badge is optional */ }
  }
})();

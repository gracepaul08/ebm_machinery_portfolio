(() => {
  'use strict';
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];
  const money = n => new Intl.NumberFormat('en-TZ', { style: 'currency', currency: 'TZS', maximumFractionDigits: 0 }).format(Number(n || 0));
  const date = d => d ? new Intl.DateTimeFormat('en-TZ', { dateStyle: 'medium' }).format(new Date(d)) : '—';
  const slug = s => s.normalize('NFKD').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g);
  const escape = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  let db, currentUser, currentRole, products = [], orders = [], customers = [], roleRows = [], currentPage = 'overview';
  const appMessage = $('#app-message');
  function notify(message, error = false) { appMessage.textContent = message; appMessage.classList.toggle('error', error); window.clearTimeout(notify.timer); notify.timer = window.setTimeout(() => { appMessage.textContent = ''; appMessage.classList.remove('error'); }, 5200); }
  function showLogin(message = '') { $('#app-view').hidden = true; $('#login-view').hidden = false; $('#login-message').textContent = message; }
  function showApp() { $('#login-view').hidden = true; $('#app-view').hidden = false; }
  function fail(error) { console.error(error); notify(error?.message || String(error), true); }
  async function uploadImage(file, prefix) {
    if (!file) return null;
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'].includes(file.type)) throw new Error('Choose a JPG, PNG, WebP or SVG image.');
    if (file.size > 5 * 1024 * 1024) throw new Error('Images must be 5 MB or smaller.');
    const ext = file.name.split('.').pop().toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
    const path = `${prefix}/${Date.now()}-${crypto.randomUUID()}.${ext}`;
    const { error } = await db.storage.from('ebm-public-assets').upload(path, file, { cacheControl: '3600', upsert: false, contentType: file.type });
    if (error) throw error;
    return db.storage.from('ebm-public-assets').getPublicUrl(path).data.publicUrl;
  }
  async function requireRole() {
    const { data: { user }, error } = await db.auth.getUser();
    if (error) throw error;
    if (!user) return false;
    const { data: row, error: roleError } = await db.from('user_roles').select('role,display_name').eq('user_id', user.id).maybeSingle();
    if (roleError) throw roleError;
    if (!row) { await db.auth.signOut(); showLogin('This account does not have dashboard access. Ask an administrator to assign your role.'); return false; }
    currentUser = user; currentRole = row.role;
    $('#user-email').textContent = row.display_name || user.email;
    $('#user-role-badge').textContent = row.role.toUpperCase();
    $$('.admin-only').forEach(el => { el.hidden = currentRole !== 'admin'; });
    showApp(); await refreshAll(); return true;
  }
  async function refreshAll() { await Promise.all([loadProducts(), loadOrders(), loadCustomers()]); drawOverview(); renderProducts(); renderOrders(); renderCustomers(); if (currentRole === 'admin') { await Promise.all([loadSettings(), loadTeam()]); } }
  async function loadProducts() { const { data, error } = await db.from('products').select('*').order('sort_order').order('name'); if (error) throw error; products = data || []; }
  async function loadOrders() { const { data, error } = await db.from('orders').select('id,order_number,customer_id,status,source,total_amount,notes,created_at,customers(full_name,phone,email),order_items(product_name,quantity,unit_price,line_total)').order('created_at', { ascending: false }).limit(500); if (error) throw error; orders = data || []; }
  async function loadCustomers() { const { data, error } = await db.from('customers').select('id,full_name,phone,email,notes,created_at,orders(id,status,total_amount,created_at)').order('full_name'); if (error) throw error; customers = data || []; }
  const statusPill = status => `<span class="status-pill status-${escape(status)}">${escape(status)}</span>`;
  function drawOverview() {
    $('#stat-sales').textContent = money(orders.filter(o => o.status === 'completed').reduce((a, o) => a + Number(o.total_amount), 0));
    $('#stat-new-orders').textContent = orders.filter(o => o.status === 'new').length;
    $('#stat-customers').textContent = customers.length;
    $('#stat-products').textContent = products.filter(p => p.is_active).length;
    const now = new Date(); const months = Array.from({ length: 6 }, (_, i) => new Date(now.getFullYear(), now.getMonth() - 5 + i, 1));
    const sales = months.map(m => orders.filter(o => { const d = new Date(o.created_at); return o.status === 'completed' && d.getMonth() === m.getMonth() && d.getFullYear() === m.getFullYear(); }).reduce((a, o) => a + Number(o.total_amount), 0));
    const max = Math.max(...sales, 1);
    $('#sales-chart').replaceChildren(...months.map((m, i) => { const col = document.createElement('div'); col.className = 'chart-column'; const bar = document.createElement('div'); bar.className = 'chart-bar'; bar.style.height = `${Math.max(2, sales[i] / max * 100)}%`; const value = document.createElement('span'); value.textContent = money(sales[i]); bar.append(value); const label = document.createElement('small'); label.textContent = new Intl.DateTimeFormat('en', { month: 'short' }).format(m); col.append(bar, label); return col; }));
    const low = products.filter(p => p.is_active && p.track_stock && p.stock_quantity <= p.low_stock_threshold);
    $('#low-stock-list').innerHTML = low.length ? low.map(p => `<div class="low-stock-row"><span>${escape(p.name)}</span><strong>${Number(p.stock_quantity)} left</strong></div>`).join('') : '<div class="empty-state">No low-stock alerts.</div>';
    $('#recent-orders-body').innerHTML = orders.slice(0, 5).map(o => `<tr><td><strong>${escape(o.order_number)}</strong></td><td>${escape(o.customers?.full_name)}</td><td>${date(o.created_at)}</td><td>${money(o.total_amount)}</td><td>${statusPill(o.status)}</td></tr>`).join('') || '<tr><td colspan="5" class="empty-state">No orders recorded yet.</td></tr>';
  }
  function renderProducts() {
    const q = ($('#product-search')?.value || '').toLowerCase(); const rows = products.filter(p => `${p.name} ${p.category}`.toLowerCase().includes(q));
    $('#product-count').textContent = `${rows.length} product${rows.length === 1 ? '' : 's'}`;
    $('#products-body').innerHTML = rows.map(p => `<tr><td><div class="product-cell"><img src="${escape(p.image_url || 'assets/ebm-mark.svg')}" alt=""><div><strong>${escape(p.name)}</strong><small>${escape(p.category)}</small></div></div></td><td>${p.price == null ? 'Ask for price' : money(p.price)}</td><td>${p.track_stock ? `${p.stock_quantity} ${p.stock_quantity <= p.low_stock_threshold ? '⚠' : ''}` : 'Not tracked'}</td><td>${p.is_active ? '<span class="status-pill status-completed">Visible</span>' : '<span class="status-pill">Hidden</span>'}</td><td><button class="row-action" data-edit-product="${p.id}">Edit</button> <button class="row-action" data-delete-product="${p.id}">Delete</button></td></tr>`).join('') || '<tr><td colspan="5" class="empty-state">No products match that search.</td></tr>';
  }
  function renderOrders() {
    const q = ($('#order-search')?.value || '').toLowerCase(), status = $('#order-status-filter')?.value || 'all';
    const rows = orders.filter(o => (status === 'all' || o.status === status) && `${o.order_number} ${o.customers?.full_name || ''} ${o.customers?.phone || ''}`.toLowerCase().includes(q));
    $('#orders-body').innerHTML = rows.map(o => `<tr><td><strong>${escape(o.order_number)}</strong></td><td>${escape(o.customers?.full_name)}</td><td><a class="customer-link" href="tel:${escape(o.customers?.phone)}">${escape(o.customers?.phone)}</a></td><td>${date(o.created_at)}</td><td>${money(o.total_amount)}</td><td><select class="team-role-select" data-order-status="${o.id}" aria-label="Order status">${['new','processing','completed','cancelled'].map(s => `<option value="${s}" ${s === o.status ? 'selected' : ''}>${s}</option>`).join('')}</select></td><td><button class="row-action" data-view-order="${o.id}">Details</button></td></tr>`).join('') || '<tr><td colspan="7" class="empty-state">No orders found.</td></tr>';
  }
  function renderCustomers() {
    const q = ($('#customer-search')?.value || '').toLowerCase(); const rows = customers.filter(c => `${c.full_name} ${c.phone} ${c.email || ''}`.toLowerCase().includes(q));
    $('#customer-count').textContent = `${rows.length} customer${rows.length === 1 ? '' : 's'}`;
    $('#customers-body').innerHTML = rows.map(c => { const os = c.orders || []; const spend = os.filter(o => o.status === 'completed').reduce((a, o) => a + Number(o.total_amount), 0); const last = os.reduce((a, o) => !a || new Date(o.created_at) > new Date(a) ? o.created_at : a, null); return `<tr><td><strong>${escape(c.full_name)}</strong></td><td><a class="customer-link" href="tel:${escape(c.phone)}">${escape(c.phone)}</a></td><td>${escape(c.email || '—')}</td><td>${os.length}</td><td>${money(spend)}</td><td>${date(last)}</td></tr>`; }).join('') || '<tr><td colspan="6" class="empty-state">No customers found.</td></tr>';
  }
  function go(page) { if (['settings','team'].includes(page) && currentRole !== 'admin') return; currentPage = page; $$('.nav-item').forEach(b => b.classList.toggle('active', b.dataset.page === page)); $$('.page-panel').forEach(p => p.classList.toggle('active', p.dataset.panel === page)); $('#page-title').textContent = ({ overview: 'Overview', products: 'Products', orders: 'Orders', customers: 'Customers', settings: 'Business settings', team: 'Staff & roles' })[page]; }
  function field(form, name) { return form.elements.namedItem(name); }
  function openProduct(p = null) {
    const form = $('#product-form'); form.reset(); $('#product-form-error').textContent = ''; $('#product-image-preview').replaceChildren();
    $('#product-dialog-title').textContent = p ? 'Edit product' : 'Add product'; field(form, 'id').value = p?.id || '';
    ['name','category','description','price','stock_quantity','low_stock_threshold','video_url'].forEach(k => { if (p) field(form, k).value = p[k] ?? ''; });
    if (p) { field(form, 'highlights').value = (p.highlights || []).join('\n'); field(form, 'track_stock').checked = p.track_stock; field(form, 'is_active').checked = p.is_active; field(form, 'is_featured').checked = p.is_featured; const img = document.createElement('img'); img.src = p.image_url || ''; img.alt = 'Current product image'; if (p.image_url) $('#product-image-preview').append(img); }
    $('#product-dialog').showModal();
  }
  async function saveProduct(ev) {
    ev.preventDefault(); const form = ev.currentTarget, id = field(form, 'id').value, name = field(form, 'name').value.trim();
    const data = { name, slug: slug(name), category: field(form, 'category').value.trim(), description: field(form, 'description').value.trim(), highlights: field(form, 'highlights').value.split('\n').map(x => x.trim()).filter(Boolean), price: field(form, 'price').value ? Number(field(form, 'price').value) : null, stock_quantity: Number(field(form, 'stock_quantity').value || 0), low_stock_threshold: Number(field(form, 'low_stock_threshold').value || 0), track_stock: field(form, 'track_stock').checked, video_url: field(form, 'video_url').value.trim() || null, is_active: field(form, 'is_active').checked, is_featured: field(form, 'is_featured').checked };
    try { const file = $('#product-image').files[0]; if (file) data.image_url = await uploadImage(file, 'products'); else if (!id) data.image_url = 'assets/ebm-mark.svg'; const req = id ? db.from('products').update(data).eq('id', id) : db.from('products').insert(data); const { error } = await req; if (error) throw error; $('#product-dialog').close(); $('#product-image').value = ''; await refreshAll(); notify('Product saved.'); } catch (e) { $('#product-form-error').textContent = e.message; }
  }
  async function deleteProduct(id) { const p = products.find(x => x.id === id); if (!p || !confirm(`Delete ${p.name}? Existing order records will keep their saved product details.`)) return; try { const { error } = await db.from('products').delete().eq('id', id); if (error) throw error; await refreshAll(); notify('Product deleted.'); } catch (e) { fail(e); } }
  function addOrderLine() {
    const line = document.createElement('div'); line.className = 'order-line';
    const select = document.createElement('select'); select.required = true; select.innerHTML = '<option value="">Choose product</option>' + products.filter(p => p.is_active).map(p => `<option value="${escape(p.id)}" data-price="${p.price ?? ''}" ${p.price == null ? 'disabled' : ''}>${escape(p.name)}${p.price == null ? ' · set price first' : ` · ${money(p.price)}`}</option>`).join('');
    const quantity = document.createElement('input'); quantity.type = 'number'; quantity.min = '1'; quantity.value = '1'; quantity.required = true; quantity.setAttribute('aria-label', 'Quantity');
    const price = document.createElement('input'); price.type = 'number'; price.min = '0'; price.step = '100'; price.placeholder = 'Unit price'; price.required = true; price.setAttribute('aria-label', 'Unit price');
    select.addEventListener('change', () => { const opt = select.selectedOptions[0]; if (opt?.dataset.price) price.value = opt.dataset.price; orderTotal(); }); quantity.addEventListener('input', orderTotal); price.addEventListener('input', orderTotal);
    const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'remove-line'; remove.textContent = '×'; remove.setAttribute('aria-label', 'Remove product'); remove.addEventListener('click', () => { line.remove(); orderTotal(); });
    line.append(select, quantity, price, remove); $('#order-items').append(line);
  }
  function orderTotal() { const total = $$('.order-line', $('#order-items')).reduce((n, l) => n + Number($('input[type=number]', l).value || 0) * Number($$('input[type=number]', l)[1]?.value || 0), 0); $('#order-total').textContent = money(total); }
  function openOrder() { $('#order-form').reset(); $('#order-items').replaceChildren(); $('#order-form-error').textContent = ''; addOrderLine(); $('#order-dialog').showModal(); }
  async function saveOrder(ev) {
    ev.preventDefault(); const f = ev.currentTarget; const lines = $$('.order-line', $('#order-items')).map(l => { const nums = $$('input[type=number]', l); return { product_id: $('select', l).value, quantity: Number(nums[0].value), unit_price: Number(nums[1].value) }; });
    if (lines.some(x => !x.product_id || x.quantity < 1 || x.unit_price < 0)) { $('#order-form-error').textContent = 'Choose each product and enter a valid quantity and price.'; return; }
    try { const { data, error } = await db.rpc('ebm_create_whatsapp_order', { p_customer_name: field(f, 'customer_name').value.trim(), p_customer_phone: field(f, 'customer_phone').value.trim(), p_customer_email: field(f, 'customer_email').value.trim() || null, p_items: lines, p_notes: field(f, 'notes').value.trim() }); if (error) throw error; $('#order-dialog').close(); await refreshAll(); const found = orders.find(o => o.id === data); notify(`Order ${found?.order_number || ''} recorded.`); } catch (e) { $('#order-form-error').textContent = e.message; }
  }
  function viewOrder(id) { const o = orders.find(x => x.id === id); if (!o) return; $('#order-detail-title').textContent = o.order_number; const wrap = $('#order-detail-content'); wrap.replaceChildren(); const p = document.createElement('p'); p.textContent = `${o.customers?.full_name || 'Customer'} · ${o.customers?.phone || ''} · ${date(o.created_at)}`; const status = document.createElement('p'); status.textContent = `Status: ${o.status} · Source: ${o.source}`; const list = document.createElement('ul'); (o.order_items || []).forEach(item => { const li = document.createElement('li'); li.textContent = `${item.quantity} × ${item.product_name} at ${money(item.unit_price)} = ${money(item.line_total)}`; list.append(li); }); const total = document.createElement('strong'); total.textContent = `Total: ${money(o.total_amount)}`; const notes = document.createElement('p'); notes.textContent = o.notes ? `Notes: ${o.notes}` : 'No notes'; wrap.append(p, status, list, total, notes); $('#order-detail-dialog').showModal(); }
  async function setOrderStatus(id, status) { try { const { error } = await db.from('orders').update({ status }).eq('id', id); if (error) throw error; await refreshAll(); notify('Order status updated.'); } catch (e) { fail(e); } }
  async function loadSettings() { const { data, error } = await db.from('business_settings').select('*').eq('id', true).single(); if (error) throw error; const f = $('#settings-form'); for (const k of ['company_name','phone','whatsapp_number','location']) field(f, k).value = data[k] || ''; $('#current-logo').replaceChildren(); if (data.logo_url) { const img = document.createElement('img'); img.src = data.logo_url; img.alt = 'Current business logo'; $('#current-logo').append(img); } }
  async function saveSettings(ev) { ev.preventDefault(); const f = ev.currentTarget; try { let logo_url; const file = $('#logo-file').files[0]; if (file) logo_url = await uploadImage(file, 'business'); const data = { id: true, company_name: field(f, 'company_name').value.trim(), phone: field(f, 'phone').value.trim(), whatsapp_number: field(f, 'whatsapp_number').value.trim().replace(/\D/g, ''), location: field(f, 'location').value.trim() }; if (logo_url) data.logo_url = logo_url; const { error } = await db.from('business_settings').upsert(data); if (error) throw error; await loadSettings(); notify('Business information saved.'); } catch (e) { fail(e); } }
  async function loadTeam() { const { data, error } = await db.from('user_roles').select('user_id,email,display_name,role,created_at').order('created_at'); if (error) throw error; roleRows = data || []; $('#team-body').innerHTML = roleRows.map(u => `<tr><td><strong>${escape(u.display_name)}</strong></td><td>${escape(u.email)}</td><td><span class="role-badge">${escape(u.role)}</span></td><td>${date(u.created_at)}</td><td><button class="row-action" data-revoke-role="${escape(u.email)}" ${roleRows.filter(x => x.role === 'admin').length === 1 && u.role === 'admin' ? 'disabled title="Keep at least one admin"' : ''}>Remove</button></td></tr>`).join('') || '<tr><td colspan="5" class="empty-state">No dashboard users.</td></tr>'; }
  async function assignRole(ev) { ev.preventDefault(); const f = ev.currentTarget; try { const { error } = await db.rpc('ebm_assign_role', { p_email: field(f, 'email').value.trim(), p_display_name: field(f, 'display_name').value.trim(), p_role: field(f, 'role').value }); if (error) throw error; f.reset(); await loadTeam(); notify('Dashboard access assigned.'); } catch (e) { fail(e); } }
  async function revokeRole(email) { if (!confirm(`Remove dashboard access for ${email}?`)) return; try { const { error } = await db.rpc('ebm_revoke_role', { p_email: email }); if (error) throw error; await loadTeam(); notify('Dashboard access removed.'); } catch (e) { fail(e); } }
  async function init() {
    const config = window.EBM_SUPABASE_CONFIG || {};
    if (!config.url || !config.publishableKey || !window.supabase?.createClient) { $('#login-form').querySelector('button').disabled = true; $('#login-message').textContent = 'Connect your Supabase project first. See README.md for setup and the publishable key location.'; return; }
    db = window.supabase.createClient(config.url, config.publishableKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
    $('#login-form').addEventListener('submit', async e => { e.preventDefault(); const button = e.currentTarget.querySelector('button'); button.disabled = true; $('#login-message').textContent = 'Signing in…'; try { const { error } = await db.auth.signInWithPassword({ email: $('#login-email').value.trim(), password: $('#login-password').value }); if (error) throw error; $('#login-message').textContent = ''; await requireRole(); } catch (err) { $('#login-message').textContent = err.message; } finally { button.disabled = false; } });
    $('#sign-out').addEventListener('click', () => db.auth.signOut().then(() => showLogin())); $('#mobile-sign-out').addEventListener('click', () => db.auth.signOut().then(() => showLogin()));
    $('#admin-nav').addEventListener('click', e => { const b = e.target.closest('[data-page]'); if (b) go(b.dataset.page); });
    $$('[data-go]').forEach(b => b.addEventListener('click', () => go(b.dataset.go))); $$('[data-action="new-order"]').forEach(b => b.addEventListener('click', openOrder));
    $('#add-product').addEventListener('click', () => openProduct()); $('#product-form').addEventListener('submit', saveProduct); $('#product-search').addEventListener('input', renderProducts); $('#products-body').addEventListener('click', e => { const edit = e.target.closest('[data-edit-product]'), del = e.target.closest('[data-delete-product]'); if (edit) openProduct(products.find(p => p.id === edit.dataset.editProduct)); if (del) deleteProduct(del.dataset.deleteProduct); });
    $('#order-search').addEventListener('input', renderOrders); $('#order-status-filter').addEventListener('change', renderOrders); $('#orders-body').addEventListener('change', e => { const sel = e.target.closest('[data-order-status]'); if (sel) setOrderStatus(sel.dataset.orderStatus, sel.value); }); $('#orders-body').addEventListener('click', e => { const b = e.target.closest('[data-view-order]'); if (b) viewOrder(b.dataset.viewOrder); });
    $('#customer-search').addEventListener('input', renderCustomers); $('#add-order-line').addEventListener('click', addOrderLine); $('#order-form').addEventListener('submit', saveOrder); $('#settings-form').addEventListener('submit', saveSettings); $('#role-form').addEventListener('submit', assignRole); $('#team-body').addEventListener('click', e => { const b = e.target.closest('[data-revoke-role]'); if (b) revokeRole(b.dataset.revokeRole); });
    $('#product-image').addEventListener('change', e => { const file = e.target.files[0]; if (!file) return; const img = document.createElement('img'); img.alt = 'Selected product image preview'; img.src = URL.createObjectURL(file); $('#product-image-preview').replaceChildren(img); });
    $$('[data-close]').forEach(b => b.addEventListener('click', () => $('#' + b.dataset.close).close()));
    db.auth.onAuthStateChange((event, session) => { if (event === 'SIGNED_OUT' || !session) showLogin(); });
    try { await requireRole(); } catch (e) { showLogin(e.message); }
  }
  document.addEventListener('DOMContentLoaded', init);
})();

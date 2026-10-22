'use strict';

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const TOKEN_KEY = 'crmcare_token';
let token = localStorage.getItem(TOKEN_KEY) || '';
let customers = [];
let contacts = [];
let interactions = [];
let activeTab = 'customers';
let toastTimer;

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}
function initials(name) {
  const parts = String(name || '?').trim().split(/\s+/).filter(Boolean);
  return (parts.length > 1 ? `${parts[0][0]}${parts[parts.length - 1][0]}` : (parts[0] || '?').slice(0, 2)).toUpperCase();
}
function showToast(message, isError = false) {
  const toast = $('#toast');
  toast.textContent = message;
  toast.classList.toggle('error', isError);
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 3200);
}
function setLoggedIn(loggedIn) {
  $('#loginView').classList.toggle('hidden', loggedIn);
  $('#appView').classList.toggle('hidden', !loggedIn);
}
function logout(message = '') {
  token = '';
  localStorage.removeItem(TOKEN_KEY);
  setLoggedIn(false);
  $('#loginForm').reset();
  if (message) $('#loginError').textContent = message;
}
async function api(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (options.body && !(options.body instanceof FormData)) headers['Content-Type'] = 'application/json';
  const response = await fetch(path, { ...options, headers });
  if (response.status === 401 && path !== '/api/auth/login') {
    logout('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
    throw new Error('Phiên đăng nhập đã hết hạn.');
  }
  if (response.status === 204) return null;
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const validationMessage = data.details?.map(d => d.message).filter(Boolean).join(' ');
    throw new Error(validationMessage || data.error || 'Yêu cầu không thành công.');
  }
  return data;
}
function statusLabel(status) {
  const map = { active: ['status-active', 'Đang hoạt động'], lead: ['status-lead', 'Tiềm năng'], inactive: ['status-inactive', 'Ngừng hoạt động'] };
  const [cls, label] = map[status] || map.lead;
  return `<span class="status-pill ${cls}">${label}</span>`;
}
function typeLabel(type) {
  const map = { call: 'Cuộc gọi', email: 'Email', meeting: 'Cuộc họp', note: 'Ghi chú' };
  return map[type] || 'Ghi chú';
}
function formatDate(dateValue, withTime = false) {
  if (!dateValue) return '—';
  const d = new Date(dateValue);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('vi-VN', withTime ? { dateStyle: 'short', timeStyle: 'short' } : { dateStyle: 'short' }).format(d);
}
function setOptions(select, items, firstLabel = 'Tất cả khách hàng') {
  const prior = select.value;
  const html = `<option value="">${escapeHtml(firstLabel)}</option>` + items.map(c => `<option value="${c.id}">${escapeHtml(c.name)}${c.company ? ` · ${escapeHtml(c.company)}` : ''}</option>`).join('');
  select.innerHTML = html;
  if ([...select.options].some(o => o.value === prior)) select.value = prior;
}
function refreshCustomerOptions() {
  setOptions($('#contactCustomerFilter'), customers, 'Tất cả khách hàng');
  setOptions($('#interactionCustomerFilter'), customers, 'Tất cả khách hàng');
  $$('.customer-options').forEach(select => setOptions(select, customers, 'Chọn khách hàng'));
}
function filteredCustomerList() {
  const q = $('#customerSearch').value.trim().toLocaleLowerCase('vi');
  if (!q) return customers;
  return customers.filter(c => [c.name, c.company, c.email, c.phone].some(v => String(v || '').toLocaleLowerCase('vi').includes(q)));
}
function renderCustomers() {
  const rows = filteredCustomerList();
  $('#customerNavCount').textContent = customers.length;
  $('#customerResultCount').textContent = `${rows.length} / ${customers.length} khách hàng`;
  $('#customersBody').innerHTML = rows.length ? rows.map(c => `
    <tr>
      <td><div class="customer-cell"><span class="person-avatar">${escapeHtml(initials(c.name))}</span><div><div class="customer-name">${escapeHtml(c.name)}</div><div class="customer-sub">${escapeHtml(c.email || 'Chưa có email')}</div></div></div></td>
      <td><span class="company-name">${escapeHtml(c.company || '—')}</span></td>
      <td>${escapeHtml(c.phone || '—')}</td>
      <td>${statusLabel(c.status)}</td>
      <td><span>${Number(c.contact_count || 0)} liên hệ</span><div class="customer-sub">${Number(c.interaction_count || 0)} tương tác</div></td>
      <td><div class="row-actions"><button class="mini-button" data-edit-customer="${c.id}">Sửa</button><button class="mini-button danger" data-delete-customer="${c.id}">Xóa</button></div></td>
    </tr>`).join('') : '<tr><td colspan="6" class="empty-cell">Chưa có khách hàng phù hợp. Hãy thêm khách hàng mới hoặc đổi từ khóa tìm kiếm.</td></tr>';
  $('#statCustomers').textContent = customers.length;
  $('#statLeads').textContent = customers.filter(c => c.status === 'lead').length;
}
function renderContacts() {
  const selected = $('#contactCustomerFilter').value;
  const rows = selected ? contacts.filter(c => String(c.customer_id) === selected) : contacts;
  $('#contactResultCount').textContent = `${rows.length} liên hệ`;
  $('#contactsBody').innerHTML = rows.length ? rows.map(c => `
    <tr><td><div class="customer-cell"><span class="person-avatar">${escapeHtml(initials(c.name))}</span><div><div class="customer-name">${escapeHtml(c.name)}</div><div class="customer-sub">${escapeHtml(c.email || 'Chưa có email')}</div></div></div></td>
    <td>${escapeHtml(c.customer_name || customers.find(x => x.id === c.customer_id)?.name || '—')}</td><td>${escapeHtml(c.role || '—')}</td><td>${c.email ? `<a class="table-link" href="mailto:${escapeHtml(c.email)}">${escapeHtml(c.email)}</a>` : '—'}</td><td>${escapeHtml(c.phone || '—')}</td>
    <td><div class="row-actions"><button class="mini-button" data-edit-contact="${c.id}">Sửa</button><button class="mini-button danger" data-delete-contact="${c.id}">Xóa</button></div></td></tr>`).join('') : '<tr><td colspan="6" class="empty-cell">Chưa có liên hệ trong mục này. Thêm liên hệ để bắt đầu.</td></tr>';
  $('#statContacts').textContent = contacts.length;
}
function renderInteractions() {
  const selected = $('#interactionCustomerFilter').value;
  const rows = selected ? interactions.filter(i => String(i.customer_id) === selected) : interactions;
  $('#interactionResultCount').textContent = `${rows.length} lượt tương tác`;
  $('#interactionsBody').innerHTML = rows.length ? rows.map(i => `
    <tr><td><b>${escapeHtml(formatDate(i.occurred_at, true))}</b></td><td>${escapeHtml(i.customer_name || customers.find(c => c.id === i.customer_id)?.name || '—')}</td>
    <td><span class="type-pill">${escapeHtml(typeLabel(i.type))}</span></td><td><div class="customer-name">${escapeHtml(i.summary)}</div>${i.details ? `<div class="customer-sub">${escapeHtml(i.details)}</div>` : ''}</td><td>${escapeHtml(i.contact_name || '—')}</td>
    <td><div class="row-actions"><button class="mini-button danger" data-delete-interaction="${i.id}">Xóa</button></div></td></tr>`).join('') : '<tr><td colspan="6" class="empty-cell">Chưa có lịch sử tương tác. Ghi nhận cuộc gọi, email hoặc cuộc họp đầu tiên.</td></tr>';
  $('#statInteractions').textContent = interactions.length;
}
async function refreshHealth() {
  try {
    const data = await api('/api/health');
    $('#healthText').textContent = data.database === 'connected' ? 'Đã kết nối cơ sở dữ liệu' : 'Cơ sở dữ liệu chưa kết nối';
  } catch (_error) {
    $('#healthText').textContent = 'Không thể kiểm tra kết nối';
  }
}
async function loadAll() {
  const [customerData, contactData, interactionData] = await Promise.all([
    api('/api/customers'), api('/api/contacts'), api('/api/interactions')
  ]);
  customers = customerData;
  contacts = contactData;
  interactions = interactionData;
  refreshCustomerOptions();
  renderCustomers();
  renderContacts();
  renderInteractions();
  $('#statContacts').textContent = contacts.length;
  $('#statInteractions').textContent = interactions.length;
  refreshHealth();
}
function switchTab(tab) {
  activeTab = tab;
  const config = {
    customers: { title: 'Khách hàng', subtitle: 'Theo dõi thông tin và xây dựng mối quan hệ bền vững với khách hàng.', panel: 'customersPanel', action: 'Thêm khách hàng' },
    contacts: { title: 'Liên hệ', subtitle: 'Quản lý người phụ trách và đầu mối liên hệ theo từng khách hàng.', panel: 'contactsPanel', action: 'Thêm liên hệ' },
    interactions: { title: 'Lịch sử tương tác', subtitle: 'Ghi lại các cuộc gọi, email, cuộc họp và hoạt động chăm sóc.', panel: 'interactionsPanel', action: 'Ghi nhận tương tác' }
  }[tab];
  $$('.nav-item').forEach(btn => btn.classList.toggle('active', btn.dataset.tab === tab));
  ['customersPanel', 'contactsPanel', 'interactionsPanel'].forEach(id => $(`#${id}`).classList.toggle('hidden', id !== config.panel));
  $('#breadcrumbTitle').textContent = config.title;
  $('#pageTitle').textContent = config.title;
  $('#pageSubtitle').textContent = config.subtitle;
  $('#newPrimaryLabel').textContent = config.action;
  $('#newPrimaryBtn').classList.remove('hidden');
  $('#overviewCards').classList.remove('hidden');
}
function openCustomerForm(customer = null) {
  const form = $('#customerForm');
  form.reset();
  form.elements.id.value = customer?.id || '';
  form.elements.name.value = customer?.name || '';
  form.elements.company.value = customer?.company || '';
  form.elements.email.value = customer?.email || '';
  form.elements.phone.value = customer?.phone || '';
  form.elements.status.value = customer?.status || 'lead';
  form.elements.notes.value = customer?.notes || '';
  $('#customerFormTitle').textContent = customer ? 'Cập nhật khách hàng' : 'Thêm khách hàng mới';
  $('#customerFormError').textContent = '';
  $('#customerFormWrap').classList.remove('hidden');
  $('#customerFormWrap').scrollIntoView({ behavior: 'smooth', block: 'start' });
  form.elements.name.focus();
}
function openContactForm(contact = null) {
  const form = $('#contactForm');
  form.reset();
  form.elements.id.value = contact?.id || '';
  form.elements.customerId.value = contact?.customer_id || $('#contactCustomerFilter').value || '';
  form.elements.name.value = contact?.name || '';
  form.elements.role.value = contact?.role || '';
  form.elements.email.value = contact?.email || '';
  form.elements.phone.value = contact?.phone || '';
  $('#contactFormTitle').textContent = contact ? 'Cập nhật liên hệ' : 'Thêm liên hệ mới';
  $('#contactFormError').textContent = '';
  $('#contactFormWrap').classList.remove('hidden');
  $('#contactFormWrap').scrollIntoView({ behavior: 'smooth', block: 'start' });
  form.elements.name.focus();
}
function localDateTimeValue(value) {
  const date = value ? new Date(value) : new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}T${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}
function openInteractionForm(interaction = null) {
  const form = $('#interactionForm');
  form.reset();
  form.elements.id.value = interaction?.id || '';
  form.elements.customerId.value = interaction?.customer_id || $('#interactionCustomerFilter').value || '';
  form.elements.type.value = interaction?.type || 'call';
  form.elements.occurredAt.value = localDateTimeValue(interaction?.occurred_at);
  form.elements.summary.value = interaction?.summary || '';
  form.elements.details.value = interaction?.details || '';
  $('#interactionFormTitle').textContent = interaction ? 'Cập nhật tương tác' : 'Ghi nhận tương tác';
  $('#interactionFormError').textContent = '';
  updateContactOptions();
  form.elements.contactId.value = interaction?.contact_id || '';
  $('#interactionFormWrap').classList.remove('hidden');
  $('#interactionFormWrap').scrollIntoView({ behavior: 'smooth', block: 'start' });
  form.elements.summary.focus();
}
function updateContactOptions() {
  const customerId = $('#interactionForm').elements.customerId.value;
  const select = $('#interactionForm').elements.contactId;
  const selectedValue = select.value;
  const related = contacts.filter(c => String(c.customer_id) === String(customerId));
  select.innerHTML = '<option value="">Không chọn</option>' + related.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');
  if ([...select.options].some(o => o.value === selectedValue)) select.value = selectedValue;
}
function formObject(form) {
  return Object.fromEntries(new FormData(form).entries());
}
function cleanOptional(obj, keys) {
  keys.forEach(key => { if (typeof obj[key] === 'string' && !obj[key].trim()) obj[key] = null; });
  return obj;
}

$('#loginForm').addEventListener('submit', async event => {
  event.preventDefault();
  $('#loginError').textContent = '';
  const form = formObject(event.currentTarget);
  const submit = $('button[type="submit"]', event.currentTarget);
  submit.disabled = true;
  try {
    const data = await api('/api/auth/login', { method: 'POST', body: JSON.stringify(form) });
    token = data.token;
    localStorage.setItem(TOKEN_KEY, token);
    $('#currentUser').textContent = data.username;
    $('#userAvatar').textContent = initials(data.username);
    setLoggedIn(true);
    await loadAll();
    showToast('Đăng nhập thành công.');
  } catch (error) {
    $('#loginError').textContent = error.message;
  } finally {
    submit.disabled = false;
  }
});
$('#logoutBtn').addEventListener('click', () => logout());
$$('.nav-item').forEach(btn => btn.addEventListener('click', () => switchTab(btn.dataset.tab)));
$('#newPrimaryBtn').addEventListener('click', () => {
  if (activeTab === 'customers') openCustomerForm();
  else if (activeTab === 'contacts') openContactForm();
  else openInteractionForm();
});
$$('[data-close]').forEach(btn => btn.addEventListener('click', () => $(`#${btn.dataset.close}`).classList.add('hidden')));
$('#customerSearch').addEventListener('input', renderCustomers);
$('#refreshCustomers').addEventListener('click', async () => { try { await loadAll(); showToast('Đã tải lại dữ liệu.'); } catch (e) { showToast(e.message, true); } });
$('#refreshContacts').addEventListener('click', async () => { try { await loadAll(); showToast('Đã tải lại dữ liệu.'); } catch (e) { showToast(e.message, true); } });
$('#refreshInteractions').addEventListener('click', async () => { try { await loadAll(); showToast('Đã tải lại dữ liệu.'); } catch (e) { showToast(e.message, true); } });
$('#contactCustomerFilter').addEventListener('change', renderContacts);
$('#interactionCustomerFilter').addEventListener('change', renderInteractions);
$('#interactionForm').elements.customerId.addEventListener('change', updateContactOptions);

$('#customerForm').addEventListener('submit', async event => {
  event.preventDefault();
  const form = event.currentTarget;
  const data = cleanOptional(formObject(form), ['company', 'email', 'phone', 'notes']);
  const id = data.id;
  delete data.id;
  try {
    await api(id ? `/api/customers/${id}` : '/api/customers', { method: id ? 'PUT' : 'POST', body: JSON.stringify(data) });
    $('#customerFormWrap').classList.add('hidden');
    await loadAll();
    showToast(id ? 'Đã cập nhật khách hàng.' : 'Đã thêm khách hàng.');
  } catch (error) { $('#customerFormError').textContent = error.message; }
});
$('#contactForm').addEventListener('submit', async event => {
  event.preventDefault();
  const form = event.currentTarget;
  const data = cleanOptional(formObject(form), ['role', 'email', 'phone']);
  const id = data.id;
  delete data.id;
  data.customerId = Number(data.customerId);
  try {
    await api(id ? `/api/contacts/${id}` : '/api/contacts', { method: id ? 'PUT' : 'POST', body: JSON.stringify(data) });
    $('#contactFormWrap').classList.add('hidden');
    await loadAll();
    showToast(id ? 'Đã cập nhật liên hệ.' : 'Đã thêm liên hệ.');
  } catch (error) { $('#contactFormError').textContent = error.message; }
});
$('#interactionForm').addEventListener('submit', async event => {
  event.preventDefault();
  const form = event.currentTarget;
  const data = cleanOptional(formObject(form), ['contactId', 'details']);
  const id = data.id;
  delete data.id;
  data.customerId = Number(data.customerId);
  if (data.contactId) data.contactId = Number(data.contactId);
  if (data.occurredAt) data.occurredAt = new Date(data.occurredAt).toISOString();
  else delete data.occurredAt;
  try {
    await api(id ? `/api/interactions/${id}` : '/api/interactions', { method: id ? 'PUT' : 'POST', body: JSON.stringify(data) });
    $('#interactionFormWrap').classList.add('hidden');
    await loadAll();
    showToast(id ? 'Đã cập nhật tương tác.' : 'Đã ghi nhận tương tác.');
  } catch (error) { $('#interactionFormError').textContent = error.message; }
});

document.addEventListener('click', async event => {
  const editCustomer = event.target.closest('[data-edit-customer]');
  const deleteCustomer = event.target.closest('[data-delete-customer]');
  const editContact = event.target.closest('[data-edit-contact]');
  const deleteContact = event.target.closest('[data-delete-contact]');
  const editInteraction = event.target.closest('[data-edit-interaction]');
  const deleteInteraction = event.target.closest('[data-delete-interaction]');
  try {
    if (editCustomer) openCustomerForm(customers.find(c => String(c.id) === String(editCustomer.dataset.editCustomer)));
    else if (deleteCustomer) {
      const customer = customers.find(c => String(c.id) === String(deleteCustomer.dataset.deleteCustomer));
      if (customer && confirm(`Xóa khách hàng “${customer.name}”? Các liên hệ và lịch sử tương tác của khách hàng này cũng sẽ bị xóa.`)) {
        await api(`/api/customers/${customer.id}`, { method: 'DELETE' }); await loadAll(); showToast('Đã xóa khách hàng.');
      }
    } else if (editContact) openContactForm(contacts.find(c => String(c.id) === String(editContact.dataset.editContact)));
    else if (deleteContact) {
      const contact = contacts.find(c => String(c.id) === String(deleteContact.dataset.deleteContact));
      if (contact && confirm(`Xóa liên hệ “${contact.name}”?`)) { await api(`/api/contacts/${contact.id}`, { method: 'DELETE' }); await loadAll(); showToast('Đã xóa liên hệ.'); }
    } else if (deleteInteraction) {
      const row = interactions.find(i => String(i.id) === String(deleteInteraction.dataset.deleteInteraction));
      if (row && confirm(`Xóa ghi nhận “${row.summary}”?`)) { await api(`/api/interactions/${row.id}`, { method: 'DELETE' }); await loadAll(); showToast('Đã xóa tương tác.'); }
    }
  } catch (error) { showToast(error.message, true); }
});

async function initialize() {
  if (!token) { setLoggedIn(false); return; }
  setLoggedIn(true);
  try {
    const data = await api('/api/customers');
    customers = data;
    $('#currentUser').textContent = 'Admin';
    $('#userAvatar').textContent = 'A';
    await loadAll();
  } catch (error) {
    if (token) { logout('Không thể tải dữ liệu. Vui lòng đăng nhập lại.'); }
  }
}
initialize();

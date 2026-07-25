// ==================== ROUTER & STATE ====================
let currentPage = 'dashboard';
const content = document.getElementById('content');

const NAV_ITEMS = {
  admin: [
    { id: 'dashboard', icon: 'fa-chart-pie', label: 'Dashboard' },
    { id: 'expenses', icon: 'fa-receipt', label: 'Expenses' },
    { id: 'collections', icon: 'fa-money-bill-wave', label: 'Collections' },
    { id: 'settlements', icon: 'fa-calendar-check', label: 'Settlements' },
    { id: 'petty-cash', icon: 'fa-wallet', label: 'Petty Cash' },
    { id: 'budgets', icon: 'fa-piggy-bank', label: 'Budgets' },
    { id: 'expense-heads', icon: 'fa-tags', label: 'Categories' },
    { id: 'users', icon: 'fa-users', label: 'Users' },
    { id: 'reports', icon: 'fa-file-export', label: 'Reports' },
    { id: 'audit-log', icon: 'fa-history', label: 'Audit Log' },
  ],
  accounts_head: [
    { id: 'dashboard', icon: 'fa-chart-pie', label: 'Dashboard' },
    { id: 'expenses', icon: 'fa-receipt', label: 'Expenses' },
    { id: 'collections', icon: 'fa-money-bill-wave', label: 'Collections' },
    { id: 'settlements', icon: 'fa-calendar-check', label: 'Settlements' },
    { id: 'petty-cash', icon: 'fa-wallet', label: 'Petty Cash' },
    { id: 'reports', icon: 'fa-file-export', label: 'Reports' },
  ],
  employee: [
    { id: 'dashboard', icon: 'fa-chart-pie', label: 'Dashboard' },
    { id: 'my-expenses', icon: 'fa-receipt', label: 'My Expenses' },
    { id: 'collections', icon: 'fa-money-bill-wave', label: 'Collections' },
    { id: 'settlements', icon: 'fa-calendar-check', label: 'Settlements' },
    { id: 'petty-cash', icon: 'fa-wallet', label: 'Petty Cash' },
    { id: 'profile', icon: 'fa-user', label: 'Profile' },
  ],
};

// ==================== INIT ====================
document.addEventListener('DOMContentLoaded', () => {
  if (api.token && api.user) {
    showApp();
  } else {
    showLogin();
  }

  document.getElementById('login-form').addEventListener('submit', handleLogin);
});

function showLogin() {
  document.getElementById('login-page').classList.remove('hidden');
  document.getElementById('app').classList.add('hidden');
}

async function showApp() {
  document.getElementById('login-page').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
  document.getElementById('sidebar-role').textContent = api.user.role.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase());
  document.getElementById('user-avatar').textContent = api.user.name.charAt(0).toUpperCase();
  document.getElementById('user-name').textContent = api.user.name;
  document.getElementById('user-email').textContent = api.user.email;
  buildSidebar();
  navigateTo('dashboard');
}

function buildSidebar() {
  const nav = document.getElementById('sidebar-nav');
  const items = NAV_ITEMS[api.user.role] || NAV_ITEMS.employee;
  nav.innerHTML = items.map(item => `
    <a href="#" onclick="navigateTo('${item.id}');return false"
       class="sidebar-link flex items-center gap-3 px-4 py-3 rounded-lg text-sm hover:bg-white/10 transition ${item.id === currentPage ? 'active' : ''}"
       data-page="${item.id}">
      <i class="fas ${item.icon} w-5 text-center"></i>
      <span>${item.label}</span>
    </a>
  `).join('');
}

function navigateTo(page) {
  currentPage = page;
  document.querySelectorAll('.sidebar-link').forEach(el => el.classList.toggle('active', el.dataset.page === page));
  renderPage(page);
  if (window.innerWidth < 1024) document.getElementById('sidebar').classList.add('-translate-x-full');
}

function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('-translate-x-full');
}

async function handleLogin(e) {
  e.preventDefault();
  const email = document.getElementById('login-email').value;
  const password = document.getElementById('login-password').value;
  const errEl = document.getElementById('login-error');
  errEl.classList.add('hidden');
  try {
    const data = await api.post('/auth/login', { email, password });
    api.setAuth(data.token, data.user);
    showApp();
  } catch (err) {
    errEl.textContent = err.message;
    errEl.classList.remove('hidden');
  }
}

function logout() {
  api.clearAuth();
  showLogin();
}

function toast(msg, type = 'success') {
  const el = document.createElement('div');
  el.className = `fixed top-4 right-4 z-50 px-6 py-3 rounded-lg text-white font-medium shadow-lg fade-in ${type === 'error' ? 'bg-red-500' : 'bg-green-500'}`;
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3000);
}

function openModal(title, bodyHtml) {
  document.getElementById('modal-title').innerHTML = title;
  document.getElementById('modal-body').innerHTML = bodyHtml;
  document.getElementById('modal').classList.remove('hidden');
}

function closeModal() {
  document.getElementById('modal').classList.add('hidden');
}

function openLightbox(url) {
  const existing = document.getElementById('lightbox');
  if (existing) existing.remove();
  const lb = document.createElement('div');
  lb.id = 'lightbox';
  lb.className = 'fixed inset-0 z-[60] bg-black/80 flex items-center justify-center p-4';
  lb.onclick = (e) => { if (e.target === lb) lb.remove(); };
  lb.innerHTML = `
    <button onclick="document.getElementById('lightbox').remove()" class="absolute top-4 right-4 text-white text-3xl hover:text-gray-300 z-10">&times;</button>
    <img src="${url}" class="max-w-full max-h-full object-contain rounded-lg shadow-2xl">
  `;
  document.body.appendChild(lb);
  const escHandler = (e) => { if (e.key === 'Escape') { lb.remove(); document.removeEventListener('keydown', escHandler); } };
  document.addEventListener('keydown', escHandler);
}

function fmt(n) { return '৳' + Number(n || 0).toLocaleString('en-BD', { minimumFractionDigits: 2 }); }
function fmtDate(d) { return d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'; }
function todayStr() { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
function statusBadge(s) {
  const colors = { pending: 'bg-yellow-100 text-yellow-700', approved: 'bg-green-100 text-green-700', rejected: 'bg-red-100 text-red-700', active: 'bg-green-100 text-green-700', closed: 'bg-gray-100 text-gray-700' };
  return `<span class="px-2 py-1 rounded-full text-xs font-medium ${colors[s] || 'bg-gray-100 text-gray-700'}">${s}</span>`;
}

// ==================== PAGE RENDERER ====================
async function renderPage(page) {
  content.innerHTML = '<div class="flex items-center justify-center py-20"><div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div>';
  try {
    switch (page) {
      case 'dashboard': await renderDashboard(); break;
      case 'expenses': case 'my-expenses': await renderExpenses(); break;
      case 'collections': await renderCollections(); break;
      case 'settlements': await renderSettlements(); break;
      case 'petty-cash': await renderPettyCash(); break;
      case 'budgets': await renderBudgets(); break;
      case 'expense-heads': await renderExpenseHeads(); break;
      case 'users': await renderUsers(); break;
      case 'reports': await renderReports(); break;
      case 'audit-log': await renderAuditLog(); break;
      case 'profile': await renderProfile(); break;
      default: content.innerHTML = '<p>Page not found</p>';
    }
  } catch (err) {
    content.innerHTML = `<div class="text-center py-20 text-gray-500"><i class="fas fa-exclamation-triangle text-4xl mb-4"></i><p>${err.message}</p></div>`;
  }
}

// ==================== DASHBOARD ====================
async function renderDashboard() {
  const data = await api.get('/dashboard');
  const d = data.dashboard;
  let html = '<div class="fade-in">';

  if (api.user.role === 'admin') {
    html += `<h2 class="text-2xl font-bold text-gray-800 mb-6">Admin Dashboard</h2>
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      ${statCard('Total Expenses', fmt(d.expenses.total_amount), 'fa-receipt', 'blue')}
      ${statCard('Pending Approval', `${d.expenses.pending_count} (${fmt(d.expenses.pending_amount)})`, 'fa-clock', 'yellow')}
      ${statCard('Approved Total', fmt(d.expenses.approved_amount), 'fa-check-circle', 'green')}
      ${statCard('Active Users', d.users.active + ' / ' + d.users.total, 'fa-users', 'purple')}
    </div>
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div class="bg-white rounded-xl shadow-sm p-6">
        <h3 class="font-semibold text-gray-800 mb-4">Recent Expenses</h3>
        <div class="space-y-3">${d.recent_expenses.map(e => `
          <div class="flex items-center justify-between py-2 border-b last:border-0">
            <div><p class="text-sm font-medium">${e.head_name || 'Uncategorized'}</p><p class="text-xs text-gray-500">${e.created_by_name} · ${fmtDate(e.date)}</p></div>
            <div class="text-right"><p class="font-semibold text-sm">${fmt(e.amount)}</p>${statusBadge(e.status)}</div>
          </div>`).join('')}</div>
      </div>
      <div class="bg-white rounded-xl shadow-sm p-6">
        <h3 class="font-semibold text-gray-800 mb-4">Category Breakdown (This Month)</h3>
        ${d.category_breakdown.length ? d.category_breakdown.map(c => `
          <div class="mb-3">
            <div class="flex justify-between text-sm mb-1"><span>${c.head_name}</span><span class="font-medium">${fmt(c.total)}</span></div>
            <div class="h-2 bg-gray-100 rounded-full"><div class="h-2 bg-blue-500 rounded-full" style="width:${Math.min((c.total / d.expenses.approved_amount) * 100, 100)}%"></div></div>
          </div>`).join('') : '<p class="text-gray-400 text-sm">No data this month</p>'}
      </div>
    </div>`;
  } else if (api.user.role === 'accounts_head') {
    html += `<h2 class="text-2xl font-bold text-gray-800 mb-6">Accounts Head Dashboard</h2>
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
      ${statCard('Pending Expenses', d.pending_expenses.count + ' (' + fmt(d.pending_expenses.amount) + ')', 'fa-clock', 'yellow')}
      ${statCard('Pending Settlements', d.pending_settlements, 'fa-calendar-check', 'blue')}
      ${statCard('Pending Petty Cash', d.pending_petty_cash_transactions, 'fa-wallet', 'purple')}
    </div>
    <div class="bg-white rounded-xl shadow-sm p-6">
      <h3 class="font-semibold text-gray-800 mb-4">Pending Expenses for Review</h3>
      ${d.pending_expenses_list.length ? `<table class="w-full"><thead><tr class="text-left text-xs text-gray-500 border-b"><th class="pb-2">Date</th><th class="pb-2">Employee</th><th class="pb-2">Category</th><th class="pb-2">Amount</th><th class="pb-2">Action</th></tr></thead><tbody>${d.pending_expenses_list.map(e => `
        <tr class="table-row border-b"><td class="py-3 text-sm">${fmtDate(e.date)}</td><td class="py-3 text-sm">${e.created_by_name}</td><td class="py-3 text-sm">${e.head_name}</td><td class="py-3 text-sm font-medium">${fmt(e.amount)}</td>
        <td class="py-3"><button onclick="quickApprove(${e.id})" class="text-green-600 hover:text-green-800 text-sm mr-2"><i class="fas fa-check"></i></button><button onclick="quickReject(${e.id})" class="text-red-600 hover:text-red-800 text-sm"><i class="fas fa-times"></i></button></td></tr>`).join('')}</tbody></table>` : '<p class="text-gray-400 text-sm">No pending expenses</p>'}
    </div>`;
  } else {
    html += `<h2 class="text-2xl font-bold text-gray-800 mb-6">My Dashboard</h2>
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      ${statCard('Pending', fmt(d.expenses.pending_amount), 'fa-clock', 'yellow')}
      ${statCard('Approved', fmt(d.expenses.approved_amount), 'fa-check-circle', 'green')}
      ${statCard('Rejected', fmt(d.expenses.rejected_amount), 'fa-times-circle', 'red')}
      ${statCard('This Month', fmt(d.month_expenses.amount), 'fa-calendar', 'blue')}
    </div>
    <div class="bg-white rounded-xl shadow-sm p-6">
      <h3 class="font-semibold text-gray-800 mb-4">Recent Expenses</h3>
      ${d.recent_expenses.length ? `<table class="w-full"><thead><tr class="text-left text-xs text-gray-500 border-b"><th class="pb-2">Date</th><th class="pb-2">Category</th><th class="pb-2">Amount</th><th class="pb-2">Status</th></tr></thead><tbody>${d.recent_expenses.map(e => `
        <tr class="table-row border-b"><td class="py-3 text-sm">${fmtDate(e.date)}</td><td class="py-3 text-sm">${e.head_name}</td><td class="py-3 text-sm font-medium">${fmt(e.amount)}</td><td class="py-3">${statusBadge(e.status)}</td></tr>`).join('')}</tbody></table>` : '<p class="text-gray-400 text-sm">No expenses yet. Click "New Expense" to start.</p>'}
    </div>`;
  }

  html += '</div>';
  content.innerHTML = html;
}

function statCard(label, value, icon, color) {
  const colors = { blue: 'from-blue-500 to-blue-600', green: 'from-green-500 to-green-600', yellow: 'from-yellow-500 to-yellow-600', red: 'from-red-500 to-red-600', purple: 'from-purple-500 to-purple-600' };
  return `<div class="stat-card bg-gradient-to-br ${colors[color]} rounded-xl p-5 text-white">
    <div class="flex items-center justify-between mb-3"><span class="text-white/80 text-sm">${label}</span><i class="fas ${icon} text-white/60"></i></div>
    <p class="text-2xl font-bold">${value}</p>
  </div>`;
}

async function quickApprove(id) {
  try { await api.patch(`/expenses/${id}/approve`); toast('Expense approved'); renderPage('dashboard'); } catch (e) { toast(e.message, 'error'); }
}
async function quickReject(id) {
  if (!confirm('Reject this expense?')) return;
  try { await api.patch(`/expenses/${id}/reject`); toast('Expense rejected'); renderPage('dashboard'); } catch (e) { toast(e.message, 'error'); }
}
async function deleteExpense(id) {
  if (!confirm('Delete this expense? This cannot be undone.')) return;
  try { await api.request('DELETE', `/expenses/${id}`); toast('Expense deleted'); renderPage(currentPage); } catch (e) { toast(e.message, 'error'); }
}

// Bulk selection
function toggleSelectAllExpenses(checkbox) {
  document.querySelectorAll('.expense-checkbox').forEach(cb => {
    const row = cb.closest('tr');
    if (row && row.style.display !== 'none') cb.checked = checkbox.checked;
  });
  updateSelectedCount();
}

function updateSelectedCount() {
  const pending = [...document.querySelectorAll('.expense-checkbox:checked')].filter(cb => cb.dataset.status === 'pending');
  const rejected = [...document.querySelectorAll('.expense-checkbox:checked')].filter(cb => cb.dataset.status === 'rejected');
  const approveBtn = document.getElementById('approve-selected-btn');
  const approveCnt = document.getElementById('selected-count');
  const deleteBtn = document.getElementById('delete-selected-btn');
  const deleteCnt = document.getElementById('delete-count');
  if (approveBtn && approveCnt) {
    approveCnt.textContent = pending.length;
    approveBtn.classList.toggle('hidden', pending.length === 0);
  }
  if (deleteBtn && deleteCnt) {
    deleteCnt.textContent = rejected.length;
    deleteBtn.classList.toggle('hidden', rejected.length === 0);
  }
}

async function bulkApproveExpenses() {
  const ids = [...document.querySelectorAll('.expense-checkbox:checked')].filter(cb => cb.dataset.status === 'pending').map(cb => Number(cb.dataset.id));
  if (ids.length === 0) return toast('No pending expenses selected', 'error');
  if (!confirm(`Approve ${ids.length} expense(s)?`)) return;
  try {
    const result = await api.post('/expenses/bulk-approve', { ids });
    toast(`${result.approved} expense(s) approved`);
    renderExpenses();
  } catch (e) { toast(e.message, 'error'); }
}

async function bulkDeleteExpenses() {
  const ids = [...document.querySelectorAll('.expense-checkbox:checked')].filter(cb => cb.dataset.status === 'rejected').map(cb => Number(cb.dataset.id));
  if (ids.length === 0) return toast('No rejected expenses selected', 'error');
  if (!confirm(`Delete ${ids.length} rejected expense(s)? This cannot be undone.`)) return;
  try {
    const result = await api.post('/expenses/bulk-delete', { ids });
    toast(`${result.deleted} expense(s) deleted`);
    renderExpenses();
  } catch (e) { toast(e.message, 'error'); }
}

// ==================== ATTACHMENTS MODAL ====================
async function showAttachmentsModal(entityType, entityId, canUpload) {
  const data = await api.get(`/attachments?entity_type=${entityType}&entity_id=${entityId}`);
  const attachments = data.attachments || [];
  const isAdmin = api.user.role === 'admin';

  let bodyHtml = '';

  if (attachments.length) {
    bodyHtml += '<div class="mb-4"><h4 class="text-sm font-medium text-gray-700 mb-2">Existing Files</h4><div class="grid grid-cols-2 gap-3">';
    attachments.forEach(a => {
      const isImage = a.file_type && a.file_type.startsWith('image/');
      const isPdf = a.file_type && a.file_type.includes('pdf');
      const fileName = a.file_url.split('/').pop();
      if (isImage) {
        bodyHtml += `<div class="relative group border rounded-lg overflow-hidden cursor-pointer" onclick="openLightbox('${a.file_url}')">
          <img src="${a.file_url}" class="w-full h-28 object-cover" alt="${fileName}">
          <div class="p-2"><p class="text-xs text-gray-500 truncate">${fileName}</p><p class="text-xs text-gray-400">${a.uploaded_by_name || ''}</p></div>
          ${isAdmin ? `<button onclick="event.stopPropagation();deleteAttachment(${a.id}, '${entityType}', ${entityId})" class="absolute top-1 right-1 bg-red-500 text-white w-5 h-5 rounded-full text-xs hover:bg-red-600 flex items-center justify-center"><i class="fas fa-times"></i></button>` : ''}
        </div>`;
      } else {
        bodyHtml += `<div class="relative group border rounded-lg p-3 flex items-center gap-3">
          <a href="${a.file_url}" target="_blank" class="flex items-center gap-2 flex-1 min-w-0">
            <i class="fas ${isPdf ? 'fa-file-pdf text-red-500' : 'fa-file text-gray-400'} text-xl"></i>
            <span class="text-sm text-blue-600 hover:underline truncate">${fileName}</span>
          </a>
          ${isAdmin ? `<button onclick="deleteAttachment(${a.id}, '${entityType}', ${entityId})" class="text-red-400 hover:text-red-600 text-xs flex-shrink-0"><i class="fas fa-trash"></i></button>` : ''}
        </div>`;
      }
    });
    bodyHtml += '</div></div>';
  } else {
    bodyHtml += '<p class="text-gray-400 text-sm mb-4">No attachments yet.</p>';
  }

  if (canUpload) {
    bodyHtml += `
      <form id="att-upload-form" class="border-t pt-4">
        <label class="block text-sm font-medium text-gray-700 mb-1">Upload Files</label>
        <input type="file" id="att-files" multiple accept="image/*,.pdf" class="w-full px-3 py-2 border rounded-lg text-sm mb-2">
        <button type="submit" class="w-full bg-blue-600 text-white py-2 rounded-lg text-sm hover:bg-blue-700"><i class="fas fa-upload mr-1"></i>Upload</button>
      </form>`;
  }

  openModal('Attachments', bodyHtml);

  if (canUpload) {
    document.getElementById('att-upload-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const files = document.getElementById('att-files').files;
      if (!files.length) { toast('Select files first', 'error'); return; }
      const fd = new FormData();
      fd.append('entity_type', entityType);
      fd.append('entity_id', entityId);
      for (let f of files) fd.append('files', f);
      try {
        await api.post('/attachments', fd, true);
        toast('Files uploaded');
        showAttachmentsModal(entityType, entityId, canUpload);
        loadAttachmentCounts();
      } catch (err) { toast(err.message, 'error'); }
    });
  }
}

async function deleteAttachment(id, entityType, entityId) {
  if (!confirm('Delete this attachment?')) return;
  try {
    await api.request('DELETE', `/attachments/${id}`);
    toast('Attachment deleted');
    showAttachmentsModal(entityType, entityId, api.user.role === 'admin' || (api.user.role === 'employee' && entityType === 'expense'));
    loadAttachmentCounts();
  } catch (err) { toast(err.message, 'error'); }
}

let _attachmentCounts = {};
async function loadAttachmentCounts() {
  try {
    const expData = await api.get('/expenses?limit=100');
    const expIds = expData.expenses.map(e => e.id);
    if (expIds.length) {
      const countData = await api.get(`/attachments/count?entity_type=expense&entity_ids=${expIds.join(',')}`);
      Object.assign(_attachmentCounts, { expense: countData.counts || {} });
    }
    const setData = await api.get('/settlements?limit=100');
    const setIds = setData.settlements.map(s => s.id);
    if (setIds.length) {
      const countData = await api.get(`/attachments/count?entity_type=settlement&entity_ids=${setIds.join(',')}`);
      Object.assign(_attachmentCounts, { settlement: countData.counts || {} });
    }
  } catch (e) { /* silent */ }
}

function attBadge(entityType, entityId, canUpload) {
  const count = (_attachmentCounts[entityType] || {})[entityId] || 0;
  return `<button onclick="showAttachmentsModal('${entityType}', ${entityId}, ${canUpload})" class="text-gray-400 hover:text-blue-600 relative" title="Attachments">
    <i class="fas fa-paperclip"></i>${count ? `<span class="absolute -top-1 -right-2 bg-blue-500 text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center">${count}</span>` : ''}
  </button>`;
}

// ==================== EXPENSES ====================
async function renderExpenses() {
  const isEmployee = api.user.role === 'employee' || currentPage === 'my-expenses';
  const [headsData, expensesData] = await Promise.all([
    api.get('/expense-heads/flat'),
    api.get('/expenses?limit=100')
  ]);

  // Load attachment counts
  await loadAttachmentCounts();

  const showCheckboxes = !isEmployee;
  let html = `<div class="fade-in">
    <div class="flex items-center justify-between mb-6">
      <h2 class="text-2xl font-bold text-gray-800">${isEmployee ? 'My Expenses' : 'All Expenses'}</h2>
      <div class="flex items-center gap-2">
        ${showCheckboxes ? `<button id="approve-selected-btn" onclick="bulkApproveExpenses()" class="hidden bg-green-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-green-700"><i class="fas fa-check-double mr-1"></i>Approve Selected (<span id="selected-count">0</span>)</button>` : ''}
        ${showCheckboxes ? `<button id="delete-selected-btn" onclick="bulkDeleteExpenses()" class="hidden bg-red-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-red-700"><i class="fas fa-trash-alt mr-1"></i>Delete Selected (<span id="delete-count">0</span>)</button>` : ''}
        <button onclick="showExpenseForm()" class="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700"><i class="fas fa-plus mr-1"></i>New Expense</button>
      </div>
    </div>
    <div class="bg-white rounded-xl shadow-sm overflow-hidden">
      <div class="p-4 border-b flex flex-wrap gap-3">
        <select id="filter-status" onchange="filterExpenses()" class="px-3 py-2 border rounded-lg text-sm">
          <option value="">All Status</option><option value="pending">Pending</option><option value="approved">Approved</option><option value="rejected">Rejected</option>
        </select>
        <input type="date" id="filter-from" onchange="filterExpenses()" class="px-3 py-2 border rounded-lg text-sm" placeholder="From">
        <input type="date" id="filter-to" onchange="filterExpenses()" class="px-3 py-2 border rounded-lg text-sm" placeholder="To">
      </div>
      <div class="overflow-x-auto">
        <table class="w-full">
          <thead><tr class="text-left text-xs text-gray-500 bg-gray-50">
            ${showCheckboxes ? '<th class="px-4 py-3 w-10"><input type="checkbox" id="select-all-expenses" onchange="toggleSelectAllExpenses(this)" class="rounded"></th>' : ''}
            <th class="px-4 py-3">Date</th>
            <th class="px-4 py-3">Category</th>
            <th class="px-4 py-3">Explanation</th>
            ${!isEmployee ? '<th class="px-4 py-3">Employee</th>' : ''}
            <th class="px-4 py-3">Amount</th>
            <th class="px-4 py-3">Status</th>
            <th class="px-4 py-3">Actions</th>
          </tr></thead>
          <tbody id="expenses-table">${expensesData.expenses.map(e => expenseRow(e, isEmployee)).join('')}</tbody>
          <tfoot id="expenses-total"><tr class="bg-gray-50 font-semibold text-sm">
            <td colspan="${isEmployee ? 4 : 5}" class="px-4 py-3 text-right">Total</td>
            <td class="px-4 py-3">${fmt(expensesData.expenses.reduce((sum, e) => sum + Number(e.amount || 0), 0))}</td>
            <td colspan="2"></td>
          </tr></tfoot>
        </table>
      </div>
    </div>
  </div>`;
  content.innerHTML = html;
}

function expenseRow(e, isEmployee) {
  const canUploadAtt = api.user.role === 'admin' || (api.user.role === 'employee' && e.created_by === api.user.id);
  const isAdmin = api.user.role === 'admin';
  const canEdit = isAdmin && (e.status === 'approved' || e.status === 'rejected');
  const canApproveReject = e.status === 'pending' && !isEmployee;
  const showCheckbox = !isEmployee && (e.status === 'pending' || (e.status === 'rejected' && isAdmin));
  return `<tr class="table-row border-b">
    ${showCheckbox ? `<td class="px-4 py-3 w-10"><input type="checkbox" class="expense-checkbox rounded" data-id="${e.id}" data-status="${e.status}" onchange="updateSelectedCount()"></td>` : (!isEmployee ? '<td class="px-4 py-3 w-10"></td>' : '')}
    <td class="px-4 py-3 text-sm">${fmtDate(e.date)}</td>
    <td class="px-4 py-3 text-sm">${e.head_name}${e.subhead_name ? ' / ' + e.subhead_name : ''}</td>
    <td class="px-4 py-3 text-sm text-gray-600 max-w-[200px] truncate" title="${e.explanation || ''}">${e.explanation || '-'}</td>
    ${!isEmployee ? `<td class="px-4 py-3 text-sm">${e.created_by_name}</td>` : ''}
    <td class="px-4 py-3 text-sm font-medium">${fmt(e.amount)}</td>
    <td class="px-4 py-3">${statusBadge(e.status)}</td>
    <td class="px-4 py-3 text-sm flex items-center gap-2">
      <button onclick="viewExpense(${e.id})" class="text-blue-600 hover:text-blue-800" title="View"><i class="fas fa-eye"></i></button>
      ${attBadge('expense', e.id, canUploadAtt)}
      ${canApproveReject ? `
        <button onclick="quickApprove(${e.id});renderExpenses()" class="text-green-600 hover:text-green-800" title="Approve"><i class="fas fa-check"></i></button>
        <button onclick="quickReject(${e.id});renderExpenses()" class="text-red-600 hover:text-red-800" title="Reject"><i class="fas fa-times"></i></button>
      ` : ''}
      ${canEdit ? `<button onclick="showEditExpense(${e.id})" class="text-orange-500 hover:text-orange-700" title="Edit"><i class="fas fa-edit"></i></button>` : ''}
      ${isAdmin ? `<button onclick="deleteExpense(${e.id})" class="text-red-400 hover:text-red-600" title="Delete"><i class="fas fa-trash"></i></button>` : ''}
    </td>
  </tr>`;
}

let _headsCache = null;
async function getHeads() {
  if (!_headsCache) _headsCache = await api.get('/expense-heads/flat');
  return _headsCache;
}

async function showExpenseForm() {
  const heads = await getHeads();
  openModal('New Expense', `
    <form id="expense-form" class="space-y-4">
      <div><label class="block text-sm font-medium mb-1">Date *</label><input type="date" id="ef-date" required value="${todayStr()}" class="w-full px-3 py-2 border rounded-lg"></div>
      <div><label class="block text-sm font-medium mb-1">Category *</label>
        <select id="ef-head" required class="w-full px-3 py-2 border rounded-lg" onchange="updateSubheads()">
          <option value="">Select category</option>${heads.expense_heads.filter(h => !h.parent_id).map(h => `<option value="${h.id}">${h.name}</option>`).join('')}
        </select>
      </div>
      <div id="subhead-wrap" class="hidden"><label class="block text-sm font-medium mb-1">Subcategory</label>
        <select id="ef-subhead" class="w-full px-3 py-2 border rounded-lg"><option value="">None</option></select>
      </div>
      <div><label class="block text-sm font-medium mb-1">Amount (৳) *</label><input type="number" id="ef-amount" required step="0.01" min="0" class="w-full px-3 py-2 border rounded-lg" placeholder="0.00"></div>
      <div><label class="block text-sm font-medium mb-1">Explanation</label><textarea id="ef-explanation" rows="3" class="w-full px-3 py-2 border rounded-lg" placeholder="What is this expense for?"></textarea></div>
      <div><label class="block text-sm font-medium mb-1">Attachments</label><input type="file" id="ef-files" multiple accept="image/*,.pdf" class="w-full px-3 py-2 border rounded-lg text-sm"></div>
      <button type="submit" class="w-full bg-blue-600 text-white py-2 rounded-lg font-medium hover:bg-blue-700">Submit Expense</button>
    </form>
  `);
  document.getElementById('expense-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData();
    fd.append('date', document.getElementById('ef-date').value);
    fd.append('head_id', document.getElementById('ef-head').value);
    const sub = document.getElementById('ef-subhead').value;
    if (sub) fd.append('subhead_id', sub);
    fd.append('amount', document.getElementById('ef-amount').value);
    fd.append('explanation', document.getElementById('ef-explanation').value);
    const files = document.getElementById('ef-files').files;
    for (let f of files) fd.append('files', f);
    try {
      await api.post('/expenses', fd, true);
      closeModal(); toast('Expense submitted'); _headsCache = null; renderPage(currentPage);
    } catch (err) { toast(err.message, 'error'); }
  });
}

function updateSubheads() {
  const headId = document.getElementById('ef-head').value;
  const wrap = document.getElementById('subhead-wrap');
  const sel = document.getElementById('ef-subhead');
  if (!headId) { wrap.classList.add('hidden'); return; }
  const heads = _headsCache.expense_heads.filter(h => h.parent_id == headId);
  if (heads.length === 0) { wrap.classList.add('hidden'); return; }
  wrap.classList.remove('hidden');
  sel.innerHTML = '<option value="">None</option>' + heads.map(h => `<option value="${h.id}">${h.name}</option>`).join('');
}

async function viewExpense(id) {
  const data = await api.get(`/expenses/${id}`);
  const e = data.expense;
  openModal(`Expense Details <button onclick="showVersionHistory('expense',${id})" class="ml-2 text-gray-400 hover:text-blue-500 cursor-pointer" title="Version History"><i class="fas fa-clock"></i></button>`, `
    <div class="space-y-4">
      <div class="grid grid-cols-2 gap-4 text-sm">
        <div><span class="text-gray-500">Date</span><p class="font-medium">${fmtDate(e.date)}</p></div>
        <div><span class="text-gray-500">Status</span><p>${statusBadge(e.status)}</p></div>
        <div><span class="text-gray-500">Category</span><p class="font-medium">${e.head_name || '-'}</p></div>
        <div><span class="text-gray-500">Subcategory</span><p class="font-medium">${e.subhead_name || '-'}</p></div>
        <div><span class="text-gray-500">Amount</span><p class="font-bold text-lg">${fmt(e.amount)}</p></div>
        <div><span class="text-gray-500">Created by</span><p class="font-medium">${e.created_by_name}</p></div>
      </div>
      ${e.explanation ? `<div><span class="text-gray-500 text-sm">Explanation</span><p class="mt-1 text-sm bg-gray-50 p-3 rounded-lg">${e.explanation}</p></div>` : ''}
      ${e.attachments.length ? `<div><span class="text-gray-500 text-sm">Attachments</span><div class="grid grid-cols-2 gap-3 mt-2">${e.attachments.map(a => {
        const isImage = a.file_type && a.file_type.startsWith('image/');
        if (isImage) {
          return `<div class="border rounded-lg overflow-hidden cursor-pointer" style="width:192px;height:192px;" onclick="openLightbox('${a.file_url}')"><img src="${a.file_url}" class="w-full h-full object-cover" alt="attachment"></div>`;
        } else {
          const isPdf = a.file_type && a.file_type.includes('pdf');
          return `<a href="${a.file_url}" target="_blank" class="flex items-center gap-2 border rounded-lg p-3 hover:bg-gray-50" style="width:192px;height:192px;"><i class="fas ${isPdf ? 'fa-file-pdf text-red-500' : 'fa-file text-gray-400'} text-3xl"></i><span class="text-sm text-blue-600 hover:underline truncate">${a.file_url.split('/').pop()}</span></a>`;
        }
      }).join('')}</div></div>` : ''}
      ${e.notes.length ? `<div><span class="text-gray-500 text-sm">Verification Notes</span><div class="space-y-2 mt-2">${e.notes.map(n => `<div class="bg-yellow-50 p-3 rounded-lg text-sm"><p>${n.note}</p><p class="text-xs text-gray-500 mt-1">${n.created_by_name} · ${fmtDate(n.created_at)}</p></div>`).join('')}</div></div>` : ''}
    </div>
  `);
}

async function showEditExpense(id) {
  const [expenseData, headsData] = await Promise.all([
    api.get(`/expenses/${id}`),
    getHeads()
  ]);
  const e = expenseData.expense;
  openModal('Edit Expense', `
    <form id="edit-expense-form" class="space-y-4">
      <div><label class="block text-sm font-medium mb-1">Date *</label><input type="date" id="eef-date" required value="${e.date ? e.date.split('T')[0] : todayStr()}" class="w-full px-3 py-2 border rounded-lg"></div>
      <div><label class="block text-sm font-medium mb-1">Category *</label>
        <select id="eef-head" required class="w-full px-3 py-2 border rounded-lg" onchange="updateEditSubheads()">
          <option value="">Select category</option>${headsData.expense_heads.filter(h => !h.parent_id).map(h => `<option value="${h.id}" ${h.id == e.head_id ? 'selected' : ''}>${h.name}</option>`).join('')}
        </select>
      </div>
      <div id="eef-subhead-wrap" class="${e.subhead_id ? '' : 'hidden'}"><label class="block text-sm font-medium mb-1">Subcategory</label>
        <select id="eef-subhead" class="w-full px-3 py-2 border rounded-lg"><option value="">None</option></select>
      </div>
      <div><label class="block text-sm font-medium mb-1">Amount (৳) *</label><input type="number" id="eef-amount" required step="0.01" min="0" value="${e.amount}" class="w-full px-3 py-2 border rounded-lg"></div>
      <div><label class="block text-sm font-medium mb-1">Explanation</label><textarea id="eef-explanation" rows="3" class="w-full px-3 py-2 border rounded-lg">${e.explanation || ''}</textarea></div>
      <div><label class="block text-sm font-medium mb-1">Status</label>
        <select id="eef-status" class="w-full px-3 py-2 border rounded-lg">
          <option value="pending" ${e.status === 'pending' ? 'selected' : ''}>Pending</option>
          <option value="approved" ${e.status === 'approved' ? 'selected' : ''}>Approved</option>
          <option value="rejected" ${e.status === 'rejected' ? 'selected' : ''}>Rejected</option>
        </select>
      </div>
      <button type="submit" class="w-full bg-blue-600 text-white py-2 rounded-lg font-medium hover:bg-blue-700">Save Changes</button>
    </form>
  `);
  // Populate subheads if needed
  if (e.head_id) updateEditSubheads(e.subhead_id);
  document.getElementById('edit-expense-form').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    try {
      await api.patch(`/expenses/${id}`, {
        date: document.getElementById('eef-date').value,
        head_id: document.getElementById('eef-head').value,
        subhead_id: document.getElementById('eef-subhead').value || null,
        amount: document.getElementById('eef-amount').value,
        explanation: document.getElementById('eef-explanation').value,
        status: document.getElementById('eef-status').value,
      });
      closeModal(); toast('Expense updated'); renderPage(currentPage);
    } catch (err) { toast(err.message, 'error'); }
  });
}

function updateEditSubheads(selectedId) {
  const headId = document.getElementById('eef-head').value;
  const wrap = document.getElementById('eef-subhead-wrap');
  const sel = document.getElementById('eef-subhead');
  if (!headId) { wrap.classList.add('hidden'); return; }
  const heads = _headsCache.expense_heads.filter(h => h.parent_id == headId);
  if (heads.length === 0) { wrap.classList.add('hidden'); return; }
  wrap.classList.remove('hidden');
  sel.innerHTML = '<option value="">None</option>' + heads.map(h => `<option value="${h.id}" ${selectedId && h.id == selectedId ? 'selected' : ''}>${h.name}</option>`).join('');
}

async function filterExpenses() {
  const status = document.getElementById('filter-status').value;
  const from = document.getElementById('filter-from').value;
  const to = document.getElementById('filter-to').value;
  let qs = '?limit=100';
  if (status) qs += `&status=${status}`;
  if (from) qs += `&from=${from}`;
  if (to) qs += `&to=${to}`;
  const data = await api.get(`/expenses${qs}`);
  const isEmployee = api.user.role === 'employee' || currentPage === 'my-expenses';
  const showCheckboxes = !isEmployee;
  document.getElementById('expenses-table').innerHTML = data.expenses.map(e => expenseRow(e, isEmployee)).join('') || `<tr><td colspan="${isEmployee ? 6 : 8}" class="px-4 py-8 text-center text-gray-400">No expenses found</td></tr>`;
  const total = data.expenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);
  document.getElementById('expenses-total').innerHTML = `<tr class="bg-gray-50 font-semibold text-sm">
    <td colspan="${isEmployee ? 4 : 5}" class="px-4 py-3 text-right">Total</td>
    <td class="px-4 py-3">${fmt(total)}</td>
    <td colspan="2"></td>
  </tr>`;
  // Reset selection
  const selectAll = document.getElementById('select-all-expenses');
  if (selectAll) selectAll.checked = false;
  updateSelectedCount();
}

// ==================== COLLECTIONS ====================
let _presetBillAmount = 500;

async function renderCollections() {
  const [collectionsData, settingsData] = await Promise.all([
    api.get('/collections?limit=100'),
    api.get('/collections/settings/bill-amount').catch(() => ({ bill_amount: 500 }))
  ]);
  _presetBillAmount = settingsData.bill_amount || 500;
  const isEmployee = api.user.role === 'employee';
  const isAdmin = api.user.role === 'admin' || api.user.role === 'accounts_head';

  let html = `<div class="fade-in">
    <div class="flex items-center justify-between mb-6">
      <h2 class="text-2xl font-bold text-gray-800">Bill Collections</h2>
      <div class="flex gap-2">
        ${isAdmin ? `<button onclick="showBillAmountSetting()" class="bg-gray-500 text-white px-4 py-2 rounded-lg text-sm hover:bg-gray-600"><i class="fas fa-cog mr-1"></i>Set Bill Amount</button>` : ''}
        <button onclick="showCollectionForm()" class="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700"><i class="fas fa-plus mr-1"></i>New Collection</button>
      </div>
    </div>
    <div class="bg-white rounded-xl shadow-sm overflow-hidden">
      <div class="p-4 border-b flex flex-wrap gap-3">
        <select id="col-filter-status" onchange="filterCollections()" class="px-3 py-2 border rounded-lg text-sm">
          <option value="">All Status</option><option value="pending">Pending</option><option value="approved">Approved</option><option value="rejected">Rejected</option>
        </select>
        <input type="date" id="col-filter-from" onchange="filterCollections()" class="px-3 py-2 border rounded-lg text-sm">
        <input type="date" id="col-filter-to" onchange="filterCollections()" class="px-3 py-2 border rounded-lg text-sm">
      </div>
      <div class="overflow-x-auto">
        <table class="w-full">
          <thead><tr class="text-left text-xs text-gray-500 bg-gray-50">
            <th class="px-4 py-3">Date</th>
            ${!isEmployee ? '<th class="px-4 py-3">Employee</th>' : ''}
            <th class="px-4 py-3">Bill Amount</th>
            <th class="px-4 py-3">Cards</th>
            <th class="px-4 py-3">Total</th>
            <th class="px-4 py-3">Status</th>
            <th class="px-4 py-3">Actions</th>
          </tr></thead>
          <tbody id="collections-table">${collectionsData.collections.map(c => collectionRow(c, isEmployee)).join('')}</tbody>
          <tfoot id="collections-total"><tr class="bg-gray-50 font-semibold text-sm">
            <td colspan="${isEmployee ? 2 : 3}" class="px-4 py-3 text-right">Total</td>
            <td class="px-4 py-3">${collectionsData.collections.reduce((sum, c) => sum + Number(c.total || 0), 0).toLocaleString('en-BD', { minimumFractionDigits: 2 })}</td>
            <td colspan="3"></td>
          </tr></tfoot>
        </table>
      </div>
    </div>
  </div>`;
  content.innerHTML = html;
}

function collectionRow(c, isEmployee) {
  const isAdmin = api.user.role === 'admin';
  const canApproveReject = c.status === 'pending' && !isEmployee;
  return `<tr class="table-row border-b">
    <td class="px-4 py-3 text-sm">${fmtDate(c.date)}</td>
    ${!isEmployee ? `<td class="px-4 py-3 text-sm">${c.created_by_name}</td>` : ''}
    <td class="px-4 py-3 text-sm">${fmt(c.bill_amount)}</td>
    <td class="px-4 py-3 text-sm">${c.number_of_cards}</td>
    <td class="px-4 py-3 text-sm font-medium">${fmt(c.total)}</td>
    <td class="px-4 py-3">${statusBadge(c.status)}</td>
    <td class="px-4 py-3 text-sm flex items-center gap-2">
      <button onclick="viewCollection(${c.id})" class="text-blue-600 hover:text-blue-800" title="View"><i class="fas fa-eye"></i></button>
      ${attBadge('collection', c.id, isAdmin)}
      ${canApproveReject ? `
        <button onclick="approveCollection(${c.id})" class="text-green-600 hover:text-green-800" title="Approve"><i class="fas fa-check"></i></button>
        <button onclick="rejectCollection(${c.id})" class="text-red-600 hover:text-red-800" title="Reject"><i class="fas fa-times"></i></button>
      ` : ''}
      ${isAdmin ? `<button onclick="deleteCollection(${c.id})" class="text-red-400 hover:text-red-600" title="Delete"><i class="fas fa-trash"></i></button>` : ''}
    </td>
  </tr>`;
}

async function showCollectionForm() {
  openModal('New Collection', `
    <form id="collection-form" class="space-y-4">
      <div><label class="block text-sm font-medium mb-1">Date *</label><input type="date" id="colf-date" required value="${todayStr()}" class="w-full px-3 py-2 border rounded-lg"></div>
      <div><label class="block text-sm font-medium mb-1">Bill Amount (৳) *</label><input type="number" id="colf-bill" required step="0.01" min="0" value="${_presetBillAmount}" class="w-full px-3 py-2 border rounded-lg"></div>
      <div><label class="block text-sm font-medium mb-1">Number of Cards *</label><input type="number" id="colf-cards" required min="1" value="1" class="w-full px-3 py-2 border rounded-lg" oninput="updateCollectionTotal()"></div>
      <div><label class="block text-sm font-medium mb-1">Total</label><p id="colf-total" class="text-lg font-bold text-blue-600">${fmt(_presetBillAmount)}</p></div>
      <div><label class="block text-sm font-medium mb-1">Explanation</label><textarea id="colf-explanation" rows="2" class="w-full px-3 py-2 border rounded-lg"></textarea></div>
      <div><label class="block text-sm font-medium mb-1">Attachments</label><input type="file" id="colf-files" multiple accept="image/*,.pdf" class="w-full px-3 py-2 border rounded-lg text-sm"></div>
      <button type="submit" class="w-full bg-blue-600 text-white py-2 rounded-lg font-medium hover:bg-blue-700">Submit Collection</button>
    </form>
  `);
  document.getElementById('collection-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData();
    fd.append('date', document.getElementById('colf-date').value);
    fd.append('bill_amount', document.getElementById('colf-bill').value);
    fd.append('number_of_cards', document.getElementById('colf-cards').value);
    fd.append('explanation', document.getElementById('colf-explanation').value);
    const files = document.getElementById('colf-files').files;
    for (let f of files) fd.append('files', f);
    try {
      await api.post('/collections', fd, true);
      closeModal(); toast('Collection submitted'); renderPage('collections');
    } catch (err) { toast(err.message, 'error'); }
  });
}

function updateCollectionTotal() {
  const bill = parseFloat(document.getElementById('colf-bill').value) || 0;
  const cards = parseInt(document.getElementById('colf-cards').value) || 0;
  document.getElementById('colf-total').textContent = fmt(bill * cards);
}

async function showBillAmountSetting() {
  openModal('Set Default Bill Amount', `
    <form id="bill-setting-form" class="space-y-4">
      <div><label class="block text-sm font-medium mb-1">Default Bill Amount (৳)</label><input type="number" id="bill-setting-amount" step="0.01" min="0" value="${_presetBillAmount}" class="w-full px-3 py-2 border rounded-lg"></div>
      <p class="text-xs text-gray-500">This amount will be pre-filled when employees create a new collection.</p>
      <button type="submit" class="w-full bg-blue-600 text-white py-2 rounded-lg font-medium hover:bg-blue-700">Save</button>
    </form>
  `);
  document.getElementById('bill-setting-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await api.patch('/collections/settings/bill-amount', { bill_amount: document.getElementById('bill-setting-amount').value });
      closeModal(); toast('Bill amount updated');
    } catch (err) { toast(err.message, 'error'); }
  });
}

async function approveCollection(id) {
  try { await api.patch(`/collections/${id}/approve`); toast('Collection approved'); renderPage('collections'); } catch (e) { toast(e.message, 'error'); }
}
async function rejectCollection(id) {
  if (!confirm('Reject this collection?')) return;
  try { await api.patch(`/collections/${id}/reject`); toast('Collection rejected'); renderPage('collections'); } catch (e) { toast(e.message, 'error'); }
}
async function deleteCollection(id) {
  if (!confirm('Delete this collection? This cannot be undone.')) return;
  try { await api.request('DELETE', `/collections/${id}`); toast('Collection deleted'); renderPage('collections'); } catch (e) { toast(e.message, 'error'); }
}

async function viewCollection(id) {
  const data = await api.get(`/collections/${id}`);
  const c = data.collection;
  openModal(`Collection Details <button onclick="showVersionHistory('collection',${id})" class="ml-2 text-gray-400 hover:text-blue-500 cursor-pointer" title="Version History"><i class="fas fa-clock"></i></button>`, `
    <div class="space-y-4">
      <div class="grid grid-cols-2 gap-4 text-sm">
        <div><span class="text-gray-500">Date</span><p class="font-medium">${fmtDate(c.date)}</p></div>
        <div><span class="text-gray-500">Status</span><p>${statusBadge(c.status)}</p></div>
        <div><span class="text-gray-500">Bill Amount</span><p class="font-medium">${fmt(c.bill_amount)}</p></div>
        <div><span class="text-gray-500">Number of Cards</span><p class="font-medium">${c.number_of_cards}</p></div>
        <div><span class="text-gray-500">Total</span><p class="font-bold text-lg">${fmt(c.total)}</p></div>
        <div><span class="text-gray-500">Created by</span><p class="font-medium">${c.created_by_name || '-'}</p></div>
      </div>
      ${c.explanation ? `<div><span class="text-gray-500 text-sm">Explanation</span><p class="mt-1 text-sm bg-gray-50 p-3 rounded-lg">${c.explanation}</p></div>` : ''}
    </div>
  `);
}

async function filterCollections() {
  const status = document.getElementById('col-filter-status').value;
  const from = document.getElementById('col-filter-from').value;
  const to = document.getElementById('col-filter-to').value;
  let qs = '?limit=100';
  if (status) qs += `&status=${status}`;
  if (from) qs += `&from=${from}`;
  if (to) qs += `&to=${to}`;
  const data = await api.get(`/collections${qs}`);
  const isEmployee = api.user.role === 'employee';
  document.getElementById('collections-table').innerHTML = data.collections.map(c => collectionRow(c, isEmployee)).join('') || '<tr><td colspan="6" class="px-4 py-8 text-center text-gray-400">No collections found</td></tr>';
  const total = data.collections.reduce((sum, c) => sum + Number(c.total || 0), 0);
  document.getElementById('collections-total').innerHTML = `<tr class="bg-gray-50 font-semibold text-sm">
    <td colspan="${isEmployee ? 2 : 3}" class="px-4 py-3 text-right">Total</td>
    <td class="px-4 py-3">${fmt(total)}</td>
    <td colspan="3"></td>
  </tr>`;
}

// ==================== SETTLEMENTS ====================
async function renderSettlements() {
  const data = await api.get('/settlements?limit=100');
  const isEmployee = api.user.role === 'employee';

  // Load attachment counts for settlements
  const setIds = data.settlements.map(s => s.id);
  if (setIds.length) {
    try {
      const countData = await api.get(`/attachments/count?entity_type=settlement&entity_ids=${setIds.join(',')}`);
      _attachmentCounts.settlement = countData.counts || {};
    } catch (e) { /* silent */ }
  }

  let html = `<div class="fade-in">
    <div class="flex items-center justify-between mb-6">
      <h2 class="text-2xl font-bold text-gray-800">Daily Settlements</h2>
      <button onclick="showSettlementForm()" class="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700"><i class="fas fa-plus mr-1"></i>New Settlement</button>
    </div>
    <div class="bg-white rounded-xl shadow-sm overflow-hidden">
      <table class="w-full">
        <thead><tr class="text-left text-xs text-gray-500 bg-gray-50">
          <th class="px-4 py-3">Date</th>${!isEmployee ? '<th class="px-4 py-3">Employee</th>' : ''}
          <th class="px-4 py-3">Expenses</th><th class="px-4 py-3">Unspent</th><th class="px-4 py-3">Deposit</th><th class="px-4 py-3">Status</th><th class="px-4 py-3">Actions</th>
        </tr></thead>
        <tbody>${data.settlements.map(s => `<tr class="table-row border-b">
          <td class="px-4 py-3 text-sm">${fmtDate(s.date)}</td>
          ${!isEmployee ? `<td class="px-4 py-3 text-sm">${s.employee_name}</td>` : ''}
          <td class="px-4 py-3 text-sm">${fmt(s.total_expenses)}</td>
          <td class="px-4 py-3 text-sm">${fmt(s.total_unspent)}</td>
          <td class="px-4 py-3 text-sm font-medium">${fmt(s.bank_deposit_amount)}</td>
          <td class="px-4 py-3">${statusBadge(s.status)}</td>
          <td class="px-4 py-3 text-sm flex items-center gap-2">
            <button onclick="viewSettlement(${s.id})" class="text-blue-600 hover:text-blue-800" title="View"><i class="fas fa-eye"></i></button>
            ${attBadge('settlement', s.id, api.user.role === 'admin')}
            ${s.status === 'pending' && !isEmployee ? `
              <button onclick="approveSettlement(${s.id})" class="text-green-600 hover:text-green-800"><i class="fas fa-check"></i></button>
              <button onclick="rejectSettlement(${s.id})" class="text-red-600 hover:text-red-800"><i class="fas fa-times"></i></button>
            ` : ''}
            ${api.user.role === 'admin' ? `<button onclick="deleteSettlement(${s.id})" class="text-red-400 hover:text-red-600" title="Delete"><i class="fas fa-trash"></i></button>` : ''}
          </td>
        </tr>`).join('')}</tbody>
      </table>
    </div>
  </div>`;
  content.innerHTML = html;
}

async function showSettlementForm() {
  openModal('New Daily Settlement', `
    <form id="settlement-form" class="space-y-4">
      <div><label class="block text-sm font-medium mb-1">Date *</label><input type="date" id="sf-date" required value="${todayStr()}" class="w-full px-3 py-2 border rounded-lg"></div>
      <div><label class="block text-sm font-medium mb-1">Total Expenses (৳) *</label><input type="number" id="sf-expenses" required step="0.01" class="w-full px-3 py-2 border rounded-lg"></div>
      <div><label class="block text-sm font-medium mb-1">Total Unspent (৳) *</label><input type="number" id="sf-unspent" required step="0.01" class="w-full px-3 py-2 border rounded-lg"></div>
      <div><label class="block text-sm font-medium mb-1">Bank Deposit (৳) *</label><input type="number" id="sf-deposit" required step="0.01" class="w-full px-3 py-2 border rounded-lg"></div>
      <div><label class="block text-sm font-medium mb-1">Bank Screenshot</label><input type="file" id="sf-screenshot" accept="image/*" class="w-full px-3 py-2 border rounded-lg text-sm"></div>
      <button type="submit" class="w-full bg-blue-600 text-white py-2 rounded-lg font-medium hover:bg-blue-700">Submit Settlement</button>
    </form>
  `);
  document.getElementById('settlement-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData();
    fd.append('date', document.getElementById('sf-date').value);
    fd.append('total_expenses', document.getElementById('sf-expenses').value);
    fd.append('total_unspent', document.getElementById('sf-unspent').value);
    fd.append('bank_deposit_amount', document.getElementById('sf-deposit').value);
    const file = document.getElementById('sf-screenshot').files[0];
    if (file) fd.append('bank_screenshot', file);
    try { await api.post('/settlements', fd, true); closeModal(); toast('Settlement submitted'); renderPage('settlements'); } catch (err) { toast(err.message, 'error'); }
  });
}

async function approveSettlement(id) {
  try { await api.patch(`/settlements/${id}/approve`); toast('Approved'); renderPage('settlements'); } catch (e) { toast(e.message, 'error'); }
}
async function rejectSettlement(id) {
  if (!confirm('Reject this settlement?')) return;
  try { await api.patch(`/settlements/${id}/reject`); toast('Rejected'); renderPage('settlements'); } catch (e) { toast(e.message, 'error'); }
}
async function deleteSettlement(id) {
  if (!confirm('Delete this settlement? This cannot be undone.')) return;
  try { await api.request('DELETE', `/settlements/${id}`); toast('Settlement deleted'); renderPage('settlements'); } catch (e) { toast(e.message, 'error'); }
}
async function viewSettlement(id) {
  const data = await api.get(`/settlements/${id}`);
  const s = data.settlement;
  openModal('Settlement Details', `
    <div class="space-y-4">
      <div class="grid grid-cols-2 gap-4 text-sm">
        <div><span class="text-gray-500">Date</span><p class="font-medium">${fmtDate(s.date)}</p></div>
        <div><span class="text-gray-500">Status</span><p>${statusBadge(s.status)}</p></div>
        <div><span class="text-gray-500">Employee</span><p class="font-medium">${s.employee_name || '-'}</p></div>
        <div><span class="text-gray-500">Total Expenses</span><p class="font-medium">${fmt(s.total_expenses)}</p></div>
        <div><span class="text-gray-500">Unspent</span><p class="font-medium">${fmt(s.total_unspent)}</p></div>
        <div><span class="text-gray-500">Bank Deposit</span><p class="font-bold text-lg">${fmt(s.bank_deposit_amount)}</p></div>
      </div>
      ${s.bank_screenshot ? `<div><span class="text-gray-500 text-sm">Bank Screenshot</span><div class="mt-2"><a href="${s.bank_screenshot}" target="_blank" class="text-blue-600 hover:underline text-sm"><i class="fas fa-image mr-1"></i>View Screenshot</a></div></div>` : ''}
    </div>
  `);
}

// ==================== PETTY CASH ====================
async function renderPettyCash() {
  const [fundsData, activeData] = await Promise.all([api.get('/petty-cash'), api.get('/petty-cash/active').catch(() => null)]);
  const isAdmin = api.user.role === 'admin';
  const fund = activeData?.petty_cash;

  let html = `<div class="fade-in">
    <div class="flex items-center justify-between mb-6">
      <h2 class="text-2xl font-bold text-gray-800">Petty Cash</h2>
      ${isAdmin ? `<button onclick="showPettyCashForm()" class="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700"><i class="fas fa-plus mr-1"></i>New Fund</button>` : ''}
    </div>`;

  if (fund) {
    html += `<div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      ${statCard('Opening Balance', fmt(fund.opening_balance), 'fa-wallet', 'blue')}
      ${statCard('Current Balance', fmt(fund.current_balance), 'fa-coins', 'green')}
      ${statCard('Status', fund.status, 'fa-circle', 'purple')}
    </div>
    <div class="flex gap-3 mb-6">
      <button onclick="showDispenseForm(${fund.id})" class="bg-orange-500 text-white px-4 py-2 rounded-lg text-sm hover:bg-orange-600"><i class="fas fa-minus mr-1"></i>Dispense</button>
      ${isAdmin ? `<button onclick="showReplenishForm(${fund.id})" class="bg-green-500 text-white px-4 py-2 rounded-lg text-sm hover:bg-green-600"><i class="fas fa-plus mr-1"></i>Replenish</button>
      <button onclick="closeFund(${fund.id})" class="bg-gray-500 text-white px-4 py-2 rounded-lg text-sm hover:bg-gray-600"><i class="fas fa-lock mr-1"></i>Close Fund</button>` : ''}
    </div>`;
  } else {
    html += `<div class="bg-white rounded-xl shadow-sm p-8 text-center text-gray-400"><i class="fas fa-wallet text-4xl mb-3"></i><p>No active petty cash fund</p></div>`;
  }

  html += `<div class="bg-white rounded-xl shadow-sm overflow-hidden">
    <div class="px-6 py-4 border-b font-semibold">Fund History</div>
    <table class="w-full"><thead><tr class="text-left text-xs text-gray-500 bg-gray-50">
      <th class="px-6 py-3">Date</th><th class="px-6 py-3">Opening</th><th class="px-6 py-3">Current</th><th class="px-6 py-3">Status</th><th class="px-6 py-3">Actions</th>
    </tr></thead><tbody>${fundsData.petty_cash.map(f => `<tr class="table-row border-b">
      <td class="px-6 py-3 text-sm">${fmtDate(f.date)}</td>
      <td class="px-6 py-3 text-sm">${fmt(f.opening_balance)}</td>
      <td class="px-6 py-3 text-sm font-medium">${fmt(f.current_balance)}</td>
      <td class="px-6 py-3">${statusBadge(f.status)}</td>
      <td class="px-6 py-3"><button onclick="viewPettyCashFund(${f.id})" class="text-blue-600 hover:text-blue-800 text-sm"><i class="fas fa-eye"></i> View</button></td>
    </tr>`).join('')}</tbody></table></div></div>`;
  content.innerHTML = html;
}

async function showPettyCashForm() {
  openModal('Open New Petty Cash Fund', `
    <form id="pc-form" class="space-y-4">
      <div><label class="block text-sm font-medium mb-1">Date *</label><input type="date" id="pcf-date" required value="${todayStr()}" class="w-full px-3 py-2 border rounded-lg"></div>
      <div><label class="block text-sm font-medium mb-1">Opening Balance (৳) *</label><input type="number" id="pcf-amount" required step="0.01" class="w-full px-3 py-2 border rounded-lg"></div>
      <button type="submit" class="w-full bg-blue-600 text-white py-2 rounded-lg font-medium hover:bg-blue-700">Open Fund</button>
    </form>
  `);
  document.getElementById('pc-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    try { await api.post('/petty-cash', { date: document.getElementById('pcf-date').value, opening_balance: document.getElementById('pcf-amount').value }); closeModal(); toast('Fund opened'); renderPage('petty-cash'); } catch (err) { toast(err.message, 'error'); }
  });
}

async function showDispenseForm(fundId) {
  const heads = await getHeads();
  openModal('Dispense Petty Cash', `
    <form id="dispense-form" class="space-y-4">
      <div><label class="block text-sm font-medium mb-1">Date *</label><input type="date" id="pd-date" required value="${todayStr()}" class="w-full px-3 py-2 border rounded-lg"></div>
      <div><label class="block text-sm font-medium mb-1">Amount (৳) *</label><input type="number" id="pd-amount" required step="0.01" class="w-full px-3 py-2 border rounded-lg"></div>
      <div><label class="block text-sm font-medium mb-1">Category</label>
        <select id="pd-head" class="w-full px-3 py-2 border rounded-lg"><option value="">Select</option>${heads.expense_heads.filter(h => !h.parent_id).map(h => `<option value="${h.id}">${h.name}</option>`).join('')}</select>
      </div>
      <div><label class="block text-sm font-medium mb-1">Explanation *</label><textarea id="pd-explain" required rows="2" class="w-full px-3 py-2 border rounded-lg"></textarea></div>
      <div><label class="block text-sm font-medium mb-1">Receipt</label><input type="file" id="pd-receipt" accept="image/*,.pdf" class="w-full px-3 py-2 border rounded-lg text-sm"></div>
      <button type="submit" class="w-full bg-orange-500 text-white py-2 rounded-lg font-medium hover:bg-orange-600">Submit</button>
    </form>
  `);
  document.getElementById('dispense-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData();
    fd.append('date', document.getElementById('pd-date').value);
    fd.append('amount', document.getElementById('pd-amount').value);
    fd.append('head_id', document.getElementById('pd-head').value);
    fd.append('explanation', document.getElementById('pd-explain').value);
    const file = document.getElementById('pd-receipt').files[0];
    if (file) fd.append('receipt', file);
    try { await api.post(`/petty-cash/${fundId}/transactions`, fd, true); closeModal(); toast('Dispensed'); renderPage('petty-cash'); } catch (err) { toast(err.message, 'error'); }
  });
}

async function showReplenishForm(fundId) {
  openModal('Replenish Fund', `
    <form id="replenish-form" class="space-y-4">
      <div><label class="block text-sm font-medium mb-1">Date *</label><input type="date" id="pr-date" required value="${todayStr()}" class="w-full px-3 py-2 border rounded-lg"></div>
      <div><label class="block text-sm font-medium mb-1">Amount (৳) *</label><input type="number" id="pr-amount" required step="0.01" class="w-full px-3 py-2 border rounded-lg"></div>
      <div><label class="block text-sm font-medium mb-1">Note</label><input type="text" id="pr-note" class="w-full px-3 py-2 border rounded-lg"></div>
      <button type="submit" class="w-full bg-green-500 text-white py-2 rounded-lg font-medium hover:bg-green-600">Replenish</button>
    </form>
  `);
  document.getElementById('replenish-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    try { await api.post(`/petty-cash/${fundId}/replenish`, { date: document.getElementById('pr-date').value, amount: document.getElementById('pr-amount').value, explanation: document.getElementById('pr-note').value }); closeModal(); toast('Replenished'); renderPage('petty-cash'); } catch (err) { toast(err.message, 'error'); }
  });
}

async function closeFund(id) {
  if (!confirm('Close this petty cash fund?')) return;
  try { await api.patch(`/petty-cash/${id}/close`); toast('Fund closed'); renderPage('petty-cash'); } catch (e) { toast(e.message, 'error'); }
}

async function viewPettyCashFund(id) {
  const data = await api.get(`/petty-cash/${id}`);
  const f = data.petty_cash;
  openModal('Petty Cash Fund Details', `
    <div class="space-y-4">
      <div class="grid grid-cols-2 gap-4 text-sm">
        <div><span class="text-gray-500">Date</span><p class="font-medium">${fmtDate(f.date)}</p></div>
        <div><span class="text-gray-500">Status</span><p>${statusBadge(f.status)}</p></div>
        <div><span class="text-gray-500">Opening</span><p class="font-medium">${fmt(f.opening_balance)}</p></div>
        <div><span class="text-gray-500">Current</span><p class="font-bold">${fmt(f.current_balance)}</p></div>
      </div>
      <div><span class="text-gray-500 text-sm">Transactions</span>
        ${f.transactions.length ? `<div class="mt-2 space-y-2">${f.transactions.map(t => `
          <div class="flex items-center justify-between bg-gray-50 p-3 rounded-lg text-sm">
            <div><span class="font-medium">${t.type === 'dispense' ? '-' : '+'} ${fmt(t.amount)}</span><p class="text-xs text-gray-500">${t.explanation || '-'} · ${fmtDate(t.date)}</p></div>
            <div>${statusBadge(t.status)}</div>
          </div>`).join('')}</div>` : '<p class="text-gray-400 text-sm mt-2">No transactions</p>'}
      </div>
    </div>
  `);
}

// ==================== BUDGETS ====================
async function renderBudgets() {
  if (api.user.role === 'employee') { content.innerHTML = '<p class="text-gray-500">Access denied</p>'; return; }
  const now = new Date();
  const ym = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  const [budgetData, headsData] = await Promise.all([api.get(`/budgets?year_month=${ym}`), api.get('/expense-heads/flat')]);

  let html = `<div class="fade-in">
    <div class="flex items-center justify-between mb-6">
      <h2 class="text-2xl font-bold text-gray-800">Budgets - ${ym}</h2>
      ${api.user.role === 'admin' ? `<button onclick="showBudgetForm('${ym}')" class="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700"><i class="fas fa-plus mr-1"></i>Set Budgets</button>` : ''}
    </div>
    <div class="bg-white rounded-xl shadow-sm overflow-hidden">
      <table class="w-full"><thead><tr class="text-left text-xs text-gray-500 bg-gray-50">
        <th class="px-4 py-3">Category</th><th class="px-4 py-3">Budget</th><th class="px-4 py-3">Spent</th><th class="px-4 py-3">Remaining</th><th class="px-4 py-3">Utilization</th>
      </tr></thead><tbody>${budgetData.budgets.map(b => `<tr class="table-row border-b">
        <td class="px-4 py-3 text-sm font-medium">${b.head_name}</td>
        <td class="px-4 py-3 text-sm">${fmt(b.amount)}</td>
        <td class="px-4 py-3 text-sm">${fmt(b.spent)}</td>
        <td class="px-4 py-3 text-sm ${b.remaining < 0 ? 'text-red-600 font-medium' : ''}">${fmt(b.remaining)}</td>
        <td class="px-4 py-3"><div class="flex items-center gap-2"><div class="flex-1 h-2 bg-gray-100 rounded-full"><div class="h-2 rounded-full ${b.utilization_pct > 100 ? 'bg-red-500' : b.utilization_pct > 80 ? 'bg-yellow-500' : 'bg-green-500'}" style="width:${Math.min(b.utilization_pct, 100)}%"></div></div><span class="text-xs text-gray-500 w-12">${b.utilization_pct}%</span></div></td>
      </tr>`).join('') || '<tr><td colspan="5" class="px-4 py-8 text-center text-gray-400">No budgets set for this month</td></tr>'}</tbody></table>
    </div>
  </div>`;
  content.innerHTML = html;
}

async function showBudgetForm(ym) {
  const heads = await getHeads();
  const majorHeads = heads.expense_heads.filter(h => !h.parent_id);
  openModal('Set Budgets', `
    <form id="budget-form" class="space-y-4">
      <div><label class="block text-sm font-medium mb-1">Month</label><input type="month" id="bf-month" value="${ym}" class="w-full px-3 py-2 border rounded-lg"></div>
      ${majorHeads.map(h => `<div class="flex items-center gap-3">
        <span class="text-sm w-40 truncate">${h.name}</span>
        <input type="number" step="0.01" data-head="${h.id}" class="budget-input flex-1 px-3 py-2 border rounded-lg text-sm" placeholder="0.00">
      </div>`).join('')}
      <button type="submit" class="w-full bg-blue-600 text-white py-2 rounded-lg font-medium hover:bg-blue-700">Save Budgets</button>
    </form>
  `);
  document.getElementById('budget-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const month = document.getElementById('bf-month').value;
    const budgets = [];
    document.querySelectorAll('.budget-input').forEach(inp => {
      const v = parseFloat(inp.value);
      if (v > 0) budgets.push({ head_id: parseInt(inp.dataset.head), amount: v });
    });
    if (budgets.length === 0) { toast('Enter at least one budget', 'error'); return; }
    try { await api.post('/budgets/bulk', { year_month: month, budgets }); closeModal(); toast('Budgets saved'); renderPage('budgets'); } catch (err) { toast(err.message, 'error'); }
  });
}

// ==================== EXPENSE HEADS ====================
async function renderExpenseHeads() {
  if (api.user.role !== 'admin') { content.innerHTML = '<p class="text-gray-500">Admin only</p>'; return; }
  const data = await api.get('/expense-heads?include_inactive=true');

  let html = `<div class="fade-in">
    <div class="flex items-center justify-between mb-6">
      <h2 class="text-2xl font-bold text-gray-800">Expense Categories</h2>
      <button onclick="showHeadForm()" class="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700"><i class="fas fa-plus mr-1"></i>New Category</button>
    </div>
    <div class="space-y-4">${data.expense_heads.map(h => `
      <div class="bg-white rounded-xl shadow-sm p-5">
        <div class="flex items-center justify-between mb-3">
          <div class="flex items-center gap-3">
            <h3 class="font-semibold text-gray-800">${h.name}</h3>
            ${!h.is_active ? '<span class="text-xs text-red-500">(inactive)</span>' : ''}
          </div>
          <div class="flex gap-2">
            <button onclick="showSubheadForm(${h.id}, '${h.name}')" class="text-blue-600 hover:text-blue-800 text-sm"><i class="fas fa-plus"></i> Sub</button>
            <button onclick="toggleHead(${h.id})" class="text-gray-500 hover:text-gray-700 text-sm"><i class="fas fa-toggle-${h.is_active ? 'on text-green-500' : 'off'}"></i></button>
          </div>
        </div>
        ${h.subheads.length ? `<div class="flex flex-wrap gap-2">${h.subheads.map(s => `
          <span class="px-3 py-1 bg-gray-100 rounded-full text-sm ${!s.is_active ? 'line-through text-gray-400' : ''}">${s.name}
            ${api.user.role === 'admin' ? `<button onclick="toggleHead(${s.id})" class="ml-1 text-gray-400 hover:text-gray-600"><i class="fas fa-times text-xs"></i></button>` : ''}
          </span>`).join('')}</div>` : '<p class="text-gray-400 text-sm">No subcategories</p>'}
      </div>`).join('')}</div>
  </div>`;
  content.innerHTML = html;
}

async function showHeadForm() {
  openModal('New Category', `
    <form id="head-form" class="space-y-4">
      <div><label class="block text-sm font-medium mb-1">Name *</label><input type="text" id="hf-name" required class="w-full px-3 py-2 border rounded-lg" placeholder="e.g. Transportation"></div>
      <button type="submit" class="w-full bg-blue-600 text-white py-2 rounded-lg font-medium hover:bg-blue-700">Create</button>
    </form>
  `);
  document.getElementById('head-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    try { await api.post('/expense-heads', { name: document.getElementById('hf-name').value }); closeModal(); toast('Created'); _headsCache = null; renderPage('expense-heads'); } catch (err) { toast(err.message, 'error'); }
  });
}

async function showSubheadForm(parentId, parentName) {
  openModal(`Add Subcategory to ${parentName}`, `
    <form id="sub-form" class="space-y-4">
      <div><label class="block text-sm font-medium mb-1">Name *</label><input type="text" id="sf-name" required class="w-full px-3 py-2 border rounded-lg"></div>
      <button type="submit" class="w-full bg-blue-600 text-white py-2 rounded-lg font-medium hover:bg-blue-700">Add</button>
    </form>
  `);
  document.getElementById('sub-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    try { await api.post(`/expense-heads/${parentId}/subheads`, { name: document.getElementById('sf-name').value }); closeModal(); toast('Subcategory added'); _headsCache = null; renderPage('expense-heads'); } catch (err) { toast(err.message, 'error'); }
  });
}

async function toggleHead(id) {
  try { await api.patch(`/expense-heads/${id}/toggle`); renderPage('expense-heads'); } catch (e) { toast(e.message, 'error'); }
}

// ==================== USERS ====================
async function renderUsers() {
  if (api.user.role !== 'admin') { content.innerHTML = '<p class="text-gray-500">Admin only</p>'; return; }
  const data = await api.get('/users');

  let html = `<div class="fade-in">
    <div class="flex items-center justify-between mb-6">
      <h2 class="text-2xl font-bold text-gray-800">Users</h2>
      <button onclick="showUserForm()" class="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700"><i class="fas fa-plus mr-1"></i>Add User</button>
    </div>
    <div class="bg-white rounded-xl shadow-sm overflow-hidden">
      <table class="w-full"><thead><tr class="text-left text-xs text-gray-500 bg-gray-50">
        <th class="px-4 py-3">Name</th><th class="px-4 py-3">Email</th><th class="px-4 py-3">Phone</th><th class="px-4 py-3">Role</th><th class="px-4 py-3">Status</th><th class="px-4 py-3">Actions</th>
      </tr></thead><tbody>${data.users.map(u => `<tr class="table-row border-b">
        <td class="px-4 py-3 text-sm font-medium">${u.name}</td>
        <td class="px-4 py-3 text-sm">${u.email}</td>
        <td class="px-4 py-3 text-sm">${u.phone || '-'}</td>
        <td class="px-4 py-3"><span class="px-2 py-1 rounded text-xs font-medium ${u.role === 'admin' ? 'bg-purple-100 text-purple-700' : u.role === 'accounts_head' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'}">${u.role.replace('_', ' ')}</span></td>
        <td class="px-4 py-3">${u.is_active ? '<span class="text-green-600 text-sm">Active</span>' : '<span class="text-red-500 text-sm">Inactive</span>'}</td>
        <td class="px-4 py-3 text-sm">
          <button onclick="showEditUser(${u.id})" class="text-blue-600 hover:text-blue-800 mr-2"><i class="fas fa-edit"></i></button>
          <button onclick="toggleUser(${u.id})" class="text-gray-500 hover:text-gray-700 mr-2"><i class="fas fa-toggle-${u.is_active ? 'on text-green-500' : 'off'}"></i></button>
          <button onclick="showResetPassword(${u.id})" class="text-orange-500 hover:text-orange-700"><i class="fas fa-key"></i></button>
        </td>
      </tr>`).join('')}</tbody></table>
    </div>
  </div>`;
  content.innerHTML = html;
}

async function showUserForm() {
  openModal('Add User', `
    <form id="user-form" class="space-y-4">
      <div><label class="block text-sm font-medium mb-1">Name *</label><input type="text" id="uf-name" required class="w-full px-3 py-2 border rounded-lg"></div>
      <div><label class="block text-sm font-medium mb-1">Email *</label><input type="email" id="uf-email" required class="w-full px-3 py-2 border rounded-lg"></div>
      <div><label class="block text-sm font-medium mb-1">Phone</label><input type="text" id="uf-phone" class="w-full px-3 py-2 border rounded-lg"></div>
      <div><label class="block text-sm font-medium mb-1">Password *</label><input type="password" id="uf-pass" required class="w-full px-3 py-2 border rounded-lg" minlength="6"></div>
      <div><label class="block text-sm font-medium mb-1">Role</label>
        <select id="uf-role" class="w-full px-3 py-2 border rounded-lg"><option value="employee">Employee</option><option value="accounts_head">Accounts Head</option><option value="admin">Admin</option></select>
      </div>
      <button type="submit" class="w-full bg-blue-600 text-white py-2 rounded-lg font-medium hover:bg-blue-700">Create User</button>
    </form>
  `);
  document.getElementById('user-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    try { await api.post('/users', { name: document.getElementById('uf-name').value, email: document.getElementById('uf-email').value, phone: document.getElementById('uf-phone').value, password: document.getElementById('uf-pass').value, role: document.getElementById('uf-role').value }); closeModal(); toast('User created'); renderPage('users'); } catch (err) { toast(err.message, 'error'); }
  });
}

async function showEditUser(id) {
  const data = await api.get(`/users/${id}`);
  const u = data.user;
  openModal('Edit User', `
    <form id="edit-user-form" class="space-y-4">
      <div><label class="block text-sm font-medium mb-1">Name</label><input type="text" id="eu-name" value="${u.name}" class="w-full px-3 py-2 border rounded-lg"></div>
      <div><label class="block text-sm font-medium mb-1">Email</label><input type="email" id="eu-email" value="${u.email}" class="w-full px-3 py-2 border rounded-lg"></div>
      <div><label class="block text-sm font-medium mb-1">Phone</label><input type="text" id="eu-phone" value="${u.phone || ''}" class="w-full px-3 py-2 border rounded-lg"></div>
      <div><label class="block text-sm font-medium mb-1">Role</label>
        <select id="eu-role" class="w-full px-3 py-2 border rounded-lg"><option value="employee" ${u.role==='employee'?'selected':''}>Employee</option><option value="accounts_head" ${u.role==='accounts_head'?'selected':''}>Accounts Head</option><option value="admin" ${u.role==='admin'?'selected':''}>Admin</option></select>
      </div>
      <button type="submit" class="w-full bg-blue-600 text-white py-2 rounded-lg font-medium hover:bg-blue-700">Save Changes</button>
    </form>
  `);
  document.getElementById('edit-user-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    try { await api.patch(`/users/${id}`, { name: document.getElementById('eu-name').value, email: document.getElementById('eu-email').value, phone: document.getElementById('eu-phone').value, role: document.getElementById('eu-role').value }); closeModal(); toast('User updated'); renderPage('users'); } catch (err) { toast(err.message, 'error'); }
  });
}

async function toggleUser(id) {
  try { await api.patch(`/users/${id}/toggle`); renderPage('users'); } catch (e) { toast(e.message, 'error'); }
}

async function showResetPassword(id) {
  openModal('Reset Password', `
    <form id="rp-form" class="space-y-4">
      <div><label class="block text-sm font-medium mb-1">New Password</label><input type="password" id="rp-pass" required minlength="6" class="w-full px-3 py-2 border rounded-lg"></div>
      <button type="submit" class="w-full bg-orange-500 text-white py-2 rounded-lg font-medium hover:bg-orange-600">Reset Password</button>
    </form>
  `);
  document.getElementById('rp-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    try { await api.patch(`/users/${id}/reset-password`, { new_password: document.getElementById('rp-pass').value }); closeModal(); toast('Password reset'); } catch (err) { toast(err.message, 'error'); }
  });
}

// ==================== REPORTS ====================
async function renderReports() {
  const year = new Date().getFullYear();
  let html = `<div class="fade-in">
    <h2 class="text-2xl font-bold text-gray-800 mb-6">Reports & Export</h2>
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div class="bg-white rounded-xl shadow-sm p-6">
        <h3 class="font-semibold text-gray-800 mb-3"><i class="fas fa-receipt mr-2 text-blue-500"></i>Expenses</h3>
        <p class="text-sm text-gray-500 mb-4">Export all expenses with filters (date range, category, status)</p>
        <div class="flex gap-2 mb-3">
          <input type="date" id="r-from" class="px-3 py-2 border rounded-lg text-sm flex-1">
          <input type="date" id="r-to" class="px-3 py-2 border rounded-lg text-sm flex-1">
        </div>
        <button onclick="api.download('/export/expenses?from='+document.getElementById('r-from').value+'&to='+document.getElementById('r-to').value, 'expenses.csv')" class="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 w-full"><i class="fas fa-download mr-1"></i>Download CSV</button>
      </div>
      <div class="bg-white rounded-xl shadow-sm p-6">
        <h3 class="font-semibold text-gray-800 mb-3"><i class="fas fa-calendar-check mr-2 text-green-500"></i>Settlements</h3>
        <p class="text-sm text-gray-500 mb-4">Export daily settlement records</p>
        <button onclick="api.download('/export/settlements', 'settlements.csv')" class="bg-green-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-green-700 w-full"><i class="fas fa-download mr-1"></i>Download CSV</button>
      </div>
      <div class="bg-white rounded-xl shadow-sm p-6">
        <h3 class="font-semibold text-gray-800 mb-3"><i class="fas fa-wallet mr-2 text-orange-500"></i>Petty Cash</h3>
        <p class="text-sm text-gray-500 mb-4">Export petty cash transactions</p>
        <button onclick="api.download('/export/petty-cash', 'petty-cash.csv')" class="bg-orange-500 text-white px-4 py-2 rounded-lg text-sm hover:bg-orange-600 w-full"><i class="fas fa-download mr-1"></i>Download CSV</button>
      </div>
      <div class="bg-white rounded-xl shadow-sm p-6">
        <h3 class="font-semibold text-gray-800 mb-3"><i class="fas fa-chart-bar mr-2 text-purple-500"></i>Monthly Summary</h3>
        <p class="text-sm text-gray-500 mb-4">Full year breakdown by employee and category</p>
        <button onclick="api.download('/export/monthly-summary?year=${year}', 'monthly-summary-${year}.csv')" class="bg-purple-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-purple-700 w-full"><i class="fas fa-download mr-1"></i>Download CSV</button>
      </div>
    </div>
  </div>`;
  content.innerHTML = html;
}

// ==================== AUDIT LOG ====================
async function renderAuditLog() {
  if (api.user.role !== 'admin') { content.innerHTML = '<p class="text-gray-500">Admin only</p>'; return; }
  const data = await api.get('/audit-log?limit=50');

  let html = `<div class="fade-in">
    <h2 class="text-2xl font-bold text-gray-800 mb-6">Audit Log</h2>
    <div class="bg-white rounded-xl shadow-sm overflow-hidden">
      <table class="w-full"><thead><tr class="text-left text-xs text-gray-500 bg-gray-50">
        <th class="px-4 py-3">Time</th><th class="px-4 py-3">Action</th><th class="px-4 py-3">Entity</th><th class="px-4 py-3">Details</th><th class="px-4 py-3">By</th>
      </tr></thead><tbody>${data.logs.map(l => `<tr class="table-row border-b">
        <td class="px-4 py-3 text-sm text-gray-500">${fmtDate(l.created_at)}</td>
        <td class="px-4 py-3"><span class="px-2 py-1 rounded text-xs font-medium ${l.action === 'approve' ? 'bg-green-100 text-green-700' : l.action === 'reject' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}">${l.action}</span></td>
        <td class="px-4 py-3 text-sm">${l.entity} #${l.entity_id || '-'}</td>
        <td class="px-4 py-3 text-sm text-gray-500">${l.details ? JSON.stringify(l.details).substring(0, 50) : '-'}</td>
        <td class="px-4 py-3 text-sm">${l.performed_by_name || '-'}</td>
      </tr>`).join('') || '<tr><td colspan="5" class="px-4 py-8 text-center text-gray-400">No audit records</td></tr>'}</tbody></table>
    </div>
  </div>`;
  content.innerHTML = html;
}

// ==================== PROFILE ====================
async function renderProfile() {
  const u = api.user;
  let html = `<div class="fade-in max-w-lg">
    <h2 class="text-2xl font-bold text-gray-800 mb-6">My Profile</h2>
    <div class="bg-white rounded-xl shadow-sm p-6 mb-6">
      <form id="profile-form" class="space-y-4">
        <div><label class="block text-sm font-medium mb-1">Name</label><input type="text" id="pf-name" value="${u.name}" class="w-full px-3 py-2 border rounded-lg"></div>
        <div><label class="block text-sm font-medium mb-1">Email</label><input type="email" value="${u.email}" disabled class="w-full px-3 py-2 border rounded-lg bg-gray-50"></div>
        <div><label class="block text-sm font-medium mb-1">Phone</label><input type="text" id="pf-phone" value="${u.phone || ''}" class="w-full px-3 py-2 border rounded-lg"></div>
        <button type="submit" class="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700">Save Changes</button>
      </form>
    </div>
    <div class="bg-white rounded-xl shadow-sm p-6">
      <h3 class="font-semibold text-gray-800 mb-4">Change Password</h3>
      <form id="pw-form" class="space-y-4">
        <div><label class="block text-sm font-medium mb-1">Current Password</label><input type="password" id="pw-current" required class="w-full px-3 py-2 border rounded-lg"></div>
        <div><label class="block text-sm font-medium mb-1">New Password</label><input type="password" id="pw-new" required minlength="6" class="w-full px-3 py-2 border rounded-lg"></div>
        <button type="submit" class="bg-orange-500 text-white px-4 py-2 rounded-lg text-sm hover:bg-orange-600">Update Password</button>
      </form>
    </div>
  </div>`;
  content.innerHTML = html;

  document.getElementById('profile-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    try { const d = await api.patch('/users/profile/edit', { name: document.getElementById('pf-name').value, phone: document.getElementById('pf-phone').value }); api.user = d.user; localStorage.setItem('user', JSON.stringify(d.user)); document.getElementById('user-name').textContent = d.user.name; toast('Profile updated'); } catch (err) { toast(err.message, 'error'); }
  });

  document.getElementById('pw-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    try { await api.patch('/users/password/change', { current_password: document.getElementById('pw-current').value, new_password: document.getElementById('pw-new').value }); toast('Password changed'); document.getElementById('pw-current').value = ''; document.getElementById('pw-new').value = ''; } catch (err) { toast(err.message, 'error'); }
  });
}

// Version History
async function showVersionHistory(entityType, entityId) {
  const overlay = document.getElementById('version-history-overlay');
  const panel = document.getElementById('version-history-panel');
  const body = document.getElementById('version-history-body');

  overlay.classList.remove('hidden');
  panel.classList.remove('hidden');
  panel.style.transform = 'translateX(0)';
  body.innerHTML = '<div class="text-center text-gray-400 py-8"><i class="fas fa-spinner fa-spin text-2xl"></i></div>';

  try {
    const data = await api.get(`/audit-log?entity=${entityType}&entity_id=${entityId}`);
    const logs = data.logs || [];

    if (logs.length === 0) {
      body.innerHTML = '<div class="text-center text-gray-400 py-8"><i class="fas fa-clock text-3xl mb-3"></i><p>No history available</p></div>';
      return;
    }

    // Group by date
    const groups = {};
    logs.forEach(l => {
      const d = new Date(l.created_at);
      const key = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      if (!groups[key]) groups[key] = [];
      groups[key].push(l);
    });

    let html = '';
    for (const [month, entries] of Object.entries(groups)) {
      html += `<div class="mb-6"><p class="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">${month}</p>`;
      entries.forEach(l => {
        const d = new Date(l.created_at);
        const timeStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ', ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
        const actionBadge = versionActionBadge(l.action);
        const detail = formatVersionDetail(l.action, l.details, entityType);
        html += `
          <div class="flex gap-3 mb-4 relative pl-4 border-l-2 border-gray-200">
            <div class="absolute left-[-5px] top-1 w-2 h-2 rounded-full ${actionColor(l.action)}"></div>
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 flex-wrap">
                <span class="text-sm font-medium text-gray-800">${timeStr}</span>
                ${actionBadge}
              </div>
              <p class="text-sm text-gray-500 mt-0.5">${l.performed_by_name || 'System'}</p>
              ${detail ? `<p class="text-xs text-gray-400 mt-1">${detail}</p>` : ''}
            </div>
          </div>`;
      });
      html += '</div>';
    }
    body.innerHTML = html;
  } catch (err) {
    body.innerHTML = `<div class="text-center text-red-400 py-8"><i class="fas fa-exclamation-circle text-2xl mb-3"></i><p>${err.message}</p></div>`;
  }
}

function closeVersionHistory() {
  const overlay = document.getElementById('version-history-overlay');
  const panel = document.getElementById('version-history-panel');
  panel.style.transform = 'translateX(100%)';
  setTimeout(() => { overlay.classList.add('hidden'); panel.classList.add('hidden'); }, 300);
}

function actionColor(action) {
  const colors = { create: 'bg-blue-500', update: 'bg-yellow-500', approve: 'bg-green-500', reject: 'bg-red-500', delete: 'bg-gray-500', upload: 'bg-purple-500' };
  return colors[action] || 'bg-gray-400';
}

function versionActionBadge(action) {
  const styles = {
    create: 'bg-blue-100 text-blue-700',
    update: 'bg-yellow-100 text-yellow-700',
    approve: 'bg-green-100 text-green-700',
    reject: 'bg-red-100 text-red-700',
    delete: 'bg-gray-100 text-gray-700',
    upload: 'bg-purple-100 text-purple-700',
  };
  const labels = { create: 'Created', update: 'Updated', approve: 'Approved', reject: 'Rejected', delete: 'Deleted', upload: 'Uploaded' };
  return `<span class="text-xs px-2 py-0.5 rounded-full font-medium ${styles[action] || 'bg-gray-100 text-gray-600'}">${labels[action] || action}</span>`;
}

function formatVersionDetail(action, details, entityType) {
  if (!details) return '';
  if (action === 'update' && details.before && details.after) {
    const changes = [];
    for (const key of Object.keys(details.after)) {
      if (details.before[key] !== details.after[key]) {
        const label = key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' ');
        changes.push(`${label}: ${details.before[key] ?? '-'} → ${details.after[key] ?? '-'}`);
      }
    }
    return changes.join(' · ');
  }
  if (action === 'create') {
    if (entityType === 'expense' && details.amount) return `Amount: ${fmt(details.amount)}`;
    if (entityType === 'collection' && details.total) return `Total: ${fmt(details.total)}`;
  }
  return '';
}

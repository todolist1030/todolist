/**
 * My To-Do Application with Supabase Auth & RLS
 * Features:
 * - Supabase Authentication (Email/Password Sign-in & Sign-up)
 * - User-scoped Todos (RLS: Each user only accesses their own todos)
 * - Realtime Synchronization & 5s Polling Fallback
 * - Light / Dark / Sepia (Warm) Themes
 * - Priority, Due-date (D-Day badge), Categories, Details Modal
 */

// Storage & Supabase Keys
const STORAGE_PREFIX = 'todo_app_user_';
const THEME_KEY = 'todo_theme_mode';

const SUPABASE_URL = 'https://lqfrldvbngtrtjhagjyp.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_aEYmYwtasi-MHfKiXt0K-g_Uux65y89';

let supabaseClient = null;
let realtimeChannel = null;
let currentUser = null;
let authMode = 'login'; // 'login' | 'signup'

function getSupabase() {
  if (supabaseClient) return supabaseClient;
  if (window.supabase && typeof window.supabase.createClient === 'function') {
    try {
      supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      return supabaseClient;
    } catch (err) {
      console.warn('Supabase createClient 실패:', err);
    }
  }
  return null;
}

// Application State
const state = {
  tasks: [],
  currentFilter: 'all', // 'all' | 'active' | 'completed'
  searchQuery: '',
  sortBy: 'created-desc',
  isCompletedOpen: true,
  theme: 'light'
};

// DOM Elements
const elements = {
  // Views
  authView: document.getElementById('authView'),
  mainAppView: document.getElementById('mainAppView'),

  // Auth Elements
  authForm: document.getElementById('authForm'),
  authEmail: document.getElementById('authEmail'),
  authPassword: document.getElementById('authPassword'),
  authSubmitBtn: document.getElementById('authSubmitBtn'),
  authAlert: document.getElementById('authAlert'),
  tabLogin: document.getElementById('tabLogin'),
  tabSignup: document.getElementById('tabSignup'),
  toggleAuthModeLink: document.getElementById('toggleAuthModeLink'),

  // Header & User Actions
  userEmailBadge: document.getElementById('userEmailBadge'),
  logoutBtn: document.getElementById('logoutBtn'),
  syncBadge: document.getElementById('syncBadge'),
  themeToggleBtn: document.getElementById('themeToggleBtn'),
  sunIcon: document.getElementById('sunIcon'),
  moonIcon: document.getElementById('moonIcon'),
  coffeeIcon: document.getElementById('coffeeIcon'),

  // Header & Banner
  currentDateText: document.getElementById('currentDateText'),
  progressSummary: document.getElementById('progressSummary'),
  progressBar: document.getElementById('progressBar'),

  // Form
  todoForm: document.getElementById('todoForm'),
  taskTitleInput: document.getElementById('taskTitleInput'),
  prioritySelect: document.getElementById('prioritySelect'),
  dueDateInput: document.getElementById('dueDateInput'),
  categorySelect: document.getElementById('categorySelect'),

  // Controls
  tabButtons: document.querySelectorAll('.tab-btn'),
  searchInput: document.getElementById('searchInput'),
  sortSelect: document.getElementById('sortSelect'),

  // Lists
  activeSection: document.getElementById('activeSection'),
  activeTasksList: document.getElementById('activeTasksList'),
  activeCountBadge: document.getElementById('activeCountBadge'),

  completedSection: document.getElementById('completedSection'),
  accordionHeader: document.getElementById('accordionHeader'),
  completedTasksWrapper: document.getElementById('completedTasksWrapper'),
  completedTasksList: document.getElementById('completedTasksList'),
  completedCountBadge: document.getElementById('completedCountBadge'),
  clearCompletedBtn: document.getElementById('clearCompletedBtn'),

  // Footer
  footerStats: document.getElementById('footerStats'),

  // Modal
  editModal: document.getElementById('editModal'),
  editForm: document.getElementById('editForm'),
  closeModalBtn: document.getElementById('closeModalBtn'),
  cancelModalBtn: document.getElementById('cancelModalBtn'),
  editTaskId: document.getElementById('editTaskId'),
  editTaskTitle: document.getElementById('editTaskTitle'),
  editPriority: document.getElementById('editPriority'),
  editCategory: document.getElementById('editCategory'),
  editDueDate: document.getElementById('editDueDate'),
  editMemo: document.getElementById('editMemo'),

  // Toast
  toastContainer: document.getElementById('toastContainer')
};

/* ==========================================================================
   Helper & UI Functions
   ========================================================================== */

function getUserStorageKey() {
  return currentUser ? `${STORAGE_PREFIX}${currentUser.id}` : 'todo_guest_tasks';
}

function saveUserTasks() {
  if (!currentUser) return;
  try {
    localStorage.setItem(getUserStorageKey(), JSON.stringify(state.tasks));
  } catch (err) {
    console.error('LocalStorage 저장 실패:', err);
  }
}

function loadUserCachedTasks() {
  if (!currentUser) return;
  try {
    const cached = localStorage.getItem(getUserStorageKey());
    if (cached) {
      state.tasks = JSON.parse(cached);
      renderApp();
    }
  } catch (err) {}
}

function updateSyncBadge(status, text) {
  if (!elements.syncBadge) return;
  elements.syncBadge.className = `sync-badge ${status}`;
  elements.syncBadge.textContent = text;
}

function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  
  let iconSvg = '';
  if (type === 'success') {
    iconSvg = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>';
  } else if (type === 'danger') {
    iconSvg = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';
  } else {
    iconSvg = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>';
  }

  toast.innerHTML = `${iconSvg}<span>${escapeHtml(message)}</span>`;
  elements.toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(8px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 2400);
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>'"]/g, tag => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;'
  }[tag] || tag));
}

function formatKoreanDate(dateObj) {
  const days = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];
  const y = dateObj.getFullYear();
  const m = dateObj.getMonth() + 1;
  const d = dateObj.getDate();
  const dayName = days[dateObj.getDay()];
  return `${y}년 ${m}월 ${d}일 ${dayName}`;
}

function formatDateTimeShort(isoStr) {
  if (!isoStr) return '';
  const d = new Date(isoStr);
  const m = d.getMonth() + 1;
  const date = d.getDate();
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${m}월 ${date}일 ${hours}:${minutes}`;
}

function getDDayInfo(dueDateStr) {
  if (!dueDateStr) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const [year, month, day] = dueDateStr.split('-').map(Number);
  const target = new Date(year, month - 1, day);
  target.setHours(0, 0, 0, 0);
  
  const diffDays = Math.round((target - today) / (1000 * 60 * 60 * 24));
  
  if (diffDays < 0) {
    return { text: `D+${Math.abs(diffDays)} 지남`, className: 'overdue' };
  } else if (diffDays === 0) {
    return { text: '오늘 마감', className: 'today' };
  } else {
    return { text: `D-${diffDays}`, className: 'normal' };
  }
}

/* ==========================================================================
   Supabase Authentication (회원가입 / 로그인 / 로그아웃)
   ========================================================================== */

function showAuthAlert(type, message) {
  elements.authAlert.className = `auth-alert ${type}`;
  elements.authAlert.textContent = message;
}

function clearAuthAlert() {
  elements.authAlert.className = 'auth-alert';
  elements.authAlert.textContent = '';
}

function setAuthMode(mode) {
  authMode = mode;
  clearAuthAlert();
  if (mode === 'login') {
    elements.tabLogin.classList.add('active');
    elements.tabSignup.classList.remove('active');
    elements.authSubmitBtn.textContent = '로그인';
    elements.toggleAuthModeLink.textContent = '계정이 없으신가요? 회원가입하기';
  } else {
    elements.tabSignup.classList.add('active');
    elements.tabLogin.classList.remove('active');
    elements.authSubmitBtn.textContent = '회원가입';
    elements.toggleAuthModeLink.textContent = '이미 계정이 있으신가요? 로그인하기';
  }
}

function showAuthView() {
  elements.authView.style.display = 'flex';
  elements.mainAppView.style.display = 'none';
  clearAuthAlert();
}

function showAppView(user) {
  elements.authView.style.display = 'none';
  elements.mainAppView.style.display = 'block';
  elements.userEmailBadge.textContent = `👤 ${user.email}`;
  elements.userEmailBadge.title = `로그인된 계정: ${user.email}`;
}

function getFriendlyAuthErrorMessage(msg) {
  if (!msg) return '알 수 없는 오류가 발생했습니다.';
  if (msg.includes('Invalid login credentials')) return '이메일 또는 비밀번호가 올바르지 않습니다.';
  if (msg.includes('User already registered')) return '이미 가입된 이메일 주소입니다. 로그인해 주세요.';
  if (msg.includes('Password should be at least')) return '비밀번호는 최소 6자리 이상이어야 합니다.';
  if (msg.includes('Email not confirmed')) return '이메일 인증이 완료되지 않았습니다. 메일함을 확인해 주세요.';
  return msg;
}

async function handleAuthSubmit(e) {
  e.preventDefault();
  const email = elements.authEmail.value.trim();
  const password = elements.authPassword.value;

  if (!email || !password) return;

  elements.authSubmitBtn.disabled = true;
  elements.authSubmitBtn.textContent = '처리 중...';
  clearAuthAlert();

  const client = getSupabase();
  if (!client) {
    showAuthAlert('error', 'Supabase 클라이언트를 초기화할 수 없습니다. 인터넷 연결을 확인해 주세요.');
    elements.authSubmitBtn.disabled = false;
    elements.authSubmitBtn.textContent = authMode === 'login' ? '로그인' : '회원가입';
    return;
  }

  try {
    if (authMode === 'login') {
      const { data, error } = await client.auth.signInWithPassword({ email, password });
      if (error) {
        showAuthAlert('error', `로그인 실패: ${getFriendlyAuthErrorMessage(error.message)}`);
      } else if (data.user) {
        currentUser = data.user;
        showToast(`어서오세요, ${currentUser.email}님!`, 'success');
        showAppView(currentUser);
        loadUserCachedTasks();
        await fetchUserTodos(true);
        subscribeToRealtime();
      }
    } else {
      // 회원가입 (Sign up)
      const { data, error } = await client.auth.signUp({ email, password });
      if (error) {
        showAuthAlert('error', `회원가입 실패: ${getFriendlyAuthErrorMessage(error.message)}`);
      } else if (data.user) {
        if (data.session) {
          // 즉시 로그인 세션 생성 (Confirm email 꺼져있는 경우)
          currentUser = data.user;
          showToast('회원가입 및 로그인이 완료되었습니다!', 'success');
          showAppView(currentUser);
          await fetchUserTodos(true);
          subscribeToRealtime();
        } else {
          // 이메일 확인이 필요한 경우
          showAuthAlert('success', '가입 신청이 완료되었습니다! Supabase 설정에서 Confirm email을 끄셨다면 바로 로그인하실 수 있습니다.');
          setAuthMode('login');
        }
      }
    }
  } catch (err) {
    showAuthAlert('error', `오류 발생: ${err.message}`);
  } finally {
    elements.authSubmitBtn.disabled = false;
    elements.authSubmitBtn.textContent = authMode === 'login' ? '로그인' : '회원가입';
  }
}

async function handleLogout() {
  if (confirm('로그아웃 하시겠습니까?')) {
    const client = getSupabase();
    if (client) {
      await client.auth.signOut();
    }
    currentUser = null;
    state.tasks = [];
    if (realtimeChannel && client) {
      client.removeChannel(realtimeChannel);
      realtimeChannel = null;
    }
    showAuthView();
    showToast('로그아웃 되었습니다.', 'info');
  }
}

/* ==========================================================================
   Supabase Data Fetching & Sync (RLS 적용된 본인 할 일만 관리)
   ========================================================================== */

async function fetchUserTodos(showStatus = true) {
  if (!currentUser) return false;
  const client = getSupabase();
  if (!client) {
    updateSyncBadge('error', '⚠️ 오프라인');
    return false;
  }

  if (showStatus) updateSyncBadge('', '🔄 데이터 동기화 중...');

  try {
    // RLS 정책에 의해 자동으로 auth.uid() = user_id 인 본인 데이터만 반환됩니다.
    const { data, error } = await client
      .from('todos')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Supabase 데이터 조회 오류:', error);
      updateSyncBadge('error', '⚠️ 데이터베이스 권한 확인');
      return false;
    }

    if (data) {
      state.tasks = data.map(row => ({
        id: row.id,
        user_id: row.user_id,
        title: row.title,
        completed: Boolean(row.completed),
        createdAt: row.created_at,
        completedAt: row.completed_at,
        priority: row.priority || 'medium',
        dueDate: row.due_date || null,
        category: row.category || '업무',
        memo: row.memo || ''
      }));
      saveUserTasks();
      renderApp();
      updateSyncBadge('connected', '🟢 실시간 동기화 중');
      return true;
    }
  } catch (err) {
    console.error('fetchUserTodos 예외:', err);
    updateSyncBadge('error', '⚠️ 연결 오류');
  }
  return false;
}

function subscribeToRealtime() {
  if (!currentUser) return;
  const client = getSupabase();
  if (!client) return;

  if (realtimeChannel) {
    client.removeChannel(realtimeChannel);
    realtimeChannel = null;
  }

  try {
    // 본인의 user_id 변경 사항만 실시간 수신
    realtimeChannel = client
      .channel(`todos-user-${currentUser.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'todos',
          filter: `user_id=eq.${currentUser.id}`
        },
        async (payload) => {
          console.log('⚡ 내 할 일 실시간 변경 감지:', payload);
          await fetchUserTodos(false);
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          updateSyncBadge('connected', '🟢 실시간 동기화 중');
        }
      });
  } catch (err) {
    console.warn('Realtime 구독 실패:', err);
  }
}

/* ==========================================================================
   Task Operations (CRUD with user_id)
   ========================================================================== */

async function addTask(title, priority, dueDate, category) {
  if (!currentUser) {
    showToast('로그인이 필요합니다.', 'danger');
    showAuthView();
    return;
  }

  const newTask = {
    id: 'task-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7),
    user_id: currentUser.id,
    title: title.trim(),
    completed: false,
    createdAt: new Date().toISOString(),
    completedAt: null,
    priority: priority || 'medium',
    dueDate: dueDate || null,
    category: category || '업무',
    memo: ''
  };

  state.tasks.unshift(newTask);
  saveUserTasks();
  renderApp();

  const client = getSupabase();
  if (client) {
    try {
      const { error } = await client.from('todos').insert([{
        id: newTask.id,
        user_id: currentUser.id,
        title: newTask.title,
        completed: false,
        priority: newTask.priority,
        due_date: newTask.dueDate,
        category: newTask.category,
        memo: newTask.memo
      }]);

      if (error) {
        console.error('Supabase insert 실패:', error);
        showToast(`⚠️ 클라우드 저장 실패: ${error.message}`, 'danger');
      } else {
        showToast('새 할 일이 클라우드에 실시간 저장되었습니다.', 'success');
      }
    } catch (err) {
      console.error('Supabase insert 예외:', err);
    }
  }
}

async function toggleTask(id) {
  if (!currentUser) return;
  const task = state.tasks.find(t => t.id === id);
  if (!task) return;

  task.completed = !task.completed;
  if (task.completed) {
    task.completedAt = new Date().toISOString();
    showToast(`'${task.title}' 완료 처리되었습니다! (아래 완료 목록으로 이동)`, 'success');
  } else {
    task.completedAt = null;
    showToast(`'${task.title}' 진행 중으로 복원되었습니다.`, 'info');
  }

  saveUserTasks();
  renderApp();

  const client = getSupabase();
  if (client) {
    try {
      const { error } = await client.from('todos').update({
        completed: task.completed,
        completed_at: task.completedAt
      }).eq('id', task.id).eq('user_id', currentUser.id);

      if (error) console.error('Supabase toggle update 실패:', error);
    } catch (err) {
      console.warn('Supabase toggle update 예외:', err);
    }
  }
}

async function deleteTask(id) {
  if (!currentUser) return;
  const taskIndex = state.tasks.findIndex(t => t.id === id);
  if (taskIndex === -1) return;

  const title = state.tasks[taskIndex].title;
  state.tasks.splice(taskIndex, 1);
  saveUserTasks();
  renderApp();
  showToast(`'${title}' 삭제되었습니다.`, 'danger');

  const client = getSupabase();
  if (client) {
    try {
      const { error } = await client.from('todos').delete().eq('id', id).eq('user_id', currentUser.id);
      if (error) console.error('Supabase delete 실패:', error);
    } catch (err) {
      console.warn('Supabase delete 예외:', err);
    }
  }
}

async function clearAllCompleted() {
  if (!currentUser) return;
  const completedCount = state.tasks.filter(t => t.completed).length;
  if (completedCount === 0) return;

  if (confirm(`완료된 할 일 ${completedCount}개를 모두 삭제하시겠습니까?`)) {
    state.tasks = state.tasks.filter(t => !t.completed);
    saveUserTasks();
    renderApp();
    showToast(`완료된 항목 ${completedCount}개가 정리되었습니다.`, 'danger');

    const client = getSupabase();
    if (client) {
      try {
        const { error } = await client.from('todos').delete().eq('completed', true).eq('user_id', currentUser.id);
        if (error) console.error('Supabase clear completed 실패:', error);
      } catch (err) {
        console.warn('Supabase clear completed 예외:', err);
      }
    }
  }
}

function openEditModal(id) {
  const task = state.tasks.find(t => t.id === id);
  if (!task) return;

  elements.editTaskId.value = task.id;
  elements.editTaskTitle.value = task.title;
  elements.editPriority.value = task.priority || 'medium';
  elements.editCategory.value = task.category || '업무';
  elements.editDueDate.value = task.dueDate || '';
  elements.editMemo.value = task.memo || '';

  elements.editModal.classList.add('open');
  elements.editTaskTitle.focus();
}

function closeEditModal() {
  elements.editModal.classList.remove('open');
  elements.editForm.reset();
}

async function handleEditFormSubmit(e) {
  e.preventDefault();
  if (!currentUser) return;

  const id = elements.editTaskId.value;
  const task = state.tasks.find(t => t.id === id);
  if (!task) return;

  const newTitle = elements.editTaskTitle.value.trim();
  if (!newTitle) return;

  task.title = newTitle;
  task.priority = elements.editPriority.value;
  task.category = elements.editCategory.value;
  task.dueDate = elements.editDueDate.value || null;
  task.memo = elements.editMemo.value.trim();

  saveUserTasks();
  closeEditModal();
  renderApp();
  showToast('할 일이 성공적으로 수정되었습니다.', 'success');

  const client = getSupabase();
  if (client) {
    try {
      const { error } = await client.from('todos').update({
        title: task.title,
        priority: task.priority,
        category: task.category,
        due_date: task.dueDate,
        memo: task.memo
      }).eq('id', task.id).eq('user_id', currentUser.id);

      if (error) console.error('Supabase edit update 실패:', error);
    } catch (err) {
      console.warn('Supabase edit update 예외:', err);
    }
  }
}

/* ==========================================================================
   Filter & Sorting Logic
   ========================================================================== */

function getFilteredAndSortedTasks() {
  let list = [...state.tasks];

  if (state.searchQuery.trim()) {
    const q = state.searchQuery.trim().toLowerCase();
    list = list.filter(t => 
      t.title.toLowerCase().includes(q) ||
      (t.memo && t.memo.toLowerCase().includes(q)) ||
      (t.category && t.category.toLowerCase().includes(q))
    );
  }

  list.sort((a, b) => {
    switch (state.sortBy) {
      case 'due-asc': {
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return a.dueDate.localeCompare(b.dueDate);
      }
      case 'priority-desc': {
        const priorityWeight = { high: 3, medium: 2, low: 1 };
        return (priorityWeight[b.priority] || 2) - (priorityWeight[a.priority] || 2);
      }
      case 'title-asc':
        return a.title.localeCompare(b.title, 'ko-KR');
      case 'created-desc':
      default:
        return new Date(b.createdAt) - new Date(a.createdAt);
    }
  });

  return list;
}

/* ==========================================================================
   Render UI Components
   ========================================================================== */

function renderProgress() {
  const total = state.tasks.length;
  const completed = state.tasks.filter(t => t.completed).length;
  const percent = total === 0 ? 0 : Math.round((completed / total) * 100);

  elements.progressBar.style.width = `${percent}%`;
  elements.progressSummary.textContent = `${completed} / ${total} 완료 (${percent}%)`;

  const remaining = total - completed;
  elements.footerStats.textContent = `남은 할 일: ${remaining}개 (총 ${total}개)`;
}

function createTaskItemElement(task) {
  const item = document.createElement('div');
  item.className = `task-item ${task.completed ? 'completed' : ''}`;
  item.id = `item-${task.id}`;

  const checkSvg = `
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="20 6 9 17 4 12"></polyline>
    </svg>
  `;

  const priorityLabels = { high: '높음 🔥', medium: '보통', low: '낮음 ☕' };
  const priorityClass = `badge-priority-${task.priority || 'medium'}`;

  const ddayInfo = getDDayInfo(task.dueDate);
  const ddayBadgeHtml = ddayInfo 
    ? `<span class="badge badge-dday ${ddayInfo.className}">📅 ${ddayInfo.text}</span>` 
    : '';

  const categoryBadgeHtml = task.category 
    ? `<span class="badge badge-category">🏷️ ${escapeHtml(task.category)}</span>` 
    : '';

  const completedTimeHtml = task.completed && task.completedAt 
    ? `<span class="completed-timestamp">✓ ${formatDateTimeShort(task.completedAt)} 완료</span>` 
    : '';

  const memoSnippetHtml = task.memo 
    ? `<div class="task-memo-preview" title="${escapeHtml(task.memo)}">📝 ${escapeHtml(task.memo)}</div>` 
    : '';

  item.innerHTML = `
    <button type="button" class="checkbox-custom" data-action="toggle" title="${task.completed ? '다시 진행 중으로 복원' : '완료 체크'}">
      ${task.completed ? checkSvg : ''}
    </button>
    <div class="task-content">
      <div class="task-title">${escapeHtml(task.title)}</div>
      <div class="task-meta">
        <span class="badge ${priorityClass}">${priorityLabels[task.priority || 'medium']}</span>
        ${ddayBadgeHtml}
        ${categoryBadgeHtml}
        ${completedTimeHtml}
      </div>
      ${memoSnippetHtml}
    </div>
    <div class="task-actions">
      <button type="button" class="btn-task-action" data-action="edit" title="수정">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 20h9"></path>
          <path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"></path>
        </svg>
      </button>
      <button type="button" class="btn-task-action delete" data-action="delete" title="삭제">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="3 6 5 6 21 6"></polyline>
          <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"></path>
        </svg>
      </button>
    </div>
  `;

  item.querySelector('[data-action="toggle"]').addEventListener('click', (e) => {
    e.stopPropagation();
    toggleTask(task.id);
  });

  item.querySelector('[data-action="edit"]').addEventListener('click', (e) => {
    e.stopPropagation();
    openEditModal(task.id);
  });

  item.querySelector('[data-action="delete"]').addEventListener('click', (e) => {
    e.stopPropagation();
    deleteTask(task.id);
  });

  return item;
}

function renderApp() {
  renderProgress();

  const allFiltered = getFilteredAndSortedTasks();
  const activeTasks = allFiltered.filter(t => !t.completed);
  const completedTasks = allFiltered.filter(t => t.completed);

  elements.activeCountBadge.textContent = `(${activeTasks.length})`;
  elements.completedCountBadge.textContent = `(${completedTasks.length})`;

  elements.clearCompletedBtn.style.display = completedTasks.length > 0 ? 'inline-block' : 'none';

  if (state.currentFilter === 'active') {
    elements.activeSection.style.display = 'block';
    elements.completedSection.style.display = 'none';
  } else if (state.currentFilter === 'completed') {
    elements.activeSection.style.display = 'none';
    elements.completedSection.style.display = 'block';
  } else {
    elements.activeSection.style.display = 'block';
    elements.completedSection.style.display = 'block';
  }

  // Active Tasks
  elements.activeTasksList.innerHTML = '';
  if (activeTasks.length === 0) {
    elements.activeTasksList.innerHTML = `
      <div class="empty-state">
        <svg class="empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <polyline points="12 6 12 12 14 14"></polyline>
        </svg>
        <p class="empty-text">${state.searchQuery ? '검색 결과가 없습니다.' : '진행 중인 할 일이 없습니다. 새로운 할 일을 등록해 보세요!'}</p>
      </div>
    `;
  } else {
    activeTasks.forEach(task => {
      elements.activeTasksList.appendChild(createTaskItemElement(task));
    });
  }

  // Completed Tasks
  elements.completedTasksList.innerHTML = '';
  if (completedTasks.length === 0) {
    elements.completedTasksList.innerHTML = `
      <div class="empty-state" style="padding: 1.5rem 1rem;">
        <p class="empty-text" style="font-size: 0.85rem;">완료된 할 일이 아직 없습니다.</p>
      </div>
    `;
  } else {
    completedTasks.forEach(task => {
      elements.completedTasksList.appendChild(createTaskItemElement(task));
    });
  }
}

/* ==========================================================================
   Theme Setup
   ========================================================================== */

function setupTheme() {
  const savedTheme = localStorage.getItem(THEME_KEY) || 'light';
  applyTheme(savedTheme, false);

  elements.themeToggleBtn.addEventListener('click', () => {
    let nextTheme = 'light';
    let msg = '☀️ 라이트 모드로 전환되었습니다.';

    if (state.theme === 'light') {
      nextTheme = 'dark';
      msg = '🌙 다크 모드로 전환되었습니다.';
    } else if (state.theme === 'dark') {
      nextTheme = 'sepia';
      msg = '☕ 눈이 편안한 세피아(웜) 모드로 전환되었습니다.';
    } else {
      nextTheme = 'light';
      msg = '☀️ 라이트 모드로 전환되었습니다.';
    }

    applyTheme(nextTheme, true);
    showToast(msg, 'info');
  });
}

function applyTheme(theme) {
  state.theme = theme;
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem(THEME_KEY, theme);

  elements.moonIcon.style.display = 'none';
  elements.sunIcon.style.display = 'none';
  elements.coffeeIcon.style.display = 'none';

  if (theme === 'light') {
    elements.moonIcon.style.display = 'block';
    elements.themeToggleBtn.title = '다크 모드로 전환';
  } else if (theme === 'dark') {
    elements.coffeeIcon.style.display = 'block';
    elements.themeToggleBtn.title = '세피아(웜) 모드로 전환';
  } else if (theme === 'sepia') {
    elements.sunIcon.style.display = 'block';
    elements.themeToggleBtn.title = '라이트 모드로 전환';
  }
}

/* ==========================================================================
   Setup Event Listeners & App Lifecycle
   ========================================================================== */

function setupEventListeners() {
  // Auth Form & Tabs
  elements.authForm.addEventListener('submit', handleAuthSubmit);
  elements.tabLogin.addEventListener('click', () => setAuthMode('login'));
  elements.tabSignup.addEventListener('click', () => setAuthMode('signup'));
  elements.toggleAuthModeLink.addEventListener('click', (e) => {
    e.preventDefault();
    setAuthMode(authMode === 'login' ? 'signup' : 'login');
  });

  // Logout
  elements.logoutBtn.addEventListener('click', handleLogout);

  // Todo Form Submit
  elements.todoForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const title = elements.taskTitleInput.value;
    const priority = elements.prioritySelect.value;
    const dueDate = elements.dueDateInput.value;
    const category = elements.categorySelect.value;

    if (!title.trim()) return;

    addTask(title, priority, dueDate, category);
    elements.taskTitleInput.value = '';
    elements.dueDateInput.value = '';
    elements.taskTitleInput.focus();
  });

  // Filter Tabs
  elements.tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      elements.tabButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.currentFilter = btn.dataset.filter;
      renderApp();
    });
  });

  // Search Input
  elements.searchInput.addEventListener('input', (e) => {
    state.searchQuery = e.target.value;
    renderApp();
  });

  // Sort Select
  elements.sortSelect.addEventListener('change', (e) => {
    state.sortBy = e.target.value;
    renderApp();
  });

  // Accordion Toggle for Completed Tasks
  elements.accordionHeader.addEventListener('click', (e) => {
    if (e.target.closest('#clearCompletedBtn')) return;
    state.isCompletedOpen = !state.isCompletedOpen;
    elements.accordionHeader.classList.toggle('open', state.isCompletedOpen);
    elements.completedTasksWrapper.classList.toggle('show', state.isCompletedOpen);
  });

  // Clear Completed Button
  elements.clearCompletedBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    clearAllCompleted();
  });

  // Modal Form
  elements.editForm.addEventListener('submit', handleEditFormSubmit);
  elements.closeModalBtn.addEventListener('click', closeEditModal);
  elements.cancelModalBtn.addEventListener('click', closeEditModal);

  elements.editModal.addEventListener('click', (e) => {
    if (e.target === elements.editModal) closeEditModal();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && elements.editModal.classList.contains('open')) {
      closeEditModal();
    }
  });
}

// App Initialization
async function init() {
  elements.currentDateText.textContent = formatKoreanDate(new Date());

  setupTheme();
  setupEventListeners();

  // Supabase SDK 로딩 대기 (최대 2초)
  let attempts = 0;
  while (!getSupabase() && attempts < 10) {
    await new Promise(r => setTimeout(r, 200));
    attempts++;
  }

  const client = getSupabase();
  if (!client) {
    showAuthAlert('error', 'Supabase 연결에 실패했습니다. 페이지를 새로고침해 주세요.');
    showAuthView();
    return;
  }

  // 1. 현재 로그인 세션 확인
  try {
    const { data: { session } } = await client.auth.getSession();
    if (session?.user) {
      currentUser = session.user;
      showAppView(currentUser);
      loadUserCachedTasks();
      await fetchUserTodos(true);
      subscribeToRealtime();
    } else {
      currentUser = null;
      showAuthView();
    }
  } catch (err) {
    console.error('getSession 오류:', err);
    showAuthView();
  }

  // 2. 인증 상태 실시간 변경 리스너 (로그인/로그아웃/토큰갱신)
  client.auth.onAuthStateChange(async (event, session) => {
    if (event === 'SIGNED_IN' && session?.user) {
      if (!currentUser || currentUser.id !== session.user.id) {
        currentUser = session.user;
        showAppView(currentUser);
        loadUserCachedTasks();
        await fetchUserTodos(true);
        subscribeToRealtime();
      }
    } else if (event === 'SIGNED_OUT') {
      currentUser = null;
      state.tasks = [];
      showAuthView();
    }
  });

  // 3. 주기적 자동 동기화 (5초마다 백그라운드 폴링)
  setInterval(() => {
    if (currentUser) {
      fetchUserTodos(false);
    }
  }, 5000);
}

document.addEventListener('DOMContentLoaded', init);
